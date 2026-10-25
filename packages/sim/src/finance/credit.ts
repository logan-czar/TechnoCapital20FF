// The credit line (spec 5.12; 10.0.9; conflicts C9, C10, C23): limit, home spread and rate,
// monthly interest, undrawn fee and interest on cash, auto-draw, auto-repay (6.5) and the
// quarterly review with its 3-month excess repayment. Ported from
// crates/sim/src/finance/credit.rs.
//
// CreditLine is in types/state/finance.ts.

import { maxF, minF, roundHalfAway } from "../types/num.ts";
import type { CreditLine, Rating } from "../types/state/finance.ts";
import { BPS_PER_UNIT } from "../types/world.ts";
import { corporateSpread, ratingFactor } from "./rating.ts";

export type { CreditLine };

/** Months in a year: the monthly charges are a twelfth of the yearly rate (spec 5.12). */
export const MONTHS_PER_YEAR = 12.0;
/** Spec 5.12 limit: `0.5 × asset_book`. */
export const ASSET_BOOK_ADVANCE = 0.5;
/** Spec 5.12 undrawn fee: 0.25% a year on the undrawn limit. */
export const UNDRAWN_FEE_RATE = 0.0025;
/** Spec 5.12 interest on own cash: `base_rate − 0.25%` (3.6.5 savings). */
export const CASH_RATE_DISCOUNT = 0.0025;
/** Spec 5.12 review (10.0.9): the excess over a new limit is repaid within 3 months. */
export const EXCESS_REPAY_MONTHS = 3;
/**
 * Spec 5.1.2 home spread weights: half the zone's effective credit spread, half the HQ country's
 * sovereign spread.
 */
export const HOME_SPREAD_ZONE_WEIGHT = 0.5;
export const HOME_SPREAD_SOVEREIGN_WEIGHT = 0.5;
/** Spec 6 min_cash: 5% of trailing annual revenue (T). */
export const MIN_CASH_SHARE_OF_REVENUE = 0.05;
/** Spec 6.5 repay row: own cash above 2 × min_cash and line drawn. */
export const REPAY_FROM_MIN_CASH_MULT = 2.0;
/** Spec 6.5 repay row: repay `min(drawn, own cash − 1.5 × min_cash)`. */
export const REPAY_KEEP_MIN_CASH_MULT = 1.5;

/** Own cash (spec 5.12, C10): `cash − line_drawn`, floored at 0. */
export function ownCash(cash: number, line_drawn: number): number {
  return maxF(cash - line_drawn, 0.0);
}

/**
 * Credit line limit (spec 5.12, C10): `max(0, 0.5 × asset_book + own cash) × rating_factor`.
 */
export function lineLimit(asset_book: number, cash: number, line_drawn: number, rating: Rating): number {
  return maxF(ASSET_BOOK_ADVANCE * asset_book + ownCash(cash, line_drawn), 0.0) * ratingFactor(rating);
}

/**
 * Home spread, a fraction (spec 5.1.2 batch 156, 5.12): `0.5 × zone credit spread + 0.5 ×
 * sovereign spread`, rounded to whole basis points. `zone_spread` is the zone's effective spread
 * this quarter. Both inputs are whole bps in the data, so each is snapped to its bps first and
 * the half-bps result rounds half away from zero, as the effective zone spread does (D109,
 * D223): a Chilean company pays round((591 + 32) ÷ 2) = 312 bps.
 */
export function homeSpread(zone_spread: number, sovereign_spread: number): number {
  const zone_bps = roundHalfAway(zone_spread * BPS_PER_UNIT);
  const sov_bps = roundHalfAway(sovereign_spread * BPS_PER_UNIT);
  const bps = roundHalfAway(HOME_SPREAD_ZONE_WEIGHT * zone_bps + HOME_SPREAD_SOVEREIGN_WEIGHT * sov_bps);
  return bps / BPS_PER_UNIT;
}

/**
 * Credit line rate, a year (spec 5.12, C9, C23): `base_rate + home_spread + corporate
 * spread(rating)`.
 */
export function lineRate(base_rate: number, home_spread: number, rating: Rating): number {
  return base_rate + home_spread + corporateSpread(rating);
}

