// D1024: the drift plan's lane W board-seat events. Under a profile with `seat_events` (`mature`)
// every open labor seat rolls d30 + skill each plan lock against a difficulty that rises with
// revenue; `legacy` plays none, so its results do not move.
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { PROFILES, profileById } from "../src/economy/profiles.ts";
import {
  SEAT_CRITICAL_SCALE,
  SEAT_DC_AT_100M,
  SEAT_DC_PER_DECADE,
  SEAT_FAILURE_LARGE,
  SEAT_FAILURE_SMALL,
  SEAT_SUCCESS_LARGE,
  SEAT_SUCCESS_SMALL,
  seatDifficulty,
  seatEffectNow,
  seatOutcome,
  seatPasses,
  sizePosition,
} from "../src/events/seats.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { Company } from "../src/types/world.ts";

describe("the roll (D1024)", () => {
  it("gets harder by 8.5 a tenfold of revenue from 13 at $100M", () => {
    expect(seatDifficulty(1e8)).toBeCloseTo(SEAT_DC_AT_100M, 9);
    expect(seatDifficulty(1e11)).toBeCloseTo(SEAT_DC_AT_100M + 3 * SEAT_DC_PER_DECADE, 9);
    expect(seatDifficulty(0)).toBe(seatDifficulty(1e6));
  });

  it("passes on roll + skill at the difficulty; a natural 30 always, a natural 1 never", () => {
    expect(seatPasses(15, 10, 25)).toBe(true);
    expect(seatPasses(14, 10, 25)).toBe(false);
    expect(seatPasses(30, 0, 99)).toBe(true);
    expect(seatPasses(1, 30, 2)).toBe(false);
  });

  it("gives small companies bigger gains and big companies bigger harms", () => {
    expect(sizePosition(1e7)).toBe(0);
    expect(sizePosition(1e12)).toBe(1);
    expect(seatOutcome(true, false, 0)).toBe(SEAT_SUCCESS_SMALL);
    expect(seatOutcome(true, false, 1)).toBe(SEAT_SUCCESS_LARGE);
    expect(seatOutcome(false, false, 0)).toBe(-SEAT_FAILURE_SMALL);
    expect(seatOutcome(false, false, 1)).toBe(-SEAT_FAILURE_LARGE);
    expect(seatOutcome(false, true, 1)).toBe(-SEAT_FAILURE_LARGE * SEAT_CRITICAL_SCALE);
  });

  it("an effect fades linearly over its plan locks", () => {
    const c = {
      seat_effects: [
        { kind: "Revenue", value: 0.04, quarters_left: 3, quarters: 4 },
        { kind: "Growth", value: 1, quarters_left: 1, quarters: 1 },
      ],
    } as unknown as Company;
    expect(seatEffectNow(c, "Revenue")).toBeCloseTo(0.03, 12);
    expect(seatEffectNow(c, "Margin")).toBe(0);
    expect(seatEffectNow({} as Company, "Revenue")).toBe(0);
  });
});

describe("the profiles (D1024)", () => {
  it("only mature plays seat events", () => {
    for (const p of PROFILES) expect(p.seat_events, p.id).toBe(p.id === "mature");
    expect(profileById("mature+vol-high")?.seat_events).toBe(true);
  });

  it("mature rolls every open seat at the first plan lock, about half passing; legacy rolls none", () => {
    const run = (profile: string) => {
      const r = loadWorld(defaultDataDir());
      if (!r.ok) throw new Error("data");
      const made = simNew(structuredClone(r.value), 7, { profile });
      if (!made.ok) throw new Error("sim");
      const sim = made.value;
      const end = dateTimeMidnight(simDateYmd(2020, 1, 10));
      while (sim.now() < end) sim.step();
      return simWorld(sim);
    };
    const mature = run("mature");
    const t = mature.seat_tally;
    if (t === undefined) throw new Error("no tally");
    const ok = t.ok.reduce((a, b) => a + b, 0);
    const all = ok + t.fail.reduce((a, b) => a + b, 0);
    const open = mature.companies.reduce((n, c) => n + Math.min(c.labor_units, 5), 0);
    expect(all).toBe(open);
    expect(ok / all).toBeGreaterThan(0.35);
    expect(ok / all).toBeLessThan(0.75);
    expect(mature.companies.some((c) => (c.seat_effects?.length ?? 0) > 0)).toBe(true);
    const legacy = run("legacy");
    expect(legacy.seat_tally).toBeUndefined();
    expect(legacy.companies.every((c) => c.seat_effects === undefined)).toBe(true);
  }, 120_000);
});
