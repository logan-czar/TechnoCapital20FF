// The one spec 5.19.1 test that needs the whole World (`worldFromData`): it waits for the market's
// Stock::at_load (and people's trait names) to be wired into the load deps. Moved out of
// spec_5_19_1.test.ts so the rest of that file runs.
import { worldDataAllProvinces } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { developmentAboveFloor } from "../../src/births/weights.ts";
import { worldFromData } from "../../src/world/load.ts";
import { data, unwrap } from "./common/index.ts";

describe("spec 5.19.1 HQ weight on the loaded world", () => {
  // D830 (Logan, 2026-10-24): the startup HQ weight counts development above the floor, so a
  // province at 1/1/1 draws no HQ; a country with every province at the floor keeps the 2.3.1
  // weight (none in the starting world).
  it("hq_weight_counts_development_above_the_floor", () => {
    expect(developmentAboveFloor(1, 1, 1)).toBe(0);
    expect(developmentAboveFloor(9, 15, 16)).toBe(37);
    expect(developmentAboveFloor(0, 2, 1)).toBe(1);
    const w = unwrap(worldFromData(data()), "World::from_data");
    const sites = w.births.sites;
    expect(sites.hq_fallback_countries.length).toBe(0);
    const floor = worldDataAllProvinces(data()).filter(
      ([, , p]) => p.commerce + p.industry + p.population === 3,
    ).length;
    const zero = sites.hq_weight.filter((x) => x === 0.0).length;
    expect(zero).toBe(floor);
    expect(floor, `the split giants' new parts sit at the floor (${floor})`).toBeGreaterThan(700);
    sites.hq_weight.forEach((h, i) => {
      expect(h <= (sites.weight[i] as number), `province ${i}`).toBe(true);
    });
  });
});
