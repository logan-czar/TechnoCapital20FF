// The mock's player account (v_account, v_notifications; pivot 10.5, 13.1, 14): cash at the
// brokerage and the betting exchange, positions with first-in-first-out cost, orders, fills, tax,
// follows and alert rules. The bookkeeping only: orders meet the book and the script in ../pivot.ts.
//
// Contract prices are whole cents and a contract pays $1 (pivot 10.1). Selling Yes with none held
// is buying No at 100 minus the price (pivot 10.5): the mock shows that as a negative `qty` whose
// collateral has left the cash.

import {
  type AccountView,
  type AlertRule,
  type AlertRuleId,
  type CompanyId,
  type ContractId,
  type DateTime,
  type EntityRef,
  type FillRow,
  type InstrumentId,
  type NotificationKind,
  type NotificationRow,
  type NotificationsView,
  type OrderId,
  type OrderRow,
  type OrderSide,
  type PositionRow,
  VENUE_VALUES,
  type Venue,
} from "@tc20ff/sim";

/** Starting cash (pivot 3.6 `START_CASH`), all of it at the brokerage. */
export const START_CASH = 50_000;
/** The fee on a contract's winnings (pivot 10.5 `BET_FEE`; a mock number). */
export const BET_FEE = 0.02;
/** The spread and the commission on a stock order (pivot 13.1 `STOCK_SPREAD`; mock numbers). */
export const STOCK_SPREAD = 0.001;
export const STOCK_COMMISSION = 1;
/** The most of a company the player may hold (pivot 1.3 `PLAYER_MAX_STAKE`). */
export const PLAYER_MAX_STAKE = 0.05;
/** The rate on realised gains (pivot 14.2 `gains_tax`; a mock number). */
export const GAINS_TAX = 0.2;
/**
 * A stock's instrument is this plus its company id; a contract's is its contract id. No view says
 * how a company maps to an instrument yet (README, contract requests), so the mock fixes it here.
 */
export const STOCK_INSTRUMENT_BASE = 1_000_000;
/** Closed orders the view keeps after the open ones. */
const CLOSED_ORDERS_SHOWN = 20;

export const stockInstrument = (c: CompanyId): InstrumentId => (STOCK_INSTRUMENT_BASE + c) as InstrumentId;
export const contractInstrument = (c: ContractId): InstrumentId => c as number as InstrumentId;

/** What an instrument is, from its number. */
export function instrumentRef(i: InstrumentId): EntityRef {
  return i >= STOCK_INSTRUMENT_BASE
    ? { kind: "Company", id: i - STOCK_INSTRUMENT_BASE }
    : { kind: "Contract", id: i };
}

export interface Position {
  venue: Venue;
  instrument: InstrumentId;
  /** Signed: below zero is the No side of a contract. */
  qty: number;
  /** Per unit: cents for a contract, USD for a share. */
  avg_cost: number;
}

export interface AccountState {
  open: boolean;
  cash: Record<Venue, number>;
  positions: Position[];
  orders: OrderRow[];
  fills: FillRow[];
  realised: number;
  follows: EntityRef[];
  rules: { id: AlertRuleId; rule: AlertRule; armed: boolean }[];
  next_rule: number;
  notifications: NotificationRow[];
}

export function newAccount(): AccountState {
  return {
    open: false,
    cash: { Brokerage: 0, Exchange: 0 },
    positions: [],
    orders: [],
    fills: [],
    realised: 0,
    follows: [],
    rules: [],
    next_rule: 0,
    notifications: [],
  };
}

export const sameRef = (a: EntityRef, b: EntityRef): boolean => a.kind === b.kind && a.id === b.id;

export function positionOf(a: AccountState, instrument: InstrumentId): Position | undefined {
  return a.positions.find((p) => p.instrument === instrument);
}

function position(a: AccountState, venue: Venue, instrument: InstrumentId): Position {
  let p = positionOf(a, instrument);
  if (p === undefined) {
    p = { venue, instrument, qty: 0, avg_cost: 0 };
    a.positions.push(p);
  }
  return p;
}

