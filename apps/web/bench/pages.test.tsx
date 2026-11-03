// @vitest-environment happy-dom
// The page bench (crates/game/src/page_bench.rs, M9.9, D459, D519, D573, D1013; ts-remaining-work 4.3):
// every page opens in under 100 ms on a long-run world. Not in the gate: a 30-year world takes
// about two minutes to run. Run it with
//
//   corepack pnpm@10.20.0 --filter @tc20ff/web bench:pages
//
// and BENCH_WORLD (default the default world), BENCH_YEARS (30) and BENCH_SEED (1) to change it.
//
// It runs the world in-process (the worker's host), saves it and loads it again so the store gets
// one whole frame, then opens in the DOM, each from nothing:
// - one page of every page kind (a listed and a private company, a company born in play, a recap
//   with no recap yet and one before the game);
// - every Company tab on a listed and a private company, and the page with every section shown;
// - every Pdoomberg function page, F3 on a listed company, a private one and none.
// Each opens twice: cold (its first render) and warm. A page whose cold open alone missed the
// target (its warm open made it) opens once more, a retry, and shows as a `BENCH WARN retried` row:
// only a page slow on the retry too fails (D693). It prints the table, then fails if a page took
// 100 ms or more or a page kind, Company tab or function page was not covered.
//
// An open is timed from the render call to React's commit with every effect run (act), happy-dom
// standing in for the browser. Not timed here, with the reason:
// - Layout and paint, and the chart canvas (lightweight-charts; stubbed as in
//   pdoomberg-dom.test.tsx): the browser walk-through's frame checks (ts-remaining-work 4.4).
// - bench.rs's frame benches (the table auto-scroll, the map behind dense panes, max speed with the
//   shell drawing): they measure frames, so they belong to the same browser checks (4.3).
// - The map modes (page_bench.rs D705): the TS map draws only the political colors.

import type { CompanyId, Quarter, Sim, ToSim } from "@tc20ff/sim";
import { DEFAULT_WORLD_ID } from "@tc20ff/sim-data";
import { loadWorld, worldDataDir } from "@tc20ff/sim-data/node";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SettingsContext } from "../src/config/hooks.ts";
import { SettingsStore } from "../src/config/settings.ts";
import { HoverCards } from "../src/links/Link.tsx";
import { buildNameIndex, type NameIndex } from "../src/links/names.ts";
import { NavContext } from "../src/links/nav.ts";
import type { ChartModel } from "../src/pages/doc.ts";
import { SECTIONS } from "../src/pages/kinds/company.tsx";
import { PAGE_BUDGET_MS, PageBody } from "../src/pages/PagePane.tsx";
import {
  PAGE_KINDS,
  type PageKind,
  type PageRef,
  PDB_FUNCTIONS,
  type PdbFunction,
  pageKey,
  setProvinceKeys,
} from "../src/pages/ref.ts";
import { pageSpecOf } from "../src/pages/registry.ts";
import { selectTab } from "../src/pages/sections.ts";
import { type ViewsData, viewsData } from "../src/pages/views.ts";
import type { PdoombergRoute } from "../src/pdoomberg/models.ts";
import { Pdoomberg } from "../src/pdoomberg/Pdoomberg.tsx";
import { WorkspaceContext, type WorkspaceControl } from "../src/shell/panes.ts";
import type { SimClient } from "../src/sim/client.ts";
import { SimContext } from "../src/sim/hooks.ts";
import { RealHost } from "../src/sim/real/host.ts";
import { type Frame, SimStore } from "../src/sim/store.ts";

vi.mock("../src/pages/ChartBlock.tsx", () => ({
  ChartBlock: ({ chart }: { chart: ChartModel }) => (
    <div data-testid="chart">
      {chart.title} ({chart.labels.length})
    </div>
  ),
}));

