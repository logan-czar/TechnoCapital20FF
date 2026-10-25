// The real worker's host and loop, run in-process (no Worker): NewGame, Control SetSpeed, ticks,
// Save and Load, checking frame-before-reply, patch versions, news_reset on a load, the clock's
// pacing against D8's speeds, the loop's timer and queue-until-Ready, and the single Fatal.

import type { FromSim, Reply, ToSim } from "@tc20ff/sim";
import { FRAME_MS, SECONDS_PER_HOUR } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CATCH_UP_TICKS, RealHost } from "../src/sim/real/host.ts";
import { WorkerLoop } from "../src/sim/real/loop.ts";

let data: WorldData;
beforeAll(() => {
  const loaded = loadWorld(defaultDataDir());
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  data = loaded.value;
});

/** A fake monotonic clock: each read advances it by `stepMs`, so a budget loop terminates. */
function fakeNow(stepMs: number) {
  let t = 0;
  return () => {
    t += stepMs;
    return t;
  };
}

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
let nextId = 1;
const send = (h: RealHost, msg: DistributiveOmit<ToSim, "id">): FromSim[] =>
  h.handle({ ...msg, id: nextId++ } as ToSim);

const replyOf = (out: FromSim[]): Reply => {
  const r = out.at(-1);
  if (r?.kind !== "Reply") throw new Error("last message is not a Reply");
  return r.result;
};
const frameOf = (out: FromSim[]) => {
  const f = out.find((m) => m.kind === "Frame");
  if (f?.kind !== "Frame") throw new Error("no frame");
  return f;
};
const clockNow = (out: FromSim[]) => frameOf(out).clock.now;
const tickDones = (out: FromSim[]) => frameOf(out).notices.filter((n) => n.kind === "TickDone").length;

