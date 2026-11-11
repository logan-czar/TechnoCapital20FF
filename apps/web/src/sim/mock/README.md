# The mock sim

A stand-in for the sim that the app lanes build against. It speaks the worker protocol
(`types/protocol.ts`), fills the 13 pivot views (`types/views/`: feed, social, polls, forecast, races,
people, records, markets, account, notifications, districts, usmap_layers, returns) with a small,
internally consistent, seeded world, and behaves like a small fake game: the clock runs, things are
published, prices move, election night happens, and the player's actions are taken.

It is not the sim. Nothing here is a spec formula and every number is a mock number. What it keeps
honest is the shape of the views and the consistency between them (every id and `EntityRef` names
something another view holds), which `apps/web/test/mock/invariants.ts` checks.

## Running it

- In the browser: `?mock=1` (`sim/spawn.ts`). The worker runs the pivot world; the dev server's
  worker is a debug sim, so the Omniscient control works there.
- In a test: `new SimHost(world)`; `apps/web/test/mock/common.ts` has a `newGame` helper that does it
  and gives `control`, `act`, `runTo` and `views`.

The pivot world is the default (D1037). `new SimHost(world, { pivot: false })` is the plain mock: it
starts on 2020-01-01, the pivot views are empty, every action is `NotAvailable` and `Want` is
ignored (the clock-pacing tests use it, since no scripted pause lands there).

With the pivot world the host honours `Want` as the real host does: before the first `Want` it
posts every view, and after it only the views named. A `SimClient` sends a `Want` as soon as it
attaches, so a test that reads a view through a client's store must subscribe to it first
(`store.subscribe(name, ...)`), or read `host.sim.views` directly.

`MockOptions` (`mockSim.ts`):

| Option | What it does |
|---|---|
| `pivot` | Run the pivot world: true unless set to false. |
| `start` | The tick a new game starts at. Default `MOCK_START`, 2020-10-20 00:00. Any tick from `MOCK_HISTORY_START` (2020-08-21) on works; before the default the player has an account and has done nothing with it. |
| `debug` | Allow `SetOmniscient`, which fills the hidden fields (pivot 5.11). Without it the control answers `DebugOnly`, as the real sim does. |

There is no `?mockDate=` in the URL: the worker cannot read the page's query and `spawn.ts` is
another lane's. A game starts paused two weeks before the election, and a Step of 168 hours twice
reaches election day.

## Files

One file per view family, so a lane can extend one without touching the others.

| File | Views | What is in it |
|---|---|---|
| `fixtures/script.ts` | | The mock calendar: every scripted date. |
| `fixtures/geo.ts` | districts, usmap_layers | States, counties, the House plan. |
| `fixtures/people.ts` | people | People, their public record and hidden stats. |
| `fixtures/races.ts` | races | The cast, the 48 races, each race's true final vote by county. |
| `fixtures/polls.ts` | polls | Pollsters, schedules, polls. |
| `fixtures/forecast.ts` | forecast | The forecast site's model; the seat and electoral-vote arithmetic. |
| `fixtures/feed.ts` | feed | Outlets, article templates, front pages. |
| `fixtures/social.ts` | social | Handles, posts, rumours. |
| `fixtures/records.ts` | records | Bills, roll calls with every vote, executive actions, filings. |
| `fixtures/markets.ts` | markets | Contracts, rules, prices, order books, price history. |
| `fixtures/account.ts` | account, notifications | The player's cash, positions, orders, fills. |
| `fixtures/player.ts` | | The player's scripted first eight weeks. |
| `fixtures/returns.ts` | returns | Election night: batches, calls, recounts. |
| `fixtures/clock.ts`, `market.ts`, `companies.ts`, `news.ts`, `initial.ts`, `shared.ts`, `rng.ts` | clock, quotes, price_bars, company_rows, industry_rows, news | The pre-pivot views' fixtures, moved as they were from `mockViews.ts`. |
| `pivot.ts` | | `MockPivot`: builds the world, runs each hour, takes actions, says which views moved. |
| `mockSim.ts`, `host.ts`, `worker.ts` | | The clock and controls, the protocol, the Web Worker. |

