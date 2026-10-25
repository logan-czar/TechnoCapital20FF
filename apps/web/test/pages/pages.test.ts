// The World, Country and Settings pages and the name index, read as data (PageDoc, D480) from the
// views of a real game: the parts of crates/game/tests/b1_pages.rs and workspace.rs that cover
// these pages (every_entity_page_builds, pages_link_their_names and the band checks of
// a_private_company_page_shows_bands_and_never_the_truth, for the Country page; every_page_kind_
// builds' titles), plus the page registry and the 100 ms open budget (ts-migration-plan Step 5).
// The DOM half (opening pages in a pane, clicking links and section buttons) is pages-dom.test.tsx.

import { type Sim, simNew, type ViewName } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { buildNameIndex, LIST_PAGES, type NameIndex } from "../../src/links/names.ts";
import { docLinks, docTable, docTexts, type PageDoc } from "../../src/pages/doc.ts";
import { countryDoc } from "../../src/pages/kinds/country.tsx";
import { worldDoc } from "../../src/pages/kinds/world.tsx";
import { PAGE_BUDGET_MS } from "../../src/pages/PagePane.tsx";
import { PAGE_KINDS, type PageRef, pageEq, pageId, setProvinceKeys } from "../../src/pages/ref.ts";
import { pageSpecOf, registeredKinds } from "../../src/pages/registry.ts";
import { type ViewsData, viewsData } from "../../src/pages/views.ts";
import { display } from "../../src/widgets/cells.ts";

/** Ticks to the end of the first plan lock (9 January 2020 00:00 is tick 192, b1_pages.rs). */
const AFTER_FIRST_LOCK = 200;
const SEED = 42;

let data: WorldData;
let fresh: ViewsData;
let after: ViewsData;

function newSim(debug = false): Sim {
  const made = simNew(data, SEED, { debug });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  return made.value;
}

beforeAll(() => {
  const loaded = loadWorld(defaultDataDir());
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  data = loaded.value;
  fresh = viewsData(newSim().views());
  const sim = newSim();
  for (let i = 0; i < AFTER_FIRST_LOCK; i++) sim.step();
  after = viewsData(sim.views());
  return () => setProvinceKeys(null);
});

const has = (links: PageRef[], p: PageRef) => links.some((l) => pageEq(l, p));
const texts = (d: PageDoc, v: ViewsData) => docTexts(d, v).join(" | ");

