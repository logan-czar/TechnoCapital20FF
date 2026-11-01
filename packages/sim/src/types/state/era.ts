// A historical world's run (1995-rework 3.3): `World.era`. Absent in the 2020 world, so its state
// hash and saves carry none of this.

import type { CyclePhase } from "../world.ts";

/** What a scenario sets beyond its growth profile (1995-rework 4.2, 6). All (T). */
export interface ScenarioMacro {
  /** The neutral rate the run's first year starts from drifts to this by the run's last (6.2). */
  neutral_end: number;
  /** a of `neutral + a × gap + b × g_t` (6.2). */
  rate_gap_k: number;
  /** b of `neutral + a × gap + b × g_t` (6.2). */
  rate_g_k: number;
  /** How far a poor zone with the top draw outgrows the rest, a year (6.4). */
  catchup: number;
  /** The standard deviation of a zone's yearly shock (6.4). */
  zone_shock_sd: number;
  /** The Poisson mean of random startup events per plan lock, in place of spec 5.19.1's. */
  startup_mean: number;
}

/** A scenario as a save carries it (1995-rework 4.2). */
export interface EraScenario {
  id: string;
  label: string;
  macro: ScenarioMacro;
}

/** A financial zone's path (1995-rework 6.4). */
export interface EraZone {
  /** Its share of world GDP now, and at the start. */
  share: number;
  start_share: number;
  /** 0 for the richest zone per head, near 1 for the poorest; fixed at load. */
  poorness: number;
  /** Its draw for the run, 0 to 1 and skewed low, so few zones take off. */
  track: number;
  /** The AR(1) part of its yearly growth. */
  shock: number;
  /** How much faster than the world it grew last year: added to its companies' plans. */
  tilt: number;
}

/**
 * The long history: one entry per closed year, oldest first, for the whole run (1995-rework 8.1).
 * The arrays run in step, except `recessions`, one entry per recession.
 */
export interface EraHistory {
  /** Whole numbers: the year closed. */
  years: number[];
  /** World GDP at the year's close, USD (1995-rework 6.1). */
  gdp_usd: number[];
  /** Whole numbers: named companies not removed at the year's close. */
  companies: number[];
  /** The policy rate at the year's close (1995-rework 6.2). */
  base_rate: number[];
  /** Per year, each zone's GDP in zone id order, USD (1995-rework 6.4). */
  zone_gdp_usd: number[][];
  /** Whole numbers: the year each recession started (1995-rework 4.2). */
  recessions: number[];
}

/** The macro layer's state (1995-rework 6). */
export interface EraMacro {
  /** This quarter's growth above trend, a year, by demand (6.1, D995), set each quarter. */
  gap: number;
  /** The cycle's phase last quarter, so a recession's start shows. */
  last_phase: CyclePhase;
  /** In zone id order. */
  zones: EraZone[];
  /** Each country's share of its zone's GDP, fixed at load, in country id order. */
  country_share: number[];
}

export interface EraState {
  /** The world's manifest id. */
  world_id: string;
  /** Whole number: the year the run started in. */
  start_year: number;
  scenario: EraScenario;
  /** The seed picked the scenario, so views keep its name back until the reveal (1995-rework 8.4). */
  scenario_hidden: boolean;
  /** `GDP = K × Σ demand`, fixed at load (1995-rework 6.1). */
  gdp_per_demand: number;
  /** The neutral rate in the first year (1995-rework 6.2). */
  neutral_start: number;
  /** The 10-year yield's term over the policy rate (1995-rework 6.2). */
  y10_term: number;
  macro: EraMacro;
  history: EraHistory;
}
