// Labor units, board seats opening and closing, and the station drop order (spec 5.10, 3.7;
// 10.0.11.3). Ported from crates/sim/src/ops/labor.rs.

import { maxF, toU64Sat } from "../types/num.ts";
import type { Stations } from "../types/state/ops.ts";
import { LABOR_SEAT_COUNT, SEAT_LABOR, type Seat } from "../types/state/people.ts";

/** Spec 5.10: labor units never fall below 1 (the CEO). */
export const MIN_LABOR_UNITS = 1;

/**
 * Labor units (spec 5.10): `floor(Σ units gross_assets ÷ labor_value)`, minimum 1. The caller
 * sums its units' gross assets in id order; `laborValueUsd` is the main industry's (one unit per
 * company in the MVP; D200). Whole number (u64).
 */
export function laborUnits(grossAssetsUsd: number, laborValueUsd: number): number {
  if (!(laborValueUsd > 0.0)) throw new Error("labor_value must be positive");
  const units = Math.floor(maxF(grossAssetsUsd, 0.0) / laborValueUsd);
  // `as u64` saturates for huge values; f64 holds every count the MVP reaches exactly.
  return Math.max(toU64Sat(units), MIN_LABOR_UNITS);
}

/**
 * How many of the five labor seats are open with `labor` units (spec 3.7: a seat exists only
 * when the company has that many labor units).
 */
export function openSeatCount(labor: number): number {
  return Math.min(labor, LABOR_SEAT_COUNT);
}

/** The open labor seats with `labor` units, in opening order (spec 3.7). */
export function openSeats(labor: number): readonly Seat[] {
  return SEAT_LABOR.slice(0, openSeatCount(labor));
}

/** Seats a labor recount opens and closes (spec 5.10 "Seats"), each in opening order. */
export interface SeatChanges {
  /** Seats that open: a simple character is generated for each (3.7.1, 4.3 step 11). */
  opened: Seat[];
  /**
   * Seats that close: their simple character is discarded (a full character stays in the world,
   * unseated; C34).
   */
  closed: Seat[];
}

/** The seats that open or close when labor units go from `old` to `new` (spec 5.10, 3.7). */
export function seatChanges(old: number, now: number): SeatChanges {
  const a = openSeatCount(old);
  const b = openSeatCount(now);
  return {
    opened: SEAT_LABOR.slice(Math.min(a, b), b),
    closed: SEAT_LABOR.slice(b, Math.max(a, b)),
  };
}

/**
 * Fits the assigned stations to `labor` units (spec 5.10; 10.0.11.3). When the count falls
 * below what is assigned, stations drop idle first, then research, enterprise, 50/50 and last
 * productivity (D201 places 50/50, which the spec does not list); when it rises, the new units
 * are idle until the next plan assigns them (D201).
 */
export function fitStations(stations: Stations, labor: number): Stations {
  const s: Stations = { ...stations };
  const total = s.productivity + s.enterprise + s.fifty_fifty + s.research + s.idle;
  if (total < labor) {
    s.idle += labor - total;
    return s;
  }
  let excess = total - labor;
  for (const key of ["idle", "research", "enterprise", "fifty_fifty", "productivity"] as const) {
    const cut = Math.min(excess, s[key]);
    s[key] -= cut;
    excess -= cut;
  }
  return s;
}
