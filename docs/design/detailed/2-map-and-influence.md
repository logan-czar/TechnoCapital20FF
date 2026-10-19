# 2. Map and influence: detailed design

_Status: draft v0.4 (2026-10-19). Batch 122 (Logan): contested flag and linked cities on provinces (2.3.1, 2.3.2), Gibraltar, the Isle of Man and the Faroes are their own countries, Gibraltar and the Isle of Man are havens (2.2.5), one euro-area cycle (2.18.1). Batch 121 (Logan): only national governments in the POC; regions, areas, cities and Metros are map groupings with no government (no regional government, city councils, mayors, regional or city bonds); a Metro shares only its property cycle and post-POC metro systems; city and region perks now work through national officials (2.5.10), and each tier adds local standing PC to the country pool. Batch 120 (Logan): the country weight cap is dropped, so every place weighs the honest sum of its provinces; influence tier thresholds drop by level (province and city 10/25/50%, area and region 5/15/30%, country 3/8/20%) with the hysteresis band scaled to match; 2.3.1, 2.5.3, 2.5.9, 2.5.10, the 2.14.1 roll-up and assumption 4 updated. Batch 119 (Logan): any city with a metro population of 5M or more is a Metro, not only former hubs (Phoenix, Melbourne, Philadelphia); province weight is total development × wealth index × $0.3B, and country weight is capped at 3% of GDP; the 2.14 examples are rescaled. Batch 118 (Logan): EU4-style map. Hubs, districts and minor groups are gone: the world is about 195 real countries tiled into about 3,200 land provinces (Superregion > Country > Region > Area > Province); development in three tracks (Commerce, Industry, Population) sets each province's weight; megacities are Metros of 2 to 8 provinces with a shared council, property cycle and (post-POC) metro systems; one resource tag and one terrain per province; the four real estate pools sit in each province; influence runs per province, Metro, area, region and country. Rewritten: 2.2.1, 2.2.5, 2.3, 2.5, 2.16, 2.17; hub and district wording updated everywhere else. Batch 117: no captive banks (Zurich perk is HQ only), no T2 Data Sovereignty, no stress from travel. Batch 116: Colombia and DR Congo promoted to major countries (33); Semiconductors replaces Lithography machines, Foundry, GPUs and CPUs; no dynasties, family or succession (influence holders are characters, companies and governments); branch offices dropped; Clout and Favor replace reputation and prestige; intel learns secrets, accurate data only on Pdoomberg; workforce counts become payroll dollars; crashes cost health; AI takeovers only on the game director's order; consistency fixes A1 to A23. v0.3: consistency pass, batch 74. The file is split from the old "map, influence and economy" file: the map, countries, regions, hubs (now provinces and Metros), location perks, influence, strata and population, pooled real estate, the hub life cycle (now development change), the business cycle, travel and private jets stay here; the old goods economy is gone, replaced by industries and business units in [10-industry-economy.md](10-industry-economy.md) 10.0. Earlier: v0.2 (2026-10-16) added the hub life cycle, business cycles, travel, intelligence, AI behavior and map views. Expands the map and influence overview (05). Owner: Logan._

This file turns the map and influence overviews into exact rules, formulas, numbers and content that a designer can balance. It is pure game design.

**How to read the numbers.** Every number in this file is a **starting tuning value (T)** unless it is marked **Fixed**. Formulas are written so each term can be shown in a tooltip breakdown (see [11-ui.md](../11-ui.md)).

**Decided rules kept intact** (from [13-open-questions.md](../13-open-questions.md)):

- Influence is rooted mainly in assets owned in an area, modified by origin, and temporarily boosted by psyops and ad campaigns.
- Time is pausable real time with hourly ticks; heavy calculations run weekly and monthly.
- Characters are landless; assets are their titles.
- The full game includes map, economy, markets and politics.

**Related detailed files.** Government types, laws, Political Capital (PC), offices, exposure, sanctions and wars are defined in [4-politics.md](4-politics.md). Companies, vassals, autonomy and trusts are defined in [1-corporate-core.md](1-corporate-core.md). Industries, business units and corporations are defined in [10-industry-economy.md](10-industry-economy.md) 10.0. This file uses their terms and does not redefine them.

---

## 2.1 Conventions

### 2.1.1 Money and units

- **Reference dollar ($)**: all base prices and costs are in US dollar equivalents at game start. Each province converts to its country's currency at the live exchange rate ([3-markets-and-fx.md](3-markets-and-fx.md)).
- **Wage index (WI)**: a country's wage level relative to the United States (US = 1.00). It scales wages and local services. It is separate from the politics **wealth index** (GDP per capita / $20,000) used for bribes and legal fees.
- **Price factor (PF)** = `0.3 + 0.7 × WI`. Scales real estate (2.16) and local services. Province weight uses the politics wealth index instead (2.3.1).
- **pp** = percentage points of influence share.

### 2.1.2 Cadence for this layer

| Interval | What runs in this layer |
|---|---|
| **Hourly** (every turn) | FX moves ([3-markets-and-fx.md](3-markets-and-fx.md)); events can fire; travel and action timers |
| **Daily** | Active influence campaigns progress (ramp-up) and roll psyop discovery; strike resolve changes |
| **Weekly** | Temporary influence decay; tier hysteresis checks; queued real estate sales fill (2.16.4) |
| **Monthly** | **Base influence recalculation**; tier changes; population unrest; union organization; strike checks; real estate pool prices and rents (2.16.3); property and business cycle phases; migration |
| **Quarterly** | Company statements ([10-industry-economy.md](10-industry-economy.md) 10.0) |
| **Yearly** | Population growth; education conversion; development change, city rank review and Metro formation (2.17); province weight recompute |

---

## 2.2 The world map

### 2.2.1 Map structure

The world is fully tiled, EU4 style (Logan, batch 118). Every system points at **provinces**; the layers above group them for influence roll-up. Only countries have a government (Logan, batch 121): regions, areas, cities and Metros are map groupings with no government of their own.

| Layer | Count at start | Notes |
|---|---|---|
| **Superregions** | 8 | Labels only, no rules: North America (US, Canada, Mexico, plus Greenland, Bermuda, St Pierre), Latin America (Central America, Caribbean, South America), Europe, Russia and Central Asia, Middle East and North Africa, Sub-Saharan Africa, South Asia, East Asia and Oceania (including Southeast Asia). Used for map labels and news beats |
| **Countries** | About 195 **(T)** | Sovereign states and dependent territories, each with its government, laws, central bank, currency, tax and business cycle. The 33 former major countries keep full economy tables (2.2.3, 2.2.4); the others have simple rows (2.2.5) |
| **Regions** | About 400 **(T)** | Real first-level divisions: US states, Canadian provinces and territories, Mexican states, oblasts, Länder. A map grouping for influence roll-up and perks; there is no regional government in the POC (batch 121), though one may come back after the POC **(A)**. Small countries are one region |
| **Areas** | About 750 **(T)** | 3 to 6 neighbouring provinces inside one region, like an EU4 state. The middle step for influence roll-up and area perks (2.5) |
| **Provinces** | About 3,200 land provinces **(T)** | The map tile: a city, part of a megacity, or a rural county-sized area. Holds development, the four real estate pools, population, unrest, one resource tag and one terrain (2.3.1) |
| **Metros** | About 55 identified so far (every city with a metro population of 5M or more: 54 former hubs plus Philadelphia); likely about 100 once every superregion's list is built **(A)** | A named group of 2 to 8 adjacent provinces forming one megacity, sharing one property cycle and (post-POC) metro systems; no city council (2.3.2) |
| **Chokepoints** | 14 | Straits, canals, cable corridors (2.4). Each province lists the chokepoints it is exposed to |

There are no hubs and no districts any more. The 80 former hubs are the starting city provinces and Metros (2.3.3). The province list is data, built superregion by superregion; done so far: North America, 254 provinces ([provinces-north-america.csv](../data/provinces-north-america.csv)) and Europe, 679 provinces ([provinces-europe.csv](../data/provinces-europe.csv)) **(A)**.

Government types, corruption, stability and election cycles for every country are in [4-politics.md](4-politics.md) 4.2.4. The tables below add the economic and business-climate values.

### 2.2.2 Foreign business restriction summary

Restriction is not a separate law. It is a **summary label** computed from the starting positions of four politics laws: C1 Foreign Ownership, C2 (local partner and director rules), F2 Capital Controls and the strategic sector list ([4-politics.md](4-politics.md) 4.5.3 and 4.5.4). The UI shows the label on the country card.

| Label | Typical law positions | What a foreign company experiences |
|---|---|---|
| **Open** | C1 Open, C2 None, F2 Open | Buy and grow freely; profits move freely |
| **Screened** | C1 Screened, C2 None or Local Directors, F2 Open or Reporting | Foreign Investment Review on stakes of 25% or more in strategic sectors (2 to 6 weeks) |
| **Guarded** | C1 Capped Strategic, C2 Local Directors, F2 Reporting | Foreign voting stake capped at 49% in strategic sectors; a local partner is the usual entry for those sectors |
| **Restricted** | C1 Capped All, C2 Local Partner 30%, F2 Restricted | A 30% local partner for most sectors; outflows need approval |
| **Closed** | C1 Closed, C2 Local Partner 51% and Tech Transfer or State Golden Share, F2 Hard Controls | Entry only by government invitation; state partner; tech transfer; dividends abroad capped |

Foreigners also suffer the **foreigner influence penalty** of the government type, plus a further -10% per C1 step past Screened (2.5.6).

### 2.2.3 Major countries: economy

Columns: GDP in reference trillions at start (**alternate January 2020**, 2026-10-18 review **(T)**: real 2019 values, with the US about 10% larger, the eurozone about 20% smaller in dollars after the euro crisis and the weak euro, and Russia about 30% smaller after 15 years of sanctions); WI = wage index; FX regime is the starting F3 position; corporate tax is the starting E2 position (national rate only).

| # | Country | Currency | FX regime (F3) | GDP ($T) | WI | Corporate tax (E2) | Exchange (fictional) and notes |
|---|---|---|---|---|---|---|---|
| 1 | United States | USD | Free Float (reserve currency) | 23.5 | 1.00 | Moderate | Largest exchange; deepest bond market |
| 2 | Canada | CAD | Free Float | 1.75 | 0.85 | Moderate | Resources, banking |
| 3 | Mexico | MXN | Free Float | 1.25 | 0.22 | High | Nearshoring base for US market |
| 4 | Brazil | BRL | Free Float | 1.85 | 0.25 | High | Agribusiness and iron ore |
| 5 | Argentina | ARS | Managed Float | 0.45 | 0.20 | High | Lithium; history of controls |
| 6 | Chile | CLP | Free Float | 0.28 | 0.30 | High | Copper and lithium |
| 7 | United Kingdom | GBP | Free Float | 2.75 | 0.85 | Moderate | Global FX and insurance center |
| 8 | Germany | EUR | Free Float (euro zone) | 3.2 | 0.90 | High | Euro central bank seat (Frankfurt) |
| 9 | France | EUR | Free Float (euro zone) | 2.2 | 0.85 | Moderate | Luxury, aerospace, nuclear |
| 10 | Netherlands | EUR | Free Float (euro zone) | 0.75 | 0.90 | Moderate | Largest port in Europe; Semiconductors (lithography) |
| 11 | Italy | EUR | Free Float (euro zone) | 1.6 | 0.70 | Moderate | Machinery, luxury |
| 12 | Switzerland | CHF | Free Float (safe haven) | 0.75 | 1.15 | Low | Private banking, commodity traders |
| 13 | Russia | RUB | Managed Float | 1.2 | 0.25 | Moderate | Oil, gas, metals; under sanctions at start |
| 14 | Turkey | TRY | Managed Float | 0.75 | 0.28 | Moderate | Controls the Turkish Straits |
| 15 | Saudi Arabia | SAR | Peg (USD) | 0.85 | 0.55 | Moderate | Largest oil exporter |
| 16 | United Arab Emirates | AED | Peg (USD) | 0.42 | 0.45 | Low | Re-export and finance free zones |
| 17 | Israel | ILS | Free Float | 0.40 | 0.80 | Moderate | Cyber and surveillance tech |
| 18 | Egypt | EGP | Managed Float | 0.30 | 0.10 | Moderate | Suez Canal revenue |
| 19 | Nigeria | NGN | Managed Float | 0.45 | 0.08 | High | Oil; largest African consumer market |
| 20 | South Africa | ZAR | Free Float | 0.35 | 0.22 | High | Mining finance, platinum metals |
| 21 | India | INR | Managed Float | 2.85 | 0.12 | Moderate | IT services, generic pharma |
| 22 | China | CNY | Managed Float | 14.0 | 0.30 | Moderate | Manufacturing core; capital controls |
| 23 | Japan | JPY | Free Float | 5.1 | 0.75 | High | Robotics, chip materials |
| 24 | South Korea | KRW | Free Float | 1.65 | 0.65 | Moderate | Memory, displays, batteries |
| 25 | Taiwan | TWD | Managed Float | 0.61 | 0.50 | Moderate | Semiconductors (leading edge) |
| 26 | Singapore | SGD | Managed Float (basket) | 0.37 | 0.85 | Low | Transshipment, wealth management |
| 27 | Malaysia | MYR | Managed Float | 0.36 | 0.25 | Moderate | Semiconductors (assembly and test) |
| 28 | Indonesia | IDR | Managed Float | 1.12 | 0.12 | Moderate | Nickel, coal, palm oil |
| 29 | Vietnam | VND | Managed Float | 0.26 | 0.12 | Moderate | Electronics assembly |
| 30 | Australia | AUD | Free Float | 1.4 | 0.95 | High | Iron ore, lithium, LNG |
| 31 | Qatar | QAR | Peg (USD) | 0.18 | 0.60 | Low | Largest LNG exporter; sovereign fund; promoted from Gulf minors so Doha has a country (2026-10-18 review) |
| 32 | Colombia | COP | Free Float | 0.32 | 0.18 | High | Oil, coal, coffee, flowers; Medellín; promoted from the Andean group (Logan, batch 116) |
| 33 | DR Congo | CDF | Managed Float (heavily dollarized) | 0.05 | 0.03 | High | Cobalt and copper (Katanga, with the Zambian Copperbelt abstracted in); promoted from Central and Southern Africa (Logan, batch 116) |

### 2.2.4 Major countries: business climate

Strategic sectors (the default list in every country): defense, Semiconductors, AI, telecom, energy, critical minerals, ports, media. A country can add or remove sectors in data.

| Country | C1 Foreign Ownership | C2 Local partner and directors | F2 Capital Controls | E5 Tariffs | L2 Union Rights | Restriction label | Notes |
|---|---|---|---|---|---|---|---|
| United States | Screened | None | Open | Moderate | Recognized | Screened | Reviews buyers from rival countries harder (+4 weeks) |
| Canada | Screened | None | Open | Low | Recognized | Screened | Critical minerals screened at 10% |
| Mexico | Screened | None | Open | Low | Recognized | Screened | Oil and power: state partner required (sector rule) |
| Brazil | Capped Strategic | Local Directors | Reporting | Moderate | Recognized | Guarded | |
| Argentina | Screened | None | Restricted | Moderate | Sectoral Bargaining | Guarded | Lithium export taxes possible |
| Chile | Open | None | Open | Low | Recognized | Open | Copper royalty by law |
| United Kingdom | Screened | None | Open | Low | Recognized | Screened | |
| Germany | Screened | None | Open | Low | Sectoral Bargaining | Screened | |
| France | Capped Strategic | None | Open | Low | Recognized | Guarded | Broad strategic list (food, water, media) |
| Netherlands | Screened | None | Open | Low | Recognized | Screened | Semiconductors (lithography) under export control |
| Italy | Screened | None | Open | Low | Recognized | Screened | Golden powers in strategic deals |
| Switzerland | Open | None | Open | Free Trade | Recognized | Open | F5 Banking Secrecy at Secrecy |
| Russia | Capped All | Local Partner 30% | Restricted | High | Restricted | Restricted | Western holders face Tier 2 sanctions rules |
| Turkey | Screened | None | Reporting | Moderate | Restricted | Screened | |
| Saudi Arabia | Capped Strategic | Local Partner 30% | Open | Low | Banned | Guarded | Oil upstream: state only |
| United Arab Emirates | Capped Strategic | Local Partner 30% | Open | Low | Banned | Guarded | Free zones (C6 Tax Zones) are Open |
| Israel | Screened | None | Open | Low | Recognized | Screened | |
| Egypt | Capped Strategic | Local Directors | Restricted | Moderate | Restricted | Guarded | Canal is state-owned |
| Nigeria | Screened | Local Directors | Restricted | High | Recognized | Guarded | |
| South Africa | Screened | Local Partner 30% (mining only) | Reporting | Moderate | Recognized | Screened | Local ownership rules in mining |
| India | Capped Strategic | Local Directors | Reporting | Moderate | Recognized | Guarded | |
| China | Capped All | Local Partner 30% (51% and Tech Transfer in strategic) | Restricted | Moderate | Restricted | Restricted | Strategic sectors effectively Closed |
| Japan | Screened | None | Open | Low | Recognized | Screened | |
| South Korea | Screened | None | Open | Low | Recognized | Screened | Chaebol cross-holdings |
| Taiwan | Capped Strategic | None | Reporting | Low | Recognized | Guarded | Leading-edge Semiconductors assets abroad need approval |
| Singapore | Open | None | Open | Free Trade | Restricted | Open | |
| Malaysia | Screened | None | Open | Low | Recognized | Screened | |
| Indonesia | Capped Strategic | Local Partner 30% (mining) | Reporting | Moderate | Recognized | Guarded | Raw nickel export ban at start |
| Vietnam | Capped All | Local Partner 30% | Restricted | Moderate | Restricted | Restricted | Export zones (C6) eased |
| Australia | Screened | None | Open | Low | Recognized | Screened | Critical minerals screened at 10% |
| Qatar | Capped Strategic | Local Partner 30% | Open | Low | Banned | Guarded | LNG upstream: state only **(A)** |
| Colombia | Screened | None | Reporting | Moderate | Recognized | Screened | Oil: state partner common (sector rule) **(A)** |
| DR Congo | Capped Strategic | Local Partner 30% (mining only) | Reporting | Moderate | Recognized | Guarded | Mining code: state stake and royalties; cobalt is a strategic mineral **(A)** |

