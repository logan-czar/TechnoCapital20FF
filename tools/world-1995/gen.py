#!/usr/bin/env python3
"""Generates the 1995 world into assets/worlds/1995 (docs/build/1995-rework-spec.md, 2 and 3.2).

Stage `proto` is the 2020 data scaled and cut to size, so the systems have a small world to run on
while they are built: countries folded (2.2), money scaled to about $30T of GDP (2.2), about 300
companies (2.2), no fixed events and no Arrowhead (3.2). The real 1995 values replace it in the
`real` stage (spec 10, P9), writing the same files.

Same input, same output: no random state, no clock.

    python tools/world-1995/gen.py [--stage proto]
"""
import csv
import importlib.util
import json
import math
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'docs' / 'design' / 'data'
OUT = ROOT / 'assets' / 'worlds' / '1995'
MVP_GEN = ROOT / 'docs' / 'design' / 'tools' / 'mvp-data' / 'gen.py'

START_DATE = '1995-01-01'
GDP_TARGET_USD_BN = 30000.0   # 1995-rework 2.2 (real 1995: about $31T)
COMPANY_TARGET = 300          # 1995-rework 2.2
PER_INDUSTRY_MIN = 5          # the largest of every industry stay, so each keeps named companies
BASE_RATE = 0.05              # 1995-rework 6.2 (real 1995 policy rates: about 5.5%)
NEUTRAL_RATE = 0.05
Y10_TERM = 0.01
CABINET_SEATS = 14            # 1995-rework 7.2: no Homeland Security until 2002
DROPPED_OFFICES = {'USO-HOMELAND'}
ARROWHEAD = 'Arrowhead Drilling'   # 1995-rework 7.7: not a fixed company in this world
PLAYER = 'John Techno'             # 1995-rework 7.7: spawns later, so controls nothing at the start

# 1995-rework 2.2: post-1995 states and sovereign parents' small territories. Independent 1995
# microstates and the dollar havens stay. Puerto Rico stays, since politics reads every USA
# province's region as a state.
FOLD = {
    'XKX': 'SRB', 'MNE': 'SRB', 'SSD': 'SDN', 'TLS': 'IDN',
    'GIB': 'GBR', 'IMN': 'GBR', 'FRO': 'DNK', 'GRL': 'DNK',
    'SPM': 'FRA', 'PAP': 'ARG', 'VAT': 'ITA', 'SMR': 'ITA',
}

# 1995-rework 2.4, 5.1: dormant industries. id: (window first, last, size on emerging $bn, wave min, max,
# trend, mature rate, fade half life in years). The early growth rates of a new market fade to mature.
DORMANT = {
    'e_commerce': (1995, 1998, 5.0, 3, 5, 0.62, 0.1, 8.0),
    'search_portals': (1996, 2000, 1.0, 2, 4, 0.76, 0.08, 5.0),
    'data_centers': (1997, 2003, 3.0, 2, 4, 0.45, 0.06, 6.0),
    'renewables': (1998, 2006, 5.0, 2, 4, 0.42, 0.08, 8.0),
    'saas': (1999, 2005, 3.0, 3, 5, 0.47, 0.1, 6.0),
    'social_media': (2002, 2008, 1.0, 2, 4, 1.04, 0.1, 4.0),
    'cloud': (2004, 2010, 3.0, 2, 4, 0.69, 0.15, 6.0),
    'evs': (2006, 2012, 2.0, 2, 3, 0.73, 0.12, 6.0),
    'drones': (2008, 2014, 0.5, 2, 3, 0.71, 0.08, 5.0),
    'ai_labs': (2012, 2018, 0.5, 2, 4, 1.54, 0.2, 6.0),
}

