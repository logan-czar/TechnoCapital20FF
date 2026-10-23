"""P3: the region and province crosswalks (map-sources.md pipeline step 3; m8-map-assets.md).

Regions match Natural Earth admin-1 units by folded name within the country (aliases from the
hints file); a region named like its country is the whole country. Provinces of a region with
one province are that region (method admin1). The provinces of a multi-province region are
built from building blocks: NE admin-1 units when the region is a whole country, else the
country's geoBoundaries ADM2 units when their license passes P2, else nothing (Voronoi on the
region). Each province gets seed points from its name and notes (D603): building blocks named
in the text, Natural Earth populated places in the region, the Metro's core city moved by the
name's direction words, or the region's part in that direction. A block holding one province's
seeds goes to that province; a block holding several is split by Voronoi among their seeds; an
empty block goes to the province with the nearest seed. Confidence comes from the best seed
(D604); rows under FLAG_BELOW go to the QA report for Logan.
"""

from __future__ import annotations

import csv
import json
import math
import re
import tomllib
from collections import defaultdict
from dataclasses import dataclass, field

import geopandas as gpd
import shapely
import shapely.ops
from rapidfuzz import fuzz
from shapely.geometry import Point, box

from . import config, fetch, licenses, text

# D604: crosswalk rows below this confidence are listed for Logan's review.
FLAG_BELOW = 0.6

# D604: seed quality by how the seed was found.
Q_HINT = 0.85
Q_BLOCK_NAME = 0.9
Q_BLOCK_NOTE = 0.75
Q_PLACE_NAME = 0.8
Q_PLACE_NOTE = 0.65
Q_METRO_DIR = 0.5
Q_REGION_DIR = 0.45
Q_NONE = 0.1
# Region name match: fuzzy ratio (0-100) needed to accept an admin-1 unit.
REGION_MATCH_MIN = 88
# A Metro province with a direction word sits this far from the Metro's core city (degrees).
METRO_OFFSET_DEG = 0.2
# Populated places this far outside a region polygon (degrees) still count (coastal points).
PLACE_BUFFER_DEG = 0.05
# Gazetteer names shorter than this are ignored unless they are a whole name part.
MIN_NAME_LEN = 4
# Building blocks are simplified to this tolerance (degrees, about 50 m) when loaded (D610).
BLOCK_SIMPLIFY_DEG = 0.0005

NE_A1_COLS = ["name", "name_alt", "name_en", "woe_name", "gn_name", "adm0_a3", "iso_3166_2", "adm1_code"]
NE_A0_COLS = ["ADMIN", "NAME", "NAME_LONG", "ADM0_A3", "SOV_A3"]
NE_PP_COLS = ["NAME", "NAMEASCII", "NAMEALT", "ADM0_A3", "POP_MAX", "FEATURECLA"]


@dataclass
class Seed:
    x: float
    y: float
    quality: float
    label: str
    unit: str | None = None  # set when the seed is a named building block
    home: str | None = None  # the block the seed claims (set by assign_blocks)


@dataclass
class ProvinceRow:
    id: str
    name: str
    country: str
    region: str
    metro: str
    notes: str
    coastal: str
    seeds: list[Seed] = field(default_factory=list)


def read_provinces(region: config.Region) -> list[ProvinceRow]:
    with (config.DATA_DIR / region.csv).open(encoding="utf-8", newline="") as f:
        return [
            ProvinceRow(r["id"], r["name"], r["country"], r["region"], r["metro"], r["notes"], r["coastal"])
            for r in csv.DictReader(f)
        ]


def load_hints(region: config.Region) -> dict:
    p = config.PIPELINE_DIR / "hints" / f"{region.slug}.toml"
    if not p.exists():
        return {}
    with p.open("rb") as f:
        return tomllib.load(f)


def _scale(lat: float) -> float:
    return max(math.cos(math.radians(lat)), 0.2)


def _dist2(ax, ay, bx, by, k) -> float:
    return ((ax - bx) * k) ** 2 + (ay - by) ** 2


def _a1_names(row) -> list[str]:
    names = []
    for c in ("name", "name_en", "woe_name", "gn_name"):
        v = row.get(c)
        if isinstance(v, str) and v:
            names.append(text.fold(v))
    alt = row.get("name_alt")
    if isinstance(alt, str):
        names += [text.fold(a) for a in alt.split("|") if a]
    return names


