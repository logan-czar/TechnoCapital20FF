# Russia and Central Asia province slice: summary (2026-10-20)

Batch 125 card (Logan): former hubs list scrapped; key cities hold perks and starting businesses; Metros only from the 5M+ rule. This slice has no `former_hub` column; each key city's province ids are listed below for [2-map-and-influence.md](../detailed/2-map-and-influence.md) 2.3.3.

_Generated from [provinces-russia-central-asia.csv](provinces-russia-central-asia.csv) (batch 127). Same columns and rules as the North America, Europe, Latin America, East Asia and Oceania and South Asia slices, including `contested` and `linked_cities` (batch 122). Population follows the spec formula from rough 2019 population estimates (A); Commerce and Industry are hand-set (T). Names are ASCII (A). Resource tags include Bauxite, Silver, Zinc and Tin (batch 124). Alternate history (19-history, 7-starting-world 7.2.0): no COVID and no 2008 crash; Russia invaded Ukraine in 2005, holds Crimea and the Donbas, has lived under sanctions for 15 years and fights a drone stalemate restarted in 2016; pipeline gas to Europe is cut and oil goes out at a discount through grey fleets. So notes name no Western car plants or oil majors inside Russia after 2005 (Chinese, Korean and Indian partners instead) (A). Russia took South Ossetia and Abkhazia in the 2008 war. Currencies are flavor only; every value is in USD (batch 125)._

**Total:** 171 provinces in 9 countries (plan 168). Metros: 2 (8 provinces). World plan in countries.csv: 3239; with this slice's actual counts it would be 3242.

**Crimea and the Donbas** (UA-0019 to UA-0022, country RUS) stay in [provinces-europe.csv](provinces-europe.csv) with Ukrainian ids and Ukraine's budget (batch 123); they are not repeated here and not counted in Russia's 74. A Russia-wide total therefore needs both files.

## Provinces per country

| Country | Name | Provinces | Plan | Regions | Areas | Metro provinces | Population (M, rows) | Total development |
|---|---|---|---|---|---|---|---|---|
| RUS | Russia | 74 | 70 | 58 | 58 | 8 | 144.4 | 2247 |
| KAZ | Kazakhstan | 26 | 27 | 17 | 17 | 0 | 18.6 | 607 |
| UZB | Uzbekistan | 17 | 17 | 13 | 13 | 0 | 33.7 | 441 |
| TKM | Turkmenistan | 13 | 13 | 6 | 6 | 0 | 6.3 | 224 |
| AZE | Azerbaijan | 10 | 10 | 9 | 9 | 0 | 9.9 | 193 |
| KGZ | Kyrgyzstan | 9 | 9 | 8 | 8 | 0 | 6.4 | 164 |
| TJK | Tajikistan | 9 | 9 | 5 | 5 | 0 | 9.1 | 187 |
| GEO | Georgia | 7 | 7 | 6 | 6 | 0 | 4.0 | 118 |
| ARM | Armenia | 6 | 6 | 6 | 6 | 0 | 3.0 | 106 |
| **All** | | **171** | 168 | 128 | 128 | 8 | 235.5 | 4287 |

Counts that differ from the plan (all within +/-10%): RUS 74 (plan 70), KAZ 26 (plan 27).

Russia uses 74 (plan 70): the two Metros take 8 provinces, and Russia has 83 federal subjects outside Crimea and Sevastopol, so most provinces are one subject or two to three neighbouring subjects; the extra four keep the big resource provinces apart (Norilsk, Yamal, the two Khanty-Mansi oil provinces, Mirny-Lena). Kazakhstan uses 26 (plan 27). Georgia's 7 include Abkhazia and South Ossetia, and Azerbaijan's 10 include Nagorno-Karabakh, so their row populations run above the official figures in countries.csv, which leave the breakaway areas out (A). Turkmenistan's official 6.0M is doubtful; the rows sum to about 6.3M (A).

## Regions

