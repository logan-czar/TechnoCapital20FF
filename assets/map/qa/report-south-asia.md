# Map QA report: south-asia

_Written by `tools/map-pipeline/run.py --region south-asia` (pipeline pb-1). Source of the rows: `provinces-south-asia.csv`. Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and D670-D699._

## Result

**Pass.** All 208 provinces of `provinces-south-asia.csv` have a crosswalk row and pixels (19 of them tiny, with a click target at the label point). No source outside the license allowlist reached a province.

## Coverage

| Measure | Count |
|---|---|
| Provinces in the CSV | 208 |
| ... AFG | 17 |
| ... BGD | 29 |
| ... BTN | 4 |
| ... IND | 97 |
| ... LKA | 13 |
| ... MDV | 1 |
| ... NPL | 13 |
| ... PAK | 34 |
| Regions matched | 83 of 83 |
| Provinces by method: admin1 | 52 |
| Provinces by method: admin2 | 52 |
| Provinces by method: admin3 | 0 |
| Provinces by method: voronoi | 104 |
| Flagged for review (confidence < 0.6) | 0 |
| Placed by a builder hint (`hints/south-asia.toml`) | 43 |
| Tiny (under 64 px) | 19 |
| Given a pixel at their interior point (no pixel centre inside) | 0 |
| More than one part (islands, exclaves) | 68 |
| Coastal flag differs from the CSV | 10 |
| Small for their region (not Metro, under 5% of the region's mean) | 0 |
| Voronoi-split blocks where one province takes 75% or more | 4 |
| Places named in a province's name or notes that lie in another province | 2 |
| Pixels drawn over another province (overlapping shapes) | 0 |
| Contested provinces (drawn by our own files) | 6 |
| Admin-1 units left without a province | 0 |
| Sea links with a province of this file | 3 |
| City probe points (fail on a mismatch; D686) | 60 pass, 0 mismatch, 0 listed |
| Metro reach scan rows (listed; D686) | 1 |
| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) | 0 |
| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) | 0 |

Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).

## Sources and licenses

| Boundary file | License | Used |
|---|---|---|
| Natural Earth 10m v5.1.2 (admin 0, admin 1, populated places, lakes) | Public domain | yes |
| geoBoundaries gbOpen BGD ADM2 (Bangladesh Bureau of Statistics (BBS), OCHA ROAP) | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) | yes |
| geoBoundaries gbOpen IND ADM2 (Pathways Data Pvt. Ltd., lgdirectory.gov.in) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen LKA ADM2 (OpenStreetMap, Wambacher) | Open Data Commons Open Database License 1.0 | no: refused: ODbL in license (Open Data Commons Open Database License 1.0); Voronoi path |
| geoBoundaries gbOpen NPL ADM2 (geoBoundaries, Wikimedia Commons) | Public Domain | yes |
| geoBoundaries gbOpen PAK ADM2 (geoBoundaries, Wikipedia) | Public Domain | yes |

Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, public domain and the attribution-only government licences OGL-Canada 2.0, OGL-UK 3.0, Data licence Germany Attribution 2.0, Etalab 2.0, Spain's INE licence, Singapore ODL 1.0 and Korea OGL Type 1 (D685); a region whose country has no allowed ADM2 is split by Voronoi.

Provenance to check (for Logan; these files pass the allowlist and are used):

- NPL ADM2: public domain or CC0, but geoBoundaries names Wikimedia as the source (Wikimedia maps are often CC BY-SA)
- PAK ADM2: public domain or CC0, but geoBoundaries names Wikimedia as the source (Wikimedia maps are often CC BY-SA)

## Low-confidence rows for review

None.

## Builder hints (review these too)

The automatic match could not place these from the CSV name and notes (a suburb or district Natural Earth has no point for, or a county the notes do not name), so the builder supplied units or points. They carry confidence 0.85.

