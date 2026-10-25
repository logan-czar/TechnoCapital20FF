// The views framework (views/index.ts, views/patch.ts; Rust views/mod.rs): cadences, versions and
// dirty flags, control and Omniscient refreshes, rebuilds at a new game and a load, unported
// views, copies by version and the worker's patch. Not a Rust file: Rust tested these through its
// view files' tests (Step 3) and views.rs; here a few views get stand-in builders.

import { describe, expect, it } from "vitest";
import { type Sim, simFromWorld, simViews } from "../../src/lib.ts";
import { dateTimeAt, dateTimeDate, simDateYmd } from "../../src/time/calendar.ts";
import { tickFactsNew } from "../../src/time/scheduler.ts";
import type { Headline } from "../../src/types/state/news.ts";
import {
  type BirthsView,
  type MarketStatsView,
  type NewsView,
  type ProjectionView,
  type QuotesView,
  VIEW_NAMES,
} from "../../src/types/views/index.ts";
import {
  cadenceIsDue,
  plainEqual,
  simViewsClone,
  simViewsCopyChangedFrom,
  simViewsSameData,
  type ViewBuilder,
  type ViewBuilders,
  type ViewInput,
  viewBuildersOnly,
  viewIsPorted,
} from "../../src/views/index.ts";
import { postedViewsNone, postedViewsResetNews, viewsPatchSince } from "../../src/views/patch.ts";
import { minimalWorld } from "../test_sim.ts";

const at = (y: number, m: number, d: number, h: number) => tickFactsNew(dateTimeAt(simDateYmd(y, m, d), h));

/** Daily: `listed` is the day of the month the view was built on. */
const marketStats: ViewBuilder<MarketStatsView> = {
  rust: "test market_stats",
  empty: () => ({
    listed: 0,
    quoted: 0,
    median_gap: 0,
    within_band: 0,
    mean_confidence: 0,
    reports: 0,
    beats: 0,
    misses: 0,
  }),
  build: (input: ViewInput) => ({
    listed: dateTimeDate(input.world.clock).day,
    quoted: 0,
    median_gap: 0,
    within_band: 0,
    mean_confidence: 0,
    reports: 0,
    beats: 0,
    misses: 0,
  }),
};

/** Daily and on control: `elapsed_share` is the selected speed. */
const projection: ViewBuilder<ProjectionView> = {
  rust: "test projection",
  empty: () => ({ elapsed_share: 0, companies: [] }),
  build: (input) => ({ elapsed_share: input.controls.speed, companies: [] }),
};

/** Daily: one headline per day since the start (or none for a fresh feed). */
const news: ViewBuilder<NewsView> = {
  rust: "test news",
  empty: () => ({ feed: [] }),
  build: (input) => ({
    feed: Array.from(
      { length: Math.floor(input.world.clock / 24) },
      (_, i) => ({ id: i }) as unknown as Headline,
    ),
  }),
};

/** Every tick, rebuilt from the last build: records the builds it was handed. */
function quotes(seen: QuotesView[]): ViewBuilder<QuotesView> {
  return {
    rust: "test quotes",
    empty: () => ({ rows: [], indices: [] }),
    build: () => ({ rows: [], indices: [] }),
    rebuildFrom: (prev) => {
      seen.push(prev);
      return { rows: [], indices: [] };
    },
  };
}

function builders(extra: Partial<ViewBuilders>): ViewBuilders {
  return { ...viewBuildersOnly(["clock"]), ...extra };
}

function sim(extra: Partial<ViewBuilders>, debug = false): Sim {
  return simFromWorld(minimalWorld(), 1, {
    debug,
    deps: { views: builders(extra) },
  });
}

describe("cadence", () => {
  it("each cadence is due on its ticks (spec 9.4)", () => {
    const due = (f: ReturnType<typeof at>) =>
      (["EveryTick", "Daily", "Monthly", "MonthlyAndLock", "Quarterly", "OnceAtLoad"] as const).filter((c) =>
        cadenceIsDue(c, f),
      );
    expect(due(at(2020, 3, 5, 7))).toEqual(["EveryTick"]);
    expect(due(at(2020, 3, 5, 0))).toEqual(["EveryTick", "Daily"]);
    expect(due(at(2020, 3, 1, 0))).toEqual(["EveryTick", "Daily", "Monthly", "MonthlyAndLock"]);
    expect(due(at(2020, 4, 1, 0))).toEqual(["EveryTick", "Daily", "Monthly", "MonthlyAndLock", "Quarterly"]);
    expect(due(at(2020, 4, 2, 0))).toEqual(["EveryTick", "Daily", "Quarterly"]);
    expect(due(at(2020, 4, 2, 1))).toEqual(["EveryTick", "Quarterly"]);
    expect(due(at(2020, 4, 9, 0))).toEqual(["EveryTick", "Daily", "MonthlyAndLock", "Quarterly"]);
    expect(due(at(2020, 6, 25, 0))).toEqual(["EveryTick", "Daily", "Quarterly"]);
  });
});

