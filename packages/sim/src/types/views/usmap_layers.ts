// v_usmap_layers (pivot 15.3, 5.1): what the USA map colours counties and states by, apart from
// live returns (v_returns) and district outlines (v_districts). Type only: the builder arrives
// with the electorate (M2).
//
// The county table is columns, not rows: one plain array per field, each as long as the county
// table and in county id (FIPS) order. 3,142 objects cost twice the bytes of the same columns
// (tools/spikes/coarse/README.md), and the map reads a column at a time.

import type { UsStateId } from "../ids.ts";
import type { Party } from "../state/politics.ts";

export interface UsMapCounties {
  /** Five-digit FIPS codes: the join to the county shapes. */
  fips: string[];
  /** Each county's `UsStateId`. */
  state: number[];
  name: string[];
  /** People now. Whole numbers. */
  population: number[];
  /** The House district holding the largest share of the county; 0 before the first plan. */
  district: number[];
  /** The party that carried it in the last certified presidential vote; null before one. */
  last_winner: (Party | null)[];
  /** That vote's margin, in points toward party A; null before one. */
  last_margin: (number | null)[];
  /** The county's true lean, in points toward party A. Hidden (pivot 5.11): null unless Omniscient. */
  lean: number[] | null;
}

export interface UsMapState {
  id: UsStateId;
  name: string;
  /** Whole numbers. */
  population: number;
  house_seats: number;
  electoral_votes: number;
  /** The governor's party; null before governors exist (M2). */
  governor: Party | null;
}

export interface UsMapLayersView {
  counties: UsMapCounties;
  /** In state order. */
  states: UsMapState[];
}