# 1995-rework 2.4: new rows. id: (name, sector, size at the start $bn, trend, mature, half life, asset
# label, name suffixes). Size 0 is dormant. Sunset rows have a flat or falling trend.
NEW_INDUSTRIES = {
    'computer_hardware': ('Computer hardware', 'Tech', 350, 0.0, 0.0, 0, 'assembly plants', ['Computer', 'Systems', 'Machines']),
    'media_publishing': ('Media and publishing', 'Services', 350, -0.005, -0.005, 0, 'presses and studios', ['Media', 'Press', 'Broadcasting']),
    'consumer_staples': ('Consumer staples and tobacco', 'Consumer', 900, 0.025, 0.025, 0, 'brands', ['Brands', 'Foods', 'Tobacco']),
    'conglomerates': ('Conglomerates and trading houses', 'Industry', 1500, 0.02, 0.02, 0, 'divisions', ['Holdings', 'Trading', 'Group']),
    'capital_goods': ('Capital goods', 'Industry', 900, 0.03, 0.03, 0, 'factories', ['Machinery', 'Heavy Industries', 'Electric']),
    'rail': ('Rail', 'Industry', 120, 0.0, 0.0, 0, 'rail lines', ['Rail', 'Railway', 'Northern']),
    'paper_forest': ('Paper and forest', 'Industry', 350, -0.005, -0.005, 0, 'mills', ['Paper', 'Timber', 'Forest']),
    'apparel': ('Apparel', 'Consumer', 400, 0.025, 0.025, 0, 'brands', ['Apparel', 'Sportswear', 'Mills']),
    'appliances': ('Appliances', 'Consumer', 150, 0.015, 0.015, 0, 'plants', ['Appliance', 'Home', 'Electric Home']),
    'travel_leisure': ('Travel and leisure', 'Consumer', 500, 0.05, 0.05, 0, 'resorts', ['Resorts', 'Hotels', 'Cruises']),
    'online_services': ('Online services', 'Tech', 5, 0.51, 0.02, 5.0, 'dial-up networks', ['Online', 'Net', 'Connect']),
    'wireless': ('Wireless', 'Tech', 40, 0.26, 0.04, 8.0, 'cell networks', ['Wireless', 'Cellular', 'Mobile']),
    'biotech': ('Biotech', 'Health', 15, 0.17, 0.07, 10.0, 'labs', ['Biotech', 'Genetics', 'Therapeutics']),
    'medical_devices': ('Medical devices', 'Health', 80, 0.07, 0.05, 15.0, 'plants', ['Medical', 'Devices', 'Surgical']),
    'search_portals': ('Search and portals', 'Tech', 0, 0.76, 0.08, 5.0, 'server farms', ['Search', 'Portal', 'Web']),
}
NEW_PER_INDUSTRY_SHARES = (0.12, 0.08, 0.05, 0.03)   # named revenue of a new row, largest first (T)
NEW_HQ_COUNTRIES = ('USA', 'JPN', 'DEU', 'GBR', 'FRA', 'USA', 'CAN', 'ITA', 'KOR', 'USA')   # (T)
NEW_NAME_PREFIXES = ('Ironbark', 'Redwater', 'Bluestem', 'Halyard', 'Meridian', 'Northgate', 'Stonebridge', 'Harrow',
                     'Calder', 'Wexford', 'Larkspur', 'Tidewater', 'Sable', 'Briar', 'Kestrel', 'Ashgrove')   # (T)

# 1995-rework 9: earnings multiples for the new rows, and the young markets investors pay up for (T).
# The other rows take the design's valuation groups (mvp-data/gen.py PE), which the MVP left unused.
EARNINGS_MULTIPLES = {
    'computer_hardware': 22, 'media_publishing': 16, 'consumer_staples': 20, 'conglomerates': 17,
    'capital_goods': 17, 'rail': 12, 'paper_forest': 11, 'apparel': 20, 'appliances': 17, 'travel_leisure': 20,
    'medical_devices': 25, 'wireless': 30, 'biotech': 40, 'online_services': 40,
}
YOUNG_MULTIPLE = 40   # every dormant row

# 1995-rework 2.4: cycle_beta, volatility, rate_sensitivity, margin_full_use by sector (T). The MVP
# gives every industry the same; the variable cost share takes up the margin's change.
SECTOR_PARAMS = {
    'Tech': (1.3, 0.02, 0.8, 0.11),
    'Finance': (1.1, 0.012, 1.5, 0.09),
    'Energy': (0.8, 0.02, 0.6, 0.08),
    'Industry': (1.1, 0.012, 1.2, 0.07),
    'Consumer': (0.7, 0.008, 0.8, 0.07),
    'Health': (0.4, 0.008, 0.3, 0.10),
    'Services': (0.9, 0.01, 1.0, 0.07),
}

REGION_SLUGS = ['east-asia-oceania', 'europe', 'latin-america', 'mena', 'north-america',
                'russia-central-asia', 'south-asia', 'sub-saharan-africa']


def read(path):
    with open(path, encoding='utf-8', newline='') as fh:
        r = csv.DictReader(fh)
        return list(r.fieldnames), list(r)


def write(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=fields, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)


def num(x, places=3):
    """A CSV number: fixed places, no trailing zeros, so the file is the same on every run."""
    s = f'{x:.{places}f}'
    return s.rstrip('0').rstrip('.') if '.' in s else s


