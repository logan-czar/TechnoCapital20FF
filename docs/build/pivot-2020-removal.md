# Removing the playable 2020 world

What is left to do after lane S2 (`build/m1-test-mini`), which moved the tests off the playable 2020 world without deleting anything. This is one serial change, made after the M1 lanes have merged, because it edits contract files and folders other lanes own.

## Where things stand

- `packages/sim/test/fixtures/world-mini/` is a frozen copy of the 30 CSVs the 2020 world loads, with a `manifest.json` that holds `MANIFEST_2020`'s values. Each CSV is the same git blob as its source in `docs/design/data/`.
- `worldMini()` (`packages/sim/test/common/world_mini.ts`; `apps/web/test/world-mini.ts` re-exports it) returns the fixture's folder and manifest. Every test in `packages/sim` and `apps/web` that loaded the 2020 world now loads the fixture.
- `--world 2020`, `?world=2020`, `MANIFEST_2020`, `docs/design/data/` and the gate's 2020 steps are untouched and still work.

## Decisions needed first

1. **Where the 1995 generator reads its source rows.** `tools/world-1995/gen.py` and `validate.py` read `docs/design/data/` (`SRC`): countries, country-economy, the eight province files, industries, companies, characters, key-cities, financial-zones, the names files, politics-usa, politics-usa-offices and startup-events. `gen.py` also imports `docs/design/tools/mvp-data/gen.py` (`MVP_GEN`) for the valuation groups and `build_company_start`. Deleting either folder as it stands breaks `python -B gen.py`. Choose one:
   - (a) Move the CSVs the generator reads to `tools/world-1995/source/` and the parts of `mvp-data/gen.py` it calls to `tools/world-1995/`, then delete `docs/design/data` and `docs/design/tools/mvp-data`. The 2020 rows live on as generator input, not as a world.
   - (b) Point `SRC` at `packages/sim/test/fixtures/world-mini/`. Less to move, but the frozen test world becomes generator input, and a wish to change the 1995 world's source rows would move every pinned value.
   - (c) Keep `docs/design/data` and `mvp-data` as generator input and delete only the ways to play them. Least work; the folder that says "the 2020 world" stays.
2. **Where the map pipeline reads province rows.** `tools/map-pipeline/pipeline/config.py` has `DATA_DIR = docs/design/data` (the eight `provinces-*.csv`). `assets/worlds/1995/` has its own eight province files: the same 3,963 province ids (`tools/world-1995/validate.py` checks that) but different contents, and the pipeline reads each row's `country`. The map in `assets/map/` was built from the 2020 rows. Point `DATA_DIR` at the 1995 files, at wherever decision 1 puts the source rows, or leave the pipeline as a finished tool that is not rerun.
3. **What the mock sim loads.** `apps/web/src/sim/mock/worker.ts` fetches the 2020 CSVs from `/data/design/` and calls `parseWorld` with the default manifest, and `selectedWorld()` returns null (the 2020 world) for `?mock=1`. The mock needs some world's names and ids: load the 1995 world (`/data/worlds/1995/`, with its manifest), or stop reading CSVs. This is lane U3's folder.
4. **What a save with no era says about its world.** A world with no era writes no `world_id` in its save; `simLoadBytes` (`packages/sim/src/lib.ts`, `loadBytesInner`) reads such a save as world `MANIFEST_2020.id` and refuses it elsewhere. The fixture's manifest keeps the id `"2020"` for this reason. When `MANIFEST_2020` goes, `lib.ts` needs that id from somewhere: a named constant in `packages/sim` (for example `NO_ERA_WORLD_ID = "2020"`), or drop the fallback and refuse a save with no era outright once every playable world has one. The second choice breaks the fixture's save tests unless the fixture's saves carry an id.
5. **What replaces the soak baseline `test/fixtures/ts-soak/`.** It is 50 seeds for 30 years of the 2020 world (`headless soak --world 2020 --years 30 --seeds 1..50 --jobs 4 --check`, sim of main 334ee6d), and `headless parity DIR` compares with it by default (`TS_REFERENCE_DIR`, D1019). Choose one:
   - (a) Keep it as the frozen world's baseline. The soak that reproduces it becomes `headless soak --data-dir packages/sim/test/fixtures/world-mini --years 30 --seeds 1..50 --jobs 4 --out DIR --check` (`--data-dir` reads the fixture's `manifest.json`, so the run is the same world). Only its README and the `source` line of `bands.json` change. Parity then guards the inherited economy on a world nobody plays.
   - (b) Record a new baseline on the 1995 world (25 years to the reveal, one scenario or all four) and make it the default reference; keep `ts-soak` beside `rust-reference` as history or delete it. The 1995 world already has its own targets (`targets-1995.ts`, `headless calibrate`), so this is a new yearly-bands file from one 50-seed soak.
   - (c) Both: (a) now, (b) when the pivot's M1 has moved the 1995 economy and it has settled.
   Whichever is chosen, `test/fixtures/rust-reference/` is the 2020 world too; it is already frozen history (D1017, D1019) and tests read it (`apps/headless/test/metrics.test.ts`, `parity.test.ts`, `soak.test.ts`, `targets.test.ts`).
