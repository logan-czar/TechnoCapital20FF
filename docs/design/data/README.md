# Map data files

Data tables for the EU4-style map (batch 118). Batch 125 card (Logan): former hubs list scrapped; key cities hold perks and starting businesses; Metros only from the 5M+ rule. The `former_hub` column is dropped from every province file; key city province ids live in [2-map-and-influence.md](../detailed/2-map-and-influence.md) 2.3.3, and future slices (Russia and Central Asia, Middle East and North Africa, Sub-Saharan Africa, South Asia) use the same columns without it. Rules live in [../detailed/2-map-and-influence.md](../detailed/2-map-and-influence.md); the approved plan is [../reviews/map-rework-eu4-plan.md](../reviews/map-rework-eu4-plan.md). Values marked (A) are assumptions and (T) are tuning values.

## countries.csv

Batch 136 (Logan): the `government_type` column is replaced by `hss`, `legislature_strength`, `judiciary_strength` and `variant` (one US-based government system, 4-politics 4.2). One row per country or dependent territory: 197 sovereign states (the 193 UN members plus Taiwan, Kosovo, Palestine and Vatican City) and 9 territories (Cayman Islands, British Virgin Islands, Bermuda, Jersey, Guernsey, Hong Kong, Greenland, Puerto Rico, Saint Pierre and Miquelon). 206 rows, plus Gibraltar, the Isle of Man and the Faroes (batch 122) and Papa's Port (batch 124): 210 rows.

| Column | Meaning |
|---|---|
| iso3 | ISO 3166 alpha-3 code (Kosovo uses the user code XKX) |
| name | Country name |
| superregion | One of the 8 superregions: North America, Latin America, Europe, Russia and Central Asia, Middle East and North Africa, Sub-Saharan Africa, South Asia, East Asia and Oceania |
| currency | The country's real currency, as flavor only (names, news, history). Every simulated value is in USD; there is no FX in the POC (batch 125) |
| gdp_usd_bn | GDP in $ billions at the alternate January 2020 start. The 33 majors copy 2.2.3 exactly. Others: real 2019 values, eurozone and other euro users -20%, Greece a further -25% for its default, Puerto Rico +10% with the US; a few history cases set by hand (Syria, Libya, Venezuela, Afghanistan, Iran) and noted in the row (A) |
| population_m | Population in millions, real 2019 |
| wealth_index | WI (2.2.3 calls it the wage index). The 33 majors copy 2.2.3. Others use a fit over the majors: WI = 1.065 × (GDP per head / US GDP per head)^0.707, clamped 0.02 to 1.20 (T) |
| major | Y for the 33 former major countries |
| hss | Head of State Strength, 0 to 100 (4-politics 4.2.1, batch 136). The 33 majors, Hong Kong and Papa's Port copy 4.2.4. Others start from the old government type (liberal democracy 45, or 50 in Latin America and Sub-Saharan Africa; managed democracy 72; one-party state 90; ruling family 93; failed state 35) and some are set by hand from the 19.22 start world, noted "HSS set by hand from 19.22 (A)" (T) |
| legislature_strength | 0 to 100: `clamp(130 - 1.3 × hss + ΔL, 0, 100)`, with ΔL a per-country override of -15 to +15 (collapsed states -40) (T) |
| judiciary_strength | 0 to 100: `clamp(150 - 1.5 × hss + ΔJ, 0, 100)`, with ΔJ a per-country override of -15 to +15 (collapsed states -60) (T) |
| variant | Blank for the plain system, or the flavor variant that replaces one branch (4-politics 4.2.6). Exactly 10 rows at start: SAU Royal Court, PRK State Security, RUS Security Organs, IRN Guardian Council, CHN Party Standing Committee, ARE Federal Supreme Council, HKG Liaison Office, MMR Tatmadaw, CHE Federal Council, PAP Sovereign's Household. Somalia, South Sudan, Haiti and the Central African Republic start Collapsed (4.2.7), noted in notes |
| restriction_label | Open, Screened, Guarded, Restricted or Closed. Majors copy 2.2.4; others take the typical restriction of their old minor group (2.2.5), with overrides marked (A) in notes |
| subject_of | Debt vassalage overlord (4.11.8): Mali to USA; Pakistan and Sri Lanka to CHN |
| provinces_planned | Planned land provinces (T). Formula 0.45 × sqrt(land area, thousand km²) + 2 × sqrt(population M) + sqrt(GDP $bn), scaled so the world sums to 3,200, capped at one province per 300 km², minimum 1; microstates and small islands are 1; a few set by hand (Greenland 3, Iceland 3, Singapore 3, Hong Kong 3, Luxembourg 1, Malta 1) |
| notes | Old minor group (with (A) when the country was not named in that group), sovereign of a territory, resources, and which fields are assumed |

