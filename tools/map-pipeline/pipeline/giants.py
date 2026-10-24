"""`run.py giants`: measure every province, pick the giants and cut them (D820 to D829).

    uv run python run.py giants                 # measure and list the giants (reads the cache)
    uv run python run.py giants --write         # also cut them and write the data and hints
    uv run python run.py giants --coastal       # set the parts' coastal flags from mapgen's bitmap

Reads each region's `work/<region>/provinces.geojson` (the last pipeline run) for the areas, so
run it on a world built before the split. `--write` rebuilds each giant's shape exactly as the
shapes step does (shapes.build_region from the region's plan.json), cuts it with
`subdivide.choose`, and writes:

- the new province rows in the region's CSV (after the country's last row) and the parents'
  rows, with development divided by town population (D823), and the countries'
  `provinces_planned`;
- a `[subdivide."<id>"]` table per giant in the region's hints file (the cut's numbers and one
  point per part, which the shapes step maps parts to ids by);
- a city probe point (checks/city-points.txt) for every part named after a town and every
  original's main city.

It runs once, on the unsplit world: it stops if any hints file has a `[subdivide]` table already.
"""

from __future__ import annotations

import csv
import io
import json
import math
from collections import defaultdict

import geopandas as gpd
import shapely

from . import config, crosswalk, shapes, subdivide, text

# A part's own town gives it city rank Town from this population (Natural Earth POP_MAX) up.
TOWN_RANK_POP = 20_000
# Population weight of a part with no town, as a share of the giant's mean town population per
# part (so a townless part still gets a little more than the floor when there is room).
EMPTY_PART_WEIGHT = 0.05
# The main part's extra weight, as a share of all the parts' weight (D823).
MAIN_PART_WEIGHT = 1.0
# Resources a part takes from its parent as they are (spread over the land); a site resource
# (a mine, a field, a dam) stays with the main part and the part holding the place the parent's
# notes name first; other parts get their terrain's background resource.
SPREAD_RESOURCES = {"Farmland", "Timber", "Fishing", "None"}
TERRAIN_RESOURCE = {"Tropical": "Timber", "Temperate": "Timber", "Wetland": "Timber", "Mountain": "None",
                    "Desert": "None", "Arctic": "None", "Urban": "None"}
TRACKS = ("commerce", "industry", "population")
TRACK_MIN = 1
TRACK_MAX = 30
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


def alloc(v: int, weights: list[float]) -> list[int]:
    """v development points over the parts: each at least TRACK_MIN, the rest by largest
    remainder of the weights (ties to the earlier part, the main part first)."""
    n = len(weights)
    base = [TRACK_MIN] * n
    rest = v - TRACK_MIN * n
    if rest <= 0:
        return base
    tot = sum(weights) or float(n)
    w = weights if sum(weights) > 0 else [1.0] * n
    quota = [rest * x / tot for x in w]
    got = [int(math.floor(q)) for q in quota]
    left = rest - sum(got)
    order = sorted(range(n), key=lambda i: (-(quota[i] - got[i]), i))
    for i in order[:left]:
        got[i] += 1
    return [min(TRACK_MAX, b + g) for b, g in zip(base, got)]


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
            res = _parts(pid, row, g, c, sources, seeds_all.get(pid, []), names_by_country, next_no)
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


