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
# Margin (pixels) around a province's box when testing its parts.
WATER_MARGIN_PX = 8
# Two parts are "across water" when a path of at most this many water pixels joins them (the
# Golden Gate between San Francisco and Marin); a wider sea or lake does not count.
WATER_GAP_PX = 3
# Kinds that are listed but are not anchor misses (a city part across a strait or a bay).
INFO_KINDS = {"city part across water", "city on the edge", "own name elsewhere (allowed)"}


def is_info(kind: str) -> bool:
    """A listed row, not a miss: an allowed kind, or one `[review.anchor_ok]` allows."""
    return kind in INFO_KINDS or kind.endswith("(allowed)")
# A province's own city whose pixel a neighbour took, with the province owning a pixel this
# close (8-neighbour), is on the edge, not off it (D679): a 5 km pixel can straddle a river.
EDGE_PX = 1


def _components(mask: np.ndarray) -> np.ndarray:
    """4-connected labels (1..n) of a boolean array; 0 outside the mask."""
    lab = np.zeros(mask.shape, dtype=np.int32)
    n = 0
    h, w = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        stack = [(y0, x0)]
        while stack:
            y, x = stack.pop()
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    stack.append((yy, xx))
    return lab


def city_part(idx: np.ndarray, v: int, cx: int, cy: int) -> str | None:
    """None when the pixel (cx, cy) of province `v` is in its largest 4-connected part, else
    "water" when that part joins the largest through water alone, else "land"."""
    ys, xs = np.nonzero(idx == v)
    if len(ys) == 0:
        return None
    h, w = idx.shape
    y0, y1 = max(int(ys.min()) - WATER_MARGIN_PX, 0), min(int(ys.max()) + WATER_MARGIN_PX, h - 1)
    x0, x1 = max(int(xs.min()) - WATER_MARGIN_PX, 0), min(int(xs.max()) + WATER_MARGIN_PX, w - 1)
    sub = idx[y0:y1 + 1, x0:x1 + 1]
    mine = sub == v
    lab = _components(mine)
    counts = np.bincount(lab.ravel())
    counts[0] = 0
    largest = int(np.argmax(counts))  # ties: the lowest label, the first part in row order
    here = int(lab[cy - y0, cx - x0])
    if here == 0 or here == largest:
        return None
    # breadth-first from the city's part through water pixels only, at most WATER_GAP_PX deep
    water = sub == 0
    hh, ww = sub.shape
    frontier = list(zip(*np.nonzero(lab == here)))
    seen = np.zeros(sub.shape, dtype=bool)
    for y, x in frontier:
        seen[y, x] = True
    for _ in range(WATER_GAP_PX + 1):
        nxt = []
        for y, x in frontier:
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if not (0 <= yy < hh and 0 <= xx < ww) or seen[yy, xx]:
                    continue
                if lab[yy, xx] == largest:
                    return "water"
                if water[yy, xx]:
                    seen[yy, xx] = True
                    nxt.append((yy, xx))
        frontier = nxt
    return "land"


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
    """Places by (game country, folded name); NE codes map to game codes (config.NE_CODES)."""
    game_of = {}
    for g in sorted(countries):
        for c in config.ne_codes(g):
            game_of.setdefault(c, g)
    pp = gpd.read_file(config.ne_path("ne_10m_populated_places.shp", sources),
                       columns=["NAME", "NAMEASCII", "ADM0_A3", "POP_MAX"])
    pp = pp[pp.ADM0_A3.isin(set(game_of))]
    out: dict[tuple[str, str], list] = {}
    for r in pp.itertuples():
        for n in sorted({r.NAME, r.NAMEASCII} - {None}):
            out.setdefault((game_of[r.ADM0_A3], text.fold(n)), []).append(
                (r.POP_MAX or 0, r.geometry.x, r.geometry.y, r.NAME))
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


