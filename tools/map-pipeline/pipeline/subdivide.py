"""Giant provinces cut into parts no larger than Eastern Iowa (Logan, 2026-10-23; D820 to D829).

A giant is a province over `GIANT_KM2` that is not Arctic (`is_arctic`: most of its area north
of the Arctic Circle, or any land south of 60 S). Each is cut into `n` parts by recursive
bisection: the land is first broken into building pieces (the country's licensed geoBoundaries
ADM2 units clipped to the province, else the Voronoi cells of its Natural Earth towns, else its
own polygon parts); then, in a Lambert azimuthal equal-area frame centred on the province, each
bisection draws a straight line across the group's long axis that puts n // 2 parts' worth of
area on its low side. A piece the line crosses goes whole to the side holding most of it while
the running imbalance stays within `whole_tol` of a part (the smallest such pieces first), else
it is cut on the line. So the parts follow ADM2 lines (or town catchments) where they can and
are straight elsewhere. A part's detached pieces then join the sibling they touch when that
keeps the sibling under the cap.

Organic borders (Logan, 2026-10-24; D850 to D856): the shapes step cuts each giant with the
same pieces, part count, tolerance and bisection axes, but each line is a curve
(`_bisect_organic`): a river or lake centerline near the balanced line where one crosses the
group and the sizes allow (its ends ramp back to the balancing offset), else a deterministic
meander, else the straight line; town-catchment edges bend too. Every curve must keep the id
points one to a part and the sites and city probe points with their parts; a giant whose
organic parts do not fit (`_misfit`) tries the next of STYLES and seed, then the straight cut.
`pipeline/organic.py` holds the curves.

`run.py giants` measures every province, picks the giants and writes, per giant, a
`[subdivide."<id>"]` table in its region's hints file: `parts`, `whole_tol`, `blocks`, the
main point (the original's main city, which keeps the original id) and one point per new
province. The shapes step (P4) rebuilds the cut from those numbers on the province's shape, so a
rerun gives the same parts, and maps each part to the id whose point it holds.

Areas are geodesic (WGS84) of the shape with its edges straight in longitude and latitude
(segmentized to `SEGMENT_DEG` first), the way mapgen draws them.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import geopandas as gpd
import numpy as np
import shapely
from pyproj import Geod, Transformer
from shapely import affinity
from shapely.geometry import LineString, MultiPoint, Point, Polygon, box
from shapely.geometry.polygon import orient

from . import config, crosswalk, organic

# The cap: Eastern Iowa's area, km2 (Logan: "the max province size is the Eastern Iowa
# province"). `run.py giants` measures US-0053's final shape and stops if this differs.
CAP_PROVINCE = "US-0053"
CAP_KM2 = 51_722.0
# Phase 1 (Logan): only provinces over this many km2 are cut.
GIANT_KM2 = 250_000.0
# Arctic: more than ARCTIC_SHARE of the area north of ARCTIC_LAT, or any part south of
# ANTARCTIC_LAT (none is on the map, which ends at 57.78 S, D600). Arctic giants are not cut.
ARCTIC_LAT = 66.5
ANTARCTIC_LAT = -60.0
ARCTIC_SHARE = 0.5
# Parts: n = ceil(area / (SLACK x cap)), the fewest that keep every part under the cap with a
# little room so the cut need not chase every square kilometre (D821); a raw part must be at
# most PART_MAX of the cap (simplify then moves a part's area by far less than 1%).
SLACK = 0.95
PART_MAX = 0.99
# Whole-piece tolerances tried in order (share of a mean part), then up to EXTRA_PARTS more parts.
WHOLE_TOLS = (0.06, 0.04, 0.02, 0.0)
EXTRA_PARTS = 3
# Edges are segmentized to this many degrees before areas and projection.
SEGMENT_DEG = 0.01
# Cut lines are segmentized to this many metres in the frame before going back to degrees.
FRAME_STEP_M = 5000.0
# Margin (metres) round a piece when drawing its cut half-plane.
CUT_MARGIN_M = 20_000.0
# The cut line is searched on a copy of each piece simplified to this many metres (lake shores
# carry tens of thousands of vertices); the cut itself is made on the full shape.
SEARCH_SIMPLIFY_M = 1000.0
# Bisection steps of the cut-line search (the line lands within a millionth of the span).
SEARCH_STEPS = 32
# Leftover slivers under this many square degrees are dropped (float dust, as shapes.DUST_AREA).
DUST_DEG2 = 1e-9

_GEOD = Geod(ellps="WGS84")


def polys(g) -> list[Polygon]:
    """The polygons of a geometry (intersections can leave lines and points)."""
    if g is None or g.is_empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    out = []
    for p in getattr(g, "geoms", []):
        out.extend(polys(p))
    return out


def as_poly(g):
    ps = polys(g)
    if not ps:
        return Polygon()
    return ps[0] if len(ps) == 1 else shapely.MultiPolygon(ps)


def area_km2(g) -> float:
    """Geodesic area of a lon/lat shape with straight edges in degrees."""
    total = 0.0
    for p in polys(shapely.segmentize(g, SEGMENT_DEG)):
        p = orient(p, 1.0)
        a = _GEOD.polygon_area_perimeter(*p.exterior.xy)[0]
        for ring in p.interiors:
            a += _GEOD.polygon_area_perimeter(*ring.xy)[0]
        total += a
    return abs(total) / 1e6


def arctic_share(g) -> float:
    a = area_km2(g)
    if a <= 0:
        return 0.0
    north = g.intersection(box(-180.0, ARCTIC_LAT, 180.0, 90.0))
    return area_km2(north) / a if not north.is_empty else 0.0


def is_arctic(g) -> bool:
    return g.bounds[1] < ANTARCTIC_LAT or arctic_share(g) > ARCTIC_SHARE


def parts_for(area: float) -> int:
    return max(2, math.ceil(area / (SLACK * CAP_KM2)))


class Frame:
    """Lambert azimuthal equal-area, centred on a province (metres)."""

    def __init__(self, g):
        c = g.representative_point()
        self.lon0, self.lat0 = round(c.x, 4), round(c.y, 4)
        crs = f"+proj=laea +lat_0={self.lat0} +lon_0={self.lon0} +ellps=WGS84 +units=m +no_defs"
        self.fwd = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
        self.inv = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)

    def to_frame(self, g):
        def f(xy):
            x, y = self.fwd.transform(xy[:, 0], xy[:, 1])
            return np.column_stack([x, y])
        return shapely.transform(shapely.segmentize(g, SEGMENT_DEG), f)

    def to_lonlat(self, g):
        """A frame polygon back in degrees, longitudes unwrapped round the frame's centre and then
        cut at the antimeridian (Chukotka spans it)."""
        lon0 = self.lon0

        def f(xy):
            lon, lat = self.inv.transform(xy[:, 0], xy[:, 1])
            lon = lon0 + ((np.asarray(lon) - lon0 + 180.0) % 360.0) - 180.0
            return np.column_stack([lon, lat])
        u = shapely.make_valid(shapely.transform(shapely.segmentize(g, FRAME_STEP_M), f))
        x0, _, x1, _ = u.bounds
        if x0 >= -180.0 and x1 <= 180.0:
            return u
        out = []
        for k in (-1, 0, 1):
            piece = u.intersection(box(-180.0 + 360.0 * k, -90.0, 180.0 + 360.0 * k, 90.0))
            if not piece.is_empty:
                out.append(affinity.translate(piece, xoff=-360.0 * k))
        return shapely.union_all(out)


@dataclass
class Piece:
    ll: object  # lon/lat geometry
    fr: object  # the same in the frame
    area: float  # km2 (frame area)
    fs: object = None  # the frame copy simplified to SEARCH_SIMPLIFY_M, for the cut-line search


def _piece(frame: Frame, ll) -> Piece:
    # the projected copy can self-touch where the degree shape nearly does (GEOS side conflicts)
    fr = as_poly(shapely.make_valid(frame.to_frame(ll)))
    fs = as_poly(shapely.make_valid(shapely.simplify(fr, SEARCH_SIMPLIFY_M)))
    shapely.prepare(fs)
    return Piece(ll, fr, fr.area / 1e6, fs)


# ---------------------------------------------------------------------------------------------
# building pieces

_BLOCKS: dict[str, tuple] = {}
_PLACES = None


def country_blocks(country: str, sources: dict):
    """The country's ADM2 blocks when their license passes (crosswalk.load_blocks), cached."""
    if country not in _BLOCKS:
        g, meta, why = crosswalk.load_blocks(country, sources, "admin2")
        _BLOCKS[country] = (g, meta, why)
    return _BLOCKS[country]


