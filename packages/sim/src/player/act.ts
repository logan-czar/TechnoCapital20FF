// Player actions (pivot 1.2, 1.3, 13.1, 14.1, 14.4; D1027, D1037, D1042): `playerAct` checks one
// `PlayerAction`, applies it to `World.player` between ticks and records it with the clock for
// replay. A refused action changes nothing and is not recorded. An action never touches anything
// outside `World.player`.
//
// Orders (pivot 13.1, before the stock book): a brokerage order on a quoted stock rests until the
// next trading hour (player/jobs.ts `fillOrders` has the fill rule). It is long only: a buy may not
// take the holding plus open buys past `PLAYER_MAX_STAKE` of shares outstanding (pivot 1.3), and
// its cost (`reservationOf`) must fit the brokerage's spendable cash, which it then reserves; a
// sell may not exceed what is held less the open sells. The exchange's orders are M5's.

import type { ActError, AlertRule, PlayerAction, Venue } from "../types/action.ts";
import { PLAYER_ACTION_KINDS, VENUE_VALUES } from "../types/action.ts";
import type { InstrumentId } from "../types/ids.ts";
import type { PlayerOrder, PlayerState } from "../types/state/player.ts";
import type { EntityRef } from "../types/views/entity.ts";
import { ENTITY_KIND_VALUES } from "../types/views/entity.ts";
import type { Result, World } from "../types/world.ts";
import {
  accountOf,
  openQty,
  orderClose,
  orderNew,
  positionOf,
  positionQty,
  reservationOf,
  reservedRecompute,
  spendable,
  stakeCap,
  stockCompany,
  stockQuoted,
} from "./book.ts";

function invalid(message: string): Result<never, ActError> {
  return { ok: false, error: { kind: "Invalid", message } };
}

function rejected(message: string): Result<never, ActError> {
  return { ok: false, error: { kind: "Rejected", message } };
}

const OK: Result<true, ActError> = { ok: true, value: true };

/** A whole number above 0 that a share count can be. */
function isCount(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0;
}

/** A finite USD amount or price above 0. */
function isPositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isVenue(v: unknown): v is Venue {
  return (VENUE_VALUES as readonly unknown[]).includes(v);
}

/** The kinds the player may follow (pivot 8.3 handles; 14.4 people, races, bills and tickers). */
const FOLLOW_KINDS: readonly EntityRef["kind"][] = ["Person", "Race", "Bill", "Company", "Handle"];

/**
 * An `EntityRef` the player may follow or set an alert on. A company must exist; the other kinds'
 * tables fill over M2 to M5, so any whole-number id is taken (D1042).
 */
function refCheck(world: World, r: EntityRef, kinds: readonly EntityRef["kind"][]): string | null {
  if (typeof r !== "object" || r === null || !(ENTITY_KIND_VALUES as readonly unknown[]).includes(r.kind)) {
    return "not an entity";
  }
  if (!kinds.includes(r.kind)) return `a ${r.kind} cannot be followed`;
  if (!Number.isSafeInteger(r.id) || r.id < 0) return `bad ${r.kind} id ${r.id}`;
  if (r.kind === "Company" && r.id >= world.companies.length) return `no company ${r.id}`;
  return null;
}

