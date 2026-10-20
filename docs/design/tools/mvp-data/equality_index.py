#!/usr/bin/env python3
"""Rewrite the wealth_index column of data/countries.csv as an EQUALITY index (Logan, batch 158).

Logan: "wealth index should be like income inequality where 100 is everyone makes realistically
the same amount and values like 10 being massive slavery or servitude."

  base = clamp(round(140 - 2 x Gini), 20, 95)          (T)
  WI   = max(10, base - forced-labor penalty)          (T)
  hand values replace the result for the worst forced-labor states (A)

Gini: latest World Bank / national estimate known before 2020, from memory, rounded (A); rows with
no published Gini (microstates, territories, closed states) are estimates from the parent or
neighbours (A). ADJ shifts the Gini for the alternate history of 19-history.md 19.22 (A).
PENALTY is in index points, scaled from Walk Free Global Slavery Index prevalence and known
state or bonded forced labor (A). Nobody reaches 100. Run from anywhere; only wealth_index changes.
"""
import csv, os

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, '..', '..', 'data', 'countries.csv')

GINI = {
    # North America
    'USA': 41.5, 'CAN': 33.3, 'MEX': 45.4, 'GRL': 33, 'BMU': 40, 'SPM': 31,
    # Latin America and Caribbean
    'BRA': 53.4, 'ARG': 42.3, 'CHL': 44.4, 'COL': 51.3, 'PER': 41.5, 'ECU': 45.7, 'BOL': 41.6,
    'VEN': 46, 'URY': 39.7, 'PRY': 45.7, 'GUY': 45, 'SUR': 39.2, 'PAN': 49.8, 'CRI': 48.0,
    'GTM': 48.3, 'HND': 48.2, 'SLV': 38.8, 'NIC': 46.2, 'BLZ': 53.3, 'CUB': 40, 'DOM': 41.9,
    'HTI': 41.1, 'JAM': 40.2, 'TTO': 40.3, 'BHS': 41, 'BRB': 41, 'ATG': 43, 'DMA': 38, 'GRD': 40,
    'KNA': 40, 'LCA': 51.2, 'VCT': 40, 'PRI': 54, 'CYM': 40, 'VGB': 40, 'PAP': 45,
    # Europe
    'GBR': 35.1, 'DEU': 31.7, 'FRA': 31.5, 'NLD': 28.1, 'ITA': 35.2, 'CHE': 33.1, 'ESP': 34.3,
    'PRT': 33.5, 'IRL': 30.6, 'BEL': 26.0, 'AUT': 30.7, 'GRC': 32.9, 'LUX': 35.4, 'FIN': 27.1,
    'EST': 30.7, 'LVA': 34.5, 'LTU': 35.7, 'SVK': 23.2, 'SVN': 24.0, 'CYP': 31.2, 'MLT': 31.4,
    'MNE': 36.8, 'XKX': 29.0, 'AND': 30, 'MCO': 40, 'SMR': 30, 'VAT': 30, 'LIE': 30,
    'SWE': 28.9, 'NOR': 27.7, 'DNK': 28.3, 'ISL': 26.1, 'POL': 28.5, 'CZE': 26.2, 'HUN': 29.6,
    'ROU': 34.8, 'BGR': 40.5, 'HRV': 28.9, 'SRB': 34.5, 'BIH': 33.0, 'MKD': 33.0, 'ALB': 29.4,
    'UKR': 25.6, 'BLR': 24.4, 'MDA': 25.7, 'GGY': 32, 'JEY': 34, 'GIB': 33, 'IMN': 32, 'FRO': 25,
    # Russia and Central Asia
    'RUS': 37.5, 'KAZ': 27.8, 'UZB': 31.2, 'TKM': 40.8, 'KGZ': 29.0, 'TJK': 34.0, 'GEO': 34.5,
    'ARM': 27.9, 'AZE': 26.6,
    # Middle East and North Africa
    'TUR': 41.9, 'SAU': 45.9, 'ARE': 32, 'ISR': 38.6, 'EGY': 31.9, 'QAT': 41, 'IRN': 40.9,
    'IRQ': 29.5, 'KWT': 36, 'BHR': 38, 'OMN': 38, 'YEM': 36.7, 'JOR': 33.7, 'LBN': 31.8,
    'SYR': 37.5, 'PSE': 33.7, 'LBY': 38, 'DZA': 27.6, 'MAR': 39.5, 'TUN': 33.7,
    # Sub-Saharan Africa
    'NGA': 35.1, 'ZAF': 63.0, 'COD': 42.1, 'GHA': 43.5, 'CIV': 37.2, 'SEN': 36.2, 'MLI': 36.1,
    'BFA': 43.0, 'NER': 37.3, 'GIN': 29.6, 'GNB': 34.8, 'SLE': 35.7, 'LBR': 35.3, 'TGO': 42.4,
    'BEN': 37.8, 'GMB': 38.8, 'CPV': 42.4, 'MRT': 32.6, 'TCD': 37.4, 'CMR': 46.6, 'CAF': 56.2,
    'COG': 48.9, 'GAB': 38.0, 'GNQ': 50, 'STP': 40.7, 'KEN': 38.7, 'ETH': 35.0, 'TZA': 40.5,
    'UGA': 42.7, 'SOM': 36.8, 'SDN': 34.2, 'SSD': 44.1, 'ERI': 40, 'DJI': 41.6, 'RWA': 43.7,
    'BDI': 38.6, 'MDG': 42.6, 'MUS': 36.8, 'SYC': 32.1, 'COM': 45.3, 'ZMB': 57.1, 'AGO': 51.3,
    'ZWE': 50.3, 'MOZ': 54.0, 'NAM': 59.1, 'BWA': 53.3, 'MWI': 38.5, 'LSO': 44.9, 'SWZ': 54.6,
    # South Asia
    'IND': 35.7, 'PAK': 29.6, 'BGD': 32.4, 'LKA': 39.3, 'NPL': 32.8, 'BTN': 37.4, 'MDV': 29.3,
    'AFG': 31,
    # East Asia and Oceania
    'CHN': 38.2, 'JPN': 32.9, 'KOR': 31.4, 'TWN': 33.6, 'SGP': 39.8, 'MYS': 41.2, 'IDN': 38.3,
    'VNM': 36.1, 'AUS': 34.3, 'HKG': 53.9, 'MAC': 37, 'PRK': 40, 'MNG': 32.7, 'THA': 34.9,
    'PHL': 40.7, 'MMR': 30.7, 'KHM': 31, 'LAO': 38.8, 'BRN': 40, 'TLS': 28.7, 'NZL': 32.5,
    'PNG': 41.9, 'FJI': 30.7, 'SLB': 37.1, 'VUT': 32.3, 'WSM': 38.7, 'TON': 37.6, 'KIR': 27.8,
    'FSM': 40.1, 'MHL': 35.5, 'PLW': 35, 'NRU': 34.8, 'TUV': 39.1,
}

