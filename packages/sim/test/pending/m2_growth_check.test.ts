// Port of crates/sim/tests/m2_growth_check.rs: M2.10, the growth check (build-plan 4.2, spec 5.1
// "Growth check"): validate.py seed-150 40-quarter run, replayed through the engine.
// export_fixtures.py recorded every draw validate.py made (the cycle g and length draws, each
// industry growth shock) and its results (the phase path and each industry compound average
// yearly growth); the engine runs the same draws through a scripted source and must match to 1e-9.
//
// The draws are scripted, so the new RNG (D951) is not involved and nothing here changes.
//
// Expects:
//   ./common/rng.ts       newScripted, scriptedPush(s, stream, values), scriptedRemaining(s, stream)
//                         (ScriptedDraws, rng.ts)
//   ./common/economy.ts   economyScheduler, monthStarts, rel, runMonth, worldAtLoad
//   ../../src/world/load.ts worldFromData
//   World.cycle has z_avg, phase (a string union whose value is its name) and g_t
// The fixture is packages/sim/test/fixtures/validate-growth-seed150.csv.
import { describe, expect, it } from "vitest";
import { simDateYmd } from "../../src/time/calendar.ts";
import type { World } from "../../src/types/world.ts";
import { worldFromData } from "../../src/world/load.ts";
import { economyScheduler, monthStarts, rel, runMonth, worldAtLoad } from "./common/economy.ts";
import { fixtureText, lines } from "./common/fixtures.ts";
import { data, unwrap } from "./common/index.ts";
import { newScripted, type Scripted, scriptedPush, scriptedRemaining } from "./common/rng.ts";

const QUARTERS = 40;

/** validate-growth-seed150.csv, parsed. */
interface Fixture {
  z_avg: number;
  /** Quarter to (u, length) of a phase draw made that quarter (0 = load). */
  cycle: Map<number, [number, number]>;
  /** "quarter,industry key" to raw z. */
  z: Map<string, number>;
  /** Quarter to (phase name, g). */
  path: [string, number][];
  /** Industry key to compound average yearly growth. */
  avg: Map<string, number>;
  quarters_of_draws: number;
}

function fixture(): Fixture {
  const f: Fixture = {
    z_avg: Number.NaN,
    cycle: new Map(),
    z: new Map(),
    path: [],
    avg: new Map(),
    quarters_of_draws: 0,
  };
  const rows = lines(fixtureText("validate-growth-seed150.csv"))
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));
  for (const line of rows) {
    const p = line.split(",");
    const num = (i: number): number => Number(p[i]);
    const q = (): number => Number.parseInt(p[1] ?? "", 10);
    switch (p[0]) {
      case "z_avg":
        f.z_avg = num(1);
        break;
      case "cycle":
        f.cycle.set(q(), [num(2), num(3)]);
        break;
      case "z":
        f.quarters_of_draws = Math.max(f.quarters_of_draws, q() + 1);
        f.z.set(`${q()},${p[2]}`, num(3));
        break;
      case "path":
        expect(q()).toBe(f.path.length);
        f.path.push([p[2] ?? "", num(3)]);
        break;
      case "avg":
        f.avg.set(p[1] ?? "", num(2));
        break;
      default:
        throw new Error(`unknown fixture row ${p[0]}`);
    }
  }
  return f;
}

/**
 * The fixture draws in the order the engine makes them: per quarter, the cycle stream phase
 * draws (if the phase changed) then one own shock per zone with own dynamics (validate.py has
 * none, so 0), and the growth stream z for every industry in id order. The gen stream rolls the
 * pop date at load (2040 Q1; it does not touch 2020 to 2029).
 */
function scripted(f: Fixture, w: World): Scripted {
  const s = newScripted();
  scriptedPush(s, "Gen", [0.0, 1.0]);
  const shockZones = w.zones.filter((z) => z.own_shock_sd > 0.0).length;
  for (let q = 0; q < f.quarters_of_draws; q++) {
    const c = f.cycle.get(q);
    if (c !== undefined) scriptedPush(s, "Cycle", c);
    scriptedPush(s, "Cycle", new Array<number>(shockZones).fill(0.0));
    for (const ind of w.industries) {
      const z = f.z.get(`${q},${ind.key}`);
      if (z === undefined) throw new Error(`no z for ${q} ${ind.key}`);
      scriptedPush(s, "Growth", [z]);
    }
  }
  return s;
}

