// The real worker's host, run in-process (no Worker): NewGame, Control SetSpeed, ticks, Save and
// Load, checking frame-before-reply, patch versions, news_reset on a load, and the clock's pacing
// against D8's speeds with a controlled clock.

import type { FromSim, Reply, ToSim } from "@tc20ff/sim";
import { FRAME_MS, SECONDS_PER_HOUR } from "@tc20ff/sim";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { CATCH_UP_TICKS, RealHost } from "../src/sim/real/host.ts";

let host: RealHost;
beforeAll(() => {
  const data = loadWorld(defaultDataDir());
  if (!data.ok) throw new Error(JSON.stringify(data.error));
  host = new RealHost(data.value);
});

/** A fake monotonic clock: each read advances it by `stepMs`, so a budget loop terminates. */
function fakeNow(stepMs: number) {
  let t = 0;
  return () => {
    t += stepMs;
    return t;
  };
}

let nextId = 1;
const send = (h: RealHost, msg: DistributiveOmit<ToSim, "id">): FromSim[] =>
  h.handle({ ...msg, id: nextId++ } as ToSim);
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

const replyOf = (out: FromSim[]): Reply => {
  const r = out.at(-1);
  if (r?.kind !== "Reply") throw new Error("last message is not a Reply");
  return r.result;
};
const frames = (out: FromSim[]) => out.filter((m) => m.kind === "Frame");
const clockNow = (out: FromSim[]) => {
  const f = frames(out).at(-1);
  if (f?.kind !== "Frame") throw new Error("no frame");
  return f.clock.now;
};