| Province | Name | Placed by |
|---|---|---|
| BD-0001 | Dhaka Motijheel-Gulshan | seeds: point 90.41,23.79 (hint); point 90.42,23.73 (hint); 0 whole admin2 units, split: Dhaka |
| BD-0002 | Old Dhaka-Mirpur | seeds: point 90.36,23.76 (hint); point 90.36,23.8 (hint); point 90.4,23.71 (hint); 0 whole admin2 units, split: Dhaka |
| BD-0005 | Savar-Ashulia | seeds: point 90.26,23.85 (hint); point 90.31,23.9 (hint); 0 whole admin2 units, split: Dhaka |
| BD-0010 | Sitakunda-Mirsarai | seeds: point 91.58,22.77 (hint); point 91.66,22.62 (hint); 0 whole admin2 units, split: Chittagong |
| BD-0014 | Brahmanbaria | seeds: point 91.0,24.03 (hint); point 91.11,23.96 (hint); 1 whole admin2 units |
| IN-0001 | New Delhi-South Delhi | seeds: point 77.21,28.61 (hint); point 77.22,28.53 (hint); 0 whole parts, 1 split |
| IN-0002 | North-East-West Delhi | seeds: point 77.05,28.8 (hint); point 77.07,28.65 (hint); point 77.1,28.85 (hint); point 77.23,28.66 (hint); point 77.29,28.69 (hint); 0 whole parts, 1 split |
| IN-0013 | South Mumbai-BKC | seeds: point 72.83,18.93 (hint); point 72.86,19.06 (hint); 0 whole parts, 1 split |
| IN-0014 | Mumbai Western Suburbs | seeds: point 72.85,19.12 (hint); point 72.85,19.16 (hint); point 72.86,19.23 (hint); point 72.88,19.09 (hint); 0 whole parts, 1 split |
| IN-0015 | Mumbai Eastern Suburbs-Thane | seeds: point 72.91,19.12 (hint); point 72.93,19.01 (hint) (snapped to land); point 72.98,19.22 (hint); point 73.13,19.24 (hint); 0 whole parts, 1 split |
| IN-0016 | Navi Mumbai-JNPT | seeds: point 72.95,18.95 (hint); point 73.02,19.03 (hint); point 73.1,18.99 (hint); 0 whole parts, 1 split |
| IN-0017 | Pune City | seeds: point 73.74,18.59 (hint); point 73.852,18.516 (hint); point 73.94,18.55 (hint); 0 whole parts, 1 split |
| IN-0018 | Pimpri-Chinchwad-Chakan | seeds: point 73.8,18.63 (hint); point 73.86,18.76 (hint); 0 whole parts, 1 split |
| IN-0019 | South Maharashtra-Konkan | seeds: point 73.3,16.99 (hint); point 74.0,17.68 (hint); point 74.24,16.7 (hint); point 74.57,16.85 (hint); point 74.58,18.15 (hint); point 75.91,17.66 (hint); 0 whole parts, 1 split |
| IN-0023 | Bengaluru Central-Whitefield | seeds: point 77.558,12.972 (hint); point 77.61,12.97 (hint); point 77.75,12.97 (hint); 0 whole parts, 1 split |
| IN-0024 | Bengaluru South-Electronic City | seeds: point 77.62,12.93 (hint); point 77.64,12.91 (hint); point 77.67,12.85 (hint); 0 whole parts, 1 split |
| IN-0025 | Bengaluru North-Peenya | seeds: point 77.5,13.04 (hint); point 77.59,13.1 (hint); point 77.71,13.2 (hint); 0 whole parts, 1 split |
| IN-0029 | Hyderabad Old City-Secunderabad | seeds: point 78.47,17.36 (hint); point 78.5,17.44 (hint); 0 whole parts, 1 split |
| IN-0030 | Cyberabad-HITEC City | seeds: point 78.35,17.44 (hint); point 78.38,17.45 (hint); 0 whole parts, 1 split |
| IN-0031 | Hyderabad East-Genome Valley | seeds: point 78.26,17.53 (hint); point 78.45,17.52 (hint); point 78.61,17.63 (hint); 0 whole parts, 1 split |
| IN-0032 | Rest of Telangana | seeds: point 77.9,17.34 (hint); point 77.99,16.74 (hint); point 78.09,18.67 (hint); point 78.53,19.67 (hint); point 79.13,18.44 (hint); point 79.27,17.05 (hint); point 79.45,18.87 (hint); point 79.59,17.97 (hint); point 80.15,17.25 (hint); point 80.62,17.55 (hint); 0 whole parts, 1 split |
| IN-0033 | Chennai Central-OMR | seeds: point 80.22,13.01 (hint); point 80.23,12.9 (hint); point 80.25,13.05 (hint); 0 whole admin1 units, split: Tamil Nadu |
| IN-0034 | Chennai North-Ennore | seeds: point 79.91,13.14 (hint); point 80.27,13.17 (hint); point 80.29,13.1 (hint); point 80.32,13.25 (hint); 0 whole admin1 units, split: Tamil Nadu |
| IN-0035 | Sriperumbudur-Oragadam | seeds: point 79.85,12.83 (hint); point 79.95,12.97 (hint); point 80.03,12.79 (hint); 0 whole admin1 units, split: Tamil Nadu |
| IN-0040 | Kolkata City-Salt Lake | seeds: point 88.35,22.57 (hint); point 88.42,22.58 (hint); 0 whole parts, 1 split |
| IN-0041 | Howrah-Hooghly | seeds: point 88.31,22.59 (hint); point 88.33,22.68 (hint); point 88.39,22.9 (hint); 0 whole parts, 1 split |
| IN-0042 | North 24 Parganas-Barrackpore | seeds: point 88.38,22.77 (hint); point 88.43,22.65 (hint); point 88.48,22.72 (hint); point 88.89,23.04 (hint) (snapped to land); 0 whole parts, 1 split |
| IN-0043 | South 24 Parganas-Sundarbans | seeds: point 88.08,21.65 (hint); point 88.17,22.47 (hint); point 88.19,22.19 (hint); point 88.43,22.47 (hint); point 88.8,21.9 (hint); 3 whole parts, 1 split |
| IN-0049 | Gandhinagar-Sanand | seeds: point 72.38,22.99 (hint); point 72.64,23.22 (hint); point 72.68,23.16 (hint); 0 whole admin1 units, split: Gujarat |
| IN-0050 | Kutch-North Gujarat | seeds: point 69.67,23.25 (hint); point 69.72,22.84 (hint); point 70.22,23.03 (hint); point 72.12,23.85 (hint); point 72.38,23.6 (hint); point 72.43,24.17 (hint); point 72.97,23.6 (hint); 0 whole admin1 units, split: Gujarat |
| IN-0053 | Surat City | seeds: point 72.83,21.17 (hint); 0 whole admin1 units, split: Gujarat |
| IN-0054 | Hazira-Kamrej | seeds: point 72.64,21.1 (hint); point 73.0,21.28 (hint); 0 whole admin1 units, split: Gujarat |
| IN-0077 | Keonjhar-Rourkela | seeds: point 84.86,22.25 (hint); point 85.39,22.1 (hint); point 85.58,21.63 (hint); 0 whole parts, 1 split |
| IN-0079 | Koraput-Ganjam | seeds: point 82.71,18.81 (hint); point 82.98,18.88 (hint); point 83.42,19.17 (hint); point 84.79,19.31 (hint); 0 whole parts, 1 split |
| LK-0005 | Nuwara Eliya | seeds: point 80.6,6.89 (hint); point 80.68,6.93 (hint); point 80.77,6.97 (hint); 1 whole admin1 units |
| NP-0011 | Nepalgunj-Dang | seeds: point 81.3,28.35 (hint); point 81.62,28.05 (hint); point 82.3,28.05 (hint); point 82.65,28.38 (hint); 6 whole admin1 units |
| PK-0001 | Karachi Saddar-Clifton | seeds: point 67.03,24.81 (hint); point 67.03,24.85 (hint); 0 whole admin2 units, split: Karachi |
| PK-0002 | Karachi Port-SITE | seeds: point 66.95,24.95 (hint); point 66.98,24.84 (hint); point 66.99,24.9 (hint); 0 whole admin2 units, split: Karachi |
| PK-0003 | Karachi Korangi-Port Qasim | seeds: point 67.13,24.83 (hint); point 67.2,24.87 (hint); point 67.33,24.78 (hint); 0 whole admin2 units, split: Karachi |
| PK-0004 | Karachi Gulshan-North | seeds: point 67.04,24.93 (hint); point 67.07,25.0 (hint); point 67.09,24.92 (hint); point 67.16,24.9 (hint); 0 whole admin2 units, split: Karachi |
| PK-0009 | Lahore Mall-Gulberg | seeds: point 74.32,31.55 (hint); point 74.35,31.52 (hint); 0 whole admin2 units, split: Lahore |
| PK-0010 | Lahore Cantt-DHA | seeds: point 74.38,31.52 (hint); point 74.4,31.47 (hint); point 74.41,31.52 (hint); 0 whole admin2 units, split: Lahore |
| PK-0011 | Lahore Industrial-Sheikhupura | seeds: point 73.98,31.71 (hint); point 74.3,31.45 (hint); point 74.45,31.12 (hint); 2 whole admin2 units, split: Lahore |

