# Resume plan

Where to pick the work up, as of 2026-11-03 (main 5b03196, after PR #119). Read this first, then
[ts-remaining-work.md](ts-remaining-work.md) for the history behind each item.

## Where things stand

- **The port is done.** The game is TypeScript: one pnpm workspace with `packages/sim-data`,
  `packages/sim`, `apps/web`, `apps/headless` and `apps/mapgen`. The Rust code is deleted (D1017);
  its last tree is main 334ee6d. TS Step 6 merged as #116 to #119.
- **The default world is 1995** (`assets/worlds/1995/`): 25 years to a reveal on 1 January 2020,
  under a picked or random scenario. The 2020 world is `?world=2020` in the web app and
  `--world 2020` in headless.
- **The gate** is `scripts/check-ts.ps1` (or `.sh`): typecheck, Biome, the sim boundary scan,
  Vitest and both worlds' data checks. On #119 it ran 186 test files and 1,057 tests in about
  6 minutes. There is no CI.
- **Parity** compares a 2020 soak with the TS baseline in `test/fixtures/ts-soak/` (D1019): your
  R&D rulings moved the 2020 world away from the Rust soak (D1018, mostly D974), and you accepted
  it. `--reference test/fixtures/rust-reference` still compares with Rust. A soak is
  `corepack pnpm@10.20.0 headless soak --world 2020 --years 30 --seeds 1..50 --jobs 4 --out DIR --check`
  (about 50 minutes, 4 workers at about 1.2 GB each), then `headless parity DIR`.
- **The final review** of the port against the MVP sign-off list is
  [ts-port-review.md](ts-port-review.md); its section 7 is the TS checklist.

## Next, in order

### 1. Map layers (build; the largest gap from the port) — done (D1020)

The map draws only the Political mode. The Rust map also had:
- the other map modes and their legends (D700, D702);
- HQ and exchange pins (D703);
- labels by zoom (D706);
- the province hover card (D704);
- click targets for tiny provinces (D640);
- W A S D pan and Q / E zoom (D636).

The sim side is ported and tested (`packages/sim/src/views/map_layers.ts`). The work is deck.gl
layers in `apps/web/src/map/` on `v_map_layers`, which the map pane then asks for in its `Want`
(D1016). Port from the Rust at 334ee6d: `git show 334ee6d:crates/game/src/map/modes.rs`, and
`pins.rs`, `labels.rs`, `card.rs`, `picking.rs`. Then run the UI leak test on the modes (it skips the
map today, D1013) and bring back a click test of every province (D740).

### 2. Measure the map at max speed (a check) — map alone done (D1021); the five-heavy-pages run is left

The map's frame rate while panning at max speed has never been measured, because the browser
pane was hidden. With the pane showing (Ctrl+Shift+B), measure on a production build
(`corepack pnpm@10.20.0 --filter @tc20ff/web build`, then the `web-prod` preview), once with the map
alone and once with five heavy pages, and set a pass bar as D805 did. It is best done after item 1,
since the layers add cost.

### 3. Your decisions

- **D635:** page windows were to float over the map; the TS has a tiling workspace with the map as
  one pane. Keep the tiling, or ask for floating windows (dockview's floating groups).
- **Sign-off:** [ts-port-review.md](ts-port-review.md) section 7. It covers:
  - rows D266, D271, D693, D823, D825 and D850;
  - ticking D989 in place of D270, D274, D326, D462 and D486;
  - the 96% yearly tracking floor (D974; Rust had 97%);
  - the default economy profile, still `legacy` (D970, D977);
  - browsers other than Chrome.
- **Design fixes** ([design-fixes.md](design-fixes.md)):
  - decide 970 to 974 and 979, and the older Decide rows 208, 226, 232, 235, 240, 367, 368, 441,
    601 and 670;
  - a spec pass for the prose rows 950, 980 to 983 and 1017 (build-plan section 2 still describes the
    Rust crates).

### 4. Later, already planned

- **Spec v1.5 drift fixes** ([drift-plan.md](drift-plan.md)), built in TS.
- **Optional:** the headless year-close state hash costs about 2.2 s a year after year 10.

## Housekeeping left on Logan's PC

These deletions were not made from the session (the tool blocked them as irreversible); they are
safe to do by hand:
- `.claude/worktrees/1995-world-snapshot-705f9c/target/` (218 MB): the old Rust build, now dead
  weight.
- `.claude/worktrees/1995-world-snapshot-705f9c/AGENTS.md`: an untracked copy of `CLAUDE.md` that
  something outside the session wrote; it goes stale as `CLAUDE.md` changes.
- Two other worktrees, `kind-jennings-190450` and `ts6-w-baseline`, belong to other sessions:
  remove them once nothing in them is needed.
- `.claude/scratch/session-27be0653-archive/` (475 MB) holds that session's soak and calibration
  outputs, moved off the C: drive; `.claude/scratch/ts6-delete-rust/` holds the soak behind D1019.
  Delete either when no longer wanted.
