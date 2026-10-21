#!/usr/bin/env python3
"""Validate characters.csv and companies.csv (batch 136).

usage: python3 validate.py <design/data dir with the province CSVs> <dir with the two output CSVs>
Exits non-zero on any error; prints summary counts.
"""
import csv, glob, os, sys
from collections import Counter, defaultdict

DATA = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/design/data'
OUT = sys.argv[2] if len(sys.argv) > 2 else DATA
errors = []
def err(m):
    errors.append(m)

INDUSTRIES = ['Semiconductors', 'AI labs', 'Cloud', 'Data centers', 'Software', 'SaaS', 'Social media', 'Ads',
              'Consumer electronics', 'Telecom', 'Gaming', 'Gambling', 'Banking', 'Insurance', 'Asset management',
              'Oil', 'Gas', 'Power utilities', 'Renewables', 'Mining', 'Metals', 'Chemicals', 'Agriculture', 'Autos',
              'EVs', 'Aerospace', 'Defense', 'Robotics', 'Drones', 'Shipping', 'Logistics', 'Airlines',
              'Construction', 'Retail', 'E-commerce', 'Fast food', 'Luxury', 'Pharma', 'Healthcare services',
              'Real estate', 'Professional services', 'Black market']
IDEOLOGIES = {'Liberals', 'Communists', 'Accelerationists', 'Effective Altruists', 'Transhumanists',
              'Neo-Luddites', 'Sovereigntists', 'Landites', 'Chuds'}
PAIRS = [('Ambitious', 'Content'), ('Greedy', 'Generous'), ('Paranoid', 'Trusting'), ('Ruthless', 'Compassionate'),
         ('Visionary', 'Conservative'), ('Honest', 'Deceitful'), ('Brave', 'Cautious'), ('Diligent', 'Lazy'),
         ('Hedonist', 'Ascetic'), ('Zealot', 'Cynic'), ('Narcissist', 'Humble'), ('Gregarious', 'Shy')]
TRAITS = {t for p in PAIRS for t in p} | {'Operational Excellence'}
OPP = {a: b for a, b in PAIRS} | {b: a for a, b in PAIRS}
BASES = {'majority', 'class_a', 'proxy', 'trust', 'state', 'subsidiary', 'widely_held'}

countries = {r['iso3'] for r in csv.DictReader(open(os.path.join(DATA, 'countries.csv'), encoding='utf-8'))}
provinces = {}
for f in glob.glob(os.path.join(DATA, 'provinces-*.csv')):
    for r in csv.DictReader(open(f, encoding='utf-8')):
        provinces[r['id']] = r
chars = list(csv.DictReader(open(os.path.join(OUT, 'characters.csv'), encoding='utf-8')))
cos = list(csv.DictReader(open(os.path.join(OUT, 'companies.csv'), encoding='utf-8')))
cid = {c['id']: c for c in chars}
coid = {c['id']: c for c in cos}

# uniqueness
for label, rows, field in [('character id', chars, 'id'), ('character name', chars, 'name'),
                           ('company id', cos, 'id'), ('company name', cos, 'name')]:
    dup = [k for k, n in Counter(r[field] for r in rows).items() if n > 1]
    if dup:
        err(f'duplicate {label}: {dup}')
tick = [c['ticker'] for c in cos if c['ticker']]
dup = [k for k, n in Counter(tick).items() if n > 1]
if dup:
    err(f'duplicate tickers: {dup}')
for c in cos:
    if c['public'] == 'Y' and not c['ticker']:
        err(f"public company without ticker: {c['name']}")

# characters
for ch in chars:
    if ch['origin_province'] not in provinces:
        err(f"{ch['id']} bad province {ch['origin_province']}")
    elif provinces[ch['origin_province']]['country'] != ch['country']:
        err(f"{ch['id']} province not in country")
    if ch['country'] not in countries:
        err(f"{ch['id']} bad country")
    if ch['tier'] not in ('player', 'rival', 'holder'):
        err(f"{ch['id']} bad tier")
    if ch['ideology'] and ch['ideology'] not in IDEOLOGIES:
        err(f"{ch['id']} bad ideology {ch['ideology']}")
    if not ch['ideology'] and ch['tier'] != 'player':
        err(f"{ch['id']} missing ideology")
    tr = ch['traits'].split(';')
    for t in tr:
        if t not in TRAITS:
            err(f"{ch['id']} bad trait {t}")
        if OPP.get(t) in tr:
            err(f"{ch['id']} opposite traits {t}")
    if ch['tier'] != 'player' and len(tr) != 3:
        err(f"{ch['id']} needs 3 traits")
    sk = [int(ch[k]) for k in ('finance', 'operations', 'persuasion', 'intrigue', 'tech', 'hustle')]
    if any(s < 0 or s > 30 for s in sk):
        err(f"{ch['id']} skill out of range")
    if ch['tier'] != 'player' and max(sk) >= 24:
        err(f"{ch['id']} skill {max(sk)} rivals John's 24")
    if ch['tier'] in ('rival', 'holder') and ch['money_type'] not in ('old', 'tech', 'state-linked', 'criminal'):
        err(f"{ch['id']} bad money_type")
john = [c for c in chars if c['name'] == 'John Techno'][0]
if any(int(john[k]) != 24 for k in ('finance', 'operations', 'persuasion', 'intrigue', 'tech', 'hustle')):
    err('John is not 24 in all skills')
if not any(c['name'] == 'Pieter Von Floop' for c in chars):
    err('Pieter Von Floop missing or misspelled')

