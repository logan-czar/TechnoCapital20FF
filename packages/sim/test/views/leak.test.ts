// The sim-side half of crates/game/tests/m9_leak.rs (M9.8, D574): with Omniscient off, no view
// may hold a true private figure. Rust scans the game's rendered text; here the view data itself
// is scanned, which is stricter (every number, not its rounded rendering). Not a Rust file.
//
// Two builds of one state: the observer's and Omniscient's (a debug Sim, D961). Omniscient is
// toggled on and off first, so the observer's views are rebuilt at that tick too (D423), then on
// again: the two builds differ only by Omniscient.
//
// 1. The shape: every company row says `estimated` exactly when the company does not publish
//    (D420), a banded company's figures are all bands (but the compute and licences line, D434,
//    and a listed company's EFV, D140), a publishing company's all exact, and a banded company's
//    statements hold no archive (D130). A wrong flag, the likeliest leak, fails here.
// 2. The truths: walking both builds side by side, a figure that is a band for the observer and
//    exact in Omniscient gives a truth, and the band must hold it strictly inside (D422); so does
//    any plain number that differs between the builds (only private figures can, D574's rule,
//    so a future view or derived value is covered without listing it). v_statements' banded
//    companies hold estimates instead of the archive, so every line of their Omniscient
//    statements (but Shared, D434), held TB and Omniscient's posted months are truths too.
//    Values that a published figure also holds are dropped: several starting companies share
//    their starting books (company-start.csv), so a published company's 2019 lines can equal a
//    private one's by the data, not by a view.
//    So are values of public data (`PUBLIC_DATA`), and small round values (under 1,000, at most 3
//    significant digits) are not truths at all.
// 3. The scan: every number in the observer's views (every ported view) but the fields that are
//    ids, counts, shares or dates (`NOT_FIGURES`) must differ from every truth; a truth under
//    1,000 (TB, points, ratios, shares, never money) only within its own view, since across views
//    such values meet skills and weights by the data.
//
// Run on seed 1 at load and after Q1 2020's release and the Q2 recap week. A planted leak and a
// wrong flag are checked to fail (the test's own negative cases).
import { describe, expect, it } from "vitest";
import { type Sim, simApply, simNew, simViews, simWorld } from "../../src/lib.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import type { CompanyId, IndustryId } from "../../src/types/ids.ts";
import type { Statement } from "../../src/types/state/finance.ts";
import { type Figure, STATEMENT_LINE_VALUES } from "../../src/types/views/estimate.ts";
import { type SimViews, VIEW_NAMES } from "../../src/types/views/index.ts";
import type { World } from "../../src/types/world.ts";
import { showsEstimates, statementLineIndex, statementLineOf } from "../../src/views/estimate.ts";
import { simViewsClone, viewIsPorted } from "../../src/views/index.ts";
import { worldIndustryEstimatedAt } from "../../src/world/index.ts";
import { data, unwrap } from "../common/index.ts";
import { runTo } from "../common/ops.ts";

type Truths = Map<number, string>;

/** Fields that hold ids, counts, shares, dates or flags' numbers: never a figure. */
const NOT_FIGURES = new Set([
  "id",
  "company",
  "companies_count",
  "industry",
  "hq_country",
  "hq_province",
  "base_province",
  "province",
  "country",
  "zone",
  "exchange",
  "character",
  "partial_id",
  "owner_of_record",
  "founders",
  "top_companies",
  "watchlist",
  "event",
  "year",
  "month",
  "day",
  "q",
  "hour",
  "age",
  "shares",
  "shares_out",
  "labor_units",
  "buckets",
  "free_rd_pct",
  "pc_bonus",
  "distress_months",
  "frozen_quarters",
  "excess_months_left",
  "last_review_notches",
  "cover_notches",
  "rating_notches",
  "listed",
  "quoted",
  "reports",
  "beats",
  "misses",
  "now",
  "next_release",
  "days_to_next_phase",
  "provinces",
  "members",
  "skills",
  "hq",
  "volume",
  "full_characters_made",
  "full_characters",
  "births_by_industry",
  // Lists of ids.
  "industries",
  "startups",
  "hq_companies",
  "constituents",
  "hqs",
  "units",
]);

/**
 * Fields of public data: the load's world data (country-economy.csv's GDP) and the published step
 * tables (the next PC bonus step, 5.8; the next free R&D step, 5.9) and what follows the published
 * station counts (stations, PC, the compute bill, D434). A private company's round
 * starting revenue or cash can equal one by the data.
 */
