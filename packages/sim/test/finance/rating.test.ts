// Port of the in-file tests of crates/sim/src/finance/rating.rs.
import { describe, expect, it } from "vitest";
import { ratingLabel, ratingParse, ratingShifted } from "../../src/finance/rating.ts";
import { RATING_VALUES } from "../../src/types/state/finance.ts";

describe("finance/rating", () => {
  it("labels round trip", () => {
    for (const r of RATING_VALUES) {
      expect(ratingParse(ratingLabel(r))).toBe(r);
    }
    expect(ratingParse("C")).toBeNull();
  });

  it("shifting clamps", () => {
    expect(ratingShifted("Aaa", 1)).toBe("Aaa");
    expect(ratingShifted("Cc", -1)).toBe("Cc");
    expect(ratingShifted("Bbb", 1)).toBe("BbbPlus");
  });
});
