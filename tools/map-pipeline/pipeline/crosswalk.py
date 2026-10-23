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
import shapely.affinity
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
# A Metro province is compact: an admin unit its notes name only as a word (no populated place
# of that name inside it, and the notes do not say "county") whose point lies further than this
# (degrees) from the Metro's core city is not one of its seeds: "tequila trade" in Guadalajara
# Centro's notes is the drink, not the municipality of Tequila 50 km away (D612). Places the
# notes name (Flagstaff for Phoenix-Central) still count.
METRO_NOTES_DEG = 0.35
# "Touching" for that rule (D612): within this many degrees (about 3 km), so a unit across a
# narrow strait still counts (Marin across the Golden Gate from San Francisco).
METRO_TOUCH_DEG = 0.03
# Populated places this far outside a region polygon (degrees) still count (coastal points).
PLACE_BUFFER_DEG = 0.05
# Gazetteer names shorter than this are ignored unless they are a whole name part.
MIN_NAME_LEN = 4
# Building blocks are simplified to this tolerance (degrees, about 50 m) when loaded (D610).
BLOCK_SIMPLIFY_DEG = 0.0005

NE_A1_COLS = ["name", "name_alt", "name_en", "woe_name", "gn_name", "adm0_a3", "iso_3166_2", "adm1_code", "region"]
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
    at_rep: bool = False  # a block seed at the block's representative point (no place to anchor it)


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


# D673: how a region was matched, most specific first. A Natural Earth unit two regions claim
# goes to the more specific match (Northern Cyprus's own unit beats the whole of Cyprus).
SPECIFIC = {"alias": 4, "unit": 3, "group": 2, "parts": 2, "whole": 1, "none": 0, "carve": 0}
# An admin-1 unit no region claimed joins the region of its country that it touches (within
# this many degrees) along the longest edge (D673); one touching none is listed as land
# without a province.
GAP_TOUCH_DEG = 0.05
# An unclaimed island unit touching no region joins the nearest region of its country within
# this many degrees (Solomon Islands' Makira and Temotu); further ones (overseas departments)
# stay land without a province.
GAP_NEAR_DEG = 6.0


def _resolve_alias(a1_all, codes, cand):
    """Rows for an alias hint: iso_3166_2 or adm1_code values (any country, so contested land
    can be drawn from a neighbour's unit), `region:<NE region>` for a group within `cand`, or
    `name:<NE unit name>` for a unit of `cand` by its folded name."""
    idx = []
    drop = set(_resolve_alias(a1_all, [c[1:] for c in codes if c.startswith("-")], cand)) \
        if any(c.startswith("-") for c in codes) else set()
    for code in codes:
        if code.startswith("-"):
            continue  # `-<code>` leaves a unit out of a group named here (Riga out of Pieriga)
        if code.startswith("region:"):
            m = cand[cand.region == code[len("region:"):]]
            if len(m) == 0:
                raise SystemExit(f"crosswalk: alias {code!r} matches no Natural Earth region group")
        elif code.startswith("name:"):
            f = text.fold(code[len("name:"):])
            m = cand[[f in _a1_names(r) for _, r in cand.iterrows()]]
            if len(m) != 1:
                raise SystemExit(f"crosswalk: alias {code!r} matches {len(m)} Natural Earth admin-1 units")
        else:
            m = a1_all[a1_all.adm1_code == code]
            if len(m) == 0:
                m = a1_all[a1_all.iso_3166_2 == code]
            if len(m) != 1:
                raise SystemExit(f"crosswalk: alias code {code!r} matches {len(m)} Natural Earth admin-1 units "
                                 "(use the unit's adm1_code)")
        idx += list(m.index)
    return [i for i in idx if i not in drop]


def _best_unit(f, cand):
    """The unit whose name best matches `f`; a tie goes to a main name over an alternate one
    (Shaanxi's alternate spelling Shanxi must not beat Shanxi itself)."""
    best, best_key = None, (0.0, 0)
    for idx, row in cand.iterrows():
        n_main = sum(1 for c in ("name", "name_en", "woe_name", "gn_name") if isinstance(row.get(c), str) and row.get(c))
        for k, n in enumerate(_a1_names(row)):
            key = (max(fuzz.ratio(f, n), fuzz.ratio(_core(f), _core(n))), 1 if k < n_main else 0)
            if key > best_key:
                best, best_key = idx, key
    return best, best_key[0]


_REGION_WORDS = {"region", "province", "provinces", "oblast", "state", "governorate", "district",
                 "prefecture", "division", "municipality", "autonomous", "special", "administrative"}


def _core(f: str) -> str:
    """A folded admin name without generic words ("Calabarzon" for "CALABARZON (Region IV-A)")."""
    words = [w for w in f.split() if w not in _REGION_WORDS]
    return " ".join(words) or f


def _group_name(g: str) -> str:
    return text.fold(re.sub(r"\(.*?\)", " ", g))


def _group_size(g, cand) -> int:
    return 0 if g is None else int((cand.region == g).sum())


def _best_group(f, cand):
    best, best_score = None, 0.0
    for g in sorted({g for g in cand.region if isinstance(g, str) and g}):
        gf = _group_name(g)
        s = max(fuzz.ratio(f, gf), fuzz.ratio(_core(f), _core(gf)))
        if s > best_score:
            best, best_score = g, s
    return best, best_score


