// Statements (spec 3.9, light 10.0.8): the monthly ledger lines, the income statement, balance
// sheet, cash flow and key figures built from them, quarterly and yearly rollups (4.4 Close and
// compile, 4.5 step 1), the 20-quarter archive (4.5 step 2), trailing four quarters, and the
// synthetic history at the starting run rate (4.4, 7.1). Ported from
// crates/sim/src/finance/statements.rs.
//
// Every statement is a pure aggregation of Ledger lines: a quarter is the sum of its three
// monthly ledgers and a year the sum of its four quarters, line by line.
//
// The types (Ledger, KeyFigures, Period, Statement, ARCHIVE_QUARTERS, ARCHIVE_YEARS) are in
// types/state/finance.ts. Rust `Copy` structs are copied here with a spread where a later write
// could otherwise alias them.

import type { Quarter } from "../types/calendar.ts";
import type { BalanceSheet, KeyFigures, Ledger, Period, Statement } from "../types/state/finance.ts";

export { ARCHIVE_QUARTERS, ARCHIVE_YEARS } from "../types/state/finance.ts";

/** Quarters in a year (spec 4.4: accounting quarters are calendar quarters). */
export const QUARTERS_PER_YEAR = 4;
/** Months in a quarter. */
export const MONTHS_PER_QUARTER = 3;
/** A synthetic quarter is a quarter of the yearly run rate (spec 4.4 "revenue ÷ 4 and so on"). */
export const RUN_RATE_QUARTER_SHARE = 0.25;
/**
 * The year of the synthetic history: four quarters of 2019, the last released on 2 January 2020
 * as Q4 2019 (spec 4.4, 7.1).
 */
export const SYNTHETIC_YEAR = 2019;

/** Income statement lines (spec 3.9), with the 5.10 gain or loss on sales above pre-tax income. */
export interface IncomeStatement {
  revenue: number;
  variable: number;
  fixed_cash: number;
  operating_costs: number;
  rd: number;
  shared: number;
  depreciation: number;
  ebit: number;
  interest_expense: number;
  interest_income: number;
  asset_sale_gain: number;
  pre_tax_income: number;
  tax: number;
  net_income: number;
}

/** Cash flow lines (spec 3.9). */
export interface CashFlowStatement {
  operating_cash: number;
  asset_purchases: number;
  asset_sales: number;
  line_drawn_or_repaid: number;
  shares_issued_net: number;
  dividends: number;
  net_change: number;
}

/** Rust `Ledger::default()`: every line 0. */
export function ledgerDefault(): Ledger {
  return {
    revenue: 0,
    variable: 0,
    fixed_cash: 0,
    rd: 0,
    shared: 0,
    depreciation: 0,
    line_interest: 0,
    line_fee: 0,
    interest_income: 0,
    asset_sale_gain: 0,
    tax: 0,
    tax_paid: 0,
    asset_purchases: 0,
    asset_sale_proceeds: 0,
    line_drawn_or_repaid: 0,
    shares_issued_net: 0,
    dividends: 0,
  };
}

/** Operating costs: variable plus fixed cash (3.9). */
export function ledgerOperatingCosts(l: Ledger): number {
  return l.variable + l.fixed_cash;
}

/** EBIT: revenue less operating costs, R&D, shared costs and depreciation (3.9). */
export function ledgerEbit(l: Ledger): number {
  return l.revenue - ledgerOperatingCosts(l) - l.rd - l.shared - l.depreciation;
}

/** EBITDA = EBIT + depreciation (spec 5.12). */
export function ledgerEbitda(l: Ledger): number {
  return ledgerEbit(l) + l.depreciation;
}

/** Interest expense: line interest plus the undrawn fee (3.9, D229). */
export function ledgerInterestExpense(l: Ledger): number {
  return l.line_interest + l.line_fee;
}

/** Pre-tax income: EBIT − interest expense + interest income + gain on sales (3.9, 5.10). */
export function ledgerPreTaxIncome(l: Ledger): number {
  return ledgerEbit(l) - ledgerInterestExpense(l) + l.interest_income + l.asset_sale_gain;
}

/** Net income: pre-tax income less tax (3.9). */
export function ledgerNetIncome(l: Ledger): number {
  return ledgerPreTaxIncome(l) - l.tax;
}

