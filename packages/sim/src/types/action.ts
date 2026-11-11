// Player actions (pivot 1.2, 11, 13.1, 14; D1027): what the player does to the world, as plain
// data. Lane P applies them from M2 (player/index.ts `playerAct`, through lib.ts `simAct`); until it
// does, and for the exchange's until M5, the sim rejects an action with `NotAvailable`.
//
// An action is not a `Control` (./control.ts). A control changes only how the runner runs the sim
// (speed, pause, alerts) and is outside the state hash (D5, D13). An action changes the world: an
// order rests on a book, cash moves between accounts, a followed account shapes what the player is
// told. So actions are **inside the state hash and recorded for replay** (D1027, pivot 16.1): the
// same seed and the same actions at the same ticks give the same state hash in headless Node and
// in the app. An action is applied between ticks, at once, in the order sent; what it changes is
// world state under `World` (the player's accounts, orders, follows and alert rules), never
// `Controls`.

import type { CompanyId, ContractId, InstrumentId, OrderId } from "./ids.ts";
import type { EntityRef } from "./views/entity.ts";

/** Where the player holds cash and trades (pivot 14.1). */
export type Venue =
  /** The brokerage: stocks (pivot 13). */
  | "Brokerage"
  /** The betting exchange: prediction market contracts (pivot 10, 11). */
  | "Exchange";

/** Venue in declaration order. */
export const VENUE_VALUES = ["Brokerage", "Exchange"] as const;

/** Which side of the book (pivot 11.1). Selling a contract's Yes is buying its No (pivot 10.5). */
export type OrderSide = "Buy" | "Sell";

/** How long an order rests (pivot 11.1). */
export type TimeInForce =
  /** Cancelled at the end of the day it was placed. */
  | "Day"
  /** Good till cancelled. */
  | "Gtc";

/**
 * What an alert watches for (pivot 14.4). `Any` is every published event that names the target;
 * the price rules are for a contract or a ticker, in the venue's price units (cents for a
 * contract, pivot 10.1; USD for a stock).
 */
export type AlertWhen =
  | { kind: "Any" }
  | { kind: "PriceAbove"; price: number }
  | { kind: "PriceBelow"; price: number };

/** One of the player's alerts (pivot 14.4, 2.4): it notifies, and pauses if `pause` is set. */
export interface AlertRule {
  target: EntityRef;
  when: AlertWhen;
  pause: boolean;
}

/** An alert rule's id: its number among the rules the player has added, from 0. Whole number. */
export type AlertRuleId = number;

/** What the player may do (pivot 1.2, 1.3): trade, move cash, follow and set alerts. Nothing else. */
export type PlayerAction =
  /**
   * Place an order (pivot 11.1, 13.1). `qty` is a whole number of contracts or shares, above 0.
   * `limit` is the limit price in the venue's ticks (whole cents for a contract, pivot 10.1), or
   * null for a market order. On the brokerage before the stock order book (pivot 13.1) an order
   * fills at once at the hourly price, long only, capped at `PLAYER_MAX_STAKE` of the company
   * (pivot 1.3). Stop orders join with the exchange (M5).
   */
  | {
      kind: "PlaceOrder";
      venue: Venue;
      instrument: InstrumentId;
      side: OrderSide;
      qty: number;
      limit: number | null;
      tif: TimeInForce;
    }
  /** Cancel one of the player's resting orders (pivot 11.1). */
  | { kind: "CancelOrder"; order: OrderId }
  /** Move `amount` USD of cash between the player's two accounts (pivot 14.1). */
  | { kind: "Transfer"; from: Venue; to: Venue; amount: number }
  /**
   * Follow a social account (an `EntityRef` of kind "Handle"; pivot 8.3) or a person, race, bill or
   * ticker (pivot 14.4): the feed and the phone lead with what is followed.
   */
  | { kind: "Follow"; target: EntityRef }
  | { kind: "Unfollow"; target: EntityRef }
  /** Add an alert (pivot 14.4). */
  | { kind: "AlertRuleAdd"; rule: AlertRule }
  | { kind: "AlertRuleRemove"; rule: AlertRuleId }
  /**
   * The player has read the phone's notifications up to and including `through` (a
   * v_notifications row id; D1037). Kept in the world so a save keeps what was read; a `through`
   * below the one held changes nothing.
   */
  | { kind: "NotificationsRead"; through: number };

/** Every action kind, in declaration order. */
export const PLAYER_ACTION_KINDS = [
  "PlaceOrder",
  "CancelOrder",
  "Transfer",
  "Follow",
  "Unfollow",
  "AlertRuleAdd",
  "AlertRuleRemove",
  "NotificationsRead",
] as const satisfies readonly PlayerAction["kind"][];

// ---------------------------------------------------------------- instruments (D1037)

/**
 * The first stock instrument (D1037): a contract's `InstrumentId` is its `ContractId` (below this),
 * and a company's stock is this plus its `CompanyId`. Options (pivot 13.2) will take the range above
 * `2 × STOCK_INSTRUMENT_BASE`.
 */
export const STOCK_INSTRUMENT_BASE = 1_000_000_000;

/** What an order names to trade company `company`'s stock. */
export function stockInstrument(company: CompanyId): InstrumentId {
  return (STOCK_INSTRUMENT_BASE + company) as InstrumentId;
}

/** What an order names to trade contract `contract` (pivot 10.1). */
export function contractInstrument(contract: ContractId): InstrumentId {
  return contract as number as InstrumentId;
}

/** The company or contract an instrument trades, as an `EntityRef`. */
export function instrumentTarget(instrument: InstrumentId): EntityRef {
  return instrument >= STOCK_INSTRUMENT_BASE
    ? { kind: "Company", id: instrument - STOCK_INSTRUMENT_BASE }
    : { kind: "Contract", id: instrument };
}

/** The venue an instrument trades on: a stock at the brokerage, a contract on the exchange. */
export function instrumentVenue(instrument: InstrumentId): Venue {
  return instrument >= STOCK_INSTRUMENT_BASE ? "Brokerage" : "Exchange";
}

/** Why an action was not applied. A rejected action changes nothing and is not recorded. */
export type ActError =
  /** This build has no system that takes the action yet. Every action, until M2 and M5. */
  | { kind: "NotAvailable"; action: PlayerAction["kind"] }
  /** The action is malformed or names something that does not exist. */
  | { kind: "Invalid"; message: string }
  /** The rules refuse it: not enough cash, over `PLAYER_MAX_STAKE` (pivot 1.3), a closed market. */
  | { kind: "Rejected"; message: string };

/** The text of an ActError, for the player. */
export function actErrorMessage(e: ActError): string {
  switch (e.kind) {
    case "NotAvailable":
      return `${e.action} is not available in this build`;
    case "Invalid":
    case "Rejected":
      return e.message;
  }
}
