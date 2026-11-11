// The UI leak test (crates/game/tests/m9_leak.rs, M9.8, D574, D1013; ts-remaining-work 4.2): with
// Omniscient off, every page is built for every company that does not publish, with its hover card,
// its command bar results and Pdoomberg's F3, and every list, entity, recap, news, headline and
// province page and every Pdoomberg function page once, on a fresh world and again after the first
// quarter's recap. All their text (every title, label and span, every row of every table, every
// value a chart's readout can show) is scanned for any true private value: the Omniscient value of a
// figure the screen shows as a band, formatted every way the UI formats a figure. The test fails if
// one shows. It also checks every band of a subject's view rows against its truth: strictly inside,
// and no money end that reads as the truth.
//
// The view leak test (packages/sim/test/views/leak.slow.test.ts) already proves no view holds a truth.
// This one checks what the UI makes of the views: a sum, a ratio or a rounding that lands on a
// truth, or a band end printed like it. It reads the pages as data (PageDoc, the cards, the
// Pdoomberg and command bar models), as m9_leak.rs read the Bevy tree's texts and table models
// rather than pixels; every page the web app draws from a doc is drawn from exactly that data.
//
// The truth comes from an Omniscient twin of the same state: its save loaded into a debug Sim (D961),
// Omniscient on, saved and loaded again so every view is built with it. The scanned state is the
// same save loaded into a plain Sim, every banded company on its watchlist (so F2 and the recap list
// them), since a load rebuilds every view at the current tick and both builds must match.
//
// Run on the 2020 world (m9_leak.rs's) and on the default 1995 world, each fresh and after its first
// quarter's recap.
//
// The map (m9_leak.rs M8, D701, D705), from the layer the map draws (`mapLayersViewLayer` on the
// plain views) and the pure helpers it draws with, on both states: every mode (Political, each
// development track, the Industry track, every industry's assets, the HQ pins unfiltered, listed,
// private, by each industry and by each HQ country, and the zones) has its bar and legend texts
// (`legendDoc`) and hub labels scanned (an HQ mode as about every banded company; any other as about
// no subject: an industry heat map's printed stops are its own scale, a function of the shown
// values, so the scale is checked raw); every HQ pin's size is the plain row's shown revenue, never
// the twin's truth, and its diameter (`pinLayout`) follows it; every industry heat value of a
// province with a banded unit is the sum of the shown unit assets, never the twin's true sum, its
// colour (`layerColors`) follows it, and the scale's top is the shown values'; with a canary for
// the pins and the heat. Every zone's hover card (`zoneHoverCard`, at its hub) is scanned as about
// every banded company. The map's province hover card is the Province card, scanned above.
//
// Not ported, with the reason:
// - The map's place labels: names only, from v_places and v_map_static, no figure.
// - Each Company tab alone. The doc holds every section and a tab only folds the others (D481), so
//   scanning the whole doc covers every tab.
// - The Settings page: it reads no view.
// - The statements' bands against the archive, period by period: the view leak test's check 2.

import {
  DEV_TRACK_VALUES,
  type Figure,
  type IndustryId,
  type MapLayer,
  type MapMode,
  mapLayersViewLayer,
  mapModeName,
  type Quarter,
  recapTick,
  type Sim,
  simNew,
  type ViewName,
} from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { loadWorld, worldDataDir } from "@tc20ff/sim-data/node";
import { afterAll, describe, expect, it } from "vitest";
import { type Card, card, zoneHoverCard } from "../../src/links/cards.ts";
import { buildNameIndex, LIST_PAGES, type NameIndex } from "../../src/links/names.ts";
import { layerColors, scalarColor, unitOf } from "../../src/map/colors.ts";
import { legendDoc } from "../../src/map/legend.ts";
import { DEFAULT_MODE_STATE, hqCountries, listedLabel, MODE_KINDS, modeOf } from "../../src/map/modes.ts";
import { hubLabel, PIN_MAX_PX, PIN_MIN_PX, pinLayout, pinPx } from "../../src/map/pins.ts";
import {
  bps,
  type ChartModel,
  chartTexts,
  docBlocks,
  docFields,
  docLinks,
  docSpans,
  type PageDoc,
  spanShown,
  type TableDoc,
} from "../../src/pages/doc.ts";
import { industriesTable } from "../../src/pages/kinds/industries.tsx";
import { feedNote, newsModel } from "../../src/pages/kinds/news.tsx";
import { type PageRef, pageId, setProvinceKeys } from "../../src/pages/ref.ts";
import { pageSpecOf } from "../../src/pages/registry.ts";
import { type ViewsData, viewsData } from "../../src/pages/views.ts";
import {
  bondsNote,
  chartNote,
  dailyChart,
  filingsNote,
  filingsTable,
  quotesTable,
  ratingSpreadsTable,
  ratingsStrip,
  ratingsTable,
  screenerTable,
  securityText,
  sovereignsTable,
  weeklyChart,
  zoneSpreadsTable,
} from "../../src/pdoomberg/models.ts";
import { buildEntries, makeFuse, search } from "../../src/shell/CommandBar.tsx";
import { display, fixed, gain, money, number, percent, price, ratio } from "../../src/widgets/cells.ts";
import { worldMini } from "../world-mini.ts";

/** The bench's world (D459): seed 1. */
const SEED = 1;
/** Leaks printed before the test fails. */
const SHOWN = 40;
/** A money truth this large or more must not read like a band end (m9_leak.rs `close_ends`). */
const CLOSE_END_MIN = 1e6;
/** Headlines whose pages are scanned, newest first. */
const HEADLINES = 20;

