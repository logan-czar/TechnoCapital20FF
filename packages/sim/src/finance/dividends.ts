// The dividend rule (spec 5.17; 10.5.5, 3.3.2; 6.5), ready for the plan lock (M6.3 calls it):
// `dividend = payout ratio × NI` of the last quarter, if NI is above 0 and own cash after it stays
// above the minimum cash; the payout ratio is the sector table's typical ratio × the archetype's
// payout mult (6.1). Ported from crates/sim/src/finance/dividends.rs.

import { maxF } from "../types/num.ts";
import type { CompanyStatus, Rating } from "../types/state/finance.ts";
import { ownCash } from "./credit.ts";
import { companyStatusMayPayDividends } from "./distress.ts";
import { ratingNotch } from "./rating.ts";

/**
 * 1995-rework 9 (D1011): an era firm rated at or above this pays its dividend from cash on hand,
 * as a firm that carries debt does; below it, 5.17's own-cash test holds it to repaying first.
 */
export const ERA_DIVIDEND_RATING_FLOOR: Rating = "BbbMinus";

/** Whether an era firm at this rating tests cash on hand for its dividend (1995-rework 9). */
export function eraDividendOnCash(rating: Rating): boolean {
  return ratingNotch(rating) <= ratingNotch(ERA_DIVIDEND_RATING_FLOOR);
}

/**
 * The sector table's typical payout ratio (3-markets 3.3.2), one shared default for all 42
 * industries (D1: every industry is in the Default valuation group). 40% is the median of the
 * 3.3.2 typical payout column (D234).
 */
export const SECTOR_PAYOUT = 0.4;

/**
 * Payout ratio (spec 5.17): `SECTOR_PAYOUT × archetype payout mult` (6.1: State champion 1.0,
 * Startup 0, Aggressive grower 0.5, Cash cow 1.3, Incumbent 1.0).
 */
export function payoutRatio(archetype_payout_mult: number): number {
  return SECTOR_PAYOUT * maxF(archetype_payout_mult, 0.0);
}

/** What the dividend reads at the plan lock (spec 5.17). */
export interface DividendInputs {
  /** Net income of the quarter just released. */
  net_income: number;
  cash: number;
  line_drawn: number;
  /** Spec 6 min_cash. */
  min_cash: number;
  /** `payoutRatio`. */
  payout_ratio: number;
  status: CompanyStatus;
  /** Test cash on hand rather than own cash (1995-rework 9); absent in the 2020 world. */
  on_cash?: boolean;
}

/**
 * The dividend paid at the plan lock (spec 5.17): `payout ratio × NI` when NI is above 0, the
 * company is Active (5.12 step 1: no dividends while Distressed) and own cash after it stays
 * strictly above min_cash; otherwise nothing. The rule pays all of it or none of it, never a part
 * (D234).
 */
export function dividend(i: DividendInputs): number {
  if (!companyStatusMayPayDividends(i.status) || i.net_income <= 0.0) return 0.0;
  const d = maxF(i.payout_ratio, 0.0) * i.net_income;
  const free = i.on_cash === true ? i.cash : ownCash(i.cash, i.line_drawn);
  if (d > 0.0 && free - d > i.min_cash) return d;
  return 0.0;
}
