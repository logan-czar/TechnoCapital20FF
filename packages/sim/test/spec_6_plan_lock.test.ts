// Port of crates/sim/tests/spec_6_plan_lock.rs: spec 4.4 row 3 and 6 (the plan lock), build-plan
// M6.4 (formula side): the lock step order, the batch order, and one company composed plan
// (6.1 to 6.5). Pure, no RNG.
//
// Expects:
//   ../../src/ai/plan.ts  COMPANY_PLAN_ORDER, PLAN_LOCK_ORDER, type LockStep (string union
//                         "FixedStartupEvents" | "RandomStartupEvents" | "IpoVotes" | "Listings" |
//                         "LiteAiBatch" | "Consensus"), type PlanStep ("StationSplit" | "Raise" |
//                         "FinancingAndDividend" | ...), type PlanInputs, batchOrder(list of
//                         [CompanyId, CompanyStatus]) -> CompanyId[], lockPlan(inputs) ->
//                         LockedPlan
import { describe, expect, it } from "vitest";
import {
  batchOrder,
  COMPANY_PLAN_ORDER,
  type LockStep,
  lockPlan,
  PLAN_LOCK_ORDER,
  type PlanInputs,
  type PlanStep,
} from "../src/ai/plan.ts";
import type { CompanyId } from "../src/types/ids.ts";
import type { CompanyStatus } from "../src/types/state/finance.ts";
import type { Stations } from "../src/types/state/ops.ts";
import type { Trait } from "../src/types/state/people.ts";

describe("spec 6 plan lock", () => {
  it("lock_order_follows_4_4", () => {
    // 4.4 row 3: startup events (fixed due, then random), then IPO board votes and listings, then
    // the Lite AI batch, new companies included; consensus set.
    const want: LockStep[] = [
      "FixedStartupEvents",
      "RandomStartupEvents",
      "IpoVotes",
      "Listings",
      "LiteAiBatch",
      "Consensus",
    ];
    expect([...PLAN_LOCK_ORDER]).toEqual(want);
    // 6.6: the raise is checked after 6.2 to 6.4 and before 6.5.
    const pos = (s: PlanStep): number => COMPANY_PLAN_ORDER.indexOf(s);
    expect(pos("StationSplit") >= 0).toBe(true);
    expect(pos("StationSplit") < pos("Raise")).toBe(true);
    expect(pos("Raise") < pos("FinancingAndDividend")).toBe(true);
  });

  it("batch_is_every_unfrozen_company_in_id_order", () => {
    const list: [CompanyId, CompanyStatus][] = [
      [5 as CompanyId, "Active"],
      [1 as CompanyId, "Distressed"],
      [3 as CompanyId, "Bankrupt"],
      [652 as CompanyId, "Active"], // born at this lock
      [2 as CompanyId, "Removed"],
    ];
    expect(batchOrder(list)).toEqual([1, 5, 652]);
  });
});

function arrowhead(traits: Trait[]): PlanInputs {
  // Spec 7.1 Arrowhead at load: 40M Oil, 39.2M gross (d_eff 1% of the 29.2M above 10M), 80.4M
  // cash, no line, 392 labor, productivity 100, 1% free R&D.
  const gross = 39.2e6;
  return {
    state_controlled: false,
    controller_traits: traits,
    born_in_play: false,
    tech: false,
    ttm_revenue: 40.0e6,
    ttm_ebit: 1.63e6,
    lt: 0.0,
    q_growth: 0.0,
    supply_ratio: 1.0,
    loss_q: 0,
    gross_assets: gross,
    d_eff: (0.01 * (gross - 10.0e6)) / gross,
    cash: 80.4e6,
    line: { drawn: 0, limit: 0, excess_months_left: 0 },
    status: "Active",
    raise_pending: false,
    rd_norm: 0.05,
    data_tb_per_musd: 1.0,
    productivity: 100.0,
    free_rd_pct: 1,
    labor: 392,
    last_quarter_net_income: 0.0,
  };
}

describe("spec 6 composed plan", () => {
  it("arrowhead_locked_plan", () => {
    const p = lockPlan(arrowhead(["Deceitful", "Greedy", "Gregarious"]));
    const op = p.operating;
    expect(op.archetype).toBe("CashCow");
    // ROA 1.63 / 39.2 = 4.2% is under the 15% hurdle: min(2%, g_dem 0) = 0.
    expect(op.growth).toBe(0.0);
    expect(Math.abs(op.rd_plan - 0.018) < 1e-12).toBe(true);
    const want: Stations = { productivity: 100, enterprise: 1, fifty_fifty: 0, research: 0, idle: 291 };
    expect(op.stations).toEqual(want);
    // g = 0 buys back the decay: 39.2 x 0.745% / 4 = 73,000 dollars a quarter.
    expect(Math.abs(op.planned_purchases - (0.01 * 29.2e6) / 4.0) < 1e-6).toBe(true);
    expect(op.min_cash).toBe(2.0e6);
    expect([p.financing.draw, p.financing.repay]).toEqual([0.0, 0.0]);
  });

  it("born_company_ignores_founder_traits", () => {
    // 5.19.5: a Tech startup under 50M plans as a Startup with no nudges, whatever the founders
    // traits; a Greedy controller would have made it no different here, but an Ambitious one
    // would add 3 pp were it read.
    const i = arrowhead(["Ambitious", "Visionary"]);
    i.tech = true;
    i.ttm_revenue = 20.0e6;
    i.born_in_play = true;
    i.ttm_ebit = 10.0e6; // ROA above the 12% hurdle
    i.lt = 0.05;
    i.q_growth = 1.05 ** 0.25 - 1.0;
    const p = lockPlan(i);
    expect(p.operating.archetype).toBe("Startup");
    // g_dem 5% + Startup adj 4 pp, no Ambitious or Visionary nudge.
    expect(Math.abs(p.operating.growth - 0.09) < 1e-12).toBe(true);
    // No Visionary research row either.
    expect(p.operating.stations.research).toBe(0);
  });
});
