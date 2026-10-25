// The quarterly industry growth draw and the phase labels (spec 5.1, Logan batch 150; 4.3 steps
// 1e and 2). Ported from crates/sim/src/economy/growth.rs.
//
// `q_growth = lt_q + φ × (prev_q_growth − lt_q) + cycle_term + volatility × z`, floored at −25%
// a quarter, with `lt_q = (1 + LT)^(1/4) − 1` and
// `cycle_term = (1 − φ) × cycle_beta × k × Z × g_t ÷ 4`. The expression order follows
// validate.py's `growth_run`, so the M2.10 replay matches it to the last bits.

import type { JobCtx } from "../time/scheduler.ts";
import type { DrawSource } from "../types/draws.ts";
import { clamp, maxF } from "../types/num.ts";
import type { Industry, PhaseLabel, World } from "../types/world.ts";
import { QUARTERS_PER_YEAR } from "./index.ts";

/** φ: half of last quarter's gap from the long-term rate carries over (spec 5.1, T). */
export const PHI = 0.5;
/** q_growth never falls below −25% a quarter (spec 5.1, A). */
export const Q_GROWTH_FLOOR = -0.25;
/** z, the growth shock, is a standard normal clamped to ±3 (spec 5.1). */
export const Z_CLAMP = 3.0;

/** The long-term rate at which an industry feels the cycle one for one (spec 5.1). */
export const K_PIVOT_LT = 0.04;
/** Upswing (g_t ≥ 0): `k = clamp(1 + 5 × (LT − 0.04), 0.5, 2.5)` (spec 5.1, T). */
export const K_UP_SLOPE = 5.0;
export const K_UP_MIN = 0.5;
export const K_UP_MAX = 2.5;
/** Downswing (g_t < 0): `k = clamp(1 − 2.5 × (LT − 0.04), 0.25, 1.5)` (spec 5.1, T). */
export const K_DOWN_SLOPE = 2.5;
export const K_DOWN_MIN = 0.25;
export const K_DOWN_MAX = 1.5;

/** A label's gap threshold: Bust at `gap ≤ −5%`, Boom at `gap ≥ +5%` a year (spec 5.1, A, T). */
export const LABEL_GAP = 0.05;
/** Glut when last month's S is above 1.15 (spec 5.1, T)... */
export const GLUT_ENTER_S = 1.15;
/** ...and it stays Glut until S falls under 1.10. */
export const GLUT_EXIT_S = 1.1;

/** `lt_q = (1 + LT)^(1/4) − 1`, the quarterly long-term rate (spec 5.1, batch 151). */
export function ltQ(lt: number): number {
  return (1.0 + lt) ** (1.0 / QUARTERS_PER_YEAR) - 1.0;
}

/**
 * The asymmetric cycle sensitivity k (spec 5.1): high long-term growth amplifies upswings and
 * damps downswings.
 */
export function cycleK(lt: number, g: number): number {
  if (g >= 0.0) {
    return clamp(1.0 + K_UP_SLOPE * (lt - K_PIVOT_LT), K_UP_MIN, K_UP_MAX);
  }
  return clamp(1.0 - K_DOWN_SLOPE * (lt - K_PIVOT_LT), K_DOWN_MIN, K_DOWN_MAX);
}

/** `cycle_term = (1 − φ) × cycle_beta × k × Z × g_t ÷ 4` (spec 5.1). */
export function cycleTerm(cycleBeta: number, lt: number, zAvg: number, g: number): number {
  return ((1.0 - PHI) * cycleBeta * cycleK(lt, g) * zAvg * g) / QUARTERS_PER_YEAR;
}

/**
 * One quarter's growth (spec 5.1). `carry` is last quarter's growth, or lt_q after the boom or
 * the pop (spec 5.1.1); `z` is the already clamped shock.
 */
export function quarterlyGrowth(
  lt: number,
  carry: number,
  cycleBeta: number,
  volatility: number,
  zAvg: number,
  g: number,
  z: number,
): number {
  const ltq = ltQ(lt);
  const cycle = cycleTerm(cycleBeta, lt, zAvg, g);
  return maxF(ltq + PHI * (carry - ltq) + cycle + volatility * z, Q_GROWTH_FLOOR);
}

/** The growth shock: a growth-stream standard normal clamped to ±3 (spec 5.1). */
export function drawZ(draws: DrawSource): number {
  return clamp(draws.normal("Growth"), -Z_CLAMP, Z_CLAMP);
}

/**
 * Draws one industry's growth for the new quarter: this quarter's growth becomes
 * `prev_q_growth`, and the draw carries over from it (or from lt_q after a reset, D103).
 */
export function drawIndustryGrowth(ind: Industry, zAvg: number, g: number, draws: DrawSource): void {
  ind.prev_q_growth = ind.q_growth;
  const carry = ind.carry_reset ? ltQ(ind.lt) : ind.prev_q_growth;
  ind.carry_reset = false;
  const z = drawZ(draws);
  const p = ind.params;
  ind.q_growth = quarterlyGrowth(ind.lt, carry, p.cycle_beta, p.volatility, zAvg, g, z);
}

/** Every industry's draw, in id order (spec 4.3 step 1e). */
export function drawAllGrowth(world: World, draws: DrawSource): void {
  const zAvg = world.cycle.z_avg;
  const g = world.cycle.g_t;
  for (const ind of world.industries) {
    drawIndustryGrowth(ind, zAvg, g, draws);
  }
}

/** 4.3 step 1e: every industry draws its q_growth for the new quarter. */
export function growthDrawsJob(world: World, ctx: JobCtx): void {
  drawAllGrowth(world, ctx.draws);
}

/** `gap = 4 × (q_growth − lt_q)`: this quarter's growth less the long-term rate, a year (spec 5.1). */
export function growthGap(qGrowth: number, lt: number): number {
  return QUARTERS_PER_YEAR * (qGrowth - ltQ(lt));
}

/**
 * The phase label, first match (spec 5.1): Bust at gap ≤ −5%; Glut when last month's S is
 * above 1.15, or the label was Glut and S has not fallen under 1.10; Boom at gap ≥ +5%; else
 * Normal. `forced` is the AI boom's override for linked industries (spec 5.1.1), which wins
 * over every rule (D104).
 */
export function phaseLabel(
  gap: number,
  lastS: number,
  was: PhaseLabel,
  forced: PhaseLabel | null,
): PhaseLabel {
  if (forced !== null) return forced;
  if (gap <= -LABEL_GAP) return "Bust";
  if (lastS > GLUT_ENTER_S || (was === "Glut" && lastS >= GLUT_EXIT_S)) return "Glut";
  if (gap >= LABEL_GAP) return "Boom";
  return "Normal";
}
