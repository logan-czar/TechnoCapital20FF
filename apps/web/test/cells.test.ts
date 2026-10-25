// Table formats and sorting, ported from crates/game/src/table/format.rs's tests (and the
// sort_order rule in table/mod.rs).

import type { Figure } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import {
  type Cell,
  cellNumber,
  cellTone,
  cmpCell,
  display,
  figureCell,
  int,
  money,
  percent,
  sortOrder,
} from "../src/widgets/cells.ts";

const band = (low: number, high: number, unit: "money" | "percent" = "money"): Cell => ({
  k: "band",
  unit,
  low,
  high,
});

describe("formats", () => {
  it("scales money to T, B, M and K with three significant digits", () => {
    expect(money(1.35e12)).toBe("$1.35T");
    expect(money(38e9)).toBe("$38.0B");
    expect(money(123.4e6)).toBe("$123M");
    expect(money(45_600)).toBe("$45.6K");
    expect(money(950)).toBe("$950");
    expect(money(-2.5e6)).toBe("-$2.50M");
    expect(money(0)).toBe("$0");
    expect(money(Number.NaN)).toBe("?");
  });

  it("formats percents and counts", () => {
    expect(percent(0.123)).toBe("12.3%");
    expect(percent(-0.05)).toBe("-5.0%");
    expect(int(1_234_567)).toBe("1,234,567");
    expect(int(-1000)).toBe("-1,000");
    expect(int(999)).toBe("999");
    expect(display({ k: "unknown" })).toBe("?");
  });

  it("formats prices, dates, ratings, ratios, numbers and gains", () => {
    expect(display({ k: "price", v: 45.234 })).toBe("$45.23");
    expect(display({ k: "price", v: 1234.5 })).toBe("$1,234.50");
    expect(display({ k: "price", v: 0.005 })).toBe("$0.01");
    expect(display({ k: "price", v: -0.001 })).toBe("$0.00");
    expect(display({ k: "date", v: { year: 2020, month: 1, day: 3 } })).toBe("03 Jan 2020");
    expect(display({ k: "date", v: { year: 2031, month: 12, day: 25 } })).toBe("25 Dec 2031");
    expect(display({ k: "rating", v: "BbbMinus" })).toBe("BBB-");
    expect(display({ k: "rating", v: "AaPlus" })).toBe("AA+");
    expect(display({ k: "rating", v: "Aaa" })).toBe("AAA");
    expect(display({ k: "ratio", v: 1.234 })).toBe("1.23x");
    expect(display({ k: "gain", v: 0.012, unit: "percent" })).toBe("+1.2%");
    expect(display({ k: "gain", v: -0.45, unit: "price" })).toBe("-$0.45");
    expect(display({ k: "gain", v: 1.2e6, unit: "money" })).toBe("+$1.20M");
    expect(display({ k: "gain", v: 0, unit: "percent" })).toBe("0.0%");
    expect(display({ k: "gain", v: 0.0001, unit: "price" })).toBe("$0.00");
    expect(display({ k: "number", v: 1234.56 })).toBe("1,234.6");
    expect(display({ k: "number", v: -0.04 })).toBe("0.0");
  });

  it("shows bands as their range, a hyphen unless one end is negative", () => {
    expect(display(band(12e6, 18e6))).toBe("$12.0M-$18.0M");
    expect(display(band(-5e6, 3e6))).toBe("-$5.00M to $3.00M");
  });

  it("colors gains, losses, links and bands", () => {
    expect(cellTone({ k: "gain", v: 1, unit: "percent" })).toBe("gain");
    expect(cellTone({ k: "gain", v: -1, unit: "percent" })).toBe("loss");
    expect(cellTone({ k: "gain", v: 0, unit: "percent" })).toBeNull();
    expect(cellTone({ k: "link", text: "x", page: { kind: "company", id: 1 } })).toBe("link");
    expect(cellTone({ k: "money", v: 1 })).toBeNull();
  });
});

describe("figures", () => {
  it("an exact figure is its plain cell; a band is a range that hides its estimate", () => {
    expect(figureCell({ kind: "Exact", value: 2.5e6 }, "money")).toEqual({ k: "money", v: 2.5e6 });
    expect(figureCell({ kind: "Exact", value: 12 }, "price")).toEqual({ k: "price", v: 12 });
    const f: Figure = { kind: "Band", band: { estimate: 0.13, low: 0.1, high: 0.15 } };
    const c = figureCell(f, "percent");
    expect(c).toEqual(band(0.1, 0.15, "percent"));
    expect(display(c)).toBe("10.0%-15.0%");
    expect(display(c)).not.toContain("13");
    expect(cellNumber(c)).toBe(0.125);
  });
});

describe("sorting", () => {
  it("orders cells by what they show", () => {
    expect(cmpCell(band(10, 30), band(12, 18))).toBe(1);
    expect(cmpCell(band(10, 30), band(5, 40))).toBe(-1);
    expect(
      cmpCell(
        { k: "date", v: { year: 2020, month: 2, day: 1 } },
        { k: "date", v: { year: 2020, month: 1, day: 31 } },
      ),
    ).toBe(1);
    expect(cmpCell({ k: "rating", v: "Aaa" }, { k: "rating", v: "Bb" })).toBe(-1);
    const link = (s: string): Cell => ({ k: "link", text: s, page: { kind: "company", id: 0 } });
    expect(cmpCell(link("b"), link("a"))).toBe(1);
    expect(cmpCell(link("b"), { k: "text", v: "c" })).toBe(-1);
    expect(cmpCell({ k: "gain", v: -1, unit: "price" }, { k: "gain", v: 0.5, unit: "price" })).toBe(-1);
    expect(cmpCell({ k: "int", v: 2 }, { k: "int", v: 10 })).toBe(-1);
  });

  it("puts unknown cells last in both directions and keeps ties in row order", () => {
    const cells: Cell[] = [
      { k: "int", v: 3 },
      { k: "unknown" },
      { k: "int", v: 1 },
      { k: "int", v: 3 },
      { k: "unknown" },
      { k: "int", v: 2 },
    ];
    expect(sortOrder(cells, true)).toEqual([2, 5, 0, 3, 1, 4]);
    expect(sortOrder(cells, false)).toEqual([0, 3, 5, 2, 1, 4]);
  });

  it("sorts 10,000 rows quickly", () => {
    const cells: Cell[] = Array.from({ length: 10_000 }, (_, i) =>
      i % 97 === 0 ? { k: "unknown" } : { k: "money", v: ((i * 7919) % 10_007) * 1e3 },
    );
    const t = performance.now();
    const order = sortOrder(cells, false);
    expect(performance.now() - t).toBeLessThan(500);
    expect(order).toHaveLength(10_000);
  });
});
