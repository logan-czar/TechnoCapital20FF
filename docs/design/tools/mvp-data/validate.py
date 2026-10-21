#!/usr/bin/env python3
"""Validate the three MVP data tables and print the economy checks (batch 147; start profit picture, batch 148).

    python3 validate.py [design/data dir]

Checks: row counts; wealth_index is an integer equality index of 10 to 95 (batch 158); industry names match companies.csv and the 42 of 10.3; every iso3 is in countries.csv;
every key city province id exists in the province CSVs; the profit check for a normal company in each industry;
named revenue plus the fringe pool equals world demand, with the named share; every country's financial zone
is in financial-zones.csv, with the GDP-weighted zone intensity Z; batch 152: 24 zones, 26 since batch 154, every country in exactly
one, every hub province exists, lies in its zone and belongs to its hub city, every hub city is in key-cities.csv,
exchange codes are unique, and listed companies are counted by their HQ country's zone exchange; a seeded 40-quarter run of the batch 150
industry growth model (mvp-spec 5.1), which prints how far each industry's average growth sits from its
long-term rate; and a seeded 2020 to 2045 run of the batch 151 AI boom (mvp-spec 5.1.1: boom 2030, pop 2040),
which prints AI labs' long-term rate and demand by year; batch 155: every zone has its economy columns
(credit_spread_bps, confidence_start) in range, the spread seed matches the GDP-weighted member value unless gen.py
sets the zone by hand, and country-economy.csv has sovereign_spread_bps and no country-level economy columns;
batch 157: no wage_level or price_level anywhere (labor is the industry labor_value only); D15 and D16 (Logan, M3 gate):
every starting line within its 5.12 limit at its start_rating, cut lines the largest within it, none rated CCC or CC.
Returns 1 on any error.
"""
import csv, glob, math, os, random, re, statistics, sys

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

def lt_q(lt):
    """Quarterly long-term rate (batch 151): (1 + LT)^(1/4) - 1, so demand_core tracks trend_demand even at the
    boom's 100% a year; within 0.1 pp of LT/4 for LT under 15%."""
    return (1 + lt) ** 0.25 - 1

def growth_run(inds, z_avg, seed, quarters=40):
    """Seeded run of q_growth for every industry; returns compound average yearly growth and the phase path."""
    rng = random.Random(seed)
    phase = 'Expansion'
    g = rng.uniform(*PHASES[phase][0])
    left = rng.randint(*PHASES[phase][1])
    prev = {r['name']: lt_q(float(r['trend_growth'])) for r in inds}
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
            qg = max(-0.25, lt_q(lt) + PHI * (prev[n] - lt_q(lt)) + cycle + float(r['volatility']) * noise)
            prev[n] = qg
            total[n] += math.log(1 + qg)
    # compound average yearly growth (batch 151), comparable with LT at any rate
    return {n: math.exp(4 * t / quarters) - 1 for n, t in total.items()}, path

