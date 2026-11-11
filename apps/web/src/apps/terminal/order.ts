// The order ticket's arithmetic (pivot 13.1, 1.3, 14.1): what a stock order is estimated to cost,
// how much of a company the player may still hold, and which inputs make an order the sim cannot
// read. The sim decides whether an order is allowed (a refusal comes back as an `ActError`); this
// only helps the player see it coming.

import type { AccountView, FillRow, OrderSide, TimeInForce } from "@tc20ff/sim";

/** The most of any company's shares the player may hold (pivot 1.3 `PLAYER_MAX_STAKE`). */
export const PLAYER_MAX_STAKE = 0.05;

export type OrderType = "Market" | "Limit";

/** The ticket as typed. Numbers are the text fields' values; blank or unreadable is NaN. */
export interface TicketInput {
  side: OrderSide;
  qty: number;
  type: OrderType;
  limit: number;
  tif: TimeInForce;
}

/** The limit an order is sent with: null for a market order. */
export function limitOf(t: TicketInput): number | null {
  return t.type === "Limit" ? t.limit : null;
}

/** Why the ticket cannot be sent at all (a quantity or price the sim would call malformed), or null. */
export function inputProblem(t: TicketInput): string | null {
  if (!Number.isInteger(t.qty) || t.qty <= 0) return "Quantity is a whole number of shares, 1 or more.";
  if (t.type === "Limit" && !(t.limit > 0)) return "A limit order needs a limit price above 0.";
  return null;
}

/** The company's shares, from the quote's market cap over its price (v_quotes: `last × shares`). */
export function sharesOf(marketCap: number, last: number): number | null {
  return last > 0 && marketCap > 0 ? Math.round(marketCap / last) : null;
}

export interface Cap {
  /** Whole shares the player may hold: 5% of the company, rounded down. */
  cap: number;
  held: number;
  /** Shares that may still be bought. */
  room: number;
}

export function capOf(shares: number | null, held: number): Cap | null {
  if (shares === null) return null;
  const cap = Math.floor(PLAYER_MAX_STAKE * shares);
  return { cap, held, room: Math.max(0, cap - held) };
}

/** The commission of the latest brokerage fill that charged one (the views do not state the rate). */
export function lastCommission(fills: readonly FillRow[]): number | null {
  for (let i = fills.length - 1; i >= 0; i--) {
    const f = fills[i] as FillRow;
    if (f.venue === "Brokerage" && f.fee > 0) return f.fee;
  }
  return null;
}

export interface Estimate {
  /** USD a share the estimate is made at: the quote. */
  price: number;
  /** qty × price. */
  gross: number;
  /** USD, as last charged; null before the player has traded a stock. */
  commission: number | null;
  /** Cash out (a buy) or in (a sell): the gross with the commission, if known, applied. */
  total: number;
}

/**
 * pivot 13.1: the brokerage fills at the hourly price plus a spread and a commission. v_account
 * and v_quotes publish neither rate, so the estimate is the quote and the commission last charged;
 * the spread is added at the fill.
 */
export function estimate(side: OrderSide, qty: number, price: number, commission: number | null): Estimate {
  const gross = qty * price;
  const fee = commission ?? 0;
  return { price, gross, commission, total: side === "Buy" ? gross + fee : gross - fee };
}

/** Cash at the brokerage the player can spend: cash less what is reserved. */
export function freeBrokerageCash(a: AccountView): number {
  const c = a.cash.find((x) => x.venue === "Brokerage");
  return c === undefined ? 0 : Math.max(0, c.cash - c.reserved);
}

/** Warnings the ticket shows beside the estimate; the order may still be sent and the sim decide. */
export function warnings(
  side: OrderSide,
  qty: number,
  est: Estimate | null,
  cap: Cap | null,
  free: number,
): string[] {
  const out: string[] = [];
  if (!Number.isInteger(qty) || qty <= 0) return out;
  if (side === "Buy") {
    if (cap !== null && qty > cap.room)
      out.push(`Over the 5% holding cap: room for ${cap.room} more shares.`);
    if (est !== null && est.total > free) out.push("More than the free cash at the brokerage.");
  } else {
    const held = cap?.held ?? 0;
    if (qty > held) out.push(`The brokerage is long only: you hold ${held} shares.`);
  }
  return out;
}
