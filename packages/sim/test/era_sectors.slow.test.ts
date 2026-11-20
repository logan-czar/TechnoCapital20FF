// A historical world's sectors (1995-rework 5, 9; D996): dormant rows, activation, founding waves,
// the sticky fringe and the exit rule.

import { check, dataErrorToString } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { ERA_SHORTAGE_GAP_MAX, ERA_SHORTAGE_K, shortageGrowth, situationGrowth } from "../src/ai/growth.ts";
import { fringeAfterMonth, stickyFringeAfterMonth } from "../src/economy/supply.ts";
import { eraActivateSectorsJob } from "../src/era/jobs.ts";
import { EXIT_LOSS_QUARTERS, exitDue } from "../src/finance/distress.ts";
import { settleJob } from "../src/finance/jobs.ts";
import { simNew, simViews, simWorld } from "../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { JobCtx } from "../src/time/scheduler.ts";
import type { World } from "../src/types/world.ts";
import { data1995, macrotask } from "./common/index.ts";

function new1995(seed: number, scenario = "stable") {
  const made = simNew(data1995(), seed, { scenario });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  return made.value;
}

function indexOf(w: World, key: string): number {
  const i = w.industries.findIndex((x) => x.key === key);
  if (i < 0) throw new Error(`no ${key}`);
  return i;
}

async function runTo(sim: ReturnType<typeof new1995>, year: number): Promise<void> {
  const end = dateTimeMidnight(simDateYmd(year, 1, 1));
  let n = 0;
  while (sim.now() < end) {
    sim.step();
    if (++n % 8760 === 0) await macrotask();
  }
}

describe("the data", () => {
  it("rejects a dormant industry with companies or a size", () => {
    const d = data1995();
    expect(check(d).map(dataErrorToString)).toEqual([]);
    const row = d.industries.rows.find((r) => r.id === "cloud");
    if (row === undefined) throw new Error("no cloud");
    row.world_size_2020_usd_bn = 5.0;
    expect(check(d).map(dataErrorToString).join()).toContain("dormant but has a size");
  });
});

describe("a dormant industry", () => {
  it("starts with no size or companies, in balance, labeled Normal, and hidden", () => {
    const sim = new1995(1);
    const w = simWorld(sim);
    const i = indexOf(w, "social_media");
    const ind = w.industries[i];
    expect(w.era?.sectors[i]?.status).toBe("Dormant");
    expect([ind?.demand, ind?.fringe_assets, ind?.supply_ratio, ind?.market_factor]).toEqual([0, 0, 1, 1]);
    expect(ind?.phase_label).toBe("Normal");
    expect(w.companies.filter((c) => c.industry === i)).toEqual([]);
    expect(simViews(sim).industry_rows.data.rows[i]?.dormant).toBe(true);
    const live = indexOf(w, "retail");
    expect(simViews(sim).industry_rows.data.rows[live]?.dormant).toBeUndefined();
  });

  it("draws its emergence inside its window by seed, later under Stagnation", () => {
    const quarterOf = (seed: number, scenario: string) => {
      const w = simWorld(new1995(seed, scenario));
      return w.era?.sectors[indexOf(w, "cloud")]?.emerge_quarter?.year ?? 0;
    };
    const years = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const y = quarterOf(seed, "stable");
      expect(y).toBeGreaterThanOrEqual(2004);
      expect(y).toBeLessThanOrEqual(2010);
      expect(quarterOf(seed, "stable")).toBe(y);
      years.add(y);
    }
    expect(years.size).toBeGreaterThan(1);
    expect(quarterOf(1, "stagnation")).toBeGreaterThanOrEqual(2007);
  });

  it("takes its size when its quarter comes, and not before", () => {
    const w = simWorld(new1995(1));
    const i = indexOf(w, "cloud");
    const s = w.era?.sectors[i];
    if (s?.emerge_quarter == null) throw new Error("no quarter");
    const before = { facts: { date: simDateYmd(2003, 1, 1) }, raiseAlert: () => {} } as unknown as JobCtx;
    eraActivateSectorsJob(w, before);
    expect(s.status).toBe("Dormant");
    const at = {
      facts: { date: simDateYmd(s.emerge_quarter.year, 1 + (s.emerge_quarter.q - 1) * 3, 1) },
      raiseAlert: () => {},
    };
    eraActivateSectorsJob(w, at as unknown as JobCtx);
    const ind = w.industries[i];
    expect(s.status).toBe("Live");
    expect(s.wave_pending).toBe(true);
    expect(ind?.demand).toBe(s.target_size_usd);
    expect(ind?.trend_demand).toBe(s.target_size_usd);
    expect(ind?.fringe_assets).toBeGreaterThan(0);
    expect(w.era?.history.emergences).toContainEqual({ year: s.emerge_quarter.year, industry: ind?.name });
  });

  it("emerges in a run, gets its founding wave, and starts firms well above startup size", async () => {
    const sim = new1995(2);
    await runTo(sim, 2001);
    const w = simWorld(sim);
    const i = indexOf(w, "e_commerce");
    expect(w.era?.sectors[i]?.status).toBe("Live");
    expect(w.era?.sectors[i]?.wave_pending).toBe(false);
    const firms = w.companies.filter((c) => c.industry === i);
    expect(firms.length).toBeGreaterThanOrEqual(3);
    expect(w.industries[i]?.demand).toBeGreaterThan(w.era?.sectors[i]?.target_size_usd ?? 0);
    expect(w.births.events.some((e) => e.kind.kind === "Fixed" && e.kind.id === "E-e_commerce")).toBe(true);
    expect(simViews(sim).history.data.emergences.length).toBeGreaterThan(0);
    // The ones still dormant in 2001 have stayed empty.
    w.era?.sectors.forEach((s, k) => {
      if (s.status === "Dormant") expect(w.industries[k]?.demand).toBe(0);
    });
  }, 240_000);
});

