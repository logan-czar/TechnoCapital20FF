# 12. Tech stack, architecture and roadmap

## 12.1 Stack

- **Phaser 3**, **TypeScript**, **Vite**.
- **Vitest** for simulation tests.
- Content as **JSON** in `data/` (traits, events and chains, charters, vassal types, founding paths, goods, production methods, countries, hubs, laws).
- Deterministic seeded RNG; JSON save and load.

## 12.2 Architecture

```
src/
  sim/              # pure TypeScript, no Phaser imports; runs headless
    world.ts        # world state root
    time/           # turn loop, hourly/daily/weekly/monthly/quarterly/yearly schedulers
    ownership/      # holders, stakes, control, blocs, charters
    companies/      # companies, vassals, boards, founding
    finance/        # trusts, accounts, assets, loans
    characters/     # characters, traits, opinion, stress, schemes
    dynasty/        # dynasties, succession
    map/            # countries, regions, hubs, districts, routes, influence
    economy/        # goods, facilities, supply chains, population
    markets/        # exchanges, price model, bonds, commodities, FX, central banks
    politics/       # governments, laws, interest groups, elections, regulators
    events/         # event engine and chains
    ai/             # AI decision-making for characters, companies, governments
  ui/               # Phaser scenes and widgets
  data/             # JSON content
  main.ts
tests/
```

- The simulation can move to a Web Worker later so the UI stays smooth.
- Systems communicate through the world state and a simple event bus, not direct calls into each other.

## 12.3 Roadmap

### Phase 1: corporate feudalism core (abstracted economy)
1. Skeleton: Vite, Phaser, TypeScript, hourly turn loop, scheduler, top bar.
2. Ownership graph, share classes, standard charter, control calculation, company screen.
3. Blocs with share-count leadership.
4. Family trust and personal accounts, simple price model, portfolio screen.
5. Characters: generation, skills, traits, opinion, aging, death.
6. Boards and tasks; vassals held by companies (subsidiary, branch office, shell).
7. Found Company with Bootstrap, Bank Loan and Ask Daddy chains; then VC rounds.
8. Dynasty, trust rules, succession laws, wills.
9. Factions, proxy fights, tender offers, bloc poaching, schemes.
10. Event engine, first 20 events, test scenario.

### Phase 2: map and economy
Map rendering and zoom, countries, hubs, districts, real estate, influence and temporary boosts, goods, facilities, supply chains, population, Political Connections founding path.

### Phase 3: markets
Exchanges with hourly agent-based prices, IPO chain, bonds and ratings, commodities, currencies and FX, central banks, short selling.

### Phase 4: politics
Governments at three levels, interest groups, laws, elections, regulators and investigations, lobbying, diplomacy, sanctions, corporate sovereignty.

## 12.4 Success criteria for Phase 1

- A 30-minute session produces at least one succession crisis, one bloc defection and one takeover attempt without scripting.
- The player can explain why they gained or lost control of a company by reading the UI.
- The simulation runs a year of hourly turns headless quickly, with tests for control calculation, bloc leadership and succession.
