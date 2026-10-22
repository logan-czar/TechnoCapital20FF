"""P5 and P6: topology-safe simplify with mapshaper, then export provinces.geojson.

mapshaper builds shared arcs, so neighbours are simplified along the same line and stay
gap-free; `snap` first joins vertices that differ only by float noise, `-clean` removes the
slivers and overlaps the snap leaves. Coordinates stay in degrees: the Miller projection is
applied by mapgen (D602), so provinces.geojson is the plain WGS84 vector source of truth.
"""

from __future__ import annotations

import json
import subprocess

from . import config

# Simplify interval in metres. 8192 px around the equator is about 4.9 km per pixel, so 500 m
# is well under a pixel everywhere the map has provinces (D602).
SIMPLIFY_INTERVAL_M = 500
# Output precision in degrees (about 0.1 m).
PRECISION = 0.000001


def _mapshaper(*args: str) -> None:
    exe = config.PIPELINE_DIR / "node_modules" / "mapshaper" / "bin" / "mapshaper"
    if not exe.exists():
        raise SystemExit("simplify: mapshaper is missing; run `npm ci` in tools/map-pipeline")
    cmd = ["node", str(exe), *args]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"simplify: mapshaper failed:\n{r.stderr}")
    for line in (r.stderr or "").splitlines():
        if line.strip():
            print(f"    mapshaper: {line.strip()}")


def run(region: config.Region) -> None:
    sources = config.load_sources()
    work = config.work_dir(region.slug, sources)
    raw = work / "provinces_raw.geojson"
    out = work / "provinces.geojson"
    _mapshaper(
        "-i", str(raw), "snap",
        "-clean",
        "-simplify", f"interval={SIMPLIFY_INTERVAL_M}", "keep-shapes",
        "-clean",
        "-o", str(out), "format=geojson", f"precision={PRECISION}", "force",
    )
    land_raw = work / "land_raw.geojson"
    land = work / "land.geojson"
    _mapshaper(
        "-i", str(land_raw), "snap",
        "-simplify", f"interval={SIMPLIFY_INTERVAL_M}", "keep-shapes",
        "-o", str(land), "format=geojson", f"precision={PRECISION}", "force",
    )
    n_in = len(json.loads(raw.read_text(encoding="utf-8"))["features"])
    feats = json.loads(out.read_text(encoding="utf-8"))["features"]
    ids = [f["properties"]["province_id"] for f in feats if f.get("geometry")]
    if len(ids) != n_in or len(set(ids)) != n_in:
        raise SystemExit(f"simplify: {n_in} provinces in, {len(set(ids))} with a shape out")
    print(f"  {len(ids)} provinces simplified -> {out}")
