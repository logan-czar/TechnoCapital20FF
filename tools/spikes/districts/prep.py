"""Join the raw downloads into one county table on the 2010 county vintage. Standard library only.

Run: python -I -B prep.py            (after fetch.py)
Writes raw/derived/counties.json (gitignored) and prints every vintage mismatch it patched.

The frozen set is the 2010 census's 3,143 counties and equivalents of the 50 states and DC,
which is the set of the Census adjacency file. README.md says why.
"""

import collections
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")

# us-atlas 3.0.1 is the 2017 boundary edition; these are its ids for 2010-vintage counties.
ATLAS_ID = {"46113": "46102", "02270": "02158", "51515": "51019"}
# 2000 returns reported for a unit that is not a 2010 county: add its votes to this county.
VOTES_INTO = {"36000": "29095", "51560": "51005"}  # Kansas City MO; Clifton Forge VA
# 2010 counties with no 2000 return of their own: borrow the two-party split of these.
VOTES_FROM = {"08014": ["08001", "08013", "08059", "08123"]}  # Broomfield CO


def path(*p: str) -> str:
    return os.path.join(RAW, *p)


def read_adjacency() -> dict[str, set[str]]:
    """The Census file lists each county, then its neighbours (itself included). Row 9629 of the 2010
    file has Watonwan County MN's code but not its name, so its block reads as Washington County's:
    take the county of a block from the code column when it is filled, and symmetrise at the end.
    """
    adj: dict[str, set[str]] = collections.defaultdict(set)
    cur = ""
    with open(path("adjacency", "county_adjacency2010.txt"), encoding="latin-1") as f:
        for line in f:
            p = line.rstrip("\r\n").split("\t")
            if len(p) < 4:
                continue
            if p[1]:
                cur = p[1]
            adj[cur]  # touch: a county with no neighbour still exists
            if p[3] != cur:
                adj[cur].add(p[3])
    adj = {c: {n for n in ns if n[:2] <= "56"} for c, ns in adj.items() if c[:2] <= "56"}
    one_way = 0
    for c in sorted(adj):
        for n in sorted(adj[c]):
            if c not in adj[n]:
                adj[n].add(c)
                one_way += 1
    print(f"adjacency: {one_way} one-way pairs made two-way")
    return adj


def read_names() -> dict[str, tuple[str, str]]:
    out = {}
    with open(path("fips", "national_county.txt"), encoding="latin-1") as f:
        for row in csv.reader(f):
            if len(row) >= 4:
                out[row[1] + row[2]] = (row[0], row[3])
    return out


def read_est2000() -> dict[str, tuple[int, int]]:
    """Estimates base 2000 (the 2000 count on 2010 county lines, with count corrections) and the 2010 count."""
    out = {}
    with open(path("pop2000int", "co-est00int-tot.csv"), encoding="latin-1") as f:
        for r in csv.DictReader(f):
            if r["SUMLEV"] in ("050", "50"):
                out[f"{int(r['STATE']):02d}{int(r['COUNTY']):03d}"] = (
                    int(r["ESTIMATESBASE2000"]),
                    int(r["CENSUS2010POP"]),
                )
    return out


def read_phct4() -> dict[str, tuple[int | None, int]]:
    """1990 and 2000 census counts on 2000 county lines."""
    out = {}
    pat = re.compile(r"^(\d{5})\s+(.+?)\s+([A-Z]{2})\s+(\S+)\s+([\d,]+)")
    with open(path("phct4", "tab01.txt"), encoding="latin-1") as f:
        for line in f:
            m = pat.match(line)
            if not m:
                continue
            p90 = m.group(4).replace(",", "")
            out[m.group(1)] = (int(p90) if p90.isdigit() else None, int(m.group(5).replace(",", "")))
    return out


def read_votes(year: str) -> tuple[dict[str, list[int]], dict[str, str]]:
    votes: dict[str, list[int]] = collections.defaultdict(lambda: [0, 0, 0])
    names = {}
    with open(path("mit", "countypres_2000-2016.csv"), encoding="latin-1") as f:
        for r in csv.DictReader(f):
            if r["year"] != year:
                continue
            fips = r["FIPS"]
            key = f"{int(fips):05d}" if fips != "NA" else f"NA:{r['state_po']}:{r['county']}"
            names[key] = f"{r['state_po']} {r['county']}"
            v = 0 if r["candidatevotes"] == "NA" else int(r["candidatevotes"])
            if r["party"] == "democrat":
                votes[key][0] += v
            elif r["party"] == "republican":
                votes[key][1] += v
            votes[key][2] = 0 if r["totalvotes"] == "NA" else int(r["totalvotes"])
    return votes, names


def read_centroids() -> dict[str, tuple[float, float]]:
    """Area centroid of each county in the us-atlas Albers file's plane (975 x 610 units)."""
    with open(path("usatlas", "counties-albers-10m.json"), encoding="utf-8") as f:
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
    for g in topo["objects"]["counties"]["geometries"]:
        polys = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        area = cx = cy = 0.0
        for poly in polys:
            pts = ring(poly[0])  # outer ring; holes are other counties, ignored
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
            # Falls Church, Lexington and Manassas Park VA collapse to a sliver at 10m: use the ring's mean point.
            pts = ring(polys[0][0])
            out[g["id"]] = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
            print(f"centroids: us-atlas shape {g['id']} has zero area at this resolution; used its ring's mean point")
    return out


