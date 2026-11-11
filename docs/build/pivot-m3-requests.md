# Contract requests collected in M2, for the M3 contracts change

The M2 lanes (twelve of them, built in parallel against the mock) each found things the view and
protocol contracts could not say. M3 opens with one contracts change; this is its input list. Apply
what is right, record each rejection and why in that change's decisions row (the way D1037 treated
the M1 list in [pivot-contract-requests.md](pivot-contract-requests.md)).

## Already done in the M2 close-out (do not redo)

- `Status.starts` in the UI store from `Ready.starts` (the new-game picker could not list baked starts).
- `NewGame.difficulty?` in the protocol and the host (D1052); the picker has no difficulty field yet.
- `NotificationKind` gained `Tax` and `Bankruptcy`; `simHydrate` calls `playerStart`.
- Social reads `person/<id>` (the encyclopedia's link) and opens that person's handle page.
- The `formatCents` "Â¢" report was a terminal display artefact, not a defect.
- An e2e tour of every app's main routes exists (`apps/desktop/e2e/tour.spec.ts`, tag `@tour`).

## Views and protocol

- `Post.reply_to: number | null` (Social has no real threads; it shows "other posts on this subject").
- Names for mentions of Bill, Contract, Company, Industry, State, County, District, Outlet, Pollster
  (today they read "Bill 3", "Contract 116"): an optional `label` on `EntityRef`, or the view writes names.
- `Article.dek` (News derives the standfirst from the body's first sentence).
- Forecast history slice (`{ view: "forecast", slice: "history", race }`, plus chamber and state
  history) and a fuller seat distribution than three quantiles: Plumbline only knows the model runs
  it saw while open.
- A light state-list view (names, abbreviations): apps read `v_usmap_layers` (county arrays) for names.
- Race to records route (results, finance), so Polls can link a race's records.
- `RollCallRow.threshold` (or `needed` and `rule`): Records parses the question text.
- `PersonRow` seat (`chamber`, `state`, `district`): Records parses the office title.
- `PersonRow` elections won and lost (lane C proposal), and an optional `Person.character` link for
  executives.
- `DistrictPlanRow.challenge` (none, pending, struck); `v_returns` carrying earlier cycles
  (`results/<cycle>` works only for the latest today).
- `v_account`: brokerage spread, commission rate and `PLAYER_MAX_STAKE`, so the order ticket's
  estimate is exact (it uses the last fill's commission now).
- `ClockView` carries the last pause reason (the taskbar scans notices for it).
- A game-start field for difficulty in the new-game picker UI (sim, protocol and host are ready).
- `World.usa_only: boolean` set at load from the manifest, replacing the implicit
  `worldHasRowBlock` test (lane D1038).

## Public-facing leaks to close at the source (required, not optional)

The Browser app strips hidden company data by matching field labels, which breaks silently if a
label is renamed. Fix at the view or page-builder level so hidden fields are null or absent unless
Omniscient (pivot 5.11):

- The company page builds management score, archetype, company id, board skills and traits, and the
  locked growth and R&D plans into the doc (`pages/kinds/company.tsx`).
- `pages/kinds/politics.tsx` and the `characters` list read `v_politics` with skills and traits open.
- `industries.tsx` shows S, M, fringe share and trend demand; `recap.tsx` shows confidence,
  reaction and "Expected s"; decide per item whether it is a published figure.
- `world-history.tsx` relies on the scenario field staying null until the reveal: verify in the real sim.
- Company charts draw `efv` ± 15% as the "EFV band": check it is the published estimate, not true value.

## Shell, apps and tooling

- `Pdoomberg.tsx`: optional `pages` (custom F4 and F8), a key-scope prop, a window variant, and F8
  Account in `PDB_FUNCTIONS`. This removes the Terminal app's portal and its capture-phase key blocker.
- `ENTITY_APP`: optional Company target in the terminal (`page/F3/<ticker>`).
- `ListTable` / `DataTable`: a cell kind `{ k: "entity", ref }` and per-row test ids (Polls, News and
  Browser wrote plain tables for want of it).
- Move the `HoverCards` provider from the debug workspace to the Desktop, so every app has name cards.
- The built app has no Omniscient toggle (dev server only): add `--omniscient` or a test hook, so e2e
  can open the debug workspace and exercise every app's hidden-field paths.
- A `window.__tcOpenApp(app, route)` hook behind `--test-hooks` (the tour types `orr://` addresses into a
  Browser window to open apps).
- Phone has no error boundary: a crash there blanks the page.
- Window title bars overflow their text at 480 px width.
- A rule or test keeping a `useEffect` from returning a non-function: it crashes only the production
  build (the Records app hit it; the tour now catches it for the main routes).
- Cross-app route grammar is by convention (`social person/N`, `usmap state/N county/N district/N`,
  `polls race/N pollster/N`, `records race/N bill/N`, `news outlet/N`): the tour verifies each kind
  lands on a real page today; keep that test green when routes change.

## Mock

- `quotes.value` (the true V) is never filled, even under Omniscient, so no UI test reaches a gated field.
- Stock orders always fill at once (no resting case to test); `company_detail` is empty (Browser
  company pages blank on the mock); one-seat state plans read "drawn by No party"; a bill's "reported
  to the floor" action has a null chamber; no `Resignation` executive action.
- `read_through` is not seeded: the first day shows nine unread notifications, many "paused the game".
- Use the real counties of the mock's 12 states from `assets/worlds/1995/counties.csv` (544) so the
  map shows real shapes instead of hexagons.
- The mock's retraction article carries no `source`.
