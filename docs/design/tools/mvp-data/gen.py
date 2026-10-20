#!/usr/bin/env python3
"""Build the three MVP design data tables (Logan, batch 147).

    python3 gen.py [design dir]

Writes into <design>/data/:
  industries.csv        42 rows  (mvp-spec 2.2; 10-industry-economy 10.3, 10.3.1, 10.0.11.10; 3-markets 3.3.2)
  country-economy.csv   210 rows (mvp-spec 2.2; 2-map 2.2.3, 2.2.5, 2.18.1; 3-markets 3.6.2, 3.6.5; 4-politics E2)
  key-cities.csv        80 rows  (2-map 2.3.3, 2.3.4, 2.3.5, parsed from the markdown)

Plain Python 3, no packages, no randomness: the same inputs always give the same files.
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
    ('Semiconductors', 'Tech', 330, 0.05, 1.6, 'Medium', 0.27, 0.45, 1.3, 'Trend +5% plus the AI boom (10.6); the boom is not modelled in the MVP, so 0.05 (A)'),
    ('AI labs', 'Tech', 5, 0.30, 2.0, 'High', 0.00, 0.70, 0.3, 'Trend "Boom-driven" stored as 0.30 (T); margin "-40% to +40%" stored as 0.00 (T) (mvp-spec G4)'),
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
# mvp-spec 2.2 and 10.3 asset decay (Logan, batch 145; T)
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

def build_industries():
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
            'rate_sensitivity': RATE_SENS[rs], 'margin_full_use': fmt(m), 'fixed_cost_share': fmt(f),
            'variable_cost_share': fmt(1 - m - f), 'capital_per_dollar': fmt(cap), 'asset_turnover': fmt(1 / cap),
            'asset_decay': fmt(DECAY[name]), 'rd_norm': fmt(RD_NORM[name]), 'labor_value_usd': lv,
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
    'HKG': .165, 'PRK': .25, 'MNG': .25, 'THA': .20, 'PHL': .30, 'MMR': .25, 'KHM': .20, 'LAO': .20, 'BRN': .185,
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
    'AUS': 'AAA', 'HKG': 'AA+', 'PRK': 'CC', 'MNG': 'B', 'THA': 'BBB+', 'PHL': 'BBB+', 'KHM': 'B', 'LAO': 'B-',
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
NON_EURO_EU = {'BGR', 'HRV', 'CZE', 'DNK', 'HUN', 'POL', 'ROU', 'SWE'}
# Territories that share their sovereign's cycle (A); SPM is French, so it joins the euro area group
CYCLE_PARENT = {'PRI': 'USA', 'GRL': 'DNK', 'FRO': 'DNK', 'SPM': 'EA', 'JEY': 'GBR', 'GGY': 'GBR', 'IMN': 'GBR',
                'GIB': 'GBR'}
# Starting phases set by hand (A); everything else starts in Expansion
PHASE = {}
for c in EURO_USERS:
    PHASE[c] = 'Contraction'
for c in NON_EURO_EU | {'GBR', 'CHE', 'NOR', 'ISL', 'LIE'}:
    PHASE[c] = 'Recovery'
PHASE.update({'ARG': 'Contraction', 'VEN': 'Contraction', 'LBN': 'Contraction', 'IRN': 'Contraction',
              'ZWE': 'Contraction', 'TUR': 'Recovery'})
PHASE_NOTE = {'Contraction': 'in recession at start', 'Recovery': 'recovering at start'}
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
    """Unrated in 2020: by wealth and state (A)."""
    if int(c['hss']) <= 35:
        return 'CCC'
    wi = float(c['wealth_index'])
    if wi >= 0.8:
        return 'A'
    if wi >= 0.4:
        return 'BBB-'
    if wi >= 0.2:
        return 'BB-'
    if wi >= 0.1:
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
            notes.append('unrated in 2020: rating from wealth and state (A)')
        off = OFFSET.get(iso, 0)
        if off:
            notes.append(f'crisis premium +{off} bps (3.6.5)')
        spread = 0 if iso == 'USA' else round(sov_spread(rating) + off)
        group = 'EA' if iso in EURO_AREA else CYCLE_PARENT.get(iso, iso)
        if iso in CYCLE_PARENT:
            notes.append(f'cycle shared with {group} (A)')
        if group == 'EA':
            phase = 'Contraction'
            if iso in EURO_AREA:
                notes.append('euro area: shares the EA cycle, in the euro crisis recession (2.18.1)')
        elif iso in CYCLE_PARENT:
            phase = PHASE.get(group, 'Expansion')
        else:
            phase = PHASE.get(iso, 'Expansion')
            if iso in EURO_USERS:
                notes.append('uses the euro outside the euro area: own cycle, hit by the euro crisis (A)')
            elif iso in PHASE:
                notes.append(PHASE_NOTE[phase] + ' (A)')
        rows.append({'iso3': iso, 'corp_tax_level': level, 'corp_tax_rate': fmt(rate),
                     'sovereign_rating': rating, 'country_spread_bps': spread, 'cycle_group': group,
                     'cycle_phase_start': phase, 'notes': '; '.join(notes)})
    return rows

# ---------------------------------------------------------------------------
# 3. key-cities.csv (parsed from 2-map-and-influence.md 2.3.3 to 2.3.5)
# ---------------------------------------------------------------------------
COUNTRY_ISO = {'United States': 'USA', 'Canada': 'CAN', 'Mexico': 'MEX', 'Brazil': 'BRA', 'Chile': 'CHL',
               'Colombia': 'COL', 'Argentina': 'ARG', 'United Kingdom': 'GBR', 'Netherlands': 'NLD', 'Germany': 'DEU',
               'France': 'FRA', 'Switzerland': 'CHE', 'Russia': 'RUS', 'Turkey': 'TUR', 'Italy': 'ITA', 'UAE': 'ARE',
               'Saudi Arabia': 'SAU', 'Qatar': 'QAT', 'Israel': 'ISR', 'Egypt': 'EGY', 'Nigeria': 'NGA',
               'South Africa': 'ZAF', 'DR Congo': 'COD', 'India': 'IND', 'China': 'CHN',
               'Hong Kong (SAR of China)': 'HKG', 'Taiwan': 'TWN', 'South Korea': 'KOR', 'Japan': 'JPN',
               'Singapore': 'SGP', 'Malaysia': 'MYS', 'Indonesia': 'IDN', 'Vietnam': 'VNM', 'Australia': 'AUS'}
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

def write(path, rows):
    with open(path, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    print(f'wrote {path}: {len(rows)} rows')

def main():
    countries = list(csv.DictReader(open(os.path.join(DATA, 'countries.csv'), encoding='utf-8')))
    write(os.path.join(DATA, 'industries.csv'), build_industries())
    write(os.path.join(DATA, 'country-economy.csv'), build_countries(countries))
    write(os.path.join(DATA, 'key-cities.csv'), build_key_cities())
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import validate
    sys.exit(validate.run(DATA))

if __name__ == '__main__':
    main()
