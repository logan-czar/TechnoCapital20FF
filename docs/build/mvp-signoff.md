# MVP sign-off summary

For Logan, 2026-10-24. This page covers every row of [decisions.md](decisions.md) (365 rows) and [design-fixes.md](design-fixes.md) (79 rows), so you can sign off the MVP build in one sitting. It changes no decision; the logs stay the source.

How to read it:

- **keep** means the builder's pick is sound and needs only your tick.
- **revisit** means the reason says what to look at.
- **[spec]** marks a row that changes or goes past what mvp-spec v1.4 says. These matter most.
- **L** marks a row whose direction came from you (a request or ruling with a date in the row) but whose sign-off column is still blank. The builders' details still need your tick.

## 1. Status

- **Done:** M1 to M10 and track P (the province map). PRs #2 to #50 are merged into main (990038c). PR #1 was the design.
- **World:** 3,963 provinces (3,255 at the start of M8; D820 split the 71 non-Arctic giants into 779 parts no larger than Eastern Iowa), 651 starting companies, save version 11.
- **Soak:** 50 seeds × 30 years. All 19 judged spec 10 targets are MET (as restated at M10.7); Cloud's two rows are WAIVED (D366, D368). A 30-year headless run takes 5.5 to 7 s, against a 2-minute budget.
- **Screens:** every page, tab, F-key page and map mode opens in under 100 ms (worst 25.7 ms). The leak test finds no private truth on any screen.
- **Gate:** `scripts/check.ps1` runs 685 tests in 57 s after a game change and 93 s after a sim change (D870).
- **Tested on Windows only.** macOS and Linux have not been built (section 6).

## 2. Already decided by Logan

These rows carry your name in their sign-off column. They need no action.

**Signed at the plan and the M3 gate (73 rows).** D1 to D3 at the plan; the rest at the M3 gate. D116 was later replaced by D129.

**Ids:** D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13, D14, D15, D16, D100, D101, D102, D103, D104, D105, D106, D107, D108, D109, D110, D111, D112, D113, D114, D115, D116, D117, D118, D119, D200, D201, D202, D203, D204, D205, D206, D207, D208, D209, D210, D211, D212, D220, D221, D222, D223, D224, D225, D226, D227, D228, D229, D230, D231, D232, D233, D234, D235, D300, D301, D302, D303, D304, D305, D306, D307

**Your later rulings (19 rows):**

| Id | Gist | When |
|---|---|---|
| D168 | The no-rolls projection holds S, M and productivity at the plan lock | 2026-10-21, design fix 109 |
| D282 | Oversupply costs 1 point of growth per 1% (`g_dem − max(0, S − 1)`) | 2026-10-21, design fix 241 |
| D360 | The 6.3 productivity adj is +0.5 below productivity 100 | 2026-10-21, M10.7 |
| D361 | The consensus error e is ±15% | 2026-10-21, M10.7 |
| D362 | The IPO revenue test is TTM revenue of at least $75M | 2026-10-21, M10.7 |
| D363 | Revenue is checked against its own demand path; demand is checked against trend at ±55% | 2026-10-21, M10.7 |
| D364 | The Bust band is 8% to 22% | 2026-10-21, M10.7 |
| D365 | Demand growth is pooled: 90% of industry-runs within ±3 pp | 2026-10-21, M10.7 |
| D366 | Cloud is waived from the M clamp target until the 11.2 rework | 2026-10-21, M10.7 |
| D367 | The demand-against-trend target needs 85% of seeds | 2026-10-21, M10.7 |
| D368 | Cloud's waiver also covers revenue against demand | 2026-10-21, M10.7 |
| D420 | Private figures show estimate bands, not "?" | 2026-10-21, M9 plan; A1 (threat model D440) |
| D436 | In an estimated industry, every company's monthly unit figures are banded | M9 A1 (threat model D440) |
| D440 | The bands' threat model: nothing exact by simple arithmetic; deep re-derivation is out of scope | M9 A1 |
| D601 | The licence allowlist (CC BY, CC0, public domain, the named government licences) | PR #34 and PR #38 reviews |
| D671 | Attribution-only licences outside the list stay refused (swisstopo, OMN) | Phase B gate |
| D676 | Builder-drawn carve lines | Phase B gate |
| D681 | Approximate Voronoi split lines for new regions | Phase B gate |
| D685 | Five more government licences allowed (DEU, FRA, ESP, SGP, KOR Type 1) | PR #38 review |

## 3. Needs sign-off

**Quick path:** you can tick 3.2 and 3.3 wholesale and read only their **[spec]** and revisit rows.

268 rows: 86 sim and economy, 30 views, 60 UI, 52 map, 40 benches and build. 25 carry **[spec]**; 7 are marked revisit.

**Not every row below D236 is signed.** Lanes number their rows by range, not by date, so 47 rows below D236 were logged after the M3 gate and carry no sign-off: D120 to D167 (M4 to M6), except D126, which is superseded (section 4). They are in this section.

