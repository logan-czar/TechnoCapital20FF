# TechnoCapital20FF MVP spec: the map, the business system and a read-only economic sim

_Status: v0.3 (2026-10-20). Batch 146 (Logan): Consumer electronics, EVs, E-commerce and AI labs are cash-burning industries on purpose and live on investor money; when their runway falls under 4 quarters they raise money by a discounted share issue or, if rated, a credit line draw, with success set by investor confidence and the industry news phase, and failures go down the bankruptcy path (6.6, G10 decided); batch 143 board-seat picks decided: seats beyond 5 are ordinary directors, charter minimums apply from 5 labor units, the controller appoints and the seat stands at the next yearly meeting, investor and government seats take the next labor seat or sit beyond 5, and the 651 starting companies keep their generated starting data while new companies start empty (7.1, G9 decided). Batch 145 (Logan): province shapes are generated from real-world boundary data ([map-sources.md](map-sources.md), 2.2, G1); simple characters fill board seats (3.7.1, G2); business assets degrade by industry, book depreciation equals the loss, and growth plans buy replacement before growth (2.2, 5.5, 5.10, 6.2, 7.1); bank and insurer capital set at $1.25 and $0.60 per $1, mapped to real capital ratios (2.2, G4); bankrupt firms go through forced sales, a 2-quarter freeze and removal, shareholders wiped (5.12, G7); one business unit per company at HQ is decided (G8); batch 143 board-seat items listed as open (G9). Built from Logan's MVP scope (2026-10-20) and the coordinator's defaults. Sources: [10-industry-economy.md](../detailed/10-industry-economy.md) (10.0 to 10.6, 10.0.11 operations, batches 140 to 144), [21-quarterly-cycle.md](../detailed/21-quarterly-cycle.md), [3-markets-and-fx.md](../detailed/3-markets-and-fx.md) 3.1, 3.3, 3.6, 3.9, 3.13, 3.14, [2-map-and-influence.md](../detailed/2-map-and-influence.md) 2.2, 2.3, 2.18, 2.23, 2.24, [20-ui.md](../detailed/20-ui.md), [../09-time-and-turns.md](../09-time-and-turns.md), [../12-tech-and-roadmap.md](../12-tech-and-roadmap.md) and the data in [../data/](../data/README.md). Where it fills a hole in the docs it marks the answer (A) or (T) and lists it in sections 5A and 11._

**How to read the numbers.** **(A)** marks an assumption made for the MVP, including the coordinator's defaults. **(T)** marks a tuning value. Section refs like 10.0.4 point to the detailed files.

---

## 1. Purpose and scope

Logan (2026-10-20): "For MVP I want to just have the Design Docs for the Map and the Business system with a read only economic sim with lite AI that just affect the company."

The MVP proves one thing: the 651 starting companies can run on their own, quarter after quarter, on the real map, and the numbers they produce (revenue, productivity, data, statements, fair value, price) stay believable. The player watches; nobody plays.

| | In scope | Out of scope |
|---|---|---|
| **Player** | Opens every MVP screen; pause and speeds 1 to 5; skip to next event **(A)** | Every player action: trading, founding, schemes, board seats, travel, the phone, quests |
| **Map** | 3,255 provinces, 210 countries, regions, areas, 97 Metros, 80 key cities, 8 superregions (design/data/) | Influence, real estate pools, development change, chokepoint risk, travel, unrest |
| **Companies** | 651 companies (data/companies.csv), one business unit each at HQ (decided, Logan batch 145), board as labor units 1 to 5 filled by simple characters (3.7.1) | Subsidiary directives, shells, deals on units, takeovers, IPOs, characters' personal play |
| **Economy** | 42 industries, world demand, supply ratio, market factor, fringe pools, productivity, decay, R&D, growth plans | Price indices and cost drivers (D fixed at 1.0) **(A)**, real estate, slop, chokepoints, tariffs |
| **Operations and data** | Labor units, stations, productive compute, unstructured and structured data, conversion, decay, free R&D (10.0.11) | Schemes, software design stations, software development (14), AI models (18), hacking, data sales |
| **Software** | Two fixed products: the general productivity software and the general enterprise software, both quality 50 **(A)** | Every other product, licences as a market, bloat, versions |
| **Quarter** | The 21 cycle, simplified: release, price reaction, AI plan lock, locked quarter, recap week | Grades, firing votes, board displeasure, board day events, guidance rolls, result plot line chains |
| **Finance** | Light statements, tax, credit line, credit rating, dividends by rule, fair value, simple share price, share issues by cash-burning industries (6.6) | Trading, order flow, bonds, margin, short selling, IPOs, buybacks, rights issues, default chain |
| **World** | Static country table; one world base rate (3%, batch 130); national business cycles; industry news cycles | Politics beyond the static table, media, gambling, vices, FX, the crash, history events |
| **AI** | Each company sets its own quarterly plan (growth, R&D %, station split, data handling, credit line, dividend); cash-burning industries raise money when runway runs short (6.6) | Schemes, politics, takeovers, trading, media, anything outside its own company |

