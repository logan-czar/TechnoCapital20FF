// v_price_bars: `get_price_history(id, resolution, range)` (spec 9.2; Pdoomberg F3 Chart, spec 8):
// the daily bars of every company that has any (listed now, or delisted with its history kept),
// 10 years at most (4.5 step 2). Rebuilt daily (spec 9.4). Ported from
// crates/sim/src/views/price_bars.rs.
//
// Each history shares its chunks with the World (D139, D148): the closed months and the open
// month are shared buffers, so a daily rebuild copies two small headers per company, however long
// the history (`chunkLogClone`).

import { barHistoryIsEmpty, barHistoryRange } from "../market/state.ts";
import { simDateDaysSinceEpoch, simDateWeekday, weekdayIndex } from "../time/calendar.ts";
import type { SimDate } from "../types/calendar.ts";
import { type CompanyId, ordinal } from "../types/ids.ts";
import type { DailyBar } from "../types/state/market.ts";
import type { PriceBarsView, PriceHistory, Resolution } from "../types/views/price_bars.ts";
import { chunkLogClone } from "../world/log.ts";
import type { ViewInput } from "./index.ts";

/**
 * Rust `PriceBarsView::get_price_history`: the bars of company `id` from `from` to `to`
 * inclusive at `resolution` (spec 9.2 `get_price_history`); empty for a company with none. A
 * weekly or monthly bar opens at its first daily bar's open, closes at its last's close and spans
 * their high and low; its EFV is the last daily bar's (D424), so the F3 band follows the close.
 */
export function priceBarsViewGetPriceHistory(
  v: PriceBarsView,
  id: CompanyId,
  resolution: Resolution,
  from: SimDate,
  to: SimDate,
): DailyBar[] {
  // `companies` is in company id order: a binary search by id.
  let lo = 0;
  let hi = v.companies.length;
  let found: PriceHistory | null = null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const h = v.companies[mid] as PriceHistory;
    if (h.id === id) {
      found = h;
      break;
    }
    if (h.id < id) lo = mid + 1;
    else hi = mid;
  }
  if (found === null) return [];
  const key = (d: SimDate): number => {
    switch (resolution) {
      case "Daily":
        return simDateDaysSinceEpoch(d);
      case "Weekly":
        return simDateDaysSinceEpoch(d) - weekdayIndex(simDateWeekday(d));
      case "Monthly":
        return d.year * 12 + d.month;
    }
  };
  const out: DailyBar[] = [];
  let lastKey: number | null = null;
  for (const b of barHistoryRange(found.bars, from, to)) {
    const k = key(b.date);
    const agg = out[out.length - 1];
    if (agg !== undefined && lastKey === k) {
      // Rust f64 `.max`/`.min`: the bars hold no NaN, so Math.max/min agree.
      agg.high = Math.max(agg.high, b.high);
      agg.low = Math.min(agg.low, b.low);
      agg.close = b.close;
      agg.efv = b.efv;
    } else {
      out.push({ ...b });
      lastKey = k;
    }
  }
  return out;
}

/** Rust `impl ViewData for PriceBarsView`: `build`. */
export function buildPriceBars(input: ViewInput): PriceBarsView {
  const companies: PriceHistory[] = [];
  input.world.market.stocks.forEach((s, i) => {
    if (!barHistoryIsEmpty(s.bars)) {
      companies.push({ id: ordinal<CompanyId>(i), bars: { log: chunkLogClone(s.bars.log) } });
    }
  });
  return { companies };
}
