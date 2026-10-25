import { describe, expect, it } from "vitest";
import { monthFactor } from "../../src/economy/demand.ts";
import {
  fringeAfterMonth,
  fringeAssetsAtLoad,
  M_MAX,
  M_MIN,
  marketFactor,
} from "../../src/economy/supply.ts";

describe("economy/supply", () => {
  it("market factor examples", () => {
    // Spec 5.2: S 1.21 gives M 0.91; S 0.81 gives M 1.11.
    expect(Math.abs(marketFactor(1.21) - 1.0 / 1.1)).toBeLessThan(1e-12);
    expect(Math.abs(marketFactor(0.81) - 1.0 / 0.9)).toBeLessThan(1e-12);
    expect(marketFactor(1.0)).toBe(1.0);
    expect(marketFactor(4.0)).toBe(M_MIN);
    expect(marketFactor(0.25)).toBe(M_MAX);
  });

  it("fringe keeps its share", () => {
    let fringe = 60.0;
    let demand = 100.0;
    for (const q of [0.02, -0.03, 0.05]) {
      fringe = fringeAfterMonth(fringe, q);
      demand *= monthFactor(q);
    }
    expect(Math.abs(fringe / demand - 0.6)).toBeLessThan(1e-15);
    expect(fringeAssetsAtLoad(100.0, 120.0, 1.0)).toBe(0.0);
  });
});
