"""Organic borders between the parts of a split giant (Logan, 2026-10-24; D850 to D856).

The giant split (D820 to D829) cut its parts with straight lines across the long axis and kept
whole ADM2 units or town catchments where it could, which drew rectangle grids in the outback,
northern Canada and Siberia. Logan: "a bit more organic": cut along natural features and real
lines first (rivers, lakes, licensed district lines); where nothing natural is nearby, use a
gently meandering line instead of a straight one.

This module holds the pieces of that: the river centerlines near a giant (Natural Earth 10m
`rivers_lake_centerlines`, public domain), the deterministic meanders (sums of a few sines whose
phases come from a sha256 of the province id and the cut's place in the bisection), the cut
curve and its low-side polygon in the giant's equal-area frame, the meandered town-catchment
edges, and the border statistics. `subdivide._bisect` chooses the curve; every curve is a
function of a seed string, never of run order or Python's `hash`, so a rerun is byte-identical.
"""

from __future__ import annotations

import hashlib
import math

import geopandas as gpd
import numpy as np
import shapely
from shapely.geometry import LineString, Polygon, box

from . import config

# Rivers (D851): Natural Earth river and lake centerlines up to this scalerank (0 is the
# Amazon, 9 the smallest rivers kept on a 1:10m map; 10 to 12 are a handful of stubs), of
# these classes (the two canals are not natural).
RIVER_FILE = "ne_10m_rivers_lake_centerlines.shp"
RIVER_MAX_SCALERANK = 9
RIVER_CLASSES = ("River", "Lake Centerline", "River (Intermittent)")
# River lines are simplified to this many metres in the frame (the map's pixel is about 5 km).
RIVER_SIMPLIFY_M = 500.0
# A river run may follow the cut only this far inside the group's outline (a river that is
# itself the outer border, or runs beside it, would leave a sliver), as a share of a part's
# width (the square root of a mean part's area), and never less than RIVER_EDGE_MIN_M.
RIVER_EDGE = 0.08
RIVER_EDGE_MIN_M = 12_000.0
# A run is looked for within this share of a part's width of the balanced straight line.
RIVER_NEAR = 0.6
# A run must cross the cut more than run along it: its progress across the long axis at least
# this share of its length.
RIVER_PROGRESS = 0.55
# A run must be at least this share of a part's width long, and the river must be at least
# RIVER_MIN_SHARE of the final cut inside the group, or the cut meanders instead.
RIVER_MIN_RUN = 0.25
RIVER_MIN_SHARE = 0.2
# The ends of a river cut ramp back to the balancing offset over this share of a part's width,
# at most RAMP_SLOPE across per unit along.
RAMP_LEN = 1.5
RAMP_SLOPE = 0.9
# Stretches of a run tried after the whole run (shares of its length).
RIVER_WINDOWS = (0.65, 0.4)
# The longest runs tried per cut.
RIVER_TRIES = 6
# Meanders (D852): offset = sum of A_k sin(2 pi v / L_k + phase_k), A_k = MEANDER_AMP x width x
# MEANDER_WEIGHTS[k] x a draw in [0.6, 1], L_k = width x MEANDER_WAVES[k]: a 45,000 km2 part
# (212 km wide) meanders up to about 25 km either way (typically 10 to 20) on waves of 300, 150
# and 75 km; the steepest slope is about 1.0 at worst (all three waves aligned at their shortest),
# and the line is a function of the position along it, so it never crosses itself. (0.045 read
# as still straight at map scale, D852.)
MEANDER_AMP = 0.08
MEANDER_WAVES = (1.4, 0.7, 0.35)
MEANDER_WEIGHTS = (1.0, 0.4, 0.15)
# Seeds tried when a meander would move a protected point across the cut (then straight).
MEANDER_TRIES = 4
# Curves are sampled every this many metres along (at most), or width / CURVE_SAMPLES.
CURVE_STEP_M = 3000.0
CURVE_SAMPLES = 70
# A protected point (a part's id point, a site, a city probe point) must stay at least this far
# from the cut and on the side the straight cut put it.
PROTECT_M = 4000.0
# Town-catchment edges (D853): each Voronoi edge between two towns' cells bends by a sum of
# three half-sines fixed at its ends, sum_k a_k sin(k pi tau), |a_k| <= CELL_AMP x length / k^2,
# and at most CELL_AMP_WIDTH of a part's width overall.
CELL_AMP = 0.08
CELL_AMP_WIDTH = 0.08
CELL_TERMS = 3
# Border statistics (D856): a border within this many metres of a river run used by a cut
# follows the river; within STAT_PIECE_M of a building piece's edge it follows that line.
STAT_RIVER_M = 1500.0
STAT_PIECE_M = 300.0
STAT_STEP_M = 1000.0