describe("the Country page", () => {
  it("builds for every country, fresh and past the first lock (every_entity_page_builds)", () => {
    for (const v of [fresh, after]) {
      const index = buildNameIndex(v);
      for (const c of v.countries?.countries ?? []) {
        const d = countryDoc(c.id, v, index);
        expect(d.title).toBe(c.name);
        expect(d.sections.map((s) => s.id)).toEqual(["economy", "companies", "provinces"]);
        expect(docTable(d, "country.companies")?.rows.length, c.name).toBe(c.hq_companies.length);
        const provinces = (v.province_cards?.cards ?? []).filter((p) => p.country === c.id).length;
        expect(docTable(d, "country.provinces")?.rows.length, c.name).toBe(provinces);
        expect(texts(d, v)).not.toContain("No such");
      }
      expect(v.countries?.countries.length).toBeGreaterThan(100);
    }
  });

  it("links its zone, exchange, companies and provinces (pages_link_their_names)", () => {
    const index = buildNameIndex(after);
    for (const c of after.countries?.countries ?? []) {
      const links = docLinks(countryDoc(c.id, after, index));
      expect(has(links, { kind: "zone", id: c.zone })).toBe(true);
      expect(has(links, { kind: "exchange", id: c.zone })).toBe(true);
      for (const co of c.hq_companies) expect(has(links, { kind: "company", id: co })).toBe(true);
    }
  });

  it("shows the spec 3.2 fields: iso3, superregion, rating, spread, tax, GDP", () => {
    const index = buildNameIndex(fresh);
    const c = fresh.countries?.countries.find((x) => x.hq_companies.length > 3);
    if (!c) throw new Error("a country with HQs");
    const d = countryDoc(c.id, fresh, index);
    const t = texts(d, fresh);
    for (const label of [
      "ISO3",
      "Superregion",
      "Zone",
      "Exchange",
      "Sovereign rating",
      "Sovereign spread",
      "Tax rate",
      "GDP",
      "HQ'd companies",
    ]) {
      expect(t, label).toContain(label);
    }
    expect(t).toContain(c.iso3);
    expect(t).toMatch(/\d+ bps \| over the base rate \d+ bps/);
  });

  it("an unknown country is a page that says so, not a crash", () => {
    const index = buildNameIndex(fresh);
    const d = countryDoc(99_999 as never, fresh, index);
    expect(d.title).toBe("Country 99999");
    expect(texts(d, fresh)).toContain("No such country in the views.");
    expect(d.sections).toEqual([]);
  });

  it("shows a private company's figures as bands, holding the truth strictly inside, never printed (D420, D461)", () => {
    // The truth from an Omniscient twin of the same seed (D961: a debug Sim).
    const twin = newSim(true);
    const r = twin.apply({ kind: "SetOmniscient", on: true });
    expect(r.ok).toBe(true);
    const truth = viewsData(twin.views());
    const index = buildNameIndex(fresh);
    let checked = 0;
    for (const c of fresh.countries?.countries ?? []) {
      const d = countryDoc(c.id, fresh, index);
      const table = docTable(d, "country.companies");
      for (const [i, co] of c.hq_companies.entries()) {
        const row = fresh.company_rows?.rows.find((x) => x.id === co);
        const real = truth.company_rows?.rows.find((x) => x.id === co);
        if (!row?.estimated || !real) continue;
        const cells = table?.rows[i] ?? [];
        for (const [col, f] of [
          [4, real.revenue_ttm],
          [5, real.value],
        ] as const) {
          const cell = cells[col];
          expect(cell?.k, `${row.name} column ${col}`).toBe("band");
          if (cell?.k !== "band" || f.kind !== "Exact") continue;
          expect(cell.low).toBeLessThan(f.value);
          expect(cell.high).toBeGreaterThan(f.value);
          // The row's texts that are not bands (a band's ends can round to the truth's three
          // digits, b1_pages.rs) never show the truth.
          if (Math.abs(f.value) >= 1e6) {
            const plain = cells.filter((x) => x.k !== "band").map(display);
            expect(plain, row.name).not.toContain(display({ k: "money", v: f.value }));
            checked++;
          }
        }
      }
    }
    expect(checked, "private companies checked").toBeGreaterThan(50);
  });
});

describe("the World page", () => {
  it("lists every province in id order with links to it and its country (D570)", () => {
    const index = buildNameIndex(fresh);
    const d = worldDoc(fresh, index);
    expect(d.title).toBe("World");
    const t = docTable(d, "provinces");
    const provinces = fresh.places?.provinces ?? [];
    expect(t?.rows.length).toBe(provinces.length);
    expect(provinces.length).toBeGreaterThan(1000);
    const first = t?.rows[0];
    expect(first?.[0]).toEqual({ k: "text", v: provinces[0]?.key });
    expect(first?.[1]?.k === "link" && first[1].page).toEqual({ kind: "province", id: provinces[0]?.id });
    expect(first?.[3]?.k === "link" && first[3].page.kind).toBe("country");
  });

  it("links every list page, the current recap and Settings (world.rs)", () => {
    const index = buildNameIndex(after);
    const links = docLinks(worldDoc(after, index));
    for (const p of LIST_PAGES.filter((l) => l.kind !== "world")) expect(has(links, p), p.kind).toBe(true);
    expect(has(links, { kind: "recap", quarter: { year: 2020, q: 1 } })).toBe(true);
  });
});

