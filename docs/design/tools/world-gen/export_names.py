#!/usr/bin/env python3
"""Export the world-gen name lists (names.py) to CSV for the Rust sim (build-plan M0.6; mvp-spec 3.7.1, 5.19.3).

    python3 export_names.py [design/data dir]

Writes into <data>/names/:
  <superregion slug>.csv   culture,family_first,kind,name: the male, female and surname lists and the company
                           name prefixes of every culture used by a country of that superregion (A)
  country-cultures.csv     iso3,culture for all countries.csv rows, by the gen.py rule: names.COUNTRY_CULTURE,
                           else the superregion's default culture
  industry-suffixes.csv    industry,suffix: company name suffixes per industry
The slugs are those of the provinces-*.csv file names. Plain Python, no randomness: the same names.py always
gives the same files.
"""
import csv, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import names

DATA = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/design/data'
SLUGS = {'East Asia and Oceania': 'east-asia-oceania', 'Europe': 'europe', 'Latin America': 'latin-america',
         'Middle East and North Africa': 'mena', 'North America': 'north-america',
         'Russia and Central Asia': 'russia-central-asia', 'South Asia': 'south-asia',
         'Sub-Saharan Africa': 'sub-saharan-africa'}

def culture(country):
    """The gen.py rule (world-gen gen.py culture())."""
    return names.COUNTRY_CULTURE.get(country['iso3']) or names.SUPERREGION_CULTURE.get(country['superregion'], 'anglo')

def write(path, header, rows):
    with open(path, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh, lineterminator='\n')
        w.writerow(header)
        w.writerows(rows)
    print(f'wrote {path}: {len(rows)} rows')

def main():
    countries = list(csv.DictReader(open(os.path.join(DATA, 'countries.csv'), encoding='utf-8')))
    out = os.path.join(DATA, 'names')
    os.makedirs(out, exist_ok=True)
    cultures = {c['iso3']: culture(c) for c in countries}
    for sr, slug in SLUGS.items():
        used = sorted({cultures[c['iso3']] for c in countries if c['superregion'] == sr})
        rows = []
        for cu in used:
            ff = 'Y' if cu in names.FAMILY_FIRST else 'N'
            male, female, surnames = names.PEOPLE[cu]
            for kind, words in (('male', male), ('female', female), ('surname', surnames),
                                ('company_prefix', names.PREFIX[cu])):
                rows += [(cu, ff, kind, w) for w in words]
        write(os.path.join(out, f'{slug}.csv'), ['culture', 'family_first', 'kind', 'name'], rows)
    write(os.path.join(out, 'country-cultures.csv'), ['iso3', 'culture'],
          [(c['iso3'], cultures[c['iso3']]) for c in countries])
    write(os.path.join(out, 'industry-suffixes.csv'), ['industry', 'suffix'],
          [(ind, s) for ind, sufs in names.SUFFIX.items() for s in sufs])

if __name__ == '__main__':
    main()
