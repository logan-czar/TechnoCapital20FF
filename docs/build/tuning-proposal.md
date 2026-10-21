# M10.7 tuning proposal (for Logan's sign-off)

Build-plan M10.7: "Tuning pass on (T) values; changes go to the spec change log with Logan's okay." This is the pass's result. Three (T) changes are applied on the branch `build/m10-tuning` as named constants (D360, D361, D362); none of them is final until Logan signs them off, and the spec text still says the old values (design fixes 360 to 362 list the lines to change). Four targets cannot be met by tuning the economy; for those this proposes target restatements (design fixes 363 to 366).

**Result.** 20 seeds × 30 years: **11 → 15 of 18** targets met. 50 seeds × 30 years: **11 → 14 of 18** (the extra miss is `m_clamp_8q`, 47 of 50 seeds, design fix 366).

How it was run: `headless soak --years 30 --seeds 1..20 --jobs 8 --out DIR --check` (docs/build/soak.md), 26 s for 20 seeds on this machine, so every experiment below is a full 20-seed × 30-year soak, and the baseline and the recommended set were confirmed on 50 seeds. Experiments changed one constant (or a named pair) at a time on top of the step before. Mechanisms were diagnosed with a scratch per-industry, per-quarter dump of S, M, demand ÷ trend and revenue ÷ trend and a yearly IPO-pipeline count (not committed).

## 1. The recommended change set

| Decision | Spec | Constant | Old → new | What it fixes |
|---|---|---|---|---|
| D360 | 6.3 | `ai::rd::LOW_PRODUCTIVITY_ADJ` | +0.25 → **+0.5** | Median productivity (87 → 99.8); also the Cloud M clamp, the profitable share and part of the listings shortfall |
| D360 | 6.3 | `ai::rd::LOW_PRODUCTIVITY_BELOW` | 95 → **100** | (same decision: the pair is the 6.3 adj row) |
| D361 | 5.16 | `market::projection::CONSENSUS_ERROR` | ±5% → **±20%** | Beat share (11% → 40%) |
| D362 | 5.20 | `births::ipo::MIN_TTM_REVENUE_USD` | $250M → **$75M** | Listings in 30 years (39 → 85) |

Commits: `Tune the 6.3 productivity adj to +0.5 below 100 (D360)`, `Widen the 5.16 consensus error to ±20% (D361)`, `Lower the 5.20 IPO revenue test to $75M (D362)`, and one commit that updates the M6 tests (section 6).

## 2. Before and after: 20 seeds × 30 years (seeds 1 to 20)

Each cell: seeds passed / evaluated, verdict; the median measured value (min to max over seeds), as `check` reports it (soak.md: for `industry_revenue_trend` the worst `|ratio − 1|`, for `full_characters_per_decade` the decade count farthest from 200, for `cast_sizes` the number of casts).

