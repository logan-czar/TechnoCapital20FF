// Port of crates/sim/tests/held_views.rs: views a reader holds do not change the game (D775): a
// sim whose views are cloned and held across every tick (as the Bevy bridge holds its copy) builds
// the same views and the same state as one nobody reads, tick for tick.
//
// Expects:
//   ../../../src/lib.ts   simNew, simStep, simViews, simStateHash
//
// Changed from the Rust: in Rust the held copy shares each view's data through Arc, so a view
// rebuilt in place (v_quotes, v_statements) has to rebuild from it (`ViewData::rebuild_from`).
// In TS the equivalent hazard is a view builder that mutates last tick's view object in place
// (D402, D435 reuse allocations) while a reader still holds it. The held copy here is a
// reference to each tick's views plus a structuredClone of them (what the Worker bridge
// receives); after the next tick the reference must still equal the clone. `same_data` (Arc
// pointer-or-value equality) is toEqual.
import { describe, expect, it } from "vitest";
import { simNew, simStateHash, simStep, simViews } from "../../../src/lib.ts";
import { data, unwrap } from "../common/index.ts";

/**
 * Ticks to 10 February 2020: the Q4 2019 release (2 January), its price move, the plan lock
 * (9 January) and two month starts, each with a reader holding the views it replaces.
 */
const TICKS = 41 * 24;

describe("held views", () => {
  it("a_held_copy_of_the_views_changes_nothing", () => {
    const free = unwrap(simNew(data(), 42), "Sim::new");
    const heldSim = unwrap(simNew(data(), 42), "Sim::new");
    // The copy taken after the previous tick, held while the next tick rebuilds the views.
    let heldRef = simViews(heldSim);
    let heldCopy = structuredClone(heldRef);
    for (let tick = 0; tick < TICKS; tick++) {
      const a = simStep(free);
      const b = simStep(heldSim);
      expect(a, `tick ${tick}: notices`).toEqual(b);
      const va = simViews(free);
      const vb = simViews(heldSim);
      expect(va.statements.data, `tick ${tick}: v_statements`).toEqual(vb.statements.data);
      expect(va.quotes.data, `tick ${tick}: v_quotes`).toEqual(vb.quotes.data);
      if (a.some((n) => n.kind === "DayDone") || tick % 24 === 0) {
        expect(va, `tick ${tick}: every view`).toEqual(vb);
        expect(simStateHash(free), `tick ${tick}: state`).toBe(simStateHash(heldSim));
      }
      // What the reader held from before this tick must still be what it was then (a rebuild in
      // place would have changed it under the reader's feet).
      expect(heldRef.quotes.data, `tick ${tick}: held v_quotes`).toEqual(heldCopy.quotes.data);
      expect(heldRef.statements.data, `tick ${tick}: held v_statements`).toEqual(heldCopy.statements.data);
      heldRef = vb;
      heldCopy = structuredClone(vb);
    }
  }, 600_000);
});
