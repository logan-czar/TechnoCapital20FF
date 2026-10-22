"""P4: build one shape per province from the P3 plan (map-sources.md pipeline step 4).

Whole building blocks are dissolved; a block several provinces claim is cut by Voronoi among
their seeds (distances with longitude scaled by cos(latitude), so cells are not stretched); the
result is clipped to the region, so regions nest exactly. Region area no block covers (the
seams where geoBoundaries and Natural Earth lines differ) goes to the province it shares the
longest edge with. Writes provinces_raw.geojson and land_raw.geojson to the work directory.
"""

from __future__ import annotations

import json
import math

import geopandas as gpd
import shapely
from shapely import affinity
from shapely.geometry import MultiPoint, Point

from . import config, crosswalk

# Lakes whose shores count as coast (D608; provinces-north-america-summary.md: "Coastal Y
# includes Great Lakes shores").
COAST_LAKES = ["Lake Superior", "Lake Michigan", "Lake Huron", "Lake Erie", "Lake Ontario", "Lake Saint Clair"]
# Gap pieces smaller than this (square degrees) are dropped rather than assigned (float dust).
DUST_AREA = 1e-9


def _scaled_voronoi(unit, seeds_by_prov: dict[str, list[list[float]]]):
    """Split `unit` among provinces by nearest seed. Returns {province: geometry}."""
    pts, owner = [], []
    seen = set()
    for pid in sorted(seeds_by_prov):
        for x, y in seeds_by_prov[pid]:
            k = (round(x, 7), round(y, 7))
            if k in seen:
                continue
            seen.add(k)
            pts.append((x, y))
            owner.append(pid)
    provs = sorted(set(owner))
    if len(provs) == 1:
        return {provs[0]: unit}
    lat0 = unit.representative_point().y
    kx = max(math.cos(math.radians(lat0)), 0.2)
    scaled_unit = affinity.scale(unit, xfact=kx, yfact=1.0, origin=(0, 0))
    mp = MultiPoint([(x * kx, y) for x, y in pts])
    cells = shapely.voronoi_polygons(mp, extend_to=scaled_unit.envelope.buffer(1.0))
    out: dict[str, list] = {p: [] for p in provs}
    for cell in cells.geoms:
        # each cell holds exactly one seed
        idx = next(i for i, (x, y) in enumerate(pts) if cell.covers(Point(x * kx, y)))
        piece = cell.intersection(scaled_unit)
        if not piece.is_empty:
            out[owner[idx]].append(piece)
    res = {}
    for pid, pieces in out.items():
        if pieces:
            g = shapely.union_all(pieces)
            res[pid] = affinity.scale(g, xfact=1.0 / kx, yfact=1.0, origin=(0, 0))
    return res


def _polys(g):
    """Only the polygonal part of a geometry (intersections can leave lines and points)."""
    if g.is_empty:
        return g
    if g.geom_type in ("Polygon", "MultiPolygon"):
        return g
    parts = [p for p in getattr(g, "geoms", []) if p.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(parts) if parts else shapely.Polygon()


def build_region(key: str, rgeom, rplan: dict, work) -> dict[str, object]:
    provs = rplan["provinces"]
    if rplan["level"] == "region":
        (pid,) = provs
        return {pid: rgeom}
    blocks = gpd.read_file(work / rplan["blocks_file"]).set_index("unit_id")
    pieces: dict[str, list] = {pid: [] for pid in provs}
    split_units: dict[str, dict[str, list]] = {}
    for pid, pr in provs.items():
        for uid in pr["whole"]:
            pieces[pid].append(blocks.loc[uid].geometry)
        for uid, pts in pr["split"].items():
            split_units.setdefault(uid, {})[pid] = pts
    for uid in sorted(split_units):
        unit = shapely.make_valid(blocks.loc[uid].geometry)
        for pid, g in _scaled_voronoi(unit, split_units[uid]).items():
            pieces[pid].append(g)
    shapes: dict[str, object] = {}
    taken = shapely.Polygon()
    for pid in sorted(pieces):
        g = shapely.union_all(pieces[pid]) if pieces[pid] else shapely.Polygon()
        g = _polys(shapely.make_valid(g).intersection(rgeom).difference(taken))
        shapes[pid] = g
        taken = taken.union(g)
    # fill the seams: each leftover piece goes to the neighbour with the longest shared edge
    gap = _polys(rgeom.difference(taken))
    for part in getattr(gap, "geoms", [gap]):
        if part.is_empty or part.area < DUST_AREA:
            continue
        best, best_len = None, -1.0
        ring = part.boundary
        for pid in sorted(shapes):
            g = shapes[pid]
            if g.is_empty:
                continue
            shared = ring.intersection(g.buffer(1e-7)).length
            if shared > best_len:
                best, best_len = pid, shared
        if best_len <= 0:
            best = min(sorted(shapes), key=lambda pid: shapes[pid].distance(part) if not shapes[pid].is_empty else 1e9)
        shapes[best] = _polys(shapes[best].union(part))
    return shapes


def run(region: config.Region) -> None:
    sources = config.load_sources()
    work = config.work_dir(region.slug, sources)
    plan = json.loads((work / "plan.json").read_text(encoding="utf-8"))
    regions = gpd.read_file(work / "regions.geojson").set_index("region_key")
    rows = []
    empty = []
    nesting = {}
    for key in sorted(plan["regions"]):
        rplan = plan["regions"][key]
        rgeom = shapely.make_valid(regions.loc[key].geometry)
        built = build_region(key, rgeom, rplan, work)
        union = shapely.union_all(list(built.values()))
        total = sum(g.area for g in built.values())
        # regions nest exactly: the provinces tile the region with no gap and no overlap
        nesting[key] = {
            "uncovered": max(rgeom.area - union.area, 0.0) / rgeom.area,
            "overlap": max(total - union.area, 0.0) / rgeom.area,
            "outside": union.difference(rgeom).area / rgeom.area,
        }
        for pid, g in built.items():
            if g.is_empty:
                empty.append(pid)
            rows.append({"province_id": pid, "region": key, "country": rplan["country"],
                         "geometry": shapely.make_valid(g)})
    gdf = gpd.GeoDataFrame(rows, crs="EPSG:4326").sort_values("province_id")
    gdf.to_file(work / "provinces_raw.geojson", driver="GeoJSON")
    (work / "nesting.json").write_text(json.dumps(nesting, indent=1), encoding="utf-8")
    # The land mask for mapgen's coastal check (D608): Natural Earth admin-0 without lakes cut
    # out, less the Great Lakes, so only the sea and the Great Lakes count as coast (the CSV
    # `coastal` column includes Great Lakes shores; other lakes are not coast).
    land = gpd.read_file(config.ne_path("ne_10m_admin_0_countries.shp", sources), columns=["ADM0_A3"])
    lakes = gpd.read_file(config.ne_path("ne_10m_lakes.shp", sources), columns=["name"])
    great = shapely.union_all(lakes[lakes.name.isin(COAST_LAKES)].geometry.values)
    land["geometry"] = [shapely.make_valid(g).difference(great) for g in land.geometry.values]
    land.to_file(work / "land_raw.geojson", driver="GeoJSON")
    print(f"  {len(gdf)} province shapes ({len(empty)} empty: {', '.join(empty) or 'none'})")


if __name__ == "__main__":
    run(config.REGIONS["north-america"])
    _ = crosswalk  # the plan's producer