def places(sources: dict):
    """Natural Earth populated places: NAMEASCII, NAME, ADM0_A3, POP_MAX, geometry."""
    global _PLACES
    if _PLACES is None:
        _PLACES = gpd.read_file(config.ne_path("ne_10m_populated_places.shp", sources),
                                columns=["NAME", "NAMEASCII", "ADM0_A3", "POP_MAX", "FEATURECLA"])
    return _PLACES


def towns_in(g, country: str, sources: dict) -> list[tuple]:
    """(pop, lon, lat, name) of the country's Natural Earth places inside g, most populous first."""
    pp = places(sources)
    pp = pp[pp.ADM0_A3.isin(config.ne_codes(country))]
    out = []
    for r in pp.itertuples():
        if g.covers(r.geometry):
            name = r.NAMEASCII if isinstance(r.NAMEASCII, str) and r.NAMEASCII.strip() else r.NAME
            out.append((float(r.POP_MAX or 0), r.geometry.x, r.geometry.y, name))
    out.sort(key=lambda t: (-t[0], t[1], t[2], t[3]))
    return out


def _shared(a, b) -> float:
    """Length of a's boundary on b (pieces share exact edges: they come from the same overlays);
    b is clipped to a's box first, since b can be a coastline of a million vertices."""
    x0, y0, x1, y1 = a.bounds
    try:
        near = shapely.clip_by_rect(b, x0 - 1e-6, y0 - 1e-6, x1 + 1e-6, y1 + 1e-6)
    except shapely.errors.GEOSException:  # a degenerate ring in the clip: measure on all of b
        near = b
    if near.is_empty:
        return 0.0
    return a.boundary.intersection(near).length


