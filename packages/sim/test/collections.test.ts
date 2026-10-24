import { describe, expect, it } from "vitest";
import { row, sortedEntries, sortedKeys, tableFromRows, tablePush } from "../src/types/collections.ts";
import type { CompanyId } from "../src/types/ids.ts";

describe("collections.ts", () => {
  it("tables are arrays in id order", () => {
    const t = tableFromRows<CompanyId, string>(["CO-0001"]);
    const id = tablePush(t, "CO-0002");
    expect(id).toBe(1);
    expect(row(t, id)).toBe("CO-0002");
    expect(() => row(t, 5 as CompanyId)).toThrow();
  });

  it("BTreeMap ports iterate in key order, not insertion order", () => {
    const m = new Map<number, string>([
      [3, "c"],
      [1, "a"],
      [2, "b"],
    ]);
    expect(sortedEntries(m).map(([k]) => k)).toEqual([1, 2, 3]);
    expect(sortedKeys(new Set(["b", "a"]))).toEqual(["a", "b"]);
  });
});