/** Book value of assets sold: `proceeds − gain` (5.10). */
export function ledgerBookSold(l: Ledger): number {
  return l.asset_sale_proceeds - l.asset_sale_gain;
}

/**
 * Operating cash (3.9): the cash lines of income (revenue less cash costs, interest paid and
 * received) less tax paid. Equals net income + depreciation − gain on sales + tax accrued − tax
 * paid.
 */
export function ledgerOperatingCash(l: Ledger): number {
  return (
    l.revenue -
    ledgerOperatingCosts(l) -
    l.rd -
    l.shared -
    ledgerInterestExpense(l) +
    l.interest_income -
    l.tax_paid
  );
}

/** Free cash flow: operating cash less asset purchases (6.6 burn). */
export function ledgerFreeCashFlow(l: Ledger): number {
  return ledgerOperatingCash(l) - l.asset_purchases;
}

/** Net change in cash (3.9). */
export function ledgerNetCashChange(l: Ledger): number {
  return (
    ledgerOperatingCash(l) -
    l.asset_purchases +
    l.asset_sale_proceeds +
    l.line_drawn_or_repaid +
    l.shares_issued_net -
    l.dividends
  );
}

/** Line-by-line sum (a quarter of months, a year of quarters). */
export function ledgerPlus(a: Ledger, o: Ledger): Ledger {
  return {
    revenue: a.revenue + o.revenue,
    variable: a.variable + o.variable,
    fixed_cash: a.fixed_cash + o.fixed_cash,
    rd: a.rd + o.rd,
    shared: a.shared + o.shared,
    depreciation: a.depreciation + o.depreciation,
    line_interest: a.line_interest + o.line_interest,
    line_fee: a.line_fee + o.line_fee,
    interest_income: a.interest_income + o.interest_income,
    asset_sale_gain: a.asset_sale_gain + o.asset_sale_gain,
    tax: a.tax + o.tax,
    tax_paid: a.tax_paid + o.tax_paid,
    asset_purchases: a.asset_purchases + o.asset_purchases,
    asset_sale_proceeds: a.asset_sale_proceeds + o.asset_sale_proceeds,
    line_drawn_or_repaid: a.line_drawn_or_repaid + o.line_drawn_or_repaid,
    shares_issued_net: a.shares_issued_net + o.shares_issued_net,
    dividends: a.dividends + o.dividends,
  };
}

/** Every line times `k` (a quarter of the run rate is `× 0.25`). */
export function ledgerScaled(l: Ledger, k: number): Ledger {
  return {
    revenue: l.revenue * k,
    variable: l.variable * k,
    fixed_cash: l.fixed_cash * k,
    rd: l.rd * k,
    shared: l.shared * k,
    depreciation: l.depreciation * k,
    line_interest: l.line_interest * k,
    line_fee: l.line_fee * k,
    interest_income: l.interest_income * k,
    asset_sale_gain: l.asset_sale_gain * k,
    tax: l.tax * k,
    tax_paid: l.tax_paid * k,
    asset_purchases: l.asset_purchases * k,
    asset_sale_proceeds: l.asset_sale_proceeds * k,
    line_drawn_or_repaid: l.line_drawn_or_repaid * k,
    shares_issued_net: l.shares_issued_net * k,
    dividends: l.dividends * k,
  };
}

/** The sum of several ledgers, in the order given (Rust `Ledger::sum`). */
export function ledgerSum(items: Iterable<Ledger>): Ledger {
  let acc = ledgerDefault();
  for (const l of items) acc = ledgerPlus(acc, l);
  return acc;
}

/** The income statement (3.9). */
export function ledgerIncome(l: Ledger): IncomeStatement {
  return {
    revenue: l.revenue,
    variable: l.variable,
    fixed_cash: l.fixed_cash,
    operating_costs: ledgerOperatingCosts(l),
    rd: l.rd,
    shared: l.shared,
    depreciation: l.depreciation,
    ebit: ledgerEbit(l),
    interest_expense: ledgerInterestExpense(l),
    interest_income: l.interest_income,
    asset_sale_gain: l.asset_sale_gain,
    pre_tax_income: ledgerPreTaxIncome(l),
    tax: l.tax,
    net_income: ledgerNetIncome(l),
  };
}

