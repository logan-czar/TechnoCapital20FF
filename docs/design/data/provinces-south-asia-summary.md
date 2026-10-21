# South Asia province slice: summary (2026-10-20)

Batch 125 card (Logan): former hubs list scrapped; key cities hold perks and starting businesses; Metros only from the 5M+ rule. This slice has no `former_hub` column; each key city's province ids are listed below for [2-map-and-influence.md](../detailed/2-map-and-influence.md) 2.3.3.

_Generated from [provinces-south-asia.csv](provinces-south-asia.csv) (batch 126). Same columns and rules as the North America, Europe, Latin America and East Asia and Oceania slices, including `contested` and `linked_cities` (batch 122). Population follows the spec formula from rough 2019 population estimates (A); Commerce and Industry are hand-set (T). Names are ASCII (A). Resource tags include Bauxite, Silver, Zinc and Tin (batch 124). Alternate history: no COVID and no 2008 crash; every South Asian terror attack happened as in real life; Afghanistan is a stable, US-aligned state under Massoud's chosen successor (19-history 19.22), so its provinces carry no Taliban-war damage and the Mes Aynak and Hajigak mines have started (A)._

**Total:** 208 provinces in 8 countries (plan 203). Metros: 13 (40 provinces). World plan in countries.csv: 3234; with this slice's actual counts it would be 3239.

## Provinces per country

| Country | Name | Provinces | Plan | Regions | Areas | Metro provinces | Total development |
|---|---|---|---|---|---|---|---|
| IND | India | 97 | 91 | 30 | 37 | 26 | 3990 |
| PAK | Pakistan | 34 | 35 | 7 | 11 | 7 | 1173 |
| BGD | Bangladesh | 29 | 29 | 8 | 10 | 7 | 968 |
| AFG | Afghanistan | 17 | 17 | 17 | 17 | 0 | 375 |
| LKA | Sri Lanka | 13 | 13 | 9 | 9 | 0 | 321 |
| NPL | Nepal | 13 | 13 | 7 | 7 | 0 | 318 |
| BTN | Bhutan | 4 | 4 | 4 | 4 | 0 | 50 |
| MDV | Maldives | 1 | 1 | 1 | 1 | 0 | 20 |
| **All** | | **208** | 203 | 83 | 96 | 40 | 7215 |

Counts that differ from the plan (all within +/-10%): IND 97 (plan 91), PAK 34 (plan 35).

India (plan 91) uses 97: its 9 Metros take 29 provinces (Delhi NCR 4, Mumbai 4, Kolkata, Bengaluru, Chennai and Hyderabad 3 each, Ahmedabad, Surat and Pune 2 each), and 28 states plus union territories need at least one province each, so rural India gets very large provinces: Uttar Pradesh's 7 non-Metro provinces average 31M people and Bihar's 3 average 40M, and these sit near the top of the Population track (27 to 28) (A). Pakistan 34 (plan 35) keeps the four provinces and the two Pakistani-held parts of Kashmir; the former tribal districts merged into Khyber Pakhtunkhwa in 2018 are spread over three border provinces (A).

## Regions

Regions are the real first-level divisions: Indian states and union territories, Pakistani provinces and territories, Bangladeshi divisions, Sri Lankan provinces and Nepali provinces (Province No. 1, No. 2 and No. 5 had no names yet in January 2020; Bagmati was named on 12 January 2020). Where a country has fewer provinces than divisions, neighbouring divisions are grouped and the region name joins theirs (A): India's small union territories go with a neighbour (Punjab-Chandigarh, Tamil Nadu-Puducherry, Kerala-Lakshadweep, and Gujarat-Daman-Diu for Dadra and Nagar Haveli and Daman and Diu, merged on 26 January 2020), and the small northeastern states pair up (Nagaland-Manipur, Tripura-Mizoram). Ladakh is its own union territory (since 31 October 2019). Bhutan's 20 districts form 4 regions and Afghanistan's 34 provinces form 17 regions of one province each (A). A default area that shares its name with a region elsewhere gets the country name in brackets.

