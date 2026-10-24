// v_news (crates/sim/src/views/news.rs): `get_news(since, filter)` (spec 9.2; 8 News feed:
// Pdoomberg Wire headlines with date and industry tag). Rebuilt daily (spec 9.4).
//
// In Rust the feed shares its month chunks with the World's wire (D148). Here the view is a plain
// array: a ChunkLog's shared buffer would cross the worker with rows past its `len` (headlines
// posted after the view's build). Across the worker the feed travels as appended headlines only
// (protocol.ts `news_appended`); ids are stable post-order positions (D544).
//
// Not ported: NewsView::get (binary search by HeadlineId, D544), ::since (D545), ::get_news and
// the `ViewData` build (logic).

import type { Headline } from "./shared.ts";

export interface NewsView {
  /** Every posted headline, oldest first. */
  feed: Headline[];
}
