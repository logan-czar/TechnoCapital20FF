// Port of crates/sim/tests/spec_7_1_arrowhead.rs: spec 7.1 Arrowhead check, formula side
// (build-plan M3.8): 392 labor units, PC bonus +2, about 8.6 TB held, EBIT after R&D about 1.6M.
//
// The M3 functions (loadout, stations, data, compute) are composed with the 7.1 numbers of
// Arrowhead. The revenue and expense lines belong to lane S M2 (5.4, 5.5) and the R&D plan to M6
// (6.1, 6.3); this test computes those few lines by hand from the spec (marked "by hand").
// Pure, no RNG.
//
// Expects:
//   ../../src/ops/compute.ts       computeBill(stations, tb_stored)
//   ../../src/ops/data.ts          type DataParams, conversionCapacity, dataBookAtLoad,
//                                  dataBookFreeRdFraction, dataBookStoredTb
//   ../../src/ops/labor.ts         laborUnits, openSeats
//   ../../src/ops/productivity.ts  idleDecay
//   ../../src/ops/stations.ts      ARROWHEAD_ENTERPRISE_SHARE, ARROWHEAD_KEY, pcBonus,
//                                  productiveCompute, startingLoadout
//   ../../src/people/simple.ts     companySizeFromRevenue
import { describe, expect, it } from "vitest";
import { computeBill } from "../../src/ops/compute.ts";
import {
  conversionCapacity,
  type DataParams,
  dataBookAtLoad,
  dataBookFreeRdFraction,
  dataBookStoredTb,
} from "../../src/ops/data.ts";
import { laborUnits, openSeats } from "../../src/ops/labor.ts";
import { idleDecay } from "../../src/ops/productivity.ts";
import {
  ARROWHEAD_ENTERPRISE_SHARE,
  ARROWHEAD_KEY,
  pcBonus,
  productiveCompute,
  startingLoadout,
} from "../../src/ops/stations.ts";
import { companySizeFromRevenue } from "../../src/people/simple.ts";
import { SEAT_LABOR } from "../../src/types/state/people.ts";
import { data } from "./common/index.ts";

