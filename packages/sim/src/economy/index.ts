// The economy core (build-plan M2): the global business cycle, financial zones and their credit
// spreads, the quarterly industry growth draw and phase labels, the AI boom and pop, demand and
// the rate term, fringe pools, supply, S and M, unit revenue and expenses, asset decay and the
// growth plan's buys and sells. Ported from crates/sim/src/economy/mod.rs.
//
// Spec sections: 5.1, 5.1.1, 5.1.2 (credit spread), 5.2, 5.3, 5.4, 5.5, 5.10, 7.1 (the load
// slice), 7.2, 7.3; scheduled in 4.3 steps 1 (quarterly draw), 2 (demand), 3 (fringe), 6
// (supply), 7 (revenue), 9 (expenses) and 11 (assets).
//
// Each formula is a plain function of its inputs (no world, no RNG) so the 5.16 projections and
// the tests can call it directly; the jobs (`*Job`) only read the world, call the formulas in
// table order and write the results back. Every random number comes through the job's
// DrawSource: the cycle stream for the phase draws and zone shocks, the growth stream for the
// quarterly growth shocks and the gen stream for the pop date.

import { type Scheduler, schedulerRegister } from "../time/scheduler.ts";
import type { Company } from "../types/world.ts";
import { aiEventsJob, industryLtJob } from "./ai_boom.ts";
import { assetsJob } from "./assets.ts";
import { cycleJob } from "./cycle.ts";
import { demandJob } from "./demand.ts";
import { growthDrawsJob } from "./growth.ts";
import { expensesJob, revenueJob } from "./revenue.ts";
import { fringeJob, supplyJob } from "./supply.ts";
import { zoneSpreadsJob } from "./zones.ts";

export * as ai_boom from "./ai_boom.ts";
export * as assets from "./assets.ts";
export * as cycle from "./cycle.ts";
export * as demand from "./demand.ts";
export * as growth from "./growth.ts";
export * as revenue from "./revenue.ts";
export { start } from "./start.ts";
export * as supply from "./supply.ts";
export * as zones from "./zones.ts";

/** Months in a year: yearly figures are booked monthly as ÷ 12 (spec 5). */
export const MONTHS_PER_YEAR = 12.0;
/** Quarters in a year (spec 5.1 `lt_q`, `÷ 4`). */
export const QUARTERS_PER_YEAR = 4.0;
/** Months in a quarter: demand moves by a third of the quarter's growth each month (spec 5.1). */
export const MONTHS_PER_QUARTER = 3.0;
/** Productivity points are out of 100 (spec 5.2, 5.4). */
export const PRODUCTIVITY_SCALE = 100.0;

/**
 * Frozen or gone: the monthly jobs skip the company (spec 5.12 step 2; D231). Rust
 * `CompanyStatus::is_frozen`.
 * CONTRACT: finance/distress.ts (lane W3) owns this; swap to its `companyStatusIsFrozen` once
 * it is on main.
 */
export function companyIsFrozen(company: Company): boolean {
  const s = company.finance.distress.status;
  return s === "Bankrupt" || s === "Removed";
}

/**
 * Spec 5.12 step 1: a Distressed company buys nothing. Rust `CompanyStatus::may_buy_assets`.
 * CONTRACT: as `companyIsFrozen`.
 */
export function companyMayBuyAssets(company: Company): boolean {
  return company.finance.distress.status === "Active";
}

/** Registers the economy's jobs in their 4.3 slots. Called from jobs.ts's `registerJobs`. */
export function register(s: Scheduler): void {
  const r = schedulerRegister;
  // 4.3 step 1, on 1 Jan, Apr, Jul and Oct only, in its order.
  r(s, "MonthlyAiEvents", "economy.ai_events", aiEventsJob);
  r(s, "MonthlyIndustryLt", "economy.industry_lt", industryLtJob);
  r(s, "MonthlyCycle", "economy.cycle", cycleJob);
  r(s, "MonthlyZoneSpreads", "economy.zone_spreads", zoneSpreadsJob);
  r(s, "MonthlyGrowthDraws", "economy.growth_draws", growthDrawsJob);
  // 4.3 steps 2, 3, 6, 7, 9 and 11.
  r(s, "MonthlyDemand", "economy.demand", demandJob);
  r(s, "MonthlyFringe", "economy.fringe", fringeJob);
  r(s, "MonthlySupply", "economy.supply", supplyJob);
  r(s, "MonthlyRevenue", "economy.revenue", revenueJob);
  r(s, "MonthlyExpenses", "economy.expenses", expensesJob);
  r(s, "MonthlyAssets", "economy.assets", assetsJob);
}
