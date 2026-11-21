"""company-start.csv for a world (mvp-spec 7.1, G6; D15, D16, D238 to D241) and the 3.3.2 valuation
groups: moved out of the 2020 world's docs/design/tools/mvp-data/gen.py when that world was removed
(D1055); the code is unchanged. The caller sets DATA (the folder whose companies, industries and
characters it reads) and FV_Y10_BASE (the world's 10-year base rate) before build_company_start.
"""
import os

DATA = None

def by_list(table):
    out = {}
    for val, names in table:
        for n in names:
            out[n] = val
    return out

# 3-markets 3.3.2 sector table: valuation group, M_sector (P/E)
VGROUP = by_list([
    ('Software', ['Software', 'SaaS', 'Social media', 'Ads', 'Gaming', 'Gambling']),
    ('Hardware', ['Semiconductors', 'Consumer electronics']),
    ('AI and compute', ['AI labs', 'Cloud', 'Data centers']),
    ('Health', ['Pharma', 'Healthcare services']),
    ('Finance', ['Banking', 'Insurance', 'Asset management']),
    ('Energy', ['Oil', 'Gas']),
    ('Materials', ['Mining', 'Metals', 'Chemicals']),
    ('Manufacturing', ['Autos', 'EVs', 'Aerospace', 'Robotics', 'Drones', 'Construction']),
    ('Transport', ['Shipping', 'Logistics', 'Airlines']),
    ('Consumer', ['Retail', 'E-commerce', 'Fast food', 'Luxury']),
    ('Real estate', ['Real estate']),
    ('Utilities', ['Power utilities', 'Renewables', 'Telecom']),
    ('Defense', ['Defense']),
    ('Agriculture', ['Agriculture']),
    ('Professional services', ['Professional services']),
])
PE = {'Software': 28, 'Hardware': 22, 'AI and compute': 35, 'Health': 18, 'Finance': 11, 'Energy': 10, 'Materials': 11,
      'Manufacturing': 17, 'Transport': 12, 'Consumer': 20, 'Real estate': 15, 'Utilities': 16, 'Defense': 18,
      'Agriculture': 15, 'Professional services': 16}
# Black market has no row in 3.3.2 (A): it uses Professional services, the other Services row.
VGROUP['Black market'] = 'Professional services'

PRICE_BASE, PRICE_REF_USD, PRICE_EXP, PRICE_MIN, PRICE_MAX, PRICE_JITTER = 25.0, 1e9, 0.35, 5, 200, 0.10   # (T)
MIN_VALUE_USD = 100000.0   # value floor for share counts: the barebones company's one asset (A)
# mvp-spec 5.13 fair value: R = clamp(9% / (y10 + 5%), 0.4, 1.6), y10 = 3.5% + home spread;
# G = clamp(1 + 2.5 x (g - g_sector), 0.5, 2.5); floor 0.6 x book equity, 0.9 for Real estate
FV_R_NUM, FV_Y10_BASE, FV_R_ADD, FV_R_MIN, FV_R_MAX = 0.09, 0.035, 0.05, 0.4, 1.6
FV_G_SLOPE, FV_G_MIN, FV_G_MAX = 2.5, 0.5, 2.5
FV_FLOOR, FV_FLOOR_REAL_ESTATE = 0.6, 0.9

def price_jitter(cid):
    """Seeded jitter of up to +-10%, read from a hash of the company id (no random state, same every run)."""
    import zlib
    return 1 + PRICE_JITTER * (2 * (zlib.crc32(('price:' + cid).encode()) % 10001) / 10000 - 1)

LINE_SIZE_MAX_STEPS = 1000     # D15 iteration cap; it settles within a few steps unless the line is below cash (A)