Hong Kong is a separate row (SAR) because the docs give it its own currency and laws (2.3.3); China's major-country GDP and population still include it, so do not sum the two.

## provinces-north-america.csv

Being built by another worker: the North America test slice of the province list (United States, Canada, Mexico, Greenland, Bermuda, Saint Pierre and Miquelon). Columns, from the batch 118 spec:

id, name, country, region, area, metro, city_rank, commerce, industry, population, resource, terrain, coastal, chokepoint_exposure, notes

- region: a real first-level division (state, province, territory). area: 3 to 6 neighbouring provinces inside one region. metro: blank if none.
- city_rank: Metropolis, City, Town or none. commerce, industry, population: development tracks, integers 1 to 30.
- resource: Oil, Gas, Coal, Copper, Lithium, Cobalt, Nickel, Rare earths, Iron ore, Gold, Uranium, Timber, Farmland, Fishing, Hydropower or None.
- terrain: Urban, Temperate, Desert, Arctic, Tropical, Mountain or Wetland. coastal: Y or N.

The exact column spelling is set by that worker's file; check its header.

## provinces-europe.csv

The Europe slice (batch 121 follow-up, 2026-10-19): 679 provinces in 51 countries, same columns and rules as provinces-north-america.csv. Ids use ISO alpha-2 prefixes. Russian-held Crimea and Donbas rows have country RUS, keep UA ids and count in Ukraine's budget. 13 Metros (London, Paris, Rhine-Ruhr, Madrid, Barcelona, Milan, Berlin, Hamburg, Munich, Frankfurt, Stuttgart, Istanbul, Ankara). Summary: provinces-europe-summary.md. Gibraltar (GIB), the Isle of Man (IMN) and the Faroes (FRO) have their own country rows (batch 122); France's overseas regions stay inside France (A). Batch 122 added two columns to both province files: `contested` (blank, or who disputes the province, e.g. "UKR claims") and `linked_cities` (a group of separate cities that work as one economy without being a Metro; only Randstad so far).

## provinces-latin-america.csv

The Latin America slice (batch 123, 2026-10-19): 391 provinces in 35 countries and territories, same columns and rules as the Europe file. 7 Metros: São Paulo (4), Rio de Janeiro (4), Buenos Aires (4), Lima (3), Bogotá (3), Santiago (2), Belo Horizonte (2). Contested: the Essequibo (VEN claims), Berbice-Linden (SUR claims) and southern Belize (GTM claims). Where a country has fewer provinces than first-level divisions, neighbouring divisions share one region (A). Papa's Port (PP-0001, country PAP, batch 124) is the Falklands micronation under Argentina, added after the build, so the slice now has 392 rows. Papa's Port's flavor currency is USD. Summary: provinces-latin-america-summary.md.

## provinces-east-asia-oceania.csv

The East Asia and Oceania slice (batch 124, 2026-10-19): 606 provinces in 32 countries and territories, same columns and rules. 34 Metros covering 114 provinces (17 key cities, 17 other 5M+ cities, mostly Chinese). Contested: every Taiwan province (CHN claims) and Sabah (PHL claims). Macau is a region inside China (no country row) (A). Chinese provinces are much larger than their cities, so city rank used a city population table in the generator, not province population. Summary: provinces-east-asia-oceania-summary.md.

## provinces-south-asia.csv

The South Asia slice (batch 126, 2026-10-20): 208 provinces in 8 countries, same columns (no former_hub). 13 Metros (39 provinces): Delhi NCR, Mumbai, Dhaka, Karachi, Kolkata, Lahore, Bengaluru, Chennai, Hyderabad, Ahmedabad, Surat, Pune, Chittagong. Contested: Indian Kashmir and Ladakh (PAK claims), Gilgit-Baltistan and Azad Kashmir (IND claims), Arunachal Pradesh (CHN claims). Linked cities: Islamabad-Rawalpindi. Rural Indian provinces are very populous (Population track 27 to 28). Summary: provinces-south-asia-summary.md.

## The last three slices (batch 127, 2026-10-20)

- provinces-mena.csv: 334 provinces in 19 countries, 5 Metros (Cairo 6, Tehran, Riyadh, Baghdad, Alexandria). Contested: Western Sahara (SADR claims), Golan (SYR claims), East Jerusalem (PSE claims), West Bank (ISR occupies), Halaib (SDN claims), Iranian Gulf islands (ARE claims).
- provinces-russia-central-asia.csv: 171 provinces in 9 countries, 2 Metros (Moscow 5, St Petersburg 3). Crimea and the Donbas stay in the Europe file. Contested: Kurils (JPN claims), Abkhazia and South Ossetia (RUS-backed breakaway), Nagorno-Karabakh (ARM-backed Artsakh).
- provinces-sub-saharan-africa.csv: 608 provinces in 49 countries, 7 Metros (Lagos, Kinshasa, Johannesburg, Luanda, Dar es Salaam, Khartoum, Abidjan). Contested: Somaliland, Abyei. Linked cities: Zambian Copperbelt, Accra-Tema.
- Greenland, Bermuda and Saint Pierre and Miquelon (5 rows) were added to provinces-north-america.csv, which now has 260 rows.

