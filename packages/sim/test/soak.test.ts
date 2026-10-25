// Ported from the tests in crates/sim/src/soak.rs.

import { describe, expect, it } from "vitest";
import { median } from "../src/soak.ts";

describe("soak", () => {
  it("median of odd and even counts", () => {
    expect(median([])).toBe(0.0);
    expect(median([3.0])).toBe(3.0);
    expect(median([1.0, 2.0, 9.0])).toBe(2.0);
    expect(median([1.0, 2.0, 4.0, 9.0])).toBe(3.0);
  });
});
