"""Draw every state at the 2000 apportionment and write results/summary.md and results/detail.md.

Run: python -I -B run.py [--states CA,TX] [--seed 1] [--tol 0.0] [--tag name]
Needs raw/derived/counties.json (fetch.py, then prep.py). Standard library only.
"""

import argparse
import hashlib
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import districts as D  # noqa: E402

# Seats from the 2000 census (apportionment population, which counts federal staff overseas).
SEATS_2000 = {
    "AL": 7, "AK": 1, "AZ": 8, "AR": 4, "CA": 53, "CO": 7, "CT": 5, "DE": 1, "FL": 25, "GA": 13,
    "HI": 2, "ID": 2, "IL": 19, "IN": 9, "IA": 5, "KS": 4, "KY": 6, "LA": 7, "ME": 2, "MD": 8,
    "MA": 10, "MI": 15, "MN": 8, "MS": 4, "MO": 9, "MT": 1, "NE": 3, "NV": 3, "NH": 2, "NJ": 13,
    "NM": 3, "NY": 29, "NC": 13, "ND": 1, "OH": 18, "OK": 5, "OR": 5, "PA": 19, "RI": 2, "SC": 6,
    "SD": 1, "TN": 9, "TX": 32, "UT": 3, "VT": 1, "VA": 11, "WA": 9, "WV": 3, "WI": 8, "WY": 1,
}  # fmt: skip
HOUSE_SEATS = 435
DETAIL = ["CA", "TX", "PA", "NH", "WY"]
# (label, strength, drawer sign): the five maps measured per state
MODES = [("R 1.0", 1.0, -1.0), ("R 0.5", 0.5, -1.0), ("neutral", 0.0, 1.0), ("D 0.5", 0.5, 1.0), ("D 1.0", 1.0, 1.0)]


def equal_proportions(people: list, total: int) -> list:
    """packages/sim/src/politics/era.ts equalProportions."""
    seats = [1 if n > 0 else 0 for n in people]
    for _ in range(total - sum(seats)):
        best, score = -1, -1.0
        for i, n in enumerate(people):
            if n <= 0:
                continue
            pr = n / math.sqrt(seats[i] * (seats[i] + 1))
            if pr > score:
                score, best = pr, i
        seats[best] += 1
    return seats


def load() -> dict:
    with open(os.path.join(HERE, "raw", "derived", "counties.json"), encoding="utf-8") as f:
        rows = json.load(f)
    by_state: dict = {}
    for r in rows:
        by_state.setdefault(r["state"], []).append(r)
    states = {}
    for po in sorted(by_state):
        if po == "DC":
            continue
        cs = sorted(by_state[po], key=lambda r: r["fips"])
        index = {r["fips"]: i for i, r in enumerate(cs)}
        st = D.State(
            po,
            [r["fips"] for r in cs],
            [r["name"] for r in cs],
            [r["pop2000"] for r in cs],
            [r["dem2000"] for r in cs],
            [r["rep2000"] for r in cs],
            [r["x"] for r in cs],
            [r["y"] for r in cs],
            [sorted(index[a] for a in r["adj"] if a in index) for r in cs],
        )
        st.join_components()
        states[po] = st
    return states


