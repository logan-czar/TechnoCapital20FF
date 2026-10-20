# Middle East and North Africa province slice: summary (2026-10-20)

Batch 125 card (Logan): former hubs list scrapped; key cities hold perks and starting businesses; Metros only from the 5M+ rule. This slice has no `former_hub` column; each key city's province ids are listed below for [2-map-and-influence.md](../detailed/2-map-and-influence.md) 2.3.3.

_Generated from [provinces-mena.csv](provinces-mena.csv) (batch 127). Same columns and rules as the North America, Europe, Latin America, East Asia and Oceania and South Asia slices, including `contested` and `linked_cities` (batch 122). Population follows the spec formula from rough 2019 population estimates (A); Commerce and Industry are hand-set (T). Names are ASCII (A). Turkey is in the Europe slice and Sudan in Sub-Saharan Africa. Alternate history (19-history 19.22, 7-starting-world, 4-politics 4.2.4): no COVID and no 2008 crash; no 9/11, al-Qaeda broken after October 2000; Iraq a stable US ally with permanent US bases since the quick 2003 war (no insurgency, no sectarian war); no Arab Spring, no Syrian, Libyan or Yemeni war and no ISIS; every government is a US puppet or friend except Iran, the sanctioned holdout. So Mubarak-era Egypt, Gaddafi's Libya, Assad's Syria and the old Tunisian regime are in place, Aleppo, Mosul and Raqqa are intact, Syria and Libya are near pre-2011 size, there is no Zaatari camp in Jordan, and Yemen's Houthis were contained in 2015 by a US-backed government (A). Real events that still happened stay in notes: the Gaza wars, Hamas rule in Gaza since 2007, the 2017 Qatar blockade (ended by Washington within weeks), the September 2019 Abqaiq strike. Every value is in USD (batch 125)._

**Total:** 334 provinces in 19 countries (plan 325). Metros: 5 (17 provinces). World plan in countries.csv: 3239; with this slice's actual counts it would be 3248.

## Provinces per country

| Country | Name | Provinces | Plan | Regions | Areas | Metro provinces | Total development |
|---|---|---|---|---|---|---|---|
| SAU | Saudi Arabia | 37 | 37 | 13 | 16 | 3 | 854 |
| IRN | Iran | 37 | 34 | 31 | 31 | 3 | 1049 |
| EGY | Egypt | 34 | 31 | 27 | 27 | 8 | 990 |
| DZA | Algeria | 29 | 29 | 25 | 25 | 0 | 729 |
| IRQ | Iraq | 24 | 22 | 18 | 18 | 3 | 662 |
| LBY | Libya | 19 | 19 | 16 | 16 | 0 | 353 |
| MAR | Morocco | 20 | 19 | 12 | 12 | 0 | 548 |
| ARE | United Arab Emirates | 18 | 18 | 7 | 8 | 0 | 459 |
| ISR | Israel | 17 | 17 | 6 | 6 | 0 | 413 |
| YEM | Yemen | 16 | 15 | 15 | 15 | 0 | 381 |
| SYR | Syria | 14 | 14 | 14 | 14 | 0 | 362 |
| OMN | Oman | 13 | 13 | 11 | 11 | 0 | 240 |
| QAT | Qatar | 10 | 11 | 6 | 6 | 0 | 237 |
| TUN | Tunisia | 11 | 11 | 11 | 11 | 0 | 271 |
| JOR | Jordan | 10 | 10 | 9 | 9 | 0 | 232 |
| KWT | Kuwait | 10 | 10 | 6 | 6 | 0 | 231 |
| LBN | Lebanon | 8 | 8 | 8 | 8 | 0 | 157 |
| PSE | Palestine | 6 | 6 | 6 | 6 | 0 | 121 |
| BHR | Bahrain | 1 | 1 | 1 | 1 | 0 | 40 |
| **All** | | **334** | 325 | 242 | 246 | 17 | 8329 |

Counts that differ from the plan (all within +/-10%): IRN 37 (plan 34), EGY 34 (plan 31), IRQ 24 (plan 22), MAR 20 (plan 19), YEM 16 (plan 15), QAT 10 (plan 11).