def _match_parts(name, cand):
    """A composite region name ("Tamil Nadu-Puducherry", "Shida Kartli-Mtskheta-Mtianeti-...")
    as a cover of its parts by admin-1 units or NE region groups, fewest pieces first.
    Returns (pieces, unit indices, worst score) or None."""
    pieces = [p for p in re.split(r"-| and |/|, ", name) if p.strip()]
    if len(pieces) < 2:
        return None
    n = len(pieces)
    memo: dict[int, tuple | None] = {}

    def cover(i):
        if i == n:
            return (0, [], 100.0)
        if i in memo:
            return memo[i]
        best = None
        for j in range(n, i, -1):
            if i == 0 and j == n:
                continue  # the whole name was tried already
            for joiner in ("-", " "):
                ph = text.fold(joiner.join(pieces[i:j]))
                if not ph or ph in text.STOPWORDS:
                    continue
                u, su = _best_unit(ph, cand)
                g, sg = _best_group(ph, cand)
                if u is not None and su >= REGION_MATCH_MIN and su >= sg:
                    hit = ([u], su)
                elif g is not None and sg >= REGION_MATCH_MIN:
                    hit = (list(cand[cand.region == g].index), sg)
                else:
                    continue
                rest = cover(j)
                if rest is None:
                    continue
                c = (rest[0] + 1, hit[0] + rest[1], min(hit[1], rest[2]))
                if best is None or c[0] < best[0]:
                    best = c
                break
        memo[i] = best
        return best

    return cover(0)


def _voronoi_cells(geom, pts_by_key: dict[str, list]) -> dict[str, object]:
    """`geom` cut among keys by nearest point, longitude scaled by cos(latitude)."""
    pts, owner = [], []
    for key in sorted(pts_by_key):
        for x, y in pts_by_key[key]:
            pts.append((float(x), float(y)))
            owner.append(key)
    lat0 = geom.representative_point().y
    kx = max(math.cos(math.radians(lat0)), 0.2)
    sg = shapely.affinity.scale(geom, xfact=kx, yfact=1.0, origin=(0, 0))
    cells = shapely.voronoi_polygons(shapely.MultiPoint([(x * kx, y) for x, y in pts]),
                                     extend_to=sg.envelope.buffer(1.0))
    out: dict[str, list] = defaultdict(list)
    for cell in cells.geoms:
        i = next(i for i, (x, y) in enumerate(pts) if cell.covers(Point(x * kx, y)))
        piece = cell.intersection(sg)
        if not piece.is_empty:
            out[owner[i]].append(piece)
    return {k: shapely.make_valid(shapely.affinity.scale(shapely.union_all(v), xfact=1.0 / kx, yfact=1.0,
                                                         origin=(0, 0)))
            for k, v in out.items()}


def apply_rebuilds(out, hints, sources, a1):
    """`[rebuild.<country>]` hints (D683): every region of the country is its geoBoundaries ADM1
    units clipped to the country's Natural Earth land, replacing NE's older admin-1 lines
    (Cote d'Ivoire's 14 districts over NE's 19 regions). Units come from the table
    (`"<region>" = [names]`) or, for a region it does not list, the region's name (D680)."""
    for country in sorted(hints.get("rebuild", {})):
        spec = hints["rebuild"][country]
        g1, meta, why = load_blocks(country, sources, "admin1")
        if g1 is None:
            raise SystemExit(f"crosswalk: rebuild of {country}: ADM1 not usable ({why})")
        land = shapely.make_valid(shapely.union_all(a1[a1.adm0_a3.isin(config.ne_codes(country))].geometry.values))
        names = [str(n) for n in g1.shapeName]
        geom_of = {}
        for n, geom in zip(names, g1.geometry):
            geom_of.setdefault(text.fold(n), []).append(geom)
        for key in sorted(k for k in out if k.split(":")[0] == country):
            want = spec.get(key)
            if want is None:
                hit = gb_region_units(key.split(":", 1)[1], names)
                if hit is None:
                    raise SystemExit(f"crosswalk: rebuild of {country}: no ADM1 unit for {key}")
                want = hit[0]
            parts = [g for n in want for g in geom_of.get(text.fold(n), [])]
            if not parts:
                raise SystemExit(f"crosswalk: rebuild of {country}: no ADM1 unit named {want}")
            m = out[key]
            m["geometry"] = shapely.make_valid(shapely.union_all(parts)).intersection(land)
            m["rows"] = None  # the old NE units no longer describe it
            m["provenance"] = licenses.provenance(meta) + "; " + licenses.NE_PROVENANCE
            m["note"] = f"geoBoundaries ADM1 {', '.join(want)} (rebuilt, clipped to Natural Earth land)"
            m["kind"], m["confidence"] = "carve", 0.95
        # seams between the ADM1 file and NE's coast go to the neighbour with the longest edge
        keys = sorted(k for k in out if k.split(":")[0] == country)
        left = land.difference(shapely.union_all([out[k]["geometry"] for k in keys]))
        for part in getattr(left, "geoms", [left]):
            if part.is_empty or part.geom_type not in ("Polygon", "MultiPolygon"):
                continue
            best = max(keys, key=lambda k: (part.boundary.intersection(out[k]["geometry"].buffer(1e-6)).length, k))
            out[best]["geometry"] = shapely.make_valid(shapely.union_all([out[best]["geometry"], part]))


