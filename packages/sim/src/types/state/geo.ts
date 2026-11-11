// Counties and House districts (pivot 5.1 to 5.6; D1027, D1028, D1037): `World.geo`. Types only. M1
// loads the counties when the world has a counties file (geo/load.ts) and leaves the plans empty;
// drift, the census, districting and court challenges are lane G's in M2 (`geo/`).
//
// `District` here is the pivot's (whole counties and shares of counties). The politics POC's
// `District` (./politics.ts, D982: a state, a number and a home province) stays until M2's
// elections move onto this one; import each from its own file.

import type { SimDate } from "../calendar.ts";
import type { CountyId, UsStateId } from "../ids.ts";
import type { Party } from "./politics.ts";

/**
 * A county (pivot 5.1): the voter unit, on the frozen vintage (the 2010 county set with Bedford
 * city, Virginia, merged into Bedford County; 3,142 of them, D1028). Rows are in FIPS order, so a
 * `CountyId` is a place in that order.
 */
export interface County {
  /** The five-digit FIPS code, with its leading zero ("01001"). */
  fips: string;
  /** Its row in `PoliticsState.states`. */
  state: UsStateId;
  name: string;
  /** People now (pivot 5.1, 5.2); counties.csv `pop_1990` at load. Whole number. */
  population: number;
  /** Points toward party A (the Democrats: `PARTY_VALUES[0]`), as a state's `lean_pts` (pivot 5.1). */
  lean: number;
  /**
   * Half the range of lean inside the county, in points (pivot 5.4, D1028): its people's lean runs in
   * a straight line from `lean + spread` to `lean − spread`. 0 is a uniform county.
   */
  spread: number;
  /** How far its persuadable voters move, 1 being the nation's (pivot 5.1, 6.4). */
  elasticity: number;
  /** The share of its people who vote, 0 to 1 (pivot 5.1, 6.7). */
  turnout: number;
  /** A point inside it on the map's plane (counties.csv `centroid_x`, `centroid_y`): districting sweeps by it. */
  centroid: [x: number, y: number];
  /** The counties it touches in its own state and others, in id order (county-adjacency.csv). */
  neighbours: CountyId[];
}

/**
 * A district's part of one county (pivot 5.4, D1028): the interval `[from, to]` of the county's
 * people ordered from most party-A to most party-B, each end 0 to 1. A county held whole is
 * `[0, 1]`. The shares of one county do not overlap and together cover it. The share holds
 * `(to − from) × population` people at the interval's mean lean,
 * `lean + spread × (1 − from − to)`, with the county's elasticity and turnout.
 */
export interface CountyShare {
  county: CountyId;
  from: number;
  to: number;
}

/** A House district (pivot 5.4): whole counties and shares of the counties too large for one. */
export interface District {
  state: UsStateId;
  /** 1 up within its state. */
  number: number;
  /** Its counties in id order; a whole county is the share `[0, 1]`. */
  shares: CountyShare[];
  /** People at the census it was drawn on. Whole number. */
  population: number;
  /** The mean lean of its people at that census, in points toward party A. */
  lean: number;
}

/** One state's districts as drawn after a census (pivot 5.5, 5.6). */
export interface DistrictPlan {
  state: UsStateId;
  /** The census it was drawn on (2000, 2010, 2020...; pivot 5.3). Whole number. */
  census_year: number;
  /** When it took effect. */
  since: SimDate;
  /** Who drew it: the governor's party (pivot 5.5); null for a map no party drew (the starting one). */
  drawn_by: Party | null;
  /** The gerrymander strength `s`, 0 (neutral, compact) to 1 (maximum pack and crack; pivot 5.5). */
  strength: number;
  /** A court has struck it down and its redraw is pending (pivot 5.6). */
  struck: boolean;
  /** In district number order; as many as the state's seats. */
  districts: District[];
}

/** One census (pivot 5.3): the people counted and the seats they apportion, by equal proportions. */
export interface Census {
  /** 2000, 2010, 2020 and every ten years after. Whole number. */
  year: number;
  /** People by `UsStateId`. Whole numbers. */
  population: number[];
  /** House seats by `UsStateId` from the next Congress on. Whole numbers summing to 435. */
  seats: number[];
}

/** Where a court challenge to a map stands (pivot 5.6). */
export type ChallengeStatus = "Filed" | "Upheld" | "Struck";

/** A court challenge to a state's plan (pivot 5.6): an event, and a contract in M5 (pivot 10.2). */
export interface Challenge {
  state: UsStateId;
  /** The census of the plan challenged. Whole number. */
  census_year: number;
  filed: SimDate;
  /** When the court rules; set at filing (lane G's T). */
  ruling: SimDate;
  status: ChallengeStatus;
}

/**
 * The places politics runs on (`World.geo`; D1037). Every table is empty in a world with no
 * counties file, and elections then run on the politics POC's tables as today.
 */
export interface GeoState {
  /** In FIPS order (pivot 5.1). */
  counties: County[];
  /** The plan in force for each state with a seat, in state order; empty until lane G draws the first. */
  plans: DistrictPlan[];
  /** Plans no longer in force, oldest first (the records site's maps, pivot 8.6). */
  history: DistrictPlan[];
  /** Every census taken in play, oldest first (pivot 5.3). */
  censuses: Census[];
  /** House seats by `UsStateId` now (pivot 5.3); empty until lane G sets them (at load or a census). */
  seats: number[];
  /** Every challenge filed, oldest first (pivot 5.6). */
  challenges: Challenge[];
}
