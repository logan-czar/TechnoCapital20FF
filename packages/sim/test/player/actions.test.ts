// Each player action's accept and reject cases (pivot 1.3, 13.1, 14.1, 14.4; D1027, D1042): an
// applied action changes `World.player` and is recorded with the clock; a refused one changes
// nothing and is not recorded. On the frozen test world, its player opened at Normal (common.ts).

import { describe, expect, it } from "vitest";
import { simWorld } from "../../src/lib.ts";
import { playerAct, playerOpen, playerStart } from "../../src/player/index.ts";
import {
  DIFFICULTY_PRESETS,
  PLAYER_ACCOUNT_IDS,
  START_CASH,
  START_GAINS_TAX,
} from "../../src/player/rules.ts";
import type { ActError, PlayerAction } from "../../src/types/action.ts";
import { stockInstrument } from "../../src/types/action.ts";
import type { CompanyId, InstrumentId, OrderId } from "../../src/types/ids.ts";
import type { World } from "../../src/types/world.ts";
import { testSim } from "../test_sim.ts";
import {
  act,
  brokerage,
  exchange,
  freshWorld,
  order,
  player,
  quoted,
  setPrice,
  TRADING_HOUR,
} from "./common.ts";

/** Expects `action` refused with `kind`, the player unchanged and nothing recorded. */
function refused(world: World, action: PlayerAction, kind: ActError["kind"]): void {
  const before = JSON.stringify(world.player);
  const r = playerAct(world, action);
  expect(r.ok, JSON.stringify(action)).toBe(false);
  if (!r.ok) expect(r.error.kind, JSON.stringify(r.error)).toBe(kind);
  expect(JSON.stringify(world.player)).toBe(before);
}

describe("opening the account (pivot 3.3, 3.4, 3.6, 14.1)", () => {
  it("opens at Normal with $50,000 at the brokerage, nothing on the exchange, the starting tax rates", () => {
    const w = freshWorld();
    const p = player(w);
    expect(p.difficulty).toEqual(DIFFICULTY_PRESETS.Normal);
    expect(p.difficulty.start_cash).toBe(START_CASH);
    expect(p.accounts).toEqual([
      { venue: "Brokerage", account: PLAYER_ACCOUNT_IDS.Brokerage, cash: 50_000, reserved: 0 },
      { venue: "Exchange", account: PLAYER_ACCOUNT_IDS.Exchange, cash: 0, reserved: 0 },
    ]);
    expect(p.tax_year).toBe(2020);
    expect(p.read_through).toBe(-1);
    expect(w.levers.gains_tax).toBe(START_GAINS_TAX);
  });

  it("each preset opens with its own cash; a Coarse world cannot have a player", () => {
    for (const d of ["Easy", "Normal", "Hard"] as const) {
      const w = freshWorld();
      playerOpen(w, d);
      expect(brokerage(w).cash).toBe(DIFFICULTY_PRESETS[d].start_cash);
      expect(player(w).difficulty.id).toBe(d);
    }
    const w = freshWorld();
    w.player = null;
    w.fidelity = "Coarse";
    expect(() => playerOpen(w)).toThrow(/Full/);
    // With no player every action is not available.
    refused(w, { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 1 }, "NotAvailable");
  });

  it("opens at the start only in a hydrated historical world, never in one that never hydrates", () => {
    // The frozen test world is Full from its load and never hydrates: no player, neutral levers.
    const loaded = simWorld(testSim(1));
    expect(loaded.player).toBeNull();
    expect(loaded.levers.gains_tax).toBe(0);
    const w = freshWorld();
    w.player = null;
    playerStart(w);
    expect(w.player).toBeNull();
    // A historical world is Coarse until hydration, then Full: playerStart opens it there (M3).
    w.era = {} as never;
    w.fidelity = "Coarse";
    playerStart(w);
    expect(w.player).toBeNull();
    w.fidelity = "Full";
    playerStart(w);
    expect(player(w).difficulty.id).toBe("Normal");
  });
});

