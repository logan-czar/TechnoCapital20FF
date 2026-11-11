// v_races (pivot 6.1, 6.2): the races of the open cycle and their candidates, as public record.
// Lane E builds it (views/races.ts; D1037).

import type { DateTime, SimDate } from "../calendar.ts";
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

/** A party's primary in a race (pivot 6.1, 6.2). */
export interface PrimaryRow {
  party: Party;
  date: SimDate;
  /** Its ballot in filing order: the primary's candidate order (D1037). */
  ballot: PersonId[];
  /** Who won it, once counted. */
  winner: PersonId | null;
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
  /** A special election for a vacancy (pivot 6.1). */
  special: boolean;
  /** "Texas 12", "Ohio Senate", "President". */
  title: string;
  status: RaceStatus;
  /** Each party's primary (pivot 6.1), in `PARTY_VALUES` order. */
  primaries: PrimaryRow[];
  general: SimDate;
  /** When its last polls close on general day (pivot 9.1). */
  polls_close: DateTime;
  /** When it is to be certified (pivot 9.4). */
  certify: SimDate;
  /** The party holding the seat when the race opened, open seat or not; null for none. */
  incumbent_party: Party | null;
  /** The presidency's electoral votes to win (a majority of the college); null for other races. */
  electoral_votes: number | null;
  /** In filing order. */
  candidates: CandidateRow[];
  /**
   * The general's ballot: the race's **candidate order** (D1037). `Poll.shares`, `RaceForecast.odds`
   * and `RaceReturns.votes` list exactly these people in this order; empty until the nominees are
   * known.
   */
  ballot: PersonId[];
  /** The certified winner (pivot 9.4). */
  winner: PersonId | null;
}

export interface RacesView {
  /** The cycle's general election year; null with no cycle open. Whole number. */
  cycle: number | null;
  /** In race id order. */
  races: RaceRow[];
}
