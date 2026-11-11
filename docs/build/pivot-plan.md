# Pivot plan: stock and prediction market sim on a deep US political sim

## Context

TechnoCapital20FF is today a read-only world sim (TypeScript, React in the browser, sim in a Web Worker). Logan has settled on what the game is: the player is a trader who advances time, reads news on a fake desktop and phone, bets on politics in a prediction market and trades stocks. Only the USA is simulated. Politics is built first and deep; the deep stock market follows. The app moves to Electron. This plan records the interview decisions and how to build them with parallel agents and fast tests.

## Decisions from the interview

| Area | Decision |
|---|---|
| Player | Pure trader, no influence on the world yet. Small stake, open-ended, ranked against NPC funds. Bankruptcy ends the run. Difficulty presets. Tax on realised gains (rates set by bills). Interest on cash, margin and short borrow tied to the policy rate. Max 5% of any stock. |
| Time | Hourly ticks; pause, unpause, step one hour. Slow and close: max speed is about one game day per second. Auto-pause on player alerts plus a fixed list (own fill or resolution, margin call, election day, scandal or vote touching a holding). |
| Start | Play always starts in 2020. Each game's 2020 comes from pre-simulating the 1995 world for 25 years with a random scenario in a coarse mode. A few checked pre-baked 2020 starts ship for instant play and tests. The hand-built 2020 world is retired. |
| Economy | US companies fully simulated; each industry's foreign firms become one "rest of world" block. Laws move macro levers, per-industry rules, tariffs (on the block) and state growth. |
| Politics | President, 100 senators, 435 House members, 50 governors as individual NPCs; primaries and generals. Real states and about 3,100 real counties, invented people. County lean, elasticity and turnout. Districts built from counties; the governor's party redraws after each census, with court challenges. No towns. |
| Campaigns | War chest, ad and field spending by place, rallies and debates with stat checks, endorsements, scandals. |
| Governing | Bills as objects with per-member roll calls, plus executive actions (cabinet, orders, Fed chair, courts, shutdowns, impeachment). |
| People | State benches, on-demand challengers, out-of-work executives crossing over. XP from wins and achievements; a level-up raises a random stat. Stats hidden except in debug (Omniscient). Two parties with faction fights; rare realignment. |
| Information | Outlets with slant and reliability, social feed with rumours, pollsters with house effects, a forecast site, an always-true official-records site. Text from deterministic templates; the template bank is LLM-authored offline. |
| Election night | Result fixed at poll close; counties report over hours and days; markets stay open; recounts; settlement on certification. |
| Prediction market | Order book. NPC bettors hold noisy, biased beliefs built only from published information. Books are deep, but a rich player can move them. Contracts: race winners, chamber and bracket markets, bills and confirmations, people events. Written rules, no refunds. |
| Stocks | Price-taker trading on formula prices first. Later: real order book, named NPC funds with real holdings, limit and stop orders, shorting, margin, options. |
| Shell | Electron. React UI kept. Sim in a Node utility process. Browser no longer a way to play. Fake desktop OS (one timeless cyberpunk style) with a phone. Pdoomberg, a new USA county and district map, wiki-style pages and the omniscient debug workspace all kept as apps. |
| Process | New spec first. Fast per-change checks; full gate, short soak and re-baseline only at milestones. As many agents as there are independent lanes; heavy runs queued one at a time. |

### Defaults I chose (correct any of these)

- **Big counties:** a district is a list of whole counties plus weighted shares of large ones (Los Angeles and similar), so districts stay equal in population. The map shades a split county by its largest share.
- **County leans for 1995:** county offsets from the free 2000 county returns, re-centred on the 1992 state margins already in the data. Licences are confirmed in M0.
- **Bettors:** about 30 cohorts per contract class (partisans, poll followers, market makers, noise, arbitrage) with bankrolls, not hundreds of individuals. Named funds arrive with the stock order book.
- **Player orders** are a new `PlayerAction` message, separate from `Control`, because they change sim state and must be recorded for replay.
- **Starting cash** and fees come from the difficulty preset (default $50k).

## Architecture

### Sim (`packages/sim`)

