# East Asia and Oceania province slice: summary (2026-10-19)

Batch 125 card (Logan): former hubs list scrapped; key cities hold perks and starting businesses; Metros only from the 5M+ rule. The `former_hub` column is gone from the CSV; each key city's province ids are in [2-map-and-influence.md](../detailed/2-map-and-influence.md) 2.3.3, and the "Old mix" column below is a historical check only (the old district mix no longer seeds anything).

_Generated from [provinces-east-asia-oceania.csv](provinces-east-asia-oceania.csv) (batch 124). Same columns and rules as the North America, Europe and Latin America slices, including `contested` and `linked_cities` (batch 122). Population follows the spec formula from rough 2019-2020 population estimates (A); Commerce and Industry are hand-set (T). Names are ASCII (accents and macrons dropped) (A). Resource tags include Bauxite, Silver, Zinc and Tin (added in batch 124)._

**Total:** 606 provinces in 32 countries and territories (plan 597). Metros: 34 (114 provinces). World plan in countries.csv: 3225; with this slice's actual counts it would be 3234.

## Provinces per country

| Country | Name | Provinces | Plan | Regions | Areas | Metro provinces | Total development |
|---|---|---|---|---|---|---|---|
| CHN | China | 146 | 141 | 32 | 36 | 48 | 6150 |
| JPN | Japan | 63 | 61 | 46 | 46 | 16 | 1966 |
| AUS | Australia | 53 | 52 | 8 | 13 | 4 | 1080 |
| IDN | Indonesia | 51 | 51 | 32 | 33 | 11 | 1730 |
| KOR | South Korea | 35 | 35 | 17 | 17 | 6 | 1078 |
| THA | Thailand | 30 | 30 | 29 | 29 | 4 | 876 |
| PHL | Philippines | 29 | 29 | 17 | 17 | 4 | 897 |
| VNM | Vietnam | 27 | 26 | 15 | 15 | 7 | 904 |
| MYS | Malaysia | 23 | 23 | 14 | 14 | 3 | 659 |
| TWN | Taiwan | 22 | 22 | 22 | 22 | 3 | 554 |
| MMR | Myanmar | 21 | 21 | 15 | 15 | 2 | 520 |
| NZL | New Zealand | 16 | 16 | 13 | 13 | 0 | 266 |
| MNG | Mongolia | 15 | 15 | 14 | 14 | 0 | 180 |
| KHM | Cambodia | 12 | 12 | 12 | 12 | 0 | 262 |
| PNG | Papua New Guinea | 12 | 12 | 12 | 12 | 0 | 238 |
| PRK | North Korea | 11 | 11 | 11 | 11 | 0 | 249 |
| LAO | Laos | 10 | 10 | 10 | 10 | 0 | 184 |
| BRN | Brunei | 4 | 4 | 4 | 4 | 0 | 60 |
| FJI | Fiji | 4 | 4 | 4 | 4 | 0 | 48 |
| HKG | Hong Kong | 3 | 3 | 1 | 1 | 3 | 124 |
| SGP | Singapore | 3 | 3 | 1 | 1 | 3 | 137 |
| SLB | Solomon Islands | 3 | 3 | 3 | 3 | 0 | 32 |
| TLS | Timor-Leste | 3 | 3 | 3 | 3 | 0 | 44 |
| VUT | Vanuatu | 2 | 2 | 2 | 2 | 0 | 17 |
| FSM | Micronesia | 1 | 1 | 1 | 1 | 0 | 6 |
| KIR | Kiribati | 1 | 1 | 1 | 1 | 0 | 8 |
| MHL | Marshall Islands | 1 | 1 | 1 | 1 | 0 | 8 |
| NRU | Nauru | 1 | 1 | 1 | 1 | 0 | 5 |
| PLW | Palau | 1 | 1 | 1 | 1 | 0 | 5 |
| TON | Tonga | 1 | 1 | 1 | 1 | 0 | 8 |
| TUV | Tuvalu | 1 | 1 | 1 | 1 | 0 | 4 |
| WSM | Samoa | 1 | 1 | 1 | 1 | 0 | 11 |
| **All** | | **606** | 597 | 345 | 355 | 114 | 18310 |

Counts that differ from the plan (all within +/-10%): CHN 146 (plan 141), JPN 63 (plan 61), AUS 53 (plan 52), VNM 27 (plan 26).

China (plan 141) uses 146: its 16 Metros take 48 provinces, so the west gets very large provinces (Tibet 2, Qinghai 2, Xinjiang 5, Ningxia 1, Inner Mongolia 5) while the coast keeps one province per city cluster (A). Japan 63 (plan 61) keeps one province per prefecture outside the Metros (San'in's Tottori and Shimane are grouped). Australia 53 (plan 52) splits the Pilbara into its iron ore and LNG coasts; Vietnam 27 (plan 26) keeps the Saigon oil coast and the Cambodian border belt apart (A).

## Regions

