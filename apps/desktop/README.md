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

## End-to-end tests

`apps/desktop/e2e` holds Playwright tests that drive the built app itself, through Playwright's Electron launcher. No browser is downloaded or used: the scripts set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, and `@playwright/test` only fetches a browser when asked with `playwright install`, which nothing here does.

From the repository root:

| Command | What it does |
|---|---|
| `corepack pnpm@10.20.0 e2e:smoke` | The smoke suite, `@smoke`: the mock sim, about 20 s. |
| `corepack pnpm@10.20.0 e2e` | Everything: `@smoke`, the screenshot checks `@visual`, and the real-sim suite `@real`. It takes the machine lock (`scripts/heavy`), because it launches the real sim. |
| `corepack pnpm@10.20.0 e2e -- --visual` | One suite: `--smoke`, `--visual` or `--real`. Anything else goes to Playwright: `--update-snapshots`, `--repeat-each 3`, `-g "phone"`. |

Each test launches its own app with `--user-data-dir=<a fresh folder under apps/desktop/.scratch/e2e/ud> --window-size=1600x900 --force-device-scale-factor=1 --test-hooks`, plus `--mock` for the smoke and screenshot suites. One worker runs them in turn. The window is shown: a `--hidden` window draws no frames by itself, so a click waits about 1.5 s and a screenshot can time out. A test's app is closed when the test ends, the process tree is killed if the close hangs, and the run fails if any process of it is still alive at the end. A failed test leaves its user-data folder, and Playwright's report of it, under `apps/desktop/.scratch/e2e`.

| Suite | File | What it checks |
|---|---|---|
| `@smoke` | `e2e/smoke.spec.ts` | The app boots to the desktop. The Debug workspace opens from its icon and from the launcher. A window is focused, minimised, restored, maximised and closed. A real pointer resizes a window, drags it by its title bar, cannot take it off the desktop, and snaps it to each half and to the whole. Step, the speeds and Pause move the taskbar clock. The phone goes up and down and shows a notification once the mock has run. A relaunch keeps the window layout. |
| `@visual` | `e2e/visual.spec.ts` | Screenshots of a mock game that has not moved: the empty desktop, the taskbar, the launcher's menu, the empty phone, the Debug workspace's window (its map and the clock covered). |
| `@real` | `e2e/real.spec.ts` | The 1995 world on the real sim: a new game from the picker, a day stepped, a save to a slot, a relaunch with `--save`, the same clock. |

One smoke test is marked as expected to fail, "KNOWN FAULT: a bottom resize handle cannot be pressed inside the frame": the list shows it with a cross and the run still passes. When the shell fixes the fault the run fails with "expected to fail, but passed"; delete the test's `test.fail()` line then.

The screenshot baselines are in `e2e/__screenshots__`, named by platform (`desktop-win32.png`). Only Windows has them so far; on another platform the first run writes its own and fails, and the second compares. After a change that is meant to be seen, write them again with `corepack pnpm@10.20.0 e2e -- --visual --update-snapshots` and look at the new files before committing them. `E2E_SCREENSHOT_STRICT=1` allows no pixel to differ, to measure how steady they are.

Both commands build the app first when its build is missing or stale, and only then. `e2e/run.ts` keeps a hash of every file the build reads in `dist/.e2e-inputs`: the sources of the shell, of `apps/web` and of the three sim packages, their `package.json` files and the lockfile, by name and content. The build is stale when one of its four main outputs is missing or the hash differs. A build made by hand with `desktop:build` has no hash file; it is judged by time (stale when any input is newer than its oldest main output) and given a hash file if it is good. The world and map data are not inputs, since the unpackaged app reads them from the repository. `--build` and `--no-build` overrule the check.

`scripts/check-fast` runs the smoke suite when it is called with no arguments and a file under `apps/desktop/` or `apps/web/src/os/` changed.

The test files are checked by their own `e2e/tsconfig.json`, which the root `tsc -b` does not reference: `corepack pnpm@10.20.0 exec tsc -p apps/desktop/e2e`.

## Driving the app by hand

