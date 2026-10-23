# M8 closing checks (m8-plan section 3 Phase C, section 6)

The checks m8-plan asks for before M8 closes, on the committed world map (`assets/map`, all 3,255 provinces), and how to run them. The M9 checks' earlier M8 results (Phase A and B, on the synthetic and North American maps) stay in [m9-checks.md](m9-checks.md).

## Results

Logan's PC (Windows 11, 24 threads, RTX 5070 Ti), October 2026, branch `build/m8-c-closing-checks` from main 5074f00, the world map, seed 1, the window at its default 1280 x 720.

| Check (m8-plan) | How | Result |
|---|---|---|
| M8.8 click test: every province clickable | `cargo test -p game --test m8_map every_world_province` (in the gate) | 3,255 of 3,255 pick their own id at their label point (the 372 tiny ones at their click target): 2,964 from World zoom, 291 from Country, none needs Province; then all 3,255 clicked through the shell to their Province page. Debug 10.5 s |
| 60 fps with the panes open, in release | `target/release/game --bench-map 15 --map-mode MODE [--bench-map-running SPEED] [--bench-map-panes SET]`, a check since D778 (exit 1 when p99 is 16.7 ms or more) | Paused, every mode at every zoom level: p99 4.67 ms or less, max 6.39 ms, 321 to 349 fps (60 fps is 16.7 ms). Running at speed 4: p99 5.11 ms or less, max 19.1 ms (the daily rollover). At speed 5 (max, a fast-forward): 35 to 40 ms p50, p99 47 to 57 ms, max 50 to 67 ms, mostly the open Company and Province pages (D744). **After the page fixes (D770 to D778, below):** speed 5 with the four panes p50 12 ms, p99 18 to 21 ms, 87 to 95 fps: FAIL, the sim's own quarter ticks (no pane open: p99 14.6 ms, PASS); speed 4 PASS for every pane set, paused PASS |
| Leak test on the world map | `cargo test -p game --test m9_leak` | Pass, no leak: 94 modes, 552 banded HQ pins, 329 heat values, 145 province cards, 26 zone cards a state, and the Province pages; debug 25 s, release 8.6 s |
| Timing harness on the world map | `target/release/game --bench-pages` | `pages 59 opened, worst 20.64 ms: PASS` twice; the Province page 9.7 to 10.9 ms, every mode switch 5.6 ms or less |
| Startup render error | D741 | Cause found (a stale binary against a newer shader); the shader is now compiled in and its layout tested |
| P8 QA | the qa step (below) | Every region passes; the remaining items were signed off at the Phase B gate |
| Soak invariance | `headless soak --years 10 --seeds 1..4` | Byte-identical to main 5074f00 and to pre-M8 main 6db93fd (below) |
| The full gate twice | `bash scripts/check.sh` | Passed twice (below) |
| CREDITS.md complete | `assets/map/CREDITS.md` against the crosswalks' provenance | Natural Earth, and all 60 geoBoundaries files the crosswalks name (country and level), each listed with its source and licence; none missing, none extra; the builder-drawn lines are named and listed in the QA reports |
| Logan tries the map by hand (m8-plan 6) | pan, zoom, modes, picking, panes over the map, province links | **Pending Logan** |

## M8.8: the click test

`picking::every_world_province_is_clickable` in `crates/game/tests/m8_map.rs` (D740) runs in the normal gate on the committed `assets/map`; nothing is skipped and no environment variable is needed. For each row of province-centroids.csv it checks the label point against the views', then centres the camera on it at each wheel notch from the farthest zoom of the default 1280 x 800 map view to the closest (16 zooms) and asks the picker (`map::picking::pick`, what a click runs) for the province there. The farthest zoom where the answer is the province whose v_province_card key is the row's id is that province's zoom; a province with none fails the test. Then every province is clicked at its zoom through the shell (`MapInput::Click`), and the focused pane must open its Province page.

```
M8.8 click test: 3255 provinces (372 tiny, 0 with the label pixel not their own), 16 zooms each at most; first won at World 2964, Country 291, Province 0; 0 never; 3255 clicked through the shell; 10.53 s (0.83 s loading, 0.03 s picking)
```

## The map's frame time with the panes open (`--bench-map`, D742)

