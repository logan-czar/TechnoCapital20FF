// v_ratings (crates/sim/src/views/ratings.rs): credit ratings (spec 9.2, Pdoomberg F6 Ratings,
// spec 8): every company's rating, the implied rating with its breakdown (5.12, 3.6.3), the last
// review's move, the credit line (drawn, limit, rate, home spread) and the distress state.
// Rebuilt quarterly (spec 9.4), so it shows the 01:00 release-day review once it has run, and
// when Omniscient is toggled (D423). A private company's or new listing's line drawn and limit
// are estimate bands (D420); its rating is published (F6 shows every rating, D157).
//
// Not ported: RatingsView::get, ::band_counts (companies not frozen per band) and the `ViewData`
// build (logic).

import type { SimDate } from "../calendar.ts";
import type { CompanyId } from "../ids.ts";
import type { Figure } from "./estimate.ts";
import type { Band, CompanyStatus, ImpliedRating, Rating } from "./shared.ts";

/** One company's rating row. */
export interface CompanyRating {
  id: CompanyId;
  key: string;
  rating: Rating;
  /** The implied rating at the last review (or at load) and how it was reached. */
  implied: ImpliedRating;
  /** Notches the last review moved, better above 0. */
  last_review_notches: number;
  line_drawn: Figure;
  line_limit: Figure;
  /**
   * The line rate now: base rate + home spread (effective zone spread) + corporate spread
   * (spec 5.12).
   */
  line_rate: number;
  home_spread: number;
  /** Months left to repay an excess over the limit (spec 5.12 review); 0 with none open. */
  excess_months_left: number;
  status: CompanyStatus;
  distress_months: number;
  frozen_quarters: number;
  bankrupt_on: SimDate | null;
  removed_on: SimDate | null;
}

export interface RatingsView {
  /** Every company in company id order. */
  companies: CompanyRating[];
  /** World base rate (spec 3.1). */
  base_rate: number;
}

/** The rating bands, best first (spec 5.12). Elements are finance::rating::Band. */
export const BANDS: readonly Band[] = ["Aaa", "Aa", "A", "Bbb", "Bb", "B", "Ccc", "Cc"];
