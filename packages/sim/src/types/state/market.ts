// The market state on the World (spec 3.10, 3.5 valuation rows, 5.13 to 5.15; build-plan M5):
// per company its price, fair value, release basis, buzz, consensus, the bar being built and its
// daily bars; per zone exchange its headline index and closes. Ported from
// crates/sim/src/market/: state.rs (MarketState, Stock, BarHistory), daily.rs (DailyBar,
// BarBuilder), earnings.rs (SurpriseTag, ResultTags), fair_value.rs (FairValueBasis) and index.rs
// (ExchangeIndex, IndexClose, IndexHistory). Types only.
//
// Not ported (logic and types no World field reaches): Stock::{at_load, cap};
// BarHistory::{push, iter, len, is_empty, last, range, drop_before, shares_with};
// IndexHistory's methods; DailyBar::{efv_low, efv_high}; BarBuilder's methods;
// SurpriseTag::{from_surprise, name}; FairValueBasis's methods; ExchangeIndex's methods;
// confidence::ConfidenceHeadline, engine_value::EngineValueInputs,
// fair_value::FairValueInputs, price::StockTick, projection::RangeViewer, jobs::HeldAtLock; and
// every formula and job in market/.

import type { SimDate } from "../calendar.ts";
import type { Table } from "../collections.ts";
import type { CompanyId, ZoneId } from "../ids.ts";
import type { ChunkLog } from "../log.ts";

// ---------------------------------------------------------------- state.rs

/** The market tables (spec 3.10, 5.14). */
export interface MarketState {
  /** One row per company, in company id order (private companies have a value, no price). */
  stocks: Table<CompanyId, Stock>;
  /** One headline index per zone exchange, in zone id order (spec 5.14, batch 152). */
  indices: Table<ZoneId, ExchangeIndex>;
  /** Each headline index's daily closes, 10 years kept, in zone id order (D540). */
  index_history: Table<ZoneId, IndexHistory>;
}

/** One company's valuation and quote (spec 3.10, 3.5). */
export interface Stock {
  /** The listing exchange: its HQ country's zone (spec 5.14); null while private. */
  exchange: ZoneId | null;
  /**
   * Quoted on its exchange: listed and not delisted at a bankruptcy (spec 5.12 step 2, D126).
   * Only quoted stocks move hourly, count in their index and get bars.
   */
  quoted: boolean;
  /**
   * The day it listed in play (5.20), null for the starting listed companies and while private;
   * with the price it listed at (spec 3.5 `listed_date`, `ipo_price`).
   */
  listed_on: SimDate | null;
  ipo_price: number;
  /** P, USD a share (spec 5.14); $0.00 once delisted and 0 for a private company. */
  price: number;
  /**
   * The share count the index weights P by: the company's shares_out (3.10), kept here so the
   * hourly caps read only this table, and synced at each daily close with the divisor rescaled
   * (D147). Whole number (u64, D3).
   */
  shares: number;
  /** Total fair value (spec 5.13), USD; 0 for a Bankrupt or Removed company (D138). */
  fair_value: number;
  /** V = fair value ÷ shares_out (spec 5.13 step 6). */
  value: number;
  /** What the last full recalculation fixed (D243): E_norm and G. */
  basis: FairValueBasis;
  /** −100 to +100 (spec 3.10), earnings only, decays 25% a day. */
  buzz: number;
  /** Next quarter's net income consensus, set at the plan lock (spec 3.10, 5.16). */
  consensus_ni: number;
  /**
   * The engine's no-rolls projection the consensus was drawn around (5.16, D141); the recap
   * reads it for the expected results (D280).
   */
  projection_ni: number;
  /**
   * The surprise of the quarter just closed, set at the close (4.4 result tags) and spent at the
   * 01:00 price move (5.15); null otherwise.
   */
  pending_surprise: number | null;
  /** The last report's surprise and result tags (spec 5.15, 21.3.2), for headlines. */
  last_surprise: number;
  tags: ResultTags;
  /**
   * The estimated fair value error e (spec 3.14.2, D140): EFV = V × (1 + e), drawn at each
   * release; 0 until the first.
   */
  efv_error: number;
  /** The price at the last daily close (00:00), for the day's change (spec 9.2 `get_quotes`). */
  prev_close: number;
  /** The bar being built today (spec 4.2 step 1; D248). */
  bar: BarBuilder;
  /** Daily bars, oldest first, 10 years kept (spec 3.10, 4.5 step 2). */
  bars: BarHistory;
}

