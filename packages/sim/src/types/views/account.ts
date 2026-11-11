// v_account (pivot 14): the player's own money. Cash at each venue, positions, orders, fills,
// settlements, tax and what the player follows. All of it is the player's to see. Lane P builds it
// (views/account.ts; D1037); orders and fills on a book arrive with the exchange (M5). The fills
// only grow, oldest first: a frame carries the new ones (protocol.ts `APPEND_LISTS`).
//
// Instruments: a contract's is its contract id and a stock's is `STOCK_INSTRUMENT_BASE` plus its
// company id (types/action.ts `stockInstrument`, `contractInstrument`, `instrumentTarget`).

import type { AlertRule, AlertRuleId, OrderSide, TimeInForce, Venue } from "../action.ts";
import type { DateTime } from "../calendar.ts";
import type { ContractId, InstrumentId, OrderId } from "../ids.ts";
import type { EntityRef } from "./entity.ts";

/** How a position is held (pivot 10.5, 13.1; D1037): a stock long, a contract's Yes or its No. */
export type PositionSide = "Long" | "Yes" | "No";

export interface PositionRow {
  venue: Venue;
  instrument: InstrumentId;
  /** The company or the contract held. */
  what: EntityRef;
  side: PositionSide;
  /** Shares or contracts held, above 0 (a No side is not a negative Yes). Whole number. */
  qty: number;
  /** Per unit, first in first out (pivot 14.2), in the venue's price units; a No in No's cents. */
  avg_cost: number;
  /** The price it is valued at now, in the same units. */
  mark: number;
  /** USD. */
  unrealised: number;
  /** USD held against it (pivot 10.5: a contract is fully collateralised); 0 for a stock. */
  collateral: number;
}

export type OrderStatus = "Open" | "Filled" | "Cancelled" | "Expired";

/** Why an order closed (D1037). */
export type OrderCloseReason =
  | "Filled"
  /** The player cancelled it. */
  | "Cancelled"
  /** A Day order at the day's end. */
  | "Expired"
  /** Its contract stopped trading or resolved. */
  | "MarketClosed"
  /** Not enough cash, or over `PLAYER_MAX_STAKE`, when it came to fill. */
  | "Rejected";

export interface OrderRow {
  id: OrderId;
  venue: Venue;
  instrument: InstrumentId;
  what: EntityRef;
  side: OrderSide;
  /** Whole numbers. */
  qty: number;
  filled: number;
  /** The mean price of its fills; null before the first. */
  avg_price: number | null;
  /** Null for a market order. */
  limit: number | null;
  tif: TimeInForce;
  placed: DateTime;
  status: OrderStatus;
  /** When it closed, and why; null while open. */
  closed: DateTime | null;
  reason: OrderCloseReason | null;
}

export interface FillRow {
  order: OrderId;
  time: DateTime;
  venue: Venue;
  instrument: InstrumentId;
  /** The company or contract traded. */
  what: EntityRef;
  side: OrderSide;
  /** Whole number. */
  qty: number;
  price: number;
  /** USD (pivot 10.5, 13.1). */
  fee: number;
  /** USD of gain a sale realised (FIFO, pivot 14.2); 0 for a buy. */
  realised: number;
}

/** A contract the player held, paid out on resolution (pivot 10.4, 10.5). */
export interface SettlementRow {
  contract: ContractId;
  time: DateTime;
  side: PositionSide;
  /** Whole number. */
  qty: number;
  /** The contract resolved Yes. */
  outcome: boolean;
  /** USD paid to the player, after the fee. */
  payout: number;
  fee: number;
}

export interface AccountView {
  /** The player exists (false in a Coarse world and before hydration, pivot 3.4). */
  open: boolean;
  /**
   * USD of cash at each venue (pivot 14.1), in `VENUE_VALUES` order; `reserved` of it is held for
   * resting orders and collateral (D1037), so `cash - reserved` can be spent.
   */
  cash: { venue: Venue; cash: number; reserved: number }[];
  /** USD: cash and positions at their marks, less any debt (pivot 14.6). */
  net_worth: number;
  positions: PositionRow[];
  /** Open orders, then the latest closed ones. */
  orders: OrderRow[];
  /** Every fill, oldest first. An append list (protocol.ts `APPEND_LISTS`). */
  fills: FillRow[];
  /** Every settlement, oldest first. */
  settlements: SettlementRow[];
  /** Realised gains this tax year and the tax owed on them next April, USD (pivot 14.2). */
  realised_gains: number;
  tax_due: number;
  /** What the player follows (pivot 8.3, 14.4), in the order followed. */
  follows: EntityRef[];
  /** The player's alerts (pivot 14.4), in id order. */
  alert_rules: { id: AlertRuleId; rule: AlertRule }[];
  /** Net worth fell below zero after forced liquidation: the run is over (pivot 14.5). */
  bankrupt: boolean;
}
