// v_races and v_returns (pivot 6.2, 9, 8.6; D1040) from a counted cycle: titles, the candidate
// order, hidden strength, the presidency by state, and the county slice.

import { beforeAll, describe, expect, it } from "vitest";
import { simDateYmd } from "../../src/time/calendar.ts";
import type { RaceId } from "../../src/types/ids.ts";
import type { World } from "../../src/types/world.ts";
import type { ViewInput } from "../../src/views/index.ts";
import { buildRaces, racesBuilder } from "../../src/views/races.ts";
import { buildReturns, returnsBuilder, returnsCountySlice } from "../../src/views/returns.ts";
import { runDays, runDraws, start1995 } from "./harness.ts";

const input = (world: World, omniscient = false): ViewInput =>
  ({ world, controls: { omniscient }, seed: 1, map: null }) as unknown as ViewInput;

describe("v_races and v_returns", () => {
  let w: World;

  beforeAll(() => {
    w = start1995(5);
    runDays(w, runDraws(5), simDateYmd(1995, 1, 1), simDateYmd(1996, 11, 6));
  });

  it("list the open cycle's races with their titles and ballots, strength hidden", () => {
    const v = buildRaces(input(w));
    expect(v.cycle).toBe(1996);
    const titles = v.races.map((r) => r.title);
    expect(titles).toContain("President");
    expect(titles).toContain("California 12");
    expect(titles).toContain("Wyoming at-large");
    expect(titles).toContain("Texas Senate");
    expect(titles).toContain("Indiana Governor");
    const pres = v.races.find((r) => r.office === "President");
    expect(pres?.electoral_votes).toBe(270);
    expect(pres?.ballot).toHaveLength(2);
    expect(v.races.every((r) => r.candidates.every((c) => c.strength === null))).toBe(true);
    const omni = buildRaces(input(w, true));
    expect(omni.races.some((r) => r.candidates.some((c) => c.strength !== null))).toBe(true);
    // Counted but not certified: no winner yet.
    expect(pres?.status).toBe("Counting");
    expect(pres?.winner).toBeNull();
    expect(racesBuilder.build).not.toBeNull();
  });

  it("report the count in the ballot's order, the presidency state by state", () => {
    const v = buildReturns(input(w));
    expect(v.election).toEqual(simDateYmd(1996, 11, 5));
    expect(v.races.length).toBeGreaterThanOrEqual(480);
    const races = w.elections.races;
    for (const r of v.races) {
      const race = races[r.race];
      expect(r.votes.map((x) => x.person)).toEqual(race?.ballot);
      expect(r.votes.map((x) => x.votes)).toEqual(race?.result?.votes);
      expect(r.reporting).toBe(1);
    }
    const pres = v.races.find((r) => races[r.race]?.office === "President");
    expect(pres?.states).toHaveLength(51);
    expect(pres?.electoral_votes?.reduce((n, x) => n + x.votes, 0)).toBe(538);
    // Nothing moved: the last build comes back.
    expect(returnsBuilder.rebuildFrom?.(v, input(w))).toBe(v);
  });

  it("slice a race's counties in step, fully reported", () => {
    const race = w.elections.county_results[0]?.race as RaceId;
    const s = returnsCountySlice(input(w), { view: "returns", slice: "counties", race });
    expect(s).not.toBeNull();
    if (s === null || !("reporting" in s)) return;
    expect(s.votes).toHaveLength(s.counties.length);
    expect(s.reporting.every((x) => x === 1)).toBe(true);
    const total = s.votes.reduce((n, row) => n + row.reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(w.elections.races[race]?.result?.turnout);
    expect(
      returnsCountySlice(input(w), { view: "returns", slice: "counties", race: 999999 as RaceId }),
    ).toBeNull();
  });
});
