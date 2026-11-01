// A historical world's run (1995-rework 3.3, 6.1, 8.1): its scenario at the start and one history
// entry per year. Every job does nothing in the 2020 world, which has no `era`.

import { DEFAULT_SCENARIO_ID, RANDOM_SCENARIO_ID, SCENARIOS, scenarioById } from "../economy/scenarios.ts";
import { companyFinanceStatus } from "../finance/state.ts";
import { dateTimeDate } from "../time/calendar.ts";
import type { JobCtx } from "../time/scheduler.ts";
import type { DrawSource } from "../types/draws.ts";
import type { World } from "../types/world.ts";

/** Σ demand, USD a year (1995-rework 6.1). */
function worldDemand(world: World): number {
  let sum = 0.0;
  for (const ind of world.industries) sum += ind.demand;
  return sum;
}

/**
 * Starts the run on a world fresh from the data, before the economy's draws: the scenario sets the
 * growth profile. `random` draws it on the Era stream and keeps its name back (1995-rework 4.1).
 */
export function eraStart(
  world: World,
  worldId: string,
  scenarioId: string = DEFAULT_SCENARIO_ID,
  draws: DrawSource,
): void {
  const hidden = scenarioId === RANDOM_SCENARIO_ID;
  const scenario = hidden
    ? SCENARIOS[draws.intInclusive("Era", 0, SCENARIOS.length - 1)]
    : scenarioById(scenarioId);
  if (scenario === undefined) throw new Error(`${scenarioId} is not a scenario`);
  world.profile = scenario.profile;
  let gdp = 0.0;
  for (const c of world.countries) gdp += c.gdp_usd;
  world.era = {
    world_id: worldId,
    start_year: dateTimeDate(world.clock).year,
    scenario: { id: scenario.id, label: scenario.label },
    scenario_hidden: hidden,
    gdp_per_demand: gdp / worldDemand(world),
    history: { years: [], gdp_usd: [], companies: [] },
  };
}

/** 1 January: the year just closed joins the long history (1995-rework 8.1). */
export function eraYearCloseJob(world: World, ctx: JobCtx): void {
  const era = world.era;
  if (era === undefined) return;
  const h = era.history;
  h.years.push(ctx.facts.date.year - 1);
  h.gdp_usd.push(era.gdp_per_demand * worldDemand(world));
  let companies = 0;
  for (const c of world.companies) {
    if (companyFinanceStatus(c.finance) !== "Removed") companies += 1;
  }
  h.companies.push(companies);
}
