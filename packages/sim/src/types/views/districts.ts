// v_districts (pivot 5.4 to 5.6, 8.6): the House map as public record. Each state's plan and each
// district's counties, which the USA map outlines and the records app lists. Lane G builds it
// (views/districts.ts; D1037). It changes only when a plan does (after a census or a court
// ruling), so it is rebuilt rarely.

import type { SimDate } from "../calendar.ts";
import type { PersonId, UsStateId } from "../ids.ts";
import type { CountyShare } from "../state/geo.ts";
import type { Party } from "../state/politics.ts";

/**
 * A district's id in an `EntityRef` of kind "District" and in `DistrictRow.id` (D1037): its state
 * times this, plus its number. It names "Texas 12" whichever plan is in force, so a link survives a
 * redraw (the district it names may have moved). No state has this many seats.
 */
export const DISTRICT_REF_STRIDE = 100;

/** The `EntityRef` id of district `number` (1 up) of `state`. */
export function districtRefId(state: UsStateId, number: number): number {
  return state * DISTRICT_REF_STRIDE + number;
}

/** The state and number a district ref id names. */
export function districtRefParts(id: number): { state: UsStateId; number: number } {
  return {
    state: Math.floor(id / DISTRICT_REF_STRIDE) as UsStateId,
    number: id % DISTRICT_REF_STRIDE,
  };
}

export interface DistrictRow {
  /** `districtRefId(state, number)`: what an `EntityRef` of kind "District" names. */
  id: number;
  state: UsStateId;
  /** 1 up within its state. */
  number: number;
  /** Its counties and its shares of split counties (pivot 5.4), in county id order. */
  shares: CountyShare[];
  /** People at the census it was drawn on. Whole number. */
  population: number;
  /** Who holds the seat. */
  member: PersonId | null;
  /** Its people's mean lean, in points toward party A. Hidden (pivot 5.11): null unless Omniscient. */
  lean: number | null;
}

export interface DistrictPlanRow {
  state: UsStateId;
  /** Whole number. */
  census_year: number;
  since: SimDate;
  /** Null for a map no party drew. */
  drawn_by: Party | null;
  /** A court has struck it down and a redraw is pending (pivot 5.6). */
  struck: boolean;
  /** The gerrymander strength, 0 to 1 (pivot 5.5). Hidden (pivot 5.11): null unless Omniscient. */
  strength: number | null;
}

export interface DistrictsView {
  /** In state order. */
  plans: DistrictPlanRow[];
  /** In state order, then district number. */
  districts: DistrictRow[];
}
