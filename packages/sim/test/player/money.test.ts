// Interest, the tax year and the April bill with worked numbers, dividends, a delisting and the
// bankruptcy end (pivot 14.2, 14.3, 14.5, 14.6, 13.1; D1042). The player's jobs run directly on
// chosen ticks of a copy of the frozen test world.

import { describe, expect, it } from "vitest";
import { netWorth } from "../../src/player/book.ts";
import type { World } from "../../src/types/world.ts";
import {
  act,
  at,
  brokerage,
  daily,
  exchange,
  freshWorld,
  held,
  hourly,
  order,
  player,
  quoted,
  setPrice,
  TRADING_HOUR,
} from "./common.ts";

/** Buys `qty` at P = `buy` and sells them at P = `sell` (Normal: 0.1% spread, $5 commission). */
function roundTrip(w: World, qty: number, buy: number, sell: number, t = TRADING_HOUR): void {
  const { company, instrument } = quoted(w);
  setPrice(w, company, buy);
  act(w, order(instrument, "Buy", qty), t);
  hourly(w, t + 1);
  setPrice(w, company, sell);
  act(w, order(instrument, "Sell", qty));
  hourly(w, t + 2);
}

describe("interest on cash (pivot 14.3)", () => {
  it("accrues each day at the policy rate less the spread, on both venues", () => {
    const w = freshWorld();
    w.base_rate = 0.025;
    act(w, { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 10_000 });
    daily(w, at(1, 3, 0));
    // 2 January 2020 at 2.5% − 0.5%, a 366-day year.
    expect(brokerage(w).cash).toBeCloseTo(40_000 * (1 + 0.02 / 366), 9);
    expect(exchange(w).cash).toBeCloseTo(10_000 * (1 + 0.02 / 366), 9);
    expect(player(w).interest).toBeCloseTo((50_000 * 0.02) / 366, 9);
    w.base_rate = 0.004;
    const before = brokerage(w).cash;
    daily(w, at(1, 4, 0));
    expect(brokerage(w).cash).toBe(before);
  });
});

describe("the tax year and the April bill (pivot 14.2)", () => {
  it("bills the year's gains at gains_tax and its interest at income_tax, paid on 15 April", () => {
    const w = freshWorld();
    w.base_rate = 0;
    roundTrip(w, 100, 100, 111);
    // Cost 100 × 100.10 + 5 = 10,015; proceeds 100 × 110.889 − 5 = 11,083.90; gain 1,068.90.
    const p = player(w);
    expect(p.realised_gains).toBeCloseTo(1_068.9, 9);
    p.interest = 100;
    daily(w, at(1, 1, 0, 2021));
    // 15% × 1,068.90 + 24% × 100 = 160.335 + 24.
    expect(p.tax_due).toBeCloseTo(184.335, 9);
    expect(p.realised_gains).toBe(0);
    expect(p.interest).toBe(0);
    expect(p.tax_year).toBe(2021);
    const cash = brokerage(w).cash;
    daily(w, at(4, 14, 0, 2021));
    expect(p.tax_due).toBeCloseTo(184.335, 9);
    const paid = daily(w, at(4, 15, 0, 2021));
    expect(p.tax_due).toBe(0);
    expect(brokerage(w).cash).toBeCloseTo(cash - 184.335, 9);
    expect(p.notifications.at(-1)).toMatchObject({ kind: "Alert", rule: null, paused: false });
    // 184.335 in binary is just under the half cent.
    expect(p.notifications.at(-1)?.text).toBe("Tax bill for 2020 paid: $184.33");
    expect(paid.pause).toBeNull();
  });

  it("carries a net loss forward against the next year's gains", () => {
    const w = freshWorld();
    w.base_rate = 0;
    const p = player(w);
    roundTrip(w, 100, 100, 95);
    // Proceeds 100 × 94.905 − 5 = 9,485.50 against 10,015: −529.50.
    expect(p.realised_gains).toBeCloseTo(-529.5, 9);
    daily(w, at(1, 1, 0, 2021));
    expect(p.tax_due).toBe(0);
    expect(p.realised_gains).toBeCloseTo(-529.5, 9);
    roundTrip(w, 100, 100, 111, at(2, 3, 10, 2021));
    daily(w, at(1, 1, 0, 2022));
    // 15% × (1,068.90 − 529.50).
    expect(p.tax_due).toBeCloseTo(0.15 * 539.4, 9);
    expect(p.realised_gains).toBe(0);
  });

  it("sells positions to pay a bill the cash cannot, cancelling open orders first", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 100);
    act(w, order(instrument, "Buy", 400), TRADING_HOUR);
    hourly(w, TRADING_HOUR + 1);
    act(w, order(instrument, "Sell", 10, 1_000));
    const p = player(w);
    p.tax_due = 20_000;
    w.base_rate = 0;
    setPrice(w, company, 100);
    hourly(w, at(4, 15, 0));
    const ran = daily(w, at(4, 15, 0));
    // 50,000 − 40,045 = 9,955 cash; 400 × 99.90 − 5 = 39,955 from the sale; 20,000 paid.
    expect(held(w, instrument)).toBe(0);
    expect(p.orders[1]).toMatchObject({ status: "Cancelled", reason: "Cancelled" });
    expect(brokerage(w).cash).toBeCloseTo(29_910, 9);
    expect(p.tax_due).toBe(0);
    expect(p.bankrupt).toBe(false);
    expect(p.notifications.at(-1)).toMatchObject({ kind: "MarginCall", paused: true, fixed: "MarginCall" });
    expect(ran.pause).toEqual({ kind: "Notification", id: p.notifications.length - 1 });
  });
});

