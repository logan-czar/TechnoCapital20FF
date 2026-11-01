// The calibration targets of a historical world's run (1995-rework 4.3).
import { describe, expect, it } from "vitest";
import { evaluateEra, maxDrawdown } from "../src/targets-1995.ts";

const HEADER = "seed,year,gdp_usd,companies,base_rate,recessions_started,zone_gdp_usd";

/** A run from $30T to `gdpAtEnd`, with one zone gaining a share of 0.1 and one recession. */
function run(seed: number, first: number, last: number, gdpAtEnd: number): string[] {
  const rows: string[] = [];
  for (let y = first; y <= last; y++) {
    const t = (y - first) / Math.max(last - first, 1);
    const gdp = 30e12 + (gdpAtEnd - 30e12) * t;
    const rate = y === last ? 0.03 : 0.05;
    const zones = `${gdp * (0.5 + 0.1 * t)};${gdp * (0.5 - 0.1 * t)}`;
    rows.push(`${seed},${y},${gdp},${300 + 8 * (y - first)},${rate},${y === first + 5 ? 1 : 0},${zones}`);
  }
  return rows;
}

const verdicts = (text: string, scenario: string) =>
  Object.fromEntries(evaluateEra(text, scenario).map((r) => [r.target, r.met]));

describe("the 1995 world's targets", () => {
  it("marks a full run inside its scenario's bands", () => {
    const text = [HEADER, ...run(1, 1995, 2019, 85e12)].join("\n");
    expect(verdicts(text, "stable")).toEqual({
      full_run: true,
      gdp_2020_usd: true,
      max_drawdown: true,
      end_rate: true,
      entries: true,
      recessions: true,
      top_zone_gain: true,
    });
  });

  it("marks a run outside a band, per seed and per scenario", () => {
    const text = [HEADER, ...run(1, 1995, 2019, 85e12), ...run(2, 1995, 2019, 52e12)].join("\n");
    const stagnation = evaluateEra(text, "stagnation").filter((r) => r.target === "gdp_2020_usd");
    expect(stagnation.map((r) => [r.seed, r.met])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("marks a short run", () => {
    const text = [HEADER, ...run(1, 1995, 2000, 85e12)].join("\n");
    expect(verdicts(text, "stable").full_run).toBe(false);
  });

  it("marks stable growth that falls too far and unstable growth that does not", () => {
    const smooth = [HEADER, ...run(1, 1995, 2019, 85e12)].join("\n");
    expect(verdicts(smooth, "unstable").max_drawdown).toBe(false);
  });

  it("has no bands under Random, since the seeds play different scenarios", () => {
    const text = [HEADER, ...run(1, 1995, 2019, 85e12)].join("\n");
    expect(evaluateEra(text, "random").map((r) => r.target)).toEqual(["full_run"]);
  });

  it("measures a drawdown from the peak before it", () => {
    expect(maxDrawdown([1, 2, 1.5, 3, 2.7])).toBeCloseTo(0.25);
    expect(maxDrawdown([1, 2, 3])).toBe(0);
  });
});