- **Fidelity:** `World.fidelity: "Coarse" | "Full"`. `schedulerRegister` in `time/scheduler.ts` takes a fidelity tag and `schedulerRunTick` skips non-matching jobs. Shared by both: county drift, census, redistricting, careers and XP, the vote count kernel, lever application. Coarse only: one-scalar campaigns, a quarterly agenda with one roll call per bill, headlines. Full only: staged campaigns, bill state machine, media, election-night waves, exchange, bettors, player.
- **Pre-sim:** `simRunUntil(sim, date, onProgress)` in `lib.ts` loops ticks with no view refresh. `fidelity/hydrate.ts` replaces `eraRevealJob`'s end-of-run at 2020-01-01: trims era state, creates outlets and pollsters, opens the 2020 cycle, backfills war chests and 60 days of polls, lists contracts, seeds books, creates the player, sets Full.
- **Pre-baked starts:** `apps/headless --bake --seed N` writes `assets/starts/*.tcsave` plus an index (seed, hash, save version). Re-baked at each milestone.
- **New state** under `types/state/`: `geo.ts` (County, District, DistrictPlan), `elections.ts`, `governing.ts` (Bill, ExecAction, Levers), `media.ts`, `exchange.ts`, `player.ts`; `politics.ts` gains Governor, a `Person` table that outlives office, benches and factions. Logic in `geo/`, `elections/`, `governing/`, `media/`, `exchange/`, `predict/`, `player/`.
- **Levers:** promote the era-only fields in `era/policy.ts` into `World.levers` (macro, per-industry, tariff, state growth, player tax). The economy reads only `World.levers`.
- **USA cut:** data-first. `tools/world-1995/gen.py` emits US companies, one country, one zone. `Industry.row_assets` is split from the existing load-time fringe (`fringeAssetsAtLoad` in `economy/supply.ts`) and scaled by tariffs.
- **Exchange:** `exchange/` is generic (integer ticks, price-time priority, Limit/Market/Stop, shared `Account`), used for binary contracts now and for stocks and options later. Binaries are fully collateralised.
- **Truth firewall:** a boundary rule in `scripts/ts/boundary.ts` forbids `predict/` and `media/` belief code from importing hidden stats or `elections/count.ts`.
- **Text:** articles and posts store `{template_id, args}`; views render them. `media/grammar.ts` is the engine; `tools/text-bank/` writes `assets/text/`.
- **Reuse:** `drawPerson`, `PARTY_BLOCS` (`politics/generate.ts`); `shares`, `utility` (`politics/vote.ts`) as the county kernel; `equalProportions`, `driftYear`, `drawCensus` (`politics/era.ts`); `ChunkLog`; `sortedEntries`; `num.ts`; `libm.ts`; the `views/patch.ts` slice pattern.
- **RNG and saves:** five new streams (Campaign, Governing, Media, Bettors, Count). `SAVE_VERSION` bumps once per milestone, in the contracts PR.
- **Budget (Full):** 3 ms average hourly tick, 40 ms at midnight. Hourly: dirty books, hot-contract orders, election-night waves, player orders. Daily: campaigns, polls, beliefs, articles, bill stages. New Weekly slot: fundraising, endorsements, forecast, listings. County votes computed only at poll close.

### Shell and UI

