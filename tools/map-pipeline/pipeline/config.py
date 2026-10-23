"""Paths, the pinned sources and the region table."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = PIPELINE_DIR.parent.parent
SOURCES_TOML = PIPELINE_DIR / "sources.toml"
DATA_DIR = REPO_ROOT / "docs" / "design" / "data"
ASSETS_DIR = REPO_ROOT / "assets" / "map"


@dataclass(frozen=True)
class Region:
    """One region CSV file of the design data (P9: North America first, then the world)."""

    slug: str
    csv: str
    # Game country code (countries.csv iso3) for every country in the file.
    countries: tuple[str, ...]


REGIONS: dict[str, Region] = {
    "north-america": Region(
        "north-america", "provinces-north-america.csv", ("USA", "CAN", "MEX", "GRL", "BMU", "SPM")
    ),
}


def load_sources() -> dict:
    with SOURCES_TOML.open("rb") as f:
        return tomllib.load(f)


def cache_dir(sources: dict | None = None) -> Path:
    sources = sources or load_sources()
    return Path(sources["cache_dir"])


def work_dir(region: str, sources: dict | None = None) -> Path:
    """Large intermediates for a region (provinces.geojson and friends): cache only, never committed."""
    d = cache_dir(sources) / "work" / region
    d.mkdir(parents=True, exist_ok=True)
    return d


def ne_path(name: str, sources: dict | None = None) -> Path:
    sources = sources or load_sources()
    ne = sources["natural_earth"]
    return cache_dir(sources) / "natural-earth" / ne["version"] / Path(name).name


def gb_dir(iso: str, level: str, sources: dict | None = None) -> Path:
    sources = sources or load_sources()
    gb = sources["geoboundaries"]
    return cache_dir(sources) / "geoboundaries" / gb["version"] / "gbOpen" / iso / level
