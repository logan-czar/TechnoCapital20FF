// The News feed and a headline's page (crates/game/src/pages/news.rs, M9.6, M9.7; spec 8 News
// feed and Startups and listings rows; 20-ui 20.5.1).
//
// The feed lists the Pdoomberg Wire's headlines (5.18) newest first, each with its date, kind
// and industry tag, and every subject linked: the headline itself (its page), the industry, the
// company and, for a startup story, the startup event. It filters by industry, by company and
// by kind. Every startup event appears: a startup headline links to the event it reports (by
// the event id it carries, D543), and an event that posted no headline gets a row of its own.
//
// The helpers the Industries and Events pages share (`headlineLinks`, `eventHeadlines`,
// `industryOptions`) live here, as in Rust. The feed page is a component (its four pickers); the
// headline page is a doc.

import {
  type CompanyId,
  cmpStr,
  type EventRow,
  type Headline,
  type HeadlineId,
  type HeadlineKind,
  type IndustryId,
  type NewsView,
  type SimDate,
  type StartupEventId,
} from "@tc20ff/sim";
import { useMemo, useState } from "react";
import { eventName, type NameIndex } from "../../links/names.ts";
import { type Cell, date } from "../../widgets/cells.ts";
import { DocTable } from "../DocView.tsx";
import { type Block, emptyDoc, type PageDoc, span, type TableDoc } from "../doc.ts";
import { type Pick, Picker, pickId, pickOf } from "../Picker.tsx";
import { ChipRow, Note, PageHeader } from "../parts.tsx";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage, type PageProps } from "../spec.ts";
import { linkCell } from "../tables.ts";
import { byKey, type ViewsData } from "../views.ts";

/**
 * The wire's byline (spec 5.18 A; sim news.rs BYLINE, which the sim's public face does not export:
 * every headline carries it, so Headline::byline is this constant).
 */
export const BYLINE = "Pdoomberg Wire";

/** Related headlines a headline's page lists. */
export const RELATED_HEADLINES = 12;

/** The feed's kinds, for its kind filter (pick values from 1). */
export const KINDS: readonly (readonly [string, Pick])[] = [
  ["Results", 1],
  ["Startups", 2],
  ["Listings and IPO votes", 3],
  ["Ratings", 4],
  ["Phase changes", 5],
  ["Bankruptcies and removals", 6],
  ["Raises and other", 7],
];

/** A headline's kind name and its filter group. */
export function kindOf(k: HeadlineKind): [string, Pick] {
  switch (k.kind) {
    case "Result":
      return ["Result", 1];
    case "FixedStartupEvent":
      return ["Startup event", 2];
    case "StartupLaunch":
      return ["Startup", 2];
    case "HotCluster":
      return ["Hot cluster", 2];
    case "IpoVote":
      return ["IPO vote", 3];
    case "Listing":
      return ["Listing", 3];
    case "RatingChange":
      return ["Rating", 4];
    case "PhaseChange":
      return ["Phase change", 5];
    case "Bankruptcy":
      return ["Bankruptcy", 6];
    case "Removal":
      return ["Removal", 6];
    case "Raise":
      return ["Raise", 7];
    case "FailedRaise":
      return ["Failed raise", 7];
    case "Chatbot":
      return ["Chatbot", 7];
  }
}

/** The startup event a headline reports, by the id it carries (D543; events are in id order). */
export function eventOf(h: Headline, events: readonly EventRow[]): EventRow | undefined {
  return h.event === null ? undefined : byKey(events, (e) => e.id, h.event);
}

/** One line of the feed: a headline, or a startup event that posted none. */
export type FeedItem =
  | { k: "headline"; h: Headline; page: PageRef; event: EventRow | undefined }
  | { k: "event"; e: EventRow };

export function feedItemDate(i: FeedItem): SimDate {
  return i.k === "headline" ? i.h.date : i.e.date;
}

