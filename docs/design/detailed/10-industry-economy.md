# 10. Industry economy (Wall Street Raider style): detailed design

_Status: draft v0.1 (2026-10-17). Logan scrapped the Victoria 3 goods model and asked for Wall Street Raider style economic modeling. This file replaces goods, recipes, production methods, hub goods prices and shipments in [2-map-influence-economy.md](2-map-influence-economy.md) (2.6, 2.7, 2.9, 2.15; see the banners there). The map, hubs, influence, strata, real estate, the business cycle, travel and politics stay. Feeds company financials (2.13) and stock values ([3-markets-and-fx.md](3-markets-and-fx.md) 3.3). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 10.12.

---

## 10.1 Decided by Logan

| Topic | Decision |
|---|---|
| Goods | The Victoria 3 style goods model is scrapped: no goods tables, recipes, production methods, per-hub goods prices or shipments. |
| Model | Wall Street Raider style: the economy is a set of **industries**, and companies earn money from the industries they operate in. The player reads and plays the economy through company financials, not factories. |

## 10.2 The model in one paragraph

Every country has a size for each **industry** (yearly revenue). The industry grows on its own trend and swings with the business cycle, interest rates and its cost drivers. Companies own **business units**: one unit is one company's operation in one industry in one country. A unit takes a **market share** of its industry, limited by its **capacity**, and turns revenue into profit through its **margin**. Profit flows into the company's financial statements, which set its fundamental value and share price. Players expand, shrink, buy, sell, merge and spin off business units the way Wall Street Raider players trade operating businesses.

## 10.3 Industries

About 36 industries at the start **(A)**, each with fixed traits. Sizes are given per country in the starting world data (7-starting-world); the world totals below are for scale.

| Industry | Sector | World size 2022 ($/yr) **(T)** | Trend growth **(T)** | Cyclicality β **(T)** | Rate sensitivity **(T)** | Margin at full use **(T)** | Fixed cost share f **(T)** | Capital per $1 of capacity **(T)** | Main cost drivers | Slop per $1M **(T)** |
|---|---|---|---|---|---|---|---|---|---|---|
| Lithography machines | Tech (GPU chain) | Set by units (10.6) | Boom-driven | 1.5 | Low | 35% | 0.45 | 1.2 | Electricity | 0 |
| Foundry (wafers) | Tech (GPU chain) | Set by units (10.6) | Boom-driven | 1.6 | Medium | 30% | 0.55 | 2.5 | Electricity, lithography service | 0.1 |
| Chip packaging | Tech (GPU chain) | Set by units (10.6) | Boom-driven | 1.6 | Medium | 18% | 0.40 | 1.0 | Electricity | 0.1 |
| GPU design and boards | Tech (GPU chain) | Set by units (10.6) | Boom-driven | 1.8 | Low | 25% | 0.20 | 0.2 | GPU chain prices | 0.5 |
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
| Oil and gas production | Energy | $3.5T | +1% | 0.8 | Low | 25% at $80 oil | 0.60 | 2.5 | Oil and gas prices (10.6) | 0.2 |
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

## 10.4 Business units

A company owns one or more business units. A unit is the company's operation in **one industry in one country** (a Shenzhen phone maker selling in the US and China has two units). Its home hub is where its book assets count for influence (2.5.2) and where its buildings sit on plots (2.16).

| Trait | Meaning | Range **(T)** |
|---|---|---|
| **Capacity** | The most revenue the unit can earn per year (for the GPU chain, a unit count, 10.6) | Any |
| **Market share** | Its share of the industry in that country | 0% to 100% |
| **Quality** | How strong the unit is against rivals | 0.5 to 2.0, starts at 1.0 |
| **Book assets** | Capital tied up, = capacity × the industry's capital per $1, less depreciation | |
| **Stance** | Pricing stance: Premium, Market or Discount (10.5) | |
| **R&D and marketing** | Low, Normal or High spending (10.5) | |

### 10.4.1 Monthly calculation

1. **Industry demand** in the country: base size × trend × cycle × rates × cost-driver pass-through (10.6) × event modifiers.
2. **Target share** of each unit = `capacity × quality × stance factor` ÷ the sum over all units in that industry and country, with imports filling the rest when a country lets foreign units sell there (2.2.2).
3. Each unit's share moves 15% of the way to its target each month **(T)**, so share is sticky.
4. **Revenue** = min(capacity, share × demand) ÷ 12.
5. **Operating costs** = `revenue × v × D + capacity ÷ 12 × f`, where f is the industry's fixed cost share, v = 1 - margin - f, and D is the cost driver index (1.0 at base prices). Fixed costs are paid on capacity, so a half-empty unit loses money: this is the operating leverage that makes recessions bite.
6. **Depreciation** = book assets ÷ 10 years ÷ 12 **(T)** (4 years for cloud servers, 25 years for real estate).
7. The result feeds the income statement (2.13.2): revenue, operating costs as cost of sales and SG&A, R&D and marketing as their own lines, then depreciation, interest and tax as before.

