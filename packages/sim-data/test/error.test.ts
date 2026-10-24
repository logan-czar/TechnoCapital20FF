import { describe, expect, it } from "vitest";
import { dataErrorField, dataErrorFile, dataErrorToString } from "../src/error.ts";

describe("DataError", () => {
  it("display names file, line and field", () => {
    const e = dataErrorField("countries.csv", 7, "gdp_usd_bn", "invalid float literal");
    expect(dataErrorToString(e)).toBe("countries.csv:7: field `gdp_usd_bn`: invalid float literal");
    expect(dataErrorToString(dataErrorFile("ai-boom.csv", "missing"))).toBe("ai-boom.csv: missing");
  });
});
