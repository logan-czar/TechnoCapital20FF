# Pivot M2: the lanes

The lanes of milestone M2, "Electorate and offices" (plan: milestones and lanes; D1026): four sim
lanes and nine UI lanes. Each lane works in its own worktree on `build/m2-<slug>`, cut from `main`
after the contracts change (`build/m2-contracts`, D1037) has merged. A lane edits only the folders it
owns and never the contract files. The spec is [docs/design/pivot/spec.md](../design/pivot/spec.md),
cited as `pivot N.N`. M1's lanes and contracts are D1029 to D1036.

## Rules for every lane

- After each change run `scripts/check-fast.ps1` (or `.sh`) on the test files you touched, by path.
  It is not the gate: `scripts/check-ts.ps1` runs once, at the end of the milestone. Run the
  auto-detected `check-fast` (no arguments) once, at the end, under `scripts/heavy`.
- One heavy run at a time on the machine (`scripts/heavy.ps1`: a whole Vitest project, a slow test,
  a sim run of more than a few seconds, the e2e suites). Keep scratch and logs on D:, inside the
  worktree, git-ignored (`.claude/scratch/`).
- A lane that needs a contract changed does not change it. It writes what it needs in its report;
  the change lands in the next contracts change (or a small serial fix to this one).
- The same seed must give the same economy until a lane's task says otherwise. A lane that moves the
  state hash says why and re-records the pinned values in the same commit (the list is under
  "Pinned values").
- Code PRs do not edit `docs/design` prose. A choice the spec leaves open goes in
  `docs/build/decisions.md`, under the decision number the lane was given.
- A function another lane calls keeps its signature (listed under each lane below); its body is the
  owner's. Code another lane still calls is not deleted: what is dead after M2 goes in the M3
  contracts change.

## Contract files (no lane edits these)