describe("bankruptcy (pivot 14.5)", () => {
  it("ends the run when net worth is below zero after selling everything", () => {
    const w = freshWorld();
    w.base_rate = 0;
    const p = player(w);
    p.tax_due = 80_000;
    daily(w, at(4, 15, 0));
    expect(p.tax_due).toBe(30_000);
    expect(netWorth(w, p)).toBe(-30_000);
    expect(p.bankrupt).toBe(true);
    expect(p.ended).toEqual({ year: 2020, month: 4, day: 15 });
    expect(p.notifications.map((n) => n.kind)).toEqual(["MarginCall", "MarginCall"]);
    expect(p.notifications[1]?.text).toMatch(/^Bankrupt/);
    // The run is over: the jobs stop.
    w.base_rate = 0.05;
    exchange(w).cash = 1_000;
    daily(w, at(4, 16, 0));
    expect(exchange(w).cash).toBe(1_000);
  });
});

describe("dividends and delistings (pivot 13.1; spec 5.17, 5.12)", () => {
  it("pays held shares their part of the lock's dividend the hour after the lock, once", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    const c = w.companies[company];
    if (c === undefined) throw new Error("no company");
    setPrice(w, company, 10);
    act(w, order(instrument, "Buy", 1_000), TRADING_HOUR);
    hourly(w, TRADING_HOUR + 1);
    const cash = brokerage(w).cash;
    c.finance.pending.dividends = 0.25 * c.shares_out; // 25 cents a share
    hourly(w, at(1, 9, 0));
    expect(brokerage(w).cash).toBe(cash);
    hourly(w, at(1, 9, 1));
    expect(brokerage(w).cash).toBeCloseTo(cash + 250, 9);
    expect(player(w).realised_gains).toBeCloseTo(250, 9);
    hourly(w, at(1, 9, 2));
    expect(brokerage(w).cash).toBeCloseTo(cash + 250, 9);
  });

  it("settles a delisted holding at its $0.00 price, closes its orders and notifies", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 10);
    act(w, order(instrument, "Buy", 100), TRADING_HOUR);
    hourly(w, TRADING_HOUR + 1);
    act(w, order(instrument, "Sell", 50, 20));
    const s = w.market.stocks[company];
    if (s === undefined) throw new Error("no stock");
    s.quoted = false;
    s.price = 0;
    const ran = hourly(w, TRADING_HOUR + 2);
    const p = player(w);
    expect(held(w, instrument)).toBe(0);
    expect(p.orders[1]).toMatchObject({ status: "Cancelled", reason: "MarketClosed" });
    expect(p.orders[2]).toMatchObject({ side: "Sell", qty: 100, status: "Filled", reason: "MarketClosed" });
    // Cost 100 × 10.01 + 5 = 1,006, all of it lost.
    expect(p.fills[1]).toMatchObject({ qty: 100, price: 0, fee: 0 });
    expect(p.fills[1]?.realised).toBeCloseTo(-1_006, 9);
    expect(p.notifications.at(-1)).toMatchObject({ kind: "Holding", paused: true, fixed: "Holding" });
    expect(ran.pause).toEqual({ kind: "Notification", id: p.notifications.length - 1 });
  });

  it("net worth is cash and positions at their marks less the tax owed (pivot 14.6)", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 10);
    act(w, order(instrument, "Buy", 100), TRADING_HOUR);
    hourly(w, TRADING_HOUR + 1);
    setPrice(w, company, 12);
    player(w).tax_due = 7;
    expect(netWorth(w, player(w))).toBeCloseTo(50_000 - 1_006 + 1_200 - 7, 9);
  });
});
