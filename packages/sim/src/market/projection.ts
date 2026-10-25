// Projections and consensus (spec 5.16; 21.5.1): the consensus set at the plan lock from the
// no-rolls projection, and the shown range around a projection, which narrows as the quarter
// passes, ×2 for a company whose plan is secret, never under ±3%. Ported from
// crates/sim/src/market/projection.rs.

import {
  dateTimeDate,
  dateTimeHours,
  dateTimeMidnight,
  quarterFirstDay,
  quarterNext,
  simDateQuarter,
} from "../time/calendar.ts";
import type { DateTime } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import { clamp, maxF } from "../types/num.ts";

/**
 * Spec 5.16: `consensus = projection × (1 + e)`, e uniform ±5% (T), widened to ±15% by the M10
 * tuning pass as 5.16 asks when the beat rate is low (M10.7, D361, signed off by Logan): at ±5%
 * only 10% to 12% of the 2020s releases are beats against spec 10's 30% to 60%; at ±15% about
 * 36%.
 */
export const CONSENSUS_ERROR = 0.15;
/** Spec 5.16 (21.5.1): the range starts at ±30% ... */
export const RANGE_BASE = 0.3;
/** ... narrows by `1 − 0.6 × share of the quarter elapsed` ... */
export const RANGE_ELAPSED_SHRINK = 0.6;
/** ... and by `1 − viewer's Finance ÷ 50`; the MVP viewer (the observer) has Finance 24. */
export const RANGE_FINANCE_DIVISOR = 50.0;
export const OBSERVER_FINANCE = 24.0;
/** ... ×0.7 with Pdoomberg (the observer always has it in the MVP) ... */
export const RANGE_PDOOMBERG_MULT = 0.7;
/** ... ×2 for a company whose plan is secret (all of them, for the observer) ... */
export const RANGE_SECRET_MULT = 2.0;
/** ... and never under ±3%. */
export const RANGE_MIN = 0.03;

/**
 * The consensus for the quarter (spec 5.16): `projection × (1 + e)`, e = −15% + 30% × u from one
 * prices-stream uniform (D252, D361). With NoNoise (u = 0.5) the consensus is the projection.
 */
export function consensus(projection: number, draws: DrawSource): number {
  const e = CONSENSUS_ERROR * (2.0 * draws.uniform("Prices") - 1.0);
  return projection * (1.0 + e);
}

/**
 * Share of the calendar quarter elapsed at `t`, 0 to 1 (spec 21.5.1; D252): hours since 00:00 on
 * the quarter's first day ÷ the quarter's hours. The projection is of the calendar quarter the
 * plan lock falls in (accounting quarters are calendar quarters, 4.4).
 */
export function elapsedShare(t: DateTime): number {
  const q = simDateQuarter(dateTimeDate(t));
  const start = dateTimeHours(dateTimeMidnight(quarterFirstDay(q)));
  const end = dateTimeHours(dateTimeMidnight(quarterFirstDay(quarterNext(q))));
  return clamp((dateTimeHours(t) - start) / (end - start), 0.0, 1.0);
}

/** Who views the range (spec 21.5.1): the MVP has only the observer. */
export interface RangeViewer {
  /** The viewer's Finance skill. */
  finance: number;
  has_pdoomberg: boolean;
  /** True when the viewer cannot see the company's plan (2× wider). */
  plan_secret: boolean;
}

/** The MVP observer (spec 5.16): Finance 24, Pdoomberg, every plan secret. */
export const RANGE_VIEWER_OBSERVER: RangeViewer = {
  finance: OBSERVER_FINANCE,
  has_pdoomberg: true,
  plan_secret: true,
};

/**
 * The range half-width as a share of the projection (spec 5.16, 21.5.1):
 * `max(3%, 30% × (1 − 0.6 × elapsed) × (1 − Finance ÷ 50) × 0.7 (Pdoomberg) × 2 (secret))`.
 */
export function rangeWidth(elapsed: number, viewer: RangeViewer): number {
  let w =
    RANGE_BASE *
    (1.0 - RANGE_ELAPSED_SHRINK * clamp(elapsed, 0.0, 1.0)) *
    maxF(1.0 - viewer.finance / RANGE_FINANCE_DIVISOR, 0.0);
  if (viewer.has_pdoomberg) w *= RANGE_PDOOMBERG_MULT;
  if (viewer.plan_secret) w *= RANGE_SECRET_MULT;
  return maxF(w, RANGE_MIN);
}

/**
 * The shown range (low, high) around `centre` (spec 5.16): `centre ∓ |centre| × w`, so the low
 * end stays below the high end for a projected loss. The centre is the engine's projection for a
 * viewer who sees the plan; for a secret plan (every company, for the observer) it is the
 * consensus (21.5.1 "the range uses analysts' consensus").
 */
export function range(centre: number, width: number): [number, number] {
  const half = Math.abs(centre) * width;
  return [centre - half, centre + half];
}