function refEq(a: EntityRef, b: EntityRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** A plain copy of an action (it is kept in the log, so a caller's later edits cannot reach it). */
function actionCopy(a: PlayerAction): PlayerAction {
  return JSON.parse(JSON.stringify(a)) as PlayerAction;
}

/**
 * Checks and applies `action` (D1027). `Ok(true)` applied and to be recorded; `Ok(false)` accepted
 * but changes nothing (a `NotificationsRead` below the mark), so not recorded.
 */
function apply(world: World, p: PlayerState, action: PlayerAction): Result<boolean, ActError> {
  if (p.bankrupt && action.kind !== "NotificationsRead") return rejected("the run has ended (pivot 14.5)");
  switch (action.kind) {
    case "PlaceOrder":
      return placeOrder(world, p, action);
    case "CancelOrder": {
      const o = p.orders.find((x) => x.id === action.order);
      if (o === undefined) return invalid(`no order ${action.order}`);
      if (o.status !== "Open") return rejected(`order ${action.order} is not open`);
      orderClose(p, o, "Cancelled", "Cancelled", world.clock);
      reservedRecompute(world, p);
      return OK;
    }
    case "Transfer": {
      if (!isVenue(action.from) || !isVenue(action.to)) return invalid("not a venue");
      if (action.from === action.to) return invalid("a transfer needs two venues");
      if (!isPositive(action.amount)) return invalid(`bad amount ${action.amount}`);
      if (action.amount > spendable(p, action.from)) return rejected(`not enough cash at the ${action.from}`);
      accountOf(p, action.from).cash -= action.amount;
      accountOf(p, action.to).cash += action.amount;
      return OK;
    }
    case "Follow": {
      const bad = refCheck(world, action.target, FOLLOW_KINDS);
      if (bad !== null) return invalid(bad);
      if (p.follows.some((f) => refEq(f, action.target))) return rejected("already followed");
      p.follows.push({ kind: action.target.kind, id: action.target.id });
      return OK;
    }
    case "Unfollow": {
      const i = p.follows.findIndex((f) => refEq(f, action.target));
      if (i < 0) return invalid("not followed");
      p.follows.splice(i, 1);
      return OK;
    }
    case "AlertRuleAdd":
      return alertAdd(world, p, action.rule);
    case "AlertRuleRemove": {
      const i = p.alerts.findIndex((a) => a.id === action.rule);
      if (i < 0) return invalid(`no alert ${action.rule}`);
      p.alerts.splice(i, 1);
      return OK;
    }
    case "NotificationsRead": {
      const t = action.through;
      if (!Number.isSafeInteger(t) || t < -1 || t >= p.notifications.length)
        return invalid(`no notification ${t}`);
      if (t <= p.read_through) return { ok: true, value: false };
      p.read_through = t;
      return OK;
    }
  }
}

function placeOrder(
  world: World,
  p: PlayerState,
  a: Extract<PlayerAction, { kind: "PlaceOrder" }>,
): Result<boolean, ActError> {
  if (!isVenue(a.venue)) return invalid("not a venue");
  // The exchange's books, cohorts and contracts are M5's (pivot 10, 11).
  if (a.venue === "Exchange") return { ok: false, error: { kind: "NotAvailable", action: "PlaceOrder" } };
  if (a.side !== "Buy" && a.side !== "Sell") return invalid(`bad side ${String(a.side)}`);
  if (a.tif !== "Day" && a.tif !== "Gtc") return invalid(`bad time in force ${String(a.tif)}`);
  if (!isCount(a.qty)) return invalid(`bad quantity ${a.qty}`);
  if (a.limit !== null && !isPositive(a.limit)) return invalid(`bad limit ${a.limit}`);
  const company = stockCompany(world, a.instrument as InstrumentId);
  if (company === null) return invalid(`instrument ${a.instrument} is not a stock`);
  if (!stockQuoted(world, company)) return rejected("the company is not listed");
  const instrument = a.instrument as InstrumentId;
  const order: Omit<PlayerOrder, "id"> = {
    venue: "Brokerage",
    instrument,
    side: a.side,
    qty: a.qty,
    filled: 0,
    limit: a.limit,
    tif: a.tif,
    placed: world.clock,
    status: "Open",
    closed: null,
    reason: null,
  };
  const held = positionQty(positionOf(p, "Brokerage", instrument));
  if (a.side === "Buy") {
    // pivot 1.3: what is held, what open buys would add and this order, under the cap.
    if (held + openQty(p, instrument, "Buy") + a.qty > stakeCap(world, company)) {
      return rejected("over the 5% limit of the company's shares (pivot 1.3)");
    }
    const need = reservationOf(world, p, { id: 0 as PlayerOrder["id"], ...order });
    if (need > spendable(p, "Brokerage")) return rejected("not enough cash at the brokerage");
  } else if (a.qty > held - openQty(p, instrument, "Sell")) {
    return rejected("long only: not enough shares held (pivot 13.1)");
  }
  orderNew(p, order);
  reservedRecompute(world, p);
  return OK;
}

function alertAdd(world: World, p: PlayerState, rule: AlertRule): Result<boolean, ActError> {
  if (typeof rule !== "object" || rule === null || typeof rule.pause !== "boolean")
    return invalid("bad rule");
  const bad = refCheck(world, rule.target, [...FOLLOW_KINDS, "Contract"]);
  if (bad !== null) return invalid(bad);
  const w = rule.when;
  if (w?.kind === "PriceAbove" || w?.kind === "PriceBelow") {
    if (!isPositive(w.price)) return invalid(`bad price ${w.price}`);
    // Contracts trade from M5; a price alert needs a ticker until then.
    if (rule.target.kind !== "Company") {
      return rejected("a price alert needs a company until the exchange opens (M5)");
    }
  } else if (w?.kind !== "Any") {
    return invalid("bad alert condition");
  }
  const copy = JSON.parse(JSON.stringify(rule)) as AlertRule;
  p.alerts.push({ id: p.alerts_made, rule: copy });
  p.alerts_made += 1;
  return OK;
}

/**
 * pivot 16.1, D1027: applies an action between ticks and records it at `world.clock`. With no
 * player (a Coarse world, or one not yet hydrated) every action is `NotAvailable`.
 */
export function act(world: World, action: PlayerAction): Result<boolean, ActError> {
  const p = world.player;
  if (p === null) return { ok: false, error: { kind: "NotAvailable", action: action.kind } };
  if (
    typeof action !== "object" ||
    action === null ||
    !(PLAYER_ACTION_KINDS as readonly unknown[]).includes(action.kind)
  ) {
    return invalid("not an action");
  }
  const r = apply(world, p, action);
  if (r.ok && r.value) p.actions.push({ at: world.clock, action: actionCopy(action) });
  return r;
}