```
cargo build --release -p game
target/release/game --bench-map 15 --map-mode political      # each mode below; --map-metros adds the outlines
```

Pdoomberg's F10 Screener (651 rows) is opened and closed, so its page is held behind the workspace (D520); then Companies and Industries side by side in one window, a company page (company/0) in a second, and the Province page of the province with the most HQs and units (province/581) in a third. The camera pans every frame and zooms through the three levels while the hover point moves, without vsync. 15 s a run, nothing else running.

| Mode | fps | All: p50 / p95 / p99 / max ms | World: p50 / p95 / p99 | Country: p50 / p95 / p99 | Province: p50 / p95 / p99 | Frames World / Country / Province |
|---|---|---|---|---|---|---|
| Political | 344 | 2.84 / 3.76 / 4.49 / 5.72 | 2.97 / 3.87 / 4.46 | 2.78 / 3.76 / 4.64 | 2.61 / 3.53 / 3.96 | 2070 / 2245 / 840 |
| Political with Metro outlines | 349 | 2.84 / 3.34 / 3.70 / 6.09 | 2.99 / 3.36 / 3.62 | 2.78 / 3.36 / 4.06 | 2.61 / 2.99 / 3.14 | 2100 / 2295 / 841 |
| Development: Commerce | 342 | 2.84 / 3.85 / 4.45 / 6.39 | 2.96 / 3.87 / 4.47 | 2.78 / 3.82 / 4.51 | 2.62 / 3.82 / 4.11 | 2071 / 2227 / 836 |
| Development: Industry | 343 | 2.85 / 3.80 / 4.46 / 6.31 | 2.97 / 3.83 / 4.46 | 2.79 / 3.79 / 4.55 | 2.61 / 3.77 / 4.14 | 2075 / 2219 / 844 |
| Development: Population | 343 | 2.85 / 3.82 / 4.50 / 6.31 | 2.97 / 3.94 / 4.55 | 2.78 / 3.81 / 4.58 | 2.60 / 3.64 / 4.07 | 2076 / 2218 / 847 |
| Development: Total | 341 | 2.85 / 3.89 / 4.45 / 6.35 | 2.97 / 3.97 / 4.45 | 2.77 / 3.81 / 4.50 | 2.63 / 3.85 / 4.19 | 2074 / 2215 / 831 |
| Industry track | 346 | 2.82 / 3.73 / 4.21 / 6.10 | 2.95 / 3.87 / 4.23 | 2.76 / 3.66 / 4.26 | 2.62 / 3.62 / 4.14 | 2076 / 2278 / 838 |
| Industry 28's assets | 344 | 2.86 / 3.55 / 4.24 / 5.37 | 2.96 / 3.49 / 4.19 | 2.81 / 3.63 / 4.38 | 2.64 / 3.38 / 3.92 | 2072 / 2242 / 852 |
| Company HQs (651 pins) | 321 | 3.03 / 3.91 / 4.22 / 5.88 | 3.49 / 4.05 / 4.31 | 2.89 / 3.61 / 3.92 | 2.67 / 3.08 / 3.36 | 1913 / 2124 / 785 |
| Financial zones | 344 | 2.87 / 3.43 / 3.72 / 5.30 | 3.08 / 3.53 / 3.75 | 2.79 / 3.40 / 3.68 | 2.64 / 3.03 / 3.28 | 2063 / 2254 / 841 |

No mode or zoom comes near 60 fps (16.7 ms), so nothing needed profiling. The HQ mode at World zoom costs the most (651 pins on screen at once, 0.5 ms over Political at p50).

### With the sim running (`--bench-map-running [SPEED]`, D744)

The paused bench never rebuilt a pane or rewrote the colour table, so the bench can also run the sim, at a speed from 1 to 5 (default 5; alerts off). Every map bench now lists its 8 slowest frames, with the zoom level and two flags: whether v_company_row's version moved in the frame (the monthly views the open pages rebuild on) and whether the colour table was rewritten. It also reports frames with and without a monthly rebuild separately. 15 s a run, the same panes.

