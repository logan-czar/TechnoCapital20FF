// What the encyclopedia shows of the pages/ framework's pages (pivot 1.4, 5.11, 15.3; D1047). Those
// pages were built for an omniscient-ish watcher of a whole-world stock game; the browser is a
// public record of a game that is only the USA. This file wraps a built PageDoc and removes, without
// editing the page: what a non-omniscient player must not read (the board's skills and traits, a
// company's management score and archetype, the operating rows that name its internals, the units'
// plans and the tech tab), what is outside the USA (other countries' companies and exchanges, the
// zones' GDP, links to country, zone, province and map pages), and every link to a page this app
// does not draw (it becomes plain text).
//
// Pure: a doc in, a doc out, so it is tested on built docs. `leaks` in test/apps/browser documents
// what it could not close.

import type { Block, CardDoc, Field, PageDoc, SectionDoc, Span, TableDoc } from "../../pages/doc.ts";
import type { PageRef } from "../../pages/ref.ts";
import type { SectionSpec } from "../../pages/sections.ts";
import type { ViewsData } from "../../pages/views.ts";
import type { Cell } from "../../widgets/cells.ts";
import { routeOfPage } from "./route.ts";

/** Which companies and exchanges are in the USA, from the views. */
export interface Coverage {
  /** True for the countries in the USA; with no places view yet nothing is outside. */
  known: boolean;
  /** The company ids whose HQ is outside the USA. */
  foreignCompanies: ReadonlySet<number>;
  /** The exchanges (zone ids) that are not the USA's. */
  foreignExchanges: ReadonlySet<number>;
}

/** The USA's iso3 in places-view country rows. */
export const US_ISO3 = "USA";

export function coverageOf(v: ViewsData): Coverage {
  const us = v.places?.countries.find((c) => c.iso3 === US_ISO3);
  if (us === undefined) return { known: false, foreignCompanies: new Set(), foreignExchanges: new Set() };
  const usZone = v.countries?.countries.find((c) => c.id === us.id)?.zone;
  const foreignCompanies = new Set<number>();
  for (const r of v.company_rows?.rows ?? []) if (r.hq_country !== us.id) foreignCompanies.add(r.id);
  const foreignExchanges = new Set<number>();
  for (const x of v.exchanges?.exchanges ?? [])
    if (usZone !== undefined && x.zone !== usZone) foreignExchanges.add(x.zone);
  return { known: true, foreignCompanies, foreignExchanges };
}

/** True when `page` is somewhere this app does not draw or outside the USA. */
export function isOutside(page: PageRef, cov: Coverage): boolean {
  if (routeOfPage(page) === null) return true;
  if (page.kind === "company") return cov.foreignCompanies.has(page.id);
  if (page.kind === "exchange") return cov.foreignExchanges.has(page.id);
  return false;
}

/** Field labels no page shows (pivot 5.11: hidden stats; spec 6.1: the AI's archetype). */
export const HIDDEN_FIELD_LABELS: ReadonlySet<string> = new Set([
  "Management score",
  "Skills",
  "Traits",
  "Skill used",
  "Archetype",
  "Company id",
]);

/** Sections of a page kind that are internals of the simulation rather than public record. */
export const HIDDEN_SECTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  // Board: each member's skills and traits; Units: the locked growth and R&D plans, productivity;
  // Tech: labor split, stations, compute and data quests.
  company: new Set(["board", "units", "tech"]),
  // The financial zones are other countries' markets.
  "world-history": new Set(["zones"]),
};

/** Statement rows that name the company's internals (the operating block under the lines). */
export const HIDDEN_STATEMENT_ROWS: ReadonlySet<string> = new Set([
  "Productivity",
  "PC bonus",
  "Labor units",
  "Held TB",
  "Free R&D",
  "Management score",
]);

/** Columns dropped from list tables once every row is the USA's (or that name an unsupported page). */
const REDUNDANT_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  companies: ["HQ"],
  exchanges: ["Zone"],
};

