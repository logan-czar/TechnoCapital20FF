// Startup event pages and the event list (crates/game/src/pages/events.rs, M9.7; spec 8 Startups
// and listings, 9.2 `list_startup_events`; 5.19): what fired, when, the industries it touched and
// the startups it made, each a link, with each startup's founding size (a band while it does not
// publish, D420) and the headlines that reported it.

import type { BirthRow, EventKind, StartupEventId } from "@tc20ff/sim";
import { eventName, type NameIndex, place } from "../../links/names.ts";
import { type Cell, date, figureCell } from "../../widgets/cells.ts";
import { type Block, emptyDoc, field, type PageDoc, span, type TableDoc } from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import { linkCell, statusText } from "../tables.ts";
import { byId, byKey, type ViewsData } from "../views.ts";
import { datedLine, eventHeadlines, linkLine } from "./news.tsx";

export const SECTIONS: readonly SectionSpec[] = [
  { id: "startups", title: "Startups it made" },
  { id: "news", title: "Headlines" },
];

/** A random event type's name (births/random.rs EventType::name, 5.19.1). */
const EVENT_TYPE_NAMES = {
  GarageFounder: "Garage founder",
  SpinOutTeam: "Spin-out team",
  HotCluster: "Hot cluster",
  BackedVenture: "Backed venture",
} as const;

/** "Fixed (The crypto and SPAC mania)" or "Random (Garage founder)" (5.19.1, 5.19.2). */
export function kindText(k: EventKind, name: string): string {
  return k.kind === "Fixed" ? `Fixed (${name})` : `Random (${EVENT_TYPE_NAMES[k.event_type]})`;
}

const note = (text: string): Block => ({ k: "line", spans: [span.muted(text)] });
const dash: Cell = { k: "text", v: "-" };

/** The startups an event made: name, industry, HQ, founding date and size, listing, status. */
export function startupsTable(v: ViewsData, index: NameIndex, id: StartupEventId): TableDoc | null {
  const births = v.births;
  const e = byKey(births?.events, (x) => x.id, id);
  if (!e) return null;
  // The births by company (they are in birth order, not id order).
  const bornBy = new Map<number, BirthRow>();
  for (const b of births?.births ?? []) if (b.event === id) bornBy.set(b.id, b);
  const rows = e.startups.map((c): Cell[] => {
    const b = bornBy.get(c);
    const row = byId(v.company_rows?.rows, c);
    const hq = b ? place(v, b.hq) : null;
    const listed = row?.listing.kind === "InPlay" ? row.listing.date : null;
    return [
      linkCell(index, { kind: "company", id: c }),
      b ? linkCell(index, { kind: "industry", id: b.industry }) : dash,
      hq ? { k: "link", text: hq[0], page: hq[1] } : dash,
      b ? { k: "date", v: b.date } : { k: "unknown" },
      b ? figureCell(b.size_usd, "money") : { k: "unknown" },
      !row
        ? { k: "text", v: "removed" }
        : listed
          ? { k: "date", v: listed }
          : { k: "text", v: row.public ? "listed" : "private" },
      row ? { k: "text", v: statusText(row.status) } : dash,
    ];
  });
  return {
    id: "event.startups",
    columns: [
      { title: "Startup", width: 220 },
      { title: "Industry", width: 170 },
      { title: "HQ", width: 200 },
      { title: "Founded", width: 96 },
      {
        title: "Size",
        width: 130,
        hint: "Revenue it was sized for, a year (5.19.3); a band while not published",
      },
      { title: "Listed", width: 96, hint: "Its listing date, once listed (5.20.1)" },
      { title: "Status", width: 80 },
    ],
    rows,
  };
}

/** An event's page as data. */
export function eventDoc(id: StartupEventId, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "event", id };
  const doc = emptyDoc(page, index.title(page), kindName("event"));
  const t = (p: PageRef): [string, PageRef] => [index.title(p), p];
  const e = byKey(v.births?.events, (x) => x.id, id);
  if (!e) {
    doc.head.push(
      note("This startup event has not fired (events fire at plan locks, 5.19)."),
      ...linkLine("Pages", [t({ kind: "events" })]),
    );
    return doc;
  }
  doc.head.push(
    {
      k: "fields",
      fields: [
        field.text("Fired", date(e.date)),
        field.text("Kind", kindText(e.kind, e.name)),
        field.new("Startups", [span.colored(String(e.startups.length), "cyan")]),
      ],
    },
    ...linkLine(
      "Industries",
      e.industries.map((i) => t({ kind: "industry", id: i })),
    ),
    ...linkLine(
      "Startups",
      e.startups.map((c) => t({ kind: "company", id: c })),
    ),
    ...linkLine("Pages", [t({ kind: "events" }), t({ kind: "news" })]),
  );
  const startups = startupsTable(v, index, id);
  // By the event's id, among its day's headlines only (D543, D545).
  const heads = eventHeadlines(v.news, e);
  doc.sections = [
    { id: "startups", blocks: startups ? [{ k: "table", table: startups }] : [] },
    {
      id: "news",
      blocks:
        heads.length === 0
          ? [note("No headline reported this event.")]
          : heads.map((h) => datedLine(h.date, h.text, { kind: "headline", id: h.id })),
    },
  ];
  return doc;
}

/** Every event that fired, newest first (spec 9.2 `list_startup_events`). */
export function eventsTable(v: ViewsData, index: NameIndex): TableDoc {
  const rows = [...(v.births?.events ?? [])].reverse().map((e): Cell[] => {
    const ind = e.industries[0];
    const co = e.startups[0];
    return [
      { k: "link", text: eventName(e), page: { kind: "event", id: e.id } },
      { k: "date", v: e.date },
      { k: "text", v: kindText(e.kind, e.name) },
      ind === undefined ? dash : linkCell(index, { kind: "industry", id: ind }),
      { k: "int", v: e.industries.length },
      { k: "int", v: e.startups.length },
      co === undefined ? dash : linkCell(index, { kind: "company", id: co }),
    ];
  });
  return {
    id: "events",
    columns: [
      { title: "Event", width: 260 },
      { title: "Date", width: 96 },
      { title: "Kind", width: 200 },
      { title: "First industry", width: 170 },
      { title: "Industries", width: 76 },
      { title: "Startups", width: 70 },
      { title: "First startup", width: 200 },
    ],
    rows,
  };
}

/** The event list as data. */
export function eventsDoc(v: ViewsData, index: NameIndex): PageDoc {
  const b = v.births;
  const events = b?.events.length ?? 0;
  const doc = emptyDoc(
    { kind: "events" },
    kindName("events"),
    `${events} events, ${b?.births.length ?? 0} startups`,
  );
  const started = (v.company_rows?.rows ?? []).filter((r) => r.origin.kind === "Born").length;
  doc.head.push({
    k: "fields",
    fields: [
      field.cell("Born in play, still in the game", { k: "int", v: started }),
      field.cell("Listed in play", { k: "int", v: b?.listings.length ?? 0 }),
    ],
  });
  if (events === 0) doc.head.push(note("No startup event yet: events fire at plan locks (5.19)."));
  doc.head.push({ k: "table", table: eventsTable(v, index) });
  return doc;
}

export const pages = [
  definePage({
    kind: "event",
    views: ["births", "company_rows", "news", "places"],
    sections: SECTIONS,
    doc: (page, v, index) => eventDoc(page.id, v, index),
  }),
  definePage({
    kind: "events",
    views: ["births", "company_rows"],
    sections: [],
    doc: (_page, v, index) => eventsDoc(v, index),
  }),
];
