# TechnoCapital20FF

A cyberpunk grand strategy game: CK3-style corporate feudalism on a Wall Street Raider economy. The MVP was built in Rust with Bevy, then ported to TypeScript in the browser (D950, [docs/build/ts-migration-plan.md](docs/build/ts-migration-plan.md)). The port passed its parity gate (D951) on main 22f77f3; Logan's later R&D rulings moved the 2020 world (D1018), so parity now compares with a TS baseline soak, `test/fixtures/ts-soak/` (D1019); the Rust code is deleted (D1017); `crates/...` paths in comments and docs name the last tree that had them (main 334ee6d). `test/fixtures/rust-reference/` keeps the Rust soak as the parity reference.

**The pivot (D1026, 2026-11-10).** The game is now a stock and prediction market sim on a deep US political sim: the player is a trader who advances time, reads published news on a fake desktop, bets on politics and trades stocks. [docs/design/pivot/spec.md](docs/design/pivot/spec.md) governs every new system; mvp-spec still governs the inherited economy, company and price formulas. Politics and the prediction market are built first. The app is moving to Electron with the sim in a Node process. Until a milestone lands, the code below is still the read-only MVP.

## Where things live

- `docs/design/pivot/spec.md`: the pivot spec. New code cites it as `pivot N.N`. Spec changes land in the contracts PR that opens a milestone.

- `docs/design/`: the design docs. Start with `docs/design/mvp/mvp-spec.md` (what the MVP does) and `docs/design/mvp/build-plan.md` (crates, milestones, tasks). Code PRs do not edit design prose (spec, README, design notes) unless the PR is about the docs; a prose error goes in `docs/build/design-fixes.md` instead. Code PRs may edit `docs/design/tools/*.py` and regenerate `docs/design/data/` when a task needs it (for example a golden fixture export). The build follows mvp-spec v1.4; spec changes land between milestones.
- `assets/worlds/1995/`: the default world's CSVs, generated and validated by `tools/world-1995/` (`python -B gen.py`, then `python -B validate.py`). `docs/build/1995-rework-spec.md` is its spec.
- `docs/design/data/`: the 2020 world's CSVs, played with `?world=2020` in the web app and `--world 2020` in headless until that world is retired. `docs/design/tools/mvp-data/` generates and validates them (`python3 gen.py && python3 validate.py`).
- `scripts/sync-design.sh [folder]`: refreshes `docs/design/` from a design folder (default `/mnt/project-files/design`, the cloud container's) and runs both data checkers. On Logan's PC, main's `docs/design` is the source.
- `docs/build/decisions.md`: choices made where the spec is silent or ambiguous (pick, log, keep going); each names its constant. `docs/build/design-fixes.md`: prose errors for Logan.
- Code: one pnpm workspace at the repo root: `packages/sim-data`, `packages/sim` (contracts in `packages/sim/src/types/`), `apps/web`, `apps/headless`, and `apps/mapgen` (the offline map rasterizer `tools/map-pipeline` runs; never shipped). Run pnpm through corepack (`corepack pnpm@10.20.0 ...`) if it is not on PATH. Build-plan section 2 still describes the Rust crates (design-fixes row 1017).

## Rules

- The player is a trader only (pivot 1.3): they never own, run or influence companies, campaigns or officials; companies are run by the lite AI (mvp-spec section 6). Player orders are `PlayerAction`s inside the state hash, not `Control`s (D1027).
- Politician stats are hidden in play (pivot 5.11): view builders strip them unless Omniscient is on. NPC bettor belief code reads only published information, never hidden state (pivot 11.5).
- `sim` has no DOM and reads no wall clock. It is deterministic on one machine: seeded RNG, fixed iteration order (tables are arrays in id order; a `BTreeMap` port iterates `sortedEntries`), plain f64. Sim code never calls `Math.round`, `Math.random`, `Date` or `localeCompare`; Rust rounding, casts and float sorts go through `packages/sim/src/types/num.ts` (D952). Nor `Math.exp`, `Math.log`, `Math.log10`, `Math.sin` or `Math.cos`, which differ between Node and the browser: use `expF`, `logF`, `log10F`, `sinF`, `cosF` from `packages/sim/src/types/libm.ts` (D1015).
- Data fields keep Rust's snake_case names; `Option` is `T | null`; enums are string or `kind` unions; ids are branded numbers (D952).
- The UI reads only the views (spec 9): `apps/web` never imports `@tc20ff/sim/internal`.
- Every formula cites its spec section in a comment (`pivot N.N` for new systems, the mvp-spec section for inherited ones). Tuning values come from the data tables or a named constant, not inline literals.
- Money is f64 USD (CSV $M, $bn and bps converted once at load); share counts are u64. Ties with no spec rule go to the lower id.
- There is no CI. The full local gate is `scripts/check-ts.sh` or `scripts/check-ts.ps1` (typecheck, Biome, sim boundary scan, Vitest, both worlds' data checks). Under the pivot it runs once per milestone, with the soaks, one heavy run at a time; a lane PR runs the fast per-change check (`scripts/check-fast`, added in M0) on what it touched.
- Pivot milestones open with one contracts PR (types, ids, scheduler slots, RNG streams, save version, view shapes, protocol); lanes then own disjoint folders and do not edit the contracts.

## Git

- PR #1 (design) is merged. Build branches are `build/<milestone>-<slug>` (the port uses `build/ts<step>-<slug>`), cut from `main` and targeting `main`; no stacked PRs.
- Commit messages: a short imperative summary line, then detail if needed.