afterAll(() => setProvinceKeys(null));

// ---- Numbers in text and in views ----

const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
const isWordChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_]/.test(c);
const WORD_START = new Set([" ", "(", "[", ":", "/", "\t"]);
const SUFFIX = new Set(["T", "B", "M", "K", "%", "x"]);

/**
 * The number-like tokens of a screen text with their spans: an optional sign (only at the start of
 * a word, so the hyphen of a band "$1.20M-$1.80M" is a separator), an optional "$", digits with
 * commas and a point, and a unit suffix (T, B, M, K, %, x, or " bps").
 */
function spans(s: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  while (i < s.length) {
    const wordStart = i === 0 || WORD_START.has(s[i - 1] as string);
    let j = i;
    if (wordStart && (s[j] === "+" || s[j] === "-")) j++;
    if (s[j] === "$") j++;
    const digits = j;
    while (j < s.length && (isDigit(s[j]) || s[j] === "," || s[j] === ".")) j++;
    // Inside a word (F3, Q1, x2): not a figure.
    const inWord = i > 0 && isWordChar(s[i - 1]);
    if (j > digits && isDigit(s[digits]) && !inWord) {
      if (j < s.length && SUFFIX.has(s[j] as string)) j++;
      let end = i + s.slice(i, j).replace(/[,.]+$/, "").length;
      // Basis points carry their unit as a word: "245 bps".
      if (end === j && s.startsWith(" bps", j)) {
        end += 4;
        j = end;
      }
      out.push([i, end]);
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

/** The number-like tokens of a screen text. */
function tokens(s: string): string[] {
  return spans(s).map(([a, b]) => s.slice(a, b));
}

/**
 * The tokens that stand as a figure of their own: not the end of an estimate band ("low-high",
 * "low to high", and the guidance's "low to high to low to high"). A band's ends are never a
 * truth: every view band holds its truth strictly inside (checked here, D422), and a band the UI
 * derives from one keeps it inside (D430), so an end that renders like some other figure's truth
 * is a coincidence.
 */
function figureTokens(s: string): string[] {
  const sp = spans(s);
  const gap = (a: number, b: number) =>
    s.slice((sp[a] as [number, number])[1], (sp[b] as [number, number])[0]);
  const bandGap = (g: string) => g === "-" || g === " to ";
  const joined = (k: number) =>
    (k > 0 && bandGap(gap(k - 1, k))) || (k + 1 < sp.length && bandGap(gap(k, k + 1)));
  return sp.filter((_, k) => !joined(k)).map(([a, b]) => s.slice(a, b));
}

/**
 * Every way the UI writes a figure `x` (cells.ts: each unit and the gains; a chart's two-decimal
 * Number; basis points; a figure is never a count), leaving out renderings with no non-zero digit
 * ("$0", "0.0%"): those say nothing.
 */
function renderings(x: number): string[] {
  const out = [
    money(x),
    price(x),
    percent(x),
    ratio(x),
    number(x),
    gain(x, "percent"),
    gain(x, "money"),
    gain(x, "price"),
    fixed(x, 2),
  ];
  if (Math.abs(x) < 1) out.push(bps(x));
  return out.filter((r) => /[1-9]/.test(r));
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const isFigure = (x: unknown): x is Figure =>
  isRecord(x) && (x.kind === "Exact" || x.kind === "Band") && ("value" in x || "band" in x);

/** Every finite number in a view value, depth first. */
function numbers(x: unknown, out: number[] = []): number[] {
  if (typeof x === "number") {
    if (Number.isFinite(x)) out.push(x);
  } else if (Array.isArray(x)) {
    for (const e of x) numbers(e, out);
  } else if (isRecord(x)) {
    for (const v of Object.values(x)) numbers(v, out);
  }
  return out;
}

// ---- The subjects: companies that do not publish, and estimated industries ----

/** One subject's view entries as (label, value), the same labels in both builds. */
type Entries = [string, unknown][];

function companyEntries(v: ViewsData, id: number): Entries {
  const out: Entries = [];
  const one = (label: string, x: unknown) => out.push([label, x ?? null]);
  one(
    "row",
    v.company_rows?.rows.find((r) => r.id === id),
  );
  one(
    "detail",
    v.company_detail?.companies.find((c) => c.id === id),
  );
  for (const u of v.units?.units ?? []) if (u.company === id) one(`unit ${u.id}`, u);
  one(
    "tech",
    v.tech?.companies.find((t) => t.company === id),
  );
  one(
    "rating",
    v.ratings?.companies.find((r) => r.id === id),
  );
  one(
    "filings",
    v.filings?.filings.filter((f) => f.company === id),
  );
  one(
    "projection",
    v.projection?.companies.find((p) => p.id === id),
  );
  for (const q of v.recap?.recaps ?? []) {
    const qn = `${q.world.quarter.year}Q${q.world.quarter.q}`;
    one(
      `recap ${qn}`,
      q.companies.find((c) => c.company === id),
    );
    const expected = [...q.world.expected_beats, ...q.world.expected_misses].filter((e) => e.company === id);
    for (const [i, e] of expected.entries()) one(`expected ${qn} ${i}`, e);
  }
  for (const b of v.births?.births ?? []) if (b.id === id) one("birth", b);
  for (const l of v.births?.listings ?? []) if (l.id === id) one("listing", l);
  for (const d of v.industry_detail?.industries ?? [])
    for (const c of d.companies) if (c.company === id) one(`industry ${d.id}`, c);
  // Last: its shape differs (the archive when Omniscient, estimates when not), so its figures are
  // truths but it is not paired figure by figure.
  one(
    "statements",
    v.statements?.companies.find((s) => s.id === id),
  );
  return out;
}

function industryEntries(v: ViewsData, id: number): Entries {
  return [
    ["row", v.industry_rows?.rows.find((r) => r.id === id) ?? null],
    ["detail", v.industry_detail?.industries.find((d) => d.id === id) ?? null],
  ];
}

/** Views whose figures are public and may sit on any page: their numbers are not leaks. */
const CONTEXT: readonly ViewName[] = ["countries", "zones", "rates", "cycle", "clock"];

/**
 * Spec 5.18's listing headline, "[Name] lists on [exchange code] at $[price], raising $[net]M": the
 * net raise is public, though the new listing's statements show the cash it brought as a band until
 * its first release.
 */
const LISTING_RAISE = / lists on .* raising (\$[\d.,]+M)$/;

/** The renderings public text holds: each listing's net raise as its headline prints it. */
function publicTexts(v: ViewsData): string[] {
  const out: string[] = [];
  for (const h of v.news?.feed ?? []) {
    const m = LISTING_RAISE.exec(h.text);
    if (m?.[1]) out.push(m[1]);
  }
  return out;
}

interface Truths {
  /**
   * Each subject's true renderings (keyed by pageId): the Omniscient numbers its observer entries
   * do not hold, less every rendering of the numbers they (and the public context) do hold. Each
   * maps to the true value and the entry it came from (for the report).
   */
  hidden: Map<string, Map<string, [number, string]>>;
  /**
   * Every company's and industry's own renderings (keyed by pageId), banded or not: what its
   * entries show. A token a screen shows of its own subject is that subject's figure, so it is not
   * read as another subject's truth that happens to render alike.
   */
  own: Map<string, Set<string>>;
  /** Company and industry names, for rows that name a subject without a link. */
  names: Map<string, PageRef>;
  bands: number;
  unpaired: string[];
  badBands: string[];
  /** Money bands with an end that renders like the truth (m9_leak.rs `close_ends`). */
  closeEnds: string[];
}

/** Every band of `shown` against the exact figure at the same place in `truth`. */
function pairBands(t: Truths, what: string, shown: unknown, truth: unknown): void {
  if (isFigure(shown) && isFigure(truth)) {
    if (shown.kind !== "Band" || truth.kind !== "Exact") return;
    t.bands++;
    const { low, high } = shown.band;
    const x = truth.value;
    if (!(low < x && x < high)) t.badBands.push(`${what}: ${low} < ${x} < ${high}`);
    const m = money(x);
    if (Math.abs(x) >= CLOSE_END_MIN && (money(low) === m || money(high) === m))
      t.closeEnds.push(`${what}: ${low} < ${x} < ${high}`);
    return;
  }
  if (Array.isArray(shown) && Array.isArray(truth)) {
    if (shown.length !== truth.length) {
      t.unpaired.push(`${what}: ${shown.length} vs ${truth.length}`);
      return;
    }
    for (const [i, s] of shown.entries()) pairBands(t, `${what}[${i}]`, s, truth[i]);
    return;
  }
  if (isRecord(shown) && isRecord(truth))
    for (const k of Object.keys(shown)) pairBands(t, `${what}.${k}`, shown[k], truth[k]);
}

function addSubject(t: Truths, page: PageRef, shown: Entries, truth: Entries | null, pub: Set<string>): void {
  const shownNums = numbers(shown.map(([, x]) => x));
  const shownSet = new Set(shownNums);
  const own = new Set(shownNums.flatMap(renderings));
  t.own.set(pageId(page), own);
  if (truth === null) return;
  const legit = new Set([...pub, ...own]);
  const hidden = new Map<string, [number, string]>();
  for (const [label, x] of truth) {
    for (const n of numbers(x)) {
      if (n === 0 || shownSet.has(n)) continue;
      for (const r of renderings(n)) if (!legit.has(r) && !hidden.has(r)) hidden.set(r, [n, label]);
    }
  }
  shown.forEach(([label, s], i) => {
    if (label !== "statements") pairBands(t, `${pageId(page)} ${label}`, s, truth[i]?.[1]);
  });
  if (hidden.size > 0) t.hidden.set(pageId(page), hidden);
}

/** The truths of every banded company and industry of `n`, from its Omniscient twin `o`. */
function truthsOf(n: ViewsData, o: ViewsData): Truths {
  const t: Truths = {
    hidden: new Map(),
    own: new Map(),
    names: new Map(),
    bands: 0,
    unpaired: [],
    badBands: [],
    closeEnds: [],
  };
  const pub = new Set([...numbers(CONTEXT.map((k) => n[k])).flatMap(renderings), ...publicTexts(n)]);
  for (const r of n.company_rows?.rows ?? []) {
    const page: PageRef = { kind: "company", id: r.id };
    t.names.set(r.name, page);
    addSubject(t, page, companyEntries(n, r.id), r.estimated ? companyEntries(o, r.id) : null, pub);
  }
  for (const r of n.industry_rows?.rows ?? []) {
    const page: PageRef = { kind: "industry", id: r.id };
    t.names.set(r.name, page);
    addSubject(t, page, industryEntries(n, r.id), r.estimated ? industryEntries(o, r.id) : null, pub);
  }
  return t;
}

// ---- Screens ----

/** A table row: its cells' texts and the pages it links to or names. */
interface Row {
  cells: string[];
  links: PageRef[];
}

/** What one screen shows: its loose texts, the pages they link to, and its table rows. */
interface Screen {
  texts: string[];
  links: PageRef[];
  rows: Row[];
}

const emptyScreen = (): Screen => ({ texts: [], links: [], rows: [] });

function addTable(s: Screen, table: TableDoc, names: Map<string, PageRef>): void {
  s.texts.push(...table.columns.map((c) => c.title));
  for (const r of table.rows) {
    const cells = r.map(display);
    const links: PageRef[] = [];
    for (const c of r) if (c.k === "link") links.push(c.page);
    for (const text of cells) {
      const p = names.get(text);
      if (p) links.push(p);
    }
    s.rows.push({ cells, links });
  }
}

function addChart(s: Screen, chart: ChartModel): void {
  s.texts.push(chart.title, ...chart.labels, ...chartTexts(chart));
}

/** A page doc: every text it shows, its links, and every row of its tables. */
function docScreen(d: PageDoc, v: ViewsData, names: Map<string, PageRef>): Screen {
  const s = emptyScreen();
  s.texts.push(d.title, d.kind, ...docFields(d).map((f) => f.label));
  for (const sp of docSpans(d)) {
    s.texts.push(spanShown(sp, v).text);
    if (sp.k === "link") s.links.push(sp.page);
    else if (sp.k === "cell" && sp.cell.k === "link") s.links.push(sp.cell.page);
  }
  for (const b of docBlocks(d)) {
    if (b.k === "table") addTable(s, b.table, names);
    else if (b.k === "chart") addChart(s, b.chart);
    else if (b.k === "heading") s.texts.push(b.text);
  }
  return s;
}

function cardScreen(c: Card): Screen {
  const s = emptyScreen();
  s.texts.push(c.title, c.kind);
  for (const l of c.lines) {
    s.texts.push(l.label, l.value);
    if (l.link) s.links.push(l.link);
  }
  return s;
}

/** A screen of loose texts, tables and charts (Pdoomberg's function pages, the News page). */
function partsScreen(
  names: Map<string, PageRef>,
  texts: string[],
  tables: TableDoc[] = [],
  charts: (ChartModel | null)[] = [],
): Screen {
  const s = emptyScreen();
  s.texts.push(...texts);
  for (const t of tables) addTable(s, t, names);
  for (const c of charts) if (c) addChart(s, c);
  return s;
}

/** One leak: where, whose truth, the rendering and the text it is in. */
type Leak = string;

/**
 * Checks a screen: its loose texts against the truths of the subject it is about (or, on a page
 * about no banded subject, a list or a function page, of every subject it links to); each table
 * row against the truths of `about` and of the first subject the row links to or names (a
 * company's row links its industry and country too, whose figures are not in it). A token that is
 * one of the screen's own subjects' shown figures (`Truths.own`: the page's subject, and a row's
 * first link) is that figure, not a truth.
 */
function check(t: Truths, what: string, about: readonly PageRef[], s: Screen, leaks: Leak[]): void {
  const find = (subjects: readonly PageRef[], owners: readonly PageRef[], texts: readonly string[]) => {
    const own = owners.map((p) => t.own.get(pageId(p))).filter((o) => o !== undefined);
    for (const id of new Set(subjects.map(pageId))) {
      const h = t.hidden.get(id);
      if (!h) continue;
      for (const text of texts)
        for (const tok of figureTokens(text)) {
          const hit = h.get(tok);
          if (hit && !own.some((o) => o.has(tok)))
            leaks.push(`${what}: ${id}'s true ${tok} (${hit[0]}, ${hit[1]}) in ${JSON.stringify(text)}`);
        }
    }
  };
  if (about.some((p) => t.hidden.has(pageId(p)))) find(about, about, s.texts);
  else find(s.links, about, s.texts);
  for (const r of s.rows) {
    const subjects = [...about, ...r.links.slice(0, 1)];
    find(subjects, subjects, r.cells);
  }
}

/**
 * The scan finds a truth that is on screen: one of `page`'s true renderings written into a screen
 * about it, and into a table row that links it on a screen about nothing, is reported.
 */
function canary(t: Truths, page: PageRef): void {
  const h = t.hidden.get(pageId(page));
  const truth = h && [...h.keys()].find((k) => k.startsWith("$"));
  if (!truth) throw new Error(`${pageId(page)} has true renderings`);
  const found: Leak[] = [];
  check(t, "canary", [page], { texts: [`Revenue ${truth}`], links: [], rows: [] }, found);
  expect(
    found.some((l) => l.includes(truth)),
    `the canary ${truth}: ${found}`,
  ).toBe(true);
  const row: Leak[] = [];
  check(
    t,
    "canary row",
    [],
    { texts: [], links: [], rows: [{ cells: ["canary", truth], links: [page] }] },
    row,
  );
  expect(
    row.some((l) => l.includes(truth)),
    `the canary row ${truth}: ${row}`,
  ).toBe(true);
}

// ---- The states ----

interface World {
  label: string;
  data: WorldData;
  /** The first quarter, whose recap the second state is past. */
  q1: Quarter;
  /**
   * The least the scan must cover in each state, so a scan that found nothing to check fails: banded
   * companies, subjects with a truth, bands checked, and banded HQ pins and heat values on the map.
   */
  min: { banded: number; subjects: number; bands: number; pins: number; heat: number };
}

function loaded(dir: string): WorldData {
  const r = loadWorld(dir);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

function newSim(data: WorldData, debug = false): Sim {
  const made = simNew(data, SEED, { debug });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  return made.value;
}

function ok<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

/** The companies whose figures are bands in `v`. */
const banded = (v: ViewsData) => (v.company_rows?.rows ?? []).filter((r) => r.estimated).map((r) => r.id);

/**
 * The scanned state and its truth: `sim`'s save loaded into a plain Sim with every banded company
 * watched, and into a debug Sim with Omniscient on, saved and loaded again.
 */
function builds(w: World, sim: Sim): { n: ViewsData; o: ViewsData } {
  const plain = newSim(w.data);
  ok(plain.loadBytes(sim.saveBytes()));
  for (const c of banded(viewsData(plain.views()))) ok(plain.apply({ kind: "WatchlistAdd", company: c }));
  expect(plain.controls().omniscient).toBe(false);
  const twin = newSim(w.data, true);
  ok(twin.loadBytes(plain.saveBytes()));
  ok(twin.apply({ kind: "SetOmniscient", on: true }));
  ok(twin.loadBytes(twin.saveBytes()));
  expect(twin.controls().omniscient).toBe(true);
  return { n: viewsData(plain.views()), o: viewsData(twin.views()) };
}

/** The doc of `page` from its registered builder; null for a page drawn by a component. */
function pageDoc(page: PageRef, v: ViewsData, index: NameIndex): PageDoc | null {
  const spec = pageSpecOf(page.kind);
  return spec?.doc ? spec.doc(page as never, v, index) : null;
}

/** Scans every screen of one state; returns how many it read. */
function scanState(label: string, v: ViewsData, t: Truths, leaks: Leak[]): number {
  const index = buildNameIndex(v);
  const names = t.names;
  const private_ = banded(v);
  const entries = buildEntries(index);
  const fuse = makeFuse(entries);
  let screens = 0;
  const read = (what: string, about: readonly PageRef[], s: Screen) => {
    check(t, `${label} ${what}`, about, s, leaks);
    screens++;
  };
  const linked = new Map<string, PageRef>();
  for (const c of private_) {
    const page: PageRef = { kind: "company", id: c };
    const about = [page];
    const d = pageDoc(page, v, index);
    if (!d) throw new Error("the Company page is a doc");
    for (const l of docLinks(d)) linked.set(pageId(l), l);
    read(pageId(page), about, docScreen(d, v, names));
    read(`card ${pageId(page)}`, about, cardScreen(card(page, v, index)));
    const results = search(fuse, entries, index.title(page), index);
    expect(results.length, `the bar finds ${index.title(page)}`).toBeGreaterThan(0);
    const bar = emptyScreen();
    for (const e of results) bar.texts.push(e.label, e.detail);
    read(`command ${pageId(page)}`, about, bar);
    read(
      `F3 ${pageId(page)}`,
      about,
      partsScreen(
        names,
        [chartNote(v, c), securityText(v, index, c)],
        [],
        [dailyChart(v, c), weeklyChart(v, c)],
      ),
    );
  }
  // Every other page: the lists, every industry, zone, exchange, event and recap, the countries and
  // industries the company pages link to, the newest headlines, and the province of every banded
  // company's HQ and unit.
  const pages = new Map<string, PageRef>();
  const add = (p: PageRef) => pages.set(pageId(p), p);
  for (const p of LIST_PAGES) if (p.kind !== "settings") add(p);
  add({ kind: "politics" });
  add({ kind: "world-history" });
  for (const e of index.entries)
    if (["industry", "zone", "exchange", "event", "recap"].includes(e.page.kind)) add(e.page);
  for (const q of v.recap?.recaps ?? []) add({ kind: "recap", quarter: q.world.quarter });
  for (const p of linked.values()) if (p.kind === "country" || p.kind === "industry") add(p);
  for (const h of (v.news?.feed ?? []).slice(-HEADLINES)) add({ kind: "headline", id: h.id });
  const isPrivate = new Set<number>(private_);
  for (const c of v.company_detail?.companies ?? [])
    if (isPrivate.has(c.id)) add({ kind: "province", id: c.hq_province });
  for (const u of v.units?.units ?? [])
    if (isPrivate.has(u.company)) add({ kind: "province", id: u.base_province });
  for (const page of pages.values()) {
    const about = [page];
    if (page.kind === "news") {
      read(pageId(page), about, partsScreen(names, [feedNote(v)], [newsModel(v, index, {})]));
    } else {
      const d = pageDoc(page, v, index);
      if (!d) throw new Error(`${pageId(page)} has no doc`);
      read(pageId(page), about, docScreen(d, v, names));
    }
    read(`card ${pageId(page)}`, about, cardScreen(card(page, v, index)));
  }
  // Pdoomberg's function pages with no company loaded (F3's is per company above; F4 is a lock).
  const functions: [string, Screen][] = [
    ["F2", partsScreen(names, [], [quotesTable(v, index, {})])],
    ["F5", partsScreen(names, [filingsNote(v)], [filingsTable(v, index)])],
    ["F6", partsScreen(names, [ratingsStrip(v)], [ratingsTable(v, index)])],
    [
      "F7",
      partsScreen(
        names,
        [bondsNote(v)],
        [zoneSpreadsTable(v, index), sovereignsTable(v, index), ratingSpreadsTable(v)],
      ),
    ],
    ["F9", partsScreen(names, [], [industriesTable(v, index, "pdb.f9")])],
    ["F10", partsScreen(names, [], [screenerTable(v, index, {})])],
  ];
  for (const [f, s] of functions) read(`pdoomberg ${f}`, [], s);
  return screens;
}

// ---- The map (m9_leak.rs M8, D701, D705) ----

/** A figure as the views show it: the exact value, or a band's estimate (sim `figureShown`). */
const shown = (f: Figure): number => (f.kind === "Exact" ? f.value : f.band.estimate);

function layersOf(v: ViewsData): NonNullable<ViewsData["map_layers"]> {
  if (!v.map_layers) throw new Error("v_map_layers is built");
  return v.map_layers;
}

/**
 * Every mode the scan shows (m9_leak.rs `scan_modes`): each development track, the Industry track
 * and every industry's assets, the HQ pins unfiltered, listed, private, by each industry and by
 * each HQ country, and the zones.
 */
function scanModes(v: ViewsData): MapMode[] {
  const l = layersOf(v);
  const industries = l.industry_names.map((_, i) => i as IndustryId);
  const hq = DEFAULT_MODE_STATE.hq;
  return [
    { kind: "Political" },
    ...DEV_TRACK_VALUES.map((track): MapMode => ({ kind: "Development", track })),
    { kind: "Industry", industry: null },
    ...industries.map((industry): MapMode => ({ kind: "Industry", industry })),
    ...[null, true, false].map((listed): MapMode => ({ kind: "CompanyHqs", filter: { ...hq, listed } })),
    ...industries.map((industry): MapMode => ({ kind: "CompanyHqs", filter: { ...hq, industry } })),
    ...hqCountries(l).map((country): MapMode => ({ kind: "CompanyHqs", filter: { ...hq, country } })),
    { kind: "FinancialZones" },
  ];
}

/** The layer the map draws for `mode` (ProvinceMap: the zones mode reads v_cycle and v_exchanges too). */
function layerOf(v: ViewsData, mode: MapMode): MapLayer {
  const z =
    mode.kind === "FinancialZones" && v.cycle && v.exchanges ? ([v.cycle, v.exchanges] as const) : null;
  return mapLayersViewLayer(layersOf(v), mode, z);
}

/** The mode bar's texts (MapOverlays `ModeBar`): the modes, Metros, then the mode's parameter. */
function barTexts(v: ViewsData, mode: MapMode): string[] {
  const l = layersOf(v);
  const out = [...MODE_KINDS.map((k) => mapModeName(modeOf(DEFAULT_MODE_STATE, k))), "Metros"];
  const industry = (i: IndustryId | null, none: string) => (i === null ? none : (l.industry_names[i] ?? ""));
  if (mode.kind === "Development") out.push(...DEV_TRACK_VALUES);
  else if (mode.kind === "Industry") out.push("Show", industry(mode.industry, "Industry track"));
  else if (mode.kind === "CompanyHqs") {
    const c = mode.filter.country;
    out.push(
      "Industry",
      industry(mode.filter.industry, "All"),
      "Country",
      c === null ? "All" : (v.places?.countries[c]?.name ?? ""),
      listedLabel(mode.filter.listed),
    );
  }
  return out;
}

/** The map node: the bar, the legend as `legendDoc` writes it (Metros on, its longest), the hub labels and the HQ pins' links. */
function mapScreen(v: ViewsData, layer: MapLayer): Screen {
  const s = emptyScreen();
  const doc = legendDoc(layer, true);
  s.texts.push(...barTexts(v, layer.mode), doc.title, ...doc.rows.map(([, text]) => text));
  for (const p of layer.pins) {
    if (p.target.kind === "Exchange") s.texts.push(hubLabel(p));
    else s.links.push({ kind: "company", id: p.target.company });
  }
  return s;
}

/** What the map checks counted, and what they found wrong that is not a leak (a broken invariant). */
interface MapStats {
  modes: number;
  pins: number;
  heat: number;
  zoneCards: number;
  wrong: string[];
}

/**
 * Every HQ pin is sized by the revenue the views show (D701): its size is the plain row's shown
 * revenue, never the Omniscient truth of a banded company, and its diameter (`pinLayout`) follows
 * it. Between the smallest and largest pin the diameter grows strictly with the revenue, so a
 * diameter equal to the truth's would be sized by it. Returns how many banded pins it checked.
 */
function checkPins(
  what: string,
  layer: MapLayer,
  n: ViewsData,
  o: ViewsData,
  leaks: Leak[],
  m: MapStats,
): number {
  const rows = new Map((n.company_rows?.rows ?? []).map((r) => [r.id as number, r]));
  const truth = new Map((o.company_rows?.rows ?? []).map((r) => [r.id as number, r]));
  let checked = 0;
  for (const p of layer.pins) {
    if (p.target.kind !== "Company") continue;
    const id = p.target.company;
    const r = rows.get(id);
    if (!r) {
      m.wrong.push(`${what}: company ${id}'s pin has no row`);
      continue;
    }
    if (p.size !== shown(r.revenue_ttm))
      m.wrong.push(`${what}: ${r.name}'s pin is ${p.size}, its row shows ${shown(r.revenue_ttm)}`);
    if (!r.estimated) continue;
    const t = truth.get(id)?.revenue_ttm;
    if (t?.kind !== "Exact") {
      m.wrong.push(`${what}: the twin's revenue of ${r.name} is not exact`);
      continue;
    }
    const d = pinPx(t.value);
    const clamped = d <= PIN_MIN_PX || d >= PIN_MAX_PX;
    if (p.size === t.value || (pinPx(p.size) === d && !clamped))
      leaks.push(`${what}: ${r.name}'s pin is sized by its true revenue ${t.value}`);
    checked++;
  }
  for (const pp of pinLayout(layer.pins))
    if (pp.pin.target.kind === "Company" && pp.diameter !== pinPx(pp.pin.size))
      m.wrong.push(
        `${what}: company ${pp.pin.target.company}'s pin is ${pp.diameter} px, not ${pinPx(pp.pin.size)}`,
      );
  return checked;
}

/**
 * An industry heat map colours a province by its units' assets as shown (D701): each value is the
 * sum of the province's units' gross assets as v_units shows them; where a banded unit is, never
 * the true sum (the Omniscient twin's layer), and its colour (`layerColors`) is the shown value's.
 * The legend's scale is the shown values' (its top their largest), never the truth's. Returns how
 * many banded provinces it checked.
 */
function checkHeat(
  what: string,
  layer: MapLayer,
  i: IndustryId,
  n: ViewsData,
  o: ViewsData,
  leaks: Leak[],
  m: MapStats,
): number {
  const truthLayer = layerOf(o, layer.mode);
  const scale = layer.scale;
  if (layer.values.kind !== "Scalars" || truthLayer.values.kind !== "Scalars" || scale === null)
    throw new Error(`${what}: a heat map`);
  const vals = layer.values.values;
  const truth = truthLayer.values.values;
  const sums: number[] = new Array<number>(vals.length).fill(0);
  const banded = new Set<number>();
  for (const u of n.units?.units ?? []) {
    if (u.industry !== i) continue;
    sums[u.base_province] = (sums[u.base_province] as number) + Math.max(shown(u.gross_assets), 0);
    if (u.gross_assets.kind === "Band") banded.add(u.base_province);
  }
  sums.forEach((x, p) => {
    if (Math.fround(x) !== vals[p]) m.wrong.push(`${what}: province ${p} is ${vals[p]}, its units show ${x}`);
  });
  const colors = layerColors(layer, vals.length);
  for (const p of banded) {
    const x = vals[p] as number;
    const tx = truth[p] as number;
    if (x === tx && tx !== 0) leaks.push(`${what}: province ${p} is coloured by its true assets ${tx}`);
    const c = scalarColor(layer.style, layer.mode, unitOf(scale, x));
    if (colors[p * 3] !== c[0] || colors[p * 3 + 1] !== c[1] || colors[p * 3 + 2] !== c[2])
      m.wrong.push(`${what}: province ${p}'s colour is not its shown value's`);
  }
  const top = vals.reduce((a, x) => Math.max(a, x), 0);
  if (Math.fround(scale.high) !== top) m.wrong.push(`${what}: the scale's top ${scale.high} is not ${top}`);
  const trueTop = truth.reduce((a, x) => Math.max(a, x), 0);
  const atTop = vals.indexOf(top);
  if (atTop >= 0 && banded.has(atTop) && Math.fround(scale.high) === trueTop)
    leaks.push(`${what}: the legend's top is the true ${trueTop}`);
  return banded.size;
}

/**
 * The map checks find a truth: a banded pin sized by its true revenue and a banded province
 * coloured by its true assets are reported.
 */
function mapCanary(n: ViewsData, o: ViewsData, private_: readonly number[]): void {
  const pins = layerOf(n, { kind: "CompanyHqs", filter: { ...DEFAULT_MODE_STATE.hq, listed: false } });
  const isPrivate = new Set(private_);
  const k = pins.pins.findIndex((p) => p.target.kind === "Company" && isPrivate.has(p.target.company));
  const pin = pins.pins[k];
  if (!pin || pin.target.kind !== "Company") throw new Error("a banded HQ pin");
  const id = pin.target.company;
  const t = o.company_rows?.rows.find((r) => r.id === id)?.revenue_ttm;
  if (t?.kind !== "Exact") throw new Error("the twin's revenue is exact");
  const m: MapStats = { modes: 0, pins: 0, heat: 0, zoneCards: 0, wrong: [] };
  const found: Leak[] = [];
  checkPins("pin canary", { ...pins, pins: [{ ...pin, size: t.value }] }, n, o, found, m);
  expect(found.length, `the pin canary: ${found}`).toBe(1);
  const unit = (n.units?.units ?? []).find((u) => u.gross_assets.kind === "Band");
  if (!unit) throw new Error("a banded unit");
  const mode: MapMode = { kind: "Industry", industry: unit.industry };
  const heat = layerOf(n, mode);
  const truth = layerOf(o, mode);
  const heatFound: Leak[] = [];
  checkHeat("heat canary", { ...heat, values: truth.values }, unit.industry, n, o, heatFound, m);
  expect(
    heatFound.some((l) => l.includes(`province ${unit.base_province} `)),
    `the heat canary: ${heatFound}`,
  ).toBe(true);
}

/** Scans the map's screens of one state (D705) and checks its pins and heat values. */
function scanMap(label: string, n: ViewsData, o: ViewsData, t: Truths, leaks: Leak[]): MapStats {
  const index = buildNameIndex(n);
  const private_ = banded(n);
  const everyPrivate: PageRef[] = private_.map((id) => ({ kind: "company", id }));
  const m: MapStats = { modes: 0, pins: 0, heat: 0, zoneCards: 0, wrong: [] };
  mapCanary(n, o, private_);
  for (const mode of scanModes(n)) {
    const what = `${label} map ${JSON.stringify(mode)}`;
    const layer = layerOf(n, mode);
    // The HQ modes are about every banded company they pin; any other as about no subject (D705).
    check(t, what, mode.kind === "CompanyHqs" ? everyPrivate : [], mapScreen(n, layer), leaks);
    if (mode.kind === "Industry" && mode.industry !== null)
      m.heat += checkHeat(what, layer, mode.industry, n, o, leaks, m);
    m.pins += checkPins(what, layer, n, o, leaks, m);
    m.modes++;
  }
  // The zone hover card of every zone, at its hub (D704), as about every banded company: it shows
  // only public figures.
  for (const x of n.exchanges?.exchanges ?? []) {
    check(
      t,
      `${label} map zone card ${x.code}`,
      everyPrivate,
      cardScreen(zoneHoverCard(x.zone, x.hub_province, n, index)),
      leaks,
    );
    m.zoneCards++;
  }
  return m;
}

function scanWorld(w: World): void {
  const fresh = newSim(w.data);
  const later = newSim(w.data);
  const end = recapTick(w.q1);
  while (later.now() <= end) later.step();
  const leaks: Leak[] = [];
  const report: string[] = [];
  for (const [sim, label] of [
    [fresh, `${w.label} fresh`],
    [later, `${w.label} after the Q1 recap`],
  ] as const) {
    const { n, o } = builds(w, sim);
    const t = truthsOf(n, o);
    const first = banded(n).find((c) => t.hidden.has(pageId({ kind: "company", id: c })));
    if (first === undefined) throw new Error(`${label}: no banded company has a truth`);
    canary(t, { kind: "company", id: first });
    const screens = scanState(label, n, t, leaks);
    const map = scanMap(label, n, o, t, leaks);
    const renderingsN = [...t.hidden.values()].reduce((a, h) => a + h.size, 0);
    report.push(
      `${label}: ${screens} screens, ${banded(n).length} banded companies, ${t.hidden.size} subjects, ` +
        `${renderingsN} true renderings, ${t.bands} bands checked, ${t.unpaired.length} entries unpaired; ` +
        `map: ${map.modes} modes, ${map.pins} banded HQ pins, ${map.heat} banded heat values, ` +
        `${map.zoneCards} zone cards`,
    );
    expect(map.wrong, `${label}: the map does not draw what the views show`).toEqual([]);
    expect(map.pins, `${label}: banded HQ pins`).toBeGreaterThanOrEqual(w.min.pins);
    expect(map.heat, `${label}: banded heat values`).toBeGreaterThanOrEqual(w.min.heat);
    expect(t.badBands, `${label}: bands at or past their truth`).toEqual([]);
    expect(t.closeEnds, `${label}: band ends that read as the truth`).toEqual([]);
    expect(banded(n).length, `${label}: banded companies`).toBeGreaterThanOrEqual(w.min.banded);
    expect(t.hidden.size, `${label}: subjects`).toBeGreaterThanOrEqual(w.min.subjects);
    expect(t.bands, `${label}: bands`).toBeGreaterThanOrEqual(w.min.bands);
  }
  console.log(`UI leak scan:\n${report.join("\n")}`);
  expect(
    leaks.length,
    `true private values on screen; the first ${SHOWN}:\n${leaks.slice(0, SHOWN).join("\n")}`,
  ).toBe(0);
}

describe("no true private value on any screen (m9_leak.rs, D574)", () => {
  it("in the 2020 world", () => {
    scanWorld({
      label: "2020",
      data: loaded(worldMini().dir),
      q1: { year: 2020, q: 1 },
      min: { banded: 100, subjects: 100, bands: 1000, pins: 500, heat: 250 },
    });
  }, 600_000);

  it("in the 1995 world", () => {
    scanWorld({
      label: "1995",
      data: loaded(worldDataDir("1995")),
      q1: { year: 1995, q: 1 },
      min: { banded: 30, subjects: 40, bands: 1000, pins: 100, heat: 60 },
    });
  }, 600_000);
});

describe("the scanner (m9_leak.rs scanner_reads_every_format)", () => {
  it("splits bands, keeps signs at word starts only, and reads every rendering it makes", () => {
    expect(tokens("$12.0M-$18.0M"), "a band's hyphen is no minus").toEqual(["$12.0M", "$18.0M"]);
    expect(tokens("-$5.00M to $3.00M")).toEqual(["-$5.00M", "$3.00M"]);
    expect(tokens("F3 Q1 x2 1.23x +1.2% (12.3%)")).toEqual(["1.23x", "+1.2%", "12.3%"]);
    expect(tokens("1,234.5 and $1,234.50.")).toEqual(["1,234.5", "$1,234.50"]);
    expect(tokens("spread 245 bps, 3 seats")).toEqual(["245 bps", "3"]);
    expect(figureTokens("$1.00M, $12.0M-$18.0M, -$5.00M to $3.00M, 4.5x"), "band ends").toEqual([
      "$1.00M",
      "4.5x",
    ]);
    expect(figureTokens("-$50.5K to $410K to -$41.6K to $497K (+/-10%)")).toEqual(["-10%"]);
    for (const x of [12.345e6, -2.5e6, 0.123, 45.67, 1.5e12, 987.0])
      for (const r of renderings(x)) expect(tokens(`a ${r} b`), `${r} of ${x}`).toContain(r);
    expect(renderings(0)).toEqual([]);
    expect(numbers({ a: [1.5, { kind: "Exact", value: -2e-3 }], b: "x", c: true })).toEqual([1.5, -2e-3]);
  });
});
