// Port of crates/sim/tests/held_views.rs: views a reader holds do not change the game (D775): a
// sim whose views are cloned and held across every tick (as the Bevy bridge holds its copy) builds
// the same views and the same state as one nobody reads, tick for tick.
//
// Expects:
//   ../../src/lib.ts   simNew, simStep, simViews, simStateHash
//   ../../src/views/index.ts   plainEqual, simViewsClone, simViewsSameData
//
// Changed from the Rust: in Rust the held copy shares each view's data through Arc, so a view
// rebuilt in place (v_quotes, v_statements) has to rebuild from it (`ViewData::rebuild_from`).
// In TS the equivalent hazard is a view builder that mutates last tick's view object in place
// (D402, D435 reuse allocations) while a reader still holds it. `simViews` is the Sim's live
// container, whose view wrappers are swapped each tick, so the held copy is `simViewsClone` (Rust
// `SimViews::clone`: every build shared, as the Arcs are) plus a structuredClone of its v_quotes
// and v_statements (the two Rust rebuilds in place); after the next tick the shared builds must
// still equal the clones (a clone is retaken only when the view's version moves). View equality
// is plainEqual (Rust `PartialEq`; Vitest's toEqual on every tick made the test take minutes) and
// `same_data` is simViewsSameData. `same_data` (Arc
// pointer-or-value equality) is toEqual.
import { describe, expect, it } from "vitest";
import { simNew, simStateHash, simStep, simViews } from "../../src/lib.ts";
import type { SimViews } from "../../src/types/views/index.ts";
import { plainEqual, simViewsClone, simViewsSameData } from "../../src/views/index.ts";
import { data, macrotask, unwrap } from "../common/index.ts";

/**
 * Ticks to 10 February 2020: the Q4 2019 release (2 January), its price move, the plan lock
 * (9 January) and two month starts, each with a reader holding the views it replaces.
 */
const TICKS = 41 * 24;

describe("held views", () => {
  it("a_held_copy_of_the_views_changes_nothing", async () => {
    const free = unwrap(simNew(data(), 42), "Sim::new");
    const heldSim = unwrap(simNew(data(), 42), "Sim::new");
    // The copy taken after the previous tick, held while the next tick rebuilds the views.
    type Held = {
      ref: SimViews;
      quotes: SimViews["quotes"]["data"];
      statements: SimViews["statements"]["data"];
    };
    const hold = (v: SimViews, prev: Held | null): Held => {
      const ref = simViewsClone(v);
      const same = (n: "quotes" | "statements") => prev !== null && prev.ref[n].version === ref[n].version;
      return {
        ref,
        quotes: same("quotes") && prev !== null ? prev.quotes : structuredClone(ref.quotes.data),
        statements:
          same("statements") && prev !== null ? prev.statements : structuredClone(ref.statements.data),
      };
    };
    let held = hold(simViews(heldSim), null);
    for (let tick = 0; tick < TICKS; tick++) {
      const a = simStep(free);
      const b = simStep(heldSim);
      expect(a, `tick ${tick}: notices`).toEqual(b);
      const va = simViews(free);
      const vb = simViews(heldSim);
      expect(plainEqual(va.statements.data, vb.statements.data), `tick ${tick}: v_statements`).toBe(true);
      expect(plainEqual(va.quotes.data, vb.quotes.data), `tick ${tick}: v_quotes`).toBe(true);
      if (a.some((n) => n.kind === "DayDone") || tick % 24 === 0) {
        expect(simViewsSameData(va, vb), `tick ${tick}: every view`).toBe(true);
        expect(simStateHash(free), `tick ${tick}: state`).toBe(simStateHash(heldSim));
        await macrotask(); // D967: let Vitest's worker answer its RPC once a simulated day
      }
      // What the reader held from before this tick must still be what it was then (a rebuild in
      // place would have changed it under the reader's feet).
      expect(plainEqual(held.ref.quotes.data, held.quotes), `tick ${tick}: held v_quotes`).toBe(true);
      expect(plainEqual(held.ref.statements.data, held.statements), `tick ${tick}: held v_statements`).toBe(
        true,
      );
      held = hold(vb, held);
    }
  }, 600_000);
});
