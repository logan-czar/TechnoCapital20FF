// v_forecast (pivot 8.5): the public forecast site. An in-world model built from published polls
// and fundamentals, so it can be wrong; nothing here is the sim's truth. Type only: the builder
// arrives with the information layer (M4).

import type { SimDate } from "../calendar.ts";
import type { PersonId, RaceId, UsStateId } from "../ids.ts";
import type { Party } from "../state/politics.ts";

/** A low, middle and high estimate: the forecast's 10th, 50th and 90th percentiles. */
export type ForecastRange = [lo: number, mid: number, hi: number];

export interface RaceForecast {
  race: RaceId;
  /** Each candidate's chance to win, 0 to 1, in the race's candidate order (`RaceRow.ballot`). */
  odds: { person: PersonId; win: number }[];
  /** The leader's winning margin, in points. */
  margin: ForecastRange;
}

export interface ChamberForecast {
  chamber: "House" | "Senate";
  /** Each party's chance of control and its seats, in `PARTY_VALUES` order. */
  parties: { party: Party; control: number; seats: ForecastRange }[];
}

/** The presidency in one state (pivot 8.5; D1037). */
export interface StateForecast {
  state: UsStateId;
  /** The state's electoral votes. Whole number. */
  electoral_votes: number;
  /** Each candidate's chance to carry it, in the presidential race's candidate order. */
  odds: { person: PersonId; win: number }[];
  /** The leader's margin there, in points. */
  margin: ForecastRange;
}

export interface ForecastView {
  /** When the site last ran its model; null before its first run. */
  updated: SimDate | null;
  /** The races it covers, in race id order. */
  races: RaceForecast[];
  chambers: ChamberForecast[];
  /** The presidency state by state in a presidential year, in state order; empty otherwise. */
  states: StateForecast[];
  /** Party A's electoral votes in a presidential year; null otherwise. */
  electoral_votes: ForecastRange | null;
}
