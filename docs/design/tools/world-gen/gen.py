#!/usr/bin/env python3
"""TechnoCapital20FF batch 136: starting characters and companies.

Reads design/data/countries.csv and the eight province CSVs, combines the
hand-authored rows in named.py with generated rows, and writes
characters.csv and companies.csv. Deterministic (fixed seed).

usage: python3 gen.py <design/data dir> <output dir>
"""
import csv, glob, math, os, random, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import named, names

SEED = 136
rng = random.Random(SEED)

DATA = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/design/data'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

IDEOLOGIES = ['Liberals', 'Communists', 'Accelerationists', 'Effective Altruists', 'Transhumanists',
              'Neo-Luddites', 'Sovereigntists', 'Landites', 'Chuds']
PAIRS = [('Ambitious', 'Content'), ('Greedy', 'Generous'), ('Paranoid', 'Trusting'), ('Ruthless', 'Compassionate'),
         ('Visionary', 'Conservative'), ('Honest', 'Deceitful'), ('Brave', 'Cautious'), ('Diligent', 'Lazy'),
         ('Hedonist', 'Ascetic'), ('Zealot', 'Cynic'), ('Narcissist', 'Humble'), ('Gregarious', 'Shy')]
TRAITS = {t for p in PAIRS for t in p} | {'Operational Excellence'}
OPPOSITE = {a: b for a, b in PAIRS} | {b: a for a, b in PAIRS}

# ------------------------------------------------------------------ industries (10-industry-economy 10.3)
# name: (sector, world size $bn, margin, capital per $1, coverage share of world size by the listed companies (T), target count (T))
IND = {
    'Semiconductors': ('Tech', 330, .27, 1.3, .75, 17),
    'AI labs': ('Tech', 5, .0, .3, .80, 11),
    'Cloud': ('Tech', 300, .25, .6, .80, 13),
    'Data centers': ('Tech', 100, .20, 3.0, .50, 15),
    'Software': ('Tech', 350, .25, .2, .50, 17),
    'SaaS': ('Tech', 250, .22, .2, .40, 15),
    'Social media': ('Tech', 250, .30, .4, .85, 12),
    'Ads': ('Tech', 450, .30, .3, .60, 13),
    'Consumer electronics': ('Tech', 1100, .08, .4, .55, 16),
    'Telecom': ('Tech', 1600, .18, 2.0, .45, 19),
    'Gaming': ('Tech', 200, .22, .4, .50, 14),
    'Gambling': ('Tech', 400, .22, .5, .30, 14),
    'Banking': ('Finance', 2500, .30, None, .35, 20),
    'Insurance': ('Finance', 6000, .08, None, .20, 17),
    'Asset management': ('Finance', 500, .30, None, .25, 19),
    'Oil': ('Energy', 2500, .25, 2.5, .55, 20),
    'Gas': ('Energy', 1000, .22, 2.5, .45, 15),
    'Power utilities': ('Energy', 2500, .15, 3.0, .30, 18),
    'Renewables': ('Energy', 350, .20, 4.0, .30, 14),
    'Mining': ('Industry', 800, .18, 2.2, .40, 19),
    'Metals': ('Industry', 1200, .12, 1.8, .30, 16),
    'Chemicals': ('Industry', 4000, .10, 1.2, .10, 16),
    'Agriculture': ('Industry', 4000, .10, 1.5, .10, 16),
    'Autos': ('Industry', 2600, .06, .8, .55, 16),
    'EVs': ('Industry', 400, .04, 1.0, .50, 14),
    'Aerospace': ('Industry', 450, .10, .8, .65, 13),
    'Defense': ('Industry', 350, .12, .8, .55, 15),
    'Robotics': ('Industry', 45, .10, .7, .40, 13),
    'Drones': ('Industry', 15, .12, .6, .40, 12),
    'Shipping': ('Industry', 500, .08, 2.0, .35, 15),
    'Logistics': ('Industry', 900, .07, 1.0, .25, 16),
    'Airlines': ('Industry', 500, .05, 1.5, .40, 14),
    'Construction': ('Industry', 13000, .05, .3, .07, 18),
    'Retail': ('Consumer', 20000, .04, .4, .10, 17),
    'E-commerce': ('Consumer', 5000, .05, .4, .25, 14),
    'Fast food': ('Consumer', 1000, .10, .6, .20, 13),
    'Luxury': ('Consumer', 350, .25, .5, .45, 13),
    'Pharma': ('Health', 1400, .22, .6, .35, 16),
    'Healthcare services': ('Health', 8000, .08, .7, .06, 15),
    'Real estate': ('Services', 3000, .20, 2.0, .10, 19),
    'Professional services': ('Services', 6000, .15, .1, .04, 17),
    'Black market': ('Services', 2000, .40, .3, .02, 15),
}
MULT = {'Tech': 22, 'Finance': 11, 'Energy': 9, 'Industry': 11, 'Consumer': 16, 'Health': 17, 'Services': 13}
EXTRACTION_TAGS = {
    'Oil': {'Oil'}, 'Gas': {'Gas'},
    'Mining': {'Coal', 'Copper', 'Lithium', 'Cobalt', 'Nickel', 'Rare earths', 'Gold', 'Uranium', 'Silver', 'Zinc',
               'Tin', 'Platinum', 'Diamonds', 'Bauxite', 'Iron ore'},
    'Agriculture': {'Farmland', 'Timber', 'Fishing'},
}
INDUSTRY_FIT = {'Semiconductors', 'Data centers', 'Consumer electronics', 'Telecom', 'Power utilities', 'Renewables',
                'Metals', 'Chemicals', 'Autos', 'EVs', 'Aerospace', 'Defense', 'Robotics', 'Drones', 'Shipping',
                'Logistics', 'Airlines', 'Construction', 'Pharma'}