### 2.2.5 Other countries

Minor groups are dissolved (Logan, batch 118). Every other country (about 160) is a real country on the map with its own regions, areas and provinces, its own government and laws ([4-politics.md](4-politics.md) 4.2.4), and its own currency, tax and business cycle. Ukraine, Greece, Mali and Iran are ordinary countries with provinces and cities like the rest. Gibraltar, the Isle of Man and the Faroe Islands are their own countries with one province each (Logan, batch 122), listed as subjects of the UK or Denmark.

Their economies are **simple rows** in [countries.csv](../data/countries.csv) (currency, FX regime, GDP, wage index, corporate tax, restriction label and economic role) **(T)**. They run the same rules as the 33 major countries, with fewer starting business units and no stock exchange unless the row lists one **(A)**. A country can be given a full economy table in data at any time.

**Havens.** Shell company jurisdictions ([1-corporate-core.md](1-corporate-core.md) 1.7.4) at start: Cayman Islands, British Virgin Islands, Bermuda, Jersey (and Guernsey), Gibraltar, the Isle of Man (both added in batch 122), Luxembourg and the UAE free zones. Each is a country or dependent territory with its own provinces, except the UAE free zones, which are C6 Tax Zones inside UAE provinces **(A)**. Havens mostly hold paper: their provinces are small and Commerce-heavy, and shells registered there need no business assets.

---
## 2.3 Provinces, areas and Metros

### 2.3.1 Provinces and development

The **province** is the one place every system points at: business assets, real estate pools, population, unrest, influence and where characters are.

| Field | Meaning |
|---|---|
| **id, name** | Stable id and display name |
| **Country, region, area** | Where it belongs and rolls up (2.5.5). Changes only by secession, annexation or a charter city |
| **Metro** | The Metro it belongs to; blank if none (2.3.2) |
| **City rank** | Metropolis, City, Town or none (below) |
| **Commerce, Industry, Population** | Development tracks, each an integer 1 to 30 (below) |
| **Resource tag** | One tag (below) |
| **Terrain** | One terrain type (below) |
| **Coastal** | Y or N. Only coastal provinces (and river ports named in the notes) hold sea ports |
| **Chokepoint exposure** | The chokepoints (2.4) its sea and cable links pass through; business units with assets here take those chokepoints' risk |
| **Former hub** | Which of the 80 former hubs it belonged to, if any (2.3.3) |
| **Contested** | Blank, or who disputes the province (Logan, batch 122). Below |
| **Linked cities** | Blank, or the name of a linked-cities group (2.3.2, batch 122) |
| **Notes** | Free text |

**Contested provinces (Logan, batch 122).** A contested province has one owner, which runs it like any other province, and a flag naming who disputes it. At start: Crimea and the Donbas (owned by Russia, claimed by Ukraine), Northern Cyprus (owned by Cyprus on paper, run by the Turkish-backed TRNC) and Transnistria (owned by Moldova on paper, run by a Russian-backed breakaway government) **(A)**. Effects **(T)**: business units with assets there take sanctions risk from the claimant's allies (4.11), property and asset values are 20% lower, influence there counts only toward the owner's country level, and the province can change owner only through a scripted event or a peace deal. There are no separate breakaway countries in the POC **(A)**.

Each province also holds the four real estate pools (2.16), its population segments and strata (2.8), unrest and unions per segment, and every holder's influence share (2.5).

**Development** has three tracks, as in EU4 (Logan, batch 118) **(T)**:

| Track | Measures | Driven by (2.17.2) |
|---|---|---|
| **Commerce** | Finance, services, offices, retail | Commerce-fit business assets and the Commercial pool |
| **Industry** | Plants, fabs, ports, fields, mines | Industry-fit business assets and the Industrial pool |
| **Population** | People and labor | Real population: `Population = 2 + 3 × log2(population in millions × 10)`, rounded down, capped at 30 (100k people give 2, 1M give 12, 10M give 22) |

Each track is at least 1 and at most 30. **Total development** = Commerce + Industry + Population. Typical totals **(T)**:

| Province kind | Total development |
|---|---|
| Rural | 3 to 20 |
| Town | 8 to 30 |
| City | 15 to 45 |
| Metro core province | 30 to 75 |

A province's total covers its whole area, not just its main town, so a large rural county cluster with oil fields (the Permian Basin) can out-develop a small city (batch 118 slice check) **(T)**.

**Province weight** = total development × country wealth index × $0.3B **(T)** (Logan, batch 119; was $1B). The wealth index is the politics value (GDP per capita / $20,000, from 0.2 to 4; [4-politics.md](4-politics.md) 4.10.4). Weight replaces hub mass: it is the denominator of influence (2.5.3) and scales the cost of influence campaigns (2.5.7). Every higher place, the country included, is the honest sum of its provinces, with no cap (Logan, batch 120; batch 119 had capped country weight at 3% of GDP); tier thresholds drop by level instead (2.5.9) **(T)**. Examples: a core Metro province at 75 in the United States (wealth index about 3.5) weighs about $79B; Penang (total 30; Malaysia 0.56) $5.04B; Antofagasta (total 25; Chile 0.74) $5.55B.

**Where assets sit.** A business unit's asset spread ([10-industry-economy.md](10-industry-economy.md) 10.0.2) is per province: its assets sit in named provinces and rent or buy space from those provinces' pools (2.16). Districts are gone; instead each industry has a **fit** **(A)**: Commerce-heavy industries (finance, software, media, professional services, retail and the like) get +2% productivity on their assets in provinces where Commerce is the largest track, and Industry-heavy industries (plants, fabs, chemicals, metals, shipping and the like) in provinces where Industry is the largest **(T)**. Extraction industries look at the resource tag instead.

**City rank** (shown on the map; sets airports and which provinces are cities for influence perks; there is no city government, batch 121) **(T)**:

| Rank | Population | Rules |
|---|---|---|
| **Metropolis** | In a Metro, or 3M or more | International airport |
| **City** | 0.5M to 3M | Airport |
| **Town** | 50k to 0.5M | Regional airport at most. Not a city for influence perks |
| **None** | Under 50k | Rural. Not a city for influence perks |

**Resource tags.** One per province (Logan, batch 118), like an EU4 trade good. Business units of a matching industry with assets in the province get **+3% productivity** on that share of their assets **(T)**.

| Tag | Matching business units |
|---|---|
| Oil | Oil |
| Gas | Gas |
| Coal | Mining; Power utilities |
| Copper, Lithium, Cobalt, Nickel, Rare earths, Iron ore, Gold, Uranium | Mining (Iron ore also Metals) |
| Farmland, Timber, Fishing | Agriculture |
| Hydropower | Power utilities; Renewables |
| None | None |

**Terrain** affects disaster odds ([13-events.md](13-events.md)) and the power cost of business units with assets there **(T)**:

| Terrain | Disaster odds | Power cost |
|---|---|---|
| Urban | ×1.0 | ×1.0 |
| Temperate | ×1.0 | ×1.0 |
| Desert | ×1.2 (heat, drought) | ×1.15 (cooling, water) |
| Arctic | ×1.3 (storms, cold) | ×1.2 (Data centers ×0.9: free cooling) |
| Tropical | ×1.4 (storms, floods) | ×1.1 |
| Mountain | ×1.2 (quakes, slides) | ×1.1 |
| Wetland | ×1.3 (floods) | ×1.05 |

**Other province values.** Labor force = 50% of the province's population, split into segments (2.8.1). **City GDP** (used by politics for political market size) = population × national GDP per person × productivity (1.0 for resource towns, 1.3 typical, 2.0 for global finance centers), computed per province and summed for a Metro.

### 2.3.2 Metros

A **Metro** is a named group of 2 or more adjacent provinces forming one megacity (Logan, batch 118). The map draws an outline around its member provinces. Each member keeps its own development, pools, population, unrest and influence shares; the Metro adds what they share. A Metro has **no council or mayor** (Logan, batch 121): as a government matter it shares only its property cycle and, after the POC, its metro systems; the other rows below are groupings for influence and perks:

| Shared | Rule |
|---|---|
| **Property cycle** | One cycle for every member province (2.16.5) |
| **Combined development** | The sum of the members' total development; shown on the Metro card and sets the cost of metro systems |
| **City influence** | Influence across all member provinces, computed like an area, sets the tier for city perks (2.5.10) |
| **Location perks** | A former hub's perks (2.3.5) apply in every member province |
| **Metro systems** | Slots for subway, power grid, water, ports and airports (below) |

**Metro systems (post-POC).** Each system (subway, power grid, water, ports and airports) has one shared level for the whole Metro and benefits every member province, which is the economy of scale; its upgrade cost scales with the Metro's combined development, so bigger Metros pay more per level (Logan) **(A)**. A starting shape for later: upgrade cost = $50M × combined development × wealth index × the next level **(T)**. **Metro systems are not in the POC.** The POC ships the Metro object, its outline on the map, its shared property cycle, and empty system slots.

**Linked cities (Logan, batch 122).** A few clusters of separate cities work as one economy without one core, so they are not Metros. They get a **linked-cities** tag instead: each city keeps its own province, property cycle and city rank, and the tag adds two things **(T)**: city influence is computed across the whole group (like a Metro, for city perks in 2.5.10), and a business unit with assets in two or more member provinces gets +1% productivity there. At start the only group is the **Randstad** (Amsterdam, Rotterdam, The Hague-Delft and Utrecht, about 8M people). Others (for example the Rhine-Ruhr if it were not a Metro) can be added in data **(A)**.

**Membership (T).**

- A Metro has 2 to 8 provinces; members are adjacent and rank Metropolis.
- A Metro may cross region borders (New York takes in North Jersey). Each member keeps its own region and area for roll-up **(A)**.
- Formation, growth and dissolution follow 2.17.4.

**From hubs to provinces at start (T).** Each of the 80 former hubs becomes either:

- a **Metro**, when its metro population is 5M or more: 5M to 10M 2 to 3 provinces, 10M to 20M 3 to 5, 20M or more 4 to 8. That gives 54 Metros of about 185 provinces (the 52 hubs of size L or larger, plus Phoenix and Melbourne at 5.0M); or
- a **single city province**, when smaller (26 provinces).

**Any city of 5M or more is a Metro** (Logan, batch 119), not only former hubs: cities that were never hubs but reach 5M (Philadelphia in North America, a Metro of 3 provinces) come with each superregion's province list under the same size rule **(T)**.

Starting development is seeded from the old district mix **(A)**: Population from the formula above, split across a Metro's provinces by population; Commerce from the Financial districts (and half of the Tech Park ones); Industry from the Industrial, Port and Resource Field districts (and the other half of the Tech Park ones). The Metro's core province gets the old Financial districts and the highest Commerce. The old Slums become the slum share of each province's Residential pool (2.16.6). The land around each former hub becomes ordinary town and rural provinces.

### 2.3.3 Former hubs (city provinces and Metros at start)

The **80 former hubs** (44 original, plus 36 added in the 2026-10-18 realism review; Aberdeen was added, then scrapped by Logan, batch 115) are the starting city provinces and Metros. All are in the 33 major countries. Every other city in the world, including those of Ukraine, Greece, Mali and Iran, comes with the province list and is not listed here. Populations are 2020 metro estimates **(T)**.

**At start** gives the planned shape by the size rule in 2.3.2: a Metro with its planned province count, or a single province. Counts are planned **(T)**; the province data files are authoritative, starting with [provinces-north-america.csv](../data/provinces-north-america.csv) for North America. **Size** is the old size class, kept for reference; since batch 119 the Metro rule goes by population (5M or more). **Old districts** are the old district codes, kept because they seed starting development and slum share (2.3.2): F Financial, T Tech Park, P Port, I Industrial, R Residential, S Slums, X Resource Field. Population is metro population at start in millions. Connections list the main lanes and chokepoints (2.4).

**North America**

| Former hub | Country (region) | Size | Pop (M) | At start | Old districts | Specialties | Connections |
|---|---|---|---|---|---|---|---|
| New York | United States (New York-New Jersey) | Mega | 20 | Metro (4 provinces) | F5 I2 P2 R9 S3 T3 | Global finance, main exchange, media, law, insurance, prime real estate | Transatlantic sea and fiber to London and Rotterdam; rail and road to Chicago; Panama Canal to Asia; Gibraltar to the Mediterranean |
| Chicago | United States (Illinois) | L | 9.5 | Metro (3 provinces) | F3 I4 P1 R4 S1 T1 | Futures and commodity exchange, rail freight center, food processing, grain | Rail to New York, Houston, Los Angeles; Great Lakes and St Lawrence (seasonal); Mississippi barges to the Gulf |
| Houston | United States (Texas) | L | 7.3 | Metro (3 provinces) | F1 I4 P3 R4 S1 X1 | Oil, Gas (LNG export), Chemicals (petrochemicals) | Gulf of Mexico tanker lanes; Panama Canal to Asia; Florida Strait to the Atlantic; pipelines to Chicago |
| Bay Area | United States (California) | L | 7.7 | Metro (3 provinces) | F2 I1 P1 R5 S1 T4 | Venture capital, software, AI labs, Semiconductors (chip design) | Transpacific sea and fiber to Tokyo, Taiwan, Shanghai; air freight hub for chips |
| Los Angeles-Long Beach | United States (California) | XL | 13 | Metro (4 provinces) | F2 I4 P3 R6 S2 T1 | Largest US container port, media and entertainment, aerospace, defense | Transpacific lanes to Shenzhen, Shanghai, Busan; rail land bridge to Chicago and New York |
| Phoenix | United States (Arizona) | M | 5 | Metro (2 provinces; batch 119) | F1 I2 R4 S1 T2 | Semiconductors (new plants), data centers, water-stressed | Rail and road to Los Angeles and Houston; air |
| Edmonton | Canada (Alberta) | S | 1.4 | Single province | F1 I2 R1 S1 X1 | Oil sands and oil field services, pipelines | Pipelines to Houston and the Pacific coast; rail to Toronto and Chicago. Added for the starting character John Techno, replacing Calgary (batch 76; [7-starting-world.md](7-starting-world.md) 7.8) |
| Toronto | Canada (Ontario) | L | 6.5 | Metro (2 provinces) | F3 I3 P1 R5 S1 T1 | Banking, mining finance, auto plants, AI research | Rail and road to New York and Chicago; St Lawrence Seaway |
| Mexico City | Mexico (Valle de México and Bajío belt) | Mega | 22 | Metro (4 provinces) | F2 I6 P1 R8 S5 T1 X1 | Vehicles and parts, nearshore electronics, consumer goods, telecom | Rail and road to Houston (US border crossings); Pacific port Manzanillo and Gulf port Veracruz (abstracted) |
| Washington DC | United States (DC, Maryland, Northern Virginia) | L | 6.3 | Metro (2 provinces) | F2 I1 R6 S2 T3 | Federal government, lobbying firms, defense contractors, Northern Virginia data center alley | Rail to New York; air; transatlantic fiber |
| Boston | United States (Massachusetts) | M | 4.9 | Single province | F2 R4 S1 T3 | Biotech, universities, asset management, robotics | Rail to New York; Atlantic port (abstracted); air |
| Seattle | United States (Washington) | M | 4.0 | Single province | F1 I2 P2 R3 T2 | Cloud computing, e-commerce, aerospace, Pacific port | Transpacific lanes to Tokyo, Busan and Shanghai; rail to Chicago |
| Dallas-Fort Worth | United States (Texas) | L | 7.6 | Metro (3 provinces) | F3 I3 R5 S1 T2 | Corporate headquarters, energy finance, telecom, logistics | Rail and road to Houston and Chicago; air hub |
| Atlanta | United States (Georgia) | L | 6.0 | Metro (2 provinces) | F2 I3 P1 R5 S2 T1 | The world's busiest airport, logistics, media, payments | Air hub; rail to the Gulf and East Coast ports |
| Miami | United States (Florida) | L | 6.1 | Metro (2 provinces) | F3 P2 R6 S2 T1 | Latin American finance gateway, flight capital, real estate, cruise and tourism | Florida Strait; Caribbean and Panama Canal lanes; air to Latin America |
| Austin | United States (Texas) | M | 2.2 | Single province | F1 I2 R4 S1 T2 | Semiconductors, software, EV plant | Road and rail to Dallas and Houston; air |
| Detroit | United States (Michigan) | M | 4.3 | Single province | F1 I4 R3 S2 | Autos and EVs, parts suppliers | Great Lakes; road and rail to Toronto and Chicago |
| Las Vegas | United States (Nevada) | M | 2.3 | Single province | F1 I1 R5 S2 T1 | Casinos, gambling, conventions, tourism | Road and rail to Los Angeles; air |
| Vancouver | Canada (British Columbia) | M | 2.6 | Single province | F2 P2 R4 S1 T1 | Pacific port, real estate, Asian capital, film | Transpacific lanes; rail to Edmonton and Toronto |
| Montreal | Canada (Quebec) | M | 4.2 | Single province | F2 I2 P1 R3 S1 T1 | AI research, aerospace, video games | St Lawrence Seaway; rail to Toronto and New York |
| Ottawa | Canada (Ontario) | S | 1.4 | Single province | F1 R3 S1 T1 | Federal government, tech | Rail and road to Montreal and Toronto |
| Monterrey | Mexico (Nuevo León) | L | 5.3 | Metro (2 provinces) | F2 I6 R4 S2 | Steel, cement, nearshoring plants, brewing | Road and rail to Texas border crossings |
| Guadalajara | Mexico (Jalisco) | L | 5.2 | Metro (2 provinces) | F1 I4 R5 S3 T1 | Electronics, software, tequila | Pacific port Manzanillo (abstracted); rail to Mexico City |

