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
| 300 | mvp-spec 8 main screen row | The left rail lists Company, Industries, Pdoomberg and Recap, but the News feed screen (also spec 8) then has no way in | Add News to the rail (key N, as 20-ui 20.2.2); the build does (D303) |
| 301 | mvp-spec 8 time controls row | The alert list has four kinds; spec 5.1.1 adds a fifth, the World event alert (default Pause), that the row omits | List World event (Pause) in the row; the build shows all five (D306) |
