// v_districts and v_usmap_layers (pivot 5.4, 5.11, 15.3; D1039) on the 1995 world: a row per
// district with its ref id, a column per county, and the hidden lean and strength only for the
// Omniscient eye.

import { describe, expect, it } from "vitest";
import { simNew, simViews, simWorld } from "../../src/lib.ts";
import { controlsDefault } from "../../src/time/control.ts";
import { districtRefId } from "../../src/types/views/districts.ts";
import { buildDistricts } from "../../src/views/districts.ts";
import type { ViewInput } from "../../src/views/index.ts";
import { buildUsMapLayers } from "../../src/views/usmap_layers.ts";
import { data1995, unwrap } from "../common/index.ts";

describe("the geo views (pivot 5.4, 15.3)", () => {
  const sim = unwrap(simNew(data1995(), 1), "1995 world");
  const w = simWorld(sim);
  const input = (omniscient: boolean): ViewInput =>
    ({
      world: w,
      controls: { ...controlsDefault(), omniscient },
      seed: 1,
      map: undefined,
    }) as unknown as ViewInput;

  it("lists every district with its ref id, hiding its lean and its plan's strength", () => {
    const v = simViews(sim).districts.data;
    expect(v.districts.length).toBe(435);
    expect(v.plans.length).toBe(w.geo.plans.length);
    for (const d of v.districts) {
      expect(d.id).toBe(districtRefId(d.state, d.number));
      expect(d.lean).toBeNull();
    }
    expect(v.plans.every((p) => p.strength === null)).toBe(true);
    const all = buildDistricts(input(true));
    expect(all.districts.every((d) => typeof d.lean === "number")).toBe(true);
    expect(all.plans.every((p) => p.strength === 0)).toBe(true);
  });

  it("gives a column per county, each county's district, and the states' seats and electors", () => {
    const v = simViews(sim).usmap_layers.data;
    const n = w.geo.counties.length;
    for (const col of [v.counties.fips, v.counties.population, v.counties.district, v.counties.turnout]) {
      expect(col.length).toBe(n);
    }
    expect(v.counties.lean).toBeNull();
    // Every county with a plan names a district of its state.
    v.counties.district.forEach((d, i) => {
      const seats = w.geo.seats[v.counties.state[i] as number] ?? 0;
      if (seats > 0) expect(d >= 1 && d <= seats).toBe(true);
    });
    expect(v.states.reduce((a, s) => a + s.house_seats, 0)).toBe(435);
    expect(v.states.reduce((a, s) => a + s.electoral_votes, 0)).toBe(538);
    expect(v.states.reduce((a, s) => a + s.population, 0)).toBe(
      w.geo.counties.reduce((a, c) => a + c.population, 0),
    );
    expect(buildUsMapLayers(input(true)).counties.lean?.length).toBe(n);
  });
});
