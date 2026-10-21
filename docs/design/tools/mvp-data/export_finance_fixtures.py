#!/usr/bin/env python3
"""Export the starting run rate of the 651 companies with their starting ratings and synthetic Q4 2019
statements, as a golden fixture for the Rust finance formulas (build-plan M4.2, M4.4, M4.5; lane F, F4).

    python3 export_finance_fixtures.py [design/data dir] [output dir]

An independent Python implementation of mvp-spec 3.9, 4.4, 5.11, 5.12 and 7.1 as the F4 decisions read them
(docs/build/decisions.md D220 to D234), used to check the engine's functions; nothing here feeds the game.

Run-rate inputs (a year, USD) come from validate.py's normal company (mvp-spec 7.1 loadout at productivity
100 and M 1.0, the 6.1 and 6.3 R&D plan; validate.normal_company), so EBIT is validate.py's starting margin
times revenue; the gross assets, asset book, cash and line are company-start.csv's. Revenue below $0.1M uses
$0.1M (the barebones loadout, as gen.py does).

The rating at load (7.1, 5.12; D221, D222): the leverage rating from net debt / EBITDA (EBITDA <= 0 is CC,
net cash is AAA), the cover from EBITDA / a year of line interest at the leverage rating's rate (one pass),
the revenue and sector notches summed and clamped to AAA..CC, capped at the sovereign + 1 notch. Then a year
at the run rate with that rating: line interest, undrawn fee, interest on own cash (5.12), tax on positive
pre-tax income (5.11, no carryforward at load), replacement purchases equal to depreciation (flat history,
D228). Home spread: half the zone's base spread plus half the sovereign spread, rounded half away from zero
(D109, D223).

Columns of finance-start.csv (USD a year unless named q4_ or bs_; ratings as labels):
  id, revenue, variable, fixed_cash, rd, shared, depreciation, ebit (the run-rate lines);
  home_spread_bps, leverage_rating, start_rating, line_rate, limit;
  line_interest, line_fee, interest_income, pre_tax_income, tax, net_income, operating_cash, net_change;
  q4_revenue, q4_ebit, q4_ebitda, q4_pre_tax_income, q4_tax, q4_net_income, q4_operating_cash, q4_net_change
  (the synthetic Q4 2019 statement, a quarter of the year);
  bs_total_assets, bs_total_liabilities, bs_equity (the starting balance sheet).
"""
import csv, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA = os.path.normpath(os.path.join(HERE, '..', '..', 'data'))
DEFAULT_OUT = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'crates', 'sim', 'tests', 'fixtures'))

BASE_RATE = 0.03                      # mvp-spec 3.1
SCALE = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-',
         'B+', 'B', 'B-', 'CCC', 'CC']
BANDS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC']
FACTOR = {'AAA': 1.0, 'AA': 0.9, 'A': 0.8, 'BBB': 0.65, 'BB': 0.5, 'B': 0.3, 'CCC': 0.0, 'CC': 0.0}
SPREAD_BPS = {'AAA': 40, 'AA': 60, 'A': 90, 'BBB': 150, 'BB': 280, 'B': 450, 'CCC': 900, 'CC': 1600}
LEVERAGE = [(0.5, 'AAA'), (1.0, 'AA'), (2.0, 'A'), (3.0, 'BBB'), (4.0, 'BB+'), (5.0, 'BB-'), (6.5, 'B')]


def band(r):
    return r[:-1] if r[-1] in '+-' else r


def spread(r):
    """5.12 corporate spread with the 3.6.2 notch thirds (D220), a fraction."""
    b = band(r)
    s = SPREAD_BPS[b]
    i = BANDS.index(b)
    if r.endswith('+') and i > 0:
        s -= (s - SPREAD_BPS[BANDS[i - 1]]) / 3
    elif r.endswith('-') and i < len(BANDS) - 1:
        s += (SPREAD_BPS[BANDS[i + 1]] - s) / 3
    return s / 1e4


def shift(r, notches):
    """Better by `notches` (negative: worse), clamped to AAA..CC."""
    return SCALE[min(len(SCALE) - 1, max(0, SCALE.index(r) - notches))]


def leverage(net_debt, ebitda):
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
    lev = leverage(net_debt, ebitda)
    interest = line * (BASE_RATE + home + spread(lev))
    if interest <= 0:
        cover = 1 if ebitda > 0 else 0
    else:
        c = ebitda / interest
        cover = 1 if c > 10 else (-2 if c < 1.5 else (-1 if c < 3 else 0))
    size = 1 if revenue > 20e9 else (-1 if revenue < 500e6 else 0)
    sector = {'power_utilities': 1, 'mining': -1, 'shipping': -1}.get(industry, 0)
    adjusted = shift(lev, cover + size + sector)
    ceiling = shift(sovereign, 1)
    implied = adjusted if SCALE.index(adjusted) >= SCALE.index(ceiling) else ceiling
    return lev, implied


