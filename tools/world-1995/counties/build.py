"""Build the 1995 world's county tables (pivot 5.1, 5.4; D1027, D1028). Standard library only.

Run, after fetch.py and after tools/world-1995/gen.py (the state leans are read from its output):

    python -I -B tools/world-1995/counties/build.py

Writes assets/worlds/1995/counties.csv and county-adjacency.csv, and sets `features.counties` and
the two row counts in manifest.json. Prints every vintage patch it made. README.md explains each
source, formula and exception; validate.py checks the result.
"""

import collections
import csv
import io
import json
import math
import os
import re
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rdata  # noqa: E402  (this folder's reader for R save() files)

RAW = os.path.join(HERE, "raw")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.join(ROOT, "assets", "worlds", "1995")

# ---------------------------------------------------------------- tuning values (README.md, "Formulas")

# pivot 5.1: the frozen vintage has this many counties (D1028).
COUNTY_COUNT = 3142

# Which presidential returns the county-minus-state offsets and the turnout come from (D1027):
# "1992" is the Algara-Amlani county file with 1990 census residents, "2000" the MIT Election Lab
# file with 2000 census residents. Alaska is statewide either way.
RETURNS_YEAR = "1992"

# pivot 5.4 spread (D1028): half the range of lean inside a county, in points.
#   spread = SPREAD_MAX_PTS * size * (SPREAD_DENSITY_FLOOR + (1 - SPREAD_DENSITY_FLOOR) * dens)
#   size = where log10(people) lies between SPREAD_POP_LO and SPREAD_POP_HI, 0 to 1
#   dens = where log10(people per square mile of land) lies between SPREAD_DENSITY_LO and _HI, 0 to 1
SPREAD_MAX_PTS = 45.0
SPREAD_POP_LO = 20_000.0
SPREAD_POP_HI = 1_000_000.0
SPREAD_DENSITY_LO = 20.0
SPREAD_DENSITY_HI = 2_000.0
SPREAD_DENSITY_FLOOR = 0.5
# lean + spread and lean - spread stay inside this (points).
LEAN_LIMIT_PTS = 100.0
# A county's own lean is clamped to this before the state is re-centred.
LEAN_CLAMP_PTS = 95.0
# How many clamp-and-re-centre passes a state gets (one is enough unless a county hits the clamp).
RECENTRE_PASSES = 8

# pivot 5.1 elasticity: every county starts the same; M2's drift moves it (pivot 5.2).
ELASTICITY_DEFAULT = 1.0

# pivot 5.1 turnout: presidential votes over residents of every age, clamped.
TURNOUT_MIN = 0.15
TURNOUT_MAX = 0.7

# Decimal places written.
LEAN_DP = 2
SPREAD_DP = 2
TURNOUT_DP = 3
CENTROID_DP = 3

# ---------------------------------------------------------------- the vintage (README.md, "Vintage")

# State FIPS code to the state's name in politics-usa.csv.
STATE_NAMES = {
    "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas", "06": "California",
    "08": "Colorado", "09": "Connecticut", "10": "Delaware", "11": "District of Columbia",
    "12": "Florida", "13": "Georgia", "15": "Hawaii", "16": "Idaho", "17": "Illinois",
    "18": "Indiana", "19": "Iowa", "20": "Kansas", "21": "Kentucky", "22": "Louisiana",
    "23": "Maine", "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
    "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska", "32": "Nevada",
    "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico", "36": "New York",
    "37": "North Carolina", "38": "North Dakota", "39": "Ohio", "40": "Oklahoma", "41": "Oregon",
    "42": "Pennsylvania", "44": "Rhode Island", "45": "South Carolina", "46": "South Dakota",
    "47": "Tennessee", "48": "Texas", "49": "Utah", "50": "Vermont", "51": "Virginia",
    "53": "Washington", "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming",
}  # fmt: skip