def _disjoint(cands: list, g) -> list:
    """Candidate pieces made disjoint (each loses what earlier ones hold) and covering g: leftover
    seams go to the piece they share the longest edge with, other leftovers are pieces too."""
    out = []
    for c in cands:
        c = as_poly(shapely.make_valid(c))
        if out and not c.is_empty:
            tree = shapely.STRtree(out)
            near = [out[i] for i in sorted(tree.query(c)) if out[i].intersects(c)]
            if near:
                c = as_poly(c.difference(shapely.union_all(near)))
        if not c.is_empty and c.area > DUST_DEG2:
            out.append(c)
    rest = as_poly(g.difference(shapely.union_all(out))) if out else as_poly(g)
    extra: dict[int, list] = {}
    new = []
    tree = shapely.STRtree(out) if out else None
    for part in polys(rest):
        if part.area < DUST_DEG2:
            continue
        best, best_len = None, 0.0
        if tree is not None:
            for i in sorted(tree.query(part.buffer(1e-6))):
                s = _shared(part, out[i])
                if s > best_len:
                    best, best_len = i, s
        if best is None:
            new.append(part)
        else:
            extra.setdefault(best, []).append(part)
    for i, parts in extra.items():
        out[i] = as_poly(shapely.union_all([out[i], *parts]))
    return out + new


def build_pieces(g, country: str, sources: dict, frame: Frame, bend_width: float | None = None) -> tuple[str, list]:
    """The building pieces of province shape g: (`admin2` | `towns` | `parts`, pieces in degrees).
    With `bend_width` (a part's width, metres) the town cells' shared edges bend (D853)."""
    blocks, _, _ = country_blocks(country, sources)
    if blocks is not None:
        idx = sorted(blocks.sindex.query(g, predicate="intersects"))
        units = sorted(((blocks.shapeID.iloc[i], blocks.geometry.iloc[i]) for i in idx), key=lambda t: t[0])
        cands = [as_poly(shapely.make_valid(u).intersection(g)) for _, u in units]
        return "admin2", _disjoint([c for c in cands if not c.is_empty], g)
    towns = towns_in(g, country, sources)
    pts = sorted({(round(x, 6), round(y, 6)) for _, x, y, _ in towns})
    if len(pts) >= 2:
        fpts = [frame.fwd.transform(x, y) for x, y in pts]
        env = frame.to_frame(g).envelope.buffer(100_000.0)
        cells = shapely.voronoi_polygons(MultiPoint(fpts), extend_to=env)
        by_pt = []
        for cell in cells.geoms:
            i = next(i for i, p in enumerate(fpts) if cell.covers(Point(p)))
            by_pt.append((i, cell))
        by_pt.sort(key=lambda t: t[0])
        if bend_width:
            bent = organic.bend_cells([c for _, c in by_pt], [fpts[i] for i, _ in by_pt], bend_width, cells.bounds)
            by_pt = [(i, c) for (i, _), c in zip(by_pt, bent)]
        cands = [as_poly(g.intersection(frame.to_lonlat(cell.intersection(env)))) for _, cell in by_pt]
        return "towns", _disjoint([c for c in cands if not c.is_empty], g)
    return "parts", _disjoint(polys(g), g)


# ---------------------------------------------------------------------------------------------
# recursive bisection


def _axis(pieces: list[Piece]) -> tuple[float, float]:
    """The long axis of the group's minimum rotated rectangle, as a unit vector with x > 0 (or
    y > 0 when vertical)."""
    coords = np.concatenate([shapely.get_coordinates(p.fr) for p in pieces])
    rect = shapely.minimum_rotated_rectangle(MultiPoint(coords))
    if rect.geom_type != "Polygon":
        return (1.0, 0.0)
    c = np.asarray(rect.exterior.coords)
    e0, e1 = c[1] - c[0], c[2] - c[1]
    e = e0 if np.hypot(*e0) >= np.hypot(*e1) else e1
    n = float(np.hypot(*e))
    if n == 0:
        return (1.0, 0.0)
    ux, uy = float(e[0] / n), float(e[1] / n)
    if ux < -1e-12 or (abs(ux) <= 1e-12 and uy < 0):
        ux, uy = -ux, -uy
    return (ux, uy)


def _halfplane(fr, u, t: float):
    """The frame polygon {p : p . u <= t} over the piece `fr`'s extent (with a margin)."""
    ux, uy = u
    vx, vy = -uy, ux
    c = shapely.get_coordinates(fr)
    s = c[:, 0] * ux + c[:, 1] * uy
    v = c[:, 0] * vx + c[:, 1] * vy
    s0 = float(s.min()) - CUT_MARGIN_M
    v0, v1 = float(v.min()) - CUT_MARGIN_M, float(v.max()) + CUT_MARGIN_M
    if t <= s0:
        return Polygon()
    pts = [(s0, v0), (t, v0), (t, v1), (s0, v1)]
    return Polygon([(a * ux + b * vx, a * uy + b * vy) for a, b in pts])


def _srange(fr, u) -> tuple[float, float]:
    c = shapely.get_coordinates(fr)
    s = c[:, 0] * u[0] + c[:, 1] * u[1]
    return float(s.min()), float(s.max())


def _left_area(p: Piece, rng, u, t: float) -> float:
    """km2 of the piece on the side p . u <= t (on the search copy, scaled to the full area)."""
    lo, hi = rng
    if hi <= t:
        return p.area
    if lo >= t:
        return 0.0
    full = p.fs.area
    if full <= 0:
        return 0.0
    return p.fs.intersection(_halfplane(p.fr, u, t)).area / full * p.area


