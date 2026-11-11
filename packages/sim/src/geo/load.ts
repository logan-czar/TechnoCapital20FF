// `World.geo` at load (pivot 5.1): the counties from counties.csv and county-adjacency.csv, in FIPS
// order, with no district plan. A world with no counties file has an empty table. Drift, the
// census and districting are M2's.

import type { WorldData } from "@tc20ff/sim-data";
import { type CountyId, ordinal, type UsStateId } from "../types/ids.ts";
import { cmpStr } from "../types/num.ts";
import type { County, GeoState } from "../types/state/geo.ts";
import type { LoadError, Result } from "../types/world.ts";

/** A world with no counties and no plans. */
export function geoStateEmpty(): GeoState {
  return { counties: [], plans: [] };
}

/**
 * The counties of `data` (pivot 5.1), sorted by FIPS code so ordinals are in id order (D4).
 * `stateNames` are `PoliticsState.states`' names in order: counties.csv `state` names one of them.
 */
export function geoStateFromData(
  data: WorldData,
  stateNames: readonly string[],
): Result<GeoState, LoadError> {
  const rows = [...data.counties.rows].sort((a, b) => cmpStr(a.fips, b.fips));
  const ids = new Map<string, CountyId>();
  for (const [i, r] of rows.entries()) {
    if (ids.has(r.fips)) return { ok: false, error: { kind: "Duplicate", table: "counties", key: r.fips } };
    ids.set(r.fips, ordinal<CountyId>(i));
  }
  const states = new Map(stateNames.map((name, i) => [name, ordinal<UsStateId>(i)]));
  const counties: County[] = [];
  for (const r of rows) {
    const state = states.get(r.state);
    if (state === undefined) {
      return {
        ok: false,
        error: {
          kind: "MissingRef",
          table: "counties",
          key: r.fips,
          field: "state",
          value: r.state,
          target: "US state",
        },
      };
    }
    counties.push({
      fips: r.fips,
      state,
      name: r.name,
      population: r.pop_1990,
      lean: r.lean_pts,
      spread: r.spread,
      elasticity: r.elasticity,
      turnout: r.turnout,
      centroid: [r.centroid_x, r.centroid_y],
      neighbours: [],
    });
  }
  for (const a of data.county_adjacency.rows) {
    const from = ids.get(a.fips);
    const to = ids.get(a.neighbour_fips);
    if (from === undefined || to === undefined) {
      return {
        ok: false,
        error: {
          kind: "MissingRef",
          table: "county-adjacency",
          key: `${a.fips}-${a.neighbour_fips}`,
          field: from === undefined ? "fips" : "neighbour_fips",
          value: from === undefined ? a.fips : a.neighbour_fips,
          target: "county",
        },
      };
    }
    const list = (counties[from] as County).neighbours;
    if (from !== to && !list.includes(to)) list.push(to);
  }
  for (const c of counties) c.neighbours.sort((x, y) => x - y);
  return { ok: true, value: { counties, plans: [] } };
}