def atlas_adjacency() -> dict[str, set[str]]:
    """Counties sharing a TopoJSON arc: land borders only. For comparing with the Census file."""
    with open(path("usatlas", "counties-albers-10m.json"), encoding="utf-8") as f:
        topo = json.load(f)
    owner: dict[int, list[str]] = collections.defaultdict(list)
    for g in topo["objects"]["counties"]["geometries"]:
        polys = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        for poly in polys:
            for r in poly:
                for i in r:
                    owner[i if i >= 0 else ~i].append(g["id"])
    adj: dict[str, set[str]] = collections.defaultdict(set)
    for ids in owner.values():
        for a in ids:
            for b in ids:
                if a != b:
                    adj[a].add(b)
    return adj


def main() -> int:
    adj = read_adjacency()
    names = read_names()
    est = read_est2000()
    phc = read_phct4()
    votes, vnames = read_votes("2000")
    cen = read_centroids()
    ids = sorted(adj)
    print(f"adjacency file: {len(ids)} counties in the 50 states and DC")
    print(f"  not in 2000-2010 intercensal file: {sorted(set(ids) - set(est))}")
    print(f"  intercensal counties not in adjacency: {sorted(set(est) - set(ids))}")
    print(f"PHC-T-4 (2000 vintage): {len(phc)} counties")
    print(f"  2000-vintage ids gone by 2010: {sorted(set(phc) - set(ids))}")
    print(f"  2010 ids with no 1990/2000 census row: {sorted(set(ids) - set(phc))}")
    print(f"  rows with no 1990 count: {sorted(k for k, v in phc.items() if v[0] is None)}")
    print(f"  US 2000: census count {sum(v[1] for v in phc.values())}, estimates base {sum(est[c][0] for c in ids)}")
    diff = sorted(((abs(phc[c][1] - est[c][0]), c) for c in ids if c in phc and phc[c][1] != est[c][0]), reverse=True)
    print(f"  counties where the 2000 estimates base differs from the count: {len(diff)}; largest {diff[:5]}")

    for src, dst in VOTES_INTO.items():
        if src in votes:
            for i in range(3):
                votes[dst][i] += votes[src][i]
            print(f"votes: {vnames.get(src, src)} ({src}) added to {dst}")
            del votes[src]
    for dst, srcs in VOTES_FROM.items():
        d = sum(votes[s][0] for s in srcs)
        r = sum(votes[s][1] for s in srcs)
        t = sum(votes[s][2] for s in srcs)
        p = sum(est[s][0] for s in srcs)
        k = est[dst][0] / p
        votes[dst] = [round(d * k), round(r * k), round(t * k)]
        print(f"votes: {dst} has no 2000 return; given the pooled split of {srcs}")
    # Alaska: the 2000 returns are by state house district, not borough. Every borough takes the state split.
    ak = [k for k in votes if k.startswith("02") or k.startswith("NA:AK")]
    ak_d = sum(votes[k][0] for k in ak)
    ak_r = sum(votes[k][1] for k in ak)
    ak_t = sum(votes[k][2] for k in ak)
    ak_pop = sum(est[c][0] for c in ids if c.startswith("02"))
    print(f"votes: Alaska has {len(ak)} return units (house districts); spread over boroughs by population")
    for k in ak:
        del votes[k]
    for c in ids:
        if c.startswith("02"):
            w = est[c][0] / ak_pop
            votes[c] = [round(ak_d * w), round(ak_r * w), round(ak_t * w)]
    stray = sorted(set(votes) - set(ids))
    print(f"votes: return units still unmatched: {[(k, vnames.get(k), votes[k]) for k in stray]}")
    missing = sorted(c for c in ids if c not in votes or votes[c][0] + votes[c][1] == 0)
    print(f"votes: counties with no return: {[(c, names.get(c)) for c in missing]}")

    aadj = atlas_adjacency()
    back = {v: k for k, v in ATLAS_ID.items() if k != "51515"}
    only_census = only_atlas = 0
    examples = []
    for c in ids:
        a = ATLAS_ID.get(c, c)
        got = {back.get(n, n) for n in aadj.get(a, set())}
        if c == "51019":
            got.discard("51515")
        want = adj[c] - {"51515"} if c != "51515" else set()
        if c == "51515":
            continue
        oc = want - got
        oa = got - want
        only_census += len(oc)
        only_atlas += len(oa)
        if oc and len(examples) < 6:
            examples.append((c, sorted(oc)))
    print(f"adjacency: Census pairs not sharing a us-atlas arc: {only_census // 2} (water or point contact), e.g. {examples}")
    print(f"adjacency: us-atlas arc pairs not in the Census file: {only_atlas // 2}")
    print(f"centroids: counties with no us-atlas shape: {[c for c in ids if ATLAS_ID.get(c, c) not in cen]}")

    rows = []
    for c in ids:
        st, name = names.get(c, ("??", "?"))
        x, y = cen[ATLAS_ID.get(c, c)]
        v = votes.get(c, [0, 0, 0])
        rows.append(
            {
                "fips": c,
                "state": st,
                "name": name,
                "pop1990": phc[c][0] if c in phc else None,
                "pop2000": est[c][0],
                "pop2000_count": phc[c][1] if c in phc else None,
                "pop2010": est[c][1],
                "dem2000": v[0],
                "rep2000": v[1],
                "total2000": v[2],
                "x": round(x, 3),
                "y": round(y, 3),
                "adj": sorted(adj[c]),
            }
        )
    os.makedirs(path("derived"), exist_ok=True)
    with open(path("derived", "counties.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(rows, f, indent=0)
    d = sum(r["dem2000"] for r in rows)
    r_ = sum(r["rep2000"] for r in rows)
    print(f"wrote {len(rows)} counties; 2000 two-party D margin {100.0 * (d - r_) / (d + r_):+.2f} pts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
