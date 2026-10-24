# 12. Tech stack, architecture and roadmap

_Status: v0.7 (2026-10-24). D950 (Logan, 2026-10-24): the game moves from Rust and Bevy to **TypeScript in the browser**, because Rust compiles cost too much on Logan's PC and there is no budget for cloud builds. The simulation stays a deterministic package with no UI; it runs in a Web Worker in the game and in a Node runner for tests and soaks. 12.1, 12.2 and 12.6 are updated; 12.3 and 12.4 keep their Bevy names until the port ([../build/ts-migration-plan.md](../build/ts-migration-plan.md)) lands (design fix 950). v0.6 (2026-10-20): Batch 168 (Logan): "I want to do the entire thing in Bevy." The whole game is built in Rust with the Bevy engine: Bevy runs rendering, UI, input and the simulation (ECS). Godot, GDScript and the GDExtension bridge are dropped; 12.1 to 12.4 and 12.6 rewritten. Batch 151 (Logan): AI boom moves to 2030, bubble to 2040 on average; AI starts tiny with low growth, then unprecedented growth: the crash averages 2040 (roadmap step 10). Consistency pass 3 (batch 129): roadmap step 6 notes that the province data is complete. Batch 125 (Logan): every value is in USD in the simulation; local currencies are flavor only; FX is post-POC; one world base rate from the Federal Monetary Board. FX is not built in roadmap step 5; it is post-POC. Batch 121: Metros have no council (only national governments). Batch 118: roadmap step 6 builds provinces, areas, regions, Metros and countries instead of hubs and districts; influence views rank per province or city. Batch 116: roadmap and tiers rewritten to the current design (one scenario and one player character, John Techno; no dynasty or succession; game over on death; news and Pdoomberg; two-layer control; Semiconductors as dollar effects). v0.3. Batch 41: a **desktop app** (then in Godot, replaced by Bevy in batch 168), replacing Phaser and the browser. Batch 42: the simulation runs in a **Rust engine**. Design is still the current phase; this file records the plan for when the build starts. Owner: Logan._

Anything marked **(A)** is an assumption Logan has not confirmed yet; the list is in 12.6.

## 12.1 Decided by Logan

| Topic | Decision |
|---|---|
| Platform | **The browser first** (D950, 2026-10-24): the game runs in a browser tab from a Vite build; a desktop wrapper (Electron) can come later. This reverses batch 41, which chose a desktop app over Phaser in the browser. Speed is not the constraint: the Rust sim ran 30 years in about 6 s against a 2-minute budget, so a TypeScript sim has room to spare. |
| Engine | **TypeScript** (D950), replacing Bevy (batch 168), which replaced Godot (batch 41), which replaced Phaser. React draws the screens and deck.gl (WebGL) the map. The look stays lightweight 2D: flat neon-on-dark vector panels and a map-first screen ([11-ui.md](11-ui.md) 11.4). |
| Simulation detail | **Tiered**: full detail for the player's circle and rivals, lighter weekly updates for everyone else (batch 41). |
| Engine split | **TypeScript everywhere** (D950; was all Rust, all Bevy, batch 168, and before that a Rust engine with a GDScript front end, batch 42). The browser handles rendering, input, audio and asset loading; the simulation is a plain TypeScript package with no DOM that runs in a Web Worker. The **simulation** is still the **source of truth**: it stores the game data, does the calculations and keeps **query tables** up to date so screens load fast. The UI talks to it through worker messages: controls in, notices and views out (12.3). |
| Content | **JSON files** that can be edited without code, checked against schemas when the game loads (batch 41). |
| Time | Pausable real time with hourly ticks and 5 speeds ([09-time-and-turns.md](09-time-and-turns.md)); deterministic seeded simulation; free saving ([detailed/12-setup-and-score.md](detailed/12-setup-and-score.md)). |

## 12.2 Stack (A)

- **TypeScript for everything** (D950, Logan 2026-10-24): one pnpm workspace, strict TypeScript, Vite for the browser build, Vitest for tests, Biome for lint and format. Packages: `sim-data` (the CSVs and their checks), `sim` (the simulation), `web` (the game) and `headless` (the Node runner).
- **The simulation package has no DOM and reads no wall clock** **(A)**: a deterministic package with seeded RNG streams. It runs in a Web Worker inside the game, and in Node for tests, replays and soak runs.
- **UI**: React for panels, the top bar, popups, dense tables (TanStack Table and Virtual) and the Pdoomberg terminal; dockable panes (dockview); a command bar (cmdk) **(A)**.
- **Map** **(A)**: province polygons, pre-projected to Miller and simplified, drawn by deck.gl in WebGL; picking, hover, selection and map modes come from the library (a per-province color list changes when the map mode or data changes).
- **Data loading**: the CSV files are read at startup into the sim's tables **(A)**; a bad file names the file, row and field.
- **Tests** with Vitest, including replay tests for determinism; the 50-seed soak runs in Node worker threads.
- Saves are written by the simulation as versioned, gzipped JSON: its tables plus the RNG state.
- Earlier stack (batches 168 and 169): Rust and Bevy, `bevy_ui` only, one pinned Bevy version. The Rust crates stay in the repository as the reference until the port's parity gate passes (D951), then they are deleted.

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

1. TypeScript in the browser replaces Rust and Bevy (D950, 2026-10-24). Open: whether to wrap the game as a desktop app later (Electron, not Tauri, which would bring Rust back). Risk: a JavaScript sim is slower than Rust; mitigation: the Rust sim used 6 s of a 2-minute 30-year budget, and the hot loops keep plain arrays.
2. The `FixedUpdate` tick, query views, the resource and event boundary and the command queue (12.3).
3. Tier membership rules (12.3).
4. The roadmap order and success criteria (12.4, 12.5).
