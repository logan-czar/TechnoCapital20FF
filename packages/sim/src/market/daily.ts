// The daily market jobs at 00:00 (spec 4.2 steps 1 and 3; 3.10): the daily price bar, buzz
// decay, and the reaction-week reversion toward V (21.3.1). The fair value refresh of step 2 is
// `fairValue` on the stored basis (D243). Ported from crates/sim/src/market/daily.rs.
//
// DailyBar and BarBuilder are in types/state/market.ts.

import type { SimDate } from "../types/calendar.ts";
import { QUARTER_FIRST_MONTHS } from "../types/calendar.ts";
import { REACTION_FIRST_DAY, REACTION_LAST_DAY } from "../types/control.ts";
import { clamp, maxF, minF } from "../types/num.ts";
import type { BarBuilder, DailyBar } from "../types/state/market.ts";
import { EFV_ERROR_WIDTH } from "./jobs.ts";
import { BUZZ_MAX } from "./price.ts";

export type { BarBuilder, DailyBar };

/** Spec 4.2 step 1, 3.10 (3.3.5): buzz decays 25% a day. */
export const BUZZ_DAILY_DECAY = 0.25;
/** Spec 4.2 step 3 (21.3.1): each reaction-week day closes 20% of the gap between P and V. */
export const REACTION_REVERSION = 0.2;

/** The bottom of the EFV band, EFV × (1 − 15%) (spec 8 F3, 3.14.2; D140). */
export function dailyBarEfvLow(b: DailyBar): number {
  return b.efv * (1.0 - EFV_ERROR_WIDTH);
}

/** The top of the EFV band, EFV × (1 + 15%). */
export function dailyBarEfvHigh(b: DailyBar): number {
  return b.efv * (1.0 + EFV_ERROR_WIDTH);
}

/** A new bar for `date` opening at `price` (the price after the 00:00 daily jobs). */
export function barBuilderStart(date: SimDate, price: number): BarBuilder {
  return { date, open: price, high: price, low: price, last: price, traded: false };
}

/** Adds the price of an hourly step that moved prices (5.14). */
export function barBuilderTick(b: BarBuilder, price: number): void {
  b.high = maxF(b.high, price);
  b.low = minF(b.low, price);
  b.last = price;
  b.traded = true;
}

/**
 * Closes the bar at 00:00 (spec 4.2 step 1) with the day's EFV a share (D424). A day with no
 * trading tick (1 January, 3.1.0) leaves no bar (D248).
 */
export function barBuilderClose(b: BarBuilder, efv: number): DailyBar | null {
  if (!b.traded) return null;
  return { date: b.date, open: b.open, high: b.high, low: b.low, close: b.last, efv };
}

/** Buzz after a day's decay (spec 4.2 step 1): `buzz × (1 − 0.25)`, kept in −100 to +100. */
export function decayBuzz(buzz: number): number {
  return clamp(buzz * (1.0 - BUZZ_DAILY_DECAY), -BUZZ_MAX, BUZZ_MAX);
}

/**
 * True on the reaction-week reversion days (spec 4.2 step 3): the 3rd to the 8th of January,
 * April, July and October.
 */
export function isReversionDay(date: SimDate): boolean {
  return (
    (QUARTER_FIRST_MONTHS as readonly number[]).includes(date.month) &&
    date.day >= REACTION_FIRST_DAY &&
    date.day <= REACTION_LAST_DAY
  );
}

/**
 * The reaction-week reversion (spec 4.2 step 3, 21.3.1): `P + 0.20 × (V − P)`, toward the
 * post-earnings fair value V (not V*: buzz moves only the hourly pull).
 */
export function revertTowardValue(p: number, v: number): number {
  return p + REACTION_REVERSION * (v - p);
}