Nine rows on map review items (D686 to D694) say "PR #38/#39/#40 review" in their sign-off column. That was the PR reviewer, not you, so they are here too.

Some rows here were partly replaced by a later row; the later row wins for that part: D140 (by D150), D141 (by D168), D143 (by D151), D166 (by D321), D236 (by D241), D451 (by D544), D454 (by D463), D486 (by D541), D512 (by D543), D637 (by D640).

### 3.1 Sim and economy

| Id | Gist | Rec |
|---|---|---|
| D120 | L. Archetype at load reads the 6.1 table in row order (you ruled table order in design fix 105) | keep |
| D121 | The starting run rate is the 7.1 company at M 1.0 for a year, R&D at the 6.3 plan | keep |
| D122 | **[spec]** The quarter close pays tax first, then builds statements; cash can sit just below 0 until the next settle | keep |
| D123 | Bankrupt and removed companies run no monthly step and post empty months | keep |
| D124 | What the step 13 settle includes; a forced sale takes the same share of every unit | keep |
| D125 | Flows between closes (a dividend, a share issue) post in the month they happen | keep |
| D127 | Removal returns assets to the fringe; the company row and filings stay | keep |
| D128 | The monthly balance check counts failures and never panics | keep |
| D129 | Trailing revenue is the TTM once statements exist (replaces D116) | keep |
| D130 | Statements publish at 00:00 on release day; the archive is shared, not copied | keep |
| D131 | The release-day review reads the TTM; the rating moves, then the line limit | keep |
| D132 | Load reads `start_rating` from the CSV; the computed rating is kept as `implied` | keep |
| D133 | The consensus at load is the synthetic Q4 2019, so the first release has no surprise | keep |
| D134 | The 467 public companies list at load; a bankruptcy delists at step 13 | keep |
| D135 | The hourly price step runs in place with the same draws as `step_prices` | keep |
| D136 | The day's bar opens after 4.2 step 6 | keep |
| D137 | M5's headline hook returned nothing until M6 filled it | keep |
| D138 | A bankrupt or removed company's fair value is 0 and never refreshed | keep |
| D139 | Daily bars are kept in month chunks, 10 years deep | keep |
| D140 | EFV = V × (1 + e), e within ±15%, redrawn at each release | keep |
| D141 | The projection runs a no-noise clone of the World through the quarter | keep |
| D142 | Surprise and tags are set at the close; the price jumps at the 01:00 move | keep |
| D145 | P, V and the basis at load; all 651 match the CSV within $0.62 | keep |
| D147 | The indices weight by `Stock::shares`; any change rescales the divisor | keep |
| D148 | Bar history shares closed months behind one pointer (speed) | keep |
| D149 | A delisting sets the previous close to 0, so the day change reads 0 | keep |
| D150 | The EFV error is drawn at load too, so EFV never shows the true V | keep |
| D153 | A starting company's cap table is one block; holders always sum to shares out | keep |
| D154 | An event whose every startup is capped out posts nothing | keep |
| D155 | Listing pre-money is the 5.13 value at the exchange's confidence | keep |
| D156 | A company due to vote but not eligible waits for the next lock it qualifies at | keep |
| D157 | Only quoted companies make the release's five largest beats and misses | keep |
| D158 | Headlines post at the next 00:00 (replaces D126) | keep |
| D159 | A newborn posts a whole month at its first close, with no proration | keep |
| D160 | The order in which the Lite AI batch reads and writes the World | keep |
| D161 | The plan at load is set with the units; Arrowhead's PC bonus becomes +3 from February 2020 | keep |
| D162 | loss_q moves at the quarter close | keep |
| D163 | The load's frozen draw order with M6 | keep |
| D164 | The recap is built from the kept projections at the pre-quarter-end week | keep |
| D165 | When phase change and boom headlines post | keep |
| D167 | Save version 6 contents (since raised to 11) | keep |
| D236 | **[spec]** Data: the D15 line sizing runs on whole dollars; when it alternates, the lower line wins | keep |
| D237 | **[spec]** Data: company-start.csv gains `start_rating`, checked in three places | keep |
| D238 | **[spec]** Data: the engine value reads the higher D15 book equity | keep |
| D239 | **[spec]** Data: gen.py uses 5.13's G at g 0 (design fix 230); total engine value falls 6.9% | keep |
| D240 | **[spec]** Data: Real estate floors at 0.9 × book; R uses the rounded home spread (design fix 231) | keep |
| D241 | **[spec]** Data: starting lines are sized at a 10% EBITDA haircut; 237 cut, $1,166B drawn | keep |
| D242 | The book floor uses max(book, 0); a cent-a-share floor always holds | keep |
| D243 | The release fixes the fair value basis; the daily refresh moves book, label, confidence, R and X | keep |
| D244 | The engine value at load is 5.13 on the load basis; all 651 match to $1 | keep |
| D245 | Sector volatility 26% and beta 1.0 (the medians) | keep |
| D246 | Fat tails per draw, the draw order, and a $0.01 price floor | keep |
| D247 | **[spec]** Reaction volatility ×2 fades linearly over 7 days; 21.3.1's momentum second-day move is not built | keep (post-MVP) |
| D248 | A daily bar covers 01:00 on day D to 00:00 on D + 1; 1 January has no bar | keep |
| D249 | Result-tag edges are strict; record-quarter rules; a 0 consensus reads as $1 | keep |
| D250 | Index divisors rescale on every constituent change, so levels never jump | keep |
| D251 | A confidence under 0.005 reads as exactly 0 | keep |
| D252 | The consensus error's stream, the elapsed share, and the range centre | keep |
| D253 | A company with no quarter is valued as a loss-maker | keep |
| D254 | Revenue growth comes from the archive, clamped to −30% to +60% | keep |
| D260 | Province weight G = clamp(√(GDP per head ratio), 0.1, 4), from batch 160 | keep |
| D261 | When every industry is Glut or Bust, no random event fires | keep |
| D262 | ROA with no quarter uses the run-rate EBIT | keep |
| D263 | Trait nudges, then the clamp, then the funding cap | keep |
| D264 | R&D trait mults multiply; the loss cut stops at 0.5 × the norm | keep |
| D265 | **[spec]** The 6.5 draw row reads cash on hand, not own cash (design fix 243) | keep |
| D266 | How a share raise is sized. **The 6.6 raise never fires on the real data:** no industry is cash-burning | **revisit**: the share-issue path, its headlines and the new-investors line never run in play. Decide whether an industry should burn cash, or accept it as dormant. Your batch 146 named Consumer electronics, EVs, E-commerce and AI labs as cash-burning by design; batch 148 deferred the flags to the per-industry rework (docs/design/13-open-questions.md) |
| D267 | The random event's draw order | keep |
| D268 | The 2% startup cap reads fringe assets × turnover | keep |
| D269 | A newborn's fixed cost rate breaks even at the norm | keep |
| D270 | A lone founder holds all 60% | keep |
| D271 | A newborn's run rate, rating and value. **Every Tech startup is born CC with a $0 line limit** | **revisit**: Tech startups fail the IPO rating test until real profits show (design fix 240). Confirm that is intended |
| D272 | Startup names follow world-gen's rules | keep |
| D273 | A deterministic ticker scheme that reproduces all 467 tickers | keep |
| D274 | The cast's draw order; leftover partial characters become directors | keep |
| D275 | When F9 fires; fixed-event regions | keep |
| D276 | The IPO vote's roll order, on the gen stream | keep |
| D277 | Ties in the cap of 3 go by TTM revenue | keep |
| D278 | Rounding in a listing | keep |
| D279 | Headline texts 5.18 leaves out; five beats and five misses | keep |
| D280 | The recap's expected beats, misses and reaction | keep |
| D281 | The tipped lab comes from the five largest AI labs | keep |
| D283 | The plan the 651 hold until the first lock on 9 January | keep |
| D401 | Bar storage on write-once slots: same bytes, same hashes (speed) | keep |
| D402 | v_quotes refills in place (speed) | keep |
| D801 | Monthly and quarterly views build on 6 worker threads; quarter ticks cost half; soak unchanged | keep |

