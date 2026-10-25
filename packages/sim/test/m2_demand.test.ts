// Port of crates/sim/tests/m2_demand.rs: M2.5: monthly demand, trend demand and the rate term
// (spec 5.1). Done when demand follows the draws to 1e-9.
//
// Expects:
//   ../src/economy/demand.ts  monthFactor(q_growth), trendMonthFactor(lt)
//   ./common/economy.ts          economyScheduler, monthStarts, rel, runMonth, worldAtLoad
//   ./common/rng.ts             newRng
//
// Changed from the Rust: RngStreams::new(2024) is the new generator (D951). The test follows
// whatever the draws were (it reads each quarter's q_growth and lt back from the world), so every
// assertion is unchanged.
import { describe, expect, it } from "vitest";
import { monthFactor, trendMonthFactor } from "../src/economy/demand.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import { economyScheduler, monthStarts, rel, runMonth, worldAtLoad } from "./common/economy.ts";
import { data } from "./common/index.ts";
import { newRng } from "./common/rng.ts";

describe("m2 demand", () => {
  it("demand_follows_the_draws_month_by_month", () => {
    const d = data();
    const rng = newRng(2024);
    const w = worldAtLoad(d, rng);
    const s = economyScheduler();
    const n = w.industries.length;
    // Demand starts at the 2020 world size (7.3).
    for (const ind of w.industries) {
      expect(ind.demand_core).toBe(ind.world_size_2020_usd);
      expect(ind.trend_demand).toBe(ind.world_size_2020_usd);
      expect(ind.demand).toBe(ind.world_size_2020_usd);
    }
    // The quarter's growth and lt in force for each month as it is closed (D100).
    const quarter: [number, number][] = w.industries.map((i) => [i.q_growth, i.lt]);
    const wantCore = w.industries.map((i) => i.demand_core);
    const wantTrend = wantCore.slice();
    for (const date of monthStarts(simDateYmd(2020, 2, 1), simDateYmd(2030, 1, 1))) {
      // The job closes the month before `date`, whose quarter's rates are `quarter`.
      for (let i = 0; i < n; i++) {
        const [g, lt] = quarter[i] as [number, number];
        wantCore[i] = (wantCore[i] as number) * monthFactor(g);
        wantTrend[i] = (wantTrend[i] as number) * trendMonthFactor(lt);
      }
      if (date.year === 2025 && date.month === 6 && date.day === 1) {
        // The rate term (5.1): s x (base - neutral) comes off; none at neutral.
        w.base_rate = 0.05;
      }
      runMonth(s, w, rng, date);
      w.industries.forEach((ind, i) => {
        expect(
          rel(ind.demand_core, wantCore[i] as number) < 1e-9,
          `${ind.key} ${date.year}-${date.month}`,
        ).toBe(true);
        expect(
          rel(ind.trend_demand, wantTrend[i] as number) < 1e-9,
          `${ind.key} ${date.year}-${date.month}`,
        ).toBe(true);
        const term = 1.0 - ind.params.rate_sensitivity * (w.base_rate - w.neutral_rate);
        expect(rel(ind.demand, ind.demand_core * term) < 1e-12).toBe(true);
        if (date.month % 3 === 1) {
          // A new quarter was drawn: the old one is now prev, and the new one's months close from
          // the next job on.
          expect([ind.prev_q_growth, ind.prev_lt]).toEqual(quarter[i]);
          quarter[i] = [ind.q_growth, ind.lt];
        }
      });
    }
    // Demand moves only with the draws: the trend line is smooth, the core is not.
    const ind = w.industries[0];
    expect(ind?.demand_core).not.toBe(ind?.trend_demand);
  });
});
