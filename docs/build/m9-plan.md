# M9 plan: screens as a dense, wiki-like workspace

_Draft for Logan, 2026-10-21. Built from build-plan M9.1–M9.9, mvp-spec 8, 9.2 and 9.4, the 20-ui design doc, a survey of the current views and UI, and Logan's answers. Nothing here is built yet._

## 1. What Logan decided

| Topic | Decision |
|---|---|
| Private figures | **Estimate bands** instead of "?": a range of about ±25% around a noisy estimate, deterministic from the seed and re-drawn at each release, so it is never the exact true value. Omniscient (debug builds only) shows the truth. This departs from spec 1, so it is logged as a decision and a design fix. |
| EFV band on F3 | Store each day's EFV with its daily bar. A sim change, with a save version bump. |
| Navigation | **Wiki-like.** Anything with a name links to its page. Dense, readable, configurable; elements auto-size to fill their pane. Built for several dense screens open at once. |
| Layout | **Tiling panes.** The main area splits into resizable panes, each holding any page with its own back and forward history. Layouts can be saved and restored. |
| Linked pages | Company, Industry, Character, Country, Zone, Exchange, startup events, headlines (linking to their subjects), and the quarterly recap for each quarter. Province pages wait for M8. |
| Configurable | Table columns (pick, reorder, resize, sort; saved per table); density and font size; saved layouts; page sections (collapse, reorder, hide). Persisted between runs. |
| Pdoomberg | **Full-screen mode**, separate from the workspace. The amber terminal with F2–F10. |
| Command bar | Fuzzy search over every named thing by name or ticker, plus Pdoomberg commands such as `ARDR F3`. It opens results in the focused pane, or in a new pane with Shift. |
| Hover | **Name cards**: hovering any link shows a compact card. Number-breakdown tooltips wait for later. |
| 100 ms rule | Measured in a **release** build on a **fresh 2020 world**: from the navigate message to the first frame with the page laid out. Applies to every page, tab and F-key page. |

### Decided by the coordinator (logged as decisions, flagged for sign-off)

- **F4 Order** opens a page holding only the "Read-only MVP" lock.
- **Disclosure radar** is left out of F2 (spec 8: "hidden").
- **IPO ballots** show each member's vote, never the odds (20-ui 20.1). The odds stay in the sim view and the UI never reads them.
- **Function keys** act only inside full-screen Pdoomberg, so they can't clash with M8's map modes.
- **The recap** opens in a pane from its pause alert or notice in the pre-quarter-end week. Past recaps are reachable by quarter.
- **Cap table**: starting companies show the controller's stake from companies.csv plus an "other holders" line, served by a sim view, so the UI never reads CSVs. Startups show their real blocks (D153).
- **A new listing's figures** stay as bands until its first release after listing (spec 5.20.1).
- **Formats**: add per-share price, date, rating, ratio and band cells; gains in cyan and losses in magenta (11-ui 11.4).
- **Config file**: one human-readable file in the user's config directory, owned by the game crate. The sim never sees it.

## 2. Gaps to fill in the sim views (from the survey)

The UI may only read SimViews (spec 9), so these come first:

1. **Cap table view**: holders and blocks; the controller stake for starting companies.
2. **Characters view**: list and get. Fields: name, age, skills, traits, home province and country, roles (seats, controller, founder, director), holdings, full or partial.
3. **Countries view**: iso3, name, superregion, sovereign rating and spread, tax rate, HQ'd companies. Also province and country names for every place a page shows one.
4. **Zones view**: spread, confidence, index, member countries. Today this data is spread across cycle and exchanges.
5. **Rates view for F7**: base rate, zone spreads, sovereign spreads, the rating-spread table.
6. **Next release date** on the clock view.
7. **company_rows extensions** for F10 and lists: archetype, origin, listing date and exchange, owner of record, controller name. Starting listed companies need a listing line: "listed before 2020".
8. **Births view extensions**: births by industry over the last 4 quarters, and event names for "Founded [date] ([event])".
9. **The statements view** refreshes on the Omniscient toggle (today it waits a quarter).
10. **Estimate bands** for private companies' financial figures, computed in the views:
    - revenue, net income, cash, line, value
    - statements and filings
    - recap ranges

    The noise must be deterministic and **must not draw from any sim RNG stream**, for example a hash of (seed, company, quarter, field). That keeps every soak CSV and monthly hash identical.
11. **EFV history**: each day's EFV stored with the daily bar. This changes the save format and the state hash, but not the soak metrics, which must stay byte-identical.

## 3. Build order and lanes

At most two Bevy builders at a time: each Bevy build folder is about 20 GB and C: has about 82 GB free. Each lane owns separate folders.

### Phase A: foundations (two lanes in parallel)

