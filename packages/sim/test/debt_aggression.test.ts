// D971: the debt aggression experiment. Level 0 is spec 6.5 and 6.2 untouched; higher levels hold
// more of the credit line drawn, borrow for the quarter's purchases, spend more of their liquidity
// and grow harder while profitable. Pure, no RNG.
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { archetypeParams } from "../src/ai/archetype.ts";
import { debtAggressionOf, type FinancingInputs, financing } from "../src/ai/financing.ts";
import { type FundingInputs, fundingCap, growthPlan } from "../src/ai/growth.ts";
import { simNew, simWorld } from "../src/lib.ts";

function inputs(cash: number, drawn: number, purchases: number, level?: number): FinancingInputs {
  return {
    cash,
    line: { drawn, limit: 100.0e6, excess_months_left: 0 },
    min_cash: 10.0e6,
    planned_purchases: purchases,
    traits: [],
    last_quarter_net_income: 0.0,
    archetype_payout_mult: 1.0,
    status: "Active",
    ...(level === undefined ? {} : { debt_aggression: level }),
  };
}

describe("debt aggression financing (D971)", () => {
  it("level 0 is the spec 6.5 row, whether given or absent", () => {
    for (const [cash, drawn, purchases] of [
      [60.0e6, 20.0e6, 0.0],
      [12.0e6, 0.0, 5.0e6],
      [200.0e6, 0.0, 30.0e6],
    ] as const) {
      expect(financing(inputs(cash, drawn, purchases, 0))).toEqual(financing(inputs(cash, drawn, purchases)));
    }
  });

  it("a leveraged company borrows to fund purchases it could pay in cash", () => {
    // Plenty of cash and nothing drawn: spec 6.5 draws nothing. Level 2 holds 40% of the 100M limit.
    expect(financing(inputs(200.0e6, 0.0, 30.0e6)).draw).toBe(0);
    expect(financing(inputs(200.0e6, 0.0, 30.0e6, 2)).draw).toBe(30.0e6);
    // The draw stops at the hold share.
    expect(financing(inputs(200.0e6, 30.0e6, 30.0e6, 2)).draw).toBe(10.0e6);
  });

  it("repays only what is drawn above the hold share", () => {
    // Own cash 190M, drawn 60M: the base row repays all 60M. Level 2 holds 40M, so it repays 20M.
    expect(financing(inputs(250.0e6, 60.0e6, 0.0)).repay).toBe(60.0e6);
    expect(financing(inputs(250.0e6, 60.0e6, 0.0, 2)).repay).toBe(20.0e6);
  });

  it("still draws the shortfall below min_cash", () => {
    const f = financing(inputs(12.0e6, 0.0, 5.0e6, 1));
    expect(f.draw).toBe(5.0e6); // purchases 5M over the 3M gap, within the 20M hold
  });

  it("the level of company id cycles through the levels, 0 with none", () => {
    expect(debtAggressionOf(undefined, 7)).toBe(0);
    expect(debtAggressionOf([], 7)).toBe(0);
    expect([0, 1, 2, 3, 4, 5].map((id) => debtAggressionOf([0, 2, 4], id))).toEqual([0, 2, 4, 0, 2, 4]);
  });
});

describe("debt aggression growth (D971)", () => {
  const funding: FundingInputs = {
    gross_assets: 100.0e6,
    d_eff: 0.008,
    liquidity: 1.0e12,
    min_cash: 0.0,
    purchases_stopped: false,
  };
  const base = {
    loss_q: 0,
    roa: 0.2,
    g_dem: 0.05,
    supply_ratio: 1.0,
    archetype: archetypeParams("Incumbent"),
    traits: [],
    tech: false,
    funding,
  };

  it("adds a point per level while profitable and not shrinking", () => {
    const g0 = growthPlan(base);
    expect(growthPlan({ ...base, debt_aggression: 3 })).toBeCloseTo(g0 + 0.03, 12);
    expect(growthPlan({ ...base, debt_aggression: 0 })).toBe(g0);
  });

  it("adds nothing at a loss or in a shrink", () => {
    const loss = { ...base, roa: -0.01 };
    expect(growthPlan({ ...loss, debt_aggression: 4 })).toBe(growthPlan(loss));
    const shrink = { ...base, loss_q: 2 };
    expect(growthPlan({ ...shrink, debt_aggression: 4 })).toBe(growthPlan(shrink));
  });

  it("lets purchases use more of the liquidity", () => {
    const f: FundingInputs = { ...funding, liquidity: 10.0e6 };
    const loose = fundingCap(0.3, { ...f, debt_aggression: 4 });
    expect(loose).toBeGreaterThan(fundingCap(0.3, f));
  });
});

describe("debt aggression in the world (D971)", () => {
  it("is off by default and set by the option", () => {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data");
    const off = simNew(structuredClone(r.value), 3);
    const on = simNew(structuredClone(r.value), 3, { debt_levels: [0, 1, 2] });
    if (!off.ok || !on.ok) throw new Error("sim");
    expect(simWorld(off.value).debt_levels).toBeUndefined();
    expect(simWorld(on.value).debt_levels).toEqual([0, 1, 2]);
  });
});