describe("SimViews", () => {
  it("builds every view at refresh 1, then rebuilds each on its cadence", () => {
    const s = sim({ market_stats: marketStats });
    const v = simViews(s);
    expect(v.refresh).toBe(1);
    for (const n of VIEW_NAMES) expect([n, v[n].version, v[n].dirty]).toEqual([n, 1, true]);
    s.step(); // 01:00
    expect(v.refresh).toBe(2);
    expect([v.clock.version, v.clock.dirty]).toEqual([2, true]);
    expect([v.market_stats.version, v.market_stats.dirty]).toEqual([1, false]);
    while (s.now() < 24) s.step(); // 2 Jan 00:00, refresh 25
    expect([v.market_stats.version, v.market_stats.dirty, v.market_stats.data.listed]).toEqual([25, true, 2]);
    s.step();
    expect([v.market_stats.version, v.market_stats.dirty]).toEqual([25, false]);
  });

  it("an unported view keeps its empty value and its version, and never crashes a step", () => {
    const s = sim({});
    expect(viewIsPorted("places", builders({}))).toBe(false);
    expect(viewIsPorted("clock", builders({}))).toBe(true);
    const v = simViews(s);
    const empty = v.cycle.data;
    while (s.now() < 24 * 40) s.step();
    expect(v.cycle).toEqual({ data: empty, version: 1, dirty: false });
    expect(v.places.version).toBe(1);
    // A new game builds every view again, unported ones too, at the next refresh.
    const r = v.refresh;
    expect(s.apply({ kind: "NewGame", seed: 2 }).ok).toBe(true);
    expect([v.places.version, v.places.dirty]).toEqual([r + 1, true]);
  });

  it("a control rebuilds the on-control views that changed, and moves the refresh only then", () => {
    const s = sim({ projection });
    const v = simViews(s);
    s.step();
    const r = v.refresh;
    // Resume changes the clock (paused), not the projection (speed).
    expect(s.apply({ kind: "Resume" }).ok).toBe(true);
    expect(v.refresh).toBe(r + 1);
    expect([v.clock.version, v.projection.version, v.projection.dirty]).toEqual([r + 1, 1, false]);
    expect(s.apply({ kind: "SetSpeed", speed: 3 }).ok).toBe(true);
    expect([v.refresh, v.projection.version, v.projection.data.elapsed_share]).toEqual([r + 2, r + 2, 3]);
    // Nothing a view shows changed: no rebuild, no new refresh.
    expect(s.apply({ kind: "SetAlert", alert_kind: "PlanLock", level: "Log" }).ok).toBe(true);
    expect(v.refresh).toBe(r + 2);
  });

  it("toggling Omniscient rebuilds the on-omniscient views (D423)", () => {
    const births: ViewBuilder<BirthsView> = {
      rust: "test births",
      empty: () => ({
        events: [],
        births: [],
        listings: [],
        full_characters_made: 0,
        full_characters: 0,
        births_column_quarters: [],
        births_by_industry: [],
      }),
      build: (input) => ({
        events: [],
        births: [],
        listings: [],
        full_characters_made: input.controls.omniscient ? 1 : 0,
        full_characters: 0,
        births_column_quarters: [],
        births_by_industry: [],
      }),
    };
    const s = sim({ births }, true);
    const v = simViews(s);
    expect(s.apply({ kind: "SetOmniscient", on: true }).ok).toBe(true);
    expect([v.births.version, v.births.data.full_characters_made, v.omniscient]).toEqual([
      v.refresh,
      1,
      true,
    ]);
  });

  it("a rebuild-in-place view is rebuilt from its last build, which stays as it was", () => {
    const seen: QuotesView[] = [];
    const s = sim({ quotes: quotes(seen) });
    const v = simViews(s);
    const first = v.quotes.data;
    s.step();
    expect(seen).toEqual([first]);
    expect(seen[0]).toBe(first);
    expect(v.quotes.data).not.toBe(first);
  });

  it("a load rebuilds every view and keeps the refresh climbing", () => {
    const s = sim({ market_stats: marketStats });
    while (s.now() < 30) s.step();
    const bytes = s.saveBytes();
    while (s.now() < 60) s.step();
    const v = simViews(s);
    const r = v.refresh;
    expect(s.loadBytes(bytes).ok).toBe(true);
    expect(v.refresh).toBe(r + 1);
    for (const n of VIEW_NAMES) expect([n, v[n].version, v[n].dirty]).toEqual([n, r + 1, true]);
    expect(v.clock.data.now).toBe(30);
    expect(v.market_stats.data.listed).toBe(2);
  });

  it("copyChangedFrom copies the views whose version moved; a held copy never changes", () => {
    const s = sim({ market_stats: marketStats });
    const copy = simViewsClone(simViews(s));
    const held = simViewsClone(copy);
    while (s.now() < 24) s.step();
    expect(simViewsSameData(copy, simViews(s))).toBe(false);
    simViewsCopyChangedFrom(copy, simViews(s));
    expect(simViewsSameData(copy, simViews(s))).toBe(true);
    expect(copy.refresh).toBe(simViews(s).refresh);
    s.step();
    expect(copy.market_stats.dirty, "a copy's flags do not follow the sim").toBe(true);
    expect(held.clock.data.now).toBe(0);
    expect(held.market_stats.data.listed).toBe(1);
  });

  it("plainEqual follows f64 ==", () => {
    expect(plainEqual({ a: [1, 0] }, { a: [1, -0] })).toBe(true);
    expect(plainEqual(Number.NaN, Number.NaN)).toBe(false);
    expect(plainEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(plainEqual(new Set([1, 2]), new Set([1, 2]))).toBe(true);
    expect(plainEqual([1], { 0: 1 })).toBe(false);
  });
});

describe("viewsPatchSince", () => {
  const extra = { market_stats: marketStats, news };

  it("posts the ported views first, then only what moved, with news as appended headlines", () => {
    const s = sim(extra);
    const b = builders(extra);
    const posted = postedViewsNone();
    const first = viewsPatchSince(simViews(s), posted, b);
    expect(Object.keys(first).sort()).toEqual([
      "clock",
      "market_stats",
      "news_appended",
      "news_reset",
      "news_version",
      "omniscient",
      "refresh",
    ]);
    expect(first.clock).toBe(simViews(s).clock);
    expect([first.news_appended, first.news_reset, first.news_version]).toEqual([[], true, 1]);
    expect(viewsPatchSince(simViews(s), posted, b)).toEqual({});
    s.step();
    expect(Object.keys(viewsPatchSince(simViews(s), posted, b)).sort()).toEqual(["clock", "refresh"]);
    while (s.now() < 48) s.step();
    const p = viewsPatchSince(simViews(s), posted, b);
    expect(p.news_appended?.map((h) => h.id)).toEqual([0, 1]);
    expect(p.news_reset).toBeUndefined();
    expect(p.news_version).toBe(simViews(s).news.version);
    while (s.now() < 72) s.step();
    expect(viewsPatchSince(simViews(s), posted, b).news_appended?.map((h) => h.id)).toEqual([2]);
    // After a new game the worker may mark the feed; the next patch resets it either way.
    expect(s.apply({ kind: "NewGame", seed: 9 }).ok).toBe(true);
    postedViewsResetNews(posted);
    const reset = viewsPatchSince(simViews(s), posted, b);
    expect([reset.news_appended, reset.news_reset]).toEqual([[], true]);
  });

  it("never posts an unported view, news included", () => {
    const s = sim({});
    const posted = postedViewsNone();
    expect(Object.keys(viewsPatchSince(simViews(s), posted, builders({}))).sort()).toEqual([
      "clock",
      "omniscient",
      "refresh",
    ]);
    while (s.now() < 24 * 40) s.step();
    expect(s.apply({ kind: "NewGame", seed: 3 }).ok).toBe(true);
    expect(Object.keys(viewsPatchSince(simViews(s), posted, builders({}))).sort()).toEqual([
      "clock",
      "refresh",
    ]);
  });

  it("detects a rebuild by itself: a loaded save's longer feed resets, not appends", () => {
    const s = sim(extra);
    const b = builders(extra);
    while (s.now() < 24 * 5) s.step();
    const save = s.saveBytes(); // a feed of 5
    expect(s.apply({ kind: "NewGame", seed: 2 }).ok).toBe(true);
    while (s.now() < 24 * 2) s.step();
    const posted = postedViewsNone();
    viewsPatchSince(simViews(s), posted, b);
    expect(posted.news_len).toBe(2);
    // No postedViewsResetNews: the worker forgot.
    expect(s.loadBytes(save).ok).toBe(true);
    const p = viewsPatchSince(simViews(s), posted, b);
    expect(p.news_reset).toBe(true);
    expect(p.news_appended?.map((h) => h.id)).toEqual([0, 1, 2, 3, 4]);
    // A NewGame with a feed as long as the one posted resets too.
    while (s.now() < 24 * 7) s.step();
    viewsPatchSince(simViews(s), posted, b);
    expect(s.apply({ kind: "NewGame", seed: 4 }).ok).toBe(true);
    expect(viewsPatchSince(simViews(s), posted, b).news_reset).toBe(true);
  });
});
