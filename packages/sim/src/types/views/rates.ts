// v_rates (crates/sim/src/views/rates.rs): `get_rates()` (spec 9.2; 8 Pdoomberg F7 Bonds, batch
// 155): the world base rate, every zone's base and effective credit spread, every country's
// sovereign rating and spread, and the rating-to-corporate-spread table of the credit line
// (5.12). Rebuilt monthly (the zone spreads move at the quarter's first monthly close, 4.3 step
// 1d) and on load.
//
// Not ported: the `ViewData` build (logic).

import type { CountryId, ZoneId } from "../ids.ts";
import type { Rating } from "./shared.ts";

/** A zone's spreads (spec 5.1.2), fractions. */
export interface ZoneRate {
  zone: ZoneId;
  number: number;
  name: string;
  base: number;
  effective: number;
}

/** A country's sovereign rating and spread (spec 3.2, 5.1.2). */
export interface SovereignRate {
  country: CountryId;
  iso3: string;
  name: string;
  zone: ZoneId;
  rating: Rating;
  /** A fraction. */
  spread: number;
}

/**
 * One row of the rating-to-spread table (spec 5.12): the corporate spread a rating adds to
 * the line rate, a fraction.
 */
export interface RatingSpread {
  rating: Rating;
  spread: number;
}

export interface RatesView {
  /** World base rate (spec 3.1). */
  base_rate: number;
  /** In zone id order. */
  zones: ZoneRate[];
  /** In country id order. */
  sovereigns: SovereignRate[];
  /** AAA to CC (spec 5.12). */
  rating_spreads: RatingSpread[];
}
