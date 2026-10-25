// Port of crates/sim/tests/spec_5_8.rs: spec 5.8 productive compute and PC bonus, 6.4 station
// split and the 7.1 starting loadout (build-plan M3.4): the bonus steps match the 5.8 table.
// Pure formulas, no RNG.
//
// Expects:
//   ../../src/ops/stations.ts  type LoadoutInputs { revenue_usd, capital_per_dollar,
//                              labor_value_usd, pc_modifier, data_tb_per_musd, location_bonus,
//                              enterprise_share }, type SplitInputs { labor, coverage, inflow_tb,
//                              visionary }, stationsTotal(s) [Stations::total],
//                              loadoutProductivityStations(labor), pcBonus(pc),
//                              productiveCompute(stations, modifier), startingLoadout(inputs) ->
//                              Loadout { first_pass_bonus, assets_bonus, pc_bonus,
//                              gross_assets_usd, labor, stations, pc, barebones },
//                              stationSplit(inputs) -> Stations
//   "@tc20ff/sim-data/node"    loadWorld, defaultDataDir (via ./common/index.ts data())
import { describe, expect, it } from "vitest";
import {
  type LoadoutInputs,
  loadoutProductivityStations,
  pcBonus,
  productiveCompute,
  startingLoadout,
  stationSplit,
  stationsTotal,
} from "../src/ops/stations.ts";
import type { Stations } from "../src/types/state/ops.ts";
import { stationsOf } from "./common/defaults.ts";
import { data } from "./common/index.ts";

function split(labor: number, coverage: number, inflowTb: number, visionary: boolean): Stations {
  return stationSplit({ labor, coverage, inflow_tb: inflowTb, visionary });
}

function loadoutInputs(revenueM: number, share: number): LoadoutInputs {
  return {
    revenue_usd: revenueM * 1.0e6,
    capital_per_dollar: 1.0,
    labor_value_usd: 100_000.0,
    pc_modifier: 1.0,
    data_tb_per_musd: 1.0,
    location_bonus: 0.0,
    enterprise_share: share,
  };
}

