// The 26 zone exchanges' headline indices (spec 5.14; batches 152, 154; 3-markets 3.2.3): a
// market-cap weighted index of the exchange's listed companies, 1,000 at load, kept by a divisor
// so that a listing, a removal or a share issue never moves the level. An exchange with no
// listed company shows no level (A). Ported from crates/sim/src/market/index.rs (the path rule:
// market/index.rs is market/exchange_index.ts, since mod.rs is market/index.ts).
//
// ExchangeIndex, IndexClose and IndexHistory (the data) are in types/state/market.ts.

import { monthEq } from "../types/calendar.ts";
import type { SimDate } from "../types/calendar.ts";
import { cmpDate, simDateMonthOf } from "../time/index.ts";
import type { ExchangeIndex, IndexClose, IndexHistory } from "../types/state/market.ts";
import {
  chunkLogDropWhile,
  chunkLogIter,
  chunkLogIsEmpty,
  chunkLogLast,
  chunkLogLen,
  chunkLogNew,
  chunkLogPush,
  chunkLogSharesWith,
} from "../world/log.ts";

export type { ExchangeIndex, IndexClose, IndexHistory };

/** Spec 5.14: every headline index starts at 1,000. */
export const INDEX_BASE = 1000.0;
/** Spec 5.1.2: the index return feeds confidence in %. */
export const PERCENT = 100.0;

/** Market cap (spec 5.14): `price × shares_out`. */
export function marketCap(price: number, sharesOut: number): number {
  return price * sharesOut;
}

/** The index at load (spec 5.14): 1,000 at the listed companies' total cap, or no level. */
export function exchangeIndexAtLoad(totalCap: number): ExchangeIndex {
  const i: ExchangeIndex = { divisor: null, last_level: INDEX_BASE, prev_close: null };
  exchangeIndexRebase(i, totalCap, INDEX_BASE);
  i.prev_close = exchangeIndexLevel(i, totalCap);
  return i;
}

function exchangeIndexRebase(i: ExchangeIndex, totalCap: number, level: number): void {
  i.divisor = totalCap > 0.0 ? totalCap / level : null;
}

/** The level at `totalCap` (spec 5.14): `Σ cap ÷ divisor`; null with no listing. */
export function exchangeIndexLevel(i: ExchangeIndex, totalCap: number): number | null {
  return i.divisor === null ? null : totalCap / i.divisor;
}

/**
 * Keeps the level when the constituents change (a listing, a removal or delisting, a share
 * issue): call with the total cap just before and just after the change, at the same prices
 * (spec 5.14 "divisor kept on new listings"; D250). The new divisor is
 * `old divisor × cap after ÷ cap before`, so the level does not jump. A first listing on an
 * empty exchange starts at the last level shown (1,000 if none); the last company leaving keeps
 * that level and shows none.
 */
export function exchangeIndexReweight(i: ExchangeIndex, capBefore: number, capAfter: number): void {
  const before = exchangeIndexLevel(i, capBefore);
  const level = before !== null && capBefore > 0.0 ? before : i.last_level;
  if (capAfter > 0.0) {
    exchangeIndexRebase(i, capAfter, level);
  } else {
    i.divisor = null;
  }
  i.last_level = level;
}

/**
 * The daily return in % at the 00:00 close (spec 5.1.2 r_z): `(level ÷ previous close − 1) ×
 * 100`, 0 when either has no level (an exchange with no listed company has r 0); then the close
 * moves to today's level.
 */
export function exchangeIndexCloseDay(i: ExchangeIndex, totalCap: number): number {
  const now = exchangeIndexLevel(i, totalCap);
  if (now !== null) i.last_level = now;
  const prev = i.prev_close;
  const r = prev !== null && now !== null && prev > 0.0 ? (now / prev - 1.0) * PERCENT : 0.0;
  i.prev_close = now;
  return r;
}

/** Rust `IndexHistory::default()`. */
export function indexHistoryNew(): IndexHistory {
  return { log: chunkLogNew() };
}

/**
 * Appends the close of `date`. Closes arrive in date order; a date not after the last close's is
 * ignored (there is one close a day).
 */
export function indexHistoryRecord(h: IndexHistory, date: SimDate, level: number): void {
  const last = chunkLogLast(h.log);
  if (last !== null && cmpDate(last.date, date) >= 0) return;
  chunkLogPush(h.log, { date, level }, (a, c) => monthEq(simDateMonthOf(a.date), simDateMonthOf(c.date)));
}

/** Every close kept, oldest first. */
export function indexHistoryIter(h: IndexHistory): Generator<IndexClose, void, undefined> {
  return chunkLogIter(h.log);
}

export function indexHistoryLen(h: IndexHistory): number {
  return chunkLogLen(h.log);
}

export function indexHistoryIsEmpty(h: IndexHistory): boolean {
  return chunkLogIsEmpty(h.log);
}

export function indexHistoryLast(h: IndexHistory): IndexClose | null {
  return chunkLogLast(h.log);
}

/** Drops every close dated before `firstKept` (the 10 years kept, as 4.5 step 2 keeps bars). */
export function indexHistoryDropBefore(h: IndexHistory, firstKept: SimDate): void {
  chunkLogDropWhile(h.log, (c) => cmpDate(c.date, firstKept) < 0);
}

/** True if `other` shares these closes' chunks (a view's copy, D148). */
export function indexHistorySharesWith(h: IndexHistory, other: IndexHistory): boolean {
  return chunkLogSharesWith(h.log, other.log);
}
