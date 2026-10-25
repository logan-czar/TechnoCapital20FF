// The weights that place a random startup event (spec 5.19.1): the industry weight
// `w = f × (0.02 + h)²` and the HQ province weight `province weight × (1 + named companies of the
// industry with HQ there) × 3 if a key city there lists the industry`, with the province weight of
// 2-map 2.3.1 (`total development × $0.3B × G`). Ported from crates/sim/src/births/weights.rs.

import type { DrawSource } from "../types/draws.ts";
import { clamp, maxF, powi } from "../types/num.ts";
import type { PhaseLabel } from "../types/world.ts";

/** Spec 5.19.1: h is this quarter's growth a year above a flat 6%. */
export const HEAT_HURDLE = 0.06;
/** Spec 5.19.1: `w = f × (0.02 + h)²`. */
export const HEAT_BASE = 0.02;
/** Spec 5.19.1: the fringe factor `clamp(1 + log10(fringe revenue in $B), 0.5, 5)`. */
export const FRINGE_FACTOR_MIN = 0.5;
export const FRINGE_FACTOR_MAX = 5.0;
export const USD_PER_BILLION = 1.0e9;
/** Quarters a year: `(1 + q_growth)^4 − 1` is the quarter's growth a year. */
export const QUARTERS_PER_YEAR = 4;
/** 2-map 2.3.1 (batch 119): province weight is total development × $0.3B × G. */
export const PROVINCE_WEIGHT_PER_DEVELOPMENT_USD = 0.3e9;
/**
 * 2-map 2.3.1 (batch 160): G = sqrt(country GDP per head ÷ world GDP per head), clamped to 0.1 to
 * 4 as a safety only (D260; design fix 3: the README's batch 159 clamp of 0.2 to 3 on the plain
 * ratio is superseded).
 */
export const G_MIN = 0.1;
export const G_MAX = 4.0;
/** Spec 5.19.1: a key city in the province that lists the industry triples the weight. */
export const KEY_CITY_MULT = 3.0;

/** h (spec 5.19.1): `max(0, (1 + q_growth)^4 − 1 − 6%)`. */
export function heat(q_growth: number): number {
  return maxF(powi(1.0 + q_growth, QUARTERS_PER_YEAR) - 1.0 - HEAT_HURDLE, 0.0);
}

/**
 * The fringe factor f (spec 5.19.1): `clamp(1 + log10(fringe revenue in $B), 0.5, 5)`. A fringe
 * with no revenue reads the clamp floor, 0.5 (log10 of 0 is −∞; D261).
 */
export function fringeFactor(fringe_revenue_usd: number): number {
  if (fringe_revenue_usd <= 0.0) return FRINGE_FACTOR_MIN;
  return clamp(1.0 + Math.log10(fringe_revenue_usd / USD_PER_BILLION), FRINGE_FACTOR_MIN, FRINGE_FACTOR_MAX);
}

/** The industry weight w (spec 5.19.1): `f × (0.02 + h)²`, 0 for industries labeled Glut or Bust. */
export function industryWeight(q_growth: number, fringe_revenue_usd: number, label: PhaseLabel): number {
  if (label === "Glut" || label === "Bust") return 0.0;
  return fringeFactor(fringe_revenue_usd) * powi(HEAT_BASE + heat(q_growth), 2);
}

/**
 * GDP per head (2-map 2.3.1): `gdp_usd_bn ÷ population_m` from countries.csv, in thousands of USD
 * a head; only its ratio to the world figure is used.
 */
export function gdpPerHead(gdp_usd: number, population: number): number {
  return population > 0.0 ? gdp_usd / population : 0.0;
}

/**
 * G (2-map 2.3.1, batch 160): `clamp(sqrt(country GDP per head ÷ world GDP per head), 0.1, 4)`;
 * the world figure is total GDP over total population (about $11,209).
 */
export function wealthFactor(country_gdp_per_head: number, world_gdp_per_head: number): number {
  if (world_gdp_per_head <= 0.0) return G_MIN;
  return clamp(Math.sqrt(maxF(country_gdp_per_head, 0.0) / world_gdp_per_head), G_MIN, G_MAX);
}

/**
 * Province weight, USD (2-map 2.3.1): `total development × $0.3B × G`, with total development =
 * Commerce + Industry + Population. `total_development` is a whole number (u32).
 */
export function provinceWeight(total_development: number, g: number): number {
  return total_development * PROVINCE_WEIGHT_PER_DEVELOPMENT_USD * g;
}

/** The floor of a development track (spec 2.x: tracks run 1 to 30). */
export const TRACK_FLOOR = 1;

/**
 * Development above the floor (D830, Logan 2026-10-24; spec 5.19.1 HQ weight): each track counts
 * `track − 1`, so a province at exactly 1/1/1 (an empty part of a split giant, D823) draws no
 * startup HQ, and every other province moves by 3 points of its total. Whole numbers (u32).
 */
export function developmentAboveFloor(commerce: number, industry: number, population: number): number {
  let sum = 0;
  for (const t of [commerce, industry, population]) sum += Math.max(0, t - TRACK_FLOOR);
  return sum;
}

/**
 * The HQ weight of a province for a startup in an industry (spec 5.19.1): `province weight × (1 +
 * named companies of the industry with HQ there) × 3 if a key city there lists the industry`.
 */
export function hqWeight(
  province_weight: number,
  named_here: number,
  key_city_lists_industry: boolean,
): number {
  const key = key_city_lists_industry ? KEY_CITY_MULT : 1.0;
  return maxF(province_weight, 0.0) * (1.0 + named_here) * key;
}

/**
 * A weighted pick (gen stream): one uniform times the total, walked in the given order (id
 * order), so ties and float edges go to the earlier (lower id) entry. null, with no draw, when the
 * total weight is 0 (D261: an event with every industry weighing 0 does not fire).
 */
export function weightedPick(weights: readonly number[], draws: DrawSource): number | null {
  let total = 0.0;
  for (const w of weights) total += maxF(w, 0.0);
  if (total <= 0.0 || !Number.isFinite(total)) return null;
  const target = draws.uniform("Gen") * total;
  let acc = 0.0;
  let last: number | null = null;
  for (let i = 0; i < weights.length; i++) {
    const w = maxF(weights[i] as number, 0.0);
    if (w <= 0.0) continue;
    acc += w;
    last = i;
    if (target < acc) return i;
  }
  return last;
}