# Alternate-history Gini shifts (19.22) (A)
ADJ = {
    'USA': 1.5,                      # corporations unchecked through the Bush and Trump years
    'GRC': 3, 'ITA': 2, 'ESP': 2, 'PRT': 2, 'CYP': 2,   # euro crisis; Greece's default
    'RUS': 2,                        # fifteen years of sanctions, oligarchic economy
    'IRN': 1,                        # sanctioned and sliding
}

# Forced-labor penalty in index points (A)
PENALTY = {
    'MRT': 30,                       # hereditary slavery
    'UZB': 10, 'MMR': 10, 'PAK': 10, 'HTI': 10, 'NER': 10, 'MLI': 10, 'SSD': 10, 'SOM': 10,
    'CAF': 10,
    'CHN': 8, 'IND': 8, 'LBN': 8, 'SDN': 8, 'COD': 8, 'YEM': 8, 'GNQ': 8,
    'RUS': 5, 'TJK': 5, 'AFG': 5, 'BGD': 5, 'NPL': 5, 'JOR': 5, 'IRN': 5, 'LBY': 5, 'TCD': 5,
    'BDI': 5, 'MYS': 5, 'THA': 5, 'BRN': 5, 'MDV': 5, 'CUB': 5, 'VEN': 5,
    'TUR': 3, 'SGP': 3, 'MAC': 3, 'BLR': 3,
}

# Hand values (A): state forced labor and Gulf kafala sponsorship labor
HAND = {
    'PRK': 10,   # state forced labor and prison camps
    'ERI': 14,   # indefinite national service
    'TKM': 20,   # state-run forced cotton harvest
    'QAT': 22, 'ARE': 24, 'KWT': 26, 'SAU': 26, 'BHR': 30, 'OMN': 30,   # kafala: most workers are bound migrants
}


def index(iso):
    if iso in HAND:
        return HAND[iso]
    g = GINI[iso] + ADJ.get(iso, 0)
    base = min(95, max(20, round(140 - 2 * g)))
    return max(10, base - PENALTY.get(iso, 0))


def main():
    with open(PATH, newline='', encoding='utf-8') as fh:
        rows = list(csv.reader(fh))
    head = rows[0]
    i_iso, i_wi = head.index('iso3'), head.index('wealth_index')
    missing = [r[i_iso] for r in rows[1:] if r[i_iso] not in GINI]
    if missing:
        raise SystemExit(f'no Gini for {missing}')
    for r in rows[1:]:
        r[i_wi] = str(index(r[i_iso]))
    with open(PATH, 'w', newline='', encoding='utf-8') as fh:
        csv.writer(fh, lineterminator='\n').writerows(rows)
    print(f'wealth_index rewritten for {len(rows) - 1} rows')


if __name__ == '__main__':
    main()