Regions are the real first-level divisions: Russian federal subjects, Kazakh regions and cities of republican significance, Uzbek regions plus Karakalpakstan and Tashkent city, Turkmen velayats plus Ashgabat, Kyrgyz regions plus Bishkek, Tajik regions plus Dushanbe and the Districts of Republican Subordination, Georgian regions and autonomous republics, Armenian provinces plus Yerevan. Where a country has fewer provinces than divisions, neighbouring divisions are grouped and the region name joins theirs (A): in Russia 83 subjects become 58 regions (for example Tula-Kaluga, Komi-Nenets, Khabarovsk-Jewish Autonomous Oblast, and North Ossetia-Kabardino-Balkaria-Karachay-Cherkessia for the Central Caucasus province); Osh city goes with Osh Region; Georgia's and Armenia's small regions pair up. Azerbaijan's first-level units are 66 districts and 11 cities, so its regions are the 2020 economic regions (Mountainous Shirvan joined to Absheron, Upper Karabakh with Kalbajar-Lachin) (A). South Ossetia was never a Georgian region of its own; it sits in the Shida Kartli group (A). Most Russian regions hold one or two provinces and so are their own area; the EU4 area of 3 to 6 provinces only appears in Moscow, St Petersburg, Krasnoyarsk, Karaganda, Balkan, Mary and Sughd (A). A default area that shares its name with a region elsewhere gets the country name in brackets.

- **RUS:** Moscow 4, Moscow Oblast 2, Tver-Smolensk 1, Yaroslavl-Ivanovo-Kostroma 1, Vladimir-Ryazan 1, Tula-Kaluga 1, Bryansk-Oryol 1, Kursk-Belgorod 1, Lipetsk-Tambov 1, Voronezh 1, St Petersburg 3, Leningrad Oblast 1, Kaliningrad 1, Novgorod-Pskov 1, Karelia-Murmansk 1, Arkhangelsk 1, Komi-Nenets 1, Vologda 1, Krasnodar-Adygea 2, Rostov 1, Volgograd 1, Astrakhan-Kalmykia 1, Stavropol 1, Dagestan 1, Chechnya-Ingushetia 1, North Ossetia-Kabardino-Balkaria-Karachay-Cherkessia 1, Nizhny Novgorod 1, Tatarstan 2, Bashkortostan 1, Samara 2, Perm 1, Udmurtia-Kirov 1, Chuvashia-Mari El-Mordovia 1, Ulyanovsk-Penza 1, Saratov 1, Orenburg 1, Sverdlovsk 2, Chelyabinsk 1, Tyumen-Kurgan 1, Khanty-Mansi 2, Yamalo-Nenets 1, Novosibirsk 1, Omsk 1, Tomsk 1, Kemerovo 1, Altai Krai-Altai Republic 1, Krasnoyarsk 3, Khakassia-Tuva 1, Irkutsk 2, Primorsky 1, Khabarovsk-Jewish Autonomous Oblast 1, Amur 1, Sakhalin 2, Kamchatka 1, Magadan-Chukotka 1, Sakha 2, Buryatia 1, Zabaykalsky 1
- **KAZ:** Nur-Sultan 1, Almaty 1, Shymkent 1, Almaty Region 2, Turkistan 2, Zhambyl 1, Kyzylorda 2, Aktobe 2, Atyrau 2, Mangystau 2, West Kazakhstan 1, Karaganda 3, East Kazakhstan 2, Pavlodar 1, Kostanay 1, North Kazakhstan 1, Akmola 1
- **UZB:** Tashkent 1, Tashkent Region 2, Samarkand 2, Fergana 1, Andijan 1, Namangan 1, Bukhara 1, Navoi 1, Kashkadarya 2, Surkhandarya 1, Jizzakh-Sirdaryo 1, Khorezm 1, Karakalpakstan 2
- **TKM:** Ashgabat 1, Ahal 2, Balkan 3, Dashoguz 2, Lebap 2, Mary 3
- **AZE:** Baku 1, Absheron-Mountainous Shirvan 1, Ganja-Gazakh 1, Shaki-Zagatala 1, Guba-Khachmaz 1, Aran 2, Lankaran 1, Nakhchivan 1, Upper Karabakh-Kalbajar-Lachin 1
- **KGZ:** Bishkek 1, Chuy 1, Issyk-Kul 1, Naryn 1, Talas 1, Jalal-Abad 1, Osh 2, Batken 1
- **TJK:** Dushanbe 1, Districts of Republican Subordination 2, Sughd 3, Khatlon 2, Gorno-Badakhshan 1
- **GEO:** Tbilisi 1, Adjara-Guria 1, Abkhazia 1, Imereti-Samegrelo-Racha 1, Kvemo Kartli-Kakheti 1, Shida Kartli-Mtskheta-Mtianeti-Samtskhe-Javakheti 2
- **ARM:** Yerevan 1, Ararat-Armavir 1, Kotayk-Gegharkunik 1, Shirak-Aragatsotn 1, Lori-Tavush 1, Syunik-Vayots Dzor 1

