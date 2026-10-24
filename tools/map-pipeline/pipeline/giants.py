"""`run.py giants`: measure every province, pick the giants and cut them (D820 to D829).

    uv run python run.py giants                 # measure and list the giants (reads the cache)
    uv run python run.py giants --write         # also cut them and write the data and hints
    uv run python run.py giants --coastal       # set the parts' coastal flags from mapgen's bitmap

Reads each region's `work/<region>/provinces.geojson` (the last pipeline run) for the areas, so
run it on a world built before the split. `--write` rebuilds each giant's shape exactly as the
shapes step does (shapes.build_region from the region's plan.json), cuts it with
`subdivide.choose`, and writes:

- the new province rows in the region's CSV (after the country's last row) and the parents'
  rows: the main part keeps the original's development and every new part has 1/1/1 (D823);
  a site resource and each notes fragment go to the part holding their site (`[giant_sites]`
  in the hints names sites Natural Earth lacks; D829); and the countries' `provinces_planned`;
- a `[subdivide."<id>"]` table per giant in the region's hints file (the cut's numbers, one
  point per part, which the shapes step maps parts to ids by, and the notes the original is
  placed from when they moved);
- a city probe point (checks/city-points.txt) for every original's main city, every site and
  every part named after a town.

It runs once, on the unsplit world: it stops if any hints file has a `[subdivide]` table already.
"""

from __future__ import annotations

import csv
import io
import json
import math
import unicodedata
from collections import defaultdict

import geopandas as gpd
import shapely

from . import config, crosswalk, shapes, subdivide, text

# A part's own town gives it city rank Town from this population (Natural Earth POP_MAX) up.
TOWN_RANK_POP = 20_000
# Resources a part takes from its parent as they are (spread over the land); a site resource
# (a mine, a field, a dam) stays with the main part and the part holding the place the parent's
# notes name first; other parts get their terrain's background resource.
SPREAD_RESOURCES = {"Farmland", "Timber", "Fishing", "None"}
TERRAIN_RESOURCE = {"Tropical": "Timber", "Temperate": "Timber", "Wetland": "Timber", "Mountain": "None",
                    "Desert": "None", "Arctic": "None", "Urban": "None"}
TRACKS = ("commerce", "industry", "population")
TRACK_MIN = 1
COMPASS = ["East", "Northeast", "North", "Northwest", "West", "Southwest", "South", "Southeast"]


def _read_csv(path):
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _row_line(cols, row, nl: str = "\n") -> str:
    buf = io.StringIO()
    csv.writer(buf, lineterminator=nl).writerow([row[c] for c in cols])
    return buf.getvalue()


def _write_rows(path, cols, rows) -> None:
    """Rewrite a CSV keeping its line ending (some province files are CRLF in git)."""
    nl = "\r\n" if b"\r\n" in path.read_bytes()[:4096] else "\n"
    with path.open("w", encoding="utf-8", newline="") as f:
        f.write(",".join(cols) + nl)
        for r in rows:
            f.write(_row_line(cols, r, nl))


def measure(sources) -> list[dict]:
    """Area and Arctic share of every province of the last pipeline run, largest first."""
    out = []
    for slug in config.REGION_SLUGS:
        g = gpd.read_file(config.work_dir(slug, sources) / "provinces.geojson")
        for r in g.itertuples():
            geom = shapely.make_valid(r.geometry)
            out.append({"id": r.province_id, "region": slug, "km2": subdivide.area_km2(geom),
                        "arctic": subdivide.arctic_share(geom), "lat_min": geom.bounds[1]})
    out.sort(key=lambda r: (-r["km2"], r["id"]))
    return out


