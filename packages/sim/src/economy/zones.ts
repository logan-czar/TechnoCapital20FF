// Zone economy: the effective credit spread (spec 5.1.2, Logan batch 157; 4.3 step 1d). Ported
// from crates/sim/src/economy/zones.rs.
//
// `credit_spread_z = round(clamp(base_z × (1 − 8 × zone_effect_z), 0.5 × base_z, 2 × base_z))`
// in bps, recomputed each quarter from the fixed base after the cycle advances, so it always
// reverts to the base as the cycle does. Confidence (daily, 4.2 step 6) is M5's.

import type { JobCtx } from "../time/scheduler.ts";
import { clamp, roundHalfAway } from "../types/num.ts";
import { BPS_PER_UNIT, type World } from "../types/world.ts";

/** k of the spread formula: how far one point of zone effect moves the spread (spec 5.1.2, T). */
export const SPREAD_CYCLE_K = 8.0;
/** The effective spread stays within these multiples of the base (spec 5.1.2, T). */
export const SPREAD_MIN_MULT = 0.5;
export const SPREAD_MAX_MULT = 2.0;

/**
 * The effective zone spread in whole bps from the base in bps and the zone effect (spec 5.1.2).
 * A zone with base 0 stays at 0.
 */
export function effectiveSpreadBps(baseBps: number, zoneEffect: number): number {
  const raw = baseBps * (1.0 - SPREAD_CYCLE_K * zoneEffect);
  return roundHalfAway(clamp(raw, SPREAD_MIN_MULT * baseBps, SPREAD_MAX_MULT * baseBps));
}

/** The same as a fraction, as the world stores rates (D3). */
export function effectiveSpread(base: number, zoneEffect: number): number {
  return effectiveSpreadBps(base * BPS_PER_UNIT, zoneEffect) / BPS_PER_UNIT;
}

/** Recomputes every zone's effective credit spread from its effect. */
export function setZoneSpreads(world: World): void {
  for (const z of world.zones) {
    z.credit_spread = effectiveSpread(z.credit_spread_base, z.effect);
  }
}

/** 4.3 step 1d: every zone's effective credit spread. */
export function zoneSpreadsJob(world: World, _ctx: JobCtx): void {
  setZoneSpreads(world);
}
