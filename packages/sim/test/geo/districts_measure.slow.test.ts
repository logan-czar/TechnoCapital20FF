// Lane G's measurements (pivot 5.4, 5.5; D1039), as the spike reported them
// (tools/spikes/districts/README.md section 4): every state of the 1995 world on its 1990 counties
// and seats, drawn neutral and by each party at s = 0.5 and 1. Prints expected party-A seats
// nationally and for CA, TX, PA, and the time each strength took; holds the national totals to the
// drawer's side and every map to pivot 5.4's properties. Slow: run it by name.

import { describe, expect, it } from "vitest";
import { drawPlan, expectedSeatsA, type Plan, regionContiguous } from "../../src/geo/district.ts";
import { countiesByState, DISTRICT_POP_TOLERANCE, drawStatsNew, stateGraph } from "../../src/geo/plans.ts";
import { simNew, simWorld } from "../../src/lib.ts";
import { data1995, unwrap } from "../common/index.ts";

const RUNS: readonly (readonly [string, number, number])[] = [
  ["B 1.0", 1, -1],
  ["B 0.5", 0.5, -1],
  ["neutral", 0, 1],
  ["A 0.5", 0.5, 1],
  ["A 1.0", 1, 1],
];
const SHOWN = ["California", "Texas", "Pennsylvania"];

describe("districting measurements (pivot 5.4, 5.5)", () => {
  it("draws all 50 states at each strength for each party, contiguous and equal", () => {
    const w = simWorld(unwrap(simNew(data1995(), 1), "1995 world"));
    const byState = countiesByState(w.geo, w.politics.states.length);
    const rows: string[] = [];
    const national: number[] = [];
    const shown: Record<string, number[]> = Object.fromEntries(SHOWN.map((s) => [s, []]));
    for (const [label, s, sign] of RUNS) {
      const stats = drawStatsNew();
      const t0 = performance.now();
      let slowest = 0;
      let slowestName = "";
      let total = 0;
      for (const plan of w.geo.plans) {
        const g = stateGraph(w.geo, byState[plan.state] as number[]);
        const t1 = performance.now();
        const drawn: Plan = drawPlan(g, plan.districts.length, s, sign, 0.1, stats);
        const dt = performance.now() - t1;
        const name = w.politics.states[plan.state]?.name ?? "";
        if (dt > slowest) {
          slowest = dt;
          slowestName = name;
        }
        const seats = expectedSeatsA(g, drawn);
        total += seats;
        if (name in shown) shown[name]?.push(seats);
        const people = g.pop.reduce((a, b) => a + b, 0);
        const ideal = people / drawn.length;
        for (const r of drawn) {
          const p = r.reduce((a, q) => a + (q.to - q.from) * (g.pop[q.i] as number), 0);
          expect(Math.abs(p - ideal) / ideal, name).toBeLessThan(DISTRICT_POP_TOLERANCE);
          expect(regionContiguous(g, r), name).toBe(true);
        }
      }
      const ms = performance.now() - t0;
      national.push(total);
      rows.push(
        `${label}: A seats ${total.toFixed(1)}; ${ms.toFixed(0)} ms (slowest ${slowestName} ${slowest.toFixed(0)} ms); ` +
          `sweeps ${stats.sweeps}, backtracks ${stats.backtracks}, forced ${stats.forced}, kept weaker ${stats.kept_weaker}`,
      );
    }
    for (const name of SHOWN)
      rows.push(`${name}: ${(shown[name] ?? []).map((x) => x.toFixed(2)).join(" / ")}`);
    console.log(`expected party-A seats, B 1.0 / B 0.5 / neutral / A 0.5 / A 1.0\n${rows.join("\n")}`);
    for (let i = 1; i < national.length; i++) {
      expect(national[i] as number).toBeGreaterThan((national[i - 1] as number) - 0.5);
    }
    expect((national[4] as number) - (national[0] as number)).toBeGreaterThan(20);
  });
});
