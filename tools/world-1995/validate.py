#!/usr/bin/env python3
"""Checks assets/worlds/1995 (docs/build/1995-rework-spec.md, 2 and 3.2). The load-time checks in
sim-data cover what every world shares; this adds what is particular to this world and its
generator. Prints each problem and then OK or a count; exits non-zero on any problem.

    python tools/world-1995/validate.py
"""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'docs' / 'design' / 'data'
OUT = ROOT / 'assets' / 'worlds' / '1995'

GDP_TARGET_USD_BN = 30000.0
GDP_TOLERANCE = 0.03
COMPANY_RANGE = (280, 320)
HOUSE_SEATS = 435
START_DEMS = (205, 47)   # 1995-rework 7.2: the 104th Congress, Vermont's independent as a Democrat
PROVINCES = 3963
REGION_SLUGS = ['east-asia-oceania', 'europe', 'latin-america', 'mena', 'north-america',
                'russia-central-asia', 'south-asia', 'sub-saharan-africa']


def read(path):
    with open(path, encoding='utf-8', newline='') as fh:
        return list(csv.DictReader(fh))


def main():
    errors = []
    manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['id'] != '1995' or manifest['start_date'] != '1995-01-01':
        errors.append('manifest: not the 1995 world')
    if manifest['features'] != {'era': True, 'ai_boom': False, 'fixed_events': False, 'arrowhead': False}:
        errors.append(f'manifest: expected an era world with no scripted parts, got {manifest["features"]}')

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
    usa_regions = {p['region'] for p in provinces if p['country'] == 'USA'}
    states = {s['state'] for s in read(OUT / 'politics-usa.csv')}
    if usa_regions != states:
        errors.append(f'politics-usa: differs from the USA province regions: {sorted(usa_regions ^ states)}')

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