# 2010-census codes the frozen vintage writes differently (the us-atlas 3.0.1 ids, D1028): Shannon
# County SD was renamed Oglala Lakota in 2015 and Wade Hampton Census Area AK Kusilvak in 2015.
RENAMED = {"46113": "46102", "02270": "02158"}
RENAMED_NAMES = {"46102": "Oglala Lakota County", "02158": "Kusilvak Census Area"}
# 2010 counties merged into a neighbour: Bedford city VA joined Bedford County in 2013.
MERGED_2010 = {"51515": "51019"}
# 2000-census counties gone by 2010, added whole to a neighbour: Clifton Forge city VA joined
# Alleghany County in 2001.
MERGED_2000 = {"51560": "51005"}
# 1990-census counties gone by 2000, which PHC-T-4's 1990 column leaves out of their successors
# (fips of successor, name, 1990 census count). South Boston city VA joined Halifax County in 1995.
MISSING_1990 = [
    ("51083", "South Boston city VA", 6997),
    # Yellowstone National Park MT (30113) was divided between Gallatin and Park counties in 1997;
    # its 52 people are put in Park County, which has the park's north entrance.
    ("30067", "Yellowstone National Park MT", 52),
]
# 2000-census areas of Alaska split by 2010: each old area's people go to its successors by the
# successors' share of the 2000 estimates base.
SPLIT_2000 = {
    "02232": ["02105", "02230"],  # Skagway-Hoonah-Angoon: Hoonah-Angoon, Skagway (2007)
    "02280": ["02195", "02275"],  # Wrangell-Petersburg: Petersburg, Wrangell (2008)
}
# Prince of Wales-Outer Ketchikan AK (2008): Outer Ketchikan went to Ketchikan Gateway Borough, the
# rest became Prince of Wales-Hyder. The share that moved is Ketchikan Gateway's gain between the
# 2000 count (2000 lines) and the 2000 estimates base (2010 lines).
POW_OLD, POW_NEW, POW_GAINER = "02201", "02198", "02130"
# Broomfield CO was made in 2001 from the parts of these four that the city of Broomfield lay in.
# Its 1990 people are the city's 1990 census count, taken from the four in proportion to what each
# lost between the 2000 count and the 2000 estimates base.
BROOMFIELD = "08014"
BROOMFIELD_PARENTS = ["08001", "08013", "08059", "08123"]
BROOMFIELD_1990 = 24638

# Return units that are not counties of the vintage: add their votes to this county. Kansas City MO
# is reported apart from the rest of Jackson County (MIT); Dade County FL was renumbered Miami-Dade
# in 1997 and South Boston city VA joined Halifax County in 1995 (both in the 1992 file).
VOTES_INTO = {"36000": "29095", "12025": "12086", "51780": "51083"}
# Counties with no return of their own take the pooled split and turnout of these: Broomfield of
# its parents, Kalawao HI of Maui (where the MIT file counts its votes).
VOTES_FROM = {BROOMFIELD: BROOMFIELD_PARENTS, "15005": ["15009"]}
# Alaska has no borough returns (the MIT rows are state house districts; the 1992 file leaves the
# state out): every borough takes the state's lean, and the state's turnout of 2000.
STATEWIDE_ONLY = "02"
# Total votes the 1992 file has wrong: St. Louis County MO carries twice its two-party vote
# (848,090), which puts the state 313,074 above its official total of 2,391,565. This is the total
# that makes the state sum right.
TOTAL_FIX_1992 = {"29189": 535016}

# Ferry and bridge edges the Census adjacency file lacks (README.md, "Adjacency"). Hawaii's islands:
# the file joins only Maui and Kalawao.
FERRY_EDGES = [
    ("15001", "15009"),  # Hawaii - Maui (Alenuihaha Channel)
    ("15003", "15009"),  # Honolulu - Maui (Kaiwi Channel: Oahu to Molokai, which is Maui County)
    ("15003", "15007"),  # Honolulu - Kauai (Kauai Channel)
]


def raw(*p: str) -> str:
    return os.path.join(RAW, *p)


def vintage(code: str) -> str:
    """A 2000 or 2010 census code as the frozen vintage writes it (merged units give their heir)."""
    code = RENAMED.get(code, code)
    code = MERGED_2000.get(code, code)
    return MERGED_2010.get(code, code)


# ---------------------------------------------------------------- readers


def read_adjacency() -> dict[str, set[str]]:
    """The Census file lists each county, then its neighbours (itself included). Line 9629 of the
    2010 file has Watonwan County MN's code but not its name, so a block is keyed on the code
    column, and pairs are made two-way at the end."""
    adj: dict[str, set[str]] = collections.defaultdict(set)
    cur = ""
    with open(raw("adjacency", "county_adjacency2010.txt"), encoding="latin-1") as f:
        for line in f:
            p = line.rstrip("\r\n").split("\t")
            if len(p) < 4:
                continue
            if p[1]:
                cur = p[1]
            if cur[:2] not in STATE_NAMES:
                continue
            a = vintage(cur)
            adj[a]  # a county with no neighbour still exists
            if p[3][:2] in STATE_NAMES and vintage(p[3]) != a:
                adj[a].add(vintage(p[3]))
    one_way = 0
    for c in sorted(adj):
        for n in sorted(adj[c]):
            if c not in adj[n]:
                adj[n].add(c)
                one_way += 1
    print(f"adjacency: {one_way} one-way pairs made two-way")
    for a, b in FERRY_EDGES:
        if b in adj[a]:
            raise SystemExit(f"ferry edge {a}-{b} is already in the Census file")
        adj[a].add(b)
        adj[b].add(a)
    print(f"adjacency: {len(FERRY_EDGES)} ferry edges added")
    return dict(adj)


