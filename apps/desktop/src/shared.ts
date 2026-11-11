// What the main process and the sim process say to each other over the utility process's own
// channel (`process.parentPort`). The game's protocol (ToSim, FromSim) does not travel here: it goes
// straight between the page and the sim process through a MessagePort (pivot 15.1).

import type { DateTime, SimDate, StateHash } from "@tc20ff/sim";

/** Where the sim process finds its files. */
export interface SimConfig {
  /** The starting world, or null for the 2020 world (which has no manifest file). */
  world: string | null;
  /** The world's CSVs and the map CSVs. */
  worldDir: string;
  mapDir: string | null;
  /** `<userData>/saves`: slot saves and autosaves (pivot 15.4). */
  savesDir: string;
  /** `assets/starts`: the baked starts and their index.json (pivot 3.5). */
  startsDir: string;
  /** A debug sim, so Omniscient works (D1014): the dev app. */
  debug: boolean;
  /** `--save=<path>`: a save to load before `Ready`. */
  save: string | null;
}

/** A plain run for the determinism check (pivot 16.1): a seed stepped a number of years, as `headless run` does. */
export interface RunRequest {
  world: string | null;
  worldDir: string;
  mapDir: string | null;
  seed: number;
  scenario: string | null;
  years: number;
}

export interface RunReport {
  seed: number;
  years: number;
  ticks: number;
  /** The clock after the last tick. */
  end: DateTime;
  /** The state hash after each month close, in order, as `headless run --hash-monthly` prints them. */
  monthly: { month: string; hash: StateHash }[];
  /** The state hash after the last tick. */
  hash: StateHash;
  wall_ms: number;
  /** `process.versions` of the process that ran it. */
  versions: { node: string; v8: string; electron: string | null };
}

/** What the sim process holds, for the smoke run. */
export interface SimStatus {
  started: boolean;
  seed: number | null;
  now: DateTime | null;
  date: SimDate | null;
  hash: StateHash | null;
}

/** Main to the sim process. `start` carries the page's MessagePort in `ports[0]`. */
export type ToSimProc =
  | { kind: "start"; config: SimConfig }
  | { kind: "status"; id: number }
  | { kind: "run"; id: number; run: RunRequest };

/** The sim process to main. */
export type FromSimProc =
  | { kind: "status"; id: number; status: SimStatus }
  | { kind: "run"; id: number; report: RunReport }
  | { kind: "error"; id: number; message: string };