def describe(st, plan, m) -> list:
    lines = ["| # | people | dev % | D margin | P(D) | counties |", "|---|---|---|---|---|---|"]
    order = sorted(range(len(plan)), key=lambda j: (-m["districts"][j]["margin"], j))
    for n, j in enumerate(order):
        dist = plan[j]
        row = m["districts"][j]
        parts = []
        for i in sorted(dist, key=lambda i: (-dist[i], i)):
            share = dist[i] / st.pop[i]
            name = st.names[i].replace(" County", "")
            parts.append(name if share > 1.0 - 1e-9 else f"{name} {100.0 * share:.1f}%")
        shown = ", ".join(parts[:6]) + (f", +{len(parts) - 6} more" if len(parts) > 6 else "")
        flag = "" if row["contiguous"] else " (NOT CONTIGUOUS)"
        lines.append(
            f"| {n + 1} | {row['people']:,.0f} | {row['dev_pct']:+.4f} | {row['margin']:+.1f} | {row['p_dem']:.2f} | {shown}{flag} |"
        )
    return lines


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--states", default="")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--tol", type=float, default=0.0)
    ap.add_argument("--tag", default="")
    ap.add_argument("--rollouts", type=int, default=D.ROLLOUTS)
    ap.add_argument("--angles", type=int, default=D.N_ANGLES)
    ap.add_argument("--sigma", type=float, default=D.SIGMA_PTS)
    args = ap.parse_args()
    D.ROLLOUTS = args.rollouts
    D.N_ANGLES = args.angles
    D.SIGMA_PTS = args.sigma
    states = load()
    pos = sorted(states)
    people = [sum(states[po].pop) for po in pos]
    mine = equal_proportions(people, HOUSE_SEATS)
    moved = [(po, mine[i], SEATS_2000[po]) for i, po in enumerate(pos) if mine[i] != SEATS_2000[po]]
    pick = [p for p in args.states.split(",") if p] or pos

    out = []
    detail = []
    out.append(f"seed {args.seed}, tolerance {args.tol}, sigma {D.SIGMA_PTS} pts, {D.N_ANGLES} angles, {D.ROLLOUTS} rollouts, kappa {D.KAPPA}, plan kappa {D.PLAN_KAPPA}")
    out.append("")
    out.append(f"Equal proportions on resident 2000 people against the real 2000 seats: {moved or 'identical'}")
    out.append("")
    out.append(
        "| state | seats | counties | over a seat | max dev % | contiguous | split counties N / D1 / R1 | smallest share | "
        "R bound | exp D seats R1 | R.5 | N | D.5 | D1 | D bound | spread R1 / N / D1 | hard D seats R1 / N / D1 | D seats by share | time s N | time s D1 |"
    )
    out.append("|" + "---|" * 20)
    tot_exp = [0.0] * len(MODES)
    tot_hard = [0] * len(MODES)
    tot_time = [0.0] * len(MODES)
    tot_prop = 0.0
    tot_bound = [0.0, 0.0]
    worst_dev = 0.0
    all_ok = True
    digest = hashlib.sha256()
    for po in pick:
        st = states[po]
        k = SEATS_2000[po]
        res = []
        for mi, (label, s, sign) in enumerate(MODES):
            t0 = time.perf_counter()
            plan = D.draw(st, k, s, sign, args.seed, args.tol)
            dt = time.perf_counter() - t0
            m = D.measure(st, plan)
            for dist in plan:
                digest.update(repr([(st.fips[i], round(dist[i], 4)) for i in sorted(dist)]).encode())
            res.append((plan, m, dt))
            tot_exp[mi] += m["exp_dem"]
            tot_hard[mi] += m["hard_dem"]
            tot_time[mi] += dt
            worst_dev = max(worst_dev, m["max_dev_pct"])
            all_ok = all_ok and m["all_contiguous"]
            assert m["leak"] < 1e-3, (po, label, m["leak"])
            if po in DETAIL and label in ("R 1.0", "neutral", "D 1.0"):
                detail.append(f"### {po}, {label}: {k} seats, expected D {m['exp_dem']:.2f}, hard D {m['hard_dem']}")
                detail.append("")
                detail.extend(describe(st, plan, m))
                detail.append("")
        d = sum(st.dem)
        r = sum(st.rep)
        prop = k * d / (d + r)
        tot_prop += prop
        tot_bound[0] += k - res[2][1]["bound_rep"]
        tot_bound[1] += res[2][1]["bound_dem"]
        ms = [x[1] for x in res]
        out.append(
            f"| {po} | {k} | {st.n} | {ms[2]['forced_splits']} | {max(m['max_dev_pct'] for m in ms):.1e} | "
            f"{'yes' if all(m['all_contiguous'] for m in ms) else 'NO'} | "
            f"{ms[2]['split_counties']} / {ms[4]['split_counties']} / {ms[0]['split_counties']} | "
            f"{min(m['min_share'] for m in ms):.4f} | {k - ms[2]['bound_rep']:.2f} | "
            + " | ".join(f"{m['exp_dem']:.2f}" for m in ms)
            + f" | {ms[2]['bound_dem']:.2f} | {ms[0]['spread']:.3f} / {ms[2]['spread']:.3f} / {ms[4]['spread']:.3f}"
            + f" | {ms[0]['hard_dem']} / {ms[2]['hard_dem']} / {ms[4]['hard_dem']} | {prop:.1f} | {res[2][2]:.2f} | {res[4][2]:.2f} |"
        )
        print(po, k, [f"{m['exp_dem']:.2f}" for m in ms], f"{sum(x[2] for x in res):.1f}s", st.stats, st.bridges, flush=True)
    out.append(
        f"| all | {sum(SEATS_2000[p] for p in pick)} | | | {worst_dev:.1e} | {'yes' if all_ok else 'NO'} | | | {tot_bound[0]:.1f} | "
        + " | ".join(f"{v:.1f}" for v in tot_exp)
        + f" | {tot_bound[1]:.1f} | | {tot_hard[0]} / {tot_hard[2]} / {tot_hard[4]} | {tot_prop:.1f} | {tot_time[2]:.1f} | {tot_time[4]:.1f} |"
    )
    out.append("")
    out.append("Search counters per state over all five maps, for states that backtracked, kept a weaker map, broke contiguity or needed island bridges:")
    out.append("")
    for po in pick:
        st = states[po]
        if st.stats["bad_cuts"] or st.bridges or st.stats["backtracks"] or st.stats["kept_weaker"]:
            out.append(f"- {po}: {st.stats}, bridges {st.bridges}")
    out.append("")
    out.append(f"Plan digest (every district of every map, people to 4 places): {digest.hexdigest()[:16]}")
    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    tag = f"-{args.tag}" if args.tag else ""
    with open(os.path.join(HERE, "results", f"summary{tag}.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out) + "\n")
    if detail:
        with open(os.path.join(HERE, "results", f"detail{tag}.md"), "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(detail) + "\n")
    print("\n".join(out[-14:]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
