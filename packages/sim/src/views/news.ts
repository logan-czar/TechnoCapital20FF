// v_news: `get_news(since, filter)` (spec 9.2; 8 News feed: Pdoomberg Wire headlines with date and
// industry tag). Rebuilt daily (spec 9.4). Ported from crates/sim/src/views/news.rs.
//
// In Rust the feed shares its month chunks with the World's wire (D148). Here the view's feed is
// a plain array (types/views/news.ts): the builder lists the wire's feed, oldest first, and
// across the worker only the appended headlines travel (protocol.ts, views/patch.ts).

import { cmpDate, type SimDate } from "../types/calendar.ts";
import type { HeadlineId, IndustryId } from "../types/ids.ts";
import type { Headline } from "../types/state/news.ts";
import type { NewsView } from "../types/views/news.ts";
import { chunkLogIter } from "../world/log.ts";
import type { ViewInput } from "./index.ts";

/** Rust `NewsView::get`: the headline with id `id` (D544), a binary search by id. */
export function newsViewGet(v: NewsView, id: HeadlineId): Headline | null {
  let lo = 0;
  let hi = v.feed.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const h = v.feed[mid] as Headline;
    if (h.id === id) return h;
    if (h.id < id) lo = mid + 1;
    else hi = mid;
  }
  return null;
}

/**
 * Rust `NewsView::since`: headlines dated on or after `since`, oldest first: the start is a
 * binary search, so a recent `since` reads only the recent headlines (D545).
 */
export function newsViewSince(v: NewsView, since: SimDate): Headline[] {
  let lo = 0;
  let hi = v.feed.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cmpDate((v.feed[mid] as Headline).date, since) < 0) lo = mid + 1;
    else hi = mid;
  }
  return v.feed.slice(lo);
}

/**
 * Rust `NewsView::get_news`: headlines posted on or after `since`, oldest first, optionally of
 * one industry (spec 9.2 `get_news(since, filter)`).
 */
export function newsViewGetNews(v: NewsView, since: SimDate, industry: IndustryId | null): Headline[] {
  return newsViewSince(v, since).filter((h) => industry === null || h.industry === industry);
}

/** Rust `impl ViewData for NewsView`: `build`. */
export function buildNews(input: ViewInput): NewsView {
  return { feed: [...chunkLogIter(input.world.news.feed)] };
}
