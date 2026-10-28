// The market pages and Pdoomberg's models, read as data from the views of one real game (seed 42,
// a debug Sim so an Omniscient toggle gives the truth): lane B's share of
// crates/game/tests/market_pages.rs (industries_has_42_rows_and_a_detail_page,
// news_filters_by_industry_and_lists_startup_events, private_figures_are_bands_and_never_the_truth,
// screener_filters_by_origin_and_listing, no_ballot_odds_on_any_page), c1_news_feed.rs
// an_industry_without_headlines_says_so, b1_pages.rs the_event_log_names_events_and_companies (as
// the event list), and the band checks of the Industry and Event pages (D432, D437, D420).
// The terminal itself (keys, routes, row clicks) is pdoomberg-dom.test.tsx; the feed at scale is
// news-feed.test.ts (with the real-game half of the_lazy_feed_matches_the_whole_feed). The Rust
// recap parts are lane A's.

import {
  type CompanyId,
  dateTimeDate,
  dateTimeMidnight,
  dateTimeNext,
  type Figure,
  type IndustryId,
  lockTick,
  type Quarter,
  recapTick,
  type Sim,
  simDateDaysSinceEpoch,
  simDateYmd,
  simNew,
} from "@tc20ff/sim";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { buildNameIndex, eventName, type NameIndex } from "../../src/links/names.ts";
import {
  docBlocks,
  docField,
  docLinks,
  docSection,
  docTable,
  docTexts,
  type PageDoc,
  type TableDoc,
} from "../../src/pages/doc.ts";
import { eventDoc, eventsDoc } from "../../src/pages/kinds/events.tsx";
import {
  companiesTable,
  headlinesTable,
  industriesDoc,
  industryDoc,
  NO_HEADLINES,
  noHeadlinesNote,
} from "../../src/pages/kinds/industries.tsx";
import { type Filter, headlineDoc, newsModel, viewsFeed } from "../../src/pages/kinds/news.tsx";
import { PAGE_BUDGET_MS } from "../../src/pages/PagePane.tsx";
import { type PageRef, pageEq, setProvinceKeys } from "../../src/pages/ref.ts";
import { type ViewsData, viewsData } from "../../src/pages/views.ts";
import {
  bondsNote,
  chartNote,
  dailyChart,
  filingsNote,
  filingsTable,
  quotesTable,
  ratingSpreadsTable,
  ratingsStrip,
  ratingsTable,
  screenerTable,
  securityText,
  sovereignsTable,
  weeklyChart,
  zoneSpreadsTable,
} from "../../src/pdoomberg/models.ts";
import { type Cell, cellNumber, display, money, sortOrder } from "../../src/widgets/cells.ts";

const SEED = 42;
const Q1: Quarter = { year: 2020, q: 1 };

let sim: Sim;
/** Day one. */
let fresh: ViewsData;
/** Two days after the first plan lock: its headlines posted (D158). */
let afterLock: ViewsData;
/** Just past the Q1 recap, with 12 private companies on the watchlist. */
let recapped: ViewsData;
/** The same moment with Omniscient on: the truth. */
let truth: ViewsData;
/** The first day of Q2: the first quarter closed. */
let afterQ1: ViewsData;
/** The companies watched: estimated and private (market_pages `banded`). */
let banded: CompanyId[];

/** A copy of the views now (quotes and statements are rebuilt in place, so the sim's own move). */
const snapshot = (): ViewsData => viewsData(structuredClone(sim.views()));
const now = () => sim.views().clock.data.now;

