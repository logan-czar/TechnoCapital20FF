// Frames the UI can keep up with (D1004): price bars posted as new bars and joined back to the same
// history, and a running worker that holds its next frame until the last one is read.

import type { FromSim, Notice } from "@tc20ff/sim";
import { barRows, MAX_SPEED, priceBarsApply } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { loadWorld, worldDataDir } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { RealHost } from "../src/host.ts";

let data: WorldData;
beforeAll(() => {
  const loaded = loadWorld(worldDataDir("1995"));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  data = loaded.value;
});

function running(waitForFrameDone: boolean): RealHost {
  let t = 0;
  // Each read moves the clock a little, so a max-speed frame ends after a few ticks.
  const host = new RealHost(data, { waitForFrameDone, budgetMs: 4, now: () => t++ });
  host.handle({ kind: "NewGame", id: 1, seed: 3, scenario: "stable" });
  host.handle({ kind: "Control", id: 2, control: { kind: "SetSpeed", speed: MAX_SPEED } });
  return host;
}

const frameOf = (out: FromSim[]) => {
  const f = out.find((m) => m.kind === "Frame");
  if (f?.kind !== "Frame") throw new Error("no frame");
  return f;
};

describe("price bars in a frame", () => {
  it("come back to the sim's own history, far smaller than the view", () => {
    const host = new RealHost(data);
    const first = frameOf(host.handle({ kind: "NewGame", id: 1, seed: 3, scenario: "stable" }));
    expect(first.views.price_bars).toBeUndefined();
    let held = priceBarsApply(undefined, first.views.price_bars_delta as never);
    host.handle({ kind: "Control", id: 2, control: { kind: "SetSpeed", speed: 1 } });
    // Forty days of frames, past a month's close, so chunks close and join too.
    const sent: number[] = [];
    for (let i = 0; i < 960; i++) {
      for (const m of host.tick(2000)) {
        if (m.kind !== "Frame" || m.views.price_bars_delta === undefined) continue;
        expect(m.views.price_bars).toBeUndefined();
        sent.push(JSON.stringify(m.views.price_bars_delta).length);
        held = priceBarsApply(held, m.views.price_bars_delta);
      }
    }
    const view = host.sim?.views().price_bars;
    expect(held.version).toBe(view?.version);
    expect(held.data.companies.map((c) => c.id)).toEqual(view?.data.companies.map((c) => c.id));
    let bars = 0;
    for (const c of view?.data.companies ?? []) {
      const mine = held.data.companies.find((h) => h.id === c.id);
      const rows = mine ? barRows(mine.bars) : [];
      expect(rows).toEqual(barRows(c.bars));
      bars += rows.length;
    }
    expect(bars).toBeGreaterThan(0);
    // A day's frame is one bar a company, and the view is all of them. A month's close carries the
    // month's chunk, so the typical frame is the one to judge.
    const typical = sent.sort((a, b) => a - b)[sent.length >> 1] as number;
    expect(typical).toBeLessThan(JSON.stringify(view?.data).length / 4);
  }, 120_000);

  it("drop old chunks off the front, and resend a history that changed any other way", () => {
    const bar = (day: number) => ({ date: { year: 1995, month: 1, day } }) as never;
    const one = [bar(1)];
    const two = [bar(2)];
    const start = priceBarsApply(undefined, {
      version: 1,
      dirty: true,
      removed: [],
      rows: [{ id: 7 as never, reset: true, drop: 0, closed: [one, two], open_reset: true, open: [bar(3)] }],
    });
    const dropped = priceBarsApply(start, {
      version: 2,
      dirty: true,
      removed: [],
      rows: [{ id: 7 as never, reset: false, drop: 1, closed: [], open_reset: false, open: [bar(4)] }],
    });
    expect(barRows(dropped.data.companies[0]?.bars as never).map((b) => b.date.day)).toEqual([2, 3, 4]);
    const reset = priceBarsApply(dropped, {
      version: 3,
      dirty: true,
      removed: [],
      rows: [{ id: 7 as never, reset: true, drop: 0, closed: [], open_reset: true, open: [bar(9)] }],
    });
    expect(barRows(reset.data.companies[0]?.bars as never).map((b) => b.date.day)).toEqual([9]);
    const gone = priceBarsApply(reset, { version: 4, dirty: true, removed: [7 as never], rows: [] });
    expect(gone.data.companies).toEqual([]);
  });
});

describe("a running worker", () => {
  it("holds its next frame until the last is read, and loses no notice", () => {
    const host = running(true);
    // The two requests' frames are unread.
    expect(host.tick(16)).toEqual([]);
    host.handle({ kind: "FrameDone" });
    expect(host.tick(16)).toEqual([]);
    host.handle({ kind: "FrameDone" });
    const a = frameOf(host.tick(16));
    const ticksA = a.notices.filter((n: Notice) => n.kind === "TickDone").length;
    // Unread: ticks go on, and no frame goes out.
    const clockBefore = host.sim?.now() ?? 0;
    expect(host.tick(16)).toEqual([]);
    expect(host.tick(16)).toEqual([]);
    expect(host.sim?.now()).toBeGreaterThan(clockBefore);
    host.handle({ kind: "FrameDone" });
    const b = frameOf(host.tick(16));
    const ticksB = b.notices.filter((n: Notice) => n.kind === "TickDone").length;
    expect(ticksA + ticksB).toBe(Number(host.sim?.now()) - Number(firstTick(a)) + 1);
    expect(b.clock.now).toBe(host.sim?.now());
  });

  it("posts the last frame after a pause, once the one before is read", () => {
    const host = running(true);
    host.handle({ kind: "FrameDone" });
    host.handle({ kind: "FrameDone" });
    frameOf(host.tick(16));
    expect(host.tick(16)).toEqual([]);
    host.handle({ kind: "Control", id: 3, control: { kind: "Pause" } });
    host.handle({ kind: "FrameDone" });
    host.handle({ kind: "FrameDone" });
    const now = host.sim?.now();
    host.tick(16);
    expect(host.tick(16)).toEqual([]);
    expect(host.sim?.now()).toBe(now);
  });

  it("does not wait when not asked to", () => {
    const host = running(false);
    frameOf(host.tick(16));
    frameOf(host.tick(16));
  });
});

function firstTick(f: { notices: Notice[] }): number {
  const n = f.notices.find((x) => x.kind === "TickDone");
  if (n?.kind !== "TickDone") throw new Error("no tick");
  return Number(n.time);
}
