# Map QA report: mena

_Written by `tools/map-pipeline/run.py --region mena` (pipeline pb-2). Source of the rows: `provinces-mena.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 389 provinces of `provinces-mena.csv` have a crosswalk row and pixels (72 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 389 |
| ... ARE | 15 |
| ... BHR | 1 |
| ... DZA | 58 |
| ... EGY | 43 |
| ... IRN | 37 |
| ... IRQ | 24 |
| ... ISR | 17 |
| ... JOR | 10 |
| ... KWT | 10 |
| ... LBN | 8 |
| ... LBY | 33 |
| ... MAR | 20 |
| ... OMN | 13 |
| ... PSE | 6 |
| ... QAT | 10 |
| ... SAU | 43 |
| ... SYR | 14 |
| ... TUN | 11 |
| ... YEM | 16 |
| Regions matched | 241 of 241 |
| Provinces by method: admin1 | 198 |
| Provinces by method: admin2 | 46 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 145 |
| Flagged for review (confidence < 0.6) | 0 |
| Placed by a builder hint (`hints/mena.toml`) | 80 |
| Tiny (under 64 px) | 72 |
| Given a pixel at their interior point (no pixel centre inside) | 1 |
| More than one part (islands, exclaves) | 74 |
| Coastal flag differs from the CSV | 32 |
| Small for their region (not Metro, under 5% of the region's mean) | 4 |
| Voronoi-split blocks where one province takes 75% or more | 10 |
| Places named in a province's name or notes that lie in another province | 0 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 10 |
| Admin-1 units left without a province | 0 |
| Sea links with a province of this file | 20 |
| City probe points (fail on a mismatch; D686) | 72 pass, 0 mismatch, 8 listed |
| Metro reach scan rows (listed; D686) | 1 |
| Land exclaves of 5 px or more (fail unless explained; D691) | 4 (0 unexplained) |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) | 1 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Split giants

Provinces over 250,000 km2 that are not Arctic, cut into parts of at most 51,722 km2 (Eastern Iowa, US-0053) by `run.py giants` and `[subdivide]` in the hints (D820). Areas are geodesic, of the final shapes; the step fails on a part over the cap.

| Province | Name | Parts | Pieces | Area (km2) | Smallest part | Largest part | Parts in several pieces |
|---|---|---|---|---|---|---|---|
| DZ-0027 | Tamanrasset-In Salah | 13 | towns | 609,275 | 45,043 | 49,470 | 0 |
| DZ-0028 | Adrar-Timimoun | 10 | towns | 475,435 | 45,801 | 48,427 | 0 |
| DZ-0029 | Bechar-Tindouf | 9 | towns | 416,754 | 45,259 | 48,489 | 1 |
| EG-0031 | Kharga-New Valley | 10 | admin2 | 452,986 | 44,331 | 46,401 | 1 |
| LY-0015 | Kufra | 9 | parts | 422,897 | 46,870 | 47,162 | 0 |
| LY-0018 | Murzuq-Sharara | 7 | towns | 315,722 | 43,173 | 48,118 | 0 |
| SA-0020 | Shaybah-Rub al Khali | 7 | parts | 301,909 | 42,876 | 43,250 | 1 |

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes) | Public domain | yes |
| geoBoundaries gbOpen DZA ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen EGY ADM2 (OCHA ROMENA/HDX, Central Agency for Public Mobilization and Statistics (CAPMAS)) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen IRN ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen IRQ ADM2 (Iraq Central Statistics Office, OCHA Iraq) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen ISR ADM2 (geoBoundaries, Wikimedia Commons) | CC0 1.0 Universal (CC0 1.0) Public Domain Dedication | yes |
| geoBoundaries gbOpen JOR ADM2 (geoBoundaries, Wikimedia Commons) | Public Domain | yes |
| geoBoundaries gbOpen KWT ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen MAR ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen OMN ADM2 (Oman National Geographic Structure) | Other - Direct Permission | no: refused: not in the allowlist (Other - Direct Permission); Voronoi path |
| geoBoundaries gbOpen PSE ADM2 (Open Data Watch) | Creative Commons Attribution 4.0 (CC BY 4.0) | yes |
| geoBoundaries gbOpen QAT ADM2 (geoBoundaries, Qatar Open Data Portal) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen SAU ADM2 (geoBoundaries, OpenStreetMap) | Creative Commons Attribution-ShareAlike 2.0 | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 2.0); Voronoi path |
| geoBoundaries gbOpen YEM ADM2 (Central Statistical Organization (CSO), OCHA Yemen) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |

Refused as not on the allowlist (for Logan: attribution-only government licences are refused until allowed, D601): Other - Direct Permission.

Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, public domain and the attribution-only government licences OGL-Canada 2.0, OGL-UK 3.0, Data licence Germany Attribution 2.0, Etalab 2.0, Spain's INE licence, Singapore ODL 1.0 and Korea OGL Type 1 (D685); a region whose country has no allowed ADM2 is split by Voronoi.

Provenance to check (for Logan; these files pass the allowlist and are used):

- ISR ADM2: public domain or CC0, but geoBoundaries names Wikimedia as the source (Wikimedia maps are often CC BY-SA)
- JOR ADM2: public domain or CC0, but geoBoundaries names Wikimedia as the source (Wikimedia maps are often CC BY-SA)

## Low-confidence rows for review

None.

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| AE-0001 | Abu Dhabi Downtown | seeds: point 54.37,24.47 (hint); 4 whole parts |
| AE-0002 | Masdar-Yas-Saadiyat | seeds: point 54.43,24.54 (hint) (snapped to land); point 54.6,24.49 (hint); point 54.62,24.43 (hint); 0 whole parts, 1 split |
| AE-0003 | Mussafah-Khalifa Port | seeds: point 54.49,24.35 (hint); point 54.65,24.81 (hint) (snapped to land); point 54.7,24.7 (hint); 1 whole parts, 1 split |
| AE-0004 | Al Ain | seeds: point 55.76,24.21 (hint); point 55.77,24.06 (hint); 0 whole parts, 1 split |
| AE-0005 | Ruwais-Al Dhafra | seeds: point 51.8,24.1 (hint) (snapped to land); point 52.27,23.97 (hint); point 52.73,24.11 (hint); point 53.7,24.15 (hint) (snapped to land); 6 whole parts, 1 split |
| AE-0006 | Liwa-Habshan | seeds: point 53.1,23.4 (hint); point 53.62,23.83 (hint); point 53.73,23.13 (hint); point 54.0,23.3 (hint); 0 whole parts, 1 split |
| AE-0007 | Das-Zirku Islands | seeds: point 53.07,24.88 (hint); 1 whole parts |
| AE-0008 | Dubai Core | seeds: point 55.27,25.2 (hint); point 55.31,25.26 (hint) (snapped to land); 1 whole parts, 1 split |
| AE-0010 | Dubai Marina-Jebel Ali | seeds: point 55.03,24.99 (hint) (snapped to land); point 55.14,25.08 (hint) (snapped to land); point 55.21,25.17 (hint) (snapped to land); 0 whole parts, 1 split |
| AE-0013 | Hamriyah-Al Dhaid | seeds: point 55.53,25.47 (hint); point 55.88,25.29 (hint) (snapped to land); 0 whole admin1 units, split: Sharjah |
| AE-0014 | Khor Fakkan-Kalba | seeds: point 56.34,25.34 (hint); point 56.35,25.07 (hint); 0 whole admin1 units, split: Sharjah |
| DZ-0001 | Algiers Centre-Hydra | seeds: point 3.03,36.74 (hint); point 3.06,36.75 (hint); 0 whole parts, 1 split |
| DZ-0002 | Algiers East-Rouiba | seeds: point 3.18,36.72 (hint); point 3.2,36.71 (hint); point 3.21,36.69 (hint); 0 whole parts, 1 split |
| DZ-0003 | Algiers West-Cheraga | seeds: point 2.99,36.77 (hint); point 3.04,36.79 (hint); 0 whole parts, 1 split |
| DZ-0016 | Arzew-Bethioua | seeds: point -0.26,35.81 (hint); point -0.32,35.85 (hint); 0 whole parts, 1 split |
| EG-0005 | 6th of October-Sheikh Zayed | seeds: point 30.93,29.97 (hint); point 30.98,30.05 (hint); 3 whole admin2 units |
| EG-0007 | Shubra el-Kheima | seeds: point 31.255,30.13 (hint); 2 whole admin2 units |
| EG-0009 | Alexandria Centre-East | seeds: point 29.95,31.22 (hint); point 30.02,31.27 (hint); 11 whole admin2 units |
| EG-0010 | Alexandria West-Borg el-Arab | seeds: point 29.6,30.92 (hint) (snapped to land); point 29.75,31.05 (hint); point 29.82,31.13 (hint); 6 whole admin2 units |
| IL-0002 | East Jerusalem | seeds: point 35.235,31.78 (hint); point 35.24,31.8 (hint); 0 whole admin2 units, split: Jerusalem |
| IL-0003 | Beit Shemesh-Judean Hills | seeds: point 34.99,31.75 (hint); point 35.13,31.8 (hint); 0 whole admin2 units, split: Jerusalem |
| IL-0005 | Ramat Gan-Herzliya | seeds: point 34.82,32.08 (hint); point 34.84,32.09 (hint); point 34.84,32.16 (hint); 0 whole admin2 units, split: Tel Aviv |
| IL-0006 | Holon-Bat Yam | seeds: point 34.75,32.02 (hint); point 34.78,32.02 (hint); 0 whole admin2 units, split: Tel Aviv |
| IL-0007 | Petah Tikva-Rosh HaAyin | seeds: point 34.89,32.09 (hint); point 34.95,32.1 (hint); 1 whole admin2 units |
| IL-0014 | Galilee-Tiberias | seeds: point 35.3,32.92 (hint); point 35.5,32.96 (hint); point 35.53,32.79 (hint); 3 whole admin2 units |
| IL-0016 | Ashdod-Ashkelon | seeds: point 34.57,31.67 (hint); point 34.6,31.52 (hint); point 34.65,31.8 (hint); 1 whole admin2 units |
| IQ-0001 | Karkh-Green Zone | seeds: point 44.33,33.3 (hint); point 44.37,33.31 (hint); 0 whole admin2 units, split: Al-Karkh |
| IQ-0002 | Rusafa-Old Baghdad | seeds: point 44.4,33.32 (hint); point 44.42,33.34 (hint); 0 whole admin2 units, split: Al-Karkh, Al-Thawra |
| IQ-0003 | Sadr City-New Baghdad | seeds: point 44.45,33.38 (hint); point 44.5,33.3 (hint); 1 whole admin2 units, split: Al-Thawra |
| IQ-0004 | Baghdad Belt | seeds: point 44.07,33.29 (hint); point 44.24,33.52 (hint); point 44.35,33.06 (hint); point 44.4,33.67 (hint); point 44.58,33.1 (hint); 4 whole admin2 units |
| IQ-0006 | Rumaila-Majnoon | seeds: point 47.27,30.87 (hint); point 47.4,30.45 (hint); point 47.6,31.02 (hint); point 47.7,30.39 (hint); 3 whole admin2 units, split: Al-Zubair |
| IR-0001 | North Tehran-Shemiran | seeds: point 51.41,35.77 (hint); point 51.45,35.8 (hint); 0 whole parts, 1 split |
| IR-0002 | Central Tehran-Grand Bazaar | seeds: point 51.41,35.62 (hint); point 51.42,35.68 (hint); 0 whole parts, 1 split |
| IR-0003 | West Tehran-Eslamshahr | seeds: point 50.98,35.46 (hint); point 51.02,35.65 (hint); point 51.23,35.55 (hint); point 51.33,35.7 (hint); 0 whole parts, 1 split |
| IR-0018 | Bandar Lengeh-Islands | seeds: point 53.98,26.53 (hint); point 54.88,26.56 (hint); point 55.03,25.87 (hint); 6 whole parts, 1 split |
| JO-0001 | Amman West-Abdali | seeds: point 35.85,31.95 (hint); point 35.9,31.96 (hint); 4 whole admin2 units |
| KW-0002 | Shuwaikh-Sulaibikhat | seeds: point 47.84,29.33 (hint) (snapped to land); point 47.93,29.35 (hint); 0 whole parts, 1 split |
| KW-0007 | Burgan | seeds: point 47.95,28.95 (hint); 0 whole parts, 1 split |
| KW-0008 | Wafra-Khiran | seeds: point 47.93,28.62 (hint); point 48.38,28.65 (hint) (snapped to land); 0 whole parts, 1 split |
| KW-0009 | Jahra | seeds: point 47.66,29.34 (hint); point 47.7,29.45 (hint); 0 whole parts, 1 split |
| KW-0010 | Raudhatain-Bubiyan | seeds: point 47.7,29.83 (hint); point 47.7,30.07 (hint); point 48.2,29.8 (hint); 2 whole parts, 1 split |
| LY-0001 | Tripoli Centre-Port | seeds: point 13.18,32.89 (hint); 0 whole parts, 1 split |
| LY-0002 | Tajura-Janzour | seeds: point 13.12,32.8 (hint); point 13.27,32.66 (hint); point 13.37,32.88 (hint); 0 whole parts, 1 split |
| LY-0008 | Sirte | seeds: point 16.59,31.21 (hint); 0 whole parts, 1 split |
| LY-0009 | Ras Lanuf-Es Sider | seeds: point 18.35,30.63 (hint); point 18.57,30.5 (hint) (snapped to land); 0 whole parts, 1 split |
| LY-0011 | Jalu-Sarir | seeds: point 20.4,28.6 (hint); point 21.55,29.03 (hint); point 23.5,27.5 (hint); 0 whole parts, 1 split |
| MA-0002 | Casablanca East-Mohammedia | seeds: point -7.39,33.69 (hint); point -7.55,33.6 (hint); 0 whole admin1 units, split: Grand Casablanca |
| MA-0003 | El Jadida-Jorf Lasfar | seeds: point -8.5,33.25 (hint); point -8.63,33.12 (hint); 1 whole admin1 units |
| MA-0009 | Al Hoceima-Rif | seeds: point -3.93,35.25 (hint); point -5.27,35.17 (hint); point -5.6,34.84 (hint); 0 whole parts, 1 split |
| OM-0003 | Sohar | seeds: point 56.71,24.35 (hint); 0 whole parts, 1 split |
| OM-0004 | Saham-Shinas | seeds: point 56.47,24.74 (hint); point 56.56,24.53 (hint); point 56.89,24.17 (hint); point 57.08,23.98 (hint); 0 whole parts, 1 split |
| QA-0001 | West Bay-Corniche | seeds: point 51.52,25.3 (hint) (snapped to land); point 51.53,25.32 (hint) (snapped to land); 18 whole admin2 units |
| QA-0002 | Msheireb-Old Doha | seeds: point 51.53,25.285 (hint); 16 whole admin2 units |
| QA-0003 | Doha Airport-Al Thumama | seeds: point 51.55,25.23 (hint); point 51.61,25.27 (hint); 10 whole admin2 units |
| QA-0004 | Al Rayyan-Education City | seeds: point 51.42,25.29 (hint); point 51.44,25.31 (hint); 11 whole admin2 units |
| QA-0005 | Industrial Area-Al Udeid | seeds: point 51.32,25.12 (hint); point 51.43,25.2 (hint); 13 whole admin2 units |
| QA-0006 | Al Wakrah-Hamad Port | seeds: point 51.6,25.17 (hint); point 51.62,25.01 (hint); 5 whole admin2 units, split: 92 |
| QA-0007 | Mesaieed | seeds: point 51.45,24.8 (hint); point 51.55,24.99 (hint); 2 whole admin2 units, split: 92 |
| SA-0001 | Riyadh Central-Olaya | seeds: point 46.64,24.76 (hint); point 46.68,24.7 (hint); 0 whole parts, 1 split |
| SA-0002 | Riyadh North-Diriyah | seeds: point 46.57,24.73 (hint); point 46.62,24.69 (hint); point 46.7,24.96 (hint); 0 whole parts, 1 split |
| SA-0003 | Riyadh South-Industrial Cities | seeds: point 46.75,24.6 (hint); point 46.83,24.5 (hint); point 46.88,24.45 (hint); 0 whole parts, 1 split |
| SA-0005 | Sudair-Majmaah | seeds: point 44.82,26.29 (hint); point 45.25,25.24 (hint); point 45.32,25.91 (hint); point 45.6,25.66 (hint); 0 whole parts, 1 split |
| SA-0007 | Wadi ad-Dawasir-Aflaj | seeds: point 45.0,20.47 (hint); point 45.58,20.46 (hint); point 46.27,22.29 (hint); 0 whole parts, 1 split |
| SA-0009 | Jeddah North-Obhur | seeds: point 39.1,21.75 (hint) (snapped to land); point 39.16,21.68 (hint); 0 whole parts, 1 split |
| SA-0010 | Rabigh-KAEC | seeds: point 39.03,22.8 (hint); point 39.09,22.45 (hint); 0 whole parts, 1 split |
| SA-0011 | Mecca | seeds: point 39.83,21.42 (hint); 0 whole parts, 1 split |
| SA-0012 | Taif | seeds: point 40.42,21.27 (hint); point 41.0,21.92 (hint); point 41.63,21.21 (hint); 0 whole parts, 1 split |
| SA-0015 | Jubail | seeds: point 49.22,27.55 (hint); point 49.66,27.01 (hint) (snapped to land); 1 whole parts, 1 split |
| SA-0016 | Ras Tanura-Qatif | seeds: point 50.01,26.56 (hint) (snapped to land); point 50.16,26.64 (hint) (snapped to land); 0 whole parts, 1 split |
| SA-0018 | Abqaiq-Ghawar | seeds: point 49.2,24.2 (hint); point 49.3,25.0 (hint); point 49.67,25.94 (hint); 0 whole parts, 1 split |
| SA-0020 | Shaybah-Rub al Khali | seeds: point 51.5,20.5 (hint); point 54.0,22.51 (hint); 0 whole parts, 1 split; cut into 7 provinces on parts pieces (D820) |
| SA-0022 | Yanbu | seeds: point 38.06,24.09 (hint); point 38.24,23.96 (hint); 0 whole parts, 1 split |
| SA-0023 | Al Ula-Khaybar | seeds: point 37.92,26.62 (hint); point 39.29,25.69 (hint); point 40.88,23.5 (hint); 0 whole parts, 1 split |
| SA-0025 | Bisha | seeds: point 42.61,20.0 (hint); point 43.62,19.53 (hint); 0 whole parts, 1 split |
| SA-0026 | Muhayil-Tihama | seeds: point 41.79,18.33 (hint); point 42.05,18.54 (hint); point 42.27,18.22 (hint); 0 whole parts, 1 split |
| SA-0027 | Buraidah | seeds: point 43.98,26.33 (hint); 0 whole parts, 1 split |
| SA-0028 | Unaizah-Ar Rass | seeds: point 43.5,25.87 (hint); point 43.73,25.96 (hint); point 43.99,26.08 (hint); 0 whole parts, 1 split |
| SA-0029 | Jazan Port-Economic City | seeds: point 42.12,16.73 (hint); point 42.56,16.89 (hint); 2 whole parts, 1 split |
| SA-0030 | Sabya-Abu Arish | seeds: point 42.62,17.15 (hint); point 42.83,16.97 (hint); point 42.95,16.6 (hint); 0 whole parts, 1 split |
| SA-0032 | NEOM-Duba | seeds: point 34.95,28.88 (hint); point 35.2,28.0 (hint); point 35.7,27.35 (hint); 7 whole parts, 1 split |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| AE-0007 | Das-Zirku Islands | 1 | 1 | 5303.5, 2031.5 |
| AE-0018 | Fujairah | 1 | 1 | 5376.5, 2030.5 |
| EG-0007 | Shubra el-Kheima | 1 | 1 | 4807.5, 1902.5 |
| EG-0027 | Luxor | 1 | 1 | 4838.5, 2011.5 |
| KW-0002 | Shuwaikh-Sulaibikhat | 1 | 1 | 5186.5, 1922.5 |
| QA-0002 | Msheireb-Old Doha | 1 | 1 | 5268.5, 2022.5 |
| IL-0004 | Tel Aviv-Yafo | 2 | 1 | 4887.5, 1853.5 |
| LB-0001 | Beirut | 2 | 1 | 4903.5, 1807.5 |
| QA-0001 | West Bay-Corniche | 2 | 1 | 5267.5, 2020.5 |
| QA-0003 | Doha Airport-Al Thumama | 2 | 2 | 5269.5, 2022.5 |
| DZ-0001 | Algiers Centre-Hydra | 3 | 1 | 4165.5, 1734.5 |
| DZ-0003 | Algiers West-Cheraga | 3 | 1 | 4164.5, 1732.5 |
| EG-0001 | Downtown Cairo-Zamalek | 3 | 1 | 4807.5, 1903.5 |
| IL-0001 | West Jerusalem | 3 | 1 | 4896.5, 1861.5 |
| IL-0002 | East Jerusalem | 3 | 1 | 4897.5, 1859.5 |
| IL-0006 | Holon-Bat Yam | 3 | 1 | 4886.5, 1855.5 |
| KW-0001 | Kuwait City-Sharq | 3 | 3 | 5195.5, 1919.5 |
| KW-0005 | Mubarak Al-Kabeer | 3 | 1 | 5189.5, 1924.5 |
| DZ-0002 | Algiers East-Rouiba | 4 | 2 | 4167.5, 1734.5 |
| EG-0005 | 6th of October-Sheikh Zayed | 5 | 4 | 4799.5, 1907.5 |
| IL-0005 | Ramat Gan-Herzliya | 5 | 2 | 4888.5, 1851.5 |
| IQ-0002 | Rusafa-Old Baghdad | 5 | 4 | 5107.5, 1823.5 |
| KW-0003 | Hawalli-Salmiya | 5 | 1 | 5188.5, 1922.5 |
| LY-0001 | Tripoli Centre-Port | 7 | 1 | 4395.5, 1833.5 |
| SY-0001 | Damascus | 7 | 1 | 4922.5, 1816.5 |
| AE-0001 | Abu Dhabi Downtown | 8 | 5 | 5327.5, 2045.5 |
| PS-0005 | Gaza City | 8 | 3 | 4880.5, 1867.5 |
| IQ-0001 | Karkh-Green Zone | 10 | 1 | 5104.5, 1823.5 |
| EG-0009 | Alexandria Centre-East | 11 | 1 | 4778.5, 1875.5 |
| KW-0004 | Farwaniya-Airport | 11 | 1 | 5186.5, 1924.5 |
| PS-0006 | Khan Yunis-Rafah | 12 | 1 | 4876.5, 1872.5 |
| QA-0004 | Al Rayyan-Education City | 12 | 1 | 5264.5, 2021.5 |
| IQ-0003 | Sadr City-New Baghdad | 13 | 1 | 5108.5, 1821.5 |
| IL-0007 | Petah Tikva-Rosh HaAyin | 14 | 1 | 4890.5, 1852.5 |
| QA-0006 | Al Wakrah-Hamad Port | 14 | 1 | 5269.5, 2024.5 |
| AE-0014 | Khor Fakkan-Kalba | 16 | 5 | 5377.5, 2027.5 |
| IL-0011 | Haifa Bay | 16 | 1 | 4894.5, 1836.5 |
| MA-0001 | Casablanca Centre-Anfa | 16 | 1 | 3920.5, 1817.5 |
| TN-0001 | Tunis | 16 | 2 | 4326.5, 1733.5 |
| EG-0003 | Helwan-Maadi | 17 | 1 | 4808.5, 1907.5 |
| OM-0002 | Seeb-Bawshar | 17 | 1 | 5419.5, 2062.5 |
| IL-0008 | Rishon LeZion-Rehovot | 18 | 1 | 4887.5, 1859.5 |
| IL-0010 | Lod-Ramla-Modiin | 18 | 2 | 4890.5, 1857.5 |
| IL-0009 | Netanya-Sharon | 19 | 1 | 4890.5, 1847.5 |
| YE-0001 | Sanaa | 19 | 1 | 5103.5, 2253.5 |
| EG-0018 | Port Said | 21 | 1 | 4832.5, 1876.5 |
| AE-0012 | Sharjah-Ajman | 23 | 1 | 5358.5, 2020.5 |
| QA-0009 | Lusail-Umm Salal | 25 | 1 | 5264.5, 2017.5 |
| YE-0009 | Aden | 25 | 4 | 5115.5, 2316.5 |
| IL-0003 | Beit Shemesh-Judean Hills | 27 | 1 | 4892.5, 1862.5 |
| JO-0001 | Amman West-Abdali | 28 | 1 | 4911.5, 1858.5 |
| SA-0001 | Riyadh Central-Olaya | 29 | 1 | 5158.5, 2034.5 |
| MA-0002 | Casablanca East-Mohammedia | 31 | 1 | 3925.5, 1816.5 |
| SY-0014 | Quneitra | 31 | 2 | 4912.5, 1825.5 |
| DZ-0016 | Arzew-Bethioua | 32 | 1 | 4087.5, 1758.5 |
| BH-0001 | Bahrain | 33 | 3 | 5245.5, 2000.5 |
| EG-0016 | Damietta | 33 | 3 | 4817.5, 1871.5 |
| IL-0012 | Hadera-Caesarea | 33 | 2 | 4892.5, 1843.5 |
| EG-0004 | Giza-Imbaba | 35 | 2 | 4804.5, 1903.5 |
| KW-0006 | Ahmadi-Fahaheel | 35 | 1 | 5188.5, 1928.5 |
| LB-0004 | Akkar | 36 | 1 | 4916.5, 1790.5 |
| AE-0016 | Umm al-Quwain | 39 | 1 | 5363.5, 2016.5 |
| JO-0005 | Jerash-Ajloun | 44 | 1 | 4909.5, 1849.5 |
| PS-0002 | Nablus-Salfit | 44 | 1 | 4899.5, 1851.5 |
| SA-0029 | Jazan Port-Economic City | 45 | 3 | 5065.5, 2220.5 |
| LB-0007 | Sidon-Tyre | 53 | 1 | 4898.5, 1824.5 |
| EG-0008 | Banha-Qalyubia | 55 | 1 | 4806.5, 1898.5 |
| IR-0002 | Central Tehran-Grand Bazaar | 57 | 1 | 5267.5, 1764.5 |
| LB-0008 | Nabatieh | 58 | 1 | 4902.5, 1821.5 |
| IL-0015 | Golan Heights | 62 | 2 | 4909.5, 1830.5 |
| OM-0003 | Sohar | 62 | 1 | 5384.5, 2046.5 |
| QA-0007 | Mesaieed | 63 | 1 | 5265.5, 2031.5 |

## Anchor cities

Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own name names lands on that province (and, for a Metro province, near its middle and in its largest 4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a province of that Metro, and each key city lands on one of its provinces (key-cities.csv).

| Check | Province | Place | Expected | Got |
|---|---|---|---|---|
| city on the edge | SA-0001 | Riyadh | SA-0001 | SA-0003 |

No misses; the rows above are allowed: a city part across a narrow strait, or a city whose own pixel a neighbour took while its province holds a touching pixel.

## Natural Earth labels

Natural Earth units whose capital another region of the country names (in a province name or notes) while their own region does not: the sign of NE giving units each other's names, as in Eritrea and Guyana (D687). Each row fails the step unless `[review] ne_label_ok` in the hints names the region.

None.

## City probe

Points of `tools/map-pipeline/checks/city-points.txt` whose expected province is in this file, looked up in province-index.png: a point passes on its pixel or one of the 8 around it (D686). The step fails on a mismatch.

| Point | Expected | Got | Result |
|---|---|---|---|
| Bouarfa (-1.95, 32.53) | ? | MA-0010 | listed |
| Errachidia (-4.43, 31.93) | ? | MA-0017 | listed |
| Fallujah (43.78, 33.35) | ? | IQ-0013 | listed |
| Kuwait Ahmadi (48.08, 29.08) | ? | KW-0006 | listed |
| MA enclave Agadir (-5.73, 29.65) | ? | MA-0017 | listed |
| MA enclave Meknes (-3.33, 32.07) | ? | MA-0010 | listed |
| Tifariti (-10.6, 26.16) | ? | MA-0019 | listed |
| Zagora (-5.84, 30.33) | ? | MA-0017 | listed |
| 6th of October (30.93, 29.94) | EG-0005 | EG-0005 | on it |
| Abadla (split part) (-2.7333, 31.0171) | DZ-0053 | DZ-0053 | on it |
| Abu Dhabi (54.37, 24.47) | AE-0001 | AE-0001 | on it |
| Abu Ghraib (44.07, 33.29) | IQ-0004 | IQ-0004 | on it |
| Abu Musa (55.03, 25.87) | IR-0018 | IR-0018 | on it |
| Adrar (main city of a split giant) (-0.29, 27.87) | DZ-0028 | DZ-0028 | on it |
| Al Jawf (main city of a split giant) (23.29, 24.2) | LY-0015 | LY-0015 | on it |
| Algiers (3.06, 36.75) | DZ | DZ-0001 | on it |
| Arak (split part) (3.75, 25.28) | DZ-0033 | DZ-0033 | on it |
| Baghdad (44.37, 33.31) | IQ | IQ-0001 | on it |
| Baghdad Green Zone (44.38, 33.31) | IQ-0001 | IQ-0001 | on it |
| Bahrain Manama (50.58, 26.22) | BH | BH-0001 | on it |
| Bechar (main city of a split giant) (-2.23, 31.6111) | DZ-0029 | DZ-0029 | on it |
| Bethlehem (35.2, 31.705) | PS-0004 | PS-0004 | on it |
| Boujdour (-14.49, 26.13) | MA-0019 | MA-0019 | on it |
| Cairo Airport (31.41, 30.12) | EG-0002 | EG-0002 | on it |
| Cairo Tahrir (31.236, 30.044) | EG-0001 | EG-0004 | within a pixel |
| Casablanca (-7.62, 33.59) | MA | MA-0001 | on it |
| Dakhla (-15.93, 23.7) | MA-0020 | MA-0020 | nearest across water |
| Diriyah (46.57, 24.73) | SA-0002 | SA-0002 | on it |
| Doha West Bay (51.53, 25.32) | QA-0001 | QA-0001 | nearest across water |
| Dubai Downtown (55.27, 25.2) | AE-0008 | AE-0008 | on it |
| Dubai Marina (55.14, 25.08) | AE-0010 | AE-0010 | nearest across water |
| East Jerusalem Old City (35.235, 31.777) | IL-0002 | IL-0002 | on it |
| El Bayadh (split part) (1.01, 33.6904) | DZ-0051 | DZ-0051 | on it |
| El Kharga (main city of a split giant) (30.55, 25.44) | EG-0031 | EG-0031 | on it |
| El Qasr (split part) (28.8833, 25.7004) | EG-0037 | EG-0037 | on it |
| Es-Semara inland (-11.0, 26.5) | MA-0019 | MA-0019 | on it |
| Eslamshahr (51.23, 35.55) | IR-0003 | IR-0003 | on it |
| Gaza (34.45, 31.5) | PS | PS-0005 | on it |
| Giza pyramids (31.13, 29.98) | EG-0004 | EG-0004 | on it |
| Halaib (36.6, 22.22) | EG-0030 | EG-0030 | on it |
| Hebron (35.1, 31.53) | PS-0004 | PS-0004 | on it |
| Heliopolis (31.32, 30.09) | EG-0002 | EG-0001 | within a pixel |
| Helwan (31.33, 29.85) | EG-0003 | EG-0003 | on it |
| In Salah (site of a split giant) (2.46, 27.2) | DZ-0031 | DZ-0031 | on it |
| Jenin (35.3, 32.46) | PS-0001 | PS-0001 | on it |
| Jericho (35.45, 31.86) | PS-0003 | PS-0003 | on it |
| Katzrin Golan (35.69, 32.99) | IL-0015 | IL-0015 | on it |
| Kuwait City (47.98, 29.37) | KW | KW-0001 | nearest across water |
| Laayoune (-13.2, 27.15) | MA-0019 | MA-0019 | on it |
| Maadi (31.26, 29.96) | EG-0003 | EG-0003 | on it |
| Madain (44.58, 33.1) | IQ-0004 | IQ-0004 | on it |
| Mahbes (-9.05, 27.22) | MA-0019 | MA-0019 | on it |
| Mahmudiya (44.36, 33.06) | IQ-0004 | IQ-0004 | on it |
| Marzuq (main city of a split giant) (13.8972, 25.9044) | LY-0018 | LY-0018 | on it |
| Nablus (35.26, 32.22) | PS-0002 | PS-0002 | on it |
| New Cairo (31.47, 30.03) | EG-0002 | EG-0002 | on it |
| Qasr Farafra (split part) (27.9666, 27.0671) | EG-0036 | EG-0036 | on it |
| Qatar Doha (51.53, 25.29) | QA | QA-0001 | nearest across water |
| Rafah (34.25, 31.29) | PS | PS-0006 | on it |
| Ramallah (35.2, 31.9) | PS-0003 | PS-0003 | on it |
| Rashid Street Baghdad (44.42, 33.34) | IQ-0002 | IQ-0003 | within a pixel |
| Riyadh 2nd Industrial City (46.86, 24.55) | SA-0003 | SA-0003 | on it |
| Riyadh Olaya (46.68, 24.7) | SA-0001 | SA-0001 | on it |
| Riyadh Olaya2 (46.67, 24.69) | SA-0001 | SA-0001 | on it |
| Sadr City (44.45, 33.39) | IQ-0003 | IQ-0003 | on it |
| Sharara (site of a split giant) (12.23, 26.58) | LY-0028 | LY-0028 | on it |
| Sharjah (55.4, 25.35) | AE-0012 | AE-0012 | on it |
| Shaybah (site of a split giant) (53.98, 22.51) | SA-0020 | SA-0020 | on it |
| Shubra el-Kheima (31.24, 30.13) | EG-0007 | EG-0008 | within a pixel |
| Smara (-11.66, 26.74) | MA-0019 | MA-0019 | on it |
| Taji (44.24, 33.52) | IQ-0004 | IQ-0004 | on it |
| Tamanrasset (main city of a split giant) (5.5228, 22.785) | DZ-0027 | DZ-0027 | on it |
| Tan-Tan (-11.1, 28.44) | MA-0018 | MA-0018 | on it |
| Tata MA (-7.97, 29.74) | MA-0016 | MA-0016 | on it |
| Tehran Bazaar (51.42, 35.67) | IR-0002 | IR-0002 | on it |
| Tehran North (51.43, 35.8) | IR-0001 | IR-0001 | on it |
| Timimoun (split part) (0.27, 29.2365) | DZ-0042 | DZ-0042 | on it |
| Tindouf (split part) (-8.1478, 27.6742) | DZ-0056 | DZ-0056 | on it |
| Tmassah (split part) (15.8, 26.3666) | LY-0029 | LY-0029 | on it |
| point 54.0,22.51 (hint) (main city of a split giant) (54.0, 22.51) | SA-0020 | SA-0020 | on it |

## Metro reach

Metro provinces whose centroid is over 80 km from their Metro's city, that are over 4 times the Metro's median and 250 px, and regions where Metro provinces hold over 30% of the land beside rural ones (the D612 error). Listed for review; a Metro made of whole metropolitan units can be large by design.

| Check | Province or region | Detail |
|---|---|---|
| Metro share of a region | IRN: Tehran | Metro provinces hold 44% of 842 px beside 1 rural |

## Land exclaves

Parts of 5 px or more that are not a province's largest part and touch no pixel outside every province (islands are not listed). Each is explained by a place its composite name names lying in it, by one of the province's own seeds (a hint point, or a place its notes name) lying in it, by a neck under a pixel wide that joins it to the rest in the shapes, or by a reason in `[review.exclave_ok]`; an unexplained one fails the step (D691).

| Province | Name | Pixels | At | Why |
|---|---|---|---|---|
| EG-0004 | Giza-Imbaba | 6 | 30.91, 30.28 | its own seed unit Imbaba lies in it |
| IQ-0005 | Basra-Umm Qasr | 210 | 46.84, 29.89 | its own seed unit Al-Zubair lies in it |
| PS-0003 | Ramallah-Jericho | 5 | 35.43, 31.55 | a neck under a pixel wide joins it to the rest in the shapes |
| SA-0023 | Al Ula-Khaybar | 1922 | 40.92, 23.84 | its own seed point 40.88,23.5 (hint) lies in it |

## Known for review

- MAR: Natural Earth still has Morocco's 16 old regions, so the 12 new ones are built from them: Al Hoceima stays in Fes-Meknes (with Taza and Taounate), Khenifra and Khouribga stay outside Beni Mellal-Khenifra (in Fes-Meknes and Casablanca-Settat), El Jadida is in Marrakech-Safi, and Draa-Tafilalet is cut from Meknes-Tafilalet and Souss-Massa-Draa by a builder-drawn line along the High Atlas.
- MA-0019 and MA-0020 (Western Sahara, SADR claims) follow our province file (decision C): Natural Earth's Western Sahara unit is split between Laayoune-Sakia El Hamra and Dakhla-Oued Ed-Dahab at 26 N inland and Boujdour's southern edge on the coast, by a builder-drawn line; the Western Sahara part of NE's Guelmim-Es-Semara unit (Smara, Mahbes, south of 27.67 N) goes to Laayoune-Sakia El Hamra too.
- PSE: the West Bank and Gaza governorate groups are carved from Natural Earth's two Palestinian units with the geoBoundaries PSE governorates; the West Bank part of the Jerusalem governorate is drawn with Ramallah-Jericho. East Jerusalem (IL-0002) and the Golan Heights (IL-0015) are in Natural Earth's Israel already, as the province file has them.
- LBN: Akkar and Baalbek-Hermel are new governorates Natural Earth merges into North Lebanon and the Beqaa; both are cut off by builder-drawn lines.
- QA-0010 Al Shahaniya is cut from Al Rayyan by a builder-drawn line west of Doha (Al Udeid stays in Al Rayyan).
- TUN: Natural Earth has no Ariana unit (it is inside Tunis), so TN-0002 Ariana-Ben Arous holds Ben Arous and Manouba only.
- YE-0016 Al Mahrah-Socotra takes Socotra from Natural Earth's Hadramawt by a builder-drawn box round the island.

## Watched small provinces

The microstates, city-states and metro splits the plan names (P8: Singapore, the London and Beijing splits, Hong Kong and Macau): every one has pixels, and a tiny one a click target at its label point.

| Province | Name | Pixels | Tiny | Label point (px) |
|---|---|---|---|---|
| AE-0001 | Abu Dhabi Downtown | 8 | Y | 5327.5, 2045.5 |
| AE-0002 | Masdar-Yas-Saadiyat | 159 | N | 5345.5, 2046.5 |
| AE-0003 | Mussafah-Khalifa Port | 329 | N | 5335.5, 2052.5 |
| AE-0004 | Al Ain | 406 | N | 5358.5, 2046.5 |
| AE-0005 | Ruwais-Al Dhafra | 424 | N | 5286.5, 2060.5 |
| AE-0006 | Liwa-Habshan | 1542 | N | 5318.5, 2066.5 |
| AE-0007 | Das-Zirku Islands | 1 | Y | 5303.5, 2031.5 |
| AE-0008 | Dubai Core | 69 | N | 5358.5, 2026.5 |
| AE-0010 | Dubai Marina-Jebel Ali | 122 | N | 5354.5, 2033.5 |
| AE-0012 | Sharjah-Ajman | 23 | Y | 5358.5, 2020.5 |
| AE-0013 | Hamriyah-Al Dhaid | 99 | N | 5365.5, 2025.5 |
| AE-0014 | Khor Fakkan-Kalba | 16 | Y | 5377.5, 2027.5 |
| AE-0016 | Umm al-Quwain | 39 | Y | 5363.5, 2016.5 |
| AE-0017 | Ras al-Khaimah | 219 | N | 5370.5, 2014.5 |
| AE-0018 | Fujairah | 1 | Y | 5376.5, 2030.5 |
| QA-0001 | West Bay-Corniche | 2 | Y | 5267.5, 2020.5 |
| QA-0002 | Msheireb-Old Doha | 1 | Y | 5268.5, 2022.5 |
| QA-0003 | Doha Airport-Al Thumama | 2 | Y | 5269.5, 2022.5 |
| KW-0001 | Kuwait City-Sharq | 3 | Y | 5195.5, 1919.5 |
| KW-0002 | Shuwaikh-Sulaibikhat | 1 | Y | 5186.5, 1922.5 |
| BH-0001 | Bahrain | 33 | Y | 5245.5, 2000.5 |
| IL-0002 | East Jerusalem | 3 | Y | 4897.5, 1859.5 |
| IL-0015 | Golan Heights | 62 | Y | 4909.5, 1830.5 |
| PS-0001 | Jenin-Tulkarm | 77 | N | 4897.5, 1845.5 |
| PS-0002 | Nablus-Salfit | 44 | Y | 4899.5, 1851.5 |
| PS-0003 | Ramallah-Jericho | 104 | N | 4901.5, 1858.5 |
| PS-0004 | Hebron-Bethlehem | 88 | N | 4896.5, 1867.5 |
| PS-0005 | Gaza City | 8 | Y | 4880.5, 1867.5 |
| PS-0006 | Khan Yunis-Rafah | 12 | Y | 4876.5, 1872.5 |
| LB-0001 | Beirut | 2 | Y | 4903.5, 1807.5 |

## Contested provinces

Drawn by our own province files (decision C), not the sources' de facto lines: each contested province sits in the region the CSV gives it, built as listed (an alias or carve hint where Natural Earth draws the land elsewhere). The game hatches them.

| Province | Name | Country | Contested | Region drawn from |
|---|---|---|---|---|
| IR-0018 | Bandar Lengeh-Islands | IRN | ARE claims | Hormozgan: name match 100 |
| EG-0030 | Marsa Alam-Halaib | EGY | SDN claims | Red Sea: name match 100 |
| IL-0002 | East Jerusalem | ISR | PSE claims | Jerusalem District: name match 100 |
| IL-0015 | Golan Heights | ISR | SYR claims | Northern District: name match 100 |
| PS-0001 | Jenin-Tulkarm | PSE | ISR occupies | Jenin-Tubas-Tulkarm-Qalqilya: no admin-1 match (best unit 36, group 0); carve: PSE units Jenin, Tubas, Tulkarm, Qalqiliya from PSE:Ramallah-Jericho; plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694) |
| PS-0002 | Nablus-Salfit | PSE | ISR occupies | Nablus-Salfit: no admin-1 match (best unit 35, group 0); carve: PSE units Nablus, Salfit from PSE:Ramallah-Jericho; plus a sliver of PSE:Ramallah-Jericho (D694) |
| PS-0003 | Ramallah-Jericho | PSE | ISR occupies | Ramallah-Jericho: alias hint -> PS-WBK; less PSE:Bethlehem-Hebron (carve); less PSE:Jenin-Tubas-Tulkarm-Qalqilya (carve); less PSE:Nablus-Salfit (carve); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Nablus-Salfit (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Bethlehem-Hebron (D694) |
| PS-0004 | Hebron-Bethlehem | PSE | ISR occupies | Bethlehem-Hebron: no admin-1 match (best unit 40, group 0); carve: PSE units Bethlehem, Hebron from PSE:Ramallah-Jericho; plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694) |
| MA-0019 | Laayoune-Boujdour | MAR | SADR claims | Laayoune-Sakia El Hamra: alias hint -> MA-15, EH-X01~; less MAR:Dakhla-Oued Ed-Dahab (carve); carve: builder polygon from MAR:Guelmim-Oued Noun; plus a sliver of MAR:Guelmim-Oued Noun (D694) |
| MA-0020 | Dakhla | MAR | SADR claims | Dakhla-Oued Ed-Dahab: alias hint -> MA-16; carve: builder polygon from MAR:Laayoune-Sakia El Hamra |

## Region matching

Regions not matched one-to-one by name: builder aliases, Natural Earth region groups, composite names matched part by part, carves (D676) and admin-1 units no region named, given to the touching region (D673). Check these on the preview too.

| Region | Matched by | Units |
|---|---|---|
| ARE: Ras al-Khaimah | name match 100; plus unclaimed Fujayrah, Neutral Zone | 3 |
| ARE: Sharjah | name match 100; plus unclaimed Ajman | 2 |
| DZA: Annaba-El Tarf-Guelma | name parts (3 pieces, worst match 100) | 3 |
| DZA: Batna-Khenchela | name parts (2 pieces, worst match 100) | 2 |
| DZA: Bechar-Tindouf-Naama-El Bayadh | name parts (4 pieces, worst match 100) | 4 |
| DZA: Bejaia-Bouira | name parts (2 pieces, worst match 100) | 2 |
| DZA: Biskra-El Oued | name parts (2 pieces, worst match 100) | 2 |
| DZA: Blida-Tipaza | name parts (2 pieces, worst match 100) | 2 |
| DZA: Boumerdes-Tizi Ouzou | name parts (2 pieces, worst match 100) | 2 |
| DZA: Chlef-Ain Defla-Tissemsilt | name parts (3 pieces, worst match 100) | 3 |
| DZA: Constantine-Mila | name parts (2 pieces, worst match 100) | 2 |
| DZA: Laghouat-Tiaret | name parts (2 pieces, worst match 100) | 2 |
| DZA: Medea-Djelfa | name parts (2 pieces, worst match 100) | 2 |
| DZA: Mostaganem-Relizane | name parts (2 pieces, worst match 100) | 2 |
| DZA: Setif-Bordj Bou Arreridj | name parts (2 pieces, worst match 100) | 2 |
| DZA: Sidi Bel Abbes-Mascara-Saida | name parts (3 pieces, worst match 100) | 3 |
| DZA: Skikda-Jijel | name parts (2 pieces, worst match 100) | 2 |
| DZA: Tebessa-Souk Ahras-Oum El Bouaghi | name parts (3 pieces, worst match 100) | 3 |
| DZA: Tlemcen-Ain Temouchent | name parts (2 pieces, worst match 100) | 2 |
| IRQ: Anbar | alias hint -> IQ-AN; less IRQ:Baghdad (carve); a sliver to IRQ:Baghdad (D694) | 1 |
| IRQ: Babil | name match 100; less IRQ:Baghdad (carve); a sliver to IRQ:Baghdad (D694); a sliver to IRQ:Baghdad (D694) | 1 |
| IRQ: Baghdad | name match 100; carve: IRQ units Al-Kadhmiyah, Al-Mahmoudiya, Al-Mada'in, Al-Adhamiya, Al-Karkh, Al-Risafa, Al-Thawra from IRQ:Anbar, IRQ:Babil, IRQ:Diyala, IRQ:Saladin, IRQ:Wasit; plus a sliver of IRQ:Anbar (D694); plus a sliver of IRQ:Babil (D694); plus a sliver of IRQ:Babil (D694); plus a sliver of IRQ:Diyala (D694); plus a sliver of IRQ:Diyala (D694); plus a sliver of IRQ:Diyala (D694); plus a sliver of IRQ:Saladin (D694) | 1 |
| IRQ: Diyala | name match 100; less IRQ:Baghdad (carve); a sliver to IRQ:Baghdad (D694); a sliver to IRQ:Baghdad (D694); a sliver to IRQ:Baghdad (D694) | 1 |
| IRQ: Muthanna | alias hint -> IQ-MU | 1 |
| IRQ: Saladin | name match 100; less IRQ:Baghdad (carve); a sliver to IRQ:Baghdad (D694) | 1 |
| IRQ: Sulaymaniyah-Halabja | alias hint -> IQ-SU | 1 |
| IRQ: Wasit | name match 100; less IRQ:Baghdad (carve) | 1 |
| JOR: Balqa-Madaba | name parts (2 pieces, worst match 100) | 2 |
| JOR: Jerash-Ajloun | name parts (2 pieces, worst match 100) | 2 |
| JOR: Karak-Tafilah | name parts (2 pieces, worst match 100) | 2 |
| KWT: Ahmadi | alias hint -> KW-AH | 1 |
| LBN: Akkar | no admin-1 match (best unit 46, group 0); carve: builder polygon from LBN:North | 0 |
| LBN: Baalbek-Hermel | no admin-1 match (best unit 42, group 0); carve: builder polygon from LBN:Bekaa | 0 |
| LBN: Bekaa | alias hint -> LB-BI; less LBN:Baalbek-Hermel (carve) | 1 |
| LBN: North | alias hint -> LB-AS; less LBN:Akkar (carve) | 1 |
| LBY: Al Wahat | alias hint -> LY-AJ | 1 |
| LBY: Derna-Butnan | alias hint -> LY-BU, LY-QB | 2 |
| LBY: Jabal al-Akhdar-Marj | alias hint -> LY-JA, LY-MJ | 2 |
| LBY: Jabal al-Gharbi-Nalut | alias hint -> LY-MZ, LY-GD | 2 |
| LBY: Jafara-Zawiya | name parts (2 pieces, worst match 100) | 2 |
| LBY: Kufra | alias hint -> LY-KF | 1 |
| LBY: Murzuq-Wadi al-Hayaa | name parts (2 pieces, worst match 100) | 2 |
| LBY: Wadi al-Shatii-Jufra | alias hint -> LY-WS, LY-JU | 2 |
| MAR: Beni Mellal-Khenifra | alias hint -> MA-12 | 1 |
| MAR: Casablanca-Settat | alias hint -> MA-08, MA-09; carve: builder polygon from MAR:Marrakech-Safi; plus a sliver of MAR:Marrakech-Safi (D694) | 2 |
| MAR: Dakhla-Oued Ed-Dahab | alias hint -> MA-16; carve: builder polygon from MAR:Laayoune-Sakia El Hamra | 1 |
| MAR: Draa-Tafilalet | no admin-1 match (best unit 67, group 0); carve: builder polygon from MAR:Fes-Meknes, MAR:Souss-Massa; plus a sliver of MAR:Guelmim-Oued Noun (D694); plus a sliver of MAR:Souss-Massa (D694) | 0 |
| MAR: Fes-Meknes | alias hint -> MA-05, MA-03, MA-06; less MAR:Draa-Tafilalet (carve); less MAR:Tanger-Tetouan-Al Hoceima (carve); a sliver to MAR:Oriental (D694); plus a sliver of MAR:Tanger-Tetouan-Al Hoceima (D694) | 3 |
| MAR: Guelmim-Oued Noun | alias hint -> MA-14; less MAR:Laayoune-Sakia El Hamra (carve); less MAR:Souss-Massa (carve); a sliver to MAR:Draa-Tafilalet (D694); a sliver to MAR:Souss-Massa (D694); a sliver to MAR:Laayoune-Sakia El Hamra (D694) | 1 |
| MAR: Laayoune-Sakia El Hamra | alias hint -> MA-15, EH-X01~; less MAR:Dakhla-Oued Ed-Dahab (carve); carve: builder polygon from MAR:Guelmim-Oued Noun; plus a sliver of MAR:Guelmim-Oued Noun (D694) | 2 |
| MAR: Marrakech-Safi | alias hint -> MA-11, MA-10; less MAR:Casablanca-Settat (carve); a sliver to MAR:Casablanca-Settat (D694) | 2 |
| MAR: Rabat-Sale-Kenitra | alias hint -> MA-07, MA-02 | 2 |
| MAR: Souss-Massa | alias hint -> MA-13; less MAR:Draa-Tafilalet (carve); carve: builder polygon from MAR:Guelmim-Oued Noun; plus a sliver of MAR:Guelmim-Oued Noun (D694); a sliver to MAR:Draa-Tafilalet (D694) | 1 |
| MAR: Tanger-Tetouan-Al Hoceima | alias hint -> MA-01; carve: builder polygon from MAR:Fes-Meknes; a sliver to MAR:Fes-Meknes (D694) | 1 |
| OMN: North Al Batinah | alias hint -> OM-BA | 1 |
| OMN: North Ash Sharqiyah | alias hint -> OM-SS | 1 |
| OMN: South Al Batinah | alias hint -> OM-BJ | 1 |
| OMN: South Ash Sharqiyah | alias hint -> OM-SH | 1 |
| PSE: Bethlehem-Hebron | no admin-1 match (best unit 40, group 0); carve: PSE units Bethlehem, Hebron from PSE:Ramallah-Jericho; plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694) | 0 |
| PSE: Deir al-Balah-Khan Yunis-Rafah | no admin-1 match (best unit 31, group 0); carve: PSE units Deir Al Balah, Khan Yunis, Rafah from PSE:Gaza-North Gaza; plus a sliver of PSE:Gaza-North Gaza (D694); plus a sliver of PSE:Gaza-North Gaza (D694); plus a sliver of PSE:Gaza-North Gaza (D694); plus a sliver of PSE:Gaza-North Gaza (D694) | 0 |
| PSE: Gaza-North Gaza | alias hint -> PS-GZZ; less PSE:Deir al-Balah-Khan Yunis-Rafah (carve); a sliver to PSE:Deir al-Balah-Khan Yunis-Rafah (D694); a sliver to PSE:Deir al-Balah-Khan Yunis-Rafah (D694); a sliver to PSE:Deir al-Balah-Khan Yunis-Rafah (D694); a sliver to PSE:Deir al-Balah-Khan Yunis-Rafah (D694) | 1 |
| PSE: Jenin-Tubas-Tulkarm-Qalqilya | no admin-1 match (best unit 36, group 0); carve: PSE units Jenin, Tubas, Tulkarm, Qalqiliya from PSE:Ramallah-Jericho; plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694); plus a sliver of PSE:Ramallah-Jericho (D694) | 0 |
| PSE: Nablus-Salfit | no admin-1 match (best unit 35, group 0); carve: PSE units Nablus, Salfit from PSE:Ramallah-Jericho; plus a sliver of PSE:Ramallah-Jericho (D694) | 0 |
| PSE: Ramallah-Jericho | alias hint -> PS-WBK; less PSE:Bethlehem-Hebron (carve); less PSE:Jenin-Tubas-Tulkarm-Qalqilya (carve); less PSE:Nablus-Salfit (carve); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Nablus-Salfit (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Jenin-Tubas-Tulkarm-Qalqilya (D694); a sliver to PSE:Bethlehem-Hebron (D694); a sliver to PSE:Bethlehem-Hebron (D694) | 1 |
| QAT: Al Daayen-Umm Salal | name parts (2 pieces, worst match 100) | 2 |
| QAT: Al Khor-Al Shamal | name parts (2 pieces, worst match 100) | 2 |
| QAT: Al Rayyan | name match 100; less QAT:Al Shahaniya (carve); a sliver to QAT:Al Shahaniya (D694) | 1 |
| QAT: Al Shahaniya | no admin-1 match (best unit 67, group 0); carve: builder polygon from QAT:Al Rayyan; plus a sliver of QAT:Al Rayyan (D694) | 0 |
| SAU: Qassim | alias hint -> SA-05 | 1 |
| SYR: Damascus | alias hint -> SY-DI | 1 |
| SYR: Quneitra | name match 100; plus unclaimed UNDOF | 2 |
| SYR: Rif Dimashq | alias hint -> SY-RD | 1 |
| TUN: Ariana-Ben Arous-Manouba | alias hint -> TN-13, TN-14 | 2 |
| TUN: Gabes-Medenine-Tataouine | name parts (3 pieces, worst match 100) | 3 |
| TUN: Gafsa-Tozeur-Kebili | name parts (3 pieces, worst match 100) | 3 |
| TUN: Jendouba-Beja-Kef-Siliana | name parts (4 pieces, worst match 100) | 4 |
| TUN: Kasserine-Sidi Bouzid | name parts (2 pieces, worst match 100) | 2 |
| TUN: Mahdia-Kairouan | name parts (2 pieces, worst match 100) | 2 |
| TUN: Nabeul-Zaghouan | name parts (2 pieces, worst match 100) | 2 |
| TUN: Sousse-Monastir | name parts (2 pieces, worst match 100) | 2 |
| YEM: Abyan-Al Bayda | name parts (2 pieces, worst match 100) | 2 |
| YEM: Al Mahrah-Socotra | alias hint -> YE-MR; carve: builder polygon from YEM:Hadramawt | 1 |
| YEM: Dhamar-Raymah | name parts (2 pieces, worst match 100) | 2 |
| YEM: Hadramawt | name match 100; less YEM:Al Mahrah-Socotra (carve) | 1 |
| YEM: Hajjah-Al Mahwit | name parts (2 pieces, worst match 100) | 2 |
| YEM: Lahij-Ad Dali | name parts (2 pieces, worst match 100) | 2 |
| YEM: Saada-Al Jawf | name parts (2 pieces, worst match 100) | 2 |
| YEM: Sanaa-Amran | name parts (2 pieces, worst match 100) | 2 |

## Land without a province

Natural Earth admin-1 units of this file's countries that no region claims and that touch no region of their country (overseas territories, remote islands). They stay water on the map.

None.

## Sea links

`sea` rows of province-adjacency.csv with a province of this file: coastal provinces whose shapes do not touch but face each other across a strait (D678).

AE-0001-AE-0002, AE-0001-AE-0003, AE-0001-AE-0005, BH-0001-QA-0008, BH-0001-QA-0010, BH-0001-SA-0014, BH-0001-SA-0018, BH-0001-SA-0019, DJ-0003-YE-0008, EG-0015-EG-0018, EG-0034-JO-0010, EG-0034-SA-0032, EG-0034-SA-0035, ER-0006-YE-0005, ER-0006-YE-0008, ES-0010-MA-0007, GI-0001-MA-0007, IR-0017-OM-0012, KW-0001-KW-0010, QA-0003-QA-0009

## Small provinces

| Province | Name | Region | Pixels | Region mean |
|---|---|---|---|---|
| AE-0001 | Abu Dhabi Downtown | Abu Dhabi | 8 | 410 |
| AE-0007 | Das-Zirku Islands | Abu Dhabi | 1 | 410 |
| MA-0001 | Casablanca Centre-Anfa | Casablanca-Settat | 16 | 337 |
| SA-0014 | Dammam-Khobar-Dhahran | Eastern Province | 66 | 2048 |

## Uneven Voronoi splits

Blocks (ADM2 units, or admin-1 units for Greenland) that several provinces share, where one province takes most of the block. Check that the larger part belongs where it went.

| Region | Block | Shares |
|---|---|---|
| ARE:Sharjah | Sharjah | AE-0013 78%, AE-0014 12%, AE-0012 10% |
| DZA:Oran | part-0 | DZ-0015 77%, DZ-0016 23% |
| IRN:Khuzestan | part-0 | IR-0020 85%, IR-0021 15% |
| IRQ:Baghdad | Al-Thawra | IQ-0003 79%, IQ-0002 21% |
| ISR:Jerusalem District | Jerusalem | IL-0003 82%, IL-0002 9%, IL-0001 9% |
| LBY:Al Wahat | part-0 | LY-0011 82%, LY-0010 18% |
| LBY:Tripoli | part-0 | LY-0002 95%, LY-0001 5% |
| OMN:Muscat | part-0 | OM-0001 93%, OM-0002 7% |
| OMN:North Al Batinah | part-0 | OM-0004 84%, OM-0003 16% |
| SAU:Jazan | part-2 | SA-0030 97%, SA-0029 3% |

## Named places outside their province

None.

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| AE-0006 | Liwa-Habshan | 27 | Y | N |
| AE-0013 | Hamriyah-Al Dhaid | 1 | N | Y |
| AE-0018 | Fujairah | 0 | N | Y |
| DZ-0001 | Algiers Centre-Hydra | 1 | N | Y |
| DZ-0002 | Algiers East-Rouiba | 1 | N | Y |
| EG-0017 | Zagazig-10th of Ramadan | 9 | Y | N |
| EG-0019 | Ismailia-Canal | 3 | N | Y |
| IL-0004 | Tel Aviv-Yafo | 3 | N | Y |
| IL-0005 | Ramat Gan-Herzliya | 2 | N | Y |
| IL-0006 | Holon-Bat Yam | 2 | N | Y |
| IL-0014 | Galilee-Tiberias | 7 | Y | N |
| IQ-0005 | Basra-Umm Qasr | 0 | N | Y |
| IQ-0006 | Rumaila-Majnoon | 17 | Y | N |
| KW-0002 | Shuwaikh-Sulaibikhat | 2 | N | Y |
| KW-0005 | Mubarak Al-Kabeer | 3 | N | Y |
| KW-0009 | Jahra | 25 | Y | N |
| MA-0004 | Settat-Berrechid | 11 | Y | N |
| MA-0013 | Marrakech | 35 | Y | N |
| OM-0008 | Ibra-Wahiba | 11 | Y | N |
| QA-0001 | West Bay-Corniche | 2 | N | Y |
| QA-0002 | Msheireb-Old Doha | 1 | N | Y |
| QA-0003 | Doha Airport-Al Thumama | 2 | N | Y |
| QA-0005 | Industrial Area-Al Udeid | 8 | Y | N |
| SA-0011 | Mecca | 23 | Y | N |
| SA-0012 | Taif | 19 | Y | N |
| SA-0017 | Hafar al-Batin-Khafji | 0 | N | Y |
| SA-0018 | Abqaiq-Ghawar | 23 | Y | N |
| SA-0019 | Al Ahsa-Hofuf | 67 | Y | N |
| SA-0026 | Muhayil-Tihama | 0 | N | Y |
| SA-0030 | Sabya-Abu Arish | 57 | Y | N |
| SA-0035 | Sakaka-Al Jawf | 17 | Y | N |
| YE-0010 | Lahij-Ad Dali | 32 | Y | N |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

YE-0005 (8), YE-0016 (7), AE-0005 (6), IR-0018 (6), MA-0020 (6), OM-0012 (6), SA-0032 (6), AE-0001 (5), AE-0014 (5), IR-0017 (5), KW-0010 (5), EG-0005 (4), IQ-0002 (4), SA-0015 (4), YE-0009 (4), AE-0003 (3), AE-0008 (3), BH-0001 (3), DZ-0012 (3), EG-0016 (3), EG-0033 (3), EG-0034 (3), IL-0016 (3), IL-0017 (3), IQ-0015 (3), IQ-0018 (3), KW-0001 (3), OM-0009 (3), OM-0011 (3), PS-0003 (3), PS-0005 (3), SA-0029 (3), TN-0006 (3), TN-0009 (3), AE-0002 (2), AE-0013 (2), DZ-0002 (2), DZ-0010 (2), DZ-0053 (2), EG-0004 (2), EG-0012 (2), EG-0014 (2), EG-0015 (2), EG-0017 (2), EG-0029 (2), EG-0038 (2), IL-0005 (2), IL-0010 (2), IL-0012 (2), IL-0015 (2), IQ-0005 (2), IQ-0009 (2), IQ-0016 (2), IR-0010 (2), IR-0019 (2), IR-0027 (2), IR-0037 (2), JO-0002 (2), KW-0009 (2), LB-0005 (2), MA-0010 (2), MA-0016 (2), OM-0004 (2), QA-0003 (2), SA-0010 (2), SA-0018 (2), SA-0023 (2), SA-0043 (2), SY-0014 (2), TN-0001 (2), TN-0002 (2), YE-0008 (2), YE-0011 (2), YE-0012 (2)

## Visual check

`preview-mena.png` in this folder is province-ids.png around the region (pixels x 3522..5726, y 1437..2566, scaled by 1.09).
