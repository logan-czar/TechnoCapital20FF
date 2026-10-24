// The books a company carries in the World (spec 3.5 finance rows, 3.9, 5.10 to 5.12, 5.17;
// build-plan M4). Ported from crates/sim/src/finance/: state.rs (CompanyFinance, Archive,
// BooksCheck, PostedMonth), rating.rs (Rating, Band, ImpliedRating), statements.rs (Ledger,
// KeyFigures, Period, Statement), balance.rs (BalanceSheet), credit.rs (CreditLine),
// distress.rs (CompanyStatus, DistressState, Removal), sales.rs (AssetSale) and tax.rs (TaxBook).
// Types only.
//
// Not ported (logic and types no World field reaches): CompanyFinance::{at_load, quarters, years,
// push_quarter, push_year, status, in_game}; Rating's methods and tables (notch, from_notch,
// shifted, band, modifier, label, parse, rating_factor, corporate_spread, the RATING_FACTOR_* and
// SPREAD_* constants, LEVERAGE_BANDS and the review constants); rating::{Modifier, RatingInputs,
// StartRatingInputs}; Ledger's derived lines (operating_costs, ebit, ebitda, interest_expense,
// pre_tax_income, net_income, book_sold, operating_cash, free_cash_flow, net_cash_change, plus,
// scaled, sum, income, cash_flow) and statements::{IncomeStatement, CashFlowStatement};
// balance::{Books, BalanceError, residual, check_month}; CreditLine::{excess, available,
// excess_overdue} and credit::LineCharges; CompanyStatus::{is_frozen, may_buy_assets,
// may_pay_dividends}; distress::{SettleInputs, Settlement}; tax::QuarterTax;
// dividends::DividendInputs; and every job in finance/jobs.rs.

import type { Month, Quarter, SimDate } from "../calendar.ts";

// ---------------------------------------------------------------- rating.rs

/**
 * A credit rating notch (spec 5.12, 3.6.2), best first: the derived order is "better is
 * smaller", so `Aaa` < `Cc` (compare by index in `RATING_VALUES`).
 */
export type Rating =
  | "Aaa"
  | "AaPlus"
  | "Aa"
  | "AaMinus"
  | "APlus"
  | "A"
  | "AMinus"
  | "BbbPlus"
  | "Bbb"
  | "BbbMinus"
  | "BbPlus"
  | "Bb"
  | "BbMinus"
  | "BPlus"
  | "B"
  | "BMinus"
  | "Ccc"
  | "Cc";

/** Every notch, best first (spec 3.6.2 scale, AAA to CC; Rust `Rating::ALL`). */
export const RATING_VALUES = [
  "Aaa",
  "AaPlus",
  "Aa",
  "AaMinus",
  "APlus",
  "A",
  "AMinus",
  "BbbPlus",
  "Bbb",
  "BbbMinus",
  "BbPlus",
  "Bb",
  "BbMinus",
  "BPlus",
  "B",
  "BMinus",
  "Ccc",
  "Cc",
] as const;

/**
 * A rating band (spec 5.12, 3.6.2): the rows of the rating factor and spread tables. Rust name
 * `finance::rating::Band`; re-exported from views/index.ts as `RatingBand` because the estimate
 * band (views/estimate.rs `Band`) has the same name.
 */
export type Band = "Aaa" | "Aa" | "A" | "Bbb" | "Bb" | "B" | "Ccc" | "Cc";

/** The implied rating and how it was reached (spec 5.12; for the ratings view, 9.2 F6). */
export interface ImpliedRating {
  /** From net debt ÷ EBITDA alone. */
  leverage: Rating;
  /** Whole number (i32), better above 0. */
  cover_notches: number;
  /** Whole number (i32). */
  size_notches: number;
  /** Whole number (i32). */
  sector_notches: number;
  /** Leverage plus the adjustments, clamped to AAA to CC. */
  adjusted: Rating;
  /** Sovereign + 1 notch. */
  ceiling: Rating;
  /** The worse of `adjusted` and `ceiling`. */
  implied: Rating;
}

// ---------------------------------------------------------------- credit.rs

/** A company's credit line (spec 3.5 `line_drawn`, `line_limit`). USD. */
export interface CreditLine {
  drawn: number;
  limit: number;
  /**
   * Months left to repay the excess over the limit set at the last review (spec 5.12, 10.0.9);
   * 0 with no repayment window open. The excess itself is always `max(0, drawn − limit)`. Whole
   * number (u32).
   */
  excess_months_left: number;
}

// ---------------------------------------------------------------- distress.rs

