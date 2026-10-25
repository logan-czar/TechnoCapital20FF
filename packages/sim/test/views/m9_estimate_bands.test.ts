// Port of crates/sim/tests/m9_estimate_bands.rs: estimate bands (D420 to D434; Logan's 2026-10-21
// rulings replacing spec 1's "?"): over a two-year run, every money and data figure the views give
// for a company that does not publish (private, or a new listing before its first release after
// listing, spec 5.20.1) is a band whose endpoints and estimate are never the true value; no true
// value of such a company appears anywhere in its rows of the views while Omniscient is off; an
// industry with one or two such companies shows its totals as bands; averaging a company's revenue
// estimates does not find its revenue; and the 5.9 data book no longer rebuilds a monthly revenue.
// A company that publishes shows exact figures.
//
// Each view is checked on the ticks it is rebuilt (its dirty flag), against the world as it stands
// after that tick: the state it was built from.
//
// Expects:
//   ../../src/lib.ts                  simNew, simStep, simNow, simWorld, simViews, simControls
//   ../../src/economy/supply.ts       M_MAX, M_MIN, pPre(unit, company)
//   ../../src/finance/statements.ts   trailingFour(statements) -> Ledger | null, ledgerNetIncome
//   ../../src/market/fair_value.ts    shownValue(value, omniscient)
//   ../../src/market/projection.ts    range(consensus, width) -> [lo, hi]   [market::projection::range]
//   ../../src/ops/data.ts             RETENTION_MONTHS, decayRate(held, decay_base),
//                                        dataBookUnstructuredTb(book)          [DataBook::unstructured_tb]
//   ../../src/world/entities.ts       businessUnitAssetsEff(u), businessUnitEbitM(u)
//   ../../src/world/index.ts          worldIndustryEstimatedAt(world, industry, clock)
//                                        [World::industry_estimated_at]
//   ../../src/views/estimate.ts       showsEstimates(world, company), statementLineOf(line, st)
//                                        [StatementLine::of], statementLineLabel(line)
//   ../../src/views/statements.ts     published(statement, clock)
//   ../../src/views/industry_rows.ts  companiesByRevenue(world) -> [CompanyId, number][][]
//                                        (per industry, revenue-ranked)
//   ../common/index.ts                   assertFigure
//
// Changed from the Rust:
// - Debug dumps (`format!("{r:?}")`) are JSON.stringify of the view row. The scan extracts
//   numeric tokens and looks them up in a set of String(truth): both sides use the same shortest
//   round-trip digits, so the check is the same (a true value appearing anywhere in the row).
// - Seed 6 is the new generator (D951). The thresholds are statistical and came from Rust's seed
//   6 draws: banded_seen > 184, a listing in play, an estimated industry, checked > 100,
//   kept_banded > 0, m_probes >= 20 with 80% exact, off*10 >= judged*9, probes > 100. They hold
//   structurally (they count 2 years of 651 companies) but if one fails for lack of events, try
//   another seed before suspecting the engine; the equalities (probe_exact == probes,
//   m_shown_exact == 0, probe_fooled == probes) are properties of the estimate noise (D429, D436).
// - Maps keyed by tuples use string keys.
import { describe, expect, it } from "vitest";
import { M_MAX, M_MIN, pPre } from "../../src/economy/supply.ts";
import { ledgerNetIncome, trailingFour } from "../../src/finance/statements.ts";
import { simControls, simNew, simNow, simStep, simViews, simWorld } from "../../src/lib.ts";
import { shownValue } from "../../src/market/fair_value.ts";
import { range as projectionRange } from "../../src/market/projection.ts";
import { dataBookUnstructuredTb, decayRate, RETENTION_MONTHS } from "../../src/ops/data.ts";
import {
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  quarterPrev,
  simDateIsQuarterFirstMonth,
  simDateQuarter,
  simDateYmd,
} from "../../src/time/calendar.ts";
import type { Quarter } from "../../src/types/calendar.ts";
import type { CompanyId, IndustryId, UnitId } from "../../src/types/ids.ts";
import type { Statement } from "../../src/types/state/finance.ts";
import type { Figure, StatementLine } from "../../src/types/views/estimate.ts";
import { STATEMENT_LINE_VALUES } from "../../src/types/views/estimate.ts";
import type { UnitRow } from "../../src/types/views/units.ts";
import { INDUSTRY_UNPUBLISHED_BELOW, USD_PER_MILLION, type World } from "../../src/types/world.ts";
import { showsEstimates, statementLineLabel, statementLineOf } from "../../src/views/estimate.ts";
import { companiesByRevenue } from "../../src/views/industry_rows.ts";
import { published } from "../../src/views/statements.ts";
import { businessUnitAssetsEff, businessUnitEbitM } from "../../src/world/entities.ts";
import { worldIndustryEstimatedAt } from "../../src/world/index.ts";
import { zeroLedger } from "../common/defaults.ts";
import { assertFigure, data, macrotask, unwrap } from "../common/index.ts";
import { byField, byId, figExact, figIsBand, figShown } from "../common/views.ts";