# 2-map-and-influence 2.3.3 (province ids) and 2.3.4 (signature industries)
KEY_CITIES = {'New York': ['US-0027', 'US-0080', 'US-0081', 'US-0086', 'US-0087', 'US-0088', 'US-0089'], 'Chicago': ['US-0044', 'US-0045', 'US-0046'], 'Houston': ['US-0122', 'US-0123', 'US-0124'], 'Bay Area': ['US-0018', 'US-0019', 'US-0020'], 'Los Angeles-Long Beach': ['US-0010', 'US-0011', 'US-0012', 'US-0013', 'US-0014'], 'Phoenix': ['US-0005', 'US-0006'], 'Edmonton': ['CA-0033'], 'Toronto': ['CA-0001', 'CA-0002', 'CA-0003'], 'Mexico City': ['MX-0001', 'MX-0002', 'MX-0003', 'MX-0004', 'MX-0005'], 'Washington DC': ['US-0030', 'US-0062', 'US-0137'], 'Boston': ['US-0064'], 'Seattle': ['US-0140'], 'Dallas-Fort Worth': ['US-0118', 'US-0119', 'US-0120'], 'Atlanta': ['US-0038', 'US-0039', 'US-0040'], 'Miami': ['US-0031', 'US-0032', 'US-0033'], 'Austin': ['US-0126'], 'Detroit': ['US-0066'], 'Las Vegas': ['US-0076'], 'Vancouver': ['CA-0026'], 'Montreal': ['CA-0015'], 'Ottawa': ['CA-0010'], 'Monterrey': ['MX-0011', 'MX-0012', 'MX-0013'], 'Guadalajara': ['MX-0007', 'MX-0008', 'MX-0009'], 'São Paulo': ['BR-0001', 'BR-0002', 'BR-0003', 'BR-0004'], 'Antofagasta': ['CL-0003'], 'Medellín': ['CO-0005'], 'Rio de Janeiro': ['BR-0010', 'BR-0011', 'BR-0012', 'BR-0013'], 'Buenos Aires': ['AR-0001', 'AR-0002', 'AR-0003', 'AR-0004'], 'Santiago': ['CL-0009', 'CL-0010'], 'London': ['GB-0001', 'GB-0002', 'GB-0003', 'GB-0004'], 'Rotterdam': ['NL-0004'], 'Eindhoven': ['NL-0009'], 'Frankfurt': ['DE-0019', 'DE-0020', 'DE-0023'], 'Paris': ['FR-0001', 'FR-0002', 'FR-0003', 'FR-0004'], 'Zurich': ['CH-0001'], 'Moscow': ['RU-0001', 'RU-0002', 'RU-0003', 'RU-0004', 'RU-0005'], 'Istanbul': ['TR-0001', 'TR-0002', 'TR-0003', 'TR-0004', 'TR-0005'], 'Munich': ['DE-0006', 'DE-0007', 'DE-0008'], 'Berlin': ['DE-0013', 'DE-0014', 'DE-0015'], 'Amsterdam': ['NL-0001'], 'Milan': ['IT-0001', 'IT-0002', 'IT-0003'], 'Rome': ['IT-0007'], 'St Petersburg': ['RU-0015', 'RU-0016', 'RU-0017', 'RU-0018'], 'Dubai': ['AE-0008', 'AE-0010', 'AE-0012'], 'Dhahran-Dammam': ['SA-0014', 'SA-0015', 'SA-0016', 'SA-0018'], 'Doha': ['QA-0001', 'QA-0002', 'QA-0003', 'QA-0008'], 'Tel Aviv': ['IL-0004', 'IL-0005', 'IL-0007', 'IL-0010'], 'Cairo-Suez': ['EG-0001', 'EG-0002', 'EG-0003', 'EG-0004', 'EG-0005', 'EG-0007', 'EG-0018', 'EG-0019', 'EG-0020'], 'Lagos': ['NG-0001', 'NG-0002', 'NG-0003', 'NG-0004'], 'Johannesburg': ['ZA-0001', 'ZA-0002', 'ZA-0003', 'ZA-0004', 'ZA-0023', 'ZA-0026'], 'Kolwezi-Lubumbashi': ['CD-0023', 'CD-0024'], 'Riyadh': ['SA-0001', 'SA-0002', 'SA-0003'], 'Abu Dhabi': ['AE-0001', 'AE-0002', 'AE-0005', 'AE-0006'], 'Cape Town': ['ZA-0006', 'ZA-0007'], 'Mumbai': ['IN-0013', 'IN-0014', 'IN-0015', 'IN-0016', 'IN-0051'], 'Bengaluru': ['IN-0023', 'IN-0024', 'IN-0025'], 'Shanghai': ['CN-0008', 'CN-0009', 'CN-0010', 'CN-0011', 'CN-0012', 'CN-0013'], 'Shenzhen-Dongguan': ['CN-0019', 'CN-0020', 'CN-0021', 'CN-0022'], 'Hong Kong': ['HK-0001', 'HK-0002', 'HK-0003'], 'Beijing': ['CN-0001', 'CN-0002', 'CN-0003', 'CN-0004'], 'Baotou': ['CN-0116'], 'Hsinchu-Taipei': ['TW-0001', 'TW-0002', 'TW-0003', 'TW-0004', 'TW-0005'], 'Seoul-Pyeongtaek': ['KR-0001', 'KR-0002', 'KR-0003', 'KR-0004', 'KR-0005', 'KR-0006'], 'Tokyo-Yokohama': ['JP-0001', 'JP-0002', 'JP-0003', 'JP-0004', 'JP-0005', 'JP-0006', 'JP-0008', 'JP-0010'], 'Singapore': ['SG-0001', 'SG-0002', 'SG-0003'], 'Penang': ['MY-0005'], 'Jakarta': ['ID-0001', 'ID-0002', 'ID-0003', 'ID-0004', 'ID-0005', 'ID-0006', 'ID-0011'], 'Ho Chi Minh City': ['VN-0001', 'VN-0002', 'VN-0003', 'VN-0004'], 'Perth-Pilbara': ['AU-0035', 'AU-0041', 'AU-0042'], 'Sydney': ['AU-0001', 'AU-0002'], 'Delhi NCR': ['IN-0001', 'IN-0002', 'IN-0003', 'IN-0005'], 'Hyderabad': ['IN-0029', 'IN-0030', 'IN-0031'], 'Chennai': ['IN-0033', 'IN-0034', 'IN-0035'], 'Chengdu': ['CN-0085', 'CN-0086', 'CN-0087', 'CN-0088', 'CN-0089'], 'Wuhan': ['CN-0063', 'CN-0064', 'CN-0065'], 'Osaka-Kobe': ['JP-0037', 'JP-0038', 'JP-0039', 'JP-0040', 'JP-0042'], 'Kaohsiung': ['TW-0016'], 'Kuala Lumpur': ['MY-0001', 'MY-0002', 'MY-0003'], 'Hanoi': ['VN-0025', 'VN-0026', 'VN-0027'], 'Melbourne': ['AU-0015', 'AU-0016']}
SIGNATURE = {'Hsinchu-Taipei': ['Semiconductors'], 'Seoul-Pyeongtaek': ['Semiconductors', 'Consumer electronics', 'EVs'], 'Eindhoven': ['Semiconductors'], 'Shenzhen-Dongguan': ['Consumer electronics', 'EVs', 'Drones'], 'Penang': ['Semiconductors'], 'Kolwezi-Lubumbashi': ['Mining'], 'Baotou': ['Mining', 'Metals'], 'Perth-Pilbara': ['Mining', 'Gas'], 'Dhahran-Dammam': ['Oil', 'Chemicals'], 'Doha': ['Gas'], 'Antofagasta': ['Mining'], 'Houston': ['Oil', 'Gas', 'Chemicals'], 'Washington DC': ['Defense', 'Data centers', 'Professional services'], 'Boston': ['Pharma', 'Asset management', 'Robotics'], 'Seattle': ['Cloud', 'E-commerce', 'Aerospace'], 'Dallas-Fort Worth': ['Telecom', 'Banking', 'Logistics'], 'Atlanta': ['Airlines', 'Logistics', 'Banking'], 'Miami': ['Banking', 'Real estate'], 'Austin': ['Semiconductors', 'EVs', 'Software'], 'Detroit': ['Autos', 'EVs'], 'Las Vegas': ['Gambling'], 'Vancouver': ['Real estate', 'Shipping'], 'Montreal': ['AI labs', 'Aerospace', 'Gaming'], 'Ottawa': ['Telecom', 'Software'], 'Monterrey': ['Metals', 'Construction'], 'Guadalajara': ['Consumer electronics', 'Software'], 'Rio de Janeiro': ['Oil'], 'Buenos Aires': ['Agriculture', 'Banking'], 'Santiago': ['Asset management', 'Mining'], 'Munich': ['Autos', 'Insurance'], 'Berlin': ['Software', 'E-commerce'], 'Amsterdam': ['Data centers', 'Banking'], 'Milan': ['Luxury', 'Banking'], 'Rome': ['Power utilities', 'Gas'], 'St Petersburg': ['Gas', 'Shipping'], 'Riyadh': ['Asset management', 'Construction'], 'Abu Dhabi': ['Oil', 'Asset management'], 'Cape Town': ['Agriculture', 'Banking'], 'Delhi NCR': ['Autos', 'Software', 'Telecom'], 'Hyderabad': ['Pharma', 'Data centers', 'Software'], 'Chennai': ['Autos', 'Consumer electronics'], 'Chengdu': ['Consumer electronics', 'Gaming'], 'Wuhan': ['Autos', 'Metals', 'Telecom'], 'Osaka-Kobe': ['Consumer electronics', 'Pharma', 'Shipping'], 'Kaohsiung': ['Semiconductors', 'Chemicals', 'Metals'], 'Kuala Lumpur': ['Banking', 'Agriculture', 'Data centers'], 'Hanoi': ['Consumer electronics']}
# Key cities without a 2.3.4 row: their 2.3.3 specialties as industries (A)
SIGNATURE_EXTRA = {'New York': ['Banking', 'Insurance', 'Asset management'], 'Chicago': ['Agriculture', 'Logistics'],
                   'Bay Area': ['Software', 'Social media'], 'Los Angeles-Long Beach': ['Aerospace', 'Shipping'],
                   'Phoenix': ['Semiconductors'], 'Toronto': ['Banking'], 'Mexico City': ['Autos'],
                   'São Paulo': ['Banking'], 'London': ['Insurance'], 'Rotterdam': ['Chemicals'],
                   'Frankfurt': ['Banking'], 'Paris': ['Luxury'], 'Zurich': ['Banking'], 'Moscow': ['Metals'],
                   'Istanbul': ['Retail'], 'Tel Aviv': ['Software'], 'Cairo-Suez': ['Construction'],
                   'Lagos': ['Banking'], 'Johannesburg': ['Mining'], 'Mumbai': ['Banking'],
                   'Shanghai': ['Autos'], 'Hong Kong': ['Real estate'], 'Beijing': ['Social media'],
                   'Tokyo-Yokohama': ['Autos', 'Robotics'], 'Singapore': ['Banking'], 'Jakarta': ['Retail'],
                   'Ho Chi Minh City': ['Consumer electronics'], 'Sydney': ['Banking']}

