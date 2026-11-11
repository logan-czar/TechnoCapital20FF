// The player's books (pivot 13.1, 14.1, 14.2, 14.6; D1042): cash at the two venues, positions as
// FIFO tax lots, the brokerage's fill arithmetic, reserved cash and net worth. Every function here
// changes only `World.player`; it reads the market (prices, shares outstanding) and never writes
// it: the player is a price taker (pivot 13.1).

import { STOCK_INSTRUMENT_BASE, VENUE_VALUES, type Venue } from "../types/action.ts";
import type { DateTime } from "../types/calendar.ts";
import type { CompanyId, InstrumentId } from "../types/ids.ts";
import { trunc } from "../types/num.ts";
import type {
  PlayerAccount,
  PlayerFill,
  PlayerOrder,
  PlayerPosition,
  PlayerState,
  TaxLot,
} from "../types/state/player.ts";
import type { OrderCloseReason, OrderStatus } from "../types/views/account.ts";
import type { World } from "../types/world.ts";
import { ORDERS_CLOSED_KEPT, PLAYER_MAX_STAKE } from "./rules.ts";

// ---------------------------------------------------------------- instruments and prices

/** The company a stock instrument trades (D1037), or null for anything that is not a stock. */
export function stockCompany(world: World, instrument: InstrumentId): CompanyId | null {
  if (!Number.isSafeInteger(instrument)) return null;
  if (instrument < STOCK_INSTRUMENT_BASE || instrument >= 2 * STOCK_INSTRUMENT_BASE) return null;
  const id = instrument - STOCK_INSTRUMENT_BASE;
  return id < world.companies.length ? (id as CompanyId) : null;
}

/** The company's stock is quoted: listed and not delisted (spec 5.12 step 2, D126; pivot 13.1). */
export function stockQuoted(world: World, company: CompanyId): boolean {
  return world.market.stocks[company]?.quoted === true;
}

/** The hourly price P (mvp-spec 5.14), USD a share; $0.00 once delisted. */
export function stockPrice(world: World, company: CompanyId): number {
  return world.market.stocks[company]?.price ?? 0;
}

/** pivot 13.1: the player buys at the hourly price plus `STOCK_SPREAD`. */
export function askPrice(p: PlayerState, price: number): number {
  return price * (1 + p.difficulty.stock_spread);
}

/** pivot 13.1: the player sells at the hourly price less `STOCK_SPREAD`. */
export function bidPrice(p: PlayerState, price: number): number {
  return price * (1 - p.difficulty.stock_spread);
}

/** pivot 1.3: the most shares of `company` the player may hold, `PLAYER_MAX_STAKE` of shares outstanding. */
export function stakeCap(world: World, company: CompanyId): number {
  const c = world.companies[company];
  return c === undefined ? 0 : trunc(PLAYER_MAX_STAKE * c.shares_out);
}

// ---------------------------------------------------------------- accounts and positions

export function accountOf(p: PlayerState, venue: Venue): PlayerAccount {
  const a = p.accounts.find((x) => x.venue === venue);
  if (a === undefined) throw new Error(`the player has no ${venue} account`);
  return a;
}

/** Cash at `venue` not held for resting orders or collateral (D1037). */
export function spendable(p: PlayerState, venue: Venue): number {
  const a = accountOf(p, venue);
  return a.cash - a.reserved;
}

export function positionOf(
  p: PlayerState,
  venue: Venue,
  instrument: InstrumentId,
): PlayerPosition | undefined {
  return p.positions.find((x) => x.venue === venue && x.instrument === instrument);
}

/** A position's quantity: the sum of its lots. */
export function positionQty(pos: PlayerPosition | undefined): number {
  if (pos === undefined) return 0;
  let n = 0;
  for (const l of pos.lots) n += l.qty;
  return n;
}

/** A position's cost, USD: the sum of its lots at their prices (costs included). */
export function positionCost(pos: PlayerPosition): number {
  let c = 0;
  for (const l of pos.lots) c += l.qty * l.price;
  return c;
}

function venueIndex(v: Venue): number {
  return VENUE_VALUES.indexOf(v);
}

/** The position, made empty and put in venue then instrument order if the player had none. */
function positionMake(p: PlayerState, venue: Venue, instrument: InstrumentId): PlayerPosition {
  const have = positionOf(p, venue, instrument);
  if (have !== undefined) return have;
  const pos: PlayerPosition = { venue, instrument, side: "Long", lots: [] };
  let i = 0;
  while (i < p.positions.length) {
    const q = p.positions[i] as PlayerPosition;
    const vi = venueIndex(q.venue) - venueIndex(venue);
    if (vi > 0 || (vi === 0 && q.instrument > instrument)) break;
    i++;
  }
  p.positions.splice(i, 0, pos);
  return pos;
}

function positionDropIfEmpty(p: PlayerState, pos: PlayerPosition): void {
  if (pos.lots.length === 0) p.positions.splice(p.positions.indexOf(pos), 1);
}

// ---------------------------------------------------------------- orders

/** Open orders on `instrument` on `side`, except `except`: their unfilled shares. */
export function openQty(
  p: PlayerState,
  instrument: InstrumentId,
  side: PlayerOrder["side"],
  except?: PlayerOrder,
): number {
  let n = 0;
  for (const o of p.orders) {
    if (o !== except && o.status === "Open" && o.instrument === instrument && o.side === side)
      n += o.qty - o.filled;
  }
  return n;
}