- **IND:** Delhi 2, Haryana 2, Uttar Pradesh 8, Maharashtra 10, Karnataka 6, Telangana 4, Tamil Nadu-Puducherry 7, West Bengal 8, Gujarat-Daman-Diu 8, Rajasthan 4, Punjab-Chandigarh 2, Himachal Pradesh 1, Uttarakhand 1, Jammu and Kashmir 2, Ladakh 1, Madhya Pradesh 3, Bihar 3, Jharkhand 3, Odisha 4, Chhattisgarh 2, Andhra Pradesh 4, Kerala-Lakshadweep 2, Goa 1, Assam 3, Arunachal Pradesh 1, Meghalaya 1, Tripura-Mizoram 1, Nagaland-Manipur 1, Sikkim 1, Andaman and Nicobar Islands 1
- **PAK:** Sindh 8, Punjab 12, Islamabad Capital Territory 1, Khyber Pakhtunkhwa 6, Balochistan 5, Gilgit-Baltistan 1, Azad Jammu and Kashmir 1
- **BGD:** Dhaka 8, Chittagong 7, Rajshahi 3, Khulna 3, Barisal 2, Sylhet 2, Rangpur 2, Mymensingh 2
- **AFG:** Kabul 1, Parwan-Kapisa-Panjshir 1, Logar-Wardak 1, Nangarhar 1, Kunar-Laghman-Nuristan 1, Paktia-Khost-Paktika 1, Ghazni 1, Kandahar 1, Helmand 1, Farah-Nimroz 1, Uruzgan-Zabul-Daykundi 1, Herat-Badghis 1, Bamyan-Ghor 1, Balkh-Samangan 1, Jowzjan-Faryab-Sar-e Pol 1, Kunduz-Baghlan-Takhar 1, Badakhshan 1
- **LKA:** Western Province 3, Central Province 2, Southern Province 2, Northern Province 1, Eastern Province 1, North Western Province 1, North Central Province 1, Uva Province 1, Sabaragamuwa Province 1
- **NPL:** Province No. 1 2, Province No. 2 2, Bagmati 3, Gandaki 2, Province No. 5 2, Karnali 1, Sudurpashchim 1
- **BTN:** Thimphu-Paro-Haa 1, Chukha-Samtse 1, Central Bhutan 1, Eastern Bhutan 1

## Metros (13)

Every South Asian city of 5M+ (UN urban agglomeration estimates for 2020 (A)) is a Metro, and no other city is (batch 125). Commerce/Industry/Population shares are of the Metro's total development.

