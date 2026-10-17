# 2. Map, influence and economy: detailed design

_Status: draft v0.2 (2026-10-16). v0.2 adds competition, real estate, hub life cycle, business cycles, infrastructure, climate, travel, intelligence, AI behavior and map views (2.15 to 2.25); own-or-lease buildings, plot uses and leases (2.16.1, 2.16.7); and a full private jet and travel system (2.21). Expands [05-map-and-influence.md](../05-map-and-influence.md) and [06-economy.md](../06-economy.md). Owner: Logan._

This file turns the map, influence and economy overviews into exact rules, formulas, numbers and content that a designer can balance. It is pure game design.

**How to read the numbers.** Every number in this file is a **starting tuning value (T)** unless it is marked **Fixed**. Formulas are written so each term can be shown in a tooltip breakdown (see [11-ui.md](../11-ui.md)).

**Decided rules kept intact** (from [13-open-questions.md](../13-open-questions.md)):

- Influence is rooted mainly in assets owned in an area, modified by origin, and temporarily boosted by psyops and ad campaigns.
- One turn is one in-game hour; heavy calculations run weekly and monthly.
- Characters are landless; assets are their titles.
- The full game includes map, economy, markets and politics.

**Related detailed files.** Government types, laws, Political Capital (PC), offices, exposure, sanctions and wars are defined in [4-politics.md](4-politics.md). Companies, vassals, autonomy, standing tiers and trusts are defined in [1-corporate-core.md](1-corporate-core.md). This file uses their terms and does not redefine them.

---

## 2.1 Conventions

### 2.1.1 Money and units

- **Reference dollar ($)**: all base prices and costs are in US dollar equivalents at game start. Each hub converts to its local currency at the live exchange rate ([07-markets.md](../07-markets.md)).
- **Wage index (WI)**: a country's wage level relative to the United States (US = 1.00). It scales wages, local services and construction labor. It is separate from the politics **wealth index** (GDP per capita / $20,000) used for bribes and legal fees.
- **Price factor (PF)** = `0.3 + 0.7 × WI`. Scales land, local services and place mass (2.5.3).
- **Build index (BI)** = `0.6 + 0.4 × WI`. Scales construction cost.
- **pp** = percentage points of influence share.
- Physical units: t = metric tonne, bbl = barrel, MMBtu = million British thermal units, MWh = megawatt hour, kWh = kilowatt hour, k m3 = thousand cubic meters.

### 2.1.2 Cadence for this layer

| Interval | What runs in this layer |
|---|---|
| **Hourly** (every turn) | Commodity exchange quotes and FX move ([07-markets.md](../07-markets.md)); disruption events can fire; travel and action timers; emergency air shipments booked |
| **Daily** | Active influence campaigns progress (ramp-up) and roll psyop discovery; strike resolve changes; disruption countdowns; chokepoint queues; news about shortages |
| **Weekly** | Shipments dispatched and arrived; stock levels; **hub goods prices**; spot purchases; contract deliveries; construction progress; hiring and layoffs; temporary influence decay; tier hysteresis checks |
| **Monthly** | Production and sales settlement; wages; inputs consumed; upkeep and condition; population needs and unrest; union organization; strike checks; **base influence recalculation**; tier changes; electricity dispatch settlement; R&D points; migration |
| **Quarterly** | Company earnings statements; contract renewal notices; tech diffusion; route insurance repricing |
| **Yearly** | Deposit surveys; population growth; education conversion; hub size class review; tariff schedule reviews |

**Production timing rule.** Production is settled monthly (inputs consumed, outputs counted, wages paid). For logistics, a facility's planned monthly output is released into its stock in four equal weekly tranches, so weekly shipments always have goods to move. The monthly settlement trues up any difference caused by strikes, outages or input shortages during the month.

---

## 2.2 The world map

### 2.2.1 Map structure

| Layer | Count at start | Notes |
|---|---|---|
| **Major countries** | 31 | Fully simulated: hubs, regions, own market, central bank, exchange |
| **Minor groups** | 16 groups covering the rest of the world | Each member country keeps its own government, laws and currency (see [4-politics.md](4-politics.md) 4.2.4). Economically each group is one aggregated market with no playable hubs at start |
| **Regions** | 2 to 8 per major country | States or provinces. Only regions that contain a hub are drawn in detail at start; the rest of a country is one "rest of country" region |
| **Economic hubs** | 44 | Cities or clusters with districts and plots (2.3) |
| **Districts** | 6 to 26 per hub | Each with 10 plots |
| **Trade routes** | About 120 lanes | Sea, rail, road, river, pipeline, air, fiber, power interconnectors |
| **Chokepoints** | 14 | Straits, canals, cable corridors (2.4.2) |

Government types, corruption, stability and election cycles for every country are in [4-politics.md](4-politics.md) 4.2.4. The tables below add the economic and business-climate values.

### 2.2.2 Foreign business restriction summary

Restriction is not a separate law. It is a **summary label** computed from the starting positions of four politics laws: C1 Foreign Ownership, C2 Branch Office Requirements, F2 Capital Controls and the strategic sector list ([4-politics.md](4-politics.md) 4.5.3 and 4.5.4). The UI shows the label on the country card.

| Label | Typical law positions | What a foreign company experiences |
|---|---|---|
| **Open** | C1 Open, C2 None, F2 Open | Buy and build freely; profits move freely |
| **Screened** | C1 Screened, C2 None or Local Directors, F2 Open or Reporting | Foreign Investment Review on stakes of 25% or more in strategic sectors (2 to 6 weeks) |
| **Guarded** | C1 Capped Strategic, C2 Local Directors, F2 Reporting | Foreign voting stake capped at 49% in strategic sectors; a branch office is the usual entry for those sectors |
| **Restricted** | C1 Capped All, C2 Local Partner 30%, F2 Restricted | Branch office with a 30% local partner for most sectors; outflows need approval |
| **Closed** | C1 Closed, C2 Local Partner 51% and Tech Transfer or State Golden Share, F2 Hard Controls | Entry only by government invitation; state partner; tech transfer; dividends abroad capped |

Foreigners also suffer the **foreigner influence penalty** of the government type, plus a further -10% per C1 step past Screened (2.5.6).

### 2.2.3 Major countries: economy

Columns: GDP in reference trillions at start; WI = wage index; FX regime is the starting F3 position; corporate tax is the starting E2 position (national rate only).

| # | Country | Currency | FX regime (F3) | GDP ($T) | WI | Corporate tax (E2) | Exchange (fictional) and notes |
|---|---|---|---|---|---|---|---|
| 1 | United States | USD | Free Float (reserve currency) | 28.0 | 1.00 | Moderate | Largest exchange; deepest bond market |
| 2 | Canada | CAD | Free Float | 2.1 | 0.85 | Moderate | Resources, banking |
| 3 | Mexico | MXN | Free Float | 1.8 | 0.22 | High | Nearshoring base for US market |
| 4 | Brazil | BRL | Free Float | 2.2 | 0.25 | High | Agribusiness and iron ore |
| 5 | Argentina | ARS | Managed Float | 0.6 | 0.20 | High | Lithium; history of controls |
| 6 | Chile | CLP | Free Float | 0.33 | 0.30 | High | Copper and lithium |
| 7 | United Kingdom | GBP | Free Float | 3.3 | 0.85 | Moderate | Global FX and insurance center |
| 8 | Germany | EUR | Free Float (euro zone) | 4.5 | 0.90 | High | Euro central bank seat (Frankfurt) |
| 9 | France | EUR | Free Float (euro zone) | 3.0 | 0.85 | Moderate | Luxury, aerospace, nuclear |
| 10 | Netherlands | EUR | Free Float (euro zone) | 1.1 | 0.90 | Moderate | Largest port in Europe; lithography |
| 11 | Italy | EUR | Free Float (euro zone) | 2.2 | 0.70 | Moderate | Machinery, luxury |
| 12 | Switzerland | CHF | Free Float (safe haven) | 0.9 | 1.15 | Low | Private banking, commodity traders |
| 13 | Russia | RUB | Managed Float | 2.0 | 0.25 | Moderate | Oil, gas, metals; under sanctions at start |
| 14 | Turkey | TRY | Managed Float | 1.1 | 0.28 | Moderate | Controls the Turkish Straits |
| 15 | Saudi Arabia | SAR | Peg (USD) | 1.1 | 0.55 | Moderate | Largest oil exporter |
| 16 | United Arab Emirates | AED | Peg (USD) | 0.5 | 0.45 | Low | Re-export and finance free zones |
| 17 | Israel | ILS | Free Float | 0.5 | 0.80 | Moderate | Cyber and surveillance tech |
| 18 | Egypt | EGP | Managed Float | 0.35 | 0.10 | Moderate | Suez Canal revenue |
| 19 | Nigeria | NGN | Managed Float | 0.30 | 0.08 | High | Oil; largest African consumer market |
| 20 | South Africa | ZAR | Free Float | 0.38 | 0.22 | High | Mining finance, platinum metals |
| 21 | India | INR | Managed Float | 3.9 | 0.12 | Moderate | IT services, generic pharma |
| 22 | China | CNY | Managed Float | 18.5 | 0.30 | Moderate | Manufacturing core; capital controls |
| 23 | Japan | JPY | Free Float | 4.2 | 0.75 | High | Robotics, chip materials |
| 24 | South Korea | KRW | Free Float | 1.7 | 0.65 | Moderate | Memory, displays, batteries |
| 25 | Taiwan | TWD | Managed Float | 0.8 | 0.50 | Moderate | Leading-edge chip fabs |
| 26 | Singapore | SGD | Managed Float (basket) | 0.5 | 0.85 | Low | Transshipment, wealth management |
| 27 | Malaysia | MYR | Managed Float | 0.4 | 0.25 | Moderate | Chip packaging |
| 28 | Indonesia | IDR | Managed Float | 1.4 | 0.12 | Moderate | Nickel, coal, palm oil |
| 29 | Vietnam | VND | Managed Float | 0.43 | 0.12 | Moderate | Electronics assembly |
| 30 | Australia | AUD | Free Float | 1.7 | 0.95 | High | Iron ore, lithium, LNG |

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
| Gulf minors | Qatar, Kuwait, Bahrain, Oman | USD pegs | 0.55 | 0.50 | Guarded | LNG (Qatar), oil, sovereign funds |
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
- **Labor force** = 50% of metro population, split into segments (2.8).
- **Hub GDP** (used by politics for political market size) = metro population × national GDP per person × hub productivity (1.0 for resource towns, 1.3 typical, 2.0 for global finance centers).
- A hub moves up one size class when its population passes the next threshold at a yearly review, and gains districts (new plots are auctioned, see 2.5.10 first refusal).

### 2.3.2 District types

The six district types from 05 plus **Resource Field**.

| Code | District | Mass weight | Plots | Main allowed facilities | Land value per plot (L hub, PF 1.0) | Character |
|---|---|---|---|---|---|---|
| **F** | Financial District | 2.0 | 10 | Offices, office towers, retail, media studios, security HQ, small data centers (1 level max) | $400M | Professionals and Elite; headquarters; exchanges |
| **T** | Tech Park | 1.5 | 10 | Chip fabs, packaging plants, display fabs, data centers, research labs, cyberware labs, wafer plants, pharma plants, offices | $200M | Professionals and Skilled; power and water hungry |
| **P** | Port (sea, river or air) | 1.2 | 10 | Port terminals, warehouses, refineries, LNG terminals, steel mills, smelters, power plants, offshore wind and oil | $150M | Logistics; strike-sensitive; chokepoint-exposed |
| **I** | Industrial Zone | 1.0 | 10 | Processing and manufacturing plants, power plants, construction yards, warehouses | $60M | Skilled and Unskilled; pollution |
| **R** | Residential | 1.0 | 10 | Residential towers, retail and malls, hospitals, clinics, small offices | $120M | Housing for every segment above Gig |
| **S** | Slums | 0.3 | 10 | Tenements, sweatshop garment lines, black clinics, artisanal workshops, street retail, front companies | $15M | Gig and Unemployed; high unrest; light policing |
| **X** | Resource Field | 0.8 | 10 | Mines, oil and gas fields, farms, solar and wind farms, water works | $30M plus deposit value | Deposits with size and grade; remote labor camps |

- **Land value** of a plot = table value × size multiplier (S 0.3, M 0.6, L 1.0, XL 1.5, Mega 2.2) × PF × local modifiers (unrest, zoning, recent growth). Land value moves monthly: +0.5% per point of hub population growth, -1% per 10 points of district unrest above 40, +10% under E11 Restrictive zoning (from politics).
- **District mass** = hub mass × district weight / sum of all district weights in the hub.
- **Deposits** (X plots): each has a resource, a size (months of output at 1 level, from 120 to 600) and a grade (output ×0.7 to ×1.3). Deposits deplete as they are mined. Shale deposits deplete 3 times faster. A yearly survey can reveal new deposits (5% chance per X district).
- **Rent yields** for real estate assets ([02-trusts-and-assets.md](../02-trusts-and-assets.md)): residential 4% per year of value, office 5%, industrial 6%, Slum tenements 9% (each tenement adds +1 unrest in its district).

### 2.3.3 Hub list

District codes: F Financial, T Tech Park, P Port, I Industrial, R Residential, S Slums, X Resource Field. Population is metro population at start in millions. Connections list the main lanes and chokepoints (2.4).

**North America**

| Hub | Country (region) | Size | Pop (M) | Districts | Specialties | Connections |
|---|---|---|---|---|---|---|
| New York | United States (New York-New Jersey) | Mega | 20 | F5 I2 P2 R9 S3 T3 | Global finance, main exchange, media, law, insurance, prime real estate | Transatlantic sea and fiber to London and Rotterdam; rail and road to Chicago; Panama Canal to Asia; Gibraltar to the Mediterranean |
| Chicago | United States (Illinois) | L | 9.5 | F3 I4 P1 R4 S1 T1 | Futures and commodity exchange, rail freight center, food processing, grain | Rail to New York, Houston, Los Angeles; Great Lakes and St Lawrence (seasonal); Mississippi barges to the Gulf |
| Houston | United States (Texas) | L | 7.3 | F1 I4 P3 R4 S1 X1 | Oil and gas, refining, petrochemicals, LNG export | Gulf of Mexico tanker lanes; Panama Canal to Asia; Florida Strait to the Atlantic; pipelines to Chicago |
| Bay Area | United States (California) | L | 7.7 | F2 I1 P1 R5 S1 T4 | Venture capital, software, AI labs, chip design, cyberware startups | Transpacific sea and fiber to Tokyo, Taiwan, Shanghai; air freight hub for chips |
| Los Angeles-Long Beach | United States (California) | XL | 13 | F2 I4 P3 R6 S2 T1 | Largest US container port, media and entertainment, aerospace, defense | Transpacific lanes to Shenzhen, Shanghai, Busan; rail land bridge to Chicago and New York |
| Phoenix | United States (Arizona) | M | 5 | F1 I2 R4 S1 T2 | New chip fabs, data centers, water-stressed | Rail and road to Los Angeles and Houston; air |
| Calgary | Canada (Alberta) | M | 1.6 | F2 I2 R3 S1 X2 | Oil sands, oil company headquarters, pipelines, ranching | Pipelines to Houston and the Pacific coast; rail to Toronto and Chicago. Added for the starting character John Oligarch ([7-starting-world.md](7-starting-world.md) 7.8) |
| Toronto | Canada (Ontario) | L | 6.5 | F3 I3 P1 R5 S1 T1 | Banking, mining finance, auto plants, AI research | Rail and road to New York and Chicago; St Lawrence Seaway |
| Mexico City | Mexico (Valle de México and Bajío belt) | Mega | 22 | F2 I6 P1 R8 S5 T1 X1 | Vehicles and parts, nearshore electronics, consumer goods, telecom | Rail and road to Houston (US border crossings); Pacific port Manzanillo and Gulf port Veracruz (abstracted) |

**South America**

| Hub | Country (region) | Size | Pop (M) | Districts | Specialties | Connections |
|---|---|---|---|---|---|---|
| São Paulo | Brazil (São Paulo, with Santos port) | Mega | 22 | F3 I5 P2 R8 S4 T1 X1 | Finance, vehicles, food processing, soy, beef, sugar, iron ore marketing | Santos to Atlantic lanes; Cape of Good Hope to China; Panama Canal to the US west coast |
| Antofagasta | Chile (Antofagasta, Atacama) | S | 0.5 | I1 P1 R1 S1 X2 | Copper mining, lithium brine | Pacific bulk lanes to Shanghai, Busan, Tokyo; Panama Canal to Houston |
| Medellín | Colombia (Antioquia) | L | 4 | F1 I2 R4 S3 T1 X1 | Textiles, coffee, flowers, informal economy, cartel money laundering, growing tech scene | Road to Pacific port Buenaventura and Caribbean port Cartagena (abstracted); air to Miami and Bogotá. Added for the starting character Pablo Segundo ([7-starting-world.md](7-starting-world.md) 7.8) |

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

**Middle East and Africa**

| Hub | Country (region) | Size | Pop (M) | Districts | Specialties | Connections |
|---|---|---|---|---|---|---|
| Dubai | UAE (Dubai and Sharjah) | L | 6 | F4 I2 P3 R3 S1 T1 | Re-export logistics, gold trading, free zones, aviation hub, real estate, grey trade | Strait of Hormuz (inside the Gulf); sea lanes to India, East Africa and Europe; air hub |
| Dhahran-Dammam | Saudi Arabia (Eastern Province) | M | 4 | F1 I3 P2 R2 X2 | Largest oil fields, refining, petrochemicals, desalination | Strait of Hormuz; East-West pipeline to the Red Sea coast (bypass); Bab-el-Mandeb and Suez |
| Doha | Qatar (Gulf minors) | M | 2.4 | F2 I2 P2 R3 X1 | Largest LNG exporter, sovereign fund, media network | Strait of Hormuz; LNG lanes to Tokyo, Seoul and (via Suez) Rotterdam |
| Tel Aviv | Israel (Central) | M | 4 | F2 I1 P1 R3 T3 | Cybersecurity, surveillance tech, chip design, defense electronics, venture capital | Mediterranean via Suez or Gibraltar; air; fiber |
| Cairo-Suez | Egypt (Cairo and Canal Zone) | Mega | 22 | F2 I4 P2 R8 S7 T1 | Canal revenue, textiles, fertilizer, construction, gas | Suez Canal; Mediterranean and Red Sea lanes; Red Sea cable corridor landing |
| Lagos | Nigeria (Lagos) | Mega | 21 | F2 I3 P2 R7 S9 T1 | Oil money, fintech, consumer goods, film industry, informal economy | Gulf of Guinea lanes (piracy risk); Atlantic to Europe; Cape of Good Hope to Asia |
| Johannesburg | South Africa (Gauteng, with Durban port abstracted) | L | 10 | F3 I3 P1 R4 S2 X1 | Mining finance, platinum metals, gold, coal power | Rail to Durban; Cape of Good Hope; Mozambique Channel |
| Kolwezi-Lubumbashi | DR Congo and Zambia Copperbelt (Central and Southern Africa) | M | 3 | I2 R2 S3 X3 | Cobalt (about 70% of world supply), copper | Long truck and rail lanes to Durban, Dar es Salaam and Lobito; border delays |

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
| Sydney | Australia (New South Wales) | XL | 5.4 | F4 I2 P2 R6 S1 T2 | Banking, pension funds, property, media, mining company headquarters | Pacific lanes to Shanghai, Tokyo and Los Angeles; fiber to Singapore and the US. |

### 2.3.4 Signature starting assets

Each hub starts with AI-owned facilities that define its specialty, so the world economy runs from turn one. Examples (levels at start):

| Hub | Signature facilities at start |
|---|---|
| Hsinchu-Taipei | Advanced-node fabs 12 levels, mature-node fabs 10, advanced packaging 6 |
| Seoul-Pyeongtaek | Memory fabs 14, display fabs 8, battery gigafactories 8, advanced-node fabs 3 |
| Eindhoven | Lithography line 1 (the only one in the world), research labs 3 |
| Frankfurt | Precision optics line 2 (only supplier of lithography optics), chemical plants 8 |
| Shenzhen-Dongguan | Electronics assembly 40, component plants 25, battery gigafactories 10 |
| Penang | Packaging plants 18 |
| Kolwezi-Lubumbashi | Mines (nickel-cobalt) 20, artisanal mines 15 |
| Baotou | Mines (rare earth) 12, rare earth separation 8 |
| Perth-Pilbara | Mines (iron ore) 60, mines (lithium) 10, LNG liquefaction 4 |
| Dhahran-Dammam | Oil fields 50, refineries 20, petrochemical plants 10 |
| Doha | Gas fields 25, LNG liquefaction 18 |
| Antofagasta | Mines (copper) 25, mines (lithium brine) 6 |
| Houston | Refineries 25, petrochemical plants 15, LNG liquefaction 8, oil fields 15 |

The full starting asset list per hub lives in hub data and is tuned so that world production of each good roughly matches world demand at base prices (within ±5%).

---

## 2.4 Trade routes and chokepoints

### 2.4.1 Transport modes

| Mode | Cost per tonne per 1,000 km | Speed (km per day) | Handling per terminal | Handling cost | Typical capacity per lane per month | Notes |
|---|---|---|---|---|---|---|
| **Container ship** | $8 | 700 | 2 days | $40 per t | 2M t | Finished goods, components, intermediates |
| **Bulk carrier** | $1.2 | 550 | 3 days | $3 per t | 10M t | Ores, coal, grain, steel |
| **Tanker** (crude and products) | $2 | 550 | 2 days | $2 per t | 15M t | 1 t crude = 7.3 bbl |
| **LNG carrier** | $8 | 650 | 2 days | Paid at LNG terminals | 3M t | 1 t LNG = 52 MMBtu |
| **River barge** | $12 | 250 | 1 day | $4 per t | 3M t | Rhine, Yangtze, Mississippi |
| **Rail freight** | $30 | 600 (400 cross-border) | 1 day | $12 per t | 1M t | +1 to 3 days per border crossing |
| **Truck** | $90 | 700 | 0.5 day | $8 per t | 0.3M t | Last mile and short hauls |
| **Oil pipeline** | $6 | Continuous | none | none | Fixed by pipeline | Delivers in the week shipped |
| **Gas pipeline** | $0.35 per MMBtu per 1,000 km | Continuous | none | none | Fixed by pipeline | |
| **Air cargo** | $450 | 9,000 | 1 day | $150 per t | 50k t | Chips, pharma, luxury, emergencies |
| **Fiber** | $0.05 per data unit per 1,000 km | Instant | none | none | Fixed per cable | Data goods and cloud compute; latency matters for finance |
| **Power interconnector** | $4 per MWh per 1,000 km | Instant | none | none | Fixed | 3% energy loss per 1,000 km |

**Shipment timing.** Shipments are dispatched at the weekly step. Transit time = sum of (leg distance / speed) + handling days + chokepoint queue days. A shipment arrives at the first weekly step on or after its arrival day. **Emergency air** can be booked any hour: it costs 1.5× the air rate and its goods enter stock at the next daily step instead of waiting for the weekly step.

**Chokepoint tolls (T):**

