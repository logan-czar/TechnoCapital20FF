// v_units: `get_company_units` (spec 9.2), the Company screen's Units tab (spec 8): industry, base
// province, assets, productivity, growth, R&D, revenue and expenses of every business unit.
// Rebuilt monthly, at the plan lock and on load (spec 9.4), and when Omniscient is toggled
// (D423). A private company's or new listing's unit money figures and productivity are estimate
// bands (D420, D436), and so are a published company's in an estimated industry (D432): its
// monthly revenue over its capacity would give the industry's M, and from it the private
// companies' revenue (spec 1 publishes listed companies' quarterly statements, not their units).
// Growth and R&D plans are shown exactly. Ported from crates/sim/src/views/units.rs; the types are
// in types/views/units.ts.

import { pPre } from "../economy/supply.ts";
import type { CompanyId, UnitId } from "../types/ids.ts";
import { ESTIMATE_FLOOR_POINTS, type Estimator, type Figure, type Kind } from "../types/views/estimate.ts";
import type { UnitRow, UnitsView } from "../types/views/units.ts";
import type { BusinessUnit } from "../types/world.ts";
import { businessUnitAssetsEff, businessUnitEbitM } from "../world/entities.ts";
import {
  estimatorCompanyNow,
  estimatorCurrent,
  figureExactOf,
  figureMap,
  viewInputEstimator,
} from "./estimate.ts";
import type { ViewInput } from "./index.ts";
import { estimatedIndustries, unitBanded } from "./industry_rows.ts";

/** Rust `UnitsView::get`. */
export function unitsViewGet(v: UnitsView, id: UnitId): UnitRow | undefined {
  return v.units[id];
}

/** `get_company_units(id)`: the company's units in unit id order. */
export function unitsViewOfCompany(v: UnitsView, company: CompanyId): UnitRow[] {
  return v.units.filter((u) => u.company === company);
}

/**
 * A unit's last-month revenue as every view shows it (v_units, v_industry_detail, v_tech's
 * inflow, v_industry_row's total; D429): one estimate of the figure.
 */
export function unitRevenue(est: Estimator, banded: boolean, u: BusinessUnit): Figure {
  return revenueFigure(est, banded, u.company, u.revenue_m);
}

/** A company's last-month revenue `revenue_m` as shown (D429). */
export function revenueFigure(
  est: Estimator,
  banded: boolean,
  company: CompanyId,
  revenue_m: number,
): Figure {
  return estimatorCompanyNow(est, banded, company, { kind: "Line", line: "Revenue" }, revenue_m);
}

/** Rust `ViewData::build`. */
export function buildUnits(input: ViewInput): UnitsView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const classes = estimatedIndustries(est, w);
  const units = w.units.map((u, i): UnitRow => {
    const c = w.companies[u.company]!;
    const banded = unitBanded(est, w, classes, u.company, u.industry);
    const productivity = estimatorCurrent(
      est,
      banded,
      { kind: "Company", company: u.company },
      { kind: "Productivity" },
      u.productivity,
      ESTIMATE_FLOOR_POINTS,
    );
    const pre = pPre(u, c);
    const bonuses = pre - u.productivity;
    const fig = (kind: Kind, truth: number) => estimatorCompanyNow(est, banded, u.company, kind, truth);
    return {
      id: i as UnitId,
      company: u.company,
      industry: u.industry,
      base_province: u.base_province,
      gross_assets: fig({ kind: "GrossAssets" }, u.gross_assets),
      asset_book: fig({ kind: "Line", line: "AssetBook" }, u.asset_book),
      assets_eff: fig({ kind: "AssetsEff" }, businessUnitAssetsEff(u)),
      productivity,
      // `productivity + PC bonus + location bonus` (spec 5.2): the productivity band moved by
      // the published bonuses (D430).
      p_pre: productivity.kind === "Exact" ? figureExactOf(pre) : figureMap(productivity, (p) => p + bonuses),
      growth_plan: u.growth_plan,
      rd_plan: u.rd_plan,
      revenue_m: unitRevenue(est, banded, u),
      variable_m: fig({ kind: "Line", line: "Variable" }, u.variable_m),
      fixed_m: fig({ kind: "Line", line: "FixedCash" }, u.fixed_m),
      rd_m: fig({ kind: "Line", line: "Rd" }, u.rd_m),
      dep_m: fig({ kind: "Line", line: "Depreciation" }, u.dep_m),
      // The compute bill follows the published station counts (D434).
      shared_m: figureExactOf(u.shared_m),
      ebit_m: fig({ kind: "Line", line: "Ebit" }, businessUnitEbitM(u)),
      capex_m: fig({ kind: "Line", line: "AssetPurchases" }, u.capex_m),
      estimated: banded,
    };
  });
  return { units };
}