def _compass(dx: float, dy: float) -> str:
    a = math.degrees(math.atan2(dy, dx)) % 360.0
    return COMPASS[int(((a + 22.5) % 360.0) // 45.0)]


def run(write: bool = False, coastal: bool = False, log=print) -> None:
    sources = config.load_sources()
    if coastal:
        set_coastal(sources, log)
        return
    for region in config.REGIONS.values():
        if crosswalk.load_hints(region).get("subdivide"):
            raise SystemExit(f"giants: hints/{region.slug}.toml already has [subdivide] tables; "
                             "run this on the unsplit world")
    rows = measure(sources)
    cap = next(r for r in rows if r["id"] == subdivide.CAP_PROVINCE)
    log(f"cap: {subdivide.CAP_PROVINCE} (Eastern Iowa) {cap['km2']:,.0f} km2 "
        f"(constant {subdivide.CAP_KM2:,.0f})")
    if abs(cap["km2"] - subdivide.CAP_KM2) > 1.0:
        raise SystemExit("giants: the cap province's area moved; update subdivide.CAP_KM2")
    log(f"Arctic: more than {subdivide.ARCTIC_SHARE:.0%} of the area north of {subdivide.ARCTIC_LAT} N, "
        f"or any land south of {-subdivide.ANTARCTIC_LAT:.0f} S")
    big = [r for r in rows if r["km2"] > subdivide.GIANT_KM2]
    arctic = [r for r in big if r["arctic"] > subdivide.ARCTIC_SHARE or r["lat_min"] < subdivide.ANTARCTIC_LAT]
    giants = [r for r in big if r not in arctic]
    south = [r for r in rows if r["lat_min"] < subdivide.ANTARCTIC_LAT]
    log(f"provinces measured: {len(rows)}; over {subdivide.GIANT_KM2:,.0f} km2: {len(big)}; Arctic, not cut: "
        f"{len(arctic)}; giants: {len(giants)}; south of 60 S: {len(south)}")
    for r in arctic:
        log(f"  arctic {r['id']} {r['km2']:,.0f} km2, {r['arctic']:.1%} north of {subdivide.ARCTIC_LAT}")
    est = sum(subdivide.parts_for(r["km2"]) for r in giants)
    log(f"  parts at n = ceil(area / ({subdivide.SLACK} x cap)): {est} ({est - len(giants)} new provinces)")
    for r in giants:
        log(f"  giant {r['id']} {r['region']} {r['km2']:,.0f} km2, Arctic share {r['arctic']:.1%}, "
            f"{subdivide.parts_for(r['km2'])} parts")
    if not write:
        return
    _write(sources, giants, log)


def _write(sources, giants, log) -> None:
    by_region: dict[str, list[str]] = defaultdict(list)
    for r in giants:
        by_region[r["region"]].append(r["id"])
    csv_rows = {}
    for slug in config.REGION_SLUGS:
        csv_rows[slug] = _read_csv(config.DATA_DIR / config.REGIONS[slug].csv)
    all_rows = [r for slug in config.REGION_SLUGS for r in csv_rows[slug]]
    next_no: dict[str, int] = {}
    for r in all_rows:
        pre, no = r["id"].split("-")
        next_no[pre] = max(next_no.get(pre, 0), int(no) + 1)
    names_by_country: dict[str, set] = defaultdict(set)
    for r in all_rows:
        names_by_country[r["country"]].add(text.fold(r["name"]))
    seeds_all = {}
    city_points = []
    new_by_country: dict[str, int] = defaultdict(int)
    summary = []
    pending, hints_out = [], []
    for slug in config.REGION_SLUGS:
        if slug not in by_region:
            continue
        region = config.REGIONS[slug]
        work = config.work_dir(slug, sources)
        plan = json.loads((work / "plan.json").read_text(encoding="utf-8"))
        regions = gpd.read_file(work / "regions.geojson").set_index("region_key")
        seeds_all.update(json.loads((work / "seeds.json").read_text(encoding="utf-8")))
        rows = csv_rows[slug]
        by_id = {r["id"]: r for r in rows}
        region_hints = crosswalk.load_hints(region)
        built_cache = {}
        hint_blocks = []
        new_rows: dict[str, list[dict]] = defaultdict(list)  # country -> new rows
        for pid in sorted(by_region[slug]):
            row = by_id[pid]
            key = f"{row['country']}:{row['region']}"
            if key not in built_cache:
                built_cache[key] = shapes.build_region(key, shapely.make_valid(regions.loc[key].geometry),
                                                       plan["regions"][key], work)
            g = built_cache[key][pid]
            log(f"  cutting {pid} ...")
            c = subdivide.choose(g, row["country"], sources)
            res = _parts(pid, row, g, c, sources, seeds_all.get(pid, []), names_by_country, next_no,
                         region_hints.get("giant_sites", {}).get(pid, {}))
            for nr in res["children"]:
                new_rows[row["country"]].append(nr)
                new_by_country[row["country"]] += 1
            row.update(res["parent"])
            hint_blocks.append(res["hint"])
            city_points.extend(res["points"])
            summary.append(res["summary"])
            log(f"  {pid} {row['name']}: {c.n} parts ({c.blocks}, whole_tol {c.whole_tol}), "
                f"{min(c.areas):,.0f} to {max(c.areas):,.0f} km2")
        # rows: each country's new rows after its last row in the file
        cols = list(rows[0].keys())
        out = []
        last_of = {}
        for i, r in enumerate(rows):
            last_of[r["country"]] = i
        for i, r in enumerate(rows):
            out.append(r)
            if last_of[r["country"]] == i:
                out.extend(new_rows.get(r["country"], []))
        pending.append((config.DATA_DIR / region.csv, cols, out))
        hp = config.PIPELINE_DIR / "hints" / f"{slug}.toml"
        hints_out.append((hp, hp.read_text(encoding="utf-8").rstrip("\n") + "\n\n" + "\n".join(hint_blocks)))
    # nothing is written until every giant is cut
    for path, cols, out in pending:
        _write_rows(path, cols, out)
    for hp, txt in hints_out:
        hp.write_text(txt, encoding="utf-8", newline="\n")
    # countries.csv provinces_planned follows the province files
    cpath = config.DATA_DIR / "countries.csv"
    crows = _read_csv(cpath)
    ccols = list(crows[0].keys())
    for r in crows:
        if r["iso3"] in new_by_country:
            r["provinces_planned"] = str(int(r["provinces_planned"]) + new_by_country[r["iso3"]])
    _write_rows(cpath, ccols, crows)
    pts = config.PIPELINE_DIR / "checks" / "city-points.txt"
    body = pts.read_text(encoding="utf-8").rstrip("\n")
    body += ("\n# D820: the giant-province split (run.py giants): each original's main city and each new part's "
             "own town\n" + "\n".join(city_points) + "\n")
    pts.write_text(body, encoding="utf-8", newline="\n")
    (config.cache_dir(sources) / "work" / "giants-summary.json").write_text(json.dumps(summary, indent=1),
                                                                             encoding="utf-8")
    log(f"wrote {sum(new_by_country.values())} new provinces in {len(new_by_country)} countries")


def ascii_name(s: str) -> str:
    """A name in plain ASCII (accents dropped: Utqiagvik), for the UI font and the CSVs."""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.encode("ascii", "ignore").decode("ascii").strip()


def _compact(s: str) -> str:
    return text.fold(s).replace(" ", "")


def names_in(fragment: str, name: str) -> bool:
    """A place name in a notes fragment, matched on folded words without spaces or hyphens, so
    "In Salah" finds I-n-Salah and "Neryungri and Elga" finds Neryungri (D829)."""
    want = _compact(name)
    if len(want) < 4:
        return False
    words = text.fold(fragment).split()
    for i in range(len(words)):
        acc = ""
        for w in words[i:]:
            acc += w
            if acc == want:
                return True
            if len(acc) >= len(want):
                break
    return False


def note_fragments(notes: str) -> list[tuple[str, str]]:
    """The notes as (fragment, separator before it) at top-level semicolons and at top-level
    commas before a capital or a digit (not inside parentheses), so "Olympic Dam copper, uranium
    and gold" stays one fragment."""
    notes = notes or ""
    out, cur, sep, depth = [], "", "", 0
    for k, ch in enumerate(notes):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        nxt = notes[k + 1:].lstrip()[:1]
        if depth == 0 and (ch == ";" or (ch == "," and (nxt.isupper() or nxt.isdigit()))):
            if cur.strip():
                out.append((cur.strip(), sep))
            cur, sep = "", ch
            continue
        cur += ch
    if cur.strip():
        out.append((cur.strip(), sep))
    return out


def join_fragments(frags: list[tuple[str, str]]) -> str:
    out = ""
    for i, (f, sep) in enumerate(frags):
        out += f if i == 0 else (f"{sep} " if sep else ", ") + f
    return out


# Words of a resource tag in notes text: the fragment naming a giant's resource holds its site
# (D829).
RESOURCE_WORDS = {"Oil": ["oil"], "Gas": ["gas", "lng"], "Coal": ["coal"], "Copper": ["copper"],
                  "Lithium": ["lithium"], "Cobalt": ["cobalt"], "Nickel": ["nickel"],
                  "Rare earths": ["rare earth"], "Iron ore": ["iron"], "Gold": ["gold"],
                  "Uranium": ["uranium"], "Hydropower": ["hydro", "dam"], "Diamonds": ["diamond"],
                  "Platinum": ["platinum"], "Silver": ["silver"], "Zinc": ["zinc"]}


def _parts(pid, row, g, c: subdivide.Cut, sources, seeds, names_by_country, next_no, sites) -> dict:
    country = row["country"]
    towns = subdivide.towns_in(g, country, sources)

    def part_of(x, y):
        return next((j for j, p in enumerate(c.parts) if p.covers(shapely.Point(x, y))), None)

    part_towns = [[t for t in towns if p.covers(shapely.Point(t[1], t[2]))] for p in c.parts]
    # the original's main city: a place its name names, else one its notes name, else its first
    # crosswalk seed, else its most populous town, else a point inside its largest part
    name_parts = text.name_parts(row["name"])
    phrases = text.note_phrases(row["notes"])
    named = [t for t in towns if text.fold(t[3]) in name_parts]
    noted = [t for t in towns if any(text.contains_word(ph, text.fold(t[3])) for ph in phrases)]
    main_pt = None
    for cands in (named, noted):
        if cands:
            main_pt = (cands[0][1], cands[0][2], cands[0][3])
            break
    if main_pt is None:
        for x, y, label in seeds:
            if g.covers(shapely.Point(x, y)):
                main_pt = (x, y, label)
                break
    if main_pt is None and towns:
        main_pt = (towns[0][1], towns[0][2], towns[0][3])
    if main_pt is None:
        big = max(range(len(c.parts)), key=lambda i: c.areas[i])
        rp = c.parts[big].representative_point()
        main_pt = (rp.x, rp.y, "")
    main_i = part_of(main_pt[0], main_pt[1])
    # the other parts in id order: north to south, then west to east, by a point inside each
    others = [i for i in range(len(c.parts)) if i != main_i]
    reps = {i: c.parts[i].representative_point() for i in range(len(c.parts))}
    others.sort(key=lambda i: (-round(reps[i].y, 3), round(reps[i].x, 3), i))
    n = len(c.parts)
    # sites (D829): the builder's site points for this giant (`[giant_sites]` in the hints), then
    # its towns, found in each notes fragment; a fragment belongs to the part holding its first site
    site_pts = [(nm, float(v[0]), float(v[1])) for nm, v in sorted(sites.items()) if not nm.startswith("_")]
    frags = note_fragments(row["notes"])
    frag_part, frag_site = [], []
    for f, _ in frags:
        hit = next(((nm, x, y) for nm, x, y in site_pts if names_in(f, nm)), None)
        if hit is None:
            t = next((t for t in towns if names_in(f, t[3])), None)
            hit = (t[3], t[1], t[2]) if t else None
        frag_site.append(hit)
        frag_part.append(part_of(hit[1], hit[2]) if hit else None)
    # names: a part of the original's name whose place lies in the part, else a builder's site in
    # it, else its most populous town, else its largest ADM2 unit, each unused in the country;
    # else a compass name. ASCII only.
    pre = pid.split("-")[0]
    raw_parts = [p.strip() for p in row["name"].split("-") if p.strip()]
    used = names_by_country[country]
    name_of: dict[int, str] = {}
    anchor: dict[int, tuple] = {}  # part -> (lon, lat, label) inside it

    def take(i, nm, pt=None):
        nm = ascii_name(nm)
        f = text.fold(nm)
        if i is None or i == main_i or i in name_of or not f or len(f) < 3 or f in used:
            return False
        name_of[i] = nm
        used.add(f)
        if pt is not None:
            anchor[i] = pt
        return True

    for rp_ in raw_parts:
        hit = [t for t in towns if text.fold(t[3]) == text.fold(rp_)]
        if hit:
            take(part_of(hit[0][1], hit[0][2]), rp_, (hit[0][1], hit[0][2], hit[0][3]))
    for nm, x, y in site_pts:
        take(part_of(x, y), nm, (x, y, nm))
    for i in others:
        for t in part_towns[i]:
            if take(i, t[3], (t[1], t[2], t[3])):
                break
    blocks = subdivide.country_blocks(country, sources)[0] if c.blocks == "admin2" else None
    if blocks is not None:
        for i in others:
            if i in name_of:
                continue
            units = []
            for k in blocks.sindex.query(c.parts[i], predicate="intersects"):
                nm = blocks.shapeName.iloc[k]
                if not isinstance(nm, str) or any(ch.isdigit() for ch in nm) or "unincorporated" in nm.lower():
                    continue
                units.append((-c.parts[i].intersection(blocks.geometry.iloc[k]).area, nm))
            for _, nm in sorted(units):
                if take(i, nm):
                    break
    gc = g.representative_point()
    base = ascii_name(raw_parts[0] if raw_parts else row["region"])
    for i in others:
        if i in name_of:
            continue
        r = reps[i]
        nm = f"{base} {_compass(r.x - gc.x, r.y - gc.y)}"
        k = 2
        while text.fold(nm) in used:
            nm = f"{base} {_compass(r.x - gc.x, r.y - gc.y)} {k}"
            k += 1
        name_of[i] = nm
        used.add(text.fold(nm))
    # development (D823, Logan): the main part keeps the original's tracks; every new part 1/1/1
    tracks = {i: {k: (int(row[k]) if i == main_i else TRACK_MIN) for k in TRACKS} for i in range(n)}
    # a site resource goes to the part holding the site of the fragment that names the resource
    # (else of the first fragment with a site); the other parts take their terrain's background
    res = row["resource"]
    site_part = main_i
    if res not in SPREAD_RESOURCES:
        words = RESOURCE_WORDS.get(res, [text.fold(res)])
        cands = [j for j, (f, _) in enumerate(frags) if frag_part[j] is not None
                 and any(text.contains_word(text.fold(f), w) for w in words)]
        cands = cands or [j for j in range(len(frags)) if frag_part[j] is not None]
        if cands:
            site_part = frag_part[cands[0]]
        # the builder can name the resource's site outright (`_resource` in `[giant_sites]`)
        named_site = next(((x, y) for nm, x, y in site_pts if nm == sites.get("_resource")), None)
        if named_site is not None and part_of(*named_site) is not None:
            site_part = part_of(*named_site)
    background = TERRAIN_RESOURCE.get(row["terrain"], "None")
    res_of = {i: (res if res in SPREAD_RESOURCES or i == site_part else background) for i in range(n)}
    # notes (D829): a fragment whose site lies in another part moves there; the original keeps
    # the rest, and the crosswalk still places it from its old notes (`place_notes`)
    kept = [fr for fr, j in zip(frags, frag_part) if j in (None, main_i)]
    moved: dict[int, list[str]] = {}
    for (f, _), j in zip(frags, frag_part):
        if j is not None and j != main_i:
            moved.setdefault(j, []).append(f)
    parent_notes = join_fragments(kept) if kept else ", ".join(ascii_name(t[3]) for t in part_towns[main_i][:3])
    parent_upd = {k: str(tracks[main_i][k]) for k in TRACKS}
    parent_upd["resource"] = res_of[main_i]
    parent_upd["notes"] = parent_notes
    hint = [f"# D820: {pid} {row['name']} ({sum(c.areas):,.0f} km2) cut into {n} parts on {c.blocks} pieces",
            f"[subdivide.\"{pid}\"]", f"parts = {n}", f"whole_tol = {c.whole_tol}", f"blocks = \"{c.blocks}\"",
            f"main = [{main_pt[0]:.6f}, {main_pt[1]:.6f}]  # {main_pt[2]}"]
    if parent_notes != row["notes"]:
        hint.append("place_notes = " + json.dumps(row["notes"], ensure_ascii=False))
    hint += ["", f"[subdivide.\"{pid}\".children]"]
    points = []
    if main_pt[2]:
        points.append(f"{ascii_name(main_pt[2])} (main city of a split giant) | {main_pt[0]:.4f} | "
                      f"{main_pt[1]:.4f} | {pid}")
    part_ids = {main_i: pid}
    for i in others:
        part_ids[i] = f"{pre}-{next_no[pre]:04d}"
        next_no[pre] += 1
    for nm, x, y in site_pts:
        j = part_of(x, y)
        if j is not None:
            points.append(f"{nm} (site of a split giant) | {x:.4f} | {y:.4f} | {part_ids[j]}")
    children = []
    for i in others:
        cid = part_ids[i]
        top = [ascii_name(t[3]) for t in part_towns[i][:3]]
        rank = "Town" if part_towns[i] and part_towns[i][0][0] >= TOWN_RANK_POP else "none"
        note = ", ".join(moved.get(i, []))
        note += ("; " if note else "") + f"split from {pid} {row['name']} in the giant-province split (D820)"
        if top:
            note += "; towns: " + ", ".join(top)
        nr = {col: "" for col in row}
        nr.update({"id": cid, "name": name_of[i], "country": country, "region": row["region"], "area": row["area"],
                   "metro": "", "city_rank": rank, "resource": res_of[i], "terrain": row["terrain"],
                   "coastal": "N", "chokepoint": "", "contested": row["contested"], "linked_cities": "",
                   "notes": note})
        for t_ in TRACKS:
            nr[t_] = str(tracks[i][t_])
        children.append(nr)
        pt = anchor.get(i)
        if pt is None:
            rp = reps[i]
            pt = (rp.x, rp.y, "")
        hint.append(f"\"{cid}\" = [{pt[0]:.6f}, {pt[1]:.6f}]  # {name_of[i]}")
        if pt[2] and pt[2] not in sites:
            points.append(f"{ascii_name(pt[2])} (split part) | {pt[0]:.4f} | {pt[1]:.4f} | {cid}")
    hint.append("")
    summary = {"id": pid, "name": row["name"], "km2": round(sum(c.areas)),
               "parts": n, "blocks": c.blocks, "whole_tol": c.whole_tol,
               "areas": {part_ids[i]: round(c.areas[i]) for i in range(n)},
               "tracks_before": {k: int(row[k]) for k in TRACKS},
               "tracks_after": {k: sum(tracks[i][k] for i in range(n)) for k in TRACKS},
               "site_part": part_ids[site_part], "moved_notes": {part_ids[j]: v for j, v in moved.items()},
               "components": {part_ids[i]: len(subdivide.polys(c.parts[i])) for i in range(n)}}
    return {"parent": parent_upd, "children": children, "hint": "\n".join(hint), "points": points,
            "summary": summary}


def set_coastal(sources, log) -> None:
    """Each split part's `coastal` from mapgen's bitmap rule (D608): run after a world build."""
    changed = 0
    for slug in config.REGION_SLUGS:
        region = config.REGIONS[slug]
        sub = crosswalk.load_hints(region).get("subdivide", {})
        if not sub:
            continue
        ids = set(sub) | {c for s in sub.values() for c in s.get("children", {})}
        mq = {r["province_id"]: r for r in _read_csv(config.work_dir(slug, sources) / "mapgen-qa.csv")}
        path = config.DATA_DIR / region.csv
        rows = _read_csv(path)
        cols = list(rows[0].keys())
        for r in rows:
            if r["id"] in ids and r["id"] in mq:
                v = mq[r["id"]]["coastal_bitmap"]
                if v in ("Y", "N") and r["coastal"] != v:
                    r["coastal"] = v
                    changed += 1
        _write_rows(path, cols, rows)
    log(f"coastal flags changed: {changed}")
