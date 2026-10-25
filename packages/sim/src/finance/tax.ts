// Corporate tax (spec 5.11; 10.5.5; 5.1.2 and C28: tax is national): each quarter
// `tax = max(0, pre-tax income − loss carryforward used) × corp_tax_rate` of the HQ country, with
// losses carried forward without limit, accrued monthly (4.3 step 14) and paid at the quarter
// close (4.4 Close and compile). Ported from crates/sim/src/finance/tax.rs.
//
// The monthly accrual is cumulative (D227): each month accrues the quarter-to-date tax less what
// earlier months of the quarter accrued, so a loss month after a profit month reverses some
// accrual, and the three accruals always sum to exactly the tax paid at the close.
//
// TaxBook is in types/state/finance.ts.

import { maxF, minF } from "../types/num.ts";
import type { TaxBook } from "../types/state/finance.ts";

export type { TaxBook };

/** One quarter's tax (spec 5.11). */
export interface QuarterTax {
  /** The quarter's pre-tax income. */
  pre_tax_income: number;
  /** Loss carryforward used against it: `min(carryforward, max(0, pre-tax income))`. */
  carryforward_used: number;
  /** `max(0, pre-tax income − carryforward used) × rate`. */
  tax: number;
  /** The quarter's loss, added to the carryforward. */
  carryforward_added: number;
  /** Carryforward after the quarter. */
  carryforward_after: number;
}

/** The tax on a quarter's pre-tax income with `carryforward` of past losses (spec 5.11). */
export function quarterTax(pre_tax_income: number, carryforward: number, rate: number): QuarterTax {
  const cf = maxF(carryforward, 0.0);
  const used = minF(cf, maxF(pre_tax_income, 0.0));
  const added = maxF(-pre_tax_income, 0.0);
  return {
    pre_tax_income,
    carryforward_used: used,
    tax: maxF(pre_tax_income - used, 0.0) * rate,
    carryforward_added: added,
    carryforward_after: cf - used + added,
  };
}

/** Rust `TaxBook::default()`. */
export function taxBookDefault(): TaxBook {
  return { carryforward: 0, quarter_pre_tax: 0, accrued: 0 };
}

/**
 * Accrues one month (spec 5.11, 4.3 step 14): adds the month's pre-tax income to the quarter and
 * returns this month's accrual (the tax line of its ledger), which may be below 0 (D227).
 */
export function accrueMonth(book: TaxBook, month_pre_tax: number, rate: number): number {
  book.quarter_pre_tax += month_pre_tax;
  const to_date = quarterTax(book.quarter_pre_tax, book.carryforward, rate).tax;
  const accrual = to_date - book.accrued;
  book.accrued = to_date;
  return accrual;
}

/**
 * Closes the quarter (spec 5.11, 4.4 Close and compile): the tax paid is exactly what the months
 * accrued (`book.accrued`, the balance sheet's tax payable), not a recomputation; the
 * carryforward moves by the quarter's pre-tax income; the quarter's running figures reset.
 */
export function closeQuarter(book: TaxBook): QuarterTax {
  const pti = book.quarter_pre_tax;
  const cf = maxF(book.carryforward, 0.0);
  const used = minF(cf, maxF(pti, 0.0));
  const added = maxF(-pti, 0.0);
  const q: QuarterTax = {
    pre_tax_income: pti,
    carryforward_used: used,
    tax: book.accrued,
    carryforward_added: added,
    carryforward_after: cf - used + added,
  };
  book.carryforward = q.carryforward_after;
  book.quarter_pre_tax = 0.0;
  book.accrued = 0.0;
  return q;
}
