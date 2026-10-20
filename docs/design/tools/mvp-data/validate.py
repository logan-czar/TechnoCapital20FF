#!/usr/bin/env python3
"""Validate the three MVP data tables and print the economy checks (batch 147; start profit picture, batch 148).

    python3 validate.py [design/data dir]

Checks: row counts; industry names match companies.csv and the 42 of 10.3; every iso3 is in countries.csv;
every key city province id exists in the province CSVs; the profit check for a normal company in each industry;
named revenue plus the fringe pool equals world demand, with the named share; every country's financial zone
is in financial-zones.csv, with the GDP-weighted zone intensity Z; and a seeded 40-quarter run of the batch 150
industry growth model (mvp-spec 5.1), which prints how far each industry's average growth sits from its
long-term rate. Returns 1 on any error.
"""
import csv, glob, math, os, random, statistics, sys

# Batch 150 growth model (mvp-spec 5.1), all T: phase -> (g range a year, length range in quarters, next phase)
PHI = 0.5
PHASES = {'Expansion': ((0.0, 0.02), (12, 28), 'Overheating'),
          'Overheating': ((0.02, 0.04), (2, 6), 'Contraction'),
          'Contraction': ((-0.06, -0.03), (2, 8), 'Recovery'),
          'Recovery': ((-0.02, 0.01), (4, 10), 'Expansion')}

def cycle_k(lt, g):
    """Asymmetric cycle sensitivity (5.1): high long-term growth amplifies upswings and damps downswings."""
    if g >= 0:
        return min(2.5, max(0.5, 1 + 5 * (lt - 0.04)))
    return min(1.5, max(0.25, 1 - 2.5 * (lt - 0.04)))

def growth_run(inds, z_avg, seed, quarters=40):
    """Seeded run of q_growth for every industry; returns average annual growth and the phase path."""
    rng = random.Random(seed)
    phase = 'Expansion'
    g = rng.uniform(*PHASES[phase][0])
    left = rng.randint(*PHASES[phase][1])
    prev = {r['name']: float(r['trend_growth']) / 4 for r in inds}
    total = dict.fromkeys(prev, 0.0)
    path = []
    for q in range(quarters):
        if q > 0:
            left -= 1
            if left <= 0:
                phase = PHASES[phase][2]
                g = rng.uniform(*PHASES[phase][0])
                left = rng.randint(*PHASES[phase][1])
        path.append((phase, g))
        for r in inds:
            n, lt = r['name'], float(r['trend_growth'])
            noise = max(-3.0, min(3.0, rng.gauss(0, 1)))
            cycle = (1 - PHI) * float(r['cycle_beta']) * cycle_k(lt, g) * z_avg * g / 4
            qg = max(-0.25, lt / 4 + PHI * (prev[n] - lt / 4) + cycle + float(r['volatility']) * noise)
            prev[n] = qg
            total[n] += qg
    return {n: 4 * t / quarters for n, t in total.items()}, path

def load(path):
    return list(csv.DictReader(open(path, encoding='utf-8')))

def free_rd_pct(held):
    return 0 if held < 1 else 1 + math.floor(math.log10(held))

def steady_held(c_tb, base):
    """Held TB where conversion equals decay: C = base x (1 + log10 h) x h (mvp-spec 5.9)."""
    if c_tb <= 0:
        return 0.0
    lo, hi = 1.0, 1e12
    for _ in range(200):
        mid = math.sqrt(lo * hi)
        if base * (1 + math.log10(mid)) * mid > c_tb:
            hi = mid
        else:
            lo = mid
    return lo

def decay_dollars(gross, ind):
    """Yearly asset decay: asset_decay on the part of gross assets above the threshold (Logan, batch 149;
    marginal, mvp-spec 5.10). $50M at 1% above $10M decays $400k; $10M or less decays nothing."""
    return float(ind['asset_decay']) * max(0.0, gross - float(ind['asset_decay_threshold_usd']))

def pc_bonus(gross, lv):
    """7.1 loadout: productivity stations max(1, round(0.25 x labor)), PC bonus floor(1 + log10 PC) (5.8)."""
    stations = max(1, round(0.25 * max(1, math.floor(gross / lv))))
    return math.floor(1 + math.log10(stations))