def boom_lt(sched, q, boom_q, pop_q):
    """AI labs' long-term rate in quarter q (0 = Q1 2020) under the ai-boom.csv schedule (mvp-spec 5.1.1)."""
    pre = [float(r['ai_labs_lt']) for r in sched if r['stage'] == 'preboom'][0]
    boom = {int(r['boom_year']): float(r['ai_labs_lt']) for r in sched if r['stage'] == 'boom'}
    bust = [float(r['ai_labs_lt']) for r in sched if r['stage'] == 'bust'][0]
    post = [float(r['ai_labs_lt']) for r in sched if r['stage'] == 'postcrash'][0]
    if q < boom_q:
        return pre, 'preboom'
    if q < pop_q:
        return boom[min(max(boom), (q - boom_q) // 4)], 'boom'
    if q < pop_q + 8:
        return bust, 'bust'
    return post, 'postcrash'

def boom_run(inds, sched, z_avg, seed, pop_year=2040, pop_quarter=1, end_year=2045, noise=True):
    """Seeded quarterly run from Q1 2020 with the scripted boom (1 Jan 2030) and pop (mvp-spec 5.1.1). Every
    industry's LT = trend_growth + boom_uplift x (AI labs rate - preboom rate); at the pop demand x (1 - crash_drop)
    once and prev_q_growth resets to the new lt_q, as at the boom. Returns {name: [(year, LT, demand at year end)]}."""
    rng = random.Random(seed)
    pre = [float(r['ai_labs_lt']) for r in sched if r['stage'] == 'preboom'][0]
    boom_q, pop_q = 40, (pop_year - 2020) * 4 + pop_quarter - 1
    phase = 'Expansion'
    g = rng.uniform(*PHASES[phase][0])
    left = rng.randint(*PHASES[phase][1])
    lt0 = {r['name']: float(r['trend_growth']) for r in inds}
    up = {r['name']: float(r['boom_uplift']) for r in inds}
    dem = {r['name']: float(r['world_size_2020_usd_bn']) for r in inds}
    prev = {n: lt_q(lt0[n]) for n in lt0}
    out = {n: [] for n in lt0}
    stage_was = 'preboom'
    for q in range((end_year - 2020 + 1) * 4):
        if q > 0:
            left -= 1
            if left <= 0:
                phase = PHASES[phase][2]
                g = rng.uniform(*PHASES[phase][0])
                left = rng.randint(*PHASES[phase][1])
        ai, stage = boom_lt(sched, q, boom_q, pop_q)
        for r in inds:
            n = r['name']
            lt = lt0[n] + up[n] * (ai - pre)
            if stage != stage_was and stage in ('boom', 'bust'):
                prev[n] = lt_q(lt)                      # scripted switch: no carry-over of the old gap (A)
                if stage == 'bust':
                    dem[n] *= 1 - float(r['crash_drop'])
            z = max(-3.0, min(3.0, rng.gauss(0, 1))) if noise else 0.0
            cycle = (1 - PHI) * float(r['cycle_beta']) * cycle_k(lt, g) * z_avg * g / 4 if noise else 0.0
            qg = max(-0.25, lt_q(lt) + PHI * (prev[n] - lt_q(lt)) + cycle + float(r['volatility']) * z)
            prev[n] = qg
            dem[n] *= 1 + qg
            if q % 4 == 3:
                out[n].append((2020 + q // 4, lt, dem[n]))
        stage_was = stage
    return out

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

# mvp-spec 5.12 credit line and implied rating at load (7.1), as docs/build/decisions.md D220 to D223 and
# D235 read them. Shared by gen.py, which sizes the starting lines to the 5.12 limit (D15, D16), the
# company-start.csv checks below and export_finance_fixtures.py. All T values are 5.12's.
BASE_RATE = 0.03                      # mvp-spec 3.1
RATING_SCALE = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-',
                'B+', 'B', 'B-', 'CCC', 'CC']
RATING_BANDS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC']
RATING_FACTOR = {'AAA': 1.0, 'AA': 0.9, 'A': 0.8, 'BBB': 0.65, 'BB': 0.5, 'B': 0.3, 'CCC': 0.0, 'CC': 0.0}
SPREAD_BPS = {'AAA': 40, 'AA': 60, 'A': 90, 'BBB': 150, 'BB': 280, 'B': 450, 'CCC': 900, 'CC': 1600}
LEVERAGE = [(0.5, 'AAA'), (1.0, 'AA'), (2.0, 'A'), (3.0, 'BBB'), (4.0, 'BB+'), (5.0, 'BB-'), (6.5, 'B')]
NO_LINE_RATINGS = ('CCC', 'CC')       # D16: no company starts rated CCC or CC with a drawn line


def rating_band(r):
    """The band a notch reads its rating factor and spread from (D220): BB+ and BB- read BB."""
    return r[:-1] if r[-1] in '+-' else r


def corp_spread(r):
    """5.12 corporate spread with the 3.6.2 notch thirds (D220), a fraction."""
    b = rating_band(r)
    s = SPREAD_BPS[b]
    i = RATING_BANDS.index(b)
    if r.endswith('+') and i > 0:
        s -= (s - SPREAD_BPS[RATING_BANDS[i - 1]]) / 3
    elif r.endswith('-') and i < len(RATING_BANDS) - 1:
        s += (SPREAD_BPS[RATING_BANDS[i + 1]] - s) / 3
    return s / 1e4


def notch_shift(r, notches):
    """Better by `notches` (negative: worse), clamped to AAA..CC."""
    return RATING_SCALE[min(len(RATING_SCALE) - 1, max(0, RATING_SCALE.index(r) - notches))]


def leverage_rating(net_debt, ebitda):
    """5.12 leverage rating (D221): EBITDA <= 0 is CC, net cash is AAA, lower edges inclusive, 8.0 is CCC."""
    if ebitda <= 0:
        return 'CC'
    if net_debt <= 0:
        return 'AAA'
    x = net_debt / ebitda
    for edge, r in LEVERAGE:
        if x < edge:
            return r
    return 'CCC' if x <= 8.0 else 'CC'


def rating_at_load(net_debt, ebitda, line, home, revenue, industry, sovereign):
    """The starting rating (7.1, 5.12): leverage, then the cover (EBITDA / a year of line interest at the
    leverage rating's rate, one pass, D222), revenue and sector notches summed and clamped (D221), capped at
    the sovereign + 1 notch. Returns (leverage rating, implied rating)."""
    lev = leverage_rating(net_debt, ebitda)
    interest = line * (BASE_RATE + home + corp_spread(lev))
    if interest <= 0:
        cover = 1 if ebitda > 0 else 0
    else:
        c = ebitda / interest
        cover = 1 if c > 10 else (-2 if c < 1.5 else (-1 if c < 3 else 0))
    size = 1 if revenue > 20e9 else (-1 if revenue < 500e6 else 0)
    sector = {'power_utilities': 1, 'mining': -1, 'shipping': -1}.get(industry, 0)
    adjusted = notch_shift(lev, cover + size + sector)
    ceiling = notch_shift(sovereign, 1)
    implied = adjusted if RATING_SCALE.index(adjusted) >= RATING_SCALE.index(ceiling) else ceiling
    return lev, implied


def home_spread_bps(zone_bps, sovereign_bps):
    """5.12 home spread at load in whole bps: half the zone's base spread (D235) plus half the sovereign
    spread, rounded half away from zero (D109, D223)."""
    return math.floor(0.5 * float(zone_bps) + 0.5 * float(sovereign_bps) + 0.5)


def line_limit(book, cash, line, rating):
    """5.12 limit: max(0, 0.5 x asset_book + own cash) x rating_factor, own cash = cash - line floored at 0."""
    return max(0.0, 0.5 * book + max(0.0, cash - line)) * RATING_FACTOR[rating_band(rating)]


def run_rate(co, ind, traits, gross, book):
    """A year at the starting run rate (7.1 loadout, productivity 100, M 1.0, the 6.1 and 6.3 R&D plan):
    (revenue, EBIT, depreciation). Revenue below $0.1M uses $0.1M (the barebones loadout)."""
    r_m = max(0.1, float(co['revenue_usd_m']))
    ebit = normal_company(ind, r_m, rd_mult(co, ind, traits))[2] * r_m * 1e6
    return r_m * 1e6, ebit, min(book, decay_dollars(gross, ind))


def start_rating(co, ind, traits, econ, zone, gross, book, cash, line):
    """The 7.1 starting rating of a company with these balances: (leverage rating, implied rating)."""
    revenue, ebit, dep = run_rate(co, ind, traits, gross, book)
    home = home_spread_bps(zone['credit_spread_bps'], econ['sovereign_spread_bps']) / 1e4
    return rating_at_load(line - cash, ebit + dep, line, home, revenue, ind['id'], econ['sovereign_rating'])


LOAD_LINE_SIZING_MARGIN = 0.10   # D241 (T): starting lines are sized against the run-rate EBITDA less 10%


def sizing_limit(co, ind, traits, econ, zone, gross, book, cash):
    """D15, D241: the function line -> floor(5.12 limit of that line, at the rating it would have with the
    run-rate EBITDA cut by LOAD_LINE_SIZING_MARGIN), in whole dollars, for a company with these balances."""
    revenue, ebit, dep = run_rate(co, ind, traits, gross, book)
    home = home_spread_bps(zone['credit_spread_bps'], econ['sovereign_spread_bps']) / 1e4
    ebitda = (1 - LOAD_LINE_SIZING_MARGIN) * (ebit + dep)

    def limit_at(x):
        r = rating_at_load(x - cash, ebitda, x, home, revenue, ind['id'], econ['sovereign_rating'])[1]
        return math.floor(line_limit(book, cash, x, r))
    return limit_at


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

    for name, rows, n in [('industries', inds, 42), ('country-economy', ce, len(countries)), ('key-cities', kc, 88)]:
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
    # batch 158: wealth_index is an equality index, integer 10 (servitude) to 95; nobody reaches 100
    for r in load(os.path.join(data, 'countries.csv')):
        wi = r['wealth_index']
        if not wi.isdigit() or not 10 <= int(wi) <= 95:
            errors.append(f'{r["iso3"]}: wealth_index {wi} is not an equality index of 10 to 95')
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
    # batch 152: one exchange per zone in a hub city that is a key city; batch 154: 26 zones (Japan, Russia)
    if len(zones) != 26 or len(zone_ids) != 26:
        errors.append(f'financial-zones: {len(zones)} rows, expected 26 distinct zones')
    if len({z['exchange_code'] for z in zones}) != len(zones):
        errors.append('financial-zones: duplicate exchange codes')
    in_zone = {}
    for r in ce:
        in_zone.setdefault(r['iso3'], []).append(r['financial_zone'])
    for iso in countries:
        if len(in_zone.get(iso, [])) != 1:
            errors.append(f'{iso}: in {len(in_zone.get(iso, []))} financial zones, expected exactly 1')
    if sum(int(z['countries']) for z in zones) != len(countries):
        errors.append('financial-zones: member counts do not sum to the countries')
    prov_country = {}
    for f in glob.glob(os.path.join(data, 'provinces-*.csv')):
        prov_country.update({r['id']: r['country'] for r in load(f)})
    zone_of = {r['iso3']: r['financial_zone'] for r in ce}
    kc_by_city = {r['city']: r for r in kc}
    for z in zones:
        hub, hp = z['hub_city'], z['hub_province']
        if hp not in provinces:
            errors.append(f'{z["zone_id"]}: hub province {hp} not in the province files')
            continue
        if hub not in kc_by_city:
            errors.append(f'{z["zone_id"]}: hub city {hub} not in key-cities.csv')
        elif hp not in kc_by_city[hub]['province_ids'].split(';'):
            errors.append(f'{z["zone_id"]}: hub province {hp} not among {hub} key city provinces')
        extra = [p for p in z['extra_provinces'].split(';') if p]
        if hp not in extra and zone_of.get(prov_country[hp]) != z['zone_id']:
            errors.append(f'{z["zone_id"]}: hub province {hp} lies in {prov_country[hp]}, outside the zone')
        for p in extra:
            if p not in provinces:
                errors.append(f'{z["zone_id"]}: extra province {p} not in the province files')
    gdp = {r['iso3']: float(r['gdp_usd_bn']) for r in load(os.path.join(data, 'countries.csv'))}
    inten = {z['zone_id']: float(z['intensity']) for z in zones}
    z_avg = sum(gdp[r['iso3']] * inten[r['financial_zone']] for r in ce) / sum(gdp[r['iso3']] for r in ce)
    # batch 155 (Logan): economy settings apply per financial zone, not per country
    for col in ('sovereign_spread_bps', 'corp_tax_rate', 'sovereign_rating', 'financial_zone'):
        if ce and col not in ce[0]:
            errors.append(f'country-economy: missing column {col}')
    for col in ('country_spread_bps', 'wage_level', 'price_level', 'credit_spread_bps', 'confidence_start'):
        if ce and col in ce[0]:
            errors.append(f'country-economy: {col} is a zone setting since batch 155 or removed in batch 157')
    for col in ('wage_level', 'price_level'):
        if zones and col in zones[0]:
            errors.append(f'financial-zones: {col} removed in batch 157 (labor is the industry labor_value only)')
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        from gen import ZONE_ECON_SET
    except Exception:
        ZONE_ECON_SET = {}
    zone_econ = []
    for z in zones:
        zid = z['zone_id']
        try:
            cs, cf = float(z['credit_spread_bps']), float(z['confidence_start'])
        except (KeyError, ValueError):
            errors.append(f'{zid}: zone economy columns missing or not numbers')
            continue
        if not 0 <= cs <= 2500:
            errors.append(f'{zid}: credit_spread_bps {cs} out of 0 to 2500')
        if not -100 <= cf <= 100:
            errors.append(f'{zid}: confidence_start {cf} out of -100 to +100')
        mem = [r for r in ce if r['financial_zone'] == zid]
        g = sum(gdp[r['iso3']] for r in mem)
        seed_cs = sum(gdp[r['iso3']] * float(r['sovereign_spread_bps']) for r in mem) / g
        hand = ZONE_ECON_SET.get(zid, {})
        if 'credit_spread_bps' not in hand and abs(cs - seed_cs) > 0.51:
            errors.append(f'{zid}: credit_spread_bps {cs} is not the GDP-weighted member spread {seed_cs:.1f}')
        lo = min(mem, key=lambda r: float(r['sovereign_spread_bps']))
        hi = max(mem, key=lambda r: float(r['sovereign_spread_bps']))
        zone_econ.append((z, cs, cf, lo, hi))
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
    listed = {}
    for c in cos:
        if c['public'] == 'Y':
            ex = next(z['exchange_code'] for z in zones if z['zone_id'] == zone_of[c['hq_country']])
            listed[ex] = listed.get(ex, 0) + 1
    print('\nFinancial zones (batches 152 and 154): number, id, hub, exchange, intensity, lag, contagion, members, GDP share, '
          'listed companies (HQ country zone)')
    for z in zones:
        print(f'  {z["number"]:>2} {z["zone_id"]:4} {z["hub_city"]:17} {z["exchange_code"]} {z["intensity"]:>4} '
              f'{z["lag_quarters"]}q {z["contagion"]:>4} {z["countries"]:>3} {100 * float(z["gdp_share"]):5.1f}% '
              f'{listed.get(z["exchange_code"], 0):>3}')
    print(f'  GDP-weighted intensity Z = {z_avg:.3f}')
    print('\nZone economy (Logan, batches 155 and 157): base credit spread bps '
          '(member sovereign spread range), confidence start')
    for z, cs, cf, lo, hi in zone_econ:
        print(f'  {z["number"]:>2} {z["zone_id"]:4} '
              f'credit {cs:5.0f} ({lo["sovereign_spread_bps"]} {lo["iso3"]} to {hi["sovereign_spread_bps"]} {hi["iso3"]})  '
              f'confidence {cf:+.0f}')
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
    # batch 151: the AI boom (mvp-spec 5.1.1)
    sched = load(os.path.join(data, 'ai-boom.csv'))
    for r in inds:
        if not 0 <= float(r['boom_uplift']) <= 1 or not 0 <= float(r['crash_drop']) < 1:
            errors.append(f'{r["name"]}: boom_uplift or crash_drop out of range')
    calm = boom_run(inds, sched, z_avg, seed=151, noise=False)['AI labs']
    seeded = boom_run(inds, sched, z_avg, seed=151)
    ai = seeded['AI labs']
    print('\nAI boom (batch 151; boom 1 Jan 2030, pop 1 Jan 2040), AI labs by year: LT, year-end demand $bn '
          'without noise / seed 151')
    print('  ' + '; '.join(f'{y} {100 * lt:.0f}% {d0:.1f}/{d1:.1f}' for (y, lt, d0), (_, _, d1) in zip(calm, ai)))
    for name in ('Data centers', 'Cloud', 'Semiconductors'):
        row = {y: (lt, d) for y, lt, d in seeded[name]}
        print(f'  {name}: 2029 LT {100 * row[2029][0]:.0f}% ${row[2029][1]:.0f}B; 2030 LT {100 * row[2030][0]:.0f}% '
              f'${row[2030][1]:.0f}B; 2039 ${row[2039][1]:.0f}B; 2040 LT {100 * row[2040][0]:.0f}% ${row[2040][1]:.0f}B')
    by_y = {y: d for y, _, d in calm}
    if not 6 <= by_y[2029] <= 10:
        errors.append(f'AI labs 2029 demand ${by_y[2029]:.1f}B, expected about $5B to $8B before the boom')
    if not 1.8 <= by_y[2030] / by_y[2029] <= 2.2:
        errors.append('AI labs should about double in the boom\'s first year')
    if not by_y[2040] < 0.6 * by_y[2039]:
        errors.append('AI labs demand should crash at the 2040 pop')
    # batch 161 (Logan, G6): starting balance sheet, share count and opening price (mvp-spec 7.1);
    # D15, D16 (Logan, M3 gate): starting lines sized to the 5.12 limit, none rated CCC or CC
    cs_path = os.path.join(data, 'company-start.csv')
    if not os.path.exists(cs_path):
        errors.append('company-start.csv missing (run gen.py)')
    else:
        st = load(cs_path)
        co_by_id = {c['id']: c for c in cos}
        ce_by_iso = {r['iso3']: r for r in ce}
        zone_by_id = {z['zone_id']: z for z in zones}
        if [r['id'] for r in st] != [c['id'] for c in cos]:
            errors.append('company-start.csv ids differ from companies.csv')
        sized, sized_usd, rated = 0, 0.0, {}
        for r in st:
            co = co_by_id.get(r['id'])
            if co is None:
                continue
            bv = float(co['book_value_usd_m']) * 1e6
            min_cash = 0.05 * 1e6 * float(co['revenue_usd_m'])
            gross, ab = float(r['gross_assets_usd']), float(r['asset_book_usd'])
            cash, line = float(r['cash_usd']), float(r['credit_drawn_usd'])
            eq, p, sh = float(r['book_equity_usd']), float(r['open_price']), float(r['shares'])
            rating = r.get('start_rating', '')
            if not (p == int(p) and 5 <= p <= 200):
                errors.append(f'{r["id"]}: open_price {p} not a whole dollar in 5 to 200')
            if abs(cash + ab - (line + eq)) > 2:
                errors.append(f'{r["id"]}: assets {cash + ab:.0f} != liabilities {line:.0f} + equity {eq:.0f}')
            # 7.1 cash and line, with D15: book value at or above the asset book holds cash and no line, so
            # equity is book value; below it, cash is min_cash and the line at most the 7.1 line
            # (asset book - book value + min_cash), so equity is book value plus what the line was cut by.
            line_71 = ab - bv + min_cash if bv < ab else 0.0
            if bv >= ab and (line > 0 or abs(eq - bv) > 2):
                errors.append(f'{r["id"]}: book value covers the asset book, but the line is drawn or book equity '
                              f'{eq:.0f} differs from companies.csv book value')
            if bv < ab and (abs(cash - min_cash) > 1 or line > line_71 + 2 or eq < bv - 2):
                errors.append(f'{r["id"]}: book value is below the asset book, but cash is not min_cash, or the '
                              f'line is above the 7.1 line {line_71:.0f}, or book equity is below book value')
            if abs(ab - 0.5 * gross) > 1 or min(ab, cash, line) < 0:
                errors.append(f'{r["id"]}: asset book is not 50% of gross, or a negative balance')
            if line > 0 and cash > min_cash + 1:
                errors.append(f'{r["id"]}: draws the line while holding cash above min_cash')
            if sh < 1 or abs(sh * p - float(r['engine_value_usd'])) > p:
                errors.append(f'{r["id"]}: shares x open_price is not the engine value')
            if rating not in RATING_SCALE:
                errors.append(f'{r["id"]}: start_rating {rating} is not on the AAA to CC scale')
                continue
            rated[rating] = rated.get(rating, 0) + 1
            ind, econ = by_name[co['industry']], ce_by_iso[co['hq_country']]
            zone = zone_by_id[econ['financial_zone']]
            if start_rating(co, ind, traits, econ, zone, gross, ab, cash, line)[1] != rating:
                errors.append(f'{r["id"]}: start_rating {rating} is not the 7.1 rating of its starting balances')
            # D15: no starting line above its 5.12 limit; D16: none rated CCC or CC with a drawn line
            if line > line_limit(ab, cash, line, rating):
                errors.append(f'{r["id"]}: line {line:.0f} above its 5.12 limit '
                              f'{line_limit(ab, cash, line, rating):.0f} at {rating}')
            if line > 0 and rating in NO_LINE_RATINGS:
                errors.append(f'{r["id"]}: starts rated {rating} with a drawn line')
            # D241: every line is within its limit at the run-rate EBITDA less the sizing margin, and a line
            # cut below the 7.1 line is where gen.py's iteration x = min(7.1 line, haircut limit(x)) settles:
            # a fixed point, or the lower line of a two-line cycle
            if line > 0 or bv < ab:
                limit_at = sizing_limit(co, ind, traits, econ, zone, gross, ab, cash)
                if line > limit_at(line):
                    errors.append(f'{r["id"]}: line {line:.0f} above its 5.12 limit {limit_at(line):.0f} at the '
                                  f'run-rate EBITDA less {100 * LOAD_LINE_SIZING_MARGIN:.0f}%')
            if line < line_71 - 2:
                sized += 1
                sized_usd += line_71 - line
                l0 = round(line_71)
                nxt = min(l0, limit_at(line))
                if not (nxt == line or (nxt > line and min(l0, limit_at(nxt)) == line)):
                    errors.append(f'{r["id"]}: line {line:.0f} cut to neither a fixed point nor the lower line of '
                                  f'a cycle of x = min(7.1 line, limit(x)) at the haircut run rate')
        ps = [float(r['open_price']) for r in st]
        pl = [float(r['open_price']) for r in st if r['public'] == 'Y']
        ar = next((r for r in st if r['ticker'] == 'ARDR'), None)
        print(f'\nCompany start (batch 161): {sum(1 for r in st if float(r["credit_drawn_usd"]) == 0)} start with cash, '
              f'{sum(1 for r in st if float(r["credit_drawn_usd"]) > 0)} with a drawn line; open price all '
              f'${min(ps):.0f} / ${statistics.median(ps):.0f} / ${max(ps):.0f} (min / median / max), listed '
              f'${min(pl):.0f} / ${statistics.median(pl):.0f} / ${max(pl):.0f}, {sum(1 for x in ps if x == 5)} at $5'
              + (f'; ARDR ${float(ar["open_price"]):.0f} x {int(ar["shares"]):,} shares = '
                 f'${float(ar["engine_value_usd"]) / 1e6:.0f}M' if ar else ''))
        print(f'Starting lines (D15, D16): {sized} cut to their 5.12 limit, ${sized_usd / 1e9:.1f}B less drawn; '
              f'drawn ${sum(float(r["credit_drawn_usd"]) for r in st) / 1e9:.1f}B in all; starting ratings '
              + ', '.join(f'{k} {rated[k]}' for k in RATING_SCALE if k in rated))
    # build-plan M0.5: the fixed startup events F1 to F9 (mvp-spec 5.19.2)
    ev_path = os.path.join(data, 'startup-events.csv')
    events = load(ev_path) if os.path.exists(ev_path) else []
    if [e['id'] for e in events] != [f'F{i}' for i in range(1, 10)]:
        errors.append('startup-events.csv: expected the 9 rows F1 to F9 (run gen.py)')
    slugs = {os.path.basename(f)[len('provinces-'):-len('.csv')] for f in glob.glob(os.path.join(data, 'provinces-*.csv'))}
    n_startups = 0
    for e in events:
        eid = e['id']
        if e['trigger'] not in ('date', 'after_bust') or (e['trigger'] == 'date') != bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', e['date'])):
            errors.append(f'{eid}: trigger {e["trigger"]} with date "{e["date"]}"')
        for grp in e['startups'].split(';'):
            m = re.fullmatch(r'(\d+):([^@]+)@(.+)', grp)
            if not m:
                errors.append(f'{eid}: startup group "{grp}" is not count:industry@region')
                continue
            n_startups += int(m.group(1))
            if m.group(2) not in names:
                errors.append(f'{eid}: unknown industry {m.group(2)}')
            for reg in m.group(3).split('|'):
                if reg != 'any' and reg not in slugs and reg not in countries:
                    errors.append(f'{eid}: unknown region {reg}')
        if not 0 < float(e['revenue_min_usd_m']) <= float(e['revenue_max_usd_m']):
            errors.append(f'{eid}: revenue range {e["revenue_min_usd_m"]} to {e["revenue_max_usd_m"]}')
        for k in ('full', 'partial'):
            if not 1 <= int(e[f'{k}_min']) <= int(e[f'{k}_max']) <= 5:
                errors.append(f'{eid}: {k} cast {e[f"{k}_min"]} to {e[f"{k}_max"]} not within 1 to 5 (5.19)')
    if events and n_startups != 32:
        errors.append(f'startup-events.csv: {n_startups} startups, expected 32 (5.19.2)')
    print(f'Rows: industries {len(inds)}, country-economy {len(ce)}, key-cities {len(kc)}, zones {len(zones)}, '
          f'ai-boom {len(sched)}, startup-events {len(events)} ({n_startups} startups)')
    for e in errors:
        print('ERROR', e)
    print('OK' if not errors else f'{len(errors)} errors')
    return 1 if errors else 0

if __name__ == '__main__':
    sys.exit(run(sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/design/data'))