| Toll | Container | Bulk or tanker | LNG |
|---|---|---|---|
| Suez Canal | $12 per t | $3 per t | $0.15 per MMBtu |
| Panama Canal | $14 per t | $4 per t | $0.20 per MMBtu |
| Turkish Straits | $0.5 per t | $0.5 per t | $0.02 per MMBtu |

**Insurance.** Base cargo insurance is 0.1% of cargo value per voyage. Each chokepoint passed adds war risk by its risk level: Calm 0, Tension +0.1%, Attacks +0.5%, Conflict +2% (and many carriers refuse). Closed means the lane cannot be used.

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

**Risk levels.** Calm, Tension, Attacks, Conflict, Closed. Risk moves by events ([10-events.md](../10-events.md)) and by politics (relations, wars, sanctions: [4-politics.md](4-politics.md) 4.11).

**Queues.** Each chokepoint has a monthly capacity. When demand exceeds capacity, ships queue: delay = `excess / capacity × 30 days` (T), and canals auction slots (toll ×1 to ×4).

### 2.4.3 Key lanes (reference values)

Times include handling at both ends. Costs are per tonne at base rates, excluding insurance and tariffs.

| Lane | Mode and path | Distance | Time | Cost per t | Chokepoints |
|---|---|---|---|---|---|
| Shanghai to Rotterdam | Container via Malacca and Suez | 19,500 km | 32 days (5 weekly steps) | $248 | Taiwan Strait, Malacca, Bab-el-Mandeb, Suez, Gibraltar, Dover |
| Shanghai to Rotterdam | Container via the Cape of Good Hope | 25,800 km | 41 days (6 steps) | $286 | Taiwan Strait, Malacca, Dover |
| Shanghai to Rotterdam | Rail via Kazakhstan and the Middle Corridor | 11,000 km | 26 days | $378 | Caspian ferry (capacity 0.2M t per month) |
| Shenzhen to Los Angeles | Container across the Pacific | 11,700 km | 21 days | $174 | Luzon Strait |
| Hsinchu-Taipei to Bay Area | Air cargo | 10,400 km | 3 days | $4,980 | none (airspace closures in conflict) |
| Dhahran-Dammam to Tokyo | Tanker via Lombok | 12,700 km | 27 days | $29 (about $4 per bbl) | Hormuz, Lombok |
| Doha to Rotterdam | LNG carrier via Suez | 11,500 km | 22 days | $92 plus tolls (about $1.9 per MMBtu) | Hormuz, Bab-el-Mandeb, Suez, Gibraltar, Dover |
| Houston to Tokyo | LNG carrier via Panama | 16,500 km | 29 days | $132 plus toll (about $2.7 per MMBtu) | Panama |
| Perth-Pilbara to Shanghai | Bulk via Lombok and Makassar | 6,500 km | 18 days | $14 | none (Lombok and Makassar bypass Malacca) |
| Antofagasta to Shanghai | Bulk across the Pacific | 18,500 km | 40 days | $28 | none |
| São Paulo (Santos) to Shanghai | Bulk via the Cape of Good Hope | 20,000 km | 43 days | $30 | Malacca |
| Kolwezi-Lubumbashi to Durban (Johannesburg) | Rail, or truck | 2,800 km | 9 days rail plus 3 border days; 7 days truck | $96 rail, $260 truck | Border posts (2) |
| Rotterdam to Frankfurt | Rhine barge | 500 km | 4 days | $14 | none (low water in drought) |
| New York to London | Fiber | 5,600 km | Instant (28 ms latency) | negligible | none |
| Moscow to Beijing | Gas pipeline | 6,000 km | Continuous | $2.1 per MMBtu | none |

### 2.4.4 Route capacity and congestion

- Each lane has a **monthly capacity** by mode (2.4.1) and owner. Most lanes are public: anyone can ship at the listed rates, paid to AI carriers.
- **Congestion**: when a lane is above 85% utilization, rates rise 2% for every point above 85%, up to +60% at 115%. Above 115%, shipments wait one extra week.
- **Owning logistics**: a company that owns port terminals, warehouses or a carrier fleet (via Logistics facilities, 2.7) earns those fees and gets **priority loading** on its lanes: its cargo moves first when capacity is short.
- **Building routes**: new rail, pipeline or cable lanes are government contracts or private megaprojects (construction units plus 2 to 6 years). They add capacity and can bypass a chokepoint.

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
| **Real estate and land** | Market value | 1.0 | The district of the plot, rolling up |
| **Facilities** | Book value (replacement cost × condition) | 1.0 | The district of the plot, rolling up |
| **Infrastructure** (ports, pipelines, grids, cables, airports, water works; see 2.19) | Book value | 1.5 | The district or lane endpoints, rolling up |
| **Jobs provided** | Yearly payroll of those facilities (wages plus overhead) | 1.5 | The district of the facility, rolling up |
| **Local government bonds** | Face value | 0.5 | The issuer's level: city bonds at the hub, regional bonds at the region, national bonds at the country |
| **Stakes in companies headquartered there** | Market value of the stake | 0.5 | The company's HQ hub, rolling up. Not counted for companies the holder controls (their assets count directly instead) |
| **Media outlets based there** | Book value of media facilities | 0.6 | Their district, rolling up; plus **audience**: +0.25 pp per 1% of local audience share (flat) |
| **Financial holdings booked there** | Deposits and accounts at local banks, listed securities of non-local companies held through the local exchange | 0.15 | The hub of the bank or exchange, rolling up |

The 1.5 weight on payroll makes jobs the strongest influence per dollar: a labor-heavy factory gives far more local power than a vacant tower of the same value. This is intended: employers are courted, landlords are tolerated.

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

Example masses: New York $120B; Penang $4.75B; Shenzhen-Dongguan $61B; Antofagasta $1.5B; United States $840B; China $555B; Chile $9.9B.

### 2.5.4 Holders and attribution

| Holder | Attributed assets |
|---|---|
| **Character** | Personal accounts and personal trusts |
| **Family trust** | Its own assets |
| **Company** | Its own assets plus each controlled vassal's attributed assets × autonomy factor: Wholly Integrated 1.0, Managed 0.9, Arm's Length 0.7, Independent Listing 0.5 (autonomy levels from [1-corporate-core.md](1-corporate-core.md) 1.7.2) |
| **Dynasty** | Family trust + personal assets of living members + companies the dynasty controls (the top company at 1.0, its vassals by the autonomy factor chain) + minority stakes as stakes (weight 0.5) |
| **Government** | State-owned assets; used for display and for the "public" remainder, never for tiers |

- **Which share applies to an action**: the best share among the acting holder and the dynasty that controls it. A company controlled by your dynasty uses the dynasty's Power broker tier for a permit even if the company alone holds 8%.
- **Family members** may use dynasty perks only when their opinion of the dynasty head is 0 or more and they are not in a faction against the head.
- **Political Capital** is earned by the dynasty from the dynasty share, as defined in [4-politics.md](4-politics.md) 4.1.2.

### 2.5.5 Roll-up from district to country

Each level is computed with its own mass, using every asset inside it:

`Share(region) = (weighted assets in all hubs of the region + region-only assets such as hinterland facilities and regional bonds) / region mass`

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
- A **dynasty** uses the best origin among its living adult members with opinion of the head 0 or more, or its **dynasty seat** (the hub where it was founded, or where two or more past heads were raised): seat gives ×1.15 in the hub and ×1.05 in the country. Use the higher of the two; they do not stack.
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
| Dynasty with at least one adult citizen member (by birth or marriage) whose opinion of the head is 0 or more | Penalty halved |
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
| **Ad campaign** | $60k per pp per 4 weeks per $1B | +5 pp | 50% in the first week, full from the second | 4 to 26 weeks, paid each 4 weeks | 25% | None (legal) | Buys media units from the local market (cost / $8,000 units); owning local media cuts cost 30%; can also push an interest group's MediaBias +0.02 ([4-politics.md](4-politics.md) 4.4.5) |
| **Psyops** (bots, disinformation) | $25k per pp per 4 weeks per $1B | +10 pp | Full in 3 days | 2 to 12 weeks | 35% | Daily discovery roll (below); +5 political exposure per campaign start × surveillance multiplier ([4-politics.md](4-politics.md) 4.9.3) | A synthetic media studio (2.7.11) cuts cost 40%; can push MediaBias +0.05 |
| **Sponsorship and charity** | $150k per pp per $1B for a 26-week package | +3 pp | Linear over 4 weeks | 26 weeks, renewable | 5% | Only if reputation is below -20: "washing" scandal 2% per month | +1 reputation per $5M × PF spent (max +10 per year); 25% of its pp become permanent Goodwill at the end of each package |
| **Event or gala** | $0.02 × adults in the hub ([4-politics.md](4-politics.md) 4.10.1), plus 6 hours of the host's time | +1 pp in the hub, +0.5 pp in its region | Instant | 2 weeks | 50% | None; a Hedonist host has a 5% scandal chance | +5 opinion with all hub officials; the host rolls Befriend on 1 to 3 attending elite characters at Influence × 2% each; 1 gala per hub per month |

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
| Exposure | +15 with the Financial Police and the Data and Cyberware Authority |
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
| **Presence** (10%) | Hiring cost -10% for facilities in the district; new plot listings shown 3 days early | All district perks hub-wide; supplier discount -3% on inputs bought in the hub market; permit time -15%; Meet Official with local officials costs 0 PC once per week | Regional licences 2 weeks faster; Meet Official with regional officials free once per week | Meet Official with ministers free once per week; Foreign Investment Review time -25% |
| **Power broker** (25%) | First refusal on new plots in the district: 7 days to buy at appraisal +5% | First refusal on new plots and local tenders hub-wide; one Request Decision for rezoning per quarter at 0 PC (automatic approval under E11 Developer-Led); construction time -15%; one property tax deal per year (E10 -25% on own facilities for 5 years, as a Request Decision); local lobby points +25%; S2 Privatized policing contracts allowed; unlocks the **Political Connections** founding path ([1-corporate-core.md](1-corporate-core.md) 1.6.7) | One regional incentive deal per year (E9 corporate surcharge waived on new facilities for 5 years); regional contract bid score +10; priority for new infrastructure lanes to your hubs; regional lobby points +25% | Eligible for E6 subsidies without a tender; national contract bid score +10; national lobby points +25%; meetings with the central bank governor and regulator heads |
| **Kingmaker** (50%) | Veto a rival's plot purchase in the district (10 PC) | **Local price setting** for up to 2 goods (2.9.8); veto a rival's permit or acquisition in the hub (20 PC; the rival can override with 40 PC or a court case); appointment score +30 for police chief and permit office head; +0.3 Candidate utility for local candidates you back ([4-politics.md](4-politics.md) 4.6.3); local investigations lose 1 Evidence per week and local Request Protection costs 0 PC; local contract bid score +20 | Appoint one regional cabinet member per year (appointment score +30); +0.2 Candidate utility for backed regional candidates; veto a rival's regional licence (30 PC); regional Request Protection costs 0 PC | Appointment score +30 for one minister or regulator head per year; +0.15 Candidate utility for backed national candidates; one tariff or subsidy change per year handled as a Decision instead of a Law; national Request Protection cost halved; foreign holders' branch office seizure risk -1 point |

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

---

## 2.6 Goods

### 2.6.0 What is modeled at the start (Logan, 2026-10-17)

At the start **only energy and GPUs are modeled** as real goods with recipes, prices and shipments (Logan). The GPU supply chain is the largest supply chain in the game and is simulated in four layers ([6-technocapital.md](6-technocapital.md) 6.7.0). Energy means **electricity, crude oil and natural gas** (Logan).

Everything else, including the starter list Logan approved (phones, PCs, cars, electric cars, steel, oil and the rest of the tables below), is **abstracted** at the start: each sector has fixed demand that grows with the economy, a margin, and a cost per unit of output, with no recipe chain **(A)**. These goods are switched to full simulation later, in an order still to be set by Logan.

Population needs are consumer goods (2.8.2); while those goods are abstracted, needs are filled from the abstracted sectors.

### 2.6.1 How to read the goods tables

- **Base price** is the reference price at game start in a balanced market (2.9). Services are quoted at PF 1.0 and scale with the hub's PF.
- **Main inputs** are per unit of output for the default production method (other methods in 2.7 change them). Where a good has several methods, the cheapest common one is shown.
- **Market**: **Exchange** = traded on commodity exchanges with an hourly global quote ([07-markets.md](../07-markets.md)); **Global** = traded between hubs along routes but no exchange quote; **Regional** = trades only within a country or minor group and its direct neighbors (by law or because transport is too costly); **Local** = cannot leave the hub (or its grid).
- **ε** is the price elasticity exponent used in the hub price formula (2.9.2). Higher ε means sharper price spikes when supply falls short.

### 2.6.2 Raw goods

| Good | Unit | Weight per unit | Base price | Made by | Market | ε |
|---|---|---|---|---|---|---|
| Crude oil | bbl | 136 kg | $75 | Oil field | Exchange | 3.0 |
| Natural gas | MMBtu | pipeline only | $4 at the wellhead (regional hubs differ: US $3, Europe $10, Asia $11) | Gas field | Regional (global as LNG) | 2.5 |
| Coal | t | 1 t | $120 | Mine | Exchange | 1.5 |
| Iron ore | t | 1 t | $105 | Mine | Exchange | 1.5 |
| Copper concentrate | t | 1 t | $1,900 | Mine | Global | 2.0 |
| Bauxite | t | 1 t | $50 | Mine | Global | 1.5 |
| Lithium ore (spodumene or brine equivalent) | t | 1 t | $1,000 | Mine | Global | 2.0 |
| Nickel-cobalt ore | t | 1 t | $400 | Mine | Global (export bans common) | 2.0 |
| Rare earth concentrate | t | 1 t | $5,000 | Mine | Regional (export controls) | 2.5 |
| Silica quartz | t | 1 t | $150 | Mine | Global | 1.5 |
| Uranium ore | t | 1 t | $150,000 | Mine | Exchange | 2.0 |
| Gold | kg | 1 kg | $70,000 | Mine | Exchange (also a store of value) | 1.0 |
| Limestone and aggregates | t | 1 t | $15 | Mine | Local | 1.0 |
| Grain | t | 1 t | $230 | Farm | Exchange | 2.0 |
| Oilseeds (soy, palm) | t | 1 t | $480 | Farm | Exchange | 2.0 |
| Livestock | t | 1 t | $2,000 | Farm | Regional | 1.5 |
| Cotton | t | 1 t | $1,800 | Farm | Exchange | 1.5 |
| Timber | t | 1 t | $120 | Farm (forestry) | Regional | 1.0 |
| Fresh water | k m3 | pipeline only | $800 × PF | Water works | Local | 3.0 |

### 2.6.3 Intermediate goods

| Good | Unit | Base price | Main inputs per unit | Made by | Market | ε |
|---|---|---|---|---|---|---|
| Steel | t | $650 | Iron ore 1.6 t, coal 0.8 t, limestone 0.25 t, electricity 0.2 MWh | Steel mill | Exchange | 1.0 |
| Aluminium | t | $2,400 | Bauxite 4.4 t, electricity 15 MWh, coal 0.4 t, chemicals 0.08 t | Smelter | Exchange | 1.2 |
| Refined copper | t | $9,000 | Copper concentrate 4.2 t, electricity 3.5 MWh, chemicals 0.15 t | Smelter | Exchange | 1.5 |
| Nickel-cobalt intermediate | t | $12,000 | Nickel-cobalt ore 19 t, chemicals 2.3 t, electricity 3.8 MWh | Smelter | Global | 1.5 |
| Refined fuels (gasoline, diesel, jet) | bbl | $95 | Crude 1.09 bbl, natural gas 0.55 MMBtu, electricity 0.018 MWh | Refinery | Exchange | 2.5 |
| Plastics and polymers | t | $1,300 | Crude 3.3 bbl, natural gas 25 MMBtu, electricity 1 MWh | Petrochemical plant | Global | 1.2 |
| Industrial chemicals | t | $900 | Natural gas 15 MMBtu, crude 2 bbl, limestone 0.5 t, electricity 1 MWh | Chemical plant | Regional | 1.2 |
| Fertilizer | t | $450 | Natural gas 28 MMBtu, electricity 0.3 MWh | Chemical plant | Global | 1.5 |
| Cement | t | $120 | Limestone 1.5 t, coal 0.12 t, electricity 0.11 MWh | Chemical plant | Local | 1.0 |
| LNG | MMBtu | $9 (free on board) | Natural gas 1.15 MMBtu, electricity 0.001 MWh | LNG terminal | Exchange | 3.0 |
| Nuclear fuel | t | $1,500,000 | Uranium ore 8 t, electricity 400 MWh, chemicals 20 t | Chemical plant (licensed) | Global (licence) | 2.0 |
| Polysilicon | t | $10,000 | Silica quartz 3 t, coal 1 t, chemicals 0.6 t, electricity 70 MWh | Polysilicon and wafer plant | Global | 1.5 |
| Silicon wafers (300 mm) | wafer | $130 | Polysilicon 0.0012 t, chemicals 0.003 t, electricity 0.08 MWh | Polysilicon and wafer plant | Global | 1.5 |
| Specialty gases and photoresists | t | $30,000 | Chemicals 5 t, natural gas 250 MMBtu, electricity 42 MWh | Chemical plant | Global (few suppliers) | 3.0 |
| Lithium chemicals | t | $14,000 | Lithium ore 8 t, chemicals 2 t, electricity 5 MWh, natural gas 50 MMBtu | Battery materials plant | Exchange | 2.0 |
| Cathode and anode materials | t | $25,000 | Lithium chemicals 0.45 t, nickel-cobalt intermediate 0.8 t, chemicals 0.9 t, electricity 10 MWh | Battery materials plant | Global | 1.5 |
| Rare earth oxides | t | $45,000 | Rare earth concentrate 5 t, chemicals 6 t, electricity 12.5 MWh | Battery materials plant | Regional (export controls) | 2.5 |
| Textiles | t | $3,200 | Cotton 1.1 t (or plastics 1 t), chemicals 0.2 t, electricity 2 MWh | Textile and garment works | Global | 1.2 |
| Pharmaceutical ingredients (APIs) | kg | $150 (generic; patented ×4) | Chemicals 0.005 t, electricity 0.1 MWh, water 0.0025 k m3 | Pharma plant | Global | 1.5 |
| Hydrogen | t | $5,000 | Natural gas 165 MMBtu, or electricity 55 MWh | Hydrogen plant | Regional | 1.5 |

### 2.6.4 Advanced components

| Good | Unit | Weight | Base price | Main inputs per unit | Made by | Market | ε |
|---|---|---|---|---|---|---|---|
| Advanced chips | 1 high-end processor die equivalent | 0.02 kg | $350 | Wafers 0.0167, specialty gases 0.00005 t, electricity 0.133 MWh, packaging and test 0.001 lot | Chip fab (advanced node) | Exchange | 2.5 |
| Mature chips | 100 microcontrollers or power chips | 0.5 kg | $120 | Wafers 0.04, specialty gases 0.00004 t, electricity 0.08 MWh, packaging and test 0.001 lot | Chip fab (mature node) | Exchange | 2.0 |
| Memory chips | 1 TB equivalent | 0.05 kg | $60 | Wafers 0.033, electricity 0.05 MWh, packaging and test 0.001 lot | Chip fab (memory) | Exchange | 2.0 |
| Packaging and test | lot of 1,000 chips | 0.5 kg | $2,000 | Plastics 0.01 t, refined copper 0.0025 t, gold 0.001 kg, electricity 1 MWh | Packaging plant | Global | 2.0 |
| Advanced packaging | unit | 0.1 kg | $1,200 | Wafers 0.083, specialty gases 0.0003 t, chemicals 0.003 t, electricity 0.83 MWh | Packaging plant | Global | 2.5 |
| Displays | phone-panel equivalent | 0.2 kg | $45 | Plastics 0.0004 t, chemicals 0.0008 t, quartz 0.0015 t, electricity 0.04 MWh, mature chips 0.005 | Display fab | Global | 1.5 |
| Sensors and cameras | lot of 10 | 0.3 kg | $60 | Mature chips 0.075, plastics 0.0005 t, refined copper 0.0001 t, electricity 0.025 MWh | Component plant | Global | 1.5 |
| Electric motors | 1 traction motor | 40 kg | $1,400 | Rare earth oxides 0.003 t, refined copper 0.03 t, steel 0.05 t, mature chips 0.2, electricity 1 MWh | Component plant | Global | 1.5 |
| Combustion engines | 1 engine | 150 kg | $3,000 | Steel 0.3 t, aluminium 0.125 t, plastics 0.02 t, mature chips 0.3, electricity 1.5 MWh | Component plant | Global | 1.2 |
| Vehicle parts kits | body, chassis and interior for 1 vehicle | 1,200 kg | $8,000 | Steel 1.4 t, aluminium 0.25 t, plastics 0.3 t, textiles 0.04 t, refined copper 0.04 t, mature chips 10, sensors 2, chemicals 0.15 t | Component plant | Regional | 1.2 |
| Battery cells | kWh | 6 kg | $95 | LFP: lithium chemicals 0.0012 t, chemicals 0.005 t, aluminium 0.0004 t, refined copper 0.0006 t, electricity 0.15 MWh. NMC: cathode and anode materials 0.0015 t, aluminium 0.0003 t, refined copper 0.0005 t, electricity 0.125 MWh | Battery gigafactory | Exchange | 2.0 |
| Battery packs | 60 kWh vehicle pack | 450 kg | $7,000 | Battery cells 60 kWh, mature chips 1, aluminium 0.05 t, sensors 0.5 | Component plant | Regional | 1.5 |
| Telecom equipment | 1 base station | 300 kg | $15,000 | Advanced chips 4, mature chips 20, sensors 2, aluminium 0.1 t, refined copper 0.05 t | Component plant | Global | 1.2 |
| Precision optics | 1 optics set | 200 kg | $3,000,000 | Quartz 5 t, rare earth oxides 0.05 t, specialty gases 0.1 t, electricity 200 MWh | Machinery plant | Global (single supplier at start) | 2.5 |
| Cyberware components | 1 neural interface kit | 0.5 kg | $2,500 | Advanced chips 1, sensors 2, rare earth oxides 0.0005 t, APIs 0.5 kg, plastics 0.002 t, advanced packaging 0.2 | Cyberware lab | Global | 2.0 |

### 2.6.5 Finished goods

