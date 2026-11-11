// The levers (pivot 4.3; lane S3): the economy reads government only through `World.levers`. Each
// lever at its neutral value leaves its reader's input untouched, `leversApply` is the one way one
// moves, and each lever set above neutral moves its quantity the expected way, in the formula and in
// a short run. Not a Rust test.

import { describe, expect, it } from "vitest";
import { setEffectiveDemand } from "../src/economy/demand.ts";
import { setExpenses } from "../src/economy/revenue.ts";
import { rowAfterMonth, rowAssetsAtLoad, setSupply, unitSupply } from "../src/economy/supply.ts";
import {
  ANTITRUST_FREE_GROWTH,
  corpTaxRate,
  fiscalDemandMult,
  largestFirms,
  leverGrowthPlan,
  leversApply,
  leversNeutral,
  planLevers,
  REGULATION_COST_K,
  regulatedCost,
  STATE_GROWTH_PLAN_K,
  SUBSIDY_DEMAND_K,
  subsidisedDemand,
  tariffPass,
  usGdpShare,
  usStateOfProvinces,
} from "../src/governing/levers.ts";
import { type Sim, simRunUntil, simWorld } from "../src/lib.ts";
import type { CompanyId, CountryId, IndustryId, UsStateId } from "../src/types/ids.ts";
import type { World } from "../src/types/world.ts";
import { testSim } from "./test_sim.ts";

const world = (seed: number): World => simWorld(testSim(seed));
const industry = (n: number): IndustryId => n as IndustryId;
/** After the first quarter's plan lock, before the first close. */
const AFTER_LOCK = { year: 2020, month: 2, day: 1 };
const growthPlan = (w: World, id: CompanyId): number =>
  (w.units[(w.companies[id] as World["companies"][number]).units[0] as number] as World["units"][number])
    .growth_plan;
const active = (w: World, id: number): boolean =>
  (w.companies[id] as World["companies"][number]).finance.distress.status === "Active";

describe("levers: neutral is an exact no-op (pivot 4.3)", () => {
  it("every reader hands its input back", () => {
    const w = world(1);
    const usa = w.politics.country;
    for (const x of [0, 1, 0.1 + 0.2, 123456.789e6, -7.5]) {
      for (const id of [0, 3, w.industries.length - 1]) {
        expect(Object.is(subsidisedDemand(w, id, x), x)).toBe(true);
        expect(Object.is(regulatedCost(w, id, x), x)).toBe(true);
      }
      expect(Object.is(leverGrowthPlan(w, planLevers(w), 0 as CompanyId, x), x)).toBe(true);
    }
    expect(tariffPass(w, 0)).toBe(1);
    expect(fiscalDemandMult(w)).toBe(1);
    expect(planLevers(w)).toBeNull();
    expect(corpTaxRate(w, usa)).toBe((w.countries[usa] as World["countries"][number]).corp_tax_rate);
  });

  it("the jobs' formulas give the same bits with the levers neutral as the start gave", () => {
    const w = world(2);
    const before = structuredClone({ industries: w.industries, units: w.units });
    setEffectiveDemand(w);
    setSupply(w);
    setExpenses(w);
    expect(w.industries).toEqual(before.industries);
    expect(w.units).toEqual(before.units);
  });
});

describe("levers: leversApply (pivot 4.3, 7.7)", () => {
  it("sets the levers named, holds the shares to 0..1 and shows the tax on the USA's row", () => {
    const w = world(1);
    const neutral = structuredClone(w.levers);
    const states = w.politics.states.length;
    leversApply(w, {});
    expect(w.levers).toEqual(neutral);
    leversApply(w, {
      corp_tax: 0.3,
      fiscal: 0.01,
      rate_bias: -0.002,
      regulation: [[industry(1), 0.05]],
      subsidy: [[industry(2), 0.1]],
      antitrust: [
        [industry(3), 0.4],
        [industry(4), 7],
      ],
      tariff: [
        [industry(5), 0.25],
        [industry(6), -1],
        [industry(9999), 0.5],
      ],
      state_growth: [[(states - 1) as UsStateId, 0.02]],
    });
    const want = leversNeutral(w.industries.length, states, 0.3);
    want.fiscal = 0.01;
    want.rate_bias = -0.002;
    want.regulation[1] = 0.05;
    want.subsidy[2] = 0.1;
    want.antitrust[3] = 0.4;
    want.antitrust[4] = 1;
    want.tariff[5] = 0.25;
    want.state_growth[states - 1] = 0.02;
    expect(w.levers).toEqual(want);
    expect((w.countries[w.politics.country] as World["countries"][number]).corp_tax_rate).toBe(0.3);
    // The player's rates are not this function's to move.
    expect(w.levers.gains_tax).toBe(neutral.gains_tax);
  });

  it("the tax lever is the USA's rate only", () => {
    const w = world(1);
    const other = w.countries.findIndex((_, i) => i !== w.politics.country) as CountryId;
    const rate = (w.countries[other] as World["countries"][number]).corp_tax_rate;
    leversApply(w, { corp_tax: 0.5 });
    expect(corpTaxRate(w, w.politics.country)).toBe(0.5);
    expect(corpTaxRate(w, other)).toBe(rate);
  });
});

