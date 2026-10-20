#!/usr/bin/env python3
"""Build the MVP design data tables (Logan, batch 147; industries on shared defaults, batch 148; zones, batch 150; Japan and Russia zones, batch 154; zone economy, batch 155).

    python3 gen.py [design dir]

Writes into <design>/data/:
  industries.csv        42 rows  (mvp-spec 2.2; 10-industry-economy 10.3, 10.3.1, 10.0.11.10; 3-markets 3.3.2)
  country-economy.csv   211 rows (mvp-spec 2.2; 2-map 2.2.3, 2.2.5, 2.18.2; 3-markets 3.6.2, 3.6.5; 4-politics E2)
  financial-zones.csv    26 rows (mvp-spec 2.2, 5.1, 5.1.2; 2-map 2.18.2; 3-markets 3.2.1; Logan, batches 150, 152, 154 and 155)
  ai-boom.csv            15 rows (mvp-spec 2.2, 5.1.1; 7-starting-world 7.7; Logan, batch 151)
  key-cities.csv        88 rows  (2-map 2.3.3, 2.3.4, 2.3.5, parsed from the markdown; 8 zone hubs, batch 152)
  company-start.csv    651 rows  (mvp-spec 7.1, G6; starting balance sheet, share count and opening price, Logan, batch 161)

Plain Python 3, no packages, no randomness (the price jitter is a hash of the company id): the same inputs always give the same files.
Then runs validate.py, which checks ids and prints the margin and named-share checks.
"""
import csv, os, re, sys, math

DESIGN = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/design'
DATA = os.path.join(DESIGN, 'data')
DETAILED = os.path.join(DESIGN, 'detailed')

# ---------------------------------------------------------------------------
# 1. industries.csv
# ---------------------------------------------------------------------------
# name, sector, world size $bn, trend, beta, rate sensitivity label, margin at full use, f, capital per $1
# All copied from 10-industry-economy 10.3. Notes say where a 10.3 cell was not a single number.
IND = [
    ('Semiconductors', 'Tech', 330, 0.05, 1.6, 'Medium', 0.27, 0.45, 1.3, 'Trend +5% before the AI boom; boom uplift 0.1 of the AI labs boom (ai-boom.csv, batch 151, A)'),
    ('AI labs', 'Tech', 5, 0.05, 2.0, 'High', 0.00, 0.70, 0.3, 'Trend 0.05 before the 2030 boom, then the ai-boom.csv schedule (Logan, batch 151; T); margin "-40% to +40%" stored as 0.00 (T) (mvp-spec G4)'),
    ('Cloud', 'Tech', 300, 0.20, 1.0, 'Medium', 0.25, 0.50, 0.6, ''),
    ('Data centers', 'Tech', 100, 0.15, 0.8, 'High', 0.20, 0.65, 3.0, ''),
    ('Software', 'Tech', 350, 0.09, 0.8, 'Medium', 0.25, 0.55, 0.2, ''),
    ('SaaS', 'Tech', 250, 0.14, 0.8, 'High', 0.22, 0.65, 0.2, ''),
    ('Social media', 'Tech', 250, 0.10, 1.3, 'Medium', 0.30, 0.55, 0.4, ''),
    ('Ads', 'Tech', 450, 0.08, 1.6, 'Medium', 0.30, 0.45, 0.3, ''),
    ('Consumer electronics', 'Tech', 1100, 0.03, 1.3, 'Low', 0.08, 0.25, 0.4, ''),
    ('Telecom', 'Tech', 1600, 0.015, 0.4, 'Medium', 0.18, 0.65, 2.0, ''),
    ('Gaming', 'Tech', 200, 0.08, 0.6, 'Low', 0.22, 0.45, 0.4, ''),
    ('Gambling', 'Tech', 400, 0.08, 0.6, 'Low', 0.22, 0.35, 0.5, ''),
    ('Banking', 'Finance', 2500, 0.04, 1.4, 'Positive', 0.30, 0.55, 1.25, 'Capital 1.25 is regulatory capital (batch 145); rate sensitivity "Positive" stored as 0 (A)'),
    ('Insurance', 'Finance', 6000, 0.04, 0.6, 'Positive', 0.08, 0.30, 0.60, 'Capital 0.60 is regulatory capital (batch 145); rate sensitivity "Positive" stored as 0 (A)'),
    ('Asset management', 'Finance', 500, 0.06, 1.5, 'Medium', 0.30, 0.50, 0.1, ''),
    ('Oil', 'Energy', 2500, 0.00, 0.8, 'Low', 0.25, 0.60, 2.5, 'Margin 25% at oil index 100; stagnant (Logan, batch 86); oil index fixed at 100 in the MVP (A)'),
    ('Gas', 'Energy', 1000, 0.02, 0.8, 'Low', 0.22, 0.60, 2.5, 'Margin 22% at gas index 100, fixed in the MVP (A)'),
    ('Power utilities', 'Energy', 2500, 0.025, 0.3, 'High', 0.15, 0.70, 3.0, ''),
    ('Renewables', 'Energy', 350, 0.12, 0.6, 'Very high', 0.20, 0.80, 4.0, ''),
    ('Mining', 'Industry', 800, 0.02, 1.6, 'Low', 0.18, 0.60, 2.2, ''),
    ('Metals', 'Industry', 1200, 0.02, 1.6, 'Low', 0.12, 0.50, 1.8, ''),
    ('Chemicals', 'Industry', 4000, 0.03, 1.2, 'Low', 0.10, 0.40, 1.2, ''),
    ('Agriculture', 'Industry', 4000, 0.015, 0.3, 'Low', 0.10, 0.45, 1.5, ''),
    ('Autos', 'Industry', 2600, 0.00, 1.8, 'High', 0.06, 0.35, 0.8, ''),
    ('EVs', 'Industry', 400, 0.25, 1.8, 'High', 0.04, 0.40, 1.0, ''),
    ('Aerospace', 'Industry', 450, 0.04, 1.2, 'Low', 0.10, 0.40, 0.8, ''),
    ('Defense', 'Industry', 350, 0.04, 0.3, 'Low', 0.12, 0.40, 0.8, 'Trend +4% is war-driven in 10.3; flat 0.04 in the MVP (A)'),
    ('Robotics', 'Industry', 45, 0.12, 1.5, 'Medium', 0.10, 0.35, 0.7, ''),
    ('Drones', 'Industry', 15, 0.25, 1.3, 'Medium', 0.12, 0.35, 0.6, ''),
    ('Shipping', 'Industry', 500, 0.03, 1.5, 'Low', 0.08, 0.60, 2.0, ''),
    ('Logistics', 'Industry', 900, 0.03, 1.2, 'Low', 0.07, 0.40, 1.0, ''),
    ('Airlines', 'Industry', 500, 0.05, 1.8, 'Low', 0.05, 0.60, 1.5, ''),
    ('Construction', 'Industry', 13000, 0.03, 1.6, 'Very high', 0.05, 0.20, 0.3, ''),
    ('Retail', 'Consumer', 20000, 0.03, 1.0, 'Medium', 0.04, 0.30, 0.4, ''),
    ('E-commerce', 'Consumer', 5000, 0.10, 1.0, 'Medium', 0.05, 0.35, 0.4, ''),
    ('Fast food', 'Consumer', 1000, 0.02, 0.3, 'Low', 0.10, 0.35, 0.6, ''),
    ('Luxury', 'Consumer', 350, 0.05, 2.0, 'Low', 0.25, 0.35, 0.5, ''),
    ('Pharma', 'Health', 1400, 0.05, 0.2, 'Low', 0.22, 0.55, 0.6, ''),
    ('Healthcare services', 'Health', 8000, 0.05, 0.2, 'Low', 0.08, 0.50, 0.7, ''),
    ('Real estate', 'Services', 3000, 0.03, 1.4, 'Very high', 0.20, 0.60, 2.0, ''),
    ('Professional services', 'Services', 6000, 0.04, 0.8, 'Low', 0.15, 0.30, 0.1, ''),
    ('Black market', 'Services', 2000, 0.03, 0.2, 'Low', 0.40, 0.30, 0.3, ''),
]
RATE_SENS = {'Low': 0, 'Medium': 1, 'High': 2, 'Very high': 3, 'Positive': 0}

def by_list(table):
    out = {}
    for val, names in table:
        for n in names:
            out[n] = val
    return out

