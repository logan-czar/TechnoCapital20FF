// The hourly share price (spec 5.14; 3-markets 3.3.3, flow removed):
// `P_next = P × (1 + 0.0003 × (V* ÷ P − 1) + noise)`, with
// `noise = σh × (ρ × z_market + sqrt(1 − ρ²) × z_stock)`, one z_market per tick shared by all 26
// exchanges, 2% of draws 3 times as wide, the buzz term in V*, the reaction-week volatility
// (21.3.1) and the market calendar: closed all of 1 January (3.1.0) and frozen on the 00:00
// release tick (4.4, 21.2). Ported from crates/sim/src/market/price.rs.

import { QUARTER_FIRST_MONTHS, dateTimeDate, dateTimeHour } from "../time/calendar.ts";
import type { DateTime } from "../types/calendar.ts";
import { PRICE_MOVE_HOUR, REACTION_LAST_DAY, RELEASE_DAY } from "../types/control.ts";
import type { DrawSource } from "../types/draws.ts";
import { clamp, maxF, minF } from "../types/num.ts";

/** Spec 5.14 (3.3.3): the pull toward V* per tick. */
export const PULL_PER_TICK = 0.0003;
/** Spec 5.14 (3.3.3): daily volatility is annual ÷ 19.1 (the square root of 365 trading days). */
export const DAYS_VOLATILITY_DIVISOR = 19.1;
/** Spec 5.14 (3.1.0): 24 ticks a day; hourly volatility is daily ÷ sqrt(24). */
export const TICKS_PER_DAY = 24.0;
/** Spec 5.14: `ρ = min(0.8, 0.5 × beta)`. */
export const RHO_PER_BETA = 0.5;
export const RHO_MAX = 0.8;
/** Spec 5.14 (3.3.3): 2% of draws come from a distribution 3 times as wide (D246). */
export const FAT_TAIL_CHANCE = 0.02;
export const FAT_TAIL_WIDTH = 3.0;
/** Spec 5.14: `V* = V × (1 + 0.10 × buzz ÷ 100)`. */
export const BUZZ_WEIGHT = 0.1;
/** Spec 3.10: buzz runs −100 to +100. */
export const BUZZ_MAX = 100.0;
/** Spec 21.3.1, 4.4: reaction-week hourly volatility ×2 on the release day ... */
export const REACTION_VOLATILITY_START = 2.0;
/** ... falling back to ×1 by day 7 of the week, the 8th (linear by day, D247). */
export const REACTION_VOLATILITY_END = 1.0;
/** Days from the release day (day 1 of the week) to day 7, over which the multiplier falls. */
export const REACTION_VOLATILITY_FADE_DAYS = 6.0;
/** The lowest price a step can leave, USD (the 5.13 per-share floor; D246). */
export const MIN_PRICE_USD = 0.01;

/**
 * The sector table's annual volatility (3-markets 3.3.2), one shared default for all 42
 * industries (D1): 26%, the median of the 3.3.2 column (D245). Not industries.csv `volatility`,
 * which is the sd of the quarterly growth shock (5.1).
 */
export const SECTOR_VOLATILITY = 0.26;
/**
 * The sector table's beta (3-markets 3.3.2), one shared default (D1): 1.0, the median of the
 * 3.3.2 column (D245).
 */
export const SECTOR_BETA = 1.0;

const SQRT_TICKS_PER_DAY = Math.sqrt(TICKS_PER_DAY);

/** Hourly volatility σh (spec 5.14): `annual volatility ÷ 19.1 ÷ sqrt(24)`. */
export function sigmaHourly(annualVolatility: number): number {
  return annualVolatility / DAYS_VOLATILITY_DIVISOR / SQRT_TICKS_PER_DAY;
}

/** Market correlation ρ (spec 5.14): `min(0.8, 0.5 × beta)`. */
export function rho(beta: number): number {
  return minF(RHO_PER_BETA * beta, RHO_MAX);
}

/**
 * True if prices move this tick (spec 4.1 step 2, 3.1.0, 4.4, 21.2): never on 1 January
 * (markets closed), nor on the 00:00 release tick of the 2nd of January, April, July and October
 * (prices frozen while the statements are read).
 */