def build_countries():
    fields, rows = read(SRC / 'countries.csv')
    by_iso = {r['iso3']: r for r in rows}
    for child, parent in FOLD.items():
        c, p = by_iso[child], by_iso[parent]
        p['gdp_usd_bn'] = str(float(p['gdp_usd_bn']) + float(c['gdp_usd_bn']))
        p['population_m'] = str(float(p['population_m']) + float(c['population_m']))
        p['provinces_planned'] = str(int(p['provinces_planned']) + int(c['provinces_planned']))
    kept = [r for r in rows if r['iso3'] not in FOLD]
    total = sum(float(r['gdp_usd_bn']) for r in kept)
    scale = GDP_TARGET_USD_BN / total
    for r in kept:
        r['gdp_usd_bn'] = num(float(r['gdp_usd_bn']) * scale)
        r['population_m'] = num(float(r['population_m']))
        if r['subject_of'] in FOLD:
            r['subject_of'] = FOLD[r['subject_of']]
    write(OUT / 'countries.csv', fields, kept)
    return kept, scale


def build_country_tables(countries):
    fields, rows = read(SRC / 'country-economy.csv')
    economy = [r for r in rows if r['iso3'] not in FOLD]
    for r in economy:
        if r['iso3'] == 'USA':
            r['corp_tax_rate'] = US_CORP_TAX_1995
    write(OUT / 'country-economy.csv', fields, economy)

    fields, rows = read(SRC / 'names' / 'country-cultures.csv')
    write(OUT / 'names' / 'country-cultures.csv', fields, [r for r in rows if r['iso3'] not in FOLD])

    gdp = {c['iso3']: float(c['gdp_usd_bn']) for c in countries}
    world = sum(gdp.values())
    fields, zones = read(SRC / 'financial-zones.csv')
    for z in zones:
        members = [e['iso3'] for e in economy if e['financial_zone'] == z['zone_id']]
        zone_gdp = sum(gdp[m] for m in members)
        z['countries'] = str(len(members))
        z['gdp_usd_bn'] = num(zone_gdp, 1)
        z['gdp_share'] = num(zone_gdp / world, 4)
    write(OUT / 'financial-zones.csv', fields, zones)
    return economy, zones


def build_provinces():
    for slug in REGION_SLUGS:
        fields, rows = read(SRC / f'provinces-{slug}.csv')
        for r in rows:
            r['country'] = FOLD.get(r['country'], r['country'])
        write(OUT / f'provinces-{slug}.csv', fields, rows)


def build_industries(scale):
    fields, rows = read(SRC / 'industries.csv')
    template = rows[0]
    for r in rows:
        r['world_size_2020_usd_bn'] = num(float(r['world_size_2020_usd_bn']) * scale)
        r['fade_half_life_years'] = '0'   # a row live from the start keeps its trend (T)
        r['boom_uplift'] = '0'            # 3.2: no AI boom in this world
        r['crash_drop'] = '0'
    for key, (name, sector, size, trend, mature, half, label, _) in NEW_INDUSTRIES.items():
        row = dict(template)
        row.update(id=key, name=name, sector=sector, world_size_2020_usd_bn=str(size), trend_growth=str(trend),
                   mature_rate=str(mature), fade_half_life_years=str(half), boom_uplift='0', crash_drop='0',
                   asset_label=label, notes='1995-rework 2.4 (T)')
        rows.append(row)
    mvp = load_mvp()
    for r in rows:
        if r['id'] in DORMANT:
            r['earnings_multiple'] = str(YOUNG_MULTIPLE)
        elif r['id'] in EARNINGS_MULTIPLES:
            r['earnings_multiple'] = str(EARNINGS_MULTIPLES[r['id']])
        else:
            r['earnings_multiple'] = str(mvp.PE[mvp.VGROUP[r['name']]])
        if r['id'] in DORMANT:
            *_, trend, mature, half = DORMANT[r['id']]
            r.update(world_size_2020_usd_bn='0', trend_growth=str(trend), mature_rate=str(mature),
                     fade_half_life_years=str(half))
        beta, vol, rate, margin = SECTOR_PARAMS[r['sector']]
        total = float(r['margin_full_use']) + float(r['variable_cost_share'])
        r.update(cycle_beta=str(beta), volatility=str(vol), rate_sensitivity=str(rate),
                 margin_full_use=str(margin), variable_cost_share=num(total - margin, 6))
    write(OUT / 'industries.csv', fields, sorted(rows, key=lambda r: r['id']))
    write(OUT / 'industry-lifecycle.csv',
          ['id', 'window_first', 'window_last', 'target_size_usd_bn', 'wave_min', 'wave_max'],
          [dict(id=k, window_first=v[0], window_last=v[1], target_size_usd_bn=v[2], wave_min=v[3], wave_max=v[4])
           for k, v in sorted(DORMANT.items())])
    fields, suffixes = read(SRC / 'names' / 'industry-suffixes.csv')
    for _, (name, *_rest, words) in NEW_INDUSTRIES.items():
        suffixes.extend(dict(industry=name, suffix=w) for w in words)
    write(OUT / 'names' / 'industry-suffixes.csv', fields, suffixes)
    return rows


