# 3. Markets and FX: detailed design

_Status: draft v0.1 (2026-10-16). Owner: Logan. Expands [07-markets.md](../07-markets.md) and the trading parts of [02-trusts-and-assets.md](../02-trusts-and-assets.md) into exact rules, numbers and content. Everything here is open for revision._

This file covers stock exchanges, the stock price model, corporate actions, short selling and margin, bonds and credit ratings, commodities, foreign exchange, central banks, and market crime. It ends with worked examples and a list of new assumptions.

Rules already decided by Logan (see [13-open-questions.md](../13-open-questions.md)) are kept as they are. In particular: one turn is one in-game hour, heavy calculations run on daily, weekly and monthly intervals, characters are landless and assets are their titles, the family trust carries the dynasty, bloc leaders are the members with the most shares, and vassals are held by companies. The 5%, 10%, 25% and 50% disclosure thresholds from [02-trusts-and-assets.md](../02-trusts-and-assets.md) are kept exactly.

---

## 3.1 Conventions and time cadence

### 3.1.1 Conventions

- **[T]** marks a tuning value: a starting number that is expected to change in playtesting. Where a whole table is tuning values, its caption says so.
- Rates and yields are **annual** unless the text says "per tick" or "per day".
- A **tick** is one hourly market update, run on every turn in which that market is open.
- **Settlement** is the daily close processing of a market (3.3.10).
- Money in examples is in US dollars (USD) unless a currency is named.
- **V** is a stock's fundamental value per share, **P** its market price.
- **ADV** is average daily volume in shares (20-day average).
- **GRG** is the Global Risk Gauge, a 0 to 100 fear index (3.3.5).
- A **holder** is any owner in the ownership graph (see [01-companies.md](../01-companies.md) 1.3): trusts, characters, companies, funds, governments.
- **Holder group**: a holder plus every entity it controls, plus its bloc partners in that company. Limits and disclosure apply to the holder group, not to each entity separately.

### 3.1.2 What runs when

Markets follow the calculation schedule of [09-time-and-turns.md](../09-time-and-turns.md). The hourly loop only touches prices, orders and alarms. Strategic choices by named AI holders stay on weekly or monthly cadences, as 9.3 requires; the hourly order flow of AI investor archetypes (3.3.4) is a market rule, not an AI decision.