_RIVERS = None


def _rng(seed: str) -> np.random.Generator:
    h = hashlib.sha256(seed.encode("utf-8")).digest()
    return np.random.Generator(np.random.PCG64(int.from_bytes(h[:16], "little")))


def rivers_ll(sources: dict):
    """The river and lake centerlines kept for cuts (scalerank, class), in degrees, cached."""
    global _RIVERS
    if _RIVERS is None:
        r = gpd.read_file(config.ne_path(RIVER_FILE, sources), columns=["scalerank", "featurecla", "ne_id"])
        r = r[(r.scalerank <= RIVER_MAX_SCALERANK) & r.featurecla.isin(RIVER_CLASSES)]
        r = r.sort_values("ne_id").reset_index(drop=True)
        _RIVERS = r
    return _RIVERS


def rivers_in(frame, g, sources: dict) -> list[LineString]:
    """The kept rivers within a degree of province shape g, merged into lines in the frame,
    simplified, in a fixed order."""
    r = rivers_ll(sources)
    x0, y0, x1, y1 = g.bounds
    idx = sorted(r.sindex.query(box(x0 - 1.0, y0 - 1.0, x1 + 1.0, y1 + 1.0), predicate="intersects"))
    if not idx:
        return []
    lines = []
    for i in idx:
        geom = r.geometry.iloc[i]
        if geom is None or geom.is_empty:
            continue
        fr = frame.to_frame(geom)
        lines.extend(_lines(fr))
    if not lines:
        return []
    merged = shapely.line_merge(shapely.union_all(lines))
    out = []
    for ln in _lines(merged):
        ln = shapely.simplify(ln, RIVER_SIMPLIFY_M)
        if ln.length > 0:
            out.append(ln)
    out.sort(key=lambda ln: (-round(ln.length, 3), tuple(np.round(ln.coords[0], 3))))
    return out


def _lines(g) -> list[LineString]:
    if g is None or g.is_empty:
        return []
    if g.geom_type == "LineString":
        return [g]
    out = []
    for p in getattr(g, "geoms", []):
        out.extend(_lines(p))
    return out


# ---------------------------------------------------------------------------------------------
# meanders


class Meander:
    """A deterministic offset along the cut: sum of three sines (D852)."""

    def __init__(self, seed: str, width: float, scale: float = 1.0):
        rng = _rng(seed)
        self.terms = []
        for wave, weight in zip(MEANDER_WAVES, MEANDER_WEIGHTS):
            amp = MEANDER_AMP * scale * width * weight * float(rng.uniform(0.6, 1.0))
            lam = width * wave * float(rng.uniform(0.85, 1.15))
            phase = float(rng.uniform(0.0, 2.0 * math.pi))
            self.terms.append((amp, 2.0 * math.pi / lam, phase))
        self.peak = sum(a for a, _, _ in self.terms)

    def __call__(self, v: np.ndarray) -> np.ndarray:
        out = np.zeros_like(v)
        for amp, k, phase in self.terms:
            out += amp * np.sin(k * v + phase)
        return out


ZERO = None  # a straight cut: no meander


def _offset(m, v):
    return np.zeros_like(v) if m is None else m(v)


def samples(v0: float, v1: float, width: float) -> np.ndarray:
    step = min(CURVE_STEP_M, width / CURVE_SAMPLES)
    k = max(2, math.ceil((v1 - v0) / step) + 1)
    return np.linspace(v0, v1, k)


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


