# Map QA report: sub-saharan-africa

_Written by `tools/map-pipeline/run.py --region sub-saharan-africa` (pipeline pb-1). Source of the rows: `provinces-sub-saharan-africa.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 608 provinces of `provinces-sub-saharan-africa.csv` have a crosswalk row and pixels (53 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 608 |
| ... AGO | 22 |
| ... BDI | 6 |
| ... BEN | 9 |
| ... BFA | 12 |
| ... BWA | 10 |
| ... CAF | 10 |
| ... CIV | 15 |
| ... CMR | 16 |
| ... COD | 29 |
| ... COG | 10 |
| ... COM | 2 |
| ... CPV | 2 |
| ... DJI | 4 |
| ... ERI | 6 |
| ... ETH | 27 |
| ... GAB | 9 |
| ... GHA | 17 |
| ... GIN | 12 |
| ... GMB | 4 |
| ... GNB | 4 |
| ... GNQ | 5 |
| ... KEN | 22 |
| ... LBR | 6 |
| ... LSO | 4 |
| ... MDG | 15 |
| ... MLI | 17 |
| ... MOZ | 16 |
| ... MRT | 13 |
| ... MUS | 4 |
| ... MWI | 10 |
| ... NAM | 11 |
| ... NER | 17 |
| ... NGA | 40 |
| ... RWA | 8 |
| ... SDN | 23 |
| ... SEN | 11 |
| ... SLE | 7 |
| ... SOM | 13 |
| ... SSD | 12 |
| ... STP | 1 |
| ... SWZ | 4 |
| ... SYC | 1 |
| ... TCD | 16 |
| ... TGO | 7 |
| ... TZA | 23 |
| ... UGA | 16 |
| ... ZAF | 32 |
| ... ZMB | 15 |
| ... ZWE | 13 |
| Regions matched | 482 of 482 |
| Provinces by method: admin1 | 438 |
| Provinces by method: admin2 | 133 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 37 |
| Flagged for review (confidence < 0.6) | 0 |
| Placed by a builder hint (`hints/sub-saharan-africa.toml`) | 26 |
| Tiny (under 64 px) | 53 |
| Given a pixel at their interior point (no pixel centre inside) | 2 |
| More than one part (islands, exclaves) | 146 |
| Coastal flag differs from the CSV | 22 |
| Small for their region (not Metro, under 5% of the region's mean) | 5 |
| Voronoi-split blocks where one province takes 75% or more | 3 |
| Places named in a province's name or notes that lie in another province | 0 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 6 |
| Admin-1 units left without a province | 0 |
| Sea links with a province of this file | 13 |
| City probe points (fail on a mismatch; D686) | 99 pass, 0 mismatch, 4 listed |
| Metro reach scan rows (listed; D686) | 2 |
| Land exclaves of 5 px or more (fail unless explained; D691) | 20 (0 unexplained) |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) | 3 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes) | Public domain | yes |
| geoBoundaries gbOpen AGO ADM2 (geoBoundaries, Wikimedia Commons) | Public Domain | yes |
| geoBoundaries gbOpen BDI ADM1 (geoBoundaries, Wikimedia) | CC0 1.0 Universal (CC0 1.0) Public Domain Dedication | yes |
| geoBoundaries gbOpen BEN ADM1 (geoBoundaries, Wikimedia Commons) | Public Domain | yes |
| geoBoundaries gbOpen BWA ADM1 (OpenStreetMap, Wambacher) | Creative Commons Attribution-ShareAlike 2.0 | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 2.0); Voronoi path |
| geoBoundaries gbOpen BWA ADM2 (RCMRD) | Public Domain | yes |
| geoBoundaries gbOpen CIV ADM1 (World Bank Group, OCHA Côte d’Ivoire) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen CIV ADM2 (World Bank) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen CMR ADM2 (Open Africa) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen COD ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen COD ADM2 (Referenciel Géographique Commun, OCHA DR Congo) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen CPV ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen ERI ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen ETH ADM1 (Open Africa, Code for Ethiopia) | Creative Commons Attribution 4.0 (CC BY 4.0) | yes |
| geoBoundaries gbOpen ETH ADM2 (Open Africa, Code for Ethiopia) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen GHA ADM1 (Open Street Map) | Creative Commons Attribution-ShareAlike 2.0 | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 2.0); Voronoi path |
| geoBoundaries gbOpen GHA ADM2 (USAID Ghana HPNO, Ghana Statistical Service) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen GIN ADM2 (World Food Programme, OCHA ROWCA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen GMB ADM1 (Knippenberg, Erwin, & Moritz, Meyer. “The Hidden Potential of Mobile Phone Data Insights on COVID-19 in the Gambia.” Data Blog, The World Bank Data Catalog) | Creative Commons Attribution 4.0 (CC BY 4.0) | yes |
| geoBoundaries gbOpen GNB ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen GNQ ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen KEN ADM1 (RCMRD GeoPortal, Africa GeoPortal) | Public Domain | yes |
| geoBoundaries gbOpen LBR ADM1 (UNMIL, OCHA ROWCA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen LSO ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen MDG ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen MLI ADM1 (DNCT - Direction Nationale des Collectivités Territoriales, United Nations Office for the Coordination of Humanitarian Affairs, Mali) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen MLI ADM2 (DNCT - Direction Nationale des Colelctivités Territorielles, DNP - Direction Nationale de la Population, United Nations Office for the Coordination of Humanitarian Affairs, Mali) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen MOZ ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen MOZ ADM2 (Mozambique INE (Instituto Nacional de Estatistica), OCHA ROSEA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen MUS ADM1 (geoBoundaries, OpenStreetMap) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen MWI ADM2 (National Statistics Office of Malawi, OCHA ROSEA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen NAM ADM2 (Stanford Digital Repository, Namibia Statistics Agency) | Public Domain | yes |
| geoBoundaries gbOpen NER ADM2 (geoBoundaries, City Population) | Creative Commons Attribution 3.0 License | yes |
| geoBoundaries gbOpen NGA ADM2 (GRID3) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen RWA ADM2 (Open Data Rwanda) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen SDN ADM1 (Information Management Working Group (IMWG), OCHA ROSEA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen SDN ADM2 (OCHA ROSEA, Information Management Working Group) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen SEN ADM1 (Government of Senegal, OCHA ROWCA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen SLE ADM1 (Government of Sierra Leone, OCHA ROWCA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen SLE ADM2 (Government of Sierra Leone, OCHA ROWCA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen SOM ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen SOM ADM2 (Global Polio Eradication Initiative (GPEI), Frank Salet) | Creative Commons Attribution 4.0 (CC BY 4.0) | yes |
| geoBoundaries gbOpen SSD ADM2 (South Sudan Information Management Working Group (IMWG), National Bureau of Statistics (NBS), and OCHA, OCHA South Sudan) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen TCD ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen TGO ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen TGO ADM2 (OpenStreetMap, Wambacher) | Creative Commons Attribution-ShareAlike 2.0 | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 2.0); Voronoi path |
| geoBoundaries gbOpen TZA ADM1 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen TZA ADM2 (Tanzania National Bureau of Statistics / UN OCHA ROSA, OCHA ROSA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen UGA ADM2 (geoBoundaries, Wikimedia Commons) | Public Domain | yes |
| geoBoundaries gbOpen ZAF ADM2 (OCHA ROSEA, South African Municipal Demarcation Board) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen ZMB ADM1 (Zambia Data Hub) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen ZMB ADM2 (GRID3, Office of the Surveyor General) | Creative Commons Attribution 4.0 (CC BY 4.0) | yes |
| geoBoundaries gbOpen ZWE ADM2 (Zimbabwe National Statistics Agency (ZIMSTAT www.zimstat.co.zw) Central Statistics Office, OCHA ROSEA) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |

Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, public domain and the attribution-only government licences OGL-Canada 2.0, OGL-UK 3.0, Data licence Germany Attribution 2.0, Etalab 2.0, Spain's INE licence, Singapore ODL 1.0 and Korea OGL Type 1 (D685); a region whose country has no allowed ADM2 is split by Voronoi.

Provenance to check (for Logan; these files pass the allowlist and are used):

- AGO ADM2: public domain or CC0, but geoBoundaries names Wikimedia as the source (Wikimedia maps are often CC BY-SA)
- NER ADM2: CC BY, but the source is citypopulation.de, which republishes national statistics offices' maps

## Low-confidence rows for review

None.

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| AO-0001 | Luanda Ingombota-Ilha | seeds: point 13.21,-8.79 (hint) (snapped to land); point 13.23,-8.81 (hint); 1 whole admin2 units |
| AO-0011 | Lobito-Benguela | seeds: unit Benguela (hint); unit Lobito (hint); 4 whole admin2 units |
| BW-0004 | Orapa-Letlhakane | seeds: point 25.37,-21.31 (hint); point 25.59,-21.42 (hint); point 26.17,-20.58 (hint); 1 whole admin1 units, split: Central |
| CD-0001 | Kinshasa Gombe-Ngaliema | seeds: point 15.25,-4.36 (hint); point 15.28,-4.33 (hint); point 15.3,-4.325 (hint); 0 whole admin2 units, split: Kinshasa |
| CD-0002 | Kinshasa Limete-Ndjili | seeds: point 15.36,-4.39 (hint); point 15.4,-4.38 (hint); point 15.5,-4.4 (hint); point 15.57,-4.06 (hint); 0 whole admin2 units, split: Kinshasa |
| CD-0003 | Kinshasa South-Mont Ngafula | seeds: point 15.29,-4.5 (hint); point 15.31,-4.4 (hint); point 15.32,-4.42 (hint); point 15.36,-4.64 (hint); 0 whole admin2 units, split: Kinshasa |
| CI-0001 | Abidjan Plateau-Cocody | seeds: point -3.98,5.36 (hint); point -4.02,5.32 (hint); 0 whole admin2 units, split: District Autonome D'Abidjan |
| CI-0002 | Abidjan Port-Yopougon | seeds: point -3.93,5.25 (hint); point -4.03,5.29 (hint); point -4.08,5.34 (hint); 0 whole admin2 units, split: District Autonome D'Abidjan |
| ET-0006 | Semera-Awash | seeds: point 40.17,8.98 (hint); point 40.9,11.0 (hint); point 40.97,11.73 (hint); point 41.01,11.79 (hint); 0 whole parts, 1 split |
| ET-0007 | Danakil-Afdera | seeds: point 40.3,14.24 (hint); point 40.67,13.6 (hint); point 40.9,13.25 (hint); 0 whole parts, 1 split |
| ET-0010 | Dessie-Kombolcha | seeds: point 39.6,11.83 (hint); point 39.63,11.13 (hint); point 39.74,11.08 (hint); 0 whole parts, 1 split |
| ET-0013 | Finfinne Surroundings | seeds: point 38.62,8.92 (hint); point 38.65,9.08 (hint); point 38.73,9.18 (hint); point 38.9,8.8 (hint); point 38.9,9.07 (hint); point 38.98,8.75 (hint); 0 whole parts, 1 split |
| ET-0018 | Guji-Borana | seeds: point 38.08,4.88 (hint); point 38.88,5.75 (hint); point 38.98,5.88 (hint); point 39.05,3.53 (hint); 0 whole parts, 1 split |
| ET-0019 | Chiro-Hararghe | seeds: point 40.52,8.82 (hint); point 40.87,9.08 (hint); point 41.43,9.1 (hint); point 42.33,9.22 (hint); 0 whole parts, 1 split |
| ET-0024 | Hawassa-Sidama | seeds: point 38.29,6.75 (hint); point 38.31,6.41 (hint); point 38.48,7.05 (hint); 0 whole parts, 1 split |
| ET-0027 | Jinka-South Omo | seeds: point 35.9,5.6 (hint); point 36.56,5.78 (hint); point 37.3,6.85 (hint); 0 whole parts, 1 split |
| NG-0001 | Lagos Island-Ikoyi-Lekki | seeds: unit Eti Osa (hint); unit Lagos Island (hint); 3 whole admin2 units |
| SD-0001 | Khartoum-Bahri | seeds: unit Bahri (hint); unit Jebel Awlia (hint); unit Khartoum (hint); unit Sharg An Neel (hint); 4 whole admin2 units |
| SD-0002 | Omdurman | seeds: unit Karrari (hint); unit Um Bada (hint); unit Um Durman (hint); 3 whole admin2 units |
| SD-0003 | Wad Madani | seeds: point 33.42,13.95 (hint); point 33.52,14.4 (hint); 4 whole admin2 units |
| SD-0004 | Managil | seeds: point 32.95,14.7 (hint); point 32.99,14.25 (hint); 4 whole admin2 units |
| SL-0002 | Waterloo-Western Rural | seeds: point -13.07,8.34 (hint); point -13.17,8.29 (hint); point -13.2,8.18 (hint) (snapped to land); 1 whole admin2 units |
| UG-0008 | Moroto-Karamoja | seeds: point 33.95,3.53 (hint); point 34.1,3.0 (hint); point 34.25,2.1 (hint); point 34.65,2.53 (hint); 8 whole admin1 units |
| ZA-0001 | Johannesburg Central-Sandton | seeds: point 28.0,-26.09 (hint); point 28.05,-26.2 (hint); point 28.06,-26.11 (hint); point 28.13,-25.99 (hint); 0 whole admin2 units, split: City of Johannesburg |
| ZA-0002 | Soweto-West Rand | seeds: point 27.86,-26.25 (hint); point 27.87,-26.16 (hint); point 27.9,-26.24 (hint); unit West Rand (hint); 1 whole admin2 units, split: City of Johannesburg |
| ZA-0031 | Kathu-Sishen | seeds: point 22.97,-27.2 (hint); point 22.99,-28.35 (hint); point 23.05,-27.7 (hint); 1 whole admin2 units, split: Z F Mgcawu |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| BW-0005 | Selebi-Phikwe | 1 | 1 | 4729.5, 3117.5 |
| GN-0001 | Conakry | 1 | 1 | 3784.5, 2391.5 |
| GQ-0005 | Annobon | 1 | 1 | 4224.5, 2642.5 |
| BJ-0001 | Cotonou | 2 | 1 | 4150.5, 2464.5 |
| CG-0002 | Pointe-Noire | 2 | 1 | 4366.5, 2718.5 |
| CF-0001 | Bangui | 3 | 1 | 4517.5, 2509.5 |
| MU-0001 | Port Louis | 3 | 1 | 5404.5, 3074.5 |
| SL-0001 | Freetown | 3 | 2 | 3794.5, 2416.5 |
| ZW-0006 | Ngezi-Selous | 4 | 1 | 4793.5, 3020.5 |
| DJ-0001 | Djibouti City | 5 | 1 | 5073.5, 2345.5 |
| MZ-0001 | Maputo | 5 | 1 | 4836.5, 3212.5 |
| TD-0001 | N'Djamena | 5 | 1 | 4438.5, 2331.5 |
| GW-0001 | Bissau | 7 | 1 | 3740.5, 2336.5 |
| KE-0004 | Mombasa | 7 | 5 | 4996.5, 2700.5 |
| CD-0001 | Kinshasa Gombe-Ngaliema | 8 | 1 | 4442.5, 2709.5 |
| GM-0001 | Banjul-Serekunda | 8 | 1 | 3716.5, 2302.5 |
| SO-0001 | Mogadishu | 8 | 2 | 5130.5, 2560.5 |
| ML-0001 | Bamako | 10 | 1 | 3913.5, 2320.5 |
| NG-0002 | Ikeja-Mainland | 11 | 1 | 4172.5, 2459.5 |
| AO-0001 | Luanda Ingombota-Ilha | 12 | 1 | 4397.5, 2811.5 |
| UG-0001 | Kampala | 13 | 1 | 4838.5, 2601.5 |
| ET-0003 | Harar | 16 | 1 | 5055.5, 2397.5 |
| TG-0001 | Lome | 16 | 1 | 4123.5, 2468.5 |
| SC-0001 | Seychelles | 17 | 7 | 5357.5, 2714.5 |
| ZW-0002 | Bulawayo | 18 | 1 | 4744.5, 3073.5 |
| MU-0002 | Ebene-Curepipe | 19 | 1 | 5405.5, 3077.5 |
| ET-0001 | Addis Ababa | 22 | 1 | 4978.5, 2404.5 |
| NG-0001 | Lagos Island-Ikoyi-Lekki | 23 | 3 | 4177.5, 2461.5 |
| SL-0002 | Waterloo-Western Rural | 24 | 1 | 3797.5, 2420.5 |
| SN-0001 | Dakar | 25 | 1 | 3703.5, 2270.5 |
| KM-0002 | Mutsamudu-Fomboni | 28 | 2 | 5107.5, 2888.5 |
| KE-0001 | Nairobi | 29 | 1 | 4934.5, 2639.5 |
| CI-0001 | Abidjan Plateau-Cocody | 30 | 1 | 4006.5, 2486.5 |
| NE-0001 | Niamey | 30 | 1 | 4144.5, 2300.5 |
| MU-0003 | Grand Baie-Flacq | 31 | 1 | 5407.5, 3073.5 |
| TZ-0002 | Dar es Salaam Temeke-Port | 31 | 1 | 4994.5, 2769.5 |
| RW-0001 | Kigali | 32 | 1 | 4781.5, 2653.5 |
| GH-0001 | Accra | 36 | 1 | 4089.5, 2481.5 |
| TZ-0001 | Dar es Salaam Ilala-Kinondoni | 36 | 1 | 4986.5, 2763.5 |
| NG-0003 | Apapa-Badagry | 39 | 2 | 4163.5, 2462.5 |
| AO-0002 | Luanda Viana-Cacuaco | 40 | 2 | 4403.5, 2809.5 |
| TZ-0023 | Pemba | 41 | 2 | 5000.5, 2724.5 |
| ET-0002 | Dire Dawa | 42 | 1 | 5049.5, 2390.5 |
| ZW-0001 | Harare | 42 | 1 | 4802.5, 3020.5 |
| KM-0001 | Moroni | 45 | 1 | 5081.5, 2877.5 |
| MU-0004 | Mahebourg-Rodrigues | 45 | 4 | 5407.5, 3080.5 |
| ST-0001 | Sao Tome and Principe | 46 | 2 | 4246.5, 2603.5 |
| ZA-0001 | Johannesburg Central-Sandton | 46 | 1 | 4733.5, 3215.5 |
| BI-0001 | Bujumbura | 52 | 1 | 4766.5, 2688.5 |
| CM-0003 | Douala | 56 | 1 | 4317.5, 2518.5 |
| CI-0002 | Abidjan Port-Yopougon | 58 | 2 | 4000.5, 2485.5 |
| CD-0003 | Kinshasa South-Mont Ngafula | 63 | 2 | 4455.5, 2721.5 |
| ER-0001 | Asmara | 63 | 1 | 4982.5, 2258.5 |

## Anchor cities

Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own name names lands on that province (and, for a Metro province, near its middle and in its largest 4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a province of that Metro, and each key city lands on one of its provinces (key-cities.csv).

| Check | Province | Place | Expected | Got |
|---|---|---|---|---|
| city on the edge | TD-0005 | Moundou | TD-0005 | TD-0004 |
| city on the edge | SD-0002 | Omdurman | SD-0002 | SD-0001 |
| city on the edge | NA-0011 | Katima Mulilo | NA-0011 | ZM-0015 |

No misses; the rows above are allowed: a city part across a narrow strait, or a city whose own pixel a neighbour took while its province holds a touching pixel.

## Natural Earth labels

Natural Earth units whose capital another region of the country names (in a province name or notes) while their own region does not: the sign of NE giving units each other's names, as in Eritrea and Guyana (D687). Each row fails the step unless `[review] ne_label_ok` in the hints names the region.

| Region | NE unit | Capital | Named by |
|---|---|---|---|
| SWZ:Manzini (checked) | Manzini (SWZ-536) | Lobamba | SWZ:Hhohho |
| TCD:Logone Oriental (checked) | Logone Oriental (TCD-1485) | Moundou | TCD:Logone Occidental |

## City probe

Points of `tools/map-pipeline/checks/city-points.txt` whose expected province is in this file, looked up in province-index.png: a point passes on its pixel or one of the 8 around it (D686). The step fails on a mismatch.

| Point | Expected | Got | Result |
|---|---|---|---|
| Epe (3.98, 6.58) | ? | NG-0004 | listed |
| Galkayo (47.43, 6.77) | ? | SO-0008 | listed |
| Maluku (15.57, -4.06) | ? | CD-0002 | listed |
| Orange Farm (27.86, -26.48) | ? | ZA-0002 | listed |
| Abidjan (-4.02, 5.33) | CI | CI-0001 | on it |
| Abyei (28.44, 9.6) | SD-0017 | SD-0017 | on it |
| Accra (-0.19, 5.56) | GH | GH-0001 | nearest across water |
| Addis Ababa (38.75, 9.03) | ET | ET-0001 | on it |
| Ajah (3.57, 6.47) | NG-0001 | NG-0001 | on it |
| Alexandra (28.1, -26.1) | ZA-0001 | ZA-0001 | on it |
| Alimosho (3.26, 6.61) | NG-0004 | NG-0004 | on it |
| Apapa (3.36, 6.45) | NG-0003 | NG-0003 | on it |
| Badagry (2.88, 6.42) | NG-0003 | NG-0003 | on it |
| Bandundu town (17.37, -3.32) | CD-0006,CD-0007 | CD-0006 | on it |
| Berbera (45.01, 10.44) | SO-0010 | SO-0010 | on it |
| Boende (20.88, -0.28) | CD-0009 | CD-0009 | on it |
| Bole (-2.48, 9.03) | GH-0014 | GH-0014 | on it |
| Borama (43.18, 9.94) | SO-0011 | SO-0011 | on it |
| Braamfontein (28.03, -26.19) | ZA-0001 | ZA-0001 | on it |
| Bumba (22.46, 2.19) | CD-0010 | CD-0010 | on it |
| Bunia (30.25, 1.56) | CD-0016 | CD-0016 | on it |
| Burao (45.53, 9.52) | SO-0012 | SO-0012 | on it |
| Buta (24.73, 2.79) | CD-0014 | CD-0014 | on it |
| Conakry (-13.68, 9.54) | GN-0001 | GN-0001 | on it |
| Dakar (-17.45, 14.69) | SN | SN-0001 | nearest across water |
| Dambai (0.18, 8.07) | GH-0009 | GH-0009 | on it |
| Damongo (-1.82, 9.08) | GH-0014 | GH-0014 | on it |
| Dar es Salaam (39.28, -6.8) | TZ | TZ-0001 | on it |
| Djibouti (43.15, 11.59) | DJ | DJ-0001 | nearest across water |
| Eldoret (35.27, 0.52) | KE | KE-0011 | on it |
| Entebbe (32.46, 0.06) | UG-0002 | UG-0002 | on it |
| Erigavo (47.37, 10.62) | SO-0013 | SO-0013 | on it |
| Gbadolite (21.0, 4.28) | CD-0012 | CD-0012 | on it |
| Gemena (19.77, 3.25) | CD-0011 | CD-0011 | on it |
| Goaso (-2.52, 6.8) | GH-0012 | GH-0012 | on it |
| Hargeisa (44.06, 9.56) | SO-0009 | SO-0009 | on it |
| Hargeisa2 (44.06, 9.56) | SO-0009 | SO-0009 | on it |
| Ho (0.47, 6.6) | GH-0008 | GH-0008 | on it |
| Ikeja (3.34, 6.6) | NG-0002 | NG-0002 | on it |
| Ikorodu (3.5, 6.62) | NG-0004 | NG-0004 | on it |
| Ikoyi (3.44, 6.45) | NG-0001 | NG-0001 | nearest across water |
| Inongo (18.27, -1.94) | CD-0007 | CD-0007 | on it |
| Isiro (27.62, 2.77) | CD-0015 | CD-0015 | on it |
| Johannesburg CBD (28.045, -26.205) | ZA-0001 | ZA-0001 | on it |
| Kabinda (24.48, -6.13) | CD-0025 | CD-0025 | on it |
| Kalemie (29.19, -5.95) | CD-0021 | CD-0021 | nearest across water |
| Kamina (25.0, -8.73) | CD-0022 | CD-0022 | on it |
| Kampala (32.58, 0.32) | UG | UG-0001 | on it |
| Kananga (22.42, -5.9) | CD-0028 | CD-0028 | on it |
| Kenge (16.89, -4.81) | CD-0005 | CD-0005 | on it |
| Kikwit (18.82, -5.04) | CD-0006 | CD-0006 | on it |
| Kindia (-12.86, 10.06) | GN-0004 | GN-0004 | on it |
| Kinshasa Gombe (15.31, -4.31) | CD-0001 | CD-0002 | within a pixel |
| Kinshasa Gombe hint (15.31, -4.31) | CD-0001 | CD-0002 | within a pixel |
| Kintampo (-1.73, 8.05) | GH-0011 | GH-0011 | on it |
| Kisangani (25.19, 0.52) | CD-0013 | CD-0013 | on it |
| Kolwezi (25.47, -10.71) | CD-0023 | CD-0023 | on it |
| Krugersdorp (27.77, -26.1) | ZA-0002 | ZA-0002 | on it |
| Kumasi (-1.62, 6.69) | GH-0003 | GH-0003 | on it |
| Lagos Island (3.39, 6.455) | NG-0001 | NG-0003 | within a pixel |
| Las Anod (47.36, 8.48) | SO-0013 | SO-0013 | on it |
| Lekki (3.55, 6.44) | NG-0001 | NG-0001 | nearest across water |
| Lekki Phase1 (3.47, 6.44) | NG-0001 | NG-0001 | nearest across water |
| Likasi (26.73, -10.98) | CD-0024 | CD-0024 | on it |
| Lisala (21.51, 2.15) | CD-0010 | CD-0010 | on it |
| Lodja (23.6, -3.49) | CD-0026 | CD-0026 | on it |
| Luanda (13.23, -8.84) | AO | AO-0001 | on it |
| Lubumbashi (27.48, -11.66) | CD-0024 | CD-0024 | on it |
| Manono (27.42, -7.3) | CD-0021 | CD-0021 | on it |
| Masaka (31.73, -0.33) | UG-0003 | UG-0003 | on it |
| Mbandaka (18.26, 0.05) | CD-0008 | CD-0008 | on it |
| Mbuji-Mayi (23.6, -6.13) | CD-0029 | CD-0029 | on it |
| Melville (28.0, -26.17) | ZA-0001 | ZA-0001 | on it |
| Midrand (28.13, -25.99) | ZA-0001 | ZA-0001 | on it |
| Mombasa (39.67, -4.04) | KE | KE-0004 | nearest across water |
| Mont Ngafula (15.29, -4.45) | CD-0003 | CD-0003 | on it |
| Moroni (43.26, -11.7) | KM | KM-0001 | on it |
| Mwene-Ditu (23.45, -7.0) | CD-0025 | CD-0025 | on it |
| NE Johannesburg point (28.028, -26.168) | ZA-0001 | ZA-0001 | on it |
| Nairobi (36.82, -1.29) | KE | KE-0001 | on it |
| Nalerigu (-0.37, 10.53) | GH-0015 | GH-0015 | on it |
| Ndjili (15.44, -4.39) | CD-0002 | CD-0002 | on it |
| OR Tambo (28.24, -26.13) | ZA-0003 | ZA-0003 | on it |
| Port Louis (57.5, -20.16) | MU | MU-0001 | on it |
| Praia (-23.51, 14.92) | CV | CV-0001 | on it |
| Pretoria (28.19, -25.745) | ZA-0004 | ZA-0004 | on it |
| Randburg (27.99, -26.09) | ZA-0001 | ZA-0001 | on it |
| Rosebank (28.04, -26.146) | ZA-0001 | ZA-0001 | on it |
| Sandton (28.05, -26.107) | ZA-0001 | ZA-0001 | on it |
| Sao Tome (6.73, 0.34) | ST | ST-0001 | nearest across water |
| Sefwi Wiawso (-2.49, 6.21) | GH-0005 | GH-0005 | on it |
| Seychelles Victoria (55.45, -4.62) | SC | SC-0001 | on it |
| Soweto (27.86, -26.26) | ZA-0002 | ZA-0002 | on it |
| Soweto Orlando (27.9, -26.24) | ZA-0002 | ZA-0002 | on it |
| Sunyani (-2.33, 7.34) | GH-0010 | GH-0010 | on it |
| Takoradi (-1.76, 4.9) | GH-0004 | GH-0004 | on it |
| Tamale (-0.84, 9.4) | GH-0013 | GH-0013 | on it |
| Techiman (-1.94, 7.59) | GH-0011 | GH-0011 | on it |
| Tema (0.0, 5.67) | GH-0002 | GH-0002 | on it |
| Tshikapa (20.8, -6.42) | CD-0027 | CD-0027 | on it |
| Victoria Island (3.42, 6.43) | NG-0001 | NG-0001 | nearest across water |
| Walewale (-0.8, 10.35) | GH-0015 | GH-0015 | on it |
| Yendi (-0.01, 9.44) | GH-0013 | GH-0013 | on it |

## Metro reach

Metro provinces whose centroid is over 80 km from their Metro's city, that are over 4 times the Metro's median and 250 px, and regions where Metro provinces hold over 30% of the land beside rural ones (the D612 error). Listed for review; a Metro made of whole metropolitan units can be large by design.

| Check | Province or region | Detail |
|---|---|---|
| large for its Metro | CD-0002 Kinshasa Limete-Ndjili | 394 px, the Metro's median is 63 px (Metro Kinshasa) |
| Metro share of a region | ZAF: Gauteng | Metro provinces hold 77% of 911 px beside 1 rural |

## Land exclaves

Parts of 5 px or more that are not a province's largest part and touch no pixel outside every province (islands are not listed). Each is explained by a place its composite name names lying in it, by one of the province's own seeds (a hint point, or a place its notes name) lying in it, by a neck under a pixel wide that joins it to the rest in the shapes, or by a reason in `[review.exclave_ok]`; an unexplained one fails the step (D691).

| Province | Name | Pixels | At | Why |
|---|---|---|---|---|
| BI-0004 | Muyinga-Rutana | 13 | 30.45, -2.45 | a neck under a pixel wide joins it to the rest in the shapes |
| CD-0003 | Kinshasa South-Mont Ngafula | 21 | 15.31, -4.51 | its own seed point 15.31,-4.4 (hint) lies in it |
| CM-0002 | Mbalmayo-Nanga Eboko | 710 | 11.55, 3.69 | composite name: Mbalmayo lies in it |
| ET-0022 | Assosa-GERD | 6 | 36.44, 9.46 | Benishangul-Gumuz is in parts (the Kamashi zone lies apart; Natural Earth's unit has four) |
| ET-0022 | Assosa-GERD | 16 | 36.11, 8.92 | Benishangul-Gumuz is in parts (the Kamashi zone lies apart; Natural Earth's unit has four) |
| GH-0006 | Cape Coast-Kasoa | 14 | -2.06, 6.16 | a neck under a pixel wide joins it to the rest in the shapes |
| NE-0002 | Agadez | 12 | 11.27, 17.17 | a neck under a pixel wide joins it to the rest in the shapes |
| NG-0004 | Ikorodu-Alimosho | 10 | 3.27, 6.59 | its own seed unit Alimosho lies in it |
| SD-0015 | Kadugli-Nuba | 5 | 29.89, 10.23 | a neck under a pixel wide joins it to the rest in the shapes |
| SD-0015 | Kadugli-Nuba | 14 | 29.59, 10.01 | a neck under a pixel wide joins it to the rest in the shapes |
| SD-0016 | Al Fula-Heglig | 18 | 28.43, 9.34 | a corner of West Kordofan cut off by the Abyei builder box (SD-0017) |
| SD-0019 | Jebel Amer-Kebkabiya | 30 | 24.53, 13.28 | geoBoundaries' North Jebel Marra locality, given with Kebkabiya, touches it only through another province |
| SS-0002 | Yei-Terekeka | 561 | 31.48, 5.57 | its own seed unit Terekeka lies in it |
| TD-0014 | Goz Beida-Biltine | 1636 | 21.41, 12.14 | the region joins Sila (Goz Beida) and Wadi Fira (Biltine), which Ouaddai separates |
| UG-0006 | Mbale-Elgon | 20 | 34.45, 1.33 | a neck under a pixel wide joins it to the rest in the shapes |
| UG-0015 | Kasese-Rwenzori | 50 | 30.05, 0.7 | its own seed unit Bundibugyo lies in it |
| ZA-0013 | Newcastle-Northern KZN | 9 | 31.97, -27.13 | a neck under a pixel wide joins it to the rest in the shapes |
| ZA-0017 | Mthatha-Transkei | 7 | 28.13, -30.55 | a neck under a pixel wide joins it to the rest in the shapes |
| ZM-0009 | Livingstone-Kariba | 484 | 28.24, -16.37 | its own seed unit Siavonga lies in it |
| ZW-0004 | Chimanimani-Chipinge | 252 | 32.74, -17.96 | its own seed unit Nyanga lies in it |

## Known for review

- UGA: our file puts Moroto-Karamoja (UG-0008) in the Eastern region; Uganda counts Karamoja in its Northern region, so the seven Karamoja districts move to Eastern (decision C; design-fixes.md).
- ERI: Natural Earth 10m gives Eritrea's regions each other's names; the regions take the units by where they lie, checked against Asmara, Keren, Mendefera, Massawa, Assab and Barentu (D687).
- KEN: Natural Earth has Kenya's 8 old provinces, so every region is cut from geoBoundaries' 47 counties (KEN ADM1, public domain); Elgeyo-Marakwet and Nandi are drawn with Uasin Gishu-Trans Nzoia and West Pokot with Turkana, since no region names them.
- COD: Natural Earth has the 11 pre-2015 provinces and the geoBoundaries ADM1 file is ODbL, so Bandundu, Equateur, Orientale, Katanga and the two Kasais are split among the 2015 provinces by Voronoi on each province's capital and main towns (builder points). The lines between the new provinces are approximate.
- GHA: likewise Brong Ahafo, Northern, Volta and Western are split among the 2019 regions (Bono, Bono East, Ahafo, Savannah, North East, Oti, Western North) by Voronoi on their towns; geoBoundaries' GHA ADM1 is CC BY-SA.
- CIV: the 14 districts are geoBoundaries ADM1 units (CC BY), replacing Natural Earth's 19 old regions.
- SOM: Natural Earth's single Somaliland unit is split among Woqooyi Galbeed, Awdal, Togdheer and Sanaag-Sool by Voronoi on their towns (SO-0009 to SO-0013, self-declared Somaliland, follow our file); Mudug is split between Nugaal-Mudug North and Galgaduud-Mudug South the same way at Galkayo.
- SDN: SD-0017 Abyei is a builder-drawn box round the Abyei area (Natural Earth puts it in South Kordofan); West Kordofan is split from South Kordofan by Voronoi on its towns (En Nahud stays in North Kordofan).
- SLE:North West (2017) is split from Northern by Voronoi on Port Loko, Lungi, Kambia and Kamakwie.
- TGO:Lome is a builder-drawn box round the capital, cut from Maritime.

## Watched small provinces

The microstates, city-states and metro splits the plan names (P8: Singapore, the London and Beijing splits, Hong Kong and Macau): every one has pixels, and a tiny one a click target at its label point.

| Province | Name | Pixels | Tiny | Label point (px) |
|---|---|---|---|---|
| GM-0001 | Banjul-Serekunda | 8 | Y | 3716.5, 2302.5 |
| GM-0002 | Brikama | 77 | N | 3715.5, 2305.5 |
| GM-0003 | Farafenni-Mansakonko | 151 | N | 3722.5, 2301.5 |
| GM-0004 | Janjanbureh-Basse | 223 | N | 3755.5, 2297.5 |
| CV-0001 | Praia-Santiago | 81 | N | 3557.5, 2263.5 |
| CV-0002 | Mindelo-Sal | 97 | N | 3522.5, 2217.5 |
| ST-0001 | Sao Tome and Principe | 46 | Y | 4246.5, 2603.5 |
| DJ-0001 | Djibouti City | 5 | Y | 5073.5, 2345.5 |
| DJ-0002 | Arta-Ali Sabieh | 159 | N | 5071.5, 2350.5 |
| DJ-0003 | Tadjourah-Obock | 492 | N | 5064.5, 2334.5 |
| DJ-0004 | Dikhil | 294 | N | 5054.5, 2351.5 |
| MU-0001 | Port Louis | 3 | Y | 5404.5, 3074.5 |
| MU-0002 | Ebene-Curepipe | 19 | Y | 5405.5, 3077.5 |
| MU-0003 | Grand Baie-Flacq | 31 | Y | 5407.5, 3073.5 |
| MU-0004 | Mahebourg-Rodrigues | 45 | Y | 5407.5, 3080.5 |
| KM-0001 | Moroni | 45 | Y | 5081.5, 2877.5 |
| KM-0002 | Mutsamudu-Fomboni | 28 | Y | 5107.5, 2888.5 |
| SC-0001 | Seychelles | 17 | Y | 5357.5, 2714.5 |

## Contested provinces

Drawn by our own province files (decision C), not the sources' de facto lines: each contested province sits in the region the CSV gives it, built as listed (an alias or carve hint where Natural Earth draws the land elsewhere). The game hatches them.

| Province | Name | Country | Contested | Region drawn from |
|---|---|---|---|---|
| SD-0017 | Abyei | SDN | SDN and SSD dispute | Abyei Area: no admin-1 match (best unit 50, group 42); carve: builder polygon from SDN:South Kordofan; less SDN:West Kordofan (carve) |
| SO-0009 | Hargeisa | SOM | Somaliland self-declared | Woqooyi Galbeed: alias hint -> SOL+00?; split among SOM:Awdal, SOM:Sanaag-Sool, SOM:Togdheer (builder points) |
| SO-0010 | Berbera | SOM | Somaliland self-declared | Woqooyi Galbeed: alias hint -> SOL+00?; split among SOM:Awdal, SOM:Sanaag-Sool, SOM:Togdheer (builder points) |
| SO-0011 | Borama-Zeila | SOM | Somaliland self-declared | Awdal: no admin-1 match (best unit 55, group 0); Voronoi cell of SOM:Woqooyi Galbeed (builder points) |
| SO-0012 | Burao | SOM | Somaliland self-declared | Togdheer: no admin-1 match (best unit 53, group 0); Voronoi cell of SOM:Woqooyi Galbeed (builder points) |
| SO-0013 | Erigavo-Las Anod | SOM | Somaliland self-declared | Sanaag-Sool: no admin-1 match (best unit 50, group 0); Voronoi cell of SOM:Woqooyi Galbeed (builder points) |

## Region matching

Regions not matched one-to-one by name: builder aliases, Natural Earth region groups, composite names matched part by part, carves (D676) and admin-1 units no region named, given to the touching region (D673). Check these on the preview too.

| Region | Matched by | Units |
|---|---|---|
| BDI: Bujumbura | alias hint -> BI-BM, BI-BL | 2 |
| BDI: East | alias hint -> BI-MY, BI-CA, BI-RY, BI-RT | 4 |
| BDI: Gitega-Muramvya-Mwaro | alias hint -> BI-GI, BI-MU, BI-MW, BI-KR | 4 |
| BDI: North | alias hint -> BI-NG, BI-KY, BI-KI | 3 |
| BDI: Northwest | alias hint -> BI-CI, BI-BB | 2 |
| BDI: South | alias hint -> BI-BR, BI-MA | 2 |
| BEN: Atacora-Donga | alias hint -> BJ-AK, BJ-DO | 2 |
| BEN: Mono-Couffo | alias hint -> BJ-MO, BJ-KO | 2 |
| BEN: Oueme-Plateau | name parts (2 pieces, worst match 100) | 2 |
| BFA: Boucle du Mouhoun | Natural Earth region Boucle du Mouhoun (6 units, match 100) | 6 |
| BFA: Cascades | Natural Earth region Cascades (2 units, match 100) | 2 |
| BFA: Centre | Natural Earth region Centre (1 units, match 100) | 1 |
| BFA: Centre-Est | Natural Earth region Centre-Est (3 units, match 100) | 3 |
| BFA: Centre-Nord | Natural Earth region Centre-Nord (3 units, match 100) | 3 |
| BFA: Centre-Ouest | Natural Earth region Centre-Ouest (4 units, match 100) | 4 |
| BFA: Est | Natural Earth region Est (5 units, match 100) | 5 |
| BFA: Hauts-Bassins | Natural Earth region Hauts-Bassins (3 units, match 100) | 3 |
| BFA: Nord | Natural Earth region Nord (4 units, match 100) | 4 |
| BFA: Plateau-Central-Centre-Sud | name parts (2 pieces, worst match 100) | 6 |
| BFA: Sahel | Natural Earth region Sahel (4 units, match 100) | 4 |
| BFA: Sud-Ouest | Natural Earth region Sud-Ouest (4 units, match 100) | 4 |
| BWA: Central | name match 100; plus unclaimed Selebi-Phikwe, Sowa | 3 |
| BWA: Kweneng-Kgatleng | name parts (2 pieces, worst match 100) | 2 |
| BWA: North-East | name match 100; plus unclaimed Francistown | 2 |
| BWA: North-West-Chobe | alias hint -> BW-NW | 1 |
| BWA: South-East | name match 100; plus unclaimed Gaborone | 2 |
| BWA: Southern | alias hint -> BW-SO, BW-JW, BW-LO | 3 |
| CAF: Basse-Kotto-Mbomou | name parts (2 pieces, worst match 100) | 2 |
| CAF: Kemo-Ouaka-Nana-Grebizi | name parts (3 pieces, worst match 100) | 3 |
| CAF: Nana-Mambere-Ouham-Pende | name parts (2 pieces, worst match 100) | 2 |
| CAF: Ombella-MPoko-Lobaye | name parts (2 pieces, worst match 100) | 2 |
| CAF: Sangha-Mambere-Kadei | name parts (2 pieces, worst match 100) | 2 |
| CAF: Vakaga-Bamingui-Bangoran | name parts (2 pieces, worst match 100) | 2 |
| COD: Equateur | alias hint -> CD-EQ; split among COD:Mongala, COD:Nord-Ubangi, COD:Sud-Ubangi, COD:Tshuapa (builder points) | 1 |
| COD: Haut-Katanga | alias hint -> CD-KA; split among COD:Haut-Lomami, COD:Lualaba, COD:Tanganyika (builder points) | 1 |
| COD: Kasai | alias hint -> CD-KW; split among COD:Kasai-Central (builder points) | 1 |
| COD: Kasai-Oriental | alias hint -> CD-KE; split among COD:Lomami, COD:Sankuru (builder points) | 1 |
| COD: Kwilu | alias hint -> CD-BN; split among COD:Kwango, COD:Mai-Ndombe (builder points) | 1 |
| COD: Tshopo | alias hint -> CD-OR; split among COD:Bas-Uele, COD:Haut-Uele, COD:Ituri (builder points) | 1 |
| COG: Bouenza-Lekoumou | name parts (2 pieces, worst match 100) | 2 |
| COG: Kouilou-Niari | name parts (2 pieces, worst match 100) | 2 |
| COM: Anjouan-Moheli | name parts (2 pieces, worst match 100) | 2 |
| CPV: Barlavento | alias hint -> region:Ilhas de Barlavento | 8 |
| CPV: Sotavento | alias hint -> region:Ilhas de Sotavento | 14 |
| DJI: Arta-Ali Sabieh | name parts (2 pieces, worst match 100) | 2 |
| DJI: Tadjourah-Obock | name parts (2 pieces, worst match 100) | 2 |
| ERI: Anseba | alias hint -> ER-SK | 1 |
| ERI: Debub | alias hint -> ER-MA | 1 |
| ERI: Gash-Barka | alias hint -> ER-GB | 1 |
| ERI: Maekel | alias hint -> ER-AN | 1 |
| ERI: Northern Red Sea | alias hint -> ER-DU | 1 |
| ERI: Southern Red Sea | alias hint -> ER-DK | 1 |
| ETH: Addis Ababa | alias hint -> ET-AA | 1 |
| ETH: Oromia | alias hint -> ET-OR | 1 |
| ETH: SNNPR | alias hint -> ET-SN | 1 |
| GHA: Bono | alias hint -> GH-BA; split among GHA:Ahafo, GHA:Bono East (builder points) | 1 |
| GIN: Boke | Natural Earth region Boke (5 units, match 100) | 5 |
| GIN: Faranah | Natural Earth region Faranah (4 units, match 100) | 4 |
| GIN: Kankan | Natural Earth region Kankan (5 units, match 100) | 5 |
| GIN: Kindia | Natural Earth region Kindia (5 units, match 100) | 5 |
| GIN: Labe | Natural Earth region Labé (5 units, match 100) | 5 |
| GIN: Mamou | Natural Earth region Mamou (3 units, match 100) | 3 |
| GIN: Nzerekore | Natural Earth region Nzérékoré (6 units, match 100) | 6 |
| GMB: Banjul-Kanifing | alias hint -> GM-B | 1 |
| GMB: Central-Upper River | alias hint -> GM-M, GM-U | 2 |
| GMB: North Bank-Lower River | alias hint -> GM-N, GM-L | 2 |
| GNB: Bafata-Gabu | alias hint -> region:Leste | 2 |
| GNB: Bissau | alias hint -> GW-BS | 1 |
| GNB: Cacheu-Oio-Biombo | alias hint -> region:Norte | 3 |
| GNB: South and Bijagos | alias hint -> region:Sul | 3 |
| GNQ: Bioko | alias hint -> GQ-BN, GQ-BS | 2 |
| GNQ: Centro Sur-Djibloho | alias hint -> GQ-CS | 1 |
| GNQ: Kie-Ntem-Wele-Nzas | alias hint -> GQ-KN, GQ-WN | 2 |
| LBR: Grand Bassa-Rivercess | name parts (2 pieces, worst match 100) | 2 |
| LBR: Lofa-Gbarpolu-Cape Mount | alias hint -> LR-LO, LR-X1~, LR-CM | 3 |
| LBR: Margibi-Bomi | name parts (2 pieces, worst match 100) | 2 |
| LBR: Nimba-Bong | name parts (2 pieces, worst match 100) | 2 |
| LBR: South East | alias hint -> LR-GG, LR-GK, LR-MY, LR-X2~, LR-SI | 5 |
| LSO: Highlands | alias hint -> LS-J, LS-K | 2 |
| LSO: Maseru | alias hint -> LS-A | 1 |
| LSO: Northern Lowlands | alias hint -> LS-C, LS-D, LS-B | 3 |
| LSO: Southern Lowlands | alias hint -> LS-E, LS-F, LS-G, LS-H | 4 |
| MDG: Anosy-Androy | name parts (2 pieces, worst match 100) | 2 |
| MDG: Betsiboka-Melaky | name parts (2 pieces, worst match 100) | 2 |
| MDG: Haute Matsiatra-Amoron'i Mania | name parts (2 pieces, worst match 100) | 2 |
| MDG: Itasy-Bongolava | name parts (2 pieces, worst match 100) | 2 |
| MDG: Sofia-Boeny | name parts (2 pieces, worst match 100) | 2 |
| MDG: South-East | alias hint -> MDG-5882, MDG-5867, MDG-5874 | 3 |
| MLI: Gao-Menaka | alias hint -> ML-7 | 1 |
| MLI: Tombouctou-Taoudenit | alias hint -> ML-6 | 1 |
| MOZ: Maputo City | alias hint -> MOZ-5854 | 1 |
| MOZ: Maputo Province | alias hint -> MOZ-1927 | 1 |
| MUS: North and East | alias hint -> MU-PA, MU-RR, MU-FL | 3 |
| MUS: Plaines Wilhems-Moka | alias hint -> MU-PW, MU-MO, MU-CU, MU-QB, MU-VP, MU-BR | 6 |
| MUS: Port Louis | alias hint -> MUS-5189, MUS-5190 | 2 |
| MUS: South, West and Outer Islands | alias hint -> MU-GP, MU-SA, MU-BL, MU-RO, MU-AG | 5 |
| MWI: Central | Natural Earth region Central (9 units, match 100) | 9 |
| MWI: Northern | Natural Earth region Northern (4 units, match 100); plus unclaimed Chitipa, Chitipa | 6 |
| MWI: Southern | Natural Earth region Southern (12 units, match 100); plus unclaimed Machinga | 13 |
| NAM: Ohangwena-Oshikoto | name parts (2 pieces, worst match 100) | 2 |
| NAM: Omusati-Oshana | name parts (2 pieces, worst match 100) | 2 |
| NAM: Otjozondjupa-Omaheke | name parts (2 pieces, worst match 100) | 2 |
| SDN: Abyei Area | no admin-1 match (best unit 50, group 42); carve: builder polygon from SDN:South Kordofan; less SDN:West Kordofan (carve) | 0 |
| SDN: Blue Nile | Natural Earth region Blue Nile (4 units, match 100) | 1 |
| SDN: Central Darfur | alias hint -> SD-DE | 1 |
| SDN: East Darfur | alias hint -> SDN-5857; less SDN:West Kordofan (carve) | 1 |
| SDN: Kassala | Natural Earth region Kassala (3 units, match 100) | 1 |
| SDN: North Darfur | name match 100; less SDN:West Kordofan (carve) | 1 |
| SDN: North Kordofan | name match 100; less SDN:West Kordofan (carve) | 1 |
| SDN: Northern | Natural Earth region Northern (2 units, match 100) | 1 |
| SDN: South Darfur | alias hint -> SDN-5856 | 1 |
| SDN: South Kordofan | name match 100; less SDN:Abyei Area (carve); less SDN:West Kordofan (carve); split among SDN:West Kordofan (builder points) | 1 |
| SDN: West Darfur | alias hint -> SD-DW | 1 |
| SDN: West Kordofan | geoBoundaries ADM1 West Kordofan; carve: SDN units West Kordofan from SDN:Abyei Area, SDN:East Darfur, SDN:North Darfur, SDN:North Kordofan, SDN:South Kordofan; Voronoi cell of SDN:South Kordofan (builder points) | 0 |
| SEN: Casamance | alias hint -> SN-ZG, SN-KD, SN-SE | 3 |
| SEN: Kaolack-Kaffrine | alias hint -> SN-KL, SN-KA | 2 |
| SEN: Kedougou | alias hint -> SN-KE | 1 |
| SEN: Matam | alias hint -> SN-MT | 1 |
| SEN: Saint-Louis | alias hint -> SN-SL | 1 |
| SEN: Tambacounda | alias hint -> SN-TC | 1 |
| SOM: Bay-Bakool | alias hint -> SO-BY, SO-BK | 2 |
| SOM: Galgaduud-Mudug South | alias hint -> SO-GA; Voronoi cell of SOM:Nugaal-Mudug North (builder points) | 1 |
| SOM: Hiran-Middle Shabelle | alias hint -> SO-HI, SO-SD | 2 |
| SOM: Lower Juba-Middle Juba-Gedo | name parts (3 pieces, worst match 100) | 3 |
| SOM: Nugaal-Mudug North | alias hint -> SO-NU, SO-MU; split among SOM:Galgaduud-Mudug South (builder points) | 2 |
| SOM: Woqooyi Galbeed | alias hint -> SOL+00?; split among SOM:Awdal, SOM:Sanaag-Sool, SOM:Togdheer (builder points) | 1 |
| SSD: Upper Nile | Natural Earth region Upper Nile (3 units, match 100) | 1 |
| TCD: Borkou-Tibesti | name parts (2 pieces, worst match 100) | 2 |
| TCD: Guera-Salamat | name parts (2 pieces, worst match 100) | 2 |
| TCD: Kanem-Bahr el Gazel | name parts (2 pieces, worst match 100) | 2 |
| TCD: Mandoul-Moyen-Chari | alias hint -> TD-MA, TD-MC | 2 |
| TCD: Mayo-Kebbi | alias hint -> TD-ME, TD-MO | 2 |
| TCD: Ouaddai | alias hint -> TD-OD | 1 |
| TCD: Sila-Wadi Fira | name parts (2 pieces, worst match 100) | 2 |
| TGO: Lome | no admin-1 match (best unit 33, group 0); carve: builder polygon from TGO:Maritime | 0 |
| TGO: Maritime | name match 100; less TGO:Lome (carve) | 1 |
| TZA: Dodoma-Singida | name parts (2 pieces, worst match 100) | 2 |
| TZA: Iringa-Njombe | alias hint -> TZ-04, TZ-29 | 2 |
| TZA: Katavi-Rukwa | alias hint -> TZ-28, TZ-20 | 2 |
| TZA: Lindi-Mtwara | name parts (2 pieces, worst match 100) | 2 |
| TZA: Mbeya-Songwe | alias hint -> TZ-14 | 1 |
| TZA: Pemba | alias hint -> TZ-06, TZ-10 | 2 |
| TZA: Shinyanga-Simiyu | alias hint -> TZ-22, TZ-30 | 2 |
| TZA: Zanzibar Unguja | alias hint -> TZ-07, TZ-11, TZ-15 | 3 |
| UGA: Central | Natural Earth region Central (24 units, match 100) | 23 |
| UGA: Eastern | alias hint -> region:Eastern, UG-315, UG-306, UG-317, UG-308, UG-328, UG-311, UG-324 | 39 |
| UGA: Northern | alias hint -> region:Northern, -UG-315, -UG-306, -UG-317, -UG-308, -UG-328, -UG-311, -UG-324 | 23 |
| UGA: Western | Natural Earth region Western (26 units, match 100) | 26 |
| ZMB: Muchinga | alias hint -> ZM-10 | 1 |
| ZMB: Northern | alias hint -> ZM-05 | 1 |

## Land without a province

Natural Earth admin-1 units of this file's countries that no region claims and that touch no region of their country (overseas territories, remote islands). They stay water on the map.

None.

## Sea links

`sea` rows of province-adjacency.csv with a province of this file: coastal provinces whose shapes do not touch but face each other across a strait (D678).

CM-0005-GQ-0001, DJ-0003-YE-0008, ER-0006-YE-0005, ER-0006-YE-0008, GM-0001-SN-0005, GW-0001-GW-0004, KE-0005-TZ-0023, KM-0001-KM-0002, TZ-0001-TZ-0022, TZ-0002-TZ-0022, TZ-0003-TZ-0022, TZ-0005-TZ-0022, TZ-0022-TZ-0023

## Small provinces

| Province | Name | Region | Pixels | Region mean |
|---|---|---|---|---|
| BW-0005 | Selebi-Phikwe | Central | 1 | 2306 |
| SD-0010 | Port Sudan | Red Sea | 114 | 4644 |
| SD-0019 | Jebel Amer-Kebkabiya | North Darfur | 307 | 6538 |
| ZA-0015 | Nelson Mandela Bay | Eastern Cape | 108 | 2327 |
| ZW-0006 | Ngezi-Selous | Mashonaland West | 4 | 1296 |

## Uneven Voronoi splits

Blocks (ADM2 units, or admin-1 units for Greenland) that several provinces share, where one province takes most of the block. Check that the larger part belongs where it went.

| Region | Block | Shares |
|---|---|---|
| COD:Kinshasa | Kinshasa | CD-0002 83%, CD-0003 15%, CD-0001 2% |
| TGO:Plateaux | part-0 | TG-0003 76%, TG-0004 24% |
| ZAF:Northern Cape | Z F Mgcawu | ZA-0032 82%, ZA-0031 18% |

## Named places outside their province

None.

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| BJ-0001 | Cotonou | 2 | N | Y |
| CG-0002 | Pointe-Noire | 3 | N | Y |
| CI-0007 | Gagnoa-Divo | 6 | Y | N |
| CM-0006 | Kumba-Mamfe | 47 | Y | N |
| GM-0003 | Farafenni-Mansakonko | 53 | Y | N |
| GN-0001 | Conakry | 3 | N | Y |
| GN-0004 | Kindia-Debele | 27 | Y | N |
| GW-0003 | Bafata-Gabu | 5 | Y | N |
| MR-0003 | Akjoujt-Tasiast | 23 | Y | N |
| MU-0001 | Port Louis | 1 | N | Y |
| MZ-0006 | Gorongosa-Caia | 18 | Y | N |
| MZ-0011 | Mocuba-Gurue | 50 | Y | N |
| MZ-0012 | Nampula | 23 | Y | N |
| NA-0005 | Mariental | 47 | Y | N |
| NA-0007 | Opuwo-Kunene | 137 | Y | N |
| NG-0002 | Ikeja-Mainland | 4 | Y | N |
| NG-0004 | Ikorodu-Alimosho | 18 | Y | N |
| NG-0005 | Abeokuta-Ota | 7 | Y | N |
| SN-0007 | Louga | 13 | Y | N |
| SO-0009 | Hargeisa | 7 | Y | N |
| ZA-0018 | Queenstown-Karoo | 85 | Y | N |
| ZA-0032 | Upington-Namakwa | 93 | Y | N |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

KE-0003 (25), NE-0002 (20), SD-0014 (18), GW-0004 (11), SC-0001 (7), UG-0002 (7), UG-0003 (7), CV-0002 (6), TZ-0012 (6), ER-0005 (5), GA-0002 (5), KE-0004 (5), KE-0006 (5), MR-0002 (5), UG-0006 (5), AO-0003 (4), AO-0011 (4), CI-0003 (4), CI-0004 (4), CV-0001 (4), ET-0022 (4), MG-0008 (4), MG-0009 (4), ML-0005 (4), MU-0004 (4), SD-0015 (4), TG-0004 (4), TZ-0015 (4), ZA-0009 (4), ZA-0018 (4), ZA-0028 (4), BI-0004 (3), GH-0006 (3), KE-0002 (3), KE-0018 (3), MG-0006 (3), MZ-0004 (3), NE-0003 (3), NE-0009 (3), NG-0001 (3), NG-0004 (3), NG-0014 (3), SD-0011 (3), SD-0023 (3), SS-0002 (3), TZ-0003 (3), ZM-0009 (3), ZM-0010 (3), AO-0002 (2), AO-0020 (2), BF-0010 (2), BJ-0004 (2), BW-0006 (2), BW-0007 (2), CD-0002 (2), CD-0003 (2), CD-0016 (2), CD-0017 (2), CF-0003 (2), CF-0004 (2), CF-0009 (2), CG-0003 (2), CI-0002 (2), CI-0007 (2), CI-0008 (2), CI-0013 (2), CM-0002 (2), CM-0004 (2), CM-0005 (2), CM-0006 (2), ET-0020 (2), ET-0027 (2), GA-0003 (2), GH-0004 (2), GH-0011 (2), GH-0015 (2), GN-0002 (2), GN-0003 (2), GN-0007 (2), GN-0008 (2), GN-0012 (2), GQ-0002 (2), KE-0007 (2), KE-0010 (2), KE-0014 (2), KE-0021 (2), KM-0002 (2), LR-0002 (2), ML-0003 (2), ML-0006 (2), ML-0007 (2), MR-0008 (2), MW-0002 (2), MW-0008 (2), MW-0009 (2), MZ-0002 (2), MZ-0015 (2), NA-0008 (2), NE-0016 (2), NE-0017 (2), NG-0003 (2), NG-0027 (2), SD-0016 (2), SD-0019 (2), SL-0001 (2), SL-0004 (2), SL-0005 (2), SN-0006 (2), SN-0011 (2), SO-0001 (2), SO-0007 (2), SO-0009 (2), ST-0001 (2), TD-0009 (2), TD-0011 (2), TD-0014 (2), TG-0002 (2), TG-0007 (2), TZ-0007 (2), TZ-0008 (2), TZ-0013 (2), TZ-0018 (2), TZ-0021 (2), TZ-0022 (2), TZ-0023 (2), UG-0004 (2), UG-0005 (2), UG-0007 (2), UG-0008 (2), UG-0015 (2), UG-0016 (2), ZA-0002 (2), ZA-0006 (2), ZA-0008 (2), ZA-0013 (2), ZA-0016 (2), ZA-0017 (2), ZA-0022 (2), ZA-0024 (2), ZA-0029 (2), ZA-0031 (2), ZA-0032 (2), ZM-0003 (2), ZM-0012 (2), ZW-0004 (2), ZW-0012 (2)

## Visual check

`preview-sub-saharan-africa.png` in this folder is province-ids.png around the region (pixels x 3297..5671, y 1798..3661, scaled by 1.01).
