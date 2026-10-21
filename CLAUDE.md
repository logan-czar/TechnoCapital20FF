# TechnoCapital20FF

A cyberpunk grand strategy game: CK3-style corporate feudalism on a Wall Street Raider economy. Built entirely in Rust with Bevy.

## Where things live

- `docs/design/`: the design docs. Start with `docs/design/mvp/mvp-spec.md` (what the MVP does) and `docs/design/mvp/build-plan.md` (crates, milestones, tasks). The working copy is edited in the project's shared folder and copied here, so treat `docs/design/` as read-only from code PRs unless a PR is about the docs.
- `docs/design/data/`: the starting world CSVs the game loads. `docs/design/tools/mvp-data/` generates and validates them (`python3 gen.py && python3 validate.py`).
- `scripts/sync-design.sh`: refreshes `docs/design/` from the shared design folder (`/mnt/project-files/design`) and runs both data checkers (validate.py and `cargo run -p headless -- --check-data`).
- Rust code (from M0 on): one Cargo workspace at the repo root with the crates `sim`, `sim-data`, `game`, `headless` and `mapgen` (build-plan section 2).

## Rules

- The MVP is read-only: the player watches; companies are run by the lite AI (mvp-spec section 6).
- `sim` has no Bevy dependency. It is deterministic on one machine: seeded RNG, fixed iteration order (no HashMap iteration in sim logic), plain f64.
- Bevy is pinned exactly at `=0.20.0` and upgraded only between milestones. UI is `bevy_ui` only, no egui.
- Every formula cites its mvp-spec section in a comment. Tuning values come from the data tables or a named constant, not inline literals.
- Before a PR: `cargo fmt --all`, `cargo clippy --workspace -- -D warnings`, `cargo test --workspace`, and the data validator.

## Git

- `design/detailed-stages` holds the design (PR #1, kept open). Build PRs branch from it and target it until PR #1 is merged.
- Commit messages: a short imperative summary line, then detail if needed.
