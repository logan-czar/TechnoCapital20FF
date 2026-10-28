// The News feed at scale (crates/game/tests/c1_news_feed.rs, M9 C1; D545): late in a game the wire
// holds tens of thousands of headlines, and the feed table, the industry page's headlines and an
// event's headlines must cost the same as early on. A synthetic feed of 60,000 headlines checks
// that the work stays bounded, and a reference build of the whole feed (the old way: every row,
// sorted) checks the lazy walk gives the same rows in the same order. The third Rust test
// (an_industry_without_headlines_says_so) is in market.test.ts.

import {
  type CompanyId,
  type EventRow,
  type Headline,
  type HeadlineId,
  type IndustryId,
  type NewsView,
  type SimDate,
  type StartupEventId,
  simDateAddDays,
  simDateDaysSinceEpoch,
  simDateYmd,
  simNew,
} from "@tc20ff/sim";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { buildNameIndex, type NameIndex } from "../../src/links/names.ts";
import {
  eventHeadlines,
  FEED_ROWS,
  type FeedItem,
  feed,
  newestHeadlines,
  newsTable,
} from "../../src/pages/kinds/news.tsx";
import { type PageRef, setProvinceKeys } from "../../src/pages/ref.ts";
import { type ViewsData, viewsData } from "../../src/pages/views.ts";

/** Industries in the synthetic feed. */
const INDUSTRIES = 42;
/** Companies in the synthetic feed. */
const COMPANIES = 900;

const headline = (
  id: number,
  date: SimDate,
  industry: number,
  company: number | null,
  event: number | null,
): Headline => ({
  id: id as HeadlineId,
  date,
  industry: industry as IndustryId,
  company: company as CompanyId | null,
  event: event as StartupEventId | null,
  kind: event === null ? { kind: "Bankruptcy" } : { kind: "HotCluster", startups: 2 },
  text: event === null ? `Company ${id} files for bankruptcy` : "A hot cluster of drone startups in Shenzhen",
});

/** Appends `n` events on `date` that no headline reports. */
function unreported(events: EventRow[], date: SimDate, n: number): void {
  for (let i = 0; i < n; i++) {
    events.push({
      id: events.length as StartupEventId,
      kind: { kind: "Fixed", id: "F2" },
      name: "The crypto and SPAC mania",
      date,
      industries: [1 as IndustryId],
      startups: [5 as CompanyId],
    });
  }
}

/**
 * A feed of `n` headlines over about 30 years, 5 or so a day, with a startup event (and its hot
 * cluster headline) every 40th headline, pairs of unreported events on some days mid-feed, and
 * two a day after the last headline (fired today, their headlines post at the next 00:00).
 */
function synthetic(n: number): [NewsView, EventRow[]] {
  const out: Headline[] = [];
  const events: EventRow[] = [];
  const start = simDateYmd(2020, 1, 2);
  for (let i = 0; i < n; i++) {
    const date = simDateAddDays(start, Math.floor(i / 5));
    const industry = i % INDUSTRIES;
    if (i % 40 === 7) {
      const id = events.length;
      events.push({
        id: id as StartupEventId,
        kind: { kind: "Random", event_type: "HotCluster" },
        name: "Hot cluster",
        date,
        industries: [industry as IndustryId],
        startups: [(COMPANIES + id) as CompanyId, (COMPANIES + id + 1) as CompanyId],
      });
      out.push(headline(i, date, industry, null, id));
    } else out.push(headline(i, date, industry, i % COMPANIES, null));
    // Mid-feed, now and then two events on one day that posted no headline: some on a day
    // whose hot cluster did report its event, some on a day with none.
    if (i % 400 === 7 || i % 400 === 211) unreported(events, date, 2);
  }
  const last = out[out.length - 1]?.date ?? start;
  unreported(events, simDateAddDays(last, 1), 2);
  return [{ feed: out }, events];
}

/**
 * The old feed (PR #30): every headline and every unreported event, oldest first with a day's
 * events after its headlines, then reversed. Rows as page links.
 */
function reference(news: NewsView, events: readonly EventRow[]): PageRef[] {
  const reported = new Set(news.feed.flatMap((h) => (h.event === null ? [] : [h.event])));
  const rows: [number, PageRef][] = news.feed.map((h) => [
    simDateDaysSinceEpoch(h.date),
    { kind: "headline", id: h.id },
  ]);
  for (const e of events)
    if (!reported.has(e.id)) rows.push([simDateDaysSinceEpoch(e.date), { kind: "event", id: e.id }]);
  // A stable sort, as Rust's sort_by_key.
  rows.sort((a, b) => a[0] - b[0]);
  return rows.reverse().map((r) => r[1]);
}