Regions are the real first-level divisions: Chinese provinces, autonomous regions and municipalities (Macau was a region inside China until batch 153 gave it its own country row MAC: CN-0030 is now MO-0001); Japanese prefectures; Korean provinces and metropolitan cities; North Korean provinces; Taiwan's 22 counties and cities (one province each); Indonesian, Malaysian, Myanmar and Philippine provinces, states and regions; Australian states and territories; New Zealand regions. Where a country has fewer provinces than divisions, neighbouring divisions are grouped into one region whose name joins theirs (for example Tottori-Shimane, Kedah-Perlis, North Sulawesi-Gorontalo) (A). Thailand (77 provinces for 30 map provinces), Vietnam (63 for 27), Cambodia, Laos, Mongolia and Papua New Guinea use groups of neighbouring divisions as regions; Vietnam uses its socio-economic regions (Mekong Delta, Central Highlands, ...) where several groups share one (A). The Philippines uses its 17 administrative regions, as its 81 provinces are far more than 29 map provinces (A). Putrajaya is grouped into Selangor (A). A default area that shares its name with a region elsewhere gets the country name in brackets.

- **CHN:** Beijing 4, Tianjin 3, Shanghai 6, Chongqing 5, Guangdong 11, Jiangsu 8, Zhejiang 5, Shandong 8, Hebei 5, Henan 6, Hubei 6, Hunan 4, Jiangxi 4, Anhui 4, Fujian 4, Sichuan 10, Shaanxi 4, Shanxi 3, Liaoning 6, Jilin 3, Heilongjiang 5, Inner Mongolia 5, Guangxi 4, Yunnan 4, Guizhou 3, Hainan 2, Gansu 3, Qinghai 2, Ningxia 1, Xinjiang 5, Tibet 2
- **JPN:** Tokyo 4, Kanagawa 3, Saitama 2, Chiba 2, Ibaraki 1, Tochigi 1, Gunma 1, Yamanashi 1, Hokkaido 4, Aomori 1, Iwate 1, Miyagi 1, Akita 1, Yamagata 1, Fukushima 1, Niigata 1, Toyama 1, Ishikawa 1, Fukui 1, Nagano 1, Gifu 1, Shizuoka 2, Aichi 3, Osaka 3, Hyogo 2, Kyoto 1, Nara 1, Shiga 1, Wakayama 1, Mie 1, Tottori-Shimane 1, Okayama 1, Hiroshima 1, Yamaguchi 1, Kagawa 1, Tokushima 1, Ehime 1, Kochi 1, Fukuoka 2, Saga 1, Nagasaki 1, Kumamoto 1, Oita 1, Miyazaki 1, Kagoshima 1, Okinawa 1
- **AUS:** New South Wales 13, Australian Capital Territory 1, Victoria 9, Queensland 11, Western Australia 9, South Australia 5, Tasmania 3, Northern Territory 2
- **IDN:** Jakarta 3, West Java 7, Banten 2, Central Java 3, Yogyakarta 1, East Java 6, Bali 1, West Nusa Tenggara 1, East Nusa Tenggara 1, Aceh 1, North Sumatra 2, West Sumatra 1, Riau 2, Riau Islands 1, Jambi 1, South Sumatra 1, Bengkulu 1, Lampung 1, Bangka-Belitung 1, West Kalimantan 1, Central Kalimantan 1, South Kalimantan 1, East Kalimantan 2, North Kalimantan 1, North Sulawesi-Gorontalo 1, Central Sulawesi 1, South-West Sulawesi 1, Southeast Sulawesi 1, Maluku 1, North Maluku 1, Papua 1, West Papua 1
- **KOR:** Seoul 2, Incheon 1, Gyeonggi 4, Busan 1, Ulsan 1, Daegu 1, Gwangju 1, Daejeon 1, Sejong 1, Gangwon 3, North Chungcheong 2, South Chungcheong 3, North Jeolla 2, South Jeolla 3, North Gyeongsang 4, South Gyeongsang 4, Jeju 1
- **THA:** Bangkok 2, Samut Prakan 1, Nonthaburi-Pathum Thani 1, Chonburi 1, Rayong 1, Chachoengsao-Prachinburi 1, Ayutthaya-Saraburi 1, Samut Sakhon-Nakhon Pathom 1, Kanchanaburi-Ratchaburi 1, Central Plains 1, Phetchaburi-Prachuap Khiri Khan 1, Chanthaburi-Trat 1, Nakhon Sawan-Kamphaeng Phet 1, Phitsanulok-Sukhothai 1, Chiang Mai-Lamphun 1, Chiang Rai-Phayao 1, Lampang-Phrae-Nan 1, Tak-Mae Hong Son 1, Nakhon Ratchasima 1, Khon Kaen-Kalasin-Maha Sarakham 1, Udon Thani-Nong Khai-Loei 1, Ubon Ratchathani-Sisaket 1, Buriram-Surin-Chaiyaphum 1, Sakon Nakhon-Roi Et-Mekong 1, Surat Thani-Chumphon 1, Phuket-Krabi-Phang Nga 1, Nakhon Si Thammarat-Trang 1, Songkhla-Satun 1, Pattani-Yala-Narathiwat 1
- **PHL:** National Capital Region 4, Calabarzon 4, Central Luzon 3, Ilocos 1, Cagayan Valley 1, Cordillera 1, Mimaropa 2, Bicol 1, Western Visayas 2, Central Visayas 2, Eastern Visayas 1, Zamboanga Peninsula 1, Northern Mindanao 1, Davao 2, Soccsksargen 1, Caraga 1, Bangsamoro 1
- **VNM:** Ho Chi Minh City 2, Binh Duong 1, Dong Nai 1, Ba Ria-Vung Tau 1, Tay Ninh-Binh Phuoc 1, Mekong Delta 4, South Central Coast 4, Central Highlands 2, North Central Coast 3, Hai Phong 1, Quang Ninh 1, Red River Delta 1, Northern Uplands 2, Hanoi 2, Bac Ninh 1
- **MYS:** Kuala Lumpur 1, Selangor 3, Penang 1, Kedah-Perlis 1, Perak 2, Kelantan 1, Terengganu 1, Pahang 2, Negeri Sembilan 1, Melaka 1, Johor 3, Sabah 2, Sarawak 3, Labuan 1
- **TWN:** Taipei 1, New Taipei 1, Taoyuan 1, Hsinchu City 1, Hsinchu County 1, Keelung 1, Yilan 1, Miaoli 1, Taichung 1, Changhua 1, Nantou 1, Yunlin 1, Chiayi City 1, Chiayi County 1, Tainan 1, Kaohsiung 1, Pingtung 1, Taitung 1, Hualien 1, Penghu 1, Kinmen 1, Lienchiang 1
- **MMR:** Yangon 3, Mandalay 2, Naypyidaw 1, Sagaing 2, Magway 1, Bago 1, Ayeyarwady 2, Kachin 1, Shan 2, Rakhine 1, Chin 1, Kayin 1, Kayah 1, Mon 1, Tanintharyi 1
- **NZL:** Auckland 2, Northland 1, Waikato 2, Bay of Plenty 1, Hawke's Bay-Gisborne 1, Taranaki 1, Manawatu-Whanganui 1, Wellington 1, Nelson-Marlborough-Tasman 1, West Coast 1, Canterbury 2, Otago 1, Southland 1
- **MNG:** Ulaanbaatar 1, Tov 1, Selenge-Darkhan-Uul 1, Orkhon-Bulgan 1, Omnogovi 2, Dornogovi-Govisumber 1, Dundgovi 1, Khentii 1, Dornod-Sukhbaatar 1, Arkhangai-Ovorkhangai 1, Khovsgol 1, Zavkhan-Govi-Altai 1, Bayankhongor 1, Western Aimags 1
- **KHM:** Phnom Penh 1, Kandal-Takeo 1, Preah Sihanouk 1, Kampot-Koh Kong 1, Kampong Speu-Pursat-Kampong Chhnang 1, Siem Reap 1, Battambang-Pailin 1, Banteay Meanchey-Oddar Meanchey 1, Kampong Cham-Tbong Khmum 1, Prey Veng-Svay Rieng 1, Kampong Thom-Preah Vihear 1, Northeast Cambodia 1
- **PNG:** National Capital District-Central 1, Hela-Southern Highlands 1, Enga-Western Highlands 1, Eastern Highlands-Simbu-Jiwaka 1, Western-Gulf 1, Morobe 1, Madang 1, East Sepik-Sandaun 1, Milne Bay-Oro 1, New Britain 1, New Ireland-Manus 1, Bougainville 1
- **PRK:** Pyongyang 1, South Pyongan-Nampo 1, North Pyongan 1, Chagang 1, South Hwanghae 1, North Hwanghae 1, Kangwon 1, South Hamgyong 1, North Hamgyong 1, Ryanggang 1, Rason 1
- **LAO:** Vientiane Capital 1, Vientiane Province-Xaisomboun 1, Luang Prabang 1, Northern Laos 1, Xayaboury 1, Houaphanh-Xiengkhouang 1, Bolikhamxay-Khammouane 1, Savannakhet 1, Champasak-Salavan 1, Attapeu-Sekong 1
- **BRN:** Brunei-Muara 1, Belait 1, Tutong 1, Temburong 1
- **FJI:** Central 1, Western 1, Northern 1, Eastern 1
- **HKG:** Hong Kong 3
- **MAC:** Macau 1 (batch 153)
- **SGP:** Singapore 3
- **SLB:** Guadalcanal-Honiara 1, Malaita 1, Western-Choiseul-Isabel 1
- **TLS:** Dili 1, Western Municipalities 1, Eastern Municipalities 1
- **VUT:** Shefa 1, Sanma-Northern Islands 1

