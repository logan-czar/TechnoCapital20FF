// v_units (crates/sim/src/views/units.rs): `get_company_units` (spec 9.2), the Company screen's
// Units tab (spec 8): industry, base province, assets, productivity, growth, R&D, revenue and
// expenses of every business unit. Rebuilt monthly, at the plan lock and on load (spec 9.4), and
// when Omniscient is toggled (D423). A private company's or new listing's unit money figures and
// productivity are estimate bands (D420, D436), and so are a published company's in an estimated
// industry (D432): its monthly revenue over its capacity would give the industry's M, and from it
// the private companies' revenue (spec 1 publishes listed companies' quarterly statements, not
// their units). Growth and R&D plans are shown exactly.
//
// Not ported: UnitsView::get, ::of_company, unit_revenue, revenue_figure (D429) and the
// `ViewData` build (logic).

import type { CompanyId, IndustryId, ProvinceId, UnitId } from "../ids.ts";
import type { Figure } from "./estimate.ts";

/** One business unit (spec 3.6), its last month's figures in USD. */
export interface UnitRow {
  id: UnitId;
  company: CompanyId;
  industry: IndustryId;
  base_province: ProvinceId;
  /** Business assets at cost and at book (spec 3.6). */
  gross_assets: Figure;
  asset_book: Figure;
  /** Gross assets less the 20% shortfall of ramping tranches (spec 5.2). */
  assets_eff: Figure;
  /** 30 to 200 (spec 5.6); a band with the money figures (D436). */
  productivity: Figure;
  /**
   * `productivity + PC bonus + location bonus` (spec 5.2): the productivity band moved by
   * the published bonuses (D430).
   */
  p_pre: Figure;
  /** The locked plan's annual growth rate and R&D share of revenue (spec 3.6). */
  growth_plan: number;
  rd_plan: number;
  revenue_m: Figure;
  variable_m: Figure;
  fixed_m: Figure;
  rd_m: Figure;
  dep_m: Figure;
  /** The 3.8 compute and licences, split by revenue share (spec 5.5). */
  shared_m: Figure;
  /** Revenue less every 5.5 line. */
  ebit_m: Figure;
  /** Asset purchases at cost (spec 5.10). */
  capex_m: Figure;
  /** The figures are estimate bands (D420). */
  estimated: boolean;
}

export interface UnitsView {
  /** Every unit in unit id order. */
  units: UnitRow[];
}
