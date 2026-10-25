// Port of crates/sim/tests/m6_lock.rs: build-plan M6.1 to M6.4 on the live engine: the plan at
// load (D283), the Lite AI batch at the plan lock (spec 4.4 row 3, section 6), the order of the
// lock's steps and the projection ranges (5.16).
//
// The expected plans are written here from the spec, not from lane F's functions: 6.1 (first
// match in table order, D120), 6.2 (situation row with Logan's oversupply term, 1 point per 1%,
// D282; trait nudges; the -20% to +30% clamp; the funding cap), 6.3 (archetype and trait mults,
// productivity adj, loss cut, less free R&D, clamp) and 6.4 (P a power of ten, E for the
// coverage, research for a Visionary, the 10% idle floor). The inputs are the world one tick
// before the 9 January 2020 lock.
//
// Expects:
//   ../../src/lib.ts              simNew, simStep, simNow, simWorld, simViews
//   ../../src/jobs.ts             scheduler() -> Scheduler       [sim::scheduler]
//   ../../src/time/scheduler.ts   schedulerJobs(s, slot), SLOT_VALUES (ported)
//   ../../src/finance/statements.ts ledgerEbit(lines)           [Ledger::ebit]
//   ../../src/world/entities.ts   companyDataIn (ported)
//   ../../src/views/projection.ts nothing: the view is read as plain data (views().projection.data)
//
// Changed from the Rust: the seeds (2, 3, 1, 5) seed the new generator (D951). The plan checks are
// the spec's rules applied to the world one tick before the lock, so they hold for any draws.
// The Arrowhead test (seed 1) pins CO-0001's plan; it does not depend on draws other than the
// load's, so it stays as is. The 6.4 split uses plain number arithmetic (labor units are far below
// 2^53).
import { describe, expect, it } from "vitest";
import { ledgerEbit } from "../../src/finance/statements.ts";
import { scheduler } from "../../src/jobs.ts";
import { simNew, simNow, simStep, simViews, simWorld } from "../../src/lib.ts";
import { dateTimeAt, simDateAddDays, simDateYmd } from "../../src/time/calendar.ts";
import { SLOT_VALUES, type Slot, schedulerJobs } from "../../src/time/scheduler.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import type { Archetype } from "../../src/types/state/ai.ts";
import type { Trait } from "../../src/types/state/people.ts";
import type { Company, World } from "../../src/types/world.ts";
import { companyDataIn } from "../../src/world/entities.ts";
import { figureExact, sum } from "./common/births.ts";
import { data, idRows, rowOf, unwrap } from "./common/index.ts";
import { company, runTo } from "./common/ops.ts";

/** Spec 6.1 rows (T): hurdle ROA, growth adj, R&D mult, data coverage. */
function row(a: Archetype): [number, number, number, number] {
  switch (a) {
    case "StateChampion":
      return [0.06, 0.02, 1.0, 0.5];
    case "Startup":
      return [0.12, 0.04, 1.2, 1.0];
    case "AggressiveGrower":
      return [0.08, 0.05, 1.3, 1.0];
    case "CashCow":
      return [0.15, -0.03, 0.7, 0.25];
    case "Incumbent":
      return [0.1, 0.0, 1.0, 0.5];
  }
}

/** The traits the AI reads (spec 6, 5.19.5). */
function traitsOf(w: World, c: Company): readonly Trait[] {
  if (c.origin.kind === "Born") return [];
  return c.controller === null ? [] : rowOf(w.characters, c.controller).traits;
}

/** Spec 6.1, first match in table order (D120). */
function specArchetype(state: boolean, revenue: number, tech: boolean, t: readonly Trait[]): Archetype {
  const has = (x: Trait): boolean => t.includes(x);
  if (state) return "StateChampion";
  if (revenue < 50.0e6 && tech) return "Startup";
  if (has("Ambitious") || has("Brave")) return "AggressiveGrower";
  if (has("Greedy") || has("Cautious")) return "CashCow";
  return "Incumbent";
}

