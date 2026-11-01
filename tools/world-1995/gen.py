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
    for r in rows:
        r['world_size_2020_usd_bn'] = num(float(r['world_size_2020_usd_bn']) * scale)
    write(OUT / 'industries.csv', fields, rows)


def select_companies(rows, economy):
    """About COMPANY_TARGET companies: the largest per industry, the largest listed of any zone left
    with none, then the largest overall, with each kept subsidiary's parent."""
    _, characters = read(SRC / 'characters.csv')
    player = next(c['id'] for c in characters if c['name'] == PLAYER)
    pool = [r for r in rows if r['name'] != ARROWHEAD and r['controller'] != player]
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
        if len(kept) >= COMPANY_TARGET:
            break
        keep(r)
    return sorted(kept.values(), key=lambda r: r['id'])


def build_companies(economy, scale):
    """The kept companies, renumbered from CO-0001: a born company's key is the table length plus
    one (births/jobs.ts `companyKey`), so the ids must have no gaps."""
    fields, rows = read(SRC / 'companies.csv')
    kept = select_companies(rows, economy)
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
    for name in ['characters.csv', 'ai-boom.csv', 'key-cities.csv', 'politics-usa.csv', 'names/industry-suffixes.csv']:
        (OUT / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SRC / name, OUT / name)
    for slug in REGION_SLUGS:
        (OUT / 'names').mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SRC / 'names' / f'{slug}.csv', OUT / 'names' / f'{slug}.csv')
    fields, _ = read(SRC / 'startup-events.csv')
    write(OUT / 'startup-events.csv', fields, [])   # 3.2: no fixed events
    fields, rows = read(SRC / 'politics-usa-offices.csv')
    write(OUT / 'politics-usa-offices.csv', fields, [r for r in rows if r['id'] not in DROPPED_OFFICES])


def build_company_start(economy, zones):
    """company-start.csv by the 2020 generator's own rule, reading the files just written."""
    argv = sys.argv
    sys.argv = [argv[0], str(ROOT / 'docs' / 'design')]
    try:
        spec = importlib.util.spec_from_file_location('mvp_gen', MVP_GEN)
        mvp = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mvp)
    finally:
        sys.argv = argv
    mvp.DATA = str(OUT)
    rows = mvp.build_company_start(economy, zones)
    write(OUT / 'company-start.csv', list(rows[0].keys()), rows)
    return rows


def write_manifest(counts):
    manifest = {
        'id': '1995',
        'start_date': START_DATE,
        'expected_counts': counts,
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
