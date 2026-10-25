// Names and link targets for what the views name (crates/game/src/links/names.rs, D462, and the
// name index, crates/game/src/command/index.rs, D455, D464): every named thing the views know,
// with its page, so the command bar can search it and links, breadcrumbs and pane titles can name
// a page. Built from the views only (spec 9), so no page names a thing by its id.
//
// Sources (D464): the list pages, companies (name and ticker), industries, countries (name and
// iso3), financial zones, exchanges (name, code and index name), startup events, every full
// character (with a first role), provinces (name and CSV id), and the recap of each quarter so
// far. Partial characters have no page (3.7.1) and are not indexed.
//
// Not ported: NameIndex::append_born and the paced refresh (D771, D773): the TS index is rebuilt
// when one of its source views moves (`useNameIndex`), which in the browser is cheap enough.

import {
  type CompanyId,
  type CompanyRow,
  cmpQuarter,
  type EventRow,
  formatQuarter,
  formatSimDate,
  type ProvinceId,
  type Quarter,
  type Role,
  type SimViews,
  simDateQuarter,
  type ViewName,
} from "@tc20ff/sim";
import type { Span } from "../pages/doc.ts";
import { span } from "../pages/doc.ts";
import { kindIsList, kindName, type PageRef, pageId, quarterPrev, setProvinceKeys } from "../pages/ref.ts";
import { byId, usePageViews, type ViewsData } from "../pages/views.ts";

/** The first quarter of the game (spec 3.1). */
export const FIRST_QUARTER: Quarter = { year: 2020, q: 1 };

/** One named thing. */
export interface IndexEntry {
  page: PageRef;
  name: string;
  /** Other names that match: a ticker, an iso3, an exchange code, an index name. */
  aliases: string[];
  /** A short line shown beside the name in results. */
  detail: string;
  /** Left out of search (a removed company keeps its name for old links). */
  hidden: boolean;
}

/** The list pages (and settings) the command bar can open by name. */
export const LIST_PAGES: readonly PageRef[] = [
  { kind: "world" },
  { kind: "companies" },
  { kind: "industries" },
  { kind: "news" },
  { kind: "characters" },
  { kind: "countries" },
  { kind: "exchanges" },
  { kind: "zones" },
  { kind: "events" },
  { kind: "settings" },
];

/** The views the index reads. */
export const NAME_VIEWS = [
  "company_rows",
  "industry_rows",
  "countries",
  "zones",
  "exchanges",
  "births",
  "characters",
  "places",
  "clock",
] as const satisfies readonly ViewName[];

/** A board seat's title (spec 3.7). */
export function seatName(seat: Extract<Role, { kind: "Seat" }>["seat"]): string {
  return seat === "Chair" ? "Chair" : seat.toUpperCase();
}

/** What a role is called, and the company it is at. */
export function role(r: Role): [string, CompanyId] {
  switch (r.kind) {
    case "Seat":
      return [seatName(r.seat), r.company];
    case "Director":
      return ["Director", r.company];
    case "Controller":
      return ["Controls", r.company];
    case "OwnerOfRecord":
      return ["Owner of record", r.company];
    case "Founder":
      return [r.lead ? "Lead founder" : "Founder", r.company];
  }
}

/** A role as a line: "CEO of Arrowhead", "Controls Arrowhead". */
export function roleText(r: Role, company: string): string {
  const [label] = role(r);
  return r.kind === "Controller" ? `${label} ${company}` : `${label} of ${company}`;
}

/** The page a controller links to: a character's, a state's (its country) or a parent's. */
export function controllerPage(c: CompanyRow["controller"]): PageRef | null {
  switch (c.kind) {
    case "None":
      return null;
    case "Character":
      return { kind: "character", id: c.character };
    case "State":
      return { kind: "country", id: c.country };
    case "Company":
      return { kind: "company", id: c.company };
  }
}

/** A startup event's name with its date, so two random events of one type differ. */
export function eventName(e: EventRow): string {
  return `${e.name} (${formatSimDate(e.date)})`;
}

/** A province's place name ("Edmonton, Canada") and the page its link opens (M8.7, D707). */
export function place(v: ViewsData, province: ProvinceId): [string, PageRef] | null {
  const p = v.places?.provinces[province];
  if (!p) return null;
  const c = v.places?.countries[p.country];
  return [c ? `${p.name}, ${c.name}` : p.name, { kind: "province", id: province }];
}

/** A place as two links where a page has room (a header field): the province and its country. */
export function placeSpans(v: ViewsData, province: ProvinceId): Span[] | null {
  const p = v.places?.provinces[province];
  const c = p ? v.places?.countries[p.country] : undefined;
  if (!p || !c) return null;
  return [
    span.link(`${p.name},`, { kind: "province", id: province }),
    span.link(c.name, { kind: "country", id: p.country }),
  ];
}

/** Every named thing, by page. */
export class NameIndex {
  readonly entries: IndexEntry[];
  private readonly byPage = new Map<string, number>();
  private readonly byTicker = new Map<string, CompanyId>();

  constructor(entries: IndexEntry[]) {
    this.entries = entries;
    entries.forEach((e, i) => {
      this.byPage.set(pageId(e.page), i);
      if (e.page.kind === "company" && e.aliases[0]) this.byTicker.set(e.aliases[0].toUpperCase(), e.page.id);
    });
  }

  entry(page: PageRef): IndexEntry | undefined {
    const i = this.byPage.get(pageId(page));
    return i === undefined ? undefined : this.entries[i];
  }