| Mode | Speed | fps | All: p50 / p95 / p99 / max ms | Monthly rebuild frames: p50 / p99 | Other frames: p50 / p99 | Slowest frames |
|---|---|---|---|---|---|---|
| Political | 4 | 338 | 2.90 / 3.48 / 4.49 / 18.28 | none in the run | 2.90 / 4.49 | 18.3, 18.1 ms: a pair about 56 frames apart, no flag (the daily rollover) |
| Development: Total | 4 | 333 | 2.93 / 3.84 / 4.46 / 18.23 | none | 2.93 / 4.46 | 18.2, 18.0 ms, the same pair |
| Industry 28's assets | 4 | 331 | 2.95 / 3.86 / 4.49 / 18.63 | none | 2.95 / 4.49 | 18.6, 17.8 ms, the same pair |
| Company HQs | 4 | 303 | 3.19 / 4.28 / 5.11 / 18.80 | none | 3.19 / 5.11 | 18.8, 18.5 ms, the same pair |
| Financial zones | 4 | 293 | 3.35 / 4.22 / 4.77 / 19.13 | none | 3.35 / 4.77 | 19.1 ms (with a colour-table rewrite: the zone effects move daily), 19.1 ms |
| Political | 5 | 28 | 34.75 / 44.21 / 47.16 / 51.83 | 36.60 / 48.80 (240 frames) | 31.94 / 35.52 | 51.8, 49.7, 48.8 ms, all with a monthly rebuild and a rewrite |
| Development: Total | 5 | 28 | 35.12 / 43.82 / 47.33 / 52.02 | 36.85 / 51.57 (233) | 32.30 / 36.76 | 52.0, 51.9, 51.6 ms, the same |
| Industry 28's assets | 5 | 28 | 34.78 / 43.74 / 47.58 / 50.30 | 36.77 / 49.08 (236) | 32.16 / 35.22 | 50.3, 50.0, 49.1 ms, the same |
| Company HQs | 5 | 25 | 39.89 / 52.13 / 56.49 / 66.58 | 42.32 / 57.80 (214) | 33.66 / 40.67 | 66.6, 58.8, 57.8 ms, the same (the pins rebuilt too) |
| Financial zones | 5 | 24 | 40.13 / 48.23 / 52.58 / 57.13 | 44.81 / 55.63 (163) | 38.15 / 44.63 | 57.1, 56.6, 55.6 ms, the same; the table is rewritten every frame |

At speed 4 (5 game hours a second, the fastest timed speed) the map with the panes open stays far inside 60 fps. The only frames over 10 ms come in a pair about 56 frames apart once a run, with no monthly rebuild and no rewrite, which is the daily rollover; they reach 19 ms, just past one 60 fps frame. Speed 5 is the fast-forward (D300: the bridge steps the sim for an 8 ms budget each frame and advances about 9 game months a second), and there the frame is 35 to 40 ms. Taking panes away at speed 5 (scratch runs, Political) shows where the frame time goes:

- none of the panes: 11.9 ms p50;
- Companies and Industries only: 14.9 ms;
- the Province page only: 19.9 ms;
- the company page only: 28.2 ms.

So most of the max-speed frame comes from the open Company and Province pages rebuilding on monthly views and updating live figures every tick. Monthly-rebuild frames cost about 5 ms more than the others. The map itself (layer, colour table, pins) adds little. This is a cost of the M9 pages at fast-forward, flagged for their owner in D744; 60 fps at max speed was never a target.

The reviewer's 44.5 ms frame (paused, Political, World zoom) did not come back in 13 paused 15 s runs here (max 8.7 ms). Some runs, paused or running and in any mode, settled for a while into a steady 16.6 ms frame: Windows pacing the window's presents at 60 Hz, probably while it was not in front or the display was idle. That is when frames of 20 to 29 ms came, with no flag set, so they were not the game's work. The tables leave those runs out; they were rerun.

### At max speed after the page fixes (D770 to D778)

Branch `build/m8-speed5-page-cost` from main fe4b4c8, October 2026, Logan's PC, the world map, Political, 15 s a run. The check:

```
cargo build --release -p game
target/release/game --bench-map 15 --map-mode political --bench-map-running 5     # the four panes; exit 1 when p99 >= 16.7 ms
target/release/game --bench-map 15 --map-mode political --bench-map-running 5 --bench-map-panes none    # or lists, company, province
cargo build --release -p game --features profile    # adds the span timer and the per-frame work counts (D770)
```