/** The cash flow statement (3.9). */
export function ledgerCashFlow(l: Ledger): CashFlowStatement {
  return {
    operating_cash: ledgerOperatingCash(l),
    asset_purchases: l.asset_purchases,
    asset_sales: l.asset_sale_proceeds,
    line_drawn_or_repaid: l.line_drawn_or_repaid,
    shares_issued_net: l.shares_issued_net,
    dividends: l.dividends,
    net_change: ledgerNetCashChange(l),
  };
}

/** Rust `Statement::income`. */
export function statementIncome(s: Statement): IncomeStatement {
  return ledgerIncome(s.lines);
}

/** Rust `Statement::cash_flow`. */
export function statementCashFlow(s: Statement): CashFlowStatement {
  return ledgerCashFlow(s.lines);
}

/** A copy of key figures (Rust `KeyFigures` is `Copy`). */
function copyKey(key: KeyFigures): KeyFigures {
  return { ...key, guidance: [key.guidance[0], key.guidance[1]] };
}

/**
 * A quarter's statement (spec 4.4 Close and compile): the sum of its three monthly ledgers, in
 * month order, with the balance sheet and key figures at the close.
 */
export function quarterStatement(
  quarter: Quarter,
  months: readonly Ledger[],
  closing: BalanceSheet,
  key: KeyFigures,
): Statement {
  return {
    period: { kind: "Quarter", quarter },
    lines: ledgerSum(months),
    balance: closing,
    key,
    synthetic: false,
  };
}

/**
 * A year's statement (spec 4.5 step 1): the sum of its four quarters in order; the balance sheet
 * and key figures are Q4's. Synthetic if any quarter is.
 */
export function yearStatement(year: number, quarters: readonly Statement[]): Statement {
  if (quarters.length !== QUARTERS_PER_YEAR) {
    throw new RangeError(`a year is ${QUARTERS_PER_YEAR} quarters, got ${quarters.length}`);
  }
  const last = quarters[QUARTERS_PER_YEAR - 1] as Statement;
  return {
    period: { kind: "Year", year },
    lines: ledgerSum(quarters.map((q) => q.lines)),
    balance: { ...last.balance },
    key: copyKey(last.key),
    synthetic: quarters.some((q) => q.synthetic),
  };
}

/**
 * The synthetic history (spec 4.4, 7.1): four quarters of 2019 at the starting run rate, each a
 * quarter of `annual` (revenue ÷ 4 and so on), all with the starting balance sheet and key
 * figures (D228). The last is the Q4 2019 statement released on 2 January 2020.
 */
export function syntheticHistory(annual: Ledger, start: BalanceSheet, key: KeyFigures): Statement[] {
  const lines = ledgerScaled(annual, RUN_RATE_QUARTER_SHARE);
  return Array.from({ length: QUARTERS_PER_YEAR }, (_, i) => {
    const period: Period = { kind: "Quarter", quarter: { year: SYNTHETIC_YEAR, q: i + 1 } };
    return { period, lines: { ...lines }, balance: { ...start }, key: copyKey(key), synthetic: true };
  });
}

/**
 * Trailing figures (spec 5.12 "trailing 4 quarters", 5.13 TTM, 6 ROA): the sum of the last four
 * quarterly statements. With fewer (a company born in play, 5.19) the available quarters are
 * annualized, `× 4 ÷ n`; null with none (D228).
 */
export function trailingFour(quarters: readonly Statement[]): Ledger | null {
  const n = Math.min(quarters.length, QUARTERS_PER_YEAR);
  if (n === 0) return null;
  const sum = ledgerSum(quarters.slice(quarters.length - n).map((s) => s.lines));
  return n === QUARTERS_PER_YEAR ? sum : ledgerScaled(sum, QUARTERS_PER_YEAR / n);
}

/**
 * Appends a statement to an archive kept oldest first, dropping the oldest past `keep`
 * (spec 4.5 step 2: ARCHIVE_QUARTERS quarters, ARCHIVE_YEARS years).
 */
export function archivePush(archive: Statement[], s: Statement, keep: number): void {
  archive.push(s);
  if (archive.length > keep) {
    archive.splice(0, archive.length - keep);
  }
}
