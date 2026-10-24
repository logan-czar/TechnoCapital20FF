# Map QA report: north-america

_Written by `tools/map-pipeline/run.py --region north-america` (pipeline pb-2). Source of the rows: `provinces-north-america.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 394 provinces of `provinces-north-america.csv` have a crosswalk row and pixels (18 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 394 |
| ... BMU | 1 |
| ... CAN | 156 |
| ... GRL | 3 |
| ... MEX | 49 |
| ... SPM | 1 |
| ... USA | 184 |
| Regions matched | 99 of 99 |
| Provinces by method: admin1 | 40 |
| Provinces by method: admin2 | 314 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 40 |
| Flagged for review (confidence < 0.6) | 4 |
| Placed by a builder hint (`hints/north-america.toml`) | 40 |
| Tiny (under 64 px) | 18 |
| Given a pixel at their interior point (no pixel centre inside) | 0 |
| More than one part (islands, exclaves) | 171 |
| Coastal flag differs from the CSV | 27 |
| Small for their region (not Metro, under 5% of the region's mean) | 4 |
| Voronoi-split blocks where one province takes 75% or more | 7 |
| Places named in a province's name or notes that lie in another province | 0 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 0 |
| Admin-1 units left without a province | 0 |
| Sea links with a province of this file | 26 |
| City probe points (fail on a mismatch; D686) | 180 pass, 0 mismatch, 27 listed |
| Metro reach scan rows (listed; D686) | 7 |
| Land exclaves of 5 px or more (fail unless explained; D691) | 19 (0 unexplained) |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) | 4 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Split giants

Provinces over 250,000 km2 that are not Arctic, cut into parts of at most 51,722 km2 (Eastern Iowa, US-0053) by `run.py giants` and `[subdivide]` in the hints (D820). Areas are geodesic, of the final shapes; the step fails on a part over the cap. Borders between parts (D850, D856): km along rivers and lake centerlines, along the building pieces' edges (licensed ADM2 lines, or town catchments), meandering, and straight; the style is the organic cut kept (D854).

| Province | Name | Parts | Pieces | Area (km2) | Smallest part | Largest part | Parts in several pieces | River km | Piece-edge km | Meander km | Straight km | Style |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CA-0014 | Northwestern Ontario | 12 | admin2 | 584,135 | 46,671 | 50,690 | 2 | 386 | 2 | 3,266 | 0 | rivers, meanders, bent town edges |
| CA-0021 | Nord-du-Quebec | 18 | admin2 | 850,309 | 46,985 | 47,514 | 7 | 604 | 50 | 6,576 | 501 | rivers, meanders, bent town edges |
| CA-0025 | Cote-Nord | 6 | admin2 | 267,868 | 43,950 | 45,179 | 4 | 200 | 451 | 1,031 | 0 | rivers, meanders, bent town edges |
| CA-0029 | North Coast BC | 7 | admin2 | 325,350 | 44,152 | 48,976 | 2 | 123 | 29 | 1,705 | 0 | rivers, meanders, bent town edges |
| CA-0043 | Northern Saskatchewan | 9 | admin2 | 422,899 | 45,584 | 48,421 | 1 | 427 | 464 | 2,266 | 0 | rivers, meanders, bent town edges |
| CA-0046 | Northern Manitoba | 11 | admin2 | 507,069 | 45,359 | 46,731 | 5 | 180 | 407 | 3,061 | 0 | rivers, meanders, bent town edges |
| CA-0054 | Labrador | 6 | admin2 | 292,502 | 48,582 | 48,889 | 5 | 0 | 4 | 1,056 | 544 | rivers, meanders, bent town edges |
| CA-0056 | Yukon | 10 | admin2 | 484,493 | 48,093 | 48,856 | 2 | 116 | 27 | 2,538 | 0 | rivers, meanders, bent town edges |
| CA-0057 | Northwest Territories | 27 | admin2 | 1,289,446 | 44,039 | 49,748 | 13 | 0 | 218 | 7,573 | 737 | gentle meanders (seed CA-0057:2) |
| US-0003 | Anchorage-Southcentral | 13 | admin2 | 617,780 | 44,018 | 50,345 | 9 | 0 | 876 | 2,140 | 0 | rivers, meanders, bent town edges |
| US-0004 | Fairbanks-North Slope | 19 | admin2 | 887,469 | 44,765 | 48,684 | 9 | 0 | 548 | 6,320 | 392 | meanders, bent town edges (seed US-0004:2) |
| US-0074 | Montana | 8 | admin2 | 379,494 | 44,191 | 51,031 | 0 | 3 | 2,864 | 415 | 0 | rivers, meanders, bent town edges (seed US-0074:2) |

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes, river and lake centerlines) | Public domain | yes |
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
| US-0005 | Phoenix-Central | seeds: place Flagstaff; place Phoenix; point -112.47,34.54 (hint); 2 whole admin2 units, split: Maricopa |
| US-0013 | San Fernando Valley | seeds: point -118.12,34.58 (hint); point -118.14,34.7 (hint); point -118.45,34.22 (hint); point -118.54,34.39 (hint); 0 whole admin2 units, split: Los Angeles |
| US-0015 | Inland Empire | seeds: unit Riverside (hint); unit San Bernardino (hint); 1 whole admin2 units, split: Riverside |
| US-0018 | San Francisco | seeds: place San Francisco; unit Marin (hint); unit San Francisco at place San Francisco; 2 whole admin2 units |
| US-0034 | Southwest Florida-Keys | seeds: place Ft. Myers; place Key West; place Naples; unit Okeechobee (hint); 10 whole admin2 units |
| US-0035 | Orlando-Space Coast | seeds: place Orlando; unit Martin (hint); 11 whole admin2 units |
| US-0040 | North Fulton-Cobb | seeds: point -84.14,34.21 (hint); point -84.29,34.08 (hint); unit Cobb; unit Fulton; 9 whole admin2 units, split: Fulton |
| US-0044 | Chicago Loop | seeds: point -87.63,41.88 (hint); point -87.66,41.95 (hint); 0 whole admin2 units, split: Cook |
| US-0045 | South Side-Calumet | seeds: point -87.6,41.78 (hint); point -87.62,41.62 (hint); 0 whole admin2 units, split: Cook |
| US-0046 | DuPage-Northwest Suburbs | seeds: point -87.9,41.98 (hint); point -87.98,42.09 (hint); point -88.08,42.03 (hint); unit DuPage; 4 whole admin2 units, split: Cook |
| US-0062 | Suburban Maryland | seeds: unit Charles (hint); unit Montgomery (hint); unit Prince George's (hint); 6 whole admin2 units |
| US-0083 | South Jersey | seeds: unit Burlington (hint); unit Camden (hint); unit Gloucester (hint); unit Salem (hint); 6 whole admin2 units |
| US-0086 | Manhattan | seeds: unit New York (hint); 1 whole admin2 units |
| US-0087 | Brooklyn-Queens | seeds: unit Kings (hint); unit Queens (hint); unit Richmond (hint); 3 whole admin2 units |
| US-0089 | Long Island | seeds: unit Nassau (hint); unit Suffolk (hint); 2 whole admin2 units |
| US-0090 | Hudson Valley-Capital Region | seeds: place Albany; point -73.92,41.7 (hint); point -73.99,41.93 (hint); point -74.01,41.5 (hint); unit Albany at place Albany; 20 whole admin2 units |
| US-0109 | Northeastern and Northern Pennsylvania | seeds: place Erie; place Scranton; place Williamsport; unit Erie at place Erie; unit Lehigh (hint); unit Northampton (hint); 34 whole admin2 units |
| US-0120 | Plano-Frisco | seeds: unit Collin (hint); unit Denton (hint); 3 whole admin2 units |
| US-0121 | East and Central Texas | seeds: place Tyler; place Waco; unit Walker (hint); 62 whole admin2 units |
| US-0123 | Ship Channel-Baytown | seeds: place Baytown; place Freeport; point -95.12,29.7 (hint); point -95.21,29.69 (hint); 3 whole admin2 units, split: Harris; place houston left to US-0122 (its name begins with it) |
| US-0124 | Woodlands-Katy | seeds: point -95.78,29.8 (hint); unit Montgomery (hint); unit Waller (hint); 4 whole admin2 units, split: Harris |
| US-0137 | Northern Virginia | seeds: unit Alexandria (hint); unit Arlington (hint); unit Fairfax (hint); unit Loudoun (hint); unit Prince William (hint); 12 whole admin2 units |
| US-0138 | Richmond-Central Virginia | seeds: place Richmond; place Roanoke; unit Lancaster (hint); unit Northumberland (hint); unit Richmond at place Richmond; unit Roanoke at place Roanoke; 105 whole admin2 units |
| US-0141 | Tacoma-Olympic | seeds: place Tacoma; unit Clallam (hint); unit Jefferson (hint); unit Kitsap (hint); 14 whole admin2 units |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| BM-0001 | Bermuda | 4 | 3 | 2621.5, 1848.5 |
| US-0086 | Manhattan | 4 | 2 | 2413.5, 1625.5 |
| MX-0001 | Cuauhtemoc-Centro | 8 | 1 | 1840.5, 2161.5 |
| MX-0002 | Polanco-Santa Fe | 10 | 1 | 1837.5, 2164.5 |
| US-0030 | Washington DC | 13 | 1 | 2342.5, 1676.5 |
| CA-0001 | Downtown Toronto | 18 | 1 | 2287.5, 1547.5 |
| PM-0001 | Saint Pierre and Miquelon | 18 | 3 | 2814.5, 1458.5 |
| US-0106 | Philadelphia City | 22 | 1 | 2388.5, 1646.5 |
| US-0044 | Chicago Loop | 26 | 1 | 2099.5, 1596.5 |
| MX-0005 | Naucalpan-Tlalnepantla | 30 | 2 | 1838.5, 2158.5 |
| CA-0015 | Montreal | 34 | 2 | 2421.5, 1494.5 |
| US-0087 | Brooklyn-Queens | 39 | 2 | 2414.5, 1629.5 |
| MX-0003 | Iztapalapa-Coyoacan | 42 | 1 | 1841.5, 2166.5 |
| US-0011 | Westside-Hollywood | 45 | 1 | 1393.5, 1802.5 |
| US-0081 | Jersey City-Hudson Waterfront | 51 | 1 | 2411.5, 1622.5 |
| US-0012 | Long Beach-Harbor | 56 | 5 | 1405.5, 1809.5 |
| MX-0011 | Monterrey Centro-San Pedro | 58 | 2 | 1816.5, 2019.5 |
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
| Apodaca NL (-100.19, 25.78) | ? | MX-0012 | listed |
| Bay City Matagorda (-95.97, 28.98) | ? | US-0128 | listed |
| Carrollton (-85.08, 33.58) | ? | US-0041 | listed |
| Clewiston (-80.93, 26.75) | ? | US-0034 | listed |
| Columbus TX (-96.54, 29.71) | ? | US-0126 | listed |
| Cumming Forsyth (-84.14, 34.21) | ? | US-0040 | listed |
| DFW airport (-97.04, 32.9) | ? | US-0119 | listed |
| Denton (-97.13, 33.21) | ? | US-0120 | listed |
| Fort Pierce (-80.33, 27.45) | ? | US-0035 | listed |
| Galveston (-94.8, 29.3) | ? | US-0123 | listed |
| Gatineau (-75.7, 45.48) | ? | CA-0020 | listed |
| Huntsville Walker (-95.55, 30.72) | ? | US-0121 | listed |
| Monterrey centro (-100.31, 25.67) | ? | MX-0011 | listed |
| Newnan Coweta (-84.8, 33.38) | ? | US-0041 | listed |
| Peachtree City (-84.6, 33.4) | ? | US-0041 | listed |
| Port St Lucie (-80.35, 27.27) | ? | US-0035 | listed |
| Reading Berks (-75.93, 40.34) | ? | US-0109 | listed |
| Sabinas Hidalgo (-100.18, 26.51) | ? | MX-0014 | listed |
| San Pedro Garza Garcia (-100.4, 25.66) | ? | MX-0011 | listed |
| Sebring Highlands (-81.44, 27.5) | ? | US-0034 | listed |
| Sherbrooke (-71.89, 45.4) | ? | CA-0017 | listed |
| Stuart Martin (-80.25, 27.2) | ? | US-0035 | listed |
| Sugar Land (-95.63, 29.62) | ? | US-0124 | listed |
| Thousand Oaks (-118.84, 34.17) | ? | US-0021 | listed |
| Trois-Rivieres (-72.55, 46.34) | ? | CA-0018 | listed |
| Victoria TX (-97.0, 28.8) | ? | US-0128 | listed |
| Waldorf Charles (-76.94, 38.62) | ? | US-0062 | listed |
| Adak (-176.64, 51.88) | US | US-0154 | on it |
| Allakaket (split part) (-152.6455, 66.5655) | US-0166 | US-0166 | on it |
| Allentown (-75.49, 40.6) | US-0109 | US-0109 | on it |
| Allentown Lehigh (-75.49, 40.6) | US-0109 | US-0109 | on it |
| Alpharetta (-84.29, 34.08) | US-0040 | US-0040 | on it |
| Ambler (split part) (-157.8514, 67.0865) | US-0167 | US-0167 | on it |
| Anchorage (main city of a split giant) (-149.8874, 61.214) | US-0003 | US-0003 | on it |
| Aniak (split part) (-159.5222, 61.5787) | US-0150 | US-0150 | on it |
| Annapolis (-76.49, 38.98) | US-0063 | US-0063 | on it |
| Arlington TX (-97.11, 32.74) | US-0119 | US-0119 | on it |
| Athabasca Basin (site of a split giant) (-105.05, 57.76) | CA-0101 | CA-0101 | on it |
| Attawapiskat (split part) (-82.4333, 52.9166) | CA-0063 | CA-0063 | on it |
| Attu (173.18, 52.93) | US | US-0154 | nearest across water |
| Baie-Comeau (split part) (-68.158, 49.2227) | CA-0092 | CA-0092 | nearest across water |
| Baytown (-94.98, 29.74) | US-0123 | US-0123 | on it |
| Bellevue (-122.2, 47.61) | US-0140 | US-0140 | on it |
| Bethel (split part) (-161.7558, 60.7933) | US-0151 | US-0151 | on it |
| Bethesda (-77.1, 38.98) | US-0062 | US-0062 | on it |
| Bethlehem Northampton (-75.37, 40.63) | US-0109 | US-0109 | on it |
| Big Beaver House (split part) (-89.8833, 52.95) | CA-0064 | CA-0064 | on it |
| Big Delta (split part) (-145.8422, 64.1525) | US-0171 | US-0171 | on it |
| Billings (main city of a split giant) (-108.54, 45.7883) | US-0074 | US-0074 | on it |
| Boca Raton (-80.1, 26.37) | US-0033 | US-0033 | on it |
| Bowie PG (-76.73, 38.94) | US-0062 | US-0062 | on it |
| Bozeman (split part) (-111.0378, 45.6801) | US-0182 | US-0182 | on it |
| Bremerton (-122.63, 47.57) | US-0141 | US-0141 | nearest across water |
| Brochet (split part) (-101.6666, 57.8832) | CA-0108 | CA-0108 | on it |
| Brooklyn (-73.95, 40.65) | US-0087 | US-0087 | on it |
| Burbank (-118.31, 34.18) | US-0013 | US-0013 | on it |
| Burwash Landing (split part) (-139.0, 61.3504) | CA-0130 | CA-0130 | on it |
| Butte (split part) (-112.5338, 46.0039) | US-0184 | US-0184 | on it |
| Cartwright (split part) (-57.0121, 53.7014) | CA-0121 | CA-0121 | nearest across water |
| Chicago Loop (-87.63, 41.88) | US-0044 | US-0044 | on it |
| Churchill (split part) (-94.166, 58.766) | CA-0109 | CA-0109 | nearest across water |
| Churchill Falls (main city of a split giant) (-63.9807, 53.5264) | CA-0054 | CA-0054 | on it |
| Churchill Falls (site of a split giant) (-64.0, 53.53) | CA-0054 | CA-0054 | on it |
| Conroe (-95.46, 30.31) | US-0124 | US-0124 | on it |
| Coyoacan (-99.16, 19.35) | MX-0003 | MX-0003 | on it |
| Dawson City (split part) (-139.4167, 64.0666) | CA-0124 | CA-0124 | on it |
| Dease Lake (split part) (-130.0333, 58.4503) | CA-0095 | CA-0095 | on it |
| Deer Lake (split part) (-94.0666, 52.617) | CA-0066 | CA-0066 | on it |
| Denali Park (split part) (-148.9141, 63.7331) | US-0177 | US-0177 | on it |
| Dillingham (split part) (-158.4803, 59.0566) | US-0158 | US-0158 | on it |
| Downtown Toronto (-79.38, 43.65) | CA-0001 | CA-0001 | on it |
| Doylestown Bucks (-75.13, 40.31) | US-0107 | US-0107 | on it |
| Easton (-75.22, 40.69) | US-0109 | US-0109 | on it |
| Ecatepec (-99.05, 19.6) | MX-0004 | MX-0004 | on it |
| Everett (-122.2, 47.98) | US-0140 | US-0140 | on it |
| Fairbanks (main city of a split giant) (-147.7107, 64.837) | US-0004 | US-0004 | on it |
| Fermont (site of a split giant) (-67.09, 52.79) | CA-0088 | CA-0088 | on it |
| Flagstaff (-111.65, 35.2) | US-0005 | US-0005 | on it |
| Flin Flon (split part) (-101.8833, 54.7666) | CA-0111 | CA-0111 | on it |
| Fort Knox (site of a split giant) (-147.36, 65.06) | US-0004 | US-0004 | on it |
| Fort Severn (split part) (-87.65, 55.9833) | CA-0060 | CA-0060 | on it |
| Fort Simpson (split part) (-121.3333, 61.85) | CA-0151 | CA-0151 | on it |
| Fort Yukon (split part) (-145.2738, 66.5647) | US-0168 | US-0168 | on it |
| Freeport TX (-95.36, 28.95) | US-0123 | US-0123 | on it |
| Frisco (-96.82, 33.15) | US-0120 | US-0120 | on it |
| Galena (split part) (-156.927, 64.7333) | US-0172 | US-0172 | on it |
| Gillam (split part) (-94.7, 56.35) | CA-0112 | CA-0112 | on it |
| Glendive (split part) (-104.7105, 47.1086) | US-0180 | US-0180 | on it |
| Globe Gila (-110.79, 33.39) | US-0007 | US-0007 | on it |
| Great Falls (split part) (-111.3, 47.5003) | US-0178 | US-0178 | on it |
| Guadalajara centro (-103.35, 20.67) | MX-0007 | MX-0007 | on it |
| Gulkana (split part) (-145.3822, 62.2714) | US-0149 | US-0149 | on it |
| Happy Valley - Goose Bay (split part) (-60.3, 53.3) | CA-0119 | CA-0119 | on it |
| Hartsfield airport (-84.43, 33.64) | US-0039 | US-0039 | on it |
| Hay River (split part) (-115.7883, 60.8143) | CA-0156 | CA-0156 | on it |
| Holbrook Navajo (-110.16, 34.9) | US-0007 | US-0007 | on it |
| Hollywood (-118.33, 34.1) | US-0011 | US-0010 | within a pixel |
| Holman (split part) (-117.75, 70.7334) | CA-0133 | CA-0133 | on it |
| Hopedale (split part) (-60.2167, 55.45) | CA-0118 | CA-0118 | on it |
| Hudson Bay (split part) (-102.3833, 52.8504) | CA-0106 | CA-0106 | on it |
| Hyde Park Chicago (-87.59, 41.79) | US-0045 | US-0045 | on it |
| Inukjuak (split part) (-78.136, 58.47) | CA-0073 | CA-0073 | nearest across water |
| Inuvik (split part) (-133.7, 68.35) | CA-0136 | CA-0136 | on it |
| Ivugivik (split part) (-77.9, 62.4166) | CA-0072 | CA-0072 | on it |
| Iztapalapa (-99.06, 19.36) | MX-0003 | MX-0003 | on it |
| Juneau (split part) (-134.4007, 58.3034) | US-0157 | US-0157 | nearest across water |
| Jupiter (-80.1, 26.93) | US-0033 | US-0033 | nearest across water |
| Kaktovik (split part) (-143.6029, 70.0879) | US-0164 | US-0164 | nearest across water |
| Kaltag (split part) (-158.7219, 64.3272) | US-0173 | US-0173 | on it |
| Katy (-95.82, 29.79) | US-0124 | US-0124 | on it |
| Kenora (split part) (-94.4666, 49.7667) | CA-0070 | CA-0070 | on it |
| Ketchikan (split part) (-131.664, 55.3562) | US-0159 | US-0159 | on it |
| Kilmarnock Lancaster VA (-76.38, 37.71) | US-0138 | US-0138 | on it |
| King of Prussia (-75.39, 40.09) | US-0107 | US-0107 | on it |
| Kingman AZ (-114.05, 35.19) | US-0007 | US-0007 | on it |
| Kodiak (split part) (-152.407, 57.79) | US-0155 | US-0155 | on it |
| Kotzebue (split part) (-162.5966, 66.8987) | US-0169 | US-0169 | on it |
| Kuujjuaq (split part) (-68.4, 58.1) | CA-0075 | CA-0075 | on it |
| Kuujjuarapik (split part) (-77.7658, 55.2815) | CA-0082 | CA-0082 | on it |
| La Grande (site of a split giant) (-77.61, 53.79) | CA-0083 | CA-0083 | on it |
| La Ronge (split part) (-105.3, 55.1) | CA-0105 | CA-0105 | on it |
| Labrador Trough (site of a split giant) (-66.91, 52.94) | CA-0054 | CA-0054 | on it |
| Lake Havasu (-114.32, 34.48) | US-0007 | US-0007 | on it |
| Lake Minchumina (split part) (-152.3122, 63.8828) | US-0175 | US-0175 | on it |
| Lancaster CA (-118.14, 34.69) | US-0013 | US-0013 | on it |
| Lansdowne House (split part) (-87.8833, 52.2166) | CA-0065 | CA-0065 | on it |
| Levis (-71.18, 46.8) | CA-0022 | CA-0022 | on it |
| Liberty TX (-94.8, 30.06) | US-0125 | US-0125 | on it |
| Little Diomede (-168.93, 65.75) | US | US-0169 | on it |
| Long Beach (-118.19, 33.77) | US-0012 | US-0012 | on it |
| Los Altos Tepatitlan (-102.76, 20.82) | MX-0010 | MX-0010 | on it |
| Mack Trucks Macungie (-75.55, 40.52) | US-0109 | US-0109 | on it |
| Marathon (split part) (-86.3667, 48.7504) | CA-0069 | CA-0069 | on it |
| Marietta (-84.55, 33.95) | US-0040 | US-0040 | on it |
| Markham (-79.34, 43.86) | CA-0003 | CA-0003 | on it |
| Matagami (split part) (-77.6333, 49.7504) | CA-0087 | CA-0087 | on it |
| McGrath (split part) (-155.5958, 62.9568) | US-0176 | US-0176 | on it |
| McKinney (-96.62, 33.2) | US-0120 | US-0120 | on it |
| Meadow Lake (split part) (-108.4347, 54.1301) | CA-0104 | CA-0104 | on it |
| Midtown Manhattan (-73.98, 40.75) | US-0086 | US-0086 | on it |
| Miles City (split part) (-105.84, 46.4089) | US-0183 | US-0183 | on it |
| Mississauga (-79.64, 43.59) | CA-0002 | CA-0002 | on it |
| Missoula (split part) (-113.9931, 46.8722) | US-0181 | US-0181 | on it |
| Mistassini (split part) (-73.8666, 50.4171) | CA-0086 | CA-0086 | on it |
| Natashquan (split part) (-61.8107, 50.1913) | CA-0091 | CA-0091 | on it |
| Naucalpan (-99.24, 19.48) | MX-0005 | MX-0005 | on it |
| Newhalen (split part) (-154.8972, 59.7203) | US-0153 | US-0153 | on it |
| Nezahualcoyotl (-99.01, 19.4) | MX-0004 | MX-0004 | on it |
| Nome (split part) (-165.4064, 64.5061) | US-0174 | US-0174 | nearest across water |
| Norfolk (-76.29, 36.85) | US-0139 | US-0139 | on it |
| Norman Wells (split part) (-126.85, 65.2837) | CA-0141 | CA-0141 | on it |
| Norway House (split part) (-97.8333, 53.9666) | CA-0114 | CA-0114 | on it |
| Okeechobee (-80.83, 27.24) | US-0034 | US-0034 | on it |
| Oshawa (-78.86, 43.9) | CA-0004 | CA-0004 | on it |
| Oxford House (split part) (-95.2666, 54.9504) | CA-0113 | CA-0113 | on it |
| Oxnard (-119.18, 34.2) | US-0021 | US-0021 | on it |
| Pasadena TX (-95.21, 29.69) | US-0123 | US-0123 | on it |
| Point Hope (split part) (-166.808, 68.3477) | US-0162 | US-0162 | on it |
| Polanco (-99.19, 19.433) | MX-0002 | MX-0005 | within a pixel |
| Port Angeles (-123.43, 48.12) | US-0141 | US-0141 | nearest across water |
| Poughkeepsie (-73.92, 41.7) | US-0090 | US-0090 | on it |
| Prince Albert (main city of a split giant) (-105.75, 53.2) | CA-0043 | CA-0043 | on it |
| Prince Rupert (main city of a split giant) (-130.33, 54.3167) | CA-0029 | CA-0029 | on it |
| Prudhoe Bay (site of a split giant) (-148.35, 70.3) | US-0163 | US-0163 | on it |
| Quinhagak (split part) (-161.9158, 59.7492) | US-0156 | US-0156 | on it |
| Raglan (site of a split giant) (-73.66, 61.69) | CA-0071 | CA-0071 | on it |
| Santa Clarita (-118.54, 34.39) | US-0013 | US-0013 | on it |
| Santa Fe MX (-99.26, 19.36) | MX-0002 | MX-0002 | on it |
| Schaumburg (-88.08, 42.03) | US-0046 | US-0046 | on it |
| Sept-Iles (main city of a split giant) (-66.36, 50.3161) | CA-0025 | CA-0025 | on it |
| Sherman Grayson (-96.61, 33.64) | US-0121 | US-0121 | on it |
| Silver Spring (-77.03, 38.99) | US-0062 | US-0030 | within a pixel |
| Sioux Lookout (split part) (-91.9166, 50.263) | CA-0067 | CA-0067 | on it |
| Smithers (split part) (-127.1666, 54.7666) | CA-0098 | CA-0098 | on it |
| St-Augustin (split part) (-58.647, 51.2423) | CA-0090 | CA-0090 | nearest across water |
| Stony Rapids (split part) (-105.8333, 59.2666) | CA-0099 | CA-0099 | on it |
| Surrey BC (-122.85, 49.19) | CA-0027 | CA-0027 | on it |
| Tacoma (-122.44, 47.25) | US-0141 | US-0141 | on it |
| Talkeetna (split part) (-150.1094, 62.3238) | US-0148 | US-0148 | on it |
| Tanana (split part) (-152.0788, 65.1719) | US-0170 | US-0170 | on it |
| Tequila (-103.84, 20.88) | MX-0010 | MX-0010 | on it |
| Terrell Kaufman (-96.28, 32.74) | US-0121 | US-0121 | on it |
| The Pas (split part) (-101.2333, 53.8166) | CA-0115 | CA-0115 | on it |
| Thompson (main city of a split giant) (-97.8666, 55.7499) | CA-0046 | CA-0046 | on it |
| Thunder Bay (main city of a split giant) (-89.275, 48.4462) | CA-0014 | CA-0014 | on it |
| Tlalnepantla (-99.22, 19.54) | MX-0005 | MX-0005 | on it |
| Tlaquepaque (-103.31, 20.64) | MX-0009 | MX-0009 | on it |
| Tuktoyaktuk (split part) (-133.0492, 69.4548) | CA-0135 | CA-0135 | on it |
| Unalaska (split part) (-166.5316, 53.8686) | US-0154 | US-0154 | nearest across water |
| Uranium City (split part) (-108.6166, 59.5666) | CA-0100 | CA-0100 | on it |
| Utqiagvik (split part) (-156.7886, 71.2906) | US-0160 | US-0160 | on it |
| Valdez (split part) (-146.3483, 61.136) | US-0152 | US-0152 | nearest across water |
| Van Nuys (-118.45, 34.19) | US-0013 | US-0013 | on it |
| Vancouver downtown (-123.12, 49.28) | CA-0026 | CA-0026 | on it |
| Ventura city (-119.23, 34.28) | US-0021 | US-0021 | on it |
| Voisey's Bay (site of a split giant) (-62.1, 56.33) | CA-0117 | CA-0117 | on it |
| Watson Lake (split part) (-128.7117, 60.0623) | CA-0129 | CA-0129 | on it |
| Waxahachie Ellis (-96.85, 32.39) | US-0121 | US-0121 | on it |
| Weatherford Parker (-97.8, 32.76) | US-0121 | US-0121 | on it |
| West Chester (-75.6, 39.96) | US-0107 | US-0107 | on it |
| Wharton (-96.1, 29.31) | US-0126 | US-0126 | on it |
| Whitehorse (main city of a split giant) (-135.05, 60.7167) | CA-0056 | CA-0056 | on it |
| Williamsburg (-76.71, 37.27) | US-0139 | US-0139 | on it |
| Yellowknife (main city of a split giant) (-114.397, 62.442) | CA-0057 | CA-0057 | on it |
| Zapopan (-103.39, 20.72) | MX-0008 | MX-0008 | on it |
| Zocalo (-99.133, 19.433) | MX-0001 | MX-0001 | on it |
| unit Nord-du-Quebec (main city of a split giant) (-70.3893, 55.7543) | CA-0021 | CA-0021 | on it |

## Metro reach

Metro provinces whose centroid is over 80 km from their Metro's city, that are over 4 times the Metro's median and 250 px, and regions where Metro provinces hold over 30% of the land beside rural ones (the D612 error). Listed for review; a Metro made of whole metropolitan units can be large by design.

| Check | Province or region | Detail |
|---|---|---|
| large for its Metro | US-0046 DuPage-Northwest Suburbs | 418 px, the Metro's median is 71 px (Metro Chicago) |
| far from its Metro city | US-0033 Palm Beach | centroid 100 km from Miami (Metro Miami) |
| far from its Metro city | US-0027 Fairfield County | centroid 81 km from New York (Metro New York) |
| far from its Metro city | US-0089 Long Island | centroid 84 km from New York (Metro New York) |
| far from its Metro city | US-0005 Phoenix-Central | centroid 174 km from Phoenix (Metro Phoenix) |
| Metro share of a region | USA: Arizona | Metro provinces hold 37% of 16883 px beside 1 rural |
| Metro share of a region | USA: New Jersey | Metro provinces hold 53% of 1274 px beside 1 rural |

## Land exclaves

Parts of 5 px or more that are not a province's largest part and touch no pixel outside every province (islands are not listed). Each is explained by a place its composite name names lying in it, by one of the province's own seeds (a hint point, or a place its notes name) lying in it, by a neck under a pixel wide that joins it to the rest in the shapes, or by a reason in `[review.exclave_ok]`; an unexplained one fails the step (D691).

| Province | Name | Pixels | At | Why |
|---|---|---|---|---|
| CA-0004 | Durham-Oshawa | 17 | -79.14, 44.42 | a neck under a pixel wide joins it to the rest in the shapes |
| CA-0025 | Cote-Nord | 64 | -66.87, 54.89 | Fermont and Schefferville: StatCan's Cote-Nord reaches them along the Labrador border, a strip Natural Earth's Quebec line cuts, so they sit between Labrador and Nord-du-Quebec |
| CA-0025 | Cote-Nord | 372 | -64.72, 54.88 | Fermont and Schefferville: StatCan's Cote-Nord reaches them along the Labrador border, a strip Natural Earth's Quebec line cuts, so they sit between Labrador and Nord-du-Quebec |
| CA-0045 | Southern Manitoba | 12 | -99.97, 51.91 | a neck under a pixel wide joins it to the rest in the shapes |
| CA-0111 | Flin Flon | 9 | -101.84, 54.26 | a neck under a pixel wide joins it to the rest in the shapes |
| CA-0111 | Flin Flon | 11 | -101.8, 53.87 | a neck under a pixel wide joins it to the rest in the shapes |
| CA-0115 | The Pas | 49 | -101.62, 51.99 | a neck under a pixel wide joins it to the rest in the shapes |
| CA-0115 | The Pas | 7 | -101.49, 50.47 | a neck under a pixel wide joins it to the rest in the shapes |
| CA-0115 | The Pas | 8 | -101.45, 50.11 | a neck under a pixel wide joins it to the rest in the shapes |
| CA-0140 | Northwest Territories East | 122 | -112.13, 65.53 | a neck under a pixel wide joins it to the rest in the shapes |
| MX-0006 | Toluca-Rural Mexico State | 45 | -98.78, 19.7 | a neck under a pixel wide joins it to the rest in the shapes |
| MX-0006 | Toluca-Rural Mexico State | 60 | -98.79, 19.19 | the State of Mexico's Chalco-Amecameca lobe: the Mexico City Metro provinces round it reach 0.4 degrees from their seeds (D690), so it joins the state's rural province beyond them |
| MX-0013 | Guadalupe-Santa Catarina | 22 | -100.17, 25.66 | its own seed unit Guadalupe lies in it |
| MX-0014 | Rural Nuevo Leon | 7 | -100.19, 25.97 | a neck under a pixel wide joins it to the rest in the shapes |
| MX-0016 | Coatzacoalcos-Southern Veracruz | 256 | -96.89, 18.87 | its own seed unit Córdoba at place Córdoba lies in it |
| MX-0032 | Michoacan | 5 | -100.67, 18.39 | a neck under a pixel wide joins it to the rest in the shapes |
| US-0017 | Imperial-Coachella Valley | 441 | -116.9, 33.74 | its own seed place Palm Springs lies in it |
| US-0063 | Baltimore-Central Maryland | 174 | -79.06, 39.56 | a neck under a pixel wide joins it to the rest in the shapes |
| US-0063 | Baltimore-Central Maryland | 60 | -77.76, 39.58 | a neck under a pixel wide joins it to the rest in the shapes |

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

CA-0001-US-0092, CA-0009-US-0098, CA-0014-US-0068, CA-0024-CA-0092, CA-0028-US-0140, CA-0028-US-0141, CA-0047-CA-0055, CA-0048-CA-0055, CA-0049-CA-0050, CA-0051-CA-0055, CA-0053-PM-0001, CA-0058-CA-0059, CA-0058-CA-0076, CA-0058-CA-0080, CA-0058-GL-0003, CA-0059-CA-0063, CA-0059-CA-0073, CA-0059-CA-0082, CA-0059-CA-0083, CA-0059-GL-0003, CA-0133-CA-0135, RU-0206-US-0169, US-0027-US-0089, US-0028-US-0089, US-0088-US-0089, US-0089-US-0111

## Small provinces

| Province | Name | Region | Pixels | Region mean |
|---|---|---|---|---|
| CA-0004 | Durham-Oshawa | Ontario | 125 | 3404 |
| CA-0015 | Montreal | Quebec | 34 | 4381 |
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

None.

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
| CA-0012 | Sudbury | 464 | Y | N |
| CA-0013 | Timmins-Northeastern Ontario | 205 | Y | N |
| CA-0016 | Monteregie-South Shore | 104 | Y | N |
| CA-0018 | Mauricie | 53 | Y | N |
| CA-0019 | Laval-Laurentides | 50 | Y | N |
| CA-0023 | Saguenay-Lac-Saint-Jean | 63 | Y | N |
| CA-0027 | Surrey-Fraser Valley | 26 | Y | N |
| MX-0024 | Cananea-Nogales | 119 | Y | N |
| MX-0026 | Mexicali | 103 | Y | N |
| MX-0030 | Reynosa-Nuevo Laredo | 58 | Y | N |
| US-0010 | Downtown Los Angeles | 0 | N | Y |
| US-0022 | San Joaquin Valley | 5 | Y | N |
| US-0046 | DuPage-Northwest Suburbs | 14 | Y | N |
| US-0062 | Suburban Maryland | 109 | Y | N |
| US-0079 | New Hampshire | 10 | Y | N |
| US-0088 | Bronx-Westchester | 34 | Y | N |
| US-0091 | Central New York | 92 | Y | N |
| US-0104 | Portland Oregon | 49 | Y | N |
| US-0107 | Delaware Valley PA Suburbs | 5 | Y | N |
| US-0109 | Northeastern and Northern Pennsylvania | 24 | Y | N |
| US-0137 | Northern Virginia | 21 | Y | N |
| US-0138 | Richmond-Central Virginia | 289 | Y | N |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

CA-0059 (226), CA-0058 (114), GL-0003 (105), US-0154 (90), CA-0113 (61), CA-0053 (42), GL-0002 (39), CA-0028 (34), CA-0057 (34), US-0159 (33), GL-0001 (29), US-0095 (27), US-0155 (26), CA-0117 (24), CA-0029 (23), US-0034 (23), MX-0027 (20), CA-0135 (19), US-0156 (19), US-0003 (17), US-0128 (17), US-0141 (17), US-0068 (16), US-0152 (15), US-0162 (14), US-0169 (14), US-0061 (13), US-0064 (13), CA-0012 (12), CA-0115 (12), US-0037 (12), US-0157 (12), CA-0049 (11), CA-0097 (11), CA-0131 (11), MX-0036 (11), CA-0024 (10), CA-0090 (10), CA-0116 (10), CA-0133 (10), CA-0140 (10), US-0058 (10), US-0063 (10), US-0089 (10), US-0138 (10), US-0158 (10), MX-0025 (9), US-0042 (9), US-0145 (9), CA-0071 (8), CA-0119 (8), CA-0134 (8), US-0129 (8), US-0174 (8), CA-0014 (7), CA-0050 (7), MX-0044 (7), US-0111 (7), US-0140 (7), CA-0025 (6), CA-0045 (6), CA-0048 (6), CA-0072 (6), MX-0038 (6), MX-0039 (6), US-0021 (6), US-0041 (6), US-0083 (6), US-0123 (6), CA-0010 (5), CA-0136 (5), CA-0137 (5), MX-0015 (5), MX-0026 (5), MX-0033 (5), MX-0047 (5), US-0012 (5), US-0091 (5), US-0160 (5), CA-0026 (4), CA-0051 (4), CA-0114 (4), CA-0121 (4), CA-0122 (4), CA-0132 (4), CA-0148 (4), MX-0006 (4), MX-0023 (4), MX-0041 (4), MX-0048 (4), US-0002 (4), US-0017 (4), US-0056 (4), US-0139 (4), US-0161 (4), US-0164 (4), BM-0001 (3), CA-0006 (3), CA-0009 (3), CA-0016 (3), CA-0022 (3), CA-0031 (3), CA-0047 (3), CA-0052 (3), CA-0073 (3), CA-0091 (3), CA-0111 (3), MX-0012 (3), MX-0028 (3), MX-0030 (3), PM-0001 (3), US-0031 (3), US-0035 (3), US-0036 (3), US-0071 (3), US-0072 (3), US-0082 (3), US-0098 (3), US-0112 (3), US-0150 (3), CA-0004 (2), CA-0005 (2), CA-0011 (2), CA-0015 (2), CA-0017 (2), CA-0035 (2), CA-0055 (2), CA-0063 (2), CA-0075 (2), CA-0076 (2), CA-0079 (2), CA-0083 (2), CA-0092 (2), CA-0103 (2), CA-0118 (2), CA-0120 (2), CA-0129 (2), CA-0146 (2), CA-0150 (2), CA-0151 (2), MX-0004 (2), MX-0005 (2), MX-0011 (2), MX-0013 (2), MX-0014 (2), MX-0016 (2), MX-0019 (2), MX-0029 (2), MX-0031 (2), MX-0032 (2), MX-0034 (2), MX-0043 (2), MX-0045 (2), US-0018 (2), US-0020 (2), US-0028 (2), US-0048 (2), US-0051 (2), US-0057 (2), US-0059 (2), US-0065 (2), US-0066 (2), US-0086 (2), US-0087 (2), US-0102 (2), US-0104 (2), US-0110 (2), US-0121 (2), US-0163 (2), US-0165 (2), US-0167 (2)

## Visual check

`preview-north-america.png` in this folder is province-ids.png around the region (pixels x 72..3416, y 145..2480, scaled by 0.72).