## Metros (34)

Commerce/Industry/Population shares of the Metro's total, against the old district mix for key cities (Financial + Tech / Industrial + Port + Resource / Residential + Slums).

| Metro | Size | Pop (M) | Provinces (region, total) | Total dev | C/I/P | Old mix C/I/P |
|---|---|---|---|---|---|---|
| Tokyo-Yokohama | Mega | 37 | Central Tokyo (Tokyo, 51), Tokyo West Wards (Tokyo, 42), Tokyo East Wards-Bay (Tokyo, 48), Tama (Tokyo, 40), Yokohama (Kanagawa, 50), Kawasaki-Sagamihara (Kanagawa, 45), South Saitama (Saitama, 43), Chiba Bay-Funabashi (Chiba, 47) | 366 | 31%/31%/38% | 31%/31%/38% |
| Jakarta | Mega | 34 | Central-South Jakarta (Jakarta, 49), North-West Jakarta (Jakarta, 44), East Jakarta (Jakarta, 37), Bekasi-Cikarang (West Java, 52), Bogor-Depok (West Java, 35), Karawang-Purwakarta (West Java, 40), Tangerang (Banten, 50) | 307 | 22%/36%/42% | 12%/33%/54% |
| Shanghai | Mega | 29 | Lujiazui-Pudong (Shanghai, 57), Puxi Center (Shanghai, 49), Minhang-Songjiang-Jinshan (Shanghai, 49), Jiading-Qingpu (Shanghai, 43), Baoshan-Waigaoqiao (Shanghai, 47), Lingang-Yangshan (Shanghai, 45) | 290 | 27%/36%/37% | 28%/36%/36% |
| Seoul-Pyeongtaek | Mega | 26 | Seoul Gangbuk-Yeouido (Seoul, 49), Seoul Gangnam-Songpa (Seoul, 49), Incheon (Incheon, 45), Suwon-Seongnam-Yongin (Gyeonggi, 57), Hwaseong-Pyeongtaek-Ansan (Gyeonggi, 53), Goyang-Paju-Uijeongbu (Gyeonggi, 39) | 292 | 30%/33%/37% | 33%/29%/38% |
| Shenzhen-Dongguan | Mega | 22 | Shenzhen Futian-Nanshan (Guangdong, 60), Shenzhen Bao'an-Longhua (Guangdong, 54), Shenzhen Longgang-Yantian (Guangdong, 53), Dongguan (Guangdong, 57) | 224 | 22%/42%/36% | 25%/42%/33% |
| Beijing | Mega | 22 | Central Beijing-Financial Street (Beijing, 47), Chaoyang-Shunyi (Beijing, 49), Haidian-Changping (Beijing, 50), Fengtai-Daxing-Yizhuang (Beijing, 48) | 194 | 41%/20%/39% | 33%/17%/50% |
| Guangzhou-Foshan | Mega | 20.6 | Guangzhou Tianhe-Yuexiu (Guangdong, 51), Guangzhou Huangpu-Nansha (Guangdong, 53), Guangzhou North-Baiyun (Guangdong, 43), Foshan (Guangdong, 56) | 203 | 24%/36%/40% | not a key city |
| Osaka-Kobe | XL | 19 | Osaka Kita-Chuo (Osaka, 48), North-East Osaka (Osaka, 43), South Osaka-Sakai (Osaka, 40), Kobe-Hanshin (Hyogo, 47), Kyoto (Kyoto, 40) | 218 | 28%/34%/38% | 17%/44%/39% |
| Chengdu | XL | 16 | Chengdu Jinjiang-Tianfu (Sichuan, 43), Chengdu High-tech West (Sichuan, 45), Chengdu North-Xindu (Sichuan, 36), Chengdu East-Longquanyi (Sichuan, 40), Chengdu West-Wenjiang-Pidu (Sichuan, 35) | 199 | 23%/34%/43% | 22%/28%/50% |
| Chongqing | XL | 15.9 | Yuzhong-Jiangbei (Chongqing, 45), Shapingba-Xiyong (Chongqing, 47), Liangjiang-Yubei (Chongqing, 49) | 141 | 26%/34%/40% | not a key city |
| Ho Chi Minh City | XL | 14 | Saigon Center (Ho Chi Minh City, 51), Thu Duc-Eastern Saigon (Ho Chi Minh City, 46), Binh Duong (Binh Duong, 45), Dong Nai-Bien Hoa (Dong Nai, 43) | 185 | 22%/40%/38% | 11%/44%/44% |
| Manila | XL | 13.9 | Makati-BGC (National Capital Region, 47), Manila-Pasay (National Capital Region, 41), Quezon City-North (National Capital Region, 36), South Metro Manila (National Capital Region, 35) | 159 | 35%/21%/43% | not a key city |
| Tianjin | XL | 13.6 | Tianjin Heping-Nankai (Tianjin, 45), Binhai New Area (Tianjin, 53), Wuqing-Beichen-Jinghai (Tianjin, 43) | 141 | 23%/38%/39% | not a key city |
| Wuhan | XL | 11 | Wuhan Hankou-Jianghan (Hubei, 44), Wuchang-Optics Valley (Hubei, 50), Hanyang-Wuhan Economic Zone (Hubei, 44) | 138 | 26%/35%/39% | 11%/39%/50% |
| Bangkok | XL | 10.5 | Bangkok Silom-Sukhumvit (Bangkok, 50), Thonburi-Bangkok West (Bangkok, 36), Samut Prakan (Samut Prakan, 43), Nonthaburi-Pathum Thani (Nonthaburi-Pathum Thani, 40) | 169 | 27%/34%/38% | not a key city |
| Hsinchu-Taipei | L | 9 | Taipei (Taipei, 48), New Taipei (New Taipei, 42), Taoyuan (Taoyuan, 45) | 135 | 34%/30%/36% | 50%/21%/29% |
| Nanjing | L | 8.8 | Nanjing Xinjiekou-Gulou (Jiangsu, 44), Nanjing Jiangning-Jiangbei (Jiangsu, 47) | 91 | 29%/31%/41% | not a key city |
| Bandung | L | 8.5 | Bandung City (West Java, 40), Bandung Raya-Cimahi (West Java, 38) | 78 | 23%/31%/46% | not a key city |
| Kuala Lumpur | L | 8 | Kuala Lumpur City (Kuala Lumpur, 46), Petaling Jaya-Klang (Selangor, 50), Hulu Langat-Sepang (Selangor, 31) | 127 | 35%/28%/38% | 29%/21%/50% |
| Hanoi | L | 8 | Hanoi Hoan Kiem-Ba Dinh (Hanoi, 44), Hanoi West-Hoa Lac (Hanoi, 42), Bac Ninh (Bac Ninh, 44) | 130 | 27%/35%/38% | 14%/43%/43% |
| Xi'an | L | 8.0 | Xi'an Beilin-Qujiang (Shaanxi, 42), Xi'an High-tech-Xianyang (Shaanxi, 49) | 91 | 26%/33%/41% | not a key city |
| Hangzhou | L | 7.6 | Hangzhou Shangcheng-Binjiang (Zhejiang, 50), Hangzhou Yuhang-Xiaoshan (Zhejiang, 49) | 99 | 36%/26%/37% | not a key city |
| Hong Kong | L | 7.5 | Hong Kong Island-Central (Hong Kong, 45), Kowloon (Hong Kong, 37), New Territories-Lantau (Hong Kong, 42) | 124 | 44%/19%/37% | 43%/21%/36% |
| Nagoya | L | 7.5 | Nagoya City (Aichi, 42), Owari-Nagoya Port (Aichi, 40), Toyota-Mikawa (Aichi, 50) | 132 | 21%/42%/36% | not a key city |
| Shenyang | L | 7.2 | Shenyang Heping-Shenhe (Liaoning, 40), Shenyang Tiexi-Hunnan (Liaoning, 42) | 82 | 23%/34%/43% | not a key city |
| Suzhou | L | 7.1 | Suzhou Industrial Park-Gusu (Jiangsu, 54), Kunshan-Taicang (Jiangsu, 53) | 107 | 21%/45%/35% | not a key city |
| Surabaya | L | 7.0 | Surabaya City (East Java, 45), Sidoarjo-Gresik (East Java, 45) | 90 | 23%/38%/39% | not a key city |
| Harbin | L | 6.4 | Harbin Nangang-Daoli (Heilongjiang, 37), Harbin Songbei-Pingfang (Heilongjiang, 38) | 75 | 23%/32%/45% | not a key city |
| Zhengzhou | L | 6.2 | Zhengzhou Jinshui-Zhengdong (Henan, 44), Zhengzhou Airport-Xinzheng (Henan, 44) | 88 | 24%/36%/40% | not a key city |
| Singapore | L | 6 | Downtown Core-Marina Bay (Singapore, 46), West Singapore-Jurong (Singapore, 49), East Singapore-Changi (Singapore, 42) | 137 | 35%/33%/32% | 36%/43%/21% |
| Qingdao | L | 5.6 | Qingdao Shinan-Laoshan (Shandong, 45), Qingdao Huangdao-West Coast (Shandong, 47) | 92 | 24%/39%/37% | not a key city |
| Sydney | L | 5.4 | Sydney CBD-North Shore (New South Wales, 48), Western Sydney-Parramatta (New South Wales, 40) | 88 | 43%/20%/36% | 29%/29%/43% |
| Yangon | L | 5.3 | Yangon Downtown-Port (Yangon, 40), Yangon North-Hlaingthaya (Yangon, 38) | 78 | 26%/33%/41% | not a key city |
| Melbourne | L | 5.0 | Melbourne CBD-East (Victoria, 46), Melbourne West-North (Victoria, 40) | 86 | 37%/26%/37% | 30%/30%/40% |

