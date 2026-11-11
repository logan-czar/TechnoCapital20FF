// The mock world's calendar: when its scripted events happen (README.md lists them for the app
// lanes). Every time is a mock date, the same for every seed; what happens on it (who wins, by how
// much) comes from the seed.

import { type DateTime, dateTimeAt, type Party, type SimDate, simDateYmd } from "@tc20ff/sim";

const at = (month: number, day: number, hour = 0): DateTime => dateTimeAt(simDateYmd(2020, month, day), hour);
export const ymd = (month: number, day: number): SimDate => simDateYmd(2020, month, day);

/** The general election year the mock plays (pivot 6.1). */
export const MOCK_CYCLE = 2020;
/** Where the mock world's own history starts: `HYDRATE_POLL_DAYS` = 60 days before a new game (pivot 3.4). */
export const MOCK_HISTORY_START = at(8, 21);
/** A new mock game: two weeks before the election, so a few Steps reach it. */
export const MOCK_START = at(10, 20);

/** The scripted events, by name (pivot 6.5, 7, 8.3, 9, 10.4). */
export const SCRIPT = {
  /** The player opens their accounts and makes their first trades (the pre-rolled history). */
  player_opens: at(8, 24, 10),
  /** The infrastructure bill passes the House (pivot 7.1). */
  infra_house: at(9, 2, 14),
  /** The vetoed bill: vetoed, the override fails, and its by-date contract resolves No (pivot 7.5, 10.4). */
  veto: at(9, 9, 15),
  veto_override: at(9, 16, 15),
  veto_deadline: at(9, 30, 23),
  /** The tax bill is reported out of committee. */
  tax_reported: at(10, 8, 11),
  /** The bill that dies on a failed cloture vote (pivot 7.4). */
  cloture_fails: at(9, 30, 16),
  /** The quarterly campaign finance filing (pivot 8.6). */
  filing_q3: at(10, 15, 9),
  /** The pre-general filing. */
  filing_pre_general: at(10, 22, 9),
  /** Rumour 1 (true): a Cabinet secretary will resign. Posted, then confirmed (pivot 8.3). */
  rumour_true_posted: at(10, 21, 9),
  rumour_true_confirmed: at(10, 23, 14),
  /** The presidential debate (pivot 6.5). */
  debate: at(10, 22, 20),
  /** Rumour 2 (false): a Senate candidate will drop out. Posted, run unconfirmed, then debunked. */
  rumour_false_posted: at(10, 24, 11),
  rumour_false_printed: at(10, 24, 16),
  rumour_false_debunked: at(10, 26, 10),
  /** The resigned secretary's successor is nominated (pivot 7.6). */
  nomination: at(10, 27, 11),
  /** The confirmation contract, listed at the nomination, opens for trading (pivot 10.3). */
  confirm_opens: at(10, 28, 9),
  /** The infrastructure bill: cloture and passage in the Senate, then the signature (pivot 7.1). */
  bill_senate_vote: at(10, 27, 15),
  bill_signed: at(10, 30, 12),
  /** By-date contracts that resolve No at their date (pivot 10.4). */
  dropout_deadline: at(11, 2, 23),
  /** Election day: the fixed pause at 00:00 (pivot 2.4 item 3). */
  election_day: at(11, 3, 0),
  /** The tax bill's House vote, after the election. */
  bill_house_vote: at(11, 5, 14),
  senate_deadline: at(11, 6, 23),
  /** When the count of an ordinary race is certified, and its contracts settle (pivot 9.4, 10.4). */
  certification: at(11, 9, 9),
  /** The recount race: recounted, then certified (pivot 9.4). */
  recount_done: at(11, 11, 12),
  recount_certification: at(11, 12, 9),
} as const;

export const ELECTION_DATE = ymd(11, 3);
export const CERTIFICATION_DATE = ymd(11, 9);
export const RECOUNT_CERTIFICATION_DATE = ymd(11, 12);

/** The two parties, party A first: `PARTY_VALUES` of types/state/politics.ts, which the sim's public face does not export. */
export const PARTIES: readonly Party[] = ["Democrats", "Republicans"];
