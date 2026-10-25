// Port of crates/sim/tests/spec_6_2.rs: spec 6.2 (growth plan), build-plan M6.2: one test per row
// of the situation table, the trait nudges, the -20% to +30% clamp and the funding cap. Expected
// values worked by hand from the spec. Pure, no RNG.
//
// Expects:
//   ../../src/ai/archetype.ts  archetypeParams(archetype) -> ArchetypeRow
//   ../../src/ai/growth.ts     type FundingInputs { gross_assets, d_eff, liquidity, min_cash,
//                              purchases_stopped }, type GrowthInputs { loss_q, roa, g_dem,
//                              supply_ratio, archetype (an ArchetypeRow), traits, tech, funding },
//                              fundingCap(g, funding), growthPlan(inputs),
//                              quarterPurchases(gross, d_eff, g), situationGrowth(loss_q, roa,
//                              g_dem, supply_ratio, params), traitNudge(traits, tech)
import { describe, expect, it } from "vitest";
import { archetypeParams } from "../src/ai/archetype.ts";
import {
  type FundingInputs,
  fundingCap,
  type GrowthInputs,
  growthPlan,
  quarterPurchases,
  situationGrowth,
  traitNudge,
} from "../src/ai/growth.ts";

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-12;
}

const inc = () => archetypeParams("Incumbent");

describe("spec 6.2 growth plan", () => {
  it("row_loss_q_4_or_more_sells_down_15_percent", () => {
    expect(situationGrowth(4, 0.5, 0.05, 1.0, inc())).toBe(-0.15);
    expect(situationGrowth(9, -0.5, 0.05, 1.0, inc())).toBe(-0.15);
  });

  it("row_loss_q_2_to_3_shrinks_5_percent", () => {
    expect(situationGrowth(2, 0.5, 0.05, 1.0, inc())).toBe(-0.05);
    expect(situationGrowth(3, -0.1, 0.05, 1.0, inc())).toBe(-0.05);
  });

  it("row_roa_at_or_above_hurdle_follows_demand_plus_adj", () => {
    // Incumbent (hurdle 10%, adj 0): g_dem 5% less max(0, 1.02 - 1) = 3% (Logan, design fix 241,
    // D282: 1 point of growth per 1% of oversupply).
    expect(close(situationGrowth(0, 0.12, 0.05, 1.02, inc()), 0.03)).toBe(true);
    expect(close(situationGrowth(0, 0.12, 0.05, 1.1, inc()), -0.05)).toBe(true);
    // At the hurdle exactly the row applies; S below 1 takes nothing off.
    expect(close(situationGrowth(1, 0.1, 0.05, 0.9, inc()), 0.05)).toBe(true);
    // Cash cow (hurdle 15%, adj -3 pp): 5% - 3% = 2%.
    const cow = archetypeParams("CashCow");
    expect(close(situationGrowth(0, 0.2, 0.05, 1.0, cow), 0.02)).toBe(true);
    // Aggressive grower (hurdle 8%, adj +5 pp).
    const agg = archetypeParams("AggressiveGrower");
    expect(close(situationGrowth(0, 0.08, 0.05, 1.0, agg), 0.1)).toBe(true);
  });

  it("row_roa_below_hurdle_is_at_most_2_percent", () => {
    // min(2%, 5%) = 2%.
    expect(close(situationGrowth(0, 0.05, 0.05, 1.0, inc()), 0.02)).toBe(true);
    // min(2%, 5% - 20%) = -15%.
    expect(close(situationGrowth(0, 0.0, 0.05, 1.2, inc()), -0.15)).toBe(true);
    // ROA 0 exactly is in this row.
    expect(close(situationGrowth(1, 0.0, 0.01, 1.0, inc()), 0.01)).toBe(true);
  });

  it("row_roa_below_zero_with_loss_q_under_2_holds", () => {
    expect(situationGrowth(0, -0.01, 0.05, 1.0, inc())).toBe(0.0);
    expect(situationGrowth(1, -0.3, 0.2, 0.5, inc())).toBe(0.0);
  });

  it("trait_nudges", () => {
    expect(close(traitNudge(["Ambitious"], false), 0.03)).toBe(true);
    expect(close(traitNudge(["Content"], false), -0.01)).toBe(true);
    expect(close(traitNudge(["Cautious"], false), -0.02)).toBe(true);
    expect(close(traitNudge(["Brave"], false), 0.01)).toBe(true);
    // Visionary only in Tech.
    expect(close(traitNudge(["Visionary"], true), 0.01)).toBe(true);
    expect(traitNudge(["Visionary"], false)).toBe(0.0);
    // They add up: +3 + 1 + 1 pp.
    expect(close(traitNudge(["Ambitious", "Brave", "Visionary"], true), 0.05)).toBe(true);
    expect(traitNudge([], true)).toBe(0.0);
  });

  it("clamp_minus_20_to_plus_30", () => {
    const noCap: FundingInputs = {
      gross_assets: 100.0e6,
      d_eff: 0.008,
      liquidity: 1.0e12,
      min_cash: 0.0,
      purchases_stopped: false,
    };
    const i: GrowthInputs = {
      loss_q: 0,
      roa: 0.5,
      g_dem: 0.4,
      supply_ratio: 1.0,
      archetype: archetypeParams("AggressiveGrower"),
      traits: ["Ambitious"],
      tech: false,
      funding: noCap,
    };
    expect(growthPlan(i)).toBe(0.3);
    // -15% sell-down with a Cautious nudge (-2 pp) is -17%; an oversupplied below-hurdle company
    // hits the -20% floor.
    i.loss_q = 4;
    i.traits = ["Cautious"];
    expect(close(growthPlan(i), -0.17)).toBe(true);
    i.loss_q = 0;
    i.roa = 0.01;
    i.supply_ratio = 1.8; // min(2%, 40% - 80%) - 2 pp = -42%
    expect(growthPlan(i)).toBe(-0.2);
  });

  it("funding_cap_scales_g_down_to_half_the_spare_liquidity", () => {
    const noCap: FundingInputs = {
      gross_assets: 100.0e6,
      d_eff: 0.008,
      liquidity: 1.0e12,
      min_cash: 0.0,
      purchases_stopped: false,
    };
    // 100M gross, d_eff 0.8%, g 20%: the quarter buys 100 x 0.208 / 4 = 5.2M. Liquidity 8M and
    // min_cash 2M leave a budget of 0.5 x 6M = 3M, so g = 3 x 4 / 100 - 0.008 = 11.2%.
    const f: FundingInputs = { ...noCap, liquidity: 8.0e6, min_cash: 2.0e6 };
    expect(close(quarterPurchases(100.0e6, 0.008, 0.2), 5.2e6)).toBe(true);
    expect(close(fundingCap(0.2, f), 0.112)).toBe(true);
    // A plan that fits is untouched.
    expect(fundingCap(0.05, f)).toBe(0.05);
    // No spare liquidity: g falls to -d_eff (no purchases), never below.
    const broke: FundingInputs = { ...f, liquidity: 1.0e6 };
    expect(fundingCap(0.2, broke)).toBe(-0.008);
    // A sell-down is already below -d_eff and is not touched.
    expect(fundingCap(-0.15, broke)).toBe(-0.15);
    // Distressed (5.12 step 1) or a pending raise (6.6): g at most -d_eff.
    const stopped: FundingInputs = { ...noCap, purchases_stopped: true };
    expect(fundingCap(0.1, stopped)).toBe(-0.008);
    expect(fundingCap(-0.15, stopped)).toBe(-0.15);
  });
});