| File | What it fixes |
|---|---|
| `packages/sim/src/types/ids.ts`, `types/draws.ts` | Branded ids; the 13 RNG streams |
| `packages/sim/src/types/world.ts` | `World` (with `persons`, `elections`, `player`, D1037) |
| `packages/sim/src/types/state/geo.ts` | `County`, `CountyShare`, `District`, `DistrictPlan`, `Census`, `Challenge`, `GeoState` |
| `packages/sim/src/types/state/persons.ts` | `Person`, `OfficeSeat`, `OfficeHolder`, `CareerRecord`, `Vacancy`, `PartyPlatform`, `PersonsState` |
| `packages/sim/src/types/state/elections.ts` | `Race`, `Candidacy`, `Primary`, `RaceResult`, `CountyResult`, `ElectoralCollege`, `ElectionCalendar`, `ElectionsState` |
| `packages/sim/src/types/state/player.ts` | `PlayerState`, `DifficultySettings`, accounts, lots, orders, fills, settlements, notifications, `RecordedAction` |
| `packages/sim/src/types/state/politics.ts`, `governing.ts` | The POC's types (`Party`, `Ideology`, `IDEOLOGY_VALUES`, `PARTY_VALUES`, posts, states); `Levers` |
| `packages/sim/src/types/action.ts` | `PlayerAction` (with `NotificationsRead`), `ActError`, `Venue`, `AlertRule`, the instrument rule (`STOCK_INSTRUMENT_BASE`, `stockInstrument`, `contractInstrument`, `instrumentTarget`, `instrumentVenue`) |
| `packages/sim/src/types/control.ts`, `notice.ts`, `sim-api.ts` | `Control` (with `SetFixedPause`), `Controls.fixed_pauses`, `PauseReason` (with `Notification`), `FixedPause`, `SimApi` (with `slice`), `SimError` (with `BadFixedPause`) |
| `packages/sim/src/types/protocol.ts` | `ToSim`, `FromSim`, `SliceKey` and `SliceData` (with the pivot slices), `APPEND_LISTS`, `AppendPatch`, `ChangedPatch`, `ViewsPatch`, `BakedStart` |
| `packages/sim/src/types/views/*.ts` | Every view's type, `SimViews`, `VIEW_NAMES`, `VIEW_SPECS` (with `on_act`), `EntityRef`, `districtRefId` |
| `packages/sim/src/views/index.ts`, `views/patch.ts`, `views/pivot.ts` | The builder table (with `ViewBuilder.slice`), the frame patch (append lists, changed rows, slices), the M3 to M5 views' empty values |
| `packages/sim/src/jobs.ts`, `time/scheduler.ts` | Every job's slot and order; the slots (with `HourlyPlayer`, `DailyGeo`, `DailyCareers`, `DailyElections`, `DailyPlayer`); `jobCtxNotify` |
| `packages/sim/src/lib.ts` | `START_DEPS` (the lanes' starts, in order), `simAct`, `simSlice` |
| `packages/sim/src/save.ts` (`SAVE_VERSION` 7), `packages/sim/src/index.ts` | The save version; the public face |
| `packages/sim-data/src/rows.ts`, `manifest.ts`, `world.ts` (the county parts) | As M1 |
| `packages/sim-host/**`, `scripts/ts/boundary.ts` | The hosts (with the generated history, D1037); the boundary scan |
| `apps/web/src/os/apps.ts` (`AppSpec`, `AppProps` with `close` and `setTitle`), `os/wm.ts`, `os/Window.tsx`, `links/nav.ts` | The app contract and the window manager |
| `apps/web/src/sim/store.ts`, `client.ts`, `hooks.ts` | The store (append lists merged, slices), the client (`act`, `cancel`, `status.progress`), the hooks (`useSlice`) |
| `apps/web/src/apps/_shared/**` | What the apps share: `EntityLink`, `PersonChip`, `ListTable`, `ComingSoon`, `ENTITY_APP`, `entityTarget`, `parseEntityRoute`, party classes and colours, the formatters |
| `apps/web/src/sim/mock/**` | The mock the UI lanes build against (its README) |

## The politics POC

The POC (D980 to D988: `politics/jobs.ts`'s daily job, `PoliticsState.politicians`, its `District`,
v_politics) keeps running until lanes E and C replace it. The new tables (`World.persons`,
`World.elections`, the geo plans) are empty at load and stay empty until a lane fills them, so the
contracts change plays exactly as before.

| POC piece | Replaced by | Removed by |
|---|---|---|
| The November vote, the races and the handovers (`politics/jobs.ts` `electionDayJob`, `congressHandover`, `presidentHandover`) | Lane E's elections | Lane E |
| `PoliticsState.districts` and its `District` (D982) | `GeoState.plans` (lane G) | Lane E (who reads it) |
| `politics/state.ts`, `politics/calendar.ts`, `politics/vote.ts` (keeping `shares` and `utility`), `views/politics.ts` (v_politics) | Elections, v_races, v_people | Lane E |
| Appointments, judges' retirement, aging (`fillExecutive`, `fillCourtVacancies`, `newYear`) | Lane C's careers | Lane E deletes them from `politics/jobs.ts`; lane C writes the new ones in its own files and never edits `politics/jobs.ts` |
| The start seats (`politicsStart`) | `personsStart` (lane C) | Kept (D1052): `personsStart` makes the POC's start holders persons, its House members re-seated in lane G's districts; the call in `START_DEPS` stays |
| `drawCensus`, `applyDistricts` (`politics/era.ts`) | Lane G's census and plans | Lane E deleted the calls |
| `driftYear` (`politics/era.ts`) | Still the era's state lean drift, centred on the nation's mean (D1052); lane G's county drift re-centres on it | Kept, in a county world on 1 January |
| `PoliticsState.politicians`, `pending`, `president_terms`, `elections` | `World.persons`, `World.elections` | The M3 contracts change deletes the fields |

The merge order is G, C, then E (E rebases on both and switches the POC off with their starts in
place); P and the UI lanes merge in any order.

**After the integration (D1052).** In a world with counties the offices table (`World.persons`) is
the one record of who holds office: lane C seats everyone at the start, decides who runs
(`declareCycle`), fills every vacancy but a House seat's and names the administration; lane E files
those fields, counts, seats winners and schedules specials; lane G's plans are the districts (there is
no fallback districting). The POC's table is a mirror of the offices table (elections/mirror.ts) for
era/policy.ts, the tides and v_politics; the POC's own vote, appointments, ageing and census run only in
a world without counties (the frozen fixture). The player's account opens at hydration (`simHydrate`,
at `NewGame.difficulty`).

## RNG streams