function hasIndustry(i: FeedItem, id: number): boolean {
  return i.k === "headline"
    ? i.h.industry === id || (i.event?.industries.includes(id as IndustryId) ?? false)
    : i.e.industries.includes(id as IndustryId);
}

function hasCompany(i: FeedItem, id: number): boolean {
  return i.k === "headline"
    ? i.h.company === id || (i.event?.startups.includes(id as CompanyId) ?? false)
    : i.e.startups.includes(id as CompanyId);
}

function itemKind(i: FeedItem): [string, Pick] {
  return i.k === "headline" ? kindOf(i.h.kind) : ["Startup event", 2];
}

/** A day as one comparable number. */
const dayKey = (d: SimDate) => d.year * 372 + (d.month - 1) * 31 + (d.day - 1);

/**
 * The feed, newest first (D545): every headline (with the event it reports) and every startup
 * event that posted no headline, at its date; on one date the events come before the
 * headlines, each newest first. It walks the feed backwards a day at a time and stops where
 * its reader stops, so the newest rows cost the same however long the feed is. An event's
 * headline is dated the event's own day (both at the plan lock, D543), so when the walk
 * reaches an event's date it has seen any headline that reports it.
 */
export function* feed(news: NewsView, events: readonly EventRow[]): Generator<FeedItem> {
  const heads = news.feed;
  let nextHead = heads.length;
  let nextEvent = events.length;
  // The events reported by the headlines walked so far.
  const reported = new Set<StartupEventId>();
  for (;;) {
    const h = nextHead > 0 ? heads[nextHead - 1] : undefined;
    const e = nextEvent > 0 ? events[nextEvent - 1] : undefined;
    if (!h && !e) return;
    const day = Math.max(h ? dayKey(h.date) : -1, e ? dayKey(e.date) : -1);
    const dayHeads: FeedItem[] = [];
    for (; nextHead > 0; nextHead--) {
      const x = heads[nextHead - 1] as Headline;
      if (dayKey(x.date) !== day) break;
      if (x.event !== null) reported.add(x.event);
      dayHeads.push({ k: "headline", h: x, page: { kind: "headline", id: x.id }, event: eventOf(x, events) });
    }
    for (; nextEvent > 0; nextEvent--) {
      const x = events[nextEvent - 1] as EventRow;
      if (dayKey(x.date) !== day) break;
      if (!reported.has(x.id)) yield { k: "event", e: x };
    }
    yield* dayHeads;
  }
}

/** The views' feed, newest first (see `feed`). */
export function viewsFeed(v: ViewsData): Generator<FeedItem> {
  return feed(v.news ?? { feed: [] }, v.births?.events ?? []);
}

/** A page's filter picks by key (live.rs `Filter`): a missing key is 0, "all". */
export type Filter = Readonly<Record<string, Pick>>;

export const filterGet = (f: Filter, key: string): Pick => f[key] ?? 0;
export const filterId = (f: Filter, key: string): number | null => pickId(filterGet(f, key));

/** Whether a feed item passes the filter: industry, company and kind (D511 picks). */
function passes(item: FeedItem, f: Filter): boolean {
  const i = filterId(f, "industry");
  if (i !== null && !hasIndustry(item, i)) return false;
  const c = filterId(f, "company");
  if (c !== null && !hasCompany(item, c)) return false;
  const k = filterGet(f, "kind");
  return k === 0 || itemKind(item)[1] === k;
}

/** The rows the feed table lists by default: the newest that pass the filters (D545). */
export const FEED_ROWS = 500;

/** The feed's "Show" pick (pick values from 1; 0 is the newest FEED_ROWS). */
export const SHOW: readonly (readonly [string, Pick])[] = [
  ["Newest 2,000", 1],
  ["Newest 10,000", 2],
  ["All", 3],
];

/**
 * The Show picker's own pick of the default (the newest FEED_ROWS): the Picker's first chip is
 * always "All" at 0, so the picker shows the filter's 0 under this pick and its "All" (3) at 0.
 */
export const SHOW_NEWEST_PICK = 4;

