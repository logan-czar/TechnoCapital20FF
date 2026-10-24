# The 30-year soak and the target checker

Build-plan M10.1 to M10.3 and 4.4: the headless runner plays many seeds from the 2020 start state through the public `Sim` API and `SimViews` only (spec 9), writes one row per seed per year and per seed per quarter, and a checker marks every spec 10 target per seed. Code: `crates/headless/src/metrics.rs` (the rows), `soak.rs` (the runner), `targets.rs` (the checker). Choices where spec 10 is ambiguous are D320 to D334 in [decisions.md](decisions.md).

## Running it

```
cargo build --release -p headless
target/release/headless soak --years 30 --seeds 1..50 --out soak-out --check
target/release/headless check soak-out
```

| Flag | Meaning | Default |
|---|---|---|
| `--years N` | Years from 1 January 2020 (the run stops at 1 January 2020 + N, 00:00) | 30 (to 2050) |
| `--seeds A..B` | Inclusive seed range, or one seed `A` | `1..50` (build-plan 4.4, 50 seeds) |
| `--jobs N` | Seeds run at once | half the machine's cores |
| `--out DIR` | Output directory (created) | required |
| `--check` | Run `check DIR` after the soak | off |
| `--detail` | Also write the read-only detail tables (below, D900) | off |
| `--data-dir DIR` | Data tables | `docs/design/data` |

Each seed is its own single-threaded, deterministic `Sim` in its own child process (`headless soak-seed --seed S --years N`, an internal command); the parent runs `--jobs` children at a time and writes their rows in seed order (D333). The sim itself never runs threads.

If a seed fails (its child exits non-zero), the seeds that ran are still written and `soak` exits non-zero, listing every failed seed with its error; `--check` is then skipped.

`soak` writes three files:

- `years.csv`: one row per seed per year, seed then year order.
- `quarters.csv`: one row per seed per calendar quarter, seed then quarter order.
- `timing.csv`: one row per seed: `seed, years, ticks, wall_ms` (the seed's run from `Sim::new` to the last tick) and `ms_per_year`.

**Determinism:** the same seed range and years give byte-identical `years.csv` and `quarters.csv`, whatever `--jobs` (tested by `crates/headless/tests/soak.rs`, which runs 2 seeds × 1 year twice with different job counts). Wall time is only in `timing.csv`. Every view is read in id order; nothing iterates a hash map; seeds are written in ascending order.

`check DIR` reads `years.csv` and `quarters.csv` and writes:

- `targets.csv`: `target, seed, result, measured, bound`, one row per target per seed (targets in the order below, seeds ascending). `result` is PASS, FAIL or NA (the run does not cover the target's window, for example a 1-year run and a year-10 target).
- `summary.csv`: per target the seeds evaluated and passed, the pass share, the required share, the verdict (MET, NOT MET, WAIVED, n/a), and the min, median and max of the measured value over the seeds (the leading number of `measured`; for `industry_revenue_demand`, `industry_revenue_demand_cloud_waived` and `industry_demand_trend` the worst `|ratio − 1|`, for `demand_growth_pooled` the seed's share of industries within 3 pp, for `full_characters_per_decade` the decade count farthest from 200, for `cast_sizes` the number of casts, for `named_companies` the highest count). For the pooled target `demand_growth_pooled` (D365) "evaluated" and "passed" count industry-runs over all seeds, not seeds. A waived target (D366, D368) is reported per seed but its verdict is WAIVED, never MET or NOT MET.

It prints the summary. It exits 0 whatever the verdicts (it is a report, not a gate).

`run --years N --seeds A..B [--out file] [--hash-monthly]` is the one-process M1.8 runner: it writes the same yearly table (no quarters) and can print the state hash after each month.

## When rows are written

- A **year row** for year Y is written at the December close: the 1 January Y + 1, 00:00 tick, after the monthly, quarterly (the Q4 close) and yearly jobs of that tick. "At the 2029 close" means 1 January 2030, 00:00: ten years from the 1 January 2020 start.
- A **quarter row** for quarter Q is written at the close of Q's last month (1 April, 1 July, 1 October, 1 January, 00:00).
- Births and IPOs happen at the plan lock on the 9th of a quarter's first month; releases at 00:00 on the 2nd (spec 4.4).

## years.csv columns

| Column | Meaning |
|---|---|
| `seed`, `year` | The seed and the calendar year the row closes |
| `ticks` | Hourly ticks run in the year (8,784 in a leap year) |
| `state_hash` | `Sim::state_hash` at the close (build-plan 4.3) |
| `phase`, `g_t` | The global cycle phase and g_t at the close (spec 5.1) |
| `named_revenue_usd`, `fringe_revenue_usd` | The year's revenue of the named units and of the fringe, all industries, summed over the twelve month closes |
| `mean_s`, `min_s`, `max_s`, `mean_m` | S across the 42 industries and the mean M at the close (spec 5.2) |
| `mean_productivity`, `mean_management` | Mean unit productivity and mean management score over every unit and company (spec 5.6, 5.7) |
| `data_tb` | Data held plus unstructured over all companies, TB (spec 5.9) |
| `profitable_share` | Companies whose units' EBIT after R&D is above 0 in the December month |
| `distressed_in_year` | Companies seen Distressed at any month close of the year |
| `distressed`, `bankrupt`, `removed` | Companies with that status at the close (spec 5.12) |
| `bankruptcies_in_year`, `removals_in_year` | Bankruptcies and removals dated in the year or at its 1 January close |
| `active_share` | Active companies over every company in the table |
| `line_drawn_usd` | Credit lines drawn, all companies |
| `ratings` | Companies not frozen per rating band, `AAA:n\|AA:n\|...\|CC:n` |
| `quoted`, `median_gap`, `tracking_share`, `mean_confidence`, `index_atx` .. `index_ese` | The M5 market figures (D143, D144): quoted count, median `\|P ÷ V − 1\|`, the year's share of quoted company-days within ±30%, mean zone confidence, four headline index levels |
| `events_in_year`, `startups_in_year`, `ai_lab_startups_in_year` | Startup events and born companies by date in the year; born companies in the `ai_labs` industry (D166, D328) |
| `listings_in_year` | Listings in play by listing date (the 467 listed at load are not listings, D328) |
| `start_private_listed` | Starting (origin Start) companies listed in play so far (D334) |
| `named_companies` | Companies not Removed at the close: the 651 and the born, Bankrupt ones included (D166, D329) |
| `start_active_share` | The 651's share with status Active (D166) |
| `start_alive_share` | The 651's share neither Bankrupt nor Removed: Active or Distressed (D320) |
| `beat_share`, `miss_share` | Over the reports of the releases dated in the year, the share tagged Beat or Big beat and Miss or Big miss (D166) |
| `boom_share`, `bust_share` | Over the labels set at the year's twelve closes, the share Boom and Bust (D166; the checker reads `quarters.csv` instead, D325) |
| `m_clamp_over_8q`, `max_m_clamp_quarters` | Industries whose M clamp run (below) has ever passed 8 quarters, and the longest run so far, any industry |
| `full_characters_made` | Full characters made in play so far (spec 3.7.2) |
| `full_characters` | Full characters in the world: the 296 and those made (D332) |
| `median_productivity` | Median productivity of the units with gross assets above 0 of companies not frozen, mean of the middle two for an even count (D321) |
| `demand_dev_max_pp`, `demand_dev_out` | Per industry, `\|CAGR(demand) − CAGR(trend demand)\|` from load to this close in percentage points; the largest, and how many industries are above 3 pp (D324) |
| `casts_in_year` | Companies born in the year (each cast read at its birth, D326) |
| `cast_full_min`, `cast_full_max` | The fewest and most founders (full characters) of a cast born in the year; empty with no birth |
| `cast_simple_min`, `cast_simple_max` | The fewest and most simple characters cast at a birth in the year: simple seat holders plus simple directors (D326) |
| `born_empty_seats_max` | The most open labor seats with no holder seen in the year among born companies not frozen, at each birth and each month close (D326) |

## quarters.csv columns

| Column | Meaning |
|---|---|
| `seed`, `year`, `quarter` | The seed and the calendar quarter (1 to 4) |
| `released` | The quarter whose results were released in this quarter (`2019Q4` in Q1 2020) |
| `reports`, `beats`, `misses` | That release's reports (companies not frozen with a quarter, D166, D323) and how many were tagged Beat or Big beat, Miss or Big miss (D249) |
| `industries` | Industries (42) |
| `industry_months` | Industry-months in the quarter (42 × 3) |
| `boom_months`, `bust_months` | Of those, the months run under a Boom or a Bust label (D325) |
| `rev_ratio_min`, `rev_ratio_max` | Across industries, the lowest and highest quarter revenue ÷ trend revenue (D322) |
| `rev_out_of_band` | Industries whose ratio is outside 0.70 to 1.30 |
| `m_clamp_industries` | Industries at an M clamp (M at 0.7 or 1.3) at the quarter's last month close (D166) |
| `m_clamp_max_run` | The longest run of consecutive quarters at a clamp, any industry, ending this quarter |
| `m_clamp_over_8q` | Industries whose run ending this quarter is above 8 |
| `rev_demand_min`, `rev_demand_max` | Across industries, the lowest and highest quarter revenue ÷ demand revenue: the sum of a twelfth of effective demand at the quarter's three closes (D363 (a)) |
| `rev_demand_out_of_band` | Industries whose revenue ÷ demand ratio is outside 0.70 to 1.30 |
| `demand_trend_min`, `demand_trend_max` | Across industries, the lowest and highest quarter demand revenue ÷ trend revenue (D363 (b)) |
| `demand_trend_out_of_band` | Industries whose demand ÷ trend ratio is outside 0.45 to 1.55 |
| `m_clamp_max_run_counted` | The longest clamp run ending this quarter among the industries not waived (D366) |
| `m_clamp_max_run_waived` | The same among the waived industries (`SPEC_11_2_WAIVED`: Cloud, until the spec 11.2 per-industry rework) |
| `rev_demand_min_counted`, `rev_demand_max_counted`, `rev_demand_out_counted` | `rev_demand_min`, `rev_demand_max` and `rev_demand_out_of_band` among the industries not waived (D368) |
| `rev_demand_min_waived`, `rev_demand_max_waived`, `rev_demand_out_waived` | The same among the waived industries (`SPEC_11_2_WAIVED`: Cloud) |

## The targets

Spec 10's balance targets after 10 years, then its startup, character and listing targets (all **(T)**). Each bound is a named constant in `targets.rs`. A seed passes or fails each target; a target is **MET** when the share of evaluated seeds that pass reaches its required share: the share spec 10 names, else 100% (D330). Logan's M10.7 sign-off restated four of them (D363 to D366, design fixes 363 to 366): revenue is checked against each industry's own demand path with a separate demand-against-trend bound, demand growth is pooled over industry-runs, the Bust band is 8% to 22%, and Cloud is waived from the M clamp target until the spec 11.2 rework and reported on its own row. His rulings of 2026-10-21 (D367, D368) then set the demand-against-trend bound to 85% of seeds and waive Cloud from the revenue-against-demand target too, on its own row (one waiver list, `SPEC_11_2_WAIVED`, serves both).

| Id | Spec 10 | How a seed is checked | Needs |
|---|---|---|---|
| `start_alive_10y` | at least 85% of the 651 neither bankrupt nor removed | `start_alive_share` at the 2029 close ≥ 0.85 (D320) | all seeds |
| `median_productivity_10y` | median productivity 90 to 110 | `median_productivity` at the 2029 close in 90 to 110 (D321) | all seeds |
| `industry_revenue_demand` | industry revenue within ±30% of the industry's own demand path (restated, D363 (a); was ±30% of the trend path, D322), Cloud waived (D368) | every industry-quarter Q1 2020 to Q4 2029 of the industries not waived: revenue ÷ demand revenue in 0.70 to 1.30 (`rev_demand_*_counted`) | all seeds |
| `industry_revenue_demand_cloud_waived` | Cloud's revenue against its own demand path, waived until the spec 11.2 per-industry rework (D368) | every Cloud quarter Q1 2020 to Q4 2029 (`rev_demand_*_waived`) in 0.70 to 1.30, reported per seed | WAIVED |
| `industry_demand_trend` | each industry's demand within ±55% of its trend path in 85% of seeds (D363 (b); the seed share is Logan's ruling, D367) | every industry-quarter Q1 2020 to Q4 2029: demand revenue ÷ trend revenue in 0.45 to 1.55 | 85% (`DEMAND_TREND_SEED_SHARE`) |
| `m_clamp_8q` | no industry stuck at an M clamp for more than 8 quarters, Cloud waived (D366) | the longest clamp run of Q1 2020 to Q4 2029 among the industries not waived (`m_clamp_max_run_counted`) is at most 8 quarters (D327) | all seeds |
| `m_clamp_8q_cloud_waived` | Cloud's clamp runs, waived until the spec 11.2 per-industry rework (D366) | Cloud's longest run of Q1 2020 to Q4 2029 (`m_clamp_max_run_waived`) at most 8 quarters, reported per seed | WAIVED |
| `beat_share` | 30% to 60% of releases are beats | Σ beats ÷ Σ reports over the releases of Q1 2020 to Q4 2029 in 0.30 to 0.60 (D323) | all seeds |
| `demand_growth_pooled` | 90% of industry-runs (industries × seeds) have their 10-year average demand growth within ±3 pp of their long-term rate (restated, D365; was every industry in 90% of seeds, D324) | per seed, `industries − demand_dev_out` of `industries` within 3 pp at the 2029 close; a seed row passes at 90% | 90% of industry-runs, pooled |
| `boom_share` | 10% to 25% of industry-quarters labeled Boom | Σ `boom_months` ÷ Σ `industry_months`, Q1 2020 to Q4 2029, in 0.10 to 0.25 (D325) | all seeds |
| `bust_share` | 8% to 22% Bust (restated, D364; was 10% to 20%) | the same with `bust_months`, in 0.08 to 0.22 | all seeds |
| `startups_per_year` | 6 to 15 startups a year on average in 2020 to 2029 | mean `startups_in_year` over 2020 to 2029 in 6 to 15 (D328) | all seeds |
| `ai_lab_startups_2030_2035` | 15 to 50 AI labs startups in 2030 to 2035, in 80% of seeds | Σ `ai_lab_startups_in_year` over 2030 to 2035 (both inclusive) in 15 to 50 (D331) | 80% |
| `named_companies` | between 600 and 1,100 in every year | every row 2020 to 2049: `named_companies` in 600 to 1,100 (D329) | all seeds |
| `listings_30y` | 60 to 250 listings in 30 years | Σ `listings_in_year` over 2020 to 2049 in 60 to 250 | all seeds |
| `listings_per_year` | no more than 12 in any year | every row 2020 to 2049: `listings_in_year` ≤ 12 | all seeds |
| `start_private_listed_2024` | 10 to 30 starting private companies listed by the end of 2024, in 90% of seeds | `start_private_listed` at the 2024 close in 10 to 30 (D334) | 90% |
| `full_characters_per_decade` | 100 to 300 full characters made per decade | made in each decade the run covers (2020s: by the 2029 close; 2030s: 2039 close less 2029 close; 2040s likewise) in 100 to 300 (D332) | all seeds |
| `full_characters_2050` | under 1,200 full characters in the world in 2050 | `full_characters` at the 2049 close (1 January 2050) below 1,200 (D332) | all seeds |
| `cast_sizes` | every startup has 1 to 5 full and 1 to 5 partial characters | every birth's founders and simple cast in 1 to 5 (D326) | all seeds |
| `no_empty_labor_seat` | no labor seat of a born company is empty | `born_empty_seats_max` = 0 in every row 2020 to 2049 (D326) | all seeds |

**Windows.** A target is NA for a seed when the run lacks a row it needs: the 2029 row, the 40 quarters of 2020 to 2029, the reported quarters Q1 2020 to Q4 2029 (the Q4 2029 release is on 2 January 2030, so the beat share needs a run past 10 years), the 2030 to 2035 rows, all 30 rows 2020 to 2049 (listings in 30 years, and the every-year targets `named_companies`, `listings_per_year` and `no_empty_labor_seat`, D329), the 2024 row, the 2049 row; `full_characters_per_decade` evaluates the decades the run covers, NA with none; `cast_sizes` is NA with no birth.

## The detail tables (`--detail`, D900)

For long-run reports (for example 100 years left alone), `soak --detail` also writes four tables, read through `Sim::soak_world` (true figures, no estimate bands) and the views. They change nothing: years.csv, quarters.csv and the hashes are byte-identical with and without the flag. Code: `crates/headless/src/detail.rs`, which holds each header.

- `industries.csv`: one row per seed, year and industry at the December close: trend growth and current lt, q_growth, label, trend demand, demand, supply, S, M, fringe assets, the year's named and fringe revenue, the named share of last month's revenue, company counts (in the game, Active, Distressed, quoted, born and alive), births and bankruptcies in the year, the top 1, 4 and 10 companies' share of named revenue and its HHI, the mean productivity of live units, named gross assets, and the fair value and quoted market cap of its companies.
- `zones.csv`: one row per seed, year and zone exchange: index level, quoted companies, their market cap and fair value, confidence and the effective credit spread.
- `world.csv`: one row per seed and year: the AI stage and pop date, total demand, trend demand and supply, company counts by status and origin, births and bankruptcies so far, total cash, line drawn, equity, gross assets, fair value and market cap, the 10th, 50th and 90th percentile and largest TTM revenue and the percentiles of TTM EBIT margin of live companies, the share with TTM net income above 0, the top 10 companies' share of named revenue, the mean and largest industry HHI, the largest top-1 share, the full character count, and the M4.9 balance checks run and failed so far.
- `companies.csv`: every company not Removed at the 2020 close and at every tenth year's close (2029, 2039, ...): industry, origin and birth year, status, quoted, exchange, country, archetype, TTM revenue, EBIT, net income and dividends, cash, line drawn and limit, asset book, equity, gross assets, productivity, management score, rating, growth plan, labor units, price, shares, market cap and fair value.

## Performance

Build-plan 4.5 and spec 10 M10: 30 years headless in under 2 minutes per seed. `timing.csv` holds each seed's wall time; `soak` prints the min, median and max. Seeds running at once share the machine's memory bandwidth, so a seed's time grows with `--jobs` (on Logan's PC one seed alone takes about 8 to 11 s; 20 seeds on 12 jobs took 20 s of wall time, 8.5 to 10.9 s per seed). After M10.6 and the M10.7 tuning (D360 to D362): one seed alone about 6 s (`run --years 30 --seeds 1`, 5.9 s), 20 seeds on 8 jobs 20.3 s of wall time (6.4 to 6.9 s per seed), 50 seeds on 8 jobs 49.0 s (6.8 to 7.4 s per seed).

### Profiling (M10.6)

`run --profile` times every scheduler slot, every job and the view refresh (each view too) and prints a table per seed, slowest first (D400). The timer is in headless; the sim only tells an observer which part of the tick starts and finishes, so a profiled run writes the same rows and hashes (`crates/headless/tests/profile.rs`).

```
target/release/headless run --years 30 --seeds 1 --profile
```

Seed 1, 30 years, release, median of 3 runs on Logan's PC before and after the M10.6 fixes (main at 466d8a6 with only the profiling hook added, then this branch). The PC is shared, so single runs vary by about 20%; the whole run (`run --years 30 --seeds 1`, no profiling) went from about 9.5 s to about 7 s, and to 5.5 s on a quiet run.

| Part | Before (s) | After (s) | After the M10.7 tuning (s) |
|---|---|---|---|
| All steps | 8.17 | 5.82 | 5.24 |
| View refresh after each tick | 3.56 | 2.43 | 2.10 |
| `hourly.2.share_prices` | 2.13 | 2.03 | 1.99 |
| `daily.1.price_bars` | 1.34 | 0.27 | 0.22 |
| view `quotes` (every tick) | 1.30 | 0.68 | 0.69 |
| view `price_bars` (daily) | 0.59 | 0.22 | 0.18 |
| view `company_detail` | 0.36 | 0.32 | 0.29 |
| `quarterly.plan_lock.5.consensus` | 0.32 | 0.31 | 0.27 |
| view `statements` | 0.26 | 0.23 | 0.17 |
| view `company_rows` | 0.22 | 0.19 | 0.15 |
| `daily.2.fair_value` | 0.20 | 0.17 | 0.14 |
| `quarterly.close.1.statements` | 0.18 | 0.16 | 0.15 |

The third column is the merged tree after the M10.7 tuning (D360 to D362; build/m10-tuning), seed 1, median of 3 profiled runs (6.0 to 6.2 s each with the profiler). The tuning changes the world the jobs work on (fewer bankruptcies, more listings), not the code paths, and the PC was quieter than for the M10.6 columns, so the small drops are mostly run-to-run noise (about 20% on this shared PC): read the columns as a check on order of size, not to the tenth.

The fixes: the daily bar push no longer copies each company's open month while v_price_bars shares it, nor the month list at a month close (`ChunkLog` on write-once slots, D401); v_quotes refills its vectors in place (D402). Both keep every output byte-identical: seeds 1 to 12 × 30 years give the same `years.csv` and `quarters.csv` bytes as main, and seeds 1 and 2 the same 720 monthly hashes (`run --hash-monthly`). What is left is the hourly price step (two prices-stream draws a quoted stock a tick, D135) and the every-tick quotes view; the monthly and quarterly jobs are small.

The state hash itself is not part of a run: `run --hash-monthly` adds about 25 ms a month at 15 years (the postcard bytes of the world, about 70 MB with ten years of bars, then blake3).

## Determinism: replay and save/load (M10.4)

Build-plan 4.3: same seed, same hashes, on the same machine and build (decision A; across OSes is post-MVP).

**Replay** (D403). `record` plays a scripted player for N years and writes the seed, every control it sent (with its frame) and the state hash at every month close; `replay` plays the log back and checks every hash line as it is made, stopping at the first that differs.

```
target/release/headless record --years 30 --seed 1 --out run1.log
target/release/headless replay run1.log
```

The log holds every control the MVP player has but NewGame and the debug-only Omniscient: speed 0 to 5, pause, resume, the four SkipTos, alert levels, the watchlist, and Save and Load (numbered saves beside the log, removed at the end; a Load rewinds to the latest save). Both commands drive the sim through one frame loop that runs `TICKS_PER_FRAME[effective speed]` ticks a frame and stops when the sim pauses itself, so the sim's own pauses (alerts, finished skips, loads) happen again in the replay; a hash line is `hash <frame> <step> <month> <hash>`, so a changed pause shows too. The end line, `end <frame> <step> <clock> <hash> controls <digest>`, adds a digest of the final controls, which the state hash does not cover (D13), so a dropped control that moves no timing (a watchlist change) fails too (log version 2, D403). `crates/headless/tests/replay.rs` records a year, replays it, and checks that a changed hash, a dropped control, a dropped watchlist control, another seed or a bad line all fail. On Logan's PC a 30-year record or replay takes about a minute (the monthly hashes and the gzip of each save are most of it). After the M10.7 tuning, seed 1's 30-year log has 518 controls (38 of them Saves and Loads) and 522 hash lines; `record` and `replay` each took 63 s, the replay matched every line, and its end hash is `run --years 30 --seeds 1`'s (`afd33029…`). Before the tuning it had 523 controls.

**Save, load, continue** (D404). `crates/sim/tests/m10_save_load.rs` saves a game at ticks its seed picks (the plan lock tick, mid-way through the locked quarter, mid-way through a reaction week, right after a birth, a listing and a bankruptcy, and 3 random ticks), loads each save into another seed's game and plays on; every monthly hash and the final world must equal an unbroken run's. The default test covers 2 years of seed 3; the full check, 30 years on seeds 1 and 2, is ignored by default:

```
cargo test --release -p sim --test m10_save_load -- --ignored
```

It takes about 1.5 minutes in release on Logan's PC (9 cuts a seed, 360 monthly hashes a seed, all equal); after the M10.7 tuning, 96 s, all equal.

## The boom and the pop with noise off (M10.5)

`crates/sim/tests/m10_boom_pop.rs` runs the whole engine (every job of every slot, as `Sim::step` does) with the cycle and growth streams silenced and Z = 0, as validate.py's noise-free boom run (D405). Births, the Lite AI, the books and the market keep their own draws. Nothing downstream writes demand, so the match is exact: AI labs and the other 41 industries equal `tests/fixtures/validate-boom-calm.csv` to 1e-9 at every 1 January close 2020 to 2045, the boom's World event fires at 1 January 2030 00:00 and the pop's on its rolled date (a seed that rolls 1 January 2040, and one that rolls 1 July 2041), and the pop cuts each industry by its crash_drop on that tick. Both runs are in the default `cargo test` (about 15 s in debug).