const PUBLIC_DATA = new Set(["gdp_usd", "next_bonus_pc", "next_step_tb", "stations", "pc", "compute"]);

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const isFigure = (x: unknown): x is Figure =>
  isRecord(x) &&
  ((x.kind === "Exact" && typeof x.value === "number") || (x.kind === "Band" && isRecord(x.band)));

/**
 * Records a truth. Left out: 0, and a small round value (under 1,000 with at most 3 significant
 * digits: a 0.25 TB book, 1 point), which tax rates, weights and counts hold by the data; a
 * money figure is never that small, and every distinctive value stays in.
 */
function addTruth(truths: Truths, x: number, where: string): void {
  if (x === 0 || !Number.isFinite(x) || truths.has(x)) return;
  const a = Math.abs(x);
  if (a < 1000 && Number(a.toPrecision(3)) === a) return;
  truths.set(x, where);
}

/** Walks the observer's and Omniscient's builds of one view side by side (truths, 2). */
function pair(shown: unknown, truth: unknown, where: string, truths: Truths, bad: string[]): void {
  if (typeof shown === "number" && typeof truth === "number") {
    if (shown !== truth && !(Number.isNaN(shown) && Number.isNaN(truth))) addTruth(truths, truth, where);
    return;
  }
  if (Array.isArray(shown) && Array.isArray(truth)) {
    const n = Math.min(shown.length, truth.length);
    for (let i = 0; i < n; i++) pair(shown[i], truth[i], `${where}[${i}]`, truths, bad);
    return;
  }
  if (!isRecord(shown) || !isRecord(truth)) return;
  if (isFigure(shown) && isFigure(truth)) {
    if (shown.kind === "Band" && truth.kind === "Exact") {
      const b = shown.band;
      const t = truth.value;
      addTruth(truths, t, where);
      if (!(b.low < t && t < b.high && b.estimate !== t)) {
        bad.push(`${where}: ${t} not strictly in ${JSON.stringify(b)}`);
      }
    } else if (shown.kind === "Exact" && truth.kind === "Exact" && shown.value !== truth.value) {
      addTruth(truths, truth.value, where);
    }
    return;
  }
  const s = shown as Record<string, unknown>;
  const t = truth as Record<string, unknown>;
  for (const k of Object.keys(s)) pair(s[k], t[k], `${where}.${k}`, truths, bad);
}

/** The truths of v_statements' banded companies (their archive is not in the observer's view). */
function statementTruths(observer: SimViews, omniscient: SimViews, truths: Truths): void {
  observer.statements.data.companies.forEach((c, i) => {
    if (!c.estimated) return;
    const t = omniscient.statements.data.companies[i]!;
    const all: Statement[] = [...t.quarters, ...t.years];
    for (const s of all) {
      for (const l of STATEMENT_LINE_VALUES) {
        if (l !== "Shared") addTruth(truths, statementLineOf(l, s), `statements ${c.key} ${l}`);
      }
      addTruth(truths, s.key.held_tb, `statements ${c.key} held TB`);
    }
    for (const m of t.months) addTruth(truths, m.lines.revenue, `statements ${c.key} month revenue`);
  });
}

/** Every value a published figure holds: exact figures and the published statements. */
function publicValues(observer: SimViews): Set<number> {
  const out = new Set<number>();
  const walk = (x: unknown, inStatement: boolean): void => {
    if (typeof x === "number") {
      if (inStatement) out.add(x);
    } else if (Array.isArray(x)) for (const y of x) walk(y, inStatement);
    else if (isRecord(x)) {
      if (x.kind === "Exact" && typeof x.value === "number") out.add(x.value);
      else
        for (const [k, v] of Object.entries(x)) {
          if (PUBLIC_DATA.has(k)) walk(v, true);
          else walk(v, inStatement);
        }
    }
  };
  for (const n of VIEW_NAMES) if (viewIsPorted(n)) walk(observer[n].data, false);
  for (const c of observer.statements.data.companies) walk([c.quarters, c.years], true);
  return out;
}

