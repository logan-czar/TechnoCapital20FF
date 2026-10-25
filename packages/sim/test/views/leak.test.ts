// The sim-side half of crates/game/tests/m9_leak.rs (M9.8, D574): with Omniscient off, no view
// may hold a true private figure. Rust scans the game's rendered text; here the view data itself
// is scanned, which is stricter (every number, not its rounded rendering). Not a Rust file.
//
// The truth comes from the same state with Omniscient on (a debug Sim, D961): the views that
// follow the toggle rebuild at once (D423), so the two builds differ only by Omniscient. Walking
// both side by side, every figure the observer sees as a band and Omniscient as exact gives one
// truth; the band must hold it strictly inside (D422). For v_statements, whose banded companies
// hold estimates instead of the archive, the truths are every line of the Omniscient statements
// but the compute and licences line (exact, D434), and the held TB. Then every number anywhere in
// the observer's views (every ported view) must differ from every truth.
//
// Run on seed 1 at load and after Q1 2020's release and recap (the views then hold a quarter of
// in-play statements, the first born companies and listings). Views are added to the scan as
// they are ported: the scan walks every view `viewIsPorted` says is built.
import { describe, expect, it } from "vitest";
import { simApply, simNew, simViews, simWorld } from "../../src/lib.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import type { Statement } from "../../src/types/state/finance.ts";
import { STATEMENT_LINE_VALUES } from "../../src/types/views/estimate.ts";
import { type SimViews, VIEW_NAMES } from "../../src/types/views/index.ts";
import type { StatementsView } from "../../src/types/views/statements.ts";
import { showsEstimates, statementLineOf } from "../../src/views/estimate.ts";
import { simViewsClone, viewIsPorted } from "../../src/views/index.ts";
import { data, unwrap } from "../common/index.ts";
import { runTo } from "../common/ops.ts";

type Truths = Map<number, string>;

/** Records a truth worth scanning for: a figure with a non-zero digit (a 0 says nothing). */
function addTruth(truths: Truths, x: number, where: string): void {
  if (x !== 0 && Number.isFinite(x) && !truths.has(x)) truths.set(x, where);
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Walks the observer's and Omniscient's builds of one view side by side. */
function pair(shown: unknown, truth: unknown, where: string, truths: Truths, bad: string[]): void {
  if (Array.isArray(shown) && Array.isArray(truth)) {
    const n = Math.min(shown.length, truth.length);
    for (let i = 0; i < n; i++) pair(shown[i], truth[i], `${where}[${i}]`, truths, bad);
    return;
  }
  if (!isRecord(shown) || !isRecord(truth)) return;
  if (shown.kind === "Band" && truth.kind === "Exact") {
    const b = shown.band as { estimate: number; low: number; high: number };
    const t = truth.value as number;
    addTruth(truths, t, where);
    if (!(b.low < t && t < b.high && b.estimate !== t))
      bad.push(`${where}: ${t} not strictly in ${JSON.stringify(b)}`);
    return;
  }
  for (const k of Object.keys(shown)) pair(shown[k], truth[k], `${where}.${k}`, truths, bad);
}

/** The truths of v_statements' banded companies (their archive is not in the observer's view). */
function statementTruths(shown: StatementsView, truth: StatementsView, truths: Truths): void {
  shown.companies.forEach((c, i) => {
    if (!c.estimated) return;
    const t = truth.companies[i]!;
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

/**
 * Every figure in a view's data, with its path: the numbers that are not whole. Ids, counts,
 * shares and dates are whole numbers (Rust integers, which its scan of `Debug` text leaves out
 * as well), and the 2019 history's round figures would match them by coincidence.
 */
//
// A published figure is public: an exact `Figure` and a publishing company's statements (the
// only ones v_statements holds) are left out, since several starting companies share their
// starting books (company-start.csv), so a published company's 2019 lines can equal a private
// one's by the data, not by a view.
function numbers(x: unknown, where: string, out: [number, string][]): void {
  if (typeof x === "number") {
    if (!Number.isInteger(x)) out.push([x, where]);
  } else if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) numbers(x[i], `${where}[${i}]`, out);
  } else if (isRecord(x)) {
    if (x.kind === "Exact" && typeof x.value === "number") return;
    for (const k of Object.keys(x)) {
      if (where.startsWith("statements.companies[") && (k === "quarters" || k === "years")) continue;
      numbers(x[k], `${where}.${k}`, out);
    }
  }
}

function scan(observer: SimViews, omniscient: SimViews): { leaks: string[]; bad: string[]; truths: number } {
  const truths: Truths = new Map();
  const bad: string[] = [];
  const ported = VIEW_NAMES.filter((n) => viewIsPorted(n));
  for (const n of ported) pair(observer[n].data, omniscient[n].data, n, truths, bad);
  statementTruths(observer.statements.data, omniscient.statements.data, truths);
  const leaks: string[] = [];
  for (const n of ported) {
    const all: [number, string][] = [];
    numbers(observer[n].data, n, all);
    for (const [x, where] of all) {
      const t = truths.get(x);
      if (t !== undefined) leaks.push(`${where} = ${x}, the truth of ${t}`);
    }
  }
  return { leaks, bad, truths: truths.size };
}

describe("leak", () => {
  it("no view holds a true private figure with Omniscient off", () => {
    const sim = unwrap(simNew(data(), 1, { debug: true }), "Sim::new");
    const check = () => {
      const w = simWorld(sim);
      expect(w.companies.some((_, i) => showsEstimates(w, i as never))).toBe(true);
      const observer = simViewsClone(simViews(sim));
      expect(unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "Omniscient on")).toBeDefined();
      const omniscient = simViewsClone(simViews(sim));
      unwrap(simApply(sim, { kind: "SetOmniscient", on: false }), "Omniscient off");
      const r = scan(observer, omniscient);
      expect(r.truths, "the scan has truths to look for").toBeGreaterThan(1000);
      expect(r.bad.slice(0, 20)).toEqual([]);
      expect(r.leaks.slice(0, 20)).toEqual([]);
    };
    check();
    // After Q1 2020's release (2 April) and the Q2 recap week.
    runTo(sim, simDateYmd(2020, 6, 26));
    check();
  }, 300_000);
});
