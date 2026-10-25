// Port of crates/sim/tests/m3_stations_compute.rs: M3.4 and M3.5 against the live engine: the
// 7.1 stations and the PC bonus (spec 5.8; 4.3 step 5) and the 3.8 compute and licence costs
// feeding the shared costs at load and monthly (5.5, D108). Expected values are worked from the
// spec, written out here.
//
// Spec M3.4 done: bonus steps match the 5.8 table. Spec M3.5 done: costs match 3.8 for
// Arrowhead (79 extra base compute, 10 data compute, 1 licence: $4,080 a month).
//
// Expects:
//   ../../src/lib.ts         simNew, simWorld, simStep, simNow
//   ../../src/ops/stations.ts stationsTotal(s)                 [Stations::total]
//   ../../src/time/calendar.ts simDateAddDays, dateTimeMidnight, dateTimeNext
//   ./common/ops.ts          company, runTo, specComputeUsd, specLabor, specPcBonus
//
// Changed from the Rust: Sim::new(data, 3) uses the new generator (D951). The load stations,
// bonus and bill are data-derived. After the 9 January lock the Lite AI and the births draw from
// the seeded streams; the "moved" list (three ~$42B companies) is the load's two-pass bonus
// against the 5.8 table on the loadout stations, read before any step, so it is unchanged. A
// frozen company is Bankrupt or Removed (CompanyStatus::is_frozen, inlined).
import { describe, expect, it } from "vitest";
import { simNew, simNow, simStep, simWorld } from "../../src/lib.ts";
import { stationsTotal } from "../../src/ops/stations.ts";
import { dateTimeMidnight, dateTimeNext, simDateAddDays, simDateYmd } from "../../src/time/calendar.ts";
import { roundTiesEven } from "../../src/types/num.ts";
import type { World } from "../../src/types/world.ts";
import { data, unwrap } from "./common/index.ts";
import { company, runTo, specComputeUsd, specLabor, specPcBonus } from "./common/ops.ts";

/**
 * The 7.1 two-pass bonus written from the spec, for a non-barebones company: pass 1 at
 * `R x capital_per_dollar`, pass 2 at the gross pass 1's bonus implies, each by the station rule
 * `max(1, round(0.25 x L))` productivity stations (halves to even, as gen.py's Python round).
 */
function specLoadBonus(r: number, cap: number, lv: number, pcm: number): number {
  const rule = (gross: number): number => {
    const l = specLabor(gross, lv);
    return specPcBonus(Math.max(roundTiesEven(0.25 * l), 1.0) * pcm);
  };
  const first = rule(r * cap);
  return rule((r * cap * 100.0) / (100.0 + first));
}

const sum = (v: number[]): number => v.reduce((a, b) => a + b, 0);

function storedTb(w: World, key: string): number {
  const c = w.companies[company(w, key)] as (typeof w.companies)[number];
  return sum(c.data.map((d) => d.book.held + sum(d.book.unstructured)));
}

