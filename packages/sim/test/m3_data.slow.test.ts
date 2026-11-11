// Port of crates/sim/tests/m3_data.rs: M3.6 against the live engine: data created, converted,
// decayed and retained at 4.3 step 8, and free R&D (spec 5.9, 7.1). Expected values are worked
// from the spec, written out here.
//
// Spec M3.6 done: held data settles where `C = rate x held`. Arrowhead's one enterprise station
// converts at capacity (0.9125 TB a month, less than its 3.3 TB inflow), so its held data rises
// from about 8.6 TB toward about 20 TB, 2% free R&D (7.1).
//
// Expects:
//   ../src/lib.ts   simNew, simWorld;  ./common/ops.ts  company, runTo
//
// Changed from the Rust: Sim::new(data, 13) uses the new generator (D951). The data step reads
// revenue, stations and the books, not draws, so the one-month test is unchanged. The ten-year
// Arrowhead run goes through the Lite AI and the plan locks, which draw from the seeded streams
// (births, events); the assertions are the steady-state ones (rising, one enterprise station,
// about 20 TB, 2% free R&D, 12 buckets), which the Rust passed with a different draw sequence and
// which describe the spec rather than a draw. If a different sequence ever cuts Arrowhead's
// station, the comment in the Rust applies: check the decade it holds. The println is dropped.
import { describe, expect, it } from "vitest";
import { simNew, simWorld } from "../src/lib.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import { data, unwrap } from "./common/index.ts";
import { company, runTo } from "./common/ops.ts";

/** Spec 5.9 step 4: `rate = base x (1 + log10(held))` for held >= 1, else base. */
function specRate(held: number, base: number): number {
  return held >= 1.0 ? base * (1.0 + Math.log10(held)) : base;
}

/** Spec 5.9 step 1: `1 + floor(log10(held))` percent for held >= 1 TB, else 0. */
function specFreeRd(held: number): number {
  return held < 1.0 ? 0 : 1 + Math.floor(Math.log10(held));
}

const sum = (v: number[]): number => v.reduce((a, b) => a + b, 0);

describe("m3 data", () => {
  it("one_data_month_on_every_company", () => {
    const sim = unwrap(simNew(data(), 13), "Sim::new");
    const before = structuredClone(simWorld(sim));
    runTo(sim, simDateYmd(2020, 2, 1));
    const w = simWorld(sim);
    // The 651 (companies born at the 9 January lock have no load month to compare with).
    for (let id = 0; id < before.companies.length; id++) {
      const c = w.companies[id] as (typeof w.companies)[number];
      const b = ((before.companies[id] as (typeof w.companies)[number]).data[0] as (typeof c.data)[number])
        .book;
      const book = (c.data[0] as (typeof c.data)[number]).book;
      const p = (w.industries[c.industry] as (typeof w.industries)[number]).params;
      const u = w.units[c.units[0] as number] as (typeof w.units)[number];
      // 2. Create: revenue_month ($M) x data_tb_per_musd into this month's bucket.
      const created = (u.revenue_m / 1e6) * p.data_tb_per_musd;
      // 3. Convert up to (enterprise + 0.5 x 50/50) x 0.9125 TB, oldest first.
      const s = c.stations;
      const capacity = (s.enterprise + 0.5 * s.fifty_fifty) * 0.9125;
      const unstructured = sum(b.unstructured) + created;
      const converted = Math.min(capacity, unstructured);
      // 4. Decay at the rate of held after conversion.
      const held = b.held + converted;
      const want = held - held * specRate(held, p.data_decay_base);
      expect(Math.abs(book.held - want) <= 1e-9 * Math.max(want, 1.0), c.key).toBe(true);
      expect(Math.abs(sum(book.unstructured) - (unstructured - converted)) < 1e-9, c.key).toBe(true);
      expect(book.unstructured.length, "the load month and this one").toBe(2);
      // 1. Free R&D for this month from held at its start.
      expect(book.free_rd_pct, c.key).toBe(specFreeRd(b.held));
    }
  });

  it("arrowhead_held_data_settles_where_conversion_equals_decay", () => {
    const sim = unwrap(simNew(data(), 13), "Sim::new");
    const w0 = simWorld(sim);
    const a = company(w0, "CO-0001");
    const a0 = w0.companies[a] as (typeof w0.companies)[number];
    const book0 = (a0.data[0] as (typeof a0.data)[number]).book;
    // 7.1: about 8.6 TB at start, 1% free R&D, one month of unstructured (40 x 1 / 12 TB).
    expect(Math.abs(book0.held - 8.6) < 0.05, `${book0.held}`).toBe(true);
    expect(book0.free_rd_pct).toBe(1);
    expect(book0.unstructured.length).toBe(1);
    expect(Math.abs((book0.unstructured[0] as number) - 40.0 / 12.0) < 1e-9).toBe(true);

    // Ten years: the Lite AI keeps one enterprise station at a 25% coverage while revenue holds
    // (6.4); later plans may cut it (the idle floor, a sell-down), so the steady state is
    // checked on the decade it holds.
    const heldByYear: number[] = [];
    for (let year = 2021; year <= 2030; year++) {
      runTo(sim, simDateYmd(year, 1, 1));
      const c = simWorld(sim).companies[a] as (typeof w0.companies)[number];
      heldByYear.push((c.data[0] as (typeof c.data)[number]).book.held);
    }
    const w = simWorld(sim);
    const c = w.companies[a] as (typeof w.companies)[number];
    const book = (c.data[0] as (typeof c.data)[number]).book;
    const base = (w.industries[c.industry] as (typeof w.industries)[number]).params.data_decay_base;
    // C = 0.9125 TB a month (one station at capacity). The steady state holds for held after
    // conversion and before decay (D210): end-of-month held + C.
    const cTb = 0.9125;
    const h = book.held + cTb;
    for (let i = 1; i < heldByYear.length; i++) {
      expect((heldByYear[i] as number) >= (heldByYear[i - 1] as number), "rises").toBe(true);
    }
    expect(c.stations.enterprise).toBe(1);
    // The 5.9 steady state for C, solved here by bisection: held approaches it from below.
    let lo = 1.0;
    let hi = 100.0;
    for (let i = 0; i < 200; i++) {
      const mid = 0.5 * (lo + hi);
      if (specRate(mid, base) * mid < cTb) lo = mid;
      else hi = mid;
    }
    expect(h <= lo + 1e-9 && lo - h < 0.2, `held + C ${h} vs the steady state ${lo}`).toBe(true);
    expect(Math.abs(h - 20.0) < 1.0, `about 20 TB: ${h}`).toBe(true);
    expect(book.free_rd_pct).toBe(2);
    // 12-month retention (5.9 step 5): at most 12 buckets, the oldest a year old.
    expect(book.unstructured.length).toBe(12);
  });
});
