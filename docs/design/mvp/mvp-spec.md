# TechnoCapital20FF MVP spec: the map, the business system and a read-only economic sim

_Status: v0.14 (2026-10-20). Batch 160 (Logan): province weight factor G is now the square root of the GDP per head ratio, G = sqrt(country GDP per head / world GDP per head), with a 0.1 to 4 clamp as a safety only **(T)** (2-map 2.3.1, 2.5.3); the clamp touches only Vatican City; United States 2.53, China 0.95, India 0.43, Burundi 0.15 (lowest); country weights about $3.59T (United States), $1.73T (China), $516B (India); the 2-map 2.14 examples are restated (Penang still reaches city Presence only). No generator stores the weight, so no data changes. Influence is post-MVP. Batch 159 (Logan): (1a) province weight scales by GDP per head again: total development × $0.3B × G, G = country GDP per head / world GDP per head (countries.csv gdp_usd_bn / population_m; world about $11,209) clamped to 0.2 to 3 **(T)** (2-map 2.3.1, 2.5.3; United States and Canada at the 3 cap, India at the 0.2 floor); the 2-map 2.14 influence examples are restated. Influence is post-MVP, so no MVP rule reads it. (2b) characters.csv and companies.csv are regenerated with tools/world-gen (seed 136 kept) so the Black market HQ weight reads the batch 158 equality index: counts unchanged (651 companies, 296 characters: John, 95 rivals, 200 holders; 467 listed; 85 HQ countries; industries unchanged), John, Terry, Arrowhead Drilling (60% Terry) and every named rival unchanged; 36 generated companies and 34 generated holders differ (6 filler companies moved country, e.g. Lithuania to Luxembourg, Iran to Iraq); the load check is unchanged at 619 of 651 profitable, median margin 6.1%. Batch 158 (Logan): (1) bodyguards are gone from every doc; Logan: "wealth index should be like income inequality where 100 is everyone makes realistically the same amount and values like 10 being massive slavery or servitude." countries.csv wealth_index is now an equality index of 10 to 95, `clamp(round(140 − 2 × Gini), 20, 95)` minus a forced-labor penalty, with hand values for state forced labor and Gulf kafala labor (**T** formula, **A** sources; tools/mvp-data/equality_index.py); no rule multiplies a cost by it, and every post-MVP rule that used WI, PF or the wealth index as a price now uses flat prices (**A**); unrated-country ratings read GDP per head (same ratings). (2a) exchange confidence nudges fair value: `X = 1 + 0.10 × confidence_z ÷ 100`, up to ±10% at the extremes (**T**), applied in 5.13 alongside the C factor (5.1.2, 5.13, C27, G11). Batch 157 (Logan): (1ab) each zone keeps a fixed base credit spread (credit_spread_bps) and a quarterly cycle term moves it around that base, scaled by the zone's intensity (**A** for the reading, **T** for k 8 and the 0.5x to 2x clamp); (2a) investor confidence is one value per zone exchange, starting at confidence_start and moved daily by its headline index and news; (3) no geographic wage: Logan: "we don't have wage value we have labor_value that is it. This is bound to industry not geography." wage_level and price_level are removed from financial-zones.csv, and wealth_index is not a wage index (5.1.2, 5.12, C25 to C27, G11). Batch 156 (Logan): corporate tax stays national (1a); zone values are set directly per zone, seeded from member countries (2a); a company borrows at a home spread blended half and half from its zone's credit spread and its home country's sovereign spread (3b), `home_spread = 0.5 × zone credit_spread + 0.5 × sovereign_spread`, used by the credit line rate and the fair value y10 (5.1.2, 5.12, 5.13, C23, C24, G11 decided) **(A for y10)**. Batch 155 (Logan): economy settings apply per financial zone, not per country. Logan: "Things that we were traditionally applying to a countries economy we are no apply across and entire financial zone." Each of the 26 zones now holds the economy settings: wage level, price level, the credit spread companies borrow at, the starting market confidence of its exchange, plus the cycle intensity, lag, contagion, GDP and exchange it already had; government settings stay national (corporate tax, sovereign rating and spread, laws, sanctions, politics; batch 121) **(A)**. Zone values are set directly per zone, seeded from GDP-weighted averages of the members' old country values **(T)**. The credit line rate and the fair value R factor read the zone credit spread; country-economy.csv's country_spread_bps becomes sovereign_spread_bps, the government's own spread; new financial-zones.csv columns wage_level, price_level, credit_spread_bps and confidence_start (1, 2.2, 3.2, 3.2.1, 5.1.2 new, 5.12, 5.13, 5A C23 to C28, 7.3, 8, 9.2, 11 G11). Batch 154 (Logan): Japan zone (with Taiwan), Russia zone. Logan: "Taiwan goes with Japan, Japan gets its own. Russia should have its own zone." Zone 25 Japan (Tokyo, ESE Edo Securities Exchange, until then the HRX Tokyo board; Japan and Taiwan) and zone 26 Russia (Moscow, YRX Yauza River Exchange; Russia and Belarus, A); 26 zones, Z 1.07 (5.1). Batch 153 (Logan): Macau gets its own country row (MAC, a Chinese special region like Hong Kong; province MO-0001, zone 11; 211 countries), and the AI boom uplift (Q2) and the Cloud and Data centers pre-boom growth (Q3) are decided (5.1.1, 11.2). Batch 152 (Logan): 24 financial zones, each with an exchange in a hub city. Logan's 24 zones replace the 8 of batch 150; each has one exchange in a hub city that is a key city (8 hubs added to key-cities), every country is in exactly one zone, and each zone has an intensity, a lag and contagion **(T)**; Cuba and North Korea are isolated (0.3, own shocks); Japan, Taiwan and Russia are placed provisionally (A); Z becomes 1.08; 3-markets' exchange list becomes the 24 zone exchanges and each listed company lists on its HQ country's zone exchange (1, 2.2, 3.1, 5.1, 5.14, 5A C19 and C22, 8, 9.2). Batch 151 (Logan): AI boom moves to 2030, bubble to 2040 on average; AI starts tiny with low growth, then unprecedented growth. "AI boom I think we are moving to 2030 start now bubble in 2040. I think we need to do really small AI with low growth then an unprecedented growth rate." AI labs' long-term rate is a regime switch (new 5.1.1): 5% a year before the boom (world size about $5B to $8B), then a scripted boom event on 1 Jan 2030 sets it to 100% a year for two years, tapering to 15% by 2039; the scripted pop (2040 plus a roll of -2 to +2 years, rolled quarter) cuts demand once by crash_drop (AI labs 50%) and sets -10% for 8 quarters, then 8%; Data centers, Semiconductors and Cloud get a boom uplift of 0.15, 0.10 and 0.05 of the AI labs boom **(A, T)**; the quarterly draw now uses `lt_q = (1 + LT)^(1/4) - 1` instead of LT/4 so 100% a year compounds right, and the checks report compound yearly growth; new industries.csv columns boom_uplift and crash_drop and new data/ai-boom.csv; the crash's demand side is now in scope (1, 2.2, 3.1, 3.4, 4.3, 5.1, 5.1.1, 6.2, 7.3, 8, 9.2, 10). Batch 150 Q1 (1a, volatility 1% a quarter) and Q3 (3a, the euro crisis shows only through the euro area intensity and ratings and spreads) are confirmed as written (5.1, 7.3); Q2 keeps the asymmetric cycle. Batch 150 (Logan): global business cycle, financial zones, mean-reverting industry growth. "Global business cycle. Intensity is felt differently by different financial zones. Industries do cycles just like the global cycle however they are offset by their industry growth rate." One global cycle (Expansion, Overheating, Contraction, Recovery, with a cycle value g_t) replaces the national cycles; 8 financial zones feel it at intensities 0.9 to 1.4 **(A, T)**, and world industry demand feels their GDP-weighted average, 1.10; each quarter every industry draws its growth around its long-term rate (trend_growth), mean-reverting, plus an asymmetric cycle term that lets high-growth industries grow more in upswings and cool off less in downturns, plus a volatility shock (new column, 1% a quarter for all **(T)**); Boom, Normal, Glut and Bust are now labels read from growth and the supply ratio, with no demand multipliers of their own; demand moves monthly by a third of the quarter's growth; new data/financial-zones.csv and country-economy financial_zone replace cycle_group and cycle_phase_start (1, 2.2, 3, 4.3, 5.1 to 5.3, 5.16, 5A C19 to C21, 6, 7.3, 8, 9.2, 10). Batch 149 (Logan): asset decay 1% a year above $10M of assets. "Asset decay 1% a year, only kicks in after 10 million assets": business asset decay is 1% a year for all industries (MVP default), on the part of a unit's gross assets above $10M only (marginal, no cliff; **A**), so $50M of assets decays $400k a year and a unit with $10M or less, such as the $100,000 barebones company, has none; book depreciation still equals decay and growth spending replaces decay first; new column asset_decay_threshold_usd (2.2, 5.5, 5.10, 5A C11, 6.2, 7.1). The start profit picture is unchanged (619 of 651 profitable, median 6.1%), since depreciation sits inside the fixed cost share; fixed cash rises to fill it and replacement spending falls about tenfold (2.2 checks). Batch 148 (Logan): "just make these like default companies for now we will rework them one by one once companies are known working. I want all industries to be like the defaults": all 42 industries use the barebones company's parameters (10.0.11.1) for the MVP: $1 of assets per $1 of revenue, labor_value $100,000, 1 TB per $1M, one asset decay (8%), one R&D norm (5%), one fixed cost share, one earnings multiple, one cycle sensitivity, and revenue equal to expenses at productivity 100 and M 1.0 with R&D at the norm counted in the expenses; industries keep only name, sector label, world demand 2020, trend and asset label (2.2, 5.5, C18); the cash_burning flags are parked (all N) and the 6.6 raise rule waits for them; per-industry tuning moves to 11.2; real 2020 tax rates, the wage index from wealth_index and real January 2020 ratings moved for the alternate history are decided (2.2, G5). At start 619 of 651 companies earn above 0 after R&D, from the PC bonus and free R&D only (2.2 checks). Batch 147 (Logan): built industries, country-economy and key-cities data: the three 2.2 tables now exist in design/data/, made by a reproducible generator in [../tools/mvp-data/](../tools/mvp-data/gen.py) that validates ids and runs the profit and fringe checks; 2.2 lists their final columns (G5 built). Batch 146 (Logan): Consumer electronics, EVs, E-commerce and AI labs are cash-burning industries on purpose and live on investor money; when their runway falls under 4 quarters they raise money by a discounted share issue or, if rated, a credit line draw, with success set by investor confidence and the industry news phase, and failures go down the bankruptcy path (6.6, G10 decided); batch 143 board-seat picks decided: seats beyond 5 are ordinary directors, charter minimums apply from 5 labor units, the controller appoints and the seat stands at the next yearly meeting, investor and government seats take the next labor seat or sit beyond 5, and the 651 starting companies keep their generated starting data while new companies start empty (7.1, G9 decided). Batch 145 (Logan): province shapes are generated from real-world boundary data ([map-sources.md](map-sources.md), 2.2, G1); simple characters fill board seats (3.7.1, G2); business assets degrade by industry, book depreciation equals the loss, and growth plans buy replacement before growth (2.2, 5.5, 5.10, 6.2, 7.1); bank and insurer capital set at $1.25 and $0.60 per $1, mapped to real capital ratios (2.2, G4); bankrupt firms go through forced sales, a 2-quarter freeze and removal, shareholders wiped (5.12, G7); one business unit per company at HQ is decided (G8); batch 143 board-seat items listed as open (G9). Built from Logan's MVP scope (2026-10-20) and the coordinator's defaults. Sources: [10-industry-economy.md](../detailed/10-industry-economy.md) (10.0 to 10.6, 10.0.11 operations, batches 140 to 144), [21-quarterly-cycle.md](../detailed/21-quarterly-cycle.md), [3-markets-and-fx.md](../detailed/3-markets-and-fx.md) 3.1, 3.3, 3.6, 3.9, 3.13, 3.14, [2-map-and-influence.md](../detailed/2-map-and-influence.md) 2.2, 2.3, 2.18, 2.23, 2.24, [20-ui.md](../detailed/20-ui.md), [../09-time-and-turns.md](../09-time-and-turns.md), [../12-tech-and-roadmap.md](../12-tech-and-roadmap.md) and the data in [../data/](../data/README.md). Where it fills a hole in the docs it marks the answer (A) or (T) and lists it in sections 5A and 11._

**How to read the numbers.** **(A)** marks an assumption made for the MVP, including the coordinator's defaults. **(T)** marks a tuning value. Section refs like 10.0.4 point to the detailed files.

---

## 1. Purpose and scope

Logan (2026-10-20): "For MVP I want to just have the Design Docs for the Map and the Business system with a read only economic sim with lite AI that just affect the company."

The MVP proves one thing: the 651 starting companies can run on their own, quarter after quarter, on the real map, and the numbers they produce (revenue, productivity, data, statements, fair value, price) stay believable. The player watches; nobody plays.