# mvp-spec 2.2 R&D norm table (T)
RD_NORM = by_list([
    (0.15, ['AI labs', 'Pharma', 'Semiconductors', 'Software']),
    (0.12, ['SaaS']),
    (0.10, ['Cloud', 'Social media', 'Gaming', 'Consumer electronics', 'Robotics', 'Drones', 'EVs', 'Aerospace', 'Defense']),
    (0.06, ['Ads', 'Data centers', 'Telecom', 'Autos', 'Chemicals', 'Gambling', 'E-commerce']),
    (0.03, ['Banking', 'Insurance', 'Asset management', 'Healthcare services', 'Professional services', 'Power utilities',
            'Renewables', 'Metals', 'Mining', 'Agriculture', 'Shipping', 'Logistics', 'Airlines', 'Luxury', 'Real estate']),
    (0.02, ['Oil', 'Gas', 'Construction', 'Retail', 'Fast food', 'Black market']),
])
# mvp-spec 2.2 and 10.3 asset decay (Logan, batch 145; T); parked: the MVP uses 1% above $10M for all (batch 149)
DECAY = by_list([
    (0.10, ['AI labs', 'Cloud', 'Data centers', 'Software', 'SaaS', 'Social media', 'Ads', 'Consumer electronics', 'Gaming',
            'Gambling', 'Semiconductors', 'E-commerce', 'Drones', 'Robotics']),
    (0.08, ['Telecom', 'Banking', 'Insurance', 'Asset management', 'Chemicals', 'Autos', 'EVs', 'Aerospace', 'Defense',
            'Shipping', 'Logistics', 'Airlines', 'Construction', 'Retail', 'Fast food', 'Luxury', 'Pharma',
            'Healthcare services', 'Professional services', 'Black market']),
    (0.06, ['Oil', 'Gas', 'Mining', 'Metals', 'Agriculture']),
    (0.05, ['Power utilities', 'Renewables', 'Real estate']),
])
# 10.0.11.10 industry modifiers (Logan, batch 141; T): labor_value, pc_modifier, TB per $1M, data decay base
MODS = {}
for names, mod in [
    (['Software', 'SaaS', 'Professional services'], (20000, 1.0, 1, 0.02)),
    (['Retail', 'Fast food'], (25000, 0.5, 1, 0.02)),
    (['Social media', 'Ads', 'E-commerce'], (50000, 1.0, 3, 0.03)),
    (['Banking', 'Insurance', 'Asset management'], (50000, 1.0, 2, 0.01)),
    (['Pharma', 'Healthcare services'], (100000, 1.0, 1, 0.01)),
    (['Semiconductors', 'Telecom', 'Data centers', 'Mining', 'Metals'], (250000, 1.0, 1, 0.02)),
    (['Oil', 'Gas', 'Power utilities', 'Renewables'], (500000, 1.0, 1, 0.02)),
]:
    for n in names:
        MODS[n] = mod
BASE_MOD = (100000, 1.0, 1, 0.02)
# 10.3.1 fit and resource tags
FIT = by_list([
    ('Commerce', ['AI labs', 'Cloud', 'Software', 'SaaS', 'Social media', 'Ads', 'Gaming', 'Gambling', 'Banking', 'Insurance',
                  'Asset management', 'Retail', 'E-commerce', 'Fast food', 'Luxury', 'Healthcare services', 'Real estate',
                  'Professional services', 'Black market']),
    ('Industry', ['Semiconductors', 'Data centers', 'Consumer electronics', 'Telecom', 'Power utilities', 'Renewables', 'Metals',
                  'Chemicals', 'Autos', 'EVs', 'Aerospace', 'Defense', 'Robotics', 'Drones', 'Shipping', 'Logistics',
                  'Airlines', 'Construction', 'Pharma']),
    ('Extraction', ['Oil', 'Gas', 'Mining', 'Agriculture']),
])
TAGS = {
    'Oil': ['Oil'], 'Gas': ['Gas'],
    'Mining': ['Coal', 'Copper', 'Lithium', 'Cobalt', 'Nickel', 'Rare earths', 'Gold', 'Uranium', 'Silver', 'Zinc', 'Tin',
               'Platinum', 'Diamonds', 'Bauxite', 'Iron ore'],
    'Power utilities': ['Coal', 'Hydropower'], 'Metals': ['Bauxite', 'Iron ore'],
    'Agriculture': ['Farmland', 'Timber', 'Fishing'], 'Renewables': ['Hydropower'],
}
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
# Logan, batch 146
CASH_BURNING = {'Consumer electronics', 'EVs', 'E-commerce', 'AI labs'}
# 10.0.7 flavor labels: the doc names fabs, stores, oil fields and fleets; the rest are new (A)
LABEL = {
    'Semiconductors': 'fabs', 'AI labs': 'compute clusters', 'Cloud': 'cloud regions', 'Data centers': 'data halls',
    'Software': 'code bases', 'SaaS': 'platforms', 'Social media': 'networks', 'Ads': 'ad networks',
    'Consumer electronics': 'product lines', 'Telecom': 'networks', 'Gaming': 'studios', 'Gambling': 'casinos',
    'Banking': 'loan books', 'Insurance': 'underwriting books', 'Asset management': 'funds', 'Oil': 'oil fields',
    'Gas': 'gas fields', 'Power utilities': 'power plants', 'Renewables': 'wind and solar farms', 'Mining': 'mines',
    'Metals': 'smelters and mills', 'Chemicals': 'plants', 'Agriculture': 'farms', 'Autos': 'car plants',
    'EVs': 'EV plants', 'Aerospace': 'assembly lines', 'Defense': 'arms plants', 'Robotics': 'robot lines',
    'Drones': 'drone lines', 'Shipping': 'fleets', 'Logistics': 'depots and trucks', 'Airlines': 'fleets',
    'Construction': 'crews and equipment', 'Retail': 'stores', 'E-commerce': 'fulfillment centers',
    'Fast food': 'restaurants', 'Luxury': 'boutiques', 'Pharma': 'labs and pipelines', 'Healthcare services': 'clinics',
    'Real estate': 'portfolios', 'Professional services': 'offices', 'Black market': 'fronts',
}

