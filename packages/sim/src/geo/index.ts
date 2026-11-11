// Lane G's module (pivot 5.1 to 5.6; D1037): county drift, the census and apportionment, districts
// of whole counties and `CountyShare` intervals, redistricting by the governor's party with
// strength s, and court challenges. The algorithm notes are tools/spikes/districts/README.md.
// Every draw comes from the Governing stream (pivot-lanes.md "RNG streams").
//
// The contracts change wrote the seams only: `registerGeoJobs` (jobs.ts calls it, in the
// `DailyGeo` slot), `geoStart` (lib.ts `START_DEPS` calls it after the POC's start) and
// `geoDistrict` (lanes E and C read districts through it). Their signatures are contracts.

import type { Scheduler } from "../time/scheduler.ts";
import type { DrawSource } from "../types/draws.ts";
import type { UsStateId } from "../types/ids.ts";
import type { District, DistrictPlan, GeoState } from "../types/state/geo.ts";
import type { World } from "../types/world.ts";

export { geoStateEmpty, geoStateFromData, geoStateOf } from "./load.ts";

/**
 * Lane G's jobs (pivot 3.3: counties, the census and redistricting run at both fidelities, so no
 * tag). Registered in the `DailyGeo` slot by jobs.ts; empty until lane G adds them here.
 */
export function registerGeoJobs(_s: Scheduler): void {}

/**
 * The map at a world's start (pivot 5.3, 5.4), after the POC's `politicsStart`: nothing until lane
 * G sets the seats and draws the first plans. Governing stream only.
 */
export function geoStart(_world: World, _draws: DrawSource): void {}

/** The plan in force for `state`, or undefined (a state with one seat or none, or no plans yet). */
export function geoPlanOf(geo: GeoState, state: UsStateId): DistrictPlan | undefined {
  return geo.plans.find((p) => p.state === state);
}

/** District `number` (1 up) of `state` in the plan in force, or undefined. */
export function geoDistrict(geo: GeoState, state: UsStateId, number: number): District | undefined {
  return geoPlanOf(geo, state)?.districts[number - 1];
}
