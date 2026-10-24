// v_quotes (crates/sim/src/views/quotes.rs): `get_quotes(filter)` (spec 9.2; Pdoomberg F2
// Quotes, spec 8): every quoted stock's last price, day change, volume (0, nobody trades in the
// MVP), estimated fair value with its ±15% band (3.14.2) and buzz; plus every exchange's headline
// index level now. Rebuilt every tick (spec 9.4), and after a control (Omniscient shows the true
// V).
//
// The rows are plain numbers keyed by company id and read only the market table; the ticker,
// name, industry and rating of an id are in v_company_row (and v_company_detail, v_ratings),
// which change at most monthly or quarterly (D144).
//
// Not ported: QuotesView::get, ::on_exchange, ::index and the in-place `ViewData` rebuild (D402)
// (logic).

import type { CompanyId, ZoneId } from "../ids.ts";

/**
 * One quote (spec 9.2 `get_quotes`: ticker, last, day change, volume 0, EFV, rating; the ticker
 * and rating by id from v_company_row).
 */
export interface QuoteRow {
  id: CompanyId;
  /** The listing exchange (its HQ country's zone, 5.14). */
  exchange: ZoneId;
  /** P now, USD a share (5.14). */
  last: number;
  /** The price at the last daily close (00:00). */
  prev_close: number;
  /** `last − prev_close`, and as a share of prev_close. */
  change: number;
  change_pct: number;
  /** Always 0 in the MVP (spec 5.14 "no order flow"); whole number (u64). */
  volume: number;
  /** The estimated fair value a share, `V × (1 + e)` (3.14.2), and its band, EFV ± 15%. */
  efv: number;
  efv_low: number;
  efv_high: number;
  /** Buzz, −100 to +100 (3.10). */
  buzz: number;
  /** `last × shares`, the index weight (5.14). */
  market_cap: number;
  /** The true V a share: only in Omniscient (spec 8 "true V is never shown"). */
  value: number | null;
}

/** One exchange's headline index now (spec 5.14). */
export interface IndexQuote {
  zone: ZoneId;
  /** null while the exchange has no quoted company (spec 5.14 "shows no level"). */
  level: number | null;
  /** The level at the last daily close. */
  prev_close: number | null;
}

export interface QuotesView {
  /** Every quoted stock, in company id order. */
  rows: QuoteRow[];
  /** Every zone exchange, in zone id order. */
  indices: IndexQuote[];
}
