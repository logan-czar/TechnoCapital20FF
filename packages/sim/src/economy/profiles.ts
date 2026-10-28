// Growth profiles (D970): named economic scenarios for the POC. A profile is plain data: a scale
// on every industry's long-term rate, whether the scripted AI boom plays, and the global cycle's
// phase tables with the phase the world starts in. `vanilla` is the flavour-free economy
// (sustained 3% a year, a flat cycle); the others add one spice to it. `legacy` is the spec 5.1
// behaviour the Rust reference has, kept until the parity gate passes (D951).

import type { CyclePhase, EconomyProfile, PhaseSpec, Slowdown, World } from "../types/world.ts";

/** The world demand growth a year that `vanilla` is tuned to (Logan: sustained 3% is regular). */
export const VANILLA_TARGET_GROWTH = 0.03;

/** A year no run reaches: the boom and pop dates of a profile with no AI boom. */
export const NEVER_YEAR = 9999;

/** A flat phase never ends: the cycle adds nothing and growth sits at the long-term rates. */
const FLAT_QUARTERS = 4000;
function steady(): PhaseSpec {
  return { g_range: [0.0, 0.0], length: [FLAT_QUARTERS, FLAT_QUARTERS], next: "Expansion" };
}

function phases(p: Partial<Record<CyclePhase, PhaseSpec>>): Record<CyclePhase, PhaseSpec> {
  return { Expansion: steady(), Overheating: steady(), Contraction: steady(), Recovery: steady(), ...p };
}

/** The spec 5.1 phase table (T), as the Rust reference draws it. */
const LEGACY_PHASES: Record<CyclePhase, PhaseSpec> = {
  Expansion: { g_range: [0.0, 0.02], length: [12, 28], next: "Overheating" },
  Overheating: { g_range: [0.02, 0.04], length: [2, 6], next: "Contraction" },
  Contraction: { g_range: [-0.06, -0.03], length: [2, 8], next: "Recovery" },
  Recovery: { g_range: [-0.02, 0.01], length: [4, 10], next: "Expansion" },
};

/**
 * `lt_scale` of the 3% profiles: the CSV rates weigh 3.78% by 2020 size, and the fast growers gain
 * share as the years pass, so the scale sits below 3 ÷ 3.78. Tuned with the econ-profiles probe.
 */
export const VANILLA_LT_SCALE = 0.695;

/** Vanilla's quarterly noise is half the CSV's, so sustained growth reads as sustained (D970). */
export const VANILLA_VOLATILITY_SCALE = 0.5;

/** The drift-plan settings (D976, D977) a profile can leave out: the pre-v1.5 economy. */
type DriftSettings = Pick<
  EconomyProfile,
  "fade" | "world_growth_scale" | "slowdown" | "cycle_scale" | "price_noise_scale"
>;
const NO_DRIFT: DriftSettings = {
  fade: false,
  world_growth_scale: 1.0,
  slowdown: null,
  cycle_scale: 1.0,
  price_noise_scale: 1.0,
};

const BASE_PROFILES: readonly (Omit<EconomyProfile, keyof DriftSettings> & Partial<DriftSettings>)[] = [
  {
    id: "legacy",
    name: "Legacy",
    description: "The spec 5.1 economy: the CSV rates, the random four-phase cycle and the AI boom.",
    lt_scale: 1.0,
    volatility_scale: 1.0,
    ai_boom: true,
    start_phase: "Expansion",
    phases: LEGACY_PHASES,
  },
  {
    id: "vanilla",
    name: "Vanilla",
    description: "Sustained 3% growth, a flat cycle, no AI boom. Regular, no spice.",
    lt_scale: VANILLA_LT_SCALE,
    volatility_scale: VANILLA_VOLATILITY_SCALE,
    ai_boom: false,
    start_phase: "Expansion",
    phases: phases({}),
  },
  {
    id: "ai_boom",
    name: "Vanilla with the AI boom",
    description: "Vanilla, plus the scripted AI boom in 2030 and its pop around 2040 (spec 5.1.1).",
    lt_scale: VANILLA_LT_SCALE,
    volatility_scale: VANILLA_VOLATILITY_SCALE,
    ai_boom: true,
    start_phase: "Expansion",
    phases: phases({}),
  },
  {
    id: "long_recession",
    name: "Long recession",
    description: "A five to six year contraction from the start, a slow recovery, then vanilla.",
    lt_scale: VANILLA_LT_SCALE,
    volatility_scale: VANILLA_VOLATILITY_SCALE,
    ai_boom: false,
    start_phase: "Contraction",
    phases: phases({
      Contraction: { g_range: [-0.045, -0.03], length: [20, 24], next: "Recovery" },
      Recovery: { g_range: [-0.01, 0.01], length: [8, 12], next: "Expansion" },
    }),
  },
  {
    id: "great_depression",
    name: "Great depression",
    description: "A deep three to four year collapse, a long weak recovery, then vanilla.",
    lt_scale: VANILLA_LT_SCALE,
    volatility_scale: VANILLA_VOLATILITY_SCALE,
    ai_boom: false,
    start_phase: "Contraction",
    phases: phases({
      Contraction: { g_range: [-0.09, -0.07], length: [12, 16], next: "Recovery" },
      Recovery: { g_range: [-0.03, 0.0], length: [16, 20], next: "Expansion" },
    }),
  },
  {
    id: "long_boom",
    name: "Long boom",
    description: "A five to six year boom from the start, a soft landing, then vanilla.",
    lt_scale: VANILLA_LT_SCALE,
    volatility_scale: VANILLA_VOLATILITY_SCALE,
    ai_boom: false,
    start_phase: "Overheating",
    phases: phases({
      Overheating: { g_range: [0.03, 0.04], length: [20, 24], next: "Contraction" },
      Contraction: { g_range: [-0.02, -0.01], length: [4, 6], next: "Recovery" },
      Recovery: { g_range: [-0.005, 0.005], length: [4, 8], next: "Expansion" },
    }),
  },
  {
    id: "boom_bust",
    name: "Boom and bust",
    description: "A three to four year boom that ends in a hard two year bust, then vanilla.",
    lt_scale: VANILLA_LT_SCALE,
    volatility_scale: VANILLA_VOLATILITY_SCALE,
    ai_boom: false,
    start_phase: "Overheating",
    phases: phases({
      Overheating: { g_range: [0.03, 0.04], length: [12, 16], next: "Contraction" },
      Contraction: { g_range: [-0.06, -0.04], length: [8, 10], next: "Recovery" },
      Recovery: { g_range: [-0.01, 0.01], length: [6, 8], next: "Expansion" },
    }),
  },
  {
    id: "stagnation",
    name: "Stagnation",
    description: "A lost decade: long-term rates scaled to a 1% economy and a flat cycle.",
    lt_scale: 0.3,
    volatility_scale: VANILLA_VOLATILITY_SCALE,
    ai_boom: false,
    start_phase: "Expansion",
    phases: phases({}),
  },
];

