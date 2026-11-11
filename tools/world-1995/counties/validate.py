"""Check assets/worlds/1995/counties.csv and county-adjacency.csv (pivot 5.1, 5.4). Standard
library only; reads the game files, not the raw downloads, so it runs anywhere.

    python -I -B tools/world-1995/counties/validate.py [--report]

Prints each problem and then OK or a count; exits non-zero on any problem. `--report` also lists the
counties larger than one House seat and what their spread lets a split yield. tools/world-1995/
validate.py calls `check()`; the load-time twin of the cross-file checks is sim-data's checks.ts.
"""

import collections
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.join(ROOT, "assets", "worlds", "1995")

COUNTY_COLUMNS = ["fips", "state", "name", "pop_1990", "lean_pts", "spread", "elasticity", "turnout", "centroid_x", "centroid_y"]
ADJACENCY_COLUMNS = ["fips", "neighbour_fips"]
# pivot 5.1 (D1028): the frozen vintage.
COUNTY_COUNT = 3142
# The 1990 census: the resident population of the 50 states and DC.
US_POP_1990 = 248_709_873
# politics-usa-era.csv writes each state's 1990 people in millions to three places; the counties of a
# state must sum to it within this share (sim-data checks.ts COUNTY_STATE_POP_TOLERANCE).
STATE_POP_TOLERANCE = 0.002
# A county's lean, and lean plus or minus spread, in points (build.py LEAN_CLAMP_PTS, LEAN_LIMIT_PTS).
LEAN_MAX_PTS = 95.0
LEAN_LIMIT_PTS = 100.0
SPREAD_MAX_PTS = 45.0
# The people-weighted mean lean of a state's counties is the state's lean within this (points;
# leans are written to two places).
LEAN_MEAN_TOLERANCE_PTS = 0.01
TURNOUT_RANGE = (0.15, 0.7)
ELASTICITY_RANGE = (0.25, 4.0)
# The us-atlas Albers plane (README.md, "Projection").
PLANE = (975.0, 610.0)
# The county graph of the whole country: the 48 states and DC, Alaska, Hawaii.
COMPONENTS = 3