| | In scope | Out of scope |
|---|---|---|
| **Player** | Opens every MVP screen; pause and speeds 1 to 5; skip to next event **(A)** | Every player action: trading, founding, schemes, board seats, travel, the phone, quests |
| **Map** | 3,255 provinces, 211 countries, regions, areas, 97 Metros, 88 key cities, 8 superregions (design/data/) | Influence, real estate pools, development change, chokepoint risk, travel, unrest |
| **Companies** | 651 companies (data/companies.csv), one business unit each at HQ (decided, Logan batch 145), board as labor units 1 to 5 filled by simple characters (3.7.1) | Subsidiary directives, shells, deals on units, takeovers, IPOs, characters' personal play |
| **Economy** | 42 industries on shared default parameters (batch 148, 2.2), world demand, supply ratio, market factor, fringe pools, productivity, decay, R&D, growth plans | Price indices and cost drivers (D fixed at 1.0) **(A)**, real estate, slop, chokepoints, tariffs |
| **Operations and data** | Labor units, stations, productive compute, unstructured and structured data, conversion, decay, free R&D (10.0.11) | Schemes, software design stations, software development (14), AI models (18), hacking, data sales |
| **Software** | Two fixed products: the general productivity software and the general enterprise software, both quality 50 **(A)** | Every other product, licences as a market, bloat, versions |
| **Quarter** | The 21 cycle, simplified: release, price reaction, AI plan lock, locked quarter, recap week | Grades, firing votes, board displeasure, board day events, guidance rolls, result plot line chains |
| **Finance** | Light statements, tax, credit line, credit rating, dividends by rule, fair value, simple share price; share issues by cash-burning industries (6.6) are parked while no industry is flagged (batch 148) | Trading, order flow, bonds, margin, short selling, IPOs, buybacks, rights issues, default chain |
| **World** | Static country table; one world base rate (3%, batch 130); one global business cycle felt by 26 financial zones, each with an exchange in a hub city (batches 152 and 154), which also hold the economy settings (credit spread, market confidence; batch 155, 5.1.2; wage and price level removed, batch 157); quarterly industry growth draws with phase labels (batch 150); the scripted AI boom (1 Jan 2030) and bubble pop (2040 on average) as switches of the long-term rate (batch 151, 5.1.1) | Politics beyond the static table, media, gambling, vices, FX, the crash's market, quest and event effects beyond demand (8.5), other history events |
| **AI** | Each company sets its own quarterly plan (growth, R&D %, station split, data handling, credit line, dividend); cash-burning industries raise money when runway runs short (6.6, parked while no industry is flagged, batch 148) | Schemes, politics, takeovers, trading, media, anything outside its own company |

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

### 2.2 New MVP data tables (built, batch 147)

Built by `python3 design/tools/mvp-data/gen.py` (plain Python, no randomness), which writes the three files, financial-zones.csv (batch 150) and ai-boom.csv (batch 151) into design/data/ and runs validate.py: industry names match companies.csv, every iso3 is in countries.csv, every country's financial zone exists, every country is in exactly one zone, every hub province exists, every hub city is in key-cities.csv (batch 152), every key city province id is in the province files, and the checks below, including the seeded 40-quarter growth check of 5.1. Column meanings and assumptions are also in [../data/README.md](../data/README.md).

**industries.csv** (42 rows). **MVP defaults (Logan, batch 148):** "just make these like default companies for now we will rework them one by one once companies are known working. I want all industries to be like the defaults." Every industry uses the same parameters, those of the barebones company (10-industry-economy 10.0.11.1 and the 10.0.11.10 base case). An industry keeps only what makes it a distinct market: name, sector label, world demand 2020, trend growth and the flavor asset label. The columns stay as built in batch 147, so the engine and the rest of this spec read them unchanged; the per-industry values are parked for the rework (11.2), and gen.py keeps them behind a `PER_INDUSTRY` switch.

| Column | Type | MVP value (batch 148) |
|---|---|---|
| id | slug | e.g. oil, semiconductors, fast_food (per industry) |
| name | text | Per industry (10.3) |
| sector | text | Per industry: Tech, Finance, Energy, Industry, Consumer, Health, Services (10.3). A label for screens; it also picks the Startup archetype (6.1) and the Tech CTO weight (5.7) |
| valuation_group | text | Default (one multiple for all) |
| world_size_2020_usd_bn | number | Per industry (10.3 world size) |
| trend_growth | fraction | Per industry (10.3). The **long-term growth rate** a year before the AI boom: quarterly growth draws revert to it (5.1, batch 150). AI labs 0.05, really small with low growth until the 2030 boom (Logan, batch 151; was 0.30); the boom moves LT by the ai-boom.csv schedule (5.1.1) |
| cycle_beta | number | 1.0 for all: multiplies the cycle term of the quarterly growth draw (5.1) **(A)** |
| volatility | fraction | 0.01 for all: the standard deviation of the quarterly growth shock, per quarter (Logan, batch 150, confirmed batch 151 1a; 5.1) **(T)**. New column |
| boom_uplift | fraction | Share of the AI labs boom added to this industry's LT (5.1.1, batch 151): AI labs 1, Data centers 0.15, Semiconductors 0.10, Cloud 0.05, others 0 **(A, T)**. New column |
| crash_drop | fraction | One-off demand cut at the bubble pop (5.1.1, batch 151): AI labs 0.50, Data centers 0.25, Semiconductors 0.20, Cloud 0.10, others 0 **(T)**. New column |
| rate_sensitivity | 0 to 3 | 1 for all **(A)**; no effect while the base rate sits at neutral (3.1) |
| margin_full_use | fraction | 0.05 for all: the margin before R&D, equal to rd_norm, so revenue equals expenses with R&D at the norm (5.5, C18) |
| fixed_cost_share | fraction | 0.45 for all (the median f of 10.3) **(T)** |
| variable_cost_share | fraction | 0.50: v = 1 − margin_full_use − fixed_cost_share (5.5) |
| capital_per_dollar | number | 1.0 for all: the barebones $100,000 asset makes $100,000 a year |
| asset_turnover | number | 1.0 (1 ÷ capital_per_dollar) |
| asset_decay | fraction | 0.01 for all: 1% a year on the part of a unit's gross assets above asset_decay_threshold_usd (Logan, batch 149; 5.10) |
| asset_decay_threshold_usd | number | 10,000,000 for all: no decay on the first $10M of a unit's gross assets (Logan, batch 149). Marginal, so there is no cliff at $10M **(A)** |
| rd_norm | fraction | 0.05 for all **(T)** |
| labor_value_usd | number | 100,000 (10.0.11.10 base case) |
| pc_modifier | number | 1 |
| data_tb_per_musd | number | 1 (1 TB per $1M) |
| data_decay_base | fraction | 0.02 |
| fit | enum | Empty: no fit, so no location bonus in the MVP (5.4) |
| resource_tags | list | Empty |
| asset_label | text | Per industry: flavor label (10.0.7): fields, fabs, stores... |
| cash_burning | Y/N | N for all: parked (batch 148). The 6.6 raise rule stays for when the flags return in the rework |
| earnings_multiple | number | 17 for all (the median M_sector of the 42 industries in 3.3.2) **(T)**, used in 5.13 |
| notes | text | "MVP defaults (Logan, batch 148)", plus the trend notes |

**Built-table checks (batch 148).** validate.py runs a normal company per industry (median named revenue, the 7.1 loadout, productivity 100, M 1.0) and every one of the 651 starting companies. Fixed_cost_rate (5.5) is 0.38 to 0.449 (median 0.439) across the 651 starting companies, since decay is 1% above $10M only (batch 149); 593 of the 651 start above $10M. With R&D at the norm and no bonus a company breaks even, so every industry shows 0% EBIT at the norm. **Profit at start comes only from productivity above 100, undersupply and free R&D:** demand starts at S = 1.0 and M = 1.0 (7.2) and location bonuses are 0, so at load only the PC bonus (+1 to +7, +5 for the median company, worth `0.45 × bonus ÷ (100 + bonus)` of revenue, about 2% at +5, since gross assets are set so the unit makes R with its bonus, 7.1) and free R&D from held data (1 to 6% of revenue, replacing paid R&D, 6.3) give profit. **619 of the 651 companies earn above 0 after R&D at load**, median EBIT margin 6.1%, top 7.9% (rerun for batch 149: unchanged, since depreciation sits inside the fixed share and fixed cash takes up what decay gives back, 5.5). The 32 loss-makers (down to −2.5%) are small companies whose named controller pushes R&D above the norm (Aggressive grower 1.3×, Visionary, Diligent: 6.5 to 9% of revenue) with little held data; at the norm R&D all 651 earn above 0, so the economy is not loss-making by default. Margins are thin: productivity decays about 6 points a year at the norm (5.6), so profit holds only while R&D, data and the PC bonus keep productivity above 100; check in the M10 soak **(T)**. Named revenue is below world size in every industry, so named revenue plus the fringe pool equals world demand; the named share runs from 0.02% (Black market) to 80% (Social media), median 34%.

**country-economy.csv** (211 rows, one per countries.csv row; gap G5). Since batch 155 it holds only the national, government side: tax, the sovereign rating and spread, and the zone the country belongs to. Economy settings are on the zone (financial-zones.csv, 5.1.2).

| Column | Meaning |
|---|---|
| iso3 | Key into countries.csv |
| corp_tax_level | Haven, Low, Moderate, High (E2, 4-politics): the law position politics will move post-MVP. The 33 majors copy 2.2.3; the 8 havens of 2.2.5 are Haven; others take the E2 band nearest their real rate **(A)** |
| corp_tax_rate | The rate the MVP charges (5.11): the real 2020 statutory rate, national plus typical sub-national (Tax Foundation and KPMG 2020 tables, entered by hand; worth a spot check). **Decided (Logan, batch 148, 2a):** keep the real 2020 rates. Havens (2.2.5) use the E2 Haven rate 0.03; zero-tax countries (UAE, Bahrain, Bahamas, Vanuatu, Vatican) are floored at 0.03; 10 countries with no reliable figure use the Moderate rate 0.21 **(A)**. Where a major's real rate sits nearer another band than its 2.2.3 level (US 25.8%, France 32%, Switzerland 21.1%...), the level is kept and the notes say so. Excess Profits is not used at start |
| sovereign_rating | AAA to CC on the 3.6.2 scale: real January 2020 agency ratings moved for the alternate history (euro crisis, Greece's 2019 default, Russia's sanctions, a stronger US Middle East; notes say which); **decided (Logan, batch 148, 4a)**. The 3.6.3 points table needs debt, deficit, inflation and stability, which are not in the data, so it is not used at start **(A)**. Unrated countries: CCC if collapsed (HSS 35), else by GDP per head (A $48k+, BBB- $18k+, BB- $6.6k+, B+ $2.35k+, else B-; batch 158 restated the old wealth index cut-offs, same ratings) **(A)** |
| sovereign_spread_bps | **Renamed from country_spread_bps (batch 155).** The government's own fixed spread over the world base rate (3.6.5): the 3.6.2 sovereign spread for the rating (a plus or minus notch moves a third of the way to the next band) plus a crisis premium of 50 to 200 bps for Greece, Italy, Spain, Portugal, Cyprus, Argentina, Venezuela and Lebanon; US 0 **(T)**. Companies borrow at half of it plus half their zone spread (batch 156); it seeds its zone's credit_spread_bps (5.1.2) and is kept for government bonds post-MVP and the F7 Bonds screen |
| financial_zone | One of the 26 zones of financial-zones.csv (Logan, batches 152 and 154; 5.1), replacing the 8 of batch 150. Every country is in exactly one zone, the nearest sensible one **(A)**: gen.py lists each zone's members (ZONE_MEMBERS), and the notes say where a placement is assumed (Greenland and Saint Pierre and Miquelon with the EU; the British havens with the UK; Liechtenstein with Switzerland; China's debt vassals with China; Belarus with Russia, batch 154). Replaces cycle_group and cycle_phase_start, since national cycles are gone |
| notes | Where each value came from and what is assumed |

**financial-zones.csv** (26 rows: 24 from batch 152, replacing the 8 of batch 150, and 2 from batch 154; written by gen.py from its ZONES table). Columns: zone_id, number (Logan's 1 to 26), name, hub_city (a key-cities.csv city), hub_province (where the exchange sits), exchange_code, exchange and headline_index (3-markets 3.2.1), intensity, lag_quarters, contagion and own_shock_sd (5.1, **T**), extra_provinces (provinces of another country's row that belong to the zone; empty since Macau got its own row in batch 153), countries (member count), gdp_usd_bn and gdp_share (from countries.csv), and since batch 155 the zone economy (5.1.2): credit_spread_bps (the base spread) and confidence_start, then notes. Batch 157 removed wage_level and price_level. The zones are listed in 5.1 and their economy values in 5.1.2.

