// Port of crates/sim/tests/m5_consensus.rs: build-plan M5.5's consensus (spec 5.16, 21.5.1; D141,
// D168, D252): at the plan lock the engine projects each company's quarter with no new rolls (a
// clone runs the quarter's three month closes with NoNoise draws, each industry's supply, S and M
// and each unit's productivity held at their lock values, design fix 109), and consensus =
// projection x (1 + e), e uniform within +-15% from the prices stream (D361).
//
// - At the 9 April 2020 lock every consensus is within +-15% of the projection made from the world
//   just before the lock's consensus job, the e spread is uniform-like (mean near 0, both ends
//   used), and the surprises at the 2 July release follow from the consensus (5.15).
// - The projection holds S, M and productivity at the lock (D168).
// - One company's plan never reaches another's projection: at every lock from 2020 to 2023 on
//   seed 7, perturbing the even-id companies' growth, R&D, assets and cash leaves every odd-id
//   company's projection bit for bit as it was, while the even ones move.
// - With nothing else moving the posted quarter is the projection.
// - Projecting draws nothing and changes nothing.
//
// Expects:
//   ../src/lib.ts              simNew, simStep, simNow, simWorld, simRegisterTestJob, simStateHash
//   ../src/market/jobs.ts      projectQuarterNetIncome(world, now) -> number[] (by company id),
//                                 heldAtLockOf(world) -> HeldAtLock, heldAtLockRestoreMarket(held,
//                                 world), heldAtLockRestoreProductivity(held, world)
//                                 [HeldAtLock::of, ::restore_market, ::restore_productivity]
//   ../src/finance/distress.ts companyStatusIsFrozen(status)
//   ../src/finance/statements.ts ledgerNetIncome(ledger)
//   The archive: c.finance.archive.quarters.
//
// Changed from the Rust: the sims use the new generator (D951). The statistical checks (mean of e
// under 0.01, range beyond 80% of the bound, 95% of even companies move, the 1e-9 held tolerance)
// are properties of the formulas and hold for any draws; if a run shows otherwise, re-tune with a
// comment rather than weaken silently. Statics are module variables. Clones use structuredClone.
// Tag counts and printlns dropped; the tag loop only checks the surprise formula.
import { describe, expect, it } from "vitest";
import { companyStatusIsFrozen } from "../src/finance/distress.ts";
import { ledgerNetIncome } from "../src/finance/statements.ts";
import { simNew, simNow, simRegisterTestJob, simStateHash, simStep, simWorld } from "../src/lib.ts";
import {
  type HeldAtLock,
  heldAtLockOf,
  heldAtLockRestoreMarket,
  heldAtLockRestoreProductivity,
  projectQuarterNetIncome,
} from "../src/market/jobs.ts";
import { dateTimeAt, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { JobCtx } from "../src/time/scheduler.ts";
import { cmpDate, type DateTime, dateEq, type SimDate } from "../src/types/calendar.ts";
import type { CompanyId } from "../src/types/ids.ts";
import type { World } from "../src/types/world.ts";
import { data, unwrap } from "./common/index.ts";
import { stepTo } from "./common/market.ts";

/** Spec 5.16: e uniform within +-5%, widened to +-15% by the M10.7 tuning pass (D361). */
const CONSENSUS_ERROR = 0.15;
/** The lock and the release of the quarter the tests project (Q2 2020). */
const LOCK_DATE = simDateYmd(2020, 4, 9);
const RELEASE_DATE = simDateYmd(2020, 7, 2);
/**
 * With nothing else moving, the posted quarter is the projection within this share of
 * |projection| (the same closes on the same inputs, up to rounding).
 */
const HELD_TOLERANCE = 1e-9;

const lock = (): DateTime => dateTimeMidnight(LOCK_DATE);
const release = (): DateTime => dateTimeAt(RELEASE_DATE, 1);

/** A close of the projected quarter after its lock: 1 May, 1 June or 1 July 2020. */
function afterLock(date: SimDate): boolean {
  return cmpDate(date, LOCK_DATE) > 0 && cmpDate(date, RELEASE_DATE) < 0;
}

type Company = World["companies"][number];

/** The companies not frozen with a quarter, and their posted last quarter's net income. */
function posted(w: World): [CompanyId, number][] {
  const out: [CompanyId, number][] = [];
  w.companies.forEach((c, i) => {
    if (companyStatusIsFrozen(c.finance.distress.status)) return;
    const q = c.finance.archive.quarters[c.finance.archive.quarters.length - 1];
    if (q !== undefined) out.push([i as CompanyId, ledgerNetIncome(q.lines)]);
  });
  return out;
}

const frozen = (c: Company): boolean => companyStatusIsFrozen(c.finance.distress.status);

let projection: number[] = [];

/**
 * Runs in the lock's Lite AI slot after the batch (it is registered after the built-in jobs), so
 * just before the consensus job (lock step 5): the projection of the same world.
 */
function project(w: World, ctx: JobCtx): void {
  if (dateEq(ctx.facts.date, LOCK_DATE)) projection = projectQuarterNetIncome(w, ctx.facts.now);
}

describe("m5 consensus", () => {
  it("consensus_is_the_projection_within_fifteen_percent", { timeout: 900_000 }, () => {
    const sim = unwrap(simNew(data(), 11), "Sim::new");
    simRegisterTestJob(sim, "LockAiPlans", "test.project", project);
    stepTo(sim, lock());
    const w = simWorld(sim);
    const es: number[] = [];
    w.companies.forEach((c, i) => {
      if (frozen(c)) return;
      const p = projection[i] as number;
      const s = w.market.stocks[i] as World["market"]["stocks"][number];
      // Nothing between the batch and the consensus job moves the projection.
      expect(s.projection_ni, c.key).toBe(p);
      if (Math.abs(p) < 1.0) return;
      const e = s.consensus_ni / p - 1.0;
      expect(Math.abs(e) <= CONSENSUS_ERROR + 1e-12, `${c.key}: e ${e}`).toBe(true);
      es.push(e);
    });
    const mean = es.reduce((a, b) => a + b, 0) / es.length;
    const lo = es.reduce((a, b) => Math.min(a, b), 0.0);
    const hi = es.reduce((a, b) => Math.max(a, b), 0.0);
    // Both ends used: beyond 80% of the bound each way (D361's +-15%).
    expect(Math.abs(mean)).toBeLessThan(0.01);
    expect(lo < -0.8 * CONSENSUS_ERROR && hi > 0.8 * CONSENSUS_ERROR).toBe(true);

    // The 2 July surprises follow from the consensus (5.15).
    stepTo(sim, release());
    const w2 = simWorld(sim);
    for (const [id, ni] of posted(w2)) {
      const s = w2.market.stocks[id] as World["market"]["stocks"][number];
      const cons = s.consensus_ni === 0.0 ? 1.0 : s.consensus_ni;
      const sp = (ni - cons) / Math.abs(cons);
      expect(Math.abs(s.last_surprise - sp) < 1e-9 * Math.max(Math.abs(sp), 1.0)).toBe(true);
    }
  });

  /**
   * Projections at the lock of the world as it is and of copies with one input moved: (demand x2
   * and the R&D norm x0.5, which move S and the productivity drift at every later close), (every
   * M +10%), (every productivity +10 points).
   */
  let movedAtLock: [number[], number[], number[], number[]] | null = null;

  function projectMovedCopies(w: World, ctx: JobCtx): void {
    if (!dateEq(ctx.facts.date, LOCK_DATE)) return;
    const now = ctx.facts.now;
    const base = projectQuarterNetIncome(w, now);
    const later = structuredClone(w);
    for (const ind of later.industries) {
      ind.demand_core *= 2.0;
      ind.demand *= 2.0;
      ind.params.rd_norm *= 0.5;
    }
    const m = structuredClone(w);
    for (const ind of m.industries) ind.market_factor *= 1.1;
    const p = structuredClone(w);
    for (const u of p.units) u.productivity += 10.0;
    movedAtLock = [
      base,
      projectQuarterNetIncome(later, now),
      projectQuarterNetIncome(m, now),
      projectQuarterNetIncome(p, now),
    ];
  }

  /** D168: the projection uses the lock's S, M and productivity and holds them. */
  it("projection_holds_s_m_and_productivity_at_the_lock", { timeout: 900_000 }, () => {
    const plain = unwrap(simNew(data(), 11), "Sim::new");
    simRegisterTestJob(plain, "LockAiPlans", "test.moved_copies", projectMovedCopies);
    stepTo(plain, lock());
    if (movedAtLock === null) throw new Error("the lock ran");
    const [base, later, m, p] = movedAtLock as [number[], number[], number[], number[]];
    const w = simWorld(plain);
    let mMoved = 0;
    let pMoved = 0;
    let active = 0;
    w.companies.forEach((c, i) => {
      if (frozen(c)) return;
      // Moves after the lock (demand, so S; the productivity drift) are not in it.
      expect(later[i], c.key).toBe(base[i]);
      if (c.units.length === 0 || c.revenue_usd <= 0.0) return;
      active += 1;
      if (m[i] !== base[i]) mMoved += 1;
      if (p[i] !== base[i]) pMoved += 1;
    });
    // The lock's M and productivity are what it runs on.
    expect(mMoved * 100, `${mMoved} of ${active}`).toBeGreaterThanOrEqual(active * 95);
    expect(pMoved * 100, `${pMoved} of ${active}`).toBeGreaterThanOrEqual(active * 95);
  });

  /** The locks the decoupling test checks: every lock from 2020 to 2023. */
  const DECOUPLING_SEED = 7;
  const DECOUPLING_LAST_YEAR = 2023;
  /** The even-id companies' perturbed locked plan: growth +0.5, R&D +0.05 of revenue, assets x1.5, cash x0.1. */
  const PERTURB_GROWTH = 0.5;
  const PERTURB_RD = 0.05;
  const PERTURB_ASSETS = 1.5;
  const PERTURB_CASH = 0.1;

  /** Per lock: the date, odd companies (not frozen) whose projection changed, even companies (not frozen) and how many moved. */
  const decoupling: [SimDate, number, number, number][] = [];

  /**
   * After the consensus job at each lock: a copy with the even-id companies' plans, assets and
   * cash perturbed is projected against the world as it is.
   */
  function perturbEvenCompanies(w: World, ctx: JobCtx): void {
    if (ctx.facts.date.year > DECOUPLING_LAST_YEAR) return;
    const now = ctx.facts.now;
    const base = projectQuarterNetIncome(w, now);
    const copy = structuredClone(w);
    const even = (id: number): boolean => id % 2 === 0;
    for (const u of copy.units) {
      if (even(u.company)) {
        u.growth_plan += PERTURB_GROWTH;
        u.rd_plan += PERTURB_RD;
        u.gross_assets *= PERTURB_ASSETS;
        u.asset_book *= PERTURB_ASSETS;
        for (const t of u.ramping) t.amount *= PERTURB_ASSETS;
      }
    }
    copy.companies.forEach((c, i) => {
      if (even(i)) c.cash_usd *= PERTURB_CASH;
    });
    const perturbed = projectQuarterNetIncome(copy, now);
    let oddChanged = 0;
    let evens = 0;
    let evenMoved = 0;
    w.companies.forEach((c, i) => {
      if (frozen(c)) return;
      const a = base[i] as number;
      const b = perturbed[i] as number;
      if (even(i)) {
        evens += 1;
        if (a !== b) evenMoved += 1;
      } else if (!Object.is(a, b)) {
        oddChanged += 1;
      }
    });
    decoupling.push([ctx.facts.date, oddChanged, evens, evenMoved]);
  }

  /**
   * D168: with S and M held, one company's locked plan never reaches another's projection. At
   * every lock from 2020 to 2023, perturbing the even-id companies' growth, R&D, assets and cash
   * leaves every odd-id company's projection bit for bit as it was, while the even ones move.
   */
  it("one_companys_plan_does_not_reach_anothers_projection", { timeout: 1_800_000 }, () => {
    const sim = unwrap(simNew(data(), DECOUPLING_SEED), "Sim::new");
    simRegisterTestJob(sim, "LockConsensus", "test.perturb_even", perturbEvenCompanies);
    stepTo(sim, dateTimeMidnight(simDateYmd(DECOUPLING_LAST_YEAR + 1, 1, 1)));
    expect(decoupling.length, "four locks a year, 2020 to 2023").toBe(16);
    for (const [date, oddChanged, evens, evenMoved] of decoupling) {
      expect(oddChanged, `${date.year}-${date.month}-${date.day}`).toBe(0);
      expect(
        evenMoved * 100,
        `${date.year}-${date.month}-${date.day}: ${evenMoved} of ${evens}`,
      ).toBeGreaterThanOrEqual(evens * 95);
    }
  });

  let held: HeldAtLock | null = null;
  /** The zones' effective credit spreads at the lock (spec 5.1.2). */
  let spreads: number[] = [];

  /** After the consensus job: the lock's S, M, productivity and zone spreads. */
  function keepHeld(w: World, ctx: JobCtx): void {
    if (dateEq(ctx.facts.date, LOCK_DATE)) {
      held = heldAtLockOf(w);
      spreads = w.zones.map((z) => z.credit_spread);
    }
  }

  /**
   * After 4.3 step 1 on 1 July: the next quarter's draws (new rolls the projection skips, D141)
   * back to this quarter's. The June close reads them: the zone spreads in its interest (4.3 step
   * 12) and q_growth in its phase labels (step 2), so in a forced sale's sale factor (5.10).
   */
  function holdQuarterDraws(w: World, ctx: JobCtx): void {
    if (afterLock(ctx.facts.date)) {
      w.zones.forEach((z, i) => {
        z.credit_spread = spreads[i] as number;
      });
      for (const ind of w.industries) {
        ind.q_growth = ind.prev_q_growth;
        ind.lt = ind.prev_lt;
      }
    }
  }

  /** After 4.3 step 6 at the closes after the lock: S and M back to the lock's. */
  function holdMarket(w: World, ctx: JobCtx): void {
    if (afterLock(ctx.facts.date) && held !== null) heldAtLockRestoreMarket(held, w);
  }

  /** After 4.3 step 10 at the closes after the lock: productivity back to the lock's. */
  function holdProductivity(w: World, ctx: JobCtx): void {
    if (afterLock(ctx.facts.date) && held !== null) heldAtLockRestoreProductivity(held, w);
  }

  /**
   * D168: when S, M and productivity do not move after the lock (nor the next quarter's draws,
   * which the 1 July close makes before closing June), the quarter is its projection.
   */
  it("projection_is_the_quarter_when_nothing_else_moves", { timeout: 900_000 }, () => {
    const sim = unwrap(simNew(data(), 11), "Sim::new");
    simRegisterTestJob(sim, "LockConsensus", "test.keep_held", keepHeld);
    simRegisterTestJob(sim, "MonthlyGrowthDraws", "test.hold_quarter_draws", holdQuarterDraws);
    simRegisterTestJob(sim, "MonthlySupply", "test.hold_market", holdMarket);
    simRegisterTestJob(sim, "MonthlyProductivity", "test.hold_productivity", holdProductivity);
    stepTo(sim, release());
    const w = simWorld(sim);
    const misses: number[] = [];
    for (const [id, ni] of posted(w)) {
      const p = (w.market.stocks[id] as World["market"]["stocks"][number]).projection_ni;
      if (Math.abs(p) >= 1e6) misses.push(Math.abs(ni / p - 1.0));
    }
    misses.sort((a, b) => a - b);
    expect(misses.length).toBeGreaterThan(0);
    const max = misses[misses.length - 1] as number;
    expect(max, `max |miss| ${max}`).toBeLessThan(HELD_TOLERANCE);
  });

  /** Runs a projection inside the lock and throws it away. */
  function projectAndDrop(w: World, ctx: JobCtx): void {
    const p = projectQuarterNetIncome(w, ctx.facts.now);
    expect(p.length).toBeGreaterThan(0);
  }

  /**
   * Spec 5.16 "no new rolls" (D141): projecting the quarter on a clone leaves the world, the RNG
   * streams and so the state hash exactly as they were. Two runs of the same seed, one projecting
   * an extra time at every lock, hash the same after a year.
   */
  it("projecting_draws_nothing_and_changes_nothing", { timeout: 1_800_000 }, () => {
    const end = dateTimeMidnight(simDateYmd(2021, 1, 10));
    const plain = unwrap(simNew(data(), 4), "Sim::new");
    const probed = unwrap(simNew(data(), 4), "Sim::new");
    simRegisterTestJob(probed, "LockIpoVotes", "test.project_and_drop", projectAndDrop);
    while (simNow(plain) < end) {
      simStep(plain);
      simStep(probed);
    }
    expect(simStateHash(plain)).toBe(simStateHash(probed));
  });
});