def size_line(l0, limit_at):
    """D15 (Logan, M3 gate) with D241: size a starting line to the 5.12 limit. `limit_at(x)` is the limit of
    line x in whole dollars at the rating x would have with the run-rate EBITDA cut by
    validate.LOAD_LINE_SIZING_MARGIN (validate.sizing_limit). The limit only falls as the line grows (more
    net debt and less cover give a rating no better), so the lines within their own limit are $0 to some L*,
    found by binary search. Iterating x = min(7.1 line, limit_at(x)) from the 7.1 line either reaches a
    fixed point, which is L*, or alternates between two lines (one just past a band edge, whose worse band's
    limit is the other); then the line is the lower of the two (D241). Either way it is within its limit at
    the haircut run rate, so at the full run rate too. Returns (line, 'kept' | 'fixed' | 'cycle', L*)."""
    def ok(x):
        return x <= limit_at(x)
    if ok(l0):
        return l0, 'kept', l0
    lo, hi = 0, l0                 # 0 is always within its limit; l0 is not
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if ok(mid):
            lo = mid
        else:
            hi = mid
    seq, x = [l0], l0
    for _ in range(LINE_SIZE_MAX_STEPS):
        nxt = min(l0, limit_at(x))
        if nxt == x:
            assert x == lo, ('D15 fixed point is not the largest line within its limit', x, lo)
            return x, 'fixed', lo
        if nxt in seq:
            low = min(seq[seq.index(nxt):])
            assert ok(low) and low <= lo, ('D241 lower cycle line is not within its limit', seq, lo)
            return low, 'cycle', lo
        seq.append(nxt)
        x = nxt
    raise AssertionError(('D15 line sizing did not settle', l0, seq[-5:]))

