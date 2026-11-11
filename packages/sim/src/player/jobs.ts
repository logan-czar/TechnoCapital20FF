// The player's jobs (pivot 13.1, 14.2 to 14.5, 2.4; D1042), registered `{ fidelity: "Full" }` by
// player/index.ts `registerPlayerJobs`. They draw nothing and change only `World.player`.
//
// HourlyPlayer (every tick, after the hour's price is set and before the alerts):
// 1. Dividends: the hour after a plan lock (00:00 on the 9th of a quarter's first month), each held
//    stock pays `qty × dividend ÷ shares_out`, the dividend being what the company paid at that lock
//    (finance/jobs.ts `payDividend`, still in `finance.pending.dividends` until the 1st's ledger).
//    The player's shares are not on the cap table (a price taker), so the company pays nothing more.
// 2. Delistings: a held stock that is no longer quoted (a bankruptcy, spec 5.12 step 2) is settled
//    at its price, $0.00, with no fee; its open orders close as `MarketClosed`.
// 3. Fills (the fill rule, pivot 13.1): on every hour the share prices are set (slot SharePrices:
//    every hour except 1 January and the release tick, when prices do not move), each open
//    brokerage order, oldest first, meets the hour's price P. A buy fills at the ask `P × (1 +
//    STOCK_SPREAD)` if it is a market order or the ask is at or below its limit; a sell at the bid
//    `P × (1 − STOCK_SPREAD)` if market or the bid is at or above its limit. The whole order fills
//    at once, plus one commission, or not at all. A buy that would take the holding past
//    `PLAYER_MAX_STAKE` (pivot 1.3), or cost more than the cash its own reservation and the free
//    cash cover, closes `Rejected`; so does a sell of more than is held. Orders placed between ticks
//    therefore fill at the next trading hour's price, never the one they saw.
// 4. Price alerts (pivot 14.4): a rule on a quoted company fires the first hour its price is at or
//    above (`PriceAbove`) or at or below (`PriceBelow`) its level, notifies, pauses if set to, and
//    is removed (a price alert fires once).
//
// DailyPlayer (00:00, after the news):
// 1. Interest (pivot 14.3) on each venue's cash for the day just ended: `cash × max(policy rate −
//    CASH_RATE_SPREAD, 0) ÷ days in that year`, the policy rate being `World.base_rate`.
// 2. On 1 January the tax year closes (pivot 14.2): `tax_due += gains_tax × max(net realised, 0) +
//    income_tax × interest`, at the levers then. A net loss carries forward: the new year's
//    realised gains start at it. Dividends count as realised gains (taxed at `gains_tax`).
// 3. Day orders placed before today expire.
// 4. On 15 April the bill is paid from cash, the brokerage first. If the cash is short, every open
//    order is cancelled and the positions are sold at the bid, in instrument order, until it is
//    covered (a `Tax` notice on the `MarginCall` fixed pause); if all of it cannot pay, the run ends
//    (pivot 14.5, a `Bankruptcy` notice): the player is bankrupt from that day.

import { dateTimeMidnight, daysInYear, simDateAddDays } from "../time/calendar.ts";
import {
  type JobCtx,
  slotIsDue,
  type TickFacts,
  tickFactsIsLockTick,
  tickFactsNew,
} from "../time/scheduler.ts";
import { instrumentTarget } from "../types/action.ts";
import type { CompanyId } from "../types/ids.ts";
import { maxF, minF } from "../types/num.ts";
import type { PlayerOrder, PlayerState } from "../types/state/player.ts";
import type { World } from "../types/world.ts";
import {
  accountOf,
  askPrice,
  bidPrice,
  fillBuy,
  fillSell,
  netWorth,
  orderClose,
  orderNew,
  positionOf,
  positionQty,
  reservationOf,
  reservedRecompute,
  stakeCap,
  stockCompany,
  stockPrice,
  stockQuoted,
} from "./book.ts";
import { notify, usd } from "./notify.ts";
import { CASH_RATE_SPREAD, TAX_BILL_DAY, TAX_BILL_MONTH } from "./rules.ts";

/** The player is playing: opened, and the run not ended (pivot 14.5). */
function live(world: World): PlayerState | null {
  const p = world.player;
  return p === null || p.bankrupt ? null : p;
}

function companyLabel(world: World, company: CompanyId): string {
  const c = world.companies[company];
  if (c === undefined) return `company ${company}`;
  return c.ticker !== "" ? c.ticker : c.name;
}

// ---------------------------------------------------------------- hourly

/** The hour after a plan lock: the lock's dividends are paid (see the file comment). */
export function isDividendHour(f: TickFacts): boolean {
  return f.now > 0 && tickFactsIsLockTick(tickFactsNew(f.now - 1));
}

/** The hour's price was set: the share price slot ran (pivot 13.1 fills; spec 4.1 step 2). */
export function marketTrades(f: TickFacts): boolean {
  return slotIsDue("SharePrices", f);
}

