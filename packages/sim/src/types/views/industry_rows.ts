// v_industry_row (crates/sim/src/views/industry_rows.rs): `list_industries` (spec 9.2), the spec
// 8 Industries table of 42: demand, supply, S, M, phase label, long-term growth, this quarter's
// growth a year, fringe share and the top 5 companies. Rebuilt monthly and on load (spec 9.4),
// and when Omniscient is toggled (D423). The top 5 are ranked by the revenue shown (a private
// company's estimate, D420), so the ranking cannot give a hidden revenue away.
//
// The industry tables are published figures (spec 1), with one exception (Logan's ruling, D432):
// an industry with one or two companies whose figures are bands would let its exact totals, less
// the published parts, isolate them. Such an industry shows its named revenue as the sum of the
// revenues shown, and its supply, S, M, fringe revenue and fringe share as bands, since any of
// those would rebuild the named total through the 5.2 and 5.4 identities; its published
// companies' monthly unit figures are bands too, since they give M (D436).
//
// Not ported: IndustryRowsView::get, companies_by_revenue, ranked_as_shown,
// estimated_industries, unit_banded, industry_figure and the `ViewData` build (logic).
// `pub use crate::world::INDUSTRY_UNPUBLISHED_BELOW` is re-exported from ../world.ts.

import type { CompanyId, IndustryId } from "../ids.ts";
import type { PhaseLabel } from "../world.ts";
import type { Figure } from "./estimate.ts";

export { INDUSTRY_UNPUBLISHED_BELOW } from "../world.ts";

/** Companies shown per industry row (spec 8). */
export const TOP_COMPANIES = 5;

export interface IndustryRow {
  id: IndustryId;
  key: string;
  name: string;
  sector: string;
  /** Effective demand, USD a year (spec 5.1). */
  demand: number;
  trend_demand: number;
  /** Supply, USD a year (spec 5.2); a band in an estimated industry (D432). */
  supply: Figure;
  supply_ratio: Figure;
  market_factor: Figure;
  phase_label: PhaseLabel;
  /** This quarter's long-term rate, a year. */
  lt: number;
  /** This quarter's growth a year, `(1 + q_growth)^4 − 1` (spec 8). */
  growth_annual: number;
  /** The fringe's share of supply. */
  fringe_share: Figure;
  /**
   * Last month's revenue of the named units (the sum of the revenues shown in an estimated
   * industry) and of the fringe, USD.
   */
  named_revenue_m: Figure;
  fringe_revenue_m: Figure;
  /**
   * The biggest companies by last month's revenue shown (exact or estimated, D420), ties to
   * the lower id.
   */
  top_companies: CompanyId[];
  /** The totals are bands (D432). */
  estimated: boolean;
}

export interface IndustryRowsView {
  /** In industry id order. */
  rows: IndustryRow[];
}