/** The target (spec 10 M9: every screen opens in under 100 ms). */
const TARGET_MS = PAGE_BUDGET_MS;
const WORLD = process.env.BENCH_WORLD ?? DEFAULT_WORLD_ID;
const YEARS = Number(process.env.BENCH_YEARS ?? 30);
const SEED = Number(process.env.BENCH_SEED ?? 1);
/** Years between progress lines while the world runs. */
const PROGRESS_YEARS = 5;
/** Doc builds `docMs` times. */
const DOC_BUILDS = 3;
/** Ticks between yields while the world runs (a month), so the test worker still answers Vitest. */
const YIELD_TICKS = 720;
/** The box every element reports: happy-dom has no layout, and the table virtualizer sizes from it. */
const BOX = { width: 1600, height: 600 };

/** One thing the bench opens: a page (with the Company tab shown, null for every section) or a function page. */
type Item = { k: "page"; page: PageRef; tab?: string | null } | { k: "pdb"; route: PdoombergRoute };

/** One open: the item, its pass (0 cold, 1 warm, 2 retry) and its time. */
interface Timing {
  item: Item;
  pass: number;
  ms: number;
}

let host: RealHost;
let store: SimStore;
let views: ViewsData;
let index: NameIndex;
let started: string;

function send(msg: ToSim): void {
  for (const m of host.handle(msg)) if (m.kind === "Frame") store.applyFrame(m as Frame);
}

const rect = HTMLElement.prototype.getBoundingClientRect;
const sizes = ["clientWidth", "clientHeight"].map(
  (k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)] as const,
);

beforeAll(async () => {
  const loaded = loadWorld(worldDataDir(WORLD));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  host = new RealHost(loaded.value);
  store = new SimStore();
  send({ kind: "NewGame", seed: SEED, id: 1 });
  const sim = host.sim as Sim;
  const t0 = performance.now();
  const from = sim.clock().date.year;
  started = `${from}`;
  let shown = from;
  for (let n = 1; sim.clock().date.year < from + YEARS; n++) {
    sim.step();
    if (n % YIELD_TICKS === 0) await new Promise((r) => setTimeout(r, 0));
    const y = sim.clock().date.year;
    if (y >= shown + PROGRESS_YEARS) {
      shown = y;
      console.log(`BENCH running: ${y} after ${((performance.now() - t0) / 1000).toFixed(0)} s`);
    }
  }
  // A load posts one whole frame (every view), as the browser gets after loading a save.
  const bytes = sim.saveBytes();
  store = new SimStore();
  send({ kind: "Load", bytes, id: 2 });
  views = viewsData((host.sim as Sim).views());
  index = buildNameIndex(views);
  HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: BOX.height,
    right: BOX.width,
    width: BOX.width,
    height: BOX.height,
    toJSON: () => ({}),
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => BOX.width });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => BOX.height });
}, 900_000);

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = rect;
  for (const [k, d] of sizes) if (d) Object.defineProperty(HTMLElement.prototype, k, d);
  setProvinceKeys(null);
});

// ---- What it opens ----

const active = (v: ViewsData) => (v.company_rows?.rows ?? []).filter((r) => r.status === "Active");

function firstOf(kind: PageKind): PageRef | null {
  return index.entries.find((e) => e.page.kind === kind)?.page ?? null;
}

const quarterNext = (q: Quarter): Quarter =>
  q.q === 4 ? { year: q.year + 1, q: 1 } : { year: q.year, q: q.q + 1 };
const quarterPrev = (q: Quarter): Quarter =>
  q.q === 1 ? { year: q.year - 1, q: 4 } : { year: q.year, q: q.q - 1 };

