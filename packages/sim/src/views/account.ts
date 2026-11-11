// v_account's builder slot (D1037), owned by lane P (player): the player's money from
// `World.player` (pivot 14; `open` false while it is null). Rebuilt every tick and after an action.
//
// The fills are an append list (protocol.ts `APPEND_LISTS`): the frame patch sends the rows whose
// object changed, so a fill's row is made once per state fill and kept (`FILL_ROWS`, keyed by the
// state's own fill object, which never changes once made). A load makes new state objects and so
// new rows, which the patch then sends again: right, if more than needed.

import { netWorth, positionCost, positionMark, positionQty } from "../player/book.ts";
import { instrumentTarget } from "../types/action.ts";
import type { PlayerFill, PlayerOrder, PlayerState } from "../types/state/player.ts";
import type { AccountView, FillRow, OrderRow, PositionRow } from "../types/views/account.ts";
import type { ViewBuilder, ViewInput } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyAccount(): AccountView {
  return {
    open: false,
    cash: [],
    net_worth: 0,
    positions: [],
    orders: [],
    fills: [],
    settlements: [],
    realised_gains: 0,
    tax_due: 0,
    follows: [],
    alert_rules: [],
    bankrupt: false,
  };
}

const FILL_ROWS = new WeakMap<PlayerFill, FillRow>();

function fillRow(f: PlayerFill): FillRow {
  let row = FILL_ROWS.get(f);
  if (row === undefined) {
    row = {
      order: f.order,
      time: f.time,
      venue: f.venue,
      instrument: f.instrument,
      what: instrumentTarget(f.instrument),
      side: f.side,
      qty: f.qty,
      price: f.price,
      fee: f.fee,
      realised: f.realised,
    };
    FILL_ROWS.set(f, row);
  }
  return row;
}

function orderRows(p: PlayerState): OrderRow[] {
  // Each order's mean fill price, from the fills (an order fills at most once before the book, but
  // the mean is the rule for M5's partial fills too).
  const sums = new Map<number, { qty: number; value: number }>();
  for (const f of p.fills) {
    const s = sums.get(f.order) ?? { qty: 0, value: 0 };
    s.qty += f.qty;
    s.value += f.qty * f.price;
    sums.set(f.order, s);
  }
  const row = (o: PlayerOrder): OrderRow => {
    const s = sums.get(o.id);
    return {
      id: o.id,
      venue: o.venue,
      instrument: o.instrument,
      what: instrumentTarget(o.instrument),
      side: o.side,
      qty: o.qty,
      filled: o.filled,
      avg_price: s === undefined || s.qty === 0 ? null : s.value / s.qty,
      limit: o.limit,
      tif: o.tif,
      placed: o.placed,
      status: o.status,
      closed: o.closed,
      reason: o.reason,
    };
  };
  // Open orders first, then the closed ones kept, each oldest first.
  return [...p.orders.filter((o) => o.status === "Open"), ...p.orders.filter((o) => o.status !== "Open")].map(
    row,
  );
}

/** v_account from the state (pivot 14). */
export function buildAccount(input: ViewInput): AccountView {
  const world = input.world;
  const p = world.player;
  if (p === null) return emptyAccount();
  const positions: PositionRow[] = p.positions.map((pos) => {
    const qty = positionQty(pos);
    const cost = positionCost(pos);
    const mark = positionMark(world, pos);
    return {
      venue: pos.venue,
      instrument: pos.instrument,
      what: instrumentTarget(pos.instrument),
      side: pos.side,
      qty,
      avg_cost: qty > 0 ? cost / qty : 0,
      mark,
      unrealised: qty * mark - cost,
      collateral: 0,
    };
  });
  return {
    open: true,
    cash: p.accounts.map((a) => ({ venue: a.venue, cash: a.cash, reserved: a.reserved })),
    net_worth: netWorth(world, p),
    positions,
    orders: orderRows(p),
    fills: p.fills.map(fillRow),
    settlements: p.settlements.map((s) => ({ ...s })),
    realised_gains: p.realised_gains,
    tax_due: p.tax_due,
    follows: p.follows.map((f) => ({ ...f })),
    alert_rules: p.alerts.map((a) => ({ id: a.id, rule: structuredClone(a.rule) })),
    bankrupt: p.bankrupt,
  };
}

/** v_account's slot in `VIEW_BUILDERS`. */
export const accountBuilder: ViewBuilder<AccountView> = {
  rust: "(none: pivot 14)",
  empty: emptyAccount,
  build: buildAccount,
};