describe("the name index", () => {
  it("names every kind from the views (D455, D464) and falls back to kind and id", () => {
    const index = buildNameIndex(after);
    const company = after.company_rows?.rows[0];
    const country = after.countries?.countries[0];
    const zone = after.zones?.zones[0];
    const exchange = after.exchanges?.exchanges[0];
    const character = after.characters?.full[0];
    const event = after.births?.events[0];
    const province = after.places?.provinces[0];
    if (!(company && country && zone && exchange && character && event && province)) throw new Error("views");
    expect(index.title({ kind: "company", id: company.id })).toBe(company.name);
    expect(index.title({ kind: "country", id: country.id })).toBe(country.name);
    expect(index.title({ kind: "zone", id: zone.id })).toBe(zone.name);
    expect(index.title({ kind: "exchange", id: exchange.zone })).toBe(exchange.name);
    expect(character.id.kind === "Full" && index.title({ kind: "character", id: character.id.id })).toBe(
      character.name,
    );
    expect(index.title({ kind: "event", id: event.id })).toContain(event.name);
    expect(index.title({ kind: "province", id: province.id })).toBe(province.name);
    expect(index.title({ kind: "recap", quarter: { year: 2020, q: 1 } })).toBe("Quarterly recap Q1 2020");
    expect(index.title({ kind: "settings" })).toBe("Settings");
    expect(index.title({ kind: "companies" })).toBe("Companies");
    expect(index.title({ kind: "company", id: 99_999 as never })).toBe("Company 99999");
    expect(index.title({ kind: "headline", id: 3 as never })).toBe("Headline 3");
    expect(index.companyByTicker(company.ticker.toLowerCase())).toBe(company.ticker ? company.id : undefined);
    expect(index.latestRecap()).toEqual({ kind: "recap", quarter: { year: 2020, q: 1 } });
    // Every entry names a distinct page.
    const ids = index.entries.map((e) => pageId(e.page));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names a company born in play the build after its birth", () => {
    const born = after.company_rows?.rows.filter((r) => r.origin.kind === "Born") ?? [];
    expect(born.length, "births at the first lock").toBeGreaterThan(0);
    const index: NameIndex = buildNameIndex(after);
    for (const r of born) expect(index.title({ kind: "company", id: r.id })).toBe(r.name);
  });
});

describe("the page registry", () => {
  it("registers World, Country and Settings, each well formed", () => {
    for (const k of ["world", "country", "settings"] as const) expect(pageSpecOf(k), k).toBeDefined();
    for (const k of registeredKinds()) {
      const spec = pageSpecOf(k);
      if (!spec) throw new Error(k);
      expect(PAGE_KINDS).toContain(spec.kind);
      expect(spec.doc || spec.Component, `${k} draws`).toBeTruthy();
      const ids = spec.sections.map((s) => s.id);
      expect(new Set(ids).size, `${k} section ids`).toBe(ids.length);
      for (const n of spec.views) expect(n in fresh, `${k} reads ${n}`).toBe(true);
    }
  });

  it("every view a page names exists", () => {
    const names = new Set(Object.keys(fresh) as ViewName[]);
    for (const k of registeredKinds())
      for (const n of pageSpecOf(k)?.views ?? []) expect(names.has(n)).toBe(true);
  });
});

describe("the open budget", () => {
  /** The slowest of a few builds, after a warm-up (the JIT). */
  function slowest(build: () => unknown): number {
    build();
    let worst = 0;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      build();
      worst = Math.max(worst, performance.now() - t0);
    }
    return worst;
  }

  it(`builds each page's doc in under ${PAGE_BUDGET_MS} ms (Step 5: each screen < 100 ms)`, () => {
    const index = buildNameIndex(after);
    const countries = [...(after.countries?.countries ?? [])];
    // The heaviest country page: the most provinces and HQs.
    const big = countries.sort((a, b) => b.hq_companies.length - a.hq_companies.length)[0];
    if (!big) throw new Error("countries");
    expect(slowest(() => countryDoc(big.id, after, index))).toBeLessThan(PAGE_BUDGET_MS);
    expect(slowest(() => worldDoc(after, index))).toBeLessThan(PAGE_BUDGET_MS);
    expect(
      slowest(() => buildNameIndex(after)),
      "the name index",
    ).toBeLessThan(PAGE_BUDGET_MS);
  });
});
