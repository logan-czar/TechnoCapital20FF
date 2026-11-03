# 1995 rework: spec

A second starting world, opening on 1 January 1995, that resembles the real world in its dominant industries, its dominant companies and its US politics. From there the sim generates its own political and economic history through to 2020, under one of three scenarios: stable growth, unstable growth or stagnation.

New code cites this file by section ("1995-rework 4.2"). Choices made where it is silent go in [decisions.md](decisions.md) from D990. Prose conflicts with the design docs go in [design-fixes.md](design-fixes.md). This file lives in `docs/build/` because `scripts/sync-design.sh` replaces `docs/design/` wholesale.

Decided with Logan in the planning interview of 1 November 2026. Numbers marked (T) are starting values for tuning, and calibration may move them.

## 1. Scope

**In scope:** the 1995 world's data; negative-hour clock; world manifest and loading; dynamic GDP and policy rate; zone growth tracks; dormant sectors; three scenarios plus Random; US political evolution with small policy levers; character spawn, aging and heirs; a World History page; end-of-run reveal; a watchable speed with auto-pause; headless calibration.

**Not in scope (named follow-ups):** deleting the 2020 world; renaming `world_size_2020_*`; M&A; a shock catalog; inflation; FX; commodities; border handovers; regional demand; regime switching inside a run; switching worlds inside a game; laws as objects.

The MVP rule stands: the player watches, and companies are run by the lite AI.

## 2. World

### 2.1 Start and end
- The game opens paused at 1 January 1995, 00:00. Tick is hours since the 2020 epoch, so the start is −219,144 (3.1).
- A run has a `reveal_date` of 1 January 2020 (8.3). Nothing after it is calibrated.

### 2.2 Scale
- World GDP about $31T, the real 1995 figure.
- About 300 named companies, covering the Global 500 leaders per sector, mid-caps and regional champions.
- Fewer countries: micro-territories and post-1995 states fold into their 1995 parent by reassigning province rows and dropping the country rows. All 3,963 province ids and all map assets stay. Puerto Rico stays its own country row, because the politics checks read every USA province's `region` as a state.
- No border changes during a run. Remaining anachronisms are logged as design fixes.

### 2.3 Names
- Companies are fictional analogues of real firms. The real analogue is recorded only in authoring data (`tools/world-1995/authoring/`) and must never reach a game CSV, which `validate.py` enforces.
- All politicians are generated. No real person is named in the game.
- Parties remain Democrats and Republicans (D981).

### 2.4 Sectors
About 57 rows, of which about 47 are live at the start.

| Group | Rows |
|---|---|
| Added, live | computer hardware; media and publishing; consumer staples and tobacco; conglomerates and trading houses; capital goods; rail; paper and forest; apparel; appliances; travel and leisure; online services; wireless; biotech; medical devices |
| Added, dormant | search and portals |
| Existing, dormant | e-commerce; renewables; data centers; SaaS; social media; cloud; EVs; drones; AI labs |
| Existing, live | the remaining rows of today's 42 |

Live rows are above today's 42. What shrinks is the 2020-era tech set, not the row count (Logan chose both "fewer industries" and every added group; reconsider during real-data work if the table feels crowded).

`cycle_beta`, `volatility`, `rate_sensitivity`, margins and cost shares differ by sector in this world, unlike the MVP defaults. Sunset sectors (media and publishing, computer hardware, paper, rail) have flat to negative trend.

### 2.5 Data sourcing
- Top ~100 companies and the 33 major countries: public sources, within about 20%, with a citation in the authoring row.
- The rest: generated or scaled from sourced totals.
- Countries: `tools/world-1995/authoring/` holds 1995 GDP and population for every economy the World Bank covers. The 33 majors' tax rates and ratings there are approximate (D1005).
- Companies: about 135 real firms at their 1994 sales, under fictional names, of which 30 are read from a 1995 reprint of the Fortune list and the rest are from memory, marked as such (D1006). The other firms are the 2020 data's, resized to their country's 1995 economy.
- Debt: each firm starts with its industry's typical net debt in years of EBITDA (`industry-leverage.csv`, from memory), spread by a hash of its id. Its book value is lowered to match, so the 2020 rule (7.1, D15) draws that debt as a line, capped at the 5.12 limit (D1010). The same table is what firms pay out toward through the run (9, D1012).
- Provinces: the 2020 data's, except about 40 that changed most by 2020 (China's coastal boom districts and new areas, India's IT and car corridors, the Gulf's newer districts), which take 1995 commerce, industry and population scores from memory (D1010). The scores rank provinces within a country, for startup sites and the map.
- Country scores (wealth, state security, legislature, judiciary, restriction) keep the 2020 data's values. Nothing in the sim or the UI reads them.