/** The numbers in a dump: runs of digits, '.', '-', '+' and 'e'. */
function numbers(s: string): string[] {
  return s.split(/[^0-9.\-+e]/).filter((t) => /[0-9]/.test(t));
}

/**
 * Money figures this small are left out of the text scan (scores, counts and shares sit in the
 * same rows); the structural checks still cover them.
 */
const SCAN_MIN_USD = 1_000.0;
/** The same for TB figures. */
const SCAN_MIN_TB = 1.0;

function debugSet(values: Iterable<number>, min: number): Set<string> {
  const out = new Set<string>();
  for (const x of values) {
    if (Math.abs(x) >= min && !Number.isInteger(x)) out.add(String(x));
  }
  return out;
}

/** Every true money and data value of company `id` the views could show, as digit strings. */
function truths(w: World, id: CompanyId): Set<string> {
  const c = w.companies[id] as World["companies"][number];
  const s = w.market.stocks[id] as World["market"]["stocks"][number];
  const out: number[] = [
    c.cash_usd,
    c.finance.line.drawn,
    c.finance.line.limit,
    shownValue(s.fair_value, false),
    shownValue(s.value, false),
    s.consensus_ni,
    s.projection_ni,
    c.revenue_usd,
  ];
  const quarters = c.finance.archive.quarters;
  const n = quarters.filter((q) => published(q, w.clock)).length;
  const ttm = trailingFour(quarters.slice(0, n)) ?? zeroLedger();
  out.push(ttm.revenue, ledgerNetIncome(ttm));
  for (const st of [...quarters, ...c.finance.archive.years]) {
    for (const l of STATEMENT_LINE_VALUES) if (l !== "Shared") out.push(statementLineOf(l, st));
  }
  for (const uid of c.units) {
    const u = w.units[uid] as World["units"][number];
    out.push(
      u.gross_assets,
      u.asset_book,
      businessUnitAssetsEff(u),
      u.revenue_m,
      u.variable_m,
      u.fixed_m,
      u.rd_m,
      u.dep_m,
      businessUnitEbitM(u),
      u.capex_m,
    );
  }
  for (const r of w.recaps) {
    const p = r.companies.find((p) => p.company === id);
    if (p !== undefined) out.push(p.range[0], p.range[1], p.expected.projection, p.expected.consensus);
  }
  const set = debugSet(out, SCAN_MIN_USD);
  const tb: number[] = [];
  for (const d of c.data) {
    const p = (w.industries[d.industry] as World["industries"][number]).params;
    const b = d.book;
    tb.push(
      b.held,
      dataBookUnstructuredTb(b),
      b.held + dataBookUnstructuredTb(b),
      b.held * decayRate(b.held, p.data_decay_base),
    );
  }
  for (const st of [...quarters, ...c.finance.archive.years]) tb.push(st.key.held_tb);
  for (const t of debugSet(tb, SCAN_MIN_TB)) set.add(t);
  return set;
}

function assertNoTruth(dump: unknown, truthSet: Set<string>, what: string): void {
  for (const t of numbers(JSON.stringify(dump))) {
    expect(truthSet.has(t), `${what}: the true value ${t} is in the view`).toBe(false);
  }
}

function estLine(e: { lines: Figure[] }, l: StatementLine): Figure {
  return e.lines[STATEMENT_LINE_VALUES.indexOf(l)] as Figure;
}

function lineFigures(banded: boolean, s: Statement, f: [StatementLine, Figure][]): void {
  for (const [l, fig] of f) {
    if (l === "Shared") {
      expect(figExact(fig), "the compute line is exact (D434)").toBe(statementLineOf(l, s));
    } else {
      assertFigure(fig, statementLineOf(l, s), banded, statementLineLabel(l));
    }
  }
}

/**
 * The 5.9 data book run backwards (the review's probe): from held and unstructured TB at two
 * month closes, the TB created in the month, so the month's revenue. With no data dropped (fewer
 * than 12 buckets before), held1 = m x (1 - rate(m)) with m = held0 + converted, and created =
 * unstructured1 - unstructured0 + converted.
 */