def _bisect(frame: Frame, pieces: list[Piece], n: int, tol: float, axes: dict | None = None,
            path: str = "r") -> list[list[Piece]]:
    """Split the group into n parts: a line across the long axis puts n // 2 parts' worth of area
    on its low side; a piece the line crosses goes whole to the side holding most of it when the
    running imbalance stays within `tol` of a part (smallest such pieces first), else is cut."""
    if n == 1:
        return [pieces]
    n1 = n // 2
    total = sum(p.area for p in pieces)
    part = total / n
    target = total * n1 / n
    u = _axis(pieces)
    if axes is not None:  # the organic cut reuses each bisection's axis (D854)
        axes[path] = u
    rngs = [_srange(p.fr, u) for p in pieces]
    lo = min(r[0] for r in rngs)
    hi = max(r[1] for r in rngs)
    for _ in range(SEARCH_STEPS):
        mid = 0.5 * (lo + hi)
        if sum(_left_area(p, r, u, mid) for p, r in zip(pieces, rngs)) < target:
            lo = mid
        else:
            hi = mid
    t = 0.5 * (lo + hi)
    left, right, cross = [], [], []
    for i, (p, r) in enumerate(zip(pieces, rngs)):
        if r[1] <= t:
            left.append((i, p))
        elif r[0] >= t:
            right.append((i, p))
        else:
            a = _left_area(p, r, u, t)
            cross.append((min(a, p.area - a), i, p, a))
    imb = 0.0  # left area minus target with every crossing piece cut
    cut_list = []
    for m, i, p, a in sorted(cross, key=lambda c: (c[0], c[1])):
        d = (p.area - a) if a >= p.area - a else -a
        if abs(imb + d) <= tol * part:
            imb += d
            (left if d >= 0 else right).append((i, p))
        else:
            cut_list.append((i, p))
    for i, p in cut_list:
        h = frame.to_lonlat(_halfplane(p.fr, u, t))
        a = as_poly(p.ll.intersection(h))
        b = as_poly(p.ll.difference(h))
        if not a.is_empty and a.area > DUST_DEG2:
            left.append((i, _piece(frame, a)))
        if not b.is_empty and b.area > DUST_DEG2:
            right.append((i, _piece(frame, b)))
    left.sort(key=lambda t: t[0])
    right.sort(key=lambda t: t[0])
    lp, rp = [p for _, p in left], [p for _, p in right]
    if not lp or not rp:
        raise SystemExit("subdivide: a bisection left one side empty")
    return _bisect(frame, lp, n1, tol, axes, path + "0") + _bisect(frame, rp, n - n1, tol, axes, path + "1")


# ---------------------------------------------------------------------------------------------
# organic bisection (D850 to D856)


@dataclass(frozen=True)
class Style:
    """How organic a cut may be: river cuts (with `nat_tol` of a part's imbalance allowed when the
    river crosses the whole group), meanders, bent town-catchment edges."""

    rivers: bool
    meander: bool
    bend: bool
    nat_tol: float = 0.0
    name: str = ""
    amp: float = 1.0  # meander amplitude, times MEANDER_AMP


# Tried in order; the first whose parts fit (`_misfit`) is kept, else the straight cut (D854).
STYLES = (
    Style(True, True, True, 0.03, "rivers, meanders, bent town edges"),
    Style(True, True, True, 0.0, "balanced rivers, meanders, bent town edges"),
    Style(False, True, True, 0.0, "meanders, bent town edges"),
    Style(False, True, False, 0.0, "meanders"),
    Style(False, True, False, 0.0, "gentle meanders", 0.5),
)
# Seed salts tried per style: another draw of the meanders often misses a lake shore pocket.
SALTS = ("", ":2", ":3")
# Balance of a meander or a ramped river cut (share of a part; the bisection lands far closer).
BALANCE_TOL = 0.002
# A curve may move off balance by this share of a part to keep a protected point on its side.
SHIFT_TOL = 0.03
# Bits of a cut piece under this many km2 are not counted as fragments (simplify removes them).
FRAG_KM2 = 5.0
# No part below this share of the cap (Logan: "no part below about 25% of it").
PART_MIN = 0.25


@dataclass
class Ctx:
    frame: Frame
    style: Style
    seed: str
    rivers: list
    protect: list  # frame points that must keep their side
    axes: dict  # the straight cut's axis at each bisection path
    partner: list  # each protected point's id point (index in protect): the id point of the
    # straight cut's part holding it (an id point is its own partner), or None
    runs: list  # river runs used, frame LineStrings
    straight: list  # straight cuts used, frame LineStrings
    kinds: list  # the kind of every cut, in order


def _vrange(fr, u) -> tuple[float, float]:
    c = shapely.get_coordinates(fr)
    v = -c[:, 0] * u[1] + c[:, 1] * u[0]
    return float(v.min()), float(v.max())


def _area_left(pieces, rngs, curve, t: float, s_floor: float) -> float:
    smin, smax = curve.srange(t)
    poly = None
    total = 0.0
    for p, r in zip(pieces, rngs):
        if r[1] <= smin:
            total += p.area
        elif r[0] < smax and p.fs.area > 0:
            if poly is None:
                poly = organic.lowside(curve, t, s_floor)
            total += p.fs.intersection(poly).area / p.fs.area * p.area
    return total


def _solve(pieces, rngs, curve, target: float, a: float, b: float, s_floor: float) -> float:
    for _ in range(SEARCH_STEPS):
        mid = 0.5 * (a + b)
        if _area_left(pieces, rngs, curve, mid, s_floor) < target:
            a = mid
        else:
            b = mid
    return 0.5 * (a + b)


