// v_returns (pivot 9, 8.6): the count. What has been reported of each race in the latest election,
// the outlets' calls, recounts and certification. Only reported votes: a race's result is fixed
// when its polls close (pivot 9.1), and nothing uncounted is ever in this view. Type only: the
// builder arrives with the electorate (M2, counted at once) and election night (M5, over hours).
//
// A race's row carries its totals. Its county-by-county count (`RaceCountyReturns`, up to 3,142
// rows a race) will travel as a slice of this view for the race the map shows (protocol.ts
// `SliceKey`, D1016), with colour-only updates as batches report.

import type { DateTime, SimDate } from "../calendar.ts";
import type { CountyId, OutletId, PersonId, RaceId } from "../ids.ts";

/** An outlet's call of a race (pivot 9.3). */
export interface RaceCall {
  outlet: OutletId;
  person: PersonId;
  time: DateTime;
  /** The outlet took it back. */
  retracted: boolean;
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
