# Pivot M1: the lanes

The eight lanes of milestone M1 (plan: milestones and lanes; D1026). Each lane works in its own worktree on `build/m1-<slug>`, cut from `main` after the contracts change (`build/m1-contracts`, D1029) has merged. A lane edits only the folders it owns and never the contract files. The spec is [docs/design/pivot/spec.md](../design/pivot/spec.md), cited as `pivot N.N`.

## Rules for every lane

- Run `scripts/check-fast.ps1` (or `.sh`) after each change. It is not the gate: `scripts/check-ts.ps1` runs once, at the end of the milestone.
- One test process at a time on the machine. Keep scratch and logs on D:, inside the worktree, git-ignored.
- A lane that needs a contract changed does not change it. It writes what it needs in its PR description, and the change lands in the next contracts change (or a small serial fix to this one).
- The same seed must give the same economy until a lane's task says otherwise. A lane that moves the state hash says why and re-records the pinned values in the same commit (the list is under "Pinned values").
- Code PRs do not edit `docs/design` prose. A choice the spec leaves open goes in `docs/build/decisions.md`.

## Contract files (no lane edits these)

| File | What it fixes |
|---|---|
| `packages/sim/src/types/ids.ts` | Branded ids, the pivot's included (`CountyId`, `PersonId`, `RaceId`, `BillId`, `OutletId`, `PollsterId`, `HandleId`, `ContractId`, `InstrumentId`, `OrderId`, `AccountId`) |
| `packages/sim/src/types/draws.ts` | The 13 RNG streams and their numbers |
| `packages/sim/src/types/world.ts` | `World` (with `fidelity`, `levers`, `geo`), `Industry.row_assets`, `Fidelity` |
| `packages/sim/src/types/state/geo.ts` | `County`, `CountyShare`, `District`, `DistrictPlan`, `GeoState` |
| `packages/sim/src/types/state/governing.ts` | `Levers` |
| `packages/sim/src/types/action.ts` | `PlayerAction`, `ActError`, `Venue`, `AlertRule` |
| `packages/sim/src/types/control.ts`, `notice.ts`, `sim-api.ts` | `Control` (with `Step`), `PauseReason` (with `StepDone`), `SimApi` (with `act`), `SimError` |
| `packages/sim/src/types/protocol.ts` | `ToSim`, `FromSim`, `Reply`, `GameStart`, `BakedStart`, `SaveInfo`, `Progress` |
| `packages/sim/src/types/views/*.ts` | Every view's type, `SimViews`, `VIEW_NAMES`, `VIEW_SPECS`, `EntityRef` |
| `packages/sim/src/views/index.ts`, `views/pivot.ts` | The builder table and the pivot views' empty values |
| `packages/sim/src/save.ts` (`SAVE_VERSION`), `packages/sim/src/index.ts` | The save version; the public face |
| `packages/sim-data/src/rows.ts` (`CountyRow`, `CountyAdjacencyRow`), `manifest.ts` (`features.counties`), `world.ts` (`GEO_FILES`) | The county files' columns and how a world says it has them. S1 owns the rest of `packages/sim-data` and may add checks, but not change these |
| `apps/web/src/os/apps.ts`, `apps/web/src/links/nav.ts` (`openApp`, `setAppOpener`) | `AppSpec`, `AppProps`, the app registry, the app-opening hook |

Functions the contracts change wrote that a lane now owns are listed under that lane.

## The lanes

| Lane | Branch | Owns | Starts from | check-fast |
|---|---|---|---|---|
| S1 Data | `build/m1-data` | `tools/world-1995/**` (with `counties/`), `assets/worlds/1995/**`, `packages/sim-data/**` except the contract parts above | `CountyRow`, `CountyAdjacencyRow`, `GEO_FILES`; `packages/sim/src/geo/load.ts` reads the rows | `scripts/check-fast.ps1` (auto: it runs the 1995 data checks when the data or generator changed) |
| S2 Test migration | `build/m1-test-mini` | `packages/sim/test/fixtures/world-mini/`, the test files it re-points, `MANIFEST_2020` and `docs/design/data` (to delete), `scripts/check-ts.*` | `packages/sim/test/common/index.ts`, `test_sim.ts` | `scripts/check-fast.ps1 sim headless web` |
| S3 Economy | `build/m1-economy` | `packages/sim/src/economy/supply.ts`, `packages/sim/src/world/load.ts`, `packages/sim/src/governing/levers.ts`, and the economy files that read the era-only levers today | `World.levers` (neutral), `Industry.row_assets` (0), `leversNeutral` | `scripts/check-fast.ps1 sim` |
| S4 Fidelity | `build/m1-fidelity` | `packages/sim/src/time/scheduler.ts`, `packages/sim/src/lib.ts`, new `packages/sim/src/fidelity/`, `apps/headless` (`--bake`) | `schedulerRegister(..., { fidelity })`, the `WeeklyJobs` slot, `simRunUntil`, `World.fidelity` | `scripts/check-fast.ps1 sim headless` |
| U1 Electron | `build/m1-electron` | new `apps/desktop/**`, new `packages/sim-host/**` (moving `apps/web/src/sim/real/host.ts` and `loop.ts`), `apps/web/src/sim/client.ts`, `spawn.ts`, `apps/web/src/sim/real/**` | `protocol.ts`'s new messages, which both hosts answer as unsupported | `scripts/check-fast.ps1 web` |
| U2 OS shell | `build/m1-os-shell` | `apps/web/src/os/**` except `apps.ts`, `apps/web/src/App.tsx` | `AppSpec`, `registeredApps`, `openApp` and `setAppOpener`, `Control` `Step` | `scripts/check-fast.ps1 web` |
| U3 Mock data | `build/m1-mock` | `apps/web/src/sim/mock/**` | The pivot views' types and empty values; the mock posts them empty | `scripts/check-fast.ps1 web` |
| U4 Tooling | `build/m1-tooling` | `apps/desktop/e2e/**`, `apps/desktop/scripts/drive.ts`, `scripts/heavy.*` (after U1 boots) | U1's app | `scripts/check-fast.ps1 none` and its own e2e run |

