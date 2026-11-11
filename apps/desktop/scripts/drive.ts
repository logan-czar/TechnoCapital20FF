// `node apps/desktop/scripts/drive.ts`: launch the built app and act on it from a list of steps,
// with no test to write (apps/desktop/README.md "Driving the app by hand"). It is what an AI agent
// uses to look at the running game: click, type, drag with a real pointer, take a screenshot, read
// the page's SimClient. One JSON line is printed per step. The app is always closed, and every
// process it started is killed, whether the steps passed, failed, timed out or were interrupted.
//
//   drive.ts --mock | --save=<file> [--size WxH] [--timeout ms] [--user-data-dir=<dir>]
//            [--<any other app flag>] --steps <file.json | inline JSON>
//
// Run with plain `node` (Node 24 strips the types) or with tsx. The end-to-end tests
// (apps/desktop/e2e) launch and close the app through `launchApp` and `closeApp` below.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { _electron, type ElectronApplication, type Locator, type Page } from "@playwright/test";
import { desktopDir, distDir, electronPath, scratchDir } from "./common.ts";

/** The window's content size when `--size` does not say (the app's own default). */
export const DEFAULT_SIZE = { width: 1600, height: 900 };
/** How long the app may take to show its window and say Ready. */
export const LAUNCH_TIMEOUT_MS = 60_000;
/** How long one step may take before it fails. */
export const STEP_TIMEOUT_MS = 15_000;
/** How long the whole drive may take when `--timeout` does not say. */
export const DRIVE_TIMEOUT_MS = 180_000;
/** How long a polite close may take before the process tree is killed. */
export const CLOSE_TIMEOUT_MS = 5_000;
/** Mouse moves a drag is made of: enough for pointermove handlers to see a real path. */
export const DRAG_MOVES = 12;

// ---------------------------------------------------------------- launching and closing

export interface LaunchOptions {
  /** Where saves and Chromium's files go. Give every run its own. */
  userDataDir: string;
  /**
   * The app's flags (`--mock`, `--save=...`); size, scale, user data and test hooks are added here.
   * The window is shown. `--hidden` works but is slow and unsure: a hidden window draws no frames
   * by itself, so a click waits about 1.5 s and a screenshot can time out.
   */
  flags?: readonly string[];
  size?: { width: number; height: number };
  timeoutMs?: number;
}

export interface Launched {
  app: ElectronApplication;
  page: Page;
  pid: number;
  userDataDir: string;
}

/**
 * Starts the built app under Playwright and waits until the page has settled: a game is running,
 * or the new-game picker is up, or the sim has failed.
 */
