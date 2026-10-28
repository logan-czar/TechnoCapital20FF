// The protocol client and the mock sim: frame-before-reply ordering, patch merge, news append and
// reset, and the mock clock's pacing against D8's speeds.

import type { CompanyId, FromSim, SimViews, ToSim } from "@tc20ff/sim";
import { ALERT_KIND_VALUES, barRows, MAX_SPEED, SECONDS_PER_HOUR } from "@tc20ff/sim";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { SimClient, type SimTransport } from "../src/sim/client.ts";
import { SimHost } from "../src/sim/mock/host.ts";
import { MAX_TICKS_PER_ADVANCE, MockSim } from "../src/sim/mock/mockSim.ts";
import { buildMockWorld, type MockWorld } from "../src/sim/mock/mockWorld.ts";
import { SimStore } from "../src/sim/store.ts";

let world: MockWorld;
beforeAll(() => {
  const data = loadWorld(defaultDataDir());
  if (!data.ok) throw new Error(JSON.stringify(data.error));
  world = buildMockWorld(data.value);
});

/** A transport wired to a host in-process; replies arrive on a microtask, like postMessage. */
function wire(host: SimHost) {
  const log: FromSim[] = [];
  let deliver: (m: FromSim) => void = () => {};
  let fail: (message: string) => void = () => {};
  const transport: SimTransport = {
    send(msg: ToSim) {
      for (const out of host.handle(msg)) {
        queueMicrotask(() => {
          log.push(out);
          deliver(out);
        });
      }
    },
    onMessage(cb) {
      deliver = cb;
    },
    onFailure(cb) {
      fail = cb;
    },
  };
  const post = (out: FromSim) => {
    log.push(out);
    deliver(out);
  };
  return { transport, log, post, fail: (m: string) => fail(m) };
}

describe("client", () => {
  it("posts a request's Frame before its Reply, so awaited views are current", async () => {
    const host = new SimHost(world);
    const { transport, log, post } = wire(host);
    const client = new SimClient(transport);
    post({ kind: "Ready" });
    await client.ready;
    expect(client.store.getView("clock")).toBeUndefined();
    const reply = await client.newGame(7);
    expect(reply.kind).toBe("Ok");
    expect(log.map((m) => m.kind)).toEqual(["Ready", "Frame", "Reply"]);
    // The views were there when the awaited reply resolved.
    expect(client.store.getView("clock")?.data.paused).toBe(true);
    expect(client.store.getView("company_rows")?.data.rows.length).toBeGreaterThan(100);

    await client.control({ kind: "SetSpeed", speed: 3 });
    expect(log.map((m) => m.kind).slice(-2)).toEqual(["Frame", "Reply"]);
    expect(client.store.getView("clock")?.data.speed).toBe(3);
    expect(client.store.getView("clock")?.data.paused).toBe(false);
  });

  it("answers errors and refusals as replies", async () => {
    const host = new SimHost(world);
    const { transport, post } = wire(host);
    const client = new SimClient(transport);
    post({ kind: "Ready" });
    expect((await client.control({ kind: "Pause" })).kind).toBe("Refused");
    await client.newGame(1);
    const bad = await client.control({ kind: "SetSpeed", speed: 9 });
    expect(bad).toEqual({ kind: "SimError", error: { kind: "BadSpeed", speed: 9 } });
    const omni = await client.control({ kind: "SetOmniscient", on: true });
    expect(omni).toEqual({ kind: "SimError", error: { kind: "DebugOnly" } });
  });

  it("round-trips a save", async () => {
    const host = new SimHost(world);
    const { transport, post } = wire(host);
    const client = new SimClient(transport);
    post({ kind: "Ready" });
    await client.newGame(3);
    host.sim?.step();
    const bytes = await client.save();
    expect(bytes).not.toBeNull();
    const loaded = await client.load(bytes as Uint8Array);
    expect(loaded.kind).toBe("Ok");
    expect(client.store.getView("clock")?.data.now).toBe(1);
    expect(client.store.getView("clock")?.data.paused).toBe(true);
    expect((await client.load(new Uint8Array([1, 2, 3]))).kind).toBe("SimError");
  });
});