def new_companies(rows, fields, provinces_by_country):
    """Proto firms for the new live rows: a few named companies a row, listed, widely held. The real
    ones replace them (spec 10, P9b)."""
    out = []
    used = set()
    n = 0
    for key, (name, _, size, _t, _m, _h, _l, words) in NEW_INDUSTRIES.items():
        if size == 0:
            continue
        for k, share in enumerate(NEW_PER_INDUSTRY_SHARES):
            prefix = NEW_NAME_PREFIXES[n % len(NEW_NAME_PREFIXES)]
            country = NEW_HQ_COUNTRIES[n % len(NEW_HQ_COUNTRIES)]
            label = f'{prefix} {words[k % len(words)]}'
            n += 1
            assert label not in used, label
            used.add(label)
            revenue = size * 1000.0 * share
            row = {f: '' for f in fields}
            row.update(id=f'CO-9{n:03d}', name=label, ticker=f'N{n:03d}', industry=name, hq_country=country,
                       hq_province=provinces_by_country[country], public='Y', revenue_usd_m=num(revenue),
                       book_value_usd_m=num(revenue * 0.5), est_value_usd_m=num(revenue * 0.8),
                       control_basis='widely_held', notes='proto (1995-rework 10, P9b)')
            out.append(row)
    return out


def select_companies(rows, economy, target):
    """About COMPANY_TARGET companies: the largest per industry, the largest listed of any zone left
    with none, then the largest overall, with each kept subsidiary's parent."""
    _, characters = read(SRC / 'characters.csv')
    player = next(c['id'] for c in characters if c['name'] == PLAYER)
    dormant = {r['name'] for r in read(SRC / 'industries.csv')[1] if r['id'] in DORMANT}
    pool = [r for r in rows if r['name'] != ARROWHEAD and r['controller'] != player and r['industry'] not in dormant]
    by_size = sorted(pool, key=lambda r: (-float(r['revenue_usd_m']), r['id']))
    kept = {}

    def keep(r):
        kept[r['id']] = r
        parent = r['controller']
        if parent.startswith('CO-') and parent not in kept:
            keep(next(p for p in pool if p['id'] == parent))

    seen = {}
    for r in by_size:
        n = seen.get(r['industry'], 0)
        if n < PER_INDUSTRY_MIN:
            keep(r)
            seen[r['industry']] = n + 1
    zone_of = {e['iso3']: e['financial_zone'] for e in economy}
    zone_of.update({child: zone_of[parent] for child, parent in FOLD.items()})
    listed = {zone_of[r['hq_country']] for r in kept.values() if r['public'] == 'Y'}
    for r in by_size:
        z = zone_of[r['hq_country']]
        if r['public'] == 'Y' and z not in listed:
            keep(r)
            listed.add(z)
    for r in by_size:
        if len(kept) >= target:
            break
        keep(r)
    return sorted(kept.values(), key=lambda r: r['id'])


def build_companies(economy, scale):
    """The kept companies, renumbered from CO-0001: a born company's key is the table length plus
    one (births/jobs.ts `companyKey`), so the ids must have no gaps."""
    fields, rows = read(SRC / 'companies.csv')
    by_country = {}
    for r in rows:
        by_country.setdefault(r['hq_country'], r['hq_province'])
    new = new_companies(rows, fields, by_country)
    kept = select_companies(rows, economy, COMPANY_TARGET - len(new)) + new
    new_id = {r['id']: f'CO-{i + 1:04d}' for i, r in enumerate(kept)}

    def holders(text):
        parts = []
        for part in text.split(';'):
            ref = part.split(':')[0]
            if ref.startswith('CO-'):
                if ref in new_id:
                    parts.append(part.replace(ref, new_id[ref], 1))
            elif part:
                parts.append(part)
        return ';'.join(parts)

    for r in kept:
        r['id'] = new_id[r['id']]
        r['hq_country'] = FOLD.get(r['hq_country'], r['hq_country'])
        for col in ('revenue_usd_m', 'book_value_usd_m', 'est_value_usd_m'):
            if r[col] != '':
                r[col] = num(float(r[col]) * scale)
        if r['controller'].startswith('CO-'):
            r['controller'] = new_id[r['controller']]
        if r['owner_of_record'].startswith('CO-'):
            r['owner_of_record'] = new_id.get(r['owner_of_record'], '')
        r['other_holders'] = holders(r['other_holders'])
    # 1995-rework 7.8: each named controller runs one company, since each company ages its own copy.
    seen = set()
    for r in sorted(kept, key=lambda r: (-float(r['revenue_usd_m']), r['id'])):
        if r['controller'].startswith('CH-'):
            if r['controller'] in seen:
                r['controller'] = ''
                r['controller_stake_pct'] = ''
                r['control_basis'] = 'widely_held'
            seen.add(r['controller'])
    write(OUT / 'companies.csv', fields, kept)
    return kept


