// The Character, Zone, Exchange, Province and list pages read as data (PageDoc, D480) from the
// views of a real game: lane A's share of crates/game/tests/b1_pages.rs (every_entity_page_builds,
// pages_link_their_names, the_index_chart_draws_the_sim_s_daily_closes,
// live_tables_and_charts_follow_the_first_change, a_load_shows_the_saved_index_history),
// m8_province.rs (the_province_page_lists_its_hqs_and_units_with_links,
// province_names_link_to_their_pages_everywhere, the_command_bar_finds_provinces), a1_views.rs
// (a_private_company_shows_bands_and_never_the_truth for the Companies list,
// names_come_from_the_a1_views) and workspace.rs every_page_kind_builds (the list tables).
//
// b1_pages.rs live_tables_and_charts_follow_the_first_change checked Bevy's live chart and table
// against a page that does not rebuild; here a page lists the daily views it reads, so the check is
// that a doc built from the next day's views (what the pane rebuilds to) has that day's close and
// constituents, and that the page names those views.

import { indexCloseRows, type Sim, simNew } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { buildNameIndex, role } from "../../src/links/names.ts";
import { docLinks, docTable, docTexts, liveText, type PageDoc } from "../../src/pages/doc.ts";
import { characterDoc } from "../../src/pages/kinds/character.tsx";
import { countryDoc } from "../../src/pages/kinds/country.tsx";
import { constituentsTable, exchangeDoc } from "../../src/pages/kinds/exchange.tsx";
import { LIST_KINDS, listDoc, listTable } from "../../src/pages/kinds/lists.tsx";
import { provinceDoc } from "../../src/pages/kinds/province.tsx";
import { indexChart, zoneDoc } from "../../src/pages/kinds/zone.tsx";
import { PAGE_BUDGET_MS } from "../../src/pages/PagePane.tsx";
import { type PageRef, pageEq, setProvinceKeys } from "../../src/pages/ref.ts";
import { pageSpecOf } from "../../src/pages/registry.ts";
import { type ViewsData, viewsData } from "../../src/pages/views.ts";
import { buildEntries, makeFuse, search } from "../../src/shell/CommandBar.tsx";
import { type Cell, cellNumber, date, display, money, number, sortOrder } from "../../src/widgets/cells.ts";

const AFTER_FIRST_LOCK = 200;
const SEED = 42;

let data: WorldData;
let fresh: ViewsData;
let after: ViewsData;
let truth: ViewsData;

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
  const twin = newSim(true);
  if (!twin.apply({ kind: "SetOmniscient", on: true }).ok) throw new Error("SetOmniscient");
  truth = viewsData(twin.views());
  return () => setProvinceKeys(null);
});

const has = (links: PageRef[], p: PageRef) => links.some((l) => pageEq(l, p));
const texts = (d: PageDoc, v: ViewsData) => docTexts(d, v).join(" | ");
/** The row of a table whose cells link `page`. */
const rowOf = (rows: Cell[][], page: PageRef) =>
  rows.findIndex((r) => r.some((c) => c.k === "link" && pageEq(c.page, page)));
const col = (t: { columns: { title: string }[] }, title: string) =>
  t.columns.findIndex((c) => c.title === title);

