// v_records (pivot 8.6): the official records site. Bills and their status, roll calls, executive
// actions and campaign finance filings: always true, published on a legal schedule. Certified
// results are in v_returns and district maps in v_districts. Type only: the builders arrive with
// governing (M3) and the information layer (M4).
//
// A roll call's row carries the tally only. How each member voted (`RollCallVotes`, up to 435
// rows) is heavy, so it travels as the slice `{ view: "records", slice: "votes", roll_call }` for
// the roll call a page shows (protocol.ts `SliceKey`; D1016, D1037). Roll calls, actions and
// filings only grow: a frame carries the new rows (protocol.ts `APPEND_LISTS`).

import type { SimDate } from "../calendar.ts";
import type { BillId, PersonId, RaceId } from "../ids.ts";
import type { Levers } from "../state/governing.ts";

/** A bill's stage (pivot 7.1). */
export type BillStage =
  | "Drafted"
  | "Committee"
  | "HouseFloor"
  | "SenateFloor"
  | "Conference"
  | "President"
  | "Law"
  | "Dead";

/** One lever a bill or an order would move (pivot 4.3, 7.1). */
export interface LeverChange {
  lever: keyof Levers;
  /** The industry or the US state of a per-industry or per-state lever; null for a national one. */
  index: number | null;
  /** The lever's value once the change takes effect. */
  to: number;
}

/** One step in a bill's history, as the records site lists it (pivot 7.1, 8.6; D1037). */
export interface BillAction {
  date: SimDate;
  /** Where it happened; null for the president or the conference. */
  chamber: Chamber | null;
  /** "Introduced", "Referred to committee", "Passed the House 218 to 210". */
  text: string;
  /** The roll call it was, if any. */
  roll_call: number | null;
}

export interface BillRow {
  id: BillId;
  title: string;
  summary: string;
  sponsor: PersonId;
  subject: string;
  /** The chamber it was introduced in. */
  chamber_of_origin: Chamber;
  stage: BillStage;
  /** Oldest first. */
  actions: BillAction[];
  changes: LeverChange[];
  introduced: SimDate;
  last_action: SimDate;
  /** When a law's changes take effect (pivot 7.7). */
  effective: SimDate | null;
}

export type Chamber = "House" | "Senate";

export interface RollCallRow {
  /** Its place in the order roll calls were held, from 0. */
  id: number;
  bill: BillId;
  chamber: Chamber;
  date: SimDate;
  /** "On passage", "On cloture", "On overriding the veto". */
  question: string;
  /** Whole numbers. */
  yeas: number;
  nays: number;
  passed: boolean;
}

/** How each member voted in one roll call (pivot 7.4): the slice of v_records. */
export interface RollCallVotes {
  roll_call: number;
  votes: { person: PersonId; vote: "Yea" | "Nay" | "NotVoting" }[];
}

/** An executive action (pivot 7.6). */
export interface ExecActionRow {
  /** Its place in the order they were taken, from 0. */
  id: number;
  date: SimDate;
  kind: "Nomination" | "Confirmation" | "Order" | "Veto" | "Shutdown" | "Impeachment" | "Resignation";
  /** Who took it and who it names. */
  actor: PersonId | null;
  subject: PersonId | null;
  text: string;
  changes: LeverChange[];
}

/** A campaign finance filing (pivot 6.3, 8.6). */
export interface FilingRow {
  race: RaceId;
  person: PersonId;
  /** The last day the filing covers. */
  through: SimDate;
  /** USD in the period. */
  raised: number;
  spent: number;
  /** USD on hand at its end. */
  cash: number;
}

export interface RecordsView {
  /** In bill id order. */
  bills: BillRow[];
  /** Oldest first. */
  roll_calls: RollCallRow[];
  /** Oldest first. */
  actions: ExecActionRow[];
  /** Oldest first. */
  filings: FilingRow[];
}
