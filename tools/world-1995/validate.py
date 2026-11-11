#!/usr/bin/env python3
"""Checks assets/worlds/1995 (docs/build/1995-rework-spec.md, 2 and 3.2). The load-time checks in
sim-data cover what every world shares; this adds what is particular to this world and its
generator. Prints each problem and then OK or a count; exits non-zero on any problem.

    python tools/world-1995/validate.py
"""
import csv
import importlib.util
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'docs' / 'design' / 'data'
OUT = ROOT / 'assets' / 'worlds' / '1995'

GDP_TARGET_USD_BN = 31338.0   # 1995-rework 2.2: the World Bank's 1995 world
GDP_TOLERANCE = 0.03
SOURCED_TOLERANCE = 0.2       # 1995-rework 2.5
AUTHORING = Path(__file__).resolve().parent / 'authoring'
AUTHORED_MIN = 100
ORDINARY_WORDS = {'Metro', 'BT', 'Baxter'}
COMPANY_RANGE = (280, 320)
HOUSE_SEATS = 435
START_DEMS = (205, 47)   # 1995-rework 7.2: the 104th Congress, Vermont's independent as a Democrat
PROVINCES = 3963
RUN_YEARS = 25
ZONE_TRACK_MAX = 0.15   # sim-data checks.ts ZONE_TRACK_MAX
# The county tables (pivot 5.1): tools/world-1995/counties builds and checks them; real place names.
COUNTY_FILES = {'counties.csv', 'county-adjacency.csv'}
REGION_SLUGS = ['east-asia-oceania', 'europe', 'latin-america', 'mena', 'north-america',
                'russia-central-asia', 'south-asia', 'sub-saharan-africa']


def read(path):
    with open(path, encoding='utf-8', newline='') as fh:
        return list(csv.DictReader(fh))


