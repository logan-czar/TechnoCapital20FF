import { describe, expect, it } from "vitest";
import {
  COMPANIES_HEADER,
  clean,
  concentration,
  INDUSTRIES_HEADER,
  inYear,
  quantile,
  ratingLabel,
  sci,
  WORLD_HEADER,
  ZONES_HEADER,
} from "../src/detail.ts";
import { Profiler, TickCosts, tickKind } from "../src/profile.ts";

describe("detail helpers", () => {
  it("concentration and quantiles", () => {
    const [t1, t4, t10, hhi] = concentration([6, 3, 1]);
    expect(Math.abs(t1 - 0.6)).toBeLessThan(1e-12);
    expect(Math.abs(t4 - 1)).toBeLessThan(1e-12);
    expect(t10).toBe(t4);
    expect(Math.abs(hhi - 0.46)).toBeLessThan(1e-12);
    expect(concentration([])).toEqual([0, 0, 0, 0]);
    expect(quantile([1, 2, 3], 0.5)).toBe(2);
    expect(quantile([], 0.5)).toBe(0);
    for (const h of [INDUSTRIES_HEADER, COMPANIES_HEADER, WORLD_HEADER, ZONES_HEADER]) {
      expect(h.split(",").every((c) => c !== "" && !c.includes(" "))).toBe(true);
    }
  });

  it("formats like Rust", () => {
    expect(sci(1234567.89)).toBe("1.234568e6");
    expect(sci(0)).toBe("0.000000e0");
    expect(sci(0.00012)).toBe("1.200000e-4");
    expect(clean('a, "b"')).toBe("a   b ");
    expect(ratingLabel("Aaa")).toBe("AAA");
    expect(ratingLabel("AaPlus")).toBe("AA+");
    expect(ratingLabel("BbbMinus")).toBe("BBB-");
    expect(ratingLabel("Cc")).toBe("CC");
  });

  it("a year's events include the 1 January close that ends it", () => {
    expect(inYear({ year: 2025, month: 3, day: 4 }, 2025)).toBe(true);
    expect(inYear({ year: 2026, month: 1, day: 1 }, 2025)).toBe(true);
    expect(inYear({ year: 2026, month: 1, day: 2 }, 2025)).toBe(false);
    expect(inYear(null, 2025)).toBe(false);
  });
});

describe("profile tables", () => {
  it("lists the parts slowest first and the tick costs by kind", () => {
    const p = new Profiler();
    p.started({ kind: "Slot", slot: "Daily" });
    p.finished({ kind: "Slot", slot: "Daily" });
    p.addStep(5);
    const t = p.table();
    expect(t).toMatch(/^part +seconds +share +calls +us per call\n/);
    expect(t).toContain("all steps");
    expect(t).toContain("slowest 15 jobs");

    const c = new TickCosts();
    c.add(5, 1);
    c.add(48, 3);
    expect(tickKind(5)).toBe(0);
    expect(tickKind(48)).toBe(1);
    const table = c.table();
    expect(table).toContain("hourly");
    expect(table).toContain("daily");
    expect(table).not.toContain("release");
  });
});