describe("the sticky fringe", () => {
  it("does not shrink with a downturn, and closes its gap to demand", () => {
    const lt = 0.03;
    const inDownturn = stickyFringeAfterMonth(100, lt, 1.2);
    expect(inDownturn).toBeLessThan(100.3);
    expect(inDownturn).toBeGreaterThan(fringeAfterMonth(100, -0.2));
    expect(stickyFringeAfterMonth(100, lt, 0.8)).toBeGreaterThan(stickyFringeAfterMonth(100, lt, 1.0));
    expect(stickyFringeAfterMonth(100, lt, 0)).toBeCloseTo(100 * 1.03 ** (1 / 12));
  });
});

describe("the exit rule", () => {
  it("is due after a long losing streak or below the asset floor", () => {
    expect(exitDue(11, 1e9)).toBe(false);
    expect(exitDue(12, 1e9)).toBe(true);
    expect(exitDue(0, 1e5)).toBe(true);
  });

  // The spared last firm is the exit rule's alone (1995-rework 9): an ordinary bankruptcy (mvp-spec
  // 5.12) may still close an industry's last firm, as seed 2's sole black_market firm does in 1997,
  // so a whole run cannot check it. This sets a firm's losing streak in a real world and settles.
  it("spares an industry's last open firm, and exits it when a peer is open", async () => {
    const settled = async (peersClosed: boolean) => {
      const sim = new1995(1);
      await runTo(sim, 1996);
      const w = simWorld(sim);
      const ind = w.industries.findIndex(
        (_, i) =>
          w.companies.filter((c) => c.industry === i && c.finance.distress.status === "Active").length >= 2,
      );
      const firms = w.companies.filter((c) => c.industry === ind && c.finance.distress.status === "Active");
      const [target, ...peers] = firms;
      if (target === undefined) throw new Error("no firm");
      if (peersClosed) for (const p of peers) p.finance.distress.status = "Removed";
      target.loss_quarters = EXIT_LOSS_QUARTERS;
      const ctx = { facts: { date: simDateYmd(1996, 1, 1) }, raiseAlert: () => {} } as unknown as JobCtx;
      settleJob(w, ctx);
      return target.finance.distress.status;
    };
    expect(await settled(true)).not.toBe("Bankrupt");
    expect(await settled(false)).toBe("Bankrupt");
  }, 300_000);

  // Over several seeds, not one: a single seed's exits by 2006 are a handful, and whether a long
  // loser is its industry's last firm (and so spared) turns on which startups that seed drew. Seed 3
  // alone had one exit before the M2 integration (D1052) moved its random path and none after; its
  // only long loser is now the sole firm of its industry (D1054).
  it("removes firms over a run", async () => {
    let failures = 0;
    for (const seed of [1, 2, 3]) {
      const sim = new1995(seed, "unstable");
      await runTo(sim, 2006);
      failures += simViews(sim).history.data.failures.at(-1) ?? 0;
    }
    expect(failures).toBeGreaterThan(0);
  }, 600_000);
});

describe("a firm under its hurdle", () => {
  const archetype = { hurdle_roa: 0.08, growth_adj: 0.0 } as never;
  it("is held to 2% by default, as spec 6.2 says", () => {
    expect(situationGrowth(0, 0.01, 0.5, 1.0, archetype)).toBe(0.02);
  });
  it("follows most of a booming market in a historical world", () => {
    expect(situationGrowth(0, 0.01, 0.5, 1.0, archetype, 0.8)).toBeCloseTo(0.4);
    expect(situationGrowth(0, 0.01, 0.01, 1.0, archetype, 0.8)).toBeCloseTo(0.01);
  });
});

describe("a short market", () => {
  it("pulls its firms' growth up in proportion to the gap, capped", () => {
    expect(shortageGrowth(1.0)).toBe(0.0);
    expect(shortageGrowth(1.3)).toBe(0.0);
    expect(shortageGrowth(0.8)).toBeCloseTo(ERA_SHORTAGE_K * 0.25);
    expect(shortageGrowth(0.1)).toBeCloseTo(ERA_SHORTAGE_K * ERA_SHORTAGE_GAP_MAX);
    expect(shortageGrowth(0.0)).toBe(0.0);
  });
});

describe("the top 10", () => {
  it("is kept from the first close, every fifth year", async () => {
    const sim = new1995(4);
    await runTo(sim, 2001);
    const h = simViews(sim).history.data;
    expect(h.top10.map((t) => t.year)).toEqual([1995, 2000]);
    const first = h.top10[0];
    expect(first?.companies.length).toBe(10);
    const caps = first?.companies.map((c) => c.cap_usd) ?? [];
    expect(caps).toEqual([...caps].sort((a, b) => b - a));
  }, 240_000);
});
