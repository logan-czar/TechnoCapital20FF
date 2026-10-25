// The typed page reference (crates/game/src/pages/mod.rs, M9 A2; D451): every info screen is a
// page, named by a PageRef. Its text form (`pageKey`) is what a saved layout and a pane's history
// store, so a layout reads like "company/12" or "recap/2020-Q1".
//
// Ported from mod.rs: PageRef, PageKind and its key, name, tag and is_list, PageRef::key and
// ::from_key, the province keys (D828), PdbFunction and its parse. The page registry, specs and
// builders are in registry.ts; the section config in sections.ts.

import {
  type CharacterId,
  type CompanyId,
  type CountryId,
  cmpQuarter,
  cmpStr,
  type HeadlineId,
  type IndustryId,
  type ProvinceId,
  type Quarter,
  type StartupEventId,
  type ZoneId,
} from "@tc20ff/sim";

/** A page of the workspace: an entity page or a list page (D451). */
export type PageRef =
  /** The map's place (M8) and the workspace's home. */
  | { kind: "world" }
  | { kind: "company"; id: CompanyId }
  | { kind: "industry"; id: IndustryId }
  | { kind: "character"; id: CharacterId }
  | { kind: "country"; id: CountryId }
  /** A province (spec 3.3; M8.7). */
  | { kind: "province"; id: ProvinceId }
  /** A financial zone (spec 3.2.1). */
  | { kind: "zone"; id: ZoneId }
  /** A zone's exchange: one exchange per zone (spec 5.14), so it is keyed by the zone. */
  | { kind: "exchange"; id: ZoneId }
  /** A startup event that fired (5.19). */
  | { kind: "event"; id: StartupEventId }
  /** The quarterly recap of a quarter (M9.5). */
  | { kind: "recap"; quarter: Quarter }
  /** A headline, by its stable id (its place in the wire's post order; D544). */
  | { kind: "headline"; id: HeadlineId }
  | { kind: "companies" }
  | { kind: "industries" }
  | { kind: "news" }
  | { kind: "characters" }
  | { kind: "countries" }
  | { kind: "exchanges" }
  | { kind: "zones" }
  | { kind: "events" }
  /** Density, font size, saved layouts and the keyboard shortcuts. */
  | { kind: "settings" };

/** A page's kind: the PageRef variant without its id, the key of the page registry. */
export type PageKind = PageRef["kind"];

/** The pages of one kind. */
export type PageOf<K extends PageKind> = Extract<PageRef, { kind: K }>;

interface KindInfo {
  /** The kind's name on screen. */
  name: string;
  /** A short ASCII tag for the command bar and breadcrumbs (D302: no icon font). */
  tag: string;
  list: boolean;
}

/** Every kind in Rust `PageKind::ALL` order (the command bar's kind order). */
export const PAGE_KINDS = [
  "world",
  "company",
  "industry",
  "character",
  "country",
  "province",
  "zone",
  "exchange",
  "event",
  "recap",
  "headline",
  "companies",
  "industries",
  "news",
  "characters",
  "countries",
  "exchanges",
  "zones",
  "events",
  "settings",
] as const satisfies readonly PageKind[];

const KINDS: Readonly<Record<PageKind, KindInfo>> = {
  world: { name: "World", tag: "MAP", list: false },
  company: { name: "Company", tag: "CO", list: false },
  industry: { name: "Industry", tag: "IND", list: false },
  character: { name: "Character", tag: "CHR", list: false },
  country: { name: "Country", tag: "CTY", list: false },
  province: { name: "Province", tag: "PRV", list: false },
  zone: { name: "Financial zone", tag: "ZON", list: false },
  exchange: { name: "Exchange", tag: "EXC", list: false },
  event: { name: "Startup event", tag: "EVT", list: false },
  recap: { name: "Quarterly recap", tag: "RCP", list: false },
  headline: { name: "Headline", tag: "NEWS", list: false },
  companies: { name: "Companies", tag: "CO", list: true },
  industries: { name: "Industries", tag: "IND", list: true },
  news: { name: "News feed", tag: "NEWS", list: true },
  characters: { name: "Characters", tag: "CHR", list: true },
  countries: { name: "Countries", tag: "CTY", list: true },
  exchanges: { name: "Exchanges", tag: "EXC", list: true },
  zones: { name: "Financial zones", tag: "ZON", list: true },
  events: { name: "Startup events", tag: "EVT", list: true },
  settings: { name: "Settings", tag: "SET", list: false },
};

export function kindName(k: PageKind): string {
  return KINDS[k].name;
}

export function kindTag(k: PageKind): string {
  return KINDS[k].tag;
}

export function kindIsList(k: PageKind): boolean {
  return KINDS[k].list;
}

/** The kinds with no id: the World page, the list pages and Settings. */
export type BareKind = Exclude<PageRef, { id: unknown } | { quarter: unknown }>["kind"];

/** The page of a kind with no id ("companies", "world"). */
export function bare(kind: BareKind): PageRef {
  return { kind } as PageRef;
}