## 3. Clock and loading

### 3.1 Negative hours
Keep the 2020 epoch. `DateTime` is a whole number of hours and may be negative. Moving `EPOCH_YEAR` would change every 2020 digest; a per-world epoch would need threading through pure helpers called without a world.

The start of a world is `world.clock` at load, and nothing else is pinned to 2020:
- The synthetic history year is the start year − 1 (finance).
- First IPO votes fall in the start year (births).
- Stock bars and index histories start on the start date (market).
- The fade counts from the world's start. Until a world carries its start (6.1), `years` is floored at 0, so a pre-2020 clock never inflates a trend.

Web and headless text that says "2020" reads the start year from the `history` view, added with the era state (8.1). The web keeps its literals until then.

### 3.2 World manifest
`assets/worlds/<id>/manifest.json` plus CSVs of the same names as `WORLD_FILES`, and era tables `industry-lifecycle.csv`, `character-spawns.csv`, `politics-usa-era.csv`, `zone-growth.csv`, `industry-leverage.csv`.

```
{ id, start_date, reveal_date, base_rate, neutral_rate, y10_term,
  expected_counts, cabinet_seats,
  features: { era, ai_boom, fixed_events, arrowhead },
  scenarios: [...] }
```

- The 2020 world has an implicit `MANIFEST_2020`. `docs/design/data` and its checks don't move.
- One world per worker, with no switching inside a game. A save refuses a world mismatch.
- The 1995 world has `ai_boom: false`, `fixed_events: false`, `arrowhead: false`.

### 3.3 Era state
All new sim state sits under one optional `world.era`. The canonical hash skips `undefined`, so 2020 is unaffected. A new RNG stream `Era` (number 6) is appended, and existing stream numbers don't change. The projection clone strips era history, characters and politics, and keeps macro, sectors and scenario.

## 4. Scenarios

### 4.1 Selection
The new-game screen offers Stable, Unstable, Stagnation and Random. Under Random the seed picks on the Era stream and the name stays hidden until the reveal (8.3). A scenario is fixed for the whole run.

### 4.2 Definition
A scenario is code, in `economy/scenarios.ts`, following D978's rejection of a data table. `ScenarioSpec` extends `EconomyProfile` (`lt_scale`, `volatility_scale`, `cycle_scale`, phase tables) with macro coefficients, `emergence_shift`, `track_sd` and `startup_mean`. It is copied into `world.era.scenario`, so saves carry it.

Crises are expressed only through scenario phase tables, with generic recession headlines (no shock catalog).

`lt_scale` multiplies an industry's trend, except for an industry that fades (a half life above 0): a young market's path is its own, so a faster economy does not compound its 60% years.

### 4.3 Calibration targets
Checked in `apps/headless/src/targets-1995.ts`, windows 1995–2019, across seeds.

| Scenario | 2020 world GDP | Character |
|---|---|---|
| Stable | $70–100T | Tech leads; a catch-up zone rises; mild recessions |
| Unstable | $50–110T | Deep drawdowns and more failures |
| Stagnation | $45–60T | Low rates and little entry |

Also bands on sector shares, drawdown depth, failures, entries, zone-share movement, top-10 market-cap turnover, born firms in the top 10, and changes of the presidency's party and House control, from 1995 to 2020. Scenarios must separate clearly. Real-world reference: nominal world GDP from about $31T to $85T, about 4.1% a year.

## 5. Dormant sectors

### 5.1 Lifecycle
`era.sectors[id] = { status, emerge_quarter, target_size, wave, wave_pending }`.

Each dormant row has a window, and the seed picks a quarter inside it, plus the scenario's `emergence_shift`. Draws happen at load in id order on the Era stream. Initial windows (T):