`scripts/drive.ts` launches the built app, does a list of steps in it and prints one line of JSON per step. It is for an agent (or a person) who wants to look at the running game without writing a test. It always closes the app: after the last step, after a step that fails, when the whole run times out, and on Ctrl+C. Then it kills anything of the app that is still alive and says so in its last line.

```
node apps/desktop/scripts/drive.ts --mock | --save=<file> [options] --steps <file.json | inline JSON>
```

It is plain erasable TypeScript: Node 24 runs it as it is, and so does `tsx`.

| Option | Effect |
|---|---|
| `--mock` | The mock sim: the 2020 world, started by itself, paused at hour 0. |
| `--save=<file>` | The real sim, loaded from this save, paused. |
| neither | The real sim at the new-game picker of the 1995 world. |
| `--size WxH` | The window's content size. The default is 1600x900. |
| `--timeout <ms>` | The limit for the whole run. The default is 180000. One step may take 15 s. |
| `--user-data-dir=<dir>` | Keeps the app's files (its saves, the desktop's layout) in this folder. Without it a fresh folder under `apps/desktop/.scratch/drive` is used and removed afterwards. |
| any other `--flag` | Goes to the app: `--world=2020`, `--paused`. |

Anything but `--mock` launches the real sim: run it through the machine lock, `scripts/heavy.sh node apps/desktop/scripts/drive.ts ...`.

A step is an object with one key. A target is a `data-testid` given as a bare string, or `{"testId": ...}`, `{"text": ...}` (add `"exact": true` for the whole text) or `{"css": ...}`; `"nth"` picks one of several matches, counting from 0.

| Step | What it does |
|---|---|
| `{"click": target}`, `{"dblclick": target}` | A real click or double click in the middle of the target. |
| `{"type": "text"}` | Types with the keyboard into whatever has the focus. `{"type": {"css": "input", "value": "7"}}` puts the value in that field in place of what it held. |
| `{"press": "Space"}` | A key or chord by Playwright's names: `"."`, `"Escape"`, `"Control+ArrowLeft"`. With a target and `"key"`, the target is focused first. |
| `{"wait": 300}` | Waits that many milliseconds. `{"wait": {"testId": "win-debug"}}` waits for a target to be visible (`"state": "hidden"` for gone). `{"wait": {"expr": "sim.clock.paused"}}` waits for an expression to be true. `"timeout"` changes the 15 s limit. |
| `{"drag": {"from": point, "to": point}}` | Presses at `from`, moves to `to` and releases: a real pointer drag. A point is `[x, y]` in page pixels, or a target, held in its middle or at `"at": [x, y]` from its top left. |
| `{"screenshot": "path.png"}` | A PNG of the page; with a target, of that element. A relative path is from the current folder. |
| `{"eval": "expr"}` | Evaluates JavaScript in the page with `sim` set to `window.__tcSim`, waits for it if it is a promise, and prints its value. `document` and `tcHost` are in reach too. |

The output is one JSON object per line. The first says the app is up: its process id, the window's size, and `state`: `game` when the desktop is up, `picker` at the new-game picker, `fatal` when the sim stopped. Then one per step with `ok`, the milliseconds it took and what it found (`value`, `path`, the drag's two points). A failed step has `error` and a `screenshot` of the page as it was (`apps/desktop/.scratch/drive/failure.png`), and the steps after it do not run. The last line has `done`, `ok`, how many steps ran, and `closed`: whether the app closed when asked, which processes had to be killed, and `stray`, which is empty unless a kill failed. The exit code is 0 when every step passed and nothing was left running, 1 otherwise, 2 for bad arguments.

Things to know when writing steps:

- Test ids of the shell: `desktop`, `taskbar`, `app-<id>` (a desktop icon: double click it), `tb-launcher` and `launch-<id>`, `win-<id>` with `-min`, `-max`, `-close`, `-address` and `-edge-<n|s|e|w|ne|nw|se|sw>`, `tb-win-<id>`, `tb-step`, `tb-pause`, `tb-speed-<1 to 6>`, `tb-clock`, `tb-phone`, `phone`, `phone-down`, `phone-notifications`, `debug-workspace`. The only app so far is `debug`.
- `sim.clock` is the clock of the last Frame: `now` (game hours from 00:00 on 1 Jan 2020, so negative in the 1995 world), `date`, `hour`, `paused`, `selected_speed`. `sim.ticks` counts the hours run since the launch. `sim.control({kind: "Step", hours: 24})`, `sim.saveSlot("name")` and the other calls of `apps/web/src/sim/client.ts` return their reply.
- The mock pauses itself at hour 24 for its first alert.
- A title bar is dragged by its left part: `{"testId": "win-debug", "at": [120, 14]}`. Released within 12 px of the left or right edge of the desktop the window takes that half; at the top edge it is maximised.
- In PowerShell, put the steps in a file: Windows PowerShell 5.1 drops the double quotes of inline JSON handed to a program.

### Example: a look round the mock

`e2e/examples/mock-tour.json` opens the Debug workspace from the launcher, makes its window smaller by the top left corner, drags it by the title bar, runs the mock at full speed until its first alert pauses it, picks up the phone, takes a screenshot and reads the clock:

```
node apps/desktop/scripts/drive.ts --mock --steps apps/desktop/e2e/examples/mock-tour.json
```

It takes about 4 s. The window ends at x 180, y 66, 1167 wide and 677 high; the last step prints `{"now":24,"date":{"year":2020,"month":1,"day":2},"hour":0,"frames":3}`. The screenshot, `apps/desktop/.scratch/drive/mock-tour.png`, shows the Debug workspace's window with the political map, part of the wallpaper's orrery round it, the phone up on the right with two notifications ("Paused by Earnings day", "Earnings day (Q4 2019)"), and the taskbar with Max picked and the clock at 00:00 on Thu 02 Jan 2020.

### Example: make a save, then start from it

`e2e/examples/new-game-save.json` starts a 1995 game with seed 7 from the picker, steps a week and saves it to the slot `drive-example`. The user-data folder is named, so the save outlives the run:

```
scripts/heavy.sh node apps/desktop/scripts/drive.ts --user-data-dir=apps/desktop/.scratch/drive/example-ud --steps apps/desktop/e2e/examples/new-game-save.json
```

Its last step prints `{"now":-218976,"date":{"year":1995,"month":1,"day":8}}`, and the save is `apps/desktop/.scratch/drive/example-ud/saves/drive-example.tcsave` (about 650 KB). `e2e/examples/load-save.json` then starts from that file, reads the clock, opens the Debug workspace, switches it to Pdoomberg and takes a screenshot:

```
scripts/heavy.sh node apps/desktop/scripts/drive.ts --save=apps/desktop/.scratch/drive/example-ud/saves/drive-example.tcsave --steps apps/desktop/e2e/examples/load-save.json
```

Its second step prints `{"now":-218976,"date":{"year":1995,"month":1,"day":8},"paused":true}`: the clock that was saved. The screenshot, `apps/desktop/.scratch/drive/load-save.png`, shows the Debug workspace's window filled by Pdoomberg's quotes page: about thirty companies of the 1995 world with ticker, industry, country, exchange, last price, estimate band and rating, its status line reading "SUN 08 JAN 1995 00:00 PAUSED", and the taskbar clock at 00:00 on Sun 08 Jan 1995. The two runs take about 2 s and 4 s.

## The machine lock

`scripts/heavy.sh <command...>` and `scripts/heavy.ps1 <command...>` run a command while holding the machine-wide lock for heavy work, so that only one such job runs at a time across every worktree. The lock is the directory `.claude/scratch/heavy.lock` under the main repository's root, made with `mkdir`; `HEAVY_LOCK_DIR` names another. While someone else holds it the script waits and says who has it. It removes the lock when the command ends, however it ends. A lock that nobody has touched for two hours is removed with a warning. The scripts' headers list the other settings. `pnpm e2e` goes through it by itself; a command run under it sees `HEAVY_LOCK_HELD=1` and does not wait for the lock again.