## The world

The mock nation is twelve real states with their real House seats, and nothing else. Everything in
it is generated from the seed, so two seeds give different people, margins and winners on the same
calendar.

- **States (12):** Arkansas 4, Delaware 1, Iowa 4, Kansas 4, Maine 2, Montana 1, Nebraska 3, Nevada 4,
  New Hampshire 2, New Mexico 3, Vermont 1, Wyoming 1: 30 House seats and 54 electoral votes, 28 to
  win. A 27 to 27 tie goes to the incumbent party. A `UsStateId` is the state's row in
  politics-usa.csv, so the ids are not 0 to 11.
- **Counties (162):** invented, 9 to 18 a state. `CountyId` is a place in FIPS order. The FIPS codes
  are well formed (the state's real prefix, odd county codes) and the names are made up. The real
  counties.csv was not in the tree; `genCounties` in `fixtures/geo.ts` is the one function to replace.
- **Districts (30):** whole counties and shares of big ones (`CountyShare` intervals). An
  `EntityRef` of kind `District` uses the district's place in `v_districts.districts`.
- **People (about 140):** a president and vice president, two Cabinet secretaries, a nominee, 24
  senators, 12 governors, 30 representatives, their challengers and a few primary losers. Names come
  from the world's name lists topped up with invented ones. Skills, traits, integrity, XP and level
  are null unless Omniscient.
- **Races (48), in id order:** 0 President; 1 to 12 Senate (one a state); 13 to 42 House; 43 to 47
  Governor (the five most evenly split states). The president's race has six candidates: the
  incumbent, the challenger and four who lost or left the primary. Some Senate and Governor races
  have a primary loser or an independent. The parties are `Democrats` and `Republicans`.
- **Bills (7):** one law, one on the Senate floor (it passes during play), one in committee that
  reaches the House floor, one in committee, one dead on a failed cloture vote, one drafted, one
  vetoed with a failed override. Eight roll calls at the start, each with every member's vote.
- **Outlets (18):** Continental Wire (id 0), five nationals from slant about +21 to -26, and a regional
  paper per state. Outlet 5, Neon Tribune, is the careless one: it prints the false rumour and
  makes the wrong call. Slant and reliability are null unless Omniscient.
- **Pollsters (6)** with house effects from about -2.3 to +2.6 (null unless Omniscient). Every firm polls
  the presidency every 6 to 10 days; Senate and Governor races less; a House race only if it looks
  close.
- **Forecast:** rerun at 07:00 each day from published polls and public fundamentals only.
- **Social (about 30 handles):** politicians, the two presidential campaigns, four pundits, three
  pollsters, three outlets, three anonymous accounts.
- **Contracts (about 130):** race winners for every general (and the settled presidential primary),
  party control of each chamber, Senate seat, electoral vote and popular vote brackets, five
  governing contracts (one already resolved) and three people contracts at the start, with two more
  listed during play.
  A group's quotes sum to about 100. `ContractRow.instrument` equals the contract id, and each row
  says its person, party and bracket and carries up to 30 daily closes.
- **The player:** $50,000 to start, all at the brokerage. By 20 October the script has moved $15,000
  to the exchange, bought two stocks and five contract positions (one of them a No side, shown as a
  `No` position), left one open order, one cancelled and one expired, followed six things and set
  three alerts. A stock's instrument is the sim's `STOCK_INSTRUMENT_BASE` (1,000,000,000) plus its
  company id (types/action.ts `stockInstrument`, D1037).

## What moves, and when

Every hour: contract prices walk toward what the published information implies; the player's
resting orders may fill; the account's marks move. At 06:00: polls due that day and each outlet's
front page. At 07:00: the forecast. Through the day: a rally story, sometimes an endorsement, a
company story, a market story, and a few posts.

The scripted events, in mock time (`fixtures/script.ts`):

| When | What happens | Views that show it |
|---|---|---|
| 08-21 00:00 | The mock's own history starts (the pre-rolled 60 days). | |
| 08-24 10:00 | The player opens accounts, moves cash, follows six things. | account |
| 09-02 14:00 | The infrastructure bill passes the House. | records, feed |
| 09-09 15:00 | The president vetoes the border tax bill; an override contract is listed. | records, markets |
| 09-16 15:00 | The override fails; the bill is dead. | records |
| 09-30 16:00 | Cloture fails on the platform bill; it is dead. | records |
| 09-30 23:00 | The override contract resolves No at its date. | markets |
| 10-08 11:00 | The tax bill is reported to the House floor. The player's alert on it fires. | records, notifications |
| 10-15 09:00 | Third-quarter campaign finance filings. | records, races |
| **10-20 00:00** | **A new game starts here, paused.** | |
| 10-21 09:00 | Rumour 1 (true): an anonymous account says the Interior secretary will resign. The contract on it jumps, and the player's price alert fires within hours. | social, markets, notifications |
| 10-22 09:00 | Pre-general filings. | records, races |
| 10-22 20:00 | The presidential debate. | feed, social |
| 10-23 14:00 | Rumour 1 confirmed: the secretary resigns. The contract resolves Yes; the player held it. **Pause** (Holding, Resolution). | people, social, markets, account, notifications |
| 10-24 11:00 | Rumour 2 (false): a Senate candidate will drop out. A contract on it is listed. | social, markets |
| 10-24 16:00 | Neon Tribune prints it as an unconfirmed claim. | feed |
| 10-26 10:00 | Rumour 2 debunked: the wire's denial, the article corrected, the post marked Debunked. | feed, social, markets |
| 10-27 11:00 | A successor is nominated; the confirmation contract is Listed. | records, markets |
| 10-27 15:00 | The Senate invokes cloture on, then passes, the infrastructure bill. The player holds a contract on it. **Pause** (Holding). | records, notifications |
| 10-28 09:00 | The confirmation contract opens. | markets |
| 10-30 12:00 | The bill is signed into law. Its contract resolves Yes. **Pause** (Resolution). | records, markets, account |
| 11-02 23:00 | The drop-out contract resolves No at its date. | markets |
| **11-03 00:00** | **Election day. Pause** (the fixed pause of pivot 2.4 item 3). | notifications, returns |
| 11-03 19:00 to 22:00 | Polls close state by state (NH and VT 19:00; AR, DE, ME 20:00; IA, KS, NE, NM, WY 21:00; MT, NV 22:00). Counties report in batches from an hour later. | returns, races, markets |
| 11-03 20:00 on | Outlets call races, the safe ones first. Three hours after its polls close, Neon Tribune calls the recount race for the loser. | returns, feed |
| 11-04 to 11-05 | Mail-first states (DE, ME, MT, NV) finish counting; their big counties report last, on the 5th. The wrong call is retracted. One House race, forced inside 0.5 points, goes to a recount. Counted races' contracts close. | returns, races, markets |
| 11-05 14:00 | The tax bill passes the House. The player's alert on it fires. **Pause.** | records, notifications |
| 11-06 23:00 | "Passes the Senate by 6 November" resolves No. | markets |
| 11-09 09:00 | Certification: winners, `Won` and `Lost`, race contracts resolve, the map takes the new county results, the player is paid. **Pause.** | races, returns, markets, account, usmap_layers |
| 11-11 12:00 | The recount ends and moves a few dozen votes. | returns |
| 11-12 09:00 | The recount race is certified; the House contracts resolve. | races, markets |

After 12 November only the open governing and people contracts keep trading.

Counting rules: a `DayFirst` state's early batches lean to party B and a `MailFirst` state's to
party A, so the leader can change as the count comes in. Prices on election night follow the count,
not the truth.

## Player actions

`Act` is served for every `PlayerAction`:

- `PlaceOrder` on the exchange: a marketable order fills against the book at once, level by level,
  and moves the price; the rest of a limit order rests and shows in the book and as the row's best
  bid or ask; the rest of a market order is cancelled. Resting orders fill as the price reaches
  them, or by chance when they are at or inside the best price. A `Day` order expires at midnight.
- `PlaceOrder` at the brokerage: fills at once at the quote plus a 0.1% spread and a $1 commission,
  long only, up to 5% of the company.
- `CancelOrder`, `Transfer`, `Follow`, `Unfollow`, `AlertRuleAdd`, `AlertRuleRemove`.

A refused action answers `ActError` (`Invalid` or `Rejected`, with a message for the player),
changes nothing and posts no frame. An applied one posts a frame with the views it moved, then `Ok`.

Notices: every fill and every resolution of a contract the player holds raises a v_notifications
row with `paused: true` and pauses the game with `{ kind: "Notification", id }`; so does a roll call
or a resignation naming something the player holds a position on, election day (which also raises
the `Election` alert), and any alert rule set to pause. A fixed pause the player switched off with
`SetFixedPause` notifies without pausing. `NotificationsRead` moves `read_through`. An `Any` rule fires
when an article, a post or a roll call names its target; a price rule fires once each time its
price crosses.

A save records the player's actions and replays them on load (pivot 16.1).

## Slices and append lists

The pivot slices (protocol.ts `SliceKey`, D1037) go out in frames while wanted, as the real host
sends them, and `SimHost.slice` reads one in process:

| `SliceKey` | Returns |
|---|---|
| `{ view: "markets", slice: "book", contract }` | `ContractBook`: six levels a side, the player's orders included. |
| `{ view: "markets", slice: "history", contract }` | `ContractHistory`: the price each hour since listing. |
| `{ view: "returns", slice: "counties", race }` | `RaceCountyReturns`: reporting and votes by county. |
| `{ view: "records", slice: "votes", roll_call }` | `RollCallVotes`: every member's vote. |
| `{ view: "feed", slice: "front_pages", date }` | `FrontPage[]`: every outlet's front page of that day. |

The mock's frames are the real host's (`viewsPatchSince`): the append lists (`APPEND_LISTS`:
articles, posts, polls, notifications, fills, roll calls, actions, filings) travel as appended rows,
and a row replaced since (an article corrected, a rumour settled) as a changed row. The mock never
changes a row in place, so a row object that is the same is a row that did not change.

## Frame sizes

Measured by `apps/web/test/mock/pivot-views.test.ts`, as JSON bytes, seed 7:

| | Bytes |
|---|---|
| First frame, every view | 2,365,923 |
| of which the 13 pivot views | 359,065 |
| An hour's frame, every view, median of a day | 200,739 |
| of which the pivot views, median | 69,173 |
| The pivot views' heaviest hour (06:00: polls, feed, social, markets) | 187,573 |
| An hour's frame when the UI wants only clock and markets | 65,464 |

The pre-pivot views are most of it (price bars 1.2 MB, company rows 350 KB, places 270 KB, quotes
96 KB an hour). The mock honours `Want`, so an app receives only the views it reads. These numbers
are from before the append lists (D1037): a list that grows now travels as its new rows.

## What the mock does not do

- No cohorts, campaigns, spending or governing logic: prices follow one market belief per contract,
  and bills move on the script.
- State polls of the presidency (`Poll.state`) are drawn from hashes, every state every nine days,
  and the forecast and the stories do not read them. v_returns' `states` are the presidency's
  counties summed by state, with the wire's calls.
- The stock walk is not saved, as before this lane: after a load, stock prices restart from their
  opening values.
- No stop orders, no margin, no bankruptcy.