/** One page of each kind, then each Company tab on a listed and a private company, then every function page. */
function items(): Item[] {
  const rows = active(views);
  const listed = rows.find((r) => r.public)?.id ?? null;
  const private_ = rows.find((r) => !r.public)?.id ?? null;
  const born = views.births?.births[0]?.id ?? null;
  const company = (id: CompanyId | null): PageRef | null => (id === null ? null : { kind: "company", id });
  const recap = index.latestRecap();
  const quarter = recap?.kind === "recap" ? recap.quarter : null;
  const feed = views.news?.feed ?? [];
  const newest = feed[feed.length - 1];
  const detail = views.company_detail?.companies[0];
  const pages: (PageRef | null)[] = [
    { kind: "companies" },
    company(listed),
    company(private_),
    company(born),
    { kind: "industries" },
    firstOf("industry"),
    { kind: "characters" },
    { kind: "countries" },
    rows[0] ? { kind: "country", id: rows[0].hq_country } : null,
    detail ? { kind: "province", id: detail.hq_province } : null,
    { kind: "zones" },
    firstOf("zone"),
    { kind: "exchanges" },
    firstOf("exchange"),
    { kind: "events" },
    firstOf("event"),
    recap,
    { kind: "news" },
    newest ? { kind: "headline", id: newest.id } : null,
    // A quarter with no recap yet, and one before the game.
    quarter ? { kind: "recap", quarter: quarterNext(quarter) } : null,
    { kind: "recap", quarter: quarterPrev({ year: Number(started), q: 1 }) },
    { kind: "politics" },
    { kind: "world-history" },
    { kind: "settings" },
    { kind: "world" },
  ];
  const out: Item[] = pages.filter((p): p is PageRef => p !== null).map((page) => ({ k: "page", page }));
  for (const s of SECTIONS)
    for (const id of [listed, private_])
      if (id !== null) out.push({ k: "page", page: { kind: "company", id }, tab: s.id });
  if (listed !== null) out.push({ k: "page", page: { kind: "company", id: listed }, tab: null });
  for (const f of PDB_FUNCTIONS) {
    const companies = f === "F3" ? [listed, private_, null] : [null];
    for (const c of companies) out.push({ k: "pdb", route: { function: f, company: c } });
  }
  return out;
}

function itemName(it: Item): string {
  if (it.k === "pdb")
    return `pdoomberg/${it.route.function}${it.route.company === null ? "" : `/company/${it.route.company}`}`;
  const key = pageKey(it.page);
  if (it.tab === undefined) return key;
  return it.tab === null ? `${key} all tabs` : `${key} tab ${it.tab}`;
}

// ---- Opening ----

function noWorkspace(): WorkspaceControl {
  return {
    open: () => {},
    openPage: () => {},
    isOpen: () => false,
    closed: () => [],
    reopen: () => {},
    registerPane: () => () => {},
    persist: () => {},
    layout: () => ({ grid: { root: {} }, panels: {} }),
    restore: () => true,
  } as unknown as WorkspaceControl;
}

function shell(settings: SettingsStore, children: ReactNode): ReactNode {
  return (
    <SimContext.Provider value={{ store } as unknown as SimClient}>
      <SettingsContext.Provider value={settings}>
        <WorkspaceContext.Provider value={noWorkspace()}>
          <NavContext.Provider value={{ open: () => {} }}>
            <HoverCards>{children}</HoverCards>
          </NavContext.Provider>
        </WorkspaceContext.Provider>
      </SettingsContext.Provider>
    </SimContext.Provider>
  );
}

/** Opens `it` from nothing and times it to React's commit; then clears the DOM. */
function open(it: Item): number {
  const settings = new SettingsStore(null);
  if (it.k === "page" && it.tab !== undefined)
    settings.update((c) => selectTab(c, "company", SECTIONS, it.tab ?? null));
  const body =
    it.k === "page" ? (
      <PageBody page={it.page} />
    ) : (
      <Pdoomberg route={it.route} onRoute={() => {}} onOpenPage={() => {}} onClose={() => {}} />
    );
  const t0 = performance.now();
  act(() => {
    render(shell(settings, body));
  });
  const ms = performance.now() - t0;
  cleanup();
  return ms;
}

/**
 * The doc build alone (the page's pure builder, no React), the slowest of a few after the opens:
 * for a slow page, whether the time is the doc or its render. Null for a page drawn by a component.
 */
function docMs(it: Item): number | null {
  if (it.k !== "page") return null;
  const spec = pageSpecOf(it.page.kind);
  if (!spec?.doc) return null;
  const build = spec.doc;
  let worst = 0;
  for (let i = 0; i < DOC_BUILDS; i++) {
    const t0 = performance.now();
    build(it.page as never, views, index);
    worst = Math.max(worst, performance.now() - t0);
  }
  return worst;
}