def copy_unchanged():
    for name in ['ai-boom.csv', 'key-cities.csv']:
        (OUT / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SRC / name, OUT / name)
    for slug in REGION_SLUGS:
        (OUT / 'names').mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SRC / 'names' / f'{slug}.csv', OUT / 'names' / f'{slug}.csv')
    fields, _ = read(SRC / 'startup-events.csv')
    write(OUT / 'startup-events.csv', fields, [])   # 3.2: no fixed events
    fields, rows = read(SRC / 'politics-usa-offices.csv')
    write(OUT / 'politics-usa-offices.csv', fields, [r for r in rows if r['id'] not in DROPPED_OFFICES])


# 1995-rework 8.3: the run ends here.
REVEAL_DATE = '2020-01-01'

# 1995-rework 7.5: the federal rate the levers start from.
US_CORP_TAX_1995 = '0.35'

# 1995-rework 7.2: state: (1990-census House seats, 1992 Dem margin in points, census region,
# Democratic House seats and Democratic senators on 3 January 1995, 1990 and 2010 census population).
# House counts treat Vermont's independent as a Democrat. Checked against the 104th Congress roster
# on Wikipedia, 1 November 2026. Margins and populations are from memory of the official results.
POLITICS_1995 = {
    'Alabama': (7, -6.8, 'South', 4, 1, 4040587, 4779736),
    'Alaska': (1, -9.2, 'West', 0, 0, 550043, 710231),
    'Arizona': (6, -1.9, 'West', 1, 0, 3665228, 6392017),
    'Arkansas': (4, 17.7, 'South', 2, 2, 2350725, 2915918),
    'California': (52, 13.4, 'West', 27, 2, 29760021, 37253956),
    'Colorado': (6, 4.3, 'West', 2, 1, 3294394, 5029196),
    'Connecticut': (6, 6.4, 'Northeast', 3, 2, 3287116, 3574097),
    'Delaware': (1, 8.2, 'South', 0, 1, 666168, 897934),
    'District of Columbia': (0, 75.6, 'South', 0, 0, 606900, 601723),
    'Florida': (23, -1.9, 'South', 8, 1, 12937926, 18801310),
    'Georgia': (11, 0.6, 'South', 4, 1, 6478216, 9687653),
    'Hawaii': (2, 12.9, 'West', 2, 2, 1108229, 1360301),
    'Idaho': (2, -13.6, 'West', 0, 0, 1006749, 1567582),
    'Illinois': (20, 14.2, 'Midwest', 10, 2, 11430602, 12830632),
    'Indiana': (10, -6.1, 'Midwest', 4, 0, 5544159, 6483802),
    'Iowa': (5, 6.0, 'Midwest', 0, 1, 2776755, 3046355),
    'Kansas': (4, -5.1, 'Midwest', 0, 0, 2477574, 2853118),
    'Kentucky': (6, 3.2, 'South', 2, 1, 3685296, 4339367),
    'Louisiana': (7, 4.6, 'South', 4, 2, 4219973, 4533372),
    'Maine': (2, 8.3, 'Northeast', 1, 0, 1227928, 1328361),
    'Maryland': (8, 14.2, 'South', 4, 2, 4781468, 5773552),
    'Massachusetts': (10, 18.5, 'Northeast', 8, 2, 6016425, 6547629),
    'Michigan': (16, 7.4, 'Midwest', 9, 1, 9295297, 9883640),
    'Minnesota': (8, 11.6, 'Midwest', 6, 1, 4375099, 5303925),
    'Mississippi': (5, -8.9, 'South', 4, 0, 2573216, 2967297),
    'Missouri': (9, 10.2, 'Midwest', 6, 0, 5117073, 5988927),
    'Montana': (1, 2.5, 'West', 1, 1, 799065, 989415),
    'Nebraska': (3, -17.2, 'Midwest', 0, 2, 1578385, 1826341),
    'Nevada': (2, 2.6, 'West', 0, 2, 1201833, 2700551),
    'New Hampshire': (2, 1.2, 'Northeast', 0, 0, 1109252, 1316470),
    'New Jersey': (13, 2.4, 'Northeast', 5, 2, 7730188, 8791894),
    'New Mexico': (3, 8.6, 'West', 1, 1, 1515069, 2059179),
    'New York': (31, 15.9, 'Northeast', 17, 1, 17990455, 19378102),
    'North Carolina': (12, -0.8, 'South', 4, 0, 6628637, 9535483),
    'North Dakota': (1, -12.0, 'Midwest', 1, 2, 638800, 672591),
    'Ohio': (19, 1.8, 'Midwest', 6, 1, 10847115, 11536504),
    'Oklahoma': (6, -8.6, 'South', 1, 0, 3145585, 3751351),
    'Oregon': (5, 9.9, 'West', 3, 0, 2842321, 3831074),
    'Pennsylvania': (21, 9.0, 'Northeast', 11, 0, 11881643, 12702379),
    'Rhode Island': (2, 18.0, 'Northeast', 2, 1, 1003464, 1052567),
    'South Carolina': (6, -8.1, 'South', 2, 1, 3486703, 4625364),
    'South Dakota': (1, -3.5, 'Midwest', 1, 1, 696004, 814180),
    'Tennessee': (9, 4.7, 'South', 4, 0, 4877185, 6346105),
    'Texas': (30, -3.5, 'South', 19, 0, 16986510, 25145561),
    'Utah': (3, -18.7, 'West', 1, 0, 1722850, 2763885),
    'Vermont': (1, 15.7, 'Northeast', 1, 1, 562758, 625741),
    'Virginia': (11, -4.4, 'South', 6, 1, 6187358, 8001024),
    'Washington': (9, 11.4, 'West', 2, 1, 4866692, 6724540),
    'West Virginia': (3, 13.0, 'South', 3, 2, 1793477, 1852994),
    'Wisconsin': (9, 4.4, 'Midwest', 3, 2, 4891769, 5686986),
    'Wyoming': (1, -5.6, 'West', 0, 0, 453588, 563626),
}