describe("Transfer (pivot 14.1)", () => {
  it("moves cash between the venues and is recorded at the clock", () => {
    const w = freshWorld();
    act(w, { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 1_000 }, 7);
    expect(brokerage(w).cash).toBe(49_000);
    expect(exchange(w).cash).toBe(1_000);
    expect(player(w).actions).toEqual([
      { at: 7, action: { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 1_000 } },
    ]);
  });

  it("refuses a bad amount, one venue, and more than the spendable cash", () => {
    const w = freshWorld();
    refused(w, { kind: "Transfer", from: "Brokerage", to: "Brokerage", amount: 1 }, "Invalid");
    refused(w, { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 0 }, "Invalid");
    refused(w, { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: Number.NaN }, "Invalid");
    refused(w, { kind: "Transfer", from: "Exchange", to: "Brokerage", amount: 1 }, "Rejected");
    refused(w, { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 50_000.01 }, "Rejected");
    // Reserved cash cannot move: a resting limit buy holds 100 × $100 + $5.
    const { company, instrument } = quoted(w);
    setPrice(w, company, 120);
    act(w, order(instrument, "Buy", 100, 100));
    expect(brokerage(w).reserved).toBe(10_005);
    refused(w, { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 40_000 }, "Rejected");
    act(w, { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 39_995 });
    expect(brokerage(w).cash).toBe(10_005);
  });
});

describe("PlaceOrder and CancelOrder (pivot 13.1, 1.3)", () => {
  it("a buy rests open with its cost reserved; a cancel closes it and frees the cash", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 100);
    act(w, order(instrument, "Buy", 10), TRADING_HOUR);
    const p = player(w);
    expect(p.orders).toHaveLength(1);
    expect(p.orders[0]).toMatchObject({ id: 0, status: "Open", qty: 10, filled: 0, placed: TRADING_HOUR });
    // A market buy reserves at the hour's ask: 10 × $100 × 1.001 + $5.
    expect(brokerage(w).reserved).toBeCloseTo(10 * 100.1 + 5, 9);
    act(w, { kind: "CancelOrder", order: 0 as OrderId });
    expect(p.orders[0]).toMatchObject({ status: "Cancelled", reason: "Cancelled", closed: TRADING_HOUR });
    expect(brokerage(w).reserved).toBe(0);
    refused(w, { kind: "CancelOrder", order: 0 as OrderId }, "Rejected");
    refused(w, { kind: "CancelOrder", order: 9 as OrderId }, "Invalid");
    expect(p.actions.map((a) => a.action.kind)).toEqual(["PlaceOrder", "CancelOrder"]);
  });

  it("refuses malformed orders, the exchange, a non-stock, an unlisted company, short sales and too little cash", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    setPrice(w, company, 100);
    refused(w, order(instrument, "Buy", 0), "Invalid");
    refused(w, order(instrument, "Buy", 1.5), "Invalid");
    refused(w, order(instrument, "Buy", 1, -3), "Invalid");
    refused(w, { ...order(instrument, "Buy", 1), tif: "Week" } as unknown as PlayerAction, "Invalid");
    refused(w, { ...order(instrument, "Buy", 1), venue: "Exchange" }, "NotAvailable");
    refused(w, order(5 as InstrumentId, "Buy", 1), "Invalid");
    refused(w, order(stockInstrument(w.companies.length as CompanyId), "Buy", 1), "Invalid");
    const listed = w.market.stocks[company];
    if (listed === undefined) throw new Error("no stock");
    listed.quoted = false;
    refused(w, order(instrument, "Buy", 1), "Rejected");
    listed.quoted = true;
    // Long only: nothing held to sell.
    refused(w, order(instrument, "Sell", 1), "Rejected");
    // $50,000 buys at most 499 shares at the $100.10 ask with the $5 commission.
    refused(w, order(instrument, "Buy", 500), "Rejected");
    act(w, order(instrument, "Buy", 499));
    // The reserved cash is not spent twice.
    refused(w, order(instrument, "Buy", 1), "Rejected");
  });

  it("refuses a buy past 5% of shares outstanding, counting open buys (pivot 1.3)", () => {
    const w = freshWorld();
    const { company, instrument } = quoted(w);
    const c = w.companies[company];
    if (c === undefined) throw new Error("no company");
    c.shares_out = 2_000; // a cap of 100 shares
    setPrice(w, company, 1);
    act(w, order(instrument, "Buy", 60));
    refused(w, order(instrument, "Buy", 41), "Rejected");
    act(w, order(instrument, "Buy", 40));
  });
});