/** What the run covered against what M9.9 asks for, that it never opened. */
function missing(list: Item[]): string[] {
  const kinds = new Set<PageKind>();
  const tabs = new Set<string>();
  const functions = new Set<PdbFunction>();
  const f3 = new Set<string>();
  const listed = new Set(
    active(views)
      .filter((r) => r.public)
      .map((r) => r.id as number),
  );
  for (const it of list) {
    if (it.k === "page") {
      kinds.add(it.page.kind);
      if (it.page.kind === "company" && typeof it.tab === "string")
        tabs.add(`${it.tab} ${listed.has(it.page.id) ? "listed" : "private"}`);
    } else {
      functions.add(it.route.function);
      if (it.route.function === "F3")
        f3.add(it.route.company === null ? "none" : listed.has(it.route.company) ? "listed" : "private");
    }
  }
  const out = PAGE_KINDS.filter((k) => !kinds.has(k)).map((k) => `page kind ${k}`);
  for (const s of SECTIONS)
    for (const who of ["listed", "private"])
      if (!tabs.has(`${s.id} ${who}`)) out.push(`company tab ${s.id} on a ${who} company`);
  for (const who of ["listed", "private", "none"]) if (!f3.has(who)) out.push(`pdoomberg F3 on ${who}`);
  for (const f of PDB_FUNCTIONS) if (!functions.has(f)) out.push(`pdoomberg ${f}`);
  return out;
}

describe("the page bench (page_bench.rs, M9.9)", () => {
  it(`opens every page in under ${TARGET_MS} ms on a ${YEARS}-year world`, () => {
    const list = items();
    const results: Timing[] = [];
    for (const pass of [0, 1]) for (const item of list) results.push({ item, pass, ms: open(item) });
    const at = (item: Item, pass: number) =>
      results.find((r) => r.item === item && r.pass === pass)?.ms ?? Infinity;
    for (const item of list)
      if (at(item, 0) >= TARGET_MS && at(item, 1) < TARGET_MS)
        results.push({ item, pass: 2, ms: open(item) });

    const lines = [
      `BENCH pages: ${WORLD} world, seed ${SEED}, ${YEARS} years from ${started}; open in the DOM to React's commit`,
      `BENCH ${"page".padEnd(44)} ${"cold ms".padStart(9)} ${"warm ms".padStart(9)} ${"doc ms".padStart(9)}`,
    ];
    const over: string[] = [];
    let worst = 0;
    for (const item of list) {
      const [cold, warm, retry] = [at(item, 0), at(item, 1), at(item, 2)];
      if (Number.isFinite(retry))
        lines.push(
          `BENCH WARN retried ${itemName(item)}: cold ${cold.toFixed(2)} ms over the ${TARGET_MS} ms target, again ${retry.toFixed(2)} ms`,
        );
      const pageWorst = Math.max(Math.min(cold, retry), warm);
      worst = Math.max(worst, pageWorst);
      if (pageWorst >= TARGET_MS) over.push(itemName(item));
      const doc = docMs(item);
      lines.push(
        `BENCH ${itemName(item).padEnd(44)} ${cold.toFixed(2).padStart(9)} ${warm.toFixed(2).padStart(9)} ${(doc === null ? "-" : doc.toFixed(2)).padStart(9)}`,
      );
    }
    const gaps = missing(list);
    for (const m of gaps) lines.push(`BENCH not covered: ${m}`);
    for (const o of over) lines.push(`BENCH over the target: ${o}`);
    const ok = over.length === 0 && gaps.length === 0;
    lines.push(
      `BENCH pages ${list.length} opened, worst ${worst.toFixed(2)} ms: ${ok ? "PASS" : "FAIL"} (target < ${TARGET_MS} ms)`,
    );
    console.log(lines.join("\n"));
    expect(gaps, "not covered").toEqual([]);
    expect(over, "over the target").toEqual([]);
  }, 900_000);
});