/** One month's line charges and interest on cash (spec 5.12 "Monthly"). */
export interface LineCharges {
  /** `line_drawn × rate ÷ 12`. */
  interest: number;
  /** `(limit − line_drawn) × 0.25% ÷ 12`; 0 when drawn at or over the limit. */
  undrawn_fee: number;
  /** `own cash × (base_rate − 0.25%) ÷ 12`, on positive own cash; never below 0. */
  cash_interest: number;
}

/**
 * The month's charges (spec 5.12 "Monthly", 4.3 step 12) on the balances given (the month's
 * opening balances: cash settles only at step 13).
 */
export function monthlyCharges(
  line_drawn: number,
  limit: number,
  cash: number,
  rate: number,
  base_rate: number,
): LineCharges {
  const drawn = maxF(line_drawn, 0.0);
  return {
    interest: (drawn * rate) / MONTHS_PER_YEAR,
    undrawn_fee: (maxF(limit - drawn, 0.0) * UNDRAWN_FEE_RATE) / MONTHS_PER_YEAR,
    cash_interest: (ownCash(cash, drawn) * maxF(base_rate - CASH_RATE_DISCOUNT, 0.0)) / MONTHS_PER_YEAR,
  };
}

/** Minimum cash (spec 6): 5% of trailing annual revenue. 0 for a company with no revenue (D226). */
export function minCash(trailing_revenue: number): number {
  return MIN_CASH_SHARE_OF_REVENUE * maxF(trailing_revenue, 0.0);
}

/**
 * The plan's auto-repay (spec 5.12 "per the plan", 6.5 base row): with own cash above
 * 2 × min_cash and the line drawn, repay `min(drawn, own cash − 1.5 × min_cash)`. The trait rows
 * of 6.5 (Cautious, Greedy, Brave) are the Lite AI's (M6). With min_cash 0 any own cash repays
 * (D226).
 */
export function planRepay(cash: number, line_drawn: number, min_cash: number): number {
  const own = ownCash(cash, line_drawn);
  if (line_drawn <= 0.0 || own <= REPAY_FROM_MIN_CASH_MULT * min_cash) return 0.0;
  return maxF(minF(line_drawn, own - REPAY_KEEP_MIN_CASH_MULT * min_cash), 0.0);
}

/** Rust `CreditLine::default()`. */
export function creditLineDefault(): CreditLine {
  return { drawn: 0, limit: 0, excess_months_left: 0 };
}

/** Drawn above the limit (Rust `CreditLine::excess`). */
export function creditLineExcess(line: CreditLine): number {
  return maxF(line.drawn - line.limit, 0.0);
}

/** Undrawn limit left to draw (Rust `CreditLine::available`). */
export function creditLineAvailable(line: CreditLine): number {
  return maxF(line.limit - line.drawn, 0.0);
}

/**
 * True when the excess over the limit is past its 3-month window (spec 5.12 review; Rust
 * `CreditLine::excess_overdue`).
 */
export function creditLineExcessOverdue(line: CreditLine): boolean {
  return creditLineExcess(line) > 0.0 && line.excess_months_left === 0;
}

/**
 * The review at 01:00 on release days (spec 5.12, 4.4 price move): the limit is recomputed; a
 * company over its new limit gets 3 months to repay the excess. A review restarts the window for
 * the excess as it now stands (D224).
 */
export function reviewLine(line: CreditLine, new_limit: number): CreditLine {
  const out: CreditLine = { ...line, limit: maxF(new_limit, 0.0) };
  out.excess_months_left = creditLineExcess(out) > 0.0 ? EXCESS_REPAY_MONTHS : 0;
  return out;
}

/** Auto-draw (spec 5.12): cash below 0 after the month draws the shortfall, up to the limit. */
export function autoDraw(cash: number, line: CreditLine): number {
  if (cash >= 0.0) return 0.0;
  return minF(-cash, creditLineAvailable(line));
}

/**
 * This month's instalment of the excess over the limit (spec 5.12 review, 10.0.9): the excess
 * spread evenly over the months left in the window (D224); all of it once overdue.
 */
export function excessInstalment(line: CreditLine): number {
  const excess = creditLineExcess(line);
  if (line.excess_months_left === 0) return excess;
  return excess / line.excess_months_left;
}
