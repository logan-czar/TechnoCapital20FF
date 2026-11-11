// The brokerage's fill rule at exact prices, the 5% cap on fill, FIFO lots, fill notifications and
// their pauses, and price alerts (pivot 13.1, 1.3, 14.2, 14.4, 2.4; D1042). The player's hourly
// job runs directly on chosen ticks of a copy of the frozen test world, with prices set by hand.

import { describe, expect, it } from "vitest";
import { controlsDefault } from "../../src/time/control.ts";
import type { OrderId } from "../../src/types/ids.ts";
import {
  act,
  at,
  brokerage,
  daily,
  freshWorld,
  held,
  hourly,
  order,
  player,
  quoted,
  setPrice,
  TRADING_HOUR,
} from "./common.ts";

describe("the fill rule (pivot 13.1)", () => {
  it("a market buy fills at the next trading hour at P × (1 + spread) plus the commission", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 100);
    act(w, order(instrument, "Buy", 10), TRADING_HOUR);
    const p = player(w);
    expect(p.fills).toEqual([]);
    const ran = hourly(w, TRADING_HOUR + 1);
    expect(p.fills).toHaveLength(1);
    const f = p.fills[0];
    expect(f).toMatchObject({ order: 0, time: TRADING_HOUR + 1, side: "Buy", qty: 10, fee: 5, realised: 0 });
    expect(f?.price).toBeCloseTo(100.1, 12);
    // $50,000 − 10 × $100.10 − $5.
    expect(brokerage(w).cash).toBeCloseTo(48_994, 9);
    expect(brokerage(w).reserved).toBe(0);
    // The lot's price includes the commission: (1,001 + 5) ÷ 10.
    expect(p.positions[0]?.lots).toHaveLength(1);
    expect(p.positions[0]?.lots[0]?.price).toBeCloseTo(100.6, 12);
    expect(p.orders[0]).toMatchObject({
      status: "Filled",
      reason: "Filled",
      filled: 10,
      closed: TRADING_HOUR + 1,
    });
    // A fill of the player's own order notifies and pauses (pivot 2.4 item 1).
    expect(p.notifications).toEqual([
      {
        id: 0,
        time: TRADING_HOUR + 1,
        kind: "Fill",
        text: expect.stringMatching(/^Bought 10 .+ at \$100\.10$/),
        refs: [{ kind: "Company", id: company }],
        rule: null,
        paused: true,
        fixed: "OwnFill",
      },
    ]);
    expect(ran.pause).toEqual({ kind: "Notification", id: 0 });
  });

  it("a limit buy rests while the ask is above its limit and fills at the ask once it is not", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 99);
    act(w, order(instrument, "Buy", 10, 99), TRADING_HOUR);
    // Ask 99 × 1.001 = 99.099 > 99: rests, holding 10 × 99 + 5 back.
    expect(hourly(w, TRADING_HOUR + 1).pause).toBeNull();
    expect(player(w).orders[0]?.status).toBe("Open");
    expect(brokerage(w).reserved).toBe(995);
    setPrice(w, company, 98.9);
    hourly(w, TRADING_HOUR + 2);
    // Ask 98.9 × 1.001 = 98.9989 ≤ 99: fills there, not at the limit.
    expect(player(w).fills[0]?.price).toBeCloseTo(98.9989, 12);
    expect(held(w, instrument)).toBe(10);
  });

  it("a limit sell rests while the bid is below its limit and fills at the bid once it is not", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 100);
    act(w, order(instrument, "Buy", 20), TRADING_HOUR);
    hourly(w, TRADING_HOUR + 1);
    act(w, order(instrument, "Sell", 20, 110));
    setPrice(w, company, 110);
    hourly(w, TRADING_HOUR + 2);
    // Bid 110 × 0.999 = 109.89 < 110.
    expect(player(w).orders[1]?.status).toBe("Open");
    setPrice(w, company, 110.2);
    hourly(w, TRADING_HOUR + 3);
    expect(player(w).fills[1]?.price).toBeCloseTo(110.0898, 12);
    expect(held(w, instrument)).toBe(0);
    expect(player(w).positions).toEqual([]);
  });

  it("does not fill on 1 January (markets closed) or on the release tick, and does at the next hour", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 50);
    act(w, order(instrument, "Buy", 1), at(1, 1, 5));
    hourly(w, at(1, 1, 6));
    expect(player(w).fills).toEqual([]);
    // 2 January 00:00 is the release tick: prices are frozen and nothing fills.
    hourly(w, at(1, 2, 0));
    expect(player(w).fills).toEqual([]);
    hourly(w, at(1, 2, 1));
    expect(player(w).fills).toHaveLength(1);
  });

  it("a Day order expires at the next 00:00 after the hour's fills; a Gtc one rests on", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 100);
    act(w, order(instrument, "Buy", 1, 50, "Day"), TRADING_HOUR);
    act(w, order(instrument, "Buy", 1, 50, "Gtc"));
    hourly(w, at(1, 4, 0));
    daily(w, at(1, 4, 0));
    const [day, gtc] = player(w).orders;
    expect(day).toMatchObject({ status: "Expired", reason: "Expired", closed: at(1, 4, 0) });
    expect(gtc?.status).toBe("Open");
    expect(brokerage(w).reserved).toBe(55);
  });

  it("closes a buy as Rejected at the fill when it would pass the 5% cap or the cash", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    const c = w.companies[company];
    if (c === undefined) throw new Error("no company");
    setPrice(w, company, 1);
    c.shares_out = 2_000; // a cap of 100
    act(w, order(instrument, "Buy", 100), TRADING_HOUR);
    c.shares_out = 1_000; // the cap falls to 50 before the fill
    hourly(w, TRADING_HOUR + 1);
    expect(player(w).orders[0]).toMatchObject({ status: "Cancelled", reason: "Rejected", filled: 0 });
    expect(held(w, instrument)).toBe(0);
    // Cash: a market order reserved at $1 a share; the price jumps before the fill.
    c.shares_out = 10_000_000;
    act(w, order(instrument, "Buy", 40_000));
    setPrice(w, company, 2);
    hourly(w, TRADING_HOUR + 2);
    expect(player(w).orders[1]).toMatchObject({ status: "Cancelled", reason: "Rejected" });
    expect(brokerage(w).cash).toBe(50_000);
    expect(player(w).notifications).toEqual([]);
  });
});