Why (A): Iran (37) has 31 provinces (ostans) that each need a province, plus a 3-province Tehran Metro with a rural Tehran province, and second provinces in Khuzestan (oil and the Abadan refinery coast), Hormozgan (Bandar Abbas apart from the islands Abu Musa and the Tunbs) and Sistan and Baluchestan (Chabahar). Egypt (34) has 27 governorates, a 6-province Cairo Metro over three of them, a 2-province Alexandria Metro, and a separate Halaib province so that Sudan's claim does not flag Hurghada. Iraq (24) has 18 governorates (Halabja grouped with Sulaymaniyah) plus the Baghdad Metro and second provinces for Basra's oil fields, Nineveh and western Anbar. Yemen 16 and Morocco 20 (Western Sahara's two regions are inside Morocco's count; the plan's land area left them out). Qatar 10 has eight municipalities and no ninth place worth a province.

## Regions

Regions are the real first-level divisions: Saudi regions, UAE emirates, Qatari municipalities, Kuwaiti, Omani, Iraqi, Egyptian, Jordanian and Lebanese governorates, Israeli districts, Iranian provinces (ostans), Syrian governorates, Libyan districts (shabiyat), Tunisian governorates, Algerian provinces (wilayas) and Moroccan regions (the 2015 set of 12, including the two in Western Sahara). Where a country has fewer provinces than divisions, neighbouring divisions are grouped and the region name joins theirs (A): Yemen (22 governorates into 15 regions), Palestine (16 governorates into 6), Jordan (12 into 9), Libya (22 districts into 16), Tunisia (24 into 11), Algeria (48 into 25), and Qatar's Al Khor with Al Shamal and Al Daayen with Umm Salal. Israel's districts are Israel's own (the Golan sits in the Northern District, East Jerusalem in the Jerusalem District); the West Bank settlements are not Israeli provinces and sit in Palestinian province notes (A). Iraq's Kurdistan Region is three governorate regions, not one (A).

- **SAU:** Riyadh 7, Makkah 6, Eastern Province 7, Madinah 3, Asir 3, Qassim 2, Jazan 2, Tabuk 2, Hail 1, Najran 1, Al Jawf 1, Northern Borders 1, Al Bahah 1
- **IRN:** Tehran 4, Alborz 1, Qom 1, Markazi 1, Qazvin 1, Gilan 1, Mazandaran 1, Golestan 1, Semnan 1, Isfahan 1, Yazd 1, Kerman 1, Fars 1, Hormozgan 2, Bushehr 1, Khuzestan 2, Kohgiluyeh and Boyer-Ahmad 1, Chaharmahal and Bakhtiari 1, Lorestan 1, Ilam 1, Kermanshah 1, Kurdistan 1, Hamadan 1, Zanjan 1, Ardabil 1, East Azerbaijan 1, West Azerbaijan 1, North Khorasan 1, Razavi Khorasan 1, South Khorasan 1, Sistan and Baluchestan 2
- **EGY:** Cairo 3, Giza 3, Qalyubia 2, Alexandria 2, Beheira 1, Kafr el-Sheikh 1, Gharbia 1, Monufia 1, Dakahlia 1, Damietta 1, Sharqia 1, Port Said 1, Ismailia 1, Suez 1, Faiyum 1, Beni Suef 1, Minya 1, Asyut 1, Sohag 1, Qena 1, Luxor 1, Aswan 1, Red Sea 2, New Valley 1, Matrouh 1, North Sinai 1, South Sinai 1
- **DZA:** Algiers 3, Blida-Tipaza 1, Boumerdes-Tizi Ouzou 1, Bejaia-Bouira 1, Setif-Bordj Bou Arreridj 1, Constantine-Mila 1, Annaba-El Tarf-Guelma 1, Skikda-Jijel 1, Batna-Khenchela 1, Tebessa-Souk Ahras-Oum El Bouaghi 1, Biskra-El Oued 1, M'Sila 1, Oran 2, Mostaganem-Relizane 1, Tlemcen-Ain Temouchent 1, Sidi Bel Abbes-Mascara-Saida 1, Chlef-Ain Defla-Tissemsilt 1, Medea-Djelfa 1, Laghouat-Tiaret 1, Ouargla 2, Ghardaia 1, Illizi 1, Tamanrasset 1, Adrar 1, Bechar-Tindouf-Naama-El Bayadh 1
- **IRQ:** Baghdad 4, Basra 2, Nineveh 2, Erbil 1, Sulaymaniyah-Halabja 1, Duhok 1, Kirkuk 1, Anbar 2, Saladin 1, Diyala 1, Wasit 1, Babil 1, Karbala 1, Najaf 1, Al-Qadisiyyah 1, Muthanna 1, Dhi Qar 1, Maysan 1
- **LBY:** Tripoli 2, Jafara-Zawiya 1, Nuqat al-Khams 1, Jabal al-Gharbi-Nalut 1, Misrata 1, Murqub 1, Sirte 2, Al Wahat 2, Benghazi 1, Jabal al-Akhdar-Marj 1, Derna-Butnan 1, Kufra 1, Sabha 1, Wadi al-Shatii-Jufra 1, Murzuq-Wadi al-Hayaa 1, Ghat 1
- **MAR:** Casablanca-Settat 4, Rabat-Sale-Kenitra 2, Tanger-Tetouan-Al Hoceima 3, Oriental 1, Fes-Meknes 2, Marrakech-Safi 2, Beni Mellal-Khenifra 1, Souss-Massa 1, Draa-Tafilalet 1, Guelmim-Oued Noun 1, Laayoune-Sakia El Hamra 1, Dakhla-Oued Ed-Dahab 1
- **ARE:** Abu Dhabi 7, Dubai 4, Sharjah 3, Ajman 1, Umm al-Quwain 1, Ras al-Khaimah 1, Fujairah 1
- **ISR:** Jerusalem District 3, Tel Aviv District 3, Central District 4, Haifa District 2, Northern District 3, Southern District 2
- **YEM:** Amanat al-Asimah 1, Sanaa-Amran 1, Saada-Al Jawf 1, Hajjah-Al Mahwit 1, Al Hudaydah 1, Dhamar-Raymah 1, Ibb 1, Taiz 1, Aden 1, Lahij-Ad Dali 1, Abyan-Al Bayda 1, Marib 1, Shabwa 1, Hadramawt 2, Al Mahrah-Socotra 1
- **SYR:** Damascus 1, Rif Dimashq 1, Aleppo 1, Homs 1, Hama 1, Idlib 1, Latakia 1, Tartus 1, Deir ez-Zor 1, Raqqa 1, Al-Hasakah 1, Daraa 1, As-Suwayda 1, Quneitra 1
- **OMN:** Muscat 2, North Al Batinah 2, South Al Batinah 1, Ad Dakhiliyah 1, Adh Dhahirah 1, North Ash Sharqiyah 1, South Ash Sharqiyah 1, Al Wusta 1, Dhofar 1, Musandam 1, Al Buraimi 1
- **QAT:** Doha 3, Al Rayyan 2, Al Wakrah 2, Al Khor-Al Shamal 1, Al Daayen-Umm Salal 1, Al Shahaniya 1
- **TUN:** Tunis 1, Ariana-Ben Arous-Manouba 1, Bizerte 1, Nabeul-Zaghouan 1, Sousse-Monastir 1, Sfax 1, Mahdia-Kairouan 1, Gafsa-Tozeur-Kebili 1, Gabes-Medenine-Tataouine 1, Kasserine-Sidi Bouzid 1, Jendouba-Beja-Kef-Siliana 1
- **JOR:** Amman 2, Zarqa 1, Irbid 1, Jerash-Ajloun 1, Balqa-Madaba 1, Mafraq 1, Karak-Tafilah 1, Ma'an 1, Aqaba 1
- **KWT:** Al Asimah 2, Hawalli 1, Farwaniya 1, Mubarak Al-Kabeer 1, Ahmadi 3, Jahra 2
- **LBN:** Beirut 1, Mount Lebanon 1, North 1, Akkar 1, Bekaa 1, Baalbek-Hermel 1, South 1, Nabatieh 1
- **PSE:** Jenin-Tubas-Tulkarm-Qalqilya 1, Nablus-Salfit 1, Ramallah-Jericho 1, Bethlehem-Hebron 1, Gaza-North Gaza 1, Deir al-Balah-Khan Yunis-Rafah 1

## Metros (5)

Every city of 5M+ in the region (UN urban agglomeration estimates for 2020 (A)) is a Metro, and no other city is (batch 125). Commerce/Industry/Population shares are of the Metro's total development.

| Metro | Size | Pop (M) | Provinces (id, region, total) | Total dev | C/I/P | Key city |
|---|---|---|---|---|---|---|
| Cairo | Mega | 20.9 | Downtown Cairo-Zamalek (EG-0001, Cairo, 50), Heliopolis-New Cairo (EG-0002, Cairo, 40), Helwan-Maadi (EG-0003, Cairo, 40), Giza-Imbaba (EG-0004, Giza, 37), 6th of October-Sheikh Zayed (EG-0005, Giza, 38), Shubra el-Kheima (EG-0007, Qalyubia, 44) | 249 | 31%/29%/41% | yes (Cairo-Suez) |
| Tehran | L | 9.1 | North Tehran-Shemiran (IR-0001, Tehran, 44), Central Tehran-Grand Bazaar (IR-0002, Tehran, 42), West Tehran-Eslamshahr (IR-0003, Tehran, 42) | 128 | 38%/23%/39% | no |
| Riyadh | L | 7.2 | Riyadh Central-Olaya (SA-0001, Riyadh, 49), Riyadh North-Diriyah (SA-0002, Riyadh, 40), Riyadh South-Industrial Cities (SA-0003, Riyadh, 41) | 130 | 41%/22%/37% | yes |
| Baghdad | L | 7.1 | Karkh-Green Zone (IQ-0001, Baghdad, 44), Rusafa-Old Baghdad (IQ-0002, Baghdad, 38), Sadr City-New Baghdad (IQ-0003, Baghdad, 33) | 115 | 39%/19%/42% | no |
| Alexandria | L | 5.3 | Alexandria Centre-East (EG-0009, Alexandria, 45), Alexandria West-Borg el-Arab (EG-0010, Alexandria, 42) | 87 | 28%/34%/38% | no |

Shapes (A): Cairo crosses three governorates (Cairo, Giza and Qalyubia); rural south Giza (with the Bahariya iron mines) and rural Qalyubia are separate non-Metro provinces. Tehran's three provinces cover the city and its western satellites; Karaj (Alborz) is its own City province and rural Tehran province (Varamin, Damavand) is outside the Metro. Baghdad's rural belt is a separate province. Istanbul (Europe slice) and Khartoum (Sub-Saharan Africa) are not here. Cities just under 5M are single Metropolis provinces under the 3M+ rule: Jeddah (4.6M), Tel Aviv's Gush Dan (4.2M), Casablanca (3.75M), Aleppo (about 3.5M with no war (A)), Dubai (3.4M, the emirate), Mashhad (3.3M) and Kuwait City (3.1M). Their provinces differ in size from the city, so the Metropolis check uses the city's population (CITY_POP in the generator) (A). Dubai stays below the rule: the UN counts Dubai (2.9M) and Sharjah (1.7M) apart, and even the emirate's 3.4M is short of 5M (see the last section).

## Key cities (2-map 2.3.3)

Province ids for the Middle East and North Africa rows marked "slice pending" in 2.3.3, for Logan to copy into the doc.

| Key city | Province ids | Provinces | Specialty fit |
|---|---|---|---|
| Dubai | AE-0008 to AE-0011 | Downtown-DIFC, Deira-Bur Dubai, Jumeirah-Marina, Jebel Ali-Dubai South | re-export logistics and free zones at Jebel Ali-Dubai South (Jebel Ali port, JAFZA) and Deira-Bur Dubai (the Creek's dhow trade, grey trade with Iran); gold trading in the Deira souk and DMCC (Jumeirah-Marina); aviation at DXB (Deira-Bur Dubai) and Al Maktoum (Jebel Ali-Dubai South); real estate and finance in Downtown-DIFC, the only Metropolis province |
| Abu Dhabi | AE-0001, AE-0002, AE-0005, AE-0006 | Abu Dhabi Downtown, Masdar-Yas-Saadiyat, Ruwais-Al Dhafra, Liwa-Habshan | sovereign funds (ADIA, Mubadala) and ADNOC in Abu Dhabi Downtown; AI investment at Masdar (MBZUAI, G42); oil at Ruwais (the refinery) and Liwa-Habshan (the onshore fields) (A: the offshore Das-Zirku Islands are left out) |
| Riyadh | SA-0001 to SA-0003 | Riyadh Central-Olaya, Riyadh North-Diriyah, Riyadh South-Industrial Cities | the whole Metro: government, the royal court, PIF and Tadawul in Riyadh Central-Olaya; the Diriyah giga-project in Riyadh North-Diriyah; construction and industry in Riyadh South-Industrial Cities |
| Dhahran-Dammam | SA-0014 to SA-0016, SA-0018 | Dammam-Khobar-Dhahran, Jubail, Ras Tanura-Qatif, Abqaiq-Ghawar | Aramco headquarters in Dammam-Khobar-Dhahran; the largest fields at Abqaiq-Ghawar; petrochemicals and desalination at Jubail (Ras al-Khair); the Ras Tanura refinery and terminal |
| Doha | QA-0001 to QA-0003, QA-0008 | West Bay-Corniche, Msheireb-Old Doha, Doha Airport-Al Thumama, Ras Laffan-Al Khor | the sovereign fund (QIA) and the Al Jazeera network in West Bay-Corniche, plus the old centre and the airport; LNG at Ras Laffan-Al Khor, 60 km north (A) |
| Tel Aviv | IL-0004, IL-0005, IL-0007, IL-0010 | Tel Aviv-Yafo, Ramat Gan-Herzliya, Petah Tikva-Rosh HaAyin, Lod-Ramla-Modiin | venture capital, cyber firms and the exchange in Tel Aviv-Yafo; chip design and surveillance tech in Ramat Gan-Herzliya; tech parks in Petah Tikva-Rosh HaAyin; defense electronics at Israel Aerospace Industries (Lod-Ramla-Modiin) (A: Haifa's Intel, Elbit and Rafael plants are 90 km away and left out) |
| Cairo-Suez | EG-0001 to EG-0005, EG-0007, EG-0018 to EG-0020 | Downtown Cairo-Zamalek, Heliopolis-New Cairo, Helwan-Maadi, Giza-Imbaba, 6th of October-Sheikh Zayed, Shubra el-Kheima, Suez-Ain Sokhna, Ismailia-Canal, Port Said | the whole Cairo Metro (construction, textiles at Shubra el-Kheima, fertilizer and gas company offices) plus the canal provinces: canal revenue at Ismailia-Canal (the Suez Canal Authority), fertilizer, refineries and the SCZone at Suez-Ain Sokhna, gas at Port Said (the Zohr plant) |

Tehran, Baghdad and Alexandria are Metros but not key cities; 2.3.3 lists none of them. Jeddah, Kuwait City, Casablanca, Aleppo and Mashhad are Metropolis provinces but not key cities.

## Contested provinces (batch 123, batch 127 brief)

| Province | Owner | Contested | Dispute |
|---|---|---|---|
| Bandar Lengeh-Islands (IR-0018) | IRN | ARE claims | Abu Musa and the Greater and Lesser Tunbs, held by Iran since 1971, claimed by the UAE |
| Marsa Alam-Halaib (EG-0030) | EGY | SDN claims | The Halaib Triangle, administered by Egypt, claimed by Sudan |
| East Jerusalem (IL-0002) | ISR | PSE claims | East Jerusalem, annexed by Israel in 1980; Palestine claims it as its capital |
| Golan Heights (IL-0015) | ISR | SYR claims | The Golan Heights, taken from Syria in 1967 and annexed by Israel in 1981 |
| Jenin-Tulkarm (PS-0001) | PSE | ISR occupies | West Bank, under Israeli military occupation since 1967 (Areas A and B Palestinian-run, Area C Israeli) |
| Nablus-Salfit (PS-0002) | PSE | ISR occupies | West Bank, under Israeli military occupation since 1967 (Areas A and B Palestinian-run, Area C Israeli) |
| Ramallah-Jericho (PS-0003) | PSE | ISR occupies | West Bank, under Israeli military occupation since 1967 (Areas A and B Palestinian-run, Area C Israeli) |
| Hebron-Bethlehem (PS-0004) | PSE | ISR occupies | West Bank, under Israeli military occupation since 1967 (Areas A and B Palestinian-run, Area C Israeli) |
| Laayoune-Boujdour (MA-0019) | MAR | SADR claims | Western Sahara: held and administered by Morocco; the Polisario Front's Sahrawi Arab Democratic Republic (no country row) claims it |
| Dakhla (MA-0020) | MAR | SADR claims | Western Sahara: held and administered by Morocco; the Polisario Front's Sahrawi Arab Democratic Republic (no country row) claims it |

"SADR claims" and "ISR occupies" are the two values outside the usual "<ISO3> claims" form, as the brief asked. East Jerusalem is handled like the Golan (held and annexed by Israel, so an Israeli province with the claimant named) (A). The two Gaza provinces carry no flag: Israel left in 2005 and Hamas rules, under an Israeli and Egyptian blockade, which their notes describe (A). Not flagged, notes only (A): the Shebaa Farms (Lebanon's claim, on Golan Heights and Nabatieh), Ceuta and Melilla (Moroccan claims on Spanish cities, on Tetouan-Fnideq and Oujda-Nador), Bir Tawil (claimed by nobody, on Marsa Alam-Halaib), the Saudi-Kuwaiti Divided Zone (shared, its oil restarting under a December 2019 deal, on Hafar al-Batin-Khafji and Wafra-Khiran), Tiran and Sanafir (handed to Saudi Arabia in 2017), and Kirkuk and the other territories disputed between Baghdad and the Kurdistan Region (internal).

## Linked cities

None (A). The candidates have a clear core, so they are not linked cities: Dubai-Sharjah-Ajman (Dubai is the core; see the last section), Gush Dan (Tel Aviv), Rabat-Sale-Kenitra, and Dammam-Khobar-Dhahran (already one province).

## Top 15 provinces by total development

| Rank | Province | Country | Metro | C | I | P | Total |
|---|---|---|---|---|---|---|---|
| 1 | Aleppo | SYR | - | 14 | 20 | 19 | 53 |
| 2 | Downtown Cairo-Zamalek | EGY | Cairo | 28 | 5 | 17 | 50 |
| 3 | Riyadh Central-Olaya | SAU | Riyadh | 28 | 5 | 16 | 49 |
| 4 | Jeddah Al Balad-Port | SAU | - | 20 | 12 | 16 | 48 |
| 5 | Downtown-DIFC | ARE | - | 30 | 3 | 12 | 45 |
| 6 | Isfahan | IRN | - | 9 | 17 | 19 | 45 |
| 7 | Ahvaz-Oil Fields | IRN | - | 6 | 22 | 17 | 45 |
| 8 | Alexandria Centre-East | EGY | Alexandria | 18 | 10 | 17 | 45 |
| 9 | Casablanca Centre-Anfa | MAR | - | 26 | 5 | 14 | 45 |
| 10 | Karkh-Green Zone | IRQ | Baghdad | 24 | 4 | 16 | 44 |
| 11 | North Tehran-Shemiran | IRN | Tehran | 24 | 4 | 16 | 44 |
| 12 | Shubra el-Kheima | EGY | Cairo | 6 | 20 | 18 | 44 |
| 13 | Abu Dhabi Downtown | ARE | - | 26 | 4 | 12 | 42 |
| 14 | Rumaila-Majnoon | IRQ | - | 3 | 26 | 13 | 42 |
| 15 | Central Tehran-Grand Bazaar | IRN | Tehran | 16 | 8 | 18 | 42 |

## Resource tags

| Tag | Count | Provinces |
|---|---|---|
| None | 155 | |
| Farmland | 95 | |
| Oil | 38 | Ras Tanura-Qatif (SAU), Hafar al-Batin-Khafji (SAU), Abqaiq-Ghawar (SAU), Shaybah-Rub al Khali (SAU), Liwa-Habshan (ARE), Dukhan-Al Shahaniya (QAT), Burgan (KWT), Wafra-Khiran (KWT), Raudhatain-Bubiyan (KWT), Bahrain (BHR), Ibri-Fahud (OMN), Duqm (OMN), Salalah-Dhofar (OMN), Marib (YEM), Seiyun-Masila (YEM), Rumaila-Majnoon (IRQ), Erbil (IRQ), Kirkuk (IRQ), Kut-Wasit (IRQ), Nasiriyah-Dhi Qar (IRQ), Amarah-Maysan (IRQ), Ahvaz-Oil Fields (IRN), Yasuj-Gachsaran (IRN), Ilam (IRN), Suez-Ain Sokhna (EGY), Hurghada-Safaga (EGY), Marsa Matrouh-Western Desert (EGY), Sharm el-Sheikh-South Sinai (EGY), Deir ez-Zor (SYR), Hasakah-Qamishli (SYR), Ras Lanuf-Es Sider (LBY), Ajdabiya-Brega (LBY), Jalu-Sarir (LBY), Tobruk-Derna (LBY), Murzuq-Sharara (LBY), Gabes-Djerba (TUN), Hassi Messaoud (DZA), Ouargla-Touggourt (DZA) |
| Gas | 17 | Das-Zirku Islands (ARE), Ras Laffan-Al Khor (QAT), Sur-Qalhat (OMN), Shabwa-Balhaf (YEM), Sulaymaniyah-Halabja (IRQ), Western Anbar-Al Qaim (IRQ), Bushehr-Asaluyeh (IRN), Damietta (EGY), Port Said (EGY), Hadera-Caesarea (ISR), Homs-Palmyra (SYR), Zuwara-Mellitah (LBY), Skikda (DZA), Arzew-Bethioua (DZA), Laghouat-Hassi R'Mel (DZA), Illizi-In Amenas (DZA), Tamanrasset-In Salah (DZA) |
| Fishing | 14 | Qunfudhah-Lith (SAU), Umm al-Quwain (ARE), Musandam (OMN), Hodeidah (YEM), Mukalla-Hadramawt Coast (YEM), Al Mahrah-Socotra (YEM), Bandar Lengeh-Islands (IRN), Chabahar-Iranshahr (IRN), Gaza City (PSE), Sidon-Tyre (LBN), Safi-Essaouira (MAR), Agadir-Souss (MAR), Guelmim-Tan Tan (MAR), Dakhla (MAR) |
| Gold | 3 | Dawadmi-Quwayiyah (SAU), Al Ula-Khaybar (SAU), Marsa Alam-Halaib (EGY) |
| Iron ore | 3 | Yazd (IRN), Giza South-Bahariya (EGY), Tebessa-Ouenza (DZA) |
| Hydropower | 3 | Shahrekord (IRN), Aswan (EGY), Raqqa-Tabqa (SYR) |
| Copper | 2 | Kerman-Sarcheshmeh (IRN), Tabriz (IRN) |
| Timber | 1 | Sari-Babol (IRN) |
| Zinc | 1 | Zanjan (IRN) |
| Coal | 1 | Birjand-Tabas (IRN) |
| Silver | 1 | Ouarzazate-Errachidia (MAR) |

Phosphate (Morocco and Western Sahara's OCP mines, Tunisia's Gafsa, Jordan's Eshidiya, Algeria's Djebel Onk, Saudi Arabia's Wa'ad Al Shamal, Syria's Khneifis, Egypt's Abu Tartur), potash (the Dead Sea), uranium (Iran's small Saghand mine, under Iron ore in Yazd), aluminium smelters and salt have no tag and sit in notes (A). Refinery, LNG and petrochemical towns that do not sit on their own field are tagged None or Gas where the field comes ashore (A). Where a province has both oil and gas, the larger export sets the tag (Qatar's North Field and Iran's South Pars are Gas; Abu Dhabi's onshore fields are Oil) (A).

## Other counts

- City rank: Town 155, City 135, Metropolis 24, none 20
- Terrain: Desert 129, Mountain 70, Urban 65, Temperate 65, Wetland 3, Tropical 2
- Coastal: 151 (sea coasts, with the Caspian provinces of Iran counted as coastal (A); the Dead Sea and the Nile do not count)
- Chokepoint exposure: Strait of Hormuz 28, Bab-el-Mandeb 8, Suez Canal 8, Red Sea cable corridor 5, Strait of Gibraltar 2. Strait of Hormuz: the ports, terminals and plants inside the Gulf that ship through the strait (Kuwait, Basra, Iran's Gulf coast, Saudi Arabia's east coast, Bahrain, Qatar, the UAE west of the Musandam) and Musandam itself; Fujairah, Khor Fakkan and Oman's ports sit outside it. Bab-el-Mandeb: the Yemeni coast at the strait (Taiz-Mocha, Aden, Hodeidah) and the Red Sea ports whose Asia trade passes it (Jeddah, Jazan, Suez, Aqaba, Eilat). Suez Canal: the three canal provinces and the ports whose Europe trade uses the canal (Jeddah, Yanbu, Aqaba, Haifa, Ashdod). Strait of Gibraltar: Tangier-Tanger Med and Tetouan-Fnideq. Red Sea cable corridor: the Egyptian landings (Alexandria, Port Said, Suez), Jeddah and Aden (A).

## Scale deviations (T)

Provinces outside their rank's development band, listed for tuning:

- IR-0019 Bushehr-Asaluyeh (Town) total 37, band 8-30

Bushehr-Asaluyeh is kept as a Town (Bushehr city is about 0.25M) with Industry 20 for South Pars; the band, not the province, looks too tight for the world's largest gas field (T).

## Things that work differently in the Middle East and North Africa

- Dubai is a key city and the 2.25.2 example rides "the Dubai Metro", but by the 5M+ rule Dubai is not a Metro: the UN counts Dubai at 2.9M and Sharjah at 1.7M, and the emirate is 3.4M. Dubai is four provinces with one Metropolis core (Downtown-DIFC) whose property cycle is its own. Recommendation: either reword 2.25.2 to "the Dubai core province", or rule that Dubai-Sharjah-Ajman (about 5.3M, one built-up strip) counts as one city, which would make a 3-province L Metro (Downtown-DIFC, Deira-Bur Dubai, Sharjah City) with Ajman left outside (A).
- The Gulf states are tiny in people but rich in oil, so the biggest Industry values sit on near-empty field provinces (Ghawar, Burgan, Ras Laffan, Liwa-Habshan, Jalu-Sarir) that land in the rural or Town band only because Population is 1 to 7. Since batch 158 province weight is a flat $0.3B per development point and no longer reads the wealth index, which is now an equality index (the Gulf states score low for kafala labor) (A).
- Two new contested forms ("SADR claims", "ISR occupies") need the 2.3.1 contested rule to say what they do: SADR has no country row, so it cannot hold influence or press a claim in the POC, and "occupies" marks a holder rather than a claimant.
- Several holy cities (Mecca, Medina, Najaf, Karbala, Qom, Mashhad, Jerusalem) draw tens of millions of pilgrims; they are plain City provinces with notes. Mecca and Medina bar non-Muslims, which may matter for character travel (notes only) (A).
