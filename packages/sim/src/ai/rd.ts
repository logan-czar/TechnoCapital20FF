// The R&D plan (spec 6.3): the target from rd_norm, the archetype R&D mult, the productivity
// adjustment and the trait mults, cut in a loss, less free R&D, clamped to 0 to 3 × rd_norm.
// Ported from crates/sim/src/ai/rd.rs.
//
// The trait mults (`TRAIT_RD_MULTS`, their product `traitMult`, D264) and the clamp
// (`RD_PLAN_MAX_NORMS`) are M4's, in ./archetype.ts; `rdPlanAtLoad` is this plan at productivity
// 100 and loss_q 0 (tested equal).

import { clamp, maxF, minF } from "../types/num.ts";
import type { Trait } from "../types/state/people.ts";
import { RD_PLAN_MAX_NORMS, traitRdMult } from "./archetype.ts";

export { RD_PLAN_MAX_NORMS, TRAIT_RD_MULTS, traitRdMult as traitMult } from "./archetype.ts";

/**
 * Spec 6.3: the productivity adj applies below this productivity (T). The spec's 95 is tuned to
 * 100 (M10.7, D360, pending Logan): the AI defends the starting productivity, not 95.
 */
export const LOW_PRODUCTIVITY_BELOW = 100.0;
/**
 * Spec 6.3: the adj below LOW_PRODUCTIVITY_BELOW (T). The spec's +0.25 is tuned to +0.5 (M10.7,
 * D360, pending Logan; design fix 108): with 5.6, an Incumbent at 1.25 × norm gains
 * `10 × 0.25 × mgmt_factor ÷ 12` ≈ 0.21 a month against 0.3 to 0.5 of decay, so productivity only
 * fell (median 87 after 10 years); at 1.5 × norm it gains about 0.42 and holds near 100.
 */
export const LOW_PRODUCTIVITY_ADJ = 0.5;
/** Spec 6.3: −0.2 above productivity 110. */
export const HIGH_PRODUCTIVITY_ABOVE = 110.0;
export const HIGH_PRODUCTIVITY_ADJ = -0.2;
/** Spec 6.3: loss_q ≥ 2 cuts the target ×0.8 ... */
export const LOSS_CUT_QUARTERS = 2;
export const LOSS_CUT = 0.8;
/** ... never below 0.5 × rd_norm. */
export const LOSS_CUT_FLOOR_NORMS = 0.5;
/** free_rd_pct is a whole percent (5.9); rd_plan is a fraction of revenue (D211). */
export const PERCENT = 100.0;

/**
 * The productivity adjustment (spec 6.3): +0.5 below 100 (D360; the spec says +0.25 below 95),
 * −0.2 above 110, else 0.
 */
export function productivityAdj(productivity: number): number {
  if (productivity < LOW_PRODUCTIVITY_BELOW) return LOW_PRODUCTIVITY_ADJ;
  if (productivity > HIGH_PRODUCTIVITY_ABOVE) return HIGH_PRODUCTIVITY_ADJ;
  return 0.0;
}

/** What the R&D plan reads (spec 6.3). */
export interface RdInputs {
  /** industries.csv `rd_norm`. */
  rd_norm: number;
  /** The archetype's R&D mult (6.1). */
  archetype_rd_mult: number;
  productivity: number;
  /** The traits the AI reads (none for a born company, 5.19.5). */
  traits: readonly Trait[];
  /** Whole number (u32). */
  loss_q: number;
  /** This month's free R&D, whole percent (5.9 `free_rd_pct`; u32). */
  free_rd_pct: number;
}

/**
 * The R&D target before free R&D (spec 6.3): `rd_norm × (archetype R&D mult + productivity adj) ×
 * trait mult`; with loss_q ≥ 2 ×0.8, but the cut never takes it below 0.5 × rd_norm (a target
 * already under that floor is not lifted, D264).
 */
export function rdTarget(i: RdInputs): number {
  const target = i.rd_norm * (i.archetype_rd_mult + productivityAdj(i.productivity)) * traitRdMult(i.traits);
  if (i.loss_q >= LOSS_CUT_QUARTERS) {
    return maxF(target * LOSS_CUT, minF(target, LOSS_CUT_FLOOR_NORMS * i.rd_norm));
  }
  return target;
}

/**
 * The locked R&D plan, a fraction of revenue (spec 6.3): `max(0, target − free_rd_pct)`, so held
 * data saves cash, clamped to 0 to 3 × rd_norm. Arrowhead (Cash cow, Greedy, 1% free): 0.05 × 0.7
 * × 0.8 − 0.01 = 1.8% (7.1).
 */
export function rdPlan(i: RdInputs): number {
  const free = i.free_rd_pct / PERCENT;
  return clamp(rdTarget(i) - free, 0.0, RD_PLAN_MAX_NORMS * i.rd_norm);
}