function drop(a: AccountState): void {
  a.positions = a.positions.filter((p) => p.qty !== 0);
}

/**
 * The exchange cash an order for `qty` at `price` cents ties up (pivot 10.5): the price of what it
 * adds to a Yes holding, or 100 minus the price of what it adds to a No holding. The part that
 * closes a holding ties up nothing.
 */
export function contractCost(held: number, side: OrderSide, qty: number, price: number): number {
  if (side === "Buy") return (Math.max(0, qty - Math.max(0, -held)) * price) / 100;
  return (Math.max(0, qty - Math.max(0, held)) * (100 - price)) / 100;
}

/** The exchange cash the player's open orders already tie up. */
export function reserved(a: AccountState): number {
  let sum = 0;
  for (const o of a.orders) {
    if (o.status !== "Open" || o.venue !== "Exchange" || o.limit === null) continue;
    sum += contractCost(positionOf(a, o.instrument)?.qty ?? 0, o.side, o.qty - o.filled, o.limit);
  }
  return sum;
}

function recordFill(
  a: AccountState,
  o: OrderRow,
  t: DateTime,
  qty: number,
  price: number,
  fee: number,
): FillRow {
  const i = a.orders.findIndex((x) => x.id === o.id);
  const filled = o.filled + qty;
  const next: OrderRow = { ...o, filled, status: filled >= o.qty ? "Filled" : o.status };
  if (i >= 0) a.orders[i] = next;
  const f: FillRow = { order: o.id, time: t, qty, price, fee };
  a.fills.push(f);
  return f;
}

/** Books a fill of a contract order at `price` cents (pivot 10.5, 14.2). Returns the updated order. */
export function fillContract(
  a: AccountState,
  order: OrderRow,
  t: DateTime,
  qty: number,
  price: number,
): OrderRow {
  const p = position(a, "Exchange", order.instrument);
  let left = qty;
  if (order.side === "Buy") {
    // First close any No side: buying the Yes back pairs with it and the pair pays $1.
    const cover = Math.min(left, Math.max(0, -p.qty));
    if (cover > 0) {
      a.cash.Exchange += (cover * (100 - price)) / 100;
      a.realised += (cover * (p.avg_cost - price)) / 100;
      p.qty += cover;
      left -= cover;
    }
    if (left > 0) {
      a.cash.Exchange -= (left * price) / 100;
      p.avg_cost = (p.avg_cost * p.qty + price * left) / (p.qty + left);
      p.qty += left;
    }
  } else {
    const close = Math.min(left, Math.max(0, p.qty));
    if (close > 0) {
      a.cash.Exchange += (close * price) / 100;
      a.realised += (close * (price - p.avg_cost)) / 100;
      p.qty -= close;
      left -= close;
    }
    if (left > 0) {
      a.cash.Exchange -= (left * (100 - price)) / 100;
      p.avg_cost = (p.avg_cost * -p.qty + price * left) / (-p.qty + left);
      p.qty -= left;
    }
  }
  recordFill(a, order, t, qty, price, 0);
  drop(a);
  return a.orders.find((x) => x.id === order.id) as OrderRow;
}

/** Books a stock fill at `price` USD a share, the spread included, plus the commission (pivot 13.1). */
export function fillStock(a: AccountState, order: OrderRow, t: DateTime, price: number): void {
  const p = position(a, "Brokerage", order.instrument);
  if (order.side === "Buy") {
    a.cash.Brokerage -= order.qty * price + STOCK_COMMISSION;
    p.avg_cost = (p.avg_cost * p.qty + price * order.qty) / (p.qty + order.qty);
    p.qty += order.qty;
  } else {
    a.cash.Brokerage += order.qty * price - STOCK_COMMISSION;
    a.realised += order.qty * (price - p.avg_cost);
    p.qty -= order.qty;
  }
  a.realised -= STOCK_COMMISSION;
  recordFill(a, order, t, order.qty, price, STOCK_COMMISSION);
  drop(a);
}