describe("m2 growth check", () => {
  it("seed_150_growth_run_matches_validate_py", () => {
    const f = fixture();
    const d = data();
    const fresh = unwrap(worldFromData(structuredClone(d)));
    expect(
      Math.abs(fresh.cycle.z_avg - f.z_avg) < 1e-12,
      `Z ${fresh.cycle.z_avg} vs validate.py ${f.z_avg}`,
    ).toBe(true);
    expect(f.quarters_of_draws).toBe(QUARTERS + 1);
    const draws = scripted(f, fresh);
    const w = worldAtLoad(d, draws);
    const s = economyScheduler();

    // q_growth by quarter and industry; the phase path.
    const growth: number[][] = w.industries.map(() => []);
    const path: [string, number][] = [];
    const record = (): void => {
      w.industries.forEach((ind, id) => {
        (growth[id] as number[]).push(ind.q_growth);
      });
      path.push([w.cycle.phase, w.cycle.g_t]);
    };
    record();
    // Every month from February 2020 to 1 January 2030, whose job closes December 2029 (D100).
    for (const date of monthStarts(simDateYmd(2020, 2, 1), simDateYmd(2030, 1, 1))) {
      runMonth(s, w, draws, date);
      if (date.month % 3 === 1 && date.year < 2030) record();
    }
    expect(scriptedRemaining(draws, "Cycle"), "every cycle draw used").toBe(0);
    expect(scriptedRemaining(draws, "Growth"), "every growth draw used").toBe(0);

    // The cycle path: same phase and the same g every quarter.
    expect(path.length).toBe(QUARTERS);
    path.forEach(([p, g], q) => {
      const [fp, fg] = f.path[q] as [string, number];
      expect(p, `phase in quarter ${q}`).toBe(fp);
      expect(Math.abs(g - fg) < 1e-15, `g in quarter ${q}: ${g} vs ${fg}`).toBe(true);
    });

    // Compound average yearly growth over the 40 quarters, to 1e-9.
    w.industries.forEach((ind, id) => {
      const qs = growth[id] as number[];
      expect(qs.length).toBe(QUARTERS);
      let logSum = 0;
      for (const q of qs) logSum += Math.log(1.0 + q);
      const avg = Math.exp((4.0 * logSum) / QUARTERS) - 1.0;
      const want = f.avg.get(ind.key) as number;
      expect(Math.abs(avg - want) < 1e-9, `${ind.key}: ${avg} vs validate.py ${want}`).toBe(true);
      // Demand follows the draws: after the 1 Jan 2030 job, the 2020 world size times every
      // quarter growth (M2.5).
      let product = 1;
      for (const q of qs) product *= 1.0 + q;
      const wantDemand = ind.world_size_2020_usd * product;
      expect(
        rel(ind.demand_core, wantDemand) < 1e-9,
        `${ind.key} demand ${ind.demand_core} vs ${wantDemand}`,
      ).toBe(true);
    });

    // The spec 5.1 summary of this run (batch 151): Retail 4.2%, Software 10.5%, AI labs 5.6%,
    // Oil -0.2%; this seed spends 26 of 40 quarters in Expansion or Overheating.
    const avgOf = (key: string): number => f.avg.get(key) as number;
    expect(Math.abs(avgOf("retail") - 0.042) < 0.0005).toBe(true);
    expect(Math.abs(avgOf("software") - 0.105) < 0.0005).toBe(true);
    expect(Math.abs(avgOf("ai_labs") - 0.056) < 0.0005).toBe(true);
    expect(Math.abs(avgOf("oil") + 0.002) < 0.0005).toBe(true);
    const hot = path.filter(([p]) => p === "Expansion" || p === "Overheating").length;
    expect(hot).toBe(26);
  });
});
