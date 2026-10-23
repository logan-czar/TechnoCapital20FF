# Map QA report: russia-central-asia

_Written by `tools/map-pipeline/run.py --region russia-central-asia` (pipeline pb-1). Source of the rows: `provinces-russia-central-asia.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 171 provinces of `provinces-russia-central-asia.csv` have a crosswalk row and pixels (11 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 171 |
| ... ARM | 6 |
| ... AZE | 10 |
| ... GEO | 7 |
| ... KAZ | 26 |
| ... KGZ | 9 |
| ... RUS | 74 |
| ... TJK | 9 |
| ... TKM | 13 |
| ... UZB | 17 |
| Regions matched | 128 of 128 |
| Provinces by method: admin1 | 97 |
| Provinces by method: admin2 | 8 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 66 |
| Flagged for review (confidence < 0.6) | 0 |
| Placed by a builder hint (`hints/russia-central-asia.toml`) | 21 |
| Tiny (under 64 px) | 11 |
| Given a pixel at their interior point (no pixel centre inside) | 0 |
| More than one part (islands, exclaves) | 83 |
| Coastal flag differs from the CSV | 3 |
| Small for their region (not Metro, under 5% of the region's mean) | 0 |
| Voronoi-split blocks where one province takes 75% or more | 5 |
| Places named in a province's name or notes that lie in another province | 1 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 4 |
| Admin-1 units left without a province | 0 |
| Sea links with a province of this file | 10 |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) | 0 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes) | Public domain | yes |
| geoBoundaries gbOpen AZE ADM2 (Wikipedia) | Creative Commons Attribution-ShareAlike 3.0 Unported | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 3.0 Unported); Voronoi path |
| geoBoundaries gbOpen GEO ADM2 (geoBoundaries, Wikimedia Commons) | Public Domain | yes |
| geoBoundaries gbOpen KAZ ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen KGZ ADM2 (geoBoundaries, Wikipedia, Districts of Kyrgyzstan) | Creative Commons Attribution-ShareAlike 3.0 Unported | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 3.0 Unported); Voronoi path |
| geoBoundaries gbOpen RUS ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen TJK ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen TKM ADM2 (CIESIN) | Creative Commons Attribution-ShareAlike 3.0 Unported | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 3.0 Unported); Voronoi path |
| geoBoundaries gbOpen UZB ADM2 (OCHA ROCCA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |

Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, public domain and the attribution-only government licences OGL-Canada 2.0 and OGL-UK 3.0; a region whose country has no allowed ADM2 is split by Voronoi.

## Low-confidence rows for review

None.

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| KG-0008 | Alay-Uzgen | seeds: point 73.25,39.73 (hint); point 73.3,40.77 (hint); point 73.44,40.32 (hint); point 73.9,39.68 (hint); 0 whole parts, 1 split |
| KZ-0007 | Saryagash-Maktaaral | seeds: point 68.4,40.85 (hint); point 69.17,41.45 (hint); 0 whole parts, 1 split |
| KZ-0011 | Aktobe | seeds: point 57.21,50.28 (hint); 0 whole parts, 1 split |
| KZ-0014 | Tengiz-Kashagan | seeds: point 52.6,46.2 (hint) (snapped to land); point 53.0,46.5 (hint); point 53.38,46.15 (hint); 0 whole parts, 1 split |
| KZ-0015 | Aktau | seeds: point 51.17,43.65 (hint); point 51.68,43.18 (hint); 3 whole parts, 1 split |
| KZ-0020 | Balkhash-Karkaraly | seeds: point 74.98,46.84 (hint); point 75.47,49.41 (hint); 1 whole parts, 1 split |
| RU-0002 | Moscow South-West | seeds: point 37.48,55.74 (hint); point 37.53,55.7 (hint); point 37.56,55.66 (hint); 0 whole parts, 1 split |
| RU-0003 | Moscow North | seeds: point 37.18,55.99 (hint); point 37.5,55.8 (hint); point 37.55,55.83 (hint); 2 whole parts, 1 split |
| RU-0004 | Moscow East-South-East | seeds: point 37.66,55.7 (hint); point 37.72,55.69 (hint); point 37.8,55.64 (hint); point 37.85,55.75 (hint); 0 whole parts, 1 split |
| RU-0015 | St Petersburg Center-Vasilievsky | seeds: point 30.26,59.94 (hint); point 30.31,59.94 (hint); 0 whole parts, 1 split |
| RU-0017 | St Petersburg North-Lakhta | seeds: point 29.97,60.1 (hint); point 30.18,59.99 (hint) (snapped to land); point 30.33,60.05 (hint); 1 whole parts, 1 split |
| RU-0068 | Kuril Islands | seeds: point 145.9,44.0 (hint) (snapped to land); point 146.7,43.8 (hint); point 147.9,45.2 (hint); point 150.0,46.2 (hint) (snapped to land); point 152.0,47.5 (hint) (snapped to land); point 154.0,48.8 (hint) (snapped to land); point 155.9,50.4 (hint); 21 whole parts |
| TJ-0002 | Hisor-Tursunzoda | seeds: point 68.23,38.51 (hint); point 68.67,38.52 (hint); 0 whole parts, 1 split |
| TJ-0003 | Rasht-Rogun | seeds: point 69.77,38.73 (hint); point 70.37,39.04 (hint); point 71.2,39.2 (hint); 0 whole parts, 1 split |
| TJ-0005 | Panjakent-Zeravshan | seeds: point 67.61,39.5 (hint); point 68.53,39.39 (hint); 0 whole parts, 1 split |
| TJ-0006 | Istaravshan-Isfara | seeds: point 69.01,39.91 (hint); point 70.23,40.45 (hint); point 70.63,40.12 (hint); 2 whole parts, 1 split |
| TM-0003 | Gokdepe-Karakum | seeds: point 57.43,38.43 (hint); point 57.95,38.15 (hint); point 58.9,40.25 (hint) (snapped to land); 0 whole parts, 1 split |
| TM-0007 | Dashoguz | seeds: point 59.97,41.84 (hint); 0 whole parts, 1 split |
| TM-0010 | Bagtyyarlyk-Koytendag | seeds: point 64.6,38.95 (hint) (snapped to land); point 65.21,37.83 (hint); point 66.4,37.8 (hint); 0 whole parts, 1 split |
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
| KZ-0002 | Almaty | 21 | 1 | 5846.5, 1558.5 |
| RU-0004 | Moscow East-South-East | 27 | 1 | 4954.5, 1191.5 |
| RU-0003 | Moscow North | 39 | 3 | 4948.5, 1186.5 |
| KZ-0001 | Nur-Sultan | 54 | 1 | 5721.5, 1331.5 |
| TM-0001 | Ashgabat | 54 | 1 | 5422.5, 1702.5 |

## Anchor cities

Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own name names lands on that province (and, for a Metro province, near its middle and in its largest 4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a province of that Metro, and each key city lands on one of its provinces (key-cities.csv).

All anchors land on their own provinces.

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
| GE-0007 | South Ossetia | 820 | N | 5081.5, 1605.5 |
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

EE-0004-RU-0018, JP-0018-RU-0067, JP-0019-RU-0068, KZ-0014-KZ-0015, RU-0025-UA-0016, RU-0025-UA-0021, RU-0026-UA-0020, RU-0065-RU-0067, RU-0068-RU-0069, RU-0070-US-0004

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
| RUS:Sverdlovsk | part-0 | RU-0047 86%, RU-0046 14% |

## Named places outside their province

A Natural Earth place matched in the name or notes that ended up in another province (usually a neighbour that names the same city more directly, as Long Beach-Harbor's notes name Los Angeles).

| Province | Name | Place | Lies in |
|---|---|---|---|
| UZ-0004 | Samarkand | Urgut | UZ-0005 |

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| RU-0016 | St Petersburg South-Port | 0 | N | Y |
| RU-0071 | Yakutsk-Aldan | 127 | Y | N |
| TM-0006 | Etrek-Serdar | 0 | N | Y |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

RU-0059 (81), RU-0022 (63), RU-0070 (50), RU-0072 (26), RU-0052 (23), RU-0068 (23), RU-0023 (21), RU-0021 (20), RU-0069 (19), RU-0019 (10), RU-0067 (10), KZ-0015 (9), RU-0018 (9), RU-0065 (9), TM-0004 (9), RU-0026 (7), TM-0005 (7), AZ-0001 (6), RU-0071 (6), TJ-0006 (6), KZ-0016 (5), RU-0029 (5), KZ-0005 (4), KZ-0013 (4), RU-0017 (4), RU-0036 (4), RU-0042 (4), RU-0063 (4), RU-0064 (4), TM-0002 (4), UZ-0006 (4), AZ-0003 (3), KG-0007 (3), KZ-0012 (3), RU-0003 (3), RU-0005 (3), RU-0006 (3), RU-0039 (3), RU-0043 (3), RU-0060 (3), RU-0073 (3), UZ-0017 (3), AM-0003 (2), AZ-0002 (2), AZ-0006 (2), GE-0006 (2), KG-0004 (2), KG-0006 (2), KZ-0004 (2), KZ-0014 (2), KZ-0017 (2), KZ-0018 (2), KZ-0020 (2), RU-0007 (2), RU-0008 (2), RU-0009 (2), RU-0025 (2), RU-0028 (2), RU-0031 (2), RU-0033 (2), RU-0034 (2), RU-0035 (2), RU-0037 (2), RU-0040 (2), RU-0041 (2), RU-0044 (2), RU-0045 (2), RU-0046 (2), RU-0049 (2), RU-0053 (2), RU-0054 (2), RU-0057 (2), RU-0062 (2), TJ-0003 (2), TJ-0005 (2), TM-0006 (2), TM-0012 (2), UZ-0002 (2), UZ-0004 (2), UZ-0005 (2), UZ-0008 (2), UZ-0014 (2), UZ-0015 (2)

## Visual check

`preview-russia-central-asia.png` in this folder is province-ids.png around the region (pixels x 4332..7777, y 365..1993, scaled by 0.70; outside the frame: RU-0069, RU-0070).
