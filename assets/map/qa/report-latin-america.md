# Map QA report: latin-america

_Written by `tools/map-pipeline/run.py --region latin-america` (pipeline pb-1). Source of the rows: `provinces-latin-america.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 392 provinces of `provinces-latin-america.csv` have a crosswalk row and pixels (42 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 392 |
| ... ARG | 35 |
| ... ATG | 1 |
| ... BHS | 4 |
| ... BLZ | 3 |
| ... BOL | 17 |
| ... BRA | 67 |
| ... BRB | 1 |
| ... CHL | 22 |
| ... COL | 29 |
| ... CRI | 9 |
| ... CUB | 13 |
| ... CYM | 1 |
| ... DMA | 1 |
| ... DOM | 11 |
| ... ECU | 15 |
| ... GRD | 1 |
| ... GTM | 13 |
| ... GUY | 6 |
| ... HND | 10 |
| ... HTI | 7 |
| ... JAM | 5 |
| ... KNA | 1 |
| ... LCA | 1 |
| ... NIC | 8 |
| ... PAN | 10 |
| ... PAP | 1 |
| ... PER | 27 |
| ... PRI | 9 |
| ... PRY | 12 |
| ... SLV | 7 |
| ... SUR | 6 |
| ... TTO | 5 |
| ... URY | 10 |
| ... VCT | 1 |
| ... VEN | 22 |
| ... VGB | 1 |
| Regions matched | 308 of 308 |
| Provinces by method: admin1 | 269 |
| Provinces by method: admin2 | 95 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 28 |
| Flagged for review (confidence < 0.6) | 0 |
| Placed by a builder hint (`hints/latin-america.toml`) | 17 |
| Tiny (under 64 px) | 42 |
| Given a pixel at their interior point (no pixel centre inside) | 0 |
| More than one part (islands, exclaves) | 141 |
| Coastal flag differs from the CSV | 24 |
| Small for their region (not Metro, under 5% of the region's mean) | 0 |
| Voronoi-split blocks where one province takes 75% or more | 7 |
| Places named in a province's name or notes that lie in another province | 2 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 7 |
| Admin-1 units left without a province | 0 |
| Sea links with a province of this file | 19 |
| City probe points (fail on a mismatch; D686) | 58 pass, 0 mismatch, 7 listed |
| Metro reach scan rows (listed; D686) | 1 |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) | 1 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes) | Public domain | yes |
| geoBoundaries gbOpen ARG ADM2 (Instituto Geografico Nacional and UNHCR, OCHA ROLAC) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen BOL ADM2 (GeoBolivia, Derived from ADM3 layer) | Public Domain | yes |
| geoBoundaries gbOpen BRA ADM2 (Instituto Brasileiro de Geografia e Estatística (IBGE), OCHA ROLAC) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen CHL ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen COL ADM2 (Departamento Administrativo Nacional de Estadistica) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen CRI ADM2 (geoBoundaries, Wikimedia Commons) | CC0 1.0 Universal (CC0 1.0) Public Domain Dedication | yes |
| geoBoundaries gbOpen DOM ADM2 (Caribbean GeoPortal, N/A) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen PER ADM2 (Instituto Geográfico Nacional - IGN, OCHA ROLAC) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen PRI ADM2 (United States Census Bureau, MAF/TIGER) | Public Domain | yes |
| geoBoundaries gbOpen VEN ADM2 (Efrain Porto Tapiquen Geografia, SIG y Estudios Ambientales) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |

Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, public domain and the attribution-only government licences OGL-Canada 2.0, OGL-UK 3.0, Data licence Germany Attribution 2.0, Etalab 2.0, Spain's INE licence, Singapore ODL 1.0 and Korea OGL Type 1 (D685); a region whose country has no allowed ADM2 is split by Voronoi.

Provenance to check (for Logan; these files pass the allowlist and are used):

- CRI ADM2: public domain or CC0, but geoBoundaries names Wikimedia as the source (Wikimedia maps are often CC BY-SA)

## Low-confidence rows for review

None.

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| BO-0002 | Altiplano-Lake Titicaca | seeds: point -68.68,-16.05 (hint); point -69.04,-16.57 (hint) (snapped to land); point -69.09,-16.17 (hint); point -69.25,-15.5 (hint); 11 whole admin2 units |
| BO-0013 | Chuquisaca Chaco | seeds: point -63.73,-19.87 (hint); point -63.96,-19.8 (hint); 6 whole admin2 units |
| BR-0001 | Sao Paulo Centro-Faria Lima | seeds: point -46.63,-23.55 (hint); point -46.66,-23.56 (hint); point -46.69,-23.57 (hint); point -46.7,-23.565 (hint); point -46.73,-23.58 (hint); unit Barueri (hint); unit Osasco (hint); 9 whole admin2 units, split: São Paulo |
| BR-0002 | Sao Paulo Zona Leste-Guarulhos | seeds: point -46.4,-23.55 (hint); point -46.47,-23.54 (hint); point -46.56,-23.52 (hint); point -46.62,-23.48 (hint); unit Guarulhos (hint); 10 whole admin2 units, split: São Paulo |
| BR-0003 | ABC Paulista-Zona Sul | seeds: place Santo André; point -46.7,-23.65 (hint); point -46.7,-23.82 (hint); unit Diadema; unit Santo André at place Santo André; 13 whole admin2 units, split: São Paulo |
| BR-0010 | Rio Centro-Zona Sul | seeds: point -43.18,-22.91 (hint); point -43.19,-22.97 (hint); point -43.23,-22.9 (hint); 0 whole admin2 units, split: Rio de Janeiro |
| BR-0011 | Barra-Zona Oeste | seeds: point -43.36,-22.94 (hint); point -43.37,-23.0 (hint); point -43.47,-22.88 (hint); point -43.69,-22.92 (hint); 2 whole admin2 units, split: Rio de Janeiro |
| CL-0010 | Santiago Poniente-Sur | seeds: point -70.58,-33.61 (hint); point -70.59,-33.52 (hint); point -70.73,-33.36 (hint); point -70.76,-33.51 (hint); point -70.79,-33.39 (hint); 0 whole parts, 1 split |
| CL-0011 | Maipo-Melipilla | seeds: point -70.74,-33.73 (hint); point -70.93,-33.66 (hint); point -71.22,-33.69 (hint); 0 whole parts, 1 split |
| CL-0020 | Chiloe-Palena | seeds: point -71.8,-43.62 (hint); point -72.71,-42.92 (hint); point -73.77,-42.48 (hint) (snapped to land); point -73.82,-41.87 (hint); 9 whole parts, 1 split |
| CO-0001 | Bogota Chapinero-Norte | seeds: point -74.03,4.7 (hint); point -74.06,4.65 (hint); point -74.08,4.6 (hint); 0 whole admin2 units, split: Bogotá, D.c. |
| CO-0002 | Bogota Sur-Occidente | seeds: point -74.14,4.68 (hint); point -74.14,4.7 (hint); point -74.15,4.63 (hint); point -74.16,4.51 (hint); point -74.19,4.62 (hint); 0 whole admin2 units, split: Bogotá, D.c. |
| CR-0001 | San Jose Centro | seeds: point -84.08,9.93 (hint); 10 whole admin2 units |
| PE-0001 | Lima Centro-San Isidro | seeds: point -77.03,-12.05 (hint); point -77.03,-12.1 (hint); point -77.03,-12.12 (hint); 0 whole admin2 units, split: Lima |
| PE-0002 | Lima Norte-Este | seeds: point -76.89,-12.03 (hint); point -77.0,-11.98 (hint); point -77.06,-11.94 (hint); point -77.07,-11.99 (hint); 1 whole admin2 units, split: Lima |
| PE-0003 | Lima Provinces-Huacho | seeds: point -75.91,-12.46 (hint); point -76.38,-11.84 (hint); point -76.39,-13.08 (hint); point -77.21,-11.5 (hint); point -77.27,-11.57 (hint); point -77.61,-11.11 (hint); 9 whole admin2 units |
| VE-0012 | Arco Minero | seeds: point -61.11,4.6 (hint); point -61.83,7.35 (hint); point -62.85,6.24 (hint); 0 whole parts, 1 split; dropped (over SNAP_MAX_DEG off the region): point -61.14,6.05 (hint) |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| PE-0004 | Callao | 2 | 2 | 2340.5, 2885.5 |
| CO-0029 | San Andres | 3 | 2 | 2236.5, 2322.5 |
| SR-0001 | Paramaribo | 7 | 1 | 2840.5, 2476.5 |
| PR-0001 | San Juan | 8 | 1 | 2591.5, 2185.5 |
| VG-0001 | British Virgin Islands | 8 | 6 | 2631.5, 2178.5 |
| PY-0001 | Asuncion | 9 | 1 | 2785.5, 3197.5 |
| BS-0001 | Nassau | 11 | 1 | 2332.5, 2027.5 |
| BR-0010 | Rio Centro-Zona Sul | 12 | 1 | 3111.5, 3139.5 |
| CO-0001 | Bogota Chapinero-Norte | 13 | 1 | 2410.5, 2505.5 |
| KN-0001 | Saint Kitts and Nevis | 13 | 4 | 2666.5, 2209.5 |
| KY-0001 | Cayman Islands | 13 | 5 | 2244.5, 2164.5 |
| GD-0001 | Grenada | 14 | 2 | 2692.5, 2332.5 |
| TT-0001 | Port of Spain | 14 | 2 | 2696.5, 2365.5 |
| TT-0005 | Tobago | 14 | 2 | 2715.5, 2352.5 |
| VC-0001 | Saint Vincent and the Grenadines | 15 | 3 | 2703.5, 2306.5 |
| VE-0001 | Caracas | 16 | 1 | 2571.5, 2370.5 |
| BB-0001 | Barbados | 17 | 1 | 2740.5, 2308.5 |
| AG-0001 | Antigua and Barbuda | 20 | 2 | 2689.5, 2217.5 |
| JM-0001 | Kingston | 20 | 1 | 2348.5, 2194.5 |
| AR-0001 | Buenos Aires Centro-Puerto Madero | 21 | 1 | 2766.5, 3430.5 |
| PR-0002 | Bayamon-Toa Baja | 21 | 1 | 2589.5, 2186.5 |
| PE-0001 | Lima Centro-San Isidro | 23 | 2 | 2343.5, 2885.5 |
| PR-0008 | Humacao-Southeast | 25 | 1 | 2599.5, 2190.5 |
| LC-0001 | Saint Lucia | 26 | 1 | 2708.5, 2290.5 |
| PR-0004 | Caguas-Central East | 31 | 1 | 2593.5, 2190.5 |
| UY-0001 | Montevideo | 31 | 1 | 2817.5, 3435.5 |
| TT-0003 | Point Lisas | 32 | 1 | 2700.5, 2371.5 |
| CU-0001 | Havana | 33 | 1 | 2222.5, 2075.5 |
| DM-0001 | Dominica | 33 | 1 | 2699.5, 2254.5 |
| SV-0001 | San Salvador | 37 | 1 | 2067.5, 2295.5 |
| PR-0003 | Carolina-Northeast | 43 | 3 | 2596.5, 2187.5 |
| VE-0020 | Margarita Island | 46 | 3 | 2641.5, 2357.5 |
| JM-0002 | Spanish Town-Portmore | 52 | 1 | 2343.5, 2193.5 |
| BR-0004 | Santos-Baixada Santista | 53 | 2 | 3045.5, 3161.5 |
| CL-0009 | Santiago Oriente-Sanhattan | 53 | 1 | 2494.5, 3395.5 |
| VE-0003 | La Guaira | 54 | 1 | 2564.5, 2370.5 |
| BS-0002 | Freeport | 55 | 2 | 2309.5, 1988.5 |
| CR-0003 | Alajuela-Airport Free Zones | 57 | 1 | 2177.5, 2379.5 |
| SV-0004 | Sonsonate-Acajutla | 58 | 1 | 2055.5, 2296.5 |
| CO-0002 | Bogota Sur-Occidente | 59 | 1 | 2407.5, 2515.5 |
| DO-0001 | Santo Domingo | 62 | 3 | 2503.5, 2182.5 |
| PR-0005 | Arecibo-North Coast | 63 | 2 | 2585.5, 2186.5 |

## Anchor cities

Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own name names lands on that province (and, for a Metro province, near its middle and in its largest 4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a province of that Metro, and each key city lands on one of its provinces (key-cities.csv).

| Check | Province | Place | Expected | Got |
|---|---|---|---|---|
| own name elsewhere (allowed) | BR-0032 | Caxias | BR-0032 (Caxias do Sul; the Caxias point is the town in Maranhao) | BR-0049 |

No misses; the rows above are allowed: a city part across a narrow strait, or a city whose own pixel a neighbour took while its province holds a touching pixel.

## Natural Earth labels

Natural Earth units whose capital another region of the country names (in a province name or notes) while their own region does not: the sign of NE giving units each other's names, as in Eritrea and Guyana (D687). Each row fails the step unless `[review] ne_label_ok` in the hints names the region.

| Region | NE unit | Capital | Named by |
|---|---|---|---|
| COL:Meta (checked) | Meta (COL-1425) | San José del Guaviare | COL:Amazonas-Guainia-Guaviare-Vaupes-Vichada |
| VEN:Distrito Capital (checked) | Distrito Capital (VEN-43) | Los Teques | VEN:Miranda |

## City probe

Points of `tools/map-pipeline/checks/city-points.txt` whose expected province is in this file, looked up in province-index.png: a point passes on its pixel or one of the 8 around it (D686). The step fails on a mismatch.

| Point | Expected | Got | Result |
|---|---|---|---|
| Campinas (-47.06, -22.9) | ? | BR-0005 | listed |
| La Plata (-57.95, -34.92) | ? | AR-0005 | listed |
| Pachacamac (-76.86, -12.23) | ? | PE-0002 | listed |
| Paulo de Faria (-49.4, -20.03) | ? | BR-0009 | listed |
| Sao Jose do Rio Preto (-49.38, -20.81) | ? | BR-0009 | listed |
| Villa El Salvador (-76.94, -12.21) | ? | PE-0001 | listed |
| Zipaquira (-74.0, 5.02) | ? | CO-0004 | listed |
| Antigua (-61.84, 17.12) | AG | AG-0001 | on it |
| Ate (-76.92, -12.03) | PE-0002 | PE-0002 | on it |
| Avellaneda (-58.36, -34.66) | AR-0004 | AR-0001 | within a pixel |
| Barbados (-59.6, 13.1) | BB | BB-0001 | on it |
| Barra da Tijuca (-43.37, -23.0) | BR-0011 | BR-0011 | on it |
| Barueri (-46.88, -23.51) | BR-0001 | BR-0001 | on it |
| Basseterre (-62.72, 17.3) | KN | KN-0001 | nearest across water |
| Belmopan (-88.77, 17.25) | BZ-0002 | BZ-0002 | on it |
| Bogota Chapinero (-74.06, 4.65) | CO-0001 | CO-0001 | on it |
| Callao (-77.13, -12.06) | PE-0004 | PE-0004 | on it |
| Canete (-76.39, -13.08) | PE-0003 | PE-0003 | on it |
| Caracas (-66.9, 10.49) | VE | VE-0001 | on it |
| Casa Rosada (-58.37, -34.608) | AR-0001 | AR-0001 | on it |
| Castries (-60.98, 14.01) | LC | LC-0001 | on it |
| Chia (-74.06, 4.86) | CO-0003 | CO-0003 | on it |
| Chosica (-76.69, -11.94) | PE-0002 | PE-0002 | on it |
| Comas (-77.05, -11.94) | PE-0002 | PE-0002 | on it |
| Copacabana (-43.19, -22.97) | BR-0010 | BR-0010 | on it |
| Duque de Caxias (-43.31, -22.79) | BR-0012 | BR-0012 | on it |
| El Dorado (-74.14, 4.7) | CO-0002 | CO-0002 | on it |
| Essequibo Anna Regina (-58.49, 7.26) | GY-0002 | GY-0002 | nearest across water |
| Ezeiza (-58.54, -34.82) | AR-0004 | AR-0004 | on it |
| Faria Lima (-46.69, -23.58) | BR-0001 | BR-0001 | on it |
| Grenada (-61.68, 12.12) | GD | GD-0001 | on it |
| Guarulhos airport (-46.47, -23.43) | BR-0002 | BR-0002 | on it |
| Havana (-82.37, 23.13) | CU | CU-0001 | on it |
| Huacho (-77.6, -11.11) | PE-0003 | PE-0003 | on it |
| Huarochiri Matucana (-76.38, -11.84) | PE-0003 | PE-0003 | on it |
| Itaquera (-46.45, -23.54) | BR-0002 | BR-0002 | on it |
| Jorge Chavez (-77.11, -12.02) | PE-0004 | PE-0002 | within a pixel |
| Kennedy Bogota (-74.15, 4.63) | CO-0002 | CO-0002 | on it |
| Kingstown SVG (-61.22, 13.16) | VC | VC-0001 | nearest across water |
| Lima Plaza de Armas (-77.03, -12.046) | PE-0001 | PE-0001 | on it |
| Lima San Isidro (-77.035, -12.1) | PE-0001 | PE-0001 | on it |
| Maipu (-70.76, -33.51) | CL-0010 | CL-0010 | on it |
| Moreno AR (-58.79, -34.65) | AR-0003 | AR-0003 | on it |
| Niteroi (-43.1, -22.88) | BR-0013 | BR-0013 | on it |
| Osasco (-46.79, -23.53) | BR-0001 | BR-0001 | on it |
| Palermo BA (-58.43, -34.58) | AR-0001 | AR-0001 | on it |
| Pilar AR (-58.91, -34.46) | AR-0002 | AR-0002 | on it |
| Pinheiros (-46.7, -23.565) | BR-0001 | BR-0001 | on it |
| Quilmes (-58.27, -34.72) | AR-0004 | AR-0004 | on it |
| Rio Centro (-43.18, -22.9) | BR-0010 | BR-0010 | nearest across water |
| Roseau (-61.39, 15.3) | DM | DM-0001 | on it |
| San Isidro AR (-58.53, -34.47) | AR-0002 | AR-0002 | on it |
| San Juan de Lurigancho (-77.0, -11.98) | PE-0002 | PE-0002 | on it |
| San Justo La Matanza (-58.56, -34.68) | AR-0003 | AR-0003 | on it |
| Santiago (-70.65, -33.45) | CL | CL-0009 | on it |
| Santiago Las Condes (-70.57, -33.41) | CL-0009 | CL-0009 | on it |
| Santo Andre (-46.53, -23.66) | BR-0003 | BR-0003 | on it |
| Santos (-46.33, -23.96) | BR-0004 | BR-0004 | on it |
| Sao Bernardo (-46.565, -23.69) | BR-0003 | BR-0003 | on it |
| Sao Paulo Paulista (-46.656, -23.56) | BR-0001 | BR-0001 | on it |
| Sao Paulo Se (-46.63, -23.55) | BR-0001 | BR-0001 | on it |
| Soacha (-74.22, 4.58) | CO-0003 | CO-0003 | on it |
| Tigre (-58.58, -34.42) | AR-0002 | AR-0002 | on it |
| Usaquen (-74.03, 4.7) | CO-0001 | CO-0001 | on it |
| Yauyos (-75.91, -12.46) | PE-0003 | PE-0003 | on it |

## Metro reach

Metro provinces whose centroid is over 80 km from their Metro's city, that are over 4 times the Metro's median and 250 px, and regions where Metro provinces hold over 30% of the land beside rural ones (the D612 error). Listed for review; a Metro made of whole metropolitan units can be large by design.

| Check | Province or region | Detail |
|---|---|---|
| Metro share of a region | CHL: Santiago Metropolitan | Metro provinces hold 36% of 911 px beside 1 rural |

## Known for review

- ECU: Natural Earth 10m swaps the names of Napo and Tungurahua (Ambato lies in its "Napo" unit, Tena in "Tungurahua"); the regions take the units by where they lie (D687).
- GUY: Natural Earth 10m gives Guyana's regions each other's names (Georgetown lies in its "East Berbice-Corentyne" unit); the regions take the units by where they lie, checked against Georgetown, Anna Regina, Bartica, Linden, Lethem, Mabaruma and New Amsterdam (D687).
- PA-0002 Panama Oeste: Natural Earth still has it inside Panama province; it is cut off west of the canal by a builder-drawn line.
- GUY: the Essequibo provinces (VEN claims) and Berbice (SUR claims) follow Guyana's de facto lines, which the province file also gives them.

## Watched small provinces

The microstates, city-states and metro splits the plan names (P8: Singapore, the London and Beijing splits, Hong Kong and Macau): every one has pixels, and a tiny one a click target at its label point.

| Province | Name | Pixels | Tiny | Label point (px) |
|---|---|---|---|---|
| BB-0001 | Barbados | 17 | Y | 2740.5, 2308.5 |
| AG-0001 | Antigua and Barbuda | 20 | Y | 2689.5, 2217.5 |
| DM-0001 | Dominica | 33 | Y | 2699.5, 2254.5 |
| GD-0001 | Grenada | 14 | Y | 2692.5, 2332.5 |
| KN-0001 | Saint Kitts and Nevis | 13 | Y | 2666.5, 2209.5 |
| LC-0001 | Saint Lucia | 26 | Y | 2708.5, 2290.5 |
| VC-0001 | Saint Vincent and the Grenadines | 15 | Y | 2703.5, 2306.5 |
| KY-0001 | Cayman Islands | 13 | Y | 2244.5, 2164.5 |
| VG-0001 | British Virgin Islands | 8 | Y | 2631.5, 2178.5 |
| PP-0001 | Papa's Port | 1042 | N | 2760.5, 3903.5 |

## Contested provinces

Drawn by our own province files (decision C), not the sources' de facto lines: each contested province sits in the region the CSV gives it, built as listed (an alias or carve hint where Natural Earth draws the land elsewhere). The game hatches them.

| Province | Name | Country | Contested | Region drawn from |
|---|---|---|---|---|
| GY-0002 | Essequibo Coast-West Demerara | GUY | VEN claims | Pomeroon-Supenaam and Essequibo Islands-West Demerara: alias hint -> GY-CU, GY-DE |
| GY-0003 | Barima-Waini | GUY | VEN claims | Barima-Waini: alias hint -> GY-BA |
| GY-0004 | Cuyuni-Mazaruni-Potaro | GUY | VEN claims | Cuyuni-Mazaruni and Potaro-Siparuni: alias hint -> GY-PM, GY-PT |
| GY-0005 | Rupununi | GUY | VEN claims | Upper Takutu-Upper Essequibo: alias hint -> GY-UD |
| GY-0006 | Berbice-Linden | GUY | SUR claims | Berbice and Upper Demerara: alias hint -> GY-MA, GY-ES, GY-UT |
| BZ-0002 | Belmopan-Cayo | BLZ | GTM claims | Cayo: name match 100 |
| BZ-0003 | Stann Creek-Toledo | BLZ | GTM claims | Stann Creek-Toledo: name parts (2 pieces, worst match 100) |

## Region matching

Regions not matched one-to-one by name: builder aliases, Natural Earth region groups, composite names matched part by part, carves (D676) and admin-1 units no region named, given to the touching region (D673). Check these on the preview too.

| Region | Matched by | Units |
|---|---|---|
| BHS: Grand Bahama | alias hint -> BS-FP, BS-EG, BS-WG | 3 |
| BHS: Northern Family Islands | alias hint -> BS-CO, BS-NO, BS-SO, BS-MI, BS-CE, BS-NE, BS-SE, BS-HI, BS-SW, BS-BY, BS-BI | 11 |
| BHS: Southern Family Islands | alias hint -> BS-NS, BS-CS, BS-SA, BS-MC, BS-EX, BS-BP, BS-CI, BS-LI, BS-IN, BS-AK, BS-CK, BS-MG, BS-RI, BS-RC, BS-SS | 15 |
| BLZ: Belize-Orange Walk-Corozal | name parts (3 pieces, worst match 100) | 3 |
| BLZ: Stann Creek-Toledo | name parts (2 pieces, worst match 100) | 2 |
| CHL: Magallanes | alias hint -> CL-MA | 1 |
| CHL: Santiago Metropolitan | alias hint -> CL-RM | 1 |
| COL: Amazonas-Guainia-Guaviare-Vaupes-Vichada | name parts (5 pieces, worst match 100) | 5 |
| COL: Arauca-Casanare | name parts (2 pieces, worst match 100) | 2 |
| COL: Caldas-Risaralda-Quindio | name parts (3 pieces, worst match 100) | 3 |
| COL: Caqueta-Putumayo | name parts (2 pieces, worst match 100) | 2 |
| COL: Narino | name match 100; plus unclaimed COL+99? | 2 |
| CUB: Artemisa-Mayabeque | name parts (2 pieces, worst match 100) | 2 |
| CUB: La Habana | alias hint -> CU-03 | 1 |
| CUB: Sancti Spiritus-Ciego de Avila | name parts (2 pieces, worst match 100) | 2 |
| CUB: Villa Clara-Cienfuegos | name parts (2 pieces, worst match 100) | 2 |
| DOM: Cibao Nordeste | alias hint -> DO-06, DO-14, DO-20, DO-19 | 4 |
| DOM: Cibao Noroeste | alias hint -> DO-15, DO-05, DO-26, DO-27 | 4 |
| DOM: Cibao Norte | alias hint -> DO-25, DO-18, DO-09 | 3 |
| DOM: Cibao Sur | alias hint -> DO-13, DO-28, DO-24 | 3 |
| DOM: El Valle | alias hint -> DO-22, DO-07 | 2 |
| DOM: Enriquillo | alias hint -> DO-04, DO-03, DO-10, DO-16 | 4 |
| DOM: Higuamo | alias hint -> DO-23, DO-29, DO-30 | 3 |
| DOM: Ozama | alias hint -> DO-01, DO-32 | 2 |
| DOM: Valdesia | alias hint -> DO-21, DO-17, DO-31, DO-02 | 4 |
| DOM: Yuma | alias hint -> DO-11, DO-12, DO-08 | 3 |
| ECU: Azuay-Canar | name parts (2 pieces, worst match 100) | 2 |
| ECU: Imbabura-Carchi | name parts (2 pieces, worst match 100) | 2 |
| ECU: Loja-Zamora Chinchipe | name parts (2 pieces, worst match 100) | 2 |
| ECU: Napo-Pastaza-Morona Santiago | alias hint -> ECU-1290, EC-Y, EC-S | 3 |
| ECU: Sucumbios-Orellana | name parts (2 pieces, worst match 100) | 2 |
| ECU: Tungurahua-Cotopaxi-Chimborazo-Bolivar | alias hint -> ECU-1289, EC-X, EC-H, EC-B | 4 |
| GTM: Alta Verapaz-Baja Verapaz | name parts (2 pieces, worst match 100) | 2 |
| GTM: Jutiapa-Jalapa-Santa Rosa | name parts (3 pieces, worst match 100) | 3 |
| GTM: Quetzaltenango-Totonicapan | name parts (2 pieces, worst match 100) | 2 |
| GTM: Retalhuleu-Suchitepequez | name parts (2 pieces, worst match 100) | 2 |
| GTM: Sacatepequez-Chimaltenango | name parts (2 pieces, worst match 100) | 2 |
| GTM: Solola-Quiche | name parts (2 pieces, worst match 100) | 2 |
| GTM: Zacapa-Chiquimula-El Progreso | name parts (3 pieces, worst match 100) | 3 |
| GUY: Barima-Waini | alias hint -> GY-BA | 1 |
| GUY: Berbice and Upper Demerara | alias hint -> GY-MA, GY-ES, GY-UT | 3 |
| GUY: Cuyuni-Mazaruni and Potaro-Siparuni | alias hint -> GY-PM, GY-PT | 2 |
| GUY: Demerara-Mahaica | alias hint -> GY-EB | 1 |
| GUY: Pomeroon-Supenaam and Essequibo Islands-West Demerara | alias hint -> GY-CU, GY-DE | 2 |
| GUY: Upper Takutu-Upper Essequibo | alias hint -> GY-UD | 1 |
| HND: Atlantida-Islas de la Bahia | name parts (2 pieces, worst match 100) | 2 |
| HND: Choluteca-Valle | name parts (2 pieces, worst match 100) | 2 |
| HND: Colon-Gracias a Dios | name parts (2 pieces, worst match 100) | 2 |
| HND: Comayagua-La Paz-Intibuca | name parts (3 pieces, worst match 100) | 3 |
| HND: Copan-Ocotepeque | name parts (2 pieces, worst match 100) | 2 |
| HND: Olancho-El Paraiso | name parts (2 pieces, worst match 100) | 2 |
| HND: Santa Barbara-Lempira | name parts (2 pieces, worst match 100) | 2 |
| HTI: Nord and Nord-Est | name parts (2 pieces, worst match 100) | 2 |
| HTI: Sud, Nippes and Grand'Anse | name parts (3 pieces, worst match 100) | 3 |
| JAM: Clarendon-Manchester-St Elizabeth | name parts (3 pieces, worst match 100) | 3 |
| JAM: Kingston and St Andrew | name parts (2 pieces, worst match 100) | 2 |
| JAM: St Ann-St Mary-Portland-St Thomas | name parts (4 pieces, worst match 100) | 4 |
| JAM: St James-Hanover-Westmoreland-Trelawny | name parts (4 pieces, worst match 100) | 4 |
| NIC: Chontales-Boaco-Rio San Juan | name parts (3 pieces, worst match 100) | 3 |
| NIC: Esteli-Madriz-Nueva Segovia | name parts (3 pieces, worst match 100) | 3 |
| NIC: Leon-Chinandega | name parts (2 pieces, worst match 100) | 2 |
| NIC: Masaya-Granada-Carazo | name parts (3 pieces, worst match 100) | 3 |
| NIC: Matagalpa-Jinotega | name parts (2 pieces, worst match 100) | 2 |
| NIC: North and South Caribbean Coast | alias hint -> NI-AN, NI-AS | 2 |
| PAN: Chiriqui | name match 100; plus unclaimed Ngöbe Buglé | 2 |
| PAN: Darien | name match 100; plus unclaimed Emberá | 2 |
| PAN: Panama | name match 100; plus unclaimed Kuna Yala; less PAN:Panama Oeste (carve) | 2 |
| PAN: Panama Oeste | no admin-1 match (best unit 67, group 0); carve: builder polygon from PAN:Panama | 0 |
| PER: Callao | alias hint -> PE-CAL | 1 |
| PER: Lima | alias hint -> PER-591, PER-587 | 2 |
| PER: Puno | alias hint -> PE-PUN | 1 |
| PRY: Boqueron-Alto Paraguay | name parts (2 pieces, worst match 100) | 2 |
| PRY: Canindeyu-Amambay | name parts (2 pieces, worst match 100) | 2 |
| PRY: Cordillera-Paraguari | name parts (2 pieces, worst match 100) | 2 |
| PRY: Guaira-Caazapa | name parts (2 pieces, worst match 100) | 2 |
| PRY: Misiones-Neembucu | name parts (2 pieces, worst match 100) | 2 |
| PRY: San Pedro-Concepcion | name parts (2 pieces, worst match 100) | 2 |
| SLV: Chalatenango-Cuscatlan-Cabanas | name parts (3 pieces, worst match 100) | 3 |
| SLV: La Paz-San Vicente-Usulutan | name parts (3 pieces, worst match 100) | 3 |
| SLV: San Miguel-Morazan-La Union | name parts (3 pieces, worst match 100) | 3 |
| SLV: Santa Ana-Ahuachapan | name parts (2 pieces, worst match 100) | 2 |
| SUR: Commewijne-Marowijne | name parts (2 pieces, worst match 100) | 2 |
| SUR: Nickerie-Coronie-Saramacca | name parts (3 pieces, worst match 100) | 3 |
| SUR: Wanica-Para | name parts (2 pieces, worst match 100) | 2 |
| TTO: Port of Spain-Diego Martin-San Juan-Laventille | name parts (3 pieces, worst match 100) | 3 |
| TTO: Southern Trinidad | alias hint -> TT-PED, TT-PTF, TT-PRT, TT-RCM, TT-SFO, TT-SIP | 6 |
| TTO: Tobago | alias hint -> TT-ETO, TT-WTO | 2 |
| TTO: Tunapuna-Piarco-Arima-Chaguanas-Sangre Grande | name parts (4 pieces, worst match 100) | 4 |
| URY: Artigas-Rivera | name parts (2 pieces, worst match 100) | 2 |
| URY: Cerro Largo-Treinta y Tres-Lavalleja | name parts (3 pieces, worst match 100) | 3 |
| URY: Colonia-San Jose | name parts (2 pieces, worst match 100) | 2 |
| URY: Florida-Flores | name parts (2 pieces, worst match 100) | 2 |
| URY: Maldonado-Rocha | name parts (2 pieces, worst match 100) | 2 |
| URY: Paysandu-Salto | name parts (2 pieces, worst match 100) | 2 |
| URY: Soriano-Rio Negro | name parts (2 pieces, worst match 100) | 2 |
| URY: Tacuarembo-Durazno | name parts (2 pieces, worst match 100) | 2 |
| VEN: La Guaira | alias hint -> VE-X | 1 |
| VEN: Lara-Yaracuy | name parts (2 pieces, worst match 100) | 2 |
| VEN: Merida-Trujillo | name parts (2 pieces, worst match 100) | 2 |
| VEN: Miranda | name match 100; plus unclaimed Dependencias Federales, VEN+99? | 3 |
| VEN: Monagas-Delta Amacuro | name parts (2 pieces, worst match 100) | 2 |
| VEN: Portuguesa-Cojedes | name parts (2 pieces, worst match 100) | 2 |

## Land without a province

Natural Earth admin-1 units of this file's countries that no region claims and that touch no region of their country (overseas territories, remote islands). They stay water on the map.

None.

## Sea links

`sea` rows of province-adjacency.csv with a province of this file: coastal provinces whose shapes do not touch but face each other across a strait (D678).

AR-0001-UY-0004, AR-0002-UY-0004, AR-0004-UY-0004, AR-0005-UY-0004, BR-0010-BR-0013, BS-0001-BS-0004, BS-0002-BS-0003, BS-0003-BS-0004, CU-0003-CU-0013, CU-0004-CU-0013, DM-0001-FR-0040, DM-0001-FR-0041, FR-0041-LC-0001, GD-0001-VC-0001, LC-0001-VC-0001, TT-0001-VE-0019, TT-0002-TT-0005, TT-0004-VE-0010, VE-0019-VE-0020

## Small provinces

None.

## Uneven Voronoi splits

Blocks (ADM2 units, or admin-1 units for Greenland) that several provinces share, where one province takes most of the block. Check that the larger part belongs where it went.

| Region | Block | Shares |
|---|---|---|
| ARG:Santa Fe | La Capital | AR-0013 80%, AR-0012 20% |
| BRA:Rio de Janeiro | Rio de Janeiro | BR-0011 79%, BR-0010 21% |
| CHL:Biobio | part-0 | CL-0016 75%, CL-0015 25% |
| CHL:Valparaiso | part-2 | CL-0008 91%, CL-0007 9% |
| COL:Bogota | Bogotá, D.c. | CO-0002 79%, CO-0001 21% |
| PER:Lima | Lima | PE-0002 82%, PE-0001 18% |
| VEN:Bolivar | part-0 | VE-0012 90%, VE-0011 10% |

## Named places outside their province

A Natural Earth place matched in the name or notes that ended up in another province (usually a neighbour that names the same city more directly, as Long Beach-Harbor's notes name Los Angeles).

| Province | Name | Place | Lies in |
|---|---|---|---|
| BR-0048 | Interior Amazonas | Manaus | BR-0047 |
| VE-0005 | Costa Oriental del Lago | Maracaibo | VE-0004 |

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| AR-0006 | Zarate-Campana-North Pampa | 0 | N | Y |
| AR-0012 | Rosario-Gran Rosario | 0 | N | Y |
| AR-0034 | Entre Rios | 56 | Y | N |
| BR-0007 | Sorocaba-Southwest Sao Paulo | 72 | Y | N |
| BR-0012 | Baixada Fluminense | 3 | N | Y |
| BR-0030 | West Santa Catarina | 25 | Y | N |
| BR-0039 | Bahia Sertao-Feira de Santana | 7 | Y | N |
| BR-0043 | Ceara Sertao | 66 | Y | N |
| BR-0047 | Manaus | 0 | N | Y |
| BR-0062 | Piaui | 19 | Y | N |
| CL-0004 | Calama-Salar de Atacama | 15 | Y | N |
| CL-0016 | Los Angeles-Biobio Forests | 23 | Y | N |
| GY-0004 | Cuyuni-Mazaruni-Potaro | 28 | Y | N |
| NI-0001 | Managua | 10 | Y | N |
| NI-0007 | Chontales-Rio San Juan | 6 | Y | N |
| PE-0002 | Lima Norte-Este | 42 | Y | N |
| PR-0001 | San Juan | 3 | N | Y |
| PR-0002 | Bayamon-Toa Baja | 2 | N | Y |
| PR-0009 | Central Mountains | 6 | Y | N |
| SR-0001 | Paramaribo | 3 | N | Y |
| SV-0003 | Santa Ana-Ahuachapan | 5 | Y | N |
| UY-0005 | Fray Bentos-Mercedes | 49 | Y | N |
| VE-0011 | Ciudad Guayana | 0 | N | Y |
| VE-0015 | Merida-Trujillo | 15 | Y | N |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

CL-0022 (101), CL-0021 (52), BS-0004 (48), PP-0001 (26), BS-0003 (18), BR-0049 (17), CL-0020 (15), BR-0044 (11), BZ-0001 (10), EC-0015 (9), HN-0004 (9), VE-0010 (9), HN-0003 (8), PA-0001 (8), CR-0008 (7), CU-0004 (7), CU-0005 (7), CU-0006 (7), CU-0013 (7), AR-0008 (6), BR-0006 (6), BR-0035 (6), CU-0007 (6), PA-0005 (6), VE-0002 (6), VG-0001 (6), AR-0025 (5), BR-0001 (5), BR-0015 (5), BR-0046 (5), BR-0056 (5), GY-0003 (5), KY-0001 (5), NI-0004 (5), NI-0008 (5), PA-0007 (5), AR-0012 (4), BR-0007 (4), BR-0009 (4), BR-0022 (4), BR-0033 (4), BR-0048 (4), BR-0050 (4), BR-0059 (4), BR-0066 (4), CL-0008 (4), CL-0011 (4), CO-0005 (4), CO-0010 (4), CO-0012 (4), CO-0026 (4), EC-0002 (4), GY-0001 (4), KN-0001 (4), PA-0004 (4), VE-0013 (4), AR-0013 (3), BR-0005 (3), BR-0027 (3), BR-0032 (3), BR-0045 (3), BR-0065 (3), CL-0007 (3), CO-0006 (3), CO-0008 (3), CO-0023 (3), CR-0001 (3), CU-0009 (3), DO-0001 (3), EC-0011 (3), HN-0002 (3), HT-0006 (3), PR-0003 (3), PY-0010 (3), VC-0001 (3), VE-0020 (3), AG-0001 (2), AR-0006 (2), AR-0031 (2), BO-0009 (2), BO-0016 (2), BR-0003 (2), BR-0004 (2), BR-0017 (2), BR-0018 (2), BR-0019 (2), BR-0021 (2), BR-0023 (2), BR-0024 (2), BR-0030 (2), BR-0034 (2), BR-0037 (2), BR-0039 (2), BR-0040 (2), BR-0043 (2), BR-0047 (2), BR-0051 (2), BR-0052 (2), BR-0054 (2), BR-0055 (2), BR-0058 (2), BR-0061 (2), BS-0002 (2), BZ-0002 (2), CL-0015 (2), CL-0017 (2), CL-0019 (2), CO-0015 (2), CO-0018 (2), CO-0029 (2), CR-0007 (2), CU-0012 (2), DO-0002 (2), DO-0007 (2), EC-0003 (2), EC-0010 (2), GD-0001 (2), GT-0004 (2), GT-0006 (2), GT-0011 (2), GY-0002 (2), GY-0004 (2), GY-0006 (2), HN-0010 (2), HT-0001 (2), HT-0004 (2), PA-0010 (2), PE-0001 (2), PE-0003 (2), PE-0004 (2), PE-0017 (2), PE-0020 (2), PE-0023 (2), PR-0005 (2), PR-0007 (2), TT-0001 (2), TT-0005 (2), UY-0007 (2), VE-0006 (2), VE-0016 (2), VE-0019 (2)

## Visual check

`preview-latin-america.png` in this folder is province-ids.png around the region (pixels x 1753..3544, y 1739..4096, scaled by 1.34).
