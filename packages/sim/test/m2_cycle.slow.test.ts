// Port of crates/sim/tests/m2_cycle.rs: M2.1: the global cycle (phases, g_t, lengths), the zone
// effect with lags and own shocks, and Z (spec 5.1). Done when phase lengths and g_t stay in
// their ranges over 500 seeds.
//
// Expects:
//   ../src/economy/cycle.ts  START_PHASE, advanceCycle(cycle, draws), phaseSpec(phase) ->
//                               { g_range: [lo, hi], length: [shortest, longest], next },
//                               setZoneEffects(world, draws), startCycle(max_lag, z_avg, draws)
//                               -> GlobalCycle, drawOwnShock(sd, draws)
//   ../src/lib.ts           simNew, simWorld, simStep, simNow
//   ../src/time/calendar.ts simDateYmd, dateTimeMidnight, dateTimeHour, dateTimeDate
//   ../src/world/load.ts    worldFromData
//   ./common/economy.ts        worldAtLoad;  ./common/rng.ts  newRng, newNoNoise, newScripted,
//                              scriptedPush, scriptedRemaining
//
// Changed from the Rust: RngStreams::new(seed) is the new generator (D951). Every assertion here
// is a range, a coverage check over 500 seeds or a moment of a large sample, none an exact draw,
// so all hold unchanged for a sound generator. The scripted-draw zone test is unchanged.
import { describe, expect, it } from "vitest";
import {
  advanceCycle,
  drawOwnShock,
  phaseSpec,
  START_PHASE,
  setZoneEffects,
  startCycle,
} from "../src/economy/cycle.ts";
import { simNew, simNow, simStep, simWorld } from "../src/lib.ts";
import { dateTimeDate, dateTimeHour, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { CyclePhase } from "../src/types/world.ts";
import { worldFromData } from "../src/world/load.ts";
import { worldAtLoad } from "./common/economy.ts";
import { data, unwrap } from "./common/index.ts";
import { newNoNoise, newRng, newScripted, scriptedPush, scriptedRemaining } from "./common/rng.ts";

/** 100 years of quarters per seed. */
const QUARTERS = 400;

/**
 * The spec 5.1 phase table, written out here so the test does not read the code under test:
 * phase, g_t a year (low, high), length in quarters (shortest, longest), next phase.
 */
type Row = [CyclePhase, [number, number], [number, number], CyclePhase];
const SPEC_5_1: Row[] = [
  ["Expansion", [0.0, 0.02], [12, 28], "Overheating"],
  ["Overheating", [0.02, 0.04], [2, 6], "Contraction"],
  ["Contraction", [-0.06, -0.03], [2, 8], "Recovery"],
  ["Recovery", [-0.02, 0.01], [4, 10], "Expansion"],
];

function specRow(phase: CyclePhase): Row {
  const r = SPEC_5_1.find((x) => x[0] === phase);
  if (r === undefined) throw new Error(`no row ${phase}`);
  return r;
}

describe("m2 cycle", () => {
  it("phase_table_is_the_spec_table", () => {
    for (const [phase, g, len, next] of SPEC_5_1) {
      const spec = phaseSpec(phase);
      expect([spec.g_range, spec.length, spec.next], phase).toEqual([g, len, next]);
    }
    expect(START_PHASE, "the game starts in Expansion (7.3)").toBe("Expansion");
  });

  it("phase_lengths_and_g_stay_in_range_over_500_seeds", () => {
    let phases = 0;
    let quarters = 0;
    let gQuarters = 0.0;
    // The shortest and longest length seen per phase: a uniform whole-quarter draw reaches both
    // ends of its range (D101).
    const seen: [number, number][] = SPEC_5_1.map(() => [Number.MAX_SAFE_INTEGER, 0]);
    for (let seed = 0; seed < 500; seed++) {
      const rng = newRng(seed);
      const c = startCycle(2, 1.07, rng);
      expect(c.phase, "the game starts in Expansion (7.3)").toBe("Expansion");
      let entered: [CyclePhase, number, number] = [c.phase, c.g_t, c.quarters_left];
      const check = ([phase, g, len]: [CyclePhase, number, number]): void => {
        const [, [lo, hi], [shortest, longest]] = specRow(phase);
        expect(g >= lo && g < hi, `seed ${seed}: ${phase} g ${g}`).toBe(true);
        expect(len >= shortest && len <= longest, `seed ${seed}: ${phase} length ${len}`).toBe(true);
        const i = SPEC_5_1.findIndex((r) => r[0] === phase);
        const s = seen[i] as [number, number];
        seen[i] = [Math.min(s[0], len), Math.max(s[1], len)];
      };
      check(entered);
      let used = 1;
      for (let q = 1; q < QUARTERS; q++) {
        const was = c.phase;
        advanceCycle(c, rng);
        gQuarters += c.g_t;
        if (c.phase !== was) {
          expect(used, `seed ${seed}: the phase ran its drawn length`).toBe(entered[2]);
          expect(c.phase, "phases go in the spec 5.1 order").toBe(specRow(was)[3]);
          entered = [c.phase, c.g_t, c.quarters_left];
          check(entered);
          phases += 1;
          used = 1;
        } else {
          used += 1;
          expect(c.g_t, "g_t holds for the whole phase").toBe(entered[1]);
        }
        expect(c.g_history[0]).toBe(c.g_t);
        quarters += 1;
      }
    }
    SPEC_5_1.forEach(([phase, , len], i) => {
      expect(seen[i], `${phase}: lengths seen cover the whole range`).toEqual(len);
    });
    // Spec 5.1: an average cycle (four phases) runs about 9 years and g_t averages about +0.2% a
    // year over it.
    const quartersPerCycle = (4.0 * quarters) / phases;
    expect(quartersPerCycle >= 32.0 && quartersPerCycle < 40.0, `${quartersPerCycle}`).toBe(true);
    const meanG = gQuarters / quarters;
    expect(meanG >= 0.0005 && meanG < 0.003, `${meanG}`).toBe(true);
  });

  it("z_is_the_gdp_weighted_intensity", () => {
    // Spec 5.1: Z is 1.07 at the 2020 data with the 26 zones.
    const w = unwrap(worldFromData(data()), "World::from_data");
    expect(Math.abs(w.cycle.z_avg - 1.07) < 0.005, `${w.cycle.z_avg}`).toBe(true);
    let shares = 0;
    let byZone = 0;
    for (const z of w.zones) {
      shares += z.gdp_share;
      byZone += z.gdp_share * z.intensity;
    }
    expect(Math.abs(shares - 1.0) < 1e-12).toBe(true);
    expect(Math.abs(byZone - w.cycle.z_avg) < 1e-12, "sum of gdp_share x intensity is Z too").toBe(true);
  });

  it("zone_effects_lag_and_own_shocks", () => {
    const w = worldAtLoad(data(), newNoNoise());
    // Before the start every lag reads the starting g_t (spec 5.1).
    const g0 = w.cycle.g_t;
    expect(w.cycle.g_history.every((g) => g === g0)).toBe(true);
    // A history of three different quarters: now 0.03, a quarter ago -0.045, two ago 0.01.
    w.cycle.g_history = [0.03, -0.045, 0.01];
    w.cycle.g_t = 0.03;
    const shockZones = w.zones.filter((z) => z.own_shock_sd > 0.0).map((z) => z.key);
    expect(shockZones, "zones with their own dynamics").toEqual(["CUB", "PRK", "RU"]);
    const s = newScripted();
    scriptedPush(s, "Cycle", [1.0, -5.0, 0.5]);
    setZoneEffects(w, s);
    expect(scriptedRemaining(s, "Cycle"), "one draw per own-shock zone only").toBe(0);
    const zone = (key: string) => {
      const z = w.zones.find((x) => x.key === key);
      if (z === undefined) throw new Error(`no zone ${key}`);
      return z;
    };
    const close = (a: number, b: number): void => {
      expect(Math.abs(a - b) < 1e-15, `${a} vs ${b}`).toBe(true);
    };
    close(zone("NA").effect, 1.0 * 0.03); // lag 0
    close(zone("EU").effect, 1.2 * -0.045); // lag 1
    close(zone("AFS").effect, 1.3 * 0.01); // lag 2
    // Cuba: intensity 0.3, lag 2, own shock 0.03 x z; North Korea's z is clamped to -3.
    close(zone("CUB").effect, 0.3 * 0.01 + 0.03 * 1.0);
    close(zone("PRK").effect, 0.3 * 0.01 + 0.03 * -3.0);
    close(zone("RU").effect, 1.1 * -0.045 + 0.02 * 0.5);

    // Own shocks have the zone's sd (D102: own_shock_sd is the sd of each quarter's draw). A
    // moment of 20,000 draws, so it holds for any sound generator (D951).
    const rng = newRng(3);
    const n = 20_000;
    let sumSq = 0.0;
    for (let i = 0; i < n; i++) {
      const x = drawOwnShock(0.03, rng);
      sumSq += x * x;
    }
    const sd = Math.sqrt(sumSq / n);
    expect(Math.abs(sd - 0.03) < 0.001, `${sd}`).toBe(true);
  });

  it("the_cycle_advances_only_at_quarter_starts", () => {
    // Through the full game: g_t and the phase change only on 1 Jan, Apr, Jul and Oct.
    const sim = unwrap(simNew(data(), 11), "Sim::new");
    let last = [simWorld(sim).cycle.phase, simWorld(sim).cycle.quarters_left];
    const end = dateTimeMidnight(simDateYmd(2024, 1, 2));
    while (simNow(sim) < end) {
      simStep(sim);
      const c = simWorld(sim).cycle;
      const now = [c.phase, c.quarters_left];
      if (now[0] !== last[0] || now[1] !== last[1]) {
        const d = dateTimeDate(simNow(sim));
        expect(dateTimeHour(simNow(sim)) === 0 && d.day === 1 && [1, 4, 7, 10].includes(d.month)).toBe(true);
        last = now;
      }
    }
  });
});
