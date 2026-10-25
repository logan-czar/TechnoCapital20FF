import { describe, expect, it } from "vitest";
import {
  addCount,
  assertCount,
  clamp,
  cmpStr,
  divEuclid,
  divInt,
  maxF,
  minF,
  powi,
  remEuclid,
  roundHalfAway,
  roundTiesEven,
  saturatingSubCount,
  subCount,
  toI64Sat,
  totalCmp,
  toU32Sat,
  toU64Sat,
} from "../src/types/num.ts";

// The values Rust gives for the same calls (f64::round, round_ties_even, `as` casts, total_cmp).
describe("num.ts keeps Rust semantics (D952)", () => {
  it("rounds halves away from zero like f64::round", () => {
    expect([2.5, -2.5, 0.5, -0.5, 1.4999, -1.5, 3].map(roundHalfAway)).toEqual([3, -3, 1, -1, 1, -2, 3]);
    expect(Object.is(roundHalfAway(-0.4), -0)).toBe(true);
  });

  it("rounds ties to even like round_ties_even and Python round", () => {
    expect([0.5, 1.5, 2.5, 3.5, -0.5, -1.5, -2.5, 2.4, 2.6].map(roundTiesEven)).toEqual([
      0, 2, 2, 4, -0, -2, -2, 2, 3,
    ]);
  });

  it("casts like `as u64`, `as u32` and `as i64`", () => {
    expect([-1, 0, 1.9, Number.NaN, 1e300].map(toU64Sat)).toEqual([0, 0, 1, 0, Number.MAX_SAFE_INTEGER]);
    expect([-3, 4.99, 2 ** 40].map(toU32Sat)).toEqual([0, 4, 0xffff_ffff]);
    expect([-2.7, 2.7, Number.NaN].map(toI64Sat)).toEqual([-2, 2, 0]);
  });

  it("keeps counts exact or throws", () => {
    expect(assertCount(1_806_975_376)).toBe(1_806_975_376);
    expect(() => assertCount(1.5)).toThrow();
    expect(() => assertCount(2 ** 53)).toThrow();
    expect(addCount(2, 3)).toBe(5);
    expect(() => subCount(2, 3)).toThrow();
    expect(saturatingSubCount(2, 3)).toBe(0);
    expect(divInt(-7, 2)).toBe(-3);
    expect(() => divInt(1, 0)).toThrow();
  });

  it("divides like div_euclid and rem_euclid", () => {
    // Rust: 7.div_euclid(4) = 1, (-7).div_euclid(4) = -2, 7.div_euclid(-4) = -1,
    // (-7).div_euclid(-4) = 2; rem_euclid 3, 1, 3, 1.
    const cases: [number, number][] = [
      [7, 4],
      [-7, 4],
      [7, -4],
      [-7, -4],
      [8, 4],
      [-8, 4],
      [-1, 400],
      [-1, -4],
    ];
    expect(cases.map(([a, b]) => divEuclid(a, b))).toEqual([1, -2, -1, 2, 2, -2, -1, 1]);
    expect(cases.map(([a, b]) => remEuclid(a, b))).toEqual([3, 1, 3, 1, 0, 0, 399, 3]);
    expect(Object.is(divEuclid(1, -4), 0)).toBe(true);
    expect(Object.is(remEuclid(-8, 4), 0)).toBe(true);
    expect(() => divEuclid(1, 0)).toThrow();
    expect(() => remEuclid(1, 0)).toThrow();
  });

  it("sorts floats like total_cmp and strings by code unit", () => {
    expect([3, Number.NaN, -0, 0, -1].sort(totalCmp)).toEqual([-1, -0, 0, 3, Number.NaN]);
    expect(["b", "B", "a", "CO-0010", "CO-0002"].sort(cmpStr)).toEqual(["B", "CO-0002", "CO-0010", "a", "b"]);
  });

  it("max, min and clamp like f64::max, f64::min and f64::clamp", () => {
    expect(maxF(Number.NaN, 2)).toBe(2);
    expect(minF(3, Number.NaN)).toBe(3);
    expect(maxF(1, 2)).toBe(2);
    expect(Object.is(clamp(-0, 0, 1), -0)).toBe(true);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(Number.isNaN(clamp(Number.NaN, 0, 1))).toBe(true);
    expect(() => clamp(0, 1, 0)).toThrow();
  });
});

describe("powi", () => {
  it("is repeated squaring like f64::powi", () => {
    expect(powi(2, 10)).toBe(1024);
    expect(powi(1.5, 0)).toBe(1);
    expect(powi(2, -2)).toBe(0.25);
    expect(powi(1.05, 4)).toBe(1.05 * 1.05 * (1.05 * 1.05));
    expect(powi(-3, 3)).toBe(-27);
    expect(powi(-2, -3)).toBe(-0.125);
  });
  it("handles NaN, infinities and zero like f64::powi", () => {
    expect(powi(Number.NaN, 0)).toBe(1);
    expect(Number.isNaN(powi(Number.NaN, 2))).toBe(true);
    expect(powi(Number.POSITIVE_INFINITY, 2)).toBe(Number.POSITIVE_INFINITY);
    expect(powi(Number.NEGATIVE_INFINITY, 3)).toBe(Number.NEGATIVE_INFINITY);
    expect(powi(Number.NEGATIVE_INFINITY, 2)).toBe(Number.POSITIVE_INFINITY);
    expect(powi(Number.POSITIVE_INFINITY, -1)).toBe(0);
    expect(powi(0, -2)).toBe(Number.POSITIVE_INFINITY);
    expect(powi(-0, -1)).toBe(Number.NEGATIVE_INFINITY);
    expect(powi(-0, -2)).toBe(Number.POSITIVE_INFINITY);
    expect(Object.is(powi(-0, 3), -0)).toBe(true);
    expect(Object.is(powi(-0, 2), 0)).toBe(true);
  });
  it("rejects a non-integer exponent", () => {
    expect(() => powi(2, Number.NaN)).toThrow(RangeError);
    expect(() => powi(2, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => powi(2, 0.5)).toThrow(RangeError);
  });
});
