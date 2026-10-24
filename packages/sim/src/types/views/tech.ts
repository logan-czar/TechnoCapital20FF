// v_tech (crates/sim/src/views/tech.rs): `get_company_tech` (spec 9.2), the Company screen's
// Tech tab (spec 8): labor split, stations, PC and the next bonus step, compute, and per industry
// the data quests card (progress to the next free R&D step, inflow against conversion and decay;
// 10.0.11.7). Rebuilt monthly and on load (spec 9.4), and when Omniscient is toggled (D423). A
// private company's or new listing's data figures are bands: held, unstructured and decayed TB
// would together give its monthly revenue away through the 5.9 steps (D431), and its inflow is
// worked out from its revenue band. The stations, conversion capacity, free R&D step and the
// compute bill follow the published station counts and stay exact (D434).
//
// Not ported: TechView::get, TechRow::stored_tb (D430) and the `ViewData` build (logic).

import type { CompanyId, IndustryId } from "../ids.ts";
import type { Figure } from "./estimate.ts";
import type { ComputeBill, Stations } from "./shared.ts";

/** One company's data in one industry (spec 3.5 `data`, 5.9). */
export interface TechData {
  industry: IndustryId;
  /** Unstructured TB not yet converted, and how many monthly buckets hold it (at most 12). */
  unstructured_tb: Figure;
  buckets: number;
  /** Structured held TB. */
  held_tb: Figure;
  /** Free R&D percent in force, and whether a drop is waiting out its 1-month grace. */
  free_rd_pct: number;
  grace: boolean;
  /** Held TB at which the next free R&D step starts (the progress bar's end). */
  next_step_tb: number;
  /**
   * Unstructured TB a month from last month's revenue (5.9 step 2); from the estimated
   * revenue when the company's figures are bands (D420).
   */
  inflow_tb: Figure;
  /** TB a month the stations convert at most (5.9 step 3; the main industry's book). */
  conversion_tb: number;
  /** TB a month held data loses at its current level (5.9 step 4). */
  decay_tb: Figure;
}

/** One company's Tech tab. */
export interface TechRow {
  company: CompanyId;
  /** Whole number (u64). */
  labor_units: number;
  /** The labor split: productivity, enterprise, 50/50, research, idle (spec 3.5). */
  stations: Stations;
  /** Productive compute and its bonus (spec 5.8), and the PC at which the next step starts. */
  pc: number;
  pc_bonus: number;
  next_bonus_pc: number;
  /** Extra base compute, data compute, licences and the month's bill (spec 3.8). */
  compute: ComputeBill;
  data: TechData[];
}

export interface TechView {
  /** Every company in company id order. */
  companies: TechRow[];
}
