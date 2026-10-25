// Unit revenue and expenses (spec 5.4, 5.5; 4.3 steps 7 and 9). Ported from
// crates/sim/src/economy/revenue.rs.
//
// `effective productivity = p_pre × M`; `revenue (month) = assets_eff × turnover × effective
// productivity ÷ 100 ÷ 12`. A unit's share of the industry's revenue is its share of supply.
//
// Expenses per unit per month (5.5): variable `revenue × v` with `v = 1 − margin_full_use − f`
// (D fixed at 1.0); fixed cash `gross_assets × fixed_cost_rate ÷ 12`; depreciation
// `min(asset_book, decay_usd ÷ 12)`; R&D `revenue × rd_plan`; shared costs from the 3.8 compute
// bill (M3), split by revenue share. Fixed cash plus depreciation plus shared costs equal
// `f × revenue` at productivity 100 and M 1.0 (the fixed cost rate is set so at load, 7.1), so
// with R&D at the norm (`margin_full_use = rd_norm`, C18) a company at productivity 100 and
// M 1.0 breaks even.

import type { JobCtx } from "../time/scheduler.ts";
import { maxF, minF } from "../types/num.ts";
import type { BusinessUnit, IndustryParams, World } from "../types/world.ts";
import { businessUnitAssetsEff } from "../world/entities.ts";
import { decayUsd } from "./assets.ts";
import { companyIsFrozen, MONTHS_PER_YEAR, PRODUCTIVITY_SCALE } from "./index.ts";
import { fringeRevenueMonth, pPre } from "./supply.ts";

/** A unit's month of revenue (spec 5.4). */
export function unitRevenueMonth(assetsEff: number, turnover: number, pPreValue: number, m: number): number {
  return (assetsEff * turnover * (pPreValue * m)) / PRODUCTIVITY_SCALE / MONTHS_PER_YEAR;
}

/** `v = 1 − margin_full_use − f` (spec 5.5). */
export function variableCostShare(p: IndustryParams): number {
  return 1.0 - p.margin_full_use - p.fixed_cost_share;
}

/** One unit's month of 5.5 expenses. */
export interface MonthExpenses {
  variable: number;
  fixed: number;
  depreciation: number;
  rd: number;
  shared: number;
}

/** Rust `MonthExpenses::total`. */
export function monthExpensesTotal(e: MonthExpenses): number {
  return e.variable + e.fixed + e.depreciation + e.rd + e.shared;
}

/**
 * The 5.5 lines for a month of `revenue` from a unit with `grossAssets` at cost and
 * `assetBook`, a `fixedCostRate` a year per $1 of gross, `rdPlan` of revenue, the industry's
 * parameters and the month's shared costs.
 */
export function monthExpenses(
  revenue: number,
  grossAssets: number,
  assetBook: number,
  fixedCostRate: number,
  rdPlan: number,
  params: IndustryParams,
  shared: number,
): MonthExpenses {
  return {
    variable: revenue * variableCostShare(params),
    fixed: (grossAssets * fixedCostRate) / MONTHS_PER_YEAR,
    depreciation: minF(assetBook, decayUsd(grossAssets, params) / MONTHS_PER_YEAR),
    rd: revenue * rdPlan,
    shared,
  };
}

/**
 * The month's shared costs of a unit (spec 5.5): its corporation's compute, data compute and
 * licences (3.8, the bill set at 4.3 step 5) split across the corporation's units by revenue
 * share (10.0.8), equally if none has revenue. Filled together with
 * `sharedCostsAtLoadHook` (D108): at load the fixed cost rate leaves room for the starting bill,
 * so at productivity 100 and M 1.0 fixed cash, depreciation and shared costs still sum to
 * `f × revenue`.
 */
export function sharedCostsMonthHook(world: World, unit: BusinessUnit): number {
  const company = world.companies[unit.company]!;
  const bill = company.compute.monthly_usd;
  let total = 0.0;
  for (const u of company.units) total += maxF(world.units[u]!.revenue_m, 0.0);
  if (total > 0.0) {
    // The share first, so a sole unit's share is exactly 1.
    return bill * (maxF(unit.revenue_m, 0.0) / total);
  }
  return bill / Math.max(company.units.length, 1);
}

/** Sets every unit's month of revenue and every industry's fringe revenue from the current M. */
export function setRevenue(world: World): void {
  for (const unit of world.units) {
    const ind = world.industries[unit.industry]!;
    const company = world.companies[unit.company]!;
    // A frozen company (Bankrupt or Removed) has no revenue (spec 5.12 step 2, D231).
    if (companyIsFrozen(company)) {
      unit.revenue_m = 0.0;
      continue;
    }
    const p = pPre(unit, company);
    unit.revenue_m = unitRevenueMonth(
      businessUnitAssetsEff(unit),
      ind.params.asset_turnover,
      p,
      ind.market_factor,
    );
  }
  for (const ind of world.industries) {
    ind.fringe_revenue_m = fringeRevenueMonth(
      ind.fringe_assets,
      ind.params.asset_turnover,
      ind.market_factor,
    );
  }
}

/** Sets every unit's month of expenses from its revenue and assets. */
export function setExpenses(world: World): void {
  const shared = world.units.map((u) => sharedCostsMonthHook(world, u));
  for (let id = 0; id < world.units.length; id++) {
    const unit = world.units[id]!;
    const params = world.industries[unit.industry]!.params;
    // A frozen company has no expenses (spec 5.12 step 2, D231).
    if (companyIsFrozen(world.companies[unit.company]!)) {
      unit.variable_m = 0.0;
      unit.fixed_m = 0.0;
      unit.dep_m = 0.0;
      unit.rd_m = 0.0;
      unit.shared_m = 0.0;
      continue;
    }
    const e = monthExpenses(
      unit.revenue_m,
      unit.gross_assets,
      unit.asset_book,
      unit.fixed_cost_rate,
      unit.rd_plan,
      params,
      shared[id]!,
    );
    unit.variable_m = e.variable;
    unit.fixed_m = e.fixed;
    unit.dep_m = e.depreciation;
    unit.rd_m = e.rd;
    unit.shared_m = e.shared;
  }
}

/** 4.3 step 7: unit revenue (and the fringe's). */
export function revenueJob(world: World, _ctx: JobCtx): void {
  setRevenue(world);
}

/** 4.3 step 9 (economy part): variable, fixed, depreciation, R&D and shared costs. */
export function expensesJob(world: World, _ctx: JobCtx): void {
  setExpenses(world);
}
