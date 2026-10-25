// The v_recap test of crates/sim/tests/m9_views.rs (the rest is test/views/m9_views.test.ts).
// Pending until the recap view is ported.
//
// Expects:
//   ../../../src/lib.ts                 simNew, simWorld, simViews
//   ../../../src/recap/jobs.ts          RECAPS_KEPT (20)
//   ../common/ops.ts                    company, runTo
import { describe, expect, it } from "vitest";
import { simNew, simViews, simWorld } from "../../../src/lib.ts";
import { RECAPS_KEPT } from "../../../src/recap/jobs.ts";
import { simDateYmd } from "../../../src/time/calendar.ts";
import { data, unwrap } from "../common/index.ts";
import { company, runTo } from "../common/ops.ts";
import { byField } from "../common/views.ts";

describe("m9 views", () => {
  it("past_recaps_open_by_quarter", () => {
    // m9-plan section 1: past recaps are reachable by quarter; the World keeps the last 20 (D433)
    // and v_recap serves each with the same banding.
    const sim = unwrap(simNew(data(), 2), "Sim::new");
    runTo(sim, simDateYmd(2021, 1, 2));
    const v = simViews(sim).recap.data;
    const quarters = v.recaps.map((r) => `${r.world.quarter.year} Q${r.world.quarter.q}`);
    expect(v.recaps.length, `${quarters}`).toBe(4);
    expect(simWorld(sim).recaps.length).toBe(4);
    const page = v.recaps.find((r) => r.world.quarter.year === 2020 && r.world.quarter.q === 3);
    if (page === undefined) throw new Error("Q3 2020");
    const priv = company(simWorld(sim), "CO-0002");
    expect(byField(page.companies, "company", priv)?.estimated).toBe(true);
    expect(v.recaps.at(-1)?.world.quarter).toEqual({ year: 2020, q: 4 });
    expect(RECAPS_KEPT).toBe(20);
  }, 120_000);
});