def match_regions(provs, a1, a0, hints):
    """Return {region_key: dict(geometry, source_ids, confidence, note, whole_country)}."""
    aliases = hints.get("regions", {})
    out = {}
    keys = sorted({(p.country, p.region) for p in provs})
    for country, region in keys:
        key = f"{country}:{region}"
        cand = a1[a1.adm0_a3 == country]
        f = text.fold(region)
        if key in aliases:
            codes = aliases[key] if isinstance(aliases[key], list) else [aliases[key]]
            rows = cand[cand.iso_3166_2.isin(codes)]
            if len(rows) != len(codes):
                raise SystemExit(f"crosswalk: hint alias {key} -> {codes} does not match NE admin-1")
            out[key] = dict(rows=rows, confidence=0.95, note=f"alias hint -> {', '.join(codes)}", whole=False)
            continue
        best, best_score = None, 0.0
        for idx, row in cand.iterrows():
            for n in _a1_names(row):
                s = fuzz.ratio(f, n)
                if s > best_score:
                    best, best_score = idx, s
        a0row = a0[a0.ADM0_A3 == country]
        country_names = {text.fold(v) for v in a0row[["ADMIN", "NAME", "NAME_LONG"]].values.ravel() if isinstance(v, str)}
        if best is not None and best_score >= REGION_MATCH_MIN:
            out[key] = dict(rows=cand.loc[[best]], confidence=round(best_score / 100, 2),
                            note=f"name match {best_score:.0f}", whole=False)
        elif f in country_names or len(cand) == 0:
            if len(cand) == 0:
                out[key] = dict(rows=None, a0=a0row, confidence=0.95, note="whole country (Natural Earth admin-0; no admin-1 units)", whole=True)
            else:
                out[key] = dict(rows=cand, confidence=0.95, note=f"whole country ({len(cand)} admin-1 units)", whole=True)
        else:
            out[key] = dict(rows=None, confidence=0.0, note=f"no admin-1 match (best {best_score:.0f})", whole=False)
    for key, m in out.items():
        if m["rows"] is not None:
            m["geometry"] = shapely.make_valid(shapely.union_all(m["rows"].geometry.values))
            m["source_ids"] = ";".join(m["rows"].adm1_code.tolist())
        elif m.get("a0") is not None and len(m["a0"]):
            m["geometry"] = shapely.make_valid(shapely.union_all(m["a0"].geometry.values))
            m["source_ids"] = ";".join(m["a0"].ADM0_A3.tolist())
        else:
            m["geometry"] = None
            m["source_ids"] = ""
    return out


def load_blocks(country: str, sources: dict):
    """The country's ADM2 building blocks if their license passes P2, else None."""
    for b in sources["geoboundaries"]["boundary"]:
        if b["iso"] != country or b["level"] != "ADM2":
            continue
        meta = fetch.gb_meta(country, "ADM2", sources)
        ok, why = licenses.classify_meta(meta)
        if not ok:
            return None, meta, why
        path = config.gb_dir(country, "ADM2", sources) / f"geoBoundaries-{country}-ADM2.geojson"
        g = gpd.read_file(path)[["shapeName", "shapeID", "geometry"]]
        # D610: simplify to a tenth of a pixel first; StatCan coastlines carry up to 294,000
        # vertices per unit, which made every overlay test slow
        g["geometry"] = shapely.make_valid(shapely.simplify(g.geometry.values, BLOCK_SIMPLIFY_DEG))
        return g, meta, why
    return None, None, "not pinned"


# Generic words stripped from the end or start of building-block names before matching.
_UNIT_WORDS = {"county", "parish", "borough", "municipality", "municipio", "kommune", "kommunia",
               "kommuneqarfik", "district", "census area", "city and borough"}
# Words in a notes phrase that say the phrase names admin units.
_ADMIN_WORDS = ("county", "counties", "parish", "parishes", "borough", "municipio", "municipality")


def unit_aliases(name: str) -> list[str]:
    """Folded match names for a building block or place: the name, without generic unit words,
    and the head of a Spanish `X de Y` name (Naucalpan de Juarez -> naucalpan)."""
    f = text.fold(name)
    out = [f]
    # composite names: each "--" or " / " part is a name too (the English and French halves,
    # the towns of an economic region); a trailing "*" marks a truncated name
    pieces = re.split(r"--| / ", name.replace("*", ""))
    if len(pieces) > 1:
        for piece in pieces:
            fp = text.fold(piece)
            if len(fp) >= 5 and fp not in text.STOPWORDS:
                out.append(fp)
    words = f.split()
    core = [w for w in words if w not in _UNIT_WORDS]
    if core and core != words:
        out.append(" ".join(core))
    for base in list(out):
        if " de " in base:
            head = base.split(" de ", 1)[0]
            if len(head) >= 5 and head not in text.STOPWORDS:
                out.append(head)
    return list(dict.fromkeys(out))