| Target | Before (main) | After (D360 to D362) |
|---|---|---|
| `start_alive_10y` | 20/20 MET; 0.9416 (0.937 to 0.9447) | 20/20 MET; 0.9616 (0.9601 to 0.9647) |
| `median_productivity_10y` | 0/20 not met; 87.45 (87.27 to 87.59) | 20/20 MET; 99.78 (99.75 to 99.78) |
| `industry_revenue_trend` | 6/20 not met; 0.3343 (0.2436 to 0.4536) | 7/20 not met; 0.3451 (0.2448 to 0.4808) |
| `m_clamp_8q` | 3/20 not met; 15 (6 to 21) | 20/20 MET; 0 (0 to 6) |
| `beat_share` | 0/20 not met; 0.108 (0.1025 to 0.119) | 20/20 MET; 0.3961 (0.3903 to 0.3999) |
| `demand_growth_lt` | 3/20 not met; 4.2 (2.731 to 5.684) | 3/20 not met; 4.2 (2.731 to 5.684) |
| `boom_share` | 20/20 MET; 0.1798 (0.1339 to 0.2429) | 20/20 MET; 0.1798 (0.1339 to 0.2429) |
| `bust_share` | 16/20 not met; 0.1298 (0.0869 to 0.2006) | 16/20 not met; 0.1298 (0.0869 to 0.2006) |
| `startups_per_year` | 20/20 MET; 11.2 (9.5 to 12.3) | 20/20 MET; 10.6 (9.1 to 13.2) |
| `ai_lab_startups_2030_2035` | 20/20 MET; 34 (25 to 47) | 20/20 MET; 36 (20 to 49) |
| `named_companies` | 20/20 MET; 832 (801 to 871) | 20/20 MET; 933 (904 to 988) |
| `listings_30y` | 0/20 not met; 39 (34 to 54) | 20/20 MET; 85 (73 to 98) |
| `listings_per_year` | 20/20 MET; 6 (4 to 9) | 20/20 MET; 8 (6 to 10) |
| `start_private_listed_2024` | 19/20 MET; 15 (8 to 27) | 20/20 MET; 20 (16 to 25) |
| `full_characters_per_decade` | 20/20 MET; 162 (133 to 263) | 20/20 MET; 171 (147 to 250) |
| `full_characters_2050` | 20/20 MET; 865 (804 to 944) | 20/20 MET; 872 (815 to 962) |
| `cast_sizes` | 20/20 MET; 327 (295 to 359) | 20/20 MET; 328 (299 to 383) |
| `no_empty_labor_seat` | 20/20 MET; 0 (0 to 0) | 20/20 MET; 0 (0 to 0) |
| **Targets met** | **11 of 18** | **15 of 18** |

### The same on 50 seeds (build-plan 4.4's count)

| Target | Before (main) | After (D360 to D362) |
|---|---|---|
| `start_alive_10y` | 50/50 MET; 0.9416 (0.9355 to 0.9462) | 50/50 MET; 0.9616 (0.9585 to 0.9662) |
| `median_productivity_10y` | 0/50 not met; 87.38 (87.17 to 87.59) | 50/50 MET; 99.78 (99.71 to 99.82) |
| `industry_revenue_trend` | 12/50 not met; 0.3361 (0.2436 to 0.5167) | 14/50 not met; 0.3451 (0.2448 to 0.5183) |
| `m_clamp_8q` | 9/50 not met; 15 (4 to 23) | 47/50 not met; 0 (0 to 17) |
| `beat_share` | 0/50 not met; 0.1072 (0.1009 to 0.119) | 50/50 MET; 0.3959 (0.3903 to 0.4027) |
| `demand_growth_lt` | 5/50 not met; 4.141 (2.473 to 6.268) | 5/50 not met; 4.141 (2.473 to 6.268) |
| `boom_share` | 50/50 MET; 0.1798 (0.1339 to 0.2429) | 50/50 MET; 0.1798 (0.1339 to 0.2429) |
| `bust_share` | 44/50 not met; 0.1339 (0.0845 to 0.2006) | 44/50 not met; 0.1339 (0.0845 to 0.2006) |
| `startups_per_year` | 50/50 MET; 10.8 (8.4 to 13.5) | 50/50 MET; 10.3 (8.6 to 13.2) |
| `ai_lab_startups_2030_2035` | 50/50 MET; 34 (25 to 48) | 50/50 MET; 35 (18 to 49) |
| `named_companies` | 50/50 MET; 827 (792 to 886) | 50/50 MET; 928 (890 to 988) |
| `listings_30y` | 0/50 not met; 39 (31 to 54) | 50/50 MET; 83 (65 to 98) |
| `listings_per_year` | 50/50 MET; 6 (3 to 10) | 50/50 MET; 7 (5 to 10) |
| `start_private_listed_2024` | 49/50 MET; 16 (8 to 27) | 50/50 MET; 20 (12 to 26) |
| `full_characters_per_decade` | 50/50 MET; 162 (119 to 263) | 50/50 MET; 163 (118 to 260) |
| `full_characters_2050` | 50/50 MET; 856 (780 to 954) | 50/50 MET; 862 (782 to 962) |
| `cast_sizes` | 50/50 MET; 322 (285 to 380) | 50/50 MET; 323 (283 to 383) |
| `no_empty_labor_seat` | 50/50 MET; 0 (0 to 0) | 50/50 MET; 0 (0 to 0) |
| **Targets met** | **11 of 18** | **14 of 18** |

