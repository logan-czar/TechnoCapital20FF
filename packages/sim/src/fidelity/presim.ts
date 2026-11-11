// The pre-simulation (pivot 3.2, 3.5): a freshly loaded historical world run forward at Coarse
// fidelity to the first day of play, as a stepper a host drives. The host owns the wall clock: it
// calls `presimAdvance` with a tick budget, reads the progress it returns, and between calls may
// yield to its event loop, post the progress or cancel. Nothing here reads a clock, so the state
// reached does not depend on how the run was cut into chunks.
//
// The run is `simRunTicks` (lib.ts): `simRunUntil`'s ticks (`simStep`'s, with no view refresh, no
// notices and no pause handling) in chunks the host chooses. Every view is rebuilt once, when the
// run reaches its end.

import type { WorldData } from "@tc20ff/sim-data";
import { RANDOM_SCENARIO_ID } from "../economy/scenarios.ts";
import { type Sim, type SimOptions, simNew, simNow, simRebuildViews, simRunTicks } from "../lib.ts";
import { dateTimeDate, dateTimeMidnight, simDateYmd } from "../time/calendar.ts";
import type { DateTime, SimDate } from "../types/calendar.ts";
import type { LoadError, Result } from "../types/world.ts";

/** The first day of play (pivot 3.1), where a pre-simulation ends when the world names no other. */
export const PLAY_START: SimDate = simDateYmd(2020, 1, 1);

/** Ticks a host runs between progress reports when it has no better idea: 30 game days. */
export const PRESIM_CHUNK_TICKS = 720;

/** How a pre-simulation is started. */
export interface PresimOptions extends SimOptions {
  /**
   * Where it ends, at 00:00 of that day. Absent: the world's reveal date (1995-rework 8.3), else
   * `PLAY_START`.
   */
  until?: SimDate;
}

/** A pre-simulation's progress (pivot 3.5), as `simRunUntil` reports it. */
export interface PresimProgress {
  /** Ticks run so far and in the whole run. Whole numbers. */
  done: number;
  total: number;
  /** The game day reached. */
  date: SimDate;
}

/** What one `presimAdvance` call says. */
export type PresimStep =
  /** More ticks to run. */
  | ({ kind: "Progress" } & PresimProgress)
  /** The run reached its end and the views are rebuilt: `presimSim` gives the game. */
  | ({ kind: "Done" } & PresimProgress)
  /** `presimCancel` was called: no more ticks run. */
  | ({ kind: "Cancelled" } & PresimProgress);

/** A pre-simulation in progress. Read it through the functions below. */
export interface Presim {
  readonly sim: Sim;
  readonly target: DateTime;
  /** Whole numbers. */
  readonly total: number;
  done: number;
  state: "Running" | "Done" | "Cancelled";
}

/**
 * Starts a pre-simulation: a new game of `data` (a historical world) for `seed`, standing at its
 * first day. The scenario is the hidden random one unless `opts.scenario` names another (pivot
 * 3.2). No tick has run yet.
 */
export function presimStart(
  data: WorldData,
  seed: number,
  opts: PresimOptions = {},
): Result<Presim, LoadError> {
  if (!data.manifest.features.era) {
    return {
      ok: false,
      error: {
        kind: "BadValue",
        table: "manifest",
        key: data.manifest.id,
        message: "only a historical world is pre-simulated",
      },
    };
  }
  const { until, ...simOpts } = opts;
  const made = simNew(data, seed, { ...simOpts, scenario: simOpts.scenario ?? RANDOM_SCENARIO_ID });
  if (!made.ok) return made;
  const sim = made.value;
  const target = dateTimeMidnight(until ?? data.manifest.reveal_date ?? PLAY_START);
  const total = Math.max(0, target - simNow(sim));
  return { ok: true, value: { sim, target, total, done: 0, state: total === 0 ? "Done" : "Running" } };
}

/** Where a pre-simulation stands. */
export function presimProgress(p: Presim): PresimProgress {
  return { done: p.done, total: p.total, date: dateTimeDate(simNow(p.sim)) };
}

/**
 * Runs up to `ticks` more ticks (a whole number, at least 1) and says where the run stands. The
 * call that reaches the end rebuilds every view and answers `Done`; later calls answer `Done` or
 * `Cancelled` again and run nothing.
 */
export function presimAdvance(p: Presim, ticks: number): PresimStep {
  if (!Number.isInteger(ticks) || ticks < 1) throw new RangeError(`presimAdvance: ${ticks} ticks`);
  if (p.state === "Running") {
    p.done += simRunTicks(p.sim, p.target, ticks).ticks;
    if (simNow(p.sim) >= p.target) {
      simRebuildViews(p.sim);
      p.state = "Done";
    }
  }
  return { kind: p.state === "Running" ? "Progress" : p.state, ...presimProgress(p) };
}

/**
 * Cancels a running pre-simulation (pivot 3.5): it runs no more ticks. Its world stands at a whole
 * tick with stale views, and is meant to be dropped. Does nothing to one that is done.
 */
export function presimCancel(p: Presim): void {
  if (p.state === "Running") p.state = "Cancelled";
}

/** The pre-simulated game, once `presimAdvance` has answered `Done`; null before, or if cancelled. */
export function presimSim(p: Presim): Sim | null {
  return p.state === "Done" ? p.sim : null;
}

/**
 * The whole run in one call, for a host with nothing else to do (tests): `chunkTicks` at a time,
 * calling `onProgress` after each chunk; returning false cancels it.
 */
export function presimRun(
  p: Presim,
  onProgress?: (progress: PresimProgress) => boolean | undefined,
  chunkTicks: number = PRESIM_CHUNK_TICKS,
): PresimStep {
  let step = presimAdvance(p, chunkTicks);
  while (step.kind === "Progress") {
    if (onProgress?.(step) === false) presimCancel(p);
    step = presimAdvance(p, chunkTicks);
  }
  return step;
}
