# M8 closing checks (m8-plan section 3 Phase C, section 6)

The checks m8-plan asks for before M8 closes, on the committed world map (`assets/map`, all 3,255 provinces), and how to run them. The M9 checks' earlier M8 results (Phase A and B, on the synthetic and North American maps) stay in [m9-checks.md](m9-checks.md).

## Results

Logan's PC (Windows 11, 24 threads, RTX 5070 Ti), October 2026, branch `build/m8-c-closing-checks` from main 5074f00, the world map, seed 1, the window at its default 1280 x 720.

| Check (m8-plan) | How | Result |
|---|---|---|
| M8.8 click test: every province clickable | `cargo test -p game --test m8_map every_world_province` (in the gate) | 3,255 of 3,255 pick their own id at their label point (the 372 tiny ones at their click target): 2,964 from World zoom, 291 from Country, none needs Province; then all 3,255 clicked through the shell to their Province page. Debug 10.5 s |
| 60 fps with the panes open, in release | `target/release/game --bench-map 15 --map-mode MODE` | Every mode at every zoom level: p99 4.67 ms or less, max 6.39 ms, 321 to 349 fps (60 fps is 16.7 ms) |
| Leak test on the world map | `cargo test -p game --test m9_leak` | Pass, no leak: 94 modes, 552 banded HQ pins, 329 heat values, 145 province cards, 26 zone cards a state, and the Province pages; debug 25 s, release 8.6 s |
| Timing harness on the world map | `target/release/game --bench-pages` | `pages 59 opened, worst 20.64 ms: PASS` twice; the Province page 9.7 to 10.9 ms, every mode switch 5.6 ms or less |
| Startup render error | D741 | Cause found (a stale binary against a newer shader); the shader is now compiled in and its layout tested |
| P8 QA | the qa step (below) | Every region passes; the remaining items were signed off at the Phase B gate |
| Soak invariance | `headless soak --years 10 --seeds 1..4` | Byte-identical to main 5074f00 (below) |
| The full gate twice | `bash scripts/check.sh` | (below) |

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

Run at main 5074f00 (this slot checked out there) and on this branch: byte-identical `years.csv` (md5 121b5c7ba2ae4edcb9ed12d28764563e) and `quarters.csv` (md5 cf890b482bd1f4c420cb3c6dc7f73a35), 3 s for the four seeds. They are also the md5s lane MB recorded against main a31b1a9 (m9-checks.md): the map moves nothing in the economy. This branch changes no file under `crates/sim`, `crates/sim-data`, `crates/headless` or `docs/design`, so the two headless builds are the same code.

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