# companies
valid_ref = set(cid) | set(coid) | countries
stakes_of = defaultdict(list)   # character id -> [(company, pct)]
for c in cos:
    if c['industry'] not in INDUSTRIES:
        err(f"{c['id']} bad industry {c['industry']}")
    if c['hq_province'] not in provinces:
        err(f"{c['id']} bad province {c['hq_province']}")
    elif provinces[c['hq_province']]['country'] != c['hq_country']:
        err(f"{c['id']} hq province not in hq country")
    if c['control_basis'] not in BASES:
        err(f"{c['id']} bad basis {c['control_basis']}")
    tot = 0.0
    if c['controller']:
        if c['controller'] not in valid_ref:
            err(f"{c['id']} unknown controller {c['controller']}")
        tot += float(c['controller_stake_pct'])
        holder = c['owner_of_record'] or c['controller']
        if c['control_basis'] in ('majority', 'class_a', 'proxy') and holder in cid:
            stakes_of[holder].append((c['id'], float(c['controller_stake_pct'])))
        if c['control_basis'] == 'state' and c['controller'] not in countries:
            err(f"{c['id']} state basis without a country")
        if c['control_basis'] == 'majority' and float(c['controller_stake_pct']) <= 50:
            err(f"{c['id']} majority with stake <= 50")
        if c['control_basis'] == 'class_a' and float(c['controller_stake_pct']) < 9.1:
            err(f"{c['id']} class A stake too small to hold 50% of votes")
    elif c['control_basis'] != 'widely_held':
        err(f"{c['id']} basis without controller")
    if c['owner_of_record'] and c['owner_of_record'] not in cid:
        err(f"{c['id']} unknown owner of record")
    if c['control_basis'] == 'proxy' and not c['owner_of_record']:
        err(f"{c['id']} proxy without owner of record")
    for part in filter(None, c['other_holders'].split(';')):
        k, p = part.split(':')
        if k not in valid_ref:
            err(f"{c['id']} unknown holder {k}")
        tot += float(p)
        if k in cid:
            stakes_of[k].append((c['id'], float(p)))
        if k == c['id']:
            err(f"{c['id']} holds itself")
    if tot > 100.0001:
        err(f"{c['id']} stakes sum to {tot}")
    if c['industry'] == 'Black market' and c['public'] == 'Y':
        err(f"{c['id']} black market company is listed")
    if c['public'] == 'N' and c['ticker']:
        err(f"{c['id']} private with ticker")

ind_count = Counter(c['industry'] for c in cos)
for ind in INDUSTRIES:
    if not 10 <= ind_count[ind] <= 20:
        err(f'industry {ind} has {ind_count[ind]} companies')

# rivals and holders
ctrl_count = Counter(c['controller'] for c in cos if c['controller'] in cid)
for ch in chars:
    if ch['tier'] == 'rival' and not 1 <= ctrl_count[ch['id']] <= 15:
        err(f"rival {ch['name']} controls {ctrl_count[ch['id']]}")
    if ch['tier'] == 'holder':
        st = stakes_of[ch['id']]
        if not 1 <= len(st) <= 2:
            err(f"holder {ch['name']} has {len(st)} stakes")
        for _, p in st:
            if not 5 <= p <= 60:
                err(f"holder {ch['name']} stake {p} outside 5-60")
    if ch['tier'] == 'player' and stakes_of[ch['id']]:
        err('John holds stakes')

# canon checks
ah = [c for c in cos if c['name'] == 'Arrowhead Drilling'][0]
terry = [c for c in chars if c['name'] == 'Terry Tippacanoe'][0]
if not (ah['industry'] == 'Oil' and ah['hq_province'] == 'CA-0033' and ah['controller'] == terry['id']
        and float(ah['controller_stake_pct']) == 60 and float(ah['est_value_usd_m']) == 100):
    err('Arrowhead Drilling does not match 7.3.0')
oil = [c for c in cos if c['industry'] == 'Oil' and c is not ah]
if any(float(c['revenue_usd_m']) <= float(ah['revenue_usd_m']) or float(c['est_value_usd_m']) <= 100 for c in oil):
    err('Arrowhead is not the smallest oil company')

if errors:
    print('\n'.join(errors))
    print(f'{len(errors)} ERRORS')
    sys.exit(1)

# summary
rivals = [c for c in chars if c['tier'] == 'rival']
holders = [c for c in chars if c['tier'] == 'holder']
print('characters', len(chars), Counter(c['tier'] for c in chars))
print('rivals by group', Counter(c['region_group'] for c in rivals))
print('rivals by superregion', Counter(c['superregion'] for c in rivals))
print('rival company counts', Counter(Counter(c['controller'] for c in cos)[r['id']] for r in rivals))
print('rival money mix', Counter(c['money_type'] for c in rivals))
print('holder money mix', Counter(c['money_type'] for c in holders))
print('companies', len(cos), 'public', sum(c['public'] == 'Y' for c in cos))
by_kind = Counter()
for c in cos:
    k = c['controller']
    if not k:
        by_kind['widely held'] += 1
    elif k in countries:
        by_kind['state'] += 1
    elif k in coid:
        by_kind['subsidiary'] += 1
    elif cid[k]['tier'] == 'rival':
        by_kind['rival'] += 1
    else:
        by_kind['holder'] += 1
print('control', dict(by_kind))
print('industry counts min/max', min(ind_count.values()), max(ind_count.values()))
print('HQ countries', len({c['hq_country'] for c in cos}), Counter(c['hq_country'] for c in cos).most_common(12))
print('holder stakes', sum(len(stakes_of[h['id']]) for h in holders))
print('OK')
