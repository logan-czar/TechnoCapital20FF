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
