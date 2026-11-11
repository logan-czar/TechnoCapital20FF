// v_markets (pivot 10, 11): the betting exchange. Every listed contract with its rule, its state
// and the top of its book. Type only: the builder arrives with the prediction market (M5).
//
// A row carries the best bid and ask only. A contract's depth (`ContractBook`) and its price
// history (`ContractHistory`) are heavy across thousands of contracts, so they travel as the slices
// `{ view: "markets", slice: "book" | "history", contract }` for the contract a page shows
// (protocol.ts `SliceKey`; D1016, D1037).

import type { DateTime, SimDate } from "../calendar.ts";
import type { ContractId, InstrumentId, PersonId } from "../ids.ts";
import type { Party } from "../state/politics.ts";
import type { EntityRef } from "./entity.ts";

/** The kinds of contract (pivot 10.2). */
export type ContractKind = "RaceWinner" | "Chamber" | "Bracket" | "Governing" | "Person";

/** A contract's life (pivot 10.3, 10.4). */
export type ContractStatus =
  /** Listed, with trading not yet open. */
  | "Listed"
  | "Open"
  /** Trading has stopped and the resolution is awaited. */
  | "Closed"
  | "Resolved";

export interface ContractRow {
  id: ContractId;
  /** What an order names to trade it (`PlayerAction` PlaceOrder). */
  instrument: InstrumentId;
  kind: ContractKind;
  /** Contracts for mutually exclusive outcomes share a group number (pivot 10.3). */
  group: number | null;
  title: string;
  /** Its written rule (pivot 10.4). */
  rule: string;
  /** The race, bill or person it is about. */
  subject: EntityRef | null;
  /** A race-winner or people contract's person (pivot 10.2; D1037). */
  person: PersonId | null;
  /** A chamber, bracket or candidate contract's party. */
  party: Party | null;
  /** A bracket contract's range, each end included; null for an open end (pivot 10.2). */
  bracket: { lo: number | null; hi: number | null } | null;
  status: ContractStatus;
  listed: SimDate;
  /** A by-date contract's date (pivot 10.4). */
  deadline: SimDate | null;
  /** How it resolved: true pays $1 (pivot 10.1). Null until resolved. */
  outcome: boolean | null;
  /** Prices in whole cents, 1 to 99 (pivot 10.1); null with nothing on that side. */
  bid: number | null;
  ask: number | null;
  last: number | null;
  /** Yesterday's closing price, whole cents; null before its first close. */
  prev_close: number | null;
  /** The last `CONTRACT_CLOSES_KEPT` daily closes, oldest first (a sparkline). */
  closes: number[];
  /** Contracts traded today and outstanding. Whole numbers. */
  volume: number;
  open_interest: number;
}

/** One price level of a book: every resting order at that price. */
export interface BookLevel {
  /** Whole cents. */
  price: number;
  /** Whole number. */
  qty: number;
}

/** A contract's depth (pivot 11.1, 11.2): the slice of v_markets. */
export interface ContractBook {
  contract: ContractId;
  time: DateTime;
  /** Best first. */
  bids: BookLevel[];
  asks: BookLevel[];
}

/** Daily closes a `ContractRow` carries (D1037). */
export const CONTRACT_CLOSES_KEPT = 30;

/** A contract's price history (pivot 10, 11): the slice `{ view: "markets", slice: "history", contract }`. */
export interface ContractHistory {
  contract: ContractId;
  /** The tick of `prices[0]`: its listing. */
  start: DateTime;
  /** The price at each hour from `start` on, oldest first: the last trade, else the mid. Whole cents. */
  prices: number[];
}

export interface MarketsView {
  /** In contract id order. */
  contracts: ContractRow[];
}
