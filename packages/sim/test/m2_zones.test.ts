// Port of crates/sim/tests/m2_zones.rs: M2.2: the zone economy's effective credit spread each
// quarter (spec 5.1.2). Done when the EU pays 112 and 56 bps at mid Contraction and Overheating,
// and Argentina 931 and 364.
//
// The spec and build-plan say Argentina pays 307 in a mid Overheating; the formula with
// Argentina's data (base 591, intensity 1.6) gives 591 x (1 - 8 x 1.6 x 0.03) = 364. 307 is what
// an intensity of 2.0 would give, so the prose figure is the error (design fix 100).
//
// Expects:
//   ../src/economy/cycle.ts  setZoneEffects(world, draws)
//   ../src/economy/zones.ts  effectiveSpread(base, effect), effectiveSpreadBps(base_bps,
//                               effect), setZoneSpreads(world)
//   ../src/lib.ts            simNew, simWorld, simStep, simNow
//   ../src/world/load.ts     worldFromData
//   ./common/economy.ts         worldAtLoad;  ./common/rng.ts  newNoNoise
// Rust f64::round is round half away from zero: roundHalfAway (types/num.ts).
//
// Changed from the Rust: none (NoNoise and the sim's own seed 4, whose seed does not matter to
// what is asserted).
import { describe, expect, it } from "vitest";
import { setZoneEffects } from "../src/economy/cycle.ts";
import { effectiveSpread, effectiveSpreadBps, setZoneSpreads } from "../src/economy/zones.ts";
import { simNew, simNow, simStep, simWorld } from "../src/lib.ts";
import { dateTimeDate, dateTimeHour, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { roundHalfAway } from "../src/types/num.ts";
import type { World } from "../src/types/world.ts";
import { worldFromData } from "../src/world/load.ts";
import { worldAtLoad } from "./common/economy.ts";
import { data, unwrap } from "./common/index.ts";
import { newNoNoise } from "./common/rng.ts";

/** The middle g of Contraction (-3% to -6%) and Overheating (+2% to +4%) (spec 5.1). */
const MID_CONTRACTION = -0.045;
const MID_OVERHEATING = 0.03;

function zoneOf(w: World, key: string) {
  const z = w.zones.find((x) => x.key === key);
  if (z === undefined) throw new Error(`no zone ${key}`);
  return z;
}

function baseAndIntensity(w: World, key: string): [number, number] {
  const z = zoneOf(w, key);
  return [z.credit_spread_base * 1e4, z.intensity];
}

describe("m2 zones", () => {
  it("eu_and_argentina_spreads_at_mid_phases", () => {
    const w = unwrap(worldFromData(data()), "World::from_data");
    const [eu, euI] = baseAndIntensity(w, "EU");
    const [ar, arI] = baseAndIntensity(w, "AR");
    expect([roundHalfAway(eu), euI]).toEqual([78.0, 1.2]);
    expect([roundHalfAway(ar), arI]).toEqual([591.0, 1.6]);
    expect(effectiveSpreadBps(eu, euI * MID_CONTRACTION)).toBe(112.0);
    expect(effectiveSpreadBps(eu, euI * MID_OVERHEATING)).toBe(56.0);
    expect(effectiveSpreadBps(ar, arI * MID_CONTRACTION)).toBe(931.0);
    expect(effectiveSpreadBps(ar, arI * MID_OVERHEATING)).toBe(364.0);
    // A zone with base 0 (Switzerland) stays at 0; the 0.5x to 2x clamp holds.
    expect(effectiveSpreadBps(0.0, -0.2)).toBe(0.0);
    expect(effectiveSpreadBps(591.0, -0.5)).toBe(1182.0);
    expect(effectiveSpreadBps(591.0, 0.5)).toBe(296.0);
    expect(Math.abs(effectiveSpread(0.0078, 0.0) - 0.0078) < 1e-15).toBe(true);
  });

  it("the_quarterly_job_reads_the_lagged_cycle", () => {
    // EU and Argentina lag the cycle by one quarter: a quarter after a mid Contraction began,
    // with the world now in Overheating, they still pay the Contraction spread.
    const w = worldAtLoad(data(), newNoNoise());
    w.cycle.g_t = MID_OVERHEATING;
    w.cycle.g_history = [MID_OVERHEATING, MID_CONTRACTION, MID_CONTRACTION];
    setZoneEffects(w, newNoNoise());
    setZoneSpreads(w);
    const bps = (key: string): number => roundHalfAway(zoneOf(w, key).credit_spread * 1e4);
    expect(bps("EU")).toBe(112.0);
    expect(bps("AR")).toBe(931.0);
    // North America has no lag: base 1 bps x (1 - 8 x 0.03) = 0.76, rounded to 1.
    expect(bps("NA")).toBe(1.0);
    expect(bps("CH")).toBe(0.0);
  });

  it("spreads_start_at_load_and_move_each_quarter_only", () => {
    const sim = unwrap(simNew(data(), 4), "Sim::new");
    const spreads = (): number[] => simWorld(sim).zones.map((z) => z.credit_spread);
    // At load the spread is set from the starting effect (Expansion pushes it at most 0.5x
    // under the base, never over it in a zone with no own shock).
    for (const z of simWorld(sim).zones) {
      expect(z.credit_spread <= z.credit_spread_base + 1e-12 || z.own_shock_sd > 0.0).toBe(true);
      expect(z.credit_spread >= 0.5 * z.credit_spread_base - 1e-4).toBe(true);
    }
    let last = spreads();
    const end = dateTimeMidnight(simDateYmd(2022, 1, 2));
    while (simNow(sim) < end) {
      simStep(sim);
      const now = spreads();
      if (now.some((x, i) => x !== last[i])) {
        const d = dateTimeDate(simNow(sim));
        expect(d.day === 1 && [1, 4, 7, 10].includes(d.month) && dateTimeHour(simNow(sim)) === 0).toBe(true);
        last = now;
      }
    }
  });
});
