// Port of crates/sim/tests/spec_6_4.rs: spec 6.4 (station split) through the Lite AI, build-plan
// M6.2: archetype coverage, the Visionary research row, the idle floor and the L = 1 CEO.
// Expected values worked by hand. Pure, no RNG.
//
// Expects:
//   ../../src/ai/archetype.ts  archetypeParams(archetype)
//   ../../src/ai/split.ts      monthlyInflowTb(revenue_usd, tb_per_musd), planStations(labor,
//                              archetype_params, inflow_tb, traits) -> Stations
//   ../../src/ops/stations.ts  stationsTotal(s)
import { describe, expect, it } from "vitest";
import { archetypeParams } from "../src/ai/archetype.ts";
import { monthlyInflowTb, planStations } from "../src/ai/split.ts";
import { stationsTotal } from "../src/ops/stations.ts";
import type { Stations } from "../src/types/state/ops.ts";

describe("spec 6.4 station split", () => {
  it("arrowhead_cash_cow_split", () => {
    // 392 labor units; inflow 40M / 12 x 1 TB = 3.33 TB a month; Cash cow covers 25%:
    // E = ceil(0.25 x 3.33 / 0.9125) = 1. P = the largest 10^k <= 40% x 392 = 156.8, so 100.
    const inflow = monthlyInflowTb(40.0e6, 1.0);
    expect(Math.abs(inflow - 40.0 / 12.0) < 1e-12).toBe(true);
    const s = planStations(392, archetypeParams("CashCow"), inflow, []);
    const want: Stations = {
      productivity: 100,
      enterprise: 1,
      fifty_fifty: 0,
      research: 0,
      idle: 291,
    };
    expect(s).toEqual(want);
  });

  it("coverage_by_archetype_and_visionary_research", () => {
    // Startup (100%) with 50 labor and 10 TB a month: E = ceil(10 / 0.9125) = 11; P = 10.
    const s = planStations(50, archetypeParams("Startup"), 10.0, []);
    expect([s.productivity, s.enterprise, s.research]).toEqual([10, 11, 0]);
    expect(s.idle).toBe(29);
    // A Visionary controller puts floor(10% of 29) = 2 into research.
    const v = planStations(50, archetypeParams("Startup"), 10.0, ["Visionary"]);
    expect([v.productivity, v.enterprise, v.research, v.idle]).toEqual([10, 11, 2, 27]);
    // Incumbent (50%) covers half: ceil(5 / 0.9125) = 6.
    const i = planStations(50, archetypeParams("Incumbent"), 10.0, []);
    expect(i.enterprise).toBe(6);
  });

  it("idle_floor_cuts_enterprise_first", () => {
    // L 20: P 1 (40% is 8, largest 10^k is 1); full coverage of 30 TB wants 33 stations, capped
    // at the 19 left; the 10% idle floor (2) cuts E to 17.
    const s = planStations(20, archetypeParams("Startup"), 30.0, []);
    expect([s.productivity, s.enterprise, s.idle]).toEqual([1, 17, 2]);
    expect(stationsTotal(s)).toBe(20);
  });

  it("single_labor_unit_ceo", () => {
    // L = 1 at 100% coverage: the CEO splits 50/50; otherwise it is productivity.
    let s = planStations(1, archetypeParams("Startup"), 0.1, []);
    expect([s.fifty_fifty, s.productivity]).toEqual([1, 0]);
    s = planStations(1, archetypeParams("Incumbent"), 0.1, []);
    expect([s.fifty_fifty, s.productivity]).toEqual([0, 1]);
  });
});
