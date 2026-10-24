// Operations types a Company holds (spec 3.5 `labor_assignment`, `data`; 3.8, 5.8, 5.9). Ported
// from crates/sim/src/ops/: stations.rs (Stations), compute.rs (ComputeBill) and data.rs
// (DataBook, RETENTION_MONTHS). Types only.
//
// Not ported (logic and types no World field reaches): Stations::{total, licences},
// productive_compute, pc_bonus, station_split, SplitInputs, LoadoutInputs, Loadout and the
// starting loadout with their constants; compute.rs's pricing constants, extra_base_compute,
// data_compute and compute_bill; data.rs DataParams, DataMonth, DataBook::{at_load,
// unstructured_tb, stored_tb, free_rd_fraction, month}, the data constants and formulas
// (free_rd_step, next_free_rd_tb, decay_rate, conversion_capacity, steady_state_held); labor.rs,
// productivity.rs, jobs.rs.

// ---------------------------------------------------------------- stations.rs

/**
 * How a corporation's labor units are assigned (spec 3.5 `labor_assignment`): one station per
 * labor unit. Every count is a whole number (u64).
 */
export interface Stations {
  productivity: number;
  enterprise: number;
  /** Half productivity, half enterprise (the CEO's split at L = 1, 6.4 step 5). */
  fifty_fifty: number;
  research: number;
  idle: number;
}

// ---------------------------------------------------------------- compute.rs

/** A month's compute and licences (spec 3.8). The counts are whole numbers (u64). */
export interface ComputeBill {
  extra_base_compute: number;
  data_compute: number;
  licences: number;
  /** The month's cost, USD. */
  monthly_usd: number;
}

// ---------------------------------------------------------------- data.rs

/** Spec 5.9 step 5: unstructured data is kept this many months (the most `unstructured` holds). */
export const RETENTION_MONTHS = 12;

/** The data of one corporation in one industry (spec 3.5 `data`, 5.9). */
export interface DataBook {
  /** Unstructured TB by month, oldest first, at most RETENTION_MONTHS after each month (10.0.11.4). */
  unstructured: number[];
  /** Structured held TB (10.0.11.6). */
  held: number;
  /** Free R&D percent in force (5.9 step 1). Whole number (u32). */
  free_rd_pct: number;
  /** A drop to a lower free R&D step is waiting out its 1-month grace (5.9 step 1). */
  grace: boolean;
}