**South America**

| Former hub | Country (region) | Size | Pop (M) | At start | Old districts | Specialties | Connections |
|---|---|---|---|---|---|---|---|
| São Paulo | Brazil (São Paulo, with Santos port) | Mega | 22 | Metro (4 provinces) | F3 I5 P2 R8 S4 T1 X1 | Finance, vehicles, food processing, soy, beef, sugar, iron ore marketing | Santos to Atlantic lanes; Cape of Good Hope to China; Panama Canal to the US west coast |
| Antofagasta | Chile (Antofagasta, Atacama) | S | 0.5 | Single province | I1 P1 R1 S1 X2 | Copper mining, lithium brine | Pacific bulk lanes to Shanghai, Busan, Tokyo; Panama Canal to Houston |
| Medellín | Colombia (Antioquia) | M | 4 | Single province | F1 I2 R3 S2 T1 X1 | Textiles, coffee, flowers, informal economy, cartel money laundering, growing tech scene | Road to Pacific port Buenaventura and Caribbean port Cartagena (abstracted); air to Miami and Bogotá. Added for the starting character Pablo Segundo ([7-starting-world.md](7-starting-world.md) 7.8) |
| Rio de Janeiro | Brazil (Rio de Janeiro) | XL | 13 | Metro (4 provinces) | F2 I3 P3 R6 S4 | Offshore oil company headquarters, media, tourism | Atlantic lanes; offshore oil fields |
| Buenos Aires | Argentina (Buenos Aires) | XL | 15 | Metro (4 provinces) | F3 I4 P2 R6 S3 | Finance, agribusiness, lithium financing, software exports | River Plate port; Atlantic lanes |
| Santiago | Chile (Santiago Metropolitan) | L | 6.8 | Metro (2 provinces) | F3 I3 R5 S2 T1 | Finance, mining company headquarters, pension funds | Road to Pacific port Valparaíso (abstracted); air |

**Europe**

| Former hub | Country (region) | Size | Pop (M) | At start | Old districts | Specialties | Connections |
|---|---|---|---|---|---|---|---|
| London | United Kingdom (Greater London) | XL | 15 | Metro (4 provinces) | F5 I1 P1 R7 S2 T2 | FX trading, insurance, law, wealth management, links to havens | Dover Strait; Channel Tunnel rail; transatlantic fiber and air |
| Rotterdam | Netherlands (South Holland) | M | 2.5 | Single province | F1 I3 P4 R2 | Largest European port, chemicals, LNG import, Rhine gateway | Asia-Europe lanes via Suez or the Cape; Dover Strait; Rhine barges and rail to Frankfurt |
| Eindhoven | Netherlands (North Brabant) | S | 0.8 | Single province | I2 R2 T2 | Semiconductors (lithography systems; sole supplier at start), photonics, precision systems | Rail and road to Rotterdam; air freight |
| Frankfurt | Germany (Hesse, Rhine-Main incl. chemical complex) | L | 5.8 | Metro (2 provinces) | F4 I4 P1 R4 T1 | Euro central bank, banking, chemicals, precision optics, auto suppliers, air cargo | Rhine barges and rail to Rotterdam; rail to Paris and over the Alps to the south; air |
| Paris | France (Île-de-France) | XL | 13 | Metro (4 provinces) | F3 I3 P1 R7 S2 T2 | Luxury goods, aerospace, nuclear engineering, defense, finance | Rail and road to Rotterdam and Frankfurt; Channel Tunnel to London; port of Le Havre (abstracted) |
| Zurich | Switzerland (Zurich, with Basel and Geneva abstracted) | M | 1.5 | Single province | F4 I1 R4 T1 | Private banking, commodity trading houses, insurance, pharma | Rail to Frankfurt and Milan; air |
| Moscow | Russia (Central) | Mega | 21 | Metro (4 provinces) | F3 I5 P1 R9 S4 T2 | Energy company headquarters, metals, defense, oil trading, cybercrime underground | Pipelines to China and (sanctioned) Europe; rail to China via Kazakhstan; Baltic ports via the Danish Straits; Black Sea via the Turkish Straits |
| Istanbul | Turkey (Marmara) | XL | 16 | Metro (5 provinces) | F2 I5 P3 R5 S3 | Textiles, vehicles, shipping, regional finance | Turkish Straits; Black Sea lanes; rail to Europe; Middle Corridor rail to Central Asia and China |
| Munich | Germany (Bavaria) | L | 6.0 | Metro (2 provinces) | F3 I4 R5 T2 | Autos, insurance and reinsurance, Semiconductors | Rail to Frankfurt and over the Alps; air |
| Berlin | Germany (Berlin-Brandenburg) | L | 6.1 | Metro (2 provinces) | F2 I2 R6 S2 T2 | Federal government, startups, media | Rail to Frankfurt, Warsaw and the Baltic |
| Amsterdam | Netherlands (North Holland) | M | 2.5 | Single province | F3 P1 R4 T2 | Stock exchange, fintech, data centers, internet exchange | Rail to Rotterdam; North Sea; transatlantic fiber |
| Milan | Italy (Lombardy) | L | 7.4 | Metro (3 provinces) | F4 I4 R5 S1 | Finance, fashion, luxury, design | Rail over the Alps to Zurich and Frankfurt |
| Rome | Italy (Lazio) | M | 4.3 | Single province | F1 I1 R5 S2 T1 | Government, the Vatican, tourism, state energy company headquarters | Rail to Milan; Mediterranean port (abstracted) |
| St Petersburg | Russia (Northwest) | L | 6.2 | Metro (2 provinces) | F2 I4 P3 R4 S1 | Baltic port, shipbuilding, gas company headquarters | Baltic lanes via the Danish Straits; rail to Moscow |

**Middle East and Africa**

| Former hub | Country (region) | Size | Pop (M) | At start | Old districts | Specialties | Connections |
|---|---|---|---|---|---|---|---|
| Dubai | UAE (Dubai and Sharjah) | L | 6 | Metro (2 provinces) | F4 I2 P3 R3 S1 T1 | Re-export logistics, gold trading, free zones, aviation hub, real estate, grey trade | Strait of Hormuz (inside the Gulf); sea lanes to India, East Africa and Europe; air hub |
| Dhahran-Dammam | Saudi Arabia (Eastern Province) | M | 4 | Single province | F1 I3 P2 R2 X2 | Largest oil fields, petrochemicals, desalination | Strait of Hormuz; East-West pipeline to the Red Sea coast (bypass); Bab-el-Mandeb and Suez |
| Doha | Qatar (Doha) | M | 2.4 | Single province | F2 I2 P2 R3 X1 | Largest LNG exporter, sovereign fund, media network | Strait of Hormuz; LNG lanes to Tokyo, Seoul and (via Suez) Rotterdam |
| Tel Aviv | Israel (Central) | M | 4 | Single province | F2 I1 P1 R3 T3 | Cybersecurity, surveillance tech, Semiconductors (chip design), defense electronics, venture capital | Mediterranean via Suez or Gibraltar; air; fiber |
| Cairo-Suez | Egypt (Cairo and Canal Zone) | Mega | 22 | Metro (4 provinces) | F2 I4 P2 R8 S7 T1 | Canal revenue, textiles, fertilizer, construction, gas | Suez Canal; Mediterranean and Red Sea lanes; Red Sea cable corridor landing |
| Lagos | Nigeria (Lagos) | Mega | 21 | Metro (4 provinces) | F2 I3 P2 R7 S9 T1 | Oil money, fintech, consumer goods, film industry, informal economy | Gulf of Guinea lanes (piracy risk); Atlantic to Europe; Cape of Good Hope to Asia |
| Johannesburg | South Africa (Gauteng, with Durban port abstracted) | L | 9.5 | Metro (3 provinces) | F3 I3 P1 R4 S2 X1 | Mining finance, platinum metals, gold, coal power | Rail to Durban; Cape of Good Hope; Mozambique Channel |
| Kolwezi-Lubumbashi | DR Congo (Katanga; the Zambian Copperbelt is abstracted in) | M | 3 | Single province | I2 R2 S3 X3 | Cobalt (about 70% of world supply), copper | Long truck and rail lanes to Durban, Dar es Salaam and Lobito; border delays |
| Riyadh | Saudi Arabia (Riyadh) | L | 7.6 | Metro (3 provinces) | F3 I3 R5 S2 T1 | Government, royal court, sovereign fund, megaprojects | Rail to Dhahran-Dammam; air |
| Abu Dhabi | UAE (Abu Dhabi) | M | 1.5 | Single province | F3 I2 P2 R2 X1 | Sovereign funds, oil, AI investment | Strait of Hormuz; road to Dubai |
| Cape Town | South Africa (Western Cape) | M | 4.7 | Single province | F2 I1 P2 R3 S2 | Finance, tourism, wine, tech | Cape of Good Hope lanes |

**Asia and Oceania**

| Former hub | Country (region) | Size | Pop (M) | At start | Old districts | Specialties | Connections |
|---|---|---|---|---|---|---|---|
| Mumbai | India (Maharashtra) | Mega | 24 | Metro (5 provinces) | F4 I3 P2 R6 S8 T1 | Finance, main exchange, film industry, generic pharma, petrochemicals (Gujarat abstracted) | Arabian Sea lanes to the Gulf (Hormuz); Suez to Europe; Malacca to East Asia |
| Bengaluru | India (Karnataka) | XL | 13 | Metro (4 provinces) | F1 I2 R7 S4 T4 | IT services, software outsourcing, Semiconductors (chip design), aerospace, biotech | Air; Chennai port (abstracted); fiber |
| Shanghai | China (Yangtze Delta) | Mega | 29 | Metro (6 provinces) | F4 I6 P3 R8 S1 T3 | Largest container port, finance, EVs, Semiconductors (mature nodes), shipbuilding | Taiwan Strait (southbound); East China Sea to Japan, Korea and the Pacific; Malacca to Europe; Yangtze barges; rail to Europe via Kazakhstan |
| Shenzhen-Dongguan | China (Pearl River Delta) | Mega | 22 | Metro (4 provinces) | F2 I7 P3 R6 S2 T4 | Electronics assembly, component markets, drones, EVs and batteries | South China Sea to Malacca; Taiwan Strait (northbound); Luzon Strait to the Pacific; Hong Kong next door |
| Hong Kong | China (Hong Kong SAR) | L | 7.5 | Metro (3 provinces) | F5 P3 R4 S1 T1 | Offshore gateway into China, trading houses, re-export, company registrations | Pearl River Delta; Taiwan Strait; Malacca; Luzon Strait cables. Uses HKD (F3 Currency Board to USD) and its own looser laws: restriction Screened |
| Beijing | China (Jing-Jin-Ji, with Tianjin port) | Mega | 22 | Metro (4 provinces) | F3 I3 P1 R9 S3 T5 | Central government, state company headquarters, AI and surveillance tech, regulators | Tianjin via the Bohai and Yellow Sea; rail to Russia and Mongolia; rail to Shanghai |
| Baotou | China (Inner Mongolia) | M | 2.7 | Single province | I4 R2 S1 X3 | Rare earth mining and separation, steel, aluminium | Rail to Beijing and Tianjin port; rail to Mongolia and Russia |
| Hsinchu-Taipei | Taiwan (North Taiwan) | L | 9 | Metro (3 provinces) | F2 I2 P1 R4 T5 | Semiconductors (leading-edge logic and advanced packaging), electronics design | Taiwan Strait and Luzon Strait for all sea exits; air freight for chips; undersea cables |
| Seoul-Pyeongtaek | South Korea (Capital Area, with Ulsan and Busan abstracted) | Mega | 26 | Metro (5 provinces) | F3 I5 P2 R8 S1 T5 | Semiconductors (memory), displays, batteries, shipbuilding, vehicles, entertainment | Korea Strait; East China Sea; Taiwan or Luzon Strait to Malacca; Pacific to the US |
| Tokyo-Yokohama | Japan (Kanto, with Nagoya abstracted) | Mega | 37 | Metro (8 provinces) | F5 I5 P3 R9 S1 T3 | Finance, vehicles, robotics, Semiconductors (materials), precision machinery | Pacific lanes to the US; East China Sea; Malacca and Hormuz for oil and LNG |
| Singapore | Singapore | L | 6 | Metro (2 provinces) | F4 I2 P4 R3 T1 | Transshipment, petrochemicals, commodity trading, wealth management, data centers, cable landings | Strait of Malacca and Singapore Strait; South China Sea; Indian Ocean |
| Penang | Malaysia (Penang and Kulim) | M | 1.8 | Single province | I4 P1 R3 T2 | Semiconductors (assembly, test and packaging), electronics | Strait of Malacca; air |
| Jakarta | Indonesia (Jabodetabek, with Sulawesi nickel abstracted) | Mega | 34 | Metro (7 provinces) | F2 I5 P2 R7 S6 T1 X1 | Consumer market, nickel processing, palm oil, coal | Sunda Strait; Malacca; Lombok route |
| Ho Chi Minh City | Vietnam (Southeast) | XL | 14 | Metro (4 provinces) | F1 I6 P2 R5 S3 T1 | Electronics assembly ("China plus one"), garments, footwear, rice | South China Sea; Malacca; transpacific lanes |
| Perth-Pilbara | Australia (Western Australia) | M | 2.3 | Single province | F1 I2 P2 R3 X2 | Iron ore (largest exporter), lithium ore, LNG, gold | Bulk lanes to China, Japan and Korea via the Lombok and Makassar straits (bypassing Malacca) |
| Sydney | Australia (New South Wales) | L | 5.4 | Metro (2 provinces) | F3 I2 P2 R5 S1 T1 | Banking, pension funds, property, media, mining company headquarters | Pacific lanes to Shanghai, Tokyo and Los Angeles; fiber to Singapore and the US. |
| Delhi NCR | India (Delhi, Gurugram, Noida) | Mega | 31 | Metro (7 provinces) | F3 I5 R9 S6 T3 | Capital and government, IT services, autos | Rail to Mumbai; air hub |
| Hyderabad | India (Telangana) | XL | 10 | Metro (3 provinces) | F1 I3 R7 S4 T3 | Pharma, IT services, cloud data centers | Rail and road to Chennai and Mumbai; air |
| Chennai | India (Tamil Nadu) | XL | 11 | Metro (3 provinces) | F1 I5 P2 R6 S3 T1 | Autos, electronics assembly, port | Bay of Bengal lanes to Malacca |
| Chengdu | China (Sichuan) | XL | 16 | Metro (5 provinces) | F2 I5 R7 S2 T2 | Electronics assembly, gaming, aerospace | Rail to Europe; Yangtze via Chongqing |
| Wuhan | China (Hubei) | XL | 11 | Metro (3 provinces) | F1 I6 P1 R7 S2 T1 | Autos, steel, optical fiber, research labs | Yangtze barges to Shanghai; rail hub |
| Osaka-Kobe | Japan (Kansai) | XL | 19 | Metro (5 provinces) | F3 I5 P3 R6 S1 | Manufacturing, electronics, pharma, port | Inland Sea; Pacific lanes |
| Kaohsiung | Taiwan (South Taiwan) | M | 2.7 | Single province | I4 P3 R2 T1 | Port, petrochemicals, steel, Semiconductors (new plants) | Taiwan and Luzon Straits |
| Kuala Lumpur | Malaysia (Klang Valley) | L | 8 | Metro (3 provinces) | F3 I3 R5 S2 T1 | Finance, Islamic finance, palm oil trading, data centers | Port Klang on the Strait of Malacca |
| Hanoi | Vietnam (Red River Delta) | L | 8 | Metro (3 provinces) | F1 I6 R5 S1 T1 | Government, electronics plants | Port of Haiphong (abstracted); rail to China |
| Melbourne | Australia (Victoria) | M | 5.0 | Metro (2 provinces; batch 119) | F3 I2 P1 R4 | Finance, pension funds, universities, port | Bass Strait; Pacific lanes |

### 2.3.4 Signature starting assets

Each former hub's city province or Metro starts with AI-owned business units in its specialty industries, so the world economy runs from turn one. In a Metro their assets are spread over the member provinces that fit their industry (2.3.1). Examples, plus every hub added in the 2026-10-18 review (Logan, batch 115) **(A)**:

| City (Metro or city province) | Signature business units at start |
|---|---|
| Hsinchu-Taipei | Semiconductors (leading-edge logic and advanced packaging) |
| Seoul-Pyeongtaek | Semiconductors (memory), Consumer electronics, EVs (batteries) |
| Eindhoven | Semiconductors (lithography; the only maker of the machines in the world) |
| Shenzhen-Dongguan | Consumer electronics, EVs, Drones |
| Penang | Semiconductors (assembly, test and packaging) |
| Kolwezi-Lubumbashi | Mining (cobalt and copper, Katanga) |
| Baotou | Mining (rare earths), Metals |
| Perth-Pilbara | Mining (iron ore and lithium), Gas (LNG) |
| Dhahran-Dammam | Oil, Chemicals |
| Doha | Gas (LNG) |
| Antofagasta | Mining (copper and lithium) |
| Houston | Oil, Gas, Chemicals |
| Washington DC | Defense, Data centers, Professional services (lobbying) |
| Boston | Pharma (biotech), Asset management, Robotics |
| Seattle | Cloud, E-commerce, Aerospace |
| Dallas-Fort Worth | Telecom, Banking, Logistics |
| Atlanta | Airlines, Logistics, Banking (payments) |
| Miami | Banking (Latin American private banking), Real estate |
| Austin | Semiconductors, EVs, Software |
| Detroit | Autos, EVs |
| Las Vegas | Gambling |
| Vancouver | Real estate, Shipping |
| Montreal | AI labs, Aerospace, Gaming |
| Ottawa | Telecom, Software |
| Monterrey | Metals (steel), Construction (cement) |
| Guadalajara | Consumer electronics, Software |
| Rio de Janeiro | Oil (offshore) |
| Buenos Aires | Agriculture, Banking |
| Santiago | Asset management (pension funds), Mining (headquarters) |
| Munich | Autos, Insurance (reinsurance) |
| Berlin | Software, E-commerce |
| Amsterdam | Data centers, Banking (fintech) |
| Milan | Luxury, Banking |
| Rome | Power utilities, Gas |
| St Petersburg | Gas, Shipping |
| Riyadh | Asset management (sovereign fund), Construction (megaprojects) |
| Abu Dhabi | Oil, Asset management (sovereign funds) |
| Cape Town | Agriculture (wine), Banking |
| Delhi NCR | Autos, Software, Telecom |
| Hyderabad | Pharma, Data centers, Software |
| Chennai | Autos, Consumer electronics |
| Chengdu | Consumer electronics, Gaming |
| Wuhan | Autos, Metals (steel), Telecom (optical fiber) |
| Osaka-Kobe | Consumer electronics, Pharma, Shipping |
| Kaohsiung | Semiconductors, Chemicals, Metals |
| Kuala Lumpur | Banking (Islamic finance), Agriculture (palm oil), Data centers |
| Hanoi | Consumer electronics |
| Melbourne | Asset management (pension funds), Mining (headquarters) |

Unit sizes and their province spread live in province data (January 2020 values, [7-starting-world.md](7-starting-world.md)) and are tuned so each industry's world supply roughly matches its demand at the start ([10-industry-economy.md](10-industry-economy.md) 10.0.3).

### 2.3.5 Location perks (Logan, 2026-10-17)

Perks belong to **locations**, not to company size. The big **financial and tech hubs** have perks (Logan, batch 24), and so does every hub added in the 2026-10-18 review (Logan, batch 115). Since batch 118 each perk belongs to the former hub's **city**: its Metro (every member province) or its single city province. Each is of the form **"every company that achieves X here gets Y"**. Any number of companies can hold the same perk; there is no ranking and no size threshold. Starting set **(A)**, values **(T)**:

| City (Metro or city province) | Achieve | Get |
|---|---|---|
| New York | HQ here | Investor confidence +5% |
| London | HQ here | -0.25 points on bonds issued |
| Zurich | HQ here | -0.25 points on loans; shell exposure -10% |
| Bay Area | HQ here and work in a Tech industry | R&D plan effects +10% |
| Hsinchu-Taipei | A Semiconductors business unit with assets here | Productivity +5% |
| Shenzhen-Dongguan | A Consumer electronics, Robotics or Semiconductors business unit with assets here | Productivity +5%; variable cost -3% |
| Singapore | HQ here | -0.25 points on loans; securities regulator strictness -1 |
| Bengaluru | A Software or SaaS business unit with assets here | Variable cost -5% (wages) |
| Tokyo-Yokohama | A Robotics business unit with assets here | Productivity +5% |
| Seoul-Pyeongtaek | A Semiconductors or Consumer electronics business unit with assets here | Productivity +3% |
| Frankfurt | HQ here | -0.25 points on loans from banks in the eurozone |
| Washington DC | HQ here | Political Capital +10% in the United States; Defense contracts awarded +5% |
| Boston | A Pharma or Robotics business unit with assets here | R&D plan effects +10% |
| Seattle | A Cloud or E-commerce business unit with assets here | Variable cost -3% |
| Dallas-Fort Worth | HQ here | Corporate tax -1 point (Texas has no state tax); investor confidence +2% |
| Atlanta | An Airlines or Logistics business unit with assets here | Variable cost -4% |
| Miami | HQ here | Influence +10% in every Latin American province; shell exposure -5% |
| Austin | A Semiconductors or Software business unit with assets here | Productivity +3% |
| Detroit | An Autos or EVs business unit with assets here | Productivity +5% |
| Las Vegas | A Gambling business unit with assets here | Productivity +10%; gambling regulator strictness -1 |
| Vancouver | A Real estate business unit with assets here | Rent +5% on Residential pools in the city |
| Montreal | An AI labs or Gaming business unit with assets here | R&D plan effects +10% (research tax credits) |
| Ottawa | HQ here | Political Capital +10% in Canada |
| Monterrey | A Metals or Construction business unit with assets here | Variable cost -3%; tariff-free sales into the US market |
| Guadalajara | A Consumer electronics or Software business unit with assets here | Variable cost -5% (wages) |
| Rio de Janeiro | An Oil business unit with assets here | Productivity +5% (offshore fields) |
| Buenos Aires | An Agriculture business unit with assets here | Productivity +5%; FX loss on ARS profits -10% |
| Santiago | HQ here | -0.25 points on loans; investor confidence +2% for Mining units |
| Munich | An Autos or Insurance business unit with assets here | Productivity +3% |
| Berlin | A Software or E-commerce business unit with assets here | Founding costs -10% for new companies with HQ here |
| Amsterdam | A Data centers or Cloud business unit with assets here | Compute maintenance -5% (cheap power and the internet exchange) |
| Milan | A Luxury business unit with assets here | Productivity +5% |
| Rome | HQ here | Political Capital +10% in Italy; first refusal on Italian state contracts |
| St Petersburg | A Gas or Shipping business unit with assets here | Variable cost -3% |
| Riyadh | HQ here | First refusal on Saudi megaproject contracts; influence +10% in Saudi Arabia |
| Abu Dhabi | HQ here | -0.25 points on loans from Gulf sovereign funds; AI labs R&D plan effects +5% |
| Cape Town | HQ here | Investor confidence +2% for companies with units across Africa |
| Delhi NCR | HQ here | Political Capital +10% in India; foreign restriction label one step easier in India |
| Hyderabad | A Pharma or Data centers business unit with assets here | Variable cost -5% |
| Chennai | An Autos or Consumer electronics business unit with assets here | Variable cost -4% |
| Chengdu | A Gaming or Consumer electronics business unit with assets here | Variable cost -4% |
| Wuhan | An Autos or Telecom business unit with assets here | Productivity +3% |
| Osaka-Kobe | A Pharma or Consumer electronics business unit with assets here | Productivity +3% |
| Kaohsiung | A Semiconductors business unit with assets here | Productivity +3% (stacks with Hsinchu-Taipei) |
| Kuala Lumpur | HQ here, or a Data centers business unit with assets here | -0.25 points on Islamic bonds; compute maintenance -5% |
| Hanoi | A Consumer electronics business unit with assets here | Variable cost -6% (wages) |
| Melbourne | HQ here | -0.25 points on loans from Australian pension funds |

- **HQ** is the province the corporation names as its head office; it can move it once a year. An HQ in any province of a Metro counts as an HQ in that Metro for perks.
- Perks apply to the whole corporation unless they name an industry, in which case they apply to that business unit's share of assets in the city's provinces.
- "Assets here" means assets in the city province or in any member province of the Metro.
- Events and politics can add, remove or change perks (a tax haven law, a tech cluster subsidy, a war).

---

## 2.4 Chokepoints

Goods do not ship along lanes: each industry has one world market ([10-industry-economy.md](10-industry-economy.md) 10.0). Chokepoints stay on the map as places whose **risk level** raises costs and cuts capacity for the industries exposed to them.

### 2.4.2 Chokepoints

| Chokepoint | Location and control | Share of world flows (start) | What flows through | Bypass and penalty | Starting risk | Typical threats |
|---|---|---|---|---|---|---|
| **Strait of Hormuz** | Between Iran and Oman/UAE | 20% of crude oil, 20% of LNG, 30% of seaborne fertilizer inputs | Gulf crude to Asia and Europe; Qatari LNG; petrochemicals; Dubai re-exports | Saudi East-West pipeline (up to 25% of normal Hormuz crude) and UAE Fujairah pipeline (8%); no LNG bypass | Tension | Blockade, mines, tanker seizures, Iran sanctions escalation |
| **Bab-el-Mandeb** | Between Yemen and Djibouti/Eritrea | 10% of world trade | Asia-Europe containers, Gulf oil to Europe | Cape of Good Hope: +6,000 to 7,000 km, +10 to 14 days | Tension | Missile and drone attacks on ships, piracy |
| **Suez Canal** | Egypt | 12% of world trade, 30% of container traffic | Asia-Europe containers, LNG, oil products, grain | Cape of Good Hope: +6,000 to 7,000 km, +10 to 14 days | Calm | Ship grounding, canal closure, Egyptian unrest |
| **Strait of Malacca** (with Singapore Strait) | Malaysia, Indonesia, Singapore | 25% of seaborne trade, 30% of crude oil | Gulf oil and LNG to East Asia, Asia-Europe containers, coal, palm oil | Lombok and Makassar straits: +1,500 km, +2 to 3 days; Sunda Strait (shallow, bulk only) | Calm | Piracy, collisions, haze, blockade in a great power war |
| **Taiwan Strait** | Between mainland China and Taiwan | 40% of the world container fleet passes yearly; most of Taiwan's sea exports | Electronics, chips (sea share), containers between North and South China Sea | East of Taiwan: +800 km, +1 to 2 days (unsafe if the conflict is around Taiwan itself) | Tension | Military exercises, blockade, quarantine, war |
| **Luzon Strait** (Bashi Channel) | Between Taiwan and the Philippines | 15% of transpacific shipping; 10 major undersea cables | Pacific containers; East Asia data traffic | Through the Philippine archipelago: +2 days; cables: reroute via Guam (latency +15%) | Calm | Cable cuts, war spillover, typhoons |
| **Panama Canal** | Panama | 5% of world trade, 40% of US container traffic between coasts and Asia | US Gulf LNG and grain to Asia, Asian goods to the US east coast | US rail land bridge (Los Angeles to Chicago and New York); Suez route; Cape Horn +12,000 km | Calm | Drought (water level), slot auctions, strikes |
| **Turkish Straits** (Bosporus and Dardanelles) | Turkey | 3% of crude oil, 10% of world wheat exports | Black Sea grain, Kazakh and Russian oil, steel | None for the Black Sea (rail and road only, small capacity) | Tension | Black Sea war, Turkish closure to warships, collisions |
| **Strait of Gibraltar** | Spain, Morocco, UK territory | 10% of world trade | Mediterranean to Atlantic containers and energy | None by sea | Calm | Rare; migration crises, port strikes |
| **Dover Strait** (English Channel) | UK and France | 15% of European trade | North Sea ports (Rotterdam, Hamburg, London) to the world | North of Scotland: +1,500 km, +2 days | Calm | Collisions, storms, port strikes, Channel Tunnel closures |
| **Danish Straits** | Denmark and Sweden | 3% of crude oil | Baltic trade, Russian oil exports | None by sea | Tension | Sanctions inspections, cable and pipeline sabotage |
| **Cape of Good Hope** | South Africa (open ocean) | Bypass route | Rerouted Asia-Europe traffic; Brazil-China soy and ore | Not a chokepoint; storms add +2 to 4 days in winter | Calm | Storms |
| **Red Sea cable corridor** | Egypt and the Red Sea | 17% of world internet traffic between Europe and Asia | Fiber data, cloud compute between Europe, Gulf and Asia | Overland Gulf routes or around Africa: capacity -40%, latency +20% | Tension | Anchor drags, sabotage |
| **Singapore cable landing** | Singapore | 30% of Asia-Pacific cable traffic | Data, cloud, finance latency | Hong Kong and Tokyo landings: latency +10% | Calm | Cable faults, cyberattack |

**Risk levels.** Calm, Tension, Attacks, Conflict, Closed. Risk moves by events ([13-events.md](13-events.md)) and by politics (relations, wars, sanctions: [4-politics.md](4-politics.md) 4.11).

### 2.4.3 Oil and gas shocks (Logan, 2026-10-17)

Oil and gas get their own shocks on top of the chokepoint risk levels. Starting set **(A)**:

| Shock | Where | What it does **(T)** | How it starts and ends |
|---|---|---|---|
| **Strait of Hormuz** | Gulf exits (Dhahran-Dammam, Doha, Dubai) | Tension: war-risk insurance +0.5%. Closure: about 20% of world oil and a large share of LNG cannot leave the Gulf; the Saudi East-West pipeline carries a fraction to the Red Sea | Iran events, Gulf wars, strikes on tankers; reopens by event or after 2 to 12 weeks |
| **Cartel cuts (OPEC-style)** | Gulf, Russia and other producers | Members cut output by 1% to 10% of world oil for 3 to 12 months; the oil price index rises | Rolled monthly when prices fall below the cartel's target; players with Persuasion and influence in member countries can push for or against |
| **Sanctions on Russia** | Russian oil and gas exports | In force since 2005 (Ukraine war, [7-starting-world.md](7-starting-world.md) 7.2.0): pipeline gas to Europe is already cut at start; oil is sold at a discount through grey fleets to buyers that ignore the sanctions | Ceasefire or escalation events change them; 4.11.4 sanctions rules |
| **Red Sea attacks** | Bab-el-Mandeb and Suez | Tankers and LNG carriers reroute around Africa (+10 to 14 days); insurance at Attacks or Conflict | Timeline event (late 2023), then rolled by regional tension |

Shocks raise the oil and gas price indices and, through power plants that burn them, electricity prices, which raises costs for energy-heavy industries such as Semiconductors and Data centers. Players can profit by holding oil and gas businesses or futures ([3-markets-and-fx.md](3-markets-and-fx.md)).

---

## 2.5 Influence

### 2.5.1 Overview and order of calculation

Influence share is tracked **per holder per place**: province, area, region and country, plus the **city** (a Metro, or a single province ranked City or Metropolis), which carries the old hub perks. Holders are characters, companies and governments (no dynasties or family trusts, batch 116).

Monthly, for each holder and place:

1. Collect the holder's **attributed assets** in the place (2.5.4).
2. Convert them to **weighted value** with the asset weights (2.5.2).
3. **Base share** = weighted value / place weight (2.5.3).
4. Apply the **multiplier** (origin, history, Favor, foreignness, home) (2.5.6).
5. Add **flat points** (office, origin, roll-up prominence, goodwill) (2.5.5, 2.5.6).
6. Add the current **temporary pool** (ads, psyops, sponsorships, galas) and subtract backlash (2.5.7).
7. Clamp and normalize to get the **final share** (2.5.8).
8. Check **tiers** (2.5.9) and feed **Political Capital** ([4-politics.md](4-politics.md) 4.1.2).

Steps 1 to 5 run monthly (the influence recalculation tick). Step 6 changes daily and weekly as campaigns run and decay, and the displayed share updates with it. Tiers are checked weekly.

### 2.5.2 Asset weights

| Asset | Counted value | Weight | Counted at |
|---|---|---|---|
| **Real estate** (pool holdings, 2.16) | Market value | 1.0 | The pool's province, rolling up |
| **Business assets** | Book value of a business unit's assets in that province (its asset spread, [10-industry-economy.md](10-industry-economy.md) 10.0.2) | 1.0 | The province where the assets sit (2.3.1), rolling up |
| **Jobs provided** | Yearly payroll of those business assets (the wage part of their operating costs) | 1.5 | As business assets |
| **Government bonds** | Face value | 0.5 | The country (national bonds only; there are no regional or city bonds, batch 121) |
| **Stakes in companies headquartered there** | Market value of the stake | 0.5 | The company's HQ province, rolling up. Not counted for companies the holder controls (their assets count directly instead) |
| **Media outlets based there** | Book value of the outlets ([16-media.md](16-media.md)) | 0.6 | Their province, rolling up; plus **audience**: +0.25 pp per 1% of local audience share (flat) |
| **Financial holdings booked there** | Deposits and accounts at local banks, listed securities of non-local companies held through the local exchange | 0.15 | The province of the bank or exchange, rolling up |

The 1.5 weight on payroll makes jobs the strongest influence per dollar: a labor-heavy business gives far more local power than the same value of empty real estate. This is intended: employers are courted, landlords are tolerated.

### 2.5.3 Place weight

Province weight replaces hub mass (Logan, batch 118). Every higher place is the sum of the provinces in it, so a share means the same thing at every level.

| Place | Weight |
|---|---|
| **Province** | Total development × wealth index × $0.3B (2.3.1) **(T)** |
| **City** | A Metro: the sum of its member provinces' weights. A single city province: its own weight |
| **Area** | Sum of its provinces' weights |
| **Region** | Sum of its areas' weights |
| **Country** | Sum of its regions' weights, with no cap (Logan, batch 120; the batch 119 cap at 3% of GDP is dropped) |

