# TechnoCapital20FF pivot spec: a trader's desk on a simulated America

Version 0.1 (2026-11-10). From Logan's interview of 2026-11-10. This spec governs all new systems. [mvp-spec.md](../mvp/mvp-spec.md) still governs the inherited economy, company and price formulas unless a section here replaces them. Code comments cite sections of this document as `pivot N.N`.

Values marked **(T)** are tuning values: they live in data tables or named constants and are set during the build, with each choice logged in `docs/build/decisions.md`.

## 1. The game

### 1.1 Premise
The player is a private trader in the USA. They advance time, read what is published, bet on politics in a prediction market and trade stocks. Everything else in the world happens without them.

### 1.2 Loop
Advance time, read, look things up, place bets and trades, advance time.

### 1.3 What the player cannot do
The player does not own, run or influence companies, campaigns or officials. The player may hold at most `PLAYER_MAX_STAKE` = 5% of any company's shares. Influence (donations, control, takeovers) is a later expansion; systems are built so it can be added.

### 1.4 Scope
Only the USA is simulated: its companies, stocks, voters and government. The rest of the world exists only as one supplier block per industry (section 4.2).

### 1.5 Build order
Politics and the prediction market first (sections 5 to 12). Stocks trade at formula prices with price-taker fills (13.1) until then. The deep stock market (13.2 onward) follows.

## 2. Time

### 2.1 Tick
One tick is one game hour, as in mvp-spec 4.

### 2.2 Controls
Pause, resume, step one hour, and speeds up to `SPEED_MAX` = about one game day per real second **(T)**. There is no year-skipping in play.

### 2.3 Job cadence
Hourly, Daily, Monthly, quarterly and Yearly slots are kept. A **Weekly** slot is added (Monday 00:00).

### 2.4 Auto-pause
Time pauses on any alert the player has set to pause (section 14.4) and always on:
1. a fill or resolution of the player's own order or contract;
2. a margin call on the player;
3. 00:00 on a federal general election day;
4. a scandal, roll call or resolution that names a person, bill or company the player holds a position on.

Each fixed pause can be switched off in settings except 1 and 2.

## 3. Starting a game

### 3.1 Play starts in 2020
Every game begins on 2020-01-01. The hand-built 2020 world is retired.

### 3.2 Pre-history
Each game's 2020 is made by running the 1995 world forward 25 years under a random hidden scenario (1995-rework-spec) at **Coarse** fidelity (3.3). The result is a full history the player can look up: presidents, laws, companies, district maps.

### 3.3 Fidelity
The world carries `fidelity`, Coarse or Full.

| System | Coarse (1995 to 2020) | Full (2020 on) |
|---|---|---|
| Economy, companies, prices | as today | as today, then section 13 |
| Counties, census, redistricting | yes | yes |
| Careers, XP, deaths | yes | yes |
| Vote count | at once | reported over hours (9) |
| Campaigns | one strength number per candidate (6.6) | full (6) |
| Governing | quarterly agenda, one roll call per bill (7.8) | full (7) |
| Published information | headlines only | full (8) |
| Exchange, bettors, player | no | yes |

Coarse and Full must produce the same kinds of worlds: the seat, margin and lever distributions of a Full run of 2018 to 2020 must fall inside the Coarse bands.

### 3.4 Hydration
At 2020-01-01 the world switches to Full: era-only state is trimmed; outlets, pollsters and accounts are created; the 2020 cycle opens with races and candidates from incumbents and benches; war chests and `HYDRATE_POLL_DAYS` = 60 days of polls are back-filled; contracts are listed and books seeded; the player account is created. Hydration is a pure function of the Coarse state and the seed.

### 3.5 Pre-baked starts
A small set of pre-simulated 2020 saves ships with the game for instant play and for tests. "Generate a new history" runs 3.2 behind a progress screen and can be cancelled. Target: `PRESIM_BUDGET_S` = 120 seconds **(T)**.

### 3.6 Difficulty
A preset chosen at new game sets starting cash (default `START_CASH` = $50,000), fees, margin limits and how wrong bettors tend to be (11.4).

## 4. The economy

### 4.1 USA cut
Only US-headquartered companies are simulated. There is one country and one financial zone.

### 4.2 Rest-of-world block
Each industry has one static foreign supplier, `row_assets`, sized at load from the supply the removed foreign companies would have held. It grows at the industry's long-run rate and takes its share of demand like the fringe (mvp-spec 5.3).

### 4.3 Levers
Government acts on the economy only through `World.levers`:

| Lever | Scope | Effect |
|---|---|---|
| `corp_tax` | national | corporate tax rate (mvp-spec 5.11) |
| `fiscal` | national | demand push (1995-rework-spec fiscal push) |
| `rate_bias` | national | policy-rate bias; set by the Fed chair |
| `regulation` | per industry | raises operating cost |
| `subsidy` | per industry | raises demand |
| `antitrust` | per industry | caps the largest firm's growth plan |
| `tariff` | per industry | scales `row_assets` supply by `1 − tariff` |
| `state_growth` | per state | shifts county population growth and firms headquartered there |
| `gains_tax`, `income_tax` | player | section 14.2 |

Levers move only when a law or executive action says so (7.7). The quarterly party drift of the 1995 world is removed.

## 5. People and places

### 5.1 Counties
The voter unit is the real county, 3,142 of them, on one frozen vintage (the 2010 county set with Bedford city, Virginia, merged into Bedford County). Each has `population`, `lean` (points toward party A), `spread` (5.4), `elasticity` and `turnout`. Populations and starting leans come from public data; all people are invented.

### 5.2 Drift
Each year county population moves with its state's growth and a county term, and lean drifts with a state trend plus noise (extending `driftYear`). Elasticity and turnout drift slowly **(T)**.

### 5.3 Census and apportionment
Censuses fall in 2000, 2010, 2020 and every ten years after. Seats are reapportioned by equal proportions.

### 5.4 Districts
A House district is a list of whole counties plus weighted shares of counties too large for one district. Districts in a state are contiguous and equal in population within `DISTRICT_POP_TOLERANCE` **(T)**. A share of a county carries that county's elasticity and turnout.

A county is not politically uniform. Its people are ordered from most party-A to most party-B, and their lean runs in a straight line from `lean + spread` to `lean − spread` across that order. A district's share of a county is an interval `[from, to]` of that order, and carries the mean lean of its interval; the shares of one county do not overlap and together cover it. A county held whole by one district has the interval `[0, 1]` and so the county's own lean. `spread` is set at load from population and density **(T)**: near zero for small rural counties, large for big urban ones.

### 5.5 Redistricting
After each census every state with more than one seat is redrawn by the governor's party with strength `s` from 0 (neutral, compact) to 1 (maximum pack and crack). `s` rises with the governor's intrigue and falls with integrity traits **(T)**.

### 5.6 Court challenge
A map with `s` above `CHALLENGE_STRENGTH` **(T)** may be challenged. Judges decide by integrity and leaning; a struck map is redrawn at lower strength. The challenge and ruling are events (and contracts, 10.2).

### 5.7 Persons
Every politician is a `Person` who persists after leaving office, with the six skills and the traits of mvp-spec 3.7.1, an ideology, a home state, and a career record.

### 5.8 Offices
President, Vice President, 14 Cabinet seats, 100 senators (three classes), 435 representatives, 50 governors, judges, and the Fed chair.

### 5.9 Careers
Candidates come from:
1. a bench of `BENCH_PER_STATE` **(T)** rising figures per state (mayors, state legislators, business people, celebrities);
2. challengers generated when a race lacks a candidate;
3. corporate executives who have lost their seat, with chance `EXEC_CROSSOVER_CHANCE` **(T)** a year.

The usual ladder is House or governor, then Senate, then President; ambition is a trait. People leave by retirement, defeat, scandal, death (the 1995 mortality curve) or appointment.

### 5.10 Experience
Winning an election, passing a sponsored bill, winning a debate and similar achievements grant XP **(T)**. Each level raises one randomly chosen skill by one.

### 5.11 Hidden stats
Skills, traits, integrity and XP are never shown in play. They are visible only with the Omniscient debug toggle. Published information (8) is the player's only evidence.

### 5.12 Parties and factions
There are two major parties. Every person and every county has an ideology from the existing nine; inside a party, ideologies act as factions. A party's platform is the seat-weighted mix of its officeholders.

### 5.13 Realignment
If one faction of a party loses its presidential primary while holding more than `SPLIT_FACTION_SHARE` **(T)** of the party's voters, it may split with a small chance per cycle **(T)** and run its own candidates. A party that finishes third nationally in two straight cycles is replaced as a major party. Independents and minor candidates may run at any time.

## 6. Elections and campaigns

### 6.1 Calendar
Federal generals fall on the first Tuesday after the first Monday of November in even years: House every two years, Senate by class, President every four. Governors serve four years on each state's cycle. Primaries are set per state in the spring and summer **(T)**. Winners take office in January. A vacancy triggers an appointment or special election by office **(T)**.

