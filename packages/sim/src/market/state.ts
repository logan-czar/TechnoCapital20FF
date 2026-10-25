// The market state on the World (spec 3.10, 3.5 valuation rows; build-plan M5): per company its
// price, fair value, release basis, buzz, consensus, the bar being built and its daily bars; per
// zone exchange its headline index (the zone's investor confidence sits on Zone). The jobs in
// ./jobs.ts move it. Ported from crates/sim/src/market/state.rs.
//
// MarketState, Stock and BarHistory (the data) are in types/state/market.ts.

import { simDateMonthOf, simDateYmd } from "../time/calendar.ts";
import { cmpDate, EPOCH_YEAR, monthEq, type SimDate } from "../types/calendar.ts";
import type { ZoneId } from "../types/ids.ts";
import type { BarHistory, DailyBar, MarketState, Stock } from "../types/state/market.ts";
import {
  chunkLogDropWhile,
  chunkLogIsEmpty,
  chunkLogIter,
  chunkLogLast,
  chunkLogLen,
  chunkLogNew,
  chunkLogPush,
  chunkLogSharesWith,
} from "../world/log.ts";
import { barBuilderStart } from "./daily.ts";
import { resultTagsDefault } from "./earnings.ts";
import { marketCap } from "./exchange_index.ts";

export type { BarHistory, MarketState, Stock };

/**
 * A company's row before the load values are set (spec 7.1): `price` is company-start.csv
 * `open_price` for a listed company, 0 for a private one. Rust `Stock::at_load`.
 */
export function stockAtLoad(exchange: ZoneId | null, price: number, shares: number): Stock {
  return {
    shares,
    exchange,
    quoted: exchange !== null,
    listed_on: null,
    ipo_price: exchange !== null ? price : 0.0,
    price,
    fair_value: 0.0,
    value: 0.0,
    basis: { e_norm: null, growth_factor: 1.0 },
    buzz: 0.0,
    consensus_ni: 0.0,
    projection_ni: 0.0,
    pending_surprise: null,
    last_surprise: 0.0,
    tags: resultTagsDefault(),
    efv_error: 0.0,
    prev_close: price,
    bar: barBuilderStart(simDateYmd(EPOCH_YEAR, 1, 1), price),
    bars: barHistoryNew(),
  };
}

/** The listed company's market cap at P (spec 5.14); 0 unless quoted. Rust `Stock::cap`. */
export function stockCap(s: Stock): number {
  return s.quoted ? marketCap(s.price, s.shares) : 0.0;
}

/** Rust `BarHistory::default()`. */
export function barHistoryNew(): BarHistory {
  return { log: chunkLogNew() };
}

/** Appends a closed bar (bars arrive in date order); a bar in a new month opens a chunk. */
export function barHistoryPush(h: BarHistory, bar: DailyBar): void {
  chunkLogPush(h.log, bar, (last, b) => monthEq(simDateMonthOf(last.date), simDateMonthOf(b.date)));
}

/** Every bar, oldest first. */
export function barHistoryIter(h: BarHistory): Generator<DailyBar, void, undefined> {
  return chunkLogIter(h.log);
}

/** The number of bars kept. */
export function barHistoryLen(h: BarHistory): number {
  return chunkLogLen(h.log);
}

export function barHistoryIsEmpty(h: BarHistory): boolean {
  return chunkLogIsEmpty(h.log);
}

/** The newest bar. */
export function barHistoryLast(h: BarHistory): DailyBar | null {
  return chunkLogLast(h.log);
}

/** The bars dated `from` to `to` inclusive, oldest first (spec 9.2 `get_price_history`). */
export function* barHistoryRange(
  h: BarHistory,
  from: SimDate,
  to: SimDate,
): Generator<DailyBar, void, undefined> {
  for (const b of chunkLogIter(h.log)) {
    if (cmpDate(b.date, from) >= 0 && cmpDate(b.date, to) <= 0) yield b;
  }
}

/**
 * Drops every bar dated before `firstKept` (spec 4.5 step 2: 10 years kept). Month chunks wholly
 * before it go; a chunk that straddles it is trimmed.
 */
export function barHistoryDropBefore(h: BarHistory, firstKept: SimDate): void {
  chunkLogDropWhile(h.log, (b) => cmpDate(b.date, firstKept) < 0);
}

/** True if `other` shares these bars' chunks (a view's copy, D148). */
export function barHistorySharesWith(h: BarHistory, other: BarHistory): boolean {
  return chunkLogSharesWith(h.log, other.log);
}
