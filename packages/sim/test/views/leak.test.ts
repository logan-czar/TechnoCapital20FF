// The sim-side half of crates/game/tests/m9_leak.rs (M9.8, D574): with Omniscient off, no view
// may hold a true private figure. Rust scans the game's rendered text; here the view data itself
// is scanned, which is stricter (every number, not its rounded rendering). Not a Rust file.
// leak_rules.ts maps the views (company subtrees, id leaves, the allow-lists); leak_perturb.ts
// makes the perturbed world of check 4.
//
// Two builds of one state: the observer's and Omniscient's (a debug Sim, D961). Omniscient is
// toggled on and off first, so the observer's views are rebuilt at that tick too (D423), then on
// again: the two builds differ only by Omniscient.
//
// 1. The shape, over every leaf of every ported view: a leaf in the subtree of a company that
//    does not publish (D420; the subtrees are leak_rules.ts `owners`) is a band if it is a
//    figure, but for the compute and licences line (D434) and a listed company's EFV (D140)
//    (`exactInBanded`); a plain number there must be an id, a count, a date or one of the
//    numbers D420 leaves exact (`bandedPlain`), so a money figure served as a bare number fails.
//    A publishing company's figures are all exact; a figure about no company fails (a new view
//    must say whose it is); every `estimated` flag says whether its company publishes; a banded
//    company's statements hold no archive (D130). A wrong flag, the likeliest leak, fails here.
// 2. The truths: walking both builds side by side, a figure that is a band for the observer and
//    exact in Omniscient gives a truth; so does any plain number that differs between the builds
//    (only private figures can, D574's rule) or that Omniscient alone shows (the true V). Every
//    band must hold its truth strictly inside (D422) and sit at least `BAND_MIN_ERROR` × |truth|
//    away from it (D429: every error is at least ESTIMATE_BIAS_MIN − ESTIMATE_JITTER = 5.5% of
//    the truth, sums and maps keep it, D430; so an estimate that is the truth rounded fails).
//    v_statements' banded companies hold estimates instead of the archive: their estimated
//    statements are paired with Omniscient's by period, and every line (but Shared, D434), the
//    held TB and Omniscient's posted months are truths. Values that public data also holds are
//    dropped: several starting companies share their starting books (company-start.csv), so a
//    published company's 2019 lines can equal a private one's. Only these are public: every
//    number of a publishing company's subtrees, a listed company's EFV, and `PUBLIC_PATHS`.
// 3. The scan: every number of the observer's views (every ported view, plain numbers, exact
//    figures and band ends) must differ from every truth, but the id, count and date leaves
//    (path-qualified: leak_rules.ts `ids`, and dates by their shape). Nothing else is skipped:
//    an array of rows is always walked, and the operations D420 leaves exact are scanned too.
// 4. The perturbation, for derived and rounded leaks that equal no truth: the observer's views
//    are built twice by the view builders themselves (`simViewsBuild`, the same seed, controls
//    and map data), once from the state and once from a copy in which every banded company's
//    books are perturbed unevenly (leak_perturb.ts). Bands are left out of the comparison:
//    a band's noise is a hash of the truth's bits (D421), so every band moves when its truth does,
//    by design; each band is checked against its truth instead (2), in the perturbed build too.
//    Every other leaf (plain numbers, exact figures, strings, flags, array lengths: anything
//    a screen prints or a list's shape) must be the same in both builds, but `perturbExempt`
//    (a listed company's EFV, D140, and v_market_stats' soak diagnostics, D144). A leaf that
//    follows a private book (revenue in $M, cash rounded to $1M, cash over the shares, a margin,
//    a name with a figure in it) changes, and is a leak. A future view that derives a plain number
//    from a band's estimate (a sort order, a pin size) changes too: it must say so in
//    `perturbExempt`, with its reason.
//
// Run on seed 1 at load, after the first listing in play (company 115 lists on 9 January 2020
// and shows estimates until 2 April), after Q1 2020's release with three new listings in play
// (9 April), and after the first annual close (2020's year statements publish on 2 January 2021;
// born companies by then). Each hole the test once had is a negative case below.
import { describe, expect, it } from "vitest";
import {
  SIM_DEPS,
  type Sim,
  simApply,
  simControls,
  simData,
  simNew,
  simSeed,
  simViews,
  simWorld,
} from "../../src/lib.ts";
import { dateTimeMidnight, quarterFirstDay, quarterNext, simDateYmd } from "../../src/time/calendar.ts";
import type { CompanyId, IndustryId } from "../../src/types/ids.ts";
import { roundHalfAway } from "../../src/types/num.ts";
import type { Period, Statement } from "../../src/types/state/finance.ts";
import {
  type Band,
  ESTIMATE_BIAS_MIN,
  ESTIMATE_JITTER,
  type Figure,
  STATEMENT_LINE_VALUES,
} from "../../src/types/views/estimate.ts";
import { type SimViews, VIEW_NAMES, type ViewName } from "../../src/types/views/index.ts";
import type { EstimatedStatement } from "../../src/types/views/statements.ts";
import type { Company, World } from "../../src/types/world.ts";
import { showsEstimates, statementLineIndex, statementLineOf } from "../../src/views/estimate.ts";
import {
  simViewsBuild,
  simViewsClone,
  VIEW_BUILDERS,
  type ViewBuilder,
  type ViewBuilders,
  type ViewInput,
  viewIsPorted,
} from "../../src/views/index.ts";
import { periodEq } from "../../src/views/statements.ts";
import { worldIndustryEstimatedAt } from "../../src/world/index.ts";
import { data, unwrap } from "../common/index.ts";
import { runTo } from "../common/ops.ts";
import { bandedCompanies, perturbBooks } from "./leak_perturb.ts";
import {
  type BandedOf,
  canonical,
  exactInBanded,
  GUIDANCE_HIGH,
  isFigure,
  isIdLeaf,
  isListedEfv,
  isRecord,
  type Leaf,
  leafNumbers,
  PUBLIC_PATHS,
  perturbExempt,
  plainInBanded,
  VIEW_RULES,
  walkView,
} from "./leak_rules.ts";

