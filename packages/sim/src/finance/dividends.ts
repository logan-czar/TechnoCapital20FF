// The dividend rule (spec 5.17; 10.5.5, 3.3.2; 6.5), ready for the plan lock (M6.3 calls it):
// `dividend = payout ratio × NI` of the last quarter, if NI is above 0 and own cash after it stays
// above the minimum cash; the payout ratio is the sector table's typical ratio × the archetype's
// payout mult (6.1). Ported from crates/sim/src/finance/dividends.rs.

import { maxF } from "../types/num.ts";
import type { CompanyStatus } from "../types/state/finance.ts";
import { ownCash } from "./credit.ts";
import { companyStatusMayPayDividends } from "./distress.ts";

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
  if (d > 0.0 && ownCash(i.cash, i.line_drawn) - d > i.min_cash) return d;
  return 0.0;
}
