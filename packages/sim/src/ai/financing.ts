// Financing (credit line only) and the dividend (spec 6.5, 5.17): draw for the quarter's planned
// purchases, repay from cash well above min_cash, the Cautious or Greedy repay-first row, the
// Brave row, then the dividend by `finance/dividends`. Ported from
// crates/sim/src/ai/financing.rs.

import { creditLineAvailable, ownCash, planRepay } from "../finance/credit.ts";
import { dividend, payoutRatio } from "../finance/dividends.ts";
import { maxF, minF } from "../types/num.ts";
import type { CompanyStatus, CreditLine } from "../types/state/finance.ts";
import type { Trait } from "../types/state/people.ts";
import { has } from "./inputs.ts";

/**
 * Spec 6.5: a Cautious or Greedy controller repays first, to at most 25% of the limit drawn,
 * before any dividend.
 */
export const REPAY_FIRST_DRAWN_SHARE = 0.25;
/** Spec 6.5: a Brave controller may keep up to 75% of the limit drawn to fund growth. */
export const BRAVE_DRAWN_SHARE = 0.75;

/**
 * D971: each debt aggression level holds this share of the limit drawn (no repaying below it) and
 * borrows up to it to fund the quarter's purchases.
 */
export const DEBT_HOLD_SHARE_PER_LEVEL = 0.2;

/** The debt aggression of company `id` under the experiment's levels (D971); 0 with none. */
export function debtAggressionOf(levels: readonly number[] | undefined, id: number): number {
  return levels === undefined || levels.length === 0 ? 0 : (levels[id % levels.length] as number);
}

/** What 6.5 reads at the lock. */
export interface FinancingInputs {
  /** Cash on hand at the lock, USD. */
  cash: number;
  line: CreditLine;
  /** Spec 6 min_cash. */
  min_cash: number;
  /**
   * The quarter's planned purchases at the locked g (`quarterPurchases`); a sale (below 0)
   * counts as 0 here, since its cash is not planned on.
   */
  planned_purchases: number;
  /** The traits the AI reads (none for a born company, 5.19.5). */
  traits: readonly Trait[];
  /** Net income of the quarter just released (5.17). */
  last_quarter_net_income: number;
  /** The archetype's payout mult (6.1). */
  archetype_payout_mult: number;
  status: CompanyStatus;
  /** The experiment's debt aggression level (D971); 0 or absent is spec 6.5. */
  debt_aggression?: number;
}

/** The financing moves and the dividend set at the lock (spec 6.5, 5.17). */
export interface Financing {
  /** Drawn on the line now, USD (cash and drawn both rise). */
  draw: number;
  /** Repaid now, USD (cash and drawn both fall). */
  repay: number;
  /** Paid now from cash, USD. */
  dividend: number;
}

/**
 * The 6.5 rows (D265):
 *
 * 1. **Draw**: cash after the quarter's planned purchases below min_cash draws the gap, up to the
 *    undrawn limit. A draw never changes own cash (C10), so this row reads cash on hand.
 * 2. **Repay** (no draw): `planRepay` on the cash left after the planned purchases: own cash
 *    above 2 × min_cash and the line drawn repays `min(drawn, own cash − 1.5 × min_cash)`.
 * 3. **Cautious or Greedy** controller (checked before Brave): repays at least down to 25% of the
 *    limit, from cash above min_cash, and pays no dividend while more stays drawn.
 * 4. **Brave** controller: keeps up to 75% of the limit drawn, so row 2 repays only what is drawn
 *    above 75%.
 * 5. **Dividend**: 5.17 (`dividend`) with the payout ratio `SECTOR_PAYOUT × archetype payout
 *    mult`, on the balances after the draw or repayment.
 */
export function financing(i: FinancingInputs): Financing {
  const purchases = maxF(i.planned_purchases, 0.0);
  const cash_after = i.cash - purchases;
  const drawn = maxF(i.line.drawn, 0.0);
  const repay_first = has(i.traits, "Cautious") || has(i.traits, "Greedy");
  const brave = has(i.traits, "Brave");
  const hold = DEBT_HOLD_SHARE_PER_LEVEL * (i.debt_aggression ?? 0) * i.line.limit;

  const out: Financing = { draw: 0.0, repay: 0.0, dividend: 0.0 };
  // D971: a leveraged company borrows toward its hold share to fund the planned purchases.
  const debt_draw = hold > drawn ? minF(purchases, hold - drawn) : 0.0;
  if (cash_after < i.min_cash || debt_draw > 0.0) {
    const gap = maxF(i.min_cash - cash_after, 0.0);
    out.draw = maxF(minF(maxF(gap, debt_draw), creditLineAvailable(i.line)), 0.0);
  } else if (drawn > 0.0) {
    let repay = planRepay(cash_after, drawn, i.min_cash);
    if (repay_first) {
      const excess = maxF(drawn - REPAY_FIRST_DRAWN_SHARE * i.line.limit, 0.0);
      const spare = maxF(cash_after - i.min_cash, 0.0);
      repay = maxF(repay, minF(excess, spare));
    } else if (brave) {
      repay = minF(repay, maxF(drawn - BRAVE_DRAWN_SHARE * i.line.limit, 0.0));
    }
    if (hold > 0.0) repay = minF(repay, maxF(drawn - hold, 0.0));
    out.repay = maxF(minF(repay, drawn), 0.0);
  }

  const cash = i.cash + out.draw - out.repay;
  const drawn_after = drawn + out.draw - out.repay;
  const blocked = repay_first && drawn_after > REPAY_FIRST_DRAWN_SHARE * i.line.limit;
  if (!blocked) {
    out.dividend = dividend({
      net_income: i.last_quarter_net_income,
      cash,
      line_drawn: drawn_after,
      min_cash: i.min_cash,
      payout_ratio: payoutRatio(i.archetype_payout_mult),
      status: i.status,
    });
  }
  return out;
}

/** Own cash after the moves (spec 5.12, C10), for checks. */
export function ownCashAfter(cash: number, drawn: number, f: Financing): number {
  return ownCash(cash + f.draw - f.repay - f.dividend, drawn + f.draw - f.repay);
}
