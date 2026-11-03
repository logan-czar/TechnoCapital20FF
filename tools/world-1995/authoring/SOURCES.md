# 1995 world sources

Input to `tools/world-1995/gen.py`. Nothing here reaches the game except through the generator.

## `countries-1995.csv`

1995 GDP in current US dollars and 1995 population, one row per economy.

- `WB`: World Bank World Development Indicators, read on 1 November 2026 from the API:
  - GDP: `https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?date=1995&format=json&per_page=400`
  - Population: `https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?date=1995&format=json&per_page=400`
- Taiwan is not in the World Bank's data. Its row comes from Wikipedia, read the same day:
  - Population: "Demographics of Taiwan", Births and deaths table, average population 1995.
  - GDP: "Economy of Taiwan", Data table, 1995 nominal GDP. This value was read through a summary of the page rather than its text, so it is less certain. It matches the figure from memory.

An empty GDP means the source has none for 1995. The generator scales those rows, and rows with no entry here, from the 2020 data.

## `economy-1995.csv`

Corporate tax rates and sovereign ratings of the 33 major countries. **These are approximate and from memory, not checked against a source**, marked `(A)` as elsewhere in the design data. The spreads follow from the ratings. Replace them with sourced values if tax or spreads start to matter in calibration.

## `provinces-1995.csv`

The 1995 commerce, industry and population scores and city rank of the provinces that changed most by 2020: China's coastal boom districts and new areas, India's IT and car corridors, and the Gulf's newer districts. Every other province keeps the 2020 data's scores. **These are from memory, marked `(M)`, not checked against a source.** The scores only rank provinces within their country (startup sites, 1995-rework 6.4) and color the map, so a rough order is what matters.

## `companies-1995.csv`

The real firms behind the largest fictional companies. `analogue` must never reach a game CSV, which `validate.py` enforces. Revenues are 1994 sales in USD millions, the basis of the lists published in 1995. The `source` column says how far to trust each row:

- `AP`: read directly from the Associated Press reprint of the 1995 Fortune 500, "Fortune 500", Spokesman-Review, 26 April 1995: `https://www.spokesman.com/stories/1995/apr/26/fortune-500/`. Thirty rows, the top 30 of that list.
- `F`: the firm's rank is confirmed by `https://fortune.com/ranking/global500/1995/`, whose page gives no revenues. The figure is **from memory**, except Mitsubishi's, which a Fortune article of August 1995 gives as $176 billion.
- `M`: **from memory, not checked against any source.** The AP rows that could be compared matched memory, but that is not a citation.

Fortune's own archive pages for 1995 returned errors on 1 November 2026 (`money.cnn.com` 503, `archive.fortune.com` 400). When they return, they can upgrade the `F` and `M` rows.

`control` is the state's stake, as `iso3:percent`, also from memory.

## Starting debt

`gen.py`'s `SECTOR_NET_DEBT` and `INDUSTRY_NET_DEBT` give each firm's starting net debt in years of EBITDA. **They are from memory of mid-1990s balance sheets, not checked against a source**: utilities, telecoms, airlines, shipping and property borrowed most, and software and chip firms held net cash. The generator writes them to `industry-leverage.csv`, so they set both the spread of starting credit ratings and the net debt firms pay out toward through the run. A rough level per sector is what matters.