export function pricesMove(t: DateTime): boolean {
  const d = dateTimeDate(t);
  const holiday = d.month === 1 && d.day === 1;
  const release =
    (QUARTER_FIRST_MONTHS as readonly number[]).includes(d.month) && d.day === RELEASE_DAY && dateTimeHour(t) === 0;
  return !holiday && !release;
}

/**
 * The reaction-week multiplier on hourly volatility (spec 4.4 row 2, 21.3.1): ×2 from the 01:00
 * price move on the release day (day 1), falling linearly by day to ×1 on the 8th (day 7) and
 * after (D247). 1.0 outside the week.
 */
export function reactionVolatilityMult(t: DateTime): number {
  const d = dateTimeDate(t);
  if (!(QUARTER_FIRST_MONTHS as readonly number[]).includes(d.month) || d.day < RELEASE_DAY || d.day > REACTION_LAST_DAY) {
    return REACTION_VOLATILITY_END;
  }
  if (d.day === RELEASE_DAY && dateTimeHour(t) < PRICE_MOVE_HOUR) return REACTION_VOLATILITY_END;
  const daysIn = d.day - RELEASE_DAY;
  return (
    REACTION_VOLATILITY_START -
    ((REACTION_VOLATILITY_START - REACTION_VOLATILITY_END) * daysIn) / REACTION_VOLATILITY_FADE_DAYS
  );
}

/** The buzz-adjusted target V* (spec 5.14): `V × (1 + 0.10 × buzz ÷ 100)`. */
export function targetValue(v: number, buzz: number): number {
  return v * (1.0 + (BUZZ_WEIGHT * clamp(buzz, -BUZZ_MAX, BUZZ_MAX)) / BUZZ_MAX);
}

/**
 * One fat-tailed standard draw (spec 5.14, D246): a prices-stream uniform decides the 2% wide
 * draw, then a prices-stream normal, ×3 when wide. The order (uniform, then normal) is frozen.
 */
export function fatTailedNormal(draws: DrawSource): number {
  const wide = draws.chance("Prices", FAT_TAIL_CHANCE);
  const z = draws.normal("Prices");
  return wide ? FAT_TAIL_WIDTH * z : z;
}

/**
 * The hourly noise of one stock (spec 5.14): `σh × m × (ρ × z_market + sqrt(1 − ρ²) × z_stock)`,
 * with m the `reactionVolatilityMult`.
 */
export function noise(sigmaH: number, rhoV: number, volatilityMult: number, zMarket: number, zStock: number): number {
  return sigmaH * volatilityMult * (rhoV * zMarket + Math.sqrt(maxF(1.0 - rhoV * rhoV, 0.0)) * zStock);
}

/** One hourly price step (spec 5.14): `P × (1 + 0.0003 × (V* ÷ P − 1) + noise)`, never below $0.01 (D246). */
export function stepPrice(p: number, vStar: number, noiseV: number): number {
  const pull = p > 0.0 ? PULL_PER_TICK * (vStar / p - 1.0) : 0.0;
  return maxF(p * (1.0 + pull + noiseV), MIN_PRICE_USD);
}

/** What one listed stock reads on an hourly tick (spec 5.14). */
export interface StockTick {
  price: number;
  /** Per-share fair value V (5.13). */
  value: number;
  buzz: number;
  /** Annual volatility (`SECTOR_VOLATILITY` in the MVP). */
  annual_volatility: number;
  /** Beta (`SECTOR_BETA` in the MVP). */
  beta: number;
}

/**
 * One tick's prices for every listed stock, in the order given (company id order, D2): the
 * shared z_market is drawn first, then each stock's z_stock in turn (spec 5.14; D246). Returns
 * the new prices; a closed tick (`pricesMove` false) returns them unchanged and draws nothing.
 */
export function stepPrices(t: DateTime, stocks: readonly StockTick[], draws: DrawSource): number[] {
  if (!pricesMove(t)) return stocks.map((s) => s.price);
  const mult = reactionVolatilityMult(t);
  const zMarket = fatTailedNormal(draws);
  return stocks.map((s) => {
    const zStock = fatTailedNormal(draws);
    const n = noise(sigmaHourly(s.annual_volatility), rho(s.beta), mult, zMarket, zStock);
    return stepPrice(s.price, targetValue(s.value, s.buzz), n);
  });
}
