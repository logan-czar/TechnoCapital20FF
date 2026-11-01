import { describe, expect, it } from "vitest";
import { crc32, openPrice, priceJitter, sharesFor, sizedRevenue } from "../../src/births/startup.ts";

describe("births startup", () => {
  it("crc32 matches the IEEE check value", () => {
    expect(crc32("123456789")).toBe(0xcbf43926);
    expect(priceJitter("CO-0001")).toBeGreaterThanOrEqual(0.9);
    expect(priceJitter("CO-0001")).toBeLessThanOrEqual(1.1);
  });
  it("sizing and open price clamp", () => {
    expect(sizedRevenue(5e8, 1e9)).toBe(2e7);
    expect(sizedRevenue(5e8, 1e7)).toBeNull();
    expect(openPrice(0, "CO-0001")).toBe(5);
    expect(openPrice(1e15, "CO-0001")).toBe(200);
    expect(sharesFor(1, 100)).toBe(1);
  });
});