/** The Show picker's options: the newest FEED_ROWS first ("All" is the Picker's own chip). */
export const SHOW_OPTIONS: readonly (readonly [string, Pick])[] = [
  [`Newest ${FEED_ROWS}`, SHOW_NEWEST_PICK],
  ...SHOW.filter(([, p]) => p !== 3),
];

/** A filter's show pick as the Show picker's, and back. */
export const showToPicker = (p: Pick): Pick => (p === 0 ? SHOW_NEWEST_PICK : p === 3 ? 0 : p);
export const showFromPicker = (p: Pick): Pick => (p === SHOW_NEWEST_PICK ? 0 : p === 0 ? 3 : p);

/** The most rows the "Show" pick of `f` lists; null for all. */
export function shownRows(f: Filter): number | null {
  switch (filterGet(f, "show")) {
    case 0:
      return FEED_ROWS;
    case 1:
      return 2_000;
    case 2:
      return 10_000;
    default:
      return null;
  }
}

const dash: Cell = { k: "text", v: "-" };

/**
 * The feed table (spec 8 News feed: date and industry tag; every subject a link): the newest
 * rows that pass the filters, at most the "Show" pick's count (D545).
 */
export function newsTable(
  news: NewsView,
  events: readonly EventRow[],
  index: NameIndex,
  f: Filter,
): TableDoc {
  const limit = shownRows(f) ?? Number.POSITIVE_INFINITY;
  const rows: Cell[][] = [];
  if (limit > 0) {
    for (const item of feed(news, events)) {
      if (!passes(item, f)) continue;
      const [kind] = itemKind(item);
      if (item.k === "headline") {
        const { h, page, event } = item;
        rows.push([
          { k: "date", v: h.date },
          { k: "link", text: h.text, page },
          { k: "text", v: kind },
          h.industry === null ? dash : linkCell(index, { kind: "industry", id: h.industry }),
          h.company === null ? dash : linkCell(index, { kind: "company", id: h.company }),
          event ? { k: "link", text: eventName(event), page: { kind: "event", id: event.id } } : dash,
        ]);
      } else {
        const e = item.e;
        const ind = e.industries[0];
        const co = e.startups[0];
        rows.push([
          { k: "date", v: e.date },
          {
            k: "link",
            text: `${e.name}: ${e.startups.length} new startups`,
            page: { kind: "event", id: e.id },
          },
          { k: "text", v: kind },
          ind === undefined ? dash : linkCell(index, { kind: "industry", id: ind }),
          co === undefined ? dash : linkCell(index, { kind: "company", id: co }),
          { k: "link", text: eventName(e), page: { kind: "event", id: e.id } },
        ]);
      }
      if (rows.length >= limit) break;
    }
  }
  return {
    id: "news",
    columns: [
      { title: "Date", width: 96 },
      { title: "Headline", width: 440, hint: "Pdoomberg Wire (5.18); opens the headline" },
      { title: "Kind", width: 110 },
      { title: "Industry", width: 170, hint: "The industry tag (spec 8)" },
      { title: "Company", width: 190 },
      { title: "Startup event", width: 220 },
    ],
    rows,
  };
}

/** `newsTable` over the views. */
export function newsModel(v: ViewsData, index: NameIndex, f: Filter): TableDoc {
  return newsTable(v.news ?? { feed: [] }, v.births?.events ?? [], index, f);
}

/** Options sorted by label in byte order, after "All" (Rust's tuple sort; labels are unique). */
export function sortedOptions(o: [string, Pick][]): [string, Pick][] {
  return o.sort((a, b) => cmpStr(a[0], b[0]) || a[1] - b[1]);
}

/** The industry options of a picker: the 42 by name (the Picker adds "All"). */
export function industryOptions(v: ViewsData): [string, Pick][] {
  return sortedOptions((v.industry_rows?.rows ?? []).map((r) => [r.name, pickOf(r.id)]));
}

