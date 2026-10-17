# 10. Industry economy (Wall Street Raider style): detailed design

_Status: draft v0.2 (2026-10-17), batch 21 answers applied. Logan scrapped the Victoria 3 goods model and asked for Wall Street Raider style economic modeling. This file replaces goods, recipes, production methods, hub goods prices and shipments in [2-map-influence-economy.md](2-map-influence-economy.md) (2.6, 2.7, 2.9, 2.15; see the banners there). The map, hubs, influence, strata, real estate, the business cycle, travel and politics stay. Feeds company financials (2.13) and stock values ([3-markets-and-fx.md](3-markets-and-fx.md) 3.3). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 10.12.

---

## 10.1 Decided by Logan

| Topic | Decision |
|---|---|
| Goods | The Victoria 3 style goods model is scrapped: no goods tables, recipes, production methods, per-hub goods prices or shipments. |
| Model | Wall Street Raider style: the economy is a set of **industries**, and companies earn money from the industries they operate in. The player reads and plays the economy through company financials, not factories. |
| Business units | A business unit is **one building or site** (a fab, a mine, a data center, a store chain's flagship, an office), sitting on a plot in a hub. |
| Energy and GPUs | Measured in **dollars** like every other industry; nothing is counted in physical units. |
| Industries | About 36, as in 10.3. |
| Running units | **Mostly automatic.** The company's executives run its sites; the player buys, sells and merges (10.5). |

## 10.2 The model in one paragraph

Every country has a size for each **industry** (yearly revenue). The industry grows on its own trend and swings with the business cycle, interest rates and its cost drivers. Companies own **business units**, each one building or site in a hub, in one industry. A site sells into its industry in its country, takes a **market share** limited by its **capacity**, and turns revenue into profit through its **margin**. Profit flows into the company's financial statements, which set its fundamental value and share price. Executives run the sites on their own; the player buys, sells, builds, merges and spins off sites the way Wall Street Raider players trade operating businesses.

## 10.3 Industries

About 36 industries at the start **(A)**, each with fixed traits. Sizes are given per country in the starting world data (7-starting-world); the world totals below are for scale.

| Industry | Sector | World size 2022 ($/yr) **(T)** | Trend growth **(T)** | Cyclicality β **(T)** | Rate sensitivity **(T)** | Margin at full use **(T)** | Fixed cost share f **(T)** | Capital per $1 of capacity **(T)** | Main cost drivers | Slop per $1M **(T)** |
|---|---|---|---|---|---|---|---|---|---|---|
| Lithography machines | Tech (GPU chain) | $22B | Boom-driven (10.6) | 1.5 | Low | 35% | 0.45 | 1.2 | Electricity | 0 |
| Foundry (wafers) | Tech (GPU chain) | $130B | Boom-driven (10.6) | 1.6 | Medium | 30% | 0.55 | 2.5 | Electricity, lithography service | 0.1 |
| Chip packaging | Tech (GPU chain) | $45B | Boom-driven (10.6) | 1.6 | Medium | 18% | 0.40 | 1.0 | Electricity | 0.1 |
| GPU design and boards | Tech (GPU chain) | $60B | Boom-driven (10.6) | 1.8 | Low | 25% | 0.20 | 0.2 | GPU chain prices | 0.5 |
| Other chips | Tech | $450B | +6% | 1.4 | Medium | 22% | 0.45 | 1.5 | Electricity | 0.1 |
| AI labs | Tech | $5B | Boom-driven | 2.0 | High | -40% to +40% | 0.70 | 0.3 | Compute (6.2) | 2 |
| Cloud and data centers | Tech | $400B | +18% | 1.0 | Medium | 25% | 0.55 | 1.8 | Electricity, GPU price | 0.2 |
| Software and SaaS | Tech | $600B | +11% | 0.8 | High | 25% | 0.60 | 0.2 | Wages | 1 |
| Social media and ads | Tech | $700B | +9% | 1.5 | Medium | 30% | 0.50 | 0.4 | Wages | 8 |
| Consumer electronics | Tech | $1.1T | +3% | 1.3 | Low | 8% | 0.25 | 0.4 | GPU price, other chips | 3 |
| Telecom | Tech | $1.6T | +1.5% | 0.4 | Medium | 18% | 0.65 | 2.0 | Electricity | 1 |
| Banking | Finance | $2.5T | +4% | 1.4 | Positive (gains when rates rise) | 30% | 0.55 | Uses deposits (3.17) | Credit losses | 0.5 |
| Insurance | Finance | $6T | +4% | 0.6 | Positive | 8% | 0.30 | Uses float (3.17) | Disasters | 0.3 |
| Asset management | Finance | $500B | +6% | 1.5 | Medium | 30% | 0.50 | 0.1 | Markets level | 0.2 |
| Crypto exchanges | Finance | $20B | ±60% swings | 2.5 | High | 40% | 0.40 | 0.1 | Coin prices (9.3) | 3 |
| Oil and gas production | Energy | $3.5T | +1% | 0.8 | Low | 25% at oil index 100 | 0.60 | 2.5 | Oil and gas prices (10.6) | 0.2 |
| Refining | Energy | $1.8T | 0% | 1.0 | Low | 6% | 0.35 | 1.0 | Oil price | 0.5 |
| Power utilities | Energy | $2.5T | +2.5% | 0.3 | High | 15% | 0.70 | 3.0 | Gas price | 0.3 |
| Renewables | Energy | $350B | +12% | 0.6 | Very high | 20% | 0.80 | 4.0 | Rates | 0.1 |
| Mining and metals | Industry | $2T | +2% | 1.6 | Low | 15% | 0.55 | 2.0 | Electricity, oil | 0.3 |
| Chemicals | Industry | $4T | +3% | 1.2 | Low | 10% | 0.40 | 1.2 | Gas price | 1 |
| Autos and EVs | Industry | $3T | +2% (EVs +25%) | 1.8 | High | 6% | 0.35 | 0.8 | Other chips, metals | 3 |
| Aerospace and defense | Industry | $800B | +4% (war-driven) | 0.3 | Low | 11% | 0.40 | 0.8 | Government budgets (4.x) | 0.5 |
| Robotics and drones | Industry | $60B | +15% | 1.5 | Medium | 10% | 0.35 | 0.7 | Other chips | 0.5 |
| Shipping and logistics | Industry | $1.4T | +3% | 1.3 | Low | 8% | 0.50 | 1.5 | Oil price, chokepoints (10.7) | 1 |
| Airlines | Industry | $500B | +5% | 1.8 | Low | 5% | 0.60 | 1.5 | Oil price | 2 |
| Construction | Industry | $13T | +3% | 1.6 | Very high | 5% | 0.20 | 0.3 | Metals, rates | 2 |
| Retail and e-commerce | Consumer | $25T | +4% | 1.0 | Medium | 4% | 0.30 | 0.4 | Wages, shipping | 10 |
| Fast food and packaged food | Consumer | $8T | +1% (saturated) | 0.3 | Low | 8% | 0.30 | 0.6 | Wages | 40 |
| Luxury | Consumer | $350B | +5% | 2.0 | Low | 25% | 0.35 | 0.5 | Glitterati and above wealth | 0 |
| Media and entertainment | Consumer | $2.3T | +4% | 1.0 | Medium | 15% | 0.55 | 0.5 | Wages | 25 |
| Gaming and gambling | Consumer | $600B | +8% | 0.6 | Low | 22% | 0.40 | 0.5 | GPU price (gaming) | 30 |
| Pharma | Health | $1.4T | +5% | 0.2 | Low | 22% | 0.55 | 0.6 | R&D | 2 |
| Healthcare services | Health | $8T | +5% | 0.2 | Low | 8% | 0.50 | 0.7 | Wages | 1 |
| Cyberware clinics | Health | $15B | +20% | 1.2 | Medium | 25% | 0.45 | 0.8 | Other chips | 3 |
| Security and PMCs | Services | $250B | +6% (unrest-driven) | 0.3 | Low | 10% | 0.40 | 0.3 | Unrest (2.8.5) | 1 |

- **Real estate** is not in this table: it stays as plots, buildings and rents (2.16).
- **Cyclicality β**: industry demand × (1 + β × the country's cycle demand modifier, 2.18.1). A β of 1.8 in a -5% recession cuts demand 9%.
- **Rate sensitivity**: demand × (1 - s × (policy rate - neutral rate)), with s = 0 (Low), 1 (Medium), 2 (High), 3 (Very high) **(T)**. Banks and insurers use it the other way round on their margin.
- **Strata spending** (2.8.0): consumer industries' size in a country moves with the spending of each stratum there. The PMC's needs (housing, energy, healthcare) map to real estate, power utilities and healthcare services; unmet needs raise unrest (2.8.5) **(A)**.

## 10.4 Business units (sites)

A business unit is **one building or site** (Logan): a fab, a mine, an oil field, a data center, a refinery, a hospital, a head office for a software business. It sits on a plot in a hub district (2.16), belongs to one industry, and sells into that industry in its hub's country. A company with three fabs in Hsinchu has three units; its share of Taiwan's foundry industry is the sum of theirs. Its book assets count for influence in its hub (2.5.2).

| Trait | Meaning | Range **(T)** |
|---|---|---|
| **Capacity** | The most revenue the site can earn per year, in dollars | Any; typical sizes in 10.4.2 |
| **Market share** | Its share of the industry in that country | 0% to 100% |
| **Quality** | How strong the site is against rivals | 0.5 to 2.0, starts at 1.0 |
| **Book assets** | Capital tied up, = capacity × the industry's capital per $1, less depreciation | |
| **Condition** | Wear; falls without upkeep, cuts capacity below 50 | 0 to 100 |

### 10.4.1 Monthly calculation

1. **Industry demand** in the country: base size × trend × cycle × rates × cost-driver pass-through (10.6) × event modifiers.
2. **Target share** of each unit = `capacity × quality × stance factor` ÷ the sum over all units in that industry and country, with imports filling the rest when a country lets foreign units sell there (2.2.2).
3. Each unit's share moves 15% of the way to its target each month **(T)**, so share is sticky.
4. **Revenue** = min(capacity, share × demand) ÷ 12.
5. **Operating costs** = `revenue × v × D + capacity ÷ 12 × f`, where f is the industry's fixed cost share, v = 1 - margin - f, and D is the cost driver index (1.0 at base prices). Fixed costs are paid on capacity, so a half-empty unit loses money: this is the operating leverage that makes recessions bite.
6. **Depreciation** = book assets ÷ 10 years ÷ 12 **(T)** (4 years for cloud servers, 25 years for real estate).
7. The result feeds the income statement (2.13.2): revenue, operating costs as cost of sales and SG&A, R&D and marketing as their own lines, then depreciation, interest and tax as before.

**Quality** moves each quarter: +0.02 per point of the managing executive's Operations above 10 (the COO, or the CEO when there is no COO), plus the effect of the executives' automatic choices (10.5.1), tech tier bonuses (2.12) and events; it drifts back toward 1.0 by 2% a quarter **(T)**.

### 10.4.2 Typical site sizes (T)

| Site | Industry | Capacity per year | Build cost |
|---|---|---|---|
| Advanced fab | Foundry | $10B | $25B |
| Lithography plant | Lithography machines | $5B | $6B |
| Packaging plant | Chip packaging | $2B | $2B |
| GPU design campus | GPU design and boards | $10B | $2B (plus the tape-out rule in 6.7.0) |
| Hyperscale data center | Cloud and data centers | $2B | $3.6B |
| Oil field | Oil and gas production | $3B | $7.5B |
| Power plant | Power utilities | $1B | $3B |
| Car plant | Autos and EVs | $8B | $6.4B |
| Software office | Software and SaaS | $1B | $0.2B |
| Hospital | Healthcare services | $0.5B | $0.35B |

## 10.5 What the player decides

Running sites is **mostly automatic** (Logan). The player plays the Wall Street Raider game on top: deals, not operations.

### 10.5.1 What executives do on their own

Each month the company's executives set every site's pricing stance, R&D, marketing, upkeep and staffing by themselves **(A)**. How well they do it comes from their skills and traits: a high-Operations COO keeps costs and quality up; a Greedy CEO starves R&D for short-term profit; an Ambitious one over-expands. The player shapes this only indirectly, through who sits in which board seat (1.8), the company's charter, and pressure as a shareholder. Executives also propose expansions and closures, which the board approves (1.8.4).

### 10.5.2 Player deals

| Deal | Effect **(T)** | Takes |
|---|---|---|
| **Buy a site** | From another company for cash or shares, priced by negotiation or auction; its share, quality and staff move with it. Antitrust review above 30% share in a country (4.9.5) | 1 to 3 months |
| **Sell a site** | The other side of a purchase | 1 to 3 months |
| **Merge** | Two sites in the same industry and hub owned by one company become one; quality is the capacity-weighted average +0.05, fixed costs -10%. Whole companies merge through 1.9 | 3 months |
| **Build a site** | Buy or lease a plot (2.16) and pay the build cost (10.4.2); starts at quality 0.9 | 6 to 24 months |
| **Close a site** | Sell its assets at 60% of book; severance of 3 months' fixed cost; may trigger strikes (2.8.6) | 1 month |
| **Spin off** | One or more sites become a new company; shares go to the parent's holders or are sold in an IPO (3.4) | 3 months |

This keeps the Wall Street Raider moves: buy a conglomerate, strip and sell its best sites, merge what is left with your own, spin off the rest.

## 10.6 Energy and the GPU chain in dollars

Energy and GPUs are measured in dollars like every other industry (Logan). Nothing is counted in physical units.

- **Price indices.** Oil, gas, electricity (per country grid) and GPUs each have a **price index**, 100 at the start. Each month an index moves toward `100 × (world demand ÷ world capacity)^(1/ε)` for its industry, with ε from 2.9.2 (oil 0.3, gas 0.4, electricity 0.2, GPUs 0.5) **(T)**. Oil and gas indices trade as futures on the commodity exchanges ([3-markets-and-fx.md](3-markets-and-fx.md)). Shocks in 2.6.0 (Hormuz, cartel cuts, sanctions, the Red Sea) cut capacity directly, so the index jumps.
- **Cost driver index D.** For each industry, D = 1 + the weighted change of its cost drivers' indices from 100 **(T)**. Example: airlines with oil 40% of variable cost; oil index 150 gives D = 1.20.
- **Pass-through.** Each industry passes part of D to its prices: commodities 80%, most industries 50%, regulated utilities 100% after 6 months **(T)**. Pass-through raises revenue and lowers demand by the industry's price sensitivity.
- **GPU chain.** The four layers in [6-technocapital.md](6-technocapital.md) 6.7.0 are four dollar industries. GPU design and boards grows with the consumer and AI demand growth rates in 6.7.0 (the AI part follows the boom trigger and the boom rate rolled for the save); the layers above grow with it. When the GPU index is above 100, consumer GPU demand is cut by the 6.7.0 price sensitivity, so the boom still pushes gamers out first.
- **Techno-Capital** still needs counts (6.2), so they are derived from dollar capacity **(T)**: every $1B a year of foundry capacity holds 4 lithography machines; every $1B a year of cloud and data center capacity gives 150,000 H a month of compute. A lithography machine's price is shown as $200M × the GPU index ÷ 100.

## 10.7 Trade, chokepoints and disruptions

Goods no longer ship along routes. Instead:

- Each industry has an **exposure** to each chokepoint (0 to 1) **(T)**: shipping 1.0, oil and gas production 0.6, consumer electronics 0.5, chip packaging 0.4, software 0.
- When a chokepoint is at Tension, Attacks, Conflict or Closed (2.4.2), exposed units pay more (D rises by exposure × 2%, 5%, 15%, 30%) and lose capacity (exposure × 0%, 2%, 10%, 30%) **(T)**.
- **Tariffs and trade wars** (4.11) cut the share foreign units can win in a country and add to their D.
- **Links between industries.** An industry's cost drivers are other industries' prices, so shocks spread: oil up → airlines, chemicals and shipping costs up → their earnings fall → their shares fall → trusts holding them lose value.

## 10.8 Slop

Slop is now produced per dollar: each unit makes `revenue × its industry's slop per $1M` a month in its home country **(T)**. The rules in 2.8.0 for slop need and the 0.8 and 1.2 ratio bands stay the same.

## 10.9 What happens to the old economy sections

| Section in 2-map | Status |
|---|---|
| 2.6 Goods (except 2.6.0's energy shocks) | Retired; replaced by industries (10.3) |
| 2.7 Facilities and production methods | Retired; replaced by business units (10.4). Buildings stay as real estate (2.16) |
| 2.8 Population and labor | Kept, with needs read as spending on industries (10.3) |
| 2.9 Demand and prices | Retired except electricity pricing (2.9.7) and black markets (2.9.9) |
| 2.10 Supply contracts | Kept only for Techno-Capital and GPU chain capacity (6.7.0) |
| 2.13 Financial statements | Kept; input, freight and inventory lines fold into operating costs |
| 2.15 Competition and market share | Retired; replaced by 10.4.1 |
| Worked examples 2.14.3, 2.14.6, 2.14.9, 2.14.10, 2.25.1 | Retired |

## 10.10 Worked example: a robotics unit in a recession

Halcyon Robotics has one US robotics plant (one site): capacity $3.0B a year, share 6%, quality 1.0, Market stance. US robotics demand is $40B a year.

- **Expansion** (cycle +2%, β 1.5): demand = 40 × 1.03 = $41.2B. Revenue = 6% × 41.2 = $2.47B a year (82% of capacity).
- **Costs** (margin 10%, f 0.35, so v 0.55; D 1.0): 2.47 × 0.55 + 3.0 × 0.35 = 1.36 + 1.05 = $2.41B. Operating profit $0.06B, a 2.5% margin, because 18% of capacity sits idle.
- **Recession** (cycle -6%): demand = 40 × 0.91 = $36.4B; revenue = $2.18B; costs = 1.20 + 1.05 = $2.25B. The unit now **loses about $70M a year**.
- **What happens next**: the COO decides on their own whether to cut costs or discount to win share (10.5.1). The player's moves are deals: sell the site before the recession deepens, or buy a weaker rival's site cheaply and merge it in to cut fixed costs 10%.

## 10.11 Tooltips

Hovering a unit's revenue shows: industry size → cycle → rates → pass-through → target share and current share → capacity cap. Hovering costs shows variable part, fixed part and D with each driver's contribution.

## 10.12 Assumptions and open items

1. Every number in 10.3 and the site sizes in 10.4.2.
2. The share model in 10.4.1 and the 15% monthly move.
3. Which choices executives make on their own (10.5.1), and the deal list in 10.5.2.
4. Price indices and the Techno-Capital conversions in 10.6.
5. Chokepoint exposure replaces shipping.
6. Slop per dollar of revenue.
