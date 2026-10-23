# Map QA report: east-asia-oceania

_Written by `tools/map-pipeline/run.py --region east-asia-oceania` (pipeline pb-1). Source of the rows: `provinces-east-asia-oceania.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 606 provinces of `provinces-east-asia-oceania.csv` have a crosswalk row and pixels (90 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 606 |
| ... AUS | 53 |
| ... BRN | 4 |
| ... CHN | 145 |
| ... FJI | 4 |
| ... FSM | 1 |
| ... HKG | 3 |
| ... IDN | 51 |
| ... JPN | 63 |
| ... KHM | 12 |
| ... KIR | 1 |
| ... KOR | 35 |
| ... LAO | 10 |
| ... MAC | 1 |
| ... MHL | 1 |
| ... MMR | 21 |
| ... MNG | 15 |
| ... MYS | 23 |
| ... NRU | 1 |
| ... NZL | 16 |
| ... PHL | 29 |
| ... PLW | 1 |
| ... PNG | 12 |
| ... PRK | 11 |
| ... SGP | 3 |
| ... SLB | 3 |
| ... THA | 30 |
| ... TLS | 3 |
| ... TON | 1 |
| ... TUV | 1 |
| ... TWN | 22 |
| ... VNM | 27 |
| ... VUT | 2 |
| ... WSM | 1 |
| Regions matched | 345 of 345 |
| Provinces by method: admin1 | 289 |
| Provinces by method: admin2 | 249 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 68 |
| Flagged for review (confidence < 0.6) | 0 |
| Placed by a builder hint (`hints/east-asia-oceania.toml`) | 95 |
| Tiny (under 64 px) | 90 |
| Given a pixel at their interior point (no pixel centre inside) | 1 |
| More than one part (islands, exclaves) | 273 |
| Coastal flag differs from the CSV | 63 |
| Small for their region (not Metro, under 5% of the region's mean) | 3 |
| Voronoi-split blocks where one province takes 75% or more | 3 |
| Places named in a province's name or notes that lie in another province | 5 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 24 |
| Admin-1 units left without a province | 5 |
| Sea links with a province of this file | 86 |
| City probe points (fail on a mismatch; D686) | 134 pass, 0 mismatch, 13 listed |
| Metro reach scan rows (listed; D686) | 13 |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) | 6 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes) | Public domain | yes |
| geoBoundaries gbOpen AUS ADM2 (Australian Bureau of Statistics) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen CHN ADM2 (National Administration of Surveying, Mapping and Geoinformation of China, Revolutionary GIS) | Open Data Commons Public Domain Dedication and License (PDDL) v1.0 | yes |
| geoBoundaries gbOpen IDN ADM2 (Badan Pusat Statistik (BPS - Statistics Indonesia), World Food Programme, OCHA ROAP) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen JPN ADM2 (OpenStreetMap, Wambacher) | Creative Commons Attribution-ShareAlike 2.0 | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 2.0); Voronoi path |
| geoBoundaries gbOpen KOR ADM2 (geoBoundaries, citypopulation.de) | Creative Commons Attribution 3.0 License | yes |
| geoBoundaries gbOpen MMR ADM2 (Myanmar Analytics Project, USAID/Burma) | Creative Commons Attribution 4.0 (CC BY 4.0) | yes |
| geoBoundaries gbOpen MNG ADM2 (National Statistical Office of Mongolia, OCHA ROAP) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen MYS ADM2 (geoBoundaries, citypopulation.de) | Creative Commons Attribution 3.0 License | yes |
| geoBoundaries gbOpen NZL ADM2 (Stats NZ) | Creative Commons Attribution 4.0 International (CC BY 4.0) | yes |
| geoBoundaries gbOpen PHL ADM2 (National Mapping and Resource Information Authority (NAMRIA), Philippines Statistics Authority (PSA), OCHA Philippines) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen SGP ADM2 (geoBoundaries, Urban Redevelopment Authority) | Singapore Open Data License Version 1.0 | yes |
| geoBoundaries gbOpen THA ADM2 (Royal Thai Survey Department, OCHA ROAP) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen TWN ADM2 (OpenStreetMap, Wambacher) | Creative Commons Attribution-ShareAlike 2.0 | no: refused: ShareAlike in license (Creative Commons Attribution-ShareAlike 2.0); Voronoi path |
| geoBoundaries gbOpen VNM ADM2 (OCHA ROAP, Government of Viet Nam) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |

Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, public domain and the attribution-only government licences OGL-Canada 2.0, OGL-UK 3.0, Data licence Germany Attribution 2.0, Etalab 2.0, Spain's INE licence, Singapore ODL 1.0 and Korea OGL Type 1 (D685); a region whose country has no allowed ADM2 is split by Voronoi.

Provenance to check (for Logan; these files pass the allowlist and are used):

- KOR ADM2: CC BY, but the source is citypopulation.de, which republishes national statistics offices' maps
- MYS ADM2: CC BY, but the source is citypopulation.de, which republishes national statistics offices' maps

## Low-confidence rows for review

None.

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| AU-0001 | Sydney CBD-North Shore | seeds: point 151.1,-33.7 (hint); point 151.18,-33.8 (hint); point 151.21,-33.87 (hint); point 151.24,-33.78 (hint); 11 whole admin2 units, split: Sydney |
| AU-0002 | Western Sydney-Parramatta | seeds: point 150.69,-33.75 (hint); point 150.81,-34.07 (hint); point 150.91,-33.77 (hint); point 150.92,-33.92 (hint); point 151.0,-33.82 (hint); point 151.18,-33.94 (hint); point 151.21,-33.97 (hint) (snapped to land); 18 whole admin2 units |
| AU-0013 | South Coast-Snowy | seeds: point 149.13,-36.24 (hint); point 149.84,-36.67 (hint); point 150.18,-35.71 (hint); 9 whole admin2 units |
| AU-0015 | Melbourne CBD-East | seeds: place Melbourne; point 145.12,-37.82 (hint); point 145.21,-37.99 (hint); unit Melbourne at place Melbourne; 16 whole admin2 units |
| AU-0016 | Melbourne West-North | seeds: point 144.66,-37.9 (hint); point 144.83,-37.87 (hint); point 144.84,-37.69 (hint); point 144.9,-37.8 (hint); point 144.92,-37.68 (hint); 8 whole admin2 units, split: Hume |
| CN-0001 | Central Beijing-Financial Street | seeds: point 116.37,39.91 (hint); point 116.41,39.93 (hint); 0 whole admin2 units, split: Beijingshi |
| CN-0002 | Chaoyang-Shunyi | seeds: point 116.47,39.93 (hint); point 116.53,40.0 (hint); point 116.65,40.13 (hint); point 116.84,40.38 (hint); point 117.12,40.14 (hint); 4 whole admin2 units, split: Beijingshi |
| CN-0003 | Haidian-Changping | seeds: point 115.9,39.94 (hint); point 115.97,40.46 (hint); point 116.23,40.22 (hint); point 116.3,39.96 (hint); 2 whole admin2 units, split: Beijingshi |
| CN-0004 | Fengtai-Daxing-Yizhuang | seeds: point 116.14,39.73 (hint); point 116.29,39.86 (hint); point 116.34,39.73 (hint); point 116.51,39.79 (hint); point 116.66,39.91 (hint); 2 whole admin2 units, split: Beijingshi |
| CN-0005 | Tianjin Heping-Nankai | seeds: point 117.15,39.12 (hint); point 117.2,39.12 (hint); 0 whole admin2 units, split: Tianjinshi |
| CN-0006 | Binhai New Area | seeds: point 117.48,38.84 (hint); point 117.7,39.03 (hint); point 117.8,39.25 (hint); 1 whole admin2 units, split: Tianjinshi |
| CN-0007 | Wuqing-Beichen-Jinghai | seeds: point 116.93,38.94 (hint); point 117.04,39.38 (hint); point 117.13,39.22 (hint); point 117.41,40.05 (hint); 4 whole admin2 units, split: Tianjinshi |
| CN-0008 | Lujiazui-Pudong | seeds: point 121.51,31.24 (hint); point 121.6,31.2 (hint); 0 whole admin2 units, split: Fengxianxian, Shanghaishi |
| CN-0009 | Puxi Center | seeds: point 121.33,31.2 (hint); point 121.44,31.19 (hint); point 121.48,31.23 (hint); 0 whole admin2 units, split: Shanghaishi |
| CN-0010 | Minhang-Songjiang-Jinshan | seeds: point 121.22,31.03 (hint); point 121.34,30.74 (hint); point 121.38,31.11 (hint); 2 whole admin2 units, split: Shanghaishi |
| CN-0011 | Jiading-Qingpu | seeds: point 121.12,31.15 (hint); point 121.25,31.38 (hint); 1 whole admin2 units, split: Shanghaishi |
| CN-0012 | Baoshan-Waigaoqiao | seeds: point 121.4,31.62 (hint); point 121.49,31.4 (hint); point 121.6,31.35 (hint) (snapped to land); 1 whole admin2 units, split: Fengxianxian, Shanghaishi |
| CN-0013 | Lingang-Yangshan | seeds: point 121.76,31.05 (hint); point 121.92,30.9 (hint) (snapped to land); 2 whole admin2 units |
| CN-0014 | Yuzhong-Jiangbei | seeds: point 106.57,29.56 (hint); point 106.57,29.6 (hint); 0 whole admin2 units, split: Congqingshi |
| CN-0015 | Shapingba-Xiyong | seeds: point 106.32,29.6 (hint); point 106.45,29.45 (hint); point 106.46,29.54 (hint); 2 whole admin2 units, split: Congqingshi |
| CN-0016 | Liangjiang-Yubei | seeds: point 106.63,29.72 (hint); point 106.65,29.65 (hint); point 106.79,29.83 (hint); 1 whole admin2 units |
| CN-0017 | Western Chongqing | seeds: point 105.72,29.7 (hint); point 105.93,29.36 (hint); point 106.26,29.29 (hint); point 106.27,30.0 (hint); 9 whole admin2 units |
| CN-0018 | Three Gorges-Southeast Chongqing | seeds: point 107.39,29.7 (hint); point 108.38,30.81 (hint); point 108.77,29.53 (hint); 20 whole admin2 units |
| CN-0019 | Shenzhen Futian-Nanshan | seeds: point 113.93,22.53 (hint); point 114.05,22.54 (hint); 0 whole admin2 units, split: Shenzhenshi |
| CN-0020 | Shenzhen Bao'an-Longhua | seeds: point 113.88,22.58 (hint); point 114.03,22.66 (hint); 0 whole admin2 units, split: Shenzhenxian |
| CN-0021 | Shenzhen Longgang-Yantian | seeds: point 114.24,22.58 (hint); point 114.25,22.72 (hint); point 114.35,22.7 (hint); 0 whole admin2 units, split: Shenzhenxian, Shenzhenshi |
| CN-0024 | Guangzhou Tianhe-Yuexiu | seeds: point 113.27,23.13 (hint); point 113.33,23.13 (hint); 0 whole admin2 units, split: Guangzhoushi |
| CN-0025 | Guangzhou Huangpu-Nansha | seeds: point 113.48,23.11 (hint); point 113.53,22.8 (hint); 1 whole admin2 units, split: Guangzhoushi |
| CN-0026 | Guangzhou North-Baiyun | seeds: point 113.22,23.4 (hint); point 113.27,23.25 (hint); point 113.59,23.55 (hint); point 113.81,23.29 (hint); 6 whole admin2 units, split: Guangzhoushi |
| CN-0032 | Kunshan-Taicang | seeds: point 120.55,31.87 (hint); point 120.75,31.65 (hint); point 120.98,31.39 (hint); point 121.1,31.46 (hint); 6 whole admin2 units |
| CN-0034 | Nanjing Xinjiekou-Gulou | seeds: point 118.77,32.07 (hint); point 118.78,32.04 (hint); 0 whole admin2 units, split: Nanjingshi |
| CN-0035 | Nanjing Jiangning-Jiangbei | seeds: point 118.7,32.15 (hint); point 118.84,31.95 (hint); point 118.85,32.3 (hint); point 119.03,31.65 (hint); 6 whole admin2 units, split: Nanjingshi |
| CN-0039 | Hangzhou Shangcheng-Binjiang | seeds: point 120.17,30.25 (hint); point 120.21,30.21 (hint); 1 whole admin2 units, split: Xiaoshanshi |
| CN-0040 | Hangzhou Yuhang-Xiaoshan | seeds: point 120.06,30.29 (hint); point 120.26,30.18 (hint); point 120.3,30.42 (hint); point 120.43,30.23 (hint); 6 whole admin2 units, split: Xiaoshanshi |
| CN-0044 | Qingdao Shinan-Laoshan | seeds: point 120.38,36.07 (hint); point 120.45,36.39 (hint); point 120.47,36.1 (hint); 5 whole admin2 units |
| CN-0045 | Qingdao Huangdao-West Coast | seeds: point 120.03,35.87 (hint) (snapped to land); point 120.2,35.96 (hint); 3 whole admin2 units |
| CN-0050 | Dongying-Binzhou | seeds: point 118.02,37.38 (hint); point 118.67,37.43 (hint); 13 whole admin2 units |
| CN-0057 | Zhengzhou Jinshui-Zhengdong | seeds: point 113.66,34.8 (hint); point 113.73,34.77 (hint); 2 whole admin2 units |
| CN-0058 | Zhengzhou Airport-Xinzheng | seeds: point 113.74,34.39 (hint); point 113.84,34.53 (hint); 6 whole admin2 units |
| CN-0063 | Wuhan Hankou-Jianghan | seeds: point 114.25,30.63 (hint); point 114.27,30.59 (hint); 2 whole admin2 units, split: Wuhanshi |
| CN-0064 | Wuchang-Optics Valley | seeds: point 114.31,30.55 (hint); point 114.37,30.38 (hint); point 114.4,30.5 (hint); 2 whole admin2 units, split: Wuhanshi |
| CN-0065 | Hanyang-Wuhan Economic Zone | seeds: point 114.15,30.5 (hint); point 114.22,30.55 (hint); point 114.55,30.66 (hint); 6 whole admin2 units, split: Wuhanshi |
| CN-0085 | Chengdu Jinjiang-Tianfu | seeds: point 104.07,30.42 (hint); point 104.08,30.66 (hint); 2 whole admin2 units, split: Chengdushi, Suangliuxian |
| CN-0086 | Chengdu High-tech West | seeds: point 103.95,30.65 (hint); point 104.05,30.58 (hint); 0 whole admin2 units, split: Chengdushi, Suangliuxian |
| CN-0087 | Chengdu North-Xindu | seeds: point 104.16,30.82 (hint); point 104.25,30.88 (hint); 2 whole admin2 units, split: Chengdushi |
| CN-0088 | Chengdu East-Longquanyi | seeds: point 104.27,30.56 (hint); point 104.44,30.32 (hint); point 104.55,30.39 (hint); 5 whole admin2 units, split: Chengdushi |
| CN-0089 | Chengdu West-Wenjiang-Pidu | seeds: point 103.62,31.0 (hint); point 103.84,30.69 (hint); point 103.89,30.8 (hint); 6 whole admin2 units |
| CN-0102 | Shenyang Heping-Shenhe | seeds: point 123.4,41.79 (hint); point 123.45,41.8 (hint); 0 whole admin2 units, split: Shenyangshi |
| CN-0103 | Shenyang Tiexi-Hunnan | seeds: point 123.25,41.75 (hint); point 123.35,41.8 (hint); point 123.5,41.7 (hint); 2 whole admin2 units, split: Shenyangshi |
| CN-0111 | Harbin Nangang-Daoli | seeds: point 126.61,45.77 (hint); point 126.65,45.76 (hint); 0 whole admin2 units, split: Haerbinshi |
| CN-0112 | Harbin Songbei-Pingfang | seeds: point 126.55,45.81 (hint); point 126.62,45.6 (hint); 4 whole admin2 units, split: Haerbinshi |
| CN-0118 | Ordos-Bayannur-Alxa | seeds: point 105.67,38.84 (hint); point 107.39,40.74 (hint); point 109.78,39.61 (hint); 16 whole admin2 units |
| CN-0127 | Southern Yunnan | seeds: point 100.09,23.88 (hint); point 100.8,22.01 (hint); point 100.97,22.78 (hint); point 101.57,21.47 (hint); 21 whole admin2 units |
| HK-0001 | Hong Kong Island-Central | seeds: unit Central and Western (hint); unit Eastern (hint); unit Southern (hint); unit Wan Chai (hint); 4 whole admin1 units |
| HK-0002 | Kowloon | seeds: unit Kowloon City (hint); unit Kwun Tong (hint); unit Sham Shui Po (hint); unit Wong Tai Sin (hint); unit Yau Tsim Mong (hint); 5 whole admin1 units |
| HK-0003 | New Territories-Lantau | seeds: unit Islands (hint); unit Kwai Tsing (hint); unit North (hint); unit Sai Kung (hint); unit Sha Tin (hint); unit Tai Po (hint); unit Tsuen Wan (hint); unit Tuen Mun (hint); unit Yuen Long (hint); 9 whole admin1 units |
| ID-0001 | Central-South Jakarta | seeds: unit Kota Jakarta Pusat (hint); unit Kota Jakarta Selatan (hint); 2 whole admin2 units |
| ID-0002 | North-West Jakarta | seeds: unit Kota Jakarta Barat (hint); unit Kota Jakarta Utara (hint); 2 whole admin2 units |
| ID-0003 | East Jakarta | seeds: unit Kota Jakarta Timur (hint); 2 whole admin2 units |
| ID-0005 | Bogor-Depok | seeds: unit Bogor (hint); unit Kota Bogor (hint); unit Kota Depok (hint); 3 whole admin2 units |
| ID-0021 | Madura | seeds: unit Bangkalan (hint); unit Pamekasan (hint); unit Sampang (hint); unit Sumenep (hint); 4 whole admin2 units |
| ID-0031 | Riau Palm Lands | seeds: point 101.6,-0.5 (hint); point 102.3,0.1 (hint); point 102.6,-0.4 (hint); point 103.2,-0.3 (hint); 5 whole admin2 units |
| JP-0001 | Central Tokyo | seeds: point 139.76,35.68 (hint); 0 whole parts, 1 split |
| JP-0002 | Tokyo West Wards | seeds: point 139.64,35.7 (hint); point 139.65,35.64 (hint); point 139.65,35.74 (hint); point 139.7,35.66 (hint); point 139.71,35.73 (hint); 0 whole parts, 1 split |
| JP-0003 | Tokyo East Wards-Bay | seeds: point 139.72,35.56 (hint); point 139.78,35.62 (hint); point 139.8,35.78 (hint); point 139.82,35.67 (hint); point 139.87,35.7 (hint); 22 whole parts, 1 split |
| JP-0007 | West Kanagawa | seeds: point 139.16,35.26 (hint); point 139.35,35.33 (hint); point 139.36,35.44 (hint); point 139.49,35.34 (hint); 0 whole parts, 1 split |
| JP-0008 | South Saitama | seeds: point 139.47,35.8 (hint); point 139.65,35.86 (hint); point 139.72,35.81 (hint); 0 whole parts, 1 split |
| JP-0009 | North Saitama | seeds: point 139.09,35.99 (hint); point 139.19,36.12 (hint); point 139.39,36.15 (hint); 0 whole parts, 1 split |
| JP-0010 | Chiba Bay-Funabashi | seeds: point 139.9,35.79 (hint); point 139.98,35.69 (hint); point 140.05,35.65 (hint); point 140.12,35.61 (hint); 0 whole parts, 1 split |
| JP-0011 | Boso-Narita | seeds: point 140.1,35.05 (hint) (snapped to land); point 140.25,35.35 (hint); point 140.32,35.77 (hint); point 140.6,35.72 (hint); 0 whole parts, 1 split |
| JP-0034 | Nagoya City | seeds: point 136.91,35.17 (hint); 0 whole parts, 1 split |
| JP-0035 | Owari-Nagoya Port | seeds: point 136.8,35.3 (hint); point 136.81,34.86 (hint); point 136.88,35.09 (hint) (snapped to land); point 136.94,35.29 (hint); point 136.97,35.25 (hint); 1 whole parts, 1 split |
| JP-0036 | Toyota-Mikawa | seeds: point 137.16,35.08 (hint); point 137.17,34.95 (hint); point 137.39,34.77 (hint); 0 whole parts, 1 split |
| JP-0037 | Osaka Kita-Chuo | seeds: point 135.5,34.67 (hint); point 135.5,34.7 (hint); 0 whole parts, 1 split |
| JP-0038 | North-East Osaka | seeds: point 135.47,34.78 (hint); point 135.52,34.76 (hint); point 135.6,34.67 (hint); point 135.62,34.85 (hint); point 135.65,34.81 (hint); 0 whole parts, 1 split |
| JP-0039 | South Osaka-Sakai | seeds: point 135.24,34.43 (hint); point 135.37,34.46 (hint); point 135.48,34.57 (hint); 1 whole parts, 1 split |
| JP-0041 | West Hyogo | seeds: point 134.69,34.82 (hint); point 134.7,35.1 (hint); point 134.85,34.4 (hint); 1 whole parts, 1 split |
| KR-0001 | Seoul Gangbuk-Yeouido | seeds: unit Dobong-gu (hint); unit Dongdaemun-gu (hint); unit Eunpyeong-gu (hint); unit Gangbuk-gu (hint); unit Gangseo-gu (hint); unit Geumcheon-gu (hint); unit Guro-gu (hint); unit Gwangjin-gu (hint); unit Jongno-gu (hint); unit Jung-gu [Central District] (hint); unit Jungnang-gu (hint); unit Mapo-gu (hint); unit Nowon-gu (hint); unit Seodaemun-gu (hint); unit Seongbuk-gu (hint); unit Seongdong-gu (hint); unit Yangcheon-gu (hint); unit Yeongdeungpo-gu (hint); unit Yongsan-gu (hint); 19 whole admin2 units |
| KR-0002 | Seoul Gangnam-Songpa | seeds: unit Dongjak-gu (hint); unit Gangdong-gu (hint); unit Gangnam-gu (hint); unit Gwanak-gu (hint); unit Seocho-gu (hint); unit Songpa-gu (hint); 6 whole admin2 units |
| KR-0018 | Chungju-Northern Chungbuk | seeds: point 127.93,36.99 (hint); point 128.19,37.13 (hint); point 128.37,36.98 (hint); 5 whole admin2 units |
| KR-0026 | Naju-Central Jeonnam | seeds: point 126.71,35.02 (hint); point 126.78,35.3 (hint); point 126.99,35.06 (hint); point 126.99,35.32 (hint); 11 whole admin2 units |
| KR-0034 | Jinju-Western Gyeongnam | seeds: point 127.72,35.52 (hint); point 127.76,35.07 (hint); point 127.89,34.84 (hint); point 128.06,35.0 (hint); point 128.08,35.18 (hint); 9 whole admin2 units |
| MM-0001 | Yangon Downtown-Port | seeds: point 96.16,16.78 (hint); 2 whole admin2 units |
| MM-0002 | Yangon North-Hlaingthaya | seeds: point 96.07,16.87 (hint); point 96.1,16.95 (hint); point 96.13,16.91 (hint); 1 whole admin2 units |
| MM-0003 | Thanlyin-Thilawa | seeds: point 96.25,16.76 (hint); point 96.26,16.66 (hint); point 96.33,16.6 (hint); 1 whole admin2 units |
| MM-0012 | Eastern Delta | seeds: point 95.4,16.29 (hint); point 95.65,16.73 (hint); point 95.68,16.28 (hint); 3 whole admin2 units |
| MN-0005 | Oyu Tolgoi-Khanbogd | seeds: point 105.3,42.45 (hint); point 106.86,43.01 (hint); point 107.2,43.2 (hint); 4 whole admin2 units |
| PH-0026 | Davao Provinces | seeds: unit Compostela Valley (hint); unit Davao Oriental (hint); unit Davao del Norte (hint); unit Davao del Sur (hint); 4 whole admin1 units |
| SG-0001 | Downtown Core-Marina Bay | seeds: unit Central Singapore (hint); 1 whole admin1 units |
| SG-0002 | West Singapore-Jurong | seeds: unit North West (hint); unit South West (hint); 2 whole admin1 units |
| SG-0003 | East Singapore-Changi | seeds: unit North East (hint); unit South East (hint); 2 whole admin1 units |
| VN-0001 | Saigon Center | seeds: point 106.7,10.78 (hint); 16 whole admin2 units |
| VN-0002 | Thu Duc-Eastern Saigon | seeds: unit Can Gio (hint); unit Quan 2 (hint); unit Quan 9 (hint); unit Thu Duc (hint); 9 whole admin2 units |
| VN-0025 | Hanoi Hoan Kiem-Ba Dinh | seeds: unit Ba Dinh (hint); unit Dong Da (hint); unit Gia Lam (hint); unit Hai Ba Trung (hint); unit Hoan Kiem (hint); unit Hoang Mai (hint); unit Long Bien (hint); unit Tay Ho (hint); unit Thanh Xuan (hint); 17 whole admin2 units |
| VN-0026 | Hanoi West-Hoa Lac | seeds: point 105.52,21.01 (hint); point 105.77,21.03 (hint); point 105.8,21.22 (hint); 23 whole admin2 units |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| MO-0001 | Macau | 1 | 1 | 6679.5, 2096.5 |
| NR-0001 | Nauru | 1 | 1 | 7894.5, 2621.5 |
| TV-0001 | Tuvalu | 1 | 1 | 8173.5, 2803.5 |
| HK-0002 | Kowloon | 2 | 1 | 6694.5, 2093.5 |
| PH-0001 | Makati-BGC | 2 | 1 | 6850.5, 2275.5 |
| JP-0001 | Central Tokyo | 3 | 1 | 7275.5, 1761.5 |
| MH-0001 | Marshall Islands | 3 | 3 | 7992.5, 2448.5 |
| MY-0023 | Labuan | 3 | 1 | 6718.5, 2487.5 |
| PH-0002 | Manila-Pasay | 3 | 2 | 6849.5, 2275.5 |
| TW-0013 | Chiayi City | 3 | 1 | 6835.5, 2065.5 |
| TW-0020 | Penghu | 3 | 2 | 6817.5, 2063.5 |
| HK-0001 | Hong Kong Island-Central | 5 | 1 | 6693.5, 2094.5 |
| SG-0001 | Downtown Core-Marina Bay | 5 | 1 | 6459.5, 2577.5 |
| SG-0003 | East Singapore-Changi | 5 | 1 | 6460.5, 2578.5 |
| AU-0014 | Canberra | 6 | 2 | 7485.5, 3452.5 |
| TW-0006 | Keelung | 6 | 1 | 6864.5, 2025.5 |
| TW-0022 | Matsu | 7 | 1 | 6825.5, 1998.5 |
| TW-0004 | Hsinchu City | 8 | 1 | 6848.5, 2034.5 |
| CN-0019 | Shenzhen Futian-Nanshan | 9 | 3 | 6692.5, 2086.5 |
| ID-0001 | Central-South Jakarta | 9 | 1 | 6526.5, 2752.5 |
| KR-0011 | Gwangju | 9 | 1 | 6984.5, 1774.5 |
| TW-0021 | Kinmen | 9 | 1 | 6790.5, 2040.5 |
| JP-0006 | Kawasaki-Sagamihara | 10 | 1 | 7274.5, 1766.5 |
| CN-0001 | Central Beijing-Financial Street | 11 | 1 | 6744.5, 1650.5 |
| ID-0017 | Surabaya City | 11 | 2 | 6661.5, 2775.5 |
| JP-0037 | Osaka Kita-Chuo | 11 | 1 | 7178.5, 1787.5 |
| MY-0001 | Kuala Lumpur City | 11 | 1 | 6409.5, 2537.5 |
| SG-0002 | West Singapore-Jurong | 11 | 1 | 6456.5, 2578.5 |
| ID-0003 | East Jakarta | 12 | 1 | 6529.5, 2751.5 |
| PH-0004 | South Metro Manila | 12 | 2 | 6850.5, 2278.5 |
| JP-0034 | Nagoya City | 13 | 1 | 7210.5, 1774.5 |
| KR-0002 | Seoul Gangnam-Songpa | 13 | 1 | 6988.5, 1714.5 |
| ID-0002 | North-West Jakarta | 14 | 1 | 6524.5, 2748.5 |
| TH-0002 | Thonburi-Bangkok West | 14 | 1 | 6380.5, 2296.5 |
| KR-0008 | Busan | 15 | 1 | 7033.5, 1774.5 |
| PH-0003 | Quezon City-North | 15 | 1 | 6850.5, 2273.5 |
| TL-0001 | Dili | 15 | 2 | 6954.5, 2804.5 |
| TW-0001 | Taipei | 16 | 1 | 6862.5, 2027.5 |
| KH-0001 | Phnom Penh | 17 | 1 | 6482.5, 2345.5 |
| CN-0086 | Chengdu High-tech West | 18 | 1 | 6460.5, 1891.5 |
| JP-0005 | Yokohama | 20 | 1 | 7272.5, 1768.5 |
| KR-0001 | Seoul Gangbuk-Yeouido | 20 | 1 | 6986.5, 1712.5 |
| KR-0003 | Incheon | 21 | 3 | 6978.5, 1715.5 |
| KR-0012 | Daejeon | 21 | 1 | 6994.5, 1744.5 |
| MM-0001 | Yangon Downtown-Port | 21 | 1 | 6285.5, 2221.5 |
| CN-0008 | Lujiazui-Pudong | 22 | 1 | 6863.5, 1875.5 |
| CN-0009 | Puxi Center | 22 | 1 | 6858.5, 1874.5 |
| CN-0024 | Guangzhou Tianhe-Yuexiu | 23 | 1 | 6674.5, 2074.5 |
| PW-0001 | Palau | 23 | 7 | 7158.5, 2437.5 |
| VN-0001 | Saigon Center | 23 | 2 | 6521.5, 2363.5 |
| BN-0001 | Brunei-Muara | 24 | 1 | 6709.5, 2498.5 |
| KR-0013 | Sejong | 25 | 1 | 6989.5, 1737.5 |
| FM-0001 | Micronesia | 27 | 7 | 7696.5, 2452.5 |
| CN-0014 | Yuzhong-Jiangbei | 29 | 3 | 6517.5, 1910.5 |
| CN-0039 | Hangzhou Shangcheng-Binjiang | 29 | 2 | 6829.5, 1901.5 |
| JP-0002 | Tokyo West Wards | 29 | 1 | 7273.5, 1762.5 |
| TO-0001 | Tonga | 29 | 12 | 136.5, 3038.5 |
| AU-0001 | Sydney CBD-North Shore | 30 | 1 | 7533.5, 3404.5 |
| KR-0010 | Daegu | 30 | 1 | 7023.5, 1756.5 |
| JP-0003 | Tokyo East Wards-Bay | 32 | 11 | 7276.5, 1759.5 |
| KI-0001 | Kiribati | 39 | 23 | 514.5, 2567.5 |
| JP-0038 | North-East Osaka | 40 | 1 | 7181.5, 1784.5 |
| TH-0003 | Samut Prakan | 40 | 1 | 6388.5, 2298.5 |
| VN-0027 | Bac Ninh | 40 | 1 | 6510.5, 2122.5 |
| CN-0020 | Shenzhen Bao'an-Longhua | 41 | 1 | 6687.5, 2083.5 |
| CN-0034 | Nanjing Xinjiekou-Gulou | 41 | 1 | 6799.5, 1854.5 |
| CN-0021 | Shenzhen Longgang-Yantian | 42 | 1 | 6696.5, 2084.5 |
| HK-0003 | New Territories-Lantau | 42 | 3 | 6692.5, 2090.5 |
| BN-0003 | Tutong | 43 | 1 | 6704.5, 2503.5 |
| CN-0111 | Harbin Nangang-Daoli | 44 | 1 | 6979.5, 1489.5 |
| VN-0020 | Hai Phong | 45 | 1 | 6521.5, 2128.5 |
| MY-0005 | Penang | 47 | 2 | 6381.5, 2484.5 |
| CN-0025 | Guangzhou Huangpu-Nansha | 49 | 4 | 6676.5, 2077.5 |
| KP-0011 | Rason | 51 | 1 | 7065.5, 1582.5 |
| BN-0004 | Temburong | 53 | 1 | 6715.5, 2502.5 |
| TH-0001 | Bangkok Silom-Sukhumvit | 54 | 1 | 6386.5, 2293.5 |
| JP-0039 | South Osaka-Sakai | 56 | 1 | 7179.5, 1792.5 |
| CN-0011 | Jiading-Qingpu | 57 | 1 | 6855.5, 1871.5 |
| ID-0008 | Bandung Raya-Cimahi | 57 | 1 | 6541.5, 2765.5 |
| PH-0005 | Cavite | 57 | 1 | 6847.5, 2282.5 |
| KH-0003 | Sihanoukville | 58 | 2 | 6455.5, 2366.5 |
| TW-0010 | Changhua | 58 | 1 | 6837.5, 2053.5 |
| ID-0011 | Tangerang | 59 | 1 | 6520.5, 2750.5 |
| KR-0009 | Ulsan | 59 | 1 | 7036.5, 1766.5 |
| KR-0019 | Cheonan-Asan | 60 | 1 | 6986.5, 1733.5 |
| TW-0012 | Yunlin | 60 | 1 | 6834.5, 2059.5 |
| JP-0004 | Tama | 62 | 1 | 7267.5, 1762.5 |
| KR-0033 | Geoje-Tongyeong | 62 | 2 | 7015.5, 1779.5 |
| VN-0002 | Thu Duc-Eastern Saigon | 62 | 3 | 6525.5, 2362.5 |
| FJ-0004 | Fiji Eastern Islands | 63 | 25 | 8154.5, 3046.5 |

## Anchor cities

Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own name names lands on that province (and, for a Metro province, near its middle and in its largest 4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a province of that Metro, and each key city lands on one of its provinces (key-cities.csv).

| Check | Province | Place | Expected | Got |
|---|---|---|---|---|
| own name elsewhere (allowed) | CN-0002 | Chaoyang | CN-0002 (Chaoyang district of Beijing, not Chaoyang city in Liaoning) | CN-0106 |
| own name elsewhere (allowed) | CN-0012 | Baoshan | CN-0012 (Baoshan district of Shanghai, not Baoshan city in Yunnan) | CN-0128 |
| city on the edge | JP-0006 | Kawasaki | JP-0006 | JP-0003 |
| city on the edge | ID-0004 | Bekasi | ID-0004 | ID-0003 |
| city part across water | PH-0002 | Manila | the largest 4-connected part | a smaller part, joined to it across water only |
| own name elsewhere (allowed) | AU-0023 | Goulburn | AU-0023 (the Goulburn valley of Victoria, not Goulburn town in New South Wales) | AU-0013 |

No misses; the rows above are allowed: a city part across a narrow strait, or a city whose own pixel a neighbour took while its province holds a touching pixel.

## Natural Earth labels

Natural Earth units whose capital another region of the country names (in a province name or notes) while their own region does not: the sign of NE giving units each other's names, as in Eritrea and Guyana (D687). Each row fails the step unless `[review] ne_label_ok` in the hints names the region.

| Region | NE unit | Capital | Named by |
|---|---|---|---|
| THA:Sakon Nakhon-Roi Et-Mekong (checked) | Sakon Nakhon (THA-447) | Sakhon Nakhon | THA:Samut Sakhon-Nakhon Pathom |

## City probe

Points of `tools/map-pipeline/checks/city-points.txt` whose expected province is in this file, looked up in province-index.png: a point passes on its pixel or one of the 8 around it (D686). The step fails on a mismatch.

| Point | Expected | Got | Result |
|---|---|---|---|
| Aksai Chin (79.5, 35.2) | ? | CN-0144 | listed |
| Bowral (150.42, -34.48) | ? | AU-0004 | listed |
| Chiba east Narita (140.32, 35.77) | ? | JP-0011 | listed |
| Fangshan (116.14, 39.73) | ? | CN-0004 | listed |
| Huairou (116.63, 40.32) | ? | CN-0002 | listed |
| Katoomba (150.31, -33.71) | ? | AU-0002 | listed |
| Mentougou (116.1, 39.94) | ? | CN-0003 | listed |
| Miyun (116.84, 40.38) | ? | CN-0002 | listed |
| Pinggu (117.12, 40.14) | ? | CN-0002 | listed |
| Pudong airport (121.8, 31.15) | ? | CN-0013 | listed |
| Tongzhou (116.66, 39.91) | ? | CN-0004 | listed |
| Windsor Hawkesbury (150.81, -33.61) | ? | AU-0003 | listed |
| Yanqing (115.97, 40.46) | ? | CN-0003 | listed |
| Ansan (126.83, 37.32) | KR-0005 | KR-0005 | on it |
| Anting (121.16, 31.3) | CN-0011 | CN-0011 | on it |
| Apia (-171.76, -13.83) | WS | WS-0001 | on it |
| Auckland (174.76, -36.85) | NZ | NZ-0001 | nearest across water |
| Bangkok Silom (100.53, 13.73) | TH-0001 | TH-0001 | on it |
| Banqiao (121.46, 25.01) | TW-0002 | TW-0002 | on it |
| Bao'an airport (113.81, 22.64) | CN-0020 | CN-0020 | on it |
| Baoshan SH (121.49, 31.4) | CN-0012 | CN-0012 | on it |
| Beijing Capital airport (116.6, 40.08) | CN-0002 | CN-0002 | on it |
| Beijing Tiananmen (116.397, 39.908) | CN-0001 | CN-0001 | on it |
| Beijing Xicheng Fin St (116.36, 39.915) | CN-0001 | CN-0001 | on it |
| Bekasi (106.99, -6.24) | ID-0004 | ID-0003 | within a pixel |
| Blacktown (150.91, -33.77) | AU-0002 | AU-0002 | on it |
| Bogor (106.8, -6.6) | ID-0005 | ID-0005 | on it |
| Brunei BSB (114.94, 4.89) | BN | BN-0001 | on it |
| Caloocan North (121.04, 14.75) | PH-0003 | PH-0003 | on it |
| Campbelltown (150.81, -34.07) | AU-0002 | AU-0002 | on it |
| Changi (103.99, 1.36) | SG-0003 | SG-0003 | on it |
| Changping (116.23, 40.22) | CN-0003 | CN-0003 | on it |
| Chaoyang CBD (116.46, 39.91) | CN-0002 | CN-0002 | on it |
| Chatswood (151.18, -33.8) | AU-0001 | AU-0001 | on it |
| Chek Lap Kok (113.92, 22.31) | HK-0003 | HK-0003 | nearest across water |
| Chongming (121.4, 31.62) | CN-0012 | CN-0012 | on it |
| Chongqing (106.55, 29.56) | CN | CN-0014 | on it |
| Cibinong (106.85, -6.48) | ID-0005 | ID-0005 | on it |
| Cikarang (107.15, -6.3) | ID-0004 | ID-0004 | on it |
| Daxing airport (116.41, 39.51) | CN-0004 | CN-0004 | on it |
| Depok (106.82, -6.4) | ID-0005 | ID-0005 | on it |
| Depok center (106.82, -6.39) | ID-0005 | ID-0005 | on it |
| Dongguan (113.75, 23.02) | CN-0022 | CN-0022 | on it |
| Fengtai (116.29, 39.86) | CN-0004 | CN-0004 | on it |
| Foshan (113.12, 23.02) | CN-0027 | CN-0027 | on it |
| Funabashi (139.98, 35.69) | JP-0010 | JP-0010 | on it |
| Futian (114.06, 22.54) | CN-0019 | CN-0019 | on it |
| Gangnam (127.03, 37.5) | KR-0002 | KR-0002 | on it |
| Gosford (151.34, -33.43) | AU-0003 | AU-0003 | on it |
| Guangzhou Baiyun airport (113.3, 23.39) | CN-0026 | CN-0026 | on it |
| Guangzhou Tianhe (113.33, 23.13) | CN-0024 | CN-0024 | on it |
| HK Central (114.16, 22.28) | HK-0001 | HK-0001 | on it |
| Hachioji (139.32, 35.66) | JP-0004 | JP-0004 | on it |
| Halim (106.89, -6.27) | ID-0003 | ID-0003 | on it |
| Hampton Park NSW? Liverpool (150.92, -33.92) | AU-0002 | AU-0002 | on it |
| Haneda (139.78, 35.55) | JP-0003 | JP-0003 | on it |
| Hanoi (105.85, 21.03) | VN | VN-0025 | on it |
| Ho Chi Minh (106.7, 10.78) | VN | VN-0002 | on it |
| Hongqiao (121.33, 31.2) | CN-0009 | CN-0009 | on it |
| Hornsby (151.1, -33.7) | AU-0001 | AU-0001 | on it |
| Hsinchu (120.97, 24.8) | TW-0004 | TW-0004 | on it |
| Incheon (126.7, 37.46) | KR-0003 | KR-0003 | on it |
| Incheon airport (126.45, 37.46) | KR-0003 | KR-0003 | on it |
| Jakarta Monas (106.827, -6.175) | ID-0001 | ID-0002 | within a pixel |
| Jakarta SCBD (106.81, -6.225) | ID-0001 | ID-0001 | on it |
| Jing'an (121.45, 31.23) | CN-0009 | CN-0009 | on it |
| Jinshan (121.34, 30.74) | CN-0010 | CN-0010 | on it |
| Jurong (103.7, 1.33) | SG-0002 | SG-0002 | on it |
| Karawang (107.3, -6.32) | ID-0006 | ID-0006 | on it |
| Kawasaki (139.7, 35.53) | JP-0006 | JP-0006 | on it |
| Kinmen (118.35, 24.45) | TW-0021 | TW-0021 | on it |
| Kobe (135.19, 34.69) | JP-0040 | JP-0040 | on it |
| Kowloon Kwun Tong (114.22, 22.31) | HK-0002 | HK-0002 | on it |
| Kuala Lumpur (101.69, 3.14) | MY | MY-0001 | on it |
| Kyoto (135.76, 35.01) | JP-0042 | JP-0042 | on it |
| Lambasa (179.39, -16.43) | FJ | FJ-0003 | on it |
| Lingang (121.93, 30.9) | CN-0013 | CN-0013 | on it |
| Longgang (114.25, 22.72) | CN-0021 | CN-0021 | on it |
| Longhua (114.04, 22.66) | CN-0020 | CN-0020 | on it |
| Lujiazui (121.5, 31.24) | CN-0008 | CN-0009 | within a pixel |
| Macau (113.55, 22.19) | MO | MO-0001 | on it |
| Majuro (171.38, 7.09) | MH | MH-0001 | nearest across water |
| Makati (121.03, 14.555) | PH-0001 | PH-0001 | on it |
| Manila Intramuros (120.975, 14.59) | PH-0002 | PH-0002 | nearest across water |
| Matsu Nangan (119.94, 26.16) | TW-0022 | TW-0022 | on it |
| Melbourne (144.96, -37.81) | AU | AU-0015 | on it |
| Minhang (121.38, 31.11) | CN-0010 | CN-0010 | on it |
| Mong Kok (114.17, 22.32) | HK-0002 | HK-0002 | on it |
| Muntinlupa (121.04, 14.41) | PH-0004 | PH-0004 | on it |
| NAIA (121.02, 14.51) | PH-0002 | PH-0004 | within a pixel |
| Nansha (113.53, 22.8) | CN-0025 | CN-0025 | on it |
| Nanshan SZ (113.93, 22.53) | CN-0019 | CN-0019 | on it |
| Nauru (166.93, -0.53) | NR | NR-0001 | on it |
| Nerima (139.65, 35.74) | JP-0002 | JP-0002 | on it |
| Newcastle NSW (151.78, -32.93) | AU-0005 | AU-0005 | on it |
| Odaiba (139.775, 35.625) | JP-0003 | JP-0001 | within a pixel |
| Osaka Umeda (135.5, 34.7) | JP-0037 | JP-0037 | on it |
| Paju (126.78, 37.76) | KR-0006 | KR-0006 | on it |
| Palau Koror (134.48, 7.34) | PW | PW-0001 | nearest across water |
| Pangyo (127.11, 37.4) | KR-0004 | KR-0004 | on it |
| Parramatta (151.0, -33.815) | AU-0002 | AU-0002 | on it |
| Pasig (121.08, 14.575) | PH-0004,PH-0001 | PH-0004 | on it |
| Penghu (119.58, 23.57) | TW-0020 | TW-0020 | on it |
| Penrith (150.69, -33.75) | AU-0002 | AU-0002 | on it |
| Pluit (106.79, -6.12) | ID-0002 | ID-0002 | on it |
| Pohnpei (158.2, 6.92) | FM | FM-0001 | on it |
| Pyeongtaek (127.11, 36.99) | KR-0005 | KR-0005 | on it |
| Qingpu (121.12, 31.15) | CN-0011 | CN-0011 | on it |
| Quezon City (121.05, 14.65) | PH-0003 | PH-0003 | on it |
| Rangsit (100.62, 13.98) | TH-0004 | TH-0004 | on it |
| Saitama city (139.645, 35.86) | JP-0008 | JP-0008 | on it |
| Sakai (135.48, 34.57) | JP-0039 | JP-0039 | on it |
| Seoul Jongno (126.98, 37.57) | KR-0001 | KR-0001 | on it |
| Sha Tin (114.19, 22.38) | HK-0003 | HK-0003 | on it |
| Shibuya (139.7, 35.66) | JP-0002 | JP-0002 | on it |
| Shunyi (116.65, 40.13) | CN-0002 | CN-0002 | on it |
| Singapore Marina Bay (103.855, 1.28) | SG-0001 | SG-0001 | nearest across water |
| Soekarno-Hatta (106.66, -6.125) | ID-0011 | ID-0011 | on it |
| Songjiang (121.23, 31.03) | CN-0010 | CN-0010 | on it |
| Songpa (127.11, 37.51) | KR-0002 | KR-0002 | on it |
| Suva (178.44, -18.14) | FJ | FJ-0001 | on it |
| Suvarnabhumi (100.75, 13.69) | TH-0003 | TH-0003 | on it |
| Suwon (127.01, 37.27) | KR-0004 | KR-0004 | on it |
| Sydney CBD (151.21, -33.87) | AU-0001 | AU-0001 | on it |
| Sydney airport (151.18, -33.94) | AU-0002 | AU-0002 | on it |
| Taipei (121.56, 25.04) | TW-0001 | TW-0001 | on it |
| Tangerang (106.63, -6.18) | ID-0011 | ID-0011 | on it |
| Tanjung Priok (106.88, -6.1) | ID-0002 | ID-0002 | nearest across water |
| Taoyuan (121.3, 24.99) | TW-0003 | TW-0003 | on it |
| Tarawa (173.0, 1.42) | KI | KI-0001 | nearest across water |
| Taveuni (-179.97, -16.85) | FJ | FJ-0003 | on it |
| Thonburi (100.47, 13.72) | TH-0002 | TH-0001 | within a pixel |
| Tianjin (117.2, 39.13) | CN | CN-0005 | on it |
| Timor Dili (125.57, -8.56) | TL | TL-0001 | nearest across water |
| Tokyo Marunouchi (139.765, 35.68) | JP-0001 | JP-0001 | on it |
| Tonga Nukualofa (-175.2, -21.14) | TO | TO-0001 | nearest across water |
| Tuvalu Funafuti (179.19, -8.52) | TV | TV-0001 | nearest across water |
| Uijeongbu (127.04, 37.74) | KR-0006 | KR-0006 | on it |
| Waigaoqiao (121.6, 31.35) | CN-0012 | CN-0012 | nearest across water |
| Wollongong (150.89, -34.42) | AU-0004 | AU-0004 | on it |
| Wuhan (114.3, 30.59) | CN | CN-0063 | on it |
| Xiamen (118.09, 24.48) | CN | CN-0082 | on it |
| Yantian (114.27, 22.58) | CN-0021 | CN-0021 | nearest across water |
| Yeouido (126.925, 37.525) | KR-0001 | KR-0001 | on it |
| Yizhuang (116.51, 39.8) | CN-0004 | CN-0004 | on it |
| Yokohama (139.64, 35.45) | JP-0005 | JP-0005 | on it |
| Zhongguancun (116.31, 39.98) | CN-0003 | CN-0003 | on it |

## Metro reach

Metro provinces whose centroid is over 80 km from their Metro's city, that are over 4 times the Metro's median and 250 px, and regions where Metro provinces hold over 30% of the land beside rural ones (the D612 error). Listed for review; a Metro made of whole metropolitan units can be large by design.

| Check | Province or region | Detail |
|---|---|---|
| large for its Metro | CN-0088 Chengdu East-Longquanyi | 515 px, the Metro's median is 109 px (Metro Chengdu) |
| large for its Metro | CN-0089 Chengdu West-Wenjiang-Pidu | 465 px, the Metro's median is 109 px (Metro Chengdu) |
| large for its Metro | CN-0026 Guangzhou North-Baiyun | 494 px, the Metro's median is 98 px (Metro Guangzhou-Foshan) |
| far from its Metro city | CN-0031 Suzhou Industrial Park-Gusu | centroid 426 km from Suzhou (Metro Suzhou) |
| far from its Metro city | CN-0032 Kunshan-Taicang | centroid 424 km from Suzhou (Metro Suzhou) |
| far from its Metro city | ID-0006 Karawang-Purwakarta | centroid 83 km from Jakarta (Metro Jakarta) |
| large for its Metro | JP-0042 Kyoto | 270 px, the Metro's median is 56 px (Metro Osaka-Kobe) |
| far from its Metro city | JP-0003 Tokyo East Wards-Bay | centroid 210 km from Tokyo (Metro Tokyo-Yokohama) |
| Metro share of a region | IDN: West Java | Metro provinces hold 39% of 1581 px beside 2 rural |
| Metro share of a region | JPN: Saitama | Metro provinces hold 36% of 227 px beside 1 rural |
| Metro share of a region | KOR: Gyeonggi | Metro provinces hold 57% of 621 px beside 1 rural |
| Metro share of a region | MMR: Yangon | Metro provinces hold 52% of 442 px beside 1 rural |
| Metro share of a region | MYS: Selangor | Metro provinces hold 50% of 329 px beside 1 rural |

## Known for review

- PG-0003 Eastern Highlands-Simbu-Jiwaka: Natural Earth still has Jiwaka inside Western Highlands, so Jiwaka is drawn in Enga-Western Highlands.
- VNM: Natural Earth labels three provinces with region names (VN-53 Bac Kan as Dong Bac, VN-39 Dong Nai as Dong Nam Bo, VN-66 Hung Yen as Dong Bang Song Hong); they are matched by code. Vinh Phuc, which no province names, is drawn with Hanoi.
- TW-0022 Matsu: Natural Earth 10m has no land for the Matsu islands; the province is a builder-drawn polygon around Nangan and Beigan (a click target).

## Watched small provinces

The microstates, city-states and metro splits the plan names (P8: Singapore, the London and Beijing splits, Hong Kong and Macau): every one has pixels, and a tiny one a click target at its label point.

| Province | Name | Pixels | Tiny | Label point (px) |
|---|---|---|---|---|
| CN-0001 | Central Beijing-Financial Street | 11 | Y | 6744.5, 1650.5 |
| CN-0002 | Chaoyang-Shunyi | 426 | N | 6754.5, 1638.5 |
| CN-0003 | Haidian-Changping | 398 | N | 6739.5, 1643.5 |
| CN-0004 | Fengtai-Daxing-Yizhuang | 220 | N | 6739.5, 1654.5 |
| TW-0020 | Penghu | 3 | Y | 6817.5, 2063.5 |
| TW-0021 | Kinmen | 9 | Y | 6790.5, 2040.5 |
| TW-0022 | Matsu | 7 | Y | 6825.5, 1998.5 |
| HK-0001 | Hong Kong Island-Central | 5 | Y | 6693.5, 2094.5 |
| HK-0002 | Kowloon | 2 | Y | 6694.5, 2093.5 |
| HK-0003 | New Territories-Lantau | 42 | Y | 6692.5, 2090.5 |
| MO-0001 | Macau | 1 | Y | 6679.5, 2096.5 |
| SG-0001 | Downtown Core-Marina Bay | 5 | Y | 6459.5, 2577.5 |
| SG-0002 | West Singapore-Jurong | 11 | Y | 6456.5, 2578.5 |
| SG-0003 | East Singapore-Changi | 5 | Y | 6460.5, 2578.5 |
| BN-0001 | Brunei-Muara | 24 | Y | 6709.5, 2498.5 |
| BN-0002 | Belait | 123 | N | 6700.5, 2508.5 |
| BN-0003 | Tutong | 43 | Y | 6704.5, 2503.5 |
| BN-0004 | Temburong | 53 | Y | 6715.5, 2502.5 |
| WS-0001 | Samoa | 122 | N | 172.5, 2921.5 |
| TO-0001 | Tonga | 29 | Y | 136.5, 3038.5 |
| KI-0001 | Kiribati | 39 | Y | 514.5, 2567.5 |
| FM-0001 | Micronesia | 27 | Y | 7696.5, 2452.5 |
| MH-0001 | Marshall Islands | 3 | Y | 7992.5, 2448.5 |
| PW-0001 | Palau | 23 | Y | 7158.5, 2437.5 |
| NR-0001 | Nauru | 1 | Y | 7894.5, 2621.5 |
| TV-0001 | Tuvalu | 1 | Y | 8173.5, 2803.5 |

## Contested provinces

Drawn by our own province files (decision C), not the sources' de facto lines: each contested province sits in the region the CSV gives it, built as listed (an alias or carve hint where Natural Earth draws the land elsewhere). The game hatches them.

| Province | Name | Country | Contested | Region drawn from |
|---|---|---|---|---|
| TW-0001 | Taipei | TWN | CHN claims | Taipei: alias hint -> TW-TPE |
| TW-0002 | New Taipei | TWN | CHN claims | New Taipei: alias hint -> TW-TPQ |
| TW-0003 | Taoyuan | TWN | CHN claims | Taoyuan: name match 100 |
| TW-0004 | Hsinchu City | TWN | CHN claims | Hsinchu City: name match 100 |
| TW-0005 | Hsinchu County | TWN | CHN claims | Hsinchu County: name match 100 |
| TW-0006 | Keelung | TWN | CHN claims | Keelung: name match 100 |
| TW-0007 | Yilan | TWN | CHN claims | Yilan: name match 100 |
| TW-0008 | Miaoli | TWN | CHN claims | Miaoli: name match 100 |
| TW-0009 | Taichung | TWN | CHN claims | Taichung: name match 100 |
| TW-0010 | Changhua | TWN | CHN claims | Changhua: name match 100 |
| TW-0011 | Nantou | TWN | CHN claims | Nantou: name match 100 |
| TW-0012 | Yunlin | TWN | CHN claims | Yunlin: name match 100 |
| TW-0013 | Chiayi City | TWN | CHN claims | Chiayi City: name match 100 |
| TW-0014 | Chiayi County | TWN | CHN claims | Chiayi County: name match 100 |
| TW-0015 | Tainan | TWN | CHN claims | Tainan: name match 100 |
| TW-0016 | Kaohsiung | TWN | CHN claims | Kaohsiung: name match 100 |
| TW-0017 | Pingtung | TWN | CHN claims | Pingtung: name match 100 |
| TW-0018 | Taitung | TWN | CHN claims | Taitung: name match 100 |
| TW-0019 | Hualien | TWN | CHN claims | Hualien: name match 100 |
| TW-0020 | Penghu | TWN | CHN claims | Penghu: name match 100 |
| TW-0021 | Kinmen | TWN | CHN claims | Kinmen: name match 100 |
| TW-0022 | Matsu | TWN | CHN claims | Lienchiang: no admin-1 match (best unit 56, group 38); carve: builder polygon from no region |
| MY-0018 | Kota Kinabalu-West Coast | MYS | PHL claims | Sabah: name match 100 |
| MY-0019 | Sandakan-Tawau | MYS | PHL claims | Sabah: name match 100 |

## Region matching

Regions not matched one-to-one by name: builder aliases, Natural Earth region groups, composite names matched part by part, carves (D676) and admin-1 units no region named, given to the touching region (D673). Check these on the preview too.

| Region | Matched by | Units |
|---|---|---|
| AUS: Australian Capital Territory | alias hint -> AUS-2653 | 1 |
| AUS: New South Wales | name match 100; plus unclaimed Jervis Bay Territory, Lord Howe Island | 3 |
| CHN: Hainan | name match 100; plus unclaimed Paracel Islands | 2 |
| FJI: Western | name match 100; plus unclaimed Rotuma | 2 |
| IDN: Central Sulawesi | alias hint -> ID-ST | 1 |
| IDN: East Kalimantan | name match 100; less IDN:North Kalimantan (carve) | 1 |
| IDN: North Kalimantan | no admin-1 match (best unit 88, group 0); carve: IDN units Bulungan, Kota Tarakan, Malinau, Nunukan, Tana Tidung from IDN:East Kalimantan | 0 |
| IDN: North Sulawesi-Gorontalo | name parts (2 pieces, worst match 100) | 2 |
| IDN: South-West Sulawesi | alias hint -> ID-SN, ID-SR | 2 |
| JPN: Tottori-Shimane | name parts (2 pieces, worst match 100) | 2 |
| KHM: Banteay Meanchey-Oddar Meanchey | name parts (2 pieces, worst match 100) | 2 |
| KHM: Battambang-Pailin | name parts (2 pieces, worst match 100) | 2 |
| KHM: Kampong Cham-Tbong Khmum | alias hint -> KH-3 | 1 |
| KHM: Kampong Speu-Pursat-Kampong Chhnang | name parts (3 pieces, worst match 100) | 3 |
| KHM: Kampong Thom-Preah Vihear | name parts (2 pieces, worst match 100) | 2 |
| KHM: Kampot-Koh Kong | alias hint -> KH-7, KH-9, KH-23 | 3 |
| KHM: Kandal-Takeo | name parts (2 pieces, worst match 100) | 2 |
| KHM: Northeast Cambodia | alias hint -> KH-10, KH-19, KH-16, KH-11 | 4 |
| KHM: Preah Sihanouk | alias hint -> KH-18 | 1 |
| KHM: Prey Veng-Svay Rieng | name parts (2 pieces, worst match 100) | 2 |
| LAO: Attapeu-Sekong | name parts (2 pieces, worst match 100) | 2 |
| LAO: Bolikhamxay-Khammouane | name parts (2 pieces, worst match 100) | 2 |
| LAO: Champasak-Salavan | name parts (2 pieces, worst match 100) | 2 |
| LAO: Houaphanh-Xiengkhouang | name parts (2 pieces, worst match 96) | 2 |
| LAO: Luang Prabang | alias hint -> LA-LP | 1 |
| LAO: Northern Laos | alias hint -> LA-LM, LA-BK, LA-OU, LA-PH | 4 |
| LAO: Vientiane Capital | alias hint -> LAO-3283 | 1 |
| LAO: Vientiane Province-Xaisomboun | alias hint -> LAO-3284 | 1 |
| MMR: Mandalay | name match 100; less MMR:Naypyidaw (carve) | 1 |
| MMR: Naypyidaw | no admin-1 match (best unit 56, group 0); carve: MMR units Det Khi Na, Oke Ta Ra from MMR:Mandalay | 0 |
| MNG: Arkhangai-Ovorkhangai | name parts (2 pieces, worst match 100) | 2 |
| MNG: Dornod-Sukhbaatar | name parts (2 pieces, worst match 100) | 2 |
| MNG: Dornogovi-Govisumber | name parts (2 pieces, worst match 100) | 2 |
| MNG: Orkhon-Bulgan | name parts (2 pieces, worst match 100) | 2 |
| MNG: Selenge-Darkhan-Uul | name parts (2 pieces, worst match 100) | 2 |
| MNG: Western Aimags | alias hint -> MN-071, MN-043, MN-046 | 3 |
| MNG: Zavkhan-Govi-Altai | alias hint -> MN-057, MN-065 | 2 |
| MYS: Kedah-Perlis | name parts (2 pieces, worst match 100) | 2 |
| MYS: Selangor | name match 100; plus unclaimed Putrajaya | 2 |
| NZL: Hawke's Bay-Gisborne | name parts (2 pieces, worst match 100) | 2 |
| NZL: Nelson-Marlborough-Tasman | name parts (3 pieces, worst match 100) | 3 |
| NZL: Northland | name match 100; plus unclaimed Three Kings Islands | 2 |
| NZL: Southland | name match 100; plus unclaimed Auckland Islands, Campbell Islands, The Snares | 4 |
| PHL: Bangsamoro | alias hint -> region:Autonomous Region in Muslim Mindanao (ARMM) | 6 |
| PHL: Bicol | Natural Earth region Bicol (Region V) (7 units, match 100) | 7 |
| PHL: Cagayan Valley | Natural Earth region Cagayan Valley (Region II) (6 units, match 100) | 6 |
| PHL: Calabarzon | Natural Earth region CALABARZON (Region IV-A) (6 units, match 100) | 6 |
| PHL: Caraga | alias hint -> region:Dinagat Islands (Region XIII) | 5 |
| PHL: Central Luzon | Natural Earth region Central Luzon (Region III) (9 units, match 100) | 9 |
| PHL: Central Visayas | Natural Earth region Central Visayas (Region VII) (7 units, match 100) | 7 |
| PHL: Cordillera | Natural Earth region Cordillera Administrative Region (CAR) (7 units, match 100) | 7 |
| PHL: Davao | alias hint -> region:Davao (Region XI) | 5 |
| PHL: Eastern Visayas | Natural Earth region Eastern Visayas (Region VIII) (8 units, match 100) | 8 |
| PHL: Ilocos | Natural Earth region Ilocos (Region I) (5 units, match 100) | 5 |
| PHL: Mimaropa | Natural Earth region MIMAROPA (Region IV-B) (6 units, match 100) | 6 |
| PHL: National Capital Region | Natural Earth region National Capital Region (17 units, match 100) | 17 |
| PHL: Northern Mindanao | Natural Earth region Northern Mindanao (Region X) (7 units, match 100) | 7 |
| PHL: Soccsksargen | Natural Earth region SOCCSKSARGEN (Region XII) (5 units, match 100) | 5 |
| PHL: Western Visayas | Natural Earth region Western Visayas (Region VI) (8 units, match 100) | 8 |
| PHL: Zamboanga Peninsula | alias hint -> region:Zamboanga Peninsula (Region IX) | 4 |
| PNG: East Sepik-Sandaun | name parts (2 pieces, worst match 100) | 2 |
| PNG: Eastern Highlands-Simbu-Jiwaka | alias hint -> PG-EHG, PG-CPK | 2 |
| PNG: Enga-Western Highlands | alias hint -> PG-EPW, PG-WHM | 2 |
| PNG: Hela-Southern Highlands | alias hint -> PG-SHM | 1 |
| PNG: Milne Bay-Oro | alias hint -> PG-MBA, PG-NPP | 2 |
| PNG: National Capital District-Central | alias hint -> PG-NCD, PG-CPM | 2 |
| PNG: New Britain | alias hint -> PG-EBR, PG-WBK | 2 |
| PNG: New Ireland-Manus | name parts (2 pieces, worst match 100) | 2 |
| PNG: Western-Gulf | alias hint -> PG-WPD, PG-GPK | 2 |
| PRK: South Hamgyong | alias hint -> KP-08 | 1 |
| PRK: South Pyongan-Nampo | alias hint -> KP-02 | 1 |
| SLB: Guadalcanal-Honiara | name parts (2 pieces, worst match 100); plus unclaimed Central, Rennell and Bellona | 4 |
| SLB: Malaita | name match 100; plus unclaimed Makira, Temotu | 3 |
| SLB: Western-Choiseul-Isabel | alias hint -> SLB-3507, SLB-3508, SB-IS | 3 |
| THA: Ayutthaya-Saraburi | name parts (2 pieces, worst match 100) | 2 |
| THA: Buriram-Surin-Chaiyaphum | name parts (3 pieces, worst match 93) | 3 |
| THA: Central Plains | alias hint -> name:Suphan Buri, name:Lop Buri, name:Chai Nat, name:Sing Buri, name:Ang Thong, name:Uthai Thani | 6 |
| THA: Chachoengsao-Prachinburi | name parts (2 pieces, worst match 96); plus unclaimed Nakhon Nayok, Sa Kaeo | 4 |
| THA: Chanthaburi-Trat | name parts (2 pieces, worst match 100) | 2 |
| THA: Chiang Mai-Lamphun | name parts (2 pieces, worst match 100) | 2 |
| THA: Chiang Rai-Phayao | name parts (2 pieces, worst match 100) | 2 |
| THA: Kanchanaburi-Ratchaburi | name parts (2 pieces, worst match 100); plus unclaimed Samut Songkhram | 3 |
| THA: Khon Kaen-Kalasin-Maha Sarakham | name parts (3 pieces, worst match 100) | 3 |
| THA: Lampang-Phrae-Nan | name parts (3 pieces, worst match 100) | 3 |
| THA: Nakhon Sawan-Kamphaeng Phet | name parts (2 pieces, worst match 100) | 2 |
| THA: Nakhon Si Thammarat-Trang | name parts (2 pieces, worst match 100); plus unclaimed Phatthalung | 3 |
| THA: Nonthaburi-Pathum Thani | name parts (2 pieces, worst match 100) | 2 |
| THA: Pattani-Yala-Narathiwat | name parts (3 pieces, worst match 100) | 3 |
| THA: Phetchaburi-Prachuap Khiri Khan | name parts (2 pieces, worst match 100) | 2 |
| THA: Phitsanulok-Sukhothai | alias hint -> name:Phitsanulok, name:Sukhothai, name:Uttaradit, name:Phetchabun; plus unclaimed Phichit | 5 |
| THA: Phuket-Krabi-Phang Nga | name parts (3 pieces, worst match 100) | 3 |
| THA: Sakon Nakhon-Roi Et-Mekong | alias hint -> name:Sakon Nakhon, name:Roi Et, name:Nakhon Phanom, name:Mukdahan; plus unclaimed Bueng Kan | 5 |
| THA: Samut Sakhon-Nakhon Pathom | name parts (2 pieces, worst match 100) | 2 |
| THA: Songkhla-Satun | name parts (2 pieces, worst match 100) | 2 |
| THA: Surat Thani-Chumphon | name parts (2 pieces, worst match 100); plus unclaimed Ranong | 3 |
| THA: Tak-Mae Hong Son | name parts (2 pieces, worst match 100) | 2 |
| THA: Ubon Ratchathani-Sisaket | alias hint -> name:Ubon Ratchathani, name:Si Sa Ket, name:Yasothon, name:Amnat Charoen | 4 |
| THA: Udon Thani-Nong Khai-Loei | name parts (3 pieces, worst match 100); plus unclaimed Nong Bua Lam Phu | 4 |
| TLS: Dili | alias hint -> TL-DI | 1 |
| TLS: Eastern Municipalities | alias hint -> TL-BA, TL-LA, TL-VI, TL-MT, TL-MF | 5 |
| TLS: Western Municipalities | alias hint -> TL-OE, TL-BO, TL-CO, TL-ER, TL-LI, TL-AN, TL-AL | 7 |
| TWN: Lienchiang | no admin-1 match (best unit 56, group 38); carve: builder polygon from no region | 0 |
| TWN: New Taipei | alias hint -> TW-TPQ | 1 |
| TWN: Taipei | alias hint -> TW-TPE | 1 |
| VNM: Ba Ria-Vung Tau | alias hint -> VN-43 | 1 |
| VNM: Bac Ninh | alias hint -> VN-56 | 1 |
| VNM: Binh Duong | alias hint -> VN-57 | 1 |
| VNM: Central Highlands | alias hint -> VN-33, VN-30, VN-28, VN-72, VN-35 | 5 |
| VNM: Dong Nai | alias hint -> VN-39 | 1 |
| VNM: Hai Phong | alias hint -> VN-HP | 1 |
| VNM: Hanoi | alias hint -> VN-HN, VN-70 | 2 |
| VNM: Ho Chi Minh City | alias hint -> VN-SG | 1 |
| VNM: Mekong Delta | alias hint -> VN-44, VN-55, VN-50, VN-CT, VN-59, VN-73, VN-47, VN-41, VN-52, VN-46, VN-51, VN-49, VN-45 | 13 |
| VNM: North Central Coast | alias hint -> VN-26, VN-25, VN-24, VN-22, VN-23, VN-21 | 6 |
| VNM: Northern Uplands | alias hint -> VN-69, VN-54, VN-09, VN-04, VN-53, VN-03, VN-07, VN-06, VN-02, VN-01, VN-71, VN-05, VN-14, VN-68 | 14 |
| VNM: Quang Ninh | alias hint -> VN-13 | 1 |
| VNM: Red River Delta | alias hint -> VN-61, VN-66, VN-20, VN-67, VN-63, VN-18 | 6 |
| VNM: South Central Coast | alias hint -> VN-34, VN-32, VN-36, VN-40, VN-29, VN-31, VN-DN, VN-27 | 8 |
| VNM: Tay Ninh-Binh Phuoc | alias hint -> VN-37, VN-58 | 2 |
| VUT: Sanma-Northern Islands | alias hint -> VU-SAM, VU-TOB, VU-PAM, VU-MAP | 4 |
| VUT: Shefa | alias hint -> VU-SEE, VU-TAE | 2 |

## Land without a province

Natural Earth admin-1 units of this file's countries that no region claims and that touch no region of their country (overseas territories, remote islands). They stay water on the map.

| Country (NE) | Unit | Area (sq deg) |
|---|---|---|
| AUS | Macquarie Island (AUS+00?) | 0.0166 |
| NZL | Antipodes Islands (NZL-5477) | 0.0098 |
| NZL | Chatham Islands Territory (NZL-5470) | 0.0916 |
| NZL | Kermadec Islands (NZL-5471) | 0.0036 |
| NZL | Tokelau (NZL-5472) | 0.0003 |

Natural Earth land of a country that none of its regions covers (over 0.01% of the country):

| Country | Area (sq deg) | Share of the country |
|---|---|---|
| NZL | 0.1055 | 0.36% |

## Sea links

`sea` rows of province-adjacency.csv with a province of this file: coastal provinces whose shapes do not touch but face each other across a strait (D678).

AU-0032-PG-0005, BN-0001-MY-0023, CN-0012-CN-0036, CN-0013-CN-0041, CN-0019-CN-0025, CN-0019-CN-0028, CN-0020-CN-0028, CN-0028-HK-0003, CN-0029-CN-0132, CN-0081-TW-0022, CN-0082-TW-0021, CN-0083-TW-0021, FJ-0001-FJ-0004, FJ-0003-FJ-0004, HK-0003-MO-0001, ID-0012-ID-0036, ID-0023-ID-0024, ID-0024-ID-0025, ID-0030-MY-0013, ID-0030-MY-0014, ID-0030-MY-0017, ID-0031-ID-0032, ID-0032-ID-0033, ID-0032-MY-0015, ID-0032-MY-0016, ID-0032-SG-0001, ID-0032-SG-0002, ID-0032-SG-0003, ID-0034-ID-0037, ID-0045-ID-0049, ID-0048-TL-0001, ID-0048-TL-0003, ID-0049-ID-0051, JP-0003-JP-0007, JP-0003-JP-0032, JP-0005-JP-0011, JP-0006-JP-0011, JP-0007-JP-0011, JP-0017-JP-0020, JP-0018-RU-0067, JP-0019-RU-0068, JP-0039-JP-0041, JP-0041-JP-0045, JP-0041-JP-0051, JP-0041-JP-0052, JP-0045-JP-0052, JP-0048-JP-0051, JP-0053-JP-0060, JP-0054-JP-0060, JP-0058-JP-0059, JP-0058-KR-0008, KP-0005-KR-0003, KR-0005-KR-0020, KR-0007-KR-0020, KR-0008-KR-0033, MY-0015-SG-0003, MY-0016-SG-0003, MY-0018-MY-0023, MY-0018-PH-0015, MY-0019-PH-0029, MY-0021-MY-0023, NZ-0010-NZ-0011, PG-0006-PG-0010, PG-0010-PG-0011, PG-0012-SB-0003, PH-0005-PH-0010, PH-0005-PH-0011, PH-0007-PH-0010, PH-0007-PH-0016, PH-0008-PH-0016, PH-0016-PH-0018, PH-0017-PH-0018, PH-0017-PH-0020, PH-0017-PH-0022, PH-0018-PH-0019, PH-0019-PH-0020, PH-0020-PH-0021, PH-0020-PH-0022, PH-0021-PH-0022, PH-0021-PH-0023, PH-0021-PH-0024, PH-0022-PH-0028, SB-0001-SB-0002, TW-0012-TW-0020, TW-0014-TW-0020, VU-0001-VU-0002

## Small provinces

| Province | Name | Region | Pixels | Region mean |
|---|---|---|---|---|
| AU-0024 | Brisbane | Queensland | 306 | 7553 |
| AU-0025 | Gold Coast | Queensland | 290 | 7553 |
| AU-0036 | Peel-Kwinana | Western Australia | 406 | 13999 |

## Uneven Voronoi splits

Blocks (ADM2 units, or admin-1 units for Greenland) that several provinces share, where one province takes most of the block. Check that the larger part belongs where it went.

| Region | Block | Shares |
|---|---|---|
| CHN:Zhejiang | Xiaoshanshi | CN-0040 88%, CN-0039 12% |
| JPN:Hyogo | part-1 | JP-0041 78%, JP-0040 22% |
| JPN:Kanagawa | part-0 | JP-0007 80%, JP-0005 13%, JP-0006 7% |

## Named places outside their province

A Natural Earth place matched in the name or notes that ended up in another province (usually a neighbour that names the same city more directly, as Long Beach-Harbor's notes name Los Angeles).

| Province | Name | Place | Lies in |
|---|---|---|---|
| AU-0027 | Toowoomba-Darling Downs | Gladstone | AU-0029 |
| CN-0119 | Chifeng-Tongliao-Xilingol | Erenhot | CN-0117 |
| CN-0096 | Xi'an High-tech-Xianyang | Xian | CN-0095 |
| ID-0008 | Bandung Raya-Cimahi | Bandung | ID-0007 |
| PH-0004 | South Metro Manila | Manila | PH-0002 |

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| AU-0002 | Western Sydney-Parramatta | 2 | N | Y |
| AU-0012 | Far West-Broken Hill | 4 | Y | N |
| AU-0014 | Canberra | 10 | Y | N |
| AU-0023 | Goulburn-North East | 5 | Y | N |
| AU-0034 | Mount Isa-Outback | 231 | Y | N |
| AU-0047 | Far North-Olympic Dam | 156 | Y | N |
| BN-0004 | Temburong | 3 | N | Y |
| CN-0008 | Lujiazui-Pudong | 2 | N | Y |
| CN-0009 | Puxi Center | 0 | N | Y |
| CN-0014 | Yuzhong-Jiangbei | 0 | N | Y |
| CN-0016 | Liangjiang-Yubei | 0 | N | Y |
| CN-0018 | Three Gorges-Southeast Chongqing | 0 | N | Y |
| CN-0024 | Guangzhou Tianhe-Yuexiu | 0 | N | Y |
| CN-0026 | Guangzhou North-Baiyun | 7 | Y | N |
| CN-0027 | Foshan | 2 | N | Y |
| CN-0033 | Wuxi-Changzhou | 16 | Y | N |
| CN-0034 | Nanjing Xinjiekou-Gulou | 0 | N | Y |
| CN-0035 | Nanjing Jiangning-Jiangbei | 0 | N | Y |
| CN-0039 | Hangzhou Shangcheng-Binjiang | 4 | Y | N |
| CN-0040 | Hangzhou Yuhang-Xiaoshan | 38 | Y | N |
| CN-0063 | Wuhan Hankou-Jianghan | 0 | N | Y |
| CN-0064 | Wuchang-Optics Valley | 0 | N | Y |
| CN-0065 | Hanyang-Wuhan Economic Zone | 0 | N | Y |
| CN-0066 | Yichang-Jingzhou | 0 | N | Y |
| CN-0068 | Huangshi-Huanggang-Ezhou | 0 | N | Y |
| CN-0073 | Nanchang-Jiujiang | 0 | N | Y |
| CN-0078 | Wuhu-Ma'anshan-Southern Anhui | 0 | N | Y |
| CN-0079 | Anqing-Tongling-Chizhou | 0 | N | Y |
| HK-0002 | Kowloon | 1 | N | Y |
| ID-0004 | Bekasi-Cikarang | 5 | Y | N |
| ID-0006 | Karawang-Purwakarta | 30 | Y | N |
| ID-0011 | Tangerang | 9 | Y | N |
| ID-0014 | Solo-South Central Java | 9 | Y | N |
| ID-0019 | Malang-Pasuruan | 53 | Y | N |
| ID-0022 | Western East Java | 52 | Y | N |
| ID-0033 | Jambi | 53 | Y | N |
| ID-0039 | Central Kalimantan | 182 | Y | N |
| JP-0001 | Central Tokyo | 1 | N | Y |
| JP-0024 | Yamagata | 22 | Y | N |
| JP-0034 | Nagoya City | 0 | N | Y |
| JP-0037 | Osaka Kita-Chuo | 1 | N | Y |
| JP-0042 | Kyoto | 35 | Y | N |
| JP-0059 | Kumamoto | 97 | Y | N |
| KP-0006 | North Hwanghae-Kaesong | 9 | Y | N |
| KR-0006 | Goyang-Paju-Uijeongbu | 20 | Y | N |
| KR-0007 | Icheon-Eastern Gyeonggi | 48 | Y | N |
| KR-0019 | Cheonan-Asan | 7 | Y | N |
| KR-0026 | Naju-Central Jeonnam | 28 | Y | N |
| KR-0032 | Gimhae-Yangsan | 16 | Y | N |
| KR-0034 | Jinju-Western Gyeongnam | 41 | Y | N |
| MM-0010 | Bago | 18 | Y | N |
| MO-0001 | Macau | 2 | N | Y |
| MY-0007 | Ipoh-Kinta | 25 | Y | N |
| PH-0003 | Quezon City-North | 1 | N | Y |
| PH-0004 | South Metro Manila | 1 | N | Y |
| PH-0009 | Clark-Pampanga | 5 | Y | N |
| TH-0001 | Bangkok Silom-Sukhumvit | 0 | N | Y |
| TH-0002 | Thonburi-Bangkok West | 1 | N | Y |
| TH-0010 | Kanchanaburi-Ratchaburi | 6 | Y | N |
| TW-0005 | Hsinchu County | 3 | N | Y |
| TW-0006 | Keelung | 3 | N | Y |
| VN-0001 | Saigon Center | 0 | N | Y |
| VN-0004 | Dong Nai-Bien Hoa | 7 | Y | N |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

ID-0042 (62), ID-0048 (56), AU-0052 (43), ID-0032 (34), MM-0021 (30), FJ-0004 (25), ID-0049 (24), SB-0003 (24), KI-0001 (23), ID-0051 (22), KR-0025 (21), PG-0009 (21), ID-0045 (19), JP-0063 (19), PH-0015 (19), ID-0025 (17), PG-0011 (16), PH-0029 (15), VU-0002 (15), PH-0022 (14), AU-0043 (13), AU-0047 (13), CN-0041 (13), NZ-0011 (13), NZ-0016 (13), ID-0047 (12), JP-0058 (12), TO-0001 (12), AU-0040 (11), JP-0003 (11), SB-0002 (11), AU-0030 (10), AU-0049 (10), FJ-0003 (10), ID-0043 (10), ID-0044 (10), JP-0062 (10), KR-0007 (10), PG-0005 (10), PH-0013 (10), PH-0017 (10), VN-0021 (10), AU-0020 (9), AU-0032 (9), CN-0028 (9), ID-0050 (9), VU-0001 (9), AU-0045 (8), ID-0026 (8), ID-0038 (8), KR-0024 (8), MM-0016 (8), PH-0016 (8), SB-0001 (8), AU-0034 (7), AU-0046 (7), AU-0050 (7), CN-0012 (7), CN-0033 (7), FJ-0002 (7), FM-0001 (7), ID-0021 (7), ID-0029 (7), JP-0050 (7), KP-0005 (7), NZ-0001 (7), NZ-0006 (7), PG-0008 (7), PH-0008 (7), PW-0001 (7), TH-0013 (7), TH-0027 (7), TH-0029 (7), AU-0029 (6), CN-0023 (6), CN-0083 (6), CN-0093 (6), CN-0104 (6), CN-0141 (6), ID-0028 (6), ID-0046 (6), TH-0026 (6), VN-0011 (6), AU-0023 (5), AU-0026 (5), CN-0075 (5), CN-0081 (5), CN-0082 (5), CN-0110 (5), ID-0024 (5), ID-0037 (5), JP-0019 (5), JP-0049 (5), JP-0053 (5), MM-0005 (5), MY-0018 (5), NZ-0003 (5), PG-0007 (5), PG-0010 (5), PG-0012 (5), PH-0018 (5), PH-0021 (5), PH-0026 (5), PH-0028 (5), AU-0031 (4), AU-0042 (4), AU-0044 (4), CN-0025 (4), CN-0029 (4), CN-0043 (4), CN-0105 (4), CN-0114 (4), CN-0123 (4), ID-0012 (4), ID-0040 (4), JP-0017 (4), JP-0047 (4), JP-0059 (4), KH-0004 (4), KR-0020 (4), MY-0002 (4), MY-0019 (4), PG-0006 (4), PH-0007 (4), PH-0024 (4), TW-0018 (4), VN-0008 (4), VN-0022 (4), AU-0013 (3), AU-0024 (3), AU-0036 (3), AU-0051 (3), CN-0013 (3), CN-0014 (3), CN-0019 (3), CN-0046 (3), CN-0054 (3), CN-0055 (3), CN-0061 (3), CN-0065 (3), CN-0068 (3), CN-0071 (3), CN-0120 (3), CN-0128 (3), CN-0129 (3), CN-0131 (3), FJ-0001 (3), HK-0003 (3), ID-0030 (3), ID-0031 (3), JP-0011 (3), JP-0018 (3), JP-0022 (3), JP-0051 (3), KP-0003 (3), KR-0003 (3), KR-0006 (3), KR-0021 (3), KR-0023 (3), KR-0026 (3), KR-0031 (3), MH-0001 (3), MM-0020 (3), MN-0012 (3), MY-0006 (3), NZ-0005 (3), PH-0011 (3), TW-0007 (3), VN-0002 (3), VN-0005 (3), AU-0003 (2), AU-0004 (2), AU-0009 (2), AU-0010 (2), AU-0012 (2), AU-0014 (2), AU-0016 (2), AU-0017 (2), AU-0028 (2), AU-0035 (2), AU-0038 (2), AU-0053 (2), CN-0007 (2), CN-0026 (2), CN-0031 (2), CN-0036 (2), CN-0039 (2), CN-0042 (2), CN-0050 (2), CN-0056 (2), CN-0060 (2), CN-0067 (2), CN-0074 (2), CN-0085 (2), CN-0097 (2), CN-0099 (2), CN-0107 (2), CN-0109 (2), CN-0124 (2), CN-0126 (2), CN-0127 (2), CN-0133 (2), CN-0134 (2), CN-0139 (2), CN-0146 (2), ID-0004 (2), ID-0017 (2), ID-0018 (2), ID-0020 (2), ID-0022 (2), ID-0023 (2), ID-0035 (2), ID-0036 (2), ID-0041 (2), JP-0010 (2), JP-0012 (2), JP-0020 (2), JP-0026 (2), JP-0028 (2), JP-0033 (2), JP-0036 (2), JP-0040 (2), JP-0041 (2), JP-0054 (2), JP-0060 (2), KH-0003 (2), KP-0002 (2), KP-0008 (2), KR-0005 (2), KR-0014 (2), KR-0015 (2), KR-0027 (2), KR-0032 (2), KR-0033 (2), LA-0001 (2), LA-0004 (2), MM-0004 (2), MM-0011 (2), MM-0012 (2), MM-0014 (2), MM-0015 (2), MN-0007 (2), MY-0005 (2), MY-0007 (2), MY-0013 (2), MY-0017 (2), NZ-0013 (2), PH-0002 (2), PH-0004 (2), PH-0012 (2), PH-0020 (2), PH-0023 (2), PH-0025 (2), TH-0007 (2), TH-0017 (2), TH-0022 (2), TH-0024 (2), TH-0025 (2), TH-0028 (2), TH-0030 (2), TL-0001 (2), TL-0002 (2), TW-0014 (2), TW-0020 (2), VN-0001 (2), VN-0009 (2), VN-0012 (2), VN-0013 (2), VN-0017 (2), VN-0019 (2), VN-0024 (2), VN-0026 (2), WS-0001 (2)

## Visual check

`preview-east-asia-oceania.png` in this folder is province-ids.png around the region (pixels x 5646..544, y 1109..3983, scaled by 0.78).