# A state's lean is its margin against the nation's: the vote adds each year's own swing, and with
# 1992's Democratic win left in, Democrats held the House and presidency for most of a run (D998).
NATIONAL_MARGIN_1992 = 5.6

# 2020's name book has 24 surnames, too few for a Congress: the politics screen repeats them (7.2).
US_CULTURE = 'anglo'
US_MORE_MALE = ('Adam Alan Albert Andrew Anthony Arthur Benjamin Bruce Carl Charles Christopher Craig Daniel '
                'Dennis Donald Douglas Edward Eric Eugene Frank Fred Gary George Gerald Gregory Harold Henry '
                'Howard Jack Jeffrey Jerry Joe Jonathan Joseph Keith Kenneth Larry Lawrence Leonard Louis '
                'Mark Martin Matthew Nathan Patrick Paul Peter Philip Ralph Raymond Richard Roger Ronald '
                'Russell Samuel Scott Stanley Stephen Steven Terry Thomas Timothy Vincent Walter Wayne').split()
US_MORE_FEMALE = ('Alice Amanda Amy Andrea Angela Ann Anne Barbara Betty Beverly Bonnie Brenda Carol Carolyn '
                  'Catherine Cheryl Christine Cynthia Dana Deborah Denise Diane Donna Doris Dorothy Elaine '
                  'Elizabeth Ellen Evelyn Frances Gail Gloria Helen Irene Janet Janice Jean Joan Joyce Judith '
                  'Julia Karen Kathleen Katherine Laura Lillian Linda Lois Margaret Maria Marie Marilyn '
                  'Martha Mary Michelle Nancy Pamela Patricia Paula Rebecca Rita Rose Ruth Sandra Sharon '
                  'Shirley Stephanie Susan Teresa Theresa Virginia Wanda').split()