describe("Follow, Unfollow, AlertRuleAdd, AlertRuleRemove (pivot 14.4, 8.3)", () => {
  it("follows in order, refuses a repeat or a bad target, unfollows", () => {
    const w = freshWorld();
    act(w, { kind: "Follow", target: { kind: "Company", id: 3 } });
    act(w, { kind: "Follow", target: { kind: "Person", id: 12 } });
    act(w, { kind: "Follow", target: { kind: "Handle", id: 4 } });
    expect(player(w).follows).toEqual([
      { kind: "Company", id: 3 },
      { kind: "Person", id: 12 },
      { kind: "Handle", id: 4 },
    ]);
    refused(w, { kind: "Follow", target: { kind: "Company", id: 3 } }, "Rejected");
    refused(w, { kind: "Follow", target: { kind: "Company", id: w.companies.length } }, "Invalid");
    refused(w, { kind: "Follow", target: { kind: "County", id: 1 } }, "Invalid");
    refused(w, { kind: "Follow", target: { kind: "Person", id: -1 } }, "Invalid");
    act(w, { kind: "Unfollow", target: { kind: "Person", id: 12 } });
    expect(player(w).follows).toHaveLength(2);
    refused(w, { kind: "Unfollow", target: { kind: "Person", id: 12 } }, "Invalid");
  });

  it("adds rules with rising ids, refuses bad ones, removes by id", () => {
    const w = freshWorld();
    const target = { kind: "Company" as const, id: 2 };
    act(w, { kind: "AlertRuleAdd", rule: { target, when: { kind: "PriceAbove", price: 10 }, pause: true } });
    act(w, { kind: "AlertRuleAdd", rule: { target, when: { kind: "Any" }, pause: false } });
    expect(player(w).alerts.map((a) => a.id)).toEqual([0, 1]);
    refused(
      w,
      { kind: "AlertRuleAdd", rule: { target, when: { kind: "PriceBelow", price: 0 }, pause: true } },
      "Invalid",
    );
    refused(
      w,
      {
        kind: "AlertRuleAdd",
        rule: { target: { kind: "Contract", id: 1 }, when: { kind: "PriceAbove", price: 50 }, pause: true },
      },
      "Rejected",
    );
    act(w, { kind: "AlertRuleRemove", rule: 0 });
    refused(w, { kind: "AlertRuleRemove", rule: 0 }, "Invalid");
    act(w, { kind: "AlertRuleAdd", rule: { target, when: { kind: "PriceBelow", price: 5 }, pause: false } });
    expect(player(w).alerts.map((a) => a.id)).toEqual([1, 2]);
  });
});

describe("NotificationsRead (D1037)", () => {
  it("moves the read mark forward only; a mark past the last row is refused", () => {
    const w = freshWorld();
    refused(w, { kind: "NotificationsRead", through: 0 }, "Invalid");
    const p = player(w);
    for (let i = 0; i < 3; i++) {
      p.notifications.push({
        id: i,
        time: 0,
        kind: "Fill",
        text: "",
        refs: [],
        rule: null,
        paused: false,
        fixed: null,
      });
    }
    act(w, { kind: "NotificationsRead", through: 1 });
    expect(p.read_through).toBe(1);
    // A mark below the one held changes nothing and is not recorded.
    act(w, { kind: "NotificationsRead", through: 0 });
    expect(p.read_through).toBe(1);
    expect(p.actions).toHaveLength(1);
    refused(w, { kind: "NotificationsRead", through: 3 }, "Invalid");
  });

  it("after bankruptcy only the read mark moves", () => {
    const w = freshWorld();
    player(w).bankrupt = true;
    refused(w, { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 1 }, "Rejected");
    refused(w, { kind: "Follow", target: { kind: "Company", id: 1 } }, "Rejected");
  });
});