def apply_splits(out, hints):
    """`[split."<country>:<region>"]` hints (D681): a region Natural Earth still draws as one old
    unit that our file divides into several new regions (Equateur into Equateur, Mongala, the
    Ubangis and Tshuapa) is cut among them by Voronoi on each region's points (its capital and
    towns), where no licensed boundary file has the new lines. The named region keeps its own
    cell; the others get theirs."""
    for src in sorted(hints.get("split", {})):
        spec = hints["split"][src]
        if src not in out or out[src].get("geometry") is None:
            continue  # another region file's split
        cells = _voronoi_cells(out[src]["geometry"], spec)
        for key, g in sorted(cells.items()):
            if key not in out:
                raise SystemExit(f"crosswalk: split of {src} names unknown region {key}")
            m = out[key]
            if key == src:
                m["geometry"] = g
                m["note"] += f"; split among {', '.join(k for k in sorted(cells) if k != src)} (builder points)"
            else:
                m["geometry"] = g if m.get("geometry") is None else shapely.make_valid(
                    shapely.union_all([m["geometry"], g]))
                m["note"] += f"; Voronoi cell of {src} (builder points)"
                if m["kind"] == "none":
                    m["kind"], m["confidence"] = "carve", 0.95
            m["provenance"] = licenses.NE_PROVENANCE + "; " + licenses.BUILDER_PROVENANCE


def apply_carves(out, hints, sources):
    """`[carve."<country>:<region>"]` hints (D676): land a region's Natural Earth units do not
    give it (a new province NE merges into its parent, as North Kalimantan inside East
    Kalimantan, or contested land drawn by our own province files, decision C) is taken from
    whichever regions hold it. The land is geoBoundaries units by name (`level` admin1, admin2
    or admin3 of `country`, default the region's own) or a builder-drawn `polygon` of lon,lat
    points (`clip = false` keeps a polygon where Natural Earth has no land), clipped to the
    regions it is taken from (`from`, default the region's own country's)."""
    carves = hints.get("carve", {})
    # replacing carves last, so the land they drop has been handed out first
    for key in sorted(carves, key=lambda k: (bool(carves[k].get("replace")), k)):
        c = carves[key]
        if key not in out:
            raise SystemExit(f"crosswalk: carve hint for unknown region {key}")
        if "polygon" in c:
            g = shapely.Polygon([(float(x), float(y)) for x, y in c["polygon"]])
            prov, src = licenses.BUILDER_PROVENANCE, "builder polygon"
        else:
            country = c.get("country", key.split(":")[0])
            blocks, meta, why = load_blocks(country, sources, c.get("level", "admin2"))
            if blocks is None:
                raise SystemExit(f"crosswalk: carve for {key}: {country} blocks not usable ({why})")
            want = [text.fold(n) for n in c["units"]]
            names = [text.fold(n) for n in blocks.shapeName]
            missing = [n for n in want if n not in names]
            if missing:
                raise SystemExit(f"crosswalk: carve for {key}: no {country} unit named {missing}")
            g = shapely.union_all([geom for geom, n in zip(blocks.geometry, names) if n in want])
            prov, src = licenses.provenance(meta), f"{country} units {', '.join(c['units'])}"
        # the land is taken only from the regions `from` names (default: the region's own
        # country), so the simplified geoBoundaries line spills over no foreign border
        src_keys = c.get("from") or [k for k in out if k.split(":")[0] == key.split(":")[0]]
        if not any(k in out for k in src_keys):
            continue  # another region file's carve whose land is not in this run (Donbas in RCA)
        src_keys = [k for k in src_keys if k in out]
        sources_g = [out[k]["geometry"] for k in src_keys if k != key and out[k].get("geometry") is not None]
        g = shapely.make_valid(g)
        if c.get("clip", True):
            g = g.intersection(shapely.union_all(sources_g)) if sources_g else shapely.Polygon()
        taken = []
        for k in sorted(out):
            m = out[k]
            if k == key or k not in src_keys or m.get("geometry") is None or not m["geometry"].intersects(g):
                continue
            rest = shapely.make_valid(m["geometry"].difference(g))
            if rest.area < m["geometry"].area:
                taken.append(k)
                m["geometry"] = rest
                m["note"] += f"; less {key} (carve)"
        m = out[key]
        # `replace = true`: the carved land is the region's whole shape (its NE unit's old,
        # larger extent goes back to nobody unless a later carve takes it)
        if m.get("geometry") is None or c.get("replace"):
            m["geometry"] = g
        else:
            m["geometry"] = shapely.make_valid(shapely.union_all([m["geometry"], g]))
        m["provenance"] = prov if m["rows"] is None else licenses.NE_PROVENANCE + "; " + prov
        m["note"] += f"; carve: {src} from {', '.join(taken) or 'no region'}"
        if m["confidence"] == 0.0:
            m["confidence"] = 0.95
        if m["kind"] == "none":
            m["kind"] = "carve"


_GB1_CACHE: dict[str, list[str] | None] = {}


def _gb_adm1(country: str, sources) -> list[str] | None:
    """Names of the country's geoBoundaries ADM1 units when pinned and licensed, else None."""
    if sources is None:
        return None
    if country not in _GB1_CACHE:
        g, _, _ = load_blocks(country, sources, "admin1")
        _GB1_CACHE[country] = None if g is None else [str(n) for n in g.shapeName]
    return _GB1_CACHE[country]


