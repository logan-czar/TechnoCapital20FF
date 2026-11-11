// `bake` (pivot 3.5): makes one pre-baked start. It loads the 1995 world, runs the Coarse
// pre-simulation to the first day of play (pivot 3.2), hydrates it to Full (pivot 3.4) and writes
// the save as `<DIR>/<name>.tcsave`, then adds the start to `<DIR>/index.json`.
//
//   headless bake --seed N [--scenario ID] --out DIR [--name NAME] [--label TEXT] [--data-dir DIR | --world ID]
//
// The scenario is the hidden random one unless `--scenario` names it. A hidden scenario is written
// to the index as "hidden": the index is read by the game's start screen, and the name stays back
// until the player reads the world's history. The index holds nothing that depends on the machine
// or the wall clock, so baking the same seed again writes the same entry.
//
// The pre-simulation runs in chunks with a turn of the event loop between them, as a game host
// runs it (fidelity/presim.ts): the wall clock is read here, never in the sim.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BakedStart } from "@tc20ff/sim";
import {
  formatSimDate,
  type HydrateReport,
  PRESIM_CHUNK_TICKS,
  type PresimProgress,
  presimAdvance,
  presimSim,
  presimStart,
  RANDOM_SCENARIO_ID,
  SAVE_VERSION,
  type Sim,
  simHydrate,
  simSaveBytes,
  simStateHash,
} from "@tc20ff/sim/internal";
import { DEFAULT_WORLD_ID, type WorldData } from "@tc20ff/sim-data";
import { worldDataDir } from "@tc20ff/sim-data/node";
import { parseCount, userPath } from "./args.ts";

/** The extension of a save file (pivot 15.4). */
export const SAVE_EXT = ".tcsave";
/** The index of a folder of baked starts. */
export const INDEX_FILE = "index.json";
/** The index's own layout version. */
export const INDEX_VERSION = 1;
/** What the index says of a scenario the seed picked. */
export const SCENARIO_HIDDEN = "hidden";

/** One start in `index.json`: what the game lists (`BakedStart`) and what the checks read. */
export interface StartEntry extends BakedStart {
  /** The scenario's id when the baker named it, else `SCENARIO_HIDDEN`. */
  scenario: string;
  /** The first day of play, `YYYY-MM-DD`. */
  date: string;
  /** The save's file name in the index's folder, and its size. */
  file: string;
  bytes: number;
}

/** `index.json`. Starts are in id order. */
export interface StartIndex {
  version: number;
  starts: StartEntry[];
}

/** Arguments of `bake`. */
export interface BakeArgs {
  seed: number;
  /** Undefined: the hidden random scenario. */
  scenario: string | undefined;
  out: string;
  /** The start's id and file name; `seed-<N>` when null. */
  name: string | null;
  label: string | null;
  dir: string;
}

export function parseBake(args: readonly string[]): BakeArgs | null {
  let seed: number | null = null;
  let scenario: string | undefined;
  let out: string | null = null;
  let name: string | null = null;
  let label: string | null = null;
  let dir = worldDataDir(DEFAULT_WORLD_ID);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const v = args[++i];
    if (v === undefined) return null;
    switch (flag) {
      case "--seed":
        seed = parseCount(v);
        if (seed === null) return null;
        break;
      case "--scenario":
        scenario = v;
        break;
      case "--out":
        out = userPath(v);
        break;
      case "--name":
        // A file name and an id: no folders.
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(v)) return null;
        name = v;
        break;
      case "--label":
        label = v;
        break;
      case "--data-dir":
        dir = userPath(v);
        break;
      case "--world":
        dir = worldDataDir(v);
        break;
      default:
        return null;
    }
  }
  return seed === null || out === null ? null : { seed, scenario, out, name, label, dir };
}

/** One turn of the event loop, so a host stays responsive between chunks. */
function turn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Wall seconds each part of a bake took. */
export interface BakeTimings {
  start_s: number;
  presim_s: number;
  hydrate_s: number;
  hash_s: number;
  save_s: number;
}

/** A baked start in memory. */
export interface Baked {
  sim: Sim;
  hydrate: HydrateReport;
  hash: string;
  bytes: Uint8Array;
  ticks: number;
  timings: BakeTimings;
}

const seconds = (from: number): number => (performance.now() - from) / 1000;

/**
 * "Generate a new history" (pivot 3.5) in this process: a new game of `data`, the pre-simulation in
 * chunks of `chunkTicks`, the hydration, the first day's hash and the save bytes. `onProgress` is
 * called after each chunk; returning false cancels it, and the answer is then null.
 */
