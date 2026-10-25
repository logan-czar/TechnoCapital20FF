// Port of crates/sim/tests/common/ops.rs: helpers for the M3 tests against the live engine: run a
// Sim to a date, find rows by their CSV id, and read spec values written out as literals.
//
// Expects:
//   ../../../src/lib.ts           type Sim, simStep(sim) [Sim::step], simNow(sim) [Sim::now]
//   ../../../src/time/calendar.ts dateTimeMidnight
//   "@tc20ff/sim-data"            row types Company, Industry (Rust names)
import type { Company, Industry, WorldData } from "@tc20ff/sim-data";
import { type Sim, simNow, simStep } from "../../../src/lib.ts";
import { dateTimeMidnight } from "../../../src/time/calendar.ts";
import type { SimDate } from "../../../src/types/calendar.ts";
import type { CompanyId } from "../../../src/types/ids.ts";
import type { World } from "../../../src/types/world.ts";

/** Steps until the clock reaches 00:00 on date (that tick jobs included). */
export function runTo(sim: Sim, date: SimDate): void {
  const end = dateTimeMidnight(date);
  while (simNow(sim) < end) {
    simStep(sim);
  }
}

/** The company with this companies.csv id. */
export function company(w: World, key: string): CompanyId {
  const i = w.companies.findIndex((c) => c.key === key);
  if (i < 0) throw new Error(`no company ${key}`);
  return i as CompanyId;
}

/** The companies.csv row with this id. */
export function companyRow(d: WorldData, key: string): Company {
  const r = d.companies.rows.find((c) => c.id === key);
  if (r === undefined) throw new Error(`no companies.csv row ${key}`);
  return r;
}

/** The industries.csv row named name (companies.csv names industries by name). */
export function industryRow(d: WorldData, name: string): Industry {
  const r = d.industries.rows.find((i) => i.name === name);
  if (r === undefined) throw new Error(`no industries.csv row ${name}`);
  return r;
}

/** Labor units by spec 5.10, written out: floor(gross / labor_value), minimum 1. */
export function specLabor(gross: number, laborValue: number): number {
  return Math.max(Math.floor(gross / laborValue), 1);
}

/**
 * The 5.8 bonus table, written out from the spec: under 1 gives 0; 1 to 9.99 gives 1; 10 to
 * 99.99 gives 2; 100 to 999.99 gives 3; 1,000 to 9,999.99 gives 4; 10,000+ gives 5, +1 per
 * further 10x.
 */
export function specPcBonus(pc: number): number {
  const table: [number, number][] = [
    [1.0, 1],
    [10.0, 2],
    [100.0, 3],
    [1_000.0, 4],
    [10_000.0, 5],
  ];
  let bonus = 0;
  for (const [from, b] of table) {
    if (pc >= from) bonus = b;
  }
  let step = 100_000.0;
  while (pc >= step) {
    bonus += 1;
    step *= 10.0;
  }
  return bonus;
}

/**
 * The 3.8 monthly bill, written out: $50 per extra base compute max(9, ceil(0.2 x stations)),
 * $10 per data compute max(10, ceil(1.2 x TB stored / 100)), $30 per enterprise licence.
 */
export function specComputeUsd(stations: number, tbStored: number, licences: number): number {
  const extra = Math.max(Math.ceil(stations / 5), 9);
  const dataCompute = Math.max(Math.ceil((1.2 * tbStored) / 100.0), 10);
  return 50.0 * extra + 10.0 * dataCompute + 30.0 * licences;
}