/** Every number of a view's data that may be a figure (3), with its path. */
function numbers(x: unknown, where: string, key: string, out: [number, string][]): void {
  if (NOT_FIGURES.has(key)) return;
  if (typeof x === "number") out.push([x, where]);
  else if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) numbers(x[i], `${where}[${i}]`, key, out);
  } else if (isRecord(x)) for (const k of Object.keys(x)) numbers(x[k], `${where}.${k}`, k, out);
}

/** The figures of one row: banded rows hold only bands, the others only exact figures (1). */
function figuresShaped(
  row: Record<string, unknown>,
  banded: boolean,
  where: string,
  exactAnyway: readonly string[],
  bad: string[],
): void {
  for (const [k, f] of Object.entries(row)) {
    if (!isFigure(f)) continue;
    const want = banded && !exactAnyway.includes(k) ? "Band" : "Exact";
    if (f.kind !== want) bad.push(`${where}.${k} is ${f.kind}, wants ${want}`);
  }
}

/** The shape check (1) over the company views. */
function shape(w: World, v: SimViews): string[] {
  const bad: string[] = [];
  const pub = (id: CompanyId) => !showsEstimates(w, id);
  const flag = (where: string, estimated: boolean, id: CompanyId) => {
    if (estimated !== !pub(id)) bad.push(`${where}.estimated is ${estimated}, publishes ${pub(id)}`);
  };
  const shared = statementLineIndex("Shared");
  v.statements.data.companies.forEach((c, i) => {
    const where = `statements[${i}]`;
    flag(where, c.estimated, c.id);
    if (c.estimated && (c.quarters.length > 0 || c.years.length > 0)) bad.push(`${where} holds the archive`);
    if (!c.estimated && (c.estimated_quarters.length > 0 || c.estimated_years.length > 0)) {
      bad.push(`${where} holds estimates`);
    }
    for (const s of [...c.estimated_quarters, ...c.estimated_years]) {
      s.lines.forEach((f, l) => {
        if (f.kind !== (l === shared ? "Exact" : "Band")) bad.push(`${where} line ${l} is ${f.kind}`);
      });
      if (s.operating.held_tb.kind !== "Band") bad.push(`${where} held TB is exact`);
    }
  });
  for (const f of v.filings.data.filings) {
    flag(`filings[${f.company}]`, f.estimated, f.company);
    figuresShaped(f as never, f.estimated, `filings[${f.company}]`, [], bad);
  }
  for (const r of v.ratings.data.companies)
    figuresShaped(r as never, !pub(r.id), `ratings[${r.id}]`, [], bad);
  for (const r of v.company_rows.data.rows) {
    flag(`company_rows[${r.id}]`, r.estimated, r.id);
    // A listed company's value is its EFV, exact (D140), even before its first release.
    figuresShaped(
      r as never,
      r.estimated,
      `company_rows[${r.id}]`,
      r.exchange === null ? [] : ["value"],
      bad,
    );
  }
  for (const d of v.company_detail.data.companies) {
    flag(`company_detail[${d.id}]`, d.estimated, d.id);
    const exact = d.exchange === null ? [] : ["shown_value_per_share"];
    figuresShaped(d as never, d.estimated, `company_detail[${d.id}]`, exact, bad);
  }
  // The industry class (D432) and the unit figures it bands (D436).
  const estimatedAt = w.industries.map((_, i) => worldIndustryEstimatedAt(w, i as IndustryId, w.clock));
  const unitBanded = (c: CompanyId, i: IndustryId) => !pub(c) || estimatedAt[i]!;
  for (const u of v.units.data.units) {
    const where = `units[${u.id}]`;
    if (u.estimated !== unitBanded(u.company, u.industry)) bad.push(`${where}.estimated is ${u.estimated}`);
    figuresShaped(u as never, u.estimated, where, ["shared_m"], bad);
  }
  for (const t of v.tech.data.companies) {
    const banded = unitBanded(t.company, w.companies[t.company]!.industry);
    t.data.forEach((d, k) => {
      figuresShaped(d as never, banded, `tech[${t.company}].data[${k}]`, [], bad);
    });
  }
  for (const r of v.industry_rows.data.rows) {
    const where = `industry_rows[${r.id}]`;
    if (r.estimated !== estimatedAt[r.id]) bad.push(`${where}.estimated is ${r.estimated}`);
    figuresShaped(r as never, r.estimated, where, r.demand > 0 ? [] : ["supply_ratio"], bad);
  }
  for (const d of v.industry_detail.data.industries) {
    const where = `industry_detail[${d.id}]`;
    if (d.estimated !== estimatedAt[d.id]) bad.push(`${where}.estimated is ${d.estimated}`);
    if (d.fringe_revenue_m.kind !== (d.estimated ? "Band" : "Exact")) bad.push(`${where}.fringe_revenue_m`);
    for (const c of d.companies) {
      const want = unitBanded(c.company, d.id) ? "Band" : "Exact";
      if (c.revenue_m.kind !== want) bad.push(`${where} company ${c.company} revenue is ${c.revenue_m.kind}`);
    }
  }
  return bad;
}