| Metro | Size | Pop (M) | Provinces (id, region, total) | Total dev | C/I/P | Key city |
|---|---|---|---|---|---|---|
| Delhi NCR | Mega | 30.3 | New Delhi-South Delhi (IN-0001, Delhi, 54), North-East-West Delhi (IN-0002, Delhi, 46), Gurugram-Faridabad (IN-0003, Haryana, 56), Noida-Ghaziabad (IN-0005, Uttar Pradesh, 50) | 206 | 33%/27%/40% | yes |
| Dhaka | Mega | 21.0 | Dhaka Motijheel-Gulshan (BD-0001, Dhaka, 51), Old Dhaka-Mirpur (BD-0002, Dhaka, 43), Gazipur-Tongi (BD-0003, Dhaka, 45), Narayanganj (BD-0004, Dhaka, 40), Savar-Ashulia (BD-0005, Dhaka, 41) | 220 | 22%/36%/41% | no |
| Mumbai | Mega | 20.4 | South Mumbai-BKC (IN-0013, Maharashtra, 50), Mumbai Western Suburbs (IN-0014, Maharashtra, 42), Mumbai Eastern Suburbs-Thane (IN-0015, Maharashtra, 46), Navi Mumbai-JNPT (IN-0016, Maharashtra, 48) | 186 | 34%/25%/40% | yes |
| Karachi | XL | 16.1 | Karachi Saddar-Clifton (PK-0001, Sindh, 49), Karachi Port-SITE (PK-0002, Sindh, 47), Karachi Korangi-Port Qasim (PK-0003, Sindh, 47), Karachi Gulshan-North (PK-0004, Sindh, 36) | 179 | 30%/30%/41% | no |
| Kolkata | XL | 14.9 | Kolkata City-Salt Lake (IN-0040, West Bengal, 48), Howrah-Hooghly (IN-0041, West Bengal, 41), North 24 Parganas-Barrackpore (IN-0042, West Bengal, 38) | 127 | 26%/28%/46% | no |
| Lahore | XL | 12.6 | Lahore Mall-Gulberg (PK-0009, Punjab, 47), Lahore Cantt-DHA (PK-0010, Punjab, 38), Lahore Industrial-Sheikhupura (PK-0011, Punjab, 44) | 129 | 33%/25%/43% | no |
| Bengaluru | XL | 12.3 | Bengaluru Central-Whitefield (IN-0023, Karnataka, 51), Bengaluru South-Electronic City (IN-0024, Karnataka, 48), Bengaluru North-Peenya (IN-0025, Karnataka, 45) | 144 | 36%/26%/38% | yes |
| Chennai | XL | 11.0 | Chennai Central-OMR (IN-0033, Tamil Nadu-Puducherry, 49), Chennai North-Ennore (IN-0034, Tamil Nadu-Puducherry, 45), Sriperumbudur-Oragadam (IN-0035, Tamil Nadu-Puducherry, 47) | 141 | 26%/37%/38% | yes |
| Hyderabad | XL | 10.0 | Hyderabad Old City-Secunderabad (IN-0029, Telangana, 40), Cyberabad-HITEC City (IN-0030, Telangana, 47), Hyderabad East-Genome Valley (IN-0031, Telangana, 46) | 133 | 33%/29%/38% | yes |
| Ahmedabad | L | 8.1 | Ahmedabad City (IN-0048, Gujarat-Daman-Diu, 52), Gandhinagar-Sanand (IN-0049, Gujarat-Daman-Diu, 50) | 102 | 31%/33%/35% | no |
| Surat | L | 7.2 | Surat City (IN-0053, Gujarat-Daman-Diu, 49), Hazira-Kamrej (IN-0054, Gujarat-Daman-Diu, 42) | 91 | 21%/42%/37% | no |
| Pune | L | 6.6 | Pune City (IN-0017, Maharashtra, 46), Pimpri-Chinchwad-Chakan (IN-0018, Maharashtra, 49) | 95 | 27%/36%/37% | no |
| Chittagong | L | 5.0 | Chittagong City-Port (BD-0009, Chittagong, 50), Sitakunda-Mirsarai (BD-0010, Chittagong, 38) | 88 | 23%/41%/36% | no |

Shapes (A): Delhi NCR crosses three regions (two Delhi provinces, Gurugram-Faridabad in Haryana, Noida-Ghaziabad in Uttar Pradesh). Mumbai's 4 provinces cover the city, Thane and Navi Mumbai; Vasai-Virar sits in the Thane province. Kolkata's south suburbs and the Sundarbans are one non-Metro province (South 24 Parganas-Sundarbans). Hyderabad is exactly 10.0M and so takes the XL shape of 3. Chittagong is borderline (about 5.0M in 2020) and becomes a 2-province Metro by the rule; the next largest cities, Kabul (4.3M), Jaipur (3.9M), Lucknow (3.7M), Faisalabad (3.4M) and Kanpur (3.1M), are Metropolis provinces without a Metro. Their provinces also hold large rural districts, so the Metropolis check uses the city's own population (CITY_POP in the generator) (A).

## Key cities (2-map 2.3.3)

