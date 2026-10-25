// Port of the in-file tests of crates/sim/src/ai/archetype.rs.
import { describe, expect, it } from "vitest";
import {
  ARCHETYPE_TABLE,
  archetypeAtLoad,
  archetypePayoutMult,
  rdPlanAtLoad,
  traitRdMult,
} from "../../src/ai/archetype.ts";
import { ARCHETYPE_VALUES } from "../../src/types/state/ai.ts";

describe("ai/archetype", () => {
  it("arrowhead is a greedy cash cow", () => {
    // Spec 7.1: Terry is Greedy, so a Cash cow with an R&D target of 0.05 x 0.7 x 0.8.
    const a = archetypeAtLoad("majority", 40.0e6, "Energy", ["Greedy"]);
    expect(a).toBe("CashCow");
    const plan = rdPlanAtLoad(0.05, a, ["Greedy"], 0.01);
    expect(Math.abs(plan - 0.018) < 1e-12).toBe(true);
    expect(archetypePayoutMult(a)).toBe(1.3);
  });

  it("the table is in enum order", () => {
    ARCHETYPE_TABLE.forEach((row, i) => {
      expect(ARCHETYPE_VALUES.indexOf(row.archetype)).toBe(i);
    });
  });

  it("rows match in table order", () => {
    expect(archetypeAtLoad("state", 1.0, "Tech", ["Brave"])).toBe("StateChampion");
    expect(archetypeAtLoad("majority", 10.0e6, "Tech", ["Greedy"])).toBe("Startup");
    expect(archetypeAtLoad("majority", 1.0e9, "Tech", ["Cautious", "Ambitious"])).toBe("AggressiveGrower");
    expect(archetypeAtLoad("widely_held", 1.0e9, "Energy", [])).toBe("Incumbent");
    expect(traitRdMult(["Visionary", "Diligent"])).toBe(1.25 * 1.1);
    expect(rdPlanAtLoad(0.05, "Incumbent", [], 0.07)).toBe(0.0);
  });
});
