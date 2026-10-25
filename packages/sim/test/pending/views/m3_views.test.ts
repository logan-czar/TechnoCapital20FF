// Port of crates/sim/tests/m3_views.rs: the M3 views, read through the Sim API only (spec 9.2
// `get_company`, `get_company_board`, `get_company_units`, `get_company_tech`; 9.4 cadences), and
// the generated view copy the UI bridge uses.
//
// Expects:
//   ../../../src/lib.ts                 simNew, simApply, simViews; (via ../common/ops.ts) simStep,
//                                       simNow
//   ../../../src/types/views/index.ts   simViewsSameData(a, b), simViewsCopyChangedFrom(dst, src)
//                                       [SimViews::same_data, ::copy_changed_from; D700 lists them
//                                       as not ported logic]
//   ../../../src/views/tech.ts          techRowStoredTb(row) -> Figure [TechRow::stored_tb]
//   ../common/ops.ts                    runTo, company
//
// Changed from the Rust: the seed (2) seeds the new generator (D951). Everything asserted comes
// from the CSVs and the load (Arrowhead's loadout, the 651 units, the six seat cards, the 5.7
// management score) or from structure (versions), none of it from a draw, with one exception:
// "the productivity step ran: Arrowhead's unit moved off 100" holds as long as the monthly
// productivity step (5.6) moves it, which is the spec, not a draw. The cards' simple characters
// come from the gen stream, so card skills are not asserted, only the skill_used the cards
// report, as in the Rust.
import { describe, expect, it } from "vitest";
import { simApply, simNew, simViews } from "../../../src/lib.ts";
import { simDateYmd } from "../../../src/time/calendar.ts";
import type { CompanyId } from "../../../src/types/ids.ts";
import type { Seat } from "../../../src/types/state/people.ts";
import { simViewsCopyChangedFrom, simViewsSameData } from "../../../src/types/views/index.ts";
import { techRowStoredTb } from "../../../src/views/tech.ts";
import { stationsOf } from "../common/defaults.ts";
import { data, unwrap } from "../common/index.ts";
import { runTo } from "../common/ops.ts";
import { byField, figExactOrThrow, figShown } from "../common/views.ts";

describe("m3 views", () => {
  it("company_units_and_tech_views_show_arrowhead", () => {
    const sim = unwrap(simNew(data(), 2), "Sim::new");
    // Arrowhead is listed, but in an industry with one or two private companies its unit and
    // data figures are bands (D436); Omniscient shows the engine's values.
    unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "SetOmniscient");
    const v = simViews(sim);
    const arrowhead = 0 as CompanyId;

    const units = v.units.data;
    expect(units.units.length).toBe(651);
    const rows = units.units.filter((u) => u.company === arrowhead);
    expect(rows.length).toBe(1);
    const u = rows[0];
    if (u === undefined) throw new Error("no unit");
    const x = figExactOrThrow;
    expect(Math.abs(12.0 * x(u.revenue_m) - 40.0e6) < 0.01e6).toBe(true);
    expect([x(u.productivity), x(u.p_pre)]).toEqual([100.0, 102.0]);
    expect(x(u.shared_m)).toBe(4_080.0);
    const lines = x(u.revenue_m) - x(u.variable_m) - x(u.fixed_m) - x(u.rd_m) - x(u.dep_m);
    expect(Math.abs(x(u.ebit_m) - (lines - x(u.shared_m))) < 1e-9).toBe(true);

    const t = byField(v.tech.data.companies, "company", arrowhead);
    if (t === undefined) throw new Error("no tech row");
    expect(t.labor_units).toBe(392);
    expect(t.stations).toEqual(stationsOf({ productivity: 98, enterprise: 1, idle: 293 }));
    // PC 98 gives +2; the next step (+3) starts at PC 100 (5.8 table).
    expect([t.pc, t.pc_bonus, t.next_bonus_pc]).toEqual([98.0, 2.0, 100.0]);
    expect(t.compute.monthly_usd).toBe(4_080.0);
    const d = t.data[0];
    if (d === undefined) throw new Error("no data book");
    const held = figExactOrThrow(d.held_tb);
    expect(Math.abs(held - 8.6) < 0.05).toBe(true);
    // 1% free R&D from 1 TB; the next step (2%) at 10 TB (5.9).
    expect([d.free_rd_pct, d.next_step_tb, d.buckets]).toEqual([1, 10.0, 1]);
    expect(Math.abs(figExactOrThrow(d.inflow_tb) - 40.0 / 12.0) < 1e-3).toBe(true);
    expect(d.conversion_tb).toBe(0.9125);
    expect(Math.abs(figExactOrThrow(techRowStoredTb(t)) - (held + 40.0 / 12.0)) < 1e-9).toBe(true);

    const c = byField(v.company_detail.data.companies, "id", arrowhead);
    if (c === undefined) throw new Error("no detail");
    expect([c.key, c.name]).toEqual(["CO-0001", "Arrowhead Drilling"]);
    expect(c.controller_name).toBe("Terry Tippacanoe");
    expect(c.board.length).toBe(6);
    let weighted = 0.0;
    for (const card of c.board) {
      const weights: Record<Seat, number> = { Ceo: 0.3, Coo: 0.2, Cfo: 0.2, Cio: 0.1, Cmo: 0.1, Chair: 0.1 };
      weighted += weights[card.seat] * card.skill_used;
      if (card.seat === "Chair") {
        expect(!card.open && card.holder === null && card.skill_used === 3.0).toBe(true);
      } else {
        const p = card.holder;
        if (p === null) throw new Error(`${card.seat} is empty`);
        expect(card.open && p.partial && p.character === null).toBe(true);
      }
    }
    // Spec 5.7: sum weight x skill / 20 x 100; confidence factor 0.8 + score / 250.
    expect(Math.abs(c.management_score - (weighted / 20.0) * 100.0) < 1e-9).toBe(true);
    expect(Math.abs(c.confidence_factor - (0.8 + c.management_score / 250.0)) < 1e-12).toBe(true);
  });

  it("m3_views_rebuild_monthly_and_copy_by_version", () => {
    const sim = unwrap(simNew(data(), 2), "Sim::new");
    const stale = structuredClone(simViews(sim));
    // Before the 9 January lock, which also rebuilds the company views (births, D159).
    runTo(sim, simDateYmd(2020, 1, 8));
    let v = simViews(sim);
    expect(v.tech.version, "monthly: no rebuild mid-month").toBe(stale.tech.version);
    runTo(sim, simDateYmd(2020, 2, 1));
    v = simViews(sim);
    for (const version of [v.tech.version, v.units.version, v.company_detail.version]) {
      expect(version > stale.tech.version).toBe(true);
    }
    // The productivity step ran: Arrowhead's unit moved off 100.
    const first = v.units.data.units[0];
    if (first === undefined) throw new Error("no units");
    expect(figShown(first.productivity)).not.toBe(100.0);
    // The generated copy brings a stale copy up to the sim's views (data and versions; the dirty
    // flags of views it did not need to copy stay the copy's own).
    const copy = stale;
    expect(simViewsSameData(copy, v)).toBe(false);
    simViewsCopyChangedFrom(copy, v);
    expect(simViewsSameData(copy, v)).toBe(true);
    expect(copy.refresh).toBe(v.refresh);
    for (const [a, b] of [
      [copy.tech.version, v.tech.version],
      [copy.units.version, v.units.version],
      [copy.company_detail.version, v.company_detail.version],
      [copy.industry_rows.version, v.industry_rows.version],
      [copy.map_static.version, v.map_static.version],
    ] as const) {
      expect(a).toBe(b);
    }
  }, 120_000);
});
