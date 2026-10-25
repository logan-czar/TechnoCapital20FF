// The injected sim factory. The runner commands (run, soak, record, replay) build their games only
// through a `SimFactory`, so they are testable with a stub sim (test/stub-sim.ts). The default is
// the real Sim (packages/sim/src/lib.ts `simNew`), seen through `HeadlessSim`: SimApi plus the
// hooks only the headless runner uses (Rust features `soak-stats` and the M10.6 profiler).
import { readFileSync, writeFileSync } from "node:fs";
import type { Notice, SimApi } from "@tc20ff/sim";
import {
  type SaveFiles,
  type Sim,
  simNew,
  simSoakStats,
  simSoakWorld,
  simStepObserved,
  type World,
} from "@tc20ff/sim/internal";
import type { WorldData } from "@tc20ff/sim-data";
import type { SimFactory, SoakSimApi } from "./metrics.ts";
import type { TickObserver } from "./profile.ts";

// The factory type and the soak totals are declared next to runSeed (metrics.ts).
export type { SimFactory, SoakSimApi, SoakStats } from "./metrics.ts";

/**
 * The raw-world read of the detail tables (Rust feature `soak-stats`, D427, D900): `soak_world()`.
 * It is not in SimApi (the public face never exposes raw tables), so a sim built for the headless
 * runner implements it as well.
 */
export interface SoakSim extends SoakSimApi {
  soakWorld(): World;
}

/** A sim that can be profiled per scheduler part (Rust `Sim::step_observed`, D400). */
export interface ObservedSim extends SimApi {
  stepObserved(observer: TickObserver): Notice[];
}

/** What the default factory builds: every hook the runner reads. */
export type HeadlessSim = SoakSim & ObservedSim;

export function isSoakSim(sim: SimApi): sim is SoakSim {
  return typeof (sim as Partial<SoakSim>).soakWorld === "function";
}

export function isObservedSim(sim: SimApi): sim is ObservedSim {
  return typeof (sim as Partial<ObservedSim>).stepObserved === "function";
}

/** node:fs for the sim's Save and Load controls (`SimOptions.files`). */
export const NODE_FILES: SaveFiles = {
  read: (path) => new Uint8Array(readFileSync(path)),
  write: (path, bytes) => writeFileSync(path, bytes),
};

/** `sim` with the headless hooks as methods (they are free functions in @tc20ff/sim/internal). */
export function headlessSim(sim: Sim): HeadlessSim {
  return {
    step: () => sim.step(),
    apply: (control) => sim.apply(control),
    saveBytes: () => sim.saveBytes(),
    loadBytes: (bytes) => sim.loadBytes(bytes),
    now: () => sim.now(),
    stateHash: () => sim.stateHash(),
    seed: () => sim.seed(),
    views: () => sim.views(),
    clock: () => sim.clock(),
    controls: () => sim.controls(),
    soakStats: () => simSoakStats(sim),
    soakWorld: () => simSoakWorld(sim),
    stepObserved: (observer) => simStepObserved(sim, observer),
  };
}

/**
 * Rust `Sim::new(data, seed)` for the runner: the game build (not debug), with file access for the
 * Save and Load controls. Throws while a Step 2 start call is not ported (lib.ts `START_DEPS`).
 */
export const defaultFactory: SimFactory = (data: WorldData, seed: number) => {
  const r = simNew(data, seed, { files: NODE_FILES });
  return r.ok ? { ok: true, value: headlessSim(r.value) } : r;
};
