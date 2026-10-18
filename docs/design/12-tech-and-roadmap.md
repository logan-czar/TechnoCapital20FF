# 12. Tech stack, architecture and roadmap

_Status: v0.3 (2026-10-18). Batch 41: a **desktop app built in Godot**, replacing Phaser and the browser. Batch 42: the simulation runs in a **Rust engine**; Godot's GDScript runs the front end. Design is still the current phase; this file records the plan for when the build starts. Owner: Logan._

Anything marked **(A)** is an assumption Logan has not confirmed yet; the list is in 12.6.

## 12.1 Decided by Logan

| Topic | Decision |
|---|---|
| Platform | **A desktop app** from the start (batch 41). No browser build. |
| Engine | **Godot** (batch 41), replacing Phaser. The look stays lightweight 2D: flat neon-on-dark vector panels and a map-first screen ([11-ui.md](11-ui.md) 11.4). |
| Simulation detail | **Tiered**: full detail for the player's circle and rivals, lighter weekly updates for everyone else (batch 41). |
| Engine split | **Rust engine + GDScript front end** (batch 42). GDScript handles the front end: asset loading, the map, screens and input. A **Rust engine** runs the simulation and is the **source of truth**: it stores the game data, does the calculations in the background and keeps **query tables** up to date so screens and queries load fast. GDScript talks to it through a **callable API**. |
| Content | **JSON files** that can be edited without code, checked against schemas when the game loads (batch 41). |
| Time | Pausable real time with hourly ticks and 5 speeds ([09-time-and-turns.md](09-time-and-turns.md)); deterministic seeded simulation; free saving ([detailed/12-setup-and-score.md](detailed/12-setup-and-score.md)). |

## 12.2 Stack (A)

- **Godot 4, GDScript** for the front end (Logan): scenes, UI, the map, asset loading, input and audio.
- **Rust** for the engine (Logan), built as a **GDExtension** library with the godot-rust bindings (gdext), so Godot loads it like a native module and GDScript calls it like any other object (Logan, batch 43).
- **The engine has no Godot types in its core**: a plain Rust crate for the simulation, plus a thin binding crate that exposes the API to Godot. The core runs headless for tests and tools.
- **Tests** with `cargo test`, including replay tests for determinism.
- Content as **JSON** in `data/`, validated against **JSON Schema** files when the engine loads it; a bad file names the field and the line.
- Saves are written by the engine: compressed snapshots of its tables plus the RNG seeds and positions.
- Desktop exports for Windows, macOS and Linux (the Rust library is built per platform).

## 12.3 Architecture (A)

```
TechnoCapital20FF/
  engine/                     # Rust workspace
    core/                     # plain Rust crate: the simulation and the data; no Godot types
      world/                  # tables (the source of truth) and ids
      time/                   # hourly tick loop; daily, weekly, monthly, quarterly, yearly schedulers
      characters/ dynasty/ companies/ ownership/ economy/ technocapital/
      markets/ map/ politics/ ideology/ vices/ software/ events/ ai/ save/
      views/                  # query tables kept up to date for screens
    godot/                    # GDExtension binding crate: the callable API
  game/                       # Godot project, GDScript: scenes, UI, map, assets, input
  data/                       # JSON content and schemas
```

**The engine is the source of truth (Logan).**
- All game state lives in the engine as **tables** (characters, companies, holdings, business units, products, laws and so on), keyed by ids. GDScript never keeps its own copy of game rules or state; it keeps only what it is showing.
- The engine runs on its **own thread** and ticks in the background at the chosen speed.
- **Query tables (views)**: after each tick the engine updates ready-made tables for screens, for example the Portfolio rows, a company's board and products, a hub's influence ranking or the news feed. A screen reads one view instead of computing anything, so it opens instantly (Logan).
- Views update only when their source rows changed (dirty flags), and heavy views (rankings, leaderboards) update on their own cadence (daily or weekly).

**The callable API (Logan).** GDScript calls the engine through one object exposed by the binding crate **(A)**:

| Kind | Examples | Notes |
|---|---|---|
| **Control** | `new_game(character_id)`, `load(path)`, `save(path)`, `set_speed(n)`, `pause()` | |
| **Queries** | `get_view("portfolio", owner_id)`, `get_row("company", id)`, `find("characters", filter)` | Return dictionaries and arrays that GDScript can bind to UI; reads come from the last finished tick, so they never block the simulation |
| **Commands** | `buy_shares(...)`, `found_company(...)`, `answer_event(event_id, option)` | Queued and applied at the start of the next tick; return a command id |
| **Signals** | `tick_done(date)`, `event_opened(event_id)`, `alert(kind, id)`, `command_result(id, ok, message)` | The engine pushes these to Godot; events and chosen alerts pause the game |

- **Simulation tiers (Logan, batch 41).**
  - **Full**: the player's dynasty, family, board members, people with hooks either way, active rivals and anyone the player is dealing with this month. Hourly actions, daily checks, every event deck.
  - **Light**: every other full character and their companies. Weekly batches for money, health and opinions; off-screen events resolved in batches ([detailed/13-events.md](detailed/13-events.md) 13.4).
  - A character moves from light to full when they enter the player's circle, and back after 3 months without contact **(A)**.
  - Markets, prices and politics run for the whole world at their normal cadence regardless of tier.
- **Determinism.** One seeded RNG stream per system, so a save plus the same commands gives the same result. Tests replay a recorded game and compare table hashes.

## 12.4 Roadmap (A)

Rebuilt around the current design; the build starts only when Logan says so.

1. **Skeleton**: Godot project in GDScript, the Rust engine as a GDExtension, the callable API, the hourly tick loop with speeds and pause, the top bar, save and load.
2. **Characters and dynasty**: generation, skills, traits, ambitions, health, opinions, trusts, succession.
3. **Companies**: charters, boards and the management score, ownership and blocs, ranks, founding paths.
4. **Economy**: industries and price indices, business units, real estate pools, the Portfolio screen.
5. **Markets**: quotes, orders, IPOs, bonds, FX.
6. **Map and influence**: hubs, districts, influence tiers, travel.
7. **Events**: engine, director, first decks (about 10 events each), the opening quest "The Desktop".
8. **Techno-Capital and software**: compute, the GPU chain, the software table (hacking comes later).
9. **Politics and ideology**: ideology blocs, strata voting, laws, elections, regulators.
10. **Vices and gambling**, then the quest lines, then the 2030 crash.

## 12.5 Success criteria for the first playable (A)

- A 30-minute session produces at least one succession crisis, one bloc defection and one takeover attempt without scripting.
- The player can explain why they gained or lost control of a company by reading the UI.
- The simulation runs a game year of hourly ticks headless in under a minute, with tests for control, bloc leadership, succession and save determinism.

## 12.6 Assumptions and open items

1. Godot 4 as the version (12.2). The GDExtension bridge is confirmed (batch 43).
2. The engine thread, query views, the API shape and the command queue (12.3).
3. Tier membership rules (12.3).
4. The roadmap order and success criteria (12.4, 12.5).