# state ownership propensity by country (T) and industry (T)
STATE_COUNTRY = {'CHN': .7, 'RUS': .6, 'SAU': .8, 'ARE': .7, 'QAT': .8, 'IRN': .8, 'VNM': .7, 'KAZ': .6, 'DZA': .7,
                 'EGY': .4, 'IND': .3, 'IDN': .35, 'MYS': .35, 'SGP': .4, 'BRA': .2, 'MEX': .15, 'NOR': .5,
                 'FRA': .15, 'ITA': .15, 'TUR': .2, 'THA': .2, 'NGA': .3, 'ZAF': .2, 'KWT': .7, 'IRQ': .6,
                 'BLR': .7, 'VEN': .8, 'PAK': .3, 'BGD': .2, 'ETH': .6, 'AGO': .5}
STATE_IND = {'Oil': 1, 'Gas': 1, 'Power utilities': .9, 'Telecom': .6, 'Banking': .5, 'Defense': .8, 'Mining': .4,
             'Airlines': .6, 'Shipping': .35, 'Metals': .35, 'Construction': .3, 'Logistics': .25, 'Chemicals': .3,
             'Insurance': .25, 'Aerospace': .5, 'Renewables': .2}
STATE_TARGET = 72  # about 12% of companies (T)

# ------------------------------------------------------------------ load map data
countries = {r['iso3']: r for r in csv.DictReader(open(os.path.join(DATA, 'countries.csv'), encoding='utf-8'))}
provinces = {}
for f in sorted(glob.glob(os.path.join(DATA, 'provinces-*.csv'))):
    for r in csv.DictReader(open(f, encoding='utf-8')):
        provinces[r['id']] = r
