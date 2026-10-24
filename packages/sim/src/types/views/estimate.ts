// Estimate bands (crates/sim/src/views/estimate.rs): what the observer sees of a figure that is
// not published (spec 1 Information, replaced by Logan's 2026-10-21 ruling, D420; design fix 420).
//
// Every financial figure of a private company, and of a new listing until its first release
// after listing (spec 5.20.1 Listing step 4), is shown as a band: a range of about ±25% around a
// noisy estimate. A `Figure` holds either the exact published value or a `Band`, never both, so
// the true value never reaches the UI. Omniscient (debug builds only, spec 1) serves the exact
// value. The noise is a hash of the seed, subject, kind, period and true value (D421), with a
// persistent bias per subject and kind (D429); derived figures come from their parts' bands
// (D430). The band holds the truth strictly inside it (D422).
//
// Types and the tuning constants only. Not ported (logic for the estimate port): Band::map,
// Figure's methods (exact, band, shown, is_band, map, sum, over, ratio), Kind::code,
// Subject::code, StatementLine::is_flow and ::of, shows_estimates, release_quarter, period_code,
// mix, estimate_hash, unit, the TAG_* hash tags, error, band_of and Estimator's methods.

import type { DateTime } from "../calendar.ts";
import type { CompanyId, IndustryId } from "../ids.ts";

/**
 * The smallest persistent bias of a banded figure, a share of the figure (T, D429): with the
 * jitter, every estimate is at least 5.5% off, the same way for a whole year.
 */
export const ESTIMATE_BIAS_MIN = 0.07;
/**
 * The largest persistent bias (T, D429): with the jitter, at most 15.5% off, about the ±15%
 * of the listed companies' EFV error (D140).
 */
export const ESTIMATE_BIAS_MAX = 0.14;
/**
 * The jitter on each period's and each value's estimate, either way (T, D429): small enough
 * that the bias's sign never flips, large enough that two values' ratio is not shown exactly.
 */
export const ESTIMATE_JITTER = 0.015;
/** The band's half-width around the estimate, a share of the estimate (T): Logan's "about ±25%" (2026-10-21, D420). */
export const ESTIMATE_BAND_HALF_WIDTH = 0.25;
/**
 * The scale under which a money figure's error and band stop shrinking, USD (T, D422): a
 * figure of 0 (a line never drawn) still gets a band about $0.5M wide.
 */
export const ESTIMATE_FLOOR_USD = 1.0e6;
/** The floor of a share of a whole (T, D422): 1 percentage point. */
export const ESTIMATE_FLOOR_SHARE = 0.01;
/** The floor of a data figure, TB (T, D431). */
export const ESTIMATE_FLOOR_TB = 1.0;
/** The floor of a productivity, points (T, D436). */
export const ESTIMATE_FLOOR_POINTS = 1.0;
/** The floor of a ratio such as M (T, D432). */
export const ESTIMATE_FLOOR_RATIO = 0.01;
/**
 * The salt of the estimate hash (D421), so its numbers share nothing with any other use of
 * the seed. Changing it re-draws every estimate (views only: no save or hash moves). A u64,
 * so a bigint: the hash is 64-bit wrapping arithmetic.
 */
export const ESTIMATE_HASH_SALT = 0x7c20_ffe5_71a7_e000n;

/**
 * An estimate with its band (D420): `low < truth < high` always holds for the hidden truth,
 * and `estimate` is never the truth.
 */
export interface Band {
  /**
   * The observer's noisy estimate: the band's centre for a banded figure, inside the band
   * for a derived one.
   */
  estimate: number;
  low: number;
  high: number;
}

/** A figure as a screen shows it: exact when published (or in Omniscient), else a band. */
export type Figure = { kind: "Exact"; value: number } | { kind: "Band"; band: Band };

/**
 * Which kind of figure an estimate is of (D429): the bias is drawn per subject and kind, so
 * every estimate of one kind of figure leans the same way. Its number (`Kind::code`) is part
 * of the hash.
 */
export type Kind =
  /**
   * A statement line, and the same figure monthly in v_units, v_company_detail and v_ratings
   * (revenue, costs, EBIT, capex, cash, line drawn, asset book).
   */
  | { kind: "Line"; line: StatementLine }
  /** The value shown for a private company (0.7 × fair value, spec 5.13 step 6). */
  | { kind: "Value" }
  | { kind: "LineLimit" }
  /** The quarter's net income consensus (5.16). */
  | { kind: "Consensus" }
  /** The engine's projection the recap reads (D280). */
  | { kind: "Projection" }
  /** The revenue a startup was sized for (5.19.3). */
  | { kind: "BirthSize" }
  | { kind: "GrossAssets" }
  | { kind: "AssetsEff" }
  /** A unit's productivity (5.6), banded with its money figures (D436). */
  | { kind: "Productivity" }
  | { kind: "HeldTb" }
  | { kind: "UnstructuredTb" }
  | { kind: "DecayTb" }
  /** An industry's supply, M, fringe revenue and fringe share (D432). */
  | { kind: "Supply" }
  | { kind: "MarketFactor" }
  | { kind: "FringeRevenue" }
  | { kind: "FringeShare" };