describe("spec 5.8 and 6.4", () => {
  it("bonus_steps_match_the_table", () => {
    // 5.8: under 1: 0; 1 to 9.99: +1; 10 to 99.99: +2; 100 to 999.99: +3; 1,000 to 9,999.99: +4;
    // 10,000+: +5, +1 per further 10x.
    const table: [number, number][] = [
      [0.0, 0],
      [0.5, 0],
      [0.999, 0],
      [1.0, 1],
      [9.99, 1],
      [10.0, 2],
      [99.99, 2],
      [100.0, 3],
      [999.99, 3],
      [1_000.0, 4],
      [9_999.99, 4],
      [10_000.0, 5],
      [99_999.0, 5],
      [100_000.0, 6],
      [1.0e6, 7],
      [1.0e9, 10],
      [-3.0, 0],
    ];
    for (const [pc, bonus] of table) {
      expect(pcBonus(pc), `PC ${pc}`).toBe(bonus);
    }
    // Every power of ten lands on its step, and just under it on the one before.
    let p = 1.0;
    for (let k = 1; k <= 15; k++) {
      expect(pcBonus(p), `10^${k - 1}`).toBe(k);
      if (k > 1) {
        expect(pcBonus(p * (1.0 - 1e-12))).toBe(k - 1);
      }
      p *= 10.0;
    }
  });

  it("pc_counts_half_of_each_fifty_fifty_station", () => {
    const s = stationsOf({ productivity: 98, enterprise: 1, fifty_fifty: 4, idle: 293 });
    expect(productiveCompute(s, 1.0)).toBe(100.0);
    expect(pcBonus(productiveCompute(s, 1.0))).toBe(3);
    expect(productiveCompute(s, 0.5), "the main industry modifier").toBe(50.0);
    const ceo = stationsOf({ fifty_fifty: 1 });
    expect(pcBonus(productiveCompute(ceo, 1.0)), "PC 0.5 is under 1").toBe(0);
  });

  it("station_split_follows_6_4", () => {
    // Arrowhead at its first plan lock: L 392, Cash cow coverage 25%, inflow 40/12 TB.
    const a = split(392, 0.25, 40.0 / 12.0, false);
    expect(a.productivity, "largest 10^k at most 156.8").toBe(100);
    expect(a.enterprise, "ceil(0.25 x 3.33 / 0.9125) = 1").toBe(1);
    expect([a.research, a.idle, stationsTotal(a)]).toEqual([0, 291, 392]);
    // P: the largest power of ten at most 40% of L, minimum 1.
    expect(split(2, 0.5, 0.0, false).productivity).toBe(1);
    expect(split(24, 0.5, 0.0, false).productivity, "9.6").toBe(1);
    expect(split(25, 0.5, 0.0, false).productivity, "10.0").toBe(10);
    expect(split(249, 0.5, 0.0, false).productivity).toBe(10);
    expect(split(250, 0.5, 0.0, false).productivity).toBe(100);
    // Visionary: 10% of what is left after P and E, rounded down (D207).
    const v = split(1000, 0.5, 9.125, true);
    expect([v.productivity, v.enterprise, v.research, v.idle]).toEqual([100, 5, 89, 806]);
    // Keep 10% idle when L is at least 10: E is cut first, then R.
    const tight = split(100, 1.0, 1000.0, true);
    expect(tight.productivity).toBe(10);
    expect([tight.enterprise, tight.research, tight.idle]).toEqual([80, 0, 10]);
    // Under L 10 no idle floor.
    const small = split(5, 1.0, 1000.0, false);
    expect([small.productivity, small.enterprise, small.idle]).toEqual([1, 4, 0]);
  });

  it("ceo_splits_fifty_fifty_only_at_one_labor_unit_and_full_coverage", () => {
    const full = split(1, 1.0, 0.1, false);
    expect([full.productivity, full.fifty_fifty, stationsTotal(full)]).toEqual([0, 1, 1]);
    const half = split(1, 0.5, 0.1, false);
    expect([half.productivity, half.fifty_fifty]).toEqual([1, 0]);
    const two = split(2, 1.0, 0.1, false);
    expect([two.productivity, two.fifty_fifty, two.enterprise]).toEqual([1, 0, 1]);
  });

  it("arrowhead_loadout", () => {
    // 7.1: first pass +3 (400 labor units, 100 stations), second +2; gross 40 x 100 / 102;
    // 392 labor units, 98 productivity stations, 1 enterprise, about 293 idle.
    const l = startingLoadout(loadoutInputs(40.0, 0.1));
    expect(l.first_pass_bonus).toBe(3);
    expect([l.assets_bonus, l.pc_bonus]).toEqual([2, 2]);
    expect(Math.abs(l.gross_assets_usd - 40.0e6 / 1.02) < 1e-6).toBe(true);
    expect(l.labor).toBe(392);
    expect(l.stations.productivity).toBe(98);
    expect(l.stations.enterprise).toBe(1);
    expect(l.stations.idle).toBe(293);
    expect(l.pc).toBe(98.0);
  });

  it("barebones_and_small_loadouts", () => {
    const b = startingLoadout(loadoutInputs(0.05, 0.5));
    expect(b.barebones).toBe(true);
    expect([b.gross_assets_usd, b.labor]).toEqual([100_000.0, 1]);
    expect(b.stations.productivity).toBe(1);
    expect(stationsTotal(b.stations)).toBe(1);
    // The fixed 100,000 dollar asset is not sized from a bonus; its live PC 1 gives +1 (5.8).
    expect([b.first_pass_bonus, b.assets_bonus, b.pc_bonus]).toEqual([0, 0, 1]);
    // 0.25M: 2 labor units, 1 productivity station; the C16 enterprise station fits.
    const s = startingLoadout(loadoutInputs(0.25, 0.5));
    expect([s.labor, s.stations.productivity, s.stations.enterprise]).toEqual([2, 1, 1]);
    // 0.12M: 1 labor unit, so the enterprise station is capped away (D208).
    const one = startingLoadout(loadoutInputs(0.12, 0.5));
    expect([one.labor, one.stations.productivity, one.stations.enterprise]).toEqual([1, 1, 0]);
  });

  it("productivity_stations_round_halves_to_even_like_gen_py", () => {
    expect(loadoutProductivityStations(1)).toBe(1);
    expect(loadoutProductivityStations(2), "round(0.5) = 0, minimum 1").toBe(1);
    expect(loadoutProductivityStations(6), "1.5 to 2").toBe(2);
    expect(loadoutProductivityStations(10), "2.5 to 2").toBe(2);
    expect(loadoutProductivityStations(14), "3.5 to 4").toBe(4);
    expect(loadoutProductivityStations(392)).toBe(98);
  });

  it("loadout_gross_assets_match_company_start_csv", () => {
    // Build-plan 4.2 starting state: gen.py writes round(gross) to company-start.csv.
    const d = data();
    const unsettled: [string, number, number][] = [];
    d.companies.rows.forEach((co, i) => {
      const start = d.company_start.rows[i];
      if (start === undefined) throw new Error(`no company-start row ${i}`);
      expect(co.id).toBe(start.id);
      const ind = d.industries.rows.find((x) => x.name === co.industry);
      if (ind === undefined) throw new Error(`no industry ${co.industry}`);
      const l = startingLoadout({
        revenue_usd: co.revenue_usd_m * 1.0e6,
        capital_per_dollar: ind.capital_per_dollar,
        labor_value_usd: ind.labor_value_usd,
        pc_modifier: ind.pc_modifier,
        data_tb_per_musd: ind.data_tb_per_musd,
        location_bonus: 0.0,
        enterprise_share: co.id === "CO-0001" ? 0.1 : 0.5,
      });
      expect(
        Math.abs(l.gross_assets_usd - start.gross_assets_usd) <= 0.5 + 1e-6,
        `${co.id}: ${l.gross_assets_usd} vs ${start.gross_assets_usd}`,
      ).toBe(true);
      expect(stationsTotal(l.stations)).toBe(l.labor);
      if (!l.barebones && l.pc_bonus !== l.assets_bonus) {
        unsettled.push([co.id, l.assets_bonus, l.pc_bonus]);
      }
    });
    // Two passes do not settle for three companies near 42 billion: pass 1 gives +6 (105,198
    // stations), pass 2 +5 (99,243), but gross set at +5 buys 100,188 stations, which is +6, so
    // at the live bonus they make 106 / 105 of R (+0.95 percent). More passes alternate +5, +6
    // (design fix 201): the second-pass bonus (assets_bonus) holds until the first monthly
    // recount, and M2.6 checks load revenue against it.
    expect(unsettled).toEqual([
      ["CO-0154", 5, 6],
      ["CO-0540", 5, 6],
      ["CO-0651", 5, 6],
    ]);
  });
});
