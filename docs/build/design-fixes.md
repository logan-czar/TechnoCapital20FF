# Design fixes for Logan

Prose errors builders found in `docs/design` while building. Code PRs do not edit design prose (CLAUDE.md); Logan fixes these in the design and syncs them in. Strike a row through once it lands.

| # | Where | Problem | Suggested fix |
|---|---|---|---|
| 1 | data/README.md | Says `fixed_cost_rate` is 0.37 in every industry; spec 2.2 and 5.5 give 0.38 to 0.449 (median 0.439) | Match the spec |
| 2 | data/README.md, batch 155 paragraph | Borrowing at base + zone spread + rating is stale; spec 5.12 uses the home spread (half zone, half sovereign) | Point to spec 5.12 |
| 3 | data/README.md status line | Province weight clamp G given as both 0.2 to 3 (batch 159) and 0.1 to 4 (batch 160) | Keep one; spec 5.19.1 also needs the province weight formula stated in the spec itself |
| 4 | mvp-spec 7.1 | Says companies founded in play start barebones with only a CEO; superseded by 5.19.4 and C31 | Remove or cross-reference 5.19.4 |
| 5 | 12-tech-and-roadmap 12.3 | Notice names (`TickDone`, `EventOpened`, `CommandResult`) differ from spec 9.3's list | Use the 9.3 list |
| 6 | 12-tech-and-roadmap 12.6 | Table widget in M9; build-plan moved it to M7.7 | Say M7.7 |
| 7 | mvp-spec 2.2, 10 M0 | `startup-events.csv` and `names/` are listed as "to build"; both exist since M0 | Mark built |
| 8 | mvp-spec 9.1 | No controls for alert settings, the Omniscient toggle or the watchlist, though spec 8 and M1.5, M7.6, M7.8 need them | Add `SetAlert`, `SetOmniscient` (debug only), watchlist add and remove; the build adds them now |
| 9 | mvp-spec 4.1 step 1 | "Apply queued control calls" at the start of a tick conflicts with 9.1 "pause runs none": a Resume queued while paused would never apply | Say controls take effect at once; only commands that change the world (none in the MVP) queue for step 1 (build decision D5) |
| 10 | mvp-spec 9.3 | No notice says why the game paused (a SkipTo finishing, an alert, a load), and `alert(kind, payload)` has no level, so the UI cannot tell Notify from Log | Give `paused(reason)` named reasons and `alert` its level, as the build does (D6, D10) |
| 11 | mvp-spec 2.1 characters.csv row vs 9.2 `list_characters` | 2.1 loads only characters named as controller or owner_of_record; 9.2 lists all 296 | Say all 296 load; the named-controller role is a field (build decision D11) |
| 100 | mvp-spec 5.1.2 (credit spread paragraph); build-plan M2.2 done line | Argentina (base 591, intensity 1.6) is said to pay 307 bps in a mid Overheating; the formula gives 591 × (1 − 8 × 1.6 × 0.03) = 364 (307 is what intensity 2.0 would give). The 931 in a mid Contraction is right | Say 364 |
| 101 | mvp-spec 5.1.2 ("plus the own shock in Cuba and North Korea"), 5.1 isolated economies paragraph | Russia also has an own shock (own_shock_sd 0.02, batch 154) | Say Cuba, North Korea and Russia |
| 102 | mvp-spec 4.3 step 2, 5.1 Monthly demand | "Demand moves by a third of the quarter's growth" after step 1 has drawn the new quarter reads as the new quarter's growth, which with the 1 Jan 2020 job not running leaves Q1 2020 a third short and puts every year's growth a month late against validate.py | State that the job closes the month just ended with that month's quarter's growth (build decision D100) |