Province ids for the South Asia rows marked "slice pending" in 2.3.3, for Logan to copy into the doc.

| Key city | Province ids | Provinces | Specialty fit |
|---|---|---|---|
| Mumbai | IN-0013 to IN-0016, IN-0051 | South Mumbai-BKC, Mumbai Western Suburbs, Mumbai Eastern Suburbs-Thane, Navi Mumbai-JNPT, Jamnagar-Saurashtra | finance and the exchanges in South Mumbai-BKC, film in the Western Suburbs, refineries at Trombay, JNPT port; Jamnagar-Saurashtra replaces "petrochemicals (Gujarat abstracted)" with the real Reliance Jamnagar refinery province (A) |
| Bengaluru | IN-0023 to IN-0025 | Bengaluru Central-Whitefield, Bengaluru South-Electronic City, Bengaluru North-Peenya | IT services and chip design in Central-Whitefield and South-Electronic City (Biocon biotech there too); aerospace (HAL, airport aerospace SEZ) split between Central-Whitefield and North-Peenya |
| Delhi NCR | IN-0001 to IN-0003, IN-0005 | New Delhi-South Delhi, North-East-West Delhi, Gurugram-Faridabad, Noida-Ghaziabad | government in New Delhi-South Delhi; IT services and Maruti's autos in Gurugram-Faridabad; Samsung's phone plant and telecom in Noida-Ghaziabad |
| Hyderabad | IN-0029 to IN-0031 | Hyderabad Old City-Secunderabad, Cyberabad-HITEC City, Hyderabad East-Genome Valley | IT services and data centres in Cyberabad-HITEC City; pharma (bulk drugs, vaccines) in Hyderabad East-Genome Valley |
| Chennai | IN-0033 to IN-0035 | Chennai Central-OMR, Chennai North-Ennore, Sriperumbudur-Oragadam | autos and electronics assembly in Sriperumbudur-Oragadam; port and refinery in Chennai North-Ennore; IT on OMR |

Karachi, Lahore, Dhaka, Kolkata and the other Metros here are not key cities; 2.3.3 lists none of them.

## Contested provinces (batch 123)

| Province | Owner | Contested | Dispute |
|---|---|---|---|
| Kashmir Valley (IN-0064) | IND | PAK claims | Kashmir: Pakistan claims the Indian-held part of the former princely state |
| Jammu (IN-0065) | IND | PAK claims | Kashmir: Pakistan claims the Indian-held part of the former princely state |
| Ladakh (IN-0066) | IND | PAK claims | Kashmir: Pakistan claims the Indian-held part of the former princely state |
| Arunachal Pradesh (IN-0092) | IND | CHN claims | China claims the whole state as South Tibet |
| Gilgit-Baltistan (PK-0033) | PAK | IND claims | Kashmir: India claims the Pakistani-held part of the former princely state |
| Azad Kashmir (PK-0034) | PAK | IND claims | Kashmir: India claims the Pakistani-held part of the former princely state |

Ladakh is flagged "PAK claims" because it was part of the Jammu and Kashmir state until October 2019 and Pakistan disputes the whole former princely state, Siachen included (A). Not flagged, notes only (A): Aksai Chin (held by China, on Kashgar-Hotan CN-0144, and named in the Ladakh note), the Shaksgam valley (on Gilgit-Baltistan), Kalapani (Nepal's claim after India's November 2019 map, on Uttarakhand), Sir Creek (on Kutch-North Gujarat), Doklam (on Phuentsholing-Chukha) and the Durand Line, which Afghanistan has never recognized but does not formally claim across (on Khyber-Kurram).

## Linked cities

- **Islamabad-Rawalpindi:** Rawalpindi-Potohar (PK-0014), Islamabad (PK-0021). The twin cities: the federal capital and the army's garrison city run as one labour and property market (about 4M people) without one core, and Islamabad cannot be a Metro with Rawalpindi because the pair is under 5M (A).

