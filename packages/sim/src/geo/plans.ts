// From `GeoState` to the drawer and back (pivot 5.3, 5.4): a state's county graph, a drawn plan as
// `District`s of `CountyShare`s, and a district's people and lean at the counties as they are now.

import type { SimDate } from "../types/calendar.ts";
import { type CountyId, ordinal, type UsStateId } from "../types/ids.ts";
import { roundHalfAway } from "../types/num.ts";
import type { County, CountyShare, District, DistrictPlan, GeoState } from "../types/state/geo.ts";
import type { Party } from "../types/state/politics.ts";
import { type DrawStats, drawPlan, type Plan, pieceLean, type StateGraph } from "./district.ts";

/**
 * Equal population within this share of the ideal district, after rounding to whole people (pivot
 * 5.4 `DISTRICT_POP_TOLERANCE`, T). The cuts are exact, so a district is off by float noise and
 * rounding only; the tolerance is what the plans promise and the tests hold them to.
 */
export const DISTRICT_POP_TOLERANCE = 0.001;

/** Each state's counties' places in `geo.counties`, in id order, by `UsStateId`. */
export function countiesByState(geo: GeoState, states: number): number[][] {
  const out: number[][] = Array.from({ length: states }, () => []);
  geo.counties.forEach((c, i) => {
    (out[c.state] as number[]).push(i);
  });
  return out;
}

/** The drawer's view of one state's counties (district.ts `StateGraph`), from their state now. */
export function stateGraph(geo: GeoState, ids: readonly number[]): StateGraph {
  const local = new Map<number, number>();
  ids.forEach((id, i) => {
    local.set(id, i);
  });
  const at = (id: number): County => geo.counties[id] as County;
  return {
    ids: [...ids],
    pop: ids.map((id) => at(id).population),
    lean: ids.map((id) => at(id).lean),
    spread: ids.map((id) => at(id).spread),
    x: ids.map((id) => at(id).centroid[0]),
    y: ids.map((id) => at(id).centroid[1]),
    nbr: ids.map((id) =>
      at(id)
        .neighbours.map((m) => local.get(m))
        .filter((m): m is number => m !== undefined)
        .sort((a, b) => a - b),
    ),
  };
}

/** The people in a share of a county (pivot 5.4): `(to − from) × population`. */
export function sharePeople(c: County, s: CountyShare): number {
  return (s.to - s.from) * c.population;
}

/** The mean lean of a share's people (pivot 5.4): `lean + spread × (1 − from − to)`. */
export function shareLean(c: County, s: CountyShare): number {
  return c.lean + c.spread * (1.0 - s.from - s.to);
}

/** A district's people and mean lean at the counties as they are now (pivot 5.2, 5.4). */
export function districtNow(geo: GeoState, d: District): { population: number; lean: number } {
  let w = 0.0;
  let l = 0.0;
  for (const s of d.shares) {
    const c = geo.counties[s.county] as County;
    const a = sharePeople(c, s);
    w += a;
    l += a * shareLean(c, s);
  }
  return { population: w, lean: w > 0.0 ? l / w : 0.0 };
}

/** A drawn plan as `District`s numbered in the order drawn, shares in county id order (pivot 5.4). */
export function planDistricts(g: StateGraph, state: UsStateId, plan: Plan): District[] {
  return plan.map((r, k) => {
    let w = 0.0;
    let l = 0.0;
    const shares: CountyShare[] = r.map((p) => {
      const a = (p.to - p.from) * (g.pop[p.i] as number);
      w += a;
      l += a * pieceLean(g, p);
      return { county: ordinal<CountyId>(g.ids[p.i] as number), from: p.from, to: p.to };
    });
    return { state, number: k + 1, shares, population: roundHalfAway(w), lean: w > 0.0 ? l / w : 0.0 };
  });
}

/** The +1 / −1 of a drawing party: party A (`PARTY_VALUES[0]`, the Democrats) is +1. */
export function partySign(p: Party): number {
  return p === "Democrats" ? 1.0 : -1.0;
}

/**
 * Draws one state's plan (pivot 5.4, 5.5): `seats` districts by `drawnBy` at strength `s` (0 and a
 * null drawer give the neutral, compact map). `theta0` is the map's one Governing draw, scaled.
 */
export function drawStatePlan(
  geo: GeoState,
  ids: readonly number[],
  state: UsStateId,
  seats: number,
  drawnBy: Party | null,
  s: number,
  theta0: number,
  censusYear: number,
  since: SimDate,
  stats: DrawStats,
): DistrictPlan {
  const g = stateGraph(geo, ids);
  const strength = drawnBy === null ? 0.0 : s;
  const sign = drawnBy === null ? 1.0 : partySign(drawnBy);
  const plan = drawPlan(g, seats, strength, sign, theta0, stats);
  return {
    state,
    census_year: censusYear,
    since,
    drawn_by: drawnBy,
    strength,
    struck: false,
    districts: planDistricts(g, state, plan),
  };
}

/** A fresh counters record. */
export function drawStatsNew(): DrawStats {
  return { sweeps: 0, backtracks: 0, forced: 0, kept_weaker: 0 };
}

/** The `UsStateId` of a place in a by-state table. */
export function stateId(i: number): UsStateId {
  return ordinal<UsStateId>(i);
}
