# TS port: remaining work (as of 2026-10-25)

What is left of the Rust → TypeScript port ([ts-migration-plan.md](ts-migration-plan.md)) after
Steps 0–3 and the perf pass. Each item says what done looks like. Lane rules:
[ts-lane-rules.md](ts-lane-rules.md). On Logan's PC, run at most two agents at a time and one gate or
soak at a time.

## Where things stand

- **Done (on main, b00e4c0):**
  - The sim, sim-data, views, worker protocol, headless soak and parity tools are ported.
  - Parity passes. On the 50-seed × 30-year soak, all 19 Rust-MET targets are MET and all 1590 yearly
    bands are inside Rust's p10–p90 (D951). The soak takes 32 min with `--jobs 4`.
  - Speed is up: a 30-year seed takes about 102 s with every view built (#100, #101).
  - The leak test passes.
  - The deck.gl map works.
  - The web shell works: top bar, dockview workspace, command bar, alerts, and the Companies, lists,
    news and chart panes.
- **Open, not reviewed:** [#102](https://github.com/logan-czar/TechnoCapital20FF/pull/102)
  (`build/ts5-pages-framework`). It brings:
  - the page framework (port of `crates/game/src/pages/mod.rs`, `doc.rs`, `links/`,
    `command/index.rs`, `config/`);
  - the World, Country and Settings pages;
  - `docs/build/ts-pages-guide.md`, the brief for the page lanes;
  - `it.todo` lists for both lanes in `apps/web/test/pages/pending/`.

  Its builder's gate passed. The Opus review was stopped before it reported.

## 1. Review and merge #102

Run one Opus reviewer on the branch and check:
- **Spec 9 boundary and bands:** no `@tc20ff/sim/internal` import, nothing unbanded that Rust banded
  (D420–D440), and the hover cards and name index show only view data.
- **Parity with world.rs, country.rs and settings.rs:** link rules (D450), PageRef keys (D451, D828),
  sections (D460, D481), back and forward history.
- **Robustness:** a corrupt or old localStorage entry, timers and subscriptions cleaned up on unmount,
  keyboard handlers scoped to the focused pane.
- **The guide:** a clean two-lane split with no shared-file conflicts.

Fix the findings on the branch, then merge.

**Done when:** #102 is merged and the gate passes on main.

## 2. View gap: watchlist and Omniscient

The recap, the news and industry filters and Pdoomberg need the runner's watchlist and the Omniscient
flag. Neither is in any view or frame.

Proposal from #102: add `ClockView.watchlist: CompanyId[]` and `ClockView.omniscient: boolean`. v_clock
is already rebuilt after every control. Log a D-number for it and check that the leak test still
passes, since both are player controls, not private truth.

**Done when:** the fields are in `packages/sim/src/types/views/` and `views/clock.ts`, with tests, merged
before lane B needs them.

## 3. Page lanes A and B (two Sonnet builders, parallel)

Follow `docs/build/ts-pages-guide.md` from #102:
- one file per page in `apps/web/src/pages/kinds/`, picked up by the Vite glob, so there is no
  registry file to edit;
- the lane's own pending test file;
- `styles.css` is append-only.

| Lane | Pages (Rust source in `crates/game/src/pages/`) | Shared files only this lane touches |
|---|---|---|
| A | company (with placeholder_chart), character, zone and exchange (shared index chart), province, lists (the list kinds lane B does not register), recap | `pages/tables.ts`, `shell/Workspace.tsx`, `panes/AlertsPane.tsx` (recap opens from its alert, D513) |
| B | industries, news, events (these two call news.rs helpers), Pdoomberg (`crates/game/src/pdoomberg/`) | `shell/CommandBar.tsx` (`TICKER Fn`), `App.tsx` (Pdoomberg overlay), new `pdoomberg/` folder |

Each lane also:
- ports its share of the Rust tests: `crates/game/tests/b1_pages.rs`, `market_pages.rs`,
  `c1_news_feed.rs` and `m8_province.rs`, plus the `it.todo` items in its pending file (43 in all);
- raises any view gap as in section 2, never reaching raw tables;
- opens one PR, reviewed by one Opus reviewer, then merged.

**Done when:** every page kind opens a real page (no `PendingPage`), both pending files are empty, and
the gate passes.

## 4. Finish (plan Step 6)

1. **Retire the fixed panes** (Companies, Industries, Countries, Wire) in favour of the list pages, or
   keep them as default layout entries. Pick one and log it.
2. **Leak test for the UI:** port `crates/game/tests/m9_leak.rs` as a test over every page's rendered
   doc, so that a banded company never shows an exact private figure. The view-level leak test already
   exists.
3. **Speed:**
   - port `page_bench.rs` and `bench.rs` as a Vitest bench: every page opens in under 100 ms on a
     30-year world;
   - check that the map holds 60 fps while panning at max sim speed;
   - check that the window stays responsive at max speed (the `pace.rs` / `s5_pace.rs` behaviour).
4. **Browser walk-through** in the in-app browser:
   - every page and map mode;
   - province hover and click;
   - save and load;
   - new game;
   - the Omniscient toggle.
5. **Determinism:** the same seed gives the same state hash in Node and in the browser worker.
6. **Delete Rust:**
   - `crates/`, `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `assets/shaders/`;
   - `scripts/check.ps1` and `scripts/check.sh`;
   - the mapgen step in `tools/map-pipeline/`, replaced by the TopoJSON export.

   Keep `test/fixtures/rust-reference/`: it is the parity reference.
7. **Docs:**
   - update CLAUDE.md (no Rust; the gate is `check-ts`);
   - update build-plan section 2 through a docs PR or `scripts/sync-design.sh`, per design-fixes row 950;
   - update the memory notes, which still describe Rust lane slots, warm `target/` and `check.ps1`.
8. **Final Opus review** of the whole port against [mvp-signoff.md](mvp-signoff.md).

**Done when:** no Rust is left in the repo, the gate passes, the soak and parity still pass, and the
sign-off list is checked in TS.

## 5. Decisions for Logan (not blocking the port)

From [design-fixes.md](design-fixes.md), found by the TS leak test:
- **970:** a private company's statements show its unit productivity exactly, while v_units bands it
  (D420 vs D436).
- **971:** a private company's recap shows its loss-quarter streak exactly, which reveals the sign of
  its net income.
- **972:** the world recap's top-5 beats and misses are ranked by the true surprise, so the order
  leaks private results.

## 6. After the port

- **Spec v1.5 drift fixes** ([drift-plan.md](drift-plan.md)), built in TS only.
- **Optional:** the headless year-close state hash still costs about 2.2 s a year after year 10.
  Caching each closed month's canonical text would remove most of that, for about 300 MB more per
  world. It is worth doing only if the soak time matters.
