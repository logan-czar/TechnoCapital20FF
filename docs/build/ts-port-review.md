# mvp-signoff.md against the TypeScript game: final review

The final review of the port (ts-remaining-work 4.8, D1017), on `build/ts6-delete-rust` over main 334ee6d, where the Rust was read with `git show`. A review agent wrote it reading only (no tests run), so a claim it took from a doc says "doc only". Checked by hand afterwards: gaps G1, G2, G5 and G6 (G6's doc fixes are made in the same PR), the status numbers in section 7, and mapgen's byte- and pixel-identity (D1017, measured, not doc only). The gate on that branch passed: 186 test files, 1,055 tests, about 7 minutes.

How the classes are used: **holds** (ported; evidence named), **obsolete** (Bevy, Rust build, WGSL or native binaries; replacement named), **gap** (should hold in TS and does not, or differs without sign-off), **needs Logan** (his call, unchanged by the port). One extra bucket is used for section 3: **replaced by D989**, rows that a later Logan ruling (full characters removed) changed on purpose. He should tick D989 instead of these rows.

## 1. Summary

Section 3, 268 rows:

| Section | Holds | Obsolete | Gap | Needs Logan | Replaced by D989 |
|---|---|---|---|---|---|
| 3.1 Sim and economy (86) | 78 | 4 | 0 | 2 (D266, D271) | 2 (D270, D274) |
| 3.2 Views and bands (30) | 29 | 0 | 1 (D700, UI half) | 0 | 0 |
| 3.3 UI and workspace (60) | 33 | 18 | 7 | 0 | 2 (D462, D486) |
| 3.4 Map pipeline (52) | 48 | 1 | 0 | 3 (D823, D825, D850) | 0 |
| 3.5 Benches and build (40) | 21 | 12 | 5 | 1 (D693) | 1 (D326) |
| **Total** | **209** | **35** | **13** | **6** | **5** |

Section 1: of 6 status claims, 2 hold (world counts, screens and leak test), 2 are obsolete with a TS counterpart (milestones, gate), 1 is a gap (soak and parity are stale), 1 is obsolete but leaves a Logan call (Windows only becomes Chrome only).

Section 6: of 14 open items, 1 holds (self-contained release), 2 are obsolete (macOS and Linux, speed 5), 11 still need Logan. Speed 5 leaves a TS gap (map frame rate at Max is unmeasured).

The sim port itself is faithful. An automatic comparison of every numeric constant in `crates/sim/src` with `packages/sim/src` found only the four intended differences, and the formulas spot-checked match line for line. The gaps are in three places: the parity evidence, the map screen, and two test bounds.

Gap list, most important first:

1. The parity evidence is stale, and `headless parity` would now fail on the frozen reference.
2. The map draws only the Political mode: no modes, legends, pins, labels, hover card, tiny-province targets or keyboard pan.
3. The workspace is dockview tiling with the map as a pane, not floating windows over the map (D635, Logan's m8-plan choice), and no decision logs the change.
4. The map's frame rate while panning at Max is unmeasured, and five heavy pages still give long tasks (the D805 counterpart).
5. D151's per-year tracking floor fell from 97% to 96% (D974). It is logged, but the sign-off row still says 97%.
6. Small doc gaps: the soak fixture's rerun command now runs the 1995 world; the D1017 row lacks three columns; CLAUDE.md names row 950 where 1017 is meant; no doc records the TS gate's test count or time.

New calls for Logan since the doc: the default economy profile (`legacy`; D970 said it would flip after parity), design fixes 950 and 970 to 983 and 1017, browser support, and whether the map features in gap 2 are needed for sign-off.

## 2. Gaps

### G1. Parity evidence is stale; the parity tool would fail at the tip (high)

- The only TS soak is `test/fixtures/ts-soak/` (README.md:3-5): commit 878ccd5, sim code of main 22f77f3, 2026-10-25. Verified: 22f77f3 is an ancestor of 58b7193 (D974, 2026-10-27) and of 81284f3 (D989).
- Changes since then that move the 2020 world's results: D973 (R&D diminishing returns, on by default, `ops/productivity.ts:32`), D974 (`LOW_PRODUCTIVITY_ADJ` 1.0, `ai/rd.ts:28`; Rust `ai/rd.rs:18` is 0.5), D989 (no full characters, no founders), D994 (Era stream, the 2020 state hash moves once). D973 and D974 re-recorded the golden digests. No later 50-seed run is recorded in `decisions.md`, `soak.md` or the git log.
- D989 dropped two soak targets (`full_characters_per_decade`, `full_characters_2050`) and four yearly columns (`full_characters`, `full_characters_made`, `cast_full_min`, `cast_full_max`). The frozen reference still has them: `rust-reference/summary.csv` marks both targets MET, and `bands.json` holds the four columns for 30 years (120 bands). `apps/headless/src/parity.ts:185-198` fails any Rust-MET target the TS soak lacks, and `:229-238` fails any band with no TS value. A fresh soak at the tip would report 2 target and 120 missing-band failures.
- CLAUDE.md says "The port passed its parity gate (D951)", and ts-remaining-work 4 says done needs "the soak and parity still pass". Neither is shown for the current code.
- **Fix:** give `parity.ts` a logged list of the targets and columns retired by D989, then run the 50-seed, 30-year soak of the 2020 world at the tip and commit it as the new `test/fixtures/ts-soak/`.
- **Done since (D1018):** `parity.ts` skips the D989 retirements, and the soak at the tip **fails** parity: 16 of 17 targets MET (`listings_30y` at 92%), 635 of 1,470 yearly bands out from 2020 on. Traced to Logan's D974 (most of it), D973 and D989 (D1018). Logan accepted it, and that soak is the new parity baseline (D1019).

### G2. The map is Political only (high, UI)

- `apps/web/src/map/ProvinceMap.tsx:100-101`: "One map mode for now (Political)". `map/colors.ts:1` says the same. The UI never reads `v_map_layers`. D1013 says so too, and it is why the UI leak test skips the map.
- Missing against the Rust map (`crates/game/src/map/` at 334ee6d: `modes.rs`, `pins.rs`, `labels.rs`, `card.rs`, `picking.rs`):
  - map modes and legends (D700 UI half, D702): Development, Industry, Company HQs and Financial zones. The sim side is ported and tested (`packages/sim/src/views/map_layers.ts`, `test/views/m8_map_modes.test.ts`);
  - HQ and exchange pins (D703);
  - labels by zoom with culling (D706);
  - the hover card (D704). Hovering only outlines the province. A click shows a static card of id, name and country from the map CSV (`ProvinceMap.tsx:220-226`). The view-based card exists only on province link hovers (`links/cards.ts:194`);
  - tiny-province click targets (D640). mapgen still flags them (`apps/mapgen/src/build.ts:11`), but deck.gl picks polygons only;
  - W A S D pan and Q / E zoom (D636). The only key handler is Escape (`ProvinceMap.tsx:92-98`). Region lines are not drawn (D960).
- The checks that went with these are gone too: D705 (map modes, cards and pins), D740 (a click on every province; `apps/web/test/map.test.ts:158` checks one known point), D743 (leak test on the map).
- The port plan put modes, labels, pins and the card in Step 5, lane W4 (`ts-migration-plan.md:107`, `:195`). ts-remaining-work dropped them with no decision. Its 4.4 walk-through still lists "every page and map mode".
- **Fix:** port `modes.rs`, `pins.rs`, `labels.rs` and `card.rs` as deck.gl layers on `v_map_layers` (add the view to the map pane's `Want`), with a pick radius for tiny provinces. Then rerun the UI leak test on the modes. If Logan defers this, log the deferral as a decision.
- **Done since (D1020):** the five modes with their bar and legend, the Metro outlines, contested provinces, HQ and hub pins, labels by zoom, the province and zone hover cards, tiny-province dots and targets, and W A S D / Q / E are ported. D740's every-province click is back in `map.test.ts`; the map modes are back in the UI leak test (D705). Region lines are still not drawn (D960).

### G3. Floating windows over the map became a tiling workspace (medium, Logan's choice)

- D635 ("your m8-plan choice"): page windows float over the map. Rust `crates/game/src/map/mod.rs:1-2`: "drawn behind the floating page windows (D635)".
- TS: `apps/web/src/shell/Workspace.tsx:1-3` is a dockview tiling workspace, and the map is one fixed pane among the others (`shell/panes.ts:24-25`). No D950 to D1017 row mentions D635. The port plan chose dockview (`ts-migration-plan.md:176`), which matches D450 but not D635.
- **Fix:** ask Logan whether the tiling layout replaces D635, and log a decision either way. dockview's floating groups could give back windows over a full-size map.

### G4. Speed at Max: the map frame rate is unmeasured (medium)

- ts-remaining-work 4.3 (lines 94-99) and D1016: with only the map open there are no long tasks at Max. With five heavy pages there are about 2 long tasks a second of 50 to 70 ms (p95 delay 80 ms). The map's frame rate while panning at Max was never measured, because the browser pane was hidden.
- This is the TS form of D805 and of the open item "Speed 5 is a known FAIL".
- **Fix:** measure panning fps at Max with the pane showing, once with the map alone and once with the heavy pages. Set a pass bar, as D805 did with p99 of 15 ms.

### G5. D151's per-year tracking floor fell to 96% (low; logged, not surfaced)

- `packages/sim/test/m5_tracking.test.ts:48` sets `MIN_YEAR_TRACKING_SHARE = 0.96`. Rust `crates/sim/tests/m5_tracking.rs:38` sets 0.97. D974 records the change (seed 5's 2020 tracked 0.969).
- **Fix:** put it in front of Logan with D974, or tune until 97% holds again.

### G6. Doc gaps (low)

- `test/fixtures/ts-soak/README.md:8-9`: the rerun command has no `--world 2020`. The headless default world is now 1995 (`packages/sim-data/src/manifest.ts:17`, `apps/headless/src/args.ts:73`), so the command would soak the 1995 world for 25 years. Fix: add `--world 2020`.
- `docs/build/decisions.md:443`: the D1017 row stops after its decision cell, without the constant, lane and sign-off columns. Fix: append `| (none) | ts6-delete-rust | |`.
- `CLAUDE.md` says build-plan section 2 "still describes the Rust crates (design-fixes row 950)". The row that covers it is 1017. Fix: cite 1017.
- No doc records the TS gate's test count or time. Fixed: this branch's gate ran 186 test files and 1,055 tests in about 7 minutes (recorded above and in ts-remaining-work 4.8).

## 3. Section 1 status claims

| Claim | Class | Evidence |
|---|---|---|
| Done: M1 to M10 and track P; PRs #2 to #50 | obsolete (Rust milestones) | TS counterpart: port Steps 0 to 6, PRs #56 to #118 merged (334ee6d first-parent log), and this branch deletes Rust (D1017). Track P's tool lives on as `apps/mapgen` (D1017; tables byte-identical and bitmaps pixel-identical, measured). |
| World: 3,963 provinces, 651 companies | holds (2020 world) | Verified: `packages/sim/test/world_load.test.ts:22-23` pins 3963 and 651, and `m5_load.test.ts:112` pins 467 listed. `git diff 334ee6d -- assets/map docs/design/data assets/worlds` is empty. **New:** the default world is now 1995 (`manifest.ts:17`, `DEFAULT_WORLD_ID = "1995"`), with 300 companies and the same 3,963 provinces (`assets/worlds/1995/manifest.json`). The 2020 world is `?world=2020` / `--world 2020`. |
| Save version 11 | obsolete | TS saves are gzipped canonical JSON, `SAVE_VERSION = 4` (`packages/sim/src/save.ts:28`; D957, D994, D1012). Rust saves fail at the magic. Another version is refused with a reason (`save.ts:37-41`). Verified. |
| Soak: 50 × 30, all 19 judged targets MET, Cloud waived; 5.5 to 7 s a run | **gap** for the claim today (G1); holds at 22f77f3 | At 22f77f3: 19 MET, 1,590 bands, 0 failures (`ts-soak/parity.txt`, verified as file content). Since D989 the TS has 19 targets, 17 of them judged (`apps/headless/src/targets.ts:288-570`, verified). Time: the lone 30-year run took 204 s at 22f77f3 (ts-soak README, doc only); with every view built, about 102 s after #100 (D969, doc only); the soak took 52 min, then 32 min with `--jobs 4` (doc only). That is inside the 2-minute budget per seed, doc only. |
| Screens under 100 ms (worst 25.7 ms); leak test finds no private truth | holds | Production build: every page opens in 7 to 35 ms (D1014, doc only). happy-dom page bench: worst 90 ms on the 1995 world (D1013, doc only); `apps/web/bench/pages.test.tsx` runs on demand, not in the gate (verified: `apps/web/vitest.config.ts` includes only `test/**`). Leak test: `apps/web/test/pages/ui-leak.test.ts` is in the gate (verified by the Vitest include) and passes per D1013 (doc only). It skips the map, which shows no figures today (G2), and the Settings page. The view leak test is `packages/sim/test/views/leak.test.ts`. Known exceptions kept from Rust: design fixes 970 to 972 (`leak_rules.ts:343-350`, `:458`). |
| Gate: `check.ps1`, 685 tests, 57 s / 93 s | obsolete | Replaced by `scripts/check-ts.sh` / `.ps1`: typecheck, Biome, boundary scan, Vitest, and both worlds' data checks (verified). Test count and time are not recorded (G6). |
| Tested on Windows only; macOS and Linux not built | obsolete; leaves a call for Logan | No native binaries remain. Tested in Chrome 152 (in-app browser) and Node 24 on Windows (D1014, D1015, doc only). The sim's own fdlibm port (D1015; `types/libm.ts`, enforced by `scripts/ts/boundary.ts:29-32`, verified) gives the same hashes in Node and Chrome. Firefox and Safari are untested. |

Section 2 note (not asked, but stale): D9 (ChaCha8 streams) and D13 (postcard save, blake3 hash) were replaced by D951, D956 and D957 (D951 is Logan's). D360 (+0.5) was replaced by D974 (+1.0, Logan's request). The Cloud waivers D366 and D368 still apply in TS (`targets.ts:333`, `:385`).

## 4. Section 3, row by row

### Method for the sim rows

- **Constants:** every numeric `pub const` literal in `crates/sim/src` at 334ee6d was compared with the `export const` literals in `packages/sim/src`. Every name in both has the same value except four, all logged:
  - `LOW_PRODUCTIVITY_ADJ` 0.5 to 1.0 (D974);
  - `MAX_SPEED` 5 to 6 (D1002);
  - `SAVE_VERSION` 11 to 4 (D957);
  - `STREAM_COUNT` 5 to 7 (Politics, D980; Era, D994).

  Rust-only: `FOUNDERS_SHARE`, `LEAD_SHARE_OF_FOUNDERS`, `HOME_AT_HQ_CHANCE`, `CASH_MIN_USD`, `CASH_MAX_USD` and `FULL_TRAIT_COUNT` (gone with D989), and `VIEW_WORKERS` (D962).
- **Formulas checked side by side:**
  - `revenueGrowth` (D254; `market/fair_value.ts:76` against `fair_value.rs:70`);
  - `floored` (D242);
  - `applyCap`, with ties to the lower id (D277; `births/ipo.ts:246`);
  - the $0.01 price floor (D246);
  - the close's tax-then-statements order (D122; `finance/jobs.ts:679`);
  - confidence zeroed under 0.005 (D251);
  - alert defaults (D800; `types/notice.ts:120-139`).

  All match. Under the new RNG (D951, D956), draw-order rows keep their order but not their draws.

### 3.1 Sim and economy (86 rows)

| Rows | Class | Evidence |
|---|---|---|
| D120 to D125, D127 to D133 | holds | Ported, cited in code (e.g. `finance/jobs.ts:460-513` D122; `m6_full_year.test.ts:100` D128; `spec_5_13.test.ts:237` D244 basis). |
| D134 (467 list at load) | holds, 2020 world | `m5_load.test.ts:112`. |
| D135 to D139, D141, D142, D148, D149 | holds | `market/price.ts`, `market/jobs.ts`, `types/log.ts:1` (chunks, D139, D148), `BAR_YEARS_KEPT = 10`. |
| D140, D150 (EFV error ±15%, drawn at load) | holds | `EFV_ERROR_WIDTH = 0.15`, `CONSENSUS_ERROR = 0.15`; `births/jobs.ts:701`, `market/jobs.ts:219`. |
| D145, D244 (load values match the CSV) | holds | `m5_load.test.ts` checks every company's P, V and basis against the CSV. |
| D147, D250 (index divisor) | holds | `market/exchange_index.ts`; `test/market/exchange_index.test.ts`. |
| D153 (one cap-table block; holders sum) | holds | Starting companies unchanged. A born company's seed investors now hold all its shares (D989). |
| D154 to D160, D162 to D165 | holds | `births/`, `ai/jobs.ts`, `news/jobs.ts:99` (D157, quoted only), `recap/jobs.ts`. |
| D161 (Arrowhead +3 from Feb 2020) | holds, 2020 world | `spec_7_1_arrowhead.test.ts`, `m3_arrowhead.test.ts`. Off in the 1995 world (`features.arrowhead: false`). |
| D163, D252, D267, D276 (draw orders) | holds | Order kept; generator replaced by xoshiro128** (D956, under Logan's D951). |
| D167 (save version 6 contents) | obsolete | TS save format D957 (`SAVE_VERSION` 4). |
| D236 to D241 (data sizing) | holds | Data unchanged since 334ee6d (verified by diff); the gate runs `validate.py` and `--check-data --world 2020`. |
| D242, D243, D245 to D249, D251, D253, D254 | holds | Verified as above. `SECTOR_VOLATILITY = 0.26`, `SECTOR_BETA = 1.0`, `REACTION_VOLATILITY_START = 2`, `_FADE_DAYS = 6`, `MIN_PRICE_USD = 0.01`, `CONFIDENCE_ZERO_BELOW = 0.005`, growth clamp −30% to +60%. |
| D260 to D265, D267 to D269 | holds | `births/weights.ts:25` (G clamp), `births/startup.ts:62` (2% cap), `ai/rd.ts` (`LOSS_CUT_FLOOR_NORMS = 0.5`). |
| D266 (6.6 raise never fires) | needs Logan | Still parked in TS: no industry is `cash_burning` (`ai/raise.ts:1-2`, `:237`). The 1995 world adds an era-only growth raise on the 6.6 issue (D997), so share issues do run there. |
| D271 (Tech startups born CC, $0 line) | needs Logan | Ported unchanged (`births/startup.ts:141`, `births/jobs.ts:253`). |
| D270 (lone founder holds all 60%) | replaced by D989 | No founders; `FOUNDERS_SHARE` is gone. |
| D272, D273 (names, tickers) | holds | `births/names.ts`; `TICKER_*` constants; tests in `births/pure.test.ts`, `m6_ipo.test.ts`. |
| D274 (leftover partials become directors) | replaced by D989 | "A cast of 1 to 5 partials leaves no director" (D989). |
| D275, D281 (F9 fixed events; tipped AI lab) | holds, 2020 world | `births/fixed.ts`; `TIPPED_LAB_CANDIDATES = 5`. Off in 1995 (`fixed_events: false`, `ai_boom: false`). |
| D277 to D280, D283 | holds | `births/ipo.ts:246`; `RECAP_TOP = 5`; `ai/jobs.ts:49` (D283). |
| D401 (write-once bar slots) | obsolete | Rust storage. TS shares chunks through `AppendBuf` (`types/log.ts`; D139, D148). |
| D402 (v_quotes refills in place) | obsolete | D962: a view is rebuilt from a copy, never changed in place. |
| D801 (views on 6 threads) | obsolete | D962: views build one after another in the worker; same results. |

### 3.2 Views and estimate bands (30 rows)

| Rows | Class | Evidence |
|---|---|---|
| D144, D146, D421, D422, D425, D426, D428 to D434, D437, D439 | holds | `views/estimate.ts` (`ESTIMATE_BAND_HALF_WIDTH = 0.25`); `test/views/m9_estimate_bands.test.ts`, `leak.test.ts`; `RECAPS_KEPT = 20` (D433). |
| D423 (bands rebuild on Omniscient) | holds | `views/map_layers.ts:4`, D975. Omniscient now exists only in dev builds (D961, D1014). |
| D424 (bars store EFV), D540 (10 years of index history) | holds | `types/state/market.ts:116`, `:29`. The save-version parts are obsolete (D957). |
| D427 (true totals headless-only) | holds | `@tc20ff/sim/internal`, used only by `apps/headless` (`factory.ts:24`); the boundary scan bars `apps/web` from it. |
| D435 (v_statements reuses estimates) | holds | D969. |
| D541 to D545 | holds | `company.tsx:466` (seat order), `news.tsx:187` (`FEED_ROWS = 500`). Directors are simple characters only (D989). |
| D631, D632, D633 | holds | `views/province_cards.ts`, `views/map_static.ts`; Province page `pages/kinds/province.tsx:7`. The Political layer is the only one drawn. |
| D700 (map modes and their views) | gap (UI half) | Sim half holds (`views/map_layers.ts`, `m8_map_modes.test.ts`); the UI draws none of the modes (G2). |
| D701 (no hidden figure in layers) | holds | `views/map_layers.ts:16-19`; checked by the view leak test. |

### 3.3 UI and workspace (60 rows)

| Rows | Class | Evidence |
|---|---|---|
| D450 (tiling panes, up to 12, history, saved layouts) | holds | `Workspace.tsx:50` (`MAX_PANES = 12`), `:231`, `LAYOUT_KEY`; layouts kept across D1014 (`migrateLayout`). |
| D451 (typed page refs) | holds | `pages/ref.ts:25-54`. No Character page (D989); new Politics and World History pages. |
| D453 (shortcuts), D458 (densities, 75% to 150%) | holds | `config/settings.ts:22-23`, `:179-201`; `App.tsx:58`. |
| D454, D463, D464 (links, hover cards, name index) | holds | `links/Link.tsx`, `links/cards.ts`, `links/names.ts`. |
| D455 (command bar matching) | holds | `links/names.ts`; `shell/CommandBar.tsx`. |
| D456 (cell kinds; `$12.0M-$18.0M`) | holds | `widgets/cells.ts:170` (" to " when an end is negative). |
| D460, D461, D465, D466, D480 to D483 | holds | `pages/sections.ts`; `TABLE_ROWS_SHOWN = 40` (`pages/parts.tsx:72`); `company.tsx:8-14`, `:458`, `:524` (votes, never odds). |
| D485 (slow views rebuild pages) | holds | D976 (`PAGE_REFRESH_MS`); D1016 slices. |
| D511 to D518 | holds | `news.tsx`, `recap.tsx`, `AlertsPane.tsx` (D513); `pdoomberg/models.ts:85` (F2), `:273` (F4 lock only), `Pdoomberg.tsx:233` (F9 Industries), `:327` (F keys only while open, D517). |
| D520 (Pdoomberg builds on first open) | holds | `App.tsx:17`, `Pdoomberg.tsx:17`. |
| D570 (demo gone; World page from views) | holds | `pages/kinds/world.tsx`; demo panes retired (D1014). |
| D571, D572 (pane minimum size; recap box grows) | holds, doc only | dockview's own minimums and CSS; no TS test found. |
| D707 (Province page and links) | holds | `pages/kinds/province.tsx`; links in `country.tsx`, `links/names.ts`. |
| D636 (camera pan, zoom, levels) | gap (minor) | Pan, zoom, wrap and the province-line fade are ported (`map/view.ts`, verified). W A S D and Q / E keys are missing; region lines are not drawn (G2). |
| D637 (picking; click opens the page) | holds | `ProvinceMap.tsx:169-178` (Shift+click opens a new pane; D1014). |
| D635 (floating windows over the map) | gap | G3. |
| D640, D702, D703, D704, D706 | gap | G2. |
| D800 (Quarter start alert; plan lock Pause) | holds | `types/notice.ts:120-123`. In era worlds, now the default, calendar alerts start on Log (`:138-139`, D1002), so a new default game does not pause at the plan lock. |
| D462 (places, controllers and roles named and linked) | replaced by D989 | Controllers show a name and have no page. |
| D486 (partial characters marked, not linked) | replaced by D989 | Still marked (`company.tsx:509`); no character is linked now. |
| D452 (`ui.ron`), D457 (bevy_ui chart), D488, D510 (Live widgets), D638 (UI shader; the palette is ported to `map/colors.ts`), D641, D708, D770 to D777, D803, D804, D806 | obsolete | Bevy, frame and pacing work. Replaced by localStorage settings (`config/settings.ts`), React charts (`widgets/PriceChart.tsx`, `pages/ChartBlock.tsx`), D976 page refresh, and the worker's frame flow (D1004, D1016). |

### 3.4 Map pipeline and provinces (52 rows)

The Python pipeline is unchanged except that its mapgen step now calls `apps/mapgen` (`tools/map-pipeline/pipeline/mapgen_step.py:1`, `:29`). All map, world and design data are unchanged since 334ee6d (verified by diff). The TS mapgen's tables are byte-identical to the Rust tool's and its bitmaps pixel-identical (D1017, measured); its tests are `apps/mapgen/test/parts.test.ts` and `small-map.test.ts`.

| Rows | Class | Evidence |
|---|---|---|
| D600, D602 to D605, D608 to D612, D670, D672 to D675, D677 to D680, D682 to D684, D686 to D692, D694 | holds | Pipeline and data unchanged. Miller in `apps/mapgen/src/miller.ts`. |
| D606, D607 (own scanline fill; tiny provinces) | holds in mapgen | `apps/mapgen/src/raster.ts:1`, `build.ts:11`, `:213`. The UI click target for tiny provinces is missing (D640, G2). |
| D630 (map data static, not saved or hashed) | holds | The topology is served static (`apps/web/vite.config.ts:11-31`), and the save holds the world only (`save.ts:7-9`). |
| D634 (synthetic map for tests) | obsolete | `mapgen synthetic` is not ported (D1017); sim-data uses `test/map-fixture.ts`. |
| D820 to D822, D824, D827 to D829 | holds | 3,963 provinces (verified above); province keys by CSV id (`pages/ref.ts:140`, D828). |
| D826 (save version 11; old saves refused with a reason) | holds | Refusal with a reason ported (`save.ts:37-41`); the number is now 4. |
| D830 (HQ weight above the floor) | holds | `births/weights.ts:82`, `births/jobs.ts:189`. The founders' half is moot (D989). |
| D851 to D856 | holds | Data unchanged. |
| D823 (compass names), D825 (row text says 3,968), D850 (straight survey lines) | needs Logan | Unchanged by the port. |

### 3.5 Benches, checks and build (40 rows)

| Rows | Class | Evidence |
|---|---|---|
| D143 (tracking within ±30%) | holds | `TRACKING_BAND = 0.3`; `m5_tracking.test.ts:46` (98% overall). |
| D151 (98% overall, 97% each year) | gap (logged) | G5: 96% each year. |
| D152 (max-speed budget allows the crossing tick) | holds | `apps/web/test/sim.test.ts:268`; worker budget `frame-flow.test.ts:21`. |
| D166, D320, D321, D323, D325, D327, D328, D330 to D332, D334 | holds | `apps/headless/src/metrics.ts`, `targets.ts`; `targets.test.ts`. |
| D329 (named-company count; 30-year targets NA on short runs) | holds | The full-character targets it covered are gone (D989). |
| D333 (each seed in its own process) | holds | Now a `worker_threads` Worker per seed (`soak.ts:1-4`). |
| D326 (cast sizes at each birth) | replaced by D989 | Reads the simple cast only (`targets.ts:88`). |
| D400, D403, D404, D405 | holds | `apps/headless/src/profile.ts:1`, `replay.ts`, `cli.ts:13-16`; `m10_save_load.test.ts`; `m10_boom_pop.test.ts:3-5`, `:227` (1e-9). |
| D573 (timing harness for every page kind) | holds, not gated | `apps/web/bench/pages.test.tsx`, on demand (D1013). Rust's failed the run on a miss; TS's does too, but only when run by hand. |
| D574 (leak test with an Omniscient twin) | holds | `ui-leak.test.ts` in the gate (D1013). |
| D693 (cold-open retry) | needs Logan (low) | The retry is kept in TS (D1013); the revisit still stands. |
| D705, D740, D743 (map checks, every-province click, leak test on the map) | done (D1020) | G2: back with the map features: `map.test.ts` (D740), `ui-leak.test.ts` (D705, on the committed world map as D743 says). |
| D805 (speed 5 reported, not gated) | gap (TS form) | G4. |
| D438 (boundary check builds each binary), D459, D519, D639, D741, D742, D744, D778, D779, D790, D802, D870 | obsolete | Rust build, Bevy benches, window and shader. Replaced by `scripts/ts/boundary.ts`, the page bench and the D1014/D1016 browser measurements. |

## 5. Section 5 design fixes the port changed

Moot or changed:

| # | Now |
|---|---|
| 4 | Companies founded in play: still 5.19.4, but with no founder (D989). |
| 6 | Moot. The Bevy table widget is gone; tables are `widgets/DataTable.tsx`. |
| 11 | Moot for now. The 296 full characters are not loaded (D989); characters.csv waits for the rework. |
| 242 | Moot. No founders (D989). |
| 360 | Replaced by 974: the build plays +1.0 below 100 (D974). |
| 369 | Moot as worded (no binaries). The new form: is Chrome on Windows enough, or must Firefox and Safari be checked? |
| 441 | Still Decide, for the docs only. The TS prints `$12.0M-$18.0M`, and "a to b" when an end is negative (`widgets/cells.ts:170`). |
| 574 | Still prose. The TS leak test adds two rules (a subject's own figures are excused; the listing raise is public), per D1013. |
| 600 | The geo-rasterize half is moot (mapgen is TS, D1017); the Natural Earth version line stands. |
| 830 | The founders' half is moot (D989). |

New since the doc (none in its 79 rows):

| # | Status |
|---|---|
| 882 | Prose. The table spike note names a deleted example; now moot with all of Rust gone. |
| 950 | Prose. mvp-spec 3, 9, 10 and 12 name Rust, Bevy and the bitmap shader. |
| 970, 971, 972 | Decide. Private productivity in statements, the loss streak in the recap, and the top-5 order ranked by true surprise. Rust had all three; the TS leak test found them. |
| 973 | Decide. R&D diminishing returns are on by default (D973); should 5.6 say so? |
| 974 | Decide. +1.0 below 100 (D974); should 6.3 say so? |
| 979 to 982 | Decide or prose. Politics POC party naming and chambers; 19-history and 7.1 bind only the 2020 world; scenario picker; 1995 ideology mix. |
| 983 | Prose. 05-map and data/README still say 3,255 provinces. |
| 1017 | Prose. Build-plan section 2 and 3.3 describe deleted crates. |

## 6. Section 6 open items

| Item | Class | Note |
|---|---|---|
| macOS and Linux untested | obsolete | No native binaries. Becomes: browsers other than Chrome untested (needs Logan). |
| Speed 5 is a known FAIL | obsolete | Bevy frame cost. Its TS form is G4. |
| Province split phase 2 | needs Logan | The 4,095 colour-table limit was the WGSL shader's and is gone with it. No `MAX_MAP_PROVINCES` exists in the TS. mapgen's index bitmap is 16-bit, so it holds up to 65,534 provinces. |
| Compass names | needs Logan | Unchanged. |
| Border grid pattern | needs Logan | Unchanged. |
| Karamoja | needs Logan | Unchanged. |
| Provenance-risk boundary files | needs Logan | Unchanged. |
| Your hands-on map check | needs Logan | Now on the deck.gl map, which has only the Political mode (G2). |
| Your hands-on workspace check | needs Logan | Now on the dockview workspace. An agent walk-through passed (D1014, doc only). |
| Coastal flag differences | needs Logan | Unchanged. |
| Split giants' leftovers | needs Logan | Unchanged. |
| Dormant share raises | needs Logan | Still dormant in the 2020 world; the 1995 world has D997's growth raise. |
| Spec text past v1.4 | needs Logan | Larger now: add 950, 970 to 983, 1017. |
| Self-contained release | holds | The web build copies the world CSVs and the map into its output (`apps/web/vite.config.ts:11-31`). Where to host it is a new question. |

## 7. Proposed replacement text

### Section 1. Status (TS)

- **Done:** the game is TypeScript in the browser. The port's Steps 0 to 6 are merged (PRs #56 to #118). The Rust code is deleted (D1017). Its last tree is main 334ee6d.
- **Worlds:** the default world starts in 1995. It has 300 companies and runs to a reveal on 1 January 2020. The 2020 world is still played with `?world=2020` or `--world 2020`. It has 3,963 provinces, 651 companies and 467 listed at load. Saves are version 4. Rust saves do not load.
- **Sim:** it matches the Rust rules. Every numeric constant is the same, except four that later decisions changed (D974, D1002, D957, D994). The full characters are removed for now (D989).
- **Soak:** on 2026-10-25 a 50-seed, 30-year soak of the 2020 world met all 19 targets Rust met. All 1,590 yearly bands were inside Rust's range (D951). It has not been run since D973, D974 and D989. A 30-year seed takes about 102 s, against a 2-minute budget.
- **Screens:** on a production build every page opens in 7 to 35 ms. The UI leak test is in the gate and finds no private figure. It skips the map, which shows only countries. Design fixes 970 to 972 are known leaks that Rust had too.
- **Map:** the map draws countries and provinces, pans, zooms and wraps. A click opens the Province page. It has no other map mode, pins, labels or hover card yet.
- **Speed:** at max speed with the map alone the window stays smooth. With five heavy pages it stalls about twice a second for 50 to 70 ms. The map's frame rate while panning is not measured.
- **Gate:** `scripts/check-ts.ps1` runs the typecheck, Biome, the boundary scan, Vitest and both worlds' data checks.
- **Tested in Chrome on Windows only.** The sim gives the same hash in Node and Chrome (D1015). Other browsers are untested.

### Section 7. Checklist (TS)

- [ ] Section 2: nothing to do. Note that D9, D13 and D360 were replaced by D956, D957 and D974.
- [ ] Section 3.1 sim and economy: sign off, or revisit D266 and D271
- [ ] Section 3.2 views and estimate bands: sign off
- [ ] Section 3.3 UI and workspace: sign off the rows that hold. Rule on the map gaps and on D635
- [ ] Section 3.4 map pipeline and provinces: sign off, or revisit D823, D825 and D850
- [ ] Section 3.5 benches and checks: sign off, or revisit D693. Accept the 96% yearly tracking floor (D974), or ask for 97% back
- [ ] Tick D989 in place of D270, D274, D326, D462 and D486
- [ ] Section 4: skip the 5 superseded rows
- [ ] Rerun the 2020 parity soak at the tip, after the parity tool drops the D989 targets
- [ ] Map modes, pins, labels and the hover card: build them before sign-off, or defer them
- [ ] Floating windows over the map (D635): keep the tiling workspace, or ask for windows
- [ ] Measure the map's frame rate while panning at max speed
- [ ] Pick the default economy profile: legacy, vanilla or mature (D970, D977)
- [ ] Section 5: rule on the "Decide" design fixes: 208, 226, 232, 235, 240, 367, 368, 441, 601, 670, 970, 971, 972, 973, 974, 979
- [ ] Section 5: plan the spec pass for the prose fixes, with 950, 980 to 983 and 1017
- [ ] Browsers: accept Chrome only, or ask for Firefox and Safari checks
- [ ] Province split phase 2: go or no go
- [ ] Compass names: accept them, or ask for hand names
- [ ] Organic borders: accept them, and say whether straight survey lines stay
- [ ] Karamoja: pick a region for UG-0008
- [ ] Provenance-risk files: accept them, or ask for replacements
- [ ] Try the map by hand
- [ ] Try the workspace by hand