beforeAll(() => {
  const loaded = loadWorld(defaultDataDir());
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  const made = simNew(loaded.value, SEED, { debug: true });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  sim = made.value;
  fresh = snapshot();
  banded = (fresh.company_rows?.rows ?? [])
    .filter((r) => r.estimated && !r.public)
    .map((r) => r.id)
    .slice(0, 12);
  for (const c of banded) expect(sim.apply({ kind: "WatchlistAdd", company: c }).ok).toBe(true);
  // The day after the lock: its headlines are posted at the next 00:00 (D158).
  const lockDay = simDateDaysSinceEpoch(dateTimeDate(lockTick(Q1)));
  while (simDateDaysSinceEpoch(sim.views().clock.data.date) < lockDay + 2) sim.step();
  afterLock = snapshot();
  while (now() <= recapTick(Q1)) sim.step();
  recapped = snapshot();
  expect(sim.apply({ kind: "SetOmniscient", on: true }).ok).toBe(true);
  truth = snapshot();
  expect(sim.apply({ kind: "SetOmniscient", on: false }).ok).toBe(true);
  // Past the Q1 close (market_pages: DateTime::midnight(Q1.next().first_day()).next()).
  const q2 = dateTimeNext(dateTimeMidnight(simDateYmd(2020, 4, 1)));
  while (now() < q2) sim.step();
  afterQ1 = snapshot();
  return () => setProvinceKeys(null);
});

const has = (links: PageRef[], p: PageRef) => links.some((l) => pageEq(l, p));
const col = (t: TableDoc, title: string): number => {
  const i = t.columns.findIndex((c) => c.title === title);
  if (i < 0) throw new Error(`no column ${title} in ${t.id}`);
  return i;
};
const cell = (t: TableDoc, r: number, c: number): Cell => t.rows[r]?.[c] ?? { k: "unknown" };
const linkOf = (c: Cell): PageRef | null => (c.k === "link" ? c.page : null);
const rowOf = (t: TableDoc, id: CompanyId): number =>
  t.rows.findIndex((r) => r.some((c) => c.k === "link" && pageEq(c.page, { kind: "company", id })));
const rowTexts = (t: TableDoc) => t.rows.flatMap((r) => r.map(display));
const exactOf = (f: Figure): number => {
  if (f.kind !== "Exact") throw new Error("Omniscient is exact");
  return f.value;
};