The 17 key cities of 5M+ in this superregion are Metros by the 5M+ rule; against the shapes first planned in the old hub list (A): Seoul-Pyeongtaek has 6 provinces (plan 5; Gyeonggi's northern belt of Goyang and Paju is its own member), Singapore 3 (plan 2; the country's budget is 3, all of it urban), Hsinchu-Taipei is Taipei, New Taipei and Taoyuan (8.9M) while Hsinchu City, with TSMC's headquarters, is a separate City province that is not adjacent to Taipei (so it is not in the Hsinchu-Taipei key city's province ids, 2.3.3), and Beijing's 4 provinces cover Beijing municipality only: Tianjin (13.6M) is its own Metro instead of Beijing's old abstracted port. Busan (3.4M city) is a single Metropolis province and Ulsan a City; the old hub list's notes 'with Ulsan and Busan abstracted' and 'with Nagoya abstracted' and 'with Sulawesi nickel abstracted' are replaced by real provinces.

Seventeen cities that are not key cities pass 5M and become Metros by the batch 119 rule: Guangzhou-Foshan (20.6M, Mega 4), Chongqing (15.9M core of a 32M municipality, XL 3), Manila (13.9M, XL 4), Tianjin (XL 3), Bangkok (10.5M, XL 4) and the L Metros Nagoya, Nanjing, Suzhou, Hangzhou, Xi'an, Bandung, Surabaya, Shenyang, Zhengzhou, Harbin, Qingdao and Yangon. Borderline cities kept as single provinces (A): Dalian 4.5M, Changsha 4.6M, Jinan 4.6M, Hefei 4.5M, Medan 4.7M, Kunming 4.4M, Urumqi 4.4M, Changchun 4.4M, Xiamen 4.3M, Shijiazhuang 4.3M, Wuxi 4.1M, Fuzhou 4.0M (Metropolis); Semarang's Kedungsepur, Fukuoka-Kitakyushu and Busan-Ulsan are planning regions of separate cities rather than one 5M city. These use the city's own population for the Metropolis check (CITY_POP in the generator), because their provinces also hold large rural counties (A).