type Truths = Map<number, string>;

/**
 * How far every band's estimate sits from its truth at least, as a share of it (2): the floor of
 * D429's error, ESTIMATE_BIAS_MIN − ESTIMATE_JITTER (5.5%), less a margin for D430's sums.
 */
const BAND_MIN_ERROR = 0.05;

const PORTED: readonly ViewName[] = VIEW_NAMES.filter((n) => viewIsPorted(n));

/** A value under this is small: a truth only within its own view (3). */
const SMALL = 1000;

/**
 * Records a truth. Left out: 0, and a small round value (under `SMALL` with at most 3 significant
 * digits: a 0.25 TB book, 1 point, a company id the two builds rank differently), which tax
 * rates, weights, counts and ids hold by the data; a money figure is never that small, and every
 * distinctive value stays in. (From PR #91.)
 */
function addTruth(truths: Truths, x: number, where: string): void {
  if (x === 0 || !Number.isFinite(x) || truths.has(x)) return;
  const a = Math.abs(x);
  if (a < SMALL && Number(a.toPrecision(3)) === a) return;
  truths.set(x, where);
}

/**
 * Whether a subject's figures are bands in the observer's build now (leak_rules.ts `Subject`): a
 * company that does not publish (D420), an industry in the estimated class (D432; a history
 * quarter by the class it closed in, D437), a unit or a company's line in either (D436).
 */
function bandedOf(w: World): BandedOf {
  const estimated = w.industries.map((_, i) => worldIndustryEstimatedAt(w, i as IndustryId, w.clock));
  return (s) => {
    if (s.company !== null && showsEstimates(w, s.company)) return true;
    const ind = s.ownIndustry && s.company !== null ? w.companies[s.company]!.industry : s.industry;
    if (ind === null) return false;
    if (s.quarter === null) return estimated[ind]!;
    return worldIndustryEstimatedAt(w, ind, dateTimeMidnight(quarterFirstDay(quarterNext(s.quarter))));
  };
}

/** A band against its truth (2): strictly inside, never the truth, far enough from it. */
function checkBand(b: Band, t: number, where: string, bad: string[], distance = true): void {
  if (!(b.low < t && t < b.high && b.estimate !== t)) {
    bad.push(`${where}: ${t} not strictly in ${JSON.stringify(b)}`);
  } else if (distance && Math.abs(b.estimate - t) < BAND_MIN_ERROR * Math.abs(t)) {
    bad.push(`${where}: estimate ${b.estimate} within ${BAND_MIN_ERROR} of ${t}`);
  }
}