/** The companies the feed names, by name: the headlines' and the events' startups. */
export function feedCompanyOptions(v: ViewsData, index: NameIndex): [string, Pick][] {
  const cos = new Set<number>();
  for (const h of v.news?.feed ?? []) if (h.company !== null) cos.add(h.company);
  for (const e of v.births?.events ?? []) for (const c of e.startups) cos.add(c);
  return sortedOptions(
    [...cos].map((c) => [index.title({ kind: "company", id: c as CompanyId }), pickOf(c)]),
  );
}

/** The note under the feed's pickers. */
export function feedNote(v: ViewsData): string {
  const n = v.news?.feed.length ?? 0;
  const events = v.births?.events.length ?? 0;
  return n === 0 && events === 0
    ? "No headlines yet: the wire posts from the first release, plan lock and phase change."
    : `Lists the newest ${FEED_ROWS} rows that pass the filters; Show lists more. A column sort reorders only the rows shown.`;
}

const PICKERS = [
  ["Industry", "industry"],
  ["Company", "company"],
  ["Kind", "kind"],
  ["Show", "show"],
] as const;

function NewsPage({ views: v, index }: PageProps<"news">) {
  const [filter, setFilter] = useState<Filter>({});
  const table = useMemo(() => newsModel(v, index, filter), [v, index, filter]);
  const options = useMemo(
    (): Record<(typeof PICKERS)[number][1], [string, Pick][]> => ({
      industry: industryOptions(v),
      company: feedCompanyOptions(v, index),
      kind: [...KINDS] as [string, Pick][],
      show: [...SHOW_OPTIONS] as [string, Pick][],
    }),
    [v, index],
  );
  const n = v.news?.feed.length ?? 0;
  const events = v.births?.events.length ?? 0;
  return (
    <div className="doc">
      <PageHeader
        title={kindName("news")}
        kind={`${n} headlines, ${events} startup events`}
        note="Pdoomberg Wire (5.18)"
      />
      <ChipRow>
        {PICKERS.map(([label, key]) => (
          <Picker
            key={key}
            label={label}
            options={options[key]}
            value={key === "show" ? showToPicker(filterGet(filter, key)) : filterGet(filter, key)}
            onChange={(p) => setFilter((f) => ({ ...f, [key]: key === "show" ? showFromPicker(p) : p }))}
          />
        ))}
      </ChipRow>
      <Note>{feedNote(v)}</Note>
      <DocTable table={table} />
    </div>
  );
}

/**
 * The newest headlines that pass `keep`, at most `limit`: date, text and page. It walks the
 * headlines backwards and stops at `limit`, building no feed rows (D545).
 */
export function newestHeadlines(
  news: NewsView | undefined,
  keep: (h: Headline) => boolean,
  limit: number,
): [SimDate, string, PageRef][] {
  const out: [SimDate, string, PageRef][] = [];
  const f = news?.feed ?? [];
  for (let i = f.length - 1; i >= 0 && out.length < limit; i--) {
    const h = f[i] as Headline;
    if (keep(h)) out.push([h.date, h.text, { kind: "headline", id: h.id }]);
  }
  return out;
}

/** `newestHeadlines` over the views. */
export function headlineLinks(
  v: ViewsData,
  keep: (h: Headline) => boolean,
  limit: number,
): [SimDate, string, PageRef][] {
  return newestHeadlines(v.news, keep, limit);
}

/** The first headline dated on or after `day` (a binary search; the feed is in date order). */
function firstSince(feedRows: readonly Headline[], day: number): number {
  let lo = 0;
  let hi = feedRows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dayKey((feedRows[mid] as Headline).date) < day) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The headlines that report startup event `e`, oldest first: they are dated the event's day
 * (D543), so this reads only that day's headlines (D545).
 */
export function eventHeadlines(news: NewsView | undefined, e: EventRow): Headline[] {
  const f = news?.feed ?? [];
  const day = dayKey(e.date);
  const out: Headline[] = [];
  for (let i = firstSince(f, day); i < f.length; i++) {
    const h = f[i] as Headline;
    if (dayKey(h.date) !== day) break;
    if (h.event === e.id) out.push(h);
  }
  return out;
}

