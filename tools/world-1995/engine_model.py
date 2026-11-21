"""The engine-side rules the 1995 generator sizes starting balance sheets with: the 7.1 loadout, the
normal company, and the 5.12 rating and credit line at load. Moved out of the 2020 world's
docs/design/tools/mvp-data/validate.py when that world was removed (D1055); the code is unchanged.
"""
import csv, math


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

