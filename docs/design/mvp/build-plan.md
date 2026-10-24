# TechnoCapital20FF MVP build plan

_Status: v0.2 (2026-10-20). Draft for Logan. Built on [mvp-spec.md](mvp-spec.md) v1.4 (sections 1 to 9, the M0 to M10 milestones and balance targets of section 10), [../12-tech-and-roadmap.md](../12-tech-and-roadmap.md) v0.6 (batches 168 and 169), [map-sources.md](map-sources.md), [../data/README.md](../data/README.md) and the data tools in [../tools/mvp-data/](../tools/mvp-data/gen.py)._

_Batch 174 (Logan): the first build PR stacks on the design branch (design/detailed-stages, PR #1), so merging PR #1 later brings design and code in together. Before it: CLAUDE.md, a license, CI, Bevy pinned at 0.20.0, and a note on superseded values in the decisions log._

_Batch 172 (Logan): province borders are smooth, drawn from a border layer that `mapgen` precomputes (P7) instead of a per-pixel neighbor test (1b); OpenGS is listed in map-sources.md as a shader reference only (2a; review in [opengs-review.md](opengs-review.md))._

_Batch 171 (Logan): determinism only has to hold on one machine (same seed, build, OS and CPU), so plain f64 with a fixed iteration order and seeded RNG, no `libm` and no cross-OS hash test in the MVP (decision A); Python prepares the border geodata and the Rust `mapgen` draws the bitmap and centroids (decision B); disputed land follows our own province files and contested provinces are hatched (decision C). See section 6._

**How to read it.** **(A)** marks an assumption Logan has not confirmed. **(T)** marks a tuning value. "Spec 5.1" means section 5.1 of mvp-spec.md. Task ids like M2.3 are used in the rest of this file.

---

## 1. What this plan covers

This plan says how to build the MVP of mvp-spec.md: which Rust crates to make, what goes in each, the order of the work, how it is tested, what could go wrong and the three choices Logan made in batch 171.

**Scope reminder.** The MVP is read-only. The player watches 651 companies run on their own on the real map, with a lite AI that only runs its own company. There is no trading, founding, politics or personal play (spec 1). The milestones M0 to M10 and their "done" lines come from spec 10 and do not change here; this plan only breaks them into tasks.

**Docs only.** Nothing here is code. The build starts only when Logan says so (12.4). Until then this file is a plan to review and change.

---

## 2. Rust workspace layout

> **Superseded for new work (D950, 2026-10-24).** This section describes the Rust MVP build (M0 to M10). The TypeScript port, its layout and its steps are in [../../build/ts-migration-plan.md](../../build/ts-migration-plan.md). The Rust crates stay as the reference until the port's parity gate passes (D951).

One Cargo workspace, one language, one pinned Bevy version (12.2, batch 169). The simulation has no Bevy dependency, so it runs the same in the game, in tests and in the headless runner.

### 2.1 Crates

| Crate | Kind | What lives there | Depends on |
|---|---|---|---|
| `sim-data` | library | One row struct per CSV file, loading with `serde` and `csv`, and the load-time checks (ids, ranges, balance identities) ported from validate.py. A bad row names the file, line and field (spec 10 M0) | serde, csv, thiserror |
| `sim` | library, **no Bevy** | The whole simulation: tables keyed by id, the clock and scheduler, seeded RNG streams, every formula of spec 5 and 6, startup events and listings, news, the `SimViews` query tables (spec 9.2, 9.4), saves and the state hash. Public API: `Sim::new(data, seed)`, `Sim::step()` returns notices, `Sim::apply(control)` | sim-data, rand_chacha, rand_core, serde, postcard, flate2, blake3 |
| `game` | binary (the desktop app) | The Bevy app and its plugins: **SimBridgePlugin** (runs `sim` in `FixedUpdate`, turns UI events into controls and notices into Bevy events, holds `SimViews` as a resource), **MapPlugin** (ID texture, WGSL shader, camera, picking, map modes), **UiPlugin** (theme, top bar, alerts, screens), **TablePlugin** (the in-house table widget and a small chart widget), **PdoombergPlugin** (the terminal) | sim, sim-data, bevy (pinned) |
| `headless` | binary | Runs `sim` with no window: data check, N-year runs, 30-year soak over many seeds, replay of a command log, state hashes and balance reports as CSV | sim, sim-data |
| `mapgen` | binary (offline tool) | Turns `provinces.geojson` into the province-ID bitmap, the color to id table, province-centroids.csv (spec 2.2, G1) with label points, an adjacency list and a coastal cross-check. Never shipped with the game | geojson, geo, geo-rasterize, image, csv, serde |

12.3 named a separate `sim_plugin` crate. This plan folds it into `game` as SimBridgePlugin, since it is small and only the game uses it **(A)**.

### 2.2 Key dependencies

| Need | Choice | Why |
|---|---|---|
| Engine | `bevy`, pinned exactly (`=0.20.0`) in `[workspace.dependencies]`, `Cargo.lock` kept | One version, upgraded only between milestones (batch 169). Bevy 0.20.0 (released 2026-10-08) is the latest stable at build start (batch 174); Rust 1.97 |
| Data | `serde`, `csv` | Decided in 12.2 |
| Seeded RNG | `rand_chacha` (ChaCha8) | Same draws for the same seed in every release; one stream per system (spec 3.1) |
| Math | Plain f64 and the standard library's pow, log10 and exp | Same-machine determinism is enough (decision A, batch 171) |
| Normal and Poisson draws | Written in `sim` (Box-Muller, Knuth's Poisson for mean 2) | A dependency upgrade can never change the draws **(A)** |
| Saves | `postcard` with `flate2` (pure Rust) | Compressed snapshots of the tables plus RNG positions (12.2) **(A)** |
| State hash | `blake3` | Fast hash of the tables for replay tests |
| Errors | `thiserror` | Clear load errors |
| Tests | built-in `cargo test`, `insta` for golden files, `criterion` for benchmarks | **(A)** |
| Map tool | `geojson`, `geo`, `geo-rasterize`, `image` | Rasterize and measure in Rust (decision B, batch 171) |

### 2.3 Folder tree

```
TechnoCapital20FF/
  Cargo.toml                 # workspace; bevy pinned exactly
  Cargo.lock
  rust-toolchain.toml        # pinned Rust version (A)
  crates/
    sim-data/   src/{rows/, load.rs, checks.rs, error.rs}   tests/
    sim/        src/
                  world/       # ids, tables, ordinals (province, company, industry)
                  time/        # calendar, clock, scheduler, quarter phases
                  rng.rs       # streams: cycle, growth, prices, ai, gen
                  economy/     # cycle, zones, demand, ai boom, fringe, supply, revenue, expenses
                  ops/         # labor, seats, stations, compute, data, productivity
                  people/      # simple and full characters, management score
                  finance/     # ledger, statements, tax, credit line, rating, distress, dividends
                  market/      # fair value, price, earnings jump, exchanges, confidence
                  ai/          # archetype, growth, R&D, stations, financing (spec 6)
                  births/      # startup events, startups, IPO vote, listing (spec 5.19, 5.20)
                  news.rs  recap.rs
                  views/       # SimViews and dirty flags (spec 9.2, 9.4)
                  save.rs  hash.rs
                tests/
    game/       src/{main.rs, bridge/, map/, ui/, table/, pdoomberg/}
    headless/   src/main.rs
    mapgen/     src/main.rs
  assets/
    map/        province-ids.png, province-colors.csv, province-centroids.csv,
                province-adjacency.csv, CREDITS.md
    shaders/    province_map.wgsl
    fonts/  icons/
  data/                      # copy of design/data, refreshed by one sync script (A)
  tools/
    map-pipeline/            # Python: fetch, license filter, crosswalk, shapes (decision B)
  tests/fixtures/            # validate.py draw exports, replay command logs, golden traces
```

**Data source of truth.** design/data and gen.py stay the source. A sync script copies the CSVs into `data/` and runs validate.py; CI then runs the `sim-data` checks on the same files, so the two can never drift apart unseen **(A)**.

---

## 3. Build order

### 3.1 Tracks and the critical path

| Track | Milestones | Can start | Notes |
|---|---|---|---|
| **S: simulation** | M0, M1, M2, M3, M4, M5, M6, M10 | At once | The **critical path**. Each needs the one before |
| **U: Bevy UI** | M0.8 spike, M7, M9 | M7 after M1 | Runs beside M2 to M6. Each M9 screen can start once its data exists: Industries after M2, Company Tech after M3, Financials after M4, Pdoomberg after M5, Recap and News after M6 |
| **P: province bitmap** | P1 to P9 (3.3), then M8 | At once (Python), P7 after M0 | Must finish before M8. The crosswalk (P3) is the longest piece (map-sources: several days of review) |
| **Soak harness** | M10.1, M10.4 | After M1 | Built early, so every later milestone runs under it |

```
S:  M0 → M1 → M2 → M3 → M4 → M5 → M6 ──────────────→ M10
U:  M0.8 ─────→ M7 (after M1) ─→ M9 (screens as data lands)
P:  P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 ─→ M8 (after M7)
```

The table widget is built in **M7** (task M7.7), not M9, with a go or no-go spike in M0 (M0.8), so the riskiest UI piece is proven early (12.6).

### 3.2 Milestones and tasks

Each task has a one-line description and what "done" means. The last task of each milestone is the spec 10 "done" line.

#### M0. Workspace and data (spec 2, 10 M0; 12.2, 12.3)

| # | Task | Done when |
|---|---|---|
| M0.1 | Create the workspace, pin Bevy and the Rust toolchain; CI runs fmt, clippy and tests on Linux, Windows and macOS | An empty Bevy window opens; CI is green on all three |
| M0.2 | `sim-data` row structs for countries, the 8 province files, companies, characters, industries, country-economy, financial-zones, ai-boom, key-cities and company-start | All load; counts are 211, 3,255, 651, 296, 42, 211, 26, 15, 88, 651 |
| M0.3 | Load errors name file, line and field | Tests with broken fixture files pass |
| M0.4 | Port the validate.py id and range checks to `sim-data` (zones, hubs, key city provinces, industry names, company-start balance identity) | Every validate.py id check has a Rust twin; both pass on today's data |
| M0.5 | Add data/startup-events.csv (F1 to F9 of spec 5.19.2) to gen.py and validate.py | 9 rows; the loader reads them |
| M0.6 | Export the world-gen name lists (tools/world-gen/names.py) to CSV per superregion | Names load for all 8 superregions (spec 3.7.1, 5.19.3) **(A)** |
| M0.7 | Data sync script (design/data to repo data/) | One command refreshes data and runs both checkers |
| M0.8 | `bevy_ui` spike: a virtualized list of 3,255 rows with text, scrolled and re-sorted | A short go or no-go note on the table widget (risk R1) |
| M0.9 | `headless --check-data` loads everything with no window | **Spec M0:** the loader rejects a bad row with file and line; runs headless with no Bevy window |

#### M1. Clock and scheduler (spec 3.1, 4, 9.1)

| # | Task | Done when |
|---|---|---|
| M1.1 | Calendar: hours since 2020-01-01 00:00 UTC, month ends, leap years, weekdays | Unit tests pass for leap days 2024, 2028 and 2048 |
| M1.2 | RNG streams cycle, growth, prices, AI and gen, each seeded from the game seed; positions saved | Same seed gives the same first 1,000 draws per stream |
| M1.3 | Scheduler: hourly, daily, monthly, quarterly and yearly jobs in spec 4 order, plus the 01:00 tick on release days | A golden job-order trace for 2020 matches spec 4 |
| M1.4 | Quarter phases (Release, Reaction, Locked, PreQuarterEnd) on the exact spec 4.4 dates | days_to_next_phase is right on every day of 2020 to 2023 |
| M1.5 | Controls: speed 0 to 5, pause, resume, SkipTo (next release, lock, recap, month end); alert levels | SkipTo stops on exactly the right tick |
| M1.6 | Sim API: `new`, `step`, `apply`; notices as a returned list | Headless and tests use only this API |
| M1.7 | Save and load (postcard plus flate2) with RNG positions | Save, load, continue gives the same hash as a run with no save |
| M1.8 | State hash over every table in id order | Headless prints a hash each month |
| M1.9 | Long run test | **Spec M1:** 10 years tick headless; job order matches section 4 |

#### M2. Economy core (spec 5.1 to 5.5, 5.10, 7.2, 7.3)

| # | Task | Done when |
|---|---|---|
| M2.1 | Global cycle: phases, g_t, lengths; zone effect with lags and own shocks; Z (5.1) | Phase lengths and g_t stay in their ranges over 500 seeds |
| M2.2 | Zone economy: effective credit spread each quarter (5.1.2) | EU pays 112 and 56 bps, Argentina 931 and 307, at mid Contraction and Overheating |
| M2.3 | Quarterly growth draw: lt_q, asymmetric k, φ, floor, phase labels (5.1) | Noise-off results match the worked table of 5.1 |
| M2.4 | AI boom and pop from ai-boom.csv: lt, boom_uplift, crash_drop, pop date roll, Boom and Bust labels (5.1.1) | Noise-off AI labs demand matches validate.py's boom run year by year |
| M2.5 | Monthly demand, trend demand and rate term (5.1) | Demand follows the draws to 1e-9 |
| M2.6 | Load units from company-start.csv; PC bonus at load (an early slice of M3.4); fixed cost rate (7.1) | Named revenue matches companies.csv within 0.5% |
| M2.7 | Fringe pools (5.3, 7.2); supply, S and M (5.2) | Every industry starts at S 1.00, M 1.00 |
| M2.8 | Revenue and expenses with productivity held at 100 (5.4, 5.5) | The barebones company breaks even before R&D plans exist |
| M2.9 | Asset decay and growth plan purchases and sales (5.10) | $50M of assets decays $400k a year |
| M2.10 | Growth check: run validate.py's draws from a fixture through the engine (see 4.2) | **Spec M2:** S 1.00 at load, revenue within 0.5%, the 40-quarter seeded run matches validate.py |

#### M3. Operations and data (spec 3.7, 3.7.1, 3.8, 5.6 to 5.10, 7.1)

| # | Task | Done when |
|---|---|---|
| M3.1 | Labor units, seats 1 to 5 opening and closing, drop order (5.10) | Unit tests at 1, 4, 5 and 400 labor units |
| M3.2 | Simple characters by size and seat, traits with no opposite pair (3.7.1) | About 2,700 seats filled at load; skill ranges hold |
| M3.3 | Management score and confidence factor (5.7) | Skill 11 board with empty Chair scores about 51; size means about 33, 47, 60 |
| M3.4 | Stations, the 7.1 loadout, PC and PC bonus (5.8) | Bonus steps match the 5.8 table |
| M3.5 | Compute and licence costs (3.8) | Costs match 3.8 for Arrowhead |
| M3.6 | Data: create, convert, decay, 12-month retention, free R&D with 1-month grace (5.9) | Held data settles where `C = rate × held` |
| M3.7 | Productivity: R&D effect, management factor, research multiplier, idle decay, clamp (5.6) | Score 50: −6 a year at the norm, +4 at double, −16 with none |
| M3.8 | Arrowhead check (7.1) | **Spec M3:** 392 labor units, PC bonus +2, about 8.6 TB held, EBIT after R&D about $1.6M |

#### M4. Books (spec 3.9, 4.3 steps 9 to 14, 4.5, 5.11, 5.12, 5.17)

| # | Task | Done when |
|---|---|---|
| M4.1 | Monthly ledger in the 4.3 step order | Every line posts once a month |
| M4.2 | Quarterly and yearly statements; synthetic Q4 2019 and four history quarters (3.9, 4.4, 4.5, 7.1) | Golden statements for 5 sample companies |
| M4.3 | Tax with unlimited loss carryforward, accrued monthly, paid at close (5.11) | Unit tests for loss years |
| M4.4 | Credit line: limit, home spread rate, interest, fees, cash interest, auto-draw and repay, review (5.12) | A Chilean company pays a 312 bps home spread |
| M4.5 | Implied rating, adjustments, sovereign ceiling, one or two notch moves (5.12) | Starting ratings match the run rate |
| M4.6 | Asset sales at the sale factor with gain or loss (5.10) | Unit tests per phase label |
| M4.7 | Distress, Bankrupt freeze for 2 quarters, removal, capacity back to the fringe (5.12, C30) | A forced-failure test company walks all three steps |
| M4.8 | Dividend rule ready for the plan lock (5.17) | Unit test; called from M6.3 |
| M4.9 | Balance test every month | **Spec M4:** balance sheet balances every month for every company still in the game |

#### M5. Valuation and price (spec 3.10, 4.2, 5.1.2, 5.13 to 5.15)

| # | Task | Done when |
|---|---|---|
| M5.1 | Fair value: E_norm, G, R, X, cycle factor, confidence, floors, private discount (5.13) | Unit tests for profit and loss cases |
| M5.2 | Engine value at load | Matches company-start.csv engine_value for all 651 |
| M5.3 | Hourly price: drift to V, market and stock noise, 2% wide ticks, buzz term; closed on 1 January (5.14) | Price noise sd matches σh over a long run |
| M5.4 | Daily bars, buzz decay, daily fair value refresh (4.2) | Bars close at 00:00 each day |
| M5.5 | Earnings jump at 01:00, result tags, reaction week (5.15, 4.4) | Jump and reversion match 5.15 and 21.3.1 |
| M5.6 | 26 exchanges and headline indices at 1,000, divisor kept on new listings (5.14) | Index does not jump when a company lists |
| M5.7 | Zone confidence each day from index return and headlines (5.1.2) | Decays to 0 with no news |
| M5.8 | Ten-year tracking test | **Spec M5:** opening price at V, $5 to $200; prices track V within ±30% over 10 years |

#### M6. Lite AI, quarter loop and births (spec 4.4, 5.16 to 5.20, 6)

| # | Task | Done when |
|---|---|---|
| M6.1 | AI inputs (g_dem, S, ROA, loss_q, liquidity, min_cash) and archetype (6, 6.1) | Retail in Contraction projects 1.8% |
| M6.2 | Growth plan, trait nudges, funding cap; R&D plan; station split (6.2 to 6.4) | Unit tests for each table row |
| M6.3 | Financing and dividends (6.5, 5.17); the 6.6 raise rule behind cash_burning | Raise rule tested with a fake flag, silent with real data |
| M6.4 | Plan lock batch; consensus and projection ranges (5.16) | Ranges shrink with elapsed share, minimum ±3% |
| M6.5 | News wire (Pdoomberg Wire byline) and recap data (5.18, 8) | Every headline type in 5.18 posts in a test year |
| M6.6 | Random startup events: Poisson count, industry weight, type table, province weight (5.19.1) | 300-seed rate near 8 events a year in the 2020s |
| M6.7 | Fixed events F1 to F9 from startup-events.csv (5.19.2) | Each fires at its plan lock |
| M6.8 | Startups: carve from the fringe, cap table, seed cash, full characters (3.7.2), cast seating (5.19.3, 5.19.4) | Supply unchanged by a birth before PC bonuses; no empty labor seat |
| M6.9 | IPO tests, board vote with trait modifiers, cap of 3, listing (5.20, 5.20.1) | Same seed gives the same votes, member by member; A = L + E after listing |
| M6.10 | Full year test | **Spec M6:** four releases, four locks, four recaps; F1 to F9 on their dates |

#### M7. Sim plugin and Bevy shell (spec 8, 9; 12.3)

| # | Task | Done when |
|---|---|---|
| M7.1 | SimBridgePlugin: `Sim` in a resource, N steps per `FixedUpdate` by speed, a per-frame time budget so max speed never freezes the window **(A)** | Speeds 1 to 5 hold their hours per second (2, 1, 0.5, 0.2 s, max) |
| M7.2 | Control events in, notice events out (9.1, 9.3) | Every 9.3 notice reaches a test system |
| M7.3 | `SimViews` resource: views built in `sim`, swapped in once per frame; dirty flags and cadences (9.2, 9.4) | UI code has no path to sim tables |
| M7.4 | Theme: neon-on-dark tokens, fonts, panels, the "Read-only MVP" lock (8; 11-ui 11.4) | One style file used by every screen |
| M7.5 | Top bar: date, hour, weekday, pause, speeds, Skip menu, quarter clock (8) | Space and keys 1 to 5 work |
| M7.6 | Alert row and alert settings (Pause, Notify, Log, Off) (8) | Earnings day and recap pause by default |
| M7.7 | **Table widget v1**: virtualized rows, sortable columns, fixed header, money, % and **?** formats, keyboard scroll | 3,255 rows sort and redraw within one frame at 60 fps **(T)** |
| M7.8 | Left rail, outliner with watchlist, screen router; Omniscient toggle (debug builds only) | Release build hides Omniscient |
| M7.9 | Shell test | **Spec M7:** the app runs the sim in `FixedUpdate` at all speeds; screens read `SimViews` only and send events |

#### M8. Map (spec 8 map row, 9.2 `get_map_layer`; 12.2; needs track P)

| # | Task | Done when |
|---|---|---|
| M8.1 | Load province-ids.png as a texture (nearest sampling, no mipmaps) and the color to ordinal table | Every bitmap color maps to one sim province |
| M8.2 | WGSL shader: id lookup per pixel, a 3,255-entry color table texture, smooth borders read from the precomputed border layer (batch 172); hatching on provinces with a `contested` value (decision C) | Political mode draws with country borders; contested provinces show hatched |
| M8.3 | Camera: pan and the World, Country, Province zoom levels | Smooth zoom at 60 fps |
| M8.4 | Picking: read the id under the cursor from a CPU copy of the bitmap; hover and select | Hover outline follows the cursor |
| M8.5 | Map modes: Political, Development (4), Industry, Company HQs pins, Financial zones with hub pins and legend; Metro outlines (8) | Each mode writes the color table from `get_map_layer` |
| M8.6 | Labels from province-centroids.csv label points; key city labels | Labels do not overlap at World zoom **(T)** |
| M8.7 | Province card and zone hover card (9.2) | Cards show every field in spec 8 |
| M8.8 | Click test | **Spec M8:** all 3,255 provinces clickable (a test clicks each label point and gets the right id) |

#### M9. Screens (spec 8, 9.2; batch 169)

| # | Task | Done when |
|---|---|---|
| M9.1 | Chart widget: line, bars, daily candles with a fair value band | Draws 20 quarters and 10 years of bars |
| M9.2 | Company screen: Overview, Board, Cap table, Units, Financials, Tech tabs | Every tab field of spec 8 shows |
| M9.3 | Industries table and detail (demand vs supply, growth bars, fringe row) | 42 rows plus detail |
| M9.4 | Pdoomberg terminal: F2, F3, F4 (locked), F5, F6, F7, F9, F10 with function keys | Each page opens from its key |
| M9.5 | Quarterly recap: world page and watchlist company pages | Opens at the pre-quarter-end week |
| M9.6 | News feed with date and industry tags | Filters by industry |
| M9.7 | Startups and listings parts: births column, founded and listed lines, founders and last IPO vote, screener filters | Matches the spec 8 row |
| M9.8 | **?** for private figures unless Omniscient (spec 1, Information) | No true private value leaks in a release build |
| M9.9 | Timing harness | **Spec M9:** every section 8 screen opens in under 100 ms |

#### M10. Soak and balance (spec 10 targets)

| # | Task | Done when |
|---|---|---|
| M10.1 | Headless soak command: 30 years, a list of seeds, a metrics CSV per year (built after M1, grows with each milestone) | One command runs 50 seeds **(T)** |
| M10.2 | Balance target checker: every 10-year target of spec 10 as pass or fail | Report lists each target per seed |
| M10.3 | Startup, character and listing target checker | Same, for the second target list |
| M10.4 | Determinism: replay, save and load mid-run, on one machine | Same seed gives the same hashes on the same machine and build (4.3) |
| M10.5 | Boom and pop check with noise off | AI labs demand matches validate.py's boom run |
| M10.6 | Profile and fix hot spots | 30 years under 2 minutes headless |
| M10.7 | Tuning pass on **(T)** values; changes go to the spec change log with Logan's okay | All targets pass in the agreed share of seeds |
| M10.8 | Release builds for Windows, macOS and Linux | **Spec M10:** 30 years under 2 minutes; same seed same hashes; balance targets met; boom and pop on their dates |

### 3.3 Track P: the province bitmap pipeline (spec G1, map-sources.md)

| # | Task | Tool | Done when |
|---|---|---|---|
| P1 | Fetch Natural Earth 10m admin 0, admin 1 and populated places; geoBoundaries gbOpen ADM2 and ADM3 with metadata; pin both release versions | Python | Files and versions recorded |
| P2 | License filter on `boundaryLicense`: keep CC BY, CC0, public domain; the rest go to the Voronoi path; a provenance column on every province | Python | No ODbL, SA or GADM source left |
| P3 | Crosswalks: region_crosswalk.csv and province_crosswalk.csv by fuzzy name match, then a manual review pass (about 1,200 provinces) | Python plus review | Every one of the 3,255 provinces has a row |
| P4 | Build shapes: dissolve admin-2 units, clip to the region, weighted Voronoi splits from city points | Python (geopandas, shapely) | One shape per province |
| P5 | Topology-safe simplify (mapshaper) and projection (Robinson or Miller **(A)**) | mapshaper, ogr2ogr | No gaps or slivers between neighbors |
| P6 | Export provinces.geojson with `province_id` | Python | The vector source of truth |
| P7 | `mapgen`: rasterize to province-ids.png at 8192x4096 **(T)**, color table, centroids and label points, adjacency, a smooth border layer (border distance field per province and country edge, batch 172), coastal cross-check against the CSV | Rust | All outputs written to assets/map |
| P8 | QA and credits: every province has pixels, tiny-province report (Singapore, London splits), CREDITS.md from geoBoundaries metadata | Rust and Python | Report is clean or each issue is signed off |
| P9 | North America slice end to end first (12.4), then the world | All | NA by M2, world before M8 **(A)** |

### 3.4 Task count

| Milestone | M0 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 | P | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tasks | 9 | 9 | 10 | 8 | 9 | 8 | 10 | 9 | 8 | 9 | 8 | 9 | **106** |

---

## 4. Testing approach

### 4.1 Unit tests per formula section

Each spec 5 and 6 section gets its own test file in `sim/tests`, using the worked numbers the spec already gives:

| Spec | Test uses |
|---|---|
| 5.1 | The worked table (Retail, Software, an LT 30% grower) with noise off; label rules |
| 5.1.1 | AI labs demand by year, linked industries' lt in boom year 0 (Data centers 29%) |
| 5.1.2 | EU and Argentina spreads; Chilean 312 bps home spread; confidence decay |
| 5.2, 5.3 | S 1.21 gives M 0.91, S 0.81 gives M 1.11; fringe keeps its share |
| 5.5, 5.10 | Barebones break-even; $50M decays $400k; sale factors |
| 5.6, 5.7, 5.8 | −6, +4 and −16 a year; board of 11 scores about 51; bonus steps |
| 5.9 | Free R&D steps; steady-state held data |
| 5.11, 5.12 | Loss carryforward; limit, rate, rating table and notch moves |
| 5.13 to 5.16 | Fair value cases; jump size; projection range formula |
| 5.19, 5.20 | Event weights; carve conserves supply; vote odds and tie rule |
| 6 | One test per row of each Lite AI table |
| 7.1 | Arrowhead check |

### 4.2 Golden tests from validate.py

- **Data checks.** Every validate.py id, range and balance check has a twin in `sim-data`. CI runs both on the same files, so they must agree.
- **Starting state.** The engine's load-time values (gross assets, fixed cost rate, engine value, shares, cash and line) must match company-start.csv for all 651 companies.
- **Growth and boom runs.** Python's `random` and ChaCha give different numbers for the same seed. So validate.py writes its seed-150 draws (phases, lengths, z values) to a fixture file, and the engine replays them through an injectable RNG source. Results must match to 1e-9 **(A)**. The boom run is compared with noise off.
- **Profit picture.** Once M3 and M6.2 exist: 619 of 651 profitable after R&D at load, median margin 6.1% (spec 2.2).

### 4.3 Determinism and replay hashes

- One RNG stream per system; nothing reads the wall clock or thread timing.
- **Floats (decision A, batch 171).** Plain f64 (spec 3) with a fixed order: iterate tables as `Vec`s in id order, never a `HashMap` in sim logic; sums in a fixed order; no parallel float reductions; hash floats by their bits. The goal is same hashes for the same seed, build, OS and CPU. Matching hashes across OSes is not needed.
- **Replay test.** A run records its seed and command log (in the MVP only speed and skip controls) and a hash each month. A replay on the same machine must give the same hashes. Save at a random tick, load, continue: same hashes.
- **Cross-OS hashes.** Post-MVP. Not tested in the MVP.

### 4.4 The 30-year soak and balance targets

The headless runner runs 2020 to 2050 over 50 seeds **(T)** and writes one CSV row per seed per year. The checker marks each spec 10 target pass or fail:

| Target (spec 10, all T) | Checked |
|---|---|
| 85%+ of the 651 still active after 10 years; median productivity 90 to 110 | Year 10 |
| Industry revenue within ±30% of trend; no industry at an M clamp over 8 quarters | Every quarter |
| 30% to 60% of releases are beats | 2020 to 2029 |
| Average demand growth within ±3 pp of LT in 90% of seeds; 10% to 25% Boom and 10% to 20% Bust quarters | 2020 to 2029 |
| 6 to 15 startups a year; 15 to 50 AI labs startups in 2030 to 2035 in 80% of seeds | By decade |
| Named companies 600 to 1,100 every year; 60 to 250 listings, at most 12 a year; 10 to 30 starting private companies listed by 2024 | Every year |
| 100 to 300 full characters made per decade; under 1,200 in 2050; casts of 1 to 5 each; no empty labor seat | Every year |

### 4.5 Performance budgets

| Budget | Source | Meaning |
|---|---|---|
| 30 years headless in under 2 minutes | Spec 10 M10 | 262,800 hourly ticks: about 0.45 ms a tick on average |
| 1 game year headless in under 1 minute | 12.5 | Met easily if the above is met |
| Every screen opens in under 100 ms | Spec 10 M9 | Screens read ready views, never compute |
| 60 fps at speeds 1 to 4; window stays responsive at max | **(A)** | Per-frame tick budget in M7.1 |
| Map mode change in one frame | **(A)** | Only the 3,255-entry color table changes |

`criterion` benchmarks for the hourly price step and the monthly job run in CI and fail on a 20% slowdown **(T)**.

---

## 5. Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Bevy UI is young** for dense CK3-style tables, text and scrolling (12.6) | The M0.8 spike before any screen work; table widget built in M7, not M9; virtualized rows so only visible rows exist; flat look with few nodes. If text is slow, draw each column as one text block |
| R2 | **Bevy version churn**: each release changes APIs (for example, Bevy 0.17 renamed buffered events to messages) | Exact pin and `Cargo.lock`; upgrades only between milestones, as their own task; `sim` has no Bevy dependency, so churn only touches `game` |
| R3 | **Map data licensing**: geoBoundaries licenses vary by country and release; OSM data would make our polygons ODbL; GADM forbids commercial use | P2 filter with a provenance column; pinned releases re-checked on each update; no OSM or GADM in shipped data; CREDITS.md built from metadata |
| R4 | **Sim speed at hourly ticks** with 651 to 1,100 companies and 3,255 provinces | Hourly work is only prices for listed companies; monthly jobs run 360 times in 30 years; tables as flat `Vec`s by ordinal; views rebuilt only when dirty and at most once per frame; province data touched only for monthly map layers; profile from M2 on with the soak harness |
| R5 | **Determinism with floats** on one machine | f64 with the 4.3 ordering rules (decision A); replay hash test from M1; saves may not replay the same on another OS, which is accepted |
| R6 | **Data drift** between design/data and the game | Sync script plus both checkers in CI (2.3) |
| R7 | **Province crosswalk effort** (about 1,200 manual matches) and tiny metro provinces | Start track P at once; North America first; tiny-province report and a minimum display size or zoom rule (M8) |
| R8 | **Disputed borders** are a storefront risk in some markets | Decision C: our own province files, contested provinces hatched |

---

## 6. Decided (batch 171, Logan)

These were open decisions in v0.1. Logan's picks are marked **Chosen**.

**A. How strict should determinism be?** **Chosen: same machine only.** Same seed, same build, same OS and CPU give the same results. Plain f64, a fixed iteration order (no `HashMap` iteration in sim logic) and seeded RNG. Replay hashes are compared on one machine. No `libm`; cross-OS hashes are post-MVP.
- Not chosen: f64 with `libm` and same hashes on all three OSes; fixed-point money.

**B. Who builds the province map?** **Chosen: both.** Python in tools/ prepares the border geodata offline from Natural Earth and geoBoundaries (fetch, license filter, crosswalk, shapes, simplify: P1 to P6). The Rust `mapgen` tool draws the province-ID bitmap and centroids, plus adjacency and QA (P7, P8).
- Not chosen: all Python; all Rust.

**C. Which borders does the map draw for disputed land?** **Chosen: our own province files.** They already set, for example, Crimea as RUS and Taiwan as its own country. Every province with a `contested` value is drawn hatched on the map (M8.2).
- Not chosen: Natural Earth's de facto lines; borders changed per market.