### 3.2 Views and estimate bands

| Id | Gist | Rec |
|---|---|---|
| D144 | v_quotes holds numbers by id only; the headless runner reads aggregates | keep |
| D146 | Exchanges and zone confidence refresh daily | keep |
| D421 | Band noise comes from a hash, never from an RNG stream | keep |
| D422 | Band = estimate ± 25%; the truth is always strictly inside | keep |
| D423 | Banded views rebuild when Omniscient is toggled | keep |
| D424 | **[spec]** Each daily bar stores its EFV (design fix 421); save version 7 | keep |
| D425 | Load keeps companies.csv's control columns for the cap table | keep |
| D426 | What the new M9 views hold, and how often they rebuild | keep |
| D427 | The soak's true totals sit behind a headless-only feature | keep |
| D428 | Listing, births column and event names on rows | keep |
| D429 | L. A fixed per-company bias so averaging estimates cannot find the truth (your ruling on averaging) | keep |
| D430 | One figure is banded; the rest are derived from its band, never banded again | keep |
| D431 | A private company's data book (TB) figures are banded | keep |
| D432 | L **[spec]** An industry with one or two banded companies shows banded totals (your ruling; design fix 422) | keep |
| D433 | The last 20 recaps are kept | keep |
| D434 | The compute bill stays exact | keep |
| D435 | v_statements reuses archived estimates (speed) | keep |
| D437 | An industry's history is banded by its class at each quarter's close | keep |
| D439 | "Does this company publish" is a World question, not a view one | keep |
| D540 | **[spec]** The sim keeps 10 years of index history (design fix 462); save version 8 | keep |
| D541 | The Board tab lists directors in seat order | keep |
| D542 | Ballots record who voted | keep |
| D543 | A headline carries its startup event id | keep |
| D544 | Headline ids are stable post-order numbers | keep |
| D545 | The news feed is a lazy walk, 500 rows by default | keep |
| D631 | The province card; unit figures come from v_units, so they stay banded | keep |
| D632 | The Political map layer | keep |
| D633 | What v_map_static carries | keep |
| D700 | The map modes and the views each reads | keep |
| D701 | Map layers never hold a hidden private figure | keep |