def read(name):
    with open(os.path.join(OUT, name), encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        return r.fieldnames, list(r)


def components(nodes, adj):
    """The connected pieces of `nodes` under `adj`, each sorted, in order of their first node."""
    seen = set()
    out = []
    for start in sorted(nodes):
        if start in seen:
            continue
        piece = [start]
        seen.add(start)
        for c in piece:
            for n in sorted(adj.get(c, ())):
                if n in nodes and n not in seen:
                    seen.add(n)
                    piece.append(n)
        out.append(sorted(piece))
    return out


def check(report=None):
    """Every problem with the two files, as strings. `report`, a list, receives the split report."""
    errors = []
    with open(os.path.join(OUT, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)
    if manifest["features"].get("counties") is not True:
        return ["manifest: features.counties is not true"]
    cols, rows = read("counties.csv")
    acols, pairs = read("county-adjacency.csv")
    if cols != COUNTY_COLUMNS:
        return [f"counties: columns are {cols}"]
    if acols != ADJACENCY_COLUMNS:
        return [f"county-adjacency: columns are {acols}"]
    counts = manifest["expected_counts"]
    if len(rows) != COUNTY_COUNT or counts.get("counties") != len(rows):
        errors.append(f"counties: {len(rows)} rows, expected {COUNTY_COUNT} and the manifest's {counts.get('counties')}")
    if counts.get("county-adjacency") != len(pairs):
        errors.append(f"county-adjacency: {len(pairs)} rows, the manifest says {counts.get('county-adjacency')}")

    _, states = read("politics-usa.csv")
    _, era = read("politics-usa-era.csv")
    state_lean = {s["state"]: float(s["dem_margin_pts"]) for s in states}
    seats = {s["state"]: int(s["house_seats"]) for s in states}
    state_pop = {s["state"]: float(s["pop_1990_m"]) * 1e6 for s in era}

    fips = [r["fips"] for r in rows]
    errors += [f"counties: {f} is not a five-digit code" for f in fips if not re.fullmatch(r"\d{5}", f)]
    if fips != sorted(set(fips)):
        errors.append("counties: the codes are not unique and in order")
    by_state = collections.defaultdict(list)
    prefix = {}
    for r in rows:
        f = r["fips"]
        if r["state"] not in state_lean:
            errors.append(f"counties: {f} is in {r['state']}, which is not in politics-usa.csv")
            continue
        if prefix.setdefault(f[:2], r["state"]) != r["state"]:
            errors.append(f"counties: {f} is in {r['state']}, but {f[:2]} is {prefix[f[:2]]}")
        by_state[r["state"]].append(r)
        if not r["name"]:
            errors.append(f"counties: {f} has no name")
        pop = int(r["pop_1990"])
        lean, spread = float(r["lean_pts"]), float(r["spread"])
        if pop < 1:
            errors.append(f"counties: {f} has no people")
        if abs(lean) > LEAN_MAX_PTS:
            errors.append(f"counties: {f} lean {lean} is beyond {LEAN_MAX_PTS}")
        if not 0.0 <= spread <= SPREAD_MAX_PTS or abs(lean) + spread > LEAN_LIMIT_PTS + 1e-9:
            errors.append(f"counties: {f} spread {spread} is out of range, or lean and spread pass {LEAN_LIMIT_PTS}")
        if not TURNOUT_RANGE[0] <= float(r["turnout"]) <= TURNOUT_RANGE[1]:
            errors.append(f"counties: {f} turnout {r['turnout']} is out of {TURNOUT_RANGE}")
        if not ELASTICITY_RANGE[0] <= float(r["elasticity"]) <= ELASTICITY_RANGE[1]:
            errors.append(f"counties: {f} elasticity {r['elasticity']} is out of {ELASTICITY_RANGE}")
        if not (0.0 <= float(r["centroid_x"]) <= PLANE[0] and 0.0 <= float(r["centroid_y"]) <= PLANE[1]):
            errors.append(f"counties: {f} centroid is off the {PLANE[0]:.0f} by {PLANE[1]:.0f} plane")
    total = sum(int(r["pop_1990"]) for r in rows)
    if total != US_POP_1990:
        errors.append(f"counties: {total} people, and the 1990 census counted {US_POP_1990}")
    for state in sorted(state_lean):
        cs = by_state.get(state, [])
        if not cs:
            errors.append(f"counties: {state} has no county")
            continue
        people = sum(int(r["pop_1990"]) for r in cs)
        if abs(people - state_pop[state]) > STATE_POP_TOLERANCE * state_pop[state]:
            errors.append(f"counties: {state} has {people} people, politics-usa-era says {state_pop[state]:.0f}")
        mean = sum(int(r["pop_1990"]) * float(r["lean_pts"]) for r in cs) / people
        if abs(mean - state_lean[state]) > LEAN_MEAN_TOLERANCE_PTS:
            errors.append(f"counties: {state}'s mean county lean is {mean:.3f}, the state's is {state_lean[state]}")

    known = set(fips)
    seen = set()
    adj = collections.defaultdict(set)
    for p in pairs:
        a, b = p["fips"], p["neighbour_fips"]
        if a not in known or b not in known:
            errors.append(f"county-adjacency: {a}-{b} names an unknown county")
            continue
        if a == b:
            errors.append(f"county-adjacency: {a} is its own neighbour")
        if (a, b) in seen:
            errors.append(f"county-adjacency: {a}-{b} appears twice")
        seen.add((a, b))
        adj[a].add(b)
    if [(p["fips"], p["neighbour_fips"]) for p in pairs] != sorted(seen):
        errors.append("county-adjacency: the rows are not in order")
    errors += [f"county-adjacency: {a}-{b} has no {b}-{a}" for a, b in sorted(seen) if (b, a) not in seen]
    for state in sorted(by_state):
        pieces = components({r["fips"] for r in by_state[state]}, adj)
        if len(pieces) > 1:
            errors.append(f"county-adjacency: {state} is in {len(pieces)} pieces; the small ones: {pieces[1:][:5]}")
    whole = components(known, adj)
    if len(whole) != COMPONENTS:
        errors.append(f"county-adjacency: the country is in {len(whole)} pieces, expected {COMPONENTS}")

    if report is not None:
        both = n = 0
        for state in sorted(by_state):
            if seats[state] < 2:
                continue
            seat = sum(int(r["pop_1990"]) for r in by_state[state]) / seats[state]
            for r in by_state[state]:
                size = int(r["pop_1990"]) / seat
                if size <= 1.0:
                    continue
                lean, spread = float(r["lean_pts"]), float(r["spread"])
                # The most one-sided district a split can make is 1/size of the county, taken from
                # one end of its order: the mean of that interval (pivot 5.4).
                reach = spread * (1.0 - 1.0 / size)
                ways = lean + reach > 0.0 > lean - reach
                n += 1
                both += ways
                report.append(
                    f"{r['fips']} {r['name']}, {state}: {size:.2f} seats, lean {lean:+.2f}, spread {spread:.2f}, "
                    f"districts from {lean - reach:+.1f} to {lean + reach:+.1f}{'' if ways else '  (one way only)'}"
                )
        report.append(f"{both} of the {n} counties larger than a seat can yield districts leaning both ways")
    return errors


def main():
    report = [] if "--report" in sys.argv[1:] else None
    errors = check(report)
    for line in report or []:
        print(line)
    for e in errors:
        print(f"ERROR {e}")
    print("OK" if not errors else f"{len(errors)} errors")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
