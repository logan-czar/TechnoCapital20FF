// The growth plan (spec 6.2): the annual net rate g from the situation table, the trait nudges,
// the −20% to +30% clamp and the funding cap on the quarter's purchases (5.10). Ported from
// crates/sim/src/ai/growth.rs.

import { clamp, maxF, minF } from "../types/num.ts";
import type { Trait } from "../types/state/people.ts";
import type { ArchetypeRow } from "./archetype.ts";
import { has } from "./inputs.ts";

/** Spec 6.2 row 1: loss_q ≥ 4 sells down at −15% (2.23.2). */
export const SELL_DOWN_LOSS_QUARTERS = 4;
export const SELL_DOWN_GROWTH = -0.15;
/** Spec 6.2 row 2: loss_q 2 to 3 shrinks at −5%. */
export const SHRINK_LOSS_QUARTERS = 2;
export const SHRINK_GROWTH = -0.05;
/**
 * Spec 6.2 oversupply term: `OVERSUPPLY_GROWTH_PENALTY × max(0, S − 1)` comes off g_dem, 1 point
 * of growth per 1% of oversupply (Logan, design fix 241, D282; the spec text's "10 ×" is
 * superseded).
 */
export const OVERSUPPLY_GROWTH_PENALTY = 1.0;
/** Spec 6.2 row 4: below the hurdle, growth is at most 2%. */
export const BELOW_HURDLE_MAX_GROWTH = 0.02;
/** Spec 6.2 row 5: ROA below 0 and loss_q under 2 holds at 0%. */
export const LOSS_HOLD_GROWTH = 0.0;
/** Spec 6.2 trait nudges (T), fractions a year. */
export const NUDGE_AMBITIOUS = 0.03;
export const NUDGE_CONTENT = -0.01;
export const NUDGE_CAUTIOUS = -0.02;
export const NUDGE_BRAVE = 0.01;
/** Visionary +1 pp, in Tech only. */
export const NUDGE_VISIONARY_TECH = 0.01;
/** Spec 6.2 clamp. */
export const GROWTH_MIN = -0.2;
export const GROWTH_MAX = 0.3;
/** Spec 6.2 funding cap: the quarter's purchases use at most 50% of liquidity above min_cash. */
export const FUNDING_CAP_SHARE = 0.5;
/** Quarters a year: the quarter's purchases are a quarter of the yearly rate (5.10). */
export const QUARTERS_PER_YEAR = 4.0;

/**
 * The situation row's growth (spec 6.2 table), before the trait nudges.
 *
 * | Situation | Growth |
 * |---|---|
 * | loss_q ≥ 4 | −15% |
 * | loss_q 2 to 3 | −5% |
 * | ROA ≥ hurdle | `g_dem − max(0, S − 1) + archetype adj` |
 * | 0 ≤ ROA < hurdle | `min(2%, g_dem − max(0, S − 1))` |
 * | ROA < 0 and loss_q < 2 | 0% |
 */
export function situationGrowth(
  loss_q: number,
  roa: number,
  g_dem: number,
  supply_ratio: number,
  archetype: ArchetypeRow,
): number {
  if (loss_q >= SELL_DOWN_LOSS_QUARTERS) return SELL_DOWN_GROWTH;
  if (loss_q >= SHRINK_LOSS_QUARTERS) return SHRINK_GROWTH;
  const demand_led = g_dem - OVERSUPPLY_GROWTH_PENALTY * maxF(supply_ratio - 1.0, 0.0);
  if (roa >= archetype.hurdle_roa) return demand_led + archetype.growth_adj;
  if (roa >= 0.0) return minF(BELOW_HURDLE_MAX_GROWTH, demand_led);
  return LOSS_HOLD_GROWTH;
}

/**
 * The trait nudges (spec 6.2, T), summed: Ambitious +3 pp, Content −1 pp, Cautious −2 pp, Brave
 * +1 pp, Visionary +1 pp in Tech. `traits` are the ones the AI reads (the named controller's; none
 * for a born company, 5.19.5). They apply after every row (D263).
 */
export function traitNudge(traits: readonly Trait[], tech: boolean): number {
  let n = 0.0;
  if (has(traits, "Ambitious")) n += NUDGE_AMBITIOUS;
  if (has(traits, "Content")) n += NUDGE_CONTENT;
  if (has(traits, "Cautious")) n += NUDGE_CAUTIOUS;
  if (has(traits, "Brave")) n += NUDGE_BRAVE;
  if (tech && has(traits, "Visionary")) n += NUDGE_VISIONARY_TECH;
  return n;
}

/** What the funding cap reads (spec 6.2, 5.10). */
export interface FundingInputs {
  gross_assets: number;
  /** `d_eff` of the unit (5.10): replacement, a fraction a year. */
  d_eff: number;
  /** Own cash + undrawn line (spec 6). */
  liquidity: number;
  min_cash: number;
  /**
   * Purchases are stopped (spec 5.12 step 1 Distressed, "g = −d_eff at most"; 6.6 "until a raise
   * succeeds, 6.2 holds g at −d_eff"): g is capped at −d_eff.
   */
  purchases_stopped: boolean;
}

/**
 * The quarter's planned purchases at growth `g` (spec 6.2, 5.10): `gross × (d_eff + g) ÷ 4`;
 * negative is a sale.
 */
export function quarterPurchases(gross_assets: number, d_eff: number, g: number): number {
  return (gross_assets * (d_eff + g)) / QUARTERS_PER_YEAR;
}

/**
 * The funding cap (spec 6.2): the quarter's purchases may use at most 50% of liquidity above
 * min_cash; g is scaled down to fit, but not below −d_eff (no purchases). A g already at or below
 * −d_eff buys nothing and is left alone. With `purchases_stopped`, g is at most −d_eff.
 */
export function fundingCap(g: number, i: FundingInputs): number {
  const floor = -i.d_eff;
  if (i.purchases_stopped) return minF(g, floor);
  if (g <= floor || i.gross_assets <= 0.0) return g;
  const budget = FUNDING_CAP_SHARE * maxF(i.liquidity - i.min_cash, 0.0);
  if (quarterPurchases(i.gross_assets, i.d_eff, g) <= budget) return g;
  return clamp((budget * QUARTERS_PER_YEAR) / i.gross_assets - i.d_eff, floor, g);
}

/** Everything 6.2 reads. */
export interface GrowthInputs {
  /** Whole number (u32). */
  loss_q: number;
  roa: number;
  g_dem: number;
  supply_ratio: number;
  archetype: ArchetypeRow;
  traits: readonly Trait[];
  tech: boolean;
  funding: FundingInputs;
}

/**
 * The locked growth plan g (spec 6.2): the situation row, plus the trait nudges, clamped to −20%
 * to +30%, then the funding cap.
 */
export function growthPlan(i: GrowthInputs): number {
  const g =
    situationGrowth(i.loss_q, i.roa, i.g_dem, i.supply_ratio, i.archetype) + traitNudge(i.traits, i.tech);
  return fundingCap(clamp(g, GROWTH_MIN, GROWTH_MAX), i.funding);
}