### 3.3 UI and workspace

| Id | Gist | Rec |
|---|---|---|
| D450 | **[spec]** A tiling pane workspace: up to 12 panes, each with history; saved layouts (design fix 440) | keep |
| D451 | **[spec]** Typed page references, with pages spec 8 does not list | keep |
| D452 | The UI config is one `ui.ron` file; bad files are set aside | keep |
| D453 | Workspace keyboard shortcuts (design fix 442) | keep |
| D454 | Link colour and hover cards | keep |
| D455 | How the command bar matches and ranks | keep |
| D456 | New table cell kinds; the ASCII band form `$12.0M-$18.0M` (design fix 441) | keep |
| D457 | The chart widget is drawn with plain bevy_ui nodes | keep |
| D458 | Two densities; font scale 75% to 150% | keep |
| D460 | Page sections fold, move and hide | keep |
| D461 | One code path prints figures; a band shows only its range | keep |
| D462 | How places, controllers and roles are named and linked | keep |
| D463 | Hover cards on the A1 views | keep |
| D464 | The name index's sources | keep |
| D465 | The chart's EFV band comes from each daily bar | keep |
| D466 | Banded chart slots draw as a strip, not a point | keep |
| D480 | Entity pages are built as data first; section tables show 40 rows | keep |
| D481 | The Company tabs are section folding | keep |
| D482 | **[spec]** The Board tab shows each vote, never the odds (design fix 460) | keep |
| D483 | Which figures the Company Overview shows (design fix 461) | keep |
| D485 | Pages rebuild on slow views; fast figures update live | keep |
| D486 | Partial characters are marked and not linked | keep |
| D488 | Live tables and charts redraw on the first move | keep |
| D510 | `Live` widgets remake from the views | keep |
| D511 | Page filters live with the page | keep |
| D512 | The news feed shows every startup event | keep |
| D513 | Where the recap opens; past quarters | keep |
| D514 | How full-screen Pdoomberg looks | keep |
| D515 | **[spec]** F2's lists: All, your watchlist, by industry, by country (design fix 480) | keep |
| D516 | **[spec]** What F3 to F10 show; F4 is only the lock; F9 uses M as the price index (design fix 481) | keep |
| D517 | Function keys work only inside Pdoomberg | keep |
| D518 | The Industries table and detail | keep |
| D520 | The Pdoomberg page builds on its first open | keep |
| D570 | `ui/demo.rs` is gone; the World page lists provinces from the views | keep |
| D571 | Resizing keeps every pane above its minimum size | keep |
| D572 | The recap's watchlist box grows with its rows | keep |
| D635 | **[spec]** The workspace becomes floating windows over the map (your m8-plan choice) | keep |
| D636 | Map camera: pan, zoom, and zoom levels by longitude span | keep |
| D637 | Map picking and what a click does | keep |
| D638 | The map is one UI shader; the political palette | keep |
| D640 | Tiny-province targets take a click only near their dot | keep |
| D641 | Window dock, screenshot and map-folder check fixes | keep |
| D702 | Map mode colours and legends | keep |
| D703 | HQ and exchange pins | keep |
| D704 | The map hover card | keep |
| D706 | Map labels by zoom level, with overlap culling | keep |
| D707 | **[spec]** A Province page, and province links everywhere (goes past spec 8's card) | keep |
| D708 | Windows keep a preferred size and grow back | keep |
| D770 | A profiling build, and what the speed-5 frame cost | keep |
| D771 | The name index no longer rebuilds every frame | keep |
| D772 | Entity pages patch in place instead of rebuilding | keep |
| D773 | UI updates are paced while the sim fast-forwards | keep |
| D774 | Charts write only the nodes that changed | keep |
| D775 | Views are shared, not cloned; old copies are freed off the frame | keep |
| D776 | A costly tick waits for a frame it fits in | keep |
| D777 | Heavy UI jobs run only in light sim frames | keep |
| D800 | L **[spec]** A new Quarter start alert; Plan lock defaults to Pause (you asked, 2026-10-23; design fix 800); save version 9 | keep |
| D803 | A resume into max speed keeps the pacing | keep |
| D804 | A chart drawn in the frame its page is rebuilt no longer panics | keep |
| D806 | After a resume, the first three frames step 2, 4 and 6 ms; not yet measured on a quiet machine | keep (see D805) |

### 3.4 Map pipeline and provinces

| Id | Gist | Rec |
|---|---|---|
| D600 | The map runs from 84 N to 57.78 S; Antarctica is off the map | keep |
| D602 | mapshaper simplifies in degrees; mapgen applies Miller | keep |
| D603 | How a multi-province region is cut (blocks, seeds, Voronoi) | keep |
| D604 | L. Confidence scale; rows under 0.6 are flagged for you ("automatic with flagged review") | keep |
| D605 | Builder hints files for provinces the matcher cannot place | keep |
| D606 | mapgen's own scanline fill instead of geo-rasterize | keep |
| D607 | Tiny provinces (under 64 px) get a click target | keep |
| D608 | What counts as coast; differences from the CSV are listed, not fixed | keep |
| D609 | Colours, centroids, label points and adjacency details | keep |
| D610 | PR #34 review fixes | keep |
| D611 | Composite block names are only a fallback | keep |
| D612 | Metro provinces take only countryside next to them | keep |
| D630 | Map data is static: not saved, not hashed | keep |
| D634 | A synthetic map for tests | keep |
| D670 | Most world ADM2 files use geoBoundaries' simplified lines (off by 1 to 3 px at worst) | keep |
| D672 | Natural Earth codes for disputed and split countries | keep |
| D673 | How a region finds its Natural Earth admin-1 units | keep |
| D674 | Which building blocks a region uses | keep |
| D675 | Per-region stopwords (Paris, Texas) | keep |
| D677 | Provinces sharing one seed point get moved apart and hinted | keep |
| D678 | Sea links for straits up to 60 km; 212 links | keep |
| D679 | Anchor checks that failed on correct maps | keep |
| D680 | geoBoundaries ADM1 for regions Natural Earth lacks | keep |
| D682 | Extra QA report lists | keep |
| D683 | Rebuild whole countries from ADM1 (Kenya, Cote d'Ivoire) | keep |
| D684 | What the world code changed in North America | keep |
| D686 | The city probe: 867 known points must land in their province | keep |
| D687 | Natural Earth units named after their neighbours are placed by where they lie | keep |
| D688 | Metro reach caps; far seeds are dropped, not snapped | keep |
| D689 | A stricter anchor test | keep |
| D690 | Seed fixes from the PR #39 review | keep |
| D691 | Every land exclave must be explained or QA fails | keep |
| D692 | Little Diomede and Big Diomede meet only by sea | keep |
| D694 | PR #40 review fixes; Nawalpur is a known approximation | keep |
| D820 | L **[spec]** The size cap is Eastern Iowa (51,722 km²); phase 1 cuts the 71 non-Arctic giants over 250,000 km² (you, 2026-10-23; design fix 820) | keep |
| D821 | **[spec]** Parts per giant = ceil(area ÷ 0.95 cap); 779 parts, 3,963 provinces | keep |
| D822 | L. Cut along licensed ADM2 lines, else town catchments, else polygon parts (your rule) | keep |
| D823 | L **[spec]** The main part keeps the id and the development; new parts are 1/1/1 (your rule). **217 new parts have compass names, 72 of them numbered** | **revisit**: the names, not the rule. Hand-name the compass parts or accept them |
| D824 | L. Terrain, resource, city rank and coast for new parts | keep |
| D825 | Nothing else lists provinces, so gen.py is not rerun. **The row says tests "now read 3,968"; the code and data say 3,963** | **revisit**: a text fix to the row only |
| D826 | **[spec]** Save version 11; older saves are refused with a reason (spec 9.1) | keep |
| D827 | The split moves no soak target | keep |
| D828 | Province pages are saved by CSV id, not ordinal | keep |
| D829 | Notes and site resources move to the part holding their site | keep |
| D830 | L **[spec]** Startup HQ odds count development above the 1/1/1 floor (you, 2026-10-24; design fix 830); founders' homes use the same weight | keep |
| D850 | L. Organic split borders: rivers first, then meanders. **Straight surveyed ADM2 lines (NT, WA, Saskatchewan, Manitoba) are kept** | **revisit**: confirm you want the real straight survey lines kept (PR #50 asks) |
| D851 | Which Natural Earth rivers a cut may follow | keep |
| D852 | L. Meander size: about 0.08 of a part's width, seeded from the province id | keep |
| D853 | Town-catchment edges bend too | keep |
| D854 | L. An organic cut is kept only if every site, probe point and size rule holds | keep |
| D855 | What the new borders move: small area changes, 8 coastal flags; soak byte-identical | keep |
| D856 | Border share: 68.5% meander, 24.6% real lines, 2.7% river, 4.2% straight | keep |

### 3.5 Benches, checks and build

| Id | Gist | Rec |
|---|---|---|
| D143 | Price tracking counts company-days within ±30% of V | keep |
| D151 | Tracking passes at 98% overall and 97% every year | keep |
| D152 | The max-speed budget test allows the one tick that crosses the budget | keep |
| D166 | What the headless M6 columns measure | keep |
| D320 | Distressed counts as still in; "after 10 years" is the 2029 row | keep |
| D321 | Median productivity over units that still produce | keep |
| D323 | The beat share pools the 40 releases of the 2020s, private companies included | keep |
| D325 | Boom and Bust shares are industry-month shares | keep |
| D326 | Cast sizes are read at each birth | keep |
| D327 | M clamp runs are counted over 2020 to 2029 | keep |
| D328 | What counts as a startup and as a listing | keep |
| D329 | When the named company count is taken; 30-year targets are NA on short runs | keep |
| D330 | A target with no seed share must pass in every seed; a short run is NA, not FAIL | keep |
| D331 | AI labs startups count 2030 to 2035, both included | keep |
| D332 | What a decade is, and when "in 2050" is | keep |
| D333 | Each soak seed runs in its own process | keep |
| D334 | Starting private listings count by the 2024 close | keep |
| D400 | Profiling through an observer, so a profiled run is the same run | keep |
| D403 | The replay log, and a controls digest on its end line | keep |
| D404 | Which ticks the save, load and continue test cuts at | keep |
| D405 | "Noise off" matches validate.py's boom run to 1e-9 | keep |
| D438 | The gate's boundary check builds each binary alone | keep |
| D459 | What the page timing smoke test measures | keep |
| D519 | The table and page benches after the demo table went | keep |
| D573 | The M9.9 timing harness covers every page kind and fails on a miss | keep |
| D574 | The leak test takes the truth from an Omniscient twin | keep |
| D639 | Map bench and screenshot flags | keep |
| D693 | The page bench retries a slow cold open; it hides a one-time ~450 ms first-launch cost | **revisit** (low priority): find what the first launch after a build pays for, rather than only retrying |
| D705 | The M9 checks cover map modes, cards and pins | keep |
| D740 | The click test covers every province, in the gate | keep |
| D741 | The map shader is compiled in, and its layout is tested | keep |
| D742 | Which panes the map bench opens | keep |
| D743 | The leak test runs on the world map | keep |
| D744 | The map bench can run the sim; slow-frame report | keep |
| D778 | The map bench is a p99 check | keep |
| D779 | The gated map check is paused and speed 4; a run that loses focus is INVALID | keep |
| D790 | L. Screenshot and page bench windows open behind your windows (you asked, 2026-10-23) | keep |
| D802 | L. The map bench holds each auto-pause 0.5 s and counts only running frames | keep |
| D805 | **Speed 5 with the panes open is reported, not gated.** The builder's runs passed; the PR #45 review's two failed (p99 18.4 ms) | **revisit**: run D806's ramp twice, focused, on a quiet machine. Gate speed 5 if p99 is 15 ms or under. The 15 ms bar is stricter than the 16.7 ms gate on purpose, to leave margin |
| D870 | L. Faster gate: optimized sim in dev, rust-lld, nextest (you asked, 2026-10-24) | keep |

## 4. Superseded rows

Skip these. A later row replaced each one in full.

| Id | Replaced by | What it was |
|---|---|---|
| D126 | D158 | Bankruptcy headline and its −5 confidence deferred to M5 |
| D322 | D363 | Revenue within ±30% of the trend path (its CSV columns stay) |
| D324 | D365 | Every industry within ±3 pp in 90% of seeds |
| D484 | D540 | The UI recorded index closes itself |
| D487 | D540 | An epoch to reset the UI's index record |

## 5. Design fixes

All 79 rows, by spec section. Status:

- **Prose:** blocks nothing. The build already does the right thing; the spec text needs updating when it moves past v1.4.
- **Decide:** needs a call from you.
- **Closed:** already landed.

**mvp-spec 1 (published data)**

| # | Gist | Status |
|---|---|---|
| 420 | Private figures are estimate bands, not "?" (your ruling) | Prose |
| 422 | Industries with one or two private companies show banded totals (your ruling) | Prose |

**mvp-spec 2 and 3 (data and model)**

| # | Gist | Status |
|---|---|---|
| 7 | `startup-events.csv` and `names/` are built, not "to build" | Prose |
| 11 | All 296 characters load | Prose |
| 200 | About 3,200 board seats at load, not 2,700 | Prose |
| 202 | The seat is picked before the character's best skill | Prose |
| 203 | The management score reads drawn skills plus the shifts only | Prose |
| 220 | Statements need lines for the undrawn fee, sale gains, tax payable and the estate | Prose |
| 421 | Daily bars store the day's EFV | Prose |

**mvp-spec 4 (the tick)**

| # | Gist | Status |
|---|---|---|
| 9 | Controls apply at once, not at step 1 | Prose |
| 102 | The monthly job closes the month just ended with that month's growth | Prose |
| 104 | Name the steps for the compute bill (5) and management score (10) | Prose |
| 106 | The close pays the quarter's tax, then builds the statements | Prose |
| 107 | Drop 5.11 from step 9 | Prose |
| 205 | Use 5.9's wording for free R&D timing in 4.3 | Prose |

**mvp-spec 5 (economy, finance, market, births)**

| # | Gist | Status |
|---|---|---|
| 100 | Argentina's mid-Overheating spread is 364 bps, not 307 | Prose |
| 101 | Russia has an own shock too | Prose |
| 204 | Say which held-TB level 7.1 sets | Prose |
| 206 | Add 50/50 stations to the drop order | Prose |
| 207 | The barebones company's shared costs are $6,600, not $7,000 | Prose |
| 221 | Starting lines over their 5.12 limit (decided at the M3 gate by D15; prose in fix 225) | Prose |
| 222 | Define interest cover, EBITDA at 0, band edges and notches | Prose |
| 223 | Excess repayment instalments, and what happens after 3 months | Prose |
| 224 | Frozen quarters and the removal order | Prose |
| 232 | A small profit to a small loss can lift value by up to 40% of book | Decide |
| 233 | Write the pull as V* ÷ P; momentum move is post-MVP | Prose |
| 234 | The observer's range centres on the consensus | Prose |
| 240 | Every Tech startup is born CC (see D271) | Decide |
| 242 | A lone founder holds all 60% | Prose |
| 244 | Headline texts and "five of each" | Prose |
| 361 | e is ±15% (your M10.7 sign-off) | Prose |
| 362 | The IPO test is $75M TTM revenue; redo the 5.20.1 sanity line (your M10.7 sign-off) | Prose |
| 368 | Late in a quarter the shown range is narrower than e | Decide |
| 830 | The startup HQ weight's floor rule, and the same weight for founders' homes | Prose |

**mvp-spec 6 (Lite AI)**

| # | Gist | Status |
|---|---|---|
| 103 | The plan at load is the 6.3 rule | Prose |
| 105 | Archetype ties go by table order (your ruling, 2026-10-21) | Prose |
| 108 | Productivity slides under the Lite AI (answered by D360) | Prose |
| 241 | Oversupply penalty is 1 point per 1% (your ruling); 6.2 text still to change | Prose |
| 243 | The draw row reads cash on hand | Prose |
| 360 | The productivity adj is +0.5 below 100 (your M10.7 sign-off) | Prose |

**mvp-spec 7 (starting world)**

| # | Gist | Status |
|---|---|---|
| 4 | Companies founded in play follow 5.19.4, not "barebones with a CEO" | Prose |
| 201 | The PC bonus never settles for three ~$42B companies | Prose |
| 225 | Starting line sizing and the new counts (D236, D241) | Prose |
| 226 | 31 companies start CC; two start with $0 cash and fail at once | Decide |
| 235 | The first release moves V a lot (−14% to +66%) | Decide |

**mvp-spec 8 and 20-ui (screens)**

| # | Gist | Status |
|---|---|---|
| 300 | News is on the rail (key N) | Prose |
| 301 | List the World event alert | Prose |
| 440 | Describe the tiling workspace and the extra pages | Prose |
| 441 | Pick one band form for the docs | Decide |
| 442 | Add the workspace keys to 20.2.6 | Prose |
| 460 | The Board tab shows votes, never odds | Prose |
| 461 | Name which "confidence" the Overview shows | Prose |
| 480 | Name the MVP's F2 lists | Prose |
| 481 | F9 uses M as the price index | Prose |
| 800 | Add Quarter start (Pause); Plan lock defaults to Pause | Prose |

**mvp-spec 9 (API)**

| # | Gist | Status |
|---|---|---|
| 8 | Add alert, Omniscient and watchlist controls | Prose |
| 10 | Give pauses a reason and alerts a level | Prose |
| 462 | Add index history to `get_exchange` | Prose |

**mvp-spec 10 and build-plan (targets and checks)**

| # | Gist | Status |
|---|---|---|
| 109 | Hold S, M and productivity in the projection (your ruling) | Prose |
| 320 | The demand growth target cannot be met as written (answered by D365) | Prose |
| 363 | Two revenue and demand targets replace one (your rulings) | Prose |
| 364 | Bust band 8% to 22% (your sign-off) | Prose |
| 365 | Demand growth pooled over industry-runs (your sign-off) | Prose |
| 366 | Cloud's waiver (your rulings) | Prose |
| 367 | Bankruptcies nearly stop in the 2040s; should spec 10 set a floor? | Decide |
| 369 | macOS and Linux are untested | Decide |
| 574 | The leak test uses an Omniscient twin; say "bands", not "?" | Prose |

**12-tech-and-roadmap**

| # | Gist | Status |
|---|---|---|
| 5 | Notice names should match 9.3 | Prose |
| 6 | The table widget landed in M7.7 | Prose |

**Map docs, province counts and data files**

| # | Gist | Status |
|---|---|---|
| 1 | data/README: `fixed_cost_rate` is 0.38 to 0.449, not 0.37 | Prose |
| 2 | data/README: borrowing uses the home spread | Prose |
| 3 | data/README: keep one G clamp (D260 took batch 160) | Prose |
| 600 | Natural Earth is v5.1.2; drop geo-rasterize | Prose |
| 601 | 31 North American coastal flags disagree with the bitmap | Decide (data review) |
| 670 | Karamoja: move UG-0008 to Northern, or say so in its notes | Decide (data) |
| 820 | Say 3,963 provinces everywhere; state the cap and the split rules | Prose |

**Tools**

| # | Gist | Status |
|---|---|---|
| 208 | validate.py's held-TB floor and uncapped enterprise stations | Decide (a small tool fix) |
| 230 | gen.py's engine value G | Closed (PR #13, D239) |
| 231 | gen.py's Real estate floor and rounding | Closed (PR #13, D240) |

## 6. Open items outside the logs

| Item | Where it is recorded | What is needed |
|---|---|---|
| **macOS and Linux untested** | design fix 369, release.md | Build and run both binaries there, or accept Windows-only for the MVP. Cross-OS hashes are post-MVP |
| **Speed 5 is a known FAIL, not gated** | D779, D805, D806, m8-checks.md | Two focused 60 s runs on a quiet machine. Left undone: the plan lock clones the whole world (1.2 to 1.5 ms); the frame that ends in an auto-pause runs about 22 ms |
| **Province split phase 2** | D820, PR #47 and #48 | Phase 1 cut only provinces over 250,000 km². Provinces between the cap and 250,000 km² are still whole. No count of them is logged. Only 132 ids are spare under 4,095, so phase 2 needs the colour table (`MAX_MAP_PROVINCES`) raised |
| **Compass names** | D823, PR #47 and #48 | 217 new parts have compass names, 72 numbered, mostly in Russia and the Sahara |
| **The border grid pattern** | D850 to D856, PR #50 | Look at the previews. 29 cuts stay straight; straight survey ADM2 lines are kept. More river borders would need looser size rules or a finer river source |
| **Karamoja** | design fix 670 | UG-0008 sits in Eastern; Uganda counts Karamoja in Northern |
| **Provenance-risk boundary files** | D685, each region's QA licence notes | Files that pass their licence but name a risky source: Wikimedia (AGO, CRI, CZE, DNK, ISR, JOR, NPL, PAK, SWE) and citypopulation.de (KOR, MYS, NER). Accept, or swap them out |
| **Your hands-on map check** | m8-checks.md ("Pending Logan") | Pan, zoom, modes, picking, panes over the map, province links |
| **Your hands-on workspace check** | m9-plan section 6 | Not recorded as done: links, back and forward, command bar, layouts, columns, density |
| **Coastal flag differences** | design fix 601, m8-checks.md P8 | 218 rows across the world differ from the bitmap; the CSVs stay the source |
| **Split giants' leftovers** | PR #47 and #48 | US-0004 is still "Fairbanks-North Slope" though its oil is now in US-0163 Prudhoe Bay. Manzhouli (CN-0120) kept the development over Hailar (CN-0163) |
| **Dormant share raises** | D266 | No industry burns cash, so 6.6 share issues never happen in play |
| **Spec text past v1.4** | section 5, "Prose" rows | One spec pass to fold in the prose fixes and your rulings |
| **Self-contained release** | release.md | The binaries read data from the checkout. Carrying data beside the binary is post-MVP |

## 7. Checklist

- [ ] Section 2: nothing to do (92 rows already yours)
- [ ] Section 3.1 sim and economy: sign off, or revisit D266 and D271
- [ ] Section 3.2 views and estimate bands: sign off
- [ ] Section 3.3 UI and workspace: sign off
- [ ] Section 3.4 map pipeline and provinces: sign off, or revisit D823 (names), D825 (text) and D850 (survey lines)
- [ ] Section 3.5 benches, checks and build: sign off, or revisit D693 and D805
- [ ] Section 4: skip the 5 superseded rows
- [ ] Section 5: rule on the "Decide" design fixes: 208, 226, 441, 232, 235, 240, 367, 368, 369, 601, 670
- [ ] Section 5: plan the spec pass for the "Prose" design fixes
- [ ] macOS and Linux: build them, or accept Windows-only
- [ ] Speed 5: gate it after quiet-machine runs, or keep it reported only
- [ ] Province split phase 2: go or no go (and raise the colour table if go)
- [ ] Compass names: accept them, or ask for hand names
- [ ] Organic borders: accept them, and say whether straight survey lines stay
- [ ] Karamoja: pick a region for UG-0008
- [ ] Provenance-risk files: accept them, or ask for replacements
- [ ] Try the map by hand
- [ ] Try the workspace by hand
