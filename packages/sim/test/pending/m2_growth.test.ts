// Port of crates/sim/tests/m2_growth.rs: M2.3: the quarterly growth draw (lt_q, asymmetric k,
// phi, floor) and the phase labels (spec 5.1). Done when the noise-off results match the worked
// table of 5.1.
//
// Expects:
//   ../../src/economy/growth.ts  PHI, cycleK(lt, g), growthGap(q, lt), ltQ(lt),
//                                quarterlyGrowth(lt, carry, cycle_beta, volatility, z_avg, g, z)
//   ../../src/world/load.ts      worldFromData
//   ./common/economy.ts          economyScheduler, industry, runMonth, worldAtLoad
//   ./common/rng.ts              newNoNoise
//
// Changed from the Rust: none (NoNoise only, no seeded draws).
import { describe, expect, it } from "vitest";
import { cycleK, growthGap, ltQ, PHI, quarterlyGrowth } from "../../src/economy/growth.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import { worldFromData } from "../../src/world/load.ts";
import { economyScheduler, industry, runMonth, worldAtLoad } from "./common/economy.ts";
import { data, unwrap } from "./common/index.ts";
import { newNoNoise } from "./common/rng.ts";

/**
 * Settled yearly growth `LT + k x Z x g_t` (spec 5.1 worked table): the noise-off draw run with
 * g held until it settles, read back a year as LT plus four times the quarterly gap.
 */
function settledYearly(lt: number, zAvg: number, g: number): number {
  let q = ltQ(lt);
  for (let i = 0; i < 200; i++) {
    q = quarterlyGrowth(lt, q, 1.0, 0.01, zAvg, g, 0.0);
  }
  return lt + growthGap(q, lt);
}

const close = (a: number, b: number, tol: number): void => {
  expect(Math.abs(a - b) < tol, `${a} vs ${b}`).toBe(true);
};

describe("m2 growth", () => {
  it("noise_off_draws_match_the_worked_table", () => {
    const z = unwrap(worldFromData(data()), "World::from_data").cycle.z_avg;
    // Spec 5.1 worked table (Z 1.07): rows Expansion +1%, Overheating +3%, Contraction -4.5%,
    // Recovery -0.5%; columns Retail (LT 3%), Software (9%), an LT 30% grower. One decimal.
    const table: [number, number[]][] = [
      [0.01, [4.0, 10.3, 32.4]],
      [0.03, [6.0, 13.0, 37.3]],
      [-0.045, [-1.9, 4.8, 28.3]],
      [-0.005, [2.5, 8.5, 29.8]],
    ];
    const lts = [0.03, 0.09, 0.3];
    for (const [g, row] of table) {
      lts.forEach((lt, i) => {
        const got = 100.0 * settledYearly(lt, z, g);
        const want = row[i] as number;
        expect(Math.abs(got - want) < 0.06, `LT ${lt} g ${g}: ${got.toFixed(2)}% vs ${want}%`).toBe(true);
      });
    }
    // The k column heads: Retail 0.95 up and 1.025 down, Software 1.25 and 0.875, LT 30% 2.30
    // and 0.35.
    close(cycleK(0.03, 0.01), 0.95, 1e-12);
    close(cycleK(0.03, -0.01), 1.025, 1e-12);
    close(cycleK(0.09, 0.01), 1.25, 1e-12);
    close(cycleK(0.09, -0.01), 0.875, 1e-12);
    close(cycleK(0.3, 0.01), 2.3, 1e-12);
    close(cycleK(0.3, -0.01), 0.35, 1e-12);
  });

  it("a_lasting_phase_settles_half_75_and_88_percent", () => {
    // Spec 5.1: the (1 - phi) factor settles a lasting phase half way in the first quarter, 75%
    // in the second, 88% in the third.
    const [lt, z, g] = [0.05, 1.07, 0.03];
    const target = ltQ(lt) + (cycleK(lt, g) * z * g) / 4.0;
    let q = ltQ(lt);
    const shares: number[] = [];
    for (let i = 0; i < 3; i++) {
      q = quarterlyGrowth(lt, q, 1.0, 0.01, z, g, 0.0);
      shares.push((q - ltQ(lt)) / (target - ltQ(lt)));
    }
    shares.forEach((got, i) => {
      close(got, [0.5, 0.75, 0.875][i] as number, 1e-12);
    });
    expect(PHI).toBe(0.5);
    // lt_q compounds to LT, unlike LT/4: at the boom's 100% a year, 4 quarters make 100%.
    close((1.0 + ltQ(1.0)) ** 4, 2.0, 1e-12);
    // The floor: -25% a quarter.
    expect(quarterlyGrowth(-0.1, -0.6, 1.0, 0.01, 1.07, -0.06, -3.0)).toBe(-0.25);
  });

  it("noise_off_world_draw_and_labels", () => {
    // With no rolls the Q1 2020 draw is lt_q plus half the settled cycle push of g_t = the middle
    // of Expansion (1%), since prev_q_growth starts at lt_q (spec 5.1).
    const w = worldAtLoad(data(), newNoNoise());
    expect(w.cycle.g_t).toBe(0.01);
    for (const ind of w.industries) {
      const lt = ind.lt;
      const want = ltQ(lt) + (0.5 * cycleK(lt, 0.01) * w.cycle.z_avg * 0.01) / 4.0;
      expect(Math.abs(ind.q_growth - want) < 1e-15, ind.key).toBe(true);
      expect(ind.prev_q_growth, "at load prev_q_growth = lt_q").toBe(ltQ(lt));
      expect(ind.phase_label).toBe("Normal");
    }

    // Labels move monthly from q_growth and last month's S (4.3 step 2). Push Retail into a
    // Glut by inflating its fringe: S above 1.15 makes Glut from the next month's labels, and
    // it stays Glut until S falls under 1.10.
    const retail = industry(w, "retail");
    const r = () => w.industries[retail] as (typeof w.industries)[number];
    r().fringe_assets *= 2.0;
    const s = economyScheduler();
    const draws = newNoNoise();
    runMonth(s, w, draws, simDateYmd(2020, 2, 1));
    expect(r().supply_ratio > 1.15).toBe(true);
    expect(r().phase_label, "S was 1.0 last month").toBe("Normal");
    runMonth(s, w, draws, simDateYmd(2020, 3, 1));
    expect(r().phase_label).toBe("Glut");
    runMonth(s, w, draws, simDateYmd(2020, 4, 1));
    expect(r().phase_label).toBe("Glut");
    // A deep gap is Bust whatever S says (first match): plant a quarter growing 8 pp a year
    // under its long-term rate.
    const lt = r().lt;
    r().q_growth = ltQ(lt) - 0.02;
    runMonth(s, w, draws, simDateYmd(2020, 5, 1));
    expect(r().phase_label).toBe("Bust");
    // Back at the long-term rate, S is still above 1.15: Glut again.
    r().q_growth = ltQ(lt);
    runMonth(s, w, draws, simDateYmd(2020, 6, 1));
    expect(r().phase_label).toBe("Glut");
  });
});