def slug(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')

def fmt(x, nd=4):
    s = f'{x:.{nd}f}'.rstrip('0').rstrip('.')
    return s if s not in ('', '-0') else '0'

# Logan, batch 148: "just make these like default companies for now we will rework them one by one once
# companies are known working. I want all industries to be like the defaults."
# Every industry uses the barebones company's parameters (10-industry-economy 10.0.11.1, 10.0.11.10 base case):
# $1 of assets per $1 of revenue, labor_value $100,000, 1 TB per $1M, and revenue equal to
# expenses at productivity 100 and M 1.0 with R&D at the norm counted in the expenses (margin before R&D =
# rd_norm). Industries keep only name, sector (a label), world size, trend and asset label. The per-industry
# tables above are parked for the per-industry rework (mvp-spec 11.2); set PER_INDUSTRY = True to use them again.
# Logan, batch 149: "Asset decay 1% a year, only kicks in after 10 million assets." Decay is 1% a year for every
# industry, on the part of a unit's gross assets above $10M only (marginal, A): $50M decays $400k a year, and a
# unit with $10M or less (the $100,000 barebones company) has none. The threshold is a column so the rework can
# change it per industry.
# Logan, batch 150: "Industries have growth rates that are long term and stable, their quarterly growth rate will go
# up and down based on the industries volatility, the overall business cycle, but still average toward the long
# term rate." trend_growth is the long-term rate; volatility is the sd of the quarterly growth shock (mvp-spec 5.1),
# one value for all industries in the MVP (T).
VOLATILITY = 0.01
# Logan, batch 151: "AI boom I think we are moving to 2030 start now bubble in 2040. I think we need to do really small
# AI with low growth then an unprecedented growth rate." AI labs' long-term rate is a regime switch (mvp-spec 5.1.1):
# 5% before the boom, the AI_BOOM schedule from the scripted 2030 boom, a bust after the pop (2040 +/- 2 on average).
# Another industry's long-term rate is trend_growth + boom_uplift x (AI labs rate - AI_PREBOOM_LT) (A); at the pop its
# demand drops by crash_drop once (T).
AI_PREBOOM_LT = 0.05
BOOM_UPLIFT = {'AI labs': 1.0, 'Data centers': 0.15, 'Semiconductors': 0.1, 'Cloud': 0.05}     # A, T
CRASH_DROP = {'AI labs': 0.5, 'Data centers': 0.25, 'Semiconductors': 0.2, 'Cloud': 0.1}       # T
# stage, boom year (years since the boom event), default calendar year, AI labs long-term rate a year (T), notes
AI_BOOM = [
    ('preboom', '', '2020-2029', AI_PREBOOM_LT, 'Really small AI with low growth (Logan, batch 151); world size about $5B to $8B'),
    ('boom', 0, '2030', 1.00, 'The tipped lab launches its chatbot: the boom event, 1 Jan 2030 00:00 (7.7)'),
    ('boom', 1, '2031', 1.00, 'Unprecedented growth (Logan, batch 151)'),
    ('boom', 2, '2032', 0.90, ''),
    ('boom', 3, '2033', 0.80, ''),
    ('boom', 4, '2034', 0.60, 'Tapering as the bubble nears'),
    ('boom', 5, '2035', 0.45, ''),
    ('boom', 6, '2036', 0.35, ''),
    ('boom', 7, '2037', 0.25, ''),
    ('boom', 8, '2038', 0.20, 'Earliest pop year (2040 - 2)'),
    ('boom', 9, '2039', 0.15, ''),
    ('boom', 10, '2040+', 0.12, 'Only if the pop is rolled after 1 Jan 2040; holds until the pop'),
    ('pop', '', '2040 on average', '', 'The bubble pops: demand x (1 - crash_drop) once; the year is 2040 + a roll of -2 to +2, the quarter rolled (A)'),
    ('bust', '', '8 quarters from the pop', -0.10, 'Two years of shrinking AI demand (T)'),
    ('postcrash', '', 'after the bust', 0.08, 'The post-crash era (T)'),
]
DECAY_THRESHOLD_USD = 10_000_000
PER_INDUSTRY = False
DEFAULT = {
    'capital_per_dollar': 1.0,   # barebones: one $100,000 asset makes $100,000 a year
    'asset_decay': 0.01,         # 1% a year above the threshold (Logan, batch 149)
    'asset_decay_threshold_usd': DECAY_THRESHOLD_USD,  # no decay on the first $10M of a unit (batch 149)
    'rd_norm': 0.05,             # one R&D norm (T)
    'fixed_cost_share': 0.45,    # median f of 10.3 (T); shared costs and depreciation sit inside it (5.5)
    'cycle_beta': 1.0,           # moves with the economy (A)
    'volatility': VOLATILITY,    # sd of the quarterly growth shock, same for all (batch 150, T)
    'rate_sensitivity': 1,       # Medium; rates are fixed at neutral in the MVP, so no effect (A)
    'earnings_multiple': 17,     # median M_sector of the 42 industries in 3.3.2 (T)
    'labor_value_usd': 100000, 'pc_modifier': 1.0, 'data_tb_per_musd': 1, 'data_decay_base': 0.02,
}
DEFAULT['margin_full_use'] = DEFAULT['rd_norm']  # break-even after R&D at the norm, as the barebones company
TREND_NOTE = {
    'Semiconductors': 'Trend +5% before the AI boom; boom uplift 0.1 of the AI labs boom (ai-boom.csv, batch 151, A)',
    'Data centers': 'Boom uplift 0.15 of the AI labs boom (ai-boom.csv, batch 151, A)',
    'Cloud': 'Boom uplift 0.05 of the AI labs boom (ai-boom.csv, batch 151, A)',
    'AI labs': 'Trend 0.05 before the 2030 boom, then the ai-boom.csv schedule (Logan, batch 151; T)',
    'Oil': 'Trend 0%: stagnant (Logan, batch 86)',
    'Defense': 'Trend +4% is war-driven in 10.3; flat 0.04 in the MVP (A)',
}

def build_industries():
    if not PER_INDUSTRY:
        return build_default_industries()
    return build_tuned_industries()

def build_default_industries():
    d = DEFAULT
    rows = []
    for name, sector, size, trend, *_ in IND:
        notes = ['MVP defaults (Logan, batch 148)']
        if name in TREND_NOTE:
            notes.append(TREND_NOTE[name])
        rows.append({
            'id': slug(name), 'name': name, 'sector': sector, 'valuation_group': 'Default',
            'world_size_2020_usd_bn': fmt(size), 'trend_growth': fmt(trend), 'cycle_beta': fmt(d['cycle_beta']),
            'volatility': fmt(d['volatility']),
            'boom_uplift': fmt(BOOM_UPLIFT.get(name, 0)), 'crash_drop': fmt(CRASH_DROP.get(name, 0)),
            'rate_sensitivity': d['rate_sensitivity'], 'margin_full_use': fmt(d['margin_full_use']),
            'fixed_cost_share': fmt(d['fixed_cost_share']),
            'variable_cost_share': fmt(1 - d['margin_full_use'] - d['fixed_cost_share']),
            'capital_per_dollar': fmt(d['capital_per_dollar']), 'asset_turnover': fmt(1 / d['capital_per_dollar']),
            'asset_decay': fmt(d['asset_decay']), 'asset_decay_threshold_usd': d['asset_decay_threshold_usd'],
            'rd_norm': fmt(d['rd_norm']),
            'labor_value_usd': d['labor_value_usd'], 'pc_modifier': fmt(d['pc_modifier']),
            'data_tb_per_musd': d['data_tb_per_musd'], 'data_decay_base': fmt(d['data_decay_base']),
            'fit': '', 'resource_tags': '', 'asset_label': LABEL[name], 'cash_burning': 'N',
            'earnings_multiple': d['earnings_multiple'], 'notes': '; '.join(notes),
        })
    return rows

def build_tuned_industries():
    """The batch 147 per-industry table, parked for the per-industry rework (batch 148)."""
    rows = []
    for name, sector, size, trend, beta, rs, m, f, cap, note in IND:
        lv, pcm, tb, dd = MODS.get(name, BASE_MOD)
        vg = VGROUP[name]
        notes = [note] if note else []
        if name == 'Black market':
            notes.append('No row in the 3.3.2 sector table; valued with Professional services (A)')
        if name in CASH_BURNING:
            notes.append('Cash-burning on purpose (Logan, batch 146; mvp-spec 6.6)')
        rows.append({
            'id': slug(name), 'name': name, 'sector': sector, 'valuation_group': vg,
            'world_size_2020_usd_bn': fmt(size), 'trend_growth': fmt(trend), 'cycle_beta': fmt(beta),
            'volatility': fmt(VOLATILITY),
            'boom_uplift': fmt(BOOM_UPLIFT.get(name, 0)), 'crash_drop': fmt(CRASH_DROP.get(name, 0)),
            'rate_sensitivity': RATE_SENS[rs], 'margin_full_use': fmt(m), 'fixed_cost_share': fmt(f),
            'variable_cost_share': fmt(1 - m - f), 'capital_per_dollar': fmt(cap), 'asset_turnover': fmt(1 / cap),
            'asset_decay': fmt(DECAY[name]), 'asset_decay_threshold_usd': DECAY_THRESHOLD_USD,
            'rd_norm': fmt(RD_NORM[name]), 'labor_value_usd': lv,
            'pc_modifier': fmt(pcm), 'data_tb_per_musd': tb, 'data_decay_base': fmt(dd), 'fit': FIT[name],
            'resource_tags': ';'.join(TAGS.get(name, [])), 'asset_label': LABEL[name],
            'cash_burning': 'Y' if name in CASH_BURNING else 'N', 'earnings_multiple': PE[vg],
            'notes': '; '.join(notes),
        })
    return rows

# ---------------------------------------------------------------------------
# 2. country-economy.csv
# ---------------------------------------------------------------------------
# Real 2020 statutory corporate income tax, combined national plus typical sub-national where it applies
# (Tax Foundation and KPMG 2020 tables, from memory; T). None = no reliable figure: Moderate band used (A).
TAX = {
    'USA': .258, 'CAN': .265, 'MEX': .30, 'GRL': .265, 'SPM': None,
    'BRA': .34, 'ARG': .30, 'CHL': .27, 'COL': .32, 'PER': .295, 'ECU': .25, 'BOL': .25, 'VEN': .34, 'URY': .25,
    'PRY': .10, 'GUY': .25, 'SUR': .36, 'PAN': .25, 'CRI': .30, 'GTM': .25, 'HND': .25, 'SLV': .30, 'NIC': .30,
    'BLZ': None, 'CUB': .35, 'DOM': .27, 'HTI': .30, 'JAM': .25, 'TTO': .30, 'BHS': 0.0, 'BRB': .055, 'ATG': .25,
    'DMA': .25, 'GRD': .28, 'KNA': .33, 'LCA': .30, 'VCT': .30, 'PRI': .375,
    'GBR': .19, 'DEU': .299, 'FRA': .32, 'NLD': .25, 'ITA': .278, 'CHE': .211, 'ESP': .25, 'PRT': .315, 'IRL': .125,
    'BEL': .25, 'AUT': .25, 'GRC': .24, 'FIN': .20, 'EST': .20, 'LVA': .20, 'LTU': .15, 'SVK': .21, 'SVN': .19,
    'CYP': .125, 'MLT': .35, 'MNE': .09, 'XKX': .10, 'AND': .10, 'MCO': .31, 'SMR': .17, 'VAT': 0.0, 'LIE': .125,
    'SWE': .214, 'NOR': .22, 'DNK': .22, 'ISL': .20, 'POL': .19, 'CZE': .19, 'HUN': .09, 'ROU': .16, 'BGR': .10,
    'HRV': .18, 'SRB': .15, 'BIH': .10, 'MKD': .10, 'ALB': .15, 'UKR': .18, 'BLR': .18, 'MDA': .12, 'FRO': .18,
    'RUS': .20, 'KAZ': .20, 'UZB': .15, 'TKM': .08, 'KGZ': .10, 'TJK': .23, 'GEO': .15, 'ARM': .18, 'AZE': .20,
    'TUR': .22,
    'SAU': .20, 'ARE': 0.0, 'ISR': .23, 'EGY': .225, 'QAT': .10, 'IRN': .25, 'IRQ': .15, 'KWT': .15, 'BHR': 0.0,
    'OMN': .15, 'YEM': .20, 'JOR': .20, 'LBN': .17, 'SYR': .28, 'PSE': .15, 'LBY': .20, 'DZA': .26, 'MAR': .31,
    'TUN': .25,
    'NGA': .30, 'ZAF': .28, 'COD': .30, 'GHA': .25, 'CIV': .25, 'SEN': .30, 'MLI': .30, 'BFA': .275, 'NER': .30,
    'GIN': .35, 'GNB': .25, 'SLE': .25, 'LBR': .25, 'TGO': .27, 'BEN': .30, 'GMB': .27, 'CPV': .224, 'MRT': .25,
    'TCD': .35, 'CMR': .33, 'CAF': .30, 'COG': .30, 'GAB': .30, 'GNQ': .35, 'STP': .25, 'KEN': .30, 'ETH': .30,
    'TZA': .30, 'UGA': .30, 'SOM': None, 'SDN': None, 'SSD': None, 'ERI': .30, 'DJI': .25, 'RWA': .30, 'BDI': .30,
    'MDG': .20, 'MUS': .15, 'SYC': .30, 'COM': .50, 'ZMB': .35, 'AGO': .25, 'ZWE': .247, 'MOZ': .32, 'NAM': .32,
    'BWA': .22, 'MWI': .30, 'LSO': .25, 'SWZ': .275,
    'IND': .252, 'PAK': .29, 'BGD': .325, 'LKA': .24, 'NPL': .25, 'BTN': .30, 'MDV': .15, 'AFG': .20,
    'CHN': .25, 'JPN': .297, 'KOR': .275, 'TWN': .20, 'SGP': .17, 'MYS': .24, 'IDN': .22, 'VNM': .20, 'AUS': .30,
    'HKG': .165, 'MAC': .12, 'PRK': .25, 'MNG': .25, 'THA': .20, 'PHL': .30, 'MMR': .25, 'KHM': .20, 'LAO': .20, 'BRN': .185,
    'TLS': .10, 'NZL': .28, 'PNG': .30, 'FJI': .20, 'SLB': .30, 'VUT': 0.0, 'WSM': .27, 'TON': .25, 'KIR': None,
    'FSM': None, 'MHL': None, 'PLW': None, 'NRU': .20, 'TUV': .30, 'PAP': None,
    # havens: headline rates for the notes only
    'CYM': 0.0, 'VGB': 0.0, 'BMU': 0.0, 'JEY': 0.0, 'GGY': 0.0, 'IMN': 0.0, 'GIB': .125, 'LUX': .2494,
}
# 2.2.5 havens: level Haven at the E2 Haven rate (3%), whatever the headline rate
HAVENS = {'CYM', 'VGB', 'BMU', 'JEY', 'GGY', 'GIB', 'IMN', 'LUX'}
BANDS = [('Haven', .03), ('Low', .12), ('Moderate', .21), ('High', .30)]
BAND_RATE = dict(BANDS)
# 2.2.3 corporate tax (E2 starting position) for the 33 majors
MAJOR_LEVEL = {
    'USA': 'Moderate', 'CAN': 'Moderate', 'MEX': 'High', 'BRA': 'High', 'ARG': 'High', 'CHL': 'High', 'GBR': 'Moderate',
    'DEU': 'High', 'FRA': 'Moderate', 'NLD': 'Moderate', 'ITA': 'Moderate', 'CHE': 'Low', 'RUS': 'Moderate',
    'TUR': 'Moderate', 'SAU': 'Moderate', 'ARE': 'Low', 'ISR': 'Moderate', 'EGY': 'Moderate', 'NGA': 'High',
    'ZAF': 'High', 'IND': 'Moderate', 'CHN': 'Moderate', 'JPN': 'High', 'KOR': 'Moderate', 'TWN': 'Moderate',
    'SGP': 'Low', 'MYS': 'Moderate', 'IDN': 'Moderate', 'VNM': 'Moderate', 'AUS': 'High', 'QAT': 'Low',
    'COL': 'High', 'COD': 'High',
}

# Sovereign rating at January 2020: real agency ratings (S&P-style, Moody's or Fitch where S&P had none),
# moved for the alternate history (19.22, 7.2.0): the euro crisis, Greece's 2019 default, Russia's sanctions,
# a stronger US Middle East. Only the 3.6.2 scale is used (CCC, CC and C have no notches). (A)
RATING = {
    'USA': 'AAA', 'CAN': 'AAA', 'MEX': 'BBB+', 'BMU': 'A+', 'GRL': 'AA', 'SPM': 'AA-',
    'BRA': 'BB-', 'ARG': 'CCC', 'CHL': 'A+', 'COL': 'BBB-', 'PER': 'BBB+', 'ECU': 'B-', 'BOL': 'B+', 'VEN': 'CCC',
    'URY': 'BBB', 'PRY': 'BB', 'SUR': 'B-', 'PAN': 'BBB', 'CRI': 'B+', 'GTM': 'BB-', 'HND': 'BB-', 'SLV': 'B-',
    'NIC': 'B-', 'BLZ': 'B-', 'CUB': 'CCC', 'DOM': 'BB-', 'JAM': 'B+', 'TTO': 'BBB-', 'BHS': 'BB+', 'BRB': 'B-',
    'PRI': 'BB', 'CYM': 'AA-', 'VGB': 'A',
    'GBR': 'AA', 'DEU': 'AAA', 'FRA': 'AA-', 'NLD': 'AAA', 'ITA': 'BB+', 'CHE': 'AAA', 'ESP': 'BBB', 'PRT': 'BB+',
    'IRL': 'A', 'BEL': 'AA-', 'AUT': 'AA+', 'GRC': 'CCC', 'LUX': 'AAA', 'FIN': 'AA+', 'EST': 'AA-', 'LVA': 'A',
    'LTU': 'A', 'SVK': 'A+', 'SVN': 'A+', 'CYP': 'BB', 'MLT': 'A-', 'MNE': 'B+', 'AND': 'BBB', 'MCO': 'AA',
    'SMR': 'BBB-', 'VAT': 'A', 'LIE': 'AAA', 'SWE': 'AAA', 'NOR': 'AAA', 'DNK': 'AAA', 'ISL': 'A', 'POL': 'A-',
    'CZE': 'AA-', 'HUN': 'BBB', 'ROU': 'BBB-', 'BGR': 'BBB', 'HRV': 'BBB-', 'SRB': 'BB+', 'BIH': 'B', 'MKD': 'BB-',
    'ALB': 'B+', 'UKR': 'B-', 'BLR': 'B', 'MDA': 'B-', 'GGY': 'AA-', 'JEY': 'AA-', 'GIB': 'A', 'IMN': 'AA-',
    'FRO': 'AA',
    'RUS': 'BB+', 'KAZ': 'BBB-', 'UZB': 'BB-', 'KGZ': 'B', 'TJK': 'B-', 'GEO': 'BB', 'ARM': 'BB-', 'AZE': 'BB+',
    'TUR': 'B+',
    'SAU': 'A', 'ARE': 'AA', 'ISR': 'AA-', 'EGY': 'B', 'QAT': 'AA-', 'IRN': 'B-', 'IRQ': 'B', 'KWT': 'AA',
    'BHR': 'B+', 'OMN': 'BB-', 'JOR': 'B+', 'LBN': 'CCC', 'SYR': 'B', 'LBY': 'B+', 'MAR': 'BBB-', 'TUN': 'B+',
    'NGA': 'B', 'ZAF': 'BB', 'COD': 'CCC', 'GHA': 'B', 'CIV': 'BB-', 'SEN': 'B+', 'MLI': 'B-', 'BFA': 'B',
    'NER': 'B-', 'TGO': 'B-', 'BEN': 'B+', 'CPV': 'B', 'CMR': 'B', 'COG': 'CCC', 'GAB': 'B-', 'GNQ': 'CCC',
    'KEN': 'B+', 'ETH': 'B', 'TZA': 'B+', 'UGA': 'B', 'RWA': 'B+', 'MUS': 'BBB+', 'SYC': 'BB', 'ZMB': 'CCC',
    'AGO': 'B-', 'MOZ': 'CCC', 'NAM': 'BB', 'BWA': 'BBB+', 'SWZ': 'B',
    'IND': 'BBB-', 'PAK': 'B-', 'BGD': 'BB-', 'LKA': 'B-', 'MDV': 'B',
    'CHN': 'A+', 'JPN': 'A+', 'KOR': 'AA', 'TWN': 'AA-', 'SGP': 'AAA', 'MYS': 'A-', 'IDN': 'BBB', 'VNM': 'BB',
    'AUS': 'AAA', 'HKG': 'AA+', 'MAC': 'AA+', 'PRK': 'CC', 'MNG': 'B', 'THA': 'BBB+', 'PHL': 'BBB+', 'KHM': 'B', 'LAO': 'B-',
    'BRN': 'A', 'NZL': 'AA', 'PNG': 'B', 'FJI': 'BB-', 'PAP': 'B-',
}
RATING_NOTE = {
    'USA': 'AAA: stronger US in the alternate history (3.6.5 example)',
    'FRA': 'one notch under real for the euro crisis', 'BEL': 'one notch under real for the euro crisis',
    'ITA': 'two notches under real for the euro crisis', 'ESP': 'two notches under real for the euro crisis',
    'PRT': 'two notches under real for the euro crisis', 'IRL': 'two notches under real for the euro crisis',
    'CYP': 'two notches under real for the euro crisis', 'SVN': 'one notch under real for the euro crisis',
    'GRC': 'defaulted in 2019 (19.22): CCC after the default',
    'RUS': 'one notch under real for 15 years of sanctions',
    'SAU': 'one notch over real: stronger US Middle East', 'IRQ': 'stable US ally since 2003 (19.22)',
    'SYR': 'no Syrian war (19.22)', 'LBY': 'no civil war (19.22)', 'VEN': 'sliding slowly, cushioned by high oil (19.22)',
    'ARG': 'post-2019 default, CCC', 'PRI': 'territory; no PROMESA default in this history',
    'PRK': 'sanctioned, old defaults',
    'PAP': 'micronation ruled by decree, unrated: set by hand',
}
EURO_AREA = {'AUT', 'BEL', 'CYP', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD',
             'PRT', 'SVK', 'SVN', 'ESP'}
EURO_USERS = {'MNE', 'XKX', 'AND', 'MCO', 'SMR', 'VAT'}
# Logan, batch 152: "Financial Zones Each have a stock exchange and hub city where the stock exchange takes place.
# This financial city should be a hub and have a zone. ... Countries belong to one financial zone and only one.
# Countries should join nearby financial zones." 24 zones replace the 8 of batch 150. One global cycle (mvp-spec 5.1,
# 2-map 2.18.1) is felt by each zone at its intensity, after its lag (T): zone effect = intensity x g(t - lag).
# Contagion (T): share of a member's default or bank crisis demand hit and spread rise that spreads to the other
# members (mvp-spec 5.1). own_shock_sd (T): yearly sd of a zone-only growth shock, for the isolated economies.
# zone_id, number, name, hub city (key city), hub province, exchange code, exchange, headline index,
# intensity, lag (quarters), contagion, own_shock_sd, extra provinces (provinces of another country's row), note
ZONES = [
    ('NA', 1, 'North America and havens', 'New York', 'US-0086', 'ATX', 'Atlantic Exchange', 'Atlantic 500',
     1.0, 0, 0.3, 0.0, '', 'USA, Canada, Puerto Rico and the dollar havens (Bermuda, Bahamas, Caymans, BVI); '
     'the reference zone; havens follow North America (A)'),
    ('CAR', 2, 'Caribbean', 'Kingston', 'JM-0001', 'ASE', 'Antilles Securities Exchange', 'Antilles 30',
     1.3, 1, 0.3, 0.0, '', 'The Caribbean islands outside Cuba and the dollar havens; tourism lags the US (A)'),
    ('CUB', 3, 'Cuba', 'Havana', 'CU-0001', 'HAB', 'Havana Bourse', 'Malecon 20',
     0.3, 2, 0.0, 0.03, '', 'Cuba alone: isolated by the embargo, low intensity and its own shocks (A)'),
    ('PRK', 4, 'North Korea', 'Pyongyang', 'KP-0001', 'TDX', 'Taedong River Exchange', 'Chollima 15',
     0.3, 2, 0.0, 0.03, '', 'North Korea alone: sealed economy, low intensity and its own shocks (A)'),
    ('EU', 5, 'European Union', 'Frankfurt', 'DE-0019', 'CBX', 'Continental Bourse', 'Continental 50',
     1.2, 1, 0.5, 0.0, '', 'The 27 EU members plus Norway, Iceland, the Balkans, Ukraine, Moldova, the '
     'microstates, the Faroes, Greenland and Saint Pierre and Miquelon; the euro crisis makes it swing harder (A)'),
    ('UK', 6, 'United Kingdom', 'London', 'GB-0001', 'CLX', 'City of London Exchange', 'CLX 100',
     1.1, 0, 0.3, 0.0, '', 'UK with Gibraltar, the Isle of Man, Jersey and Guernsey (A)'),
    ('CN', 7, 'China and puppets', 'Shanghai', 'CN-0008', 'HSE', 'Huangpu Stock Exchange', 'Huangpu Composite',
     0.9, 1, 0.4, 0.0, '', 'China, its debt vassals (Pakistan, Sri Lanka, Djibouti, Zambia) and close clients (Laos, '
     'Cambodia, Mongolia); state-steered credit damps the cycle (A)'),
    ('KR', 8, 'South Korea', 'Seoul-Pyeongtaek', 'KR-0001', 'HRX', 'Han River Exchange', 'HRX 200',
     1.1, 1, 0.3, 0.0, '', 'South Korea alone since batch 154 (Logan), when Japan got its own zone 25 (A)'),
    ('HK', 9, 'Hong Kong', 'Hong Kong', 'HK-0001', 'VHX', 'Victoria Harbour Exchange', 'Harbour Index',
     1.2, 0, 0.4, 0.0, '', 'Hong Kong alone since batch 154 (Logan), when Taiwan went with Japan to zone 25 (A)'),
    ('AU', 10, 'Australia', 'Sydney', 'AU-0001', 'SCX', 'Southern Cross Exchange', 'Southern Cross 200',
     1.0, 1, 0.2, 0.0, '', 'Australia, New Zealand and the Pacific islands (A)'),
    ('MO', 11, 'Macau', 'Macau', 'MO-0001', 'CTX', 'Cotai Exchange', 'Cotai 20',
     1.5, 1, 0.0, 0.0, '', 'Macau alone: its own country row MAC since batch 153 (Logan), while China stays in '
     'zone 7; casino money swings hard (A)'),
    ('SG', 12, 'Singapore', 'Singapore', 'SG-0001', 'LCX', 'Lion City Exchange', 'Lion 30',
     1.2, 1, 0.4, 0.0, '', 'Singapore and Southeast Asia: Indonesia, Malaysia, Thailand, Vietnam, the Philippines, '
     'Brunei, Myanmar and Timor-Leste (A)'),
    ('IN', 13, 'India', 'Mumbai', 'IN-0013', 'GXI', 'Gateway Exchange of India', 'Gateway 50',
     1.2, 1, 0.3, 0.0, '', 'India, Bangladesh and the Maldives; Pakistan and Sri Lanka are Chinese debt vassals '
     'and sit in zone 7 (A)'),
    ('AFS', 14, 'Southern Africa', 'Johannesburg', 'ZA-0001', 'HVX', 'Highveld Exchange', 'Highveld Top 40',
     1.3, 2, 0.4, 0.0, '', 'South Africa, DR Congo, Angola and the SADC south and Indian Ocean (A)'),
    ('AFW', 15, 'West Africa', 'Lagos', 'NG-0001', 'LSX', 'Lagoon Securities Exchange', 'Lagoon 50',
     1.4, 2, 0.4, 0.0, '', 'West and Central Africa from Cabo Verde to the Congo Republic and Chad, including Mali, '
     'a US debt vassal (A)'),
    ('AFE', 16, 'East Africa', 'Nairobi', 'KE-0001', 'RVX', 'Rift Valley Exchange', 'Rift 20',
     1.2, 2, 0.3, 0.0, '', 'Kenya, Ethiopia, the Great Lakes, the Horn outside Djibouti, Sudan, South Sudan, '
     'Seychelles and Comoros (A)'),
    ('AFN', 17, 'North and Northwest Africa', 'Casablanca', 'MA-0001', 'ABX', 'Atlas Bourse', 'Atlas 25',
     1.2, 1, 0.3, 0.0, '', 'Morocco, Algeria, Tunisia, Libya and Mauritania (A)'),
    ('CH', 18, 'Switzerland', 'Zurich', 'CH-0001', 'LMX', 'Limmat Exchange', 'Limmat 20',
     0.8, 0, 0.2, 0.0, '', 'Switzerland and Liechtenstein; the safe haven swings least (A)'),
    ('ME', 19, 'Middle East', 'Dubai', 'AE-0008', 'DCX', 'Creek Exchange', 'Creek 50',
     1.1, 1, 0.3, 0.0, '', 'The Gulf, the Levant, Iraq, Iran, Turkey, Egypt and Yemen (A)'),
    ('UA', 20, 'Upper Asia (Himalayas)', 'Almaty', 'KZ-0002', 'SRX', 'Silk Road Exchange', 'Silk Road 30',
     1.3, 1, 0.4, 0.0, '', 'Central Asia, the Caucasus, Afghanistan, Nepal and Bhutan; Russia has its own zone 26 '
     'since batch 154 (Logan) (A)'),
    ('MX', 21, 'Mexico', 'Mexico City', 'MX-0001', 'RFX', 'Reforma Exchange', 'Reforma 35',
     1.3, 0, 0.3, 0.0, '', 'Mexico and Central America from Guatemala and Belize to Costa Rica (A)'),
    ('BR', 22, 'Brazil', 'São Paulo', 'BR-0001', 'PSX', 'Paulista Exchange', 'Paulista Index',
     1.4, 1, 0.4, 0.0, '', 'Brazil, Paraguay, Bolivia, Guyana and Suriname (A)'),
    ('AR', 23, 'Argentina', 'Buenos Aires', 'AR-0001', 'PLX', 'River Plate Exchange', 'Plata 25',
     1.6, 1, 0.5, 0.0, '', "Argentina, Chile, Uruguay and Papa's Port (the Falklands); Argentina's debt crises "
     'make it swing hardest (A)'),
    ('CO', 24, 'Colombia', 'Bogotá', 'CO-0001', 'ANX', 'Andean Exchange', 'Andes 20',
     1.3, 1, 0.4, 0.0, '', 'Colombia, Venezuela, Ecuador, Peru and Panama (A)'),
    # Logan, batch 154: "Taiwan goes with Japan, Japan gets its own. Russia should have its own zone."
    ('JP', 25, 'Japan', 'Tokyo-Yokohama', 'JP-0001', 'ESE', 'Edo Securities Exchange', 'Edo 225',
     0.9, 1, 0.3, 0.0, '', 'Japan and Taiwan (Logan, batch 154); ESE, until then the HRX Tokyo board, is the zone '
     'exchange; a mature, low-growth economy swings less (T)'),
    ('RU', 26, 'Russia', 'Moscow', 'RU-0001', 'YRX', 'Yauza River Exchange', 'Yauza 50',
     1.1, 1, 0.2, 0.02, '', 'Russia and Belarus, its close client (Logan, batch 154; Belarus A); commodity swings '
     'would give about 1.4, but sanctions since 2005 partly isolate it: intensity 1.1, contagion 0.2 and a small '
     'own shock (T)'),
]
# Every one of the 211 countries in exactly one zone (batch 152 defaults, A; Japan and Russia zones, batch 154). validate.py checks it.
ZONE_MEMBERS = {
    'NA': 'USA CAN BMU BHS CYM VGB PRI',
    'CAR': 'DOM HTI JAM TTO BRB ATG DMA GRD KNA LCA VCT',
    'CUB': 'CUB',
    'PRK': 'PRK',
    'EU': 'AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP '
          'SWE NOR ISL SRB BIH MKD ALB MNE XKX UKR MDA AND MCO SMR VAT FRO GRL SPM',
    'UK': 'GBR GIB IMN JEY GGY',
    'CN': 'CHN PAK LKA DJI ZMB LAO KHM MNG',
    'KR': 'KOR',
    'HK': 'HKG',
    'AU': 'AUS NZL PNG FJI SLB VUT WSM TON KIR FSM MHL PLW NRU TUV',
    'MO': 'MAC',
    'SG': 'SGP IDN MYS THA VNM PHL BRN MMR TLS',
    'IN': 'IND BGD MDV',
    'AFS': 'ZAF COD AGO ZWE MOZ NAM BWA MWI LSO SWZ MDG MUS',
    'AFW': 'NGA GHA CIV SEN MLI BFA NER GIN GNB SLE LBR TGO BEN GMB CPV TCD CMR CAF COG GAB GNQ STP',
    'AFE': 'KEN ETH TZA UGA SOM SDN SSD ERI RWA BDI SYC COM',
    'AFN': 'MAR DZA TUN LBY MRT',
    'CH': 'CHE LIE',
    'ME': 'SAU ARE ISR EGY QAT IRN IRQ KWT BHR OMN YEM JOR LBN SYR PSE TUR',
    'UA': 'KAZ UZB TKM KGZ TJK GEO ARM AZE AFG NPL BTN',
    'MX': 'MEX GTM BLZ HND SLV NIC CRI',
    'BR': 'BRA PRY BOL GUY SUR',
    'AR': 'ARG CHL URY PAP',
    'CO': 'COL VEN ECU PER PAN',
    'JP': 'JPN TWN',
    'RU': 'RUS BLR',
}
ZONE_OF = {iso: z for z, members in ZONE_MEMBERS.items() for iso in members.split()}
ZONE_NOTE = {'GRL': 'Greenland follows Denmark into the EU zone (A)',
             'SPM': 'French territory: EU zone (A)', 'GIB': 'haven, British: UK zone (A)',
             'IMN': 'haven, British: UK zone (A)', 'JEY': 'haven, British: UK zone (A)',
             'GGY': 'haven, British: UK zone (A)', 'LUX': 'haven, EU member: EU zone (A)',
             'LIE': 'Liechtenstein goes with Switzerland (A)',
             'PAK': 'Chinese debt vassal: China and puppets zone (A)', 'LKA': 'Chinese debt vassal: China and puppets zone (A)',
             'DJI': 'Chinese debt vassal: China and puppets zone (A)', 'ZMB': 'Chinese debt vassal: China and puppets zone (A)',
             'MLI': 'US debt vassal kept in West Africa by geography (A)',
             'JPN': 'Japan zone 25 (Logan, batch 154)',
             'TWN': 'Taiwan goes with Japan, zone 25 (Logan, batch 154)',
             'MAC': 'SAR of China with its own row (Logan, batch 153): Macau zone 11',
             'RUS': 'Russia zone 26 (Logan, batch 154)',
             'BLR': 'Russian close client: Russia zone 26 (batch 154, A)',
             'EGY': 'Egypt in the Middle East zone (A)', 'TUR': 'Turkey in the Middle East zone (A)',
             'MNG': 'Mongolia with China, its main client (A)', 'MMR': 'Myanmar with Southeast Asia (A)'}

def financial_zone(c):
    return ZONE_OF[c['iso3']]

# Logan, batch 155: "Things that we were traditionally applying to a countries economy we are no apply across and
# entire financial zone." Economy settings live on the zone (mvp-spec 5.1.2, 5A C23 to C28); government settings stay
# national (corporate tax, sovereign rating and spread, laws, sanctions, politics; batch 121) (A).
# Each zone value is set directly per zone; the default seed is the GDP-weighted average of the members' old country
# values (T). ZONE_ECON_SET overrides a seed by hand: {zone_id: {column: value}} (empty at start).
#   credit_spread_bps GDP-weighted sovereign_spread_bps of the members: the zone spread corporate borrowing pays over
#                     the world base rate (mvp-spec 5.12, 5.13)
#   confidence_start  starting market sentiment of the zone exchange, -100 to +100 (3-markets 3.3.5); 0 for all (T)
# Logan, batch 157 (3): "we don't have wage value we have labor_value that is it. This is bound to industry not
# geography." No zone wage or price level: labor is industries.csv labor_value_usd only. credit_spread_bps is the
# fixed base the quarterly cycle term moves around (mvp-spec 5.1.2, batch 157 1ab, A).
ZONE_ECON_SET = {}
CONFIDENCE_START = 0

def zone_economy(members, gdp, ce_by_iso):
    g = sum(gdp[i] for i in members)
    cs = round(sum(gdp[i] * float(ce_by_iso[i]['sovereign_spread_bps']) for i in members) / g)
    return {'credit_spread_bps': cs, 'confidence_start': CONFIDENCE_START}

def build_zones(countries, ce_rows):
    gdp = {c['iso3']: float(c['gdp_usd_bn']) for c in countries}
    ce_by_iso = {r['iso3']: r for r in ce_rows}
    total = sum(gdp.values())
    rows = []
    for (zid, num, name, hub, hub_prov, code, exch, index, inten, lag, cont, own, extra, note) in ZONES:
        members = [r['iso3'] for r in ce_rows if r['financial_zone'] == zid]
        g = sum(gdp[i] for i in members)
        econ = zone_economy(members, gdp, ce_by_iso)
        econ.update(ZONE_ECON_SET.get(zid, {}))
        rows.append({'zone_id': zid, 'number': num, 'name': name, 'hub_city': hub, 'hub_province': hub_prov,
                     'exchange_code': code, 'exchange': exch, 'headline_index': index, 'intensity': fmt(inten),
                     'lag_quarters': lag, 'contagion': fmt(cont), 'own_shock_sd': fmt(own),
                     'extra_provinces': extra, 'countries': len(members), 'gdp_usd_bn': round(g),
                     'gdp_share': fmt(g / total), 'credit_spread_bps': econ['credit_spread_bps'],
                     'confidence_start': econ['confidence_start'], 'notes': note})
    return rows

# 3.6.5 crisis premium while in a debt crisis or the default chain, as the calibration offset (A, T)
OFFSET = {'GRC': 200, 'ITA': 50, 'ESP': 50, 'PRT': 50, 'CYP': 50, 'ARG': 200, 'VEN': 200, 'LBN': 200}
# 3.6.2 sovereign spreads by band (bps)
SOV = {'AAA': 0, 'AA': 15, 'A': 40, 'BBB': 100, 'BB': 250, 'B': 450, 'CCC': 800, 'CC': 1400, 'C': 2500}
ORDER = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C']

def sov_spread(r):
    """3.6.2: a plus notch is a third of the way toward the better band, a minus a third toward the worse."""
    base, notch = (r[:-1], r[-1]) if r[-1] in '+-' else (r, '')
    i = ORDER.index(base)
    s = SOV[base]
    if notch == '+':
        s -= (s - SOV[ORDER[i - 1]]) / 3
    elif notch == '-':
        s += (SOV[ORDER[i + 1]] - s) / 3
    return s

def fallback_rating(c):
    """Unrated in 2020: by GDP per head and state (A). Batch 158: wealth_index is an equality index,
    so the old WI cut-offs 0.8/0.4/0.2/0.1 are restated as GDP per head $48k/$18k/$6.6k/$2.35k, which keeps every batch 148 rating."""
    if int(c['hss']) <= 35:
        return 'CCC'
    gph = float(c['gdp_usd_bn']) / float(c['population_m'])  # $k per head
    if gph >= 48:
        return 'A'
    if gph >= 18:
        return 'BBB-'
    if gph >= 6.6:
        return 'BB-'
    if gph >= 2.35:
        return 'B+'
    return 'B-'

def nearest_band(rate):
    return min(BANDS, key=lambda b: (abs(b[1] - rate), -b[1]))[0]

def build_countries(countries):
    rows = []
    for c in countries:
        iso = c['iso3']
        notes = []
        real = TAX[iso]
        if iso in HAVENS:
            level, rate = 'Haven', 0.03
            notes.append('Haven (2.2.5): E2 Haven rate 3%' + f', headline {real:.1%}')
        else:
            if real is None:
                rate = BAND_RATE['Moderate']
                notes.append('2020 rate not known: Moderate band rate (A)')
            elif real < 0.03:
                rate = 0.03
                notes.append(f'headline {real:.0%}: floored at the E2 Haven rate 3% (A)')
            else:
                rate = real
            level = MAJOR_LEVEL.get(iso) or nearest_band(rate)
            if iso in MAJOR_LEVEL and nearest_band(rate) != level:
                notes.append(f'2.2.3 level {level} kept; real rate is nearer {nearest_band(rate)}')
        if iso in RATING:
            rating = RATING[iso]
            if iso in RATING_NOTE:
                notes.append('rating ' + RATING_NOTE[iso])
        else:
            rating = fallback_rating(c)
            notes.append('unrated in 2020: rating from GDP per head and state (A)')
        off = OFFSET.get(iso, 0)
        if off:
            notes.append(f'crisis premium +{off} bps (3.6.5)')
        spread = 0 if iso == 'USA' else round(sov_spread(rating) + off)
        zone = financial_zone(c)
        if iso in ZONE_NOTE:
            notes.append(ZONE_NOTE[iso])
        # batch 155: renamed from country_spread_bps. The government's own spread (sovereign bonds post-MVP; the seed
        # of its zone's credit_spread_bps); company borrowing reads the zone spread instead (mvp-spec 5.12, 5A C23)
        rows.append({'iso3': iso, 'corp_tax_level': level, 'corp_tax_rate': fmt(rate),
                     'sovereign_rating': rating, 'sovereign_spread_bps': spread, 'financial_zone': zone,
                     'notes': '; '.join(notes)})
    return rows

# ---------------------------------------------------------------------------
# 3. key-cities.csv (parsed from 2-map-and-influence.md 2.3.3 to 2.3.5)
# ---------------------------------------------------------------------------
COUNTRY_ISO = {'United States': 'USA', 'Canada': 'CAN', 'Mexico': 'MEX', 'Brazil': 'BRA', 'Chile': 'CHL',
               'Colombia': 'COL', 'Argentina': 'ARG', 'United Kingdom': 'GBR', 'Netherlands': 'NLD', 'Germany': 'DEU',
               'France': 'FRA', 'Switzerland': 'CHE', 'Russia': 'RUS', 'Turkey': 'TUR', 'Italy': 'ITA', 'UAE': 'ARE',
               'Saudi Arabia': 'SAU', 'Qatar': 'QAT', 'Israel': 'ISR', 'Egypt': 'EGY', 'Nigeria': 'NGA',
               'South Africa': 'ZAF', 'DR Congo': 'COD', 'India': 'IND', 'China': 'CHN',
               'Hong Kong (SAR of China)': 'HKG', 'Macau (SAR of China)': 'MAC', 'Taiwan': 'TWN', 'South Korea': 'KOR', 'Japan': 'JPN',
               'Singapore': 'SGP', 'Malaysia': 'MYS', 'Indonesia': 'IDN', 'Vietnam': 'VNM', 'Australia': 'AUS',
               'Jamaica': 'JAM', 'Cuba': 'CUB', 'North Korea': 'PRK', 'Kazakhstan': 'KAZ', 'Morocco': 'MAR',
               'Kenya': 'KEN'}
# Specialty industries for the key cities that have no 2.3.4 row, read from their 2.3.3 specialties text (A).
# Non-industries in that text (media, exchanges, government, textiles, tourism) are left out.
SPECIALTY_FALLBACK = {
    'New York': ['Banking', 'Asset management', 'Insurance', 'Professional services', 'Real estate'],
    'Chicago': ['Asset management', 'Logistics', 'Agriculture'],
    'Houston': ['Oil', 'Gas', 'Chemicals'],
    'Bay Area': ['Asset management', 'Software', 'AI labs', 'Semiconductors'],
    'Los Angeles-Long Beach': ['Shipping', 'Aerospace', 'Defense'],
    'Phoenix': ['Semiconductors', 'Data centers'],
    'Edmonton': ['Oil'],
    'Toronto': ['Banking', 'Mining', 'Autos', 'AI labs'],
    'Mexico City': ['Autos', 'Consumer electronics', 'Retail', 'Telecom'],
    'São Paulo': ['Banking', 'Autos', 'Agriculture', 'Mining'],
    'Medellín': ['Agriculture', 'Black market', 'Software'],
    'London': ['Insurance', 'Professional services', 'Asset management', 'Banking'],
    'Rotterdam': ['Shipping', 'Chemicals', 'Gas', 'Logistics'],
    'Frankfurt': ['Banking', 'Chemicals', 'Autos', 'Logistics'],
    'Paris': ['Luxury', 'Aerospace', 'Power utilities', 'Defense', 'Banking'],
    'Zurich': ['Banking', 'Asset management', 'Insurance', 'Pharma'],
    'Moscow': ['Oil', 'Gas', 'Metals', 'Defense', 'Black market'],
    'Istanbul': ['Autos', 'Shipping', 'Banking'],
    'Dubai': ['Logistics', 'Airlines', 'Real estate', 'Black market'],
    'Tel Aviv': ['Software', 'Semiconductors', 'Defense', 'Asset management'],
    'Cairo-Suez': ['Shipping', 'Chemicals', 'Construction', 'Gas'],
    'Lagos': ['Oil', 'Banking', 'Retail', 'Black market'],
    'Johannesburg': ['Mining', 'Banking', 'Power utilities'],
    'Mumbai': ['Banking', 'Pharma', 'Chemicals', 'Oil'],
    'Bengaluru': ['Professional services', 'Software', 'Semiconductors', 'Aerospace', 'Pharma'],
    'Shanghai': ['Shipping', 'Banking', 'EVs', 'Semiconductors'],
    'Hong Kong': ['Banking', 'Logistics', 'Professional services'],
    'Beijing': ['AI labs', 'Software', 'Telecom'],
    'Tokyo-Yokohama': ['Banking', 'Autos', 'Robotics', 'Semiconductors'],
    'Singapore': ['Shipping', 'Chemicals', 'Asset management', 'Data centers'],
    'Jakarta': ['Retail', 'Metals', 'Agriculture', 'Mining'],
    'Ho Chi Minh City': ['Consumer electronics', 'Agriculture'],
    'Sydney': ['Banking', 'Asset management', 'Real estate', 'Mining'],
    # batch 152 financial zone hubs (A)
    'Kingston': ['Shipping', 'Banking', 'Professional services'],
    'Havana': ['Shipping', 'Agriculture'],
    'Pyongyang': ['Defense', 'Black market'],
    'Macau': ['Gambling', 'Real estate'],
    'Almaty': ['Banking', 'Logistics', 'Telecom'],
    'Casablanca': ['Banking', 'Chemicals', 'Shipping'],
    'Nairobi': ['Banking', 'Telecom', 'Professional services'],
    'Bogotá': ['Banking', 'Logistics', 'Agriculture'],
}
INDUSTRY_NAMES = [r[0] for r in IND]

def md_table(text, heading):
    """Rows (lists of cells) of the first markdown table after a heading line starting with `heading`."""
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith(heading))
    rows, seen = [], False
    for l in lines[start + 1:]:
        if l.startswith('|'):
            seen = True
            cells = [c.strip() for c in l.strip().strip('|').split('|')]
            if set(''.join(cells)) <= set('-: '):
                continue
            rows.append(cells)
        elif seen:
            break
    return rows[1:]  # drop the header

