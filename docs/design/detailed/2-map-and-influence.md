# 2. Map and influence: detailed design

_Status: draft v0.3 (2026-10-18). v0.3: consistency pass, batch 74. The file is split from the old "map, influence and economy" file: the map, countries, regions, hubs, location perks, influence, strata and population, pooled real estate, the hub life cycle, the business cycle, travel and private jets stay here; the old goods economy is gone, replaced by industries and business units in [10-industry-economy.md](10-industry-economy.md) 10.0. Earlier: v0.2 (2026-10-16) added the hub life cycle, business cycles, travel, intelligence, AI behavior and map views. Expands [05-map-and-influence.md](../05-map-and-influence.md). Owner: Logan._

This file turns the map and influence overviews into exact rules, formulas, numbers and content that a designer can balance. It is pure game design.

**How to read the numbers.** Every number in this file is a **starting tuning value (T)** unless it is marked **Fixed**. Formulas are written so each term can be shown in a tooltip breakdown (see [11-ui.md](../11-ui.md)).

**Decided rules kept intact** (from [13-open-questions.md](../13-open-questions.md)):

- Influence is rooted mainly in assets owned in an area, modified by origin, and temporarily boosted by psyops and ad campaigns.
- One turn is one in-game hour; heavy calculations run weekly and monthly.
- Characters are landless; assets are their titles.
- The full game includes map, economy, markets and politics.

**Related detailed files.** Government types, laws, Political Capital (PC), offices, exposure, sanctions and wars are defined in [4-politics.md](4-politics.md). Companies, vassals, autonomy, standing tiers and trusts are defined in [1-corporate-core.md](1-corporate-core.md). Industries, business units and corporations are defined in [10-industry-economy.md](10-industry-economy.md) 10.0. This file uses their terms and does not redefine them.

---

## 2.1 Conventions

### 2.1.1 Money and units

- **Reference dollar ($)**: all base prices and costs are in US dollar equivalents at game start. Each hub converts to its local currency at the live exchange rate ([3-markets-and-fx.md](3-markets-and-fx.md)).
- **Wage index (WI)**: a country's wage level relative to the United States (US = 1.00). It scales wages, local services and building costs. It is separate from the politics **wealth index** (GDP per capita / $20,000) used for bribes and legal fees.
- **Price factor (PF)** = `0.3 + 0.7 × WI`. Scales real estate, local services and place mass (2.5.3).
- **Build index (BI)** = `0.6 + 0.4 × WI`. Scales construction cost.
- **pp** = percentage points of influence share.

### 2.1.2 Cadence for this layer

| Interval | What runs in this layer |
|---|---|
| **Hourly** (every turn) | FX moves ([3-markets-and-fx.md](3-markets-and-fx.md)); events can fire; travel and action timers |
| **Daily** | Active influence campaigns progress (ramp-up) and roll psyop discovery; strike resolve changes |
| **Weekly** | Temporary influence decay; tier hysteresis checks; queued real estate sales fill (2.16.4) |
| **Monthly** | **Base influence recalculation**; tier changes; population unrest; union organization; strike checks; real estate pool prices and rents (2.16.3); property and business cycle phases; migration |
| **Quarterly** | Company statements ([10-industry-economy.md](10-industry-economy.md) 10.0) |
| **Yearly** | Population growth; education conversion; hub size class review; place mass recompute |

---

## 2.2 The world map

### 2.2.1 Map structure

| Layer | Count at start | Notes |
|---|---|---|
| **Major countries** | 31 | Fully simulated: hubs, regions, own market, central bank, exchange |
| **Minor groups** | 16 groups covering the rest of the world | Each member country keeps its own government, laws and currency (see [4-politics.md](4-politics.md) 4.2.4). Economically each group is one aggregated market with no playable hubs at start. Ukraine, Greece, Mali and Iran stay here with no hubs, despite their role in the history (Logan, 2026-10-18) |
| **Regions** | 2 to 8 per major country | States or provinces. Only regions that contain a hub are drawn in detail at start; the rest of a country is one "rest of country" region |
| **Economic hubs** | 81 | Cities or clusters with districts (2.3) |
| **Districts** | 6 to 26 per hub | Each with up to four real estate pools (2.16) |
| **Chokepoints** | 14 | Straits, canals, cable corridors (2.4) |

Government types, corruption, stability and election cycles for every country are in [4-politics.md](4-politics.md) 4.2.4. The tables below add the economic and business-climate values.

### 2.2.2 Foreign business restriction summary

Restriction is not a separate law. It is a **summary label** computed from the starting positions of four politics laws: C1 Foreign Ownership, C2 Branch Office Requirements, F2 Capital Controls and the strategic sector list ([4-politics.md](4-politics.md) 4.5.3 and 4.5.4). The UI shows the label on the country card.

| Label | Typical law positions | What a foreign company experiences |
|---|---|---|
| **Open** | C1 Open, C2 None, F2 Open | Buy and grow freely; profits move freely |
| **Screened** | C1 Screened, C2 None or Local Directors, F2 Open or Reporting | Foreign Investment Review on stakes of 25% or more in strategic sectors (2 to 6 weeks) |
| **Guarded** | C1 Capped Strategic, C2 Local Directors, F2 Reporting | Foreign voting stake capped at 49% in strategic sectors; a branch office is the usual entry for those sectors |
| **Restricted** | C1 Capped All, C2 Local Partner 30%, F2 Restricted | Branch office with a 30% local partner for most sectors; outflows need approval |
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
| 10 | Netherlands | EUR | Free Float (euro zone) | 0.75 | 0.90 | Moderate | Largest port in Europe; lithography |
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
| 25 | Taiwan | TWD | Managed Float | 0.61 | 0.50 | Moderate | Leading-edge chip fabs |
| 26 | Singapore | SGD | Managed Float (basket) | 0.37 | 0.85 | Low | Transshipment, wealth management |
| 27 | Malaysia | MYR | Managed Float | 0.36 | 0.25 | Moderate | Chip packaging |
| 28 | Indonesia | IDR | Managed Float | 1.12 | 0.12 | Moderate | Nickel, coal, palm oil |
| 29 | Vietnam | VND | Managed Float | 0.26 | 0.12 | Moderate | Electronics assembly |
| 30 | Australia | AUD | Free Float | 1.4 | 0.95 | High | Iron ore, lithium, LNG |
| 31 | Qatar | QAR | Peg (USD) | 0.18 | 0.60 | Low | Largest LNG exporter; sovereign fund; promoted from Gulf minors so Doha has a country (2026-10-18 review) |

### 2.2.4 Major countries: business climate

Strategic sectors (the default list in every country): defense, chips, AI, telecom, energy, critical minerals, ports, media. A country can add or remove sectors in data.

| Country | C1 Foreign Ownership | C2 Branch Office | F2 Capital Controls | E5 Tariffs | L2 Union Rights | Restriction label | Notes |
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
| Netherlands | Screened | None | Open | Low | Recognized | Screened | Lithography under export control |
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
| India | Capped Strategic | Local Directors | Reporting | Moderate | Recognized | Guarded | Data Sovereignty (T2) |
| China | Capped All | Local Partner 30% (51% and Tech Transfer in strategic) | Restricted | Moderate | Restricted | Restricted | Strategic sectors effectively Closed |
| Japan | Screened | None | Open | Low | Recognized | Screened | |
| South Korea | Screened | None | Open | Low | Recognized | Screened | Chaebol cross-holdings |
| Taiwan | Capped Strategic | None | Reporting | Low | Recognized | Guarded | Advanced fabs abroad need approval |
| Singapore | Open | None | Open | Free Trade | Restricted | Open | |
| Malaysia | Screened | None | Open | Low | Recognized | Screened | |
| Indonesia | Capped Strategic | Local Partner 30% (mining) | Reporting | Moderate | Recognized | Guarded | Raw nickel export ban at start |
| Vietnam | Capped All | Local Partner 30% | Restricted | Moderate | Restricted | Restricted | Export zones (C6) eased |
| Australia | Screened | None | Open | Low | Recognized | Screened | Critical minerals screened at 10% |

### 2.2.5 Minor groups