def _parts(pid, row, g, c: subdivide.Cut, sources, seeds, names_by_country, next_no) -> dict:
    country = row["country"]
    towns = subdivide.towns_in(g, country, sources)
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
    main_i = next(i for i, p in enumerate(c.parts) if p.covers(shapely.Point(main_pt[0], main_pt[1])))
    # the other parts in id order: north to south, then west to east, by a point inside each
    others = [i for i in range(len(c.parts)) if i != main_i]
    reps = {i: c.parts[i].representative_point() for i in range(len(c.parts))}
    others.sort(key=lambda i: (-round(reps[i].y, 3), round(reps[i].x, 3), i))
    order = [main_i] + others
    # names: a part of the original's name whose place lies in the part, else the part's most
    # populous town not already a province name of the country, else a compass name
    pre = pid.split("-")[0]
    raw_parts = [p.strip() for p in row["name"].split("-") if p.strip()]
    used = names_by_country[country]
    name_of: dict[int, str] = {}
    for rp_ in raw_parts:
        f = text.fold(rp_)
        hit = [t for t in towns if text.fold(t[3]) == f]
        if not hit:
            continue
        i = next(j for j, p in enumerate(c.parts) if p.covers(shapely.Point(hit[0][1], hit[0][2])))
        if i != main_i and i not in name_of:
            name_of[i] = rp_
    anchor = {}  # part -> (lon, lat, label) inside it
    for i in others:
        if i in name_of:
            t = next(t for t in part_towns[i] if text.fold(t[3]) == text.fold(name_of[i]))
            anchor[i] = (t[1], t[2], t[3])
            continue
        for t in part_towns[i]:
            f = text.fold(t[3])
            if f and f not in used and len(f) >= 3:
                name_of[i] = t[3]
                anchor[i] = (t[1], t[2], t[3])
                break
    gc = g.representative_point()
    base = raw_parts[0] if raw_parts else row["region"]
    for i in others:
        if i in name_of:
            used.add(text.fold(name_of[i]))
            continue
        r = reps[i]
        nm = f"{base} {_compass(r.x - gc.x, r.y - gc.y)}"
        k = 2
        while text.fold(nm) in used:
            nm = f"{base} {_compass(r.x - gc.x, r.y - gc.y)} {k}"
            k += 1
        name_of[i] = nm
        used.add(text.fold(nm))
    # the original keeps its name: the crosswalk seeds it from its name, so a new name would move
    # its shape (and the anchor check gives a name part another province's whole name to that
    # province, D679)
    parent_name = row["name"]
    # development by town population (D823)
    P = sum(t[0] for t in towns)
    n = len(c.parts)
    if P > 0:
        w = {i: sum(t[0] for t in part_towns[i]) + EMPTY_PART_WEIGHT * P / n for i in range(n)}
    else:
        w = {i: c.areas[i] for i in range(n)}
    # the original's main city is what its tracks describe: the main part weighs as much again as
    # every part together, so it keeps at least half of what the floors leave (D823)
    w[main_i] += sum(w.values()) * MAIN_PART_WEIGHT
    tracks = {k: alloc(int(row[k]), [w[i] for i in order]) for k in TRACKS}
    # resources (D824)
    res = row["resource"]
    site_part = None
    if res not in SPREAD_RESOURCES:
        for ph in phrases:
            hit = [t for t in towns if text.contains_word(ph, text.fold(t[3]))]
            if hit:
                site_part = next(j for j, p in enumerate(c.parts) if p.covers(shapely.Point(hit[0][1], hit[0][2])))
                break
    parent_upd = {k: str(tracks[k][0]) for k in TRACKS}
    parent_upd["name"] = parent_name
    # the notes stay too: the crosswalk seeds the original from them
    children = []
    hint = [f"# D820: {pid} {row['name']} ({sum(c.areas):,.0f} km2) cut into {n} parts on {c.blocks} pieces",
            f"[subdivide.\"{pid}\"]", f"parts = {n}", f"whole_tol = {c.whole_tol}", f"blocks = \"{c.blocks}\"",
            f"main = [{main_pt[0]:.6f}, {main_pt[1]:.6f}]  # {main_pt[2]}", "",
            f"[subdivide.\"{pid}\".children]"]
    points = []
    if main_pt[2]:
        points.append(f"{main_pt[2]} (main city of a split giant) | {main_pt[0]:.4f} | {main_pt[1]:.4f} | {pid}")
    part_ids = {main_i: pid}
    for k, i in enumerate(others, start=1):
        cid = f"{pre}-{next_no[pre]:04d}"
        next_no[pre] += 1
        part_ids[i] = cid
        top = [t[3] for t in part_towns[i][:3]]
        if res in SPREAD_RESOURCES or i == site_part:
            r_ = res
        else:
            r_ = TERRAIN_RESOURCE.get(row["terrain"], "None")
        rank = "Town" if part_towns[i] and part_towns[i][0][0] >= TOWN_RANK_POP else "none"
        note = f"split from {pid} {row['name']} in the giant-province split (D820)"
        if top:
            note += "; towns: " + ", ".join(top)
        nr = {col: "" for col in row}
        nr.update({"id": cid, "name": name_of[i], "country": country, "region": row["region"], "area": row["area"],
                   "metro": "", "city_rank": rank, "resource": r_, "terrain": row["terrain"],
                   "coastal": "N", "chokepoint": "", "contested": row["contested"], "linked_cities": "",
                   "notes": note})
        for t_ in TRACKS:
            nr[t_] = str(tracks[t_][k])
        children.append(nr)
        pt = anchor.get(i)
        if pt is None:
            rp = reps[i]
            pt = (rp.x, rp.y, "")
        hint.append(f"\"{cid}\" = [{pt[0]:.6f}, {pt[1]:.6f}]  # {name_of[i]}")
        if pt[2]:
            points.append(f"{pt[2]} (split part) | {pt[0]:.4f} | {pt[1]:.4f} | {cid}")
    hint.append("")
    summary = {"id": pid, "name": row["name"], "parent_name": parent_name, "km2": round(sum(c.areas)),
               "parts": n, "blocks": c.blocks, "whole_tol": c.whole_tol,
               "areas": {part_ids[i]: round(c.areas[i]) for i in range(n)},
               "tracks_before": {k: int(row[k]) for k in TRACKS},
               "tracks_after": {k: sum(tracks[k]) for k in TRACKS},
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