def normal_company(ind, r_m, rd_mult=1.0):
    """A normal company: starting loadout of mvp-spec 7.1 at revenue r_m ($M), productivity 100, M 1.0,
    R&D target rd_norm x rd_mult. Gross assets are set so revenue is r_m with the PC bonus (7.1), so fixed
    costs (f x turnover x gross) fall to f x 100 / (100 + bonus) of revenue. Returns (EBIT margin at the
    norm with no bonus, free R&D %, EBIT margin at start with the PC bonus and free R&D, fixed_cost_rate)."""
    cap, f, m = float(ind['capital_per_dollar']), float(ind['fixed_cost_share']), float(ind['margin_full_use'])
    rd = float(ind['rd_norm'])
    tb, base, lv = float(ind['data_tb_per_musd']), float(ind['data_decay_base']), float(ind['labor_value_usd'])
    bonus = pc_bonus(r_m * 1e6 * cap, lv)
    bonus = pc_bonus(r_m * 1e6 * cap * 100 / (100 + bonus), lv)   # iterate twice (7.1)
    gross = r_m * 1e6 * cap * 100 / (100 + bonus)
    labor = max(1, math.floor(gross / lv))
    inflow = r_m * tb / 12                       # TB a month
    ent = math.ceil(0.5 * r_m * tb / 10.95)      # C16
    conv = min(ent * 0.9125, 0.5 * inflow)
    held = steady_held(conv, base)
    free = free_rd_pct(held) / 100
    stored = held + 12 * inflow                  # worst case: a full year of unstructured kept
    shared = 12 * (50 * max(9, math.ceil(0.2 * labor)) + 10 * max(10, math.ceil(1.2 * stored / 100)) + 30 * ent)
    fcr = f / cap - decay_dollars(gross, ind) / gross - shared / gross
    start = m + f * bonus / (100 + bonus) - max(0.0, rd * rd_mult - free)
    return m - rd, free, start, fcr

def rd_mult(co, ind, traits):
    """mvp-spec 6.1 archetype R&D mult times the 6.3 trait mult of a named controller (productivity 100)."""
    t = traits.get(co['controller'], [])
    if co['control_basis'] == 'state':
        mult = 1.0
    elif float(co['revenue_usd_m']) < 50 and ind['sector'] == 'Tech':
        mult = 1.2
    elif 'Ambitious' in t or 'Brave' in t:
        mult = 1.3
    elif 'Greedy' in t or 'Cautious' in t:
        mult = 0.7
    else:
        mult = 1.0
    for tr, k in [('Greedy', 0.8), ('Visionary', 1.25), ('Conservative', 0.9), ('Diligent', 1.1)]:
        if tr in t:
            mult *= k
    return mult

