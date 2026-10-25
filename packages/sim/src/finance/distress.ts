// Cash settling, distress, bankruptcy and removal (spec 5.12 "Auto-draw", "Distress, bankruptcy
// and removal", Logan batch 145; conflict C30; 4.3 step 13, the 4.4 close and release). Ported
// from crates/sim/src/finance/distress.rs.
//
// The status walks Active → Distressed (forced sales) → Bankrupt (frozen 2 quarters, shareholders
// wiped) → Removed (assets sold at the Bust factor, the line repaid or written off, the capacity
// returned to the fringe). Every transition is a pure function of explicit inputs; the caller
// writes the outputs back to the world.
//
// CompanyStatus, DistressState and Removal are in types/state/finance.ts.

import { maxF, minF } from "../types/num.ts";
import type { CompanyStatus, DistressState, Removal } from "../types/state/finance.ts";
import type { Books } from "./balance.ts";
import { booksTaxPayable } from "./balance.ts";
import {
  autoDraw,
  type CreditLine,
  creditLineExcess,
  creditLineExcessOverdue,
  excessInstalment,
  planRepay,
} from "./credit.ts";
import { type AssetSale, assetSaleDefault, REMOVAL_SALE_FACTOR, sellAll, sellForCash } from "./sales.ts";

export type { CompanyStatus, DistressState, Removal };

/** Spec 5.12 step 2 (T): Bankrupt after this many distress months. */
export const BANKRUPT_AFTER_DISTRESS_MONTHS = 6;
/**
 * Spec 5.12 step 2 (T): a Bankrupt company is frozen this many quarters, then removed at the next
 * release.
 */
export const FROZEN_QUARTERS = 2;

/** Frozen or gone: the monthly jobs skip the company (spec 5.12 step 2; D231). */
export function companyStatusIsFrozen(s: CompanyStatus): boolean {
  return s === "Bankrupt" || s === "Removed";
}

/** Spec 5.12 step 1: a Distressed company buys nothing (g = −d_eff at most). */
export function companyStatusMayBuyAssets(s: CompanyStatus): boolean {
  return s === "Active";
}

/** Spec 5.12 step 1, 5.17: only an Active company pays dividends. */
export function companyStatusMayPayDividends(s: CompanyStatus): boolean {
  return s === "Active";
}

/** Rust `DistressState::default()`. */
export function distressStateDefault(): DistressState {
  return { status: "Active", distress_months: 0, frozen_quarters: 0, entry_quarter_open: false };
}

/**
 * What step 13 reads for one company (spec 4.3 step 13). Cash is after every flow of the month
 * (steps 9 to 12); gross and book are the company's (one unit in the MVP).
 */
export interface SettleInputs {
  cash: number;
  line: CreditLine;
  /** Spec 6 min_cash (`minCash`). */
  min_cash: number;
  gross_assets: number;
  asset_book: number;
  /** The industry's sale factor this month (5.10). */
  sale_factor: number;
  state: DistressState;
}

/** What step 13 did. The ledger takes `settlementLineChange`, the forced sale's proceeds and gain. */
export interface Settlement {
  /** Auto-draw (5.12). */
  drawn: number;
  /** Repaid on the excess over the limit, from cash and then from forced sale proceeds. */
  excess_repaid: number;
  /** The plan's auto-repay (6.5). */
  plan_repaid: number;
  /** Forced sale of a Distressed company (5.12 step 1); default when none. */
  forced_sale: AssetSale;
  cash: number;
  line: CreditLine;
  gross_assets: number;
  asset_book: number;
  state: DistressState;
  /** This month counted as a distress month. */
  distress_month: boolean;
  /** The company went Bankrupt this month (alert, headline, price $0.00, wipe). */
  went_bankrupt: boolean;
}

/** Net line movement for the ledger: drawn less repaid (Rust `Settlement::line_change`). */
export function settlementLineChange(s: Settlement): number {
  return s.drawn - s.excess_repaid - s.plan_repaid;
}

/**
 * Step 13 (spec 5.12, 4.3 step 13): cash settles, then
 *
 * 1. auto-draw: cash below 0 draws the shortfall, up to the limit;
 * 2. a review excess is repaid from cash, a third, a half and then all of it over its 3 months
 *    (D224);
 * 3. the plan's auto-repay (6.5);
 * 4. distress: if cash is still below 0 with the line full, or the excess is overdue, the
 *    company sells assets at the sale factor to cover it, counts a distress month and repays the
 *    overdue excess from the proceeds; after 6 distress months, or with no assets left, it is
 *    Bankrupt. A month that ends with cash at or above 0 and the line within its limit resets
 *    the count. A month whose only problem is an excess still inside its repayment window
 *    neither counts nor resets (D224); a month with cash below 0 and the line full still counts,
 *    window or not.
 *
 * Bankrupt and Removed companies are frozen and come back unchanged.
 */
