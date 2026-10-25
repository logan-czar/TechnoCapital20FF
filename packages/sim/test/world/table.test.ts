import { describe, expect, it } from "vitest";
import type { CompanyId } from "../../src/types/ids.ts";
import {
  tableGet,
  tableIds,
  tableIsEmpty,
  tableIter,
  tableLen,
  tableNew,
  tablePush,
  tableRows,
} from "../../src/world/table.ts";

describe("world/table.ts", () => {
  it("ids are positions", () => {
    const t = tableNew<CompanyId, string>();
    expect(tableIsEmpty(t)).toBe(true);
    expect(tablePush(t, "a")).toBe(0);
    expect(tablePush(t, "b")).toBe(1);
    expect(t[1 as CompanyId]).toBe("b");
    expect(tableIter(t)).toEqual([
      [0, "a"],
      [1, "b"],
    ]);
    expect(tableIds(t)).toEqual([0, 1]);
    expect(tableLen(t)).toBe(2);
    expect(tableRows(t)).toEqual(["a", "b"]);
    expect(tableGet(t, 2 as CompanyId)).toBeNull();
    expect(tableGet(t, 0 as CompanyId)).toBe("a");
  });
});