describe("store", () => {
  it("replaces only the views a frame carries and notifies only those keys", () => {
    const host = new SimHost(world);
    const first = host.handle({ kind: "NewGame", id: 1, seed: 1 })[0] as FromSim;
    const store = new SimStore();
    const hits: string[] = [];
    store.subscribe("quotes", () => hits.push("quotes"));
    store.subscribe("company_rows", () => hits.push("company_rows"));
    if (first.kind !== "Frame") throw new Error("expected a frame");
    store.applyFrame(first);
    expect(hits.sort()).toEqual(["company_rows", "quotes"]);
    const rows = store.getView("company_rows");

    hits.length = 0;
    const sim = host.sim as MockSim;
    sim.step();
    // The step moved the clock and quotes (nothing else is due at 01:00).
    const frame = host.tick(0)[0];
    if (frame?.kind !== "Frame") throw new Error("expected a frame");
    store.applyFrame(frame);
    expect(hits).toEqual(["quotes"]);
    expect(store.getView("company_rows")).toBe(rows);
    expect(store.getView("clock")?.data.now).toBe(1);
  });

  it("appends news_appended to the feed and replaces it on news_reset", () => {
    const store = new SimStore();
    const h = (id: number) => ({ id, text: `h${id}` }) as unknown as SimViews["news"]["data"]["feed"][number];
    const clockView = {} as never;
    const frame = (views: object): FromSim => ({ kind: "Frame", notices: [], clock: clockView, views });
    const apply = (m: FromSim) => {
      if (m.kind === "Frame") store.applyFrame(m);
    };
    apply(frame({ news_appended: [h(0), h(1)], news_version: 1, news_reset: true }));
    expect(store.getView("news")?.data.feed.map((x) => x.id)).toEqual([0, 1]);
    apply(frame({ news_appended: [h(2)], news_version: 2 }));
    expect(store.getView("news")?.data.feed.map((x) => x.id)).toEqual([0, 1, 2]);
    expect(store.getView("news")?.version).toBe(2);
    apply(frame({ news_appended: [h(0)], news_version: 1, news_reset: true }));
    expect(store.getView("news")?.data.feed.map((x) => x.id)).toEqual([0]);
  });

  it("a new game or load sends news_reset; later frames only append", () => {
    const host = new SimHost(world);
    const f1 = host.handle({ kind: "NewGame", id: 1, seed: 1 })[0];
    expect(f1?.kind === "Frame" && f1.views.news_reset).toBe(true);
    const sim = host.sim as MockSim;
    sim.paused = false;
    for (let i = 0; i < 25; i++) sim.step();
    const f2 = host.tick(0)[0];
    expect(f2?.kind === "Frame" && f2.views.news_reset).toBeUndefined();
    expect(f2?.kind === "Frame" && (f2.views.news_appended?.length ?? 0)).toBeGreaterThan(0);
    const f3 = host.handle({ kind: "NewGame", id: 2, seed: 1 })[0];
    expect(f3?.kind === "Frame" && f3.views.news_reset).toBe(true);
  });
});

describe("client failures and replies", () => {
  it("settles every pending request when the worker fails, and reports it", async () => {
    // A transport that never answers, then fails.
    let fail: (m: string) => void = () => {};
    const transport: SimTransport = {
      send() {},
      onMessage() {},
      onFailure(cb) {
        fail = cb;
      },
    };
    const client = new SimClient(transport);
    const a = client.control({ kind: "Pause" });
    const b = client.save();
    fail("boom");
    expect(await a).toEqual({ kind: "Refused", message: "boom" });
    expect(await b).toBeNull();
    expect(client.store.status.fatal).toBe("boom");
    // Later requests are refused at once instead of hanging.
    expect((await client.control({ kind: "Resume" })).kind).toBe("Refused");
    await client.ready;
  });

  it("a Fatal message settles pending requests too", async () => {
    const host = new SimHost(world);
    const { transport, post } = wire(host);
    const client = new SimClient(transport);
    const p = client.control({ kind: "Pause" });
    post({ kind: "Fatal", message: "sim panic" });
    expect((await p).kind).toBe("Refused");
    expect(client.store.status.fatal).toBe("sim panic");
  });

  it("shows error replies as messages", async () => {
    const host = new SimHost(world);
    const { transport, post } = wire(host);
    const client = new SimClient(transport);
    post({ kind: "Ready" });
    await client.newGame(1);
    await client.control({ kind: "SetSpeed", speed: 9 });
    await client.load(new Uint8Array([1]));
    expect(client.store.messages.map((m) => m.level)).toEqual(["error", "error"]);
    expect(client.store.messages[0]?.text).toContain("speed 9");
  });

  it("merges reply notices once, even when the frame repeated them", async () => {
    const host = new SimHost(world);
    const { transport, post } = wire(host);
    const client = new SimClient(transport);
    post({ kind: "Ready" });
    await client.newGame(1);
    await client.control({ kind: "Resume" });
    await client.control({ kind: "Pause" });
    const paused = client.store.notices.filter((e) => e.notice.kind === "Paused");
    expect(paused).toHaveLength(1);
    // A worker that puts a notice only in the Reply still gets it logged.
    client.store.mergeReplyNotices(
      [{ kind: "Paused", reason: { kind: "Loaded" } }],
      client.store.noticeMark(),
    );
    expect(client.store.notices.filter((e) => e.notice.kind === "Paused")).toHaveLength(2);
  });
});