function payDividends(world: World, p: PlayerState): void {
  for (const pos of p.positions) {
    if (pos.venue !== "Brokerage") continue;
    const company = stockCompany(world, pos.instrument);
    if (company === null) continue;
    const c = world.companies[company];
    if (c === undefined || c.shares_out <= 0) continue;
    const paid = c.finance.pending.dividends;
    if (paid <= 0) continue;
    const amount = (positionQty(pos) * paid) / c.shares_out;
    accountOf(p, "Brokerage").cash += amount;
    p.realised_gains += amount;
  }
}

/** A sell of everything held of `pos`'s stock at `price`, through an order of its own. */
function sellAll(
  p: PlayerState,
  instrument: PlayerOrder["instrument"],
  price: number,
  fee: number,
  time: number,
  reason: "Filled" | "MarketClosed",
): number {
  const held = positionQty(positionOf(p, "Brokerage", instrument));
  const o = orderNew(p, {
    venue: "Brokerage",
    instrument,
    side: "Sell",
    qty: held,
    filled: 0,
    limit: null,
    tif: "Gtc",
    placed: time,
    status: "Open",
    closed: null,
    reason: null,
  });
  const f = fillSell(p, o, held, price, fee, time);
  orderClose(p, o, "Filled", reason, time);
  return f.realised;
}

function settleDelisted(world: World, p: PlayerState, ctx: JobCtx): void {
  const now = ctx.facts.now;
  for (const o of [...p.orders]) {
    if (o.status !== "Open") continue;
    const company = stockCompany(world, o.instrument);
    if (company !== null && !stockQuoted(world, company)) orderClose(p, o, "Cancelled", "MarketClosed", now);
  }
  for (const pos of [...p.positions]) {
    if (pos.venue !== "Brokerage") continue;
    const company = stockCompany(world, pos.instrument);
    if (company === null || stockQuoted(world, company)) continue;
    const qty = positionQty(pos);
    const price = stockPrice(world, company);
    const realised = sellAll(p, pos.instrument, price, 0, now, "MarketClosed");
    notify(p, ctx, now, {
      kind: "Holding",
      text: `${companyLabel(world, company)} was delisted: ${qty} shares settled at ${usd(price)}, ${usd(realised)} realised`,
      refs: [instrumentTarget(pos.instrument)],
      paused: true,
      fixed: "Holding",
    });
  }
}

/** Cash at the brokerage not held for the open orders other than `o`. */
function freeCashFor(world: World, p: PlayerState, o: PlayerOrder): number {
  let held = 0;
  for (const x of p.orders) if (x !== o && x.venue === "Brokerage") held += reservationOf(world, p, x);
  return accountOf(p, "Brokerage").cash - held;
}

function fillOrders(world: World, p: PlayerState, ctx: JobCtx): void {
  const now = ctx.facts.now;
  const fee = p.difficulty.commission;
  for (const o of [...p.orders]) {
    if (o.status !== "Open" || o.venue !== "Brokerage") continue;
    const company = stockCompany(world, o.instrument);
    if (company === null || !stockQuoted(world, company)) continue;
    const qty = o.qty - o.filled;
    const pos = positionOf(p, "Brokerage", o.instrument);
    let price: number;
    if (o.side === "Buy") {
      price = askPrice(p, stockPrice(world, company));
      if (o.limit !== null && price > o.limit) continue;
      if (positionQty(pos) + qty > stakeCap(world, company) || qty * price + fee > freeCashFor(world, p, o)) {
        orderClose(p, o, "Cancelled", "Rejected", now);
        continue;
      }
      fillBuy(p, o, qty, price, fee, now);
    } else {
      price = bidPrice(p, stockPrice(world, company));
      if (o.limit !== null && price < o.limit) continue;
      if (positionQty(pos) < qty) {
        orderClose(p, o, "Cancelled", "Rejected", now);
        continue;
      }
      fillSell(p, o, qty, price, fee, now);
    }
    orderClose(p, o, "Filled", "Filled", now);
    notify(p, ctx, now, {
      kind: "Fill",
      text: `${o.side === "Buy" ? "Bought" : "Sold"} ${qty} ${companyLabel(world, company)} at ${usd(price)}`,
      refs: [instrumentTarget(o.instrument)],
      paused: true,
      fixed: "OwnFill",
    });
  }
}

function priceAlerts(world: World, p: PlayerState, ctx: JobCtx): void {
  const now = ctx.facts.now;
  for (const a of [...p.alerts]) {
    const w = a.rule.when;
    if (w.kind === "Any" || a.rule.target.kind !== "Company") continue;
    const company = a.rule.target.id as CompanyId;
    if (!stockQuoted(world, company)) continue;
    const price = stockPrice(world, company);
    const hit = w.kind === "PriceAbove" ? price >= w.price : price <= w.price;
    if (!hit) continue;
    notify(p, ctx, now, {
      kind: "Alert",
      text: `${companyLabel(world, company)} is at ${usd(price)}, ${w.kind === "PriceAbove" ? "at or above" : "at or below"} ${usd(w.price)}`,
      refs: [a.rule.target],
      rule: a.id,
      paused: a.rule.pause,
      fixed: null,
    });
    p.alerts.splice(p.alerts.indexOf(a), 1);
  }
}

