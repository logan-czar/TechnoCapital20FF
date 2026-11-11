// The app's command-line flags (apps/desktop/README.md), parsed from argv with no Electron in
// reach so a test can check them. They exist for tests and agents: a player starts the app bare.

import { WORLD_2020_ID, WORLD_IDS } from "@tc20ff/sim-data";

/** Frames the smoke run waits for when `--smoke-frames` does not say. */
export const SMOKE_FRAMES = 30;
/** The seed of a smoke run's new game when `--seed` does not say. */
export const SMOKE_SEED = 1;
/** The scenario of a smoke run's new game in a historical world when `--scenario` does not say. */
export const SMOKE_SCENARIO = "stable";
/** Years of the determinism run when `--years` does not say. */
export const RUN_YEARS = 1;

export interface Flags {
  /** `--mock`: the mock sim in a Web Worker; no sim process. */
  mock: boolean;
  /** `--save=<path>`: load this save before the page sees `Ready`. */
  save: string | null;
  /** `--paused`: the game must stay paused until something resumes it. */
  paused: boolean;
  /** `--window-size=WxH`: the window's content size in pixels. */
  windowSize: { width: number; height: number } | null;
  /** `--user-data-dir=<dir>`: where saves and Chromium's own files go. */
  userDataDir: string | null;
  /** `--world=<id>`: `1995` (the default) or `2020`; anything else is the default. */
  world: string | null;
  /** `--smoke=<out.json>`: start a game, wait for frames, write a report there, exit 0 (1 on failure). */
  smoke: string | null;
  /** `--smoke-frames=N`: frames the smoke run waits for; 0 reports the game as it stands. */
  smokeFrames: number;
  /** `--smoke-save-slot=<name>`: the smoke run saves to this slot before it reports. */
  smokeSaveSlot: string | null;
  /** `--seed=N` and `--scenario=<id>`: the smoke or determinism run's new game. */
  seed: number;
  scenario: string | null;
  /** `--run=<out.json>`: no window; the sim process steps `--years` years and its hashes go there. */
  run: string | null;
  years: number;
  /** `--test-hooks`: the page puts its SimClient on `window.__tcSim` (implied by `--smoke`). */
  testHooks: boolean;
  /** `--dev-server=<url>`: load the page from the Vite dev server (`pnpm desktop:dev` passes it). */
  devServer: string | null;
  /** `--hidden`: do not show the window (the smoke scripts pass it). */
  hidden: boolean;
  /**
   * `--background`: show the window off the screen and without taking focus, so a test run never
   * comes to the front (the end-to-end tests and drive.ts pass it). Unlike `--hidden` it still
   * draws frames, so clicks and screenshots stay fast.
   */
  background: boolean;
}

function count(v: string | undefined, fallback: number): number {
  if (v === undefined || !/^\d+$/.test(v)) return fallback;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : fallback;
}

function size(v: string | undefined): Flags["windowSize"] {
  const m = v === undefined ? null : /^(\d{2,5})[x,](\d{2,5})$/i.exec(v);
  return m === null ? null : { width: Number(m[1]), height: Number(m[2]) };
}

/** Every `--name` or `--name=value` in `argv`; the last of a name wins. Anything else is skipped. */
export function parseFlags(argv: readonly string[]): Flags {
  const given = new Map<string, string>();
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    given.set(eq < 0 ? a.slice(2) : a.slice(2, eq), eq < 0 ? "" : a.slice(eq + 1));
  }
  const text = (name: string): string | null => {
    const v = given.get(name);
    return v === undefined || v === "" ? null : v;
  };
  const world = text("world");
  const smoke = text("smoke");
  return {
    mock: given.has("mock"),
    save: text("save"),
    paused: given.has("paused"),
    windowSize: size(given.get("window-size")),
    userDataDir: text("user-data-dir"),
    world: world !== null && (WORLD_IDS.includes(world) || world === WORLD_2020_ID) ? world : null,
    smoke,
    smokeFrames: count(given.get("smoke-frames"), SMOKE_FRAMES),
    smokeSaveSlot: text("smoke-save-slot"),
    seed: count(given.get("seed"), SMOKE_SEED),
    scenario: text("scenario"),
    run: text("run"),
    years: Math.max(1, count(given.get("years"), RUN_YEARS)),
    testHooks: given.has("test-hooks") || smoke !== null,
    devServer: text("dev-server"),
    hidden: given.has("hidden"),
    background: given.has("background"),
  };
}