prov_by_country = defaultdict(list)
for p in provinces.values():
    prov_by_country[p['country']].append(p)
KEY_PROV = {}
for city, ids in KEY_CITIES.items():
    for i in ids:
        KEY_PROV[i] = city

def i(x):
    try:
        return int(x)
    except Exception:
        return 0

def region_group(iso):
    sr = countries[iso]['superregion']
    if sr in ('North America', 'Latin America'):
        return 1
    if sr in ('South Asia', 'East Asia and Oceania'):
        return 3
    return 2

def culture(iso):
    if iso in names.COUNTRY_CULTURE:
        return names.COUNTRY_CULTURE[iso]
    return names.SUPERREGION_CULTURE.get(countries[iso]['superregion'], 'anglo')

# ------------------------------------------------------------------ companies
companies = []   # dicts
by_key = {}

def new_company(**kw):
    d = dict(key=None, name=None, industry=None, prov=None, public='Y', rev=None, hint=None, book=None, ctrl=None,
             stake=None, basis=None, record=None, others=[], notes='', value=None, named=False, gen_kind='')
    d.update(kw)
    d['others'] = list(d['others'])
    d['country'] = provinces[d['prov']]['country']
    if d['key'] is None:
        d['key'] = 'g%04d' % len(companies)
    companies.append(d)
    if d['key']:
        by_key[d['key']] = d
    return d

for c in named.CO:
    new_company(named=True, **c)

def city_of(prov):
    return KEY_PROV.get(prov)

# signature seeds: one company per key city and signature industry unless one already sits there
def has_in_city(city, ind):
    ids = set(KEY_CITIES[city])
    return any(c['industry'] == ind and c['prov'] in ids for c in companies)

def best_prov(ids, ind):
    cands = [provinces[x] for x in ids if x in provinces]
    def w(p):
        if ind in EXTRACTION_TAGS:
            return (10 if p['resource'] in EXTRACTION_TAGS[ind] else 1) * (1 + i(p['commerce']))
        tr = i(p['industry']) if ind in INDUSTRY_FIT else i(p['commerce'])
        return tr ** 2 + 1
    ws = [w(p) for p in cands]
    return rng.choices(cands, ws)[0]['id']

count = Counter(c['industry'] for c in companies)
for src in (SIGNATURE, SIGNATURE_EXTRA):
    for city, inds in src.items():
        for ind in inds:
            if has_in_city(city, ind) or count[ind] >= IND[ind][5]:
                continue
            new_company(industry=ind, prov=best_prov(KEY_CITIES[city], ind), gen_kind='seed',
                        notes='key-city starting business (%s)' % city)
            count[ind] += 1

# filler: fill each industry to its target count, HQ country weighted by GDP (T)
res_count = defaultdict(Counter)
for p in provinces.values():
    res_count[p['country']][p['resource']] += 1

def country_weight(iso, ind):
    c = countries[iso]
    if not prov_by_country.get(iso):
        return 0
    g = float(c['gdp_usd_bn'] or 0)
    w = g ** 0.85
    if ind in EXTRACTION_TAGS:
        n = sum(res_count[iso][t] for t in EXTRACTION_TAGS[ind])
        if n == 0:
            return 0
        w = (g ** 0.5) * (n ** 1.2)
    if ind == 'Black market':
        # batch 158: wealth_index is an equality index (10 to 95); less equal countries get more black market
        w = g ** 0.6 * (1.6 - float(c['wealth_index']) / 100)
    if ind in ('Defense', 'Aerospace') and iso in ('USA', 'RUS', 'CHN', 'FRA', 'GBR', 'ISR', 'TUR', 'KOR', 'IND'):
        w *= 3
    if ind == 'Semiconductors' and iso in ('TWN', 'KOR', 'JPN', 'USA', 'NLD', 'CHN', 'MYS', 'ISR'):
        w *= 4
    return w

def pick_hq(iso, ind):
    cands = prov_by_country[iso]
    def w(p):
        base = 1.0
        if p['id'] in KEY_PROV:
            base *= 4
        if p['city_rank'] == 'Metropolis':
            base *= 2
        elif p['city_rank'] == 'City':
            base *= 1.2
        if ind in EXTRACTION_TAGS:
            return base * (8 if p['resource'] in EXTRACTION_TAGS[ind] else 0.5) * (1 + i(p['commerce']))
        tr = i(p['industry']) if ind in INDUSTRY_FIT else i(p['commerce'])
        return base * (tr ** 2 + 1)
    return rng.choices(cands, [w(p) for p in cands])[0]['id']

ISOS = sorted(iso for iso in countries if prov_by_country.get(iso))

# extra companies for Rich rivals, sized so a 10-60% stake fits their wealth (T)
def value_per_rev(ind):
    sector, _, margin, cap, *_ = IND[ind]
    bk = {'Banking': 1.7, 'Insurance': .45, 'Asset management': 1.15, 'AI labs': 1.4}.get(ind, (cap or 1) * 0.625)
    m = 4 if ind == 'Black market' else MULT[sector]
    return max(0.7 * margin * 0.75 * m + 0.3 * bk, 0.8 * bk)

