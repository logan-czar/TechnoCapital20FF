// The player in a running Sim (pivot 16.1, 13.1, 2.4; D1027, D1042), on the frozen test world:
// actions inside the state hash and recorded for replay, the same actions at the same ticks giving
// the same hash, an action log replaying to the same hash, a save and load with an order resting,
// the price taker leaving every other part of the world as it was, a fill pausing the game, and
// the views.

import { describe, expect, it } from "vitest";
import { type Sim, simStateHash, simWorld } from "../../src/lib.ts";
import { decode } from "../../src/save.ts";
import { dateTimeAt, simDateYmd } from "../../src/time/calendar.ts";
import type { PlayerAction } from "../../src/types/action.ts";
import type { DateTime } from "../../src/types/calendar.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import type { Notice } from "../../src/types/notice.ts";
import type { RecordedAction } from "../../src/types/state/player.ts";
import type { World } from "../../src/types/world.ts";
import { testSim } from "../test_sim.ts";
import { order, quoted, traderSim } from "./common.ts";

const SEED = 3;
/** The run's end: 00:00 on 20 January 2020 (456 ticks), past a release and a plan lock. */
const END = dateTimeAt(simDateYmd(2020, 1, 20), 0);

/** A scripted trader: what it does after the tick at each time. */
function script(world: World): Map<DateTime, PlayerAction[]> {
  const a = quoted(world, 0);
  const b = quoted(world, 1);
  const pa = world.market.stocks[a.company]?.price ?? 0;
  const pb = world.market.stocks[b.company]?.price ?? 0;
  const at = (d: number, h: number) => dateTimeAt(simDateYmd(2020, 1, d), h);
  return new Map<DateTime, PlayerAction[]>([
    [
      at(1, 3),
      [
        order(a.instrument, "Buy", 50),
        { kind: "Follow", target: { kind: "Company", id: a.company } },
        {
          kind: "AlertRuleAdd",
          rule: {
            target: { kind: "Company", id: b.company },
            when: { kind: "PriceAbove", price: pb * 1.01 },
            pause: true,
          },
        },
      ],
    ],
    [
      at(3, 9),
      [
        order(b.instrument, "Buy", 30, pb * 1.05),
        { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 500 },
      ],
    ],
    [at(6, 14), [order(a.instrument, "Sell", 20, pa * 0.9, "Day")]],
    [at(8, 2), [order(a.instrument, "Buy", 10, pa * 0.5)]],
    [at(10, 11), [order(b.instrument, "Sell", 30), { kind: "NotificationsRead", through: 0 }]],
    [at(14, 6), [{ kind: "CancelOrder", order: 3 as never }, order(a.instrument, "Sell", 30)]],
  ]);
}

/** Steps `sim` to `end`, applying `acts` after the tick at each time; every action must apply. */
function play(sim: Sim, end: DateTime, acts: Map<DateTime, PlayerAction[]>, notices: Notice[] = []): void {
  sim.apply({ kind: "Resume" });
  const apply = () => {
    for (const a of acts.get(sim.now()) ?? []) {
      const r = sim.act(a);
      if (!r.ok) throw new Error(`${JSON.stringify(a)} at ${sim.now()}: ${JSON.stringify(r.error)}`);
    }
  };
  apply();
  while (sim.now() < end) {
    notices.push(...sim.step());
    if (sim.controls().paused) sim.apply({ kind: "Resume" });
    apply();
  }
}

/** The log's actions grouped by the clock they were applied at. */
function fromLog(log: readonly RecordedAction[]): Map<DateTime, PlayerAction[]> {
  const m = new Map<DateTime, PlayerAction[]>();
  for (const r of log) m.set(r.at, [...(m.get(r.at) ?? []), r.action]);
  return m;
}

function withoutPlayer(world: World): string {
  return JSON.stringify({ ...world, player: null });
}

function rngOf(sim: Sim): string {
  const d = decode(sim.saveBytes());
  if (!d.ok) throw new Error("save does not decode");
  return JSON.stringify(d.value.rng);
}