interface Scan {
  shape: string[];
  bad: string[];
  leaks: string[];
  truths: number;
}

function scan(w: World, observer: SimViews, omniscient: SimViews): Scan {
  const truths: Truths = new Map();
  const bad: string[] = [];
  const ported = VIEW_NAMES.filter((n) => viewIsPorted(n));
  for (const n of ported) pair(observer[n].data, omniscient[n].data, n, truths, bad);
  statementTruths(observer, omniscient, truths);
  for (const x of publicValues(observer)) truths.delete(x);
  const leaks: string[] = [];
  for (const n of ported) {
    const all: [number, string][] = [];
    numbers(observer[n].data, n, n, all);
    for (const [x, where] of all) {
      const t = truths.get(x);
      if (t === undefined) continue;
      // A figure under 1,000 (TB, points, ratios, shares) counts only in its own view: across
      // views such small values meet skills, rates and weights by the data.
      if (Math.abs(x) < 1000 && t.split(/[. []/, 1)[0] !== n) continue;
      leaks.push(`${where} = ${x}, the truth of ${t}`);
    }
  }
  return { shape: shape(w, observer), bad, leaks, truths: truths.size };
}

/** The two builds of the state now (see the header). */
function builds(sim: Sim): [SimViews, SimViews] {
  unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "Omniscient on");
  unwrap(simApply(sim, { kind: "SetOmniscient", on: false }), "Omniscient off");
  const observer = simViewsClone(simViews(sim));
  unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "Omniscient on");
  const omniscient = simViewsClone(simViews(sim));
  unwrap(simApply(sim, { kind: "SetOmniscient", on: false }), "Omniscient off");
  return [observer, omniscient];
}

describe("leak", () => {
  it("no view holds a true private figure with Omniscient off", () => {
    const sim = unwrap(simNew(data(), 1, { debug: true }), "Sim::new");
    const check = () => {
      const w = simWorld(sim);
      const [observer, omniscient] = builds(sim);
      const r = scan(w, observer, omniscient);
      expect(r.truths, "the scan has truths to look for").toBeGreaterThan(1000);
      expect(r.shape.slice(0, 20)).toEqual([]);
      expect(r.bad.slice(0, 20)).toEqual([]);
      expect(r.leaks.slice(0, 20)).toEqual([]);
    };
    check();
    // After Q1 2020's release (2 April) and the Q2 recap week.
    runTo(sim, simDateYmd(2020, 6, 26));
    check();
  }, 300_000);

  it("catches a planted leak and a wrong flag", () => {
    const sim = unwrap(simNew(data(), 1, { debug: true }), "Sim::new");
    const w = simWorld(sim);
    const [observer, omniscient] = builds(sim);
    expect(scan(w, observer, omniscient).leaks).toEqual([]);
    // A banded company with a whole-dollar cash (true of the starting books).
    const k = omniscient.company_detail.data.companies.findIndex(
      (d, i) =>
        showsEstimates(w, i as CompanyId) &&
        d.cash_usd.kind === "Exact" &&
        Number.isInteger(d.cash_usd.value),
    );
    expect(k).toBeGreaterThanOrEqual(0);
    const truth = omniscient.company_detail.data.companies[k]!.cash_usd;
    if (truth.kind !== "Exact") throw new Error("Omniscient is exact");
    // A raw copy into a plain number.
    const planted = structuredClone(observer);
    planted.company_detail.data.companies[k]!.buzz = truth.value;
    expect(scan(w, planted, omniscient).leaks.length).toBeGreaterThan(0);
    // The truth served exact, as a wrong `banded` would.
    const flagged = structuredClone(observer);
    flagged.company_detail.data.companies[k]!.cash_usd = truth;
    expect(scan(w, flagged, omniscient).shape.length).toBeGreaterThan(0);
  }, 120_000);
});