Other clusters considered and left out (A): the Kerala coast (no shared economy beyond remittances), Kanpur-Lucknow (already one province) and Surat-Vadodara-Ahmedabad (two Metros and a city, 150 to 250 km apart).

## Top 15 provinces by total development

| Rank | Province | Country | Metro | C | I | P | Total |
|---|---|---|---|---|---|---|---|
| 1 | Gurugram-Faridabad | IND | Delhi NCR | 20 | 18 | 18 | 56 |
| 2 | New Delhi-South Delhi | IND | Delhi NCR | 26 | 6 | 22 | 54 |
| 3 | Lucknow-Kanpur | IND | - | 12 | 12 | 28 | 52 |
| 4 | Ahmedabad City | IND | Ahmedabad | 18 | 14 | 20 | 52 |
| 5 | Bengaluru Central-Whitefield | IND | Bengaluru | 24 | 8 | 19 | 51 |
| 6 | Dhaka Motijheel-Gulshan | BGD | Dhaka | 26 | 6 | 19 | 51 |
| 7 | Noida-Ghaziabad | IND | Delhi NCR | 12 | 18 | 20 | 50 |
| 8 | South Mumbai-BKC | IND | Mumbai | 30 | 3 | 17 | 50 |
| 9 | Gandhinagar-Sanand | IND | Ahmedabad | 14 | 20 | 16 | 50 |
| 10 | Chittagong City-Port | BGD | Chittagong | 16 | 16 | 18 | 50 |
| 11 | Pimpri-Chinchwad-Chakan | IND | Pune | 8 | 24 | 17 | 49 |
| 12 | Chennai Central-OMR | IND | Chennai | 22 | 8 | 19 | 49 |
| 13 | Surat City | IND | Surat | 14 | 16 | 19 | 49 |
| 14 | Karachi Saddar-Clifton | PAK | Karachi | 26 | 5 | 18 | 49 |
| 15 | Navi Mumbai-JNPT | IND | Mumbai | 9 | 22 | 17 | 48 |

## Resource tags

| Tag | Count | Provinces |
|---|---|---|
| None | 70 | |
| Farmland | 57 | |
| Hydropower | 16 | Himachal Pradesh (IND), Uttarakhand (IND), Jammu (IND), Arunachal Pradesh (IND), Sikkim (IND), Hazara (PAK), Gilgit-Baltistan (PAK), Azad Kashmir (PAK), Kandy-Matale (LKA), Badulla-Monaragala (LKA), Eastern Hills-Everest (NPL), Bagmati Hills (NPL), Gandaki Hills (NPL), Karnali (NPL), Phuentsholing-Chukha (BTN), Punakha-Wangdue (BTN) |
| Coal | 14 | Varanasi-Purvanchal (IND), Nagpur-Vidarbha (IND), Rest of Telangana (IND), North Tamil Nadu-Puducherry (IND), Bardhaman-Asansol (IND), Jabalpur-Singrauli (IND), Dhanbad-Bokaro-Santhal Pargana (IND), Angul-Talcher-Jharsuguda (IND), Korba-Raigarh (IND), Meghalaya (IND), Thar-Mirpur Khas (PAK), Quetta (PAK), Rangpur-Dinajpur (BGD), Kunduz-Baghlan-Takhar (AFG) |
| Fishing | 12 | Mangaluru-Malnad (IND), South 24 Parganas-Sundarbans (IND), Kozhikode-Malabar (IND), Andaman and Nicobar Islands (IND), Gwadar-Makran-Lasbela (PAK), Cox's Bazar (BGD), Khulna-Mongla (BGD), Patuakhali-Barguna (BGD), Galle-Matara (LKA), Jaffna-Vanni (LKA), Trincomalee-Batticaloa (LKA), Maldives (MDV) |
| Gas | 10 | Vadodara-Bharuch (IND), Godavari-Kakinada (IND), Tripura-Mizoram (IND), Hyderabad-Lower Sindh (PAK), Sukkur-Larkana (PAK), Sui-Nasirabad (PAK), Brahmanbaria (BGD), Barisal-Bhola (BGD), Habiganj-Moulvibazar (BGD), Jowzjan-Faryab-Sar-e Pol (AFG) |
| Iron ore | 6 | North Karnataka (IND), Jamshedpur-Singhbhum (IND), Keonjhar-Rourkela (IND), Raipur-Bastar (IND), Goa (IND), Bamyan-Ghor (AFG) |
| Timber | 6 | Nagaland-Manipur (IND), Malakand-Swat (PAK), Chittagong Hill Tracts (BGD), Trashigang-Mongar (BTN), Kunar-Laghman-Nuristan (AFG), Paktia-Khost-Paktika (AFG) |
| Oil | 5 | Kutch-North Gujarat (IND), Jodhpur-Barmer-Bikaner (IND), Upper Assam (IND), Rawalpindi-Potohar (PAK), Kohat-Karak-Bannu (PAK) |
| Copper | 3 | Jaipur-Shekhawati (IND), Chagai-Kharan (PAK), Logar-Wardak (AFG) |
| Bauxite | 2 | Ranchi-Palamu (IND), Koraput-Ganjam (IND) |
| Uranium | 2 | Rayalaseema-Nellore (IND), Dera Ghazi Khan (PAK) |
| Rare earths | 2 | Kochi-Thiruvananthapuram (IND), Helmand (AFG) |
| Zinc | 1 | Udaipur-Bhilwara (IND) |
| Lithium | 1 | Ghazni (AFG) |
| Gold | 1 | Badakhshan (AFG) |

