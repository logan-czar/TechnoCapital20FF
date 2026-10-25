import { describe, expect, it } from "vitest";
import { effectiveSpreadBps } from "../../src/economy/zones.ts";

describe("economy/zones", () => {
  it("spread widens in downturns and clamps", () => {
    expect(effectiveSpreadBps(100.0, 0.0)).toBe(100.0);
    expect(effectiveSpreadBps(100.0, -1.0)).toBe(200.0);
    expect(effectiveSpreadBps(100.0, 1.0)).toBe(50.0);
    expect(effectiveSpreadBps(0.0, -0.05)).toBe(0.0);
  });
});
