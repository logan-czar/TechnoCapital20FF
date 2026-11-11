// v_races (pivot 6.1, 6.2): the races of the open cycle and their candidates, as public record.
// Type only: the builder arrives with the electorate (M2).

import type { SimDate } from "../calendar.ts";
import type { PersonId, RaceId, UsStateId } from "../ids.ts";
import type { Party } from "../state/politics.ts";

/** An elected office (pivot 5.8). */
export type ElectedOffice = "President" | "Senate" | "House" | "Governor";

/** Where a race stands (pivot 6.2, 9). */
export type RaceStatus =
  | "Filing"
  | "Primaries"
  | "General"
  /** The polls have closed and the count is coming in (pivot 9.2). */
  | "Counting"
  | "Recount"
  | "Certified";

/** Where a candidate stands in their race (pivot 6.2). */
export type CandidateStatus = "Running" | "DroppedOut" | "LostPrimary" | "Nominee" | "Won" | "Lost";

export interface CandidateRow {
  person: PersonId;
  /** Null for an independent. */
  party: Party | null;
  status: CandidateStatus;
  incumbent: boolean;
  /** Raised and on hand as last filed, USD (pivot 6.3, 8.6); null before a first filing. */
  raised: number | null;
  cash: number | null;
  /** The campaign's one strength number (pivot 6.6). Hidden (pivot 5.11): null unless Omniscient. */
  strength: number | null;
}

export interface RaceRow {
  id: RaceId;
  office: ElectedOffice;
  /** Null for the presidency. */
  state: UsStateId | null;
  /** A House race's district number. */
  district: number | null;
  /** A Senate race's class. */
  senate_class: number | null;
  /** "Texas 12", "Ohio Senate", "President". */
  title: string;
  status: RaceStatus;
  /** Each party's primary day (pivot 6.1). */
  primaries: { party: Party; date: SimDate }[];
  general: SimDate;
  /** In filing order. */
  candidates: CandidateRow[];
  /** The certified winner (pivot 9.4). */
  winner: PersonId | null;
}

export interface RacesView {
  /** The cycle's general election year; null with no cycle open. Whole number. */
  cycle: number | null;
  /** In race id order. */
  races: RaceRow[];
}