| Lane | Owns | Work |
|---|---|---|
| **A1: sim views** (sim only, light build) | `crates/sim/src/views/`, the bar storage in `crates/sim/src/market/` for EFV history | All of section 2, each view in its own file with tests (expected values from data or spec), soak CSVs byte-identical, SAVE_VERSION bump for EFV history |
| **A2: UI foundation** (Bevy) | `crates/game/src/{workspace,pages/mod.rs,links,command,config,chart}/`, `crates/game/src/table/` | Tiling pane workspace: split, resize, close, focus, per-pane back and forward with a breadcrumb. A typed page reference (Company(id), Industry(id), Character(id), Country, Zone, Exchange, Event, Recap(quarter), list pages) and a router. Link text plus hover name cards. Theme density and font scale. Config persistence (layouts, columns, sections, density). Command bar with fuzzy search over a name index built from the views. Table upgrades: column chooser, reorder and resize; new cell kinds (per-share price, date, rating, ratio, gain/loss colour, link, band). **M9.1 chart widget**: line, bars, daily candles with an EFV band, weekly aggregation for the 10-year view, hover readout. Pages stay placeholders that list their views |

A2 starts on the views that exist today and switches to A1's new views once A1 merges, so A1 merges first.

### Phase B: pages (two Bevy lanes in parallel, after Phase A merges)

| Lane | Pages |
|---|---|
| **B1: entity pages** | **Company** (M9.2): the six tabs, with every spec 8 field plus the startup and listing parts (M9.7): "Founded …" and "Listed …" lines, founders' cards, partial characters marked, directors, last IPO vote with each member's vote and the next vote date. **Character**, **Country**, **Zone**, **Exchange** pages (with the index chart). Collapsible sections throughout |
| **B2: market and world pages** | **Industries** table and detail (M9.3): 42 rows, births column, 20-quarter demand vs supply chart, growth bars against long-term growth, fringe row. **News** feed (M9.6): date and industry tags, industry filter, every subject linked. **Recap** (M9.5): world page and watchlist company pages, by quarter. **Startup event** pages. **Pdoomberg full-screen** (M9.4): F2 quotes watchlists, F3 chart with the EFV band, F4 lock, F5 filings, F6 ratings, F7 bonds, F9 industries, F10 screener with origin and listing-date filters; F-keys and `TICKER Fn` commands |

Both lanes remove their uses of `ui/demo.rs`. The last of the two to merge deletes the file, and the bench and the three demo tests move to the real company_rows table.

### Phase C: closing checks (one lane)

- **M9.8 leak test.** In a release build with Omniscient off, render every page for every private company and scan all text for any true private value. The test fails if any appears. Bands must never contain the exact value as an endpoint.
- **M9.9 timing harness.** In a release build on a fresh 2020 world, open every page, tab and F-key page from a navigate message, and assert the first laid-out frame comes in under 100 ms. Report a per-page table.
- Delete `ui/demo.rs` if it's still there.
- Update docs/build/decisions.md and design-fixes.md.
- Run the full gate twice.

Every PR gets an independent reviewer before merge, as in M1–M10.

## 4. Spec and design-doc changes to log for Logan

- **Spec 1** ("?" for private figures) → estimate bands. Log as a design fix with a decision row.
- **Spec 8 single-panel screens** → a tiling workspace of wiki pages. The extra entity pages (Character, Country, Zone, Exchange, Event) go beyond spec 8.
- **20-ui 20.2.4** two panel slots → tiling panes.
- **20-ui 20.2.6** F1–F8 map modes vs Pdoomberg F-keys: resolved by scoping F-keys to Pdoomberg.
- **Ballot odds** hidden in the UI (20-ui 20.1), while spec 9.2 exposes them in the view.

## 5. Risks

| Risk | Mitigation |
|---|---|
| bevy_ui text cost with several dense panes open | Virtualized tables everywhere; pages rebuild only when their view's version changes; text written only for cells that changed (as M7's table does) |
| The 100 ms rule with heavy pages (Company Financials, Industries detail chart) | Pages read ready views and never compute; charts draw from precomputed series; the timing harness lands in Phase A2 as a smoke test, not only at the end |
| Leaking true private values through a new path (hover cards, command bar, screener filters, sort order) | Bands come from the views, so the UI never holds the true value for private companies outside Omniscient; the M9.8 scan covers hover cards and the command bar too; sorting a band column sorts by the band, not the hidden truth |
| Merge conflicts between B1 and B2 | Folder ownership; shared pieces (router, page enum, links, theme, table) are all frozen in A2 |
| Disk | Two Bevy builders at most; build folders deleted on merge |

## 6. Verification at the end

- Main has M9.1–M9.9 merged, and the full gate passes twice.
- A release build opens; every page, tab and F-key page opens in under 100 ms on a fresh 2020 world (timing table attached).
- The leak test passes in release with Omniscient off.
- `ui/demo.rs` is gone, and nothing in `crates/game` reads sim-data apart from `main.rs` loading the world.
- Soak CSVs are byte-identical to before M9 (the views and EFV changes don't move the economy).
- Logan tries a multi-pane layout by hand: links, back and forward, the command bar, saved layouts, column config, density.