def _decide(pieces, rngs, curve, t: float, tol: float, part: float, s_floor: float):
    """Which pieces go whole to each side of the curve and which are cut (as `_bisect`)."""
    smin, smax = curve.srange(t)
    poly = organic.lowside(curve, t, s_floor)
    left, right, cross = [], [], []
    for i, (p, r) in enumerate(zip(pieces, rngs)):
        if r[1] <= smin:
            left.append(i)
            continue
        if r[0] >= smax or p.fs.area <= 0:
            right.append(i)
            continue
        a = p.fs.intersection(poly).area / p.fs.area * p.area
        if a <= 1e-9 * p.area:
            right.append(i)
        elif a >= (1.0 - 1e-9) * p.area:
            left.append(i)
        else:
            cross.append((min(a, p.area - a), i, p, a))
    imb = 0.0
    cut_list = []
    for m, i, p, a in sorted(cross, key=lambda c: (c[0], c[1])):
        d = (p.area - a) if a >= p.area - a else -a
        if abs(imb + d) <= tol * part:
            imb += d
            (left if d >= 0 else right).append(i)
        else:
            cut_list.append(i)
    return set(left), set(right), cut_list, poly


def _sides(owners, decision, pts, line=None) -> list | None:
    """The side (L or R) of each protected point under a decision; None when a point in a cut
    piece lies within PROTECT_M of the curve `line`."""
    left, right, _, poly = decision
    out = []
    for pt, i in zip(pts, owners):
        if i is None:
            out.append(None)
        elif i in left:
            out.append("L")
        elif i in right:
            out.append("R")
        else:
            if line is not None and line.distance(pt) < organic.PROTECT_M:
                return None
            out.append("L" if poly.covers(pt) else "R")
    return out


WHY: dict = {}  # why candidate curves were passed over, by reason (diagnostics only)


def _why(k: str) -> None:
    WHY[k] = WHY.get(k, 0) + 1


def _frags(pieces, decision) -> int:
    """Polygons (over FRAG_KM2) the decision's cut pieces fall into: a curve may not leave more
    loose bits than the straight line (D854)."""
    _, _, cut_list, poly = decision
    out = 0
    for i in cut_list:
        fr = pieces[i].fr  # the full shape: a lake shore can cut off a bit the search copy joins
        for g in (fr.intersection(poly), fr.difference(poly)):
            out += sum(1 for q in polys(g) if q.area > FRAG_KM2 * 1e6)
    return out


def _shift(curve, owners, ctx: Ctx, n1: int, u) -> float | None:
    """An offset that puts n1 of the group's id points on the low side: halfway between the
    n1-th and the next id point along the axis, net of the curve's meander."""
    w = []
    for k, (pt, i) in enumerate(zip(ctx.protect, owners)):
        if i is None or ctx.partner[k] != k:
            continue
        s, v = organic.to_sv(np.array([[pt.x, pt.y]]), u)[0]
        w.append(float(s - organic._offset(curve.meander, np.array([v]))[0]))
    if len(w) <= n1:
        return None
    w.sort()
    return 0.5 * (w[n1 - 1] + w[n1])


def _keeps(sides, ctx: Ctx, n1: int, n: int) -> bool:
    """D854: a cut keeps the protected points when n1 of the group's id points go to the low side
    and n - n1 to the high side (so every part ends with one), and every other point goes where
    its id point goes."""
    if sides is None:
        return False
    nl = nr = 0
    for k, s in enumerate(sides):
        if s is None:
            continue
        pk = ctx.partner[k]
        if pk == k:
            nl += s == "L"
            nr += s == "R"
        elif pk is not None and sides[pk] is not None and sides[pk] != s:
            return False
    return nl <= n1 and nr <= n - n1