/** Walks the observer's and Omniscient's builds of one view side by side (truths, 2). */
function pair(shown: unknown, truth: unknown, where: string, truths: Truths, bad: string[]): void {
  if (typeof truth === "number") {
    if (typeof shown === "number") {
      if (shown !== truth && !(Number.isNaN(shown) && Number.isNaN(truth))) addTruth(truths, truth, where);
    } else if (shown === null || shown === undefined) {
      // Omniscient alone shows it (v_quotes' true V).
      addTruth(truths, truth, where);
    }
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
      addTruth(truths, truth.value, where);
      checkBand(shown.band, truth.value, where, bad);
    } else if (shown.kind === "Exact" && truth.kind === "Exact" && shown.value !== truth.value) {
      addTruth(truths, truth.value, where);
    }
    return;
  }
  const s = shown as Record<string, unknown>;
  const t = truth as Record<string, unknown>;
  for (const k of Object.keys(s)) pair(s[k], t[k], `${where}.${k}`, truths, bad);
}

/**
 * The truths of v_statements' banded companies (their archive is not in the observer's view),
 * and their estimated statements against Omniscient's, paired by period (2).
 */
function statementTruths(observer: SimViews, omniscient: SimViews, truths: Truths, bad: string[]): void {
  const shared = statementLineIndex("Shared");
  observer.statements.data.companies.forEach((c, i) => {
    if (!c.estimated) return;
    const t = omniscient.statements.data.companies[i]!;
    const against = (shown: readonly EstimatedStatement[], all: readonly Statement[], what: string) => {
      for (const e of shown) {
        const s = all.find((x) => periodEq(x.period, e.period as Period));
        const where = `statements ${c.key} ${what} ${JSON.stringify(e.period)}`;
        if (s === undefined) {
          bad.push(`${where}: no Omniscient statement`);
          continue;
        }
        STATEMENT_LINE_VALUES.forEach((l, k) => {
          const f = e.lines[k]!;
          if (k === shared || f.kind !== "Band") return;
          // GuidanceHigh is the low end's band moved by the width (D430): its error is the low
          // end's, so only containment holds for it.
          checkBand(f.band, statementLineOf(l, s), `${where} ${l}`, bad, k !== GUIDANCE_HIGH);
        });
        const h = e.operating.held_tb;
        if (h.kind === "Band") checkBand(h.band, s.key.held_tb, `${where} held TB`, bad);
      }
    };
    against(c.estimated_quarters, t.quarters, "quarter");
    against(c.estimated_years, t.years, "year");
    for (const s of [...t.quarters, ...t.years]) {
      for (const l of STATEMENT_LINE_VALUES) {
        if (l !== "Shared") addTruth(truths, statementLineOf(l, s), `statements ${c.key} ${l}`);
      }
      addTruth(truths, s.key.held_tb, `statements ${c.key} held TB`);
    }
    for (const m of t.months) addTruth(truths, m.lines.revenue, `statements ${c.key} month revenue`);
  });
}

/** Every leaf of every ported view of `v`, its subjects classed by `w`. */
function leaves(w: World, v: SimViews, visit: (leaf: Leaf) => void): void {
  const banded = bandedOf(w);
  for (const n of PORTED) walkView(n, v[n].data, banded, visit);
}

/** `v` with every view in `canonical` order (leak_rules.ts), so the builds pair row by row. */
function canonViews(v: SimViews): SimViews {
  const out = { ...v } as Record<string, unknown>;
  for (const n of PORTED) out[n] = { ...v[n], data: canonical(n, v[n].data) };
  return out as unknown as SimViews;
}

/**
 * The public values (2): every number of a subject's subtrees that is not banded (a publishing
 * company, an industry outside the estimated class: the published industry totals), a listed
 * company's EFV, and `PUBLIC_PATHS`. Nothing else: an exact value elsewhere is not made public by
 * being shown (it may be the leak).
 */
function publicValues(w: World, observer: SimViews): Set<number> {
  const out = new Set<number>();
  leaves(w, observer, (leaf) => {
    const pub = leaf.ctx.banded === false || isListedEfv(leaf) || PUBLIC_PATHS.has(leaf.norm);
    if (pub) for (const x of leafNumbers(leaf)) out.add(x);
  });
  return out;
}