# ---------------------------------------------------------------------------------------------
# curves in (s, v): s along the group's long axis u, v across it


class Curve:
    """A cut: a polyline in (s, v) from below the group's v range to above it. `sv(t)` is the
    polyline at balancing offset t; `run` is the river part (fixed), or None."""

    def __init__(self, kind: str, u, vlo: float, vhi: float, width: float, meander=None, run=None):
        self.kind = kind  # "meander", "straight" or "river"
        self.u = u
        self.vlo, self.vhi = vlo, vhi
        self.width = width
        self.meander = meander
        self.run = run  # (k, 2) array of (s, v), v increasing at its ends, or None
        if run is None:
            self.v = samples(vlo, vhi, width)
            self.off = _offset(meander, self.v)
        else:
            va, vb = float(run[0, 1]), float(run[-1, 1])
            lr = RAMP_LEN * width
            self.v_lo = samples(vlo, va, width)[:-1] if va > vlo else np.zeros(0)
            self.v_hi = samples(vb, vhi, width)[1:] if vhi > vb else np.zeros(0)
            # the ramps: 0 at the river's end, 1 a ramp length away
            self.h_lo = smoothstep((va - self.v_lo) / lr)
            self.h_hi = smoothstep((self.v_hi - vb) / lr)
            # meanders fade in over half a ramp
            self.m_lo = _offset(meander, self.v_lo) * smoothstep((va - self.v_lo) / (0.5 * lr))
            self.m_hi = _offset(meander, self.v_hi) * smoothstep((self.v_hi - vb) / (0.5 * lr))

    def sv(self, t: float) -> np.ndarray:
        if self.run is None:
            return np.column_stack([t + self.off, self.v])
        sa, sb = float(self.run[0, 0]), float(self.run[-1, 0])
        lo = np.column_stack([sa + (t - sa) * self.h_lo + self.m_lo, self.v_lo])
        hi = np.column_stack([sb + (t - sb) * self.h_hi + self.m_hi, self.v_hi])
        return np.concatenate([lo, self.run, hi])

    def srange(self, t: float) -> tuple[float, float]:
        s = self.sv(t)[:, 0]
        return float(s.min()), float(s.max())

    def t_range(self) -> tuple[float, float]:
        """The offsets whose ramps stay within RAMP_SLOPE (empty when the river's ends are too
        far apart across the axis)."""
        reach = RAMP_SLOPE * RAMP_LEN * self.width / 1.5
        sa, sb = float(self.run[0, 0]), float(self.run[-1, 0])
        lo, hi = max(sa, sb) - reach, min(sa, sb) + reach
        return (lo, hi) if lo <= hi else (0.5 * (sa + sb), 0.5 * (sa + sb))

    def ramp_slope(self, t: float) -> float:
        """The steepest slope of the ramps' offset (across per along; smoothstep's steepest
        slope is 1.5 over its length), 0 without a river. Ramps that never reach land count too."""
        if self.run is None:
            return 0.0
        lr = RAMP_LEN * self.width
        sa, sb = float(self.run[0, 0]), float(self.run[-1, 0])
        return 1.5 * max(abs(t - sa), abs(t - sb)) / lr


def to_xy(sv: np.ndarray, u) -> np.ndarray:
    ux, uy = u
    vx, vy = -uy, ux
    return np.column_stack([sv[:, 0] * ux + sv[:, 1] * vx, sv[:, 0] * uy + sv[:, 1] * vy])


def to_sv(xy: np.ndarray, u) -> np.ndarray:
    ux, uy = u
    vx, vy = -uy, ux
    return np.column_stack([xy[:, 0] * ux + xy[:, 1] * uy, xy[:, 0] * vx + xy[:, 1] * vy])


def lowside(curve: Curve, t: float, s_floor: float):
    """The frame polygon on the low-s side of the curve at offset t (closed at s_floor)."""
    sv = curve.sv(t)
    s_floor = min(s_floor, float(sv[:, 0].min()) - 1000.0)
    ring = np.concatenate([sv, [[s_floor, sv[-1, 1]], [s_floor, sv[0, 1]]]])
    return Polygon(to_xy(ring, curve.u))


