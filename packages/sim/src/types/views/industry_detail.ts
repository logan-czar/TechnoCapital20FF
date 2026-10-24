// v_industry_detail (crates/sim/src/views/industry_detail.rs): `get_industry` (spec 9.2), the
// spec 8 Industries detail view: the 20-quarter history of demand, supply and growth against the
// long-term rate, the company list and the fringe row. Rebuilt monthly and on load (spec 9.4),
// and when Omniscient is toggled (D423). A private company's or new listing's revenue is its one
// revenue estimate and its share that band over the industry's total shown (D429, D430); the list
// is ranked by the revenue shown, so its order cannot give the truth away (D420). An industry
// estimated by D432 shows its total, fringe and history supply as bands, as v_industry_row does.
//
// Not ported: IndustryDetailView::get and the `ViewData` build (logic).

import type { Quarter } from "../calendar.ts";
import type { CompanyId, IndustryId } from "../ids.ts";
import type { Figure } from "./estimate.ts";

export interface IndustryCompany {
  company: CompanyId;
  name: string;
  /** Last month's revenue, USD (the same figure as v_units' revenue). */
  revenue_m: Figure;
  /** Share of the industry's revenue (named plus fringe) shown. */
  share: Figure;
}

/** One closed quarter of the industry (spec 8 chart): demand, supply, growth and lt. */
export interface IndustryQuarterRow {
  quarter: Quarter;
  /** Effective demand at the quarter's end, USD a year. */
  demand: number;
  /** Supply at the quarter's end, USD a year; a band in an estimated industry (D432). */
  supply: Figure;
  q_growth: number;
  lt: number;
}

export interface IndustryDetail {
  id: IndustryId;
  /** Closed quarters, oldest first (up to 20). */
  history: IndustryQuarterRow[];
  /** Every named company, biggest revenue shown first, ties to the lower id. */
  companies: IndustryCompany[];
  /** The "Fringe (unnamed)" row (spec 5.3). */
  fringe_revenue_m: Figure;
  fringe_share: Figure;
  /** The totals are bands (D432). */
  estimated: boolean;
}

export interface IndustryDetailView {
  /** In industry id order. */
  industries: IndustryDetail[];
}