/** A company's status (spec 3.5, 5.12). Default `Active`. */
export type CompanyStatus =
  /** Active. */
  | "Active"
  /**
   * Cash below 0 with the line full (or an overdue excess): forced sales, no dividends,
   * purchases stop (g = −d_eff at most).
   */
  | "Distressed"
  /**
   * Frozen: no revenue, no expenses, no decay, no line charges (D231); out of supply; price
   * $0.00; equity 0.
   */
  | "Bankrupt"
  /** Off lists, the map and the screens; filings stay in the archive. */
  | "Removed";

/** The distress counters (spec 3.5 `distress_months`, `status`, `frozen_quarters`). */
export interface DistressState {
  status: CompanyStatus;
  /** Consecutive months with cash below 0 after the line is exhausted (5.12 step 1). u32. */
  distress_months: number;
  /** Full quarters spent Bankrupt (5.12 step 2). Whole number (u32). */
  frozen_quarters: number;
  /**
   * True from bankruptcy until the close of the quarter it happened in, which does not count as
   * a frozen quarter (D232).
   */
  entry_quarter_open: boolean;
}

/** What removal did (spec 5.12 step 3, C30). All amounts USD. */
export interface Removal {
  /** Everything sold at the Bust factor. */
  sale: AssetSale;
  line_repaid: number;
  /** Unpaid line written off by the bank (A). */
  line_written_off: number;
  /** Tax payable paid from what is left after the line. */
  tax_paid: number;
  /** Unpaid tax payable and negative cash written off with the line (D233). */
  other_written_off: number;
  /** Cash left after the line and tax, which leaves the game with the company (D233). */
  residual_cash: number;
  /**
   * Gross assets returned to the industry's fringe_assets (C30): every unit's remaining capacity
   * at cost.
   */
  capacity_to_fringe: number;
}

// ---------------------------------------------------------------- sales.rs

/** One asset sale (spec 5.10; 10.0.7). All amounts USD. */
export interface AssetSale {
  /** Capacity sold, at cost (off gross_assets). */
  capacity_sold: number;
  /** The same share of asset_book. */
  book_sold: number;
  /** `book sold × sale factor`. */
  proceeds: number;
  /** `proceeds − book sold`: a gain above 0, a loss below (pre-tax income, 5.10). */
  gain: number;
  /** Share of the unit sold, 0 to 1; ramping tranches shrink by the same share (lane S). */
  share: number;
}

// ---------------------------------------------------------------- tax.rs

/** A company's tax position (spec 5.11). USD. */
export interface TaxBook {
  /** Unused losses, carried forward without limit. */
  carryforward: number;
  /** Pre-tax income of the quarter so far. */
  quarter_pre_tax: number;
  /**
   * Tax accrued in the quarter so far: the one source of the balance sheet's tax payable
   * (balance.rs `Books::tax`; D227).
   */
  accrued: number;
}

// ---------------------------------------------------------------- balance.rs

/**
 * Balance sheet lines (spec 3.9: cash; business assets at book; total assets; credit line
 * drawn; equity), with tax payable and the estate line (D227, D230). USD.
 */
export interface BalanceSheet {
  cash: number;
  asset_book: number;
  total_assets: number;
  line_drawn: number;
  tax_payable: number;
  total_liabilities: number;
  /** A Bankrupt company's residual (assets − liabilities), held for the removal sale; 0 otherwise. */
  estate: number;
  equity: number;
}

// ---------------------------------------------------------------- statements.rs

/** Quarterly statements kept in the archive (spec 4.5 step 2). */
export const ARCHIVE_QUARTERS = 20;
/** Yearly statements kept in the archive (D228): ARCHIVE_QUARTERS ÷ 4. */
export const ARCHIVE_YEARS = 5;

/**
 * One period's posted lines (spec 3.9; 4.3 steps 9 to 14). A month's ledger is posted at step
 * 14; a quarter's or year's is the line-by-line sum. All amounts USD, costs and outflows as
 * positive numbers.
 */
export interface Ledger {
  // Income (3.9).
  revenue: number;
  /** Operating cost: variable (5.5). */
  variable: number;
  /** Operating cost: fixed cash (5.5). */
  fixed_cash: number;
  /** Paid R&D (5.5). */
  rd: number;
  /** Compute, data compute and licences (3.8, 5.5). */
  shared: number;
  /** Depreciation, equal to the month's asset decay (5.5, 5.10). */
  depreciation: number;
  /** Interest on the drawn line (5.12). */
  line_interest: number;
  /** Undrawn fee (5.12); shown inside interest expense (D229). */
  line_fee: number;
  /** Interest on own cash (5.12). */
  interest_income: number;
  /** Gain (above 0) or loss on asset sales: `proceeds − book sold` (5.10; D229). */
  asset_sale_gain: number;
  /** Tax accrued (5.11, D227); may be below 0 in a month. */
  tax: number;
  // Cash flow (3.9).
  /** Tax paid (at the quarter close, 5.11). */
  tax_paid: number;
  /** Asset purchases at cost (5.10). */
  asset_purchases: number;
  /** Cash from asset sales (5.10, 5.12). */
  asset_sale_proceeds: number;
  /** Line drawn (above 0) or repaid (below 0) (5.12). */
  line_drawn_or_repaid: number;
  /** Shares issued, net of fees (6.6). */
  shares_issued_net: number;
  /** Dividends paid (5.17). */
  dividends: number;
}

