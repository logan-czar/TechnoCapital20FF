// v_history (types/views/history.ts, 1995-rework 8.1): reads `World.era`, the only state that has a
// long history. The scenario's name stays back while the seed's pick is hidden (1995-rework 8.4).

import { EPOCH_YEAR } from "../types/calendar.ts";
import type { HistoryView } from "../types/views/history.ts";
import type { ViewInput } from "./index.ts";

/** The 2020 world's view. */
export function emptyHistory(): HistoryView {
  return {
    world_id: "2020",
    start_year: EPOCH_YEAR,
    scenario: null,
    years: [],
    gdp_usd: [],
    companies: [],
    base_rate: [],
    zone_gdp_usd: [],
    recessions: [],
  };
}

export function buildHistory(input: ViewInput): HistoryView {
  const era = input.world.era;
  if (era === undefined) return emptyHistory();
  return {
    world_id: era.world_id,
    start_year: era.start_year,
    scenario: era.scenario_hidden ? null : era.scenario.label,
    years: [...era.history.years],
    gdp_usd: [...era.history.gdp_usd],
    companies: [...era.history.companies],
    base_rate: [...era.history.base_rate],
    zone_gdp_usd: era.history.zone_gdp_usd.map((y) => [...y]),
    recessions: [...era.history.recessions],
  };
}
