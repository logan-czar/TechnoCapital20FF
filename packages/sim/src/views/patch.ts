// The worker's frame patch (types/protocol.ts `ViewsPatch`; D950): the views whose version moved
// since the last frame posted, the TS stand-in for the Bevy bridge copying views by version
// (views/mod.rs `copy_changed_from`). Not a Rust file.
//
// Versions, never dirty flags: a view's dirty flag is true only for the latest refresh, and many
// ticks run per frame (protocol.ts). The news view only grows, so a frame carries the headlines
// appended since the last one; when the feed was replaced (a new game or a load), the patch sets
// `news_reset` and carries the whole feed, and the UI replaces its feed instead of appending.
// A rebuild is detected here (a once-at-load view's version moved), so the reset does not depend
// on the worker calling `postedViewsResetNews` (which stays as extra safety).
//
// Unported views (views/index.ts: a placeholder empty value, no builder yet) are never posted: the
// UI would show the placeholder as real data. The UI keeps whatever it shows for them until their
// builder lands.
//
// What the UI wants (D1016, protocol.ts `Want`): with a `ViewWant`, only the wanted views are
// posted (an unwanted one keeps its last posted version, so it goes out once it is wanted again),
// the heavy views in their light form (`lightView`), and each wanted slice when its view moved
// since the slice was last posted. A frame at max speed carried 25 to 35 MB without this, and
// copying it into the UI's thread took 300 to 500 ms.

import {
  type SliceData,
  type SliceKey,
  type SlicePatch,
  sliceId,
  type ViewsPatch,
} from "../types/protocol.ts";
import type { IndexHistory } from "../types/state/market.ts";
import { type SimViews, VIEW_NAMES, VIEW_SPECS, type View, type ViewName } from "../types/views/index.ts";
import { chunkLogNew } from "../world/log.ts";
import { VIEW_BUILDERS, type ViewBuilders } from "./index.ts";

/** What the UI reads now (protocol.ts `Want`). */
export interface ViewWant {
  views: ReadonlySet<ViewName>;
  slices: readonly SliceKey[];
}

/** The views posted light while a `ViewWant` is in force, their heavy parts going as slices. */
export const HEAVY_VIEWS: readonly ViewName[] = ["statements", "recap", "exchanges"];

/** An index history with no closes, in place of each exchange's in the light v_exchanges. */
const NO_CLOSES: IndexHistory = { log: chunkLogNew() };

/**
 * A heavy view without its heavy parts (D1016): v_statements with no companies, v_recap with no
 * company pages, v_exchanges with empty index histories. Any other view as it is.
 */
export function lightView<K extends ViewName>(name: K, v: SimViews[K]): SimViews[K] {
  switch (name) {
    case "statements": {
      const s = v as SimViews["statements"];
      return { ...s, data: { ...s.data, companies: [] } } as View<unknown> as SimViews[K];
    }
    case "recap": {
      const r = v as SimViews["recap"];
      const recaps = r.data.recaps.map((q) => ({ ...q, companies: [] }));
      return { ...r, data: { ...r.data, recaps } } as View<unknown> as SimViews[K];
    }
    case "exchanges": {
      const x = v as SimViews["exchanges"];
      const exchanges = x.data.exchanges.map((e) => ({ ...e, closes: NO_CLOSES }));
      return { ...x, data: { ...x.data, exchanges } } as View<unknown> as SimViews[K];
    }
    default:
      return v;
  }
}

/** A slice's data from the views: the company's statements, the quarter's recap, the exchange's closes. */
export function sliceData(views: SimViews, k: SliceKey): SliceData {
  switch (k.view) {
    case "statements":
      return views.statements.data.companies.find((c) => c.id === k.company) ?? null;
    case "recap":
      return (
        views.recap.data.recaps.find(
          (r) => r.world.quarter.year === k.quarter.year && r.world.quarter.q === k.quarter.q,
        ) ?? null
      );
    case "exchanges":
      return views.exchanges.data.exchanges.find((e) => e.zone === k.zone)?.closes ?? null;
  }
}

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
  /** The once-at-load views' versions last seen, posted or not: they move only on a rebuild. */
  load_key: string | null;
  /** Each wanted slice's version last posted, by `sliceId` (D1016). */
  slices: Record<string, number>;
}

/** Nothing posted yet: the first patch carries every view and the whole feed. */
export function postedViewsNone(): PostedViews {
  const versions = {} as Record<ViewName, number>;
  for (const n of VIEW_NAMES) versions[n] = -1;
  return { versions, refresh: -1, omniscient: null, news_len: -1, load_key: null, slices: {} };
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
 * never mutated, views/index.ts), so postMessage clones exactly what the sim built. `builders`
 * are the Sim's (`SimOptions.deps.views`): a view whose `build` is null is left out.
 *
 * The news feed is reset (the whole feed, `news_reset`) on the first patch, after
 * `postedViewsResetNews`, when the views were rebuilt since the last patch (a NewGame or a Load:
 * a once-at-load view's version moved) or when the feed is shorter than what was posted.
 */
export function viewsPatchSince(
  views: SimViews,
  posted: PostedViews,
  builders: ViewBuilders = VIEW_BUILDERS,
  want: ViewWant | null = null,
): ViewsPatch {
  const patch: Record<string, unknown> = {};
  // A once-at-load view changes version only when every view is rebuilt (views/index.ts
  // `simViewsRebuild`, unported views included); tracked whether those views are wanted or not.
  const loadKey = VIEW_NAMES.filter((n) => VIEW_SPECS[n].cadence === "OnceAtLoad")
    .map((n) => views[n].version)
    .join(",");
  const rebuilt = posted.load_key !== null && loadKey !== posted.load_key;
  posted.load_key = loadKey;
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
    if (want !== null && n !== "news" && !want.views.has(n)) continue;
    posted.versions[n] = v.version;
    if (n === "news" || builders[n].build === null) continue;
    patch[n] = want !== null && HEAVY_VIEWS.includes(n) ? lightView(n, v as never) : v;
  }
  const out = patch as ViewsPatch;
  if (want !== null) {
    const slices: SlicePatch[] = [];
    const kept: Record<string, number> = {};
    for (const key of want.slices) {
      const id = sliceId(key);
      const version = views[key.view].version;
      kept[id] = version;
      if (posted.slices[id] === version || builders[key.view].build === null) continue;
      slices.push({ key, version, data: sliceData(views, key) });
    }
    // A slice no longer wanted is forgotten, so it goes out again if it is wanted later.
    posted.slices = kept;
    if (slices.length > 0) out.slices = slices;
  }
  if (builders.news.build === null) return out;
  const feed = views.news.data.feed;
  const reset = rebuilt || posted.news_len < 0 || feed.length < posted.news_len;
  const from = reset ? 0 : posted.news_len;
  if (reset || feed.length > from) {
    out.news_appended = feed.slice(from);
    if (reset) out.news_reset = true;
    posted.news_len = feed.length;
  }
  if (newsMoved || reset) out.news_version = views.news.version;
  return out;
}
