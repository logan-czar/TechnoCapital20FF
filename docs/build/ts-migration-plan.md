# TypeScript migration plan (browser first)

_Draft for Logan, 2026-10-24. Approved in chat; not started._

## Context

Rust compile times and memory use are too much for Logan's PC, and cloud builds cost too much. The MVP is
**finished** (M1 to M10 and track P merged, signed off 2026-10-24), so this is a port of working, settled
code, not a rewrite mid-build. Goal: **the game plays the same**, while the UI, the RNG, the map rendering
and the tooling can change wherever TypeScript has an easier way. Starting data (CSVs, map tables) is
reused as is.

### What is being moved

| Crate | Source lines | Test lines | Becomes |
|---|---|---|---|
| `sim` (economy, finance, market, births, AI, news, recap, views) | 23,800 | 18,800 | `packages/sim` (pure TS, no DOM) |
| `sim-data` (CSV load + checks) | 1,800 | 560 | `packages/sim-data` |
| `game` (Bevy UI: workspace, tables, charts, 18 pages, Pdoomberg, map) | 30,300 | 8,000 | `apps/web` (React + Vite) |
| `headless` (soak, targets, metrics, replay) | 4,300 | 670 | `apps/headless` (Node CLI) |
| `mapgen` (raster builder) + `province_map.wgsl` | 1,650 | 240 | **dropped**: vector map instead (see Phase 4) |
| **Total** | **~62k** | **~28k** | expect ~40–50k TS: the libraries below replace a lot of hand-written UI |

Python tools (`docs/design/tools/`, `tools/map-pipeline/` minus its mapgen step) stay as they are.

## Stack (one npm workspace, no Rust anywhere)

- **TypeScript strict**, **Vite** dev server, **Vitest** tests, **Biome** for lint/format.
- **Sim runs in a Web Worker**; the UI gets read-only views by `postMessage` (Comlink). This replaces
  Bevy's plugin/bridge (`crates/game/src/bridge.rs`) and enforces the spec 9 views boundary physically:
  the UI cannot reach raw tables because they live in another thread.
- **React** for pages. Swap hand-built widgets for libraries:
  - `table/` (1,700 lines, virtualized sortable) → **TanStack Table + TanStack Virtual**
  - `chart/` (1,400 lines) → **TradingView lightweight-charts** (price/candles, fits Pdoomberg) or **uPlot**
  - `workspace/` (3,600 lines, panel model) → **dockview** (dockable/tabbed panels)
  - `command/` (command bar + search index) → **cmdk** + **fuse.js**
  - `config/` TOML → JSON settings (or `smol-toml` if the TOML files must stay)
- **Map** → **deck.gl** in an `OrthographicView` over province polygons pre-projected to Miller x/y.
  Fill colors per map mode, built-in hover/click picking, zoom/pan, `TextLayer` labels, `IconLayer` pins.
  This replaces `mapgen`, the ID/index/border PNGs, the WGSL lookup shader, `png_io.rs`, `picking.rs`
  and most of `camera.rs`/`render.rs`.
- **Headless**: Node + `tsx`, 50-seed soak in parallel with `worker_threads`.
- **RNG**: a small seeded generator (e.g. `sfc32`/xoshiro128**), one stream per system as today (D9),
  Box–Muller normals with the spare kept in state.
- **Save**: JSON (gzip with `fflate`), versioned. **State hash**: a fast hash over the canonical JSON,
  for determinism tests only. Replaces postcard + blake3 + flate2.

## Things that would bite if nobody planned for them

1. **The design docs say "all Rust, all Bevy"** (`docs/design/12-tech-and-roadmap.md` batch 168/169,
   build-plan section 2, CLAUDE.md). CLAUDE.md forbids code PRs editing design prose, so this needs a
   **docs PR first** (or a design-folder update through `scripts/sync-design.sh`). Note: batch 41 moved
   *off* the browser (Phaser) to a desktop app; worth one line in the new decision on why browser is OK now.
2. **Rounding and casts differ.** Rust `f64::round` rounds half away from zero; JS `Math.round` rounds
   half up (`-2.5 → -2`). Rust `as u64` truncates and saturates; JS does neither. 9 `.round()` and 74
   `as u64/i64/usize` sites in `sim` need shared helpers (`roundHalfAway`, `toU64Sat`), not inline JS.