Run it with the window in front: the bench prints the share of frames the window had the focus, and an unfocused window's presents are paced at 60 Hz by the OS (D744; it warns when 30% of the frames sit at 16.3 to 17.0 ms). Only runs with the focus in 97% or more of the frames are below; the machine was in use, so each was rerun until one kept the focus.

**Where the frame went (main, profiled, the four panes, D770).** Per frame: sim stepping 9.5 ms (2.9 fixed steps), `ui_layout_system` 7.3, the page rebuilds' spawn and despawn commands 5.7, text measuring 2.6, the tables' pools and layouts 4.7, the view copy 2.1, the name index 1.6, the price chart 1.5, extraction 3.7. 1,939 UI nodes spawned, 2,351 changed and 724 texts changed a frame. At 8.6 game months a second v_company_row (monthly and at the lock) moved every 1.5 frames, and the Company page rebuilt 0.70 times a frame, the Province page 0.52; the daily views (bars, zones, exchanges) moved every frame, so the live chart was re-set every frame (1,310 nodes written) and 7.4 live spans written; the name index rebuilt on every daily move of v_zones; the frames that started a month's (4 to 5 ms) or a quarter's (6 to 16 ms) tick at the end of the 8 ms budget ran 13 to 24 ms of stepping; the view copy cloned every moved view (up to 7 ms on a month).

**What changed.** Doc pages patch in place on a view move (D772); at fast-forward the page refreshes, live spans, charts, tables, `Live` widgets, the name index, the event log and the top bar's clock are paced to a few a second, with the heavy ones one a frame in frames the sim left light (D773, D777), all flushed in the frame of a pause or a control change; the index keys the daily views on their names (D771); the chart writes only the nodes that moved (D774); views share their data with the copy and the old copies are freed off the frame (D775); a costly tick waits for the next frame instead of overrunning the budget (D776). After (profiled): 5.7 nodes spawned, 435 changed and 33 texts changed a frame, 0.04 page patches and no rebuilds a frame, 0.6 live span writes, 0.013 chart re-sets (18 nodes written).