export async function bakeStart(
  data: WorldData,
  seed: number,
  scenario: string | undefined,
  onProgress?: (p: PresimProgress) => boolean | undefined,
  chunkTicks: number = PRESIM_CHUNK_TICKS,
): Promise<Baked | null> {
  let t = performance.now();
  const started = presimStart(data, seed, { scenario: scenario ?? RANDOM_SCENARIO_ID });
  if (!started.ok) throw new Error(`the world did not start: ${JSON.stringify(started.error)}`);
  const presim = started.value;
  const start_s = seconds(t);

  t = performance.now();
  let step = presimAdvance(presim, chunkTicks);
  while (step.kind === "Progress") {
    if (onProgress?.(step) === false) return null;
    await turn();
    step = presimAdvance(presim, chunkTicks);
  }
  const sim = presimSim(presim);
  if (sim === null) return null;
  const presim_s = seconds(t);

  t = performance.now();
  const hydrate = simHydrate(sim);
  const hydrate_s = seconds(t);

  t = performance.now();
  const hash = simStateHash(sim);
  const hash_s = seconds(t);

  t = performance.now();
  const bytes = simSaveBytes(sim);
  const save_s = seconds(t);

  return {
    sim,
    hydrate,
    hash,
    bytes,
    ticks: step.done,
    timings: { start_s, presim_s, hydrate_s, hash_s, save_s },
  };
}

/** Reads a folder's index; an absent one is empty. Throws on one this build does not know. */
export function readIndex(dir: string): StartIndex {
  const path = join(dir, INDEX_FILE);
  if (!existsSync(path)) return { version: INDEX_VERSION, starts: [] };
  const index = JSON.parse(readFileSync(path, "utf8")) as StartIndex;
  if (index.version !== INDEX_VERSION || !Array.isArray(index.starts)) {
    throw new Error(`${path} is not a version ${INDEX_VERSION} start index`);
  }
  return index;
}

/** `index` with `entry` in place of any start of the same id, in id order. */
export function indexWith(index: StartIndex, entry: StartEntry): StartIndex {
  const starts = [...index.starts.filter((s) => s.id !== entry.id), entry];
  starts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { version: INDEX_VERSION, starts };
}

/** The `bake` command: bakes one start into `a.out` and prints what it took. */
export async function bakeCommand(data: WorldData, a: BakeArgs): Promise<void> {
  const whole = performance.now();
  const id = a.name ?? `seed-${a.seed}`;
  let lastYear = 0;
  const baked = await bakeStart(data, a.seed, a.scenario, (p) => {
    // One line a game year: a bounded rate whatever the chunk size.
    if (p.date.year !== lastYear) {
      lastYear = p.date.year;
      console.error(`  ${formatSimDate(p.date)}  ${p.done}/${p.total} ticks`);
    }
    return undefined;
  });
  if (baked === null) throw new Error("the pre-simulation was cancelled");

  let t = performance.now();
  mkdirSync(a.out, { recursive: true });
  const file = `${id}${SAVE_EXT}`;
  writeFileSync(join(a.out, file), baked.bytes);
  const entry: StartEntry = {
    id,
    label: a.label ?? `Seed ${a.seed}`,
    seed: a.seed,
    save_version: SAVE_VERSION,
    hash: baked.hash,
    scenario: a.scenario === undefined || a.scenario === RANDOM_SCENARIO_ID ? SCENARIO_HIDDEN : a.scenario,
    date: formatSimDate(baked.hydrate.date),
    file,
    bytes: baked.bytes.length,
  };
  writeFileSync(join(a.out, INDEX_FILE), `${JSON.stringify(indexWith(readIndex(a.out), entry), null, 2)}\n`);
  const write_s = seconds(t);
  t = whole;

  const k = baked.timings;
  const f = (s: number): string => s.toFixed(1);
  console.log(
    `baked ${join(a.out, file)}: seed ${a.seed}, ${entry.date}, ${baked.ticks} ticks, ` +
      `${entry.bytes} bytes, hash ${entry.hash}`,
  );
  console.log(
    `  bars kept ${baked.hydrate.bars_kept}, dropped ${baked.hydrate.bars_dropped}; ` +
      `seconds: start ${f(k.start_s)}, presim ${f(k.presim_s)}, hydrate ${f(k.hydrate_s)}, ` +
      `hash ${f(k.hash_s)}, save ${f(k.save_s)}, write ${f(write_s)}, whole ${f(seconds(t))}`,
  );
}
