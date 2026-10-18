# TechnoCapital20FF: Design Document

_Status: v0.4 (2026-10-16). Owner: Logan. Living document; every part is open for revision._

This is the entry point. Each system has its own file in this folder so it can grow independently.

> **Cyberware is scrapped (Logan, batch 71).** There are no implants, humanity, cyberpsychosis, cyberware clinics or cyberware addiction. Any remaining mention of cyberware, implants, chrome or humanity in any file is void; read the rule around it as if that part were not there.

| # | File | Covers |
|---|---|---|
| 1 | [01-companies.md](01-companies.md) | Founding companies, charters, blocs, vassal types, CEO and board, takeovers |
| 2 | [02-trusts-and-assets.md](02-trusts-and-assets.md) | Family trust, personal trusts and accounts, asset classes, leverage ("Wall Street Raiders Lite") |
| 3 | [03-characters.md](03-characters.md) | Skills, traits, opinion, stress, schemes (cyberware scrapped) |
| 4 | [04-dynasty-and-succession.md](04-dynasty-and-succession.md) | Dynasties, houses, succession laws, marriage, game over |
| 5 | [05-map-and-influence.md](05-map-and-influence.md) | World map, countries, regions, economic hubs, influence |
| 6 | [06-economy.md](06-economy.md) | Industries and business units (Wall Street Raider style), labor, demand |
| 7 | [07-markets.md](07-markets.md) | Stock exchanges, bonds, commodities, FX, central banks |
| 8 | [08-politics.md](08-politics.md) | Governments at three levels, interest groups, laws, regulators, lobbying, diplomacy |
| 9 | [09-time-and-turns.md](09-time-and-turns.md) | Hourly turns, daily, weekly, monthly, quarterly and yearly calculations |
| 10 | [10-events.md](10-events.md) | Event engine and event chains |
| 11 | [11-ui.md](11-ui.md) | Godot screens and map views |
| 12 | [12-tech-and-roadmap.md](12-tech-and-roadmap.md) | Tech stack, architecture, data model, milestones |
| 13 | [13-open-questions.md](13-open-questions.md) | Unresolved questions and current assumptions |
| 14 | [14-game-stages.md](14-game-stages.md) | Retired: the game has no stages (Logan, 2026-10-17) |

### Stage designs

Full design of each stage of a playthrough:

| Stage | File |
|---|---|
| 2. The Founder (retired; mechanics kept as systems) | [stages/2-the-founder.md](stages/2-the-founder.md) |

### Detailed designs

Exact rules, numbers and content for each layer of the game:

| Layer | File |
|---|---|
| 1. Corporate core (companies, characters, dynasty, trusts) | [detailed/1-corporate-core.md](detailed/1-corporate-core.md) |
| 2. Map, influence and economy | [detailed/2-map-influence-economy.md](detailed/2-map-influence-economy.md) |
| 3. Markets and FX | [detailed/3-markets-and-fx.md](detailed/3-markets-and-fx.md) |
| 4. Politics (ideology blocs, votes by strata, politics by company rank) | [detailed/4-politics.md](detailed/4-politics.md) |
| 5. Ideology (Victoria 2 style, cyberpunk) | [detailed/5-ideology.md](detailed/5-ideology.md) |
| 6. Techno-Capital (compute, fabs, lithography, drones, autonomous vehicles, robots, models) | [detailed/6-technocapital.md](detailed/6-technocapital.md) |
| 7. Starting world (alternate history, 2022 scenario, 15 starting characters, rivals, opening quest, timeline to 2030) | [detailed/7-starting-world.md](detailed/7-starting-world.md) |
| 8. Quest lines (arcs, the default line, and full lines for Pieter, Antone, Samir, Yuna, John, Viktor, Garrett, Pablo, Tolu, Qiao and Fang) | [detailed/8-quest-lines.md](detailed/8-quest-lines.md) |
| 9. Gambling, crypto and prediction markets (the phone tab) | [detailed/9-gambling.md](detailed/9-gambling.md) |
| 10. Industry economy (Wall Street Raider style: industries, business units, business assets; replaces goods) | [detailed/10-industry-economy.md](detailed/10-industry-economy.md) |
| 11. Addiction (gambling, drugs, doomscrolling, sex; cyberware scrapped) | [detailed/11-addiction.md](detailed/11-addiction.md) |
| 12. Setup, fair AI, dynasty score and saves | [detailed/12-setup-and-score.md](detailed/12-setup-and-score.md) |
| 13. Events (frequency, the director, AI events, event decks) | [detailed/13-events.md](detailed/13-events.md) |
| 14. Software (the software table and software contracts; hacking later) | [detailed/14-software.md](detailed/14-software.md) |
| 15. Infrastructure (three compute types, data centers, data, the cloud) | [detailed/15-infrastructure.md](detailed/15-infrastructure.md) |
| 16. Media and entertainment (print, streamers, studios, labels, creators; campaigns) | [detailed/16-media.md](detailed/16-media.md) |
| 17. Hacking (schemes on owned Techno-Capital; steal data or backdoor; black market) | [detailed/17-hacking.md](detailed/17-hacking.md) |