- **Floor rule**: a place's weight is never less than 1.25 × the total weighted assets of all modeled holders in it. This keeps assets alone from pushing any holder above 80%.
- Weights are recomputed yearly (after development changes, 2.17) and when a country's GDP moves more than 10% (through the wealth index).

Example weights **(T)**: a United States Metro core province at 75 about $79B; Bao'an-Longhua in the Shenzhen-Dongguan Metro (total 60, China 0.5) $9B; Penang $5.04B; Penang area (Penang and Seberang Perai, total 48) $8.06B; Malaysia about $60B; Alberta (7 provinces, total development 160, Canada wealth index 2.33) about $112B; California about $576B and Texas about $563B; Canada (59 provinces, total 1,084) about $757B; the United States (147 provinces, total 4,733, wealth index 3.58) about $5.1T (all from the North America slice). National weights are about 7 times the old batch 119 caps (United States $705B), so the tier thresholds drop by level (2.5.9): national Presence in the United States at 3% needs about $152B of weighted assets and Kingmaker at 20% about $1T; in Canada $23B and $151B; Presence in Alberta at 5% about $5.6B.

### 2.5.4 Holders and attribution

| Holder | Attributed assets |
|---|---|
| **Character** | Personal accounts and personal trusts, plus the companies the character really controls (1.3.1 of [1-corporate-core.md](1-corporate-core.md): the top company at 1.0, its vassals by the autonomy factor chain), plus minority stakes as stakes (weight 0.5) |
| **Company** | Its own assets plus each controlled vassal's attributed assets × autonomy factor: Wholly Integrated 1.0, Managed 0.9, Arm's Length 0.7, Independent Listing 0.5 (autonomy levels from [1-corporate-core.md](1-corporate-core.md) 1.7.2) |
| **Government** | State-owned assets; used for display and for the "public" remainder, never for tiers |

- **Which share applies to an action**: the best share among the acting holder and the character who really controls it, in the place the action targets. A company you control uses your Power broker tier for a pool purchase even if the company alone holds 8%.
- Relatives are flavor characters only: they get no share of your perks (batch 116).
- **Political Capital** is earned by the controlling character from their share, as defined in [4-politics.md](4-politics.md) 4.1.2.

### 2.5.5 Roll-up from province to country

Each level is computed with its own weight, using every asset inside it: province, then area, then region, then country.

`Share(area) = weighted assets in all provinces of the area / area weight`

`Share(region) = weighted assets in all areas of the region / region weight`

The same rule applies from regions to the country, adding country-only assets (national bonds, national media audience). The **city** share of a Metro is computed the same way over its member provinces; it sits beside the area and does not feed the region (the provinces do) **(A)**.

**Prominence bonus** (flat, added at the higher level):

| Tier held at the lower level | Bonus at the next level up | Bonus two levels up |
|---|---|---|
| Province Kingmaker | +1 pp in the area (and in its Metro, if any) | none |
| Area or city Power broker | +1 pp in the region | none |
| Area or city Kingmaker | +3 pp in the region | +1 pp in the country |
| Region Kingmaker | +3 pp in the country | none |

A Metro that spans two regions gives its city bonus to the region holding most of its weight. So a character dominating one city gets a real but modest voice in its region and country, as 05 requires.

### 2.5.6 Permanent modifiers

`Multiplier = Origin × History × Favor × Foreignness × Home`

**Origin** (born and raised, from [1-corporate-core.md](1-corporate-core.md) 1.1):

| Origin link | Province | Area | Region | Country |
|---|---|---|---|---|
| Born in the province | ×1.10 | ×1.08 | ×1.05 | ×1.03 |
| Raised in the province | ×1.15 | ×1.10 | ×1.08 | ×1.04 |
| Born and raised in the province | ×1.25 and +1 pp | ×1.18 | ×1.12 | ×1.06 |
| Born or raised in another province of the same Metro | ×1.10 | none | none | none |
| Citizen of the country | none | none | none | Removes foreignness for that character |

- A character uses their own origin.
- A **company** uses its HQ instead of origin: ×1.10 in the HQ city (the HQ province, or every province of its Metro), ×1.05 in the HQ country.
- The city share of a Metro uses the origin values of the Province column, weighted by where the holder's assets sit **(A)**.

**History** (characters and companies; presence = base share of 1% or more):

| Continuous presence | Bonus |
|---|---|
| Each year for the first 10 years | +1% per year (to ×1.10) |
| Each further 4 years | +1% (to a maximum of ×1.25 at 70 years) |
| Each year without presence | -2% (history fades, it does not reset) |

**Favor**: `1 + Favor / 500` (Favor -100 to +100 gives ×0.8 to ×1.2): the public's view of the controlling character, or of a company's CEO for a company ([1-corporate-core.md](1-corporate-core.md) 1.1.0). Under Investigation on that character: ×0.95.

**Foreignness**: `1 - type penalty - 0.10 × C1 steps past Screened`, minimum 0.2. Type penalties come from [4-politics.md](4-politics.md) 4.2.1: Liberal democracy 10%, Managed democracy 30%, One-party state 50%, Corporate oligarchy 0%, Military junta 30%, Failed state 10%. C1 steps past Screened: Capped Strategic 1, Capped All 2, Closed 3.

| Situation | Foreignness rule |
|---|---|
| Foreign character, or company with a foreign HQ | Full penalty (politics rule) |
| Assets held through a local subsidiary with a local partner of 30% or more | Penalty halved on those assets |
| Company headquartered in the country but controlled by a foreign character | The company itself has no penalty; the controlling character's roll-up takes the penalty |

**Home**: ×1.10 in the HQ city of a company, as above. (The old Legacy term is removed with dynasties, batch 116.)

**Flat points**:

| Source | Points |
|---|---|
| Political office | As listed in [4-politics.md](4-politics.md) 4.7.1 (for example Minister +3 pp and Head of Government +10 pp in the country; there are no city or regional offices, batch 121). Counts for the office holder |
| Born and raised in the province | +1 pp (province) |
| Media audience | +0.25 pp per 1% audience share |
| Prominence bonus | 2.5.5 |
| Goodwill | From sponsorships and charity (2.5.7), decays 1% per month |

### 2.5.7 Temporary boosts

Costs scale with the **place weight**, so buying influence in a Metro core or a whole country is far more expensive than in a small city province. "Per $1B" means per $1B of place weight.

| Boost | Cost | Max per campaign | Ramp | Run length | Weekly decay after it ends | Exposure risk | Other effects |
|---|---|---|---|---|---|---|---|
| **Ad campaign** | $60k per pp per 4 weeks per $1B | +5 pp | 50% in the first week, full from the second | 4 to 26 weeks, paid each 4 weeks | 25% | None (legal) | Buys media units from the local market (cost / $8,000 units); owning local media cuts cost 30%; can also push an ideology bloc's MediaBias +0.02 ([4-politics.md](4-politics.md) 4.4.5) |
| **Psyops** (bots, disinformation) | $25k per pp per 4 weeks per $1B | +10 pp | Full in 3 days | 2 to 12 weeks | 35% | Daily discovery roll (below); +5 political exposure per campaign start × surveillance multiplier ([4-politics.md](4-politics.md) 4.9.3) | Can push an ideology bloc's MediaBias +0.05 |
| **Sponsorship and charity** | $150k per pp per $1B for a 26-week package | +3 pp | Linear over 4 weeks | 26 weeks, renewable | 5% | Only if the sponsor's Favor is below -20: "washing" scandal 2% per month | +1 Favor per $5M × PF spent (max +10 per year); 25% of its pp become permanent Goodwill at the end of each package |
| **Event or gala** | $0.02 × adults in the host city (a Metro, or the province) ([4-politics.md](4-politics.md) 4.10.1); hosting is instant (batch 64) | +1 pp in the host province and the city, +0.5 pp in its area and region | Instant | 2 weeks | 50% | None; a Hedonist host has a 5% scandal chance | A push of 5 toward Friend with all city officials; the host rolls Befriend on 1 to 3 attending elite characters at Persuasion × 2% each; the host gains +1 Clout; 1 gala per city per month |

**Rules:**

- **Effectiveness**: bought pp × `(0.8 + director's Persuasion / 75)` for ads, sponsorships and galas; × `(0.8 + director's Intrigue / 75)` for psyops (×0.8 to ×1.2). The director is the character assigned to run the campaign.
- **One of each**: a holder can run one campaign of each type per place at a time.
- **Competition**: if two or more holders run campaigns in the same place, each one's temporary pp are ×0.8.
- **Cap (assets come first)**: total temporary pp in a place ≤ the larger of 6 pp or the holder's base share in pp. A holder with no assets can reach 6% at most: enough for a foothold, never for Presence alone.
- **Anchoring ("backed by real assets")**: temporary pp up to 50% of the holder's base share decay at half the normal rate.
- **Decay timing**: while a campaign runs its value is held (ramp updates daily). After it ends, decay applies at each weekly step. Values below 0.2 pp drop to 0.

**Psyop discovery.** Rolled daily for each active psyop:

`Daily chance = (0.2% + 0.03% × active psyop pp) × surveillance multiplier × (1 - director Intrigue / 60) × 1.5 if a rival runs Investigate or Dig Up Dirt on you`

Surveillance multiplier from T4 ([4-politics.md](4-politics.md) 4.5.6): Limited 0.8, Expanded 1.0, Mass Surveillance 1.5, Social Credit 2.0.

On discovery:

| Effect | Value |
|---|---|
| Psyop pp in that place | Removed at once |
| Backlash | A negative temporary pool of 2 × the removed pp, decaying 10% per week |
| Favor | -10 for the controlling character (-20 if an election is under way in that jurisdiction) |
| Exposure | +15 with the Financial Police and the Data Authority |
| Liberal democracy | 30% chance an investigation chain opens |
| One-party state, military junta | The regime treats it as hostile: foreign holders advance one step on the seizure ladder ([4-politics.md](4-politics.md) 4.9.10); domestic holders give the regime a hook over the director |

### 2.5.8 Final share

`Final share = clamp(Base share × Multiplier + Flat points + Temporary pp + Goodwill - Backlash, 0, 95)`

**Normalization**: if the final shares of all top-level holders in a place (controlling characters, independent companies, governments and the unmodeled public) add up to more than 100%, every one is scaled down in proportion. Companies a character controls are not added separately for this check.

### 2.5.9 Tiers and hysteresis

| Tier | Province and city | Area and region | Country | Gained | Lost |
|---|---|---|---|---|---|
| **Presence** | 10% | 5% | 3% | At a weekly check with final share at or above the level's threshold | After 4 weekly checks in a row below 80% of the threshold (8%, 4%, 2.4%), or 13 in a row below the threshold |
| **Power broker** | 25% | 15% | 8% | At a weekly check at or above the threshold | After 4 weekly checks in a row below 92% of the threshold (23%, 13.8%, 7.4%), or 13 in a row below the threshold |
| **Kingmaker** | 50% | 30% | 20% | At a weekly check at or above the threshold | After 4 weekly checks in a row below 96% of the threshold (48%, 28.8%, 19.2%), or 13 in a row below the threshold |

Tiers apply separately in each province, city, area, region and country (Logan, batch 118). Thresholds drop by level **(T)** (Logan, batch 120): a region or country weighs the honest sum of its provinces, so the same share there takes far more assets, and the lower thresholds keep regional and national influence reachable. The band below each threshold is the province band (2 pp) scaled by the level's threshold, so it is a fixed fraction of the threshold: 20% of it for Presence, 8% for Power broker and 4% for Kingmaker **(T)**. The band stops tiers flickering when a campaign decays. The 13-week (one quarter) rule means a tier won with a campaign must be backed by assets within a quarter or it is lost.

### 2.5.10 Perks by tier and level

Provinces and areas give **economic perks only**. Political perks start at the **city**: a Metro, or a single province ranked City or Metropolis. Towns and rural provinces have no city level. No place below the country has a government (Logan, batch 121), so every city and region perk works through **national officials**: the ministers who decide about the place ([4-politics.md](4-politics.md) 4.3.5), national legislators elected there, and national tenders for work there **(A)**. Each place where a holder has a tier also adds local standing PC to the country pool (4-politics 4.1.2). Old district perks are now province perks; old hub perks are city perks (Logan, batch 118). Each tier is reached at its level's threshold (2.5.9): 10/25/50% in a province or city, 5/15/30% in an area or region, 3/8/20% in a country **(T)**.

| Tier | Province | City (Metro or city province) | Area **(A)** | Region | Country |
|---|---|---|---|---|---|
| **Presence** | New construction in the province's real estate pools shown 3 days early (2.16.2) | All province perks in every province of the city; land development time in the city's pools -15% (2.16.2); Meet Official costs 0 PC once per week with a national legislator elected in the city | All province Presence perks in every province of the area | Meet Official free once per week with a national legislator elected in the region | Meet Official with ministers free once per week; Foreign Investment Review time -25% |
| **Power broker** | First refusal on new construction in the province's pools: 7 days to buy at the pool price +5% | First refusal on new pool construction city-wide and on national tenders for services in the city; one Request Decision for rezoning per quarter at 0 PC, to the Minister of Land and Housing (automatic approval under E11 Developer-Led); land development time a further -15%; one property tax deal per year (E10 -25% on own real estate for 5 years, as a Request Decision); S2 Privatized policing contracts in the city's provinces can be requested from the Interior Minister; unlocks the **Political Connections** founding path ([1-corporate-core.md](1-corporate-core.md) 1.6.7) | First refusal on new construction in every province of the area; land development time in the area -10% | Bid score +10 on national contracts for projects in the region; priority for new infrastructure projects in your provinces | Eligible for E6 subsidies without a tender; national contract bid score +10; national lobby points +25%; meetings with the central bank governor and regulator heads |
| **Kingmaker** | Veto a rival's real estate purchase in the province (10 PC) | Veto a rival's pool purchase, land development or acquisition in the city (20 PC; the rival can override with 40 PC or a court case); disposition +10 with national ministers on decisions about the city's provinces (4-politics 4.3.5); +0.3 Candidate utility for national candidates you back in constituencies inside the city ([4-politics.md](4-politics.md) 4.6.3); bid score +20 on national contracts for services in the city | Veto a rival's real estate purchase anywhere in the area (15 PC; override with 30 PC) | Disposition +5 with national ministers on decisions about the region's provinces; +0.2 Candidate utility for backed national candidates in constituencies in the region; veto a rival's real estate purchase anywhere in the region (30 PC; override with 60 PC) **(T)** | Appointment score +30 for one minister or regulator head per year; +0.15 Candidate utility for backed national candidates; one tariff or subsidy change per year handled as a Decision instead of a Law; national Request Protection cost halved; seizure risk on your foreign-held assets in the country -1 point |

Kingmaker in a city (a Metro or a city province) for 12 months is also the first requirement of corporate sovereignty ([4-politics.md](4-politics.md) 4.12.2).

### 2.5.11 Tooltip breakdown

Every share shows its lines, for example (Penang, controlling character):

```
Weighted assets in Penang           $354M
Place weight                        $5.04B
Base share                          7.02%
  × Origin (born and raised)        ×1.25
  × Foreignness (halved)            ×0.95
  × History (3 years)               ×1.03
  × Favor (+20)                     ×1.04
Flat: born and raised               +1.00
Temporary: ad campaign              +4.00
Temporary: gala                     +1.00
Final share                         14.9%  (Presence)
```

## 2.6, 2.7, 2.9 to 2.13 and 2.15: the economy (moved)

The economy is industries, business units and corporations, Wall Street Raider style: see [10-industry-economy.md](10-industry-economy.md) 10.0. The old goods (2.6), production methods (2.7), hub prices (2.9), supply contracts (2.10), disruptions (2.11), tech tree (2.12), financial statements (2.13) and competition (2.15) sections are gone; population stays in 2.8 and the influence worked examples in 2.14.

**Climate, pollution and infrastructure (Logan, batch 75).** These are not systems. Infrastructure is not an asset class, and climate shows up only as events (storms, heat waves, floods) that hit provinces and business units, with odds set by terrain (2.3.1) ([13-events.md](13-events.md)).

---

## 2.8 Population and labor

### 2.8.0 Strata (Logan, 2026-10-17)

**Strata are income levels, not character classes**. Five strata, bottom to top: Permanent Underclass, PMC, Glitterati, Nobles, Oligarchs (Victoria 3 calls them strata). Every named character has a stratum set by their **character resources**: assets, Clout, income and vril ([1-corporate-core.md](1-corporate-core.md) 1.1.0). Population segments (2.8.1) also sit in a stratum.

| Stratum | Who is in it (Logan) | Population segments **(A)** |
|---|---|---|
| **Permanent Underclass** | People stuck unable to get the money together to gather assets, caught in a debt spiral. Underpaid and underemployed. Docile if their **slop** needs are met | Unskilled Workers, Gig Workers, Unemployed |
| **PMC** (professional-managerial class) | From skilled union labor to yuppies and low-level executives, doctors, any wagie with a normie job, and high achievers in many low-profile fields | Skilled Workers, Professionals |
| **Glitterati** | High-level executives, influencers, athletes. Named characters with skill ratings in fields that boost the organizations, companies or firms they are affiliated with. Often rich in assets, but rarely have the skills to leverage Techno-Capital, so they don't buy it | Elite |
| **Nobles** | People who by bloodline will always have clout or influence. They do not necessarily have or pursue assets, but can be very rich, and ruthless in guarding the influence they have amassed. | None (named characters only) |
| **Oligarchs** | The top stratum. At least a board seat on one monopoly or $1 billion in assets, plus a certain amount of Techno-Capital (Logan) | None (named characters only) |

