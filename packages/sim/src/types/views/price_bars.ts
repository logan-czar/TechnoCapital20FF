// v_price_bars (crates/sim/src/views/price_bars.rs): `get_price_history(id, resolution, range)`
// (spec 9.2; Pdoomberg F3 Chart, spec 8): the daily bars of every company that has any (listed
// now, or delisted with its history kept), 10 years at most (4.5 step 2). Rebuilt daily (spec
// 9.4).
//
// Each history shares its chunks with the World (D139, D148), so a daily rebuild copies two
// pointers per company, however long the history.
//
// Not ported: PriceBarsView::get_price_history (weekly and monthly aggregation; a bar's EFV is
// its last daily bar's, D424) and the `ViewData` build (logic).

import type { CompanyId } from "../ids.ts";
import type { BarHistory } from "./shared.ts";

/**
 * The bar resolution of a price history query (spec 9.2; 3-markets 3.13.1 Chart: daily bars
 * up to a year, weekly bars up to 10 years).
 */
export type Resolution =
  | "Daily"
  /** Monday-to-Sunday weeks, dated by their first bar. */
  | "Weekly"
  /** Calendar months, dated by their first bar. */
  | "Monthly";

/** One company's bars. */
export interface PriceHistory {
  id: CompanyId;
  bars: BarHistory;
}

export interface PriceBarsView {
  /** Every company with bars, in company id order. */
  companies: PriceHistory[];
}
