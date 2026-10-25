# TS port Step 5: how to add a page

_The brief for the page lanes after Step 5a (ts-migration-plan.md, Step 5 "Pages"). Read
`CLAUDE.md` and `docs/build/ts-lane-rules.md` first. Step 5a built the framework and the World,
Country and Settings pages; use them as the pattern._

The rule from Logan: game functionality stays the same, the UI may differ, and where React has an
easier way, use it while keeping the Rust page's structure (its sections, fields, tables, links).

## The pieces (apps/web/src)

| File | Rust | What it is |
| --- | --- | --- |
| `pages/ref.ts` | `pages/mod.rs` | `PageRef` (all 20 kinds), `pageKey`/`pageFromKey` (`company/12`, `recap/2020-Q1`, `province/US-0053`), kind names and tags, `PdbFunction` |
| `pages/spec.ts` | `PageSpec` | what a page registers: `kind`, `views`, `sections`, `tabs`, and `doc` or `Component` |
| `pages/registry.ts` | `PageRegistry` | picks up every `pages/kinds/*.tsx` by glob import; nobody edits it |
| `pages/doc.ts` | `pages/doc.rs` | the PageDoc data model: `Span`, `Field`, `Block` (fields, line, table, chart, cards, heading), `Live` values, `docLinks`/`docTexts`/`docTable` for tests, `bps` |
| `pages/DocView.tsx` | `spawn_doc` | draws a PageDoc: header, tab strip, head blocks, sections |
| `pages/SectionsView.tsx`, `pages/sections.ts` | `spawn_sections`, `arrange_sections`, `select_tab` | section headers (fold, up, down, hide) and tabs, kept in the settings |
| `pages/parts.tsx` | `placeholder.rs` helpers, `market.rs` | `PageHeader`, `ChipRow`, `LinkGroup`, `Fact`, `figureTone`, `Note`, `TableBox` |
| `pages/Picker.tsx` | `live.rs` `Filter`, `spawn_picker` | a filter picker ("Industry: All v") |
| `pages/tables.ts` | shared models | `provincesTable`, `linkCell`, `statusText` |
| `pages/ChartBlock.tsx` | `chart/` | draws a doc `ChartModel` (candles with EFV band, lines, bars, band strips) |
| `pages/PagePane.tsx` | `workspace/` panes | a dockview pane with its own history, breadcrumb, Back/Forward |
| `pages/PendingPage.tsx` | `placeholder.rs` | what a kind with no page shows ("Not ported yet") |
| `links/Link.tsx`, `links/nav.ts` | `links/mod.rs` | `<Link page>`: click opens in this pane, Shift+click or middle click in a new pane; hover name cards |
| `links/cards.ts` | `links/cards.rs` | every kind's hover card (done; the map lane adds `zone_hover_card`) |
| `links/names.ts` | `links/names.rs`, `command/index.rs` | the name index (`useNameIndex`, `index.title(page)`), `place`, `placeSpans`, `controllerPage`, `role`, `roleText`, `eventName` |
| `config/settings.ts`, `config/hooks.ts` | `config/mod.rs` | the JSON settings in localStorage: density, font scale, table sorts, sections, layouts |

## Adding a page

1. One file per page: `apps/web/src/pages/kinds/<rust file name>.tsx` (`company.tsx`,
   `lists.tsx`, ...). It exports `pages`, a list of specs, one per kind it serves:

   ```ts
   export const pages = [
     definePage({
       kind: "company",
       views: ["company_rows", "company_detail", "quotes", ...],
       sections: SECTIONS,           // { id, title }[] in Rust order, same ids as the Rust page
       tabs: true,                   // the Company page's tab strip (D481)
       doc: (page, v, index) => companyDoc(page.id, v, index),
     }),
   ];
   ```

   That is all the wiring: the registry finds the file, links and the command bar open the kind,
   the pending page goes away. A kind must be registered once (the registry throws otherwise).