def line_xy(curve: Curve, t: float) -> LineString:
    return LineString(to_xy(curve.sv(t), curve.u))


# ---------------------------------------------------------------------------------------------
# river runs


def river_runs(rivers: list, inner, u, t_star: float, width: float) -> list[np.ndarray]:
    """Stretches of the rivers inside `inner` (the group's outline pulled in), near the straight
    cut at t_star and crossing the long axis, as (s, v) arrays with v increasing end to end,
    longest first."""
    if inner is None or inner.is_empty:
        return []
    near = RIVER_NEAR * width
    out = []
    shapely.prepare(inner)
    for ln in rivers:
        if not inner.intersects(ln):
            continue
        for seg in _lines(ln.intersection(inner)):
            sv = to_sv(np.asarray(seg.coords), u)
            ok = np.abs(sv[:, 0] - t_star) <= near
            i = 0
            while i < len(sv):
                if not ok[i]:
                    i += 1
                    continue
                j = i
                while j + 1 < len(sv) and ok[j + 1]:
                    j += 1
                run = sv[i:j + 1]
                i = j + 1
                if len(run) < 2:
                    continue
                d = np.hypot(np.diff(run[:, 0]), np.diff(run[:, 1]))
                length = float(d.sum())
                progress = abs(float(run[-1, 1] - run[0, 1]))
                if length < RIVER_MIN_RUN * width or progress < RIVER_PROGRESS * length:
                    continue
                if run[-1, 1] < run[0, 1]:
                    run = run[::-1].copy()
                out.append((length, run))
    out.sort(key=lambda t: (-round(t[0], 3), round(float(t[1][0, 0]), 3), round(float(t[1][0, 1]), 3)))
    return [r for _, r in out[:RIVER_TRIES]]


def windows(run: np.ndarray, width: float) -> list[np.ndarray]:
    """The run, then its stretches of RIVER_WINDOWS of its length (from its start, middle and
    end), each at least RIVER_MIN_RUN of a part's width long."""
    out = [run]
    d = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(run[:, 0]), np.diff(run[:, 1])))])
    total = float(d[-1])
    for share in RIVER_WINDOWS:
        span = share * total
        if span < RIVER_MIN_RUN * width:
            continue
        for start in (0.0, 0.5 * (total - span), total - span):
            k = (d >= start - 1e-6) & (d <= start + span + 1e-6)
            if k.sum() >= 2:
                out.append(run[k])
    return out


# ---------------------------------------------------------------------------------------------
# town-catchment edges


def bend_edge(a, b, width: float) -> list:
    """Points strictly between a and b on the bent edge from a to b (D853); the same edge seen
    from b to a gives the same points reversed."""
    ka, kb = (round(a[0], 3), round(a[1], 3)), (round(b[0], 3), round(b[1], 3))
    rev = kb < ka
    p, q = (kb, ka) if rev else (ka, kb)
    dx, dy = q[0] - p[0], q[1] - p[1]
    length = math.hypot(dx, dy)
    if length <= 0:
        return []
    rng = _rng(f"cell:{p[0]:.3f},{p[1]:.3f}:{q[0]:.3f},{q[1]:.3f}")
    amp = min(CELL_AMP * length, CELL_AMP_WIDTH * width)
    coef = [float(rng.uniform(-1.0, 1.0)) * amp / (k * k) for k in range(1, CELL_TERMS + 1)]
    k_n = max(2, math.ceil(length / min(CURVE_STEP_M, width / CURVE_SAMPLES)))
    tau = np.linspace(0.0, 1.0, k_n + 1)[1:-1]
    off = sum(c * np.sin((k + 1) * math.pi * tau) for k, c in enumerate(coef))
    nx, ny = -dy / length, dx / length
    pts = [(p[0] + dx * s + nx * o, p[1] + dy * s + ny * o) for s, o in zip(tau, off)]
    return pts[::-1] if rev else pts


