// Port of crates/sim/tests/spec_5_9.rs: spec 5.9 data: create, convert, decay, 12-month retention
// and free R&D with a 1-month grace (build-plan M3.6). Held data settles where C = rate x held.
// Pure formulas, no RNG.
//
// Expects (DataBook methods take the book first and mutate it, as Rust &mut self does):
//   ../../src/ops/data.ts  CONVERT_TB_PER_STATION, type DataParams { tb_per_musd, decay_base },
//                          conversionCapacity(stations), decayRate(held_tb, base),
//                          freeRdStep(held_tb), steadyStateHeld(capacity, base),
//                          dataBookMonth(book, revenue_usd, params, capacity) -> DataMonth
//                          { created_tb, converted_tb, decayed_tb, dropped_tb, free_rd_pct },
//                          dataBookAtLoad(revenue, params, capacity, share),
//                          dataBookUnstructuredTb(book), dataBookFreeRdFraction(book)
import { describe, expect, it } from "vitest";
import {
  CONVERT_TB_PER_STATION,
  conversionCapacity,
  type DataParams,
  dataBookAtLoad,
  dataBookFreeRdFraction,
  dataBookMonth,
  dataBookUnstructuredTb,
  decayRate,
  freeRdStep,
  steadyStateHeld,
} from "../src/ops/data.ts";
import { emptyDataBook, stationsOf } from "./common/defaults.ts";

const DEFAULT: DataParams = { tb_per_musd: 1.0, decay_base: 0.02 };