def read_names() -> dict[str, str]:
    out = {}
    with open(raw("fips", "national_county.txt"), encoding="latin-1") as f:
        for row in csv.reader(f):
            if len(row) >= 4 and row[1] in STATE_NAMES:
                out[row[1] + row[2]] = row[3]
    return out


def read_base2000() -> dict[str, int]:
    """The 2000 estimates base: the 2000 count on 2010 county lines, with count corrections."""
    out = {}
    with open(raw("pop2000int", "co-est00int-tot.csv"), encoding="latin-1") as f:
        for r in csv.DictReader(f):
            if int(r["SUMLEV"]) == 50:
                out[f"{int(r['STATE']):02d}{int(r['COUNTY']):03d}"] = int(r["ESTIMATESBASE2000"])
    return out


def read_phct4() -> dict[str, tuple[int, int]]:
    """The 1990 and 2000 census counts on 2000 county lines."""
    out = {}
    pat = re.compile(r"^(\d{5})\s+(.+?)\s+([A-Z]{2})\s+([\d,]+)\s+([\d,]+)")
    with open(raw("phct4", "tab01.txt"), encoding="latin-1") as f:
        for line in f:
            m = pat.match(line)
            if m:
                out[m.group(1)] = (int(m.group(4).replace(",", "")), int(m.group(5).replace(",", "")))
    return out


def read_land_sqmi() -> dict[str, float]:
    """Land area of each 2010 county, square miles (2010 Gazetteer `ALAND_SQMI`)."""
    out = {}
    with zipfile.ZipFile(raw("gazetteer", "Gaz_counties_national.zip")) as z:
        text = z.read("Gaz_counties_national.txt").decode("latin-1")
    for r in csv.DictReader(io.StringIO(text), delimiter="\t"):
        r = {k.strip(): v.strip() for k, v in r.items() if k}
        if r["GEOID"][:2] in STATE_NAMES:
            out[r["GEOID"]] = float(r["ALAND_SQMI"])
    return out


def read_votes_2000() -> dict[str, list[int]]:
    """Democratic, Republican and total presidential votes of 2000 per return unit (MIT). The total
    is the sum of the unit's candidate rows: the file's `totalvotes` is wrong for the five Virginia
    counties that share a name with a city (Bedford, Fairfax, Franklin, Richmond, Roanoke), where
    both rows carry the pair's sum. A unit with no code is keyed `NA:<state>:<name>`."""
    votes: dict[str, list[int]] = collections.defaultdict(lambda: [0, 0, 0])
    with open(raw("mit", "countypres_2000-2016.csv"), encoding="latin-1") as f:
        for r in csv.DictReader(f):
            if r["year"] != "2000":
                continue
            key = f"{int(r['FIPS']):05d}" if r["FIPS"] != "NA" else f"NA:{r['state_po']}:{r['county']}"
            v = 0 if r["candidatevotes"] == "NA" else int(r["candidatevotes"])
            if r["party"] == "democrat":
                votes[key][0] += v
            elif r["party"] == "republican":
                votes[key][1] += v
            votes[key][2] += v
    return votes


def read_votes_1992() -> dict[str, list[int]]:
    """Democratic, Republican and total presidential votes of 1992 per county (Algara and Amlani)."""
    d = rdata.load(raw("algara", "dataverse_shareable_presidential_county_returns_1868_2020.Rdata"))
    t = d["pres_elections_release"]
    votes = {}
    for i, year in enumerate(t["election_year"]):
        if year != 1992.0:
            continue
        fips = t["fips"][i]
        total = TOTAL_FIX_1992.get(fips, int(t["raw_county_vote_totals"][i]))
        if fips in TOTAL_FIX_1992:
            print(f"votes: {fips} total {int(t['raw_county_vote_totals'][i])} replaced by {total}")
        votes[fips] = [int(t["democratic_raw_votes"][i]), int(t["republican_raw_votes"][i]), total]
    us = [sum(v[i] for v in votes.values()) for i in range(3)]
    print(f"votes: the 1992 file has {len(votes)} counties; {us[0]} D, {us[1]} R, {us[2]} total (no Alaska)")
    return votes


