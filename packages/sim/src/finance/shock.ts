// Company shocks (1995-rework 9, D1059): a historical world's company sometimes takes a large
// cash charge (an accounting fraud, a lost lawsuit, a disaster). It is booked as the month's
// `special_charge`, below EBIT, so it lowers pre-tax income and operating cash alike, and the
// month's settlement (spec 5.12) does the rest: the line is drawn, then assets are sold at the
// industry's sale factor, and a company whose cash, line and assets cannot cover the hole goes
// Bankrupt. A cash-rich company survives smaller.
//
// Without it the USA cut's American companies almost never fail: in a stable run 161 of 181 never
// post a losing quarter, and the exit rule only catches losers. The whole world met its failure
// bands through foreign firms.
//
// Era worlds only; the 2020 test world and the `mature` profile never draw. One `Era` draw per
// eligible company a month, in company id order; two more on a hit.

import type { DrawSource } from "../types/draws.ts";

/** A company's yearly chance of a shock in an Expansion, while it is making money (D1059, T). */
export const SHOCK_YEARLY = 0.003;
/** The chance's multiple while the global cycle is in Contraction (D1059, T). */
export const SHOCK_CONTRACTION_MULT = 3.0;
/** The chance's multiple for a company that lost money last quarter (D1059, T). */
export const SHOCK_FRAGILE_MULT = 4.0;
/** The charge, as a multiple of trailing four quarters' revenue: uniform between these (D1059, T). */
export const SHOCK_REVENUE_MIN = 0.2;
export const SHOCK_REVENUE_MAX = 2.5;
/** Months in a year: the yearly chance is spread evenly over them. */
const MONTHS_PER_YEAR = 12;

/** What the wire says happened, "[name] takes a $X charge after [cause]" (D1059). */
export const SHOCK_CAUSES: readonly string[] = [
  "an accounting fraud comes to light",
  "losing a product liability suit",
  "a disaster at its largest plant",
  "writing off a failed acquisition",
  "a record regulatory fine",
  "a mass recall",
];

/** A shock that hit: the charge, USD, and the cause's index in `SHOCK_CAUSES`. */
export interface Shock {
  charge: number;
  cause: number;
}

/** This month's chance of a shock (D1059). */
export function shockChance(contraction: boolean, losing: boolean): number {
  let p = SHOCK_YEARLY / MONTHS_PER_YEAR;
  if (contraction) p *= SHOCK_CONTRACTION_MULT;
  if (losing) p *= SHOCK_FRAGILE_MULT;
  return p;
}

/**
 * Draws one eligible company's month (D1059): one `Era` draw for the chance, and on a hit one for
 * the size and one for the cause. Null when it does not hit.
 */
export function shockDraw(
  draws: DrawSource,
  contraction: boolean,
  losing: boolean,
  ttmRevenue: number,
): Shock | null {
  if (!draws.chance("Era", shockChance(contraction, losing))) return null;
  const size = SHOCK_REVENUE_MIN + (SHOCK_REVENUE_MAX - SHOCK_REVENUE_MIN) * draws.uniform("Era");
  const cause = draws.intInclusive("Era", 0, SHOCK_CAUSES.length - 1);
  return { charge: size * Math.max(ttmRevenue, 0.0), cause };
}
