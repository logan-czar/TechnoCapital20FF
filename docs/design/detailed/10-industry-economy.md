# 10. Industry economy (Wall Street Raider style): detailed design

_Status: draft v0.6 (2026-10-17), batch 24 answers applied. Logan scrapped the Victoria 3 goods model and asked for Wall Street Raider style economic modeling. This file replaces goods, recipes, production methods, hub goods prices and shipments in [2-map-influence-economy.md](2-map-influence-economy.md) (2.6, 2.7, 2.9, 2.15; see the banners there). The map, hubs, influence, strata, real estate, the business cycle, travel and politics stay. Feeds company financials (2.13) and stock values ([3-markets-and-fx.md](3-markets-and-fx.md) 3.3). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 10.12.

---

## 10.1 Decided by Logan

| Topic | Decision |
|---|---|
| Goods | The Victoria 3 style goods model is scrapped: no goods tables, recipes, production methods, per-hub goods prices or shipments. |
| Model | Wall Street Raider style: the economy is a set of **industries**, and companies earn money from the industries they operate in. The player reads and plays the economy through company financials, not factories. |
| Business units | A business unit is **one building or site** (now called a site) (a fab, a mine, a data center, a store chain's flagship, an office), sitting on a plot in a hub. |
| Sites hold a share of the company (batch 22) | A site is like an office that **holds a percentage of the company**. To grow, a company buys or leases real estate to expand one of its sites, and that is carried on its balance sheet. A company can target certain sites to grow, or certain areas to expand into with a new site. Sites in a location give the company buffs, such as a lower interest rate or higher productivity. |
| Location perks (batch 23) | Site buffs are **location perks**, not size tiers: "every company that achieves X in this location gets Y", for example every company with its HQ in New York gets a bonus to investor confidence. |
| Real estate (batch 23) | Each location has a set **pool** of commercial and residential real estate. Investing buys a part of the pool, which appreciates; the owner chooses how much to rent out for passive income; real estate is taxed at its own rates. Renting a site rents from the location's commercial pool at a rate set by available stock and how many companies want to rent there. More detail to come later (Logan). |
| Money (batch 24) | Location perks only in the big financial and tech hubs. The CFO proposes the dividend and the board votes at the quarterly meeting. Each country taxes profit booked there; shells and havens lower it at a risk. Companies borrow through bank loans priced by credit rating, and bonds once big enough. The player manages all investments from one portfolio screen. |
| Boards (batch 23) | A character can sit on up to 3 boards. The CEO's and Chair's Image counts toward investor confidence. |
| One industry, direct branches (batch 23) | A company works in **one industry**. A company can run other industries through **direct branches**: each works like a separate company with its own business assets and employees, its own revenue and expenses, and its own growth plan and R&D plan, but the parent keeps **one unified book of cash and assets**. Direct branches can **share office sites** with the parent, and they **share the parent's board and all its bonuses**. |
| Management (batch 22) | No cyclical, random management rating like Wall Street Raider. A company's **management score** comes from the stats of the characters in its board positions, and it sets **investor confidence** and **company productivity**. |
| Deals (batch 22) | AI companies make deals too, by archetype. Private companies are valued at their last funding round, or an earnings multiple when there is none. A company that can't pay its debts goes through a restructuring event chain, where creditors can take it or auction its sites. |
| Energy and GPUs | Measured in **dollars** like every other industry; nothing is counted in physical units. |
| Industries | About 36, as in 10.3. |
| Running sites | **Mostly automatic.** The company's executives run its sites; the player buys, sells and merges (10.5). |

## 10.2 The model in one paragraph

Every country has a size for each **industry** (yearly revenue). The industry grows on its own trend and swings with the business cycle, interest rates and its cost drivers. A company works in one industry, Wall Street Raider style. It reaches other industries through direct branches (10.4.6), which share its cash and board, or through vassals (1.7), which do not. Its operations live in **sites**: buildings or offices on plots in hubs, each holding a percentage of the company. The company wins a **market share** in each country where it has sites, limited by its **capacity** there, and turns revenue into profit through its **margin**. Its **management score**, built from the stats of the characters on its board, sets how productive it is and how much investors trust it. Profit flows into the financial statements, which set fundamental value and share price.

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

## 10.4 Sites

A site is a building or office on a plot in a hub district (2.16): a fab, a mine, an oil field, a data center, a refinery, a hospital, a head office. A site is **like an office that holds a percentage of the company** (Logan): each site's share is its capacity ÷ the company's total capacity, and it carries that share of the company's revenue, costs, staff, slop and taxes. Its book assets count for influence in its hub (2.5.2).

| Trait | Meaning | Range **(T)** |
|---|---|---|
| **Capacity** | The most revenue the site can earn per year, in dollars | Any; typical sizes in 10.4.3 |
| **Share of company** | Capacity ÷ the company's total capacity | 0% to 100% |
| **Tenure** | Owned (its share of the location's commercial pool is on the balance sheet) or Rented from the pool (rent is an operating cost, 10.4.5) | |
| **Condition** | Wear; falls without upkeep, cuts capacity below 50 | 0 to 100 |
| **Location perks** | Perks its hub grants when the site meets their condition (10.4.4) | |

### 10.4.1 Monthly calculation

1. **Industry demand** in each country: base size × trend × cycle × rates × cost-driver pass-through (10.6) × event modifiers.
2. **Target share** of each company in a country = `capacity there × productivity × stance factor` ÷ the sum over all companies in that industry and country, with imports filling the rest when a country lets foreign companies sell there (2.2.2). Productivity comes from the management score (10.5) and location perks (10.4.4).
3. Each company's share moves 15% of the way to its target each month **(T)**, so share is sticky.
4. **Revenue** in the country = min(capacity there, share × demand) ÷ 12. Each site gets its share of it.
5. **Operating costs** = `revenue × v × D + capacity ÷ 12 × f`, where f is the industry's fixed cost share, v = 1 - margin - f, and D is the cost driver index (1.0 at base prices). Fixed costs are paid on capacity, so a half-empty company loses money: this is the operating leverage that makes recessions bite. Productivity also cuts v: v × (1.1 - 0.2 × management score ÷ 100) **(T)**.
6. **Depreciation** = owned book assets ÷ 10 years ÷ 12 **(T)** (4 years for cloud servers, 25 years for real estate).
7. The result feeds the income statement (2.13.2): revenue, operating costs as cost of sales and SG&A, rent for leased sites, R&D and marketing, then depreciation, interest and tax as before.

### 10.4.2 Growing: expand a site or open a new one

A company grows by adding real estate (Logan). Both ways go on the balance sheet.

| Move | How | Cost **(T)** | Takes **(T)** |
|---|---|---|---|
| **Expand a site** | Buy or rent more commercial real estate from the location's pool (10.4.5) at an existing site | Capacity added × the industry's capital per $1; owned adds an asset (paid in cash or debt), leased adds a lease liability and rent | 6 months (12 for fabs, mines, power plants) |
| **Open a new site** | Buy or rent commercial real estate from the pool in a new hub and fit it out | Build cost (10.4.3) plus the plot | 6 to 24 months; starts at 80% productivity for 12 months |
| **Shrink or close** | Sell the real estate or end the lease | Assets sold at 60% of book; severance of 3 months' fixed cost; may trigger strikes (2.8.6) | 1 month |

**Targets.** Each company has a **growth plan**: the sites it wants to grow and the areas it wants to open new sites in, plus a yearly growth budget. Whoever controls the company sets the plan (the player, if they are the head); otherwise the executives write it (10.5.3). The plan's budget is spent each month on the targets in order, as far as cash and borrowing allow.

### 10.4.3 Typical site sizes (T)

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

### 10.4.4 Location perks (Logan, 2026-10-17)

Site buffs belong to **locations**, not to site size. Only the big **financial and tech hubs** have perks (Logan, batch 24), each of the form **"every company that achieves X here gets Y"**. Any number of companies can hold the same perk; there is no ranking and no size threshold. Starting set **(A)**, values **(T)**:

| Hub | Achieve | Get |
|---|---|---|
| New York | HQ here | Investor confidence +5% |
| London | HQ here | -0.25 points on bonds issued |
| Zurich | HQ here, or a captive bank here | -0.25 points on loans; shell exposure -10% |
| Bay Area | HQ here and work in a Tech industry | R&D plan effects +10% |
| Hsinchu-Taipei | A Foundry or Chip packaging site here | Productivity +5% |
| Shenzhen-Dongguan | A Consumer electronics, Robotics or GPU boards site here | Productivity +5%; variable cost -3% |
| Singapore | HQ here | -0.25 points on loans; securities regulator strictness -1 |
| Bengaluru | A Software and SaaS site here | Variable cost -5% (wages) |
| Tokyo-Yokohama | A Robotics site here | Productivity +5% |
| Seoul-Pyeongtaek | An Other chips or Consumer electronics site here | Productivity +3% |
| Frankfurt | HQ here | -0.25 points on loans from banks in the eurozone |

- **HQ** is the site the company names as its head office; it can move it once a year.
- Perks apply to the whole company unless they name a site type, in which case they apply to that site's share of the company.
- Direct branches (10.4.6) get a perk when they meet its condition themselves, or through a shared parent site that does.
- Events and politics can add, remove or change perks (a tax haven law, a tech cluster subsidy, a war).

### 10.4.5 Real estate pools (Logan, 2026-10-17; more detail to come)

Real estate is simple and pooled. Logan wants to talk through real estate in more depth later; this is the outline he set.

- **Pools.** Each location has a set **pool** of commercial real estate and a set pool of residential real estate, measured in dollars of value **(A)**.
- **Investing.** A player (or any holder) who invests in real estate buys a part of a location's pool. There are no individual buildings or plots to pick.
- **Appreciation.** The holding rises in value with the location's property cycle (2.16.5).
- **Renting out.** The owner chooses what share of the holding to rent out. Rented real estate earns passive income at the location's rent rate; the rest is held for appreciation only.
- **Tax.** Real estate is taxed at its own rates: property tax on value, and income tax on rent and on gains when sold, at rates set by the country and location **(A)**.
- **Renting a site.** A company that rents a site rents from the location's commercial pool. The rent rate rises as available stock falls and as more companies want to rent there: `rent rate = base rate × (rental demand ÷ available stock)^0.5` **(T)**, where base rate is about 6% of value a year **(T)**. Owners who rent out their share of the pool collect that rate.
- **Buying a site.** A company that buys its site buys that much of the commercial pool; it sits on the balance sheet and appreciates like any other holding.

The plot, building and lease rules in 2.16.1 to 2.16.4 and 2.16.7 are on hold until that conversation.

### 10.4.6 Direct branches (Logan, 2026-10-17)

A **direct branch** is a business a company runs in another industry without making it a separate legal company.

| | Direct branch | Subsidiary or other vassal (1.7.4) |
|---|---|---|
| Industry | Any industry other than the parent's | Any |
| Business | Its own sites' business assets, employees, revenue and expenses, counted separately | Its own everything |
| Growth plan and R&D plan | **Its own** (10.4.2, 10.5.3) | Its own |
| Cash and assets | **One unified book with the parent**: the branch spends from and pays into the parent's cash, and its assets sit on the parent's balance sheet | Separate books; consolidated only for reporting (2.13.1) |
| Board and management score | **Shares the parent's board and all its bonuses** (management score, productivity, investor confidence) | Its own board and score |
| Sites | **Can share office sites with the parent**: a branch can operate out of a parent site in a hub instead of opening its own | Its own sites |
| Shares | None; it cannot be listed or have outside holders. Spin it off (10.5.4) to turn it into a company | Can have outside holders |
| Debt | The parent's debt; a branch has no separate credit | Its own |

**Sharing a site (T).** A branch that shares a parent site adds its capacity to that site without buying or renting more real estate: the first $500M of branch capacity in a shared site needs no extra real estate (an office floor), and beyond that it expands the shared site as in 10.4.2. A branch working from a shared site meets site-based location perks (10.4.4) through it.

**Why use one.** A branch gets the parent's board for free and pools cash, so a strong board can run a sprawling group. The cost is risk: a failing branch drains the shared cash, and in a restructuring (10.5.4) creditors can claim the whole book. A subsidiary walls off risk but needs its own board.

**Revenue and costs.** Each branch's revenue and costs run through 10.4.1 in its own industry, using the parent's management score. The company's income statement shows one segment per branch (2.13.2) **(A)**.

## 10.5 Management score

There is no cyclical, random management rating as in Wall Street Raider (Logan). A company's **management score** (0 to 100) is built from the board: the characters in its positions (1.8) and their stats.

### 10.5.1 How the score is built (T)

| Position | Skill used | Weight |
|---|---|---|
| CEO (the head) | Average of Finance, Operations and Persuasion | 30% |
| COO | Operations | 20% |
| CFO | Finance | 20% |
| CTO | Tech | 10% (20% in Tech industries, taking 10% from the CEO) |
| Chair | Persuasion | 10% |
| Other seats (General Counsel, Head of Security, Chief Strategy Officer, independents) | Their seat's skill, averaged | 10% |

- Score = `Σ weight × skill ÷ 20 × 100`, capped at 100. A board of skill-10 characters scores 50; a board of skill-20 characters scores 100.
- An empty position counts as skill 3.
- A character can sit on **up to 3 boards** (Logan). Each board after the first cuts what they add to every board's score by 20% (×0.8 on two boards, ×0.6 on three) **(T)**.
- A member whose opinion of the head is below 0 counts at half their skill (1.8.3).
- Traits shift the member's contribution: Diligent +2 skill, Lazy -2, Ambitious +1, Greedy -1 to the CFO slot only, Honest +1 to investor confidence (below), Deceitful -1 **(A)**.
- The score changes only when the board changes, when members' skills grow or fall, or when opinions and traits change. It is never rolled.

### 10.5.2 What the score does (T)

| Effect | Formula | At score 30 | At score 50 | At score 80 |
|---|---|---|---|---|
| **Productivity** | `0.7 + 0.6 × score ÷ 100` multiplies target share; also cuts variable cost (10.4.1 step 5) | 0.88 | 1.00 | 1.18 |
| **Investor confidence** | Multiplies fundamental value V (3.3.1) by `0.8 + 0.4 × score ÷ 100`; also moves the credit rating one notch per 25 points away from 50 (3.6) | ×0.92 | ×1.00 | ×1.12 |

**Image** (Logan): the CEO's and Chair's Image adds to investor confidence, up to ±10%: each of them adds `(Fame × Favor ÷ 100 - 25) ÷ 250`, capped at ±5% each **(T)** (Fame and Favor 0 to 100, [1-corporate-core.md](1-corporate-core.md) 1.1.0).

Investor confidence makes boards a target: poaching a rival's star CFO lowers their score and their share price, and putting a famous name on your own board lifts yours.

### 10.5.3 What executives do on their own

Running sites is mostly automatic (Logan, batch 21). Each month the executives set pricing stance, marketing, upkeep and staffing by themselves, and write the growth plan and R&D plan when nobody else does **(A)**. Each direct branch has its own growth plan and R&D plan (10.4.6); the **R&D plan** sets R&D spending as Low, Normal or High (2%, 4% or 8% of revenue **(T)**) and which tech projects (2.12) it funds, and whoever controls the company can set it like the growth plan. Their traits shape the choices: a Greedy CEO starves R&D for short-term profit; an Ambitious one over-expands; a Cautious one leases instead of buying. The player shapes this through who sits in which position, the charter, the growth plan when they control the company, and pressure as a shareholder.

### 10.5.4 Deals

| Deal | Rule **(T)** | Takes |
|---|---|---|
| **Buy or sell a site** | A site holds a percentage of its company, so its asking price starts at that percentage of the company's value (V, or the private valuation below), then is negotiated. Its real estate, staff and customers move with it; antitrust review above 30% share in a country (4.9.5) | 1 to 3 months |
| **Merge sites** | Two sites in the same hub owned by one company become one; fixed costs -10% | 3 months |
| **Spin off** | One or more sites become a new company; shares go to the parent's holders or are sold in an IPO (3.4) | 3 months |
| **AI deals** | AI companies buy, sell, merge and spin off by archetype (2.23): a raider strips weak companies and sells their best sites, an empire builder buys share, a cautious owner sells into booms (Logan) | Monthly decision |
| **Private company value** | The post-money value of its last funding round; with no round in the last 2 years, net income × the industry's average P/E × 0.7 (private discount) (Logan) | |
| **Can't pay its debts** | A restructuring event chain (Logan): a standstill, then creditors vote. They can extend and swap debt for equity (the creditors take the company), sell it whole, or auction its sites one by one. Builds on 3.6 default rules | 2 to 6 months |

This keeps the Wall Street Raider moves: buy a conglomerate, strip and sell its best sites, merge what is left with your own, spin off the rest.

### 10.5.5 Dividends, tax and borrowing (Logan, batch 24)

- **Dividends.** The CFO proposes a dividend each quarter (Fixed, Progressive or Special, [3-markets-and-fx.md](3-markets-and-fx.md) 3.4.6) and the **board votes** on it at the quarterly meeting (1.8.4). A CFO's traits shape the proposal: Greedy proposes low payouts to keep cash, a CFO loyal to a cash-hungry family proposes high ones. The head can lobby members with Persuasion. Direct branches pay nothing separately; their profit is in the parent's book.
- **Tax.** Each country taxes the profit booked there by the sites in it ([4-politics.md](4-politics.md) E2 and E9). Profit can be moved to havens through shell companies (1.7.4), which lowers tax but builds exposure.
- **Borrowing.** Companies borrow from banks at the policy rate plus a spread set by credit rating (3.6), lowered by location perks (10.4.4). From the Corporation rank (1.7.5, $250M value) a company can also issue bonds (3.6). The management score moves the rating (10.5.2).

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
- When a chokepoint is at Tension, Attacks, Conflict or Closed (2.4.2), exposed companies pay more (D rises by exposure × 2%, 5%, 15%, 30%) and lose capacity (exposure × 0%, 2%, 10%, 30%) **(T)**.
- **Tariffs and trade wars** (4.11) cut the share foreign companies can win in a country and add to their D.
- **Links between industries.** An industry's cost drivers are other industries' prices, so shocks spread: oil up → airlines, chemicals and shipping costs up → their earnings fall → their shares fall → trusts holding them lose value.

## 10.8 Slop

Slop is now produced per dollar: each site makes `revenue × its industry's slop per $1M` a month in its home country **(T)**. The rules in 2.8.0 for slop need and the 0.8 and 1.2 ratio bands stay the same.

## 10.9 What happens to the old economy sections

| Section in 2-map | Status |
|---|---|
| 2.6 Goods (except 2.6.0's energy shocks) | Retired; replaced by industries (10.3) |
| 2.7 Facilities and production methods | Retired; replaced by sites (10.4). Buildings stay as real estate (2.16) |
| 2.8 Population and labor | Kept, with needs read as spending on industries (10.3) |
| 2.9 Demand and prices | Retired except electricity pricing (2.9.7) and black markets (2.9.9) |
| 2.10 Supply contracts | Kept only for Techno-Capital and GPU chain capacity (6.7.0) |
| 2.13 Financial statements | Kept; input, freight and inventory lines fold into operating costs |
| 2.15 Competition and market share | Retired; replaced by 10.4.1 |
| Worked examples 2.14.3, 2.14.6, 2.14.9, 2.14.10, 2.25.1 | Retired |

## 10.10 Worked example: a robotics company in a recession

Halcyon Robotics has one US robotics plant (one site holding 100% of the company): capacity $3.0B a year, share 6%, management score 50 (productivity 1.00), Market stance. US robotics demand is $40B a year.

- **Expansion** (cycle +2%, β 1.5): demand = 40 × 1.03 = $41.2B. Revenue = 6% × 41.2 = $2.47B a year (82% of capacity).
- **Costs** (margin 10%, f 0.35, so v 0.55; D 1.0): 2.47 × 0.55 + 3.0 × 0.35 = 1.36 + 1.05 = $2.41B. Operating profit $0.06B, a 2.5% margin, because 18% of capacity sits idle.
- **Recession** (cycle -6%): demand = 40 × 0.91 = $36.4B; revenue = $2.18B; costs = 1.20 + 1.05 = $2.25B. The company now **loses about $70M a year**.
- **What happens next**: the COO decides on their own whether to cut costs or discount to win share (10.5.3). The player can lift the management score by replacing a skill-10 COO with a skill-20 one (score 50 → 60, productivity 1.06, variable cost -2%), cut capacity by ending a lease, or buy a weaker rival's site at a recession price and merge it in to cut fixed costs 10%.

## 10.11 Tooltips

Hovering a company's revenue shows: industry size → cycle → rates → pass-through → target share and current share → capacity cap. Hovering costs shows variable part, fixed part and D with each driver's contribution.

## 10.12 Assumptions and open items

1. Every number in 10.3 and the site sizes in 10.4.3.
2. The share model in 10.4.1 and the 15% monthly move.
3. The starting location perks in 10.4.4.
4. Real estate pools (10.4.5): to be discussed further with Logan.
5. Direct branches: the $500M of free shared capacity, segment reporting and the restructuring risk in 10.4.6.
6. Management score weights, trait shifts, the multi-board cut and the Image formula in 10.5.
7. Which choices executives make on their own (10.5.3).
8. Price indices and the Techno-Capital conversions in 10.6.
9. Chokepoint exposure replaces shipping; slop per dollar of revenue.