WEALTH = {c['key']: c['wealth'] for c in named.C}
for key, (n_total, pinds, pisos) in list(named.RICH_POOL.items()):
    pisos = [provinces[x[1:]]['country'] if x.startswith('@') else x for x in pisos]
    named.RICH_POOL[key] = (n_total, pinds, pisos)
    d = WEALTH[key] * 1000 * 0.85 / n_total
    for c in companies:  # flagships with no size yet are sized from the rival's wealth (T)
        if c['ctrl'] == key and c['rev'] is None and c['hint'] is None:
            ev = d / (0.3 if c['public'] == 'Y' else 0.75)
            c['rev'] = ev / value_per_rev(c['industry'])
    have = sum(1 for c in companies if c['ctrl'] == key)
    need = n_total - have
    if need <= 0:
        continue
    for j in range(need):
        public = 'Y' if rng.random() < 0.75 else 'N'
        ev = d / (rng.uniform(0.15, 0.45) if public == 'Y' else rng.uniform(0.55, 0.9))
        def room(x):  # the company may take at most 8% of its industry's listed revenue (T)
            return count[x] < IND[x][5] and ev / value_per_rev(x) <= 0.08 * IND[x][1] * 1000 * IND[x][4]
        inds = [x for x in pinds if room(x)] or [x for x in IND if room(x) and x != 'Black market']
        ind = inds[j % len(inds)]
        isos = [x for x in pisos if prov_by_country.get(x)]
        iso = rng.choices(isos, [float(countries[x]['gdp_usd_bn']) ** 0.85 for x in isos])[0]
        if ind == 'Black market' and public == 'Y':  # black market fronts are never listed
            public, ev = 'N', ev * 0.3 / 0.75
        rev = ev / value_per_rev(ind)
        new_company(industry=ind, prov=pick_hq(iso, ind), gen_kind='rival', rev=rev, public=public, ctrl=key,
                    notes='')
        count[ind] += 1

for ind in IND:
    while count[ind] < IND[ind][5]:
        ws = [country_weight(iso, ind) for iso in ISOS]
        iso = rng.choices(ISOS, ws)[0]
        new_company(industry=ind, prov=pick_hq(iso, ind), gen_kind='filler')
        count[ind] += 1

# ------------------------------------------------------------------ names and tickers
used_co = {c['name'] for c in companies if c['name']}
def company_name(c):
    cu = culture(c['country'])
    for _ in range(500):
        pre = rng.choice(names.PREFIX[cu] if rng.random() < 0.9 else names.PREFIX['anglo'] + names.PREFIX[cu])
        suf = rng.choice(names.SUFFIX[c['industry']])
        n = f'{pre} {suf}'
        if suf in ('Maison', 'Atelier') :
            n = f'{suf} {pre}'
        if n not in used_co:
            used_co.add(n)
            return n
    raise SystemExit('company names exhausted')
for c in companies:
    if not c['name']:
        c['name'] = company_name(c)


# ------------------------------------------------------------------ sizes
def est_value(c):
    if c['value'] is not None:
        return c['value']
    sector, _, margin, *_ = IND[c['industry']]
    ev = 0.3 * c['book'] + 0.7 * c['rev'] * margin * 0.75 * MULT[sector]
    if c['industry'] == 'Black market':
        ev = 0.3 * c['book'] + 0.7 * c['rev'] * margin * 0.75 * 4
    return max(ev, c['book'] * 0.8)

def make_book(c):
    sector, _, margin, cap, *_ = IND[c['industry']]
    if c['industry'] == 'Banking':
        return c['rev'] * rng.uniform(1.2, 2.2)
    if c['industry'] == 'Insurance':
        return c['rev'] * rng.uniform(0.3, 0.6)
    if c['industry'] == 'Asset management':
        return c['rev'] * rng.uniform(0.8, 1.5)
    if c['industry'] == 'AI labs':
        return c['rev'] * rng.uniform(0.8, 2.0)
    return c['rev'] * cap * rng.uniform(0.45, 0.8)

HINT_POS = {'top': (0.0, 0.08), 'big': (0.05, 0.3), 'mid': (0.3, 0.65), 'small': (0.7, 1.0)}
for ind, spec in IND.items():
    rows = [c for c in companies if c['industry'] == ind]
    target = spec[1] * 1000 * spec[4]  # $M
    fixed = sum(c['rev'] for c in rows if c['rev'] is not None)
    flex = [c for c in rows if c['rev'] is None]
    for c in flex:
        lo, hi = HINT_POS.get(c['hint'] or '', (0.0, 1.0))
        c['_pos'] = rng.uniform(lo, hi)
        if not c['named'] and c['hint'] is None:
            # bigger economies host the bigger companies (T)
            g = (float(countries[c['country']]['gdp_usd_bn']) / 23500) ** 0.35
            c['_pos'] = 0.5 * rng.random() + 0.5 * (1 - g)
    flex.sort(key=lambda c: c['_pos'])
    ws = [(k + 1) ** -1.0 * math.exp(rng.gauss(0, 0.15)) for k in range(len(flex))]
    ws.sort(reverse=True)
    rest = target - fixed
    if rest <= 0:
        raise SystemExit('fixed revenue over target in ' + ind)
    tot = sum(ws)
    for c, w in zip(flex, ws):
        c['rev'] = min(rest * w / tot, 0.22 * target)  # no company above 22% of its industry (T)
    if ind == 'Oil':  # Arrowhead must stay the smallest oil company (7.3.0)
        for c in flex:
            c['rev'] = max(c['rev'], 300)
for c in companies:
    c['rev'] = round(c['rev'], 1) if c['rev'] < 100 else round(c['rev'])
    if c['book'] is None:
        b = make_book(c)
        c['book'] = round(b, 1) if b < 100 else round(b)
    c['ev'] = est_value(c)

# Arrowhead check
oil = [c for c in companies if c['industry'] == 'Oil']
ah = by_key['arrowhead']
assert all(c is ah or (c['rev'] > ah['rev'] and c['ev'] > ah['ev']) for c in oil), 'Arrowhead not smallest'

# public flag for generated rows (T)
for c in companies:
    if c['named'] or c['gen_kind'] == 'rival':
        continue
    if c['industry'] == 'Black market' or c['rev'] < 40:
        c['public'] = 'N'
    else:
        c['public'] = 'Y' if rng.random() < (0.9 if c['rev'] > 2000 else 0.7) else 'N'

# ------------------------------------------------------------------ state firms (beyond the named ones)
n_state = sum(1 for c in companies if c['basis'] == 'state')
pool = [c for c in companies if not c['named'] and c['ctrl'] is None and c['industry'] in STATE_IND
        and c['country'] in STATE_COUNTRY]
