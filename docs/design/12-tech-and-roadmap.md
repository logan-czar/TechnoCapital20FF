# 12. Tech stack, architecture and roadmap

_Status: v0.2 (2026-10-18). Rewritten from Logan's batch 41 answers: a **desktop app built in Godot**, replacing the earlier Phaser, TypeScript and browser plan. Design is still the current phase; this file records the plan for when the build starts. Owner: Logan._

Anything marked **(A)** is an assumption Logan has not confirmed yet; the list is in 12.6.

## 12.1 Decided by Logan

| Topic | Decision |
|---|---|
| Platform | **A desktop app** from the start (batch 41). No browser build. |
| Engine | **Godot** (batch 41), replacing Phaser. The look stays lightweight 2D: flat neon-on-dark vector panels and a map-first screen ([11-ui.md](11-ui.md) 11.4). |
| Simulation detail | **Tiered**: full detail for the player's circle and rivals, lighter weekly updates for everyone else (batch 41). |
| Content | **JSON files** that can be edited without code, checked against schemas when the game loads (batch 41). |
| Time | Pausable real time with hourly ticks and 5 speeds ([09-time-and-turns.md](09-time-and-turns.md)); deterministic seeded simulation; free saving ([detailed/12-setup-and-score.md](detailed/12-setup-and-score.md)). |

## 12.2 Stack (A)

- **Godot 4** with **C#** (.NET) for the simulation and UI scripts. C# suits a large numeric simulation and matches Logan's other Godot C# project; GDScript can still be used for small UI glue **(A)**.
- **Simulation as a plain C# class library** with no Godot types, so it runs headless and in unit tests.
- **xUnit** (or NUnit) for simulation tests, run with `dotnet test` outside the editor **(A)**.
- Content as **JSON** in `data/`, validated against **JSON Schema** files at load; a bad file names the field and the line.
- Saves as compressed JSON snapshots of the world state plus the RNG seed and position.
- Desktop exports for Windows, macOS and Linux.

## 12.3 Architecture (A)

```
TechnoCapital20FF/
  sim/                    # C# class library, no Godot references; runs headless
    World.cs              # world state root
    Time/                 # hourly tick loop; daily, weekly, monthly, quarterly, yearly schedulers
    Characters/           # skills, traits, ambitions, health, stress, cyberware, relationships, hooks, schemes
    Dynasty/              # dynasties, trusts, succession, wills
    Companies/            # companies, charters, boards, management score, branches, vassals, ranks, founding
    Ownership/            # holders, stakes, blocs, control
    Economy/              # 36 industries, price indices, sites, real estate pools, slop, location perks
    TechnoCapital/        # compute, fabs, lithography, GPU chain, leases, control levels
    Markets/              # exchanges, quotes and slippage, orders, IPOs, bonds, FX, central banks
    Map/                  # countries, hubs, districts, routes, chokepoints, influence
    Politics/             # governments, ideology blocs, strata voting, laws, elections, regulators
    Ideology/             # nine ideologies, drift, movements
    Vices/                # addiction scores, gambling, phone tab
    Software/             # in-game software system (detailed/14-software.md)
    Events/               # event engine, director, decks, chains, quests
    AI/                   # characters, companies and governments; archetypes
    Save/                 # snapshot, load, determinism checks
  game/                   # Godot project: scenes, UI, map rendering, input
  data/                   # JSON content and schemas
  tests/                  # simulation tests
```

- **Threading.** The simulation runs on its own thread, separate from Godot's main thread, so the map and UI stay smooth at speed 5. The UI reads a published snapshot after each tick and sends player commands through a queue **(A)**.
- **Systems talk through the world state and an event bus**, not direct calls into each other.
- **Simulation tiers (Logan).**
  - **Full**: the player's dynasty, family, board members, people with hooks either way, active rivals and anyone the player is dealing with this month. Hourly actions, daily checks, every event deck.
  - **Light**: every other full character and their companies. Weekly batches: one weekly update for money, health and opinions, and off-screen events resolved in batches ([detailed/13-events.md](detailed/13-events.md) 13.4).
  - A character moves from light to full when they enter the player's circle, and back after 3 months without contact **(A)**.
  - Markets, prices and politics run for the whole world at their normal cadence regardless of tier.
- **Determinism.** One seeded RNG stream per system, so a save plus the same commands gives the same result (12-setup 12.5). Tests replay a recorded game and compare hashes.

## 12.4 Roadmap (A)

Rebuilt around the current design; the build starts only when Logan says so.

1. **Skeleton**: Godot project, C# simulation library, hourly tick loop with speeds and pause, top bar, save and load.
2. **Characters and dynasty**: generation, skills, traits, ambitions, health, opinions, trusts, succession.
3. **Companies**: charters, boards and the management score, ownership and blocs, ranks, founding paths.
4. **Economy**: industries and price indices, sites, real estate pools, the Portfolio screen.
5. **Markets**: quotes, orders, IPOs, bonds, FX.
6. **Map and influence**: hubs, districts, influence tiers, travel.
7. **Events**: engine, director, first decks (about 10 events each), the opening quest "Papers".
8. **Techno-Capital and software**: compute, the GPU chain, the software system.
9. **Politics and ideology**: ideology blocs, strata voting, laws, elections, regulators.
10. **Vices and gambling**, then the quest lines, then the 2030 crash.

## 12.5 Success criteria for the first playable (A)

- A 30-minute session produces at least one succession crisis, one bloc defection and one takeover attempt without scripting.
- The player can explain why they gained or lost control of a company by reading the UI.
- The simulation runs a game year of hourly ticks headless in under a minute, with tests for control, bloc leadership, succession and save determinism.

## 12.6 Assumptions and open items

1. C# over GDScript, and Godot 4 as the version (12.2).
2. Threading, snapshot and command queue (12.3).
3. Tier membership rules (12.3).
4. The roadmap order and success criteria (12.4, 12.5).