function rebuiltRevenue(
  h0: number,
  u0: number,
  h1: number,
  u1: number,
  decayBase: number,
  tbPerMusd: number,
): number {
  const f = (m: number): number => m * (1 - decayRate(m, decayBase)) - h1;
  let lo = Math.max(Math.min(h1, h0), 0) * 0.5;
  let hi = h1 * 2 + 10;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  const converted = 0.5 * (lo + hi) - h0;
  return ((u1 - u0 + converted) / tbPerMusd) * USD_PER_MILLION;
}

/** How close the probe gets on the true book: a rebuild this close is exact. */
const PROBE_EXACT = 1e-6;

/** A published peer's true unit and data figures, for the scan of its unit and tech rows. */
function unitTruths(w: World, id: CompanyId): Set<string> {
  const c = w.companies[id] as World["companies"][number];
  const money: number[] = [];
  const tb: number[] = [];
  for (const uid of c.units) {
    const u = w.units[uid] as World["units"][number];
    money.push(
      u.gross_assets,
      u.asset_book,
      businessUnitAssetsEff(u),
      u.revenue_m,
      u.variable_m,
      u.fixed_m,
      u.rd_m,
      u.dep_m,
      businessUnitEbitM(u),
      u.capex_m,
    );
  }
  for (const d of c.data) {
    const p = (w.industries[d.industry] as World["industries"][number]).params;
    const b = d.book;
    tb.push(
      b.held,
      dataBookUnstructuredTb(b),
      b.held + dataBookUnstructuredTb(b),
      b.held * decayRate(b.held, p.data_decay_base),
    );
  }
  const set = debugSet(money, SCAN_MIN_USD);
  for (const t of debugSet(tb, SCAN_MIN_TB)) set.add(t);
  return set;
}

/** A unit at the last month close: true and shown assets_eff and p_pre (the M probe's inputs). */
interface UnitSnap {
  assets_eff: number;
  p_pre: number;
  shown_assets_eff: number;
  shown_p_pre: number;
}

/** One month close's data book of a banded company: true and shown held and unstructured TB. */
interface Book {
  held: number;
  unstructured: number;
  buckets: number;
  shown_held: number;
  shown_unstructured: number;
}

