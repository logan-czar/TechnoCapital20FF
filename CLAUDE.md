# TechnoCapital20FF

A cyberpunk grand strategy game: CK3-style corporate feudalism on a Wall Street Raider economy. The MVP was built in Rust with Bevy; it is being ported to TypeScript in the browser (D950, [docs/build/ts-migration-plan.md](docs/build/ts-migration-plan.md)). New work goes into the TypeScript workspace; the Rust crates are a frozen reference until the parity gate (D951) passes, then they are deleted.

## Where things live

- `docs/design/`: the design docs. Start with `docs/design/mvp/mvp-spec.md` (what the MVP does) and `docs/design/mvp/build-plan.md` (crates, milestones, tasks). Code PRs do not edit design prose (spec, README, design notes) unless the PR is about the docs; a prose error goes in `docs/build/design-fixes.md` instead. Code PRs may edit `docs/design/tools/*.py` and regenerate `docs/design/data/` when a task needs it (for example a golden fixture export). The build follows mvp-spec v1.4; spec changes land between milestones.
- `docs/design/data/`: the starting world CSVs the game loads. `docs/design/tools/mvp-data/` generates and validates them (`python3 gen.py && python3 validate.py`).
- `scripts/sync-design.sh [folder]`: refreshes `docs/design/` from a design folder (default `/mnt/project-files/design`, the cloud container's) and runs both data checkers. On Logan's PC, main's `docs/design` is the source.
- `docs/build/decisions.md`: choices made where the spec is silent or ambiguous (pick, log, keep going); each names its constant. `docs/build/design-fixes.md`: prose errors for Logan.
- TypeScript code: one pnpm workspace at the repo root: `packages/sim-data`, `packages/sim` (contracts in `packages/sim/src/types/`), `apps/web`, `apps/headless`. Run pnpm through corepack (`corepack pnpm@10.20.0 ...`) if it is not on PATH.
- Rust code (frozen reference): one Cargo workspace with the crates `sim`, `sim-data`, `game`, `headless` and `mapgen` (build-plan section 2). Port from it; do not change it, except to export reference data.

## Rules

- The MVP is read-only: the player watches; companies are run by the lite AI (mvp-spec section 6).
- `sim` has no DOM and reads no wall clock. It is deterministic on one machine: seeded RNG, fixed iteration order (tables are arrays in id order; a `BTreeMap` port iterates `sortedEntries`), plain f64. Sim code never calls `Math.round`, `Math.random`, `Date` or `localeCompare`; Rust rounding, casts and float sorts go through `packages/sim/src/types/num.ts` (D952).
- Data fields keep Rust's snake_case names; `Option` is `T | null`; enums are string or `kind` unions; ids are branded numbers (D952).
- The UI reads only the views (spec 9): `apps/web` never imports `@tc20ff/sim/internal`.
- Every formula cites its mvp-spec section in a comment. Tuning values come from the data tables or a named constant, not inline literals.
- Money is f64 USD (CSV $M, $bn and bps converted once at load); share counts are u64. Ties with no spec rule go to the lower id.
- There is no CI. Before a TypeScript PR, run the local gate: `scripts/check-ts.sh` or `scripts/check-ts.ps1` (typecheck, Biome, Vitest, sim boundary scan, validate.py). The Rust gate (`scripts/check.ps1` / `check.sh`) is needed only for a PR that touches `crates/`.

## Git

- PR #1 (design) is merged. Build branches are `build/<milestone>-<slug>` (the port uses `build/ts<step>-<slug>`), cut from `main` and targeting `main`; no stacked PRs.
- Commit messages: a short imperative summary line, then detail if needed.
