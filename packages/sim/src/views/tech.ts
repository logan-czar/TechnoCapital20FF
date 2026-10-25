// v_tech: `get_company_tech` (spec 9.2), the Company screen's Tech tab (spec 8): labor split,
// stations, PC and the next bonus step, compute, and per industry the data quests card (progress
// to the next free R&D step, inflow against conversion and decay; 10.0.11.7). Rebuilt monthly and
// on load (spec 9.4), and when Omniscient is toggled (D423). A private company's or new listing's
// data figures are bands: held, unstructured and decayed TB would together give its monthly
// revenue away through the 5.9 steps (D431), and its inflow is worked out from its revenue band.
// The stations, conversion capacity, free R&D step and the compute bill follow the published
// station counts and stay exact (D434). Ported from crates/sim/src/views/tech.rs; the types are in
// types/views/tech.ts.

import { conversionCapacity, dataBookUnstructuredTb, decayRate, nextFreeRdTb } from "../ops/data.ts";
import { nextBonusPc } from "../ops/stations.ts";
import type { CompanyId } from "../types/ids.ts";
import { toU32Sat } from "../types/num.ts";
import { ESTIMATE_FLOOR_TB, type Figure, type Kind } from "../types/views/estimate.ts";
import type { TechData, TechRow, TechView } from "../types/views/tech.ts";
import { USD_PER_MILLION } from "../types/world.ts";
import { estimatorCurrent, figureMap, figureSum, viewInputEstimator } from "./estimate.ts";
import type { ViewInput } from "./index.ts";
import { estimatedIndustries, unitBanded } from "./industry_rows.ts";
import { unitRevenue } from "./units.ts";

/** `get_company_tech(id)`. */
export function techViewGet(v: TechView, id: CompanyId): TechRow | undefined {
  return v.companies[id];
}

/**
 * TB stored (held plus unstructured) over all industries, as 3.8's data compute counts it; a band
 * when the parts are (D430).
 */
export function techRowStoredTb(row: TechRow): Figure {
  return figureSum(row.data.flatMap((d) => [d.held_tb, d.unstructured_tb]));
}

/** Rust `ViewData::build`. */
export function buildTech(input: ViewInput): TechView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const classes = estimatedIndustries(est, w);
  const companies = w.companies.map((c, i): TechRow => {
    const id = i as CompanyId;
    // Bands for a company that does not publish, and for a published one in an estimated
    // industry: its data book would give its monthly revenue, so M (D436).
    const banded = unitBanded(est, w, classes, id, c.industry);
    const capacity = conversionCapacity(c.stations);
    const data = c.data.map((d): TechData => {
      const p = w.industries[d.industry]!.params;
      // The inflow is the revenue band times the TB rate (D430).
      const revenue = figureSum(
        c.units
          .map((u) => w.units[u]!)
          .filter((u) => u.industry === d.industry)
          .map((u) => unitRevenue(est, banded, u)),
      );
      const b = d.book;
      const tb = (kind: Kind, truth: number) =>
        estimatorCurrent(est, banded, { kind: "Company", company: id }, kind, truth, ESTIMATE_FLOOR_TB);
      return {
        industry: d.industry,
        unstructured_tb: tb({ kind: "UnstructuredTb" }, dataBookUnstructuredTb(b)),
        buckets: b.unstructured.length,
        held_tb: tb({ kind: "HeldTb" }, b.held),
        free_rd_pct: b.free_rd_pct,
        grace: b.grace,
        next_step_tb: nextFreeRdTb(b.free_rd_pct),
        // Unstructured TB a month from last month's revenue (5.9 step 2).
        inflow_tb: figureMap(revenue, (r) => (r / USD_PER_MILLION) * p.data_tb_per_musd),
        conversion_tb: d.industry === c.industry ? capacity : 0.0,
        // TB a month held data loses at its current level (5.9 step 4).
        decay_tb: tb({ kind: "DecayTb" }, b.held * decayRate(b.held, p.data_decay_base)),
      };
    });
    return {
      company: id,
      labor_units: c.labor_units,
      stations: { ...c.stations },
      pc: c.pc,
      pc_bonus: c.pc_bonus,
      next_bonus_pc: nextBonusPc(toU32Sat(c.pc_bonus)),
      compute: { ...c.compute },
      data,
    };
  });
  return { companies };
}