**Information (A).** The observer is John Techno with his Pdoomberg subscription (7.3.0). Published figures (listed companies' statements, quotes, industry tables) are exact; private companies' figures show **?** (20.3.4). A debug toggle, **Omniscient**, shows every true value for testing and is off in release builds.

---

## 2. Data files

### 2.1 Existing files used (design/data/)

| File | Columns the MVP reads | Notes |
|---|---|---|
| countries.csv | iso3, name, superregion, gdp_usd_bn, population_m, wealth_index, major, hss, restriction_label, subject_of | Static. Superregions come from this column; there is no superregion file |
| provinces-*.csv (8 files) | id, name, country, region, area, metro, city_rank, commerce, industry, population, resource, terrain, coastal, contested, linked_cities | Static. The chokepoint column is read and ignored. Regions and areas are built from the distinct values |
| companies.csv | id, name, ticker, industry, hq_country, hq_province, public, revenue_usd_m, book_value_usd_m, est_value_usd_m, controller, controller_stake_pct, control_basis, owner_of_record, other_holders | Seeds corporations and their single unit. est_value is display-only (conflict C15) |
| characters.csv | id, name, tier, traits, finance, operations, persuasion, tech | The 296 full characters. Only those named as controller or owner_of_record are loaded, as **named controllers**: their traits nudge the AI (section 6). Board seats hold simple characters (3.7.1) |

### 2.2 New MVP data tables (to build; not created by this spec)

**industries.csv** (42 rows). Most values copy 10.3 and 10.0.11.10; new columns are marked new.

| Column | Type | Meaning and source |
|---|---|---|
| id | slug | e.g. oil, semiconductors, fast_food (new) |
| name | text | 10.3 |
| sector | text | Tech, Finance, Energy, Industry, Consumer, Health, Services (10.3) |
| valuation_group | text | Row of the sector table 3.3.2 |
| world_size_2020_usd_bn | number | 10.3 world size |
| trend_growth | fraction | 10.3; "Boom-driven" AI labs uses 0.30 **(T)** |
| cycle_beta | number | Cyclicality β (10.3) |
| rate_sensitivity | 0 to 3 | Low 0, Medium 1, High 2, Very high 3; "Positive" (Banking, Insurance) stored as 0 in the MVP **(A)** |
| margin_full_use | fraction | 10.3; AI labs "-40% to +40%" stored as 0.00 **(T)** |
| fixed_cost_share | fraction | f (10.3) |
| capital_per_dollar | number | 10.3; Banking 1.25 and Insurance 0.60 **(T)**: Logan's $1 and $0.50 base moved toward real capital ratios (batch 145, below) |
| asset_turnover | number | Derived: 1 ÷ capital_per_dollar |
| asset_decay | fraction | New (Logan, batch 145): share of business assets lost each year, 0.05 to 0.10 by industry (table below) **(T)** |
| rd_norm | fraction | New: industry R&D norm (10.0.4 gives only "2% heavy industry to 15% tech"). Values in the table below **(T)** |
| labor_value_usd | number | 10.0.11.10 (default 100,000) |
| pc_modifier | number | 10.0.11.10 (Retail and Fast food 0.5, else 1) |
| data_tb_per_musd | number | 10.0.11.10 (default 1) |
| data_decay_base | fraction | 10.0.11.10 (default 0.02) |
| fit | enum | Commerce, Industry or Extraction (10.3.1) |
| resource_tags | list | Matching tags (10.3.1), semicolon list |
| asset_label | text | Flavor label (10.0.7): fields, fabs, stores... (new) |

R&D norm by industry **(T)**:

| rd_norm | Industries |
|---|---|
| 15% | AI labs, Pharma, Semiconductors, Software |
| 12% | SaaS |
| 10% | Cloud, Social media, Gaming, Consumer electronics, Robotics, Drones, EVs, Aerospace, Defense |
| 6% | Ads, Data centers, Telecom, Autos, Chemicals, Gambling, E-commerce |
| 3% | Banking, Insurance, Asset management, Healthcare services, Professional services, Power utilities, Renewables, Metals, Mining, Agriculture, Shipping, Logistics, Airlines, Luxury, Real estate |
| 2% | Oil, Gas, Construction, Retail, Fast food, Black market |

Asset decay by industry (Logan, batch 145; 10.3) **(T)**:

| asset_decay | Industries |
|---|---|
| 10% | AI labs, Cloud, Data centers, Software, SaaS, Social media, Ads, Consumer electronics, Gaming, Gambling, Semiconductors, E-commerce, Drones, Robotics |
| 8% | Telecom, Banking, Insurance, Asset management, Chemicals, Autos, EVs, Aerospace, Defense, Shipping, Logistics, Airlines, Construction, Retail, Fast food, Luxury, Pharma, Healthcare services, Professional services, Black market |
| 6% | Oil, Gas, Mining, Metals, Agriculture |
| 5% | Power utilities, Renewables, Real estate |

**Bank and insurer capital (Logan, batch 145) (T).** Logan's base is $1 of business assets per $1 of revenue for Banking and $0.50 for Insurance. The MVP moves both toward real levels and keeps one simple game rule: **a bank's or insurer's business assets are its regulatory capital**, the equity that lets it lend or underwrite. Deposits and float fund the loans and claims and are not on the game's books (3.17). Every other rule (turnover, growth, decay, the credit line) treats it like any business asset.

| Industry | Real-world anchor | Mapping | MVP value |
|---|---|---|---|
| Banking | Capital of about 10 to 15% of risk-weighted assets (Basel III minimum about 10.5% with the conservation buffer). Revenue runs about 5% of total assets; risk-weighted assets are about 55% of total assets | $1 of revenue needs about $11 of risk-weighted assets; at a 12% capital ratio that is about $1.30 of capital | 1.25 (base 1.0) |
| Insurance | Capital above the required solvency capital, typically held at 150 to 200% coverage; P&C rule of thumb: no more than about $3 of premiums per $1 of capital | Required capital about 30 to 40% of premiums × about 170% coverage ≈ $0.55 to $0.65 per $1 of premiums | 0.60 (base 0.5) |

Asset decay (8%) stands for loan losses and claims run-off. Check: fixed cost per $1 of assets (f ÷ capital) is 0.44 for Banking and 0.50 for Insurance, far above 0.08, so both keep their 30% and 8% margins (5.5).

**country-economy.csv** (210 rows, one per countries.csv row; gap G5).

| Column | Meaning |
|---|---|
| iso3 | Key into countries.csv |
| corp_tax_level | Haven, Low, Moderate, High (E2, 4-politics). The 33 majors copy 2.2.3; havens (2.2.5) Haven; others Moderate **(A)** |
| corp_tax_rate | Haven 0.03, Low 0.12, Moderate 0.21, High 0.30 (E2). Excess Profits is not used at start |
| sovereign_rating | AAA to D (3.6.2), set once from the 3.6.3 points table **(A)** |
| country_spread_bps | Fixed spread over the world base rate (3.6.5): sovereign spread for the rating plus a calibration offset; US 0 **(T)** |
| cycle_group | iso3, or EA for the 19 euro-area members, which share one cycle (2.18.1) |
| cycle_phase_start | Expansion, Overheating, Contraction or Recovery; euro-crisis countries start Contraction (2.18.1) **(A)** |

**key-cities.csv** (80 rows, copied from 2.3.3): city, country, province_ids (semicolon list), specialties, has_perk (Y/N). Location perks are not applied in the MVP **(A)**; key cities show as map labels and filters.

**province-geometry** (to build, gap G1): a province-id bitmap (one color per province id, EU4 style) plus province-centroids.csv (id, lat, lon, label_x, label_y). Without it the map cannot draw. Province shapes are generated from real-world boundary data (Logan, batch 145); sources and method are in [map-sources.md](map-sources.md).

---

## 3. Entities and state (Rust-side)

All state lives in the engine's tables, keyed by id (12.3). Money is f64 USD; TB is f64; counts are u32. "Static" means loaded and never changed in the MVP.

### 3.1 World

| Field | Type | Meaning |
|---|---|---|
| clock | datetime (UTC, hourly) | Starts 2020-01-01 00:00 |
| speed | 0 to 5 | 0 paused; 1 to 5 as 9.1 |
| base_rate | fraction | World base rate, 0.03 **(T)**, fixed in the MVP **(A)** |
| neutral_rate | fraction | 0.03 **(T)** |
| world_cycle_mod | fraction | GDP-weighted average of country demand modifiers (2.18.2) |
| quarter_phase | enum | Release, Reaction, Locked, PreQuarterEnd (21.1) |
| rng_streams | seeds | One stream per system: cycle, news, prices, AI, gen (12.3) |

### 3.2 Country (static except the cycle)

| Field | Meaning |
|---|---|
| iso3, name, superregion, gdp, population, wealth_index | From countries.csv |
| corp_tax_rate, sovereign_rating, country_spread | From country-economy.csv |
| cycle_phase, phase_months_left, demand_mod | National cycle (2.18.1); euro-area members read their group's values |

### 3.3 Province (static)

| Field | Meaning |
|---|---|
| id, name, country, region, area, metro, city_rank | From the province files |
| commerce, industry, population | Development tracks 1 to 30; total = sum |
| resource, terrain, coastal, contested, linked_cities | Tags |
| largest_track | Commerce or Industry (ties count for both, 10.3.1) |
| key_city | Key city name, if any |

### 3.4 Industry

| Field | Meaning |
|---|---|
| static row | All industries.csv columns |
| base_demand | Trend-only yearly demand |
| demand | Effective yearly demand after cycle, rates and news |
| news_phase, news_months_left | Boom, Normal, Glut, Bust (10.0.6) |
| fringe_assets | Fringe pool business assets (10.0.10) |
| supply, supply_ratio S, market_factor M | 10.0.3 |
| published | Last month's demand, supply, S, M and phase, for screens |

### 3.5 Corporation

| Field | Meaning |
|---|---|
| id, name, ticker, public, hq_province, hq_country | From companies.csv |
| controller, control_basis, owner_of_record, holders | Cap table from companies.csv; static except dilution by share issues (6.6) |
| archetype | Incumbent, Aggressive grower, Cash cow, State champion, Startup (2.23.1, section 6) |
| units | List of business unit ids (one in the MVP) |
| board | Seats from labor units 1 to 5 (3.7) |
| management_score | 0 to 100 (10.5.1) |
| labor_units, labor_assignment | Total and split: productivity, enterprise, 50/50, research, idle |
| compute | Extra base compute, data compute, enterprise licences |
| pc, pc_bonus | Productive compute and its stepped bonus |
| data | Per industry: unstructured in 12 monthly buckets (10.0.11.4), structured held TB (10.0.11.6), free_rd_pct with a 1-month grace flag |
| cash, line_drawn, line_limit, rating | Finance |
| book_equity | cash + asset book − line_drawn |
| plan | Locked quarterly plan (section 6) |
| ledger_month, statements | Monthly ledger; quarterly and yearly statements |
| shares_out, price, fair_value, buzz | Valuation (listed: price; private: value only) |
| history | Last 20 quarters of key figures; daily price bars |
| distress_months | Months with cash below 0 after the line is exhausted |
| status | Active, Distressed, Bankrupt (frozen) or Removed (5.12) |
| frozen_quarters | Quarters spent Bankrupt (5.12) |

### 3.6 Business unit

| Field | Meaning |
|---|---|
| id, corporation, industry, base_province | One per company, in its CSV industry, based at hq_province (decided, Logan batch 145) |
| asset_spread | Province shares; 100% base province in the MVP (decided, batch 145) |
| gross_assets | Business assets at cost (capacity, 10.0.7), less sales and asset decay (5.10) |
| ramping | List of (amount, months_left) for new assets at 80% for 6 months (10.0.4) |
| asset_book | Book value; falls by depreciation, which equals asset decay (5.5) |
| productivity | 30 to 200, starts 100 |
| location_bonus | Fit and resource points (10.3.1) |
| fixed_cost_rate | Fixed cash cost per $1 of gross assets a year, set at load (7.1) |
| growth_plan, rd_plan | From the corporation's locked plan |
| revenue_m, opex_m, rd_m, dep_m, shared_m | Last month |
| loss_quarters | Consecutive quarters with negative EBIT |

### 3.7 Board seat (labor units 1 to 5)

| Labor unit | Seat **(A for order)** | Skill used (10.5.1) |
|---|---|---|
| 1 | CEO | Average of Finance, Operations, Persuasion |
| 2 | COO | Operations |
| 3 | CFO | Finance |
| 4 | CMO | Persuasion |
| 5 | CTO | Tech |

A seat exists only when the company has that many labor units (10.0.11.3). Each seat holds a **simple character** (3.7.1; Logan, batch 145). Chair, General Counsel, CIO and the rest are empty and count skill 3 (10.5.1). Seats persist; the MVP has no firing or elections.

### 3.7.1 Simple characters (Logan, batch 145)

Logan: "We need simple characters that do the bare minimum, make the default choice on everything, and just serve as stats to roll against with traits to fill their role. These will supplement the full characters."

A **simple character** is a filler executive ([1-corporate-core.md](../detailed/1-corporate-core.md) 1.1.0): a name, an age, the six skills (Finance, Operations, Persuasion, Intrigue, Tech, Hustle; 1.1.1) and one or two role traits. It has no ambitions, relationships, opinion, hooks, schemes or personal play. It always takes the default choice and exists to fill board seats and be rolled against. The 296 full characters stay as they are; simple characters are **generated as needed** to fill the roughly 2,700 board seats beyond them: at load, and whenever a seat opens (5.10). When a seat closes or the company is removed, its simple character is discarded **(A)**.

| Field | Type | Meaning |
|---|---|---|
| id, name | u32, text | Name from a list for the HQ country's superregion **(A)** |
| age | u8 | Drawn by company size (below); ages do not move skills in the MVP **(A)** |
| finance, operations, persuasion, intrigue, tech, hustle | 0 to 30 | Drawn by company size and seat (below) |
| traits | 1 or 2 | From the seat's role list (below) |
| company, seat | ids | Where it sits |

**Generation rule (T).** Uniform integer draws from the gen RNG stream. Company size is trailing annual revenue (starting revenue at load).

| Company size | Seat skill | Other five skills | Age |
|---|---|---|---|
| Small: under $100M | 4 to 10 | 2 to 8 | 25 to 55 |
| Mid: $100M to $10B | 7 to 13 | 3 to 9 | 30 to 62 |
| Large: $10B and up | 10 to 16 | 4 to 10 | 38 to 68 |

The seat skill is the skill the seat uses (3.7); the CEO draws all three of Finance, Operations and Persuasion in the seat range. A seat's character keeps its draw if the company later changes size.

**Traits (T).** One trait (60%) or two (40%), drawn from the seat's list with no opposite pair (1.1.2):

| Seat | Role traits |
|---|---|
| CEO | Ambitious, Diligent, Brave, Visionary, Cautious, Gregarious |
| COO | Diligent, Ruthless, Cautious, Compassionate, Lazy |
| CFO | Greedy, Cautious, Diligent, Honest, Deceitful |
| CMO | Gregarious, Narcissist, Brave, Hedonist |
| CTO | Visionary, Diligent, Conservative, Shy |
| Chair, General Counsel, CIO, Chief Strategy Officer (post-MVP) | Paranoid, Ruthless, Honest, Ambitious, Cautious |

Traits apply only their skill effects (1.1.2) and the management score shifts (10.5.1: Diligent +2, Lazy -2, Ambitious +1, Greedy -1 as CFO). They never change the plan: the Lite AI's trait nudges (section 6) read only the named controller's traits. Expected management score with every labor seat filled and the Chair empty (5.7): about 33 small, 47 mid, 60 large.


### 3.8 Compute and software (corporation level)

| Item | Count | Monthly cost **(T)** |
|---|---|---|
| Bundled desktop, base compute, productivity seat | 1 per labor unit | Inside fixed costs (10.0.11.3) |
| Extra base compute | max(9, ceil(0.2 × stations)) | $50 each (maintenance 1 × $50, 15.2) |
| Data compute | max(10, ceil(1.2 × TB stored ÷ 100)), auto-scaled monthly | $10 each (maintenance 0.2 × $50) |
| Enterprise licence | 1 per enterprise or 50/50 station | $30 each (10.0.11.1) |

### 3.9 Statements (per corporation; light, 10.0.8)

| Statement | MVP lines |
|---|---|
| Income | Revenue; operating costs (variable, fixed cash); R&D; shared costs; depreciation; EBIT; interest expense; interest income; pre-tax income; tax; net income |
| Balance sheet | Cash; business assets at book; total assets; credit line drawn; equity |
| Cash flow | Operating cash; asset purchases; asset sales; line drawn or repaid; shares issued, net of fees (6.6); dividends; net change |
| Key figures | Productivity, PC bonus, labor units, held TB, free R&D %, management score, rating, guidance range |

### 3.10 Share price (listed companies)

| Field | Meaning |
|---|---|
| shares_out | Set at load so the opening price is $25 (7.1); rises with share issues (6.6) |
| fair_value, V | Total and per share (5.13) |
| price P | Hourly (5.14) |
| consensus_ni | Next quarter net income consensus (set at the plan lock) |
| buzz | -100 to +100, earnings only, decays 25% a day (3.3.5) |
| bars | Daily open, high, low, close |

---

## 4. Tick order

One tick is one hour (9.1). Jobs at 00:00 run in this order: hourly, daily, monthly (on the 1st), quarterly (on its dates), yearly (1 January). Each job reads the state left by the one before. The engine refreshes query tables after each tick (section 9).

### 4.1 Hourly (every tick)

1. Advance the clock; apply queued control calls (speed, pause).
2. **Share prices** for every listed company (5.14), except on 1 January (markets closed, 3.1.0).
3. On the 2nd of Jan, Apr, Jul and Oct at **01:00**: earnings jump (5.15).
4. Fire alerts due this hour; auto-pause if an alert is set to Pause. Nothing else is hourly; data creation is monthly (C3).

### 4.2 Daily (00:00)

1. Daily price bar closes; buzz decays 25%.
2. Fair value refresh from current inputs (5.13); full recalculation only at the release.
3. Reaction week: on the 3rd to the 8th of a release month, close 20% of the gap between P and V (21.3.1).
4. Projection ranges refreshed (5.16).
5. News: post the day's queued headlines (5.18). There are no weekly jobs; the 9.2 weekly economy runs monthly (C6).

### 4.3 Monthly (00:00 on the 1st; closes the month just ended)

| Step | What runs | Section |
|---|---|---|
| 1 | Country cycles advance; world_cycle_mod | 5.1 |
| 2 | Industry news phases advance; demand updated | 5.1, 5.2 |
| 3 | Fringe pools grow or shrink | 5.3 |
| 4 | Labor units recounted; board seats opened or closed; stations assigned from the plan | 5.10 |
| 5 | Productive compute and PC bonus | 5.8 |
| 6 | Supply, S and M per industry | 5.2 |
| 7 | Unit revenue | 5.4 |
| 8 | Data: create unstructured, convert, decay, retention; free R&D % for next month | 5.9 |
| 9 | Expenses: variable, fixed, depreciation (this month's asset decay), R&D, shared costs | 5.5, 5.11 |
| 10 | Productivity: decay and R&D effect | 5.6 |
| 11 | Asset decay applied; growth plan buys replacement plus growth, or sells; ramping tranches age; simple characters generated for new seats | 5.10, 3.7.1 |
| 12 | Interest, line fees, interest on cash | 5.12 |
| 13 | Cash settles; auto-draw or auto-repay the credit line; distress and bankruptcy checks | 5.12 |
| 14 | Post the monthly ledger; tax accrues on the quarter (paid at quarter close) | 5.11 |

### 4.4 Quarterly (exact days)

The quarter starts at each release and ends at the next (21.1). Accounting quarters are calendar quarters.

| Phase | Q1 release | Q2 release | Q3 release | Q4 release | What runs in the MVP |
|---|---|---|---|---|---|
| Close and compile | 1 Apr 00:00 | 1 Jul 00:00 | 1 Oct 00:00 | 1 Jan 00:00 | After the monthly job: build the quarter's statements (unpublished); pay the quarter's tax; tag result types (21.3.2) |
| 1. Release | 2 Apr 00:00 | 2 Jul 00:00 | 2 Oct 00:00 | 2 Jan 00:00 | Statements published to Filings; Earnings day alert (Pause by default); prices frozen this tick (21.2) |
| Price move | 2 Apr 01:00 | 2 Jul 01:00 | 2 Oct 01:00 | 2 Jan 01:00 | Full fair value; earnings jump ×1.5; buzz; rating review; credit line review; result headlines |
| 2. Reaction week | 2 Apr 01:00 to 9 Apr 00:00 | 2 to 9 Jul | 2 to 9 Oct | 2 to 9 Jan | Daily 20% reversion toward V; hourly volatility ×2 falling to ×1 by day 7 (21.3.1) |
| 3. Plan lock | 9 Apr 00:00 | 9 Jul 00:00 | 9 Oct 00:00 | 9 Jan 00:00 | Every company's Lite AI plan (section 6) in one batch; consensus set; old plan ran until now (21.5) |
| 4. Locked quarter | 9 Apr to 25 Jun | 9 Jul to 25 Sep | 9 Oct to 26 Dec | 9 Jan to 26 Mar | Plans fixed; projections shown as ranges |
| 5. Pre-quarter-end week | 25 Jun 00:00 to 2 Jul 00:00 | 25 Sep to 2 Oct | 26 Dec to 2 Jan | 26 Mar to 2 Apr | Quarterly recap built and shown (Pause by default); no board day events **(A)** |

The first quarter is special: the game starts 1 Jan 2020 00:00 with plans set at load (section 6). The 2 Jan 2020 release publishes a **synthetic Q4 2019** built from the starting run rate (revenue ÷ 4 and so on) **(A)**, and 1 January 2020 is a market holiday. The pre-quarter-end week starts 7 days before the next release: 26 March, 25 June, 25 September and 26 December (21.1).

### 4.5 Yearly (1 January 00:00, after the Q4 close)

1. Compile the annual statements (sum of four quarters); the 2 January release carries them.
2. Archive: keep 20 quarters of statements and 10 years of daily bars per company **(T)**.
3. Nothing else: development, populations and countries are static in the MVP **(A)**.

---

## 5. Formulas

All yearly figures are booked monthly as ÷ 12 (10.0.11.1). Money is in USD.

### 5.1 Demand (10.0.3, 10.3, 10.0.6, 2.18)

- **Base demand** grows monthly: `base_demand ×= (1 + trend_growth)^(1/12)`.
- **Country cycle** (2.18.1): each cycle group sits in a phase with a demand modifier drawn uniformly in the phase range on entry: Expansion 0 to +3%, Overheating +3 to +5%, Contraction -3 to -8%, Recovery -1 to +2%. Phase lengths drawn uniformly: Expansion 36 to 96 months, Overheating 6 to 24, Contraction 6 to 18, Recovery 12 to 36. Order: Expansion, Overheating, Contraction, Recovery, Expansion **(A)**.
- **World cycle modifier** `c = Σ (gdp × demand_mod) ÷ Σ gdp` (2.18.2).
- **Effective demand**:
  `demand = base_demand × (1 + β × (c − c0)) × (1 − s × (base_rate − neutral_rate)) × news_mult`
  where c0 is c at load, so demand starts at the 2020 world size **(A)**; s is rate_sensitivity; news_mult is 1.15 in Boom, 0.85 in Bust, else 1 (10.0.6).
- **Industry news phase** (10.0.6): each phase lasts 6 to 36 months by roll **(T)**. Every industry starts Normal with 6 to 36 months left **(A)**. On expiry the next phase is rolled **(T)**:

| From | Boom | Normal | Glut | Bust |
|---|---|---|---|---|
| Normal | 35% | 30% | 35% | 0% |
| Boom | 0% | 40% | 60% | 0% |
| Glut | 0% | 50% | 0% | 50% |
| Bust | 30% | 70% | 0% | 0% |

  If S is above 1.15 at the roll, Glut and Bust weights double; below 0.85, Boom doubles **(T)**.

### 5.2 Supply, oversupply and undersupply (10.0.3)

- **Unit pre-market productivity** `p_pre = productivity + PC bonus + location_bonus` (conflict C12).
- **Supply** `= fringe_assets × turnover + Σ units (assets_eff × turnover × p_pre ÷ 100)`, where `assets_eff = gross_assets − 0.2 × ramping` (new assets at 80%, 10.0.4).
- **Supply ratio** `S = supply ÷ demand`, plus 0.2 in a Glut (10.0.6).
- **Market factor** `M = clamp((1 ÷ S)^0.5, 0.7, 1.3)` **(T)**. Oversupply (S above 1) gives M below 1, cutting every unit's effective productivity; undersupply raises it. S 1.21 gives M 0.91; S 0.81 gives M 1.11.

### 5.3 Fringe pool (10.0.10)

- At load: `fringe_revenue = max(0, world_size − Σ named revenue in the industry)`; `fringe_assets = fringe_revenue ÷ turnover`, productivity 100, no decay **(A)**.
- Monthly: `fringe_assets ×= (1 + trend_growth + adj)^(1/12)`, with adj +3% in Boom, -5% in Bust, else 0.
- Revenue `= fringe_assets × turnover × M ÷ 12`. Not ownable; shown as one row "Fringe (unnamed)" on the industry screen.

### 5.4 Revenue (10.0.4, 10.0.11.2)

`effective productivity = p_pre × M`

`revenue (month) = assets_eff × turnover × effective productivity ÷ 100 ÷ 12`

- **Location bonus** (10.3.1): `+2 × share of assets in provinces whose largest track matches the fit + 3 × share in provinces whose resource tag matches` (points of productivity) **(A: points, not percent)**. With 100% at the base province this is 0, 2, 3 or 5.
- **Demand share.** A unit's share of the industry's revenue is its share of supply; total industry revenue is `supply × M`, which equals `(supply × demand)^0.5` when M is not clamped. Demand is never fully met or fully exceeded; that is the intended Wall Street Raider feel.

### 5.5 Expenses (10.0.4, 10.3; conflict C11)

Per unit, per month:

| Line | Formula |
|---|---|
| Variable | `revenue × v`, with `v = 1 − margin_full_use − f` and D fixed at 1.0 **(A)** |
| Fixed cash | `gross_assets × fixed_cost_rate ÷ 12` |
| Depreciation | `min(asset_book, gross_assets × asset_decay ÷ 12)`: the month's asset decay at cost (5.10). Book depreciation equals the degradation (Logan, batch 145, 10.0.7); the 10-year straight line is retired |
| R&D spend | `revenue × rd_plan` (free R&D costs nothing, 5.9) |
| Shared costs | Corporation compute, data compute and licences (3.8), split across units by revenue share (10.0.8) |

- **Depreciation sits inside the fixed share (A).** `fixed_cost_rate = f × turnover − asset_decay − shared_cost_rate` at load, so fixed cash plus depreciation plus shared costs equals `f × revenue at productivity 100 and M 1.0`, and margin_full_use is the margin before R&D, as in the 10.10 worked example. Without this, Oil (capital 2.5, decay 6%) would lose 15 of its 25 margin points to depreciation.
- **Profit check (batch 145).** `f × turnover` is lowest in Renewables (0.20), then Data centers (0.22), Power utilities (0.23), Oil and Gas (0.24); it is above `asset_decay + shared cost rate` in all 42 industries, both at the starting values (shared costs are well under 1% of assets) and for the barebones company ($7,000 of shared costs on $100,000, rate 0.07; worst case Data centers 0.22 − 0.10 − 0.07 = 0.05). So fixed_cost_rate stays positive and EBIT before R&D is unchanged: Oil keeps 25%, and the barebones company stays break-even. What changes is cash: a company that holds still now spends its depreciation on replacement, so its steady free cash flow before growth is EBIT less R&D, interest and tax, not that plus depreciation. Some industries already earn nothing or lose money after R&D at the norm; that is older and not caused by asset decay (G10).
- **Productivity decay is kept (batch 145).** Asset decay carries the physical wear of assets (paid by replacement purchases); productivity decay (5.6) is the business falling behind (paid by R&D). No double counting in money; the old 10.0.7 wording that called productivity decay the assets' wear is fixed.
- **Check (Robotics, 10.10):** turnover 1.43, f 0.35, margin 0.10: v 0.55; at M 1.0, revenue $3.0B, costs $1.65B + $1.05B, EBIT before R&D $0.30B. Matches.

### 5.6 Productivity decay and R&D effect (10.0.4, 10.5.2, 10.0.11.3)

Monthly, per unit:

`Δ productivity = (10 × (rd_total ÷ rd_norm − 1) × mgmt_factor × research_mult) ÷ 12 − decay`

| Term | Rule |
|---|---|
| rd_total | `rd_plan + free_rd_pct` (free R&D works exactly like spending, 10.0.11.7) |
| mgmt_factor | `0.5 + management_score ÷ 100` |
| research_mult | Research labor: 0 units ×1.00; 1 to 9 ×1.01; 10 to 99 ×1.02; 100 to 999 ×1.03; +0.01 per further 10× (10.0.11.3) |
| decay | 0.5 a month; 0.4 with 10%+ labor idle; 0.3 with 25%+ idle (10.0.11.3) |
| Clamp | productivity 30 to 200 **(T)** |

Check (score 50): at the norm, -6 a year; at double the norm, +4 net; no R&D, -16 a year. Matches 10.0.4.

### 5.7 Management score (10.5.1)

`score = min(100, Σ weight × skill ÷ 20 × 100)` with weights CEO 30%, COO 20%, CFO 20%, CTO 10% (20% in Tech, taking 10% from the CEO), Chair 10%, other seats 10% (the CMO in the MVP). Empty seats count skill 3. A board of skill 11 with an empty Chair scores about 51. Confidence factor `= 0.8 + score ÷ 250` (10.0.8, 10.5.2).

### 5.8 Productive compute bonus (10.0.11.2, batch 142)

- `PC = (productivity stations + 0.5 × 50/50 stations) × pc_modifier` (main industry's modifier, since stations are pooled **(A)**).
- `PC bonus = floor(1 + log10(PC))` for PC ≥ 1, else 0. Corporation-wide, live, no decay; gone the month stations go.

| PC | Under 1 | 1 to 9.99 | 10 to 99.99 | 100 to 999.99 | 1,000 to 9,999.99 | 10,000+ |
|---|---|---|---|---|---|---|
| Bonus | 0 | +1 | +2 | +3 | +4 | +5 (+1 per further 10×) |

### 5.9 Data creation, conversion, decay and free R&D (10.0.11.4 to 10.0.11.7)

Monthly, per corporation and industry, in this order:

1. **Free R&D for this month** uses held TB at the start of the month: `free_rd_pct = 1 + floor(log10(held))` percent for held ≥ 1 TB, else 0. A drop to a lower step applies after a 1-month grace.
2. **Create**: `unstructured += revenue_month ($M) × data_tb_per_musd` into this month's bucket. $1M of revenue makes 1 TB by default.
3. **Convert**: capacity `= (enterprise stations + 0.5 × 50/50 stations) × 0.9125 TB` a month (general enterprise software at quality 50: 1 GB a tick × Q 1.25 × 730 ticks) **(T)**. Oldest buckets convert first; `held += converted`.
4. **Decay**: `rate = base × (1 + log10(held))` for held ≥ 1, else base; `held −= held × rate`. Base 2% (1% finance and health, 3% social media, ads, e-commerce; 10.0.11.10).
5. **Retention**: unstructured older than 12 months is dropped.
6. Storage is auto-scaled (3.8); nothing overflows in the MVP **(A)**.

Free R&D steps: under 1 TB 0%; 1 TB 1%; 10 TB 2%; 100 TB 3%; 1 PB 4%; 10 PB 5%; +1% per further 10×. Steady state for a corporation converting C TB a month solves `C = rate(held) × held` (used at load, 7.2).

### 5.10 Labor units and growth plan purchases (10.0.11.3, 10.0.4, 10.0.7, 21.5)

- **Labor units** `= floor(Σ units gross_assets ÷ labor_value)`, minimum 1 (the CEO). Seats 2 to 5 open and close with the count (3.7). When the count falls below what is assigned, drop idle first, then research, enterprise, then productivity (10.0.11.3).
- **Asset decay** (Logan, batch 145): "Percentage of business assets degrade overtime, this drives growth spending." Monthly at step 11 the unit loses `gross_assets × asset_decay ÷ 12` of capacity at cost, a real loss of the asset base. The same dollar amount comes off asset_book as depreciation (5.5), capped at asset_book. Ramping tranches decay with the rest **(A)**.
- **Growth plan** is an annual net rate g set at the plan lock (21.5): replacement comes first, then growth. Monthly at step 11, purchases `= gross_assets × (asset_decay + g) ÷ 12`:
  - above 0: buy that amount; cash pays it, and it is added to gross_assets and asset_book at cost. The growth part (`gross_assets × g ÷ 12`, when g is above 0) enters `ramping` for 6 months; replacement does not ramp **(A)**.
  - below 0 (g below −asset_decay): sell `gross_assets × |asset_decay + g| ÷ 12` of capacity; the book sold is the same share of asset_book; cash received `= book sold × sale factor` (Boom 1.00, Normal 0.85, Glut 0.70, Bust 0.60, 10.0.7); the difference is a gain or loss in pre-tax income.
  - So g = 0 holds the asset base flat and costs `asset_decay × gross_assets` a year in cash; g = −asset_decay buys and sells nothing and lets the base shrink by decay alone.
- **Seats**: when the labor count opens a seat 2 to 5, a simple character is generated for it (3.7.1); when it closes, the character is discarded.

### 5.11 Tax (10.5.5)

- Each quarter, `tax = max(0, pre-tax income − loss carryforward used) × corp_tax_rate` of the HQ country (all assets sit there in the MVP). Losses carry forward without limit **(A)**. Accrued monthly for projections, paid at the quarter close.

### 5.12 Credit line, interest and rating (10.0.9, 3.6; conflicts C9, C10)

- **Limit** `= max(0, (0.5 × asset_book + own cash)) × rating_factor`, where own cash is `cash − line_drawn` floored at 0 (conflict C10). Rating factor **(T)**: AAA 1.0, AA 0.9, A 0.8, BBB 0.65, BB 0.5, B 0.3, CCC and below 0.
- **Rate** `= base_rate + country_spread + corporate spread(rating)` (3.6.2 5-year spreads: AAA 0.40%, AA 0.60%, A 0.90%, BBB 1.50%, BB 2.80%, B 4.50%, CCC 9.00%, CC 16.00%).
- **Monthly**: interest `= line_drawn × rate ÷ 12`; undrawn fee `= (limit − line_drawn) × 0.25% ÷ 12`; interest on positive own cash `= own cash × (base_rate − 0.25%) ÷ 12` (3.6.5 savings).
- **Auto-draw**: if cash is below 0 after the month, draw the shortfall up to the limit. **Auto-repay**: per the plan (6.5).
- **Review** at 01:00 on release days: limit recomputed; a company over its new limit must repay the excess within 3 months (10.0.9), by auto-repay from cash first.
- **Implied rating** (3.6.3) from net debt ÷ EBITDA (EBITDA = EBIT + depreciation, trailing 4 quarters): below 0.5 AAA, 0.5 to 1 AA, 1 to 2 A, 2 to 3 BBB, 3 to 4 BB+, 4 to 5 BB-, 5 to 6.5 B, 6.5 to 8 CCC, above 8 or EBITDA negative CC. Adjustments: interest cover above 10 +1 notch, below 3 -1, below 1.5 -2; revenue above $20B +1, below $500M -1; utilities +1; mining and shipping -1. Ceiling: sovereign + 1 notch. The rating moves 1 notch per review toward implied, 2 if 3 or more away (3.6.4).
- **Distress, bankruptcy and removal (Logan, batch 145; timings T).** Forced asset sales, then frozen, then removed:
  1. **Forced sales (Distressed).** If cash is still below 0 with the line full, `distress_months += 1` and the unit sells assets at the sale factor until cash reaches 0. No dividends; purchases stop (g = −asset_decay at most). A month that ends with cash at or above 0 and the line within its limit resets distress_months to 0.
  2. **Bankrupt and frozen.** After **6 distress months**, or with no assets left, the company is **Bankrupt**: frozen for **2 quarters** (no revenue, no expenses, no decay, 10.0.2; its capacity leaves supply), delisted from quotes with the price set to $0.00, and **shareholders wiped**: equity is 0 and every holder's stake is worthless. It stays on screens and the map, marked Bankrupt.
  3. **Removed.** At the first release after its 2 frozen quarters, its remaining assets are sold at the Bust factor (0.60) to repay the line, any unpaid line is written off by the bank **(A)**, and the company is **removed from the game**: off lists, the map and the screens, its simple characters discarded. Its filings, price history and headlines stay in the archive **(A)**. Sold capacity leaves the game, like any MVP asset sale **(A)**.

### 5.13 Fair value (10.0.8, 3.3.1; conflict C8)

1. `E_norm = 0.6 × TTM net income + 0.4 × TTM × (1 + g)`, with g the 4-quarter revenue growth clamped -30% to +60% (3.3.1 step 1).
2. `Multiple = M_sector × G × R`, with `G = clamp(1 + 2.5 × (g − g_sector), 0.5, 2.5)` and `R = clamp(9% ÷ (y10 + 5%), 0.4, 1.6)`, `y10 = 3.5% + country_spread` **(A)**. Q and C factors are 1.0 in the MVP **(A)**.
3. `Fair value = 0.3 × book equity + 0.7 × E_norm × Multiple × cycle factor × confidence factor` (10.0.8), with cycle factor Boom 1.2, Normal 1.0, Glut 0.85, Bust 0.7.
4. Loss-makers (E_norm ≤ 0): `book equity × cycle factor` (10.0.8).
5. Floor: `0.6 × book equity` (0.9 for Real estate), and never below $0.01 per share (3.3.1 step 6).
6. Per share `V = fair value ÷ shares_out`. Private companies show `0.7 × fair value` as their value (10.5.4 private discount) **(A)**.

### 5.14 Share price, hourly (3.3.3, flow removed)

`P_next = P × (1 + 0.0003 × (V ÷ P − 1) + noise)`

- `noise = σh × (ρ × z_market + sqrt(1 − ρ²) × z_stock)`; `σh = annual volatility ÷ 19.1 ÷ sqrt(24)`; `ρ = min(0.8, 0.5 × beta)`; one z_market per tick for all stocks **(A: one world exchange)**; 2% of ticks draw from a distribution 3 times as wide (all from 3.3.2 and 3.3.3).
- Sentiment terms in V* are 0 except buzz: `V* = V × (1 + 0.10 × buzz ÷ 100)`.
- No order flow: nobody trades in the MVP.

### 5.15 Earnings jump (21.2, 21.3.1, 3.3.6)

- `s = (actual NI − consensus) ÷ |consensus|` (consensus 0 is treated as $1).
- At 01:00: `P ×= 1 + 1.5 × clamp(0.5 × s, −25%, +25%)`; `buzz += clamp(20 × s, −30, +30)`.
- Result types (21.3.2) are tagged for headlines only: Beat (s above +5%), Big beat (+20%), Miss (below -5%), Big miss (-20%), Loss, Record quarter.

### 5.16 Projections and consensus (21.5.1)

- At the plan lock the engine projects the quarter from the locked plan with current demand (no new rolls); `consensus = projection × (1 + e)`, e uniform ±5% **(T)**, so surprises come from news phases, cycles and noise.
- Shown range: `±30% × (1 − 0.6 × elapsed share) × (1 − 24 ÷ 50) × 0.7`, ×2 for companies whose plan is secret (all, for the observer), minimum ±3%.

### 5.17 Dividends (10.5.5, 3.3.2)

Paid at the plan lock from the last quarter: `dividend = payout ratio × NI` if NI is above 0 and own cash after it stays above the minimum cash (6.5). Payout ratio is the sector table's typical ratio × the archetype factor (6.5).

### 5.18 Industry news (10.0.6)

Each phase change posts one headline for the industry; each release posts the five largest beats and misses, bankruptcies and removals (5.12) and rating changes of 2+ notches; each raise and failed raise (6.6) posts one headline. MVP headlines come from a neutral **Pdoomberg Wire** byline, since outlets and slant are out of scope **(A)**.

---

## 5A. Conflicts and resolutions

Rule: the newest Logan ruling wins; where Logan has not ruled, the most recent doc wins, marked (A).

| # | Conflict | Resolution |
|---|---|---|
| C1 | 10.0.4 revenue model vs the operations layer (10.0.11, batches 140 to 142) and the break-even barebones company | 10.0.11 sits on top of 10.0.4 (Logan, batch 140): effective productivity = (productivity + PC bonus + location bonus) × M. The barebones break-even case is for founding only and is not used in the MVP |
| C2 | Batch 141 PC = quality factor Q vs batch 142 | Batch 142: PC per station is 1 × industry modifier |
| C3 | Data accrues every hourly tick (10.0.11.4) vs monthly finances (9.2) | Monthly, with the month's revenue (coordinator default) |
| C4 | 14.2.3 data rate (1 TB a day per $100M) and tier table vs 10.0.11 | 1 TB per $1M and the free R&D rule (batch 141) |
| C5 | 7-tier data ladder (batch 140) vs data quests | `(1 + floor(log10 TB))%` free R&D (batch 141) |
| C6 | 9.2 runs industry demand weekly vs 10.0.4 monthly | Monthly |
| C7 | 7-starting-world says the starting rate is about 1.75% (batch 129) | 3% (batch 130) |
| C8 | Fair value: 10.0.8 blend vs 3.3.1 earnings-multiple V with sales value for loss-makers | 10.0.8 blend (Logan, batch 53), using 3.3.1's E_norm, G and R factors and asset floor; loss-makers at book × cycle (10.0.8) |
| C9 | Loan rate: 3.6.5 "policy + corporate spread + 1.0" vs 10.0.9 and 10.5.5 "base + country spread + rating spread" | Base + country spread + rating spread (consistency pass 3, batch 129) |
| C10 | Credit line counts cash at 100%, so drawing raises its own limit | Count own cash only (cash − drawn) (A) |
| C11 | Depreciation at 10% of assets a year wipes out capital-heavy margins (Oil: 2.5 × 10% = 25% of revenue) | Depreciation equals asset decay (5 to 10% by industry, Logan batch 145) and is part of the fixed cost share; margin_full_use stays the margin before R&D (A, gap G3) |
| C12 | Supply uses productivity, revenue uses productivity + PC bonus, so S is not 1 at start | Supply uses p_pre (productivity + PC bonus + location bonus) (A) |
| C13 | Growth plan is "this year" (10.0.2) vs set each quarter (21.5) | Annual rate locked each quarter, bought monthly at 1/12 (21.5) |
| C14 | Charter board sizes 5 to 13 and elections (1.5, 1.8.1) vs labor units 1 to 5 (batch 142) | Labor rule only; no charter seats or elections in the MVP (A) |
| C15 | companies.csv est_value (margin × 0.75 × multiple, ignoring R&D) vs the engine's fair value | Engine fair value drives price; shares are set so the opening price is $25 at engine value; est_value is shown only as "2020 estimate" (A) |
| C16 | Starting loadout enterprise stations `ceil(0.5 × R ÷ 11)` ignores the industry data rate | `ceil(0.5 × R × data_tb_per_musd ÷ 10.95)` (A) |
| C17 | 12.1 says content is JSON | The MVP loads the design/data CSVs directly; JSON conversion is post-MVP (A) |

---

## 6. Lite AI rules

Every company runs the same rules at 9th 00:00 of each release month (21.7), in one batch, and at load. The AI only sets its own plan. Inputs:

| Input | Meaning |
|---|---|
| g_dem | Projected demand growth next 4 quarters: trend + cycle drift + news adj (Boom +5%, Glut −3%, Bust −5%) **(T)** |
| S | Current supply ratio of the unit's industry |
| ROA | Trailing 4-quarter EBIT ÷ gross assets |
| loss_q | Consecutive quarters of negative EBIT |
| liquidity | Own cash + undrawn line |
| min_cash | 5% of trailing annual revenue **(T)** |
| traits | The named controller's traits, if the controller is a character; else none |

### 6.1 Archetype (2.23.1)

| Condition, first match | Archetype | Hurdle ROA | Growth adj | R&D mult | Payout mult | Data coverage |
|---|---|---|---|---|---|---|
| control_basis = state | State champion | 6% | +2 pp | 1.0 | 1.0 | 50% |
| Revenue below $50M and industry is Tech | Startup | 12% | +4 pp | 1.2 | 0 | 100% |
| Controller has Ambitious or Brave | Aggressive grower | 8% | +5 pp | 1.3 | 0.5 | 100% |
| Controller has Greedy or Cautious | Cash cow | 15% | −3 pp | 0.7 | 1.3 | 25% |
| Otherwise (incl. widely held, subsidiary) | Incumbent | 10% | 0 | 1.0 | 1.0 | 50% |

All values **(T)**. A controller with both Ambitious and Greedy takes the first trait in its list **(A)**.

### 6.2 Growth plan (annual rate)

| Situation | Growth |
|---|---|
| loss_q ≥ 4 | −15% (selling down, 2.23.2) |
| loss_q 2 to 3 | −5% |
| ROA ≥ hurdle | `g_dem − 10 × max(0, S − 1) + archetype adj` |
| 0 ≤ ROA < hurdle | `min(2%, g_dem − 10 × max(0, S − 1))` |
| ROA < 0 and loss_q < 2 | 0% |

Then trait nudges: Ambitious +3 pp, Content −1 pp, Cautious −2 pp, Brave +1 pp, Visionary +1 pp in Tech **(T)**. Clamp −20% to +30%. **Funding cap**: the quarter's purchases (`gross_assets × (asset_decay + g) ÷ 4`, replacement plus growth, 5.10) may use at most 50% of liquidity above min_cash; scale g down to fit, but not below −asset_decay (no purchases).

### 6.3 R&D plan

`target = rd_norm × (archetype R&D mult + productivity adj) × trait mult`, where productivity adj is +0.25 below productivity 95, −0.2 above 110, else 0; trait mult: Greedy 0.8, Visionary 1.25, Conservative 0.9, Diligent 1.1 **(T)**. If loss_q ≥ 2, ×0.8 (never below 0.5 × rd_norm). `rd_plan = max(0, target − free_rd_pct)`, so held data saves cash. Clamp 0 to 3 × rd_norm.

### 6.4 Station split (labor L)

1. **Productivity stations P**: the largest 10^k (1, 10, 100, ...) that is at most 40% of L, minimum 1. Extra stations past a step give nothing, so the AI never staffs between steps.
2. **Enterprise stations E**: `ceil(coverage × monthly unstructured inflow ÷ 0.9125)`, capped at the labor left. Coverage from the archetype table.
3. **Research R**: Visionary controllers put 10% of what is left into research; others 0.
4. **Idle**: the rest. If idle would fall under 10% of L (and L ≥ 10), cut E first, then R, to keep 10% idle (decay 0.4).
5. **50/50**: used only when L = 1 and coverage is 100% (the CEO splits); otherwise the CEO's station is productivity.

### 6.5 Financing (credit line only) and dividend

| Situation | Action |
|---|---|
| Own cash after the quarter's planned purchases below min_cash | Draw the gap, up to the limit |
| Own cash above 2 × min_cash and line drawn | Repay `min(drawn, own cash − 1.5 × min_cash)` |
| Cautious or Greedy controller | Repay first: target drawn ≤ 25% of the limit before any dividend |
| Brave controller | May keep up to 75% of the limit drawn to fund growth |
| Dividend | 5.17, with the archetype payout mult |

At load, plans use g_dem for growth, rd_norm for R&D and the station split above.

### 6.6 Raising money in cash-burning industries (Logan, batch 146)

Logan (batch 146): Consumer electronics, EVs, E-commerce and AI labs lose money after R&D on purpose; they live on investor money ([10-industry-economy.md](../detailed/10-industry-economy.md) 10.3). So that they do not all go bankrupt in the read-only MVP, a company in one of these four **cash-burning industries** raises money when its cash runs short. Checked at the plan lock, after 6.2 to 6.4 and before 6.5, for Active and Distressed companies; one try per plan lock.

- **Burn**: minus the last quarter's free cash flow (operating cash less asset purchases, 3.9), when that is negative. With no burn there is no raise.
- **Runway**: `own cash ÷ burn`, in quarters. A raise starts when runway falls under **4 quarters (T)**.
- **Target**: `8 × burn − own cash`, enough for 8 quarters of runway **(T)**.
- **Method (A)**:
  1. **Credit line draw**, if rated: the rating is B or better (rating factor above 0, 5.12) and the undrawn line covers the target. The target is drawn now, ahead of need; no dilution; interest as in 5.12.
  2. Otherwise a **new share issue**, the follow-on offering of [3-markets-and-fx.md](../detailed/3-markets-and-fx.md) 3.4.3: issue price `= P × (1 − discount)`, with the 3.4.3 discount of 4% for large caps (market value $10B and up **(A)**) and 8% for small caps **(T)**; fees 3% of the gross raise (3.4.3: 2.5% to 4%) **(T)**; new shares capped at 20% of shares_out per raise, the 3.4.3 line above which holders must approve, since the MVP has no votes **(A)**; announcement effect `P ×= 1 − (2% + 0.5 × dilution%)` (3.4.3). Private companies place new shares with unnamed investors at their shown value (0.7 × V, 5.13) less 8%, with no price effect **(A)**. Rights issues on pre-emption exchanges (3.4.3) are not used, since the MVP has one world exchange **(A)**.
  - **Dilution**: shares_out rises by the new shares, which go to an unnamed **new investors** holder on the cap table; every existing holder's stake falls by `old shares ÷ new shares`. The controller stays the controller; control contests are out of scope **(A)**.
- **Success roll (T)**: `chance = 50% + 100 × (confidence factor − 1) + news adj + method adj − 10% × consecutive failed raises`, clamped 5% to 95%. Investor confidence is the confidence factor of 5.7 (0.8 to 1.2, so ±20 pp). News adj by the industry's news phase (5.1): Boom +30 pp, Normal 0, Glut −15 pp, Bust −35 pp. Method adj: credit line +20 pp, share issue 0.
- **Failure**: nothing is raised and the company tries again at the next plan lock. Until a raise succeeds, 6.2 holds g at −asset_decay (no purchases). When cash runs out with the line full, it enters the bankruptcy path of 5.12: forced sales, then Bankrupt and frozen with shareholders wiped, then removed.
- **Headline**: each raise and failed raise posts a Pdoomberg Wire headline (5.18).

---

## 7. Starting state

### 7.1 Each of the 651 companies (10.0.11.8)

R = revenue_usd_m. One business unit in the company's industry at hq_province.

**Starting data vs new companies (Logan, batch 146; batch 143 pick).** The 651 starting companies have been running for years, so they keep the generated starting data below: assets, seated boards, held unstructured and structured data, cash and line, rating and history. A company founded in play (post-MVP) starts empty: the barebones loadout, 0 TB held (10.0.11.1, 10.0.11.4, batch 142) and only the CEO seat.

| Item | Rule |
|---|---|
| Location bonus | From the HQ province's largest track and resource tag (5.4) |
| PC bonus, first pass | From the station rule at productivity 100 (iterate twice) |
| Gross assets | `R × capital_per_dollar × 100 ÷ (100 + PC bonus + location bonus)`, so the unit makes exactly R at M 1.0 |
| Ramping | None |
| Productivity | 100 **(A)** |
| Labor units | floor(gross ÷ labor_value), minimum 1 |
| Board | Seats 1 to min(5, L), each with a generated simple character (3.7.1); no charter seats beyond 5 in the MVP (C14) |
| Productivity stations | `max(1, round(0.25 × L))` (10.0.11.8); the AI's power-of-10 rule (6.4) applies from the first plan lock |
| Enterprise stations | `ceil(0.5 × R × data_tb_per_musd ÷ 10.95)` (C16); Arrowhead (CO-0001) uses 0.1 in place of 0.5 |
| Idle | The rest |
| Unstructured held | One month: `R × data_tb_per_musd ÷ 12` TB in the newest bucket |
| Structured held | Steady state (5.9) for converting `min(capacity, share × inflow)` a month, share 0.5 (Arrowhead 0.1) |
| Compute | 3.8 rules |
| Fixed cost rate | `f × turnover − asset_decay − shared costs ÷ gross` (5.5) |
| Asset book | `0.5 × gross` **(A)** |
| Cash and line | If book_value ≥ asset book: cash = book_value − asset book, line 0. Else line drawn = asset book − book_value + min_cash, cash = min_cash **(A)** |
| Rating | Implied rating from the starting run rate (5.12), no smoothing |
| Plan | 6.2 to 6.5 with g_dem; loss_q 0 |
| History | Four synthetic quarters at the run rate, for TTM and the Q4 2019 release **(A)** |
| Shares | Listed: `shares_out = fair value ÷ $25`; P = V = $25 **(A)** |
| Barebones exception | R below $0.1M: the barebones loadout (10.0.11.1): one $100,000 asset, 1 labor unit, CEO on productivity, 10 base and 10 data compute, 0 TB |

**Arrowhead check** (R $40M, Oil, Edmonton: Industry track 12 is largest but Oil is Extraction, resource tag Oil): location +3; labor_value $500,000; first pass PC bonus +2. Gross assets `40 × 2.5 × 100 ÷ 105 ≈ $95.2M`; 190 labor units; 48 productivity stations (PC 48, +2); 1 enterprise station; held structured data about 8.6 TB at start (1% free R&D, $0.4M), rising toward about 20 TB (2%) as its one station runs at capacity; about 141 idle (decay 0.3). Revenue $40M at M 1.0; EBIT before R&D about $11.2M, unchanged by asset decay (batch 145); holding its assets flat costs about $5.7M a year in replacement (6% of $95.2M).

### 7.2 Industry fringe pools (10.0.10)

`fringe_assets = max(0, world_size − Σ named R) ÷ turnover`. Named revenue is below world size in all 42 industries in companies.csv (checked: e.g. Oil $1.35T of $2.5T, Data centers $38B of $100B). With named units calibrated to R at M 1.0 and fringe at productivity 100, every industry starts at S = 1.0 and M = 1.0.

### 7.3 Countries and the world

Cycles from country-economy.csv with months left drawn in the phase's range; c0 recorded; base rate 3%; every industry Normal; clock 2020-01-01 00:00, paused.

---

## 8. Read-only screens

All built from 20-ui. Every action button is hidden or shows a lock icon with "Read-only MVP".

| Screen | Source | MVP content |
|---|---|---|
| **Main screen** | 20.2.1 | Top bar with date, hour, weekday, pause, speeds 1 to 5, Skip menu (next release, next plan lock, next recap, month end) and the **quarter clock** (phase name, days to next phase, 21.8); alert row; left rail with Company, Industries, Pdoomberg, Recap; outliner with a watchlist |
| **Map** | 20.7.10, 2.24 | Zoom World, Country, Province. Modes: **Political** (default); **Development** (Commerce, Industry, Population, Total); **Industry** (the Industry track, or with an industry picked, that industry's business assets by province as a heat map); **Company HQs** (pins sized by revenue, colored by sector; filters by industry, country, listed); **Economic cycle**; Metro outlines over any mode. Clicking a province opens a province card: development, resource, terrain, Metro, key city, HQs and units there |
| **Company** | 20.7.2 | Header: name, ticker, HQ, industry, owner of record, controller. Tabs: **Overview** (value, price, confidence, management score, cash, line, rating, next release); **Board** (seat cards for labor units 1 to 5, skill used); **Cap table** (static holders); **Units** (industry, base province, assets, productivity, growth, R&D, revenue, expenses); **Financials** (quarterly statements, Quarter view with last results and projection ranges, 21.5.3); **Tech** (labor split, stations, PC and next step, data quests card with progress bar, inflow vs decay, 10.0.11.7) |
| **Industries** | 20.7.6 | Table of 42: demand, supply, S, M, news phase, trend, fringe share, top 5 companies; detail view with a 20-quarter chart of demand vs supply and the company list |
| **Pdoomberg** | 20.5.2, 3.13.1 | Full-screen terminal. F2 Quotes (watchlists: All, by industry, by country, Disclosure radar hidden); F3 Chart (daily bars with the estimated fair value band, ±15% for listed companies, 3.14.2; true V is never shown); F4 Order shows "Read-only MVP"; F5 Filings (quarterly statements); F6 Ratings (credit ratings only); F7 Bonds (base rate and country spreads); F9 Industries; F10 Screener (read-only filters) |
| **Quarterly recap** | 20.7.9, 21.6.2 | Opens the pre-quarter-end week. World page: industries by phase, biggest expected beats and misses by projection. Company page (watchlist companies): anticipated earnings range, expected reaction, confidence, outlook (news phase, losses, rating watch). No guidance choice |
| **News feed** | 20.5.1 | Pdoomberg Wire headlines (5.18) with date and industry tag |
| **Time controls** | 9.1 | Pause (Space), speeds 1 to 5 (keys 1 to 5): 2 s, 1 s, 0.5 s, 0.2 s per hour and max; alerts: Earnings day (Pause), Quarterly recap (Pause), Plan lock (Log), Bankruptcy in watchlist (Notify), each settable Pause, Notify, Log, Off |

---

## 9. Engine API surface (GDExtension)

One engine object exposed through gdext (12.3). Queries read the last finished tick and never block; they return Dictionaries and Arrays (map layers return PackedArrays indexed by province ordinal).

### 9.1 Control

| Call | Returns |
|---|---|
| `new_game(seed: int)` | ok; loads data, builds the start state (section 7) |
| `set_speed(n: int)` (0 to 5), `pause()`, `resume()` | ok |
| `skip_to(kind: String)` (next_release, next_lock, next_recap, month_end) | Runs at max speed until that tick, then pauses |
| `get_clock()` | date, hour, speed, quarter_phase, days_to_next_phase |
| `save(path)`, `load(path)` | ok |

### 9.2 Queries

| Call | Returns |
|---|---|
| `list_countries(filter)` / `get_country(iso3)` | Rows / detail with cycle, tax, rating, spread, HQ count |
| `get_province(id)` | Province card: tracks, tags, Metro, key city, HQs, units with assets there |
| `get_map_layer(mode, param)` | PackedFloat32Array or PackedInt32Array per province, plus legend |
| `list_key_cities()` / `list_metros()` | Rows with province ids |
| `list_companies(filter)` | filter: industry, country, superregion, public, archetype, sort, limit, offset. Rows: id, name, ticker, industry, hq, revenue TTM, NI TTM, price, change, value, rating |
| `get_company(id)` | Header and Overview tab |
| `get_company_board(id)` / `get_company_cap_table(id)` | Seats / holders |
| `get_company_units(id)` | Units tab |
| `get_company_statements(id, period, count)` | period: month, quarter, year |
| `get_company_tech(id)` | Labor split, stations, PC, bonus, next step, data per industry |
| `get_company_projection(id)` | Locked plan, projection range, consensus |
| `list_industries()` / `get_industry(id)` | Table / detail with history and company list |
| `get_quotes(filter)` | Ticker, last, day change, volume 0, EFV, rating |
| `get_price_history(id, resolution, range)` | Bars |
| `get_filings(filter)` | Published statements by quarter |
| `get_rates()` | Base rate, country spreads, rating spreads |
| `get_news(since, filter)` | Headlines |
| `get_recap(scope)` | scope: world or a company id |

### 9.3 Signals

`tick_done(datetime)`, `day_done(date)`, `month_done(month)`, `earnings_released(quarter)`, `plan_locked(quarter)`, `alert(kind, payload)`, `paused(reason)`.

### 9.4 Query tables kept ready

| View | Refreshed |
|---|---|
| v_clock, v_quotes | Every tick |
| v_price_bars, v_news, v_projection | Daily |
| v_company_row, v_company_detail, v_units, v_tech, v_industry_row, v_industry_detail, v_map_layers (industry assets, HQs), v_province_card | Monthly, and on load |
| v_statements, v_filings, v_ratings, v_recap | Quarterly (compile, release, lock, recap days) |
| v_map_static (development, political, Metros, key cities) | Once at load |

Views carry dirty flags (12.3); only changed rows are rebuilt.

---

## 10. Build order

| # | Milestone | Done when |
|---|---|---|
| M0 | Data load and validation: the CSVs, industries.csv, country-economy.csv, key-cities.csv; id checks | Loader rejects a bad row with file and line; headless |
| M1 | Clock and scheduler: hourly ticks, daily, monthly, quarterly, yearly jobs; speeds and pause; seeded RNG streams | 10 years tick headless; job order matches section 4 |
| M2 | Economy core: demand, cycles, news phases, fringe, supply, S, M, revenue, expenses, productivity, growth | At load every industry has S 1.00 and named revenue matches companies.csv within 0.5% |
| M3 | Operations and data: labor, seats, stations, PC bonus, data create, convert, decay, free R&D | Arrowhead check (7.1) passes |
| M4 | Books: ledger, statements, tax, credit line, rating, dividends, asset decay, distress, bankruptcy and removal | Balance sheet balances every month for every company still in the game |
| M5 | Valuation and price: fair value, hourly price, earnings jump, reaction week | Opening price $25 at V; prices track V within ±30% over 10 years |
| M6 | Lite AI and the quarter loop: plan lock, consensus, projections, recap, news wire | A full year runs four releases, four locks, four recaps |
| M7 | GDExtension API and views; Godot shell: top bar, time controls, alerts | Godot runs the sim at all speeds; screens read views only |
| M8 | Map: geometry pipeline (gap G1), zoom, map modes, province card | All 3,255 provinces clickable |
| M9 | Screens: Company, Industries, Pdoomberg, Recap, News | Every section 8 screen opens in under 100 ms |
| M10 | Soak and balance: 30-year headless run, determinism replay | 30 years in under 2 minutes headless; same seed gives the same hashes; balance targets below |

**Balance targets after 10 years (T):** at least 85% of the 651 companies neither bankrupt nor removed; industry revenue within ±30% of the trend path; median productivity 90 to 110; no industry stuck at an M clamp for more than 8 quarters; 30% to 60% of releases are beats.

---

## 11. Gaps and open questions

The most important things the docs do not define well enough to build, each with a recommended answer or, where Logan has ruled, his decision.

| # | Gap | Recommended answer |
|---|---|---|
| G1 | **No province geometry.** The province files have no shapes or coordinates, so the map cannot be drawn | **Decided (Logan, batch 145):** province shapes are generated from real-world boundary data into a province-id bitmap and province-centroids.csv in tools/. Sources and method: [map-sources.md](map-sources.md) |
| G2 | **Board seats need about 2,700 people.** characters.csv has 296; most companies need up to 5 seated executives for the management score | **Decided (Logan, batch 145):** simple characters (3.7.1) are generated as needed to fill the seats: name, age, six skills by company size, one or two role traits, always the default choice. Named controllers stay off boards in the MVP and only nudge the AI through traits |
| G3 | **Depreciation vs margin** (C11). 10% a year on capital-heavy assets eats Oil, Utilities and Renewables margins whole | Depreciation now equals asset decay, 5 to 10% by industry (Logan, batch 145); it is part of the fixed cost share, and margin_full_use is the margin before R&D (5.5 profit check) |
| G4 | **Missing industry numbers**: Banking and Insurance capital ("uses deposits"), AI labs margin (-40% to +40%), per-industry R&D norms, "Positive" rate sensitivity | Banking capital 1.25, Insurance 0.60 (Logan's $1 and $0.50 base moved toward real capital ratios, batch 145, 2.2); AI labs margin 0%; the rd_norm table in 2.2; Positive treated as 0 until rates move |
| G5 | **Corporate tax, sovereign rating and spread are not in countries.csv** (2.2.5 says the tax is there) | Add country-economy.csv: majors from 2.2.3, havens 3%, others Moderate 21%; rating from the 3.6.3 points table; spread set to January 2020 levels |
| G6 | **Starting balance sheet and share count**: companies.csv has book equity but no cash, debt, asset book or shares | Asset book = 50% of gross; cash or line fills the gap to book equity; shares set so price opens at $25 at engine value |
| G7 | **Distress without the default chain**: the MVP has no bonds, creditors or restructuring | **Decided (Logan, batch 145):** forced asset sales at the cycle sale factor; after 6 months or no assets, Bankrupt and frozen for 2 quarters with shareholders wiped; then removed from the game (5.12; timings T) |
| G8 | **One unit per company, all at HQ**: companies.csv gives one industry and no asset spread, so diversified groups and multi-province spreads do not exist | **Decided (Logan, batch 145):** one business unit per company, at HQ, for the MVP. Post-MVP: business-units.csv (company, industry, share of revenue, province shares) so the map's industry layer shows real footprints |
| G9 | **Batch 143 board-seat items.** The board meeting chain (21.4) and the labor seats of batch 142 left open: board size beyond 5 seats, charter minimums under 5 labor units, election vs controller appointment, investor and government seats, and starting data (1-corporate-core 1.8.1); the grading formula, performance score and firing threshold (21.4.1 to 21.4.3, 21.9 items 6 to 8) | **Decided (Logan, batch 146; batch 143 picks):** charter seats beyond the 5 labor seats are ordinary directors with no labor unit; the charter minimum of 5 applies only from 5 labor units; when a seat opens the controller appoints and the appointee stands at the next yearly meeting; VC, strategic-investor and government seats take the next labor seat as it opens, or sit beyond 5 if all are full (1-corporate-core 1.8.1); the 651 starting companies keep their generated starting data and new companies start empty (7.1). The MVP still has no elections, firing or board play (C14); the grading, performance score and firing values stay as in 21.4 (T, 21.9) |
| G10 | **Thin margins after R&D at the norm.** margin_full_use minus rd_norm is negative for Consumer electronics (-2%), EVs (-6%), E-commerce (-1%) and AI labs (-15%), and about 0 for Autos, Aerospace and Robotics, so these start at or below break-even before interest. Older than batch 145; asset decay does not change EBIT | **Decided (Logan, batch 146):** intended. The four are cash-burning industries that live on investor money (10-industry-economy 10.3); their margins and rd_norm stay as they are. When runway falls under 4 quarters they raise money by a discounted share issue or, if rated, a credit line draw, with success set by investor confidence and the news phase; failures go down the bankruptcy path (6.6). Autos, Aerospace and Robotics are not cash-burning; check them in the M10 soak **(T)** |

### 11.1 Doc fixes needed (not made here)

Batch 145 made its own source edits: 1-corporate-core 1.1.0 (simple characters) and 10-industry-economy 10.0.4, 10.0.7, 10.0.11.1, 10.3 and 10.12 (asset decay, bank and insurer capital).

1. 7-starting-world header and 7.2: starting rate "about 1.75%" should be 3% (batch 130).
2. 10.0.11.8: the enterprise station rule should multiply by the industry data rate (C16).
3. 10.0.11.4: "accrues every hourly tick" vs monthly finances (C3); pick one.
4. 09-time-and-turns 9.2: industry demand is weekly there, monthly in 10.0.4 (C6).
5. 10.0.9: the credit line counts cash that the line itself provides (C10).
6. 3.6.5 bank loan rate (+1.0) vs 10.0.9 (C9).
7. data/README.md: provinces' column is `chokepoint`, not `chokepoint_exposure`; 2.2.5 says countries.csv has corporate tax, it does not (G5).
8. 10.0.4 and 10.10: say whether depreciation is inside the fixed cost share (C11).
9. 10.0.3: say whether supply uses productivity or productivity + PC bonus (C12).