/**
 * The province ids (CSV keys) in ordinal order, set once the game has its places view (D828). A
 * province page's key is then `province/US-0053`, so a saved layout keeps naming the same province
 * when the province files change; an ordinal key no longer names a page and its pane opens the
 * World page (D452).
 */
let provinceKeys: readonly string[] | null = null;

/** Installs the province keys, in ordinal order (ascending CSV id, D4). */
export function setProvinceKeys(keys: readonly string[] | null): void {
  provinceKeys = keys;
}

/** A province page's id text: its CSV key when the keys are known, else its ordinal. */
export function provinceKey(id: number, keys: readonly string[] | null = provinceKeys): string {
  return keys?.[id] ?? String(id);
}

/** The province an id text names: a known CSV key when the keys are known, else an ordinal. */
export function parseProvince(s: string, keys: readonly string[] | null = provinceKeys): ProvinceId | null {
  if (keys) {
    // Binary search in byte order (the keys are sorted by cmpStr, D4).
    let lo = 0;
    let hi = keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const c = cmpStr(keys[mid] as string, s);
      if (c === 0) return mid as ProvinceId;
      if (c < 0) lo = mid + 1;
      else hi = mid;
    }
    return null;
  }
  const n = parseU32(s);
  return n === null ? null : (n as ProvinceId);
}

/** Rust `str::parse::<u32>`: digits only (a leading + allowed), in range. */
function parseU32(s: string | undefined): number | null {
  if (s === undefined || !/^\+?\d+$/.test(s)) return null;
  const n = Number(s);
  return n <= 0xffff_ffff ? n : null;
}

/** The text form: `kind` for a list page, `kind/id` for an entity, `recap/2020-Q1`. */
export function pageKey(p: PageRef): string {
  switch (p.kind) {
    case "province":
      return `province/${provinceKey(p.id)}`;
    case "recap":
      return `recap/${p.quarter.year}-Q${p.quarter.q}`;
    default:
      return "id" in p ? `${p.kind}/${p.id}` : p.kind;
  }
}

const isKind = (s: string): s is PageKind => (PAGE_KINDS as readonly string[]).includes(s);

/** Parses `pageKey`'s form; null for anything else. */
export function pageFromKey(text: string): PageRef | null {
  const parts = text.trim().split("/");
  const [k, id, extra] = parts;
  if (k === undefined || !isKind(k) || extra !== undefined) return null;
  const num = parseU32(id);
  switch (k) {
    case "company":
    case "industry":
    case "character":
    case "country":
    case "zone":
    case "exchange":
    case "event":
    case "headline":
      return num === null ? null : ({ kind: k, id: num } as PageRef);
    case "province": {
      if (id === undefined) return null;
      const p = parseProvince(id);
      return p === null ? null : { kind: "province", id: p };
    }
    case "recap": {
      const m = id === undefined ? null : /^(-?\d+)-Q(\d+)$/.exec(id);
      if (!m) return null;
      const q = Number(m[2]);
      if (q < 1 || q > 4) return null;
      return { kind: "recap", quarter: { year: Number(m[1]), q } };
    }
    default:
      return id === undefined ? ({ kind: k } as PageRef) : null;
  }
}

/**
 * A page's identity as a string, for maps and React keys: `pageKey` but with a province's
 * ordinal, so it does not depend on the province keys being installed.
 */
export function pageId(p: PageRef): string {
  if (p.kind === "recap") return `recap/${p.quarter.year}-Q${p.quarter.q}`;
  return "id" in p ? `${p.kind}/${p.id}` : p.kind;
}

/** Rust `==` on PageRef. */
export function pageEq(a: PageRef, b: PageRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "recap" && b.kind === "recap") return cmpQuarter(a.quarter, b.quarter) === 0;
  return ("id" in a ? a.id : -1) === ("id" in b ? b.id : -1);
}

/** The quarter before. */
export function quarterPrev(q: Quarter): Quarter {
  return q.q === 1 ? { year: q.year - 1, q: 4 } : { year: q.year, q: q.q - 1 };
}

/** The quarter after. */
export function quarterNext(q: Quarter): Quarter {
  return q.q === 4 ? { year: q.year + 1, q: 1 } : { year: q.year, q: q.q + 1 };
}

/** Pdoomberg's function pages (spec 8, 20.5.2). F1 and F8 are not in the MVP. */
export const PDB_FUNCTIONS = ["F2", "F3", "F4", "F5", "F6", "F7", "F9", "F10"] as const;
export type PdbFunction = (typeof PDB_FUNCTIONS)[number];

export const PDB_FUNCTION_NAME: Readonly<Record<PdbFunction, string>> = {
  F2: "Quotes",
  F3: "Chart",
  F4: "Order",
  F5: "Filings",
  F6: "Ratings",
  F7: "Bonds",
  F9: "Industries",
  F10: "Screener",
};

/** Parses "F3", "f10" (and the 20.5.2 mnemonic "SCRN" for F10). */
export function parsePdbFunction(s: string): PdbFunction | null {
  const u = s.trim().toUpperCase();
  if (u === "SCRN") return "F10";
  return (PDB_FUNCTIONS as readonly string[]).includes(u) ? (u as PdbFunction) : null;
}
