// A historical world's run state (1995-rework 3.3, 4.1, 8.1, 8.4; D994): the scenario, the long
// history, saves, and that the 2020 world carries none of it.

import { describe, expect, it } from "vitest";
import { canonicalString } from "../src/canonical.ts";
import { SCENARIOS } from "../src/economy/scenarios.ts";
import { simNew, simViews, simWorld } from "../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { VIEW_NAMES } from "../src/types/views/index.ts";
import { data, data1995 } from "./common/index.ts";

function new1995(seed: number, scenario?: string) {
  const made = simNew(data1995(), seed, scenario === undefined ? {} : { scenario });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  return made.value;
}

describe("the era state", () => {
  it("is absent in the 2020 world, whose view holds only its start", () => {
    const made = simNew(data(), 1);
    if (!made.ok) throw new Error("did not load");
    expect(simWorld(made.value).era).toBeUndefined();
    const h = simViews(made.value).history.data;
    expect([h.world_id, h.start_year, h.scenario, h.years]).toEqual(["2020", 2020, null, []]);
  });

  it("refuses a scenario in the 2020 world, and an unknown one anywhere", () => {
    expect(simNew(data(), 1, { scenario: "stable" }).ok).toBe(false);
    expect(simNew(data1995(), 1, { scenario: "golden_age" }).ok).toBe(false);
  });

  it("plays the asked scenario's profile and shows its name", () => {
    for (const s of SCENARIOS) {
      const sim = new1995(1, s.id);
      const w = simWorld(sim);
      expect(w.profile.id).toBe(s.id);
      expect(w.profile.ai_boom).toBe(false);
      expect(w.era?.scenario.id).toBe(s.id);
      expect(simViews(sim).history.data.scenario).toBe(s.label);
    }
  });

  it("derives GDP from demand, so the start matches the countries' sum", () => {
    const w = simWorld(new1995(1));
    const demand = w.industries.reduce((sum, i) => sum + i.demand, 0);
    const gdp = w.countries.reduce((sum, c) => sum + c.gdp_usd, 0);
    expect((w.era?.gdp_per_demand ?? 0) * demand).toBeCloseTo(gdp, 0);
  });

  it("lets a seed pick under Random and repeats the pick", () => {
    const picks = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      const w = simWorld(new1995(seed, "random"));
      expect(w.era?.scenario_hidden).toBe(true);
      expect(simWorld(new1995(seed, "random")).era?.scenario.id).toBe(w.era?.scenario.id);
      picks.add(w.era?.scenario.id ?? "");
    }
    expect(picks.size).toBe(SCENARIOS.length);
  });

  it("keeps a hidden scenario's name and id out of every view", () => {
    const sim = new1995(3, "random");
    const scenario = simWorld(sim).era?.scenario;
    expect(scenario).toBeDefined();
    const views = simViews(sim) as unknown as Record<string, { data: unknown }>;
    for (const n of VIEW_NAMES) {
      const text = canonicalString(views[n]?.data ?? null);
      expect(text, n).not.toContain(`"${scenario?.id}"`);
      expect(text, n).not.toContain(scenario?.label);
    }
  });

  it("adds a history entry a year and carries it through a save", () => {
    const sim = new1995(5);
    const end = dateTimeMidnight(simDateYmd(1997, 1, 2));
    while (sim.now() < end) sim.step();
    const h = simWorld(sim).era?.history;
    expect(h?.years).toEqual([1995, 1996]);
    expect(h?.companies.length).toBe(2);
    expect(h?.gdp_usd[1]).toBeGreaterThan(0);
    expect(simViews(sim).history.data.gdp_usd).toEqual(h?.gdp_usd);

    const bytes = sim.saveBytes();
    const hash = sim.stateHash();
    const other = new1995(9);
    const loaded = other.loadBytes(bytes);
    expect(loaded.ok).toBe(true);
    expect(other.stateHash()).toBe(hash);
    expect(simWorld(other).era?.history.years).toEqual([1995, 1996]);
  }, 120_000);
});
