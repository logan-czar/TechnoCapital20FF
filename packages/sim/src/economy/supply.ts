// Fringe pools, supply, S and M (spec 5.2, 5.3, 7.2; 4.3 steps 3 and 6). Ported from
// crates/sim/src/economy/supply.rs.
//
// - Fringe at load: `fringe_assets = max(0, world_size − Σ named revenue) ÷ turnover`,
//   productivity 100, no decay; monthly `fringe_assets ×= (1 + q_growth)^(1/3)`, so the fringe
//   grows with its industry's demand and keeps its share.
// - `supply = fringe_assets × turnover + Σ units (assets_eff × turnover × p_pre ÷ 100)`, with
//   `p_pre = productivity + PC bonus + location_bonus` (C12).
// - `S = supply ÷ demand`; `M = clamp((1 ÷ S)^0.5, 0.7, 1.3)`.

import { quarterPrev, simDateQuarter } from "../time/calendar.ts";
import { type JobCtx, tickFactsIsQuarterStart } from "../time/scheduler.ts";
import { clamp, maxF } from "../types/num.ts";
import type { BusinessUnit, Company, World } from "../types/world.ts";
import { businessUnitAssetsEff } from "../world/entities.ts";
import { closingRates, monthFactor, trendMonthFactor } from "./demand.ts";
import { companyIsFrozen, MONTHS_PER_YEAR, PRODUCTIVITY_SCALE } from "./index.ts";

/** M's clamp (spec 5.2, T). */
export const M_MIN = 0.7;
export const M_MAX = 1.3;
/** M = (1 ÷ S)^0.5 (spec 5.2, T). */
export const M_EXPONENT = 0.5;
/** The share of its gap to demand a sticky fringe closes a month (1995-rework 9, T). */
export const FRINGE_ADJUST_MONTHLY = 0.08;
/** The gap a sticky fringe reads is clamped to this (1995-rework 9, T). */
export const FRINGE_GAP_LIMIT = 0.5;
/** The industry screen keeps 20 closed quarters (spec 8, 4.5). */
export const HISTORY_QUARTERS = 20;

/** Fringe pool assets at load (spec 5.3, 7.2). */
export function fringeAssetsAtLoad(worldSize: number, namedRevenue: number, turnover: number): number {
  return maxF(worldSize - namedRevenue, 0.0) / turnover;
}

/** The fringe's month: `fringe_assets × (1 + q_growth)^(1/3)` (spec 5.3). */
export function fringeAfterMonth(fringeAssets: number, qGrowth: number): number {
  return fringeAssets * monthFactor(qGrowth);
}

/**
 * In a historical world the fringe's capacity is sticky (1995-rework 9): it grows on the long-term
 * rate and closes a share of its gap to demand each month. So a downturn leaves capacity above demand
 * and squeezes every firm's margin through M, where the spec 5.3 fringe shrinks in step and takes
 * the whole shock.
 */
export function stickyFringeAfterMonth(fringeAssets: number, lt: number, s: number): number {
  const gap = s > 0.0 ? clamp(1.0 / s - 1.0, -FRINGE_GAP_LIMIT, FRINGE_GAP_LIMIT) : 0.0;
  return fringeAssets * trendMonthFactor(lt) * (1.0 + FRINGE_ADJUST_MONTHLY * gap);
}

/**
 * A young industry's fringe (one that fades, a half life above 0) grows on its mature rate and closes
 * this share of its gap a month, so newcomers, not the fringe, take a new market (1995-rework 9, T).
 */
export const YOUNG_FRINGE_ADJUST_MONTHLY = 0.04;

/** The era fringe's month for `ind`: sticky, and slower still in a young industry (1995-rework 9). */
export function eraFringeAfterMonth(ind: World["industries"][number], lt: number): number {
  const p = ind.params;
  if (p.fade_half_life_years <= 0.0) return stickyFringeAfterMonth(ind.fringe_assets, lt, ind.supply_ratio);
  const s = ind.supply_ratio;
  const gap = s > 0.0 ? clamp(1.0 / s - 1.0, -FRINGE_GAP_LIMIT, FRINGE_GAP_LIMIT) : 0.0;
  return ind.fringe_assets * trendMonthFactor(p.mature_rate) * (1.0 + YOUNG_FRINGE_ADJUST_MONTHLY * gap);
}

