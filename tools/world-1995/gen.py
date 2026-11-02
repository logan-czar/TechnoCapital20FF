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
    write(OUT / 'companies.csv', fields, kept)
    return kept


def copy_unchanged():
    for name in ['characters.csv', 'ai-boom.csv', 'key-cities.csv', 'politics-usa.csv']:
        (OUT / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SRC / name, OUT / name)
    for slug in REGION_SLUGS:
        (OUT / 'names').mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SRC / 'names' / f'{slug}.csv', OUT / 'names' / f'{slug}.csv')
    fields, _ = read(SRC / 'startup-events.csv')
    write(OUT / 'startup-events.csv', fields, [])   # 3.2: no fixed events
    fields, rows = read(SRC / 'politics-usa-offices.csv')
    write(OUT / 'politics-usa-offices.csv', fields, [r for r in rows if r['id'] not in DROPPED_OFFICES])


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
