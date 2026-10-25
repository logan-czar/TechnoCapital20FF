// The global business cycle and the zone effects (spec 5.1, Logan batches 150, 152 and 154;
// 4.3 step 1c). Ported from crates/sim/src/economy/cycle.rs.
//
// One world cycle sits in one phase at a time. Entering a phase draws g_t and the phase length,
// both uniform in the phase's ranges; phases change only at quarter boundaries. Each zone feels
// `zone_effect_z = intensity_z × g(t − lag_z)`, plus a zone-only shock where the zone has its own
// dynamics (own_shock_sd above 0). World demand reads `Z × g_t` with no lag (spec 5.1 "Zone
// weighting"); the zone effects move only the zone screens and the credit spreads (5.1.2).

import type { JobCtx } from "../time/scheduler.ts";
import type { DrawSource } from "../types/draws.ts";
import { clamp } from "../types/num.ts";
import type { CyclePhase, GlobalCycle, World } from "../types/world.ts";
import { globalCycleGLagged } from "../world/economy.ts";

/** What a phase draws on entry and where it goes next (spec 5.1 table, T). */
export interface PhaseSpec {
  /** g_t a year, drawn uniform in `lo..hi`. */
  g_range: readonly [number, number];
  /** Length in whole quarters, drawn uniform in `lo..=hi` (D101). */
  length: readonly [number, number];
  next: CyclePhase;
}

/**
 * The spec 5.1 phase table (T). The Contraction and Recovery ranges are written low to high, as
 * validate.py draws them, so a replayed uniform gives the same g to the bit.
 */
export function phaseSpec(phase: CyclePhase): PhaseSpec {
  switch (phase) {
    case "Expansion":
      return { g_range: [0.0, 0.02], length: [12, 28], next: "Overheating" };
    case "Overheating":
      return { g_range: [0.02, 0.04], length: [2, 6], next: "Contraction" };
    case "Contraction":
      return { g_range: [-0.06, -0.03], length: [2, 8], next: "Recovery" };
    case "Recovery":
      return { g_range: [-0.02, 0.01], length: [4, 10], next: "Expansion" };
  }
}

/** The game starts in Expansion (spec 7.3). */
export const START_PHASE: CyclePhase = "Expansion";

/**
 * The growth and own-shock draws are standard normals clamped to ±3 (spec 5.1; D102 for the own
 * shock).
 */
export const NORMAL_CLAMP = 3.0;

/**
 * The draws on entering `phase` (spec 5.1): g_t = lo + (hi − lo) × u from one cycle-stream
 * uniform, then the length as a uniform whole number of quarters (D101). Same order and formula
 * as validate.py's `rng.uniform` then `rng.randint`.
 */
export function enterPhase(phase: CyclePhase, draws: DrawSource): [number, number] {
  const spec = phaseSpec(phase);
  const [lo, hi] = spec.g_range;
  const g = lo + (hi - lo) * draws.uniform("Cycle");
  const [a, b] = spec.length;
  const len = draws.intInclusive("Cycle", a, b);
  if (len < 0) throw new RangeError("phase length is positive");
  return [g, len];
}

/**
 * The cycle at load (spec 7.3): Expansion with g_t and its quarters left drawn; the g history
 * holds the starting g_t for every lag (spec 5.1 "before the start, the starting g_t").
 */
export function startCycle(maxLag: number, zAvgValue: number, draws: DrawSource): GlobalCycle {
  const [g, len] = enterPhase(START_PHASE, draws);
  return {
    phase: START_PHASE,
    quarters_left: len,
    g_t: g,
    g_history: new Array<number>(maxLag + 1).fill(g),
    z_avg: zAvgValue,
  };
}

/**
 * Advances the cycle one quarter (spec 4.3 step 1c): one quarter of the phase is used up; when
 * none is left the next phase starts with fresh draws. The g history shifts by one quarter.
 */
export function advanceCycle(cycle: GlobalCycle, draws: DrawSource): void {
  cycle.quarters_left = Math.max(0, cycle.quarters_left - 1);
  if (cycle.quarters_left === 0) {
    cycle.phase = phaseSpec(cycle.phase).next;
    const [g, len] = enterPhase(cycle.phase, draws);
    cycle.g_t = g;
    cycle.quarters_left = len;
  }
  if (cycle.g_history.length > 0) {
    // rotate_right(1) then [0] = g_t: the oldest entry falls off, the rest shift back.
    cycle.g_history.pop();
    cycle.g_history.unshift(cycle.g_t);
  }
}

/**
 * `Z = Σ gdp_c × intensity_zone(c) ÷ Σ gdp_c` (spec 5.1), from `(gdp, intensity)` per country in
 * id order. 1.07 at the 2020 data; static while GDP is static.
 */
export function zAvg(countries: Iterable<readonly [number, number]>): number {
  let weighted = 0.0;
  let total = 0.0;
  for (const [gdp, intensity] of countries) {
    weighted += gdp * intensity;
    total += gdp;
  }
  return total > 0.0 ? weighted / total : 0.0;
}

/** `zone_effect = intensity × g(t − lag) + own_shock` (spec 5.1), a yearly rate. */
export function zoneEffect(intensity: number, gLagged: number, ownShock: number): number {
  return intensity * gLagged + ownShock;
}

/**
 * This quarter's zone-only shock (spec 5.1): `own_shock_sd × z` with z a cycle-stream standard
 * normal clamped to ±3. No draw is made for a zone with no own dynamics, so adding such a zone
 * never shifts the cycle stream (D102).
 */
export function drawOwnShock(ownShockSd: number, draws: DrawSource): number {
  if (ownShockSd <= 0.0) return 0.0;
  return ownShockSd * clamp(draws.normal("Cycle"), -NORMAL_CLAMP, NORMAL_CLAMP);
}

/** Draws every zone's own shock (zone id order) and sets its effect from the lagged g. */
export function setZoneEffects(world: World, draws: DrawSource): void {
  for (const z of world.zones) {
    z.own_shock = drawOwnShock(z.own_shock_sd, draws);
    z.effect = zoneEffect(z.intensity, globalCycleGLagged(world.cycle, z.lag_quarters), z.own_shock);
  }
}

/** 4.3 step 1c: the global cycle advances one quarter, then the zone effects follow. */
export function cycleJob(world: World, ctx: JobCtx): void {
  advanceCycle(world.cycle, ctx.draws);
  setZoneEffects(world, ctx.draws);
}
