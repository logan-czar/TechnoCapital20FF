# The desktop app

The game as an Electron app (pivot 15.1): the UI of `apps/web` in one window, the sim in a Node utility process, saves as files on disk (pivot 15.4). D1032 logs the choices.

Electron 45.3.0: Chromium 156.0.8078.96, Node 24.22.2, V8 15.6.75.50-electron.0. The version is pinned exactly in `package.json`; `process.versions` of a run is in every smoke report.

## Run it

From the repository root:

| Command | What it does |
|---|---|
| `corepack pnpm@10.20.0 desktop:build` | Builds the unpackaged app into `apps/desktop/dist` (about 20 s). No installer is made yet. |
| `corepack pnpm@10.20.0 --filter @tc20ff/desktop start` | Runs the built app (`electron .` in `apps/desktop`). Flags go after `--`. |
| `corepack pnpm@10.20.0 desktop:dev` | Runs the app against a Vite dev server on port 5183: the UI hot-reloads, and the app restarts when main, preload or the sim process changes. Flags go after `--`. Its sim is a debug sim, so Omniscient works. |
| `corepack pnpm@10.20.0 --filter @tc20ff/desktop smoke` | Four hidden launches of the built app: real sim, mock sim, save to a slot, reload that save. Exits 0 when all pass. |
| `corepack pnpm@10.20.0 --filter @tc20ff/desktop determinism` | One seed for a year in headless Node, in this app's run loop under Node, and in the Electron utility process; the state hashes must agree (pivot 16.1). Heavy: take the machine lock first. |

The Electron binary is downloaded the first time anything asks for it. Set `electron_config_cache` to a folder on D: beforehand to keep its download cache off C:.

The browser path still works for development: `corepack pnpm@10.20.0 dev` runs the real sim in a Web Worker, and `?mock=1` the mock.

## How it fits together

| Part | File | What it does |
|---|---|---|
| Main | `src/main/index.ts` | Opens the window, serves the page, starts the sim process, introduces the two. |
| Flags | `src/main/flags.ts` | Parses the command line. |
| Scheme | `src/main/serve.ts` | Maps an `app://game/` path to a file. |
| Smoke | `src/main/smoke.ts` | The script main runs inside the page for `--smoke`. |
| Preload | `src/preload/index.ts` | Exposes `window.tcHost` and forwards the sim's MessagePort to the page. |
| Sim process | `src/sim/entry.ts` | Loads the world from disk and runs `packages/sim-host`'s host and loop on the port. |
| Run loop | `src/sim/run.ts`, `run-node.ts` | The determinism check's plain run, in the utility process and under Node. |

The page is served from a privileged custom scheme, `app://game/`. `/` is the built renderer. `/data/worlds/*`, `/data/design/*` and `/data/map/*` are the same folders the sim process reads: the repository's `assets/worlds`, `docs/design/data` and `assets/map` when the app is not packaged, and `resources/data/` when it is. A path that names no file is a 404.

The page has no Node: `contextIsolation` on, `nodeIntegration` off, sandboxed. When it calls `tcHost.connectSim()`, main forks the sim process, makes a `MessageChannelMain`, and sends one port to each. From then on the page and the sim process speak the game's protocol (`packages/sim/src/types/protocol.ts`) through that port, as the page and the Web Worker did. A page reload gets a fresh sim process.

The host is `packages/sim-host`, the same code the Web Worker runs. In the sim process it is also handed the disk, so it answers `SaveSlot`, `LoadSlot`, `ListSaves` and `DeleteSave`, writes the autosave, and lists baked starts in `Ready.starts`.

`NewGame` with `start: { kind: "generate" }` is not served yet. It goes to one injected function, `GenerateStart` in `packages/sim-host/src/host.ts`, which answers `Refused` until the fidelity lane's pre-simulation is injected there. `Cancel` does nothing and `Progress` is never sent.

## Saves

Saves are in `<userData>/saves/`. `userData` is Electron's folder for the app unless `--user-data-dir` moves it.

| File | What it is |
|---|---|
| `<slot>.tcsave` | The save. It is written as `<slot>.tcsave.tmp` and then renamed, so a crash leaves the old save whole. |
| `<slot>.tcsave.json` | The save's clock, seed and version, so a listing does not unpack the save. If it is missing, it is rebuilt from the save. |
| `autosave-1.tcsave` to `autosave-3.tcsave` | The rotating autosave: written at 00:00 on the first of each game month, over the oldest of the three. |

