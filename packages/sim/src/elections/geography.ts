// Where a race is voted (pivot 5.4, 6.7; D1040): its counties and county shares. A House race reads
// its district from lane G's plan in force (`geoPlanOf`); a statewide race and the presidency read
// whole counties. The House seats per state are lane G's `GeoState.seats` once set, else the
// data's apportionment (`PoliticsState.states`).
//
// While a state with more than one seat has no plan of the right size (lane G has not drawn one
// yet), its districts are cut here by `fallbackPlan`: counties swept along the state's longer axis
// and cut into equal populations, the cut county split into `CountyShare` intervals. It is never
// stored; lane G's plan replaces it as soon as one is in force.

import { geoPlanOf } from "../geo/index.ts";
import { type CountyId, ordinal, type UsStateId } from "../types/ids.ts";
import { totalCmp } from "../types/num.ts";
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
 * The units of House district `number` of `state` (pivot 5.4): lane G's plan when it is in force
 * with `seats` districts, the whole state for one seat, else `fallbackPlan`.
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
  if (plan !== undefined && plan.districts.length === seats) {
    return plan.districts[number - 1]?.shares ?? [];
  }
  return fallbackPlan(world.geo.counties, counties, seats)[number - 1] ?? [];
}

/**
 * Equal-population districts with no lane G plan (D1040), by recursive bisection: the counties
 * (or their shares) are sorted along the region's longer axis by centroid (ties to the lower id,
 * then the earlier interval) and cut where the first `floor(seats / 2)` districts' people end; each
 * side is cut again until one district is left. A county a cut falls in is split into consecutive
 * intervals of its people order, so the shares of a county cover it once. Compact, so a district
 * keeps the political geography of its region. Each district's shares are in county id order.
 */
export function fallbackPlan(
  all: readonly County[],
  counties: readonly CountyId[],
  seats: number,
): CountyShare[][] {
  const out: CountyShare[][] = [];
  bisect(all, wholeUnits(counties), seats, out);
  for (const d of out) d.sort((a, b) => a.county - b.county || a.from - b.from);
  return out;
}

function bisect(all: readonly County[], pieces: CountyShare[], seats: number, out: CountyShare[][]): void {
  if (seats <= 1) {
    out.push(pieces);
    return;
  }
  const at = (s: CountyShare): County => all[s.county] as County;
  const span = (k: 0 | 1): number => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const s of pieces) {
      lo = Math.min(lo, at(s).centroid[k]);
      hi = Math.max(hi, at(s).centroid[k]);
    }
    return hi - lo;
  };
  const axis: 0 | 1 = span(0) >= span(1) ? 0 : 1;
  const order = pieces
    .slice()
    .sort(
      (a, b) =>
        totalCmp(at(a).centroid[axis], at(b).centroid[axis]) || a.county - b.county || a.from - b.from,
    );
  const first = Math.floor(seats / 2);
  const total = order.reduce((n, s) => n + shareSize(at(s), s), 0);
  const target = (total * first) / seats;
  const left: CountyShare[] = [];
  const right: CountyShare[] = [];
  let acc = 0;
  for (const s of order) {
    const size = shareSize(at(s), s);
    if (acc >= target) right.push(s);
    else if (acc + size <= target || size <= 0) {
      left.push(s);
      acc += size;
    } else {
      const cut = s.from + (target - acc) / at(s).population;
      left.push({ county: s.county, from: s.from, to: cut });
      right.push({ county: s.county, from: cut, to: s.to });
      acc = target;
    }
  }
  bisect(all, left, first, out);
  bisect(all, right, seats - first, out);
}
/** A share's people (pivot 5.4): `(to âˆ’ from) Ã— population`. */
export function shareSize(c: County, s: CountyShare): number {
  return (s.to - s.from) * c.population;
}

/** A share's mean lean (pivot 5.4): `lean + spread Ã— (1 âˆ’ from âˆ’ to)`. */
export function shareLean(c: County, s: CountyShare): number {
  return c.lean + c.spread * (1 - s.from - s.to);
}