describe("the player in a running game (pivot 16.1, 13.1)", () => {
  it("trades inside the state hash, replays from its log, and changes nothing else in the world", () => {
    const traded = traderSim(SEED);
    const acts = script(simWorld(traded));
    const notices: Notice[] = [];
    play(traded, END, acts, notices);
    const p = simWorld(traded).player;
    if (p === null) throw new Error("no player");
    expect(p.fills.length).toBeGreaterThanOrEqual(3);
    expect(p.actions.length).toBe([...acts.values()].flat().length);
    // A fill paused the game (pivot 2.4 item 1).
    expect(notices).toContainEqual({ kind: "Paused", reason: { kind: "Notification", id: 0 } });

    // The same actions at the same ticks: the same hash.
    const again = traderSim(SEED);
    play(again, END, acts);
    expect(simStateHash(again)).toBe(simStateHash(traded));

    // The recorded log replays to the same hash.
    const replayed = traderSim(SEED);
    play(replayed, END, fromLog(p.actions));
    expect(simStateHash(replayed)).toBe(simStateHash(traded));

    // The price taker: without the trades, every other part of the world and the RNG are the same.
    const idle = traderSim(SEED);
    play(idle, END, new Map());
    expect(simStateHash(idle)).not.toBe(simStateHash(traded));
    expect(withoutPlayer(simWorld(idle))).toBe(withoutPlayer(simWorld(traded)));
    expect(rngOf(idle)).toBe(rngOf(traded));
  });

  it("a save with an order resting loads and plays on to the same hash", () => {
    const acts = new Map<DateTime, PlayerAction[]>();
    const first = traderSim(SEED);
    const a = quoted(simWorld(first), 0);
    const price = simWorld(first).market.stocks[a.company]?.price ?? 0;
    // A limit sell far above the price rests through the save; a limit buy at 97% may fill later.
    acts.set(dateTimeAt(simDateYmd(2020, 1, 3), 4), [
      order(a.instrument, "Buy", 40),
      order(a.instrument, "Buy", 20, price * 0.97),
    ]);
    acts.set(dateTimeAt(simDateYmd(2020, 1, 4), 4), [order(a.instrument, "Sell", 40, price * 10)]);
    const mid = dateTimeAt(simDateYmd(2020, 1, 7), 5);
    play(first, mid, acts);
    expect(simWorld(first).player?.orders.some((o) => o.status === "Open")).toBe(true);
    const bytes = first.saveBytes();
    play(first, END, acts);

    const loaded = testSim(SEED + 1);
    const r = loaded.loadBytes(bytes);
    expect(r.ok).toBe(true);
    expect(loaded.now()).toBe(mid);
    play(loaded, END, acts);
    expect(simStateHash(loaded)).toBe(simStateHash(first));
  });

  it("the views show the account and keep fill and notification rows from one build to the next", () => {
    const sim = traderSim(SEED);
    const w = simWorld(sim);
    const a = quoted(w, 0);
    expect(sim.views().account.data.open).toBe(true);
    expect(sim.views().account.data.cash).toEqual([
      { venue: "Brokerage", cash: 50_000, reserved: 0 },
      { venue: "Exchange", cash: 0, reserved: 0 },
    ]);
    const t = dateTimeAt(simDateYmd(2020, 1, 3), 1);
    play(sim, t, new Map([[t, [order(a.instrument, "Buy", 25)]]]));
    // The action rebuilt the account at once (`on_act`).
    const placed = sim.views().account.data;
    expect(placed.orders).toMatchObject([
      { id: 0, status: "Open", avg_price: null, what: { kind: "Company", id: a.company } },
    ]);
    expect(placed.cash[0]?.reserved).toBeGreaterThan(0);
    sim.step();
    const v1 = sim.views();
    expect(v1.account.data.fills).toHaveLength(1);
    const fill = v1.account.data.fills[0];
    const note = v1.notifications.data.items[0];
    // `views()` is the live set: keep the version now.
    const version = v1.account.version;
    expect(v1.account.data.orders[0]).toMatchObject({
      status: "Filled",
      reason: "Filled",
      avg_price: fill?.price,
    });
    expect(v1.account.data.positions).toMatchObject([
      { qty: 25, side: "Long", what: { kind: "Company", id: a.company as CompanyId } },
    ]);
    expect(note).toMatchObject({ id: 0, kind: "Fill", paused: true, fixed: "OwnFill" });
    sim.step();
    const v2 = sim.views();
    expect(v2.account.version).toBeGreaterThan(version);
    expect(v2.account.data.fills[0]).toBe(fill);
    expect(v2.notifications.data.items[0]).toBe(note);
    expect(sim.act({ kind: "NotificationsRead", through: 0 }).ok).toBe(true);
    expect(sim.views().notifications.data.read_through).toBe(0);
    expect(sim.views().notifications.data.items[0]).toBe(note);
  });
});