describe("Industries and an industry (kinds/industries.tsx; industries.rs)", () => {
  it("the Industries table has its 42 rows with the births column and the top 5 as links (market_pages industries_has_42_rows_and_a_detail_page)", () => {
    const index = buildNameIndex(fresh);
    const d = industriesDoc(fresh, index);
    const t = docTable(d, "industries");
    if (!t) throw new Error("the industries table");
    expect(t.rows.length).toBe(42);
    for (const k of ["Demand", "Supply", "S", "M", "Phase", "Long-term", "Growth", "Fringe", "Births"])
      col(t, k);
    // F9 shows the market factor M, not a price index (D881).
    const m = t.columns[col(t, "M")];
    expect(m?.hint?.startsWith("The market factor M")).toBe(true);
    expect(m?.title.includes("index") || m?.hint?.includes("index")).toBe(false);
    for (let i = 1; i <= 5; i++) {
      const c = col(t, `Top ${i}`);
      for (let r = 0; r < t.rows.length; r++) {
        const x = cell(t, r, c);
        expect(linkOf(x)?.kind === "company" || display(x) === "-", `top ${i}`).toBe(true);
      }
    }
    expect(t.rows.every((r) => r[0]?.k === "link")).toBe(true);
    const strip = docTexts(d, fresh).find((s) => s.startsWith("Global phase "));
    expect(strip).toContain("g_t");
  });

  it("an industry's page shows its figures, charts, company list and fringe row (same test)", () => {
    const v = afterQ1;
    const index = buildNameIndex(v);
    const id = 0 as IndustryId;
    const d = industryDoc(id, v, index);
    expect(d.title).toBe(index.title({ kind: "industry", id }));
    expect(d.sections.map((s) => s.id)).toEqual([
      "figures",
      "chart",
      "growth",
      "companies",
      "births",
      "news",
    ]);
    const charts = docBlocks(d).flatMap((b) => (b.k === "chart" ? [b.chart] : []));
    expect(charts.length, "the two charts").toBe(2);
    const history = v.industry_detail?.industries[id]?.history.length ?? 0;
    expect(history).toBeGreaterThanOrEqual(1);
    for (const c of charts) expect(c.labels.length).toBe(Math.min(history, 20));
    expect(charts[0]?.title).toContain("Demand vs supply");
    const t = docTable(d, "industry.companies");
    const detail = v.industry_detail?.industries[id];
    if (!t || !detail) throw new Error("the company list");
    expect(t.rows.length, "the companies and the fringe row").toBe(detail.companies.length + 1);
    expect(display(cell(t, t.rows.length - 1, 1))).toBe("Fringe (unnamed)");
    expect(companiesTable(v, index, id)?.rows.length).toBe(t.rows.length);
    // The headlines note says why the table is empty, and only then (PR #30 review).
    const news = headlinesTable(v, id);
    expect(docTable(d, "industry.news")).toEqual(news);
    const texts = docTexts(d, v);
    expect(texts.some((s) => s.startsWith("No headlines yet"))).toBe(news.rows.length === 0);
    expect(noHeadlinesNote(v, id) === "").toBe(news.rows.length > 0);
    for (let i = 0; i < 42; i++) {
      if (headlinesTable(v, i as IndustryId).rows.length === 0)
        expect(noHeadlinesNote(v, i as IndustryId).startsWith("No headlines yet")).toBe(true);
    }
    for (const f of [
      "Phase",
      "Demand",
      "Supply",
      "S",
      "M",
      "Long-term",
      "Growth (a year)",
      "Births (4 quarters)",
    ])
      expect(docField(d, f), f).toBeDefined();
    // Day one has no closed quarter: the charts say so.
    const early = industryDoc(id, fresh, buildNameIndex(fresh));
    expect(docTexts(early, fresh).filter((s) => s.startsWith("No closed quarter yet")).length).toBe(2);
  });

  it("an industry without headlines says so (c1_news_feed an_industry_without_headlines_says_so)", () => {
    expect(noHeadlinesNote(fresh, 0 as IndustryId)).toBe(
      "No headlines yet: phase changes, results, ratings, startups and listings in this industry post here.",
    );
    expect(NO_HEADLINES).not.toContain("  ");
    const tagged = afterLock.news?.feed.find((h) => h.industry !== null)?.industry;
    if (tagged == null) throw new Error("a tagged headline");
    expect(noHeadlinesNote(afterLock, tagged)).toBe("");
  });

  it("an estimated industry shows supply, S, M and fringe as bands (D432, D437)", () => {
    const v = recapped;
    const index = buildNameIndex(v);
    const rows = v.industry_rows?.rows ?? [];
    const estimated = rows.filter((r) => r.estimated);
    expect(estimated.length, "an estimated industry").toBeGreaterThan(0);
    for (const r of estimated) {
      const d = industryDoc(r.id, v, index);
      expect(d.chips.length).toBe(1);
      for (const f of ["Supply", "S", "M", "Fringe share"]) {
        const s = docField(d, f)?.value[0];
        expect(s?.k === "figure" && s.figure.kind === "Band", `${r.name} ${f}`).toBe(true);
      }
      const t = docTable(industriesDoc(v, index), "industries");
      const at = rows.indexOf(r);
      for (const c of ["Supply", "S", "M", "Fringe"]) expect(t && cell(t, at, col(t, c)).k).toBe("band");
      // The truth lies strictly inside each band (published demand can round to the same three
      // digits as the true supply, S being near 1, so the texts are not scanned for it here).
      const real = truth.industry_rows?.rows[r.id];
      if (!real) throw new Error("the truth");
      for (const [shown, x] of [
        [r.supply, real.supply],
        [r.fringe_share, real.fringe_share],
      ] as const) {
        if (shown.kind !== "Band") throw new Error("a band");
        expect(shown.band.low).toBeLessThan(exactOf(x));
        expect(shown.band.high).toBeGreaterThan(exactOf(x));
      }
    }
    // A history with an estimated quarter draws its supply as a band strip (D437, D466).
    const q = afterQ1.industry_detail?.industries.find((i) =>
      i.history.some((h) => h.supply.kind === "Band"),
    );
    if (q) {
      const d = industryDoc(q.id, afterQ1, buildNameIndex(afterQ1));
      const chart = docSection(d, "chart")?.blocks[0];
      expect(chart?.k === "chart" && chart.chart.series.some((s) => s.k === "band")).toBe(true);
    }
  });
});