| Sector | Window | Sector | Window |
|---|---|---|---|
| e-commerce | 1995–1998 | social media | 2002–2008 |
| search and portals | 1996–2000 | cloud | 2004–2010 |
| data centers | 1997–2003 | EVs | 2006–2012 |
| renewables | 1998–2006 | drones | 2008–2014 |
| SaaS | 1999–2005 | AI labs | 2012–2018 |

### 5.2 While dormant
Size is zero and no company sits in the row (the load-time checks enforce both). S and M are held at 1, the label is forced to Normal, the startup weight is zero, and web hides the row. Growth draws continue, so the Growth stream does not depend on emergence.

### 5.3 Activation
On `emerge_quarter`, the row takes its `target_size` (demand, trend and fringe), posts a headline and raises a `NewSector` alert. At the next plan lock a founding wave of startups appears through the existing `hqCandidates` and `fireEvent` path. `sizedRevenue`'s 2% cap takes a wave parameter, because 2% of a $2B sector gives only $40M companies.

## 6. Macro

### 6.1 GDP
`GDP = K × Σ ind.demand`, with K fixed at load. GDP is derived and never a second driver, so calibration bands are bands on demand growth. The gap is this quarter's growth above the long-term rate, a year, weighted by demand. A level gap (`Σ demand_core / Σ trend_demand − 1`) drifts for good, because demand does not revert to trend (D995).

### 6.2 Policy rate
`base += SMOOTH × (neutral + a × gap + b × g_t + bias − base)`, floored at a named constant. `world.base_rate` is the policy rate, so credit lines and cash interest follow with no new wiring. The rate also feeds:
- Demand, through the existing `rate_sensitivity × (base − neutral)` term.
- Discount rates, through `y10` and `rateFactor` taking a world `y10Base` (`base_rate + y10_term`). The 2020 world keeps `Y10_BASE`.
- Zone credit spreads, through an era-only term in `setZoneSpreads`.

Money is nominal. No inflation variable.

### 6.3 Quarter-start order
`economy.cycle` → `era.policy` → `era.macro` → zone spreads → growth draws. All sit outside `PROJECTION_SLOTS`.

### 6.4 Zone growth tracks
Each year each zone's relative growth is `catchup × track + AR(1)`. A zone's track is its row in `zone-growth.csv`, the real 1995–2019 change in its share of world GDP as log growth a year, moved by a seeded draw of up to `ZONE_TRACK_SPREAD` either way and fixed for the run. The scenario's `catchup` plays it out: 1 in Stable and Unstable, half in Stagnation. Shares renormalise, countries scale within their zone, and `cycle.z_avg` is recomputed. Poverty alone did not predict 1995–2019 (China, India and East Africa rose; Southern Africa and Latin America did not), so the track is data, not a function of GDP per head.

Effects: GDP shares; startup location, where each country draws by its GDP now and its provinces share that by their own weights; zone indices, through an optional `zone_tilt` on `PlanInputs`, so companies in a rising zone grow assets faster. Supply self-corrects. Industry demand stays global.

## 7. Politics and characters

### 7.1 Calendar
Election years and Senate classes are anchored at 2020 and extend in both directions: 1996 is a presidential year with class 2 up.

