import { describe, expect, it } from "vitest";
import { cycleK, phaseLabel, quarterlyGrowth } from "../../src/economy/growth.ts";

describe("economy/growth", () => {
  it("k matches the spec examples", () => {
    // Spec 5.1: an industry at 4% feels the cycle one for one; Oil at 0% gets 0.8 up and
    // 1.1 down; at LT 100% k is 2.5 up and 0.25 down (5.1.1).
    expect(cycleK(0.04, 0.01)).toBe(1.0);
    expect(Math.abs(cycleK(0.0, 0.01) - 0.8)).toBeLessThan(1e-12);
    expect(Math.abs(cycleK(0.0, -0.01) - 1.1)).toBeLessThan(1e-12);
    expect(cycleK(1.0, 0.01)).toBe(2.5);
    expect(cycleK(1.0, -0.01)).toBe(0.25);
  });

  it("labels first match", () => {
    expect(phaseLabel(-0.05, 1.3, "Normal", null)).toBe("Bust");
    expect(phaseLabel(0.06, 1.16, "Normal", null)).toBe("Glut");
    expect(phaseLabel(0.06, 1.12, "Glut", null)).toBe("Glut");
    expect(phaseLabel(0.06, 1.12, "Normal", null)).toBe("Boom");
    expect(phaseLabel(0.0, 1.09, "Glut", null)).toBe("Normal");
    expect(phaseLabel(0.049, 1.0, "Normal", null)).toBe("Normal");
    expect(phaseLabel(-0.2, 1.0, "Normal", "Boom")).toBe("Boom");
  });

  it("floor holds", () => {
    expect(quarterlyGrowth(0.0, -0.5, 1.0, 0.01, 1.0, -0.06, -3.0)).toBe(-0.25);
  });
});