def main():
    data = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DATA
    out = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    cos = validate.load(os.path.join(data, 'companies.csv'))
    inds = {r['name']: r for r in validate.load(os.path.join(data, 'industries.csv'))}
    traits = {c['id']: c['traits'].split(';') for c in validate.load(os.path.join(data, 'characters.csv'))}
    ce = {r['iso3']: r for r in validate.load(os.path.join(data, 'country-economy.csv'))}
    zones = {z['zone_id']: z for z in validate.load(os.path.join(data, 'financial-zones.csv'))}
    start = {r['id']: r for r in validate.load(os.path.join(data, 'company-start.csv'))}
    rows = []
    for c in cos:
        ind = inds[c['industry']]
        s = start[c['id']]
        r_m = max(0.1, float(c['revenue_usd_m']))
        r = r_m * 1e6
        m, f = float(ind['margin_full_use']), float(ind['fixed_cost_share'])
        cap, lv = float(ind['capital_per_dollar']), float(ind['labor_value_usd'])
        tb, base = float(ind['data_tb_per_musd']), float(ind['data_decay_base'])
        # validate.normal_company's loadout, line by line (its fourth return is the fixed cost rate).
        b = validate.pc_bonus(r * cap, lv)
        b = validate.pc_bonus(r * cap * 100 / (100 + b), lv)
        g_model = r * cap * 100 / (100 + b)
        labor = max(1, math.floor(g_model / lv))
        inflow = r_m * tb / 12
        ent = math.ceil(0.5 * r_m * tb / 10.95)
        held = validate.steady_held(min(ent * 0.9125, 0.5 * inflow), base)
        stored = held + 12 * inflow
        shared = 12 * (50 * max(9, math.ceil(0.2 * labor)) + 10 * max(10, math.ceil(1.2 * stored / 100)) + 30 * ent)
        gross, book = float(s['gross_assets_usd']), float(s['asset_book_usd'])
        cash, line = float(s['cash_usd']), float(s['credit_drawn_usd'])
        dep = min(book, validate.decay_dollars(gross, ind))
        fixed_total = r * f * 100 / (100 + b)               # fixed cash + depreciation + shared (5.5)
        _, free, start_margin, _ = validate.normal_company(ind, r_m, validate.rd_mult(c, ind, traits))
        rd = r * max(0.0, float(ind['rd_norm']) * validate.rd_mult(c, ind, traits) - free)
        variable = r * (1 - m - f)
        fixed_cash = fixed_total - dep - shared
        ebit = r - variable - fixed_cash - shared - dep - rd
        assert abs(ebit - start_margin * r) < 1e-6 * max(1.0, r), (c['id'], ebit, start_margin * r)
        e = ce[c['hq_country']]
        z = zones[e['financial_zone']]
        home_bps = math.floor(0.5 * float(z['credit_spread_bps']) + 0.5 * float(e['sovereign_spread_bps']) + 0.5)
        home = home_bps / 1e4
        ebitda = ebit + dep
        lev, rating = rating_at_load(line - cash, ebitda, line, home, r, ind['id'], e['sovereign_rating'])
        rate = BASE_RATE + home + spread(rating)
        own = max(0.0, cash - line)
        limit = max(0.0, 0.5 * book + own) * FACTOR[band(rating)]
        interest = line * rate
        fee = max(0.0, limit - line) * 0.0025
        income = own * (BASE_RATE - 0.0025)
        pti = ebit - interest - fee + income
        tax = max(0.0, pti) * float(e['corp_tax_rate'])
        ni = pti - tax
        op_cash = r - variable - fixed_cash - rd - shared - interest - fee + income - tax
        net_change = op_cash - dep                          # replacement purchases = depreciation (D228)
        q = 0.25
        row = {
            'id': c['id'], 'revenue': r, 'variable': variable, 'fixed_cash': fixed_cash, 'rd': rd,
            'shared': shared, 'depreciation': dep, 'ebit': ebit,
            'home_spread_bps': home_bps, 'leverage_rating': lev, 'start_rating': rating,
            'line_rate': rate, 'limit': limit, 'line_interest': interest, 'line_fee': fee,
            'interest_income': income, 'pre_tax_income': pti, 'tax': tax, 'net_income': ni,
            'operating_cash': op_cash, 'net_change': net_change,
            'q4_revenue': r * q, 'q4_ebit': ebit * q, 'q4_ebitda': ebitda * q, 'q4_pre_tax_income': pti * q,
            'q4_tax': tax * q, 'q4_net_income': ni * q, 'q4_operating_cash': op_cash * q,
            'q4_net_change': net_change * q,
            'bs_total_assets': cash + book, 'bs_total_liabilities': line, 'bs_equity': cash + book - line,
        }
        rows.append({k: (repr(v) if isinstance(v, float) else v) for k, v in row.items()})
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, 'finance-start.csv')
    with open(path, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    print(f'wrote {path}: {len(rows)} rows')


if __name__ == '__main__':
    main()
