// The Electron main process (pivot 15.1): one window showing the UI of apps/web, and one sim
// process beside it. The page is served from a privileged custom scheme, `app://game/`: the built
// renderer at `/`, and the world and map data at `/data/*`, so the page's absolute `/data/...`
// fetches work as they do on the Vite dev server. The sim runs in a Node utility process
// (src/sim/entry.ts); main only introduces the two, handing each one end of a MessageChannelMain,
// and from then on the game's protocol goes straight between them.
//
// The page has no Node: contextIsolation on, nodeIntegration off, sandboxed. What it may ask of
// the shell is the small `tcHost` object the preload script exposes.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DEFAULT_WORLD_ID, WORLD_2020_ID } from "@tc20ff/sim-data";
import type { TcFlags } from "@tc20ff/sim-host/bridge";
import {
  app,
  BrowserWindow,
  ipcMain,
  MessageChannelMain,
  protocol,
  type UtilityProcess,
  utilityProcess,
  type WebContents,
} from "electron";
import type { FromSimProc, RunReport, SimConfig, SimStatus, ToSimProc } from "../shared.ts";
import { type Flags, parseFlags, SMOKE_SCENARIO } from "./flags.ts";
import { type ServeDirs, serve } from "./serve.ts";
import { type SmokeOptions, type SmokePage, smokeInPage } from "./smoke.ts";

/** The page's scheme and host: `app://game/`. */
const SCHEME = "app";
const HOST = "game";
const PAGE_URL = `${SCHEME}://${HOST}/`;

/** The window's content size when `--window-size` does not say. */
const WINDOW_SIZE = { width: 1600, height: 900 };
/** How long a smoke run may take before it is written up as failed. */
const SMOKE_TIMEOUT_MS = 180_000;
/** How long main waits for the sim process to answer a status request. */
const STATUS_TIMEOUT_MS = 30_000;

const flags: Flags = parseFlags(process.argv.slice(1));

// Where the built files are: this file is dist/main/index.js.
const dist = resolve(import.meta.dirname, "..");
const rendererDir = join(dist, "renderer");
const preloadFile = join(dist, "preload", "index.cjs");
const simFile = join(dist, "sim", "entry.mjs");

/** Where the game's files are on disk (serve.ts), and the baked starts (pivot 3.5). */
interface DataDirs extends ServeDirs {
  starts: string;
}

function dataDirs(): DataDirs {
  if (app.isPackaged) {
    const base = join(process.resourcesPath, "data");
    return {
      renderer: rendererDir,
      worlds: join(base, "worlds"),
      design: join(base, "design"),
      map: join(base, "map"),
      starts: join(base, "starts"),
    };
  }
  const repo = resolve(app.getAppPath(), "..", "..");
  return {
    renderer: rendererDir,
    worlds: join(repo, "assets", "worlds"),
    design: join(repo, "docs", "design", "data"),
    map: join(repo, "assets", "map"),
    starts: join(repo, "assets", "starts"),
  };
}

/** The sim's world: null is the 2020 world (sim-data MANIFEST_2020), which the mock always plays. */
function simWorld(): string | null {
  return flags.world === WORLD_2020_ID ? null : (flags.world ?? DEFAULT_WORLD_ID);
}

// ---------------------------------------------------------------- the sim process

let sim: UtilityProcess | null = null;
let nextRequest = 1;
const waiting = new Map<number, (m: FromSimProc) => void>();

function forkSim(): UtilityProcess {
  const child = utilityProcess.fork(simFile, [], { serviceName: "tc20ff-sim", stdio: "inherit" });
  child.on("message", (m: FromSimProc) => {
    const done = waiting.get(m.id);
    waiting.delete(m.id);
    done?.(m);
  });
  return child;
}

function stopSim(): void {
  const old = sim;
  sim = null;
  old?.kill();
}