describe("RealHost", () => {
  let host: RealHost;
  beforeEach(() => {
    host = new RealHost(data);
  });

  it("answers NewGame with a full Frame before the Reply", () => {
    const out = send(host, { kind: "NewGame", seed: 7 });
    expect(out.map((m) => m.kind)).toEqual(["Frame", "Reply"]);
    expect(replyOf(out)).toEqual({ kind: "Ok", notices: [] });
    const f = frameOf(out);
    expect(f.clock.now).toBe(0);
    expect(f.clock.paused).toBe(true);
    expect(f.views.clock?.version).toBeGreaterThanOrEqual(0);
  });

  it("resets the news feed on a new game and on a load", (ctx) => {
    const first = frameOf(send(host, { kind: "NewGame", seed: 7 }));
    // The news builder is not ported on main yet (D962: unported views are never posted), so there
    // is no feed to reset; this runs as soon as the builder lands.
    if (first.views.news_appended === undefined) return ctx.skip();
    expect(first.views.news_reset).toBe(true);
    const saved = replyOf(send(host, { kind: "Save" }));
    if (saved.kind !== "Saved") throw new Error("expected Saved");
    const loaded = frameOf(send(host, { kind: "Load", bytes: saved.bytes }));
    expect(loaded.views.news_reset).toBe(true);
    expect(loaded.views.news_appended).toBeDefined();
  });

  it("refuses NewGame, Save and Load as controls", () => {
    send(host, { kind: "NewGame", seed: 7 });
    for (const kind of ["NewGame", "Save", "Load"] as const) {
      const control = (kind === "NewGame" ? { kind, seed: 1 } : { kind, path: "x" }) as never;
      const out = send(host, { kind: "Control", control });
      expect(out).toHaveLength(1);
      expect(replyOf(out).kind).toBe("Refused");
    }
  });

  it("refuses requests before any game", () => {
    expect(replyOf(send(host, { kind: "Save" })).kind).toBe("Refused");
    expect(replyOf(send(host, { kind: "Control", control: { kind: "Pause" } })).kind).toBe("Refused");
    expect(host.tick(1000)).toEqual([]);
  });

  it("returns a SimError for a bad speed, with no frame", () => {
    send(host, { kind: "NewGame", seed: 7 });
    const out = send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 9 } });
    expect(out.map((m) => m.kind)).toEqual(["Reply"]);
    expect(replyOf(out)).toEqual({ kind: "SimError", error: { kind: "BadSpeed", speed: 9 } });
  });

  it("runs nothing while paused", () => {
    send(host, { kind: "NewGame", seed: 7 });
    expect(host.tick(60_000)).toEqual([]);
  });

  it.each([1, 2, 3, 4])("paces speed %i at D8's game hour per real time, one frame per call", (speed) => {
    send(host, { kind: "NewGame", seed: 7 });
    expect(replyOf(send(host, { kind: "Control", control: { kind: "SetSpeed", speed } })).kind).toBe("Ok");
    const stepMs = (SECONDS_PER_HOUR[speed - 1] as number) * 1000;
    // Less than one hour of real time owes no tick; the rest completes the first hour.
    expect(host.tick(stepMs - 1)).toEqual([]);
    const one = host.tick(1);
    expect(one.map((m) => m.kind)).toEqual(["Frame"]);
    expect(clockNow(one)).toBe(1);
    // Three hours of real time in one call run three ticks in one frame.
    const three = host.tick(3 * stepMs);
    expect(three).toHaveLength(1);
    expect(clockNow(three)).toBe(4);
    expect(tickDones(three)).toBe(3);
  });

  it("keeps the real time owed across controls that do not change the pacing", () => {
    send(host, { kind: "NewGame", seed: 7 });
    send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 1 } });
    expect(host.tick(1900)).toEqual([]);
    // A stream of alert and watchlist controls must not stall the clock at speed 1.
    for (let i = 0; i < 5; i++) {
      const out = send(host, {
        kind: "Control",
        control: { kind: "SetAlert", alert_kind: "EarningsDay", level: i % 2 === 0 ? "Pause" : "Notify" },
      });
      expect(replyOf(out).kind).toBe("Ok");
    }
    expect(clockNow(host.tick(100))).toBe(1);
    // A pacing change does drop the debt: 1900 ms owed, then speed 2 (1 s/hour), then 900 ms.
    send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 1 } });
    expect(host.tick(1900)).toEqual([]);
    send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 2 } });
    expect(host.tick(900)).toEqual([]);
  });

  it("caps the catch-up after a long stall", () => {
    send(host, { kind: "NewGame", seed: 7 });
    send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 4 } });
    expect(clockNow(host.tick(3_600_000))).toBe(CATCH_UP_TICKS);
  });

  it("runs many ticks per frame at max, within the budget", () => {
    // The budget clock advances 1 ms per read, a 12 ms budget: 12 ticks, then the frame ends.
    const h = new RealHost(data, { now: fakeNow(1), budgetMs: 12 });
    send(h, { kind: "NewGame", seed: 7 });
    send(h, { kind: "Control", control: { kind: "SetSpeed", speed: 5 } });
    const out = h.tick(FRAME_MS);
    expect(out).toHaveLength(1);
    expect(clockNow(out)).toBe(12);
    expect(clockNow(h.tick(FRAME_MS))).toBe(24);
  });

  it("ends a SkipTo at its target, paused, with a SkipDone notice", () => {
    const h = new RealHost(data, { now: fakeNow(0), budgetMs: 12 });
    send(h, { kind: "NewGame", seed: 7 });
    send(h, { kind: "Control", control: { kind: "SkipTo", skip: "MonthEnd" } });
    // A zero-cost clock never exhausts the budget, so only the skip target ends the frame.
    const f = frameOf(h.tick(FRAME_MS));
    expect(f.clock.paused).toBe(true);
    expect(f.clock.date).toEqual({ year: 2020, month: 2, day: 1 });
    expect(f.notices.some((n) => n.kind === "Paused")).toBe(true);
    expect(h.tick(FRAME_MS)).toEqual([]);
  });

  it("saves and loads: Saved bytes, then a Frame before the load's Reply", () => {
    send(host, { kind: "NewGame", seed: 7 });
    send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 4 } });
    const savedAt = clockNow(host.tick(3 * 200));
    expect(savedAt).toBe(3);
    const saved = replyOf(send(host, { kind: "Save" }));
    if (saved.kind !== "Saved") throw new Error("expected Saved");
    expect(saved.bytes.length).toBeGreaterThan(0);

    // Move on, then load: back at the saved time, paused.
    host.tick(5 * 200);
    const out = send(host, { kind: "Load", bytes: saved.bytes });
    expect(out.map((m) => m.kind)).toEqual(["Frame", "Reply"]);
    const f = frameOf(out);
    expect(f.clock.now).toBe(savedAt);
    expect(f.clock.paused).toBe(true);
    expect(f.notices).toContainEqual({ kind: "Paused", reason: { kind: "Loaded" } });
    expect(replyOf(out)).toEqual({ kind: "Ok", notices: f.notices });
    // Nothing runs after a load until the player resumes.
    expect(host.tick(10_000)).toEqual([]);
  });

  it("rejects a bad save without a frame", () => {
    const out = send(host, { kind: "Load", bytes: new Uint8Array([1, 2, 3]) });
    expect(out.map((m) => m.kind)).toEqual(["Reply"]);
    expect(replyOf(out).kind).toBe("SimError");
  });

  it("posts a view only when its version moved", () => {
    send(host, { kind: "NewGame", seed: 7 });
    send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 4 } });
    const a = frameOf(host.tick(200));
    const b = frameOf(host.tick(200));
    expect(b.views.clock?.version).toBeGreaterThan(a.views.clock?.version as number);
    // A view that does not change between ticks (the once-at-load economy tables, say) is absent
    // from the second patch; whatever the first posted beyond the per-tick views must not repeat.
    const perTick = new Set(["clock", "refresh", "omniscient"]);
    for (const k of Object.keys(b.views)) {
      if (perTick.has(k)) continue;
      expect(a.views[k as keyof typeof a.views]).not.toBe(b.views[k as keyof typeof b.views]);
    }
    expect(b.views.news_reset).toBeUndefined();
    // A request that changes nothing in a view leaves it out: a SetAlert moves no data view.
    const ctl = frameOf(
      send(host, {
        kind: "Control",
        control: { kind: "SetAlert", alert_kind: "EarningsDay", level: "Notify" },
      }),
    );
    expect(ctl.views.company_rows).toBeUndefined();
    expect(ctl.views.news_reset).toBeUndefined();
  });
});

