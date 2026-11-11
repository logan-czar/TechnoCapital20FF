// What the encyclopedia takes out of the pages/ framework's pages (pivot 1.4, 5.11, 15.3; D1047):
// the hidden stats and internals of a company, the other countries' companies and exchanges, and
// every link to a page the browser does not draw. Built from the mock's views through the real
// registered page builders, so a change to a page that adds a leak shows here.

import { simNew } from "@tc20ff/sim";
import { loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { frameworkDoc, viewsOfPage } from "../../../src/apps/browser/FrameworkPage.tsx";
import { FRAMEWORK_KINDS, routeOfPage } from "../../../src/apps/browser/route.ts";
import {
  coverageOf,
  HIDDEN_FIELD_LABELS,
  HIDDEN_SECTIONS,
  HIDDEN_STATEMENT_ROWS,
  isOutside,
  sanitizeDoc,
  visibleSections,
} from "../../../src/apps/browser/sanitize.ts";
import { buildNameIndex } from "../../../src/links/names.ts";
import { docFields, docLinks, docTexts, type PageDoc } from "../../../src/pages/doc.ts";
import type { PageRef } from "../../../src/pages/ref.ts";
import { pageSpecOf } from "../../../src/pages/registry.ts";
import { type ViewsData, viewsData } from "../../../src/pages/views.ts";
import { worldMini } from "../../world-mini.ts";

/** Ticks to the end of the first plan lock (9 January 2020 00:00 is tick 192). */
const AFTER_FIRST_LOCK = 200;

// The pre-pivot pages read the real sim's views (the mock has no company detail): the frozen mini world.
const views: ViewsData = (() => {
  const loaded = loadWorld(worldMini().dir);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  const made = simNew(loaded.value, 42);
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  for (let i = 0; i < AFTER_FIRST_LOCK; i++) made.value.step();
  return viewsData(made.value.views());
})();
const index = buildNameIndex(views);
const cov = coverageOf(views);
const us = views.places?.countries.find((c) => c.iso3 === "USA");

const rawDoc = (page: PageRef): PageDoc => {
  const spec = pageSpecOf(page.kind);
  if (!spec?.doc) throw new Error(`no doc for ${page.kind}`);
  return spec.doc(page, views, index);
};
const cleanDoc = (page: PageRef): PageDoc => {
  const spec = pageSpecOf(page.kind);
  if (!spec) throw new Error(`no page ${page.kind}`);
  const d = frameworkDoc(spec, page, views, index, cov);
  if (d === null) throw new Error(`outside: ${page.kind}`);
  return d;
};

const usCompany = (views.company_rows?.rows ?? []).find((r) => r.hq_country === us?.id && r.public);
const foreignCompany = (views.company_rows?.rows ?? []).find((r) => r.hq_country !== us?.id);

describe("the coverage", () => {
  it("knows which companies and exchanges are outside the USA", () => {
    expect(us).toBeDefined();
    expect(cov.known).toBe(true);
    expect(usCompany).toBeDefined();
    expect(foreignCompany).toBeDefined();
    expect(cov.foreignCompanies.has((foreignCompany as NonNullable<typeof foreignCompany>).id)).toBe(true);
    expect(cov.foreignCompanies.has((usCompany as NonNullable<typeof usCompany>).id)).toBe(false);
    expect(cov.foreignExchanges.size).toBeGreaterThan(0);
  });

  it("puts a foreign company, a foreign exchange and an undrawn page outside, and the USA's inside", () => {
    expect(
      isOutside(
        { kind: "company", id: (foreignCompany as NonNullable<typeof foreignCompany>).id } as PageRef,
        cov,
      ),
    ).toBe(true);
    expect(
      isOutside({ kind: "company", id: (usCompany as NonNullable<typeof usCompany>).id } as PageRef, cov),
    ).toBe(false);
    const [fx] = [...cov.foreignExchanges];
    expect(isOutside({ kind: "exchange", id: fx as number } as PageRef, cov)).toBe(true);
    for (const kind of ["country", "zone", "province", "world", "politics"] as const)
      expect(isOutside({ kind, id: 1 } as unknown as PageRef, cov), kind).toBe(true);
    expect(isOutside({ kind: "industries" }, cov)).toBe(false);
  });

  it("does not claim anything is foreign before the places view has arrived", () => {
    const c = coverageOf({});
    expect(c.known).toBe(false);
    expect(c.foreignCompanies.size).toBe(0);
  });
});

describe("a company's page", () => {
  const page = { kind: "company", id: (usCompany as NonNullable<typeof usCompany>).id } as PageRef;

  it("has the hidden fields before the wrapper (so the wrapper is needed) and none after", () => {
    const raw = docFields(rawDoc(page)).map((f) => f.label);
    expect(raw).toContain("Management score");
    const clean = docFields(cleanDoc(page)).map((f) => f.label);
    for (const label of HIDDEN_FIELD_LABELS) expect(clean, label).not.toContain(label);
    expect(clean).toContain("Ticker");
    expect(clean).toContain("Industry");
  });

  it("drops the board, units and tech sections and keeps the public ones", () => {
    const doc = cleanDoc(page);
    const ids = doc.sections.map((s) => s.id);
    for (const hidden of HIDDEN_SECTIONS.company ?? []) expect(ids).not.toContain(hidden);
    expect(ids).toEqual(expect.arrayContaining(["overview", "chart", "cap_table", "financials"]));
    const spec = pageSpecOf("company");
    expect(visibleSections("company", spec?.sections ?? []).map((s) => s.id)).toEqual([
      "overview",
      "chart",
      "cap_table",
      "financials",
    ]);
  });

  it("shows no skill, trait, management score, archetype or operating internals in any text", () => {
    const texts = docTexts(cleanDoc(page), views).join("\n");
    for (const word of [
      "Management score",
      "Skills",
      "Traits",
      "Skill used",
      "Archetype",
      "Productivity",
      "PC bonus",
      "Labor units",
      "Held TB",
      "Free R&D",
      "Tech",
      "Data quests",
    ]) {
      expect(texts, word).not.toContain(word);
    }
    for (const row of HIDDEN_STATEMENT_ROWS) expect(texts.split("\n"), row).not.toContain(row);
  });

  it("links only to pages the browser draws, and to no foreign company or exchange", () => {
    for (const l of docLinks(cleanDoc(page))) {
      expect(routeOfPage(l), l.kind).not.toBeNull();
      expect(isOutside(l, cov)).toBe(false);
    }
  });
});

describe("the list and index pages", () => {
  it("the companies list has no foreign company and no HQ column", () => {
    const raw = rawDoc({ kind: "companies" });
    const clean = cleanDoc({ kind: "companies" });
    const t = (d: PageDoc) => d.head.flatMap((b) => (b.k === "table" ? [b.table] : []))[0];
    const rawRows = t(raw)?.rows.length ?? 0;
    const cleanRows = t(clean)?.rows.length ?? 0;
    expect(cleanRows).toBeGreaterThan(0);
    expect(cleanRows).toBeLessThan(rawRows);
    expect(t(clean)?.columns.map((c) => c.title)).not.toContain("HQ");
    for (const l of docLinks(clean))
      if (l.kind === "company") expect(cov.foreignCompanies.has(l.id)).toBe(false);
    // Every USA company of the raw list is still there (the wrapper only removes the others).
    const usListed = (views.company_rows?.rows ?? []).filter(
      (r) => r.hq_country === us?.id && r.status !== "Removed",
    ).length;
    expect(cleanRows).toBe(usListed);
  });

  it("the exchanges list has only the USA's exchanges", () => {
    const clean = cleanDoc({ kind: "exchanges" });
    for (const l of docLinks(clean))
      if (l.kind === "exchange") expect(cov.foreignExchanges.has(l.id)).toBe(false);
    const rows = clean.head.flatMap((b) => (b.k === "table" ? b.table.rows.length : 0));
    expect(rows[0]).toBe((views.exchanges?.exchanges.length ?? 0) - cov.foreignExchanges.size);
  });

  it("every framework kind the browser draws builds, and links only to what it draws", () => {
    const pages: PageRef[] = [
      { kind: "company", id: (usCompany as NonNullable<typeof usCompany>).id } as PageRef,
      { kind: "industry", id: views.industry_rows?.rows[0]?.id ?? 0 } as PageRef,
      {
        kind: "exchange",
        id: views.exchanges?.exchanges.find((x) => !cov.foreignExchanges.has(x.zone))?.zone ?? 0,
      } as PageRef,
      { kind: "companies" },
      { kind: "industries" },
      { kind: "exchanges" },
      { kind: "world-history" },
      { kind: "recap", quarter: { year: 2020, q: 3 } },
    ];
    expect(new Set(pages.map((p) => p.kind))).toEqual(new Set(FRAMEWORK_KINDS));
    for (const page of pages) {
      const spec = pageSpecOf(page.kind);
      expect(spec, page.kind).toBeDefined();
      // The wrapper reads views the page does not name, for the USA check.
      expect(viewsOfPage(spec as NonNullable<typeof spec>)).toEqual(
        expect.arrayContaining(["places", "countries", "company_rows", "exchanges"]),
      );
      const doc = cleanDoc(page);
      for (const l of docLinks(doc)) expect(routeOfPage(l), `${page.kind} -> ${l.kind}`).not.toBeNull();
      // The wrapper never changes a doc's identity.
      expect(sanitizeDoc(rawDoc(page), cov).page).toEqual(page);
    }
  });

  it("the world history shows no financial zones", () => {
    const doc = cleanDoc({ kind: "world-history" });
    expect(doc.sections.map((s) => s.id)).not.toContain("zones");
  });
});