export function settleMonth(i: SettleInputs): Settlement {
  const out: Settlement = {
    drawn: 0.0,
    excess_repaid: 0.0,
    plan_repaid: 0.0,
    forced_sale: assetSaleDefault(),
    cash: i.cash,
    line: { ...i.line },
    gross_assets: i.gross_assets,
    asset_book: i.asset_book,
    state: { ...i.state },
    distress_month: false,
    went_bankrupt: false,
  };
  if (companyStatusIsFrozen(i.state.status)) return out;
  // 1. Auto-draw.
  out.drawn = autoDraw(out.cash, out.line);
  out.cash += out.drawn;
  out.line.drawn += out.drawn;
  // 2. The review excess, from cash first.
  if (creditLineExcess(out.line) > 0.0) {
    const pay = minF(excessInstalment(out.line), maxF(out.cash, 0.0));
    out.cash -= pay;
    out.line.drawn -= pay;
    out.excess_repaid += pay;
    // u32 saturating_sub(1).
    out.line.excess_months_left = Math.max(0, out.line.excess_months_left - 1);
  }
  // 3. The plan's auto-repay.
  out.plan_repaid = planRepay(out.cash, out.line.drawn, i.min_cash);
  out.cash -= out.plan_repaid;
  out.line.drawn -= out.plan_repaid;
  // 4. Distress.
  const overdue = creditLineExcessOverdue(out.line) ? creditLineExcess(out.line) : 0.0;
  const shortfall = maxF(-out.cash, 0.0) + overdue;
  if (shortfall > 0.0) {
    const sale = sellForCash(out.gross_assets, out.asset_book, shortfall, i.sale_factor);
    out.gross_assets -= sale.capacity_sold;
    out.asset_book -= sale.book_sold;
    if (sale.share >= 1.0) {
      out.gross_assets = 0.0;
      out.asset_book = 0.0;
    }
    out.cash += sale.proceeds;
    out.forced_sale = sale;
    const pay = minF(overdue, maxF(out.cash, 0.0));
    out.cash -= pay;
    out.line.drawn -= pay;
    out.excess_repaid += pay;
    out.distress_month = true;
    out.state.distress_months += 1;
    out.state.status = "Distressed";
    if (out.gross_assets <= 0.0 || out.state.distress_months >= BANKRUPT_AFTER_DISTRESS_MONTHS) {
      out.state = bankrupt(out.state);
      out.went_bankrupt = true;
    }
  } else if (out.cash >= 0.0 && out.line.drawn <= out.line.limit) {
    out.state.distress_months = 0;
    out.state.status = "Active";
  }
  if (creditLineExcess(out.line) <= 0.0) out.line.excess_months_left = 0;
  return out;
}

/**
 * Enters Bankrupt (spec 5.12 step 2): frozen, the frozen count starts; the wipe itself is the
 * balance sheet's (equity 0, D230).
 */
export function bankrupt(state: DistressState): DistressState {
  return {
    status: "Bankrupt",
    distress_months: state.distress_months,
    frozen_quarters: 0,
    entry_quarter_open: true,
  };
}

/**
 * The quarter close (spec 4.4 Close and compile): a Bankrupt company counts a frozen quarter,
 * except for the quarter it went bankrupt in (D232).
 */
export function onQuarterClose(state: DistressState): DistressState {
  const s = { ...state };
  if (s.status === "Bankrupt") {
    if (s.entry_quarter_open) {
      s.entry_quarter_open = false;
    } else {
      s.frozen_quarters += 1;
    }
  }
  return s;
}

/** Spec 5.12 step 3: removed at the first release after its 2 frozen quarters. */
export function removalDue(state: DistressState): boolean {
  return state.status === "Bankrupt" && state.frozen_quarters >= FROZEN_QUARTERS;
}

/**
 * Removes a Bankrupt company (spec 5.12 step 3): its remaining assets sell at the Bust factor
 * (0.60) to repay the line, any unpaid line is written off, and its remaining gross assets go
 * back to the industry's fringe pool (C30; the one sale whose capacity stays in the game).
 */
export function remove(state: DistressState, books: Books, gross_assets: number): [DistressState, Removal] {
  const sale = sellAll(gross_assets, books.asset_book, REMOVAL_SALE_FACTOR);
  let cash = books.cash + sale.proceeds;
  const line_repaid = minF(maxF(books.line_drawn, 0.0), maxF(cash, 0.0));
  cash -= line_repaid;
  const tax_paid = minF(maxF(booksTaxPayable(books), 0.0), maxF(cash, 0.0));
  cash -= tax_paid;
  const removal: Removal = {
    sale,
    line_repaid,
    line_written_off: maxF(books.line_drawn, 0.0) - line_repaid,
    tax_paid,
    other_written_off: maxF(booksTaxPayable(books), 0.0) - tax_paid + maxF(-cash, 0.0),
    residual_cash: maxF(cash, 0.0),
    capacity_to_fringe: maxF(gross_assets, 0.0),
  };
  return [{ ...state, status: "Removed" }, removal];
}
