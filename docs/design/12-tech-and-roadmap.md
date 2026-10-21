# 12. Tech stack, architecture and roadmap

_Status: v0.6 (2026-10-20). Batch 168 (Logan): "I want to do the entire thing in Bevy." The whole game is built in Rust with the Bevy engine: Bevy runs rendering, UI, input and the simulation (ECS). Godot, GDScript and the GDExtension bridge are dropped; 12.1 to 12.4 and 12.6 rewritten. Batch 151 (Logan): AI boom moves to 2030, bubble to 2040 on average; AI starts tiny with low growth, then unprecedented growth: the crash averages 2040 (roadmap step 10). Consistency pass 3 (batch 129): roadmap step 6 notes that the province data is complete. Batch 125 (Logan): every value is in USD in the simulation; local currencies are flavor only; FX is post-POC; one world base rate from the Federal Monetary Board. FX is not built in roadmap step 5; it is post-POC. Batch 121: Metros have no council (only national governments). Batch 118: roadmap step 6 builds provinces, areas, regions, Metros and countries instead of hubs and districts; influence views rank per province or city. Batch 116: roadmap and tiers rewritten to the current design (one scenario and one player character, John Techno; no dynasty or succession; game over on death; news and Pdoomberg; two-layer control; Semiconductors as dollar effects). v0.3. Batch 41: a **desktop app** (then in Godot, replaced by Bevy in batch 168), replacing Phaser and the browser. Batch 42: the simulation runs in a **Rust engine**. Design is still the current phase; this file records the plan for when the build starts. Owner: Logan._

Anything marked **(A)** is an assumption Logan has not confirmed yet; the list is in 12.6.

## 12.1 Decided by Logan

| Topic | Decision |
|---|---|
| Platform | **A desktop app** from the start (batch 41). No browser build. |
| Engine | **Bevy** (batch 168), replacing Godot (batch 41), which replaced Phaser. The whole game is one Rust program. The look stays lightweight 2D: flat neon-on-dark vector panels and a map-first screen ([11-ui.md](11-ui.md) 11.4). |
| Simulation detail | **Tiered**: full detail for the player's circle and rivals, lighter weekly updates for everyone else (batch 41). |
| Engine split | **All Rust, all Bevy** (batch 168; was Rust engine + GDScript front end, batch 42). Bevy handles rendering, UI, input, audio and asset loading. The **simulation** is still the **source of truth**: it stores the game data, does the calculations and keeps **query tables** up to date so screens load fast. The UI talks to it through Bevy resources and events (12.3). |
| Content | **JSON files** that can be edited without code, checked against schemas when the game loads (batch 41). |
| Time | Pausable real time with hourly ticks and 5 speeds ([09-time-and-turns.md](09-time-and-turns.md)); deterministic seeded simulation; free saving ([detailed/12-setup-and-score.md](detailed/12-setup-and-score.md)). |

## 12.2 Stack (A)

- **Rust and Bevy for everything** (Logan, batch 168): one Cargo workspace, one language. Bevy draws the map and screens, handles input and audio, and runs the simulation schedule.
- **Pin one Bevy version** in `Cargo.toml` and upgrade only between milestones **(A)**. Bevy changes its API often, so upgrades are planned work.
- **The simulation crate has no Bevy rendering or UI dependency** **(A)**: a plain, deterministic Rust crate (`sim`) with seeded RNG. It runs inside the game as a Bevy plugin and also runs headless (no window) for tests, replays and soak runs.
- **UI** (Logan, batch 169): Bevy UI (`bevy_ui`) only, for everything: panels, the top bar, popups, dense tables and the Pdoomberg terminal. No egui. Dense tables need a small in-house table widget (virtualized rows, sortable columns) **(A)**.
- **Bevy version** (Logan, batch 169): one Bevy version is pinned in Cargo.toml and upgraded only between milestones.
- **Map** **(A)**: the province-ID bitmap loaded as a texture; one shader looks up each pixel's province for borders, hover, selection and map modes (a small per-province color table updated when the map mode or data changes).
- **Data loading**: the CSV files in `data/` (and any JSON) are read at startup with `serde` and `csv` into Bevy resources **(A)**; a bad file names the file, row and field.
- **Tests** with `cargo test`, including replay tests for determinism.
- Saves are written by the simulation with `serde`: compressed snapshots of its tables plus the RNG seeds and positions.
- Desktop builds for Windows, macOS and Linux with `cargo build --release` per platform.

## 12.3 Architecture (A)

```
TechnoCapital20FF/
  Cargo.toml                  # Rust workspace, pinned Bevy version
  crates/
    sim/                      # plain Rust crate: the simulation and the data; no rendering or UI
      world/                  # tables (the source of truth) and ids
      time/                   # hourly tick loop; daily, weekly, monthly, quarterly, yearly schedulers
      characters/ companies/ ownership/ economy/ technocapital/
      markets/ map/ politics/ ideology/ vices/ software/ media/ news/ events/ ai/ save/
      views/                  # query tables kept up to date for screens
    sim_plugin/               # Bevy plugin: runs sim in FixedUpdate, exposes views as resources, turns events into commands
    game/                     # Bevy app: UI (bevy_ui), map shader, input, audio, saves menu
    headless/                 # runner with no window: soak tests, replays, balance runs
  assets/                     # map bitmaps, shaders, fonts, icons
  data/                       # CSV and JSON content
```