def read_centroids() -> dict[str, tuple[float, float]]:
    """The area centroid of each county in the us-atlas Albers plane (975 by 610 units)."""
    with open(raw("usatlas", "counties-albers-10m.json"), encoding="utf-8") as f:
        topo = json.load(f)
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(idx: list[int]) -> list[tuple[float, float]]:
        pts: list[tuple[float, float]] = []
        for i in idx:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(a if not pts else a[1:])
        return pts

    out = {}
    flat = []
    for g in topo["objects"]["counties"]["geometries"]:
        polys = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        area = cx = cy = 0.0
        for poly in polys:
            pts = ring(poly[0])  # the outer ring; holes are other counties
            a = px = py = 0.0
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                c = x0 * y1 - x1 * y0
                a += c
                px += (x0 + x1) * c
                py += (y0 + y1) * c
            if a != 0.0:
                area += abs(a) / 2
                cx += px / (3 * a) * abs(a) / 2
                cy += py / (3 * a) * abs(a) / 2
        if area > 0.0:
            out[g["id"]] = (cx / area, cy / area)
        else:
            # Too small for the 10m file: the shape is a sliver of no area. Use its ring's mean point.
            pts = ring(polys[0][0])
            out[g["id"]] = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
            flat.append(g["id"])
    print(f"centroids: shapes of no area at this resolution, given their ring's mean point: {sorted(flat)}")
    return out


# ---------------------------------------------------------------- the tables


def split_whole(total: int, weights: list[float]) -> list[int]:
    """`total` people split by `weights`, in whole people (largest remainder, ties to the first)."""
    s = sum(weights)
    exact = [total * w / s for w in weights]
    out = [math.floor(e) for e in exact]
    order = sorted(range(len(weights)), key=lambda i: (-(exact[i] - out[i]), i))
    for i in order[: total - sum(out)]:
        out[i] += 1
    return out


def census_on_vintage(
    ids: list[str], phc: dict[str, tuple[int, int]], base: dict[str, int], col: int, say: bool
) -> dict[str, int]:
    """A census count of PHC-T-4 (`col` 0 is 1990, 1 is 2000) on the frozen vintage, before
    Broomfield is carved out of its parents (README.md, "pop_1990")."""
    year = ("1990", "2000")[col]
    pop = dict.fromkeys(ids, 0)
    for old, counts in sorted(phc.items()):
        n = counts[col]
        if old in SPLIT_2000:
            heirs = SPLIT_2000[old]
            parts = split_whole(n, [float(base[h]) for h in heirs])
            for h, part in zip(heirs, parts):
                pop[h] += part
            if say:
                print(f"pop_{year}: {old} ({n}) split over {dict(zip(heirs, parts))} by 2000 base")
        elif old == POW_OLD:
            moved_2000 = base[POW_GAINER] - phc[POW_GAINER][1]
            to_gainer, to_new = split_whole(n, [float(moved_2000), float(counts[1] - moved_2000)])
            pop[POW_GAINER] += to_gainer
            pop[POW_NEW] += to_new
            if say:
                print(
                    f"pop_{year}: {old} ({n}): {to_gainer} to {POW_GAINER}, {to_new} to {POW_NEW} "
                    f"({moved_2000} of its {counts[1]} people of 2000 moved)"
                )
        else:
            new = vintage(old)
            if new != old and say:
                print(f"pop_{year}: {old} ({n}) counted as {new}")
            pop[new] += n
    if col == 0:
        for heir, name, n in MISSING_1990:
            pop[heir] += n
            if say:
                print(f"pop_{year}: {name} ({n}) added to {heir}")
    return pop


def carve_broomfield(pop: dict[str, int], phc: dict[str, tuple[int, int]], base: dict[str, int]) -> dict[str, int]:
    """The 1990 counts with Broomfield's BROOMFIELD_1990 people taken from its four parents."""
    out = dict(pop)
    lost = [max(0, phc[p][1] - base[p]) for p in BROOMFIELD_PARENTS]
    for p, n, moved in zip(BROOMFIELD_PARENTS, lost, split_whole(BROOMFIELD_1990, [float(n) for n in lost])):
        out[p] -= moved
        print(f"pop_1990: {p} gives {moved} to {BROOMFIELD} ({n} of its {phc[p][1]} people of 2000 moved)")
    out[BROOMFIELD] += BROOMFIELD_1990
    print(f"pop_1990: {BROOMFIELD} has {BROOMFIELD_1990}; its 2000 base is {base[BROOMFIELD]}")
    return out