class Gazetteer:
    """Named points and building blocks inside one region."""

    def __init__(self, places, blocks, exclude: set[str], notes_need_place: bool):
        self.exclude = exclude
        self.places_all = places  # (folded, x, y, pop, label)
        self.places = [p for p in places if p[0] not in exclude]
        self.blocks = blocks  # GeoDataFrame or None: unit_id, name, aliases, rx, ry
        self.notes_need_place = notes_need_place
        self._place_names = {p[0] for p in self.places}
        # name parts that may be the region's own name used as a city: the first part of the
        # name (Chihuahua-Sierra) or one ending in City (Quebec City); set per province
        self.city_parts: set[str] = set()

    def _usable(self, fname: str, whole_parts: set[str], ph: str = "", from_name: bool = False) -> bool:
        if not fname or fname in text.STOPWORDS:
            return False
        # The region's own name (Iowa in "Western Iowa", Quebec in the notes) is no seed, unless
        # a whole name part is that name as a city ("Quebec City", "Chihuahua-Sierra").
        if fname in self.exclude and not (
            from_name and ph in self.city_parts and ph in (fname, fname + " city", "city of " + fname)
        ):
            return False
        return len(fname) >= MIN_NAME_LEN or fname in whole_parts

    def _place_inside(self, fname: str, geom) -> bool:
        return any(p[0] == fname and geom.covers(Point(p[1], p[2])) for p in self.places)

    def find(self, phrases: list[str], whole_parts: set[str], from_name: bool):
        """Matches as (kind, folded name, payload, phrase). Longest name wins inside a phrase.
        Building-block names may also contain a whole name part (Kujalleq in Kommune Kujalleq)."""
        found = []
        # notes that say they list counties ("Bucks, Montgomery, Chester and Delaware counties")
        admin_notes = any(w in text.contains_any_word(ph) for ph in phrases for w in _ADMIN_WORDS)
        for ph in phrases:
            hits = []
            for fname, x, y, pop, label in self.places_all:
                if not self._usable(fname, whole_parts, ph, from_name):
                    continue
                if text.contains_word(ph, fname):
                    hits.append(("place", fname, (x, y, pop, label), ph))
            if self.blocks is not None:
                for r in self.blocks.itertuples():
                    for fname in r.aliases:
                        if not self._usable(fname, whole_parts, ph, from_name):
                            continue
                        rev = (
                            from_name and len(ph) >= 6 and ph not in text.STOPWORDS
                            and ph not in self.exclude and text.contains_word(fname, ph)
                        )
                        if not (text.contains_word(ph, fname) or rev):
                            continue
                        # a name shared with a populated place means the place, unless it is inside
                        if fname in self._place_names and not self._place_inside(fname, r.geometry):
                            continue
                        if (
                            not from_name and self.notes_need_place
                            and not self._place_inside(fname, r.geometry) and not admin_notes
                        ):
                            continue
                        hits.append(("block", fname, r, ph))
                        break
            # drop a hit whose name is a word-part of a longer hit in the same phrase
            names = {h[1] for h in hits}
            for h in hits:
                if any(o != h[1] and text.contains_word(o, h[1]) for o in names):
                    continue
                found.append(h)
            # fuzzy fallback on whole name parts only (spelling and accent variants)
            if not hits and from_name and len(ph) >= 5 and ph not in self.exclude:
                best = None
                for fname, x, y, pop, label in self.places_all:
                    if not self._usable(fname, whole_parts, ph, from_name):
                        continue
                    sc = fuzz.ratio(ph, fname)
                    if sc >= 90 and (best is None or sc > best[0]):
                        best = (sc, ("place", fname, (x, y, pop, label), ph))
                if best:
                    found.append(best[1])
        return found


