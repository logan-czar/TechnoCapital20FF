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

from . import config
from .simplify import _mapshaper

# Top edge of the map in degrees (D600); the same value as mapgen's LAT_MAX_DEG.
LAT_MAX_DEG = 84.0
# TopoJSON quantization grid (steps per axis over the ~2 pi wide extent): 1.5e5 steps is about
# 270 m at the equator, within the 500 m simplify interval. 1e5 collapses the Vatican (VA-0001) to nothing.
QUANTIZATION = 150_000


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
    print(f"  {len(ids)} provinces -> {out} ({out.stat().st_size / 1e6:.2f} MB)")
