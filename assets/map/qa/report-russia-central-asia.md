# Map QA report: russia-central-asia

_Written by `tools/map-pipeline/run.py --region russia-central-asia` (pipeline pb-2). Source of the rows: `provinces-russia-central-asia.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 356 provinces of `provinces-russia-central-asia.csv` have a crosswalk row and pixels (12 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 356 |
| ... ARM | 6 |
| ... AZE | 10 |
| ... GEO | 7 |
| ... KAZ | 26 |
| ... KGZ | 9 |
| ... RUS | 259 |
| ... TJK | 9 |
| ... TKM | 13 |
| ... UZB | 17 |
| Regions matched | 128 of 128 |
| Provinces by method: admin1 | 95 |
| Provinces by method: admin2 | 8 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 253 |
| Flagged for review (confidence < 0.6) | 0 |
| Placed by a builder hint (`hints/russia-central-asia.toml`) | 27 |
| Tiny (under 64 px) | 12 |
| Given a pixel at their interior point (no pixel centre inside) | 0 |
| More than one part (islands, exclaves) | 125 |
| Coastal flag differs from the CSV | 2 |
| Small for their region (not Metro, under 5% of the region's mean) | 0 |
| Voronoi-split blocks where one province takes 75% or more | 6 |
| Places named in a province's name or notes that lie in another province | 0 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 4 |
| Admin-1 units left without a province | 0 |
| Sea links with a province of this file | 13 |
| City probe points (fail on a mismatch; D686) | 172 pass, 0 mismatch, 6 listed |
| Metro reach scan rows (listed; D686) | 1 |
| Land exclaves of 5 px or more (fail unless explained; D691) | 15 (0 unexplained) |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) | 1 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Split giants

Provinces over 250,000 km2 that are not Arctic, cut into parts of at most 51,722 km2 (Eastern Iowa, US-0053) by `run.py giants` and `[subdivide]` in the hints (D820). Areas are geodesic, of the final shapes; the step fails on a part over the cap. Borders between parts (D850, D856): km along rivers and lake centerlines, along the building pieces' edges (licensed ADM2 lines, or town catchments), meandering, and straight; the style is the organic cut kept (D854).

| Province | Name | Parts | Pieces | Area (km2) | Smallest part | Largest part | Parts in several pieces | River km | Piece-edge km | Meander km | Straight km | Style |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RU-0021 | Murmansk-Karelia | 7 | towns | 309,127 | 41,031 | 46,286 | 6 | 0 | 416 | 232 | 0 | meanders |
| RU-0022 | Arkhangelsk | 9 | towns | 403,834 | 43,075 | 47,876 | 6 | 0 | 599 | 1,703 | 0 | meanders, bent town edges (seed RU-0022:3) |
| RU-0023 | Komi-Nenets | 13 | towns | 595,239 | 42,996 | 47,867 | 2 | 0 | 414 | 2,700 | 0 | rivers, meanders, bent town edges |
| RU-0050 | Surgut-Khanty-Mansiysk | 9 | towns | 393,178 | 42,294 | 46,246 | 2 | 0 | 703 | 2,133 | 0 | rivers, meanders, bent town edges |
| RU-0052 | Yamal | 14 | towns | 686,519 | 48,761 | 49,269 | 5 | 0 | 283 | 4,282 | 372 | meanders, bent town edges (seed RU-0052:2) |
| RU-0055 | Tomsk | 7 | towns | 314,786 | 43,980 | 45,841 | 0 | 356 | 61 | 685 | 0 | rivers, meanders, bent town edges |
| RU-0057 | Altai | 6 | towns | 264,525 | 41,814 | 45,266 | 1 | 0 | 496 | 1,199 | 0 | rivers, meanders, bent town edges |
| RU-0058 | Krasnoyarsk | 6 | towns | 283,193 | 44,257 | 49,196 | 0 | 0 | 563 | 684 | 111 | rivers, meanders, bent town edges |
| RU-0060 | Angara-Evenkia | 15 | towns | 693,514 | 45,364 | 46,884 | 1 | 462 | 480 | 3,509 | 0 | rivers, meanders, bent town edges |
| RU-0063 | Bratsk-Ust-Kut | 13 | towns | 636,478 | 47,769 | 50,882 | 4 | 0 | 445 | 3,745 | 0 | meanders, bent town edges (seed RU-0063:2) |
| RU-0065 | Khabarovsk | 17 | towns | 822,969 | 45,271 | 50,958 | 4 | 0 | 683 | 5,537 | 0 | meanders, bent town edges (seed RU-0065:4) |
| RU-0066 | Amur | 8 | towns | 360,963 | 43,380 | 48,087 | 0 | 0 | 408 | 2,129 | 0 | rivers, meanders, bent town edges |
| RU-0069 | Kamchatka | 10 | towns | 463,768 | 45,228 | 49,021 | 6 | 0 | 711 | 2,128 | 0 | rivers, meanders, bent town edges (seed RU-0069:4) |
| RU-0070 | Magadan-Chukotka | 25 | towns | 1,180,855 | 42,761 | 50,931 | 12 | 0 | 906 | 5,234 | 704 | meanders, bent town edges |
| RU-0071 | Yakutsk-Aldan | 27 | towns | 1,319,887 | 47,977 | 49,663 | 4 | 0 | 831 | 7,743 | 1,596 | meanders, bent town edges |
| RU-0073 | Buryatia | 7 | towns | 332,959 | 46,457 | 48,704 | 3 | 0 | 122 | 512 | 0 | meanders |
| RU-0074 | Zabaykalsky | 9 | towns | 432,416 | 45,395 | 50,436 | 2 | 356 | 951 | 1,384 | 124 | rivers, meanders, bent town edges |

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes, river and lake centerlines) | Public domain | yes |
| geoBoundaries gbOpen AZE ADM2 (Wikipedia) | Creative Commons Attribution-ShareAlike 3.0 Unported | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 3.0 Unported); Voronoi path |
| geoBoundaries gbOpen GEO ADM2 (geoBoundaries, Wikimedia Commons) | Public Domain | yes |
| geoBoundaries gbOpen KAZ ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen KGZ ADM2 (geoBoundaries, Wikipedia, Districts of Kyrgyzstan) | Creative Commons Attribution-ShareAlike 3.0 Unported | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 3.0 Unported); Voronoi path |
| geoBoundaries gbOpen RUS ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen TJK ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen TKM ADM2 (CIESIN) | Creative Commons Attribution-ShareAlike 3.0 Unported | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 3.0 Unported); Voronoi path |
| geoBoundaries gbOpen UZB ADM2 (OCHA ROCCA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |

Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, public domain and the attribution-only government licences OGL-Canada 2.0, OGL-UK 3.0, Data licence Germany Attribution 2.0, Etalab 2.0, Spain's INE licence, Singapore ODL 1.0 and Korea OGL Type 1 (D685); a region whose country has no allowed ADM2 is split by Voronoi.

## Low-confidence rows for review

None.

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| GE-0006 | Gori-Borjomi | seeds: point 42.98,41.64 (hint); point 43.38,41.84 (hint); point 43.49,41.4 (hint); point 44.11,41.98 (hint); point 44.48,42.48 (hint); point 44.72,41.85 (hint); 2 whole admin1 units, split: Shida Kartli |
| GE-0007 | South Ossetia | seeds: builder polygon (hint); 0 whole admin1 units, split: Shida Kartli |
| KG-0008 | Alay-Uzgen | seeds: point 73.25,39.73 (hint); point 73.3,40.77 (hint); point 73.44,40.32 (hint); point 73.9,39.68 (hint); 0 whole parts, 1 split |
| KZ-0004 | Almaty Foothills | seeds: point 76.62,43.2 (hint); point 77.07,43.87 (hint); point 77.24,43.3 (hint); point 77.45,43.36 (hint); 1 whole parts, 1 split |
| KZ-0007 | Saryagash-Maktaaral | seeds: point 68.4,40.85 (hint); point 69.17,41.45 (hint); 0 whole parts, 1 split |
| KZ-0011 | Aktobe | seeds: point 57.21,50.28 (hint); 0 whole parts, 1 split |
| KZ-0014 | Tengiz-Kashagan | seeds: point 53.0,46.5 (hint); point 53.38,46.15 (hint); 0 whole parts, 1 split |
| KZ-0015 | Aktau | seeds: point 51.17,43.65 (hint); point 51.68,43.18 (hint); 3 whole parts, 1 split |
| KZ-0020 | Balkhash-Karkaraly | seeds: point 74.98,46.84 (hint); point 75.47,49.41 (hint); 1 whole parts, 1 split |
| RU-0002 | Moscow South-West | seeds: point 37.48,55.74 (hint); point 37.53,55.7 (hint); point 37.56,55.66 (hint); 0 whole parts, 1 split |
| RU-0003 | Moscow North | seeds: point 37.18,55.99 (hint); point 37.5,55.8 (hint); point 37.55,55.83 (hint); 2 whole parts, 1 split |
| RU-0004 | Moscow East-South-East | seeds: point 37.66,55.7 (hint); point 37.72,55.69 (hint); point 37.8,55.64 (hint); point 37.85,55.75 (hint); 0 whole parts, 1 split |
| RU-0005 | Moscow Inner Suburbs | seeds: point 37.27,55.68 (hint); point 37.33,55.82 (hint); point 37.43,55.89 (hint) (snapped to land); point 37.61,55.4 (hint); point 37.73,55.91 (hint); point 37.85,55.92 (hint); point 37.9,55.68 (hint); point 37.94,55.8 (hint); 0 whole parts, 1 split |
| RU-0006 | Moscow Oblast Outer Ring | seeds: point 35.95,56.03 (hint); point 36.02,55.5 (hint); point 36.73,56.33 (hint); point 37.17,56.74 (hint); point 37.41,54.92 (hint); point 37.52,56.34 (hint); point 38.13,56.31 (hint); point 38.44,55.85 (hint); point 38.78,55.1 (hint); point 39.54,55.57 (hint); 0 whole parts, 1 split |
| RU-0015 | St Petersburg Center-Vasilievsky | seeds: point 30.26,59.94 (hint); point 30.31,59.94 (hint); 0 whole parts, 1 split |
| RU-0016 | St Petersburg South-Port | seeds: point 29.93,59.94 (hint) (snapped to land); point 30.21,59.88 (hint); point 30.26,59.88 (hint); point 30.27,59.8 (hint); point 30.6,59.75 (hint); 1 whole parts, 1 split |
| RU-0017 | St Petersburg North-Lakhta | seeds: point 29.97,60.1 (hint); point 30.18,59.99 (hint) (snapped to land); point 30.33,60.05 (hint); 0 whole parts, 1 split |
| RU-0068 | Kuril Islands | seeds: point 145.9,44.0 (hint) (snapped to land); point 146.7,43.8 (hint); point 147.9,45.2 (hint); point 154.0,48.8 (hint) (snapped to land); point 155.9,50.4 (hint); 21 whole parts |
| TJ-0002 | Hisor-Tursunzoda | seeds: point 68.23,38.51 (hint); point 68.67,38.52 (hint); 0 whole parts, 1 split |
| TJ-0003 | Rasht-Rogun | seeds: point 69.77,38.73 (hint); point 70.37,39.04 (hint); point 71.2,39.2 (hint); 0 whole parts, 1 split |
| TJ-0005 | Panjakent-Zeravshan | seeds: point 67.61,39.5 (hint); point 68.53,39.39 (hint); 0 whole parts, 1 split |
| TJ-0006 | Istaravshan-Isfara | seeds: point 69.01,39.91 (hint); point 70.23,40.45 (hint); point 70.63,40.12 (hint); 2 whole parts, 1 split |
| TM-0003 | Gokdepe-Karakum | seeds: point 57.43,38.43 (hint); point 57.95,38.15 (hint); point 58.88,40.12 (hint); 0 whole parts, 1 split |
| TM-0007 | Dashoguz | seeds: point 59.97,41.84 (hint); 0 whole parts, 1 split |
| TM-0010 | Bagtyyarlyk-Koytendag | seeds: point 64.49,38.83 (hint); point 65.21,37.83 (hint); point 66.4,37.8 (hint); 0 whole parts, 1 split |
| TM-0012 | Galkynysh-Yoloten | seeds: point 61.6,36.4 (hint); point 62.35,35.27 (hint); point 62.36,37.33 (hint); point 62.45,37.25 (hint); 0 whole parts, 1 split |
| TM-0013 | Bayramaly-Murgab | seeds: point 61.97,37.5 (hint); point 62.17,37.62 (hint); point 62.4,37.43 (hint); 0 whole parts, 1 split |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| KG-0001 | Bishkek | 7 | 1 | 5793.5, 1570.5 |
| TJ-0001 | Dushanbe | 9 | 1 | 5660.5, 1686.5 |
| RU-0001 | Moscow Center-Moscow City | 11 | 1 | 4952.5, 1188.5 |
| UZ-0001 | Tashkent | 14 | 1 | 5671.5, 1612.5 |
| AM-0001 | Yerevan | 16 | 1 | 5109.5, 1643.5 |
| GE-0001 | Tbilisi | 16 | 1 | 5115.5, 1601.5 |
| RU-0015 | St Petersburg Center-Vasilievsky | 20 | 1 | 4787.5, 1051.5 |
| KZ-0002 | Almaty | 21 | 1 | 5846.5, 1558.5 |
| RU-0004 | Moscow East-South-East | 27 | 1 | 4954.5, 1191.5 |
| RU-0003 | Moscow North | 39 | 3 | 4948.5, 1186.5 |
| KZ-0001 | Nur-Sultan | 54 | 1 | 5721.5, 1331.5 |
| TM-0001 | Ashgabat | 54 | 1 | 5422.5, 1702.5 |

## Anchor cities

Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own name names lands on that province (and, for a Metro province, near its middle and in its largest 4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a province of that Metro, and each key city lands on one of its provinces (key-cities.csv).

| Check | Province | Place | Expected | Got |
|---|---|---|---|---|
| city on the edge | RU-0137 | Sayanogorsk | RU-0137 | RU-0061 |

No misses; the rows above are allowed: a city part across a narrow strait, or a city whose own pixel a neighbour took while its province holds a touching pixel.

## Natural Earth labels

Natural Earth units whose capital another region of the country names (in a province name or notes) while their own region does not: the sign of NE giving units each other's names, as in Eritrea and Guyana (D687). Each row fails the step unless `[review] ne_label_ok` in the hints names the region.

| Region | NE unit | Capital | Named by |
|---|---|---|---|
| RUS:Krasnoyarsk (checked) | Krasnoyarsk (RUS-2603) | Abakan | RUS:Khakassia-Tuva |

## City probe

Points of `tools/map-pipeline/checks/city-points.txt` whose expected province is in this file, looked up in province-index.png: a point passes on its pixel or one of the 8 around it (D686). The step fails on a mismatch.

| Point | Expected | Got | Result |
|---|---|---|---|
| Chekhov (37.47, 55.15) | ? | RU-0006 | listed |
| Dmitrov (37.52, 56.34) | ? | RU-0006 | listed |
| Kronstadt (29.77, 60.0) | ? | RU-0016 | listed |
| Naro-Fominsk (36.73, 55.39) | ? | RU-0006 | listed |
| Peterhof (29.9, 59.88) | ? | RU-0016 | listed |
| Troitsk (New Moscow) (37.3, 55.48) | ? | RU-0002 | listed |
| Abakan (split part) (91.445, 53.7037) | RU-0136 | RU-0136 | on it |
| Akhaltsikhe (42.98, 41.64) | GE-0006 | GE-0006 | on it |
| Aldan (split part) (125.3894, 58.603) | RU-0243 | RU-0243 | on it |
| Almaty (76.95, 43.24) | KZ | KZ-0002 | on it |
| Anadyr (177.51, 64.73) | RU-0211 | RU-0211 | nearest across water |
| Anadyr (split part) (177.475, 64.737) | RU-0211 | RU-0211 | on it |
| Apatity (split part) (33.393, 67.5731) | RU-0075 | RU-0075 | on it |
| Bagdarin (split part) (113.6, 54.4333) | RU-0248 | RU-0248 | on it |
| Balashikha (37.94, 55.8) | RU-0005 | RU-0005 | on it |
| Barnaul (main city of a split giant) (83.745, 53.355) | RU-0057 | RU-0057 | on it |
| Belogorsk (split part) (128.4637, 50.9191) | RU-0186 | RU-0186 | on it |
| Big Diomede (-169.05, 65.77) | RU-0206 | RU-0206 | on it |
| Big Port SPb (30.21, 59.88) | RU-0016 | RU-0016 | on it |
| Bilibino (split part) (166.4486, 68.0526) | RU-0202 | RU-0202 | on it |
| Biysk (split part) (85.18, 52.5341) | RU-0129 | RU-0129 | on it |
| Blagoveshchensk (main city of a split giant) (127.5333, 50.2666) | RU-0066 | RU-0066 | on it |
| Bodaybo (split part) (114.1932, 57.8507) | RU-0157 | RU-0157 | on it |
| Borjomi (43.38, 41.84) | GE-0006 | GE-0006 | on it |
| Bovanenkovo (site of a split giant) (68.37, 70.35) | RU-0111 | RU-0111 | on it |
| Bratsk (main city of a split giant) (101.615, 56.157) | RU-0063 | RU-0063 | on it |
| Bronka (29.93, 59.94) | RU-0016 | RU-0016 | nearest across water |
| Chegdomyn (split part) (133.0241, 51.1178) | RU-0174 | RU-0174 | on it |
| Chita (main city of a split giant) (113.465, 52.055) | RU-0074 | RU-0074 | on it |
| Chukotka east Uelen (-169.8, 66.16) | RU-0206 | RU-0206 | nearest across water |
| Chumikan (split part) (135.3145, 54.7114) | RU-0170 | RU-0170 | on it |
| De Kastri (split part) (140.7833, 51.4666) | RU-0176 | RU-0176 | on it |
| Egvekinot (split part) (-179.1837, 66.3221) | RU-0203 | RU-0203 | on it |
| Eldikan (split part) (135.1833, 60.8) | RU-0236 | RU-0236 | on it |
| Evensk (split part) (159.2333, 61.95) | RU-0217 | RU-0217 | on it |
| Gori (44.11, 41.98) | GE-0006 | GE-0006 | on it |
| Gusinoozyorsk (split part) (106.5004, 51.2808) | RU-0251 | RU-0251 | on it |
| Gyda (split part) (78.4661, 70.8814) | RU-0110 | RU-0110 | on it |
| Igrim (split part) (64.4194, 63.1933) | RU-0102 | RU-0102 | on it |
| Iturup Kurilsk (147.87, 45.23) | RU-0068 | RU-0068 | nearest across water |
| Java SO (43.93, 42.4) | GE-0007 | GE-0007 | on it |
| Kandalaksha (split part) (32.4144, 67.1643) | RU-0077 | RU-0077 | on it |
| Kansk (split part) (95.71, 56.19) | RU-0134 | RU-0134 | on it |
| Kapotnya (37.8, 55.64) | RU-0004 | RU-0005 | within a pixel |
| Kaskelen (76.62, 43.2) | KZ-0004 | KZ-0004 | on it |
| Kem (split part) (34.5684, 64.9536) | RU-0078 | RU-0078 | on it |
| Khabarovsk (main city of a split giant) (135.12, 48.455) | RU-0065 | RU-0065 | on it |
| Khakhar (split part) (135.43, 57.6666) | RU-0167 | RU-0167 | on it |
| Khandyga (split part) (135.6, 62.666) | RU-0233 | RU-0233 | on it |
| Khanty Mansiysk (split part) (69.0015, 61.0015) | RU-0104 | RU-0104 | on it |
| Khimki (37.43, 55.89) | RU-0005 | RU-0003 | within a pixel |
| Kirensk (split part) (108.1119, 57.7857) | RU-0158 | RU-0158 | on it |
| Kirov Plant (30.26, 59.88) | RU-0016 | RU-0016 | on it |
| Klin (36.73, 56.33) | RU-0006 | RU-0006 | on it |
| Klyuchi (split part) (160.85, 56.3) | RU-0193 | RU-0193 | on it |
| Kodinskiy (split part) (99.0996, 58.6946) | RU-0150 | RU-0150 | on it |
| Kogalym (split part) (74.4941, 62.0446) | RU-0103 | RU-0103 | on it |
| Kolomna (38.78, 55.1) | RU-0006 | RU-0006 | on it |
| Kolpashevo (split part) (82.9071, 58.311) | RU-0127 | RU-0127 | on it |
| Kolpino (30.6, 59.75) | RU-0016 | RU-0016 | on it |
| Kolyma (site of a split giant) (147.6, 61.2) | RU-0218 | RU-0218 | on it |
| Komsa (split part) (89.2577, 61.868) | RU-0142 | RU-0142 | on it |
| Komsomolsk na Amure (split part) (137.02, 50.555) | RU-0175 | RU-0175 | on it |
| Korf (split part) (165.8183, 60.3321) | RU-0190 | RU-0190 | on it |
| Korolev (37.83, 55.92) | RU-0005 | RU-0005 | on it |
| Korolev2 (37.85, 55.92) | RU-0005 | RU-0005 | on it |
| Kotlas (split part) (46.6631, 61.2631) | RU-0086 | RU-0086 | on it |
| Krasnokamensk (site of a split giant) (118.03, 50.1) | RU-0258 | RU-0258 | on it |
| Krasnoyarsk (main city of a split giant) (92.8641, 56.0159) | RU-0058 | RU-0058 | on it |
| Lakhta (30.18, 59.99) | RU-0017 | RU-0017 | nearest across water |
| Lesosibirsk (main city of a split giant) (92.4833, 58.2433) | RU-0060 | RU-0060 | on it |
| Lyubertsy (37.9, 55.68) | RU-0005 | RU-0005 | on it |
| Magadan (main city of a split giant) (150.81, 59.575) | RU-0070 | RU-0070 | on it |
| Manily (split part) (165.3, 62.55) | RU-0187 | RU-0187 | on it |
| Matochkin Shar (split part) (56.4497, 73.27) | RU-0082 | RU-0082 | on it |
| Mezen (split part) (44.24, 65.8522) | RU-0083 | RU-0083 | on it |
| Mikhalkino (split part) (161.4811, 69.4244) | RU-0220 | RU-0220 | on it |
| Mogocha (split part) (119.7666, 53.7333) | RU-0254 | RU-0254 | on it |
| Moscow Kremlin (37.617, 55.752) | RU-0001 | RU-0001 | on it |
| Moscow MSU (37.53, 55.7) | RU-0002 | RU-0002 | on it |
| Mozhaisk (36.02, 55.5) | RU-0006 | RU-0006 | on it |
| Mtskheta (44.72, 41.85) | GE-0006 | GE-0006 | on it |
| Mukhomornoye (split part) (173.3333, 66.4171) | RU-0207 | RU-0207 | on it |
| Murmansk (main city of a split giant) (33.1, 68.97) | RU-0021 | RU-0021 | on it |
| Mys Shmidta (split part) (-179.5, 68.9337) | RU-0199 | RU-0199 | on it |
| Mytishchi (37.73, 55.91) | RU-0005 | RU-0005 | on it |
| Nadym (split part) (72.5148, 65.5298) | RU-0114 | RU-0114 | on it |
| Nakhodka (split part) (77.52, 67.7504) | RU-0112 | RU-0112 | on it |
| Naryan Mar (split part) (53.0574, 67.6474) | RU-0090 | RU-0090 | on it |
| Nerchinsk (split part) (116.5486, 52.009) | RU-0255 | RU-0255 | on it |
| Neryungri (site of a split giant) (124.72, 56.66) | RU-0244 | RU-0244 | on it |
| Nikolayevsk na Amure (split part) (140.73, 53.1496) | RU-0172 | RU-0172 | on it |
| Noginsk (38.44, 55.86) | RU-0006 | RU-0006 | on it |
| Novosibirsk (82.92, 55.03) | RU | RU-0053 | on it |
| Noyabrsk (split part) (75.6165, 63.1665) | RU-0120 | RU-0120 | on it |
| Nyagan (split part) (65.3814, 62.1465) | RU-0106 | RU-0106 | on it |
| Nyukzha (split part) (121.6131, 56.5312) | RU-0180 | RU-0180 | on it |
| Odintsovo (37.28, 55.68) | RU-0005 | RU-0005 | on it |
| Okhotsk (split part) (143.217, 59.383) | RU-0165 | RU-0165 | nearest across water |
| Olimpiada (site of a split giant) (92.9, 59.17) | RU-0060 | RU-0060 | on it |
| Olyokminsk (split part) (120.3926, 60.5032) | RU-0238 | RU-0238 | on it |
| Omolon (split part) (160.5, 65.25) | RU-0204 | RU-0204 | on it |
| Omsukchan (split part) (155.8, 62.5333) | RU-0216 | RU-0216 | on it |
| Oymyakon (split part) (142.7698, 63.4214) | RU-0231 | RU-0231 | on it |
| Palana (split part) (159.95, 59.084) | RU-0191 | RU-0191 | on it |
| Pechora (split part) (57.2087, 65.1587) | RU-0095 | RU-0095 | on it |
| Petropavlovsk Kamchatskiy (main city of a split giant) (158.623, 53.062) | RU-0069 | RU-0069 | on it |
| Petrovsk Zabaykalskiy (split part) (108.8327, 51.2827) | RU-0259 | RU-0259 | on it |
| Petrozavodsk (split part) (34.3612, 61.7813) | RU-0080 | RU-0080 | on it |
| Pevek (split part) (170.3133, 69.7008) | RU-0197 | RU-0197 | on it |
| Podolsk (37.55, 55.43) | RU-0005 | RU-0002 | within a pixel |
| Provideniya (split part) (-173.2258, 64.4235) | RU-0206 | RU-0206 | on it |
| Pulkovo (30.27, 59.8) | RU-0016 | RU-0016 | on it |
| Rubtsovsk (split part) (81.21, 51.52) | RU-0130 | RU-0130 | on it |
| SPb Nevsky2 (30.36, 59.93) | RU-0015 | RU-0015 | on it |
| SPb Vasilievsky (30.25, 59.94) | RU-0015 | RU-0015 | on it |
| Sabetta (site of a split giant) (72.05, 71.27) | RU-0109 | RU-0109 | on it |
| Salekhard (split part) (66.61, 66.535) | RU-0116 | RU-0116 | on it |
| Sangar (split part) (127.4739, 63.9241) | RU-0232 | RU-0232 | on it |
| Saranpaul (split part) (60.97, 64.2505) | RU-0101 | RU-0101 | on it |
| Sayanogorsk (split part) (91.4004, 53.0894) | RU-0137 | RU-0061 | within a pixel |
| Segezha (split part) (34.3243, 63.7548) | RU-0079 | RU-0079 | on it |
| Sergiev Posad (38.13, 56.31) | RU-0006 | RU-0006 | on it |
| Serpukhov (37.41, 54.92) | RU-0006 | RU-0006 | on it |
| Sestroretsk (29.96, 60.1) | RU-0017 | RU-0017 | on it |
| Severobaykalsk (split part) (109.313, 55.634) | RU-0247 | RU-0247 | on it |
| Severodvinsk (main city of a split giant) (39.83, 64.57) | RU-0022 | RU-0022 | on it |
| Shoyna (split part) (44.1334, 67.8666) | RU-0093 | RU-0093 | on it |
| Siglan (split part) (152.4166, 59.0337) | RU-0219 | RU-0219 | on it |
| Slavgorod (split part) (78.6696, 53.0049) | RU-0128 | RU-0128 | on it |
| Sovetskaya Gavan (split part) (140.2749, 48.9699) | RU-0178 | RU-0178 | nearest across water |
| St Petersburg (30.32, 59.94) | RU | RU-0015 | on it |
| St Petersburg Nevsky (30.34, 59.93) | RU-0015 | RU-0015 | on it |
| Stepanakert (46.75, 39.82) | AZ-0010 | AZ-0010 | on it |
| Strelka (split part) (152.2502, 61.867) | RU-0212 | RU-0212 | on it |
| Strezhevoy (split part) (77.5777, 60.7332) | RU-0122 | RU-0122 | on it |
| Sukhumi (41.02, 43.0) | GE-0003 | GE-0003 | on it |
| Surgut (main city of a split giant) (73.425, 61.2599) | RU-0050 | RU-0050 | on it |
| Susuman (split part) (148.1668, 62.7833) | RU-0213 | RU-0213 | on it |
| Syktyvkar (main city of a split giant) (50.82, 61.66) | RU-0023 | RU-0023 | on it |
| Taksimo (split part) (114.89, 56.3315) | RU-0246 | RU-0246 | on it |
| Talgar (77.24, 43.3) | KZ-0004 | KZ-0004 | on it |
| Tashkent (69.28, 41.31) | UZ | UZ-0001 | on it |
| Tayshet (split part) (97.9877, 55.9277) | RU-0161 | RU-0161 | on it |
| Tomsk (main city of a split giant) (84.975, 56.495) | RU-0055 | RU-0055 | on it |
| Tskhinvali (43.96, 42.23) | GE-0007 | GE-0007 | on it |
| Tukchi (split part) (139.5, 57.367) | RU-0168 | RU-0168 | on it |
| Tulun (split part) (100.5654, 54.5653) | RU-0163 | RU-0163 | on it |
| Tunguskhaya (split part) (125.25, 64.9004) | RU-0223 | RU-0223 | on it |
| Tura (split part) (100.25, 64.2833) | RU-0139 | RU-0139 | on it |
| Tynda (split part) (124.7076, 55.1743) | RU-0182 | RU-0182 | on it |
| Udokan (site of a split giant) (118.3, 56.6) | RU-0252 | RU-0252 | on it |
| Ugolnye Kopi (split part) (177.7, 64.7333) | RU-0205 | RU-0205 | on it |
| Ukhta (split part) (53.69, 63.56) | RU-0099 | RU-0099 | on it |
| Ulan Ude (main city of a split giant) (107.625, 51.825) | RU-0073 | RU-0073 | on it |
| Umba (split part) (34.3455, 66.6814) | RU-0076 | RU-0076 | on it |
| Urengoy (site of a split giant) (76.63, 66.08) | RU-0113 | RU-0113 | on it |
| Ust Kamchatsk (split part) (162.435, 56.2135) | RU-0194 | RU-0194 | nearest across water |
| Ust Kut (split part) (105.76, 56.765) | RU-0160 | RU-0160 | on it |
| Ust Maya (split part) (134.5433, 60.4566) | RU-0237 | RU-0237 | on it |
| Ust Nera (split part) (143.2, 64.5666) | RU-0226 | RU-0226 | on it |
| Ust-Ulimsk (split part) (102.6333, 57.99) | RU-0159 | RU-0159 | on it |
| Utkholok (split part) (157.2333, 57.5504) | RU-0192 | RU-0192 | on it |
| Vankor (site named in RU-0060's notes, in RU-0059) (83.55, 67.8) | RU-0059 | RU-0059 | on it |
| Varandey (site of a split giant) (58.0, 68.82) | RU-0089 | RU-0089 | on it |
| Velsk (split part) (42.0974, 61.0674) | RU-0088 | RU-0088 | on it |
| Volokolamsk (35.95, 56.03) | RU-0006 | RU-0006 | on it |
| Vorkuta (split part) (64.01, 67.5) | RU-0091 | RU-0091 | on it |
| Wrangel (-179.5, 71.2) | RU-0196 | RU-0196 | on it |
| Yakutsk (main city of a split giant) (129.735, 62.035) | RU-0071 | RU-0071 | on it |
| Yamburg (main city of a split giant) (74.9253, 67.9221) | RU-0052 | RU-0052 | on it |
| Yerema (split part) (107.7794, 60.3808) | RU-0153 | RU-0153 | on it |
| Yuzhno-Kurilsk (145.86, 44.03) | RU-0068 | RU-0068 | on it |
| Zaozernyy (split part) (94.7028, 55.962) | RU-0135 | RU-0135 | on it |
| Zelenograd (37.18, 55.99) | RU-0003 | RU-0003 | on it |
| Zeya (split part) (127.2666, 53.75) | RU-0183 | RU-0183 | on it |
| Zvezdnyj (split part) (-179.59, 70.9566) | RU-0196 | RU-0196 | on it |
| Zyryanka (split part) (150.89, 65.736) | RU-0224 | RU-0224 | on it |

## Metro reach

Metro provinces whose centroid is over 80 km from their Metro's city, that are over 4 times the Metro's median and 250 px, and regions where Metro provinces hold over 30% of the land beside rural ones (the D612 error). Listed for review; a Metro made of whole metropolitan units can be large by design.

| Check | Province or region | Detail |
|---|---|---|
| large for its Metro | RU-0005 Moscow Inner Suburbs | 787 px, the Metro's median is 39 px (Metro Moscow) |

## Land exclaves

Parts of 5 px or more that are not a province's largest part and touch no pixel outside every province (islands are not listed). Each is explained by a place its composite name names lying in it, by one of the province's own seeds (a hint point, or a place its notes name) lying in it, by a neck under a pixel wide that joins it to the rest in the shapes, or by a reason in `[review.exclave_ok]`; an unexplained one fails the step (D691).

| Province | Name | Pixels | At | Why |
|---|---|---|---|---|
| AZ-0006 | Mingachevir-Shirvan | 129 | 48.9, 40.1 | composite name: Şirvan lies in it |
| KG-0004 | Naryn | 7 | 73.99, 41.66 | a neck under a pixel wide joins it to the rest in the shapes |
| RU-0003 | Moscow North | 6 | 37.24, 56.01 | its own seed point 37.18,55.99 (hint) lies in it |
| RU-0003 | Moscow North | 6 | 37.08, 55.7 | a detached part of Natural Earth's Moscow city unit (the city has exclaves in the oblast) |
| RU-0026 | Novorossiysk-Sochi | 9 | 40.7, 44.55 | a neck under a pixel wide joins it to the rest in the shapes |
| RU-0028 | Volgograd | 5 | 45.32, 48.47 | a neck under a pixel wide joins it to the rest in the shapes |
| RU-0039 | Tolyatti-Syzran | 25 | 51.09, 54.51 | a neck under a pixel wide joins it to the rest in the shapes |
| RU-0042 | Chuvashia-Mari El-Mordovia | 6 | 42.28, 54.22 | a neck under a pixel wide joins it to the rest in the shapes |
| RU-0174 | Chegdomyn | 812 | 132.09, 53.57 | the cut across Khabarovsk's interior (a meander since D850; the straight cut of D822 left about 8,100 km2) leaves this piece (about 8,500 km2) on RU-0174's side; joined to any part it touches it would put that part over the cap (D822), and a curve may not grow it by more than 3% of the part (D854) |
| TJ-0006 | Istaravshan-Isfara | 344 | 70.31, 40.49 | its own seed point 70.63,40.12 (hint) lies in it |
| TJ-0006 | Istaravshan-Isfara | 7 | 70.58, 39.84 | Vorukh: Tajikistan's real exclave inside Kyrgyzstan |
| TM-0002 | Anau-Tejen | 15 | 61.32, 37.24 | a neck under a pixel wide joins it to the rest in the shapes |
| UZ-0005 | Kattakurgan-Urgut | 77 | 67.18, 39.44 | composite name: Urgut lies in it |
| UZ-0006 | Fergana | 24 | 71.09, 40.0 | Sokh and Shakhimardan: Uzbekistan's real exclaves inside Kyrgyzstan |
| UZ-0015 | Khorezm | 146 | 62.05, 40.96 | a neck under a pixel wide joins it to the rest in the shapes |

## Known for review

- AZ-0010 Nagorno-Karabakh (ARM-backed Artsakh) follows our province file: the whole Upper Karabakh and Kalbajar-Lachin economic regions of Natural Earth, which also hold the districts round the old oblast.
- GE-0007 South Ossetia is a province of the Shida Kartli-Mtskheta-Mtianeti-Samtskhe-Javakheti region in our file, so it is split from that region by Voronoi, not drawn on the breakaway's own line.
- KAZ:Shymkent and TKM:Ashgabat are cities Natural Earth merges into South Kazakhstan and Ahal; both are cut off by builder-drawn boxes.

## Watched small provinces

The microstates, city-states and metro splits the plan names (P8: Singapore, the London and Beijing splits, Hong Kong and Macau): every one has pixels, and a tiny one a click target at its label point.

| Province | Name | Pixels | Tiny | Label point (px) |
|---|---|---|---|---|
| RU-0001 | Moscow Center-Moscow City | 11 | Y | 4952.5, 1188.5 |
| RU-0002 | Moscow South-West | 217 | N | 4942.5, 1204.5 |
| RU-0003 | Moscow North | 39 | Y | 4948.5, 1186.5 |
| RU-0004 | Moscow East-South-East | 27 | Y | 4954.5, 1191.5 |
| RU-0068 | Kuril Islands | 803 | N | 7460.5, 1508.5 |
| GE-0003 | Abkhazia | 604 | N | 5036.5, 1565.5 |
| GE-0007 | South Ossetia | 166 | N | 5097.5, 1584.5 |
| AM-0001 | Yerevan | 16 | Y | 5109.5, 1643.5 |
| AM-0002 | Ararat-Armavir | 208 | N | 5116.5, 1650.5 |
| AM-0003 | Kotayk-Gegharkunik | 482 | N | 5123.5, 1637.5 |
| AM-0004 | Shirak-Aragatsotn | 367 | N | 5097.5, 1634.5 |
| AM-0005 | Lori-Tavush | 416 | N | 5111.5, 1622.5 |
| AM-0006 | Syunik-Vayots Dzor | 439 | N | 5132.5, 1654.5 |
| AZ-0010 | Nagorno-Karabakh | 843 | N | 5157.5, 1649.5 |

## Contested provinces

Drawn by our own province files (decision C), not the sources' de facto lines: each contested province sits in the region the CSV gives it, built as listed (an alias or carve hint where Natural Earth draws the land elsewhere). The game hatches them.

| Province | Name | Country | Contested | Region drawn from |
|---|---|---|---|---|
| RU-0068 | Kuril Islands | RUS | JPN claims | Sakhalin: name match 100 |
| GE-0003 | Abkhazia | GEO | RUS-backed breakaway | Abkhazia: alias hint -> GE-AB |
| GE-0007 | South Ossetia | GEO | RUS-backed breakaway | Shida Kartli-Mtskheta-Mtianeti-Samtskhe-Javakheti: name parts (3 pieces, worst match 100) |
| AZ-0010 | Nagorno-Karabakh | AZE | ARM-backed Artsakh | Upper Karabakh-Kalbajar-Lachin: alias hint -> region:Yukhari Garabakh Economic Region, region:Kalbajar-Lachin Economic Region |

## Region matching

Regions not matched one-to-one by name: builder aliases, Natural Earth region groups, composite names matched part by part, carves (D676) and admin-1 units no region named, given to the touching region (D673). Check these on the preview too.

| Region | Matched by | Units |
|---|---|---|
| ARM: Ararat-Armavir | name parts (2 pieces, worst match 100) | 2 |
| ARM: Kotayk-Gegharkunik | name parts (2 pieces, worst match 100) | 2 |
| ARM: Lori-Tavush | name parts (2 pieces, worst match 100) | 2 |
| ARM: Shirak-Aragatsotn | name parts (2 pieces, worst match 100) | 2 |
| ARM: Syunik-Vayots Dzor | name parts (2 pieces, worst match 100) | 2 |
| AZE: Absheron-Mountainous Shirvan | alias hint -> region:Absheron Economic Region, -AZ-BA, region:Daghlig Shirvan Economic Region | 7 |
| AZE: Aran | alias hint -> region:Aran Economic Region | 19 |
| AZE: Baku | alias hint -> AZ-BA | 1 |
| AZE: Ganja-Gazakh | alias hint -> region:Ganja-Gazakh Economic Region | 11 |
| AZE: Guba-Khachmaz | alias hint -> region:Guba-Khachmaz Economic Region | 5 |
| AZE: Lankaran | alias hint -> region:Lankaran Economic Region | 7 |
| AZE: Nakhchivan | alias hint -> region:Naxçıvan Autonomous Republic | 8 |
| AZE: Shaki-Zagatala | alias hint -> region:Shaki-Zaqatala Economic Region | 7 |
| AZE: Upper Karabakh-Kalbajar-Lachin | alias hint -> region:Yukhari Garabakh Economic Region, region:Kalbajar-Lachin Economic Region | 13 |
| GEO: Abkhazia | alias hint -> GE-AB | 1 |
| GEO: Adjara-Guria | name parts (2 pieces, worst match 100) | 2 |
| GEO: Imereti-Samegrelo-Racha | alias hint -> GE-IM, GE-SZ, GE-RL | 3 |
| GEO: Kvemo Kartli-Kakheti | name parts (2 pieces, worst match 100) | 2 |
| GEO: Shida Kartli-Mtskheta-Mtianeti-Samtskhe-Javakheti | name parts (3 pieces, worst match 100) | 3 |
| KAZ: Almaty | alias hint -> KAZ-4829 | 1 |
| KAZ: Almaty Region | alias hint -> KAZ-3207 | 1 |
| KAZ: Shymkent | no admin-1 match (best unit 75, group 0); carve: builder polygon from KAZ:Turkistan | 0 |
| KAZ: Turkistan | name match 100; less KAZ:Shymkent (carve) | 1 |
| RUS: Altai Krai-Altai Republic | alias hint -> RU-ALT, RU-AL | 2 |
| RUS: Astrakhan-Kalmykia | name parts (2 pieces, worst match 94) | 2 |
| RUS: Bryansk-Oryol | name parts (2 pieces, worst match 100) | 2 |
| RUS: Chechnya-Ingushetia | alias hint -> RU-CE, RU-IN | 2 |
| RUS: Chuvashia-Mari El-Mordovia | name parts (3 pieces, worst match 95) | 3 |
| RUS: Karelia-Murmansk | name parts (2 pieces, worst match 100) | 2 |
| RUS: Khabarovsk-Jewish Autonomous Oblast | name parts (2 pieces, worst match 100) | 2 |
| RUS: Khakassia-Tuva | name parts (2 pieces, worst match 95) | 2 |
| RUS: Komi-Nenets | name parts (2 pieces, worst match 100) | 2 |
| RUS: Krasnodar-Adygea | name parts (2 pieces, worst match 100) | 2 |
| RUS: Kursk-Belgorod | name parts (2 pieces, worst match 100) | 2 |
| RUS: Lipetsk-Tambov | name parts (2 pieces, worst match 100) | 2 |
| RUS: Magadan-Chukotka | alias hint -> RU-MAG, RU-CHU | 2 |
| RUS: Moscow | alias hint -> RUS-2365 | 1 |
| RUS: Moscow Oblast | alias hint -> RUS-2364 | 1 |
| RUS: North Ossetia-Kabardino-Balkaria-Karachay-Cherkessia | name parts (3 pieces, worst match 97) | 3 |
| RUS: Novgorod-Pskov | name parts (2 pieces, worst match 100) | 2 |
| RUS: Sakha | alias hint -> RU-SA | 1 |
| RUS: Tula-Kaluga | name parts (2 pieces, worst match 100) | 2 |
| RUS: Tver-Smolensk | name parts (2 pieces, worst match 100) | 2 |
| RUS: Tyumen-Kurgan | name parts (2 pieces, worst match 100) | 2 |
| RUS: Udmurtia-Kirov | name parts (2 pieces, worst match 94) | 2 |
| RUS: Ulyanovsk-Penza | name parts (2 pieces, worst match 100) | 2 |
| RUS: Vladimir-Ryazan | name parts (2 pieces, worst match 100) | 2 |
| RUS: Yamalo-Nenets | name match 96; plus unclaimed RUS+99? | 2 |
| RUS: Yaroslavl-Ivanovo-Kostroma | name parts (3 pieces, worst match 100) | 3 |
| TJK: Districts of Republican Subordination | alias hint -> TJ-X01~ | 1 |
| TJK: Sughd | alias hint -> TJ-SU | 1 |
| TKM: Ahal | name match 100; less TKM:Ashgabat (carve) | 1 |
| TKM: Ashgabat | no admin-1 match (best unit 71, group 0); carve: builder polygon from TKM:Ahal | 0 |
| UZB: Jizzakh-Sirdaryo | name parts (2 pieces, worst match 100) | 2 |
| UZB: Tashkent | alias hint -> UZ-TK | 1 |
| UZB: Tashkent Region | alias hint -> UZ-TO | 1 |

## Land without a province

Natural Earth admin-1 units of this file's countries that no region claims and that touch no region of their country (overseas territories, remote islands). They stay water on the map.

None.

## Sea links

`sea` rows of province-adjacency.csv with a province of this file: coastal provinces whose shapes do not touch but face each other across a strait (D678).

JP-0018-RU-0067, JP-0019-RU-0068, RU-0022-RU-0076, RU-0022-RU-0078, RU-0025-UA-0016, RU-0026-UA-0020, RU-0067-RU-0172, RU-0067-RU-0175, RU-0067-RU-0176, RU-0068-RU-0069, RU-0076-RU-0083, RU-0083-RU-0089, RU-0206-US-0169

## Small provinces

None.

## Uneven Voronoi splits

Blocks (ADM2 units, or admin-1 units for Greenland) that several provinces share, where one province takes most of the block. Check that the larger part belongs where it went.

| Region | Block | Shares |
|---|---|---|
| KAZ:Mangystau | part-0 | KZ-0016 83%, KZ-0015 17% |
| KGZ:Osh | part-0 | KG-0008 84%, KG-0007 16% |
| RUS:Irkutsk | part-1 | RU-0063 85%, RU-0062 15% |
| RUS:Moscow | part-0 | RU-0002 77%, RU-0004 10%, RU-0003 9%, RU-0001 4% |
| RUS:Moscow Oblast | part-0 | RU-0006 83%, RU-0005 17% |
| RUS:Sverdlovsk | part-0 | RU-0047 86%, RU-0046 14% |

## Named places outside their province

None.

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| RU-0015 | St Petersburg Center-Vasilievsky | 2 | N | Y |
| TM-0006 | Etrek-Serdar | 0 | N | Y |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

RU-0059 (82), RU-0081 (41), RU-0072 (27), RU-0068 (23), RU-0083 (18), RU-0199 (13), RU-0109 (12), RU-0089 (11), RU-0090 (11), RU-0206 (11), RU-0019 (10), RU-0067 (10), RU-0172 (10), RU-0018 (9), RU-0080 (9), RU-0196 (9), RU-0111 (8), RU-0194 (8), TM-0004 (8), KZ-0015 (7), RU-0026 (7), RU-0211 (7), TM-0005 (7), AZ-0001 (6), RU-0190 (6), TJ-0006 (6), KZ-0016 (5), RU-0029 (5), RU-0078 (5), RU-0219 (5), RU-0222 (5), KZ-0005 (4), KZ-0013 (4), RU-0036 (4), RU-0042 (4), RU-0064 (4), RU-0070 (4), RU-0110 (4), RU-0195 (4), RU-0197 (4), RU-0220 (4), TM-0002 (4), UZ-0006 (4), AZ-0003 (3), KZ-0012 (3), RU-0003 (3), RU-0016 (3), RU-0039 (3), RU-0043 (3), RU-0052 (3), RU-0069 (3), RU-0075 (3), RU-0077 (3), RU-0082 (3), RU-0114 (3), RU-0142 (3), RU-0152 (3), RU-0187 (3), RU-0191 (3), RU-0203 (3), RU-0205 (3), RU-0241 (3), UZ-0017 (3), AM-0003 (2), AZ-0002 (2), AZ-0006 (2), GE-0006 (2), KG-0004 (2), KG-0006 (2), KZ-0004 (2), KZ-0014 (2), KZ-0017 (2), KZ-0020 (2), RU-0007 (2), RU-0008 (2), RU-0009 (2), RU-0021 (2), RU-0022 (2), RU-0025 (2), RU-0028 (2), RU-0031 (2), RU-0033 (2), RU-0034 (2), RU-0035 (2), RU-0037 (2), RU-0040 (2), RU-0041 (2), RU-0044 (2), RU-0045 (2), RU-0046 (2), RU-0049 (2), RU-0053 (2), RU-0054 (2), RU-0062 (2), RU-0065 (2), RU-0073 (2), RU-0079 (2), RU-0084 (2), RU-0088 (2), RU-0104 (2), RU-0106 (2), RU-0128 (2), RU-0155 (2), RU-0158 (2), RU-0162 (2), RU-0174 (2), RU-0179 (2), RU-0207 (2), RU-0209 (2), RU-0217 (2), RU-0236 (2), RU-0246 (2), RU-0247 (2), RU-0253 (2), RU-0255 (2), TJ-0003 (2), TJ-0005 (2), TM-0006 (2), TM-0012 (2), UZ-0002 (2), UZ-0004 (2), UZ-0005 (2), UZ-0008 (2), UZ-0014 (2), UZ-0015 (2)

## Visual check

`preview-russia-central-asia.png` in this folder is province-ids.png around the region (pixels x 4332..404, y 55..1993, scaled by 0.56).
