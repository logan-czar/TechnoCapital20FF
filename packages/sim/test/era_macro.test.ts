// A historical world's macro layer (1995-rework 6; D995): the policy rate and what reads it, the
// zones' paths, and the scenarios' differences. The bands themselves are checked by
// `headless calibrate`; here, that the machinery does what the spec says.

import { describe, expect, it } from "vitest";
import {
  eraMacroJob,
  growthGapOfWorld,
  neutralRate,
  RATE_FLOOR,
  zoneLocationFactor,
} from "../src/era/jobs.ts";
import { simNew, simViews, simWorld } from "../src/lib.ts";
import { rateFactor, Y10_BASE } from "../src/market/fair_value.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { JobCtx } from "../src/time/scheduler.ts";
import type { World } from "../src/types/world.ts";
import { data, data1995, macrotask } from "./common/index.ts";

function new1995(seed: number, scenario = "stable") {
  const made = simNew(data1995(), seed, { scenario });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  return made.value;
}

/** Runs to 00:00 on 1 January of `year`, yielding so the Vitest worker can answer its runner. */
async function runTo(sim: ReturnType<typeof new1995>, year: number): Promise<void> {
  const end = dateTimeMidnight(simDateYmd(year, 1, 1));
  let n = 0;
  while (sim.now() < end) {
    sim.step();
    if (++n % 8760 === 0) await macrotask();
  }
}

function ctxAt(date: { year: number; month: number; day: number }): JobCtx {
  return { facts: { date } } as unknown as JobCtx;
}

describe("the policy rate", () => {
  it("starts at the manifest's rates, and the 2020 world's stay fixed", () => {
    const w = simWorld(new1995(1));
    expect([w.base_rate, w.neutral_rate]).toEqual([0.05, 0.05]);
    const made = simNew(data(), 1);
    if (!made.ok) throw new Error("did not load");
    const w2020 = simWorld(made.value);
    expect([w2020.base_rate, w2020.neutral_rate]).toEqual([0.03, 0.03]);
  });

  it("moves part of the way to its target each quarter", () => {
    const w = simWorld(new1995(1));
    const before = w.base_rate;
    w.cycle.g_t = 0.04;
    for (const ind of w.industries) ind.q_growth = ind.prev_q_growth;
    const gap = growthGapOfWorld(w);
    eraMacroJob(w, ctxAt(simDateYmd(1995, 4, 1)));
    const m = w.era?.scenario.macro;
    const target = w.neutral_rate + (m?.rate_gap_k ?? 0) * gap + (m?.rate_g_k ?? 0) * 0.04;
    expect(w.base_rate).toBeGreaterThan(Math.min(before, target));
    expect(w.base_rate).toBeLessThan(Math.max(before, target));
    expect(w.era?.macro.gap).toBe(gap);
  });

  it("does not fall below its floor", () => {
    const w = simWorld(new1995(1));
    w.base_rate = RATE_FLOOR;
    w.cycle.g_t = -5.0;
    eraMacroJob(w, ctxAt(simDateYmd(1995, 4, 1)));
    expect(w.base_rate).toBe(RATE_FLOOR);
  });

  it("drifts its neutral to the scenario's by the end of the run", () => {
    const stagnation = simWorld(new1995(1, "stagnation")).era;
    if (stagnation === undefined) throw new Error("no era");
    expect(neutralRate(stagnation, 1995)).toBe(0.05);
    expect(neutralRate(stagnation, 2020)).toBeCloseTo(stagnation.scenario.macro.neutral_end);
    expect(neutralRate(stagnation, 2050)).toBeCloseTo(stagnation.scenario.macro.neutral_end);
  });

  it("marks a recession once, on a contraction's first quarter, with a headline", () => {
    const w = simWorld(new1995(1)) as World;
    w.cycle.phase = "Contraction";
    const date = simDateYmd(1999, 4, 1);
    eraMacroJob(w, ctxAt(date));
    eraMacroJob(w, ctxAt(simDateYmd(1999, 7, 1)));
    expect(w.era?.history.recessions).toEqual([1999]);
  });

  it("sets the discount rate in an era world, and leaves the 2020 world's", () => {
    expect(rateFactor(0.01)).toBe(rateFactor(0.01, Y10_BASE));
    expect(rateFactor(0.01, 0.09)).toBeLessThan(rateFactor(0.01));
  });
});

describe("the zones", () => {
  it("run in the view and keep world GDP, with shares summing to 1", async () => {
    const sim = new1995(3);
    await runTo(sim, 1998);
    const w = simWorld(sim);
    const zones = w.era?.macro.zones ?? [];
    expect(zones.reduce((a, z) => a + z.share, 0)).toBeCloseTo(1, 9);
    const h = simViews(sim).history.data;
    expect(h.zone_gdp_usd.length).toBe(3);
    const last = h.gdp_usd.at(-1) as number;
    expect((h.zone_gdp_usd.at(-1) as number[]).reduce((a, b) => a + b, 0)).toBeCloseTo(last, -3);
    expect(w.countries.reduce((a, c) => a + c.gdp_usd, 0)).toBeCloseTo(last, -3);
    expect(h.base_rate.length).toBe(3);
  }, 120_000);

  it("draw differently by seed, and repeat by seed", () => {
    const tracks = (seed: number) => simWorld(new1995(seed)).era?.macro.zones.map((z) => z.track);
    expect(tracks(1)).toEqual(tracks(1));
    expect(tracks(1)).not.toEqual(tracks(2));
  });

  it("weigh startups toward a zone gaining share", () => {
    const era = simWorld(new1995(1)).era;
    if (era === undefined) throw new Error("no era");
    const z = era.macro.zones[0];
    if (z === undefined) throw new Error("no zone");
    expect(zoneLocationFactor(era, 0)).toBe(1);
    z.share = z.start_share * 2;
    expect(zoneLocationFactor(era, 0)).toBeCloseTo(2);
    expect(zoneLocationFactor(era, 9999)).toBe(1);
  });
});

describe("the scenarios", () => {
  it("give Stagnation fewer startups than Stable", async () => {
    const entries = async (scenario: string): Promise<number> => {
      const sim = new1995(4, scenario);
      await runTo(sim, 2000);
      return simViews(sim).history.data.companies.at(-1) as number;
    };
    expect(await entries("stagnation")).toBeLessThan(await entries("stable"));
  }, 240_000);
});
