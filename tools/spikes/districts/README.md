# Spike: US House districts drawn from counties

A research spike for the political sim: can House districts be drawn from real counties, with big counties split by fractional shares, in a way that is deterministic, fast and responds to a gerrymander strength? This folder holds the data notes, a Python prototype and its measurements. Nothing here is wired into the game.

**Short answer.** Recursive bisection of each state's county graph with a fractional cut works: all 50 states at the 2000 apportionment come out with zero population deviation and every district contiguous, in 0.5 s (neutral, all states, Python). A partisan mode moves the national outcome from 179 to 225 expected Democratic seats of 435 (neutral 200). The main weakness is not the algorithm but the data model: a share of a county carries the whole county's lean, so 39% of the population (the counties larger than one seat) cannot be packed or cracked internally.

## Files

| File | What it does |
|---|---|
| `fetch.py` | Downloads the raw inputs into `raw/<name>/` (gitignored). |
| `prep.py` | Joins them into `raw/derived/counties.json` on one county vintage and prints every mismatch it patched. |
| `districts.py` | The prototype: `draw(state, seats, s, sign, seed, tol)` and `measure`. |
| `run.py` | Draws five maps per state and writes `results/`. |
| `results/summary.md` | The full per-state table (seed 1). `summary-seed2.md`, `-seed3`, `-tol005` and `-sigma4` are the variants quoted below. |
| `results/detail.md` | Every district of CA, TX, PA, NH and WY for the neutral map and both full-strength maps. |

Run (Python 3, standard library only, no packages installed):

```
python -I -B fetch.py
python -I -B prep.py
python -I -B run.py            # --states CA,TX  --seed 2  --tol 0.005  --sigma 4  --rollouts 8  --angles 12
```

## 1. Data sources

All URLs were fetched on 2026-11-10. "Confirmed" means I read the licence from the source itself.