/**
 * Settles the player's holding of a resolved contract (pivot 10.1, 10.4, 10.5): $1 a contract on
 * the winning side, less `BET_FEE` of the winnings. Null when the player holds none.
 */
export function settle(
  a: AccountState,
  instrument: InstrumentId,
  outcome: boolean,
): { payout: number; fee: number; gain: number } | null {
  const p = positionOf(a, instrument);
  if (p === undefined || p.qty === 0) return null;
  const yes = p.qty > 0;
  const n = Math.abs(p.qty);
  const cost = (n * (yes ? p.avg_cost : 100 - p.avg_cost)) / 100;
  const payout = yes === outcome ? n : 0;
  const fee = BET_FEE * Math.max(0, payout - cost);
  a.cash.Exchange += payout - fee;
  a.realised += payout - fee - cost;
  p.qty = 0;
  drop(a);
  return { payout, fee, gain: payout - fee - cost };
}

export function notify(
  a: AccountState,
  t: DateTime,
  kind: NotificationKind,
  text: string,
  refs: EntityRef[],
  paused: boolean,
  rule: AlertRuleId | null = null,
): NotificationRow {
  const n: NotificationRow = { id: a.notifications.length, time: t, kind, text, refs, rule, paused };
  a.notifications.push(n);
  return n;
}

/** v_account. `mark` gives an instrument's price now, in its venue's units. */
export function accountView(a: AccountState, mark: (i: InstrumentId) => number): AccountView {
  if (!a.open) {
    return {
      open: false,
      cash: [],
      net_worth: 0,
      positions: [],
      orders: [],
      fills: [],
      realised_gains: 0,
      tax_due: 0,
      follows: [],
      alert_rules: [],
      bankrupt: false,
    };
  }
  let worth = a.cash.Brokerage + a.cash.Exchange;
  const positions: PositionRow[] = a.positions.map((p) => {
    const m = mark(p.instrument);
    const unit = p.venue === "Exchange" ? 0.01 : 1;
    // A No side is worth 100 minus the price a contract (pivot 10.5).
    worth += p.venue === "Exchange" && p.qty < 0 ? -p.qty * (100 - m) * unit : p.qty * m * unit;
    return {
      venue: p.venue,
      instrument: p.instrument,
      what: instrumentRef(p.instrument),
      qty: p.qty,
      avg_cost: p.avg_cost,
      mark: m,
      unrealised: p.qty * (m - p.avg_cost) * unit,
    };
  });
  const open = a.orders.filter((o) => o.status === "Open");
  const closed = a.orders
    .filter((o) => o.status !== "Open")
    .slice(-CLOSED_ORDERS_SHOWN)
    .reverse();
  return {
    open: true,
    cash: VENUE_VALUES.map((venue) => ({ venue, cash: a.cash[venue] })),
    net_worth: worth,
    positions,
    orders: [...open, ...closed],
    fills: a.fills.slice(),
    realised_gains: a.realised,
    tax_due: Math.max(0, a.realised) * GAINS_TAX,
    follows: a.follows.slice(),
    alert_rules: a.rules.map((r) => ({ id: r.id, rule: r.rule })),
    bankrupt: false,
  };
}

export function notificationsView(a: AccountState): NotificationsView {
  return { items: a.notifications.slice() };
}

export function newOrder(
  a: AccountState,
  t: DateTime,
  venue: Venue,
  instrument: InstrumentId,
  side: OrderSide,
  qty: number,
  limit: number | null,
  tif: OrderRow["tif"],
): OrderRow {
  const o: OrderRow = {
    id: a.orders.length as OrderId,
    venue,
    instrument,
    what: instrumentRef(instrument),
    side,
    qty,
    filled: 0,
    limit,
    tif,
    placed: t,
    status: "Open",
  };
  a.orders.push(o);
  return o;
}

export function closeOrder(a: AccountState, id: OrderId, status: "Cancelled" | "Expired"): void {
  const i = a.orders.findIndex((o) => o.id === id);
  const o = a.orders[i];
  if (o !== undefined && o.status === "Open") a.orders[i] = { ...o, status };
}