**ai-boom.csv** (15 rows, new in batch 151; written by gen.py from its AI_BOOM table). Columns: stage (preboom, boom, pop, bust, postcrash), boom_year (years since the boom event, for boom rows), default_year, ai_labs_lt (AI labs' long-term rate a year, **T**), notes. The schedule is listed in 5.1.1.

**No wage level (batch 157).** Logan: "we don't have wage value we have labor_value that is it. This is bound to industry not geography." There is no geographic wage or price level: labor is counted by labor_value (industries.csv labor_value_usd, $100,000 for every industry in the MVP), which belongs to the industry, not the country or zone. Batch 155's zone wage_level and price_level are removed. countries.csv keeps wealth_index, since batch 158 an equality index (100 everyone earns about the same, 10 massive slavery or servitude); it is not a wage, a price level or a wealth measure, and no formula reads it as a cost. Unrated-country ratings read GDP per head (batch 158). There is **no country or zone productivity modifier**: the location bonus is per province (fit and resource tag, 5.4; 0 in the MVP while industries use the defaults), and city bonuses are the key-city perks below, not applied in the MVP **(A)**.

**key-cities.csv** (88 rows, parsed from 2-map 2.3.3 to 2.3.5 by the generator, so the doc stays the source; the 8 financial zone hubs that were not key cities were added in batch 152 with no perks). Location perks are not applied in the MVP **(A)**; key cities show as map labels and filters.

| Column | Meaning |
|---|---|
| id | KC-01 to KC-80, in 2.3.3 order (new) |
| city | 2.3.3 name |
| country | iso3 (2.3.3 gives the country name) |
| province_ids | Semicolon list, ranges in 2.3.3 expanded (US-0086 to US-0089 becomes four ids) |
| specialties | Semicolon list of the 42 industries: the industries of the 2.3.4 row; for the 40 cities with no 2.3.4 row (8 of them the batch 152 hubs), read from the 2.3.3 specialties text, leaving out non-industries such as media, exchanges, government and textiles **(A)** |
| specialties_text | The 2.3.3 specialties text, as written (new) |
| signature_assets | The 2.3.4 text; for the 40 cities without a 2.3.4 row, the specialties above **(A)** |
| has_perk | Y if the city has a 2.3.5 row (47 cities) |
| perk_achieve, perk_get | The 2.3.5 "Achieve" and "Get" text (new) |
| notes | Assumptions |

**province-geometry** (still to build, not part of batch 147; gap G1): a province-id bitmap (one color per province id, EU4 style) plus province-centroids.csv (id, lat, lon, label_x, label_y). Without it the map cannot draw. Province shapes are generated from real-world boundary data (Logan, batch 145); sources and method are in [map-sources.md](map-sources.md).

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
| cycle_phase, cycle_quarters_left | enum, u32 | Global cycle phase and quarters left in it (5.1, batch 150) |
| g_t | fraction | Global cycle value: the phase's push on demand growth, a year, for a zone of intensity 1.0 (5.1) |
| zone_intensity_avg Z | fraction | GDP-weighted average zone intensity, 1.07 at the 2020 data with the 26 zones (batch 154; 1.08 with the 24 of batch 152); static in the MVP (5.1) |
| ai_stage, boom_date, pop_date | enum, date, date | Preboom, Boom, Bust or Postcrash; the boom event date (1 Jan 2030) and the pop date rolled at load (5.1.1, batch 151) |
| quarter_phase | enum | Release, Reaction, Locked, PreQuarterEnd (21.1) |
| rng_streams | seeds | One stream per system: cycle, growth (the quarterly draws), prices, AI, gen (12.3) |

### 3.2 Country (static)

| Field | Meaning |
|---|---|
| iso3, name, superregion, gdp, population, wealth_index | From countries.csv |
| corp_tax_rate, sovereign_rating, sovereign_spread | From country-economy.csv: the national, government side (batch 155) |
| financial_zone | From country-economy.csv; the zone's intensity and effect (`intensity × g_t`) are read from the zone (5.1, batch 150), and so are its economy settings (5.1.2, batch 155). Countries have no cycle or economy settings of their own |

### 3.2.1 Financial zone (static, batch 155)

| Field | Meaning |
|---|---|
| zone_id, number, name, hub_city, hub_province, exchange_code | From financial-zones.csv |
| intensity, lag_quarters, contagion, own_shock_sd | The cycle settings (5.1) |
| gdp, gdp_share | Sum of the members' GDP; the weights of Z (5.1) |
| credit_spread_base, credit_spread, confidence_start, confidence | The zone economy (5.1.2). credit_spread_base is financial-zones.csv credit_spread_bps; credit_spread is the effective spread, recomputed each quarter from the base and the zone effect (batch 157), and read by the credit line rate (5.12) and the fair value R factor (5.13); confidence is the exchange's investor confidence, starting at confidence_start and moved daily (batch 157); since batch 158 it nudges the fair value of companies listed there (X factor, 5.13) |

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
| lt | This quarter's long-term rate: trend_growth plus the boom term (5.1.1, batch 151) |
| trend_demand | Yearly demand on the long-term rate alone, for screens and the balance targets (5.1) |
| demand_core, demand | Yearly demand moved by the quarterly growth draws; effective demand after the rate term (5.1) |
| q_growth, prev_q_growth | This quarter's and last quarter's demand growth, per quarter (5.1, batch 150) |
| phase_label | Boom, Normal, Glut or Bust, read from q_growth and S (5.1); a label, with no demand multiplier |
| fringe_assets | Fringe pool business assets (10.0.10) |
| supply, supply_ratio S, market_factor M | 10.0.3 |
| published | Last month's demand, supply, S, M, q_growth and phase label, for screens |

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
| 1 | **Quarterly draw**, on 1 Jan, Apr, Jul and Oct only: scripted AI events due today fire first (the boom on 1 Jan 2030, the pop on its rolled date) and every industry's lt is set (5.1.1, batch 151); the global cycle advances one quarter (new phase and g_t when it expires) and every zone's effective credit spread is recomputed (5.1.2, batch 157), then every industry draws its q_growth for the new quarter (batch 150) | 5.1, 5.1.1 |
| 2 | Industry demand moves by a third of the quarter's growth; rate term; phase labels from q_growth and last month's S | 5.1 |
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

The quarterly growth draw runs inside the monthly job at 00:00 on 1 January, April, July and October (4.3 step 1), before Close and compile, so each quarter's growth is known before its plan lock on the 9th **(A)**.

The first quarter is special: the game starts 1 Jan 2020 00:00 with plans set at load (section 6). The 2 Jan 2020 release publishes a **synthetic Q4 2019** built from the starting run rate (revenue ÷ 4 and so on) **(A)**, and 1 January 2020 is a market holiday. The pre-quarter-end week starts 7 days before the next release: 26 March, 25 June, 25 September and 26 December (21.1).

### 4.5 Yearly (1 January 00:00, after the Q4 close)

1. Compile the annual statements (sum of four quarters); the 2 January release carries them.
2. Archive: keep 20 quarters of statements and 10 years of daily bars per company **(T)**.
3. Nothing else: development, populations and countries are static in the MVP **(A)**.

---

## 5. Formulas

All yearly figures are booked monthly as ÷ 12 (10.0.11.1). Money is in USD.

### 5.1 Demand: global business cycle and industry growth (Logan, batch 150; 10.0.3, 10.0.6, 2.18)

Logan (batch 150): "Global business cycle. Intensity is felt differently by different financial zones. Industries do cycles just like the global cycle however they are offset by their industry growth rate. So will grow more and cool off less during these times. Industries have growth rates that are long term and stable, their quarterly growth rate with go up and down based on the industries volatility, the overall business cycle, but still average toward the long term rate."

This replaces the national cycles (2.18.1) and the news-phase demand multipliers (10.0.6) of v0.6 (C19, C20).

**Global business cycle.** One world cycle sits in one phase at a time. On entering a phase it draws the **cycle value g_t** (the phase's push on demand growth, a year, for a zone of intensity 1.0) and the phase length, both uniform in the ranges below **(T)**. Phases change only at quarter boundaries (4.3 step 1).

| Phase | g_t a year | Length | Next |
|---|---|---|---|
| Expansion | 0 to +2% | 12 to 28 quarters | Overheating |
| Overheating | +2% to +4% | 2 to 6 quarters | Contraction |
| Contraction | −3% to −6% | 2 to 8 quarters | Recovery |
| Recovery | −2% to +1% (growth back near trend) | 4 to 10 quarters | Expansion |

An average cycle runs about 9 years and g_t averages about +0.2% a year over it, so the cycle adds almost no long-run growth. The game starts in Expansion (7.3).

**Financial zones (Logan, batch 152).** Logan: "Financial Zones Each have a stock exchange and hub city where the stock exchange takes place. This financial city should be a hub and have a zone. Places In the list that I kind of just named should be assigned a city. Countries belong to one financial zone and only one. Countries should join nearby financial zones." His 24 zones replace the 8 of batch 150; batch 154 adds zone 25 Japan and zone 26 Russia (Logan: "Taiwan goes with Japan, Japan gets its own. Russia should have its own zone."), so there are 26. Each zone has **one stock exchange in one hub city**; the hub is a key city (2-map 2.3.3) and financial-zones.csv names its hub province. Every country of countries.csv belongs to **exactly one zone**, the nearest sensible one (country-economy.csv financial_zone) **(A)**. Macau has its own countries.csv row MAC (Logan, batch 153), so zone 11 holds Macau (province MO-0001) on its own while the rest of China sits in zone 7.

Each zone has three mechanics **(T)**:

- **Intensity**: how hard the global cycle hits the zone, with North America at 1.0.
- **Lag** in quarters: `zone_effect_z(t) = intensity_z × g(t − lag_z)`, with g(t − lag) the cycle value lag quarters ago (before the start, the starting g_t) **(A)**.
- **Contagion** within the zone: when a member has a sovereign default or a bank crisis, every other member takes `spill = contagion_z × min(1, 4 × the origin's share of zone GDP)` of the origin's demand hit and of its spread rise **(A)**. The MVP has no sovereign defaults or bank crises, so contagion is loaded but never fires.

Isolated economies (Cuba, North Korea) get intensity 0.3, a 2-quarter lag, no contagion and their own dynamics: a zone-only shock each quarter with sd 3% a year (own_shock_sd), added to their zone effect **(T)**. The havens sit in zone 1 and follow North America. British havens join the UK, Luxembourg the EU, and Liechtenstein Switzerland **(A)**.

| # | Zone | Hub city (province) | Exchange: headline index | Intensity | Lag | Contagion | Countries | Share of 2020 GDP | Members |
|---|---|---|---|---|---|---|---|---|---|
| 1 | North America and havens | New York (US-0086) | ATX Atlantic Exchange: Atlantic 500 | 1.0 | 0 | 0.3 | 7 | 29.5% | USA, Canada, Puerto Rico, Bermuda, Bahamas, Caymans, BVI |
| 2 | Caribbean | Kingston (JM-0001) | ASE Antilles Securities Exchange: Antilles 30 | 1.3 | 1 | 0.3 | 11 | 0.2% | The Caribbean islands outside Cuba and the havens |
| 3 | Cuba | Havana (CU-0001) | HAB Havana Bourse: Malecon 20 | 0.3 | 2 | 0.0 | 1 | 0.1% | Cuba |
| 4 | North Korea | Pyongyang (KP-0001) | TDX Taedong River Exchange: Chollima 15 | 0.3 | 2 | 0.0 | 1 | 0.0% | North Korea |
| 5 | European Union | Frankfurt (DE-0019) | CBX Continental Bourse: Continental 50 | 1.2 | 1 | 0.5 | 44 | 16.0% | The 27 EU members, Norway, Iceland, the Balkans, Ukraine, Moldova, the microstates, the Faroes, Greenland, Saint Pierre and Miquelon |
| 6 | United Kingdom | London (GB-0001) | CLX City of London Exchange: CLX 100 | 1.1 | 0 | 0.3 | 5 | 3.2% | UK, Gibraltar, Isle of Man, Jersey, Guernsey |
| 7 | China and puppets | Shanghai (CN-0008) | HSE Huangpu Stock Exchange: Huangpu Composite | 0.9 | 1 | 0.4 | 8 | 16.8% | China, Pakistan, Sri Lanka, Djibouti, Zambia (debt vassals), Laos, Cambodia, Mongolia |
| 8 | South Korea | Seoul-Pyeongtaek (KR-0001) | HRX Han River Exchange: HRX 200 | 1.1 | 1 | 0.3 | 1 | 1.9% | South Korea |
| 9 | Hong Kong | Hong Kong (HK-0001) | VHX Victoria Harbour Exchange: Harbour Index | 1.2 | 0 | 0.4 | 1 | 0.4% | Hong Kong |
| 10 | Australia | Sydney (AU-0001) | SCX Southern Cross Exchange: Southern Cross 200 | 1.0 | 1 | 0.2 | 14 | 1.9% | Australia, New Zealand, the Pacific islands |
| 11 | Macau | Macau (MO-0001) | CTX Cotai Exchange: Cotai 20 | 1.5 | 1 | 0.0 | 1 | 0.1% | Macau (MAC) only, its own row since batch 153 |
| 12 | Singapore | Singapore (SG-0001) | LCX Lion City Exchange: Lion 30 | 1.2 | 1 | 0.4 | 9 | 3.6% | Singapore, Indonesia, Malaysia, Thailand, Vietnam, Philippines, Brunei, Myanmar, Timor-Leste |
| 13 | India | Mumbai (IN-0013) | GXI Gateway Exchange of India: Gateway 50 | 1.2 | 1 | 0.3 | 3 | 3.7% | India, Bangladesh, Maldives |
| 14 | Southern Africa | Johannesburg (ZA-0001) | HVX Highveld Exchange: Highveld Top 40 | 1.3 | 2 | 0.4 | 12 | 0.7% | South Africa, DR Congo, Angola, Zimbabwe, Mozambique, Namibia, Botswana, Malawi, Lesotho, Eswatini, Madagascar, Mauritius |
| 15 | West Africa | Lagos (NG-0001) | LSX Lagoon Securities Exchange: Lagoon 50 | 1.4 | 2 | 0.4 | 22 | 0.9% | Nigeria and West and Central Africa (22, with Mali, Chad, Cameroon, Gabon, Congo Republic) |
| 16 | East Africa | Nairobi (KE-0001) | RVX Rift Valley Exchange: Rift 20 | 1.2 | 2 | 0.3 | 12 | 0.4% | Kenya, Ethiopia, Tanzania, Uganda, Somalia, Sudan, South Sudan, Eritrea, Rwanda, Burundi, Seychelles, Comoros |
| 17 | North and Northwest Africa | Casablanca (MA-0001) | ABX Atlas Bourse: Atlas 25 | 1.2 | 1 | 0.3 | 5 | 0.5% | Morocco, Algeria, Tunisia, Libya, Mauritania |
| 18 | Switzerland | Zurich (CH-0001) | LMX Limmat Exchange: Limmat 20 | 0.8 | 0 | 0.2 | 2 | 0.9% | Switzerland, Liechtenstein |
| 19 | Middle East | Dubai (AE-0008) | DCX Creek Exchange: Creek 50 | 1.1 | 1 | 0.3 | 16 | 4.6% | Gulf states, Levant, Iraq, Iran, Turkey, Egypt, Yemen |
| 20 | Upper Asia (Himalayas) | Almaty (KZ-0002) | SRX Silk Road Exchange: Silk Road 30 | 1.3 | 1 | 0.4 | 11 | 0.5% | Kazakhstan and Central Asia, the Caucasus, Afghanistan, Nepal, Bhutan |
| 21 | Mexico | Mexico City (MX-0001) | RFX Reforma Exchange: Reforma 35 | 1.3 | 0 | 0.3 | 7 | 1.7% | Mexico and Central America to Costa Rica |
| 22 | Brazil | São Paulo (BR-0001) | PSX Paulista Exchange: Paulista Index | 1.4 | 1 | 0.4 | 5 | 2.2% | Brazil, Paraguay, Bolivia, Guyana, Suriname |
| 23 | Argentina | Buenos Aires (AR-0001) | PLX River Plate Exchange: Plata 25 | 1.6 | 1 | 0.5 | 4 | 0.9% | Argentina, Chile, Uruguay, Papa's Port |
| 24 | Colombia | Bogotá (CO-0001) | ANX Andean Exchange: Andes 20 | 1.3 | 1 | 0.4 | 5 | 1.1% | Colombia, Venezuela, Ecuador, Peru, Panama |
| 25 | Japan | Tokyo-Yokohama (JP-0001) | ESE Edo Securities Exchange: Edo 225 | 0.9 | 1 | 0.3 | 2 | 6.6% | Japan, Taiwan (batch 154) |
| 26 | Russia | Moscow (RU-0001) | YRX Yauza River Exchange: Yauza 50 | 1.1 | 1 | 0.2 | 2 | 1.5% | Russia, Belarus (batch 154; Belarus A) |

**Japan and Russia (Logan, batch 154).** Logan: "Taiwan goes with Japan, Japan gets its own. Russia should have its own zone." Zone 25 Japan holds Japan and Taiwan; its exchange is ESE, the Edo Securities Exchange in Tokyo, which was the HRX Tokyo board in batch 152 and keeps its code, rules and indices (3-markets 3.2.1). Intensity 0.9 (a mature, low-growth economy), lag 1, contagion 0.3 **(T)**. Zone 26 Russia holds Russia and Belarus, its close client, which leaves the EU zone **(A)**; its exchange is YRX, the Yauza River Exchange in Moscow, headline index Yauza 50. A commodity economy would swing at about 1.4, but sanctions since 2005 partly isolate Russia, so it gets intensity **1.1**, lag 1, contagion 0.2 and a small own shock (own_shock_sd 0.02, against 0.03 for the sealed Cuba and North Korea) **(T)**. Companies headquartered in Japan and Taiwan list on ESE, those in Russia and Belarus on YRX. Pakistan and Sri Lanka are Chinese debt vassals, so they sit with China and puppets rather than India; Mali, a US debt vassal, stays in West Africa by geography.

**Zone weighting of world demand (A).** Each industry still sells into one world market (10.0.3), and the MVP has no split of an industry's demand by zone, so every industry feels the **GDP-weighted average intensity** `Z = Σ gdp_c × intensity_zone(c) ÷ Σ gdp_c`, which is **1.07** at the 2020 data with the 26 zones of batch 154 (1.08 with the 24 of batch 152, 1.10 with the 8 zones of batch 150; static while GDP is static). In the MVP world demand reads `Z × g_t` with no lag; lags and own shocks move only the zone effects shown on screens (8, 9.2) **(A)**. Post-MVP, an industry's own demand split by zone replaces the GDP weights, and each zone's share then feels its own lagged effect.

**Offset by growth rate: asymmetric cycle sensitivity (T).** With LT the industry's long-term rate (trend_growth, a year):

- upswing (g_t ≥ 0): `k = clamp(1 + 5 × (LT − 0.04), 0.5, 2.5)`, so amplification rises with long-term growth;
- downswing (g_t < 0): `k = clamp(1 − 2.5 × (LT − 0.04), 0.25, 1.5)`, so sensitivity falls with long-term growth.

An industry at 4% (about the median) feels the cycle one for one; Oil and Autos at 0% get 0.8 up and 1.1 down.

**Quarterly growth draw.** At each quarter boundary every industry draws its demand growth for the quarter, per quarter:

`q_growth = lt_q + φ × (prev_q_growth − lt_q) + cycle_term + volatility × z`, with `lt_q = (1 + LT)^(1/4) − 1`

lt_q replaced LT/4 in batch 151 **(A)**: the two are within 0.1 pp a quarter below LT 15%, but at the boom's 100% a year LT/4 would compound to 144%.

`cycle_term = (1 − φ) × cycle_beta × k × Z × g_t ÷ 4`

- φ = 0.5 **(T)**: half of last quarter's gap from the long-term rate carries over, so shocks fade and growth always pulls back toward lt_q ("still average toward the long term rate").
- The (1 − φ) factor makes a lasting phase settle the industry at `lt_q + cycle_beta × k × Z × g_t ÷ 4` a quarter: half way in the first quarter, 75% in the second, 88% in the third.
- volatility is the industries.csv column, 0.01 a quarter for all in the MVP **(T)** (confirmed, Logan, batch 151, 1a); z is a standard normal draw from the growth stream, clamped to ±3. cycle_beta is 1 for all (2.2).
- q_growth is floored at −25% a quarter **(A)**. At load prev_q_growth = lt_q **(A)**.

**Worked table** (Z 1.07, batch 154; settled yearly growth `LT + k × Z × g_t` at each phase's middle g_t, no noise; quarterly growth is a quarter of it):

| Phase (g_t) | Retail, LT 3% (k 0.95 up, 1.025 down) | Software, LT 9% (k 1.25 up, 0.875 down) | A fast grower, LT 30%, such as AI labs late in the boom (k 2.30 up, 0.35 down) |
|---|---|---|---|
| Expansion (+1%) | 4.0% | 10.3% | 32.4% |
| Overheating (+3%) | 6.0% | 13.0% | 37.3% |
| Contraction (−4.5%) | −1.9% | 4.8% | 28.3% |
| Recovery (−0.5%) | 2.5% | 8.5% | 29.8% |
| Best phase vs trend / worst vs trend | +3.0 pp / −4.9 pp | +4.0 pp / −4.2 pp | +7.3 pp / −1.7 pp |

Over a full cycle the asymmetry leaves fast growers slightly above their long-term rate (500-seed means of compound yearly growth, batch 151: an LT 30% grower +2.4 pp a year, Software +0.6, Retail +0.2, Oil −0.1, AI labs before the boom (5%) +0.5): this is "grow more and cool off less" **(A)**. Kept as the default in batch 151: Logan answered Q2 with the AI boom (5.1.1).

**Monthly demand.** Each month (4.3 step 2) `demand_core ×= (1 + q_growth)^(1/3)` and `trend_demand ×= (1 + LT)^(1/12)`. Effective demand `= demand_core × (1 − s × (base_rate − neutral_rate))`, with s the rate_sensitivity, unchanged (no effect while the base rate sits at neutral). Both start at the 2020 world size (7.3), so no c0 is needed.

**Phase labels (A, T).** Boom, Normal, Glut and Bust stay, for screens, headlines (5.18), sale factors (5.10), fair value cycle factors (5.13) and the raise roll (6.6), but they no longer move demand or supply. With `gap = 4 × (q_growth − lt_q)` (this quarter's growth less the long-term rate, a year), set monthly at step 2, first match:

| Label | Rule |
|---|---|
| Bust | gap ≤ −5% |
| Glut | S above 1.15 last month (it stays Glut until S falls under 1.10) |
| Boom | gap ≥ +5% |
| Normal | Otherwise |

In the 40-quarter runs these give about 18% Boom and 14% Bust industry-quarters.

**Growth check (batch 150).** validate.py runs all 42 industries for 40 quarters with seed 150. Compound average yearly growth minus the long-term rate (batch 151; the quarters are 2020 to 2029, before the boom): mean +1.6 pp, sd 1.7 pp, range −2.9 pp (Defense) to +5.1 pp (Social media). The mean is high because this seed's cycle spent 26 of 40 quarters in Expansion or Overheating. Retail averages 4.2% (LT 3%), Software 10.5% (9%), AI labs 5.6% (5%), Oil −0.2% (0%). Over 500 seeds the gap per industry has an sd of about 1.3 to 1.5 pp; a volatility of 2% a quarter would double it to about 2.5 pp. The check fails if any industry is more than 6 pp off **(T)**.

### 5.1.1 The AI boom and the bubble (Logan, batch 151; 7-starting-world 7.7, 8-quest-lines 8.5)

Logan (batch 151): "AI boom I think we are moving to 2030 start now bubble in 2040. I think we need to do really small AI with low growth then an unprecedented growth rate."

AI labs' long-term rate is a **regime switch**. The quarterly draw of 5.1 is unchanged; only LT moves, by stage and boom year, from data/ai-boom.csv **(T)**. Demand is year-end world demand from validate.py's noise-free run with the pop on 1 January 2040.

| Stage | Default years | AI labs LT a year | AI labs demand |
|---|---|---|---|
| Pre-boom | 2020 to 2029 | 5% | $5B in 2020, $8B at the end of 2029 |
| Boom year 0 (the boom event) | 2030 | 100% | $16B |
| Boom year 1 | 2031 | 100% | $33B |
| Boom year 2 | 2032 | 90% | $63B |
| Boom year 3 | 2033 | 80% | $114B |
| Boom year 4 | 2034 | 60% | $188B |
| Boom year 5 | 2035 | 45% | $280B |
| Boom year 6 | 2036 | 35% | $385B |
| Boom year 7 | 2037 | 25% | $490B |
| Boom year 8 | 2038 | 20% | $595B |
| Boom year 9 | 2039 | 15% | $692B |
| Boom year 10 and later | Only if the pop comes after 1 Jan 2040 | 12% | |
| The pop | 2040 on average | Demand × 0.5 once | $311B at the end of 2040 |
| Bust | 8 quarters from the pop | −10% | $280B at the end of 2041 |
| Post-crash | After the bust | 8% | $364B in 2045 |

- **Linked industries (Logan, batch 153 Q2: decided).** Every industry's long-term rate is `lt = trend_growth + boom_uplift × (AI labs LT − 5%)`. boom_uplift is 1 for AI labs, 0.15 for Data centers, 0.10 for Semiconductors and 0.05 for Cloud, 0 for the rest **(T)**. Before the boom the term is 0: AI is too small to move them. In boom year 0 Data centers run at 29% (15% + 14 pp), Cloud 25% and Semiconductors 15%; in the bust Data centers fall to 13%, Cloud 19% and Semiconductors 3.5%.
- **Pre-boom growth of Cloud and Data centers (Logan, batch 153 Q3: decided).** Their pre-boom trends (Cloud 20%, Data centers 15%) stay on the shared defaults for the MVP and are left for the per-industry rework (11.2).
- **The boom event (scripted, MVP).** At 00:00 on 1 January 2030, in 4.3 step 1 before that quarter's draw, the world's ai_stage becomes Boom and boom year 0 starts; each later 1 January starts the next boom year. Every industry with boom_uplift above 0 sets prev_q_growth to its new lt_q, so growth jumps at once instead of ramping up from 5% **(A)**. The news wire posts "[tipped lab] launches its chatbot" (5.18) and a World event alert fires (Pause by default) **(A)**. The read-only MVP has no tip and no quests: the tipped lab is drawn at load from the five candidate labs (7.6) only to name the headline **(A)**.
- **The pop (scripted, MVP).** At load the world rolls the pop date from the gen stream: year 2040 plus a whole number from −2 to +2, and a quarter from 1 to 4 **(A)**; it fires at 00:00 on that quarter's first day in 4.3 step 1. Every industry's demand_core and trend_demand are multiplied by `1 − crash_drop` once (AI labs 0.50, Data centers 0.25, Semiconductors 0.20, Cloud 0.10, others 0; **T**), LT moves to the bust rate for 8 quarters and then to the post-crash rate, and prev_q_growth resets to the new lt_q. The 8.5 moves of the pop year by events (a bigger boom brings it closer, calm markets push it later) and the ×1.2 market crash need events and markets the MVP does not have **(A)**: prices fall through fair value's Bust cycle factor (5.13) and the earnings.
- **Labels (A).** Industries with boom_uplift above 0 read **Boom** for the boom's first 4 quarters and **Bust** for the 8 bust quarters, whatever the gap.
- **Supply.** Supply grows only as units buy assets (5.10), so in the boom S falls and M rises; the Lite AI's g_dem (6.2) uses the current lt and does not foresee the switch. At the pop S jumps (about 2 for AI labs), M collapses and units sell assets.
- **The asymmetric cycle stays (batch 151, Q2 default kept).** At LT 100% k is 2.5 in upswings and 0.25 in downswings; over 500 seeds an industry held at 100% averages 3.9 pp a year above it.
- **Checks.** validate.py runs 2020 to 2045 with the pop on 1 January 2040 and fails if AI labs end 2029 outside $6B to $10B, do not roughly double in 2030, or keep more than 60% of their 2039 demand in 2040. The 10-year balance targets (10) cover 2020 to 2029, before the boom; the M10 30-year soak covers the boom and the pop.
- The GPU demand of 6-technocapital 6.7.0 (consumers against AI, the chip index, the rolled boom rate) is not in the MVP; Semiconductors feels the boom only through boom_uplift **(A)**.

### 5.1.2 Zone economy (Logan, batch 155)

Logan (batch 155): "Things that we were traditionally applying to a countries economy we are no apply across and entire financial zone."

Economy settings belong to the financial zone; government settings stay with the country **(A)**:

| Moves to the zone (financial-zones.csv) | Stays national (country-economy.csv, countries.csv, 4-politics) |
|---|---|
| The business cycle (intensity, lag, own shock; already zonal, batch 150) | Corporate tax: tax is a national law, paid where profit is earned (5.11, 10.5.5) |
| (Batch 157: no wage or price level; labor is the industry labor_value, 10.0.11.10) | Laws and regulation |
| Cost levels such as the post-MVP electricity index (10.6) | Sovereign rating and government debt, and the sovereign spread governments borrow at |
| Corporate credit spread: companies borrow at the base rate plus their home spread (half zone spread, half home sovereign spread; batch 156) plus their rating spread (5.12) | The corporate rating's country ceiling: home sovereign + 1 notch (5.12, 3.6.3) |
| Investor confidence and market sentiment of the zone exchange (3-markets 3.3.5) | Sanctions |
| Demand weighting and GDP aggregates (Z, 5.1) | Politics (batch 121) |
| The market calendar and exchange rules (one exchange per zone, batch 152); contagion (already zonal) | |

There was no country productivity modifier, so none moves; location bonuses stay per province (5.4).

**How zone values are set (T).** Each value is set directly per zone. The default seed is the GDP-weighted average of the members' old country values, computed by gen.py, which can override any zone by hand (ZONE_ECON_SET, empty at start):

- `credit_spread_bps = Σ gdp_c × sovereign_spread_bps_c ÷ Σ gdp_c`, rounded: the zone's fixed **base** spread;
- `confidence_start = 0` for every zone, on the market sentiment scale of −100 to +100 (3.3.5).

**Batch 156 (Logan, 3b): the home country softens the zone.** A company borrows at its **home spread** `= 0.5 × zone credit_spread_bps + 0.5 × home country sovereign_spread_bps`, rounded: a Chilean company pays (591 + 32) ÷ 2 = 312 bps instead of 591 or 32, a German one (78 + 0) ÷ 2 = 39, a Greek one half the EU zone's 78 plus half of Greece's own spread. The zone still moves everyone in it; the home government still matters. Z stays 1.07, since it was already `Σ gdp_share_zone × intensity_zone`.

| # | Zone | Base credit spread bps (members' sovereign spreads) |
|---|---|---|
| 1 | North America and havens | 1 (USA 0 to Puerto Rico 250) |
| 2 | Caribbean | 332 (150 to 800) |
| 3 | Cuba | 800 |
| 4 | North Korea | 1,400 |
| 5 | European Union | 78 (Germany 0 to Greece 1,000) |
| 6 | United Kingdom | 15 (15 to 40) |
| 7 | China and puppets | 49 (China 32 to Zambia 800) |
| 8 | South Korea | 15 |
| 9 | Hong Kong | 10 |
| 10 | Australia | 11 (0 to 567) |
| 11 | Macau | 10 |
| 12 | Singapore | 102 (0 to 567) |
| 13 | India | 167 (150 to 450) |
| 14 | Southern Africa | 373 (80 to 800) |
| 15 | West Africa | 461 (317 to 800) |
| 16 | East Africa | 439 (250 to 800) |
| 17 | North and Northwest Africa | 318 (150 to 567) |
| 18 | Switzerland | 0 |
| 19 | Middle East | 242 (UAE 15 to Lebanon 1,000) |
| 20 | Upper Asia (Himalayas) | 274 (150 to 567) |
| 21 | Mexico | 124 (80 to 567) |
| 22 | Brazil | 318 (250 to 567) |
| 23 | Argentina | 591 (Chile 32 to Argentina 1,000) |
| 24 | Colombia | 348 (80 to 1,000) |
| 25 | Japan | 31 (23 to 32) |
| 26 | Russia | 213 (200 to 450) |

**Credit spread moves with the cycle (Logan, batch 157, 1ab; A for the reading).** credit_spread_bps is the zone's fixed base. Each quarter, at the quarterly draw after the cycle advances (4.3 step 1), the effective zone spread is recomputed from the base, so it always reverts to the base as the cycle does:

`credit_spread_z = round(clamp(base_z × (1 − 8 × zone_effect_z), 0.5 × base_z, 2 × base_z))`

with zone_effect_z `= intensity_z × g(t − lag_z)` (5.1, plus the own shock in Cuba and North Korea), k 8 and the 0.5x to 2x clamp **(T)**. A downturn widens it, a boom narrows it, and high intensity zones swing most. The EU (base 78, intensity 1.2) pays 112 bps in a mid Contraction (g −4.5%) and 56 in a mid Overheating (g +3%); Argentina (base 591, intensity 1.6) pays 931 and 307. A zone with base 0 stays at 0. home_spread (batch 156) reads the effective zone spread.

**Investor confidence (Logan, batch 157, 2a).** One value per zone exchange, −100 to +100, starting at confidence_start. Once a day at 00:00 **(T)**:

`confidence_z = clamp(0.9 × confidence_z + 3 × r_z + news_z, −100, +100)`

with r_z the headline index's return that day in % and news_z the sum of that day's Pdoomberg Wire headlines (5.18) on companies listed on the exchange: Big beat +4, Beat +2, Miss −2, Big miss −4, bankruptcy −5, rating change of 2+ notches ±3 **(T)**. The 0.9 is the 10% daily decay toward 0 of 3-markets 3.3.5; the GRG term is not in the MVP. An exchange with no listed company has r 0 and no news, so it decays to 0.

**MVP use.** The effective credit_spread is read by the credit line rate (5.12) and the R factor (5.13). confidence is shown on the zone hover and Pdoomberg and, since Logan's batch 158 answer (2a), nudges the fair value of every company listed on the exchange by up to ±10% at the extremes: `X = 1 + 0.10 × confidence_z ÷ 100` (0.9 to 1.1) **(T)**, applied in 5.13 alongside the C factor. It is not a V* sentiment term (5.14). A company's own investor confidence factor (5.7) is separate. Post-MVP, zone values also move with contagion and events. validate.py checks the columns' ranges, each base seed against the GDP-weighted member values and that no wage_level or price_level column remains.

### 5.2 Supply, oversupply and undersupply (10.0.3)

- **Unit pre-market productivity** `p_pre = productivity + PC bonus + location_bonus` (conflict C12).
- **Supply** `= fringe_assets × turnover + Σ units (assets_eff × turnover × p_pre ÷ 100)`, where `assets_eff = gross_assets − 0.2 × ramping` (new assets at 80%, 10.0.4).
- **Supply ratio** `S = supply ÷ demand`. The +0.2 in a Glut is dropped, since Glut is now read from S (C21, batch 150).
- **Market factor** `M = clamp((1 ÷ S)^0.5, 0.7, 1.3)` **(T)**. Oversupply (S above 1) gives M below 1, cutting every unit's effective productivity; undersupply raises it. S 1.21 gives M 0.91; S 0.81 gives M 1.11.

### 5.3 Fringe pool (10.0.10)

- At load: `fringe_revenue = max(0, world_size − Σ named revenue in the industry)`; `fringe_assets = fringe_revenue ÷ turnover`, productivity 100, no decay **(A)**.
- Monthly: `fringe_assets ×= (1 + q_growth)^(1/3)`, so the fringe grows with its industry's demand and keeps its share (batch 150; the Boom and Bust adjustments are gone with the multipliers, C20) **(A)**.
- Revenue `= fringe_assets × turnover × M ÷ 12`. Not ownable; shown as one row "Fringe (unnamed)" on the industry screen.

### 5.4 Revenue (10.0.4, 10.0.11.2)

`effective productivity = p_pre × M`

`revenue (month) = assets_eff × turnover × effective productivity ÷ 100 ÷ 12`

- **Location bonus** (10.3.1): `+2 × share of assets in provinces whose largest track matches the fit + 3 × share in provinces whose resource tag matches` (points of productivity) **(A: points, not percent)**. With 100% at the base province this is 0, 2, 3 or 5. **MVP (batch 148):** industries use the defaults, which have no fit and no resource tags, so the location bonus is 0 for every unit until the per-industry rework (11.2); the rule stays.
- **Demand share.** A unit's share of the industry's revenue is its share of supply; total industry revenue is `supply × M`, which equals `(supply × demand)^0.5` when M is not clamped. Demand is never fully met or fully exceeded; that is the intended Wall Street Raider feel.

### 5.5 Expenses (10.0.4, 10.3; conflict C11)

Per unit, per month:

| Line | Formula |
|---|---|
| Variable | `revenue × v`, with `v = 1 − margin_full_use − f` and D fixed at 1.0 **(A)** |
| Fixed cash | `gross_assets × fixed_cost_rate ÷ 12` |
| Depreciation | `min(asset_book, decay_usd ÷ 12)`, with `decay_usd = asset_decay × max(0, gross_assets − asset_decay_threshold_usd)`: the month's asset decay at cost (5.10; batch 149: 1% above $10M). Book depreciation equals the degradation (Logan, batch 145, 10.0.7); the 10-year straight line is retired |
| R&D spend | `revenue × rd_plan` (free R&D costs nothing, 5.9) |
| Shared costs | Corporation compute, data compute and licences (3.8), split across units by revenue share (10.0.8) |

- **Depreciation sits inside the fixed share (A).** `fixed_cost_rate = f × turnover − d_eff − shared_cost_rate` at load, with `d_eff = decay_usd ÷ gross_assets` (5.10), so fixed cash plus depreciation plus shared costs equals `f × revenue at productivity 100 and M 1.0`, and margin_full_use is the margin before R&D, as in the 10.10 worked example. Without this, Oil at its 10.3 values (capital 2.5, decay 6%) would lose 15 of its 25 margin points to depreciation.
- **R&D counts in break-even (Logan, batch 148; C18).** The barebones company has revenue equal to expenses at productivity 100 and M 1.0 (10.0.11.1). With R&D on top of a 0% margin, every default company would lose its R&D, so the MVP counts R&D at the norm inside the barebones expenses: `margin_full_use = rd_norm` (0.05), and EBIT after R&D at the norm is exactly 0. Per $1 of revenue at productivity 100: variable 0.50, fixed cash about 0.44, depreciation under 0.01 (0.008 at $50M of assets, toward 0.01 for large units; batch 149) and shared costs under 0.01 (together f = 0.45), R&D 0.05. For the barebones company itself there is no decay ($100,000 is under the $10M threshold) and the $7,000 of shared costs come out of fixed cash, which leaves 0.38.
- **Where profit comes from (batch 148).** At break-even, profit comes only from productivity above 100 (the PC bonus, R&D above the norm, later location bonuses), undersupply (M above 1.0) and free R&D from held data, which replaces paid R&D (6.3). At load every industry has M 1.0, so the PC bonus and free R&D carry it: 619 of 651 companies earn above 0 after R&D, median 6.1% (2.2 checks).
- **Profit check (batches 148 and 149).** With the defaults `f × turnover` is 0.45 in every industry, above `d_eff + shared cost rate`: d_eff is 0 at $10M of assets or less and below 0.01 above it (1% above $10M), so fixed_cost_rate is 0.45 − under 0.01 − under 0.01 = 0.38 to 0.449 (median 0.439) for the starting companies and 0.45 − 0 − 0.07 = 0.38 for the barebones company, and stays positive. EBIT at load does not change with the decay rate, because fixed cash plus depreciation is held at the fixed share: **619 of 651 companies profitable after R&D, median margin 6.1%**, as at 8%. What batch 149 changes is cash: replacement now costs about 1% of assets above $10M a year, not 8% of all of them, so a company that holds still keeps far more of its EBIT as free cash flow, and EBITDA (5.12) is close to EBIT. Batch 145 note, kept for the per-industry rework: at the 10.3 values `f × turnover` is lowest in Renewables (0.20), then Data centers (0.22), Power utilities (0.23), Oil and Gas (0.24); it is above `asset_decay + shared cost rate` in all 42 industries, both at the starting values (shared costs are well under 1% of assets) and for the barebones company ($7,000 of shared costs on $100,000, rate 0.07; worst case Data centers 0.22 − 0.10 − 0.07 = 0.05). So fixed_cost_rate stays positive and EBIT before R&D is unchanged: Oil keeps 25%, and the barebones company stays break-even. What changes is cash: a company that holds still now spends its depreciation on replacement, so its steady free cash flow before growth is EBIT less R&D, interest and tax, not that plus depreciation. At the 10.3 values some industries earned nothing or lost money after R&D at the norm; that was older and not caused by asset decay (G10).
- **Productivity decay is kept (batch 145).** Asset decay carries the physical wear of assets (paid by replacement purchases); productivity decay (5.6) is the business falling behind (paid by R&D). No double counting in money; the old 10.0.7 wording that called productivity decay the assets' wear is fixed.
- **Check (Robotics, 10.10, at its parked 10.3 values):** turnover 1.43, f 0.35, margin 0.10: v 0.55; at M 1.0, revenue $3.0B, costs $1.65B + $1.05B, EBIT before R&D $0.30B. Matches.

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
- **Asset decay** (Logan, batch 145): "Percentage of business assets degrade overtime, this drives growth spending." **Batch 149 (Logan):** "Asset decay 1% a year, only kicks in after 10 million assets." Yearly decay is `decay_usd = asset_decay × max(0, gross_assets − asset_decay_threshold_usd)`, 1% on the part above $10M only (marginal, so no cliff at $10M **(A)**): $50M of assets decays $400k a year; a unit with $10M or less decays nothing. The effective rate is `d_eff = decay_usd ÷ gross_assets` (0.8% at $50M, near 1% for large units). Monthly at step 11 the unit loses `decay_usd ÷ 12` of capacity at cost, a real loss of the asset base. The same dollar amount comes off asset_book as depreciation (5.5), capped at asset_book. Ramping tranches decay with the rest **(A)**.
- **Growth plan** is an annual net rate g set at the plan lock (21.5): replacement comes first, then growth. Monthly at step 11, purchases `= gross_assets × (d_eff + g) ÷ 12`:
  - above 0: buy that amount; cash pays it, and it is added to gross_assets and asset_book at cost. The growth part (`gross_assets × g ÷ 12`, when g is above 0) enters `ramping` for 6 months; replacement does not ramp **(A)**.
  - below 0 (g below −d_eff): sell `gross_assets × |d_eff + g| ÷ 12` of capacity; the book sold is the same share of asset_book; cash received `= book sold × sale factor` (Boom 1.00, Normal 0.85, Glut 0.70, Bust 0.60, 10.0.7); the difference is a gain or loss in pre-tax income.
  - So g = 0 holds the asset base flat and costs `decay_usd` a year in cash (nothing at $10M or less); g = −d_eff buys and sells nothing and lets the base shrink by decay alone, down to $10M.
- **Seats**: when the labor count opens a seat 2 to 5, a simple character is generated for it (3.7.1); when it closes, the character is discarded.

### 5.11 Tax (10.5.5)

- Each quarter, `tax = max(0, pre-tax income − loss carryforward used) × corp_tax_rate` of the HQ country (all assets sit there in the MVP). Tax stays national (batch 155, 5.1.2): it is a country's law, not a zone setting. Losses carry forward without limit **(A)**. Accrued monthly for projections, paid at the quarter close.

### 5.12 Credit line, interest and rating (10.0.9, 3.6; conflicts C9, C10)

- **Limit** `= max(0, (0.5 × asset_book + own cash)) × rating_factor`, where own cash is `cash − line_drawn` floored at 0 (conflict C10). Rating factor **(T)**: AAA 1.0, AA 0.9, A 0.8, BBB 0.65, BB 0.5, B 0.3, CCC and below 0.
- **Rate** `= base_rate + home_spread + corporate spread(rating)`, with `home_spread = 0.5 × zone credit_spread + 0.5 × sovereign_spread` of the HQ country and its zone, using the zone's effective spread of the quarter (batch 157; batch 156, 5.1.2; batch 155 used the zone spread alone, before that the country spread, C23) (3.6.2 5-year spreads: AAA 0.40%, AA 0.60%, A 0.90%, BBB 1.50%, BB 2.80%, B 4.50%, CCC 9.00%, CC 16.00%).
- **Monthly**: interest `= line_drawn × rate ÷ 12`; undrawn fee `= (limit − line_drawn) × 0.25% ÷ 12`; interest on positive own cash `= own cash × (base_rate − 0.25%) ÷ 12` (3.6.5 savings).
- **Auto-draw**: if cash is below 0 after the month, draw the shortfall up to the limit. **Auto-repay**: per the plan (6.5).
- **Review** at 01:00 on release days: limit recomputed; a company over its new limit must repay the excess within 3 months (10.0.9), by auto-repay from cash first.
- **Implied rating** (3.6.3) from net debt ÷ EBITDA (EBITDA = EBIT + depreciation, trailing 4 quarters): below 0.5 AAA, 0.5 to 1 AA, 1 to 2 A, 2 to 3 BBB, 3 to 4 BB+, 4 to 5 BB-, 5 to 6.5 B, 6.5 to 8 CCC, above 8 or EBITDA negative CC. Adjustments: interest cover above 10 +1 notch, below 3 -1, below 1.5 -2; revenue above $20B +1, below $500M -1; utilities +1; mining and shipping -1. Ceiling: sovereign + 1 notch (the HQ country's sovereign rating, which stays national, batch 155). The rating moves 1 notch per review toward implied, 2 if 3 or more away (3.6.4).
- **Distress, bankruptcy and removal (Logan, batch 145; timings T).** Forced asset sales, then frozen, then removed:
  1. **Forced sales (Distressed).** If cash is still below 0 with the line full, `distress_months += 1` and the unit sells assets at the sale factor until cash reaches 0. No dividends; purchases stop (g = −d_eff at most). A month that ends with cash at or above 0 and the line within its limit resets distress_months to 0.
  2. **Bankrupt and frozen.** After **6 distress months**, or with no assets left, the company is **Bankrupt**: frozen for **2 quarters** (no revenue, no expenses, no decay, 10.0.2; its capacity leaves supply), delisted from quotes with the price set to $0.00, and **shareholders wiped**: equity is 0 and every holder's stake is worthless. It stays on screens and the map, marked Bankrupt.
  3. **Removed.** At the first release after its 2 frozen quarters, its remaining assets are sold at the Bust factor (0.60) to repay the line, any unpaid line is written off by the bank **(A)**, and the company is **removed from the game**: off lists, the map and the screens, its simple characters discarded. Its filings, price history and headlines stay in the archive **(A)**. Sold capacity leaves the game, like any MVP asset sale **(A)**.

### 5.13 Fair value (10.0.8, 3.3.1; conflict C8)

1. `E_norm = 0.6 × TTM net income + 0.4 × TTM × (1 + g)`, with g the 4-quarter revenue growth clamped -30% to +60% (3.3.1 step 1).
2. `Multiple = M_sector × G × R`, with `G = clamp(1 + 2.5 × (g − g_sector), 0.5, 2.5)` and `R = clamp(9% ÷ (y10 + 5%), 0.4, 1.6)`, `y10 = 3.5% + home_spread` of the HQ country (5.12; batch 156, C24) **(A)**. Q and C factors are 1.0 in the MVP **(A)**. Alongside them, the **exchange confidence factor** `X = 1 + 0.10 × confidence_z ÷ 100` of the company's listing exchange (5.1.2; Logan, batch 158, 2a) **(T)**; X is 1.0 for a private company, which lists on no exchange **(A)**.
3. `Fair value = (0.3 × book equity + 0.7 × E_norm × Multiple × cycle factor × confidence factor) × X` (10.0.8; X batch 158), with cycle factor Boom 1.2, Normal 1.0, Glut 0.85, Bust 0.7. confidence factor is the company's own (5.7); X is its exchange's.
4. Loss-makers (E_norm ≤ 0): `book equity × cycle factor × X` (10.0.8) **(A for X here)**.
5. Floor: `0.6 × book equity` (0.9 for Real estate), and never below $0.01 per share (3.3.1 step 6).
6. Per share `V = fair value ÷ shares_out`. Private companies show `0.7 × fair value` as their value (10.5.4 private discount) **(A)**.

### 5.14 Share price, hourly (3.3.3, flow removed)

`P_next = P × (1 + 0.0003 × (V ÷ P − 1) + noise)`

- `noise = σh × (ρ × z_market + sqrt(1 − ρ²) × z_stock)`; `σh = annual volatility ÷ 19.1 ÷ sqrt(24)`; `ρ = min(0.8, 0.5 × beta)`; one z_market per tick for all stocks, shared by the 26 zone exchanges in the MVP **(A)**; 2% of ticks draw from a distribution 3 times as wide (all from 3.3.2 and 3.3.3).
- **Exchanges (Logan, batch 152).** Each listed company lists on its HQ country's zone exchange (5.1, 3-markets 3.2.1); a company headquartered in Macau (MAC) lists on CTX, one in Japan or Taiwan on ESE and one in Russia or Belarus on YRX (batch 154). Each exchange's headline index is the market-cap weighted index of its listed companies, 1,000 at load; an exchange with no listed company shows no level **(A)**.
- Sentiment terms in V* are 0 except buzz: `V* = V × (1 + 0.10 × buzz ÷ 100)`.
- No order flow: nobody trades in the MVP.

### 5.15 Earnings jump (21.2, 21.3.1, 3.3.6)

- `s = (actual NI − consensus) ÷ |consensus|` (consensus 0 is treated as $1).
- At 01:00: `P ×= 1 + 1.5 × clamp(0.5 × s, −25%, +25%)`; `buzz += clamp(20 × s, −30, +30)`.
- Result types (21.3.2) are tagged for headlines only: Beat (s above +5%), Big beat (+20%), Miss (below -5%), Big miss (-20%), Loss, Record quarter.

### 5.16 Projections and consensus (21.5.1)

- At the plan lock the engine projects the quarter from the locked plan with current demand (no new rolls); `consensus = projection × (1 + e)`, e uniform ±5% **(T)**. Since batch 150 the quarter's growth is drawn before the lock (4.4), so surprises come from e, from supply and M moving as other companies grow, and from productivity; check the beat rate in the M10 soak and widen e if it is low **(T)**.
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
| C1 | 10.0.4 revenue model vs the operations layer (10.0.11, batches 140 to 142) and the break-even barebones company | 10.0.11 sits on top of 10.0.4 (Logan, batch 140): effective productivity = (productivity + PC bonus + location bonus) × M. The barebones break-even case is for founding only, but its parameters are now every industry's MVP defaults (Logan, batch 148; 2.2, C18) |
| C2 | Batch 141 PC = quality factor Q vs batch 142 | Batch 142: PC per station is 1 × industry modifier |
| C3 | Data accrues every hourly tick (10.0.11.4) vs monthly finances (9.2) | Monthly, with the month's revenue (coordinator default) |
| C4 | 14.2.3 data rate (1 TB a day per $100M) and tier table vs 10.0.11 | 1 TB per $1M and the free R&D rule (batch 141) |
| C5 | 7-tier data ladder (batch 140) vs data quests | `(1 + floor(log10 TB))%` free R&D (batch 141) |
| C6 | 9.2 runs industry demand weekly vs 10.0.4 monthly | Monthly |
| C7 | 7-starting-world says the starting rate is about 1.75% (batch 129) | 3% (batch 130) |
| C8 | Fair value: 10.0.8 blend vs 3.3.1 earnings-multiple V with sales value for loss-makers | 10.0.8 blend (Logan, batch 53), using 3.3.1's E_norm, G and R factors and asset floor; loss-makers at book × cycle (10.0.8) |
| C9 | Loan rate: 3.6.5 "policy + corporate spread + 1.0" vs 10.0.9 and 10.5.5 "base + country spread + rating spread" | Base + country spread + rating spread (consistency pass 3, batch 129) |
| C10 | Credit line counts cash at 100%, so drawing raises its own limit | Count own cash only (cash − drawn) (A) |
| C11 | Depreciation at 10% of assets a year wipes out capital-heavy margins (Oil: 2.5 × 10% = 25% of revenue) | Depreciation equals asset decay (5 to 10% by industry, Logan batch 145; 8% for every industry in the MVP, batch 148; now 1% a year above $10M of a unit's assets for every industry, batch 149) and is part of the fixed cost share; margin_full_use stays the margin before R&D (A, gap G3) |
| C12 | Supply uses productivity, revenue uses productivity + PC bonus, so S is not 1 at start | Supply uses p_pre (productivity + PC bonus + location bonus) (A) |
| C13 | Growth plan is "this year" (10.0.2) vs set each quarter (21.5) | Annual rate locked each quarter, bought monthly at 1/12 (21.5) |
| C14 | Charter board sizes 5 to 13 and elections (1.5, 1.8.1) vs labor units 1 to 5 (batch 142) | Labor rule only; no charter seats or elections in the MVP (A) |
| C15 | companies.csv est_value (margin × 0.75 × multiple, ignoring R&D) vs the engine's fair value | Engine fair value drives price; shares are set so the opening price is $25 at engine value; est_value is shown only as "2020 estimate" (A) |
| C16 | Starting loadout enterprise stations `ceil(0.5 × R ÷ 11)` ignores the industry data rate | `ceil(0.5 × R × data_tb_per_musd ÷ 10.95)` (A) |
| C17 | 12.1 says content is JSON | The MVP loads the design/data CSVs directly; JSON conversion is post-MVP (A) |
| C18 | All industries use the barebones defaults (Logan, batch 148), whose revenue equals expenses at productivity 100 and M 1.0 (10.0.11.1), vs R&D booked on top of expenses (5.5): a 0% margin before R&D would make every default company lose its R&D | R&D at the norm counts inside the break-even expenses: margin_full_use = rd_norm = 0.05, so EBIT after R&D at the norm is 0 and profit comes from productivity above 100, undersupply and free R&D (5.5) (A) |
| C19 | National cycles per country with a shared euro-area cycle (2-map 2.18.1, batch 125) vs one global cycle | One global cycle felt by financial zones at their intensities (Logan, batch 150; 5.1), now 26 zones with lags and contagion (Logan, batches 152 and 154). cycle_group and cycle_phase_start are replaced by financial_zone; the zones and intensities are (A, T) |
| C20 | Industry news phases as their own random cycle with demand ×1.15 in Boom and ×0.85 in Bust (10.0.6) vs the batch 150 growth model | Demand moves only by the quarterly growth draws (5.1); Boom, Normal, Glut and Bust become labels read from q_growth and S, with no multipliers; the fringe grows with demand (A) |
| C21 | Glut adds +0.2 to S (10.0.6) vs Glut read from S | The +0.2 is dropped, so S does not feed on its own label (A) |
| C22 | Twelve exchanges in 3-markets 3.2.1 (two in New York, one each in Tokyo and Riyadh) vs one exchange per financial zone in its hub city (Logan, batch 152) | 26 zone exchanges (batch 154 adds YRX in Moscow and makes the Edo exchange ESE Japan's zone exchange, after a batch 152 spell as HRX's Tokyo board); Hudson Digital Market (HDM) becomes ATX's tech board and the Nejd exchange (NJX) the Creek Exchange's Riyadh board, keeping their rules and indices; each listed company lists on its HQ country's zone exchange (A) |
| C23 | Credit line rate "base + country spread + rating spread" (C9; 10.0.9, 10.5.5, 3.6.5) vs economy settings per zone (Logan, batch 155) | `base_rate + home_spread + corporate spread(rating)` (5.12), with home_spread half the zone credit spread and half the home sovereign spread (Logan, batch 156). The zone spread is seeded as the GDP-weighted sovereign spread of the members (5.1.2, T); country_spread_bps is renamed sovereign_spread_bps and stays only as the government's own spread |
| C24 | Fair value R factor: y10 is "the 10-year government yield of the company's home country" (3-markets 3.3.1) vs batch 155 | `y10 = 3.5% + home_spread` (5.13): the same blend as the borrowing rate (batch 156, A) |
| C25 | Wage index WI per country (2-map 2.1.1, 2.2.3, 2.8.4; batch 148, 3a) and the batch 155 zone wage_level | Logan, batch 157: no geographic wage; labor is labor_value, bound to industry (10.0.11.10). wage_level is removed and wealth_index is not a wage index. Post-MVP wage-based rules (segment wages 2.8.4, union thresholds 2.8.6, notional labor prices 14.4.1) are restated with flat prices (batch 158, A; G11), and wealth_index is now an equality index |
| C26 | Price factor PF per country (2-map 2.1.1) and electricity price index per country grid (10.6) vs batches 155 and 157 | price_level was derived from wage_level and is removed with it (batch 157); nothing in the MVP read it (D fixed at 1.0). The electricity index becomes one per zone grid post-MVP (A) |
| C27 | Market sentiment per exchange (3.3.5) and investor confidence vs batches 155 and 157 | One confidence value per zone exchange, starting at confidence_start (0 for all, T) and moved daily by its headline index and news (Logan, batch 157, 2a; 5.1.2). Logan, batch 158 (2a): it nudges the fair value of companies listed there by up to ±10% (X, 5.13, T). A company's own investor confidence factor still comes from its board (5.7, 10.5.2), since it belongs to the company, not the economy (A) |
| C28 | What stays national after batch 155 | Corporate tax (5.11; tax is national law, paid where profit is earned), the sovereign rating and its corporate ceiling (5.12), the sovereign spread and government debt, laws, sanctions and politics (batch 121) (A) |

---

## 6. Lite AI rules

Every company runs the same rules at 9th 00:00 of each release month (21.7), in one batch, and at load. The AI only sets its own plan. Inputs:

| Input | Meaning |
|---|---|
| g_dem | Projected demand growth next 4 quarters (batch 150): `LT + (φ + φ² + φ³ + φ⁴) × (q_growth − lt_q)`, with LT the industry's current lt (5.1.1: the AI does not foresee the boom or the pop), the long-term rate plus the expected fade of this quarter's gap (0.94 × the gap at φ 0.5); the AI does not forecast phase changes **(A)**. Retail in a Contraction (q_growth −0.5%) projects 1.8% |
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

Then trait nudges: Ambitious +3 pp, Content −1 pp, Cautious −2 pp, Brave +1 pp, Visionary +1 pp in Tech **(T)**. Clamp −20% to +30%. **Funding cap**: the quarter's purchases (`gross_assets × (d_eff + g) ÷ 4`, replacement plus growth, 5.10) may use at most 50% of liquidity above min_cash; scale g down to fit, but not below −d_eff (no purchases).

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

**Parked for the MVP (Logan, batch 148).** While industries use the shared defaults (2.2), no industry is flagged cash_burning and no company loses money by design, so this rule never fires. It stays in the spec as written for when the flags return in the per-industry rework (11.2).

Logan (batch 146): Consumer electronics, EVs, E-commerce and AI labs lose money after R&D on purpose; they live on investor money ([10-industry-economy.md](../detailed/10-industry-economy.md) 10.3). So that they do not all go bankrupt in the read-only MVP, a company in one of these four **cash-burning industries** raises money when its cash runs short. Checked at the plan lock, after 6.2 to 6.4 and before 6.5, for Active and Distressed companies; one try per plan lock.

- **Burn**: minus the last quarter's free cash flow (operating cash less asset purchases, 3.9), when that is negative. With no burn there is no raise.
- **Runway**: `own cash ÷ burn`, in quarters. A raise starts when runway falls under **4 quarters (T)**.
- **Target**: `8 × burn − own cash`, enough for 8 quarters of runway **(T)**.
- **Method (A)**:
  1. **Credit line draw**, if rated: the rating is B or better (rating factor above 0, 5.12) and the undrawn line covers the target. The target is drawn now, ahead of need; no dilution; interest as in 5.12.
  2. Otherwise a **new share issue**, the follow-on offering of [3-markets-and-fx.md](../detailed/3-markets-and-fx.md) 3.4.3: issue price `= P × (1 − discount)`, with the 3.4.3 discount of 4% for large caps (market value $10B and up **(A)**) and 8% for small caps **(T)**; fees 3% of the gross raise (3.4.3: 2.5% to 4%) **(T)**; new shares capped at 20% of shares_out per raise, the 3.4.3 line above which holders must approve, since the MVP has no votes **(A)**; announcement effect `P ×= 1 − (2% + 0.5 × dilution%)` (3.4.3). Private companies place new shares with unnamed investors at their shown value (0.7 × V, 5.13) less 8%, with no price effect **(A)**. Rights issues on pre-emption exchanges (3.4.3) are not used, since the MVP has one world exchange **(A)**.
  - **Dilution**: shares_out rises by the new shares, which go to an unnamed **new investors** holder on the cap table; every existing holder's stake falls by `old shares ÷ new shares`. The controller stays the controller; control contests are out of scope **(A)**.
- **Success roll (T)**: `chance = 50% + 100 × (confidence factor − 1) + news adj + method adj − 10% × consecutive failed raises`, clamped 5% to 95%. Investor confidence is the confidence factor of 5.7 (0.8 to 1.2, so ±20 pp). News adj by the industry's phase label (5.1): Boom +30 pp, Normal 0, Glut −15 pp, Bust −35 pp. Method adj: credit line +20 pp, share issue 0.
- **Failure**: nothing is raised and the company tries again at the next plan lock. Until a raise succeeds, 6.2 holds g at −d_eff (no purchases). When cash runs out with the line full, it enters the bankruptcy path of 5.12: forced sales, then Bankrupt and frozen with shareholders wiped, then removed.
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
| Fixed cost rate | `f × turnover − d_eff − shared costs ÷ gross` (5.5; d_eff is 0 at $10M of assets or less, 5.10) |
| Asset book | `0.5 × gross` **(A)** |
| Cash and line | If book_value ≥ asset book: cash = book_value − asset book, line 0. Else line drawn = asset book − book_value + min_cash, cash = min_cash **(A)** |
| Rating | Implied rating from the starting run rate (5.12), no smoothing |
| Plan | 6.2 to 6.5 with g_dem; loss_q 0 |
| History | Four synthetic quarters at the run rate, for TTM and the Q4 2019 release **(A)** |
| Shares | Listed: `shares_out = fair value ÷ $25`; P = V = $25 **(A)** |
| Barebones exception | R below $0.1M: the barebones loadout (10.0.11.1): one $100,000 asset, 1 labor unit, CEO on productivity, 10 base and 10 data compute, 0 TB |

**Arrowhead check** (R $40M, Oil, Edmonton), at the MVP defaults (batch 148): location 0 (the defaults have no fit or resource tags); labor_value $100,000; first pass PC bonus +3 (400 labor units, 100 stations), second pass +2. Gross assets `40 × 1.0 × 100 ÷ 102 ≈ $39.2M`; 392 labor units; 98 productivity stations (PC 98, +2); 1 enterprise station; held structured data about 8.6 TB at start (1% free R&D, $0.4M), rising toward about 20 TB (2%) as its one station runs at capacity; about 293 idle (decay 0.3). Revenue $40M at M 1.0; EBIT before R&D about $2.35M (5% plus 0.45 × 2 ÷ 102 from the PC bonus); Terry's Greedy trait makes it a Cash cow, so its R&D target is 0.05 × 0.7 × 0.8 = 2.8%, less 1% free: paid R&D about $0.7M and EBIT after R&D about $1.6M (4.1%); holding its assets flat costs about $0.29M a year in replacement (1% of the $29.2M above $10M, batch 149). Its batch 145 figures at the 10.3 Oil values (location +3, $95.2M of assets, EBIT before R&D $11.2M) return with the per-industry rework (11.2).

### 7.2 Industry fringe pools (10.0.10)

`fringe_assets = max(0, world_size − Σ named R) ÷ turnover`. Named revenue is below world size in all 42 industries in companies.csv (checked: e.g. Oil $1.35T of $2.5T, Data centers $38B of $100B). With named units calibrated to R at M 1.0 and fringe at productivity 100, every industry starts at S = 1.0 and M = 1.0.

### 7.3 Countries and the world

The global cycle starts in Expansion with g_t and its quarters left drawn **(A)**; every industry's demand_core and trend_demand start at its 2020 world size, prev_q_growth at lt_q, the AI stage at Preboom, the pop date rolled (5.1.1), and the Q1 2020 growth draw is made at load (5.1); labels follow from it; base rate 3%; clock 2020-01-01 00:00, paused. The euro crisis of the old cycle groups now lives in the euro area's 1.2 intensity and its ratings and spreads (2.2) (decided, Logan, batch 151, 3a); since batch 155 it reaches companies through the EU zone's credit spread (78 bps, 5.1.2). Each zone's economy settings load from financial-zones.csv and stay static in the MVP.

---

## 8. Read-only screens

All built from 20-ui. Every action button is hidden or shows a lock icon with "Read-only MVP".

| Screen | Source | MVP content |
|---|---|---|
| **Main screen** | 20.2.1 | Top bar with date, hour, weekday, pause, speeds 1 to 5, Skip menu (next release, next plan lock, next recap, month end) and the **quarter clock** (phase name, days to next phase, 21.8); alert row; left rail with Company, Industries, Pdoomberg, Recap; outliner with a watchlist |
| **Map** | 20.7.10, 2.24 | Zoom World, Country, Province. Modes: **Political** (default); **Development** (Commerce, Industry, Population, Total); **Industry** (the Industry track, or with an industry picked, that industry's business assets by province as a heat map); **Company HQs** (pins sized by revenue, colored by sector; filters by industry, country, listed); **Financial zones** (batch 152: the 26 zones since batch 154, each shaded by its current effect `intensity × g(t − lag)`, with Macau as its own zone; a pin on each hub city with its exchange code and headline index level; hovering a zone shows its number, members, intensity, lag, contagion, listed company count and, since batch 155, its base and effective credit spread and investor confidence (batch 157); legend with the global phase, g_t and quarters left; replaces the Economic cycle mode); Metro outlines over any mode. Clicking a province opens a province card: development, resource, terrain, Metro, key city, HQs and units there |
| **Company** | 20.7.2 | Header: name, ticker, HQ, industry, owner of record, controller. Tabs: **Overview** (value, price, confidence, management score, cash, line, rating, next release); **Board** (seat cards for labor units 1 to 5, skill used); **Cap table** (static holders); **Units** (industry, base province, assets, productivity, growth, R&D, revenue, expenses); **Financials** (quarterly statements, Quarter view with last results and projection ranges, 21.5.3); **Tech** (labor split, stations, PC and next step, data quests card with progress bar, inflow vs decay, 10.0.11.7) |
| **Industries** | 20.7.6 | Table of 42: demand, supply, S, M, phase label, long-term growth, this quarter's growth (a year, `(1 + q_growth)^4 − 1`), fringe share, top 5 companies; detail view with a 20-quarter chart of demand vs supply, quarterly growth bars against the long-term line, and the company list. A header strip shows the global phase and g_t (batch 150) |
| **Pdoomberg** | 20.5.2, 3.13.1 | Full-screen terminal. F2 Quotes (watchlists: All, by industry, by country, Disclosure radar hidden); F3 Chart (daily bars with the estimated fair value band, ±15% for listed companies, 3.14.2; true V is never shown); F4 Order shows "Read-only MVP"; F5 Filings (quarterly statements); F6 Ratings (credit ratings only); F7 Bonds (base rate, zone credit spreads and sovereign spreads, batch 155); F9 Industries; F10 Screener (read-only filters) |
| **Quarterly recap** | 20.7.9, 21.6.2 | Opens the pre-quarter-end week. World page: global phase and g_t, industries by phase label, biggest expected beats and misses by projection. Company page (watchlist companies): anticipated earnings range, expected reaction, confidence, outlook (news phase, losses, rating watch). No guidance choice |
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
| `list_countries(filter)` / `get_country(iso3)` | Rows / detail with financial zone, tax, sovereign rating, sovereign spread, HQ count (economy settings are on the zone, batch 155) |
| `get_cycle()` | Global phase, g_t, quarters left, Z, and each zone with its intensity, lag, contagion and current effect (batches 150 and 152) and its economy settings: base and effective credit spread, investor confidence (batches 155 and 157); the AI stage, boom year and boom date (batch 151; the rolled pop date only in Omniscient) |
| `get_province(id)` | Province card: tracks, tags, Metro, key city, HQs, units with assets there |
| `get_map_layer(mode, param)` | PackedFloat32Array or PackedInt32Array per province, plus legend |
| `list_key_cities()` / `list_metros()` | Rows with province ids |
| `list_exchanges()` / `get_exchange(code)` | The 26 zone exchanges (batches 152 and 154): code, name, zone number and id, hub city and hub province, headline index name and level, listed company count / detail adding the listed companies (those whose HQ country is in the zone) and the index constituents |
| `list_companies(filter)` | filter: industry, country, superregion, zone, exchange, public, archetype, sort, limit, offset. Rows: id, name, ticker, industry, hq, exchange (listed companies, batch 152), revenue TTM, NI TTM, price, change, value, rating |
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
| `get_rates()` | Base rate, zone credit spreads, sovereign spreads, rating spreads (batch 155) |
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
| M2 | Economy core: demand (global cycle, financial zones, quarterly growth draws, phase labels), fringe, supply, S, M, revenue, expenses, productivity, growth | At load every industry has S 1.00 and named revenue matches companies.csv within 0.5%; the engine's 40-quarter seeded growth run matches validate.py's growth check (5.1) |
| M3 | Operations and data: labor, seats, stations, PC bonus, data create, convert, decay, free R&D | Arrowhead check (7.1) passes |
| M4 | Books: ledger, statements, tax, credit line, rating, dividends, asset decay, distress, bankruptcy and removal | Balance sheet balances every month for every company still in the game |
| M5 | Valuation and price: fair value, hourly price, earnings jump, reaction week | Opening price $25 at V; prices track V within ±30% over 10 years |
| M6 | Lite AI and the quarter loop: plan lock, consensus, projections, recap, news wire | A full year runs four releases, four locks, four recaps |
| M7 | GDExtension API and views; Godot shell: top bar, time controls, alerts | Godot runs the sim at all speeds; screens read views only |
| M8 | Map: geometry pipeline (gap G1), zoom, map modes, province card | All 3,255 provinces clickable |
| M9 | Screens: Company, Industries, Pdoomberg, Recap, News | Every section 8 screen opens in under 100 ms |
| M10 | Soak and balance: 30-year headless run, determinism replay | 30 years in under 2 minutes headless; same seed gives the same hashes; balance targets below; the AI boom and the pop fire on their dates and, with noise off, AI labs demand matches validate.py's boom run (5.1.1, batch 151) |

**Balance targets after 10 years (T):** at least 85% of the 651 companies neither bankrupt nor removed; industry revenue within ±30% of the trend path; median productivity 90 to 110; no industry stuck at an M clamp for more than 8 quarters; 30% to 60% of releases are beats; the 2020 to 2029 run before the boom (5.1.1): each industry's 10-year average demand growth within ±3 pp of its long-term rate in 90% of seeds, and 10% to 25% of industry-quarters labeled Boom and 10% to 20% Bust (batch 150).

---

## 11. Gaps and open questions

The most important things the docs do not define well enough to build, each with a recommended answer or, where Logan has ruled, his decision.

| # | Gap | Recommended answer |
|---|---|---|
| G1 | **No province geometry.** The province files have no shapes or coordinates, so the map cannot be drawn | **Decided (Logan, batch 145):** province shapes are generated from real-world boundary data into a province-id bitmap and province-centroids.csv in tools/. Sources and method: [map-sources.md](map-sources.md) |
| G2 | **Board seats need about 2,700 people.** characters.csv has 296; most companies need up to 5 seated executives for the management score | **Decided (Logan, batch 145):** simple characters (3.7.1) are generated as needed to fill the seats: name, age, six skills by company size, one or two role traits, always the default choice. Named controllers stay off boards in the MVP and only nudge the AI through traits |
| G3 | **Depreciation vs margin** (C11). 10% a year on capital-heavy assets eats Oil, Utilities and Renewables margins whole | Depreciation now equals asset decay, 5 to 10% by industry (Logan, batch 145); it is part of the fixed cost share, and margin_full_use is the margin before R&D (5.5 profit check). MVP: one decay rate, 8%, for all industries (batch 148); now 1% a year above $10M of a unit's assets (Logan, batch 149) |
| G4 | **Missing industry numbers**: Banking and Insurance capital ("uses deposits"), AI labs margin (-40% to +40%), per-industry R&D norms, "Positive" rate sensitivity | Banking capital 1.25, Insurance 0.60 (Logan's $1 and $0.50 base moved toward real capital ratios, batch 145, 11.2); AI labs margin 0%; the rd_norm table in 11.2; Positive treated as 0 until rates move. **Parked (Logan, batch 148):** the MVP uses the shared defaults (2.2); these values wait for the per-industry rework (11.2) |
| G5 | **Corporate tax, sovereign rating and spread are not in countries.csv** (2.2.5 says the tax is there) | **Built (batch 147); decided (Logan, batch 148: 2a, 3a, 4a):** keep the real 2020 corporate tax rates, the wage index from wealth_index (batch 157: no longer a wage index; labor is the industry labor_value) and the real January 2020 sovereign ratings moved for the alternate history. country-economy.csv (2.2): tax levels from 2.2.3 for the majors and Haven for the havens, rates at real 2020 values (havens 3%); ratings from real January 2020 ratings moved for the alternate history, since the 3.6.3 inputs are not in the data; spreads from the 3.6.2 table plus crisis premiums |
| G6 | **Starting balance sheet and share count**: companies.csv has book equity but no cash, debt, asset book or shares | Asset book = 50% of gross; cash or line fills the gap to book equity; shares set so price opens at $25 at engine value |
| G7 | **Distress without the default chain**: the MVP has no bonds, creditors or restructuring | **Decided (Logan, batch 145):** forced asset sales at the cycle sale factor; after 6 months or no assets, Bankrupt and frozen for 2 quarters with shareholders wiped; then removed from the game (5.12; timings T) |
| G8 | **One unit per company, all at HQ**: companies.csv gives one industry and no asset spread, so diversified groups and multi-province spreads do not exist | **Decided (Logan, batch 145):** one business unit per company, at HQ, for the MVP. Post-MVP: business-units.csv (company, industry, share of revenue, province shares) so the map's industry layer shows real footprints |
| G9 | **Batch 143 board-seat items.** The board meeting chain (21.4) and the labor seats of batch 142 left open: board size beyond 5 seats, charter minimums under 5 labor units, election vs controller appointment, investor and government seats, and starting data (1-corporate-core 1.8.1); the grading formula, performance score and firing threshold (21.4.1 to 21.4.3, 21.9 items 6 to 8) | **Decided (Logan, batch 146; batch 143 picks):** charter seats beyond the 5 labor seats are ordinary directors with no labor unit; the charter minimum of 5 applies only from 5 labor units; when a seat opens the controller appoints and the appointee stands at the next yearly meeting; VC, strategic-investor and government seats take the next labor seat as it opens, or sit beyond 5 if all are full (1-corporate-core 1.8.1); the 651 starting companies keep their generated starting data and new companies start empty (7.1). The MVP still has no elections, firing or board play (C14); the grading, performance score and firing values stay as in 21.4 (T, 21.9) |
| G10 | **Thin margins after R&D at the norm.** margin_full_use minus rd_norm is negative for Consumer electronics (-2%), EVs (-6%), E-commerce (-1%) and AI labs (-15%), and about 0 for Autos, Aerospace and Robotics, so these start at or below break-even before interest. Older than batch 145; asset decay does not change EBIT | **Decided (Logan, batch 146):** intended. The four are cash-burning industries that live on investor money (10-industry-economy 10.3); their margins and rd_norm stay as they are. When runway falls under 4 quarters they raise money by a discounted share issue or, if rated, a credit line draw, with success set by investor confidence and the news phase; failures go down the bankruptcy path (6.6). Autos, Aerospace and Robotics are not cash-burning; check them in the M10 soak **(T)**. **Parked (Logan, batch 148):** with the shared defaults no industry is thin or cash-burning (2.2); the flags and the 6.6 rule return with the per-industry rework (11.2) |
| G11 | **Zone economy details (batches 155 to 158). Decided.** | Logan, batch 156: (1a) corporate tax stays national (C28); (2a) zone values are set directly per zone, seeded from GDP-weighted member averages (5.1.2); (3b) a company's home government softens the zone: home_spread = half zone credit spread + half home sovereign spread (5.1.2, 5.12, 5.13). Logan, batch 157: (1ab) base spread plus a quarterly cycle term (k 8, clamp 0.5x to 2x base, T); (2a) confidence per zone exchange from its index and news (T); (3) no geographic wage or price level. Logan, batch 158: (1) the WI and PF leftovers are restated with flat prices **(A)**: 2-map 2.8.4 wages and training, 2.8.6 union thresholds, 2.16 pools, 2.17 targets, province weight (total development × $0.3B; batch 159 adds the GDP per head factor G; batch 160 makes it sqrt of the ratio, safety clamp 0.1 to 4) and sponsorship; 4-politics bribes, legal fees and every "× wealth index" price, and the 4.23 guard and cyber team costs; 14-software 14.4.1 `L` (flat $100); 1-corporate-core spending budgets; 5-ideology retraining; 6-technocapital robotaxi revenue. wealth_index is an equality index and multiplies no cost; bodyguards are removed. (2a) exchange confidence feeds fair value through X (5.13). Batch 159: the 2.14 examples are restated and rich-country provinces weigh more again through G (GDP per head, not equality). Open: equality could plausibly feed unrest, unions or bribe acceptance later, but nothing reads it |

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
10. 10.0.11.1: say that the barebones company's $100,000 of expenses include R&D at the norm (C18).

### 11.2 Later: per-industry rework (Logan, batch 148)

Logan: "we will rework them one by one once companies are known working." The MVP runs every industry on the shared defaults (2.2). These per-industry values are parked, not dropped; each industry is reworked one at a time after the default companies are shown working (M10 soak). The batch 147 values are in [10-industry-economy.md](../detailed/10-industry-economy.md) 10.3, 10.3.1 and 10.0.11.10 and in gen.py (`PER_INDUSTRY = True` rebuilds them).

| Item | Parked values (batch 147 and earlier) |
|---|---|
| Margin and cost structure | margin_full_use, f and v per industry (10.3); AI labs "-40% to +40%" stored as 0 (G4) |
| Capital per $1 | 0.1 (Asset management) to 4.0 (Renewables) (10.3); Banking 1.25 and Insurance 0.60 as regulatory capital (batch 145, below) |
| Asset decay | 10%: AI labs, Cloud, Data centers, Software, SaaS, Social media, Ads, Consumer electronics, Gaming, Gambling, Semiconductors, E-commerce, Drones, Robotics. 8%: Telecom, Banking, Insurance, Asset management, Chemicals, Autos, EVs, Aerospace, Defense, Shipping, Logistics, Airlines, Construction, Retail, Fast food, Luxury, Pharma, Healthcare services, Professional services, Black market. 6%: Oil, Gas, Mining, Metals, Agriculture. 5%: Power utilities, Renewables, Real estate (Logan, batch 145). The rework should also say whether the $10M threshold of batch 149 stays for all industries |
| R&D norm | 15%: AI labs, Pharma, Semiconductors, Software. 12%: SaaS. 10%: Cloud, Social media, Gaming, Consumer electronics, Robotics, Drones, EVs, Aerospace, Defense. 6%: Ads, Data centers, Telecom, Autos, Chemicals, Gambling, E-commerce. 3%: Banking, Insurance, Asset management, Healthcare services, Professional services, Power utilities, Renewables, Metals, Mining, Agriculture, Shipping, Logistics, Airlines, Luxury, Real estate. 2%: Oil, Gas, Construction, Retail, Fast food, Black market **(T)**. When R&D comes back per industry, keep C18: margin_full_use is the margin before R&D |
| Operations modifiers | labor_value, PC per station, TB per $1M and data decay base by industry (10.0.11.10) |
| Cycle and rates | Cyclicality β 0.2 to 2.0 (now the cycle_beta multiplier of the growth draw, 5.1), volatility per industry (batch 150), and rate sensitivity Low to Very high, "Positive" for Banking and Insurance (10.3) |
| Earnings multiple | M_sector by valuation group (3.3.2); Black market valued with Professional services |
| Fit and resource tags | Commerce, Industry or Extraction and the matching resource tags (10.3.1), which give the location bonus (5.4) |
| Cash-burning flags | Consumer electronics, EVs, E-commerce and AI labs (Logan, batch 146); the 6.6 raise rule is kept for them |
| Bank and insurer capital | **Logan, batch 145 (T).** A bank's or insurer's business assets are its regulatory capital; deposits and float fund the loans and claims off the game's books (3.17). Banking: capital about 10 to 15% of risk-weighted assets (Basel III about 10.5% with the buffer), revenue about 5% of total assets, risk-weighted assets about 55% of total assets, so about $1.30 of capital per $1 of revenue: 1.25 (base 1.0). Insurance: required capital about 30 to 40% of premiums at about 170% coverage, $0.55 to $0.65 per $1 of premiums: 0.60 (base 0.5). Asset decay 8% stands for loan losses and claims run-off |
| Oil and gas indices | Margins at oil and gas index 100 (10.6) |
| AI boom links (Logan, batch 153) | Q2 decided: boom_uplift Data centers 0.15, Semiconductors 0.10, Cloud 0.05 (5.1.1). Q3 decided: the pre-boom growth of Cloud (20%) and Data centers (15%) is reworked here, not in the MVP |
