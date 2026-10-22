# Map QA report: north-america

_Written by `tools/map-pipeline/run.py --region north-america` (pipeline pa-1), 2026-10-22. Source of the rows: `provinces-north-america.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D609._

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
| Provinces by method: admin1 | 42 |
| Provinces by method: admin2 | 145 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 73 |
| Flagged for review (confidence < 0.6) | 6 |
| Placed by a builder hint (`hints/north-america.toml`) | 25 |
| Tiny (under 64 px) | 17 |
| Given a pixel at their interior point (no pixel centre inside) | 0 |
| More than one part (islands, exclaves) | 125 |
| Coastal flag differs from the CSV | 34 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes) | Public domain | yes |
| geoBoundaries gbOpen USA ADM2 (United States Census Bureau, MAF/TIGER Database) | Public Domain | yes |
| geoBoundaries gbOpen CAN ADM2 (Statistics Canada (StatCan)) | Open Government Canada 2.0 | no: refused: not in the allowlist (Open Government Canada 2.0); Voronoi path |
| geoBoundaries gbOpen CAN ADM3 (Statistics Canada (StatCan)) | Open Data Commons Open Database License 1.0 | no: refused: ODbL (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen MEX ADM2 (World Bank) | Creative Commons Attribution 4.0 (CC BY 4.0) | yes |

Countries whose ADM2 license is refused are split by Voronoi inside their admin-1 regions (D601). Canada's ADM2 is under the Open Government Licence - Canada 2.0, an attribution-only license that the CC BY / CC0 / public domain allowlist does not name; adding it would let Canada use census divisions instead of straight Voronoi lines (a decision for Logan, D601).

## Low-confidence rows for review

The automatic match placed these provinces from direction words or a Metro's core city only. Check each on the preview; fix a wrong one with a hint in `tools/map-pipeline/hints/north-america.toml` and rerun.

| Province | Name | Region | Method | Confidence | How it was placed |
|---|---|---|---|---|---|
| CA-0021 | Nord-du-Quebec | Quebec | voronoi | 0.45 | seeds: region part +0.00,+1.00; 7 whole parts, 1 split |
| US-0048 | Southern Illinois | Illinois | admin2 | 0.45 | seeds: region part +0.00,-1.00; 34 whole admin2 units |
| US-0057 | Eastern Kentucky Coalfields | Kentucky | admin2 | 0.45 | seeds: region part +1.00,+0.00; 59 whole admin2 units |
| US-0011 | Westside-Hollywood | California | voronoi | 0.5 | seeds: metro core Los Angeles moved -1.00,+0.00; 0 whole admin2 units, split: Los Angeles |
| US-0039 | Hartsfield-South Metro | Georgia | admin2 | 0.5 | seeds: metro core Atlanta moved +0.00,-1.00; 13 whole admin2 units |
| US-0045 | South Side-Calumet | Illinois | voronoi | 0.5 | seeds: metro core Chicago moved +0.00,-1.00; 0 whole admin2 units, split: Cook |

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| CA-0002 | Peel-Mississauga | seeds: point -79.64,43.59 (hint); point -79.76,43.69 (hint); 0 whole parts, 1 split |
| CA-0003 | York-Markham | seeds: point -79.34,43.86 (hint); point -79.46,44.05 (hint); point -79.5,43.84 (hint); 0 whole parts, 1 split |
| CA-0016 | Monteregie-South Shore | seeds: point -73.25,45.31 (hint); point -73.52,45.53 (hint); 0 whole parts, 1 split |
| CA-0019 | Laval-Laurentides | seeds: point -73.75,45.6 (hint); point -74.0,45.78 (hint); point -74.6,46.12 (hint); 4 whole parts, 1 split |
| CA-0023 | Saguenay-Lac-Saint-Jean | seeds: point -71.07,48.43 (hint); point -72.25,48.55 (hint); 0 whole parts, 1 split |
| CA-0024 | Gaspesie-Bas-Saint-Laurent | seeds: point -64.48,48.83 (hint); point -68.52,48.45 (hint); 9 whole parts, 1 split |
| CA-0027 | Surrey-Fraser Valley | seeds: point -121.95,49.16 (hint); point -122.3,49.05 (hint); point -122.85,49.19 (hint); 0 whole parts, 1 split |
| CA-0028 | Vancouver Island | seeds: point -123.37,48.43 (hint); point -123.94,49.17 (hint); 33 whole parts |
| CA-0032 | Northeast BC | seeds: point -120.85,56.25 (hint); 0 whole parts, 1 split |
| CA-0034 | Industrial Heartland | seeds: point -113.21,53.71 (hint); 0 whole parts, 1 split |
| CA-0042 | Southeast Saskatchewan | seeds: point -102.99,49.14 (hint); point -103.87,49.66 (hint); 0 whole parts, 1 split |
| CA-0048 | Cape Breton | seeds: point -60.19,46.14 (hint); 4 whole parts |
| CA-0049 | Annapolis Valley-South Shore | seeds: point -64.5,45.08 (hint); point -64.52,44.38 (hint); point -66.12,43.84 (hint); 2 whole parts, 1 split |
| CA-0059 | Kivalliq-Kitikmeot | seeds: point -105.06,69.12 (hint); point -92.09,62.81 (hint); 126 whole parts |
| MX-0002 | Polanco-Santa Fe | seeds: point -99.25,19.36 (hint); unit Cuajimalpa de Morelos (hint); unit Miguel Hidalgo (hint); 5 whole admin2 units |
| US-0013 | San Fernando Valley | seeds: point -118.45,34.22 (hint); 0 whole admin2 units, split: Los Angeles |
| US-0015 | Inland Empire | seeds: unit Riverside (hint); unit San Bernardino (hint); 1 whole admin2 units, split: Riverside |
| US-0062 | Suburban Maryland | seeds: unit Montgomery (hint); unit Prince George's (hint); 9 whole admin2 units |
| US-0083 | South Jersey | seeds: unit Burlington (hint); unit Camden (hint); unit Gloucester (hint); unit Salem (hint); 6 whole admin2 units |
| US-0086 | Manhattan | seeds: unit New York (hint); 1 whole admin2 units |
| US-0087 | Brooklyn-Queens | seeds: unit Kings (hint); unit Queens (hint); unit Richmond (hint); 3 whole admin2 units |
| US-0089 | Long Island | seeds: unit Nassau (hint); unit Suffolk (hint); 2 whole admin2 units |
| US-0120 | Plano-Frisco | seeds: unit Collin (hint); unit Denton (hint); 14 whole admin2 units |
| US-0124 | Woodlands-Katy | seeds: point -95.78,29.8 (hint); unit Montgomery (hint); unit Waller (hint); 18 whole admin2 units, split: Harris |
| US-0137 | Northern Virginia | seeds: unit Alexandria (hint); unit Arlington (hint); unit Fairfax (hint); unit Loudoun (hint); unit Prince William (hint); 28 whole admin2 units |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| PM-0001 | Saint Pierre and Miquelon | 3 | 1 | 2817.5, 1459.5 |
| BM-0001 | Bermuda | 4 | 3 | 2621.5, 1848.5 |
| US-0086 | Manhattan | 4 | 2 | 2413.5, 1625.5 |
| MX-0001 | Cuauhtemoc-Centro | 8 | 1 | 1840.5, 2161.5 |
| MX-0002 | Polanco-Santa Fe | 10 | 1 | 1837.5, 2164.5 |
| US-0030 | Washington DC | 13 | 1 | 2342.5, 1676.5 |
| CA-0011 | Kingston-Eastern Ontario | 17 | 4 | 2357.5, 1533.5 |
| CA-0001 | Downtown Toronto | 20 | 2 | 2287.5, 1547.5 |
| US-0106 | Philadelphia City | 22 | 1 | 2388.5, 1646.5 |
| CA-0015 | Montreal | 33 | 2 | 2421.5, 1494.5 |
| US-0087 | Brooklyn-Queens | 39 | 2 | 2414.5, 1629.5 |
| MX-0003 | Iztapalapa-Coyoacan | 42 | 1 | 1841.5, 2166.5 |
| US-0011 | Westside-Hollywood | 45 | 1 | 1393.5, 1802.5 |
| US-0081 | Jersey City-Hudson Waterfront | 51 | 1 | 2411.5, 1622.5 |
| US-0012 | Long Beach-Harbor | 56 | 5 | 1405.5, 1809.5 |
| MX-0011 | Monterrey Centro-San Pedro | 58 | 2 | 1816.5, 2019.5 |
| US-0045 | South Side-Calumet | 58 | 1 | 2100.5, 1604.5 |

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| CA-0002 | Peel-Mississauga | 11 | Y | N |
| CA-0003 | York-Markham | 5 | Y | N |
| CA-0007 | Kitchener-Waterloo | 27 | Y | N |
| CA-0008 | London-Southwestern Ontario | 97 | Y | N |
| CA-0010 | Ottawa | 32 | Y | N |
| CA-0012 | Sudbury | 443 | Y | N |
| CA-0013 | Timmins-Northeastern Ontario | 446 | Y | N |
| CA-0016 | Monteregie-South Shore | 80 | Y | N |
| CA-0017 | Eastern Townships | 59 | Y | N |
| CA-0018 | Mauricie | 40 | Y | N |
| CA-0019 | Laval-Laurentides | 78 | Y | N |
| CA-0020 | Outaouais-Abitibi | 252 | Y | N |
| CA-0021 | Nord-du-Quebec | 1975 | Y | N |
| CA-0023 | Saguenay-Lac-Saint-Jean | 165 | Y | N |
| CA-0027 | Surrey-Fraser Valley | 25 | Y | N |
| CA-0031 | Cariboo-Prince George | 788 | Y | N |
| CA-0056 | Yukon | 175 | Y | N |
| CA-0057 | Northwest Territories | 7450 | Y | N |
| MX-0024 | Cananea-Nogales | 119 | Y | N |
| MX-0026 | Mexicali | 99 | Y | N |
| MX-0030 | Reynosa-Nuevo Laredo | 58 | Y | N |
| US-0010 | Downtown Los Angeles | 0 | N | Y |
| US-0022 | San Joaquin Valley | 5 | Y | N |
| US-0045 | South Side-Calumet | 1 | N | Y |
| US-0046 | DuPage-Northwest Suburbs | 13 | Y | N |
| US-0062 | Suburban Maryland | 109 | Y | N |
| US-0079 | New Hampshire | 10 | Y | N |
| US-0088 | Bronx-Westchester | 34 | Y | N |
| US-0091 | Central New York | 92 | Y | N |
| US-0104 | Portland Oregon | 49 | Y | N |
| US-0107 | Delaware Valley PA Suburbs | 5 | Y | N |
| US-0109 | Northeastern and Northern Pennsylvania | 24 | Y | N |
| US-0137 | Northern Virginia | 54 | Y | N |
| US-0138 | Richmond-Central Virginia | 59 | Y | N |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

CA-0059 (184), US-0003 (175), CA-0058 (156), CA-0057 (89), US-0004 (74), GL-0001 (71), GL-0003 (66), CA-0029 (41), GL-0002 (39), CA-0053 (36), CA-0028 (32), CA-0054 (31), US-0095 (28), US-0034 (23), CA-0024 (20), MX-0027 (20), US-0140 (20), CA-0052 (19), US-0128 (17), US-0068 (16), US-0139 (14), CA-0049 (13), US-0061 (13), US-0064 (13), CA-0012 (12), CA-0021 (12), US-0037 (12), MX-0036 (11), US-0123 (11), US-0058 (10), US-0089 (10), MX-0025 (9), US-0042 (9), US-0145 (9), CA-0048 (8), US-0063 (8), CA-0014 (7), CA-0026 (7), CA-0031 (7), CA-0044 (7), MX-0044 (7), US-0111 (7), CA-0025 (6), CA-0050 (6), MX-0039 (6), US-0021 (6), MX-0015 (5), MX-0033 (5), MX-0047 (5), US-0012 (5), US-0041 (5), US-0091 (5), CA-0011 (4), CA-0051 (4), CA-0056 (4), MX-0023 (4), MX-0026 (4), MX-0041 (4), MX-0048 (4), US-0002 (4), US-0017 (4), US-0056 (4), US-0082 (4), US-0083 (4), US-0129 (4), US-0141 (4), BM-0001 (3), CA-0013 (3), CA-0019 (3), CA-0022 (3), MX-0005 (3), MX-0028 (3), MX-0030 (3), US-0020 (3), US-0031 (3), US-0036 (3), US-0071 (3), US-0072 (3), US-0098 (3), US-0112 (3), CA-0001 (2), CA-0005 (2), CA-0006 (2), CA-0008 (2), CA-0009 (2), CA-0015 (2), CA-0020 (2), CA-0023 (2), CA-0030 (2), CA-0046 (2), CA-0047 (2), CA-0055 (2), MX-0007 (2), MX-0008 (2), MX-0009 (2), MX-0011 (2), MX-0013 (2), MX-0016 (2), MX-0018 (2), MX-0019 (2), MX-0022 (2), MX-0029 (2), MX-0031 (2), MX-0032 (2), MX-0034 (2), MX-0038 (2), MX-0043 (2), MX-0045 (2), US-0018 (2), US-0028 (2), US-0035 (2), US-0046 (2), US-0048 (2), US-0051 (2), US-0057 (2), US-0059 (2), US-0062 (2), US-0065 (2), US-0066 (2), US-0086 (2), US-0087 (2), US-0102 (2), US-0104 (2), US-0110 (2), US-0132 (2)

## Visual check

`preview-north-america.png` in this folder is province-ids.png around the region (pixels x 288..3438, y 100..2480, scaled by 0.76).