`ai_lab_startups_2030_2035` needs 80% of seeds: the after run's low of 18 is one seed (49 of 50 pass).

## 3. Per-target diagnosis

### median_productivity_10y (87 vs 90 to 110): fixed by D360

Spec 5.6 (`ops::productivity::productivity_delta`, crates/sim/src/ops/productivity.rs:95) moves productivity by `10 × (rd_total ÷ rd_norm − 1) × mgmt_factor × research_mult ÷ 12 − decay`, decay 0.5, 0.4 or 0.3 a month by idle share (`idle_decay`, :41). The Lite AI's R&D plan (6.3, `ai::rd::rd_plan`, crates/sim/src/ai/rd.rs:73) sets `rd_plan = target − free R&D`, so rd_total is the target: an Incumbent spends exactly the norm (Δ = −decay) until productivity falls under 95, where the +0.25 adj (`productivity_adj`, :32) lifts it to 1.25 × norm: `10 × 0.25 × 1.0 ÷ 12 = 0.21` a month against 0.3 to 0.5 of decay. So every archetype loses productivity for ever (design fix 108): median 96.4 after a year, 87.4 after ten, 72 after thirty; the profitable share falls from 96% to 74% (2029) and 41% (2049) and 332 companies are rated CC by 2049.

At +0.5 an Incumbent below the threshold gains about 0.42 a month, more than the decay, so units hold at the threshold. Moving the threshold to 100 (the starting productivity) holds them at 100 rather than 95. Each alone meets the 90 to 110 target (+0.5 below 95: median 94.8; +0.25 below 100: 91.1, still falling to 76 by 2049), but only the pair stops the slide over 30 years and clears the M clamp (next item). Cash cows (R&D mult 0.7) still drift down slowly: (0.7 + 0.5) × norm gains 0.17 a month against 0.3 of decay. The alternative design fix 108 named (an adj that grows as productivity falls) is a formula change, not a (T) value, so it is not proposed here.

### m_clamp_8q (runs to 21 quarters vs at most 8): fixed in 20 of 20 seeds by D360, 47 of 50 on 50

All clamp runs over 8 quarters are one industry: **Cloud**, at M 1.3 (undersupply, crates/sim/src/economy/supply.rs:59). Cloud's long-term rate is 20% before the boom (an 11.2 rework item) and 75% of its supply is named at load. The 6.2 growth plan (`ai::growth::situation_growth`, crates/sim/src/ai/growth.rs:46) gives a company whose ROA is under its 6.1 hurdle at most 2% a year (:63); at the MVP defaults ROA is close to the EBIT margin (capital per dollar 1), about 6% at load, under every hurdle but the State champion's. So Cloud's named units grow 2% while its demand grows 20%; S falls and M rises until margins clear the hurdle. With productivity sliding to 87, M 1.3 is no longer enough to clear it, S falls to about 0.52 and M stays clamped. With D360 productivity stays near 100 and M 1.3 clears the hurdle, so Cloud's named units grow again: no run longer than 6 quarters in seeds 1 to 20. On 50 seeds 3 still clamp (9, 12 and 17 quarters): in those seeds Cloud's demand itself drifts to about 1.6 × trend and its named units cannot keep up even growing at g_dem. Raising the 6.2 funding cap to 100% of liquidity (49 of 50) or the growth clamp to +40% (47 of 50) does not finish the job; this is design fix 366.

### beat_share (11% vs 30% to 60%): fixed by D361

