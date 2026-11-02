// v_history (types/views/history.ts, 1995-rework 8.1): reads `World.era`, the only state that has a
// long history. The scenario's name stays back while the seed's pick is hidden (1995-rework 8.4).

import { companyFinanceStatus } from "../finance/state.ts";
import { EPOCH_YEAR } from "../types/calendar.ts";
import type { CompanyId } from "../types/ids.ts";
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
    industry_demand_usd: [],
    failures: [],
    top10: [],
    emergences: [],
  };
}

export function buildHistory(input: ViewInput): HistoryView {
  const era = input.world.era;
  if (era === undefined) return emptyHistory();
  return {
    world_id: era.world_id,
    start_year: era.start_year,
    scenario: era.scenario_hidden && !era.ended ? null : era.scenario.label,
    years: [...era.history.years],
    gdp_usd: [...era.history.gdp_usd],
    companies: [...era.history.companies],
    base_rate: [...era.history.base_rate],
    zone_gdp_usd: era.history.zone_gdp_usd.map((y) => [...y]),
    recessions: [...era.history.recessions],
    industry_demand_usd: era.history.industry_demand_usd.map((y) => [...y]),
    failures: [...era.history.failures],
    top10: era.history.top10.map((t) => ({ year: t.year, companies: t.companies.map((c) => ({ ...c })) })),
    emergences: era.history.emergences.map((e) => ({ ...e })),
    run: {
      ended: era.ended,
      reveal_year: era.reveal_date?.year ?? null,
      start_house_dem: era.politics.states.reduce((n, s) => n + s.start_house_dem, 0),
      presidents: era.history.presidents.map((p) => ({ ...p })),
      us_corp_tax: [...era.history.us_corp_tax],
      founders: era.history.founders.map((f) => ({ ...f })),
      successions: era.history.successions.map((s) => ({ ...s })),
      major_failures: era.history.major_failures.map((f) => ({ ...f })),
      sectors: input.world.industries.map((i) => i.sector),
      removed: input.world.companies.flatMap((c, id) =>
        companyFinanceStatus(c.finance) === "Removed" ? [id as CompanyId] : [],
      ),
    },
  };
}
