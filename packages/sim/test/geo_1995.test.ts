// The 1995 world's counties in `World.geo` (pivot 5.1, 5.4; D1028): the 3,142 counties of the frozen
// vintage load in FIPS order with their neighbours resolved, and every state's counties are one
// piece, which districting (pivot 5.4) needs. The data is lane S1's (tools/world-1995/counties).
// Not a Rust test.

import { describe, expect, it } from "vitest";
import { simNew, simWorld } from "../src/lib.ts";
import type { CountyId } from "../src/types/ids.ts";
import type { County } from "../src/types/state/geo.ts";
import { data1995, unwrap } from "./common/index.ts";

/** pivot 5.1: the frozen vintage. */
const COUNTY_COUNT = 3142;
/** The 1990 census: the residents of the 50 states and DC. */
const US_POP_1990 = 248_709_873;

describe("1995 world: counties", () => {
  const data = data1995();
  const w = simWorld(unwrap(simNew(data, 1), "1995 world"));
  const counties = w.geo.counties;
  const at = (id: CountyId): County => counties[id] as County;
  const byFips = new Map(counties.map((c, i) => [c.fips, i as CountyId] as const));

  it("loads 3,142 counties in FIPS order", () => {
    expect(counties.length).toBe(COUNTY_COUNT);
    const fips = counties.map((c) => c.fips);
    expect(fips).toEqual([...new Set(fips)].sort());
    // The start's plans are lane G's (test/geo/districts.test.ts, D1039).
    expect(counties.reduce((n, c) => n + c.population, 0)).toBe(US_POP_1990);
  });

  it("resolves every neighbour, both ways, sorted, never itself", () => {
    let links = 0;
    counties.forEach((c, i) => {
      expect(c.neighbours, c.fips).toEqual([...new Set(c.neighbours)].sort((a, b) => a - b));
      for (const n of c.neighbours) {
        expect(n !== i && n >= 0 && n < counties.length, c.fips).toBe(true);
        expect(at(n).neighbours.includes(i as CountyId), `${c.fips}-${at(n).fips}`).toBe(true);
      }
      links += c.neighbours.length;
    });
    expect(links).toBe(data.county_adjacency.rows.length);
    // No county stands alone: an island county has its ferry or bridge edge.
    expect(counties.filter((c) => c.neighbours.length === 0).map((c) => c.fips)).toEqual([]);
    const honolulu = at(byFips.get("15003") as CountyId);
    expect(honolulu.neighbours.map((n) => at(n).fips)).toEqual(["15007", "15009"]);
  });

  it("gives every state counties that are one piece and average to the state's lean", () => {
    w.politics.states.forEach((state, s) => {
      const mine = counties.flatMap((c, i) => (c.state === s ? [i as CountyId] : []));
      expect(mine.length, state.name).toBeGreaterThan(0);
      const inState = new Set(mine);
      const reached = new Set<CountyId>([mine[0] as CountyId]);
      const queue = [mine[0] as CountyId];
      for (let q = 0; q < queue.length; q++) {
        for (const n of at(queue[q] as CountyId).neighbours) {
          if (inState.has(n) && !reached.has(n)) {
            reached.add(n);
            queue.push(n);
          }
        }
      }
      expect(reached.size, state.name).toBe(mine.length);
      const people = mine.reduce((n, i) => n + at(i).population, 0);
      const mean = mine.reduce((n, i) => n + at(i).population * at(i).lean, 0) / people;
      expect(Math.abs(mean - state.lean_pts), state.name).toBeLessThan(0.01);
    });
  });

  it("keeps each county's lean and spread inside 100 points, and a centroid on the map's plane", () => {
    for (const c of counties) {
      expect(Math.abs(c.lean) + c.spread, c.fips).toBeLessThanOrEqual(100);
      expect(c.spread, c.fips).toBeGreaterThanOrEqual(0);
      expect(c.turnout > 0 && c.turnout < 1 && c.elasticity > 0, c.fips).toBe(true);
      expect(
        c.centroid[0] >= 0 && c.centroid[0] <= 975 && c.centroid[1] >= 0 && c.centroid[1] <= 610,
        c.fips,
      ).toBe(true);
    }
  });
});