def returns_on_vintage(
    ids: list[str], phc: dict[str, tuple[int, int]], base: dict[str, int]
) -> dict[str, tuple[float, float]]:
    """Each county's margin in the returns of RETURNS_YEAR (Democratic minus Republican, in points
    of the total vote) and its turnout (total votes over the residents of that census), or the
    stand-in for a county with no return of its own. Residents are on the returns' own county lines:
    Broomfield's people are still in its parents."""
    mit = read_votes_2000()
    if RETURNS_YEAR == "1992":
        unit_votes = read_votes_1992()
        people = census_on_vintage(ids, phc, base, 0, False)
    elif RETURNS_YEAR == "2000":
        unit_votes = mit
        people = census_on_vintage(ids, phc, base, 1, False)
    else:
        raise SystemExit(f"RETURNS_YEAR {RETURNS_YEAR} is not 1992 or 2000")
    votes: dict[str, list[int]] = collections.defaultdict(lambda: [0, 0, 0])
    stray = []
    for key, v in sorted(unit_votes.items()):
        if key.startswith("NA:"):
            if sum(v):
                stray.append((key, v))
            continue
        if key[:2] == STATEWIDE_ONLY:
            continue
        unit = vintage(VOTES_INTO.get(key, key))
        if unit != key:
            print(f"votes: {key} {v} added to {unit}")
        for i in range(3):
            votes[unit][i] += v[i]
    print(f"votes: return units with votes and no county code: {stray}")
    unknown = sorted(set(votes) - set(ids))
    if unknown:
        raise SystemExit(f"votes: return units that are not counties of the vintage: {unknown}")

    def pooled(units: list[str]) -> tuple[float, float]:
        d = sum(votes[u][0] for u in units)
        r = sum(votes[u][1] for u in units)
        t = sum(votes[u][2] for u in units)
        return 100.0 * (d - r) / t, t / sum(people[u] for u in units)

    out = {}
    # The statewide state: its 2000 votes over its 2000 residents, the same for every county, so
    # each lands on the state's lean.
    units = [k for k in mit if k[:2] == STATEWIDE_ONLY or k.startswith("NA:AK:")]
    d, r, t = (sum(mit[u][i] for u in units) for i in range(3))
    residents = sum(n for c, (_, n) in phc.items() if c[:2] == STATEWIDE_ONLY)
    for c in ids:
        if c[:2] == STATEWIDE_ONLY:
            out[c] = (100.0 * (d - r) / t, t / residents)
    print(f"votes: Alaska is statewide: {len(units)} return units of 2000, {d} D, {r} R, {t} total, {residents} residents")
    for c in ids:
        if c in out:
            continue
        if votes[c][2] > 0:
            out[c] = pooled([c])
        elif c in VOTES_FROM:
            out[c] = pooled(VOTES_FROM[c])
            print(f"votes: {c} has no return; given the pooled split and turnout of {VOTES_FROM[c]}")
        else:
            raise SystemExit(f"votes: {c} has no return and no stand-in")
    return out


def state_leans() -> dict[str, float]:
    """politics-usa.csv `dem_margin_pts`: the state's 1992 presidential margin against the nation's."""
    with open(os.path.join(OUT, "politics-usa.csv"), encoding="utf-8", newline="") as f:
        return {r["state"]: float(r["dem_margin_pts"]) for r in csv.DictReader(f)}


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def leans(ids: list[str], pop: dict[str, int], margin: dict[str, tuple[float, float]]) -> dict[str, float]:
    """D1027: a county's lean is its state's lean plus the county's margin in the returns less the
    state's, shifted so the people-weighted mean of the state's counties is the state's lean."""
    want = state_leans()
    out = {}
    for code, state in sorted(STATE_NAMES.items()):
        cs = [c for c in ids if c[:2] == code]
        people = sum(pop[c] for c in cs)
        lean = {c: want[state] + margin[c][0] for c in cs}
        for _ in range(RECENTRE_PASSES):
            mean = sum(pop[c] * lean[c] for c in cs) / people
            lean = {c: clamp(lean[c] - (mean - want[state]), -LEAN_CLAMP_PTS, LEAN_CLAMP_PTS) for c in cs}
        out.update(lean)
    return out