**How a character's stratum is set (Logan).** Various factors, but mainly **assets, capital and income**. Each stratum has its own criteria, such as a certain amount of assets or of Techno-Capital. Example: an **Oligarch** must at least sit on the board of one monopoly or hold assets totaling $1 billion, and must control a certain amount of Techno-Capital. **Strata, bottom to top (Logan):** Permanent Underclass, PMC, Glitterati, Nobles, Oligarchs. The bars for each are still to be set.

**Slop (Logan, 2026-10-17).** The Permanent Underclass has **one need: slop**. Slop is a **byproduct of every company's production**: the trickle-down of freemium goods, ad-funded apps, junk content and the like.
- Slop is **not sold**. It is passively consumed from the production in an area (the map's area layer, 2.2.1), and it **cannot be imported or exported** **(A)**.
- **Too little slop** and the population of the area grows unstable.
- **Too much slop** (a surplus) and education, health and the birth rate start to suffer.

Slop rules:
- **Companies do not choose how much slop they make** (Logan). Each industry has a **slop rate** per $1M of revenue ([10-industry-economy.md](10-industry-economy.md) 10.3). An area's slop output is the sum over every business unit with assets in the area's provinces of its revenue there × its industry's slop rate.
- **Slop need** = Underclass population in the area (millions) × 100,000 per month **(T)**.
- **Slop ratio of the area** = output ÷ need. A Metro pools slop over all its member provinces instead, across area borders **(A)**.

| Slop ratio | Effect on every province of the area **(T)** |
|---|---|
| Below 0.8 | Underclass unrest +1 per month for every 0.1 below 0.8 |
| 0.8 to 1.2 | Stable: Underclass unrest held at its floor |
| Above 1.2 | Surplus: for every 0.1 above 1.2, education quality -1%, health -1% and birth rate -1% per year |

**Debt spiral (A).** A PMC member whose savings go negative for 6 months **(T)** drops into the Permanent Underclass. Climbing back needs 12 months **(T)** of positive savings plus a PMC job. Named characters can fall the same way (Samir Haddad starts in it; John Techno, a COO on $1M a year, starts well clear of it).

**Glitterati fields (A).** Each Glitterati character rates 1 to 20 in one or two fields (Management, Media, Sport, Entertainment, Fashion, Law, Medicine). Affiliation (an executive post, an endorsement, a board seat) gives the organization a bonus of 1% per rating point in matching work **(T)**. Glitterati get a -5 penalty to Techno-Capital allocation checks **(T)**.

**Noble standing (A).** Nobles are set at game start for named characters, with a large Clout start. There is no inheritance (batch 116): a Noble whose Clout falls below the bar **(T)** drops to the stratum their assets and income give.

### 2.8.1 Segments

Population is tracked per province as six segments of the labor force (half the province's population). Wages are monthly at WI 1.0 and are multiplied by the country's WI and the local tightness factor (2.8.4).

| Segment | Stratum (2.8.0) | Base wage | Spending share of disposable income | Leading ideologies ([5-ideology.md](5-ideology.md) 5.4.1) | Main unrest drivers |
|---|---|---|---|---|---|
| **Elite** | Glitterati | $60,000 (mostly capital income; executives are characters) | 40% | Liberals, Accelerationists, Sovereigntists | Wealth taxes, expropriation, instability, crime |
| **Professionals** | PMC | $8,500 | 65% | Liberals, Chuds, Effective Altruists, Transhumanists | AI automation of office work, housing costs, privacy, inflation |
| **Skilled Workers** | PMC | $5,200 | 75% | Chuds, Liberals, Communists | Automation, plant closures, wage cuts, imports |
| **Unskilled Workers** | Permanent Underclass | $3,100 | 90% | Chuds, Liberals, Communists | Unemployment, energy prices, rent |
| **Gig Workers** | Permanent Underclass | $2,300 | 95% | Communists, Liberals, Chuds | No benefits, price spikes, platform pay cuts |
| **Unemployed** | Permanent Underclass | Benefits by law (default 30% of the Unskilled wage) | 100% | Chuds, Communists, Liberals | All of the above, plus crime and black markets |

- **Disposable income** = wage × (1 - effective income tax). Effective tax = E1 top rate × segment factor: Elite 0.8, Professionals 0.6, Skilled 0.45, Unskilled 0.3, Gig 0.2, Unemployed 0.
- **Unemployed keep a skill tag** (former Professional, Skilled or Unskilled) so they can be rehired into the right jobs.

### 2.8.2 Needs

The game is an alternate reality a little more futuristic than ours. Basic necessities such as food and clothing are always met and so oversaturated that there is no real market for them (Logan). **Population needs are spending on consumer industries** ([10-industry-economy.md](10-industry-economy.md) 10.3, strata spending):

- The **Permanent Underclass** needs only slop (2.8.0).
- The **PMC** needs housing, energy and healthcare, met by real estate, power utilities and healthcare services.
- Higher strata spend on consumer and luxury industries.

**Needs satisfaction** (0 to 1) is the share of a segment's needs that its spending covers in the province. It feeds unrest (2.8.5) and migration (2.8.4). Money left over is **saved** into deposits in the province (banks, [3-markets-and-fx.md](3-markets-and-fx.md) 3.17).

### 2.8.3 Default segment mix

Share of the labor force (%) by country income tier, then adjusted by city type (applied to every province of the former hub's Metro or city province; other provinces use the tier row alone).

| Income tier | Elite | Professionals | Skilled | Unskilled | Gig | Unemployed |
|---|---|---|---|---|---|---|
| High (WI ≥ 0.6) | 1 | 28 | 25 | 22 | 16 | 8 |
| Middle (WI 0.2 to 0.6) | 1 | 15 | 25 | 32 | 15 | 12 |
| Developing (WI < 0.2) | 0.5 | 7 | 15 | 40 | 22 | 15.5 |

| City type adjustment | Change in points |
|---|---|
| Global finance city (New York, London, Hong Kong, Singapore, Zurich) | Elite +1, Professionals +8, Skilled -4, Unskilled -5 |
| Tech city (Bay Area, Bengaluru, Hsinchu-Taipei, Tel Aviv) | Professionals +10, Skilled +2, Unskilled -8, Gig -4 |
| Industrial city (Shenzhen-Dongguan, Ho Chi Minh City, Penang, Mexico City) | Skilled +6, Unskilled +6, Professionals -6, Gig -6 |
| Resource town (any province with a mineral, Oil or Gas tag and Industry as its largest track, such as Antofagasta, Kolwezi-Lubumbashi, Baotou, Perth-Pilbara, Dhahran-Dammam) | Unskilled +10, Skilled +4, Professionals -6, Gig -8 |
| Metro with a large slum share (Lagos, Cairo-Suez, Mumbai, Jakarta) | Gig +6, Unemployed +4, Skilled -5, Professionals -5 |

### 2.8.4 Hiring, wages, training and migration

- **Local wage (monthly)**: `Wage = base wage × WI × tightness`, where `tightness = clamp(1 + 2 × (employment rate of the segment - 0.95), 0.85, 1.6)`. Wages move at most 3% per month (sticky), except for one-off law effects (L2 Sectoral Bargaining +8%). L1 Minimum Wage sets a floor as a share of the province's median wage.
- **Training programs** (company action, in payroll dollars: business units have no worker counts): moving $1M of a unit's yearly Unskilled payroll in the province to Skilled costs $0.32M × WI over 6 months (85% complete); Skilled to Professional costs $0.65M × WI per $1M of payroll over 24 months **(T)**.
- **Natural education (yearly)**: 1% of Unskilled become Skilled; 0.5% of Skilled become Professionals.
- **Migration (monthly)**: inside a country, 0.5% of a segment moves to the province where `wage × needs satisfaction` is 20% or more higher. Between countries, migration follows L5 Immigration ([4-politics.md](4-politics.md) 4.5.5).
- **Population growth (yearly)**: developing 2%, middle 1%, high income 0.3% (T).

### 2.8.5 Unrest

Unrest (0 to 100) is tracked per segment per province. Monthly:

```
Target unrest = segment offset
              + 50 × (1 - needs satisfaction)
              + 1.5 × max(0, local unemployment% - 6)
              + 1.2 × max(0, inflation% - 4)                (12 months, local currency)
              + 0.5 × max(0, real wage fall% over 12 months)
              + 3 × automation layoffs in the segment over 12 months, as % of the segment
              + law terms ([4-politics.md](4-politics.md): L2 Banned +5, S2 Militarized +3, Community -3, Carbon Pricing rebate -2, E11 Developer-Led +3 in provinces with a slum share of 10% or more)
              + 5 if an ideology bloc the segment leans to is Angry (4.4)
              + event modifiers (a strike crushed by force +10, price controls on essentials -2)
              - 5 if union contracts cover 50% or more of the segment's jobs in the province
```

Segment offsets: Elite 5, Professionals 10, Skilled 10, Unskilled 13, Gig 15, Unemployed 25.

**Actual unrest moves 25% of the way toward the target each month.** Province unrest (population-weighted, then summed to the country) feeds the politics stability formula ([4-politics.md](4-politics.md) 4.11.7).

| Unrest | Band | Effects |
|---|---|---|
| 0 to 24 | Calm | none |
| 25 to 39 | Restless | Ad campaign effectiveness -10% in the province |
| 40 to 59 | Agitated | Strike checks active; protests; output of business units with assets in the province -3% |
| 60 to 79 | Radical | Riot chance 5% per month (retail closed 3 days); output -8%; real estate pool prices in the province -1% per month |
| 80 to 100 | Insurrection | Output -20% in the province; feeds revolution pressure ([4-politics.md](4-politics.md) 4.8.5) |

### 2.8.6 Unions and strikes

**Organization** (O, 0 to 100) is tracked per working segment per province (Professionals, Skilled, Unskilled, Gig). Monthly change:

```
ΔO = 0.1 × (unrest - 30)
   + L2 term: Banned -3 (O capped at 20), Restricted -1, Recognized 0, Sectoral Bargaining +2
   + 1 if one employer's yearly payroll for the segment in the province is $100M × WI or more (T)
   + 1 per strike won in the province in the last 12 months
   - 2 if the segment's wages are 110% or more of its province average at the big employers
   - 1 for Gig workers under L4 Contractors (dispersed workforce)
```

**Union recognition**: in a business unit whose yearly payroll for a segment in the province is $10M × WI or more (T), when the province's O for that segment is 35 or more, a union forms with 10% chance per month (×2 after a layoff wave). A **union contract** follows a recognition event: wages +5%, layoffs need 3 months' notice and double severance, and automation triggers a negotiation event.

**Strike checks** (unionized business units, per province):

| Check | Chance |
|---|---|
| Monthly | `max(0, (unrest - 35) / 100) × (O / 100) × law factor`; law factor: Restricted 0.5 (0 in strategic sectors), Recognized 1.0, Sectoral Bargaining 1.2 |
| Immediate vote: automation or layoffs above 10% of the unit's payroll in the province | `0.25 + 0.5 × O / 100` |
| Immediate vote: wage cut | `0.15 + 0.5 × O / 100` |
| Immediate vote: fatal accident | 0.30 |
| Immediate vote: union leader fired | 0.50 |

**During a strike**: the striking segments stop; the unit's output in the province runs at ×0.1 if only some segments strike and ×0 if all do. Strikers are not paid; upkeep and other wages continue.

**Union resolve** (R) starts at `20 + O / 2` and changes daily:

| Daily change | Value |
|---|---|
| Base | -2 |
| Lockout by the company | -1 more |
| Public support (the company CEO's Favor below 0, or Communist bloc clout 20% or more in the country) | +0.5 |
| Strike fund financed by anyone (Fund Ideology for the Communists, [4-politics.md](4-politics.md) 4.10.1) | +0.5 |
| Replacement workers hired | -2 |

The strike ends when R reaches 0 (workers return; segment unrest +5; O -10) or when the company accepts the demands.

**Demands** (1 to 3 rolled): wages +5% to +15%; cancel or delay automation by 12 months; rehire laid-off workers; double severance; safety spending.

**Company options** (event):

| Option | Result |
|---|---|
| Concede | Demands met; union O +5; segment unrest -5 |
| Negotiate | Success chance `40% + (negotiator's Persuasion or Operations - 10) × 3% + 10% if the CEO's Favor > 20`. Success: half the demands. Failure: strike continues, R +10 |
| Lockout | Output 0; R falls faster; CEO Favor -5; segment unrest +5 |
| Hire replacements (where labor law allows) | Productivity 60% in the first month; riot chance 15%; union O +5 |
| Security crackdown (corporate security) | R -30 at once; CEO Favor -15; segment unrest +10; riot chance 25%; investigation chance 20% in liberal democracies |
| Close the operation in the province | Layoffs with severance; strike ends; unrest from layoffs |

**Spread**: under Sectoral Bargaining a strike spreads to each unionized business unit of the same industry in the country with 30% chance. A sympathy strike hits same-industry units in the province (or anywhere in its Metro) with 20% chance when O ≥ 60. A **general strike** happens when province unrest is 70 or more and Skilled or Unskilled O is 60 or more: every business unit's output in the province runs at ×0.5 for 3 to 10 days, and it spreads to each other province of the same Metro with 50% chance **(T)**. Typical strikes last 5 to 40 days. **Port strikes** cut the output of Shipping and Logistics units in the province to ×0.2.

---

## 2.14 Worked examples

Influence examples. All numbers use the tuning values above. Rounding is to the nearest useful digit.

### 2.14.1 Getting Presence in Penang

**Setup.** Penang is a single city province (the former Penang hub; Kulim is abstracted in): Commerce 5, Industry 11, Population 14 (1.8M people), total 30, resource tag None, Urban, coastal. Malaysia: liberal democracy, C1 Screened, WI 0.25, PF 0.475, wealth index 0.56. A US character controls a flagship whose wholly integrated Malaysian subsidiary (with a 30% local partner) has a Semiconductors business unit (assembly and test) with $180M of business assets in Penang, where Industry is the largest track (fit bonus +2%). The character was born and raised in Penang but holds only US citizenship. The subsidiary also bought $75M of Penang's Residential pool, $45M of its Industrial pool and a $60M stake in a Penang-headquartered company. The character's Favor is +20, with 3 years of presence.

**Assets.**

| Item | Value | Weight | Weighted |
|---|---|---|---|
| Business assets (assembly and test) | $180M | 1.0 | $180M |
| Jobs: payroll of those assets, $1.33M per month, $15.9M per year | $15.9M | 1.5 | $23.85M |
| Residential pool share | $75M | 1.0 | $75M |
| Industrial pool share | $45M | 1.0 | $45M |
| Stake in a Penang-headquartered company | $60M | 0.5 | $30M |
| **Total** | | | **$353.85M** |

**Share.** Penang weight = 30 × 0.56 × $0.3B = $5.04B. Base share = 353.85 / 5,040 = **7.02%**. (Batch 119: the holdings are 30% of the batch 118 version, matching the lighter weight, so the lesson is unchanged: the $1,180M of weighted assets of the old example would now give a 23.4% base share and Power broker, 30.8% final, without any campaign.)

Multiplier = origin 1.25 (born and raised) × foreignness 0.95 (Liberal democracy 10% penalty, halved by the 30% local partner) × history 1.03 × Favor 1.04 = **1.272**. 7.02% × 1.272 = 8.93%, plus 1 pp flat for born and raised = **9.93%**. No tier yet. Penang is a single city province, so its province share is also its city share.

**Campaign.** Temporary cap = max(6, 7.02) = 7.02 pp. An ad campaign of 4 pp costs 4 × $60,000 × 5.04 = **$1.21M per 4 weeks**; a hired director runs it (Persuasion 15, effectiveness 1.0). The character also hosts a gala: 1.4M adults × $0.02 = **$28,000**, +1 pp for 2 weeks, a push of 5 toward Friend with Penang's national legislators and one minister who attends, and two Befriend rolls at 30%.

Final share = 9.93 + 4 + 1 = **14.9%: Presence** at the next weekly check, in the province and the city. Penang has no government of its own (batch 121), so it has no PC pool: its city Presence adds 2 PC per month of local standing to the character's Malaysian pool ([4-politics.md](4-politics.md) 4.1.2). The character now sees new construction in Penang's pools early, develops land there 15% faster and gets a free weekly meeting with a national legislator elected in Penang.

**Keeping it.** The ad runs 8 weeks ($2.42M). After it ends, 3.5 pp (half the base share) is anchored and decays at 12.5% per week, the rest at 25%. The share stays at 10% or more for about 21 weeks, until the anchored points drop below 0.2 pp and vanish; it then sits just under 10%, and Presence is lost 13 weekly checks later. To keep it for good the character adds assets: growing the Penang Semiconductors assets by another $90M (plus $18M of jobs weight at $12M of payroll) lifts the base share to 9.16% and the final share to 9.16 × 1.272 + 1 = **12.7%** without any campaign.

**Roll-up.** Penang's area is Penang and Seberang Perai (total development 48), which is also the whole Penang state (region): weight $8.06B. Area and region share = 353.85 / 8,064 = 4.39% × (1.18 × 0.95 × 1.03 × 1.04 = 1.20) = **5.3%**: **Presence** in the area and the region, whose threshold is 5% (batch 120). Malaysia weighs the sum of its provinces, about $60B, with no cap (batch 120). Country share = 353.85 / 60,000 = 0.59% × 1.079 = **0.64%**, worth 8 PC per month nationally, plus 2 local standing PC each for Presence in the city, the area and the region: **14 PC per month** in Malaysia once the campaign has won city Presence. National Presence (3%) would need about $1.67B of weighted assets in Malaysia at this multiplier.

### 2.14.2 A foreign subsidiary tries to buy a foothold in Shenzhen

**Setup.** The same character's flagship sets up a subsidiary in the Shenzhen-Dongguan Metro (China: one-party state, C1 Capped All, restriction label Restricted, so a 30% local partner is required; T4 Mass Surveillance; wealth index 0.5). The subsidiary is 70% flagship, 30% a Shenzhen family (local partner loyalty 65). It runs a Consumer electronics business unit (smartphone assembly) with $130M of business assets in Bao'an-Longhua, an industrial member province of the Metro (Commerce 10, Industry 28, Population 22, total 60).

**Assets.** Business assets $130M. Jobs: payroll $2.5M per month = $30M per year, × 1.5 = $45M. Total weighted: **$175M**.

**Shares.** Bao'an-Longhua weight = 60 × 0.5 × $0.3B = $9B. (Batch 119: the holdings are 30% of the batch 118 version, matching the lighter weight; the old $583M would now give the subsidiary 7.1%, and with a 6.5 pp psyop it would reach Presence on a campaign, which the cap is meant to make rare.)

| Holder | Calculation | Share |
|---|---|---|
| Subsidiary (HQ in the Metro, not foreign) | 175 / 9,000 = 1.94% × home 1.10 | **2.14%** |
| Controlling character (foreign) | 175 × 0.9 (Managed autonomy) = 157.5 → 1.75% × foreignness | **1.14%** |

Character foreignness: 1 - 0.50 (one-party) - 0.20 (Capped All is 2 steps past Screened) = 0.30; halved penalty for subsidiary assets with a 30% partner gives 1 - 0.35 = 0.65.

**Psyops.** The player wants Presence in the province fast and runs the maximum psyop the cap allows: max(6, 1.94) = 6 pp, at 6 × $25,000 × 9 = **$1.35M per 4 weeks**, directed by a fixer with Intrigue 15. Subsidiary share = 2.14 + 6 = **8.14%**: still not Presence. Temporary boosts alone never reach a tier.

**Risk.** Daily discovery = (0.2% + 0.03% × 6) × 1.5 × (1 - 15/60) = **0.43% per day**: 11% over 4 weeks, 30% over 12 weeks. Political exposure +5 × 1.5 = +7.5 at campaign start. If discovered: the 6 pp vanish, backlash of -12 pp decaying 10% per week (the share is clamped at 0), Favor -10, exposure +15, and the regime advances the seizure ladder to Step 1: *Beijing Calls* demands the local partner's stake rise to 40%.

**Better play.** Let the local partner's family (14% share in Bao'an-Longhua, Presence, Shenzhen-born) buy into pools and meet officials; keep partner loyalty at 60 or more (seizure risk -0.5 points). The monthly seizure risk is 0.3 (one-party) + 30/50 (relation -30 with the United States) - 0.5 = **0.4% per month** ([4-politics.md](4-politics.md) 4.9.10).

---

## 2.16 Real estate (Logan, 2026-10-17)

Real estate is the most direct asset-as-title in the game: it holds value, pays rent and buys local influence (2.5.2). It is **pooled**: there are no individual plots or buildings to pick. Each **province** (2.3.1) holds four **pools**, and holders own a dollar share of a pool. Districts are gone (Logan, batch 118).

### 2.16.1 Pools (Logan: four types per province)

| Pool | What it is | Rented by |
|---|---|---|
| **Commercial** | Offices, retail, hotels, labs | Company headquarters, offices, retail and services |
| **Residential** | Housing, including a **slum share** of informal housing (2.16.6) | Population (rent from residents by stratum, 2.8.0) |
| **Industrial** | Plants, fabs, warehouses, data center shells, ports, mines' surface works | Business units in heavy and technical industries: Semiconductors, Data centers, Power utilities, Oil, Chemicals and the like |
| **Land** | Undeveloped land, including resource land in provinces with a resource tag | Nobody; it is held for appreciation and for development |

**Starting pool sizes (T)** come from the province's development and population, scaled by the country's PF:

| Pool | Size at PF 1.0 |
|---|---|
| **Commercial** | $0.1B × Commerce² |
| **Industrial** | $0.06B × Industry² |
| **Residential** | $8,000 × population |
| **Land** | $2B + $0.05B × total development; ×2 in a province with a resource tag other than None |

Examples: a United States Metro core at Commerce 30, Industry 15 and Population 16 (3M people) has Commercial $90B, Industrial $13.5B, Residential $24B, Land $5B. Penang (PF 0.475) has Commercial $1.2B, Industrial $3.4B, Residential $6.8B, Land $1.7B. A United States rural Farmland province at Commerce 1, Industry 3, Population 2 (0.1M people) has Commercial $0.1B, Industrial $0.5B, Residential $0.8B and Land $4.6B.

At the start each pool is owned by dispersed small owners (40% to 70%), governments (10% to 30%) and AI property funds and rival characters (the rest) **(T)**.

### 2.16.2 Growth and development (T)

- Pools grow each year with the province: residential by its population growth rate (2.17.1), commercial and industrial toward the sizes their tracks give when Commerce or Industry rises (2.17.2).
- **New construction events** add to a pool (a new tower, a rezoned industrial park), sold first to whoever funds them.
- **Developing land**: a holder of a Land pool share can convert it into Commercial, Residential or Industrial in the same province by paying a build cost (1.5× the land value converted, 12 to 24 months **(T)**). The new share lands in the target pool at its current price, so development pays when the target pool is pricier than land plus build cost.

### 2.16.3 Price, occupancy and rent

Each pool has a price index, 100 at the start. Each month **(T)**:

`change = cycle drift (2.16.5) + 0.3 × (occupancy - 90%) - rate sensitivity × change in the country's policy rate`

- **Cycle drift** follows the property cycle of the province's Metro or city (2.16.5; Boom +1% to +2.5% a month, Bust -1% to -3%).
- **Occupancy** = rental demand ÷ the pool's rentable stock. Demand comes from residents (residential), business units (commercial and industrial) and nothing for land.
- **Rate sensitivity**: residential 3, commercial 2, industrial 1.5, land 4 (a 1-point rate rise cuts land 4%) **(T)**.
- The owner chooses what share of each holding to rent out (Logan). The rented share earns the pool's rent rate; the rest earns nothing but appreciation.
- **Rent rate** = base yield × (rental demand ÷ available stock)^0.5 **(T)**, with base yields: commercial 5%, residential 4%, industrial 6%, the slum share of residential 9% (+1 unrest in the province per $100M rented), land 0.
- **Renting space for a business unit**: a business unit rents from the commercial or industrial pool of the province where its assets sit (heavy and technical industries need Industrial; offices and retail need Commercial). Its rent is the pool's rent rate on the value it occupies, paid to the owners who rent out their shares, in proportion.
- **Buying the space**: a corporation that buys the space for its business unit buys that much of the pool; it sits on the balance sheet and appreciates.
- If a province's pool has no available stock, a business unit must rent in another province (any province of the same Metro or area works at no penalty **(A)**), buy out owners at a premium, or develop land.

### 2.16.4 Buying and selling (Logan)

- Buy **any dollar amount** of a pool at its current price, plus 2% fees **(T)**.
- Selling is instant up to the pool's monthly turnover (2% of the pool in Boom and Peak, 1% in Recovery, 0.5% in Bust **(T)**); larger sales queue and fill week by week, so selling in a slump can take weeks or months. Selling at once costs a 15% discount.
- Holdings count toward influence in their province (2.5.2) by value, rolling up.

### 2.16.5 Property cycles

Each **Metro** and each **city province** outside a Metro has one **property cycle** with four phases, updated monthly; every member province of a Metro shares it (Logan, batch 118). Towns and rural provinces follow the cycle of the largest city in their region (or country, if the region has none) **(A)**.

| Phase | Value change per month | Occupancy | What drives it |
|---|---|---|---|
| **Boom** | +1.0% to +2.5% | 95% to 100% | Population growth, cheap credit, foreign buyers |
| **Peak** | 0% to +0.5% | Falling | Oversupply from new construction, rate rises |
| **Bust** | -1.0% to -3.0% | 75% to 90% | Rate rises, recession (2.18), unrest, disasters |
| **Recovery** | 0% to +1.0% | Rising | Cheap assets, rate cuts |

Phase changes are rolled monthly; the chance to move on rises with each month in the phase and with the drivers (for example, each 1 point rise in the policy rate adds +5% chance of Boom moving to Peak). A **bubble** forms when a Boom lasts over 36 months: values gain an extra +1% per month, and the eventual Bust is twice as deep.

### 2.16.6 Gentrification and slum clearance

Slums are no longer districts. Each province's Residential pool has a **slum share** (0% to 100%): the part of its housing that is informal, renting at the slum yield and housing Gig and Unemployed segments first. At start the slum share is the old Slums districts' share of the former hub's districts, and a country default elsewhere (High income 0%, Middle 5%, Developing 20%) **(T)**. Gentrification and clearance are shifts in the pool mix and development (Logan, batch 118):

- **Gentrification**: a province with a slum share whose residential pool price rises over 50% in 5 years rolls yearly (30%). On success the slum share falls 10 points, Commerce +1 (2.17.2), and Gig and Unemployed are pushed to another province (or out of the city); unrest +10 in the province for a year.
- **Slum clearance** (the national government can push it, or a city Power broker through a Request Decision to the Minister of Land and Housing): the slum share falls 25 points and that part of the Residential pool becomes Land, whose price rises ×3 over 2 years; residents displaced (+15 unrest; the Communist bloc's approval falls).
- **Slum spread**: a province with unrest over 60 for 2 years and falling residential prices gains 10 points of slum share and loses 1 Commerce.

### 2.16.7 Tax (Logan: own rates)

Each country sets property tax on value (0.2% to 2% a year), tax on rent income (at its income or corporate rate) and tax on gains when sold (0% to 30%), with land taxed highest where a vacancy or land-value tax law applies ([4-politics.md](4-politics.md) E10) **(A)**.

## 2.17 Development change and city growth

Provinces grow, decline and change over decades. Hub size classes, new districts and new hubs are replaced by development change: any province can grow into a City or a Metropolis, and growing neighbours can merge into a Metro (Logan, batch 118). Players cannot buy development directly, only through what they build and employ.

### 2.17.1 Population change (yearly)

```
Growth % = natural growth (country value, -0.5% to +2.5%)
         + job pull: 2% × (jobs available - labor force) / labor force
         + wage pull: 1% × (province average wage / national average wage - 1)
         - housing squeeze: 1% per 10% that housing cost exceeds 30% of Professional income
         - unrest push: 0.5% per 10 points of province unrest above 40
         - disaster and war losses
```

Migration between provinces follows the same terms: workers move from low-scoring provinces to high-scoring ones in the same country (and across borders when L5 Immigration is Managed or Open). The Population track is recomputed from the new population (2.3.1).

### 2.17.2 Commerce and Industry change (yearly) (T)

Each track has a target set by what sits in the province:

`Commerce target = 2 + 3 × log2(1 + (Commerce-fit business assets + Commercial pool value) / ($0.5B × PF))`, capped at 30

`Industry target = 2 + 3 × log2(1 + (Industry-fit and resource business assets + Industrial pool value) / ($0.5B × PF))`, capped at 30

Payroll counts too: business assets above count their yearly payroll × 1.5, as in influence (2.5.2). Each year a track moves 1 point toward its target (2 points when the gap is 5 or more). On top of that:

- unrest of 60 or more for the year: -1 to every track;
- a major disaster or war damage: -1 to -3 to Industry and Commerce (events);
- 5 years of population loss in a row: -1 Commerce and -1 Industry; pool prices fall and the slum share rises 5 points.

### 2.17.3 City rank change

At the yearly review a province takes the city rank its population gives (2.3.1). Rising to City gives it an airport and makes it a city for influence perks; falling to Town removes the city perks. The first time a province reaches City rank, the company with the most business assets there gets a +10 pp founding bonus to influence in that province for 10 years.

### 2.17.4 Metro formation (T)

- **Formation**: two or more adjacent provinces of rank City or Metropolis whose combined population is 5M or more, each with total development 30 or more, merge into a new Metro at the yearly review. They share one property cycle (the larger member's phase); there is no Metro council (batch 121).
- **Growth**: an adjacent province that reaches City rank and total development 30 joins an existing Metro, up to 8 members. A Metro that would pass 8 members instead splits its largest member into two provinces (data-driven split lines) **(A)**.
- **Mergers**: two Metros that touch and together hold under 8 provinces merge on a yearly roll (20%).
- **Dissolution**: a Metro whose combined population stays under 4M for 5 years dissolves; its provinces become separate city provinces with their own cycles.

### 2.17.5 New cities

- **Organic growth**: any province can climb to City and then into a Metro through 2.17.2 to 2.17.4.
- **Special economic zones** (C6): a government (or a character with Kingmaker national influence) founds a zone in a province with Tax or Charter rules; the zone gives Commerce and Industry +3 targets for 10 years **(T)**.
- **Charter cities** from corporate sovereignty ([4-politics.md](4-politics.md) 4.12) are provinces that change owner.

## 2.18 Business cycle and macro shocks

### 2.18.1 National cycle

Every country has an economic cycle phase, updated monthly:

| Phase | Demand modifier | Unemployment | Default chance (companies) | Typical length |
|---|---|---|---|---|
| **Expansion** | +0% to +3% | Falling | ×0.7 | 3 to 8 years |
| **Overheating** | +3% to +5%, inflation rising | Very low | ×0.8 | 6 to 24 months |
| **Contraction** (recession) | -3% to -8% | Rising | ×2.0 | 6 to 18 months |
| **Recovery** | -1% to +2% | High, falling | ×1.2 | 1 to 3 years |

**Drivers** that shift phase chances each month: credit growth (loans issued by all holders vs GDP), the policy rate versus its neutral level, commodity price shocks (oil above 150% of its 12-month average adds +5% contraction chance per month), stock market drops over 20%, real estate busts in the largest city (2.16.5), wars, pandemics, and confidence (a hidden 0 to 100 value moved by news events).

**The euro area shares one cycle (Logan, batch 122).** The 19 euro countries have one phase, set from euro-area totals (GDP-weighted credit growth, the one ECB rate in [3-markets-and-fx.md](3-markets-and-fx.md), and the average confidence). Each member still has its own confidence value, which shifts its own demand modifier by up to 2 points either way **(T)**. Countries outside the euro, inside the EU or not, keep their own cycle. At start the euro area is in Contraction (the euro crisis).

The demand modifier applies to industry demand through each industry's cyclicality ([10-industry-economy.md](10-industry-economy.md)). Governments respond with budget changes; central banks with rates ([3-markets-and-fx.md](3-markets-and-fx.md)).

### 2.18.2 Global cycle

The **global cycle** is the GDP-weighted average of national phases. When the 3 largest economies are in contraction at once, a **global recession** event fires: commodity demand -10%, shipping rates -30%, all exchanges' sentiment -20.

### 2.18.3 Crises

| Crisis | Trigger | Effects |
|---|---|---|
| **Housing crash** | A bubble (2.16.5) bursts in a country's largest Metro or city province | Property values -30% to -50% over 2 years; banks with real estate loans hit; recession chance +30% |
| **Tech bubble** | A sector's average price-to-earnings ratio above 2.5× its long average for over a year | Sector stocks -50% to -80% over 6 to 12 months; VC funding -70% for 2 years (fewer funding rounds succeed) |
| **Debt crisis** | Country debt above its limit, or a company group with debt over 6× earnings defaults | Bond yields jump; bailout or default chain ([4-politics.md](4-politics.md)) |
| **Commodity super-cycle** | Sustained demand above world capacity for a commodity industry (Mining, Metals, Oil, Gas, Agriculture) | Prices +50% to +200% for years |

These crises are the macro background the player can ride, bet against or be ruined by.

## 2.21 Travel and private jets

Characters are physically somewhere on the map, and getting them where the deals are is a system of its own.

### 2.21.1 Location and residence

- Every character has a **current location** (a province) and a **residence** (a province; sets tax residency for E1 and E4). Homes themselves are **flavor only** (Logan, 2026-10-18): a character's house, flat or lease is not a property holding and gives no influence.
- Meetings, galas and most character actions need both characters in the same city: the same province, or any provinces of the same Metro **(A)**. A **remote call** works for any meeting at -30% effectiveness (pitches, negotiations, persuasion). Some actions are in-person only: galas, Seduce, signing a founding round, funerals.
- There is no dynasty seat and no seat bonus (batch 116); the residence only sets tax residency and where a character's flavor home is.

### 2.21.2 Ways to travel

Travel time comes from the **distance** between the two provinces' centres (great-circle km), plus a fixed overhead per mode **(T)**. Moving between provinces of the same Metro takes 1 hour by car.

| Mode | Time (T) | Cost per trip (T) | Notes |
|---|---|---|---|
| Car or rail | Distance / 80 km per hour | Negligible | Same country or open borders |
| Helicopter | 0.5 hours + distance / 250 km per hour, up to 400 km | $5,000 | Skips traffic; needs a helipad |
| Commercial flight, first class | 3 hours + distance / 800 km per hour, plus 2 hours per connection; both ends need an airport (rank City or above, 2.3.1), else add a car leg | $1,000 domestic, $15,000 international | Fixed departures (one every 6 hours on major routes); visible to the public; no work in flight beyond calls at -50% |
| Charter jet | Like a private jet | $20,000 to $150,000 by distance and class | Booked 12 hours ahead; no ownership cost |
| Fractional jet share | Like a private jet | $2M a year for 200 flight hours | Booked 6 hours ahead |
| **Owned private jet** | 0.5 hours + distance / (800 km per hour × speed factor), plus 2 hours per stop beyond range | Running cost per flight hour (2.21.3) | Leaves when you say; status; office cabin |
| Superyacht | Days | Upkeep only | A floating venue for galas and secret meetings (2.21.7) |
| Suborbital hop (late game) | 2 hours anywhere with a Metropolis spaceport **(A)** | $500,000 | Cyberpunk accent |

Travel time is time the character cannot spend on most other actions (see in-flight work, 2.21.4).

### 2.21.3 Private jets

Jets are assets. They can be owned by a character's personal account, a trust or a company, and they appear on the balance sheet.

| Class | Price (T) | Range | Seats | Speed vs commercial | Yearly fixed cost | Per flight hour | Status |
|---|---|---|---|---|---|---|---|
| **Light jet** | $8M | 3,000 km (regional only) | 6 | 1.0× | $0.8M | $3,000 | +2 |
| **Midsize** | $20M | 5,500 km | 8 | 1.0× | $1.5M | $4,500 | +4 |
| **Super-midsize** | $30M | 6,500 km (coast to coast, short ocean hops) | 10 | 1.05× | $2M | $5,500 | +6 |
| **Large cabin** | $50M | 11,000 km (most intercontinental routes with one stop) | 14 | 1.1× | $3.5M | $8,000 | +8 |
| **Ultra-long-range** | $75M | 14,000 km (nonstop almost anywhere) | 16 | 1.15× | $5M | $10,000 | +10 |
| **VIP airliner** | $150M | 15,000 km | 40 | 1.1× | $12M | $20,000 | +15 |

- **Door-to-door time**: a private jet saves about 3 hours per trip over commercial (no check-in, connections or fixed departures), plus the speed factor. A flight that needs a stop beyond the jet's range adds 2 hours per stop.
- **Status**: the class's status value counts as a push toward Friend at galas and in first meetings with Ambitious or Greedy characters, and adds Clout once at purchase (status / 2, **T**). Ascetic and Honest characters instead push 5 toward Rival on an owner worth under $1B **(T)** who flies a Large cabin jet or bigger ("showing off").
- **Upgrades** (each a one-time cost):

| Upgrade | Cost | Effect |
|---|---|---|
| Office cabin | $2M | Work in flight (2.21.4) |
| Secure comms suite | $3M | Calls in flight at full effectiveness; -50% chance of being overheard by hacking ([17-hacking.md](17-hacking.md)) |
| Bedroom suite | $1M | Arrive rested: no jet lag (2.21.5) |
| Medical bay | $4M | Safer travel for old or ill characters; health lost in a crash or medical emergency in flight halved |
| Security package (armor, decoy flares, counter-surveillance) | $6M | Halves attack and kidnap risk on arrival; hides flight plans from Tier 1 trackers |
| Ghost registration (registered through a shell in a haven) | Cost of a shell company | Flight tracking needs Investigate Shell first (2.21.6); adds exposure |

- **Maintenance**: each jet needs 1 week of maintenance every 400 flight hours. Skipped maintenance raises the crash chance (2.21.8).
- **Home base and hangar**: a jet is based at a province with an airport (the owner's residence, or the nearest city to it, by default). Repositioning an empty jet costs its flight hours.
- **Leasing and chartering out**: a jet can be leased from a property or aviation fund (12% of its price a year), and an owned jet can be **chartered out** when idle, earning 60% of its running cost back per hour chartered.
- **Fleets**: an Airlines business unit can run a jet fleet as a charter service, selling flight hours to AI and player characters.

### 2.21.4 Itineraries and in-flight work

- The player plans **itineraries**: a list of provinces with meetings at each stop. The planner shows total hours, cost, and time-zone effects, and books the jet or flights.
- An **entourage** travels together: executives, aides and security staff on the same jet, up to its seats. Characters on a trip together push 1 toward Friend with each other per 10 hours flown (none if they are Rivals).
- **In-flight work** with an office cabin: Finance, Intrigue and Tech actions that do not need another person (planning a deal, reviewing a scheme, research) run at 75% speed. Calls run at 50% without secure comms, 100% with them.
- Commercial travel allows calls at 50% only.

### 2.21.5 Jet lag and wear

- Flying across more than 5 time zones gives **jet lag**: -10% effectiveness on actions for 24 hours after landing. A bedroom suite removes it.
- More than 60 flight hours in a month costs 1 health (the jet-set grind) **(T)**.

### 2.21.6 Flight tracking and secrecy

Jets are tracked, and where a tycoon flies is news.

- A rival who runs an intel action on the jet's owner (2.22) can learn their recent flights as one secret.
- A rival who sees your jet land in the city of a target company's HQ, or next to a rival's residence, gets a **rumor** event. Rumors move the target's stock by 2% to 6% and can tip off a takeover.
- **Countermeasures**: fly commercial or charter (anonymous), register the jet through a shell, file a decoy flight plan (Intrigue roll), or meet on a yacht in international waters.
- Under T4 Mass Surveillance or Social Credit laws, the host government always knows who landed.

### 2.21.7 Superyachts

- Superyachts cost $50M to $500M, with yearly upkeep at 10% of price.
- A yacht is a **mobile venue**: galas on board give +25% gala influence, and meetings on board in international waters cannot be tracked or recorded by governments.
- A yacht can be seized under sanctions if it docks in a sanctioning country's port.

### 2.21.8 Risk on the road

| Risk | Base chance (T) | Modifiers | Effect |
|---|---|---|---|
| **Crash** | 0.002% per flight hour | ×3 for each skipped maintenance week; ×5 in war airspace | Everyone on board loses 30 to 90 health **(T)**; death comes only at health 0 ([1-corporate-core.md](1-corporate-core.md) 1.1.9). The player character dying ends the game |
| **Arranged accident** | Scheme by a rival ([1-corporate-core.md](1-corporate-core.md) 1.1.8) | Halved by Head of Security protection and the security package | Looks like a crash; investigations may find sabotage |
| **Kidnap or attack on arrival** | 0.5% per trip to provinces with unrest above 60; 2% to war zones | Security detail ÷4; security package ÷2 | Ransom chain or injury |
| **Detention** | Character is sanctioned, Under Investigation, or the host government is hostile | Political influence and diplomatic relations | Held for questioning (days to months), passport seized, or arrested |
| **Airspace closure** | Wars, sanctions ([4-politics.md](4-politics.md) 4.11) | | Reroute, adding 2 to 8 hours |

### 2.21.9 Presence

- A character present in a city (a province, or anywhere in a Metro) for over 30 days in a year counts as **resident-like** there: +2 pp influence for their holdings in its provinces (stacks with origin, once per character).
- Visiting a province where the character holds assets gives a one-week **visit bonus**: a push of 5 toward Friend from local executives, +1 pp influence while there.

### 2.21.10 Travel events (starting set)

| Event | Trigger | Options |
|---|---|---|
| Spotted on the Tarmac | Rival tracks your jet to a target's city | Deny, issue a statement, accelerate the deal |
| Grounded | Maintenance overdue | Fly anyway (crash risk), charter, cancel the trip |
| Jet Envy | A rival buys a bigger jet | Upgrade, mock them publicly, ignore |
| Emissions Scandal | Hostile media and over 300 flight hours a year | Buy offsets, defend it, sell the jet |
| The Long Way Round | Airspace closure on your route | Reroute (+hours), fly through (risk), cancel |
| Stranded | Detention or a sudden coup at your destination | Call in political favors, pay, or flee overland |
| Mile-High Deal | A Greedy or Ambitious executive on your jet | Pitch them in flight (Persuasion roll with no interruptions) |

## 2.22 Information and intelligence

The player does not see everything.

### 2.22.1 What is visible

The player learns about the world from in-game news, which is biased by the outlet that runs each story. **Accurate stock and financial data come only from the Pdoomberg terminal**; other hidden facts are learned one secret at a time (batch 63).

| Information | How it is seen | Hidden part |
|---|---|---|
| Own holdings, companies and finances | Always exact | |
| Public companies' financials, major holders above the first disclosure line | Exact on Pdoomberg (quarterly); the news reports them with its slant | |
| Private companies' financials | Rumors in the news only | An intel action learns them as one secret |
| Holders behind shell companies | No | Investigate Shell scheme |
| Industry prices and news cycles, business cycle phase | Through the news (biased); exact figures only on Pdoomberg | |
| Rival growth plans and asset purchases | Partly (big deals are news) | Market research or espionage learns one plan as a secret |
| Characters' traits | Some (known traits) | Hidden traits need meetings or Dig Up Dirt |
| Influence shares of rivals in a place | Tier only (Presence, Power Broker, Kingmaker) | An intel action learns the exact share as one secret |

### 2.22.2 Intel actions

- There is no intel level or number (batch 63). Each successful intel action (market research, espionage, an analyst's report from the CSO, an Investigate scheme) **learns one secret** about its target: an exact figure, a hidden holder, a plan or a flight log.
- **Market research** costs $100k a month per city (a Metro or a single province) **(T)** and rolls once a month to learn one secret about a rival's business there.
- A learned figure is a snapshot: it goes stale when the real figure changes, and the screen marks its date.
- **Disinformation**: psyops and leaks plant false stories in the news, and players who trust the news believe them. Pdoomberg data cannot be faked.

## 2.23 AI economic behavior

AI companies and AI rival characters run the economy the player competes in.

### 2.23.1 Archetypes

| Archetype | Behavior |
|---|---|
| **Incumbent** | Defends share, prices at market, answers entrants by copying them, invests steadily |
| **Aggressive grower** | Expands into new provinces, borrows heavily, cuts prices; buys rivals only on the game director's order |
| **Cash cow** | Pays high dividends, invests little, sells assets when offered a premium |
| **State champion** | Backed by a government, ignores short-term profit, wins contracts, protected from takeovers |
| **Raider** | Holding company that buys undervalued minority stakes; takes over and breaks up a company only on the game director's order (batch 86) |
| **Startup** | Venture-rank AI rivals (1.7.5): fast, fragile, often for sale |

Each AI company's archetype comes from its controlling character's traits (Ambitious and Brave lean Aggressive; Greedy and Cautious lean Cash cow) and from its government links.

### 2.23.2 Monthly decisions

Each AI company decides monthly:

1. **Grow**: raises a business unit's growth plan when its industry is undersupplied and the unit's return beats its hurdle rate (8% to 15% by archetype), placing new assets in the provinces with the best tax, location perks (2.3.5), industry fit and resource tag (2.3.1).
2. **Shrink or sell**: a unit losing money for 6 months cuts its growth plan; after 12 months its assets or the whole unit are sold.
3. **R&D**: sets its R&D plan by archetype (Aggressive above the industry norm, Cash cow below it).
4. **Acquire**: AI companies never buy other companies on their own (batch 86). Only when the game director orders a takeover does the company pick a target, one that is undervalued when its cash exceeds 20% of its value, and launch it ([1-corporate-core.md](1-corporate-core.md) 1.9).

AI investment is lagged and imperfect on purpose, so shortages and gluts happen and the player can profit from seeing them first.

## 2.24 Map views and overlays

The map is the main screen.

### 2.24.1 Zoom levels

| Zoom | Shows | Main interactions |
|---|---|---|
| **World** | Superregion labels, countries, currency zones, chokepoints, wars, sanctions | Click a country for its economy and politics; click a chokepoint for its risk |
| **Country** | Regions, areas, provinces, Metro outlines, national politics, cycle phase | Click a region, area, Metro or province |
| **Province** | Its four pools, their prices and owners, the business units with assets there, development, resource, terrain, unrest | Buy or sell pool shares, develop land, rezone, visit. A Metro card shows its members, combined development, property cycle and (post-POC) metro systems |

### 2.24.2 Map modes (overlays)

Every mode colours provinces (Logan, batch 118).

| Mode | Shows |
|---|---|
| Political | Country owner; region and area borders |
| Commerce, Industry, Population | Each development track |
| Total development | The sum of the three tracks |
| Influence | Your share and tier per province, city, area, region or country; a rival's tiers |
| Ownership | Who owns real estate and business assets (by the controlling character's color) |
| Property cycle | Boom, peak, bust and recovery per Metro or city |
| Resource | The resource tag |
| Terrain | The terrain type |
| Unrest and labor | Unrest, strikes, unions |
| Ideology | Leading ideology bloc |
| Chokepoint risk | Each province's exposure, colored by the risk of its chokepoints; also war, sanctions and nationalization risk for your assets |
| Metro outlines | Metros drawn over any other mode |
| Economic cycle | National cycle phase |
| Politics | Government type, ruling party, your political influence |
| Characters | Where you and key characters are right now |

## 2.25 Worked examples: cycles

### 2.25.2 Riding the Dubai property cycle

A trust buys $500M of the Commercial pool in the core province of the Dubai Metro during Recovery. Boom arrives 14 months later (rate cuts, foreign buyers). After 36 months of Boom at +1.8% a month the holding is worth about $950M, and the boom has become a bubble. Selling at Peak locks in the gain (while turnover lets it sell); holding through the Bust (twice as deep after a bubble) would have cost about 45%.

### 2.25.3 A recession meets a margin loan

A national recession cuts consumer demand 6%. The player's retail chain's earnings fall 25%; its stock falls 35%. The personal trust's margin loan, backed by that stock, crosses 70% loan-to-value, and a margin call forces the sale of 8% of the chain at the bottom. The player's bloc drops from 54% to 49%: the chain becomes contested just as an activist faction forms. The economic cycle has become a control crisis.

## 2.26 Assumptions

Assumptions in this file, to confirm with Logan:

1. **First playable map** (batch 118): about 195 real countries (the 33 major ones with full economy tables, the rest with simple rows in data/countries.csv), about 400 regions, 750 areas and 3,200 land provinces, about 55 Metros so far (every city of 5M or more, batch 119; likely about 100 when all superregions are built) and 14 chokepoints. Minor groups and districts are gone. The province list is built superregion by superregion, North America first.
2. **Development seeding**: the starting Commerce and Industry of the former hubs' provinces come from their old district mix; slums become a slum share of the Residential pool. Industries get a Commerce or Industry fit (to be added in [10-industry-economy.md](10-industry-economy.md)).
3. **Reference dollar and wage index**: base prices are in US dollar equivalents; the wage index (US = 1.0) scales wages, services, real estate and construction, separately from the politics wealth index, which now also sets province weight.
4. **Province weight** = total development × wealth index × $0.3B (Logan, batch 119; was $1B), and every higher place, the country included, is the honest sum of its provinces (Logan, batch 120 dropped the batch 119 cap of 3% of GDP on country weight) **(T)**. At $0.3B per point a city province weighs about the old hub mass. National weights are large (United States about $5.1T, Canada about $757B; Alberta about $112B), so tier thresholds drop by level: province and city 10/25/50%, area and region 5/15/30%, country 3/8/20% **(T)** (2.5.9). A large region is a modest part of its country (California about $576B, 11% of the United States), so a holder's regional share is usually well above its national share **(A)**. Jobs count through payroll × 1.5, making employers the most influential holders per dollar.
5. **Assets come first**: temporary boosts are capped at the larger of 6 pp or the base share, and a tier won by campaigns is lost after one quarter unless backed by assets.
6. **Province and area tiers give economic perks only**; political perks start at the city level (a Metro or a city province). Towns and rural provinces have no city level. No place below the country has a government (batch 121); city and region perks work through national officials.
7. **Foreignness penalties, offices, Political Capital and government types** are taken from the politics design; restriction labels are derived from its laws. The starting law positions listed in 2.2.4 (C1, C2, F2, E5, L2, E2, F3) should be mirrored in politics data.
8. **Location perks** belong to the city provinces and Metros of the former hubs and are open to every company that meets them (2.3.5).
9. **Real estate** is pooled per province in four pools sized from development, with one property cycle per Metro or city province; gentrification and clearance shift the slum share (2.16).
10. **Development changes yearly** toward targets set by business assets, payroll and pools, and falls with unrest, disasters and decline; provinces climb city ranks and adjacent cities form Metros (2.17).
11. **Business cycles** run per country with four phases and a global recession event; housing crashes, tech bubbles, debt crises and commodity super-cycles are the main crises (2.18).
12. **Characters have a location** (a province); meetings need the same city or a remote call at -30%; each character has a residence province (no dynasty seat); travel time comes from distance between provinces. Travel has a full private jet system with six jet classes, upgrades, itineraries, flight tracking, yachts and travel risk (2.21).
13. **Information is imperfect**: the news is biased, accurate market data is only on Pdoomberg, and intel actions learn one secret at a time (2.22).
14. **Jobs in influence**: the payroll counted at weight 1.5 (2.5.2) is the wage part of a business unit's operating costs.
15. **Metros** (batch 118): 2 to 8 adjacent provinces with no council, one property cycle, a city influence level and post-POC metro systems whose upgrade cost scales with combined development. A Metro may cross region borders.
16. **Resource tags and terrain** (batch 118): one tag per province gives matching business units +3% productivity; terrain sets disaster odds and power cost.
17. **Slop** balances per area (a Metro pools its members), following Logan's "production in an area".
18. **Other files to update**: 4-politics (city level moves to Metros and city provinces; batch 121 then removed city and regional government entirely), 7-starting-world (hubs to provinces), 10-industry-economy (asset spread per province; Commerce or Industry fit per industry), 11-ui (map modes and zoom).