Each group is one aggregated market with a combined GDP, one blended wage index and one dominant currency for prices. Member countries keep their own government type and laws for politics (government types follow [4-politics.md](4-politics.md) 4.2.4; countries not listed there default to the group's typical type).

| Group | Members | Price currency | GDP ($T) | WI | Typical restriction | Economic role |
|---|---|---|---|---|---|---|
| Nordics | Sweden, Norway, Denmark, Finland, Iceland | SEK (others tracked) | 1.9 | 0.95 | Screened | Oil and gas (Norway), shipping, pulp, telecom gear; sovereign wealth fund |
| Euro periphery | Spain, Portugal, Ireland, Belgium, Austria, Greece | EUR | 3.6 | 0.65 | Screened | Tourism, pharma (Ireland), shipping (Greece); Ireland at Low tax draws holding companies |
| Central and Eastern Europe | Poland, Czechia, Hungary, Romania, Baltic states, Slovakia | PLN (others tracked) | 1.9 | 0.35 | Screened | Auto parts, appliances, nearshore assembly for Germany |
| Black Sea and Caucasus | Ukraine, Georgia, Armenia, Azerbaijan, Moldova | UAH | 0.35 | 0.12 | Guarded | Grain, neon gas, steel; Caspian oil; Middle Corridor rail; high conflict risk |
| Central Asia | Kazakhstan, Uzbekistan, Turkmenistan, Kyrgyzstan, Tajikistan | KZT | 0.45 | 0.15 | Guarded | Uranium, oil, gas, rail corridor between China and Europe |
| Gulf minors | Kuwait, Bahrain, Oman | USD pegs | 0.37 | 0.50 | Guarded | LNG (Qatar), oil, sovereign funds |
| Iran | Iran | IRR (F3 Dual Rate) | 0.40 | 0.08 | Closed | Oil and gas under sanctions; sits on the Strait of Hormuz |
| North Africa and Levant | Morocco, Algeria, Tunisia, Jordan, Lebanon, Libya | MAD | 0.65 | 0.10 | Guarded | Phosphates (Morocco), gas to Europe (Algeria), oil (Libya) |
| West Africa | Ghana, Côte d'Ivoire, Senegal, Mali, Burkina Faso, Niger and neighbors | XOF (euro peg) | 0.45 | 0.06 | Guarded | Cocoa, gold, uranium (Niger), offshore oil |
| East Africa and Horn | Kenya, Ethiopia, Tanzania, Uganda, Somalia, Sudan | KES | 0.55 | 0.06 | Guarded | Agriculture, mobile money fintech, Red Sea coast |
| Central and Southern Africa | DR Congo, Zambia, Angola, Zimbabwe, Mozambique, Namibia | USD (dollarized trade) | 0.40 | 0.05 | Guarded | Cobalt and copper (Copperbelt), oil (Angola), uranium |
| South Asia minors | Pakistan, Bangladesh, Sri Lanka, Nepal | PKR | 0.85 | 0.07 | Guarded | Garments (Bangladesh), textiles, ports |
| Southeast Asia minors | Thailand, Philippines, Myanmar, Cambodia, Laos | THB | 1.2 | 0.15 | Screened | Auto and electronics assembly (Thailand), business process outsourcing (Philippines), rare earths (Myanmar) |
| Andean and Venezuela | Colombia, Peru, Ecuador, Bolivia, Venezuela | COP (others tracked) | 0.95 | 0.18 | Guarded (Venezuela Closed) | Copper (Peru), lithium (Bolivia), oil (Venezuela, Colombia) |
| Central America and Caribbean | Panama, Costa Rica, Guatemala, Dominican Republic, Cuba, Haiti, Cayman Islands, British Virgin Islands, Bermuda | USD | 0.55 | 0.20 | Screened | Panama Canal; offshore shell havens (F5 Haven) |
| Oceania minors | New Zealand, Pacific islands | NZD | 0.30 | 0.75 | Screened | Dairy, tourism, undersea cable landings |

**Havens.** Shell company jurisdictions ([1-corporate-core.md](1-corporate-core.md) 1.7.4) at start: Cayman Islands, British Virgin Islands, Bermuda (Central America and Caribbean group), plus Jersey and Guernsey (modeled inside the United Kingdom as special jurisdictions), Luxembourg (inside Euro periphery) and the UAE free zones. Havens have no hubs; they only hold paper.

---
## 2.3 Hubs and districts

### 2.3.1 Size classes

| Class | Metro population | Districts | Base mass at WI 1.0 | Local council seats (from politics) |
|---|---|---|---|---|
| **S** | under 1.5M | 6 | $3B | 7 or 9 |
| **M** | 1.5M to 5M | 10 | $10B | 9 or 15 |
| **L** | 5M to 10M | 14 | $30B | 15 or 25 |
| **XL** | 10M to 20M | 18 | $60B | 25 |
| **Mega** | over 20M | 22 to 26 | $120B | 25 |

- **Hub mass** = base mass × PF of the country. Mass is the denominator of influence (2.5.3). It measures the weighted value of everything that matters for local power, not the full value of every home and shop.
- **Labor force** = 50% of metro population, split into segments (2.8.1).
- **Hub GDP** (used by politics for political market size) = metro population × national GDP per person × hub productivity (1.0 for resource towns, 1.3 typical, 2.0 for global finance centers).
- A hub moves up one size class when its population passes the next threshold at a yearly review, and gains districts, each with new real estate pools (2.16, 2.17.2).

### 2.3.2 District types

The six district types from 05 plus **Resource Field**.

| Code | District | Mass weight | Typical business units with assets there | Character |
|---|---|---|---|---|
| **F** | Financial District | 2.0 | Headquarters, banking, asset management, insurance, professional services | Professionals and Elite; headquarters; exchanges |
| **T** | Tech Park | 1.5 | Foundry, data centers, AI labs, software, pharma research | Professionals and Skilled; power and water hungry |
| **P** | Port (sea, river or air) | 1.2 | Shipping, logistics, oil and gas terminals, metals | Logistics; strike-sensitive; chokepoint-exposed |
| **I** | Industrial Zone | 1.0 | Chemicals, metals, autos, EVs, construction, power utilities | Skilled and Unskilled; pollution |
| **R** | Residential | 1.0 | Retail, fast food, healthcare services, small offices | Housing for every segment above Gig |
| **S** | Slums | 0.3 | Black market fronts, street retail, informal work | Gig and Unemployed; high unrest; light policing |
| **X** | Resource Field | 0.8 | Mining, oil and gas fields, agriculture, renewables | Remote labor camps |

- **District mass** = hub mass × district weight / sum of all district weights in the hub.
- A business unit's assets in a hub (its asset spread, [10-industry-economy.md](10-industry-economy.md) 10.0.2) sit in the district that fits its industry, and rent or buy their space from that district's real estate pools (2.16).

### 2.3.3 Hub list

**81 hubs** at start: 44 original, plus 37 added in the 2026-10-18 realism review (Logan: "more cities"). New hubs are only in the 31 major countries; minor groups (including Ukraine, Greece, Mali and Iran) still have none. Populations are 2020 metro estimates **(T)**.

District codes: F Financial, T Tech Park, P Port, I Industrial, R Residential, S Slums, X Resource Field. Population is metro population at start in millions. Connections list the main lanes and chokepoints (2.4).

**North America**

| Hub | Country (region) | Size | Pop (M) | Districts | Specialties | Connections |
|---|---|---|---|---|---|---|
| New York | United States (New York-New Jersey) | Mega | 20 | F5 I2 P2 R9 S3 T3 | Global finance, main exchange, media, law, insurance, prime real estate | Transatlantic sea and fiber to London and Rotterdam; rail and road to Chicago; Panama Canal to Asia; Gibraltar to the Mediterranean |
| Chicago | United States (Illinois) | L | 9.5 | F3 I4 P1 R4 S1 T1 | Futures and commodity exchange, rail freight center, food processing, grain | Rail to New York, Houston, Los Angeles; Great Lakes and St Lawrence (seasonal); Mississippi barges to the Gulf |
| Houston | United States (Texas) | L | 7.3 | F1 I4 P3 R4 S1 X1 | Oil and gas, refining, petrochemicals, LNG export | Gulf of Mexico tanker lanes; Panama Canal to Asia; Florida Strait to the Atlantic; pipelines to Chicago |
| Bay Area | United States (California) | L | 7.7 | F2 I1 P1 R5 S1 T4 | Venture capital, software, AI labs, chip design | Transpacific sea and fiber to Tokyo, Taiwan, Shanghai; air freight hub for chips |
| Los Angeles-Long Beach | United States (California) | XL | 13 | F2 I4 P3 R6 S2 T1 | Largest US container port, media and entertainment, aerospace, defense | Transpacific lanes to Shenzhen, Shanghai, Busan; rail land bridge to Chicago and New York |
| Phoenix | United States (Arizona) | M | 5 | F1 I2 R4 S1 T2 | New chip fabs, data centers, water-stressed | Rail and road to Los Angeles and Houston; air |
| Edmonton | Canada (Alberta) | S | 1.4 | F1 I2 R1 S1 X1 | Oil sands and oil field services, pipelines, the Alberta provincial government | Pipelines to Houston and the Pacific coast; rail to Toronto and Chicago. Added for the starting character John Techno, replacing Calgary (batch 76; [7-starting-world.md](7-starting-world.md) 7.8) |
| Toronto | Canada (Ontario) | L | 6.5 | F3 I3 P1 R5 S1 T1 | Banking, mining finance, auto plants, AI research | Rail and road to New York and Chicago; St Lawrence Seaway |
| Mexico City | Mexico (Valle de México and Bajío belt) | Mega | 22 | F2 I6 P1 R8 S5 T1 X1 | Vehicles and parts, nearshore electronics, consumer goods, telecom | Rail and road to Houston (US border crossings); Pacific port Manzanillo and Gulf port Veracruz (abstracted) |
| Washington DC | United States (DC, Maryland, Northern Virginia) | L | 6.3 | F2 I1 R6 S2 T3 | Federal government, lobbying firms, defense contractors, Northern Virginia data center alley | Rail to New York; air; transatlantic fiber |
| Boston | United States (Massachusetts) | M | 4.9 | F2 R4 S1 T3 | Biotech, universities, asset management, robotics | Rail to New York; Atlantic port (abstracted); air |
| Seattle | United States (Washington) | M | 4.0 | F1 I2 P2 R3 T2 | Cloud computing, e-commerce, aerospace, Pacific port | Transpacific lanes to Tokyo, Busan and Shanghai; rail to Chicago |
| Dallas-Fort Worth | United States (Texas) | L | 7.6 | F3 I3 R5 S1 T2 | Corporate headquarters, energy finance, telecom, logistics | Rail and road to Houston and Chicago; air hub |
| Atlanta | United States (Georgia) | L | 6.0 | F2 I3 P1 R5 S2 T1 | The world's busiest airport, logistics, media, payments | Air hub; rail to the Gulf and East Coast ports |
| Miami | United States (Florida) | L | 6.1 | F3 P2 R6 S2 T1 | Latin American finance gateway, flight capital, real estate, cruise and tourism | Florida Strait; Caribbean and Panama Canal lanes; air to Latin America |
| Austin | United States (Texas) | M | 2.2 | F1 I2 R4 S1 T2 | Chip fabs, software, EV plant, state government | Road and rail to Dallas and Houston; air |
| Detroit | United States (Michigan) | M | 4.3 | F1 I4 R3 S2 | Autos and EVs, parts suppliers | Great Lakes; road and rail to Toronto and Chicago |
| Las Vegas | United States (Nevada) | M | 2.3 | F1 I1 R5 S2 T1 | Casinos, gambling, conventions, tourism | Road and rail to Los Angeles; air |
| Vancouver | Canada (British Columbia) | M | 2.6 | F2 P2 R4 S1 T1 | Pacific port, real estate, Asian capital, film | Transpacific lanes; rail to Edmonton and Toronto |
| Montreal | Canada (Quebec) | M | 4.2 | F2 I2 P1 R3 S1 T1 | AI research, aerospace, video games, the Quebec government | St Lawrence Seaway; rail to Toronto and New York |
| Ottawa | Canada (Ontario) | S | 1.4 | F1 R3 S1 T1 | Federal government, tech | Rail and road to Montreal and Toronto |
| Monterrey | Mexico (Nuevo León) | L | 5.3 | F2 I6 R4 S2 | Steel, cement, nearshoring plants, brewing | Road and rail to Texas border crossings |
| Guadalajara | Mexico (Jalisco) | L | 5.2 | F1 I4 R5 S3 T1 | Electronics, software, tequila | Pacific port Manzanillo (abstracted); rail to Mexico City |

**South America**

| Hub | Country (region) | Size | Pop (M) | Districts | Specialties | Connections |
|---|---|---|---|---|---|---|
| São Paulo | Brazil (São Paulo, with Santos port) | Mega | 22 | F3 I5 P2 R8 S4 T1 X1 | Finance, vehicles, food processing, soy, beef, sugar, iron ore marketing | Santos to Atlantic lanes; Cape of Good Hope to China; Panama Canal to the US west coast |
| Antofagasta | Chile (Antofagasta, Atacama) | S | 0.5 | I1 P1 R1 S1 X2 | Copper mining, lithium brine | Pacific bulk lanes to Shanghai, Busan, Tokyo; Panama Canal to Houston |
| Medellín | Colombia (Antioquia) | M | 4 | F1 I2 R3 S2 T1 X1 | Textiles, coffee, flowers, informal economy, cartel money laundering, growing tech scene | Road to Pacific port Buenaventura and Caribbean port Cartagena (abstracted); air to Miami and Bogotá. Added for the starting character Pablo Segundo ([7-starting-world.md](7-starting-world.md) 7.8) |
| Rio de Janeiro | Brazil (Rio de Janeiro) | XL | 13 | F2 I3 P3 R6 S4 | Offshore oil company headquarters, media, tourism | Atlantic lanes; offshore oil fields |
| Buenos Aires | Argentina (Buenos Aires) | XL | 15 | F3 I4 P2 R6 S3 | Finance, agribusiness, lithium financing, software exports | River Plate port; Atlantic lanes |
| Santiago | Chile (Santiago Metropolitan) | L | 6.8 | F3 I3 R5 S2 T1 | Finance, mining company headquarters, pension funds | Road to Pacific port Valparaíso (abstracted); air |

**Europe**

| Hub | Country (region) | Size | Pop (M) | Districts | Specialties | Connections |
|---|---|---|---|---|---|---|
| London | United Kingdom (Greater London) | XL | 15 | F5 I1 P1 R7 S2 T2 | FX trading, insurance, law, wealth management, links to havens | Dover Strait; Channel Tunnel rail; transatlantic fiber and air |
| Rotterdam | Netherlands (South Holland) | M | 2.5 | F1 I3 P4 R2 | Largest European port, refining, chemicals, LNG import, Rhine gateway | Asia-Europe lanes via Suez or the Cape; Dover Strait; Rhine barges and rail to Frankfurt |
| Eindhoven | Netherlands (North Brabant) | S | 0.8 | I2 R2 T2 | Lithography systems (sole supplier at start), photonics, precision systems | Rail and road to Rotterdam; air freight |
| Frankfurt | Germany (Hesse, Rhine-Main incl. chemical complex) | L | 5.8 | F4 I4 P1 R4 T1 | Euro central bank, banking, chemicals, precision optics, auto suppliers, air cargo | Rhine barges and rail to Rotterdam; rail to Paris and over the Alps to the south; air |
| Paris | France (Île-de-France) | XL | 13 | F3 I3 P1 R7 S2 T2 | Luxury goods, aerospace, nuclear engineering, defense, finance | Rail and road to Rotterdam and Frankfurt; Channel Tunnel to London; port of Le Havre (abstracted) |
| Zurich | Switzerland (Zurich, with Basel and Geneva abstracted) | M | 1.5 | F4 I1 R4 T1 | Private banking, commodity trading houses, insurance, pharma | Rail to Frankfurt and Milan; air |
| Moscow | Russia (Central) | Mega | 21 | F3 I5 P1 R9 S4 T2 | Energy company headquarters, metals, defense, oil trading, cybercrime underground | Pipelines to China and (sanctioned) Europe; rail to China via Kazakhstan; Baltic ports via the Danish Straits; Black Sea via the Turkish Straits |
| Istanbul | Turkey (Marmara) | XL | 16 | F2 I5 P3 R5 S3 | Textiles, vehicles, shipping, regional finance | Turkish Straits; Black Sea lanes; rail to Europe; Middle Corridor rail to Central Asia and China |
| Aberdeen | United Kingdom (Scotland) | S | 0.5 | F1 I1 P2 R1 X1 | North Sea oil and gas services | North Sea; rail to London |
| Munich | Germany (Bavaria) | L | 6.0 | F3 I4 R5 T2 | Autos, insurance and reinsurance, chips | Rail to Frankfurt and over the Alps; air |
| Berlin | Germany (Berlin-Brandenburg) | L | 6.1 | F2 I2 R6 S2 T2 | Federal government, startups, media | Rail to Frankfurt, Warsaw and the Baltic |
| Amsterdam | Netherlands (North Holland) | M | 2.5 | F3 P1 R4 T2 | Stock exchange, fintech, data centers, internet exchange | Rail to Rotterdam; North Sea; transatlantic fiber |
| Milan | Italy (Lombardy) | L | 7.4 | F4 I4 R5 S1 | Finance, fashion, luxury, design | Rail over the Alps to Zurich and Frankfurt |
| Rome | Italy (Lazio) | M | 4.3 | F1 I1 R5 S2 T1 | Government, the Vatican, tourism, state energy company headquarters | Rail to Milan; Mediterranean port (abstracted) |
| St Petersburg | Russia (Northwest) | L | 6.2 | F2 I4 P3 R4 S1 | Baltic port, shipbuilding, gas company headquarters | Baltic lanes via the Danish Straits; rail to Moscow |

**Middle East and Africa**

| Hub | Country (region) | Size | Pop (M) | Districts | Specialties | Connections |
|---|---|---|---|---|---|---|
| Dubai | UAE (Dubai and Sharjah) | L | 6 | F4 I2 P3 R3 S1 T1 | Re-export logistics, gold trading, free zones, aviation hub, real estate, grey trade | Strait of Hormuz (inside the Gulf); sea lanes to India, East Africa and Europe; air hub |
| Dhahran-Dammam | Saudi Arabia (Eastern Province) | M | 4 | F1 I3 P2 R2 X2 | Largest oil fields, refining, petrochemicals, desalination | Strait of Hormuz; East-West pipeline to the Red Sea coast (bypass); Bab-el-Mandeb and Suez |
| Doha | Qatar (Doha) | M | 2.4 | F2 I2 P2 R3 X1 | Largest LNG exporter, sovereign fund, media network | Strait of Hormuz; LNG lanes to Tokyo, Seoul and (via Suez) Rotterdam |
| Tel Aviv | Israel (Central) | M | 4 | F2 I1 P1 R3 T3 | Cybersecurity, surveillance tech, chip design, defense electronics, venture capital | Mediterranean via Suez or Gibraltar; air; fiber |
| Cairo-Suez | Egypt (Cairo and Canal Zone) | Mega | 22 | F2 I4 P2 R8 S7 T1 | Canal revenue, textiles, fertilizer, construction, gas | Suez Canal; Mediterranean and Red Sea lanes; Red Sea cable corridor landing |
| Lagos | Nigeria (Lagos) | Mega | 21 | F2 I3 P2 R7 S9 T1 | Oil money, fintech, consumer goods, film industry, informal economy | Gulf of Guinea lanes (piracy risk); Atlantic to Europe; Cape of Good Hope to Asia |
| Johannesburg | South Africa (Gauteng, with Durban port abstracted) | L | 9.5 | F3 I3 P1 R4 S2 X1 | Mining finance, platinum metals, gold, coal power | Rail to Durban; Cape of Good Hope; Mozambique Channel |
| Kolwezi-Lubumbashi | DR Congo and Zambia Copperbelt (Central and Southern Africa) | M | 3 | I2 R2 S3 X3 | Cobalt (about 70% of world supply), copper | Long truck and rail lanes to Durban, Dar es Salaam and Lobito; border delays |
| Riyadh | Saudi Arabia (Riyadh) | L | 7.6 | F3 I3 R5 S2 T1 | Government, royal court, sovereign fund, megaprojects | Rail to Dhahran-Dammam; air |
| Abu Dhabi | UAE (Abu Dhabi) | M | 1.5 | F3 I2 P2 R2 X1 | Sovereign funds, oil, AI investment | Strait of Hormuz; road to Dubai |
| Cape Town | South Africa (Western Cape) | M | 4.7 | F2 I1 P2 R3 S2 | Finance, tourism, wine, tech | Cape of Good Hope lanes |

**Asia and Oceania**

| Hub | Country (region) | Size | Pop (M) | Districts | Specialties | Connections |
|---|---|---|---|---|---|---|
| Mumbai | India (Maharashtra) | Mega | 24 | F4 I3 P2 R6 S8 T1 | Finance, main exchange, film industry, generic pharma, refining (Gujarat abstracted) | Arabian Sea lanes to the Gulf (Hormuz); Suez to Europe; Malacca to East Asia |
| Bengaluru | India (Karnataka) | XL | 13 | F1 I2 R7 S4 T4 | IT services, software outsourcing, chip design, aerospace, biotech | Air; Chennai port (abstracted); fiber |
| Shanghai | China (Yangtze Delta) | Mega | 29 | F4 I6 P3 R8 S1 T3 | Largest container port, finance, EVs, mature-node chips, shipbuilding | Taiwan Strait (southbound); East China Sea to Japan, Korea and the Pacific; Malacca to Europe; Yangtze barges; rail to Europe via Kazakhstan |
| Shenzhen-Dongguan | China (Pearl River Delta) | Mega | 22 | F2 I7 P3 R6 S2 T4 | Electronics assembly, component markets, drones, EVs and batteries | South China Sea to Malacca; Taiwan Strait (northbound); Luzon Strait to the Pacific; Hong Kong next door |
| Hong Kong | China (Hong Kong SAR) | L | 7.5 | F5 P3 R4 S1 T1 | Offshore gateway into China, trading houses, re-export, company registrations | Pearl River Delta; Taiwan Strait; Malacca; Luzon Strait cables. Uses HKD (F3 Currency Board to USD) and its own looser laws: restriction Screened |
| Beijing | China (Jing-Jin-Ji, with Tianjin port) | Mega | 22 | F3 I3 P1 R9 S3 T5 | Central government, state company headquarters, AI and surveillance tech, regulators | Tianjin via the Bohai and Yellow Sea; rail to Russia and Mongolia; rail to Shanghai |
| Baotou | China (Inner Mongolia) | M | 2.7 | I4 R2 S1 X3 | Rare earth mining and separation, steel, aluminium | Rail to Beijing and Tianjin port; rail to Mongolia and Russia |
| Hsinchu-Taipei | Taiwan (North Taiwan) | L | 9 | F2 I2 P1 R4 T5 | Leading-edge logic fabs, advanced packaging, electronics design | Taiwan Strait and Luzon Strait for all sea exits; air freight for chips; undersea cables |
| Seoul-Pyeongtaek | South Korea (Capital Area, with Ulsan and Busan abstracted) | Mega | 26 | F3 I5 P2 R8 S1 T5 | Memory chips, displays, batteries, shipbuilding, vehicles, entertainment | Korea Strait; East China Sea; Taiwan or Luzon Strait to Malacca; Pacific to the US |
| Tokyo-Yokohama | Japan (Kanto, with Nagoya abstracted) | Mega | 37 | F5 I5 P3 R9 S1 T3 | Finance, vehicles, robotics, chip materials (photoresists, wafers), precision machinery | Pacific lanes to the US; East China Sea; Malacca and Hormuz for oil and LNG |
| Singapore | Singapore | L | 6 | F4 I2 P4 R3 T1 | Transshipment, refining, commodity trading, wealth management, data centers, cable landings | Strait of Malacca and Singapore Strait; South China Sea; Indian Ocean |
| Penang | Malaysia (Penang and Kulim) | M | 1.8 | I4 P1 R3 T2 | Chip assembly, test and packaging, electronics | Strait of Malacca; air |
| Jakarta | Indonesia (Jabodetabek, with Sulawesi nickel abstracted) | Mega | 34 | F2 I5 P2 R7 S6 T1 X1 | Consumer market, nickel processing, palm oil, coal | Sunda Strait; Malacca; Lombok route |
| Ho Chi Minh City | Vietnam (Southeast) | XL | 14 | F1 I6 P2 R5 S3 T1 | Electronics assembly ("China plus one"), garments, footwear, rice | South China Sea; Malacca; transpacific lanes |
| Perth-Pilbara | Australia (Western Australia) | M | 2.3 | F1 I2 P2 R3 X2 | Iron ore (largest exporter), lithium ore, LNG, gold | Bulk lanes to China, Japan and Korea via the Lombok and Makassar straits (bypassing Malacca) |
| Sydney | Australia (New South Wales) | L | 5.4 | F3 I2 P2 R5 S1 T1 | Banking, pension funds, property, media, mining company headquarters | Pacific lanes to Shanghai, Tokyo and Los Angeles; fiber to Singapore and the US. |
| Delhi NCR | India (Delhi, Gurugram, Noida) | Mega | 31 | F3 I5 R9 S6 T3 | Capital and government, IT services, autos | Rail to Mumbai; air hub |
| Hyderabad | India (Telangana) | XL | 10 | F1 I3 R7 S4 T3 | Pharma, IT services, cloud data centers | Rail and road to Chennai and Mumbai; air |
| Chennai | India (Tamil Nadu) | XL | 11 | F1 I5 P2 R6 S3 T1 | Autos, electronics assembly, port | Bay of Bengal lanes to Malacca |
| Chengdu | China (Sichuan) | XL | 16 | F2 I5 R7 S2 T2 | Electronics assembly, gaming, aerospace | Rail to Europe; Yangtze via Chongqing |
| Wuhan | China (Hubei) | XL | 11 | F1 I6 P1 R7 S2 T1 | Autos, steel, optical fiber, research labs | Yangtze barges to Shanghai; rail hub |
| Osaka-Kobe | Japan (Kansai) | XL | 19 | F3 I5 P3 R6 S1 | Manufacturing, electronics, pharma, port | Inland Sea; Pacific lanes |
| Kaohsiung | Taiwan (South Taiwan) | M | 2.7 | I4 P3 R2 T1 | Port, petrochemicals, steel, new chip fabs | Taiwan and Luzon Straits |
| Kuala Lumpur | Malaysia (Klang Valley) | L | 8 | F3 I3 R5 S2 T1 | Finance, Islamic finance, palm oil trading, data centers | Port Klang on the Strait of Malacca |
| Hanoi | Vietnam (Red River Delta) | L | 8 | F1 I6 R5 S1 T1 | Government, electronics plants | Port of Haiphong (abstracted); rail to China |
| Melbourne | Australia (Victoria) | M | 5.0 | F3 I2 P1 R4 | Finance, pension funds, universities, port | Bass Strait; Pacific lanes |

### 2.3.4 Signature starting assets

Each hub starts with AI-owned business units in its specialty industries, so the world economy runs from turn one. Examples:

| Hub | Signature business units at start |
|---|---|
| Hsinchu-Taipei | Foundry (leading-edge logic and advanced packaging) |
| Seoul-Pyeongtaek | Foundry (memory), Consumer electronics, EVs (batteries) |
| Eindhoven | Lithography machines (the only maker in the world) |
| Shenzhen-Dongguan | Consumer electronics, EVs, Drones |
| Penang | Foundry (assembly, test and packaging) |
| Kolwezi-Lubumbashi | Mining (cobalt and copper) |
| Baotou | Mining (rare earths), Metals |
| Perth-Pilbara | Mining (iron ore and lithium), Gas (LNG) |
| Dhahran-Dammam | Oil, Chemicals |
| Doha | Gas (LNG) |
| Antofagasta | Mining (copper and lithium) |
| Houston | Oil, Gas, Chemicals |

Unit sizes live in hub data (January 2020 values, [7-starting-world.md](7-starting-world.md)) and are tuned so each industry's world supply roughly matches its demand at the start ([10-industry-economy.md](10-industry-economy.md) 10.0.3).

### 2.3.5 Location perks (Logan, 2026-10-17)

Perks belong to **locations**, not to company size. Only the big **financial and tech hubs** have perks (Logan, batch 24), each of the form **"every company that achieves X here gets Y"**. Any number of companies can hold the same perk; there is no ranking and no size threshold. Starting set **(A)**, values **(T)**:

| Hub | Achieve | Get |
|---|---|---|
| New York | HQ here | Investor confidence +5% |
| London | HQ here | -0.25 points on bonds issued |
| Zurich | HQ here, or a captive bank here | -0.25 points on loans; shell exposure -10% |
| Bay Area | HQ here and work in a Tech industry | R&D plan effects +10% |
| Hsinchu-Taipei | A Foundry business unit with assets here | Productivity +5% |
| Shenzhen-Dongguan | A Consumer electronics, Robotics or GPUs business unit with assets here | Productivity +5%; variable cost -3% |
| Singapore | HQ here | -0.25 points on loans; securities regulator strictness -1 |
| Bengaluru | A Software or SaaS business unit with assets here | Variable cost -5% (wages) |
| Tokyo-Yokohama | A Robotics business unit with assets here | Productivity +5% |
| Seoul-Pyeongtaek | A CPUs or Consumer electronics business unit with assets here | Productivity +3% |
| Frankfurt | HQ here | -0.25 points on loans from banks in the eurozone |

- **HQ** is the hub the corporation names as its head office; it can move it once a year.
- Perks apply to the whole corporation unless they name an industry, in which case they apply to that business unit's share of assets in the hub.
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

Shocks raise the oil and gas price indices and, through power plants that burn them, electricity prices, which raises costs for energy-heavy industries such as Foundry and Data centers. Players can profit by holding oil and gas businesses or futures ([3-markets-and-fx.md](3-markets-and-fx.md)).

---

## 2.5 Influence

### 2.5.1 Overview and order of calculation

Influence share is tracked **per holder per place** (district, hub, region, country). Holders are characters, family trusts, companies, dynasties and governments.

Monthly, for each holder and place:

1. Collect the holder's **attributed assets** in the place (2.5.4).
2. Convert them to **weighted value** with the asset weights (2.5.2).
3. **Base share** = weighted value / place mass (2.5.3).
4. Apply the **multiplier** (origin, history, reputation, foreignness, home, legacy) (2.5.6).
5. Add **flat points** (office, home district, roll-up prominence, goodwill) (2.5.5, 2.5.6).
6. Add the current **temporary pool** (ads, psyops, sponsorships, galas) and subtract backlash (2.5.7).
7. Clamp and normalize to get the **final share** (2.5.8).
8. Check **tiers** (2.5.9) and feed **Political Capital** ([4-politics.md](4-politics.md) 4.1.2).

Steps 1 to 5 run monthly (influence recalculation in [09-time-and-turns.md](../09-time-and-turns.md)). Step 6 changes daily and weekly as campaigns run and decay, and the displayed share updates with it. Tiers are checked weekly.

### 2.5.2 Asset weights

| Asset | Counted value | Weight | Counted at |
|---|---|---|---|
| **Real estate** (pool holdings, 2.16) | Market value | 1.0 | The pool's district, rolling up |
| **Business assets** | Book value of a business unit's assets in that city (its asset spread, [10-industry-economy.md](10-industry-economy.md) 10.0.2) | 1.0 | The district that fits the unit's industry (2.3.2), rolling up |
| **Jobs provided** | Yearly payroll of those business assets (the wage part of their operating costs) | 1.5 | As business assets |
| **Local government bonds** | Face value | 0.5 | The issuer's level: city bonds at the hub, regional bonds at the region, national bonds at the country |
| **Stakes in companies headquartered there** | Market value of the stake | 0.5 | The company's HQ hub, rolling up. Not counted for companies the holder controls (their assets count directly instead) |
| **Media outlets based there** | Book value of the outlets ([16-media.md](16-media.md)) | 0.6 | Their district, rolling up; plus **audience**: +0.25 pp per 1% of local audience share (flat) |
| **Financial holdings booked there** | Deposits and accounts at local banks, listed securities of non-local companies held through the local exchange | 0.15 | The hub of the bank or exchange, rolling up |

The 1.5 weight on payroll makes jobs the strongest influence per dollar: a labor-heavy business gives far more local power than the same value of empty real estate. This is intended: employers are courted, landlords are tolerated.

### 2.5.3 Place mass

| Place | Mass |
|---|---|
| **District** | Hub mass × district weight / sum of the hub's district weights (2.3.2) |
| **Hub** | Size class base mass × PF (2.3.1) |
| **Region** | The larger of 1.5 × the sum of its hub masses, or 3% of regional GDP |
| **Country** | 3% of national GDP |
| **Minor group member** | 3% of that country's GDP |

- **Floor rule**: a place's mass is never less than 1.25 × the total weighted assets of all modeled holders in it. This keeps assets alone from pushing any holder above 80%.
- Masses are recomputed yearly and when a hub changes size class or a country's GDP moves more than 10%.

Example masses: New York $120B; Penang $4.75B; Shenzhen-Dongguan $61B; Antofagasta $1.5B; United States $705B; China $420B; Chile $8.4B.

### 2.5.4 Holders and attribution

| Holder | Attributed assets |
|---|---|
| **Character** | Personal accounts and personal trusts |
| **Family trust** | Its own assets |
| **Company** | Its own assets plus each controlled vassal's attributed assets × autonomy factor: Wholly Integrated 1.0, Managed 0.9, Arm's Length 0.7, Independent Listing 0.5 (autonomy levels from [1-corporate-core.md](1-corporate-core.md) 1.7.2) |
| **Dynasty** | Family trust + personal assets of living members + companies the dynasty controls (the top company at 1.0, its vassals by the autonomy factor chain) + minority stakes as stakes (weight 0.5) |
| **Government** | State-owned assets; used for display and for the "public" remainder, never for tiers |

- **Which share applies to an action**: the best share among the acting holder and the dynasty that controls it. A company controlled by your dynasty uses the dynasty's Power broker tier for a permit even if the company alone holds 8%.
- **Family members** may use dynasty perks only when they hold the dynasty head as Friend or Neutral and they are not in a faction against the head.
- **Political Capital** is earned by the dynasty from the dynasty share, as defined in [4-politics.md](4-politics.md) 4.1.2.

### 2.5.5 Roll-up from district to country

Each level is computed with its own mass, using every asset inside it:

`Share(region) = (weighted assets in all hubs of the region + region-only assets such as hinterland business assets and regional bonds) / region mass`

The same rule applies from regions to the country, adding country-only assets (national bonds, national media audience).

**Prominence bonus** (flat, added at the higher level):

| Tier held at the lower level | Bonus at the next level up | Bonus two levels up |
|---|---|---|
| District Kingmaker | +1 pp in the hub | none |
| Hub Power broker | +1 pp in the region | none |
| Hub Kingmaker | +3 pp in the region | +1 pp in the country |
| Region Kingmaker | +3 pp in the country | none |

So a dynasty dominating one hub gets a real but modest voice in its region and country, as 05 requires.

### 2.5.6 Permanent modifiers

`Multiplier = Origin × History × Reputation × Foreignness × Home × Legacy`

**Origin** (born and raised, from [03-characters.md](../03-characters.md)):

| Origin link | District | Hub | Region | Country |
|---|---|---|---|---|
| Born in the hub | ×1.10 | ×1.10 | ×1.05 | ×1.03 |
| Raised in the hub | ×1.15 | ×1.15 | ×1.08 | ×1.04 |
| Born and raised in the hub | ×1.25 | ×1.25 and +1 pp | ×1.12 | ×1.06 |
| Raised in that district (home district) | +2 pp | none | none | none |
| Citizen of the country | none | none | none | Removes foreignness for that character |

- A character uses their own origin.
- A **dynasty** uses the best origin among its living adult members who hold the head as Friend or Neutral, or its **dynasty seat** (the hub where it was founded, or where two or more past heads were raised): seat gives ×1.15 in the hub and ×1.05 in the country. Use the higher of the two; they do not stack.
- A **company** uses its HQ instead of origin: ×1.10 in the HQ hub, ×1.05 in the HQ country.

**Dynasty history** (dynasties and companies; presence = base share of 1% or more):

| Continuous presence | Bonus |
|---|---|
| Each year for the first 10 years | +1% per year (to ×1.10) |
| Each further 4 years | +1% (to a maximum of ×1.25 at 70 years, about three generations) |
| Each year without presence | -2% (history fades, it does not reset) |

**Reputation**: `1 + reputation / 500` (reputation -100 to +100 gives ×0.8 to ×1.2). Notoriety traits on the dynasty head or the company CEO: Scandal-Ridden ×0.9, Media Darling ×1.05, Under Investigation ×0.95.

**Foreignness**: `1 - type penalty - 0.10 × C1 steps past Screened`, minimum 0.2. Type penalties come from [4-politics.md](4-politics.md) 4.2.1: Liberal democracy 10%, Managed democracy 30%, One-party state 50%, Corporate oligarchy 0%, Military junta 30%, Failed state 10%. C1 steps past Screened: Capped Strategic 1, Capped All 2, Closed 3.

| Situation | Foreignness rule |
|---|---|
| Holder whose dynasty and company HQ are both foreign | Full penalty (politics rule) |
| Dynasty with at least one adult citizen member (by birth or marriage) who holds the head as Friend or Neutral | Penalty halved |
| Assets held through a branch office with a local partner of 30% or more | Penalty halved on those assets |
| Company headquartered in the country but controlled by a foreign dynasty | The company itself has no penalty; the dynasty's roll-up takes the penalty |

**Home**: ×1.10 in the HQ hub of a company, as above.

**Legacy**: the "Political Machine" dynasty legacy gives ×1.05 ([1-corporate-core.md](1-corporate-core.md) 1.11.4).

**Flat points**:

| Source | Points |
|---|---|
| Political office | As listed in [4-politics.md](4-politics.md) 4.7.1 (for example Mayor +10 pp in the hub, Governor +8 pp in the region, Minister +3 pp in the country). Counts for the office holder and their dynasty |
| Born and raised in the hub | +1 pp (hub) |
| Home district | +2 pp (district) |
| Media audience | +0.25 pp per 1% audience share |
| Prominence bonus | 2.5.5 |
| Goodwill | From sponsorships and charity (2.5.7), decays 1% per month |

### 2.5.7 Temporary boosts

Costs scale with the **place mass**, so buying influence in a megacity or a whole country is far more expensive than in a small hub. "Per $1B" means per $1B of place mass.

| Boost | Cost | Max per campaign | Ramp | Run length | Weekly decay after it ends | Exposure risk | Other effects |
|---|---|---|---|---|---|---|---|
| **Ad campaign** | $60k per pp per 4 weeks per $1B | +5 pp | 50% in the first week, full from the second | 4 to 26 weeks, paid each 4 weeks | 25% | None (legal) | Buys media units from the local market (cost / $8,000 units); owning local media cuts cost 30%; can also push an ideology bloc's MediaBias +0.02 ([4-politics.md](4-politics.md) 4.4.5) |
| **Psyops** (bots, disinformation) | $25k per pp per 4 weeks per $1B | +10 pp | Full in 3 days | 2 to 12 weeks | 35% | Daily discovery roll (below); +5 political exposure per campaign start × surveillance multiplier ([4-politics.md](4-politics.md) 4.9.3) | Can push an ideology bloc's MediaBias +0.05 |
| **Sponsorship and charity** | $150k per pp per $1B for a 26-week package | +3 pp | Linear over 4 weeks | 26 weeks, renewable | 5% | Only if reputation is below -20: "washing" scandal 2% per month | +1 reputation per $5M × PF spent (max +10 per year); 25% of its pp become permanent Goodwill at the end of each package |
| **Event or gala** | $0.02 × adults in the hub ([4-politics.md](4-politics.md) 4.10.1), plus 6 hours of the host's time | +1 pp in the hub, +0.5 pp in its region | Instant | 2 weeks | 50% | None; a Hedonist host has a 5% scandal chance | A push of 5 toward Friend with all hub officials; the host rolls Befriend on 1 to 3 attending elite characters at Influence × 2% each; 1 gala per hub per month |

**Rules:**

- **Effectiveness**: bought pp × `(0.8 + director's Influence / 75)` for ads, sponsorships and galas; × `(0.8 + director's Intrigue / 75)` for psyops (×0.8 to ×1.2). The director is the character assigned to run the campaign.
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
| Reputation | -10 (-20 if an election is under way in that jurisdiction) |
| Exposure | +15 with the Financial Police and the Data Authority |
| Liberal democracy | 30% chance an investigation chain opens |
| One-party state, military junta | The regime treats it as hostile: foreign holders advance one step on the seizure ladder ([4-politics.md](4-politics.md) 4.9.10); domestic holders give the regime a hook over the director |

### 2.5.8 Final share

`Final share = clamp(Base share × Multiplier + Flat points + Temporary pp + Goodwill - Backlash, 0, 95)`

**Normalization**: if the final shares of all top-level holders in a place (dynasties, independent companies, governments and the unmodeled public) add up to more than 100%, every one is scaled down in proportion. Holders inside a dynasty are not added separately for this check.

### 2.5.9 Tiers and hysteresis

| Tier | Threshold | Gained | Lost |
|---|---|---|---|
| **Presence** | 10% | At a weekly check with final share ≥ 10% | After 4 weekly checks in a row below 8%, or 13 in a row below 10% |
| **Power broker** | 25% | At a weekly check ≥ 25% | After 4 weekly checks in a row below 23%, or 13 in a row below 25% |
| **Kingmaker** | 50% | At a weekly check ≥ 50% | After 4 weekly checks in a row below 48%, or 13 in a row below 50% |

The 2 pp band stops tiers flickering when a campaign decays. The 13-week (one quarter) rule means a tier won with a campaign must be backed by assets within a quarter or it is lost.

### 2.5.10 Perks by tier and level

Districts give **economic perks only**. Political perks start at the hub (the local government level).

| Tier | District | Hub (local) | Region | Country |
|---|---|---|---|---|
| **Presence** (10%) | New construction in the district's real estate pools shown 3 days early (2.16.2) | All district perks hub-wide; permit time -15%; Meet Official with local officials costs 0 PC once per week | Regional licences 2 weeks faster; Meet Official with regional officials free once per week | Meet Official with ministers free once per week; Foreign Investment Review time -25% |
| **Power broker** (25%) | First refusal on new construction in the district's pools: 7 days to buy at the pool price +5% | First refusal on new pool construction and local tenders hub-wide; one Request Decision for rezoning per quarter at 0 PC (automatic approval under E11 Developer-Led); construction time -15%; one property tax deal per year (E10 -25% on own real estate for 5 years, as a Request Decision); local lobby points +25%; S2 Privatized policing contracts allowed; unlocks the **Political Connections** founding path ([1-corporate-core.md](1-corporate-core.md) 1.6.7) | One regional incentive deal per year (E9 corporate surcharge waived on new business assets for 5 years); regional contract bid score +10; priority for new infrastructure projects in your hubs; regional lobby points +25% | Eligible for E6 subsidies without a tender; national contract bid score +10; national lobby points +25%; meetings with the central bank governor and regulator heads |
| **Kingmaker** (50%) | Veto a rival's real estate purchase in the district (10 PC) | Veto a rival's permit or acquisition in the hub (20 PC; the rival can override with 40 PC or a court case); appointment score +30 for police chief and permit office head; +0.3 Candidate utility for local candidates you back ([4-politics.md](4-politics.md) 4.6.3); local investigations lose 1 Evidence per week and local Request Protection costs 0 PC; local contract bid score +20 | Appoint one regional cabinet member per year (appointment score +30); +0.2 Candidate utility for backed regional candidates; veto a rival's regional licence (30 PC); regional Request Protection costs 0 PC | Appointment score +30 for one minister or regulator head per year; +0.15 Candidate utility for backed national candidates; one tariff or subsidy change per year handled as a Decision instead of a Law; national Request Protection cost halved; foreign holders' branch office seizure risk -1 point |

Kingmaker in a hub for 12 months is also the first requirement of corporate sovereignty ([4-politics.md](4-politics.md) 4.12.2).

### 2.5.11 Tooltip breakdown

Every share shows its lines, for example (Penang, dynasty):

```
Weighted assets in Penang           $294M
Place mass                          $4.75B
Base share                          6.19%
  × Origin (born and raised)        ×1.25
  × Foreignness (halved)            ×0.95
  × History (3 years)               ×1.03
  × Reputation (+20)                ×1.04
Flat: born and raised               +1.00
Temporary: ad campaign              +4.00
Temporary: gala                     +1.00
Final share                         13.9%  (Presence)
```

## 2.6, 2.7, 2.9 to 2.13 and 2.15: the economy (moved)

The economy is industries, business units and corporations, Wall Street Raider style: see [10-industry-economy.md](10-industry-economy.md) 10.0. The old goods (2.6), production methods (2.7), hub prices (2.9), supply contracts (2.10), disruptions (2.11), tech tree (2.12), financial statements (2.13) and competition (2.15) sections are gone; population stays in 2.8 and the influence worked examples in 2.14.

**Climate, pollution and infrastructure (Logan, batch 75).** These are not systems. Infrastructure is not an asset class, and climate shows up only as events (storms, heat waves, floods) that hit hubs and business units ([13-events.md](13-events.md)).

---

## 2.8 Population and labor

### 2.8.0 Strata (Logan, 2026-10-17)

**Strata are income levels, not character classes**. Five strata, bottom to top: Permanent Underclass, PMC, Glitterati, Nobles, Oligarchs (Victoria 3 calls them strata). Every named character has a stratum set by their **character resources**: assets, clout, income, prestige and vril ([1-corporate-core.md](1-corporate-core.md) 1.1.0). Population segments (2.8.1) also sit in a stratum.

| Stratum | Who is in it (Logan) | Population segments **(A)** |
|---|---|---|
| **Permanent Underclass** | People stuck unable to get the money together to gather assets, caught in a debt spiral. Underpaid and underemployed. Docile if their **slop** needs are met | Unskilled Workers, Gig Workers, Unemployed |
| **PMC** (professional-managerial class) | From skilled union labor to yuppies and low-level executives, doctors, any wagie with a normie job, and high achievers in many low-profile fields | Skilled Workers, Professionals |
| **Glitterati** | High-level executives, influencers, athletes. Named characters with skill ratings in fields that boost the organizations, companies or firms they are affiliated with. Often rich in assets, but rarely have the skills to leverage Techno-Capital, so they don't buy it | Elite |
| **Nobles** | People who by bloodline will always have clout or influence. They do not necessarily have or pursue assets, but can be very rich, and ruthless in guarding the influence they have amassed. The status fades over generations: the grandchild of a head of state is not a Noble unless they did enough in their own life | None (named characters only) |
| **Oligarchs** | The top stratum. At least a board seat on one monopoly or $1 billion in assets, plus a certain amount of Techno-Capital (Logan) | None (named characters only) |

**How a character's stratum is set (Logan).** Various factors, but mainly **assets, capital and income**. Each stratum has its own criteria, such as a certain amount of assets or of Techno-Capital. Example: an **Oligarch** must at least sit on the board of one monopoly or hold assets totaling $1 billion, and must control a certain amount of Techno-Capital. **Strata, bottom to top (Logan):** Permanent Underclass, PMC, Glitterati, Nobles, Oligarchs. The bars for each are still to be set.

**Slop (Logan, 2026-10-17).** The Permanent Underclass has **one need: slop**. Slop is a **byproduct of every company's production**: the trickle-down of freemium goods, ad-funded apps, junk content and the like.
- Slop is **not sold**. It is passively consumed from the production in an area, and it **cannot be imported or exported**.
- **Too little slop** and the population of the area grows unstable.
- **Too much slop** (a surplus) and education, health and the birth rate start to suffer.

Slop rules:
- **Companies do not choose how much slop they make** (Logan). Each industry has a **slop rate** per $1M of revenue ([10-industry-economy.md](10-industry-economy.md) 10.3). A hub's slop output is the sum over every business unit with assets in the hub of its revenue there × its industry's slop rate.
- **Slop need** = Underclass population in the hub (millions) × 100,000 per month **(T)**.
- **Slop ratio of the hub** = output ÷ need.

| Slop ratio | Effect on the hub **(T)** |
|---|---|
| Below 0.8 | Underclass unrest +1 per month for every 0.1 below 0.8 |
| 0.8 to 1.2 | Stable: Underclass unrest held at its floor |
| Above 1.2 | Surplus: for every 0.1 above 1.2, education quality -1%, health -1% and birth rate -1% per year in the hub |

**Debt spiral (A).** A PMC member whose savings go negative for 6 months **(T)** drops into the Permanent Underclass. Climbing back needs 12 months **(T)** of positive savings plus a PMC job. Named characters can fall the same way (John Techno starts close to it; Samir Haddad starts in it).

**Glitterati fields (A).** Each Glitterati character rates 1 to 20 in one or two fields (Management, Media, Sport, Entertainment, Fashion, Law, Medicine). Affiliation (an executive post, an endorsement, a board seat) gives the organization a bonus of 1% per rating point in matching work **(T)**. Glitterati get a -5 penalty to Techno-Capital allocation checks **(T)**.

**Noble fade (A).** Bloodline gives Noble children a large clout and prestige start. A grandchild keeps Noble standing only by earning 500 renown **(T)** in their own life; otherwise the line's clout fades.

### 2.8.1 Segments

Population is tracked per hub as six segments of the labor force (half the metro population). Wages are monthly at WI 1.0 and are multiplied by the country's WI and the local tightness factor (2.8.4).

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

**Needs satisfaction** (0 to 1) is the share of a segment's needs that its spending covers in the hub. It feeds unrest (2.8.5) and migration (2.8.4). Money left over is **saved** into hub deposits (banks, [3-markets-and-fx.md](3-markets-and-fx.md) 3.17).

### 2.8.3 Default segment mix

Share of the labor force (%) by country income tier, then adjusted by hub type.

| Income tier | Elite | Professionals | Skilled | Unskilled | Gig | Unemployed |
|---|---|---|---|---|---|---|
| High (WI ≥ 0.6) | 1 | 28 | 25 | 22 | 16 | 8 |
| Middle (WI 0.2 to 0.6) | 1 | 15 | 25 | 32 | 15 | 12 |
| Developing (WI < 0.2) | 0.5 | 7 | 15 | 40 | 22 | 15.5 |

| Hub type adjustment | Change in points |
|---|---|
| Global finance hub (New York, London, Hong Kong, Singapore, Zurich) | Elite +1, Professionals +8, Skilled -4, Unskilled -5 |
| Tech hub (Bay Area, Bengaluru, Hsinchu-Taipei, Tel Aviv) | Professionals +10, Skilled +2, Unskilled -8, Gig -4 |
| Industrial hub (Shenzhen-Dongguan, Ho Chi Minh City, Penang, Mexico City) | Skilled +6, Unskilled +6, Professionals -6, Gig -6 |
| Resource town (Antofagasta, Kolwezi-Lubumbashi, Baotou, Perth-Pilbara, Dhahran-Dammam) | Unskilled +10, Skilled +4, Professionals -6, Gig -8 |
| Megacity with large Slums (Lagos, Cairo-Suez, Mumbai, Jakarta) | Gig +6, Unemployed +4, Skilled -5, Professionals -5 |

### 2.8.4 Hiring, wages, training and migration

- **Local wage (monthly)**: `Wage = base wage × WI × tightness`, where `tightness = clamp(1 + 2 × (employment rate of the segment - 0.95), 0.85, 1.6)`. Wages move at most 3% per month (sticky), except for one-off law effects (L2 Sectoral Bargaining +8%). L1 Minimum Wage sets a floor as a share of the hub's median wage.
- **Training programs** (company action): Unskilled to Skilled costs $12,000 × WI per worker over 6 months (85% complete); Skilled to Professional costs $40,000 × WI over 24 months.
- **Natural education (yearly)**: 1% of Unskilled become Skilled; 0.5% of Skilled become Professionals.
- **Migration (monthly)**: inside a country, 0.5% of a segment moves to the hub where `wage × needs satisfaction` is 20% or more higher. Between countries, migration follows L5 Immigration ([4-politics.md](4-politics.md) 4.5.5).
- **Population growth (yearly)**: developing 2%, middle 1%, high income 0.3% (T).

### 2.8.5 Unrest

Unrest (0 to 100) is tracked per segment per hub. Monthly:

```
Target unrest = segment offset
              + 50 × (1 - needs satisfaction)
              + 1.5 × max(0, local unemployment% - 6)
              + 1.2 × max(0, inflation% - 4)                (12 months, local currency)
              + 0.5 × max(0, real wage fall% over 12 months)
              + 3 × automation layoffs in the segment over 12 months, as % of the segment
              + law terms ([4-politics.md](4-politics.md): L2 Banned +5, S2 Militarized +3, Community -3, Carbon Pricing rebate -2, E11 Developer-Led +3 in Residential and Slums)
              + 5 if an ideology bloc the segment leans to is Angry (4.4)
              + event modifiers (a strike crushed by force +10, price controls on essentials -2)
              - 5 if union contracts cover 50% or more of the segment's jobs in the hub
```

Segment offsets: Elite 5, Professionals 10, Skilled 10, Unskilled 13, Gig 15, Unemployed 25.

**Actual unrest moves 25% of the way toward the target each month.** Hub unrest (population-weighted) feeds the politics stability formula ([4-politics.md](4-politics.md) 4.11.7).

| Unrest | Band | Effects |
|---|---|---|
| 0 to 24 | Calm | none |
| 25 to 39 | Restless | Ad campaign effectiveness -10% in the hub |
| 40 to 59 | Agitated | Strike checks active; protests; output of business units with assets in the hub -3% |
| 60 to 79 | Radical | Riot chance 5% per month (retail closed 3 days); output -8%; real estate pool prices in the hub -1% per month |
| 80 to 100 | Insurrection | Output -20% in the hub; feeds revolution pressure ([4-politics.md](4-politics.md) 4.8.5) |

### 2.8.6 Unions and strikes

**Organization** (O, 0 to 100) is tracked per working segment per hub (Professionals, Skilled, Unskilled, Gig). Monthly change:

```
ΔO = 0.1 × (unrest - 30)
   + L2 term: Banned -3 (O capped at 20), Restricted -1, Recognized 0, Sectoral Bargaining +2
   + 1 if one employer in the hub employs 2,000 or more of the segment
   + 1 per strike won in the hub in the last 12 months
   - 2 if the segment's wages are 110% or more of its hub average at the big employers
   - 1 for Gig workers under L4 Contractors (dispersed workforce)
```

**Union recognition**: in a business unit with 200 or more workers of a segment in the hub, when the hub's O for that segment is 35 or more, a union forms with 10% chance per month (×2 after a layoff wave). A **union contract** follows a recognition event: wages +5%, layoffs need 3 months' notice and double severance, and automation triggers a negotiation event.

**Strike checks** (unionized business units, per hub):

| Check | Chance |
|---|---|
| Monthly | `max(0, (unrest - 35) / 100) × (O / 100) × law factor`; law factor: Restricted 0.5 (0 in strategic sectors), Recognized 1.0, Sectoral Bargaining 1.2 |
| Immediate vote: automation or layoffs above 10% of the unit's workforce in the hub | `0.25 + 0.5 × O / 100` |
| Immediate vote: wage cut | `0.15 + 0.5 × O / 100` |
| Immediate vote: fatal accident | 0.30 |
| Immediate vote: union leader fired | 0.50 |

**During a strike**: the striking segments stop; the unit's output in the hub runs at ×0.1 if only some segments strike and ×0 if all do. Strikers are not paid; upkeep and other wages continue.

**Union resolve** (R) starts at `20 + O / 2` and changes daily:

| Daily change | Value |
|---|---|
| Base | -2 |
| Lockout by the company | -1 more |
| Public support (company reputation below 0, or Communist bloc clout 20% or more in the country) | +0.5 |
| Strike fund financed by anyone (Fund Ideology for the Communists, [4-politics.md](4-politics.md) 4.10.1) | +0.5 |
| Replacement workers hired | -2 |

The strike ends when R reaches 0 (workers return; segment unrest +5; O -10) or when the company accepts the demands.

**Demands** (1 to 3 rolled): wages +5% to +15%; cancel or delay automation by 12 months; rehire laid-off workers; double severance; safety spending.

**Company options** (event):

| Option | Result |
|---|---|
| Concede | Demands met; union O +5; segment unrest -5 |
| Negotiate | Success chance `40% + (negotiator's Influence or Operations - 10) × 3% + 10% if company reputation > 20`. Success: half the demands. Failure: strike continues, R +10 |
| Lockout | Output 0; R falls faster; reputation -5; segment unrest +5 |
| Hire replacements (where labor law allows) | Productivity 60% in the first month; riot chance 15%; union O +5 |
| Security crackdown (corporate security) | R -30 at once; reputation -15; segment unrest +10; riot chance 25%; investigation chance 20% in liberal democracies |
| Close the operation in the hub | Layoffs with severance; strike ends; unrest from layoffs |

**Spread**: under Sectoral Bargaining a strike spreads to each unionized business unit of the same industry in the country with 30% chance. A sympathy strike hits same-industry units in the hub with 20% chance when O ≥ 60. A **general strike** happens when hub unrest is 70 or more and Skilled or Unskilled O is 60 or more: every business unit's output in the hub runs at ×0.5 for 3 to 10 days. Typical strikes last 5 to 40 days. **Port strikes** cut the output of Shipping and Logistics units in the hub to ×0.2.

---

## 2.14 Worked examples

Influence examples. All numbers use the tuning values above. Rounding is to the nearest useful digit.

### 2.14.1 Getting Presence in Penang

**Setup.** A US dynasty's flagship has a Foundry business unit (chip packaging) with $106.5M of business assets in Penang. The heir was born and raised in Penang (she holds Malaysian citizenship) and holds the head as Friend. The dynasty also bought $90M of a Penang residential pool, $45M of an industrial pool and $80M of Penang city bonds. Malaysia: liberal democracy, C1 Screened, WI 0.25, PF 0.475, BI 0.70. Dynasty reputation +20, 3 years of presence.

**Assets.**

| Item | Value | Weight | Weighted |
|---|---|---|---|
| Business assets (packaging) | $106.5M | 1.0 | $106.5M |
| Jobs: payroll of those assets, $0.79M per month, $9.5M per year | $9.5M | 1.5 | $14.3M |
| Residential pool share | $90M | 1.0 | $90M |
| Industrial pool share | $45M | 1.0 | $45M |
| City bonds | $80M | 0.5 | $40M |
| **Total** | | | **$295.8M** |

**Share.** Penang mass = $10B × 0.475 = $4.75B. Base share = 295.8 / 4,750 = **6.23%**.

Multiplier = origin 1.25 (born and raised) × foreignness 0.95 (Liberal democracy 10% penalty, halved by the citizen heir) × history 1.03 × reputation 1.04 = **1.272**. 6.23% × 1.272 = 7.92%, plus 1 pp flat for born and raised = **8.92%**. No tier yet.

**Campaign.** Temporary cap = max(6, 6.23) = 6.23 pp. An ad campaign of 4 pp costs 4 × $60,000 × 4.75 = **$1.14M per 4 weeks**; the heir directs it (Persuasion 15, effectiveness 1.0). She also hosts a gala: 1.4M adults × $0.02 = **$28,000** and 6 hours, +1 pp for 2 weeks, a push of 5 toward Friend with every Penang official, and two Befriend rolls at 30%.

Final share = 8.92 + 4 + 1 = **13.9%: Presence** at the next weekly check. Political Capital in Penang: 100 × sqrt(0.139) = **37 PC per month**. The dynasty now gets permits 15% faster in Penang and a free weekly meeting with local officials.

**Keeping it.** The ad runs 8 weeks ($2.28M). After it ends, 3.1 pp (half the base share) is anchored and decays at 12.5% per week, the rest at 25%. The share falls below 10% about 10 weeks later. Under the 13-week rule the dynasty must add assets within a quarter: growing the Penang packaging assets by another $106.5M (plus $14.3M of jobs weight) lifts the base share to 8.77% and the final share to 8.77 × 1.272 + 1 = **12.2%** without any campaign.

**Roll-up.** Penang state (region) mass = 1.5 × $4.75B = $7.1B. Region share = 295.8 / 7,125 = 4.15% × (1.12 × 0.95 × 1.03 × 1.04 = 1.14) = **4.7%**. Malaysia mass = 3% × $400B = $12B: country share = 2.47% × 1.079 = **2.7%**, worth 16 PC per month nationally.

### 2.14.2 A foreign branch office tries to buy a foothold in Shenzhen

**Setup.** The same dynasty's flagship sets up a branch office in Shenzhen-Dongguan (China: one-party state, C1 Capped All, C2 Local Partner 30%, T4 Mass Surveillance). The branch is 70% flagship, 30% a Shenzhen family (local partner loyalty 65). It runs a Consumer electronics business unit (smartphone assembly) with $432M of business assets in the hub.

**Assets.** Business assets $432M. Jobs: payroll $8.4M per month = $100.8M per year, × 1.5 = $151.2M. Total weighted: **$583M**.

**Shares.** Shenzhen-Dongguan mass = $120B × 0.51 = $61.2B.

| Holder | Calculation | Share |
|---|---|---|
| Branch office (HQ in Shenzhen, not foreign) | 583 / 61,200 = 0.95% × home 1.10 | **1.05%** |
| Dynasty (foreign) | 583 × 0.9 (Managed autonomy) = 525 → 0.86% × foreignness | **0.56%** |

Dynasty foreignness: 1 - 0.50 (one-party) - 0.20 (Capped All is 2 steps past Screened) = 0.30; halved penalty for branch assets with a 30% partner gives 1 - 0.35 = 0.65.

**Psyops.** The player wants Presence fast and runs the maximum psyop the cap allows: max(6, 0.95) = 6 pp, at 6 × $25,000 × 61.2 = **$9.2M per 4 weeks**, directed by a fixer with Intrigue 15. Branch share = 1.05 + 6 = **7.05%**: still not Presence. Temporary boosts alone never reach a tier.

**Risk.** Daily discovery = (0.2% + 0.03% × 6) × 1.5 × (1 - 15/60) = **0.43% per day**: 11% over 4 weeks, 30% over 12 weeks. Political exposure +5 × 1.5 = +7.5 at campaign start. If discovered: the 6 pp vanish, backlash of -12 pp decaying 10% per week (the share is clamped at 0), reputation -10, exposure +15, and the regime advances the seizure ladder to Step 1: *Beijing Calls* demands the local partner's stake rise to 40%.

**Better play.** Let the local partner's family (14% hub share, Presence, Shenzhen-born) file permits and meet officials; keep partner loyalty at 60 or more (seizure risk -0.5 points). The monthly seizure risk is 0.3 (one-party) + 30/50 (relation -30 with the United States) - 0.5 = **0.4% per month** ([4-politics.md](4-politics.md) 4.9.10).

---

## 2.16 Real estate (Logan, 2026-10-17)

Real estate is the most direct asset-as-title in the game: it holds value, pays rent and buys local influence (2.5.2). It is **pooled**: there are no individual plots or buildings to pick. Each **district** of a hub (2.3.2) has up to four **pools**, and holders own a dollar share of a pool.

### 2.16.1 Pools (Logan: districts and four types)

| Pool | What it is | Rented by |
|---|---|---|
| **Commercial** | Offices, retail, hotels, labs | Company headquarters, offices, retail and services |
| **Residential** | Housing | Population (rent from residents by stratum, 2.8.0) |
| **Industrial** | Plants, fabs, warehouses, data center shells, ports, refineries, mines' surface works | Business units in heavy and technical industries: Foundry, Data centers, Power utilities, Oil, Chemicals and the like |
| **Land** | Undeveloped land, including resource land in Resource Fields | Nobody; it is held for appreciation and for development |

**Starting pool sizes (T)** for an L hub at PF 1.0, scaled by hub size (S 0.3, M 0.6, L 1.0, XL 1.5, Mega 2.2) and PF:

| District | Commercial | Residential | Industrial | Land |
|---|---|---|---|---|
| F Financial | $20B | $4B | none | $1B |
| T Tech Park | $6B | $1B | $10B | $2B |
| P Port | $2B | none | $8B | $1.5B |
| I Industrial | $1B | $0.5B | $5B | $1B |
| R Residential | $3B | $15B | none | $1B |
| S Slums | $0.3B | $2B | $0.2B | $0.2B |
| X Resource Field | none | $0.1B | $1B | $3B |

At the start each pool is owned by dispersed small owners (40% to 70%), governments (10% to 30%) and AI property funds and dynasties (the rest) **(T)**.

### 2.16.2 Growth and development (T)

- Pools grow each year with the hub's population (2.17.1): residential by the population growth rate, commercial and industrial by half of it.
- **New construction events** add to a pool (a new tower, a rezoned industrial park), sold first to whoever funds them.
- **Developing land**: a holder of a Land pool share can convert it into Commercial, Residential or Industrial in the same district by paying a build cost (1.5× the land value converted, 12 to 24 months **(T)**). The new share lands in the target pool at its current price, so development pays when the target pool is pricier than land plus build cost.

### 2.16.3 Price, occupancy and rent

Each pool has a price index, 100 at the start. Each month **(T)**:

`change = cycle drift (2.16.5) + 0.3 × (occupancy - 90%) - rate sensitivity × change in the country's policy rate`

- **Cycle drift** follows the hub's property cycle (Boom +1% to +2.5% a month, Bust -1% to -3%).
- **Occupancy** = rental demand ÷ the pool's rentable stock. Demand comes from residents (residential), business units (commercial and industrial) and nothing for land.
- **Rate sensitivity**: residential 3, commercial 2, industrial 1.5, land 4 (a 1-point rate rise cuts land 4%) **(T)**.
- The owner chooses what share of each holding to rent out (Logan). The rented share earns the pool's rent rate; the rest earns nothing but appreciation.
- **Rent rate** = base yield × (rental demand ÷ available stock)^0.5 **(T)**, with base yields: commercial 5%, residential 4%, industrial 6%, Slum residential 9% (+1 unrest per $100M rented), land 0.
- **Renting space for a business unit**: a business unit rents from the commercial or industrial pool of the district where its assets sit (heavy and technical industries need Industrial; offices and retail need Commercial). Its rent is the pool's rent rate on the value it occupies, paid to the owners who rent out their shares, in proportion.
- **Buying the space**: a corporation that buys the space for its business unit buys that much of the pool; it sits on the balance sheet and appreciates.
- If a district's pool has no available stock, a business unit must rent in another district, buy out owners at a premium, or develop land.

### 2.16.4 Buying and selling (Logan)

- Buy **any dollar amount** of a pool at its current price, plus 2% fees **(T)**.
- Selling is instant up to the pool's monthly turnover (2% of the pool in Boom and Peak, 1% in Recovery, 0.5% in Bust **(T)**); larger sales queue and fill week by week, so selling in a slump can take weeks or months. Selling at once costs a 15% discount.
- Holdings count toward influence in their district (2.5.2) by value.

### 2.16.5 Property cycles

Each hub has a **property cycle** with four phases, updated monthly:

| Phase | Value change per month | Occupancy | What drives it |
|---|---|---|---|
| **Boom** | +1.0% to +2.5% | 95% to 100% | Population growth, cheap credit, foreign buyers |
| **Peak** | 0% to +0.5% | Falling | Oversupply from new construction, rate rises |
| **Bust** | -1.0% to -3.0% | 75% to 90% | Rate rises, recession (2.18), unrest, disasters |
| **Recovery** | 0% to +1.0% | Rising | Cheap assets, rate cuts |

Phase changes are rolled monthly; the chance to move on rises with each month in the phase and with the drivers (for example, each 1 point rise in the policy rate adds +5% chance of Boom moving to Peak). A **bubble** forms when a Boom lasts over 36 months: values gain an extra +1% per month, and the eventual Bust is twice as deep.

### 2.16.6 Gentrification and slum clearance

- A Slum district whose residential pool price rises over 50% in 5 years becomes a candidate for **gentrification**: on a yearly roll (30%), it converts to Residential and its pools grow toward Residential sizes (2.16.1). Gig and Unemployed segments are pushed to another Slum or out of the hub; unrest +10 in the hub for a year.
- **Slum clearance** (a government or a Power Broker can push it): the district is rezoned, residents displaced (+15 unrest; the Communist bloc's approval falls). Land pool price ×3 over 2 years.
- **Slum spread**: a Residential district with unrest over 60 for 2 years and falling pool prices converts to Slums.

### 2.16.7 Tax (Logan: own rates)

Each country sets property tax on value (0.2% to 2% a year), tax on rent income (at its income or corporate rate) and tax on gains when sold (0% to 30%), with land taxed highest where a vacancy or land-value tax law applies ([4-politics.md](4-politics.md) E10) **(A)**.

## 2.17 Hub life cycle

Hubs grow, decline and change over decades.

### 2.17.1 Population change (yearly)

```
Growth % = natural growth (country value, -0.5% to +2.5%)
         + job pull: 2% × (jobs available - labor force) / labor force
         + wage pull: 1% × (hub average wage / national average wage - 1)
         - housing squeeze: 1% per 10% that housing cost exceeds 30% of Professional income
         - unrest push: 0.5% per 10 points of hub unrest above 40
         - disaster and war losses
```

Migration between hubs follows the same terms: workers move from low-scoring hubs to high-scoring ones in the same country (and across borders when L5 Immigration is Managed or Open).

### 2.17.2 Growth and decline effects

- **Size class change** at the yearly review (2.3.1): the hub gains districts, and their new pools are sold first to whoever funds the construction (2.16.2). Each new district's type is chosen by the hub's needs: Residential if housing is short, Industrial or Tech Park if jobs are planned, Slums if growth outpaces housing by more than 20%.
- **Decline**: a hub losing population for 5 years in a row loses mass (-2% per year), pool prices fall, and a district can be **abandoned** (becomes Slums, or its pools turn to Land). A hub can drop a size class.

### 2.17.3 New hubs

New hubs appear in three ways:

- **Promotion** of a minor location: when a "rest of country" region gets enough business assets (total value over $5B), a new S hub forms there. The company that triggered it gets a +10 pp founding bonus to influence for 10 years.
- **Special economic zones** (C6): a government (or a dynasty with Kingmaker national influence) founds a zone hub on empty land with Tax or Charter rules.
- **Charter cities** from corporate sovereignty ([4-politics.md](4-politics.md) 4.12).

## 2.18 Business cycle and macro shocks

### 2.18.1 National cycle

Every major country has an economic cycle phase, updated monthly:

| Phase | Demand modifier | Unemployment | Default chance (companies) | Typical length |
|---|---|---|---|---|
| **Expansion** | +0% to +3% | Falling | ×0.7 | 3 to 8 years |
| **Overheating** | +3% to +5%, inflation rising | Very low | ×0.8 | 6 to 24 months |
| **Contraction** (recession) | -3% to -8% | Rising | ×2.0 | 6 to 18 months |
| **Recovery** | -1% to +2% | High, falling | ×1.2 | 1 to 3 years |

**Drivers** that shift phase chances each month: credit growth (loans issued by all holders vs GDP), the policy rate versus its neutral level, commodity price shocks (oil above 150% of its 12-month average adds +5% contraction chance per month), stock market drops over 20%, real estate busts in the largest hub (2.16.5), wars, pandemics, and confidence (a hidden 0 to 100 value moved by news events).

The demand modifier applies to industry demand through each industry's cyclicality ([10-industry-economy.md](10-industry-economy.md)). Governments respond with budget changes; central banks with rates ([3-markets-and-fx.md](3-markets-and-fx.md)).

### 2.18.2 Global cycle

The **global cycle** is the GDP-weighted average of national phases. When the 3 largest economies are in contraction at once, a **global recession** event fires: commodity demand -10%, shipping rates -30%, all exchanges' sentiment -20.

### 2.18.3 Crises

| Crisis | Trigger | Effects |
|---|---|---|
| **Housing crash** | A bubble (2.16.5) bursts in a country's largest hub | Property values -30% to -50% over 2 years; banks with real estate loans hit; recession chance +30% |
| **Tech bubble** | A sector's average price-to-earnings ratio above 2.5× its long average for over a year | Sector stocks -50% to -80% over 6 to 12 months; VC funding -70% for 2 years (fewer funding rounds succeed) |
| **Debt crisis** | Country debt above its limit, or a company group with debt over 6× earnings defaults | Bond yields jump; bailout or default chain ([4-politics.md](4-politics.md)) |
| **Commodity super-cycle** | Sustained demand above world capacity for a commodity industry (Mining, Metals, Oil, Gas, Agriculture) | Prices +50% to +200% for years |

These crises are the macro background the player can ride, bet against or be ruined by.

## 2.21 Travel and private jets

Characters are physically somewhere on the map, and getting them where the deals are is a system of its own.

### 2.21.1 Location and residence

- Every character has a **current location** (a hub) and a **residence** (a hub; sets tax residency for E1 and E4). Homes themselves are **flavor only** (Logan, 2026-10-18): a character's house, flat or lease is not a property holding and gives no influence.
- Meetings, galas and most character actions need both characters in the same hub. A **remote call** works for any meeting at -30% effectiveness (pitches, negotiations, persuasion). Some actions are in-person only: galas, Seduce, signing a founding round, family weddings and funerals.
- The dynasty names one hub as its **seat**: +3 pp dynasty influence there, family events happen there, and moving the seat takes 3 months of disruption (a push of 10 toward Rival from the family).

### 2.21.2 Ways to travel

| Mode | Time | Cost per trip (T) | Notes |
|---|---|---|---|
| Car or rail (same region) | 1 to 4 hours | Negligible | |
| Helicopter | 1 hour within a hub's region | $5,000 | Skips traffic; needs a helipad |
| Commercial flight, first class | 4 hours domestic, 8 to 16 hours international | $1,000 domestic, $15,000 international | Fixed departures (one every 6 hours on major routes); visible to the public; no work in flight beyond calls at -50% |
| Charter jet | Like a private jet | $20,000 to $150,000 by distance and class | Booked 12 hours ahead; no ownership cost |
| Fractional jet share | Like a private jet | $2M a year for 200 flight hours | Booked 6 hours ahead |
| **Owned private jet** | Fastest door to door | Running cost per flight hour (2.21.3) | Leaves when you say; status; office cabin |
| Superyacht | Days | Upkeep only | A floating venue for galas and secret meetings (2.21.7) |
| Suborbital hop (late game) | 2 hours anywhere | $500,000 | Cyberpunk accent |

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
- **Status**: the class's status value counts as a push toward Friend at galas and in first meetings with Ambitious, Greedy or Socialite characters, and counts toward reputation among the Elite. Ascetic and Honest characters instead push 5 toward Rival on an owner below Tycoon standing who flies a Large cabin jet or bigger ("showing off").
- **Upgrades** (each a one-time cost):

| Upgrade | Cost | Effect |
|---|---|---|
| Office cabin | $2M | Work in flight (2.21.4) |
| Secure comms suite | $3M | Calls in flight at full effectiveness; -50% chance of being overheard by hacking ([17-hacking.md](17-hacking.md)) |
| Bedroom suite | $1M | Arrive rested: no jet lag stress (2.21.5) |
| Medical bay | $4M | Safer travel for old or ill characters; death chance in flight halved |
| Security package (armor, decoy flares, counter-surveillance) | $6M | Halves attack and kidnap risk on arrival; hides flight plans from Tier 1 trackers |
| Ghost registration (registered through a shell in a haven) | Cost of a shell company | Flight tracking needs Investigate Shell first (2.21.6); adds exposure |

- **Maintenance**: each jet needs 1 week of maintenance every 400 flight hours. Skipped maintenance raises the crash chance (2.21.8).
- **Home base and hangar**: a jet is based at an airport hub (the dynasty seat by default). Repositioning an empty jet costs its flight hours.
- **Leasing and chartering out**: a jet can be leased from a property or aviation fund (12% of its price a year), and an owned jet can be **chartered out** when idle, earning 60% of its running cost back per hour chartered.
- **Fleets**: an Airlines business unit can run a jet fleet as a charter service, selling flight hours to AI and player characters.

### 2.21.4 Itineraries and in-flight work

- The player plans **itineraries**: a list of hubs with meetings at each stop. The planner shows total hours, cost, and time-zone effects, and books the jet or flights.
- An **entourage** travels together: family members, executives and security staff on the same jet, up to its seats. Characters on a trip together push 1 toward Friend with each other per 10 hours flown (none if they are Rivals).
- **In-flight work** with an office cabin: Finance, Intrigue and Tech actions that do not need another person (planning a deal, reviewing a scheme, research) run at 75% speed. Calls run at 50% without secure comms, 100% with them.
- Commercial travel allows calls at 50% only.

### 2.21.5 Jet lag and wear

- Flying across more than 5 time zones gives **jet lag**: -10% effectiveness on actions for 24 hours after landing, and +5 stress. A bedroom suite removes it.
- More than 60 flight hours in a month adds +10 stress (the jet-set grind).

### 2.21.6 Flight tracking and secrecy

Jets are tracked, and where a dynasty head flies is news.

- Every jet flight is visible to rivals with an **intel level** (2.22) of 30 or more on the jet's owner.
- A rival who sees your jet land in a target company's hub, or next to a rival dynasty's seat, gets a **rumor** event. Rumors move the target's stock by 2% to 6% and can tip off a takeover.
- **Countermeasures**: fly commercial or charter (anonymous), register the jet through a shell, file a decoy flight plan (Intrigue roll), or meet on a yacht in international waters.
- Under T4 Mass Surveillance or Social Credit laws, the host government always knows who landed.

### 2.21.7 Superyachts

- Superyachts cost $50M to $500M, with yearly upkeep at 10% of price.
- A yacht is a **mobile venue**: galas on board give +25% gala influence, and meetings on board in international waters cannot be tracked or recorded by governments.
- A yacht can be seized under sanctions if it docks in a sanctioning country's port.

### 2.21.8 Risk on the road

| Risk | Base chance (T) | Modifiers | Effect |
|---|---|---|---|
| **Crash** | 0.002% per flight hour | ×3 for each skipped maintenance week; ×5 in war airspace | Everyone on board may die (80%); a major event for the dynasty |
| **Arranged accident** | Scheme by a rival ([1-corporate-core.md](1-corporate-core.md) 1.1.8) | Halved by Head of Security protection and the security package | Looks like a crash; investigations may find sabotage |
| **Kidnap or attack on arrival** | 0.5% per trip to hubs with unrest above 60; 2% to war zones | Security detail ÷4; security package ÷2 | Ransom chain or injury |
| **Detention** | Character is sanctioned, Under Investigation, or the host government is hostile | Political influence and diplomatic relations | Held for questioning (days to months), passport seized, or arrested |
| **Airspace closure** | Wars, sanctions ([4-politics.md](4-politics.md) 4.11) | | Reroute, adding 2 to 8 hours |

### 2.21.9 Presence

- A character present in a hub for over 30 days in a year counts as **resident-like** there: +2 pp influence for their holdings in that hub (stacks with origin, once per character).
- Visiting a hub where the dynasty holds assets gives a one-week **visit bonus**: a push of 5 toward Friend from local executives, +1 pp influence while there.

### 2.21.10 Travel events (starting set)

| Event | Trigger | Options |
|---|---|---|
| Spotted on the Tarmac | Rival tracks your jet to a target's hub | Deny, issue a statement, accelerate the deal |
| Grounded | Maintenance overdue | Fly anyway (crash risk), charter, cancel the trip |
| Jet Envy | A rival buys a bigger jet | Upgrade, mock them publicly, ignore |
| Emissions Scandal | Hostile media and over 300 flight hours a year | Buy offsets, defend it, sell the jet |
| The Long Way Round | Airspace closure on your route | Reroute (+hours), fly through (risk), cancel |
| Stranded | Detention or a sudden coup at your destination | Call in political favors, pay, or flee overland |
| Mile-High Deal | A Greedy or Ambitious executive on your jet | Pitch them in flight (Persuasion roll with no interruptions) |

## 2.22 Information and intelligence

The player does not see everything.

### 2.22.1 What is visible

| Information | Visible to everyone | Needs intel |
|---|---|---|
| Own holdings, companies and finances | Yes | |
| Public companies' financials, major holders above 5% | Yes (quarterly) | |
| Private companies' financials | No | Estimates at ±30% without intel |
| Holders behind shell companies | No | Investigate Shell scheme |
| Industry prices and news cycles, business cycle phase | Yes | |
| Rival growth plans and asset purchases | Partly (big deals are news) | Market research or espionage |
| Characters' traits | Some (known traits) | Hidden traits need meetings or Dig Up Dirt |
| Influence shares of rivals in a hub | Tier only (Presence, Power Broker, Kingmaker) | Exact share needs intel |

### 2.22.2 Intel level

- The player has an **intel level** (0 to 100) on each rival company and hub. It rises with presence (own business assets or offices there), market research spending ($100k per month per hub: +5 per month), analysts on the board (CSO task), and espionage; it decays 2 per month.
- Intel level sets how accurate estimates are: ±30% at 0, ±10% at 50, exact at 90+.
- **Disinformation**: psyops and leaks can plant false numbers; low-intel players believe them.

## 2.23 AI economic behavior

AI companies and AI dynasties run the economy the player competes in.

### 2.23.1 Archetypes

| Archetype | Behavior |
|---|---|
| **Incumbent** | Defends share, prices at market, answers entrants with copy or acquire, invests steadily |
| **Aggressive grower** | Expands into new hubs, borrows heavily, cuts prices, buys rivals |
| **Cash cow** | Pays high dividends, invests little, sells assets when offered a premium |
| **State champion** | Backed by a government, ignores short-term profit, wins contracts, protected from takeovers |
| **Raider** | Holding company that buys undervalued stakes and breaks them up |
| **Startup** | Venture-rank AI rivals (1.7.5): fast, fragile, often for sale |

Each AI company's archetype comes from its controlling dynasty's head traits (Ambitious and Brave lean Aggressive; Greedy and Cautious lean Cash cow) and from its government links.

### 2.23.2 Monthly decisions

Each AI company decides monthly:

1. **Grow**: raises a business unit's growth plan when its industry is undersupplied and the unit's return beats its hurdle rate (8% to 15% by archetype), placing new assets in the cities with the best tax and location perks (2.3.5).
2. **Shrink or sell**: a unit losing money for 6 months cuts its growth plan; after 12 months its assets or the whole unit are sold.
3. **R&D**: sets its R&D plan by archetype (Aggressive above the industry norm, Cash cow below it).
4. **Acquire**: when cash exceeds 20% of value and a target is undervalued, considers a takeover ([1-corporate-core.md](1-corporate-core.md)).

AI investment is lagged and imperfect on purpose, so shortages and gluts happen and the player can profit from seeing them first.

## 2.24 Map views and overlays

The map is the main screen.

### 2.24.1 Zoom levels

| Zoom | Shows | Main interactions |
|---|---|---|
| **World** | Countries, currency zones, chokepoints, wars, sanctions | Click a country for its economy and politics; click a chokepoint for its risk |
| **Country** | Regions, hubs, national politics, cycle phase | Click a hub |
| **Hub** | Districts | Click a district for unrest and its real estate pools |
| **District** | Its pools, their prices and owners, and the business units with assets there | Buy or sell pool shares, develop land, rezone, visit |

### 2.24.2 Map modes (overlays)

| Mode | Shows |
|---|---|
| Ownership | Who owns real estate and business assets (by dynasty color) |
| Influence | Your influence share and tier per place; rivals' tiers |
| Property cycle | Boom, peak, bust and recovery per hub |
| Economic cycle | National cycle phase |
| Unrest and labor | Unrest, strikes, unions |
| Politics | Government type, ruling party, your political influence |
| Risk | Chokepoint risk, war, sanctions, nationalization risk for your assets |
| Characters | Where your family and key characters are right now |

## 2.25 Worked examples: cycles

### 2.25.2 Riding the Dubai property cycle

A trust buys $500M of the Commercial pool in Dubai's Financial District during Recovery. Boom arrives 14 months later (rate cuts, foreign buyers). After 36 months of Boom at +1.8% a month the holding is worth about $950M, and the boom has become a bubble. Selling at Peak locks in the gain (while turnover lets it sell); holding through the Bust (twice as deep after a bubble) would have cost about 45%.

### 2.25.3 A recession meets a margin loan

A national recession cuts consumer demand 6%. The dynasty's retail chain's earnings fall 25%; its stock falls 35%. The trust's margin loan, backed by that stock, crosses 70% loan-to-value, and a margin call forces the sale of 8% of the chain at the bottom. The dynasty's bloc drops from 54% to 49%: the chain becomes contested just as an activist faction forms. The economic cycle has become a succession-style crisis.

## 2.26 Assumptions

Assumptions in this file, to confirm with Logan:

1. **First playable map**: 31 major countries, 16 minor groups (aggregated markets whose member countries keep their own politics), 81 hubs and 14 chokepoints. Cities named in other files but missing here (for example Vancouver, Munich) are candidates for later hubs.
2. **Resource Field** is added as a seventh district type for mines, wells, farms and renewables.
3. **Reference dollar and wage index**: base prices are in US dollar equivalents; the wage index (US = 1.0) scales wages, services, real estate and construction, separately from the politics wealth index.
4. **Place mass** is a calibrated "power-relevant" value (hub size class × price factor; 3% of GDP for countries), not the full value of all property, so tiers are reachable at the intended company ranks. Jobs count through payroll × 1.5, making employers the most influential holders per dollar.
5. **Assets come first**: temporary boosts are capped at the larger of 6 pp or the base share, and a tier won by campaigns is lost after one quarter unless backed by assets.
6. **District tiers give economic perks only**; political perks start at the hub level.
7. **Foreignness penalties, offices, Political Capital and government types** are taken from the politics design; restriction labels are derived from its laws. The starting law positions listed in 2.2.4 (C1, C2, F2, E5, L2, E2, F3) should be mirrored in politics data.
8. **Location perks** belong to the big financial and tech hubs and are open to every company that meets them (2.3.5).
9. **Real estate** is pooled per district in four pools with per-hub property cycles (2.16).
10. **Hubs grow and decline** yearly by jobs, wages, housing cost and unrest; new hubs can form (2.17).
11. **Business cycles** run per country with four phases and a global recession event; housing crashes, tech bubbles, debt crises and commodity super-cycles are the main crises (2.18).
12. **Characters have a location**; meetings need presence or a remote call at -30%; the dynasty has one seat hub. Travel has a full private jet system with six jet classes, upgrades, itineraries, flight tracking, yachts and travel risk (2.21).
13. **Information is imperfect**: intel levels per rival and hub set how accurate the player's view is (2.22).
14. **Jobs in influence**: the payroll counted at weight 1.5 (2.5.2) is the wage part of a business unit's operating costs.