The world map is complete: 3,258 provinces, matching countries.csv provinces_planned.

## Batch 128 (2026-10-20)

- Dubai, Sharjah and Ajman are one city: the Dubai Metro of 3 provinces (AE-0008 Dubai Core, AE-0010 Dubai Marina-Jebel Ali, AE-0012 Sharjah-Ajman). AE-0009, AE-0011 and AE-0015 were merged into them, so the MENA file has 331 rows and the world 3,255.
- New resource tags Platinum and Diamonds; 15 provinces retagged (Rustenburg, the Great Dyke, Jwaneng, Orapa, Catoca, Mirny, the Northwest Territories, Kimberley and others).
- Russian areas now follow the federal districts, split into 14 areas.
- Djibouti and Zambia are Chinese debt vassals (countries.csv subject_of CHN).

## characters.csv and companies.csv (batch 136, 2026-10-20)

The starting characters and companies (Logan, batch 136; rules in [7-starting-world.md](../detailed/7-starting-world.md) 7.3.6, 7.4 and 7.11). Built by a reproducible Python generator (fixed seed) from hand-written rows plus name parts; all names are made up. Values marked (A) in notes are assumptions; sizes, stakes and counts are tuning values (T).

### characters.csv

296 rows: John Techno, 95 rivals (Terry, the 14 of 7.3.1 to 7.3.3 and the 80 of 7.3.6, 10 per superregion) and 200 minor holders.

| Column | Meaning |
|---|---|
| id | CH-0001 on. John is CH-0001, rivals CH-0002 to CH-0096, holders CH-0097 on |
| name | Full name. Chinese, Korean and Vietnamese names put the family name first |
| tier | player, rival or holder |
| profile | Rich, Connected or Talented (7.3) for rivals and the draft characters; blank for other holders |
| superregion | The superregion of the character's country (countries.csv) |
| region_group | The old 7.3 rival groups: 1 the Americas, 2 Europe, Russia and Central Asia, the Middle East and Africa, 3 Asia and Oceania |
| country | iso3 of the origin province's country |
| origin_province | Province id from the province files (Origin city, 7.5) |
| location | Where the character lives at start (city or province name) |
| age | At 1 January 2020 |
| money_type | old, tech, state-linked or criminal (7.4 mix); blank for John |
| finance, operations, persuasion, intrigue, tech, hustle | The six skills, 0 to 30 (1.1.1). John is 24 in all; nobody else reaches 24 |
| traits | Three traits from the 12 pairs (1.1.2), semicolon list; John has only Operational Excellence |
| ideology | One of the nine (5-ideology); blank for John |
| cash_usd | Liquid cash at start |
| net_worth_est_usd | Cash plus the est. value of the stakes the character holds on the books (a figurehead's stakes count for the figurehead; trust and foundation stakes count for nobody) |
| hook | One line on who they are |
| notes | Sources and assumptions; figureheads name the rival they front for |

### companies.csv

651 rows in the 42 industries (10-industry-economy 10.3), 11 to 20 per industry.

| Column | Meaning |
|---|---|
| id | CO-0001 on. Arrowhead Drilling is CO-0001 |
| name | Company name |
| ticker | 3 or 4 letters for listed companies, unique; blank if private |
| industry | One of the 42; the industry of its main business unit |
| hq_country, hq_province | iso3 and the province id of the headquarters (base province, 10.0.2) |
| public | Y if listed |
| revenue_usd_m | Yearly revenue in $ millions at January 2020 |
| book_value_usd_m | Book equity in $ millions |
| est_value_usd_m | Fair value estimate: 0.3 × book + 0.7 × revenue × margin × 0.75 × sector multiple (10.0.8) (T); Arrowhead is set to $100M |
| controller | Who controls it: a character id (the real controller), a country iso3 (state firm), a company id (a subsidiary's parent) or blank (widely held) |
| controller_stake_pct | The controlling stake. For proxy it is the figurehead's stake on the books; for trust it is the trust's or foundation's |
| control_basis | majority (over 50%), class_a (10-vote A shares give a majority of votes, 1.2), proxy (a figurehead holds the stake, 1.3.1), trust (a trust or foundation the controller runs), state, subsidiary or widely_held |
| owner_of_record | For proxy rows, the figurehead's character id (the public owner of record) |
| other_holders | Other stakes, semicolon list of id:pct; ids are characters, companies (funds) or countries |
| notes | Canon links and assumptions |