### 7.2 Start
- Democratic first-term president (a generated person), elected 1992.
- The 104th Congress: per-state Democratic seat counts from data (205 D counting Vermont's independent, 230 R; 47 D, 53 R), with each state's most Democratic-leaning districts holding its Democratic seats and a split state's Democrat in a drawn Senate class. The 104th sits from 1 January, two days ahead of the real 3 January.
- 1990-census seats and 1992 state leans, each lean taken against the national margin (D998). 14 departments (no Homeland Security).
- A state's vote weight is its people, from the 1990 census, growing each year at its own rate plus a small shock.
- Names in office are unique, from a wider name book than the 2020 world's.

### 7.3 Lean drift
Each 1 January: `Δ = REGION_SD × z_region + STATE_SD × z_state`, applied to the state and its districts. Realignments differ by run and need not match the real ones.

Each November's national swing also carries a tide against the president's party, in this world only: a midterm penalty, and at a presidential vote a fatigue for each term beyond the party's first two (D1007).

### 7.4 Reapportionment
1 January 2001 and 2011: equal-proportions seats (435 in total, minimum 1 per state) from the states' people. They apply at the next November vote's races and at the following 3 January's handover. Holders match by `(state, number)`, and a member whose seat is gone leaves. Supersedes D982's "no reapportionment" for this world.

### 7.5 Policy levers
Quarter start. The president and chamber control set the step: unified moves at full step, one split chamber at a slow step, both opposed freezes. The levers move toward party targets, with a lag:
- `USA.corp_tax_rate`
- A fiscal push: `demand_mult = 1 + fiscal × US share`
- `rate_bias` in 6.2

No bills or laws as objects. Supersedes D980's one-way link for this world.

### 7.6 Ideologies
A 1995 subset is active, and others emerge in seeded windows (`era.politics.ideologies[i].from_year`), ramping bloc weights in `drawPerson`. The `Ideology` union stays; 1995 labels are display names, which the politics view hands to web (D999).

### 7.7 Character spawns
No scripted events. Each character in `character-spawns.csv` has a spawn-year range, and the seed picks the year. A spawned character joins a queue. The next startup fitting their region and sector, founding waves included, takes them as controller, with half the seed investors' block, and its plans read their traits (D1001). If nothing ever fits, they never appear in a company. John Techno is one such row, fitting any sector in North America, and Arrowhead stops being a fixed company.

### 7.8 Aging and heirs
Base characters age each 1 January and roll age-based death: 1% a year at 60, doubling every 8 years. On death, a new heir from the HQ country's name book takes the same stake, with a headline. No succession politics. Executives remain board filler. Amends D988 for this world. Each CH- id controls exactly one company, because per-company copies would die independently.

## 8. UI

### 8.1 World History page
`pages/kinds/world-history.tsx`, on a new `history` view backed by `era.history` (yearly series kept for the whole run; existing short rings stay):
- Long-run charts: world GDP, policy rate, top sectors, zone shares. A chart's lines take five chart-only series colors, the theme's hues stepped to pass the dataviz checks on the chart surface (D1010). Values above $1T are drawn in millions and labelled in dollars, because the chart library rejects values beyond about $90T (D1010).
- Chronology: presidents and Congresses, sector emergences, recessions, major failures.
- Top-10 snapshots every 5 years.

### 8.2 Speed and auto-pause
A new speed of about one game year per real minute (`60 / 8760` s per tick), so a run takes about 25 minutes. Toggleable auto-pause through the existing alert system, with new kinds `Election`, `NewSector`, `Recession`, `MajorFailure`. Era worlds default the calendar alerts to Log, since a quarterly pause would stall this speed.

### 8.3 End of run
At `reveal_date` the sim pauses, whatever the alerts or a skip say, opens the World History page and shows the scenario. The player may continue, with an "untuned" notice. A save loads only in the world that wrote it.

### 8.4 Hidden scenario
No view carries the scenario id or label before the reveal under Random. `history.scenario` is null until then, unless picked openly. A leak test checks every serialised view.

## 9. Corporate turnover
Sector lifecycle plus tuned failures. No M&A. Top-10 market-cap turnover is measured (4.3). Seven rules apply in an era world only, because calibration showed the MVP's rules leave named firms insulated (D996):

- **Sticky fringe.** The fringe grows on the long-term rate and closes 8% of its gap to demand a month. The spec 5.3 fringe shrinks in step with demand and takes the whole shock, so a downturn never reached a named firm. In a young industry (a half life above 0) it grows on the mature rate, so newcomers, not the fringe, take a new market, and still closes 8% of its gap a month (D1009).
- **Exit rule.** The drift plan's: a firm exits as a bankruptcy after 12 straight losing quarters, or below $0.5M of assets, unless it is its industry's last. The AI otherwise sells down and lives on its cash for good.
- **Credit squeeze.** A contraction withdraws a scenario share of each line's limit at its review.
- **Growth.** A firm under its hurdle follows its market's growth, where spec 6.2 holds it at 2% whatever its market does, and the growth ceiling is 70%, not 30%.
- **Shortage.** A firm in a short market adds `0.4 × clamp(1 ÷ S − 1, 0, 1)` to its market's growth, the mirror of 6.2's oversupply term (D1009). Without it a new market that opens short stays short, with M at its cap, for a decade.
- **Dividends.** A firm rated BBB- or better pays its 5.17 dividend while cash on hand, not own cash, stays above min_cash (D1011). Under 5.17 a firm with any net debt has no own cash, so it paid nothing until it held net cash, which 5.12 rates AAA.
- **Leverage target.** A firm rated BBB- or better whose net debt, after the quarter's planned purchases, is under its industry's `net_debt_ebitda` × TTM EBITDA pays a quarter of the gap with its dividend: from cash above min_cash, then by drawing its line up to 60% of the limit, and it keeps its line rather than repaying (D1012). It stands in for buybacks, which the sim does not have. Startups, Cautious or Greedy controllers and Distressed firms do not. Without it mature firms keep most of their profit, drift to net cash, and half of them rate AAA.

How a firm born in the run reaches the top 10, in order of what each one unblocked (D997):

- **Scale-up financing.** An Active firm in a hot market (g_dem at or above the scenario's floor, label not Bust or Glut) whose funding cap holds its plan back sells shares for four quarters of what is held back. It is the 6.6 share issue, with its price, 20% dilution cap, fees and success roll. A failure only leaves the plan as it was. Logan chose this on 1 November 2026, over moving to P5 and leaving the top-10 gap for real data to close.
- **Earnings multiples.** Each row takes its design valuation group (mvp-data `PE`), which the MVP left at one value for all. Young markets are at 40. Without this a bank outvalues any growth firm.
- **Listing.** A board's yes chance gains `min(60%, 20% × log10(TTM revenue ÷ $75M))`, since at 15% a $20B firm stayed private and could not count.
- **Capture.** A hot market's firms plan to grow `0.25 × fringe share` above the market, until a firm holds 15% of its market's supply. Firms that only follow their market keep their share, and a market of trillions stayed 97% fringe; with no limit, one firm took half of e-commerce.

M&A remains out of scope.

## 10. Build order

Each is a PR cut from `main` as `build/1995-<slug>`, passing `scripts/check-ts`.

| PR | Contents | 2020 digests |
|---|---|---|
| P0 `epoch` | This spec, negative hours, politics calendar, derived sim and headless anchors | Unchanged |
| P1 `manifest` | Manifest, loaders, checks, web serving, proto data, 25-year proto run | Unchanged |
| P2 `era-scaffold` | `world.era`, Era stream, save v3, `history` view, `--world` and `--scenario`, `era.csv`, targets skeleton | Re-recorded once |
| P3 `macro` | Scenarios, GDP, rate, spreads, y10, zone tracks | Unchanged |
| P4 `sectors` | Lifecycle, activation, waves, new rows, sector params | Unchanged |
| P5 `politics` | Start composition, drift, census, levers, ideology | Unchanged |
| P6 `characters` | Spawn queue, aging, heirs, cap table fix | Unchanged |
| P7 `ui-controls` | Speed, alerts, new-game picker | Unchanged |
| P8 `world-history` | Page, reveal, untuned banner | Unchanged |
| P9a, P9b `real-data` | Sourced countries and fold; then 300 companies with citations | Unchanged |
| P10 `calibrate-flip` | Tune to bands, flip the default world | Unchanged |

**P2's re-record** must show in its commit message that all view digests other than the moved monthly and patch digests are unchanged, and that the economy columns of a 10-year soak are identical.

**The default flips** when 20 seeds × 3 scenarios are all MET, the 1995 suite and leak test pass, and a manual browser run reaches 2020 at the new speed. With no world named, the web app and headless then play 1995; `?world=2020` and `--world 2020` play the 2020 world until it is retired, and the mock sim stays on it.

P3–P6 bands against proto data are smoke tests. The real tuning is P10, on real data.

## 11. Design conflicts to log

- `19-history.md`'s year-by-year 2000–2019 rulings don't bind this world.
- `7-starting-world.md` and `12-setup-and-score.md` describe one scenario with no setup choices.
- `5-ideology.md`'s 2020 mix doesn't apply at the 1995 start.
- D980, D982, D987 and D988 are amended for this world only (7.2, 7.4, 7.5, 7.8).