def _direction_point(geom, vec):
    """A point inside `geom` in the part `vec` points to (the representative point for (0, 0))."""
    if vec == (0.0, 0.0):
        p = geom.representative_point()
        return p.x, p.y
    minx, miny, maxx, maxy = geom.bounds
    w, h = maxx - minx, maxy - miny
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    # the outer third of the bounding box in that direction
    bx = box(cx + vec[0] * w / 3 - w / 3, cy + vec[1] * h / 3 - h / 3,
             cx + vec[0] * w / 3 + w / 3, cy + vec[1] * h / 3 + h / 3)
    part = geom.intersection(bx)
    if part.is_empty:
        part = geom
    p = part.representative_point()
    return p.x, p.y


def _avg_dir(dirs):
    if not dirs:
        return None
    x = sum(d[0] for d in dirs)
    y = sum(d[1] for d in dirs)
    n = math.hypot(x, y)
    return (0.0, 0.0) if n < 1e-9 else (x / n, y / n)


def make_seeds(p: ProvinceRow, gaz: Gazetteer, region_geom, metro_core, hint: dict | None):
    seeds: list[Seed] = []
    notes = []
    if hint:
        for name in hint.get("units", []):
            if gaz.blocks is None:
                raise SystemExit(f"crosswalk: hint for {p.id} names units but the region has no blocks")
            m = gaz.blocks[[text.fold(name) in a for a in gaz.blocks.aliases]]
            if len(m) == 0:
                raise SystemExit(f"crosswalk: hint unit {name!r} for {p.id} matches no block in {p.region}")
            for _, r in m.iterrows():  # a county and a same-named independent city are both meant
                seeds.append(Seed(r.rx, r.ry, Q_HINT, f"unit {r['name']} (hint)", r.unit_id))
        for name in hint.get("places", []):
            fn = text.fold(name)
            cands = [pl for pl in gaz.places if pl[0] == fn]
            if not cands:
                raise SystemExit(f"crosswalk: hint place {name!r} for {p.id} is not a populated place in {p.region}")
            x, y, pop, label = max(cands, key=lambda c: c[3])[1:]
            seeds.append(Seed(x, y, Q_HINT, f"place {label} (hint)"))
        for lon, lat in hint.get("seeds", []):
            seeds.append(Seed(float(lon), float(lat), Q_HINT, f"point {lon},{lat} (hint)"))
        if hint.get("note"):
            notes.append(hint["note"])
        if seeds and not hint.get("add", False):
            return seeds, notes
    parts = text.name_parts(p.name)
    whole = set(parts)
    gaz.city_parts = {parts[1] if len(parts) > 1 else parts[0]} | {x for x in parts if x.endswith(" city")}
    hits = [(h, True) for h in gaz.find(parts, whole, True)]
    hits += [(h, False) for h in gaz.find(text.note_phrases(p.notes), whole, False)]
    named = []
    for (kind, fname, payload, ph), in_name in hits:
        if kind == "place":
            named.append((payload[3], payload[0], payload[1]))
        if kind == "place":
            x, y, pop, label = payload
            q = Q_PLACE_NAME if in_name else Q_PLACE_NOTE
            seeds.append(Seed(x, y, q, f"place {label}"))
        else:
            q = Q_BLOCK_NAME if in_name else Q_BLOCK_NOTE
            seeds.append(Seed(payload.rx, payload.ry, q, f"unit {payload.name}", payload.unit_id))
    p.named_places = named
    # one seed per distinct location and unit
    uniq, seen = [], set()
    for s in sorted(seeds, key=lambda s: -s.quality):
        k = (round(s.x, 4), round(s.y, 4), s.unit)
        if k not in seen:
            seen.add(k)
            uniq.append(s)
    seeds = uniq
    if not seeds:
        dirs = text.directions(p.name)
        vec = _avg_dir(dirs)
        if metro_core is not None:
            vec = vec or (0.0, 0.0)
            k = _scale(metro_core[1])
            x = metro_core[0] + vec[0] * METRO_OFFSET_DEG / k
            y = metro_core[1] + vec[1] * METRO_OFFSET_DEG
            seeds.append(Seed(x, y, Q_METRO_DIR, f"metro core {metro_core[2]} moved {vec[0]:+.2f},{vec[1]:+.2f}"))
        elif vec is not None:
            x, y = _direction_point(region_geom, vec)
            seeds.append(Seed(x, y, Q_REGION_DIR, f"region part {vec[0]:+.2f},{vec[1]:+.2f}"))
        else:
            rp = region_geom.representative_point()
            seeds.append(Seed(rp.x, rp.y, Q_NONE, "no match: region representative point"))
    return seeds, notes