pool.sort(key=lambda c: -STATE_COUNTRY[c['country']] * STATE_IND[c['industry']] * rng.uniform(0.5, 1.5))
for c in pool:
    if n_state >= STATE_TARGET:
        break
    if True:
        c['ctrl'] = c['country']
        c['basis'] = 'state'
        c['stake'] = 100 if c['public'] == 'N' else rng.choice([51, 55, 60, 67, 70, 75])
        c['notes'] = 'state firm'
        n_state += 1

# ------------------------------------------------------------------ characters
chars = [dict(ch) for ch in named.C]
char_by_key = {ch['key']: ch for ch in chars}
for ch in chars:
    ch['country'] = provinces[ch['origin_province']]['country']
    ch['region_group'] = named.GROUP.get(ch['key'], region_group(ch['country']))

# rival stakes on named rows with no stake yet, from wealth targets (T)
def rival_stake(c, W, n):
    """Stake so that the company holds a fair share of the rival's wealth."""
    d = W * 1000 * 0.85 / n  # $M
    s = d / c['ev'] * 100
    if c['public'] == 'N':
        return max(51, min(100, round(s))), 'majority'
    if s >= 50:
        return min(85, round(s)), 'majority'
    return max(10, min(49, round(s))), 'class_a'

def controlled(key):
    return [c for c in companies if c['ctrl'] == key]

# stakes for rival rows without one, from wealth targets (T)
for key, (n_total, pinds, pisos) in named.RICH_POOL.items():
    W = char_by_key[key]['wealth']
    n = len(controlled(key))
    for c in controlled(key):
        if c['stake'] is None:
            c['stake'], c['basis'] = rival_stake(c, W, n)

for c in companies:
    if c['ctrl'] and c['ctrl'] in char_by_key and c['stake'] is None:
        raise SystemExit('no stake for ' + c['name'])

# subsidiaries named with '@key'
for c in companies:
    if c['ctrl'] and c['ctrl'].startswith('@'):
        c['ctrl_company'] = c['ctrl'][1:]

# ------------------------------------------------------------------ holders
HOLDER_TOTAL = 200
TYPE_MONEY = {'founder': 'tech', 'heir': 'old', 'activist': 'old', 'oligarch': 'state-linked', 'criminal': 'criminal'}
MIX = {'old': .30, 'tech': .30, 'state-linked': .25, 'criminal': .15}
money_count = Counter(ch['money_type'] for ch in chars if ch['tier'] == 'holder')
holders_made = sum(1 for ch in chars if ch['tier'] == 'holder')

def stake_total(c):
    t = (c['stake'] or 0) if c['basis'] != 'subsidiary' else 100
    return t + sum(p for _, p in c['others'])

def holder_count_of(key):
    n = 0
    for c in companies:
        if c['ctrl'] == key and c['basis'] not in ('proxy', 'trust', 'state', 'subsidiary'):
            n += 1
        if c['record'] == key:
            n += 1
        n += sum(1 for k, _ in c['others'] if k == key)
    return n

STATEY = {'CHN', 'RUS', 'SAU', 'ARE', 'QAT', 'KAZ', 'IND', 'IDN', 'UKR', 'AZE', 'NGA', 'TUR', 'EGY', 'VNM', 'IRN',
          'MYS', 'THA', 'PAK', 'BRA', 'MEX', 'AGO', 'IRQ', 'KWT', 'DZA'}

def choose_type(c, controlling):
    opts = {'founder': 1.0, 'heir': 1.0, 'oligarch': 0.3, 'criminal': 0.15}
    if not controlling:
        opts['activist'] = 0.8
    if c['country'] in STATEY:
        opts['oligarch'] = 2.0
    if c['industry'] in ('Oil', 'Gas', 'Mining', 'Metals', 'Banking', 'Telecom', 'Construction', 'Power utilities'):
        opts['oligarch'] *= 1.8
        opts['founder'] *= 0.5
    if IND[c['industry']][0] == 'Tech':
        opts['founder'] *= 2.5
        opts['oligarch'] *= 0.5
    if c['industry'] in ('Gambling', 'Real estate', 'Logistics', 'Shipping', 'Fast food'):
        opts['criminal'] *= 3
    if c['industry'] == 'Black market':
        opts = {'criminal': 1.0}
    if c['basis'] == 'state':
        opts = {'oligarch': 1.0}
    tot_made = max(1, sum(money_count.values()))
    ws = {}
    for t, w in opts.items():
        m = TYPE_MONEY[t]
        deficit = MIX[m] * HOLDER_TOTAL - money_count[m]
        ws[t] = w * max(0.05, deficit / (MIX[m] * HOLDER_TOTAL))
    ts = list(ws)
    return rng.choices(ts, [ws[t] for t in ts])[0]

used_names = {ch['name'] for ch in chars}

def person_name(iso, female):
    cu = culture(iso)
    m, f, s = names.PEOPLE[cu]
    for _ in range(200):
        first = rng.choice(f if female else m)
        sur = rng.choice(s)
        n = f'{sur} {first}' if cu in names.FAMILY_FIRST else f'{first} {sur}'
        if n not in used_names:
            used_names.add(n)
            return n
    raise SystemExit('names exhausted for ' + cu)

SKILL_FOCUS = {'founder': (4, 3), 'heir': (0, 2), 'activist': (0, 2), 'oligarch': (3, 1), 'criminal': (3, 5)}
HOOKS = {
    'founder': ['Founded {co} in a garage in {yr} and never sold below {pct}%.',
                'Built {co} from nothing in {yr}; the board still fears the founder\'s veto.',
                'Started {co} in {yr} and now spends the money on stranger ideas.'],
    'heir': ['Inherited {pct}% of {co} from a grandparent who bought in early; has never worked there.',
             'Old money: the family has held {co} since before anyone can remember.',
             'Heir to the {sur} fortune, voting {pct}% of {co} through the family trust.'],
    'activist': ['Activist investor who bought {pct}% of {co} and wants the board replaced.',
                 'Runs a small activist fund; holds {pct}% of {co} and a list of demands.',
                 'Short seller turned long holder, with {pct}% of {co} and a grudge.'],
    'oligarch': ['Picked up {co} cheap in a privatization in {yr}, with help from friends in government.',
                 'A minister\'s old classmate whose {pct}% of {co} came with the right phone numbers.',
                 'Owns {pct}% of {co} thanks to a licence nobody else was allowed to bid for.'],
    'criminal': ['Holds {pct}% of {co} through cousins; the money did not start out clean.',
                 'Owns {co} on paper and a lot of other things off paper.',
                 'Launders through {co}, and pays its staff on time, always in cash.'],
}

