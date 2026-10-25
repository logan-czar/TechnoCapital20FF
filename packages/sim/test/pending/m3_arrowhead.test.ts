// Port of crates/sim/tests/m3_arrowhead.rs: M3.8 against the live engine: the spec 7.1 Arrowhead
// check, and the load profit picture of spec 2.2 and 5.5 (build-plan "Profit picture").
//
// Spec M3 done: 392 labor units, PC bonus +2, about 8.6 TB held, EBIT after R&D about $1.6M.
// Every line comes from the engine's load month (D110), the R&D line too: since M6.2 the units
// book the 6.3 plan at load (D283: 6.1 archetype mult x 6.3 trait mults at productivity 100 and
// loss_q 0, less free R&D), so both checks read the engine's booked `u.rd_m`. Terry is Greedy:
// a Cash cow, R&D target 0.05 x 0.7 x 0.8 = 2.8%, less the engine's 1% free R&D = 1.8%, $0.72M.
// The expected values stay the spec's: $1.6M and 4.1% for Arrowhead, 619 of 651 profitable at a
// 6.1% median (D119).
//
// Expects:
//   ../../src/lib.ts         simNew, simWorld
//   ../../src/ops/data.ts    dataBookFreeRdFraction(book)        [DataBook::free_rd_fraction]
//   ./common/ops.ts          company, runTo;  ./common/m3.ts  unitEbitM
//   World.industries[].sector (string), World.companies[].data[] (CompanyData { industry, book })
//
// Changed from the Rust: Sim::new(data, 1) uses the new generator (D951). The asserted load state
// is data-derived (the 7.3 start draws only roll the AI pop date), so no assertion changes. The
// first monthly close runs the 9 January lock, whose births draw from the seeded streams; the
// asserted Arrowhead stations and bonus do not depend on those draws. The println summaries are
// dropped.
import { describe, expect, it } from "vitest";
import { simNew, simWorld } from "../../src/lib.ts";
import { dataBookFreeRdFraction } from "../../src/ops/data.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import { totalCmp } from "../../src/types/num.ts";
import type { BusinessUnit, World } from "../../src/types/world.ts";
import { data, unwrap } from "./common/index.ts";
import { unitEbitM } from "./common/m3.ts";
import { company, runTo } from "./common/ops.ts";

/**
 * A unit's yearly EBIT before R&D at its month's run rate: revenue less variable, fixed cash,
 * depreciation and shared costs (spec 5.5).
 */
function ebitBeforeRd(u: BusinessUnit): number {
  return 12.0 * (u.revenue_m - u.variable_m - u.fixed_m - u.dep_m - u.shared_m);
}

const near = (a: number, b: number, tol: number, what = ""): void => {
  expect(Math.abs(a - b) < tol, `${what} ${a} vs ${b}`).toBe(true);
};

describe("m3 arrowhead", () => {
  it("arrowhead_check_on_the_live_engine", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    let w = simWorld(sim);
    let a = w.companies[company(w, "CO-0001")] as (typeof w.companies)[number];
    const u = w.units[a.units[0] as number] as BusinessUnit;
    const book = (a.data[0] as (typeof a.data)[number]).book;
    expect(a.labor_units).toBe(392);
    expect(a.pc_bonus).toBe(2.0);
    near(book.held, 8.6, 0.05, "held");
    expect(book.free_rd_pct).toBe(1);
    near(u.gross_assets, 39.2e6, 0.05e6);

    const revenue = 12.0 * u.revenue_m;
    near(revenue, 40.0e6, 0.01e6, "revenue");
    const before = ebitBeforeRd(u);
    // 7.1: about $2.35M (5% plus 0.45 x 2 / 102 from the PC bonus).
    near(before, 2.35e6, 0.01e6, "EBIT before R&D");
    // The engine's booked R&D: the 6.3 plan the unit runs from load (D283).
    const paid = 12.0 * u.rd_m;
    const after = 12.0 * unitEbitM(u);
    // The plan written from the spec: 6.1 Cash cow 0.7, 6.3 Greedy 0.8, less the 1% free R&D.
    const rdNorm = (w.industries[u.industry] as (typeof w.industries)[number]).params.rd_norm;
    const specPlan = rdNorm * 0.7 * 0.8 - dataBookFreeRdFraction(book);
    near(u.rd_plan, specPlan, 1e-12, "rd_plan");
    near(paid, 0.72e6, 0.005e6, "paid R&D");
    near(after, 1.6e6, 0.05e6, "EBIT after R&D");
    near(after / revenue, 0.041, 0.001);

    // The first monthly close keeps 392 labor units and 1% free R&D. The 9 January lock's 6.4
    // split put 100 stations on productivity (the largest power of ten at most 40% of 392, up
    // from the loadout's 98), so the first recount (5.8) counts PC 100: +3.
    runTo(sim, simDateYmd(2020, 2, 1));
    w = simWorld(sim);
    a = w.companies[company(w, "CO-0001")] as (typeof w.companies)[number];
    expect([a.labor_units, a.stations.productivity]).toEqual([392, 100]);
    expect(a.pc_bonus).toBe(3.0);
    expect((a.data[0] as (typeof a.data)[number]).book.free_rd_pct).toBe(1);
  });
});

