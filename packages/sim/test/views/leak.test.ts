// The sim-side half of crates/game/tests/m9_leak.rs (M9.8, D574): with Omniscient off, no view
// may hold a true private figure. Rust scans the game's rendered text; here the view data itself
// is scanned, which is stricter (every number, not its rounded rendering). Not a Rust file.
// leak_rules.ts maps the views (subject subtrees, id leaves, the allow-lists); leak_perturb.ts
// makes the perturbed world of check 4. A subject is a company, an industry, or both (a unit, a
// company's line in an industry); it is banded as the views band it: a company that does not
// publish (D420), an industry in the estimated class (D432; a history quarter by the class it
// closed in, D437), a unit or a company's line when either is (D436). `bandedOf` classes them.
// Lists the views rank by the revenue shown (v_industry_detail's companies) are compared in
// company id order (leak_rules.ts `canonical`), so the builds pair row by row; the order itself
// is checked in each build (`rankingBad`, 4).
//
// Two builds of one state: the observer's and Omniscient's (a debug Sim, D961). Omniscient is
// toggled on and off first, so the observer's views are rebuilt at that tick too (D423), then on
// again: the two builds differ only by Omniscient.
//
// 1. The shape, over every leaf of every ported view: a leaf in the subtree of a banded subject
//    (the subtrees are leak_rules.ts `owners`) is a band if it is a figure, but for the compute
//    and licences line (D434), a listed company's EFV (D140) and S with no demand
//    (`exactInBanded`); a plain number there must be an id, a count, a date or one of the
//    numbers D420 and D432 leave exact (`bandedPlain`), so a money figure served as a bare number
//    fails. An unbanded subject's figures are all exact; a figure about no subject fails (a new
//    view must say whose it is); every `estimated` flag says whether its subject is banded; a
//    banded company's statements hold no archive (D130). A wrong flag, the likeliest leak, fails.
//    And every leaf that follows private books by a published formula (leak_rules.ts `derivedOf`:
//    a quoted company's EFV, D140; v_market_stats, D144; an industry's named revenue and shares,
//    exact or summed from the shown unit bands, D432;
//    v_recap's surprise and reaction from the shown estimates, D430) equals that formula worked
//    out again from the build's World or bands (`derivedBad`), so a private value there fails.
// 2. The truths: walking both builds side by side, a figure that is a band for the observer and
//    exact in Omniscient gives a truth; so does any plain number that differs between the builds
//    (only private figures can, D574's rule) or that Omniscient alone shows (the true V). Every
//    band must hold its truth strictly inside (D422) and sit at least `BAND_MIN_ERROR` × |truth|
//    away from it (D429: every error is at least ESTIMATE_BIAS_MIN − ESTIMATE_JITTER = 5.5% of
//    the truth, sums and maps keep it, D430; so an estimate that is the truth rounded fails;
//    not for the bands that sum or divide many subjects' errors, an estimated industry's named
//    revenue and the detail's shares of its total, leak_rules.ts `SUM_BAND_PATHS`: `derivedOf`
//    works those out again from the build's shown parts instead, in check 1).
//    An id leaf is never a truth, and neither is 0 or a simple small value (`isSimpleSmall`).
//    v_statements' banded companies hold estimates instead of the archive: their estimated
//    statements are paired with Omniscient's by period, and every line (but Shared, D434), the
//    held TB and Omniscient's posted months are truths. Values that public data also holds are
//    dropped: several starting companies share their starting books (company-start.csv), so a
//    published company's 2019 lines can equal a private one's. Only these are public: every
//    number of an unbanded subject's subtrees (a publishing company's, the published industry
//    tables), a quoted company's EFV that is its V × (1 + e), and `PUBLIC_PATHS`.
// 3. The scan: every number of the observer's views (every ported view, plain numbers, exact
//    figures and band ends) must differ from every truth, in every view, but the id, count and
//    date leaves (path-qualified: leak_rules.ts `ids`, and dates by their shape). Nothing else is
//    skipped: an array of rows is always walked, and the operations D420 leaves exact are
//    scanned too. One known exact match is excused, by name (`knownExact`: a statement's
//    productivity, D420, against v_units' banded productivity, D436; logged for Logan).
// 4. The perturbation, for derived and rounded leaks that equal no truth: the observer's views
//    are built twice by the view builders themselves (`simViewsBuild`, the same seed, controls
//    and map data), once from the state and once from a copy in which every banded company's
//    state is perturbed unevenly (leak_perturb.ts: every number of its state but the `KEPT`
//    ones, so the values the state caches from the books move too). Bands are left out of the
//    comparison: a band's noise is a hash of the truth's bits (D421), so every band moves when its
//    truth does, by design; each band is checked against its truth instead (2), in the perturbed
//    build too. So are the leaves worked out again in each build (`derivedOf`, 1) and the top 5,
//    whose order `rankingBad` checks in each build against the revenue shown, with
//    v_industry_detail's list (D420, D436; `perturbExempt`). Every other leaf (plain numbers,
//    exact figures, strings, flags, array lengths: anything a screen prints or a list's shape)
//    must be the same in both builds. A leaf that follows a private book (revenue in $M, cash
//    rounded to $1M, cash over the shares, a margin, a name with a figure in it, the last
//    surprise) changes, and is a leak. A future view that derives a plain number from a band's
//    estimate (a sort order, a pin size) changes too: it must be worked out again in
//    `derivedOf` or checked as the rankings are, with its reason.
//
// Run on seed 1 at load, after the first listing in play (company 115 lists on 9 January 2020
// and shows estimates until 2 April), after Q1 2020's release with three new listings in play
// (9 April), and after the first annual close (2020's year statements publish on 2 January 2021;
// born companies by then). Each hole the test once had is a negative case below; those that need
// a recap and a locked plan (v_projection, v_recap, v_map_layers) run on the Q1 state.
import { afterEach, describe, expect, it } from "vitest";
import { companyFinanceStatus } from "../../src/finance/state.ts";
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
import type { Stock } from "../../src/types/state/market.ts";
import {
  type Band,
  ESTIMATE_BIAS_MIN,
  ESTIMATE_JITTER,
  type Figure,
  STATEMENT_LINE_VALUES,
} from "../../src/types/views/estimate.ts";
import { type SimViews, VIEW_NAMES, type ViewName } from "../../src/types/views/index.ts";
import { TOP_COMPANIES } from "../../src/types/views/industry_rows.ts";
import type { EstimatedStatement } from "../../src/types/views/statements.ts";
import type { Company, World } from "../../src/types/world.ts";
import {
  figureShown,
  showsEstimates,
  statementLineIndex,
  statementLineOf,
} from "../../src/views/estimate.ts";
import {
  simViewsBuild,
  simViewsClone,
  VIEW_BUILDERS,
  type ViewBuilder,
  type ViewBuilders,
  type ViewInput,
  viewIsPorted,
} from "../../src/views/index.ts";
import { companiesByRevenue } from "../../src/views/industry_rows.ts";
import { periodEq } from "../../src/views/statements.ts";
import { worldIndustryEstimatedAt } from "../../src/world/index.ts";
import { data, unwrap } from "../common/index.ts";
import { runTo } from "../common/ops.ts";
import { bandedCompanies, KEPT, keptWhy, perturbBooks } from "./leak_perturb.ts";
import {
  type BandedOf,
  canonical,
  derivedOf,
  exactInBanded,
  GUIDANCE_HIGH,
  isDateLike,
  isEfvLeaf,
  isFigure,
  isIdLeaf,
  isRecord,
  type Leaf,
  leafNumbers,
  leafValue,
  PUBLIC_PATHS,
  perturbExempt,
  plainInBanded,
  rankingBad,
  rulesOf,
  SUM_BAND_PATHS,
  type UnitAt,
  VIEW_RULES,
  walkView,
} from "./leak_rules.ts";