An autosave is skipped when the last one was written under 60 s of real time ago (`AUTOSAVE_MIN_REAL_MS`), so a game at max speed is not saved every tenth of a second.

A slot name is letters, digits, spaces, `_` and `-`, at most 64 characters. Names starting `autosave-` are refused for a player's save.

Baked starts are read from `assets/starts/index.json`: an array of `BakedStart` rows. A row's save is `<id>.tcsave` in the same folder, or the file its `file` field names. The folder does not exist yet, and `Ready.starts` is then empty.

## Flags

Every flag is `--name` or `--name=value`. A flag that cannot be read falls back to its default.

| Flag | Effect |
|---|---|
| `--mock` | Plays the mock sim in a Web Worker. No sim process is started. |
| `--save=<path>` | The sim process loads this save file before the page sees `Ready`. The game comes up paused at the save's clock. |
| `--paused` | Sets `tcHost.flags.paused`. Every game already starts paused; UI code that resumes by itself must check this flag. |
| `--window-size=WxH` | The window's content size in pixels. The default is 1600x900. |
| `--user-data-dir=<dir>` | Where saves and Chromium's own files go. Give each test run its own. |
| `--world=<id>` | `1995` (the default) or `2020`. |
| `--test-hooks` | The page puts its `SimClient` on `window.__tcSim`. |
| `--hidden` | Does not show the window. |
| `--smoke=<out.json>` | Runs the smoke run below, writes its report to the file, and exits 0, or 1 on failure. Implies `--test-hooks`. |
| `--smoke-frames=N` | Frames the smoke run waits for. The default is 30; 0 reports the game as it stands without ticking. |
| `--smoke-save-slot=<name>` | The smoke run saves to this slot before it reports. |
| `--seed=N`, `--scenario=<id>` | The new game of a smoke or determinism run. The defaults are 1 and `stable`. |
| `--run=<out.json>`, `--years=N` | Opens no window. The sim process steps the seed for N years and its monthly and final state hashes go to the file. |
| `--dev-server=<url>` | Loads the page from a Vite dev server. `desktop:dev` passes it. |

`--world=2020 --save=...` is not supported: the UI starts a new game by itself in a world with no scenarios, over the loaded one.

## The smoke run

With `--smoke=<out.json>`, main waits for the page to load and runs `smokeInPage` inside it. That script uses the page's own `SimClient`:

1. It waits for `Ready`.
2. It starts a new game with `--seed` (and `--scenario` when the world offers scenarios), unless `--save` loaded one.
3. It sets max speed and waits until `--smoke-frames` Frames have been read, resuming if an alert pauses the game.
4. It pauses, asks for a `Save` (real sim only), and saves to `--smoke-save-slot` if one was given.

Main then asks the sim process for its clock and state hash and writes the report.

| Field | Meaning |
|---|---|
| `ok` | False when anything failed; `error` then says what. |
| `mode`, `world` | `real` or `mock`, and the world played. |
| `versions` | Electron, Chromium, Node and V8. |
| `frames`, `ticks` | Frames the page read, and the `TickDone` notices in them. |
| `date`, `now`, `paused` | The clock of the last Frame the page read. |
| `sim_now`, `hash`, `seed` | The sim process's own clock, state hash and seed. Null with the mock. |
| `save_bytes` | The size of the `Save` reply's bytes after crossing the port. Null with the mock. |
| `slot`, `slot_reply`, `slot_path` | The slot saved to, the reply, and the file it should be in. |
| `text` | The first 300 characters of the page's text. |

A running sim holds each Frame until the page has answered the one before, so N frames read means the loop from sim process to page and back went round N times.

## Driving the app from a test

- Start it with its own `--user-data-dir`, a fixed `--window-size`, and `--test-hooks`.
- `window.tcHost` holds `flags`, `versions`, `connectSim()`, `quit()` and `toggleFullscreen()`.
- `window.__tcSim` is the page's `SimClient` (`apps/web/src/sim/client.ts`). Its `ready` promise resolves on `Ready`. `newGame`, `control`, `save`, `load`, `saveSlot`, `loadSlot`, `listSaves` and `deleteSave` return promises that resolve with the reply. `frames`, `ticks` and `clock` say what has been read. `store` is the UI's store.
- To start from a known state, save a slot in one run and pass its file to `--save` in the next. The state hash after loading equals the hash when it was saved.
- `--mock` plays the 2020 world and starts no sim process.

Playwright's Electron launcher takes the same arguments: the app folder (`apps/desktop`) followed by the flags.
