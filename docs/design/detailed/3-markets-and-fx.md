# 3. Markets and FX: detailed design

_Status: draft v0.3 (2026-10-19). Batch 118: EU4-style map; local time, roadshows, deposits, unrest, morning briefs and market research use provinces and cities (Metros or city provinces) instead of hubs; exchanges have a home city; charter cities are provinces. Batch 117: no character stress from losses (stress removed). Batch 116: no dynasty, family trust or succession (money sits in the character's personal trusts and accounts; the family bank and family office become the player's own); branch offices dropped; Clout and Favor replace reputation; Semiconductors replaces the four chip industries; crypto moved to the phone tab (9-gambling); disclosure lines set by F4 then 10, 25, 50; two-layer control in 3.4.8 and 3.11; market values rebased to January 2020; consistency fixes A1 to A22. v0.3 is the consistency pass, batch 74: company ranks replace game stages (3.1.4, 3.25), only named holders trade (3.3.4), the 24/7 calendar of 3.1.0 runs through every section, and antitrust, crypto exchanges, data brokers, cyberware and the old goods economy are removed. v0.2 added the trading experience, information and analysts, retail and meme stocks, market cycles and bubbles, the financial sector as a business, funds and the family office, private markets, M&A deal mechanics, financial crises and contagion, the derivatives scope, crypto and cyberpunk finance, taxes on trading, markets by company rank, and worked examples (3.13 to 3.26); Assumptions are in 3.27; the GRG baseline in 3.3.5 follows the business cycle (3.16.1). Owner: Logan. Expands the markets overview (07) and the trading parts of the trusts overview (02) into exact rules, numbers and content. Everything here is open for revision._

This file covers stock exchanges, the stock price model, corporate actions, short selling and margin, bonds and credit ratings, commodities, foreign exchange, central banks, and market crime. It ends with worked examples and a list of new assumptions.

Rules already decided by Logan (see [13-open-questions.md](../13-open-questions.md)) are kept as they are. In particular: time is pausable real time with hourly ticks, heavy calculations run on daily, weekly and monthly intervals, characters are landless and assets are their titles, money sits in each character's own personal trusts and accounts (no family trust or dynasty, batch 116), bloc leaders are the members with the most shares, and vassals are held by companies. Disclosure lines: a first line of 2% to 10% set by each country's F4 Securities Regulation law, then 10%, 25% and 50% everywhere (3.4.8).

---

## 3.0 Investing (Logan, batch 58)

| Topic | Decision |
|---|---|
| What characters and trusts can invest in | **Stocks, bonds, real estate pools ([2-map-and-influence.md](2-map-and-influence.md) 2.16), private stakes and gambling** (9) from the start. **Commodities (3.7) and FX (3.8) come later.** |
| Funds | **The player can found a fund**: a hedge fund, private equity fund or VC fund, set up as a company (1.6). Outside money comes in, the fund charges fees, and its **fund manager rolls Finance**. |
| Margin and shorting | **Characters may use them** through a **personal margin account** (3.5.4), with margin calls as events. |
| Who trades | **Only named holders.** There is no anonymous crowd (3.3.4). |
| Screens | **A separate Portfolio screen for each holder** (each character, trust and company), not one combined screen ([11-ui.md](../11-ui.md) 11.2). |

**Funds (A).**
- A fund is a company of the type Fund. Its **investors** (AI characters, trusts, companies and governments) put money in; the fund buys stocks, bonds, real estate pool shares and private stakes with it.
- **Fees**: 2% of assets a year plus 20% of gains above the fund's previous high (2 and 20) **(T)**.
- **The fund manager** is a board seat. Each quarter they roll **Finance** against the fund's strategy: a success beats the market by about 1 to 3%, a failure lags it by the same **(T)**. Their traits shape the style (Greedy takes more risk, Cautious holds cash).
- **Inflows and outflows**: investors add money after good years and pull it after bad ones (about ±20% of assets a year at the extremes) **(T)**.
- **Strategy by type**: a hedge fund trades listed stocks and can short; a PE fund buys whole private companies or business units with debt; a VC fund takes stakes in startups through the founding paths (1.6.2).
- A fund's stakes vote like any holder, and the fund manager's real controller (1.3.1) decides how.

**Personal margin (A).** A character or trust can borrow against its holdings up to 50% of their value at the base rate plus 3% **(T)**. If the value falls below the maintenance level (30%), a **Margin Call** event fires (13.5 Markets deck): add cash, sell, or let the broker liquidate. Shorting borrows shares from named holders who lend them (3.5.1).

**Only named holders (Logan).** Every share in the game is held by a **named holder**: a character, a trust, a company, a fund or a government. The eight archetypes in 3.3.4 are **strategies of named funds**, not an anonymous float **(A)**:
- Each listed company's float is held by named funds of each archetype (Monolith Index Partners, Graywater Value, Kinetic Quant and so on), and their hourly orders follow the archetype formulas.
- **Retail** is represented by a few named **retail platforms** (for example "Sherwood Retail"), each a named holder whose orders follow the retail formula. This keeps meme rallies and panics while every share still has an owner on the books **(A)**.
- Named funds can be bought, influenced, investigated and taken over like any other holder.

## 3.1 Conventions and time cadence

### 3.1.1 Conventions

- **[T]** marks a tuning value: a starting number that is expected to change in playtesting. Where a whole table is tuning values, its caption says so.
- Rates and yields are **annual** unless the text says "per tick" or "per day".
- A **tick** is one hourly market update, run on every turn (24 a day; markets close only on 1 January, 3.1.0).
- **Settlement** is the daily close processing of a market (3.3.10).
- Money in examples is in US dollars (USD) unless a currency is named.
- **V** is a stock's fundamental value per share, **P** its market price.
- **ADV** is average daily volume in shares (20-day average).
- **GRG** is the Global Risk Gauge, a 0 to 100 fear index (3.3.5).
- A **holder** is any owner in the ownership graph (see [1-corporate-core.md](1-corporate-core.md) 1.2): trusts, characters, companies, funds, governments.
- **Holder group**: a holder plus every entity it controls, plus its bloc partners in that company. Limits and disclosure apply to the holder group, not to each entity separately.

### 3.1.0 The market calendar (Logan, batch 53)

- **Stock trading runs 24/7, 365 days a year.** Every exchange ticks every hour. The **only day markets close is 1 January**.
- **Quarterly earnings come out for every company at once**, on fixed dates: **2 January, 2 April, 2 July and 2 October, at 00:00** UTC **(A: UTC)**. Each covers the quarter just ended; the 2 January report is also the annual report.
- **Earnings days are a frenzy (Logan).** Every company's earnings surprise (3.3.6) lands on the same tick, so on the four earnings days **(T)**:
  - volume is ×4 for the first 24 hours (3.3.4);
  - the Global Risk Gauge gets a +5 shock for the day (3.3.5);
  - circuit breakers (3.3.8) trip far more often, and the player gets an auto-pause alert on every holding at 00:00.
- **2 January is the biggest day of the year.** The market reopens after the 1 January close at the same hour the annual reports come out, so the reopening auction (3.3.9) carries a full day of news plus every company's year.
- **Daily jobs** (3.1.2) run at **00:00 UTC** **(A)**. Exchanges keep their home cities, currencies and indices, but have no trading hours.
- FX and commodities are assumed to follow the same calendar **(A)**. The Freeport Night Market (3.2.5) never closes, even on 1 January. Crypto is not a market here: it lives in the phone tab ([9-gambling.md](9-gambling.md)).

**Earnings season (Logan, batch 54).**
- **Guidance.** Every company publishes **guidance** (its forecast for next quarter) alongside its earnings. Whether investors believe it comes down to a **stat roll by board members**: each roll shows how well they steer investor confidence **(A for who rolls and the numbers)**:

  | Board member | Skill | Effect of a success **(T)** |
  |---|---|---|
  | CFO | Finance | Consensus moves toward the guidance; a raise gives up to +8%, a cut does no more than -5% |
  | CEO | Persuasion | Investor confidence (10.5) +5 for the quarter |
  | Head of IR or PR, if seated | Persuasion | Buzz +10 and smaller swings on the day |

  Failed rolls make it worse: the market doubts the guidance, and a cut hits at its full -15%. Guidance that turns out wrong next quarter costs investor confidence -5. Talking guidance up on purpose ("managing expectations", 3.3.6) uses the same rolls.
- **Quarterly recap screen (Logan, batch 84).** **7 days before each earnings date**, every company's executives get a **quarterly recap screen** (the player sees it for each company where they hold an executive or board seat). It shows:
  - the **anticipated earnings** to be posted on the 2nd;
  - how the **market is expected to react**;
  - the expected effect on **investor confidence**;
  - a **company outlook**: anything affecting the company, such as industry booms, scandals and other debuffs, or financial trouble like repeated underperformance.
- **Insider blackout.** From the recap screen until the 2nd, **the player and all other executives and board members cannot trade** the company's shares (Logan, batches 84 and 85: an **absolute lock** on the **company's own shares**; it cannot be broken). Holders of more than 10% fall under the same blackout **(T)**.
- **1 January is a world holiday.** Markets are closed, and holiday events fire (New Year galas, resolutions). Orders placed that day **queue up** and fill at the 2 January 00:00 reopening.
- **Flat liquidity.** In a 24/7 market, liquidity is **the same around the clock**; there is no thin night session. Only earnings days and news shocks change it.
- **Earnings deck.** Earnings days have **their own event deck** ([13-events.md](13-events.md) 13.5).

### 3.1.2 What runs when

Markets follow the game's calculation schedule (hourly ticks, with daily, weekly and monthly jobs). The hourly loop only touches prices, orders and alarms. Strategic choices by named AI holders stay on weekly or monthly cadences; the hourly order flow of AI investor archetypes (3.3.4) is a market rule, not an AI decision.

| Cadence | Market work |
|---|---|
| **Hourly** (each tick) | Stock, commodity futures and FX ticks (every hour except on 1 January); order execution; circuit breaker checks; margin warnings and intraday forced liquidations; short squeeze checks; news shocks applied; GRG update |
| **Daily** (at 00:00 UTC, 3.1.0) | Daily close; settlement of trades; fundamental value refresh; sentiment decay; borrow fees and margin interest accrual; formal margin calls; futures variation margin; carry accrual on FX positions; FX fair value refresh; disclosure filings published; surveillance checks on the day's news |
| **Weekly** | Named AI holders' strategic decisions (stake building, bloc votes, activist campaigns, tender decisions); short interest published; regulator suspicion reviews; commodity inventories updated (3.7.2); capital control quotas reset; shell detection rolls |
| **Monthly** | Central bank meetings; dividends, coupons and loan interest paid; government bond auctions; commodity cost anchor update; PPP anchor drift for FX; index fund savings inflows; QE purchases |
| **Quarterly** | Earnings reports on 2 January, 2 April, 2 July and 2 October at 00:00 (3.1.0) and full fundamental recalculation; credit rating reviews; index rebalancing; buyback windows reset |
| **Yearly** | Dividend policy set at the annual shareholder meeting; listing compliance review; central bank governor terms; sovereign annual rating review |

### 3.1.3 The global trading day

The turn clock runs on UTC, and each province shows local time. Every exchange, the FX market, commodity futures and government bonds tick on every turn, 24 hours a day and 7 days a week, so there are no sessions, lunch breaks, weekends or thin hours (3.1.0). Markets close only on 1 January; the Freeport Night Market (3.2.5) never closes. The daily close is the 00:00 UTC tick.

### 3.1.4 Market tools by company rank

Market tools are grouped by the rank of the player's largest company ([1-corporate-core.md](1-corporate-core.md) 1.7.5), the same ranks that shape politics ([4-politics.md](4-politics.md) 4.28). Nothing is locked (3.0 lets characters and trusts trade from the start); the rank sets which panels the Markets screen opens by default (3.13.1), so a new player is not shown an FX desk in hour one. Commodities (3.7) and FX positions (3.8) come later (3.0).

| Rank | Market tools that usually matter |
|---|---|
| Venture (< $10M) | Buy and sell listed stocks and government bonds in personal accounts; savings and money market accounts; bank loans and stock-pledge loans; corporate bonds; basic FX conversion |
| Company ($10M to $250M) | IPO chain; margin accounts; short selling; block trades; tender offers; rights issues and buybacks for controlled companies |
| Corporation ($250M to $5B) | Commodity futures and hedging; cornering; FX positions, carry trades and forwards; distressed debt; derivative stake building |
| Megacorp and Conglomerate (> $5B) | Attacks on currency pegs; capture of central banks; private monetary authorities for charter cities (Arcology Scrip, 3.8.1) |

3.25.1 adds what markets are for at each rank.

---

## 3.2 Exchanges

### 3.2.1 Exchange list

Twelve fictional exchanges stand in for real ones, plus one off-the-books venue. Each has a home city (a Metro or city province), a currency, a regulator (the national securities regulator from [4-politics.md](4-politics.md)) and indices.

| Code | Exchange | Home city | Stands in for | Currency | Headline index | Other indices |
|---|---|---|---|---|---|---|
| ATX | Atlantic Exchange | New York | NYSE | USD | Atlantic 500 | Atlantic Industrials 30, Atlantic Mid 400 |
| HDM | Hudson Digital Market | New York | Nasdaq | USD | Hudson 100 | Hudson Composite, Hudson Biotech |
| CLX | City of London Exchange | London | LSE | GBP | CLX 100 | CLX 250 |
| CBX | Continental Bourse | Paris (with floors in Amsterdam, Frankfurt and Milan) | Euronext and Deutsche Boerse | EUR | Continental 50 | Continental Mid 100, Rhine 40 |
| ESE | Edo Securities Exchange | Tokyo | JPX | JPY | Edo 225 | Edo Prime Index |
| HSE | Huangpu Stock Exchange | Shanghai | SSE and SZSE | CNY | Huangpu Composite | Huangpu Star 50 (tech board) |
| VHX | Victoria Harbour Exchange | Hong Kong | HKEX | HKD | Harbour Index | Harbour Mainland Enterprises |
| GXI | Gateway Exchange of India | Mumbai | NSE and BSE | INR | Gateway 50 | Gateway Sensitive 30 |
| HRX | Han River Exchange | Seoul | KRX | KRW | HRX 200 | HRX Growth |
| LCX | Lion City Exchange | Singapore | SGX | SGD | Lion 30 | Lion REIT Index |
| PSX | Paulista Exchange | Sao Paulo | B3 | BRL | Paulista Index | Paulista Small Caps |
| NJX | Nejd Exchange | Riyadh | Tadawul | SAR | Nejd All-Share | Nejd 30 |

A **global index**, the **Globe 1000**, is built from the 1,000 largest free-float companies across all twelve exchanges, converted to USD. Global funds track it, and the GRG reads its volatility.

**Depth of simulation:** each exchange lists 30 to 120 fully simulated companies (with characters, boards and business units) plus a **rest-of-market basket**, one synthetic constituent per sector that stands for all unmodeled companies. Indices and sentiment include the basket so they behave like real markets, but the basket cannot be bought into control [T].

**Calendar:** all twelve exchanges trade every hour of every day and close only on 1 January (3.1.0).

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
- **Board independence** feeds the CK3-style board (see [1-corporate-core.md](1-corporate-core.md) 1.8): a newly listed company must fill the required share of seats with Independent Directors, picked from an exchange-wide pool of AI characters. These seats can side with minority blocs.
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

- **Depositary receipts**: a company can list a receipt on a second exchange (for example a Gateway 50 company on ATX). The receipt trades in the second exchange's currency and its price tracks the home share times the FX rate, with arbitrage closing gaps above 0.5% within 2 ticks [T]. Cost: a one-off fee of 0.03% of market cap and the second exchange's disclosure rules.
- **HSE quota ("Connect")**: foreign holders buy HSE shares through a daily quota of 52 billion CNY for all foreigners combined [T]. When the quota is used up, foreign buy orders wait for the next day. A subsidiary incorporated in China that meets China's restriction label ([2-map-and-influence.md](2-map-and-influence.md) 2.2.2: a 30% local partner) counts as domestic and skips the quota (branch offices are dropped, batch 116).
- **Foreign ownership caps** (HSE 30%, NJX 49%, GXI by sector) apply to the sum of all foreign holders. When a cap is reached, foreigners can only buy from other foreigners, at a premium that floats from 0% to 15% [T].

### 3.2.5 The Freeport Night Market (cyberpunk venue)

An off-the-books, always-open venue run from servers in a sovereign-data haven. It is the cyberpunk accent of the market layer.

- **What trades**: black-market data lots (user data, surveillance feeds) and "grey" shares of private and delisted companies. Crypto and bets on events are in the phone tab ([9-gambling.md](9-gambling.md)), not here.
- **Access**: only through a shell company. Trades raise that shell's **exposure** (see [1-corporate-core.md](1-corporate-core.md) 1.7.4) by 1 point per $1M traded [T].
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

- TTM earnings are the net income of the last four quarters, from the company's financials ([10-industry-economy.md](10-industry-economy.md) 10.0.8).
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
| CEO's Favor (the public's view, -100 to +100) | +0.0005 per point above 0, -0.001 per point below 0 |

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

The **Undervaluation** casus belli ([1-corporate-core.md](1-corporate-core.md) 1.9.5) is open against a company whose market cap has been below its book equity for 20 consecutive trading days [T].

### 3.3.2 Sector table

All values are [T]. Rows are valuation groups of the industries in [10-industry-economy.md](10-industry-economy.md) 10.3; a company uses the row of its largest business unit by revenue.

| Valuation group (industries) | M_sector (P/E) | EVS (EV/Sales, for loss-makers) | g_sector | Annual volatility | Typical payout ratio | Beta |
|---|---|---|---|---|---|---|
| Software (Software, SaaS, Social media, Ads, Gaming, Gambling) | 28 | 6.0 | 12% | 35% | 15% | 1.2 |
| Hardware (Semiconductors, Consumer electronics) | 22 | 4.0 | 10% | 40% | 20% | 1.4 |
| AI and compute (AI labs, Cloud, Data centers) | 35 | 10.0 | 20% | 45% | 0% | 1.5 |
| Pharma with no product revenue yet (biotech) | 30 | 8.0 | 15% | 50% | 0% | 1.3 |
| Health (Pharma, Healthcare services) | 18 | 3.5 | 5% | 22% | 40% | 0.8 |
| Finance (Banking, Insurance, Asset management) | 11 | n/a (book method) | 4% | 25% | 45% | 1.1 |
| Energy (Oil, Gas) | 10 | 1.2 | 2% | 30% | 50% | 1.0 |
| Materials (Mining, Metals, Chemicals) | 11 | 1.8 | 3% | 32% | 45% | 1.2 |
| Manufacturing (Autos, EVs, Aerospace, Robotics, Drones, Construction) | 17 | 1.5 | 4% | 24% | 35% | 1.0 |
| Transport (Shipping, Logistics, Airlines) | 12 | 1.0 | 4% | 30% | 40% | 1.1 |
| Consumer (Retail, E-commerce, Fast food, Luxury) | 20 | 1.2 | 4% | 20% | 45% | 0.9 |
| Real estate | 15 | 6.0 | 3% | 22% | 80% | 0.8 |
| Utilities (Power utilities, Renewables, Telecom) | 16 | 2.5 | 2% | 18% | 65% | 0.6 |
| Media companies ([16-media.md](16-media.md); not an industry) | 18 | 2.5 | 5% | 30% | 25% | 1.0 |
| Defense | 18 | 1.8 | 6% | 26% | 30% | 0.7 |
| Agriculture | 15 | 1.0 | 3% | 20% | 45% | 0.7 |
| Professional services | 16 | 1.5 | 4% | 22% | 40% | 0.9 |

### 3.3.3 Hourly price update

On each tick of an open exchange, every listed stock updates:

`P_next = P x (1 + pull + flow + noise)`, then circuit breakers apply (3.3.8).

**Sentiment-adjusted target:**

`V* = V x (1 + 0.15 x Mkt/100 + 0.10 x Sec/100 + 0.10 x Buzz/100)`

where Mkt, Sec and Buzz are the market, sector and stock sentiment scores (3.3.5).

**Pull** toward the target:

`pull = a x (V* / P - 1)`, with a = 0.0003 per tick [T]

A gap between P and V* halves in about 2,300 ticks, or roughly 3 months. Undervalued stocks can stay undervalued for a long time, which is what makes raiding worthwhile.

**Flow** (net order imbalance, permanent impact):

`flow = gamma x sigma_d x (NetShares / ADV)`, with gamma = 0.8 [T]

- NetShares is the net number of shares bought this tick by all participants combined (AI archetypes, named holders, the player).
- sigma_d is the stock's daily volatility: annual volatility / 19.1 (the square root of 365 trading days).
- One full day's volume of net buying moves the price by 0.8 daily standard deviations.

**Noise:**

`noise = sigma_h x (rho x z_market + sqrt(1 - rho^2) x z_stock)`

- sigma_h = sigma_d / sqrt(24) (24 ticks a day, 3.1.0).
- z_market is one random draw per exchange per tick, shared by all its stocks; z_stock is a draw per stock. rho = 0.5 x beta, capped at 0.8 [T].
- Fat tails: each tick has a 2% chance that the draw is taken from a distribution 3 times as wide [T].

### 3.3.4 AI investor archetypes

Only named holders trade (3.0). The float of every listed company is held by named funds of eight **archetypes** (such as Monolith Index Partners or Graywater Value) and by named retail platforms such as Sherwood Retail. Their combined net buying or selling each tick is the "market". Named holders also vote, join blocs and react to disclosures, making those strategic decisions weekly; the archetype formulas below only set their hourly order flow.