**The engine is the source of truth (Logan).**
- All game state lives in the engine as **tables** (characters, companies, holdings, business units, products, laws and so on), keyed by ids. UI systems never keep their own copy of game rules or state; they keep only what they are showing.
- The simulation runs in Bevy's **`FixedUpdate`** schedule **(A)**: one fixed step is one game hour, and the speed setting changes how many steps run per real second (pause runs none). Heavy batches (weekly light tier, rankings) can run on Bevy's task pool. If ticks ever slow down the frame rate, the sim can move to its own thread with the same boundary.
- **Query tables (views)**: after each tick the engine updates ready-made tables for screens, for example the Portfolio rows, a company's board and products, a province's or city's influence ranking or the news feed. A screen reads one view instead of computing anything, so it opens instantly (Logan).
- Views update only when their source rows changed (dirty flags), and heavy views (rankings, leaderboards) update on their own cadence (daily or weekly).

**The sim to UI boundary (batch 168).** UI systems never touch sim tables directly; they use Bevy resources and events **(A)**:

| Kind | Examples | Notes |
|---|---|---|
| **Control** (events) | `NewGame { seed }` (one scenario, John Techno), `Load(path)`, `Save(path)`, `SetSpeed(n)`, `Pause` | Read by the sim plugin before the next step |
| **Queries** (read-only resources) | the `Views` resource: `views.portfolio(owner_id)`, `views.row::<Company>(id)`, `views.find_characters(filter)` | Typed Rust structs that UI systems read with `Res<Views>`; they hold the last finished tick, so a read never blocks the simulation |
| **Commands** (events) | `BuyShares {..}`, `FoundCompany {..}`, `AnswerEvent { event_id, option }` | Queued and applied at the start of the next tick; each gets a command id |
| **Notices** (events from sim) | `TickDone(date)`, `EventOpened(event_id)`, `Alert(kind, id)`, `CommandResult(id, ok, message)` | The sim plugin sends these to UI systems; events and chosen alerts pause the game |

- **Simulation tiers (Logan, batch 41).**
  - **Full**: John Techno, his relatives, board members, people with hooks either way, active rivals and anyone the player is dealing with this month. Hourly actions, daily checks, every event deck.
  - **Light**: every other full character and their companies. Weekly batches for money, health and relationship tags; off-screen events resolved in batches ([detailed/13-events.md](detailed/13-events.md) 13.4).
  - A character moves from light to full when they enter the player's circle, and back after 3 months without contact **(A)**.
  - Markets, prices and politics run for the whole world at their normal cadence regardless of tier.
- **Determinism.** One seeded RNG stream per system, so a save plus the same commands gives the same result. Tests replay a recorded game and compare table hashes.

## 12.4 Roadmap (A)

Rebuilt around the current design; the build starts only when Logan says so. The MVP build plan (crates, tasks per milestone, tests, risks) is in [mvp/build-plan.md](mvp/build-plan.md).

1. **Skeleton**: the Rust workspace, the Bevy app and the `sim` plugin, the headless runner, the sim to UI boundary (12.3), the hourly tick loop with speeds and pause, the top bar, save and load.
2. **Characters**: generation, skills, traits, the player's ambition, health and death (game over for John), relationship tags, personal trusts and accounts.
3. **Companies**: charters, boards and the management score, ownership and blocs, the two layers of control (owner of record and real controller), ranks, founding paths.
4. **Economy**: industries and price indices, business units, real estate pools, the Portfolio screen.
5. **Markets and information**: 24/7 quotes and orders (closed 1 January), the four earnings days, IPOs, bonds (every value in USD; FX is post-POC, batch 125); the Pdoomberg terminal, the news feed from named outlets, intel and search.
6. **Map and influence**: the province map (provinces, areas, regions, countries; development tracks, resource tags, terrain), Metros (outline and shared property cycle; no council; metro systems are post-POC), province real estate pools, influence tiers, map modes, travel. The province data is complete (3,255 provinces and 97 Metros in 8 superregion files); the North America slice is the first test slice **(A)**.
7. **Events**: engine, director, first decks (about 10 events each), the opening quest "The Desktop".
8. **Techno-Capital and software**: the three compute types (15), Semiconductors and other heavy simulation as dollar effects on business units, the software table (hacking comes later).
9. **Politics and ideology**: ideology blocs, strata voting, laws, elections, regulators.
10. **Vices and gambling**, then media, then John Techno's quest line, then the crash (2040 on average; the AI boom starts in 2030).

## 12.5 Success criteria for the first playable (A)

- A 30-minute session produces at least one board fight, one bloc defection and one takeover attempt without scripting.
- The player can explain why they gained or lost control of a company by reading the UI.
- The simulation runs a game year of hourly ticks headless in under a minute, with tests for control, bloc leadership, game over on death and save determinism.

## 12.6 Assumptions and open items

1. Bevy for the whole game is confirmed (batch 168). Decided (batch 169): `bevy_ui` only, and one pinned Bevy version upgraded only between milestones. Open: which version to pin (pick the latest stable when the build starts) and the map shader approach (12.2). Risk: Bevy UI is young for a dense CK3-style UI; mitigation: the pinned version and an in-house table widget built early (M9).
2. The `FixedUpdate` tick, query views, the resource and event boundary and the command queue (12.3).
3. Tier membership rules (12.3).
4. The roadmap order and success criteria (12.4, 12.5).