| Data | URL | Size | Licence or terms | Status |
|---|---|---|---|---|
| 1990 and 2000 census county counts (2000 county lines) | https://www2.census.gov/programs-surveys/decennial/2000/phc/phc-t-04/tab01.txt (also `tab01.xls`) | 223 KB | US Census Bureau: a federal government work, so no copyright in the US (17 USC 105). Census asks that it be cited as the source. | Used. I did not find a page on census.gov that states "public domain" in those words; the citation page only asks for credit. |
| 2000 base and 2010 census counts on 2010 county lines | https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/county/co-est00int-tot.csv | 371 KB | Census, as above | Used (`ESTIMATESBASE2000`, `CENSUS2010POP`). |
| 2010 census count, 2010s estimates | https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/counties/totals/co-est2020-alldata.csv | 4.0 MB | Census, as above | Downloaded, not used. Already has Alaska's 2019 split (Chugach, Copper River) with `X` for the 2010 count. |
| 2020 base on the old Connecticut counties | https://www2.census.gov/programs-surveys/popest/datasets/2020-2021/counties/totals/co-est2021-alldata.csv | 646 KB | Census, as above | URL checked, not downloaded. |
| 2020 base on Connecticut planning regions | https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/counties/totals/co-est2023-alldata.csv | 1.4 MB | Census, as above | Downloaded, not used: 3,144 rows, Connecticut is nine planning regions (09110 to 09190). |
| County adjacency, 2010 vintage | https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency2010.txt (the same bytes as `.../reference/county_adjacency.txt`) | 727 KB | Census, as above | Used. Has one malformed row, see section 2. A 2023 file exists at `.../county_adjacency/county_adjacency2023.txt` (1.1 MB, Connecticut planning regions). |
| County names and FIPS, 2010 | https://www2.census.gov/geo/docs/reference/codes/files/national_county.txt | 94 KB | Census, as above | Used. |
| County shapes, us-atlas | https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json and `counties-albers-10m.json` | 842 KB and 795 KB (251 KB and 257 KB gzipped) | ISC (the package's `package.json`); the shapes are the Census cartographic boundary files, 2017 edition | Used for centroids only. The repo README states no licence; `package.json` does. |
| County shapes, Census | https://www2.census.gov/geo/tiger/GENZ2010/gz_2010_us_050_00_20m.zip (1.3 MB), `..._5m.zip` (2.4 MB), `..._500k.zip` (9.0 MB); 2020: https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_20m.zip (0.9 MB), `..._5m.zip` (2.8 MB); 1990 and 2000: https://www2.census.gov/geo/tiger/PREVGENZ/co/co90shp/co99_d90_shp.zip (1.7 MB), `.../co00shp/co99_d00_shp.zip` (8.9 MB) | see left | Census, as above | URLs checked (HTTP 200), not downloaded. Shapefiles need a parser the standard library does not have. |
| County presidential returns 2000 to 2024, MIT Election Data and Science Lab | https://doi.org/10.7910/DVN/VOQCHQ (`countypres_2000-2024.tab`, 9.8 MB, version 20) | 9.8 MB | CC0 1.0 (read from the Dataverse record's licence field) | **Not downloadable by script**: the record has a guestbook, and the API answers "You may not download this file without the required Guestbook response". A person has to fetch it in a browser and fill in the form. |
| The same data, 2000 to 2016, on the lab's GitHub | https://raw.githubusercontent.com/MEDSL/county-returns/master/countypres_2000-2016.csv | 4.5 MB | **No licence file in the repository.** It is the earlier release of the CC0 Dataverse dataset, but the GitHub copy itself states no terms. | Used for the spike. For the game, take the Dataverse file so the CC0 grant is unambiguous. |
| State presidential returns 1976 to 2024, MIT lab | https://doi.org/10.7910/DVN/42MVDX (`1976-2024-president.csv`, 514 KB) | 514 KB | CC0 1.0 (Dataverse licence field); downloads without a guestbook | URL and licence checked, not used. Needed for the 1992 and 1996 fallback. |

### County returns for 1992 and 1996

| Source | 1992 and 1996 by county? | Terms | Verdict |
|---|---|---|---|
| Algara and Amlani, "Partisanship & Nationalization in American Elections ... U.S. Counties, 1872-2020", https://doi.org/10.7910/DVN/DGUMFI, file `dataverse_shareable_presidential_county_returns_1868_2020.Rdata` (1.46 MB) | Yes: Democratic, Republican and total votes per county and year, with FIPS. No Alaska. | CC0 1.0 on the Dataverse record; no guestbook; the manual asks for a citation of the Electoral Studies article | **The only free candidate found.** Two things not confirmed: where its 1992 and 1996 figures were compiled from (I read only the first pages of the manual), and its accuracy against another source. It is an R binary, so it needs R or a one-off converter; I did not parse it. |
| Census "USA Counties" (https://www2.census.gov/library/publications/2011/compendia/usa-counties/excel/ELE01.xls, 15 MB) | Yes, items `ELE010192D` to `ELE06x196D` | The data dictionary marks every election item "***Subject to copyright***", source CQ Press | Not free despite being on census.gov. Do not use. |
| Dave Leip's Atlas, Polidata, CQ Voting and Elections | Yes | Paid licences (about $84 to $95 a year-file) | Not free. |
| ICPSR 8611 (Clubb, Flanigan, Zingale) | Ends in 1972 | ICPSR terms | Does not cover the years. |
| MIT Election Lab county file | Starts in 2000 | CC0 | Does not cover the years. |

## 2. County vintage problems and the frozen vintage

What `prep.py` found when joining the files (3,143 county equivalents in the 2010 adjacency file for the 50 states and DC):

- **The Census adjacency file has a broken row.** Line 9629 of the 2010 file carries Watonwan County MN's code (27165) but not its name, so a parser that keys on the name column files Watonwan's neighbours under Washington County MN and loses Watonwan. Key each block on the code column.
- **The adjacency file does not join Hawaii's islands.** Its only Hawaii pair is Maui-Kalawao, which leaves the state in four pieces. Every other state's graph is connected in the file, so its water links (Michigan's peninsulas, Nantucket, the San Juans, Staten Island) are there. The prototype links each stranded piece to the nearest county by centroid: Hawaii-Maui, Honolulu-Kalawao, Kauai-Honolulu. Production should carry an explicit list of ferry edges.
- **Census adjacency is wider than shared borders.** 511 of its pairs share no arc in the us-atlas TopoJSON (water and corner contact), and 4 arc-sharing pairs are missing from it. The two cannot be swapped freely; pick the Census file and patch it.
- **Alaska.** Borough lines changed in 2007-2008 (Skagway-Hoonah-Angoon 02232 into Skagway 02230 and Hoonah-Angoon 02105; Wrangell-Petersburg 02280 into Wrangell 02275 and Petersburg 02195; Prince of Wales-Outer Ketchikan 02201 into Prince of Wales-Hyder 02198), again in 2015 (Wade Hampton 02270 renamed Kusilvak 02158) and 2019 (Valdez-Cordova 02261 into Chugach 02063 and Copper River 02066). The 1990 and 2000 census table has the old three; the 2010 files the new five. Worse, **Alaska has no borough returns**: the MIT 2000 rows for Alaska are 40 state house districts under made-up codes 2701 to 2740 (plus a "District 99" with no code), which are not boroughs. The prototype gives every borough the statewide split. Alaska has one seat, so this never touches districting, only the voter table.
- **Virginia independent cities.** South Boston (51780) joined Halifax County in 1995 (in the 1990 census, gone by 2000), Clifton Forge (51560) joined Alleghany County in 2001 (in the 2000 census table, absent from the 2010 files) and Bedford city (51515) joined Bedford County in 2013 (in the 2010 files, absent from us-atlas). Three more are too small for the us-atlas 10m file: Falls Church (51610), Lexington (51678) and Manassas Park (51685) come out as zero-area polygons, so a centroid or a drawn map needs a fallback for them.
- **Connecticut.** Its eight counties were replaced by nine planning regions as county equivalents in 2022. Census population files from vintage 2022 on, and the 2023 adjacency file, use the regions; everything earlier, us-atlas 3.0.1 and the election returns use the counties. There is no exact crosswalk at county level.
- **Broomfield CO (08014)** was created in November 2001 from parts of Adams, Boulder, Jefferson and Weld. It has no 1990 or 2000 census row and no 2000 return, but the 2000-2010 intercensal file gives it a 2000 base (and lowers the four parents to match). The prototype gives it the pooled 2000 vote split of its four parents.
- **Renumbering.** Dade FL 12025 became Miami-Dade 12086 in 1997 (the files used here already say 12086). Shannon SD 46113 became Oglala Lakota 46102 in 2015: the 2010 files and the MIT 2000 rows say 46113, us-atlas says 46102.
- **Units that are not counties in the returns.** MIT reports Kansas City MO separately (code 36000) from the rest of Jackson County; add it to 29095. Kalawao HI (15005, 147 people) has no return of its own (it is counted with Maui). Rows with code `NA` ("Federal Precinct", "Maine UOCAVA", "Statewide writein") carry no 2000 votes.
- **Two "2000 populations".** The census count (PHC-T-4) and the estimates base (intercensal file) differ in 2,925 counties, almost all by a handful of people from count corrections; the large gaps are the Broomfield parents (Boulder by 21,504, Adams by 15,781) and Clifton Forge's merge. US totals: 281,421,906 and 281,424,600.
- **Apportionment.** `equalProportions` on resident 2000 population gives North Carolina 12 and Utah 4; the real apportionment gave 13 and 3, because the apportionment population adds federal staff overseas. The famous 856-person margin. The run uses the real 2000 seat table. If the sim apportions from summed county residents, expect this kind of one-seat difference from history.

**Proposed frozen vintage: the 2010 census county set with Bedford city merged into Bedford County**, 3,142 units (3,141 in the states plus DC), using the ids us-atlas 3.0.1 uses (46102 and 02158, not 46113 and 02270). Reasons: it is exactly the us-atlas 2017 shape set, so the map asset needs no editing; it is the 2010 adjacency file minus one node; the 2000-2010 intercensal file gives 2000 populations already on these lines (Broomfield included); and the MIT returns for 2000 to 2016 match it after the Kansas City merge. What each other year then needs:

- 1990: PHC-T-4's 1990 column is on 2000 lines. Add Clifton Forge to Alleghany, split the three old Alaska areas by their 2000 successor shares, carve Broomfield from its parents by 2000 shares, and add South Boston to Halifax if the 1990 column turns out not to include it (not checked).
- 2020: use `co-est2021-alldata.csv` (old Connecticut counties) and add Chugach and Copper River back into 02261.
- Later returns (2024): Connecticut is reported by town, so the eight counties can be kept if the source still aggregates to them; check when needed.

## 3. The recommended algorithm

Everything below is in `districts.py` (about 450 lines). Names in `code` are its functions and constants.

### Data

A state is its counties in FIPS order, index `i`: people `pop[i]`, 2000 votes `dem[i]` and `rep[i]`, a planar centroid `x[i], y[i]` (us-atlas Albers units) and `nbr[i]`, the sorted in-state neighbours. A **region** is a map from county index to a number of people, so one county can lie in several regions with part of its people in each. A district is a region with one seat; its share of a county is `people / pop[i]`, and it carries that share of the county's votes (the homogeneity assumption, section 5). A lean is a two-party margin in points, `100 (D - R) / (D + R)`.

### Sweep

`sweep(region, key)` orders the region's counties by growing a set from the county with the lowest key. Each step takes, among the counties that touch the set, the lowest-keyed one whose removal leaves the remainder connected (ties to the lower index). If none qualifies, it takes the lowest-keyed one anyway and then, forced, every county that step cut off from the largest remaining piece, breadth-first from the taken county. It returns the order and, per step, whether the remainder was connected before that step (`settled`).

The connectivity test (`connected_without`) first checks whether the candidate's remaining neighbours reach each other through each other, which is nearly always true on a county map and costs a few operations; only if not does it search the whole remainder.

### Cut

`cut(region, order, settled, k1, k, tol)` walks the order until `k1 / k` of the region's people are behind it. The county the target falls inside is split: the first side takes the people it still needs, the second side the rest. Both sides are contiguous if the cut point is `settled`, because the first side was grown through neighbours and the split county sits in both sides ("a split county is adjacent to itself and its neighbours"). With `tol > 0`, a target within `tol` of one seat's people of a county edge snaps to the edge and no county is split.

### Candidate cuts and their score

For a region of `k` seats, `candidates` runs these sweeps:

- geometric: `N_ANGLES` = 8 directions over half a turn, each from both ends (key = the centroid's projection on the direction). The seed rotates the whole fan by `rng.next() * pi / N_ANGLES`; that is the only use of the seed.
- partisan (only when `s > 0`): hostile-first by county lean, friendly-first by county lean, and rings round the region's hostile-vote centre.

At `s = 0` each sweep is cut at `k1 = floor(k / 2)` (the opposite sweep gives the ceiling). At `s > 0` each sweep is cut at every `k1` in {1, 2, floor(k/2), ceil(k/2), k-2, k-1}, which lets the drawer carve off one or two packed seats. Duplicate cuts are dropped. Each cut gets

```
score = s * (value(A, k1) + value(B, k - k1)) - max(1 - s, TIE_COMPACT) * KAPPA * cost
cost  = (inertia(A) + inertia(B)) / inertia(region)
```

`inertia` is the people-weighted second moment of the centroids about the region's own centre, so `cost` is the share of the region's spread the cut leaves inside the halves: low is compact. `value(region, k)` is an optimistic count of the seats the drawer can win from the region if geography did not exist: sort its people from most hostile to most friendly, cut that order into `k` equal slices, pack the first `k - w` slices one seat each, pool the rest over `w` seats, and take the best `w`. A seat is worth `Phi(lean / SIGMA_PTS)`, the chance of winning it, with `SIGMA_PTS` = 8 margin points. At `k = 1` the value is the district's real win chance. Contiguous cuts sort before non-contiguous ones, then by score, ties in sweep order.

### Recursion, backtracking, look-ahead

- `greedy(region, k)`: `k = 1` returns the region; a single-county region returns `k` equal shares; otherwise take the best cut and recurse on both sides. If a side cannot be finished contiguously, try the next cut, up to `BACKTRACK_TRIES` = 6, then report failure to the caller. Results are memoised by region.
- `split(region, k)` (partisan maps only): finish the best `ROLLOUTS` = 4 cuts, plus the most compact cut, with `greedy`; score each finished plan with `objective = s * expected seats - max(1 - s, TIE_COMPACT) * PLAN_KAPPA * k * sum(inertia(district)) / inertia(region)`; keep the best plan's first cut and recurse on its two sides with look-ahead again.
- `draw`: neutral is `greedy` on the whole state. Partisan is `split`, then a guard: also draw the maps for `s / 2` and `0` and keep whichever scores best under this strength's objective, so a stronger setting never does worse than a weaker one by its own measure.
- If the whole state cannot be finished contiguously, `greedy(..., force)` takes the best cut regardless and the plan has a non-contiguous district. This did not happen in any measured run.

### Porting notes

- No random numbers beyond one `mulberry32` draw per map. Every choice is a sort with the county index as the last key; sums run in sorted index order.
- `math.cos` and `math.sin` build the direction fan: use `cosF` and `sinF`, or a fixed table of unit vectors. `math.erf` (in `phi`) has no JavaScript equivalent: write `Phi` from `expF`, or replace it with a logistic. `math.sqrt` is not used in the hot path.
- People are f64. Deviation is float noise (2e-13 %), but shares of the same county in several districts sum to the county only to about 1e-9 people. If exact integers are wanted, cut in whole people and give the remainder to the lower-indexed side.
- The memo key is the seat count plus (county, people rounded to 3 places). In TypeScript build a string from integer milli-people.
- Recursion depth is at most the seat count (53).

## 4. Measured results

2000 apportionment (the real seat table), 2000 base populations, 2000 presidential leans, uniform swing 0, seed 1, `tol` 0. Five maps per state: Republican drawer at s = 1 and 0.5, neutral, Democratic drawer at 0.5 and 1. "Expected D seats" is the sum of `Phi(lean / 8)` over districts; "hard" counts districts with a Democratic lean. Python 3.15 on the dev PC.

| Measure | Result |
|---|---|
| Max population deviation, any district, any of the 250 maps | 2.0e-13 % (float noise) |
| Contiguous | every district of every map, all 50 states |
| Runtime, neutral | 0.5 s for all 50 states; slowest Texas 0.12 s |
| Runtime, partisan s = 1 | 16.5 s for all 50 states (one drawer); slowest Texas 3.3 s and Ohio 3.1 s |
| Runtime, all five maps of all states | 44 s |
| Deterministic | two runs give the same digest of every district (`ffb5ee3a71c6364c`) |
| Counties split (in more than one district), all states | 284 neutral, 272 D-drawn, 266 R-drawn; 82 counties are larger than a seat and must be split |
| Smallest share of a county in a district | 0.0001 (Ohio); slivers such as "Rusk 99.9%" are common |
| Expected D seats of 435: R 1.0 / R 0.5 / neutral / D 0.5 / D 1.0 | 179.1 / 192.0 / 199.7 / 212.6 / 225.3 |
| Hard D seats: R 1.0 / neutral / D 1.0 | 154 / 194 / 236 |
| For scale: D seats in proportion to each state's two-party vote | 218.1 |
| For scale: the no-geography bound (`value` of each whole state) | 160.4 (R drawing) to 272.7 (D drawing) |

The neutral map gives Democrats 200 expected seats on 50.3% of the two-party vote. That is the known cost of their voters being concentrated in cities, and it appears here without being modelled.

Variants:

| Variant | Expected D seats R 1.0 / R 0.5 / neutral / D 0.5 / D 1.0 | Notes |
|---|---|---|
| seed 2 | 178.9 / 191.7 / 199.5 / 211.5 / 225.9 | hard 153 / 193 / 238 |
| seed 3 | 179.2 / 191.3 / 200.0 / 211.6 / 226.0 | hard 153 / 194 / 239 |
| `--tol 0.005` | 179.5 / 191.6 / 199.7 / 212.4 / 225.1 | max deviation 0.65% (tolerances compound down the recursion); split counties 254 instead of 284; smallest share 0.0017 |
| `--sigma 4` | 162.5 / 175.6 / 194.6 / 220.5 / 234.2 | a sharper seat model widens the gerrymander range from 46 to 72 seats |

Per state (expected D seats; the full table with bounds, spread and timings is `results/summary.md`):

| State | Seats | Counties | Over a seat | Split (neutral) | R 1.0 | R 0.5 | Neutral | D 0.5 | D 1.0 | Hard R1 / N / D1 | By vote share |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AK | 1 | 29 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0 / 0 / 0 | 0.3 |
| AL | 7 | 67 | 1 | 6 | 0.21 | 0.34 | 0.54 | 0.54 | 1.22 | 0 / 0 / 1 | 3.0 |
| AR | 4 | 75 | 0 | 3 | 0.99 | 1.54 | 1.58 | 1.54 | 1.70 | 0 / 2 / 2 | 1.9 |
| AZ | 8 | 15 | 2 | 3 | 1.84 | 1.89 | 1.94 | 1.93 | 2.25 | 1 / 2 / 3 | 3.7 |
| CA | 53 | 58 | 14 | 21 | 31.33 | 32.62 | 33.14 | 34.29 | 35.14 | 26 / 30 / 33 | 29.8 |
| CO | 7 | 64 | 0 | 3 | 1.66 | 1.66 | 1.88 | 2.23 | 3.01 | 2 / 2 / 3 | 3.2 |
| CT | 5 | 8 | 3 | 4 | 4.80 | 4.83 | 4.83 | 4.83 | 4.86 | 5 / 5 / 5 | 3.0 |
| DE | 1 | 3 | 0 | 0 | 0.95 | 0.95 | 0.95 | 0.95 | 0.95 | 1 / 1 / 1 | 0.6 |
| FL | 25 | 67 | 7 | 17 | 10.79 | 11.55 | 12.06 | 12.86 | 13.47 | 9 / 12 / 14 | 12.5 |
| GA | 13 | 159 | 2 | 12 | 1.56 | 2.41 | 2.55 | 4.08 | 4.67 | 1 / 2 / 5 | 5.7 |
| HI | 2 | 5 | 1 | 1 | 1.97 | 1.98 | 1.98 | 1.98 | 1.98 | 2 / 2 / 2 | 1.2 |
| IA | 5 | 99 | 0 | 4 | 2.38 | 2.55 | 2.77 | 2.83 | 2.99 | 1 / 3 / 4 | 2.5 |
| ID | 2 | 44 | 0 | 1 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0 / 0 / 0 | 0.6 |
| IL | 19 | 102 | 2 | 10 | 10.91 | 11.26 | 11.59 | 11.59 | 12.67 | 9 / 11 / 12 | 10.7 |
| IN | 9 | 92 | 1 | 7 | 0.35 | 1.07 | 1.34 | 1.78 | 1.90 | 0 / 1 / 2 | 3.8 |
| KS | 4 | 105 | 0 | 3 | 0.01 | 0.13 | 0.12 | 0.50 | 0.65 | 0 / 0 / 1 | 1.6 |
| KY | 6 | 120 | 1 | 5 | 0.16 | 0.45 | 0.48 | 1.16 | 1.16 | 0 / 0 / 2 | 2.5 |
| LA | 7 | 64 | 0 | 6 | 1.30 | 1.38 | 1.42 | 1.53 | 1.86 | 1 / 1 / 1 | 3.2 |
| MA | 10 | 14 | 5 | 7 | 9.96 | 9.97 | 9.97 | 9.97 | 9.99 | 10 / 10 / 10 | 6.5 |
| MD | 8 | 24 | 3 | 7 | 4.93 | 5.13 | 5.27 | 6.29 | 6.29 | 4 / 5 / 6 | 4.7 |
| ME | 2 | 16 | 0 | 1 | 1.42 | 1.46 | 1.46 | 1.46 | 1.51 | 2 / 2 / 2 | 1.1 |
| MI | 15 | 83 | 3 | 10 | 7.39 | 8.23 | 8.22 | 9.05 | 9.42 | 6 / 9 / 10 | 7.9 |
| MN | 8 | 87 | 1 | 6 | 4.04 | 4.40 | 4.71 | 4.76 | 5.11 | 3 / 5 / 6 | 4.1 |
| MO | 9 | 115 | 2 | 7 | 2.92 | 3.21 | 3.18 | 3.54 | 4.25 | 2 / 3 / 5 | 4.3 |
| MS | 4 | 82 | 0 | 3 | 0.07 | 0.19 | 0.22 | 0.27 | 0.92 | 0 / 0 / 1 | 1.7 |
| MT | 1 | 56 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0 / 0 / 0 | 0.4 |
| NC | 13 | 100 | 2 | 12 | 1.73 | 1.86 | 2.17 | 2.94 | 3.41 | 1 / 1 / 3 | 5.7 |
| ND | 1 | 53 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0 / 0 / 0 | 0.4 |
| NE | 3 | 93 | 0 | 2 | 0.00 | 0.01 | 0.01 | 0.01 | 0.01 | 0 / 0 / 0 | 1.0 |
| NH | 2 | 10 | 0 | 1 | 0.87 | 0.87 | 0.87 | 0.87 | 0.87 | 0 / 0 / 1 | 1.0 |
| NJ | 13 | 21 | 3 | 9 | 10.53 | 10.58 | 10.82 | 11.31 | 11.76 | 11 / 11 / 13 | 7.6 |
| NM | 3 | 33 | 0 | 2 | 1.27 | 1.45 | 1.51 | 1.56 | 1.62 | 1 / 2 / 2 | 1.5 |
| NV | 3 | 17 | 1 | 1 | 1.19 | 1.59 | 1.61 | 1.61 | 1.61 | 1 / 2 / 2 | 1.4 |
| NY | 29 | 62 | 9 | 17 | 24.51 | 24.89 | 25.06 | 25.39 | 25.59 | 24 / 26 / 27 | 18.3 |
| OH | 18 | 88 | 3 | 15 | 5.66 | 6.52 | 7.65 | 7.72 | 8.31 | 5 / 9 / 8 | 8.7 |
| OK | 5 | 77 | 0 | 4 | 0.02 | 0.10 | 0.12 | 0.10 | 0.25 | 0 / 0 / 0 | 1.9 |
| OR | 5 | 36 | 0 | 3 | 1.78 | 1.79 | 2.25 | 3.22 | 3.31 | 1 / 2 / 4 | 2.5 |
| PA | 19 | 67 | 3 | 15 | 8.90 | 9.64 | 9.91 | 10.38 | 11.18 | 9 / 9 / 13 | 9.9 |
| RI | 2 | 5 | 1 | 1 | 2.00 | 2.00 | 2.00 | 2.00 | 2.00 | 2 / 2 / 2 | 1.3 |
| SC | 6 | 46 | 0 | 5 | 0.43 | 0.60 | 1.15 | 1.18 | 1.32 | 0 / 1 / 2 | 2.5 |
| SD | 1 | 66 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0 / 0 / 0 | 0.4 |
| TN | 9 | 95 | 1 | 8 | 3.22 | 3.53 | 3.67 | 3.82 | 4.25 | 3 / 3 / 5 | 4.3 |
| TX | 32 | 254 | 6 | 19 | 2.93 | 3.98 | 4.15 | 4.82 | 5.14 | 2 / 3 / 4 | 12.5 |
| UT | 3 | 29 | 1 | 1 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0 / 0 / 0 | 0.8 |
| VA | 11 | 134 | 1 | 8 | 2.14 | 2.78 | 2.80 | 3.31 | 3.61 | 1 / 2 / 4 | 5.0 |
| VT | 1 | 14 | 0 | 0 | 0.91 | 0.91 | 0.91 | 0.91 | 0.91 | 1 / 1 / 1 | 0.6 |
| WA | 9 | 39 | 2 | 5 | 5.21 | 5.34 | 5.59 | 5.76 | 6.43 | 5 / 6 / 7 | 4.8 |
| WI | 8 | 72 | 1 | 7 | 3.22 | 3.59 | 4.34 | 4.80 | 4.80 | 2 / 5 / 6 | 4.0 |
| WV | 3 | 55 | 0 | 2 | 0.63 | 0.77 | 0.87 | 0.87 | 0.93 | 0 / 1 / 1 | 1.4 |
| WY | 1 | 23 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0 / 0 / 0 | 0.3 |
| all | 435 | | | | 179.1 | 192.0 | 199.7 | 212.6 | 225.3 | 154 / 194 / 236 | 218.1 |

### The five states in detail (full district lists in `results/detail.md`)

- **California, 53 seats, 58 counties.** 14 counties are larger than a seat; Los Angeles alone is 14.9 seats. The neutral map splits 21 counties and has many districts that are just "Los Angeles 6.7%", all with the county's lean of +32.5. Expected D seats 31.3 / 33.1 / 35.1, hard 26 / 30 / 33. The no-geography bound for a Democratic drawer is 49.8: most of the gap is Los Angeles's surplus votes, which the model cannot spread because a Los Angeles share can only be mixed with a neighbour at the county's edge, one cut at a time.
- **Texas, 32 seats, 254 counties.** The slowest state. Democrats get 3 to 5 seats under every map, against 12.5 by vote share. Harris (5.2 seats, lean -11.7), Dallas (3.4, -7.9), Tarrant and Bexar all leaned Republican as whole counties in 2000, so every district inside them is Republican; their Democratic urban cores do not exist in county data. This is the clearest picture of the homogeneity problem. Texas is also where contiguity first failed (below).
- **Pennsylvania, 19 seats, 67 counties.** The best-behaved large state: 8.9 / 9.9 / 11.2 expected, hard 9 / 9 / 13. The Democratic map visibly cracks Philadelphia: instead of two districts of pure Philadelphia at +63 it draws Philadelphia-Delaware (+38), Philadelphia-Bucks (+33) and Berks-Philadelphia-Montgomery (+13), and it spreads Allegheny over four districts. The Republican map packs Allegheny into two districts and sinks Scranton and the Lehigh Valley into Republican territory, but gains only one expected seat.
- **New Hampshire, 2 seats, 10 counties.** One county (Rockingham) is split in every map, each time exactly on target. Both districts sit within three points of even, so expected seats are 0.87 in all five maps; the Democratic map does lift one district to +0.3, which flips the hard count from 0 to 1. With a seat model this smooth there is nothing to gain from a gerrymander in a small, evenly mixed state.
- **Wyoming, at large.** One district of all 23 counties, no sweeps run, margin -42.0.

## 5. What did not work, and failure cases

- **Plain greedy bisection broke contiguity.** The first version took the best cut at each level with no way back. Under an R 1.0 map of Texas it produced a region shaped like a Y (three arms of 550k, 266k and 471k people joined at Karnes County, 15k people, for two seats of 652k). No contiguous two-way split of that region exists at all: any side holding one arm plus enough of a second arm must take the junction county whole, which disconnects the third arm from what is left. One district came out in two pieces. Trying more sweeps (rings round every county, every seat split) rescued none of the 14 such regions. The fix that worked is backtracking: a region that cannot be finished reports failure and its parent takes its next cut. With that, all 250 maps (and the other seeds and variants) are contiguous. It remains a heuristic: contiguity is not proven, and `force` still exists for a state that exhausts its tries.
- **Unbounded backtracking blew up.** With no cap, Ohio's D 1.0 map made 327,000 backtracks and took 53 s. Capping each region at 6 tries gave the identical plans in 3.9 s. The cap is a tuning value with no guarantee behind it.
- **Scoring cuts by the optimistic bound alone was not monotone in s.** Before look-ahead, D 1.0 gave fewer Democratic seats than D 0.5 in Pennsylvania (10.20 against 10.77), because the bound rewards cuts whose promise cannot be realised lower down. Finishing the top few cuts greedily before choosing, plus the guard against weaker strengths, fixed the totals. Small reversals remain at s = 0.5, where the objective also buys compactness: Arkansas D 0.5 is 1.54 against neutral 1.58, and Missouri, Michigan and Kansas R 0.5 are up to 0.03 seats above neutral. Hard seat counts are not monotone either (Ohio 5 / 9 / 8), because the drawer maximises expected seats.
- **The gerrymander is weak compared with the bound and with history.** Full strength moves 21 to 26 expected seats each way nationally (about 5% of the House); the no-geography bound is 39 to 73. Search effort is not the limit: in an early comparison, 12 rollouts and 12 angles moved five test states (CA, TX, PA, OH, MI) by at most 0.65 seats each, and not always in the drawer's favour. The limits are homogeneous counties and the fact that a district can only mix a big county with its immediate neighbours.
- **More than a third of the country cannot be gerrymandered internally.** 38.6% of people live in the 82 counties larger than a seat, and 96 of the 435 neutral districts lie wholly inside one county, where every district has the same lean.
- **Slivers.** Exact equality produces shares like 0.01% of a county. `tol` 0.005 removes about a tenth of the splits at the price of 0.65% deviation, and the deviation compounds with depth because each level's target is a fraction of what the level above actually got.
- **s = 0.5 is not calibrated.** It lands between neutral and full strength nationally (192.0 and 212.6), but that is an accident of `KAPPA` = `PLAN_KAPPA` = 1; the exchange rate between a seat and a unit of sprawl has no principled value yet.
- **Not done:** 1990 apportionment and 1990 populations (the table carries them but nothing was drawn), 2010 and 2020, any comparison with real enacted maps, and any parse of the Algara-Amlani file. The seat model's `SIGMA_PTS` = 8 is a guess, not fitted.

## 6. Open questions

1. **How should a share of a county carry lean?** Today a share has the county's lean, which erases urban cores (Texas) and makes surplus votes unspreadable (Los Angeles). Options, cheapest first: (a) keep it, and accept that big-county districts are clones; (b) give each county a within-county spread parameter and let the i-th of n shares of a county take the i-th slice of a normal distribution around the county lean, ordered by the drawer (packed slices for an opponent, even slices for a friend), which needs one number per big county and no geography; (c) split the 82 oversized counties into real sub-units (county subdivisions or 2000 state legislative districts), which needs sub-county returns that are not in any source above. Option (b) is the smallest change that would give Harris County a Democratic seat.
2. **Should districts aim at expected seats or at safe seats?** Maximising `Phi` with sigma 8 barely rewards turning a 45% seat into a 55% one. Real drawers target a margin. A threshold objective (count seats above +m points) would gerrymander harder and is cheaper to compute, but is not smooth.
3. **Is exact equality wanted?** Real congressional maps are equal to the person, but the game may prefer fewer split counties. If so, the tolerance needs to be applied to the final districts, not per cut.
4. **Whole people or fractions?** f64 shares are simplest. If the voter table needs integer people per county share, decide the rounding rule now.
5. **What is lean measured against?** The spike uses the raw 2000 two-party margin with turnout from 2000 votes. The sim's `lean_pts`, elasticity and turnout per county need definitions before districts can be scored the same way the election code will score them.
6. **Ferry edges.** Hawaii needs them; decide them by hand rather than by nearest centroid.
7. **Incumbents and continuity.** A redraw here ignores the old map entirely, so district numbers and homes change every census. The current `drawCensus` keeps a district's lean when it survives; a county-built map has no such notion yet.
8. **Voting Rights Act districts** are not modelled, and they shaped most real maps of the 1990s and 2000s in the South.

## 7. Leans for 1992 and 1996

Free county returns for 1992 and 1996 exist in exactly one place found, the Algara-Amlani Dataverse file (CC0, R binary, no Alaska, provenance of those years not confirmed). Recommended order:

1. **Preferred: convert the Algara-Amlani file once, offline**, into a CSV of FIPS, year, Democratic, Republican and total votes, check its state sums against the MIT state file (https://doi.org/10.7910/DVN/42MVDX, CC0) and commit the CSV with its citation. Use two-party margins: Perot took 19% in 1992 and 8% in 1996, and the total-vote column is there if a three-way model is wanted later. If the state sums do not match, or the provenance turns out to rest on a paid source, drop it.
2. **Fallback, and always for Alaska: the plan's default.** `county_margin_1992 = state_margin_1992 + (county_margin_2000 - state_margin_2000)`, all two-party, with the state's 1992 margin from the MIT state file. Re-centre after the shift so the people-weighted (better, turnout-weighted) mean of the county margins equals the state margin exactly, and clamp to +-100. Turnout: scale each county's 2000 total votes by the state's 1992-to-2000 ratio.
3. **Known bias of the fallback.** It freezes the 2000 geography. Between 1992 and 2000 the rural South, Appalachia and the rural Midwest moved toward the Republicans and large suburbs toward the Democrats, relative to their own states, so the fallback makes 1992's rural counties too Republican and its suburbs too Democratic. On the measurements above that would understate Democratic House seats in 1992 in exactly the states where they held rural districts. If only the fallback is available, add a rural-urban correction term per region rather than trusting the offsets as they are. I could not measure the size of the bias because I did not parse the 1992 file.
