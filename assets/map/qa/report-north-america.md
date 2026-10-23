# Map QA report: north-america

_Written by `tools/map-pipeline/run.py --region north-america` (pipeline pb-1). Source of the rows: `provinces-north-america.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 260 provinces of `provinces-north-america.csv` have a crosswalk row and pixels (17 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 260 |
| ... BMU | 1 |
| ... CAN | 59 |
| ... GRL | 3 |
| ... MEX | 49 |
| ... SPM | 1 |
| ... USA | 147 |
| Regions matched | 99 of 99 |
| Provinces by method: admin1 | 40 |
| Provinces by method: admin2 | 180 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 40 |
| Flagged for review (confidence < 0.6) | 4 |
| Placed by a builder hint (`hints/north-america.toml`) | 30 |
| Tiny (under 64 px) | 17 |
| Given a pixel at their interior point (no pixel centre inside) | 0 |
| More than one part (islands, exclaves) | 120 |
| Coastal flag differs from the CSV | 31 |
| Small for their region (not Metro, under 5% of the region's mean) | 4 |
| Voronoi-split blocks where one province takes 75% or more | 7 |
| Places named in a province's name or notes that lie in another province | 2 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 0 |
| Admin-1 units left without a province | 0 |
| Sea links with a province of this file | 15 |
| City probe points (fail on a mismatch; D686) | 33 pass, 0 mismatch, 0 listed |
| Metro reach scan rows (listed; D686) | 8 |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) | 4 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes) | Public domain | yes |
| geoBoundaries gbOpen CAN ADM2 (Statistics Canada (StatCan)) | Open Government Canada 2.0 | yes |
| geoBoundaries gbOpen CAN ADM3 (Statistics Canada (StatCan)) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen MEX ADM2 (World Bank) | Creative Commons Attribution 4.0 (CC BY 4.0) | yes |
| geoBoundaries gbOpen USA ADM2 (United States Census Bureau, MAF/TIGER Database) | Public Domain | yes |

Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, public domain and the attribution-only government licences OGL-Canada 2.0, OGL-UK 3.0, Data licence Germany Attribution 2.0, Etalab 2.0, Spain's INE licence, Singapore ODL 1.0 and Korea OGL Type 1 (D685); a region whose country has no allowed ADM2 is split by Voronoi.

## Low-confidence rows for review

The automatic match placed these provinces from direction words or a Metro's core city only. Check each on the preview; fix a wrong one with a hint in `tools/map-pipeline/hints/north-america.toml` and rerun.

| Province | Name | Region | Method | Confidence | How it was placed |
|---|---|---|---|---|---|
| US-0048 | Southern Illinois | Illinois | admin2 | 0.45 | seeds: region part +0.00,-1.00; 34 whole admin2 units |
| US-0057 | Eastern Kentucky Coalfields | Kentucky | admin2 | 0.45 | seeds: region part +1.00,+0.00; 59 whole admin2 units |
| US-0011 | Westside-Hollywood | California | voronoi | 0.5 | seeds: metro core Los Angeles moved -1.00,+0.00; 0 whole admin2 units, split: Los Angeles |
| US-0039 | Hartsfield-South Metro | Georgia | admin2 | 0.5 | seeds: metro core Atlanta moved +0.00,-1.00; 4 whole admin2 units |

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| CA-0002 | Peel-Mississauga | seeds: point -79.64,43.59 (hint); point -79.76,43.69 (hint); 0 whole admin2 units, split: Toronto |
| CA-0003 | York-Markham | seeds: point -79.34,43.86 (hint); point -79.46,44.05 (hint); point -79.5,43.84 (hint); 0 whole admin2 units, split: Toronto |
| CA-0016 | Monteregie-South Shore | seeds: point -73.25,45.31 (hint) (snapped to land); point -73.52,45.53 (hint); 1 whole admin2 units |
| CA-0019 | Laval-Laurentides | seeds: point -73.75,45.6 (hint); point -74.0,45.78 (hint); point -74.6,46.12 (hint); 3 whole admin2 units |
| CA-0023 | Saguenay-Lac-Saint-Jean | seeds: point -71.07,48.43 (hint); point -72.25,48.55 (hint); 1 whole admin2 units |
| CA-0024 | Gaspesie-Bas-Saint-Laurent | seeds: point -64.48,48.83 (hint) (snapped to land); point -68.52,48.45 (hint); 2 whole admin2 units |
| CA-0027 | Surrey-Fraser Valley | seeds: point -121.95,49.16 (hint); point -122.3,49.05 (hint); point -122.85,49.19 (hint); 0 whole admin2 units, split: Lower Mainland--Southwest / L* |
| CA-0028 | Vancouver Island | seeds: point -123.37,48.43 (hint); point -123.94,49.17 (hint); 1 whole admin2 units |
| CA-0032 | Northeast BC | seeds: point -120.85,56.25 (hint); 1 whole admin2 units |
| CA-0034 | Industrial Heartland | seeds: point -113.21,53.71 (hint); 0 whole admin2 units, split: Edmonton |
| CA-0042 | Southeast Saskatchewan | seeds: point -102.99,49.14 (hint); point -103.87,49.66 (hint); 0 whole admin2 units, split: Regina--Moose Mountain |
| CA-0048 | Cape Breton | seeds: point -60.19,46.14 (hint); 1 whole admin2 units |
| CA-0049 | Annapolis Valley-South Shore | seeds: point -64.5,45.08 (hint); point -64.52,44.38 (hint); point -66.12,43.84 (hint); 2 whole admin2 units |
| CA-0059 | Kivalliq-Kitikmeot | seeds: point -105.06,69.12 (hint); point -92.09,62.81 (hint); 0 whole admin2 units, split: Nunavut |
| MX-0002 | Polanco-Santa Fe | seeds: point -99.25,19.36 (hint); unit Cuajimalpa de Morelos (hint); unit Miguel Hidalgo (hint); 5 whole admin2 units |
| MX-0010 | Rural Jalisco | seeds: place Puerto Vallarta; unit Arandas (hint); unit Lagos de Moreno (hint); unit Puerto Vallarta at place Puerto Vallarta; unit San Juan de los Lagos (hint); unit Tepatitlán de Morelos (hint); unit Tequila (hint); 112 whole admin2 units |
| US-0013 | San Fernando Valley | seeds: point -118.12,34.58 (hint); point -118.14,34.7 (hint); point -118.45,34.22 (hint); point -118.54,34.39 (hint); 1 whole admin2 units, split: Los Angeles |
| US-0015 | Inland Empire | seeds: unit Riverside (hint); unit San Bernardino (hint); 1 whole admin2 units, split: Riverside |
| US-0044 | Chicago Loop | seeds: point -87.63,41.88 (hint); point -87.66,41.95 (hint); 0 whole admin2 units, split: Cook |
| US-0045 | South Side-Calumet | seeds: point -87.6,41.78 (hint); point -87.62,41.62 (hint); 0 whole admin2 units, split: Cook |
| US-0046 | DuPage-Northwest Suburbs | seeds: point -87.9,41.98 (hint); point -87.98,42.09 (hint); point -88.08,42.03 (hint); unit DuPage; 4 whole admin2 units, split: Cook |
| US-0062 | Suburban Maryland | seeds: unit Montgomery (hint); unit Prince George's (hint); 5 whole admin2 units |
| US-0083 | South Jersey | seeds: unit Burlington (hint); unit Camden (hint); unit Gloucester (hint); unit Salem (hint); 6 whole admin2 units |
| US-0086 | Manhattan | seeds: unit New York (hint); 1 whole admin2 units |
| US-0087 | Brooklyn-Queens | seeds: unit Kings (hint); unit Queens (hint); unit Richmond (hint); 3 whole admin2 units |
| US-0089 | Long Island | seeds: unit Nassau (hint); unit Suffolk (hint); 2 whole admin2 units |
| US-0090 | Hudson Valley-Capital Region | seeds: place Albany; point -73.92,41.7 (hint); point -73.99,41.93 (hint); point -74.01,41.5 (hint); unit Albany at place Albany; 20 whole admin2 units |
| US-0120 | Plano-Frisco | seeds: unit Collin (hint); unit Denton (hint); 8 whole admin2 units |
| US-0124 | Woodlands-Katy | seeds: point -95.78,29.8 (hint); unit Montgomery (hint); unit Waller (hint); 8 whole admin2 units, split: Harris |
| US-0137 | Northern Virginia | seeds: unit Alexandria (hint); unit Arlington (hint); unit Fairfax (hint); unit Loudoun (hint); unit Prince William (hint); 12 whole admin2 units |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| PM-0001 | Saint Pierre and Miquelon | 3 | 1 | 2814.5, 1458.5 |
| BM-0001 | Bermuda | 4 | 3 | 2621.5, 1848.5 |
| US-0086 | Manhattan | 4 | 2 | 2413.5, 1625.5 |
| MX-0001 | Cuauhtemoc-Centro | 8 | 1 | 1840.5, 2161.5 |
| MX-0002 | Polanco-Santa Fe | 10 | 1 | 1837.5, 2164.5 |
| US-0030 | Washington DC | 13 | 1 | 2342.5, 1676.5 |
| CA-0001 | Downtown Toronto | 18 | 1 | 2287.5, 1547.5 |
| US-0106 | Philadelphia City | 22 | 1 | 2388.5, 1646.5 |
| US-0044 | Chicago Loop | 26 | 1 | 2099.5, 1596.5 |
| MX-0005 | Naucalpan-Tlalnepantla | 30 | 2 | 1838.5, 2158.5 |
| CA-0015 | Montreal | 34 | 2 | 2421.5, 1494.5 |
| US-0087 | Brooklyn-Queens | 39 | 2 | 2414.5, 1629.5 |
| MX-0003 | Iztapalapa-Coyoacan | 42 | 1 | 1841.5, 2166.5 |
| US-0011 | Westside-Hollywood | 45 | 1 | 1393.5, 1802.5 |
| US-0081 | Jersey City-Hudson Waterfront | 51 | 1 | 2411.5, 1622.5 |
| US-0012 | Long Beach-Harbor | 56 | 5 | 1405.5, 1809.5 |
| MX-0004 | Ecatepec-Nezahualcoyotl | 60 | 2 | 1844.5, 2161.5 |

## Anchor cities

Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own name names lands on that province (and, for a Metro province, near its middle and in its largest 4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a province of that Metro, and each key city lands on one of its provinces (key-cities.csv).

| Check | Province | Place | Expected | Got |
|---|---|---|---|---|
| city part across water | US-0018 | San Francisco | the largest 4-connected part | a smaller part, joined to it across water only |
| own name elsewhere (allowed) | US-0086 | Manhattan | US-0086 (Natural Earth's only Manhattan is the Kansas town; New York City's point is checked as the Metro) | US-0054 |
| city on the edge | US-0130 | Laredo | US-0130 | MX-0030 |
| own name elsewhere (allowed) | MX-0001 | Cuauhtémoc | MX-0001 (Cuauhtemoc borough of Mexico City, not Cuauhtemoc in Chihuahua) | MX-0022 |

No misses; the rows above are allowed: a city part across a narrow strait, or a city whose own pixel a neighbour took while its province holds a touching pixel.

## Natural Earth labels

Natural Earth units whose capital another region of the country names (in a province name or notes) while their own region does not: the sign of NE giving units each other's names, as in Eritrea and Guyana (D687). Each row fails the step unless `[review] ne_label_ok` in the hints names the region.

None.

## City probe

Points of `tools/map-pipeline/checks/city-points.txt` whose expected province is in this file, looked up in province-index.png: a point passes on its pixel or one of the 8 around it (D686). The step fails on a mismatch.

| Point | Expected | Got | Result |
|---|---|---|---|
| Adak (-176.64, 51.88) | US | US-0003 | on it |
| Attu (173.18, 52.93) | US | US-0003 | nearest across water |
| Brooklyn (-73.95, 40.65) | US-0087 | US-0087 | on it |
| Chicago Loop (-87.63, 41.88) | US-0044 | US-0044 | on it |
| Coyoacan (-99.16, 19.35) | MX-0003 | MX-0003 | on it |
| Downtown Toronto (-79.38, 43.65) | CA-0001 | CA-0001 | on it |
| Ecatepec (-99.05, 19.6) | MX-0004 | MX-0004 | on it |
| Guadalajara centro (-103.35, 20.67) | MX-0007 | MX-0007 | on it |
| Hollywood (-118.33, 34.1) | US-0011 | US-0010 | within a pixel |
| Hyde Park Chicago (-87.59, 41.79) | US-0045 | US-0045 | on it |
| Iztapalapa (-99.06, 19.36) | MX-0003 | MX-0003 | on it |
| Lancaster CA (-118.14, 34.69) | US-0013 | US-0013 | on it |
| Little Diomede (-168.93, 65.75) | US | US-0004 | on it |
| Long Beach (-118.19, 33.77) | US-0012 | US-0012 | on it |
| Los Altos Tepatitlan (-102.76, 20.82) | MX-0010 | MX-0010 | on it |
| Markham (-79.34, 43.86) | CA-0003 | CA-0003 | on it |
| Midtown Manhattan (-73.98, 40.75) | US-0086 | US-0086 | on it |
| Mississauga (-79.64, 43.59) | CA-0002 | CA-0002 | on it |
| Naucalpan (-99.24, 19.48) | MX-0005 | MX-0005 | on it |
| Nezahualcoyotl (-99.01, 19.4) | MX-0004 | MX-0004 | on it |
| Oshawa (-78.86, 43.9) | CA-0004 | CA-0004 | on it |
| Polanco (-99.19, 19.433) | MX-0002 | MX-0005 | within a pixel |
| Poughkeepsie (-73.92, 41.7) | US-0090 | US-0090 | on it |
| Santa Fe MX (-99.26, 19.36) | MX-0002 | MX-0002 | on it |
| Schaumburg (-88.08, 42.03) | US-0046 | US-0046 | on it |
| Surrey BC (-122.85, 49.19) | CA-0027 | CA-0027 | on it |
| Tequila (-103.84, 20.88) | MX-0010 | MX-0010 | on it |
| Tlalnepantla (-99.22, 19.54) | MX-0005 | MX-0005 | on it |
| Tlaquepaque (-103.31, 20.64) | MX-0009 | MX-0009 | on it |
| Van Nuys (-118.45, 34.19) | US-0013 | US-0013 | on it |
| Vancouver downtown (-123.12, 49.28) | CA-0026 | CA-0026 | on it |
| Zapopan (-103.39, 20.72) | MX-0008 | MX-0008 | on it |
| Zocalo (-99.133, 19.433) | MX-0001 | MX-0001 | on it |

## Metro reach

Metro provinces whose centroid is over 80 km from their Metro's city, that are over 4 times the Metro's median and 250 px, and regions where Metro provinces hold over 30% of the land beside rural ones (the D612 error). Listed for review; a Metro made of whole metropolitan units can be large by design.

| Check | Province or region | Detail |
|---|---|---|
| large for its Metro | US-0046 DuPage-Northwest Suburbs | 418 px, the Metro's median is 71 px (Metro Chicago) |
| large for its Metro | US-0013 San Fernando Valley | 661 px, the Metro's median is 115 px (Metro Los Angeles-Long Beach) |
| far from its Metro city | US-0033 Palm Beach | centroid 110 km from Miami (Metro Miami) |
| far from its Metro city | US-0027 Fairfield County | centroid 81 km from New York (Metro New York) |
| far from its Metro city | US-0089 Long Island | centroid 84 km from New York (Metro New York) |
| far from its Metro city | US-0005 Phoenix-Central | centroid 174 km from Phoenix (Metro Phoenix) |
| Metro share of a region | USA: Arizona | Metro provinces hold 37% of 16883 px beside 1 rural |
| Metro share of a region | USA: New Jersey | Metro provinces hold 53% of 1274 px beside 1 rural |

## Known for review

- CA-0003 York-Markham holds Scarborough and North York, which are in the City of Toronto: the Toronto economic region is split by Voronoi among Downtown Toronto (seeded at Toronto), Peel-Mississauga, York-Markham and Durham-Oshawa, and the York and Markham seeds sit closer to them. Left as is; a hint can move them to Downtown Toronto.
- CA-0058 Baffin-Iqaluit and CA-0059 Kivalliq-Kitikmeot split Nunavut (one economic region) by one straight Voronoi line through Ellesmere Island.

## Watched small provinces

The microstates, city-states and metro splits the plan names (P8: Singapore, the London and Beijing splits, Hong Kong and Macau): every one has pixels, and a tiny one a click target at its label point.

None in this file.

## Contested provinces

Drawn by our own province files (decision C), not the sources' de facto lines: each contested province sits in the region the CSV gives it, built as listed (an alias or carve hint where Natural Earth draws the land elsewhere). The game hatches them.

None in this file.

## Region matching

Regions not matched one-to-one by name: builder aliases, Natural Earth region groups, composite names matched part by part, carves (D676) and admin-1 units no region named, given to the touching region (D673). Check these on the preview too.

| Region | Matched by | Units |
|---|---|---|
| MEX: Ciudad de Mexico | alias hint -> MX-DIF | 1 |
| MEX: Yucatan | name match 100; plus unclaimed MEX+99? | 2 |
| USA: Alaska | name match 100; carve: builder polygon from no region | 1 |

## Land without a province

Natural Earth admin-1 units of this file's countries that no region claims and that touch no region of their country (overseas territories, remote islands). They stay water on the map.

None.

## Sea links

`sea` rows of province-adjacency.csv with a province of this file: coastal provinces whose shapes do not touch but face each other across a strait (D678).

CA-0001-US-0092, CA-0009-US-0098, CA-0014-US-0068, CA-0024-CA-0025, CA-0028-US-0140, CA-0047-CA-0055, CA-0048-CA-0055, CA-0049-CA-0050, CA-0051-CA-0055, CA-0053-PM-0001, CA-0058-GL-0003, US-0027-US-0089, US-0028-US-0089, US-0088-US-0089, US-0089-US-0111

## Small provinces

| Province | Name | Region | Pixels | Region mean |
|---|---|---|---|---|
| CA-0004 | Durham-Oshawa | Ontario | 107 | 6078 |
| CA-0015 | Montreal | Quebec | 34 | 13143 |
| CA-0034 | Industrial Heartland | Alberta | 232 | 9703 |
| GL-0002 | South Greenland-Kujalleq | Greenland | 6605 | 230637 |

## Uneven Voronoi splits

Blocks (ADM2 units, or admin-1 units for Greenland) that several provinces share, where one province takes most of the block. Check that the larger part belongs where it went.

| Region | Block | Shares |
|---|---|---|
| CAN:Alberta | Athabasca--Grande Prairie--Pe* | CA-0036 77%, CA-0035 23% |
| CAN:Alberta | Edmonton | CA-0033 86%, CA-0034 14% |
| CAN:Newfoundland and Labrador | West Coast--Northern Peninsul* | CA-0054 85%, CA-0053 15% |
| CAN:Nunavut | Nunavut | CA-0059 76%, CA-0058 24% |
| GRL:Greenland | Kommuneqarfik Sermersooq | GL-0003 79%, GL-0001 21% |
| USA:Arizona | Maricopa | US-0005 82%, US-0006 18% |
| USA:Texas | Dallas | US-0118 79%, US-0119 21% |

## Named places outside their province

A Natural Earth place matched in the name or notes that ended up in another province (usually a neighbour that names the same city more directly, as Long Beach-Harbor's notes name Los Angeles).

| Province | Name | Place | Lies in |
|---|---|---|---|
| US-0012 | Long Beach-Harbor | Los Angeles | US-0010 |
| US-0123 | Ship Channel-Baytown | Houston | US-0122 |

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| CA-0002 | Peel-Mississauga | 13 | Y | N |
| CA-0003 | York-Markham | 5 | Y | N |
| CA-0007 | Kitchener-Waterloo | 156 | Y | N |
| CA-0008 | London-Southwestern Ontario | 28 | Y | N |
| CA-0010 | Ottawa | 28 | Y | N |
| CA-0012 | Sudbury | 466 | Y | N |
| CA-0013 | Timmins-Northeastern Ontario | 205 | Y | N |
| CA-0016 | Monteregie-South Shore | 104 | Y | N |
| CA-0018 | Mauricie | 53 | Y | N |
| CA-0019 | Laval-Laurentides | 50 | Y | N |
| CA-0021 | Nord-du-Quebec | 2227 | Y | N |
| CA-0023 | Saguenay-Lac-Saint-Jean | 63 | Y | N |
| CA-0027 | Surrey-Fraser Valley | 24 | Y | N |
| CA-0056 | Yukon | 175 | Y | N |
| CA-0057 | Northwest Territories | 7450 | Y | N |
| MX-0024 | Cananea-Nogales | 119 | Y | N |
| MX-0026 | Mexicali | 103 | Y | N |
| MX-0030 | Reynosa-Nuevo Laredo | 58 | Y | N |
| US-0010 | Downtown Los Angeles | 0 | N | Y |
| US-0013 | San Fernando Valley | 29 | Y | N |
| US-0022 | San Joaquin Valley | 5 | Y | N |
| US-0046 | DuPage-Northwest Suburbs | 14 | Y | N |
| US-0062 | Suburban Maryland | 63 | Y | N |
| US-0079 | New Hampshire | 10 | Y | N |
| US-0088 | Bronx-Westchester | 34 | Y | N |
| US-0091 | Central New York | 92 | Y | N |
| US-0104 | Portland Oregon | 49 | Y | N |
| US-0107 | Delaware Valley PA Suburbs | 5 | Y | N |
| US-0109 | Northeastern and Northern Pennsylvania | 24 | Y | N |
| US-0137 | Northern Virginia | 21 | Y | N |
| US-0138 | Richmond-Central Virginia | 92 | Y | N |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

CA-0059 (235), US-0003 (203), CA-0058 (124), GL-0003 (105), CA-0057 (89), US-0004 (44), CA-0053 (42), GL-0002 (39), CA-0054 (35), CA-0028 (34), CA-0029 (32), GL-0001 (29), US-0095 (27), US-0034 (23), MX-0027 (20), US-0140 (20), CA-0025 (16), US-0068 (16), CA-0046 (15), US-0139 (14), CA-0021 (13), US-0061 (13), US-0064 (13), CA-0012 (12), US-0037 (12), US-0128 (12), CA-0049 (11), MX-0036 (11), US-0063 (11), US-0123 (11), CA-0024 (10), US-0058 (10), US-0089 (10), MX-0025 (9), US-0042 (9), US-0145 (9), CA-0014 (8), US-0129 (8), CA-0050 (7), MX-0044 (7), US-0111 (7), CA-0045 (6), CA-0048 (6), MX-0039 (6), US-0041 (6), US-0083 (6), CA-0010 (5), CA-0026 (5), MX-0015 (5), MX-0026 (5), MX-0033 (5), MX-0047 (5), US-0012 (5), US-0021 (5), US-0091 (5), CA-0051 (4), CA-0056 (4), MX-0006 (4), MX-0023 (4), MX-0041 (4), MX-0048 (4), US-0002 (4), US-0017 (4), US-0056 (4), US-0141 (4), BM-0001 (3), CA-0006 (3), CA-0009 (3), CA-0016 (3), CA-0022 (3), CA-0027 (3), CA-0031 (3), CA-0047 (3), CA-0052 (3), MX-0012 (3), MX-0028 (3), MX-0030 (3), US-0031 (3), US-0036 (3), US-0071 (3), US-0072 (3), US-0082 (3), US-0098 (3), US-0112 (3), CA-0005 (2), CA-0011 (2), CA-0015 (2), CA-0017 (2), CA-0035 (2), CA-0055 (2), MX-0004 (2), MX-0005 (2), MX-0011 (2), MX-0013 (2), MX-0014 (2), MX-0016 (2), MX-0019 (2), MX-0029 (2), MX-0031 (2), MX-0032 (2), MX-0034 (2), MX-0038 (2), MX-0043 (2), MX-0045 (2), US-0013 (2), US-0018 (2), US-0020 (2), US-0028 (2), US-0035 (2), US-0048 (2), US-0051 (2), US-0057 (2), US-0059 (2), US-0065 (2), US-0066 (2), US-0086 (2), US-0087 (2), US-0102 (2), US-0104 (2), US-0110 (2)

## Visual check

`preview-north-america.png` in this folder is province-ids.png around the region (pixels x 760..3416, y 148..2480, scaled by 0.90; outside the frame: US-0003, US-0004, US-0042).
