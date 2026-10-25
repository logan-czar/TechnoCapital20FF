import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Controls } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import {
  ALERTS,
  controlsDigest,
  LEVELS,
  logControlParse,
  logControlText,
  logText,
  Player,
  parseLog,
  record,
  replay,
  SKIPS,
} from "../src/replay.ts";
import { StubSim, stubFactory } from "./stub-sim.ts";

const data = {} as WorldData;

describe("replay log text", () => {
  it("every alert line round-trips (D800: Quarter start included, at every level)", () => {
    for (const [alert] of ALERTS) {
      for (const [level] of LEVELS) {
        const c = { kind: "Alert", alert, level } as const;
        expect(logControlParse(logControlText(c).split(" "))).toEqual(c);
      }
    }
    expect(logControlParse(["alert", "quarter-start", "off"])).toEqual({
      kind: "Alert",
      alert: "QuarterStart",
      level: "Off",
    });
  });

  it("every control round-trips and junk does not parse", () => {
    const cs = [
      { kind: "Speed", n: 4 },
      { kind: "Pause" },
      { kind: "Resume" },
      ...SKIPS.map(([skip]) => ({ kind: "Skip", skip }) as const),
      { kind: "WatchAdd", id: 7 },
      { kind: "WatchRemove", id: 9 },
      { kind: "Save", n: 2 },
      { kind: "Load", n: 2 },
    ] as const;
    for (const c of cs) expect(logControlParse(logControlText(c).split(" "))).toEqual(c);
    expect(logControlParse(["speed", "x"])).toBeUndefined();
    expect(logControlParse(["pause", "now"])).toBeUndefined();
    expect(logControlParse([])).toBeUndefined();
  });

  it("a log's text parses back to the same run", () => {
    const run = {
      controls: [
        { frame: 3, control: { kind: "Resume" } as const },
        { frame: 9, control: { kind: "Skip", skip: "NextLock" } as const },
      ],
      hashes: [
        "hash 2 2 2020-01 abc",
        "hash 9 40 2020-02 def",
        "end 12 99 2021-01-01 00:00 fed controls 00ff",
      ],
    };
    const text = logText(7, 2, run);
    expect(text.startsWith("version 2\nseed 7\nyears 2\n")).toBe(true);
    // The hash of frame 2 comes before the control of frame 3, the one of frame 9 after it.
    expect(text.indexOf("hash 2 ")).toBeLessThan(text.indexOf("control 3 "));
    expect(text.indexOf("control 9 ")).toBeLessThan(text.indexOf("hash 9 "));
    expect(parseLog(text)).toEqual({ seed: 7, years: 2, run });
  });

  it("bad logs say why", () => {
    expect(() => parseLog("version 1\nseed 1\nyears 1\n")).toThrow(/log version Some\(1\)/);
    expect(() => parseLog("version 2\nyears 1\n")).toThrow(/no seed/);
    expect(() => parseLog("version 2\nseed 1\n")).toThrow(/no years/);
    expect(() => parseLog("version 2\nseed 1\nyears 1\ncontrol 1 nonsense\n")).toThrow(/log line 4/);
  });
});

describe("the scripted player", () => {
  it("is deterministic per seed and differs between seeds", () => {
    const draws = (seed: number): bigint[] => {
      const p = new Player(seed);
      return [p.next(), p.next(), p.next()];
    };
    expect(draws(1)).toEqual(draws(1));
    expect(draws(1)).not.toEqual(draws(2));
    const p = new Player(5);
    for (let i = 0; i < 100; i++) {
      const u = p.unit();
      expect(u >= 0 && u < 1).toBe(true);
      expect(p.below(6)).toBeLessThan(6);
    }
  });
});

describe("controls digest", () => {
  const base = (): Controls => ({
    speed: 1,
    paused: false,
    skip: null,
    alerts: ["Pause", "Notify", "Log", "Off", "Pause", "Pause"],
    omniscient: false,
    watchlist: new Set([3, 1] as never[]),
  });
  it("is 16 hex digits, order-free for the watchlist, and sees every field", () => {
    const d = controlsDigest(base());
    expect(d).toMatch(/^[0-9a-f]{16}$/);
    expect(controlsDigest({ ...base(), watchlist: new Set([1, 3] as never[]) })).toBe(d);
    expect(controlsDigest({ ...base(), watchlist: new Set([1] as never[]) })).not.toBe(d);
    expect(controlsDigest({ ...base(), speed: 2 })).not.toBe(d);
    expect(controlsDigest({ ...base(), paused: true })).not.toBe(d);
  });
});

describe("record and replay through the frame loop", () => {
  it("a recorded run replays with every hash line matching; a changed line fails", () => {
    const dir = mkdtempSync(join(tmpdir(), "headless-replay-"));
    try {
      const log = join(dir, "run.log");
      const made = record(stubFactory, data, 3, 1, log);
      expect(made).toMatch(/^\d+ controls, \d+ hash lines, end /);
      const text = readFileSync(log, "utf8");
      expect(text).toMatch(/^version 2\nseed 3\nyears 1\n/);
      expect(text).toMatch(/\nhash \d+ \d+ 2020-\d\d h\d+\n/);
      expect(replay(stubFactory, data, log)).toBe(made);

      const tampered = text.replace(/(\nhash \d+ \d+ 2020-\d\d h)(\d+)/, "$1999999");
      const bad = join(dir, "bad.log");
      writeFileSync(bad, tampered);
      expect(() => replay(stubFactory, data, bad)).toThrow(/replay differs at hash line 1/);

      // A dropped control that moves no hash is still caught: here the log's end line digest.
      const dropped = text.replace(/ controls [0-9a-f]{16}/, " controls 0000000000000000");
      const bad2 = join(dir, "bad2.log");
      writeFileSync(bad2, dropped);
      expect(() => replay(stubFactory, data, bad2)).toThrow(/replay differs/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the stub sim steps a clock and pauses on request", () => {
    const s = new StubSim(1);
    expect(s.controls().paused).toBe(true);
    s.apply({ kind: "Resume" });
    expect(s.step().at(-1)).toEqual({ kind: "TickDone", time: 1 });
  });
});