def gb_region_units(region: str, names: list[str]) -> tuple[list[str], float] | None:
    """The geoBoundaries ADM1 units a region name names (D680): the whole name, or its parts
    ("Kisumu-Siaya", "Garissa-Wajir-Mandera"), each matched by fuzzy name like an NE unit.
    Returns (unit names, worst score) or None."""
    folded = [(text.fold(n), n) for n in names]

    def best(ph):
        b, bs = None, 0.0
        for f, n in folded:
            sc = max(fuzz.ratio(ph, f), fuzz.ratio(_core(ph), _core(f)))
            if sc > bs:
                b, bs = n, sc
        return (b, bs) if bs >= REGION_MATCH_MIN else None

    whole = best(text.fold(region))
    if whole:
        return [whole[0]], whole[1]
    pieces = [x for x in re.split(r"-| and |/|, ", region) if x.strip()]
    if len(pieces) < 2:
        return None
    out, worst, i = [], 100.0, 0
    while i < len(pieces):
        for j in range(len(pieces), i, -1):
            hit = best(text.fold(" ".join(pieces[i:j]))) or best(text.fold("-".join(pieces[i:j])))
            if hit:
                out.append(hit[0])
                worst = min(worst, hit[1])
                i = j
                break
        else:
            return None
    return list(dict.fromkeys(out)), worst


def match_regions(provs, a1, a1_all, a0, hints, sources=None):
    """Return ({region_key: dict(geometry, rows, source_ids, confidence, note, whole, kind)},
    [unclaimed admin-1 units]).

    Each region claims Natural Earth admin-1 units of its country (game codes map to NE codes
    through config.NE_CODES): an alias hint, the whole country (a country with one region in
    the file, or a region named like its country), a unit by fuzzy name, an NE region group
    by name (FRA Ile-de-France is its 8 departements), or a composite name's parts. A unit
    claimed twice goes to the more specific match; an unclaimed unit joins the touching region
    of its country with the longest shared edge (D673)."""
    aliases = hints.get("regions", {})
    keys = sorted({(p.country, p.region) for p in provs})
    per_country = defaultdict(int)
    for c, _ in keys:
        per_country[c] += 1
    out = {}
    for country, region in keys:
        key = f"{country}:{region}"
        codes = config.ne_codes(country)
        cand = a1[a1.adm0_a3.isin(codes)]
        a0row = a0[a0.ADM0_A3.isin(codes)]
        f = text.fold(region)
        country_names = {text.fold(v) for v in a0row[["ADMIN", "NAME", "NAME_LONG"]].values.ravel()
                         if isinstance(v, str)}
        if key in aliases:
            al = aliases[key] if isinstance(aliases[key], list) else [aliases[key]]
            out[key] = dict(idx=_resolve_alias(a1_all, al, cand), confidence=0.95, kind="alias",
                            note=f"alias hint -> {', '.join(al)}")
            continue
        if len(cand) == 0:
            out[key] = dict(idx=[], a0=a0row, confidence=0.95, kind="whole",
                            note="whole country (Natural Earth admin-0; no admin-1 units)")
            continue
        if per_country[country] == 1:
            out[key] = dict(idx=list(cand.index), confidence=0.95, kind="whole",
                            note=f"whole country ({len(cand)} admin-1 units)")
            continue
        u, su = _best_unit(f, cand)
        g, sg = _best_group(f, cand)
        # a tie goes to a group of two or more units: NE gives a province unit its region's name as
        # an alternate (Rimini's gn_name is Emilia-Romagna)
        if u is not None and su >= REGION_MATCH_MIN and (su > sg or (su == sg and _group_size(g, cand) < 2)):
            out[key] = dict(idx=[u], confidence=round(su / 100, 2), kind="unit", note=f"name match {su:.0f}")
        elif g is not None and sg >= REGION_MATCH_MIN:
            m = cand[cand.region == g]
            out[key] = dict(idx=list(m.index), confidence=round(sg / 100, 2), kind="group",
                            note=f"Natural Earth region {g} ({len(m)} units, match {sg:.0f})")
        elif f in country_names:
            out[key] = dict(idx=list(cand.index), confidence=0.95, kind="whole",
                            note=f"whole country ({len(cand)} admin-1 units)")
        else:
            parts = _match_parts(region, cand)
            if parts is not None:
                out[key] = dict(idx=list(dict.fromkeys(parts[1])), confidence=round(parts[2] / 100, 2),
                                kind="parts", note=f"name parts ({parts[0]} pieces, worst match {parts[2]:.0f})")
            else:
                gb = _gb_adm1(country, sources)
                hit = gb_region_units(region, gb) if gb else None
                if hit:
                    out[key] = dict(idx=[], confidence=round(hit[1] / 100, 2), kind="none", gb_units=hit[0],
                                    note=f"geoBoundaries ADM1 {', '.join(hit[0])}")
                    continue
                out[key] = dict(idx=[], confidence=0.0, kind="none",
                                note=f"no admin-1 match (best unit {su:.0f}, group {sg:.0f})")
    # a unit claimed twice goes to the more specific match, then the better name score
    problems: list[str] = []
    owner: dict[int, str] = {}
    for key in sorted(out):
        m = out[key]
        for i in m["idx"]:
            cur = owner.get(i)
            if cur is None:
                owner[i] = key
                continue
            a = (SPECIFIC[out[cur]["kind"]], out[cur]["confidence"])
            b = (SPECIFIC[m["kind"]], m["confidence"])
            if a == b:
                problems.append(f"{a1_all.loc[i].adm1_code} ({a1_all.loc[i]['name']}) is claimed by both {cur} "
                                f"and {key}")
            if b > a:
                owner[i] = key
    for m in out.values():
        m["idx"] = [i for i in m["idx"] if owner.get(i) is not None and out[owner[i]] is m]
    carved = set(hints.get("carve", {})) | {k for v in hints.get("split", {}).values() for k in v}
    carved |= {k for k in out if k.split(":")[0] in hints.get("rebuild", {})}
    for key in sorted(out):
        if not out[key]["idx"] and out[key].get("a0") is None and key not in carved and not out[key].get("gb_units"):
            problems.append(f"{key}: {out[key]['note']} (no admin-1 unit left)")
    # an unclaimed unit joins the touching region of its own country with the longest edge
    ne_to_game = {}
    for c in sorted({c for c, _ in keys}):
        for code in config.ne_codes(c):
            ne_to_game.setdefault(code, c)
    def geom(k):
        return shapely.union_all([a1_all.loc[i].geometry for i in out[k]["idx"]])

    geoms = {k: geom(k) for k, m in out.items() if m["idx"]}
    # repeat until nothing changes, so a unit touching only another filled unit is reached;
    # then island units go to the nearest region within GAP_NEAR_DEG
    for near in (False, True):
        changed = True
        while changed:
            changed = False
            for i in sorted(set(a1.index) - set(owner)):
                row = a1_all.loc[i]
                game = ne_to_game.get(row.adm0_a3)
                best, best_key = None, None
                for key in sorted(k for k in geoms if k.startswith(f"{game}:")):
                    d = geoms[key].distance(row.geometry)
                    if near:
                        k2 = (-d,) if d <= GAP_NEAR_DEG else None
                    elif d <= GAP_TOUCH_DEG:
                        k2 = (row.geometry.boundary.intersection(geoms[key].buffer(GAP_TOUCH_DEG)).length,)
                    else:
                        k2 = None
                    if k2 is not None and (best_key is None or k2 > best_key):
                        best, best_key = key, k2
                if best is None:
                    continue
                out[best]["idx"].append(i)
                out[best].setdefault("filled", []).append(str(row["name"] or row.adm1_code))
                owner[i] = best
                geoms[best] = geom(best)
                changed = True
            if near:
                break  # one nearest pass is enough; islands do not chain
    unclaimed = [{"adm1_code": a1_all.loc[i].adm1_code, "name": a1_all.loc[i]["name"],
                  "adm0": a1_all.loc[i].adm0_a3, "area_deg2": round(a1_all.loc[i].geometry.area, 4)}
                 for i in sorted(set(a1.index) - set(owner))]
    for m in out.values():
        if m.get("filled"):
            m["note"] += f"; plus unclaimed {', '.join(sorted(m['filled']))}"
        rows = a1_all.loc[sorted(m["idx"])] if m["idx"] else None
        m["rows"] = rows
        m["whole"] = m["kind"] == "whole"
        if rows is not None and len(rows):
            m["geometry"] = shapely.make_valid(shapely.union_all(rows.geometry.values))
            m["source_ids"] = ";".join(rows.adm1_code.tolist())
        elif m.get("a0") is not None and len(m["a0"]):
            m["geometry"] = shapely.make_valid(shapely.union_all(m["a0"].geometry.values))
            m["source_ids"] = ";".join(m["a0"].ADM0_A3.tolist())
        else:
            m["geometry"] = None
            m["source_ids"] = ""
    return out, unclaimed, problems


