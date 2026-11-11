// Elections (pivot 6.1, 6.2, 6.6, 6.7, 9.4; D1037): `World.elections`. Types only. Lane E
// (packages/sim/src/elections/) fills and runs it in M2, at Coarse fidelity: candidates have one
// strength number (pivot 6.6) and a race is counted at once when its polls close. Full campaigns
// (war chests, spending, events) are M3's and election night's batches M5's; their fields are here
// at their neutral values so those lanes add logic, not shape.
//
// Until lane E switches it on, every table is empty and the politics POC's yearly vote
// (politics/jobs.ts) decides the seats as before (pivot-lanes.md "The politics POC").
//
// Sizes (tools/spikes/coarse/README.md): race-level results are kept for every race ever run;
// county-level results only for the latest general, as columns of whole votes.

import type { DateTime, SimDate } from "../calendar.ts";
import type { CountyId, PersonId, RaceId, UsStateId } from "../ids.ts";
import type { CandidateStatus, ElectedOffice, RaceStatus } from "../views/races.ts";
import type { Party } from "./politics.ts";

/** An elected office (pivot 5.8, 6.2): v_races' `ElectedOffice`. */
export type RaceOffice = ElectedOffice;

/** Where a candidate stands (pivot 6.2): v_races' `CandidateStatus`. */
export type CandidacyStatus = CandidateStatus;

/** One person's run in one race (pivot 6.2, 6.6). */
export interface Candidacy {
  person: PersonId;
  /** Null for an independent. */
  party: Party | null;
  filed: SimDate;
  status: CandidacyStatus;
  /** Held the seat when they filed. */
  incumbent: boolean;
  /**
   * The Coarse campaign's one number (pivot 6.6): from skills, money and incumbency, applied to the
   * vote directly. In utility units (politics/vote.ts `utility`). Hidden (pivot 5.11).
   */
  strength: number;
  /** USD raised, spent and on hand (pivot 6.3). 0 at Coarse fidelity; Full campaigns are M3's. */
  raised: number;
  spent: number;
  cash: number;
}

/** A party's primary in one race (pivot 6.1, 6.2). */
export interface Primary {
  party: Party;
  date: SimDate;
  /** The candidates on its ballot, in filing order: its candidate order. */
  ballot: PersonId[];
  /** Null until counted. */
  result: RaceResult | null;
}

/** A counted vote (pivot 6.7, 9.4): race level, kept for every race. */
export interface RaceResult {
  /** Whole votes in the ballot's candidate order. */
  votes: number[];
  /** Whole number: everyone who voted in it. */
  turnout: number;
  /** The candidate with the most votes; ties to the earlier on the ballot (D2). */
  winner: PersonId;
  /** Winner's share less the runner-up's, in points of the votes cast. */
  margin: number;
  /** A recount ran (pivot 9.4). */
  recount: boolean;
  /** When it was certified (pivot 9.4); null until then. */
  certified: SimDate | null;
}

/** One state's part of a presidential vote (pivot 6.7). */
export interface StateTally {
  state: UsStateId;
  /** Whole votes in the general ballot's order. */
  votes: number[];
  /** Its electoral votes in that election. Whole number. */
  electoral_votes: number;
  /** Who carried it. */
  winner: PersonId;
}

/** A presidential election's college (pivot 6.7): states summed to electoral votes. */
export interface ElectoralCollege {
  race: RaceId;
  /** In state order, the states with electoral votes. */
  states: StateTally[];
  /** Electoral votes in the general ballot's order. Whole numbers. */
  totals: number[];
  /** Who won the college; null when nobody reached a majority (the House decides, lane E's T). */
  winner: PersonId | null;
}

/**
 * One race's certified vote by county (pivot 6.7, 8.6), as columns in step: `counties[k]` cast
 * `votes[c][k]` for the ballot's candidate `c`. A county split between districts is the race's
 * part of it. Kept for the latest general only (tools/spikes/coarse/README.md).
 */
export interface CountyResult {
  race: RaceId;
  /** In county id order. */
  counties: CountyId[];
  /** One column per ballot candidate, in ballot order. Whole votes. */
  votes: number[][];
}

/** A race (pivot 6.2): an office, a place, its primaries and its general. */
export interface Race {
  id: RaceId;
  office: RaceOffice;
  /** Null for the presidency. */
  state: UsStateId | null;
  /** A House race's district number in its plan. */
  district: number | null;
  /** A Senate race's class, 1 to 3. */
  senate_class: number | null;
  /** A special election for a vacancy (pivot 6.1). */
  special: boolean;
  /** The year of its general. Whole number. */
  cycle: number;
  /** Where it stands (pivot 6.2, 9): v_races' `RaceStatus`. */
  status: RaceStatus;
  /** Who held the seat when the race opened; null for an open seat. */
  incumbent: PersonId | null;
  /** The party holding the seat when the race opened, open seat or not; null if vacant with no party. */
  incumbent_party: Party | null;
  /** In `PARTY_VALUES` order, the parties holding one. */
  primaries: Primary[];
  general: SimDate;
  /** When its last polls close on general day (pivot 9.1, 9.2). */
  polls_close: DateTime;
  /** When it is to be certified (pivot 9.4). */
  certify: SimDate;
  /** Everyone who filed, in filing order. */
  candidacies: Candidacy[];
  /** The general's ballot in its candidate order: what polls, forecasts and counts list (pivot 8.4, 8.5, 9). */
  ballot: PersonId[];
  /** Null until counted. */
  result: RaceResult | null;
}

/** When elections fall (pivot 6.1). */
export interface ElectionCalendar {
  /** The next federal general, the first Tuesday after the first Monday of November of an even year; null before lane E sets it. */
  next_general: SimDate | null;
  /** Each state's primary day for the open cycle (T), by `UsStateId`; empty with no cycle open. */
  primaries: (SimDate | null)[];
  /** Each state's governor cycle, by `UsStateId`: the remainder of its governor general's year by 4 (0 with the presidency, 2 at midterms, 1 or 3 for odd-year states); null for no governor (DC). */
  governor_cycle: (number | null)[];
}

/** The elections (`World.elections`; pivot 6). Empty in every world until lane E. */
export interface ElectionsState {
  calendar: ElectionCalendar;
  /** Every race ever opened, in id order (race-level results are kept). */
  races: Race[];
  /** Races made so far, so the next one's id (`RaceId`). Whole number (u32). */
  races_made: number;
  /** The general being counted or last counted; null before the first. */
  latest_general: SimDate | null;
  /** The latest general's races by county, in race id order (lane E's columns). */
  county_results: CountyResult[];
  /** One per presidential general, oldest first. */
  colleges: ElectoralCollege[];
}
