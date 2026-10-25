import { describe, expect, it } from "vitest";
import { advanceCycle, zAvg } from "../../src/economy/cycle.ts";
import { scriptedDraws } from "../../src/rng.ts";
import type { GlobalCycle } from "../../src/types/world.ts";
import { globalCycleGLagged } from "../../src/world/economy.ts";

describe("economy/cycle", () => {
  it("phases follow the table", () => {
    const s = scriptedDraws();
    s.push("Cycle", [0.5, 3.0, 0.0, 2.0]);
    const c: GlobalCycle = {
      phase: "Expansion",
      quarters_left: 2,
      g_t: 0.01,
      g_history: [0.01, 0.01, 0.01],
      z_avg: 1.0,
    };
    advanceCycle(c, s);
    expect([c.phase, c.quarters_left]).toEqual(["Expansion", 1]);
    advanceCycle(c, s);
    expect([c.phase, c.quarters_left]).toEqual(["Overheating", 3]);
    expect(Math.abs(c.g_t - 0.03)).toBeLessThan(1e-15);
    expect(c.g_history).toEqual([c.g_t, 0.01, 0.01]);
    expect(globalCycleGLagged(c, 1)).toBe(0.01);
    for (let i = 0; i < 3; i++) advanceCycle(c, s);
    expect([c.phase, c.quarters_left]).toEqual(["Contraction", 2]);
    expect(c.g_t).toBe(-0.06);
  });

  it("z is gdp weighted", () => {
    expect(
      zAvg([
        [1.0, 1.0],
        [3.0, 2.0],
      ]),
    ).toBe(1.75);
    expect(zAvg([])).toBe(0.0);
  });
});