def unit(x: float, lo: float, hi: float) -> float:
    """Where log10(x) lies between lo and hi, 0 to 1."""
    if x <= lo:
        return 0.0
    return clamp(math.log10(x / lo) / math.log10(hi / lo), 0.0, 1.0)


def spread_of(people: int, land_sqmi: float, lean: float) -> float:
    """pivot 5.4 (D1028): near 0 for a small rural county, large for a big urban one."""
    size = unit(float(people), SPREAD_POP_LO, SPREAD_POP_HI)
    dens = unit(people / land_sqmi, SPREAD_DENSITY_LO, SPREAD_DENSITY_HI) if land_sqmi > 0 else 0.0
    s = SPREAD_MAX_PTS * size * (SPREAD_DENSITY_FLOOR + (1.0 - SPREAD_DENSITY_FLOOR) * dens)
    return max(0.0, min(s, LEAN_LIMIT_PTS - abs(lean)))


def num(x: float, dp: int) -> str:
    s = f"{x:.{dp}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def main() -> int:
    adj = read_adjacency()
    ids = sorted(adj)
    if len(ids) != COUNTY_COUNT:
        raise SystemExit(f"the vintage has {len(ids)} counties, expected {COUNTY_COUNT}")
    names = read_names()
    names.update(RENAMED_NAMES)
    base = read_base2000()
    phc = read_phct4()
    land = dict.fromkeys(ids, 0.0)
    for c, a in read_land_sqmi().items():
        land[vintage(c)] += a
    for old, new in RENAMED.items():
        base[new] = base[old]
    cen = read_centroids()
    for what, have in (("name", names), ("2000 base", base), ("shape", cen)):
        missing = [c for c in ids if c not in have]
        if missing:
            raise SystemExit(f"counties with no {what}: {missing}")
    no_land = [c for c in ids if not land[c] > 0.0]
    if no_land:
        raise SystemExit(f"counties with no land area: {no_land}")
    print(f"centroids: us-atlas shapes outside the vintage: {sorted(set(cen) - set(ids))}")

    pop = carve_broomfield(census_on_vintage(ids, phc, base, 0, True), phc, base)
    empty = [c for c in ids if pop[c] <= 0]
    if empty:
        raise SystemExit(f"counties with no 1990 people: {empty}")
    margin = returns_on_vintage(ids, phc, base)
    lean = leans(ids, pop, margin)

    rows = []
    for c in ids:
        l = round(lean[c], LEAN_DP)
        rows.append(
            {
                "fips": c,
                "state": STATE_NAMES[c[:2]],
                "name": names[c],
                "pop_1990": pop[c],
                "lean_pts": num(l, LEAN_DP),
                "spread": num(spread_of(pop[c], land[c], l), SPREAD_DP),
                "elasticity": num(ELASTICITY_DEFAULT, 2),
                "turnout": num(clamp(margin[c][1], TURNOUT_MIN, TURNOUT_MAX), TURNOUT_DP),
                "centroid_x": num(cen[c][0], CENTROID_DP),
                "centroid_y": num(cen[c][1], CENTROID_DP),
            }
        )
    with open(os.path.join(OUT, "counties.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    pairs = [(a, b) for a in ids for b in sorted(adj[a])]
    with open(os.path.join(OUT, "county-adjacency.csv"), "w", encoding="utf-8", newline="") as f:
        f.write("fips,neighbour_fips\n")
        f.writelines(f"{a},{b}\n" for a, b in pairs)

    path = os.path.join(OUT, "manifest.json")
    with open(path, encoding="utf-8") as f:
        manifest = json.load(f)
    manifest["expected_counts"]["counties"] = len(rows)
    manifest["expected_counts"]["county-adjacency"] = len(pairs)
    manifest["features"]["counties"] = True
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    low = sorted(c for c in ids if margin[c][1] < TURNOUT_MIN)
    high = sorted(c for c in ids if margin[c][1] > TURNOUT_MAX)
    print(f"turnout: raised to {TURNOUT_MIN} in {low}, lowered to {TURNOUT_MAX} in {high}")
    print(f"leans at the clamp: {sorted(c for c in ids if abs(lean[c]) >= LEAN_CLAMP_PTS)}")
    print(f"wrote {len(rows)} counties ({sum(pop.values())} people in 1990), {len(pairs)} adjacency rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
