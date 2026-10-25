// The view half of crates/sim/tests/m6_births.rs `births_follow_5_19_on_the_live_engine` (the rest
// is test/m6_births.test.ts): after two years of births, the births view lists every birth (9.2
// list_births) and the company rows list every newborn (list_companies).
//
// Changed from the Rust: the same run (seed 21 to 10 January 2022) is made here on its own, so the
// world-side checks do not wait for the views.
import { describe, expect, it } from "vitest";
import { simNew, simNow, simStep, simViews, simWorld } from "../../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import { birthsViewListBirths } from "../../src/views/births.ts";
import { data, idRows, unwrap } from "../common/index.ts";

describe("m6 births views", () => {
  it("the_views_list_every_birth", () => {
    const sim = unwrap(simNew(data(), 21), "Sim::new");
    const end = dateTimeMidnight(simDateYmd(2022, 1, 10));
    while (simNow(sim) < end) simStep(sim);
    const w = simWorld(sim);
    const born: CompanyId[] = idRows<CompanyId, (typeof w.companies)[number]>(w.companies)
      .filter(([, c]) => c.origin.kind === "Born")
      .map(([id]) => id);
    const v = simViews(sim);
    expect(birthsViewListBirths(v.births.data, simDateYmd(2020, 1, 1)).length).toBe(born.length);
    const rows = v.company_rows.data.rows;
    for (const id of born) {
      expect(
        rows.some((r) => r.id === id),
        "v_company_row lists a newborn",
      ).toBe(true);
    }
  });
});