/** The shape check (1) over every leaf of every ported view. */
function shape(w: World, v: SimViews): string[] {
  const bad: string[] = [];
  for (const n of PORTED) {
    if (VIEW_RULES[n] === undefined) bad.push(`${n} is ported but has no leak rules`);
  }
  leaves(w, v, (leaf) => {
    const banded = leaf.ctx.banded;
    const f = leaf.figure;
    if (banded === null) {
      if (f !== null) bad.push(`${leaf.raw} is a figure about no subject`);
      return;
    }
    const who = `company ${leaf.ctx.owner}, industry ${leaf.ctx.industry}`;
    if (f !== null) {
      const want = banded && !exactInBanded(leaf) ? "Band" : "Exact";
      if (f.kind !== want) bad.push(`${leaf.raw} is ${f.kind}, wants ${want} (${who})`);
    } else if (leaf.norm.endsWith(".estimated") && leaf.value !== banded) {
      bad.push(`${leaf.raw} is ${String(leaf.value)}, ${who} banded ${banded}`);
    } else if (banded && typeof leaf.value === "number" && !isIdLeaf(leaf) && !plainInBanded(leaf)) {
      bad.push(`${leaf.raw} = ${leaf.value} is a plain number of a banded subject (${who})`);
    }
  });
  v.statements.data.companies.forEach((c, i) => {
    const where = `statements[${i}]`;
    if (c.estimated && (c.quarters.length > 0 || c.years.length > 0)) bad.push(`${where} holds the archive`);
    if (!c.estimated && (c.estimated_quarters.length > 0 || c.estimated_years.length > 0)) {
      bad.push(`${where} holds estimates`);
    }
    if (c.months.length > 0) bad.push(`${where} holds the posted months`);
  });
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
  for (const n of PORTED) pair(observer[n].data, omniscient[n].data, n, truths, bad);
  statementTruths(observer, omniscient, truths, bad);
  for (const x of publicValues(w, observer)) truths.delete(x);
  const leaks: string[] = [];
  leaves(w, observer, (leaf) => {
    if (isIdLeaf(leaf)) return;
    for (const x of leafNumbers(leaf)) {
      const t = truths.get(x);
      if (t === undefined) continue;
      // A small truth (TB, points, ratios, shares) counts only in its own view: across views such
      // values meet skills, rates and weights by the data (from PR #91). A small figure carried
      // into another view still fails the perturbation (4).
      if (Math.abs(x) < SMALL && t.split(/[. []/, 1)[0] !== leaf.ctx.view) continue;
      leaks.push(`${leaf.raw} = ${x}, the truth of ${t}`);
    }
  });
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
  return [canonViews(observer), canonViews(omniscient)];
}

// ---------------------------------------------------------------- the perturbation (4)

const sameLeaf = (a: unknown, b: unknown) =>
  a === b || (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b));

/**
 * The leaves of view `n` that differ between two builds, bands left out (see the header), with
 * their `Leaf` in the first build for `perturbExempt`.
 */
function changes(w: World, n: ViewName, a: unknown, b: unknown, out: string[]): void {
  // `walkView` walks one build; the other is read at the same raw path.
  const at = (raw: string): unknown => {
    let x: unknown = { [n]: b };
    for (const m of raw.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
      if (!isRecord(x)) return undefined;
      x = (x as Record<string, unknown>)[m[1] ?? m[2]!];
    }
    return x;
  };
  const lengths = (x: unknown, y: unknown, raw: string): void => {
    if (Array.isArray(x)) {
      if (!Array.isArray(y) || x.length !== y.length) {
        out.push(`${raw}: ${x.length} rows, then ${Array.isArray(y) ? y.length : "none"}`);
        return;
      }
      x.forEach((e, i) => {
        lengths(e, y[i], `${raw}[${i}]`);
      });
    } else if (isRecord(x) && !isFigure(x)) {
      if (!isRecord(y)) {
        out.push(`${raw}: an object, then ${String(y)}`);
        return;
      }
      const kx = Object.keys(x).sort().join(",");
      const ky = Object.keys(y).sort().join(",");
      if (kx !== ky) out.push(`${raw}: fields ${kx}, then ${ky}`);
      else for (const k of Object.keys(x)) lengths(x[k], y[k], `${raw}.${k}`);
    }
  };
  const before = out.length;
  lengths(a, b, n);
  if (out.length > before) return;
  walkView(n, a, bandedOf(w), (leaf) => {
    if (perturbExempt(leaf)) return;
    const y = at(leaf.raw);
    const f = leaf.figure;
    if (f !== null) {
      if (!isFigure(y)) out.push(`${leaf.raw}: a figure, then ${JSON.stringify(y)}`);
      else if (f.kind !== y.kind) out.push(`${leaf.raw}: ${f.kind}, then ${y.kind}`);
      else if (f.kind === "Exact" && y.kind === "Exact" && !sameLeaf(f.value, y.value)) {
        out.push(`${leaf.raw}: Exact ${f.value}, then ${y.value}`);
      }
    } else if (!sameLeaf(leaf.value, y)) {
      out.push(`${leaf.raw}: ${JSON.stringify(leaf.value)}, then ${JSON.stringify(y)}`);
    }
  });
}

