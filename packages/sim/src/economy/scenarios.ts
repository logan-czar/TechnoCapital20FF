// The scenarios of a historical world (1995-rework 4): stable growth, unstable growth and
// stagnation, each a growth profile (economy/profiles.ts) and macro settings. Code rather than
// data, as D978 decided for the profiles. All values (T), against the 4.3 targets.

import type { ScenarioMacro } from "../types/state/era.ts";
import type { CyclePhase, EconomyProfile, PhaseSpec } from "../types/world.ts";
import { NO_DRIFT, VANILLA_VOLATILITY_SCALE } from "./profiles.ts";

/** A scenario: its name, how the economy plays under it, and its macro settings. */
export interface ScenarioSpec {
  id: string;
  label: string;
  profile: EconomyProfile;
  macro: ScenarioMacro;
}

/** The new-game choice that lets the seed pick, keeping the name back (1995-rework 4.1). */
export const RANDOM_SCENARIO_ID = "random";
/** The scenario when none is asked for. */
export const DEFAULT_SCENARIO_ID = "stable";

/** Long recoveries and mild contractions. */
const STABLE_PHASES: Record<CyclePhase, PhaseSpec> = {
  Expansion: { g_range: [0.0, 0.015], length: [16, 32], next: "Overheating" },
  Overheating: { g_range: [0.01, 0.025], length: [2, 6], next: "Contraction" },
  Contraction: { g_range: [-0.04, -0.015], length: [2, 4], next: "Recovery" },
  Recovery: { g_range: [-0.01, 0.01], length: [3, 8], next: "Expansion" },
};

/** Short expansions that run hot, and deep contractions. */
const UNSTABLE_PHASES: Record<CyclePhase, PhaseSpec> = {
  Expansion: { g_range: [0.01, 0.04], length: [6, 16], next: "Overheating" },
  Overheating: { g_range: [0.05, 0.1], length: [3, 8], next: "Contraction" },
  Contraction: { g_range: [-0.3, -0.14], length: [3, 8], next: "Recovery" },
  Recovery: { g_range: [-0.02, 0.03], length: [3, 8], next: "Expansion" },
};

/** Weak expansions and slow recoveries, with shallow but long contractions. */
const STAGNATION_PHASES: Record<CyclePhase, PhaseSpec> = {
  Expansion: { g_range: [-0.005, 0.01], length: [6, 16], next: "Overheating" },
  Overheating: { g_range: [0.0, 0.01], length: [1, 3], next: "Contraction" },
  Contraction: { g_range: [-0.05, -0.02], length: [4, 10], next: "Recovery" },
  Recovery: { g_range: [-0.02, 0.0], length: [6, 14], next: "Expansion" },
};

function profile(id: string, name: string, p: Partial<EconomyProfile>): EconomyProfile {
  return {
    ...NO_DRIFT,
    id,
    name,
    description: `The ${name} scenario of a historical world (1995-rework 4).`,
    lt_scale: 1.0,
    volatility_scale: VANILLA_VOLATILITY_SCALE,
    ai_boom: false,
    start_phase: "Expansion",
    phases: STABLE_PHASES,
    ...p,
  };
}

export const SCENARIOS: readonly ScenarioSpec[] = [
  {
    id: "stable",
    label: "Stable growth",
    profile: profile("stable", "Stable growth", { lt_scale: 0.76, phases: STABLE_PHASES }),
    macro: {
      neutral_end: 0.03,
      rate_gap_k: 0.5,
      rate_g_k: 0.5,
      catchup: 0.08,
      zone_shock_sd: 0.005,
      startup_mean: 2.0,
    },
  },
  {
    id: "unstable",
    label: "Unstable growth",
    profile: profile("unstable", "Unstable growth", {
      lt_scale: 0.72,
      volatility_scale: VANILLA_VOLATILITY_SCALE * 1.5,
      phases: UNSTABLE_PHASES,
    }),
    macro: {
      neutral_end: 0.03,
      rate_gap_k: 0.6,
      rate_g_k: 0.6,
      catchup: 0.08,
      zone_shock_sd: 0.015,
      startup_mean: 2.0,
    },
  },
  {
    id: "stagnation",
    label: "Stagnation",
    profile: profile("stagnation", "Stagnation", { lt_scale: 0.6, phases: STAGNATION_PHASES }),
    macro: {
      neutral_end: 0.01,
      rate_gap_k: 0.5,
      rate_g_k: 0.5,
      catchup: 0.02,
      zone_shock_sd: 0.005,
      startup_mean: 0.75,
    },
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