def bend_cell(cell: Polygon, width: float, frozen: set, bbox) -> Polygon:
    """A Voronoi cell with every edge between two towns bent (edges on the diagram's bounding box
    and edges in `frozen` stay straight)."""
    x0, y0, x1, y1 = bbox
    c = [(round(x, 3), round(y, 3)) for x, y in np.asarray(cell.exterior.coords)[:-1]]

    def on_box(p):
        return min(abs(p[0] - x0), abs(p[0] - x1), abs(p[1] - y0), abs(p[1] - y1)) < 1.0

    ring = []
    for i, a in enumerate(c):
        b = c[(i + 1) % len(c)]
        ring.append(a)
        key = (min(a, b), max(a, b))
        if (on_box(a) and on_box(b)) or key in frozen:
            continue
        ring.extend(bend_edge(a, b, width))
    return Polygon(ring)


def edge_keys(cell: Polygon) -> list:
    c = [(round(x, 3), round(y, 3)) for x, y in np.asarray(cell.exterior.coords)[:-1]]
    return [(min(c[i], c[(i + 1) % len(c)]), max(c[i], c[(i + 1) % len(c)])) for i in range(len(c))]


def bend_cells(cells: list, pts: list, width: float, bbox) -> list:
    """Bent Voronoi cells (cells[i] holds town pts[i]); an edge that makes a cell invalid (two bent
    edges crossing near a sharp corner) or passes within PROTECT_M of the cell's town is left
    straight in both its cells. Four rounds of that; if a cell is still bad after the fourth, every
    cell of the giant is left straight (the unbent Voronoi cells are returned)."""
    frozen: set = set()
    for _ in range(4):
        out = [bend_cell(c, width, frozen, bbox) for c in cells]
        bad = [i for i, c in enumerate(out) if not c.is_valid or (
            cells[i].contains(shapely.Point(pts[i]).buffer(PROTECT_M))
            and not c.contains(shapely.Point(pts[i]).buffer(PROTECT_M)))]
        if not bad:
            return out
        for i in bad:
            frozen.update(edge_keys(cells[i]))
    return cells


# ---------------------------------------------------------------------------------------------
# border statistics (D856)


def border_stats(frame, parts_ll: list, piece_lines_fr, runs_fr: list, straight_fr: list) -> dict:
    """Length (km) of the borders between sibling parts by what they follow: `river` (a river
    or lake centerline a cut used), `pieces` (a building piece's edge: a licensed ADM2 line or a
    town-catchment edge), `straight` (a straight cut) or `meander` (a meandering cut). Measured
    on the shared edges cut into STAT_STEP_M pieces, each classed by its midpoint."""
    out = {"river": 0.0, "pieces": 0.0, "straight": 0.0, "meander": 0.0}
    fr = [shapely.make_valid(frame.to_frame(p)) for p in parts_ll]
    refs = [("river", shapely.union_all(runs_fr) if runs_fr else None, STAT_RIVER_M),
            ("pieces", piece_lines_fr, STAT_PIECE_M),
            ("straight", shapely.union_all(straight_fr) if straight_fr else None, STAT_PIECE_M)]
    tree = shapely.STRtree(fr)
    for i in range(len(fr)):
        for j in sorted(tree.query(fr[i], predicate="intersects")):
            if j <= i:
                continue
            for ln in _lines(shapely.intersection(fr[i].boundary, fr[j].boundary)):
                ln = shapely.segmentize(ln, STAT_STEP_M)
                c = np.asarray(ln.coords)
                if len(c) < 2:
                    continue
                seg = np.hypot(*np.diff(c, axis=0).T)
                mids = shapely.points(0.5 * (c[1:] + c[:-1]))
                left = np.ones(len(seg), dtype=bool)
                for name, ref, tol in refs:
                    if ref is None or not left.any():
                        continue
                    hit = left & (shapely.distance(mids, ref) <= tol)
                    out[name] += float(seg[hit].sum())
                    left &= ~hit
                out["meander"] += float(seg[left].sum())
    return {k: round(v / 1000.0, 1) for k, v in out.items()}