interface Perturbed {
  /** The observer leaves that followed the perturbed books (leaks). */
  changed: string[];
  /** The scan of the perturbed state's observer and Omniscient builds (1 to 3). */
  scan: Scan;
}

/**
 * Check 4 at the state now: the observer's views of the state and of its perturbed copy, built
 * by `builders` with the Sim's seed, controls and map data (Omniscient off); and Omniscient's of
 * the copy, so its bands are checked against its truths.
 */
function perturbation(sim: Sim, builders: ViewBuilders = VIEW_BUILDERS): Perturbed {
  const w = simWorld(sim);
  const seed = simSeed(sim);
  const controls = simControls(sim);
  const map = unwrap(SIM_DEPS.mapDataBuild(simData(sim)!, w), "map data");
  const off = { ...controls, omniscient: false };
  const on = { ...controls, omniscient: true };
  const p = perturbBooks(w);
  const a = canonViews(simViewsBuild({ world: w, controls: off, seed, map }, builders));
  const b = canonViews(simViewsBuild({ world: p, controls: off, seed, map }, builders));
  const t = canonViews(simViewsBuild({ world: p, controls: on, seed, map }, builders));
  const changed: string[] = [];
  for (const n of PORTED) changes(w, n, a[n].data, b[n].data, changed);
  return { changed, scan: scan(p, b, t) };
}

// ---------------------------------------------------------------- the moments

function expectClean(r: Scan): void {
  expect(r.truths, "the scan has truths to look for").toBeGreaterThan(1000);
  expect(r.shape.slice(0, 20)).toEqual([]);
  expect(r.bad.slice(0, 20)).toEqual([]);
  expect(r.leaks.slice(0, 20)).toEqual([]);
}

function checkNow(sim: Sim): void {
  const w = simWorld(sim);
  const [observer, omniscient] = builds(sim);
  expectClean(scan(w, observer, omniscient));
  const p = perturbation(sim);
  expect(p.changed.slice(0, 20)).toEqual([]);
  expectClean(p.scan);
}

/** Companies listed in play that still show estimates (before their first release). */
function listedBanded(w: World): CompanyId[] {
  return bandedCompanies(w).filter((id) => w.market.stocks[id]!.exchange !== null);
}

describe("leak", () => {
  const sim = unwrap(simNew(data(), 1, { debug: true }), "Sim::new");

  it("at load", () => {
    checkNow(sim);
  }, 120_000);

  it("after the first listing in play", () => {
    runTo(sim, simDateYmd(2020, 1, 20));
    expect(listedBanded(simWorld(sim)).length).toBeGreaterThan(0);
    checkNow(sim);
  }, 120_000);

  it("after Q1 2020's release, with new listings in play", () => {
    runTo(sim, simDateYmd(2020, 4, 15));
    const w = simWorld(sim);
    expect(simViews(sim).filings.data.quarter).toEqual({ year: 2020, q: 1 });
    expect(listedBanded(w).length).toBeGreaterThan(0);
    checkNow(sim);
  }, 120_000);

  it("after the first annual close", () => {
    runTo(sim, simDateYmd(2021, 1, 20));
    const w = simWorld(sim);
    const years = simViews(sim).statements.data.companies[0]!.years;
    expect(years[years.length - 1]!.period).toEqual({ kind: "Year", year: 2020 });
    expect(w.companies.some((c) => c.origin.kind === "Born")).toBe(true);
    checkNow(sim);
  }, 120_000);
});