describe("News feed and a headline (kinds/news.tsx; news.rs)", () => {
  it("the feed filters by industry and by company; every startup event appears (market_pages news_filters_by_industry_and_lists_startup_events)", () => {
    const v = afterLock;
    const index = buildNameIndex(v);
    const all = newsModel(v, index, {});
    expect(all.rows.length, "headlines after the first release and lock").toBeGreaterThan(0);
    const events = v.births?.events ?? [];
    expect(events.length, "the first plan lock fired startup events").toBeGreaterThan(0);
    for (const e of events) {
      const linked = all.rows.some((r) =>
        r.some((c) => pageEq(linkOf(c) ?? { kind: "world" }, { kind: "event", id: e.id })),
      );
      expect(linked, `event ${e.name} in the feed`).toBe(true);
    }
    const ind = v.news?.feed.find((h) => h.industry !== null)?.industry;
    if (ind == null) throw new Error("a tagged headline");
    const byInd: Filter = { industry: ind + 1 };
    const filtered = newsModel(v, index, byInd);
    expect(filtered.rows.length).toBeGreaterThan(0);
    expect(filtered.rows.length).toBeLessThan(all.rows.length);
    const ic = col(filtered, "Industry");
    const ec = col(filtered, "Startup event");
    for (const r of filtered.rows) {
      const tag = pageEq(linkOf(r[ic] as Cell) ?? { kind: "world" }, { kind: "industry", id: ind });
      const ev = linkOf(r[ec] as Cell);
      const viaEvent =
        ev?.kind === "event" && (events.find((e) => e.id === ev.id)?.industries.includes(ind) ?? false);
      expect(tag || viaEvent, "the row is about the industry").toBe(true);
    }
    // By company.
    const co = v.news?.feed.find((h) => h.company !== null)?.company;
    if (co == null) throw new Error("a company headline");
    const byCo = newsModel(v, index, { company: co + 1 });
    expect(byCo.rows.length).toBeGreaterThan(0);
    // Every headline links to its page, and the page opens with its subjects linked.
    const first = linkOf(cell(byCo, 0, 1));
    if (first?.kind !== "headline") throw new Error("a headline link");
    const hd = headlineDoc(first.id, v, index);
    expect(docTexts(hd, v)).toContain(index.title({ kind: "company", id: co }));
    // A startup event's page lists the startups it made.
    const e = events[0];
    if (e) {
      const ed = eventDoc(e.id, v, index);
      expect(docTable(ed, "event.startups")?.rows.length).toBe(e.startups.length);
      expect(docTexts(ed, v).some((s) => s.includes(e.name))).toBe(true);
    }
    // The kind filter: only startup stories (and unreported events) under "Startups".
    const startups = newsModel(v, index, { kind: 2 });
    const kc = col(startups, "Kind");
    for (const r of startups.rows)
      expect(["Startup event", "Startup", "Hot cluster"]).toContain(display(r[kc] as Cell));
  });

  it("a headline's page links every subject (placeholder.rs related, Headline)", () => {
    const v = afterQ1;
    const index = buildNameIndex(v);
    const feed = v.news?.feed ?? [];
    let withEvent = 0;
    for (const h of feed.slice(-300)) {
      const d = headlineDoc(h.id, v, index);
      expect(d.title).toBe(h.text);
      const links = docLinks(d);
      if (h.industry !== null) expect(has(links, { kind: "industry", id: h.industry })).toBe(true);
      if (h.company !== null) expect(has(links, { kind: "company", id: h.company })).toBe(true);
      expect(has(links, { kind: "news" })).toBe(true);
      if (h.kind.kind === "IpoVote" || h.kind.kind === "Listing") {
        const code = h.kind.exchange;
        const z = v.exchanges?.exchanges.find((x) => x.code === code)?.zone;
        if (z !== undefined) expect(has(links, { kind: "exchange", id: z })).toBe(true);
      }
      const e = h.event === null ? undefined : v.births?.events.find((x) => x.id === h.event);
      if (e) {
        withEvent++;
        expect(has(links, { kind: "event", id: e.id })).toBe(true);
        for (const c of e.startups) expect(has(links, { kind: "company", id: c })).toBe(true);
        for (const i of e.industries) expect(has(links, { kind: "industry", id: i })).toBe(true);
      }
      // Related headlines are about the same company (or industry) and never itself.
      for (const l of docSection(d, "related")?.blocks ?? []) {
        if (l.k !== "line") continue;
        const p = l.spans.find((s) => s.k === "link");
        if (p?.k !== "link" || p.page.kind !== "headline") continue;
        expect(p.page.id).not.toBe(h.id);
        const o = feed[p.page.id];
        if (h.company !== null) expect(o?.company).toBe(h.company);
        else if (h.industry !== null) expect(o?.industry).toBe(h.industry);
      }
    }
    // The startup headlines are among the oldest; check them too.
    for (const h of feed.filter((x) => x.event !== null)) {
      const links = docLinks(headlineDoc(h.id, v, index));
      expect(has(links, { kind: "event", id: h.event as number } as PageRef)).toBe(true);
      withEvent++;
    }
    expect(withEvent).toBeGreaterThan(0);
    // An id from another game says so and links the feed.
    const gone = headlineDoc(999_999 as never, v, index);
    expect(docTexts(gone, v).some((s) => s.startsWith("This headline is not in the feed"))).toBe(true);
    expect(has(docLinks(gone), { kind: "news" })).toBe(true);
  });
});

