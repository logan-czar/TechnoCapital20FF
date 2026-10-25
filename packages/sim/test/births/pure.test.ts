import { describe, expect, it } from "vitest";
import { compose, ticker, tickerCandidates } from "../../src/births/names.ts";
import { developmentAboveFloor, fringeFactor, heat, weightedPick } from "../../src/births/weights.ts";

describe("births pure files", () => {
  it("composes names and tickers like gen.py", () => {
    expect(compose("Nova", "Systems")).toBe("Nova Systems");
    expect(compose("Dupont", "Maison")).toBe("Maison Dupont");
    expect(tickerCandidates("Nova Systems")).toEqual(["NOSY", "NOVS", "NOVA", "NOV"]);
    expect(ticker("Nova Systems", (t) => t === "NOSY")).toBe("NOVS");
  });
  it("weights", () => {
    expect(fringeFactor(0)).toBe(0.5);
    expect(heat(0)).toBe(0);
    expect(developmentAboveFloor(1, 1, 1)).toBe(0);
    expect(weightedPick([0, 0], { uniform: () => 0.5 } as never)).toBeNull();
  });
});