type Truths = Map<number, string[]>;

/**
 * How far every band's estimate sits from its truth at least, as a share of it (2): the floor of
 * D429's error, ESTIMATE_BIAS_MIN − ESTIMATE_JITTER (5.5%), less a margin for D430's sums.
 */
const BAND_MIN_ERROR = 0.05;

const PORTED: readonly ViewName[] = VIEW_NAMES.filter((n) => viewIsPorted(n));

/** Below this, a round value is not a truth (`addTruth`). */
const SMALL = 1000;

/**
 * A simple small value: under `SMALL`, and either at most 3 significant digits once float noise
 * is rounded off (12 significant digits: 0.049999999999999996 is 0.05) or a fraction with a
 * denominator of at most 12 and a numerator of at most 4 digits (20/3 = 6.666666666666667, a
 * board's average of three skills). Tax rates, weights, skills, skill averages and counts hold
 * such values by the data, so a TB book or a point that happens to be one says nothing.
 */
function isSimpleSmall(x: number): boolean {
  const a = Math.abs(x);
  if (a >= SMALL) return false;
  const clean = Number(a.toPrecision(12));
  if (Number(clean.toPrecision(3)) === clean) return true;
  for (let d = 2; d <= 12; d++) {
    const n = Number((clean * d).toPrecision(12));
    if (Number.isInteger(n) && n < 10_000) return true;
  }
  return false;
}

/**
 * Records a truth with where it was found (every place, so `knownExact` can excuse one source
 * without hiding another). Left out: 0, and a simple small value (`isSimpleSmall`); a money
 * figure is never that small, and every other value stays in, in every view. A simple small
 * figure moved into another view still fails the perturbation (4) when it follows the books.
 */
