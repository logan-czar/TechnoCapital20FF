// The scenarios of a historical world (1995-rework 4): stable growth, unstable growth and
// stagnation, each a growth profile (economy/profiles.ts). Code rather than data, as D978 decided
// for the profiles. These first values (T) only make the three differ; the macro work tunes them
// (1995-rework 10).

import type { EconomyProfile } from "../types/world.ts";
import { LEGACY_PHASES, NO_DRIFT, VANILLA_LT_SCALE, VANILLA_VOLATILITY_SCALE } from "./profiles.ts";

/** A scenario: its name and how the economy plays under it. */
export interface ScenarioSpec {
  id: string;
  label: string;
  profile: EconomyProfile;
}

/** The new-game choice that lets the seed pick, keeping the name back (1995-rework 4.1). */
export const RANDOM_SCENARIO_ID = "random";
/** The scenario when none is asked for. */
export const DEFAULT_SCENARIO_ID = "stable";

/** Stable growth's cycle: the spec 5.1 phases at half strength (T). */
const STABLE_CYCLE_SCALE = 0.5;
/** Unstable growth's cycle and noise: the spec 5.1 phases at half as much again (T). */
const UNSTABLE_SCALE = 1.5;
/** Stagnation's long-term rates (T), as the `stagnation` profile's. */
const STAGNATION_LT_SCALE = 0.3;

function profile(id: string, name: string, p: Partial<EconomyProfile>): EconomyProfile {
  return {
    ...NO_DRIFT,
    id,
    name,
    description: `The ${name} scenario of a historical world (1995-rework 4).`,
    lt_scale: VANILLA_LT_SCALE,
    volatility_scale: VANILLA_VOLATILITY_SCALE,
    ai_boom: false,
    start_phase: "Expansion",
    phases: LEGACY_PHASES,
    ...p,
  };
}

export const SCENARIOS: readonly ScenarioSpec[] = [
  {
    id: "stable",
    label: "Stable growth",
    profile: profile("stable", "Stable growth", { cycle_scale: STABLE_CYCLE_SCALE }),
  },
  {
    id: "unstable",
    label: "Unstable growth",
    profile: profile("unstable", "Unstable growth", {
      volatility_scale: VANILLA_VOLATILITY_SCALE * UNSTABLE_SCALE,
      cycle_scale: UNSTABLE_SCALE,
    }),
  },
  {
    id: "stagnation",
    label: "Stagnation",
    profile: profile("stagnation", "Stagnation", { lt_scale: STAGNATION_LT_SCALE }),
  },
];

/** The scenario with `id`, or undefined; `random` is not one. */
export function scenarioById(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** Whether a new game may ask for `id`. */
export function scenarioKnown(id: string): boolean {
  return id === RANDOM_SCENARIO_ID || scenarioById(id) !== undefined;
}