LEVELS = {"admin1": "ADM1", "admin2": "ADM2", "admin3": "ADM3"}


def load_blocks(country: str, sources: dict, level: str = "admin2"):
    """The country's geoBoundaries ADM2 (or ADM3) building blocks if their license passes P2,
    else None. Returns (blocks, metadata, why)."""
    gl = LEVELS[level]
    b = config.gb_boundary(country, gl, sources)
    if b is None:
        return None, None, "not pinned"
    meta = fetch.gb_meta(country, gl, sources)
    ok, why = licenses.classify_meta(meta)
    if not ok:
        return None, meta, why
    path = config.gb_dir(country, gl, sources) / config.gb_geojson_name(b)
    g = gpd.read_file(path)[["shapeName", "shapeID", "geometry"]]
    # D610: simplify to a tenth of a pixel first; StatCan coastlines carry up to 294,000
    # vertices per unit, which made every overlay test slow
    g["geometry"] = shapely.make_valid(shapely.simplify(g.geometry.values, BLOCK_SIMPLIFY_DEG))
    return g, meta, why


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

    def place_in(self, fname: str, geom):
        """(x, y, label) of the most populous place called `fname` inside `geom`, or None."""
        inside = [p for p in self.places_all if p[0] == fname and geom.covers(Point(p[1], p[2]))]
        if not inside:
            return None
        best = max(inside, key=lambda p: (p[3], -p[1], -p[2]))
        return best[1], best[2], best[4]

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
                    hits.append(("place", fname, (x, y, pop, label), ph, False))
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
                        # reverse: the block name contains the whole phrase ("Vancouver Island and
                        # Coast" for "Vancouver"), not the phrase the name
                        hits.append(("block", fname, r, ph, not text.contains_word(ph, fname)))
                        break
            # A reverse block match is only a fallback: with any exact hit for the phrase it is
            # dropped, so "Vancouver" means the city, not the "Vancouver Island and Coast" region.
            # Then drop an exact hit whose name is a word-part of a longer exact hit
            # ("york" inside "new york").
            exact = [h for h in hits if not h[4]]
            if exact:
                hits = exact
            names = {h[1] for h in hits if not h[4]}
            for h in hits:
                if any(o != h[1] and text.contains_word(o, h[1]) for o in names):
                    continue
                found.append(h[:4])
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
    def too_far(x, y):
        if in_name or not p.metro or metro_core is None:
            return False
        k = _scale(metro_core[1])
        return _dist2(x, y, metro_core[0], metro_core[1], k) > METRO_NOTES_DEG ** 2

    county_notes = any(w in text.contains_any_word(ph) for ph in text.note_phrases(p.notes) for w in _ADMIN_WORDS)
    for (kind, fname, payload, ph), in_name in hits:
        if kind == "block" and not county_notes and gaz.place_in(fname, payload.geometry) is None \
                and too_far(payload.rx, payload.ry):
            notes.append(f"notes unit {payload.name} ignored (a word, outside the Metro)")
            continue
        if kind == "place":
            named.append((payload[3], payload[0], payload[1], in_name))
        if kind == "place":
            x, y, pop, label = payload
            q = Q_PLACE_NAME if in_name else Q_PLACE_NOTE
            seeds.append(Seed(x, y, q, f"place {label}"))
        else:
            q = Q_BLOCK_NAME if in_name else Q_BLOCK_NOTE
            at = gaz.place_in(fname, payload.geometry)
            if at is not None:
                seeds.append(Seed(at[0], at[1], q, f"unit {payload.name} at place {at[2]}", payload.unit_id))
            else:
                seeds.append(Seed(payload.rx, payload.ry, q, f"unit {payload.name}", payload.unit_id, at_rep=True))
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
    shared: dict[tuple, list[ProvinceRow]] = defaultdict(list)
    for p in sorted(provs, key=lambda p: p.id):
        kept = [s for s in p.seeds if owner[(round(s.x, 4), round(s.y, 4))][1] == p.id]
        if kept:
            p.seeds = kept
        else:
            best = max(p.seeds, key=lambda s: s.quality)
            shared[(round(best.x, 4), round(best.y, 4))].append(p)
    # D677: provinces left with only a point a neighbour owns (three "Shenzhen ..." provinces all
    # found the place Shenzhen) would get no land at all; each moves METRO_OFFSET_DEG from that
    # point, by its name's direction words or else round a ring in id order, at Metro-direction
    # quality, so the row is flagged for a hint
    for (x0, y0), group in shared.items():
        k = _scale(y0)
        for n, p in enumerate(group):
            vec = _avg_dir(text.directions(p.name))
            if not vec or vec == (0.0, 0.0):
                a = 2 * math.pi * (n + 0.5) / len(group)
                vec = (math.cos(a), math.sin(a))
            x = x0 + vec[0] * METRO_OFFSET_DEG / k
            y = y0 + vec[1] * METRO_OFFSET_DEG
            p.seeds = [Seed(x, y, Q_METRO_DIR, f"shared point moved {vec[0]:+.2f},{vec[1]:+.2f}")]