def check(region: config.Region, index_png: Path, meta_toml: Path, sources: dict,
          anchor_ok: dict | None = None) -> list[dict]:
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
    # hints `[review.anchor_ok]`: own-name places elsewhere that are another town of the name
    anchor_ok = anchor_ok or {}

    last = {}

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
                d2 = best[0][0]
                # remember the pixel that answered, for the part check
                for dy in range(-d, d + 1):
                    for dx in range(-d, d + 1):
                        yy, xx = y + dy, (x + dx) % frame.w
                        if dx * dx + dy * dy == d2 and 0 <= yy < frame.h and int(idx[yy, xx]) == best[1]:
                            last["px"] = (xx, yy)
                            return ids[best[1] - 1]
                return ids[best[1] - 1]
        return ""

    def region_of(pid):
        r = by_id.get(pid)
        return (r["country"], r["region"]) if r else None

    # a province's whole name without generic words ("Basel City" -> basel), per region: a
    # neighbour's name part equal to it means that province's city ("Basel" in
    # "Basel-Landschaft" is Basel City's), so it is not the neighbour's own anchor (D679)
    core_of: dict[tuple, dict[str, str]] = {}
    for r in rows:
        core = " ".join(w for w in text.fold(r["name"]).split() if w not in GENERIC)
        core_of.setdefault((r["country"], r["region"]), {}).setdefault(core, r["id"])

    def find(country, name, region=None, pid=None):
        """The most populous same-named place; with `region`, only one landing in that CSV region
        (Manhattan, Kansas is not Manhattan). A part naming the region itself counts too (D689:
        "Sao Paulo" in Sao Paulo Centro must land on it), but only for a Metro province and only
        inside the region (Central New York is no New York City province)."""
        metro = bool(by_id.get(pid, {}).get("metro")) if pid is not None else True
        for c in _candidates(name):
            if region is not None and not metro and c in (text.fold(region[1]), text.fold(country)):
                continue
            if pid is not None and core_of.get(region, {}).get(c, pid) != pid:
                continue
            for hit in places.get((country, c), []):
                if region is None or region_of(owner(hit[1], hit[2])) == region:
                    return hit
        return None

    def find_elsewhere(country, name, region, pid):
        """With no same-named place in its own region: the country's most populous one, wherever
        it lands (D689; a part naming the region or the country is skipped here)."""
        for c in _candidates(name):
            if c in (text.fold(region[1]), text.fold(country)) or len(c) < 4:
                continue
            if core_of.get(region, {}).get(c, pid) != pid:
                continue
            hits = places.get((country, c), [])
            if hits:
                return hits[0]
        return None

    with (index_png.parent / "province-centroids.csv").open(encoding="utf-8", newline="") as f:
        cent = {r["province_id"]: r for r in csv.DictReader(f)}

    def on_edge(pid, lon, lat):
        """The province owns a pixel touching the place's pixel (a city on its province's edge)."""
        x, y = frame.pixel(lon, lat)
        v = ids.index(pid) + 1 if pid in ids else -1
        return any(0 <= y + dy < frame.h and int(idx[y + dy, (x + dx) % frame.w]) == v
                   for dy in (-EDGE_PX, 0, EDGE_PX) for dx in (-EDGE_PX, 0, EDGE_PX))

    misses = []
    for r in rows:
        hit = find(r["country"], r["name"], (r["country"], r["region"]), r["id"])
        if not hit:
            far = find_elsewhere(r["country"], r["name"], (r["country"], r["region"]), r["id"])
            if far:
                got = owner(far[1], far[2])
                if got != r["id"]:
                    why = anchor_ok.get(r["id"])
                    if not why and on_edge(r["id"], far[1], far[2]):
                        kind = "city on the edge"
                    else:
                        kind = "own name elsewhere (allowed)" if why else "own name elsewhere"
                    misses.append({"kind": kind,
                                   "province_id": r["id"], "place": far[3],
                                   "expected": r["id"] + (f" ({why})" if why else ""), "got": got})
        if hit:
            got = owner(hit[1], hit[2])
            if got != r["id"]:
                # a city on its province's edge (Omdurman at the Nile confluence) whose pixel the
                # neighbour took is listed, not a miss, when the province owns a touching pixel
                near = on_edge(r["id"], hit[1], hit[2])
                misses.append({"kind": "city on the edge" if near else "own name", "province_id": r["id"],
                               "place": hit[3], "expected": r["id"], "got": got})
            elif r["metro"] and r["id"] in cent:
                cx, cy = last["px"]
                part = city_part(idx, ids.index(r["id"]) + 1, cx, cy)
                if part == "land":
                    misses.append({"kind": "city not in largest part", "province_id": r["id"], "place": hit[3],
                                   "expected": "the largest 4-connected part", "got": "a smaller part"})
                elif part == "water":
                    misses.append({"kind": "city part across water", "province_id": r["id"], "place": hit[3],
                                   "expected": "the largest 4-connected part",
                                   "got": "a smaller part, joined to it across water only"})
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
            # a name two places share (Suzhou in Jiangsu and in Anhui), or a composite Metro
            # whose name part is not one of its provinces (Hsinchu-Taipei): any same-named
            # place of any name part landing on the Metro passes (D679)
            ok = any(by_id.get(owner(c[1], c[2]), {}).get("metro") == r["metro"]
                     for n in _candidates(r["metro"]) for c in places.get((r["country"], n), []))
            if hit and not ok:
                got = owner(hit[1], hit[2])
                if by_id.get(got, {}).get("metro") != r["metro"]:
                    misses.append({"kind": "metro", "province_id": r["id"], "place": hit[3],
                                   "expected": f"a {r['metro']} province", "got": got})
    with (config.DATA_DIR / "key-cities.csv").open(encoding="utf-8", newline="") as f:
        for k in csv.DictReader(f):
            pids = k["province_ids"].split(";")
            # a key city of another region file (Russia's are in two) is checked with that file
            if k["country"] not in region.countries or not all(p in by_id for p in pids):
                continue
            hit = find(k["country"], k["city"])
            if hit:
                got = owner(hit[1], hit[2])
                if got not in pids:
                    misses.append({"kind": "key city", "province_id": ";".join(pids), "place": hit[3],
                                   "expected": "one of " + ", ".join(pids), "got": got})
    # one row per (kind, place, got); Metro rows repeat for each province of the Metro
    seen, out = set(), []
    for m in misses:
        why = anchor_ok.get(m["province_id"])
        if why and not is_info(m["kind"]):
            # a province whose file shape explains the miss (FR-0004 is two departments apart)
            m = {**m, "kind": m["kind"] + " (allowed)", "expected": f"{m['expected']} ({why})"}
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