After D168 the projection holds S, M and productivity at the lock, so a quarter lands within a few percent of its projection, and `consensus = projection × (1 + e)` with e within ±5% (`market::projection::consensus`, crates/sim/src/market/projection.rs:28). A report is a Beat when `(actual − consensus) ÷ |consensus|` is above +5% (crates/sim/src/market/earnings.rs:21), which with e within ±5% needs the quarter to beat its projection by more than 5% plus e: 10% to 12% of reports. 5.16 says to widen e if the soak's beat rate is low. With D360 the productivity drift inside a quarter is up rather than down (16% beats, 9% misses), and e within ±15%, ±20% and ±25% gives 36%, 40% and 42% beats (31%, 36% and 39% misses). ±20% is proposed: it sits near the middle of 30% to 60% with room on both sides (0.390 to 0.403 over 50 seeds). Wider e also makes larger price jumps at releases (5.15); price tracking stays well inside D151 (section 5).

### listings_30y (39 vs 60 to 250): fixed by D362

Two sources (spec 5.20): starting private companies (68 over $250M at load) and companies born in play. Born companies start at $5M to $50M of revenue (5.19.1) and, like everyone, grow at 2% a year while under the 6.2 hurdle, so at the baseline **none** reached $250M in 30 years over 50 seeds: every listing was a starting private company. Their pool lists at about 3 a year (a vote passes about 3% to 8% of the time: each of about five members votes yes at 15% plus modifiers, `births::ipo::BASE_YES`, crates/sim/src/births/ipo.rs:35) and shrinks as it lists or falls out of the tests (net income above 0, rating B or better, `passes_ipo_tests`, :88), so later decades list only 10 to 15. The spec's sanity check (97 in 30 years, about 33 of them born) assumed startups grow into IPO size.