/** Spec 6 g_dem: `LT + (phi + phi^2 + phi^3 + phi^4) x (q_growth - lt_q)`, phi 0.5. */
function specGDem(lt: number, q: number): number {
  return lt + 0.9375 * (q - ((1.0 + lt) ** 0.25 - 1.0));
}

/** Spec 6.4 for `l` labor units. */
function specSplit(l: number, coverage: number, inflow: number, visionary: boolean): number[] {
  if (l === 1) return coverage >= 1.0 ? [0, 0, 1, 0, 0] : [1, 0, 0, 0, 0];
  let p = 1;
  while (p * 10 <= 0.4 * l) p *= 10;
  const left = l - p;
  let e = Math.min(Math.max(Math.ceil((coverage * inflow) / 0.9125), 0), left);
  let r = visionary ? Math.floor((left - e) / 10) : 0;
  if (l >= 10) {
    const minIdle = Math.ceil((l * 10) / 100);
    let short = Math.max(minIdle - (left - e - r), 0);
    const cut = Math.min(short, e);
    e -= cut;
    short -= cut;
    r -= Math.min(short, r);
  }
  return [p, e, 0, r, l - p - e - r];
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi);

describe("m6 lock", () => {
  it("the_plan_at_load_is_g_dem_and_the_6_3_rule", () => {
    const sim = unwrap(simNew(data(), 2), "Sim::new");
    const w = simWorld(sim);
    for (const u of w.units) {
      const ind = rowOf(w.industries, u.industry);
      const want = specGDem(ind.lt, ind.q_growth);
      expect(Math.abs(u.growth_plan - want) < 1e-12, `growth ${u.growth_plan}`).toBe(true);
    }
    for (const c of w.companies) {
      expect(c.plan, "no plan is locked before 9 January 2020").toBeNull();
    }
  });

  it("the_lite_ai_batch_at_the_first_lock_follows_section_6", () => {
    const sim = unwrap(simNew(data(), 3), "Sim::new");
    const beforeLock = dateTimeAt(simDateYmd(2020, 1, 8), 23);
    while (simNow(sim) < beforeLock) simStep(sim);
    // The World holds only plain data, so a structuredClone is the snapshot (Rust World::clone).
    const before = structuredClone(simWorld(sim));
    simStep(sim);
    const after = simWorld(sim);
    let checked = 0;
    for (const [id, c] of idRows<CompanyId, Company>(before.companies)) {
      const st = c.finance.distress.status;
      if (st === "Bankrupt" || st === "Removed") continue;
      const a = rowOf(after.companies, id);
      const plan = a.plan;
      if (plan === null) throw new Error("the batch plans every company not frozen");
      const ind = rowOf(before.industries, c.industry);
      const u = rowOf(before.units, c.units[0] as (typeof c.units)[number]);
      const t = traitsOf(before, c);
      const q = c.finance.archive.quarters.slice(-4);
      const ttmRevenue = sum(q.map((s) => s.lines.revenue));
      const ttmEbit = sum(q.map((s) => ledgerEbit(s.lines)));
      const tech = ind.sector === "Tech";

      // 6.1.
      const arch = specArchetype(c.state_controlled, ttmRevenue, tech, t);
      expect(a.archetype, c.key).toBe(arch);
      const [hurdle, adj, rdMult, coverage] = row(arch);

      // 6.3: productivity adj (+0.5 below 100, D360's tuning of the spec's +0.25 below 95), trait
      // mults, loss cut, less free R&D, clamp.
      const pAdj = u.productivity < 100.0 ? 0.5 : u.productivity > 110.0 ? -0.2 : 0.0;
      let tm = 1.0;
      for (const [tr, k] of [
        ["Greedy", 0.8],
        ["Visionary", 1.25],
        ["Conservative", 0.9],
        ["Diligent", 1.1],
      ] as [Trait, number][]) {
        if (t.includes(tr)) tm *= k;
      }
      const norm = ind.params.rd_norm;
      let target = norm * (rdMult + pAdj) * tm;
      if (c.loss_quarters >= 2) target = Math.max(target * 0.8, Math.min(target, 0.5 * norm));
      const book = companyDataIn(c, c.industry);
      if (book === null) throw new Error(`${c.key} has no data in its industry`);
      const free = book.free_rd_pct / 100.0;
      const rd = clamp(target - free, 0.0, 3.0 * norm);
      const au = rowOf(after.units, c.units[0] as (typeof c.units)[number]);
      expect(Math.abs(au.rd_plan - rd) < 1e-12, `${c.key}: rd ${au.rd_plan} vs ${rd}`).toBe(true);

      // 6.2.
      const gross = u.gross_assets;
      const roa = gross > 0.0 ? ttmEbit / gross : 0.0;
      const demand = specGDem(ind.lt, ind.q_growth) - Math.max(ind.supply_ratio - 1.0, 0.0);
      let g: number;
      if (c.loss_quarters >= 4) g = -0.15;
      else if (c.loss_quarters >= 2) g = -0.05;
      else if (roa >= hurdle) g = demand + adj;
      else if (roa >= 0.0) g = Math.min(demand, 0.02);
      else g = 0.0;
      const has = (x: Trait): number => (t.includes(x) ? 1 : 0);
      g +=
        0.03 * has("Ambitious") -
        0.01 * has("Content") -
        0.02 * has("Cautious") +
        0.01 * has("Brave") +
        0.01 * (tech ? has("Visionary") : 0);
      g = clamp(g, -0.2, 0.3);
      const p = ind.params;
      const d = (p.asset_decay * Math.max(gross - p.asset_decay_threshold_usd, 0.0)) / Math.max(gross, 1.0);
      const line = c.finance.line;
      // The batch runs after the lock's listings (4.4, 5.20.1): a company that lists here plans
      // with its IPO's new money, its cash after the lock less the plan's own moves (D125).
      const cash =
        !c.public && a.public
          ? a.cash_usd - (plan.financing.draw - plan.financing.repay - plan.financing.dividend)
          : c.cash_usd;
      const liquidity = Math.max(cash - line.drawn, 0.0) + Math.max(line.limit - line.drawn, 0.0);
      const minCash = 0.05 * ttmRevenue;
      const budget = 0.5 * Math.max(liquidity - minCash, 0.0);
      if (c.finance.distress.status !== "Active") {
        g = Math.min(g, -d);
      } else if (g > -d && gross > 0.0 && (gross * (d + g)) / 4.0 > budget) {
        g = clamp((budget * 4.0) / gross - d, -d, g);
      }
      expect(Math.abs(au.growth_plan - g) < 1e-9, `${c.key}: growth ${au.growth_plan} vs ${g}`).toBe(true);

      // 6.4.
      const inflow = (ttmRevenue / 1e6 / 12.0) * ind.params.data_tb_per_musd;
      const s = specSplit(c.labor_units, coverage, inflow, t.includes("Visionary"));
      const st2 = a.stations;
      expect([st2.productivity, st2.enterprise, st2.fifty_fifty, st2.research, st2.idle], c.key).toEqual(s);

      // 6.5's moves are booked between closes (D125).
      const moved = plan.financing.draw - plan.financing.repay;
      expect(Math.abs(a.finance.line.drawn - (line.drawn + moved)) < 1e-6).toBe(true);
      expect(Math.abs(a.finance.pending.line_drawn_or_repaid - moved) < 1e-6).toBe(true);
      checked += 1;
    }
    expect(checked, `${checked} companies checked`).toBeGreaterThanOrEqual(640);
  });

  it("arrowhead_locks_the_cash_cow_plan", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    runTo(sim, simDateYmd(2020, 1, 9));
    const w = simWorld(sim);
    const a = rowOf(w.companies, company(w, "CO-0001"));
    const u = rowOf(w.units, a.units[0] as (typeof a.units)[number]);
    expect(a.archetype).toBe("CashCow");
    // 6.4 (spec_6_4): 392 labor units, P 100, E 1 at 25% coverage, idle 291.
    const s = a.stations;
    expect([s.productivity, s.enterprise, s.research, s.idle]).toEqual([100, 1, 0, 291]);
    // 6.3: 0.05 x 0.7 x 0.8 less 1% free R&D (productivity within 95 to 110 after a month).
    expect(Math.abs(u.rd_plan - 0.018) < 1e-12).toBe(true);
    // 6.2: ROA about 4% is under the Cash cow's 15% hurdle: min(2%, g_dem - oversupply).
    const ind = rowOf(w.industries, u.industry);
    const want = Math.min(specGDem(ind.lt, ind.q_growth) - Math.max(ind.supply_ratio - 1.0, 0.0), 0.02);
    expect(Math.abs(u.growth_plan - want) < 1e-12, `${u.growth_plan}`).toBe(true);
  });

  it("the_lock_runs_its_steps_in_the_spec_order", () => {
    // Spec 4.4 row 3: fixed events, random events, IPO votes and listings, the Lite AI batch,
    // consensus.
    const order: Slot[] = [
      "LockFixedStartupEvents",
      "LockRandomStartupEvents",
      "LockIpoVotes",
      "LockAiPlans",
      "LockConsensus",
    ];
    const pos = order.map((s) => SLOT_VALUES.indexOf(s));
    for (let i = 1; i < pos.length; i++) expect(pos[i - 1] as number).toBeLessThan(pos[i] as number);
    const sched = scheduler();
    const jobs = (s: Slot): string[] => schedulerJobs(sched, s).map(([n]) => n);
    expect(jobs("LockFixedStartupEvents")).toEqual(["births.fixed_events"]);
    expect(jobs("LockRandomStartupEvents")).toEqual(["births.random_events"]);
    expect(jobs("LockIpoVotes")).toEqual(["births.ipo_votes_and_listings"]);
    expect(jobs("LockAiPlans")).toEqual(["ai.plan_lock"]);
    expect(jobs("LockConsensus")).toEqual(["market.consensus"]);
  });

  it("projection_ranges_shrink_with_the_quarter_and_stop_at_three_percent", () => {
    const sim = unwrap(simNew(data(), 5), "Sim::new");
    // Spec 5.16: `max(3%, 30% x (1 - 0.6 x elapsed) x (1 - 24 / 50) x 0.7 x 2)`.
    const spec = (e: number): number =>
      Math.max(0.3 * (1.0 - 0.6 * e) * (1.0 - 24.0 / 50.0) * 0.7 * 2.0, 0.03);
    let last = Number.POSITIVE_INFINITY;
    for (const day of [10, 40, 70, 90]) {
      runTo(sim, simDateAddDays(simDateYmd(2020, 1, 1), day));
      const v = simViews(sim).projection.data;
      const e = v.elapsed_share;
      const r = v.companies[0];
      if (r === undefined) throw new Error("no projection rows");
      expect(Math.abs(r.width - spec(e)) < 1e-12).toBe(true);
      expect(r.width < last && r.width >= 0.03).toBe(true);
      // Company 0 (Arrowhead) is listed, so its figures are exact (D420).
      const consensus = figureExact(r.consensus_ni);
      if (consensus === null) throw new Error("Arrowhead's consensus is exact");
      const half = Math.abs(consensus) * r.width;
      expect(Math.abs((figureExact(r.range[0]) as number) - (consensus - half)) < 1e-6).toBe(true);
      expect(Math.abs((figureExact(r.range[1]) as number) - (consensus + half)) < 1e-6).toBe(true);
      expect(r.plan, "the observer never sees a plan").toBeNull();
      last = r.width;
    }
  });
});