def _bisect_organic(ctx: Ctx, pieces: list[Piece], n: int, tol: float, path: str) -> list[list[Piece]]:
    """`_bisect` with a curve for the line: a river near the balanced straight line when one
    crosses the group (its ends ramp back to the balancing offset), else a meander, else the
    straight line, each shifted between the id points when it would not keep them (`_keeps`)."""
    if n == 1:
        return [pieces]
    frame = ctx.frame
    n1 = n // 2
    total = sum(p.area for p in pieces)
    part = total / n
    target = total * n1 / n
    width = math.sqrt(part) * 1000.0
    u = ctx.axes.get(path) or _axis(pieces)
    rngs = [_srange(p.fr, u) for p in pieces]
    vrs = [_vrange(p.fr, u) for p in pieces]
    lo = min(r[0] for r in rngs)
    hi = max(r[1] for r in rngs)
    vlo = min(r[0] for r in vrs) - CUT_MARGIN_M
    vhi = max(r[1] for r in vrs) + CUT_MARGIN_M
    s_floor = lo - CUT_MARGIN_M
    straight = organic.Curve("straight", u, vlo, vhi, width)
    t_star = _solve(pieces, rngs, straight, target, lo, hi, s_floor)
    base = _decide(pieces, rngs, straight, t_star, tol, part, s_floor)
    owners = []
    for pt in ctx.protect:
        owners.append(next((i for i, p in enumerate(pieces) if p.fr.covers(pt)), None))
    outline = None
    cands = []
    if ctx.style.rivers and ctx.rivers:
        outline = as_poly(shapely.union_all([p.fs for p in pieces]))
        edge = max(organic.RIVER_EDGE * width, organic.RIVER_EDGE_MIN_M)
        inner = shapely.simplify(outline, 0.25 * edge).buffer(-edge, quad_segs=2)
        for k, run in enumerate(organic.river_runs(ctx.rivers, inner, u, t_star, width)):
            m = organic.Meander(f"{ctx.seed}:{path}:river{k}", width)
            # the whole run, then stretches of it, which leave the ramps room to balance
            for sub in organic.windows(run, width):
                cands.append(organic.Curve("river", u, vlo, vhi, width, meander=m, run=sub))
    if ctx.style.meander:
        for k in range(organic.MEANDER_TRIES):
            m = organic.Meander(f"{ctx.seed}:{path}:{k}", width, ctx.style.amp)
            cands.append(organic.Curve("meander", u, vlo, vhi, width, meander=m))
    chosen = None
    loose = None  # the first curve that keeps the sides but leaves more bits
    base_frags = _frags(pieces, base) if cands else 0
    cands.append(straight)
    for curve in cands:
        if curve.kind == "river":
            # the ramps may not climb steeper than RAMP_SLOPE: the offset stays that near both
            # river ends, and the river cut takes the imbalance that leaves (up to nat_tol); a
            # river that folds back across its ramps is no cut
            r0, r1 = curve.t_range()
            if not all(organic.lowside(curve, x, s_floor).is_valid for x in (r0, 0.5 * (r0 + r1), r1)):
                _why("invalid")
                continue
            try:
                t = _solve(pieces, rngs, curve, target, r0, r1, s_floor)
            except shapely.errors.GEOSException:
                _why("invalid")
                continue
        elif curve.kind == "meander":
            peak = curve.meander.peak
            t = _solve(pieces, rngs, curve, target, lo - peak, hi + peak, s_floor)
        else:
            t = t_star
        allow = BALANCE_TOL
        if curve.kind == "river":
            line = organic.line_xy(curve, t)
            if not organic.lowside(curve, t, s_floor).is_valid:
                _why("invalid")
                continue
            if curve.ramp_slope(t) > organic.RAMP_SLOPE:
                _why("slope")
                continue
            inside = line.intersection(outline).length
            run_len = LineString(organic.to_xy(curve.run, u)).length
            if inside <= 0 or run_len / inside < organic.RIVER_MIN_SHARE:
                _why("share")
                continue
            allow = max(allow, ctx.style.nat_tol)
        if abs(_area_left(pieces, rngs, curve, t, s_floor) - target) > allow * part:
            _why(curve.kind + " balance")
            continue
        dec = _decide(pieces, rngs, curve, t, tol, part, s_floor)
        if not _keeps(_sides(owners, dec, ctx.protect, organic.line_xy(curve, t)), ctx, n1, n):
            # shift the curve between the id points, if that costs at most SHIFT_TOL of a part
            if curve.kind == "river":
                _why("river sides")
                continue
            t = _shift(curve, owners, ctx, n1, u)
            if t is None or abs(_area_left(pieces, rngs, curve, t, s_floor) - target) > SHIFT_TOL * part:
                _why(curve.kind + " sides")
                continue
            dec = _decide(pieces, rngs, curve, t, tol, part, s_floor)
            if not _keeps(_sides(owners, dec, ctx.protect, organic.line_xy(curve, t)), ctx, n1, n):
                _why(curve.kind + " sides after shift")
                continue
        if not (dec[0] or dec[2]) or not (dec[1] or dec[2]):
            continue
        if curve.kind != "straight" and _frags(pieces, dec) > base_frags:
            _why(curve.kind + " fragments")
            if loose is None:
                loose = (curve, t, dec)
            continue
        chosen = (curve, t, dec)
        break
    if chosen is None:
        chosen = loose or (straight, t_star, base)
        if loose is None:
            _why("straight breaks sides")
    curve, t, (left_i, right_i, cut_list, poly) = chosen
    ctx.kinds.append(curve.kind)
    line = organic.line_xy(curve, t)
    if curve.kind == "river":
        ctx.runs.append(LineString(organic.to_xy(curve.run, u)))
    elif curve.kind == "straight":
        ctx.straight.append(line)
    left = [(i, pieces[i]) for i in sorted(left_i)]
    right = [(i, pieces[i]) for i in sorted(right_i)]
    for i in cut_list:
        p = pieces[i]
        x0, y0, x1, y1 = p.fr.bounds
        clip = poly.intersection(box(x0 - CUT_MARGIN_M, y0 - CUT_MARGIN_M, x1 + CUT_MARGIN_M, y1 + CUT_MARGIN_M))
        h = frame.to_lonlat(clip)
        a = as_poly(p.ll.intersection(h))
        b = as_poly(p.ll.difference(h))
        if not a.is_empty and a.area > DUST_DEG2:
            left.append((i, _piece(frame, a)))
        if not b.is_empty and b.area > DUST_DEG2:
            right.append((i, _piece(frame, b)))
    left.sort(key=lambda t: t[0])
    right.sort(key=lambda t: t[0])
    lp, rp = [p for _, p in left], [p for _, p in right]
    if not lp or not rp:
        raise SystemExit("subdivide: a bisection left one side empty")
    return (_bisect_organic(ctx, lp, n1, tol, path + "0")
            + _bisect_organic(ctx, rp, n - n1, tol, path + "1"))