US_MORE_SURNAMES = ('Abbott Adkins Aldrich Alvarez Andrews Armstrong Atkins Austin Avery Bailey Baldwin Ballard '
                    'Barber Barlow Barnes Barrett Bates Baxter Beck Bell Bennett Benson Bishop Blair Blake '
                    'Bowen Bowman Boyd Bradford Bradley Brady Brennan Brewer Briggs Brock Bryant Buchanan '
                    'Burgess Burke Burnett Burton Butler Caldwell Campbell Cannon Carlson Carpenter Carroll '
                    'Carson Casey Chambers Chandler Chapman Christensen Clayton Cobb Coleman Collins Conner '
                    'Conway Cooper Copeland Cortez Crawford Cross Cummings Curtis Daniels Davidson Dawson '
                    'Dean Delgado Dennis Dixon Donovan Dorsey Douglas Doyle Drake Duncan Dunn Edwards Elliott '
                    'Ellis Emerson Erickson Estrada Evans Farmer Ferguson Fields Fisher Fitzgerald Fleming '
                    'Fletcher Flynn Ford Foster Fowler Francis Franklin Frazier Freeman Fuller Gallagher '
                    'Gardner Garrett Gibbs Gibson Gilbert Glover Goodman Gordon Graham Grant Graves Gregory '
                    'Griffin Griffith Guerrero Hale Hammond Hampton Hancock Hardy Harmon Harper Harrington '
                    'Hart Harvey Hawkins Hayes Henderson Hicks Higgins Hodges Hoffman Holland Holloway '
                    'Holmes Hopkins Horton Houston Howell Hubbard Hudson Hughes Hunter Ingram Jacobs Jenkins '
                    'Jennings Jensen Keller Kelley Kennedy Kerr Kirk Knight Lambert Lane Lawson Leonard '
                    'Lindsey Little Lloyd Logan Love Lowe Lynch Mack Malone Mann Manning Marsh Marshall '
                    'Mason Mathews Maxwell May McCarthy McCoy McDaniel McGee McKenzie McKinney Meyer Miles '
                    'Mills Montgomery Moody Morrison Morse Morton Moss Mullins Murphy Nash Neal Newman '
                    'Newton Nichols Norman Norris Obrien Oliver Olson Osborne Owens Padilla Palmer Parsons '
                    'Patterson Patton Paul Payne Pearson Perkins Peters Peterson Phelps Pierce Porter Potter '
                    'Powell Pratt Quinn Ramsey Reese Reeves Reynolds Rhodes Rice Richards Riley Robbins '
                    'Rogers Rose Ross Rowe Rush Russell Ryan Sanders Saunders Schmidt Schneider Schultz '
                    'Shaw Shelton Sherman Simmons Simpson Sims Singleton Snyder Spencer Stanley Steele '
                    'Stephens Stevens Stewart Stone Sullivan Sutton Swanson Tate Terry Thornton Todd Tucker '
                    'Tyler Vaughn Wade Wagner Wallace Walsh Walters Warner Warren Watkins Watson Watts '
                    'Weaver Webb Weber Welch Wells West Wheeler Whitney Wilkins Wilkinson Willis Wolfe '
                    'Woods Wyatt Yates York').split()


# 1995-rework 7.7: characters.csv's ages are 2020's. A character who runs a company at the start is
# at least this old in 1995, and a founder at least this old on spawning, except the one below.
START_CONTROLLER_MIN_AGE = 30
FOUNDER_MIN_AGE = 22
SPAWN_WINDOW_YEARS = 8
FIRST_SPAWN_YEAR = 1996
LAST_SPAWN_YEAR = 2019
YEARS_BEFORE_2020 = 25
# John Techno, 22 in 2020, can spawn from 18, in any sector: he has no company in the 2020 data to
# read one from (7.7).
PLAYER_MIN_AGE = 18


def build_characters():
    """characters.csv at 1995's ages, and who spawns when (1995-rework 7.7)."""
    fields, rows = read(SRC / 'characters.csv')
    companies = read(OUT / 'companies.csv')[1]
    start = {c['controller'] for c in companies}
    age_2020 = {r['id']: int(r['age']) for r in rows}
    for r in rows:
        floor = START_CONTROLLER_MIN_AGE if r['id'] in start else PLAYER_MIN_AGE
        r['age'] = max(floor, int(r['age']) - YEARS_BEFORE_2020)
    write(OUT / 'characters.csv', fields, rows)

    sectors = {i['name']: i['sector'] for i in read(SRC / 'industries.csv')[1]}
    largest = {}
    for c in sorted(read(SRC / 'companies.csv')[1], key=lambda c: (-float(c['revenue_usd_m'] or 0), c['id'])):
        if c['controller'].startswith('CH-'):
            largest.setdefault(c['controller'], c)
    spawns = []
    for r in rows:
        player = r['name'] == PLAYER
        if r['id'] in start or not (player or r['id'] in largest):
            continue
        age = age_2020[r['id']]
        floor = PLAYER_MIN_AGE if player else FOUNDER_MIN_AGE
        first = min(LAST_SPAWN_YEAR, max(FIRST_SPAWN_YEAR, 2020 - (age - floor)))
        spawns.append({
            'id': r['id'],
            'spawn_first': first,
            'spawn_last': min(LAST_SPAWN_YEAR, first + SPAWN_WINDOW_YEARS),
            'born_year': 2020 - age,
            'superregion': r['superregion'],
            'sector': '' if player else sectors[largest[r['id']]['industry']],
        })
    write(OUT / 'character-spawns.csv', list(spawns[0].keys()), spawns)