describe("Startup events (kinds/events.tsx; events.rs)", () => {
  it("an event's page lists its industries and startups as links, with founding sizes as bands while private", () => {
    const v = recapped;
    const index = buildNameIndex(v);
    const events = v.births?.events ?? [];
    expect(events.length).toBeGreaterThan(0);
    let bands = 0;
    for (const e of events) {
      const d = eventDoc(e.id, v, index);
      expect(d.title).toBe(eventName(e));
      const links = docLinks(d);
      for (const c of e.startups) expect(has(links, { kind: "company", id: c })).toBe(true);
      for (const i of e.industries) expect(has(links, { kind: "industry", id: i })).toBe(true);
      expect(has(links, { kind: "events" }) && has(links, { kind: "news" })).toBe(true);
      const t = docTable(d, "event.startups");
      if (!t) throw new Error("the startups table");
      const size = col(t, "Size");
      for (const [r, c] of e.startups.entries()) {
        const row = v.company_rows?.rows.find((x) => x.id === c);
        const birth = v.births?.births.find((b) => b.id === c);
        const real = truth.births?.births.find((b) => b.id === c);
        if (!row || !birth || !real) continue;
        const x = cell(t, r, size);
        if (birth.size_usd.kind === "Band") {
          bands++;
          expect(x.k).toBe("band");
          if (x.k === "band") {
            expect(x.low).toBeLessThan(exactOf(real.size_usd));
            expect(x.high).toBeGreaterThan(exactOf(real.size_usd));
          }
          expect(rowTexts(t)).not.toContain(money(exactOf(real.size_usd)));
        }
        if (!row.public)
          expect(birth.size_usd.kind, `${row.name} is private`).toBe(row.estimated ? "Band" : "Exact");
      }
      expect(docTexts(d, v).some((s) => s.startsWith("No headline reported") || s.length > 0)).toBe(true);
    }
    expect(bands, "private startups sized as bands").toBeGreaterThan(0);
    // An event that has not fired says so.
    const none = eventDoc(9_999 as never, v, index);
    expect(docTexts(none, v).some((s) => s.startsWith("This startup event has not fired"))).toBe(true);
  });

  it("the event list names events and companies from the views (b1_pages the_event_log_names_events_and_companies)", () => {
    // Rust checks the shell's event log lines; the TS port has no event log yet, so the check
    // reads the Events page, which lists the same events: by name and date, never an id.
    const v = afterLock;
    const index = buildNameIndex(v);
    const d = eventsDoc(v, index);
    const t = docTable(d, "events");
    const events = v.births?.events ?? [];
    if (!t) throw new Error("the events table");
    expect(t.rows.length).toBe(events.length);
    expect(events.length).toBeGreaterThan(0);
    // Newest first.
    const last = events[events.length - 1];
    expect(last && linkOf(cell(t, 0, 0))).toEqual({ kind: "event", id: last?.id });
    expect(display(cell(t, t.rows.length - 1, 0))).toBe(eventName(events[0] as never));
    for (const s of [...rowTexts(t), ...docTexts(d, v)]) {
      expect(s).not.toContain("#");
      expect(s).not.toMatch(/(Company|Industry|Startup event) \d+$/);
    }
    expect(docTexts(eventsDoc(fresh, buildNameIndex(fresh)), fresh)).toContain(
      "No startup event yet: events fire at plan locks (5.19).",
    );
  });
});