def county_errors():
    """tools/world-1995/counties/validate.py's problems with the county tables (pivot 5.1, 5.4)."""
    path = Path(__file__).resolve().parent / 'counties' / 'validate.py'
    spec = importlib.util.spec_from_file_location('counties_validate', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.check()


def main():
    errors = []
    manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['id'] != '1995' or manifest['start_date'] != '1995-01-01':
        errors.append('manifest: not the 1995 world')
    if manifest['features'] != {'era': True, 'ai_boom': False, 'fixed_events': False, 'arrowhead': False,
                                'counties': True, 'usa_only': True}:
        errors.append('manifest: expected an era world cut to the USA with counties and no scripted parts, '
                      f'got {manifest["features"]}')
    errors += county_errors()

    countries = read(OUT / 'countries.csv')
    isos = {c['iso3'] for c in countries}
    gdp = sum(float(c['gdp_usd_bn']) for c in countries)
    if abs(gdp - GDP_TARGET_USD_BN) > GDP_TOLERANCE * GDP_TARGET_USD_BN:
        errors.append(f'countries: world GDP is ${gdp:,.0f}B, not about ${GDP_TARGET_USD_BN:,.0f}B')

    provinces = [p for s in REGION_SLUGS for p in read(OUT / f'provinces-{s}.csv')]
    source_ids = {p['id'] for s in REGION_SLUGS for p in read(SRC / f'provinces-{s}.csv')}
    ids = {p['id'] for p in provinces}
    if len(provinces) != PROVINCES or ids != source_ids:
        errors.append(f'provinces: {len(provinces)} rows, and the ids must be the map\'s {PROVINCES}')
    errors += [f'{p["id"]}: unknown country {p["country"]}' for p in provinces if p['country'] not in isos]
    # 1995-rework 2.5: the 1995 province scores are in, each with its source.
    by_id = {p['id']: p for p in provinces}
    for s in read(AUTHORING / 'provinces-1995.csv'):
        p = by_id.get(s['id'])
        if p is None or p['name'] != s['name']:
            errors.append(f'provinces-1995: {s["id"]} is not the map\'s {s["name"]}')
        elif not s['source'] or any(p[k] != s[k] for k in ('commerce', 'industry', 'population', 'city_rank')):
            errors.append(f'provinces-1995: {s["id"]} has no source or is not in the game data')
    # 1995-rework 2.5: every major country is sourced, within about 20%, with its source named.
    source = {r['iso3']: r for r in read(AUTHORING / 'countries-1995.csv')}
    economy_source = {r['iso3'] for r in read(AUTHORING / 'economy-1995.csv')}
    for c in countries:
        if c['major'] != 'Y':
            continue
        s = source.get(c['iso3'])
        if s is None or not s['source'] or not s['gdp_usd_bn'] or not s['population_m']:
            errors.append(f'{c["iso3"]}: a major country with no sourced GDP and population')
            continue
        for col in ('gdp_usd_bn', 'population_m'):
            want = float(s[col])
            if abs(float(c[col]) - want) > SOURCED_TOLERANCE * want:
                errors.append(f'{c["iso3"]}: {col} {c[col]} is more than 20% from its source {want}')
        if c['iso3'] not in economy_source:
            errors.append(f'{c["iso3"]}: a major country with no tax rate or rating row')
    if any(c['subject_of'] for c in countries):
        errors.append('countries: the 2020 vassals are not in 1995')
    usa_regions = {p['region'] for p in provinces if p['country'] == 'USA'}
    states = {s['state'] for s in read(OUT / 'politics-usa.csv')}
    if usa_regions != states:
        errors.append(f'politics-usa: differs from the USA province regions: {sorted(usa_regions ^ states)}')

    # 1995-rework 2.3, 2.5: the real firms are in, at their revenue, and no real name is in any game CSV.
    authored = read(AUTHORING / 'companies-1995.csv')
    if len(authored) < AUTHORED_MIN:
        errors.append(f'authoring: {len(authored)} real companies, expected at least {AUTHORED_MIN}')
    by_name = {c['name']: c for c in read(OUT / 'companies.csv')}
    for a in authored:
        c = by_name.get(a['name'])
        if not a['source']:
            errors.append(f'authoring: {a["name"]} has no source')
        if c is None:
            errors.append(f'companies: {a["name"]} is missing')
        elif abs(float(c['revenue_usd_m']) - float(a['revenue_usd_m'])) > SOURCED_TOLERANCE * float(a['revenue_usd_m']):
            errors.append(f'companies: {a["name"]} is more than 20% from its source')
    patterns = [(a['analogue'], re.compile(r'\b' + re.escape(a['analogue']) + r'\b')) for a in authored]
    for path in sorted(OUT.rglob('*.csv')):
        if path.name in COUNTY_FILES:
            continue   # real counties, some named like a firm (Ford County, Marathon County)
        text = path.read_text(encoding='utf-8')
        for name, pat in patterns:
            # An ordinary word or surname counts only among the companies.
            if (name not in ORDINARY_WORDS or path.name == 'companies.csv') and pat.search(text):
                errors.append(f'{path.name}: names the real firm {name}')

    # 1995-rework 7.7, 7.8: one company per named controller, and nobody both starts and spawns.
    bosses = [c['controller'] for c in read(OUT / 'companies.csv') if c['controller'].startswith('CH-')]
    errors += [f'companies: {b} controls more than one company' for b in sorted(set(bosses)) if bosses.count(b) > 1]
    spawns = read(OUT / 'character-spawns.csv')
    names = {c['id']: c['name'] for c in read(OUT / 'characters.csv')}
    if len({s['id'] for s in spawns}) != len(spawns):
        errors.append('character-spawns: an id appears twice')
    if 'John Techno' not in {names.get(s['id']) for s in spawns}:
        errors.append('character-spawns: no John Techno')
    for s in spawns:
        if s['id'] not in names:
            errors.append(f'character-spawns: {s["id"]} is not in characters.csv')
        if s['id'] in bosses:
            errors.append(f'character-spawns: {s["id"]} also controls a company at the start')
        if int(s['spawn_first']) > int(s['spawn_last']):
            errors.append(f'character-spawns: {s["id"]} has an empty window')

    # 1995-rework 6.4: one track per zone, and the tracks end China's zone above Japan's.
    zones = read(OUT / 'financial-zones.csv')
    tracks = {r['zone_id']: float(r['track']) for r in read(OUT / 'zone-growth.csv')}
    if sorted(tracks) != sorted(z['zone_id'] for z in zones):
        errors.append('zone-growth: not one row per financial zone')
    else:
        end = {z['zone_id']: float(z['gdp_share']) * math.exp(RUN_YEARS * tracks[z['zone_id']]) for z in zones}
        if end['CN'] <= end['JP']:
            errors.append('zone-growth: China\'s zone does not pass Japan\'s by the end')
    errors += [f'zone-growth: {k} is out of +-{ZONE_TRACK_MAX}' for k, v in tracks.items() if abs(v) > ZONE_TRACK_MAX]

    # 1995-rework 7.2: the real 1990-census House and the 104th Congress on its first day.
    us = read(OUT / 'politics-usa.csv')
    era = read(OUT / 'politics-usa-era.csv')
    if [s['state'] for s in era] != [s['state'] for s in us]:
        errors.append('politics-usa-era: its states differ from politics-usa')
    if sum(int(s['house_seats']) for s in us) != HOUSE_SEATS:
        errors.append(f'politics-usa: House seats are not {HOUSE_SEATS}')
    house_dem = sum(int(s['start_house_dem']) for s in era)
    senate_dem = sum(int(s['start_senate_dem']) for s in era)
    if (house_dem, senate_dem) != START_DEMS:
        errors.append(f'politics-usa-era: {house_dem} House and {senate_dem} Senate Democrats, expected {START_DEMS}')
    for s, e in zip(us, era):
        if int(e['start_house_dem']) > int(s['house_seats']):
            errors.append(f'politics-usa-era: {s["state"]} has more Democrats than House seats')
        if int(e['start_senate_dem']) > len([c for c in s['senate_classes'].split(';') if c]):
            errors.append(f'politics-usa-era: {s["state"]} has more Democrats than Senate seats')

    companies = read(OUT / 'companies.csv')
    if not COMPANY_RANGE[0] <= len(companies) <= COMPANY_RANGE[1]:
        errors.append(f'companies: {len(companies)}, expected {COMPANY_RANGE[0]} to {COMPANY_RANGE[1]}')
    # A born company's key is the table length plus one (births/jobs.ts `companyKey`).
    for i, c in enumerate(companies):
        if c['id'] != f'CO-{i + 1:04d}':
            errors.append(f'companies: row {i + 1} is {c["id"]}, and the ids must have no gaps')
            break
    company_ids = {c['id'] for c in companies}
    characters = {c['id']: c for c in read(OUT / 'characters.csv')}
    for c in companies:
        if c['hq_country'] not in isos:
            errors.append(f'{c["id"]}: unknown HQ country {c["hq_country"]}')
        if c['hq_province'] not in ids:
            errors.append(f'{c["id"]}: unknown HQ province {c["hq_province"]}')
        boss = c['controller']
        if boss.startswith('CO-') and boss not in company_ids:
            errors.append(f'{c["id"]}: controller {boss} is not in this world')
        if boss.startswith('CH-') and boss not in characters:
            errors.append(f'{c["id"]}: controller {boss} is not in characters.csv')
        if boss.startswith('CH-') and characters[boss]['name'] == 'John Techno':
            errors.append(f'{c["id"]}: John Techno controls a company in 1995 (1995-rework 7.7)')
        if c['name'] == 'Arrowhead Drilling':
            errors.append(f'{c["id"]}: Arrowhead is not a fixed company in 1995 (1995-rework 7.7)')
        for part in c['other_holders'].split(';'):
            ref = part.split(':')[0]
            if ref.startswith('CO-') and ref not in company_ids:
                errors.append(f'{c["id"]}: holder {ref} is not in this world')

    industries = read(OUT / 'industries.csv')
    revenue = {}
    for c in companies:
        revenue[c['industry']] = revenue.get(c['industry'], 0.0) + float(c['revenue_usd_m'])
    dormant = {l['id'] for l in read(OUT / 'industry-lifecycle.csv')}
    for i in industries:
        named = revenue.get(i['name'], 0.0)
        if i['id'] in dormant:
            if named != 0.0 or float(i['world_size_2020_usd_bn']) != 0.0:
                errors.append(f'{i["name"]}: dormant, but has companies or a size')
        elif named == 0.0:
            errors.append(f'{i["name"]}: no company')
        elif named / 1000.0 >= float(i['world_size_2020_usd_bn']):
            errors.append(f'{i["name"]}: named revenue is at or above its world size')

    zones = read(OUT / 'financial-zones.csv')
    economy = read(OUT / 'country-economy.csv')
    if {e['iso3'] for e in economy} != isos:
        errors.append('country-economy: its countries differ from countries.csv')
    if sum(int(z['countries']) for z in zones) != len(isos):
        errors.append('financial-zones: member counts do not sum to the countries')
    if {c['iso3'] for c in read(OUT / 'names' / 'country-cultures.csv')} != isos:
        errors.append('names/country-cultures: its countries differ from countries.csv')

    if read(OUT / 'startup-events.csv'):
        errors.append('startup-events: this world has no fixed events')
    cabinet = sum(int(o['seats']) for o in read(OUT / 'politics-usa-offices.csv') if o['kind'] == 'cabinet')
    if cabinet != manifest['cabinet_seats']:
        errors.append(f'politics-usa-offices: {cabinet} cabinet seats, the manifest says {manifest["cabinet_seats"]}')
    start = read(OUT / 'company-start.csv')
    if [r['id'] for r in start] != [c['id'] for c in companies]:
        errors.append('company-start: its ids differ from companies.csv')

    for e in errors:
        print(f'ERROR {e}')
    print('OK' if not errors else f'{len(errors)} errors')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
