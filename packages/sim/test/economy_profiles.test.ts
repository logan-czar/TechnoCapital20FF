// D970: the growth profiles. Legacy is the spec 5.1 table untouched; the others are well formed;
// a profile reaches the world, the cycle and the long-term rates through simNew.
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { phaseSpec } from "../src/economy/cycle.ts";
import { LEGACY_PROFILE, PROFILES, profileById } from "../src/economy/profiles.ts";
import { simNew, simWorld } from "../src/lib.ts";
import type { CyclePhase } from "../src/types/world.ts";

const PHASES: CyclePhase[] = ["Expansion", "Overheating", "Contraction", "Recovery"];

describe("growth profiles (D970)", () => {
  it("legacy keeps the spec 5.1 phase table", () => {
    expect(phaseSpec("Expansion")).toEqual({ g_range: [0, 0.02], length: [12, 28], next: "Overheating" });
    expect(phaseSpec("Contraction")).toEqual({ g_range: [-0.06, -0.03], length: [2, 8], next: "Recovery" });
    expect(LEGACY_PROFILE.lt_scale).toBe(1);
    expect(LEGACY_PROFILE.volatility_scale).toBe(1);
    expect(LEGACY_PROFILE.ai_boom).toBe(true);
  });

  it("every profile has unique ids and well formed phases", () => {
    expect(new Set(PROFILES.map((p) => p.id)).size).toBe(PROFILES.length);
    for (const p of PROFILES) {
      for (const phase of PHASES) {
        const s = p.phases[phase];
        expect(s.g_range[0], `${p.id} ${phase}`).toBeLessThanOrEqual(s.g_range[1]);
        expect(s.length[0], `${p.id} ${phase}`).toBeGreaterThan(0);
        expect(s.length[0], `${p.id} ${phase}`).toBeLessThanOrEqual(s.length[1]);
        expect(PHASES).toContain(s.next);
      }
    }
  });

  it("vanilla has a flat cycle and no AI boom", () => {
    const v = profileById("vanilla");
    expect(v).not.toBeNull();
    expect(v?.ai_boom).toBe(false);
    for (const phase of PHASES) expect(v?.phases[phase].g_range).toEqual([0, 0]);
  });

  it("an unknown profile is a load error", () => {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data");
    const made = simNew(r.value, 1, { profile: "no_such_profile" });
    expect(made.ok).toBe(false);
  });

  it("a profile reaches the world: start phase, scaled long-term rates, no boom date", () => {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data");
    const made = simNew(structuredClone(r.value), 7, { profile: "long_recession" });
    if (!made.ok) throw new Error("sim");
    const w = simWorld(made.value);
    expect(w.profile.id).toBe("long_recession");
    expect(w.cycle.phase).toBe("Contraction");
    expect(w.cycle.g_t).toBeLessThan(0);
    expect(w.ai.boom_date.year).toBeGreaterThan(3000);
    const retail = w.industries.find((i) => i.params.trend_growth === 0.03);
    expect(retail?.lt).toBeCloseTo(0.03 * w.profile.lt_scale, 12);
  });
});