| Good | Unit | Base price | Bill of materials per unit (input cost at base) | Made by | Market | ε |
|---|---|---|---|---|---|---|
| Smartphones | unit | $320 | Advanced chips 0.4, memory 0.25, displays 1, sensors 0.3, battery cells 0.02 kWh, mature chips 0.1, plastics and aluminium traces ($232) | Electronics assembly | Global | 0.8 |
| Personal computers | unit | $600 | Advanced chips 0.6, memory 1, displays 3, mature chips 0.3, battery cells 0.06 kWh, plastics and aluminium traces ($449) | Electronics assembly | Global | 0.8 |
| AI server nodes | 1 accelerator slot with its share of host, memory and networking | $40,000 | Advanced chips 40, memory 30, advanced packaging 4, mature chips 5, telecom equipment 0.02, copper, aluminium and steel 0.09 t ($21,760) | Electronics assembly | Global (export controls) | 1.5 |
| Electric vehicles | unit | $26,000 | Battery pack 1, electric motors 2, vehicle parts kit 1, mature chips 15, advanced chips 2, sensors 6, displays 2 ($20,750) | Vehicle plant | Global | 0.8 |
| Combustion vehicles | unit | $17,000 | Combustion engine 1, vehicle parts kit 1, mature chips 8, advanced chips 0.5, sensors 2, displays 1, refined fuels 0.3 bbl ($12,329) | Vehicle plant | Global | 0.8 |
| Pharmaceuticals | 1,000 doses | $600 | APIs 0.5 kg, plastics 0.0075 t, chemicals 0.005 t ($89) | Pharma plant | Global (approvals, patents) | 1.5 |
| Cyberware implants | 1 installed implant | $30,000 | Cyberware components 2, pharmaceuticals 1, healthcare 3 patient-months ($8,300) | Cyberware lab (implant clinic) | Regional (T1 Cyberware law) | 1.0 |
| Packaged food | t | $2,600 | Grain 1 t, oilseeds 0.3 t, livestock 0.3 t, plastics 0.05 t, electricity 0.4 MWh, water 0.033 k m3 ($1,097) | Food processing plant | Global | 1.5 |
| Clothing | 100 garments | $1,200 | Textiles 0.12 t, plastics 0.005 t ($391) | Textile and garment works | Global | 0.8 |
| Luxury goods | unit | $4,000 | Textiles 0.002 t, gold 0.005 kg, chemicals 0.001 t ($357); value is the brand | Textile and garment works (atelier) | Global | 0.5 |
| Small arms and munitions | lot | $150,000 | Steel 25 t, chemicals 20 t, plastics 2.5 t, refined copper 1.5 t ($51,000) | Defense works | Regional (licence, S1) | 1.0 |
| Military drones | unit | $25,000 | Advanced chips 2, sensors 6, electric motors 0.2, battery cells 5 kWh, telecom equipment 0.01, advanced packaging 0.5, plastics and aluminium 0.03 t ($2,615) | Defense works | Regional (licence) | 1.0 |
| Defense systems | unit (air defense battery or armored platform) | $5,000,000 | Advanced chips 400, sensors 700, telecom equipment 7, steel 100 t, refined fuels 700 bbl, electric motors 17 ($442,000) | Defense works | Government buyers only | 0.5 |
| Industrial robots | unit | $30,000 | Electric motors 6, sensors 10, advanced chips 2, mature chips 30, steel 1 t, aluminium 0.2 t ($14,430) | Machinery plant | Global | 1.2 |
| Lithography systems | unit | $150,000,000 | Precision optics 10, advanced chips 200, sensors 3,000, electric motors 400, specialty gases 5 t, steel 100 t, aluminium 50 t, rare earth oxides 2 t ($31.2M) | Machinery plant (lithography line) | Global (export controls, single supplier) | 2.5 |
| Solar panels | kW | $110 | Polysilicon 0.004 t, aluminium 0.01 t, refined copper 0.001 t, chemicals 0.005 t, mature chips 0.02 ($80) | Machinery plant | Global | 1.2 |
| Wind turbines | MW | $900,000 | Steel 600 t, plastics 60 t, refined copper 10 t, rare earth oxides 0.4 t, electric motors 2, sensors 20, mature chips 50 ($586,000) | Machinery plant | Global | 1.2 |

Gross margins at base price differ on purpose. Branded and protected goods (pharma, lithography, defense, luxury, AI servers) carry high gross margins that pay for heavy selling costs, R&D and plant capital (2.13). Mass goods (phones, vehicles) carry 20% to 30% gross margins. Commodity processing (refining, copper smelting, construction) runs thin.

### 2.6.6 Services

Services are produced and consumed in the same hub unless noted. Prices scale with the hub's PF.

| Service | Unit | Base price (PF 1.0) | Made by | Market | ε |
|---|---|---|---|---|---|
| Banking and finance | service unit (SU) | $2,000 | Office (finance line) | Local; tradable by fiber between countries with F2 Open or Reporting | 0.6 |
| Legal and consulting | SU | $2,000 | Office (legal line) | Regional (same legal system) | 0.6 |
| Media and advertising | media unit (1M targeted impressions) | $8,000 | Office (media line), Media studio | Regional (same language) | 0.8 |
| Logistics | freight unit (FU) = $1,000 of transport work at base rates | $1,000 | Warehouses, port terminals, carrier fleets | Follows routes | 1.0 |
| Cloud compute | compute unit (1,000 accelerator-hours) | $2,500 | Data center | Global by fiber; blocked by T2 Data Sovereignty | 1.5 |
| Telecom and connectivity | 100 subscriber-months | $3,000 | Telecom network | Local | 0.5 |
| Security services | guard-month | $6,500 | Security HQ | Local | 0.8 |
| PMC contracts | team-month (12 operators) | $450,000 | Security HQ (PMC line) | Global, if S1 allows | 1.0 |
| Healthcare | patient-month | $900 | Hospital | Local | 1.2 |
| Education and training | student-month | $900 | Campus | Local | 0.8 |
| Construction | construction unit (CU) | $100,000 × BI | Construction yard | Local | 1.0 |
| Retail and hospitality | SU | $1,000 | Retail store or mall | Local | 0.6 |
| Housing | dwelling-month | $1,800 in an L hub at PF 1.0, scaled by district land value | Residential real estate | Local | 1.5 |

### 2.6.7 Data goods (cyberpunk layer)

| Good | Unit | Base price | Made by | Market | ε |
|---|---|---|---|---|---|
| User data | data unit (DU) = 1M user-profile-months | $50,000 | Social platforms (Media studio), telecom networks (2 DU per 1,000 telecom units), e-commerce and cashierless retail | Global by fiber; output cut by T2 Data Privacy (-10% Notice and Consent, -30% Strict); Data Sovereignty keeps it in-country | 1.0 |
| Surveillance feeds | feed-month (one district) | $250,000 | Smart surveillance security, cashierless retail, telecom networks | Local and national; main buyers are police, governments and security firms | 1.0 |
| AI models | license-month (frontier class) | $10,000,000 | Data center (frontier training) | Global by fiber; T3 AI Regulation may require a licence | 1.0 |
| Black-market data | DU | 30% to 60% of the user data price | Netrun schemes, breaches, front companies | Black market only (2.9.9) | 1.5 |

### 2.6.8 Energy

| Good | Unit | Base price | Made by | Market |
|---|---|---|---|---|
| Electricity | MWh | $80 reference (set per grid by merit order, 2.9.7) | Power plants | Grid: one grid per hub, linked to neighbors by interconnectors |
| Hydrogen | t | $5,000 | Hydrogen plant | Regional |

Refined fuels, LNG, natural gas, coal and nuclear fuel are listed in their tiers above and serve as energy carriers.

---

## 2.7 Facilities and production methods

### 2.7.1 Facility rules

- A facility sits on one plot (or a merged site of several plots, 2.16.1) and has **levels**.
- **Ownership**: the company producing in a facility (its operator) either owns the building or leases it from the building owner (2.16.1, 2.16.7). Leased facilities pay rent instead of tying up capital; production rules are the same. Each level runs one **production method**. Facilities marked "product lines" let each level choose a different product.
- **Monthly output** of a level:

`Output = method output × Efficiency × Staffing × Condition factor × Input fill × Power fill × (1 - strike days / days in month) × deposit grade (extraction only)`

| Term | Rule |
|---|---|
| **Efficiency** | `1 + 0.01 × (manager Operations - 10)`, clamped 0.8 to 1.2. The manager is the company COO, or the CEO if there is none. Then ×1.05 if the company is a Loyal vassal, ×0.9 if the company is contested ([1-corporate-core.md](1-corporate-core.md) 1.3, 1.7.3). Learning: +1% per full year running the same method, up to +5% |
| **Staffing** | Weighted fill of the method's jobs: Professionals 0.40, Skilled 0.35, Unskilled 0.25 (weights renormalized to the segments the method uses). Gig workers can fill Unskilled jobs at 0.85 productivity where the method allows |
| **Condition factor** | `1 - max(0, 80 - condition) / 100`. Condition (0 to 100) falls 1 per month with normal upkeep, 0.5 with upkeep paid at 150%, 3 with no upkeep. Below 40: accident event chance 2% per month. Repair: 1% of build cost per point |
| **Input fill** | The scarcest input decides: `min over inputs of (received / needed)`. No substitution unless the method lists alternatives |
| **Power fill** | Share of the facility's electricity need delivered by the hub grid this month (2.9.7) |

- **Inputs scale with actual output. Labor does not**: wages are paid on headcount whether or not inputs arrive (strikers are not paid for strike days).
- **Idling** a level: workers are laid off (severance by labor law, default 2 months of wages), upkeep drops to 30%, condition falls 0.5 per month.
- **Throttling** (extraction only): oil, gas and mine levels can run at any rate from 0% to 100% for up to 3 months without layoffs. Upkeep stays at 100% and wages stay paid. After 3 months below 50%, the level must idle or return to at least 50%.
- **Retooling** (changing method): costs 25% of the level's construction cost and takes 25% of its build time; the level produces nothing meanwhile.
- **Automation levels**: A0 Manual, A1 Mechanized, A2 Automated, A3 Autonomous. Higher levels need fewer workers and more electricity, wear out robots (listed as "robot wear" inputs), raise cyberattack exposure (ransomware chance ×(1 + 0.5 × A)), and trigger L3 Automation Tax on the labor cost saved compared with the facility's A1 method ([4-politics.md](4-politics.md) 4.5.5).
- **Resource royalty**: extraction facilities (oil, gas, mines) pay the host a royalty on output value: default 12% for oil and gas, 5% for mining; Gulf states 40%, Russia 35%, Chile copper 8%, Indonesia nickel 10% (T). Royalties are a sector rule in country data.
- **Deposit value**: a Resource Field plot with a deposit is priced at land value plus 24 months of the deposit's expected net output at current prices.
- **Pollution**: each level of heavy industry (refinery, petrochemical, chemical, steel, smelter, coal power, mines) beyond 10 in a hub adds +0.5 target unrest in Residential and Slum districts and raises Environmentalist pressure. E8 Environmental Regulation costs apply.

### 2.7.2 Construction

`Construction cost per level = CU per level × hub CU price + equipment goods at market price + permit fee (1% of the total)`

- **CU price** in a hub is the market price of construction units (base $100,000 × BI), so a construction boom raises its own costs.
- **Build time** per level is in the table below. Building n levels at once takes `time × (1 + 0.15 × (n - 1))`.
- **Permits**: a Request Decision ([4-politics.md](4-politics.md) 4.10.1) with base permit time 6 weeks, ×E11 multiplier (Restrictive ×2, Permissive ×0.6, Developer-Led ×0.4), -15% at Presence.
- **Weekly progress**: construction consumes CU evenly week by week. If the hub cannot supply the CU, progress slows in proportion. Equipment goods must be delivered before the final 25% of the build.
- **Buying** an existing facility transfers its workforce, condition, method and any union contract.

| Facility | Districts | CU per level | Equipment per level | Build time per level | Max levels per plot | Upkeep per month (% of build cost) |
|---|---|---|---|---|---|---|
| Oil field | X, P (offshore) | 2,000 | Steel 5,000 t | 52 weeks (shale 26) | 5 | 0.3% |
| Gas field | X, P | 1,800 | Steel 4,000 t | 52 weeks | 5 | 0.3% |
| Mine | X | 2,500 | Autonomous method: robots 40, sensors 500 | 78 weeks (artisanal 4) | 5 | 0.3% |
| Farm | X | 150 | Combustion vehicles 50 | 13 weeks | 10 | 0.2% |
| Refinery | I, P | 6,000 | none | 104 weeks | 4 | 0.3% |
| Petrochemical plant | I, P | 3,000 | none | 78 weeks | 4 | 0.3% |
| Chemical plant (product lines) | I | 1,500 | none | 52 weeks | 5 | 0.3% |
| Steel mill | I, P | 2,500 | Robots 20 (A2 methods) | 104 weeks | 4 | 0.3% |
| Smelter | I, P | 3,000 | none | 104 weeks | 4 | 0.3% |
| Battery materials plant | I | 2,000 | none | 78 weeks | 4 | 0.3% |
| Polysilicon and wafer plant | I, T | 2,500 | Robots 30 | 78 weeks | 4 | 0.3% |
| Chip fab, mature node | T | 12,000 | Robots 200 | 104 weeks | 3 | 0.4% |
| Chip fab, memory | T | 18,000 | Lithography systems 4, robots 300 | 130 weeks | 3 | 0.4% |
| Chip fab, advanced node | T | 20,000 | Lithography systems 10, robots 500 | 156 weeks | 3 | 0.4% |
| Packaging plant | T, I | 1,500 | Robots 50 | 52 weeks | 4 | 0.3% |
| Display fab | T, I | 8,000 | Robots 100 | 104 weeks | 3 | 0.4% |
| Battery gigafactory | I | 3,000 | Robots 80 | 78 weeks | 4 | 0.3% |
| Component plant (product lines) | I | 800 | Robots 20 | 39 weeks | 6 | 0.3% |
| Electronics assembly (product lines) | I, S | 3,000 | Robots 60 (A2), 200 (A3) | 52 weeks | 6 | 0.3% |
| Vehicle plant | I | 3,500 | Robots 300 (A2), 800 (A3) | 104 weeks | 4 | 0.3% |
| Pharma plant | I, T | 1,200 | none | 78 weeks (includes approvals) | 4 | 0.3% |
| Cyberware lab | T, R, S (black clinic only) | 400 | none | 26 weeks | 4 | 0.4% |
| Food processing plant | I | 400 | Robots 10 (A2) | 26 weeks | 6 | 0.3% |
| Textile and garment works (product lines) | I, S | 80 | Robots 10 (A2) | 8 weeks | 8 | 0.2% |
| Machinery plant (product lines) | I, T | 1,500 | Robots 40 | 78 weeks | 4 | 0.3% |
| Defense works (product lines) | I | 1,500 | Robots 30 | 78 weeks (licence needed) | 4 | 0.3% |
| Gas power plant (500 MW) | I, P | 5,000 | none | 104 weeks | 2 | 0.3% |
| Coal power plant (500 MW) | I, P | 7,000 | none | 156 weeks | 2 | 0.3% |
| Nuclear plant (1,000 MW) | I, P | 60,000 | Nuclear fuel 20 t (first core) | 312 weeks | 1 | 0.2% |
| Small modular reactor (300 MW) | I, P, T | 15,000 | Nuclear fuel 6 t | 156 weeks | 3 | 0.3% |
| Solar farm (200 MW) | X, I | 600 | Solar panels 200,000 kW (tracking adds battery cells 400,000 kWh) | 26 weeks | 5 | 0.1% |
| Wind farm (200 MW) | X, P (offshore) | 1,000 | Wind turbines 200 MW | 52 weeks | 5 | 0.2% |
| Water works | P, I, X | 1,200 | none | 78 weeks | 3 | 0.3% |
| Hydrogen plant | I, P | 1,000 | none | 52 weeks | 4 | 0.3% |
| LNG terminal, liquefaction | P | 25,000 | none | 156 weeks | 2 | 0.3% |
| LNG terminal, regasification | P | 2,000 | none | 78 weeks | 2 | 0.3% |
| Office (product lines) | F, T, R | 400 | none | 26 weeks | 10 | 0.2% |
| Data center (20 MW IT) | T, I | 3,500 | AI server nodes 20,000 | 52 weeks | 5 | 0.4% |
| Warehouse and logistics depot | P, I | 200 | Robots 50 (A2) | 13 weeks | 8 | 0.2% |
| Port terminal | P | 4,000 | Robots 100 (A2) | 104 weeks | 3 | 0.3% |
| Retail store or mall | R, F, S | 300 | none | 26 weeks | 6 | 0.2% |
| Hospital | R | 1,500 | none | 78 weeks | 3 | 0.3% |
| Campus | R, T | 800 | none | 52 weeks | 3 | 0.2% |
| Security HQ | F, I | 200 | Combustion vehicles 20 | 13 weeks | 4 | 0.3% |
| Construction yard | I | 150 | Combustion vehicles 30 | 8 weeks | 6 | 0.3% |
| Media studio | F, T | 300 | none | 26 weeks | 4 | 0.3% |
| Research lab | T | 600 | none | 39 weeks | 6 | 0.3% |
| Telecom network | any (one per district) | 1,000 | Telecom equipment 400 | 52 weeks | 1 | 0.4% |
| Residential tower | R, S (tenement) | 1,000 (tenement 200) | none | 104 weeks | 4 | 0.2% |
| Office tower | F | 1,200 | none | 104 weeks | 4 | 0.2% |
| Industrial park | I | 300 | none | 39 weeks | 4 | 0.2% |

### 2.7.3 Extraction methods

All values per level per month. Labor is Professionals / Skilled / Unskilled. A = automation level. Tech = minimum tech tier (2.12).

| Facility | Method | Inputs | Outputs | Labor P/S/U | A | Tech |
|---|---|---|---|---|---|---|
| Oil field | Conventional wells | Electricity 3,000 MWh, refined fuels 3,000 bbl, chemicals 150 t | Crude oil 300,000 bbl | 10/60/30 | A1 | Energy 1 |
| | Enhanced recovery | Electricity 6,000, natural gas 400,000 MMBtu, chemicals 400 t | Crude oil 380,000 bbl | 15/70/20 | A2 | Energy 2 |
| | Shale (fracking) | Water 400 k m3, chemicals 900 t, aggregates 25,000 t, refined fuels 6,000 bbl | Crude oil 270,000 bbl; deposit depletes 3× faster | 10/90/40 | A1 | Energy 1 |
| Gas field | Conventional | Electricity 1,500, chemicals 100 t | Natural gas 9,000,000 MMBtu | 8/50/20 | A1 | Energy 1 |
| | Shale gas | Water 300 k m3, chemicals 700 t, aggregates 20,000 t, refined fuels 5,000 bbl | Natural gas 8,000,000 MMBtu | 8/80/40 | A1 | Energy 1 |
| | Associated gas capture (needs an oil field on the plot) | Electricity 800 | Natural gas 2,000,000 MMBtu | 3/15/5 | A2 | Energy 2 |
| Mine | Conventional open pit | Refined fuels 8,000 bbl, electricity 4,000, chemicals 300 t, steel 100 t | Ore by deposit (below) | 10/80/150 | A1 | Materials 1 |
| | Autonomous mine | Refined fuels 3,000, electricity 9,000, chemicals 300 t, steel 80 t, cloud compute 20, sensors 60, robot wear 1 | Ore ×1.25 | 20/50/15 | A3 | Materials 3 |
| | Artisanal (Slums or failed states only; gig labor) | Refined fuels 800 | Ore ×0.35 | 0/5/600 | A0 | none; child labor scandal risk 3% per month |
| Farm | Traditional | Fertilizer 150 t, refined fuels 1,500 bbl, water 600 k m3 | Crop by choice (below) | 0/20/150 | A1 | Agriculture 1 |
| | Industrial | Fertilizer 260 t, refined fuels 2,200 bbl, chemicals 40 t, water 800 k m3 | Crop ×1.35 | 2/35/40 | A2 | Agriculture 2 |
| | Precision agritech | Fertilizer 200 t, refined fuels 800 bbl, electricity 2,500, sensors 30, cloud compute 5, water 500 k m3 | Crop ×1.6 | 6/30/10 | A3 | Agriculture 3 |

**Mine output per level (conventional, grade 1.0)**: iron ore 80,000 t; coal 60,000 t; copper concentrate 4,000 t; bauxite 150,000 t; lithium ore 7,000 t; nickel-cobalt ore 25,000 t; rare earth concentrate 1,200 t; silica quartz 40,000 t; uranium ore 45 t; gold 100 kg; limestone and aggregates 400,000 t.

**Farm crops per level (traditional)**: grain 6,500 t; or oilseeds 3,800 t; or cotton 900 t; or timber 12,000 t; or livestock 700 t (needs grain 2,000 t as feed).

### 2.7.4 Processing methods

| Facility | Method | Inputs | Outputs | Labor P/S/U | A | Tech |
|---|---|---|---|---|---|---|
| Refinery | Simple distillation | Crude oil 300,000 bbl, electricity 5,000, natural gas 150,000 MMBtu | Refined fuels 275,000 bbl, chemicals 1,500 t | 10/50/25 | A1 | Energy 1 |
| | Complex cracking | Crude 300,000 bbl, electricity 8,000, natural gas 250,000, chemicals 50 t | Refined fuels 290,000 bbl, plastics 600 t, chemicals 1,000 t | 12/60/20 | A2 | Energy 2 |
| | Renewable fuels | Oilseeds 9,000 t, hydrogen 120 t, electricity 4,000 | Refined fuels 60,000 bbl (green: +15% price under E8 Carbon Pricing) | 8/30/10 | A2 | Energy 3 |
| Petrochemical plant | Naphtha cracker | Crude 20,000 bbl, natural gas 150,000, electricity 6,000 | Plastics 6,000 t | 15/80/40 | A1 | Materials 1 |
| | Ethane cracker | Natural gas 320,000, electricity 5,000 | Plastics 5,800 t | 15/60/20 | A2 | Materials 2 |
| | Bio-polymers | Oilseeds 9,000 t, electricity 6,000, chemicals 300 t | Plastics 4,500 t (green premium +15%) | 15/60/30 | A2 | Materials 3 |
| Chemical plant (product lines) | Basic chemicals | Natural gas 90,000, crude 12,000 bbl, limestone 3,000 t, electricity 6,000 | Industrial chemicals 6,000 t | 15/70/40 | A1 | Materials 1 |
| | Fertilizer (ammonia) | Natural gas 280,000, electricity 3,000 | Fertilizer 10,000 t | 10/50/20 | A2 | Agriculture 1 |
| | Cement kiln | Limestone 30,000 t, coal 2,400 t, electricity 2,200 | Cement 20,000 t | 10/80/60 | A1 | Materials 1 |
| | Fab chemicals | Chemicals 600 t, natural gas 30,000, electricity 5,000, steel 5 t | Specialty gases and photoresists 120 t | 40/40/10 | A2 | Semiconductors 2 |
| | Fuel enrichment (licence) | Uranium ore 16 t, electricity 800, chemicals 40 t | Nuclear fuel 2 t | 40/60/10 | A2 | Energy 2 |
| Steel mill | Blast furnace (BF-BOF) | Iron ore 32,000 t, coal 16,000 t, limestone 5,000 t, electricity 4,000 | Steel 20,000 t | 20/180/100 | A1 | Materials 1 |
| | Gas DRI and electric arc | Iron ore 30,000 t, natural gas 230,000, electricity 12,000 | Steel 20,000 t | 20/120/50 | A2 | Materials 2 |
| | Green hydrogen DRI | Iron ore 30,000 t, hydrogen 1,100 t, electricity 14,000 | Steel 20,000 t (green premium +10% under Carbon Pricing) | 25/110/40 | A2 | Materials 3 |
| Smelter (product lines) | Aluminium | Bauxite 22,000 t, electricity 75,000, coal 2,000 t, chemicals 400 t | Aluminium 5,000 t | 15/150/80 | A1 | Materials 1 |
| | Copper | Copper concentrate 4,200 t, electricity 3,500, chemicals 150 t | Refined copper 1,000 t, chemicals 300 t (acid by-product) | 10/80/40 | A1 | Materials 1 |
| | Nickel-cobalt leaching (HPAL) | Nickel-cobalt ore 25,000 t, chemicals 3,000 t, electricity 5,000 | Nickel-cobalt intermediate 1,300 t | 15/100/60 | A2 | Materials 2 |
| Battery materials plant (product lines) | Lithium refining | Lithium ore 8,000 t, chemicals 2,000 t, electricity 5,000, natural gas 50,000 | Lithium chemicals 1,000 t | 15/60/30 | A1 | Mobility 1 |
| | Cathode and anode | Lithium chemicals 450 t, nickel-cobalt intermediate 800 t, chemicals 900 t, electricity 10,000 | Cathode and anode materials 1,000 t | 25/80/30 | A2 | Mobility 2 |
| | Rare earth separation | Rare earth concentrate 1,000 t, chemicals 1,200 t, electricity 2,500 | Rare earth oxides 200 t; heavy pollution (counts as 3 heavy levels) | 15/60/60 | A1 | Materials 2 |
| Polysilicon and wafer plant | Polysilicon (Siemens process) | Silica quartz 1,500 t, coal 500 t, chemicals 300 t, electricity 35,000 | Polysilicon 500 t | 15/60/20 | A1 | Semiconductors 1 |
| | Wafer slicing and polishing | Polysilicon 60 t, chemicals 150 t, electricity 4,000, water 50 k m3 | Silicon wafers 50,000 | 30/120/40 | A2 | Semiconductors 2 |
| Hydrogen plant | Steam reforming | Natural gas 165,000 MMBtu | Hydrogen 1,000 t | 10/40/10 | A2 | Energy 2 |
| | Electrolysis | Electricity 55,000, water 10 k m3 | Hydrogen 1,000 t (green) | 10/40/5 | A2 | Energy 3 |
| LNG terminal | Liquefaction (export) | Natural gas 11,500,000 MMBtu, electricity 10,000 | LNG 10,000,000 MMBtu | 30/150/50 | A2 | Energy 2 |
| | Regasification (import) | LNG 10,000,000 MMBtu, electricity 2,000 | Natural gas 9,800,000 MMBtu | 10/60/20 | A2 | Energy 1 |

