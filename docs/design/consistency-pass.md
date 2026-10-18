# Consistency pass (2026-10-18)

A sweep of every design file for rules that later decisions replaced. Counts are text matches, so a few are false hits (for example "sites" in "websites", or "stages" in a harmless sense), but each row points at real stale text. Nothing has been changed yet; this lists what is stale, where it is, and the proposed fix.

## Stale rules, by decision

| Stale rule | Replaced by | Mentions | Files | Worst files | Proposed fix |
|---|---|---|---|---|---|
| Victoria 3 goods, recipes, production methods | WSR industries (10.0, batch 50) | 146 | many | 2-map-influence-economy (93), 10-industry-economy (14), 06-economy (10) | Cut the goods sections from file 2 and the old 10.4 to 10.9; keep a one-line pointer to 10.0 |
| Stages (Founder, Climber, Tycoon...) | No stages; company rank (Oct 17) | 185 | 11 | 4-politics (50), 3-markets (40), stages/2-the-founder (30), 14-game-stages (28) | Delete 14-game-stages.md and stages/; replace "by stage" tables with "by company rank" |
| Cyberware, implants, humanity | Scrapped (batch 71) | 178 | 19 | 2-map-influence-economy (42), 5-ideology (42), 4-politics (22) | Remove the rows and sentences; the reading rule covers it until then |
| Sites | Business units (batch 48) | 137 | 12 | 10-industry-economy (80), 8-quest-lines (18) | Rewrite 10.4 site rules out; quest steps say "business unit" or "asset" |
| PMCs | Dropped (batch 51) | 98 | 13 | 4-politics (62), 2-map-influence-economy (15) | Remove 4.23 PMC sections and every PMC option |
| Opinion as a number | Friend, Neutral, Rival tags (batch 62) | 55 | 9 | 4-politics (23), 1-corporate-core (14) | Leave formulas (they read tags as numbers); reword "+10 opinion" effects as pushes |
| Supply chains, GPU chain | No supply chains (batch 50) | 48 | 17 | 6-technocapital, 8-quest-lines, 11-ui | Remove the GPU supply chain screen and chain text; GPU parts come from the GPU industry |
| Interest groups and old strata names | Nine ideologies, five strata (batch 37) | 76 | 7 | 5-ideology (30), 4-politics (23) | Swap to ideologies and strata names |
| Antitrust | None (batch 56) | 39 | 8 | 4-politics (18), 3-markets (6) | Remove C3 text, 4.13.4 and the antitrust lines in markets |
| Netruns | Hacking (17) | 39 | 10 | 4-politics (11), 6-technocapital (11) | Point to 17-hacking |
| Direct branches | Business units (batch 48) | 18 | 3 | 10-industry-economy (15) | Remove 10.4.6 |
| Crypto exchanges, data brokers | Removed (batch 50) | 13 | 5 | 3-markets (5), 5-ideology (4) | Remove |
| Model theft, uploaded minds | Not stealable (batch 73); cyberware scrapped | 5 | 2 | 6-technocapital (4) | Remove rows in 6.9.4 |
| Daily hours budget | Ticking actions (batch 64) | 5 | 2 | 1-corporate-core (4) | Remove the old 16-hour text under the banner |
| Phaser, browser | Godot desktop (batch 41) | 4 | 3 | 12-tech, 05-map, 11-ui | Remove |
| Anonymous float | Named holders only (batch 58) | 3 | 1 | 3-markets | Reword 3.3.4 intro |

## Structural issues

1. **The old overview files (01 to 14 at the top level)** were written before the detailed files and repeat early rules: 06-economy (goods), 07-markets, 08-politics (interest groups, PMCs) and 14-game-stages (stages) are the most out of date. Proposed fix: turn each into a short summary that points to its detailed file, or delete them.
2. **2-map-influence-economy.md** is the largest file and still holds most of the Victoria 3 economy (goods, hub prices, shipments). Its map, hubs, influence, strata, real estate and travel parts are still live. Proposed fix: split it, keep the live parts as "map and influence", and drop the economy parts.
3. **10-industry-economy.md** carries both the new model (10.0) and the old site model (10.1 to 10.11) under a banner. Proposed fix: rewrite it around 10.0 only.
4. **Banners everywhere.** Many files now open with "this overrides..." banners. Once the stale text is removed, the banners can go too.
