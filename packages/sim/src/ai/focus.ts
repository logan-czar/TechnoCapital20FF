// D972: the focus experiment. A company's reinvestment is one budget split between R&D (productivity)
// and asset purchases (growth). Focus 0 is spec 6.2 and 6.3 untouched; each level up moves
// FOCUS_RD_SHIFT_PER_LEVEL × rd_norm of revenue from growth into R&D, each level down moves it the
// other way. The dollars are conserved: the growth given up (or gained) is the R&D change over the
// assets that earn the revenue. Pure, no RNG.

import { clamp } from "../types/num.ts";
import { RD_PLAN_MAX_NORMS } from "./archetype.ts";
import { type FundingInputs, fundingCap, GROWTH_MAX, GROWTH_MIN, SHRINK_LOSS_QUARTERS } from "./growth.ts";

/** D972: each focus level moves this many rd_norms of revenue between growth and R&D. */
export const FOCUS_RD_SHIFT_PER_LEVEL = 0.4;

/** The focus of company `id` under the experiment's levels (D972); 0 with none. */
export function focusOf(levels: readonly number[] | undefined, id: number): number {
  return levels === undefined || levels.length === 0 ? 0 : (levels[id % levels.length] as number);
}

export interface FocusInputs {
  focus: number;
  rd_plan: number;
  growth: number;
  rd_norm: number;
  ttm_revenue: number;
  gross_assets: number;
  loss_q: number;
  funding: FundingInputs;
}

/** The R&D plan and growth after the shared budget (D972). A company in a loss keeps both. */
export function applyFocus(i: FocusInputs): { rd_plan: number; growth: number } {
  if (
    i.focus === 0 ||
    i.loss_q >= SHRINK_LOSS_QUARTERS ||
    i.gross_assets <= 0.0 ||
    i.funding.purchases_stopped
  ) {
    return { rd_plan: i.rd_plan, growth: i.growth };
  }
  const rd = clamp(
    i.rd_plan + FOCUS_RD_SHIFT_PER_LEVEL * i.focus * i.rd_norm,
    0.0,
    RD_PLAN_MAX_NORMS * i.rd_norm,
  );
  const shifted = clamp(
    i.growth - ((rd - i.rd_plan) * i.ttm_revenue) / i.gross_assets,
    GROWTH_MIN,
    GROWTH_MAX,
  );
  return { rd_plan: rd, growth: shifted > i.growth ? fundingCap(shifted, i.funding) : shifted };
}
