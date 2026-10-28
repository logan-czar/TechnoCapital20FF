// D977, D978: the drift plan's lane G. Industries' long-term rates fade to mature rates under the
// `mature` profile, the slowdown and volatility levels are scenario tokens on a profile id, and the
// legacy profile stays on the CSV rates.
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { setIndustryLt } from "../src/economy/ai_boom.ts";
import {
  DEFAULT_SLOWDOWN,
  fadedTrend,
  growthFactor,
  LEGACY_PROFILE,
  PROFILES,
  profileById,
} from "../src/economy/profiles.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import type { World } from "../src/types/world.ts";

function newWorld(seed: number, profile: string): World {
  const r = loadWorld(defaultDataDir());
  if (!r.ok) throw new Error("data");
  const made = simNew(structuredClone(r.value), seed, { profile });
  if (!made.ok) throw new Error("sim");
  return simWorld(made.value);
}

function ltOf(w: World, key: string): number {
  const ind = w.industries.find((i) => i.key === key);
  if (ind === undefined) throw new Error(key);
  return ind.lt;
}

describe("the fade (D977)", () => {
  it("halves the gap to the mature rate every half life", () => {
    expect(fadedTrend(0.25, 0.035, 25, 0, true)).toBeCloseTo(0.25, 12);
    expect(fadedTrend(0.25, 0.035, 25, 25, true)).toBeCloseTo(0.035 + 0.215 / 2, 12);
    expect(fadedTrend(0.25, 0.035, 25, 50, true)).toBeCloseTo(0.035 + 0.215 / 4, 12);
  });

  it("leaves the CSV rate when the profile does not fade or the half life is 0", () => {
    expect(fadedTrend(0.25, 0.035, 25, 40, false)).toBe(0.25);
    expect(fadedTrend(0.02, 0.02, 0, 40, true)).toBe(0.02);
  });

  it("the CSV gives every fast industry a mature rate under its trend and a half life of 15 to 25", () => {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data");
    for (const i of r.value.industries.rows) {
      if (i.trend_growth <= i.mature_rate) {
        expect(i.fade_half_life_years, i.id).toBe(0);
      } else {
        expect(i.fade_half_life_years, i.id).toBeGreaterThanOrEqual(15);
        expect(i.fade_half_life_years, i.id).toBeLessThanOrEqual(25);
      }
    }
  });

  it("mature fades the long-term rate; legacy keeps the CSV rate", () => {
    const mature = newWorld(3, "mature");
    const legacy = newWorld(3, "legacy");
    const evs = legacy.industries.find((i) => i.key === "evs");
    if (evs === undefined) throw new Error("evs");
    const { trend_growth, mature_rate, fade_half_life_years } = evs.params;
    // 2020: no fade yet. 2050: 30 years in.
    expect(ltOf(mature, "evs")).toBeCloseTo(trend_growth, 12);
    setIndustryLt(mature, simDateYmd(2050, 1, 1));
    setIndustryLt(legacy, simDateYmd(2050, 1, 1));
    expect(ltOf(mature, "evs")).toBeCloseTo(
      mature_rate + (trend_growth - mature_rate) * 0.5 ** (30 / fade_half_life_years),
      12,
    );
    expect(ltOf(mature, "evs")).toBeLessThan(trend_growth);
    expect(ltOf(legacy, "evs")).toBe(trend_growth);
  });
});

describe("scenario tokens on a profile id (D978)", () => {
  it("the baseline profiles carry no slowdown and the legacy volatility", () => {
    for (const p of PROFILES) {
      expect(p.slowdown, p.id).toBeNull();
      expect(p.world_growth_scale, p.id).toBe(1);
      expect(p.cycle_scale, p.id).toBe(1);
      expect(p.price_noise_scale, p.id).toBe(1);
    }
    expect(LEGACY_PROFILE.fade).toBe(false);
  });

  it("+slow is 2050 to 2080 at a third; the long form sets its own window", () => {
    expect(profileById("mature+slow")?.slowdown).toEqual(DEFAULT_SLOWDOWN);
    expect(profileById("mature+slow-2060-10-0.5")?.slowdown).toEqual({
      start_year: 2060,
      years: 10,
      depth: 0.5,
    });
  });

  it("+vol scales the cycle, the industry shocks and the price noise together", () => {
    const high = profileById("legacy+vol-high");
    const low = profileById("legacy+vol-low");
    expect(high).toMatchObject({ volatility_scale: 2, cycle_scale: 2, price_noise_scale: 2 });
    expect(low).toMatchObject({ volatility_scale: 0.5, cycle_scale: 0.5, price_noise_scale: 0.5 });
    expect(profileById("legacy+vol-normal")).toMatchObject({ volatility_scale: 1, cycle_scale: 1 });
  });

  it("tokens stack, and an unknown base or token is null", () => {
    const p = profileById("mature+slow+vol-low");
    expect(p?.id).toBe("mature+slow+vol-low");
    expect(p?.slowdown).not.toBeNull();
    expect(p?.cycle_scale).toBe(0.5);
    expect(profileById("nope+slow")).toBeNull();
    expect(profileById("legacy+fast")).toBeNull();
    expect(profileById("legacy+vol-extreme")).toBeNull();
    expect(profileById("legacy+slow-2050-0-0.3")).toBeNull();
    expect(profileById("legacy+slow-x-30-0.3")).toBeNull();
  });

  it("the slowdown applies inside its window only", () => {
    const p = profileById("legacy+slow");
    if (p === null) throw new Error("profile");
    expect(growthFactor(p, 2049)).toBe(1);
    expect(growthFactor(p, 2050)).toBeCloseTo(1 / 3, 12);
    expect(growthFactor(p, 2079)).toBeCloseTo(1 / 3, 12);
    expect(growthFactor(p, 2080)).toBe(1);
    expect(growthFactor(LEGACY_PROFILE, 2060)).toBe(1);
  });

  it("a slowdown cuts the trend to its depth, then it recovers", () => {
    const w = newWorld(5, "legacy+slow");
    const csv = ltOf(newWorld(5, "legacy"), "retail");
    setIndustryLt(w, simDateYmd(2049, 7, 1));
    expect(ltOf(w, "retail")).toBe(csv);
    setIndustryLt(w, simDateYmd(2060, 7, 1));
    expect(ltOf(w, "retail")).toBeCloseTo(csv / 3, 12);
    setIndustryLt(w, simDateYmd(2080, 1, 1));
    expect(ltOf(w, "retail")).toBe(csv);
  });

  it("a volatility level stretches the starting cycle draw and nothing else about the seed", () => {
    const base = newWorld(9, "legacy");
    const high = newWorld(9, "legacy+vol-high");
    expect(high.cycle.phase).toBe(base.cycle.phase);
    expect(high.cycle.quarters_left).toBe(base.cycle.quarters_left);
    expect(high.cycle.g_t).toBeCloseTo(2 * base.cycle.g_t, 12);
  });

  it("simNew rejects a bad scenario token", () => {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data");
    expect(simNew(structuredClone(r.value), 1, { profile: "legacy+slow-oops" }).ok).toBe(false);
  });
});
