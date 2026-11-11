# Pivot handoff: where M0 to M2 stand and what is left

Written 2026-11-11 for whoever continues this (another model or Logan). Read this first; then
[pivot-plan.md](pivot-plan.md) (the approved plan and the decisions from Logan's interview),
[../design/pivot/spec.md](../design/pivot/spec.md) (the spec, cited in code as `pivot N.N`) and
[pivot-lanes.md](pivot-lanes.md) (M2's contracts and lane table). Decisions D1026 to D1052 in
[decisions.md](decisions.md) record every choice the spec left open; the next free number is **D1053**.

## One paragraph

The game is a stock and prediction market sim on a deep US political sim: the player is a trader on a
fake desktop OS ("Orrery") who advances time (hourly ticks), reads published news, bets on politics
and trades stocks. Play always starts in 2020, produced by pre-simulating the 1995 world for 25 years
at Coarse fidelity. The app is Electron (React UI, sim in a Node utility process). Milestones M0, M1
and M2 are built. M0 and M1 are in `main` (pull request #127, merged by Logan 2026-11-11). **M2 is
not in `main`:** it is 88 commits on branch `claude/stock-market-prediction-game-7c4f97`, in its own
pull request (see the PR list; it was opened after #127 merged). M3 to M6 are not started.

## What is real and what is only a mock (read this before demoing anything)

The UI apps were built against the **mock** sim (`apps/web/src/sim/mock/`, a seeded fake election
year starting 2020-10-20). The real sim does not yet produce most of what they show.

| Real sim produces (M1 and M2) | Still empty in the real sim (apps show nothing real) |
|---|---|
| Economy, companies, prices (the old 30 views) | `v_feed` (News), `v_social` (Social) |
| Counties, districts, redistricting, courts (`districts`, `usmap_layers`) | `v_polls`, `v_forecast` (Polls) |
| Persons and every office, benches, careers (`people`) | `v_records`: bills, roll calls, finance (Records) |
| Races and certified results, county to Electoral College (`races`, `returns`; complete at once, no election-night waves) | `v_markets` (no prediction market, no betting app) |
| The player account: price-taker stock trading, tax, interest, bankruptcy (`account`, `notifications`) | Campaigns in Full play (the campaign job is Coarse-only), bills, executive actions |

So today, in the real app, a generated 2020 game has a working map and people, a working account
and Pdoomberg order ticket, and a politics sim that runs elections and handovers; the News, Social,
Polls and Records apps are empty until M3 and M4 produce their data.

## Branch, PR and tree state

- Branch `claude/stock-market-prediction-game-7c4f97`: M0 and M1 are in `main` via #127; M2 and this handoff are the open pull request. Save version 7.
- The playable 2020 world (`docs/design/data`, `?world=2020`, `--world 2020`) still exists; tests run
  on a frozen copy, `packages/sim/test/fixtures/world-mini/` (id "2020"). Removal steps are in
  [pivot-2020-removal.md](pivot-2020-removal.md): the 1995 generator and the map pipeline read the 2020
  data folder as source rows, so it is not a plain delete.
- `features.usa_only` is on in the 1995 manifest: US companies only, foreign supply folded into
  `Industry.row_assets` (D1034, D1038). Stock charts keep 3 years of daily bars in era worlds.
- Baked starts are not committed (`assets/starts/*.tcsave` is git-ignored): run
  `bash scripts/bake-starts.sh` (about 40 s for three seeds, about 11 MB each).

## Verification of this tree (run 2026-11-11, final merged tree)

**The full gate is not green.** Two slow tests still fail; do not describe this branch as gate-clean.

| Check | Result |
|---|---|
| `scripts/check-fast.sh all` | Passed: 212 files, 1,551 tests, plus the 1995 data checks (90 s). Run before the test fixes below. |
| `scripts/check-ts.sh` (full gate) | **Failed in the test step: 3 of 1,732 tests** (250 of 253 files passed, 356 s). The four data-check steps after it did not run inside the gate; the 1995 pair passed in the fast check, and the 2020 pair were last run by hand at the end of M1 (OK; the 2020 data has not changed since). |
| `pnpm e2e` (49 tests) | 48 passed, 1 failed: the Social person-link tour test, a timing race in the test (Social redirects a person route to the handle page after its data loads; the test read the address too early). Fixed; the tour alone was re-run and passes (32 of 32). The whole `e2e` was not re-run after that fix. |
| `... --filter @tc20ff/desktop determinism` | Passed: headless Node, the desktop bundle under Node and the Electron utility process give the same state hash (1995, seed 1, one year; `fa8c7edc0d7e46d47be622e9bdf465e4`). |
| Soaks (Coarse 25-year, Full 2-year, with sanity bands) | Not run. |

The three gate failures and where they stand:

1. `m10_boom_pop.slow` "the start replica is start world": **fixed.** The test hand-copies the start
   sequence and lacked the four lane starts (geo, persons, elections, player) that `START_DEPS` now
   runs; it passes alone (3 of 3).
2. `era_sectors.slow` "the exit rule removes firms over a run": **open.** Seed 3, scenario "unstable",
   run to 2006: the history view's `failures` is 0 where the test expects more than 0. The USA-cut
   lane (D1038) reported this file passing, so the integration pass (D1052) moved it, most likely
   through who governs (and so the tax and fiscal levers) or the vote's economy-term clamp. Find out
   whether the exit rule is still firing (bisect the merges from `cd70109` to HEAD) before changing
   the test's seed or horizon; a seed-robust version would check several seeds.
3. `m1_usa_only_run.slow` seed 2: **open.** The cut world's US startups are 80 against a bound of
   78 (1.5 times the uncut world's 52). D1038 measured the mean ratio near 1.1 over five seeds, so this
   looks like seed noise past a tight bound that was tuned on the earlier random state; widen the bound
   or average over seeds, and log it.

## Pending, in the order I would do it

### A. Before merging the M2 pull request

1. Read the verification block above. Anything not shown as passing there is unverified. First job: the two open gate failures (`era_sectors.slow`, `m1_usa_only_run.slow`), then re-run `scripts/check-ts.sh` and `pnpm e2e` whole.
2. The soaks with sanity bands that the plan puts in every milestone gate have **not been run**
   for the pivot: a Coarse 25-year run over several seeds and a Full 2-year run, checked for no NaN,
   prices and turnout in range, parties competitive. `test/fixtures/ts-soak/` (the parity baseline)
   was recorded on the old 2020 world and is stale; its `state_hash` column is not compared. Decide
   whether to re-baseline on the 1995 world.
3. Logan has not reviewed D1026 to D1052. The ones most likely to need his eye: D1027 (defaults chosen
   without asking), D1028 (county `spread`), D1038 (3-year stock charts, startup scaling), D1042
   (player rules), D1052 (integration rules, including who keeps their district after a redraw).
4. Data caveats (tools/world-1995/counties/README.md): the 1992 county returns come from the
   Algara-Amlani dataset (CC0) whose original source is unconfirmed; three constants were typed from
   memory (Broomfield's 1990 population, Missouri's 1992 total, the national 1992 totals); the MIT
   GitHub copy of 2000 county returns has no licence file (used only for Alaska's turnout; the CC0 copy
   needs a manual browser download); Hawaii's state lean in `gen.py` is 12.9 where the returns give 11.4.

### B. Known defects and loose ends

- **Lopsided Senate:** in the real pre-simulation, seed 2's Senate reached 80% one party in 2008 and
  78% in 2010 (crash under the incumbent party, then the fatigue tide on a fifth straight term, held in
  place by six-year terms). The 75% bound fails; the levers left are the tides (1995-rework 7.3) and
  incumbency. Seed 3's 2020 House is 131 to 300.
- **Six House seats are empty at the 2020 start**, vacated on 1 January and waiting for specials.
- **The politics POC still runs beside the new tables in county worlds** (its start, its mirror):
  `elections/mirror.ts` copies seats back so the old politics page and the era levers keep working.
  `PRESIDENT_TERM_LIMIT` and `START_PRESIDENT_PARTY` exist in both `politics/jobs.ts` and `careers.ts`;
  `v_politics` lags the mirror until the next politics day. M3 should retire the POC.
- **Executive crossover is narrow:** only board members of bankrupt US companies can enter politics.
- **Gerrymander strength is provisional** (mean about 0.39 with stand-in politicians; challenges rare):
  re-check with real governors.
- **County results are kept only for the latest general** (and the latest presidential one): Records'
  `results/<other cycle>` says so.
- **Economy tuning of the USA cut** (D1038): the US index runs about 11% high at 2020, the rest-of-world
  block is 9.3% of supply against 5.5% for foreign firms in the full world, the IPO cap is not scaled,
  and dormant sectors get a block only from their founding wave.
- **Money system gaps:** no difficulty field in the new-game picker (sim, protocol and host support it),
  no margin, shorting, options or settlements (M5, M6).
- **Leaks in the old page kinds** (company page, politics, industries, recap): see
  [pivot-m3-requests.md](pivot-m3-requests.md). This is required work, not optional.
- Window layouts below about 500 px are checked only in happy-dom for most apps; real-pointer resize
  of a snapped window is covered only by unit tests.
- `apps/desktop/README.md` still says `--mock` starts at 2020-01-01 hour 0 (it starts 2020-10-20) and
  does not mention `--tour`. `e2e/run.ts` takes the machine lock only when `@real` is included.
- `scripts/check-fast.ps1` can be blocked by this PC's PowerShell execution policy; use the `.sh` twin.
- Some agent commits carry `Co-Authored-By: Claude Opus 5.5` or `Sonnet 5.5` trailers instead of the
  repo's usual line; harmless, say so if you want them reworded.
- Worktrees from the lane agents may remain under `.claude/worktrees/agent-*` (merged; safe to remove
  with `git worktree remove`, which refuses if anything is uncommitted).

### C. M3: campaigns and governing (not started)

Scope from the plan and spec (pivot 6.3 to 6.5, 7, 5.12, 5.13, 3.4):

- **Contracts change first** (serial): apply [pivot-m3-requests.md](pivot-m3-requests.md); define bill,
  executive-action, campaign, endorsement and scandal state; save version 8; a lane table.
- Lanes (Opus for sim, Sonnet for apps): campaigns and primaries (war chests, ads and field spending by
  place, rallies and debates as stat checks, endorsements, scandals; elections' Coarse strength stays for
  Coarse), bills (drafted, committee, floor, per-member roll calls by stats and ideology, cloture 60,
  veto and override), executive actions (cabinet confirmations, orders, Fed chair, courts, shutdowns,
  impeachment) with laws moving `World.levers` (replacing the 1995 party-drift policy job, which is
  still running: `era/policy.ts`), factions and realignment (pivot 5.12, 5.13), and hydration finish
  (`fidelity/hydrate.ts`). Retire the POC. Fix the leaks.
- First playable target from the plan: watch a real election cycle through the desktop, with the News,
  Social and Records apps now showing real data requires M4's media sim too.

### D. Later milestones (from the approved plan)

- **M4 information layer:** outlets with slant and reliability, articles and posts from a deterministic
  template grammar (bank written offline with an LLM, `tools/text-bank/`, `assets/text/`), pollsters and
  the forecast model, rumours, official records views, the front-page job. This is what makes the four
  empty apps show real content.
- **M5 prediction market:** generic `exchange/` matching engine (integer ticks, price-time priority,
  limit, market and stop orders), contract listing, written rules and resolution (no refunds), about 30
  bettor cohorts with beliefs built only from published information (a boundary rule must forbid
  `predict/` reading hidden state), election-night reporting waves and recounts, player orders and alerts,
  the betting app, per-contract book and history slices.
- **M6+ deep stock market:** the order book on the same engine, named NPC funds with real holdings
  replacing the anonymous cap table, limit and stop orders, shorting, margin and liquidation, options.
  Specify before building (pivot 13.2).
- Then: delete the playable 2020 world, update CLAUDE.md for the finished layout, re-baseline soaks.

## How this was run (and how to keep running it)

- **Each milestone** opens with one serial contracts change, then lanes run in parallel, each in its own
  worktree with disjoint folders, then a merge pass, one integration pass for the sim lanes, and the gate
  once. The kit is in [pivot-agent-kit/](pivot-agent-kit/): `lane-preamble.md` (rules every lane agent
  reads), `app-lane-addendum.md` (extra rules for UI app lanes), `merge-lane.sh`. They name a base branch
  and a scratch folder from this session: update those. Give every lane agent its own decision number up
  front; `docs/build/decisions.md` now merges by union (`.gitattributes`).
- **Models:** Opus for the sim lanes, the contracts changes, the integration pass and the map; Sonnet for
  the other UI app lanes. Lane agents wrote good reports; always read the "not done" and "contract
  changes needed" sections.
- **Checks:** per change, `bash scripts/check-fast.sh <test paths>` (about a minute for sim, set
  `CHECK_FAST_BASE` to the branch tip so it diffs only your work); at milestones the full gate
  `bash scripts/check-ts.sh`, the end-to-end suite `corepack pnpm@10.20.0 e2e` (smoke, visual, real and
  tour, about 1.5 minutes) and `corepack pnpm@10.20.0 --filter @tc20ff/desktop determinism` (the same
  seed must give the same hash in headless Node and in the Electron process).
- **One heavy run at a time:** wrap anything heavy in `bash scripts/heavy.sh <command>`; it holds the
  machine lock `.claude/scratch/heavy.lock` (a stale lock is taken after two hours).
- **Never bring a window to the front:** launch the app with `--background` (the e2e fixtures and
  `apps/desktop/scripts/drive.ts` already do; `TC_E2E_SHOW=1` shows it). Logan asked for this; it is in
  memory.
- **Proving "behaviour unchanged":** when a change adds fields to the world the state hash moves. The
  pattern used since M1: record, month by month, the hash in the old layout (new fields stripped) and a
  digest of the old views before and after, show they match, then re-record the pinned values in
  `packages/sim/test/results_pinned.slow.test.ts` and the job-order golden once, stating why.
- **Pitfalls met:** a React effect returning a non-function crashes only the production build (the
  tour now covers the main routes); several lanes edit the same contract tests, so merge conflicts there
  are normal (combine job counts and ported-view lists); this PC's files mix CRLF and LF, so scripted
  edits must preserve each file's line endings; Playwright needs `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.

## Map of the new code

- Spec and plan: `docs/design/pivot/spec.md`, `docs/build/pivot-plan.md`, `pivot-lanes.md`.
- Sim: `packages/sim/src/{geo,elections,governing,fidelity,player}/`, `politics/{careers,people}.ts`,
  `types/state/{geo,persons,elections,player,governing}.ts`, `types/views/` (the 13 pivot views),
  `types/{action,protocol}.ts`, `views/{districts,usmap_layers,races,returns,people,account,notifications}.ts`.
- Data: `assets/worlds/1995/counties.csv`, `county-adjacency.csv` (generator `tools/world-1995/counties/`),
  `assets/usmap/counties.topo.json` (generator `tools/usmap/`).
- Host and shell: `packages/sim-host/`, `apps/desktop/` (main, preload, sim entry, e2e, `scripts/drive.ts`
  to drive the app by hand), `apps/web/src/os/` (window manager, taskbar, phone), `apps/web/src/shell/`.
- Apps (`apps/web/src/apps/`): `news` (Kiosk), `social` (Murmur), `polls` (Plumbline), `records` (Ledger
  of Record), `browser` (Almanac), `usmap` (Plat & Tally), `terminal` (Pdoomberg), `debug` (shown only
  with Omniscient), and `_shared/` (entity links, party colours, tables).
- Mock: `apps/web/src/sim/mock/` (README lists its scripted events and dates).
- Spikes with findings worth rereading: `tools/spikes/districts/`, `tools/spikes/coarse/`.