def build_politics():
    """politics-usa.csv with 1990-census seats and 1992 leans, and the era table (1995-rework 7.2)."""
    fields, rows = read(SRC / 'politics-usa.csv')
    era = []
    for r in rows:
        seats, margin, region, house_dem, senate_dem, pop_1990, pop_2010 = POLITICS_1995[r['state']]
        r['house_seats'] = seats
        r['dem_margin_pts'] = num(margin - NATIONAL_MARGIN_1992)
        r['notes'] = '1990 census seats; 1992 presidential margin against the nation'
        growth = math.log(pop_2010 / pop_1990) / (2010 - 1990)
        era.append({
            'state': r['state'],
            'census_region': region,
            'start_house_dem': house_dem,
            'start_senate_dem': senate_dem,
            'pop_1990_m': num(pop_1990 / 1e6),
            'pop_growth': f'{growth:.6f}',
        })
    write(OUT / 'politics-usa.csv', fields, rows)
    write(OUT / 'politics-usa-era.csv', list(era[0].keys()), era)


def extend_us_names():
    """More names for the USA's culture, after the rows it already has (1995-rework 7.2)."""
    path = OUT / 'names' / 'north-america.csv'
    fields, rows = read(path)
    have = {(r['culture'], r['kind'], r['name']) for r in rows}
    family_first = next(r['family_first'] for r in rows if r['culture'] == US_CULTURE)
    for kind, names in (('male', US_MORE_MALE), ('female', US_MORE_FEMALE), ('surname', US_MORE_SURNAMES)):
        for name in names:
            if (US_CULTURE, kind, name) not in have:
                rows.append({'culture': US_CULTURE, 'family_first': family_first, 'kind': kind, 'name': name})
                have.add((US_CULTURE, kind, name))
    write(path, fields, rows)


def load_mvp():
    """The 2020 generator as a module; its path comes from argv at import."""
    argv = sys.argv
    sys.argv = [argv[0], str(ROOT / 'docs' / 'design')]
    try:
        spec = importlib.util.spec_from_file_location('mvp_gen', MVP_GEN)
        mvp = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mvp)
    finally:
        sys.argv = argv
    return mvp


def build_company_start(economy, zones):
    """company-start.csv by the 2020 generator's own rule, reading the files just written."""
    mvp = load_mvp()
    mvp.DATA = str(OUT)
    mvp.FV_Y10_BASE = BASE_RATE + Y10_TERM   # 6.2: starting prices at this world's rates
    rows = mvp.build_company_start(economy, zones)
    write(OUT / 'company-start.csv', list(rows[0].keys()), rows)
    return rows


def write_manifest(counts):
    manifest = {
        'id': '1995',
        'start_date': START_DATE,
        'reveal_date': REVEAL_DATE,
        'expected_counts': counts,
        'base_rate': BASE_RATE,
        'neutral_rate': NEUTRAL_RATE,
        'y10_term': Y10_TERM,
        'cabinet_seats': CABINET_SEATS,
        'features': {'era': True, 'ai_boom': False, 'fixed_events': False, 'arrowhead': False},
    }
    with open(OUT / 'manifest.json', 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')


def count_rows(name):
    return len(read(OUT / name)[1])


def main():
    if sys.argv[1:] not in ([], ['--stage', 'proto']):
        sys.exit(__doc__)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    countries, scale = build_countries()
    economy, zones = build_country_tables(countries)
    build_provinces()
    build_industries(scale)
    build_companies(economy, scale)
    copy_unchanged()
    build_characters()
    build_politics()
    extend_us_names()
    build_company_start(economy, zones)
    write_manifest({
        'countries': count_rows('countries.csv'),
        'provinces': sum(count_rows(f'provinces-{s}.csv') for s in REGION_SLUGS),
        'companies': count_rows('companies.csv'),
        'characters': count_rows('characters.csv'),
        'industries': count_rows('industries.csv'),
        'country-economy': count_rows('country-economy.csv'),
        'financial-zones': count_rows('financial-zones.csv'),
        'ai-boom': count_rows('ai-boom.csv'),
        'key-cities': count_rows('key-cities.csv'),
        'company-start': count_rows('company-start.csv'),
        'startup-events': 0,
        'politics-usa': count_rows('politics-usa.csv'),
        'politics-usa-offices': count_rows('politics-usa-offices.csv'),
    })
    print(f'wrote {OUT}: {count_rows("countries.csv")} countries, {count_rows("companies.csv")} companies')


if __name__ == '__main__':
    main()