| Cadence | Market work |
|---|---|
| **Hourly** (each turn) | Stock ticks on open exchanges; commodity futures ticks; FX ticks (24 hours on weekdays); crypto ticks (every hour, every day); order execution; circuit breaker checks; margin warnings and intraday forced liquidations; short squeeze checks; news shocks applied; GRG update |
| **Daily** (at each market's close) | Closing auction; settlement of trades; fundamental value refresh; sentiment decay; borrow fees and margin interest accrual; formal margin calls; futures variation margin; carry accrual on FX positions; FX fair value refresh; disclosure filings published; surveillance checks on the day's news |
| **Weekly** | Named AI holders' strategic decisions (stake building, bloc votes, activist campaigns, tender decisions); short interest published; regulator suspicion reviews; commodity inventories updated from supply chain shipments; capital control quotas reset; shell detection rolls |
| **Monthly** | Central bank meetings; dividends, coupons and loan interest paid; government bond auctions; commodity marginal cost update; PPP anchor drift for FX; index fund savings inflows; QE purchases |
| **Quarterly** | Earnings reports and full fundamental recalculation; credit rating reviews; index rebalancing; buyback windows reset |
| **Yearly** | Dividend policy set at the annual shareholder meeting; listing compliance review; central bank governor terms; sovereign annual rating review |

### 3.1.3 The global trading day

The turn clock runs on UTC. Each hub shows local time. Daylight saving time is ignored [T]. Exchange sessions are set to whole hours so that every tick lines up with a turn.

| UTC hour | 00 | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tokyo ESE, Seoul HRX | O | O | lunch (ESE) | O | O | O | | | | | | | | | | | | | | | | | | |
| Shanghai HSE | | O | O | | | O | O | | | | | | | | | | | | | | | | | |
| Hong Kong VHX, Singapore LCX | | O | O | O | lunch | O | O | O | O (LCX) | | | | | | | | | | | | | | | |
| Mumbai GXI | | | | | O | O | O | O | O | O | | | | | | | | | | | | | | |
| Riyadh NJX (Sun to Thu) | | | | | | | | O | O | O | O | O | | | | | | | | | | | | |
| London CLX, Paris CBX | | | | | | | | | O | O | O | O | O | O | O | O | | | | | | | | |
| Sao Paulo PSX | | | | | | | | | | | | | | O | O | O | O | O | O | O | | | | |
| New York ATX, HDM | | | | | | | | | | | | | | | O | O | O | O | O | O | O | | | |
| FX market (weekdays) | Asia | Asia | Asia | Asia | Asia | Asia | Asia | Asia/London | London | London | London | London | London/NY | London/NY | London/NY | London/NY | NY | NY | NY | NY | NY | thin | thin | thin |

"O" means the exchange ticks on that turn. Exact local hours are in 3.2.1. The FX market opens Sunday 22:00 UTC and closes Friday 22:00 UTC. Crypto and the Freeport Night Market (3.2.5) never close.

### 3.1.4 Unlocks by game stage

Following [14-game-stages.md](../14-game-stages.md), market tools unlock with the dynasty's stage, so a new player is not shown an FX desk in hour one.

| Stage | Market tools available |
|---|---|
| 1. The Heir | Buy and sell listed stocks and government bonds in personal accounts; savings and money market accounts |
| 2. The Founder | Bank loans and stock-pledge loans; corporate bonds; basic FX conversion |
| 3. The Climber | IPO chain; margin accounts; short selling; block trades; tender offers; rights issues and buybacks for controlled companies |
| 4. The Tycoon | Commodity futures and hedging; cornering; FX positions, carry trades and forwards; distressed debt; derivative stake building |
| 5. The Oligarch | Attacks on currency pegs; capture of central banks; private monetary authorities for charter cities (Arcology Scrip, 3.8.1) |

---

## 3.2 Exchanges

### 3.2.1 Exchange list

Twelve fictional exchanges stand in for real ones, plus one off-the-books venue. Each has a home hub, a currency, a regulator (the national securities regulator from [08-politics.md](../08-politics.md)) and indices.

| Code | Exchange | Home city | Stands in for | Currency | Hours (local) | Ticks per day | Headline index | Other indices |
|---|---|---|---|---|---|---|---|---|
| ATX | Atlantic Exchange | New York | NYSE | USD | 09:00 to 16:00 | 7 | Atlantic 500 | Atlantic Industrials 30, Atlantic Mid 400 |
| HDM | Hudson Digital Market | New York | Nasdaq | USD | 09:00 to 16:00 | 7 | Hudson 100 | Hudson Composite, Hudson Biotech |
| CLX | City of London Exchange | London | LSE | GBP | 08:00 to 16:00 | 8 | CLX 100 | CLX 250 |
| CBX | Continental Bourse | Paris (with floors in Amsterdam, Frankfurt and Milan) | Euronext and Deutsche Boerse | EUR | 09:00 to 17:00 | 8 | Continental 50 | Continental Mid 100, Rhine 40 |
| ESE | Edo Securities Exchange | Tokyo | JPX | JPY | 09:00 to 11:00, 12:00 to 15:00 | 5 | Edo 225 | Edo Prime Index |
| HSE | Huangpu Stock Exchange | Shanghai | SSE and SZSE | CNY | 09:00 to 11:00, 13:00 to 15:00 | 4 | Huangpu Composite | Huangpu Star 50 (tech board) |
| VHX | Victoria Harbour Exchange | Hong Kong | HKEX | HKD | 09:00 to 12:00, 13:00 to 16:00 | 6 | Harbour Index | Harbour Mainland Enterprises |
| GXI | Gateway Exchange of India | Mumbai | NSE and BSE | INR | 09:30 to 15:30 | 6 | Gateway 50 | Gateway Sensitive 30 |
| HRX | Han River Exchange | Seoul | KRX | KRW | 09:00 to 15:00 | 6 | HRX 200 | HRX Growth |
| LCX | Lion City Exchange | Singapore | SGX | SGD | 09:00 to 12:00, 13:00 to 17:00 | 7 | Lion 30 | Lion REIT Index |
| PSX | Paulista Exchange | Sao Paulo | B3 | BRL | 10:00 to 17:00 | 7 | Paulista Index | Paulista Small Caps |
| NJX | Nejd Exchange | Riyadh | Tadawul | SAR | 10:00 to 15:00, Sunday to Thursday | 5 | Nejd All-Share | Nejd 30 |

A **global index**, the **Globe 1000**, is built from the 1,000 largest free-float companies across all twelve exchanges, converted to USD. Global funds track it, and the GRG reads its volatility.

**Depth of simulation:** each exchange lists 30 to 120 fully simulated companies (with characters, boards and facilities) plus a **rest-of-market basket**, one synthetic constituent per sector that stands for all unmodeled companies. Indices and sentiment include the basket so they behave like real markets, but the basket cannot be bought into control [T].

**Holidays:** each exchange closes on 8 to 12 fixed days a year drawn from its country's calendar [T]. Weekends are Saturday and Sunday, except NJX (Friday and Saturday).

### 3.2.2 Listing requirements

Requirements apply to a **main board** listing. "Market cap" is at the IPO price, converted to USD. Strictness (1 to 5) scales regulator detection chances (3.10) and review times.

All values are [T].

| Exchange | Min market cap | Min free float | Track record | Dual-class shares | Foreign issuers | Mandatory bid | Board independence | Regulator strictness |
|---|---|---|---|---|---|---|---|---|
| ATX | $250M | 15% | 3 years, profitable 2 of last 3 | Allowed | Allowed | None | Majority independent | 4 |
| HDM | $100M | 10% | 1 year, or revenue growth above 20% (loss-makers allowed) | Allowed | Allowed | None | Majority independent | 4 |
| CLX | $150M | 10% | 3 years | Allowed (sunset after 10 years) | Allowed | 30% | One third independent | 4 |
| CBX | $150M | 15% | 3 years | Loyalty shares only (B shares held 2 years get 2 votes) | Allowed | 30% | One third independent | 4 |
| ESE | $250M | 35% | 2 years | Not allowed | Allowed | Crossing 33.3% must be by tender offer | Two independent directors | 3 |
| HSE | $400M | 25% | 3 years profitable | Star board only | Not allowed; foreign investors capped at 30% of any company, through a quota | 30% | One third independent | 3 |
| VHX | $500M | 25% | 3 years, or revenue test | Allowed for tech companies | Allowed | 30% | One third independent | 3 |
| GXI | $50M | 25% (reached within 3 years) | 3 years | Allowed for tech founders, 10 votes max | Allowed, sector caps on foreign ownership | 25% | Half independent | 3 |
| HRX | $100M | 25% | 3 years | Not allowed | Allowed | None | One quarter independent | 3 |
| LCX | $150M | 25% | 3 years | Allowed | Allowed | 30% | One third independent | 4 |
| PSX | $100M | 25% | 3 years | Not allowed on the premium segment | Allowed | Control change requires offer to minorities at 80% of the control price | 20% independent | 2 |
| NJX | $100M | 30% | 3 years | Not allowed | Allowed; foreigners capped at 49% of any company | 50% | One third independent | 3 |

Notes:
- **Board independence** feeds the CK3-style board (see [01-companies.md](../01-companies.md) 1.6): a newly listed company must fill the required share of seats with Independent Directors, picked from an exchange-wide pool of AI characters. These seats can side with minority blocs.
- **Mandatory bid**: a holder group that crosses the threshold must offer to buy all remaining shares at no less than the highest price it paid in the past 12 months. Passive crossings (for example from a buyback) are exempt.
- **Fees**: a one-off listing fee of 0.05% of market cap (min $100k, max $2M) and an annual fee of 0.01% (min $50k, max $500k) [T].

### 3.2.3 Indices

- The **headline index** of each exchange holds its largest companies by free-float market cap (500, 100, 50 and so on as named), weighted by free-float cap.
- **Free float** excludes stakes of 5% or more held by insiders, controlling blocs, governments and strategic holders.
- **Dual-class exclusion**: a company whose free-float holders control less than 10% of votes is excluded from headline indices on ATX, HDM and CLX [T]. This is a real cost of keeping control through class A shares (see example 3.11.2).
- **Rebalancing** happens at the last close of each quarter. Index funds buy additions and sell deletions in the final 5 ticks before that close.
- **Inclusion event**: a company that will be added is announced 5 trading days before. Expected move +3% to +7% over those days, then a partial reversal of 1% to 2% [T].
- **Sector indices** track each sector per exchange and drive sector sentiment (3.3.5).

### 3.2.4 Foreign access and cross-listing

- **Depositary receipts**: a company can list a receipt on a second exchange (for example a Gateway 50 company on ATX). The receipt trades in the second exchange's currency and its price tracks the home share times the FX rate, with arbitrage closing gaps above 0.5% within 2 ticks when both markets are open [T]. Cost: a one-off fee of 0.03% of market cap and the second exchange's disclosure rules.
- **HSE quota ("Connect")**: foreign holders buy HSE shares through a daily quota of 52 billion CNY for all foreigners combined [T]. When the quota is used up, foreign buy orders wait for the next day. A Branch Office vassal (see [01-companies.md](../01-companies.md) 1.5) counts as domestic and skips the quota.
- **Foreign ownership caps** (HSE 30%, NJX 49%, GXI by sector) apply to the sum of all foreign holders. When a cap is reached, foreigners can only buy from other foreigners, at a premium that floats from 0% to 15% [T].

### 3.2.5 The Freeport Night Market (cyberpunk venue)

An off-the-books, always-open venue run from servers in a sovereign-data haven. It is the cyberpunk accent of the market layer.

- **What trades**: Ledgerbit (LBT) and other crypto, black-market data lots (user data, surveillance feeds, stolen AI models), "grey" shares of private and delisted companies, and contracts on events (elections, central bank decisions, deaths of named characters).
- **Access**: only through a Shell Company or Front Company vassal. Trades raise that shell's **exposure** (see [02-trusts-and-assets.md](../02-trusts-and-assets.md) 2.8) by 1 point per $1M traded [T].
- **No regulator, no disclosure.** Stake building there is invisible to normal disclosure, but the counterparties are anonymous.
- **Risks**: counterparty fraud (0.5% chance per trade of losing the whole trade value [T]), raids by the international financial crimes taskforce (weekly roll, 1% base, rising with exposure), and frozen balances during raids.
- Settlement is instant; margin is not available (100% collateral).

---

## 3.3 Stock price model

Each listed stock has a fundamental value **V** that moves slowly with the company's real economics, and a market price **P** that moves every tick, pulled toward a sentiment-adjusted V and pushed around by order flow, news and noise.

### 3.3.1 Fundamental value

V is recalculated in full each quarter at the earnings report, refreshed at every daily settlement with new market inputs (yields, sentiment, scandals), and recalculated immediately when a news shock changes the company's facts (3.3.6).

**Step 1: normalized earnings.**

`E_norm = 0.6 x TTM earnings + 0.4 x forward earnings`

- TTM earnings are the net income of the last four quarters, from the company's financials ([06-economy.md](../06-economy.md) 6.6).
- Forward earnings = TTM earnings x (1 + g), where g is the company's smoothed revenue growth over the last 4 quarters, clamped to the range -30% to +60%.

**Step 2: the multiple.**

`M = M_sector x G x R x Q x C`

| Factor | Formula | Range | Meaning |
|---|---|---|---|
| M_sector | From the sector table (3.3.2) | | Base price to earnings ratio for the sector |
| G (growth) | 1 + 2.5 x (g - g_sector) | 0.5 to 2.5 | Faster than the sector earns a higher multiple |
| R (rates) | 9% / (y10 + 5%) | 0.4 to 1.6 | y10 is the 10-year government yield in the company's home currency (3.6.4). At y10 = 4% R is 1.0; at 12% (emerging market) R is 0.53 |
| Q (quality) | 1 + sum of quality modifiers (table below) | 0.6 to 1.25 | Governance, management, scandals |
| C (cycle) | For Energy, Mining, Logistics and Agriculture only: if TTM earnings exceed 1.3 times the 5-year average, C = (5-year average / TTM)^0.5; else 1.0 | 0.5 to 1.0 | Markets do not pay full multiples on peak commodity earnings |

Quality modifiers (all [T]):

| Condition | Q modifier |
|---|---|
| Dual-class or loyalty shares | -0.05 |
| State-Linked charter (golden share) | -0.10 |
| No holder group above 30% (takeover option value) | +0.03 |
| CEO Operations skill | +0.005 per point above 15, -0.005 per point below 15 |
| Active scandal (minor, major, criminal) | -0.05, -0.10, -0.20 (fades over 4, 8, 16 weeks) |
| Under regulatory investigation | -0.08 |
| Known shell exposure above 50 | -0.10 |
| Hedging policy covering at least 50% of key input or output risk | +0.02 |
| Paid a dividend every quarter for 5 years | +0.03 |
| Company reputation | +0.001 per point above 50, -0.002 per point below 50 |

**Step 3: earnings value.**

`EarningsValue = E_norm x M` (equity value)

**Step 4: loss-makers.** If E_norm is zero or negative, the company is valued on sales instead:

`SalesValue = (Revenue x EVS_sector x G - NetDebt) x 0.7`

and a further x 0.8 if cash covers less than 12 months of losses (runway risk) [T].

**Step 5: banks and insurers** use book value instead: `EquityValue = Book x ROE / (y10 + 5%)`, clamped to 0.3 to 3.0 times book.

**Step 6: asset floor.**

`AssetFloor = 0.6 x book equity` (0.9 x book for Real Estate) [T]

**Step 7: per share.**

`V = max(EarningsValue or SalesValue, AssetFloor) / shares outstanding`

The **Undervaluation** casus belli ([01-companies.md](../01-companies.md) 1.8) is open against a company whose market cap has been below its book equity for 20 consecutive trading days [T].

### 3.3.2 Sector table

All values are [T].

| Sector | M_sector (P/E) | EVS (EV/Sales, for loss-makers) | g_sector | Annual volatility | Typical payout ratio | Beta |
|---|---|---|---|---|---|---|
| Software and tech services | 28 | 6.0 | 12% | 35% | 15% | 1.2 |
| Semiconductors and hardware | 22 | 4.0 | 10% | 40% | 20% | 1.4 |
| Data and AI services | 35 | 10.0 | 20% | 45% | 0% | 1.5 |
| Cyberware and biotech | 30 | 8.0 | 15% | 50% | 0% | 1.3 |
| Pharma and healthcare | 18 | 3.5 | 5% | 22% | 40% | 0.8 |
| Banking and finance | 11 | n/a (book method) | 4% | 25% | 45% | 1.1 |
| Energy (oil and gas) | 10 | 1.2 | 2% | 30% | 50% | 1.0 |
| Mining and materials | 11 | 1.8 | 3% | 32% | 45% | 1.2 |
| Industrials and manufacturing | 17 | 1.5 | 4% | 24% | 35% | 1.0 |
| Logistics and shipping | 12 | 1.0 | 4% | 30% | 40% | 1.1 |
| Consumer goods and retail | 20 | 1.2 | 4% | 20% | 45% | 0.9 |
| Real estate | 15 | 6.0 | 3% | 22% | 80% | 0.8 |
| Utilities and grids | 16 | 2.5 | 2% | 18% | 65% | 0.6 |
| Media and entertainment | 18 | 2.5 | 5% | 30% | 25% | 1.0 |
| Security and defense (PMCs) | 18 | 1.8 | 6% | 26% | 30% | 0.7 |
| Agriculture and food | 15 | 1.0 | 3% | 20% | 45% | 0.7 |

### 3.3.3 Hourly price update

On each tick of an open exchange, every listed stock updates:

`P_next = P x (1 + pull + flow + noise)`, then circuit breakers apply (3.3.8).

**Sentiment-adjusted target:**

`V* = V x (1 + 0.15 x Mkt/100 + 0.10 x Sec/100 + 0.10 x Buzz/100)`

where Mkt, Sec and Buzz are the market, sector and stock sentiment scores (3.3.5).

**Pull** toward the target:

`pull = a x (V* / P - 1)`, with a = 0.0015 per tick [T]

A gap between P and V* halves in about 460 ticks, or roughly 3 months of trading. Undervalued stocks can stay undervalued for a long time, which is what makes raiding worthwhile.

**Flow** (net order imbalance, permanent impact):

`flow = gamma x sigma_d x (NetShares / ADV)`, with gamma = 0.8 [T]

- NetShares is the net number of shares bought this tick by all participants combined (AI archetypes, named holders, the player).
- sigma_d is the stock's daily volatility: annual volatility / 15.9 (the square root of 252 trading days).
- One full day's volume of net buying moves the price by 0.8 daily standard deviations.

**Noise:**

`noise = sigma_h x (rho x z_market + sqrt(1 - rho^2) x z_stock)`

- sigma_h = sigma_d / sqrt(ticks per day).
- z_market is one random draw per exchange per tick, shared by all its stocks; z_stock is a draw per stock. rho = 0.5 x beta, capped at 0.8 [T].
- Fat tails: each tick has a 2% chance that the draw is taken from a distribution 3 times as wide [T].

### 3.3.4 AI investor archetypes

The anonymous float of every listed company is traded by eight **archetypes**. Their combined net buying or selling each tick is the "market". Separately, the largest stakes are held by **named AI holders** (funds that are entities in the ownership graph, such as Monolith Index Partners or Graywater Value). Named holders vote, join blocs and react to disclosures; they make strategic decisions weekly. Archetypes only generate hourly order flow.

Each archetype k has a **signal** D_k between -1 (all sell) and +1 (all buy). Its net order this tick is:

`NetShares_k = share_k x (ADV / ticks per day) x D_k`

| Archetype | Default share of volume | Holds (typical, % of float) | Signal and behavior | Named examples |
|---|---|---|---|---|
| **Index funds** | 15% | 20% to 30% of index constituents | D = 0 most of the time. Buy additions and sell deletions at rebalance. Monthly savings inflow gives D = +0.1 on the first trading day of the month (D = -0.1 in a bear market, when the Globe 1000 is down 20% from its peak). Never sell on price. Vote with the proxy adviser. Lend most of their shares to short sellers | Monolith Index Partners, Vanguardian Trust |
| **Value funds** | 10% | 5% to 15% | Act only when P is more than 10% away from V: D = clamp(3 x (V/P - 1), -1, 1). Patient sellers into raids: they sell blocks only above their reservation price (3.4.9) | Graywater Value, Ostrander & Kell |
| **Momentum and quant** | 20% | 2% to 5% | D = clamp(10 x r5 + 5 x r20, -1, 1), where r5 and r20 are 5-day and 20-day returns. Amplify trends; cut D in half when GRG is above 50 (they deleverage) | Kinetic Quant, Parallax Systematic |
| **Retail** | 20% | 15% to 40% | D = clamp(Buzz/100 + 0.5 x Sec/100 + 3 x r1, -1, 1), where r1 is today's return so far. Panic rule: after a day below -8%, D = -1 for the first 3 ticks of the next day. Most sensitive to psyops, ad campaigns and meme hype | "The public" |
| **Activists** | 3% | 0% until a campaign, then 5% to 10% | Dormant until a campaign starts (weekly decision, targeting companies with P below 0.8 V or poor governance). During a campaign D = +0.8 until the target stake is reached, then a demand and an Activist faction ([01-companies.md](../01-companies.md) 1.7) | Harrow Activist Partners |
| **Sovereign funds** | 5% | 0% to 10% | Strategic and slow. Buy national champions when they fall 15% in a month while a foreign holder group owns 10% or more (defense). Never sell to a hostile foreign bidder unless the offer is at least 1.5 x V. Follow their government's foreign policy | Gulf Horizon Fund, Han Strategic Investment, Temasek-like "Lion Holdings" |
| **Hedge funds** | 15% | 2% to 8% | Event-driven. Merger arbitrage (buy targets toward the offer price weighted by deal odds), short campaigns, squeeze hunting (buy stocks with high short interest when Buzz is above 40). Default D = 0.5 x momentum signal | Wolfsbane Capital (short seller), Meridian Arb |
| **Market makers** | 12% | under 1% | Absorb imbalance: D = -0.3 x (sum of the other archetypes' net) / their capacity. They absorb up to 30% of net imbalance. When GRG is above 50 or after a circuit breaker they absorb only 10%, which makes moves sharper | Citadel-like "Bastion Liquidity" |

Archetype shares vary by exchange [T]:

| Exchange | Index | Value | Momentum | Retail | Activist | Sovereign | Hedge | Market makers |
|---|---|---|---|---|---|---|---|---|
| ATX, HDM | 20% | 10% | 22% | 15% | 4% | 2% | 15% | 12% |
| CLX, CBX, LCX | 15% | 14% | 18% | 15% | 4% | 6% | 16% | 12% |
| ESE | 18% | 10% | 18% | 24% | 2% | 6% | 10% | 12% |
| HSE | 5% | 5% | 10% | 60% | 0% | 10% | 2% | 8% |
| VHX | 10% | 10% | 18% | 30% | 2% | 8% | 12% | 10% |
| GXI, HRX | 8% | 8% | 15% | 45% | 1% | 5% | 8% | 10% |
| PSX | 10% | 10% | 18% | 30% | 2% | 5% | 15% | 10% |
| NJX | 5% | 8% | 10% | 35% | 0% | 30% | 2% | 10% |

**Volume:** ADV starts at a turnover rate times the free float: 0.5% per day for large caps, 0.8% for mid caps, 1.2% for small caps and meme stocks [T]. Volume doubles on earnings days and on news shocks, and rises by 50% when GRG is above 40.

**Proxy adviser:** index funds vote as recommended by **Civic Proxy Advisers**, an AI organization that favors independent directors, one-share-one-vote and higher dividends. It can be lobbied (an Influence scheme), which is a quiet way to swing a proxy fight.

### 3.3.5 Sentiment and the Global Risk Gauge

Four layers of mood feed prices.

| Layer | Range | Updated | Main drivers | Decay toward 0 (or baseline) |
|---|---|---|---|---|
| **GRG** (Global Risk Gauge) | 5 to 100, baseline 18 | Hourly | `GRG = 18 + 0.8 x (Globe 1000 20-day annualized volatility in % - 15) + event shocks`. Shocks: war +10 to +30, major bank failure +15, sovereign default +10 to +20, pandemic +25, chokepoint closed +5 [T] | Event shocks fade 3% per day |
| **Market sentiment** (Mkt, per exchange) | -100 to +100 | Daily | +3 per 1% index return that day; -0.5 per point of GRG rise; central bank surprises (3.9.5); elections and crises | 10% per day |
| **Sector sentiment** (Sec, per sector per exchange) | -100 to +100 | Daily | +2 per 1% sector index return; sector news (a chip shortage, a cyberware ban) | 15% per day |
| **Buzz** (per stock) | -100 to +100 | On events, daily decay | News (3.3.6), ad campaigns (+10 per campaign week), psyops (+25, see 3.10), meme hype, short reports (-30), analyst initiations (+5 to +15) | 25% per day |

Players can move Buzz directly with the influence tools of [05-map-and-influence.md](../05-map-and-influence.md) 5.3: an ad campaign for a product or IPO is legal; a bot campaign to pump a stock you are selling is manipulation (3.10).

### 3.3.6 News shocks

A news shock changes V (if the facts change), sets an **immediate jump** in P on the next tick (or as an opening gap if the market is closed), and moves Buzz. All values are [T].

| News | Change to V | Immediate jump in P | Buzz | Notes |
|---|---|---|---|---|
| Earnings surprise (s = (actual - consensus) / abs(consensus)) | Full recalculation | clamp(0.5 x s, -25%, +25%) | +/- 20 x s, capped at 30 | Consensus is set the week before from analysts' forecasts; a CFO with Finance 15+ can "manage expectations" to lower it |
| Guidance cut or raise | Forward earnings change | -8% to -15% (cut), +3% to +8% (raise) | -15 / +10 | |
| Dividend cut / suspension / raise | Q modifier | -5% to -15% / -10% to -20% / +1% to +3% | | Larger for high-yield stocks |
| CEO dies or is ousted | Q via the new CEO's skill | -3% to -10%; +5% if the market disliked the old CEO | -10 | |
| Scandal (minor / major / criminal) | Q modifier | -3% / -10% / -20% | -20 / -40 / -60 | From schemes and investigations ([03-characters.md](../03-characters.md) 3.6) |
| Regulatory probe opened | Q -0.08 | -5% to -15% | -25 | |
| Takeover bid announced | None | P jumps to `p x offer + (1 - p) x P_before`, where p is the market's estimate of deal success (0.5 to 0.9) | +40 | Merger arbitrage holds the price there |
| Disclosure filing by a known raider | None | See 3.4.9 | +20 | |
| Facility disaster or strike | Earnings recalculated from lost output | -(share of revenue lost x 2), capped at -30% | -20 | From [06-economy.md](../06-economy.md) |
| Short report published | None unless proven | -5% to -20%; reversed by half if the company rebuts (CFO or General Counsel skill check) | -30 | False reports are manipulation |
| Index inclusion announced | None | +3% to +7% over 5 days | +10 | |
| Rumor (true or planted) | None | +/- 2% to 6% | +/- 15 | Fades unless confirmed |
| Sector shock (commodity input price up 20%) | Recalculated earnings | Sector-wide, by input cost share | Sector -20 | |

### 3.3.7 Price impact, slippage and order types

Large orders cost more than small ones in two ways:

1. **Permanent impact** (the `flow` term in 3.3.3): buying a total of Q shares lifts the price by about `0.8 x sigma_d x Q / ADV`, however the order is split. This part stays, only slowly eroded by the pull toward V*.
2. **Temporary impact** (slippage) on each fill: an order of q shares filled in a tick with hourly volume v costs an extra

   `slip = 0.5 x sigma_h x sqrt(q / v)` [T]

   above (for buys) or below (for sells) the tick price. It does not move the price; it is the cost of demanding liquidity fast.

Patience lowers slippage but not permanent impact, and gives rivals time to notice. That is the core trade-off of stake building.

**Participation cap:** a holder group can fill at most 25% of a tick's total volume in one stock [T]. Larger needs go through block trades or tender offers.

| Order type | How it fills | Use |
|---|---|---|
| **Market** | This tick, up to the participation cap; the rest carries to the next tick | Speed |
| **Limit** | When the tick price reaches the limit, up to the cap | Price control |
| **Work order** | Spread over N ticks at a chosen participation rate (5% to 25%) | Low slippage stake building |
| **Block trade** | Negotiated with one named holder in a short event (1 to 8 hours of a character's time). Price = market price plus or minus a premium or discount set by the holder's reservation price. No slippage, but the trade is printed after settlement and the market then applies 30% of its permanent impact | Buying a stake from a fund, selling a stake without crashing the price |
| **Tender offer** | Public offer to all holders at a fixed price for a set period (2 to 4 weeks), possibly conditional (minimum acceptance, regulatory approval, removal of a poison pill) | Takeovers ([01-companies.md](../01-companies.md) 1.8) |

### 3.3.8 Circuit breakers and price limits

All values are [T].

**Single-stock breakers** (all exchanges unless a hard limit applies):

| Move from previous close | Effect |
|---|---|
| +/- 10% | Trading halted for 1 tick, then resumes with an auction tick (no participation cap, market makers absorb only 10%) |
| +/- 20% | Halted for the rest of the day |
| News shock pending (company asks for a halt) | Halted until the news is published, at most 2 ticks |

**Hard daily limits** (price cannot trade beyond them; unfilled orders wait until the next day):

| Exchange | Limit |
|---|---|
| HSE | +/- 10% (Star board +/- 20%); IPO first day +44% / -36% |
| HRX | +/- 30% |
| ESE | +/- 20% |
| NJX | +/- 10% |
| GXI | +/- 20% for index members, +/- 5% for small caps flagged as speculative |

**Market-wide breakers** (all exchanges): headline index down 7% from the previous close halts all trading for 1 tick; down 13% halts for 1 more tick; down 20% closes the exchange for the day.

IPOs are exempt from single-stock breakers on their first day, except the HSE limits.

### 3.3.9 Opening, closing and overnight gaps

- **Opening auction**: the first tick of a session sets the opening price as the previous close times (1 + overnight news jumps + 0.5 x beta x the Globe 1000 move since this exchange last closed) [T]. Tokyo's open reflects New York's close, London's open reflects Asia, and so on around the world.
- **Closing auction**: the last tick's price is the official close. Index rebalances, buybacks and forced liquidations often execute here.
- **Lunch breaks** (ESE, HSE, VHX, LCX) are skipped turns; news arriving during lunch becomes a gap at the afternoon open.

### 3.3.10 Daily settlement

At each exchange's close:

1. Trades of the day settle: cash and shares change hands (same-day settlement in game terms) [T].
2. V is refreshed with the day's inputs.
3. Sentiment decays; Buzz decays.
4. Borrow fees, margin interest and carry accrue (3.5).
5. Margin accounts are checked and formal margin calls issued (3.5.4).
6. Disclosure filings due that day are published, and AI holders react on the next tick (3.4.8, 3.4.9).
7. Ex-dividend adjustments for the next open are scheduled.
8. Surveillance checks run for trades made ahead of today's news (3.10).

---

## 3.4 Corporate actions

### 3.4.1 IPO event chain

The IPO is the event chain named in [10-events.md](../10-events.md) 10.2 (Hire Banks, Roadshow, Pricing Night, First Day of Trading), expanded below. It unlocks in Stage 3.

**Preconditions**
- The company meets the target exchange's listing requirements (3.2.2) at its current V.
- The board approves (a board vote; a VC faction may force the question with an ultimatum).
- The charter is converted to a public charter. If the founders want dual-class shares, this is the moment, and only where the exchange allows them.

**Step 1: Hire Banks** (1 week; 3 pitch meetings of 2 hours with the CEO or CFO)

| Bank tier | Minimum deal size | Fee (gross spread) | Effect | Examples |
|---|---|---|---|---|
| Bulge bracket | $500M | 3.5% (2.5% on ESE, HSE, VHX) | Roadshow coverage +1.0; analyst coverage from day 25; stabilization strong | Sterling Crane & Co, Hollis Barrow, Tanaka-Wren Securities, Banque Laurent-Moss |
| Major | $100M | 5.0% | Coverage +0.5 | Kestrel Partners, Ruhr Atlantic, Dalal & Pierce |
| Boutique | $20M | 7.0% | Coverage +0; cheaper chance of skeletons surfacing (smaller due diligence) | Many regional names |

Other costs: legal and accounting 1% of primary proceeds (minimum $2M), plus the exchange listing fee [T].

**Step 2: Due diligence and filing** (4 to 8 weeks)
- The regulator reviews the filing; review time is 4 weeks plus 1 week per strictness point above 2.
- **Skeletons**: each hidden issue (a shell with exposure above 30, a pending investigation, an undisclosed scandal, a hook a rival holds over the CEO) has a 30% chance to surface, plus 10% for a bulge bank, minus 1% per point of the General Counsel's Intrigue skill above 10 [T]. A surfaced issue must be disclosed (V falls by its Q modifier) or concealed (securities fraud, see 3.10).
- A **quiet period** starts: company insiders cannot run ad campaigns about the stock.

**Step 3: Price range**
- Midpoint = 0.88 x V (the customary IPO discount of 12%) [T]; range is the midpoint +/- 7%.
- The company chooses the offering size: primary shares (new money for the company) and secondary shares (existing holders selling, for example VCs cashing out), plus a **greenshoe** of 15% extra shares the banks may sell.

**Step 4: Roadshow** (2 weeks; 8 to 12 investor meetings of 2 to 4 hours each in different hubs, so travel time matters)

Each meeting is a skill check of the presenters' Influence plus Finance against the investor's sophistication. The result builds **coverage**, the oversubscription multiple of the order book:

`Coverage = 1.5 + bank tier bonus + 3 x Mkt/100 + 2 x Sec/100 - 0.05 x max(0, GRG - 25) + 5 x (Q - 1) + meeting results`

Meeting results: success +0.3, great success +0.5, failure -0.1 [T].

**Step 5: Pricing Night** (a 4-hour event)

| Coverage | Allowed pricing |
|---|---|
| Below 1x | Below range, or postpone (30% of bank fees are still owed; retry after 3 months) |
| 1x to 2x | Bottom to middle of range |
| 2x to 5x | Anywhere in range |
| 5x to 10x | Top of range to 10% above it |
| Above 10x | Up to 20% above the top |

Allocation choices made on Pricing Night:
- **Directed shares**: up to 5% of the offering to named friendly holders (family allies, Ask Daddy investors) at the offer price. A way to seed a bloc.
- **Cornerstone investors** (ESE, HSE, VHX, LCX, GXI, NJX): up to 30% of the offering placed with sovereign or strategic holders who accept a 6-month lock-up. Lowers volatility; gives a government a seat at the table.
- **Retail tranche**: 10% to 30% (default 20%). Each 10 points above 20% adds 2% to the expected pop and doubles Buzz decay time for a month.

**Step 6: First Day of Trading**

`Expected pop = 0.5 x (V_post - offer) / offer + 0.05 x (Coverage - 3) + 0.10 x Mkt/100 + 0.2 x (retail tranche - 20%)`

plus noise with a standard deviation of 8% [T], clamped to -15% and +60%. V_post is V after adding the net primary proceeds to the company's cash. The opening auction prints at offer x (1 + pop). First-day volatility is doubled.

**Step 7: Stabilization and greenshoe** (30 days)
- If the price trades above the offer, the banks exercise the greenshoe: the company sells 15% more shares at the offer price.
- If the price trades below the offer, the banks buy back up to 15% of the offering at the offer price, supporting it.

**Step 8: Quiet period ends** (day 25): the banks' analysts initiate coverage, Buzz +5 to +15.

**Step 9: Lock-up** (180 days; 90 days on HDM and VHX for tech [T]): pre-IPO holders cannot sell. At expiry, if locked shares exceed twice the free float, price -2% to -6% over 5 days as the market expects selling.

**Step 10: Index eligibility** (after 3 months): if the company qualifies, an index inclusion event (3.2.3).

**What changes after listing**
- Quarterly earnings reports become public events with consensus and surprises.
- Disclosure thresholds, insider rules and blackout windows apply to all holders.
- Required Independent Directors join the board.
- Activists, short sellers and raiders can now target the company.
- Shares can be pledged for loans at listed-stock rates (3.5.5), which unlocks a lot of founder liquidity and a lot of founder risk.

### 3.4.2 Other ways to list

| Route | Time | Cost | Effect |
|---|---|---|---|
| **Direct listing** | 4 weeks | 1% fees, no bank spread | No new money. Opening price = V x (1 + 0.15 x Mkt/100) plus noise of 15%. No stabilization, no lock-up, very volatile first month |
| **Back-door listing** (reverse merger into a listed shell) | 4 weeks | Cost of buying the shell (a tiny listed company) | Fast, skips the roadshow and most due diligence. Q -0.10 for a year; regulator suspicion +20 |
| **Spin-off listing** of a vassal | Like an IPO | Like an IPO | The parent keeps a stake. Changes the vassal's autonomy to Independent Listing ([01-companies.md](../01-companies.md) 1.5) |

### 3.4.3 Secondary offerings and rights issues

**Follow-on offering** (new shares sold to the market)
- Priced overnight in an accelerated bookbuild (a 2-hour event).
- Discount to the last close: 4% for large caps, 8% for small caps [T].
- Announcement effect: -(2% + 0.5 x dilution%). Example: 10% new shares, -7%.
- Fees: 2.5% (bulge) to 4% (boutique).
- Needs shareholder approval above 20% new shares (ATX, HDM). On exchanges with **pre-emption rights** (CLX, CBX, LCX, VHX), more than 10% new shares must be offered to existing holders first, as a rights issue.

**Secondary block sale** (an existing holder sells)
- Discount 3% to 10% depending on block size versus ADV. An insider selling signals: Buzz -10, price -2%.

**Rights issue**
- Every holder gets rights to buy new shares pro rata, at a discount of 20% to 35% to the theoretical ex-rights price [T].
- Rights trade for 10 trading days. Holders subscribe, sell their rights, or let them lapse.
- Usually underwritten by banks (fee 2% to 3%), who buy unsubscribed shares.
- **Control matters**: a holder who does not take up rights is diluted. AI bloc members take up their rights if they have the cash and their opinion of the bloc leader is above 0; otherwise they sell rights, possibly to a rival. A rights issue can therefore be used against a cash-poor minority bloc, or by a rival to bleed a cash-poor controlling family.

### 3.4.4 Buybacks

- Authorized by the annual shareholder meeting, up to 10% of shares per year without further approval [T].
- **Open-market buyback**: at most 25% of ADV per day (safe harbor); blacked out for the 30 days before each earnings report. Bought shares are cancelled.
- **Tender buyback**: a fixed-price or Dutch-auction offer at 5% to 15% above market.
- Announcement effect: +1% to +3%, and up to +5% if P is below 0.8 V.
- **Creeping control**: a buyback raises every remaining holder's percentage. Threshold crossings caused only by a buyback are disclosed but exempt from mandatory bids. A family that cannot afford to buy more shares can let its company buy back stock instead, which is cheaper personally but costs the company cash.

### 3.4.5 Splits

- Ratios 2:1, 3:1, 5:1, 10:1. Effective at the next open. No change to V or market cap.
- Effect: Buzz +10 and a small retail-driven drift of +1% over 2 weeks [T].
- **Reverse splits** (1:10 and so on) signal distress: Buzz -10, price -3%.
- **Minimum price**: on ATX and HDM, a stock below $1 for 30 trading days gets a delisting notice and must reverse split within 90 days.

### 3.4.6 Dividends

The board sets a **dividend policy** at the annual shareholder meeting. Dividends are declared with the quarterly earnings report and paid in the next monthly calculation, matching the monthly cash flow of [02-trusts-and-assets.md](../02-trusts-and-assets.md) 2.4. Up the vassal chain, dividends are the tribute.

| Policy | Rule | Market view |
|---|---|---|
| None | Retain all earnings | Normal for growth sectors; value and sovereign funds hold less |
| Fixed payout | X% of quarterly earnings | Dividend moves with earnings |
| Progressive | Never cut; raise 5% to 10% a year | Q +0.03 after 5 years; a cut is a major shock (-10% to -15%) |
| Fixed amount | Same per share each quarter | Simple; cutting is a shock |
| Special | One-off payout | Ex-date drop only; Buzz +10 |

- **Ex-dividend date** is 2 weeks after declaration; the price opens lower by the dividend amount.
- **Withholding tax** for foreign holders: 15% by default, set by each country's tax law [T].
- A controlling family that needs cash for its trust can push dividends up through its board seats, at the cost of growth (less reinvestment) and, if payout exceeds earnings, falling V.

### 3.4.7 Delisting and going private

**Involuntary delisting** triggers [T]:

| Trigger | Cure period |
|---|---|
| Market cap or price below the exchange minimum for 60 trading days | 90 days after notice |
| Free float below 5% (usually after a takeover) | None: delisted after a 30-day notice |
| Failure to file an earnings report | 30 days |
| Bankruptcy filing | Shares suspended; delisted if liquidation is chosen |
| Serious fraud found by the regulator | Immediate suspension; delisting decided in the investigation chain |

A delisting announcement for cause: -30%.

**Going private** (voluntary):
- After a tender offer reaches **90%** of shares, the bidder can **squeeze out** the rest at the tender price [T].
- Otherwise a **buyout vote** at a premium of at least 20% must be approved by a majority of the **minority** holders (shares not held by the bidder's holder group).
- Holders who reject can claim **appraisal**: a court event sets a fair price of V x 1.0 to 1.2.
- After delisting, shares become private stakes and trade only through negotiation events ([02-trusts-and-assets.md](../02-trusts-and-assets.md) 2.6).

### 3.4.8 Disclosure thresholds

The four thresholds of [02-trusts-and-assets.md](../02-trusts-and-assets.md) 2.6 apply everywhere. Jurisdictions differ only in deadlines and in what counts toward them.

| Threshold | Filing deadline | What is published | Legal effects |
|---|---|---|---|
| **5%** | 2 trading days (5 on ATX and HDM) [T] | Holder name (or the shell's name), stake, intent (Passive or Active), source of funds | A Passive filer who later wants to act must refile as Active and wait 5 trading days |
| **10%** | 2 trading days | Same, plus every later trade within 2 days | **Insider status**: short-swing rule (profits from a buy and a sell within 6 months are handed back to the company); blackout windows before earnings; right to nominate a director at the next annual meeting |
| **25%** | 2 trading days | Same | **Blocking minority**: can veto two-thirds votes (charter changes, mergers, staggered boards); foreign investment review if a foreign holder group crosses 25% in a sensitive sector (energy, utilities, defense, chips, data, media) ([08-politics.md](../08-politics.md) 8.5); antitrust filing if the holder is a competitor |
| **50%** | Immediate | Same | **Control**: the company becomes a vassal if the holder is a company ([01-companies.md](../01-companies.md) 1.5); the head changes under the charter; delisting check if free float drops below the minimum |

Every later crossing of the same thresholds downward (falling below 50%, 25%, 10%, 5%) is also disclosed.

**What counts toward a threshold**
- All shares held by the holder group (controlled entities and bloc partners) count together. Coordinating with others without declaring a bloc is **undisclosed concert action**, a violation (3.10).
- Shares held through a **Shell Company** vassal are filed under the shell's name. The true owner stays hidden until the shell is investigated, by a rival's Investigate Shell scheme or by the regulator. Weekly detection chance: 2% base, +1% per threshold the shell has crossed, x regulator strictness / 3 [T].
- **Cash-settled derivatives** (equity swaps) count only where the Derivatives Disclosure law is active: by default CLX, CBX, LCX, VHX and HRX [T]. Elsewhere a raider can build an economic stake through swaps with a bank, which buys real shares to hedge (so the price still moves), then convert to shares in one block, crossing several thresholds at once. Legal, but regulator suspicion +15 per conversion.
- Shares on loan to short sellers count for the borrower while borrowed (3.5.1).

### 3.4.9 How AI holders react

**Price reaction** to a filing, applied on the next tick [T]:

| Threshold crossed (Active intent) | Base jump | Multiplied by filer type |
|---|---|---|
| 5% | +2% | Passive fund x0, unknown x1, known activist x1.5, known raider or strategic competitor x2 |
| 10% | +3% | Same |
| 25% | +5% | Same |
| 50% | P moves toward the expected price of any mandatory or follow-on offer | |

**Reservation prices.** Each named AI holder has a reservation price: the lowest price at which it will sell a block or tender its shares. Base values [T]:

| Holder type | Base reservation price |
|---|---|
| Index fund | Tenders at any premium if the offer is likely to succeed (they follow the crowd); never sells blocks outside rebalances |
| Value fund | max(V, P) x 1.10 |
| Retail (dispersed) | Each slice draws P x 1.10 to 1.40 |
| Activist | Its campaign target price, usually V x 1.15 |
| Sovereign fund | V x 1.5 for a foreign hostile bidder; V x 1.1 for a domestic one |
| Hedge fund (merger arb) | Tenders at the offer if the deal is likely; sells blocks at P x 1.03 |
| Family and founders (AI) | Driven by opinion of the bidder: never below V x 1.3; refuses rivals and Nemeses at any price |

After an Active filing all reservation prices rise: +5% at 5%, +10% at 10%, +15% at 25% (the **holdout effect**) [T].

**Behavior by holder type after an Active filing by a hostile holder group:**

| Holder | Reaction |
|---|---|
| Target's board | At its next weekly decision the General Counsel proposes defenses: poison pill (where allowed), staggered board (needs a two-thirds vote, which a 25% blocker can stop), white knight search, crown-jewel sale, charter change ([01-companies.md](../01-companies.md) 1.8) |
| Controlling bloc | Members' opinion of the leader is tested: members with opinion below 0 may open talks with the raider (a defection risk) |
| Hedge funds | Buy 2% to 5% of the float for merger arbitrage; become swing holders who sell to the highest bidder |
| Value funds | Hold out for a premium; sell blocks only at their reservation price |
| Sovereign funds | Buy to defend if the raider is foreign and the target is a national champion |
| Retail | Buzz +20; some sell into the jump, most hold for a bid |
| Rival dynasties | AI rivals may launch a counter-stake or offer to be a white knight, buying a bloc position for future leverage |
| Regulators | Suspicion review if the stake rose very fast before the filing (3.10) |

**Poison pill** (allowed on ATX, HDM, HRX, ESE [T]): adopted by the board, triggers when a holder group crosses 15% without board approval. On trigger every other holder may buy new shares at half price, diluting the raider heavily. It can be redeemed by the board, voted away at the annual meeting, or challenged in court (a General Counsel event). On CLX, CBX and LCX a **board neutrality rule** forbids pills once an offer is announced; the board must seek a white knight instead.

---

## 3.5 Short selling, margin and options

### 3.5.1 Borrowing and short selling

- **Locate first**: before shorting, the holder must borrow shares from the **lendable pool**: 90% of index fund holdings, 50% of value and hedge fund holdings, 30% of sovereign holdings, and 20% of retail shares held in margin accounts [T]. Typical lendable pool: 25% to 35% of free float. The player can lend out their own shares for a fee too, but lent shares do not vote.
- **Utilization** u = shares on loan / lendable pool.

| Utilization | Annual borrow fee [T] |
|---|---|
| Below 50% | 0.5% (general collateral) |
| 50% to 70% | 2% |
| 70% to 85% | 8% |
| 85% to 95% | 25% |
| Above 95% | 60%, and new borrows may fail |

- Fees accrue daily at settlement. The short seller pays any dividend to the lender.
- Short positions need margin: 150% of the position's value held as collateral (the sale proceeds plus 50%), with a maintenance level of 130% [T].
- **Short interest** (shares short / free float) is published weekly.
- **Recalls**: when a lender sells its shares, or wants to vote in a contested meeting, it recalls them within 2 trading days. Index funds recall 60% of loaned shares before a proxy fight's record date [T]. If no other borrow is found, the short is **bought in** at market, adding buy pressure.
- **Empty voting**: shares on loan vote with whoever holds them on the record date. Borrowing shares to vote in a proxy fight is legal on most exchanges but adds regulator suspicion +10.
- **Uptick rule**: after a stock falls 10% in a day, new shorts can only be placed on ticks where the price rises, for the rest of that day and the next.
- **Short bans**: in a crisis (GRG above 60) a regulator can ban new shorts in a sector for 2 to 6 weeks (an event).
- **Naked shorting** (selling without a borrow) is only possible on the Freeport Night Market, or as a manipulation offense on a regulated exchange.

### 3.5.2 Short reports

A hedge fund (or a player with a Shell or Front Company) can publish a **short report**: a news shock of -5% to -20% (3.3.6). The company can rebut through a CFO or General Counsel event; success reverses half the drop. A report that contains fabrications, if exposed, is the manipulation offense "short and distort" (3.10).

### 3.5.3 Short squeezes

A stock enters **squeeze state** when all three hold [T]:
- short interest at least 20% of free float,
- 5-day return at least +20%,
- utilization at least 85%.

During a squeeze, on each tick:
- Every short position whose unrealized loss exceeds its holder's **pain tolerance** (AI hedge funds 25% to 60% of position value; the player sets their own stop or decides by hand) covers 10% of its remaining size, as a buy order.
- Retail D gets +0.3, and hedge funds hunting squeezes buy.
- Market makers absorb only 10% of imbalance.

The squeeze ends when short interest falls below 10%, the price falls 30% from its peak, or 10 trading days pass. Circuit breakers interrupt the climb but do not end it. A player who holds a big stake in a heavily shorted company can deliberately **recall lent shares** and spread Buzz to trigger a squeeze; doing this with false information is manipulation.

### 3.5.4 Margin accounts

Personal accounts and trusts (if the trust rules allow leverage) can open a margin account with a prime broker (Sterling Crane & Co, Hollis Barrow, Tanaka-Wren Securities). The **equity ratio** is (assets - loan) / assets.

**Initial and maintenance margin** (equity ratio required) [T]:

| Asset | Initial margin | Maintenance margin |
|---|---|---|
| Large-cap stock | 50% | 30% |
| Small-cap stock | 70% | 40% |
| Stock under $5, or on Freeport | 100% (no loan) | n/a |
| Concentrated position (one stock above 25% of the account) | +10 points | +10 points |
| Control stake (10% or more of one company) | Counted at 70% of market value as collateral | |
| Investment-grade government bond | 10% | 5% |
| Investment-grade corporate bond | 20% | 15% |
| High-yield bond | 50% | 35% |
| FX position (majors / emerging / pegged under pressure) | 5% / 10% / 20% | 3% / 7% / 15% |
| Commodity futures | Exchange-set, 8% to 15% of notional | 75% of initial |
| Crypto | 50% | 35% |

**Interest**: policy rate + 2.5% for accounts under $100M of assets, + 1.5% for $100M to $1B, + 1.0% above $1B [T]. Accrues daily, charged monthly.

**Margin call procedure**

1. **Warning (hourly)**: if the equity ratio falls within 5 points of maintenance, a **Margin Warning** notification fires and auto-advance stops ([09-time-and-turns.md](../09-time-and-turns.md) 9.1).
2. **Call (daily settlement)**: if the equity ratio is below maintenance at settlement, the **Margin Call** event fires ([10-events.md](../10-events.md) 10.3). The amount due restores the ratio to maintenance + 5 points. Deadline: the next settlement (24 turns).
3. **Options** in the event:
   - Deposit cash.
   - Pledge other assets (real estate counts at 50% of value after a 6-hour valuation; bonds at their margin rate).
   - Sell positions of the player's choice.
   - **Negotiate an extension**: chance = 40% + 2% per Finance point above 10 + 0.5% per point of opinion the broker's relationship manager has of the account holder, - 10% if under a scandal [T]. Success gives 2 more trading days for a fee of 0.5% of the loan; failure costs broker opinion -10 and raises the leak chance.
   - Ask a family member or ally for a loan (creates a debt and usually a hook).
   - Ask the family trust, if the trust rules allow loans or distributions of that size; otherwise a family vote is needed ([02-trusts-and-assets.md](../02-trusts-and-assets.md) 2.2).
4. **Leak**: each margin call has a 20% chance of becoming known (rival intel, journalists, the broker's other clients). A leaked call is a news shock of -3% to -8% on the pledged stock, and hedge funds add short positions (predatory trading) [T].
5. **Forced liquidation**: if the deadline passes unpaid, or if the equity ratio falls below maintenance - 10 points at any tick, the broker sells until the ratio is back to maintenance + 10 points. It sells the most liquid positions first, at 50% participation (heavy slippage). Control stakes are sold through a **Block Auction** event: named holders bid, usually at 5% to 15% below market, and the winner is announced. Rivals love block auctions.
6. **Cascade**: forced sales push the price down, which can trigger calls on other leveraged holders of the same stock (family members, AI funds), whose forced sales push it further. Circuit breakers are the only brake.

### 3.5.5 Stock-pledge loans

Founders and families often borrow against a control stake instead of opening a margin account. A bank lends against pledged shares that stay in the holder's name (and keep their votes) [T]:

| | Large cap | Small cap |
|---|---|---|
| Maximum loan-to-value (LTV) at origination | 35% | 25% |
| Warning | 45% | 35% |
| Margin call (restore to 40% / 30% LTV by next settlement) | 50% | 40% |
| Forced sale (sell until LTV is 40% / 30%) | 60% | 50% |
| Interest | Policy rate + 2% | Policy rate + 3.5% |

The procedure is the same as 3.5.4. A pledge is disclosed in filings once it covers more than 5% of a company, so rivals know where the pressure points are.

### 3.5.6 Options (later feature)

Options arrive after the core markets are stable. Summary of the intended design:
- Listed calls and puts on headline index members of ATX, HDM, CLX, CBX, ESE and VHX; monthly expiries out to 12 months.
- Premiums come from implied volatility = realized 20-day volatility x 1.1 + 0.2 x max(0, GRG - 20) volatility points [T].
- Uses: protective puts and collars on control stakes (which raise the LTV a bank will accept), covered calls for income, cheap speculation.
- **Gamma squeeze**: market makers hedge the options they sell, buying as prices rise; heavy call buying can force a squeeze like 3.5.3.
- Options count toward disclosure thresholds at their delta where the Derivatives Disclosure law is active.

---

## 3.6 Bonds and credit

### 3.6.1 Issuers and instruments

| Issuer | Instruments | Where they trade | Notes |
|---|---|---|---|
| National governments | Bills (3 and 12 months), notes and bonds (2, 5, 10, 30 years) | Over the counter, 24 hours on weekdays, liquidity by session like FX | Issued at monthly auctions; eurozone members each issue in EUR with their own rating |
| Regional and city governments | 5 to 30-year bonds | Home session only | Buying them gives political influence with the issuer ([05-map-and-influence.md](../05-map-and-influence.md) 5.3) |
| Companies, investment grade | 3 to 30-year bonds | Home session | Issued by bookbuild (an event); fee 0.5% |
| Companies, high yield | 5 to 10-year bonds | Home session | Fee 1.5%; tighter covenants |
| Private credit | Loans from funds | Not traded | Negotiated in events; leverage over borrowers ([02-trusts-and-assets.md](../02-trusts-and-assets.md) 2.5) |
| International Stabilization Fund (ISF) | Bailout loans to governments | Not traded | The game's stand-in for the IMF; loans come with conditions |

Each bond has: currency, face value, coupon (paid semiannually, through the monthly calculation), maturity, seniority (secured, senior unsecured, subordinated), covenants (maximum net debt / EBITDA, minimum interest coverage) and a rating.

Corporate bonds are less liquid than stocks: their daily depth is 0.2% of the issue size [T], so selling a big block costs real slippage (same formula as 3.3.7).

### 3.6.2 Rating scale

Three fictional agencies rate issuers: **Meridian Ratings**, **Halvorsen & Gray** and **Cassini Credit**. The scale has 22 steps; AA to B carry plus and minus notches.

Values are [T]. Spreads are over the government yield in the same currency and maturity. Default probabilities are the market's belief, used for pricing and AI decisions; actual defaults only happen when an issuer cannot or will not pay (3.6.6).

| Rating | Grade | Corporate spread (5-year, basis points) | Sovereign spread (basis points) | Market's annual default probability |
|---|---|---|---|---|
| AAA | Investment grade | 40 | 0 | 0.01% |
| AA+, AA, AA- | Investment grade | 60 | 15 | 0.02% |
| A+, A, A- | Investment grade | 90 | 40 | 0.05% |
| BBB+, BBB, BBB- | Investment grade (lowest) | 150 | 100 | 0.2% |
| BB+, BB, BB- | High yield | 280 | 250 | 0.8% |
| B+, B, B- | High yield | 450 | 450 | 3.5% |
| CCC | Distressed | 900 | 800 | 20% |
| CC | Distressed | 1,600 | 1,400 | 35% |
| C | Default imminent | 2,500 | 2,500 | 50% |
| SD | Selective default (a distressed exchange) | Trades at expected recovery | Trades at expected recovery | n/a |
| D | Default | Trades at expected recovery | Trades at expected recovery | n/a |

Within a band, each notch interpolates: a plus notch is a third of the way toward the better band, a minus notch a third toward the worse one.

### 3.6.3 How ratings are set

**Corporate implied rating** comes first from leverage, then adjustments [T]:

| Net debt / EBITDA | Starting rating |
|---|---|
| Below 0.5 | AAA |
| 0.5 to 1.0 | AA |
| 1.0 to 2.0 | A |
| 2.0 to 3.0 | BBB |
| 3.0 to 4.0 | BB+ |
| 4.0 to 5.0 | BB- |
| 5.0 to 6.5 | B |
| 6.5 to 8.0 | CCC |
| Above 8.0, or EBITDA negative | CC |

| Adjustment | Notches |
|---|---|
| Interest coverage (EBITDA / interest) above 10 | +1 |
| Interest coverage below 3 / below 1.5 | -1 / -2 |
| Revenue above $20B / below $500M | +1 / -1 |
| Sector: utilities | +1 |
| Sector: biotech, cyberware, shipping, mining | -1 |
| Under investigation, or shell exposure above 50 | -1 |
| Captive Bank / Insurer or parent guarantee from a stronger parent | Up to the parent's rating minus 1 |
| **Country ceiling** | No higher than the home sovereign + 1 notch, or + 3 if more than half of revenue is earned abroad |

**Sovereign implied rating** is a points score [T]:

| Factor | Points |
|---|---|
| Debt / GDP below 40% / 40 to 80% / 80 to 120% / above 120% | +3 / +1 / -1 / -3 (0 for reserve-currency issuers above 120%) |
| Budget deficit below 2% / 2 to 5% / above 5% of GDP | +1 / 0 / -2 |
| FX reserves above 6 months of imports / 3 to 6 / below 3 | +1 / 0 / -2 |
| Inflation within 2 points of target / above target by 5+ points | +1 / -2 |
| Stability ([08-politics.md](../08-politics.md) 8.7) above 70 / below 40 | +1 / -2 |
| Issuer of a reserve currency (USD, EUR, JPY, GBP, CHF) | +2 |
| Default in the past 10 years | -3 |
| Government type: liberal democracy +1; one-party state 0; military junta -2; failed state -5 | |

Score 7 or more maps to AAA, then one notch lower per point down to CCC at -12 or below.

### 3.6.4 Rating agency behavior

- **Quarterly review** of every issuer ([09-time-and-turns.md](../09-time-and-turns.md) 9.2). The rating moves toward the implied rating by at most 1 notch per review, or 2 notches if the gap is 3 or more. Ratings are sticky on purpose.
- **Outlook** (Positive, Stable, Negative) is set one review before a planned move, as a warning to markets.
- **Watch**: after a major shock (takeover, default nearby, currency crisis, a big scandal) an agency places the issuer on Watch and may act within 2 weeks, moving up to 3 notches.
- **Pro-cyclical**: while GRG is above 50, each downgrade review has a 30% chance of an extra notch.
- **Agency personalities**:

| Agency | Personality | Gameplay hook |
|---|---|---|
| Meridian Ratings | Conservative and slow; rates 1 notch below implied 20% of the time | Its downgrades hit hardest because they are rare |
| Halvorsen & Gray | Issuer-friendly ("issuer pays"); rates 1 notch above implied 30% of the time | **Rating shopping**: an issuer can hire only H&G for a new bond, at a fee of 0.1% of the issue; investors price a single-rated bond 10 basis points wider |
| Cassini Credit | Close to governments; rates allied sovereigns 1 notch higher | Politically influenced; its head is a lobbyable character |

- Each agency's lead analyst for an issuer is an AI character. Schemes: **Court the Analyst** (Influence; 30% chance of +1 notch at the next review, never above implied + 1), **Bribe the Analyst** (a crime, 3.10), **Leak to the Analyst** (a rival plants bad news, triggering Watch Negative).
- The market uses the **average** of available ratings; index and fund eligibility use the **middle** of three.

**Effects of crossing the investment-grade line**
- **Fallen angel** (BBB- to BB+): investment-grade-only funds must sell within a month. Bond price -3% to -8% beyond the spread change; bank loans with rating triggers may be repriced (+1% interest) or called.
- **Rising star** (BB+ to BBB-): the reverse, +2% to +4%.

### 3.6.5 Yield formula

**Government bonds** in their own currency, maturity T years:

`y(T) = r_avg(T) + TP(T) + sovereign spread(rating) + calibration offset`

- `r_avg(T)` is the market's expected average policy rate over T: `r_n + (r_0 - r_n) x (tau / T) x (1 - e^(-T / tau))`, with r_0 the current policy rate, r_n the neutral nominal rate (neutral real rate + inflation target, 3.9.2), tau = 3 years [T]. Forward guidance (3.9.5) shifts r_0 by +/- 0.25 points in this formula.
- `TP(T)`, the term premium: `0.3% x ln(1 + T) x (1 + 0.5 x max(0, debt/GDP - 60%))`, minus 0.1 points for each 10% of GDP of government bonds the central bank holds through QE (floor 0) [T].
- The **calibration offset** is a per-country constant set once so that starting yields match the mid-2020s world.

Example: US 10-year with r_0 = 4.0%, r_n = 3.0%, debt 120% of GDP, rating AA+. r_avg = 3.0 + 1.0 x 0.3 x 0.964 = 3.29%. TP = 0.3% x 2.40 x 1.3 = 0.94%. Spread 0.15%. y = 4.38%.

**Corporate bonds:**

`y = government yield (same currency and maturity) + CS(rating) x maturity factor x seniority factor x risk factor + liquidity premium`

| Factor | Values [T] |
|---|---|
| Maturity factor | 2 years 0.8; 5 years 1.0; 10 years 1.15; 30 years 1.3 |
| Seniority factor | Secured 0.7; senior unsecured 1.0; subordinated 1.6 |
| Risk factor | Investment grade: 1 + (GRG - 20) / 100; high yield and below: 1 + (GRG - 20) / 50 |
| Liquidity premium | 0.1% for issues above $1B, 0.3% for $250M to $1B, 0.5% below |

**Price** from yield is the usual present value of coupons and face. As a rule of thumb shown in tooltips, a bond's price changes by about -duration x change in yield (a 10-year bond has a duration of about 8).

**Rates for everyday finance** (all follow from the above):

| Product | Rate [T] |
|---|---|
| Savings and money market | Policy rate - 0.25 (floor 0) |
| Bank loan to a company | Policy rate + corporate spread for its rating + 1.0 |
| Mortgage | 10-year government yield + 1.5 to 2.5 |
| Margin and pledge loans | See 3.5.4 and 3.5.5 |

### 3.6.6 Default and restructuring chain (companies)

**Triggers**: a missed coupon or principal payment in the monthly calculation (not enough cash), a covenant breach not waived, or a voluntary filing.

1. **Missed Payment** (event). A 30-day grace period starts. Rating to C. Bonds fall to expected recovery; equity -40% to -70%.
2. **Choices for the company's head** during grace:
   - Pay late from a rescue loan, an asset sale or a family injection.
   - **Distressed exchange**: offer bondholders new bonds with a 20% to 40% haircut or a longer maturity. If two thirds by value accept, the rating becomes SD, then is re-rated (usually B or CCC).
   - File for **Protected Reorganization** (the game's Chapter 11).
   - File for liquidation.
   - Covenant breaches only: negotiate a **waiver** (fee 0.5% to 1%, tighter terms).
3. **Creditor committee** forms from the largest holders of each class. Hedge funds ("vultures") buy bonds at 20 to 40 cents to lead it; so can the player.
4. **The plan**: management (or any class holding a third or more) proposes a plan: haircut, maturity extension, coupon cut, and usually a **debt-for-equity swap**: old shares diluted to 0% to 10%, bondholders get 70% to 95% of new shares.
5. **Vote**: each class approves with **two thirds by value and a majority by number** [T]. A holder of more than a third of a class can block. A court can impose a plan on one dissenting class if every class is treated at least as well as in liquidation (a "cram-down"; a General Counsel event).
6. **Court approval**: 4 to 12 weeks. Meanwhile the company runs, under a court-appointed monitor.
7. **Outcome**: the company emerges, usually rated B or CCC, with new owners. **Control changes hands**, which can break a dynasty's hold over its flagship ([01-companies.md](../01-companies.md) 1.9: "creditors take control"). Old shares are cancelled or nearly so.

**Liquidation waterfall**: secured creditors, then senior unsecured, then subordinated, then preferred shares (class P), then common shares. Expected recovery used in pricing [T]: secured 65%, senior 40%, subordinated 15%, equity 0% to 5%.

**Personal guarantees** ([02-trusts-and-assets.md](../02-trusts-and-assets.md) 2.7): if a guaranteed loan defaults, the guarantor's accounts are charged; if they cannot pay, their pledged assets are seized.

### 3.6.7 Sovereign default chain

1. **Funding stress**: a failed government bond auction (bid-to-cover below 1.5) pushes yields +0.25 to +0.75 points; Watch Negative.
2. **Missed payment**: rating SD or D; all of that government's bonds fall to expected recovery (30% to 60%); the currency is hit (3.8.7); banks holding the bonds take losses.
3. **Choices for the AI government** (players influence through lobbying and influence in that country):
   - **ISF program**: a loan with conditions: austerity laws (spending cuts, tax rises), central bank independence raised, capital controls lifted or imposed. Stability -10 to -20.
   - **Negotiated haircut** with a creditor committee: 30% to 70% losses for bondholders.
   - **Hard default**: no deal; capital controls; access to markets lost for 5 years.
4. **Holdout creditors**: vulture funds (or the player) who refuse the deal can sue abroad and try to seize the government's assets in other jurisdictions (an event chain). Winning pays near face value but enrages that government.
5. **Political fallout**: government stability falls, elections or coups become likelier ([08-politics.md](../08-politics.md) 8.4); the default history penalty stays on the rating for 10 years.

---

## 3.7 Commodities

### 3.7.1 What trades

Goods from [06-economy.md](../06-economy.md) 6.1 that have global markets trade on four fictional commodity exchanges. Electricity trades on regional power exchanges per hub grid and is not global. Starting prices are loosely mid-2020s and all values are [T].

| Commodity | Exchange | Unit | Starting price | Annual volatility | Delivery | Storage cost (per year, % of value) | Price elasticity eta (3.7.2) |
|---|---|---|---|---|---|---|---|
| Crude oil | Gulf Energy Exchange (GEX), Dubai; also Great Lakes Mercantile | barrel | $70 | 35% | Physical at Fujairah and Cushing | 4% | 1.5 |
| Natural gas (three hubs: North America, Europe, Asia LNG) | Great Lakes Mercantile (GLM), Chicago | MMBtu | $3.50 / $11 / $12 | 55% | Physical at the hub | 8% | 1.8 |
| Refined fuel | GEX | tonne | $700 | 35% | Physical | 4% | 1.4 |
| Iron ore | Bohai Commodity Exchange (BCX), Dalian | tonne | $105 | 30% | Physical at Qingdao | 3% | 1.2 |
| Copper | London Metals Hall (LMH), London | tonne | $9,800 | 25% | Physical in LMH warehouses (Rotterdam, Singapore, New Orleans) | 2% | 1.0 |
| Lithium carbonate | LMH | tonne | $12,000 | 50% | Physical in LMH warehouses | 3% | 1.3 |
| Rare earths basket | BCX | kg | $60 | 45% | Physical at Baotou | 3% | 1.6 |
| Steel (hot-rolled coil) | BCX and GLM | tonne | $800 | 25% | Physical | 3% | 1.0 |
| Wheat | GLM | bushel | $5.50 | 28% | Physical at Chicago and Toledo | 6% | 1.2 |
| Soybeans | GLM and BCX | bushel | $10.50 | 22% | Physical | 6% | 1.2 |
| Timber | GLM | thousand board feet | $550 | 30% | Physical | 5% | 0.9 |
| Gold | LMH | troy ounce | $3,000 | 15% | Physical in vaults | 0.2% | n/a (financial) |
| Memory chips (Standard Memory Index) | Hsinchu Compute and Chip Exchange (HCX), Hsinchu | index point | 1,000 | 40% | Cash-settled | n/a | 2.0 |
| Compute hours (GPU-hour index) | HCX | GPU-hour | $2.50 | 45% | Cash-settled | n/a | 1.5 |
| Carbon permits | LMH | tonne CO2 | EUR 70 | 35% | Registry transfer | 0% | 1.0 |
| Behavioral data lots (cyberpunk) | Freeport Night Market | lot | LBT 0.02 | 80% | Instant digital | 0% | 1.0 |

**Hours**: commodity futures trade 23 hours a day on weekdays, closed one hour at their exchange's settlement (GLM 21:00 to 22:00 UTC, LMH 17:00 to 18:00 UTC, GEX 20:00 to 21:00 UTC, BCX and HCX 07:00 to 08:00 UTC) [T]. Liquidity follows the FX session multipliers (3.8.4).

### 3.7.2 Spot price model

The **spot price** is the global reference price. Each hub's local price ([06-economy.md](../06-economy.md) 6.5) equals spot plus or minus transport and tariffs; physical traders arbitrage hub gaps weekly.

**Fundamental spot** (recalculated weekly, when inventories update from supply chain shipments):

`S_fund = MarginalCost x (NormalInventory / Inventory)^eta`

- **MarginalCost** is the production cost of the most expensive facility still needed to meet demand, from the economy simulation, updated monthly.
- **Inventory** is global stocks (exchange warehouses plus facility stockpiles plus strategic reserves); **NormalInventory** is the 3-year average.
- Example: inventories at 80% of normal with eta 1.5 give S_fund = 1.40 x marginal cost.

**Hourly tick**: same structure as stocks (3.3.3): `S_next = S x (1 + 0.003 x (S_fund / S - 1) + flow + noise)`, with pull a = 0.003 per tick [T], flow from net futures buying against open interest, and noise from the volatility column.

**Shocks** apply immediately: Strait Closed on an oil route +10% to +20%; a major mine accident +5% to +15% on its metal; an export ban by a producing country +10% to +30% abroad and -10% to -20% at home; a harvest failure +15% to +40% on grain [T].

### 3.7.3 Futures and the curve

Futures exist for monthly expiries out to 12 months (24 for oil and gas) [T].

`F(T) = S x e^((r + s - cy) x T)`

- r: the policy rate of the contract's currency; s: storage cost; T in years.
- **Convenience yield** `cy = max(0, 0.30 x (1 / I - 1))`, where I = Inventory / NormalInventory [T].

| Inventory ratio I | Convenience yield | Curve shape |
|---|---|---|
| 1.3 | 0 | **Contango** at full carry (r + s per year) |
| 1.0 | 0 | Mild contango |
| 0.8 | 7.5% | Roughly flat |
| 0.6 | 20% | Steep **backwardation** |

- **Super contango**: when global storage is more than 90% full, s triples. Futures can then sit far above spot, and holding storage pays.
- **Roll**: commodity index funds roll their positions from the front month to the next on trading days 5 to 9 of each month. This flow is predictable and front-runnable by hedge funds and players.
- **Margin**: initial 8% to 15% of notional by commodity volatility, maintenance 75% of initial; variation margin settles in cash daily [T].
- **Delivery**: physical contracts deliver at named locations through warehouse warrants. Only holders who own or rent storage (a warehouse facility, or a fee to a physical trader) can take delivery. Cash-settled contracts pay the difference.

### 3.7.4 Commodity market participants

| Participant | Behavior |
|---|---|
| **Producers** (mines, wells, farms in the economy) | Sell futures to lock prices according to their CFO's hedge policy |
| **Consumers** (refiners, fabs, food makers) | Buy futures to lock input costs |
| **Managed money** (trend followers) | Momentum signal like 3.3.4 |
| **Commodity index funds** | Long only; roll on days 5 to 9 |
| **Physical traders** (Vanterra Trading, Halcrow Glencove, Silk Road Resources) | Own storage and ships; arbitrage spot, futures and hub prices; buy cheap stocks in contango to store |
| **Governments** | Strategic reserves (oil and grain): release when price is 30% above its 1-year average, refill when 15% below [T]; export bans and price controls ([08-politics.md](../08-politics.md) 8.3) |

### 3.7.5 Hedging

A company's CFO sets a **hedge policy** for each key input and output: a hedge ratio (0% to 100%) and a horizon (3 to 12 months).

- Hedged volumes are bought or sold forward at today's curve. When spot moves, the hedge offsets the change in the company's costs or revenue, smoothing earnings. Quality Q +0.02 (3.3.1).
- **Hedges have cash calls**: a producer that sold futures pays variation margin daily if prices spike, even though its physical output is now worth more. A large hedge book can starve a company of cash in a rally (the "Metallgesellschaft problem"): a liquidity event, not a loss.
- **Over-hedging** (above 100% of real exposure) is speculation. Each month it is active there is a 2% chance of a **Rogue Trader** event: a desk hid losses of 1% to 5% of company value [T].

### 3.7.6 Cornering a market

A **corner** means controlling so much of the deliverable supply at a delivery point, while holding long futures into expiry, that short sellers can only close by buying from you at your price.

**Rules**
- **Position limit**: in the delivery month a holder group may hold at most 25% of the deliverable supply in long futures [T]. Positions held through undiscovered shells are counted separately until linked.
- **Deliverable supply** is the stock in the exchange's warehouses at the delivery points plus what can arrive before expiry.

**Regulator response.** The commodity regulator (part of the securities regulator of the exchange's country) computes a **Corner Suspicion Score** (CSS) daily in the last 3 weeks before expiry [T]:

`CSS = 50 x (largest known holder group's share of deliverable supply held long) + 30 x (its share of warehouse stocks) + 20 x min(1, |front-month spread to next month| / 20%)`

| CSS | Response |
|---|---|
| 30 or more | Inquiry letters to the largest position holders. Each inquiry rolls to **link shells**: 25% per week x strictness multiplier (3.10.2) x (1 - concealment) |
| 50 or more | Margin for the group raised to 50% of notional |
| 60 or more | **Liquidation-only** order: the group may not add positions |
| 80 or more | **Emergency settlement**: the exchange sets the expiry price at a "fair" level (spot of other delivery points + transport). Profits vanish |
| After expiry, if the corner was proven | Investigation chain: disgorgement plus fines of up to 3 times the profit, trading bans for the entities and characters involved, reputation -20 |

**Political backlash**: cornering a staple (wheat, soybeans, gas) raises the local price for households, so unrest rises in hubs that import it ([06-economy.md](../06-economy.md) 6.4) and governments may impose price controls or export bans. Cornering an industrial metal angers the companies that use it, which may become rivals.

**Payoff when it works**: shorts close at the squeezed price. The corner unwinds after expiry, and the physical stock the cornerer holds usually has to be sold into a falling market, so part of the profit is given back (see example 3.11.6).

---

## 3.8 Foreign exchange

### 3.8.1 Currencies

Every country (or currency zone) has a currency; every account, price and asset is denominated in one ([02-trusts-and-assets.md](../02-trusts-and-assets.md) 2.5). Rates are quoted as units per USD, except EUR and GBP, which are quoted as USD per unit, as in the real market.

Starting values are loosely mid-2020s; all are [T].

| Code | Currency | Country or zone | Start rate | Regime at start | Policy rate at start | Role |
|---|---|---|---|---|---|---|
| USD | US dollar | United States | 1.00 | Free float | 4.00% | Main reserve currency; numeraire |
| EUR | Euro | Eurozone | 1.16 USD per EUR | Free float | 2.00% | Reserve currency |
| JPY | Yen | Japan | 150 | Free float (intervention-prone) | 0.50% | Safe haven; carry funding currency |
| GBP | Pound sterling | United Kingdom | 1.33 USD per GBP | Free float | 4.00% | Reserve currency |
| CNY | Yuan (onshore; offshore CNH) | China | 7.15 | Managed float, +/- 2% daily band; moderate capital controls | 3.00% | Managed; trade giant |
| INR | Rupee | India | 88.0 | Managed float; light capital controls | 5.50% | Emerging, managed |
| CHF | Swiss franc | Switzerland | 0.80 | Free float (intervention-prone) | 0.00% | Safe haven; carry funding currency |
| CAD | Canadian dollar | Canada | 1.38 | Free float | 2.50% | Commodity currency |
| AUD | Australian dollar | Australia | 1.52 | Free float | 3.60% | Commodity currency; risk-sensitive |
| KRW | Won | South Korea | 1,400 | Free float; light controls | 2.50% | Export-driven; chip cycle |
| SGD | Singapore dollar | Singapore | 1.29 | Managed basket band, +/- 2% | 2.00% | Managed; financial hub |
| HKD | Hong Kong dollar | Hong Kong | 7.80 | Currency board, 7.75 to 7.85 | 4.25% | Pegged to USD |
| SAR | Riyal | Saudi Arabia | 3.75 | Hard peg | 4.50% | Pegged; oil exporter |
| AED | Dirham | United Arab Emirates | 3.6725 | Hard peg | 4.40% | Pegged; trade hub |
| BRL | Real | Brazil | 5.40 | Free float | 15.00% | High yield; carry target |
| MXN | Peso | Mexico | 18.5 | Free float | 7.50% | Carry target |
| ZAR | Rand | South Africa | 17.5 | Free float | 7.00% | Commodity, carry, risk-sensitive |
| TRY | Lira | Turkey | 41.0 | Managed float | 40.00% | High inflation; crisis-prone |
| RUB | Ruble | Russia | 82.0 | Managed float; hard capital controls; under sanctions | 17.00% | Sanctioned; half of reserves frozen |
| EGP | Pound | Egypt | 50.0 | Hard peg with moderate controls (starting scenario) | 25.00% | Overvalued peg; a crisis waiting to happen |
| ARS | Peso | Argentina | 1,400 (official) | Crawling peg, 2% a month; hard controls with a parallel rate | 35.00% | Chronic crisis |
| **LBT** | Ledgerbit | Stateless crypto | 1 LBT = $60,000 | Free float, fixed issuance | none | Speculative; trades every hour, every day |
| **OMD** | OmniDollar | Corporate stablecoin | 1.00 | Peg to USD, backed by reserves the issuer reports | none | Issued by a listed fintech, OmniLedger; can de-peg |
| **ASC** | Arcology Scrip | Corporate charter cities | Created when founded | Chosen by the city's company | Set by the company | Endgame currency for a corporate sovereignty hub ([08-politics.md](../08-politics.md) 8.8) |

Notes on the cyberpunk currencies:
- **OmniDollar** holds its peg as long as the market believes OmniLedger's reserves cover it. Its reserves are an asset portfolio like any other; if OmniLedger's board (which a player can control) quietly lends reserves out for yield, a "reserve audit" event can expose it, and the coin trades at a discount equal to the missing share of reserves, plus panic. Owning OmniLedger is owning a small private central bank.
- **Arcology Scrip** is the Stage 5 "private bank acting as a central bank for your hubs" ([14-game-stages.md](../14-game-stages.md) 14.6): the controlling company sets its regime and policy rate using the rules in 3.9.

### 3.8.2 Exchange rate update

Each currency's value is tracked as x = ln(USD per unit). The USD is the numeraire; the "Dollar Index" shows the USD against a trade-weighted basket.

**Hourly tick** (weekdays; crypto every hour):

`dx = alpha x (x_fair - x) + 0.005 x Flow / (Depth x session) + beta x dGRG / 10 + sigma_h x z + intervention`

| Term | Meaning | Values [T] |
|---|---|---|
| alpha x (x_fair - x) | Slow pull toward fair value | alpha = 0.001 per tick (half-life about 4 weeks) |
| Flow / (Depth x session) | Net buying of the currency this tick, in USD | Flows: trade payments (exports minus imports, spread over the hours), foreign purchases and sales of local stocks and bonds (from the market simulation), FDI, player and AI conversions, carry positions opening or closing. Each full unit of hourly depth moves the rate 0.5% |
| beta x dGRG / 10 | Risk sentiment | Beta per +10 GRG, table below |
| sigma_h x z | Noise | sigma_h = annual volatility / sqrt(6,240) (24 ticks x 260 weekdays) |
| intervention | Central bank buying or selling | Same impact as a flow, plus a one-off 0.2% x credibility / 50 signal effect when announced |

**Fair value** (refreshed at daily settlement):

`x_fair = x_PPP + 0.030 x RRD + 0.015 x CA + 0.005 x TOT - 0.0005 x max(0, Debt - 90) - 0.002 x max(0, 50 - Stability) + offset`

- RRD: real rate differential with the US in percentage points (local policy rate minus local inflation, minus the same for the US).
- CA: current account balance as % of GDP (the **trade balance** plus income flows, from the economy).
- TOT: % change in terms of trade over 12 months (export prices over import prices; big for commodity exporters).
- Debt: government debt as % of GDP. Stability: 0 to 100 from [08-politics.md](../08-politics.md) 8.7.
- The sum of adjustments is capped at +/- 0.30.
- x_PPP drifts monthly by the inflation gap: x_PPP falls by (local inflation - US inflation) / 12.
- The offset is set once at game start so that every currency starts at fair value, **except** deliberate starting imbalances: EGP 24% overvalued at its peg, ARS official rate 40% overvalued, JPY 15% undervalued [T].

**Currency parameters** [T]:

| Currency | Hourly depth (USD bn, at session multiplier 1) | Annual volatility | Risk beta (% per +10 GRG) |
|---|---|---|---|
| EUR | 60 | 8% | -0.3 |
| JPY | 40 | 10% | +1.5 |
| GBP | 25 | 9% | -0.5 |
| CNY (onshore) / CNH (offshore) | 10 / 5 | 4% | -0.3 |
| CHF | 10 | 8% | +1.0 |
| AUD | 10 | 11% | -1.5 |
| CAD | 8 | 8% | -0.8 |
| HKD | 5 | 1% (inside band) | 0 |
| KRW | 4 | 10% | -1.2 |
| INR | 3 | 6% | -0.8 |
| MXN | 3 | 13% | -2.0 |
| SGD | 3 | 5% | -0.5 |
| BRL | 2 | 15% | -2.5 |
| SAR | 1 | 0.5% (inside band) | 0 |
| ZAR | 1 | 15% | -2.5 |
| AED | 0.8 | 0.5% (inside band) | 0 |
| LBT | 0.8 | 70% | -4.0 |
| TRY | 0.6 | 20% | -2.5 |
| RUB | 0.5 | 18% | -2.0 |
| OMD | 0.5 | 0.5% while credible | -0.2 |
| EGP | 0.2 | 3% (inside band) | -2.0 |
| ARS (official / parallel) | 0.05 / 0.02 | 10% / 30% | -3.0 |
| Gold (for reference) | 15 | 15% | +1.5 |

### 3.8.3 Exchange rate regimes

The regime is a law in each country ([08-politics.md](../08-politics.md) 8.3, Finance category) and can change through politics or a crisis.

| Regime | Rules | Central bank behavior | Player angle |
|---|---|---|---|
| **Free float** | Rate set by the market | No intervention, except once if the rate moves more than 5% in a day ("disorderly market"); JPY and CHF intervene against moves of 10% in 3 months away from fair value | Pure market risk |
| **Managed float** | A reference rate plus a band (CNY +/- 2% daily; SGD +/- 2% around a basket) | Intervenes at the band edges; leans against moves of more than 2% in a week; can move the reference rate daily (CNY "fixing") | Trade the fixing; bet on band moves |
| **Crawling peg** | Peg that moves by a set % each month (ARS 2%) | Defends the crawl like a peg | Profitable to attack when inflation outruns the crawl |
| **Hard peg** | Fixed rate +/- 1% to an anchor (usually USD) | Must defend with reserves; policy rate tied to the anchor's rate plus a **peg spread** = 0.5% + 0.1% x (60 - credibility), minimum 0.5% [T]; no independent monetary policy | Attack it (3.8.6) |
| **Currency board** | Fixed rate, all base money backed by reserves at 100% or more | Automatic: when money flows out, base money shrinks and short-term rates spike, with no discretion | Very hard to break unless reserves fall below 100% of base money |
| **Currency union** | One currency for several countries (EUR) | One central bank for all members; members keep their own bond ratings and spreads | Member spreads (for example Italy versus Germany) can blow out in a crisis |

**Credibility** (0 to 100) is tracked for every managed regime. It starts at 80 for SAR, AED and HKD, 55 for EGP, 35 for ARS [T]. Daily change: -0.5 per 1% of starting reserves lost that day; +5 for a defensive rate hike of 5 points or more; -3 when capital controls are tightened under pressure; -2 to -10 for psyops or damaging news; recovers +0.5 per calm day toward its starting level. While credibility is 60 or more, the fair-value pull on a pegged rate is suspended (expectations are anchored); below 60 it is scaled by (60 - credibility) / 60.

**Capital controls** are an overlay on any regime ([07-markets.md](../07-markets.md) 7.4):

| Level | Rules [T] | Effects |
|---|---|---|
| **None** | Free movement | |
| **Light** | 1% levy on short-term (under 1 year) inflows; foreign purchases registered | Small cost |
| **Moderate** | Foreigners may convert at most $50M per holder group per month out of the country; profit repatriation needs approval (1 to 4 weeks); residents limited to $50k a year outbound; offshore non-deliverable forwards (NDFs) appear | Money gets stuck; Branch Office vassals (domestic) bypass the foreign limits but not repatriation |
| **Hard** | No conversion without a license; exports must surrender FX; a **parallel rate** appears | Profits are trapped; black-market conversion through shells and fixers at the parallel rate, raising exposure |

**Parallel rate premium** under hard controls = max(0, overvaluation of the official rate) x 2.0 (moderate controls: x 1.0) [T]. ARS at 40% overvaluation trades about 80% weaker on the parallel market.

### 3.8.4 Trading sessions, conversions and carry

**Session multiplier on depth** [T]: Asia 0.6, London 1.0, New York 1.0, London and New York overlap (12:00 to 16:00 UTC) 1.3, thin hours (21:00 to 24:00 UTC) 0.3. A big conversion at a thin hour costs more slippage, using the 3.3.7 slippage formula with the currency's depth.

**Spot conversion**: any account can convert at the current rate, paying a spread of 0.02% for majors, 0.1% for emerging currencies, 0.5% for ARS, EGP and RUB, 1% for LBT [T], plus slippage.

**Carry trade**: borrow in a low-rate currency, hold a high-rate one. At each daily settlement a carry position accrues `notional x (r_high - r_low) / 365` (the rollover). The risk is the exchange rate.
- **Carry crowding**: the game tracks total AI carry positions per target currency. When GRG rises 10 points or more within 2 days, a **Carry Unwind** event fires: AI funds close 30% of their carry books over 3 days. The resulting flows lift funding currencies (JPY, CHF) by 2% to 5% and drop targets (BRL, MXN, ZAR, TRY, INR) by 3% to 8% [T]. See example 3.11.7.

### 3.8.5 Forwards and NDFs

- **Forward rate** by covered interest parity, quoted as units per USD: `F = S x (1 + r_local x T) / (1 + r_usd x T)`, with T in years. Tenors: 1 week, 1, 3, 6 and 12 months.
- No upfront payment; collateral of 5% (majors), 10% (emerging) or 20% (pegged currencies under pressure, credibility below 50) of notional [T]; marked to market daily.
- **Hedging**: a company's CFO sets an FX hedge ratio for foreign revenue and costs, like commodity hedges (3.7.5). Unhedged foreign debt is the classic crisis killer: when the local currency falls, the debt grows in local terms.
- **NDFs** (non-deliverable forwards): for currencies with moderate or hard controls (CNY, INR, KRW, BRL, RUB, EGP, ARS), forwards trade offshore and settle in USD. The offshore rate can diverge from the onshore one; the gap is a public signal of pressure.

### 3.8.6 Attacking a peg

Speculators (AI hedge funds and, from Stage 5, the player) can bet that a peg will break.

**How an attack works**
1. The attacker **sells the currency forward** (agrees to deliver local currency for USD at the forward rate). The banks on the other side hedge by selling the currency spot: 70% of new forward notional reaches the spot market within 3 days [T].
2. Selling pressure pushes the rate to the weak edge of the band. Each tick at the edge, the central bank must buy its own currency with reserves equal to the flow needed to hold the band. **Reserves drain.**
3. Credibility falls with reserves lost and with bad news (3.8.3).
4. **Copycats**: when credibility is below 50, AI hedge funds add selling flow of $0.05B per day for each point below 50 (scaled by the currency's size: x depth / 1.0) [T]. Domestic **capital flight** adds 0.5% of reserves per day for each 10 points below 50.
5. **Defense options** for the AI central bank and government (players can lobby either way):

| Defense | Effect |
|---|---|
| Raise the policy rate sharply (to 40% or more; overnight rates can spike to 100%+) | Forwards become costlier for new attackers (forward points widen); copycat flow halved for 5 days; credibility +5; the economy suffers (growth down, defaults up) |
| Spend reserves | Holds the band while reserves last |
| Tighten capital controls | Cuts flows by 50% to 80%; credibility -3; NDF rate diverges |
| Swap line from an allied central bank | Adds reserves; needs diplomatic relations of +50 or more |
| ISF program | Adds reserves after 2 weeks; comes with conditions |
| Widen the band or devalue in a step | Ends the attack if the new rate is near fair value |
| Float | Ends the peg |

6. **Break**: when usable reserves fall below 25% of their starting level, or credibility falls below 20, the peg has a daily chance to break: 25% + 5% per credibility point below 20, maximum 90% [T]. On a break the government devalues to a new peg near fair value or floats.
7. **Overshoot**: a floated currency jumps to fair value x (1 + overshoot), with overshoot = 5% + 0.5% x (50 - credibility at the break); the overshoot then halves each month [T].

**Payoff**: the attacker's forward was struck at a rate weaker than the peg (the interest differential), so if the peg holds the attacker loses that **carry cost**. If it breaks, the profit is the gap between the forward rate and the post-break rate, times notional. See example 3.11.8.

**Consequences for the attacker** if identified (40% chance that a large attacker's role leaks through the banks [T]): reputation -15 globally, influence in that country halved, a "Currency Raider" notoriety trait for the head, and the government may target the attacker's local assets (seizure of a Branch Office, sanctions, lawsuits).

### 3.8.7 Currency crisis event chain

A currency crisis can start from an attack, from a sovereign default, or by itself when fundamentals rot.

1. **Pressure Builds** (event): fires when 3 of these hold: reserves under 3 months of imports, current account deficit over 4% of GDP, short-term foreign debt above reserves, inflation 5 points above target, stability under 40, the rate more than 15% overvalued against fair value.
2. **Speculative Attack**: AI hedge funds start selling; players may join, short local stocks, or rush to get money out.
3. **The Defense**: the central bank and government choose defenses (3.8.6). Each choice is a political event, and interest groups weigh in (exporters want devaluation, importers and foreign-debt holders want defense).
4. **The Break** (or survival): devaluation or float; overshoot.
5. **Pass-through**: 30% of the devaluation passes into consumer prices over 6 months (50% for import-heavy economies) [T]; unrest rises in hubs as real wages fall ([06-economy.md](../06-economy.md) 6.4).
6. **Balance-sheet damage**: companies and governments with unhedged foreign-currency debt see it grow in local terms; rating agencies go to Watch; defaults follow (3.6.6, 3.6.7). The local stock market typically falls 20% to 40% in USD terms.
7. **Contagion**: currencies with a similar profile (same region, similar deficits, same peg anchor) get a GRG-style regional shock of +10 to +20 for 2 weeks [T].
8. **Political fallout**: stability -10 to -25; the government may fall, call elections, or (in fragile states) face a coup ([08-politics.md](../08-politics.md) 8.4). An ISF program may impose new laws.
9. **Recovery**: the cheaper currency boosts exports over 6 to 18 months; rates normalize; credibility rebuilds.

---

## 3.9 Central banks

### 3.9.1 Central bank roster

Each currency has a central bank run by AI characters (a governor and a board of 4 to 8 members), influenced by politics. Names are fictional. All values are [T].

| Currency | Central bank | Mandate | Independence at start | Governor term | Usable FX reserves (USD bn) | Lower bound for rates |
|---|---|---|---|---|---|---|
| USD | Federal Monetary Board | Dual (inflation and employment) | High | 4 years | n/a (reserve issuer) | 0% |
| EUR | Eurozone Central Bank | Inflation (2%) | Full | 8 years | 1,000 | -0.5% |
| JPY | Nippon Monetary Authority | Inflation (2%) | High | 5 years | 1,250 | -0.5% |
| GBP | Threadneedle Bank | Inflation (2%) | High | 8 years | 190 | 0% |
| CNY | People's Monetary Bank | Multiple: growth, stability, exchange rate | Low | At will | 3,300 | 0% |
| INR | Reserve Authority of India | Inflation (4%, band 2% to 6%) | Moderate | 3 years | 690 | 0% |
| CHF | Helvetic National Bank | Inflation (0% to 2%) | Full | 6 years | 900 | -0.75% |
| CAD | Dominion Bank of Canada | Inflation (2%) | High | 7 years | 110 | 0% |
| AUD | Commonwealth Reserve Bank | Inflation (2% to 3%) | High | 7 years | 60 | 0% |
| KRW | Bank of Han | Inflation (2%) | High | 4 years | 410 | 0% |
| SGD | Lion City Monetary Authority | Inflation through the exchange rate band | High | 5 years | 380 | n/a (band policy) |
| HKD | Harbour Monetary Authority | Currency board | Rule-bound | 5 years | 420 | n/a |
| SAR | Kingdom Monetary Agency | Peg | Moderate | At will | 450 | n/a |
| AED | Emirates Central Bank | Peg | Moderate | At will | 250 | n/a |
| BRL | Brazilian Monetary Council | Inflation (3%) | High | 4 years | 340 | 0% |
| MXN | Banco de Anahuac | Inflation (3%) | High | 6 years | 230 | 0% |
| ZAR | Reserve Bank of the Cape | Inflation (3% to 6%) | High | 5 years | 65 | 0% |
| TRY | Anatolian Central Bank | Inflation (5%) | Low | At will | 40 | 0% |
| RUB | Central Bank of the Federation | Inflation (4%) | Low | 5 years | 300 (300 more frozen by sanctions) | 0% |
| EGP | Central Bank of the Nile | Peg (starting scenario) | Low | At will | 20 | n/a |
| ARS | Banco del Plata | Crawling peg | Captured | At will | 15 | n/a |

**Independence levels** and their weight I (used in 3.9.3):

| Level | I |
|---|---|
| Full | 0.90 |
| High | 0.75 |
| Moderate | 0.50 |
| Low | 0.25 |
| Captured | 0.05 |

### 3.9.2 Policy rate decision rule

Central banks meet monthly, in the monthly calculation ([09-time-and-turns.md](../09-time-and-turns.md) 9.2). Inputs come from the economy simulation: 12-month inflation (pi), the inflation target (pi*), the output gap (GDP versus trend, in %), unemployment (u) and its natural rate (u*).

**Step 1: the rule rate** (Taylor-like):

`r_rule = r*_real + pi + phi_pi x (pi - pi*) + phi_y x gap - phi_u x (u - u*) + phi_fx x dep3m + stress + hawk`

| Mandate | phi_pi | phi_y | phi_u | phi_fx | Notes |
|---|---|---|---|---|---|
| Inflation targeting | 0.8 | 0.3 | 0 | 0 | |
| Dual mandate | 0.5 | 0 | 1.0 | 0 | |
| Emerging inflation targeting (INR, BRL, MXN, ZAR, TRY, KRW) | 1.0 | 0.2 | 0 | 0.3 | dep3m: % depreciation against USD over 3 months |
| Multiple (CNY) | 0.5 | 0.5 | 0 | 0.2 | Also follows government credit targets |
| Peg or currency board | Not used: r = anchor rate + peg spread (3.8.3) | | | | |

- **Neutral real rate** r*_real: USD 1.0%, EUR 0.0%, JPY -0.5%, GBP 0.5%, CHF -0.5%, emerging markets 1.5% to 3% [T].
- **stress**: when GRG is above 40, -0.25 points per 10 GRG points above 40 (cut to calm markets), except for emerging banks whose currency fell more than 5% in the month, which hike +0.5 instead [T].
- **hawk**: the board's average hawkishness. Each governor and board member is a character with a Hawk-Dove score from -10 (dove) to +10 (hawk); hawk = +0.1 points per point of average score [T]. Appointments matter.

**Step 2: the political blend**:

`r_final = I x r_rule + (1 - I) x r_gov`

- `r_gov` is what the government wants: r_rule minus pressure. Pressure: populist government -1.0; within 12 months before a national election -0.75; debt interest above 15% of revenue -0.5; a saver-friendly government (Financiers and Landowners dominant) +0.25 [T].
- Lobbying the government moves r_gov (3.9.6).

**Step 3: smoothing**:

`r_new = r_old + clamp(0.4 x (r_final - r_old), -0.50, +0.50)`, rounded to the nearest 0.25 point; no change if the move would be smaller than 0.125 [T]. Never below the bank's lower bound.

**Emergency meetings** happen mid-month when GRG is above 60, the currency falls more than 10% in a week, or a bank run event fires. Moves of up to 1.00 point are then allowed; emerging banks defending a currency have no cap.

### 3.9.3 What the policy rate moves

- Savings and loan rates (3.6.5), margin interest (3.5.4).
- Bond yields through r_avg (3.6.5).
- Stock multiples through the R factor (3.3.1).
- FX fair value through the real rate differential (3.8.2), and carry trades.
- The economy (borrowing costs for facility construction, consumer demand), handled in [06-economy.md](../06-economy.md).

### 3.9.4 QE, QT and lender of last resort

- **QE** starts when the policy rate is at the lower bound and either inflation is more than 1 point below target or GRG is above 50. The bank buys government bonds worth 0.5% to 1.5% of GDP per month [T].
  - Effects: term premium -0.1 point per 10% of GDP held (3.6.5); market sentiment +5 per month of buying; FX fair value -1% per 2% of GDP bought.
  - In severe crises (GRG above 70) QE can include corporate bonds, narrowing investment-grade spreads by up to 30%.
- **QT** (selling or letting bonds mature) runs when inflation is more than 1 point above target and the rate is above neutral: 0.3% of GDP per month, with the reverse effects.
- **Lender of last resort**: licensed banks (including a player's Captive Bank vassal if it holds a banking license) can borrow from the central bank at policy rate + 1% against collateral with haircuts of 5% (government bonds) to 30% (corporate loans) [T]. A bailout beyond that is a political decision ([08-politics.md](../08-politics.md) 8.5).
- **Swap lines**: the Federal Monetary Board, the Eurozone Central Bank, the Nippon Monetary Authority, Threadneedle Bank, the Helvetic National Bank and the Dominion Bank of Canada share standing swap lines. Others must ask, needing relations of +50.

### 3.9.5 Expectations, guidance and surprises

- At each meeting the bank publishes a **guidance bias**: Hawkish, Neutral or Dovish (from the direction of r_rule minus r_new).
- Before each meeting the market forms an **expected rate** from the rule and the last guidance. The **surprise** is the actual decision minus the expected rate.
- Market reaction to a surprise of +1 point [T]: currency +2%, local stock indices -4%, 2-year yields +0.8 point, 10-year yields +0.3 point. Smaller surprises scale linearly.
- A dynasty member on a central bank board knows the decision a day early: trading on it is insider trading (3.10).

### 3.9.6 FX intervention and reserves

- Intervention rules follow the regime (3.8.3). Free floaters intervene only in disorderly markets; managed floats at the band edges; pegs and boards always.
- A bank will spend at most 10% of usable reserves per day unless defending a peg [T].
- **Sterilized** intervention leaves the policy rate unchanged; under a currency board intervention is never sterilized (rates spike automatically).
- **Reserve adequacy** = reserves / (3 months of imports + short-term foreign debt). Below 1.0 it is a Pressure Builds condition (3.8.7) and a rating penalty (3.6.3).

### 3.9.7 Independence, lobbying and capture

The central bank listens to the government in proportion to (1 - I). Players reach it in four ways:

| Route | How | Works best when | Risks |
|---|---|---|---|
| **Lobby the government** | Spend political influence in that country on "easier money" or "tighter money": each 10 influence points moves r_gov by 0.05 point, up to +/- 1.5 [T] | Independence is Low or Captured | Little effect at Full independence |
| **Appointments** | When a governor's term or a board seat opens (yearly check), the government appoints from a shortlist; players lobby for a candidate with the Hawk-Dove score they want, or run a dynasty member ([08-politics.md](../08-politics.md) 8.4) | Any level; slow but lasting | Visible; a crony appointment costs credibility (-10) and the currency's fair value (-2%) |
| **Change the law** | Lobby for a lower (or higher) independence level, a Finance law ([08-politics.md](../08-politics.md) 8.3) | Weak institutions, friendly government | Lower independence: sovereign rating -1 notch, FX fair value -3%, term premium +0.3 point |
| **Direct schemes on board members** | Befriend, bribe or blackmail ([03-characters.md](../03-characters.md) 3.6) to shift their Hawk-Dove score by up to 5 points | Any level | Bribery and blackmail are crimes; exposure is a scandal that also hits the currency |

Lobbying a Full-independence bank directly has a quarter of the normal effect and a 20% chance per attempt of a public backlash (reputation -5) [T].

**Capture** is a Stage 5 goal ("Market maker", [14-game-stages.md](../14-game-stages.md) 14.6): a dynasty that has a member as governor, a majority of board members friendly, and independence at Low or Captured effectively sets the policy rate (r_final follows the dynasty's choice within +/- 3 points of r_rule; beyond that inflation and the currency punish it).

---

## 3.10 Insider trading and manipulation

### 3.10.1 What counts

| Offense | What it is in the game | Typical source |
|---|---|---|
| **Insider trading** | Trading a security while holding material non-public information about it: unreleased earnings of a company where the trader is an insider (10%+ holder, director or executive), a planned takeover (other than by the bidder itself up to the 5% filing), a central bank decision known in advance, a regulator's coming decision, a government contract award, the results of an espionage scheme | Board seats, family members in office, schemes |
| **Tipping** | Passing such information to someone who trades (a family member, a lover, a bloc ally) | Family drama, hooks |
| **Pump and dump** | Raising Buzz with false or bot-driven content (psyops) while selling | Psyops tools from [05-map-and-influence.md](../05-map-and-influence.md) 5.3 |
| **Short and distort** | Shorting, then publishing false negative information | Short reports |
| **Spoofing** | Placing large fake orders to move the price, then cancelling (a player action "Paint the Tape": +/- 1% to 3% on one tick) | Manual action |
| **Wash trading** | Trading between your own entities to fake volume or set a closing price | Shells |
| **Undisclosed stake** | Failing to file at a threshold, or undisclosed concert action | Shells, swaps, informal blocs |
| **Cornering and squeezes with false information** | 3.5.3 and 3.7.6 | |
| **Rating agency bribery** | Paying an analyst for a better rating | Schemes |
| **Securities fraud** | Concealing a known issue in an IPO or report, cooking earnings | IPO due diligence, CFO schemes |

When a player order would use non-public information the game knows they have, the order screen shows a clear warning ("This trade uses inside information"). The choice stays with the player.

### 3.10.2 Detection

Each offense creates a **case** with a detection chance. Insider trades are checked once at the related news event (surveillance), and then for 26 weeks by a weekly background roll of 2% if the abnormal profit exceeded $1M (whistleblowers, journalists, a jealous sibling). Ongoing offenses (pumps, spoofing, wash trading, undisclosed stakes) roll weekly while active.

`p_detect = clamp(Base x Size x Timing x Strictness x (1 - Concealment), 0, 0.95)`

| Offense | Base [T] |
|---|---|
| Insider trading before earnings | 15% |
| Insider trading before a takeover | 25% |
| Insider trading before a central bank or regulator decision | 20% |
| Tipping | 10% per tippee; each tippee who is investigated has a 50% chance to name the source |
| Pump and dump | 20% per week active |
| Short and distort | 30% if the company rebuts successfully, 10% otherwise |
| Spoofing | 10% per use |
| Wash trading | 5% per week |
| Undisclosed stake | 10% per week; 30% at the moment any other holder files on the same company |
| Rating agency bribery | 10% per quarter |
| Securities fraud | 15% per quarter, 50% at any later bankruptcy |

| Multiplier | Values [T] |
|---|---|
| **Size** (abnormal profit) | Under $1M x0.5; $1M to $10M x1.0; $10M to $100M x1.5; above $100M x2.0 |
| **Timing** (trade before the news) | Within 1 day x2.0; within 1 week x1.5; 1 to 4 weeks x1.0; older x0.5 |
| **Strictness** (regulator strictness 1 to 5 from 3.2.2) | x0.5, x0.75, x1.0, x1.25, x1.5; a regulator the holder has captured (Kingmaker influence with protection, [05-map-and-influence.md](../05-map-and-influence.md) 5.3) x0.25 |
| **Concealment** (additive, capped at 70%) | Shell in a secrecy jurisdiction 30%; nominee or family account 15%; through swaps 10%; Freeport Night Market 40%; Intrigue of the planning character +1% per point above 10 (maximum 20%) |

A detected case starts the **investigation chain** of [08-politics.md](../08-politics.md) 8.5 and [10-events.md](../10-events.md) 10.2 (Subpoena, Discovery, Settlement or Trial). The accused gets the trait Under Investigation. General Counsel skill, the evidence level and political protection decide the outcome; settling is usually cheaper than losing at trial.

### 3.10.3 Penalties

| Outcome | Penalty [T] |
|---|---|
| **Civil settlement** | Disgorgement of the profit plus a fine of 1 to 3 times the profit; reputation -10 |
| **Director ban** | 1 to 10 years barred from board seats in that jurisdiction (and in strict jurisdictions abroad that recognize it). A banned CEO must step down: a succession event for the company |
| **Criminal conviction** (profit above $10M, repeat offenses, or fraud that caused a bankruptcy) | Prison 1 to 10 years. The character keeps assets but can only act through letters, hooks and delegates. If the dynasty head is jailed, a **regency** event hands day-to-day trust control to an appointed family member. Trait Blacklisted after release |
| **Company penalties** (corporate offenses) | Fine of 1% to 5% of annual revenue; trading suspension of 1 to 10 days; Q -0.10 for a year |
| **Exchange penalties** | Delisting for serious fraud (3.4.7); market access bans for shells and funds |
| **Cornering** | See 3.7.6 |

Reputation hits range from -10 (civil) to -40 (criminal), and influence everywhere falls with reputation ([05-map-and-influence.md](../05-map-and-influence.md) 5.3).

---

## 3.11 Worked examples

All companies, people and funds below are fictional. Numbers follow the formulas above and are rounded.

### 3.11.1 One tick, and what a big order costs

**Halcyon Robotics** trades on HDM (7 ticks a day) at P = $40.00. V = $46.00. Shares outstanding 250M, free float 150M, turnover 0.5% a day, so ADV = 750,000 shares and hourly volume about 107,000. Sector volatility 35%, so sigma_d = 2.20% and sigma_h = 0.83%.

**One tick.** Mkt = +10, Sec = +20, Buzz = 0, so V* = 46.00 x (1 + 0.015 + 0.020) = $47.61.
- pull = 0.0015 x (47.61 / 40.00 - 1) = +0.029%
- Archetypes net +30,000 shares (momentum buying after a good week): flow = 0.8 x 2.20% x 30,000 / 750,000 = +0.070%
- noise draw = +0.05%
- Total +0.149%: new price $40.06.

**A big order.** The player's company wants 3% of Halcyon: 7.5M shares, 10 times ADV.
- Permanent impact: 0.8 x 2.20% x 10 = about +17.6% by the end, whatever the method.
- At a 25% participation work order the player buys about 26,800 shares per tick, so 280 ticks, about 40 trading days. Slippage per fill: 0.5 x 0.83% x sqrt(0.25) = 0.21%.
- At 10% participation slippage falls to 0.13% per fill, but it takes about 100 trading days and the price may run away on news.
- Average price paid, roughly halfway up the permanent impact plus slippage: $40.00 x (1 + 0.088 + 0.002) = about $43.60. Total about $327M, a 9% premium over the naive $300M.
- Since V* is above $46, value funds do not start selling into the climb until P passes 1.15 x V = $52.90, so the player meets little resistance. On an overvalued stock the same order would be fought by value funds every tick.

### 3.11.2 An IPO from roadshow to day one

**Kestrel Freight Systems** (logistics software) lists on ATX. Pre-IPO V = $20.00 (equity value $2.0B, 100M shares). The founder holds 55M shares.

1. **Banks**: a bulge bracket bank (3.5% spread; the deal will exceed $500M).
2. **Range**: midpoint 0.88 x 20.00 = $17.60; range $16.40 to $18.80. Offering: 25M primary shares, 5M secondary (a VC selling), greenshoe 4.5M.
3. **Roadshow**: coverage = 1.5 base + 1.0 bank + 0.6 (Mkt +20) + 0.6 (Sec +30) + 0 (GRG 22) + 0.25 (Q = 1.05) + meetings (6 successes +1.8, 2 great +1.0, 2 failures -0.2) = **6.55x**.
4. **Pricing Night**: coverage 5x to 10x allows up to 10% above the top ($20.68). The player prices at **$19.50**.
   - Gross: 30M x $19.50 = $585M; primary $487.5M to the company, secondary $97.5M to the VC.
   - Company costs: bank fee $17.1M, legal and accounting $4.9M, listing fee $1.2M (0.05% of a $2.44B market cap). **Net to the company: $464.3M.**
5. **Day one**: V_post = ($2.0B + $464.3M) / 125M = $19.71.
   - Expected pop = 0.5 x (19.71 - 19.50) / 19.50 + 0.05 x (6.55 - 3) + 0.10 x 0.20 + 0 = 0.5% + 17.8% + 2.0% = 20.3%; noise +2.0%: **pop 22.3%**, opening at $23.85.
6. **Greenshoe** exercised: 4.5M more shares at $19.50, net $84.7M more to the company. Shares now 129.5M.
7. **Control**: with one class of shares the founder now owns 55 / 129.5 = 42.5%, losing majority control unless a bloc covers the gap.
   - If before the IPO the founder's shares were converted to class A (10 votes) and everyone else holds class B (1 vote): founder votes 550M; others 40M (pre-IPO holders after the VC sale) + 34.5M (public) = 74.5M. Founder controls 550 / 624.5 = **88% of votes**.
   - The cost: free-float holders have 34.5 / 624.5 = 5.5% of votes, under the 10% line, so Kestrel is **excluded from the Atlantic 500** (3.2.3) and index funds never buy it. Q also carries -0.05. Keeping control costs about 5% of value and a big pool of passive buyers.

### 3.11.3 A hostile stake build through the disclosure thresholds

**Target**: Pellucid Grid, a utility on CBX. 200M shares at EUR 15.00 (market cap EUR 3.0B), V = EUR 19.00, book equity EUR 3.4B. The Lacroix family bloc holds 30%; index funds 18%; value funds (Graywater) 12%; hedge funds 5%; dispersed public 35%. ADV 1.4M shares (1% of float). Market cap is below book, so the **Undervaluation** casus belli is open. **Raider**: Varga Industrial (US), a known raider, with a Strategic synergy claim too.

1. **Weeks 1 to 6, under the radar.** A 25% work order buys about 350,000 shares a day. After 28 trading days Varga holds 9.8M shares (4.9%). Permanent impact 0.8 x 1.13% x 7 = +6.3%, plus a little pull: price about EUR 16.10; average cost about EUR 15.60.
2. **Crossing 5%.** Varga keeps buying through the 2-day filing window (legal) and files at 5.35% with **Active** intent. Reaction: +2% x 2 (known raider) = +4%, to EUR 16.75. Reservation prices +5%. Wolfsbane Capital buys 3% for merger arbitrage. Pellucid's board (on CBX no pills are allowed once an offer comes) starts a **white knight** search and lobbies the French government.
3. **Weeks 7 to 10, to 10%.** Market buying adds 7M shares; a block of 2.3M from Wolfsbane costs EUR 17.60 (P x 1.03; arbs sell blocks cheaply, while Graywater holds out for its reservation price). Varga crosses 10% at about EUR 17.90 and files: +3% x 2 = +6%, to about EUR 19.00, now at V. Varga is an **insider**: blackout before earnings, short-swing rule, and the right to nominate a director at the next annual meeting.
4. **The wall at 25% and 30%.** Market buying is now slow and expensive (the price is at V, so value funds sell into every rise). Crossing 25% triggers a **foreign investment review** (utility, foreign buyer): 4 to 8 weeks, decided by Varga's influence in France and diplomatic relations. Crossing 30% on CBX triggers a **mandatory bid** for all shares.
5. **Tender offer.** Varga skips the creep and launches a tender offer at EUR 22.00 for all shares, conditional on reaching 50% and on regulatory approval. Review approved after 6 weeks (Varga spent political influence and promised to keep jobs: an obligation event).
   - Acceptance: index funds (18%) tender if success looks likely; Wolfsbane and other arbs (8%) tender; Graywater's reservation is now about EUR 23.00 (V x 1.10 x 1.10), so it holds; about half of the dispersed public tenders at EUR 22. Projected: about 47%, short of 50%.
   - Varga raises to EUR 23.00. Graywater and more retail tender. **Final: 53%.**
6. **Control.** Varga's company now controls Pellucid; Pellucid becomes its **vassal**, Varga appoints the CEO, the Lacroix bloc (30%) remains a powerful minority (above 25%, a **blocking minority** that can veto charter changes). Free float 17%, above CBX's 15% minimum, so no delisting.
7. **Cost**: about EUR 325M for the first 10%, plus about EUR 1.98B for 86M tendered shares at EUR 23.00: about **EUR 2.3B for 53%**, an average of about EUR 21.70 a share, 45% above the price when the raid began and 14% above V.

### 3.11.4 A margin call cascade breaks control

**Setup**: Aurelian Dynamics (60M shares, $50.00, market cap $3.0B). The dynasty head holds 18M shares (30%) personally; the family trust holds 9M (15%); a cousin holds 4.2M (7%). Together they are a 52% bloc led by the head (most shares). The head took a **stock-pledge loan** of $300M against his 18M shares ($900M): LTV 33.3%, under the 35% maximum.

| Day | What happens | Price | Collateral | LTV | Status |
|---|---|---|---|---|---|
| 1 | Scandal at Aurelian (-18%), then a market selloff (beta 1.2 x -6%) | $38.05 | $684.9M | 43.8% | Fine |
| 2 | Wolfsbane publishes a short report (-12%) | $33.48 | $602.6M | 49.8% | **Warning** (above 45%); auto-advance stops |
| 2 close | Settlement price | $33.00 | $594.0M | 50.5% | **Margin Call**: restore to 40% by the next settlement, by paying down $62.4M or pledging $156M more |

**Day 2 evening, options:**
- The head has $20M in cash and pledges a penthouse (valued $45M, counts $22.5M).
- The family trust has $400M in cash but its rules forbid loans to beneficiaries; changing them needs a family vote, and two siblings dislike him.
- **Negotiate an extension**: Finance 12, under a scandal: 40% + 4% - 10% = 34%. It fails.
- Leak roll (20%): it leaks. Shock -5%, Wolfsbane adds shorts.

**Day 3**: price $31.35. After the $20M payment and the penthouse, the loan is $280M against $564.3M + $22.5M = $586.8M: LTV 47.7%, still above the 40% the call demanded. The deadline passes: **forced sale** down to 40% LTV.

**The Block Auction**: the bank offers the shares as a block at a 10% discount ($28.20). Solving for the shares sold, with the price settling at $30.00 after the print: about **3.4M shares**.
- **If a rival wins the block**: House Morrow buys 3.4M (5.7%) and files at 5%. The head is left with 14.6M (24.3%); the bloc holds 24.3 + 15 + 7 = **46.3%: control is lost**. The head is still bloc leader but no longer controls the company. Morrow, Graywater (8%) and an activist begin courting the cousin.
- **If the family trust bids**: the trust rules allow buying (only lending was forbidden), so the head, as trustee, has the trust win the auction at $28.20 ($96M). Trust 12.4M (20.7%) + head 14.6M (24.3%) + cousin 7% = **52%: control kept**. The head still leads the bloc (14.6M versus the trust's 12.4M), but the siblings resent that trust money saved his personal mistake: opinion -15 among beneficiaries, and a Succession-style family feud begins.

**Cascade**: the cousin had a margin account too. At $30.00 her equity ratio falls below maintenance and she faces her own call. If she sells, the bloc falls under 50% again.

### 3.11.5 Taking a company through its debt

**Halberd Shipping** defaults after charter rates collapse. Capital structure: a $500M secured bank loan, $2.0B of senior unsecured bonds (6% coupon), 80M shares. Bonds trade at 35 cents.

1. The player's fund buys **$700M face for $245M**: 35% of the senior class, more than a third, so it can **block** any plan.
2. Management proposes a plan: enterprise value $1.4B; the secured loan is refinanced in full; seniors get 90% of new equity, old shareholders 10%. Senior recovery 40.5 cents. The player votes it down.
3. The player proposes its own plan, backed by Graywater (which holds 15% of the bonds):
   - Seniors get 88% of new equity; old shareholders get 2% (warrants, to avoid a fight in court).
   - The player provides $100M of new money for another 10% of equity.
4. Vote: the seniors approve (the player, Graywater and arbs reach two thirds by value). The court confirms after 8 weeks.
5. **Result**: player 35% x 88% + 10% = **40.8%**; Graywater 13.2%. Bloc: **54%: control**. Halberd becomes a vassal of the player's company. Equity value after emergence: $1.4B + $0.1B new cash - $0.5B secured debt = $1.0B, so the player's stake is worth about **$408M for $345M invested**, plus control. The old Halberd family loses its flagship: a new rival dynasty is born.

### 3.11.6 A lithium corner

**Setup**: LMH lithium carbonate, March contract. Deliverable stock in LMH warehouses at Rotterdam: 40,000 tonnes. Spot $12,000. Position limit 25% = 10,000 tonnes per holder group.

1. The player's company and two shells each go long 10,000 tonnes of March (30,000 total, 75% of deliverable), average entry $12,400. Through the shells, the player also buys 15,000 tonnes of physical warrants at $12,300 (37.5% of warehouse stock).
2. Shorts (producers who hedged, and hedge funds) must deliver 30,000 tonnes, but only 25,000 tonnes are not the player's, and new metal from Chile takes 6 weeks to arrive. In the final week March rises to **$16,800** while April sits at $13,100.
3. **Regulator, unlinked view**: the largest known group holds 25% (12.5 points), warehouse share per known shell 12.5% (3.75 points), spread 28% (20 points): **CSS 36.25**. Inquiry letters go out; the linking roll is 25% x 1.25 (UK strictness 4) x (1 - 0.30 concealment) = **22% per week**.
4. **Outcome A, not linked** (about 61% over the two weeks): shorts close at $16,800. Futures profit 30,000 x $4,400 = $132M. Afterwards the physical stock is sold into the post-expiry glut at about $11,500: a $12M loss. Storage and financing $3M. **Net about +$117M.** Battery makers controlled by a rival dynasty post weak earnings and blame "speculators"; Buzz and opinion effects follow.
5. **Outcome B, linked**: the group now holds 75% (37.5 points) and 37.5% of warehouses (11.25 points) with the spread (20 points): **CSS 68.75**. Margin raised to 50% of notional and a liquidation-only order; if it reaches 80, emergency settlement at $13,000. Futures profit falls to $18M, the physical loss remains, and the investigation chain starts: fines up to 3 times the intended profit, trading bans for the shells and the head of the trading desk, reputation -20.

### 3.11.7 A carry trade unwinds

**Setup**: JPY policy rate 0.5%, BRL 15%. USD/JPY 150, USD/BRL 5.40. The player borrows **JPY 30B** ($200M), converts to **BRL 1.08B**, and parks it in Brazilian money market funds. Collateral: 10% ($20M).

- Carry: (15% - 0.5%) / 365 x $200M = about $79,500 a day.
- After 120 days: BRL interest earned 1.08B x 15% x 120 / 365 = BRL 53.3M; JPY interest owed 30B x 0.5% x 120 / 365 = JPY 49.3M. At unchanged rates the gain is about $9.9M.

**The shock**: a chokepoint closure and a bank failure push GRG from 20 to 45 in two days. **Carry Unwind** fires: AI funds close 30% of their carry books. USD/JPY falls to 141 (yen +6%); USD/BRL rises to 5.94 (real -9%).

- The position: BRL 1.1333B / 5.94 = $190.8M = **JPY 26.90B**.
- The debt: JPY 30B + 49.3M = **JPY 30.05B**.
- Loss: **JPY 3.15B, about $22.3M**: four months of carry gone, plus more, in two days. The collateral ($20M) is not enough, so a margin call follows (3.5.4); if the player is forced to close in the thin hours, slippage adds to the loss.

### 3.11.8 Attacking the Egyptian pound peg

**Setup** (the starting scenario's deliberately weak peg): EGP pegged at 50.00 per USD, band 49.50 to 50.50. Usable reserves $20B. Fair value 62.0 (the peg is 24% overvalued). Credibility 55. EGP policy rate 25%, USD 4%. Current account deficit 4% of GDP. GRG 30. The player's dynasty is in Stage 5.

1. **The forward**: 3-month forward = 50.00 x (1 + 0.25 x 0.25) / (1 + 0.04 x 0.25) = **52.60**. If the peg holds, the player loses 52.60 / 50.00 - 1 = 5.2% of notional over 3 months: the carry cost.
2. **Days 1 to 3**: the player sells **$6B** of EGP forward through several banks (collateral at 10% = $600M) and runs a psyops campaign: "reserves are lower than reported" (credibility -8). Banks hedge 70%: $4.2B of spot selling reaches the band edge. Reserves fall to **$15.8B**. Credibility: 55 - 10.5 (21% of reserves lost) - 8 = **36.5**.
3. **Copycats**: at 13.5 points below 50, AI hedge funds add about $0.15B a day (scaled for EGP's thin market), and capital flight adds about $0.1B a day.
4. **Day 4, the defense**: the central bank hikes to 40% (credibility +5) and copycat flow halves for 5 days. Day 5: moderate capital controls (credibility -3); offshore NDFs now price 58.
5. **Days 6 to 20**: flows of $0.5B to $0.75B a day drain reserves to **$4.8B** (under 25% of the start); credibility falls to **19**. The government asks the ISF, but the program needs 2 weeks; the player lobbies the populist wing of the government to reject ISF austerity conditions.
6. **Day 21, the break**: break chance 25% + 5% = 30% a day; the peg breaks on day 21. The government floats. Overshoot = 5% + 0.5% x (50 - 19) = 20.5%: EGP jumps to 62.0 x 1.205 = **74.7**.
7. **The payoff**: with about 70 days left, the new forward (EGP rate now 45%) is 74.7 x (1 + 0.45 x 70 / 365) / (1 + 0.04 x 70 / 365) = about **80.5**. Closing out: each dollar of notional now costs 52.60 / 80.5 = $0.653 to settle. **Profit about 34.7% of $6B = $2.08B**, less about $15M of psyops costs.
8. **Fallout**: Egyptian inflation rises by about 15 points over 6 months (30% pass-through of a 49% devaluation); stability -20; companies with dollar debt in Egypt default; GRG +10 regionally, putting pressure on other pegs with similar profiles. The player's role leaks (40% chance): reputation -15, influence in Egypt halved, the Currency Raider trait, and the Egyptian government moves to seize the player's local Branch Office. The player's own EGP assets lost a third of their dollar value.

---

## 3.12 Links to other systems

| System | What markets take from it | What markets give back |
|---|---|---|
| Companies ([01](../01-companies.md)) | Cap tables, blocs, charters, boards, takeover tools | Share prices, control changes from tenders, margin sales and restructurings |
| Trusts and assets ([02](../02-trusts-and-assets.md)) | Trust rules (leverage allowed, never-sell clauses), account currencies | Portfolio values, margin calls, interest and dividends |
| Characters ([03](../03-characters.md)) | Finance, Influence and Intrigue skills; traits; schemes | Scandals, Under Investigation and Blacklisted traits, prison, stress from losses |
| Map and influence ([05](../05-map-and-influence.md)) | Influence, psyops, ad campaigns | Influence from bond holdings and listed companies |
| Economy ([06](../06-economy.md)) | Earnings, inventories, marginal costs, trade balances, inflation, unemployment | Commodity prices, borrowing costs, FX-driven import prices |
| Politics ([08](../08-politics.md)) | Laws (regimes, controls, independence, disclosure), regulators, elections, stability | Defaults, currency crises and market crashes that topple governments |
| Events ([10](../10-events.md)) | Event chains for IPOs, margin calls, defaults, crises, investigations | Triggers for those chains |

---

## 3.13 Assumptions

New assumptions introduced by this document, to confirm or change:

1. **Twelve exchanges** (ATX, HDM, CLX, CBX, ESE, HSE, VHX, GXI, HRX, LCX, PSX, NJX) plus the Freeport Night Market are enough for the first full release; Frankfurt, Toronto, Sydney and others are folded into these or added later.
2. **Each exchange simulates 30 to 120 companies** in full, with a rest-of-market basket per sector for indices and sentiment.
3. **Daylight saving time is ignored**, and sessions are rounded to whole hours so that every tick lines up with a turn.
4. **Trades settle the same day** at the daily close (no T+1 or T+2 delay).
5. **Fictional names** are used for exchanges, banks, funds, rating agencies, central banks and the ISF, while countries, cities and currencies are real.
6. **Archetype order flow is a market rule run hourly**, not an AI decision; named AI holders still decide weekly, as 9.3 requires.
7. **The disclosure thresholds are the same everywhere** (5%, 10%, 25%, 50%); jurisdictions differ only in deadlines and in whether derivatives count. Extra thresholds (for example the UK's 3%) are left out.
8. **Mandatory bid rules** exist on most non-US exchanges at the levels given in 3.2.2, in addition to the four disclosure thresholds.
9. **Poison pills** are allowed only on ATX, HDM, HRX and ESE; CLX, CBX and LCX apply board neutrality.
10. **Ratings and spreads are market beliefs**; real defaults only happen when an issuer cannot or will not pay out of its simulated cash flow.
11. **Starting values** (prices, rates, reserves, ratings) are loosely based on the mid-2020s and tuned by a per-country calibration offset; they are not meant to be exact.
12. **The EGP starts on a hard peg, overvalued by 24%**, as a deliberate crisis seed in the default scenario, even though the real pound floated; ARS starts on a crawling peg with a parallel rate.
13. **Three fictional currencies** are added as cyberpunk accents: Ledgerbit (stateless crypto), OmniDollar (a corporate stablecoin issued by a listed company) and Arcology Scrip (charter-city currency in the endgame).
14. **The USD is the numeraire** for FX modeling; displayed rates follow real market quoting conventions.
15. **Central banks meet monthly** (not 8 times a year), with emergency meetings allowed mid-month.
16. **Options are a later feature** with only the outline in 3.5.6.
17. **Regulator strictness** is a 1 to 5 value per country that scales detection; it can change through laws and capture.
18. **The player always sees a warning** before an order that uses inside information the game knows they hold.
19. **Freeport Night Market** access requires a Shell or Front Company and is always on, with no regulator but raid and fraud risk.
20. **Market tools unlock by game stage** as listed in 3.1.4.
