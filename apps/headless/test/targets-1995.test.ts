// The calibration targets of a historical world's run (1995-rework 4.3).
import { describe, expect, it } from "vitest";
import { evaluateEra } from "../src/targets-1995.ts";

const HEADER = "seed,year,gdp_usd,companies";

function run(seed: number, first: number, last: number, gdpAtEnd: number): string[] {
  const rows: string[] = [];
  for (let y = first; y <= last; y++) rows.push(`${seed},${y},${y === last ? gdpAtEnd : 1e12},300`);
  return rows;
}

describe("the 1995 world's targets", () => {
  it("marks a full run inside its scenario's GDP band", () => {
    const text = [HEADER, ...run(1, 1995, 2019, 85e12)].join("\n");
    expect(evaluateEra(text, "stable").map((r) => [r.target, r.met])).toEqual([
      ["full_run", true],
      ["gdp_2020_usd", true],
    ]);
  });

  it("marks a run outside the band, per seed and per scenario", () => {
    const text = [HEADER, ...run(1, 1995, 2019, 85e12), ...run(2, 1995, 2019, 52e12)].join("\n");
    const stagnation = evaluateEra(text, "stagnation").filter((r) => r.target === "gdp_2020_usd");
    expect(stagnation.map((r) => [r.seed, r.met])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("marks a short run", () => {
    const text = [HEADER, ...run(1, 1995, 2000, 85e12)].join("\n");
    expect(evaluateEra(text, "stable")[0]?.met).toBe(false);
  });

  it("has no GDP band under Random, since the seeds play different scenarios", () => {
    const text = [HEADER, ...run(1, 1995, 2019, 85e12)].join("\n");
    expect(evaluateEra(text, "random").map((r) => r.target)).toEqual(["full_run"]);
  });
});
