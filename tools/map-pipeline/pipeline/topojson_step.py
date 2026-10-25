"""D954: the vector map. Combines every region's provinces.geojson into one Miller-projected TopoJSON.

The Rust game drew a province-ID bitmap rasterized by mapgen; the TypeScript game draws the province
polygons with deck.gl instead. This step reads the simplified WGS84 shapes (simplify step), projects
them to Miller in mapgen's frame units (radians: x = lon, y = 1.25 ln tan(pi/4 + 0.4 lat), see
crates/mapgen/src/miller.rs), keeps only `province_id` and writes `assets/map/provinces.topo.json`.
mapshaper keeps the shared arcs, so neighbours stay gap-free and country borders are a mesh.

The north edge is cut at LAT_MAX_DEG (D600) so the frame matches mapgen's; nothing is cut in the south
(the 2:1 frame's bottom edge is about 57.8 S, left to the viewer's limits).
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

import numpy as np
import shapely

from . import config
from .simplify import _mapshaper

# Top edge of the map in degrees (D600); the same value as mapgen's LAT_MAX_DEG.
LAT_MAX_DEG = 84.0
# TopoJSON quantization grid (steps per axis over the ~2 pi wide extent): 1.5e5 steps is about
# 270 m at the equator, within the 500 m simplify interval. 1e5 collapses the Vatican (VA-0001) to nothing.
QUANTIZATION = 150_000
# The report warns when a province's area, in the output against the source, moves by more than
# this share (D954: quantization and the clip can drop islands or fold thin shapes away).
AREA_WARN = 0.05


def run() -> None:
    """Every built region (one whose simplify step wrote provinces.geojson), as mapgen does."""
    sources = config.load_sources()
    regions = [r for r in config.REGIONS.values() if (config.work_dir(r.slug, sources) / "provinces.geojson").exists()]
    if not regions:
        raise SystemExit("topojson: no region has provinces.geojson; run the simplify step first")
    inputs = [str(config.work_dir(r.slug, sources) / "provinces.geojson") for r in regions]
    out = config.ASSETS_DIR / "provinces.topo.json"
    _mapshaper(
        "-i", *inputs, "combine-files", "-merge-layers", "name=provinces",
        "-filter-fields", "province_id",
        "-clip", f"bbox=-180,-90,180,{LAT_MAX_DEG}",
        # +R=1 so x is in radians (mapgen's units), not metres
        "-proj", "+proj=mill +R=1",
        "-o", str(out), "format=topojson", f"quantization={QUANTIZATION}", "force",
    )
    topo = json.loads(out.read_text(encoding="utf-8"))
    geoms = topo["objects"]["provinces"]["geometries"]
    ids = [g["properties"]["province_id"] for g in geoms if g.get("type")]
    if len(ids) != len(set(ids)):
        raise SystemExit("topojson: duplicate province ids")
    # every CSV province must have a shape
    want = set()
    for region in regions:
        with (config.DATA_DIR / region.csv).open(encoding="utf-8", newline="") as f:
            want |= {r["id"] for r in csv.DictReader(f)}
    missing = sorted(want - set(ids))
    extra = sorted(set(ids) - want)
    if missing or extra:
        raise SystemExit(f"topojson: {len(missing)} provinces without a shape {missing[:5]}, {len(extra)} extra {extra[:5]}")
    _report(inputs, topo)
    print(f"  {len(ids)} provinces -> {out} ({out.stat().st_size / 1e6:.2f} MB)")


def _miller(lon_lat: np.ndarray) -> np.ndarray:
    """Degrees to mapgen's Miller units (x = longitude in radians, y = 1.25 ln tan(pi/4 + 0.4 lat))."""
    lon, lat = np.radians(lon_lat[:, 0]), np.radians(lon_lat[:, 1])
    return np.column_stack([lon, 1.25 * np.log(np.tan(math.pi / 4 + 0.4 * lat))])


def _tidy(g: shapely.Geometry) -> shapely.Geometry:
    """Valid and dissolved, so pieces that only touch count as one part on both sides."""
    return shapely.unary_union(shapely.make_valid(g))


def _decode(topo: dict) -> dict[str, shapely.Geometry]:
    """The shapes of the written TopoJSON, quantization included (what the browser draws)."""
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        pts = np.cumsum(np.array(arc, dtype=float), axis=0)
        arcs.append(np.column_stack([pts[:, 0] * sx + tx, pts[:, 1] * sy + ty]))

    def ring(idx: list[int]) -> np.ndarray:
        pts = [arcs[i] if i >= 0 else arcs[~i][::-1] for i in idx]
        return np.concatenate([pts[0]] + [p[1:] for p in pts[1:]])

    def polygon(rings: list[list[int]]) -> shapely.Polygon:
        return shapely.Polygon(ring(rings[0]), [ring(r) for r in rings[1:]])

    out = {}
    for g in topo["objects"]["provinces"]["geometries"]:
        if g["type"] == "Polygon":
            geom = polygon(g["arcs"])
        elif g["type"] == "MultiPolygon":
            geom = shapely.MultiPolygon([polygon(p) for p in g["arcs"]])
        else:
            continue
        out[g["properties"]["province_id"]] = _tidy(geom)
    return out


def _report(sources: list[str], topo: dict) -> None:
    """Per province: part count and area of the output against the source (same Miller frame, same
    north clip), so a province the simplify, clip or quantization shrank or split is visible."""
    top = 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * math.radians(LAT_MAX_DEG)))
    clip = shapely.box(-10, -10, 10, top)
    before = {}
    for path in sources:
        for f in json.loads(Path(path).read_text(encoding="utf-8"))["features"]:
            if f.get("geometry"):
                g = shapely.transform(shapely.geometry.shape(f["geometry"]), _miller)
                before[f["properties"]["province_id"]] = _tidy(shapely.intersection(g, clip))
    after = _decode(topo)
    parts = lambda g: len(g.geoms) if hasattr(g, "geoms") else (0 if g.is_empty else 1)
    warned = lost = 0
    for pid in sorted(before):
        b, a = before[pid], after.get(pid)
        if a is None or b.area == 0:
            continue
        ratio = a.area / b.area
        if parts(a) != parts(b) or abs(ratio - 1) > AREA_WARN:
            warned += 1
            lost += abs(ratio - 1) > AREA_WARN
            print(f"    topojson: {pid}: parts {parts(b)} -> {parts(a)}, area x{ratio:.3f}")
    print(f"  topojson report: {warned} of {len(before)} provinces changed parts or area by over {AREA_WARN:.0%} ({lost} by area)")
