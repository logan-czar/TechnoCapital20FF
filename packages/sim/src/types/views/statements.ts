// v_statements (crates/sim/src/views/statements.rs): `get_company_statements(id, period, count)`
// (spec 9.2), the Company screen's Financials tab (spec 8): each company's published quarterly
// and yearly statements (3.9), newest last, and in Omniscient the posted months of the open
// quarter. Rebuilt quarterly (spec 9.4: compile, release, lock and recap ticks) and when
// Omniscient is toggled (D423).
//
// A quarter's statement is built at the close and published at the next release (spec 4.4), so
// between the two it is held back (D130); the four synthetic 2019 quarters are history at load,
// Q4 2019 published on 2 January 2020 (spec 4.4). Removed companies keep their filings (5.12
// step 3).
//
// A private company publishes no statements (spec 1, 5.20.1 Listing step 4), nor does a new
// listing before its first release after listing: their statements are served as
// `EstimatedStatement`s, one figure per line keyed by the statement's period, so a quarter's
// estimate does not move from release to release, and a year's flows sum its quarters' (D420,
// D430). Their exact archive is not in the view at all, so a screen cannot show it; Omniscient
// serves it.
//
// TS DEVIATION: Rust's CompanyStatements holds the whole shared archive (`archive:
// Option<Arc<Archive>>`, private) plus `published_quarters`/`published_years` prefix counts, and
// slices it in `quarters()`/`years()`. A view crosses the worker boundary by structured clone, so
// the whole archive would carry the held-back quarter (D130) to the UI. Here the view holds the
// published prefixes only, as `quarters` and `years` (what Rust's accessors return).
//
// Not ported: quarter_published, published, EstimatedStatement::line, statement_line (D434),
// operating, estimated_quarter, estimated_year, ttm_line (D228, D430), the CompanyStatements and
// StatementsView accessors (quarters, years, get, statements, estimated, months) and the
// `ViewData` build and in-place rebuild (D435) (logic).

import type { CompanyId } from "../ids.ts";
import type { Figure } from "./estimate.ts";
import type { CompanyStatus, Period, PostedMonth, Rating, Statement } from "./shared.ts";

/** The period asked of `get_company_statements` (spec 9.2). */
export type StatementPeriod = "Month" | "Quarter" | "Year";

/**
 * A statement's figures that are not money (spec 3.9 key figures), shown exactly as
 * operations, but for held TB, a band (it would give the revenue away, D431).
 */
export interface OperatingFigures {
  productivity: number;
  pc_bonus: number;
  /** Whole number (u64). */
  labor_units: number;
  held_tb: Figure;
  free_rd_pct: number;
  management_score: number;
  rating: Rating;
}

/**
 * A statement of a company that does not publish: every line of `STATEMENT_LINE_VALUES` as a
 * figure (D420): a band, but the compute and licences line, which follows the published station
 * counts and stays exact (D434). Lines are estimated one by one, so the bands need not add up; a
 * year's flows are the sums of its quarters' bands (D430).
 */
export interface EstimatedStatement {
  period: Period;
  synthetic: boolean;
  /** One figure per `STATEMENT_LINE_VALUES` entry, in that order (32). */
  lines: Figure[];
  operating: OperatingFigures;
}

/**
 * One company's statements: its published archive (D130); or, for a company that does not
 * publish, the estimates of its published-by-date statements.
 */
export interface CompanyStatements {
  id: CompanyId;
  key: string;
  status: CompanyStatus;
  /**
   * The figures are estimate bands (D420): `quarters` and `years` are empty and the
   * statements are in `estimated_quarters` and `estimated_years`.
   */
  estimated: boolean;
  /**
   * Published quarters, oldest first (at most 20, spec 4.5); all of the archive's in
   * Omniscient; empty when estimated. (Rust: `quarters()`, see the header.)
   */
  quarters: Statement[];
  /**
   * Published years, oldest first (at most 5, D228); empty when estimated. (Rust: `years()`.)
   */
  years: Statement[];
  /**
   * The estimates of the quarters and years a published company would have published by
   * now, oldest first (D420).
   */
  estimated_quarters: EstimatedStatement[];
  estimated_years: EstimatedStatement[];
  /**
   * Posted months of the open quarter, oldest first: Omniscient only (monthly ledgers are not
   * published, spec 1).
   */
  months: PostedMonth[];
}

export interface StatementsView {
  /** Every company in company id order. */
  companies: CompanyStatements[];
}