3. **u64 share counts.** The largest start value is 1.8e9, far under JS's safe 9e15, so plain `number`
   works; add a `Number.isSafeInteger` assert in the share helpers so a bug can't overflow silently.
4. **Rust enums with data and newtype ids** (`CompanyId`…) → TS discriminated unions with exhaustive
   `switch` (a `never` check) and branded id types. Without these, TS loses most of what kept the Rust
   port safe.
5. **Iteration order.** JS `Map` keeps insertion order (fine); every `BTreeMap` needs explicit sorted
   keys; sorts need id tie-breaks (lower id wins, as today). Never sort strings with `localeCompare`
   in sim code (it differs by machine); compare code units.
6. **The leak test** (no private truth on screens) used a Cargo feature (`test-hooks`) to hide raw
   tables. In TS: package `exports` only expose views, plus a Biome/ESLint import rule; the worker
   boundary covers the rest. Port `crates/game/tests/m9_leak.rs` as a test over the view types.
7. **Old saves and replay hashes won't carry over** (save version 11, Rust hashes). No players have
   saves, so this only matters for tests: goldens get regenerated in TS.
8. **The drift fixes (`docs/build/drift-plan.md`, spec v1.5) are planned but unbuilt.** Don't build
   them in Rust. Port v1.4 behavior first, prove it matches, then build v1.5 in TS.
9. **Map vector source isn't committed.** `provinces.geojson` lives in the pipeline cache
   (`D:\Data\tc20ff-geodata\work/<region>/`). One pipeline run (~9 min, needs uv + Node, **not cargo**
   once the mapgen step is replaced) must export a committed, simplified `provinces.topojson`.
   Adjacency, centroids and coastal flags stay as the committed CSVs; recompute from TopoJSON shared
   arcs (`topojson-client` `neighbors`) only if the map is rebuilt.
10. **Performance is not a worry.** A 30-year run takes 5.5–7 s in Rust against a 2-minute budget, so
    JS can be 10× slower and still pass. Keep the hot loops (hourly price step) on plain arrays, not
    objects-per-tick, to avoid GC spikes. Screens must still open < 100 ms: virtualize every long list.
11. **Memory and workflow notes go stale** (warm `target/` lane slots, `check.ps1`, nextest). Update
    the memory file and CLAUDE.md when Rust is deleted.

## How "plays the same" is proven (no bit-exact RNG match needed)

- **Formula goldens**: the golden tests that come from `validate.py` (build-plan 4.2; e.g.
  `crates/sim/tests/spec_3_9.rs`, `m4_statements.rs`, `finance_common/`) are language-neutral. Port them
  first; they check each formula against Python with no RNG involved.
- **Per-section unit tests**: port the sim tests file by file alongside each module (they already cite
  spec sections).
- **Outcome parity**: before Rust is retired, run the Rust headless once (it builds today, ~seconds to
  run) and export the 50-seed × 30-year metrics (`crates/headless/src/metrics.rs`, `targets.rs`) to a
  committed JSON. The TS soak must meet all 19 spec 10 targets **and** land each yearly metric's
  distribution inside the Rust band (e.g. TS median within Rust p10–p90). This is the parity gate.
- **Determinism**: same seed → same TS state hash twice in a row, and in Node vs browser worker.

## Phases and timeline

Estimates are **agent-assisted working days** (the same builder-lane style that wrote the Rust MVP
in ~9 days, Oct 16–24). Solo by hand it would be about 3–5 months.

| # | Phase | Work | Days |
|---|---|---|---|
| 0 | Decide + scaffold | Docs PR (new tech decision, build-plan section 2, CLAUDE.md). npm workspace, Vite, Vitest, Biome, `scripts/check` (tsc, biome, vitest, validate.py). Export the Rust soak reference JSON. Freeze Rust feature work | 1 |
| 1 | Data | `sim-data`: CSV load (papaparse), unit conversion once at load ($M/$bn/bps), the `checks.rs` validations, `--check-data` CLI | 1–1.5 |
| 2 | Sim core | rng, calendar/scheduler, world/entities/load/log; then economy, ops, finance (jobs, rating), market, births, AI, people, news, recap; views (incl. `estimate.rs`, `map_layers.rs`). Formula goldens first, module tests alongside | 6–8 |
| 3 | Headless + parity | Node soak/targets/metrics/replay/profile; 50-seed run in worker_threads; parity gate vs Rust reference; fix mismatches | 2–3 |
| 4 | Map | Pipeline step: mapshaper → TopoJSON, pre-projected Miller (`d3-geo-projection` `geoMiller`), replacing `mapgen_step.py`. deck.gl render, map modes from `map_layers` views, hover/click, labels, pins, province card | 2–3 |
| 5 | UI shell + pages | Worker bridge, dockview workspace, top bar/clock/speed, command bar, alerts, tables, charts, then the 18 pages + Pdoomberg, settings | 6–8 |
| 6 | Finish | Leak test, perf checks (screens < 100 ms, 60 fps), page bench, delete `crates/`, `Cargo.*`, `rust-toolchain.toml`, `assets/shaders/`; update CLAUDE.md and memory | 1–2 |
|   | **Total** | | **19–26 days ≈ 4–5 weeks** |