## Tiny provinces (click targets)

Under 64 pixels at 8192 x 4096: the map draws a clickable dot at the label point.

| Province | Name | Pixels | Parts | Label point (px) |
|---|---|---|---|---|
| MV-0001 | Maldives | 3 | 2 | 5767.5, 2514.5 |
| PK-0001 | Karachi Saddar-Clifton | 3 | 1 | 5621.5, 2032.5 |
| BD-0001 | Dhaka Motijheel-Gulshan | 9 | 1 | 6153.5, 2056.5 |
| PK-0009 | Lahore Mall-Gulberg | 10 | 1 | 5787.5, 1866.5 |
| IN-0040 | Kolkata City-Salt Lake | 16 | 1 | 6107.5, 2087.5 |
| IN-0001 | New Delhi-South Delhi | 20 | 1 | 5852.5, 1942.5 |
| IN-0013 | South Mumbai-BKC | 26 | 3 | 5754.5, 2177.5 |
| BD-0002 | Old Dhaka-Mirpur | 27 | 1 | 6151.5, 2059.5 |
| LK-0001 | Colombo | 28 | 1 | 5914.5, 2453.5 |
| PK-0002 | Karachi Port-SITE | 28 | 2 | 5618.5, 2030.5 |
| IN-0033 | Chennai Central-OMR | 35 | 1 | 5920.5, 2311.5 |
| BD-0005 | Savar-Ashulia | 36 | 3 | 6147.5, 2054.5 |
| PK-0010 | Lahore Cantt-DHA | 40 | 1 | 5790.5, 1869.5 |
| IN-0053 | Surat City | 50 | 1 | 5751.5, 2117.5 |
| PK-0021 | Islamabad | 50 | 1 | 5760.5, 1813.5 |
| PK-0003 | Karachi Korangi-Port Qasim | 56 | 1 | 5629.5, 2031.5 |
| IN-0002 | North-East-West Delhi | 60 | 1 | 5850.5, 1937.5 |
| IN-0034 | Chennai North-Ennore | 61 | 2 | 5919.5, 2305.5 |
| LK-0002 | Gampaha-Negombo | 61 | 1 | 5916.5, 2447.5 |