def dedupe_seeds(provs: list[ProvinceRow]) -> None:
    """A point two provinces both found (a note naming the neighbour's city) stays with the province
    that found it with the higher quality (ties to the lower id, D2); the other drops it, unless it
    is that province's only seed."""
    owner: dict[tuple, tuple[float, str]] = {}
    for p in sorted(provs, key=lambda p: p.id):
        for s in p.seeds:
            k = (round(s.x, 4), round(s.y, 4))
            cur = owner.get(k)
            if cur is None or s.quality > cur[0]:
                owner[k] = (s.quality, p.id)
    for p in provs:
        kept = [s for s in p.seeds if owner[(round(s.x, 4), round(s.y, 4))][1] == p.id]
        if kept:
            p.seeds = kept


def assign_blocks(provs: list[ProvinceRow], blocks, by_geometry: bool):
    """Return ({province: [unit ids]}, {unit id: [province ids]} for split units).

    A block with one province's seeds goes to it, one with several is split among them, an empty
    one goes to the province with the nearest seed: nearest to the block's representative point
    (admin units) or to the block itself (`by_geometry`, the polygon parts of a Voronoi region,
    so an island goes to the closest seed)."""
    sindex = blocks.sindex
    claims: dict[str, set[str]] = defaultdict(set)
    for p in provs:
        for s in p.seeds:
            if s.unit:
                s.home = s.unit
            else:
                pt = Point(s.x, s.y)
                hit = sorted(sindex.query(pt, predicate="within"))
                if hit:
                    s.home = blocks.iloc[hit[0]].unit_id
                else:
                    # a seed just off the coast (Kingston sits 0.02 degrees offshore) claims the
                    # nearest block, at the nearest point of it
                    i = min(range(len(blocks)), key=lambda i: (blocks.iloc[i].geometry.distance(pt), i))
                    g = blocks.iloc[i].geometry
                    near = shapely.ops.nearest_points(g, pt)[0]
                    s.x, s.y = near.x, near.y
                    s.home = blocks.iloc[i].unit_id
                    s.label += " (snapped to land)"
            claims[s.home].add(p.id)
    whole: dict[str, list[str]] = defaultdict(list)
    split: dict[str, list[str]] = {}
    all_seeds = [(s.x, s.y, p.id) for p in provs for s in p.seeds]
    for r in blocks.itertuples():
        owners = claims.get(r.unit_id, set())
        if len(owners) == 1:
            whole[next(iter(owners))].append(r.unit_id)
        elif len(owners) > 1:
            split[r.unit_id] = sorted(owners)
        elif by_geometry:
            best = min(all_seeds, key=lambda t: (r.geometry.distance(Point(t[0], t[1])), t[2]))
            whole[best[2]].append(r.unit_id)
        else:
            k = _scale(r.ry)
            best = min(all_seeds, key=lambda t: (_dist2(r.rx, r.ry, t[0], t[1], k), t[2]))
            whole[best[2]].append(r.unit_id)
    # a province left with nothing (its seeds sit outside every block): split the block nearest
    # its best seed with that block's owner
    owned = set(whole) | {pid for v in split.values() for pid in v}
    for p in provs:
        if p.id in owned:
            continue
        s = max(p.seeds, key=lambda s: s.quality)
        i = min(range(len(blocks)), key=lambda i: blocks.iloc[i].geometry.distance(Point(s.x, s.y)))
        uid = blocks.iloc[i].unit_id
        prev = [pid for pid, us in whole.items() if uid in us]
        for pid in prev:
            whole[pid].remove(uid)
        split[uid] = sorted(set(split.get(uid, [])) | set(prev) | {p.id})
    return dict(whole), split


def _parts(geom):
    return list(geom.geoms) if hasattr(geom, "geoms") else [geom]


