// Port of crates/sim/tests/spec_5_6.rs: spec 5.6 productivity decay and R&D effect (build-plan
// M3.7). Score 50: -6 a year at the norm, +4 net at double the norm, -16 with no R&D (10.0.4).
// Pure formulas, no RNG.
//
// Expects:
//   ../../src/ops/productivity.ts  type ProductivityInputs { rd_plan, free_rd, rd_norm,
//                                  management_score, research_units, idle_units, labor },
//                                  idleDecay(idle, labor), productivityDelta(inp),
//                                  researchMult(units), stepProductivity(p, inp),
//                                  productivityInputsWithStations(rd_plan, free_rd, rd_norm,
//                                  score, stations)   [ProductivityInputs::with_stations]
import { describe, expect, it } from "vitest";
import {
  idleDecay,
  type ProductivityInputs,
  productivityDelta,
  productivityInputsWithStations,
  researchMult,
  stepProductivity,
} from "../src/ops/productivity.ts";
import { stationsOf } from "./common/defaults.ts";

const RD_NORM = 0.05;

function inputs(rdPlan: number, freeRd: number, score: number): ProductivityInputs {
  return {
    rd_plan: rdPlan,
    free_rd: freeRd,
    rd_norm: RD_NORM,
    management_score: score,
    research_units: 0,
    idle_units: 0,
    labor: 100,
    // Spec 5.6 as written: the worked numbers below predate the D973 curve, which is the default.
    rd_diminishing_x: Number.POSITIVE_INFINITY,
  };
}

/** Twelve monthly steps from productivity 100, with no clamp in reach. */
function year(inp: ProductivityInputs): number {
  let p = 100.0;
  for (let i = 0; i < 12; i++) {
    p = stepProductivity(p, inp);
  }
  return p - 100.0;
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

describe("spec 5.6 productivity", () => {
  it("score_50_worked_numbers", () => {
    expect(close(year(inputs(RD_NORM, 0.0, 50.0)), -6.0), "at the norm").toBe(true);
    expect(close(year(inputs(2.0 * RD_NORM, 0.0, 50.0)), 4.0), "double the norm").toBe(true);
    expect(close(year(inputs(0.0, 0.0, 50.0)), -16.0), "no R&D").toBe(true);
  });

  it("free_rd_works_exactly_like_spending", () => {
    // rd_total = rd_plan + free_rd_pct (10.0.11.7).
    const paid = productivityDelta(inputs(0.05, 0.0, 50.0));
    const mixed = productivityDelta(inputs(0.03, 0.02, 50.0));
    expect(close(paid, mixed)).toBe(true);
  });

  it("management_factor_scales_only_the_rd_effect", () => {
    // Score 80: factor 1.3; at double the norm the R&D effect is +13 a year, decay -6.
    expect(close(year(inputs(0.1, 0.0, 80.0)), 13.0 - 6.0)).toBe(true);
    // Score 30: factor 0.8; with no R&D the effect is -8, decay -6.
    expect(close(year(inputs(0.0, 0.0, 30.0)), -8.0 - 6.0)).toBe(true);
    // At the norm the factor does not matter.
    expect(close(year(inputs(RD_NORM, 0.0, 90.0)), -6.0)).toBe(true);
  });

  it("research_multiplier_steps", () => {
    const table: [number, number][] = [
      [0, 1.0],
      [1, 1.01],
      [9, 1.01],
      [10, 1.02],
      [99, 1.02],
      [100, 1.03],
      [999, 1.03],
      [1_000, 1.04],
      [10_000, 1.05],
    ];
    for (const [units, mult] of table) {
      expect(close(researchMult(units), mult), String(units)).toBe(true);
    }
    const inp = inputs(0.1, 0.0, 50.0);
    inp.research_units = 10;
    expect(close(year(inp), 10.0 * 1.02 - 6.0)).toBe(true);
  });

  it("idle_labor_slows_decay", () => {
    // 0.5 a month; 0.4 with 10%+ idle; 0.3 with 25%+ idle (10.0.11.3).
    expect(idleDecay(0, 100)).toBe(0.5);
    expect(idleDecay(9, 100)).toBe(0.5);
    expect(idleDecay(10, 100)).toBe(0.4);
    expect(idleDecay(24, 100)).toBe(0.4);
    expect(idleDecay(25, 100)).toBe(0.3);
    expect(idleDecay(293, 392), "Arrowhead").toBe(0.3);
    expect(idleDecay(0, 1), "the CEO alone").toBe(0.5);
    const inp = inputs(RD_NORM, 0.0, 50.0);
    inp.idle_units = 30;
    expect(close(year(inp), -3.6)).toBe(true);
  });

  it("clamp_holds_productivity_between_30_and_200", () => {
    const none = inputs(0.0, 0.0, 50.0);
    let p = 100.0;
    for (let i = 0; i < 12 * 20; i++) {
      p = stepProductivity(p, none);
    }
    expect(p).toBe(30.0);
    const lots = inputs(1.0, 0.0, 100.0);
    let q = 100.0;
    for (let i = 0; i < 12 * 5; i++) {
      q = stepProductivity(q, lots);
    }
    expect(q).toBe(200.0);
  });

  it("the default R&D curve (D973) halves an overspend of one norm", () => {
    const { rd_diminishing_x: _spec, ...curved } = inputs(RD_NORM * 2.0, 0.0, 50.0);
    expect(productivityDelta(inputs(RD_NORM * 2.0, 0.0, 50.0))).toBeGreaterThan(productivityDelta(curved));
    expect(
      close(
        productivityDelta(curved) - productivityDelta(inputs(RD_NORM, 0.0, 50.0)),
        (10.0 * 0.5 * 1.0) / 12.0,
      ),
    ).toBe(true);
  });

  it("inputs_from_stations", () => {
    const s = stationsOf({ productivity: 98, enterprise: 1, idle: 293 });
    const inp = productivityInputsWithStations(0.018, 0.01, RD_NORM, 50.0, s);
    expect([inp.labor, inp.idle_units, inp.research_units]).toEqual([392, 293, 0]);
    // Arrowhead at score 50: rd_total 2.8% gives 10 x (0.56 - 1) / 12 - 0.3 a month.
    expect(close(productivityDelta(inp), (10.0 * (0.028 / 0.05 - 1.0)) / 12.0 - 0.3)).toBe(true);
  });
});
