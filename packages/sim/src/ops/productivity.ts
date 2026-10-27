// Productivity decay and the R&D effect (spec 5.6; 10.0.4, 10.5.2, 10.0.11.3). Ported from
// crates/sim/src/ops/productivity.rs.

import { mgmtFactor } from "../people/management.ts";
import { clamp } from "../types/num.ts";
import type { Stations } from "../types/state/ops.ts";
import { stationsTotal } from "./stations.ts";

/** Spec 5.6: the R&D effect's points a year per 1× of rd_norm above the norm. */
export const RD_EFFECT_POINTS_PER_YEAR = 10.0;
/** Months in a year (the `÷ 12` of 5.6). */
export const MONTHS_PER_YEAR = 12.0;
/** Spec 5.6: decay 0.5 a month. */
export const DECAY_PER_MONTH = 0.5;
/** Spec 5.6: 0.4 with 10%+ of labor idle. */
export const DECAY_SOME_IDLE = 0.4;
/** Spec 5.6: 0.3 with 25%+ idle. */
export const DECAY_MUCH_IDLE = 0.3;
/** Spec 5.6: the idle percent thresholds. */
export const SOME_IDLE_PERCENT = 10;
export const MUCH_IDLE_PERCENT = 25;
/** Spec 5.6: productivity clamp (T). */
export const PRODUCTIVITY_MIN = 30.0;
export const PRODUCTIVITY_MAX = 200.0;
/** Spec 5.6: research multiplier +0.01 per 10× of research labor (×1.01 at 1 to 9). */
export const RESEARCH_MULT_STEP = 0.01;
/**
 * D973: R&D above the norm has diminishing returns. The overspend `x = rd_total ÷ rd_norm − 1` counts
 * as `x ÷ (1 + x ÷ RD_DIMINISHING_X)`: half as much at x = RD_DIMINISHING_X, never more than it.
 * Spending under the norm costs in full. Spec 5.6 has no such curve (a design fix for Logan).
 */
export const RD_DIMINISHING_X = 1.0;

/** The R&D overspend that counts toward productivity (D973). `Infinity` is spec 5.6 as written. */
export function rdEffect(x: number, diminishingX: number = RD_DIMINISHING_X): number {
  return x > 0.0 ? x / (1.0 + x / diminishingX) : x;
}

/** Integer percent divisor. */
const PERCENT = 100;

/**
 * Research multiplier (spec 5.6; 10.0.11.3): 0 research units ×1.00; 1 to 9 ×1.01; 10 to 99
 * ×1.02; 100 to 999 ×1.03; +0.01 per further 10×. Counted by decimal digits, exactly (D211).
 */
export function researchMult(researchUnits: number): number {
  // Rust `u64::ilog10(n) + 1`: the number of decimal digits.
  const digits = researchUnits === 0 ? 0 : String(researchUnits).length;
  return 1.0 + RESEARCH_MULT_STEP * digits;
}

/**
 * Monthly productivity decay (spec 5.6; 10.0.11.3): 0.5; 0.4 with 10%+ of labor idle; 0.3 with
 * 25%+ idle. Shares are compared in whole units (`idle × 100 ≥ 25 × L`), so no rounding (D211).
 */
export function idleDecay(idle: number, labor: number): number {
  const l = Math.max(labor, 1);
  if (idle * PERCENT >= MUCH_IDLE_PERCENT * l) return DECAY_MUCH_IDLE;
  if (idle * PERCENT >= SOME_IDLE_PERCENT * l) return DECAY_SOME_IDLE;
  return DECAY_PER_MONTH;
}

/** What the 5.6 step reads for one unit. */
export interface ProductivityInputs {
  /** The locked R&D plan, a fraction of revenue. */
  rd_plan: number;
  /** Free R&D from held data, a fraction of revenue (5.9; `free_rd_pct ÷ 100`). */
  free_rd: number;
  /** The industry's R&D norm. */
  rd_norm: number;
  /** The corporation's management score, 0 to 100 (5.7). */
  management_score: number;
  /** Research stations (u64). */
  research_units: number;
  /** Idle stations (u64). */
  idle_units: number;
  /** Labor units L (u64). */
  labor: number;
  /** The R&D curve (D973); absent plays RD_DIMINISHING_X. */
  rd_diminishing_x?: number;
}

/** The inputs for `stations` (research and idle from it, L its total). Rust `ProductivityInputs::with_stations`. */
export function productivityInputsWithStations(
  rdPlan: number,
  freeRd: number,
  rdNorm: number,
  managementScore: number,
  stations: Stations,
): ProductivityInputs {
  return {
    rd_plan: rdPlan,
    free_rd: freeRd,
    rd_norm: rdNorm,
    management_score: managementScore,
    research_units: stations.research,
    idle_units: stations.idle,
    labor: stationsTotal(stations),
  };
}

/**
 * The month's productivity change (spec 5.6):
 * `Δ = (10 × (rd_total ÷ rd_norm − 1) × mgmt_factor × research_mult) ÷ 12 − decay`, with
 * `rd_total = rd_plan + free_rd_pct` (free R&D works exactly like spending, 10.0.11.7).
 */
export function productivityDelta(inp: ProductivityInputs): number {
  if (!(inp.rd_norm > 0.0)) throw new Error("rd_norm must be positive");
  const rdTotal = inp.rd_plan + inp.free_rd;
  return (
    (RD_EFFECT_POINTS_PER_YEAR *
      rdEffect(rdTotal / inp.rd_norm - 1.0, inp.rd_diminishing_x) *
      mgmtFactor(inp.management_score) *
      researchMult(inp.research_units)) /
      MONTHS_PER_YEAR -
    idleDecay(inp.idle_units, inp.labor)
  );
}

/** Productivity after one month (spec 5.6), clamped to 30 to 200. */
export function stepProductivity(productivity: number, inp: ProductivityInputs): number {
  return clamp(productivity + productivityDelta(inp), PRODUCTIVITY_MIN, PRODUCTIVITY_MAX);
}
