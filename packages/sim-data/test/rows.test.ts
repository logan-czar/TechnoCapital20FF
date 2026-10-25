import { describe, expect, it } from "vitest";
import { startupGroupParse } from "../src/rows.ts";

describe("StartupGroup", () => {
  it("parses count:industry@region|region", () => {
    const g = startupGroupParse("2:Semiconductors@east-asia-oceania|north-america");
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.value.count).toBe(2);
    expect(g.value.industry).toBe("Semiconductors");
    expect(g.value.regions).toEqual(["east-asia-oceania", "north-america"]);
    expect(startupGroupParse("2 AI labs").ok).toBe(false);
    expect(startupGroupParse("x:AI labs@any").ok).toBe(false);
  });
});