function addTruth(truths: Truths, x: number, where: string): void {
  if (x === 0 || !Number.isFinite(x)) return;
  if (isSimpleSmall(x)) return;
  const at = truths.get(x);
  if (at === undefined) truths.set(x, [where]);
  else at.push(where);
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

/**
 * Walks the observer's and Omniscient's builds of view `view` side by side (truths, 2). `norm`
 * is the normalized path: an id leaf (leak_rules.ts `ids`) is never a truth, so ids the two
 * builds list in another order are not paired as figures.
 */
function pair(
  view: ViewName,
  shown: unknown,
  truth: unknown,
  where: string,
  norm: string,
  truths: Truths,
  bad: string[],
): void {
  if (typeof truth === "number") {
    if ((rulesOf(view).ids ?? []).includes(norm)) return;
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
    for (let i = 0; i < n; i++) pair(view, shown[i], truth[i], `${where}[${i}]`, `${norm}[]`, truths, bad);
    return;
  }
  if (!isRecord(shown) || !isRecord(truth)) return;
  if (isFigure(shown) && isFigure(truth)) {
    if (shown.kind === "Band" && truth.kind === "Exact") {
      addTruth(truths, truth.value, where);
      checkBand(shown.band, truth.value, where, bad, !SUM_BAND_PATHS.has(norm));
    } else if (shown.kind === "Exact" && truth.kind === "Exact" && shown.value !== truth.value) {
      addTruth(truths, truth.value, where);
    }
    return;
  }
  const s = shown as Record<string, unknown>;
  const t = truth as Record<string, unknown>;
  for (const k of Object.keys(s)) pair(view, s[k], t[k], `${where}.${k}`, `${norm}.${k}`, truths, bad);
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

/**
 * The one known exact match the scan lets pass, named: a statement's productivity (v_statements'
 * operating figures, exact because D420 leaves productivity exact "as operations"; Rust does the
 * same, crates/sim/src/views/statements.rs `operating`) equals the true productivity that v_units
 * bands for the same company (D436), or its p_pre (the productivity band moved by the published
 * bonuses, D430: the same figure when the quarter's productivity is the unit's p_pre). The
 * D420/D436 tension is logged for Logan; until he rules, only this pair (that leaf, a unit's
 * productivity or p_pre truth) is excused, nothing else.
 */
function knownExact(leaf: Leaf, truth: string): boolean {
  return (
    (leaf.norm === "statements.companies[].estimated_quarters[].operating.productivity" ||
      leaf.norm === "statements.companies[].estimated_years[].operating.productivity") &&
    /^units\.units\[\d+\]\.(productivity|p_pre)$/.test(truth)
  );
}

/**
 * The k-th unit v_map_layers lists: the units of companies still in the game, in unit id order
 * (crates/sim/src/views/map_layers.rs `build`).
 */
function unitAtOf(w: World): UnitAt {
  const shown = w.units.filter((u) => companyFinanceStatus(w.companies[u.company]!.finance) !== "Removed");
  return (k) => {
    const u = shown[k];
    return u === undefined ? null : { company: u.company, industry: u.industry };
  };
}

/** Every leaf of every ported view of `v`, its subjects classed by `w`. */
function leaves(w: World, v: SimViews, visit: (leaf: Leaf) => void): void {
  const banded = bandedOf(w);
  const unitAt = unitAtOf(w);
  for (const n of PORTED) walkView(n, v[n].data, banded, visit, unitAt);
}

/** `v` with every view in `canonical` order (leak_rules.ts), so the builds pair row by row. */
function canonViews(v: SimViews): SimViews {
  const out = { ...v } as Record<string, unknown>;
  for (const n of PORTED) out[n] = { ...v[n], data: canonical(n, v[n].data) };
  return out as unknown as SimViews;
}

/**
 * The public values (2): every number of a subject's subtrees that is not banded (a publishing
 * company, an industry outside the estimated class: the published industry totals), a quoted
 * company's EFV (one that is its V × (1 + e), `derivedOf`), and `PUBLIC_PATHS`. Nothing else: an
 * exact value elsewhere is not made public by being shown (it may be the leak).
 */
function publicValues(w: World, observer: SimViews): Set<number> {
  const out = new Set<number>();
  leaves(w, observer, (leaf) => {
    const efv =
      isEfvLeaf(leaf) && leafValue(leaf) !== undefined && derivedOf(leaf, w, observer) === leafValue(leaf);
    const pub = leaf.ctx.banded === false || efv || PUBLIC_PATHS.has(leaf.norm);
    if (pub) for (const x of leafNumbers(leaf)) out.add(x);
  });
  return out;
}

/**
 * The recomputed leaves of one build (leak_rules.ts `derivedOf`) against their recomputation from
 * that build's World and shown bands.
 */
function derivedBad(w: World, v: SimViews, build: string): string[] {
  const bad: string[] = [];
  leaves(w, v, (leaf) => {
    const want = derivedOf(leaf, w, v);
    if (want === undefined) return;
    if (typeof want === "string") bad.push(`${leaf.raw} (${build}): ${want}`);
    else if (typeof want === "object") {
      if (!sameFigure(leaf.figure, want)) {
        bad.push(
          `${leaf.raw} (${build}): ${JSON.stringify(leaf.figure)}, worked out again ${JSON.stringify(want)}`,
        );
      }
    } else if (!sameLeaf(leafValue(leaf), want)) {
      bad.push(`${leaf.raw} (${build}): ${String(leafValue(leaf))}, worked out again ${want}`);
    }
  });
  return bad;
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
  // The locked plan never shows to the observer (spec 1, D252).
  for (const r of v.projection.data.companies) {
    if (r.plan !== null) bad.push(`projection[${r.id}] shows the plan`);
  }
  bad.push(...derivedBad(w, v, "this build"));
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
  for (const n of PORTED) pair(n, observer[n].data, omniscient[n].data, n, n, truths, bad);
  statementTruths(observer, omniscient, truths, bad);
  for (const x of publicValues(w, observer)) truths.delete(x);
  const leaks: string[] = [];
  leaves(w, observer, (leaf) => {
    if (isIdLeaf(leaf)) return;
    for (const x of leafNumbers(leaf)) {
      const t = truths.get(x);
      const from = t?.filter((where) => !knownExact(leaf, where)) ?? [];
      if (from.length > 0) leaks.push(`${leaf.raw} = ${x}, the truth of ${from.join(", ")}`);
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

/** Two figures of the same kind with the same numbers (`sameLeaf` on each). */
function sameFigure(a: Figure | null, b: Figure): boolean {
  if (a === null) return false;
  if (a.kind === "Exact" && b.kind === "Exact") return sameLeaf(a.value, b.value);
  if (a.kind === "Band" && b.kind === "Band") {
    return (
      sameLeaf(a.band.estimate, b.band.estimate) &&
      sameLeaf(a.band.low, b.band.low) &&
      sameLeaf(a.band.high, b.band.high)
    );
  }
  return false;
}

/**
 * The leaves of view `n` that differ between two builds, bands left out (see the header), with
 * their `Leaf` in the first build for `perturbExempt`.
 */
function changes(w: World, va: SimViews, n: ViewName, a: unknown, b: unknown, out: string[]): void {
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
  const banded = bandedOf(w);
  const unitAt = unitAtOf(w);
  walkView(
    n,
    a,
    banded,
    (leaf) => {
      // A leaf worked out again in each build (`derivedOf`, checked by `derivedBad`) or ranked by
      // the revenue shown (`rankingBad`) moves with the books or the bands: not compared.
      if (perturbExempt(leaf) || derivedOf(leaf, w, va) !== undefined) return;
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
    },
    unitAt,
  );
}

interface Perturbed {
  /** The observer leaves that followed the perturbed books (leaks). */
  changed: string[];
  /** The scan of the perturbed state's observer and Omniscient builds (1 to 3). */
  scan: Scan;
}

/** The view builders with view `name`'s build followed by `plant` (a negative case's leak). */
function overrideView<N extends ViewName>(
  name: N,
  plant: (v: SimViews[N]["data"], input: ViewInput) => void,
): ViewBuilders {
  const b = VIEW_BUILDERS[name] as unknown as ViewBuilder<SimViews[N]["data"]>;
  const build = b.build!;
  const slot = {
    ...b,
    build: (input: ViewInput) => {
      const v = build(input);
      plant(v, input);
      return v;
    },
  };
  return { ...VIEW_BUILDERS, [name]: slot } as unknown as ViewBuilders;
}

/**
 * The perturbed copy of a Sim's World at its tick (the negative cases perturb one state many
 * times; the World object is the same as the Sim runs, so its clock keys the copy too).
 */
const PERTURBED = new WeakMap<World, { clock: string; p: World }>();
function perturbedOf(w: World): World {
  const clock = JSON.stringify(w.clock);
  let e = PERTURBED.get(w);
  if (e === undefined || e.clock !== clock) {
    e = { clock, p: perturbBooks(w) };
    PERTURBED.set(w, e);
  }
  return e.p;
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
  const p = perturbedOf(w);
  const rawA = simViewsBuild({ world: w, controls: off, seed, map }, builders);
  const rawB = simViewsBuild({ world: p, controls: off, seed, map }, builders);
  // The rankings by revenue shown, before `canonical` sorts them away (the perturbed build's are
  // in `changed` too; its derived leaves are in its scan's shape).
  const changed: string[] = [
    ...rankingBad(rawA).map((x) => `state: ${x}`),
    ...rankingBad(rawB).map((x) => `perturbed: ${x}`),
    ...derivedBad(w, rawA, "state"),
  ];
  const a = canonViews(rawA);
  const b = canonViews(rawB);
  const t = canonViews(simViewsBuild({ world: p, controls: on, seed, map }, builders));
  for (const n of PORTED) changes(w, a, n, a[n].data, b[n].data, changed);
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

// The tests are long and synchronous: without a macrotask between them, the worker cannot answer
// Vitest's progress calls, which time out after 60 s of a file's run ("onTaskUpdate").
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

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
    // Q1's recap (built in its pre-quarter-end week) is in, with banded pages and projections.
    const v = simViews(sim);
    expect(v.recap.data.recaps.some((q) => q.companies.some((p) => p.estimated))).toBe(true);
    expect(v.projection.data.companies.length).toBeGreaterThan(0);
    checkNow(sim);
  }, 120_000);

  // The negative cases of the views that need a recap and a locked plan (so the Q1 state):
  // v_projection, v_recap, v_map_layers, and a private truth in a publishing company's row.
  it("catches leaks planted at Q1 in the plan, the recap and the map layers", () => {
    const w = simWorld(sim);
    const [observer, omniscient] = builds(sim);
    const scanPlanted = (plant: (v: SimViews) => void): Scan => {
      const v = structuredClone(observer);
      plant(v);
      return scan(w, v, omniscient);
    };
    const flagged = (r: Scan) => [...r.shape, ...r.bad, ...r.leaks];
    expect(flagged(scanPlanted(() => {}))).toEqual([]);

    // The locked plan shown to the observer (spec 1, D252).
    const pj = omniscient.projection.data.companies.findIndex((r) => r.plan !== null);
    expect(pj, "a company with a locked plan").toBeGreaterThanOrEqual(0);
    const plan = omniscient.projection.data.companies[pj]!.plan;
    expect(
      scanPlanted((v) => put(v.projection.data.companies[pj]!, "plan", plan)).shape.length,
    ).toBeGreaterThan(0);

    // A banded recap page's consensus served exact (D420): the shape sees it (in its own slot it
    // is no truth: the two builds agree there); the true value as a plain number the page may
    // hold (its confidence) is a leak the scan sees.
    const rq = observer.recap.data.recaps.length - 1;
    const rp = observer.recap.data.recaps[rq]!.companies.findIndex((p) => p.estimated);
    expect(rp, "a banded recap page").toBeGreaterThanOrEqual(0);
    const trueConsensus = omniscient.recap.data.recaps[rq]!.companies[rp]!.expected.consensus;
    const page = (v: SimViews) => v.recap.data.recaps[rq]!.companies[rp]!;
    expect(trueConsensus.kind).toBe("Exact");
    expect(
      scanPlanted((v) => put(page(v).expected, "consensus", trueConsensus)).shape.length,
    ).toBeGreaterThan(0);
    const asConfidence = scanPlanted((v) => put(page(v), "confidence_factor", figureShown(trueConsensus)));
    expect(asConfidence.shape).toEqual([]);
    expect(asConfidence.leaks.length).toBeGreaterThan(0);

    // A banded unit's assets on the map (D436, D701; the row names no company): exact in its slot
    // fails the shape, and the true value in the map's development tracks (about no subject) is
    // a leak the scan sees.
    const ua = observer.map_layers.data.unit_assets.findIndex((u) => u.gross_assets.kind === "Band");
    expect(ua, "a banded unit on the map").toBeGreaterThanOrEqual(0);
    const trueAssets = omniscient.map_layers.data.unit_assets[ua]!.gross_assets;
    expect(
      scanPlanted((v) => put(v.map_layers.data.unit_assets[ua]!, "gross_assets", trueAssets)).shape.length,
    ).toBeGreaterThan(0);
    const inTracks = scanPlanted((v) => {
      v.map_layers.data.tracks[0]![0] = figureShown(trueAssets);
    });
    expect(inTracks.leaks.length).toBeGreaterThan(0);
    // An HQ pin's revenue exact for a banded company.
    const hq = observer.map_layers.data.hqs.findIndex((h) => showsEstimates(w, h.company));
    const trueRev = omniscient.map_layers.data.hqs[hq]!.revenue;
    expect(
      scanPlanted((v) => put(v.map_layers.data.hqs[hq]!, "revenue", trueRev)).shape.length,
    ).toBeGreaterThan(0);

    // Derived leaks only the perturbation sees (4).
    // The true expected surprise, rounded to 0.1%: equals no truth, but follows the true books.
    // The recap's pages are worked out from the shown estimates (`derivedOf`), so it fails.
    const trueSurprise = overrideView("recap", (v, input) => {
      v.recaps.forEach((q, k) => {
        q.companies.forEach((p, i) => {
          const t = input.world.recaps[k]!.companies[i]!.expected.expected_surprise;
          if (p.estimated) p.expected.expected_surprise = roundHalfAway(t * 1000) / 1000;
        });
      });
    });
    const ps = perturbation(sim, trueSurprise);
    expect(ps.changed.length, "the true surprise rounded").toBeGreaterThan(0);
    expect(ps.scan.leaks, "the true surprise rounded: the scan alone misses it").toEqual([]);
    // A private company's cash in a publishing company's row: a publishing company's figures are
    // public, so the scan drops that truth (two companies can share books by the data,
    // company-start.csv), but the published row now follows a private book.
    const privateCash = overrideView("company_detail", (v, input) => {
      const priv = input.world.companies.findIndex((_, i) => showsEstimates(input.world, i as CompanyId));
      const d = v.companies.find((r) => !r.estimated)!;
      d.cash_usd = { kind: "Exact", value: input.world.companies[priv]!.cash_usd };
    });
    const pc = perturbation(sim, privateCash);
    expect(pc.changed.length, "a private cash in a published row").toBeGreaterThan(0);
    expect(pc.scan.shape, "a private cash in a published row: the shape passes").toEqual([]);
    // The clean builders, for contrast (checkNow ran them at this state).
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

  // The unit and industry subjects (D432, D436, D437), and the one named exception.
  it("the unit and industry views, and only the named exception", () => {
    const units = omniscient.units.data.units;
    const shownUnits = observer.units.data.units;
    // A published company's unit in an estimated industry: its figures are bands (D436).
    const j = shownUnits.findIndex((u) => !showsEstimates(w, u.company) && u.estimated);
    expect(j, "a published company's unit in an estimated industry").toBeGreaterThanOrEqual(0);
    const rev = units[j]!.revenue_m;
    const ind = observer.industry_rows.data.rows.findIndex((r) => r.estimated);
    const plants: [string, (v: SimViews) => void, "shape" | "leaks"][] = [
      ["its revenue served exact", (v) => put(v.units.data.units[j]!, "revenue_m", rev), "shape"],
      ["its flag", (v) => put(v.units.data.units[j]!, "estimated", false), "shape"],
      [
        "an estimated industry's supply exact",
        (v) => put(v.industry_rows.data.rows[ind]!, "supply", exact(1234.5)),
        "shape",
      ],
      [
        "its revenue in another view",
        (v) => put(detail(v), "buzz", rev.kind === "Exact" ? rev.value : 0),
        "leaks",
      ],
      // The exception excuses a unit's productivity in a statement's productivity, nothing else.
      [
        "another truth in a statement's productivity",
        (v) => put(operating(v), "productivity", rev.kind === "Exact" ? rev.value : 0),
        "leaks",
      ],
    ];
    expect(rev.kind).toBe("Exact");
    expect(ind).toBeGreaterThanOrEqual(0);
    for (const [what, plant, check] of plants) {
      expect(scanPlanted(plant)[check].length, what).toBeGreaterThan(0);
    }
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
      plant: (row: Record<string, unknown>, c: Company, s: Stock) => void,
    ): ViewBuilders => {
      const b = VIEW_BUILDERS[name] as unknown as ViewBuilder<Record<string, Record<string, unknown>[]>>;
      const build = b.build!;
      const slot = {
        ...b,
        build: (input: ViewInput) => {
          const v = build(input);
          for (const row of v.rows ?? v.companies ?? []) {
            const id = row.id as CompanyId;
            const w = input.world;
            if (showsEstimates(w, id)) plant(row, w.companies[id]!, w.market.stocks[id]!);
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
    // Review hole 6: values the state caches from the books (leak_perturb.ts perturbs them too),
    // each into its own field of a banded row, in one build.
    const cached = {
      ...leaky("company_detail", (r, c, s) => {
        put(r, "buzz", s.last_surprise);
        put(r, "price", roundHalfAway((s.basis.e_norm ?? 0) / 1e6));
        put(r, "confidence_factor", c.loss_quarters);
        put(r, "management_score", roundHalfAway((c.plan?.operating.min_cash ?? 0) / 1e6));
      }),
      company_rows: leaky("company_rows", (r, c, s) =>
        put(r, "name", s.tags.loss ? `${c.name} (loss)` : c.name),
      ).company_rows,
    };
    const pc = perturbation(sim, cached);
    for (const [what, field] of [
      ["the last surprise", "buzz"],
      ["E_norm in $M", "price"],
      ["the loss quarters", "confidence_factor"],
      ["a plan's minimum cash in $M", "management_score"],
      ["the loss tag in a name", "name"],
    ]) {
      expect(
        pc.changed.filter((x) => x.includes(`.${field}: `)),
        what,
      ).not.toEqual([]);
    }
    // The clean builders, for contrast.
    expect(perturbation(sim).changed).toEqual([]);
  }, 120_000);

  // Review hole 6: the perturbation changed the primary books only, so a value the state caches
  // from them (the last surprise, E_norm, the loss tag) stayed and a view could show it.
  it("the perturbation moves every number of a banded company but the kept ones (review hole 6)", () => {
    const p = perturbBooks(w);
    const moved = new Set<string>();
    const kept = new Set<string>();
    const bad: string[] = [];
    const walk = (x: unknown, y: unknown, path: string): void => {
      if (typeof x === "number") {
        const why = keptWhy(path);
        if (why !== null) {
          kept.add(why);
          if (!sameLeaf(x, y)) bad.push(`${path} is kept (${why}) but moved`);
        } else if (sameLeaf(x, y)) bad.push(`${path} did not move`);
        else moved.add(path);
      } else if (Array.isArray(x) && Array.isArray(y)) {
        x.forEach((e, i) => {
          walk(e, y[i], `${path}[]`);
        });
      } else if (isRecord(x) && isRecord(y) && !isDateLike(x)) {
        for (const k of Object.keys(x)) walk(x[k], y[k], `${path}.${k}`);
      }
    };
    for (const id of bandedCompanies(w)) {
      const c = w.companies[id]!;
      // A year rebuilt from its four quarters (leak_perturb.ts) moves with them; its own fields
      // are checked through the quarters.
      walk(
        { ...c, finance: { ...c.finance, archive: { quarters: c.finance.archive.quarters } } },
        {
          ...p.companies[id]!,
          finance: {
            ...p.companies[id]!.finance,
            archive: { quarters: p.companies[id]!.finance.archive.quarters },
          },
        },
        "company",
      );
      for (const u of c.units) walk(w.units[u], p.units[u], "unit");
      walk(w.market.stocks[id], p.market.stocks[id], "stock");
      const [a, b] = [w.market.stocks[id]!.tags, p.market.stocks[id]!.tags];
      if (a.loss === b.loss || a.record_quarter === b.record_quarter) bad.push(`stock ${id}: tags kept`);
      if (a.surprise !== null && a.surprise === b.surprise) bad.push(`stock ${id}: surprise tier kept`);
    }
    expect(bad.slice(0, 20)).toEqual([]);
    for (const f of [
      "stock.last_surprise",
      "stock.basis.e_norm",
      "stock.basis.growth_factor",
      "company.loss_quarters",
    ]) {
      expect(moved.has(f), f).toBe(true);
    }
    // Every reason of `KEPT` is in use at this state but the vote's and a director's (no IPO vote
    // or born company yet).
    const unused = KEPT.map(([, why]) => why).filter((why) => !kept.has(why));
    expect(unused).toEqual([]);
  });

  // The second adversarial review's misses (PR #96): leaves once exempted, and the band distance
  // switched off for whole views. Each is now worked out again in every build (`derivedOf`,
  // `rankingBad`; the sum bands of leak_rules.ts `SUM_BAND_PATHS` from the shown parts).
  it("an EFV not a quoted company's (review hole 1)", () => {
    // A private company has a V and an EFV error (0 until a listing draws one), so an EFV.
    const priv = bandedCompanies(w).find(
      (id) => w.market.stocks[id]!.exchange === null && w.market.stocks[id]!.value > 0,
    )!;
    const s = w.market.stocks[priv]!;
    const efv = s.value * (1.0 + s.efv_error);
    const plants: Plant[] = [
      // A quote row for a private company, its EFV V × (1 + e).
      [
        "a private company's quote",
        (v) => {
          const row = { ...v.quotes.data.rows[0]!, id: priv as CompanyId, efv, efv_low: efv, efv_high: efv };
          v.quotes.data.rows.push(row);
        },
      ],
      // A quoted company's EFV replaced by a private one's.
      ["a private EFV in a quote", (v) => put(v.quotes.data.rows[0]!, "efv", efv)],
    ];
    for (const [what, plant] of plants) {
      expect(
        scanPlanted(plant).shape.filter((x) => x.includes("quotes.rows[")),
        what,
      ).not.toEqual([]);
    }
  });

  it("a gap statistic from a private book (review hole 2)", () => {
    // A private cash as a small value (simple small: the scan cannot see it).
    const small = roundHalfAway(truth / 1e6) / 1000;
    const r = scanPlanted((v) => put(v.market_stats.data, "median_gap", small));
    expect(r.leaks).toEqual([]);
    expect(r.shape.filter((x) => x.startsWith("market_stats.median_gap"))).not.toEqual([]);
    const within = scanPlanted((v) => put(v.market_stats.data, "within_band", 1)).shape;
    expect(within.filter((x) => x.startsWith("market_stats.within_band"))).not.toEqual([]);
  });

  it("a private revenue in an exact industry total or share (review hole 3)", () => {
    // An industry outside the estimated class (exact totals) with a banded company in it.
    const bandedUnit = w.units.find(
      (u) => showsEstimates(w, u.company) && !observer.industry_rows.data.rows[u.industry]!.estimated,
    )!;
    expect(bandedUnit, "a banded company in an exact industry").toBeDefined();
    const ind = bandedUnit.industry;
    const rev = exact(bandedUnit.revenue_m);
    const published = observer.industry_detail.data.industries[ind]!.companies.findIndex(
      (c) => c.share.kind === "Exact",
    );
    expect(published, "a published company's exact share").toBeGreaterThanOrEqual(0);
    const plants: Plant[] = [
      ["the named revenue", (v) => put(v.industry_rows.data.rows[ind]!, "named_revenue_m", rev)],
      [
        "a published company's share",
        (v) => put(v.industry_detail.data.industries[ind]!.companies[published]!, "share", exact(0.0123)),
      ],
      [
        "the fringe share",
        (v) =>
          put(v.industry_detail.data.industries[ind]!, "fringe_share", exact(bandedUnit.revenue_m / 1e9)),
      ],
    ];
    for (const [what, plant] of plants) {
      const r = scanPlanted(plant);
      expect(r.leaks, `${what}: an exact industry total is public, the scan misses it`).toEqual([]);
      expect(
        r.shape.filter((x) => x.includes("worked out again")),
        what,
      ).not.toEqual([]);
    }
  });

  it("a ranking by the true revenue (review hole 4)", () => {
    const byTruth = (input: ViewInput) => companiesByRevenue(input.world);
    const top = overrideView("industry_rows", (v, input) => {
      const ranked = byTruth(input);
      v.rows.forEach((r, i) => {
        r.top_companies = ranked[i]!.slice(0, TOP_COMPANIES).map(([c]) => c);
      });
    });
    const list = overrideView("industry_detail", (v, input) => {
      const ranked = byTruth(input);
      for (const [i, d] of v.industries.entries()) {
        const at = new Map(ranked[i]!.map(([c], k) => [c, k]));
        d.companies.sort((a, b) => at.get(a.company)! - at.get(b.company)!);
      }
    });
    for (const [what, builders] of [
      ["the top 5", top],
      ["the detail's list", list],
    ] as const) {
      const p = perturbation(sim, builders);
      expect(
        p.changed.filter((x) => x.includes("by the revenue shown")),
        what,
      ).not.toEqual([]);
      expect(p.scan.leaks, `${what}: the scan alone misses it`).toEqual([]);
    }
  }, 120_000);

  it("a single subject's band at its truth in the industry views (review hole 5)", () => {
    /** A band whose estimate is the truth to 4 significant digits. */
    const near = (t: number): Figure => {
      const e = Number(t.toPrecision(4)) === t ? t * 1.0001 : Number(t.toPrecision(4));
      return { kind: "Band", band: { estimate: e, low: e - Math.abs(e) / 4, high: e + Math.abs(e) / 4 } };
    };
    const value = (f: Figure) => (f.kind === "Exact" ? f.value : Number.NaN);
    // A banded company's revenue in an industry's list (the lists pair in id order, `canonical`).
    const di = observer.industry_detail.data.industries.findIndex((d) =>
      d.companies.some((c) => c.revenue_m.kind === "Band"),
    );
    const dc = observer.industry_detail.data.industries[di]!.companies.findIndex(
      (c) => c.revenue_m.kind === "Band",
    );
    const trueRev = value(omniscient.industry_detail.data.industries[di]!.companies[dc]!.revenue_m);
    // An estimated industry's supply (D432).
    const ir = observer.industry_rows.data.rows.findIndex((r) => r.estimated);
    const trueSupply = value(omniscient.industry_rows.data.rows[ir]!.supply);
    expect(di).toBeGreaterThanOrEqual(0);
    expect(ir, "an estimated industry").toBeGreaterThanOrEqual(0);
    const plants: Plant[] = [
      [
        "a company's revenue in the detail",
        (v) => put(v.industry_detail.data.industries[di]!.companies[dc]!, "revenue_m", near(trueRev)),
      ],
      [
        "an estimated industry's supply",
        (v) => put(v.industry_rows.data.rows[ir]!, "supply", near(trueSupply)),
      ],
    ];
    for (const [what, plant] of plants) {
      expect(
        scanPlanted(plant).bad.filter((x) => x.includes(`within ${BAND_MIN_ERROR}`)),
        what,
      ).not.toEqual([]);
    }
  });
  it("an estimated industry's sum bands centred on the truth (review hole 7)", () => {
    /** A band whose estimate is the truth to 4 significant digits, the truth strictly inside. */
    const near = (t: number): Figure => {
      const e = Number(t.toPrecision(4)) === t ? t * 1.0001 : Number(t.toPrecision(4));
      return { kind: "Band", band: { estimate: e, low: e - Math.abs(e) / 4, high: e + Math.abs(e) / 4 } };
    };
    const value = (f: Figure) => (f.kind === "Exact" ? f.value : Number.NaN);
    // An estimated industry (D432) with a company in its detail list.
    const ir = observer.industry_rows.data.rows.findIndex(
      (r, i) => r.estimated && observer.industry_detail.data.industries[i]!.companies.length > 0,
    );
    expect(ir, "an estimated industry with companies").toBeGreaterThanOrEqual(0);
    const trueNamed = value(omniscient.industry_rows.data.rows[ir]!.named_revenue_m);
    const shownDetail = observer.industry_detail.data.industries[ir]!;
    const trueDetail = omniscient.industry_detail.data.industries[ir]!;
    const company = shownDetail.companies[0]!.company;
    const trueShare = value(trueDetail.companies.find((c) => c.company === company)!.share);
    const trueFringe = value(trueDetail.fringe_share);
    const plants: Plant[] = [
      [
        "the named revenue band",
        (v) => put(v.industry_rows.data.rows[ir]!, "named_revenue_m", near(trueNamed)),
      ],
      [
        "a company's share band in the detail",
        (v) => put(v.industry_detail.data.industries[ir]!.companies[0]!, "share", near(trueShare)),
      ],
      [
        "the detail's fringe share band",
        (v) => put(v.industry_detail.data.industries[ir]!, "fringe_share", near(trueFringe)),
      ],
    ];
    for (const [what, plant] of plants) {
      const r = scanPlanted(plant);
      // The truth is inside and the distance is not checked for a sum band: only the recomputation
      // from the shown unit bands catches it.
      expect(
        r.bad.filter((x) => x.includes("not strictly in")),
        what,
      ).toEqual([]);
      expect(
        r.shape.filter((x) => x.includes("worked out again")),
        what,
      ).not.toEqual([]);
    }
  });
});