Those are effort totals for one lane. Run in parallel on the five lanes below, the calendar time is
**about 3–4 weeks**. Then build spec v1.5 (drift fixes) in TS.

Branches follow the current rule: `build/ts-<phase>-<slug>` cut from `main`, one PR per phase or
sub-phase, no stacked PRs. Rust stays in the repo, untouched, as the reference until Phase 3's parity
gate passes; it is deleted in Phase 6.

## Implementation plan: agents, lanes and steps

### Agent roles

| Role | Model | Does | Doesn't |
|---|---|---|---|
| **Orchestrator** | Opus | Writes the shared contracts (types), assigns steps, merges, runs the parity gate, debugs cross-module mismatches, owns the scheduler/job order port (the subtlest code: tick order decides results) | Bulk porting |
| **Builder** | Sonnet | Ports one module (Rust file → TS file, same names, same spec/D-number comments) inside the directories its lane owns; makes the tester's tests pass | Touch files outside its lane; change contracts (asks the orchestrator) |
| **Tester** | Sonnet | Ports Rust tests and validate.py goldens to Vitest **one step ahead** of the builders (test-first), runs `npm run check`, later builds headless/soak/leak/perf tests | Change sim code to make a test pass |
| **Reviewer** | Opus, fresh context | Reviews each PR against the Rust source it replaces and the spec section cited: rounding/cast helpers used, iteration order, id tie-breaks, no view leaks. Reviewer-then-merge, as today | Write the fix (sends findings back to the lane) |

Opus is needed at: Step 0 (contracts, views types, worker protocol), the scheduler/job-order port (S2),
the parity gate and mismatch debugging (Step 4), the dockview workspace design (U2), and every
review. Everything else is Sonnet.

### Five persistent worktrees (lane slots)

Reused for the whole port: `git checkout -B build/ts-<step>` per task, never a fresh worktree. Use
**pnpm** so the five checkouts share one package store instead of five copies of `node_modules`.
No compile cache to keep warm, so a lane switch costs seconds.

| Slot | Lane | Owns (directories) |
|---|---|---|
| W1 | Orchestrator (Opus) | repo root config, `packages/sim/src/types/`, `packages/sim/src/time/`, `scripts/`, docs, merges |
| W2 | Sim builder A (Sonnet) | `packages/sim-data/`, `packages/sim/src/{world,economy,ops,market}/` |
| W3 | Sim builder B (Sonnet) | `packages/sim/src/{finance,births,ai,people,news,recap}/`, `rng.ts` |
| W4 | UI builder (Sonnet) | `apps/web/`, `tools/map-pipeline/` export step |
| W5 | Tester (Sonnet) | `packages/*/test/`, `apps/headless/`, `test/fixtures/` |

Views (`packages/sim/src/views/`) are split by file between W2 and W3 in Step 3. Pages are split by
file among W2, W3 and W4 in Step 5. One writer per file, always.

### Steps (waves run in parallel; a wave starts when its inputs are merged)

**Step 0 — Contracts (W1 alone, day 1)**
- 0.1 Docs PR: tech decision (TS/browser replaces Rust/Bevy, batch-168 note), build-plan section 2,
  CLAUDE.md.
- 0.2 Scaffold: pnpm workspace, Vite, Vitest, Biome, tsconfig strict, `npm run check`.
- 0.3 Contracts: `World` table types, branded ids, the discriminated unions for Rust enums, every
  **view type** (from `crates/sim/src/views/`), the worker message protocol, and the shared numeric
  helpers (`roundHalfAway`, `toU64Sat`, safe-integer share math, `cmpId`).