Single provinces for key cities under 5M: Baotou (City, total 44), Penang (City, total 44), Kaohsiung (City, total 45), Perth-Pilbara (City, total 33). Perth-Pilbara is the Perth province; the Pilbara iron ore and LNG coast are two separate provinces 1,500 km north (A).

## Contested provinces (batch 123 and 124)

| Province | Owner | Contested | Dispute |
|---|---|---|---|
| Taipei (TW-0001) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| New Taipei (TW-0002) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Taoyuan (TW-0003) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Hsinchu City (TW-0004) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Hsinchu County (TW-0005) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Keelung (TW-0006) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Yilan (TW-0007) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Miaoli (TW-0008) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Taichung (TW-0009) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Changhua (TW-0010) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Nantou (TW-0011) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Yunlin (TW-0012) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Chiayi City (TW-0013) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Chiayi County (TW-0014) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Tainan (TW-0015) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Kaohsiung (TW-0016) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Pingtung (TW-0017) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Taitung (TW-0018) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Hualien (TW-0019) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Penghu (TW-0020) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Kinmen (TW-0021) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Matsu (TW-0022) | TWN | CHN claims | China claims Taiwan (batch 123 ruling: every Taiwan province) |
| Kota Kinabalu-West Coast (MY-0018) | MYS | PHL claims | The Philippines claims eastern Sabah (the Sulu sultanate claim), never dropped |
| Sandakan-Tawau (MY-0019) | MYS | PHL claims | The Philippines claims eastern Sabah (the Sulu sultanate claim), never dropped |

