# The 1995 world's counties

Builds `assets/worlds/1995/counties.csv` (3,142 rows) and `county-adjacency.csv` (18,582 rows) from public data (pivot 5.1, 5.4; D1027, D1028, D1030). The columns are fixed by `packages/sim-data/src/rows.ts` (`CountyRow`, `CountyAdjacencyRow`).

| File | What it does |
|---|---|
| `fetch.py` | Downloads the raw inputs into `raw/<name>/` (git-ignored, about 9 MB). |
| `build.py` | Joins them on the frozen vintage, writes the two CSVs and sets `features.counties` and the two counts in `manifest.json`. Prints every patch it makes. Every tuning value is a named constant at its top. |
| `rdata.py` | A reader for R `save()` files, which the 1992 returns come in. |
| `validate.py` | Checks the two CSVs against the world's politics tables. Reads no raw file. `--report` lists the counties larger than a House seat. |

Python 3, standard library only.

```
python -I -B tools/world-1995/counties/fetch.py
python -B tools/world-1995/gen.py                      # only if the world itself changed
python -I -B tools/world-1995/counties/build.py
python -B tools/world-1995/validate.py                 # runs counties/validate.py too
```

`gen.py` writes the state leans the counties are centred on, so `build.py` runs after it. A rerun of `gen.py` keeps the county files on disk; if it changed a state's lean, `validate.py` fails on that state's mean until `build.py` is rerun.

## Sources

Fetched on 2026-11-11.