PID = re.compile(r'([A-Z]{2})-(\d{4})(?: to [A-Z]{2}-(\d{4}))?')

def expand_ids(cell):
    out = []
    for pre, a, b in PID.findall(cell):
        for n in range(int(a), int(b or a) + 1):
            out.append(f'{pre}-{n:04d}')
    return out

def industries_in(text):
    """The 42 industry names named in a 2.3.4 cell, in order."""
    found = []
    for part in re.split(r',\s*(?![^()]*\))', text):
        head = part.split('(')[0].strip()
        if head in INDUSTRY_NAMES:
            found.append(head)
    return found

def build_key_cities():
    text = open(os.path.join(DETAILED, '2-map-and-influence.md'), encoding='utf-8').read()
    cities = md_table(text, '### 2.3.3')
    sig = {r[0]: r[1] for r in md_table(text, '### 2.3.4')}
    perks = {r[0]: (r[1], r[2]) for r in md_table(text, '### 2.3.5')}
    rows = []
    for i, (city, country, pids, spec, perk) in enumerate(cities, 1):
        notes = []
        if city in sig:
            inds = industries_in(sig[city])
            signature = sig[city]
            unknown = [p for p in re.split(r',\s*(?![^()]*\))', sig[city]) if p.split('(')[0].strip() not in INDUSTRY_NAMES]
            if unknown:
                notes.append('2.3.4 names non-industries: ' + ', '.join(unknown))
        else:
            inds = SPECIALTY_FALLBACK[city]
            signature = ', '.join(inds)
            notes.append('no 2.3.4 row: specialties and signature units read from the 2.3.3 specialties text (A)')
        has_perk = city in perks
        if has_perk != (perk == '2.3.5'):
            notes.append(f'2.3.3 perk column says "{perk}" but 2.3.5 {"has" if has_perk else "has no"} row')
        achieve, get = perks.get(city, ('', ''))
        rows.append({'id': f'KC-{i:02d}', 'city': city, 'country': COUNTRY_ISO[country],
                     'province_ids': ';'.join(expand_ids(pids)), 'specialties': ';'.join(inds),
                     'specialties_text': spec, 'signature_assets': signature,
                     'has_perk': 'Y' if has_perk else 'N', 'perk_achieve': achieve, 'perk_get': get,
                     'notes': '; '.join(notes)})
    return rows

