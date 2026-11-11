# Contract requests collected in M1 (for the M2 contracts change)

Status after the M2 contracts change (D1037): **applied** unless marked otherwise.

From U3 mock (full detail in the U3 report / apps/web/src/sim/mock/README.md):
1 SliceKey/SliceData for pivot views: markets{contract}->ContractBook, returns{race}->RaceCountyReturns, records{roll_call}->RollCallVotes (+sliceId). **Applied**, as `{ view, slice: "book" | "history" | "counties" | "votes" | "front_pages", ... }`; built from the state by `ViewBuilder.slice`, never kept in the view's data.
2 Append deltas in ViewsPatch for feed.articles, social.posts, polls.polls, notifications.items, account.fills, records.roll_calls, records.filings (like news_appended). **Applied** (`APPEND_LISTS`, `ViewsPatch.appended`; records.actions too).
3 Changed-row channel: rumour status, article corrected, RaceCall retracted. **Applied** for the append lists (`ViewsPatch.changed`, rows compared by identity). **Not needed** for RaceCall: v_returns is posted whole when it moves.
4 ContractHistory type + slice markets_history{contract}. **Applied** as the `history` slice of v_markets (the mock's shape).
5 ContractRow: person, party, bracket{lo,hi}. **Applied** (open ends are null).
6 PauseReason {kind:"Notification",id}; Control SetFixedPause{pause,on}; state in ClockView. **Applied** (`FixedPause`, `Controls.fixed_pauses`, `ClockView.fixed_pauses`, `jobCtxNotify`).
7 Company -> InstrumentId mapping (QuoteRow.instrument or rule in action.ts). **Applied** as the rule in action.ts (`stockInstrument`, `STOCK_INSTRUMENT_BASE` = 1,000,000,000); QuoteRow is unchanged.
8 PositionRow No side (side, collateral); AccountView.reserved per venue. **Applied** (`side` Long/Yes/No with `qty` always above 0; `reserved` on each cash row).
9 Poll.state; ForecastView.states. **Applied.**
10 RaceReturns.states for the presidency. **Applied.**
11 Define "candidate order" for Poll.shares / RaceForecast.odds / RaceReturns.votes (only ballot candidates). **Applied**: `RaceRow.ballot` (and each primary's `ballot`).
12 Export PARTY_VALUES, IDEOLOGY_VALUES from sim index. **Applied.**
13 DistrictRow.id; define District EntityRef. **Applied**: `districtRefId(state, number)` = state × 100 + number, stable across redraws (not the row's place, which moves).
14 RaceRow: electoral votes, polls_close, incumbent party for open seat, certification date. **Applied** (`electoral_votes` is the majority to win; also `special`).
15 Chambers' make-up: PeopleView.chambers or PersonRow.chamber. **Applied** as `PeopleView.chambers`.
16 Notifications read state: PlayerAction NotificationsRead{through}; NotificationsView.read_through. **Applied.**
17 FillRow: instrument, what, side, realised; AccountView.settlements. **Applied** (and `venue`).
18 OrderRow: avg_price, closed/reason. **Applied** (`OrderCloseReason`).
19 Article kind + source link; front_pages slice by date. **Applied** (`ArticleKind`, `ArticleSource`).
20 ExecActionRow.kind Resignation; CareerEntry.how. **Applied** (and `CareerEntry.exit`).
21 BillRow.actions[], chamber_of_origin. **Applied.**
22 UsMapCounties turnout/votes of last result; state-level last result. **Applied** (`turnout`, `last_votes`; `UsMapState.last_winner`, `last_margin`).
23 ContractRow prev_close, closes. **Applied** (`CONTRACT_CLOSES_KEPT` = 30).
From U2 shell: AppProps way for an app to request focus / close its window (optional). **Applied**: `close` and `setTitle` (an app is focused by `openApp`).
From U1 Electron: GenerateStart seam signature must widen for Progress/Cancel; boundary rule keeping node: imports out of sim-host non-Node files. **Applied**: `GenerateStart` returns a `GenerateJob` the host runs a chunk per `tick`; the boundary scan refuses `node:` in sim-host outside node.ts.
Mock default: flip pivot world on by default (about five assertions in apps/web/test/sim.test.ts and m1-contracts.test.ts); mock worker still loads /data/design (2020). **Applied**; the worker still loads the 2020 data.
