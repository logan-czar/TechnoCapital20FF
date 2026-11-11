// The mock takes the player's actions (types/action.ts): an order round-trips through v_account,
// v_markets and v_notifications, marketable orders fill against the book and pause the game,
// transfers, follows and alert rules land in v_account, and a save keeps what the player did.

import type { ContractRow, FromSim, InstrumentId, OrderRow, PlayerAction, Reply } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import { STOCK_INSTRUMENT_BASE } from "../../src/sim/mock/fixtures/account.ts";
import { MOCK_START, SCRIPT } from "../../src/sim/mock/fixtures/script.ts";
import { SimHost } from "../../src/sim/mock/host.ts";
import { MOCK_PIVOT } from "../../src/sim/mock/mockSim.ts";
import { type Game, mockWorld, newGame } from "./common.ts";
import { checkPivotViews } from "./invariants.ts";

/** A liquid open contract the scripted player holds nothing of: the incumbent's presidency contract. */
function freshContract(g: Game): ContractRow {
  const held = new Set(g.views().account.data.positions.map((p) => p.instrument as number));
  const c = g
    .views()
    .markets.data.contracts.find(
      (x) =>
        x.status === "Open" &&
        x.subject?.kind === "Race" &&
        x.subject.id === 0 &&
        x.kind === "RaceWinner" &&
        !held.has(x.id),
    );
  if (!c) throw new Error("no contract");
  return c;
}
const order = (c: ContractRow, side: "Buy" | "Sell", qty: number, limit: number | null): PlayerAction => ({
  kind: "PlaceOrder",
  venue: "Exchange",
  instrument: c.instrument,
  side,
  qty,
  limit,
  tif: "Gtc",
});
const row = (g: Game, id: number) => g.views().markets.data.contracts[id] as ContractRow;
const cash = (g: Game) => g.views().account.data.cash.map((c) => c.cash);
const lastOrder = (g: Game): OrderRow => {
  const orders = g.views().account.data.orders;
  return orders.reduce((a, b) => (b.id > a.id ? b : a));
};
const ok: Reply = { kind: "Ok", notices: [] };