6. **Whether the 2020 targets stay.** `apps/headless/src/targets.ts` holds the spec 10 targets of a world with no era, and `soak --check` uses them on any folder that is not an era world. With 5(a) they stay; with 5(b) they and `apps/headless/test/targets.test.ts` can go.
7. **Whether the research tools move.** `apps/headless/src/econ-report.ts`, `debt-tournament.ts` and `strategy-tournament.ts` load `defaultDataDir()` directly, and `scripts/drift-matrix.sh` runs `econ-report`. D1025's scenario report was made on the 2020 world. Point them at the fixture (the reports stay comparable), at 1995, or delete the ones that are done.
8. **Whether the scripted parts of the 2020 world stay in the sim.** `features.ai_boom`, `fixed_events` and `arrowhead` are true only in the 2020 world and the fixture (`packages/sim/src/lib.ts`, `packages/sim/src/world/load.ts` read them). They must stay while the fixture pins the inherited economy. Removing them is a separate change that re-records every pinned value.

## Steps, in order

Each step names the files. Run the named tests after each; run the gate once at the end.

### 1. The generator and map pipeline (decisions 1 and 2)

- `tools/world-1995/gen.py` (`SRC`, `MVP_GEN`, `load_mvp`), `tools/world-1995/validate.py` (`SRC`).
- `tools/map-pipeline/pipeline/config.py` (`DATA_DIR`), `tools/map-pipeline/README.md`.
- Check: `python -B tools/world-1995/gen.py` leaves `assets/worlds/1995/` unchanged (`git status` clean), then `python -B tools/world-1995/validate.py`.

### 2. The sim-data tests (lane S1's folder, so not moved in S2)

These still load the 2020 world or name its manifest:

- `packages/sim-data/test/helpers.ts`: `worldData()` loads `defaultDataDir()`; `checks.test.ts`, `map.test.ts` and `real_data.test.ts` use it.
- `packages/sim-data/test/real_data.test.ts`: imports `EXPECTED_COUNTS`.
- `packages/sim-data/test/geo.test.ts`: reads `WORLD_FILES` from `defaultDataDir()` and spreads `MANIFEST_2020`.
- `packages/sim-data/test/load_errors.test.ts`: copies files from `defaultDataDir()`.

Point them at the fixture. `packages/sim-data` cannot import from `packages/sim` (the dependency runs the other way), so either move the fixture folder and `world_mini.ts` to `packages/sim-data/test/` and re-export from `packages/sim/test/common/world_mini.ts`, or give `packages/sim-data/test/helpers.ts` its own three-line path to the fixture. `real_data.test.ts` then reads the counts from the fixture's manifest.

### 3. sim-data source (contract files: `manifest.ts`, `world.ts`)

- `packages/sim-data/src/manifest.ts`: delete `WORLD_2020_ID`, `EXPECTED_COUNTS`, `MANIFEST_2020`; fix the header comment and the `WORLD_IDS` and `WorldFeatures` comments.
- `packages/sim-data/src/world.ts`: `parseWorld(files, manifest = MANIFEST_2020)` loses its default; every caller passes a manifest.
- `packages/sim-data/src/node.ts`: delete `defaultDataDir`; `worldDataDir(id)` is `assets/worlds/<id>` only; `loadWorld` returns an error when the folder has no `manifest.json` instead of falling back to the 2020 manifest.
- `packages/sim-data/src/index.ts`, `rows.ts`, `checks.ts`: comments that name `defaultDataDir`, `docs/design/data` or `tools/mvp-data/validate.py`.
- `packages/sim/src/lib.ts`: the `MANIFEST_2020` import and the fallback in `loadBytesInner` (decision 4).
- `packages/sim/src/market/engine_value.ts`: a comment cites `mvp-data/gen.py`.

### 4. Headless