  /** A page's name: the thing's name, or the kind's name and id when unknown. */
  title(page: PageRef): string {
    const e = this.entry(page);
    if (e) return e.name;
    switch (page.kind) {
      case "recap":
        return `Quarterly recap ${formatQuarter(page.quarter)}`;
      case "headline":
        return `Headline ${page.id}`;
      default:
        if (kindIsList(page.kind) || page.kind === "world" || page.kind === "settings")
          return kindName(page.kind);
        return `${kindName(page.kind)} ${"id" in page ? page.id : ""}`.trimEnd();
    }
  }

  /**
   * The current quarter's recap page (the index lists recaps newest first): pages link to it
   * without reading v_clock, which moves every tick.
   */
  latestRecap(): PageRef | null {
    return this.entries.find((e) => e.page.kind === "recap")?.page ?? null;
  }

  companyByTicker(ticker: string): CompanyId | undefined {
    return this.byTicker.get(ticker.toUpperCase());
  }
}

const entry = (page: PageRef, name: string, detail: string, ...aliases: string[]): IndexEntry => ({
  page,
  name,
  detail,
  aliases: aliases.filter((a) => a !== ""),
  hidden: false,
});

/** Builds the index from the views. Also installs the province keys for page keys (D828). */
export function buildNameIndex(v: ViewsData): NameIndex {
  const out: IndexEntry[] = LIST_PAGES.map((p) => entry(p, kindName(p.kind), "Page"));
  const industryName = (id: number) => byId(v.industry_rows?.rows, id)?.name ?? `Industry #${id}`;
  for (const r of v.company_rows?.rows ?? []) {
    const detail = `${industryName(r.industry)}, ${r.public && r.ticker !== "" ? "listed" : "private"}`;
    const e = entry({ kind: "company", id: r.id }, r.name, detail, r.ticker);
    if (r.status === "Removed") {
      e.hidden = true;
      e.detail += ", removed";
    }
    out.push(e);
  }
  for (const r of v.industry_rows?.rows ?? []) {
    out.push(entry({ kind: "industry", id: r.id }, r.name, `Industry, ${r.sector}`));
  }
  for (const c of v.countries?.countries ?? []) {
    out.push(
      entry({ kind: "country", id: c.id }, c.name, `Country, ${c.superregion}, ${c.zone_name}`, c.iso3),
    );
  }
  for (const z of v.zones?.zones ?? []) {
    out.push(
      entry(
        { kind: "zone", id: z.id },
        z.name,
        `Financial zone ${z.number}, exchange ${z.exchange_code}`,
        z.key,
      ),
    );
  }
  for (const x of v.exchanges?.exchanges ?? []) {
    out.push(
      entry(
        { kind: "exchange", id: x.zone },
        x.name,
        `Exchange ${x.code}, ${x.hub_city}`,
        x.code,
        x.index_name,
      ),
    );
  }
  for (const e of v.births?.events ?? []) {
    out.push(
      entry(
        { kind: "event", id: e.id },
        eventName(e),
        `Startup event, ${e.startups.length} startups`,
        e.kind.kind === "Fixed" ? e.kind.id : "",
      ),
    );
  }
  // Every full character, described by its first role, else its tier.
  const companyName = (id: number) => byId(v.company_rows?.rows, id)?.name ?? "?";
  for (const c of v.characters?.full ?? []) {
    if (c.id.kind !== "Full") continue;
    const first = c.roles[0];
    const detail = first
      ? roleText(first, companyName(role(first)[1]))
      : c.tier === ""
        ? "Character"
        : `Character, ${c.tier}`;
    out.push(entry({ kind: "character", id: c.id.id }, c.name, detail));
  }
  // Provinces (M8.7, D707): searchable by name and id, "Province, Country" as detail.
  const places = v.places;
  if (places) {
    setProvinceKeys(places.provinces.map((p) => p.key));
    for (const p of places.provinces) {
      out.push(entry({ kind: "province", id: p.id }, p.name, places.countries[p.country]?.name ?? "", p.key));
    }
  }
  // A recap for every quarter so far, newest first.
  if (v.clock) {
    for (let q = simDateQuarter(v.clock.date); cmpQuarter(q, FIRST_QUARTER) >= 0; q = quarterPrev(q)) {
      out.push(entry({ kind: "recap", quarter: q }, `Quarterly recap ${formatQuarter(q)}`, "Recap"));
    }
  }
  return new NameIndex(out);
}

/** The index from a sim's views (tests). */
export function nameIndexOf(views: SimViews): NameIndex {
  const data: Record<string, unknown> = {};
  for (const n of NAME_VIEWS) data[n] = views[n].data;
  return buildNameIndex(data as ViewsData);
}

/**
 * The index of the views as they are, rebuilt when a source view moves. The clock moves every
 * tick, so it counts only by its quarter (for the recaps); the zones and exchanges move daily but
 * the index reads only their names, so they count by their lengths (Rust D771 kept a hash of the
 * names for the same reason).
 */
export function useNameIndex(): NameIndex {
  const v = usePageViews(NAME_VIEWS);
  const q = v.clock ? simDateQuarter(v.clock.date) : null;
  const deps: unknown[] = [
    v.company_rows,
    v.industry_rows,
    v.countries,
    v.zones?.zones.length,
    v.exchanges?.exchanges.length,
    v.births,
    v.characters,
    v.places,
    q ? `${q.year}-${q.q}` : null,
  ];
  // One index is shared by every reader (the module holds it), so a page full of links builds it
  // once per change of its sources, not once per link.
  const h = held;
  if (h?.deps.every((d, i) => d === deps[i])) return h.index;
  const index = buildNameIndex(v);
  held = { deps, index };
  return index;
}

let held: { deps: unknown[]; index: NameIndex } | null = null;
