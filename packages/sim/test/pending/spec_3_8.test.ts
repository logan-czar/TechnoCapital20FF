// Port of crates/sim/tests/spec_3_8.rs: spec 3.8 compute and licence costs (build-plan M3.5):
// costs match 3.8 for Arrowhead. Pure formulas, no RNG.
//
// Expects:
//   ../../src/ops/compute.ts   computeBill(stations, tb_stored) -> ComputeBill, dataCompute(tb),
//                              extraBaseCompute(station_count)
//   ../../src/ops/data.ts      type DataParams { tb_per_musd, decay_base },
//                              dataBookAtLoad(revenue, params, conversion_capacity, free_rd)
//                              [DataBook::at_load], conversionCapacity(stations),
//                              dataBookStoredTb(book)
import { describe, expect, it } from "vitest";
import { computeBill, dataCompute, extraBaseCompute } from "../../src/ops/compute.ts";
import { conversionCapacity, type DataParams, dataBookAtLoad, dataBookStoredTb } from "../../src/ops/data.ts";
import type { Stations } from "../../src/types/state/ops.ts";

const OIL: DataParams = { tb_per_musd: 1.0, decay_base: 0.02 };

/** Stations::default(): every count 0. */
function stationsOf(over: Partial<Stations>): Stations {
  return { productivity: 0, enterprise: 0, fifty_fifty: 0, research: 0, idle: 0, ...over };
}

describe("spec 3.8 compute and licences", () => {
  it("arrowhead_compute_and_licences", () => {
    // 7.1: 392 stations (98 productivity, 1 enterprise, 293 idle); about 8.6 TB held plus one
    // month of unstructured data (40 / 12 TB).
    const stations = stationsOf({ productivity: 98, enterprise: 1, idle: 293 });
    const book = dataBookAtLoad(40.0e6, OIL, conversionCapacity(stations), 0.1);
    const stored = dataBookStoredTb(book);
    expect(Math.abs(stored - (8.6 + 40.0 / 12.0)) < 0.05, String(stored)).toBe(true);
    const bill = computeBill(stations, stored);
    // Extra base compute max(9, ceil(0.2 x 392)) = 79 at 50 dollars.
    expect(bill.extra_base_compute).toBe(79);
    // Data compute max(10, ceil(1.2 x 11.9 / 100)) = 10 at 10 dollars.
    expect(bill.data_compute).toBe(10);
    // One enterprise licence at 30 dollars.
    expect(bill.licences).toBe(1);
    expect(bill.monthly_usd).toBe(79.0 * 50.0 + 10.0 * 10.0 + 30.0);
    expect(bill.monthly_usd * 12.0, "a year").toBe(48_960.0);
  });

  it("barebones_company_pays_minimum_compute", () => {
    // 7.1, 10.0.11.1: 10 base compute (1 bundled + 9 extra) and 10 data compute, CEO on
    // productivity, 0 TB: 550 dollars a month, 6,600 a year (5.5 rounds it to 7,000).
    const ceo = stationsOf({ productivity: 1 });
    const bill = computeBill(ceo, 0.0);
    expect([bill.extra_base_compute, bill.data_compute, bill.licences]).toEqual([9, 10, 0]);
    expect(bill.monthly_usd).toBe(550.0);
    // The CEO splitting 50/50 needs a licence.
    const split = stationsOf({ fifty_fifty: 1 });
    expect(computeBill(split, 0.0).licences).toBe(1);
  });

  it("compute_scales_with_stations_and_storage", () => {
    expect(extraBaseCompute(45)).toBe(9);
    expect(extraBaseCompute(46)).toBe(10);
    expect(extraBaseCompute(15)).toBe(9);
    expect(extraBaseCompute(75), "0.2 x 75 is exactly 15 (D209)").toBe(15);
    expect(extraBaseCompute(1_000_000)).toBe(200_000);
    expect(dataCompute(0.0)).toBe(10);
    expect(dataCompute(833.0), "ceil(9.996)").toBe(10);
    expect(dataCompute(834.0), "ceil(10.008)").toBe(11);
    expect(dataCompute(100_000.0)).toBe(1_200);
  });
});
