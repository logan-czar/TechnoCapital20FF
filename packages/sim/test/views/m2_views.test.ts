// The cycle test of crates/sim/tests/m2_views.rs; the industry test waits in pending/ on
// industry_rows and industry_detail (lane A). SetOmniscient needs a debug Sim (D961).
// Port of crates/sim/tests/m2_views.rs: the M2 views, read through the Sim API only (spec 9.2
// `list_industries`, `get_industry`, `get_cycle`; 9.4 cadences).
//
// Expects:
//   ../../../src/lib.ts   simNew, simApply, simStep, simNow, simViews
//   (view data is plain, types/views/; lookups are local helpers in ../common/views.ts)
//
// Changed from the Rust: the seed (3) seeds the new generator (D951). Nothing asserted depends on
// a specific draw: the 42 industry rows at load (S and M 1.00 as in m2_load), the 20 closed
// quarters kept after six years, the 26 zones, the Expansion start phase and the pop date being
// hidden outside Omniscient. The 2038..2042 pop-year range is the roll's own range (spec 5.1.1).
import { describe, expect, it } from "vitest";
import { simApply, simNew, simViews } from "../../src/lib.ts";
import { data, unwrap } from "../common/index.ts";

describe("m2 views", () => {
  it("cycle_view_hides_the_pop_date_outside_omniscient", () => {
    const sim = unwrap(simNew(data(), 3, { debug: true }), "Sim::new");
    const c = structuredClone(simViews(sim).cycle.data);
    expect(c.zones.length).toBe(26);
    expect(c.phase).toBe("Expansion");
    expect(c.g_t >= 0.0 && c.g_t < 0.02).toBe(true);
    expect(Math.abs(c.z_avg - 1.07) < 0.005).toBe(true);
    expect(c.pop_date).toBeNull();
    expect(c.boom_year).toBeNull();
    unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "SetOmniscient");
    const pop = simViews(sim).cycle.data.pop_date;
    if (pop === null) throw new Error("shown in Omniscient");
    expect(pop.year >= 2038 && pop.year <= 2042).toBe(true);
  });
});
