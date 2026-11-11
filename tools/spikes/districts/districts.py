"""Redistricting prototype: recursive bisection of a state's county graph with fractional cuts.

Standard library only. Deterministic for a seed: no random module, no hash-ordered iteration that
reaches the output (every choice is by a sorted key with the county index as the tie-break).

A state is a list of counties (index order = FIPS order). A region is {county index: people}, so a
county can sit in several regions with part of its people in each. `draw` splits a region of k seats
into two regions of k1 and k - k1 seats by sweeping the county graph in some order until k1/k of
the people are behind the sweep; the county the target falls inside is split between the two sides.
It tries a fixed list of sweeps, scores each cut, keeps the best and recurses.

README.md describes the algorithm for the TypeScript port.
"""

import math

SIGMA_PTS = 8.0  # sd of a district's margin around its lean, in margin points: P(win) = Phi(lean / sigma)
N_ANGLES = 8  # sweep directions over half a turn; each is swept from both ends
KAPPA = 1.0  # expected seats one unit of the compactness cost is worth at s = 0.5
TIE_COMPACT = 0.01  # weight compactness keeps at s = 1, as the tie-break
EPS = 1e-9  # relative float slack on people
ROLLOUTS = 4  # cuts finished greedily before one is kept (partisan maps only); 1 is plain greedy
BACKTRACK_TRIES = 6  # cuts a region tries before it reports that it cannot be finished contiguously
PLAN_KAPPA = 1.0  # expected seats one unit of a plan's sprawl (seats x spread) is worth at s = 0.5


