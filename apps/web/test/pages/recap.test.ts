// The Quarterly recap read as data (PageDoc, D480) from a real game run to the Q1 2020 recap tick:
// lane A's share of crates/game/tests/market_pages.rs recap_opens_from_its_alert_and_by_quarter
// (the alert, the pane it opens in, the sections, the watchlist pages, the quarters) and
// private_figures_are_bands_and_never_the_truth (the recap part), plus placeholder.rs `related`
// for a recap (the previous and next quarters and the watchlist companies). Clicking the alert in
// the alerts list is lane-a-dom.test.tsx.

import { type CompanyId, type Notice, type Quarter, recapTick, type Sim, simNew } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { buildNameIndex } from "../../src/links/names.ts";
import { docLinks, docTable, docTexts, type PageDoc } from "../../src/pages/doc.ts";
import {
  companyPagesTable,
  expectedTable,
  recapAlertQuarter,
  recapDoc,
  recapOf,
} from "../../src/pages/kinds/recap.tsx";
import { type PageRef, pageEq, quarterNext, quarterPrev, setProvinceKeys } from "../../src/pages/ref.ts";
import { type ViewsData, viewsData } from "../../src/pages/views.ts";
import { recapPane } from "../../src/shell/Workspace.tsx";
import { type Cell, display, money } from "../../src/widgets/cells.ts";

const SEED = 42;
const Q1: Quarter = { year: 2020, q: 1 };
/** Banded (private) companies put on the watchlist (market_pages.rs takes 12). */
const BANDED = 12;

let data: WorldData;
let v: ViewsData;
let truth: ViewsData;
let banded: CompanyId[];
let listed: CompanyId;
let recapNotices: Notice[];
let sim: Sim;

function newSim(debug = false): Sim {
  const made = simNew(data, SEED, { debug });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  return made.value;
}

/** Puts the companies on the watchlist and runs to the Q1 recap tick; the notices of that tick. */
function runToRecap(s: Sim, watch: readonly CompanyId[]): Notice[] {
  for (const c of watch) if (!s.apply({ kind: "WatchlistAdd", company: c }).ok) throw new Error("watch");
  const at = recapTick(Q1);
  let last: Notice[] = [];
  while (s.now() < at) last = s.step();
  return last;
}

beforeAll(() => {
  const loaded = loadWorld(defaultDataDir());
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  data = loaded.value;
  sim = newSim();
  const start = viewsData(sim.views());
  const rows = start.company_rows?.rows ?? [];
  banded = rows
    .filter((r) => r.estimated && !r.public)
    .slice(0, BANDED)
    .map((r) => r.id);
  const pub = rows.find((r) => r.public);
  if (!pub) throw new Error("a listed company");
  listed = pub.id;
  recapNotices = runToRecap(sim, [...banded, listed]);
  v = viewsData(sim.views());
  const twin = newSim(true);
  runToRecap(twin, [...banded, listed]);
  if (!twin.apply({ kind: "SetOmniscient", on: true }).ok) throw new Error("SetOmniscient");
  truth = viewsData(twin.views());
  return () => setProvinceKeys(null);
}, 120_000);

const has = (links: PageRef[], p: PageRef) => links.some((l) => pageEq(l, p));
const texts = (d: PageDoc, w: ViewsData) => docTexts(d, w).join(" | ");
const rowOf = (rows: Cell[][], id: CompanyId) =>
  rows.findIndex((r) => r.some((c) => c.k === "link" && pageEq(c.page, { kind: "company", id })));