/** The fringe's supply a year at productivity 100 (spec 5.2). */
export function fringeSupply(fringeAssets: number, turnover: number): number {
  return fringeAssets * turnover;
}

/** `p_pre = productivity + PC bonus + location_bonus` (spec 5.2, C12). */
export function pPre(unit: BusinessUnit, company: Company): number {
  return unit.productivity + company.pc_bonus + unit.location_bonus;
}

/** One unit's supply a year: `assets_eff × turnover × p_pre ÷ 100` (spec 5.2). */
export function unitSupply(assetsEff: number, turnover: number, pPreValue: number): number {
  return (assetsEff * turnover * pPreValue) / PRODUCTIVITY_SCALE;
}

/**
 * `S = supply ÷ demand` (spec 5.2). Demand is above 0 for every industry with a world size; an
 * industry with none reads as fully oversupplied.
 */
export function supplyRatio(supply: number, demand: number): number {
  return demand > 0.0 ? supply / demand : Number.MAX_VALUE;
}

/** `M = clamp((1 ÷ S)^0.5, 0.7, 1.3)` (spec 5.2). */
export function marketFactor(s: number): number {
  if (s <= 0.0) return M_MAX;
  return clamp((1.0 / s) ** M_EXPONENT, M_MIN, M_MAX);
}

/** Sets every industry's supply, S and M from its fringe and units (units summed in id order). */
export function setSupply(world: World): void {
  const named = new Array<number>(world.industries.length).fill(0.0);
  for (const unit of world.units) {
    const turnover = world.industries[unit.industry]!.params.asset_turnover;
    const company = world.companies[unit.company]!;
    // A Bankrupt company's capacity leaves supply (spec 5.12 step 2); a removed one's is in
    // the fringe (C30).
    if (companyIsFrozen(company)) continue;
    named[unit.industry]! += unitSupply(businessUnitAssetsEff(unit), turnover, pPre(unit, company));
  }
  for (let id = 0; id < world.industries.length; id++) {
    const ind = world.industries[id]!;
    // A dormant industry has no market yet: neither over nor under supplied (1995-rework 5.2).
    if (world.era?.sectors[id]?.status === "Dormant") {
      ind.supply = 0.0;
      ind.supply_ratio = 1.0;
      ind.market_factor = 1.0;
      continue;
    }
    ind.supply = fringeSupply(ind.fringe_assets, ind.params.asset_turnover) + named[id]!;
    ind.supply_ratio = supplyRatio(ind.supply, ind.demand);
    ind.market_factor = marketFactor(ind.supply_ratio);
  }
}

/** 4.3 step 3: fringe pools grow or shrink with the closed month's growth (D100). */
export function fringeJob(world: World, ctx: JobCtx): void {
  const quarterStart = tickFactsIsQuarterStart(ctx.facts);
  for (const ind of world.industries) {
    const [q, lt] = closingRates(ind, quarterStart);
    ind.fringe_assets =
      world.era === undefined ? fringeAfterMonth(ind.fringe_assets, q) : eraFringeAfterMonth(ind, lt);
  }
}

/**
 * 4.3 step 6: supply, S and M per industry; on a quarter's first day the closed quarter joins
 * the industry's 20-quarter history.
 */
export function supplyJob(world: World, ctx: JobCtx): void {
  setSupply(world);
  if (tickFactsIsQuarterStart(ctx.facts)) {
    const closed = quarterPrev(simDateQuarter(ctx.facts.date));
    for (const ind of world.industries) {
      ind.history.push({
        quarter: closed,
        demand: ind.demand,
        supply: ind.supply,
        q_growth: ind.prev_q_growth,
        lt: ind.prev_lt,
      });
      if (ind.history.length > HISTORY_QUARTERS) ind.history.shift();
    }
  }
}

/** Fringe revenue a month: `fringe_assets × turnover × M ÷ 12` (spec 5.3). */
export function fringeRevenueMonth(fringeAssets: number, turnover: number, m: number): number {
  return (fringeAssets * turnover * m) / MONTHS_PER_YEAR;
}
