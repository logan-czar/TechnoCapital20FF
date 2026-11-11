# Contract requests collected in M1 (for the M2 contracts change)
From U3 mock (full detail in the U3 report / apps/web/src/sim/mock/README.md):
1 SliceKey/SliceData for pivot views: markets{contract}->ContractBook, returns{race}->RaceCountyReturns, records{roll_call}->RollCallVotes (+sliceId).
2 Append deltas in ViewsPatch for feed.articles, social.posts, polls.polls, notifications.items, account.fills, records.roll_calls, records.filings (like news_appended).
3 Changed-row channel: rumour status, article corrected, RaceCall retracted.
4 ContractHistory type + slice markets_history{contract}.
5 ContractRow: person, party, bracket{lo,hi}.
6 PauseReason {kind:"Notification",id}; Control SetFixedPause{pause,on}; state in ClockView.
7 Company -> InstrumentId mapping (QuoteRow.instrument or rule in action.ts). Mock: contract id; stock = 1,000,000 + company id.
8 PositionRow No side (side, collateral); AccountView.reserved per venue.
9 Poll.state; ForecastView.states.
10 RaceReturns.states for the presidency.
11 Define "candidate order" for Poll.shares / RaceForecast.odds / RaceReturns.votes (only ballot candidates).
12 Export PARTY_VALUES, IDEOLOGY_VALUES from sim index.
13 DistrictRow.id; define District EntityRef.
14 RaceRow: electoral votes, polls_close, incumbent party for open seat, certification date.
15 Chambers' make-up: PeopleView.chambers or PersonRow.chamber.
16 Notifications read state: PlayerAction NotificationsRead{through}; NotificationsView.read_through.
17 FillRow: instrument, what, side, realised; AccountView.settlements.
18 OrderRow: avg_price, closed/reason.
19 Article kind + source link; front_pages slice by date.
20 ExecActionRow.kind Resignation; CareerEntry.how.
21 BillRow.actions[], chamber_of_origin.
22 UsMapCounties turnout/votes of last result; state-level last result.
23 ContractRow prev_close, closes.
From U2 shell: AppProps way for an app to request focus / close its window (optional).
From U1 Electron: GenerateStart seam signature must widen for Progress/Cancel; boundary rule keeping node: imports out of sim-host non-Node files.
Mock default: flip pivot world on by default (about five assertions in apps/web/test/sim.test.ts and m1-contracts.test.ts); mock worker still loads /data/design (2020).