class Rng:
    """mulberry32: 32-bit state, the same sequence in Python and JavaScript."""

    def __init__(self, seed: int) -> None:
        self.s = seed & 0xFFFFFFFF

    def next(self) -> float:
        self.s = (self.s + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.s
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0


def phi(z: float) -> float:
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


class State:
    """pop, dem, rep, x, y per county; nbr[i] is the sorted in-state neighbours of county i."""

    def __init__(self, po, fips, names, pop, dem, rep, x, y, nbr):
        self.po = po
        self.fips = fips
        self.names = names
        self.pop = pop
        self.dem = dem
        self.rep = rep
        self.x = x
        self.y = y
        self.nbr = nbr
        self.n = len(pop)
        self.bridges = []  # edges added to join islands the adjacency file leaves apart
        self.stats = {"sweeps": 0, "bfs": 0, "forced": 0, "backtracks": 0, "bad_cuts": 0, "kept_weaker": 0}

    def join_components(self) -> None:
        """If the in-state graph is in pieces, link each piece to the nearest county of the main one."""
        while True:
            comps = components(self, set(range(self.n)))
            if len(comps) == 1:
                return
            comps.sort(key=lambda c: (-len(c), min(c)))
            main, other = comps[0], comps[1]
            best = None
            for a in sorted(other):
                for b in sorted(main):
                    d = (self.x[a] - self.x[b]) ** 2 + (self.y[a] - self.y[b]) ** 2
                    if best is None or d < best[0]:
                        best = (d, a, b)
            _, a, b = best
            self.nbr[a] = sorted(self.nbr[a] + [b])
            self.nbr[b] = sorted(self.nbr[b] + [a])
            self.bridges.append((self.fips[a], self.fips[b]))


def components(st: State, nodes: set) -> list:
    left = set(nodes)
    out = []
    for start in sorted(nodes):
        if start not in left:
            continue
        comp = [start]
        left.discard(start)
        i = 0
        while i < len(comp):
            for m in st.nbr[comp[i]]:
                if m in left:
                    left.discard(m)
                    comp.append(m)
            i += 1
        out.append(comp)
    return out


def connected_without(st: State, nodes: set, v: int) -> bool:
    """Is `nodes` minus v connected? First a cheap local test, then a full search."""
    if len(nodes) <= 2:
        return True
    around = [m for m in st.nbr[v] if m in nodes]
    if not around:
        return False  # v is cut off from the rest already
    # Local: v's neighbours in `nodes` reach each other through each other.
    seen = {around[0]}
    stack = [around[0]]
    ring = set(around)
    while stack:
        u = stack.pop()
        for m in st.nbr[u]:
            if m in ring and m not in seen:
                seen.add(m)
                stack.append(m)
    if len(seen) == len(around):
        return True
    st.stats["bfs"] += 1
    seen = {around[0]}
    stack = [around[0]]
    while stack:
        u = stack.pop()
        for m in st.nbr[u]:
            if m != v and m in nodes and m not in seen:
                seen.add(m)
                stack.append(m)
    return len(seen) == len(nodes) - 1


def sweep(st: State, region: dict, key: list) -> tuple:
    """Order the region's counties by growing from the lowest key: each step takes the lowest-key
    county touching what is taken whose removal leaves the rest connected. If none qualifies it takes
    the lowest-key one anyway and then, forced, every county that step cut off from the largest rest.
    Returns (order, settled): settled[j] is whether the rest was connected before step j
    (settled[len] is True). A cut is contiguous on both sides only at a settled point.
    """
    st.stats["sweeps"] += 1
    rest = set(region)
    order = []
    settled = []
    pending = []
    frontier = set()
    seed = min(rest, key=lambda i: (key[i], i))
    while rest:
        settled.append(not pending)
        if pending:
            v = pending.pop(0)
        else:
            choices = sorted(frontier, key=lambda i: (key[i], i)) if order else [seed]
            if not choices:  # the region came in pieces (only after a cut that broke contiguity)
                choices = [min(rest, key=lambda i: (key[i], i))]
            v = -1
            for c in choices:
                if connected_without(st, rest, c):
                    v = c
                    break
            if v < 0:
                v = choices[0]
                st.stats["forced"] += 1
                comps = components(st, rest - {v})
                comps.sort(key=lambda c: (-sum(region[i] for i in c), min(c)))
                for comp in comps[1:]:
                    # breadth-first from v, so what is taken stays connected
                    members = set(comp)
                    queue = [m for m in st.nbr[v] if m in members]
                    seen = set(queue)
                    i = 0
                    while i < len(queue):
                        for m in st.nbr[queue[i]]:
                            if m in members and m not in seen:
                                seen.add(m)
                                queue.append(m)
                        i += 1
                    pending.extend(queue)
        rest.discard(v)
        frontier.discard(v)
        order.append(v)
        for m in st.nbr[v]:
            if m in rest:
                frontier.add(m)
    settled.append(True)
    return order, settled


def cut(region: dict, order: list, settled: list, k1: int, k: int, tol: float):
    """Split the swept region so the first side holds k1/k of the people. Returns (a, b, ok).
    With tol > 0 a cut within tol of a seat's people of a county boundary snaps to it (no split county).
    """
    total = sum(region.values())
    target = total * k1 / k
    slack = max(tol * total / k, EPS * total)
    s = 0.0
    for j, v in enumerate(order):
        amt = region[v]
        if s + amt < target - slack and j < len(order) - 1:
            s += amt
            continue
        before = target - s  # people of v the first side still needs: above slack, or step j - 1 took the cut
        after = s + amt - target  # people of v left for the second side: above -slack
        if after <= slack and j < len(order) - 1:
            # the target is within slack of v's far edge, on either side of it: cut cleanly after v
            a = {i: region[i] for i in order[: j + 1]}
            b = {i: region[i] for i in order[j + 1 :]}
            return a, b, settled[j + 1]
        a = {i: region[i] for i in order[:j]}
        b = {i: region[i] for i in order[j + 1 :]}
        a[v] = before
        b[v] = after
        return a, b, settled[j]
    raise AssertionError("cut: target beyond the region")


def inertia(st: State, region: dict) -> float:
    """People-weighted second moment about the region's own centre (lower is more compact)."""
    w = sx = sy = sq = 0.0
    for i in sorted(region):
        a = region[i]
        w += a
        sx += a * st.x[i]
        sy += a * st.y[i]
        sq += a * (st.x[i] * st.x[i] + st.y[i] * st.y[i])
    return max(sq - (sx * sx + sy * sy) / w, 0.0) if w > 0.0 else 0.0


def margin(d: float, r: float) -> float:
    """Two-party margin in points, + Democratic."""
    return 100.0 * (d - r) / (d + r) if d + r > 0.0 else 0.0


def value(st: State, region: dict, k: int, sign: float) -> float:
    """Optimistic expected seats the drawer (sign +1 Democratic, -1 Republican) can get from a region
    of k seats, ignoring geography: order its people from most hostile to most friendly, cut the order
    into k equal slices, pack the most hostile k - w slices one seat each and share the rest evenly
    over w seats; take the best w. At k = 1 it is the district's true win chance.
    """
    pieces = sorted(region, key=lambda i: (sign * margin(st.dem[i], st.rep[i]), i))
    total = sum(region.values())
    cum_d = [0.0]
    cum_r = [0.0]
    step = total / k
    s = d = r = 0.0
    nxt = 1
    for i in pieces:
        amt = region[i]
        share_d = st.dem[i] / st.pop[i]
        share_r = st.rep[i] / st.pop[i]
        while nxt < k and s + amt >= step * nxt:
            part = step * nxt - s
            cum_d.append(d + part * share_d)
            cum_r.append(r + part * share_r)
            nxt += 1
        s += amt
        d += amt * share_d
        r += amt * share_r
    while len(cum_d) < k:
        cum_d.append(d)
        cum_r.append(r)
    cum_d.append(d)
    cum_r.append(r)
    best = -1.0
    packed = 0.0
    for lost in range(0, k + 1):  # the first `lost` slices are packed
        w = k - lost
        v = packed
        if w > 0:
            v += w * phi(sign * margin(d - cum_d[lost], r - cum_r[lost]) / SIGMA_PTS)
        if v > best:
            best = v
        if lost < k:
            m = margin(cum_d[lost + 1] - cum_d[lost], cum_r[lost + 1] - cum_r[lost])
            packed += phi(sign * m / SIGMA_PTS)
    return best


def draw(st: State, seats: int, s: float, sign: float, seed: int, tol: float = 0.0, guard: bool = True) -> list:
    """Districts of a state: a list of {county index: people}. s is the gerrymander strength 0..1 and
    sign the drawer (+1 Democratic, -1 Republican); at s = 0 the drawer does not matter.
    """
    rng = Rng(seed)
    theta0 = rng.next() * math.pi / N_ANGLES
    geo = []
    for j in range(N_ANGLES):
        t = theta0 + j * math.pi / N_ANGLES
        c, sn = math.cos(t), math.sin(t)
        proj = [st.x[i] * c + st.y[i] * sn for i in range(st.n)]
        geo.append(proj)
        geo.append([-p for p in proj])
    lean = [sign * margin(st.dem[i], st.rep[i]) for i in range(st.n)]
    def keys_for(region: dict) -> list:
        if s <= 0.0:
            return geo
        # hostile-vote centre of the region, for the "rings round the city" sweep
        w = cx = cy = 0.0
        for i in sorted(region):
            share = region[i] / st.pop[i]
            hostile = (st.rep[i] if sign > 0 else st.dem[i]) * share
            w += hostile
            cx += hostile * st.x[i]
            cy += hostile * st.y[i]
        ring = [0.0] * st.n
        if w > 0.0:
            cx /= w
            cy /= w
            ring = [(st.x[i] - cx) ** 2 + (st.y[i] - cy) ** 2 for i in range(st.n)]
        return geo + [lean, [-v for v in lean], ring]

    cache: dict = {}
    done: dict = {}

    def signature(region: dict, k: int) -> tuple:
        return (k,) + tuple((i, round(region[i], 3)) for i in sorted(region))

    def candidates(region: dict, k: int) -> list:
        """Every distinct cut of the region as (score, cost, a, b, k1, ok), best first; ties keep sweep
        order. Cuts that leave both sides contiguous come before all that do not."""
        sig = signature(region, k)
        if sig in cache:
            return cache[sig]
        half = k // 2
        if s <= 0.0:
            sizes = [half]
        else:
            sizes = sorted({1, 2, half, k - half, k - 2, k - 1} & set(range(1, k)))
        whole = inertia(st, region)
        w_compact = max(1.0 - s, TIE_COMPACT) * KAPPA
        found = []
        seen = set()
        for key in keys_for(region):
            order, settled = sweep(st, region, key)
            for k1 in sizes:
                a, b, ok = cut(region, order, settled, k1, k, tol)
                sa = signature(a, k1)
                if sa in seen:
                    continue
                seen.add(sa)
                cost = (inertia(st, a) + inertia(st, b)) / whole if whole > 0.0 else 0.0
                score = -w_compact * cost
                if s > 0.0:
                    score += s * (value(st, a, k1, sign) + value(st, b, k - k1, sign))
                found.append((score, cost, a, b, k1, ok))
        found.sort(key=lambda c: (not c[5], -c[0]))  # stable: ties keep sweep order
        cache[sig] = found
        return found

    def greedy(region: dict, k: int, force: bool = False):
        """Take the best-scored cut at every level; if a side then has no contiguous cut of its own,
        back up and take the next. None if the region cannot be finished. With `force`, a region with
        no contiguous finish takes its best cut anyway (the plan then has a non-contiguous district).
        """
        if k == 1:
            return [region]
        if len(region) == 1:
            ((i, amt),) = region.items()
            return [{i: amt / k} for _ in range(k)]
        sig = signature(region, k)
        if sig not in done:
            got = None
            for _, _, a, b, k1, ok in candidates(region, k)[:BACKTRACK_TRIES]:
                if not ok:
                    break
                pa = greedy(a, k1)
                if pa is None:
                    st.stats["backtracks"] += 1
                    continue
                pb = greedy(b, k - k1)
                if pb is None:
                    st.stats["backtracks"] += 1
                    continue
                got = pa + pb
                break
            done[sig] = got
        if done[sig] is None and force:
            st.stats["bad_cuts"] += 1
            _, _, a, b, k1, _ = candidates(region, k)[0]
            return greedy(a, k1, True) + greedy(b, k - k1, True)
        return done[sig]

    def objective(plan: list, whole: float) -> float:
        """What a finished set of districts is worth to the drawer: seats against sprawl."""
        seats_won = 0.0
        spread = 0.0
        for dist in plan:
            d = sum(st.dem[i] * dist[i] / st.pop[i] for i in sorted(dist))
            r = sum(st.rep[i] * dist[i] / st.pop[i] for i in sorted(dist))
            seats_won += phi(sign * margin(d, r) / SIGMA_PTS)
            spread += inertia(st, dist)
        cost = len(plan) * spread / whole if whole > 0.0 else 0.0
        return s * seats_won - max(1.0 - s, TIE_COMPACT) * PLAN_KAPPA * cost

    def split(region: dict, k: int) -> list:
        """Greedy with look-ahead: finish each of the best few cuts greedily and keep the best plan's
        cut. Only called on a region `greedy` can finish, so some cut always qualifies."""
        if k == 1:
            return [region]
        if len(region) == 1 or s <= 0.0 or ROLLOUTS <= 1:
            return greedy(region, k)
        cands = [c for c in candidates(region, k) if c[5]]
        tight = min(cands, key=lambda c: c[1])  # the most compact cut always gets a look
        whole = inertia(st, region)
        best = None
        looked = 0
        for c in cands:
            if looked >= ROLLOUTS and c is not tight:
                continue
            pa = greedy(c[2], c[4])
            pb = greedy(c[3], k - c[4]) if pa is not None else None
            if pb is None:
                continue
            looked += 1
            got = objective(pa + pb, whole)
            if best is None or got > best[0] + 1e-12:
                best = (got, c)
        _, (_, _, a, b, k1, _) = best
        return split(a, k1) + split(b, k - k1)

    start = {i: float(st.pop[i]) for i in range(st.n)}
    if greedy(start, seats) is None:
        return greedy(start, seats, True)
    plan = split(start, seats)
    if guard and s > 0.0:
        # never worse for the drawer, by this strength's objective, than the maps of weaker strengths
        whole = inertia(st, start)
        for weaker in (0.5 * s, 0.0):
            other = draw(st, seats, weaker, sign, seed, tol, False)
            if objective(other, whole) > objective(plan, whole) + 1e-12:
                st.stats["kept_weaker"] += 1
                plan = other
    return plan


def spread(st: State, plan: list) -> float:
    """Sum of the districts' second moments over the state's: 0 is every district a point, 1 no better than one district."""
    whole = inertia(st, {i: float(st.pop[i]) for i in range(st.n)})
    return sum(inertia(st, d) for d in plan) / whole if whole > 0.0 else 0.0


def measure(st: State, plan: list) -> dict:
    """Deviation, contiguity, splits and the seat outcome of a plan."""
    total = float(sum(st.pop))
    ideal = total / len(plan)
    rows = []
    in_districts = [0] * st.n
    for dist in plan:
        people = sum(dist.values())
        d = sum(st.dem[i] * dist[i] / st.pop[i] for i in sorted(dist))
        r = sum(st.rep[i] * dist[i] / st.pop[i] for i in sorted(dist))
        for i in dist:
            in_districts[i] += 1
        m = margin(d, r)
        rows.append(
            {
                "people": people,
                "dev_pct": 100.0 * (people - ideal) / ideal,
                "margin": m,
                "p_dem": phi(m / SIGMA_PTS),
                "contiguous": len(components(st, set(dist))) == 1,
                "counties": len(dist),
            }
        )
    assigned = [0.0] * st.n
    for dist in plan:
        for i, amt in dist.items():
            assigned[i] += amt
    leak = max(abs(assigned[i] - st.pop[i]) for i in range(st.n))
    return {
        "districts": rows,
        "max_dev_pct": max(abs(r["dev_pct"]) for r in rows),
        "all_contiguous": all(r["contiguous"] for r in rows),
        "split_counties": sum(1 for c in in_districts if c > 1),
        "forced_splits": sum(1 for i in range(st.n) if st.pop[i] > ideal),
        "min_share": min(dist[i] / st.pop[i] for dist in plan for i in dist),
        "exp_dem": sum(r["p_dem"] for r in rows),
        "hard_dem": sum(1 for r in rows if r["margin"] > 0.0),
        "leak": leak,
        "spread": spread(st, plan),
        "bound_dem": value(st, {i: float(st.pop[i]) for i in range(st.n)}, len(plan), 1.0),
        "bound_rep": value(st, {i: float(st.pop[i]) for i in range(st.n)}, len(plan), -1.0),
    }