| Data | URL | Licence or terms |
|---|---|---|
| Which counties touch, 2010 | https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency2010.txt | US Census Bureau: a federal government work, no copyright in the US (17 USC 105) |
| 1990 and 2000 census counts on 2000 county lines (PHC-T-4, table 1) | https://www2.census.gov/programs-surveys/decennial/2000/phc/phc-t-04/tab01.txt | Census, as above |
| 2000 estimates base on 2010 county lines | https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/county/co-est00int-tot.csv | Census, as above |
| County names and codes, 2010 | https://www2.census.gov/geo/docs/reference/codes/files/national_county.txt | Census, as above |
| Land area, 2010 Gazetteer | https://www2.census.gov/geo/docs/maps-data/data/gazetteer/Gaz_counties_national.zip | Census, as above |
| County shapes in the Albers USA plane, us-atlas 3.0.1 | https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-albers-10m.json | ISC (the package's `package.json`); the shapes are the Census 2017 cartographic boundary files |
| County presidential returns 1868 to 2020: Algara and Amlani, "Partisanship & Nationalization in American Elections: Evidence from Presidential, Senatorial, & Gubernatorial Elections in the U.S. Counties, 1872-2020", Electoral Studies, 2021 | https://doi.org/10.7910/DVN/DGUMFI, file `dataverse_shareable_presidential_county_returns_1868_2020.Rdata` (file id 5028532, version 1.1) | CC0 1.0 (the Dataverse record's licence field). The manual asks that the article be cited. |
| County presidential returns 2000 to 2016: MIT Election Data and Science Lab | https://raw.githubusercontent.com/MEDSL/county-returns/master/countypres_2000-2016.csv | **The GitHub repository has no licence file.** The same data is the lab's Dataverse record https://doi.org/10.7910/DVN/VOQCHQ, which is CC0 1.0 but sits behind a guestbook form that a script cannot pass. |

Two cautions on the returns:

- **Algara-Amlani provenance.** The record is CC0, but its manual does not say where the 1992 figures were compiled from; it points to the article. I did not read the article. What I checked: the file's 1992 state margins match `politics-usa.csv` (which `gen.py` took from the official state results) within 0.1 point in every state but Hawaii, once Missouri's total is patched (both below); and its national sums, 44,831,560 Democratic and 39,002,574 Republican votes without Alaska, are within a hundred votes of the official count as I remember it. That last comparison is against figures from memory, not a fetched file.
- **The MIT GitHub copy** is used in the default build only for Alaska's turnout. If the unlicensed copy must go, download the Dataverse file by hand (same columns, `countypres_2000-2024.tab`) or give Alaska a constant.

## Vintage

The frozen set is the 2010 census's counties and equivalents of the 50 states and DC with Bedford city VA merged into Bedford County: 3,142 units, with the ids us-atlas 3.0.1 uses (D1028). `build.py` takes the set from the adjacency file and maps every other source onto it:

| Case | What the build does |
|---|---|
| Bedford city VA (51515) | Joined Bedford County (51019) in 2013. People, land, votes and neighbours are added to the county. |
| Clifton Forge city VA (51560) | Joined Alleghany County (51005) in 2001. In the 1990 and 2000 counts and the 1992 returns; added to the county. |
| South Boston city VA (51780) | Joined Halifax County (51083) in 1995. PHC-T-4's 1990 column for Halifax leaves it out, so its 1990 count (6,997) is added by a constant, which brings Virginia's sum to the 1990 state count exactly; its 1992 votes are added to Halifax. |
| Yellowstone National Park MT (30113) | Divided between Gallatin and Park counties in 1997 and missing from PHC-T-4. Its 52 people of 1990, the gap between the other counties' sum and Montana's 1990 count, are put in Park County (30067). A choice: the source does not say which county they lived in. |
| Shannon County SD (46113) | Renamed Oglala Lakota County (46102) in 2015. Written as 46102, with the new name. |
| Wade Hampton Census Area AK (02270) | Renamed Kusilvak Census Area (02158) in 2015. Written as 02158, with the new name. |
| Dade County FL (12025) | Renumbered Miami-Dade (12086) in 1997. The 1992 returns say 12025. |
| Skagway-Hoonah-Angoon AK (02232) | Split in 2007 into Hoonah-Angoon (02105) and Skagway (02230). Its 1990 people (3,680) are split by the successors' shares of the 2000 estimates base: 2,758 and 922. |
| Wrangell-Petersburg AK (02280) | Split in 2008 into Petersburg (02195) and Wrangell (02275): 7,042 people become 4,468 and 2,574, the same way. |
| Prince of Wales-Outer Ketchikan AK (02201) | In 2008 Outer Ketchikan went to Ketchikan Gateway Borough (02130) and the rest became Prince of Wales-Hyder (02198). The share moved is Ketchikan Gateway's gain between the 2000 count and the 2000 estimates base, 4 people of 6,146: of the 6,278 people of 1990, 4 go to Ketchikan Gateway. Meyers Chuck, which went to Wrangell, is ignored (about 20 people). |
| Broomfield County CO (08014) | Made in 2001 from parts of Adams, Boulder, Jefferson and Weld. Its 1990 people are the city of Broomfield's 1990 census count, 24,638 (a constant, from memory of the census figure and not checked against a fetched file; the state total does not depend on it), taken from the four parents in proportion to what each lost between the 2000 count and the 2000 estimates base: 9,954, 13,563, 1,014 and 107. Its lean and turnout are the four parents' pooled 1992 figures. |
| Kansas City MO (MIT code 36000) | Reported apart from Jackson County in later MIT years; added to Jackson County (29095). It carries no votes in 2000. |
| Kalawao County HI (15005) | The MIT file counts it with Maui, so the 2000 path gives it Maui's split. The 1992 file has its own row (75 votes), which the default build uses. |
| Connecticut | The eight counties, not the 2022 planning regions. Every source here predates the change. |
| Alaska | No borough returns exist in either file (MIT's rows are 40 state house districts; Algara-Amlani leaves the state out). See "lean_pts". |
| Falls Church, Lexington and Manassas Park VA | Zero-area slivers in the us-atlas 10m file. Their centroid is the mean point of the shape's ring. |
| Watonwan County MN | Line 9629 of the adjacency file has its code but not its name. The reader keys each block on the code column. |

## Columns

### pop_1990

The 1990 census count: PHC-T-4's 1990 column, moved onto the vintage by the table above. The 3,142 counties sum to 248,709,873, the 1990 census's resident population, and each state's sum equals the 1990 state count in `gen.py` exactly (`validate.py` holds it to `politics-usa-era.csv`, which is rounded to a thousand).

PHC-T-4 notes that its 1990 figures are as first published, without later boundary revisions. Apart from the cases in the table, a county whose border moved between 1990 and 2010 keeps the people of its 1990 border.

### lean_pts

Points toward the Democrats, as `politics-usa.csv` `dem_margin_pts`: a margin in points of the total vote (Democratic minus Republican share), less the nation's 1992 margin of 5.6. A county at 0 voted as the nation did.

```
lean = state_lean + (county_margin - state_margin)       both margins from the same returns
```

then shifted by a constant per state so that the mean of the state's counties, weighted by `pop_1990`, is the state's lean. A county is clamped to +-`LEAN_CLAMP_PTS` (95) before the shift is recomputed; no county reaches the clamp. Leans are written to two places, and `validate.py` holds each state's mean within 0.01 point.

**Which returns (D1030).** D1027 set the offsets to come from the 2000 returns unless free 1992 county returns were found. `rdata.py` reads the Algara-Amlani file, so `RETURNS_YEAR = "1992"` is the default: the offsets are the real 1992 county margins, in the same units and year as the state leans. Setting it to `"2000"` gives D1027's fallback from the MIT file. The two differ: across 3,110 counties the 2000 offset is a median 6.5 points more Republican than the 1992 one, and the people-weighted mean absolute difference is 7.1 points (the rural shift of the 1990s that the spike's README predicted).

Patches to the 1992 file:

- **St. Louis County MO (29189)** carries a total of 848,090, exactly twice its two-party vote, which puts the state at 2,704,639 against an official total of 2,391,565. `TOTAL_FIX_1992` sets it to 535,016, the total that makes the state sum right (a third-party share of 20.7%, close to the state's). The Democratic and Republican counts are not affected. The official total is from memory, not from a fetched file; before the patch Missouri's margin was 1.2 points off `politics-usa.csv`, after it 0.05.
- **Maui County HI** seems to include Kalawao's 75 votes, which the file also lists under Kalawao (the state sums run 48 Democratic and 24 Republican votes over the official ones). Left as it is.

**Alaska.** Every borough takes the state's lean, offset 0. A density term was considered and left out: in Alaska the least dense places (the western and northern Native-majority census areas) and the densest part of the southeast (Juneau) are the Democratic ones, while Anchorage, Matanuska-Susitna, Kenai and Fairbanks are Republican, so density does not order the boroughs. Alaska has one House seat, so this touches no district, only the voter table. TODO: build borough leans from the 1992 or 2000 precinct returns of the Alaska Division of Elections.

**Hawaii's state lean.** The 1992 file gives Hawaii a margin of 11.4 points (the official count: 48.1% to 36.7%), while `gen.py` has 12.9. The counties are centred on the world's figure as instructed. The number in `gen.py` looks wrong and is not this folder's to change.

### spread

Half the range of lean inside the county, in points (pivot 5.4, D1028):

```
size   = clamp(log10(pop_1990 / 20,000) / log10(1,000,000 / 20,000), 0, 1)
dens   = clamp(log10(density / 20) / log10(2,000 / 20), 0, 1)        density = pop_1990 per square mile of land
spread = 45 * size * (0.5 + 0.5 * dens)                               then capped at 100 - |lean|
```

Constants: `SPREAD_MAX_PTS`, `SPREAD_POP_LO`, `SPREAD_POP_HI`, `SPREAD_DENSITY_LO`, `SPREAD_DENSITY_HI`, `SPREAD_DENSITY_FLOOR`, `LEAN_LIMIT_PTS`. Land area is the 2010 Gazetteer's `ALAND_SQMI`.

People set the scale and density raises it by up to double, so a large desert county (San Bernardino: 28.7) gets less than a dense one of the same size (Allegheny: 44.6). 1,465 counties under 20,000 people have spread 0; the median is 0.7; the 90th centile 17.7; Los Angeles, Cook, Dallas and the New York boroughs have 45. The 45 is a judgement: precinct margins inside a large metropolitan county run from about 60 points one way to 90 the other, and the model's straight line has to cover most of that.

Sanity target: with `python tools/world-1995/counties/validate.py --report`, 47 of the 82 counties larger than one 1990 House seat can yield a district leaning each way when cut into seat-sized intervals (Harris -47 to +24, Los Angeles -24 to +60, Cook -16 to +64, Maricopa -39 to +10, Dallas -42 to +21, King -8 to +44). The 35 that cannot are either barely larger than a seat, so no interval of them is far from the county's own lean (Travis, Multnomah), or lopsided (Manhattan, Philadelphia, Baltimore city).

### elasticity

`ELASTICITY_DEFAULT` = 1 for every county. No free source gives a county figure; drift (pivot 5.2) moves it from there.

### turnout

Presidential votes of 1992 over the 1990 census count (people of every age, so the national figure is about 0.42), clamped to `TURNOUT_MIN` 0.15 and `TURNOUT_MAX` 0.7. Residents are on the returns' own lines: Broomfield's parents are divided by their people before Broomfield is carved out. Raised to 0.15: Chattahoochee GA and Liberty GA (army posts). Lowered to 0.7: nine small or resort counties where more ballots were cast than the 1990 residents explain (Hinsdale CO at 1.02, Loving TX, Nantucket MA, San Juan WA, Teton WY and others). Alaska: the state's 2000 votes over its 2000 count, 0.455, for every borough.

### centroid_x, centroid_y

**Projection.** The plane of us-atlas's `counties-albers-10m.json`: d3's `geoAlbersUsa` (a composite of three conic projections: Albers equal-area for the lower 48 with parallels 29.5 and 45.5 north, centred on 96 west; Alaska in its own Albers conic, scaled to 0.35 and set in the lower left; Hawaii in its own, set beside it), at scale 1300, fitted to a 975 by 610 box with x to the right and y down. A unit is about 4.9 km in the lower 48. The centroid is the area centroid of the county's outer rings in that plane, written to three places.

Within a state the plane is a single conic projection, so sweeps by centroid inside a state are sound. Distances between Alaska or Hawaii and the lower 48 mean nothing, and Alaska's units are 2.9 times longer on the ground. A map drawn from the same us-atlas file lines up with these points with no further transform.

## Adjacency

One row per ordered pair, sorted, 18,582 rows (9,291 pairs; 1,308 of them cross a state line). The source is the Census 2010 file, which counts water and corner contact as touching, so it is wider than shared land borders. Bedford city's neighbours become Bedford County's. Every pair in the file is already two-way.

**Edges added by hand** (`FERRY_EDGES`): the file's only Hawaii pair is Maui-Kalawao, which leaves the state in four pieces.

| Edge | Why |
|---|---|
| Hawaii (15001) - Maui (15009) | Alenuihaha Channel |
| Honolulu (15003) - Maui (15009) | Kaiwi Channel: Oahu to Molokai, which is in Maui County |
| Honolulu (15003) - Kauai (15007) | Kauai Channel |

**Island counties checked, no edge needed.** The Census file already joins San Juan WA (to Clallam, Island, Jefferson, Skagit, Whatcom), Nantucket MA (to Dukes), Dukes MA (to Barnstable, Bristol, Nantucket), Richmond NY (to Kings and Queens, and four New Jersey counties), Michigan's two peninsulas, Aleutians West AK (to Aleutians East) and Kalawao HI (to Maui). With the three ferry edges every state's counties are one piece and no county is without a neighbour. The whole graph has three pieces: the 48 states with DC, Alaska, and Hawaii.

## Checks

`validate.py` (also run by `tools/world-1995/validate.py`, which `scripts/check-fast` and the gate run): the columns; 3,142 rows and the manifest's counts; five-digit codes, unique and in order; one state per code prefix, every state of `politics-usa.csv` with a county; the national sum equal to the 1990 census and each state's within 0.2% of `politics-usa-era.csv`; lean within 95 and lean plus spread within 100; turnout and elasticity in range; centroids on the plane; each state's people-weighted mean lean equal to the state's lean within 0.01; adjacency rows between known counties, sorted, unique, two-way, never a county with itself; every state connected; three pieces in all.

The cross-file checks have a twin in `packages/sim-data/src/checks.ts` (`counties`), which the headless `--check-data --world 1995` and the app's loader run.

## Not done

- The 1996 returns are in the Algara-Amlani file and unused. Averaging 1992 and 1996 offsets would damp one-election noise in small counties.
- Elasticity is a constant and turnout is one election's.
- Border changes between 1990 and 2010 other than those in the table are not corrected in `pop_1990`.
- The provenance of the Algara-Amlani 1992 figures is not confirmed beyond the record's CC0 licence and the sums above.