/**
 * Spec 6.1 archetype R&D mult (first match) times the 6.3 trait mults of the named controller,
 * at productivity 100 (no productivity adj) and loss_q 0.
 */
function specRdMult(controlBasis: string, revenueMusd: number, sector: string, traits: string[]): number {
  const has = (t: string): boolean => traits.includes(t);
  let mult: number;
  if (controlBasis === "state") mult = 1.0;
  else if (revenueMusd < 50.0 && sector === "Tech") mult = 1.2;
  else if (has("Ambitious") || has("Brave")) mult = 1.3;
  else if (has("Greedy") || has("Cautious")) mult = 0.7;
  else mult = 1.0;
  for (const [t, k] of [
    ["Greedy", 0.8],
    ["Visionary", 1.25],
    ["Conservative", 0.9],
    ["Diligent", 1.1],
  ] as [string, number][]) {
    if (has(t)) mult *= k;
  }
  return mult;
}

function median(v: number[]): number {
  const s = v.slice().sort(totalCmp);
  const n = s.length;
  const at = (i: number): number => s[i] as number;
  return n % 2 === 1 ? at(Math.floor(n / 2)) : 0.5 * (at(n / 2 - 1) + at(n / 2));
}

/** Margins after R&D at load, from the engine's lines, with `paid(unit)` R&D a year. */
function margins(w: World, paid: (u: BusinessUnit) => number): number[] {
  return w.units.map((u) => (ebitBeforeRd(u) - paid(u)) / (12.0 * u.revenue_m));
}

describe("m3 profit picture", () => {
  it("profit_picture_at_load", () => {
    const d = data();
    const sim = unwrap(simNew(structuredClone(d), 1), "Sim::new");
    const w = simWorld(sim);
    expect(w.units.length).toBe(651);

    // The booked plan is the spec's (6.1 first match, 6.3 trait mults, less free R&D), written
    // here from companies.csv and characters.csv.
    for (const u of w.units) {
      const c = w.companies[u.company] as (typeof w.companies)[number];
      const row = d.companies.rows.find((r) => r.id === c.key);
      if (row === undefined) throw new Error(`no row ${c.key}`);
      const ind = w.industries[u.industry] as (typeof w.industries)[number];
      const ch = d.characters.rows.find((x) => x.id === row.controller);
      const traits = ch === undefined ? [] : ch.traits;
      const mult = specRdMult(row.control_basis, row.revenue_usd_m, ind.sector, traits);
      const dataIn = c.data.find((x) => x.industry === u.industry);
      if (dataIn === undefined) throw new Error(`no data for ${c.key}`);
      const free = dataBookFreeRdFraction(dataIn.book);
      const rdNorm = ind.params.rd_norm;
      const plan = Math.min(Math.max(rdNorm * mult - free, 0.0), 3.0 * rdNorm);
      near(u.rd_plan, plan, 1e-12, c.key);
      near(u.rd_m, u.revenue_m * plan, 1e-6 * Math.max(u.revenue_m, 1.0));
    }

    // The engine's booked R&D at load: spec 2.2 and 5.5 expect 619 of 651 profitable after R&D,
    // median margin 6.1%.
    const engine = margins(w, (u) => 12.0 * u.rd_m);
    const pos = engine.filter((m) => m > 1e-9).length;
    const med = median(engine);
    expect(pos).toBe(619);
    expect((100.0 * med).toFixed(1)).toBe("6.1");
  });
});