describe("price bars", () => {
  it("the mock keeps bars in monthly chunks and barRows flattens them all", () => {
    const sim = new MockSim(world, 1);
    const h = sim.views.price_bars.data.companies[0];
    if (!h) throw new Error("no bars");
    expect(h.bars.log.closed.len).toBeGreaterThan(3);
    const rows = barRows(h.bars);
    expect(rows).toHaveLength(180);

    // Oldest first, across chunk borders.
    const days = rows.map((b) => b.date.year * 10000 + b.date.month * 100 + b.date.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    // A day closes: one more bar, still whole.
    sim.paused = false;
    for (let i = 0; i < 24; i++) sim.step();
    const after = sim.views.price_bars.data.companies[0];
    expect(barRows((after as NonNullable<typeof after>).bars)).toHaveLength(181);
  });
});

describe("mock clock pacing (D8)", () => {
  const running = (speed: number) => {
    const sim = new MockSim(world, 1);
    sim.apply({ kind: "SetSpeed", speed });
    return sim;
  };
  const ticks = (sim: MockSim, dtMs: number) => sim.advance(dtMs).filter((n) => n.kind === "TickDone").length;

  it("starts paused at 2020-01-01 00:00 and does not move while paused", () => {
    const sim = new MockSim(world, 1);
    expect(sim.paused).toBe(true);
    expect(sim.now).toBe(0);
    expect(sim.advance(100_000)).toEqual([]);
    expect(sim.now).toBe(0);
  });

  it("runs one game hour per SECONDS_PER_HOUR at speeds 1 to 4", () => {
    for (let speed = 1; speed < MAX_SPEED; speed++) {
      const sph = SECONDS_PER_HOUR[speed - 1] as number;
      const sim = running(speed);
      expect(ticks(sim, sph * 1000 - 1)).toBe(0);
      expect(ticks(sim, 1)).toBe(1);
      expect(ticks(sim, sph * 3000)).toBe(3);
      expect(sim.now).toBe(4);
    }
  });

  it("runs a frame budget of ticks at max speed", () => {
    const sim = running(MAX_SPEED);
    sim.alerts = sim.alerts.map(() => "Off");
    expect(ticks(sim, 16)).toBe(MAX_TICKS_PER_ADVANCE);
  });

  it("pauses on a Pause alert before the final TickDone, then stays paused", () => {
    const sim = running(MAX_SPEED);
    // Jan 2 00:00 is the release: Earnings day pauses by default (spec 8).
    let notices: ReturnType<MockSim["advance"]> = [];
    for (let i = 0; i < 3 && !sim.paused; i++) notices = sim.advance(16);
    expect(sim.paused).toBe(true);
    expect(sim.now).toBe(24);
    const kinds = notices.map((n) => n.kind);
    expect(kinds.at(-1)).toBe("TickDone");
    expect(kinds.at(-2)).toBe("Paused");
    expect(kinds).toContain("Alert");
    expect(sim.advance(10_000)).toEqual([]);
  });

  it("skips to a target at max speed, then pauses with SkipDone", () => {
    const sim = new MockSim(world, 1);
    for (const alert_kind of ALERT_KIND_VALUES) sim.apply({ kind: "SetAlert", alert_kind, level: "Off" });
    sim.apply({ kind: "SkipTo", skip: "MonthEnd" });
    expect(sim.effectiveSpeed()).toBe(MAX_SPEED);
    expect(sim.clock().skipping).toBe("MonthEnd");
    let last: ReturnType<MockSim["advance"]> = [];
    for (let i = 0; i < 40 && !sim.paused; i++) last = sim.advance(16);
    expect(sim.paused).toBe(true);
    expect(sim.skip).toBeNull();
    expect(sim.now).toBe(31 * 24);
    expect(last.some((n) => n.kind === "Paused" && n.reason.kind === "SkipDone")).toBe(true);
  });

  it("a patch carries only the views that moved", () => {
    const sim = running(MAX_SPEED);
    sim.takePatch();
    sim.step();
    const keys = Object.keys(sim.takePatch()).sort();
    expect(keys).toEqual(["clock", "quotes", "refresh"]);
  });

  it("the clock view carries the watchlist in id order (D975)", () => {
    const sim = new MockSim(world, 1);
    sim.apply({ kind: "WatchlistAdd", company: 3 as CompanyId });
    sim.apply({ kind: "WatchlistAdd", company: 1 as CompanyId });
    expect(sim.views.clock.data.watchlist).toEqual([1, 3]);
    sim.apply({ kind: "WatchlistRemove", company: 3 as CompanyId });
    expect(sim.views.clock.data.watchlist).toEqual([1]);
    expect(sim.views.clock.data.omniscient).toBe(false);
  });
});