## Metros (2)

Moscow and St Petersburg are the only cities in the superregion above 5M (UN urban agglomeration estimates for 2020 (A)); the next largest are Tashkent (2.6M), Baku (2.3M), Almaty (1.9M) and Novosibirsk (1.6M), all single City provinces (batch 125). Commerce/Industry/Population shares are of the Metro's total development.

| Metro | Size | Pop (M) | Provinces (id, region, total) | Total dev | C/I/P | Key city |
|---|---|---|---|---|---|---|
| Moscow | XL | 12.5 | Moscow Center-Moscow City (RU-0001, Moscow, 47), Moscow South-West (RU-0002, Moscow, 41), Moscow North (RU-0003, Moscow, 38), Moscow East-South-East (RU-0004, Moscow, 40), Moscow Inner Suburbs (RU-0005, Moscow Oblast, 42) | 208 | 34%/25%/41% | yes |
| St Petersburg | L | 5.5 | St Petersburg Center-Vasilievsky (RU-0015, St Petersburg, 39), St Petersburg South-Port (RU-0016, St Petersburg, 40), St Petersburg North-Lakhta (RU-0017, St Petersburg, 33) | 112 | 31%/30%/38% | yes |

Shapes (A): Moscow is XL on the UN figure (12.5M, the city proper); its four city provinces hold the whole of Moscow city (12.6M) and the fifth, Moscow Inner Suburbs, takes the first ring of Moscow Oblast towns (Khimki, Korolev, Mytishchi, Balashikha, Lyubertsy, Podolsk, Krasnogorsk, Odintsovo), so the Metro holds about 16.6M, close to the real built-up area (about 17M). The rest of Moscow Oblast (3.7M) is one non-Metro Town province. St Petersburg (5.5M) is L with 3 provinces; Leningrad Oblast stays outside the Metro but is part of the key city for its ports.

## Key cities (2-map 2.3.3)

Province ids for the rows marked "slice pending" in 2.3.3, for Logan to copy into the doc.