### 2.7.5 Semiconductor and electronics component methods

| Facility | Method | Inputs | Outputs | Labor P/S/U | A | Tech |
|---|---|---|---|---|---|---|
| Chip fab | Mature node | Wafers 10,000, specialty gases 10 t, chemicals 200 t, electricity 20,000, water 300 k m3, packaging and test 250 lots | Mature chips 250,000 | 150/300/50 | A2 | Semiconductors 1 |
| | Memory | Wafers 20,000, specialty gases 15 t, chemicals 300 t, electricity 30,000, water 400 k m3, packaging and test 600 lots | Memory chips 600,000 | 250/450/50 | A2 | Semiconductors 2 |
| | Advanced node | Wafers 5,000, specialty gases 15 t, chemicals 300 t, electricity 40,000, water 500 k m3, packaging and test 300 lots | Advanced chips 300,000 | 400/600/50 | A2 | Semiconductors 3 (Semiconductors 4 for "angstrom node": output ×1.4) |
| Packaging plant (product lines) | Standard assembly and test | Plastics 20 t, refined copper 5 t, gold 2 kg, chemicals 10 t, electricity 2,000 | Packaging and test 2,000 lots | 30/200/400 | A1 | Semiconductors 1 |
| | Automated assembly and test | As standard, electricity 3,000, robot wear 2 | Packaging and test 2,600 lots | 40/150/80 | A2 | Semiconductors 2 |
| | Advanced packaging | Wafers 500, specialty gases 2 t, chemicals 20 t, electricity 5,000 | Advanced packaging 6,000 | 120/250/60 | A2 | Semiconductors 3 |
| Display fab | LCD | Plastics 150 t, chemicals 300 t, quartz 600 t, electricity 15,000, mature chips 2,000 | Displays 400,000 | 60/300/150 | A2 | Electronics 1 |
| | OLED | Plastics 120 t, chemicals 350 t, quartz 500 t, rare earth oxides 1 t, electricity 20,000, mature chips 2,200 | Displays 450,000 | 80/300/80 | A2 | Electronics 2 |
| | MicroLED and AR optics | Chemicals 300 t, quartz 400 t, specialty gases 5 t, electricity 22,000, mature chips 2,500, wafers 2,000 | Displays 300,000; unlocks ocular cyberware | 120/250/40 | A3 | Electronics 4 |
| Battery gigafactory | LFP cells | Lithium chemicals 120 t, chemicals 500 t, aluminium 40 t, refined copper 60 t, steel 30 t, electricity 15,000 | Battery cells 100,000 kWh | 40/250/150 | A2 | Mobility 1 |
| | NMC cells | Cathode and anode materials 180 t, aluminium 40 t, refined copper 60 t, chemicals 150 t, electricity 15,000 | Battery cells 120,000 kWh | 40/250/120 | A2 | Mobility 2 |
| | Solid-state cells | Cathode and anode materials 150 t, lithium chemicals 60 t, specialty gases 1 t, electricity 18,000 | Battery cells 150,000 kWh; also powers cyberware | 60/200/60 | A3 | Mobility 4 |
| Component plant (product lines) | Electric motors | Rare earth oxides 6 t, refined copper 60 t, steel 100 t, mature chips 400, electricity 2,000 | Electric motors 2,000 | 20/150/100 | A2 | Mobility 1 |
| | Combustion engines | Steel 600 t, aluminium 250 t, plastics 40 t, mature chips 600, electricity 3,000 | Combustion engines 2,000 | 25/250/150 | A1 | Mobility 1 |
| | Sensors and cameras | Mature chips 3,000, plastics 20 t, refined copper 5 t, chemicals 10 t, electricity 1,000 | Sensors 40,000 lots | 30/120/150 | A2 | Electronics 1 |
| | Battery packs | Battery cells 60,000 kWh, mature chips 1,000, aluminium 50 t, sensors 500 | Battery packs 1,000 | 15/150/80 | A2 | Mobility 1 |
| | Vehicle parts kits | Steel 1,400 t, aluminium 250 t, plastics 300 t, textiles 40 t, refined copper 40 t, mature chips 10,000, sensors 2,000, chemicals 150 t | Vehicle parts kits 1,000 | 30/300/300 | A1 | Mobility 1 |
| | Telecom equipment | Advanced chips 800, mature chips 4,000, sensors 400, aluminium 20 t, refined copper 10 t | Telecom equipment 200 | 60/120/40 | A2 | Electronics 2 |

### 2.7.6 Finished goods methods

Assembly facilities use the product's bill of materials from 2.6.5 for each unit made.

| Facility | Method | Inputs | Outputs per level | Labor P/S/U | A | Tech |
|---|---|---|---|---|---|---|
| Electronics assembly (product lines) | Manual line | Bill of materials; electricity 2,000 | Smartphones 200,000, or PCs 80,000, or AI server nodes 1,000 | 40/300/3,000 (gig allowed) | A1 | Electronics 1 (AI nodes: Electronics 3) |
| | Automated line | Bill of materials; electricity 4,000; robot wear 1 | ×1.1 | 80/300/600 | A2 | Electronics 2 |
| | Lights-out line | Bill of materials; electricity 6,000; robot wear 3; cloud compute 50 | ×1.2 | 60/100/50 | A3 | Electronics 3 |
| Vehicle plant | Traditional line | Bill of materials; electricity 6,000 | 4,000 vehicles (EV or combustion, per level) | 60/1,200/1,500 | A1 | Mobility 1 (EV: Mobility 2) |
| | Automated line | Bill of materials; electricity 9,000; robot wear 3 | 4,500 vehicles | 100/900/400 | A2 | Mobility 2 |
| | Gigapress autonomous | Bill of materials with parts kits ×0.8; electricity 14,000; robot wear 8 | 5,000 vehicles | 120/500/100 | A3 | Mobility 3 |
| Pharma plant (product lines) | API synthesis | Chemicals 100 t, electricity 2,000, water 50 k m3 | APIs 20,000 kg | 60/100/40 | A1 | Biotech 1 |
| | Formulation and packaging | APIs 1,000 kg, plastics 15 t, chemicals 10 t | Pharmaceuticals 2,000 | 80/150/80 | A1 | Biotech 1 |
| | Biologics bioreactor | Grain 50 t, chemicals 40 t, electricity 4,000, water 100 k m3 | Pharmaceuticals 2,500 (sold at ×3 price: patented biologics) | 120/150/40 | A2 | Biotech 3 |
| Cyberware lab (product lines) | Component line | Advanced chips 1,000, sensors 2,000, rare earth oxides 0.5 t, APIs 500 kg, plastics 2 t, advanced packaging 200 | Cyberware components 1,000 | 80/60/10 | A2 | Cyberware 2 |
| | Implant clinic | Cyberware components 200, pharmaceuticals 100, healthcare 300 | Cyberware implants 100 | 40/20/5 | A1 | Cyberware 2 |
| | Black clinic (Slums only) | Cyberware components 120, pharmaceuticals 30 | Cyberware implants 100 (unlicensed: rejection chance ×3; exposure +5 per month where T1 is not Unrestricted) | 5/10/10 | A0 | Cyberware 1 |
| Food processing plant | Traditional | Grain 3,000 t, oilseeds 900 t, livestock 900 t, plastics 150 t, electricity 1,200, water 100 k m3 | Packaged food 3,000 t | 10/150/400 | A1 | Agriculture 1 |
| | Automated | As traditional, electricity 2,000, robot wear 0.5 | Packaged food 3,300 t | 15/120/100 | A2 | Agriculture 2 |
| | Cultured protein | Grain 2,000 t, chemicals 200 t, electricity 8,000, water 150 k m3 | Packaged food 3,000 t (no livestock) | 40/120/40 | A2 | Agriculture 3 |
| Textile and garment works (product lines) | Spinning and weaving | Cotton 1,100 t (or plastics 1,000 t), chemicals 200 t, electricity 2,000 | Textiles 1,000 t | 10/150/400 | A1 | Materials 1 |
| | Sweatshop garment line (Slums allowed) | Textiles 120 t, plastics 5 t | Clothing 1,000 | 0/40/1,200 (gig allowed) | A0 | none; labor scandal risk 2% per month |
| | Standard garment line | Textiles 120 t, plastics 5 t, electricity 300 | Clothing 1,000 | 5/80/600 | A1 | Materials 1 |
| | Automated knitting | Textiles 115 t, electricity 900, robot wear 1 | Clothing 1,000 | 10/60/80 | A2 | Materials 2 |
| | Luxury atelier | Textiles 2 t, gold 5 kg, chemicals 1 t | Luxury goods 1,000 | 40/200/20 | A0 | Retail and Brands 2 |
| Machinery plant (product lines) | Robots | Bill of materials | Industrial robots 200 | 60/300/100 | A2 | Materials 2 |
| | Solar panels | Bill of materials | Solar panels 100,000 kW | 20/150/150 | A2 | Energy 2 |
| | Wind turbines | Bill of materials | Wind turbines 10 MW | 40/200/100 | A2 | Energy 2 |
| | Precision optics | Silica quartz 50 t, rare earth oxides 0.5 t, specialty gases 1 t, electricity 2,000 | Precision optics 10 sets | 300/200/20 | A2 | Semiconductors 3 (proprietary at start: Frankfurt) |
| | Lithography | Bill of materials | Lithography systems 1 | 800/600/50 | A2 | Semiconductors 4 (proprietary at start: Eindhoven) |
| Defense works (product lines, licence) | Munitions | Steel 500 t, chemicals 400 t, plastics 50 t, refined copper 30 t | Small arms and munitions 20 lots | 20/200/150 | A1 | Security 1 |
| | Drones | Bill of materials | Military drones 500 | 60/200/100 | A2 | Security 2 |
| | Systems integration | Bill of materials | Defense systems 3 | 150/300/100 | A2 | Security 3 |

### 2.7.7 Energy and utility methods

Monthly electricity output assumes 730 hours per month and the capacity factor shown. Dispatchable plants run as much as the grid's merit order calls for (2.9.7).

| Facility | Method | Fuel and inputs | Max output per level | Labor P/S/U | A | Tech |
|---|---|---|---|---|---|---|
| Gas power plant (500 MW) | Open-cycle peaker | Natural gas 10 MMBtu per MWh | 110,000 MWh (capacity factor 0.30, fully flexible) | 5/30/10 | A2 | Energy 1 |
| | Combined cycle | Natural gas 7 MMBtu per MWh | 255,000 MWh (0.70) | 8/40/10 | A2 | Energy 1 |
| | Combined cycle with carbon capture | Natural gas 7.8 MMBtu and chemicals 0.01 t per MWh | 230,000 MWh; exempt from carbon pricing | 10/50/10 | A2 | Energy 3 |
| Coal power plant (500 MW) | Subcritical | Coal 0.5 t per MWh | 255,000 MWh (0.70) | 10/120/80 | A1 | Energy 1 |
| | Supercritical | Coal 0.42 t per MWh | 270,000 MWh (0.74) | 12/100/50 | A2 | Energy 2 |
| Nuclear plant | Large reactor (1,000 MW) | Nuclear fuel 2 t, water 2,000 k m3 | 650,000 MWh (0.90, baseload only) | 120/400/80 | A2 | Energy 2 |
| | Small modular reactor (300 MW) | Nuclear fuel 0.7 t, water 500 k m3 | 200,000 MWh (0.91) | 40/90/10 | A3 | Energy 3 |
| Solar farm (200 MW) | Fixed tilt | none | 29,000 MWh (0.20, daytime only) | 2/10/5 | A2 | Energy 1 |
| | Tracking plus storage | none (batteries installed at build) | 40,000 MWh, part shifted to evening peak | 3/12/5 | A2 | Energy 2 |
| Wind farm (200 MW) | Onshore | none | 51,000 MWh (0.35) | 3/15/5 | A2 | Energy 1 |
| | Offshore (Port districts) | none | 66,000 MWh (0.45) | 5/25/5 | A2 | Energy 2 |
| Water works | Groundwater treatment | Electricity 400, chemicals 10 t | Fresh water 1,000 k m3 | 2/20/20 | A1 | Energy 1 |
| | Desalination | Electricity 3,500, chemicals 20 t | Fresh water 1,000 k m3 | 5/30/10 | A2 | Energy 2 |

Hydro and geothermal plants exist only as starting assets in hub data; they cannot be built in the first release.

### 2.7.8 Digital and services methods

| Facility | Method | Inputs | Outputs per level | Labor P/S/U | A | Tech |
|---|---|---|---|---|---|---|
| Office (product lines: finance, legal, media agency) | Traditional | Electricity 300, telecom 3, user data 0.5 DU (finance and media lines) | Banking or legal 4,000 SU, or media 1,200 media units | 250/60/20 | A0 | none |
| | AI-augmented | Electricity 500, telecom 3, cloud compute 300, user data 1 DU | Same output | 120/30/10 | A2 | Digital 2 |
| | AI-native | Electricity 600, cloud compute 900, AI models 0.03 | Output ×1.1 | 30/10/5 | A3 | Digital 4 |
| Data center (20 MW IT) | Air-cooled | Electricity 21,000 (PUE 1.45), water 40 k m3, telecom 10, AI server nodes 400 (replacement, 2% per month) | Cloud compute 14,600 units | 40/60/10 | A2 | Digital 1 |
| | Liquid-cooled | Electricity 17,000 (PUE 1.15), water 20 k m3, telecom 10, AI server nodes 400 | Cloud compute 14,600 units | 30/50/5 | A3 | Digital 2 |
| | Sovereign cloud | As air-cooled, plus security services 30 | Cloud compute 13,000 units, sold at +20% in Restricted and Closed countries and to governments; satisfies T2 Data Sovereignty | 50/70/10 | A2 | Digital 2 |
| | Frontier training | As liquid-cooled, plus user data 10 DU | _Superseded by training runs in [6-technocapital.md](6-technocapital.md) 6.5_; read as a level reserved for training | 200/50/5 | A3 | Digital 3 |
| Warehouse and logistics depot | Manual | Electricity 300, refined fuels 2,000 bbl | Storage 50,000 t; logistics 2,000 FU | 5/60/200 | A1 | Logistics 1 |
| | Automated | Electricity 800, refined fuels 1,800, robot wear 1 | Storage 60,000 t; logistics 2,500 FU | 8/50/40 | A2 | Logistics 2 |
| | Autonomous fleet | Electricity 1,500, battery cells 500 kWh, cloud compute 20 | Storage 60,000 t; logistics 2,500 FU; truck legs starting here cost -30% | 10/40/10 | A3 | Logistics 3 |
| Port terminal | Conventional | Electricity 1,000, refined fuels 1,500 bbl | Throughput 1,000,000 t per month; earns the handling fees of 2.4.1 | 10/150/300 | A1 | Logistics 1 |
| | Automated | Electricity 3,000, robot wear 2 | Throughput 1,300,000 t; strikes cut throughput half as much | 20/100/50 | A2 | Logistics 2 |
| | Free-trade zone (needs C6 Tax Zones) | As automated | As automated; tariffs deferred until goods leave the zone; re-exports tariff-free | 20/100/50 | A2 | Logistics 2 |
| Retail store or mall | Traditional | Electricity 300 | Retail 1,000 SU; sells up to $10M of finished goods to the population per month at a 12% markup | 10/40/150 | A1 | none |
| | E-commerce hub | Electricity 500, cloud compute 50, logistics 200 FU | Retail 1,200 SU; $14M goods capacity; user data 1 DU | 15/30/40 plus 120 gig | A2 | Digital 1 |
| | Cashierless | Electricity 600, sensors 200, cloud compute 100 | Retail 1,100 SU; $12M goods capacity; surveillance feeds 0.5 | 10/20/20 | A3 | Digital 2 |
| Hospital | General | Pharmaceuticals 300, electricity 1,500, water 30 k m3, plastics 20 t | Healthcare 8,000 patient-months | 300/200/150 | A1 | Biotech 1 |
| | AI diagnostics | Pharmaceuticals 300, electricity 2,000, cloud compute 100, sensors 50 | Healthcare 9,000 | 180/150/100 | A2 | Biotech 2 |
| | Cyber-surgical center | Pharmaceuticals 400, electricity 2,500 (implant components bought per install) | Healthcare 7,000; installs up to 150 implants per month | 300/200/100 | A2 | Cyberware 2 |
| Campus | Traditional | Electricity 300 | Education 3,000 student-months | 100/50/50 | A1 | none |
| | AI tutoring | Electricity 400, cloud compute 100 | Education 4,500 student-months | 50/30/20 | A2 | Digital 2 |
| Security HQ (product lines) | Corporate security | Refined fuels 200 bbl, combustion vehicles 2 | Security services 500 guard-months | 20/50/400 | A1 | Security 1 |
| | Smart surveillance | Sensors 200, cloud compute 50, telecom 5 | Security services 600; surveillance feeds 2 | 30/60/150 | A2 | Security 2 |
| | Private military (needs S1 Licensed or Unrestricted) | Small arms 1 lot, military drones 5, refined fuels 1,000 bbl, combustion vehicles 5 | PMC 10 team-months | 30/150/50 | A1 | Security 3 |
| Construction yard | Conventional | Steel 800 t, cement 6,000 t, refined fuels 1,000 bbl, electricity 200 | Construction 40 CU | 10/100/400 | A1 | Materials 1 |
| | Prefab and modular | Steel 900 t, cement 4,500 t, plastics 100 t, electricity 1,500, robot wear 1 | Construction 45 CU | 15/100/150 | A2 | Materials 2 |
| | Robotic and 3D printed | Steel 600 t, cement 5,000 t, electricity 3,000, robot wear 2 | Construction 50 CU | 20/60/40 | A3 | Materials 3 |
| Media studio | Broadcast and publishing | Electricity 300, telecom 2 | Media 800 units; audience reach in its hub +2% per level | 150/100/30 | A1 | Media 1 |
| | Social platform | Cloud compute 500, telecom 20 | Media 1,500 units; user data 20 DU; audience reach +3% per level | 100/30/10 plus 200 gig moderators | A2 | Media 2 |
| | Synthetic media | Cloud compute 800, AI models 0.05 | Media 2,000 units; psyops and ad campaigns run by the owner cost -40% | 40/10/5 | A3 | Media 3 |
| Research lab | Standard | Electricity 500, chemicals 20 t, cloud compute 50 | 40 research points (RP) in one sector | 120/30/10 | A1 | none |
| | AI-assisted research | Electricity 800, cloud compute 600, user data 2 DU | 70 RP | 80/20/5 | A2 | Digital 3 |
| Telecom network | 5G | Electricity 2,000, telecom equipment 5 (wear) | Telecom 1,000 units; user data 2 DU; surveillance feeds 0.2 | 40/150/50 | A2 | Electronics 2 |

### 2.7.9 Selling and overhead costs

Each company pays **selling, general and administrative (SG&A)** costs as a share of revenue, by sector (T): commodities and energy 2%, heavy industry 3%, chips and components 5%, vehicles 7%, cloud and data 8%, consumer electronics 10%, food and retail 8%, other services 15%, media 10%, pharma 25%, luxury 35%, defense 6%. A COO on the Grow operations or Cut costs task cuts it by up to 20% (`1% per Operations point above 10`). SG&A is how branded goods give back much of their gross margin.

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
- **Companies do not choose how much slop they make** (Logan). Each good's recipe has a **slop ratio**: the amount of slop produced for each one good made. A hub's slop output is the sum over every production in the hub of units made × the recipe's slop ratio.
- Starting slop ratios **(A)**: consumer goods (phones, PCs, cars, EVs, GPUs) 1 slop per $1,000 of base price; other finished goods and components 0.3 per $1,000; raw and intermediate goods 0.1 per $1,000 **(T)**.
- **Slop need** = Underclass population in the hub (millions) × 100,000 per month **(T)**.
- **Slop ratio of the hub** = output ÷ need.

| Slop ratio | Effect on the hub **(T)** |
|---|---|
| Below 0.8 | Underclass unrest +1 per month for every 0.1 below 0.8 |
| 0.8 to 1.2 | Stable: Underclass unrest held at its floor |
| Above 1.2 | Surplus: for every 0.1 above 1.2, education quality -1%, health -1% and birth rate -1% per year in the hub |


**Debt spiral (A).** A PMC member whose savings go negative for 6 months **(T)** drops into the Permanent Underclass. Climbing back needs 12 months **(T)** of positive savings plus a PMC job. Named characters can fall the same way (John Oligarch starts close to it; Samir Haddad starts in it).

**Glitterati fields (A).** Each Glitterati character rates 1 to 20 in one or two fields (Management, Media, Sport, Entertainment, Fashion, Law, Medicine). Affiliation (an executive post, an endorsement, a board seat) gives the organization a bonus of 1% per rating point in matching work **(T)**. Glitterati get a -5 penalty to Techno-Capital allocation checks **(T)**.