describe("the Character page", () => {
  it("builds for every full character with its three sections (every_entity_page_builds)", () => {
    for (const v of [fresh, after]) {
      const index = buildNameIndex(v);
      for (const c of v.characters?.full ?? []) {
        if (c.id.kind !== "Full") throw new Error("full");
        const d = characterDoc(c.id.id, v, index);
        expect(d.title).toBe(c.name);
        expect(d.sections.map((s) => s.id)).toEqual(["profile", "roles", "holdings"]);
        expect(texts(d, v)).not.toContain("No such");
      }
    }
  });

  it("links home, roles and holdings (pages_link_their_names; m8_province home province)", () => {
    const index = buildNameIndex(after);
    for (const c of (after.characters?.full ?? []).slice(0, 60)) {
      if (c.id.kind !== "Full") throw new Error("full");
      const links = docLinks(characterDoc(c.id.id, after, index));
      if (c.home) {
        expect(has(links, { kind: "country", id: c.home.country })).toBe(true);
        expect(has(links, { kind: "province", id: c.home.province })).toBe(true);
      }
      for (const r of c.roles) expect(has(links, { kind: "company", id: role(r)[1] })).toBe(true);
      for (const h of c.holdings) expect(has(links, { kind: "company", id: h.company })).toBe(true);
    }
  });

  it("a partial character has no page and is not indexed (board_lists_directors_by_position)", () => {
    const index = buildNameIndex(after);
    const p = after.characters?.partial[0];
    if (!p) throw new Error("a partial character");
    expect(index.entries.some((e) => e.page.kind === "character" && e.name === p.name && !p.full)).toBe(
      false,
    );
    // A seat holder who is partial shows marked on the Company page (company.test.ts covers it)
    // and an id with no full character is a page that says so.
    const d = characterDoc(999_999 as never, after, index);
    expect(texts(d, after)).toContain("No such character in the views.");
  });
});

describe("the Zone and Exchange pages", () => {
  it("build for every zone; members and constituents match the views (every_entity_page_builds)", () => {
    for (const v of [fresh, after]) {
      const index = buildNameIndex(v);
      for (const z of v.zones?.zones ?? []) {
        const d = zoneDoc(z.id, v, index);
        expect(d.title).toBe(z.name);
        expect(docTable(d, "zone.members")?.rows.length).toBe(z.members.length);
        const x = exchangeDoc(z.id, v, index);
        expect(x.title).not.toBe("");
        expect(texts(x, v)).not.toContain("No such");
        const listed = v.exchanges?.exchanges[z.id]?.constituents.length;
        expect(docTable(x, "exchange.constituents")?.rows.length).toBe(listed);
      }
    }
  });

  it("link the exchange, the member countries and provinces, the zone, the hub and the constituents (pages_link_their_names; m8_province)", () => {
    const index = buildNameIndex(after);
    const cards = after.province_cards?.cards ?? [];
    for (const z of after.zones?.zones ?? []) {
      const links = docLinks(zoneDoc(z.id, after, index));
      expect(has(links, { kind: "exchange", id: z.id })).toBe(true);
      for (const c of z.members) expect(has(links, { kind: "country", id: c })).toBe(true);
      const mine = cards.filter((p) => z.members.includes(p.country));
      expect(mine.length, z.name).toBeGreaterThan(0);
      for (const p of mine) expect(has(links, { kind: "province", id: p.id })).toBe(true);
      const xl = docLinks(exchangeDoc(z.id, after, index));
      expect(has(xl, { kind: "zone", id: z.id })).toBe(true);
      const x = after.exchanges?.exchanges[z.id];
      if (!x) throw new Error("exchange");
      expect(has(xl, { kind: "province", id: x.hub_province })).toBe(true);
      for (const co of x.constituents) expect(has(xl, { kind: "company", id: co })).toBe(true);
    }
  });

  it("the index chart draws v_exchanges' daily closes (the_index_chart_draws_the_sim_s_daily_closes)", () => {
    const sim = newSim();
    const z = viewsData(sim.views()).zones?.zones.find((x) => x.index_close !== null)?.id;
    if (z === undefined) throw new Error("a zone with a listing");
    const points = () => {
      const v = viewsData(sim.views());
      return indexChart(z, v, buildNameIndex(v)).labels.length;
    };
    expect(points(), "the load level").toBe(1);
    for (let i = 0; i < 24 * 3; i++) sim.step();
    expect(points(), "one close a day").toBe(4);
    const v = viewsData(sim.views());
    const m = indexChart(z, v, buildNameIndex(v));
    expect(m.labels[0]).toBe(date({ year: 2020, month: 1, day: 1 }));
    const line = m.series[0];
    if (line?.k !== "line") throw new Error("a line");
    const x = v.exchanges?.exchanges[z];
    if (!x) throw new Error("exchange");
    expect(line.values).toEqual(indexCloseRows(x.closes).map((c) => c.level));
  });

  it("daily figures, the chart and the constituents follow the first day after they open (live_tables_and_charts_follow_the_first_change)", () => {
    // The pages list the daily views they draw from, so the pane rebuilds when they move.
    expect(pageSpecOf("zone")?.views).toEqual(expect.arrayContaining(["zones", "exchanges"]));
    expect(pageSpecOf("exchange")?.views).toEqual(expect.arrayContaining(["exchanges", "quotes"]));
    const sim = newSim();
    const v0 = viewsData(sim.views());
    const z = v0.zones?.zones.find((x) => x.index_close !== null)?.id;
    if (z === undefined) throw new Error("a zone with a listing");
    const today = v0.clock?.date;
    expect(indexChart(z, v0, buildNameIndex(v0)).labels.length, "today's close").toBe(1);
    let v = v0;
    while (v.clock?.date.day === today?.day) {
      sim.step();
      v = viewsData(sim.views());
    }
    const index = buildNameIndex(v);
    const closes = v.exchanges?.exchanges[z]?.closes;
    if (!closes) throw new Error("closes");
    const n = indexCloseRows(closes).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(indexChart(z, v, index).labels.length, "the next day's close").toBe(n);
    const close = v.zones?.zones[z]?.index_close;
    if (close == null) throw new Error("a close");
    expect(liveText({ k: "IndexClose", zone: z }, v).text).toBe(number(close));
    expect(docTable(exchangeDoc(z, v, index), "exchange.constituents")).toEqual(
      constituentsTable(z, v, index),
    );
  });

  it("a load shows the saved index history (a_load_shows_the_saved_index_history)", () => {
    const saved = newSim();
    for (let i = 0; i < 60; i++) saved.step();
    const bytes = saved.saveBytes();
    const sim = newSim();
    const v0 = viewsData(sim.views());
    const z = v0.zones?.zones.find((x) => x.index_close !== null)?.id;
    if (z === undefined) throw new Error("a zone with a listing");
    expect(indexChart(z, v0, buildNameIndex(v0)).labels.length, "a fresh game: the load level").toBe(1);
    expect(sim.loadBytes(bytes).ok).toBe(true);
    const v = viewsData(sim.views());
    expect(v.clock?.date).toEqual({ year: 2020, month: 1, day: 3 });
    expect(indexChart(z, v, buildNameIndex(v)).labels.length, "1, 2 and 3 January").toBe(3);
  });
});