def assign_blocks(provs: list[ProvinceRow], blocks, by_geometry: bool, metro_ids: frozenset = frozenset()):
    """Return ({province: [unit ids]}, {unit id: [province ids]} for split units).

    A block with one province's seeds goes to it, one with several is split among them, an empty
    one goes to the province with the nearest seed: nearest to the block's representative point
    (admin units) or to the block itself (`by_geometry`, the polygon parts of a Voronoi region,
    so an island goes to the closest seed). When the region also has provinces outside a Metro,
    a Metro province takes an empty block only if it touches (or nearly, METRO_TOUCH_DEG) a block it claimed, so the rural
    province, not the city, gets the countryside (D612)."""
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
    rural = any(p.id not in metro_ids for p in provs)
    geom_of = dict(zip(blocks.unit_id, blocks.geometry))
    metro_claim = {}
    if rural:
        for pid in sorted(metro_ids):
            mine = [geom_of[u] for u, owners in claims.items() if pid in owners and u in geom_of]
            if mine:
                metro_claim[pid] = shapely.union_all(mine)

    def eligible(r):
        if not rural:
            return all_seeds
        near = {pid for pid, g in metro_claim.items() if r.geometry.distance(g) < METRO_TOUCH_DEG}
        return [t for t in all_seeds if t[2] not in metro_ids or t[2] in near]

    for r in blocks.itertuples():
        owners = claims.get(r.unit_id, set())
        if len(owners) == 1:
            whole[next(iter(owners))].append(r.unit_id)
        elif len(owners) > 1:
            split[r.unit_id] = sorted(owners)
        elif by_geometry:
            best = min(eligible(r) or all_seeds, key=lambda t: (r.geometry.distance(Point(t[0], t[1])), t[2]))
            whole[best[2]].append(r.unit_id)
        else:
            k = _scale(r.ry)
            best = min(eligible(r) or all_seeds, key=lambda t: (_dist2(r.rx, r.ry, t[0], t[1], k), t[2]))
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
    own_keys = {f"{p.country}:{p.region}" for p in provs}
    # a country in two region files (Russia): the other file's regions are matched too, so its
    # units are claimed and not given to this file's regions as unclaimed land (D673); their
    # alias and carve hints come from that file's hints
    match_provs, match_hints = list(provs), dict(hints)
    for other in config.REGIONS.values():
        shared = set(other.countries) & set(region.countries)
        if other is region or not shared:
            continue
        match_provs += [p for p in read_provinces(other) if p.country in shared]
        oh = load_hints(other)
        for table in ("regions", "carve", "split", "rebuild"):
            merged = dict(match_hints.get(table, {}))
            merged.update({k: v for k, v in oh.get(table, {}).items() if k.split(":")[0] in shared})
            match_hints[table] = merged
    text.set_region_words(hints.get("text", {}))
    codes = config.ne_codes_for(region.countries)
    a1_all = gpd.read_file(config.ne_path("ne_10m_admin_1_states_provinces_lakes.shp", sources), columns=NE_A1_COLS)
    a1_all["geometry"] = shapely.make_valid(a1_all.geometry.values)
    a1 = a1_all[a1_all.adm0_a3.isin(codes)]
    a0 = gpd.read_file(config.ne_path("ne_10m_admin_0_countries.shp", sources), columns=NE_A0_COLS)
    a0 = a0[a0.ADM0_A3.isin(codes)].copy()
    pp_all = gpd.read_file(config.ne_path("ne_10m_populated_places.shp", sources), columns=NE_PP_COLS)
    blocks_hints = hints.get("blocks", {})
    notes_need_place = set(blocks_hints.get("notes_need_place", []))
    level_hint = blocks_hints.get("level", {})

    regions, unclaimed, problems = match_regions(match_provs, a1, a1_all, a0, match_hints, sources)
    # D680: a region Natural Earth lacks but geoBoundaries ADM1 names is carved from its
    # country's other regions with those units (a hint's own carve wins)
    carves = dict(match_hints.get("carve", {}))
    for key in sorted(regions):
        if regions[key].get("gb_units") and key not in carves and key.split(":")[0] not in match_hints.get("rebuild", {}):
            carves[key] = {"level": "admin1", "units": regions[key]["gb_units"]}
    match_hints["carve"] = carves
    if not problems:
        apply_carves(regions, match_hints, sources)
        apply_rebuilds(regions, match_hints, sources, a1)
        apply_splits(regions, match_hints)
    # QA (D682): each country's Natural Earth land that no region of it covers after the
    # aliases, carves and splits (a replaced old unit's leftover, a seam between sources)
    gaps = []
    for country in sorted(region.countries):
        # admin-1 units (lakes cut out), so Lake Victoria is no gap; admin-0 where there are none
        land0 = a1[a1.adm0_a3.isin(config.ne_codes(country))]
        if not len(land0):
            land0 = a0[a0.ADM0_A3.isin(config.ne_codes(country))]
        # land another country's region holds (Donbas, drawn by our file for RUS) is no gap
        geoms = [m["geometry"] for m in regions.values() if m.get("geometry") is not None]
        if not len(land0) or not geoms:
            continue
        land_g = shapely.make_valid(shapely.union_all(land0.geometry.values))
        left = land_g.difference(shapely.union_all(geoms))
        if land_g.area > 0 and left.area / land_g.area > 1e-4:
            gaps.append({"country": country, "area_deg2": round(left.area, 4),
                         "share": round(left.area / land_g.area, 4)})
    work = config.work_dir(region.slug, sources)
    lines = [f"{k}\t{m['kind']}\t{m['confidence']}\t{m['note']}\t"
             + ", ".join(sorted(str(n) for n in m["rows"]["name"])) if m["rows"] is not None else f"{k}\t{m['kind']}\t\t{m['note']}"
             for k, m in sorted(regions.items())]
    (work / "region-matches.tsv").write_text("\n".join(lines) + "\n", encoding="utf-8")
    if problems:
        raise SystemExit("crosswalk: region matching failed (add alias hints; all matches in "
                         f"{work / 'region-matches.tsv'}):\n  " + "\n  ".join(problems))
    by_region: dict[str, list[ProvinceRow]] = defaultdict(list)
    for p in provs:
        by_region[f"{p.country}:{p.region}"].append(p)

    block_cache: dict[tuple[str, str], tuple] = {}

    def blocks_for(country, level):
        if (country, level) not in block_cache:
            g, meta, why = load_blocks(country, sources, level)
            block_cache[(country, level)] = (g, meta, why)
            if meta is not None:
                print(f"  {country}: {LEVELS[level]} blocks {'usable' if g is not None else 'not used'} ({why})")
        return block_cache[(country, level)]

    out_dir = config.ASSETS_DIR / "crosswalk"
    out_dir.mkdir(parents=True, exist_ok=True)
    work = config.work_dir(region.slug, sources)
    for old in work.glob("blocks-*.geojson"):
        old.unlink()
    region_rows, province_rows, plan = [], [], {"regions": {}}
    region_features = []
    hint_provs = hints.get("provinces", {})

    for key in sorted(k for k in regions if k in own_keys):
        m = regions[key]
        country, rname = key.split(":", 1)
        members = sorted(by_region[key], key=lambda p: p.id)
        geom = m["geometry"]
        rprov = m.get("provenance", licenses.NE_PROVENANCE)
        region_rows.append(dict(country=country, region=rname, method="admin1", source_ids=m["source_ids"],
                                confidence=m["confidence"], provenance=rprov, note=m["note"]))
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
                                      provenance=rprov, note=f"whole region ({m['note']})"))
            rplan["level"] = "region"
            rplan["provinces"][p.id] = {"whole": ["region"], "split": {}}
            continue

        # building blocks for this region (D674): the region's own admin-1 units when it has at
        # least as many as provinces (a whole country, or a group like Ile-de-France's 8
        # departements), else the country's ADM2 when its license passes, else its admin-1 units
        # when it has several, else its polygon parts; a hint can name the level per region
        n_units = 0 if m["rows"] is None else len(m["rows"])
        want = level_hint.get(key)
        if want is None:
            if n_units >= 2 and n_units >= len(members):
                want = "admin1"
            elif blocks_for(country, "admin2")[0] is not None:
                want = "admin2"
            elif n_units >= 2:
                want = "admin1"
            else:
                want = "voronoi"
        if want == "admin1":
            if n_units < 2:
                raise SystemExit(f"crosswalk: {key} has {n_units} admin-1 units; level admin1 needs two or more")
            b = m["rows"][["adm1_code", "name", "geometry"]].rename(columns={"adm1_code": "unit_id"})
            level, prov_str = "admin1", rprov
        elif want in LEVELS:
            allb, meta, why = blocks_for(country, want)
            if allb is None:
                raise SystemExit(f"crosswalk: {key} asks for {LEVELS[want]} blocks, but they are not usable ({why})")
            rp = allb.geometry.representative_point()
            inside = rp.within(geom.buffer(0.01))
            b = allb[inside][["shapeID", "shapeName", "geometry"]].rename(
                columns={"shapeID": "unit_id", "shapeName": "name"})
            level = want
            prov_str = "; ".join(dict.fromkeys([licenses.provenance(meta)] + rprov.split("; ")))
        elif want == "voronoi":
            parts = _parts(geom)
            b = gpd.GeoDataFrame({"unit_id": [f"part-{i}" for i in range(len(parts))],
                                  "name": ["" for _ in parts]}, geometry=parts, crs="EPSG:4326")
            level, prov_str = "voronoi", rprov
        else:
            raise SystemExit(f"crosswalk: unknown block level {want!r} for {key}")
        b = b.reset_index(drop=True).copy()
        b["aliases"] = [unit_aliases(n) if n else [] for n in b["name"]]
        rpts = b.geometry.representative_point()
        b["rx"], b["ry"] = rpts.x.values, rpts.y.values
        # places in the region
        # NE places of the countries the region is drawn from (its own, or a neighbour's unit
        # for contested land)
        src = set(config.ne_codes(country)) | ({c for c in m["rows"].adm0_a3} if m["rows"] is not None else set())
        pp = pp_all[pp_all.ADM0_A3.isin(src)]
        sel = pp[pp.geometry.within(geom.buffer(PLACE_BUFFER_DEG))]
        places = []
        for r in sel.itertuples():
            names = {r.NAME, r.NAMEASCII} | set((r.NAMEALT or "").split("|"))
            for n in sorted(n for n in names if isinstance(n, str)):
                if isinstance(n, str) and n.strip():
                    places.append((text.fold(n), r.geometry.x, r.geometry.y, r.POP_MAX or 0, r.NAME))
        exclude = {text.fold(rname), text.fold(country)}
        exclude |= {text.fold(v) for v in a0[a0.ADM0_A3.isin(config.ne_codes(country))][["ADMIN", "NAME"]].values.ravel()
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
        whole, split = assign_blocks(members, b, by_geometry=(level == "voronoi"),
                                     metro_ids=frozenset(p.id for p in members if p.metro))
        for p in members:
            sp = {}
            for uid, owners in split.items():
                if p.id in owners:
                    mine = [s for s in p.seeds if s.home == uid]
                    # a representative-point seed only places a province with no better point here
                    anchored = [s for s in mine if not s.at_rep]
                    pts = [[s.x, s.y] for s in (anchored or mine)]
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
               merge_key=("country", "region"), own={(p.country, p.region) for p in provs})
    _write_csv(out_dir / "province_crosswalk.csv", province_rows,
               ["province_id", "name", "country", "region", "method", "source_ids", "confidence", "provenance", "note"],
               merge_key=("province_id",), own={(p.id,) for p in provs})
    (work / "unclaimed.json").write_text(json.dumps(unclaimed, indent=1), encoding="utf-8")
    (work / "land-gaps.json").write_text(json.dumps(gaps, indent=1), encoding="utf-8")
    gpd.GeoDataFrame(region_features, crs="EPSG:4326").to_file(work / "regions.geojson", driver="GeoJSON")
    (work / "plan.json").write_text(json.dumps(plan, indent=1), encoding="utf-8")
    flagged = sum(1 for r in province_rows if r["confidence"] < FLAG_BELOW)
    by_method = defaultdict(int)
    for r in province_rows:
        by_method[r["method"]] += 1
    print(f"  {len(region_rows)} regions, {len(province_rows)} provinces {dict(by_method)}, {flagged} flagged")


def _slug(key: str) -> str:
    return text.fold(key).replace(" ", "-")


def _write_csv(path, rows, cols, merge_key, own):
    """Write rows, keeping other region files' rows already in the file (one file for the
    world): a row is replaced when its key is one of this region file's (`own`), so a country
    in two files (Russia) keeps both files' rows."""
    keep = []
    if path.exists():
        with path.open(encoding="utf-8", newline="") as f:
            keep = [r for r in csv.DictReader(f) if tuple(r[k] for k in merge_key) not in own]
    allrows = keep + rows
    allrows.sort(key=lambda r: tuple(str(r[k]) for k in merge_key))
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        for r in allrows:
            w.writerow({k: r[k] for k in cols})