describe("FIFO lots and realised gains (pivot 14.2)", () => {
  it("a sale takes the oldest lots first: worked numbers", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 100);
    act(w, order(instrument, "Buy", 10), TRADING_HOUR);
    hourly(w, TRADING_HOUR + 1); // lot 1: 10 at (1,001 + 5) ÷ 10 = 100.60
    setPrice(w, company, 120);
    act(w, order(instrument, "Buy", 10));
    hourly(w, TRADING_HOUR + 2); // lot 2: 10 at (1,201.20 + 5) ÷ 10 = 120.62
    setPrice(w, company, 130);
    act(w, order(instrument, "Sell", 15));
    hourly(w, TRADING_HOUR + 3);
    const p = player(w);
    // Proceeds 15 × 129.87 − 5 = 1,943.05; cost 10 × 100.60 + 5 × 120.62 = 1,609.10.
    const sale = p.fills[2];
    expect(sale?.price).toBeCloseTo(129.87, 12);
    expect(sale?.realised).toBeCloseTo(333.95, 9);
    expect(p.realised_gains).toBeCloseTo(333.95, 9);
    expect(p.positions[0]?.lots).toHaveLength(1);
    expect(p.positions[0]?.lots[0]?.qty).toBe(5);
    expect(p.positions[0]?.lots[0]?.price).toBeCloseTo(120.62, 12);
    expect(p.positions[0]?.lots[0]?.opened).toBe(TRADING_HOUR + 2);
    // Cash: 50,000 − 1,006 − 1,206.20 + 1,943.05.
    expect(brokerage(w).cash).toBeCloseTo(49_730.85, 9);
  });

  it("refuses a sell beyond what is held less the open sells (long only)", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 10);
    act(w, order(instrument, "Buy", 10), TRADING_HOUR);
    hourly(w, TRADING_HOUR + 1);
    act(w, order(instrument, "Sell", 6, 1_000));
    expect(() => act(w, order(instrument, "Sell", 5))).toThrow(/Rejected/);
    act(w, { kind: "CancelOrder", order: 1 as OrderId });
    act(w, order(instrument, "Sell", 10));
  });
});

describe("pauses and price alerts (pivot 2.4, 14.4)", () => {
  it("a fill's row asks to pause whatever the settings; a SkipTo runs through it", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 10);
    act(w, order(instrument, "Buy", 1), TRADING_HOUR);
    const skipping = { ...controlsDefault(), skip: { kind: "MonthEnd" as const, target: 1e9 } };
    const ran = hourly(w, TRADING_HOUR + 1, skipping);
    expect(player(w).notifications[0]?.paused).toBe(true);
    expect(ran.pause).toBeNull();
  });

  it("a price alert fires once, at or past its level, notifies, pauses if set to, and is removed", () => {
    const w = freshWorld();
    const { company } = quoted(w);
    const target = { kind: "Company" as const, id: company };
    act(w, { kind: "AlertRuleAdd", rule: { target, when: { kind: "PriceAbove", price: 150 }, pause: true } });
    act(w, { kind: "AlertRuleAdd", rule: { target, when: { kind: "PriceBelow", price: 50 }, pause: false } });
    setPrice(w, company, 149.99);
    expect(hourly(w, TRADING_HOUR).pause).toBeNull();
    expect(player(w).notifications).toEqual([]);
    setPrice(w, company, 150);
    const up = hourly(w, TRADING_HOUR + 1);
    expect(up.pause).toEqual({ kind: "Notification", id: 0 });
    expect(player(w).notifications[0]).toMatchObject({
      kind: "Alert",
      rule: 0,
      paused: true,
      fixed: null,
      refs: [target],
    });
    expect(player(w).alerts.map((a) => a.id)).toEqual([1]);
    hourly(w, TRADING_HOUR + 2);
    expect(player(w).notifications).toHaveLength(1);
    setPrice(w, company, 50);
    const down = hourly(w, TRADING_HOUR + 3);
    expect(down.pause).toBeNull();
    expect(player(w).notifications[1]).toMatchObject({ kind: "Alert", rule: 1, paused: false });
    expect(player(w).alerts).toEqual([]);
  });
});
