# TechnoCapital20FF: Design Document

_Status: v0.7 (2026-10-20). Batch 163 (Logan): the player's score is scrapped; John's run is kept in milestones and a history log. Batch 151 (Logan): AI boom moves to 2030, bubble to 2040 on average; AI starts tiny with low growth, then unprecedented growth: the starting world's timeline runs to 2040. Batch 143 (Logan, 2026-10-20): the quarterly cycle has its own file, detailed/21-quarterly-cycle.md. Consistency pass 3 (batch 129): pillar 4 and the systems diagram no longer suggest that countries gain currencies in play (FX is post-POC). Batch 125 (Logan): every value is in USD in the simulation; local currencies are flavor only; FX is post-POC; one world base rate from the Federal Monetary Board. Countries keep their real currencies in news, history and UI text; other central banks set no rate in the POC ([detailed/3-markets-and-fx.md](detailed/3-markets-and-fx.md) 3.8.1). Batch 121: only national governments in the POC (no state, regional or city governments; regions, cities and Metros are map groupings). Batch 118: EU4-style map (about 195 real countries, about 3,200 provinces, Metros for megacities; no hubs, districts or minor groups). Batch 117: no stress, Heat means how cancelled a character is. Batch 116: rewritten to the current design (pausable real time with hourly ticks, 24/7 markets, one scenario with John Techno, news and Pdoomberg, two-layer control, Wall Street Raider style industries, no dynasty or succession: the player character's death ends the game). v0.5, consistency pass, batch 74. Owner: Logan. Living document; every part is open for revision._

This is the entry point. Each system has its own file in this folder so it can grow independently.

| # | File | Covers |
|---|---|---|
| 1 | [01-companies.md](01-companies.md) | Founding companies, charters, blocs, vassal types, CEO and board, takeovers, two-layer control |
| 2 | [02-trusts-and-assets.md](02-trusts-and-assets.md) | Personal trusts and accounts, asset classes, leverage ("Wall Street Raiders Lite") |
| 3 | [03-characters.md](03-characters.md) | Skills, traits, relationship tags, Heat, schemes |
| 4 | [04-dynasty-and-succession.md](04-dynasty-and-succession.md) | Removed (batch 116): what remains is the player character and game over on death |
| 5 | [05-map-and-influence.md](05-map-and-influence.md) | World map: countries, regions, areas, provinces and Metros; influence |
| 6 | [06-economy.md](06-economy.md) | Industries and business units (Wall Street Raider style), demand, financing |
| 7 | [07-markets.md](07-markets.md) | 24/7 stock trading, earnings days, bonds, funds, the world base rate (every value in USD; FX post-POC) |
| 8 | [08-politics.md](08-politics.md) | National governments (the only level in the POC), ideology blocs, laws, regulators, lobbying, diplomacy |
| 9 | [09-time-and-turns.md](09-time-and-turns.md) | Pausable real time with hourly ticks; daily, weekly, monthly, quarterly and yearly calculations |
| 10 | [10-events.md](10-events.md) | Event engine and event chains |
| 11 | [11-ui.md](11-ui.md) | Godot screens, map views and the information sources (news, Pdoomberg, intel, search) |
| 12 | [12-tech-and-roadmap.md](12-tech-and-roadmap.md) | Tech stack, architecture, data model, milestones |
| 13 | [13-open-questions.md](13-open-questions.md) | Unresolved questions and current assumptions |

### Detailed designs

Exact rules, numbers and content for each layer of the game:

| Layer | File |
|---|---|
| 1. Corporate core (companies, characters, trusts, young companies) | [detailed/1-corporate-core.md](detailed/1-corporate-core.md) |
| 2. Map and influence (map, provinces and Metros, influence, strata, real estate pools, travel) | [detailed/2-map-and-influence.md](detailed/2-map-and-influence.md) |
| 3. Markets and FX | [detailed/3-markets-and-fx.md](detailed/3-markets-and-fx.md) |
| 4. Politics (ideology blocs, votes by strata, politics by company rank) | [detailed/4-politics.md](detailed/4-politics.md) |
| 5. Ideology (the nine ideologies, Victoria 2 style) | [detailed/5-ideology.md](detailed/5-ideology.md) |
| 6. Techno-Capital (compute, drones, autonomous vehicles, robots, models; heavy simulation runs as dollar effects on business units) | [detailed/6-technocapital.md](detailed/6-technocapital.md) |
| 7. Starting world (alternate history, the January 2020 scenario, the player character John Techno, the 15 AI rival characters, opening quest, timeline to 2040) | [detailed/7-starting-world.md](detailed/7-starting-world.md) |
| 8. Quest lines (arcs, the opening quest "The Desktop", and John Techno's line; rivals have no lines) | [detailed/8-quest-lines.md](detailed/8-quest-lines.md) |
| 9. Gambling, crypto and prediction markets (the phone tab) | [detailed/9-gambling.md](detailed/9-gambling.md) |
| 10. Industry economy (Wall Street Raider style: industries, business units, business assets) | [detailed/10-industry-economy.md](detailed/10-industry-economy.md) |
| 11. Addiction (gambling, drugs, doomscrolling, sex) | [detailed/11-addiction.md](detailed/11-addiction.md) |
| 12. Setup, fair AI, milestones and saves | [detailed/12-setup-and-score.md](detailed/12-setup-and-score.md) |
| 13. Events (frequency, the director, AI events, event decks) | [detailed/13-events.md](detailed/13-events.md) |
| 14. Software (the software table and software contracts) | [detailed/14-software.md](detailed/14-software.md) |
| 15. Infrastructure (three compute types, data centers, data, the cloud) | [detailed/15-infrastructure.md](detailed/15-infrastructure.md) |
| 16. Media and entertainment (print, streamers, studios, labels, creators; campaigns) | [detailed/16-media.md](detailed/16-media.md) |
| 17. Hacking (schemes on owned Techno-Capital; steal data or backdoor; black market) | [detailed/17-hacking.md](detailed/17-hacking.md) |
| 18. AI models (trained on GPU compute and data; rented through contracts; power AI features) | [detailed/18-ai-models.md](detailed/18-ai-models.md) |
| 19. History (the 1990s to 2020, year by year) | [detailed/19-history.md](detailed/19-history.md) |
| 21. The quarterly cycle (earnings window, reaction week, board meeting chain, locked quarter, pre-quarter-end week) | [detailed/21-quarterly-cycle.md](detailed/21-quarterly-cycle.md) |

## Vision

TechnoCapital20FF is **Crusader Kings 3 with corporations instead of kingdoms**: a pausable real-time grand strategy game (one tick is one in-game hour) set in the modern world with cyberpunk excess. You do not play a country. You play **one character, John Techno**, a 22-year-old COO in Edmonton who climbs through a world of capital: founding companies, sitting on boards, holding voting blocs, buying real estate, lobbying governments and scheming against rival characters.

The fantasy is *Succession* meets *Crusader Kings 3* meets *Wall Street Raider*: takeovers framed as wars, board meetings framed as royal councils, a personal fortune managed like a raider's portfolio, all sitting on a living world economy of industries, stock markets, currencies and governments.

**Tone:** grounded corporate drama with cyberpunk accents (AI models, hacking, drones, psyops), not a neon gang shooter.

## Design pillars

1. **Ownership is power.** Every relationship of authority is an equity stake, a charter clause, a contract or a debt. Characters are landless; assets are their titles.
2. **People, not spreadsheets.** Companies are run by characters with traits, secrets and relationships. Numbers matter, but characters decide what happens to them.
3. **One life.** You play John Techno and no one else. There is no dynasty and no successor: when John dies (health 0), the game is over (batch 116).
4. **One connected world.** A strike at a business unit in one province moves an industry, a stock price, a country's bond spread (and, after the POC, its currency) and an election. Systems talk to each other.
5. **Modern, plausible, a little dystopian.** Real mechanisms (VC rounds, dual-class shares, offshore shells, capital controls) pushed slightly past today.

## Key concepts

- **One scenario.** The game starts at 00:00 on 1 January 2020 in an alternate history ([detailed/7-starting-world.md](detailed/7-starting-world.md)), with John Techno as the only playable character. The other premade characters are AI rivals. It is an **endless sandbox** with milestones and a history log, but no score (batch 163; [detailed/12-setup-and-score.md](detailed/12-setup-and-score.md)).
- **Time.** Pausable real time with hourly ticks and 5 speeds; auto-pause on events and chosen alerts ([09-time-and-turns.md](09-time-and-turns.md)).
- **Markets.** Stocks trade 24/7 and close only on 1 January. All quarterly earnings release at 00:00 on 2 January, 2 April, 2 July and 2 October ([07-markets.md](07-markets.md)).
- **Information.** There is no all-knowing info screen. The player learns about the world from **in-game news**, slanted by the named outlets that publish it; accurate market and financial data come only from the **Pdoomberg terminal**, and other accurate facts from the **intel** screen. A neutral **search engine** finds what was published about a topic ([11-ui.md](11-ui.md) 11.1.1).
- **Two layers of control.** Share ownership (Wall Street Raider style) decides the public owner of record; corporate feudalism (vassal chains, blocs, hooks, loyalty, figureheads) decides who really calls the shots, and seeing it takes intel ([01-companies.md](01-companies.md)).
- **Industries and business units.** Wall Street Raider style: one flat list of industries, one world market each, no supply chains. Corporations hold business units in any industry, measured in dollars ([06-economy.md](06-economy.md)).
- **Clout and Image.** Clout is standing among the elite; Fame and Favor are how the public sees you (batch 116).

## The core loop

1. **Play** in pausable real time (one tick = one in-game hour). Take actions: trade, call meetings, start schemes, found companies, move money, lobby. Most actions are instant; some take ticks.
2. **The world advances.** Hourly market ticks; daily, weekly, monthly and quarterly calculations run at their boundaries (see [09-time-and-turns.md](09-time-and-turns.md)).
3. **Events and event chains fire**: founding pitches, board crises, scandals, elections, industry shocks, quest steps.
4. **News reports it**, through biased outlets; the player reads the terminal and intel to learn what really happened.
5. **Consequences ripple** through the ownership graph, industries, markets and politics. The game runs until John Techno dies.

## How the systems connect

```
John Techno ──owns──> Personal trusts and accounts ─┐
     │                                              ├──> Influence over provinces, cities and governments
     └──seats, blocs, hooks──> Companies ───────────┤
                                 │                  │
                                 ├──own──> Vassal companies (subsidiaries, shells)
                                 │
                            Business units ──> Industry world markets
                                 │
                            Shares on exchanges ──> Stock prices ──> Portfolio value
                                 │
                            Taxes, jobs, lobbying ──> Governments ──> Laws, rates
```

## Build plan

Design is the current phase. The build order for when Logan starts the build is in [12-tech-and-roadmap.md](12-tech-and-roadmap.md) 12.4.