describe("m3 stations and compute", () => {
  it("stations_and_bonus_at_load_and_after_the_first_recount", () => {
    const sim = unwrap(simNew(data(), 3), "Sim::new");
    const w = structuredClone(simWorld(sim));
    for (const c of w.companies) {
      const p = (w.industries[c.industry] as (typeof w.industries)[number]).params;
      const gross = (w.units[c.units[0] as number] as (typeof w.units)[number]).gross_assets;
      const l = specLabor(gross, p.labor_value_usd);
      const s = c.stations;
      if (c.revenue_usd < 0.1e6) {
        // Barebones (7.1, 10.0.11.1): one labor unit, the CEO on productivity, bonus +1.
        expect([l, s.productivity, stationsTotal(s)], c.key).toEqual([1, 1, 1]);
        expect(c.pc_bonus).toBe(1.0);
        continue;
      }
      // 7.1: productivity max(1, round(0.25 x L)); enterprise ceil(share x R($M) x
      // data_tb_per_musd / 10.95), share 0.5 (Arrowhead 0.1), within the labor left (D208).
      const pstations = Math.min(Math.max(roundTiesEven(0.25 * l), 1), l);
      const share = c.key === "CO-0001" ? 0.1 : 0.5;
      const e = Math.min(
        Math.ceil((share * (c.revenue_usd / 1e6) * p.data_tb_per_musd) / 10.95),
        l - pstations,
      );
      expect([s.productivity, s.enterprise, s.fifty_fifty, s.research, s.idle], c.key).toEqual([
        pstations,
        e,
        0,
        0,
        l - pstations - e,
      ]);
      expect(c.pc).toBe(pstations * p.pc_modifier);
      const want = specLoadBonus(c.revenue_usd, p.capital_per_dollar, p.labor_value_usd, p.pc_modifier);
      expect(c.pc_bonus, c.key).toBe(want);
    }

    // 1 Feb, 4.3 step 5: the live bonus is the 5.8 table on the stations' PC.
    runTo(sim, simDateYmd(2020, 2, 1));
    const w2 = simWorld(sim);
    for (const c of w2.companies) {
      const pcm = (w2.industries[c.industry] as (typeof w2.industries)[number]).params.pc_modifier;
      const s = c.stations;
      const pc = (s.productivity + 0.5 * s.fifty_fifty) * pcm;
      expect(c.pc).toBe(pc);
      expect(c.pc_bonus, c.key).toBe(specPcBonus(pc));
    }
    // Design fix 201: the load's two-pass bonus differs from the 5.8 table on its own stations
    // only for the three ~$42B companies, +5 (the second pass) against +6, so the first recount
    // would move only them on the loadout. (Since M6 the 9 January lock's 6.4 split moves most
    // companies' productivity stations before that recount, D207.)
    const moved = w.companies
      .filter((c) => c.pc_bonus !== specPcBonus(c.pc))
      .map((c) => [c.key, c.pc_bonus, specPcBonus(c.pc)]);
    expect(moved).toEqual([
      ["CO-0154", 5.0, 6.0],
      ["CO-0540", 5.0, 6.0],
      ["CO-0651", 5.0, 6.0],
    ]);
    // Arrowhead: the lock's split put 100 stations on productivity (6.4), so PC 100 and +3.
    const a = w2.companies[company(w2, "CO-0001")] as (typeof w2.companies)[number];
    expect([a.labor_units, a.pc, a.pc_bonus]).toEqual([392, 100.0, 3.0]);
  });

  it("compute_bill_and_shared_costs_follow_3_8", () => {
    const sim = unwrap(simNew(data(), 3), "Sim::new");
    for (const date of [null, simDateYmd(2020, 2, 1), simDateYmd(2020, 7, 1)]) {
      if (date !== null) {
        // The bill is set at step 5 from the TB stored before the month's data step: the state
        // one tick before the month's job.
        runTo(sim, simDateAddDays(date, -1));
        while (dateTimeNext(simNow(sim)) < dateTimeMidnight(date)) simStep(sim);
        const before = structuredClone(simWorld(sim));
        simStep(sim);
        const w = simWorld(sim);
        w.companies.forEach((c, id) => {
          // A frozen company (Bankrupt or Removed, M4) runs no monthly step (D123).
          const status = c.finance.distress.status;
          if (status === "Bankrupt" || status === "Removed") return;
          const s = c.stations;
          const stored = sum(
            (before.companies[id] as (typeof w.companies)[number]).data.map(
              (d) => d.book.held + sum(d.book.unstructured),
            ),
          );
          const want = specComputeUsd(stationsTotal(s), stored, s.enterprise + s.fifty_fifty);
          expect(c.compute.monthly_usd, `${c.key} on ${date.year}-${date.month}`).toBe(want);
          // One unit per company: it carries the whole bill (5.5).
          expect((w.units[c.units[0] as number] as (typeof w.units)[number]).shared_m).toBe(want);
        });
        continue;
      }
      // At load: the starting bill on the starting data (7.1 "Compute").
      const w = simWorld(sim);
      for (const c of w.companies) {
        const s = c.stations;
        const want = specComputeUsd(stationsTotal(s), storedTb(w, c.key), s.enterprise + s.fifty_fifty);
        expect(c.compute.monthly_usd, c.key).toBe(want);
        const u = w.units[c.units[0] as number] as (typeof w.units)[number];
        expect(u.shared_m).toBe(want);
        // D108: both hooks are filled, so fixed cash, depreciation and shared costs still sum to
        // f x revenue at productivity 100 and M 1.0 (spec 5.5, 7.1).
        const p = (w.industries[u.industry] as (typeof w.industries)[number]).params;
        const fShare = (p.fixed_cost_share * p.asset_turnover * u.gross_assets) / 12.0;
        expect(Math.abs(u.fixed_m + u.dep_m + u.shared_m - fShare) < 1e-6 * fShare, c.key).toBe(true);
      }
      // Arrowhead (3.8, M3.5 done): ceil(392 / 5) = 79 extra base, data compute 10 (8.6 TB held +
      // 3.3 TB unstructured), 1 licence: 79 x $50 + 10 x $10 + 1 x $30.
      const a = w.companies[company(w, "CO-0001")] as (typeof w.companies)[number];
      expect([a.compute.extra_base_compute, a.compute.data_compute, a.compute.licences]).toEqual([79, 10, 1]);
      expect(a.compute.monthly_usd).toBe(4_080.0);
      // The barebones company (5.5, design fix 207): 9 x $50 + 10 x $10 = $550 a month.
      const b = w.companies[company(w, "CO-0003")] as (typeof w.companies)[number];
      expect(b.compute.monthly_usd).toBe(550.0);
    }
  });
});
