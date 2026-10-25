// The Lite AI station split (spec 6.4), with the archetype's data coverage (6.1) and the named
// controller's Visionary trait. The split itself is `stationSplit` (ops/stations.ts, F3). Ported
// from crates/sim/src/ai/split.rs.

import { stationSplit } from "../ops/stations.ts";
import { maxF } from "../types/num.ts";
import type { Stations } from "../types/state/ops.ts";
import type { Trait } from "../types/state/people.ts";
import { USD_PER_MILLION } from "../types/world.ts";
import type { ArchetypeRow } from "./archetype.ts";
import { has } from "./inputs.ts";

/** Months a year: the 6.4 inflow is monthly (5.9 step 2). */
export const MONTHS_PER_YEAR = 12.0;

/**
 * Monthly unstructured inflow, TB (spec 5.9 step 2): `revenue ($M) × data_tb_per_musd`, a month of
 * trailing annual revenue.
 */
export function monthlyInflowTb(annual_revenue_usd: number, data_tb_per_musd: number): number {
  return (maxF(annual_revenue_usd, 0.0) / USD_PER_MILLION / MONTHS_PER_YEAR) * data_tb_per_musd;
}

/**
 * The 6.4 split for a company with `labor` units: coverage from the archetype (6.1), research
 * only for a Visionary controller (none for a born company, 5.19.5).
 */
export function planStations(
  labor: number,
  archetype: ArchetypeRow,
  inflow_tb: number,
  traits: readonly Trait[],
): Stations {
  return stationSplit({
    labor,
    coverage: archetype.data_coverage,
    inflow_tb,
    visionary: has(traits, "Visionary"),
  });
}