def run(data):
    errors = []
    inds = load(os.path.join(data, 'industries.csv'))
    ce = load(os.path.join(data, 'country-economy.csv'))
    kc = load(os.path.join(data, 'key-cities.csv'))
    countries = {r['iso3'] for r in load(os.path.join(data, 'countries.csv'))}
    cos = load(os.path.join(data, 'companies.csv'))
    provinces = set()
    for f in glob.glob(os.path.join(data, 'provinces-*.csv')):
        provinces |= {r['id'] for r in load(f)}

    for name, rows, n in [('industries', inds, 42), ('country-economy', ce, len(countries)), ('key-cities', kc, 80)]:
        if len(rows) != n:
            errors.append(f'{name}: {len(rows)} rows, expected {n}')
    names = {r['name'] for r in inds}
    co_inds = {c['industry'] for c in cos}
    if names != co_inds:
        errors.append(f'industry names differ from companies.csv: {sorted(names ^ co_inds)}')
    if len({r['id'] for r in inds}) != len(inds):
        errors.append('duplicate industry ids')
    for r in inds:
        if not 0 <= float(r['asset_decay']) <= 0.10:
            errors.append(f'{r["name"]}: asset_decay out of 0 to 10%')
        if float(r['asset_decay_threshold_usd']) < 0:
            errors.append(f'{r["name"]}: negative asset_decay_threshold_usd')
        if abs(float(r['margin_full_use']) + float(r['fixed_cost_share']) + float(r['variable_cost_share']) - 1) > 1e-9:
            errors.append(f'{r["name"]}: cost shares do not sum to 1')
    ce_iso = [r['iso3'] for r in ce]
    if set(ce_iso) != countries or len(ce_iso) != len(set(ce_iso)):
        errors.append(f'country-economy iso3 mismatch: {sorted(set(ce_iso) ^ countries)}')
    zones = load(os.path.join(data, 'financial-zones.csv'))
    zone_ids = {z['zone_id'] for z in zones}
    for r in ce:
        if r['financial_zone'] not in zone_ids:
            errors.append(f'{r["iso3"]}: unknown financial_zone {r["financial_zone"]}')
    for z in zones:
        if float(z['intensity']) <= 0:
            errors.append(f'{z["zone_id"]}: intensity must be above 0')
    gdp = {r['iso3']: float(r['gdp_usd_bn']) for r in load(os.path.join(data, 'countries.csv'))}
    inten = {z['zone_id']: float(z['intensity']) for z in zones}
    z_avg = sum(gdp[r['iso3']] * inten[r['financial_zone']] for r in ce) / sum(gdp[r['iso3']] for r in ce)
    for r in inds:
        if not 0 <= float(r['volatility']) <= 0.10:
            errors.append(f'{r["name"]}: volatility out of 0 to 10% a quarter')
    for r in kc:
        if r['country'] not in countries:
            errors.append(f'{r["city"]}: unknown country {r["country"]}')
        ids = r['province_ids'].split(';')
        bad = [p for p in ids if p not in provinces]
        if bad or not ids:
            errors.append(f'{r["city"]}: unknown province ids {bad}')
        for s in r['specialties'].split(';'):
            if s not in names:
                errors.append(f'{r["city"]}: unknown specialty {s}')

    # economy checks
    named = {}
    for c in cos:
        named.setdefault(c['industry'], []).append(float(c['revenue_usd_m']))
    print('\nIndustry checks: normal company = median named revenue, 7.1 loadout, productivity 100, M 1.0')
    print(f'{"industry":22} {"named $bn":>10} {"world $bn":>10} {"named %":>8} {"fringe $bn":>10} '
          f'{"EBIT@norm":>9} {"free R&D":>8} {"EBIT@start":>10} {"fcr":>6}  flag')
    shares = []
    for r in inds:
        rev = named[r['name']]
        nb, world = sum(rev) / 1000, float(r['world_size_2020_usd_bn'])
        fringe = max(0.0, world - nb)
        if abs(nb + fringe - world) > 1e-6:
            errors.append(f'{r["name"]}: named revenue ${nb:.1f}B exceeds world size ${world:.1f}B')
        shares.append((nb / world, r['name']))
        e_norm, free, e_free, fcr = normal_company(r, statistics.median(rev))
        flag = []
        if fcr <= 0:
            flag.append('FIXED COST RATE <= 0')
            errors.append(f'{r["name"]}: fixed_cost_rate {fcr:.3f}')
        if r['cash_burning'] == 'N' and e_norm < 0:
            flag.append('loss at the norm')
        elif r['cash_burning'] == 'N' and abs(e_norm) < 1e-9:
            flag.append('break-even at the norm')
        if r['cash_burning'] == 'Y':
            flag.append('cash-burning')
        print(f'{r["name"]:22} {nb:10.1f} {world:10.0f} {100 * nb / world:7.1f}% {fringe:10.1f} '
              f'{100 * e_norm:8.1f}% {100 * free:7.0f}% {100 * e_free:9.1f}% {fcr:6.3f}  {", ".join(flag)}')
    lo, hi = min(shares), max(shares)
    print(f'\nNamed share of world demand: {100 * lo[0]:.2f}% ({lo[1]}) to {100 * hi[0]:.1f}% ({hi[1]}); '
          f'median {100 * statistics.median(s for s, _ in shares):.1f}%')
    # every starting company (batch 148): EBIT after paid R&D at load, productivity 100, M 1.0
    by_name = {r['name']: r for r in inds}
    traits = {c['id']: c['traits'].split(';') for c in load(os.path.join(data, 'characters.csv'))}
    margins = []
    for c in cos:
        r_m = max(0.1, float(c['revenue_usd_m']))  # under $0.1M: the barebones loadout (7.1)
        ind = by_name[c['industry']]
        margins.append(normal_company(ind, r_m, rd_mult(c, ind, traits))[2])
    pos = sum(1 for x in margins if x > 1e-9)
    neg = sum(1 for x in margins if x < -1e-9)
    print(f'\nStarting companies, EBIT after paid R&D at load (PC bonus, free R&D, archetype and trait R&D): '
          f'{pos} of {len(margins)} profitable, {neg} loss-making, {len(margins) - pos - neg} at 0; '
          f'median margin {100 * statistics.median(margins):.1f}%, range {100 * min(margins):.1f}% to '
          f'{100 * max(margins):.1f}%')
    d0 = inds[0]
    if abs(decay_dollars(50e6, d0) - 0.01 * 40e6) > 1e-6 and float(d0['asset_decay']) == 0.01:
        errors.append('decay example: $50M should decay $400k a year')
    bb = float(d0['fixed_cost_share']) / float(d0['capital_per_dollar']) - decay_dollars(1e5, d0) / 1e5 - 7000 / 1e5
    print(f'Asset decay (batch 149): {100 * float(d0["asset_decay"]):.0f}% a year above '
          f'${float(d0["asset_decay_threshold_usd"]) / 1e6:.0f}M; $50M decays ${decay_dollars(50e6, d0) / 1e3:.0f}k a year; '
          f'barebones ($100k) decays ${decay_dollars(1e5, d0):.0f}, fixed_cost_rate {bb:.2f}')
    fcrs = []
    for c in cos:
        ind = by_name[c['industry']]
        fcrs.append(normal_company(ind, max(0.1, float(c['revenue_usd_m'])))[3])
    print(f'Starting companies fixed_cost_rate: {min(fcrs):.3f} to {max(fcrs):.3f}, median {statistics.median(fcrs):.3f}; '
          f'{sum(1 for c in cos if float(c["revenue_usd_m"]) * float(by_name[c["industry"]]["capital_per_dollar"]) > 10)} '
          f'of {len(cos)} start above the decay threshold')
    if bb <= 0:
        errors.append(f'barebones fixed_cost_rate {bb:.3f}')
    # batch 150: financial zones and the industry growth model (mvp-spec 5.1)
    print('\nFinancial zones (batch 150): ' + ', '.join(f'{z["zone_id"]} {z["intensity"]} '
          f'({100 * float(z["gdp_share"]):.0f}% of GDP)' for z in zones) + f'; GDP-weighted intensity Z = {z_avg:.3f}')
    avg, path = growth_run(inds, z_avg, seed=150)
    gaps = sorted((avg[r['name']] - float(r['trend_growth']), r['name']) for r in inds)
    print(f'Growth check, seed 150, 40 quarters: average growth minus long-term rate, mean '
          f'{100 * statistics.mean(x for x, _ in gaps):+.2f} pp, sd {100 * statistics.pstdev(x for x, _ in gaps):.2f} pp, '
          f'from {100 * gaps[0][0]:+.2f} pp ({gaps[0][1]}) to {100 * gaps[-1][0]:+.2f} pp ({gaps[-1][1]})')
    seen = []
    for p, g in path:
        if not seen or seen[-1][0] != p:
            seen.append([p, g, 0])
        seen[-1][2] += 1
    print('  cycle path: ' + ', '.join(f'{p} {100 * g:+.1f}% x{n}q' for p, g, n in seen))
    for name in ('Retail', 'Software', 'AI labs', 'Oil'):
        lt = float(next(r for r in inds if r['name'] == name)['trend_growth'])
        print(f'  {name}: long-term {100 * lt:.1f}%, 40-quarter average {100 * avg[name]:.2f}%')
    if max(abs(x) for x, _ in gaps) > 0.06:
        errors.append('growth check: an industry averages more than 6 pp from its long-term rate')
    print(f'Rows: industries {len(inds)}, country-economy {len(ce)}, key-cities {len(kc)}, zones {len(zones)}')
    for e in errors:
        print('ERROR', e)
    print('OK' if not errors else f'{len(errors)} errors')
    return 1 if errors else 0

if __name__ == '__main__':
    sys.exit(run(sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/design/data'))