## Vision

TechnoCapital20FF is a turn-based grand strategy game set in the modern world with cyberpunk excess. You do not play a country. You play a **dynasty that controls capital**: a family whose members found companies, sit on boards, hold voting blocs, buy real estate across the globe, lobby governments and scheme against each other.

The fantasy is *Succession* meets *Crusader Kings 3* meets *Victoria 3* and *Wall Street Raiders*: scheming heirs, takeovers framed as wars, board meetings framed as royal councils, a family fortune managed like a raider's portfolio, all sitting on a living world economy of supply chains, stock markets, currencies and governments.

**Tone:** grounded corporate drama with cyberpunk accents (implants, netrunning, private military contractors, psyops), not a neon gang shooter.

## Design pillars

1. **Ownership is power.** Every relationship of authority is an equity stake, a charter clause, a contract or a debt. Characters are landless; assets are their titles.
2. **People, not spreadsheets.** Companies are run by characters with traits, ambitions, secrets and families. Numbers matter, but characters decide what happens to them.
3. **The dynasty outlives everyone.** The family trust carries the dynasty across a playthrough. You lose when your family loses it, not when a CEO dies.
4. **One connected world.** A factory strike in one hub moves a supply chain, a stock price, a currency and an election. Systems talk to each other.
5. **Modern, plausible, a little dystopian.** Real mechanisms (VC rounds, dual-class shares, offshore shells, capital controls) pushed slightly past today.

## The core loop

1. **Play a turn** (one in-game hour). Take actions: trade, call meetings, start schemes, found companies, move money, lobby.
2. **The world advances.** Hourly market ticks; daily, weekly, monthly and quarterly calculations run at their boundaries (see [09-time-and-turns.md](09-time-and-turns.md)).
3. **Events and event chains fire**: founding pitches, board crises, family drama, elections, supply shocks.
4. **Consequences ripple** through the ownership graph, supply chains, markets and politics.
5. **Succession** happens when the dynasty head dies or is ousted; play continues as the heir.

## How the systems connect

```
Characters ──own──> Personal assets ─┐
     │                               ├──> Influence over hubs and governments
Dynasty ──trustee──> Family trust ───┤
                         │           │
                         └─stakes──> Companies ──own──> Vassal companies
                                        │
                                   Facilities in hubs ──> Supply chains ──> Goods markets
                                        │
                                   Shares on exchanges ──> Stock prices ──> Trust value
                                        │
                                   Taxes, jobs, lobbying ──> Governments ──> Laws, rates, FX
```

## Build order

Everything below is in the full design, but it is built in this order so each layer is playable before the next arrives:

| Phase | Focus |
|---|---|
| **1** | Companies, founding, charters, blocs, vassals, boards, characters, dynasty, succession, trusts (with abstracted economy) |
| 2 | Map, hubs, influence, economy and supply chains |
| 3 | Stock market, bonds, commodities, FX and central banks |
| 4 | Politics: governments, laws, elections, regulators, diplomacy |

Details are in [12-tech-and-roadmap.md](12-tech-and-roadmap.md).