def build_ai_boom():
    """The AI boom schedule (Logan, batch 151; mvp-spec 5.1.1): AI labs' long-term rate by stage and boom year."""
    return [{'stage': st, 'boom_year': n, 'default_year': yr, 'ai_labs_lt': fmt(lt) if lt != '' else '', 'notes': note}
            for st, n, yr, lt, note in AI_BOOM]

# ---------------------------------------------------------------------------
# 6. company-start.csv (Logan, batch 161: mvp-spec 7.1, G6)
# ---------------------------------------------------------------------------
PRICE_BASE, PRICE_REF_USD, PRICE_EXP, PRICE_MIN, PRICE_MAX, PRICE_JITTER = 25.0, 1e9, 0.35, 5, 200, 0.10   # (T)
MIN_VALUE_USD = 100000.0   # value floor for share counts: the barebones company's one asset (A)

def price_jitter(cid):
    """Seeded jitter of up to +-10%, read from a hash of the company id (no random state, same every run)."""
    import zlib
    return 1 + PRICE_JITTER * (2 * (zlib.crc32(('price:' + cid).encode()) % 10001) / 10000 - 1)

def build_company_start(ce_rows, zones):
    """Starting balance sheet and share count for the 651 companies (Logan, batch 161, 1a and 2b).
    Asset book = 50% of gross business assets (7.1 loadout); cash fills the gap up to book equity, or a
    drawn credit line covers asset book above book equity plus min_cash (5% of revenue). Engine value is the
    5.13 fair value at load: flat synthetic history (g 0, G 1), Normal cycle, company confidence 1.0, X from
    the zone confidence_start for listed companies; it skips line interest (A). open_price =
    clamp(round(25 x (value / $1B)^0.35 x jitter), 5, 200)
    (a fixed $1B reference, not the median, so the spread reaches about $5 to $200); shares = value / open_price."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import validate
    cos = validate.load(os.path.join(DATA, 'companies.csv'))
    inds = {r['name']: r for r in validate.load(os.path.join(DATA, 'industries.csv'))}
    traits = {c['id']: c['traits'].split(';') for c in validate.load(os.path.join(DATA, 'characters.csv'))}
    ce = {r['iso3']: r for r in ce_rows}
    zone = {z['zone_id']: z for z in zones}
    rows = []
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
        margin = validate.normal_company(ind, max(0.1, float(c['revenue_usd_m'])), validate.rd_mult(c, ind, traits))[2]
        ebit = margin * r_usd
        e = ce[c['hq_country']]
        z = zone[e['financial_zone']]
        ni = ebit * (1 - float(e['corp_tax_rate'])) if ebit > 0 else ebit
        home = (0.5 * float(z['credit_spread_bps']) + 0.5 * float(e['sovereign_spread_bps'])) / 1e4
        rf = min(1.6, max(0.4, 0.09 / (0.035 + home + 0.05)))
        x = 1 + 0.10 * float(z['confidence_start']) / 100 if c['public'] == 'Y' else 1.0
        if ni > 0:
            fv = (0.3 * be + 0.7 * ni * float(ind['earnings_multiple']) * rf) * x
        else:
            fv = be * x
        fv = max(fv, 0.6 * be, MIN_VALUE_USD)
        rows.append([c, asset_book, cash, line, fv])
    out = []
    for c, ab, cash, line, fv in rows:
        p = PRICE_BASE * (fv / PRICE_REF_USD) ** PRICE_EXP * price_jitter(c['id'])
        p = min(PRICE_MAX, max(PRICE_MIN, round(p)))
        out.append({'id': c['id'], 'ticker': c['ticker'], 'public': c['public'],
                    'gross_assets_usd': round(2 * ab), 'asset_book_usd': round(ab), 'cash_usd': round(cash),
                    'credit_drawn_usd': round(line), 'book_equity_usd': round(cash + ab - line),
                    'engine_value_usd': round(fv), 'open_price': p, 'shares': max(1, round(fv / p))})
    return out

def write(path, rows):
    with open(path, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    print(f'wrote {path}: {len(rows)} rows')

def main():
    countries = list(csv.DictReader(open(os.path.join(DATA, 'countries.csv'), encoding='utf-8')))
    write(os.path.join(DATA, 'industries.csv'), build_industries())
    ce_rows = build_countries(countries)
    write(os.path.join(DATA, 'country-economy.csv'), ce_rows)
    zone_rows = build_zones(countries, ce_rows)
    write(os.path.join(DATA, 'financial-zones.csv'), zone_rows)
    write(os.path.join(DATA, 'key-cities.csv'), build_key_cities())
    write(os.path.join(DATA, 'ai-boom.csv'), build_ai_boom())
    write(os.path.join(DATA, 'company-start.csv'), build_company_start(ce_rows, zone_rows))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import validate
    sys.exit(validate.run(DATA))

if __name__ == '__main__':
    main()
