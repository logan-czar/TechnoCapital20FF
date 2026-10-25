// The Lite AI's inputs (spec 6 table): g_dem, S, ROA, loss_q, liquidity, min_cash and the traits
// it reads. Ported from crates/sim/src/ai/inputs.rs.

import { ltQ, PHI } from "../economy/growth.ts";
import { creditLineAvailable, ownCash } from "../finance/credit.ts";
import { powi } from "../types/num.ts";
import type { CreditLine } from "../types/state/finance.ts";
import type { Trait } from "../types/state/people.ts";

export { minCash } from "../finance/credit.ts";

/** Spec 6 g_dem: the AI projects the next 4 quarters. */
export const G_DEM_QUARTERS = 4;

/**
 * The fade of this quarter's gap over the next four quarters (spec 6 g_dem): `φ + φ² + φ³ + φ⁴`,
 * 0.9375 at φ 0.5 (spec: "0.94 × the gap").
 */
export function gapFade(): number {
  let sum = 0.0;
  for (let k = 1; k <= G_DEM_QUARTERS; k++) sum += powi(PHI, k);
  return sum;
}

/**
 * Projected demand growth for the next 4 quarters, a year (spec 6 g_dem, batch 150): `LT + (φ +
 * φ² + φ³ + φ⁴) × (q_growth − lt_q)`, with LT the industry's current lt (the AI does not foresee
 * the boom or the pop, 5.1.1) and `lt_q = (1 + LT)^(1/4) − 1` (5.1). Retail in a Contraction (LT
 * 3%, q_growth −0.5%) projects 1.8%.
 */
export function gDem(lt: number, q_growth: number): number {
  return lt + gapFade() * (q_growth - ltQ(lt));
}

/**
 * Return on assets (spec 6 ROA): trailing 4-quarter EBIT ÷ gross assets; 0 with no assets. A
 * company born at this lock has no quarter yet: the caller passes its run-rate EBIT, the same run
 * rate its rating is implied from (5.19.3; D262).
 */
export function roa(ttm_ebit: number, gross_assets: number): number {
  return gross_assets > 0.0 ? ttm_ebit / gross_assets : 0.0;
}

/**
 * loss_q after a closed quarter (spec 6, 3.6 `loss_quarters`): one more when the quarter's EBIT
 * is below 0, else back to 0. Loads at 0 (7.1 Plan row) and is 0 at birth.
 */
export function nextLossQuarters(loss_q: number, quarter_ebit: number): number {
  return quarter_ebit < 0.0 ? loss_q + 1 : 0;
}

/** Liquidity (spec 6): own cash (cash − line drawn, floored at 0; C10) plus the undrawn line. */
export function liquidity(cash: number, line: CreditLine): number {
  return ownCash(cash, line.drawn) + creditLineAvailable(line);
}

/**
 * The traits the Lite AI reads (spec 6 "traits", 5.19.5): the named controller's when the
 * controller is a character, else none; a company born in play reads none, whatever its founders'
 * traits (Logan, batch 165, 3a; C33).
 */
export function planTraits(
  controller_traits: readonly Trait[] | null,
  born_in_play: boolean,
): readonly Trait[] {
  return controller_traits !== null && !born_in_play ? controller_traits : [];
}

/** True if `traits` holds `t`. */
export function has(traits: readonly Trait[], t: Trait): boolean {
  return traits.includes(t);
}