describe("the mock's player actions", () => {
  it("a resting limit order appears in the account and the book, and is cancelled", () => {
    const g = newGame(7);
    const c = freshContract(g);
    const [, before] = cash(g);
    const bid = c.bid as number;
    const frames = g.log.length;
    expect(g.act(order(c, "Buy", 250, bid - 3))).toEqual(ok);
    // The Frame with the changed views came before the Reply.
    expect(g.log.slice(frames).map((m) => m.kind)).toEqual(["Frame", "Reply"]);
    const frame = g.log[frames] as Extract<FromSim, { kind: "Frame" }>;
    expect(Object.keys(frame.views).sort()).toEqual(["account", "clock", "markets", "refresh"]);

    const o = lastOrder(g);
    expect(o).toMatchObject({
      status: "Open",
      qty: 250,
      filled: 0,
      limit: bid - 3,
      side: "Buy",
      placed: MOCK_START,
    });
    expect(o.what).toEqual({ kind: "Contract", id: c.id });
    // Open orders lead the list (v_account).
    expect(g.views().account.data.orders[0]?.status).toBe("Open");
    // It rests behind the best bid: the row is unchanged, the book's level holds it, the cash is untouched.
    expect(row(g, c.id).bid).toBe(bid);
    const level = (g.host.slice({ view: "markets", contract: c.id })?.bids ?? []).find(
      (l) => l.price === bid - 3,
    );
    const plain = g.sim.pivot?.markets.contracts[c.id]?.bids.find((l) => l.price === bid - 3)?.qty ?? 0;
    expect(level?.qty).toBe(plain + 250);
    expect(cash(g)[1]).toBe(before);
    expect(g.sim.paused).toBe(true);

    expect(g.act({ kind: "CancelOrder", order: o.id })).toEqual(ok);
    expect(g.views().account.data.orders.find((x) => x.id === o.id)?.status).toBe("Cancelled");
    expect(g.act({ kind: "CancelOrder", order: o.id })).toEqual({
      kind: "ActError",
      error: { kind: "Rejected", message: "that order is no longer open" },
    });
    checkPivotViews(g.views(), false);
  });

  it("an order inside the spread becomes the best bid, and is filled as the clock runs", () => {
    const g = newGame(7);
    // A contract with a spread wider than one cent.
    const c = g
      .views()
      .markets.data.contracts.find(
        (x) =>
          x.status === "Open" &&
          x.bid !== null &&
          x.ask !== null &&
          x.ask - x.bid >= 2 &&
          x.kind === "Bracket",
      );
    if (!c) throw new Error("no wide contract");
    const price = (c.bid as number) + 1;
    expect(g.act(order(c, "Buy", 40, price))).toEqual(ok);
    expect(row(g, c.id).bid).toBe(price);
    const o = lastOrder(g);
    const notices = g.runTo(MOCK_START + 72);
    const after =
      g.views().account.data.orders.find((x) => x.id === o.id) ??
      g.views().account.data.orders.find((x) => x.id === o.id);
    expect(after?.status).toBe("Filled");
    const fills = g.views().account.data.fills.filter((f) => f.order === o.id);
    expect(fills.reduce((a, f) => a + f.qty, 0)).toBe(40);
    expect(fills.every((f) => f.price <= price)).toBe(true);
    // The player's own fill is a fixed pause (pivot 2.4 item 1).
    expect(notices).toContainEqual({ kind: "Paused", reason: { kind: "Player" } });
    expect(
      g.views().notifications.data.items.some((n) => n.kind === "Fill" && n.paused && n.refs[0]?.id === c.id),
    ).toBe(true);
    checkPivotViews(g.views(), false);
  });

  it("a marketable order fills against the book at once, moves the price, and pauses a running game", () => {
    const g = newGame(7);
    const c = freshContract(g);
    const book = g.host.slice({ view: "markets", contract: c.id });
    const top = book?.asks[0];
    if (!top) throw new Error("no asks");
    const qty = top.qty + 10;
    const [, before] = cash(g);
    const notes = g.views().notifications.data.items.length;
    g.control({ kind: "Resume" });
    expect(g.sim.paused).toBe(false);
    const reply = g.act(order(c, "Buy", qty, null));
    expect(reply).toEqual({ kind: "Ok", notices: [{ kind: "Paused", reason: { kind: "Player" } }] });
    expect(g.sim.paused).toBe(true);
    expect(g.views().clock.data.paused).toBe(true);

    const o = lastOrder(g);
    expect(o).toMatchObject({ status: "Filled", filled: qty, limit: null });
    // It took the whole best level and ten of the next.
    const fills = g.views().account.data.fills.filter((f) => f.order === o.id);
    expect(fills.map((f) => [f.qty, f.price])).toEqual([
      [top.qty, top.price],
      [10, top.price + 1],
    ]);
    const cost = (top.qty * top.price + 10 * (top.price + 1)) / 100;
    expect(cash(g)[1]).toBeCloseTo(before - cost, 6);
    const pos = g.views().account.data.positions.find((p) => p.instrument === c.instrument);
    expect(pos).toMatchObject({ venue: "Exchange", qty, what: { kind: "Contract", id: c.id } });
    expect(pos?.avg_cost).toBeCloseTo((cost * 100) / qty, 6);
    // The book lost what was taken, and the row shows the new best ask and the last trade.
    const now = g.host.slice({ view: "markets", contract: c.id });
    expect(now?.asks[0]).toEqual({ price: top.price + 1, qty: (book?.asks[1]?.qty as number) - 10 });
    expect(row(g, c.id)).toMatchObject({ ask: top.price + 1, last: top.price + 1 });
    expect(row(g, c.id).volume).toBe(c.volume + qty);
    const note = g.views().notifications.data.items.slice(notes);
    expect(note).toHaveLength(1);
    expect(note[0]).toMatchObject({
      kind: "Fill",
      paused: true,
      refs: [{ kind: "Contract", id: c.id }],
      time: MOCK_START,
    });

    // Selling it back closes the position; selling more than is held opens the No side (pivot 10.5).
    expect(g.act(order(c, "Sell", qty + 100, null)).kind).toBe("Ok");
    const short = g.views().account.data.positions.find((p) => p.instrument === c.instrument);
    expect(short?.qty).toBe(-100);
    expect(g.views().account.data.realised_gains).not.toBe(0);
    checkPivotViews(g.views(), false);
  });

  it("refuses what the rules refuse, changing nothing and posting no frame", () => {
    const g = newGame(7);
    const c = freshContract(g);
    const before = JSON.stringify(g.views().account.data);
    const frames = g.log.length;
    const refused = (a: PlayerAction, kind: "Invalid" | "Rejected") => {
      const r = g.act(a);
      expect(r.kind === "ActError" && r.error.kind, JSON.stringify(a)).toBe(kind);
    };
    refused(order(c, "Buy", 0, 50), "Invalid");
    refused(order(c, "Buy", 10, 100), "Invalid");
    refused(order(c, "Buy", 2.5, 50), "Invalid");
    refused({ ...order(c, "Buy", 10, 50), instrument: 99_999 as InstrumentId }, "Invalid");
    refused(order(c, "Buy", 10_000_000, 50), "Rejected");
    const resolved = g.views().markets.data.contracts.find((x) => x.status === "Resolved") as ContractRow;
    refused(order(resolved, "Buy", 10, 50), "Rejected");
    refused({ kind: "CancelOrder", order: 9999 as never }, "Invalid");
    refused({ kind: "Transfer", from: "Exchange", to: "Exchange", amount: 10 }, "Invalid");
    refused({ kind: "Transfer", from: "Exchange", to: "Brokerage", amount: 1e9 }, "Rejected");
    refused({ kind: "Follow", target: { kind: "Person", id: 99_999 } }, "Invalid");
    refused(
      {
        kind: "AlertRuleAdd",
        rule: { target: { kind: "Person", id: 0 }, when: { kind: "PriceAbove", price: 5 }, pause: false },
      },
      "Invalid",
    );
    refused({ kind: "AlertRuleRemove", rule: 99 }, "Invalid");
    // The brokerage is long only and fills at once (pivot 13.1).
    const stock = g.views().account.data.positions.find((p) => p.venue === "Brokerage");
    if (!stock) throw new Error("no stock");
    refused(
      {
        kind: "PlaceOrder",
        venue: "Brokerage",
        instrument: stock.instrument,
        side: "Sell",
        qty: stock.qty + 1,
        limit: null,
        tif: "Day",
      },
      "Rejected",
    );
    refused(
      {
        kind: "PlaceOrder",
        venue: "Brokerage",
        instrument: stock.instrument,
        side: "Buy",
        qty: 1,
        limit: 0.01,
        tif: "Day",
      },
      "Rejected",
    );
    refused(
      {
        kind: "PlaceOrder",
        venue: "Brokerage",
        instrument: stock.instrument,
        side: "Buy",
        qty: 1e9,
        limit: null,
        tif: "Day",
      },
      "Rejected",
    );
    expect(JSON.stringify(g.views().account.data)).toBe(before);
    expect(g.log.slice(frames).every((m) => m.kind === "Reply")).toBe(true);
  });

  it("trades a stock at the brokerage, moves cash between venues, follows and sets alerts", () => {
    const g = newGame(7);
    const stock = g.views().account.data.positions.find((p) => p.venue === "Brokerage");
    if (!stock) throw new Error("no stock");
    expect(stock.instrument).toBe(STOCK_INSTRUMENT_BASE + stock.what.id);
    const quote = g.views().quotes.data.rows.find((q) => q.id === stock.what.id)?.last as number;
    const [broker, exchange] = cash(g) as [number, number];
    expect(
      g.act({
        kind: "PlaceOrder",
        venue: "Brokerage",
        instrument: stock.instrument,
        side: "Buy",
        qty: 5,
        limit: null,
        tif: "Day",
      }).kind,
    ).toBe("Ok");
    const fill = g.views().account.data.fills.at(-1);
    expect(fill?.qty).toBe(5);
    expect(fill?.price).toBeCloseTo(quote * 1.001, 6);
    expect(fill?.fee).toBe(1);
    expect(cash(g)[0]).toBeCloseTo(broker - 5 * quote * 1.001 - 1, 6);
    expect(g.views().account.data.positions.find((p) => p.instrument === stock.instrument)?.qty).toBe(
      stock.qty + 5,
    );

    const b2 = cash(g)[0] as number;
    expect(g.act({ kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 1234.5 })).toEqual(ok);
    expect(cash(g)).toEqual([b2 - 1234.5, exchange + 1234.5]);

    const handle = g.views().social.data.handles.find((h) => !h.followed);
    if (!handle) throw new Error("no handle");
    const social = g.views().social.version;
    expect(g.act({ kind: "Follow", target: { kind: "Handle", id: handle.id } })).toEqual(ok);
    expect(g.views().social.data.handles[handle.id]?.followed).toBe(true);
    expect(g.views().social.version).toBeGreaterThan(social);
    expect(g.views().account.data.follows.at(-1)).toEqual({ kind: "Handle", id: handle.id });
    expect(g.act({ kind: "Unfollow", target: { kind: "Handle", id: handle.id } })).toEqual(ok);
    expect(g.views().social.data.handles[handle.id]?.followed).toBe(false);

    // An alert on anything published about a bill, set to pause: the next roll call on it fires it.
    const rules = g.views().account.data.alert_rules;
    expect(
      g.act({
        kind: "AlertRuleAdd",
        rule: { target: { kind: "Bill", id: 1 }, when: { kind: "Any" }, pause: true },
      }),
    ).toEqual(ok);
    const mine = g.views().account.data.alert_rules.at(-1);
    expect(mine?.id).toBe((rules.at(-1)?.id ?? -1) + 1);
    g.runTo(SCRIPT.bill_senate_vote);
    const fired = g.views().notifications.data.items.filter((n) => n.rule === mine?.id);
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ kind: "Alert", paused: true, refs: [{ kind: "Bill", id: 1 }] });
    expect(g.act({ kind: "AlertRuleRemove", rule: mine?.id as number })).toEqual(ok);
    expect(g.views().account.data.alert_rules.some((r) => r.id === mine?.id)).toBe(false);
    checkPivotViews(g.views(), false);
  });

  it("a held contract is paid out at resolution, less the fee on winnings (pivot 10.5)", () => {
    const g = newGame(7);
    const law = g.views().markets.data.contracts[
      g.sim.pivot?.markets.named.infra_law as number
    ] as ContractRow;
    const pos = g.views().account.data.positions.find((p) => p.instrument === law.instrument);
    if (!pos) throw new Error("the script holds this contract");
    g.runTo(SCRIPT.bill_signed - 1);
    const [, before] = cash(g) as [number, number];
    const gains = g.views().account.data.realised_gains;
    g.runTo(SCRIPT.bill_signed);
    const winnings = pos.qty * (1 - pos.avg_cost / 100);
    const fee = 0.02 * winnings;
    expect(cash(g)[1]).toBeCloseTo(before + pos.qty - fee, 6);
    expect(g.views().account.data.realised_gains).toBeCloseTo(gains + winnings - fee, 6);
    expect(g.views().account.data.positions.some((p) => p.instrument === law.instrument)).toBe(false);
    expect(g.views().account.data.tax_due).toBeCloseTo(
      Math.max(0, g.views().account.data.realised_gains) * 0.2,
      6,
    );
  });

  it("a save keeps the player's actions: loading it gives the same account (pivot 16.1)", () => {
    const g = newGame(7);
    const c = freshContract(g);
    g.act(order(c, "Buy", 300, null));
    g.act(order(c, "Sell", 100, 99));
    g.runTo(MOCK_START + 30);
    g.act({ kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 777 });
    g.runTo(MOCK_START + 50);
    const saved = g.host.handle({ kind: "Save", id: 900 })[0];
    if (saved?.kind !== "Reply" || saved.result.kind !== "Saved") throw new Error("no save");

    const host = new SimHost(mockWorld(), MOCK_PIVOT);
    const out = host.handle({ kind: "Load", id: 1, bytes: saved.result.bytes });
    expect(out.map((m) => m.kind)).toEqual(["Frame", "Reply"]);
    const loaded = host.sim;
    if (!loaded) throw new Error("no sim");
    expect(loaded.now).toBe(MOCK_START + 50);
    expect(loaded.paused).toBe(true);
    // The stock walk is not saved by the mock (as before this lane), so stock marks may differ:
    // compare what does not depend on them.
    const strip = (a: ReturnType<Game["views"]>["account"]["data"]) => ({
      cash: a.cash,
      orders: a.orders,
      fills: a.fills,
      follows: a.follows,
      alert_rules: a.alert_rules,
      positions: a.positions.filter((p) => p.venue === "Exchange"),
    });
    expect(strip(loaded.views.account.data)).toEqual(strip(g.views().account.data));
    expect(loaded.views.markets.data).toEqual(g.views().markets.data);
    expect(loaded.views.feed.data.articles.length).toBe(g.views().feed.data.articles.length);
    expect(loaded.views.notifications.data).toEqual(g.views().notifications.data);
    expect(loaded.pivot?.recorded).toHaveLength(3);
    // A bad save is still refused.
    expect(host.handle({ kind: "Load", id: 2, bytes: new Uint8Array([1, 2]) })[0]).toMatchObject({
      result: { kind: "SimError" },
    });
  });
});
