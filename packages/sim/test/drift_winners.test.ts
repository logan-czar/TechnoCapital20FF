// D1023: the drift plan's lane W caps. Under a profile with `winners` (`mature`) free R&D stops at
// two R&D norms and productivity gains taper from 120 to a quarter at 200; `legacy` keeps spec 5.6
// and 5.9, so its results do not move.
import { loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { PROFILES, profileById } from "../src/economy/profiles.ts";
import { simNew, simWorld } from "../src/lib.ts";
import {
  dataBookAtLoad,
  dataBookMonth,
  FREE_RD_CAP_NORMS,
  freeRdCapPct,
  freeRdStep,
} from "../src/ops/data.ts";
import {
  PRODUCTIVITY_MAX,
  PRODUCTIVITY_TAPER_FLOOR,
  PRODUCTIVITY_TAPER_FROM,
  stepProductivity,
  taperShare,
} from "../src/ops/productivity.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { worldMini } from "./common/world_mini.ts";

describe("the free R&D cap (D1023)", () => {
  it("is two R&D norms, in whole percent", () => {
    expect(FREE_RD_CAP_NORMS).toBe(2);
    expect(freeRdCapPct(0.035)).toBe(7);
    expect(freeRdCapPct(0.12)).toBe(24);
    expect(freeRdCapPct(0.004)).toBe(0);
  });

  it("holds a big data book's step at the cap; without one the step stands", () => {
    const params = { tb_per_musd: 0.01, decay_base: 0.02 };
    const capped = dataBookAtLoad(0, params, 0, 0);
    capped.held = 1e7;
    const free = structuredClone(capped);
    dataBookMonth(capped, 0, { ...params, free_rd_cap_pct: 4 }, 0);
    dataBookMonth(free, 0, params, 0);
    expect(freeRdStep(1e7)).toBe(8);
    expect(capped.free_rd_pct).toBe(4);
    expect(free.free_rd_pct).toBe(8);
  });
});

describe("the productivity taper (D1023)", () => {
  it("keeps every gain up to 120 and a quarter at 200", () => {
    expect(taperShare(100)).toBe(1);
    expect(taperShare(PRODUCTIVITY_TAPER_FROM)).toBe(1);
    expect(taperShare(160)).toBeCloseTo(0.625, 12);
    expect(taperShare(PRODUCTIVITY_MAX)).toBeCloseTo(PRODUCTIVITY_TAPER_FLOOR, 12);
  });

  it("tapers gains and never losses", () => {
    const rich = {
      rd_plan: 0.2,
      free_rd: 0.0,
      rd_norm: 0.05,
      management_score: 80,
      research_units: 0,
      idle_units: 0,
      labor: 10,
    };
    const poor = { ...rich, rd_plan: 0.0 };
    const gain = stepProductivity(160, rich) - 160;
    expect(stepProductivity(160, { ...rich, taper: true }) - 160).toBeCloseTo(gain * 0.625, 12);
    expect(stepProductivity(160, { ...poor, taper: true })).toBe(stepProductivity(160, poor));
  });
});

describe("the profiles (D1023)", () => {
  it("only mature sets winners", () => {
    for (const p of PROFILES) expect(p.winners, p.id).toBe(p.id === "mature");
    expect(profileById("mature+slow+vol-low")?.winners).toBe(true);
  });

  it("mature holds every data book at its cap after a month; legacy does not cap", () => {
    const run = (profile: string) => {
      const r = loadWorld(worldMini().dir);
      if (!r.ok) throw new Error("data");
      const made = simNew(structuredClone(r.value), 5, { profile });
      if (!made.ok) throw new Error("sim");
      const sim = made.value;
      // A leader's data book far past the cap (about 2120's held data in the drift report).
      const w = simWorld(sim);
      const norm = (i: number) => w.industries[i]?.params.rd_norm ?? 1;
      const low = w.companies.reduce((a, c) => (norm(c.industry) < norm(a.industry) ? c : a));
      const book = low.data.find((d) => d.industry === low.industry)?.book;
      if (book === undefined) throw new Error("book");
      book.held = 1e12;
      const end = dateTimeMidnight(simDateYmd(2020, 2, 2));
      while (sim.now() < end) sim.step();
      return simWorld(sim);
    };
    const over = (w: ReturnType<typeof run>) =>
      w.companies.flatMap((c) =>
        c.data.filter(
          (d) => d.book.free_rd_pct > freeRdCapPct(w.industries[d.industry]?.params.rd_norm ?? 0),
        ),
      ).length;
    expect(over(run("mature"))).toBe(0);
    expect(over(run("legacy"))).toBeGreaterThan(0);
  }, 120_000);
});