export async function launchApp(o: LaunchOptions): Promise<Launched> {
  if (!existsSync(join(distDir, "main", "index.js"))) {
    throw new Error("no build: run `corepack pnpm@10.20.0 desktop:build` first");
  }
  const size = o.size ?? DEFAULT_SIZE;
  const timeout = o.timeoutMs ?? LAUNCH_TIMEOUT_MS;
  const userDataDir = resolve(o.userDataDir);
  mkdirSync(userDataDir, { recursive: true });
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  // Set by an Electron-based terminal or editor: it would make the app start as plain Node.
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    executablePath: electronPath(),
    cwd: desktopDir,
    args: [
      desktopDir,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${size.width}x${size.height}`,
      "--force-device-scale-factor=1",
      "--test-hooks",
      // Off the screen and without focus, so a run never comes to the front. TC_E2E_SHOW=1 shows it.
      ...(process.env.TC_E2E_SHOW === "1" ? [] : ["--background"]),
      ...(o.flags ?? []),
    ],
    env,
    timeout,
  });
  const pid = app.process().pid ?? 0;
  try {
    const page = await app.firstWindow({ timeout });
    await page.waitForFunction(() => (globalThis as { __tcSim?: unknown }).__tcSim !== undefined, null, {
      timeout,
    });
    await page.evaluate(() => (globalThis as unknown as { __tcSim: { ready: Promise<void> } }).__tcSim.ready);
    // Ready is not yet a game: wait until one runs (the mock and `--save` start by themselves), the
    // new-game picker is up, or the sim has failed, so the first step finds the page settled.
    await page.waitForFunction(
      () => {
        const status = (
          globalThis as unknown as {
            __tcSim: { store: { status: { started: boolean; fatal: string | null; choices: unknown } } };
          }
        ).__tcSim.store.status;
        return status.started || status.fatal !== null || status.choices !== null;
      },
      null,
      { timeout },
    );
    return { app, page, pid, userDataDir };
  } catch (e) {
    await closeApp({ app, pid, userDataDir });
    throw e;
  }
}

/** The ids of live processes whose command line names `userDataDir`: the app and all its children. */
export function appProcesses(userDataDir: string): number[] {
  const dir = resolve(userDataDir);
  if (process.platform === "win32") {
    // The directory goes through the environment, so no quoting of it can go wrong.
    const r = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($env:TC_DRIVE_DIR) } | ForEach-Object { $_.ProcessId }",
      ],
      { encoding: "utf8", env: { ...process.env, TC_DRIVE_DIR: dir } },
    );
    return (r.stdout ?? "")
      .split(/\s+/)
      .filter((s) => /^\d+$/.test(s))
      .map(Number);
  }
  const r = spawnSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" });
  const found: number[] = [];
  for (const line of (r.stdout ?? "").split("\n")) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (m?.[2]?.includes(dir) && Number(m[1]) !== process.pid) found.push(Number(m[1]));
  }
  return found;
}

function killTree(pid: number): void {
  if (pid <= 0) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Already gone.
  }
}

export interface Closed {
  /** The app closed when asked, within CLOSE_TIMEOUT_MS. */
  polite: boolean;
  /** Processes that were still alive after the close and had to be killed. */
  killed: number[];
  /** Processes still alive at the end: always empty unless a kill failed. */
  stray: number[];
}

/**
 * Closes the app, then makes sure: the process tree is killed if the close hangs, and anything
 * still running with this user-data folder on its command line (a renderer, the GPU process, the
 * sim process) is killed too. Never throws. The listing by command line costs about a second on
 * Windows; `"if-killed"` skips it after a polite close, which ends the children by itself.
 */
export async function closeApp(
  l: Pick<Launched, "app" | "pid" | "userDataDir">,
  sweep: "always" | "if-killed" = "always",
): Promise<Closed> {
  let polite = false;
  try {
    polite = await Promise.race([
      l.app.close().then(() => true),
      new Promise<boolean>((done) => setTimeout(() => done(false), CLOSE_TIMEOUT_MS)),
    ]);
  } catch {
    // Already closed, or never connected.
  }
  if (!polite) killTree(l.pid);
  else if (sweep === "if-killed") return { polite, killed: [], stray: [] };
  let left = appProcesses(l.userDataDir);
  const killed = [...left];
  // A child may take a moment to notice its parent has gone: kill, look again.
  for (let i = 0; i < 5 && left.length > 0; i++) {
    for (const pid of left) killTree(pid);
    await new Promise((done) => setTimeout(done, 200));
    left = appProcesses(l.userDataDir);
  }
  return { polite, killed, stray: left };
}

// ---------------------------------------------------------------- steps

/** What a step acts on: a `data-testid`, a visible text, or a CSS selector. A bare string is a test id. */
export type Target = string | { testId?: string; text?: string; css?: string; exact?: boolean; nth?: number };
/** A place for the pointer: page pixels, or a target with an offset from its top left (default: its middle). */
export type Point =
  | [number, number]
  | { x: number; y: number }
  | (Exclude<Target, string> & { at?: [number, number] });

export type Step =
  | { click: Target }
  | { dblclick: Target }
  /** Types text with the keyboard; with a target, puts `value` in that field in place of what it held. */
  | { type: string | (Exclude<Target, string> & { value: string }) }
  /** A key or chord as Playwright names them: "Space", ".", "Control+ArrowLeft". */
  | { press: string | (Exclude<Target, string> & { key: string }) }
  /** Waits some milliseconds, for a target to be `visible` (default) or `hidden`, or for `expr` to be truthy. */
  | {
      wait:
        | number
        | {
            ms?: number;
            testId?: string;
            text?: string;
            css?: string;
            state?: "visible" | "hidden";
            expr?: string;
            timeout?: number;
          };
    }
  /** Presses at `from`, moves to `to` in `moves` moves and releases: a real pointer drag. */
  | { drag: { from: Point; to: Point; moves?: number } }
  /** Saves a PNG of the page, or of one target. */
  | { screenshot: string | { path: string; testId?: string; text?: string; css?: string } }
  /** Evaluates `expr` in the page with `sim` bound to `window.__tcSim`; a promise is awaited. */
  | { eval: string | { expr: string } };

function locate(page: Page, t: Target): Locator {
  const o = typeof t === "string" ? { testId: t } : t;
  let found: Locator;
  if (o.testId !== undefined) found = page.getByTestId(o.testId);
  else if (o.text !== undefined) found = page.getByText(o.text, { exact: o.exact === true });
  else if (o.css !== undefined) found = page.locator(o.css);
  else throw new Error(`a target needs testId, text or css: ${JSON.stringify(t)}`);
  return o.nth === undefined ? found.first() : found.nth(o.nth);
}

function hasTarget(o: object): boolean {
  return "testId" in o || "text" in o || "css" in o;
}

async function pointOf(page: Page, p: Point, timeout: number): Promise<{ x: number; y: number }> {
  if (Array.isArray(p)) return { x: p[0], y: p[1] };
  if ("x" in p && "y" in p) return { x: p.x, y: p.y };
  const target = locate(page, p);
  await target.waitFor({ state: "visible", timeout });
  const box = await target.boundingBox();
  if (box === null) throw new Error(`nothing drawn for ${JSON.stringify(p)}`);
  return p.at === undefined
    ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    : { x: box.x + p.at[0], y: box.y + p.at[1] };
}

/** A real pointer drag: press, a path of moves, release. */
export async function dragPointer(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  moves: number = DRAG_MOVES,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: Math.max(1, moves) });
  await page.mouse.up();
}

/** `expr` evaluated in the page with `sim` bound to the page's SimClient. */
export function evalInPage(page: Page, expr: string): Promise<unknown> {
  // A string goes through the debugger, not the page's own eval, so no content policy stops it.
  return page.evaluate(`(async () => { const sim = globalThis.__tcSim; return (${expr}); })()`);
}

/** Runs one step and returns what it has to say; throws when the step fails. */
export async function runStep(page: Page, step: Step, cwd: string): Promise<Record<string, unknown>> {
  const timeout = STEP_TIMEOUT_MS;
  if ("click" in step) {
    await locate(page, step.click).click({ timeout });
    return {};
  }
  if ("dblclick" in step) {
    await locate(page, step.dblclick).dblclick({ timeout });
    return {};
  }
  if ("type" in step) {
    const t = step.type;
    if (typeof t === "string") await page.keyboard.type(t);
    else if (hasTarget(t)) await locate(page, t).fill(t.value, { timeout });
    else await page.keyboard.type(t.value);
    return {};
  }
  if ("press" in step) {
    const p = step.press;
    if (typeof p === "string") await page.keyboard.press(p);
    else if (hasTarget(p)) await locate(page, p).press(p.key, { timeout });
    else await page.keyboard.press(p.key);
    return {};
  }
  if ("wait" in step) {
    const w = typeof step.wait === "number" ? { ms: step.wait } : step.wait;
    const limit = w.timeout ?? timeout;
    if (w.ms !== undefined) await page.waitForTimeout(w.ms);
    if (hasTarget(w)) await locate(page, w).waitFor({ state: w.state ?? "visible", timeout: limit });
    if (w.expr !== undefined) {
      const started = Date.now();
      while (!(await evalInPage(page, w.expr))) {
        if (Date.now() - started > limit)
          throw new Error(`timed out after ${limit} ms waiting for ${w.expr}`);
        await page.waitForTimeout(50);
      }
    }
    return {};
  }
  if ("drag" in step) {
    const from = await pointOf(page, step.drag.from, timeout);
    const to = await pointOf(page, step.drag.to, timeout);
    await dragPointer(page, from, to, step.drag.moves);
    return { from, to };
  }
  if ("screenshot" in step) {
    const s = typeof step.screenshot === "string" ? { path: step.screenshot } : step.screenshot;
    const path = isAbsolute(s.path) ? s.path : resolve(cwd, s.path);
    mkdirSync(dirname(path), { recursive: true });
    if (hasTarget(s)) await locate(page, s).screenshot({ path, timeout, animations: "disabled" });
    else await page.screenshot({ path, timeout, animations: "disabled" });
    return { path };
  }
  if ("eval" in step) {
    const expr = typeof step.eval === "string" ? step.eval : step.eval.expr;
    const value = await evalInPage(page, expr);
    return { value: value === undefined ? null : value };
  }
  throw new Error(`unknown step: ${JSON.stringify(step)}`);
}

// ---------------------------------------------------------------- the command line

interface DriveArgs {
  steps: Step[];
  size: { width: number; height: number };
  timeoutMs: number;
  userDataDir: string | null;
  /** Flags handed to the app as they are. */
  appFlags: string[];
}

const USAGE = `usage: node apps/desktop/scripts/drive.ts --mock | --save=<file> [options] --steps <file.json | inline JSON>
  --mock                 the mock sim (2020 world, starts by itself, paused)
  --save=<file>          the real sim, loaded from this save, paused
  (neither)              the real sim at the new-game picker (take the machine lock: scripts/heavy)
  --size WxH             the window's content size (default 1600x900)
  --timeout <ms>         the whole run's limit (default ${DRIVE_TIMEOUT_MS})
  --user-data-dir=<dir>  keep the app's files here (default: a fresh folder, removed afterwards)
  --<flag>[=value]       any other flag goes to the app (--world=2020, --paused, --hidden)
steps: [{"click":"tb-step"}, {"dblclick":{"text":"Debug workspace"}}, {"type":{"css":"input","value":"7"}},
  {"press":"Space"}, {"wait":300}, {"wait":{"testId":"win-debug"}}, {"wait":{"expr":"sim.clock.paused"}},
  {"drag":{"from":{"testId":"win-debug-edge-se"},"to":[900,600]}}, {"screenshot":"shot.png"},
  {"eval":"sim.clock.now"}]`;

function parseSize(v: string): { width: number; height: number } {
  const m = /^(\d{2,5})[x,](\d{2,5})$/i.exec(v);
  if (m === null) throw new Error(`--size wants WxH, got ${v}`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

export function parseDriveArgs(argv: readonly string[]): DriveArgs {
  const out: DriveArgs = {
    steps: [],
    size: DEFAULT_SIZE,
    timeoutMs: DRIVE_TIMEOUT_MS,
    userDataDir: null,
    appFlags: [],
  };
  let steps: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    const eq = a.indexOf("=");
    const name = eq < 0 ? a : a.slice(0, eq);
    // `--name value` and `--name=value` both work for this tool's own options.
    const value = (): string => {
      if (eq >= 0) return a.slice(eq + 1);
      const next = argv[++i];
      if (next === undefined) throw new Error(`${name} wants a value`);
      return next;
    };
    if (name === "--steps") steps = value();
    else if (name === "--size") out.size = parseSize(value());
    else if (name === "--timeout") out.timeoutMs = Number(value());
    else if (name === "--user-data-dir") out.userDataDir = value();
    else if (name === "--save") out.appFlags.push(`--save=${resolve(value())}`);
    else if (a.startsWith("--")) out.appFlags.push(a);
    else throw new Error(`not a flag: ${a}`);
  }
  if (steps === null) throw new Error("--steps is missing");
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs <= 0) throw new Error("--timeout wants milliseconds");
  const text = steps.trimStart().startsWith("[") ? steps : readFileSync(resolve(steps), "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("the steps must be a JSON array");
  out.steps = parsed as Step[];
  return out;
}

function say(line: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e)).split("\n")[0] ?? "";

async function main(): Promise<number> {
  let args: DriveArgs;
  try {
    args = parseDriveArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`drive: ${message(e)}\n${USAGE}`);
    return 2;
  }
  const ownDir = args.userDataDir === null;
  const userDataDir =
    args.userDataDir ?? join(scratchDir, "drive", `ud-${process.pid}-${Date.now().toString(36)}`);
  let launched: Launched | null = null;
  let closing: Promise<Closed> | null = null;
  // Whatever happens, the app goes: once, however many of the paths below ask.
  const close = (): Promise<Closed> => {
    closing ??= (async () => {
      const closed: Closed =
        launched !== null
          ? await closeApp(launched)
          : // The launch itself may be what hung or died: sweep by the folder's name.
            await closeApp({ app: { close: async () => {} } as ElectronApplication, pid: 0, userDataDir });
      if (ownDir) rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      return closed;
    })();
    return closing;
  };
  const abort = (why: string, code: number) => {
    void close().then((closed) => {
      say({ done: true, ok: false, error: why, closed });
      process.exit(code);
    });
  };
  process.on("SIGINT", () => abort("interrupted", 130));
  process.on("SIGTERM", () => abort("terminated", 143));
  process.on("uncaughtException", (e) => abort(`uncaught: ${message(e)}`, 1));
  process.on("unhandledRejection", (e) => abort(`unhandled: ${message(e)}`, 1));
  const watchdog = setTimeout(() => abort(`timed out after ${args.timeoutMs} ms`, 1), args.timeoutMs);

  let failed: number | null = null;
  let error: string | null = null;
  const started = Date.now();
  try {
    launched = await launchApp({ userDataDir, flags: args.appFlags, size: args.size });
    const page = launched.page;
    say({
      launched: true,
      pid: launched.pid,
      ms: Date.now() - started,
      flags: args.appFlags,
      viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      // "game": the desktop is up. "picker": the new-game picker waits for a choice.
      state: await evalInPage(
        page,
        "sim.store.status.fatal !== null ? 'fatal' : sim.store.status.started ? 'game' : 'picker'",
      ),
    });
    for (const [i, step] of args.steps.entries()) {
      const t = Date.now();
      const action = Object.keys(step)[0] ?? "?";
      try {
        const result = await runStep(page, step, process.cwd());
        say({ step: i, action, ok: true, ms: Date.now() - t, ...result });
      } catch (e) {
        failed = i;
        error = message(e);
        // What the page looked like when the step failed, for whoever reads the result.
        let shot: string | null = join(scratchDir, "drive", "failure.png");
        try {
          mkdirSync(dirname(shot), { recursive: true });
          await page.screenshot({ path: shot, timeout: 5_000 });
        } catch {
          shot = null;
        }
        say({ step: i, action, ok: false, ms: Date.now() - t, error, screenshot: shot });
        break;
      }
    }
  } catch (e) {
    error = `launch: ${message(e)}`;
  }
  clearTimeout(watchdog);
  const closed = await close();
  const ok = error === null && closed.stray.length === 0;
  say({
    done: true,
    ok,
    steps: args.steps.length,
    ran: failed === null ? (error === null ? args.steps.length : 0) : failed + 1,
    failed,
    error,
    ms: Date.now() - started,
    closed,
  });
  return ok ? 0 : 1;
}

if (import.meta.main) process.exit(await main());