| Key city | Province ids | Provinces | Specialty fit |
|---|---|---|---|
| Moscow | RU-0001 to RU-0005 | Moscow Center-Moscow City, Moscow South-West, Moscow North, Moscow East-South-East, Moscow Inner Suburbs | energy company headquarters (Rosneft and Lukoil in Moscow Center, Gazprom in Moscow South-West), metals (Nornickel's head office in Moscow Center), oil trading (grey-fleet desks in Moscow Center), defense (MiG and Sukhoi in Moscow North, Khrunichev in South-West, Lavochkin, Energia and Mashinostroyeniya in Inner Suburbs), cybercrime underground (Moscow North) (A). No outside province is added: every specialty sits inside the Metro |
| St Petersburg | RU-0015 to RU-0018 | St Petersburg Center-Vasilievsky, St Petersburg South-Port, St Petersburg North-Lakhta, Leningrad Oblast | shipbuilding (Admiralty and Baltic Shipyards in Center-Vasilievsky, Severnaya Verf in South-Port), Baltic port (Big Port St Petersburg in South-Port plus Ust-Luga and Primorsk in Leningrad Oblast, added as the nearby province holding the core port industry), gas company headquarters (Gazprom and Gazprom Neft at Lakhta Center in North-Lakhta) |

No other city in the superregion is a key city in 2.3.3 (Tashkent, Almaty, Baku and the rest are not listed).

## Contested provinces (batch 123)

| Province | Owner | Contested | Dispute |
|---|---|---|---|
| Kuril Islands (RU-0068) | RUS | JPN claims | Japan claims the southern Kurils (Iturup, Kunashir, Shikotan, Habomai) as its Northern Territories; no peace treaty since 1945 |
| Abkhazia (GE-0003) | GEO | RUS-backed breakaway | run by a Russian-backed breakaway government, recognized by Russia since the 2008 war; Georgia and the world count it as Georgian |
| South Ossetia (GE-0007) | GEO | RUS-backed breakaway | run by a Russian-backed breakaway government, recognized by Russia since the 2008 war; Georgia and the world count it as Georgian |
| Nagorno-Karabakh (AZ-0010) | AZE | ARM-backed Artsakh | run by the Armenian-backed Artsakh Republic since the 1994 ceasefire; Azerbaijan and the world count it as Azerbaijani |

The values follow the batch 127 brief rather than the "<ISO3> claims" pattern, as Transnistria ("Transnistria, RUS-backed") already does in the Europe slice. The Kuril Islands province holds only the four disputed southern islands; the northern Kurils sit in Sakhalin (A). Nagorno-Karabakh also holds the seven surrounding Azerbaijani districts that Artsakh held in January 2020 (A). Not flagged, notes only (A): the Russia-Estonia border treaty left unratified (Novgorod-Pskov), the 2018 Chechen-Ingush border swap (Chechnya-Ingushetia), the Fergana Valley exclaves and border clashes (Fergana, Batken, Istaravshan-Isfara), the 2011 Tajik land transfer to China (Gorno-Badakhshan). The Caspian's legal status was settled by the 2018 convention.

## Linked cities

None (A). Clusters considered and left out: Samara-Tolyatti (an official agglomeration of about 2.7M, but 70 km apart across the Zhiguli hills, each with its own core), Moscow and its oblast towns (already one Metro), and Tashkent with Chirchiq and Almalyk (commuter belt, not one economy).

## Top 15 provinces by total development

| Rank | Province | Country | Metro | C | I | P | Total |
|---|---|---|---|---|---|---|---|
| 1 | Moscow Center-Moscow City | RUS | Moscow | 28 | 4 | 15 | 47 |
| 2 | Chelyabinsk | RUS | - | 7 | 20 | 17 | 44 |
| 3 | Baku | AZE | - | 15 | 12 | 16 | 43 |
| 4 | Moscow Inner Suburbs | RUS | Moscow | 8 | 16 | 18 | 42 |
| 5 | Moscow South-West | RUS | Moscow | 16 | 7 | 18 | 41 |
| 6 | Moscow East-South-East | RUS | Moscow | 8 | 14 | 18 | 40 |
| 7 | St Petersburg South-Port | RUS | St Petersburg | 7 | 18 | 15 | 40 |
| 8 | Bashkortostan | RUS | - | 6 | 16 | 18 | 40 |
| 9 | Yekaterinburg | RUS | - | 12 | 12 | 16 | 40 |
| 10 | Kuzbass | RUS | - | 4 | 20 | 16 | 40 |
| 11 | St Petersburg Center-Vasilievsky | RUS | St Petersburg | 16 | 9 | 14 | 39 |
| 12 | Nizhny Novgorod | RUS | - | 8 | 14 | 17 | 39 |
| 13 | Moscow North | RUS | Moscow | 10 | 11 | 17 | 38 |
| 14 | Tashkent | UZB | - | 14 | 8 | 16 | 38 |
| 15 | Almetyevsk-Naberezhnye Chelny | RUS | - | 4 | 18 | 15 | 37 |

## Resource tags

| Tag | Count | Provinces |
|---|---|---|
| None | 58 | |
| Farmland | 38 | |
| Oil | 15 | Komi-Nenets (RUS), Almetyevsk-Naberezhnye Chelny (RUS), Bashkortostan (RUS), Tolyatti-Syzran (RUS), Perm (RUS), Izhevsk-Kirov (RUS), Surgut-Khanty-Mansiysk (RUS), Nizhnevartovsk-Samotlor (RUS), Tomsk (RUS), Kyzylorda-Kumkol (KAZ), Khromtau-Zhanazhol (KAZ), Tengiz-Kashagan (KAZ), Zhanaozen-Uzen (KAZ), Balkanabat-Cheleken (TKM), Baku (AZE) |
| Gas | 11 | Astrakhan-Kalmykia (RUS), Orenburg (RUS), Yamal (RUS), Sakhalin (RUS), Mirny-Lena (RUS), Uralsk-Karachaganak (KAZ), Bukhara (UZB), Karshi-Shurtan (UZB), Kungrad-Muynak (UZB), Bagtyyarlyk-Koytendag (TKM), Galkynysh-Yoloten (TKM) |
| Gold | 11 | Angara-Evenkia (RUS), Amur (RUS), Magadan-Chukotka (RUS), Kokshetau-Akmola (KAZ), Navoi-Zarafshan (UZB), Issyk-Kul (KGZ), Talas (KGZ), Panjakent-Zeravshan (TJK), Kotayk-Gegharkunik (ARM), Ganja-Gazakh (AZE), Nagorno-Karabakh (AZE) |
| Hydropower | 9 | Volgograd (RUS), Krasnoyarsk (RUS), Khakassia-Tuva (RUS), Bratsk-Ust-Kut (RUS), Jalal-Abad (KGZ), Rasht-Rogun (TJK), Kulob-Nurek (TJK), Kutaisi-Poti (GEO), Mingachevir-Shirvan (AZE) |
| Copper | 8 | Chelyabinsk (RUS), Zhezkazgan-Ulytau (KAZ), Balkhash-Karkaraly (KAZ), Semey-Aktogay (KAZ), Almalyk-Angren (UZB), Rustavi-Kakheti (GEO), Lori-Tavush (ARM), Syunik-Vayots Dzor (ARM) |
| Timber | 6 | Tver-Smolensk (RUS), Novgorod-Pskov (RUS), Arkhangelsk (RUS), Vologda (RUS), Khabarovsk (RUS), Buryatia (RUS) |
| Coal | 4 | Kuzbass (RUS), Yakutsk-Aldan (RUS), Karaganda-Temirtau (KAZ), Pavlodar-Ekibastuz (KAZ) |
| Iron ore | 3 | Kursk-Belgorod (RUS), Nizhny Tagil-North Urals (RUS), Kostanay-Rudny (KAZ) |
| Fishing | 3 | Vladivostok-Nakhodka (RUS), Kuril Islands (RUS), Kamchatka (RUS) |
| Nickel | 2 | Murmansk-Karelia (RUS), Norilsk-Taimyr (RUS) |
| Uranium | 2 | Zabaykalsky (RUS), Turkistan-Kentau (KAZ) |
| Zinc | 1 | Ust-Kamenogorsk (KAZ) |

No tag, notes only (A): diamonds (ALROSA's Mirny-Lena, Arkhangelsk's Lomonosov pipe), potash (Uralkali in Perm), chromite (Khromtau), manganese (Chiatura), phosphate (Karatau), apatite (Kola), platinum metals (Norilsk, under Nickel), titanium (Verkhnyaya Salda, Oskemen), helium (Orenburg, Amur). Sakhalin is tagged Gas (Sakhalin-2 LNG), with its oil in notes; refinery cities that sit on no field (Omsk, Kirishi, Moscow) are tagged None. Kazakhstan's uranium tag sits on the Sozak mines (Turkistan-Kentau); Uzbekistan's on Navoi-Zarafshan is Gold, its uranium in notes.

## Other counts

- City rank: Town 98, City 45, none 20, Metropolis 8. City means the province's largest city has 0.5M to 3M people (CITY_POP in the generator); Karaganda (about 0.5M) is held a Town (A).
- Terrain: Temperate 85, Desert 33, Mountain 27, Urban 17, Arctic 7, Wetland 2
- Coastal: 37. Caspian shores count as coastal (A): it carries the oil, ferry and Middle Corridor trade of Aktau, Baku, Turkmenbashi, Astrakhan and Makhachkala. The Aral Sea and Lake Baikal do not count.
- Chokepoint exposure: Turkish Straits 7, Danish Straits 5. Danish Straits: the three St Petersburg provinces, Leningrad Oblast (Ust-Luga, Primorsk) and Kaliningrad. Turkish Straits: Russia's Black Sea and Azov ports (Novorossiysk-Sochi, Krasnodar-Kuban, Rostov), Georgia's ports (Batumi-Adjara, Kutaisi-Poti, Abkhazia) and Tengiz-Kashagan, whose crude leaves by the CPC pipeline to Novorossiysk (A). Arctic and Pacific ports have no 2.4.2 chokepoint. The Kerch Strait is not a 2.4.2 chokepoint, so it is not used here (A).

## Scale deviations (T)

Provinces outside their rank's development band, listed for tuning:

- none

## Things that work differently in Russia and Central Asia

- Russia's wealth sits in thinly peopled resource provinces (Yamal, Norilsk-Taimyr, Khanty-Mansi, Tengiz-Kashagan), but development is capped by the Town band (8 to 30), so they read small on the total-development map even though they produce most of the region's exports. Recommendation: let resource output feed province weight directly, or allow Industry above the band in single-resource provinces (T).
- Sanctions since 2005 have no province flag; the grey-fleet export ports (Kozmino, Primorsk, Ust-Luga, Novorossiysk) carry them in notes only (A).
- Most Russian regions are a single province, so the area level (3 to 6 provinces) barely exists in Russia; if area perks matter, a Russia-only area layer by federal district could be added (A).
