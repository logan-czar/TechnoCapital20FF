// The state hash (build-plan M1.8, 4.3): the same seed and ticks give the same hash; the seed, the
// clock, the tables and the RNG positions all move it; controls do not (D13). Ported from
// crates/sim/tests/hash.rs, on `testSim` (test_sim.ts).

import { describe, expect, it } from "vitest";
import { type Sim, simRegisterTestJob, simWorld } from "../src/lib.ts";
import type { StateHash } from "../src/types/sim-api.ts";
import { churningSim, drawOnly, testSim } from "./test_sim.ts";

function monthlyHashes(sim: Sim, months: number): StateHash[] {
  const out: StateHash[] = [];
  while (out.length < months) {
    if (sim.step().some((n) => n.kind === "MonthDone")) out.push(sim.stateHash());
  }
  return out;
}

describe("state hash", () => {
  it("follows the state, not the controls", () => {
    const [a, b, c] = [testSim(1), testSim(1), testSim(2)];
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.stateHash(), "the seed is part of the state").not.toBe(c.stateHash());
    const start = a.stateHash();
    for (let i = 0; i < 100; i++) {
      a.step();
      b.step();
    }
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.stateHash(), "the clock is part of the state").not.toBe(start);
    const h = a.stateHash();
    expect(a.apply({ kind: "SetSpeed", speed: 4 }).ok).toBe(true);
    expect(a.apply({ kind: "SetAlert", alert_kind: "PlanLock", level: "Off" }).ok).toBe(true);
    expect(a.stateHash()).toBe(h);
    // Rust: 64 hex digits (256 bits); the TS hash is 128 bits (types/sim-api.ts StateHash).
    expect(a.stateHash()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("RNG positions move the hash", () => {
    const drawn = testSim(1);
    simRegisterTestJob(drawn, "Alerts", "test.draw_only", drawOnly);
    const idle = testSim(1);
    drawn.step();
    idle.step();
    expect(simWorld(drawn), "the draws wrote nothing").toEqual(simWorld(idle));
    expect(drawn.stateHash()).not.toBe(idle.stateHash());
  });

  it("a replay with draws gives the same monthly hashes", () => {
    const [a, b, c] = [churningSim(5), churningSim(5), churningSim(6)];
    const [ha, hb, hc] = [monthlyHashes(a, 14), monthlyHashes(b, 14), monthlyHashes(c, 14)];
    expect(ha).toEqual(hb);
    expect(
      ha.every((x, i) => x !== hc[i]),
      "seeds differ",
    ).toBe(true);
    expect(simWorld(a)).toEqual(simWorld(b));
    expect(simWorld(a), "the draws reached the tables").not.toEqual(simWorld(c));
  });
});