Not flagged, notes only (A): the Senkaku islands (on Okinawa, not their own province), Dokdo/Takeshima (on Pohang), the Spratly and Paracel islands (on Sanya-Southern Hainan, Palawan, Khanh Hoa-Phu Yen and Da Nang-Quang Nam), Aksai Chin (India's claim, on Kashgar-Hotan), both Koreas' constitutional claims to the whole peninsula, Bougainville's December 2019 independence vote (no other state claims it), and the Kurils (Russia, another superregion; noted on Eastern Hokkaido). Hong Kong is its own country row and is not contested.

## Linked cities

None. The candidate clusters are already Metros or single provinces: the Pearl River Delta is two Metros plus Hong Kong (another country row) and Macau, Kansai is the Osaka-Kobe Metro, and Chang-Zhu-Tan and Wuxi-Changzhou each sit in one province (A).

## Top 15 provinces by total development

| Rank | Province | Country | Metro | C | I | P | Total |
|---|---|---|---|---|---|---|---|
| 1 | Shenzhen Futian-Nanshan | CHN | Shenzhen-Dongguan | 26 | 14 | 20 | 60 |
| 2 | Lujiazui-Pudong | CHN | Shanghai | 28 | 12 | 17 | 57 |
| 3 | Dongguan | CHN | Shenzhen-Dongguan | 7 | 28 | 22 | 57 |
| 4 | Suwon-Seongnam-Yongin | KOR | Seoul-Pyeongtaek | 14 | 24 | 19 | 57 |
| 5 | Foshan | CHN | Guangzhou-Foshan | 8 | 26 | 22 | 56 |
| 6 | Ningbo-Zhoushan | CHN | - | 9 | 26 | 21 | 56 |
| 7 | Shenzhen Bao'an-Longhua | CHN | Shenzhen-Dongguan | 8 | 26 | 20 | 54 |
| 8 | Suzhou Industrial Park-Gusu | CHN | Suzhou | 14 | 22 | 18 | 54 |
| 9 | Wuxi-Changzhou | CHN | - | 10 | 22 | 22 | 54 |
| 10 | Binhai New Area | CHN | Tianjin | 10 | 26 | 17 | 53 |
| 11 | Shenzhen Longgang-Yantian | CHN | Shenzhen-Dongguan | 8 | 26 | 19 | 53 |
| 12 | Guangzhou Huangpu-Nansha | CHN | Guangzhou-Foshan | 8 | 26 | 19 | 53 |
| 13 | Kunshan-Taicang | CHN | Suzhou | 8 | 26 | 19 | 53 |
| 14 | Hwaseong-Pyeongtaek-Ansan | KOR | Seoul-Pyeongtaek | 8 | 28 | 17 | 53 |
| 15 | Bekasi-Cikarang | IDN | Jakarta | 6 | 26 | 20 | 52 |

## Resource tags

| Tag | Count | Provinces |
|---|---|---|
| None | 272 | |
| Farmland | 131 | |
| Fishing | 29 | Sanya-Southern Hainan (CHN), Hakodate-Southwest Hokkaido (JPN), Aomori (JPN), Wakayama (JPN), Ehime (JPN), Nagasaki (JPN), Gangneung-Sokcho (KOR), Mokpo-Yeongam (KOR), Jeju (KOR), Keelung (TWN), Penghu (TWN), Matsu (TWN), North Sulawesi-Gorontalo (IDN), Maluku (IDN), Samut Sakhon-Nakhon Pathom (THA), Zamboanga Peninsula (PHL), Soccsksargen (PHL), Khanh Hoa-Phu Yen (VNM), Ninh Thuan-Binh Thuan (VNM), Cairns-Far North (AUS), Mid West-Gascoyne (AUS), Hobart-South (AUS), Nelson-Marlborough (NZL), Fiji Eastern Islands (FJI), Tonga (TON), Kiribati (KIR), Micronesia (FSM), Palau (PLW), Tuvalu (TUV) |
| Coal | 28 | Xuzhou-Suqian (CHN), Jining-Zaozhuang-Heze (CHN), Handan-Xingtai (CHN), Northern Henan (CHN), Northern Anhui (CHN), Northern Shaanxi (CHN), Datong-Shuozhou-Xinzhou (CHN), Southern Shanxi (CHN), Western Liaoning (CHN), Ordos-Bayannur-Alxa (CHN), Zunyi-Bijie (CHN), Yinchuan-Ningdong (CHN), Turpan-Hami (CHN), Taebaek-Samcheok (KOR), South Pyongan-Nampo (PRK), Tavan Tolgoi-Dalanzadgad (MNG), Jambi (IDN), South Sumatra (IDN), Bengkulu (IDN), South Kalimantan (IDN), Kutai-Berau (IDN), Lampang-Phrae-Nan (THA), Quang Ninh (VNM), Wollongong-Illawarra (AUS), Upper Hunter (AUS), Gippsland-Latrobe Valley (AUS), Bowen Basin-Mackay (AUS), West Coast (New Zealand) (NZL) |
| Timber | 23 | Jilin City-Yanbian (CHN), Northern Heilongjiang (CHN), Hulunbuir-Hinggan (CHN), Southern Yunnan (CHN), Asahikawa-Northern Hokkaido (JPN), Akita (JPN), Kochi (JPN), Ryanggang (PRK), Khovsgol (MNG), Central Kalimantan (IDN), Interior Pahang (MYS), Temburong (BRN), Kampot-Koh Kong (KHM), Kampong Thom-Preah Vihear (KHM), Northern Laos (LAO), Upper Sagaing (MMR), Bago (MMR), Mid North Coast (AUS), Launceston-North (AUS), Northland (NZL), Bay of Plenty (NZL), Sepik (PNG), Western Solomons (SLB) |
| Gas | 21 | Three Gorges-Southeast Chongqing (CHN), Eastern Sichuan (CHN), Korla-Aksu (CHN), Aceh (IDN), West Papua (IDN), Rayong (THA), Songkhla-Satun (THA), Batangas (PHL), Ca Mau-Bac Lieu (VNM), Kota Kinabalu-West Coast (MYS), Bintulu-Miri (MYS), Eastern Municipalities (TLS), Rakhine (MMR), Tanintharyi (MMR), Toowoomba-Darling Downs (AUS), Gladstone-Rockhampton (AUS), Pilbara West-Karratha (AUS), Kimberley (AUS), Darwin (AUS), Taranaki (NZL), Hela-Southern Highlands (PNG) |
| Hydropower | 19 | Yichang-Jingzhou (CHN), Northwest Yunnan (CHN), Eastern and Northern Tibet (CHN), Nantou (TWN), North Kalimantan (IDN), Kanchanaburi-Ratchaburi (THA), Northwest Vietnam (VNM), Sibu-Rajang (MYS), Northeast Cambodia (KHM), Vientiane Province-Xaisomboun (LAO), Luang Prabang (LAO), Xayaboury (LAO), Bolikhamxay-Khammouane (LAO), Attapeu-Sekong (LAO), Kayah (MMR), South Coast-Snowy (AUS), West Coast-Highlands (AUS), Taupo-Coromandel (NZL), Southland (NZL) |
| Gold | 16 | Yantai-Weihai (CHN), Luoyang-Pingdingshan-Sanmenxia (CHN), Western Fujian (CHN), Tov (MNG), Bayankhongor (MNG), Jember-Banyuwangi (IDN), Papua (IDN), Cordillera (PHL), Central West-Orana (AUS), Bendigo-Loddon (AUS), Goldfields-Esperance (AUS), Otago (NZL), Enga-Western Highlands (PNG), Lae-Morobe (PNG), New Ireland-Manus (PNG), Honiara-Guadalcanal (SLB) |
| Oil | 14 | Binhai New Area (CHN), Dongying-Binzhou (CHN), Western Jilin (CHN), Daqing-Qiqihar (CHN), Northern Xinjiang (CHN), Dornod-Sukhbaatar (MNG), Western East Java (IDN), Pekanbaru-Dumai (IDN), Balikpapan-Samarinda (IDN), Nakhon Sawan-Kamphaeng Phet (THA), Ba Ria-Vung Tau (VNM), Terengganu (MYS), Belait (BRN), Magway (MMR) |
| Copper | 12 | Huangshi-Huanggang-Ezhou (CHN), Shangrao-Yingtan-Jingdezhen (CHN), Anqing-Tongling-Chizhou (CHN), Lhasa-Shigatse (CHN), Orkhon-Bulgan (MNG), Oyu Tolgoi-Khanbogd (MNG), West Nusa Tenggara (IDN), Savannakhet (LAO), Monywa-Lower Sagaing (MMR), Mount Isa-Outback (AUS), Western-Gulf (PNG), Bougainville (PNG) |
| Nickel | 8 | Hexi Corridor (CHN), Central Sulawesi (IDN), Makassar-South Sulawesi (IDN), Southeast Sulawesi (IDN), North Maluku (IDN), Palawan (PHL), Caraga (PHL), Madang (PNG) |
| Iron ore | 7 | Tangshan-Qinhuangdao (CHN), Panzhihua-Liangshan (CHN), Anshan-Benxi-Yingkou (CHN), North Hamgyong (PRK), Nghe An-Ha Tinh (VNM), Pilbara East-Port Hedland (AUS), Spencer Gulf-Eyre (AUS) |
| Bauxite | 7 | Taiyuan-Luliang (CHN), Western Guangxi (CHN), West Kalimantan (IDN), Central Highlands South (VNM), Kuantan (MYS), Weipa-Cape York (AUS), Peel-Kwinana (AUS) |
| Lithium | 4 | Yichun-Ji'an-Pingxiang (CHN), Western Sichuan Plateau (CHN), Qaidam and Southern Qinghai (CHN), South West-Greenbushes (AUS) |
| Tin | 4 | Honghe-Wenshan (CHN), Bangka-Belitung (IDN), Ipoh-Kinta (MYS), North Shan-Wa (MMR) |
| Rare earths | 3 | Ganzhou (CHN), Baotou (CHN), Kachin (MMR) |
| Zinc | 3 | Chifeng-Tongliao-Xilingol (CHN), South Hamgyong (PRK), Townsville (AUS) |
| Uranium | 3 | Dornogovi-Govisumber (MNG), Far North-Olympic Dam (AUS), Central Australia-Top End (AUS) |
| Silver | 2 | Hengyang-Chenzhou (CHN), Far West-Broken Hill (AUS) |

Tungsten, antimony, manganese, molybdenum, potash, phosphate and jade have no tag and sit under another tag or None with a note (A). Refinery and smelter towns that import their ore or crude (Rizhao, Ningbo, Ulsan, Jurong) are tagged None (A).

## Other counts

- City rank: Town 227, City 212, Metropolis 132, none 35
- Terrain: Temperate 229, Urban 119, Mountain 111, Tropical 103, Desert 28, Wetland 16
- Coastal: 360 (includes Yangtze ports from Nanjing to Chongqing that take sea-river ships (A))
- Chokepoint exposure: Strait of Malacca 42, Taiwan Strait 32, Luzon Strait 17, Singapore cable landing 3. Only 2.4.2 chokepoints are used. Strait of Malacca: provinces on the strait (Sumatra, Peninsular Malaysia, Singapore, Phuket and Satun) and the main oil, LNG and Europe-bound container ports of East Asia (Tokyo Bay, Nagoya, Osaka-Kobe, Busan, Ulsan, Yeosu, Shanghai, Ningbo, Shenzhen, Saigon, Laem Chabang); Taiwan Strait: the Chinese coast from Shanghai to Guangdong and Taiwan's west coast and islands; Luzon Strait: the Pearl River Delta, Hong Kong, southern and northern Taiwan cable landings and northern Luzon; Singapore cable landing: Singapore (A). The Korea Strait, Sunda, Lombok and Makassar straits are not in 2.4.2 and are named only in notes.

## Scale deviations (T)

Provinces outside their rank's development band, listed for tuning:

- none