/**
 * Cash an open brokerage buy holds back (D1042): a limit buy its worst cost, `qty × limit +
 * commission` (it fills at an ask at or below its limit); a market buy `qty × ask + commission` at
 * the hour's price, so it follows the price until it fills at the next trading hour. 0 for a sell.
 */
export function reservationOf(world: World, p: PlayerState, o: PlayerOrder): number {
  if (o.status !== "Open" || o.side !== "Buy" || o.venue !== "Brokerage") return 0;
  const company = stockCompany(world, o.instrument);
  const left = o.qty - o.filled;
  const unit = o.limit ?? (company === null ? 0 : askPrice(p, stockPrice(world, company)));
  return left * unit + p.difficulty.commission;
}

/** Sets each account's `reserved` from its open orders (D1037: reserved cash is never spent twice). */
export function reservedRecompute(world: World, p: PlayerState): void {
  for (const a of p.accounts) a.reserved = 0;
  for (const o of p.orders) {
    const r = reservationOf(world, p, o);
    if (r > 0) accountOf(p, o.venue).reserved += r;
  }
}

/** Closes an open order and trims the closed tail to `ORDERS_CLOSED_KEPT`. */
export function orderClose(
  p: PlayerState,
  o: PlayerOrder,
  status: Exclude<OrderStatus, "Open">,
  reason: OrderCloseReason,
  time: DateTime,
): void {
  o.status = status;
  o.reason = reason;
  o.closed = time;
  let closed = 0;
  for (const x of p.orders) if (x.status !== "Open") closed++;
  while (closed > ORDERS_CLOSED_KEPT) {
    const i = p.orders.findIndex((x) => x.status !== "Open");
    p.orders.splice(i, 1);
    closed--;
  }
}

/** A new order's id and row, at the end of `orders` (ids only grow, so the list stays in id order). */
export function orderNew(p: PlayerState, fields: Omit<PlayerOrder, "id">): PlayerOrder {
  const o: PlayerOrder = { id: p.orders_made as PlayerOrder["id"], ...fields };
  p.orders_made += 1;
  p.orders.push(o);
  return o;
}

// ---------------------------------------------------------------- fills

/**
 * Buys `qty` shares on the brokerage at `price` a share for order `o` (pivot 13.1): cash falls by
 * `qty × price + fee`, a lot opens at `(qty × price + fee) ÷ qty` (pivot 14.2: costs included).
 */
export function fillBuy(
  p: PlayerState,
  o: PlayerOrder,
  qty: number,
  price: number,
  fee: number,
  time: DateTime,
): PlayerFill {
  const cost = qty * price + fee;
  accountOf(p, o.venue).cash -= cost;
  const lot: TaxLot = { qty, price: cost / qty, opened: time };
  positionMake(p, o.venue, o.instrument).lots.push(lot);
  return fillRecord(p, o, qty, price, fee, 0, time);
}

/**
 * Sells `qty` shares at `price` for order `o`: proceeds `qty × price − fee` reach the cash, the
 * oldest lots go first (pivot 14.2 FIFO), and the gain over their cost is realised in this tax year.
 */
export function fillSell(
  p: PlayerState,
  o: PlayerOrder,
  qty: number,
  price: number,
  fee: number,
  time: DateTime,
): PlayerFill {
  const pos = positionOf(p, o.venue, o.instrument);
  if (pos === undefined || positionQty(pos) < qty) throw new Error("fillSell: not enough held");
  const proceeds = qty * price - fee;
  let left = qty;
  let basis = 0;
  while (left > 0) {
    const lot = pos.lots[0] as TaxLot;
    const used = lot.qty <= left ? lot.qty : left;
    basis += used * lot.price;
    left -= used;
    if (used === lot.qty) pos.lots.shift();
    else lot.qty -= used;
  }
  positionDropIfEmpty(p, pos);
  accountOf(p, o.venue).cash += proceeds;
  const realised = proceeds - basis;
  p.realised_gains += realised;
  return fillRecord(p, o, qty, price, fee, realised, time);
}

function fillRecord(
  p: PlayerState,
  o: PlayerOrder,
  qty: number,
  price: number,
  fee: number,
  realised: number,
  time: DateTime,
): PlayerFill {
  o.filled += qty;
  const f: PlayerFill = {
    order: o.id,
    time,
    venue: o.venue,
    instrument: o.instrument,
    side: o.side,
    qty,
    price,
    fee,
    realised,
  };
  p.fills.push(f);
  return f;
}

// ---------------------------------------------------------------- net worth

/** A position's mark, in its venue's units: a stock at its hourly price. */
export function positionMark(world: World, pos: PlayerPosition): number {
  const company = stockCompany(world, pos.instrument);
  return company === null ? 0 : stockPrice(world, company);
}

/**
 * Net worth, USD (pivot 14.6, 14.5): cash at both venues and every position at its mark, less the
 * tax owed (`tax_due`, a debt once billed at the year's close).
 */
export function netWorth(world: World, p: PlayerState): number {
  let w = 0;
  for (const a of p.accounts) w += a.cash;
  for (const pos of p.positions) w += positionQty(pos) * positionMark(world, pos);
  return w - p.tax_due;
}