### 6.2 Races
A race has an office, a place, primaries per party and a general. Candidates file, may drop out, and are certified.

### 6.3 Money
Each campaign has a war chest. Weekly receipts rise with hustle, persuasion, incumbency, office, poll standing and the lean of donor industries toward the candidate's ideology **(T)**. Receipts and spending are filed (8.6).

### 6.4 Spending
Each week a campaign splits spending between ads and field work across the states or counties of its race. Ads move persuadable voters (scaled by elasticity); field work moves turnout. Returns diminish **(T)**.

### 6.5 Events
- **Rallies and debates** are scheduled; each is a stat check (persuasion, with traits) that can produce a breakout or a gaffe.
- **Endorsements** come from officeholders by faction and standing.
- **Scandals** arise from traits and from opponents' intrigue; they may surface at once, late or never.

### 6.6 Coarse campaigns
In Coarse fidelity each candidate has one strength number from skills, money and incumbency, applied to the vote directly.

### 6.7 The vote
For each county (or county share), support is the existing `utility` and `shares` kernel with county lean, incumbency, the economy, candidate strength in that place and a swing with national, state and county parts. Turnout comes from county turnout and field work. Votes sum county to district to state; the presidency is decided by the Electoral College.

## 7. Governing

### 7.1 Bills
A bill has a sponsor, a subject, one or more lever changes (4.3) and a stage: drafted, committee, floor of each chamber, conference, president, law or dead.

### 7.2 Agenda
The president and chamber leaders choose which bills move, by their faction's platform and their skills.

