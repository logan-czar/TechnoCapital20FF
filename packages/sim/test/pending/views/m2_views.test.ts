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
import { simApply, simNew, simNow, simStep, simViews } from "../../../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../../../src/time/calendar.ts";
import { data, unwrap } from "../common/index.ts";
import { byId, figExactOrThrow } from "../common/views.ts";

describe("m2 views", () => {
  it("industry_views_at_load_and_after_six_years", () => {
    const sim = unwrap(simNew(data(), 3), "Sim::new");
    // The top 5 and the detail list rank by the revenue shown; a private company's is a band
    // (D420), so the exact shares and order are checked with Omniscient on.
    const bandedFirst = [
      ...(simViews(sim).industry_rows.data.rows[0] as { top_companies: number[] }).top_companies,
    ];
    expect(bandedFirst.length > 0).toBe(true);
    unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "SetOmniscient");
    const v = simViews(sim);
    const rows = v.industry_rows.data.rows;
    expect(rows.length).toBe(42);
    for (const r of rows) {
      expect(
        `${figExactOrThrow(r.supply_ratio).toFixed(2)} ${figExactOrThrow(r.market_factor).toFixed(2)}`,
      ).toBe("1.00 1.00");
      expect(r.top_companies.length <= 5 && r.top_companies.length > 0).toBe(true);
      const fringe = figExactOrThrow(r.fringe_share);
      expect(fringe >= 0.0 && fringe < 1.0).toBe(true);
      const detail = byId(v.industry_detail.data.industries, r.id);
      if (detail === undefined) throw new Error(`no detail for ${r.key}`);
      expect(detail.companies[0]?.company).toBe(r.top_companies[0]);
      const shares =
        detail.companies.reduce((acc, c) => acc + figExactOrThrow(c.share), 0) +
        figExactOrThrow(detail.fringe_share);
      expect(Math.abs(shares - 1.0) < 1e-9).toBe(true);
      const revenue = (c: (typeof detail.companies)[number]): number => figExactOrThrow(c.revenue_m);
      for (let i = 0; i + 1 < detail.companies.length; i++) {
        const [a, b] = [detail.companies[i], detail.companies[i + 1]] as [
          (typeof detail.companies)[number],
          (typeof detail.companies)[number],
        ];
        expect(revenue(a) > revenue(b) || (revenue(a) === revenue(b) && a.company < b.company)).toBe(true);
      }
    }
    const end = dateTimeMidnight(simDateYmd(2026, 1, 2));
    while (simNow(sim) < end) simStep(sim);
    const detail = simViews(sim).industry_detail.data.industries[0];
    if (detail === undefined) throw new Error("no industries");
    expect(detail.history.length, "20 closed quarters kept").toBe(20);
    expect(detail.history[detail.history.length - 1]?.quarter.year).toBe(2025);
  }, 300_000);

  it("cycle_view_hides_the_pop_date_outside_omniscient", () => {
    const sim = unwrap(simNew(data(), 3), "Sim::new");
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
