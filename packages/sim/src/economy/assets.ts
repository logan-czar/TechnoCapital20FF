// Asset decay and growth plan purchases and sales (spec 5.10, Logan batches 145 and 149; 4.3
// step 11). Ported from crates/sim/src/economy/assets.rs.
//
// - Yearly decay `decay_usd = asset_decay × max(0, gross_assets − threshold)`: 1% on the part
//   above $10M only, so $50M decays $400k a year. Monthly the unit loses `decay_usd ÷ 12` of
//   capacity at cost; the same amount comes off asset_book as depreciation, capped at the book.
//   Ramping tranches decay with the rest (A).
// - Purchases `= gross_assets × (d_eff + g) ÷ 12` with g the plan's annual net growth rate:
//   above 0 buy (the growth part ramps at 80% for 6 months, replacement does not); below 0 sell
//   `gross_assets × |d_eff + g| ÷ 12` of capacity, the same share of the book, for
//   `book sold × sale factor` in cash. Cash moves at the 4.3 step 13 settle (M4); this step
//   records the month's purchases, proceeds, gain and depreciation, which finance posts.

import type { JobCtx } from "../time/scheduler.ts";
import { maxF, minF } from "../types/num.ts";
import type { BusinessUnit, IndustryParams, PhaseLabel, Tranche, World } from "../types/world.ts";
import { companyIsFrozen, companyMayBuyAssets, MONTHS_PER_YEAR } from "./index.ts";

/** New assets work at 80% while they ramp: `assets_eff = gross − 0.2 × ramping` (spec 5.2, 10.0.4). */
export const RAMP_SHORTFALL = 0.2;
/** Month closes a growth purchase ramps for (spec 5.10, 10.0.4). */
export const RAMP_MONTHS = 6;
/** Cash per $1 of book sold, by the industry's phase label (spec 5.10, 10.0.7). */
export const SALE_FACTOR_BOOM = 1.0;
export const SALE_FACTOR_NORMAL = 0.85;
export const SALE_FACTOR_GLUT = 0.7;
export const SALE_FACTOR_BUST = 0.6;

/** Yearly asset decay in USD (spec 5.10). */
export function decayUsd(grossAssets: number, p: IndustryParams): number {
  return p.asset_decay * maxF(grossAssets - p.asset_decay_threshold_usd, 0.0);
}

/** `d_eff = decay_usd ÷ gross_assets` (spec 5.10); 0 for a unit with no assets. */
export function dEff(grossAssets: number, p: IndustryParams): number {
  return grossAssets > 0.0 ? decayUsd(grossAssets, p) / grossAssets : 0.0;
}

/** Cash per $1 of book sold (spec 5.10). */
export function saleFactor(label: PhaseLabel): number {
  switch (label) {
    case "Boom":
      return SALE_FACTOR_BOOM;
    case "Normal":
      return SALE_FACTOR_NORMAL;
    case "Glut":
      return SALE_FACTOR_GLUT;
    case "Bust":
      return SALE_FACTOR_BUST;
  }
}

/** What one unit's step 11 did. */
export interface AssetMonth {
  /** Capacity lost to decay, at cost. */
  decay: number;
  /** Depreciation taken off the book. */
  depreciation: number;
  /** Purchases at cost (replacement plus growth). */
  purchases: number;
  /** The growth part, which ramps. */
  ramping_added: number;
  /** Capacity sold, at cost. */
  sold: number;
  book_sold: number;
  proceeds: number;
  /** proceeds − book sold. */
  gain: number;
}

/** Rust `AssetMonth::default()`. */
export function assetMonthDefault(): AssetMonth {
  return {
    decay: 0,
    depreciation: 0,
    purchases: 0,
    ramping_added: 0,
    sold: 0,
    book_sold: 0,
    proceeds: 0,
    gain: 0,
  };
}

/** Scales every tranche by `keep` (decay and sales take the same share of ramping assets). */
function scaleRamping(ramping: Tranche[], keep: number): void {
  for (const t of ramping) t.amount *= keep;
}

