// Where a race is voted (pivot 5.4, 6.7; D1040): its counties and county shares. A House race reads
// its district from lane G's plan in force (`geoPlanOf`); a statewide race and the presidency read
// whole counties. The House seats per state are lane G's `GeoState.seats` once set, else the
// data's apportionment (`PoliticsState.states`). Every state with seats has a plan from the start
// (lane G's `geoStart`; D1052), so there is no fallback districting.

import { geoPlanOf } from "../geo/index.ts";
import { type CountyId, ordinal, type UsStateId } from "../types/ids.ts";
import type { County, CountyShare } from "../types/state/geo.ts";
import type { World } from "../types/world.ts";

/** Senators per state: the "+ 2" of a state's electors (pivot 6.7). */
export const SENATORS_PER_STATE = 2;
/** DC's electors (the 23rd Amendment: as the least populous state, 3), for a place with counties but no House seat or senators. */
export const DC_ELECTORS = 3;

/** The counties of each state, in id order, by `UsStateId`. */
export function countiesByState(world: World): CountyId[][] {
  const out: CountyId[][] = world.politics.states.map(() => []);
  world.geo.counties.forEach((c, i) => {
    out[c.state]?.push(ordinal<CountyId>(i));
  });
  return out;
}

/** A state's House seats now (pivot 5.3): lane G's `GeoState.seats` once set, else the data's. */
export function houseSeats(world: World, state: UsStateId): number {
  const geo = world.geo.seats;
  if (geo.length > 0) return geo[state] ?? 0;
  return world.politics.states[state]?.house_seats ?? 0;
}

/**
 * A state's electors (pivot 6.7): House seats plus its two senators; a place with counties and no
 * seat or senators (DC) has `DC_ELECTORS`; a place with no counties none.
 */
export function electors(world: World, state: UsStateId, counties: readonly CountyId[]): number {
  if (counties.length === 0) return 0;
  const seats = houseSeats(world, state);
  const senators = (world.politics.states[state]?.senate_classes.length ?? 0) > 0 ? SENATORS_PER_STATE : 0;
  if (seats === 0 && senators === 0) return DC_ELECTORS;
  return seats + SENATORS_PER_STATE;
}

/** A state's counties held whole: a statewide race's units. */
export function wholeUnits(counties: readonly CountyId[]): CountyShare[] {
  return counties.map((county) => ({ county, from: 0, to: 1 }));
}

/**
 * The units of House district `number` of `state` (pivot 5.4): lane G's plan in force, the whole
 * state for one seat. A world with counties has a plan per state from its start (`geoStart`), and the
 * seats take force with the plans (`redrawAll`), so a plan of another size is a broken world: it
 * throws (D1052; lane E's `fallbackPlan` for a world without plans is gone).
 */
export function districtUnits(
  world: World,
  state: UsStateId,
  number: number,
  seats: number,
  counties: readonly CountyId[],
): CountyShare[] {
  if (seats <= 1) return wholeUnits(counties);
  const plan = geoPlanOf(world.geo, state);
  if (plan === undefined || plan.districts.length !== seats) {
    throw new Error(`districtUnits: state ${state} has no plan of ${seats} districts`);
  }
  return plan.districts[number - 1]?.shares ?? [];
}

/** A share's people (pivot 5.4): `(to - from) * population`. */
export function shareSize(c: County, s: CountyShare): number {
  return (s.to - s.from) * c.population;
}

/** A share's mean lean (pivot 5.4): `lean + spread * (1 - from - to)`. */
export function shareLean(c: County, s: CountyShare): number {
  return c.lean + c.spread * (1 - s.from - s.to);
}