### 7.3 Whipping and amendment
Leaders whip members before a floor vote (persuasion and intrigue against each member's distance from the bill). Amendments move a bill's lever changes toward the pivotal member.

### 7.4 Roll calls
Every member votes by ideology distance, party pressure, home-district lean, donors and a personal term **(T)**. The Senate needs `CLOTURE_VOTES` = 60 to end a filibuster except on budget bills.

### 7.5 President
The president signs or vetoes; a veto is overridden by two thirds of each chamber.

### 7.6 Executive actions
Cabinet nominations and Senate confirmations, court nominations, the Fed chair, executive orders (small lever moves without Congress, reversible by the next president), shutdowns when a budget fails by its date, and impeachment and trial.

### 7.7 Effects
A law or order changes levers on its effective date. Passing or failing a bill shifts approval and county lean slightly by ideology **(T)**.

### 7.8 Coarse governing
Each quarter the governing party tables an agenda of bills; each gets one roll call per chamber with the same vote function and no stages.

## 8. Published information

### 8.1 Principle
The player and the NPC bettors see only what is published. Events are real; coverage is selective, slanted, delayed and sometimes wrong.

### 8.2 Outlets
A wire, several national outlets across the spectrum and one regional paper per state. Each has `slant`, `reliability` and beats. An outlet chooses which events to cover and how to frame them from its slant; low reliability adds errors and unconfirmed claims.

### 8.3 Social feed
Accounts for politicians (voice from traits), campaigns, pundits, pollsters and anonymous accounts. Rumours appear here first; each rumour is true or false in the sim and may later be confirmed or debunked. The player follows accounts.

### 8.4 Pollsters
Named firms with a house effect, a sample size and a schedule. A poll samples the true current vote of 6.7 with sampling error, the house effect and a likely-voter error **(T)**. Small races are polled rarely.

### 8.5 Forecast
A public forecast site turns published polls and fundamentals into win odds and seat ranges. It is an in-world model and can be wrong.

### 8.6 Official records
A government site with bill status and summaries, roll calls, campaign finance filings, certified county results and district maps. Always true, published on a legal schedule.

### 8.7 Text
Articles and posts are stored as a template id and arguments and rendered by a deterministic grammar. The template bank is written offline in bulk with an LLM and reviewed; no model runs in the game.

### 8.8 Morning front page
Each outlet ranks the past day's stories each morning.

## 9. Election night

### 9.1 Truth
The result of each race is fixed when its polls close.

### 9.2 Reporting
Counties report in batches over the night and following days. Timing depends on poll-closing time, county size and state counting rules; batches may differ in lean from the county's final result **(T)**.

### 9.3 Calls
Outlets call a race when their own estimate passes a threshold tied to reliability; calls can be wrong and retracted.

### 9.4 Recounts and certification
A margin under `RECOUNT_MARGIN` **(T)** triggers a recount that can move the count slightly. Each state certifies on a set date. Contracts settle on certification (10.4).

## 10. Prediction market

### 10.1 Contracts
A contract pays $1 if its statement is true at resolution and $0 otherwise. Prices are in cents.

### 10.2 Kinds
1. **Race winners:** one contract per candidate in each primary and general.
2. **Chambers and brackets:** party control of House and Senate, seat brackets, popular-vote margin brackets, electoral-vote brackets.
3. **Governing:** a bill passes a chamber or becomes law by a date, a veto is overridden, a nominee is confirmed, a shutdown occurs, a district map is struck down.
4. **People:** a person resigns, is impeached, announces, drops out by a date, or is picked as running mate or for the Cabinet. Listed when the sim marks the event as possible.

### 10.3 Listing
Listing rules per kind decide when a contract opens **(T)**. Contracts for mutually exclusive outcomes form a group.

### 10.4 Resolution
Each contract shows its written rule. There are no refunds.
- A candidate contract resolves No unless that person is the certified winner, for any reason.
- A by-date contract resolves No at its date if the event has not happened.
- A party contract follows the party's legal successor.

### 10.5 Collateral and fees
Contracts are fully collateralised: selling Yes is buying No at 100 minus the price. A fee of `BET_FEE` **(T)** is charged on winnings.

## 11. The exchange and the bettors

### 11.1 Books
Every contract has an order book with integer price ticks, price-time priority, and limit, market and stop orders, good till cancelled or for the day. The same engine later runs stocks and options.

### 11.2 Depth
Books are deep enough that a small player trades inside the spread, and a wealthy player moves the price.

### 11.3 Cohorts
NPC bettors are cohorts, each with a bankroll and its own account: partisans, poll followers, forecast followers, news traders, market makers, arbitrageurs and noise.

### 11.4 Beliefs
Each cohort holds a belief per contract, updated daily toward a signal built **only** from published polls, the forecast, the articles and posts its diet includes, and the market price. Cohorts differ in partisan bias, noise, update speed and herding. A cohort posts a limit order when its belief differs from the mid price by more than its edge, sized by capped Kelly.

### 11.5 Firewall
Belief code may not read hidden stats, true vote intention or uncounted results.

## 12. Notices to the player
Phone notifications come from the player's alerts (14.4) and the fixed list (2.4).

## 13. Stocks

### 13.1 First version
Prices follow mvp-spec 5.14. The player buys and sells at the hourly price plus `STOCK_SPREAD` and commission **(T)**, long only, subject to 1.3.

### 13.2 Later
A real order book on the engine of 11.1. Named NPC funds with cash and holdings replace the anonymous cap table and file their holdings. Limit and stop orders, short selling with borrow cost and buy-ins, margin with maintenance and forced liquidation, and options with market makers. Specified before that milestone.

## 14. The player's account

### 14.1 Accounts
Cash is held at a brokerage and at the betting exchange, with transfers between them.

### 14.2 Tax
Realised gains are taxed each April at `gains_tax`; rates are levers that laws change. Lots are tracked first in, first out.

### 14.3 Interest
Cash earns the policy rate less a spread. Margin debt and short borrow, when they exist, pay the policy rate plus a spread **(T)**.

### 14.4 Alerts
The player may follow people, races, bills and tickers, and set price alerts. Each alert notifies and may pause.

### 14.5 Bankruptcy
If net worth is below zero after forced liquidation, the run ends with a career summary.

### 14.6 Score
Net worth, rank against NPC funds (once they exist), and a record of calls.

## 15. The desktop

### 15.1 Shell
The game is an Electron app. The sim runs in a Node process; the UI reads only views and sends controls and player actions.

### 15.2 Fake operating system
The screen is one invented, timeless cyberpunk desktop with windows, a taskbar (date, pause, step, speed) and a phone that shows notifications and compact apps.

### 15.3 Apps
News, social feed, polls and forecast, official records, betting exchange, brokerage, browser (an encyclopedia of public facts), USA map (states, counties, districts, live returns), the Pdoomberg terminal, and a debug workspace shown only with Omniscient.

### 15.4 Saves
Saves and rotating autosaves are files on disk.

## 16. Determinism and tests

### 16.1 Determinism
The rules of CLAUDE.md hold. Player actions are part of the state and are recorded for replay. The same seed and actions give the same state hash in headless Node and in the app.

### 16.2 Checks
Per change: the fast check. Per milestone: the full gate, re-baked starts, a Coarse 25-year soak and a Full 2-year soak inside sanity bands, then new baselines accepted by Logan.
