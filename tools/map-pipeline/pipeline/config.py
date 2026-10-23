"""Paths, the pinned sources and the region table."""

from __future__ import annotations

import csv
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


# The region files in CSV-file order (build-plan P9: North America first, then the rest).
REGION_SLUGS = [
    "north-america",
    "east-asia-oceania",
    "europe",
    "latin-america",
    "mena",
    "russia-central-asia",
    "south-asia",
    "sub-saharan-africa",
]


def _countries(csv_name: str) -> tuple[str, ...]:
    with (DATA_DIR / csv_name).open(encoding="utf-8", newline="") as f:
        return tuple(sorted({r["country"] for r in csv.DictReader(f)}))


REGIONS: dict[str, Region] = {
    slug: Region(slug, f"provinces-{slug}.csv", _countries(f"provinces-{slug}.csv")) for slug in REGION_SLUGS
}

# Natural Earth admin-0 codes (ADM0_A3) where they differ from the game's country code, and the
# extra NE units a game country's regions are drawn from (D672). The game follows its own
# province files on contested land (decision C), so Northern Cyprus is drawn from NE's CYN
# unit for CYP, Somaliland from SOL for SOM and Western Sahara from SAH for MAR; Kosovo, the
# Palestinian territories, South Sudan and Papa's Port (the Falklands) only use other codes.
NE_CODES: dict[str, tuple[str, ...]] = {
    "XKX": ("KOS",),
    "PSE": ("PSX",),
    "SSD": ("SDS",),
    "PAP": ("FLK",),
    "CYP": ("CYP", "CYN"),
    "SOM": ("SOM", "SOL"),
    "MAR": ("MAR", "SAH"),
}


def ne_codes(country: str) -> tuple[str, ...]:
    """The Natural Earth admin-0 codes a game country is drawn from."""
    return NE_CODES.get(country, (country,))


def ne_codes_for(countries) -> set[str]:
    return {c for g in countries for c in ne_codes(g)}


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


def gb_boundary(iso: str, level: str, sources: dict | None = None) -> dict | None:
    """The pinned geoBoundaries entry for a country and level, or None."""
    sources = sources or load_sources()
    for b in sources["geoboundaries"]["boundary"]:
        if b["iso"] == iso and b["level"] == level:
            return b
    return None


def gb_geojson_name(b: dict) -> str:
    """The geometry file of a pinned boundary: the full file, or geoBoundaries' own
    topology-preserving `_simplified` file when the pin says `file = "simplified"` (D670)."""
    stem = f"geoBoundaries-{b['iso']}-{b['level']}"
    return f"{stem}_simplified.geojson" if b.get("file") == "simplified" else f"{stem}.geojson"
