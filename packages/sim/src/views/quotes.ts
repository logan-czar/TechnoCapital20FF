// v_quotes: `get_quotes(filter)` (spec 9.2; Pdoomberg F2 Quotes, spec 8): every quoted stock's
// last price, day change, volume (0, nobody trades in the MVP), estimated fair value with its
// +-15% band (3.14.2) and buzz; plus every exchange's headline index level now. Rebuilt every
// tick (spec 9.4), and after a control (Omniscient shows the true V). Ported from
// crates/sim/src/views/quotes.rs.
//
// Differences from Rust: Rust refills the two `Vec`s in place (D402, REBUILD_IN_PLACE); here a
// build is never mutated (D962), so each rebuild makes new arrays (`rebuildFrom` is omitted: the
// view is built anew, which equals Rust's in-place refill).

import { exchangeIndexLevel } from "../market/exchange_index.ts";
import { EFV_ERROR_WIDTH, exchangeCaps } from "../market/jobs.ts";
import { stockCap } from "../market/state.ts";
import { type CompanyId, ordinal, type ZoneId } from "../types/ids.ts";
import type { IndexQuote, QuoteRow, QuotesView } from "../types/views/quotes.ts";
import type { ViewInput } from "./index.ts";

/** Rust `QuotesView::get`: the quote of company `id`, if it is quoted (a binary search by id). */
export function quotesViewGet(v: QuotesView, id: CompanyId): QuoteRow | null {
  let lo = 0;
  let hi = v.rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const r = v.rows[mid] as QuoteRow;
    if (r.id === id) return r;
    if (r.id < id) lo = mid + 1;
    else hi = mid;
  }
  return null;
}

/** Rust `QuotesView::on_exchange`: the quotes on one exchange (spec 9.2 `get_quotes(filter)`). */
export function quotesViewOnExchange(v: QuotesView, zone: ZoneId): QuoteRow[] {
  return v.rows.filter((r) => r.exchange === zone);
}

/** Rust `QuotesView::index`: the index quote of one exchange. */
export function quotesViewIndex(v: QuotesView, zone: ZoneId): IndexQuote | null {
  return v.indices[zone] ?? null;
}

/** Rust `impl ViewData for QuotesView`: `build` (and `rebuild`, see the header). */
export function buildQuotes(input: ViewInput): QuotesView {
  const w = input.world;
  const omniscient = input.controls.omniscient;
  const rows: QuoteRow[] = [];
  w.market.stocks.forEach((s, i) => {
    if (s.exchange === null || !s.quoted) return;
    const efv = s.value * (1.0 + s.efv_error);
    const change = s.price - s.prev_close;
    rows.push({
      id: ordinal<CompanyId>(i),
      exchange: s.exchange,
      last: s.price,
      prev_close: s.prev_close,
      change,
      change_pct: s.prev_close > 0.0 ? change / s.prev_close : 0.0,
      volume: 0,
      efv,
      efv_low: efv * (1.0 - EFV_ERROR_WIDTH),
      efv_high: efv * (1.0 + EFV_ERROR_WIDTH),
      buzz: s.buzz,
      market_cap: stockCap(s),
      value: omniscient ? s.value : null,
    });
  });
  const caps = exchangeCaps(w);
  const indices = w.market.indices.map(
    (idx, z): IndexQuote => ({
      zone: ordinal<ZoneId>(z),
      level: exchangeIndexLevel(idx, caps[z] as number),
      prev_close: idx.prev_close,
    }),
  );
  return { rows, indices };
}
