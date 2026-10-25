// Rust Default values the tests build structs from (Ledger::default() and so on). The contracts
// (types/state) fix every field, so these are plain literals and need no module that is not
// ported yet.
import type { BalanceSheet, Ledger, TaxBook } from "../../src/types/state/finance.ts";
import type { DataBook, Stations } from "../../src/types/state/ops.ts";

/** Ledger::default(): every line 0, with over applied (Rust struct update syntax). */
export function zeroLedger(over: Partial<Ledger> = {}): Ledger {
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
    ...over,
  };
}

/** TaxBook::default(). */
export function zeroTax(over: Partial<TaxBook> = {}): TaxBook {
  return { carryforward: 0, quarter_pre_tax: 0, accrued: 0, ...over };
}

/** BalanceSheet::default(). */
export function zeroSheet(over: Partial<BalanceSheet> = {}): BalanceSheet {
  return {
    cash: 0,
    asset_book: 0,
    total_assets: 0,
    line_drawn: 0,
    tax_payable: 0,
    total_liabilities: 0,
    estate: 0,
    equity: 0,
    ...over,
  };
}

/** Stations::default(): every count 0, with over applied. */
export function stationsOf(over: Partial<Stations> = {}): Stations {
  return { productivity: 0, enterprise: 0, fifty_fifty: 0, research: 0, idle: 0, ...over };
}

/** DataBook::default(): nothing stored, free R&D 0%, no grace. */
export function emptyDataBook(over: Partial<DataBook> = {}): DataBook {
  return { unstructured: [], held: 0, free_rd_pct: 0, grace: false, ...over };
}