const asText = (text: string): Span => ({ k: "text", text });

function spanOf(s: Span, cov: Coverage): Span {
  if (s.k === "link") return isOutside(s.page, cov) ? asText(s.text) : s;
  if (s.k === "cell" && s.cell.k === "link") return isOutside(s.cell.page, cov) ? asText(s.cell.text) : s;
  return s;
}

function cellOf(c: Cell, cov: Coverage): Cell {
  return c.k === "link" && isOutside(c.page, cov) ? { k: "text", v: c.text } : c;
}

function fieldsOf(fields: readonly Field[], cov: Coverage): Field[] {
  return fields
    .filter((f) => !HIDDEN_FIELD_LABELS.has(f.label))
    .map((f) => ({ label: f.label, value: f.value.map((s) => spanOf(s, cov)) }));
}

function cardOf(c: CardDoc, cov: Coverage): CardDoc {
  return { ...c, head: c.head.map((s) => spanOf(s, cov)), fields: fieldsOf(c.fields, cov) };
}

/** True when a row names a company or an exchange outside the USA (the row is dropped). */
function rowOutside(row: readonly Cell[], cov: Coverage): boolean {
  return row.some(
    (c) =>
      c.k === "link" && (c.page.kind === "company" || c.page.kind === "exchange") && isOutside(c.page, cov),
  );
}

function tableOf(t: TableDoc, cov: Coverage): TableDoc {
  let rows = t.rows;
  // A company or exchange row of another country goes; its other links become text.
  if (cov.known) rows = rows.filter((r) => !rowOutside(r, cov));
  if (t.id.startsWith("company.statements")) {
    rows = rows.filter((r) => {
      const first = r[0];
      return !(first?.k === "text" && HIDDEN_STATEMENT_ROWS.has(first.v));
    });
  }
  const dropped = REDUNDANT_COLUMNS[t.id] ?? [];
  const keep = t.columns.map((c, i) => [c, i] as const).filter(([c]) => !dropped.includes(c.title));
  const cut = keep.length !== t.columns.length;
  const out: TableDoc = {
    ...t,
    columns: keep.map(([c]) => c),
    rows: rows.map((r) =>
      (cut ? keep.map(([, i]) => r[i] ?? ({ k: "unknown" } as Cell)) : r).map((c) => cellOf(c, cov)),
    ),
  };
  if (t.sort !== undefined) {
    const at = keep.findIndex(([, i]) => i === t.sort?.column);
    if (at >= 0) out.sort = { column: at, ascending: t.sort.ascending };
    else delete out.sort;
  }
  return out;
}

function blockOf(b: Block, cov: Coverage): Block {
  switch (b.k) {
    case "fields":
      return { k: "fields", fields: fieldsOf(b.fields, cov) };
    case "line":
      return { k: "line", spans: b.spans.map((s) => spanOf(s, cov)) };
    case "table":
      return { k: "table", table: tableOf(b.table, cov) };
    case "cards":
      return { k: "cards", cards: b.cards.map((c) => cardOf(c, cov)) };
    default:
      return b;
  }
}

/** The sections a page kind still shows. */
export function visibleSections(kind: string, sections: readonly SectionSpec[]): SectionSpec[] {
  const hidden = HIDDEN_SECTIONS[kind];
  return sections.filter((s) => !hidden?.has(s.id));
}

/** `doc` without what the encyclopedia does not show (see the file's head). */
export function sanitizeDoc(doc: PageDoc, cov: Coverage): PageDoc {
  const hidden = HIDDEN_SECTIONS[doc.page.kind];
  const sections: SectionDoc[] = doc.sections
    .filter((s) => !hidden?.has(s.id))
    .map((s) => ({ id: s.id, blocks: s.blocks.map((b) => blockOf(b, cov)) }));
  return {
    ...doc,
    chips: doc.chips.map((s) => spanOf(s, cov)),
    head: doc.head.map((b) => blockOf(b, cov)),
    sections,
  };
}
