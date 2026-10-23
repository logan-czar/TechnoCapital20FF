"""P8 anchor check: each province's own city lands on its own pixels.

Independent of the crosswalk's matching (so a matching bug cannot hide itself): for every CSV
province it looks up, by exact folded name among Natural Earth populated places of the
province's country,
- the place its own name names (a name part, or a part without generic words: "Downtown
  Toronto" -> Toronto, "Houston Central" -> Houston): it must land on that province;
- its Metro (`metro` column): it must land on a province of the same Metro;
- each key city (key-cities.csv): it must land on one of the key city's provinces.
The point is looked up in province-index.png through the Miller frame of map-meta.toml; a
coastal point in the water takes the nearest province pixel within `SEARCH_PX`.
"""

from __future__ import annotations

import csv
import math
import tomllib
from pathlib import Path

import geopandas as gpd
import numpy as np

from . import config, text

# How far (pixels) a point in the water may look for the nearest province pixel.
SEARCH_PX = 3
# Words dropped from a name part before the place lookup ("Downtown Toronto" -> Toronto).
GENERIC = {"downtown", "central", "centre", "center", "centro", "city", "loop", "midtown", "waterfront"}
# A Metro province's own city further than this many "radii" (sqrt(area_px / pi)) from the
# province's pixel centroid is listed: the city sits at the edge of its own province, as when
# a Voronoi seed at a block's arbitrary point sent Downtown Toronto east to Pickering.
OFF_CENTRE_RADII = 1.6


class Frame:
    def __init__(self, meta: dict):
        self.w, self.h = meta["width"], meta["height"]
        self.ppu = self.w / (2 * math.pi)
        self.y_top = self._my(meta["lat_max"])

    @staticmethod
    def _my(lat):
        return 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * math.radians(lat)))

    def pixel(self, lon, lat):
        x = (lon + 180.0) / 360.0 * self.w
        y = (self.y_top - self._my(lat)) * self.ppu
        return int(math.floor(x)) % self.w, int(math.floor(y))


def _place_lookup(countries, sources):
    pp = gpd.read_file(config.ne_path("ne_10m_populated_places.shp", sources),
                       columns=["NAME", "NAMEASCII", "ADM0_A3", "POP_MAX"])
    pp = pp[pp.ADM0_A3.isin(countries)]
    out: dict[tuple[str, str], list] = {}
    for r in pp.itertuples():
        for n in sorted({r.NAME, r.NAMEASCII} - {None}):
            out.setdefault((r.ADM0_A3, text.fold(n)), []).append((r.POP_MAX or 0, r.geometry.x, r.geometry.y, r.NAME))
    for v in out.values():
        v.sort(key=lambda c: (-c[0], c[1], c[2]))
    return out


def _candidates(name: str) -> list[str]:
    out = []
    for part in text.name_parts(name):
        out.append(part)
        core = " ".join(w for w in part.split() if w not in GENERIC)
        if core and core != part:
            out.append(core)
    return list(dict.fromkeys(out))


def check(region: config.Region, index_png: Path, meta_toml: Path, sources: dict) -> list[dict]:
    """Return one row per anchor that misses: kind, province, place, expected, got."""
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = None
    meta = tomllib.loads(meta_toml.read_text(encoding="utf-8"))
    frame = Frame(meta)
    idx = np.array(Image.open(index_png), dtype=np.int64)
    colors_csv = index_png.parent / "province-colors.csv"
    with colors_csv.open(encoding="utf-8", newline="") as f:
        ids = [r["province_id"] for r in csv.DictReader(f)]
    with (config.DATA_DIR / region.csv).open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    by_id = {r["id"]: r for r in rows}
    places = _place_lookup(set(region.countries), sources)

    def owner(lon, lat):
        x, y = frame.pixel(lon, lat)
        best = None
        for d in range(SEARCH_PX + 1):
            for dy in range(-d, d + 1):
                for dx in range(-d, d + 1):
                    if max(abs(dx), abs(dy)) != d:
                        continue
                    yy = y + dy
                    if 0 <= yy < frame.h:
                        v = int(idx[yy, (x + dx) % frame.w])
                        if v and (best is None or (dx * dx + dy * dy, v) < best[0]):
                            best = ((dx * dx + dy * dy, v), v)
            if best:
                return ids[best[1] - 1]
        return ""

    def region_of(pid):
        r = by_id.get(pid)
        return (r["country"], r["region"]) if r else None

    def find(country, name, region=None):
        """The most populous same-named place; with `region`, only one landing in that CSV region
        (Manhattan, Kansas is not Manhattan; a part naming the region itself is skipped)."""
        for c in _candidates(name):
            if region is not None and c in (text.fold(region[1]), text.fold(country)):
                continue
            for hit in places.get((country, c), []):
                if region is None or region_of(owner(hit[1], hit[2])) == region:
                    return hit
        return None

    with (index_png.parent / "province-centroids.csv").open(encoding="utf-8", newline="") as f:
        cent = {r["province_id"]: r for r in csv.DictReader(f)}

    misses = []
    for r in rows:
        hit = find(r["country"], r["name"], (r["country"], r["region"]))
        if hit:
            got = owner(hit[1], hit[2])
            if got != r["id"]:
                misses.append({"kind": "own name", "province_id": r["id"], "place": hit[3],
                               "expected": r["id"], "got": got})
            elif r["metro"] and r["id"] in cent:
                c = cent[r["id"]]
                x, y = frame.pixel(hit[1], hit[2])
                dx = abs(x + 0.5 - float(c["x"]))
                dx = min(dx, frame.w - dx)
                dist = math.hypot(dx, y + 0.5 - float(c["y"]))
                radius = math.sqrt(max(int(c["area_px"]), 1) / math.pi)
                if dist > OFF_CENTRE_RADII * radius + 1:
                    misses.append({"kind": "off centre", "province_id": r["id"], "place": hit[3],
                                   "expected": f"within {OFF_CENTRE_RADII * radius + 1:.1f} px of the centroid",
                                   "got": f"{dist:.1f} px"})
        if r["metro"]:
            hit = find(r["country"], r["metro"])
            if hit:
                got = owner(hit[1], hit[2])
                if by_id.get(got, {}).get("metro") != r["metro"]:
                    misses.append({"kind": "metro", "province_id": r["id"], "place": hit[3],
                                   "expected": f"a {r['metro']} province", "got": got})
    with (config.DATA_DIR / "key-cities.csv").open(encoding="utf-8", newline="") as f:
        for k in csv.DictReader(f):
            if k["country"] not in region.countries:
                continue
            pids = k["province_ids"].split(";")
            hit = find(k["country"], k["city"])
            if hit:
                got = owner(hit[1], hit[2])
                if got not in pids:
                    misses.append({"kind": "key city", "province_id": ";".join(pids), "place": hit[3],
                                   "expected": "one of " + ", ".join(pids), "got": got})
    # one row per (kind, place, got); Metro rows repeat for each province of the Metro
    seen, out = set(), []
    for m in misses:
        key = (m["kind"], m["place"], m["got"], m["expected"] if m["kind"] != "own name" else m["province_id"])
        if key not in seen:
            seen.add(key)
            out.append(m)
    return out


if __name__ == "__main__":
    import sys

    reg = config.REGIONS[sys.argv[1]]
    d = Path(sys.argv[2])
    for m in check(reg, d / "province-index.png", d / "map-meta.toml", config.load_sources()):
        print(m)
