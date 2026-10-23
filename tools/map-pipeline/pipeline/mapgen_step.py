"""P7: run the Rust `mapgen` tool (release build; cargo is on PATH).

The bitmaps hold every region built so far, not only the one being run: mapgen gets each
built region's work/<region>/provinces.geojson and CSV, and map-meta.toml `coverage` lists
exactly those CSVs. A region counts as built once its simplify step wrote provinces.geojson.
"""

from __future__ import annotations

import subprocess

from . import PIPELINE_VERSION, config


def built_regions(sources: dict) -> list[config.Region]:
    cache = config.cache_dir(sources) / "work"
    return [r for r in config.REGIONS.values() if (cache / r.slug / "provinces.geojson").exists()]


def run(region: config.Region) -> None:
    sources = config.load_sources()
    work = config.work_dir(region.slug, sources)
    ne, gb = sources["natural_earth"], sources["geoboundaries"]
    regions = built_regions(sources)
    if region not in regions:
        raise SystemExit(f"mapgen: {region.slug} has no provinces.geojson; run its simplify step first")
    cmd = [
        "cargo", "run", "--release", "--quiet", "-p", "mapgen", "--",
        "build",
        # the land mask is the whole world, the same for every region
        "--land", str(work / "land.geojson"),
        "--out", str(config.ASSETS_DIR),
        "--qa", str(work / "mapgen-qa.csv"),
        "--pipeline-version", PIPELINE_VERSION,
        "--source", f"natural_earth={ne['version']} ({ne['commit'][:7]})",
        "--source", f"geoboundaries={gb['version']} gbOpen ({gb['commit'][:7]})",
    ]
    for r in regions:
        cmd += ["--geojson", str(config.work_dir(r.slug, sources) / "provinces.geojson")]
        cmd += ["--csv", str(config.DATA_DIR / r.csv)]
    print(f"  regions in the bitmap: {', '.join(r.slug for r in regions)}")
    res = subprocess.run(cmd, cwd=config.REPO_ROOT)
    if res.returncode != 0:
        raise SystemExit("mapgen failed")