- **`packages/sim-host/`:** `host.ts` and `loop.ts` moved from `apps/web/src/sim/real/` (already free of Worker globals).
- **`apps/desktop/`:** `main/` (window, `app://` protocol serving the renderer and `/data/*`), `preload/` (hands a MessagePort to the page), `sim/entry.ts` (utility process, reads data with `fs`). `apps/web/src/sim/client.ts` gains a port transport; the store is unchanged. electron-vite for dev and build.
- **Protocol** (`types/protocol.ts`): `NewGame.start` (baked or generate), `Progress`, `Cancel`, slot saves written by the sim process to `userData/saves/` with a rotating autosave, and `Act` carrying a `PlayerAction`.
- **Desktop:** `apps/web/src/os/` holds a small custom window manager (`wm.ts` reducer, `Desktop`, `Window`, `Taskbar` with date, pause, step, speeds), `phone/`, and an app registry that globs `apps/*/app.tsx` (same pattern as `pages/registry.ts`).
- **Apps** in `apps/web/src/apps/`: news, social, polls, records, betting, brokerage, browser (existing `pages/` doc framework, public facts only), usmap (deck.gl, county TopoJSON, district outlines from `topojson.mesh` on the current assignment, colour-only updates on election night), terminal (Pdoomberg), debug (today's dockview workspace, Omniscient only).
- **Views** (types in `packages/sim/src/types/views/`): `v_feed`, `v_social`, `v_polls`, `v_forecast`, `v_races`, `v_people`, `v_records`, `v_markets`, `v_account`, `v_notifications`, `v_districts`, `v_usmap_layers`, `v_returns`. Hidden stats are stripped in view builders (today's `PoliticianRow` exposes skills and traits).
- **Deleted:** world province map and its topology, country, zone, world and province pages, `MANIFEST_2020`, `docs/design/data` CSVs and their generator, after 44 test files are re-pointed to a frozen `packages/sim/test/fixtures/world-mini/`.

### Testing

- **`scripts/check-fast.ps1` / `.sh`:** incremental `tsc -b`, `biome check --changed`, the boundary scan, and `vitest run --changed` limited to touched projects, skipping `*.slow.test.ts`. Target under 90 seconds. First task: time the suite and rename the slowest files.
- **End to end:** Playwright launching Electron (`apps/desktop/e2e/`), smoke on the mock sim, screenshots on a paused pre-baked save. `apps/desktop/scripts/drive.ts` lets an agent launch, click by test id and screenshot.
- **Milestone gate:** existing `scripts/check-ts`, Electron build, full e2e, re-bake, a coarse 25-year soak with sanity bands, a 2-year Full soak, a state-hash match between Node and Electron, then baselines regenerated for Logan to accept. `scripts/heavy.ps1` holds a machine-wide lock so heavy runs queue across worktrees.

## Milestones and lanes

Every milestone opens with one serial **contracts PR** (types, ids, scheduler slots, streams, save version, empty view builders, protocol, mock fixtures). Lanes start after it merges, each in its own worktree on `build/<milestone>-<slug>`, owning disjoint folders, running `check-fast`. A reviewer agent checks each lane before merge. The milestone gate runs once at the end.

**M0. Spec, contracts, spikes** (serial, then 3 spikes in parallel)
- Write `docs/design/pivot/spec.md` with numbered sections; update `CLAUDE.md` rules; log decisions.
- Spikes: pack/crack redistricting on real counties with split shares; coarse 25-year timing with 3,100 counties; save size with counties and a people table. Confirm county data licences.
- `check-fast` and the slow-test split.

**M1. Foundations** (8 lanes)

| Lane | Owns |
|---|---|
| S1 Data | `tools/world-1995/**` (incl. `counties/`), `assets/worlds/1995/**`, `packages/sim-data/**` |
| S2 Test migration | `world-mini` fixture, 2020 deletion, `scripts/check-ts.*` |
| S3 Economy | `economy/supply.ts`, `world/load.ts`, `World.levers` |
| S4 Fidelity | `time/scheduler.ts`, `lib.ts`, `fidelity/`, headless `--bake` |
| U1 Electron | `apps/desktop/**`, `packages/sim-host/**`, `sim/client.ts`, `sim/spawn.ts` |
| U2 OS shell | `apps/web/src/os/**`, `App.tsx` |
| U3 Mock data | `apps/web/src/sim/mock/**` split into per-domain fixtures |
| U4 Tooling | `apps/desktop/e2e/**`, `drive.ts`, `scripts/heavy.*` (after U1 boots) |

**M2. Electorate and offices** (sim 4 lanes, UI one lane per app on the mock)
- Sim: `geo/` districts and redistricting; `elections/count.ts`, coarse elections, governors; `politics/careers.ts` with bench and XP; `player/` with price-taker trading, tax and interest.
- UI: news, social, polls, records, browser, usmap, terminal, debug, phone.

**M3. Campaigns and governing** (sim 5 lanes, UI 3)
- Sim: campaigns and primaries; bills; executive actions and levers into the economy; factions and realignment; `fidelity/hydrate.ts`.
- UI: wire apps to real views; new-game screen with pre-sim progress; saves; delete the world map.
- First playable: watch a real election cycle through the desktop.

**M4. Information layer** (5 lanes)
- Outlets and articles with the grammar engine; pollsters and forecast; social feed and rumours; records views; the offline template bank.

**M5. Prediction market** (sim 5 lanes, UI 2)
- `exchange/`; contract listing, rules and resolution; bettor beliefs; election night and recounts; player orders and alerts.
- UI: betting app, account, alert rules and auto-pause.
- The politics-first game is complete here.

**M6+. Deep stock market**
- Stock order book and named funds on `exchange/`, replacing the anonymous cap table; limit and stop orders; shorting; margin and liquidation; options. Planned in detail after M5.

## Main risks

1. Redistricting on real counties (contiguity, splits, determinism): spiked in M0.
2. Coarse and Full disagreeing, so a hydrated 2020 looks unlike a played one: a soak runs Full for 2018 to 2020 and compares seat and lever distributions.
3. Migrating 44 test files off the 2020 world before deleting it.
4. Bettor beliefs leaking hidden truth: enforced by the boundary rule.
5. Memory and message cost across processes: views sent as deltas and slices only.
6. Pre-baked saves going stale: version check plus the re-bake step in the gate.

## Verification

- Per lane: `scripts/check-fast.ps1` passes in under 90 seconds.
- M1: `drive.ts` boots the Electron app on the mock and screenshots the desktop; the same seed gives the same state hash in headless Node and in the Electron utility process.
- M3: generate a new history, reach 2020, run through November, and see county returns fill the map; the records app totals match the debug views.
- M5: place and cancel a bet, see it fill, auto-pause on resolution, and settle on certification; a test asserts a wrong-poll scenario produces mispriced contracts.
- Each milestone: full gate, re-bake, soaks within bands, baselines accepted by Logan.