describe("the Province page", () => {
  it("lists its HQs and units with links, and links its Metro and key city (the_province_page_lists_its_hqs_and_units_with_links)", () => {
    const v = fresh;
    const index = buildNameIndex(v);
    let withBoth = 0;
    let metroLinks = 0;
    const statics = v.map_static;
    for (const c of v.province_cards?.cards ?? []) {
      const d = provinceDoc(c.id, v, index);
      expect(d.title).toBe(c.name);
      expect(docTable(d, "province.hqs")?.rows.length).toBe(c.hqs.length);
      expect(docTable(d, "province.units")?.rows.length).toBe(c.units.length);
      const links = docLinks(d);
      expect(has(links, { kind: "country", id: c.country }), c.key).toBe(true);
      for (const co of c.hqs) expect(has(links, { kind: "company", id: co })).toBe(true);
      for (const u of c.units) {
        const row = v.units?.units[u];
        if (!row) throw new Error("unit");
        expect(has(links, { kind: "company", id: row.company })).toBe(true);
        expect(has(links, { kind: "industry", id: row.industry })).toBe(true);
      }
      if (c.hqs.length > 0 && c.units.length > 0) withBoth++;
      const row = statics?.provinces[c.id];
      if (row?.metro != null) {
        const q = statics?.metros[row.metro]?.provinces.find((x) => x !== c.id);
        if (q !== undefined) {
          expect(has(links, { kind: "province", id: q }), c.key).toBe(true);
          metroLinks++;
        }
      }
      if (row?.key_city != null) {
        const q = statics?.key_cities[row.key_city]?.provinces[0];
        if (q !== undefined) expect(has(links, { kind: "province", id: q }), c.key).toBe(true);
      }
      expect(
        docTexts(d, v).some((t) => t.includes("lane P")),
        c.key,
      ).toBe(false);
    }
    expect(withBoth).toBeGreaterThan(20);
    expect(metroLinks).toBeGreaterThan(50);
  });

  it("province names link to their pages on the Country pages (province_names_link_to_their_pages_everywhere)", () => {
    const v = fresh;
    const index = buildNameIndex(v);
    const cards = v.province_cards?.cards ?? [];
    for (const c of (v.countries?.countries ?? []).slice(0, 40)) {
      const links = docLinks(countryDoc(c.id, v, index));
      const mine = cards.filter((p) => p.country === c.id);
      expect(mine.length).toBeGreaterThan(0);
      for (const p of mine) expect(has(links, { kind: "province", id: p.id }), p.key).toBe(true);
    }
  });

  it("the command bar finds provinces by name and CSV id (the_command_bar_finds_provinces)", () => {
    const index = buildNameIndex(fresh);
    const entries = buildEntries(index);
    const fuse = makeFuse(entries);
    for (const key of ["US-0001", "CA-0026", "MO-0001", "GB-0001"]) {
      const p = fresh.places?.provinces.find((x) => x.key === key);
      if (!p) throw new Error(key);
      const page: PageRef = { kind: "province", id: p.id };
      for (const q of [p.name, key]) {
        const hits = search(fuse, entries, q);
        expect(
          hits.some((h) => h.target.kind === "page" && pageEq(h.target.page, page)),
          `${q} finds ${key}`,
        ).toBe(true);
      }
      expect(index.entries.some((e) => pageEq(e.page, page) && e.hidden)).toBe(false);
    }
  });
});