describe("RealHost", () => {
  it("answers NewGame with a full Frame before the Reply, news reset", () => {
    const out = send(host, { kind: "NewGame", seed: 7 });
    expect(out.map((m) => m.kind)).toEqual(["Frame", "Reply"]);
    expect(replyOf(out)).toEqual({ kind: "Ok", notices: [] });
    const f = out[0];
    if (f?.kind !== "Frame") throw new Error("frame first");
    expect(f.clock.now).toBe(0);
    expect(f.clock.paused).toBe(true);
    expect(f.views.clock?.version).toBeGreaterThanOrEqual(0);
    // The news feed is whole-replaced on a new game, and only when its builder is ported.
    if (f.views.news_appended !== undefined) expect(f.views.news_reset).toBe(true);
  });

  it("refuses NewGame, Save and Load as controls", () => {
    for (const kind of ["NewGame", "Save", "Load"] as const) {
      const control = (kind === "NewGame" ? { kind, seed: 1 } : { kind, path: "x" }) as never;
      const out = send(host, { kind: "Control", control });
      expect(out).toHaveLength(1);
      expect(replyOf(out).kind).toBe("Refused");
    }
  });

  it("refuses requests before any game", () => {
    const fresh = new RealHost((host as unknown as { data: never }).data);
    expect(replyOf(send(fresh, { kind: "Save" })).kind).toBe("Refused");
    expect(replyOf(send(fresh, { kind: "Control", control: { kind: "Pause" } })).kind).toBe("Refused");
    expect(fresh.tick(1000)).toEqual([]);
  });

  it("returns a SimError for a bad speed, with no frame", () => {
    const out = send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 9 } });
    expect(out.map((m) => m.kind)).toEqual(["Reply"]);
    expect(replyOf(out)).toEqual({ kind: "SimError", error: { kind: "BadSpeed", speed: 9 } });
  });

  it("runs nothing while paused", () => {
    send(host, { kind: "NewGame", seed: 7 });
    expect(host.tick(60_000)).toEqual([]);
  });

  it("paces speeds 1 to 4 at D8's game hour per real time, one frame per call", () => {
    for (const speed of [1, 2, 3, 4]) {
      send(host, { kind: "NewGame", seed: 7 });
      const out = send(host, { kind: "Control", control: { kind: "SetSpeed", speed } });
      expect(replyOf(out).kind).toBe("Ok");
      const stepMs = (SECONDS_PER_HOUR[speed - 1] as number) * 1000;
      // Less than one hour of real time owes no tick.
      expect(host.tick(stepMs - 1)).toEqual([]);
      // The rest completes the first hour: one frame, one tick.
      const one = host.tick(1);
      expect(one.map((m) => m.kind)).toEqual(["Frame"]);
      expect(clockNow(one)).toBe(1);
      // Three hours of real time in one call run three ticks in one frame.
      const three = host.tick(3 * stepMs);
      expect(three).toHaveLength(1);
      expect(clockNow(three)).toBe(4);
      const f = three[0];
      if (f?.kind !== "Frame") throw new Error("frame");
      expect(f.notices.filter((n) => n.kind === "TickDone")).toHaveLength(3);
    }
  });

  it("caps the catch-up after a long stall", () => {
    send(host, { kind: "NewGame", seed: 7 });
    send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 4 } });
    const out = host.tick(3_600_000);
    expect(clockNow(out)).toBe(CATCH_UP_TICKS);
  });

  it("runs many ticks per frame at max, within the budget", () => {
    const data = (host as unknown as { data: never }).data;
    // The budget clock advances 1 ms per read, a 12 ms budget: 12 ticks, then the frame ends.
    const h = new RealHost(data, { now: fakeNow(1), budgetMs: 12 });
    send(h, { kind: "NewGame", seed: 7 });
    send(h, { kind: "Control", control: { kind: "SetSpeed", speed: 5 } });
    const out = h.tick(FRAME_MS);
    expect(out).toHaveLength(1);
    expect(clockNow(out)).toBe(12);
    const next = h.tick(FRAME_MS);
    expect(clockNow(next)).toBe(24);
  });

  it("stops a max-speed frame at a pause, and a skip pauses with SkipDone", () => {
    const data = (host as unknown as { data: never }).data;
    const h = new RealHost(data, { now: fakeNow(0), budgetMs: 12 });
    send(h, { kind: "NewGame", seed: 7 });
    send(h, { kind: "Control", control: { kind: "SkipTo", skip: "MonthEnd" } });
    // A zero-cost clock never exhausts the budget, so only the skip target ends the frame.
    const out = h.tick(FRAME_MS);
    const f = out[0];
    if (f?.kind !== "Frame") throw new Error("frame");
    expect(f.clock.paused).toBe(true);
    expect(f.clock.date).toEqual({ year: 2020, month: 2, day: 1 });
    expect(f.notices.some((n) => n.kind === "Paused")).toBe(true);
    expect(h.tick(FRAME_MS)).toEqual([]);
  });

  it("saves and loads: Saved bytes, then a Frame (news reset) before the load's Reply", () => {
    send(host, { kind: "NewGame", seed: 7 });
    send(host, { kind: "Control", control: { kind: "SetSpeed", speed: 4 } });
    const ticked = host.tick(3 * 200);
    const savedAt = clockNow(ticked);
    expect(savedAt).toBe(3);

    const saved = replyOf(send(host, { kind: "Save" }));
    if (saved.kind !== "Saved") throw new Error("expected Saved");
    expect(saved.bytes.length).toBeGreaterThan(0);

    // Move on, then load: back at the saved time, paused, with the whole feed to replace the UI's.
    host.tick(5 * 200);
    const out = send(host, { kind: "Load", bytes: saved.bytes });
    expect(out.map((m) => m.kind)).toEqual(["Frame", "Reply"]);
    const f = out[0];
    if (f?.kind !== "Frame") throw new Error("frame first");
    expect(f.clock.now).toBe(savedAt);
    expect(f.clock.paused).toBe(true);
    expect(f.notices).toContainEqual({ kind: "Paused", reason: { kind: "Loaded" } });
    expect(replyOf(out)).toEqual({ kind: "Ok", notices: f.notices });
    if (f.views.news_appended !== undefined) expect(f.views.news_reset).toBe(true);
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
    const a = host.tick(200)[0];
    const b = host.tick(200)[0];
    if (a?.kind !== "Frame" || b?.kind !== "Frame") throw new Error("frames");
    expect(a.views.clock?.version).toBeDefined();
    expect(b.views.clock?.version).toBeGreaterThan(a.views.clock?.version as number);
    // Once-at-load views are not re-posted by plain ticks.
    expect(b.views.news_reset).toBeUndefined();
  });
});