// ---------------------------------------------------------------- the negative cases

/** Sets a field the view types may not have (a plant). */
function put(target: object, key: string, value: unknown): void {
  (target as Record<string, unknown>)[key] = value;
}

describe("leak test catches", () => {
  const sim = unwrap(simNew(data(), 1, { debug: true }), "Sim::new");
  runTo(sim, simDateYmd(2020, 1, 20));
  const w = simWorld(sim);
  const [observer, omniscient] = builds(sim);
  // A banded company with a whole-dollar cash above $50M (true of the starting books).
  const k = omniscient.company_detail.data.companies.findIndex(
    (d, i) =>
      showsEstimates(w, i as CompanyId) &&
      d.cash_usd.kind === "Exact" &&
      Number.isInteger(d.cash_usd.value) &&
      d.cash_usd.value > 50e6,
  );
  const truthFig = omniscient.company_detail.data.companies[k]!.cash_usd;
  const truth = truthFig.kind === "Exact" ? truthFig.value : Number.NaN;
  const exact = (x: number): Figure => ({ kind: "Exact", value: x });
  // A banded company with estimated statements (its operating figures).
  const st = observer.statements.data.companies.findIndex((c) => c.estimated_quarters.length > 0);
  type Plant = [string, (v: SimViews) => void];
  /** The scan of the observer's views with one plant. */
  const scanPlanted = (plant: (v: SimViews) => void): Scan => {
    const v = structuredClone(observer);
    plant(v);
    return scan(w, v, omniscient);
  };
  const detail = (v: SimViews) => v.company_detail.data.companies[k]!;
  const operating = (v: SimViews) => v.statements.data.companies[st]!.estimated_quarters[0]!.operating;

  it("nothing on the clean views, with a banded company to plant in", () => {
    expect(k).toBeGreaterThanOrEqual(0);
    expect(st).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(truth)).toBe(true);
    const r = scan(w, observer, omniscient);
    expect([...r.shape, ...r.bad, ...r.leaks]).toEqual([]);
  });

  it("a raw copy into a plain number, and a wrong flag", () => {
    expect(scanPlanted((v) => put(detail(v), "buzz", truth)).leaks.length).toBeGreaterThan(0);
    // The truth served exact, as a wrong `banded` would.
    expect(scanPlanted((v) => put(detail(v), "cash_usd", truthFig)).shape.length).toBeGreaterThan(0);
    expect(scanPlanted((v) => put(detail(v), "estimated", false)).shape.length).toBeGreaterThan(0);
  });

  // Hole 1: every exact value the observer saw was public, so an Exact(truth) anywhere erased
  // its own truth and passed.
  it("an exact truth in a field no check names (hole 1)", () => {
    const plants: Plant[] = [
      ["a new cap table field", (v) => put(v.cap_table.data.companies[k]!, "book", exact(truth))],
      ["a seat card", (v) => put(detail(v).board[0]!, "pay", exact(truth))],
      ["a province card", (v) => put(v.province_cards.data.cards[0]!, "gdp", exact(truth))],
      ["a ratings row", (v) => put(v.ratings.data.companies[k]!, "collateral", exact(truth))],
    ];
    for (const [what, plant] of plants) expect(scanPlanted(plant).leaks.length, what).toBeGreaterThan(0);
  });

  // Hole 2: the shape check read 5 views' top-level row fields only.
  it("an exact figure or a plain money number deep in a banded subtree (hole 2)", () => {
    const plants: Plant[] = [
      ["an exact figure in a seat card", (v) => put(detail(v).board[0]!, "pay", exact(1234.5))],
      ["a plain number in a seat card", (v) => put(detail(v).board[0]!, "pay", 1234.5)],
      [
        "an exact figure in the cap table",
        (v) => put(v.cap_table.data.companies[k]!, "value", exact(1234.5)),
      ],
      ["a plain number in a holding", (v) => put(v.cap_table.data.companies[k]!.lines[0]!, "cost", 1234.5)],
      ["a figure about no company", (v) => put(v.province_cards.data.cards[0]!, "gdp", exact(1234.5))],
      [
        "a statement's posted months",
        (v) => {
          const lines = omniscient.statements.data.companies[k]!.quarters[0]!.lines;
          put(v.statements.data.companies[k]!, "months", [{ month: { year: 2020, month: 1 }, lines }]);
        },
      ],
    ];
    for (const [what, plant] of plants) expect(scanPlanted(plant).shape.length, what).toBeGreaterThan(0);
  });

  // Hole 3: a field name skipped its whole subtree at any depth, and the operations D420 leaves
  // exact were never scanned.
  it("a truth under a once-skipped name, or in an operation figure (hole 3)", () => {
    const rows = [{ id: 0, revenue_usd: truth }];
    const plants: Plant[] = [
      ["units rows", (v) => put(v.province_cards.data.cards[0]!, "units", rows)],
      ["hqs rows", (v) => put(v.province_cards.data.cards[0]!, "hqs", rows)],
      ["industries rows", (v) => put(v.births.data.events[0]!, "industries", rows)],
      ["provinces rows", (v) => put(v.map_static.data.metros[0]!, "provinces", rows)],
      ["labor units", (v) => put(operating(v), "labor_units", truth)],
      ["the PC bonus", (v) => put(operating(v), "pc_bonus", truth)],
      ["the free R&D step", (v) => put(operating(v), "free_rd_pct", truth)],
    ];
    for (const [what, plant] of plants) expect(scanPlanted(plant).leaks.length, what).toBeGreaterThan(0);
  });

  it("an estimate that is the truth rounded (2)", () => {
    expect(BAND_MIN_ERROR).toBeLessThan(ESTIMATE_BIAS_MIN - ESTIMATE_JITTER);
    const r = roundHalfAway(truth / 1e6) * 1e6 + 1;
    const band: Figure = { kind: "Band", band: { estimate: r, low: r * 0.75, high: r * 1.25 } };
    const s = scanPlanted((v) => put(detail(v), "cash_usd", band));
    expect(s.leaks).toEqual([]);
    expect(s.bad.length).toBeGreaterThan(0);
  });

  // Hole 4: a derived or rounded figure equals no truth; only the perturbation sees it.
  it("derived and rounded figures (hole 4)", () => {
    /** The view builders with `plant` run on every banded row of view `name`. */
    const leaky = (
      name: "company_rows" | "company_detail",
      plant: (row: Record<string, unknown>, c: Company) => void,
    ): ViewBuilders => {
      const b = VIEW_BUILDERS[name] as unknown as ViewBuilder<Record<string, Record<string, unknown>[]>>;
      const build = b.build!;
      const slot = {
        ...b,
        build: (input: ViewInput) => {
          const v = build(input);
          for (const row of v.rows ?? v.companies ?? []) {
            const id = row.id as CompanyId;
            if (showsEstimates(input.world, id)) plant(row, input.world.companies[id]!);
          }
          return v;
        },
      };
      return { ...VIEW_BUILDERS, [name]: slot } as unknown as ViewBuilders;
    };
    // A born company has no quarter yet: its open month.
    const last = (c: Company) => {
      const q = c.finance.archive.quarters;
      return q.length > 0 ? q[q.length - 1]!.lines : c.finance.month;
    };
    // Each into a field a banded row may hold as a plain number, so the shape check passes.
    const plants: [string, ViewBuilders][] = [
      [
        "cash rounded to $1M",
        leaky("company_detail", (r, c) => put(r, "buzz", roundHalfAway(c.cash_usd / 1e6) * 1e6)),
      ],
      [
        "revenue in $M",
        leaky("company_detail", (r, c) => put(r, "buzz", roundHalfAway(last(c).revenue / 1e5) / 10)),
      ],
      ["cash over the shares", leaky("company_detail", (r, c) => put(r, "price", c.cash_usd / c.shares_out))],
      [
        "a margin",
        leaky("company_detail", (r, c) => put(r, "confidence_factor", last(c).tax / last(c).revenue)),
      ],
      [
        "a figure in a name",
        leaky("company_rows", (r, c) => put(r, "name", `${c.name} ($${roundHalfAway(c.cash_usd / 1e6)}M)`)),
      ],
    ];
    for (const [what, builders] of plants) {
      const p = perturbation(sim, builders);
      expect(p.changed.length, what).toBeGreaterThan(0);
      expect(p.scan.leaks, `${what}: the scan alone misses it`).toEqual([]);
    }
    // The clean builders, for contrast.
    expect(perturbation(sim).changed).toEqual([]);
  }, 120_000);
});