/** A request to the sim process that it answers by id. */
function askSim(
  child: UtilityProcess,
  build: (id: number) => ToSimProc,
  timeoutMs: number,
): Promise<FromSimProc> {
  const id = nextRequest++;
  return new Promise((done, fail) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      fail(new Error("the sim process did not answer"));
    }, timeoutMs);
    waiting.set(id, (m) => {
      clearTimeout(timer);
      done(m);
    });
    child.postMessage(build(id));
  });
}

/** Starts a fresh sim process for a page and hands each one end of a channel. */
function connectSim(page: WebContents, dirs: DataDirs): void {
  stopSim();
  const world = simWorld();
  const config: SimConfig = {
    world,
    worldDir: world === null ? dirs.design : join(dirs.worlds, world),
    mapDir: dirs.map,
    savesDir: join(app.getPath("userData"), "saves"),
    startsDir: dirs.starts,
    // The dev app's sim is a debug sim, so the Omniscient toggle works there (D1014).
    debug: flags.devServer !== null,
    save: flags.save === null ? null : resolve(flags.save),
  };
  const child = forkSim();
  sim = child;
  const { port1, port2 } = new MessageChannelMain();
  child.postMessage({ kind: "start", config } satisfies ToSimProc, [port1]);
  page.postMessage("tc:sim-port", null, [port2]);
  child.on("exit", (code) => {
    // A process this page no longer talks to (a reload, a quit) may go quietly.
    if (sim !== child) return;
    sim = null;
    if (!page.isDestroyed()) page.send("tc:sim-failed", `the simulation process stopped (exit code ${code})`);
  });
}

// ---------------------------------------------------------------- the window

function pageUrl(): string {
  const url = new URL(flags.devServer ?? PAGE_URL);
  // The page reads these as it does in a browser (apps/web/src/sim/world.ts, spawn.ts).
  if (flags.mock) url.searchParams.set("mock", "1");
  if (flags.world !== null) url.searchParams.set("world", flags.world);
  return url.toString();
}

function tcFlags(): TcFlags {
  return {
    mock: flags.mock,
    paused: flags.paused,
    world: flags.world,
    save: flags.save,
    smoke: flags.smoke !== null,
    testHooks: flags.testHooks,
    dev: flags.devServer !== null,
  };
}