def _merge_fragments(frame: Frame, parts: list) -> list:
    """A part's pieces that are not its largest and touch a sibling go to the sibling they share
    the longest edge with when the sibling stays under the cap (parts stay contiguous where they
    can); islands and the rest stay."""
    parts = list(parts)
    for i in range(len(parts)):
        # largest first by area scaled by cos(latitude), ties by position
        comps = sorted(polys(parts[i]), key=lambda c: (-c.area * math.cos(math.radians(c.centroid.y)), c.bounds))
        if len(comps) < 2:
            continue
        keep = [comps[0]]
        for c in comps[1:]:
            best, best_len = None, 0.0
            x0, y0, x1, y1 = c.bounds
            for j in range(len(parts)):
                if j == i or parts[j].is_empty:
                    continue
                b = parts[j].bounds
                if b[0] > x1 + 1e-6 or b[2] < x0 - 1e-6 or b[1] > y1 + 1e-6 or b[3] < y0 - 1e-6:
                    continue
                s = _shared(c, parts[j])
                if s > best_len:
                    best, best_len = j, s
            if best is not None:
                # a piece moves only when the sibling stays under the cap
                joined = as_poly(shapely.union_all([parts[best], c]))
                if area_km2(joined) > PART_MAX * CAP_KM2:
                    best = None
            if best is None:
                keep.append(c)
            else:
                parts[best] = as_poly(shapely.union_all([parts[best], c]))
        parts[i] = as_poly(shapely.union_all(keep))
    return parts


@dataclass
class Cut:
    parts: list  # lon/lat shapes
    areas: list  # km2, geodesic
    n: int
    whole_tol: float
    blocks: str
    style: str = "straight"  # the organic style kept (D854), or straight
    kinds: dict = field(default_factory=dict)  # cuts by kind: river, meander, straight
    borders: dict = field(default_factory=dict)  # km of sibling border by what it follows (D856)


def prepare(g, country: str, sources: dict, bend_width: float | None = None):
    """The frame and building pieces of a province shape (reused by every attempt of `choose`)."""
    g = as_poly(shapely.make_valid(g))
    frame = Frame(g)
    kind, lls = build_pieces(g, country, sources, frame, bend_width)
    return frame, kind, [_piece(frame, ll) for ll in lls]


def _straight(g, country: str, sources: dict, n: int, whole_tol: float, prepared=None,
              axes: dict | None = None) -> Cut:
    frame, kind, pieces = prepared or prepare(g, country, sources)
    groups = _bisect(frame, pieces, n, whole_tol, axes)
    parts = [as_poly(shapely.union_all([p.ll for p in grp])) for grp in groups]
    parts = _merge_fragments(frame, parts)
    return Cut(parts, [area_km2(p) for p in parts], n, whole_tol, kind)


def _organic(g, country: str, sources: dict, n: int, whole_tol: float, style: Style, seed: str,
             protect: list, partner: list, axes: dict, rivers: dict) -> Cut:
    g = as_poly(shapely.make_valid(g))
    width = math.sqrt(area_km2(g) / n) * 1000.0
    frame, kind, pieces = prepare(g, country, sources, width if style.bend else None)
    if style.rivers and "lines" not in rivers:
        rivers["lines"] = organic.rivers_in(frame, g, sources)
    pts = [Point(frame.fwd.transform(x, y)) for _, _, x, y in protect]
    ctx = Ctx(frame, style, seed, rivers.get("lines", []) if style.rivers else [], pts, axes, partner, [], [], [])
    groups = _bisect_organic(ctx, pieces, n, whole_tol, "r")
    parts = [as_poly(shapely.union_all([p.ll for p in grp])) for grp in groups]
    parts = _merge_fragments(frame, parts)
    kinds = {k: ctx.kinds.count(k) for k in ("river", "meander", "straight")}
    c = Cut(parts, [area_km2(p) for p in parts], n, whole_tol, kind, style.name, kinds)
    c.borders = organic.border_stats(frame, parts, shapely.union_all([p.fr.boundary for p in pieces]),
                                     ctx.runs, ctx.straight)
    return c


def _holders(c: Cut, protect: list) -> dict | None:
    """Protected point -> the id of the part holding it, or None when the parts do not map one
    to one onto the id points."""
    ids: dict[int, str] = {}
    for kind, key, x, y in protect:
        if kind != "id":
            continue
        hit = [i for i, p in enumerate(c.parts) if p.covers(Point(x, y))]
        if len(hit) != 1 or hit[0] in ids:
            return None
        ids[hit[0]] = key
    if len(ids) != len(c.parts):
        return None
    out = {}
    for kind, key, x, y in protect:
        hit = [i for i, p in enumerate(c.parts) if p.covers(Point(x, y))]
        out[(kind, key)] = ids[hit[0]] if len(hit) == 1 else None
    out["_components"] = {ids[i]: _components(p) for i, p in enumerate(c.parts)}
    return out


def _components(g) -> int:
    """Polygons of a part over FRAG_KM2 (smaller bits are under a pixel)."""
    return sum(1 for q in polys(g) if area_km2(q) > FRAG_KM2) or 1


def _misfit(c: Cut, base: dict, protect: list) -> str:
    """D854: why the parts do not fit ("" when they do): every part between PART_MIN and
    PART_MAX of the cap, every protected point in the part the straight cut put it in, and every
    part that was one piece still one piece (a part already on several islands may gain one;
    QA's exclave check still judges every land bit, D691)."""
    if max(c.areas) > PART_MAX * CAP_KM2 or min(c.areas) < PART_MIN * CAP_KM2:
        return f"areas {min(c.areas):,.0f} to {max(c.areas):,.0f} km2"
    h = _holders(c, protect)
    if h is None:
        return "the id points do not map one to one onto the parts"
    moved = [f"{k[1]} ({v} to {h.get(k)})" for k, v in base.items()
             if k != "_components" and v is not None and h.get(k) != v]
    if moved:
        return "points moved: " + ", ".join(moved)
    more = [f"{q} ({m} to {h['_components'][q]})" for q, m in base["_components"].items()
            if m == 1 and h["_components"][q] > m]
    return ("more pieces: " + ", ".join(more)) if more else ""