**Noble fade (A).** Bloodline gives Noble children a large clout and prestige start. A grandchild keeps Noble standing only by earning 500 renown **(T)** in their own life; otherwise the line's clout fades.

### 2.8.1 Segments

Population is tracked per hub as six segments of the labor force (half the metro population). Wages are monthly at WI 1.0 and are multiplied by the country's WI and the local tightness factor (2.8.4).

| Segment | Base wage | Employer cost | Jobs they fill | Expected basket | Spending share of disposable income | Political leaning (top groups, from [4-politics.md](4-politics.md) 4.4.2) | Main unrest drivers |
|---|---|---|---|---|---|---|---|
| **Elite** | $60,000 (mostly capital income; executives are characters) | n/a | none in facilities | Basic ×2, Comfort ×4, Luxury ×6 | 40% | Financiers, Industrialists, Landowners, Tech Sector | Wealth taxes, expropriation, instability, crime |
| **Professionals** | $8,500 | Wage ×1.25 | P jobs | Basic ×1.3, Comfort ×2, Luxury ×0.5 | 65% | Tech Sector, Environmentalists, State Apparatus, Financiers | AI automation of office work, housing costs, privacy, inflation |
| **Skilled Workers** | $5,200 | Wage ×1.25 | S jobs | Basic ×1.1, Comfort ×1.2, Luxury ×0.1 | 75% | Labor Unions, Traditionalists, Industrialists | Automation, plant closures, wage cuts, imports |
| **Unskilled Workers** | $3,100 | Wage ×1.25 | U jobs | Basic ×1.0, Comfort ×0.5 | 90% | Labor Unions, Traditionalists | Unemployment, food and energy prices, rent |
| **Gig Workers** | $2,300 | Wage ×1.05 (plus L4 Gig Worker Status costs) | U jobs where the method allows gig; delivery; moderation | Basic ×1.0, Comfort ×0.3 | 95% | Gig Workers, Traditionalists, Labor Unions | No benefits, price spikes, platform pay cuts |
| **Unemployed** | Benefits by law (default 30% of the Unskilled wage) | n/a | none (rehired by former skill) | Basic ×0.8 | 100% | Labor Unions, Traditionalists, Shadow Economy | All of the above, plus crime and black markets |

- **Disposable income** = wage × (1 - effective income tax). Effective tax = E1 top rate × segment factor: Elite 0.8, Professionals 0.6, Skilled 0.45, Unskilled 0.3, Gig 0.2, Unemployed 0.
- **Unemployed keep a skill tag** (former Professional, Skilled or Unskilled) so they can be rehired into the right jobs.
- Employer cost overhead (×1.25) covers payroll taxes and benefits. L4 adds +6% or +18% for gig (politics).

### 2.8.2 Needs baskets

> **Changed (Logan, 2026-10-17).** The game is an alternate reality a little more futuristic than ours. Basic necessities such as food and clothing are always met and so oversaturated that there is no real market for them. **Population needs are consumer goods.** The Permanent Underclass needs only slop (2.8.0). The baskets below are being reworked to match: the Basic basket drops food, clothing and water; housing, energy and healthcare stay as PMC needs (Logan); packaged food and clothing stay in the goods list with no population demand, flooded markets and thin margins **(A)**.


Per member of the labor force per month, at base prices and PF 1.0. Goods are bought at hub prices; services and housing scale with PF.

| Basket | Contents | Cost at base |
|---|---|---|
| **Basic** | Packaged food 0.06 t, housing 0.4 dwelling-months, electricity 0.5 MWh, refined fuels 0.3 bbl, water 0.006 k m3, clothing 0.015, healthcare 0.3 patient-months, telecom 0.01 | $1,267 |
| **Comfort** | Smartphones 0.03, PCs 0.01, vehicles 0.003 (EV or combustion by price and fuel cost), retail 0.3 SU, media 0.01 units, banking 0.05 SU, education 0.2 student-months, pharmaceuticals 0.05, extra packaged food 0.02 t | about $835 |
| **Luxury** | Luxury goods 0.1, cyberware implants 0.002, security services 0.05 guard-months, extra healthcare 0.5, banking 0.3 SU, extra housing 0.6 dwelling-months | about $2,915 |

- **Country basket factor** = `0.35 + 0.65 × WI` scales every basket quantity (US 1.0, China 0.55, India 0.43). Poorer countries expect less, but goods priced on world markets still cost the same, which is what makes imported phones and fuel spikes painful there.
- **Buying order**: each segment spends its budget (disposable × spending share) on Basic first, then Comfort, then Luxury, each scaled by its expected multiplier. Shortages and rationing in the hub reduce what can be bought even with money.
- **Needs satisfaction** = `0.6 × Basic fill + 0.3 × Comfort fill + 0.1 × Luxury fill` (a tier the segment does not expect counts as filled). Range 0 to 1.
- Money left over is **saved** into hub deposits (used by banks; see [07-markets.md](../07-markets.md)).

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

- **Hiring (weekly)**: a facility posts its method's jobs. They are filled first from the Unemployed with the right skill tag, then from the segment's free pool, then poached from other employers in the hub at +10% wage. A facility can hire at most 25% of its jobs per week.
- **Local wage (monthly)**: `Wage = base wage × WI × tightness`, where `tightness = clamp(1 + 2 × (employment rate of the segment - 0.95), 0.85, 1.6)`. Wages move at most 3% per month (sticky), except for one-off law effects (L2 Sectoral Bargaining +8%). L1 Minimum Wage sets a floor as a share of the hub's median wage.
- **Training programs** (company action): Unskilled to Skilled costs $12,000 × WI per worker over 6 months (85% complete); Skilled to Professional costs $40,000 × WI over 24 months, or comes from Campus education output (1 Professional per 24 student-months).
- **Natural education (yearly)**: 1% of Unskilled become Skilled; 0.5% of Skilled become Professionals; more where campuses exist.
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
              + pollution term (2.7.1)
              + law terms ([4-politics.md](4-politics.md): L2 Banned +5, S2 Militarized +3, Community -3, Carbon Pricing rebate -2, E11 Developer-Led +3 in Residential and Slums)
              + 5 if an interest group the segment supports is Angry
              + event modifiers (a strike crushed by force +10, price controls on essentials -2)
              - 5 if union contracts cover 50% or more of the segment's jobs in the hub