describe("spec 7.1 Arrowhead", () => {
  it("arrowhead_check", () => {
    const d = data();
    const co = d.companies.rows.find((c) => c.id === ARROWHEAD_KEY);
    if (co === undefined) throw new Error("no Arrowhead");
    expect([co.name, co.industry]).toEqual(["Arrowhead Drilling", "Oil"]);
    const oil = d.industries.rows.find((i) => i.name === co.industry);
    if (oil === undefined) throw new Error("no Oil");
    const r = co.revenue_usd_m * 1.0e6;
    expect(r).toBe(40.0e6);

    // Loadout (7.1): first pass +3, second +2; 392 labor units; 98 productivity stations (PC 98,
    // +2); 1 enterprise station; about 293 idle (decay 0.3).
    const l = startingLoadout({
      revenue_usd: r,
      capital_per_dollar: oil.capital_per_dollar,
      labor_value_usd: oil.labor_value_usd,
      pc_modifier: oil.pc_modifier,
      data_tb_per_musd: oil.data_tb_per_musd,
      location_bonus: 0.0,
      enterprise_share: ARROWHEAD_ENTERPRISE_SHARE,
    });
    expect(l.first_pass_bonus).toBe(3);
    expect(l.pc_bonus).toBe(2);
    const gross = l.gross_assets_usd;
    expect(Math.abs(gross - 39.2e6) < 0.05e6, `gross ${gross}`).toBe(true);
    const start = d.company_start.rows[0];
    expect(start?.id).toBe(ARROWHEAD_KEY);
    expect(Math.abs(gross - (start?.gross_assets_usd ?? 0)) <= 0.5).toBe(true);
    expect(l.labor).toBe(392);
    expect(laborUnits(gross, oil.labor_value_usd)).toBe(392);
    expect(l.stations.productivity).toBe(98);
    expect(productiveCompute(l.stations, oil.pc_modifier)).toBe(98.0);
    expect(pcBonus(l.pc)).toBe(2);
    expect(l.stations.enterprise).toBe(1);
    expect(l.stations.idle).toBe(293);
    expect(idleDecay(l.stations.idle, l.labor)).toBe(0.3);
    // Five seats of a small company.
    expect(openSeats(l.labor)).toEqual([...SEAT_LABOR]);
    expect(companySizeFromRevenue(r)).toBe("Small");

    // Data (7.1, 5.9): about 8.6 TB held at start, 1% free R&D.
    const params: DataParams = {
      tb_per_musd: oil.data_tb_per_musd,
      decay_base: oil.data_decay_base,
    };
    const book = dataBookAtLoad(r, params, conversionCapacity(l.stations), ARROWHEAD_ENTERPRISE_SHARE);
    expect(Math.abs(book.held - 8.6) < 0.05, `held ${book.held}`).toBe(true);
    expect(book.free_rd_pct).toBe(1);
    const freeRd = dataBookFreeRdFraction(book);

    // Shared costs (3.8): the month compute bill, a year of it.
    const shared = computeBill(l.stations, dataBookStoredTb(book)).monthly_usd * 12.0;
    expect(shared).toBe(48_960.0);

    // By hand, lane S M2 lines (5.4, 5.5, 5.10) at M 1.0 and productivity 100:
    const m = 1.0;
    const pPre = 100.0 + l.pc_bonus; // + location bonus 0 (5.2, 5.4)
    const revenue = (gross * oil.asset_turnover * pPre * m) / 100.0;
    expect(Math.abs(revenue - r) < 1.0, `revenue ${revenue}`).toBe(true);
    const v = 1.0 - oil.margin_full_use - oil.fixed_cost_share;
    const variable = revenue * v;
    const decayUsd = oil.asset_decay * Math.max(gross - oil.asset_decay_threshold_usd, 0.0);
    const dEff = decayUsd / gross;
    const fixedCostRate = oil.fixed_cost_share * oil.asset_turnover - dEff - shared / gross;
    const fixedCash = gross * fixedCostRate;
    const depreciation = Math.min(decayUsd, 0.5 * gross);
    const ebitBeforeRd = revenue - variable - fixedCash - depreciation - shared;
    // 7.1: about 2.35M, 5% plus 0.45 x 2 / 102 from the PC bonus.
    const expected = r * (oil.margin_full_use + (oil.fixed_cost_share * 2.0) / 102.0);
    expect(Math.abs(ebitBeforeRd - expected) < 1.0).toBe(true);
    expect(Math.abs(ebitBeforeRd - 2.35e6) < 0.01e6, String(ebitBeforeRd)).toBe(true);

    // By hand, M6 R&D plan (6.1, 6.3): Terry is Greedy, so a Cash cow (R&D mult 0.7) with the
    // Greedy trait mult 0.8: target 2.8%, less 1% free.
    const target = oil.rd_norm * 0.7 * 0.8;
    const rdPlan = Math.max(target - freeRd, 0.0);
    const rdSpend = revenue * rdPlan;
    expect(Math.abs(rdSpend - 0.72e6) < 1.0, `paid R&D ${rdSpend}`).toBe(true);
    const ebitAfterRd = ebitBeforeRd - rdSpend;
    expect(Math.abs(ebitAfterRd - 1.6e6) < 0.05e6, String(ebitAfterRd)).toBe(true);
    const margin = ebitAfterRd / revenue;
    expect(Math.abs(margin - 0.041) < 0.001, `margin ${margin}`).toBe(true);

    // Replacement to hold assets flat (5.10): 1% of the 29.2M above 10M.
    expect(Math.abs(decayUsd - 0.29e6) < 0.005e6, String(decayUsd)).toBe(true);
  });
});
