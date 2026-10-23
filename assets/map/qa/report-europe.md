# Map QA report: europe

_Written by `tools/map-pipeline/run.py --region europe` (pipeline pa-1). Source of the rows: `provinces-europe.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 679 provinces of `provinces-europe.csv` have a crosswalk row and pixels (65 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 679 |
| ... ALB | 6 |
| ... AND | 1 |
| ... AUT | 17 |
| ... BEL | 18 |
| ... BGR | 11 |
| ... BIH | 7 |
| ... BLR | 12 |
| ... CHE | 21 |
| ... CYP | 5 |
| ... CZE | 16 |
| ... DEU | 50 |
| ... DNK | 15 |
| ... ESP | 36 |
| ... EST | 6 |
| ... FIN | 16 |
| ... FRA | 45 |
| ... FRO | 1 |
| ... GBR | 43 |
| ... GGY | 1 |
| ... GIB | 1 |
| ... GRC | 14 |
| ... HRV | 9 |
| ... HUN | 14 |
| ... IMN | 1 |
| ... IRL | 15 |
| ... ISL | 3 |
| ... ITA | 40 |
| ... JEY | 1 |
| ... LIE | 1 |
| ... LTU | 8 |
| ... LUX | 1 |
| ... LVA | 7 |
| ... MCO | 1 |
| ... MDA | 6 |
| ... MKD | 5 |
| ... MLT | 1 |
| ... MNE | 3 |
| ... NLD | 24 |
| ... NOR | 20 |
| ... POL | 28 |
| ... PRT | 15 |
| ... ROU | 20 |
| ... RUS | 4 |
| ... SMR | 1 |
| ... SRB | 10 |
| ... SVK | 10 |
| ... SVN | 7 |
| ... SWE | 23 |
| ... TUR | 36 |
| ... UKR | 18 |
| ... VAT | 1 |
| ... XKX | 4 |
| Regions matched | 329 of 329 |
| Provinces by method: admin1 | 487 |
| Provinces by method: admin2 | 52 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 140 |
| Flagged for review (confidence < 0.6) | 0 |
| Placed by a builder hint (`hints/europe.toml`) | 88 |
| Tiny (under 64 px) | 65 |
| Given a pixel at their interior point (no pixel centre inside) | 2 |
| More than one part (islands, exclaves) | 239 |
| Coastal flag differs from the CSV | 35 |
| Small for their region (not Metro, under 5% of the region's mean) | 3 |
| Voronoi-split blocks where one province takes 75% or more | 10 |
| Places named in a province's name or notes that lie in another province | 11 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 10 |
| Admin-1 units left without a province | 1 |
| Sea links with a province of this file | 81 |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities in a part across a narrow strait (listed, allowed) | 0 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes) | Public domain | yes |
| geoBoundaries gbOpen ALB ADM2 (geoBoundaries, Albania districts blank 2.svg) | Creative Commons Attribution 2.5 Generic | yes |
| geoBoundaries gbOpen AUT ADM2 (Federal Office for Metrology and Survey, Austria, Derived from ADM4 layer) | Creative Commons Attribution-ShareAlike 2.0 | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 2.0); Voronoi path |
| geoBoundaries gbOpen BEL ADM2 (Statistics Belgium) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen BGR ADM2 (geoBoundaries, Wikimedia) | Public Domain | yes |
| geoBoundaries gbOpen BIH ADM2 (Codrina Maria Ille, Datahub) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen BLR ADM2 (geoBoundaries, CIESIN) | Creative Commons Attribution 3.0 License | yes |
| geoBoundaries gbOpen CHE ADM2 (Federal Office of Topography swisstopo) | Federal Office of Topography swisstopo License | no: refused: not in the allowlist (Federal Office of Topography swisstopo License); Voronoi path |
| geoBoundaries gbOpen CYP ADM2 (Wikipedia, Cyprus Department of Land Registry and Geometry) | Creative Commons Attribution-ShareAlike 3.0 Unported | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 3.0 Unported); Voronoi path |
| geoBoundaries gbOpen CZE ADM2 (geoBoundaries, Wikimedia Commons) | Public Domain | yes |
| geoBoundaries gbOpen DEU ADM2 (Federal Agency for Cartography and Geodesy) | Data license Germany - Attribution - Version 2.0 | no: refused: not in the allowlist (Data license Germany - Attribution - Version 2.0); Voronoi path |
| geoBoundaries gbOpen DNK ADM2 (geoBoundaries, Wikimedia Commons) | Public Domain | yes |
| geoBoundaries gbOpen ESP ADM2 (El Instituto Nacional de Estadstica) | National Institute of Statistics (INE) Data License | no: refused: not in the allowlist (National Institute of Statistics (INE) Data License); Voronoi path |
| geoBoundaries gbOpen EST ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen FIN ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen FRA ADM2 (Institut national de l'information géographique et forestière (IGN-F)) | Etalab Open License 2.0 | no: refused: not in the allowlist (Etalab Open License 2.0); Voronoi path |
| geoBoundaries gbOpen GBR ADM2 (Office for National Statistics Open Geography Portal) | Open Government Licence v3.0 | yes |
| geoBoundaries gbOpen GRC ADM2 (EuroGeoGraphics, Regional IM Working Group - Europe) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen HRV ADM2 (Open Street Map, geoBoundaries) | Creative Commons Attribution-ShareAlike 2.0 | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 2.0); Voronoi path |
| geoBoundaries gbOpen HUN ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen IRL ADM2 (Ordnance Survey Ireland) | Creative Commons Attribution 4.0 (CC BY 4.0) | yes |
| geoBoundaries gbOpen ISL ADM2 (National Land Survey of Iceland) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen ITA ADM2 (ISTAT, National Institute of Statistics) | Creative Commons Attribution 3.0 License | yes |
| geoBoundaries gbOpen LTU ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen LVA ADM2 (Valsts zemes dienests) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen MKD ADM2 (EuroGeographics, Regional IM Working Group - Europe) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen NLD ADM2 (National Georegister) | CC0 1.0 Universal (CC0 1.0) Public Domain Dedication | yes |
| geoBoundaries gbOpen NOR ADM2 (Geonorge, Mapping Authority of Norway) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen POL ADM2 (Geoboundaries, OpenStreetMap) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen PRT ADM2 (DG Territory) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen ROU ADM2 (Agentia Nationala de Cadastru si Publicitate Imobiliara) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen RUS ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen SRB ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen SVK ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen SVN ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen SWE ADM2 (geoBoundaries, Wikimedia Commons) | CC0 1.0 Universal (CC0 1.0) Public Domain Dedication | yes |
| geoBoundaries gbOpen TUR ADM2 (OpenStreetMap, OSM Boundaries) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen UKR ADM2 (Ministry of Regional Development (Ministry of Development of Communities and Territories of Ukraine)) | Creative Commons Attribution-ShareAlike 4.0 International License | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 4.0 International License); Voronoi path |
| geoBoundaries gbOpen XKX ADM2 (OpenStreetMap, Wambacher) | Creative Commons Attribution-ShareAlike 2.0 | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 2.0); Voronoi path |

Refused as not on the allowlist (for Logan: attribution-only government licences are refused until allowed, D601): Data license Germany - Attribution - Version 2.0; Etalab Open License 2.0; Federal Office of Topography swisstopo License; National Institute of Statistics (INE) Data License.

Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, public domain and the attribution-only government licences OGL-Canada 2.0 and OGL-UK 3.0; a region whose country has no allowed ADM2 is split by Voronoi.

## Low-confidence rows for review

None.

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| AT-0001 | Vienna Inner City | seeds: point 16.35,48.2 (hint); point 16.37,48.21 (hint); point 16.4,48.22 (hint); 0 whole parts, 1 split |
| AT-0002 | Vienna Outer Districts | seeds: point 16.27,48.2 (hint); point 16.29,48.14 (hint) (snapped to land); point 16.38,48.16 (hint); point 16.4,48.27 (hint); point 16.5,48.22 (hint); 0 whole parts, 1 split |
| AT-0004 | St Polten-Mostviertel | seeds: point 14.87,48.12 (hint); point 15.16,48.0 (hint); point 15.33,48.23 (hint); point 15.63,48.2 (hint); 0 whole parts, 1 split |
| AT-0005 | Waldviertel-Weinviertel | seeds: point 15.17,48.6 (hint); point 15.66,48.66 (hint); point 16.08,48.56 (hint); point 16.57,48.57 (hint); 0 whole parts, 1 split |
| AT-0007 | Wels-Steyr | seeds: point 14.03,48.16 (hint); point 14.12,47.9 (hint); point 14.42,48.04 (hint); 0 whole parts, 1 split |
| AT-0008 | Innviertel-Salzkammergut | seeds: point 13.03,48.26 (hint); point 13.15,48.1 (hint); point 13.49,48.21 (hint); point 13.62,47.71 (hint); point 13.8,47.92 (hint); 0 whole parts, 1 split |
| AT-0010 | Upper Styria-Erzberg | seeds: point 14.24,47.57 (hint); point 14.66,47.17 (hint); point 14.88,47.54 (hint); point 15.09,47.38 (hint); point 15.27,47.41 (hint); 0 whole parts, 1 split |
| AT-0011 | Southeast Styria | seeds: point 15.54,46.78 (hint); point 15.89,46.95 (hint); point 15.97,47.28 (hint); point 15.99,46.69 (hint) (snapped to land); 0 whole parts, 1 split |
| AT-0013 | Tyrolean Uplands-East Tyrol | seeds: point 10.29,47.01 (hint); point 10.57,47.14 (hint); point 11.71,47.35 (hint); point 12.17,47.58 (hint); point 12.39,47.45 (hint); point 12.77,46.83 (hint); 1 whole parts, 1 split |
| BE-0001 | Brussels European Quarter | seeds: point 4.36,50.85 (hint); point 4.38,50.84 (hint); 0 whole parts, 1 split |
| BE-0002 | Brussels Outer Communes | seeds: point 4.31,50.83 (hint); point 4.32,50.81 (hint); point 4.32,50.86 (hint); point 4.34,50.8 (hint); point 4.38,50.87 (hint); point 4.43,50.84 (hint); 0 whole parts, 1 split |
| BE-0003 | Antwerp City | seeds: point 4.4,51.22 (hint); 0 whole admin1 units, split: Antwerp |
| BE-0004 | Antwerp Port-Waasland | seeds: point 4.14,51.17 (hint); point 4.25,51.32 (hint); point 4.3,51.28 (hint); 0 whole admin1 units, split: East Flanders |
| BE-0005 | Antwerp Kempen | seeds: point 4.95,51.32 (hint); point 4.99,51.16 (hint); point 5.11,51.19 (hint); 0 whole admin1 units, split: Antwerp |
| BE-0006 | Mechelen-Lier | seeds: point 4.48,51.03 (hint); point 4.57,51.13 (hint); 0 whole admin1 units, split: Antwerp |
| BE-0007 | Ghent | seeds: point 3.72,51.05 (hint); point 3.8,51.15 (hint); 0 whole admin1 units, split: East Flanders |
| BE-0008 | Aalst-Flemish Ardennes | seeds: point 3.6,50.85 (hint); point 4.04,50.94 (hint); 0 whole admin1 units, split: East Flanders |
| BE-0009 | Bruges-Zeebrugge | seeds: point 2.92,51.22 (hint); point 3.2,51.33 (hint); point 3.22,51.21 (hint); 0 whole admin1 units, split: West Flanders |
| BE-0010 | Kortrijk-Roeselare | seeds: point 2.88,50.85 (hint); point 3.12,50.95 (hint); point 3.26,50.83 (hint); 0 whole admin1 units, split: West Flanders |
| BE-0011 | Leuven | seeds: point 4.7,50.88 (hint); point 4.95,50.8 (hint); 0 whole admin1 units, split: Flemish Brabant |
| BE-0012 | Halle-Vilvoorde-Zaventem | seeds: point 4.15,50.88 (hint); point 4.23,50.73 (hint); point 4.43,50.93 (hint); point 4.47,50.9 (hint); 0 whole admin1 units, split: Flemish Brabant |
| BY-0002 | Borisov-Zhodino | seeds: point 28.33,54.1 (hint); point 28.5,54.23 (hint); 11 whole admin2 units |
| BY-0009 | Mozyr-Rechitsa | seeds: point 29.24,52.05 (hint); point 30.39,52.36 (hint); 12 whole admin2 units |
| CH-0001 | Zurich | seeds: point 8.5,47.3 (hint); point 8.54,47.37 (hint); 0 whole parts, 1 split |
| CH-0002 | Zurich Airport-Unterland | seeds: point 8.47,47.5 (hint); point 8.56,47.45 (hint); point 8.6,47.4 (hint); 0 whole parts, 1 split |
| CH-0003 | Winterthur-Oberland | seeds: point 8.72,47.5 (hint); point 8.85,47.33 (hint); 0 whole parts, 1 split |
| CH-0008 | Thun-Bernese Oberland | seeds: point 7.63,46.76 (hint); point 7.86,46.69 (hint); point 8.19,46.73 (hint); 0 whole admin1 units, split: Bern |
| DE-0002 | Ludwigsburg-Heilbronn | seeds: point 9.19,48.9 (hint); point 9.22,49.14 (hint); point 9.3,48.74 (hint); point 9.53,48.8 (hint); 0 whole parts, 1 split |
| DE-0005 | Swabian Alb-Lake Constance | seeds: point 9.06,48.52 (hint); point 9.17,47.66 (hint) (snapped to land); point 9.21,48.49 (hint); point 9.48,47.65 (hint); point 9.99,48.4 (hint); 0 whole parts, 1 split |
| DE-0013 | Berlin Mitte-West | seeds: point 13.2,52.53 (hint); point 13.3,52.51 (hint); point 13.32,52.45 (hint); point 13.38,52.52 (hint); 0 whole parts, 1 split |
| DE-0014 | Berlin East-Spree | seeds: point 13.42,52.5 (hint); point 13.45,52.51 (hint); point 13.5,52.52 (hint); point 13.53,52.43 (hint); point 13.58,52.43 (hint); point 13.59,52.54 (hint); 0 whole parts, 1 split |
| DE-0020 | Darmstadt-Hanau | seeds: point 8.41,49.99 (hint); point 8.65,49.87 (hint); point 8.77,50.1 (hint); point 8.92,50.13 (hint); 0 whole parts, 1 split |
| DE-0024 | Ludwigshafen-Palatinate | seeds: point 7.6,49.2 (hint); point 7.77,49.44 (hint); point 8.15,49.35 (hint); point 8.43,49.48 (hint); 0 whole parts, 1 split |
| DE-0031 | Munsterland | seeds: point 7.03,52.21 (hint); point 7.17,51.95 (hint); point 7.63,51.96 (hint); 0 whole parts, 1 split |
| DE-0033 | Aachen-Rhenish Lignite | seeds: point 6.08,50.78 (hint); point 6.45,51.05 (hint); point 6.48,50.8 (hint); point 6.5,50.91 (hint); 0 whole parts, 1 split |
| DE-0034 | Sauerland-Siegen | seeds: point 8.02,50.87 (hint); point 8.07,51.4 (hint); point 8.29,51.35 (hint); 0 whole parts, 1 split |
| DE-0036 | Brunswick-Wolfsburg | seeds: point 10.34,52.15 (hint); point 10.43,51.9 (hint); point 10.52,52.27 (hint); point 10.79,52.42 (hint); point 9.93,51.53 (hint); 0 whole parts, 1 split |
| DE-0037 | Lower Elbe-Hamburg South | seeds: point 10.41,53.25 (hint); point 8.7,53.87 (hint); point 9.48,53.6 (hint); point 9.98,53.46 (hint) (snapped to land); 0 whole parts, 1 split |
| DE-0040 | Holstein-Hamburg North | seeds: point 10.0,53.71 (hint); point 10.24,53.67 (hint); point 10.69,53.87 (hint); point 9.8,53.66 (hint); 1 whole parts, 1 split |
| DE-0043 | Vorpommern-Greifswald | seeds: point 13.26,53.56 (hint); point 13.38,54.1 (hint); point 13.45,54.4 (hint); point 13.64,54.14 (hint); 3 whole parts, 1 split |
| DE-0047 | Halle-Leuna-Bitterfeld | seeds: point 11.97,51.48 (hint); point 12.03,51.32 (hint); point 12.14,51.05 (hint); point 12.32,51.62 (hint); 0 whole parts, 1 split |
| DK-0002 | Copenhagen Suburbs-Novo | seeds: point 12.4,55.67 (hint); point 12.45,55.76 (hint); point 12.6,55.63 (hint); point 12.65,55.62 (hint); 17 whole admin2 units |
| DK-0003 | North Zealand | seeds: point 12.3,55.93 (hint); point 12.45,55.85 (hint); point 12.6,56.03 (hint); 9 whole admin2 units |
| ES-0002 | Madrid North-Barajas | seeds: point -3.36,40.48 (hint); point -3.48,40.46 (hint); point -3.59,40.47 (hint); point -3.64,40.54 (hint); point -3.8,40.8 (hint); point -3.87,40.49 (hint); 1 whole parts, 1 split |
| ES-0003 | Madrid South-Getafe | seeds: point -3.6,40.03 (hint); point -3.73,40.31 (hint); point -3.76,40.33 (hint); point -3.8,40.28 (hint); point -3.86,40.32 (hint); 0 whole parts, 1 split |
| ES-0005 | Barcelona Llobregat-Valles | seeds: point 1.83,41.73 (hint); point 1.91,41.48 (hint); point 2.01,41.56 (hint); point 2.08,41.3 (hint); point 2.11,41.55 (hint); 0 whole admin1 units, split: Barcelona |
| ES-0007 | Girona-Costa Brava | seeds: unit Gerona (hint); 1 whole admin1 units |
| ES-0008 | Lleida-Pyrenees | seeds: unit Lérida (hint); 1 whole admin1 units |
| FI-0002 | Espoo | seeds: point 24.44,60.12 (hint); point 24.66,60.21 (hint); 1 whole parts, 1 split |
| FI-0003 | Vantaa-Airport | seeds: point 24.97,60.31 (hint); point 25.11,60.4 (hint); 0 whole parts, 1 split |
| GB-0001 | City of London-Westminster | seeds: unit Camden (hint); unit City (hint); unit Islington (hint); unit Kensington and Chelsea (hint); unit Lambeth (hint); unit Southwark (hint); unit Westminster (hint); 7 whole admin1 units |
| GB-0002 | East London-Docklands | seeds: unit Barking and Dagenham (hint); unit Greenwich (hint); unit Hackney (hint); unit Lewisham (hint); unit Newham (hint); unit Tower Hamlets (hint); 6 whole admin1 units |
| GB-0003 | West London-Heathrow | seeds: unit Ealing (hint); unit Hammersmith and Fulham (hint); unit Hillingdon (hint); unit Hounslow (hint); unit Richmond upon Thames (hint); unit Wandsworth (hint); 6 whole admin1 units |
| GB-0004 | Outer London Suburbs | seeds: unit Barnet (hint); unit Bexley (hint); unit Brent (hint); unit Bromley (hint); unit Croydon (hint); unit Enfield (hint); unit Haringey (hint); unit Harrow (hint); unit Havering (hint); unit Kingston upon Thames (hint); unit Merton (hint); unit Redbridge (hint); unit Sutton (hint); unit Waltham Forest (hint); 14 whole admin1 units |
| HR-0002 | Zagreb County-Zagorje | seeds: unit Krapinsko-Zagorska (hint); unit Zagrebacka (hint); 2 whole admin1 units |
| HR-0003 | Varazdin-Medimurje | seeds: unit Koprivničko-Križevačka (hint); unit Medimurska (hint); unit Varaždinska (hint); 3 whole admin1 units |
| IE-0006 | Irish Midlands | seeds: unit Laoighis (hint); unit Longford (hint); unit Offaly (hint); unit Westmeath (hint); 4 whole admin1 units |
| LT-0002 | Vilnius County-East | seeds: point 24.66,54.79 (hint); point 24.95,55.05 (hint); point 25.39,54.31 (hint); point 25.7,54.6 (hint); point 26.1,55.15 (hint); 0 whole parts, 1 split |
| LT-0008 | Alytus-Marijampole | seeds: unit Alytaus (hint); unit Marijampoles (hint); 2 whole admin1 units |
| NO-0001 | Oslo Centre | seeds: point 10.7,59.93 (hint); point 10.74,59.91 (hint); 2 whole admin2 units, split: Oslo nor |
| NO-0002 | Oslo East-Groruddalen | seeds: point 10.78,59.89 (hint); point 10.87,59.95 (hint); point 10.92,59.96 (hint); 0 whole admin2 units, split: Oslo nor |
| NO-0012 | Sogn-Hardanger-Sunnhordland | seeds: point 5.03,60.81 (hint) (snapped to land); point 5.49,59.78 (hint) (snapped to land); point 6.55,60.07 (hint); point 7.1,61.23 (hint); 1 whole admin1 units, split: Hordaland |
| PL-0002 | Plock-North Mazovia | seeds: point 19.7,52.55 (hint); point 20.62,52.88 (hint); point 21.57,53.08 (hint); 0 whole parts, 1 split |
| PL-0003 | Radom-Siedlce | seeds: point 20.86,51.86 (hint); point 21.15,51.4 (hint); point 22.27,52.17 (hint); 0 whole parts, 1 split |
| PL-0005 | Tarnow-Nowy Sacz | seeds: point 20.69,49.62 (hint); point 20.99,50.01 (hint); point 21.16,49.66 (hint); 0 whole parts, 1 split |
| PL-0006 | Podhale-Beskids | seeds: point 19.22,50.04 (hint); point 19.59,49.74 (hint); point 19.95,49.3 (hint); point 20.03,49.48 (hint); 0 whole parts, 1 split |
| PL-0008 | Rybnik-Bielsko | seeds: point 18.54,50.1 (hint); point 18.6,49.95 (hint); point 19.04,49.82 (hint); 0 whole parts, 1 split |
| PL-0009 | Czestochowa | seeds: point 19.12,50.81 (hint); point 19.33,50.58 (hint); 0 whole parts, 1 split |
| PL-0011 | Kalisz-Konin | seeds: point 17.81,51.65 (hint); point 18.09,51.76 (hint); point 18.25,52.22 (hint); 0 whole parts, 1 split |
| PL-0012 | Pila-Leszno | seeds: point 16.57,51.84 (hint); point 16.74,53.15 (hint); point 16.92,52.99 (hint); 0 whole parts, 1 split |
| PL-0014 | Legnica-Walbrzych | seeds: point 15.73,50.9 (hint); point 16.09,51.66 (hint); point 16.16,51.21 (hint); point 16.2,51.4 (hint); point 16.28,50.77 (hint); 0 whole parts, 1 split |
| PL-0016 | Piotrkow-Belchatow | seeds: point 19.37,51.37 (hint); point 19.45,51.07 (hint); point 19.7,51.41 (hint); 0 whole parts, 1 split |
| PL-0018 | Slupsk-Kashubia | seeds: point 17.03,54.46 (hint); point 17.75,54.54 (hint); point 17.83,54.81 (hint); point 17.98,54.12 (hint); 0 whole parts, 1 split |
| PL-0022 | Zamosc-Chelm | seeds: point 23.25,50.72 (hint); point 23.47,51.13 (hint); point 23.89,50.81 (hint); 0 whole parts, 1 split |
| PT-0001 | Lisbon City-Cascais | seeds: place Lisbon; point -9.42,38.7 (hint) (snapped to land); 0 whole admin1 units, split: Lisboa |
| PT-0002 | Sintra-Loures | seeds: point -8.99,38.96 (hint) (snapped to land); point -9.13,38.77 (hint); point -9.17,38.83 (hint); point -9.38,38.8 (hint); 0 whole admin1 units, split: Lisboa |
| RS-0006 | Macva-Jadar | seeds: unit Kolubarski (hint); unit Macvanski (hint); 2 whole admin1 units |
| RS-0009 | Bor-Timok | seeds: unit Borski (hint); unit Branicevski (hint); unit Zajecarski (hint); 3 whole admin1 units |
| RS-0010 | Leskovac-Vranje | seeds: unit Jablanicki (hint); unit Pcinjski (hint); unit Toplicki (hint); 4 whole admin1 units |
| SE-0001 | Stockholm Inner | seeds: point 17.95,59.4 (hint); point 18.07,59.33 (hint); 21 whole admin2 units |
| SK-0007 | Gemer-Southern Slovakia | seeds: point 19.35,48.21 (hint); point 19.67,48.33 (hint); point 20.02,48.38 (hint); 0 whole parts, 1 split |
| SK-0009 | High Tatras-Poprad | seeds: point 20.2,49.16 (hint); point 20.3,49.06 (hint); point 20.77,49.0 (hint) (snapped to land); 0 whole parts, 1 split |
| TR-0001 | Historic Peninsula-Beyoglu | seeds: point 28.96,41.01 (hint); point 28.97,41.035 (hint); 0 whole parts, 1 split |
| TR-0002 | Levent-Maslak | seeds: point 28.99,41.06 (hint); point 29.01,41.05 (hint); point 29.05,41.17 (hint); 0 whole parts, 1 split |
| TR-0003 | Western Istanbul | seeds: point 28.25,41.15 (hint); point 28.63,40.98 (hint); point 28.67,41.03 (hint); point 28.73,41.26 (hint); point 28.87,40.98 (hint); 0 whole parts, 1 split |
| TR-0004 | Kadikoy-Uskudar | seeds: point 29.02,41.02 (hint); point 29.03,40.99 (hint) (snapped to land); point 29.12,40.99 (hint); 0 whole parts, 1 split |
| TR-0005 | Pendik-Tuzla | seeds: point 29.19,40.89 (hint) (snapped to land); point 29.3,40.87 (hint) (snapped to land); point 29.31,40.82 (hint) (snapped to land); point 29.62,41.17 (hint); 0 whole parts, 1 split |
| UA-0009 | Vinnytsia | seeds: unit Vinnytsya (hint); 1 whole admin1 units |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| BE-0001 | Brussels European Quarter | 1 | 1 | 4195.5, 1341.5 |
| ES-0036 | Melilla | 1 | 1 | 4028.5, 1771.5 |
| GI-0001 | Gibraltar | 1 | 1 | 3974.5, 1750.5 |
| VA-0001 | Vatican City | 1 | 1 | 4379.5, 1596.5 |
| CH-0012 | Basel City | 2 | 1 | 4268.5, 1437.5 |
| MC-0001 | Monaco | 2 | 1 | 4264.5, 1545.5 |
| ES-0035 | Ceuta | 3 | 1 | 3974.5, 1756.5 |
| GG-0001 | Guernsey | 5 | 2 | 4037.5, 1381.5 |
| SM-0001 | San Marino | 5 | 1 | 4379.5, 1539.5 |
| TR-0001 | Historic Peninsula-Beyoglu | 5 | 2 | 4753.5, 1619.5 |
| AT-0001 | Vienna Inner City | 6 | 1 | 4467.5, 1418.5 |
| BA-0007 | Brcko | 8 | 1 | 4523.5, 1515.5 |
| DK-0001 | Copenhagen City | 10 | 2 | 4380.5, 1190.5 |
| IE-0001 | Dublin City-Docklands | 10 | 1 | 3953.5, 1264.5 |
| LI-0001 | Liechtenstein | 11 | 1 | 4313.5, 1450.5 |
| GB-0001 | City of London-Westminster | 12 | 1 | 4093.5, 1321.5 |
| JE-0001 | Jersey | 12 | 1 | 4046.5, 1389.5 |
| MD-0001 | Chisinau | 12 | 3 | 4752.5, 1452.5 |
| NL-0024 | Caribbean Netherlands | 12 | 1 | 2539.5, 2328.5 |
| ES-0001 | Madrid Centro | 13 | 2 | 4011.5, 1636.5 |
| PT-0001 | Lisbon City-Cascais | 14 | 1 | 3880.5, 1681.5 |
| BE-0002 | Brussels Outer Communes | 15 | 1 | 4194.5, 1340.5 |
| ES-0004 | Barcelona City | 15 | 2 | 4145.5, 1609.5 |
| FR-0044 | Mayotte | 16 | 1 | 5123.5, 2902.5 |
| CH-0004 | Geneva | 18 | 1 | 4236.5, 1475.5 |
| GB-0002 | East London-Docklands | 18 | 1 | 4096.5, 1321.5 |
| FI-0001 | Helsinki | 19 | 1 | 4662.5, 1042.5 |
| MT-0001 | Malta | 20 | 2 | 4424.5, 1756.5 |
| FR-0001 | Paris-La Defense | 23 | 1 | 4147.5, 1400.5 |
| TR-0002 | Levent-Maslak | 23 | 1 | 4754.5, 1616.5 |
| AT-0002 | Vienna Outer Districts | 27 | 1 | 4470.5, 1417.5 |
| GB-0003 | West London-Heathrow | 28 | 1 | 4088.5, 1322.5 |
| AD-0001 | Andorra | 32 | 1 | 4130.5, 1578.5 |
| NO-0002 | Oslo East-Groruddalen | 33 | 2 | 4342.5, 1049.5 |
| CH-0001 | Zurich | 35 | 1 | 4289.5, 1444.5 |
| DE-0017 | Bremen-Bremerhaven | 35 | 2 | 4294.5, 1271.5 |
| IE-0002 | South Dublin-Dun Laoghaire | 35 | 1 | 3950.5, 1266.5 |
| LV-0001 | Riga | 35 | 1 | 4644.5, 1149.5 |
| TR-0004 | Kadikoy-Uskudar | 38 | 1 | 4760.5, 1617.5 |
| DE-0014 | Berlin East-Spree | 39 | 1 | 4403.5, 1291.5 |
| CH-0002 | Zurich Airport-Unterland | 40 | 1 | 4288.5, 1439.5 |
| IE-0003 | Fingal-Dublin Airport | 40 | 1 | 3954.5, 1258.5 |
| CH-0013 | Basel-Landschaft | 42 | 1 | 4274.5, 1440.5 |
| CZ-0001 | Prague | 42 | 1 | 4424.5, 1364.5 |
| HU-0001 | Budapest | 42 | 1 | 4530.5, 1440.5 |
| DE-0013 | Berlin Mitte-West | 45 | 1 | 4397.5, 1290.5 |
| FR-0041 | Martinique | 45 | 1 | 2706.5, 2272.5 |
| PT-0015 | Madeira | 45 | 3 | 3710.5, 1837.5 |
| DE-0001 | Stuttgart-Boeblingen | 47 | 1 | 4302.5, 1403.5 |
| NL-0001 | Amsterdam | 47 | 1 | 4208.5, 1295.5 |
| NL-0005 | The Hague-Delft | 47 | 2 | 4193.5, 1305.5 |
| BE-0004 | Antwerp Port-Waasland | 48 | 1 | 4191.5, 1330.5 |
| HR-0001 | Zagreb | 50 | 1 | 4458.5, 1487.5 |
| UA-0019 | Sevastopol | 54 | 1 | 4861.5, 1523.5 |
| FI-0016 | Aland Islands | 55 | 12 | 4548.5, 1044.5 |
| IM-0001 | Isle of Man | 56 | 1 | 3994.5, 1235.5 |
| NL-0004 | Rotterdam | 57 | 4 | 4200.5, 1308.5 |
| DK-0002 | Copenhagen Suburbs-Novo | 58 | 2 | 4377.5, 1190.5 |
| NL-0002 | Haarlem-Schiphol-IJmond | 58 | 1 | 4201.5, 1295.5 |
| BE-0003 | Antwerp City | 59 | 2 | 4198.5, 1326.5 |
| IT-0002 | Milan Hinterland | 59 | 1 | 4312.5, 1503.5 |
| BY-0001 | Minsk | 60 | 1 | 4723.5, 1247.5 |
| NL-0017 | Maastricht-South Limburg | 61 | 1 | 4229.5, 1340.5 |
| DK-0004 | Bornholm | 62 | 1 | 4433.5, 1208.5 |
| CH-0003 | Winterthur-Oberland | 63 | 1 | 4295.5, 1439.5 |

## Anchor cities

Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own name names lands on that province (and, for a Metro province, near its middle and in its largest 4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a province of that Metro, and each key city lands on one of its provinces (key-cities.csv).

All anchors land on their own provinces.

## Known for review

- RUS:Donbas is drawn by our own province file (decision C): all of Luhansk oblast and the Russian-held part of Donetsk oblast, cut from Donetsk oblast by a builder-drawn line close to the 2015 contact line (Horlivka, Donetsk and Novoazovsk Russian; Mariupol, Kramatorsk and Sloviansk Ukrainian, UA-0016).
- RUS:Crimea follows Natural Earth's Crimea and Sevastopol units (Natural Earth already draws them in Russia).
- MD-0006 Transnistria takes Natural Earth's Transnistria and Stinga Nistrului units with Camenca, Grigoriopol and Bender.
- CY-0005 Northern Cyprus is Natural Earth's Northern Cyprus (CYN) unit; the UN buffer zone and the British sovereign base areas belong to no province.

## Watched small provinces

The microstates, city-states and metro splits the plan names (P8: Singapore, the London and Beijing splits, Hong Kong and Macau): every one has pixels, and a tiny one a click target at its label point.

| Province | Name | Pixels | Tiny | Label point (px) |
|---|---|---|---|---|
| GB-0001 | City of London-Westminster | 12 | Y | 4093.5, 1321.5 |
| GB-0002 | East London-Docklands | 18 | Y | 4096.5, 1321.5 |
| GB-0003 | West London-Heathrow | 28 | Y | 4088.5, 1322.5 |
| GB-0004 | Outer London Suburbs | 88 | N | 4090.5, 1318.5 |
| GI-0001 | Gibraltar | 1 | Y | 3974.5, 1750.5 |
| IM-0001 | Isle of Man | 56 | Y | 3994.5, 1235.5 |
| LU-0001 | Luxembourg | 223 | N | 4235.5, 1375.5 |
| LI-0001 | Liechtenstein | 11 | Y | 4313.5, 1450.5 |
| FO-0001 | Faroe Islands | 176 | N | 3934.5, 972.5 |
| MT-0001 | Malta | 20 | Y | 4424.5, 1756.5 |
| AD-0001 | Andorra | 32 | Y | 4130.5, 1578.5 |
| MC-0001 | Monaco | 2 | Y | 4264.5, 1545.5 |
| SM-0001 | San Marino | 5 | Y | 4379.5, 1539.5 |
| VA-0001 | Vatican City | 1 | Y | 4379.5, 1596.5 |
| GG-0001 | Guernsey | 5 | Y | 4037.5, 1381.5 |
| JE-0001 | Jersey | 12 | Y | 4046.5, 1389.5 |

## Contested provinces

Drawn by our own province files (decision C), not the sources' de facto lines: each contested province sits in the region the CSV gives it, built as listed (an alias or carve hint where Natural Earth draws the land elsewhere). The game hatches them.

| Province | Name | Country | Contested | Region drawn from |
|---|---|---|---|---|
| XK-0001 | Pristina | XKX | SRB claims | Kosovo: whole country (30 admin-1 units) |
| XK-0002 | Prizren-Ferizaj | XKX | SRB claims | Kosovo: whole country (30 admin-1 units) |
| XK-0003 | Peja-Gjakova | XKX | SRB claims | Kosovo: whole country (30 admin-1 units) |
| XK-0004 | Mitrovica-North | XKX | SRB claims | Kosovo: whole country (30 admin-1 units) |
| CY-0005 | Northern Cyprus | CYP | TRNC, TUR-backed | Northern Cyprus: name match 100 |
| UA-0019 | Sevastopol | RUS | UKR claims | Crimea: name match 100; plus unclaimed Sevastopol |
| UA-0020 | Simferopol-Kerch | RUS | UKR claims | Crimea: name match 100; plus unclaimed Sevastopol |
| UA-0021 | Donetsk | RUS | UKR claims | Donbas: alias hint -> UA-09; carve: builder polygon from UKR:Eastern Ukraine |
| UA-0022 | Luhansk | RUS | UKR claims | Donbas: alias hint -> UA-09; carve: builder polygon from UKR:Eastern Ukraine |
| MD-0006 | Transnistria | MDA | Transnistria, RUS-backed | Transnistria: alias hint -> MDA-1638, MDA-1628, MD-CAM, MD-GRI, MD-BD |

## Region matching

Regions not matched one-to-one by name: builder aliases, Natural Earth region groups, composite names matched part by part, carves (D676) and admin-1 units no region named, given to the touching region (D673). Check these on the preview too.

| Region | Matched by | Units |
|---|---|---|
| ALB: Central Albania | alias hint -> AL-11, AL-02, AL-03 | 3 |
| ALB: Northern Albania | alias hint -> AL-10, AL-08, AL-07, AL-09 | 4 |
| ALB: Southern Albania | alias hint -> AL-04, AL-12, AL-06, AL-01, AL-05 | 5 |
| BEL: Flanders | alias hint -> region:Flemish | 5 |
| BEL: Wallonia | alias hint -> region:Walloon | 5 |
| BGR: North-Central | alias hint -> BG-18, BG-04, BG-07, BG-17, BG-19 | 5 |
| BGR: North-East | alias hint -> BG-03, BG-08, BG-27, BG-25 | 4 |
| BGR: North-West | alias hint -> BG-15, BG-06, BG-05, BG-12, BG-11 | 5 |
| BGR: South-Central | alias hint -> BG-16, BG-13, BG-26, BG-09, BG-21 | 5 |
| BGR: South-East | alias hint -> BG-02, BG-24, BG-20, BG-28 | 4 |
| BGR: South-West | alias hint -> BG-22, BG-23, BG-14, BG-10, BG-01 | 5 |
| BIH: Federation of Bosnia and Herzegovina | alias hint -> region:Federacija Bosna i Hercegovina | 9 |
| BIH: Republika Srpska | Natural Earth region Repuplika Srpska (9 units, match 94) | 8 |
| BLR: Minsk City | alias hint -> BY-HM | 1 |
| BLR: Minsk Oblast | alias hint -> BY-MI | 1 |
| CHE: Central Switzerland | alias hint -> CH-LU, CH-ZG, CH-SZ, CH-UR, CH-NW, CH-OW | 6 |
| CHE: Eastern Switzerland | alias hint -> CH-SG, CH-AR, CH-AI, CH-TG, CH-SH, CH-GR, CH-GL | 7 |
| CHE: Espace Mittelland | alias hint -> CH-BE, CH-FR, CH-SO, CH-NE, CH-JU | 5 |
| CHE: Lake Geneva Region | alias hint -> CH-GE, CH-VD, CH-VS | 3 |
| CHE: Northwestern Switzerland | alias hint -> CH-BS, CH-BL, CH-AG | 3 |
| CHE: Zurich | alias hint -> CH-ZH | 1 |
| DNK: Capital Region | alias hint -> DK-84 | 1 |
| DNK: Central Jutland | alias hint -> DK-82 | 1 |
| DNK: North Jutland | alias hint -> DK-81 | 1 |
| DNK: Southern Denmark | alias hint -> DK-83 | 1 |
| DNK: Zealand | alias hint -> DK-85 | 1 |
| ESP: Andalusia | alias hint -> region:Andalucía | 8 |
| ESP: Aragon | Natural Earth region Aragón (3 units, match 100) | 3 |
| ESP: Basque Country | alias hint -> region:País Vasco | 3 |
| ESP: Canary Islands | alias hint -> region:Canary Is. | 2 |
| ESP: Castile and Leon | alias hint -> region:Castilla y León | 9 |
| ESP: Castile-La Mancha | Natural Earth region Castilla-La Mancha (5 units, match 91) | 5 |
| ESP: Catalonia | alias hint -> region:Cataluña | 4 |
| ESP: Extremadura | Natural Earth region Extremadura (2 units, match 100) | 2 |
| ESP: Galicia | Natural Earth region Galicia (4 units, match 100) | 4 |
| ESP: Region of Murcia | alias hint -> ES-MU | 1 |
| ESP: Valencian Community | alias hint -> region:Valenciana | 3 |
| EST: Central Estonia | alias hint -> EE-59, EE-51, EE-70 | 3 |
| EST: North-Eastern Estonia | alias hint -> EE-44 | 1 |
| EST: Northern Estonia | alias hint -> EE-37 | 1 |
| EST: Southern Estonia | alias hint -> EE-78, EE-49, EE-86, EE-82, EE-65, EE-84 | 6 |
| EST: Western Estonia | alias hint -> EE-67, EE-74, EE-39, EE-57 | 4 |
| FIN: Aland | alias hint -> ALD-4817, name:Brändö; plus unclaimed Eckerö, Föglö, Jomala, Kumlinge, Kökar, Lemland, Lumparland, Sottunga, Vårdö | 11 |
| FIN: Helsinki-Uusimaa | alias hint -> FI-18 | 1 |
| FIN: Northern and Eastern Finland | alias hint -> FI-14, FI-10, FI-15, FI-04, FI-13, FI-05 | 6 |
| FIN: Southern Finland | alias hint -> FI-19, FI-09, FI-02, FI-16, FI-06 | 5 |
| FIN: Western Finland | alias hint -> FI-11, FI-12, FI-07, FI-03, FI-08, FI-17 | 6 |
| FRA: Auvergne-Rhone-Alpes | Natural Earth region Auvergne-Rhône-Alpes (12 units, match 100) | 12 |
| FRA: Bourgogne-Franche-Comte | Natural Earth region Bourgogne-Franche-Comté (8 units, match 100) | 8 |
| FRA: Brittany | alias hint -> region:Bretagne | 4 |
| FRA: Centre-Val de Loire | Natural Earth region Centre-Val de Loire (6 units, match 100) | 6 |
| FRA: Corsica | name match 100; plus unclaimed Corse-du-Sud | 2 |
| FRA: Grand Est | Natural Earth region Grand Est (10 units, match 100) | 10 |
| FRA: Hauts-de-France | Natural Earth region Hauts-de-France (5 units, match 100) | 5 |
| FRA: Ile-de-France | Natural Earth region Île-de-France (8 units, match 100) | 8 |
| FRA: New Caledonia | alias hint -> NCL-559, NCL-1259, NCL-1258 | 3 |
| FRA: Normandy | alias hint -> region:Normandie | 5 |
| FRA: Nouvelle-Aquitaine | Natural Earth region Nouvelle-Aquitaine (12 units, match 100) | 12 |
| FRA: Occitanie | Natural Earth region Occitanie (13 units, match 100) | 13 |
| FRA: Pays de la Loire | Natural Earth region Pays de la Loire (5 units, match 100) | 5 |
| FRA: Provence-Alpes-Cote d'Azur | Natural Earth region Provence-Alpes-Côte-d'Azur (6 units, match 100) | 6 |
| GBR: East Midlands | Natural Earth region East Midlands (9 units, match 100) | 9 |
| GBR: East of England | alias hint -> region:East | 11 |
| GBR: London | alias hint -> region:Greater London | 33 |
| GBR: North East | Natural Earth region North East (12 units, match 100) | 12 |
| GBR: North West | Natural Earth region North West (23 units, match 100) | 23 |
| GBR: Northern Ireland | Natural Earth region Northern Ireland (26 units, match 100) | 26 |
| GBR: Scotland | alias hint -> region:Highlands and Islands, region:North Eastern, region:Eastern, region:South Western | 32 |
| GBR: South East | Natural Earth region South East (19 units, match 100) | 19 |
| GBR: South West | Natural Earth region South West (16 units, match 100) | 16 |
| GBR: Wales | alias hint -> region:West Wales and the Valleys, region:East Wales | 22 |
| GBR: West Midlands | alias hint -> region:West Midlands | 14 |
| GBR: Yorkshire and the Humber | Natural Earth region Yorkshire and the Humber (15 units, match 100) | 15 |
| GRC: Central Macedonia | name match 100; plus unclaimed Ayion Oros | 2 |
| HRV: Adriatic Croatia | alias hint -> HR-08, HR-09, HR-13, HR-15, HR-17, HR-18, HR-19 | 7 |
| HRV: City of Zagreb | alias hint -> HR-21 | 1 |
| HRV: Northern Croatia | alias hint -> HR-01, HR-02, HR-05, HR-06, HR-20 | 5 |
| HRV: Pannonian Croatia | alias hint -> HR-07, HRV-1604, HRV-1602, HR-14, HR-03, HR-04, HR-10, HR-16 | 8 |
| HUN: Central Transdanubia | Natural Earth region Central Transdanubia (7 units, match 100) | 7 |
| HUN: Northern Great Plain | Natural Earth region Northern Great Plain (6 units, match 100) | 6 |
| HUN: Northern Hungary | Natural Earth region Northern Hungary (6 units, match 100) | 6 |
| HUN: Pest | name match 100; plus unclaimed Érd | 2 |
| HUN: Southern Great Plain | alias hint -> region:Great Southern Plain | 7 |
| HUN: Southern Transdanubia | Natural Earth region Southern Transdanubia (6 units, match 100) | 6 |
| HUN: Western Transdanubia | Natural Earth region Western Transdanubia (8 units, match 100) | 8 |
| IRL: Eastern and Midland | alias hint -> region:Dublin, region:Mid-East, region:Midlands, IE-LH | 12 |
| IRL: Northern and Western | alias hint -> region:West, IE-CN, IE-DL, IE-LM, IE-MN, IE-SO | 9 |
| IRL: Southern | alias hint -> region:South-East, region:South-West, region:Mid-West | 13 |
| ITA: Abruzzo | Natural Earth region Abruzzo (4 units, match 100) | 4 |
| ITA: Aosta Valley | alias hint -> region:Valle d'Aosta | 1 |
| ITA: Apulia | Natural Earth region Apulia (6 units, match 100) | 6 |
| ITA: Basilicata | Natural Earth region Basilicata (2 units, match 100) | 2 |
| ITA: Calabria | Natural Earth region Calabria (5 units, match 100) | 5 |
| ITA: Campania | Natural Earth region Campania (5 units, match 100) | 5 |
| ITA: Emilia-Romagna | Natural Earth region Emilia-Romagna (9 units, match 100) | 9 |
| ITA: Friuli-Venezia Giulia | Natural Earth region Friuli-Venezia Giulia (4 units, match 100) | 4 |
| ITA: Lazio | Natural Earth region Lazio (5 units, match 100) | 5 |
| ITA: Liguria | Natural Earth region Liguria (4 units, match 100) | 4 |
| ITA: Lombardy | alias hint -> region:Lombardia | 12 |
| ITA: Marche | Natural Earth region Marche (5 units, match 100) | 5 |
| ITA: Molise | Natural Earth region Molise (2 units, match 100) | 2 |
| ITA: Piedmont | alias hint -> region:Piemonte | 8 |
| ITA: Sardinia | alias hint -> region:Sardegna | 8 |
| ITA: Sicily | Natural Earth region Sicily (9 units, match 100) | 9 |
| ITA: Trentino-South Tyrol | alias hint -> region:Trentino-Alto Adige | 2 |
| ITA: Tuscany | alias hint -> region:Toscana | 10 |
| ITA: Umbria | Natural Earth region Umbria (2 units, match 100) | 2 |
| ITA: Veneto | Natural Earth region Veneto (7 units, match 100) | 7 |
| LTU: Capital Region | alias hint -> LT-VL | 1 |
| LTU: Central and Western Lithuania | alias hint -> LT-KU, LT-KL, LT-MR, LT-PN, LT-TA, LT-TE, LT-UT, LT-SA, LT-AL | 9 |
| LVA: Kurzeme | Natural Earth region Kurzeme (20 units, match 100) | 20 |
| LVA: Latgale | Natural Earth region Latgale (21 units, match 100) | 21 |
| LVA: Pieriga | alias hint -> region:Riga, -LV-RIX | 29 |
| LVA: Riga | alias hint -> LV-RIX | 1 |
| LVA: Vidzeme | Natural Earth region Vidzeme (26 units, match 100) | 26 |
| LVA: Zemgale | Natural Earth region Zemgale (22 units, match 100) | 22 |
| MDA: Central Moldova | alias hint -> MD-AN, MD-CL, MD-CR, MD-HI, MD-IA, MD-NI, MD-OR, MDA-1645, MDA-1644, MD-ST, MD-TE, MD-UN, MD-SD | 13 |
| MDA: North Moldova | alias hint -> MD-BA, MD-BR, MD-DO, MD-DR, MD-ED, MD-FL, MD-FA, MD-GL, MD-OC, MD-RI, MD-SO, MD-SI | 12 |
| MDA: South Moldova | alias hint -> MD-BS, MD-CA, MD-CT, MD-CS, MD-CM, MD-LE, MD-TA, MD-SV | 8 |
| MDA: Transnistria | alias hint -> MDA-1638, MDA-1628, MD-CAM, MD-GRI, MD-BD | 5 |
| MNE: Central Montenegro | alias hint -> ME-16, ME-12, ME-06, ME-07 | 4 |
| MNE: Coastal Montenegro | alias hint -> ME-02, ME-05, ME-08, ME-10, ME-19, ME-20 | 6 |
| MNE: Northern Montenegro | alias hint -> ME-01, ME-03, ME-04, ME-09, ME-11, ME-13, ME-14, ME-15, ME-17, ME-18, ME-21 | 11 |
| NLD: Caribbean Netherlands | alias hint -> NL-BQ1, NL-BQ2, NL-BQ3 | 3 |
| NOR: Agder | alias hint -> NO-09, NO-10 | 2 |
| NOR: Innlandet | alias hint -> NO-04, NO-05 | 2 |
| NOR: Trondelag | alias hint -> NO-16, NO-17 | 2 |
| NOR: Vestland | alias hint -> NO-12, NO-14 | 2 |
| POL: Lodz | alias hint -> PL-LD | 1 |
| PRT: Alentejo | Natural Earth region Alentejo (4 units, match 100) | 4 |
| PRT: Algarve | Natural Earth region Algarve (1 units, match 100) | 1 |
| PRT: Centro | Natural Earth region Centro (5 units, match 100); plus unclaimed Aveiro | 6 |
| PRT: Lisbon Metropolitan Area | alias hint -> PT-11, PT-15 | 2 |
| PRT: Norte | Natural Earth region Norte (5 units, match 100) | 5 |
| ROU: Bucharest-Ilfov | name parts (2 pieces, worst match 100) | 2 |
| ROU: Centre | alias hint -> RO-AB, RO-BV, RO-CV, RO-HR, RO-MS, RO-SB | 6 |
| ROU: North-East | alias hint -> RO-BC, RO-BT, RO-IS, RO-NT, RO-SV, RO-VS | 6 |
| ROU: North-West | alias hint -> RO-BH, RO-BN, RO-CJ, RO-MM, RO-SM, RO-SJ | 6 |
| ROU: South-East | alias hint -> RO-BR, RO-BZ, RO-CT, RO-GL, RO-VN, RO-TL | 6 |
| ROU: South-Muntenia | alias hint -> RO-AG, RO-CL, RO-DB, RO-GR, RO-IL, RO-PH, RO-TR | 7 |
| ROU: South-West Oltenia | alias hint -> RO-DJ, RO-GJ, RO-MH, RO-OT, RO-VL | 5 |
| ROU: West | alias hint -> RO-AR, RO-CS, RO-HD, RO-TM | 4 |
| RUS: Crimea | name match 100; plus unclaimed Sevastopol | 2 |
| RUS: Donbas | alias hint -> UA-09; carve: builder polygon from UKR:Eastern Ukraine | 1 |
| SRB: Southern and Eastern Serbia | alias hint -> RS-14, RS-11, RS-15, RS-23, RS-20, RS-22, RS-24, RS-21 | 8 |
| SRB: Sumadija and Western Serbia | alias hint -> RS-16, RS-09, RS-08, RS-17, RS-13, RS-19, RS-18, RS-12, RS-10 | 9 |
| SRB: Vojvodina | alias hint -> RS-01, RS-02, RS-03, RS-04, RS-05, RS-06, RS-07 | 7 |
| SVN: Eastern Slovenia | alias hint -> region:Pomurska, region:Podravska, region:Koroška, region:Savinjska, region:Zasavska, region:Spodnjeposavska, region:Jugovzhodna Slovenija | 126 |
| SVN: Western Slovenia | alias hint -> region:Osrednjeslovenska, region:Gorenjska, region:Goriška, region:Obalno-kraška, region:Notranjsko-kraška | 67 |
| TUR: Aegean | alias hint -> TR-35, TR-09, TR-20, TR-48, TR-45, TR-03, TR-43, TR-64 | 8 |
| TUR: Central Anatolia | alias hint -> TR-71, TR-68, TR-51, TR-50, TR-40, TR-38, TR-58, TR-66 | 8 |
| TUR: Central East Anatolia | alias hint -> TR-44, TR-23, TR-12, TR-62, TR-65, TR-49, TR-13, TR-30 | 8 |
| TUR: East Black Sea | alias hint -> TR-61, TR-52, TR-28, TR-53, TR-08, TR-29 | 6 |
| TUR: East Marmara | alias hint -> TR-16, TR-26, TR-11, TR-41, TR-54, TR-81, TR-14, TR-77 | 8 |
| TUR: Mediterranean | alias hint -> TR-07, TR-32, TR-15, TR-01, TR-33, TR-31, TR-46, TR-80 | 8 |
| TUR: Northeast Anatolia | alias hint -> TR-25, TR-24, TR-69, TR-04, TR-36, TR-76, TR-75 | 7 |
| TUR: Southeast Anatolia | alias hint -> TR-27, TR-02, TR-79, TR-63, TR-21, TR-47, TR-72, TR-73, TR-56 | 9 |
| TUR: West Anatolia | alias hint -> TR-06, TR-42, TR-70 | 3 |
| TUR: West Black Sea | alias hint -> TR-67, TR-78, TR-74, TR-37, TR-18, TR-57, TR-55, TR-60, TR-19, TR-05 | 10 |
| TUR: West Marmara | alias hint -> TR-59, TR-22, TR-39, TR-10, TR-17 | 5 |
| UKR: Central Ukraine | alias hint -> UA-05, UA-71, UA-35, UA-53 | 4 |
| UKR: Eastern Ukraine | alias hint -> UA-63, UA-12, UA-23, UA-14; less RUS:Donbas (carve) | 4 |
| UKR: Kyiv and the North | alias hint -> UA-30, UA-32, UA-18, UA-74, UA-59 | 5 |
| UKR: Southern Ukraine | alias hint -> UA-51, UA-65, UA-48 | 3 |
| UKR: Western Ukraine | alias hint -> UA-46, UA-07, UA-56, UA-61, UA-68, UA-26, UA-21, UA-77 | 8 |

## Land without a province

Natural Earth admin-1 units of this file's countries that no region claims and that touch no region of their country (overseas territories, remote islands). They stay water on the map.

| Country (NE) | Unit | Area (sq deg) |
|---|---|---|
| NOR | Bouvet Island (BVT+00?) | 0.0076 |

## Sea links

`sea` rows of province-adjacency.csv with a province of this file: coastal provinces whose shapes do not touch but face each other across a strait (D678).

AL-0004-ME-0001, AL-0005-GR-0008, BE-0003-NL-0023, DE-0037-DE-0041, DE-0038-NL-0020, DE-0040-DK-0006, DE-0040-DK-0007, DE-0041-DK-0007, DE-0042-DK-0006, DK-0001-SE-0011, DK-0002-SE-0011, DK-0003-DK-0006, DK-0003-SE-0011, DK-0004-SE-0011, DK-0005-SE-0011, DK-0006-DK-0007, DK-0006-DK-0011, DK-0006-DK-0013, DK-0006-SE-0011, DK-0007-DK-0010, DK-0007-DK-0011, DK-0012-DK-0014, DK-0013-SE-0012, DK-0015-SE-0012, DK-0015-SE-0013, EE-0001-FI-0002, EE-0003-LV-0004, ES-0010-ES-0035, ES-0012-GI-0001, ES-0035-GI-0001, FI-0001-FI-0004, FI-0005-FI-0016, FI-0009-SE-0022, FI-0016-SE-0001, FR-0012-JE-0001, FR-0016-IT-0024, FR-0016-IT-0040, FR-0022-GB-0008, FR-0025-GG-0001, FR-0025-JE-0001, GB-0014-GB-0039, GB-0015-GB-0040, GB-0017-GB-0039, GB-0017-GB-0040, GB-0023-GB-0030, GB-0025-GB-0041, GB-0027-IM-0001, GB-0033-GB-0042, GB-0033-IE-0014, GB-0034-GB-0037, GB-0035-GB-0042, GB-0035-IM-0001, GB-0042-IE-0014, GB-0042-IM-0001, GG-0001-JE-0001, GR-0001-GR-0013, GR-0001-GR-0014, GR-0004-GR-0012, GR-0004-TR-0007, GR-0006-GR-0008, GR-0010-GR-0011, GR-0010-GR-0013, GR-0012-GR-0013, GR-0012-TR-0007, GR-0012-TR-0008, GR-0013-GR-0014, GR-0013-TR-0010, HR-0006-IT-0014, HR-0006-IT-0019, IE-0013-IE-0014, IT-0013-MC-0001, IT-0014-IT-0022, IT-0031-IT-0036, IT-0036-IT-0038, NO-0001-NO-0003, NO-0004-NO-0005, NO-0004-NO-0006, TR-0003-TR-0004, TR-0003-TR-0005, TR-0003-TR-0012, TR-0005-TR-0012

## Small provinces

| Province | Name | Region | Pixels | Region mean |
|---|---|---|---|---|
| CH-0012 | Basel City | Northwestern Switzerland | 2 | 51 |
| IE-0001 | Dublin City-Docklands | Eastern and Midland | 10 | 229 |
| IS-0002 | Reykjanes-South Iceland | Iceland | 127 | 5466 |

## Uneven Voronoi splits

Blocks (ADM2 units, or admin-1 units for Greenland) that several provinces share, where one province takes most of the block. Check that the larger part belongs where it went.

| Region | Block | Shares |
|---|---|---|
| AUT:Tyrol | part-1 | AT-0013 78%, AT-0012 22% |
| AUT:Vienna | part-0 | AT-0002 81%, AT-0001 19% |
| BEL:Brussels-Capital Region | part-0 | BE-0002 86%, BE-0001 14% |
| DEU:Thuringia | part-0 | DE-0049 85%, DE-0050 15% |
| ESP:Catalonia | Barcelona | ES-0005 97%, ES-0004 3% |
| ITA:Lazio | Roma | IT-0007 88%, IT-0008 12% |
| LTU:Capital Region | part-0 | LT-0002 81%, LT-0001 19% |
| NOR:Vestland | Hordaland | NO-0012 79%, NO-0011 21% |
| PRT:Lisbon Metropolitan Area | Lisboa | PT-0002 93%, PT-0001 7% |
| TUR:Istanbul | part-1 | TR-0003 85%, TR-0002 12%, TR-0001 3% |

## Named places outside their province

A Natural Earth place matched in the name or notes that ended up in another province (usually a neighbour that names the same city more directly, as Long Beach-Harbor's notes name Los Angeles).

| Province | Name | Place | Lies in |
|---|---|---|---|
| CH-0013 | Basel-Landschaft | Basel | CH-0012 |
| DE-0007 | Munich North-Ingolstadt | Munich | DE-0006 |
| DE-0008 | Augsburg-Munich West | Munich | DE-0006 |
| FR-0003 | Orly-Saclay | Paris | FR-0001 |
| FR-0004 | Versailles-Seine-et-Marne | Paris | FR-0001 |
| IE-0003 | Fingal-Dublin Airport | Dublin | IE-0001 |
| IT-0008 | Lazio Outside Rome | Rome | IT-0007 |
| IT-0002 | Milan Hinterland | Milan | IT-0001 |
| TR-0017 | Ankara Industrial Ring | Ankara | TR-0016 |
| UA-0015 | Zaporizhzhia | Dnipro | UA-0013 |
| UA-0002 | Kyiv Oblast | Kyiv | UA-0001 |

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| AL-0003 | Tirana | 12 | Y | N |
| BA-0004 | Herzegovina-Western Bosnia | 4 | Y | N |
| BE-0003 | Antwerp City | 1 | N | Y |
| BE-0004 | Antwerp Port-Waasland | 1 | N | Y |
| BE-0007 | Ghent | 0 | N | Y |
| BG-0009 | Dobrich-Shumen | 26 | Y | N |
| CY-0001 | Nicosia | 5 | Y | N |
| EE-0004 | Rakvere-Paide | 31 | Y | N |
| ES-0036 | Melilla | 1 | N | Y |
| FI-0003 | Vantaa-Airport | 8 | Y | N |
| FR-0021 | Lille Metropole | 13 | Y | N |
| GB-0001 | City of London-Westminster | 0 | N | Y |
| GB-0002 | East London-Docklands | 0 | N | Y |
| GB-0016 | Wiltshire-Gloucestershire | 16 | Y | N |
| GB-0026 | Cheshire-Warrington | 5 | Y | N |
| GB-0029 | Sheffield-South Yorkshire | 20 | Y | N |
| GI-0001 | Gibraltar | 3 | N | Y |
| IE-0001 | Dublin City-Docklands | 3 | N | Y |
| IE-0004 | Kildare-Wicklow | 21 | Y | N |
| IT-0007 | Rome | 29 | Y | N |
| IT-0015 | Verona-Vicenza | 4 | Y | N |
| IT-0020 | Bologna-Ferrara | 13 | Y | N |
| IT-0023 | Florence-Prato | 8 | Y | N |
| IT-0032 | Caserta-Benevento | 14 | Y | N |
| IT-0035 | Basilicata | 21 | Y | N |
| LV-0003 | Vidzeme | 0 | N | Y |
| MC-0001 | Monaco | 2 | N | Y |
| NL-0001 | Amsterdam | 0 | N | Y |
| NL-0010 | Tilburg-Breda | 6 | Y | N |
| NL-0022 | Flevoland | 0 | N | Y |
| NO-0002 | Oslo East-Groruddalen | 2 | N | Y |
| NO-0005 | Buskerud | 31 | Y | N |
| TR-0001 | Historic Peninsula-Beyoglu | 2 | N | Y |
| UA-0015 | Zaporizhzhia | 88 | Y | N |
| UA-0021 | Donetsk | 12 | Y | N |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

GR-0013 (46), GB-0038 (45), NO-0016 (37), NO-0017 (28), NO-0020 (28), FI-0005 (25), HR-0008 (23), NO-0012 (22), GB-0033 (18), SE-0001 (18), HR-0009 (15), FO-0001 (14), NO-0018 (14), SE-0023 (14), FI-0016 (12), FR-0045 (12), GR-0001 (12), NO-0013 (12), GR-0007 (10), HR-0006 (10), NO-0015 (10), UA-0018 (10), ES-0026 (9), NL-0020 (9), NO-0014 (9), PT-0014 (9), DE-0038 (8), DE-0041 (8), DE-0043 (8), DK-0006 (8), GR-0008 (8), GR-0012 (8), IT-0040 (8), EE-0003 (7), ES-0030 (7), FI-0009 (7), HR-0007 (7), IS-0001 (7), PL-0017 (7), TR-0007 (7), ES-0020 (6), IS-0003 (6), IT-0014 (6), IT-0024 (6), IT-0038 (6), SE-0022 (6), AT-0013 (5), DE-0042 (5), DK-0007 (5), FR-0033 (5), GB-0009 (5), IE-0007 (5), IT-0037 (5), NO-0011 (5), CH-0016 (4), DE-0037 (4), DE-0040 (4), DK-0011 (4), ES-0032 (4), FI-0002 (4), FI-0004 (4), GR-0006 (4), IE-0012 (4), IT-0025 (4), LT-0003 (4), MD-0006 (4), NL-0003 (4), NL-0004 (4), NL-0018 (4), NO-0009 (4), RO-0011 (4), RS-0002 (4), SE-0008 (4), SE-0009 (4), AL-0005 (3), AT-0012 (3), BE-0016 (3), BY-0011 (3), CH-0005 (3), CH-0009 (3), CY-0005 (3), DE-0005 (3), DE-0036 (3), DK-0008 (3), DK-0014 (3), DK-0015 (3), EE-0001 (3), ES-0024 (3), FI-0011 (3), FR-0013 (3), FR-0027 (3), FR-0035 (3), FR-0039 (3), FR-0040 (3), GR-0004 (3), GR-0010 (3), GR-0014 (3), IE-0010 (3), IE-0014 (3), IT-0007 (3), IT-0019 (3), IT-0020 (3), IT-0030 (3), MD-0001 (3), MD-0005 (3), NL-0023 (3), NO-0004 (3), NO-0008 (3), PT-0003 (3), PT-0008 (3), PT-0012 (3), PT-0015 (3), RO-0010 (3), RO-0012 (3), RO-0015 (3), RO-0018 (3), SE-0003 (3), SE-0014 (3), SE-0020 (3), UA-0017 (3), AL-0001 (2), AL-0003 (2), AL-0004 (2), AT-0005 (2), AT-0007 (2), AT-0011 (2), BE-0003 (2), BE-0012 (2), BE-0013 (2), BE-0018 (2), BY-0003 (2), BY-0004 (2), BY-0005 (2), BY-0009 (2), CH-0006 (2), CH-0010 (2), CH-0011 (2), CY-0003 (2), CY-0004 (2), DE-0003 (2), DE-0017 (2), DE-0023 (2), DE-0029 (2), DE-0047 (2), DK-0001 (2), DK-0002 (2), DK-0009 (2), DK-0010 (2), DK-0012 (2), DK-0013 (2), ES-0001 (2), ES-0002 (2), ES-0004 (2), ES-0006 (2), ES-0007 (2), ES-0010 (2), ES-0015 (2), ES-0019 (2), ES-0025 (2), ES-0033 (2), FI-0003 (2), FI-0006 (2), FI-0007 (2), FI-0012 (2), FI-0015 (2), FR-0003 (2), FR-0006 (2), FR-0008 (2), FR-0011 (2), FR-0012 (2), FR-0021 (2), FR-0024 (2), FR-0026 (2), FR-0034 (2), FR-0042 (2), GB-0005 (2), GB-0007 (2), GB-0013 (2), GB-0015 (2), GB-0017 (2), GB-0021 (2), GB-0037 (2), GB-0041 (2), GB-0042 (2), GG-0001 (2), GR-0002 (2), GR-0003 (2), GR-0005 (2), GR-0009 (2), GR-0011 (2), HU-0005 (2), HU-0006 (2), HU-0009 (2), HU-0012 (2), IE-0008 (2), IE-0013 (2), IT-0006 (2), IT-0008 (2), IT-0022 (2), IT-0026 (2), IT-0032 (2), IT-0036 (2), LT-0007 (2), LV-0003 (2), MD-0002 (2), MD-0004 (2), ME-0001 (2), MT-0001 (2), NL-0005 (2), NL-0010 (2), NL-0011 (2), NL-0012 (2), NL-0016 (2), NO-0002 (2), NO-0007 (2), NO-0010 (2), PL-0005 (2), PL-0012 (2), PL-0024 (2), PT-0002 (2), RS-0005 (2), RS-0006 (2), RS-0007 (2), SE-0004 (2), SE-0005 (2), SE-0010 (2), SE-0011 (2), SE-0013 (2), SI-0007 (2), SK-0006 (2), SK-0007 (2), TR-0001 (2), TR-0010 (2), TR-0022 (2), TR-0032 (2), TR-0034 (2), UA-0007 (2), UA-0012 (2), UA-0014 (2)

## Visual check

`preview-europe.png` in this folder is province-ids.png around the region (pixels x 3222..5609, y 430..2197, scaled by 1.01; outside the frame: FR-0040, FR-0041, FR-0042, FR-0043, FR-0044, FR-0045, NL-0024, NO-0020).