Candidates tried on top of D360 and D361: raising the yes chance raises early listings as much as late ones, and the 2024 target (10 to 30 starting private companies listed, 90% of seeds) binds first (base yes 20%: 19 of 20 seeds reach 60 listings but 3 seeds go over 30 by 2024). Lowering the 6.1 hurdles (halved, or the Startup row's 12% to 6%) barely moves born growth. Lowering the revenue test adds few starting private companies early (only 12 of the 184 start between $75M and $250M, against 68 above it) and many born companies later, which is the shape the shortfall has: at $150M, $100M, $75M and $50M the 30-year totals are 64, 72, 85 and 100 (median), passing in 13, 19, 20 and 20 of 20 seeds. $75M is proposed: one constant, 65 to 98 over 50 seeds (19 to 41 born, 45 to 62 starting private), at most 10 in a year (the cap is 12), and 12 to 26 starting private companies listed by 2024. ($100M plus a 17% base yes chance also passes, but it is two changes.)

### industry_revenue_trend (6 of 20): not reachable by tuning (design fix 363)

D322 reads each industry-quarter's revenue against the trend path (`trend_demand`, which compounds lt). Revenue is `supply × M` (5.4), which follows demand while S is near 1, and each industry's demand drifts from its trend by the 5.1 volatility noise (`economy::growth::quarterly_growth`, crates/sim/src/economy/growth.rs:72): over 2020 to 2029 only 2 of 20 seeds keep every industry's demand within ±30% of trend (worst industry 27% to 57%). That is the same cause as design fix 320, and no supply-side value can move it; tuning moves the pass count from 6 to 7 of 20. Lowering volatility does fix it (0.005 for all industries: 20 of 20) but takes the Boom and Bust labels with it (Boom 3% to 10%, Bust 1% to 11%, because most labels come from the noise), and scaling the label gap down with it (`LABEL_GAP`, :33) leaves the cycle dominating the labels, which widens their spread over seeds (volatility 0.005 with gap 0.025: Boom 16% to 36%, Bust 7% to 26%). Volatility is also a value Logan confirmed (batch 151, 1a). The proposal is to restate the target so it tests what a balance target can test, supply against demand (design fix 363): revenue within ±30% of the industry's demand path passes in 49 of 50 seeds after tuning (14 of 50 before; the miss is Cloud in seed 24).

### demand_growth_lt (3 of 20): not reachable by tuning (design fix 320; engine numbers in 365)

Demand does not read company behaviour, so no value in this proposal moves it (identical columns before and after). Measured over 50 seeds at the 2029 close (D324): every industry within 3 pp in 5 of 50 seeds; the worst industry's gap is 2.5 to 6.3 pp (median 4.1); 93.8% of industry-runs are within 3 pp; 49 of 50 seeds have every industry within 6 pp. Fix 320's first wording, "90% of industries within 3 pp in 90% of seeds", passes only 84% of seeds here (42 of 50). Recommended restatement: **each industry within ±6 pp in 90% of seeds** (98% pass), validate.py's own limit; alternative: 90% of industry-runs within ±3 pp, pooled over seeds (93.8%).

### bust_share (16 of 20): not reachable by tuning the labels (design fix 364)

A seed's Bust share is set by its one 2020s Contraction (5.1: 2 to 8 quarters after a 12- to 28-quarter Expansion that starts the game): 2 or 3 Contraction quarters give 8.5% to 11%, 7 or 8 give 18% to 20%. Over 50 seeds the share runs 8.5% to 20.1% (44 inside 10% to 20%), a spread wider than the band can hold whatever the Bust gap: moving the gap moves both ends together (the 8.5% seed and the 20.1% seed). Narrowing the Contraction lengths would do it, but that is the cycle table, not a target. Recommended restatement: **8% to 22% in every seed** (50 of 50), or 10% to 20% in 85% of seeds (88% pass).

## 4. Experiments (20 seeds × 30 years each)

Seeds passed per target (bold: the target is met). Columns: alive = `start_alive_10y`, prod = `median_productivity_10y`, rev = `industry_revenue_trend`, clamp = `m_clamp_8q`, beat = `beat_share`, dem = `demand_growth_lt`, boom, bust, stup = `startups_per_year`, ai = `ai_lab_startups_2030_2035`, named = `named_companies`, list30 = `listings_30y`, list/yr = `listings_per_year`, sp2024 = `start_private_listed_2024`, full/dec, full2050, cast = `cast_sizes`, seats = `no_empty_labor_seat`. S rows change one value from the baseline; the rest build on the row named.

| # | Change (from) | alive | prod | rev | clamp | beat | dem | boom | bust | stup | ai | named | list30 | list/yr | sp2024 | full/dec | full2050 | cast | seats | Met |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B | Baseline (main) | **20** | 0 | 6 | 3 | 0 | 3 | **20** | 16 | **20** | **20** | **20** | 0 | **20** | **19** | **20** | **20** | **20** | **20** | 11 |
| S1 | `LOW_PRODUCTIVITY_BELOW` 95 → 100 | **20** | **20** | 6 | 9 | 0 | 3 | **20** | 16 | **20** | **20** | **20** | 0 | **20** | **20** | **20** | **20** | **20** | **20** | 12 |
| S2 | `LOW_PRODUCTIVITY_ADJ` 0.25 → 0.5 | **20** | **20** | 6 | 8 | 0 | 3 | **20** | 16 | **20** | **20** | **20** | 1 | **20** | **19** | **20** | **20** | **20** | **20** | 12 |
| S3 | `LOW_PRODUCTIVITY_ADJ` 0.25 → 0.4 | **20** | **20** | 6 | 8 | 0 | 3 | **20** | 16 | **20** | **20** | **20** | 0 | **20** | **18** | **20** | **20** | **20** | **20** | 12 |
| S4 | `LOW_PRODUCTIVITY_ADJ` 0.25 → 0.75 | **20** | **20** | 6 | 9 | 0 | 3 | **20** | 16 | **20** | **20** | **20** | 2 | **20** | **20** | **20** | **20** | **20** | **20** | 12 |
| S5 | `CONSENSUS_ERROR` 0.05 → 0.20 | **20** | 0 | 6 | 3 | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 0 | **20** | **19** | **20** | **20** | **20** | **20** | 12 |
| S6 | `MIN_TTM_REVENUE_USD` $250M → $75M | **20** | 0 | 6 | 4 | 0 | 3 | **20** | 16 | **20** | **20** | **20** | 2 | **20** | **20** | **20** | **20** | **20** | **20** | 11 |
| P | S1 + S2 (D360) | **20** | **20** | 7 | **20** | 0 | 3 | **20** | 16 | **20** | **20** | **20** | 6 | **20** | **20** | **20** | **20** | **20** | **20** | 13 |
| P+e15 | P + `CONSENSUS_ERROR` 0.15 | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 3 | **20** | **20** | **20** | **20** | **20** | **20** | 14 |
| C1 | P + `CONSENSUS_ERROR` 0.20 (D360 + D361) | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 3 | **20** | **20** | **20** | **20** | **20** | **20** | 14 |
| P+e25 | P + `CONSENSUS_ERROR` 0.25 | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 3 | **20** | **20** | **20** | **20** | **20** | **20** | 14 |
| C1+y17 | C1 + `BASE_YES` 0.15 → 0.17 | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 10 | **20** | **19** | 19 | **20** | **20** | **20** | 13 |
| C1+y18 | C1 + `BASE_YES` 0.18 | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 15 | **20** | **19** | **20** | **20** | **20** | **20** | 14 |
| C1+y20 | C1 + `BASE_YES` 0.20 | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 19 | **20** | 17 | **20** | **20** | **20** | **20** | 13 |
| C1+h | C1 + Startup hurdle ROA 12% → 6% | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **19** | **20** | 5 | **20** | **20** | **20** | **20** | **20** | **20** | 14 |
| C1+H | C1 + every 6.1 hurdle ROA halved | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 8 | **20** | **20** | **20** | **20** | **20** | **20** | 14 |
| C1+r150 | C1 + `MIN_TTM_REVENUE_USD` $150M | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 13 | **20** | **20** | **20** | **20** | **20** | **20** | 14 |
| C1+r100 | C1 + `MIN_TTM_REVENUE_USD` $100M | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | 19 | **20** | **19** | **20** | **20** | **20** | **20** | 14 |
| C1+r100+y16 | C1 + $100M + `BASE_YES` 0.16 | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **18** | **20** | **20** | **20** | **19** | **20** | **20** | **20** | **20** | 15 |
| C1+r100+y17 | C1 + $100M + `BASE_YES` 0.17 | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **19** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | 15 |
| **C2** | C1 + `MIN_TTM_REVENUE_USD` $75M (D360 + D361 + D362, **recommended**) | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | 15 |
| C1+r50 | C1 + `MIN_TTM_REVENUE_USD` $50M | **20** | **20** | 7 | **20** | **20** | 3 | **20** | 16 | **20** | **19** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | 15 |
| C2+v | C2 + `volatility` 0.01 → 0.005 (industries.csv, all rows) | **20** | **20** | **20** | **20** | **20** | 14 | 0 | 1 | **20** | **20** | **20** | **20** | **20** | **18** | **20** | **20** | **20** | **20** | 15 |
| C2+v7g | C2 + `volatility` 0.007 and `LABEL_GAP` 0.05 → 0.035 | **20** | **20** | 16 | **20** | **20** | 9 | 16 | 14 | **20** | **19** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | 14 |
| C2+v5g | C2 + `volatility` 0.005 and `LABEL_GAP` 0.025 | **20** | **20** | **20** | **20** | **20** | 14 | 11 | 12 | **20** | **18** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | 15 |

On 50 seeds on top of C2: `FUNDING_CAP_SHARE` 0.5 → 1.0 gives `m_clamp_8q` 49 of 50 and `ai_lab_startups_2030_2035` 47 of 50 (met, 80% needed); `GROWTH_MAX` 0.30 → 0.40 gives 47 of 50 (no change). Neither is proposed.

Notes on the table:

- The startup, character and AI-lab counts move a little in every experiment even when the change has nothing to do with births: anything that changes how many IPO votes are rolled shifts the shared gen stream (3.1), so later startup events draw differently. `full_characters_per_decade` dipped to 99 in one seed in C1+y17 for that reason; its 50-seed low after tuning is 118 (119 before).
- C2+v and C2+v5g also meet 15 targets, but by trading the Boom and Bust labels for the revenue and demand targets, and they change a value Logan confirmed; the label targets are the ones the cycle is designed for, so C2 is preferred.

## 5. Side effects (50 seeds × 30 years, median over seeds unless a range is given)

| Measure | Before | After | Note |
|---|---|---|---|
| Price tracking (D151): share of quoted company-days within ±30%, 2020 to 2029, lowest seed | 99.57% | 99.40% | D151 needs 98% |
| Price tracking, lowest single seed-year of 2020 to 2029 | 98.43% | 98.21% | D151 needs 97% every year; the m5_tracking test passes |
| Active share of all companies, 2029 / 2049 | 94.7% / 83.0% | 96.5% / 95.2% | |
| The 651 neither bankrupt nor removed, 2049 | 75.3% | 92.9% | |
| Profitable share (EBIT after R&D above 0), 2029 / 2049 | 74.1% / 41.3% | 86.2% / 87.5% | |
| Companies rated CC, 2049 | 333 | 68 | |
| Bankruptcies in 30 years | 172 (154 to 194) | 50 (45 to 53) | Fewer failures: see below |
| Removals in 30 years | 153 (138 to 168) | 46 (44 to 48) | |
| Named companies, 2049 | 822 | 928 (max 988 in any year) | Target 600 to 1,100 |
| Median productivity, 2049 | 71.3 | 99.8 | |
| Startups a year, 2020s | 10.8 (8.4 to 13.5) | 10.3 (8.6 to 13.2) | Target 6 to 15 |
| AI labs startups 2030 to 2035 | 34 (25 to 48) | 35 (18 to 49) | Target 15 to 50 in 80% |
| Listings in 30 years: born / starting private | 0 / 39 | 28 (19 to 41) / 54.5 (45 to 62) | |
| Full characters in 2050 | 856 | 862 | Target under 1,200 |
| Beats / misses, 2020s releases | 10.8% / 14.5% | 39.6% / 35.8% | |

The one side effect to look at is failure: with productivity no longer sliding, bankruptcies in 30 years fall from about 170 to about 50 and removals from about 150 to about 46, and the named world grows to about 930 companies by 2049. Every target still passes (the 2020s alive share is 96%, and the named count stays under 1,100), but if Logan wants more churn, the place to look is the 5.12 distress path or the cash-cow archetype, not these values.

**Determinism.** The tuned build gives byte-identical `years.csv` and `quarters.csv` for seeds 1 to 20 × 30 years run with `--jobs 8` and `--jobs 4`. Putting the four constants back to their main values on the tuned branch reproduces main's 50-seed `years.csv` byte for byte, so nothing but these four values changed behaviour.

## 6. Tests whose expected values changed

Every change keeps the check and moves the expected value to the tuned constant:

| Test | What changed | Why |
|---|---|---|
| `spec_6_3::productivity_adjustment` | +0.5 below 100 (was +0.25 below 95); the Incumbent at 90 targets 0.05 × 1.5 | D360 |
| `m6_lock::the_lite_ai_batch_at_the_first_lock_follows_section_6` | Its spec-written 6.3 adj reads D360's values; its funding cap reads a company's cash after the lock's listings | D360; and with D362 the gen stream lists CO-0321 (seed 3) at the 9 January 2020 lock, so its IPO money is in the cash the batch plans with (the batch runs after the listings, 4.4) |
| `spec_5_16::consensus_is_the_projection_within_twenty_percent` (renamed) | e = −20% + 40% × u; bounds ±20%; sd 0.4 ÷ sqrt(12); the mean bound scaled with the sd (5e-4 → 2e-3, the same 5.5 standard errors) | D361 |
| `m5_consensus` | `CONSENSUS_ERROR` 0.20; both ends used beyond 80% of the bound (was ±4% of ±5%) | D361 |
| `spec_5_20::ipo_tests_one_condition_at_a_time` | The revenue edge at $75M (74.9 fails, 75 passes) | D362 |
| `m4_dividend::the_dividend_rule_at_the_first_plan_lock` | The cash identity (draw, repayment, dividend) leaves out a company that lists at the lock | D362's extra votes list CO-0103 (seed 9) at the 9 January 2020 lock; its cash also takes the IPO's new money, which spec_5_20 and m6_ipo check |
| `m6_ipo::ipo_votes_and_listings_follow_5_20` | Runs to 2 April 2021 (was 2 February) | Seed 31 now lists CO-0085 at the 9 January 2021 lock; the test checks each listing's shares-issued line in its quarter's statements, which exist only after the Q1 2021 close |

## 7. For Logan: decisions and spec changes

Sign-off asked for (decision rows in [decisions.md](decisions.md), "pending Logan"; spec lines in [design-fixes.md](design-fixes.md)):

1. **D360** (design fix 360): spec 6.3's productivity adj becomes "+0.5 below productivity 100" (was +0.25 below 95). Answers design fix 108 with its first option.
2. **D361** (design fix 361): spec 5.16's e becomes "uniform ±20%" (was ±5%).
3. **D362** (design fix 362): spec 5.20's revenue test becomes "TTM revenue at least $75M" (was $250M), and the 5.20.1 sanity line is redone.

Target restatements asked for (spec 10), since tuning cannot meet them:

4. **Demand growth** (design fixes 320 and 365): "each industry's 10-year average demand growth within ±6 pp of its long-term rate in 90% of seeds" (98% of 50 seeds pass), or 90% of industry-runs within ±3 pp pooled (93.8%).
5. **Industry revenue** (design fix 363): "industry revenue within ±30% of its demand path" (revenue ÷ effective demand; 49 of 50 seeds pass after tuning, 14 before), or keep the trend path at ±55% (worst seen 52%). If Logan restates it, D322 and `REVENUE_RATIO` in targets.rs change with it.
6. **Bust share** (design fix 364): "8% to 22% Bust in every seed" (50 of 50), or 10% to 20% in 85% of seeds (88%).
7. **M clamp** (design fix 366): accept Cloud's 3-in-50 clamp until the 11.2 rework of Cloud's 20% pre-boom growth, or let the target need 90% of seeds (94%).

With items 4 to 7 restated as proposed and the D360 to D362 set, 17 of 18 targets are met on 50 seeds; the 18th, revenue against the demand path, passes in 49 of 50 (the one miss is the Cloud seed of item 7), so it is met with a 90% seed share or once Cloud is reworked.

## 8. Not fixed by tuning

- **Demand drift** (demand growth and revenue vs trend): the 5.1 volatility noise; only the volatility value moves it, at the cost of the Boom and Bust labels. Target restatement proposed.
- **Bust share spread**: one Contraction of 2 to 8 quarters per decade sets it. Target restatement proposed.
- **Cloud's undersupply in a few seeds**: Cloud's 20% pre-boom growth against the 6.2 below-hurdle 2% cap of the MVP defaults. Left for the 11.2 per-industry rework.
- **Most companies grow at 2% a year**: at the MVP defaults ROA is about the EBIT margin (about 6% at load), below every 6.1 hurdle but the State champion's 6%, so most of the economy's growth comes from the fringe and from undersupplied industries. Halving every hurdle did not change any target, so it is noted here, not proposed; it belongs with the 11.2 margins rework.
