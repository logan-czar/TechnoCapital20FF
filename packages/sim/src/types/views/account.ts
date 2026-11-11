// v_account (pivot 14): the player's own money. Cash at each venue, positions, orders, fills, tax
// and what the player follows. All of it is the player's to see. Type only: the builder arrives
// with the player (M2); orders and fills on a book with the exchange (M5). The fills only grow,
// oldest first.

import type { AlertRule, AlertRuleId, OrderSide, TimeInForce, Venue } from "../action.ts";
import type { DateTime } from "../calendar.ts";
import type { InstrumentId, OrderId } from "../ids.ts";
import type { EntityRef } from "./entity.ts";

export interface PositionRow {
  venue: Venue;
  instrument: InstrumentId;
  /** The company or the contract held. */
  what: EntityRef;
  /** Shares or contracts; below 0 once shorting exists (pivot 13.2). Whole number. */
  qty: number;
  /** Per unit, first in first out (pivot 14.2), in the venue's price units. */
  avg_cost: number;
  /** The price it is valued at now. */
  mark: number;
  /** USD. */
  unrealised: number;
}

export type OrderStatus = "Open" | "Filled" | "Cancelled" | "Expired";

export interface OrderRow {
  id: OrderId;
  venue: Venue;
  instrument: InstrumentId;
  what: EntityRef;
  side: OrderSide;
  /** Whole numbers. */
  qty: number;
  filled: number;
  /** Null for a market order. */
  limit: number | null;
  tif: TimeInForce;
  placed: DateTime;
  status: OrderStatus;
}

export interface FillRow {
  order: OrderId;
  time: DateTime;
  /** Whole number. */
  qty: number;
  price: number;
  /** USD (pivot 10.5, 13.1). */
  fee: number;
}

export interface AccountView {
  /** The player exists (false in a Coarse world and before hydration, pivot 3.4). */
  open: boolean;
  /** USD of cash at each venue (pivot 14.1), in `VENUE_VALUES` order. */
  cash: { venue: Venue; cash: number }[];
  /** USD: cash and positions at their marks, less any debt (pivot 14.6). */
  net_worth: number;
  positions: PositionRow[];
  /** Open orders, then the latest closed ones. */
  orders: OrderRow[];
  /** Every fill, oldest first. */
  fills: FillRow[];
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