describe("levers: each one moves its quantity (pivot 4.3)", () => {
  it("subsidy raises its industry's demand and no other's", () => {
    const w = world(3);
    const before = w.industries.map((i) => i.demand);
    leversApply(w, { subsidy: [[industry(4), 0.1]] });
    setEffectiveDemand(w);
    w.industries.forEach((ind, id) => {
      if (id === 4) expect(ind.demand).toBeCloseTo((before[id] as number) * (1 + SUBSIDY_DEMAND_K * 0.1), 0);
      else expect(ind.demand).toBe(before[id]);
    });
    expect((w.industries[4] as World["industries"][number]).demand).toBeGreaterThan(before[4] as number);
  });

  it("fiscal raises every industry's demand by the USA's share of the push", () => {
    const w = world(3);
    const before = w.industries.map((i) => i.demand);
    leversApply(w, { fiscal: 0.02 });
    expect(fiscalDemandMult(w)).toBe(1 + 0.02 * usGdpShare(w));
    expect(usGdpShare(w)).toBeGreaterThan(0);
    setEffectiveDemand(w);
    w.industries.forEach((ind, id) => {
      expect(ind.demand / (before[id] as number)).toBeCloseTo(fiscalDemandMult(w), 12);
    });
  });

  it("regulation raises the variable and fixed cash costs of its industry's units only", () => {
    const w = world(4);
    const target = (w.units.find((u) => u.revenue_m > 0 && active(w, u.company)) as World["units"][number])
      .industry;
    const before = structuredClone(w.units);
    leversApply(w, { regulation: [[target, 0.1]] });
    setExpenses(w);
    const k = 1 + REGULATION_COST_K * 0.1;
    let raised = 0;
    w.units.forEach((u, id) => {
      const b = before[id] as World["units"][number];
      if (u.industry !== target) {
        expect(u).toEqual(b);
        return;
      }
      expect(u.variable_m).toBeCloseTo(b.variable_m * k, 4);
      expect(u.fixed_m).toBeCloseTo(b.fixed_m * k, 4);
      expect([u.dep_m, u.rd_m, u.shared_m, u.revenue_m]).toEqual([b.dep_m, b.rd_m, b.shared_m, b.revenue_m]);
      if (u.variable_m + u.fixed_m > b.variable_m + b.fixed_m) raised += 1;
    });
    expect(raised).toBeGreaterThan(0);
  });

  it("tariff keeps its share of the rest-of-world block out of supply", () => {
    const w = world(5);
    const ind = w.industries[7] as World["industries"][number];
    setSupply(w);
    const without = ind.supply;
    // No shipped world has a block yet: give this industry one the size of its fringe.
    ind.row_assets = ind.fringe_assets;
    const block = ind.row_assets * ind.params.asset_turnover;
    expect(block).toBeGreaterThan(0);
    setSupply(w);
    expect(ind.supply).toBeCloseTo(without + block, 0);
    const open = ind.supply_ratio;
    const openM = ind.market_factor;
    leversApply(w, { tariff: [[industry(7), 0.25]] });
    expect(tariffPass(w, 7)).toBe(0.75);
    setSupply(w);
    expect(ind.supply).toBeCloseTo(without + 0.75 * block, 0);
    expect(ind.supply_ratio).toBeLessThan(open);
    expect(ind.market_factor).toBeGreaterThanOrEqual(openM);
    leversApply(w, { tariff: [[industry(7), 1]] });
    setSupply(w);
    expect(ind.supply).toBe(without);
    // Another industry's block is not touched by this one's tariff.
    const other = w.industries[8] as World["industries"][number];
    other.row_assets = 1e9;
    setSupply(w);
    const full = other.supply;
    leversApply(w, { tariff: [[industry(7), 0.5]] });
    setSupply(w);
    expect(other.supply).toBe(full);
  });

  it("the block's size at load is the removed unit's supply, and it grows on the long-term rate", () => {
    expect(rowAssetsAtLoad(2e9, 105) * 0.8).toBeCloseTo(unitSupply(2e9, 0.8, 105), 3);
    expect(rowAfterMonth(100, 0.05) ** 12 / 100 ** 12).toBeCloseTo(1.05, 12);
    expect(rowAfterMonth(100, 0)).toBe(100);
  });
});

