// v_markets (pivot 10, 11): the betting exchange. Every listed contract with its rule, its state
// and the top of its book. Type only: the builder arrives with the prediction market (M5).
//
// A row carries the best bid and ask only. A contract's depth (`ContractBook`) and its price
// history are heavy across thousands of contracts, so they will travel as slices of this view for
// the contract a page shows (protocol.ts `SliceKey`, D1016), added when the builder is.

import type { DateTime, SimDate } from "../calendar.ts";
import type { ContractId, InstrumentId } from "../ids.ts";
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

export interface MarketsView {
  /** In contract id order. */
  contracts: ContractRow[];
}
