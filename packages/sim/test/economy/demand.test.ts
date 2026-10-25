import { describe, expect, it } from "vitest";
import { effectiveDemand, monthFactor, trendMonthFactor } from "../../src/economy/demand.ts";

describe("economy/demand", () => {
  it("three months make the quarter", () => {
    const f = monthFactor(0.03);
    expect(Math.abs(f * f * f - 1.03)).toBeLessThan(1e-15);
    const t = trendMonthFactor(0.05);
    expect(Math.abs(t ** 12 - 1.05)).toBeLessThan(1e-14);
  });

  it("rate term is zero at neutral", () => {
    expect(effectiveDemand(100.0, 1.0, 0.03, 0.03)).toBe(100.0);
    expect(Math.abs(effectiveDemand(100.0, 2.0, 0.05, 0.03) - 96.0)).toBeLessThan(1e-12);
  });
});