/** A headline by its id (D544): ids are post-order positions, so the feed is in id order. */
export function findHeadline(v: ViewsData, id: HeadlineId): [Headline, EventRow | undefined] | null {
  const h = byKey(v.news?.feed, (x) => x.id, id);
  return h ? [h, eventOf(h, v.births?.events ?? [])] : null;
}

/** A labelled group of links as a doc line ("Industry: Oil"); none when there are no links. */
export function linkLine(label: string, links: readonly (readonly [string, PageRef])[]): Block[] {
  if (links.length === 0) return [];
  return [{ k: "line", spans: [span.muted(`${label}:`), ...links.map(([t, p]) => span.link(t, p))] }];
}

/** A dated link line: "03 Jan 2020  Headline". */
export function datedLine(d: SimDate, text: string, page: PageRef): Block {
  return { k: "line", spans: [span.cell({ k: "date", v: d }), span.link(text, page)] };
}

export const HEADLINE_SECTIONS: readonly SectionSpec[] = [
  { id: "subjects", title: "Subjects" },
  { id: "related", title: "Related headlines" },
];

/** A headline's page as data: its text, byline, kind, its subjects and related headlines. */
export function headlineDoc(id: HeadlineId, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "headline", id };
  const doc = emptyDoc(page, index.title(page), kindName("headline"));
  const found = findHeadline(v, id);
  if (!found) {
    doc.head.push(
      { k: "line", spans: [span.muted("This headline is not in the feed (a page from another game?).")] },
      ...linkLine("Pages", [[index.title({ kind: "news" }), { kind: "news" }]]),
    );
    return doc;
  }
  const [h, event] = found;
  // The page's title is the headline itself (Rust draws it in the title font under the header).
  doc.title = h.text;
  doc.chips = [span.muted(date(h.date)), span.muted(BYLINE), span.muted(kindOf(h.kind)[0])];
  const t = (p: PageRef): [string, PageRef] => [index.title(p), p];
  const subjects: Block[] = [];
  if (h.industry !== null) subjects.push(...linkLine("Industry", [t({ kind: "industry", id: h.industry })]));
  if (h.company !== null) subjects.push(...linkLine("Company", [t({ kind: "company", id: h.company })]));
  const code = h.kind.kind === "IpoVote" || h.kind.kind === "Listing" ? h.kind.exchange : null;
  const exchange = code === null ? undefined : v.exchanges?.exchanges.find((x) => x.code === code);
  if (exchange) subjects.push(...linkLine("Exchange", [t({ kind: "exchange", id: exchange.zone })]));
  if (event) {
    subjects.push(
      ...linkLine("Startup event", [[eventName(event), { kind: "event", id: event.id }]]),
      ...linkLine(
        "Startups",
        event.startups.map((c) => t({ kind: "company", id: c })),
      ),
      ...linkLine(
        "Industries",
        event.industries.map((i) => t({ kind: "industry", id: i })),
      ),
    );
  }
  subjects.push(...linkLine("Feed", [t({ kind: "news" })]));
  const { company, industry } = h;
  const lines = headlineLinks(
    v,
    (o) =>
      o.id !== h.id &&
      ((company !== null && o.company === company) ||
        (company === null && industry !== null && o.industry === industry)),
    RELATED_HEADLINES,
  );
  const related: Block[] =
    lines.length === 0
      ? [{ k: "line", spans: [span.muted("No other headline on this subject yet.")] }]
      : lines.map(([d, text, p]) => datedLine(d, text, p));
  doc.sections = [
    { id: "subjects", blocks: subjects },
    { id: "related", blocks: related },
  ];
  return doc;
}

export const pages = [
  definePage({ kind: "news", views: ["news", "births", "industry_rows"], sections: [], Component: NewsPage }),
  definePage({
    kind: "headline",
    views: ["news", "births", "exchanges"],
    sections: HEADLINE_SECTIONS,
    doc: (page, v, index) => headlineDoc(page.id, v, index),
  }),
];