describe("Pdoomberg's models (pdoomberg/models.ts; pages.rs)", () => {
  it("F2, F5, F10 show a private company's figures as bands, never the truth; band columns sort by midpoint (market_pages private_figures_are_bands_and_never_the_truth)", () => {
    const v = recapped;
    const index = buildNameIndex(v);
    expect(v.clock?.omniscient).toBe(false);
    expect([...(v.clock?.watchlist ?? [])]).toEqual([...banded].sort((a, b) => a - b));
    const f2 = quotesTable(v, index, { list: 1 });
    expect(f2.rows.length, "the watchlist").toBe(banded.length);
    const f10 = screenerTable(v, index, {});
    const f5 = filingsTable(v, index);
    const screens = [
      ["F2", f2, "Value"],
      ["F10", f10, "Revenue TTM"],
      ["F5", f5, "Revenue"],
    ] as const;
    for (const id of banded)
      for (const [name, t, key] of screens) {
        const r = rowOf(t, id);
        expect(r, `${name} row of ${id}`).toBeGreaterThanOrEqual(0);
        expect(cell(t, r, col(t, key)).k, `${name} ${key} of ${id}`).toBe("band");
      }
    // Sorting a band column goes by the midpoints, the only value the player has.
    const vc = col(f10, "Value");
    const cells = f10.rows.map((r) => r[vc] as Cell);
    const shown = sortOrder(cells, true).flatMap((i) => {
      const n = cellNumber(cells[i] as Cell);
      return n === null ? [] : [n];
    });
    expect(shown.every((x, i) => i === 0 || (shown[i - 1] as number) <= x)).toBe(true);
    for (const c of cells) if (c.k === "band") expect(cellNumber(c)).toBe((c.low + c.high) / 2);

    // The truth from the Omniscient twin lies strictly inside each band, and shows nowhere.
    for (const id of banded) {
      const real = truth.company_rows?.rows.find((r) => r.id === id);
      if (!real) throw new Error("the truth");
      const pairs: [TableDoc, string, number][] = [
        [f2, "Value", exactOf(real.value)],
        [f10, "Revenue TTM", exactOf(real.revenue_ttm)],
        [f10, "NI TTM", exactOf(real.net_income_ttm)],
        [f10, "Value", exactOf(real.value)],
      ];
      const filing = truth.filings?.filings.find((f) => f.company === id);
      if (filing)
        pairs.push(
          [f5, "Revenue", exactOf(filing.revenue)],
          [f5, "EBIT", exactOf(filing.ebit)],
          [f5, "Net income", exactOf(filing.net_income)],
          [f5, "Cash", exactOf(filing.cash)],
          [f5, "Equity", exactOf(filing.equity)],
        );
      expect(pairs.length).toBeGreaterThanOrEqual(4);
      for (const [t, key, x] of pairs) {
        const c = cell(t, rowOf(t, id), col(t, key));
        if (c.k !== "band") throw new Error(`${t.id} ${key} of ${id} is a band`);
        expect(c.low, `${t.id} ${key}`).toBeLessThan(x);
        expect(c.high, `${t.id} ${key}`).toBeGreaterThan(x);
        expect(display(c).split(/[- ]/)).not.toContain(money(x));
      }
      const row = [f2, f10, f5].flatMap((t) => {
        const r = rowOf(t, id);
        return r < 0 ? [] : (t.rows[r] ?? []).map(display);
      });
      for (const [, , x] of pairs) expect(row, `${id}: shown as a value`).not.toContain(money(x));
    }
  });

  it("the F10 screener filters by origin and listing date, and by the 9.2 filters (market_pages screener_filters_by_origin_and_listing)", () => {
    const v = fresh;
    const index = buildNameIndex(v);
    const n = v.company_rows?.rows.length ?? 0;
    const all = screenerTable(v, index, {});
    expect(all.rows.length).toBe(n);
    const listed = col(all, "Listed");
    const before = screenerTable(v, index, { listing: 2 });
    expect(before.rows.length).toBeGreaterThan(0);
    expect(before.rows.length).toBeLessThan(n);
    expect(before.rows.every((r) => display(r[listed] as Cell) === "before 2020")).toBe(true);
    expect(screenerTable(v, index, { listing: 3 }).rows.length, "nothing listed in play on day one").toBe(0);
    expect(screenerTable(v, index, { origin: 2 }).rows.length, "nothing born on day one").toBe(0);
    expect(screenerTable(v, index, { origin: 1 }).rows.length).toBe(n);
    const pub = col(all, "Public");
    const priv = screenerTable(v, index, { origin: 1, public: 2 });
    expect(priv.rows.every((r) => display(r[pub] as Cell) === "private")).toBe(true);
    const ind = screenerTable(v, index, { origin: 1, public: 2, industry: 1 });
    const ic = col(all, "Industry");
    expect(
      ind.rows.every((r) =>
        pageEq(linkOf(r[ic] as Cell) ?? { kind: "world" }, { kind: "industry", id: 0 as IndustryId }),
      ),
    ).toBe(true);
    // Born in play shows after the first lock, with its origin date.
    const born = screenerTable(afterLock, buildNameIndex(afterLock), { origin: 2 });
    expect(born.rows.length).toBeGreaterThan(0);
    expect(born.rows.every((r) => display(r[col(born, "Origin")] as Cell).startsWith("born "))).toBe(true);
  });

  it("the other function pages fill from the views (F3 charts, F5, F6, F7, the security line)", () => {
    const v = recapped;
    const index = buildNameIndex(v);
    const q = v.quotes?.rows[0];
    if (!q) throw new Error("a quote");
    for (const m of [dailyChart(v, q.id), weeklyChart(v, q.id)]) {
      expect(m?.title).toContain("EFV band");
      expect(m?.labels.length).toBeGreaterThan(0);
      const c = m?.series[0];
      expect(c?.k === "candles" && c.bars.every((b) => b.band !== null)).toBe(true);
    }
    expect(chartNote(v, q.id)).toContain("never shown");
    const ticker = v.company_rows?.rows.find((r) => r.id === q.id)?.ticker ?? "";
    expect(securityText(v, index, q.id).startsWith(ticker)).toBe(true);
    const priv = banded[0] as CompanyId;
    expect(chartNote(v, priv)).toContain("Not quoted");
    expect(securityText(v, index, priv)).toContain("NOT QUOTED  VALUE ");
    expect(filingsTable(v, index).rows.length).toBeGreaterThan(600);
    expect(filingsNote(v)).toContain("the newest published quarter");
    expect(ratingsTable(v, index).rows.length).toBeGreaterThan(600);
    expect(ratingsStrip(v)).toMatch(/^Base rate .* \| by band: AAA \d+ {2}AA \d+/);
    expect(zoneSpreadsTable(v, index).rows.length).toBe(v.zones?.zones.length);
    expect(sovereignsTable(v, index).rows.length).toBe(v.countries?.countries.length);
    expect(ratingSpreadsTable(v).rows.length).toBeGreaterThan(5);
    expect(bondsNote(v)).toMatch(/^World base rate /);
  });
});