```

Segment offsets: Elite 5, Professionals 10, Skilled 10, Unskilled 13, Gig 15, Unemployed 25.

**Actual unrest moves 25% of the way toward the target each month.** Hub unrest (population-weighted) feeds the politics stability formula ([4-politics.md](4-politics.md) 4.11.7).

| Unrest | Band | Effects |
|---|---|---|
| 0 to 24 | Calm | none |
| 25 to 39 | Restless | Ad campaign effectiveness -10% in the hub |
| 40 to 59 | Agitated | Strike checks active; protests; facility output -3% |
| 60 to 79 | Radical | Riot chance 5% per month (condition -2 in Industrial and Slum districts, retail closed 3 days); output -8%; land value -1% per month |
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

**Union recognition**: in a facility with 200 or more workers of a segment, when the hub's O for that segment is 35 or more, a union forms with 10% chance per month (×2 after a layoff wave). A **union contract** follows a recognition event: wages +5%, layoffs need 3 months' notice and double severance, and automation retooling triggers a negotiation event.

**Strike checks** (unionized facilities):

| Check | Chance |
|---|---|
| Monthly | `max(0, (unrest - 35) / 100) × (O / 100) × law factor`; law factor: Restricted 0.5 (0 in strategic sectors), Recognized 1.0, Sectoral Bargaining 1.2 |
| Immediate vote: automation retool or layoffs above 10% of the facility | `0.25 + 0.5 × O / 100` |
| Immediate vote: wage cut | `0.15 + 0.5 × O / 100` |
| Immediate vote: fatal accident (condition below 40) | 0.30 |
| Immediate vote: union leader fired | 0.50 |

**During a strike**: the striking segments stop; the facility runs at ×0.1 if only some segments strike and ×0 if all do. Strikers are not paid; upkeep and other wages continue.

**Union resolve** (R) starts at `20 + O / 2` and changes daily:

| Daily change | Value |
|---|---|
| Base | -2 |
| Lockout by the company | -1 more |
| Public support (company reputation below 0, or Labor Unions clout 20% or more in the country) | +0.5 |
| Strike fund financed by anyone (Fund Interest Group to Labor Unions) | +0.5 |
| Replacement workers hired | -2 |

The strike ends when R reaches 0 (workers return; segment unrest +5; O -10) or when the company accepts the demands.

**Demands** (1 to 3 rolled): wages +5% to +15%; cancel or delay an automation retool by 12 months; rehire laid-off workers; double severance; safety repairs (restore condition to 70).

**Company options** (event):

| Option | Result |
|---|---|
| Concede | Demands met; union O +5; segment unrest -5 |
| Negotiate | Success chance `40% + (negotiator's Influence or Operations - 10) × 3% + 10% if company reputation > 20`. Success: half the demands. Failure: strike continues, R +10 |
| Lockout | Output 0; R falls faster; reputation -5; segment unrest +5 |
| Hire replacements (where labor law allows) | Productivity 60% in the first month; riot chance 15%; union O +5 |
| Security crackdown (own Security HQ or PMC) | R -30 at once; reputation -15; segment unrest +10; riot chance 25%; investigation chance 20% in liberal democracies |
| Close the facility | Layoffs with severance; strike ends; unrest from layoffs |

**Spread**: under Sectoral Bargaining a strike spreads to each unionized facility of the same sector in the country with 30% chance. A sympathy strike hits same-sector facilities in the hub with 20% chance when O ≥ 60. A **general strike** happens when hub unrest is 70 or more and Skilled or Unskilled O is 60 or more: all facilities in the hub run at ×0.5 for 3 to 10 days. Typical strikes last 5 to 40 days. **Port strikes** cut port throughput to ×0.2 (×0.6 for automated terminals).

---

## 2.9 Demand and prices

### 2.9.1 Demand sources

| Source | What it buys | Cadence |
|---|---|---|
| **Population** | Needs baskets (2.8.2) | Weekly purchases from monthly budgets |
| **Facilities** | Method inputs, robot wear, server replacement | Weekly from stock targets |
| **Construction** | Construction units and equipment goods | Weekly while building |
| **Governments** | Budget lines (below) and contracts ([4-politics.md](4-politics.md) 4.9.7) | Monthly |
| **Strategic reserves** | Crude oil, grain, rare earth oxides, chips (some countries) | Refilled when prices fall below their 12-month average |
| **Exports** | Goods shipped to other hubs | Weekly |

**Government budget lines** (share of GDP per year, T): defense 2% (United States 3%, Russia 6%, Israel 5%, Saudi Arabia 6%), of which 30% defense systems, 10% drones, 10% munitions, 5% security and PMC services; infrastructure 3% as construction units; healthcare 5% in high-income countries (3% middle, 1.5% developing) as healthcare and pharmaceuticals; surveillance feeds 0.05% (0.3% under T4 Mass Surveillance or Social Credit).

### 2.9.2 Local price formula (weekly)

For each good in each hub:

```
S = this week's local production tranche + imports arriving + seller stock offered
    (sellers offer up to 25% per week of stock above their 4-week target)
D = population + facility inputs + construction + government + export orders
    + buyers rebuilding stock (up to 25% of their shortfall per week)
R = D / S            (if S = 0, R = 5)

Target price  P* = Anchor × clamp(R ^ ε, 0.3, 5.0)
Weekly step   P  = P_last + 0.5 × (P* - P_last)
Trade bounds  P  = clamp(P, export parity, import parity)   (2.9.3)
```

- **Anchor**: exchange goods use the exchange quote in local currency plus the hub's basis (2.9.6). Other tradable goods use the base price converted at the FX rate. Local goods and services use base price × PF.
- **ε** is per good (2.6).
- The half-gap step means a shock shows about 50% in week 1, 75% in week 2 and 88% in week 3.
- Monthly sales are settled at the average of the month's weekly prices.

### 2.9.3 Trade arbitrage: import and export parity

```
Landed cost from source s  = P_s × FX + T(s → h) + tariff_h × (P_s × FX + T(s → h))
Import parity (IPP)        = lowest landed cost over all sources with spare lane capacity
Export parity (EPP)        = highest (P_d × FX - T(h → d) - tariff_d × P_d × FX) over destinations
```

- Traders (AI logistics firms, and players) ship at the weekly step whenever the destination price exceeds the landed cost by **3% or more**. Volume shipped is the smaller of the lane's spare capacity and the volume that would close half the price gap.
- Because cargo arrives later (transit time), prices overshoot and swing a little before settling. This is intended: it gives traders and speculators something to play.
- A hub's price cannot rise above IPP while an import lane has spare capacity, and cannot fall below EPP while an export lane has spare capacity. When lanes are full or closed, the local formula rules alone.

### 2.9.4 Transport cost

```
T = Σ legs (mode rate × distance / 1,000 × weight per unit)
  + Σ terminal handling
  + Σ chokepoint tolls
  + insurance: cargo value × (0.1% + Σ chokepoint war risk)
  + congestion surcharge (2.4.4)
```

Weights per unit are in 2.6. Light, valuable goods (chips, pharma, luxury) usually fly; heavy, cheap goods (ores, grain, steel) always sail or ride rail.

### 2.9.5 Tariffs and barriers

| Barrier | Rule |
|---|---|
| **Tariff** | Importing country's E5 rate on the landed value: Free Trade 0%, Low 5%, Moderate 12%, High 25%, Autarky 50% plus quotas ([4-politics.md](4-politics.md) 4.5.2) |
| **Trade agreements** | Preferential Trade halves tariffs; Free Trade Agreement 0%; Customs Union common external tariff (4.11.2) |
| **Trade wars** | Extra tariffs and export bans by escalation level (4.11.5) |
| **Anti-dumping duty** | A Decision on one good from one country: +10% to +50% for 5 years |
| **Export bans and controls** | At start: Indonesia bans raw nickel-cobalt ore exports; China requires licences for rare earth oxides (4-week delay, 20% denial to countries with relation below 0); the United States, Netherlands and Japan ban exports of lithography systems and AI server nodes to China and require licences for advanced chips |
| **Sanctions** | Tiers 1 to 4 ([4-politics.md](4-politics.md) 4.11.4) |
| **Data rules** | T2 Data Sovereignty blocks user data and cloud compute across the border |
| **Smuggling** | Through a shell in a haven: +25% transport cost and +25 exposure per month with the sanctioning country's Financial Police |

### 2.9.6 Link to the commodity exchanges

Exchange goods (marked "Exchange" in 2.6) have a global quote E that moves hourly on the commodity exchanges ([07-markets.md](../07-markets.md)).

- **Weekly fundamental**: `F = base price × (global demand / global supply) ^ ε`, summed over all hubs and minor groups.
- The exchange's hourly price drifts toward F, plus speculation, hedging and cornering effects (07).
- **Basis** for a hub: net exporting hubs sit below E by the transport cost to their main market; net importing hubs sit above E by their import transport cost. Basis is recomputed weekly.
- Futures let companies lock prices; they are financial and do not reserve physical supply (contracts do, 2.10).

### 2.9.7 Electricity pricing per grid

Each hub has its own grid. Neighboring hubs in the same country or currency zone link through interconnectors with fixed capacity.

**Monthly merit order**:

1. Rank all plants by marginal cost: fuel per MWh + variable O&M $3 + carbon cost under E8 Carbon Pricing ($25 per t CO2: gas 0.4 t per MWh adds $10, coal 0.9 t adds $22.5).
2. Renewables (marginal cost about $0) and nuclear (about $12) run first, then the cheapest fuel plants until demand is met.
3. **Wholesale price** = marginal cost of the last plant needed + **scarcity adder**. The adder is $0 when the reserve margin (spare capacity / demand) is 15% or more and rises linearly to $300 per MWh at 0%.
4. **Retail price** = wholesale + grid fee $30 × PF.

Reference: a gas-marginal grid with gas at $4: `7 × $4 + $3 = $31`, typical scarcity $15, grid fee $30, total about $76 to $80.

**Shortfall (reserve margin below 0)**: rationing order is (1) the Kingmaker's facilities if a ceiling is in force, (2) hospitals and water works, (3) contracted industrial supply, (4) other industry pro rata, (5) residential through rolling blackouts. Every 10% of residential demand unserved cuts the Basic fill for electricity accordingly and adds +3 target unrest.

### 2.9.8 Price controls and Kingmaker price setting

- **Law price controls**: E7 Essentials Capped, Broad Controls and Planned Prices ([4-politics.md](4-politics.md) 4.5.2) cap hub prices by law.
- **Kingmaker price setting** (2.5.10): the holder sets a **ceiling or a floor** on up to 2 goods in the hub, within ±20% of the current target price P*. Setting or changing costs 10 PC; keeping it costs 5 PC per good per month. It lapses if Kingmaker is lost.

| Control | What happens |
|---|---|
| **Ceiling below P*** | Sellers in the hub must sell at the ceiling. Importers stop when IPP is above the ceiling; local producers export when EPP is above it. The shortfall is rationed: the Kingmaker's own facilities first, then contracts, then pro rata. A consumer good in shortage cuts needs satisfaction; a black market appears (2.9.9) |
| **Floor above P*** | Buyers in the hub pay at least the floor; imports cannot undercut it (it works like a tariff). Unsold surplus piles into stock. Raises basket costs and angers Industrialists who buy the good (their approval of the dynasty -1) |
| **Unrest** | A control that raises a segment's basket cost by more than 5% adds +2 target unrest to that segment; a ceiling on an essential gives -2 unless it causes shortages |

- **Price leadership**: a holder that owns more than 30% of a hub's supply of a good can set its own selling price above market as a price leader; this counts as cornering for antitrust exposure ([4-politics.md](4-politics.md) 4.9.3).

### 2.9.9 Black markets

- Banned goods (cyberware under T1 Banned or Medical Only, data under strict T2, sanctioned goods) and goods short under price controls trade on a **black market** in hubs with Slum districts or Shadow Economy clout of 10% or more.
- Black-market price: legal reference ×1.5 to ×3.0 for controlled goods in shortage; ×2.0 for banned goods.
- Supply comes from front companies, black clinics, smuggling through havens and netrun schemes (black-market data).
- Each $1M of black-market sales per month by a holder adds +1 exposure with the Financial Police.

---

## 2.10 Supply contracts and the spot market

### 2.10.1 Spot

- Bought at the weekly hub price plus a 1% broker fee, settled weekly.
- Volume is limited to supply left after contract deliveries.
- In a shortage, spot buyers are served in order of **bid premium**: a buyer may bid up to +100% over the hub price.

### 2.10.2 Contract types

| Type | Price rule | Typical length | Special terms |
|---|---|---|---|
| **Fixed price** | Locked at signing | 3 to 24 months | Protects the buyer from spikes and the seller from slumps |
| **Indexed** | Exchange quote (or hub price) ± fixed spread of 0% to 3% | 6 to 36 months | Guarantees volume, not price |
| **Take-or-pay** | Fixed or indexed | 12 to 60 months | Buyer pays for at least 80% of the volume even if not taken; seller gives -4% |
| **Capacity reservation** | Fixed or indexed, plus a reservation fee of 10% of yearly contract value paid up front | 12 to 36 months | Top allocation priority (used for fab capacity, packaging, LNG) |
| **Offtake** | Index -8% | 5 to 15 years | Buyer prepays up to 30% of the facility's build cost; gets 50% to 100% of its output; finances mines and LNG trains |
| **Tolling** | Processing fee: 25% of output value at base | 6 to 36 months | Buyer supplies the inputs and receives the outputs |

**Contract terms**: good, volume per month, price rule, length, delivery hub and route, take-or-pay share, shortfall penalty, force majeure clause (default on), strike clause (default on).

**Fair price that AI counterparties accept** for fixed price:

```
Reference = 0.5 × P* + 0.5 × 12-month average hub price
Premium   = +1% per 6 months of length if the market is tight (R > 1.05)
            -1% per 6 months of length if the market is slack (R < 0.95)
            capped at ±6%
Price     = Reference × (1 + premium) × (1 - 3% if the buyer has Presence in the seller's hub)
```

Opinion between the two companies' heads moves the accepted price by up to ±5%.

### 2.10.3 Allocation priority in a shortage

When a seller cannot deliver everything, it allocates in this order:

1. Internal transfers inside a vertically integrated group (vassal to liege or between sister vassals), unless the supplying vassal is Defiant (loyalty -50 or less), in which case it may divert to the best bidder.
2. Government emergency orders (under S3 Emergency Powers, E7 Planned Prices, or strategic reserve calls).
3. Capacity reservations.
4. Fixed-price and take-or-pay contracts, oldest first.
5. Indexed contracts, oldest first.
6. The hub Kingmaker's priority, if set for that good.
7. Spot, by bid premium.

### 2.10.4 Breach, force majeure and renegotiation

- **Shortfall penalty**: the seller pays 15% of the undelivered value, unless force majeure applies.
- **Force majeure** is declared automatically when the delivery route is Closed, sanctions forbid the trade, the seller's hub is in a war zone, a natural disaster hits the facility, or a strike lasts more than 14 days (strike clause). It suspends deliveries and penalties. After 90 days either side may terminate without penalty.
- **Strategic default**: an AI seller may underdeliver on purpose when `spot price - penalty > contract price`. Monthly chance = `(spot - contract - penalty) / contract × 100%`, × CEO trait factor (Greedy 1.5, Ruthless 1.3, Honest 0.3), capped at 50%. A deliberate breach gives the buyer the **Breach of contract** casus belli ([01-companies.md](../01-companies.md) 1.8) and -30 opinion between the heads.
- **Renegotiation**: a seller on a fixed contract that loses money two months in a row may ask to renegotiate (event). Refusing doubles its strategic default chance.
- **Credit**: buyers rated below BB must prepay or post a letter of credit (1% of value per quarter).

### 2.10.5 Inventory

- Each facility keeps stock of its inputs and outputs. Default target: 4 weeks of inputs (settable from 0 to 26 weeks).
- Storage cost per month: 0.5% of stock value (1.5% for perishables such as food and grain; 0% for gold).
- Stock beyond 4 weeks of the facility's own needs requires warehouse capacity in the hub.
- The UI shows **days of cover** for every input: how long production can continue if deliveries stop. This is the player's main early warning in a disruption.

---

## 2.11 Disruptions

Disruptions are events ([10-events.md](../10-events.md)) that change route status, facility output, labor or demand. Their effects propagate weekly: downstream facilities feel a shortage only when their stock runs out, so cascades arrive with a visible delay.

| Disruption | Trigger and base chance (T) | Typical duration | Effects | Warning and mitigation |
|---|---|---|---|---|
| **Chokepoint blockade** | Politics, wars and events; 2% per year at Tension, ×5 at Conflict | 2 to 12 weeks (rarely 6 months) | Lane closed; reroute or stop; war risk insurance on nearby lanes; prices of exposed goods spike | Risk level usually steps up first; alternative suppliers, stockpiles, bypass pipelines, air freight |
| **Shipping attacks and piracy** | Risk level Attacks | 4 to 26 weeks | Insurance +0.5% to +2% of value; lane capacity -30% to -80% as carriers avoid it | Reroute (Cape of Good Hope), escorts (PMC contracts) |
| **Canal drought** (Panama) | Dry season; severe drought 15% per year | 4 to 16 weeks | Capacity -30% to -50%; draft limits; slot auctions (toll ×1 to ×4) | Land bridge rail, Suez routing, contracts with priority carriers |
| **Canal blockage** (grounded ship) | 1% per year per canal | 3 to 10 days closed, then 2 to 3 weeks of queue | Lane closed then congested | Stock cover |
| **Typhoon or hurricane** | Seasonal: East Asia July to October, Gulf of Mexico June to November | 2 to 7 days | Port closed; condition -5 to -30 in hit districts | Insurance, spare stock |
| **Earthquake** | Hub data: 1% per year major quake in Hsinchu-Taipei, Tokyo-Yokohama, Istanbul, Los Angeles-Long Beach, Bay Area | 1 to 8 weeks | Fabs output 0; 30% of wafer stock scrapped; condition -20 to -60; land value -10% | Geographic diversification |
| **River low water** | Rhine 20% per year in summer; Yangtze 10% | 2 to 8 weeks | Barge capacity -50% to -80% | Rail substitution at higher cost |
| **Heatwave and water stress** | 10% per year in hot hubs | 2 to 8 weeks | Water price ×2 to ×3; fabs, data centers and nuclear plants output -10% to -30% | Desalination, liquid cooling |
| **Port strike** | Strike rules (2.8.6) | 1 to 6 weeks | Port throughput -80% (-40% automated) | Automated terminals, alternative ports |
| **Cyberattack (ransomware)** | Per facility per month: `0.2% × (1 + 0.5 × automation level) × (1 - security factor)`, plus netrun schemes | 3 to 21 days | Output -50% to -100%; possible data leak (exposure, reputation); ransom option | Security HQ, counter-netrunning tech |
| **Grid failure** | Reserve margin below 5%, storms or cyberattack | 1 to 5 days | Power fill 0; fabs lose one week of output (work in progress) | Backup generation, reserve margin |
| **Factory fire or explosion** | Condition below 40, accidents | 2 to 12 weeks | One facility out; reputation hit if deaths | Upkeep |
| **Pandemic** | 0.5% per year, global | 3 to 18 months | Labor availability -10% to -30%; demand shifts (healthcare and electronics up, retail and travel down); port congestion +30% | Automation, stockpiles |
| **Export ban or control** | Politics decision | 3 months to years | Good blocked from that country | Alternative sources, licences, smuggling |
| **Sanctions** | Politics tiers | Indefinite | Routes and finance cut ([4-politics.md](4-politics.md) 4.11.4) | Branch office choices |
| **Producer cartel cut** | Oil producers' decision event, 10% per year | 3 to 12 months | Crude supply -3% to -8% | Strategic reserves |
| **Contamination or recall** | Food, pharma, vehicles: 1% per year per company | 2 to 8 weeks | That company's sales of the good -50% to -100%; reputation -10 | Quality spending (upkeep 150%) |
| **Undersea cable cut** | 3% per year per cable corridor; sabotage | 1 to 6 weeks | Data lane capacity -50% to -100%; finance latency penalty | Redundant routes |
| **Mine collapse or spill** | Condition below 40; 1% per year per mine | 2 to 16 weeks | Mine out; Environmentalist anger; reputation -10 | Upkeep |
| **War** | [4-politics.md](4-politics.md) 4.11.6 | Months to years | Output loss, destruction, route closures | Insurance, exit |
| **Coup or revolution** | [4-politics.md](4-politics.md) 4.8 | Weeks to months | Seizure risk, capital controls, contract voids | Political influence, exit |

---

## 2.12 Technology tree

### 2.12.1 Research rules

- Tech is held **per company per sector group**, in tiers 1 to 4. Every company starts with Tier 1 in its own sector. A vassal can use its liege's tech only under Wholly Integrated or Managed autonomy.
- **Research points (RP)** come from Research labs (2.7.8) and from **contract research** (universities and labs): $50,000 × PF per RP, at most 30 RP per month per company.
- The research lead (CEO or an assigned board member) multiplies RP by `1 + (Tech skill - 10) / 40`.
- **Cost per tier**: Tier 2 = 300 RP, Tier 3 = 1,200 RP, Tier 4 = 4,000 RP. Each tier also needs the previous tier, and some need a tier in another group (listed).
- Each tier gained gives +3% efficiency to all methods of that group the company runs.
- **Diffusion**: once 3 or more companies in the world hold a tier, it costs others 30% less; after 10 years, 60% less. **Proprietary** techs never diffuse on their own.
- **Licensing**: an owner can license a tier to another company for a royalty of 2% to 8% of the licensee's revenue in that group, or a lump sum.
- **Espionage** (Corporate espionage scheme, [03-characters.md](../03-characters.md)): each success steals 40% of the RP needed for a tier the target holds (a full tier at Tier 1 or 2).
- **Forced transfer**: under C2 Local Partner 51% and Tech Transfer, a branch office shares one tier per year with its local partner ([4-politics.md](4-politics.md) 4.5.3).
- Starting world: most companies hold Tier 1 to 2; leaders hold Tier 3; Tier 4 exists only as the two proprietary starting techs (lithography in Eindhoven, precision optics in Frankfurt at Tier 3).

### 2.12.2 Sector groups

The 20 launch sectors ([1-corporate-core.md](1-corporate-core.md) 1.13) map to 13 tech groups.

| Group | Launch sectors | Tier 1 (start) | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|---|
| **Energy** | Energy | Conventional wells and gas fields, simple refinery, combined-cycle and coal plants, fixed solar, onshore wind, groundwater, regasification | Enhanced recovery, associated gas, cracking refinery, supercritical coal, large nuclear and fuel enrichment, tracking solar with storage, offshore wind, desalination, liquefaction, steam reforming, solar panel and turbine lines | Renewable fuels, carbon capture plants, small modular reactors, electrolysis | **Fusion pilot plant** (megaproject: 1,000 MW, no fuel, 60,000 CU, needs Materials 3); grid AI (+10% renewable output) |
| **Materials** | Mining, construction | Open pit mines, naphtha cracker, basic chemicals, cement, blast furnace, aluminium and copper smelting, spinning, conventional construction | Ethane cracker, gas DRI steel, nickel-cobalt leaching, rare earth separation, robots line, prefab construction, automated knitting | Autonomous mines, bio-polymers, green hydrogen steel, robotic construction | **Urban mining** (recycling plant recovers copper, gold and rare earths from e-waste); programmable materials (vehicle parts kits ×0.8 inputs) |
| **Semiconductors** | Chips | Mature node fabs, polysilicon, standard packaging | Memory fabs, wafers, fab chemicals, automated packaging | Advanced node fabs, advanced packaging, precision optics (needs Materials 2) | Angstrom node (output ×1.4), lithography systems, photonic chips (AI server nodes ×1.3 compute) |
| **Electronics** | Consumer electronics, telecoms | LCD, manual assembly, sensors | OLED, automated assembly, telecom equipment, 5G networks | Lights-out assembly, AI server nodes (needs Semiconductors 3 goods, not tech) | MicroLED and AR optics, satellite mesh (telecom coverage ×2 in Slums and Resource Fields) |
| **Mobility** | Automotive | Combustion vehicles, motors, engines, LFP cells, packs, parts kits, lithium refining | EVs, NMC cells, cathode materials, automated vehicle line | Gigapress plants, autonomous driving (EVs +10% price; logistics truck rates -20%) | Solid-state cells (needs Materials 3), robotaxi services (displaces Gig drivers: Gig jobs -5% in the hub) |
| **Biotech** | Pharma | API synthesis, formulation, general hospitals | AI diagnostics, patented molecules (APIs at ×4 price) | Biologics, gene therapies (life extension treatments, [03-characters.md](../03-characters.md) 3.7) | Life extension II (+10 years expected lifespan), organ printing |
| **Cyberware** | Cyberware | Black clinics | Component line, implant clinics, cyber-surgical centers; basic implants (+1 skill) | Neural co-processors (+3 skill, humanity cost; needs Biotech 2 and Semiconductors 3), ocular implants (needs Electronics 4) | Full neural interface (+5 skill), digital consciousness research (late game) |
| **Digital** | Software, AI, finance (operations) | Air-cooled data centers, e-commerce | Liquid cooling, sovereign cloud, AI-augmented offices, cashierless retail, AI tutoring | Frontier training, AI-assisted research | AI-native offices, autonomous corporate agents (one board task run without a character), better AI advisors |
| **Agriculture** | Agriculture | Traditional farms, fertilizer, food processing | Industrial farms, automated food plants | Precision agritech, cultured protein | Vertical megafarms (farms on Industrial or Tech Park plots), drought-proof crops (no drought output loss) |
| **Logistics** | Logistics | Manual depots, conventional ports | Automated depots and ports, free-trade zone terminals | Autonomous fleets, drone delivery (last-mile truck cost -40%) | Autonomous shipping (container rate -20%, crews cannot strike) |
| **Security** | Security, defense | Corporate security, munitions | Smart surveillance, drones | PMC units, systems integration, counter-netrunning (cyberattack chance -50%) | Security robots (security output ×2, labor -80%), offensive netrunning suites (+20% netrun scheme success) |
| **Media** | Media, entertainment | Broadcast and publishing | Social platforms | Synthetic media | Personalized reality feeds (ad campaign max +8 pp; psyop discovery -30%) |
| **Retail and Brands** | Retail, real estate | Traditional retail | Luxury ateliers, brand marketing (SG&A -10%) | Cashierless retail at scale, smart buildings (rent +10%) | Predictive retail (stock targets -50%), arcology towers (residential tower ×3 dwellings per plot) |

---

## 2.13 Company financial statements

Every company keeps a monthly ledger built from the economy. Statements are published quarterly ([09-time-and-turns.md](../09-time-and-turns.md)) and drive earnings reactions on the exchanges ([07-markets.md](../07-markets.md)).

### 2.13.1 Consolidation

| Stake held | Treatment |
|---|---|
| Control (more than 50% of votes) | **Consolidated**: all revenue, costs, assets and debts added in; the outside owners' part shown as minority interest |
| 20% to 50% | **Equity method**: share of the investee's net income as one line |
| Under 20% | **Investment** at market value; dividends as income |

### 2.13.2 Income statement

| Line | Source |
|---|---|
| Revenue: product sales | Output sold at hub prices or contract prices |
| Revenue: services and rents | Services output, real estate rent |
| Revenue: government contracts | Contracts won ([4-politics.md](4-politics.md) 4.9.7) |
| Revenue: royalties, licences, franchise and management fees | Tech licences, franchise royalties, vassal management fees ([1-corporate-core.md](1-corporate-core.md) 1.7.1) |
| Cost of goods sold: inputs | Inputs consumed at purchase cost (weighted average stock cost) |
| Cost of goods sold: direct labor | Facility wages and overhead |
| Cost of goods sold: energy | Electricity and water |
| Cost of goods sold: freight, insurance and tariffs | Transport cost (2.9.4) and tariffs paid |
| Cost of goods sold: royalties to governments | Resource royalties (2.7.1) |
| **Gross profit** | |
| Selling, general and administrative | Sector share of revenue (2.7.9), executive salaries, head office rent |
| Marketing and influence campaigns | Ad campaigns, sponsorships, galas (psyops are hidden in "consulting" and add exposure) |
| Research and development | Research labs and contract research |
| Facility upkeep and repairs | Upkeep (2.7.2) and condition repairs |
| Storage | Inventory storage costs (2.10.5) |
| Strike and disruption losses | Idle fixed costs during strikes, ransoms, penalties paid on contracts |
| **EBITDA** | |
| Depreciation and amortization | Straight line: buildings and plants 25 years, fabs and display fabs 10 years, data center servers 4 years, robots 8 years, tech licences 5 years |
| Impairments | Write-downs: seized assets, stranded facilities, sanctions ring-fencing (50%) |
| **Operating profit (EBIT)** | |
| Interest expense and income | Loans, bonds, captive bank lending |
| FX gains and losses | Revaluation of foreign currency cash and debt |
| Share of associates | Equity-method income |
| Fines and settlements | Regulator outcomes ([4-politics.md](4-politics.md) 4.9.5) |
| **Profit before tax** | |
| Taxes | E2 national plus E9 regional corporate tax per jurisdiction where profit is booked; shells route profit to havens (exposure) |
| **Net income** | |
| Minority interest | Outside owners' share of consolidated vassals |
| **Net income to owners** | |
| Dividends declared | Payout policy, tribute up the vassal chain |

### 2.13.3 Balance sheet

| Assets | Liabilities and equity |
|---|---|
| Cash by currency | Payables |
| Receivables (30 days of sales by default) | Contract liabilities (take-or-pay owed, prepayments received) |
| Inventory by good | Short-term debt and credit lines |
| Prepaid contracts (capacity reservations, offtake prepayments) | Bank loans (with covenants) |
| Facilities, net of depreciation | Bonds |
| Real estate | Deferred tax |
| Construction in progress | Provisions (lawsuits, fines, severance, environmental) |
| Investments in associates and other stakes | Union and pension obligations |
| Intangibles: tech tiers, licences, brands | **Equity**: share capital by class (A, B, N, P), retained earnings, minority interest |
| Goodwill from acquisitions | |

### 2.13.4 Cash flow statement

| Section | Lines |
|---|---|
| Operating | Net income + depreciation and impairments ± change in inventory, receivables and payables |
| Investing | Construction and equipment purchases, server replacement, acquisitions, asset sales |
| Financing | New debt, repayments, share issues, buybacks, dividends paid |
| **Free cash flow** | Operating cash flow minus investing outflows for maintenance (upkeep is already in operating) |

### 2.13.5 Key indicators shown on the company screen

Revenue growth, gross margin, EBITDA margin, net margin, return on invested capital, debt / EBITDA (typical covenant: 3.5 or less), interest cover, free cash flow, inventory days of cover, **supply risk score** (share of input value passing through chokepoints at Tension or worse, plus share single-sourced), **labor risk** (share of workforce unionized and facility unrest), **exposure** (from shells and schemes), and **influence footprint** (top places by share).

---

## 2.14 Worked examples

All numbers use the tuning values above. Rounding is to the nearest useful digit.

### 2.14.1 Getting Presence in Penang

**Setup.** A US dynasty's flagship owns one Penang packaging plant level (standard method). The heir was born and raised in Penang (she holds Malaysian citizenship) and is on good terms with the head. The dynasty also bought a residential tower ($90M), an industrial park ($45M) and $80M of Penang city bonds. Malaysia: liberal democracy, C1 Screened, WI 0.25, PF 0.475, BI 0.70. Dynasty reputation +20, 3 years of presence.

**Assets.**

| Item | Value | Weight | Weighted |
|---|---|---|---|
| Packaging plant: 1,500 CU × $70,000 + 50 robots × $30,000 | $106.5M | 1.0 | $106.5M |
| Jobs: 30 P, 200 S, 400 U at WI 0.25 with overhead = $0.79M per month, $9.5M per year | $9.5M | 1.5 | $14.3M |
| Residential tower | $90M | 1.0 | $90M |
| Industrial park | $45M | 1.0 | $45M |
| City bonds | $80M | 0.5 | $40M |
| **Total** | | | **$295.8M** |

**Share.** Penang mass = $10B × 0.475 = $4.75B. Base share = 295.8 / 4,750 = **6.23%**.

Multiplier = origin 1.25 (born and raised) × foreignness 0.95 (Liberal democracy 10% penalty, halved by the citizen heir) × history 1.03 × reputation 1.04 = **1.272**. 6.23% × 1.272 = 7.92%, plus 1 pp flat for born and raised = **8.92%**. No tier yet.

**Campaign.** Temporary cap = max(6, 6.23) = 6.23 pp. An ad campaign of 4 pp costs 4 × $60,000 × 4.75 = **$1.14M per 4 weeks**; the heir directs it (Persuasion 15, effectiveness 1.0). She also hosts a gala: 1.4M adults × $0.02 = **$28,000** and 6 hours, +1 pp for 2 weeks, +5 opinion with every Penang official, and two Befriend rolls at 30%.

Final share = 8.92 + 4 + 1 = **13.9%: Presence** at the next weekly check. Political Capital in Penang: 100 × sqrt(0.139) = **37 PC per month**. The Penang plant now hires 10% cheaper, buys local inputs 3% cheaper and gets permits 15% faster.

**Keeping it.** The ad runs 8 weeks ($2.28M). After it ends, 3.1 pp (half the base share) is anchored and decays at 12.5% per week, the rest at 25%. The share falls below 10% about 10 weeks later. Under the 13-week rule the dynasty must add assets within a quarter: a second packaging level ($106.5M plus $14.3M of jobs weight) lifts the base share to 8.77% and the final share to 8.77 × 1.272 + 1 = **12.2%** without any campaign.

**Roll-up.** Penang state (region) mass = 1.5 × $4.75B = $7.1B. Region share = 295.8 / 7,125 = 4.15% × (1.12 × 0.95 × 1.03 × 1.04 = 1.14) = **4.7%**. Malaysia mass = 3% × $400B = $12B: country share = 2.47% × 1.079 = **2.7%**, worth 16 PC per month nationally.

### 2.14.2 A foreign branch office tries to buy a foothold in Shenzhen

**Setup.** The same dynasty's flagship sets up a branch office in Shenzhen-Dongguan (China: one-party state, C1 Capped All, C2 Local Partner 30%, T4 Mass Surveillance). The branch is 70% flagship, 30% a Shenzhen family (local partner loyalty 65). It runs 2 levels of electronics assembly (manual line, smartphones).

**Assets.** Construction: 3,000 CU × $72,000 = $216M per level, $432M for two. Jobs: per level 40 P, 300 S, 3,000 U = $11.2M per month at WI 1.0, × 0.30 × 1.25 = $4.2M; two levels = $8.4M per month = $100.8M per year, × 1.5 = $151.2M. Total weighted: **$583M**.

**Shares.** Shenzhen-Dongguan mass = $120B × 0.51 = $61.2B.

| Holder | Calculation | Share |
|---|---|---|
| Branch office (HQ in Shenzhen, not foreign) | 583 / 61,200 = 0.95% × home 1.10 | **1.05%** |
| Dynasty (foreign) | 583 × 0.9 (Managed autonomy) = 525 → 0.86% × foreignness | **0.56%** |

Dynasty foreignness: 1 - 0.50 (one-party) - 0.20 (Capped All is 2 steps past Screened) = 0.30; halved penalty for branch assets with a 30% partner gives 1 - 0.35 = 0.65.

**Psyops.** The player wants Presence fast and runs the maximum psyop the cap allows: max(6, 0.95) = 6 pp, at 6 × $25,000 × 61.2 = **$9.2M per 4 weeks**, directed by a fixer with Intrigue 15. Branch share = 1.05 + 6 = **7.05%**: still not Presence. Temporary boosts alone never reach a tier.

**Risk.** Daily discovery = (0.2% + 0.03% × 6) × 1.5 × (1 - 15/60) = **0.43% per day**: 11% over 4 weeks, 30% over 12 weeks. Political exposure +5 × 1.5 = +7.5 at campaign start. If discovered: the 6 pp vanish, backlash of -12 pp decaying 10% per week (the share is clamped at 0), reputation -10, exposure +15, and the regime advances the seizure ladder to Step 1: *Beijing Calls* demands the local partner's stake rise to 40%.

**Better play.** Let the local partner's family (14% hub share, Presence, Shenzhen-born) file permits and meet officials; keep partner loyalty at 60 or more (seizure risk -0.5 points). The monthly seizure risk is 0.3 (one-party) + 30/50 (relation -30 with the United States) - 0.5 = **0.4% per month** ([4-politics.md](4-politics.md) 4.9.10).

### 2.14.3 Steel price in Rotterdam: import parity and an anti-dumping duty

**Setup.** Steel is an exchange good at $650. Rotterdam: 5 blast furnace levels make 100,000 t per month; local demand is 120,000 t. Shanghai has a glut: local price $600. The EU (Netherlands) has E5 Low (5%) and a 25% anti-dumping duty on Chinese steel.

**Local price.** R = 120,000 / 100,000 = 1.2; ε = 1.0; P* = 650 × 1.2 = **$780**.

**Import parity from Shanghai** (bulk, 19,500 km via Malacca and Suez):

| Item | Per t |
|---|---|
| Freight 19.5 × $1.2 | $23.40 |
| Handling 2 × $3 | $6.00 |
| Suez toll | $3.00 |
| Insurance 0.3% of $600 (base 0.1%, Taiwan Strait and Bab-el-Mandeb at Tension +0.1% each) | $1.80 |
| Landed before duties | $634.20 |
| Tariff 5% | $31.71 |
| Anti-dumping 25% | $158.55 |
| **IPP** | **$824.46** |

$780 is below $824: no Chinese steel comes in. Export parity to New York (US price $700, freight $13.70, US tariff 12%) is $602, also out of range. **Rotterdam steel settles at $780.**

**The lobbying stakes.** If the anti-dumping duty is repealed, IPP falls to $665.91 and traders ship whenever Rotterdam is above $665.91 × 1.03 = $686. The price is pinned near **$686** and imports cover the shortfall.

A Rotterdam blast furnace level (WI 0.9, Carbon Pricing +12% on operating cost) costs about $470 per t (inputs $284, labor $80, upkeep $36, carbon $48, SG&A $23). Margin per level: $6.2M per month at $780, $4.3M at $686. For the 5 levels that is **$9.5M a month**: the reason Rotterdam steelmakers spend PC and lobby points to keep the duty.

### 2.14.4 Chip shortage cascade: the Taiwan Strait quarantine

**Setup.** World advanced chip output is 6M per month: Hsinchu-Taipei 3.6M (60%), the rest 2.4M (Seoul-Pyeongtaek, Phoenix, others). Event *Strait Closed*: the Taiwan Strait and Taiwan's sea exits go to Closed; air cargo from Taiwan is capped at 25% of normal chip exports with +2% war risk insurance. Duration 6 weeks.

**Hour 0 to day 1.** The event fires. Exchange traders react within hours (07). Air insurance reprices at the next daily step. Every company's "days of cover" turns red for advanced chips.

**Supply.** Available = 2.4M + 25% × 3.6M = 3.3M = 55% of normal. R = 1 / 0.55 = 1.82; ε = 2.5; R^2.5 = 4.46. Target price = 350 × 4.46 = **$1,560**. Weekly path (half the gap each week): **$955, $1,258, $1,409, $1,484, $1,522, $1,541**.

**Allocation.** Contracts with Hsinchu fabs fall under force majeure for the undeliverable volume. Hsinchu fabs allocate their air quota by priority: capacity reservations first, then fixed contracts by age. Fabs elsewhere serve their own contracts first, then spot by bid.

| | Firm A (Shenzhen phone maker) | Firm B (player's vassal, Shenzhen phone maker) |
|---|---|---|
| Chip supply | Capacity reservation with a Seoul fab at $360: 100% delivered | Fixed contract with a Hsinchu fab: force majeure; gets 25% (20,000 of 80,000 chips) by air at $357 ($350 + $0.10 air + $7 insurance) |
| Spot option | Not needed | Spot at $1,258 makes the phone bill of materials $595, above the phone price: not worth it |
| Output | 200,000 phones | 50,000 phones (-75%) |

**Phones.** World phone supply falls about 30%. R = 1.43, ε = 0.8: price ×1.33, **$320 → $426**.

| Monthly | Firm A | Firm B normal | Firm B in crisis |
|---|---|---|---|
| Revenue | $85.2M | $64.0M | $21.3M |
| Gross margin per phone | $190 (normally $84) | $88 | $191 |
| EBITDA (after labor $4.2M, SG&A 10%, upkeep $0.65M) | about $28M | $6.4M | $2.6M (paying full wages for 25% output) |

**Ripples.**

- **EVs** carry 2 advanced chips: makers buying spot pay +$2,380 per car, wiping out half their gross margin.
- **AI server nodes** need 40 advanced chips: at spot the node costs about $69,000 against a $40,000 price, so node output stops except under contracts. Data centers cannot replace servers (2% per month), compute capacity drifts down, and cloud compute prices rise about 5% by week 6.
- **Earnings**: Firm B's quarter misses badly; its listed parent falls 15% to 25% on the earnings day ([07-markets.md](../07-markets.md)). The family trust holds 30% of that parent; its margin loan moves toward a margin call ([1-corporate-core.md](1-corporate-core.md) 1.10.3).
- **Politics**: chip-importing countries open emergency subsidy debates (E6), raising the value of fabs in Phoenix and Seoul.

**After reopening.** Buyers rebuild stocks (up to 25% of their shortfall per week), so demand stays high and prices stay about 30% above base for 3 to 4 more weeks. The lesson the player should draw: a capacity reservation for B would have cost 10% × (80,000 × $350 × 12) = **$33.6M a year**, against a crisis cost of roughly $6M of EBITDA plus a share price drop that endangered family control.

### 2.14.5 Hormuz closure: energy cascade

**Setup.** Hormuz goes Closed for 4 weeks. It carries 20% of world crude and 20% of LNG. Bypass pipelines (Saudi East-West, UAE Fujairah) carry 33% of normal Hormuz crude. Governments release strategic reserves equal to 4% of world supply.

**Crude.** Net shortfall = 20% × 67% - 4% = 9.4%. R = 1 / 0.906 = 1.104; ε = 3; R^3 = 1.345. Target **$101** (from $75). Weekly path: $88, $94, $98, $99.

**LNG.** No bypass: R = 1.25; ε = 3; ×1.95. FOB target **$17.6** (from $9); delivered in Tokyo about **$19.5**.

**Tokyo electricity** (gas on the margin): marginal cost = 7 × $19.5 + $3 = $139.5; reserve margin falls as oil-fired units lack fuel, scarcity adder about $40; wholesale **$180** (from about $95); retail adds the $25 grid fee. Households' Basic basket rises about 4%, adding +1 to +2 target unrest; inflation ticks up.

**Industry.** A Tokyo aluminium smelter needs 15 MWh per t: $2,700 of power per t against an aluminium price near $2,600. It idles its levels (workers laid off with severance), pushing aluminium prices up elsewhere.

**Inside the Gulf.** Dhahran-Dammam crude can leave only through the East-West pipeline, which is full. With export lanes closed, the local formula rules: R falls to about 0.4, clamped at 0.3: local crude sells at **$30** while pipeline-connected barrels earn $100 minus pipeline cost. Producers throttle output (extraction can run at 0% to 100% for up to 3 months without layoffs). Doha's liquefaction stops when storage fills after one week. Dubai re-export throughput falls 70%; Dubai Financial District land value -5%.

**Markets.** Oil producers outside the Gulf (Houston, Norway, Brazil) rally; airlines and chemical makers fall; JPY and KRW weaken on import bills ([07-markets.md](../07-markets.md)).

### 2.14.6 Panama drought: rerouting LNG from Houston to Tokyo

**Normal route** via Panama: 16,500 km; 16,500 / 650 = 25.4 days + 4 days handling = 29.4 days (5 weekly steps). Cost: 16.5 × $8 = $132 per t + toll $0.20 × 52 = $10.40 = **$142.40 per t = $2.74 per MMBtu**.

**Drought** (12 weeks): canal capacity -40%; slots auctioned at ×3 toll; LNG carriers lose most auctions to container lines, so half of LNG voyages cannot get a slot.

| Route | Distance | Days | Weekly steps | Cost per MMBtu |
|---|---|---|---|---|
| Panama (slot won, ×3 toll) | 16,500 km | 29.4 | 5 | $3.14 |
| Suez and Malacca | 26,500 km | 45.8 (incl. 1 day Suez queue) | 7 | $4.23 (plus Bab-el-Mandeb war risk 0.1%) |
| Cape of Good Hope | 30,500 km | 50.9 | 8 | $4.69 |

**Effects.**

- Blended delivered cost for US LNG to Tokyo rises from $11.74 to about **$12.69 per MMBtu** (+$0.95).
- Rerouted voyages take 56% longer, so the same LNG fleet delivers about 22% less per month. LNG lanes pass 85% utilization and the congestion surcharge kicks in (+20% at 95%).
- Asian LNG prices rise about 8%. Houston's export parity falls, so Houston natural gas gets cheaper: US petrochemical and fertilizer plants gain margin.
- Holders of LNG carriers (logistics companies) earn the surcharge; a dynasty with a Houston liquefaction plant sees margins squeezed by the extra freight it must absorb on fixed-price delivered contracts.

### 2.14.7 Automation triggers a strike in Mexico City

**Setup.** A vehicle plant with 3 levels on the traditional line makes 12,000 EVs a month. Workforce: 180 P, 3,600 S, 4,500 U. Mexico WI 0.22, L2 Recognized, L3 None. Hub organization: Skilled 55, Unskilled 45; Labor Unions clout 22% in Mexico. The owner retools 2 levels to the automated line.

**Why automate.** Labor per level falls from $11.4M to $6.77M at WI 1.0, i.e. **$3.14M → $1.86M** per month in Mexico; output rises from 4,000 to 4,500 EVs (+500 × $5,250 gross margin = $2.6M). Gain: about **$3.9M per level per month**. Retool cost: 25% × 3,500 CU × $68,800 = **$60M per level**, 26 weeks of downtime. Payback about 15 months after restart.

**The trigger.** Layoffs: 600 Skilled and 2,200 Unskilled = 34% of the workforce, above 10%: immediate strike votes. Skilled: 0.25 + 0.5 × 0.55 = **52.5%**; Unskilled: 0.25 + 0.5 × 0.45 = **47.5%**. Both vote to strike. The third level (still running) drops to ×0.1.

**Resolve.** Skilled R starts at 20 + 27.5 = 47.5; Unskilled at 42.5. Daily: -2 base, +0.5 public support (Labor Unions clout ≥ 20%) = -1.5 per day. Without action: about **32 days**.

**Cost of waiting.** The running level loses 90% of 4,000 EVs × $26,000 / 30 = $3.1M of revenue a day; inputs not bought save about 80%, so the contribution lost is about $0.6M a day plus idle fixed costs: about **$20M over 32 days**.

**Options.**

| Option | Outcome |
|---|---|
| Negotiate (COO with Operations 16, reputation 10) | Success 40% + 18% = **58%**: automation goes ahead on one level now and one in 12 months; severance doubled (2,800 workers × 4 months × about $700 = about $8M) |
| Lockout | R falls 2.5 per day: about 19 days; reputation -5; segment unrest +5 |
| Security crackdown with the group's PMC | R -30 at once: strike ends in about 12 days; reputation -15; Unskilled unrest +10; riot 25%; investigation 20% (liberal democracy) |
| Concede | Cancel the retool (unspent retool cost saved); union O +5 |

**Hub effect.** 2,200 Unskilled layoffs in a segment of about 4.2M is 0.05%: only +0.16 target unrest at hub level. Automation hurts at the facility, not the city, until many companies do it at once.

### 2.14.8 Building a data center in Singapore

**Setup.** One level, liquid-cooled method (Digital 2). Singapore: WI 0.85, BI 0.94, PF 0.895, E2 Low, F2 Open, no data sovereignty.

**Build.** 3,500 CU × $94,000 = $329M; 20,000 AI server nodes × $40,000 = $800M (shipped by air from Shenzhen-Dongguan; no export control to Singapore); permit fee 1% = $11.3M. **Total $1.14B, 52 weeks** after a 6-week permit.

**Monthly operations.**

| Line | Value |
|---|---|
| Revenue: 14,600 compute units × $2,500 | $36.5M |
| Electricity: 17,000 MWh × $117 (gas-marginal grid with LNG at $11: 7 × 11 + 3 + $10 scarcity + $27 grid fee) | -$2.0M |
| Water, telecom | -$0.06M |
| Server replacement (400 nodes) | -$16.0M |
| Labor (30 P, 50 S, 5 U at WI 0.85) | -$0.56M |
| Upkeep 0.4% of $340M | -$1.36M |
| SG&A 8% | -$2.92M |
| **Cash margin** | **$13.6M** |
| Building depreciation ($340M over 25 years) | -$1.1M |
| Tax at 12% | -$1.5M |
| **Net** | **about $11M per month** |

About $132M a year on $1.14B: **11.6%**, payback about 8.6 years. In Phoenix, power is cheaper ($64 per MWh: -$0.9M a month) but labor and build cost are higher and the corporate tax is Moderate; water stress (×3 water price, heatwave risk) is the main threat. In Singapore the threats are the LNG price (Hormuz, 2.14.5) and the Singapore cable landing chokepoint.

### 2.14.9 A battery supply contract under a lithium shock

**Setup.** A Shanghai EV maker needs 480,000 kWh of cells per month (8,000 packs). It signs a 24-month fixed-price contract with a Seoul NMC gigafactory. The market is slightly slack (R = 0.97): fair price = $95 × (1 - 4%) = **$91.20 per kWh**.

**Shock.** An Antofagasta mine strike and an Argentine lithium export tax cut world lithium ore supply 30%. R = 1.43, ε = 2: lithium ore **$1,000 → $2,040**. Lithium chemicals rise to about **$23,700**; cathode materials to about **$29,300**. Spot battery cells rise to about **$112**.

**Buyer.** Saves (112 - 91.20) × 480,000 = **$10M a month** against spot.

**Seller.** NMC cell cost per kWh rises to: inputs $60.40 (cathode $43.95, aluminium $0.80, copper $4.50, chemicals $1.13, electricity $10), labor $13.60, upkeep $6.50, SG&A $4.60 = **$85.10**. Still below $91.20, so no loss and no renegotiation request.

**Temptation.** Strategic default check: spot $112 - penalty (15% × $91.20 = $13.68) = $98.32, which beats $91.20 by 7.8%. The seller's CEO is Greedy (×1.5): **11.7% chance per month** of diverting part of the volume to spot. If it happens, the EV maker collects the 15% penalty, its head's opinion of the seller's head drops 30, and it gains the **Breach of contract** casus belli: the start of a takeover story ([01-companies.md](../01-companies.md) 1.8).

### 2.14.10 A Kingmaker's price ceiling backfires

**Setup.** Years later the dynasty is Kingmaker in Penang (52%). Its fabs and data centers use 400,000 of the hub's 1,200,000 MWh per month. LNG has spiked to $19.5 (2.14.5).

**Penang merit order.**

| Plant | Capacity (MWh per month) | Marginal cost | Cumulative |
|---|---|---|---|
| Solar | 87,000 | $0 | 87,000 |
| Coal (2 levels) | 510,000 | $63 | 597,000 |
| Interconnector from the mainland | 100,000 | $120 | 697,000 |
| Gas combined cycle (2 levels) | 510,000 | $139.5 | 1,207,000 |
| Gas peakers (2 levels) | 220,000 | $198 | 1,427,000 |

Demand 1,200,000 is met by the combined-cycle plants: **wholesale $139.5**; reserve margin 19%, no scarcity adder. The dynasty pays 400,000 × $139.5 = $55.8M a month.

**The ceiling.** The dynasty sets an electricity ceiling at -20%: **$111.60**. Every plant with a marginal cost above the ceiling stops: gas plants and peakers. Supply falls to **697,000 MWh**: a 42% shortfall.

| Rationing step | Need | Served |
|---|---|---|
| 1. Kingmaker's facilities | 400,000 | 400,000 |
| 2. Hospitals and water works | 40,000 | 40,000 |
| 3. Contracted industry | 300,000 | 257,000 (86%) |
| 4. Other industry | 160,000 | 0 |
| 5. Residential | 300,000 | 0 (rolling blackouts) |

**Result.** The dynasty saves 400,000 × $27.90 = **$11.2M a month**. But residential demand is 100% unserved: +30 target unrest for every segment. Unrest climbs 25% of the gap each month (about +7 to +8 per month), reaching Agitated in two months, with strikes, riots and a local election swing against the dynasty's candidates. Other industry stops entirely, angering Industrialists.

**What a smart player does instead.** Any ceiling below the marginal plant's cost knocks that plant out. The better tool is a **fixed-price power purchase contract** with the coal plants (marginal cost $63) at, say, $90: it saves 400,000 × $49.50 = **$19.8M a month** with no blackouts, and the contract gets priority in any shortfall.

---

## 2.15 Competition and market share

The hub price (2.9.2) sets what a good is worth in a hub. This section decides **who gets the sales** when several companies sell the same good there.

### 2.15.1 Commodity goods and differentiated goods

| Type | Goods | How sales split |
|---|---|---|
| **Commodity** | Raw goods, most intermediates, energy, bulk services (construction units, freight) | All sellers get the hub price; each sells what it offers, pro rata if supply exceeds demand. Competition is on cost and reach. |
| **Differentiated** | Finished goods, advanced components, most services, data goods, housing | Each seller has a **product offer** (quality, brand, price). Buyers split by **appeal**; sellers can price above or below the hub price. |

### 2.15.2 Product offer

Each company selling a differentiated good in a hub has:

- **Quality** (0 to 100): from the production method tier (Tier 1 = 40, +15 per tier), condition of the producing facilities (above 80: +5; below 50: -10), and quality spending (upkeep at 150%: +10).
- **Brand** (0 to 100): built by marketing, reputation and time (2.15.4). Brand is held per company per good group, and is shared by its vassals only under Wholly Integrated or Managed autonomy, or under a Franchise.
- **Price position**: the company sets a price from 70% to 200% of the hub price. Default 100%.

### 2.15.3 Appeal and share

```
Appeal = (Quality / 50) ^ q × (Brand / 50) ^ b × (Price position) ^ (-e) × Reach
Share  = Appeal / sum of Appeal of all sellers in the hub
```

| Good group | q (quality weight) | b (brand weight) | e (price sensitivity) |
|---|---|---|---|
| Food, clothing, basic consumer goods | 0.5 | 0.6 | 2.5 |
| Consumer electronics, vehicles | 1.0 | 1.0 | 1.5 |
| Luxury goods | 0.8 | 2.0 | 0.3 |
| Pharmaceuticals (patented) | 1.5 | 0.5 | 0.5 |
| Cyberware | 1.5 | 1.0 | 1.0 |
| Business services, cloud, software | 1.2 | 0.8 | 1.2 |
| Housing | 0.8 (district quality) | 0.3 | 2.0 |

- **Reach** (0.2 to 1.0): 1.0 in the company's home hub and hubs where it has a sales office, retail facility or distributor contract; 0.5 by import only; 0.2 by grey market.
- **Stickiness**: shares move toward the new target by 25% per month, not at once. Business-to-business goods (components, services) move 10% per month: customers do not switch suppliers overnight.
- A seller's revenue = its share × hub demand × its own price. A seller that cannot supply its share loses the rest to others in proportion.

### 2.15.4 Brand

- **Marketing spend** buys brand: each $1 of marketing per $100 of hub sales of the good adds +0.5 brand per month, with diminishing returns above brand 70 (halved).
- **Decay**: brand falls 1 point per month toward 30 without spending.
- **Reputation link**: company reputation above 60 gives +1 brand per month; scandals cut brand by the reputation loss / 2 in every hub at once.
- **Global brands**: brand in a company's home hub spreads to every hub it reaches at 50% strength, so famous brands enter new markets with an advantage.
- **Ad campaigns** for influence (2.5.7) also add +3 brand in that hub for the campaign's length.

### 2.15.5 Price wars and predatory pricing

- A company pricing below its unit cost for 3 or more months in a hub where it holds over 30% share is flagged as **predatory pricing** and adds Antitrust exposure ([4-politics.md](4-politics.md) 4.9).
- AI rivals answer a price cut larger than 10% with their own cut 50% of the time (aggressive archetypes 80%, see 2.23).

### 2.15.6 Market power

- A company's **national share** in a sector (used by C3 Antitrust) is its revenue share of that sector's sales in the country.
- Above 50% share of a good in a hub, a seller gets **pricing power**: it can set its price position up to 150% with only half the share loss. This is the economic counterpart of the Kingmaker price-setting perk (2.9.8), and both draw Antitrust attention.

## 2.16 Real estate

Real estate is the most direct asset-as-title in the game: it holds value, pays rent and buys local influence (2.5.2).

### 2.16.1 Plots, buildings and who uses them

The economy works like Victoria 3, with one change: **companies do not have to own the buildings they produce in. They either own them or lease them.**

**Plots.** Every district has 10 plots (2.3.2). Each plot is owned by one holder: a character, trust, company, government or "dispersed" (many small owners, modeled as one AI holder that sells slowly). At game start, plot ownership in each hub is seeded: 30% to 60% dispersed, 10% to 30% government (more in one-party states), and the rest split among AI companies, AI dynasties and property funds.

**Plot assemblies.** A holder can buy a **series of adjacent plots** in the same district and merge them into one **site**. A site counts as one plot for building, with the plot count as its size.
- Large buildings need sites: a mega fab, a gigafactory, a port terminal or an arcology needs 2 to 4 plots (listed per building in 2.7).
- A merged site is worth +10% per extra plot over the sum of its plots (a buyer pays for the assembly).
- **Holdouts**: when a holder owns all but one plot of a planned site, the last owner asks 1.5× to 3× value. Options: pay, build around it (smaller site), or push rezoning and compulsory purchase through local politics.

**Three roles on every plot.** Each plot has a **land owner**, a **building owner** and an **operator**. They can be one holder or three.

| Role | Who it is | What they get |
|---|---|---|
| **Land owner** | Owns the plot | Land value, ground rent if leased (2.16.7), influence from land value |
| **Building owner** | Owns the facility or property on it | Building value, building rent if leased, influence from building value |
| **Operator** | The company producing in it, or the landlord running a rental property | Production revenue and costs, the jobs (and their influence weight 1.5), the workforce's opinion |

**Four uses for a plot.** The owner of a plot chooses what to do with it:

| Use | What happens | Earns | Typical owner |
|---|---|---|---|
| **Develop** | Build a facility (2.7) or a property (2.16.2) on it, to sell or hold | Building value; rent or production once built | Developers, trusts, companies |
| **Rent out** | Lease the empty land, or a building on it, to someone else (2.16.7) | Ground rent or building rent | Trusts, property funds, dynasties living off rents |
| **Keep** | Hold it empty as a land bank | Nothing but appreciation; carries property tax and influence | Speculators, dynasties waiting for rezoning or growth |
| **Use for a company** | A company the owner controls operates on it, by owning it outright or by leasing it from the owner | Production | Every producing company |

**Use for a company across the group.** When a family trust or a parent company owns the plot and a company it controls operates on it, the use is an **intra-group lease**: the company pays rent to the owner. This is a feudal lever. Rent above market moves cash out of the company to the owner without paying dividends to minority holders. Activist factions and minority blocs gain +1 strength per month for every 10% the rent is above market, and above 30% it adds related-party exposure with the securities regulator ([4-politics.md](4-politics.md) 4.9).

### 2.16.2 Property types

| Property | Allowed districts | Levels | Cost per level (L hub, PF 1.0) | Yield | Notes |
|---|---|---|---|---|---|
| Residential tower | R, F, S (tenement) | 1 to 10 | $40M | Rent from housing demand (2.6.6) | Tenements in Slums: +9% yield, +1 unrest each |
| Office tower | F, T, R | 1 to 10 | $60M | 5% of value per year at full occupancy | HQs must sit in an office the company owns or rents |
| Retail and mall | R, F, S | 1 to 5 | $35M | 6%, plus a cut of tenant sales in malls (2%) | Reach for consumer goods (2.15.3) |
| Logistics and warehouse | P, I | 1 to 8 | $20M | 7% | Stock storage for tenants |
| Hotel and resort | F, R, P | 1 to 5 | $50M | 4% to 12% (tourism cycle) | Gala venue: +25% gala influence |
| Data and lab space | T | 1 to 5 | $45M | 6% | Rented to tech tenants |
| Land bank (empty plot) | Any | none | land value only | 0% | Waits for rezoning or growth |
| Arcology tower (Tier 4) | R, F | 1 to 5 | $300M | 5% | 3× dwellings per level; a whole district's Elite and Professionals can live in one plot |

### 2.16.3 Occupancy and rent

- **Occupancy** of rentable space each month = demand for that space type in the hub / total supply, capped at 100%. Demand for offices and labs comes from companies' headcount; for housing from population (2.8); for retail from consumer spending.
- **Rent level** follows the hub's property cycle (2.16.5) and the landlord's choice: Low (90% of market rent, occupancy +10%), Market, High (115%, occupancy -15%).
- **Rent control** under E7 Essentials Capped or Broad Controls caps residential rent increases.
- **Vacancy** costs upkeep (1% of value per year) and under E10 Vacancy Penalty a further 3% tax.

### 2.16.4 Buying, selling and developing

| Action | How | Time |
|---|---|---|
| **Buy a listed property** | Each hub lists 2 to 6 properties for sale each month; price = value × (0.9 to 1.2) | 2-hour viewing, 30 days to close |
| **Make an offer on any plot** | Owner accepts if offer > value × (1.1 + owner's reluctance); dispersed owners accept at 1.3× but sell 1 plot per quarter | 3-hour negotiation |
| **Auction** | New plots from hub growth (2.17) and government sales; sealed bids; Power Broker holders get first refusal | 1 week |
| **Develop** | Build or add levels on an owned plot; needs a permit ([4-politics.md](4-politics.md) E11) | Construction rules (2.7.2) |
| **Redevelop** | Demolish and rebuild as another type; tenants leave; residential demolitions add +3 unrest | Demolition 1 month plus construction |
| **Rezone** | Change a plot's district type through the local council (politics) | Permit time × E11 |
| **Sell** | List it (30 to 90 days) or sell instantly at 80% of value | Varies |

**Value** of a property = land value + building replacement cost × condition, then × the hub's property cycle multiplier (2.16.5).

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

- A Slum district where the average land value rises over 50% in 5 years becomes a candidate for **gentrification**: on a yearly roll (30%), it converts to Residential. Gig and Unemployed segments are pushed to another Slum or out of the hub; unrest +10 in the hub for a year.
- **Slum clearance** (a government or a Power Broker can push it): the district is rezoned, tenements are demolished, residents displaced (+15 unrest, Labor Unions and Gig Workers groups angry). Land value ×3 over 2 years.
- **Slum spread**: a Residential district with unrest over 60 for 2 years and land value falling converts to Slums.

### 2.16.7 Leases

Leasing lets a company grow without buying buildings, and lets a dynasty live off rent. All leases are contracts between two holders, shown on both balance sheets.

| Lease | What is leased | Term | Rent (yearly, T) | Who builds and maintains |
|---|---|---|---|---|
| **Ground lease** | Empty land; the tenant builds on it | 20 to 99 years | 3% to 5% of land value | Tenant builds and owns the building; it passes to the land owner when the lease ends |
| **Building lease** | A facility or property, ready to use | 3 to 15 years | Facilities: 8% to 12% of building value. Properties: market rent (2.16.3) | Landlord does major upkeep (condition); tenant pays running costs |
| **Build-to-suit** | The landlord builds a facility to the tenant's spec, then leases it | 10 to 20 years | 7% to 9% of total cost | Landlord pays construction; tenant commits before the build starts |
| **Sale-leaseback** | A company sells its own building to an investor and leases it back | 10 to 25 years | 7% to 10% of sale price | As building lease |

**Lease terms** (chosen when signing):
- **Escalation**: fixed 2% a year, or tied to the country's inflation.
- **Renewal option**: the tenant may renew at market rent; without one, the landlord can refuse.
- **Break clause**: the tenant may leave early by paying 12 months of rent.
- **Purchase option**: the tenant may buy the building at a set price during the lease.

**Rules**
- The **operator** controls production; the landlord only collects rent. Missing 2 months of rent lets the landlord start eviction (30 days), after which the facility idles until a new tenant signs.
- **Influence splits by role** (2.5.2): land and building value count for their owners; jobs count for the operator.
- **Owning versus leasing**: owning costs capital up front and earns the land's appreciation; leasing preserves cash for growth but adds a fixed cost and a landlord who can squeeze you at renewal.
- **Landlord leverage**: buying the land or building under a rival's key factory is a legal attack. At renewal the landlord can raise rent up to 50%, refuse renewal (the rival must relocate), or offer to sell at a premium. A lease without a renewal option counts as a **weak point** in takeover planning.
- **Seizure and sanctions** hit owner and operator separately: a government can nationalize the building and keep the foreign operator as a tenant, or freeze a sanctioned landlord's rent.
- **Property funds** (AI landlords) own about 20% of rentable buildings at start and offer build-to-suit deals to AI and player companies alike.

**Victoria 3 comparison.** In Victoria 3 a building is one thing owned by investors. Here the land, the building and the business inside are three separate assets that can belong to three different dynasties, which is where much of the corporate intrigue lives.

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

- **Size class change** at the yearly review (2.3.1): the hub gains districts, and new plots go to auction (2.16.4). Each new district's type is chosen by the hub's needs: Residential if housing is short, Industrial or Tech Park if jobs are planned, Slums if growth outpaces housing by more than 20%.
- **Decline**: a hub losing population for 5 years in a row loses mass (-2% per year), land values fall, and a district can be **abandoned** (becomes Slums or a land bank). A hub can drop a size class.
- **Boomtowns**: a Resource Field hub with a new large deposit grows +5% to +10% a year while it lasts, then can become a ghost town when the deposit runs out.

### 2.17.3 New hubs

New hubs appear in three ways:

- **Promotion** of a minor location: when a "rest of country" region gets enough facilities (total value over $5B), a new S hub forms there. The company that triggered it gets a +10 pp founding bonus to influence for 10 years.
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

**Drivers** that shift phase chances each month: credit growth (loans issued by all holders vs GDP), the policy rate versus its neutral level, commodity price shocks (oil above 150% of its 12-month average adds +5% contraction chance per month), stock market drops over 20%, real estate busts in the largest hub, wars, pandemics, and confidence (a hidden 0 to 100 value moved by news events).

The demand modifier applies to all consumer and investment demand in the country's hubs. Governments respond with budget changes; central banks with rates ([3-markets-and-fx.md](3-markets-and-fx.md)).

### 2.18.2 Global cycle

The **global cycle** is the GDP-weighted average of national phases. When the 3 largest economies are in contraction at once, a **global recession** event fires: commodity demand -10%, shipping rates -30%, all exchanges' sentiment -20.

### 2.18.3 Crises

| Crisis | Trigger | Effects |
|---|---|---|
| **Housing crash** | A bubble (2.16.5) bursts in a country's largest hub | Property values -30% to -50% over 2 years; banks with real estate loans hit; recession chance +30% |
| **Tech bubble** | A sector's average price-to-earnings ratio above 2.5× its long average for over a year | Sector stocks -50% to -80% over 6 to 12 months; VC funding -70% for 2 years (fewer funding rounds succeed) |
| **Debt crisis** | Country debt above its limit, or a company group with debt over 6× earnings defaults | Bond yields jump; bailout or default chain ([4-politics.md](4-politics.md)) |
| **Commodity super-cycle** | Sustained demand above world capacity for a good group | Prices +50% to +200% for years; new deposits surveyed 2× faster |

These crises are the macro background the player can ride, bet against or be ruined by.

## 2.19 Infrastructure as assets

Infrastructure can be owned, earns fees, and carries unusual power.

### 2.19.1 Ownable infrastructure

| Infrastructure | Where | Revenue | Special power |
|---|---|---|---|
| **Port terminal** | P districts | Fee per container or tonne handled (2% to 4% of cargo freight value) | Owner's cargo gets priority in congestion; can raise fees on rivals by up to 50% (Antitrust exposure) |
| **Pipeline** | Lane between hubs | Tariff per unit moved (regulated: 6% to 10% return on value) | Owner can prioritize own volumes |
| **Rail line** | Lane | Freight fees | As pipeline |
| **Toll road or bridge** | Lane or district | Tolls | Small local influence |
| **Power grid operator** | Hub | Regulated return (5% to 8%) | Decides blackout order in shortages (2.9.7); can favor own facilities |
| **Power interconnector** | Lane | Trade margin on electricity | Arbitrage between grids |
| **Fiber backbone and data cable** | Data lane | Bandwidth fees | Latency advantage for owner's finance operations; surveillance option (data goods) |
| **Airport** | P (air) district | Landing fees | Air freight priority; executive travel bonus (2.21) |
| **Water works** | X or I districts | Regulated water sales | Can ration water in heatwaves |

### 2.19.2 Rules

- Infrastructure counts toward influence at **weight 1.5** (like jobs), because whoever runs the port runs the town.
- Most infrastructure is **regulated**: fees above the allowed return add exposure with the relevant regulator and anger the population (+unrest).
- Infrastructure is the first target for **nationalization** in a crisis and the first thing sanctions freeze.
- Owning infrastructure on or next to a chokepoint (for example a terminal in a Malacca-facing port) gives an advance warning of disruptions there (+1 week) and priority use of bypass routes.

## 2.20 Climate and environment

### 2.20.1 Pollution

- Each heavy facility emits **pollution** (per level, by method: refinery 3, coal plant 5, steel mill 4, chip fab 1, office 0).
- **District pollution** = sum of emissions in the district, reduced by clean methods and E8 rules. Above 50: health needs +20% for residents, Professional and Elite segments leave (-1% per year), land value -10%, Environmentalist clout +2 in the hub.
- **Smog domes and filtered towers** (cyberpunk accent): Elite districts can buy air filtration (a property upgrade at +10% cost) and ignore pollution, at the price of unrest in nearby districts (+2).

### 2.20.2 Carbon

- **Emissions** are tracked per company and country. Under E8 Carbon Pricing the cost is applied per emission point.
- **Carbon credits** are a tradable good on commodity exchanges in countries with carbon pricing.
- Clean tech (Energy and Materials tier 3) cuts emissions by 50% to 90%.

### 2.20.3 Long-term climate trend

Climate shifts slowly over a long playthrough:

- Every 10 years (T), the chance of heatwaves, droughts, hurricanes and floods rises by +10% of their base value, unless world emissions fell over the decade.
- **Sea-level risk**: low-lying Port districts (marked in hub data: for example Rotterdam, Mumbai, Shanghai, Miami if added later) gain a flood risk that rises each decade. Sea walls are a government or owner project (construction units equal to 20% of district value).
- **Water stress** spreads to more hot hubs, raising water prices and hurting fabs and data centers.

This gives long dynasties a reason to care about decades-long trends, and a market for adaptation (sea walls, desalination, cooling).

## 2.21 Travel and private jets

Characters are physically somewhere on the map, and getting them where the deals are is a system of its own.

### 2.21.1 Location and residence

- Every character has a **current location** (a hub) and a **residence** (a hub; sets tax residency for E1 and E4).
- Meetings, galas and most character actions need both characters in the same hub. A **remote call** works for any meeting at -30% effectiveness (pitches, negotiations, persuasion). Some actions are in-person only: galas, Seduce, signing a founding round, family weddings and funerals.
- The dynasty names one hub as its **seat**: +3 pp dynasty influence there, family events happen there, and moving the seat takes 3 months of disruption (family opinion -10).

### 2.21.2 Ways to travel

| Mode | Time | Cost per trip (T) | Notes |
|---|---|---|---|
| Car or rail (same region) | 1 to 4 hours | Negligible | |
| Helicopter | 1 hour within a hub's region | $5,000 | Skips traffic; needs a helipad (office tower upgrade) |
| Commercial flight, first class | 4 hours domestic, 8 to 16 hours international | $1,000 domestic, $15,000 international | Fixed departures (one every 6 hours on major routes); visible to the public; no work in flight beyond calls at -50% |
| Charter jet | Like a private jet | $20,000 to $150,000 by distance and class | Booked 12 hours ahead; no ownership cost |
| Fractional jet share | Like a private jet | $2M a year for 200 flight hours | Booked 6 hours ahead |
| **Owned private jet** | Fastest door to door | Running cost per flight hour (2.21.3) | Leaves when you say; status; office cabin |
| Superyacht | Days | Upkeep only | A floating venue for galas and secret meetings (2.21.7) |
| Suborbital hop (Tier 4 late game) | 2 hours anywhere | $500,000 | Cyberpunk accent |

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
- **Status**: the class's status value is added to opinion at galas and in first meetings with Ambitious, Greedy or Socialite characters, and counts toward reputation among the Elite. Ascetic and Honest characters instead take -5 opinion of an owner below Tycoon standing who flies a Large cabin jet or bigger ("showing off").
- **Upgrades** (each a one-time cost):

| Upgrade | Cost | Effect |
|---|---|---|
| Office cabin | $2M | Work in flight (2.21.4) |
| Secure comms suite | $3M | Calls in flight at full effectiveness; -50% chance of being overheard by netrunning |
| Bedroom suite | $1M | Arrive rested: no jet lag stress (2.21.5) |
| Medical bay | $4M | Safer travel for old or ill characters; death chance in flight halved |
| Security package (armor, decoy flares, counter-surveillance) | $6M | Halves attack and kidnap risk on arrival; hides flight plans from Tier 1 trackers |
| Ghost registration (registered through a shell in a haven) | Cost of a shell company | Flight tracking needs Investigate Shell first (2.21.6); adds exposure |

- **Maintenance**: each jet needs 1 week of maintenance every 400 flight hours. Skipped maintenance raises the crash chance (2.21.8).
- **Home base and hangar**: a jet is based at an airport hub (the dynasty seat by default). Repositioning an empty jet costs its flight hours.
- **Leasing and chartering out**: a jet can be leased from a property or aviation fund (12% of its price a year), and an owned jet can be **chartered out** when idle, earning 60% of its running cost back per hour chartered.
- **Fleets**: a company in the aviation business can run a jet fleet as a charter service, selling flight hours to AI and player characters.

### 2.21.4 Itineraries and in-flight work

- The player plans **itineraries**: a list of hubs with meetings at each stop. The planner shows total hours, cost, and time-zone effects, and books the jet or flights.
- An **entourage** travels together: family members, executives and security staff on the same jet, up to its seats. Characters on a trip together gain +1 opinion of each other per 10 hours flown (and lose it if they share Rival status).
- **In-flight work** with an office cabin: Finance, Intrigue and Tech actions that do not need another person (planning a deal, reviewing a scheme, research) run at 75% speed. Calls run at 50% without secure comms, 100% with them.
- Commercial travel allows calls at 50% only.

### 2.21.5 Jet lag and wear

- Flying across more than 5 time zones gives **jet lag**: -10% effectiveness on actions for 24 hours after landing, and +5 stress. A bedroom suite or a circadian implant (cyberware) removes it.
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
- Visiting a hub where the dynasty holds assets gives a one-week **visit bonus**: +5 opinion from local employees and executives, +1 pp influence while there.

### 2.21.10 Travel events (starting set)

| Event | Trigger | Options |
|---|---|---|
| Spotted on the Tarmac | Rival tracks your jet to a target's hub | Deny, issue a statement, accelerate the deal |
| Grounded | Maintenance overdue | Fly anyway (crash risk), charter, cancel the trip |
| Jet Envy | A rival buys a bigger jet | Upgrade, mock them publicly, ignore |
| Emissions Scandal | Environmentalist media and over 300 flight hours a year | Buy offsets, defend it, sell the jet |
| The Long Way Round | Airspace closure on your route | Reroute (+hours), fly through (risk), cancel |
| Stranded | Detention or a sudden coup at your destination | Call in political favors, pay, hire a PMC extraction |
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
| Hub prices, shortages, cycle phase | Yes | |
| Rival facility plans and construction | Partly (big projects are news) | Market research or espionage |
| Characters' traits | Some (known traits) | Hidden traits need meetings or Dig Up Dirt |
| Influence shares of rivals in a hub | Tier only (Presence, Power Broker, Kingmaker) | Exact share needs intel |

### 2.22.2 Intel level

- The player has an **intel level** (0 to 100) on each rival company and hub. It rises with presence (own facilities or offices there), market research spending ($100k per month per hub: +5 per month), analysts on the board (CSO task), and espionage; it decays 2 per month.
- Intel level sets how accurate estimates are: ±30% at 0, ±10% at 50, exact at 90+.
- **Disinformation**: psyops and leaks can plant false numbers; low-intel players believe them.

## 2.23 AI economic behavior

AI companies and AI dynasties run the economy the player competes in.

### 2.23.1 Archetypes

| Archetype | Behavior |
|---|---|
| **Incumbent** | Defends share, prices at market, answers entrants with copy or acquire (see the Founder stage), invests steadily |
| **Aggressive grower** | Expands into new hubs, borrows heavily, cuts prices, buys rivals |
| **Cash cow** | Pays high dividends, invests little, sells assets when offered a premium |
| **State champion** | Backed by a government, ignores short-term profit, wins contracts, protected from takeovers |
| **Raider** | Holding company that buys undervalued stakes and breaks them up |
| **Startup** | Founder-stage AI rivals: fast, fragile, often for sale |

Each AI company's archetype comes from its controlling dynasty's head traits (Ambitious and Brave lean Aggressive; Greedy and Cautious lean Cash cow) and from its government links.

### 2.23.2 Monthly decisions

Each AI company decides monthly:

1. **Build or expand**: if a good's hub price has been above its unit cost by more than its hurdle rate (8% to 15% by archetype) for 3 months, it plans a new facility or level, choosing the hub with the best margin after transport.
2. **Close or sell**: a facility losing money for 6 months is idled; after 12 months it is sold or closed.
3. **Price**: sets its price position by archetype (Incumbent 100%, Aggressive 90%, Cash cow 105%, Luxury brands 130%+).
4. **Contracts**: secures inputs with contracts when price volatility is high.
5. **Acquire**: when cash exceeds 20% of value and a target is undervalued, considers a takeover ([1-corporate-core.md](1-corporate-core.md)).

AI investment is lagged and imperfect on purpose, so shortages and gluts happen and the player can profit from seeing them first.

## 2.24 Map views and overlays

The map is the main screen from the Climber stage on ([14-game-stages.md](../14-game-stages.md)).

### 2.24.1 Zoom levels

| Zoom | Shows | Main interactions |
|---|---|---|
| **World** | Countries, currency zones, lanes, chokepoints, wars, sanctions | Click a country for its economy and politics; click a lane for traffic |
| **Country** | Regions, hubs, national politics, cycle phase | Click a hub |
| **Hub** | Districts as a grid of 10-plot blocks | Click a district for unrest, pollution, land value, owners |
| **Plot** | One plot, its building and owner | Buy, develop, rezone, visit |

### 2.24.2 Map modes (overlays)

| Mode | Shows |
|---|---|
| Ownership | Who owns plots and facilities (by dynasty color) |
| Influence | Your influence share and tier per place; rivals' tiers |
| Supply chain | For a chosen good, where it is produced, shipped and consumed; live shipments |
| Prices | Hub prices of a chosen good versus world average |
| Shortages | Goods in shortage by hub (red) |
| Property cycle | Boom, peak, bust and recovery per hub |
| Economic cycle | National cycle phase |
| Unrest and labor | Unrest, strikes, unions |
| Pollution and climate | Pollution and disaster risk |
| Politics | Government type, ruling party, your political influence |
| Risk | Chokepoint risk, war, sanctions, nationalization risk for your assets |
| Characters | Where your family and key characters are right now |

### 2.24.3 Supply chain tracer

Clicking any facility or good opens a **tracer**: a tree from raw inputs to final buyers, showing every supplier hub, lane and chokepoint on the path, with your exposure highlighted. This is the main tool for spotting single points of failure before a disruption hits.

## 2.25 Worked examples for the new sections

### 2.25.1 Breaking into the Seoul phone market

A dynasty's electronics company sells phones in Seoul-Pyeongtaek against a local incumbent (quality 75, brand 85, price 100%) and an import brand (quality 70, brand 60, price 95%, reach 0.5). The newcomer launches at quality 70, brand 30, price 85%, with a retail facility (reach 1.0). Weights for consumer electronics: q 1.0, b 1.0, e 1.5.

- Incumbent appeal = (75/50) × (85/50) × 1.00^-1.5 × 1.0 = 1.5 × 1.7 × 1 = 2.55
- Import appeal = 1.4 × 1.2 × 0.95^-1.5 × 0.5 = 1.4 × 1.2 × 1.08 × 0.5 = 0.91
- Newcomer appeal = 1.4 × 0.6 × 0.85^-1.5 × 1.0 = 1.4 × 0.6 × 1.28 = 1.07

Target shares: incumbent 56%, import 20%, newcomer 24%. Because shares move 25% per month toward target, the newcomer reaches about 13% after 3 months. A year of marketing at $2 per $100 of sales (+1 brand per month, plus spillover from the home brand) lifts brand to about 45, and appeal to 1.6. The incumbent answers with a 10% price cut 50% of the time.

### 2.25.2 Riding the Dubai property cycle

A trust buys two office towers in Dubai's Financial District during Recovery for $500M. Boom arrives 14 months later (rate cuts, foreign buyers). After 36 months of Boom at +1.8% a month the towers are worth about $950M, and the boom has become a bubble. Selling at Peak locks in the gain; holding through the Bust (twice as deep after a bubble) would have cost about 45%.

### 2.25.3 A recession meets a margin loan

A national recession cuts consumer demand 6%. The dynasty's retail chain's earnings fall 25%; its stock falls 35%. The trust's margin loan, backed by that stock, crosses 70% loan-to-value, and a margin call forces the sale of 8% of the chain at the bottom. The dynasty's bloc drops from 54% to 49%: the chain becomes contested just as an activist faction forms. The economic cycle has become a succession-style crisis.

## 2.26 Assumptions

New assumptions in this file, to confirm with Logan:

1. **First playable map**: 30 major countries, 16 minor groups (aggregated markets whose member countries keep their own politics), 41 hubs and 14 chokepoints. Cities named in other files but missing here (for example Vancouver, Munich, Sydney) are candidates for later hubs. This answers the open question in 13 provisionally.
2. **Resource Field** is added as a seventh district type for mines, wells, farms and renewables.
3. **Reference dollar and wage index**: base prices are in US dollar equivalents; the wage index (US = 1.0) scales wages, services, land and construction, separately from the politics wealth index.
4. **Place mass** is a calibrated "power-relevant" value (hub size class × price factor; 3% of GDP for countries), not the full value of all property, so tiers are reachable at the intended stages. Jobs count through payroll × 1.5, making employers the most influential holders per dollar.
5. **Assets come first**: temporary boosts are capped at the larger of 6 pp or the base share, and a tier won by campaigns is lost after one quarter unless backed by assets.
6. **District tiers give economic perks only**; political perks start at the hub level.
7. **Foreignness penalties, offices, Political Capital and government types** are taken from the politics design; restriction labels are derived from its laws. The starting law positions listed in 2.2.4 (C1, C2, F2, E5, L2, E2, F3) should be mirrored in politics data.
8. **Timing**: production settles monthly but is released into stock weekly; hub goods prices update weekly; exchange quotes move hourly; tiers are checked weekly.
9. **Goods abstractions**: chips are counted in die-equivalent and lot units; packaging and test is a good the fabs consume; AI server nodes are single accelerator slots; vehicles use parts kits; services and housing scale with the price factor.
10. **SG&A by sector** carries the selling and brand costs that explain high gross margins on branded goods.
11. **Resource royalties and deposit pricing** keep extraction from being a money printer.
12. **Contracts**: allocation priority, force majeure, strategic default and renegotiation rules are new and link breaches to the Breach of contract casus belli.
13. **Proprietary starting monopolies**: lithography (Eindhoven) and precision optics (Frankfurt) exist from turn one and do not diffuse on their own.
14. **Export controls at start**: Indonesia's raw nickel ban, China's rare earth licences, and Western bans on lithography and AI server nodes to China.
15. **Tech** is organized in 13 sector groups covering the 20 launch sectors, with 4 tiers and research point costs of 300, 1,200 and 4,000.
16. **Hydro and geothermal** plants exist only as starting assets in the first release.
17. **Competition**: commodity goods sell at one hub price; differentiated goods split sales by quality, brand and price (2.15).
18. **Real estate** is a full system with plot ownership, property types, occupancy, development and per-hub property cycles (2.16).
19. **Hubs grow and decline** yearly by jobs, wages, housing cost and unrest; new hubs can form (2.17).
20. **Business cycles** run per country with four phases and a global recession event; housing crashes, tech bubbles, debt crises and commodity super-cycles are the main crises (2.18).
21. **Infrastructure** (ports, pipelines, grids, cables, airports, water) is ownable, mostly regulated, and counts at influence weight 1.5 (2.19).
22. **Climate** worsens slowly every decade unless world emissions fall; pollution is tracked per district (2.20).
23. **Characters have a location**; meetings need presence or a remote call at -30%; the dynasty has one seat hub. Travel has a full private jet system with six jet classes, upgrades, itineraries, flight tracking, yachts and travel risk (2.21).
24. **Information is imperfect**: intel levels per rival and hub set how accurate the player's view is (2.22).
25. **Own or lease** (Logan, 2026-10-16): like Victoria 3, but companies either own or lease the buildings they produce in. Land owner, building owner and operator are three separate roles (2.16.1).
26. **Plot uses** (Logan, 2026-10-16): a plot or a series of plots can be developed, rented out, kept, or used for a company. Adjacent plots merge into sites for large buildings (2.16.1).
27. **Lease types**: ground lease, building lease, build-to-suit and sale-leaseback, with landlord leverage at renewal (2.16.7).