2. Prefer a **doc page**: port the Rust `*_doc` builder as a pure function
   `(id, v: ViewsData, index: NameIndex) => PageDoc` (see `kinds/country.tsx`). Field labels,
   section ids, table ids (`"country.companies"`) and column titles stay the Rust ones, so the
   tests read the same. Use a `Component` page only when the Rust page is mostly widgets
   (`kinds/settings.tsx`); it still uses `<Sections>` for its sections.
3. Pages that were not docs in Rust (World, the list pages) can still be docs: put the main
   table in `head` (see `kinds/world.tsx`).
4. Keep every spec section and D-number comment from the Rust file.

## How a page gets its views

- `views` names what the page reads (`ViewName`s). The pane subscribes to exactly those and
  rebuilds the doc when one moves, at most every `PAGE_REFRESH_MS` (200 ms). Name only what the
  builder reads; a view that moves every tick (`clock`, `quotes`) would rebuild the page every
  200 ms: show those through **live spans** instead (`span.live({ k: "Price", company })`), which
  re-render alone. Need the current quarter? `index.latestRecap()` avoids reading `clock`.
- Look rows up with `byId(rows, id)` (binary search: every view table is in id order) and
  `byKey` for other keys (an exchange's `zone`).
- Names come from the index: `index.title(page)`; never print an id.
- **No raw tables.** `apps/web` never imports `@tc20ff/sim/internal` (the boundary scan fails
  the gate). If a page needs data no view has, do not work around it: write it down as a view gap
  (the field you need and the view it belongs in) in your PR, and render what you can. If you add
  the field yourself, it goes in `packages/sim/src/views/` and its contract, and
  `packages/sim/test/views/leak.test.ts` must still pass.
- **Bands stay bands** (spec 9, D420 to D440, D461): every view `Figure` goes through
  `figureCell(f, unit)` or `span.figure(f, unit)`. Never read `band.estimate`, never show a band's
  midpoint, never colour a band as exact. A progress bar over a band is a strip, not a fill
  (`Progress`, D466).

## Tables, charts, links

- A doc table is `{ id, columns: DocColumn[], rows: Cell[][] }`. Cells come from
  `widgets/cells.ts` (`money`, `percent`, `price`, `rating`, `gain`, `link`, `band` via
  `figureCell`, `unknown`). The table sorts (bands by midpoint, unknowns last), virtualizes, keeps
  its sort in the settings under its id, and follows the density. `linkCell(index, page)` makes a
  named link cell.
- Outside a doc, use `DataTable` (`widgets/DataTable.tsx`) directly, inside a `TableBox` when it
  sits in a section.
- A chart is a `{ k: "chart", chart: ChartModel }` block; build the model in your page file
  (candles from `v_price_bars` bars, `band` series for estimated figures). `ChartBlock` draws it
  and loads lightweight-charts lazily. The full-pane price chart is `widgets/PriceChart.tsx`.
- Links: `span.link(text, page)` in docs, `<Link page>` in components. Never handle clicks
  yourself; the pane's `NavContext` routes them (focused pane, new pane on Shift or middle).
- Filters: `<Picker>` and a `useState` in a `Component` page, or in the page's own state if it is
  a doc page drawn by a small component.

## Testing a page

- **Data tests** (node): build docs from a real game's views, as `test/pages/pages.test.ts` does:
  `simNew(data, 42)`, step 200 ticks for the after-the-first-lock state, `viewsData(sim.views())`,
  `buildNameIndex(v)`. Assert with `docTable`, `docLinks`, `docTexts`, `docField`. For bands,
  an Omniscient twin (`simNew(data, 42, { debug: true })` then `SetOmniscient`) gives the truth:
  it must lie strictly inside each band and never appear in the page's plain text.
- **DOM tests** (React Testing Library): put `// @vitest-environment happy-dom` on line 1, fill a
  `SimStore` from `RealHost`'s NewGame frame, and render `<PageBody page>` inside the providers, as
  `test/pages/pages-dom.test.tsx` does. Virtualized table rows do not render in happy-dom, so
  click links in fields and lines, not table cells.
- Port the Rust tests listed for your pages in `test/pages/pending/lane-a.test.ts` or
  `lane-b.test.ts`: move each block to `test/pages/<page>.test.ts(x)`, make the todos real, and
  delete the block. Never weaken a Rust assertion silently.
- While iterating, run only your files: `corepack pnpm@10.20.0 exec vitest run apps/web/test/pages/<file>`.
  Each file that builds a game holds a whole world in memory; keep it to one game per file
  (`beforeAll`). Run `bash scripts/check-ts.sh` once at the end.

## The 100 ms open budget

Each page must open in under 100 ms (ts-migration-plan Step 5). In practice: the doc builder is
the cost, so keep it linear in the rows it shows (no `find` inside a loop over thousands of rows;
use `byId` or a `Map`), and let `DataTable` virtualize long tables. In development the pane logs
a warning when a doc build passes `PAGE_BUDGET_MS`. Add your page to a budget test like
`pages.test.ts` "the open budget" (the slowest of three builds after a warm-up, on the
heaviest entity, must be under `PAGE_BUDGET_MS`).

## The remaining pages: two lanes, no shared files

Step 5a ported `doc.rs` (the data model and renderer), the `placeholder.rs` helpers and the
`live.rs` filter (as `Picker`), so those are no longer separate tasks. `industries` and `events`
call `news.rs` helpers (`headline_links`, `event_headlines`), so they sit in one lane with News;
`exchange` uses `zone.rs`'s index chart, so Zone and Exchange sit together. The split:

| Lane A (entity pages, Rust lane B1) | Rust lines | Lane B (market pages and Pdoomberg, Rust lane B2) | Rust lines |
| --- | --- | --- | --- |
| `company.tsx` (with `placeholder_chart`) | 1,054 | `industries.tsx` (Industries list and an industry) | 505 |
| `character.tsx` | 207 | `news.tsx` (News feed and a headline) | 593 |
| `zone.tsx`, `exchange.tsx` | 428 | `events.tsx` (Startup events and an event) | 305 |
| `province.tsx` | 365 | `pdoomberg/` (full-screen terminal, F-key pages) | 1,458 |
| `lists.tsx` (Companies, Characters, Countries, Exchanges, Zones) | 350 | | |
| `recap.tsx` | 359 | | |

Lists: `lists.rs` registers all eight list kinds, but Lane B's `industries.tsx`, `news.tsx` and
`events.tsx` register the Industries, News and Events lists (the Rust B2 pages replaced those),
so `lists.tsx` registers the other five. A kind registered twice fails at load, which catches a
slip.

Files each lane may touch besides its own page files and tests:

- **Lane A only**: `pages/tables.ts` (add a shared model only when two of your pages need it),
  `test/pages/pending/lane-a.test.ts`, `shell/Workspace.tsx` and `panes/AlertsPane.tsx` for the
  recap's alert opening (D513: the recap opens in a pane when its alert pauses the game).
- **Lane B only**: `shell/CommandBar.tsx` (`TICKER Fn`, 20.5.2), `App.tsx` (the Pdoomberg
  overlay and its keys: B, Esc), a new `apps/web/src/pdoomberg/` folder,
  `test/pages/pending/lane-b.test.ts`.
- **Nobody** (ask the orchestrator): the framework files above, `widgets/`, `config/`,
  `styles.css` beyond appending a block for your page's classes at the end (append-only, one
  comment header per lane, so merges do not conflict), `package.json`.
- **Leave the fixed panes alone** (`shell/panes.ts` `FIXED_PANES`, the Companies, Industries,
  Countries and Wire panes): Step 6 retires them once the list pages cover them.

There is no registry entry to add, so two lanes adding pages never touch the same line.

## Known view gaps

- The runner controls' **watchlist** (and the Omniscient flag) are in no view and no frame.
  The recap's company pages, the news and industry filters and Pdoomberg read `Controls.watchlist`
  in Rust. `v_recap.watchlist` holds only the watchlist companies with a page in the latest
  recap. Proposed: `ClockView.watchlist: CompanyId[]` (id order) and `ClockView.omniscient:
  boolean`; v_clock is already rebuilt after every control. Until then a page can keep its own
  watchlist picks, or read `v_recap.watchlist`.