def make_holder(c, kind):
    global holders_made
    iso = c['country']
    if kind == 'activist' and rng.random() < 0.5:
        iso = rng.choice(['USA', 'USA', 'GBR', 'USA', 'CHE', 'CAN', 'JPN', 'SGP', 'AUS', 'HKG'])
    if kind == 'oligarch' and c['basis'] == 'state':
        iso = c['country']
    female = rng.random() < 0.38
    pv = rng.choice(prov_by_country[iso])
    # prefer a city province for the origin
    cities = [p for p in prov_by_country[iso] if p['city_rank'] in ('Metropolis', 'City')]
    if cities and rng.random() < 0.8:
        pv = rng.choice(cities)
    age = {'founder': rng.randint(28, 62), 'heir': rng.randint(24, 80), 'activist': rng.randint(38, 72),
           'oligarch': rng.randint(42, 74), 'criminal': rng.randint(33, 70)}[kind]
    a, b = SKILL_FOCUS[kind]
    sk = [rng.randint(2, 11) for _ in range(6)]
    sk[a] += rng.randint(3, 8)
    sk[b] += rng.randint(2, 6)
    pairs = rng.sample(PAIRS, 3)
    traits = [rng.choice(p) for p in pairs]
    ideol = rng.choices(IDEOLOGIES, [20, 6, 10, 8, 8, 8, 15, 15, 10])[0]
    key = 'h%03d' % holders_made
    holders_made += 1
    m = TYPE_MONEY[kind]
    if kind == 'activist' and rng.random() < 0.3:
        m = 'tech'
    money_count[m] += 1
    ch = dict(key=key, name=person_name(iso, female), tier='holder', profile='', location=pv['name'],
              origin_province=pv['id'], age=age, money_type=m, skills=tuple(min(25, x) for x in sk), traits=traits,
              ideology=ideol, cash_usd=0, wealth=None, hook='', notes='', kind=kind, country=iso, female=female,
              region_group=region_group(iso))
    chars.append(ch)
    char_by_key[key] = ch
    return ch

def fill_hook(ch, c, pct):
    sur = ch['name'].split()[0 if culture(ch['country']) in names.FAMILY_FIRST else -1]
    t = rng.choice(HOOKS[ch['kind']])
    ch['hook'] = t.format(co=c['name'], pct=pct, yr=rng.randint(1975, 2016), sur=sur)
    if rng.random() < 0.5:
        q = rng.choice(names.QUIRKS)
        fem = ch.get('female')
        q = q.replace('himself or herself', 'herself' if fem else 'himself').replace('his or her', 'her' if fem else 'his')
        ch['hook'] += ' ' + ('She ' if fem else 'He ') + q + '.'

budget = HOLDER_TOTAL - holders_made
# minor holders stay minor: big private companies nobody controls are listed instead (T)
for c in companies:
    if c['ctrl'] is None and c['public'] == 'N' and not c['named'] and c['industry'] != 'Black market' and c['ev'] > 6000:
        c['public'] = 'Y'
HOLDER_CAP = 3000  # $M: the most one minor holder's stake is worth at start (T)
# 1) controlling slots: private generated rows nobody controls yet
ctrl_slots = [c for c in companies if c['ctrl'] is None and c['public'] == 'N' and not c['named']]
# 2) minority slots
minority = []
for c in companies:
    if c['public'] != 'Y' or c['basis'] == 'subsidiary':
        continue
    if c['ctrl'] is None and not c['others']:
        if rng.random() < 0.55:
            minority.append(c)
    elif c['ctrl'] in char_by_key and c['ctrl'] not in ('terry',):
        if rng.random() < 0.25:
            minority.append(c)
    elif c['basis'] == 'state' and c['stake'] < 80:
        if rng.random() < 0.35:
            minority.append(c)
minority = [c for c in minority if c['ev'] * 0.05 <= HOLDER_CAP]
rng.shuffle(minority)
assert len(ctrl_slots) <= budget, (len(ctrl_slots), budget)

def free_room(c):
    return 100 - stake_total(c)

def add_minority(ch, c, lo, hi):
    room = free_room(c) - 15  # keep a public float (T)
    hi = min(hi, int(100 * HOLDER_CAP / c['ev']))
    if room < lo or hi < lo:
        return None
    pct = rng.randint(lo, min(hi, room))
    c['others'].append((ch['key'], pct))
    return pct

second_pool = [c for c in companies if c['public'] == 'Y' and c['basis'] != 'subsidiary' and c['ev'] * 0.05 <= HOLDER_CAP]
for c in ctrl_slots:
    kind = choose_type(c, True)
    ch = make_holder(c, kind)
    pct = rng.randint(51, 60)
    c['ctrl'] = ch['key']
    c['stake'] = pct
    c['basis'] = 'majority'
    fill_hook(ch, c, pct)
    if rng.random() < 0.35:
        c2 = rng.choice([x for x in second_pool if region_group(x['country']) == ch['region_group']] or second_pool)
        if c2 is not c:
            add_minority(ch, c2, 5, 12)
for c in minority:
    if holders_made >= HOLDER_TOTAL:
        break
    kind = choose_type(c, False)
    ch = make_holder(c, kind)
    lo, hi = {'activist': (5, 10), 'founder': (8, 30), 'heir': (8, 35), 'oligarch': (5, 25), 'criminal': (5, 20)}[kind]
    pct = add_minority(ch, c, lo, hi)
    if pct is None:
        pct = add_minority(ch, rng.choice(second_pool), 5, 8)
    if pct is None:
        raise SystemExit('no room for holder')
    tgt = [x for x in companies if (x['ctrl'] == ch['key'] or any(k == ch['key'] for k, _ in x['others']))][0]
    fill_hook(ch, tgt, pct)
    if rng.random() < 0.4:
        c2 = rng.choice([x for x in second_pool if region_group(x['country']) == ch['region_group'] and x is not c] or second_pool)
        if c2 is not c:
            add_minority(ch, c2, 5, 12)
