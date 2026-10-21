# TechnoCapital20FF

A cyberpunk grand strategy game: CK3-style corporate feudalism on a Wall Street Raider economy. Built entirely in Rust with Bevy.

## Where things live

- `docs/design/`: the design docs. Start with `docs/design/mvp/mvp-spec.md` (what the MVP does) and `docs/design/mvp/build-plan.md` (crates, milestones, tasks). Code PRs do not edit design prose (spec, README, design notes) unless the PR is about the docs; a prose error goes in `docs/build/design-fixes.md` instead. Code PRs may edit `docs/design/tools/*.py` and regenerate `docs/design/data/` when a task needs it (for example a golden fixture export). The build follows mvp-spec v1.4; spec changes land between milestones.
- `docs/design/data/`: the starting world CSVs the game loads. `docs/design/tools/mvp-data/` generates and validates them (`python3 gen.py && python3 validate.py`).
- `scripts/sync-design.sh [folder]`: refreshes `docs/design/` from a design folder (default `/mnt/project-files/design`, the cloud container's) and runs both data checkers. On Logan's PC, main's `docs/design` is the source.
- `docs/build/decisions.md`: choices made where the spec is silent or ambiguous (pick, log, keep going); each names its constant. `docs/build/design-fixes.md`: prose errors for Logan.
- Rust code (from M0 on): one Cargo workspace at the repo root with the crates `sim`, `sim-data`, `game`, `headless` and `mapgen` (build-plan section 2).

## Rules

- The MVP is read-only: the player watches; companies are run by the lite AI (mvp-spec section 6).
- `sim` has no Bevy dependency. It is deterministic on one machine: seeded RNG, fixed iteration order (no HashMap iteration in sim logic), plain f64.
- Bevy is pinned exactly at `=0.20.0` and upgraded only between milestones. UI is `bevy_ui` only, no egui.
- Every formula cites its mvp-spec section in a comment. Tuning values come from the data tables or a named constant, not inline literals.
- Money is f64 USD (CSV $M, $bn and bps converted once at load); share counts are u64. Ties with no spec rule go to the lower id.
- There is no CI. Before a PR, run the local gate: `scripts/check.ps1` (Windows) or `scripts/check.sh` (fmt, clippy, tests, validate.py, `--check-data`). While iterating on sim code, `-SimOnly` / `--sim-only` skips the Bevy compile.

## Git

- PR #1 (design) is merged. Build branches are `build/<milestone>-<slug>`, cut from `main` and targeting `main`; no stacked PRs.
- Commit messages: a short imperative summary line, then detail if needed.