**Quality** moves each quarter: +0.02 per point of the managing executive's Operations above 10, +0.05 for High R&D, -0.05 for Low R&D, +0.03 for High marketing, -0.03 for Low, plus tech tier bonuses (2.12) and events; it drifts back toward 1.0 by 2% a quarter **(T)**.

## 10.5 What the player decides

Like Wall Street Raider, the player runs businesses through a few big levers, set monthly by the head or by board seat tasks (1.8.2). No factory micromanagement.

| Action | Effect **(T)** | Takes |
|---|---|---|
| **Expand capacity** | Spend capital per $1 × added capacity; up to +50% at a time | 6 months (12 for fabs, power plants, mines) |
| **Shrink capacity** | Sell assets at 60% of book; severance of 3 months' fixed cost on the cut part; may trigger strikes (2.8.6) | 1 month |
| **Stance** | Premium: share ×0.8, margin +5 points. Discount: share ×1.25, margin -5 points. Market: neither | Next month |
| **R&D and marketing** | Normal costs 4% and 3% of revenue; High doubles them; Low halves them | Quality moves next quarter |
| **Sell a unit** | To another company for cash or shares, priced by negotiation or auction; its share, quality and staff move with it | 1 to 3 months to close |
| **Buy a unit** | The other side of a sale; antitrust review above 30% share in a country (4.9.5) | 1 to 3 months |
| **Merge units** | Two units in the same industry and country owned by one company become one; quality is the capacity-weighted average +0.05 for synergies, fixed costs -10% | 3 months |
| **Spin off** | A unit becomes a new company; shares go to the parent's holders or are sold in an IPO (3.4) | 3 months |
| **Close** | Like shrinking to zero | 1 month |
| **Enter** | Start a new unit in an industry and country: capacity from zero, quality 0.9 | As expand |

This makes the Wall Street Raider moves possible: buy a conglomerate, strip and sell its best units, merge what is left with your own, spin off the rest.

## 10.6 Energy and the GPU chain

Energy and GPUs stay the only things counted in physical units, because Techno-Capital needs real counts (6.2) and energy prices drive costs everywhere **(A)**.

- **Energy prices.** Oil, gas and electricity each have one price (electricity per country grid). Each month the price moves toward the level where world capacity of the energy industries meets demand (the sum of all industries' energy use, which grows with their revenue). Oil and gas trade on the commodity exchanges ([3-markets-and-fx.md](3-markets-and-fx.md)). Shocks in 2.6.0 (Hormuz, cartel cuts, sanctions, the Red Sea) cut capacity directly.
- **Cost driver index D.** For each industry, D = 1 + the weighted change of its cost drivers from base **(T)**. Example: airlines with oil 40% of variable cost; oil +50% gives D = 1.20.
- **Pass-through.** Each industry passes part of D to its prices: commodities 80%, most industries 50%, regulated utilities 100% after 6 months **(T)**. Pass-through raises revenue and lowers demand by the industry's price sensitivity.
- **GPU chain.** The four layers in [6-technocapital.md](6-technocapital.md) 6.7.0 are four industries whose capacity is counted in machines, dies, chips and GPUs. Their revenue is units sold × price (lithography $200M per machine; GPU price P), and the GPU demand table in 6.7.0 sets demand. Everything else about them (margins, fixed costs, stance, buying and selling units) works like any other industry.

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

Halcyon Robotics has a US robotics unit: capacity $3.0B a year, share 6%, quality 1.0, Market stance. US robotics demand is $40B a year.

- **Expansion** (cycle +2%, β 1.5): demand = 40 × 1.03 = $41.2B. Revenue = 6% × 41.2 = $2.47B a year (82% of capacity).
- **Costs** (margin 10%, f 0.35, so v 0.55; D 1.0): 2.47 × 0.55 + 3.0 × 0.35 = 1.36 + 1.05 = $2.41B. Operating profit $0.06B, a 2.5% margin, because 18% of capacity sits idle.
- **Recession** (cycle -6%): demand = 40 × 0.91 = $36.4B; revenue = $2.18B; costs = 1.20 + 1.05 = $2.25B. The unit now **loses about $70M a year**.
- **Player options**: shrink capacity to $2.3B (sell $0.49B of assets at 60% of book, pay severance, risk a strike), switch to Discount to win share, or buy a weaker rival's unit cheaply and merge it in to cut fixed costs 10%.

## 10.11 Tooltips

Hovering a unit's revenue shows: industry size → cycle → rates → pass-through → target share and current share → capacity cap. Hovering costs shows variable part, fixed part and D with each driver's contribution.

## 10.12 Assumptions and open items

1. The industry list and every number in 10.3.
2. A business unit is one industry in one country.
3. The share model in 10.4.1 and the 15% monthly move.
4. The action list and its costs in 10.5.
5. Energy and GPUs stay counted in units; everything else in dollars.
6. Chokepoint exposure replaces shipping.
7. Slop per dollar of revenue.