/**
 * One unit's month of 5.10: decay, ramping ages, then the plan buys or sells. Purchases and
 * sales are sized on the gross assets before this month's decay, so g = 0 buys back exactly the
 * decay and holds the base flat.
 */
export function applyAssetMonth(unit: BusinessUnit, params: IndustryParams, label: PhaseLabel): AssetMonth {
  return applyAssetMonthBuying(unit, params, label, true);
}

/**
 * `applyAssetMonth` with `mayBuy` false for a Distressed company (spec 5.12 step 1: purchases
 * stop, g = −d_eff at most): the plan's month is capped at 0, so a plan that would buy buys
 * nothing (the base shrinks by decay alone) and one that sells still sells.
 */
export function applyAssetMonthBuying(
  unit: BusinessUnit,
  params: IndustryParams,
  label: PhaseLabel,
  mayBuy: boolean,
): AssetMonth {
  const out = assetMonthDefault();
  const g = unit.growth_plan;
  const gross0 = unit.gross_assets;
  const yearlyDecay = decayUsd(gross0, params);
  // Decay: a real loss of capacity at cost; depreciation off the book (5.5, 5.10).
  out.decay = yearlyDecay / MONTHS_PER_YEAR;
  out.depreciation = minF(unit.asset_book, out.decay);
  if (gross0 > 0.0) {
    scaleRamping(unit.ramping, 1.0 - out.decay / gross0);
  }
  unit.gross_assets -= out.decay;
  unit.asset_book -= out.depreciation;
  // Ramping tranches age one month.
  for (const t of unit.ramping) t.months_left = Math.max(0, t.months_left - 1);
  unit.ramping = unit.ramping.filter((t) => t.months_left > 0);
  // The plan: replacement first, then growth (spec 5.10).
  let plan = (yearlyDecay + gross0 * g) / MONTHS_PER_YEAR;
  if (!mayBuy) plan = minF(plan, 0.0);
  if (plan > 0.0) {
    out.purchases = plan;
    unit.gross_assets += plan;
    unit.asset_book += plan;
    if (g > 0.0) {
      out.ramping_added = (gross0 * g) / MONTHS_PER_YEAR;
      unit.ramping.push({ amount: out.ramping_added, months_left: RAMP_MONTHS });
    }
  } else if (plan < 0.0 && unit.gross_assets > 0.0) {
    out.sold = minF(-plan, unit.gross_assets);
    const share = out.sold / unit.gross_assets;
    out.book_sold = unit.asset_book * share;
    out.proceeds = out.book_sold * saleFactor(label);
    out.gain = out.proceeds - out.book_sold;
    unit.gross_assets -= out.sold;
    unit.asset_book -= out.book_sold;
    scaleRamping(unit.ramping, 1.0 - share);
  }
  unit.capex_m = out.purchases;
  unit.sale_proceeds_m = out.proceeds;
  unit.sale_gain_m = out.gain;
  // The depreciation the book actually lost, which the ledger posts (5.5; equal to step 9's).
  unit.dep_m = out.depreciation;
  return out;
}

/**
 * 4.3 step 11 (economy part): asset decay, the growth plan's buys and sells, ramping. A
 * Distressed company buys nothing (g = −d_eff at most, spec 5.12 step 1); a frozen one (Bankrupt
 * or Removed) has no decay and no plan (5.12 step 2, D231, D123).
 */
export function assetsJob(world: World, _ctx: JobCtx): void {
  for (const unit of world.units) {
    const ind = world.industries[unit.industry]!;
    const company = world.companies[unit.company]!;
    if (companyIsFrozen(company)) {
      unit.capex_m = 0.0;
      unit.sale_proceeds_m = 0.0;
      unit.sale_gain_m = 0.0;
      unit.dep_m = 0.0;
      continue;
    }
    applyAssetMonthBuying(unit, ind.params, ind.phase_label, companyMayBuyAssets(company));
  }
}