| Lane | Stream | For |
|---|---|---|
| G | `Governing` | Drift noise, census noise, redistricting choices, court rulings (M3's governing lane shares it later) |
| C | `Politics` | People drawn (benches, challengers, appointees: `politicsDraws`), XP level-ups, retirement, death |
| E | `Count` | Vote noise and swings (pivot 6.7) |
| E | `Campaign` | Coarse campaign strength (pivot 6.6) and primaries |
| P | none | The player draws nothing |

The POC draws from `Politics` until it is removed. No lane draws from a stream the economy reads.

## The lanes

| Lane | Branch | Owns | Starts from | check-fast |
|---|---|---|---|---|
| G Geo | `build/m2-geo` | `packages/sim/src/geo/**`, `politics/era.ts` (add only), `views/districts.ts`, `views/usmap_layers.ts`, new tests `packages/sim/test/geo/**` | `registerGeoJobs`, `geoStart`, `geoPlanOf`, `geoDistrict`, `geoStateOf` (geo/index.ts); the `DailyGeo` slot; the builder slots | `scripts/check-fast.ps1 <its tests>`, then `sim` |
| E Elections | `build/m2-elections` | `packages/sim/src/elections/**`, `politics/jobs.ts`, `politics/state.ts`, `politics/calendar.ts`, `politics/vote.ts`, `views/races.ts`, `views/returns.ts`, `views/politics.ts`, new tests `packages/sim/test/elections/**` | `registerElectionJobs`, `electionsStart`, `electionsStateEmpty` (elections/index.ts); the `DailyElections` slot and the first place in `WeeklyJobs`; the builder slots | as G |
| C Careers | `build/m2-careers` | `politics/careers.ts`, `politics/people.ts`, `politics/generate.ts`, `views/people.ts`, new tests `packages/sim/test/careers/**` | `registerCareerJobs`, `personsStart`, `challengerFor` (careers.ts); `personGet`, `personAdd`, `seatKey`, `officeSeatOrder`, `officeHolderOf`, `officesOf`, `officeTake`, `officeLeave`, `vacancyFillOf` (people.ts); the `DailyCareers` slot | as G |
| P Player | `build/m2-player` | `packages/sim/src/player/**`, `views/account.ts`, `views/notifications.ts`, `apps/headless/src/replay.ts` (replaying actions), new tests `packages/sim/test/player/**` | `registerPlayerJobs`, `playerStart`, `playerAct` (player/index.ts); `HourlyPlayer`, `DailyPlayer`; `jobCtxNotify`; the builder slots | as G, and `headless` |
| News | `build/m2-news` | `apps/web/src/apps/news/**`, `apps/web/test/apps/news/**` | the placeholder app, v_feed on the mock, the `front_pages` slice | `scripts/check-fast.ps1 web` (or its test files) |
| Social | `build/m2-social` | `apps/web/src/apps/social/**`, `apps/web/test/apps/social/**` | v_social, `Follow` | as News |
| Polls | `build/m2-polls` | `apps/web/src/apps/polls/**`, `apps/web/test/apps/polls/**` | v_polls, v_forecast, v_races | as News |
| Records | `build/m2-records` | `apps/web/src/apps/records/**`, `apps/web/test/apps/records/**` | v_records (the `votes` slice), v_returns, v_districts | as News |
| Browser | `build/m2-browser` | `apps/web/src/apps/browser/**`, `apps/web/test/apps/browser/**` | the `pages/` framework (imported, not edited) | as News |
| USA map | `build/m2-usmap` | `apps/web/src/apps/usmap/**`, `apps/web/test/apps/usmap/**` | v_usmap_layers, v_districts, v_returns (the `counties` slice) | as News |
| Terminal | `build/m2-terminal` | `apps/web/src/apps/terminal/**`, `apps/web/test/apps/terminal/**` | `pdoomberg/` (imported, not edited) | as News |
| Debug | `build/m2-debug` | `apps/web/src/apps/debug/**`, the lines of `apps/desktop/e2e/*.spec.ts` that open the debug app | the workspace app | as News, and `e2e:smoke` |
| Phone | `build/m2-phone` | `apps/web/src/os/phone/**`, `apps/web/test/os/phone/**` | v_notifications (`read_through`, `NotificationsRead`), the apps' `PhoneView` | as News, and `e2e:smoke` |

An app imports only its own folder, `apps/_shared/`, the sim's public face and the shell's modules
(`os/`, `links/`, `sim/`, `widgets/`, `pages/`, `pdoomberg/`): the boundary scan refuses an import of
another app's folder.

## What each lane finds waiting

**G Geo.** `GeoState` has `history`, `censuses`, `seats` and `challenges`, all empty, and `plans` is
empty. `geoStart` runs at load after the POC's start, `registerGeoJobs` registers into `DailyGeo`
(after `DailyPolitics`, before careers and elections, every day at 00:00). The districting algorithm
is in `tools/spikes/districts/README.md`. v_districts' rows carry `id = districtRefId(state, number)`,
which `EntityRef`s of kind District name. v_usmap_layers' county columns gained `turnout` and
`last_votes`, its states `last_winner` and `last_margin`, read from `World.elections` (lane E's
`county_results`) when they exist.

**E Elections.** `ElectionsState` is empty; a `Race` keeps its candidacies, primaries, ballot (the
**candidate order** every poll, forecast and count lists) and result. County results are columns of
whole votes for the latest general and the latest presidential race (D1040). `registerElectionJobs` registers into `DailyElections` and
first into `WeeklyJobs`; Coarse campaign jobs are tagged `{ fidelity: "Coarse" }`. When a race lacks a
candidate, call `challengerFor` (lane C's). A seat changes hands through `officeLeave` and
`officeTake`. Vacancies whose `fill` is `Special` are yours to schedule. v_returns has `states` for
the presidency and a `counties` slice (`ViewBuilder.slice`).

**C Careers.** `PersonsState` is empty. `personAdd` gives the next id; `officeTake` and `officeLeave`
keep the offices table in `officeSeatOrder` and the career record; `officeLeave` raises a vacancy
filled by `vacancyFillOf`. `challengerFor` draws a person with `drawPerson`. v_people gained
`chambers` and the career lines `how` and `exit`; hidden stats are null unless Omniscient.

**P Player.** `World.player` is null; `playerStart` runs last at load and should open the account in a
Full world (hydration calls it: `simHydrate`, since the integration, D1052). `simAct` calls `playerAct` and then rebuilds the `on_act` views
(account, notifications, markets). Record each applied action in `PlayerState.actions`. A notification
that asks to pause calls `jobCtxNotify(ctx, id, fixed)`: the runner pauses with
`{ kind: "Notification", id }` unless that fixed pause is switched off (a setting, outside the world);
the row's `paused` is world state and does not depend on the switch. A stock's instrument is
`stockInstrument(company)`. v_account gained reserved cash, the No side, settlements, and fill and
order detail; v_notifications `read_through`. Fills and notifications are append lists: a builder must
keep a row object it did not change from one build to the next (`rebuildFrom`).

**UI lanes.** Each app folder has a placeholder `app.tsx` and component, already on the desktop. Read
views with `useViewData(name)` and slices with `useSlice(key)` (`apps/web/src/sim/hooks.ts`); the store
merges the append lists. Link to anything an `EntityRef` names with `EntityLink` (`apps/_shared`), which
opens its home app (`ENTITY_APP`) at `entityRoute(ref)`; parse your own route with
`parseEntityRoute`. `AppProps` gives `route`, `onRoute`, `close` and `setTitle`. The mock is the
default sim in the browser with `?mock=1` and in tests (`new SimHost(world)`); its README lists what it
plays and when. Party colours are `var(--party)` under `partyClass(party)`.

## Pinned values

A change that moves the state hash or a view must re-record these in the same commit and say why:

| Where | What it pins |
|---|---|
| `packages/sim/test/results_pinned.slow.test.ts` | `GOLDEN_STATE`, `GOLDEN_VIEWS`, `GOLDEN_MONTHLY`, `GOLDEN_PATCHES`: a year of seed 1 in the mini world |
| `packages/sim/test/golden/job-order-2020.txt` | The slots each tick visits (`UPDATE_GOLDEN=1` rewrites it) |
| `packages/sim/test/long_run.slow.test.ts` (`specOrder`) | The same order for ten years, written out by hand: a new slot is added there too |
| `packages/sim/test/m1_contracts.test.ts` | The first draws of the eight pre-pivot RNG streams |
| `test/fixtures/ts-soak/` | The 50-seed soak baseline; its `state_hash` column is from before M1 and is not compared by `headless parity` |

Run a slow file by naming it: `scripts/check-fast.ps1 packages/sim/test/results_pinned.slow.test.ts`.
Lanes G, C, E and P each move the state hash once they fill their tables; each re-records the pins in
its own branch, and the orchestrator re-records them again after each merge.