describe("pages across the market screens", () => {
  /** Every lane B page and Pdoomberg model, as texts (pages and tables). */
  function allTexts(v: ViewsData): string[] {
    const index = buildNameIndex(v);
    const docs: PageDoc[] = [industriesDoc(v, index), eventsDoc(v, index)];
    for (const e of v.births?.events ?? []) docs.push(eventDoc(e.id, v, index));
    for (let i = 0; i < 42; i++) docs.push(industryDoc(i as IndustryId, v, index));
    for (const it of [...viewsFeed(v)].slice(0, 30))
      if (it.k === "headline") docs.push(headlineDoc(it.h.id, v, index));
    const out = docs.flatMap((d) => docTexts(d, v));
    const co = v.quotes?.rows[0]?.id;
    for (const t of [
      newsModel(v, index, {}),
      quotesTable(v, index, {}),
      filingsTable(v, index),
      ratingsTable(v, index),
      zoneSpreadsTable(v, index),
      sovereignsTable(v, index),
      ratingSpreadsTable(v),
      screenerTable(v, index, {}),
    ])
      out.push(...t.columns.map((c) => `${c.title} ${c.hint ?? ""}`), ...rowTexts(t));
    out.push(ratingsStrip(v), filingsNote(v), bondsNote(v));
    if (co !== undefined) out.push(chartNote(v, co), securityText(v, index, co));
    return out;
  }

  it("no IPO ballot odds on any market or Pdoomberg page (market_pages no_ballot_odds_on_any_page)", () => {
    const texts = allTexts(afterQ1);
    expect(texts.length).toBeGreaterThan(1000);
    for (const t of texts) {
      const l = t.toLowerCase();
      expect(l.includes("odds") || l.includes("chance"), t).toBe(false);
    }
  });

  it(`builds each lane B page in under ${PAGE_BUDGET_MS} ms (Step 5: each screen < 100 ms)`, () => {
    const v = afterQ1;
    const index: NameIndex = buildNameIndex(v);
    const slowest = (build: () => unknown) => {
      build();
      let worst = 0;
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        build();
        worst = Math.max(worst, performance.now() - t0);
      }
      return worst;
    };
    const big = [...(v.industry_detail?.industries ?? [])].sort(
      (a, b) => b.companies.length - a.companies.length,
    )[0];
    const e = v.births?.events.reduce((a, b) => (b.startups.length > a.startups.length ? b : a));
    const h = v.news?.feed[v.news.feed.length - 1];
    if (!big || !e || !h) throw new Error("pages");
    const builds: [string, () => unknown][] = [
      ["industries", () => industriesDoc(v, index)],
      ["industry", () => industryDoc(big.id, v, index)],
      ["news", () => newsModel(v, index, {})],
      ["headline", () => headlineDoc(h.id, v, index)],
      ["events", () => eventsDoc(v, index)],
      ["event", () => eventDoc(e.id, v, index)],
      ["F2", () => quotesTable(v, index, {})],
      ["F5", () => filingsTable(v, index)],
      ["F6", () => ratingsTable(v, index)],
      ["F10", () => screenerTable(v, index, {})],
      ["F3", () => [dailyChart(v, 0 as CompanyId), weeklyChart(v, 0 as CompanyId)]],
    ];
    for (const [name, build] of builds) expect(slowest(build), name).toBeLessThan(PAGE_BUDGET_MS);
  });
});