describe("spec 5.9 data", () => {
  it("free_rd_steps", () => {
    // Under 1 TB 0%; 1 TB 1%; 10 TB 2%; 100 TB 3%; 1 PB 4%; 10 PB 5%; +1% per further 10x.
    const table: [number, number][] = [
      [0.0, 0],
      [0.99, 0],
      [1.0, 1],
      [8.6, 1],
      [9.999, 1],
      [10.0, 2],
      [20.0, 2],
      [100.0, 3],
      [1_000.0, 4],
      [10_000.0, 5],
      [100_000.0, 6],
    ];
    for (const [held, pct] of table) {
      expect(freeRdStep(held), `${held} TB`).toBe(pct);
    }
  });

  it("decay_rate_grows_with_log_held", () => {
    expect(decayRate(0.5, 0.02)).toBe(0.02);
    expect(decayRate(1.0, 0.02)).toBe(0.02);
    expect(Math.abs(decayRate(10.0, 0.02) - 0.04) < 1e-15).toBe(true);
    expect(Math.abs(decayRate(100.0, 0.01) - 0.03) < 1e-15, "finance and health base 1%").toBe(true);
  });

  it("conversion_capacity_counts_half_of_fifty_fifty", () => {
    const s = stationsOf({ enterprise: 2, fifty_fifty: 1 });
    expect(Math.abs(conversionCapacity(s) - 2.5 * CONVERT_TB_PER_STATION) < 1e-15).toBe(true);
  });

  it("create_convert_oldest_first_then_decay", () => {
    const d = emptyDataBook({ unstructured: [0.5, 2.0] });
    // 3M of revenue makes 3 TB; capacity 1 TB converts the oldest 0.5 then 0.5 of the next.
    const m = dataBookMonth(d, 3.0e6, DEFAULT, 1.0);
    expect(m.created_tb).toBe(3.0);
    expect(m.converted_tb).toBe(1.0);
    expect(d.unstructured).toEqual([0.0, 1.5, 3.0]);
    // Held 1.0 decays at base x (1 + log10 1) = 2%.
    expect(Math.abs(d.held - 0.98) < 1e-15).toBe(true);
    expect(Math.abs(m.decayed_tb - 0.02) < 1e-15).toBe(true);
  });

  it("unstructured_data_is_kept_twelve_months", () => {
    const d = emptyDataBook();
    for (let i = 0; i < 12; i++) {
      const m = dataBookMonth(d, 1.0e6, DEFAULT, 0.0);
      expect(m.dropped_tb).toBe(0.0);
    }
    expect(d.unstructured.length).toBe(12);
    // The 13th month drops the bucket made 12 months ago, after it had this month chance to
    // convert (D210).
    const m = dataBookMonth(d, 1.0e6, DEFAULT, 0.0);
    expect(m.dropped_tb).toBe(1.0);
    expect(d.unstructured.length).toBe(12);
    expect(dataBookUnstructuredTb(d)).toBe(12.0);
    const e = structuredClone(d);
    const m2 = dataBookMonth(e, 1.0e6, DEFAULT, 0.4);
    expect(Math.abs(m2.converted_tb - 0.4) < 1e-15).toBe(true);
    expect(Math.abs(m2.dropped_tb - 0.6) < 1e-15, "the oldest converted 0.4 before it went").toBe(true);
  });

  it("free_rd_drop_waits_one_month", () => {
    const d = emptyDataBook({ held: 12.0, free_rd_pct: 2 });
    // Held 12 TB with no conversion decays about 4% a month: 11.5, 11.1, ... under 10 by month 5.
    const pcts: number[] = [];
    const helds: number[] = [];
    for (let i = 0; i < 8; i++) {
      helds.push(d.held);
      pcts.push(dataBookMonth(d, 0.0, DEFAULT, 0.0).free_rd_pct);
    }
    const firstBelow = helds.findIndex((h) => h < 10.0);
    expect(firstBelow).toBeGreaterThanOrEqual(0);
    pcts.forEach((p, i) => {
      const want = i <= firstBelow ? 2 : 1;
      expect(p, `month ${i}: held at start ${helds[i]}`).toBe(want);
    });
    // A rise applies at once and clears the grace.
    const up = emptyDataBook({ held: 10.5, free_rd_pct: 1, grace: true });
    expect(dataBookMonth(up, 0.0, DEFAULT, 0.0).free_rd_pct).toBe(2);
    expect(up.grace).toBe(false);
    // A dip that recovers inside the grace month never drops.
    const dip = emptyDataBook({ held: 9.9, free_rd_pct: 2 });
    expect(dataBookMonth(dip, 0.0, DEFAULT, 1.0).free_rd_pct, "grace month").toBe(2);
    dip.held = 10.2;
    expect(dataBookMonth(dip, 0.0, DEFAULT, 0.0).free_rd_pct).toBe(2);
    expect(dip.grace).toBe(false);
  });

  it("steady_state_solves_c_equals_rate_times_held", () => {
    const cases: [number, number][] = [
      [1.0 / 3.0, 0.02],
      [0.9125, 0.02],
      [5.0, 0.01],
      [0.01, 0.02],
    ];
    for (const [c, base] of cases) {
      const h = steadyStateHeld(c, base);
      expect(Math.abs(decayRate(h, base) * h - c) < 1e-9, `C ${c}: held ${h}`).toBe(true);
    }
    expect(steadyStateHeld(0.0, 0.02)).toBe(0.0);
    // Arrowhead (7.1): converting 0.1 x 40 / 12 TB a month holds about 8.6 TB (1% free R&D);
    // its station at capacity (0.9125 TB) holds about 20 TB (2%).
    const a = steadyStateHeld((0.1 * 40.0) / 12.0, 0.02);
    expect(Math.abs(a - 8.6) < 0.05, String(a)).toBe(true);
    expect(freeRdStep(a)).toBe(1);
    const full = steadyStateHeld(CONVERT_TB_PER_STATION, 0.02);
    expect(Math.abs(full - 20.0) < 0.5, String(full)).toBe(true);
    expect(freeRdStep(full)).toBe(2);
  });

  it("held_data_settles_where_c_equals_rate_times_held", () => {
    // Arrowhead one station converting at capacity, from its 8.6 TB start: revenue 40M a year is
    // 3.33 TB a month, more than the 0.9125 TB capacity, so C = 0.9125.
    const c = CONVERT_TB_PER_STATION;
    const d = dataBookAtLoad(40.0e6, DEFAULT, c, 0.1);
    expect(Math.abs(d.held - 8.6) < 0.05).toBe(true);
    let lastPeak = 0.0;
    for (let i = 0; i < 600; i++) {
      const start = d.held;
      const m = dataBookMonth(d, 40.0e6 / 12.0, DEFAULT, c);
      expect(Math.abs(m.converted_tb - c) < 1e-12).toBe(true);
      lastPeak = start + m.converted_tb;
    }
    // The held level after conversion (before decay) solves C = rate x held (D210)...
    expect(Math.abs(decayRate(lastPeak, 0.02) * lastPeak - c) < 1e-9, `peak ${lastPeak}`).toBe(true);
    expect(Math.abs(lastPeak - steadyStateHeld(c, 0.02)) < 1e-6).toBe(true);
    // ...so the month decay equals the month conversion and held stops moving.
    const before = d.held;
    const m = dataBookMonth(d, 40.0e6 / 12.0, DEFAULT, c);
    expect(Math.abs(m.decayed_tb - m.converted_tb) < 1e-9).toBe(true);
    expect(Math.abs(d.held - before) < 1e-9).toBe(true);
    expect(m.free_rd_pct, "about 20 TB").toBe(2);
    // From far above it comes down to the same level.
    const high = emptyDataBook({ held: 500.0 });
    for (let i = 0; i < 600; i++) {
      dataBookMonth(high, 40.0e6 / 12.0, DEFAULT, c);
    }
    expect(Math.abs(high.held - d.held) < 1e-6).toBe(true);
  });

  it("arrowhead_starting_data", () => {
    // 7.1: one month of unstructured data in the newest bucket; held at the steady state for
    // min(capacity, 0.1 x inflow); free R&D 1%.
    const d = dataBookAtLoad(40.0e6, DEFAULT, CONVERT_TB_PER_STATION, 0.1);
    expect(d.unstructured.length).toBe(1);
    expect(Math.abs((d.unstructured[0] ?? 0) - 40.0 / 12.0) < 1e-12).toBe(true);
    expect(Math.abs(d.held - 8.6) < 0.05).toBe(true);
    expect(d.free_rd_pct).toBe(1);
    expect(dataBookFreeRdFraction(d)).toBe(0.01);
  });
});