# if the budget is not used up, add holders to remaining widely held public companies
rest = [c for c in companies if c['public'] == 'Y' and c['ctrl'] is None and not c['others'] and c['ev'] * 0.05 <= HOLDER_CAP]
rng.shuffle(rest)
for c in rest:
    if holders_made >= HOLDER_TOTAL:
        break
    kind = choose_type(c, False)
    ch = make_holder(c, kind)
    pct = add_minority(ch, c, 5, 25)
    fill_hook(ch, c, pct)

# ------------------------------------------------------------------ funds: asset managers hold 1-6% in public companies (T)
funds = [c for c in companies if c['industry'] == 'Asset management' and c['ev'] > 200 and c['public'] in ('Y', 'N')]
for f in funds:
    n = int(min(25, 3 + f['ev'] / 3000))
    targets = [c for c in companies if c['public'] == 'Y' and c is not f and c['basis'] != 'subsidiary']
    if f['basis'] == 'state':  # sovereign funds prefer big foreign names
        targets.sort(key=lambda c: -c['ev'])
        targets = targets[:150]
    rng.shuffle(targets)
    for c in targets[:n]:
        if any(k == '@' + f['key'] for k, _ in c['others']):
            continue
        room = free_room(c) - 15
        if room >= 1:
            c['others'].append(('@' + f['key'], rng.randint(1, min(6, room))))

# ------------------------------------------------------------------ ids
chars.sort(key=lambda ch: {'player': 0, 'rival': 1, 'holder': 2}[ch['tier']])  # stable: keeps authoring order
for n, ch in enumerate(chars, 1):
    ch['id'] = 'CH-%04d' % n
for n, c in enumerate(companies, 1):
    c['id'] = 'CO-%04d' % n

used_t = set()
def ticker(name):
    words = [w for w in name.replace('-', ' ').replace("'", '').split() if w[0].isalpha()]
    letters = ''.join(ch for ch in name.upper() if ch.isalpha())
    cands = []
    if len(words) >= 2:
        cands.append(''.join(w[0] for w in words[:4]).upper())
        cands.append((words[0][:2] + words[1][:2]).upper())
        cands.append((words[0][:3] + words[1][0]).upper())
    cands.append(letters[:4])
    cands.append(letters[:3])
    for t in cands:
        if 3 <= len(t) <= 4 and t not in used_t:
            used_t.add(t)
            return t
    for _ in range(1000):
        t = (letters[0] + ''.join(rng.choice(letters[1:]) for _ in range(3)))
        if t not in used_t:
            used_t.add(t)
            return t
for c in companies:
    c['ticker'] = ticker(c['name']) if c['public'] == 'Y' else ''

# ------------------------------------------------------------------ resolve references
def ref(k):
    if k is None:
        return ''
    if k.startswith('@'):
        return by_key[k[1:]]['id']
    if k in char_by_key:
        return char_by_key[k]['id']
    if k in by_key:
        return by_key[k]['id']
    if k in countries:
        return k
    raise SystemExit('unknown ref ' + k)

# ------------------------------------------------------------------ wealth and cash
worth = defaultdict(float)
for c in companies:
    if c['ctrl'] in char_by_key:
        holder = c['record'] or c['ctrl']
        if c['basis'] in ('trust',):
            holder = None  # held by a trust or foundation, not the person
        if holder:
            worth[holder] += c['ev'] * c['stake'] / 100
    for k, p in c['others']:
        if k in char_by_key:
            worth[k] += c['ev'] * p / 100
for ch in chars:
    if ch['tier'] == 'holder' and ch['key'].startswith('h'):
        ch['cash_usd'] = int(max(500_000, worth[ch['key']] * 1e6 * rng.uniform(0.03, 0.15)) // 100_000 * 100_000)
    ch['net_worth'] = ch['cash_usd'] + worth[ch['key']] * 1e6

# ------------------------------------------------------------------ write
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'characters.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['id', 'name', 'tier', 'profile', 'superregion', 'region_group', 'country', 'origin_province', 'location', 'age',
                'money_type', 'finance', 'operations', 'persuasion', 'intrigue', 'tech', 'hustle', 'traits',
                'ideology', 'cash_usd', 'net_worth_est_usd', 'hook', 'notes'])
    for ch in chars:
        notes = ch['notes']
        if 'boss' in ch:
            notes = 'figurehead for %s (%s) (1.3.1) (A)' % (char_by_key[ch['boss']]['name'], char_by_key[ch['boss']]['id'])
        w.writerow([ch['id'], ch['name'], ch['tier'], ch['profile'], countries[ch['country']]['superregion'], ch['region_group'], ch['country'],
                    ch['origin_province'], ch['location'], ch['age'], ch['money_type'], *ch['skills'],
                    ';'.join(ch['traits']), ch['ideology'], ch['cash_usd'], int(round(ch['net_worth'], -5)),
                    ch['hook'], notes])
with open(os.path.join(OUT, 'companies.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['id', 'name', 'ticker', 'industry', 'hq_country', 'hq_province', 'public', 'revenue_usd_m',
                'book_value_usd_m', 'est_value_usd_m', 'controller', 'controller_stake_pct', 'control_basis',
                'owner_of_record', 'other_holders', 'notes'])
    for c in companies:
        ctrl = ref(c['ctrl']) if c['ctrl'] else ''
        basis = c['basis'] or 'widely_held'
        stake = c['stake'] if c['ctrl'] else ''
        ev = c['ev']
        others = ';'.join('%s:%s' % (ref(k), p)
                          for k, p in sorted(c['others'], key=lambda x: -x[1]))
        w.writerow([c['id'], c['name'], c['ticker'], c['industry'], c['country'], c['prov'], c['public'],
                    c['rev'], c['book'], round(ev, 1) if ev < 100 else round(ev), ctrl, stake, basis,
                    ref(c['record']) if c['record'] else '', others, c['notes']])
print('wrote', len(chars), 'characters and', len(companies), 'companies to', OUT)