describe("levers: in a short run (pivot 4.3)", () => {
  /** Runs past the first plan lock. */
  const ran = (seed: number, set?: (w: World) => void): World => {
    const sim: Sim = testSim(seed);
    set?.(simWorld(sim));
    simRunUntil(sim, AFTER_LOCK);
    return simWorld(sim);
  };

  it("antitrust caps the growth plan of its industry's largest firm, and only that firm's", () => {
    const base = ran(6);
    const start = world(6);
    const largest = largestFirms(start);
    // An industry whose largest firm planned to grow, with another firm that plans beside it.
    const target = start.industries.findIndex((_, id) => {
      const top = largest[id];
      return (
        top !== null &&
        top !== undefined &&
        growthPlan(base, top) > 0.01 &&
        start.companies.some((c, cid) => c.industry === id && cid !== top && active(base, cid))
      );
    });
    expect(target).toBeGreaterThanOrEqual(0);
    const top = largest[target] as CompanyId;
    const hard = ran(6, (w) => leversApply(w, { antitrust: [[industry(target), 1]] }));
    expect(growthPlan(hard, top)).toBeLessThanOrEqual(0);
    expect(growthPlan(hard, top)).toBeLessThan(growthPlan(base, top));
    const half = ran(6, (w) => leversApply(w, { antitrust: [[industry(target), 0.5]] }));
    expect(growthPlan(half, top)).toBeLessThanOrEqual(ANTITRUST_FREE_GROWTH * 0.5);
    expect(growthPlan(half, top)).toBeGreaterThanOrEqual(growthPlan(hard, top));
    // The other firms of the industry, and every other industry's largest, plan as before.
    start.companies.forEach((c, cid) => {
      if (cid !== top && (c.industry === target || largest[c.industry] === cid)) {
        expect(growthPlan(hard, cid as CompanyId)).toBe(growthPlan(base, cid as CompanyId));
      }
    });
  });

  it("state_growth shifts the growth plan of the firms headquartered in the state", () => {
    const base = ran(7);
    const start = world(7);
    const stateOf = usStateOfProvinces(start);
    const home = start.companies.findIndex((c, id) => stateOf.has(c.hq_province) && active(base, id));
    expect(home).toBeGreaterThanOrEqual(0);
    const state = stateOf.get((start.companies[home] as World["companies"][number]).hq_province) as UsStateId;
    const up = ran(7, (w) => leversApply(w, { state_growth: [[state, 0.03]] }));
    let moved = 0;
    start.companies.forEach((c, id) => {
      const cid = id as CompanyId;
      if (!active(base, id)) return;
      if (stateOf.get(c.hq_province) === state) {
        expect(growthPlan(up, cid)).toBeCloseTo(growthPlan(base, cid) + STATE_GROWTH_PLAN_K * 0.03, 12);
        moved += 1;
      } else {
        expect(growthPlan(up, cid)).toBe(growthPlan(base, cid));
      }
    });
    expect(moved).toBeGreaterThan(0);
    const down = ran(7, (w) => leversApply(w, { state_growth: [[state, -0.03]] }));
    expect(growthPlan(down, home as CompanyId)).toBeLessThan(growthPlan(base, home as CompanyId));
  });

  it("corp_tax moves the tax US companies accrue and no one else's", () => {
    const month = { year: 2020, month: 3, day: 1 };
    const run = (set?: (w: World) => void): World => {
      const sim = testSim(8);
      set?.(simWorld(sim));
      simRunUntil(sim, month);
      return simWorld(sim);
    };
    const base = run();
    const high = run((w) => leversApply(w, { corp_tax: w.levers.corp_tax + 0.1 }));
    const usa = base.politics.country;
    let more = 0;
    base.companies.forEach((c, id) => {
      const a = c.finance.tax.accrued;
      const b = (high.companies[id] as World["companies"][number]).finance.tax.accrued;
      if (c.hq_country !== usa) expect(b).toBe(a);
      else if (a > 0) {
        expect(b).toBeGreaterThan(a);
        more += 1;
      } else expect(b).toBe(a);
    });
    expect(more).toBeGreaterThan(0);
  });

  it("regulation lowers its industry's profit, and subsidy raises its industry's revenue, a month on", () => {
    const month = { year: 2020, month: 2, day: 1 };
    const run = (set?: (w: World) => void): World => {
      const sim = testSim(9);
      set?.(simWorld(sim));
      simRunUntil(sim, month);
      return simWorld(sim);
    };
    const base = run();
    const target = (base.units.find((u) => u.revenue_m > 0) as World["units"][number]).industry;
    const sum = (w: World, f: (u: World["units"][number]) => number): number =>
      w.units.reduce((n, u) => (u.industry === target ? n + f(u) : n), 0);
    const profit = (u: World["units"][number]): number =>
      u.revenue_m - u.variable_m - u.fixed_m - u.dep_m - u.rd_m - u.shared_m;
    const regulated = run((w) => leversApply(w, { regulation: [[target, 0.1]] }));
    expect(sum(regulated, profit)).toBeLessThan(sum(base, profit));
    const subsidised = run((w) => leversApply(w, { subsidy: [[target, 0.1]] }));
    expect((subsidised.industries[target] as World["industries"][number]).demand).toBeGreaterThan(
      (base.industries[target] as World["industries"][number]).demand,
    );
    expect(sum(subsidised, (u) => u.revenue_m)).toBeGreaterThan(sum(base, (u) => u.revenue_m));
  });
});