const page = (i: FeedItem): PageRef => (i.k === "headline" ? i.page : { kind: "event", id: i.e.id });

function ms(f: () => void): number {
  const t = performance.now();
  f();
  return performance.now() - t;
}

/** A real game (seed 3) past the first release and lock: 15 July 2020, as c1_news_feed.rs. */
let real: ViewsData;
let index: NameIndex;

beforeAll(() => {
  const loaded = loadWorld(defaultDataDir());
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  const made = simNew(loaded.value, 3);
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  const sim = made.value;
  const until = simDateDaysSinceEpoch(simDateYmd(2020, 7, 15));
  while (simDateDaysSinceEpoch(sim.views().clock.data.date) < until) sim.step();
  real = viewsData(sim.views());
  index = buildNameIndex(real);
  return () => setProvinceKeys(null);
});

describe("the News feed at scale (c1_news_feed.rs)", () => {
  it("the lazy feed matches the whole feed (c1_news_feed the_lazy_feed_matches_the_whole_feed)", () => {
    const [news, events] = synthetic(4_000);
    const got = [...feed(news, events)].map(page);
    expect(got).toEqual(reference(news, events));
    const n = events.length;
    // Today's unreported events, newest first.
    expect(got.slice(0, 2)).toEqual([
      { kind: "event", id: n - 1 },
      { kind: "event", id: n - 2 },
    ]);
    expect(events.filter((e) => e.name !== "Hot cluster").length).toBeGreaterThan(20);
    // Each hot cluster headline links its event, by id.
    for (const i of feed(news, events)) if (i.k === "headline") expect(i.event?.id ?? null).toBe(i.h.event);
    // And on a real game's feed, past the first release and lock.
    const realNews = real.news ?? { feed: [] };
    const realEvents = real.births?.events ?? [];
    expect(realNews.feed.length).toBeGreaterThan(50);
    expect([...feed(realNews, realEvents)].map(page)).toEqual(reference(realNews, realEvents));
  });

  it("a long feed costs what a short one does (c1_news_feed a_long_feed_costs_what_a_short_one_does)", () => {
    const [short, shortEvents] = synthetic(6_000);
    const [long, longEvents] = synthetic(60_000);
    const time = (news: NewsView, events: EventRow[]): [number, number, number] => {
      let rows = 0;
      const table = ms(() => {
        rows = newsTable(news, events, index, {}).rows.length;
      });
      expect(rows).toBe(FEED_ROWS);
      const links = ms(() => {
        expect(newestHeadlines(news, (h) => h.industry === 3, 12).length).toBe(12);
      });
      const hot = events.filter((e) => e.name === "Hot cluster");
      const e = hot[Math.floor(events.length / 3)];
      if (!e) throw new Error("a hot cluster event");
      let n = 0;
      const event = ms(() => {
        n = eventHeadlines(news, e).length;
      });
      expect(n, "the event's one headline").toBe(1);
      return [table, links, event];
    };
    // Warm up, then take the best of three of each.
    time(short, shortEvents);
    const best = (news: NewsView, events: EventRow[]) => {
      let b: [number, number, number] = [Infinity, Infinity, Infinity];
      for (let i = 0; i < 3; i++) {
        const t = time(news, events);
        b = [Math.min(b[0], t[0]), Math.min(b[1], t[1]), Math.min(b[2], t[2])];
      }
      return b;
    };
    const s = best(short, shortEvents);
    const l = best(long, longEvents);
    // Ten times the headlines, about the same cost: well under twice, with slack for noise.
    expect(l[0], `feed table ${s} vs ${l}`).toBeLessThan(2 * s[0] + 5);
    expect(l[1], `industry headlines ${s} vs ${l}`).toBeLessThan(2 * s[1] + 1);
    expect(l[2], `event headlines ${s} vs ${l}`).toBeLessThan(2 * s[2] + 1);
    // A filter that matches little still walks without building rows; "All" lists everything.
    expect(newsTable(long, longEvents, index, { company: COMPANIES * 10 + 1 }).rows.length).toBe(0);
    expect(newsTable(short, shortEvents, index, { show: 3 }).rows.length).toBe(
      reference(short, shortEvents).length,
    );
    expect(newsTable(short, shortEvents, index, { show: 1 }).rows.length).toBe(2_000);
  });
});