| Panes | Speed | main fe4b4c8: fps, p50 / p95 / p99 ms | this branch: fps, p50 / p95 / p99 ms | Check |
|---|---|---|---|---|
| all four (the check's set) | 5 | 25, 37.9 / 49.0 / 55.6 | 92, 12.6 / 16.6 / 18.0 (other runs p99 19.7 to 21.0) | FAIL |
| none | 5 | 83, 12.8 / 25.5 / 32.2 | 224, 2.3 / 12.2 / 14.6 | PASS |
| Companies and Industries | 5 | 65, 15.5 / 28.2 / 36.4 | 169, 3.2 / 13.9 / 17.2 | FAIL |
| the company page | 5 | 28, 34.5 / 44.9 / 58.7 | 117, 8.1 / 15.8 / 18.4 | FAIL |
| the Province page | 5 | 46, 20.9 / 31.6 / 35.5 | 178, 2.9 / 14.5 / 16.9 | FAIL (at the line) |
| all four | 4 | 258, 3.7 / 5.1 / 7.1 | 265, 3.6 / 5.2 / 6.3 | PASS |
| none | 4 | 539, 1.8 / 2.5 / 2.9 | 574, 1.7 / 2.3 / 3.0 | PASS |
| Companies and Industries | 4 | 403, 2.4 / 3.3 / 3.8 | 400, 2.4 / 3.3 / 4.0 | PASS |
| the company page | 4 | 388, 2.5 / 3.4 / 4.0 | 388, 2.4 / 3.5 / 4.4 | PASS |
| the Province page | 4 | 438, 2.2 / 3.0 / 3.5 | 447, 2.2 / 3.0 / 3.6 | PASS |

(The main numbers come from main's binary with the bench's pane choice patched in for the run, not committed; at speed 5 main ran 6,600 game hours a second with the four panes and this branch 13,500, since the frames are shorter.)

**Why speed 5 still misses 60 fps with the panes open.** The frame at max speed is the sim's stepping plus the UI. The stepping alone, with the costly ticks now opening frames (D776), is p50 7.2 ms, p95 9.4, p99 10.9 and max 15 to 18 ms: a quarter's start, release, price move and plan lock run up to 15 to 17 ms each in the game (mean 5.6 ms), and one tick cannot be split. The frame less the stepping (the UI, the map and the render) is p50 5.4 ms, p95 8.5 and p99 10.9 with the four panes, against 2.3 / 3.6 / 5.0 with none: the panes' standing cost at speed 5 is the layout and render of their few thousand nodes, about 3 ms a frame (1.9 ms at speed 4). So the frames that carry a 10 to 16 ms quarter tick (about 1 in 50) land at 16 to 21 ms with the panes open and 13 to 15 ms without. Reaching p99 under 16.7 ms with the panes needs the sim's quarter ticks under about 8 ms in the game, or the stepping budget shorter than 8 ms (D300), which would slow max speed; neither is a UI change. The leftover UI work is already off those frames: every paced heavy job waits for a frame the sim left light (D777).

The page timing harness (`--bench-pages`, sim paused) passes: `pages 59 opened, worst 22.72 ms: PASS` and `worst 34.13 ms: PASS` (company/0 cold; the machine was in use). The paused map bench passes its check in every mode it was run in (Political and HQs: p99 11.8 ms with the machine in use, PASS). The leak test passes in the gate (and `cargo test -p game --test s5_pace` covers the patch, the pacing, a pause showing the final values, an Omniscient toggle rebuilding at once while fast-forwarding and a hidden pane waiting). The 10-year soak (`headless soak --years 10 --seeds 1..4`) is byte-identical to main fe4b4c8 built in this slot: `years.csv` md5 121b5c7ba2ae4edcb9ed12d28764563e, `quarters.csv` cf890b482bd1f4c420cb3c6dc7f73a35, the same four seed hashes.

The full gate (`bash scripts/check.sh`, debug build warm) on this branch at 44ff004: `== all checks passed`, 671 tests passed and none failed, 450 s.

## The M9 checks on the world map

**Leak test** (D743): `m9_leak.rs` now runs the shell on the committed world map and its 8,192 x 4,096 bitmap instead of a synthetic 1,024 x 512 world. It covers the province hover card, the Province page, the HQ pins, the zone card and every mode:

```
fresh: map: 94 modes, 552 banded HQ pins, 329 banded heat values, 145 province cards, 26 zone cards
after the Q1 recap: map: 94 modes, 552 banded HQ pins, 329 banded heat values, 145 province cards, 26 zone cards
fresh: 2712 screens, 196 subjects, 62092 true renderings, 24550 bands checked (none at or past its truth, no money end reading as it), 0 entries unpaired
after the Q1 recap: 2727 screens, 196 subjects, 93593 true renderings, 36694 bands checked (none at or past its truth, no money end reading as it), 0 entries unpaired
```

Pass: debug 25.5 s in the gate; release (`cargo test --release -p game --test m9_leak --config profile.release.package.sim.debug-assertions=true`) 8.6 s.

**Timing harness** (`target/release/game --bench-pages`, which draws `assets/map`): two runs, both `pages 59 opened, worst 20.64 ms: PASS (target < 100 ms)`, exit 0.

| Item | Run 1 cold / warm ms | Run 2 cold / warm ms |
|---|---|---|
| province/431 | 9.72 / 10.88 | 9.85 / 10.15 |
| map mode development:commerce | 1.80 / 1.41 | 1.69 / 1.51 |
| map mode development:industry | 1.47 / 1.38 | 1.45 / 1.42 |
| map mode development:population | 1.40 / 1.46 | 1.48 / 1.37 |
| map mode development:total | 1.38 / 1.41 | 1.45 / 2.00 |
| map mode industry track | 1.39 / 1.44 | 1.65 / 1.39 |
| map mode industry:28 | 1.49 / 1.40 | 1.51 / 1.29 |
| map mode hqs | 5.61 / 4.58 | 5.44 / 4.34 |
| map mode hqs listed | 4.55 / 4.49 | 4.16 / 4.15 |
| map mode zones | 2.44 / 2.45 | 3.14 / 2.67 |
| map mode political | 1.64 / 1.47 | 1.66 / 1.57 |

## The startup render error (D741)

A PR #40 review run once stopped at startup with `ui_material_pipeline: Shader global group 1 binding 0 ... Buffer structure size 128 ... greater than min_binding_size 112`. The 112 is the pipeline layout from the binary's Rust `MapParams` (fixed at compile time) without the `metro` field lane MB added; the 128 is the WGSL struct with it. The binary read the shader at run time from the `assets` folder of the tree that built it (`CARGO_MANIFEST_DIR/../../assets`), so a binary older than its checkout drew the updated shader over its old layout. The main checkout's `target/release/game.exe` (built 22 Oct 22:17, before `metro`; it has no `--map-mode`) against that checkout's current shader reproduces the error exactly, every run: a stale binary, not a race. Now the WGSL is compiled into the binary (`include_str!`, registered under a fixed handle), nothing is read through the asset server, and `the_shader_and_the_rust_map_params_share_one_layout` (naga parses the WGSL; the size, the member names and every offset are checked against the bytes encase writes for each Rust field, and the bindings too) fails the gate if the two drift.

## The other clean-ups

- The Province placeholder (D637's Phase A page: its sections, card lines, links and plan text) is deleted from `pages/placeholder.rs`; lane MB's Province page (D707) is the only one.
- `examples/table_spike.rs` builds (`cargo build -p game --example table_spike`).

## Soak invariance

```
cargo build --release -p headless
target/release/headless soak --years 10 --seeds 1..4 --out DIR
```

Run at main 5074f00 and at pre-M8 main 6db93fd (this slot checked out at each) and on this branch: byte-identical `years.csv` (md5 121b5c7ba2ae4edcb9ed12d28764563e) and `quarters.csv` (md5 cf890b482bd1f4c420cb3c6dc7f73a35), 3 s for the four seeds. They are also the md5s lane MB recorded against main a31b1a9 (m9-checks.md): the map moves nothing in the economy. This branch changes no file under `crates/sim`, `crates/sim-data`, `crates/headless` or `docs/design`, so the two headless builds are the same code.

## The full gate, twice

`bash scripts/check.sh` (fmt, clippy, the boundary checks, every test, validate.py, `--check-data` on assets/map) on this branch, debug build warm: both runs `== all checks passed`, 665 tests passed and none failed in each, 355 s and 323 s. After the PR #42 review fixes (D741 widened, D744) it passed again: 665 tests, none failed, 403 s.

## P8: the map QA reports

The QA step on the committed assets, alone (it reads the pipeline's intermediates in the geodata cache, `D:\Data\tc20ff-geodata\work\`, from the run that built the assets):

```
cd tools/map-pipeline
uv sync --frozen
uv run python run.py --region all --steps qa
```

Result on Logan's PC, October 2026, main 5074f00 (a fresh venv in this slot): every region passes in 29 s, and the reports, previews and CREDITS.md it rewrites are byte-identical to the committed ones (no diff in `assets/map`).

| Region | Flagged (confidence < 0.6) | Hinted | Tiny | Coastal differences | Nesting problems | Result |
|---|---|---|---|---|---|---|
| north-america | 4 | 40 | 18 | 30 | 0 | pass |
| east-asia-oceania | 0 | 96 | 89 | 61 | 0 | pass |
| europe | 0 | 100 | 64 | 35 | 0 | pass |
| latin-america | 0 | 19 | 43 | 25 | 0 | pass |
| mena | 0 | 80 | 72 | 32 | 0 | pass |
| russia-central-asia | 0 | 27 | 12 | 3 | 0 | pass |
| south-asia | 0 | 43 | 21 | 10 | 0 | pass |
| sub-saharan-africa | 0 | 27 | 53 | 22 | 0 | pass |
| **world** | **4** | **432** | **372** | **218** | **0** | **pass** |

QA fails on anything that is an error (a province without pixels, a licence problem, a city probe mismatch, an unchecked Natural Earth label row, a hint seed outside its region, an unexplained exclave, a `sea_only` pair with a land row), so a pass leaves only the items each report lists for review: the low-confidence and hinted crosswalk rows, the builder-drawn and approximate lines (D676, D681), Known for review, the watched small provinces, the coastal differences, and the refused attribution-only licences (swisstopo for CHE, "Other - Direct Permission" for OMN; D685). **Logan reviewed those items at the Phase B gate (the flagged crosswalk rows of every region) and passed it, so every report's remaining items are signed off.** No report changed since: the committed reports are the ones this run rewrote.
