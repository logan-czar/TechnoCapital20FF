# 12. Tech stack, architecture and roadmap

_Status: v0.4 (2026-10-19). Consistency pass 3 (batch 129): roadmap step 6 notes that the province data is complete. Batch 125 (Logan): every value is in USD in the simulation; local currencies are flavor only; FX is post-POC; one world base rate from the Federal Monetary Board. FX is not built in roadmap step 5; it is post-POC. Batch 121: Metros have no council (only national governments). Batch 118: roadmap step 6 builds provinces, areas, regions, Metros and countries instead of hubs and districts; influence views rank per province or city. Batch 116: roadmap and tiers rewritten to the current design (one scenario and one player character, John Techno; no dynasty or succession; game over on death; news and Pdoomberg; two-layer control; Semiconductors as dollar effects). v0.3. Batch 41: a **desktop app built in Godot**, replacing Phaser and the browser. Batch 42: the simulation runs in a **Rust engine**; Godot's GDScript runs the front end. Design is still the current phase; this file records the plan for when the build starts. Owner: Logan._

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
      characters/ companies/ ownership/ economy/ technocapital/
      markets/ map/ politics/ ideology/ vices/ software/ media/ news/ events/ ai/ save/
      views/                  # query tables kept up to date for screens
    godot/                    # GDExtension binding crate: the callable API
  game/                       # Godot project, GDScript: scenes, UI, map, assets, input
  data/                       # JSON content and schemas
```

**The engine is the source of truth (Logan).**
- All game state lives in the engine as **tables** (characters, companies, holdings, business units, products, laws and so on), keyed by ids. GDScript never keeps its own copy of game rules or state; it keeps only what it is showing.
- The engine runs on its **own thread** and ticks in the background at the chosen speed.
- **Query tables (views)**: after each tick the engine updates ready-made tables for screens, for example the Portfolio rows, a company's board and products, a province's or city's influence ranking or the news feed. A screen reads one view instead of computing anything, so it opens instantly (Logan).
- Views update only when their source rows changed (dirty flags), and heavy views (rankings, leaderboards) update on their own cadence (daily or weekly).

**The callable API (Logan).** GDScript calls the engine through one object exposed by the binding crate **(A)**:

| Kind | Examples | Notes |
|---|---|---|
| **Control** | `new_game(seed)` (one scenario, John Techno), `load(path)`, `save(path)`, `set_speed(n)`, `pause()` | |
| **Queries** | `get_view("portfolio", owner_id)`, `get_row("company", id)`, `find("characters", filter)` | Return dictionaries and arrays that GDScript can bind to UI; reads come from the last finished tick, so they never block the simulation |
| **Commands** | `buy_shares(...)`, `found_company(...)`, `answer_event(event_id, option)` | Queued and applied at the start of the next tick; return a command id |
| **Signals** | `tick_done(date)`, `event_opened(event_id)`, `alert(kind, id)`, `command_result(id, ok, message)` | The engine pushes these to Godot; events and chosen alerts pause the game |

- **Simulation tiers (Logan, batch 41).**
  - **Full**: John Techno, his relatives, board members, people with hooks either way, active rivals and anyone the player is dealing with this month. Hourly actions, daily checks, every event deck.
  - **Light**: every other full character and their companies. Weekly batches for money, health and relationship tags; off-screen events resolved in batches ([detailed/13-events.md](detailed/13-events.md) 13.4).
  - A character moves from light to full when they enter the player's circle, and back after 3 months without contact **(A)**.
  - Markets, prices and politics run for the whole world at their normal cadence regardless of tier.
- **Determinism.** One seeded RNG stream per system, so a save plus the same commands gives the same result. Tests replay a recorded game and compare table hashes.

## 12.4 Roadmap (A)

Rebuilt around the current design; the build starts only when Logan says so.

1. **Skeleton**: Godot project in GDScript, the Rust engine as a GDExtension, the callable API, the hourly tick loop with speeds and pause, the top bar, save and load.
2. **Characters**: generation, skills, traits, the player's ambition, health and death (game over for John), relationship tags, personal trusts and accounts.
3. **Companies**: charters, boards and the management score, ownership and blocs, the two layers of control (owner of record and real controller), ranks, founding paths.
4. **Economy**: industries and price indices, business units, real estate pools, the Portfolio screen.
5. **Markets and information**: 24/7 quotes and orders (closed 1 January), the four earnings days, IPOs, bonds (every value in USD; FX is post-POC, batch 125); the Pdoomberg terminal, the news feed from named outlets, intel and search.
6. **Map and influence**: the province map (provinces, areas, regions, countries; development tracks, resource tags, terrain), Metros (outline and shared property cycle; no council; metro systems are post-POC), province real estate pools, influence tiers, map modes, travel. The province data is complete (3,255 provinces and 97 Metros in 8 superregion files); the North America slice is the first test slice **(A)**.
7. **Events**: engine, director, first decks (about 10 events each), the opening quest "The Desktop".
8. **Techno-Capital and software**: the three compute types (15), Semiconductors and other heavy simulation as dollar effects on business units, the software table (hacking comes later).
9. **Politics and ideology**: ideology blocs, strata voting, laws, elections, regulators.
10. **Vices and gambling**, then media, then John Techno's quest line, then the crash (2035 on average).

## 12.5 Success criteria for the first playable (A)

- A 30-minute session produces at least one board fight, one bloc defection and one takeover attempt without scripting.
- The player can explain why they gained or lost control of a company by reading the UI.
- The simulation runs a game year of hourly ticks headless in under a minute, with tests for control, bloc leadership, game over on death and save determinism.

## 12.6 Assumptions and open items

1. Godot 4 as the version (12.2). The GDExtension bridge is confirmed (batch 43).
2. The engine thread, query views, the API shape and the command queue (12.3).
3. Tier membership rules (12.3).
4. The roadmap order and success criteria (12.4, 12.5).