/**
 * A company's daily bars (spec 3.10 `bars`), oldest first, in one chunk per calendar month
 * (D139, D148): the price history view shares the chunks, so a new bar copies at most the open
 * month. `log` is private in Rust.
 */
export interface BarHistory {
  log: ChunkLog<DailyBar>;
}

// ---------------------------------------------------------------- daily.rs

/**
 * A daily price bar (spec 3.10 `bars`): open, high, low and close, USD a share, and the
 * estimated fair value a share at the close (spec 8 Pdoomberg F3 "daily bars with the estimated
 * fair value band"; D424). The band is EFV × (1 ± 15%) (`efv_low`/`efv_high`, 3.14.2; D140).
 */
export interface DailyBar {
  /** The day the bar covers: the bar closed at 00:00 the next day. */
  date: SimDate;
  open: number;
  high: number;
  low: number;
  close: number;
  /**
   * EFV = V × (1 + e) at the close (3.14.2, D140, D150): the EFV in force through the day, read
   * before the 4.2 step 2 fair value refresh.
   */
  efv: number;
}

/**
 * The bar being built through the day (spec 4.2 step 1; D248). Started at 00:00 after the daily
 * jobs with the price they leave; each hourly step that moves prices adds its price; the 00:00
 * step that ends the day adds its price, then the daily job closes the bar.
 */
export interface BarBuilder {
  date: SimDate;
  open: number;
  high: number;
  low: number;
  last: number;
  /** True once an hourly step moved prices in the day (a market holiday has none). */
  traded: boolean;
}

// ---------------------------------------------------------------- earnings.rs

/** The surprise tier of a release (spec 5.15, 21.3.2); at most one per report (D249). */
export type SurpriseTag = "BigBeat" | "Beat" | "Miss" | "BigMiss";

/** The result types of one report (spec 5.15, 21.3.2), for headlines only. */
export interface ResultTags {
  surprise: SurpriseTag | null;
  /** Net income under 0 (21.3.2). */
  loss: boolean;
  /** Best revenue in the company's history (21.3.2; D249). */
  record_quarter: boolean;
}

// ---------------------------------------------------------------- fair_value.rs

/**
 * What the full recalculation at the release fixes until the next one (spec 4.2 step 2 "full
 * recalculation only at the release"; D243): normalized earnings and the growth factor.
 */
export interface FairValueBasis {
  /** E_norm (5.13 step 1); null for a company with no statements yet (D253). */
  e_norm: number | null;
  /** G (5.13 step 2). */
  growth_factor: number;
}

// ---------------------------------------------------------------- index.rs

/** One exchange's headline index (spec 5.14; D250). */
export interface ExchangeIndex {
  /** `Σ cap ÷ divisor` is the level; null while the exchange has no listed company. */
  divisor: number | null;
  /**
   * The last level shown, kept when the last company leaves so a later first listing resumes
   * from it (D250); `INDEX_BASE` (1,000) before any listing.
   */
  last_level: number;
  /**
   * The level at the last daily close (00:00), for the day's return (5.1.2); null if the exchange
   * showed no level then.
   */
  prev_close: number | null;
}

/**
 * One daily close of a headline index (spec 5.14, 4.2 step 6): the level at the 00:00 close,
 * dated that day, as v_zones' `index_close` is (D540).
 */
export interface IndexClose {
  date: SimDate;
  level: number;
}

/**
 * An exchange's headline index closes (spec 5.14; M9 plan 1 "the index chart", design fix 462;
 * D540): the load level on 1 January 2020, then one close a day while the exchange shows a
 * level, oldest first, in one chunk per calendar month (D148). 10 years are kept, as for the
 * daily bars (4.5 step 2). `log` is private in Rust.
 */
export interface IndexHistory {
  log: ChunkLog<IndexClose>;
}
