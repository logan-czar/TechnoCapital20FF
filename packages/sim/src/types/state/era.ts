// A historical world's run (1995-rework 3.3): `World.era`. Absent in the 2020 world, so its state
// hash and saves carry none of this.

/** A scenario's name, copied into the state so a save carries it (1995-rework 4.2). */
export interface EraScenario {
  id: string;
  label: string;
}

/**
 * The long history: one entry per closed year, oldest first, for the whole run (1995-rework 8.1).
 * The arrays run in step.
 */
export interface EraHistory {
  /** Whole numbers: the year closed. */
  years: number[];
  /** World GDP at the year's close, USD (1995-rework 6.1). */
  gdp_usd: number[];
  /** Whole numbers: named companies not removed at the year's close. */
  companies: number[];
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
  history: EraHistory;
}