- 0.4 Export the Rust 50-seed × 30-year metrics to `test/fixtures/rust-soak-reference.json` (last
  Rust build; reuse an existing soak report if one is current).
- Review: Opus reviewer on 0.3 (everything downstream builds on it).

**Step 1 — Foundations (days 2–3, 4 lanes)**
- W2: `sim-data` CSV load + unit conversion + `checks.rs` → `--check-data`; then `world/load`.
- W3: `rng.ts` (streams per D9, spare normals), `world/entities`, `world/log`.
- W1: `time/` calendar + scheduler + job order (Opus).
- W4: map pipeline TopoJSON export (Miller pre-projected); deck.gl map with province picking and one
  map mode, from static CSVs only (no sim needed).
- W5: port the formula goldens (`spec_3_9.rs`, `m4_statements.rs`, `finance_common/`) and the
  sim-data tests; a mock-views generator so the UI can run before the sim exists.

**Step 2 — Sim systems (days 4–9, 4 lanes)**
- W2: economy → ops → market (hourly price step on plain arrays).
- W3: finance (jobs, rating) → births → AI + people → news → recap.
- W4: UI shell on mock views: worker bridge (Comlink), dockview workspace (Opus designs, Sonnet
  builds), top bar/clock/speed, command bar, alerts, TanStack table, charts.
- W5: ports each module's Rust tests just before its builder starts it; starts `apps/headless`.
- W1: reviews, merges, answers contract questions; keeps the job order test green.

**Step 3 — Views (days 10–11, W2 + W3)**
- Port `views/` split by file (W2: market, map_layers, lists; W3: estimate, company/character/news
  views). W4 swaps the mock bridge for the real worker. W5 ports `m9_views.rs`,
  `m9_estimate_bands.rs`.

**Step 4 — Parity gate (days 11–13, W1 + W5, Opus-led)**
- W5 runs the 50-seed TS soak (worker_threads); W1 compares with the Rust reference bands.
- Each mismatch: W1 finds the module, hands a scoped fix to the owning builder; W5 adds a regression
  test. The gate passes when all 19 spec 10 targets are MET and every metric is in band.
- W4 keeps building pages meanwhile.

**Step 5 — Pages (days 12–17, 3 builders + tester)**
- Split the 18 pages + Pdoomberg by file: W4 (live, market, exchange, company, doc), W2 (world,
  country, zone, province, industries, lists), W3 (character, events, news, recap, settings,
  Pdoomberg). Map modes, labels, pins and province card: W4.
- W5: port `b1_pages.rs`, `market_pages.rs`, `workspace.rs`, `m9_leak.rs` as React Testing Library
  + view-type tests; the page bench (each screen < 100 ms).

**Step 6 — Finish (days 18–19, W1)**
- Full gate, browser walk-through, delete Rust (`crates/`, `Cargo.*`, `rust-toolchain.toml`,
  `assets/shaders/`, the mapgen pipeline step), update CLAUDE.md and the memory notes.
- Final Opus review of the whole port against the sign-off list (`docs/build/mvp-signoff.md`).

**Calendar: about 3–4 weeks** (19 working days with 4 lanes busy, plus review and integration
slack). Then spec v1.5 (drift fixes) in TS, on the same lanes.

## Critical files (reference while porting)

- Sim entry and views boundary: `crates/sim/src/lib.rs`, `crates/sim/src/views/mod.rs`
- RNG streams to re-create: `crates/sim/src/rng.rs`
- Data load: `crates/sim/src/world/load.rs`, `crates/sim-data/src/checks.rs`
- UI ↔ sim bridge to replace with the worker: `crates/game/src/bridge.rs`
- Map modes/colors: `crates/game/src/map/modes.rs`, `colors.rs`, `crates/sim/src/views/map_layers.rs`
- Soak oracle: `crates/headless/src/targets.rs`, `metrics.rs`; targets table in build-plan 4.4
- Decisions that name constants: `docs/build/decisions.md` (keep D-numbers in TS comments)

## Verification

- `npm run check`: `tsc --noEmit`, Biome, Vitest, `python3 docs/design/tools/mvp-data/validate.py`,
  `--check-data`.
- `npm run soak -- --seeds 50 --years 30`: all spec 10 targets MET and inside the Rust reference bands.
- `npm run dev`: open in the in-app browser; check every page and map mode opens < 100 ms, hover and
  click a province, run at max speed and confirm the window stays responsive.
- Same seed twice → same state hash; Node and browser worker → same hash.