def build_company_start(ce_rows, zones):
    """Starting balance sheet and share count for the 651 companies (Logan, batch 161, 1a and 2b; D15, D16).
    Asset book = 50% of gross business assets (7.1 loadout); cash fills the gap up to book equity, or a
    drawn credit line covers asset book above book equity plus min_cash (5% of revenue). D15 (Logan, M3
    gate): that line is then sized to the 5.12 limit at its own starting rating, with the run-rate EBITDA
    cut by validate.LOAD_LINE_SIZING_MARGIN (size_line; D241); the cash the
    smaller line no longer funds is not added back, so cash stays min_cash, the asset book (and so revenue)
    is unchanged, and book equity = asset book + cash - line rises above companies.csv book_value. D16: no
    company starts rated CCC or CC with a drawn line. start_rating (7.1, 5.12; D220 to D223, D235) is
    validate.start_rating on the balances as written. Engine value is the 5.13 fair value at load on that
    book equity (D238): flat synthetic history (g 0, so G = clamp(1 - 2.5 x lt, 0.5, 2.5) with g_sector the
    industry's lt, D1, D239), R from the home spread rounded as D223 does, Normal cycle, company confidence
    1.0, X from the zone confidence_start for listed companies, floored at 0.6 x book (0.9 for Real estate);
    it skips line interest (A). open_price =
    clamp(round(25 x (value / $1B)^0.35 x jitter), 5, 200)
    (a fixed $1B reference, not the median, so the spread reaches about $5 to $200); shares = value / open_price."""
    import engine_model as validate
    cos = validate.load(os.path.join(DATA, 'companies.csv'))
    inds = {r['name']: r for r in validate.load(os.path.join(DATA, 'industries.csv'))}
    traits = {c['id']: c['traits'].split(';') for c in validate.load(os.path.join(DATA, 'characters.csv'))}
    ce = {r['iso3']: r for r in ce_rows}
    zone = {z['zone_id']: z for z in zones}
    rows = []
    log = {'kept': 0, 'fixed': 0, 'cycle': 0, 'below_largest': 0, 'd16': 0}
    for c in cos:
        ind = inds[c['industry']]
        r_usd = float(c['revenue_usd_m']) * 1e6
        be = float(c['book_value_usd_m']) * 1e6
        if r_usd < 1e5:   # barebones loadout (7.1)
            gross = 1e5
        else:
            cap, lv = float(ind['capital_per_dollar']), float(ind['labor_value_usd'])
            b = validate.pc_bonus(r_usd * cap, lv)
            b = validate.pc_bonus(r_usd * cap * 100 / (100 + b), lv)
            gross = r_usd * cap * 100 / (100 + b)
        asset_book = 0.5 * gross
        min_cash = 0.05 * r_usd
        if be >= asset_book:
            cash, line = be - asset_book, 0.0
        else:
            line, cash = asset_book - be + min_cash, min_cash
        e = ce[c['hq_country']]
        z = zone[e['financial_zone']]
        # The rating and the limit read the balances as written (whole dollars), as the engine loads them.
        gross_w, book_w, cash_w = round(2 * asset_book), round(asset_book), round(cash)
        rev_rr, ebit_rr, dep_rr = validate.run_rate(c, ind, traits, gross_w, book_w)
        home_rr = validate.home_spread_bps(z['credit_spread_bps'], e['sovereign_spread_bps']) / 1e4

        def rating_at(x):   # the start_rating column: the full run rate, no haircut
            return validate.rating_at_load(x - cash_w, ebit_rr + dep_rr, x, home_rr, rev_rr, ind['id'],
                                           e['sovereign_rating'])[1]
        if line > 0:
            limit_at = validate.sizing_limit(c, ind, traits, e, z, gross_w, book_w, cash_w)
            sized, how, largest = size_line(round(line), limit_at)
            log[how] += 1
            log['below_largest'] += largest - sized
            if sized > 0 and rating_at(sized) in validate.NO_LINE_RATINGS:   # D16 (none after D15: limit 0)
                sized = 0
                log['d16'] += 1
            if sized != round(line):
                line, be = float(sized), cash + asset_book - sized
        rating = rating_at(round(line))
        margin = validate.normal_company(ind, max(0.1, float(c['revenue_usd_m'])), validate.rd_mult(c, ind, traits))[2]
        ebit = margin * r_usd
        ni = ebit * (1 - float(e['corp_tax_rate'])) if ebit > 0 else ebit
        # 5.13 at load: y10 = 3.5% + home spread, the home spread rounded to whole bps (D223, design fix 231);
        # G with g = 0 against g_sector = the industry's lt (D1; D239, design fix 230)
        rf = min(FV_R_MAX, max(FV_R_MIN, FV_R_NUM / (FV_Y10_BASE + home_rr + FV_R_ADD)))
        g_mult = min(FV_G_MAX, max(FV_G_MIN, 1 + FV_G_SLOPE * (0.0 - float(ind['trend_growth']))))
        x = 1 + 0.10 * float(z['confidence_start']) / 100 if c['public'] == 'Y' else 1.0
        if ni > 0:
            fv = (0.3 * be + 0.7 * ni * float(ind['earnings_multiple']) * g_mult * rf) * x
        else:
            fv = be * x
        floor = FV_FLOOR_REAL_ESTATE if ind['id'] == 'real_estate' else FV_FLOOR   # 5.13 step 5 (design fix 231)
        fv = max(fv, floor * be, MIN_VALUE_USD)
        rows.append([c, asset_book, cash, line, rating, fv])
    print(f'company-start D15 (D241: sized at the run-rate EBITDA less {100 * validate.LOAD_LINE_SIZING_MARGIN:.0f}%): '
          f'{log["kept"]} starting lines within their 5.12 limit, {log["fixed"] + log["cycle"]} sized to it '
          f'({log["fixed"]} at a fixed point, {log["cycle"]} alternating between two lines and sized to the lower, '
          f'${log["below_largest"] / 1e9:.1f}B below the largest lines within their limits); '
          f'D16: {log["d16"]} CCC or CC lines set to 0')
    out = []
    for c, ab, cash, line, rating, fv in rows:
        p = PRICE_BASE * (fv / PRICE_REF_USD) ** PRICE_EXP * price_jitter(c['id'])
        p = min(PRICE_MAX, max(PRICE_MIN, round(p)))
        out.append({'id': c['id'], 'ticker': c['ticker'], 'public': c['public'],
                    'gross_assets_usd': round(2 * ab), 'asset_book_usd': round(ab), 'cash_usd': round(cash),
                    'credit_drawn_usd': round(line), 'start_rating': rating,
                    'book_equity_usd': round(cash + ab - line),
                    'engine_value_usd': round(fv), 'open_price': p, 'shares': max(1, round(fv / p))})
    return out
