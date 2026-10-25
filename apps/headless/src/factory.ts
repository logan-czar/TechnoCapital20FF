// The injected sim factory. The runner commands (run, soak, record, replay) build their games only
// through a `SimFactory`, so the headless code typechecks against the SimApi interface now and is
// wired to the real `simNew` (W1, packages/sim/src/lib.ts) by changing one import below.
import type { Notice, SimApi } from "@tc20ff/sim";
import type { World } from "@tc20ff/sim/internal";
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

export function isSoakSim(sim: SimApi): sim is SoakSim {
  return typeof (sim as Partial<SoakSim>).soakWorld === "function";
}

export function isObservedSim(sim: SimApi): sim is ObservedSim {
  return typeof (sim as Partial<ObservedSim>).stepObserved === "function";
}

// ---- WIRE-UP POINT -----------------------------------------------------------------------------
// When W1's `simNew` lands, replace the body of `defaultFactory` with
//   import { simNew } from "@tc20ff/sim/internal";   // (or wherever lib.ts is re-exported)
//   export const defaultFactory: SimFactory = (data, seed) => simNew(data, seed);
// and delete the throw. Nothing else in apps/headless needs to change.
export const defaultFactory: SimFactory = () => {
  throw new Error("wire to simNew: apps/headless/src/factory.ts defaultFactory is not connected yet");
};