export const PROFILES: readonly EconomyProfile[] = [
  ...BASE_PROFILES.map((p) => ({ ...NO_DRIFT, ...p })),
  {
    ...NO_DRIFT,
    id: "mature",
    name: "Mature",
    description:
      "Legacy, then every industry's growth fades to its mature rate over decades (drift plan, spec v1.5 5.1).",
    lt_scale: 1.0,
    volatility_scale: 1.0,
    ai_boom: true,
    fade: true,
    start_phase: "Expansion",
    phases: LEGACY_PHASES,
  },
];

export const LEGACY_PROFILE: EconomyProfile = PROFILES[0] as EconomyProfile;
/** The profile a new game plays; stays legacy until the parity gate passes, then vanilla (D970). */
export const DEFAULT_PROFILE_ID = "legacy";

/** The slowdown of the `slow` scenario token: 2050 to 2080 at a third of normal growth (D977). */
export const DEFAULT_SLOWDOWN: Slowdown = { start_year: 2050, years: 30, depth: 1.0 / 3.0 };

/** The `vol-` scenario levels: a scale on the cycle, the industries' shocks and the price noise (D977). */
export const VOLATILITY_LEVELS: Readonly<Record<string, number>> = { low: 0.5, normal: 1.0, high: 2.0 };

/**
 * A profile id with scenario tokens (D977): a base id, then `+slow` (the default slowdown) or
 * `+slow-<start>-<years>-<depth>`, then `+vol-low`, `+vol-normal` or `+vol-high`. The tokens are
 * the headless runner's scenario settings; the baseline game carries none. Null for an unknown
 * base or token.
 */
export function profileById(id: string): EconomyProfile | null {
  const [baseId, ...tokens] = id.split("+");
  const base = PROFILES.find((p) => p.id === baseId);
  if (base === undefined) return null;
  if (tokens.length === 0) return base;
  let out: EconomyProfile = { ...base, id };
  for (const token of tokens) {
    const parts = token.split("-");
    const level = parts[1];
    if (parts[0] === "slow" && (parts.length === 1 || parts.length === 4)) {
      const slowdown: Slowdown =
        parts.length === 1
          ? DEFAULT_SLOWDOWN
          : { start_year: Number(parts[1]), years: Number(parts[2]), depth: Number(parts[3]) };
      if (![slowdown.start_year, slowdown.years, slowdown.depth].every(Number.isFinite)) return null;
      if (slowdown.years <= 0.0 || slowdown.depth < 0.0) return null;
      out = { ...out, slowdown };
    } else if (
      parts[0] === "vol" &&
      parts.length === 2 &&
      level !== undefined &&
      level in VOLATILITY_LEVELS
    ) {
      const k = VOLATILITY_LEVELS[level] as number;
      out = {
        ...out,
        volatility_scale: base.volatility_scale * k,
        cycle_scale: base.cycle_scale * k,
        price_noise_scale: base.price_noise_scale * k,
      };
    } else {
      return null;
    }
  }
  return out;
}

/**
 * The factor on every trend in `year` (D976, D977): the world growth scale, times the slowdown's
 * depth inside its window. 1 for a profile with neither.
 */
export function growthFactor(profile: EconomyProfile, year: number): number {
  const s = profile.slowdown;
  const slow = s !== null && year >= s.start_year && year < s.start_year + s.years ? s.depth : 1.0;
  return profile.world_growth_scale * slow;
}

/**
 * An industry's trend after the fade (spec v1.5 5.1, D976):
 * `mature + (trend - mature) * 0.5^(years / half_life)`, with `years` counted from 1 Jan 2020. The
 * CSV trend when the profile does not fade or the industry has no half life.
 */
export function fadedTrend(
  trend: number,
  mature: number,
  halfLifeYears: number,
  yearsSince2020: number,
  fade: boolean,
): number {
  if (!fade || halfLifeYears <= 0.0) return trend;
  return mature + (trend - mature) * 0.5 ** (yearsSince2020 / halfLifeYears);
}

/** The world's profile; a world built without one (a test, an old save) plays `legacy`. */
export function profileOf(world: Pick<World, "profile">): EconomyProfile {
  return (world as { profile?: EconomyProfile }).profile ?? LEGACY_PROFILE;
}
