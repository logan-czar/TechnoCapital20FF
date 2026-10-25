// The worker's frame patch (types/protocol.ts `ViewsPatch`; D950): the views whose version moved
// since the last frame posted, the TS stand-in for the Bevy bridge copying views by version
// (views/mod.rs `copy_changed_from`). Not a Rust file.
//
// Versions, never dirty flags: a view's dirty flag is true only for the latest refresh, and many
// ticks run per frame (protocol.ts). The news view only grows, so a frame carries the headlines
// appended since the last one; when the feed was replaced (a new game or a load), the patch sets
// `news_reset` and carries the whole feed, and the UI replaces its feed instead of appending.

import type { ViewsPatch } from "../types/protocol.ts";
import { type SimViews, VIEW_NAMES, type ViewName } from "../types/views/index.ts";

/** What the worker last posted: each view's version, the refresh, and the news feed's length. */
export interface PostedViews {
  /** By view; -1 for a view never posted. */
  versions: Record<ViewName, number>;
  /** The refresh number last posted; -1 before the first frame. */
  refresh: number;
  /** Omniscient last posted; null before the first frame. */
  omniscient: boolean | null;
  /** Headlines posted so far; -1 to post the whole feed with `news_reset` next time. */
  news_len: number;
}

/** Nothing posted yet: the first patch carries every view and the whole feed. */
export function postedViewsNone(): PostedViews {
  const versions = {} as Record<ViewName, number>;
  for (const n of VIEW_NAMES) versions[n] = -1;
  return { versions, refresh: -1, omniscient: null, news_len: -1 };
}

/**
 * Marks the news feed as replaced, so the next patch resets it: call after a NewGame or a Load
 * (every view is rebuilt then; the other views' versions move by themselves).
 */
export function postedViewsResetNews(posted: PostedViews): void {
  posted.news_len = -1;
}

/**
 * The patch of the views whose version differs from `posted`, and records them in `posted` as
 * posted. A patch with no keys means nothing moved. Views are shared, not copied (a build is
 * never mutated, views/index.ts), so postMessage clones exactly what the sim built. A news feed shorter than what was posted is taken as
 * replaced too.
 */
export function viewsPatchSince(views: SimViews, posted: PostedViews): ViewsPatch {
  const patch: Record<string, unknown> = {};
  if (views.refresh !== posted.refresh) {
    patch.refresh = views.refresh;
    posted.refresh = views.refresh;
  }
  if (views.omniscient !== posted.omniscient) {
    patch.omniscient = views.omniscient;
    posted.omniscient = views.omniscient;
  }
  const newsMoved = views.news.version !== posted.versions.news;
  for (const n of VIEW_NAMES) {
    const v = views[n];
    if (v.version === posted.versions[n]) continue;
    posted.versions[n] = v.version;
    if (n === "news") continue;
    patch[n] = v;
  }
  const out = patch as ViewsPatch;
  const feed = views.news.data.feed;
  const reset = posted.news_len < 0 || feed.length < posted.news_len;
  const from = reset ? 0 : posted.news_len;
  if (reset || feed.length > from) {
    out.news_appended = feed.slice(from);
    if (reset) out.news_reset = true;
    posted.news_len = feed.length;
  }
  if (newsMoved || reset) out.news_version = views.news.version;
  return out;
}
