"""P7: run the Rust `mapgen` tool on provinces.geojson (release build; cargo is on PATH)."""

from __future__ import annotations

import subprocess

from . import PIPELINE_VERSION, config


def run(region: config.Region) -> None:
    sources = config.load_sources()
    work = config.work_dir(region.slug, sources)
    ne, gb = sources["natural_earth"], sources["geoboundaries"]
    # Every region file mapgen has shapes for (Phase A: North America only).
    csvs = [config.DATA_DIR / r.csv for r in config.REGIONS.values()]
    cmd = [
        "cargo", "run", "--release", "--quiet", "-p", "mapgen", "--",
        "build",
        "--geojson", str(work / "provinces.geojson"),
        "--land", str(work / "land.geojson"),
        "--out", str(config.ASSETS_DIR),
        "--qa", str(work / "mapgen-qa.csv"),
        "--pipeline-version", PIPELINE_VERSION,
        "--source", f"natural_earth={ne['version']} ({ne['commit'][:7]})",
        "--source", f"geoboundaries={gb['version']} gbOpen ({gb['commit'][:7]})",
    ]
    for c in csvs:
        cmd += ["--csv", str(c)]
    r = subprocess.run(cmd, cwd=config.REPO_ROOT)
    if r.returncode != 0:
        raise SystemExit("mapgen failed")
