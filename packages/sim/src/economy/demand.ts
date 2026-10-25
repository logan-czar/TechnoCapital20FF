// Monthly demand, trend demand, the rate term and the phase labels (spec 5.1; 4.3 step 2).
// Ported from crates/sim/src/economy/demand.rs.
//
// Each month `demand_core ×= (1 + q_growth)^(1/3)` and `trend_demand ×= (1 + LT)^(1/12)`;
// effective demand `= demand_core × (1 − s × (base_rate − neutral_rate))`. The monthly job closes
// the month just ended, so the growth used is that month's quarter's (D100): on a quarter's first
// day, after step 1 has drawn the new quarter, it is last quarter's `prev_q_growth` and `prev_lt`.

import { type JobCtx, tickFactsIsQuarterStart } from "../time/scheduler.ts";
import type { SimDate } from "../types/calendar.ts";
import type { Industry, World } from "../types/world.ts";
import { forcedLabel } from "./ai_boom.ts";
import { growthGap, phaseLabel } from "./growth.ts";
import { MONTHS_PER_QUARTER, MONTHS_PER_YEAR } from "./index.ts";

/** One month's factor of a quarter's growth: `(1 + q_growth)^(1/3)` (spec 5.1). */
export function monthFactor(qGrowth: number): number {
  return (1.0 + qGrowth) ** (1.0 / MONTHS_PER_QUARTER);
}

/** One month's factor of a yearly rate: `(1 + LT)^(1/12)` (spec 5.1). */
export function trendMonthFactor(lt: number): number {
  return (1.0 + lt) ** (1.0 / MONTHS_PER_YEAR);
}

/** `demand = demand_core × (1 − s × (base_rate − neutral_rate))` (spec 5.1). */
export function effectiveDemand(
  demandCore: number,
  rateSensitivity: number,
  baseRate: number,
  neutralRate: number,
): number {
  return demandCore * (1.0 - rateSensitivity * (baseRate - neutralRate));
}

/**
 * The quarterly growth and long-term rate of the month the job closes (D100): this quarter's,
 * or on a quarter's first day the quarter before's.
 */
export function closingRates(ind: Industry, quarterStart: boolean): [number, number] {
  return quarterStart ? [ind.prev_q_growth, ind.prev_lt] : [ind.q_growth, ind.lt];
}

/** Sets every industry's effective demand from its core (the rate term). */
export function setEffectiveDemand(world: World): void {
  const base = world.base_rate;
  const neutral = world.neutral_rate;
  for (const ind of world.industries) {
    ind.demand = effectiveDemand(ind.demand_core, ind.params.rate_sensitivity, base, neutral);
  }
}

/** Sets every industry's phase label from this quarter's growth and last month's S (spec 5.1). */
export function setPhaseLabels(world: World, date: SimDate): void {
  for (const ind of world.industries) {
    const forced = forcedLabel(ind.params.boom_uplift, world.ai, date);
    ind.phase_label = phaseLabel(growthGap(ind.q_growth, ind.lt), ind.supply_ratio, ind.phase_label, forced);
  }
}

/**
 * 4.3 step 2: demand moves by a third of the quarter's growth, trend demand by a twelfth of the
 * year's rate; the rate term; phase labels from q_growth and last month's S.
 */
export function demandJob(world: World, ctx: JobCtx): void {
  const quarterStart = tickFactsIsQuarterStart(ctx.facts);
  for (const ind of world.industries) {
    const [q, lt] = closingRates(ind, quarterStart);
    ind.demand_core *= monthFactor(q);
    ind.trend_demand *= trendMonthFactor(lt);
  }
  setEffectiveDemand(world);
  setPhaseLabels(world, ctx.facts.date);
}
