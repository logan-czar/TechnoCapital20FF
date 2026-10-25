import { describe, expect, it } from "vitest";
import { roman } from "../../src/people/names.ts";

describe("people/names", () => {
  it("roman numerals", () => {
    expect(roman(2)).toBe("II");
    expect(roman(4)).toBe("IV");
    expect(roman(14)).toBe("XIV");
  });
});
