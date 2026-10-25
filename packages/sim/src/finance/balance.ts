// The balance sheet and its identity (spec 3.9, 3.5 `book_equity`; build-plan M4.9: the balance
// sheet balances every month for every company still in the game). Ported from
// crates/sim/src/finance/balance.rs.
//
// `total assets = total liabilities + estate + equity`. Liabilities are the drawn line and the
// tax accrued but not yet paid (5.11, D227). Equity is the residual for an Active or Distressed
// company. A Bankrupt company's shareholders are wiped (5.12 step 2), so its equity is exactly 0
// and the residual sits on the **estate** line, the bankruptcy estate that the removal sale
// settles with the bank (D230); estate is 0 for every other company.
//
// `checkMonth` is what M4.9 calls: besides the identity it rolls each balance forward through the
// month's ledger, so a cash, book, line or tax movement that skipped the ledger shows up as an
// error.
//
// BalanceSheet is in types/state/finance.ts.

import { maxF } from "../types/num.ts";
import type { BalanceSheet, CompanyStatus, Ledger, TaxBook } from "../types/state/finance.ts";
import type { Result } from "../types/world.ts";
import { ledgerBookSold, ledgerNetCashChange, ledgerNetIncome } from "./statements.ts";

export type { BalanceSheet };

/** Absolute tolerance of the balance checks, USD. */
export const BALANCE_TOLERANCE_USD = 0.01;
/** Relative tolerance on the largest balance (f64 sums of $1T books drift in the 4th decimal). */
export const BALANCE_TOLERANCE_RELATIVE = 1.0e-12;

/** The balances a company holds (spec 3.5): the raw state the balance sheet is read from. */
export interface Books {
  /** Cash; below 0 only for a company that went bankrupt with no assets left to sell. */
  cash: number;
  /** Business assets at book (Σ units asset_book). */
  asset_book: number;
  line_drawn: number;
  /** The tax book (5.11): its `accrued` is the tax payable, held nowhere else. */
  tax: TaxBook;
}

/** Tax accrued this quarter, not yet paid (5.11, D227; Rust `Books::tax_payable`). */
export function booksTaxPayable(books: Books): number {
  return books.tax.accrued;
}

/** Rust `BalanceSheet::default()`. */
export function balanceSheetDefault(): BalanceSheet {
  return {
    cash: 0,
    asset_book: 0,
    total_assets: 0,
    line_drawn: 0,
    tax_payable: 0,
    total_liabilities: 0,
    estate: 0,
    equity: 0,
  };
}

/**
 * Equity plus estate: what the owners' roll-forward tracks (the wipe moves equity to the estate
 * and leaves this unchanged; Rust `BalanceSheet::residual`).
 */
export function balanceSheetResidual(s: BalanceSheet): number {
  return s.equity + s.estate;
}

/** The balance sheet of `books` for a company in `status` (spec 3.9; D230). */
export function balanceSheet(books: Books, status: CompanyStatus): BalanceSheet {
  const total_assets = books.cash + books.asset_book;
  const total_liabilities = books.line_drawn + booksTaxPayable(books);
  const residual = total_assets - total_liabilities;
  const [estate, equity] = status === "Bankrupt" ? [residual, 0.0] : [0.0, residual];
  return {
    cash: books.cash,
    asset_book: books.asset_book,
    total_assets,
    line_drawn: books.line_drawn,
    tax_payable: booksTaxPayable(books),
    total_liabilities,
    estate,
    equity,
  };
}

/** A balance check that failed: which line, what it should be and what it is. */
export interface BalanceError {
  line: string;
  expected: number;
  actual: number;
}

/** Rust `impl Display for BalanceError`. */
export function balanceErrorToString(e: BalanceError): string {
  return `${e.line}: expected ${e.expected} but found ${e.actual} (off by ${e.actual - e.expected})`;
}

function tolerance(scale: number): number {
  return maxF(BALANCE_TOLERANCE_USD, BALANCE_TOLERANCE_RELATIVE * Math.abs(scale));
}

function scaleOf(sheets: readonly BalanceSheet[]): number {
  let m = 0.0;
  for (const s of sheets) {
    for (const x of [s.cash, s.asset_book, s.line_drawn, s.tax_payable]) {
      m = maxF(m, Math.abs(x));
    }
  }
  return m;
}

const OK: Result<void, BalanceError> = { ok: true, value: undefined };

function same(line: string, expected: number, actual: number, scale: number): Result<void, BalanceError> {
  if (
    Math.abs(expected - actual) <= tolerance(scale) &&
    Number.isFinite(expected) &&
    Number.isFinite(actual)
  ) {
    return OK;
  }
  return { ok: false, error: { line, expected, actual } };
}

/**
 * The identity on one sheet: the totals add up, `total assets = total liabilities + estate +
 * equity`, and a Bankrupt company (`status`) has equity exactly 0 while others have no estate.
 */
export function checkIdentity(s: BalanceSheet, status: CompanyStatus): Result<void, BalanceError> {
  const scale = scaleOf([s]);
  const checks: [string, number, number][] = [
    ["total assets", s.cash + s.asset_book, s.total_assets],
    ["total liabilities", s.line_drawn + s.tax_payable, s.total_liabilities],
    ["assets = liabilities + estate + equity", s.total_assets, s.total_liabilities + s.estate + s.equity],
  ];
  for (const [line, expected, actual] of checks) {
    const r = same(line, expected, actual, scale);
    if (!r.ok) return r;
  }
  if (status === "Bankrupt") return same("bankrupt equity", 0.0, s.equity, scale);
  return same("estate", 0.0, s.estate, scale);
}

/**
 * The month check of M4.9: the closing sheet satisfies the identity, and every balance rolls
 * forward from the opening sheet through the month's ledger (spec 3.9, 4.3 steps 9 to 14):
 *
 * - cash: `opening + net change in cash`;
 * - assets at book: `opening + purchases − depreciation − book sold`;
 * - line: `opening + drawn or repaid`;
 * - tax payable: `opening + tax accrued − tax paid`;
 * - equity plus estate: `opening + net income + shares issued − dividends`.
 */
export function checkMonth(
  opening: BalanceSheet,
  month: Ledger,
  closing: BalanceSheet,
  closing_status: CompanyStatus,
): Result<void, BalanceError> {
  const id = checkIdentity(closing, closing_status);
  if (!id.ok) return id;
  const scale = scaleOf([opening, closing]);
  const checks: [string, number, number][] = [
    ["cash roll-forward", opening.cash + ledgerNetCashChange(month), closing.cash],
    [
      "asset book roll-forward",
      opening.asset_book + month.asset_purchases - month.depreciation - ledgerBookSold(month),
      closing.asset_book,
    ],
    ["credit line roll-forward", opening.line_drawn + month.line_drawn_or_repaid, closing.line_drawn],
    ["tax payable roll-forward", opening.tax_payable + month.tax - month.tax_paid, closing.tax_payable],
    [
      "equity roll-forward",
      balanceSheetResidual(opening) + ledgerNetIncome(month) + month.shares_issued_net - month.dividends,
      balanceSheetResidual(closing),
    ],
  ];
  for (const [line, expected, actual] of checks) {
    const r = same(line, expected, actual, scale);
    if (!r.ok) return r;
  }
  return OK;
}