Each archetype k has a **signal** D_k between -1 (all sell) and +1 (all buy). Its net order this tick is:

`NetShares_k = share_k x (ADV / 24) x D_k`

| Archetype | Default share of volume | Holds (typical, % of float) | Signal and behavior | Named examples |
|---|---|---|---|---|
| **Index funds** | 15% | 20% to 30% of index constituents | D = 0 most of the time. Buy additions and sell deletions at rebalance. Monthly savings inflow gives D = +0.1 on the first trading day of the month (D = -0.1 in a bear market, when the Globe 1000 is down 20% from its peak). Never sell on price. Vote with the proxy adviser. Lend most of their shares to short sellers | Monolith Index Partners, Vanguardian Trust |
| **Value funds** | 10% | 5% to 15% | Act only when P is more than 10% away from V: D = clamp(3 x (V/P - 1), -1, 1). Patient sellers into raids: they sell blocks only above their reservation price (3.4.9) | Graywater Value, Ostrander & Kell |
| **Momentum and quant** | 20% | 2% to 5% | D = clamp(10 x r5 + 5 x r20, -1, 1), where r5 and r20 are 5-day and 20-day returns. Amplify trends; cut D in half when GRG is above 50 (they deleverage) | Kinetic Quant, Parallax Systematic |
| **Retail** | 20% | 15% to 40% | D = clamp(Buzz/100 + 0.5 x Sec/100 + 3 x r1, -1, 1), where r1 is today's return so far. Panic rule: after a day below -8%, D = -1 for the first 3 ticks of the next day. Most sensitive to psyops, ad campaigns and meme hype | Sherwood Retail and other retail platforms |
| **Activists** | 3% | 0% until a campaign, then 5% to 10% | Dormant until a campaign starts (weekly decision, targeting companies with P below 0.8 V or poor governance). During a campaign D = +0.8 until the target stake is reached, then a demand and an Activist faction ([1-corporate-core.md](1-corporate-core.md) 1.9.1) | Harrow Activist Partners |
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

**Volume:** ADV starts at a turnover rate times the free float: 0.5% per day for large caps, 0.8% for mid caps, 1.2% for small caps and meme stocks [T]. Volume rises x4 for the first 24 hours of each earnings day (3.1.0) and doubles on news shocks, and rises by 50% when GRG is above 40.

**Proxy adviser:** index funds vote as recommended by **Civic Proxy Advisers**, an AI organization that favors independent directors, one-share-one-vote and higher dividends. It can be lobbied (a Persuasion scheme), which is a quiet way to swing a proxy fight.

### 3.3.5 Sentiment and the Global Risk Gauge

Four layers of mood feed prices.

| Layer | Range | Updated | Main drivers | Decay toward 0 (or baseline) |
|---|---|---|---|---|
| **GRG** (Global Risk Gauge) | 5 to 100, baseline 18 | Hourly | `GRG = 18 + 0.8 x (Globe 1000 20-day annualized volatility in % - 15) + event shocks`. Shocks: war +10 to +30, major bank failure +15, sovereign default +10 to +20, pandemic +25, chokepoint closed +5 [T] | Event shocks fade 3% per day |
| **Market sentiment** (Mkt, per exchange) | -100 to +100 | Daily | +3 per 1% index return that day; -0.5 per point of GRG rise; central bank surprises (3.9.5); elections and crises | 10% per day |
| **Sector sentiment** (Sec, per sector per exchange) | -100 to +100 | Daily | +2 per 1% sector index return; sector news (a chip shortage, a new sector regulation) | 15% per day |
| **Buzz** (per stock) | -100 to +100 | On events, daily decay | News (3.3.6), ad campaigns (+10 per campaign week), psyops (+25, see 3.10), meme hype, short reports (-30), analyst initiations (+5 to +15) | 25% per day |

Players can move Buzz directly with the influence tools of [2-map-and-influence.md](2-map-and-influence.md) 2.5.7: an ad campaign for a product or IPO is legal; a bot campaign to pump a stock you are selling is manipulation (3.10).

### 3.3.6 News shocks

A news shock changes V (if the facts change), sets an **immediate jump** in P on the next tick (or at the 2 January reopening if it lands on 1 January), and moves Buzz. All values are [T].

| News | Change to V | Immediate jump in P | Buzz | Notes |
|---|---|---|---|---|
| Earnings surprise (s = (actual - consensus) / abs(consensus)) | Full recalculation | clamp(0.5 x s, -25%, +25%) | +/- 20 x s, capped at 30 | Consensus is set the week before from analysts' forecasts; a CFO with Finance 15+ can "manage expectations" to lower it |
| Guidance cut or raise | Forward earnings change | -8% to -15% (cut), +3% to +8% (raise) | -15 / +10 | |
| Dividend cut / suspension / raise | Q modifier | -5% to -15% / -10% to -20% / +1% to +3% | | Larger for high-yield stocks |
| CEO dies or is ousted | Q via the new CEO's skill | -3% to -10%; +5% if the market disliked the old CEO | -10 | |
| Scandal (minor / major / criminal) | Q modifier | -3% / -10% / -20% | -20 / -40 / -60 | From schemes and investigations ([1-corporate-core.md](1-corporate-core.md) 1.1.8) |
| Regulatory probe opened | Q -0.08 | -5% to -15% | -25 | |
| Takeover bid announced | None | P jumps to `p x offer + (1 - p) x P_before`, where p is the market's estimate of deal success (0.5 to 0.9) | +40 | Merger arbitrage holds the price there |
| Disclosure filing by a known raider | None | See 3.4.9 | +20 | |
| Disaster or strike at a business unit | Earnings recalculated from lost revenue | -(share of revenue lost x 2), capped at -30% | -20 | From [10-industry-economy.md](10-industry-economy.md) |
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
| **Stop** | Becomes a market order when the price crosses the stop level (stop-loss or stop-buy) | Cutting losses, chasing breakouts |
| **Work order** | Spread over N ticks at a chosen participation rate (5% to 25%) | Low slippage stake building |
| **Block trade** | Negotiated with one named holder in a short ticked event (resolves in 1 to 8 ticks). Price = market price plus or minus a premium or discount set by the holder's reservation price. No slippage, but the trade is printed after settlement and the market then applies 30% of its permanent impact | Buying a stake from a fund, selling a stake without crashing the price |
| **Tender offer** | Public offer to all holders at a fixed price for a set period (2 to 4 weeks), possibly conditional (minimum acceptance, regulatory approval, removal of a poison pill) | Takeovers ([1-corporate-core.md](1-corporate-core.md) 1.9.3) |

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

### 3.3.9 The daily close and the 2 January reopening

- **Daily close**: the 00:00 UTC tick's price is the official close (3.1.0). Index rebalances, buybacks and forced liquidations often execute there.
- **2 January reopening auction**: the first tick after the 1 January close sets the price as the 31 December close times (1 + the news jumps queued on 1 January + the annual earnings surprise, 3.3.6) [T]. Orders queued on 1 January fill here.
- There are no sessions, lunch breaks or overnight gaps: news lands as a jump on the next hourly tick (3.3.6).

### 3.3.10 Daily settlement

At the 00:00 UTC daily close (3.1.0):

1. Trades of the day settle: cash and shares change hands (same-day settlement in game terms) [T].
2. V is refreshed with the day's inputs.
3. Sentiment decays; Buzz decays.
4. Borrow fees, margin interest and carry accrue (3.5).
5. Margin accounts are checked and formal margin calls issued (3.5.4).
6. Disclosure filings due that day are published, and AI holders react on the next tick (3.4.8, 3.4.9).
7. Ex-dividend adjustments for the next tick are scheduled.
8. Surveillance checks run for trades made ahead of today's news (3.10).

---

## 3.4 Corporate actions

### 3.4.1 IPO event chain

The IPO is the event chain in the Markets deck ([13-events.md](13-events.md) 13.5) (Hire Banks, Roadshow, Pricing Night, First Day of Trading), expanded below. It is open to any company that meets its exchange's listing requirements and hires an underwriter (Logan, 2026-10-17). Trading stays quote-based with slippage, limit and stop orders; there is no full order book (Logan).

**Preconditions**
- The company meets the target exchange's listing requirements (3.2.2) at its current V.
- The board approves (a board vote; a VC faction may force the question with an ultimatum).
- The charter is converted to a public charter. If the founders want dual-class shares, this is the moment, and only where the exchange allows them.

**Step 1: Hire Banks** (1 week; 3 pitch meetings with the CEO or CFO, each an instant roll)

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

**Step 4: Roadshow** (2 weeks; 8 to 12 investor meetings in different cities, each an instant roll once the presenter is there, so travel time matters)

Each meeting is a skill check of the presenters' Persuasion plus Finance against the investor's sophistication. The result builds **coverage**, the oversubscription multiple of the order book:

`Coverage = 1.5 + bank tier bonus + 3 x Mkt/100 + 2 x Sec/100 - 0.05 x max(0, GRG - 25) + 5 x (Q - 1) + meeting results`

Meeting results: success +0.3, great success +0.5, failure -0.1 [T].

**Step 5: Pricing Night** (an event)

| Coverage | Allowed pricing |
|---|---|
| Below 1x | Below range, or postpone (30% of bank fees are still owed; retry after 3 months) |
| 1x to 2x | Bottom to middle of range |
| 2x to 5x | Anywhere in range |
| 5x to 10x | Top of range to 10% above it |
| Above 10x | Up to 20% above the top |

Allocation choices made on Pricing Night:
- **Directed shares**: up to 5% of the offering to named friendly holders (allies, early investors) at the offer price. A way to seed a bloc.
- **Cornerstone investors** (ESE, HSE, VHX, LCX, GXI, NJX): up to 30% of the offering placed with sovereign or strategic holders who accept a 6-month lock-up. Lowers volatility; gives a government a seat at the table.
- **Retail tranche**: 10% to 30% (default 20%). Each 10 points above 20% adds 2% to the expected pop and doubles Buzz decay time for a month.

**Step 6: First Day of Trading**

`Expected pop = 0.5 x (V_post - offer) / offer + 0.05 x (Coverage - 3) + 0.10 x Mkt/100 + 0.2 x (retail tranche - 20%)`

plus noise with a standard deviation of 8% [T], clamped to -15% and +60%. V_post is V after adding the net primary proceeds to the company's cash. The first tick prints at offer x (1 + pop). First-day volatility is doubled.

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
| **SPAC merger** (Logan, 2026-10-17) | 8 to 16 weeks | The sponsor takes 20% of the SPAC's shares as its "promote" **(T)** | A listed blank-check company raises cash, then merges with a private company to take it public. Holders can redeem their cash before the merger (redemptions rise as Retail Fever falls). Anyone can sponsor a SPAC with $10M **(T)**; it must merge within 2 years or return the money. Popular in boom years |
| **Spin-off listing** of a vassal | Like an IPO | Like an IPO | The parent keeps a stake. Changes the vassal's autonomy to Independent Listing ([1-corporate-core.md](1-corporate-core.md) 1.7.2) |

### 3.4.3 Secondary offerings and rights issues

**Follow-on offering** (new shares sold to the market)
- Priced in an accelerated bookbuild (a short event).
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
- **Control matters**: a holder who does not take up rights is diluted. AI bloc members take up their rights if they have the cash and hold the bloc leader as a Friend; otherwise they sell rights, possibly to a rival. A rights issue can therefore be used against a cash-poor minority bloc, or by a rival to bleed a cash-poor controlling holder.

### 3.4.4 Buybacks

- Authorized by the annual shareholder meeting, up to 10% of shares per year without further approval [T].
- **Open-market buyback**: at most 25% of ADV per day (safe harbor); blacked out for the 30 days before each earnings report. Bought shares are cancelled.
- **Tender buyback**: a fixed-price or Dutch-auction offer at 5% to 15% above market.
- Announcement effect: +1% to +3%, and up to +5% if P is below 0.8 V.
- **Creeping control**: a buyback raises every remaining holder's percentage. Threshold crossings caused only by a buyback are disclosed but exempt from mandatory bids. A controlling holder that cannot afford to buy more shares can let its company buy back stock instead, which is cheaper personally but costs the company cash.

### 3.4.5 Splits

- Ratios 2:1, 3:1, 5:1, 10:1. Effective at the next daily close. No change to V or market cap.
- Effect: Buzz +10 and a small retail-driven drift of +1% over 2 weeks [T].
- **Reverse splits** (1:10 and so on) signal distress: Buzz -10, price -3%.
- **Minimum price**: on ATX and HDM, a stock below $1 for 30 trading days gets a delisting notice and must reverse split within 90 days.

### 3.4.6 Dividends

The board sets a **dividend policy** at the annual shareholder meeting. Each quarter the CFO proposes the dividend under that policy and the board votes on it (Logan, 2026-10-17; [10-industry-economy.md](10-industry-economy.md) 10.5.5). Dividends are declared with the quarterly earnings report and paid in the next monthly calculation, matching the monthly cash flow of [1-corporate-core.md](1-corporate-core.md) 1.10.4. Up the vassal chain, dividends are the tribute.

| Policy | Rule | Market view |
|---|---|---|
| None | Retain all earnings | Normal for growth sectors; value and sovereign funds hold less |
| Fixed payout | X% of quarterly earnings | Dividend moves with earnings |
| Progressive | Never cut; raise 5% to 10% a year | Q +0.03 after 5 years; a cut is a major shock (-10% to -15%) |
| Fixed amount | Same per share each quarter | Simple; cutting is a shock |
| Special | One-off payout | Ex-date drop only; Buzz +10 |

- **Ex-dividend date** is 2 weeks after declaration; the price opens lower by the dividend amount.
- **Withholding tax** for foreign holders: 15% by default, set by each country's tax law [T].
- A controlling character who needs cash for their personal trust can push dividends up through its board seats, at the cost of growth (less reinvestment) and, if payout exceeds earnings, falling V.

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
- After delisting, shares become private stakes and trade only through negotiation events (3.19.1).

### 3.4.8 Disclosure thresholds

The **first filing line** is set by each country's F4 Securities Regulation law: Lax 10% (no earlier line), Standard 5%, Strict 3%, Draconian 2% ([4-politics.md](4-politics.md), F4). The **10%, 25% and 50% lines** are the same everywhere. Jurisdictions differ otherwise only in deadlines and in what counts toward them.