/** Whose figure an estimate is of. */
export type Subject = { kind: "Company"; company: CompanyId } | { kind: "Industry"; industry: IndustryId };

/**
 * Every money line of a statement (spec 3.9) in display order: income, cash flow, balance
 * sheet, then the guidance range (5.16). An estimated statement holds one figure per line.
 * The flows are the lines before `Cash` (`is_flow`).
 */
export type StatementLine =
  | "Revenue"
  | "Variable"
  | "FixedCash"
  | "OperatingCosts"
  | "Rd"
  | "Shared"
  | "Depreciation"
  | "Ebit"
  | "Ebitda"
  | "InterestExpense"
  | "InterestIncome"
  | "AssetSaleGain"
  | "PreTaxIncome"
  | "Tax"
  | "NetIncome"
  | "OperatingCash"
  | "AssetPurchases"
  | "AssetSales"
  | "LineDrawnOrRepaid"
  | "SharesIssuedNet"
  | "Dividends"
  | "NetCashChange"
  | "Cash"
  | "AssetBook"
  | "TotalAssets"
  | "BalanceLineDrawn"
  | "TaxPayable"
  | "TotalLiabilities"
  | "Estate"
  | "Equity"
  | "GuidanceLow"
  | "GuidanceHigh";

/**
 * Every line, in display order (Rust `StatementLine::ALL`, 32 lines): a line's index here is
 * its `as usize` discriminant, the index into `EstimatedStatement.lines`.
 */
export const STATEMENT_LINE_VALUES = [
  "Revenue",
  "Variable",
  "FixedCash",
  "OperatingCosts",
  "Rd",
  "Shared",
  "Depreciation",
  "Ebit",
  "Ebitda",
  "InterestExpense",
  "InterestIncome",
  "AssetSaleGain",
  "PreTaxIncome",
  "Tax",
  "NetIncome",
  "OperatingCash",
  "AssetPurchases",
  "AssetSales",
  "LineDrawnOrRepaid",
  "SharesIssuedNet",
  "Dividends",
  "NetCashChange",
  "Cash",
  "AssetBook",
  "TotalAssets",
  "BalanceLineDrawn",
  "TaxPayable",
  "TotalLiabilities",
  "Estate",
  "Equity",
  "GuidanceLow",
  "GuidanceHigh",
] as const;

/** The line's label (spec 3.9; Rust `StatementLine::label`). */
export const STATEMENT_LINE_LABELS: Readonly<Record<StatementLine, string>> = {
  Revenue: "Revenue",
  Variable: "Variable costs",
  FixedCash: "Fixed cash costs",
  OperatingCosts: "Operating costs",
  Rd: "R&D",
  Shared: "Compute and licences",
  Depreciation: "Depreciation",
  Ebit: "EBIT",
  Ebitda: "EBITDA",
  InterestExpense: "Interest expense",
  InterestIncome: "Interest income",
  AssetSaleGain: "Gain on asset sales",
  PreTaxIncome: "Pre-tax income",
  Tax: "Tax",
  NetIncome: "Net income",
  OperatingCash: "Operating cash",
  AssetPurchases: "Asset purchases",
  AssetSales: "Asset sales",
  LineDrawnOrRepaid: "Line drawn or repaid",
  SharesIssuedNet: "Shares issued, net",
  Dividends: "Dividends",
  NetCashChange: "Net change in cash",
  Cash: "Cash",
  AssetBook: "Business assets (book)",
  TotalAssets: "Total assets",
  BalanceLineDrawn: "Credit line drawn",
  TaxPayable: "Tax payable",
  TotalLiabilities: "Total liabilities",
  Estate: "Estate",
  Equity: "Equity",
  GuidanceLow: "Guidance, low",
  GuidanceHigh: "Guidance, high",
};

/**
 * Makes the figures of the views: the seed, whether Omniscient is on, and the clock. Sim-side
 * only (built per view build, never in a view).
 */
export interface Estimator {
  /** The game seed (u64): a bigint, since the estimate hash is 64-bit (D421). */
  seed: bigint;
  omniscient: boolean;
  now: DateTime;
}
