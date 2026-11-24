# Pivot handoff: where M0 to M2 stand and what is left

Written 2026-11-11 for whoever continues this (another model or Logan). Read this first; then
[pivot-plan.md](pivot-plan.md) (the approved plan and the decisions from Logan's interview),
[../design/pivot/spec.md](../design/pivot/spec.md) (the spec, cited in code as `pivot N.N`) and
[pivot-lanes.md](pivot-lanes.md) (M2's contracts and lane table). Decisions D1026 to D1062 in
[decisions.md](decisions.md) record every choice the spec left open; the next free number is **D1063**.

## One paragraph

The game is a stock and prediction market sim on a deep US political sim: the player is a trader on a
fake desktop OS ("Orrery") who advances time (hourly ticks), reads published news, bets on politics
and trades stocks. Play always starts in 2020, produced by pre-simulating the 1995 world for 25 years
at Coarse fidelity. The app is Electron (React UI, sim in a Node utility process). Milestones M0, M1
and M2 are built and in `main` (pull requests #127 and #128; the Electron close-out is #129). M3 to
M6 are not started.

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

- M0 and M1 are in `main` via #127, M2 via #128. Save version 8 (D1059's `Ledger.special_charge`).
- The playable 2020 world is removed (D1053, D1055; [pivot-2020-removal.md](pivot-2020-removal.md)):
  1995 is the only world, and the mock plays it. Its tables live on twice: as the 1995 generator's
  input in `tools/world-1995/source/`, and frozen for the tests, the research tools and the parity
  soak in `packages/sim/test/fixtures/world-mini/` (id "2020", `NO_ERA_WORLD_ID`). The map pipeline
  is frozen until M3 deletes it with the province map.
- `features.usa_only` is on in the 1995 manifest: US companies only, foreign supply folded into
  `Industry.row_assets` (D1034, D1038). Stock charts keep 3 years of daily bars in era worlds.
- Baked starts are not committed (`assets/starts/*.tcsave` is git-ignored): run
  `bash scripts/bake-starts.sh` (about 40 s for three seeds, about 11 MB each).

## Verification of this tree (re-run 2026-11-23 on main 44c96c6 plus D1057 to D1062)

**The full gate is green** with Logan's soak rulings in (D1057 to D1059: the fatigue on the
presidency only, company shocks with save version 8), the hidden data closed at the source (D1060)
the greedy district drawer (D1061, D1062, replacing D1058's budget) and D1062's shortcuts. The soaks
were re-recorded on this tree: no crash or NaN, every politics band passes on these 40 seeds.

| Check | Result |
|---|---|
| `scripts/check-ts.sh` (full gate) | **Passed** 2026-11-23: 257 of 257 test files, then the three data checks (the frozen test world, and 1995's two). `results_pinned` re-recorded for D1059 (with `special_charge` stripped the frozen world's state hash is the old one) D1060 (the state hash unchanged; seven views' digests moved) and D1062 (careers: the state hash and v_people moved, the economy views did not). |
| `pnpm e2e` (49 tests) | **Passed** 2026-11-23: 49 of 49 (1.2 min), on re-baked starts (save version 8), after D1062 too. The smoke test "the mock's first scripted pause is a notification" failed twice while the machine was loaded (runs of 24 s, not 14): at Max speed the mock can reach its next scripted pause (27 Oct 15:00) before Playwright sees the note clear. Timing, not this change: it passes on this tree and on untouched main alike when the machine is idle. |
| `... --filter @tc20ff/desktop determinism` | **Passed** 2026-11-23: headless Node, the desktop bundle under Node and the Electron utility process give the same state hash (1995, seed 1, one year; `00f1176926d6285d602df8954140b6ad`; it moved with D1057 to D1059 and with D1062, whose careers and consensus act in the first year, and not with D1060 or D1061). |
| Soaks (Coarse 25-year, Full 2-year, with sanity bands) | **Re-recorded** 2026-11-23 (D1057 to D1062; first run D1056). Economy: `headless calibrate`, 3 scenarios × 50 seeds, no failure; targets met 678, 686 and 693 of 700 (were 592, 597, 647). Politics: `pivot-soak.ts`, 40 seeds, 25 of 25 checks in 102 s (no lopsided chamber on these seeds; the first run had 7 Coarse and 2 played). Baselines in `test/fixtures/soak-1995/` and `test/fixtures/pivot-soak/`. |

The three gate failures of 2026-11-11 and how they closed:

1. `m10_boom_pop.slow` "the start replica is start world": the test lacked the four lane starts that
   `START_DEPS` now runs; fixed in 6ac1fc2.
2. `era_sectors.slow` "the exit rule removes firms over a run": the exit rule still fires; seed 3's
   only long loser became its industry's sole firm, which the rule spares. The test now sums exits over
   seeds 1 to 3, and the "never an industry's last" check is a direct `settleJob` test (D1054).
3. `m1_usa_only_run.slow` seed 2: seed noise. Seeds 1 to 5 give ratios 0.92 to 1.54 (mean 1.21); the
   per-seed bound is now `CUT_TO_HOME_MAX` = 1.75 (D1054).

## Pending, in the order I would do it

### A. Before merging the M2 pull request

1. Read the verification block above. Anything not shown as passing there is unverified. Done 2026-11-19: the two gate failures are fixed (D1054) and the gate and the whole `e2e` pass.
2. Done 2026-11-20 (D1056): the soaks ran (results in the verification table; READMEs in
   `test/fixtures/soak-1995/` and `test/fixtures/pivot-soak/`). Logan ruled 2026-11-23: both baselines
   accepted and re-recorded after the fixes; the fatigue moves the presidency only (D1057, which also
   needed the district drawer's budget, D1058); `entries` scaled to the cut and American firms given
   company shocks to meet the `failures` floors (D1059). `test/fixtures/ts-soak/` (the parity baseline)
   was recorded on the old 2020 world and stays the frozen test world's baseline (rerun with
   `--data-dir packages/sim/test/fixtures/world-mini`); its `state_hash` column is not compared. A 1995
   baseline is now recorded (`test/fixtures/soak-1995/`) and becomes the default once it settles and
   parity can read an era folder (D1053, D1056).
3. Logan has not reviewed D1026 to D1052. The ones most likely to need his eye: D1027 (defaults chosen
   without asking), D1028 (county `spread`), D1038 (3-year stock charts, startup scaling), D1042
   (player rules), D1052 (integration rules, including who keeps their district after a redraw).
4. Data caveats (tools/world-1995/counties/README.md): the 1992 county returns come from the
   Algara-Amlani dataset (CC0) whose original source is unconfirmed; three constants were typed from
   memory (Broomfield's 1990 population, Missouri's 1992 total, the national 1992 totals); the MIT
   GitHub copy of 2000 county returns has no licence file (used only for Alaska's turnout; the CC0 copy
   needs a manual browser download); Hawaii's state lean in `gen.py` is 12.9 where the returns give 11.4.

### B. Known defects and loose ends

- **Lopsided chambers, a tail left:** the fatigue tide on every race made 9 of 80 runs lopsided; on
  the presidency only (D1057) the runs before D1062 kept 4 or 5, all House waves of 80 to 110 seats
  from the national swing (`NATIONAL_SWING_SD`) and the economy term (`ECONOMY_PER_POINT`, D986). The
  final 40 seeds have none, so the band passes, but a wider seed range may find one; for Logan.
- **Company shocks (D1059) are tuned on 50 seeds a scenario**: `failures` still misses in 5 stable,
  4 unstable and 2 stagnation seeds, and stable's `entries` in 11 (its floor assumes failures at their
  floor).
  The shocks hit after 2020 too, about one American company every two years.
- **Six House seats are empty at the 2020 start**, vacated on 1 January and waiting for specials.
- **The politics POC still runs beside the new tables in county worlds** (its start, its mirror):
  `elections/mirror.ts` copies seats back so the old politics page and the era levers keep working.
  `PRESIDENT_TERM_LIMIT` and `START_PRESIDENT_PARTY` exist in both `politics/jobs.ts` and `careers.ts`;
  `v_politics` lags the mirror until the next politics day. M3 should retire the POC.
- **Executive crossover is narrow:** only board members of bankrupt US companies can enter politics.
- **The district drawer is greedy (D1061, D1062)**, not a search: one ranked cut per split with one
  step of look ahead, drawn once at its strength and compared only with neutral. A full-strength
  gerrymander moves about a third fewer seats than the old search did (221 against 234 party-A seats
  nationally for A at 1), and a stronger drawer is not promised more than a weaker one.
- **Shortcuts taken on purpose (D1062):** careers rebuilds benches and platforms only on a change and
  on the 1st; a historical world's consensus is the run rate (last quarter's net income grown by the
  plan), not spec 5.16's projection; the POC mirror and the specials follow the offices weekly; a
  judicial nomination walks one ranked slate. Revisit any of them if play shows the cost.
- **Gerrymander strength is provisional** (mean about 0.39 with stand-in politicians; challenges rare):
  re-check with real governors.
- **County results are kept only for the latest general** (and the latest presidential one): Records'
  `results/<other cycle>` says so.
- **Economy tuning of the USA cut** (D1038): the US index runs about 11% high at 2020, the rest-of-world
  block is 9.3% of supply against 5.5% for foreign firms in the full world, the IPO cap is not scaled,
  and dormant sectors get a block only from their founding wave.
- **Money system gaps:** no difficulty field in the new-game picker (sim, protocol and host support it),
  no margin, shorting, options or settlements (M5, M6).
- **Hidden data is closed at the source (D1060):** the views carry hidden stats, what is read from
  them and the AI's private intent only in Omniscient; the Browser's label lists are gone. Any new
  view field that reads skills, traits, integrity, a locked plan or the sim's own forecast must be
  null outside Omniscient (`test/views/hidden_stats.test.ts`, `leak.slow`).
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
  executive-action, campaign, endorsement and scandal state; save version 9 (8 is D1059's); a lane table.
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
- Then: update CLAUDE.md for the finished layout. (The playable 2020 world is already gone, D1055.)

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