describe("WorkerLoop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function loopOf(load: () => Promise<RealHost>) {
    const posted: FromSim[] = [];
    const loop = new WorkerLoop({
      post: (m) => posted.push(m),
      load,
      now: () => performance.now(),
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    });
    return { loop, posted };
  }

  it("queues requests until the data is loaded, then posts Ready and answers them in order", async () => {
    const loaded = Promise.withResolvers<RealHost>();
    const finish = loaded.resolve;
    const { loop, posted } = loopOf(() => loaded.promise);
    const started = loop.start();
    loop.onMessage({ kind: "NewGame", id: 1, seed: 7 });
    loop.onMessage({ kind: "Control", id: 2, control: { kind: "SetSpeed", speed: 4 } });
    expect(posted).toEqual([]);
    finish(new RealHost(data));
    await started;
    expect(posted.map((m) => m.kind)).toEqual(["Ready", "Frame", "Reply", "Frame", "Reply"]);
    expect(posted.filter((m) => m.kind === "Reply").map((m) => (m as { id: number }).id)).toEqual([1, 2]);
    // The timer is running now: 200 ms is one hour at speed 4 (about 12 timer calls).
    posted.length = 0;
    vi.advanceTimersByTime(200 + FRAME_MS);
    const frames = posted.filter((m) => m.kind === "Frame");
    expect(frames).toHaveLength(1);
    expect(clockNow(frames)).toBe(1);
  });

  it("runs the clock off timer dt: at most one Frame per timer call, none while paused", async () => {
    const { loop, posted } = loopOf(async () => new RealHost(data));
    await loop.start();
    loop.onMessage({ kind: "NewGame", id: 1, seed: 7 });
    vi.advanceTimersByTime(5000);
    expect(posted.filter((m) => m.kind === "Frame")).toHaveLength(1); // the NewGame frame only
    loop.onMessage({ kind: "Control", id: 2, control: { kind: "SetSpeed", speed: 4 } });
    posted.length = 0;
    vi.advanceTimersByTime(2000);
    const frames = posted.filter((m) => m.kind === "Frame");
    // 2 s at 0.2 s per hour: 10 ticks, each in its own frame at most one per FRAME_MS.
    expect(frames.reduce((n, f) => n + tickDones([f]), 0)).toBeGreaterThanOrEqual(9);
    expect(frames.length).toBeLessThanOrEqual(Math.ceil(2000 / FRAME_MS));
  });

  it("posts exactly one Fatal on a throw, stops the timer and refuses later requests", async () => {
    const host = new RealHost(data);
    const { loop, posted } = loopOf(async () => host);
    await loop.start();
    loop.onMessage({ kind: "NewGame", id: 1, seed: 7 });
    loop.onMessage({ kind: "Control", id: 2, control: { kind: "SetSpeed", speed: 4 } });
    posted.length = 0;
    vi.spyOn(host, "tick").mockImplementation(() => {
      throw new Error("sim panic");
    });
    vi.advanceTimersByTime(1000);
    expect(posted.filter((m) => m.kind === "Fatal")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    // A throw inside handle goes to the same single Fatal, not a second one.
    vi.spyOn(host, "handle").mockImplementation(() => {
      throw new Error("again");
    });
    loop.onMessage({ kind: "Save", id: 3 });
    expect(posted.filter((m) => m.kind === "Fatal")).toHaveLength(1);
    expect(posted.at(-1)).toEqual({
      kind: "Reply",
      id: 3,
      result: { kind: "Refused", message: "the sim worker stopped" },
    });
  });

  it("posts one Fatal when a request handler throws, and when loading fails", async () => {
    const host = new RealHost(data);
    const a = loopOf(async () => host);
    await a.loop.start();
    vi.spyOn(host, "handle").mockImplementation(() => {
      throw new Error("boom");
    });
    a.loop.onMessage({ kind: "Save", id: 1 });
    a.loop.onMessage({ kind: "Save", id: 2 });
    expect(a.posted.filter((m) => m.kind === "Fatal")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);

    const b = loopOf(async () => {
      throw new Error("load failed");
    });
    await b.loop.start();
    expect(b.posted.map((m) => m.kind)).toEqual(["Fatal"]);
  });
});