## Anchor cities

Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own name names lands on that province (and, for a Metro province, near its middle and in its largest 4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a province of that Metro, and each key city lands on one of its provinces (key-cities.csv).

All anchors land on their own provinces.

## Natural Earth labels

Natural Earth units whose capital another region of the country names (in a province name or notes) while their own region does not: the sign of NE giving units each other's names, as in Eritrea and Guyana (D687). Each row fails the step unless `[review] ne_label_ok` in the hints names the region.

None.

## City probe

Points of `tools/map-pipeline/checks/city-points.txt` whose expected province is in this file, looked up in province-index.png: a point passes on its pixel or one of the 8 around it (D686). The step fails on a mismatch.

| Point | Expected | Got | Result |
|---|---|---|---|
| Ahmedabad (72.58, 23.03) | IN-0048 | IN-0048 | on it |
| Andheri (72.85, 19.12) | IN-0014 | IN-0014 | on it |
| Bengaluru (77.59, 12.97) | IN | IN-0023 | on it |
| Bhuj Kutch (69.67, 23.25) | IN-0050 | IN-0050 | on it |
| Chandni Chowk (77.23, 28.656) | IN-0002 | IN-0002 | on it |
| Clifton (67.03, 24.81) | PK-0001 | PK-0001 | on it |
| Delhi Parliament (77.21, 28.617) | IN-0001 | IN-0001 | on it |
| Dhaka Motijheel (90.42, 23.73) | BD-0001 | BD-0001 | on it |
| Faridabad (77.31, 28.41) | IN-0003 | IN-0003 | on it |
| Gandhinagar (72.64, 23.22) | IN-0049 | IN-0049 | on it |
| Gazipur (90.42, 24.0) | BD-0003 | BD-0003 | on it |
| Ghaziabad (77.44, 28.67) | IN-0005 | IN-0005 | on it |
| Gilgit (74.31, 35.92) | PK-0033 | PK-0033 | on it |
| Gulshan Dhaka (90.41, 23.79) | BD-0001 | BD-0001 | on it |
| Gulshan-e-Iqbal (67.09, 24.92) | PK-0004 | PK-0004 | on it |
| Gurugram (77.03, 28.46) | IN-0003 | IN-0003 | on it |
| Himmatnagar (72.97, 23.6) | IN-0050 | IN-0050 | on it |
| JNPT (72.95, 18.95) | IN-0016 | IN-0016 | on it |
| Jammu (74.86, 32.73) | IN-0065 | IN-0065 | on it |
| Jinnah airport (67.16, 24.9) | PK-0004 | PK-0004 | on it |
| Kanchipuram (79.7, 12.83) | IN-0035 | IN-0035 | on it |
| Karachi II Chundrigar (67.01, 24.85) | PK-0001 | PK-0002 | within a pixel |
| Kargil (76.13, 34.56) | IN-0066 | IN-0066 | on it |
| Keamari (66.97, 24.83) | PK-0002 | PK-0002 | nearest across water |
| Khammam (80.15, 17.25) | IN-0032 | IN-0032 | on it |
| Kolkata (88.36, 22.57) | IN | IN-0040 | on it |
| Korangi (67.12, 24.83) | PK-0003 | PK-0003 | on it |
| Lahore DHA (74.4, 31.48) | PK-0010 | PK-0010 | on it |
| Lahore Mall (74.33, 31.56) | PK-0009 | PK-0009 | on it |
| Leh (77.58, 34.16) | IN-0066 | IN-0066 | on it |
| Mahbubnagar (77.99, 16.74) | IN-0032 | IN-0032 | on it |
| Male (73.51, 4.175) | MV | MV-0001 | on it |
| Mehsana (72.38, 23.6) | IN-0050 | IN-0050 | on it |
| Mirpur (90.37, 23.81) | BD-0002 | BD-0002 | on it |
| Mirpur AJK (73.75, 33.15) | PK-0034 | PK-0034 | on it |
| Mumbai BKC (72.865, 19.065) | IN-0013 | IN-0014 | within a pixel |
| Mumbai Nariman Pt (72.82, 18.925) | IN-0013 | IN-0013 | nearest across water |
| Muzaffarabad (73.47, 34.37) | PK-0034 | PK-0034 | on it |
| Nalgonda (79.27, 17.05) | IN-0032 | IN-0032 | on it |
| Narayanganj (90.5, 23.62) | BD-0004 | BD-0004 | on it |
| Narela (77.09, 28.85) | IN-0002 | IN-0002 | on it |
| Noida (77.33, 28.57) | IN-0005 | IN-0005 | on it |
| Old Dhaka (90.4, 23.71) | BD-0002 | BD-0002 | on it |
| Orangi (66.99, 24.95) | PK-0002 | PK-0002 | on it |
| Palanpur (72.43, 24.17) | IN-0050 | IN-0050 | on it |
| Port Qasim (67.33, 24.78) | PK-0003 | PK-0003 | on it |
| Powai (72.905, 19.12) | IN-0015 | IN-0014 | within a pixel |
| Sanand (72.38, 22.99) | IN-0049 | IN-0049 | on it |
| Sangareddy (78.09, 17.62) | IN-0031,IN-0030 | IN-0031 | on it |
| Savar (90.26, 23.86) | BD-0005 | BD-0005 | on it |
| Sheikhupura (73.98, 31.71) | PK-0011 | PK-0011 | on it |
| Siachen (77.1, 35.4) | IN-0066 | IN-0066 | on it |
| Skardu (75.63, 35.3) | PK-0033 | PK-0033 | on it |
| Srinagar (74.8, 34.08) | IN-0064 | IN-0064 | on it |
| Thane (72.98, 19.2) | IN-0015 | IN-0015 | on it |
| Tiruvallur (79.91, 13.14) | IN-0034,IN-0036 | IN-0034 | on it |
| Tongi (90.4, 23.89) | BD-0003 | BD-0003 | on it |
| Vashi Navi Mumbai (73.0, 19.07) | IN-0016 | IN-0016 | on it |
| Vellore (79.13, 12.92) | IN-0036 | IN-0036 | on it |
| Vikarabad (77.9, 17.34) | IN-0032 | IN-0032 | on it |

## Metro reach

Metro provinces whose centroid is over 80 km from their Metro's city, that are over 4 times the Metro's median and 250 px, and regions where Metro provinces hold over 30% of the land beside rural ones (the D612 error). Listed for review; a Metro made of whole metropolitan units can be large by design.

| Check | Province or region | Detail |
|---|---|---|
| large for its Metro | PK-0011 Lahore Industrial-Sheikhupura | 583 px, the Metro's median is 40 px (Metro Lahore) |

## Known for review

- AFG: Natural Earth has two units named Parwan: AFG-1772 (Charikar, Bagram) and AFG-1769 (the Panjshir valley); both go to Parwan-Kapisa-Panjshir (D687).
- Kashmir (IN-0064 to IN-0066, PK-0033, PK-0034) follows the line of control, which is also our province files' split: Jammu and Kashmir and Ladakh are India's, Gilgit-Baltistan and Azad Kashmir Pakistan's; Natural Earth's Siachen unit is drawn with Ladakh. Aksai Chin stays Chinese (no province of ours claims it) and IN-0092 Arunachal Pradesh is India's.
- NPL: Natural Earth still has Nepal's 14 old zones, so the 7 provinces are cut from geoBoundaries' 77 districts (public domain, NPL ADM2). Its file names Siraha and Parsa as second Saptari and Bara units and lacks Rupandehi and Dailekh, which therefore stay with Province No. 5.
- BGD:Mymensingh, a division since 2015, is cut from Dhaka with the geoBoundaries districts Mymensingh, Netrakona, Jamalpur and Sherpur.

## Watched small provinces

The microstates, city-states and metro splits the plan names (P8: Singapore, the London and Beijing splits, Hong Kong and Macau): every one has pixels, and a tiny one a click target at its label point.

| Province | Name | Pixels | Tiny | Label point (px) |
|---|---|---|---|---|
| IN-0064 | Kashmir Valley | 1400 | N | 5800.5, 1806.5 |
| IN-0065 | Jammu | 1002 | N | 5808.5, 1833.5 |
| IN-0066 | Ladakh | 3767 | N | 5858.5, 1804.5 |
| IN-0092 | Arunachal Pradesh | 4146 | N | 6253.5, 1944.5 |
| PK-0033 | Gilgit-Baltistan | 3840 | N | 5794.5, 1752.5 |
| PK-0034 | Azad Kashmir | 685 | N | 5776.5, 1819.5 |
| BT-0001 | Thimphu-Paro | 252 | N | 6129.5, 1967.5 |
| BT-0002 | Phuentsholing-Chukha | 178 | N | 6131.5, 1980.5 |
| BT-0003 | Punakha-Wangdue | 1041 | N | 6152.5, 1969.5 |
| BT-0004 | Trashigang-Mongar | 588 | N | 6175.5, 1974.5 |
| MV-0001 | Maldives | 3 | Y | 5767.5, 2514.5 |

## Contested provinces

Drawn by our own province files (decision C), not the sources' de facto lines: each contested province sits in the region the CSV gives it, built as listed (an alias or carve hint where Natural Earth draws the land elsewhere). The game hatches them.

| Province | Name | Country | Contested | Region drawn from |
|---|---|---|---|---|
| IN-0064 | Kashmir Valley | IND | PAK claims | Jammu and Kashmir: name match 100 |
| IN-0065 | Jammu | IND | PAK claims | Jammu and Kashmir: name match 100 |
| IN-0066 | Ladakh | IND | PAK claims | Ladakh: name match 100; plus unclaimed Kashmir |
| IN-0092 | Arunachal Pradesh | IND | CHN claims | Arunachal Pradesh: name match 100 |
| PK-0033 | Gilgit-Baltistan | PAK | IND claims | Gilgit-Baltistan: name match 100 |
| PK-0034 | Azad Kashmir | PAK | IND claims | Azad Jammu and Kashmir: alias hint -> PK-JK |

## Region matching

Regions not matched one-to-one by name: builder aliases, Natural Earth region groups, composite names matched part by part, carves (D676) and admin-1 units no region named, given to the touching region (D673). Check these on the preview too.

| Region | Matched by | Units |
|---|---|---|
| AFG: Balkh-Samangan | name parts (2 pieces, worst match 100) | 2 |
| AFG: Bamyan-Ghor | name parts (2 pieces, worst match 100) | 2 |
| AFG: Farah-Nimroz | name parts (2 pieces, worst match 100) | 2 |
| AFG: Herat-Badghis | name parts (2 pieces, worst match 100) | 2 |
| AFG: Jowzjan-Faryab-Sar-e Pol | name parts (3 pieces, worst match 100) | 3 |
| AFG: Kunar-Laghman-Nuristan | name parts (3 pieces, worst match 100) | 3 |
| AFG: Kunduz-Baghlan-Takhar | name parts (3 pieces, worst match 100) | 3 |
| AFG: Logar-Wardak | name parts (2 pieces, worst match 100) | 2 |
| AFG: Paktia-Khost-Paktika | name parts (3 pieces, worst match 100) | 3 |
| AFG: Parwan-Kapisa-Panjshir | alias hint -> AFG-1772, AFG-1769, AF-KAP | 3 |
| AFG: Uruzgan-Zabul-Daykundi | name parts (3 pieces, worst match 100) | 3 |
| BGD: Dhaka | name match 100; less BGD:Mymensingh (carve) | 1 |
| BGD: Mymensingh | no admin-1 match (best unit 40, group 0); carve: BGD units Mymensingh, Netrakona, Jamalpur, Sherpur from BGD:Dhaka | 0 |
| BTN: Central Bhutan | alias hint -> region:Central, region:Southern | 9 |
| BTN: Chukha-Samtse | name parts (2 pieces, worst match 100) | 2 |
| BTN: Eastern Bhutan | alias hint -> region:Eastern | 6 |
| BTN: Thimphu-Paro-Haa | name parts (3 pieces, worst match 100) | 3 |
| IND: Gujarat-Daman-Diu | alias hint -> IN-GJ, IN-DH | 2 |
| IND: Kerala-Lakshadweep | name parts (2 pieces, worst match 100) | 2 |
| IND: Ladakh | name match 100; plus unclaimed Kashmir | 2 |
| IND: Nagaland-Manipur | name parts (2 pieces, worst match 100) | 2 |
| IND: Punjab-Chandigarh | name parts (2 pieces, worst match 100) | 2 |
| IND: Tamil Nadu-Puducherry | name parts (2 pieces, worst match 100) | 2 |
| IND: Tripura-Mizoram | name parts (2 pieces, worst match 100) | 2 |
| LKA: Central Province | alias hint -> LK-21, LK-22, LK-23 | 3 |
| LKA: Eastern Province | alias hint -> LK-51, LK-52, LK-53 | 3 |
| LKA: North Central Province | alias hint -> LK-71, LK-72 | 2 |
| LKA: North Western Province | alias hint -> LK-61, LK-62 | 2 |
| LKA: Northern Province | alias hint -> LK-41, LK-42, LK-43, LK-44, LK-45 | 5 |
| LKA: Sabaragamuwa Province | alias hint -> LK-91, LK-92 | 2 |
| LKA: Southern Province | alias hint -> LK-31, LK-32, LK-33 | 3 |
| LKA: Uva Province | alias hint -> LK-81, LK-82 | 2 |
| LKA: Western Province | alias hint -> LK-11, LK-12, LK-13 | 3 |
| NPL: Bagmati | name match 100; carve: NPL units Sindhuli, Ramechhap, Dolakha, Sindhupalchok, Kabherepalanchok, Lalitpur, Bhaktapur, Kathmandu, Nuwakot, Rasuwa, Dhading, Makawanpur, Chitawan from NPL:Province No. 5 | 0 |
| NPL: Gandaki | name match 100; carve: NPL units Gorkha, Lamjung, Tanahu, Synagja, Kaski, Manang, Mustang, Myagdi, Parbat, Baglung, Nawalapur from NPL:Province No. 5 | 0 |
| NPL: Karnali | name match 100; carve: NPL units Dolpa, Mugu, Humla, Jumla, Kalikot, Jajarkot, Rukum_W, Salyan, Surkhet from NPL:Province No. 5 | 0 |
| NPL: Province No. 1 | no admin-1 match (best unit 38, group 30); carve: NPL units Taplejung, Panchthar, Ilam, Jhapa, Morang, Sunsari, Dhankuta, Terhathum, Sankhuwasabha, Bhojpur, Solukhumbu, Okhaldhunga, Khotang, Udayapur from NPL:Province No. 5 | 0 |
| NPL: Province No. 2 | no admin-1 match (best unit 38, group 30); carve: NPL units Saptari, Dhanusha, Mahottari, Sarlahi, Rautahat, Bara from NPL:Province No. 5 | 0 |
| NPL: Province No. 5 | alias hint -> NP-BA, NP-BH, NP-KO, NP-DH, NP-GA, NP-JA, NP-KA, NP-LU, NP-MA, NP-ME, NP-NA, NP-RA, NP-SA, NP-SE; less NPL:Bagmati (carve); less NPL:Gandaki (carve); less NPL:Karnali (carve); less NPL:Province No. 1 (carve); less NPL:Province No. 2 (carve); less NPL:Sudurpashchim (carve) | 14 |
| NPL: Sudurpashchim | no admin-1 match (best unit 79, group 24); carve: NPL units Baijura, Bajhang, Achham, Doti, Kailali, Kanchanpur, Dadeidhura, Baitadi, Darchula from NPL:Province No. 5 | 0 |
| PAK: Azad Jammu and Kashmir | alias hint -> PK-JK | 1 |
| PAK: Khyber Pakhtunkhwa | name match 100; plus unclaimed F.A.T.A. | 2 |

## Land without a province

Natural Earth admin-1 units of this file's countries that no region claims and that touch no region of their country (overseas territories, remote islands). They stay water on the map.

None.

## Sea links

`sea` rows of province-adjacency.csv with a province of this file: coastal provinces whose shapes do not touch but face each other across a strait (D678).

BD-0013-BD-0022, BD-0015-BD-0022, IN-0039-LK-0008

## Small provinces

None.

## Uneven Voronoi splits

Blocks (ADM2 units, or admin-1 units for Greenland) that several provinces share, where one province takes most of the block. Check that the larger part belongs where it went.

| Region | Block | Shares |
|---|---|---|
| BGD:Rangpur | Rangpur | BD-0026 78%, BD-0027 22% |
| IND:Delhi | part-0 | IN-0002 76%, IN-0001 24% |
| IND:Haryana | part-0 | IN-0004 94%, IN-0003 6% |
| IND:Telangana | part-0 | IN-0032 92%, IN-0031 5%, IN-0029 3%, IN-0030 1% |

## Named places outside their province

A Natural Earth place matched in the name or notes that ended up in another province (usually a neighbour that names the same city more directly, as Long Beach-Harbor's notes name Los Angeles).

| Province | Name | Place | Lies in |
|---|---|---|---|
| IN-0068 | Bhopal-Gwalior | Sagar | IN-0067 |
| IN-0007 | Agra-Aligarh | Lucknow | IN-0009 |

## Region nesting

Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill each under 1e-06 of the region's area); mapshaper then simplifies shared arcs once, so neighbours stay gap-free.

## Coastal cross-check

Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are listed for review; the CSV is not changed.

| Province | Name | Water edges (px) | Bitmap | CSV |
|---|---|---|---|---|
| BD-0004 | Narayanganj | 20 | Y | N |
| BD-0008 | Faridpur-Padma | 22 | Y | N |
| BD-0013 | Comilla-Chandpur | 14 | Y | N |
| IN-0017 | Pune City | 8 | Y | N |
| IN-0028 | North Karnataka | 31 | Y | N |
| IN-0035 | Sriperumbudur-Oragadam | 15 | Y | N |
| IN-0040 | Kolkata City-Salt Lake | 0 | N | Y |
| IN-0041 | Howrah-Hooghly | 0 | N | Y |
| IN-0077 | Keonjhar-Rourkela | 21 | Y | N |
| PK-0001 | Karachi Saddar-Clifton | 2 | N | Y |

## Provinces in several parts

Islands and exclaves are allowed; the label point sits in the largest part.

NP-0010 (52), NP-0011 (30), IN-0097 (16), LK-0008 (10), IN-0054 (8), IN-0067 (7), IN-0036 (6), IN-0068 (6), BD-0022 (5), IN-0028 (5), BD-0007 (4), BD-0023 (4), IN-0039 (4), IN-0043 (4), IN-0059 (4), IN-0073 (4), IN-0076 (4), PK-0007 (4), PK-0030 (4), BD-0005 (3), BD-0011 (3), BD-0012 (3), BD-0015 (3), BD-0019 (3), IN-0013 (3), IN-0026 (3), IN-0044 (3), IN-0046 (3), IN-0051 (3), IN-0056 (3), IN-0079 (3), IN-0085 (3), IN-0086 (3), NP-0008 (3), PK-0016 (3), AF-0006 (2), BD-0006 (2), BD-0010 (2), BD-0020 (2), BD-0027 (2), IN-0004 (2), IN-0011 (2), IN-0015 (2), IN-0020 (2), IN-0024 (2), IN-0025 (2), IN-0030 (2), IN-0031 (2), IN-0034 (2), IN-0047 (2), IN-0048 (2), IN-0049 (2), IN-0055 (2), IN-0070 (2), IN-0087 (2), IN-0089 (2), IN-0090 (2), IN-0093 (2), LK-0006 (2), LK-0010 (2), MV-0001 (2), NP-0012 (2), NP-0013 (2), PK-0002 (2), PK-0004 (2), PK-0017 (2), PK-0023 (2), PK-0032 (2)

## Visual check

`preview-south-asia.png` in this folder is province-ids.png around the region (pixels x 5263..6499, y 1476..2764, scaled by 1.94).