/** Key figures at the period end (spec 3.9), filled by the caller from the company's state. */
export interface KeyFigures {
  productivity: number;
  /** Whole number (u32). */
  pc_bonus: number;
  /** Whole number (u64). */
  labor_units: number;
  held_tb: number;
  /** Whole percent (u32). */
  free_rd_pct: number;
  management_score: number;
  rating: Rating;
  /** Guidance range on next quarter's net income, low and high (5.16). */
  guidance: [number, number];
}

/** The period a statement covers. Rust derives `Ord`: every Quarter sorts before every Year. */
export type Period =
  | { kind: "Quarter"; quarter: Quarter }
  /** A calendar year (i32). Rust tuple variant `Year(i32)`. */
  | { kind: "Year"; year: number };

/**
 * One statement: the period's lines, the balance sheet at its end and the key figures
 * (spec 3.9).
 */
export interface Statement {
  period: Period;
  lines: Ledger;
  balance: BalanceSheet;
  key: KeyFigures;
  /** Built from the starting run rate (4.4, 7.1), not from posted ledgers. */
  synthetic: boolean;
}

// ---------------------------------------------------------------- state.rs

/** One posted month (spec 3.5 `ledger_month`), with the month it closes. */
export interface PostedMonth {
  month: Month;
  lines: Ledger;
}

/**
 * A company's finance state (spec 3.5: cash sits on the company; line_drawn, line_limit, rating,
 * ledger_month, statements, distress_months, status, frozen_quarters here).
 */
export interface CompanyFinance {
  /** Drawn, limit and the review's repayment window (spec 5.12). */
  line: CreditLine;
  /** The current rating (spec 5.12), moved at the 01:00 release-day review. */
  rating: Rating;
  /** The implied rating at the last review (or at load), with its breakdown (spec 5.12). */
  implied: ImpliedRating;
  /**
   * Notches the last review moved, better above 0 (spec 5.12, 3.6.4; the 2+ notch headline and
   * confidence rule of 5.1.2 and 5.18 read it from M5). Whole number (i32).
   */
  last_review_notches: number;
  /** Status, distress months and frozen quarters (spec 3.5, 5.12). */
  distress: DistressState;
  /** Loss carryforward and the quarter's accrual, the one tax payable (spec 5.11, D227). */
  tax: TaxBook;
  /**
   * Flows booked between monthly closes, whose cash already moved: a dividend paid at the plan
   * lock (5.17, M6.3), shares issued (6.6). The next monthly close posts them in the month they
   * fell in (D125).
   */
  pending: Ledger;
  /** The month being posted through 4.3 steps 9 to 14. */
  month: Ledger;
  /** The month runs: the company was not frozen when step 9 opened it (D231). */
  month_active: boolean;
  /** The posted months of the open quarter, oldest first (spec 4.4 compiles them). */
  months: PostedMonth[];
  /** The last posted month (its tax paid includes the close's payment at a quarter end). */
  last_month: PostedMonth | null;
  /**
   * The balance sheet at the last month's close: the opening of the month being posted
   * (build-plan M4.9).
   */
  opening: BalanceSheet;
  /**
   * The statement archive, shared with the statements view (copy on write, D130). Rust
   * `Arc<Archive>`: replace the object, never mutate one a view may hold.
   */
  archive: Archive;
  /** The day the company went Bankrupt (spec 5.12 step 2). */
  bankrupt_on: SimDate | null;
  /** The day it was removed (spec 5.12 step 3), with what removal did. */
  removed_on: SimDate | null;
  removal: Removal | null;
}

/**
 * A company's statements (spec 3.5 `statements`, 4.5 step 2): quarters oldest first, at most
 * ARCHIVE_QUARTERS (four synthetic 2019 quarters at load, 7.1, then one per close), and years
 * oldest first, at most ARCHIVE_YEARS. Shared with the quarterly statements view rather than
 * copied (D130).
 */
export interface Archive {
  quarters: Statement[];
  years: Statement[];
}

/**
 * The engine's own run of the build-plan M4.9 check: every company still in the game, every
 * month, `assets = liabilities + estate + equity` and every balance rolled through the month's
 * ledger (balance.rs `check_month`).
 */
export interface BooksCheck {
  /** Company months checked. Whole number (u64; far below 2^53). */
  checked: number;
  /** Whole number (u64). */
  failures: number;
  /** The first failure: company key, month and the check's message. */
  first_failure: string | null;
}