describe("m9 estimate bands", () => {
  it("private_figures_are_bands_that_never_show_the_truth", async () => {
    const sim = unwrap(simNew(data(), 6), "Sim::new");
    const end = dateTimeMidnight(simDateYmd(2022, 1, 3));
    const bandedSeen = new Set<CompanyId>();
    const listedInPlay = new Set<CompanyId>();
    const estimatedIndustries = new Set<IndustryId>();
    let checks = 0;
    // Revenue estimates and truths per company, for the averaging check (D429).
    const revenue = new Map<CompanyId, [number, number]>();
    const revOf = (id: CompanyId): [number, number] => {
      let e = revenue.get(id);
      if (e === undefined) {
        e = [0, 0];
        revenue.set(id, e);
      }
      return e;
    };
    const books = new Map<CompanyId, Book>();
    let probes = 0;
    let probeExact = 0;
    let probeFooled = 0;
    // The review's M probe (D436): attempts, exact on the true figures, exact on the shown.
    let mProbes = 0;
    let mExact = 0;
    let mShownExact = 0;
    const snaps = new Map<UnitId, UnitSnap>();
    // Each industry's class at each quarter's close, as the live row showed it (D437).
    const classAtClose = new Map<string, boolean>();
    const key = (i: IndustryId, q: Quarter): string => `${i}|${q.year}|${q.q}`;
    while (simNow(sim) < end) {
      simStep(sim);
      // Let the Vitest worker answer its RPC once a simulated day (common/index.ts `macrotask`).
      if (dateTimeHour(simNow(sim)) === 0) await macrotask();
      expect(simControls(sim).omniscient).toBe(false);
      const w = simWorld(sim);
      const v = simViews(sim);
      const clockDate = dateTimeDate(w.clock);
      const midnight = dateTimeHour(w.clock) === 0;
      const monthClose = clockDate.day === 1 && midnight;
      const banded = w.companies.map((_, id) => showsEstimates(w, id as CompanyId));
      const isBanded = (id: CompanyId): boolean => banded[id] as boolean;
      const classes = w.industries.map((_, i) => worldIndustryEstimatedAt(w, i as IndustryId, w.clock));
      // A unit's figures are bands for a company that does not publish, or any company in an
      // estimated industry (D436).
      const unitB = (id: CompanyId): boolean =>
        isBanded(id) || (classes[(w.companies[id] as World["companies"][number]).industry] as boolean);
      const truthCache: (Set<string> | undefined)[] = new Array(banded.length).fill(undefined);
      const truthsOf = (id: CompanyId): Set<string> => {
        let t = truthCache[id];
        if (t === undefined) {
          t = truths(w, id);
          truthCache[id] = t;
        }
        return t;
      };
      w.market.stocks.forEach((s, id) => {
        if (s.listed_on !== null) listedInPlay.add(id as CompanyId);
      });

      if (v.cap_table.dirty) {
        w.companies.forEach((c, id) => {
          const t = byField(v.cap_table.data.companies, "company", id as CompanyId);
          expect(t?.lines.reduce((acc, l) => acc + l.shares, 0)).toBe(c.shares_out);
        });
      }
      if (v.company_rows.dirty) {
        for (const r of v.company_rows.data.rows) {
          const b = isBanded(r.id);
          expect(r.estimated).toBe(b);
          const c = w.companies[r.id] as World["companies"][number];
          const q = c.finance.archive.quarters;
          const n = q.filter((s) => published(s, w.clock)).length;
          const ttm = trailingFour(q.slice(0, n)) ?? zeroLedger();
          assertFigure(r.revenue_ttm, ttm.revenue, b, "revenue TTM");
          assertFigure(r.net_income_ttm, ledgerNetIncome(ttm), b, "net income TTM");
          const s = w.market.stocks[r.id] as World["market"]["stocks"][number];
          if (s.exchange === null) assertFigure(r.value, shownValue(s.fair_value, false), b, "value");
          if (b) {
            bandedSeen.add(r.id);
            assertNoTruth(r, truthsOf(r.id), "v_company_row");
            const e = revOf(r.id);
            e[0] += figShown(r.revenue_ttm);
            e[1] += ttm.revenue;
          }
          checks += 1;
        }
      }
      if (v.company_detail.dirty) {
        for (const d of v.company_detail.data.companies) {
          const b = isBanded(d.id);
          const c = w.companies[d.id] as World["companies"][number];
          assertFigure(d.cash_usd, c.cash_usd, b, "cash");
          assertFigure(d.line_drawn_usd, c.finance.line.drawn, b, "line drawn");
          assertFigure(d.line_limit_usd, c.finance.line.limit, b, "line limit");
          const s = w.market.stocks[d.id] as World["market"]["stocks"][number];
          if (s.exchange === null) {
            assertFigure(d.shown_value_per_share, shownValue(s.value, false), b, "value a share");
            // Derived from the total's band (D430): the two agree.
            const row = byId(v.company_rows.data.rows, d.id);
            if (row !== undefined && v.company_rows.dirty) {
              const per = figShown(row.value) / Math.max(c.shares_out, 1);
              expect(Math.abs(figShown(d.shown_value_per_share) - per) <= 1e-9 * Math.abs(per)).toBe(true);
            }
          }
          if (b) {
            assertNoTruth(d, truthsOf(d.id), "v_company_detail");
          } else if (Math.abs(c.cash_usd) >= SCAN_MIN_USD && !Number.isInteger(c.cash_usd)) {
            // The scan is not vacuous: a published cash figure is found in its row.
            const cash = String(c.cash_usd);
            expect(numbers(JSON.stringify(d)).includes(cash), cash).toBe(true);
          }
        }
      }
      if (v.units.dirty) {
        for (const r of v.units.data.units) {
          const b = unitB(r.company);
          const u = w.units[r.id] as World["units"][number];
          const c = w.companies[r.company] as World["companies"][number];
          assertFigure(r.productivity, u.productivity, b, "productivity");
          assertFigure(r.p_pre, pPre(u, c), b, "p_pre");
          if (b && !isBanded(r.company)) assertNoTruth(r, unitTruths(w, r.company), "peer unit");
          const pairs: [Figure, number][] = [
            [r.gross_assets, u.gross_assets],
            [r.asset_book, u.asset_book],
            [r.assets_eff, businessUnitAssetsEff(u)],
            [r.revenue_m, u.revenue_m],
            [r.variable_m, u.variable_m],
            [r.fixed_m, u.fixed_m],
            [r.rd_m, u.rd_m],
            [r.dep_m, u.dep_m],
            [r.ebit_m, businessUnitEbitM(u)],
            [r.capex_m, u.capex_m],
          ];
          for (const [f, t] of pairs) assertFigure(f, t, b, "unit figure");
          expect(figExact(r.shared_m)).toBe(u.shared_m);
          if (isBanded(r.company)) {
            assertNoTruth(r, truthsOf(r.company), "v_units");
            if (monthClose) {
              const e = revOf(r.company);
              e[0] += 12.0 * figShown(r.revenue_m);
              e[1] += 12.0 * u.revenue_m;
            }
          }
        }
      }
      if (v.units.dirty && monthClose) {
        // The review's probe (D436): in an estimated industry with one company that does not
        // publish and a published peer, M from the peer's revenue over its capacity at the last
        // close, supply = demand / M^2, and the private revenue as
        // (supply - the peers' capacity - the fringe) x M / 12, the fringe given true.
        const rows = v.units.data.units;
        w.industries.forEach((ind, iidx) => {
          const iid = iidx as IndustryId;
          const m = ind.market_factor;
          if (!classes[iid] || m <= M_MIN || m >= M_MAX) return;
          const live = (r: UnitRow): boolean =>
            r.industry === iid &&
            (w.companies[r.company] as World["companies"][number]).finance.bankrupt_on === null;
          const priv = rows.filter((r) => live(r) && isBanded(r.company));
          const peers = rows.filter((r) => live(r) && !isBanded(r.company));
          const lead = peers.find((r) => (w.units[r.id] as World["units"][number]).revenue_m > 0.0);
          if (lead === undefined) return;
          if (priv.length !== 1 || peers.some((r) => !snaps.has(r.id))) return;
          const turnover = ind.params.asset_turnover;
          const fringe = ind.fringe_assets * turnover;
          const truth = (w.units[(priv[0] as UnitRow).id] as World["units"][number]).revenue_m;
          const rebuild = (shown: boolean): number => {
            const at = (r: UnitRow): [number, number] => {
              const s = snaps.get(r.id) as UnitSnap;
              return shown ? [s.shown_assets_eff, s.shown_p_pre] : [s.assets_eff, s.p_pre];
            };
            const rev = shown
              ? figShown(lead.revenue_m)
              : (w.units[lead.id] as World["units"][number]).revenue_m;
            const [ae, pp] = at(lead);
            const mm = (rev * 1200.0) / (ae * turnover * pp);
            const supply = ind.demand / (mm * mm);
            const peersCap = peers.reduce((acc, r) => {
              const [a, p] = at(r);
              return acc + (a * turnover * p) / 100.0;
            }, 0);
            return ((supply - peersCap - fringe) * mm) / 12.0;
          };
          mProbes += 1;
          mExact += Math.abs(rebuild(false) / truth - 1.0) < PROBE_EXACT ? 1 : 0;
          mShownExact += Math.abs(rebuild(true) / truth - 1.0) < PROBE_EXACT ? 1 : 0;
        });
        for (const r of rows) {
          const u = w.units[r.id] as World["units"][number];
          snaps.set(r.id, {
            assets_eff: businessUnitAssetsEff(u),
            p_pre: pPre(u, w.companies[r.company] as World["companies"][number]),
            shown_assets_eff: figShown(r.assets_eff),
            shown_p_pre: figShown(r.p_pre),
          });
        }
      }
      if (v.tech.dirty) {
        for (const t of v.tech.data.companies) {
          const b = unitB(t.company);
          const c = w.companies[t.company] as World["companies"][number];
          t.data.forEach((d, i) => {
            const book = c.data[i];
            if (book === undefined) return;
            const p = (w.industries[book.industry] as World["industries"][number]).params;
            const bk = book.book;
            assertFigure(d.held_tb, bk.held, b, "held TB");
            assertFigure(d.unstructured_tb, dataBookUnstructuredTb(bk), b, "unstructured TB");
            const decay = bk.held * decayRate(bk.held, p.data_decay_base);
            assertFigure(d.decay_tb, decay, b, "decay TB");
          });
          if (isBanded(t.company)) assertNoTruth(t, truthsOf(t.company), "v_tech");
          else if (b) assertNoTruth(t, unitTruths(w, t.company), "peer tech");
          // The probe, at each month close, on books that dropped no data.
          if (b && monthClose && c.data.length === 1) {
            const d = t.data[0];
            const bk = c.data[0];
            if (d === undefined || bk === undefined) continue;
            const p = (w.industries[bk.industry] as World["industries"][number]).params;
            const now: Book = {
              held: bk.book.held,
              unstructured: dataBookUnstructuredTb(bk.book),
              buckets: bk.book.unstructured.length,
              shown_held: figShown(d.held_tb),
              shown_unstructured: figShown(d.unstructured_tb),
            };
            const rev = c.units.reduce((acc, u) => acc + (w.units[u] as World["units"][number]).revenue_m, 0);
            const before = books.get(t.company);
            books.set(t.company, now);
            if (before !== undefined && before.buckets < RETENTION_MONTHS && rev > 1.0e6) {
              const base = p.data_decay_base;
              const rate = p.data_tb_per_musd;
              const exact = rebuiltRevenue(
                before.held,
                before.unstructured,
                now.held,
                now.unstructured,
                base,
                rate,
              );
              const shown = rebuiltRevenue(
                before.shown_held,
                before.shown_unstructured,
                now.shown_held,
                now.shown_unstructured,
                base,
                rate,
              );
              probes += 1;
              probeExact += Math.abs(exact / rev - 1.0) < PROBE_EXACT ? 1 : 0;
              // Fooled: not rebuilt to the precision the probe has on the true book.
              probeFooled += Math.abs(shown / rev - 1.0) > PROBE_EXACT ? 1 : 0;
            }
          }
        }
      }
      if (v.statements.dirty) {
        for (const cs of v.statements.data.companies) {
          const b = isBanded(cs.id);
          expect(cs.estimated).toBe(b);
          const c = w.companies[cs.id] as World["companies"][number];
          const pubq = c.finance.archive.quarters.filter((s) => published(s, w.clock));
          const puby = c.finance.archive.years.filter((s) => published(s, w.clock));
          if (b) {
            expect(cs.quarters.length === 0 && cs.years.length === 0).toBe(true);
            expect(cs.estimated_quarters.length).toBe(pubq.length);
            expect(cs.estimated_years.length).toBe(puby.length);
            const pairs = [
              ...cs.estimated_quarters.map((e, i) => [e, pubq[i]] as const),
              ...cs.estimated_years.map((e, i) => [e, puby[i]] as const),
            ];
            for (const [e, s] of pairs) {
              if (s === undefined) throw new Error("estimated statement without a published one");
              expect(e.period).toEqual(s.period);
              lineFigures(
                true,
                s,
                STATEMENT_LINE_VALUES.map((l) => [l, estLine(e, l)] as [StatementLine, Figure]),
              );
              assertFigure(e.operating.held_tb, s.key.held_tb, true, "statement TB");
            }
            // A year's revenue is its quarters' summed (D430).
            for (const y of cs.estimated_years) {
              if (y.period.kind !== "Year") throw new Error("unreachable");
              const year = y.period.year;
              const qs = cs.estimated_quarters.filter(
                (q) => q.period.kind === "Quarter" && q.period.quarter.year === year,
              );
              if (qs.length === 4) {
                const sum = qs.reduce((acc, q) => acc + figShown(estLine(q, "Revenue")), 0);
                const shown = figShown(estLine(y, "Revenue"));
                expect(Math.abs(shown - sum) <= 1e-9 * Math.max(Math.abs(sum), 1.0)).toBe(true);
              }
            }
            assertNoTruth(cs, truthsOf(cs.id), "v_statements");
          } else {
            expect(cs.quarters.length).toBe(pubq.length);
            expect(cs.estimated_quarters.length).toBe(0);
          }
        }
      }
      if (v.filings.dirty) {
        const f = v.filings.data;
        for (const fl of f.filings) {
          const b = isBanded(fl.company);
          const c = w.companies[fl.company] as World["companies"][number];
          const s = c.finance.archive.quarters.find(
            (s) =>
              s.period.kind === "Quarter" &&
              s.period.quarter.year === fl.quarter.year &&
              s.period.quarter.q === fl.quarter.q,
          );
          if (s === undefined) throw new Error("filing without a statement");
          lineFigures(b, s, [
            ["Revenue", fl.revenue],
            ["Ebit", fl.ebit],
            ["Ebitda", fl.ebitda],
            ["NetIncome", fl.net_income],
            ["OperatingCash", fl.operating_cash],
            ["Cash", fl.cash],
            ["BalanceLineDrawn", fl.line_drawn],
            ["Equity", fl.equity],
          ]);
          if (b) {
            // The same estimate as the statement's (D429).
            const st = byField(v.statements.data.companies, "id", fl.company);
            const e = st?.estimated_quarters.find(
              (e) => JSON.stringify(e.period) === JSON.stringify(s.period),
            );
            if (e !== undefined) expect(estLine(e, "Revenue")).toEqual(fl.revenue);
            assertNoTruth(fl, truthsOf(fl.company), "v_filings");
          }
        }
      }
      if (v.ratings.dirty) {
        for (const r of v.ratings.data.companies) {
          const b = isBanded(r.id);
          const c = w.companies[r.id] as World["companies"][number];
          assertFigure(r.line_drawn, c.finance.line.drawn, b, "ratings line drawn");
          assertFigure(r.line_limit, c.finance.line.limit, b, "ratings line limit");
          if (b) assertNoTruth(r, truthsOf(r.id), "v_ratings");
        }
      }
      if (v.projection.dirty) {
        for (const r of v.projection.data.companies) {
          const b = isBanded(r.id);
          const consensus = (w.market.stocks[r.id] as World["market"]["stocks"][number]).consensus_ni;
          assertFigure(r.consensus_ni, consensus, b, "consensus");
          const [lo, hi] = projectionRange(consensus, r.width);
          assertFigure(r.range[0], lo, b, "range low");
          assertFigure(r.range[1], hi, b, "range high");
          expect(figShown(r.range[0]) <= figShown(r.range[1]), "the ends keep their order").toBe(true);
          if (b) {
            // The ends are derived from the consensus band (D430): the width shown and the ends
            // shown give back the estimate, not the consensus.
            const back = 0.5 * (figShown(r.range[0]) + figShown(r.range[1]));
            expect(Math.abs(back - figShown(r.consensus_ni)) <= 1e-6 * Math.max(Math.abs(back), 1.0)).toBe(
              true,
            );
            assertNoTruth(r, truthsOf(r.id), "v_projection");
          }
        }
      }
      if (v.recap.dirty && w.recaps.length > 0) {
        const view = v.recap.data;
        expect(view.recaps.length).toBe(w.recaps.length);
        view.recaps.forEach((rq, ri) => {
          const recap = w.recaps[ri] as World["recaps"][number];
          expect(rq.world.quarter).toEqual(recap.world.quarter);
          rq.companies.forEach((p, i) => {
            const t = recap.companies[i] as World["recaps"][number]["companies"][number];
            const b = isBanded(p.company);
            assertFigure(p.range[0], t.range[0], b, "recap range low");
            assertFigure(p.range[1], t.range[1], b, "recap range high");
            assertFigure(p.expected.projection, t.expected.projection, b, "recap projection");
            assertFigure(p.expected.consensus, t.expected.consensus, b, "recap consensus");
            if (b) assertNoTruth(p, truthsOf(p.company), "v_recap");
          });
          for (const e of [...rq.world.expected_beats, ...rq.world.expected_misses]) {
            if (isBanded(e.company)) expect(figIsBand(e.projection) && figIsBand(e.consensus)).toBe(true);
          }
        });
      }
      if (v.births.dirty) {
        for (const br of v.births.data.births) {
          const b = isBanded(br.id);
          assertFigure(
            br.size_usd,
            (w.companies[br.id] as World["companies"][number]).revenue_usd,
            b,
            "birth size",
          );
          if (b) assertNoTruth(br, truthsOf(br.id), "v_births");
        }
      }
      if (v.news.dirty) {
        // Every headline about a banded company carries no true figure of it.
        for (const h of v.news.data.feed) {
          if (
            h.date.year !== clockDate.year ||
            h.date.month !== clockDate.month ||
            h.date.day !== clockDate.day
          )
            continue;
          if (h.company !== null && isBanded(h.company)) assertNoTruth(h, truthsOf(h.company), "v_news");
        }
      }
      if (v.industry_rows.dirty) {
        const ranked = companiesByRevenue(w);
        for (const row of v.industry_rows.data.rows) {
          const list = ranked[row.id] as [CompanyId, number][];
          const n = list.filter(([c]) => {
            const st = (w.companies[c] as World["companies"][number]).finance.distress.status;
            return isBanded(c) && !(st === "Bankrupt" || st === "Removed");
          }).length;
          const want = n >= 1 && n < INDUSTRY_UNPUBLISHED_BELOW;
          expect(row.estimated, row.key).toBe(want);
          if (monthClose && simDateIsQuarterFirstMonth(clockDate)) {
            classAtClose.set(key(row.id, quarterPrev(simDateQuarter(clockDate))), want);
          }
          const ind = w.industries[row.id] as World["industries"][number];
          const named = list.reduce((acc, [, r]) => acc + r, 0);
          assertFigure(row.named_revenue_m, named, want, "named revenue");
          assertFigure(row.supply, ind.supply, want, "supply");
          assertFigure(row.supply_ratio, ind.supply_ratio, want, "S");
          assertFigure(row.market_factor, ind.market_factor, want, "M");
          assertFigure(row.fringe_revenue_m, ind.fringe_revenue_m, want, "fringe");
          if (want) {
            estimatedIndustries.add(row.id);
            const t = debugSet(
              [named, ind.supply, ind.supply_ratio, ind.market_factor, ind.fringe_revenue_m],
              0.0,
            );
            assertNoTruth(row, t, "v_industry_row");
          }
          // The top 5 rank by the revenue shown, as the detail list does.
          if (v.industry_detail.dirty) {
            const detail = byId(v.industry_detail.data.industries, row.id);
            if (detail === undefined) throw new Error(`no detail ${row.key}`);
            expect(row.top_companies).toEqual(detail.companies.slice(0, 5).map((c) => c.company));
            for (let i = 0; i + 1 < detail.companies.length; i++) {
              const [a, b] = [detail.companies[i], detail.companies[i + 1]] as [
                (typeof detail.companies)[number],
                (typeof detail.companies)[number],
              ];
              expect(
                figShown(a.revenue_m) > figShown(b.revenue_m) ||
                  (figShown(a.revenue_m) === figShown(b.revenue_m) && a.company < b.company),
              ).toBe(true);
            }
          }
        }
      }
      if (v.industry_detail.dirty) {
        for (const ind of v.industry_detail.data.industries) {
          for (const ic of ind.companies) {
            const b = unitB(ic.company);
            const rev = (w.companies[ic.company] as World["companies"][number]).units.reduce(
              (acc, u) => acc + (w.units[u] as World["units"][number]).revenue_m,
              0,
            );
            assertFigure(ic.revenue_m, rev, b, "industry revenue");
            if (isBanded(ic.company)) {
              expect(figIsBand(ic.share)).toBe(true);
              assertNoTruth(ic, truthsOf(ic.company), "v_industry_detail");
            }
          }
        }
      }
    }
    const w = simWorld(sim);
    // The run covers the 184 starting private companies, the 2020-21 births and listings.
    const privateAtLoad = 651 - 467;
    expect(bandedSeen.size > privateAtLoad, `${bandedSeen.size}`).toBe(true);
    expect(listedInPlay.size > 0, "a listing in play to check its window").toBe(true);
    for (const id of listedInPlay) {
      expect(bandedSeen.has(id), "a new listing is banded until its first release").toBe(true);
    }
    expect(estimatedIndustries.size > 0, "an industry with one or two banded companies").toBe(true);

    // History (D437): every recorded quarter's supply is a band exactly when the industry was
    // estimated at that quarter's close, whatever its class now.
    let checked = 0;
    let keptBanded = 0;
    for (const ind of simViews(sim).industry_detail.data.industries) {
      for (const h of ind.history) {
        const was = classAtClose.get(key(ind.id, h.quarter));
        if (was !== undefined) {
          expect(figIsBand(h.supply), `${ind.id} ${h.quarter.year} Q${h.quarter.q}`).toBe(was);
          checked += 1;
          keptBanded += was && !ind.estimated ? 1 : 0;
        }
      }
    }
    expect(checked > 100, `${checked}`).toBe(true);
    expect(keptBanded > 0, "an industry left the estimated class and kept its banded past").toBe(true);
    expect(mProbes >= 20 && mExact * 10 >= mProbes * 8, `${mExact} of ${mProbes}`).toBe(true);
    expect(mShownExact, "the shown units never give the private revenue").toBe(0);

    // Averaging (D429): every revenue estimate of a company (8 published quarters, the TTMs and
    // the monthly unit revenues of the two years) leans the same way, so the average stays more
    // than 5% from the truth for a large majority of companies.
    let quartersSeen = 0;
    const st = simViews(sim).statements.data;
    for (const [id, e] of revenue) {
      const cs = byField(st.companies, "id", id);
      if (cs === undefined || !cs.estimated) continue;
      const c = w.companies[id] as World["companies"][number];
      cs.estimated_quarters.forEach((q, i) => {
        const s = c.finance.archive.quarters[i];
        if (s === undefined) return;
        if (
          q.period.kind === "Quarter" &&
          (q.period.quarter.year === 2020 || q.period.quarter.year === 2021)
        ) {
          e[0] += 4.0 * figShown(estLine(q, "Revenue"));
          e[1] += 4.0 * s.lines.revenue;
          quartersSeen += 1;
        }
      });
    }
    const judged = [...revenue.values()].filter(([, t]) => t > 0.0).map(([s, t]) => s / t - 1.0);
    const off = judged.filter((r) => Math.abs(r) > 0.05).length;
    expect(quartersSeen > 0 && judged.length > privateAtLoad).toBe(true);
    expect(off * 10 >= judged.length * 9, `${off} of ${judged.length}`).toBe(true);
    // The probe rebuilds the revenue from the true book (so it is a real probe), and the shown
    // book never gives it.
    expect(probes > 100, `${probes}`).toBe(true);
    expect(probeExact, "the probe works on the true book").toBe(probes);
    expect(probeFooled, "the shown book never gives the revenue").toBe(probes);
    expect(checks > 0).toBe(true);
  }, 3_600_000);
});