/** HourlyPlayer (see the file comment). */
export function playerHourlyJob(world: World, ctx: JobCtx): void {
  const p = live(world);
  if (p === null) return;
  if (isDividendHour(ctx.facts)) payDividends(world, p);
  settleDelisted(world, p, ctx);
  if (marketTrades(ctx.facts)) fillOrders(world, p, ctx);
  reservedRecompute(world, p);
  priceAlerts(world, p, ctx);
}

// ---------------------------------------------------------------- daily

function accrueInterest(world: World, p: PlayerState, ctx: JobCtx): void {
  const day = simDateAddDays(ctx.facts.date, -1);
  const rate = maxF(world.base_rate - CASH_RATE_SPREAD, 0);
  if (rate <= 0) return;
  for (const a of p.accounts) {
    if (a.cash <= 0) continue;
    const i = (a.cash * rate) / daysInYear(day.year);
    a.cash += i;
    p.interest += i;
  }
}

/** pivot 14.2: the tax year `p.tax_year` closes; its bill is due next April. */
function closeTaxYear(world: World, p: PlayerState, year: number): void {
  const gains = p.realised_gains;
  p.tax_due += world.levers.gains_tax * maxF(gains, 0) + world.levers.income_tax * p.interest;
  p.realised_gains = minF(gains, 0);
  p.interest = 0;
  p.tax_year = year;
}

function expireDayOrders(p: PlayerState, ctx: JobCtx): void {
  const today = dateTimeMidnight(ctx.facts.date);
  for (const o of [...p.orders]) {
    if (o.status === "Open" && o.tif === "Day" && o.placed < today)
      orderClose(p, o, "Expired", "Expired", ctx.facts.now);
  }
}

/** Pays up to `amount` from cash, the brokerage first; returns what was paid. */
function payFromCash(p: PlayerState, amount: number): number {
  let left = amount;
  for (const venue of ["Brokerage", "Exchange"] as const) {
    const a = accountOf(p, venue);
    const take = minF(maxF(a.cash - a.reserved, 0), left);
    a.cash -= take;
    left -= take;
  }
  return amount - left;
}

function cashTotal(p: PlayerState): number {
  let c = 0;
  for (const a of p.accounts) c += a.cash;
  return c;
}

/** pivot 14.2, 14.5: the April bill (see the file comment). */
function taxBill(world: World, p: PlayerState, ctx: JobCtx): void {
  const due = p.tax_due;
  if (due <= 0) return;
  const now = ctx.facts.now;
  const year = p.tax_year - 1;
  let free = 0;
  for (const a of p.accounts) free += a.cash - a.reserved;
  if (free >= due) {
    p.tax_due -= payFromCash(p, due);
    notify(p, ctx, now, {
      kind: "Tax",
      text: `Tax bill for ${year} paid: ${usd(due)}`,
      refs: [],
      paused: false,
      fixed: null,
    });
    return;
  }
  // Short: cancel every open order, then sell positions in order until the bill is covered.
  for (const o of [...p.orders]) if (o.status === "Open") orderClose(p, o, "Cancelled", "Cancelled", now);
  reservedRecompute(world, p);
  let sold = 0;
  for (const pos of [...p.positions]) {
    if (cashTotal(p) >= due) break;
    const company = pos.venue === "Brokerage" ? stockCompany(world, pos.instrument) : null;
    if (company === null) continue;
    const price = bidPrice(p, stockPrice(world, company));
    sellAll(p, pos.instrument, price, p.difficulty.commission, now, "Filled");
    sold++;
  }
  p.tax_due -= payFromCash(p, due);
  notify(p, ctx, now, {
    kind: "Tax",
    text: `Tax bill for ${year} of ${usd(due)}: ${sold} position${sold === 1 ? "" : "s"} sold to pay it, ${usd(p.tax_due)} unpaid`,
    refs: [],
    paused: true,
    fixed: "MarginCall",
  });
  if (netWorth(world, p) < 0) {
    p.bankrupt = true;
    p.ended = ctx.facts.date;
    notify(p, ctx, now, {
      kind: "Bankruptcy",
      text: `Bankrupt: net worth ${usd(netWorth(world, p))} after selling everything. The run is over.`,
      refs: [],
      paused: true,
      fixed: "MarginCall",
    });
  }
}

/** DailyPlayer (see the file comment). */
export function playerDailyJob(world: World, ctx: JobCtx): void {
  const p = live(world);
  if (p === null) return;
  const d = ctx.facts.date;
  accrueInterest(world, p, ctx);
  if (d.month === 1 && d.day === 1) closeTaxYear(world, p, d.year);
  expireDayOrders(p, ctx);
  if (d.month === TAX_BILL_MONTH && d.day === TAX_BILL_DAY) taxBill(world, p, ctx);
  reservedRecompute(world, p);
}