## What each lane finds waiting

**S1 Data.** `counties.csv` has the columns `fips,state,name,pop_1990,lean_pts,spread,elasticity,turnout,centroid_x,centroid_y` and `county-adjacency.csv` has `fips,neighbour_fips`, one row per ordered pair. `state` is the state's name as politics-usa.csv writes it. Set `"counties": true` under `features` in `manifest.json` when the files exist; add `counties` and `county-adjacency` to `expected_counts`. The loader then fills `World.geo.counties` in FIPS order and fails with the row's code on an unknown state or county. The web app serves the two files once they are on disk.

**S2 Test migration.** Tests that build a `World` by hand cast it (`as unknown as World`), so the new fields did not break them. The pinned values are listed below.

**S3 Economy.** `row_assets` is 0 and `fringe_assets` still holds all non-named supply. The levers are neutral, with `corp_tax` equal to the USA's `corp_tax_rate`, so reading them instead of the era-only fields changes nothing until something moves them. The quarterly party drift (`era/policy.ts` `eraPolicyJob`) still writes the era-only fields; pivot 4.3 removes it.

**S4 Fidelity.** A job registered with `{ fidelity: "Coarse" }` or `{ fidelity: "Full" }` is skipped on ticks of the other fidelity; no job is tagged yet. `WeeklyJobs` runs at 00:00 on Mondays and is empty. `simRunUntil` is the spike's loop made safe; `simSpikeStepNoViews` and `simSpikeRebuildViews` are still in `lib.ts` for `tools/spikes/coarse` and can go with it. A historical world loads Coarse; nothing sets Full yet (hydration, pivot 3.4, is M3's).

**U1 Electron.** Both hosts answer `SaveSlot`, `LoadSlot`, `ListSaves`, `DeleteSave` and a `NewGame` with a `start` as `Refused` with `unsupportedMessage(kind)`. `Cancel` is accepted and does nothing. `Act` reaches `sim.act`, which refuses. `Ready.starts` and `Progress` are typed and never sent. The client ignores `Progress`.

**U2 OS shell.** `apps/web/src/apps/` does not exist yet: the registry is empty. An app is a folder `apps/web/src/apps/<id>/` whose `app.tsx` exports `app: AppSpec` with lazy components. `openApp(id, route)` returns false until the window manager calls `setAppOpener`.

**U3 Mock data.** `initialViews` holds each pivot view's empty value and `MOCK_VIEWS` posts them. The mock answers `Act` with `NotAvailable` and the `Step` control works.

## Pinned values

A change that moves the state hash or a view must re-record these in the same commit and say why:

| Where | What it pins |
|---|---|
| `packages/sim/test/results_pinned.slow.test.ts` | `GOLDEN_STATE`, `GOLDEN_VIEWS`, `GOLDEN_MONTHLY`, `GOLDEN_PATCHES`: a year of seed 1 in the 2020 world |
| `packages/sim/test/golden/job-order-2020.txt` | The slots each tick of 2020 visits (`UPDATE_GOLDEN=1` rewrites it) |
| `packages/sim/test/long_run.slow.test.ts` (`specOrder`) | The same order for ten years, written out by hand: a new slot is added there too |
| `packages/sim/test/m1_contracts.test.ts` | The first draws of the eight pre-pivot RNG streams |
| `test/fixtures/ts-soak/` | The 50-seed soak baseline; its `state_hash` column is from before M1 and is not compared by `headless parity` |

Run a slow file by naming it: `scripts/check-fast.ps1 packages/sim/test/results_pinned.slow.test.ts`.