function createWindow(): BrowserWindow {
  const size = flags.windowSize ?? WINDOW_SIZE;
  const win = new BrowserWindow({
    ...size,
    useContentSize: true,
    show: !flags.hidden,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadFile,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // A hidden window (the smoke run) must keep reading frames at full rate.
      backgroundThrottling: false,
      additionalArguments: [`--tc-flags=${Buffer.from(JSON.stringify(tcFlags())).toString("base64")}`],
    },
  });
  // The page stays the game: no other origin in this window, and no new windows.
  const origin = new URL(pageUrl()).origin;
  win.webContents.on("will-navigate", (e, url) => {
    if (new URL(url).origin !== origin) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  void win.loadURL(pageUrl());
  return win;
}

// ---------------------------------------------------------------- the smoke and determinism runs

function versions(): Record<string, string> {
  const v = process.versions;
  return { electron: v.electron ?? "", chrome: v.chrome ?? "", node: v.node, v8: v.v8 };
}

function writeJson(path: string, value: unknown): void {
  const file = resolve(path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** `--smoke`: drive the page (smoke.ts), ask the sim process what it holds, write both down, exit. */
async function smoke(win: BrowserWindow, out: string): Promise<void> {
  // The mock always plays the 2020 world (apps/web/src/sim/mock/worker.ts).
  const world = flags.mock ? WORLD_2020_ID : (flags.world ?? DEFAULT_WORLD_ID);
  const base = { mode: flags.mock ? "mock" : "real", world, versions: versions() };
  try {
    const options: SmokeOptions = {
      loaded: flags.save !== null && !flags.mock,
      seed: flags.seed,
      scenario: flags.scenario ?? SMOKE_SCENARIO,
      frames: flags.smokeFrames,
      readSave: !flags.mock,
      saveSlot: flags.smokeSaveSlot,
      timeoutMs: SMOKE_TIMEOUT_MS,
    };
    const page = (await win.webContents.executeJavaScript(
      `(${smokeInPage.toString()})(${JSON.stringify(options)})`,
      true,
    )) as SmokePage;
    let status: SimStatus | null = null;
    if (sim !== null) {
      // The page has paused the game and had its reply, so the sim process is at rest.
      const answer = await askSim(sim, (id) => ({ kind: "status", id }), STATUS_TIMEOUT_MS);
      if (answer.kind === "status") status = answer.status;
    }
    const slot = flags.smokeSaveSlot;
    writeJson(out, {
      ok: true,
      ...base,
      seed: status?.seed ?? null,
      frames: page.frames,
      ticks: page.ticks,
      date: page.clock?.date ?? null,
      now: page.clock?.now ?? null,
      paused: page.clock?.paused ?? null,
      // The sim process's own clock and state hash; null with the mock, which has neither.
      sim_now: status?.now ?? null,
      hash: status?.hash ?? null,
      save_bytes: page.saveBytes,
      slot,
      slot_reply: page.slotReply,
      slot_path: slot === null ? null : join(app.getPath("userData"), "saves", `${slot}.tcsave`),
      text: page.text,
    });
    app.exit(0);
  } catch (e) {
    writeJson(out, { ok: false, ...base, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
    app.exit(1);
  }
}

/** `--run`: no window. The sim process steps a seed for some years and its hashes are written down. */
async function run(out: string, dirs: DataDirs): Promise<void> {
  const world = simWorld();
  const child = forkSim();
  try {
    const answer = await askSim(
      child,
      (id) => ({
        kind: "run",
        id,
        run: {
          world,
          worldDir: world === null ? dirs.design : join(dirs.worlds, world),
          // `headless run` plays with no map, and this run is compared with it.
          mapDir: null,
          seed: flags.seed,
          scenario: world === null ? null : (flags.scenario ?? SMOKE_SCENARIO),
          years: flags.years,
        },
      }),
      // A year of the 1995 world is well under a minute; allow a long run its time.
      flags.years * 600_000,
    );
    if (answer.kind !== "run")
      throw new Error(answer.kind === "error" ? answer.message : "unexpected answer");
    const report: RunReport = answer.report;
    writeJson(out, {
      ok: true,
      ...report,
      versions: { ...report.versions, chrome: process.versions.chrome ?? "" },
    });
    child.kill();
    app.exit(0);
  } catch (e) {
    writeJson(out, { ok: false, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
    child.kill();
    app.exit(1);
  }
}

// ---------------------------------------------------------------- start

// Before the app is ready: where its files go, and the page's scheme, which must be registered as
// a standard, secure one for module scripts, workers (the mock sim) and fetch to work from it.
if (flags.userDataDir !== null) app.setPath("userData", resolve(flags.userDataDir));
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

app.on("window-all-closed", () => app.quit());
app.on("quit", () => stopSim());

void app.whenReady().then(async () => {
  const dirs = dataDirs();
  if (flags.run !== null) {
    await run(flags.run, dirs);
    return;
  }
  protocol.handle(SCHEME, (request) => serve(request.url, HOST, dirs));
  const win = createWindow();
  const fromPage = (sender: WebContents): boolean => sender === win.webContents;
  ipcMain.on("tc:connect-sim", (e) => {
    if (fromPage(e.sender) && !flags.mock) connectSim(e.sender, dirs);
  });
  ipcMain.on("tc:quit", (e) => {
    if (fromPage(e.sender)) app.quit();
  });
  ipcMain.on("tc:toggle-fullscreen", (e) => {
    if (fromPage(e.sender)) win.setFullScreen(!win.isFullScreen());
  });
  if (flags.smoke !== null) {
    const out = flags.smoke;
    win.webContents.once("did-finish-load", () => void smoke(win, out));
    win.webContents.once("did-fail-load", (_e, code, description) => {
      writeJson(out, { ok: false, error: `the page did not load: ${description} (${code})` });
      app.exit(1);
    });
  }
});