describe("the Quarterly recap", () => {
  it("opens in a pane from its pause alert in the pre-quarter-end week, and by quarter (recap_opens_from_its_alert_and_by_quarter)", () => {
    // The recap tick posts the Pause-level alert, naming its quarter.
    const alerts = recapNotices.filter((n) => recapAlertQuarter(n, null) !== null);
    expect(alerts.length, "the recap alert").toBe(1);
    expect(recapAlertQuarter(alerts[0] as Notice, null)).toEqual(Q1);
    // A Notify-level recap alert opens nothing by itself, but the alerts list links it.
    const notify: Notice = {
      kind: "Alert",
      alert_kind: "QuarterlyRecap",
      level: "Notify",
      payload: { kind: "None" },
    };
    expect(recapAlertQuarter(notify, Q1)).toBeNull();
    expect(recapAlertQuarter(notify, Q1, false)).toEqual(Q1);
    // The pane already on a recap takes it, else a new pane (D513).
    const world: PageRef = { kind: "world" };
    const old: PageRef = { kind: "recap", quarter: quarterPrev(Q1) };
    expect(recapPane([["page-1", world]])).toBeNull();
    expect(
      recapPane([
        ["page-1", world],
        ["page-2", old],
      ]),
    ).toBe("page-2");
    // The page: its sections and both watchlist companies' pages.
    const index = buildNameIndex(v);
    const d = recapDoc(Q1, v, index);
    expect(d.title).toBe(index.title({ kind: "recap", quarter: Q1 }));
    expect(d.sections.map((s) => s.id)).toEqual(["world", "beats", "companies"]);
    const all = texts(d, v);
    for (const s of ["Global phase", "g_t", "Opened"]) expect(all).toContain(s);
    const pages = docTable(d, "recap.companies");
    expect(pages?.rows.length, "every watchlist company has a page").toBe(BANDED + 1);
    // The company pages follow the watchlist (v_clock's, D975).
    expect(sim.apply({ kind: "WatchlistRemove", company: listed }).ok).toBe(true);
    const less = viewsData(sim.views());
    expect(docTable(recapDoc(Q1, less, index), "recap.companies")?.rows.length, "follows the watchlist").toBe(
      BANDED,
    );
    expect(sim.apply({ kind: "WatchlistAdd", company: listed }).ok).toBe(true);
    // A banded range is marked as estimates.
    const t = pages;
    if (!t) throw new Error("table");
    const est = t.columns.findIndex((c) => c.title === "Figures");
    const low = t.columns.findIndex((c) => c.title === "Range low");
    for (const r of t.rows) expect(r[low]?.k === "band").toBe(display(r[est] as Cell) === "estimates");
    // By quarter: the page links every kept quarter; a later one says when it opens; one before
    // the game says it is not kept.
    expect(has(docLinks(d), { kind: "recap", quarter: Q1 })).toBe(true);
    expect(texts(recapDoc(quarterNext(Q1), v, index), v)).toContain("opens in its pre-quarter-end week");
    expect(texts(recapDoc(quarterPrev(Q1), v, index), v)).toContain("recap is kept");
    expect(recapOf(v, Q1)).toBeDefined();
  });

  it("links the quarters, the industries and the watchlist companies (placeholder.rs related, Recap)", () => {
    const index = buildNameIndex(v);
    const links = docLinks(recapDoc(Q1, v, index));
    for (const c of [...banded, listed])
      expect(has(links, { kind: "company", id: c }), `company ${c}`).toBe(true);
    const r = recapOf(v, Q1);
    if (!r) throw new Error("the Q1 recap");
    for (const [, ids] of r.world.industries_by_label)
      for (const i of ids) expect(has(links, { kind: "industry", id: i })).toBe(true);
    // The next quarter's page (not built yet) links back to Q1 and to its own quarter.
    const next = docLinks(recapDoc(quarterNext(Q1), v, index));
    expect(has(next, { kind: "recap", quarter: Q1 })).toBe(true);
  });

  it("a private company's recap figures are bands and never the truth (private_figures_are_bands_and_never_the_truth, recap part)", () => {
    const index = buildNameIndex(v);
    expect(v.clock?.omniscient).toBe(false);
    const r = recapOf(v, Q1);
    const tr = recapOf(truth, Q1);
    if (!(r && tr)) throw new Error("the Q1 recap");
    const watch = v.clock?.watchlist ?? [];
    const pages = companyPagesTable(r, watch, index);
    const expected = expectedTable(r, index);
    expect(pages.rows.length).toBe(BANDED + 1);
    const col = (title: string) => pages.columns.findIndex((c) => c.title === title);
    for (const id of banded) {
      const row = pages.rows[rowOf(pages.rows, id)];
      expect(row, `row of ${id}`).toBeDefined();
      const p = tr.companies.find((x) => x.company === id);
      if (!p) throw new Error(`the twin's page of ${id}`);
      const truths: [string, number][] = [
        ["Range low", p.range[0]],
        ["Range high", p.range[1]],
        ["Consensus", p.expected.consensus],
      ].map(([k, f]) => {
        const fig = f as (typeof p.range)[0];
        if (fig.kind !== "Exact") throw new Error("Omniscient is exact");
        return [k as string, fig.value];
      });
      for (const [key, x] of truths) {
        const c = row?.[col(key)];
        if (c?.k !== "band") throw new Error(`${key} of ${id} is a band`);
        // Strictly inside, at no endpoint, and printed nowhere in its cell (D422).
        expect(c.low, key).toBeLessThan(x);
        expect(c.high, key).toBeGreaterThan(x);
        expect(display(c).split(/[- ]/)).not.toContain(money(x));
      }
      // No cell of the company's rows (the expected beats and misses too) is a hidden value.
      const shown = [
        ...(row ?? []).map(display),
        ...(expected.rows[rowOf(expected.rows, id)] ?? []).map(display),
      ];
      for (const [, x] of truths) expect(shown, `${id}: shown as a value`).not.toContain(money(x));
    }
  });
});