| Threshold | Filing deadline | What is published | Legal effects |
|---|---|---|---|
| **First line (2% to 10%, by F4)** | 2 trading days (5 on ATX and HDM) [T] | Holder name (or the shell's name), stake, intent (Passive or Active), source of funds | A Passive filer who later wants to act must refile as Active and wait 5 trading days |
| **10%** | 2 trading days | Same, plus every later trade within 2 days | **Insider status**: short-swing rule (profits from a buy and a sell within 6 months are handed back to the company); blackout windows before earnings; right to nominate a director at the next annual meeting |
| **25%** | 2 trading days | Same | **Blocking minority**: can veto two-thirds votes (charter changes, mergers, staggered boards); foreign investment review if a foreign holder group crosses 25% in a sensitive sector (energy, utilities, defense, Semiconductors, data, media) ([4-politics.md](4-politics.md), C1) |
| **50%** | Immediate | Same | **Majority on the books**: the holder group becomes the public **owner of record** and the head changes under the charter; delisting check if free float drops below the minimum. Who **really** controls the company is the second layer ([1-corporate-core.md](1-corporate-core.md) 1.3.1): vassal chains, blocs, hooks, loyalty and figureheads decide it, and it is hidden unless someone has intel. A majority usually brings real control, but a figurehead or a defecting bloc can leave the real controller elsewhere. On full ownership the owner chooses to merge or keep the company as a subsidiary |

Every later crossing of the same lines downward (falling below 50%, 25%, 10% or the first line) is also disclosed.

**What counts toward a threshold**
- All shares held by the holder group (controlled entities and bloc partners) count together. Coordinating with others without declaring a bloc is **undisclosed concert action**, a violation (3.10).
- Shares held through a **shell company** are filed under the shell's name. The true owner stays hidden until the shell is investigated, by a rival's Investigate Shell scheme or by the regulator. Weekly detection chance: 2% base, +1% per threshold the shell has crossed, x regulator strictness / 3 [T].
- **Cash-settled derivatives** (equity swaps) count only where the Derivatives Disclosure law is active: by default CLX, CBX, LCX, VHX and HRX [T]. Elsewhere a raider can build an economic stake through swaps with a bank, which buys real shares to hedge (so the price still moves), then convert to shares in one block, crossing several thresholds at once. Legal, but regulator suspicion +15 per conversion.
- Shares on loan to short sellers count for the borrower while borrowed (3.5.1).

### 3.4.9 How AI holders react

**Price reaction** to a filing, applied on the next tick [T]:

| Threshold crossed (Active intent) | Base jump | Multiplied by filer type |
|---|---|---|
| First line | +2% | Passive fund x0, unknown x1, known activist x1.5, known raider or strategic competitor x2 |
| 10% | +3% | Same |
| 25% | +5% | Same |
| 50% | P moves toward the expected price of any mandatory or follow-on offer | |

**Reservation prices.** Each named AI holder has a reservation price: the lowest price at which it will sell a block or tender its shares. Base values [T]:

| Holder type | Base reservation price |
|---|---|
| Index fund | Tenders at any premium if the offer is likely to succeed (they follow the crowd); never sells blocks outside rebalances |
| Value fund | max(V, P) x 1.10 |
| Retail platforms | Each slice draws P x 1.10 to 1.40 |
| Activist | Its campaign target price, usually V x 1.15 |
| Sovereign fund | V x 1.5 for a foreign hostile bidder; V x 1.1 for a domestic one |
| Hedge fund (merger arb) | Tenders at the offer if the deal is likely; sells blocks at P x 1.03 |
| Founders and other AI characters | Driven by their tag on the bidder: never below V x 1.3 (V x 1.15 if Friend); refuses Rivals and Nemeses at any price |

After an Active filing all reservation prices rise: +5% at the first line, +10% at 10%, +15% at 25% (the **holdout effect**) [T].

**Behavior by holder type after an Active filing by a hostile holder group:**

| Holder | Reaction |
|---|---|
| Target's board | At its next weekly decision the General Counsel proposes defenses: poison pill (where allowed), staggered board (needs a two-thirds vote, which a 25% blocker can stop), white knight search, crown-jewel sale, charter change ([1-corporate-core.md](1-corporate-core.md) 1.9.4) |
| Controlling bloc | Members' tags on the leader are tested: members who hold the leader as a Rival or Nemesis may open talks with the raider (a defection risk) |
| Hedge funds | Buy 2% to 5% of the float for merger arbitrage; become swing holders who sell to the highest bidder |
| Value funds | Hold out for a premium; sell blocks only at their reservation price |
| Sovereign funds | Buy to defend if the raider is foreign and the target is a national champion |
| Retail | Buzz +20; some sell into the jump, most hold for a bid |
| Rival characters | AI rivals may offer to be a white knight, buying a bloc position for future leverage; a counter-bid for the whole company needs the game director's order (batch 86) |
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

A hedge fund (or a player through a shell company) can publish a **short report**: a news shock of -5% to -20% (3.3.6). The company can rebut through a CFO or General Counsel event; success reverses half the drop. A report that contains fabrications, if exposed, is the manipulation offense "short and distort" (3.10).

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

Personal accounts and personal trusts can open a margin account with a prime broker (Sterling Crane & Co, Hollis Barrow, Tanaka-Wren Securities). The **equity ratio** is (assets - loan) / assets.

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

**Interest**: policy rate + 2.5% for accounts under $100M of assets, + 1.5% for $100M to $1B, + 1.0% above $1B [T]. Accrues daily, charged monthly.

**Margin call procedure**

1. **Warning (hourly)**: if the equity ratio falls within 5 points of maintenance, a **Margin Warning** notification fires and the game auto-pauses.
2. **Call (daily settlement)**: if the equity ratio is below maintenance at settlement, the **Margin Call** event fires ([13-events.md](13-events.md) 13.5, Markets deck). The amount due restores the ratio to maintenance + 5 points. Deadline: the next settlement (24 ticks).
3. **Options** in the event:
   - Deposit cash.
   - Pledge other assets (real estate counts at 50% of value after a valuation of 6 ticks; bonds at their margin rate).
   - Sell positions of the player's choice.
   - **Negotiate an extension**: chance = 40% + 2% per Finance point above 10, +10% if the broker's relationship manager holds the account holder as Friend (-10% if Rival), - 10% if under a scandal [T]. Success gives 2 more trading days for a fee of 0.5% of the loan; failure pushes the relationship manager 10 toward Rival and raises the leak chance.
   - Ask an ally for a loan (creates a debt and usually a hook).
   - Draw on another of the character's own personal trusts or accounts.
4. **Leak**: each margin call has a 20% chance of becoming known (rival intel, journalists, the broker's other clients). A leaked call is a news shock of -3% to -8% on the pledged stock, and hedge funds add short positions (predatory trading) [T].
5. **Forced liquidation**: if the deadline passes unpaid, or if the equity ratio falls below maintenance - 10 points at any tick, the broker sells until the ratio is back to maintenance + 10 points. It sells the most liquid positions first, at 50% participation (heavy slippage). Control stakes are sold through a **Block Auction** event: named holders bid, usually at 5% to 15% below market, and the winner is announced. Rivals love block auctions.
6. **Cascade**: forced sales push the price down, which can trigger calls on other leveraged holders of the same stock (allies, AI funds), whose forced sales push it further. Circuit breakers are the only brake.

### 3.5.5 Stock-pledge loans

Founders and controlling holders often borrow against a control stake instead of opening a margin account. A bank lends against pledged shares that stay in the holder's name (and keep their votes) [T]:

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
| National governments | Bills (3 and 12 months), notes and bonds (2, 5, 10, 30 years) | Over the counter, every hour (3.1.0) | Issued at monthly auctions; eurozone members each issue in EUR with their own rating |
| Regional and city governments | 5 to 30-year bonds | Home market only | Buying them gives influence with the issuer ([2-map-and-influence.md](2-map-and-influence.md) 2.5.2) |
| Companies, investment grade | 3 to 30-year bonds | Home market | Issued by bookbuild (an event); fee 0.5% |
| Companies, high yield | 5 to 10-year bonds | Home market | Fee 1.5%; tighter covenants |
| Private credit | Loans from funds | Not traded | Negotiated in events; leverage over borrowers ([10-industry-economy.md](10-industry-economy.md) 10.0.9) |
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
| Sector: biotech, shipping, mining | -1 |
| Under investigation, or shell exposure above 50 | -1 |
| Banking or insurance subsidiary, or a guarantee from a stronger parent | Up to the parent's rating minus 1 |
| **Country ceiling** | No higher than the home sovereign + 1 notch, or + 3 if more than half of revenue is earned abroad |

**Sovereign implied rating** is a points score [T]:

| Factor | Points |
|---|---|
| Debt / GDP below 40% / 40 to 80% / 80 to 120% / above 120% | +3 / +1 / -1 / -3 (0 for reserve-currency issuers above 120%) |
| Budget deficit below 2% / 2 to 5% / above 5% of GDP | +1 / 0 / -2 |
| FX reserves above 6 months of imports / 3 to 6 / below 3 | +1 / 0 / -2 |
| Inflation within 2 points of target / above target by 5+ points | +1 / -2 |
| Stability ([4-politics.md](4-politics.md) 4.11.7) above 70 / below 40 | +1 / -2 |
| Issuer of a reserve currency (USD, EUR, JPY, GBP, CHF) | +2 |
| Default in the past 10 years | -3 |
| Government type: liberal democracy +1; one-party state 0; military junta -2; failed state -5 | |

Score 7 or more maps to AAA, then one notch lower per point down to CCC at -12 or below.

### 3.6.4 Rating agency behavior

- **Quarterly review** of every issuer (the quarterly calculation). The rating moves toward the implied rating by at most 1 notch per review, or 2 notches if the gap is 3 or more. Ratings are sticky on purpose.
- **Outlook** (Positive, Stable, Negative) is set one review before a planned move, as a warning to markets.
- **Watch**: after a major shock (takeover, default nearby, currency crisis, a big scandal) an agency places the issuer on Watch and may act within 2 weeks, moving up to 3 notches.
- **Pro-cyclical**: while GRG is above 50, each downgrade review has a 30% chance of an extra notch.
- **Agency personalities**:

| Agency | Personality | Gameplay hook |
|---|---|---|
| Meridian Ratings | Conservative and slow; rates 1 notch below implied 20% of the time | Its downgrades hit hardest because they are rare |
| Halvorsen & Gray | Issuer-friendly ("issuer pays"); rates 1 notch above implied 30% of the time | **Rating shopping**: an issuer can hire only H&G for a new bond, at a fee of 0.1% of the issue; investors price a single-rated bond 10 basis points wider |
| Cassini Credit | Close to governments; rates allied sovereigns 1 notch higher | Politically influenced; its head is a lobbyable character |

- Each agency's lead analyst for an issuer is an AI character. Schemes: **Court the Analyst** (Persuasion; 30% chance of +1 notch at the next review, never above implied + 1), **Bribe the Analyst** (a crime, 3.10), **Leak to the Analyst** (a rival plants bad news, triggering Watch Negative).
- The market uses the **average** of available ratings; index and fund eligibility use the **middle** of three.

**Effects of crossing the investment-grade line**
- **Fallen angel** (BBB- to BB+): investment-grade-only funds must sell within a month. Bond price -3% to -8% beyond the spread change; bank loans with rating triggers may be repriced (+1% interest) or called.
- **Rising star** (BB+ to BBB-): the reverse, +2% to +4%.

### 3.6.5 Yield formula

**Government bonds** in their own currency, maturity T years:

`y(T) = r_avg(T) + TP(T) + sovereign spread(rating) + calibration offset`

- `r_avg(T)` is the market's expected average policy rate over T: `r_n + (r_0 - r_n) x (tau / T) x (1 - e^(-T / tau))`, with r_0 the current policy rate, r_n the neutral nominal rate (neutral real rate + inflation target, 3.9.2), tau = 3 years [T]. Forward guidance (3.9.5) shifts r_0 by +/- 0.25 points in this formula.
- `TP(T)`, the term premium: `0.3% x ln(1 + T) x (1 + 0.5 x max(0, debt/GDP - 60%))`, minus 0.1 points for each 10% of GDP of government bonds the central bank holds through QE (floor 0) [T].
- The **calibration offset** is a per-country constant set once so that starting yields match the January 2020 world.

Example: US 10-year at the start, with r_0 = 1.75%, r_n = 3.0%, debt 120% of GDP, rating AA+. r_avg = 3.0 - 1.25 x 0.3 x 0.964 = 2.64%. TP = 0.3% x 2.40 x 1.3 = 0.94%. Spread 0.15%. y = 3.73% before the calibration offset; an offset of -1.9 points sets it to the January 2020 level of about 1.8% [T].

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
   - Pay late from a rescue loan, an asset sale or a cash injection from the owner.
   - **Distressed exchange**: offer bondholders new bonds with a 20% to 40% haircut or a longer maturity. If two thirds by value accept, the rating becomes SD, then is re-rated (usually B or CCC).
   - File for **Protected Reorganization** (the game's Chapter 11).
   - File for liquidation.
   - Covenant breaches only: negotiate a **waiver** (fee 0.5% to 1%, tighter terms).
3. **Creditor committee** forms from the largest holders of each class. Hedge funds ("vultures") buy bonds at 20 to 40 cents to lead it; so can the player.
4. **The plan**: management (or any class holding a third or more) proposes a plan: haircut, maturity extension, coupon cut, and usually a **debt-for-equity swap**: old shares diluted to 0% to 10%, bondholders get 70% to 95% of new shares.
5. **Vote**: each class approves with **two thirds by value and a majority by number** [T]. A holder of more than a third of a class can block. A court can impose a plan on one dissenting class if every class is treated at least as well as in liquidation (a "cram-down"; a General Counsel event).
6. **Court approval**: 4 to 12 weeks. Meanwhile the company runs, under a court-appointed monitor.
7. **Outcome**: the company emerges, usually rated B or CCC, with new owners. **Control changes hands**, which can break the player's hold over their flagship ([1-corporate-core.md](1-corporate-core.md) 1.9: "creditors take control"). Old shares are cancelled or nearly so.

**Liquidation waterfall**: secured creditors, then senior unsecured, then subordinated, then preferred shares (class P), then common shares. Expected recovery used in pricing [T]: secured 65%, senior 40%, subordinated 15%, equity 0% to 5%.

**Personal guarantees** ([1-corporate-core.md](1-corporate-core.md) 1.10): if a guaranteed loan defaults, the guarantor's accounts are charged; if they cannot pay, their pledged assets are seized.

### 3.6.7 Sovereign default chain

1. **Funding stress**: a failed government bond auction (bid-to-cover below 1.5) pushes yields +0.25 to +0.75 points; Watch Negative.
2. **Missed payment**: rating SD or D; all of that government's bonds fall to expected recovery (30% to 60%); the currency is hit (3.8.7); banks holding the bonds take losses.
3. **Choices for the AI government** (players influence through lobbying and influence in that country):
   - **ISF program**: a loan with conditions: austerity laws (spending cuts, tax rises), central bank independence raised, capital controls lifted or imposed. Stability -10 to -20.
   - **Negotiated haircut** with a creditor committee: 30% to 70% losses for bondholders.
   - **Hard default**: no deal; capital controls; access to markets lost for 5 years.
4. **Holdout creditors**: vulture funds (or the player) who refuse the deal can sue abroad and try to seize the government's assets in other jurisdictions (an event chain). Winning pays near face value but enrages that government.
5. **Political fallout**: government stability falls, elections or coups become likelier ([4-politics.md](4-politics.md) 4.8); the default history penalty stays on the rating for 10 years.

---

## 3.7 Commodities

> **Placeholder (Logan, batch 75).** Commodity trading is deferred (3.0). This section keeps a light placeholder model, driven by each industry's supply ratio, until commodities are designed.

### 3.7.1 What trades

Commodity trading comes later (3.0); this section is its design for then. Raw materials, energy and a few digital indices trade on five fictional commodity exchanges. Electricity is priced per country grid ([10-industry-economy.md](10-industry-economy.md) 10.6) and does not trade globally. Starting prices are loosely January 2020 and all values are [T].

| Commodity | Exchange | Unit | Starting price | Annual volatility | Delivery | Storage cost (per year, % of value) | Price elasticity eta (3.7.2) |
|---|---|---|---|---|---|---|---|
| Crude oil | Gulf Energy Exchange (GEX), Dubai; also Great Lakes Mercantile | barrel | $60 | 35% | Physical at Fujairah and Cushing | 4% | 1.5 |
| Natural gas (three regional benchmarks: North America, Europe, Asia LNG) | Great Lakes Mercantile (GLM), Chicago | MMBtu | $2.00 / $7 / $5.50 (Europe is dear with Russian pipeline gas cut since 2005, A) | 55% | Physical at the benchmark delivery point | 8% | 1.8 |
| Refined fuel (a commodity, not an industry) | GEX | tonne | $580 | 35% | Physical | 4% | 1.4 |
| Iron ore | Bohai Commodity Exchange (BCX), Dalian | tonne | $93 | 30% | Physical at Qingdao | 3% | 1.2 |
| Copper | London Metals Hall (LMH), London | tonne | $6,100 | 25% | Physical in LMH warehouses (Rotterdam, Singapore, New Orleans) | 2% | 1.0 |
| Lithium carbonate | LMH | tonne | $7,000 | 50% | Physical in LMH warehouses | 3% | 1.3 |
| Rare earths basket | BCX | kg | $35 | 45% | Physical at Baotou | 3% | 1.6 |
| Steel (hot-rolled coil) | BCX and GLM | tonne | $600 | 25% | Physical | 3% | 1.0 |
| Wheat | GLM | bushel | $5.60 | 28% | Physical at Chicago and Toledo | 6% | 1.2 |
| Soybeans | GLM and BCX | bushel | $9.20 | 22% | Physical | 6% | 1.2 |
| Timber | GLM | thousand board feet | $430 | 30% | Physical | 5% | 0.9 |
| Gold | LMH | troy ounce | $1,520 | 15% | Physical in vaults | 0.2% | n/a (financial) |
| Memory chips (Standard Memory Index) | Hsinchu Compute and Chip Exchange (HCX), Hsinchu | index point | 1,000 | 40% | Cash-settled | n/a | 2.0 |
| Compute hours (GPU-hour index) | HCX | GPU-hour | $2.50 | 45% | Cash-settled | n/a | 1.5 |
| Carbon permits | LMH | tonne CO2 | EUR 24 | 35% | Registry transfer | 0% | 1.0 |

**Hours**: commodity futures tick every hour on the 3.1.0 calendar and settle at 00:00 UTC; liquidity is flat around the clock.

### 3.7.2 Spot price model

The **spot price** is one world price, matching the one world market per industry of [10-industry-economy.md](10-industry-economy.md) 10.0.3.

**Fundamental spot** (recalculated weekly, when inventories update):

`S_fund = MarginalCost x (NormalInventory / Inventory)^eta`

- **MarginalCost** is the commodity's cost anchor, updated monthly from the supply ratio of its industry (10.0.3), as the price indices of 10.6 are.
- **Inventory** is global stocks (exchange warehouses plus strategic reserves), which build while the industry is oversupplied and drain while it is undersupplied (10.0.3); **NormalInventory** is the 3-year average.
- Example: inventories at 80% of normal with eta 1.5 give S_fund = 1.40 x marginal cost.

**Hourly tick**: same structure as stocks (3.3.3): `S_next = S x (1 + 0.002 x (S_fund / S - 1) + flow + noise)`, with pull a = 0.002 per tick [T], flow from net futures buying against open interest, and noise from the volatility column.

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
- **Delivery**: physical contracts deliver at named locations through warehouse warrants. Only holders who own or rent storage (their own warehouse, or a fee to a physical trader) can take delivery. Cash-settled contracts pay the difference.

### 3.7.4 Commodity market participants

| Participant | Behavior |
|---|---|
| **Producers** (companies with mining, oil and gas or farming business units) | Sell futures to lock prices according to their CFO's hedge policy |
| **Consumers** (companies with Chemicals, Airlines, Semiconductors or Agriculture business units) | Buy futures to lock input costs |
| **Managed money** (trend followers) | Momentum signal like 3.3.4 |
| **Commodity index funds** | Long only; roll on days 5 to 9 |
| **Physical traders** (Vanterra Trading, Halcrow Glencove, Silk Road Resources) | Own storage and ships; arbitrage spot, futures and regional benchmark prices; buy cheap stocks in contango to store |
| **Governments** | Strategic reserves (oil and grain): release when price is 30% above its 1-year average, refill when 15% below [T]; export bans and price controls ([4-politics.md](4-politics.md)) |

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
| After expiry, if the corner was proven | Investigation chain: disgorgement plus fines of up to 3 times the profit, trading bans for the entities and characters involved, Favor -20 |

**Political backlash**: cornering a staple (wheat, soybeans, gas) raises the local price for households, so unrest rises in the countries that import it and governments may impose price controls or export bans. Cornering an industrial metal angers the companies that use it, which may become rivals.

**Payoff when it works**: shorts close at the squeezed price. The corner unwinds after expiry, and the physical stock the cornerer holds usually has to be sold into a falling market, so part of the profit is given back (see example 3.11.6).

---

## 3.8 Foreign exchange

### 3.8.1 Currencies

Every country (or currency zone) has a currency; every account, price and asset is denominated in one ([1-corporate-core.md](1-corporate-core.md) 1.10). Rates are quoted as units per USD, except EUR and GBP, which are quoted as USD per unit, as in the real market.

Starting values are loosely January 2020 (real values, adjusted for the alternate history where noted); all are [T].

| Code | Currency | Country or zone | Start rate | Regime at start | Policy rate at start | Role |
|---|---|---|---|---|---|---|
| USD | US dollar | United States | 1.00 | Free float | 1.75% | Main reserve currency; numeraire |
| EUR | Euro | Eurozone | 0.95 USD per EUR **(T; down hard in the 2019 euro crisis, [19-history.md](19-history.md) 19.21)** | Free float | 0.00% | Reserve currency |
| JPY | Yen | Japan | 109 | Free float (intervention-prone) | -0.10% | Safe haven; carry funding currency |
| GBP | Pound sterling | United Kingdom | 1.31 USD per GBP | Free float | 0.75% | Reserve currency |
| CNY | Yuan (onshore; offshore CNH) | China | 6.93 | Managed float, +/- 2% daily band; moderate capital controls | 4.15% | Managed; trade giant |
| INR | Rupee | India | 71.0 | Managed float; light capital controls | 5.15% | Emerging, managed |
| CHF | Swiss franc | Switzerland | 0.97 | Free float (intervention-prone) | -0.75% | Safe haven; carry funding currency |
| CAD | Canadian dollar | Canada | 1.30 | Free float | 1.75% | Commodity currency |
| AUD | Australian dollar | Australia | 1.45 | Free float | 0.75% | Commodity currency; risk-sensitive |
| KRW | Won | South Korea | 1,160 | Free float; light controls | 1.25% | Export-driven; chip cycle |
| SGD | Singapore dollar | Singapore | 1.35 | Managed basket band, +/- 2% | 1.50% | Managed; financial center |
| HKD | Hong Kong dollar | Hong Kong | 7.78 | Currency board, 7.75 to 7.85 | 2.00% | Pegged to USD |
| SAR | Riyal | Saudi Arabia | 3.75 | Hard peg | 2.25% | Pegged; oil exporter |
| AED | Dirham | United Arab Emirates | 3.6725 | Hard peg | 2.00% | Pegged; trade center |
| BRL | Real | Brazil | 4.02 | Free float | 4.50% | Carry target |
| MXN | Peso | Mexico | 18.9 | Free float | 7.25% | Carry target |
| ZAR | Rand | South Africa | 14.0 | Free float | 6.50% | Commodity, carry, risk-sensitive |
| TRY | Lira | Turkey | 5.9 | Managed float | 12.00% | High inflation; crisis-prone |
| RUB | Ruble | Russia | 70.0 (weaker than the real 61 after 15 years of sanctions, A) | Managed float; hard capital controls; under sanctions | 7.00% | Sanctioned; half of reserves frozen |
| EGP | Pound | Egypt | 16.0 | Hard peg with moderate controls (starting scenario) | 12.25% | Overvalued peg; a crisis waiting to happen |
| ARS | Peso | Argentina | 60 (official) | Crawling peg, 2% a month; hard controls with a parallel rate | 50.00% | Chronic crisis |
| COP | Peso | Colombia | 3,300 | Free float | 4.25% | Oil exporter; carry target (major country from batch 116) |
| CDF | Franc | DR Congo | 1,670 | Managed float; the economy runs mostly on USD | 9.00% | Cobalt exporter; dollarized (major country from batch 116) |
| **ASC** | Arcology Scrip | Corporate charter cities | Created when founded | Chosen by the city's company | Set by the company | Endgame currency for a corporate sovereign city or province ([4-politics.md](4-politics.md) 4.12) |

Notes:
- **Crypto** (coins and stablecoins) is not a currency in this market layer; it lives in the phone tab ([9-gambling.md](9-gambling.md)), batch 116.
- **Arcology Scrip** is a corporate sovereign city's private central bank (usually at Megacorp rank, [4-politics.md](4-politics.md) 4.12): the controlling company sets its regime and policy rate using the rules in 3.9.

### 3.8.2 Exchange rate update

Each currency's value is tracked as x = ln(USD per unit). The USD is the numeraire; the "Dollar Index" shows the USD against a trade-weighted basket.

**Hourly tick** (every hour, 3.1.0):

`dx = alpha x (x_fair - x) + 0.005 x Flow / Depth + beta x dGRG / 10 + sigma_h x z + intervention`

| Term | Meaning | Values [T] |
|---|---|---|
| alpha x (x_fair - x) | Slow pull toward fair value | alpha = 0.001 per tick (half-life about 4 weeks) |
| Flow / Depth | Net buying of the currency this tick, in USD | Flows: trade payments (exports minus imports, spread over the hours), foreign purchases and sales of local stocks and bonds (from the market simulation), FDI, player and AI conversions, carry positions opening or closing. Each full unit of hourly depth moves the rate 0.5% |
| beta x dGRG / 10 | Risk sentiment | Beta per +10 GRG, table below |
| sigma_h x z | Noise | sigma_h = annual volatility / sqrt(8,760) (24 ticks x 365 days) |
| intervention | Central bank buying or selling | Same impact as a flow, plus a one-off 0.2% x credibility / 50 signal effect when announced |

**Fair value** (refreshed at daily settlement):

`x_fair = x_PPP + 0.030 x RRD + 0.015 x CA + 0.005 x TOT - 0.0005 x max(0, Debt - 90) - 0.002 x max(0, 50 - Stability) + offset`

- RRD: real rate differential with the US in percentage points (local policy rate minus local inflation, minus the same for the US).
- CA: current account balance as % of GDP (the **trade balance** plus income flows, from the economy).
- TOT: % change in terms of trade over 12 months (export prices over import prices; big for commodity exporters).
- Debt: government debt as % of GDP. Stability: 0 to 100 from [4-politics.md](4-politics.md) 4.11.7.
- The sum of adjustments is capped at +/- 0.30.
- x_PPP drifts monthly by the inflation gap: x_PPP falls by (local inflation - US inflation) / 12.
- The offset is set once at game start so that every currency starts at fair value, **except** deliberate starting imbalances: EGP 24% overvalued at its peg, ARS official rate 40% overvalued [T].

**Currency parameters** [T]:

| Currency | Hourly depth (USD bn) | Annual volatility | Risk beta (% per +10 GRG) |
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
| COP | 0.6 | 12% | -2.0 |
| TRY | 0.6 | 20% | -2.5 |
| RUB | 0.5 | 18% | -2.0 |
| CDF | 0.02 | 10% | -2.0 |
| EGP | 0.2 | 3% (inside band) | -2.0 |
| ARS (official / parallel) | 0.05 / 0.02 | 10% / 30% | -3.0 |
| Gold (for reference) | 15 | 15% | +1.5 |

### 3.8.3 Exchange rate regimes

The regime is a law in each country ([4-politics.md](4-politics.md), F3 Exchange Rate Regime) and can change through politics or a crisis.

| Regime | Rules | Central bank behavior | Player angle |
|---|---|---|---|
| **Free float** | Rate set by the market | No intervention, except once if the rate moves more than 5% in a day ("disorderly market"); JPY and CHF intervene against moves of 10% in 3 months away from fair value | Pure market risk |
| **Managed float** | A reference rate plus a band (CNY +/- 2% daily; SGD +/- 2% around a basket) | Intervenes at the band edges; leans against moves of more than 2% in a week; can move the reference rate daily (CNY "fixing") | Trade the fixing; bet on band moves |
| **Crawling peg** | Peg that moves by a set % each month (ARS 2%) | Defends the crawl like a peg | Profitable to attack when inflation outruns the crawl |
| **Hard peg** | Fixed rate +/- 1% to an anchor (usually USD) | Must defend with reserves; policy rate tied to the anchor's rate plus a **peg spread** = 0.5% + 0.1% x (60 - credibility), minimum 0.5% [T]; no independent monetary policy | Attack it (3.8.6) |
| **Currency board** | Fixed rate, all base money backed by reserves at 100% or more | Automatic: when money flows out, base money shrinks and short-term rates spike, with no discretion | Very hard to break unless reserves fall below 100% of base money |
| **Currency union** | One currency for several countries (EUR) | One central bank for all members; members keep their own bond ratings and spreads | Member spreads (for example Italy versus Germany) can blow out in a crisis |

**Credibility** (0 to 100) is tracked for every managed regime. It starts at 80 for SAR, AED and HKD, 55 for EGP, 35 for ARS [T]. Daily change: -0.5 per 1% of starting reserves lost that day; +5 for a defensive rate hike of 5 points or more; -3 when capital controls are tightened under pressure; -2 to -10 for psyops or damaging news; recovers +0.5 per calm day toward its starting level. While credibility is 60 or more, the fair-value pull on a pegged rate is suspended (expectations are anchored); below 60 it is scaled by (60 - credibility) / 60.

**Capital controls** are an overlay on any regime ([4-politics.md](4-politics.md), F2 Capital Controls):

| Level | Rules [T] | Effects |
|---|---|---|
| **None** | Free movement | |
| **Light** | 1% levy on short-term (under 1 year) inflows; foreign purchases registered | Small cost |
| **Moderate** | Foreigners may convert at most $50M per holder group per month out of the country; profit repatriation needs approval (1 to 4 weeks); residents limited to $50k a year outbound; offshore non-deliverable forwards (NDFs) appear | Money gets stuck; locally incorporated subsidiaries that meet the country's restriction label count as domestic and bypass the foreign limits, but not repatriation |
| **Hard** | No conversion without a license; exports must surrender FX; a **parallel rate** appears | Profits are trapped; black-market conversion through shells and fixers at the parallel rate, raising exposure |

**Parallel rate premium** under hard controls = max(0, overvaluation of the official rate) x 2.0 (moderate controls: x 1.0) [T]. ARS at 40% overvaluation trades about 80% weaker on the parallel market.

### 3.8.4 Liquidity, conversions and carry

**Liquidity** is flat around the clock (3.1.0): a big conversion costs slippage by the 3.3.7 formula with the currency's hourly depth.

**Spot conversion**: any account can convert at the current rate, paying a spread of 0.02% for majors, 0.1% for emerging currencies, 0.5% for ARS, EGP, RUB and CDF [T], plus slippage.

**Carry trade**: borrow in a low-rate currency, hold a high-rate one. At each daily settlement a carry position accrues `notional x (r_high - r_low) / 365` (the rollover). The risk is the exchange rate.
- **Carry crowding**: the game tracks total AI carry positions per target currency. When GRG rises 10 points or more within 2 days, a **Carry Unwind** event fires: AI funds close 30% of their carry books over 3 days. The resulting flows lift funding currencies (JPY, CHF) by 2% to 5% and drop targets (BRL, MXN, ZAR, TRY, INR) by 3% to 8% [T]. See example 3.11.7.

### 3.8.5 Forwards and NDFs

- **Forward rate** by covered interest parity, quoted as units per USD: `F = S x (1 + r_local x T) / (1 + r_usd x T)`, with T in years. Tenors: 1 week, 1, 3, 6 and 12 months.
- No upfront payment; collateral of 5% (majors), 10% (emerging) or 20% (pegged currencies under pressure, credibility below 50) of notional [T]; marked to market daily.
- **Hedging**: a company's CFO sets an FX hedge ratio for foreign revenue and costs, like commodity hedges (3.7.5). Unhedged foreign debt is the classic crisis killer: when the local currency falls, the debt grows in local terms.
- **NDFs** (non-deliverable forwards): for currencies with moderate or hard controls (CNY, INR, KRW, BRL, RUB, EGP, ARS), forwards trade offshore and settle in USD. The offshore rate can diverge from the onshore one; the gap is a public signal of pressure.

### 3.8.6 Attacking a peg

Speculators (AI hedge funds and the player, usually at Megacorp rank, 3.1.4) can bet that a peg will break.

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

**Consequences for the attacker** if identified (40% chance that a large attacker's role leaks through the banks [T]): Favor -15 globally, influence in that country halved, and the government may target the attacker's local assets (seizure of local subsidiaries, sanctions, lawsuits).

### 3.8.7 Currency crisis event chain

A currency crisis can start from an attack, from a sovereign default, or by itself when fundamentals rot.

1. **Pressure Builds** (event): fires when 3 of these hold: reserves under 3 months of imports, current account deficit over 4% of GDP, short-term foreign debt above reserves, inflation 5 points above target, stability under 40, the rate more than 15% overvalued against fair value.
2. **Speculative Attack**: AI hedge funds start selling; players may join, short local stocks, or rush to get money out.
3. **The Defense**: the central bank and government choose defenses (3.8.6). Each choice is a political event, and the companies it hits lobby (exporters want devaluation, importers and foreign-debt holders want defense).
4. **The Break** (or survival): devaluation or float; overshoot.
5. **Pass-through**: 30% of the devaluation passes into consumer prices over 6 months (50% for import-heavy economies) [T]; unrest rises in every province as real wages fall.
6. **Balance-sheet damage**: companies and governments with unhedged foreign-currency debt see it grow in local terms; rating agencies go to Watch; defaults follow (3.6.6, 3.6.7). The local stock market typically falls 20% to 40% in USD terms.
7. **Contagion**: currencies with a similar profile (same region, similar deficits, same peg anchor) get a GRG-style regional shock of +10 to +20 for 2 weeks [T].
8. **Political fallout**: stability -10 to -25; the government may fall, call elections, or (in fragile states) face a coup ([4-politics.md](4-politics.md) 4.8). An ISF program may impose new laws.
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
| ARS | Banco del Plata | Crawling peg | Captured | At will | 45 | n/a |
| COP | Banco de la República | Inflation (3%) | High | 4 years | 53 | 0% |
| CDF | Central Bank of the Congo | Inflation and the exchange rate | Low | At will | 1 | 0% |

**Independence levels** and their weight I (used in 3.9.3):

| Level | I |
|---|---|
| Full | 0.90 |
| High | 0.75 |
| Moderate | 0.50 |
| Low | 0.25 |
| Captured | 0.05 |

### 3.9.2 Policy rate decision rule

Central banks meet monthly, in the monthly calculation. Inputs come from the economy simulation: 12-month inflation (pi), the inflation target (pi*), the output gap (GDP versus trend, in %), unemployment (u) and its natural rate (u*).

**Step 1: the rule rate** (Taylor-like):

`r_rule = r*_real + pi + phi_pi x (pi - pi*) + phi_y x gap - phi_u x (u - u*) + phi_fx x dep3m + stress + hawk`

| Mandate | phi_pi | phi_y | phi_u | phi_fx | Notes |
|---|---|---|---|---|---|
| Inflation targeting | 0.8 | 0.3 | 0 | 0 | |
| Dual mandate | 0.5 | 0 | 1.0 | 0 | |
| Emerging inflation targeting (INR, BRL, MXN, ZAR, TRY, KRW, COP) | 1.0 | 0.2 | 0 | 0.3 | dep3m: % depreciation against USD over 3 months |
| Multiple (CNY) | 0.5 | 0.5 | 0 | 0.2 | Also follows government credit targets |
| Peg or currency board | Not used: r = anchor rate + peg spread (3.8.3) | | | | |

- **Neutral real rate** r*_real: USD 1.0%, EUR 0.0%, JPY -0.5%, GBP 0.5%, CHF -0.5%, emerging markets 1.5% to 3% [T].
- **stress**: when GRG is above 40, -0.25 points per 10 GRG points above 40 (cut to calm markets), except for emerging banks whose currency fell more than 5% in the month, which hike +0.5 instead [T].
- **hawk**: the board's average hawkishness. Each governor and board member is a character with a Hawk-Dove score from -10 (dove) to +10 (hawk); hawk = +0.1 points per point of average score [T]. Appointments matter.

**Step 2: the political blend**:

`r_final = I x r_rule + (1 - I) x r_gov`

- `r_gov` is what the government wants: r_rule minus pressure. Pressure: populist government -1.0; within 12 months before a national election -0.75; debt interest above 15% of revenue -0.5; a saver-friendly government (Liberals or Landites dominant, [5-ideology.md](5-ideology.md)) +0.25 [T].
- Lobbying the government moves r_gov (3.9.6).

**Step 3: smoothing**:

`r_new = r_old + clamp(0.4 x (r_final - r_old), -0.50, +0.50)`, rounded to the nearest 0.25 point; no change if the move would be smaller than 0.125 [T]. Never below the bank's lower bound.

**Emergency meetings** happen mid-month when GRG is above 60, the currency falls more than 10% in a week, or a bank run event fires. Moves of up to 1.00 point are then allowed; emerging banks defending a currency have no cap.

### 3.9.3 What the policy rate moves

- Savings and loan rates (3.6.5), margin interest (3.5.4).
- Bond yields through r_avg (3.6.5).
- Stock multiples through the R factor (3.3.1).
- FX fair value through the real rate differential (3.8.2), and carry trades.
- The economy (borrowing costs for growing business assets, industry demand), handled in [10-industry-economy.md](10-industry-economy.md).

### 3.9.4 QE, QT and lender of last resort

- **QE** starts when the policy rate is at the lower bound and either inflation is more than 1 point below target or GRG is above 50. The bank buys government bonds worth 0.5% to 1.5% of GDP per month [T].
  - Effects: term premium -0.1 point per 10% of GDP held (3.6.5); market sentiment +5 per month of buying; FX fair value -1% per 2% of GDP bought.
  - In severe crises (GRG above 70) QE can include corporate bonds, narrowing investment-grade spreads by up to 30%.
- **QT** (selling or letting bonds mature) runs when inflation is more than 1 point above target and the rate is above neutral: 0.3% of GDP per month, with the reverse effects.
- **Lender of last resort**: licensed banks (including a player's banking subsidiary if it holds a banking license) can borrow from the central bank at policy rate + 1% against collateral with haircuts of 5% (government bonds) to 30% (corporate loans) [T]. A bailout beyond that is a political decision ([4-politics.md](4-politics.md), F7 Bailout Policy).
- **Swap lines**: the Federal Monetary Board, the Eurozone Central Bank, the Nippon Monetary Authority, Threadneedle Bank, the Helvetic National Bank and the Dominion Bank of Canada share standing swap lines. Others must ask, needing relations of +50.

### 3.9.5 Expectations, guidance and surprises

- At each meeting the bank publishes a **guidance bias**: Hawkish, Neutral or Dovish (from the direction of r_rule minus r_new).
- Before each meeting the market forms an **expected rate** from the rule and the last guidance. The **surprise** is the actual decision minus the expected rate.
- Market reaction to a surprise of +1 point [T]: currency +2%, local stock indices -4%, 2-year yields +0.8 point, 10-year yields +0.3 point. Smaller surprises scale linearly.
- A board member who is your ally can tip you the decision a day early: trading on it is insider trading (3.10).

### 3.9.6 FX intervention and reserves

- Intervention rules follow the regime (3.8.3). Free floaters intervene only in disorderly markets; managed floats at the band edges; pegs and boards always.
- A bank will spend at most 10% of usable reserves per day unless defending a peg [T].
- **Sterilized** intervention leaves the policy rate unchanged; under a currency board intervention is never sterilized (rates spike automatically).
- **Reserve adequacy** = reserves / (3 months of imports + short-term foreign debt). Below 1.0 it is a Pressure Builds condition (3.8.7) and a rating penalty (3.6.3).

### 3.9.7 Independence, lobbying and capture

The central bank listens to the government in proportion to (1 - I). Players reach it in four ways:

| Route | How | Works best when | Risks |
|---|---|---|---|
| **Lobby the government** | Spend Political Capital (PC) in that country on "easier money" or "tighter money": each 10 PC moves r_gov by 0.05 point, up to +/- 1.5 [T] | Independence is Low or Captured | Little effect at Full independence |
| **Appointments** | When a governor's term or a board seat opens (yearly check), the government appoints from a shortlist; players lobby for a candidate with the Hawk-Dove score they want, or back an ally ([4-politics.md](4-politics.md)) | Any level; slow but lasting | Visible; a crony appointment costs credibility (-10) and the currency's fair value (-2%) |
| **Change the law** | Lobby for a lower (or higher) independence level, a Finance law ([4-politics.md](4-politics.md), F1 Central Bank Independence) | Weak institutions, friendly government | Lower independence: sovereign rating -1 notch, FX fair value -3%, term premium +0.3 point |
| **Direct schemes on board members** | Befriend, bribe or blackmail ([1-corporate-core.md](1-corporate-core.md) 1.1.8) to shift their Hawk-Dove score by up to 5 points | Any level | Bribery and blackmail are crimes; exposure is a scandal that also hits the currency |

Lobbying a Full-independence bank directly has a quarter of the normal effect and a 20% chance per attempt of a public backlash (Favor -5) [T].

**Capture** is the route to the Market Maker endgame ([4-politics.md](4-politics.md) 4.29): a player who has an ally as governor, a majority of board members as Friends, and independence at Low or Captured effectively sets the policy rate (r_final follows the player's choice within +/- 3 points of r_rule; beyond that inflation and the currency punish it).

---

## 3.10 Insider trading and manipulation

### 3.10.1 What counts

| Offense | What it is in the game | Typical source |
|---|---|---|
| **Insider trading** | Trading a security while holding material non-public information about it: unreleased earnings of a company where the trader is an insider (10%+ holder, director or executive), a planned takeover (other than by the bidder itself up to the first filing line), a central bank decision known in advance, a regulator's coming decision, a government contract award, the results of an espionage scheme | Board seats, allies in office, schemes |
| **Tipping** | Passing such information to someone who trades (a relative, a lover, a bloc ally) | Gossip, hooks |
| **Pump and dump** | Raising Buzz with false or bot-driven content (psyops) while selling | Psyops tools from [2-map-and-influence.md](2-map-and-influence.md) 2.5.7 |
| **Short and distort** | Shorting, then publishing false negative information | Short reports |
| **Spoofing** | Placing large fake orders to move the price, then cancelling (a player action "Paint the Tape": +/- 1% to 3% on one tick) | Manual action |
| **Wash trading** | Trading between your own entities to fake volume or set a closing price | Shells |
| **Undisclosed stake** | Failing to file at a threshold, or undisclosed concert action | Shells, swaps, informal blocs |
| **Cornering and squeezes with false information** | 3.5.3 and 3.7.6 | |
| **Rating agency bribery** | Paying an analyst for a better rating | Schemes |
| **Securities fraud** | Concealing a known issue in an IPO or report, cooking earnings | IPO due diligence, CFO schemes |

When a player order would use non-public information the game knows they have, the order screen shows a clear warning ("This trade uses inside information"). The choice stays with the player.

### 3.10.2 Detection

Each offense creates a **case** with a detection chance. Insider trades are checked once at the related news event (surveillance), and then for 26 weeks by a weekly background roll of 2% if the abnormal profit exceeded $1M (whistleblowers, journalists, a jealous rival). Ongoing offenses (pumps, spoofing, wash trading, undisclosed stakes) roll weekly while active.

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
| **Strictness** (regulator strictness 1 to 5 from 3.2.2) | x0.5, x0.75, x1.0, x1.25, x1.5; a regulator the holder has captured (Kingmaker influence with protection, [2-map-and-influence.md](2-map-and-influence.md) 2.5.10) x0.25 |
| **Concealment** (additive, capped at 70%) | Shell in a secrecy jurisdiction 30%; nominee account 15%; through swaps 10%; Freeport Night Market 40%; Intrigue of the planning character +1% per point above 10 (maximum 20%) |

A detected case starts the **investigation chain** of [4-politics.md](4-politics.md) and [13-events.md](13-events.md) (Subpoena, Discovery, Settlement or Trial). The accused gets the trait Under Investigation. General Counsel skill, the evidence level and political protection decide the outcome; settling is usually cheaper than losing at trial.

### 3.10.3 Penalties

| Outcome | Penalty [T] |
|---|---|
| **Civil settlement** | Disgorgement of the profit plus a fine of 1 to 3 times the profit; Favor -10 |
| **Director ban** | 1 to 10 years barred from board seats in that jurisdiction (and in strict jurisdictions abroad that recognize it). A banned CEO must step down: a CEO replacement event for the company |
| **Criminal conviction** (profit above $10M, repeat offenses, or fraud that caused a bankruptcy) | Prison 1 to 10 years. The character keeps assets but can only act through letters, hooks and delegates; their personal trusts are run day to day by a trustee they choose. Trait Blacklisted after release |
| **Company penalties** (corporate offenses) | Fine of 1% to 5% of annual revenue; trading suspension of 1 to 10 days; Q -0.10 for a year |
| **Exchange penalties** | Delisting for serious fraud (3.4.7); market access bans for shells and funds |
| **Cornering** | See 3.7.6 |

Favor hits range from -10 (civil) to -40 (criminal), and influence everywhere falls with Favor ([2-map-and-influence.md](2-map-and-influence.md) 2.5.6).

---

## 3.11 Worked examples

All companies, people and funds below are fictional. Numbers follow the formulas above and are rounded.

### 3.11.1 One tick, and what a big order costs

**Halcyon Robotics** trades on HDM (24 ticks a day) at P = $40.00. V = $46.00. Shares outstanding 250M, free float 150M, turnover 0.5% a day, so ADV = 750,000 shares and hourly volume about 31,250. Sector volatility 35%, so sigma_d = 1.83% and sigma_h = 0.37%.

**One tick.** Mkt = +10, Sec = +20, Buzz = 0, so V* = 46.00 x (1 + 0.015 + 0.020) = $47.61.
- pull = 0.0003 x (47.61 / 40.00 - 1) = +0.006%
- Archetypes net +8,750 shares (momentum buying after a good week): flow = 0.8 x 1.83% x 8,750 / 750,000 = +0.017%
- noise draw = +0.02%
- Total +0.043%: new price $40.02.

**A big order.** The player's company wants 3% of Halcyon: 7.5M shares, 10 times ADV.
- Permanent impact: 0.8 x 1.83% x 10 = about +14.6% by the end, whatever the method.
- At a 25% participation work order the player buys about 7,800 shares per tick, so 960 ticks, about 40 trading days. Slippage per fill: 0.5 x 0.37% x sqrt(0.25) = 0.09%.
- At 10% participation slippage falls to 0.06% per fill, but it takes about 100 trading days and the price may run away on news.
- Average price paid, roughly halfway up the permanent impact plus slippage: $40.00 x (1 + 0.073 + 0.001) = about $42.95. Total about $322M, a 7% premium over the naive $300M.
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

**Target**: Pellucid Grid, a utility on CBX. 200M shares at EUR 15.00 (market cap EUR 3.0B), V = EUR 19.00, book equity EUR 3.4B. The Lacroix family bloc holds 30%; index funds 18%; value funds (Graywater) 12%; hedge funds 5%; retail platforms 35%. ADV 1.4M shares (1% of float). Market cap is below book, so the **Undervaluation** casus belli is open. **Raider**: Varga Industrial (US), a known raider, with a Strategic synergy claim too.

1. **Weeks 1 to 6, under the radar.** A 25% work order buys about 350,000 shares a day. After 28 trading days Varga holds 9.8M shares (4.9%). Permanent impact 0.8 x 0.94% x 7 = +5.3%, plus a little pull: price about EUR 15.95; average cost about EUR 15.50.
2. **Crossing the first line (5%, France at F4 Standard).** Varga keeps buying through the 2-day filing window (legal) and files at 5.35% with **Active** intent. Reaction: +2% x 2 (known raider) = +4%, to EUR 16.60. Reservation prices +5%. Wolfsbane Capital buys 3% for merger arbitrage. Pellucid's board (on CBX no pills are allowed once an offer comes) starts a **white knight** search and lobbies the French government.
3. **Weeks 7 to 10, to 10%.** Market buying adds 7M shares; a block of 2.3M from Wolfsbane costs EUR 17.50 (P x 1.03; arbs sell blocks cheaply, while Graywater holds out for its reservation price). Varga crosses 10% at about EUR 17.25 and files: +3% x 2 = +6%, to about EUR 18.30, close to V. Varga is an **insider**: blackout before earnings, short-swing rule, and the right to nominate a director at the next annual meeting.
4. **The wall at 25% and 30%.** Market buying is now slow and expensive (the price is near V, so value funds sell into every rise). Crossing 25% triggers a **foreign investment review** (utility, foreign buyer): 4 to 8 weeks, decided by Varga's influence in France and diplomatic relations. Crossing 30% on CBX triggers a **mandatory bid** for all shares.
5. **Tender offer.** Varga skips the creep and launches a tender offer at EUR 22.00 for all shares, conditional on reaching 50% and on regulatory approval. Review approved after 6 weeks (Varga spent Political Capital and promised to keep jobs: an obligation event).
   - Acceptance: index funds (18%) tender if success looks likely; Wolfsbane and other arbs (8%) tender; Graywater's reservation is now about EUR 23.00 (V x 1.10 x 1.10), so it holds; retail platforms tender about half their shares at EUR 22. Projected: about 47%, short of 50%.
   - Varga raises to EUR 23.00. Graywater and more retail tender. **Final: 53%.**
6. **Control.** Varga's company is now Pellucid's **owner of record** with a majority on the books. With no figurehead or rival bloc in the way, it also becomes the **real controller** ([1-corporate-core.md](1-corporate-core.md) 1.3.1): Pellucid becomes its **vassal** and Varga appoints the CEO. The Lacroix bloc (30%) remains a powerful minority (above 25%, a **blocking minority** that can veto charter changes). Free float 17%, above CBX's 15% minimum, so no delisting.
7. **Cost**: about EUR 325M for the first 10%, plus about EUR 1.98B for 86M tendered shares at EUR 23.00: about **EUR 2.3B for 53%**, an average of about EUR 21.70 a share, 45% above the price when the raid began and 14% above V.

### 3.11.4 A margin call cascade breaks control

**Setup**: Aurelian Dynamics (60M shares, $50.00, market cap $3.0B). The player holds 18M shares (30%) personally; one of their personal trusts holds 9M (15%); an ally, a longtime Friend, holds 4.2M (7%). Together they are a 52% bloc led by the player (most shares). The player took a **stock-pledge loan** of $300M against their 18M shares ($900M): LTV 33.3%, under the 35% maximum.

| Day | What happens | Price | Collateral | LTV | Status |
|---|---|---|---|---|---|
| 1 | Scandal at Aurelian (-18%), then a market selloff (beta 1.2 x -6%) | $38.05 | $684.9M | 43.8% | Fine |
| 2 | Wolfsbane publishes a short report (-12%) | $33.48 | $602.6M | 49.8% | **Warning** (above 45%); the game auto-pauses |
| 2 close | Settlement price | $33.00 | $594.0M | 50.5% | **Margin Call**: restore to 40% by the next settlement, by paying down $62.4M or pledging $156M more |

**Day 2 evening, options:**
- The player has $20M in cash and pledges a $45M share of a real estate pool (counts $22.5M; homes are flavor only and cannot be pledged).
- The ally has $400M in cash, but a loan that size would give her a strong hook on the player; the player declines to ask.
- **Negotiate an extension**: Finance 12, under a scandal: 40% + 4% - 10% = 34%. It fails.
- Leak roll (20%): it leaks. Shock -5%, Wolfsbane adds shorts.

**Day 3**: price $31.35. After the $20M payment and the pool pledge, the loan is $280M against $564.3M + $22.5M = $586.8M: LTV 47.7%, still above the 40% the call demanded. The deadline passes: **forced sale** down to 40% LTV.

**The Block Auction**: the bank offers the shares as a block at a 10% discount ($28.20). Solving for the shares sold, with the price settling at $30.00 after the print: about **3.4M shares**.
- **If a rival wins the block**: the rival Morrow buys 3.4M (5.7%) and files at the first line. The player is left with 14.6M (24.3%); the bloc holds 24.3 + 15 + 7 = **46.3%: the majority on the books is lost**. The player is still bloc leader, and real control ([1-corporate-core.md](1-corporate-core.md) 1.3.1) now rests on the board and the ally staying loyal. Morrow, Graywater (8%) and an activist begin courting the ally.
- **If the personal trust bids**: the trust has $100M in cash and wins the auction at $28.20 ($96M). Trust 12.4M (20.7%) + player 14.6M (24.3%) + ally 7% = **52%: majority kept**. The player still leads the bloc, but the trust's cash is gone: the next call would find nothing left.

**Cascade**: the ally had a margin account too. At $30.00 her equity ratio falls below maintenance and she faces her own call. If she sells, the bloc falls under 50% again.

### 3.11.5 Taking a company through its debt

**Halberd Shipping** defaults after charter rates collapse. Capital structure: a $500M secured bank loan, $2.0B of senior unsecured bonds (6% coupon), 80M shares. Bonds trade at 35 cents.

1. The player's fund buys **$700M face for $245M**: 35% of the senior class, more than a third, so it can **block** any plan.
2. Management proposes a plan: enterprise value $1.4B; the secured loan is refinanced in full; seniors get 90% of new equity, old shareholders 10%. Senior recovery 40.5 cents. The player votes it down.
3. The player proposes its own plan, backed by Graywater (which holds 15% of the bonds):
   - Seniors get 88% of new equity; old shareholders get 2% (warrants, to avoid a fight in court).
   - The player provides $100M of new money for another 10% of equity.
4. Vote: the seniors approve (the player, Graywater and arbs reach two thirds by value). The court confirms after 8 weeks.
5. **Result**: player 35% x 88% + 10% = **40.8%**; Graywater 13.2%. Bloc: **54%: owner of record**, and with no rival bloc left the real controller too. Halberd becomes a vassal of the player's company. Equity value after emergence: $1.4B + $0.1B new cash - $0.5B secured debt = $1.0B, so the player's stake is worth about **$408M for $345M invested**, plus control. The old Halberd owner loses their flagship and becomes a new rival.

### 3.11.6 A lithium corner

**Setup**: LMH lithium carbonate, March contract. Deliverable stock in LMH warehouses at Rotterdam: 40,000 tonnes. Spot $12,000 (a later year, after the EV boom has lifted lithium well above its 2020 start). Position limit 25% = 10,000 tonnes per holder group.

1. The player's company and two shells each go long 10,000 tonnes of March (30,000 total, 75% of deliverable), average entry $12,400. Through the shells, the player also buys 15,000 tonnes of physical warrants at $12,300 (37.5% of warehouse stock).
2. Shorts (producers who hedged, and hedge funds) must deliver 30,000 tonnes, but only 25,000 tonnes are not the player's, and new metal from Chile takes 6 weeks to arrive. In the final week March rises to **$16,800** while April sits at $13,100.
3. **Regulator, unlinked view**: the largest known group holds 25% (12.5 points), warehouse share per known shell 12.5% (3.75 points), spread 28% (20 points): **CSS 36.25**. Inquiry letters go out; the linking roll is 25% x 1.25 (UK strictness 4) x (1 - 0.30 concealment) = **22% per week**.
4. **Outcome A, not linked** (about 61% over the two weeks): shorts close at $16,800. Futures profit 30,000 x $4,400 = $132M. Afterwards the physical stock is sold into the post-expiry glut at about $11,500: a $12M loss. Storage and financing $3M. **Net about +$117M.** A rival whose battery business lost money on its short hedges blames "speculators"; Buzz effects follow and that rival now holds the player as a Rival.
5. **Outcome B, linked**: the group now holds 75% (37.5 points) and 37.5% of warehouses (11.25 points) with the spread (20 points): **CSS 68.75**. Margin raised to 50% of notional and a liquidation-only order; if it reaches 80, emergency settlement at $13,000. Futures profit falls to $18M, the physical loss remains, and the investigation chain starts: fines up to 3 times the intended profit, trading bans for the shells and the head of the trading desk, Favor -20.

### 3.11.7 A carry trade unwinds

**Setup** (January 2020 values): yen borrowing at 0% (the policy rate is -0.10%, floored at 0 for borrowers), BRL 4.5%. USD/JPY 109, USD/BRL 4.02. The player borrows **JPY 21.8B** ($200M), converts to **BRL 804M**, and parks it in Brazilian money market funds. Collateral: 10% ($20M).

- Carry: (4.5% - 0%) / 365 x $200M = about $24,700 a day.
- After 120 days: BRL interest earned 804M x 4.5% x 120 / 365 = BRL 11.9M; no yen interest is owed. At unchanged rates the gain is about $3.0M.

**The shock**: a chokepoint closure and a bank failure push GRG from 20 to 45 in two days. **Carry Unwind** fires: AI funds close 30% of their carry books. USD/JPY falls to 102.8 (yen +6%); USD/BRL rises to 4.42 (real -9%).

- The position: BRL 815.9M / 4.42 = $184.5M = **JPY 18.97B**.
- The debt: **JPY 21.8B**.
- Loss: **JPY 2.83B, about $27.5M**: four months of carry gone many times over, in two days. The collateral ($20M) is not enough, so a margin call follows (3.5.4); if the player is forced to close in a hurry, slippage adds to the loss.

### 3.11.8 Attacking the Egyptian pound peg

**Setup** (the starting scenario's deliberately weak peg): EGP pegged at 16.00 per USD, band 15.84 to 16.16. Usable reserves $20B. Fair value 19.84 (the peg is 24% overvalued). Credibility 55. EGP policy rate 12.25%, USD 1.75%. Current account deficit 4% of GDP. GRG 30. The player's largest company is a Megacorp.

1. **The forward**: 3-month forward = 16.00 x (1 + 0.1225 x 0.25) / (1 + 0.0175 x 0.25) = **16.42**. If the peg holds, the player loses 16.42 / 16.00 - 1 = 2.6% of notional over 3 months: the carry cost.
2. **Days 1 to 3**: the player sells **$6B** of EGP forward through several banks (collateral at 10% = $600M) and runs a psyops campaign: "reserves are lower than reported" (credibility -8). Banks hedge 70%: $4.2B of spot selling reaches the band edge. Reserves fall to **$15.8B**. Credibility: 55 - 10.5 (21% of reserves lost) - 8 = **36.5**.
3. **Copycats**: at 13.5 points below 50, AI hedge funds add about $0.15B a day (scaled for EGP's thin market), and capital flight adds about $0.1B a day.
4. **Day 4, the defense**: the central bank hikes to 40% (credibility +5) and copycat flow halves for 5 days. Day 5: moderate capital controls (credibility -3); offshore NDFs now price 18.6.
5. **Days 6 to 20**: flows of $0.5B to $0.75B a day drain reserves to **$4.8B** (under 25% of the start); credibility falls to **19**. The government asks the ISF, but the program needs 2 weeks; the player lobbies the populist wing of the government to reject ISF austerity conditions.
6. **Day 21, the break**: break chance 25% + 5% = 30% a day; the peg breaks on day 21. The government floats. Overshoot = 5% + 0.5% x (50 - 19) = 20.5%: EGP jumps to 19.84 x 1.205 = **23.9**.
7. **The payoff**: with about 70 days left, the new forward (EGP rate now 45%) is 23.9 x (1 + 0.45 x 70 / 365) / (1 + 0.0175 x 70 / 365) = about **25.9**. Closing out: each dollar of notional now costs 16.42 / 25.9 = $0.634 to settle. **Profit about 36.6% of $6B = $2.20B**, less about $15M of psyops costs.
8. **Fallout**: Egyptian inflation rises by about 15 points over 6 months (30% pass-through of a 49% devaluation); stability -20; companies with dollar debt in Egypt default; GRG +10 regionally, putting pressure on other pegs with similar profiles. The player's role leaks (40% chance): Favor -15, influence in Egypt halved, and the Egyptian government moves to seize the player's local subsidiary. The player's own EGP assets lost a third of their dollar value.

---

## 3.12 Links to other systems

| System | What markets take from it | What markets give back |
|---|---|---|
| Companies ([1-corporate-core.md](1-corporate-core.md)) | Cap tables, blocs, charters, boards, two-layer control (1.3.1), takeover tools | Share prices, changes of owner of record from tenders, margin sales and restructurings |
| Trusts and accounts ([1-corporate-core.md](1-corporate-core.md) 1.10) | Personal trusts and accounts, account currencies | Portfolio values, margin calls, interest and dividends |
| Characters ([1-corporate-core.md](1-corporate-core.md) 1.1) | Finance, Persuasion and Intrigue skills; traits; schemes; Clout and Favor | Scandals, Under Investigation and Blacklisted traits, prison |
| Map and influence ([2-map-and-influence.md](2-map-and-influence.md)) | Influence, psyops, ad campaigns; news and Pdoomberg (2.22) | Influence from bond holdings and listed companies |
| Industry economy ([10](10-industry-economy.md)) | Earnings, industry supply and demand, trade balances, inflation, unemployment | Commodity prices, borrowing costs, FX-driven import prices |
| Politics ([4-politics.md](4-politics.md)) | Laws (regimes, controls, independence, disclosure), regulators, elections, stability | Defaults, currency crises and market crashes that topple governments |
| Events ([13-events.md](13-events.md)) | Event chains for IPOs, margin calls, defaults, crises, investigations | Triggers for those chains |

---

## 3.13 The trading experience

Time ticks hourly, and a player can hold hundreds of positions. The trading layer is built on three principles so that this never becomes tedious:

1. **Every order states its cost before it is sent**: slippage, impact, fees, taxes, disclosure crossings and trust rules are shown on the ticket.
2. **Standing orders and mandates do the hourly work.** The player sets plans; the market loop executes them tick by tick.
3. **The game auto-pauses only for what matters**: things the player asked to see, and things they must see.

### 3.13.1 The Markets screen

The Markets screen of [11-ui.md](../11-ui.md) 11.2 is split into panels. The panels shown by default follow company rank (3.1.4, 3.25.1).

| Panel | What it shows | Notes |
|---|---|---|
| **Watchlists** | Up to 10 lists of up to 50 instruments [T]. Columns: price, day change, estimated fair value and the gap to it (3.14.2), yield, short interest, Buzz, next event | Built-in lists: My holdings, My companies, Rivals' companies, and **Disclosure radar** (companies where any holder filed at the first line or more in the last 90 days) |
| **Chart** | Hourly bars (1 to 5 days), daily bars (1 month to 1 year), weekly bars (up to 10 years) | Overlays: the estimated fair value band, the headline index, event markers (earnings, filings, news), volume, short interest |
| **Order ticket** | The order and its preview: expected fill price, slippage and permanent impact (3.3.7), time to fill at the chosen participation, fees and transaction tax (3.24.3), estimated tax on a sale, margin effect, disclosure thresholds crossed and their deadlines, mandatory bid warnings, the inside information warning (3.10.1) | Nothing is sent until the player confirms the preview |
| **Positions** | Holdings by account (each personal account, personal trust, and company treasury the player controls): cost basis, realized and unrealized gains, currency exposure, margin headroom | Pledged and lent shares are marked |
| **Orders** | Open and standing orders with progress bars | Work orders show shares filled, average price and impact so far |
| **News feed** | Filtered news with source and reliability (3.14.4) | Filters: holdings, watchlists, sector, country, source tier |
| **Calendar** | Earnings dates, ex-dividend dates, annual meetings and record dates, central bank meetings, bond auctions, index rebalances, futures expiries and roll days, lock-up expiries, tender deadlines, elections | Any calendar item can become an alert |
| **Screener** | Filter all listed instruments by exchange, sector, gap to estimated fair value, dividend yield, rating, short interest, holder concentration, free float, Buzz | Saved screens can feed alerts ("tell me when a utility trades below book") |
| **Market overview** | GRG, headline indices, Retail Fever (3.15.1), cycle phase by country ([2-map-and-influence.md](2-map-and-influence.md) 2.18), yield curves, FX heat map, commodity curves, Funding Stress Index (3.21.3) | The one-glance view for large portfolios |

### 3.13.2 Accounts and who trades for whom

Every order is placed from one account and executed by one character (3.13.4).

| Account | Who decides | Who executes | Limits |
|---|---|---|---|
| The player's personal accounts and personal trusts | The player | The player character, a delegate trader, or the personal office CIO (3.18.3) | None (personal accounts and trusts are free-form) |
| Company treasury (a controlled company buying stakes, bonds or hedges) | The company's head, with board approval for a single trade above 10% of company value [T] | The CFO | The company's charter and covenants |
| Fund managed by a company the player controls | The fund's portfolio manager | The portfolio manager | Fund terms and fiduciary duty (3.18.5) |
| Other characters' accounts (allies, relatives) | Those characters (AI) | Themselves | The player can only advise, bribe or pressure them |

### 3.13.3 Order types

The five order types of 3.3.7 (market, limit, work order, block trade, tender offer) stay as they are. These are added:

| Order type | How it fills | Use |
|---|---|---|
| **Stop** (stop-loss) | Becomes a market order when the price trades at or through the stop | Cap a loss |
| **Stop-limit** | Becomes a limit order at the stop price | Cap a loss without selling into a crash |
| **Trailing stop** | A stop that follows the highest price since entry by a set % | Lock in gains |
| **Take-profit** | A limit order to sell at a target | Exit on a plan |
| **Bracket** | A take-profit and a stop on the same position; one filling cancels the other | Set and forget |
| **Auction order** (at the close, or at the 2 January reopening) | Fills at the 00:00 UTC daily close or in the 2 January reopening auction, at that price. No participation cap, but at most 10% of that tick's volume [T] | Cheap execution; index-style trades |
| **Scheduled order** | Buys or sells a fixed amount every day, week or month until cancelled or a total is reached | Savings plans, slow stake building, slow exits |
| **Threshold-capped order** | Any buy order can carry a cap such as "stop at 4.9%", counted over the whole holder group | Never cross a disclosure line by accident |
| **Conditional order** | "If these conditions hold, send this order." Up to 3 conditions joined by AND [T], on price, gap to estimated fair value, GRG, an index level, a filing, a news type, a rating, a date | Plans such as "buy Pellucid with a 10% work order if it falls below EUR 14 while GRG is under 30" |

**Rules for all orders**
- **Jumps**: a stop triggered by a jump (a news shock or the 2 January reopening) fills at the new price, not at the stop. Orders are frozen during halts.
- **Time in force**: Day, Good till date, or Good till cancelled (expires after 90 days) [T].
- Standing orders run in the hourly market loop as a market rule, like archetype flow (3.1.2). They are not AI decisions and cost no character hours.

### 3.13.4 Execution quality and character time

Placing an order costs no character hours: it is a call or a tap. Skill matters through **execution quality**.

- The executing character's Finance sets a multiplier on slippage (3.3.7):

  `ExecutionMultiplier = 1.3 - 0.02 x Finance`, clamped to 0.7 to 1.3 [T]

  Finance 5 gives x1.2; Finance 15 gives x1.0; Finance 25 gives x0.8. The Quant PhD education adds -0.02 per level on top [T].
- **Desk Session** (a ticked action of 1 to 8 hours): the character watches the markets.
  - Conditional orders that wait on news fire on the same tick as the news instead of the next tick.
  - Work orders adapt: participation drops to 5% on any tick where the stock moves against the order by more than one hourly standard deviation, and returns afterward [T].
  - Desk hours count as time in a matching role for skill experience ([1-corporate-core.md](1-corporate-core.md) 1.1.1).
- **Delegate traders**: any ally or employee with Finance 8 or more can be named trader for an account. A Greedy or Deceitful trader has a 1% monthly chance to front-run the account (costing 0.5% to 2% of the month's traded value) [T], a scheme the player can uncover with Head of Security checks or an audit.

### 3.13.5 Alerts and auto-pause

The game runs in pausable real time and auto-pauses on events and chosen alerts. Market alerts come in three tiers:

| Tier | Behavior | Examples |
|---|---|---|
| **Always stop** | Cannot be turned off | Margin warning and margin call; a disclosure filing on a company the player controls or holds 5% or more of; a bid or tender for such a company; a halt on a holding; a market-wide circuit breaker on an exchange holding 10% or more of the portfolio; a bank run on a bank that holds the player's deposits; any forced liquidation |
| **Stop by default** | On unless the player turns it off | A stop or conditional order filled; a work order completed; a holding moving more than 5% in a day; an earnings surprise on a holding; a rating change on a held bond; a central bank surprise of 0.25 points or more; an Unusual Accumulation alert (3.14.5); meme state on a holding (3.15.2) |
| **Notify only** | Logged in the feed | Watchlist moves, analyst rating changes, filings on watchlist companies, the daily close summary |

- **Batching**: fills and small moves while the game runs are gathered into one summary card shown at the next pause ("While you slept: 14 fills, 3 alerts, portfolio +1.2%").
- **Run until** gets market conditions: until a work order completes, until a stake reaches a given %, until a filing deadline.

### 3.13.6 The morning brief

Each day at 07:00 local time in the player character's current province [T], a one-screen notify-only card: moves since the last brief in the markets the player holds, portfolio change, today's calendar, open orders, the top 5 news items on holdings, margin headroom, and the month's cash needs (coupons, interest, distributions). It is the main way a player with a large portfolio follows markets without opening the Markets screen.

---

## 3.14 Information, research and analysts

This section links the information rules of [2-map-and-influence.md](2-map-and-influence.md) 2.22 to the markets: accurate prices, filings and financials are on the **Pdoomberg terminal**, the news reports them with its outlet's slant, and intel actions learn one secret at a time. The principle: the formulas run on the true fundamental value V; the player sees an estimate. The market as a whole (value funds act on the true V) is better informed than an uninformed player, so the player's edge comes from intel, patience, control and inside access, not from out-guessing the price formula.

### 3.14.1 What the player sees

| Information | On Pdoomberg (exact) | With intel or access |
|---|---|---|
| Prices, volume, indices, yields, FX rates | Exact and live (the news quotes them with a slant) | |
| Quarterly financials of listed companies | Exact at each report (unless the company cooks its books, 3.10) | |
| Holders at or above the first filing line | Filed names; shells show the shell's name | True owner through Investigate Shell |
| Short interest | Weekly total per stock | Who is short: prime broker access (3.17.1) or espionage |
| Fundamental value V | Never shown directly | Estimated fair value with an error band (3.14.2) |
| Analyst ratings and consensus | Yes (3.14.3) | |
| AI holders' reservation prices (3.4.9) | No | A range, after a meeting with the holder (Finance or Persuasion check) |
| Pending bids, defenses, scandals, central bank decisions | No | Inside information (3.14.6) |
| Private companies | No public numbers | One secret per successful intel action (2.22.2) |

### 3.14.2 Estimated fair value

- The player's **estimated fair value** of a company is `EFV = V x (1 + e)`. The error e is drawn once each quarter (at the earnings report) and kept until the next draw, uniform within plus or minus the error width.
- There is no intel level (batch 63). The error width is 15% for a listed company (its Pdoomberg filings and earnings calls) and 30% for a private one [T]. Each **secret** learned about the company's value this quarter halves the width; a board seat gives exact financials before publication (inside information). The band is shown, so the player knows how far to trust the number.
- **Ways to learn a secret about a company** [T]:

| Source | What it gives |
|---|---|
| Owning a bank or broker with a research desk that covers the company (3.17.1) | One secret a quarter, automatically |
| Research subscription | One secret a quarter on a company you name in one sector on one exchange, for $50k a month |
| A board seat | Exact financials before publication (inside information) |
| A meeting with the CFO or CEO | A Finance or Persuasion roll (instant once both are there) learns one secret |
| Espionage schemes ([1-corporate-core.md](1-corporate-core.md) 1.1.8) | One secret on success |
| Market research in the provinces where the company has assets (2.22.2) | As in 2.22.2 |

- **Disinformation** (2.22.2) shifts e by up to 15 points while the planted story lives, unless the player learned a secret on the company after it was planted.

### 3.14.3 Analysts and ratings

- **Coverage**: number of analysts = `2 + 4 x log10(market cap in $B)`, clamped to 0 to 30 [T]. A $1B company has 2, a $10B company 6, a $100B company 10, and small caps under about $300M none.
- Each analyst is a lightweight AI character at a named bank, with Finance 8 to 20. Their **target price** = V x (1 + error), where the error has a standard deviation of `25% - 0.75% x Finance` [T] (10% at Finance 20).
- **Sell-side bias**: +8% on the target if the analyst's bank underwrote the company's last offering or advises it on a deal [T].
- **Rating**: Buy if the target is 15% or more above P, Sell if it is 10% or more below, otherwise Hold [T]. The bias makes Buy the most common rating, as in real markets.
- **Consensus** earnings (used in 3.3.6) = the average of analysts' forecasts; each forecast = true forward earnings x (1 + half the analyst's error) [T].
- **Rating changes** at each quarterly refresh or news shock create Buzz: an upgrade +5 to +15, a downgrade -5 to -15 [T]. **Star analysts** (the top 10% by past accuracy) count double.
- Player actions: **Court the Analyst** (Persuasion; +5% on that analyst's target for a quarter); **Investor Day** (an event with the CEO and CFO: every covering analyst's error halves for a quarter, Buzz +5 on success); **Freeze Out** a hostile analyst (no access: their error doubles and they lean Sell; a news story if it leaks). Paying an analyst for a rating is bribery (3.10).

### 3.14.4 News feed and source reliability

Every news item has a source and a reliability, the chance that the story is true.

| Source tier | Examples (fictional) | Reliability [T] | Buzz multiplier |
|---|---|---|---|
| **Official** | Filings, exchange notices, central bank statements, court rulings | 100% | x1.0 |
| **Wire** | Meridian Wire, Ledger News | 95% | x1.0 |
| **Major paper** | The Atlantic Ledger, Financial Courier | 85% | x1.0 |
| **Trade press and newsletters** | Sector sites | 70% | x0.8 |
| **Tabloid and TV** | | 50% | x1.2 |
| **Forums and social** | Retail forums, finfluencers (3.15.3) | 30% | x1.5 (x2 in meme state) |
| **Anonymous leak** | | 40% | x1.0 |

- Rumors (3.3.6) carry a hidden truth flag. The player sees source and reliability; an intel action on the story learns its truth as one secret [T]. Pdoomberg and the in-game search are neutral; AI characters do not read the news.
- Planted stories (psyops, leaks) show the outlet they were placed in. Placing a story in a Wire or Major paper needs a media asset or a hook on an editor. A false story in an Official channel is securities fraud.
- **Owning media** (2.5.2) lets the owner run a true story early, late (up to 2 days) or never [T]. Spiking a story about one's own company is a scandal if it leaks.

### 3.14.5 Spotting a raider early

A careful player can notice a stake being built before anyone files at the first line.

- **Unusual Accumulation alert**: when any holder group's net buying in a stock exceeds 20% of ADV over 10 trading days, and the player holds or watches that stock, a weekly roll: chance = 20%, +10% per secret the player learned on the company this quarter, +20% if the player owns a broker or bank trading on that exchange, maximum 60% [T].
- Success shows "Someone is building a stake (estimated 2% to 4%)" with no name. A second success names the broker doing the buying; finding the broker's client needs an Investigate scheme.
- Stakes built through equity swaps (3.4.8) only show as unusual buying by the hedging banks: the chance is halved.

### 3.14.6 Inside information

- Inside information is a **knowledge item** held by a character: for example "Pellucid's Q3 earnings are 20% above consensus", "Varga will bid EUR 22 on 14 March", "the Federal Monetary Board will cut by 0.5". Each item names a security, a direction and an expiry (its publication).
- **Sources**: board seats and executive roles (automatic for their companies); deal teams (bankers and lawyers on a deal); central bank and regulator boards; allies in office ([4-politics.md](4-politics.md) 4.7.5); espionage and hacking ([17-hacking.md](17-hacking.md)); Lovers share an item with a 25% chance per week [T].
- A bidder trading for itself before its own first filing is not insider trading (3.10.1); telling a friend about it is tipping.
- **Leakage**: an item known to more than 5 characters has a 5% daily chance to reach the market as a rumor with a 70% truth flag [T]. Large deals therefore drift the price toward the news before the announcement, which is exactly what surveillance (3.10.2) looks for.
- The order warning of 3.10.1 appears whenever the account owner or the executing character holds a relevant item.

---

## 3.15 Retail investors, Retail Fever and meme stocks

### 3.15.1 Retail Fever

Each exchange has a **Retail Fever** score from 0 to 100. It starts at 40, or 60 on HSE, GXI and HRX [T], and updates daily.

| Driver | Change per day [T] |
|---|---|
| Headline index return over the last 20 trading days | +0.5 per 1% gained; -1.0 per 1% lost |
| A stock on the exchange enters meme state | +5 |
| Real policy rate below 0 | +0.1 per day |
| Stimulus payments to households (a government event) | +15 once |
| Crash day (headline index down 5% or more) | -15 once |
| Decay | 3% per day toward the exchange's starting level |

**Effects** [T]:
- Retail share of volume = base share (3.3.4) x (0.6 + Fever / 100). At 40 nothing changes; at 100 retail trades 1.6 times its base share; at 0, 0.6 times. Other archetypes' shares shrink or grow in proportion so the total stays 100%.
- IPO coverage (3.4.1) + 0.02 x (Fever - 40).
- Buzz decay (3.3.5) falls from 25% per day at Fever 40 to 15% per day at Fever 80 or more.

### 3.15.2 Meme stocks

A stock enters **meme state** when all of these hold [T]:
- Buzz of 60 or more for 3 trading days in a row,
- retail holds 25% or more of the free float,
- and at least one of: short interest of 15% or more, a named finfluencer promoting it (3.15.3), or Retail Fever of 70 or more.

**While in meme state** [T]:
- Retail D gets +0.4 and the retail panic rule (3.3.4) is off.
- Buzz decays 5% per day instead of 25%; forum news counts double.
- The pull toward V* (3.3.3) drops to a = 0.00006 per tick, a fifth of normal: fundamentals stop mattering for a while.
- Volatility triples. The squeeze test of 3.5.3 uses short interest of 15% instead of 20%.
- Value funds sell and short sellers pile in once P is above 2 x V, so meme stocks often end in a squeeze fight.
- The company may run an **at-the-market offering**: sell up to 10% new shares over 10 trading days at market with no discount, for a 3% fee [T]. Retail dislikes it: Buzz -20 on announcement.

**Meme state ends** when Buzz falls below 30, after 20 trading days without a new high, or when the price falls 50% from its peak. On exit the price falls 20% to 40% over 5 days as normal pull returns [T].

### 3.15.3 Finfluencers and forums

- **Finfluencers** are named AI characters with a follower count (10,000 to 20 million) and a Credibility score (0 to 100).
- A post backing a stock adds `Buzz = 5 x log10(followers / 10,000) x Credibility / 50` [T]. One million followers at Credibility 60 gives +12.
- The player character or an ally can become a finfluencer (followers grow with Persuasion checks on posts), or the player can befriend or pay one. **Paid promotion** is legal when disclosed (its Buzz is halved). Undisclosed paid promotion while the payer sells is pump and dump (3.10).
- Bot amplification (psyops, [2-map-and-influence.md](2-map-and-influence.md) 2.5.7) fakes forum momentum: Buzz as in 3.3.5, exposure as for psyops.

### 3.15.4 Retail brokers and the buying ban

- Retail orders pass through retail brokers, each with a market share of an exchange's retail flow.
- During a meme state the clearing house asks each retail broker for extra collateral equal to 2% of its clients' daily buying in the meme stock [T]. A broker short of cash may **restrict buying** in that stock: its clients' D on the stock is capped at 0. Squeezes stall; the broker's brand falls by 20 and a regulator hearing event follows.
- If the player owns the broker (3.17.1), this is the player's call, shown as an event with the clearing bill. Restricting buying while the player is short the same stock is the kind of conflict regulators and journalists live for.

---

## 3.16 Market cycles, bubbles and crashes

Markets and the business cycle of [2-map-and-influence.md](2-map-and-influence.md) 2.18 feed each other. The cycle phase sets the background for markets; market moves feed the cycle's hidden confidence value.

### 3.16.1 Cycle phase effects on markets

Each country's phase (2.18.1) applies to its exchange, its bonds and its currency. All values are [T].

| Phase | Market sentiment drift (per week) | GRG baseline contribution | Credit spread multiplier | IPO coverage | Game director's takeover orders (frequency; AI never buys on its own, batch 86) | VC and PE funding | Retail Fever drift (per week) |
|---|---|---|---|---|---|---|---|
| Expansion | +1 | 16 | x0.9 | +0.5 | x1.2 | x1.2 | +1 |
| Overheating | +2 | 15 | x0.8 | +1.0 | x1.5 | x1.5 | +2 |
| Contraction | -3 | 28 | x1.6 | -1.5 | x0.5 | x0.4 | -3 |
| Recovery | +1 | 20 | x1.1 | 0 | x0.9 | x0.8 | 0 |

- **GRG baseline**: the fixed baseline 18 in the GRG formula (3.3.5) becomes the GDP-weighted average of the "GRG baseline contribution" column across countries (18 at a typical mix of Expansion and Recovery). This is a change to 3.3.5.
- The credit spread multiplier applies to corporate spreads (3.6.5) on top of the risk factor.
- In Contraction, the rating agencies' pro-cyclical extra notch (3.6.4) applies whenever GRG is above 40 instead of 50.
- **Markets to the economy**: each 10% fall of the headline index over 3 months lowers confidence (2.18.1) by 5; each 10% rise raises it by 3. Credit spreads above x1.5 normal cut credit growth, a 2.18.1 driver.

### 3.16.2 Bubbles and manias

- Each sector on each exchange tracks **Froth** = sector market cap / sector sum of fundamental value (P over V, in aggregate).
- Froth above 1.3 for 3 months puts the sector in **Mania** [T]:
  - The sector sentiment weight in V* (3.3.3) rises from 0.10 to 0.50.
  - Sector sentiment decays 5% per day instead of 15%.
  - IPO coverage +2 for the sector; VC and PE funding x2 in the sector; Buzz decays at half speed.
- A Mania that lasts long enough to meet the **tech bubble** test of 2.18.3 (average P/E above 2.5 times its long average for a year) is the 2.18.3 crisis waiting to happen.
- **Popping**: a Mania pops on any of these triggers: a policy rate rise of 1 point or more within 6 months; a fraud exposed at a sector leader; an IPO in the sector falling 20% on its first day; or a monthly random chance of `3% x (Froth - 1) / 0.3` [T]. On popping, sector sentiment is set to -60 and its weight returns to 0.10; Retail Fever -20; the sector's g_sector is halved for 2 years, which cuts V. The 2.18.3 effects (sector -50% to -80% over 6 to 12 months, VC funding -70% for 2 years) arrive through these channels.
- Player angles: ride the momentum, IPO into the Mania for the best coverage, short too early and get squeezed, or buy the wreckage.

### 3.16.3 The liquidity spiral

Crashes are not scripted; they come out of the rules. One extra rule makes them self-feeding [T]:
- While GRG is above 50: brokers raise all margin requirements (3.5.4) by 10 points; lenders recall 30% of lent shares (shorts get bought in); market makers absorb only 10% of imbalance (as in 3.3.4); and new bond issues below BBB find no buyers.
- Forced sales from these rules hit the flow term (3.3.3), push GRG higher through volatility, and can feed bank runs (3.21). Central bank emergency meetings (3.9.2) and short bans (3.5.1) are the brakes.

---

## 3.17 The financial sector as a business

### 3.17.1 Business lines

A financial company is a normal company ([1-corporate-core.md](1-corporate-core.md)) in the Finance valuation group (3.3.2) with one or more **business lines**. Its banking and finance business units ([10-industry-economy.md](10-industry-economy.md) 10.0) earn revenue in their industry's world market; the business lines below are the market-side activities on top of that. Each needs a license (3.17.2) and regulatory capital. All values are [T].

| Business line | License (regulator, [4-politics.md](4-politics.md) 4.9.1) | Minimum capital | Main revenue | Main risk | Special power |
|---|---|---|---|---|---|
| **Commercial bank** | Banking license (Banking Supervisor) | $250M national; $25M community bank in one city or region | Net interest margin: loans at the 3.6.5 rates, deposits paid at policy rate - 1.5 (floor 0); account fees | Loan losses in a Contraction; bank runs (3.21) | Cheap deposit funding for the group; lending gives creditor leverage over borrowers ([10-industry-economy.md](10-industry-economy.md) 10.0.9); access to the central bank (3.9.4) |
| **Investment bank** | Securities dealer license (Securities Regulator) | $100M | Underwriting spreads (3.4.1, 3.4.3), bond fees (3.6.1), M&A advice at 1% of deal value (0.5% above $5B), trading desk | Failed deals, trading losses, leaks | Hired on IPOs and deals; sees deal flow (inside information, 3.14.6); research desk (+20 intel on covered companies) |
| **Broker** (retail or prime) | Broker license (Securities Regulator) | $20M retail; $200M prime | Commissions of 0.02% of value traded (retail: zero commission, paid 0.005% for order flow); margin lending at the 3.5.4 rates against funding at policy rate + 0.5; half of securities lending fees | Client defaults in crashes; meme-stock clearing bills (3.15.4) | Sees its clients' aggregate flow and short positions (intel); controls the lendable shares in its clients' margin accounts; can restrict trading |
| **Asset manager** (index and active funds) | Fund manager license (Securities Regulator) | $5M | Fees on assets under management: index 0.05%, active 0.75% | Outflows after poor performance | Votes the shares its funds hold (3.18.2) |
| **Hedge fund manager** | Fund manager license | $5M | 2% of assets plus 20% of gains above the high-water mark | Redemptions in a drawdown; prime broker margin calls | Outside money as a raid war chest (3.18.4) |
| **Private equity firm** | Fund manager license | $10M | 1.5% of committed capital plus 20% of profit above an 8% hurdle | Buyouts with too much debt | Leveraged buyouts with fund money (3.19.4) |
| **Venture capital firm** | Fund manager license | $2M | 2% of committed capital plus 20% of profit | Most startups fail | Board seats in startups; first look at Venture-rank rivals (3.19.3) |
| **Insurer** | Insurance license (Banking Supervisor) | $200M | Premiums minus claims; investment income on the float | Disasters, climate events and pandemics | The float is a permanent pool of money to invest |
| **Exchange operator** | Exchange license (Securities Regulator plus government approval) | $500M | Trading fees of 0.002% per side; listing fees (3.2.2); market data at 10% of trading fees | Outages, hacks, capture backlash | See 3.17.5 |
| **Rating agency** | Agency registration (Securities Regulator) | $10M | 0.05% of rated debt at issue, plus $100k to $1M a year per issuer | Credibility collapse | See 3.17.6 |

A banking or insurance subsidiary ([1-corporate-core.md](1-corporate-core.md) 1.7.4) that obtains a full Banking license may take public deposits and becomes a commercial bank; without one it only lends inside its group.

### 3.17.2 Licenses

- **Application**: an event chain with the national regulator. Time [T]: bank 26 weeks, insurer 20, exchange 52, the others 8 to 12.
- **Approval chance** = `60% + 2% x (proposed CEO's Finance - 10) + 10% if the parent has Power Broker influence in the country - exposure with that regulator / 2 (points) - 20% if the owner is foreign and C1 is Screened or stricter` [T]. On failure, reapply after 6 months.
- **Fit and proper test**: every director and the controlling holder is checked. A Blacklisted character or a director ban (3.10.3) blocks approval.
- **Change of control**: acquiring 10% or more of a licensed financial company needs the regulator's approval (4 to 12 weeks) on top of the disclosure rules. Until approval, votes above 10% cannot be used [T].
- Licenses can be suspended or revoked in the investigation chain ([4-politics.md](4-politics.md) 4.9.5).

### 3.17.3 The bank balance sheet

Each bank keeps a simple balance sheet, updated monthly with its financials and checked daily during a crisis.

- **Assets**: cash and central bank reserves; government bonds (held to maturity, or held for trading); loans (mortgages, company loans, consumer loans); other assets.
- **Liabilities**: insured deposits, uninsured deposits, wholesale funding (short-term loans from other banks and funds), bonds, and equity.

| Ratio | Formula | Minimum [T] | If breached |
|---|---|---|---|
| **Capital ratio** | Equity / risk-weighted assets. Weights: cash and home government bonds 0%, mortgages 35%, consumer loans 75%, company loans 100%, equity stakes 250% | 10%; 12% for systemically important banks ([4-politics.md](4-politics.md) 4.9.8) | Below the minimum: dividend ban and an order to raise capital within 3 months. Below 6%: resolution by the Banking Supervisor (bail-in, sale or nationalization) |
| **Liquidity ratio** | Liquid assets (cash, government bonds at market value) / (25% of uninsured deposits + wholesale funding due within 30 days) | 100% | Supervisor order; Run Pressure +10 (3.21.1) |
| **Group lending** | Loans to group companies / all loans | 25% | Exposure +5 per month (4.9.3) |

- **Deposits** come from the provinces where the bank has branches. Deposit share is driven by brand, the rate offered and branch count. **Deposit insurance** covers each depositor up to $250,000 (or the local equivalent) [T].
- **Loan losses** each year = the borrowers' default chance (by rating, 3.6.2, times the cycle multiplier of 2.18.1) x (1 - recovery).
- **The held-to-maturity trap**: bonds held to maturity are carried at cost. When rates rise their market value falls, but the loss stays hidden until the bank has to sell. In a run, sales turn hidden losses into real ones at once (example 3.26.1).
- Bank shares are valued by the book method (3.3.1 step 5).

### 3.17.4 Investment bank tiers and league tables

- The three tiers of 3.4.1 (Bulge bracket, Major, Boutique) apply to player banks too. Tier is set yearly by the **league table**: the rank by fees earned over the last 3 years from underwriting and advice [T]. Global top 6: Bulge bracket; top 20: Major; others: Boutique. Minimum capital: Bulge $10B, Major $1B [T].
- Using your own bank on your own deal keeps the fees in the group, but investors see a conflict: IPO coverage -0.5 [T].
- **Chinese wall**: bankers on a deal hold inside information. The owner's characters get no knowledge item from the bank's deals unless they sit on the deal team. Asking for one is the scheme **Breach the Wall** (Intrigue; detection base 25% per use, as insider trading) [T].

### 3.17.5 Owning an exchange

- Each of the twelve exchanges is a listed company, except HSE and NJX, which are state-controlled [T]. A single holder group may hold at most 20% of an exchange's votes unless the government approves more (a lobbyable decision) [T].
- **Powers of a controlling holder**, within the regulator's limits: set trading fees (0 to 0.01%); compete for listings with lower fees and, once a year, one step of softer listing rules within what the national law allows (for example allowing dual-class shares where C4 permits); launch new boards and indices (a small-cap growth board, a sector index); decide when new products launch (index futures, options).
- **Peek at the Book**: the exchange sees every order. Using this for the owner's own trading halves its slippage [T]; it is a crime with a detection base of 15% per quarter, and conviction costs the exchange license.
- Owning a global exchange is one route to the Market Maker endgame ([4-politics.md](4-politics.md) 4.29).

### 3.17.6 Owning a rating agency

- Each of the three agencies (3.6.2) is a listed company and can be bought.
- The owner can **tilt** ratings: move the agency's personality offset (3.6.4) by up to 1 notch for chosen issuers. Each tilted issuer costs the agency 5 **Credibility** per year (0 to 100, start 80) [T].
- Markets weight each agency's rating by Credibility / 80 when forming the average rating; below Credibility 40, index and fund eligibility ignore the agency.
- Rating the owner's own companies above their implied rating is a conflict of interest: regulator suspicion +10 per issuer; if exposed, Credibility -30 and securities fraud cases against the issuers.

---

## 3.18 Funds, asset management and the personal office

### 3.18.1 Family trust trading rules

Removed (batch 116): there is no family trust. Money sits in the character's own personal trusts and accounts, which are free-form and have no trust rules.

### 3.18.2 Investing through funds

Any account can buy fund units instead of picking securities. All values are [T].

| Fund type | Examples (fictional) | Fee per year | Liquidity | Return |
|---|---|---|---|---|
| **Index fund** | Monolith Atlantic 500, Vanguardian Globe 1000 | 0.05% | Daily | The index, minus the fee |
| **Active stock fund** | Graywater Value, Kinetic Quant | 0.75% | Daily | The benchmark plus the manager's alpha |
| **Bond fund** | Investment grade, high yield, emerging markets | 0.2% to 0.6% | Daily | The bond index |
| **Hedge fund** | Wolfsbane Capital, Meridian Arb, Parallax Systematic | 2% plus 20% of gains | Quarterly, 45 days' notice, 1-year lock-up | Low link to the market; wide spread of outcomes |
| **Private equity fund** | Ironwood Capital | 1.5% plus 20% of profit above 8% | Locked 10 years; capital called over the first 4 | Buyout returns (3.19.4) |
| **Venture fund** | Northpass Ventures | 2% plus 20% of profit | Locked 10 years | Very wide spread of outcomes |
| **Real estate fund** | Lion REIT Index members | 0.5% | Daily (listed) | Rents and the property cycle (2.16.5) |

- **Returns**: named funds are entities in the ownership graph and earn what their holdings earn. Unnamed fund products use `benchmark + alpha + noise`, with yearly alpha before fees of -1% for a Finance 10 manager rising to +2% at Finance 20 [T]. Most active funds trail their index after fees, as in the real world.
- **Benefits**: no character hours, no slippage for the investor, diversification, and no disclosure (the fund holds the shares and files, not the investor).
- **Costs**: fees, lock-ups and gates, and no votes (the manager votes).
- **The votes of managed money**: an asset manager votes all shares its funds hold. Index managers follow Civic Proxy Advisers (3.3.4) by default. A manager sets a **stewardship policy**: Follow the Adviser, Management-Friendly, or Activist [T]. A player who controls a large index manager can swing proxy fights across hundreds of companies, but any vote that clearly serves the controller against the fund's investors is self-dealing (3.18.5).

### 3.18.3 The personal office

- A **personal office** is a company held by one of the character's personal trusts that manages their money (it replaces the old family office, batch 116). It unlocks when the character's personal trusts are worth $100M or more [T].
- **Setup**: 4 weeks; running cost $2M a year plus 0.1% of assets managed [T]. The office hires a **CIO** (Chief Investment Officer) character, who is the executing character for its trades (3.13.4).
- **The mandate**, set by the owner:

| Setting | Choices |
|---|---|
| Target allocation | Sliders by asset class (stocks, bonds, cash, real estate, commodities, private markets, funds) and by region and currency |
| Risk limits | Maximum drawdown before cutting risk; maximum single position; leverage cap |
| Do-not-touch list | Control stakes and positions the player trades by hand |
| Rebalancing | Monthly, quarterly, or when an allocation drifts 5 points |
| Conduct line | **Clean** (no shells); **Grey** (shells for tax); **Dark** (Freeport and inside information allowed). Grey and Dark add exposure as usual |

- The CIO acts on the mandate weekly (an AI decision on the weekly cadence) and uses standing orders in between. A monthly report card shows return against a benchmark of the same allocation, fees, and the main trades.
- **CIO risks**: a Greedy CIO may skim (1% chance per month of 0.5% to 2% of assets) [T]; a Brave CIO tends to run near the risk limits, a Cautious one far below them; a CIO who holds the owner as a Rival or Nemesis can be turned by a rival's scheme and leak the owner's positions.
- The personal office can also hold the owner's private investments, angel stakes and fund commitments, and can later apply for a fund manager license to take outside money (3.18.4).

### 3.18.4 Starting a fund

A company with a fund manager license can launch funds with outside money.

- **Fundraising** is an event chain like the VC pitch chain of [1-corporate-core.md](1-corporate-core.md) 1.6.2: prepare a pitch book (instant), meet allocators (pension funds, endowments, sovereign funds, funds of funds; each meeting an instant roll), receive commitments.
- **Commitment chance per meeting** = `15% + 1% per point of yearly outperformance over the last 3 years (maximum +20%) + 2% x (lead manager's Finance - 10) + 10% if the allocator holds the manager as Friend (-10% if Rival) - 10% under a scandal` [T]. A first fund typically raises $50M to $500M.
- **Terms** (hedge funds): fees as in 3.18.2; a 1-year lock-up; quarterly redemptions with 45 days' notice; a **gate** of 25% of the fund per quarter; a high-water mark [T]. PE and VC funds use 10-year locked commitments.
- **Flows** after the first year: quarterly net flow = `2 x (fund return - benchmark return over 12 months)`, clamped to -25% (the gate) and +50% [T]. A drawdown of more than 20% from the fund's peak adds redemption requests of 30% of assets [T]. Redemptions force selling, so a raiding fund that loses money can be pushed out of its stakes at the worst moment.
- The fund's holdings count toward the manager's holder group for disclosure (3.1.1): a player cannot hide a stake by putting it in their own fund.

### 3.18.5 Self-dealing and fiduciary duty

Managing other people's money creates new offenses, added to the list in 3.10.1 and handled by the same detection and penalty rules (3.10.2, 3.10.3).

| Offense | What it is | Detection base [T] |
|---|---|---|
| **Self-dealing** | Using a fund's or client's money or votes to benefit the controller: buying the controller's assets at inflated prices, voting fund shares for the controller's bid against the fund's interest, dumping losses into a fund, propping up the controller's own company | 10% per quarter; 40% at any investor lawsuit or audit |
| **Front-running clients** | Trading the controller's accounts ahead of a client's or a fund's orders | 10% per use |

- Extra penalties: return of the money to the fund, license suspension, and investor flight (assets under management -50%).
- An **investor lawsuit** event fires when a fund loses 30% or more while holding assets linked to the controller.

---

## 3.19 Private markets

### 3.19.1 Private stakes

- Shares of unlisted companies trade only through negotiation events. The event shows the seller's ask, the buyer's estimated fair value (3.14.2) and the options.
- **Seller's reservation price** = seller's estimated fair value x (1 + 10% if the block carries 25% or more of the votes, or + 25% if it carries control) x tag factor (x0.8 for a Friend, x1.3 for a Rival; a Nemesis refuses) [T].
- **Illiquidity discount**: buyers price private minority stakes 20% to 35% below a listed equivalent; more for non-voting class N shares [T].
- **Transfer restrictions**: right of first refusal (an existing charter clause, 1.5) plus two new optional charter clauses [T]:
  - **Drag-along**: a seller of 50% or more can force the minority to sell on the same terms.
  - **Tag-along**: minority holders can join any sale of control on the same terms.
- A deal takes 1 to 4 weeks of due diligence and a meeting between the buyer's executing character and the seller.

### 3.19.2 Secondaries

- **Founder and employee secondaries**: a Venture-rank company ([1-corporate-core.md](1-corporate-core.md) 1.7.5) can let early holders sell part of their stake to new investors before an exit, at a discount of 10% to 40% to the last round price (deeper in a Contraction) [T]. A founder selling more than 10% of their stake signals doubt: the next round's valuation -10% [T].
- **Fund secondaries**: commitments in PE and VC funds can be sold to secondary buyers at a discount to the fund's reported value: about 5% in an Expansion and 30% in a Contraction [T]. This is how a cash-strapped trust escapes a 10-year lock.
- **Grey shares** of private and delisted companies trade anonymously on the Freeport Night Market (3.2.5) at discounts of 30% to 60%, with its usual risks.

### 3.19.3 Angel and venture investing

- Any character with spare cash can invest as an **angel**, and a company with a fund manager license can run a VC firm (3.17.1).
- **Deal flow**: each month 0 to 3 pitches arrive from AI startups (Venture-rank rivals) [T], more with presence in tech cities (Metros or city provinces with Tech perks, [2-map-and-influence.md](2-map-and-influence.md) 2.3.5), the investor's Clout and the VC firm's brand. A pitch is a short event: deck quality, sector, asking valuation, the founder's visible traits, and the estimated fair value range.
- **Outcomes** are rolled at each later funding round: 40% raise at a higher valuation, 30% flat or down round, 30% fail [T], modified by founder skills, sector Mania (3.16.2) and the cycle phase (3.16.1). Winners can IPO (3.4.1) or be sold.
- A lead investment carries a **board seat**: votes, factions and inside information.
- Stakes in rival startups let the player watch, slow or absorb competitors, for example by pushing a sale to the player's company with a drag-along or board pressure, at the risk of a founder grievance and lost Clout in the startup scene.

### 3.19.4 Leveraged buyouts

This expands leverage in [1-corporate-core.md](1-corporate-core.md) 1.10.3 into full buyouts.

- **Target**: a listed company (tender offer, 3.3.7, and going private, 3.4.7, with a premium of at least 20%) or a private one (negotiation).
- **Financing stack** [T]:

| Layer | Maximum, as a multiple of the target's EBITDA | Rate | Notes |
|---|---|---|---|
| Senior secured loan | 4x (3x in a Contraction) | Policy rate + 3.5%, floating | Covenant: net debt / EBITDA tested quarterly |
| High-yield bonds or private credit | +2x (+1x in a Contraction) | Policy rate + 6% to 9%, fixed | |
| Equity from the fund and co-investors | At least 30% of the price | | |

  Total debt is capped at 6x EBITDA in an Expansion or Overheating, 5x in a Recovery and 4x in a Contraction [T].
- **Value levers** during ownership (company actions): cost cuts (operating costs -10%, with unrest and union events, 2.8.6); sale of non-core assets; **dividend recap** (borrow up to the debt cap to pay the fund a dividend; rating -1 notch); add-on acquisitions; a management incentive plan (the CEO gets 5% to 10% of the equity; CEO loyalty +20).
- **Exit** after 3 to 7 years: IPO, sale to a strategic buyer, or sale to another fund. The exit price follows the sector multiple and the cycle phase.
- **Risks**: floating-rate senior debt hurts when rates rise; a recession can break the covenant and start the default chain (3.6.6), in which the creditors take the company.
- **Management buyout**: the player can take a listed company they control private (escaping quarterly reports, activists and disclosure) with the minority vote rule of 3.4.7.

---

## 3.20 M&A deal mechanics and merger arbitrage

### 3.20.1 Deal structures

| Structure | How it works | Approvals | Typical time |
|---|---|---|---|
| **Cash tender offer** | 3.3.7 and [1-corporate-core.md](1-corporate-core.md) 1.9.3 | Target holders tender; regulators | 4 to 12 weeks; financing must be committed |
| **Merger by vote** (friendly) | The boards sign a merger agreement; the target's holders vote | Target vote (majority, or two thirds where the charter says so); acquirer vote if it issues 20% or more new shares; regulators | 3 to 6 months |
| **Stock-for-stock** | Target holders receive acquirer shares at an **exchange ratio** | As for a merger | 3 to 6 months |
| **Mixed** | Part cash, part shares | As for a merger | 3 to 6 months |

**Deal terms** [T]:
- **Collar** (stock deals, optional): the ratio adjusts if the acquirer's price moves more than 10% either way.
- **Break fee**: the target pays 2% to 4% of deal value if it walks away for a better offer.
- **Reverse break fee**: the acquirer pays 4% to 7% if regulators block the deal or its financing fails.
- **Topping bids** must be at least 3% above the current offer. In a friendly deal the first bidder has **matching rights**: 5 trading days to match.
- **Go-shop** (optional): a 30-day window in which the target may look for better offers, with the break fee cut to 1%.

**Control check for paying in shares.** Issuing shares dilutes the acquirer's controlling bloc. The deal screen shows the bloc's vote share after the deal; a bloc that would fall under 50% makes the acquirer contested ([1-corporate-core.md](1-corporate-core.md) 1.3). Controlling blocs therefore often pay in cash, or mix cash and shares to stay above the line (example 3.26.3).

### 3.20.2 Deal odds

The market's estimate of deal success, p, sets the target's price after a bid (3.3.6) and drives arbitrage. Recalculated daily [T]:

`p = 0.90 - 0.20 if hostile - 0.10 if a foreign investment review applies - 0.10 if financing is not committed - 0.10 if a target bloc of 30% or more opposes + 0.05 if the break fee is 3% or more`, clamped to 0.30 to 0.95.

News moves p: a regulator's second request -0.05, an agreed remedy +0.05, a bloc defection +/- 0.10, a rival bid (see 3.20.3).

### 3.20.3 Merger arbitrage

- **Spread** = (offer value - P) / P. In a cash deal the target trades at `p x offer + (1 - p) x P_standalone` (3.3.6), so the spread pays for bearing the risk that the deal breaks.
- In stock deals, arbitrageurs buy the target and short the acquirer at the exchange ratio. Their shorting pushes the acquirer down by about 1% to 3% over the life of the deal [T].
- The player can run the same trade. Payoffs are lopsided: a small gain if the deal closes, a large loss if it breaks (the target falls back to its standalone price, usually 15% to 40% lower).
- A **rival bid** sets off a contest: the target trades near the higher offer weighted by the chance that someone pays it.
- Arbitrageurs are swing holders (3.4.9): a player holding 5% or more of a target through arbitrage can sell to the highest bidder or tip a contested vote.
- Foreign acquirers face a foreign investment review ([4-politics.md](4-politics.md) 4.9.6); a second request adds 3 to 6 months. AI companies never bid on their own (batch 86); how often the game director orders a takeover follows the cycle (3.16.1).

---

## 3.21 Financial crises and contagion

### 3.21.1 Run Pressure

Every bank and every fund with prime broker leverage has a **Run Pressure** score (RP, 0 to 100), checked daily. RP is the sum of these drivers, then multiplied, then clamped to 0 to 100 [T].

| Driver | RP |
|---|---|
| Capital ratio below its minimum | +20 (+35 below 8%) |
| Liquidity ratio below 100% | +10 |
| Unrealized bond losses above 50% of equity, once published in a quarterly report | +15 |
| A rating downgrade in the last month | +5 per notch |
| Share price down 30% or more in a month | +15 |
| Buzz on the institution below -40 | +10 (+20 when Retail Fever is 70 or more: panic spreads faster online) |
| GRG above 40 | +0.5 per point above 40 |
| A peer failed in the last 30 days (same country or same business model) | +15 |
| Central bank liquidity line drawn | -10 |
| New capital raised, or a guarantee from a strong parent, in the last 7 days | -15 |
| Government guarantee of all deposits | -40 |
| **Multiplier**: uninsured deposits above 50% of deposits | x1.5 |

### 3.21.2 Bank runs

- At RP 50 or more a **Bank Run** event fires. Each day, uninsured deposits and wholesale funding leave at `(RP - 40)%` per day, at most 50% [T]. Insured deposits leave at a fifth of that rate.
- The bank pays out from cash first, then must find money:

| Option | Effect |
|---|---|
| Draw the central bank window (3.9.4) | Borrow against collateral at policy rate + 1%, with haircuts of 5% (government bonds, at market value) to 30% (company loans); RP -10 |
| Sell assets | Government bonds at market value (turning hidden losses into real ones, 3.17.3); loans at a fire-sale discount of 20% to 40% [T] |
| Raise emergency capital | A rights issue at a 40% to 60% discount (3.4.3), a white knight investor, or the owner's personal trust; RP -15 |
| Seek a buyer | **Shotgun Merger** event: a stronger bank offers 10% to 30% of last week's share price, often with a government guarantee on losses. The run ends on announcement |
| Request a bailout | [4-politics.md](4-politics.md) 4.9.8 |
| Suspend withdrawals | Only under a government emergency decree or Hard capital controls: a bank holiday of up to 5 days; unrest +5 in the provinces where the bank has assets |

- The run ends when RP falls below 30. If cash and borrowing capacity run out first, the bank **fails** and goes to resolution under F7 and C5 (4.5.4, 4.5.3): bail-in, nationalization, a forced sale or liquidation.
- The player's own deposits at a failing bank are uninsured above the limit like anyone else's. Pulling them out early on knowledge of the bank's state is trading on inside information.

### 3.21.3 Contagion

| Channel | How it spreads | Values [T] |
|---|---|---|
| **Counterparty losses** | Creditors of a failed institution (interbank loans, bonds, derivatives, prime broker claims) lose at expected recovery (3.6.6: senior 40%) | Booked immediately |
| **Fire sales** | Forced sellers dump the same assets; every other holder marks down | Through the flow term (3.3.3) and bond depth (3.6.1) |
| **Confidence** | A major failure: GRG +15 (3.3.5) and RP +15 for peers | |
| **Funding freeze** | The **Funding Stress Index** (FSI, the interbank rate minus the policy rate) rises; bank loan and margin rates add the FSI; above FSI 1.5 only half of wholesale funding rolls over | `FSI = 0.1 + 0.02 x max(0, GRG - 30) + 0.5 per major failure in the last 30 days`, in points; the failure term decays 10% per day |
| **Prime broker failure** | Client funds' assets are frozen for 4 to 12 weeks unless held in segregated accounts (an option when opening the account, costing 0.25% a year) | Funds with frozen assets cannot meet margin elsewhere and become forced sellers |
| **Sovereign-bank loop** | Banks hold their own government's bonds: a sovereign downgrade cuts bank capital, and a bank bailout raises sovereign debt | As in 3.6.7 and [4-politics.md](4-politics.md) 4.11.8 |

### 3.21.4 The Financial Panic chain

**Trigger**: two or more systemically important institutions ([4-politics.md](4-politics.md) 4.9.8) fail or need bailouts within 30 days, or FSI stays above 2.0 for 5 days [T].

1. **Panic** (global or regional event): GRG +20; market sentiment -30 on affected exchanges; Retail Fever -30; credit spreads x2; no new bonds rated below BBB and no IPOs while it lasts; brokers raise margin requirements by 10 points.
2. **Credit crunch**: bank lending to companies -30%; loan approval chances -20%; contraction chance +40% per month in affected countries (a 2.18.1 driver).
3. **Policy response** (AI governments and central banks, open to lobbying): emergency rate cuts (3.9.2); QE including corporate bonds at GRG 70 or more (3.9.4); swap lines; blanket deposit guarantees (RP -40); short-selling bans (3.5.1); bailouts (4.9.8); closing an exchange for up to 5 trading days after a one-day index fall of 20% or more; capital controls in weak countries.
4. **Resolution**: the panic ends when FSI is below 0.5 and GRG below 35.
5. **Aftermath**: the Bank Failure crisis effect on law support ([4-politics.md](4-politics.md) 4.5.10) applies; regulator zeal +0.2 for 12 months (4.9.2), the post-crisis crackdown.

**Player angles**: buy a failing bank for pennies with a government guarantee; short the weak (and risk a short ban); lobby for bailouts that cover your own exposure; or become too important to fail (F7 Too Big to Fail) and dare the government to let you go.

---

## 3.22 Derivatives: scope decision

The derivatives in scope for the first full release:

| Instrument | Status | Where | Notes |
|---|---|---|---|
| Commodity futures | In | 3.7.3 | |
| FX forwards and NDFs | In | 3.8.5 | |
| Equity swaps (cash-settled) | In | 3.4.8 | Through banks |
| Securities lending | In | 3.5.1 | |
| **Index futures** | In (new) | Headline index of each of the twelve exchanges | Cash-settled quarterly. Price = index x e^((r - dividend yield) x T). Margin 8% of notional [T]. The cheap way to hedge a whole portfolio or short a whole market. Index arbitrage passes 50% of net futures flow into the index stocks as flow [T] |
| Listed options on stocks and indices | Later | 3.5.6 | |
| **Credit default swaps** | Later (outline) | Over the counter through banks | Pays face minus recovery if the issuer defaults; premium = the issuer's spread (3.6.5). Hook: an **empty creditor** who holds bonds plus more protection gains from a default, so it votes against restructurings. Risk: the bank that sold the protection may fail first |
| Interest rate swaps | Abstracted | | Companies choose fixed or floating debt instead: fixed costs 0.3 points more but ignores rate rises [T] |
| Exotic options, structured credit, volatility products | Out | | Too fiddly for the scope; their crisis role is played by bank losses (3.21) |
| Event contracts | Not in the market layer | Phone tab ([9-gambling.md](9-gambling.md)) | Prediction markets live in the phone tab (batch 116) |

---

## 3.23 Crypto and cyberpunk finance

Crypto is **not part of the market layer** (batch 116): coins, stablecoins, token offerings and crypto trading live in the phone tab's gambling system ([9-gambling.md](9-gambling.md)), where coins go up and down randomly in boom and bust cycles (9.3). Only corporate scrip stays here.

### 3.23.1 to 3.23.3

Removed (batch 116): the Ledgerbit model and token offerings moved to the phone tab ([9-gambling.md](9-gambling.md)) or were cut.

### 3.23.4 Corporate scrip

- A company may pay up to 30% of wages in **company scrip**, redeemable only at its own stores and housing [T]. This is legal only in Charter Zones (C6) and corporate sovereign territories ([4-politics.md](4-politics.md) 4.12); elsewhere it is a labor law offense.
- Effects [T]: the cash cost of the scrip part of wages falls 10% to 20% (the company keeps the retail margin when scrip is spent); unrest +3 per 10% of wages paid in scrip; workers leave half as often (scrip cannot be spent elsewhere).
- Company scrip is the small-scale ancestor of Arcology Scrip (ASC, 3.8.1): when a corporate sovereign city founds its monetary authority, its scrip converts into ASC.

### 3.23.5 and 3.23.6

Removed (batch 116): stablecoins and crypto exchanges are not in the market layer; see [9-gambling.md](9-gambling.md).

---

## 3.24 Taxes on trading and investing

Tax rates come from the laws of [4-politics.md](4-politics.md) (E1 income, E2 corporate, E3 capital gains, E4 inheritance and gift, F6 trusts and foundations). This section says how they apply to market activity.

### 3.24.1 Who pays where

| Holder | Taxed in | Gains | Dividends and interest |
|---|---|---|---|
| Character (personal account) | Country of residence ([2-map-and-influence.md](2-map-and-influence.md) 2.21.1) | E3 rate | E1 rate |
| Personal trust | Country of registration | By F6: Opaque untaxed; Recognized at the E3 rate; Transparent at the E1 rate; Deemed Disposal taxes all gains every 21 years | Same as gains |
| Company | Home country | Profit at the E2 rate. **Participation exemption**: gains and dividends on stakes of 10% or more held for a year are exempt [T], so vassal tribute is not taxed twice up the chain | Same |
| Shell company | Haven rate 0% to 5% ([1-corporate-core.md](1-corporate-core.md) 1.7.4) | Exposure as usual | Same |
| Fund | Not taxed itself | Investors pay when they sell their units | |

### 3.24.2 When gains are taxed

- **Realized gains only**, charged in the monthly calculation after the sale [T]. Unrealized gains are untaxed, except under F6 Deemed Disposal and the E4 Inheritance and Gift Tax.
- **Short-term rule**: where E3 is Low or Moderate, gains on positions held under 12 months are taxed at the E1 rate instead [T]. This is a new detail of the E3 law, to be mirrored in [4-politics.md](4-politics.md).
- **Losses** offset gains in the same account in the same year; unused losses carry forward without limit [T].
- **Wash sale rule** (wherever E3 is not Exempt): a loss does not count if the same security is bought back within 30 days [T].
- **Death**: when an AI rival dies, their holdings pass silently to a game-generated heir (batch 116) at market value as the new cost basis, and E4 applies [T]. The player character's death ends the game.
- **Carried interest** (fund performance fees, 3.17.1) is taxed at the E3 rate [T].
- **Exit tax**: a character who moves residence with unrealized gains above $10M pays E3 on them to the old country [T].

### 3.24.3 Transaction taxes

Stamp duties and transaction taxes, loosely based on the real exchanges [T]:

| Exchange | Tax |
|---|---|
| CLX | 0.5% on purchases |
| CBX | 0.3% on purchases of large caps (market cap above EUR 1B) |
| VHX | 0.1% on each side |
| GXI | 0.1% on each side |
| HRX | 0.15% on sales |
| HSE | 0.05% on sales |
| ATX, HDM | A regulatory fee of 0.003% on sales |
| ESE, LCX, PSX, NJX | None |

- A depositary receipt (3.2.4) pays the tax of the exchange where the receipt trades.
- Bonds, FX and futures carry no transaction tax.
- The order ticket shows the tax (3.13.1). On CLX, building a 10% stake costs half a percent more than on ATX, a real input into where raiders hunt.

### 3.24.4 Withholding and treaties

- Dividend withholding (15% by default, 3.4.6) is credited against the holder's home tax where the two countries have a tax treaty (relations of +25 or more, or allies) [T]; otherwise it is a pure cost.
- Holding through a shell in a treaty haven cuts withholding to 5% [T], with exposure as usual.

---

## 3.25 Markets by company rank

What markets are for grows with the rank of the player's largest company ([1-corporate-core.md](1-corporate-core.md) 1.7.5), as politics does in [4-politics.md](4-politics.md) 4.28. Nothing here is locked.

### 3.25.1 What markets are for at each rank

This table adds to 3.1.4.

| Rank | Role of markets | Typical positions | Tools that come into play | Market threats | Screen focus |
|---|---|---|---|---|---|
| **Venture** (< $10M) | Learning, funding and valuation more than trading. The public market is a mood that sets VC appetite | $10k to $5M in personal accounts and trusts; the founder's own stake | Watchlists, charts, stop and bracket orders, scheduled and conditional orders, index and bond funds, news feed, calendar, morning brief, founder secondaries (3.19.2), angel investing (3.19.3) | Losing your savings; a friend's tip that turns out to be inside information; a Mania popping (VC funding -70%); down rounds | A simple portfolio view, the cap table and private valuation |
| **Company** ($10M to $250M) | Control: building stakes, defending them, IPOs, margin | Control stakes from $5M to $250M | Unusual Accumulation alerts (3.14.5), analyst tools, threshold-capped orders, desk sessions, the personal office (3.18.3), private stakes, small buyouts, merger deals (3.20) | Raiders, margin cascades, bloc defections, activists | Holdings tree with live prices, the disclosure radar, margin headroom |
| **Corporation** ($250M to $5B) | Markets as an industry: owning financial companies, cornering, FX, buyouts | Hundreds of millions to a few billion, in many currencies | Financial companies (3.17), fund launches (3.18.4), PE buyouts (3.19.4), index futures (3.22), merger arbitrage | Financial panics, redemptions forcing sales, coordinated shorts by rivals | Market overview with cycles, GRG, FSI and your systemic links |
| **Megacorp and Conglomerate** (> $5B) | Markets as a lever of state power | Positions that move currencies | Exchange ownership (3.17.5), rating agency control (3.17.6), systemically important status (Too Big to Fail), corporate scrip into Arcology Scrip (3.23.4) | Nationalization, coordinated crackdowns, every rival uniting, a panic you caused coming home | A world view of currencies, central banks and your systemic exposure |

### 3.25.2 Market rivals by rank

AI rivals scale with the player's rank. In markets:

| Player's rank | Typical market rivals | Their moves |
|---|---|---|
| Venture | Other young traders and rival founders; rival startups' VCs; incumbents' venture arms | Tips that are traps; outbid rounds; strategic offers with rights of first refusal |
| Company | Raiders ([2-map-and-influence.md](2-map-and-influence.md) 2.23.1), activists, short sellers such as Wolfsbane | Creeping stakes, short reports, proxy fights |
| Corporation | Rivals' personal offices and funds; sovereign funds | Coordinated block purchases, white knight alliances, rating and media games |
| Megacorp and Conglomerate | Coalitions of rivals, governments, central banks | Peg defenses aimed at the player, sanctions, nationalizations, bear raids on the flagship |

### 3.25.3 Pacing targets

- **Venture**: markets take under 10% of play time [T]: the morning brief and a few orders a week.
- **Company**: stake fights are hour-by-hour moments (desk sessions, block trades, filings), with the clock running in between.
- **Corporation and above**: mandates, the personal office and fund managers do the routine work; the player steps in on alerts and crises.

---

## 3.26 Worked examples for the new sections

All companies, people and funds below are fictional. Numbers follow the formulas above and are rounded.

### 3.26.1 A run on the player's bank

**Setup.** The player controls **Coldwater Bank** (US, rated A). Balance sheet: assets $40B: cash $2B, government bonds $18B held to maturity (bought when 10-year yields were 1.5%, duration about 7), company loans $12B and mortgages $8B. Liabilities: insured deposits $10B, uninsured deposits $24B (mostly startups and funds), wholesale funding $2B, equity $4B.

- Risk-weighted assets: $12B x 100% + $8B x 35% = $14.8B. Capital ratio 4 / 14.8 = **27%**, far above the 10% minimum.
- Yields have since risen 3 points. The bonds' market value is down about 7 x 3% = 21%: a **hidden loss of $3.8B**, 95% of equity.

**Trigger.** The quarterly report publishes the unrealized loss (+15 RP). A data and AI Mania has just popped and startup depositors are burning cash. Wolfsbane publishes a short report: Buzz -45 with Retail Fever at 72 (+20). The share price is down 35% in a month (+15). RP = (15 + 20 + 15) x 1.5 (uninsured deposits are 70%) = **75**. **Bank Run.**

**Day 1.** Outflow: 35% of uninsured deposits and wholesale funding ($8.4B + $0.7B) and 7% of insured ($0.7B) = **$9.8B**. Cash covers $2B; $7.8B is needed by the close.

| Choice | Result |
|---|---|
| **A. Sell bonds** | Raising $7.8B at 79% of book means selling $9.9B of bonds and realizing a $2.1B loss. Equity falls to $1.9B (capital ratio 13%, still legal), but the news triggers a 2-notch downgrade (+10 RP) and the market now sees the $1.7B still hidden. RP climbs to 90; day 2 demands 50% of the remaining uninsured deposits. The bank fails on day 3 |
| **B. Central bank window** | Bonds at market value ($14.2B) with a 5% haircut give $13.5B of borrowing capacity. Borrow $7.8B at policy rate + 1%. No loss is realized; RP falls to (50 - 10) x 1.5 = 60. Day 2 outflow: 20% of the remaining $15.6B uninsured and $1.3B wholesale, plus 4% of insured deposits: about $3.8B, also borrowed. Capacity left: $1.9B. A real fix is needed by day 3 |

**Day 3 (after choice B).**
- **Personal trust injection**: a $3B rights issue at a 50% discount, bought by the player's personal trust. RP falls to (50 - 10 - 15) x 1.5 = 37.5: withdrawals stop, and the run ends once the share price driver fades and RP drops under 30. But the trust needs $3B in cash today, and pouring it in leaves the player with nothing if the run resumes.
- **Shotgun merger**: Sterling Crane & Co offers 15% of last week's share price, with a government guarantee on loan losses. The run ends at once; the player is paid a fraction of their stake's old value and loses the bank.
- **Bailout request** ([4-politics.md](4-politics.md) 4.9.8): Coldwater's assets are 2.7% of a $1.5T economy, so it is systemically important: weekly chance 30% + 15% + 10% (Bailout with Stakes) = 55%. But the first weekly decision may come too late for a run measured in days.

**Contagion if it fails.** GRG +15; every US bank with more than half its deposits uninsured gets RP +15; FSI +0.5. Two more failures within 30 days would trigger a Financial Panic (3.21.4).

### 3.26.2 A leveraged buyout of Brightwell Foods

**Target.** Brightwell Foods, listed on CLX (Agriculture). EBITDA GBP 400M; 300M shares at GBP 8.00 (market cap GBP 2.4B); net debt GBP 600M. The UK is in Expansion; the policy rate is 4%. The buyer is the player's PE fund, Kessane Capital.

**Price and financing.**
- Offer: a 30% premium, GBP 10.40 a share: GBP 3.12B for the equity, plus GBP 0.60B to repay existing debt, plus fees of 2% (GBP 74M) and CLX stamp duty of 0.5% (GBP 16M): **GBP 3.81B in total**.
- Senior loan 4x EBITDA = GBP 1.6B at 7.5%; high-yield bonds 2x = GBP 0.8B at 11%. Total debt 6x, the Expansion cap.
- Fund equity: GBP 1.41B (37% of the total, above the 30% minimum).
- Interest: GBP 120M + GBP 88M = GBP 208M a year. Coverage 400 / 208 = 1.9. Implied rating B (6.0x leverage) minus a notch for coverage below 3: **B-**.

**Five years of ownership (base case).**
- Cost cuts add GBP 60M of EBITDA (a strike event at two plants, settled). EBITDA grows 3% a year: (400 + 60) x 1.16 = **GBP 533M** in year 5.
- Free cash flow of about GBP 120M a year repays GBP 600M: debt falls to GBP 1.8B.
- Exit at 8x EBITDA: enterprise value GBP 4.27B, equity GBP 2.47B. The fund turns GBP 1.41B into GBP 2.47B: **1.75 times its money**, about 12% a year.
- Kessane's take: management fees of 1.5% on GBP 1.5B committed for 5 years (GBP 112M), and carry of 20% of the GBP 1.06B profit (GBP 212M), since the 8% hurdle (GBP 2.07B) is cleared.

**Recession branch.** In year 2 the UK enters Contraction: EBITDA -20% to GBP 368M and the policy rate rises 2 points, adding GBP 32M of interest on the floating senior loan. Coverage falls to 368 / 240 = 1.5; net debt (GBP 2.28B after a year of repayment) / EBITDA is 6.2x against a 6.5x covenant. One more bad quarter starts the default chain (3.6.6). Kessane can inject GBP 150M of new equity (an equity cure), pay a waiver fee, or let the creditors take Brightwell.

**The controller angle.** Selling Brightwell's business units to the player's own companies below market would help the player and hurt the fund's investors: self-dealing (3.18.5), detection 10% per quarter.

### 3.26.3 Merger arbitrage on a mixed deal

**The deal.** Aster Semiconductor (HDM, $60, 200M shares) bids for Lumen Photonics (80M shares, $24 before the bid). Aster's founding family bloc holds 56%.

- **Control check**: paying 0.5 Aster shares per Lumen share would issue 40M new shares, and the bloc would fall to 56 x 200 / 240 = 46.7%, making Aster contested. The founders structure a **mixed offer** instead: **$15 cash plus 0.25 Aster shares** (20M new shares; the bloc stays at 56 x 200 / 220 = 50.9%).
- **Deal odds**: 0.90 - 0.10 (a Lumen plant triggers a foreign investment review in Korea) + 0.05 (3.5% break fee) = **p = 0.85**.
- Arbitrage shorting drops Aster 1% to $59.40, so the offer is worth $15 + 0.25 x 59.40 = **$29.85**. Lumen trades at 0.85 x 29.85 + 0.15 x 24 = **$28.97**. Spread: 3.0%.

**The player's trade.** Buy 2M Lumen at $28.97 ($57.9M) and short 0.5M Aster at $59.40 ($29.7M), matching the 0.25 ratio. If the deal closes, the player receives $30M in cash plus 0.5M Aster shares that close the short: profit $30M + $29.7M - $57.9M = **$1.8M**, 3.0% in about 5 months. The 2.5% stake is below the first filing line (5% under US F4 Standard).

**What happens.**
1. **Second request** from the Korean investment review: p falls to 0.80; Lumen dips to $28.68. Paper loss $0.6M.
2. **Topping bid**: Corvane Holdings offers $32 in cash (7% above the current offer, more than the 3% minimum). Aster has 5 days of matching rights. It raises the cash part to $17.50; Aster's own holders dislike the higher price and Aster falls 2% to $58.20, so the offer is worth $17.50 + 14.55 = $32.05. Corvane walks away.
3. **Close**: the player receives 2M x $17.50 = $35M plus 0.5M Aster shares to close the short. Profit $35M + $29.7M - $57.9M = **$6.8M**, 12% in five months.

**Had the deal broken** (regulators block it): Lumen receives a 5% reverse break fee ($1.50 a share of cash) and falls to about $25.50; Aster rises 2% back to about $60.60. The loss: 2M x ($28.97 - $25.50) + 0.5M x ($60.60 - $59.40) = **$7.5M**. Arbitrage wins small and often, and loses big and rarely.

---

## 3.27 Assumptions

New assumptions introduced by this document, to confirm or change:

1. **Twelve exchanges** (ATX, HDM, CLX, CBX, ESE, HSE, VHX, GXI, HRX, LCX, PSX, NJX) plus the Freeport Night Market are enough for the first full release; Frankfurt, Toronto, Sydney and others are folded into these or added later.
2. **Each exchange simulates 30 to 120 companies** in full, with a rest-of-market basket per sector for indices and sentiment.
3. **Every market trades 24/7** and ticks every hour, closing only on 1 January (3.1.0), so time zones and daylight saving time do not affect trading.
4. **Trades settle the same day** at the daily close (no T+1 or T+2 delay).
5. **Fictional names** are used for exchanges, banks, funds, rating agencies, central banks and the ISF, while countries, cities and currencies are real.
6. **Archetype order flow is a market rule run hourly**, not an AI decision; named AI holders still decide weekly.
7. **Disclosure lines**: the first line (2% to 10%) is set by each country's F4 law; the 10%, 25% and 50% lines are the same everywhere; jurisdictions otherwise differ only in deadlines and in whether derivatives count (3.4.8).
8. **Mandatory bid rules** exist on most non-US exchanges at the levels given in 3.2.2, in addition to the disclosure lines.
9. **Poison pills** are allowed only on ATX, HDM, HRX and ESE; CLX, CBX and LCX apply board neutrality.
10. **Ratings and spreads are market beliefs**; real defaults only happen when an issuer cannot or will not pay out of its simulated cash flow.
11. **Starting values** (prices, rates, reserves, ratings) are loosely based on January 2020, adjusted for the alternate history (EUR 0.95, a weaker ruble), and tuned by a per-country calibration offset; they are not meant to be exact.
12. **The EGP starts on a hard peg, overvalued by 24%**, as a deliberate crisis seed in the default scenario, even though the real pound floated; ARS starts on a crawling peg with a parallel rate.
13. **One fictional currency** is added as a cyberpunk accent: Arcology Scrip (charter-city currency in the endgame). Crypto (Ledgerbit, stablecoins) lives in the phone tab ([9-gambling.md](9-gambling.md)), batch 116.
14. **The USD is the numeraire** for FX modeling; displayed rates follow real market quoting conventions.
15. **Central banks meet monthly** (not 8 times a year), with emergency meetings allowed mid-month.
16. **Options are a later feature** with only the outline in 3.5.6.
17. **Regulator strictness** is a 1 to 5 value per country that scales detection; it can change through laws and capture.
18. **The player always sees a warning** before an order that uses inside information the game knows they hold.
19. **Freeport Night Market** access requires a shell company and is always on, with no regulator but raid and fraud risk.
20. **Market tools are grouped by company rank** as listed in 3.1.4; nothing is locked.
21. **Standing orders run in the hourly market loop** as a market rule, cost no character hours, and are not AI decisions; skill shows through execution quality (the executing character's Finance scales slippage) and Desk Sessions (3.13).
22. **Market alerts have three tiers**, and the "always stop" tier (margin, filings and bids on the player's companies, halts, runs, forced sales) cannot be turned off; a morning brief arrives at 07:00 in the player character's province (3.13.5, 3.13.6).
23. **The player never sees V directly**, only an estimated fair value whose error starts at 15% for listed and 30% for private companies and halves with each secret learned (2.22, 3.14.2).
24. **Analysts are lightweight AI characters** with a sell-side bias, and their consensus feeds earnings surprises (3.14.3).
25. **Inside information is tracked as knowledge items** held by characters, which leak as rumors once more than 5 characters know (3.14.6).
26. **Retail Fever** per exchange scales retail volume, and **meme state** is a defined stock state; retail brokers can restrict buying during it (3.15).
27. **The GRG baseline follows the global business cycle** instead of the fixed 18 in 3.3.5 (a change to 3.3.5); cycle phases set sentiment drift, spreads, IPO coverage and funding appetite (3.16.1).
28. **Manias** are sector states driven by a Froth ratio; their popping is the market side of the 2.18.3 tech bubble crisis (3.16.2).
29. **The financial sector is playable** through ten licensed business lines, from commercial banks to rating agencies; a banking subsidiary with a full banking license becomes a commercial bank (3.17.1).
30. **Banks keep a simple balance sheet** with capital and liquidity ratios and held-to-maturity bonds carried at cost (3.17.3).
31. **Exchanges and rating agencies can be owned**: exchanges with a 20% single-holder vote cap unless the government approves, agencies with a Credibility score that tilting erodes (3.17.5, 3.17.6).
32. Removed (batch 116): there is no family trust, so no trust trading rules.
33. **A fund's holdings count toward its manager's holder group** for disclosure, the manager votes them, and misuse is the new offense of self-dealing (3.18.2, 3.18.5).
34. **The personal office** unlocks when the character's personal trusts reach $100M and runs a mandate through a CIO character on the weekly cadence (3.18.3).
35. **Drag-along and tag-along** are proposed new optional charter clauses, to add to 1.5 of [1-corporate-core.md](1-corporate-core.md) (3.19.1).
36. **LBO debt limits follow the cycle phase**: 6x EBITDA in Expansion and Overheating, 5x in Recovery, 4x in Contraction (3.19.4).
37. **Deals have break fees, reverse break fees, matching rights and a 3% minimum topping increment**, and the market prices them with the deal odds formula of 3.20.2.
38. **Bank runs are checked daily** through Run Pressure; contagion runs through counterparty losses, fire sales, confidence, the Funding Stress Index and prime broker failures; two systemic failures in 30 days start a Financial Panic (3.21).
39. **Derivatives scope**: index futures are added at launch; options and credit default swaps come later; interest rate swaps are abstracted as a fixed or floating debt choice; exotics and structured credit are out (3.22).
40. **Crypto is in the phone tab** ([9-gambling.md](9-gambling.md)), not the market layer (batch 116); corporate scrip is legal only in Charter Zones and corporate sovereign territories.
41. **Taxes apply to realized gains only**, with a short-term rule, wash sale rule, step-up at death, participation exemption for companies, and per-exchange transaction taxes (3.24). The short-term rule is a new detail of the E3 law that should be mirrored in [4-politics.md](4-politics.md).
42. **Company rank shapes the role of markets**, with the pacing targets of 3.25.3.
43. **Disclosure lines** (decided by Logan, 2026-10-16): F4 Securities Regulation in [4-politics.md](4-politics.md) only sets the first public filing line (10% under Lax, 5% Standard, 3% Strict, 2% Draconian). The 10%, 25% and 50% lines and their effects are the same in every country.