describe("the list pages", () => {
  it("each has its index table, id = the kind key, one row per entry (workspace every_page_kind_builds)", () => {
    const index = buildNameIndex(after);
    for (const kind of LIST_KINDS) {
      expect(pageSpecOf(kind), kind).toBeDefined();
      const d = listDoc({ kind }, after, index);
      expect(d.title).toBe(index.title({ kind }));
      const t = docTable(d, kind);
      expect(t, kind).toBeDefined();
      expect(t?.rows.length, kind).toBeGreaterThan(0);
      expect(d.kind).toBe(`${t?.rows.length} entries`);
    }
  });

  it("a private company shows bands in the Companies list, sorting by midpoint (a1_views a_private_company_shows_bands_and_never_the_truth)", () => {
    const v = fresh;
    const index = buildNameIndex(v);
    const row = v.company_rows?.rows.find((r) => r.estimated && !r.public);
    if (!row) throw new Error("a private company");
    const t = listTable("companies", v, index);
    const r = rowOf(t.rows, { kind: "company", id: row.id });
    const figures = [
      ["Revenue TTM", row.revenue_ttm],
      ["Net income", row.net_income_ttm],
      ["Value", row.value],
    ] as const;
    for (const [key, f] of figures) {
      if (f.kind !== "Band") throw new Error(`${key} is a band`);
      expect(t.rows[r]?.[col(t, key)], key).toEqual({
        k: "band",
        unit: "money",
        low: f.band.low,
        high: f.band.high,
      });
    }
    const text = (t.rows[r] ?? []).map(display).join(" | ");
    // Sorting by revenue goes by what the cells show (midpoints, exact values), never a truth.
    const rc = col(t, "Revenue TTM");
    const order = sortOrder(
      t.rows.map((x) => x[rc] as Cell),
      true,
    );
    const sorted = order
      .map((i) => cellNumber(t.rows[i]?.[rc] as Cell))
      .filter((x): x is number => x !== null);
    expect(sorted.every((x, i) => i === 0 || (sorted[i - 1] as number) <= x)).toBe(true);
    for (const x of t.rows) {
      const c = x[rc];
      if (c?.k === "band") expect(cellNumber(c)).toBe((c.low + c.high) / 2);
    }
    // The truth from an Omniscient twin lies strictly inside each band and is not shown.
    const real = truth.company_rows?.rows.find((x) => x.id === row.id);
    if (!real) throw new Error("twin row");
    figures.forEach(([key, f], i) => {
      const x = [real.revenue_ttm, real.net_income_ttm, real.value][i];
      if (f.kind !== "Band" || x?.kind !== "Exact") throw new Error(key);
      expect(f.band.low, key).toBeLessThan(x.value);
      expect(f.band.high, key).toBeGreaterThan(x.value);
      expect(f.band.estimate).not.toBe(x.value);
      expect(text, `${key}: the truth shows`).not.toContain(money(x.value));
    });
  });

  it("names come from the views: countries, characters and places (a1_views names_come_from_the_a1_views)", () => {
    const v = fresh;
    const index = buildNameIndex(v);
    for (const c of v.countries?.countries ?? [])
      expect(index.title({ kind: "country", id: c.id })).toBe(c.name);
    for (const c of v.characters?.full ?? [])
      if (c.id.kind === "Full") expect(index.title({ kind: "character", id: c.id.id })).toBe(c.name);
    expect(index.entries.some((e) => e.name.includes("#"))).toBe(false);
    const canada = v.countries?.countries.find((c) => c.iso3 === "CAN");
    if (!canada) throw new Error("CAN");
    const entries = buildEntries(index);
    expect(
      search(makeFuse(entries), entries, "CAN").some(
        (h) => h.target.kind === "page" && pageEq(h.target.page, { kind: "country", id: canada.id }),
      ),
    ).toBe(true);
    const countries = listTable("countries", v, index);
    expect(countries.rows.length).toBe(v.countries?.countries.length);
    expect(countries.rows[rowOf(countries.rows, { kind: "country", id: canada.id })]?.[0]).toEqual({
      k: "link",
      text: canada.name,
      page: { kind: "country", id: canada.id },
    });
    const chars = listTable("characters", v, index);
    expect(chars.rows.length).toBe(v.characters?.full.length);
    // A character's home is a place link to its province (M8.7, D707).
    const c0 = v.characters?.full[0];
    if (c0?.id.kind !== "Full" || !c0.home) throw new Error("a character with a home");
    const h = c0.home;
    expect(chars.rows[rowOf(chars.rows, { kind: "character", id: c0.id.id })]?.[col(chars, "Home")]).toEqual({
      k: "link",
      text: `${h.province_name}, ${h.country_name}`,
      page: { kind: "province", id: h.province },
    });
  });
});