def cut(g, country: str, sources: dict, n: int, whole_tol: float, prepared=None, seed: str = "",
        protect: list | None = None, log=None) -> Cut:
    """The province shape g cut into n parts (deterministic for the same inputs). With a `seed`
    (the province id) and the protected points (kind, key, lon, lat; kind `id` for the points
    that name the parts) the borders are organic: the first of STYLES whose parts fit (`_misfit`, D854),
    else the straight cut of D822."""
    axes: dict = {}
    base = _straight(g, country, sources, n, whole_tol, prepared, axes)
    if not seed:
        return base
    protect = protect or []
    held = _holders(base, protect)
    if held is None:
        return base
    id_at = {held[("id", key)]: k for k, (kind, key, _, _) in enumerate(protect) if kind == "id"}
    partner = [id_at.get(held[(kind, key)]) for kind, key, _, _ in protect]
    rivers: dict = {}
    for style in STYLES:
        for salt in SALTS:
            c = _organic(g, country, sources, n, whole_tol, style, seed + salt, protect, partner, axes, rivers)
            why = _misfit(c, held, protect)
            if not why:
                c.style += f" (seed {seed + salt})" if salt else ""
                return c
            if log:
                log(f"  {seed + salt}: {style.name} does not fit: {why}")
    return base


def choose(g, country: str, sources: dict) -> Cut:
    """The fewest parts (from parts_for) and the largest whole-piece tolerance that keep every
    part at most PART_MAX of the cap (the straight cut of D822, as `run.py giants --write` made it)."""
    n0 = parts_for(area_km2(g))
    prepared = prepare(g, country, sources)
    for n in range(n0, n0 + EXTRA_PARTS + 1):
        for tol in WHOLE_TOLS:
            c = cut(g, country, sources, n, tol, prepared)
            if max(c.areas) <= PART_MAX * CAP_KM2:
                return c
    raise SystemExit(f"subdivide: no cut of {n0} to {n0 + EXTRA_PARTS} parts keeps every part under the cap")


def city_points() -> list[tuple[str, float, float]]:
    """(label, lon, lat) of every city probe point with an expected province (checks/city-points.txt)."""
    out = []
    path = config.PIPELINE_DIR / "checks" / "city-points.txt"
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        f = [s.strip() for s in line.split("|")]
        if len(f) < 4 or f[3] == "?":
            continue
        out.append((f[0], float(f[1]), float(f[2])))
    return out


def protected(pid: str, spec: dict, g, sites: dict) -> list:
    """The points a giant's cut must keep in their parts: the id points, the builder's sites and
    the city probe points inside it."""
    out = [("id", pid, float(spec["main"][0]), float(spec["main"][1]))]
    out += [("id", k, float(v[0]), float(v[1])) for k, v in sorted(spec.get("children", {}).items())]
    out += [("site", k, float(v[0]), float(v[1])) for k, v in sorted(sites.items()) if not k.startswith("_")]
    shapely.prepare(g)
    out += [("probe", lb, x, y) for lb, x, y in city_points() if g.covers(Point(x, y))]
    return out


# ---------------------------------------------------------------------------------------------
# the shapes step


def children_of(hints: dict) -> dict[str, str]:
    """child id -> parent id, from a region's `[subdivide]` hints."""
    return {c: pid for pid, spec in sorted(hints.get("subdivide", {}).items())
            for c in sorted(spec.get("children", {}))}


def apply(built: dict, country: str, hints: dict, sources: dict, stats: dict | None = None) -> list[str]:
    """Cut each subdivided province of `built` (one region's shapes) as its hints say, with
    organic borders (D850), and put its parts in `built` under the ids whose points they hold.
    Returns the parents cut; `stats` gets each one's style, cut kinds, border lengths and areas."""
    done = []
    for pid, spec in sorted(hints.get("subdivide", {}).items()):
        if pid not in built:
            continue
        sites = hints.get("giant_sites", {}).get(pid, {})
        c = cut(built[pid], country, sources, int(spec["parts"]), float(spec["whole_tol"]), seed=pid,
                protect=protected(pid, spec, built[pid], sites))
        if c.blocks != spec["blocks"]:
            raise SystemExit(f"subdivide: {pid} was cut on {spec['blocks']} pieces, now {c.blocks}")
        points = [(pid, spec["main"])] + sorted((k, v) for k, v in spec.get("children", {}).items())
        if len(points) != len(c.parts):
            raise SystemExit(f"subdivide: {pid} has {len(c.parts)} parts and {len(points)} ids")
        owner: dict[int, str] = {}
        for qid, (x, y) in points:
            hit = [i for i, p in enumerate(c.parts) if p.covers(Point(float(x), float(y)))]
            if len(hit) != 1 or hit[0] in owner:
                raise SystemExit(f"subdivide: {qid}'s point ({x}, {y}) is not in exactly one free part of {pid}")
            owner[hit[0]] = qid
        for i, p in enumerate(c.parts):
            built[owner[i]] = p
        if stats is not None:
            stats[pid] = {"style": c.style, "cuts": c.kinds, "borders_km": c.borders,
                          "areas": {owner[i]: round(c.areas[i]) for i in sorted(owner, key=lambda i: owner[i])}}
        done.append(pid)
    return done