def run(region: config.Region) -> None:
    sources = config.load_sources()
    hints = load_hints(region)
    provs = read_provinces(region)
    a1 = gpd.read_file(config.ne_path("ne_10m_admin_1_states_provinces_lakes.shp", sources), columns=NE_A1_COLS)
    a1 = a1[a1.adm0_a3.isin(region.countries)].copy()
    a1["geometry"] = shapely.make_valid(a1.geometry.values)
    a0 = gpd.read_file(config.ne_path("ne_10m_admin_0_countries.shp", sources), columns=NE_A0_COLS)
    a0 = a0[a0.ADM0_A3.isin(region.countries)].copy()
    pp = gpd.read_file(config.ne_path("ne_10m_populated_places.shp", sources), columns=NE_PP_COLS)
    pp = pp[pp.ADM0_A3.isin(region.countries)].copy()
    notes_need_place = set(hints.get("blocks", {}).get("notes_need_place", []))

    regions = match_regions(provs, a1, a0, hints)
    by_region: dict[str, list[ProvinceRow]] = defaultdict(list)
    for p in provs:
        by_region[f"{p.country}:{p.region}"].append(p)

    blocks_by_country, meta_by_country = {}, {}
    for c in region.countries:
        g, meta, why = load_blocks(c, sources)
        blocks_by_country[c] = g
        meta_by_country[c] = (meta, why)
        print(f"  {c}: ADM2 blocks {'used' if g is not None else 'not used'} ({why})")

    out_dir = config.ASSETS_DIR / "crosswalk"
    out_dir.mkdir(parents=True, exist_ok=True)
    work = config.work_dir(region.slug, sources)
    for old in work.glob("blocks-*.geojson"):
        old.unlink()
    region_rows, province_rows, plan = [], [], {"regions": {}}
    region_features = []
    hint_provs = hints.get("provinces", {})

    for key in sorted(regions):
        m = regions[key]
        country, rname = key.split(":", 1)
        members = sorted(by_region[key], key=lambda p: p.id)
        geom = m["geometry"]
        region_rows.append(dict(country=country, region=rname, method="admin1", source_ids=m["source_ids"],
                                confidence=m["confidence"], provenance=licenses.NE_PROVENANCE, note=m["note"]))
        if geom is None:
            for p in members:
                province_rows.append(dict(province_id=p.id, name=p.name, country=p.country, region=p.region,
                                          method="voronoi", source_ids="", confidence=0.0,
                                          provenance="", note="region has no shape"))
            continue
        region_features.append({"region_key": key, "country": country, "geometry": geom})
        rplan = {"country": country, "level": None, "provinces": {}}
        plan["regions"][key] = rplan
        if len(members) == 1:
            p = members[0]
            province_rows.append(dict(province_id=p.id, name=p.name, country=p.country, region=p.region,
                                      method="admin1", source_ids=m["source_ids"], confidence=m["confidence"],
                                      provenance=licenses.NE_PROVENANCE, note=f"whole region ({m['note']})"))
            rplan["level"] = "region"
            rplan["provinces"][p.id] = {"whole": ["region"], "split": {}}
            continue

        # building blocks for this region
        if m["whole"] and m["rows"] is not None and len(m["rows"]) > 1:
            b = m["rows"][["adm1_code", "name", "geometry"]].rename(columns={"adm1_code": "unit_id"})
            level, prov_str = "admin1", licenses.NE_PROVENANCE
        elif blocks_by_country.get(country) is not None:
            allb = blocks_by_country[country]
            rp = allb.geometry.representative_point()
            inside = rp.within(geom.buffer(0.01))
            b = allb[inside][["shapeID", "shapeName", "geometry"]].rename(
                columns={"shapeID": "unit_id", "shapeName": "name"})
            level = "admin2"
            prov_str = licenses.provenance(meta_by_country[country][0]) + "; " + licenses.NE_PROVENANCE
        else:
            parts = _parts(geom)
            b = gpd.GeoDataFrame({"unit_id": [f"part-{i}" for i in range(len(parts))],
                                  "name": ["" for _ in parts]}, geometry=parts, crs="EPSG:4326")
            level, prov_str = "voronoi", licenses.NE_PROVENANCE
        b = b.reset_index(drop=True).copy()
        b["aliases"] = [unit_aliases(n) if n else [] for n in b["name"]]
        rpts = b.geometry.representative_point()
        b["rx"], b["ry"] = rpts.x.values, rpts.y.values
        # places in the region
        sel = pp[pp.geometry.within(geom.buffer(PLACE_BUFFER_DEG))]
        places = []
        for r in sel.itertuples():
            names = {r.NAME, r.NAMEASCII} | set((r.NAMEALT or "").split("|"))
            for n in sorted(n for n in names if isinstance(n, str)):
                if isinstance(n, str) and n.strip():
                    places.append((text.fold(n), r.geometry.x, r.geometry.y, r.POP_MAX or 0, r.NAME))
        exclude = {text.fold(rname), text.fold(country)}
        exclude |= {text.fold(v) for v in a0[a0.ADM0_A3 == country][["ADMIN", "NAME"]].values.ravel()
                    if isinstance(v, str)}
        gaz = Gazetteer(places, b, exclude, country in notes_need_place)
        for p in members:
            core = None
            if p.metro:
                fm = text.fold(p.metro)
                cands = [pl for pl in places if text.contains_word(fm, pl[0]) and pl[0] not in text.STOPWORDS]
                if cands:
                    _, x, y, pop, label = max(cands, key=lambda c: (len(c[0]), c[3]))
                    core = (x, y, label)
            p.seeds, extra = make_seeds(p, gaz, geom, core, hint_provs.get(p.id))
            p.extra_notes = extra
        dedupe_seeds(members)
        rplan["level"] = level
        whole, split = assign_blocks(members, b, by_geometry=(level == "voronoi"))
        for p in members:
            sp = {}
            for uid, owners in split.items():
                if p.id in owners:
                    pts = [[s.x, s.y] for s in p.seeds if s.home == uid]
                    if not pts:  # the province won the split by fallback: use its best seed
                        s = max(p.seeds, key=lambda s: s.quality)
                        pts = [[s.x, s.y]]
                    sp[uid] = pts
            rplan["provinces"][p.id] = {"whole": whole.get(p.id, []), "split": sp,
                                        "named_places": getattr(p, "named_places", [])}
        bf = f"blocks-{_slug(key)}.geojson"
        b[["unit_id", "name", "geometry"]].assign(region_key=key).to_file(work / bf, driver="GeoJSON")
        rplan["blocks_file"] = bf
        names = dict(zip(b.unit_id, b.name))
        for p in members:
            pr = rplan["provinces"][p.id]
            conf = max(s.quality for s in p.seeds)
            method = "voronoi" if (pr["split"] or level == "voronoi") else level
            ids = [m["source_ids"]] if level == "voronoi" else pr["whole"] + list(pr["split"])
            note = "seeds: " + "; ".join(sorted({s.label for s in p.seeds}))
            if level == "voronoi":
                note += f"; {len(pr['whole'])} whole parts" + (f", {len(pr['split'])} split" if pr["split"] else "")
            else:
                note += f"; {len(pr['whole'])} whole {level} units"
                if pr["split"]:
                    note += f", split: {', '.join(names.get(u) or u for u in pr['split'])}"
            if getattr(p, "extra_notes", None):
                note += "; " + "; ".join(p.extra_notes)
            province_rows.append(dict(province_id=p.id, name=p.name, country=p.country, region=p.region,
                                      method=method, source_ids=";".join(ids), confidence=round(conf, 2),
                                      provenance=prov_str, note=note))

    _write_csv(out_dir / "region_crosswalk.csv", region_rows,
               ["country", "region", "method", "source_ids", "confidence", "provenance", "note"],
               merge_key=("country", "region"), countries=set(region.countries))
    _write_csv(out_dir / "province_crosswalk.csv", province_rows,
               ["province_id", "name", "country", "region", "method", "source_ids", "confidence", "provenance", "note"],
               merge_key=("province_id",), countries=set(region.countries))
    gpd.GeoDataFrame(region_features, crs="EPSG:4326").to_file(work / "regions.geojson", driver="GeoJSON")
    (work / "plan.json").write_text(json.dumps(plan, indent=1), encoding="utf-8")
    flagged = sum(1 for r in province_rows if r["confidence"] < FLAG_BELOW)
    by_method = defaultdict(int)
    for r in province_rows:
        by_method[r["method"]] += 1
    print(f"  {len(region_rows)} regions, {len(province_rows)} provinces {dict(by_method)}, {flagged} flagged")


def _slug(key: str) -> str:
    return text.fold(key).replace(" ", "-")


def _write_csv(path, rows, cols, merge_key, countries):
    """Write rows, keeping other regions' rows already in the file (one file for the world)."""
    keep = []
    if path.exists():
        with path.open(encoding="utf-8", newline="") as f:
            keep = [r for r in csv.DictReader(f) if r["country"] not in countries]
    allrows = keep + rows
    allrows.sort(key=lambda r: tuple(str(r[k]) for k in merge_key))
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        for r in allrows:
            w.writerow({k: r[k] for k in cols})
