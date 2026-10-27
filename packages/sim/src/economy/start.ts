// The economy's start state (spec 7.1 load slice, 7.2, 7.3). Ported from
// crates/sim/src/economy/start.rs.
//
// `worldFromData` (world/load.ts) builds everything load sets without a draw, calling the 7.1 and
// 7.2 formulas here (PC bonus at load, gross assets, fixed cost rate, fringe pools). `start`
// then makes the 7.3 draws at 2020-01-01 00:00: the pop date, the cycle's start, the zone shocks
// and the Q1 2020 growth draw, and sets what follows from them (zone effects and spreads,
// supply, S, M, labels and the units' starting month of revenue and expenses).
//
// The 7.1 loadout itself (PC bonus passes, gross assets, labor units, stations) is lane F's
// `startingLoadout` in ops/stations.ts, the one implementation: `startLoadout` calls it with a
// company's industry parameters. M3's monthly compute step (5.8, 4.3 step 5) recounts
// `Company.pc_bonus` from the stations from the first month on (D106, design fix 201).

import {
  ARROWHEAD_ENTERPRISE_SHARE,
  ARROWHEAD_KEY,
  LOADOUT_ENTERPRISE_SHARE,
  type Loadout,
  loadoutLoadBonus,
  startingLoadout,
} from "../ops/stations.ts";
import { dateTimeDate } from "../time/calendar.ts";
import { DATETIME_START } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import type { ComputeBill } from "../types/state/ops.ts";
import type { IndustryParams, World } from "../types/world.ts";
import { aiLabsLt, rollPopDate, setIndustryLt, stageAt } from "./ai_boom.ts";
import { decayUsd } from "./assets.ts";
import { setZoneEffects, startCycle } from "./cycle.ts";
import { setEffectiveDemand, setPhaseLabels } from "./demand.ts";
import { drawAllGrowth, ltQ } from "./growth.ts";
import { MONTHS_PER_YEAR } from "./index.ts";
import { NEVER_YEAR, profileOf } from "./profiles.ts";
import { setExpenses, setRevenue } from "./revenue.ts";
import { setSupply } from "./supply.ts";
import { setZoneSpreads } from "./zones.ts";

export {
  ARROWHEAD_ENTERPRISE_SHARE,
  ARROWHEAD_KEY,
  BAREBONES_ASSETS_USD,
  BAREBONES_REVENUE_USD,
  LOADOUT_ENTERPRISE_SHARE,
  START_PRODUCTIVITY,
} from "../ops/stations.ts";

/**
 * A starting loadout with the bonus load holds (Rust `Loadout::load_bonus()`, a method): the
 * `Loadout` of ops/stations.ts plus that one derived figure, so `buildWorld`'s `LoadDeps` reads
 * `load_bonus` as a field.
 */
export type StartLoadout = Loadout & { load_bonus: number };

/**
 * The 7.1 starting loadout of the company with companies.csv id `key` and yearly revenue
 * `revenue` (spec 7.1, C16), from lane F's `startingLoadout`: the PC bonus by the station rule
 * iterated twice, gross assets `R × capital_per_dollar × 100 ÷ (100 + PC bonus + location
 * bonus)` (company-start.csv holds them rounded to dollars; load reads the CSV), labor units,
 * productivity and enterprise stations (share 0.5, Arrowhead 0.1) and idle; under $0.1M the
 * barebones loadout. The bonus load sets is `load_bonus` (D106).
 */
export function startLoadout(
  key: string,
  revenue: number,
  locationBonus: number,
  p: IndustryParams,
): StartLoadout {
  const l = startingLoadout({
    revenue_usd: revenue,
    capital_per_dollar: p.capital_per_dollar,
    labor_value_usd: p.labor_value_usd,
    pc_modifier: p.pc_modifier,
    data_tb_per_musd: p.data_tb_per_musd,
    location_bonus: locationBonus,
    enterprise_share: enterpriseShare(key),
  });
  return { ...l, load_bonus: loadoutLoadBonus(l) };
}

/** The enterprise and structured-data share of 7.1: 0.5, Arrowhead (CO-0001) 0.1. */
export function enterpriseShare(key: string): number {
  return key === ARROWHEAD_KEY ? ARROWHEAD_ENTERPRISE_SHARE : LOADOUT_ENTERPRISE_SHARE;
}

/**
 * `fixed_cost_rate = f × turnover − d_eff − shared costs ÷ gross` (spec 5.5, 7.1), with d_eff at
 * the load gross assets and `sharedCostUsd` a year.
 */
export function fixedCostRateAtLoad(grossAssets: number, sharedCostUsd: number, p: IndustryParams): number {
  if (grossAssets <= 0.0) return p.fixed_cost_share * p.asset_turnover;
  return (
    p.fixed_cost_share * p.asset_turnover -
    decayUsd(grossAssets, p) / grossAssets -
    sharedCostUsd / grossAssets
  );
}

/**
 * A company's yearly shared costs at load (spec 3.8, 5.5, 7.1 "Compute"): twelve months of its
 * starting compute and licence bill. Filled together with `sharedCostsMonthHook` (D108), so
 * fixed cash plus depreciation plus shared costs stay `f × revenue` at productivity 100 and
 * M 1.0. One unit per company in the MVP, so the unit carries the whole bill.
 */
export function sharedCostsAtLoadHook(bill: ComputeBill): number {
  return MONTHS_PER_YEAR * bill.monthly_usd;
}

/**
 * The 7.3 start at 2020-01-01 00:00: the pop date (gen stream), the cycle in Expansion and the
 * zone shocks (cycle stream), every industry's lt and Q1 2020 growth draw (growth stream, with
 * prev_q_growth = lt_q), then the zone spreads, supply, S, M, labels and the units' starting
 * month. Call once on a world fresh from `worldFromData`.
 */
export function start(world: World, draws: DrawSource): void {
  const today = dateTimeDate(DATETIME_START);
  // The AI boom (5.1.1): the pop date rolled at load; Preboom.
  world.ai.pop_date = rollPopDate(draws);
  const profile = profileOf(world);
  if (!profile.ai_boom) {
    // No AI boom in this profile (D970): the rolled draws stay spent, the dates move past the run.
    world.ai.boom_date = { year: NEVER_YEAR, month: 1, day: 1 };
    world.ai.pop_date = { year: NEVER_YEAR, month: 1, day: 1 };
  }
  const [stage, qIn] = stageAt(today, world.ai.boom_date, world.ai.pop_date);
  world.ai.stage = stage;
  world.ai.ai_labs_lt = aiLabsLt(world.ai.schedule, stage, qIn);
  setIndustryLt(world, today);
  for (const ind of world.industries) {
    ind.prev_lt = ind.lt;
    // At load prev_q_growth = lt_q (spec 5.1): the draw below shifts this in.
    ind.q_growth = ltQ(ind.lt);
    ind.prev_q_growth = ind.q_growth;
    ind.carry_reset = false;
  }
  // The cycle starts in Expansion with g_t and quarters left drawn (7.3).
  let maxLag = 0;
  for (const z of world.zones) maxLag = Math.max(maxLag, z.lag_quarters);
  world.cycle = startCycle(maxLag, world.cycle.z_avg, draws, profile);
  setZoneEffects(world, draws);
  setZoneSpreads(world);
  // The Q1 2020 growth draw (5.1, 7.3).
  drawAllGrowth(world, draws);
  // Demand starts at the 2020 world size; supply, S and M at load (7.2), then labels.
  setEffectiveDemand(world);
  setSupply(world);
  setPhaseLabels(world, today);
  setRevenue(world);
  setExpenses(world);
}