- `apps/headless/src/args.ts`: the `USAGE` line about `--world 2020`. `--world ID` goes through `worldDataDir`, so `--world 2020` fails by itself after step 3 with "assets/worlds/2020 not found"; decide whether to refuse an unknown id with a clearer message.
- `apps/headless/test/args.test.ts` lines 35 and 39: the two `--world 2020` cases. S2 left them because they test the production selection. Replace with `--data-dir` cases (the 30-year default on data other than 1995's still needs a test).
- `apps/headless/src/econ-report.ts`, `debt-tournament.ts`, `strategy-tournament.ts`: `defaultDataDir()` (decision 7). `scripts/drift-matrix.sh` follows.
- `apps/headless/src/parity.ts` (`TS_REFERENCE_DIR`, the header comment), `apps/headless/src/cli.ts` (header comment), `apps/headless/test/parity.test.ts` (reads `test/fixtures/ts-soak`): decision 5.
- `apps/headless/src/soak.ts`, `targets.ts`, `apps/headless/test/targets.test.ts`: decision 6.

### 5. Web

- `apps/web/src/sim/world.ts`: `selectedWorld()` no longer returns null for `?world=2020`; `worldDataBase(null)` and the `/data/design/` base go; the null case remains only if the mock still needs it (decision 3).
- `apps/web/src/sim/real/worker.ts`: `loadManifest` loses the `MANIFEST_2020` branch; `loadData` always reads `ERA_FILES`.
- `apps/web/src/sim/mock/worker.ts`: the `/data/design/` fetch and the default-manifest `parseWorld` (decision 3).
- `apps/web/src/sim/spawn.ts`, `apps/web/src/map/data.ts`: comments.
- `apps/web/vite.config.ts`: the `data/design/*` entries of `servedFiles()` and the header comment.
- `apps/web/src/shell/NewGamePicker.tsx`: check its handling of a world with no choices (`Ready` without `choices`), which only the 2020 world produced in the app. `apps/web/test/new-game.test.ts` still covers a no-era `Ready` through the fixture.
- `apps/web/test/world-select.test.ts`: the `?world=2020` and `worldDataBase(null)` expectations. S2 left them because they test the production selection.
- `apps/web/src/map/data.ts` fetches the province CSVs and `countries.csv` from `worldDataBase(selectedWorld())`, so under `?mock=1` it reads `/data/design/` today (decision 3). Check in the running app that the map loads in the real and the mock sim.

### 6. The gate and the fast check

- `scripts/check-ts.ps1`, `scripts/check-ts.sh`: delete the `validate` step (`docs/design/tools/mvp-data/validate.py` on `docs/design/data`) and the `check-data` step (`--check-data --world 2020`). Consider `--check-data --data-dir packages/sim/test/fixtures/world-mini` in their place, so the gate still proves the fixture loads and passes the checks.
- `scripts/check-fast.ps1`, `scripts/check-fast.sh`: the `docs/design/data/` part of the "every project" pattern and the whole `validate` / `check-data` block for `docs/design/(data|tools/mvp-data)/`.
- `scripts/sync-design.sh`: it runs `mvp-data/validate.py` and a `cargo run` that no longer exists; fix or delete.

### 7. Delete the data and its tools (decision 1)

- `docs/design/data/*.csv`, `docs/design/data/names/*.csv`, `docs/design/data/README.md`, `docs/design/data/provinces-*-summary.md`.
- `docs/design/tools/mvp-data/`: `gen.py`, `validate.py`, `export_fixtures.py`, `export_finance_fixtures.py`, `equality_index.py`. The two export scripts wrote the golden CSVs in `packages/sim/test/fixtures/` (`finance-start.csv`, `validate-boom-calm.csv`, `validate-growth-seed150.csv`); those become frozen like the fixture, and the comments that name the scripts (`packages/sim/test/finance_common/index.ts`, `m2_growth_check.test.ts`, `m4_ratings.slow.test.ts`, `spec_3_9.test.ts`, `spec_5_12_rating.test.ts`, `packages/sim/test/common/fixtures.ts`, `.gitattributes`) should say so.
- `docs/design/tools/world-gen/` generated the 2020 names and named companies: check whether anything else reads it before deleting.
- These are under `docs/design`, which code PRs do not edit unless the PR is about the docs; this step is that PR.

### 8. The soak baseline (decision 5)

- `test/fixtures/ts-soak/README.md` and `bands.json`'s `source` line, or the new baseline folder.
- `scripts/ts/rust-reference-bands.ts`: comments.
- `docs/build/pivot-lanes.md`, "Pinned values": the last row.

### 9. Prose

- `CLAUDE.md`: the `docs/design/data` bullet, the parity sentence in the first paragraph, "both worlds' data checks" in the last rule.
- `README.md` and `docs/build/*` that tell the reader to run `--world 2020` or `?world=2020` (`git grep -n "world 2020\|world=2020"`).
- `docs/build/pivot-lanes.md`: lane S2's row says it owns `MANIFEST_2020`, `docs/design/data` and `scripts/check-ts.*`; S2 changed none of them.
- `packages/sim/test/fixtures/world-mini/README.md`: the source folder no longer exists; keep the commit hash.
- One row in `docs/build/decisions.md` for the choices above.

## What stays named "2020" on purpose

- The fixture's manifest id (decision 4) and its start date, 2020-01-01.
- `packages/sim/test/golden/job-order-2020.txt` and the `GOLDEN_*` values of `results_pinned.slow.test.ts`: recorded on the fixture's bytes.
- `packages/sim/test/era_reveal.test.ts`: expects `WrongWorld` with `world: "2020"` when a 1995 save is loaded in the fixture world.
- `apps/web/test/pages/ui-leak.slow.test.ts`: the label "2020" on the fixture's scan.

## Check after the removal

`git grep -nE "defaultDataDir|MANIFEST_2020|WORLD_2020_ID|EXPECTED_COUNTS|docs/design/data|data/design|mvp-data"` should return only history (decisions, old plans) and the fixture's README. Then `scripts/check-ts.ps1`.
