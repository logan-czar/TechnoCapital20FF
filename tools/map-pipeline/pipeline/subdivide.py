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
from dataclasses import dataclass

import geopandas as gpd
import numpy as np
import shapely
from pyproj import Geod, Transformer
from shapely import affinity
from shapely.geometry import MultiPoint, Point, Polygon, box
from shapely.geometry.polygon import orient

from . import config, crosswalk

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


def build_pieces(g, country: str, sources: dict, frame: Frame) -> tuple[str, list]:
    """The building pieces of province shape g: (`admin2` | `towns` | `parts`, pieces in degrees)."""
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


def _bisect(frame: Frame, pieces: list[Piece], n: int, tol: float) -> list[list[Piece]]:
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
    return _bisect(frame, lp, n1, tol) + _bisect(frame, rp, n - n1, tol)


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


def prepare(g, country: str, sources: dict):
    """The frame and building pieces of a province shape (reused by every attempt of `choose`)."""
    g = as_poly(shapely.make_valid(g))
    frame = Frame(g)
    kind, lls = build_pieces(g, country, sources, frame)
    return frame, kind, [_piece(frame, ll) for ll in lls]


def cut(g, country: str, sources: dict, n: int, whole_tol: float, prepared=None) -> Cut:
    """The province shape g cut into n parts (deterministic for the same inputs)."""
    frame, kind, pieces = prepared or prepare(g, country, sources)
    groups = _bisect(frame, pieces, n, whole_tol)
    parts = [as_poly(shapely.union_all([p.ll for p in grp])) for grp in groups]
    parts = _merge_fragments(frame, parts)
    return Cut(parts, [area_km2(p) for p in parts], n, whole_tol, kind)


def choose(g, country: str, sources: dict) -> Cut:
    """The fewest parts (from parts_for) and the largest whole-piece tolerance that keep every
    part at most PART_MAX of the cap."""
    n0 = parts_for(area_km2(g))
    prepared = prepare(g, country, sources)
    for n in range(n0, n0 + EXTRA_PARTS + 1):
        for tol in WHOLE_TOLS:
            c = cut(g, country, sources, n, tol, prepared)
            if max(c.areas) <= PART_MAX * CAP_KM2:
                return c
    raise SystemExit(f"subdivide: no cut of {n0} to {n0 + EXTRA_PARTS} parts keeps every part under the cap")


# ---------------------------------------------------------------------------------------------
# the shapes step


def children_of(hints: dict) -> dict[str, str]:
    """child id -> parent id, from a region's `[subdivide]` hints."""
    return {c: pid for pid, spec in sorted(hints.get("subdivide", {}).items())
            for c in sorted(spec.get("children", {}))}


def apply(built: dict, country: str, hints: dict, sources: dict) -> list[str]:
    """Cut each subdivided province of `built` (one region's shapes) as its hints say, and put
    its parts in `built` under the ids whose points they hold. Returns the parents cut."""
    done = []
    for pid, spec in sorted(hints.get("subdivide", {}).items()):
        if pid not in built:
            continue
        c = cut(built[pid], country, sources, int(spec["parts"]), float(spec["whole_tol"]))
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
        done.append(pid)
    return done