Gems (Sri Lankan sapphires, Afghan lapis and emeralds), chromite, diamonds, salt and tin (Bastar) have no tag and sit in notes (A). Refinery towns that import crude (Jamnagar, Trombay, Paradip, Haldia) are tagged None (A). Coal is common because India mines it in many states; Silver sits in the Zinc province (Hindustan Zinc's Sindesar Khurd) (A).

## Other counts

- City rank: City 99, Town 55, Metropolis 44, none 10
- Terrain: Temperate 55, Mountain 45, Urban 40, Tropical 34, Desert 19, Wetland 15
- Coastal: 52 (sea coasts only; Dhaka's and Barisal's river ports do not count, except Khulna-Mongla and Chittagong, which take ocean ships (A))
- Chokepoint exposure: Strait of Hormuz 6, Strait of Malacca 5, Bab-el-Mandeb 4, Suez Canal 4, Red Sea cable corridor 2, Singapore cable landing 1. Only 2.4.2 chokepoints are used and most of the region has none. Strait of Hormuz: the ports and refineries that run on Gulf crude and LNG (Jamnagar, Kutch, JNPT, Karachi and Port Qasim, Gwadar); Bab-el-Mandeb and Suez: the main Europe-bound container ports (JNPT, Mundra-Kandla, Karachi, Colombo); Red Sea cable corridor: the Mumbai and Karachi cable landings; Strait of Malacca: the east-facing ports (Chennai, Haldia, Chittagong, Colombo) and the Andaman and Nicobar Islands; Singapore cable landing: the Chennai landings (A). Bay of Bengal and Arabian Sea routes otherwise need no chokepoint.

## Scale deviations (T)

Provinces outside their rank's development band, listed for tuning:

- none

## Things that work differently in South Asia

- Rural India is very large per province (up to 43M people), so Population nearly maxes out (28 of 30) in plain farm provinces. They stay inside the City band only because Commerce and Industry are low (T).
- Pakistan's and Sri Lanka's debt vassalage to China (countries.csv subject_of) has no province flag; the Chinese-run ports (Gwadar, Hambantota, Colombo Port City) carry it in notes only (A).
- The Kashmir flags cover the whole Indian and Pakistani-held parts, as ruled; the Line of Control itself is not a province.
