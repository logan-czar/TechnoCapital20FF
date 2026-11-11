// v_returns (pivot 9, 8.6): the count. What has been reported of each race in the latest election,
// the outlets' calls, recounts and certification. Only reported votes: a race's result is fixed
// when its polls close (pivot 9.1), and nothing uncounted is ever in this view. Lane E builds it
// (views/returns.ts; D1037), counted at once in M2; election night's batches are M5's.
//
// A race's row carries its totals. Its county-by-county count (`RaceCountyReturns`, up to 3,142
// rows a race) travels as the slice `{ view: "returns", slice: "counties", race }` for the race the
// map shows (protocol.ts `SliceKey`; D1016, D1037). The view is posted whole when it moves (a call
// retracted included), so it needs no changed-row channel.

import type { DateTime, SimDate } from "../calendar.ts";
import type { CountyId, OutletId, PersonId, RaceId, UsStateId } from "../ids.ts";

/** An outlet's call of a race (pivot 9.3). */
export interface RaceCall {
  outlet: OutletId;
  person: PersonId;
  time: DateTime;
  /** The outlet took it back. */
  retracted: boolean;
}

/** The presidency's count in one state (pivot 9; D1037). */
export interface StateReturns {
  state: UsStateId;
  /** Null until its polls close. */
  polls_closed: DateTime | null;
  /** The share of its expected vote reported, 0 to 1. */
  reporting: number;
  /** Votes reported so far, in the race's candidate order. Whole numbers. */
  votes: { person: PersonId; votes: number }[];
  /** Its electoral votes. Whole number. */
  electoral_votes: number;
  /** Who the wire has called it for (pivot 9.3); null before a call or after a retraction. */
  called: PersonId | null;
  /** When its result was certified (pivot 9.4). */
  certified: SimDate | null;
}

export interface RaceReturns {
  race: RaceId;
  /** Null until its polls close. */
  polls_closed: DateTime | null;
  /** The share of the expected vote reported, 0 to 1. */
  reporting: number;
  /** Votes reported so far, in the race's candidate order. Whole numbers. */
  votes: { person: PersonId; votes: number }[];
  /** Electoral votes of the states called or certified, for the presidency; null otherwise. */
  electoral_votes: { person: PersonId; votes: number }[] | null;
  /** The presidency state by state, in state order; null for other races. */
  states: StateReturns[] | null;
  /** Oldest first. */
  calls: RaceCall[];
  /** A recount is under way (pivot 9.4). */
  recount: boolean;
  /** When the result was certified, and contracts on it settled (pivot 9.4, 10.4). */
  certified: SimDate | null;
}

/** One race's count by county (pivot 9.2): the slice of v_returns. Columns in step. */
export interface RaceCountyReturns {
  race: RaceId;
  counties: CountyId[];
  /** Each county's share of its expected vote reported, 0 to 1. */
  reporting: number[];
  /** Per county, votes in the race's candidate order. Whole numbers. */
  votes: number[][];
}

export interface ReturnsView {
  /** The election day being counted or last counted; null before the first. */
  election: SimDate | null;
  /** In race id order. */
  races: RaceReturns[];
}