describe("the open budget", () => {
  /** The slowest of three builds after a warm-up (the JIT). */
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

  it(`builds the heaviest zone, exchange, province, character and list pages in under ${PAGE_BUDGET_MS} ms`, () => {
    const v = after;
    const index = buildNameIndex(v);
    const zones = [...(v.zones?.zones ?? [])].sort((a, b) => b.members.length - a.members.length);
    const exchanges = [...(v.exchanges?.exchanges ?? [])].sort(
      (a, b) => b.constituents.length - a.constituents.length,
    );
    const provinces = [...(v.province_cards?.cards ?? [])].sort(
      (a, b) => b.hqs.length + b.units.length - (a.hqs.length + a.units.length),
    );
    const z = zones[0];
    const x = exchanges[0];
    const p = provinces[0];
    const c = v.characters?.full.find((r) => r.roles.length > 2)?.id;
    if (!(z && x && p && c?.kind === "Full")) throw new Error("views");
    expect(
      slowest(() => zoneDoc(z.id, v, index)),
      "zone",
    ).toBeLessThan(PAGE_BUDGET_MS);
    expect(
      slowest(() => exchangeDoc(x.zone, v, index)),
      "exchange",
    ).toBeLessThan(PAGE_BUDGET_MS);
    expect(
      slowest(() => provinceDoc(p.id, v, index)),
      "province",
    ).toBeLessThan(PAGE_BUDGET_MS);
    expect(
      slowest(() => characterDoc(c.id, v, index)),
      "character",
    ).toBeLessThan(PAGE_BUDGET_MS);
    for (const kind of LIST_KINDS)
      expect(
        slowest(() => listDoc({ kind }, v, index)),
        kind,
      ).toBeLessThan(PAGE_BUDGET_MS);
  });
});
