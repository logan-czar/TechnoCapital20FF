// v_industry_row: `list_industries` (spec 9.2), the spec 8 Industries table of 42: demand, supply,
// S, M, phase label, long-term growth, this quarter's growth a year, fringe share and the top 5
// companies. Rebuilt monthly and on load (spec 9.4), and when Omniscient is toggled (D423). The
// top 5 are ranked by the revenue shown (a private company's estimate, D420), so the ranking
// cannot give a hidden revenue away. Ported from crates/sim/src/views/industry_rows.rs; the types
// and `TOP_COMPANIES` are in types/views/industry_rows.ts.
//
// The industry tables are published figures (spec 1), with one exception (Logan's ruling, D432):
// an industry with one or two companies whose figures are bands would let its exact totals, less
// the published parts, isolate them. Such an industry shows its named revenue as the sum of the
// revenues shown, and its supply, S, M, fringe revenue and fringe share as bands, since any of
// those would rebuild the named total through the 5.2 and 5.4 identities; its published
// companies' monthly unit figures are bands too, since they give M (D436).

import { fringeSupply } from "../economy/supply.ts";
import type { CompanyId, IndustryId } from "../types/ids.ts";
import { powi, totalCmp } from "../types/num.ts";
import {
  ESTIMATE_FLOOR_RATIO,
  ESTIMATE_FLOOR_SHARE,
  ESTIMATE_FLOOR_USD,
  type Estimator,
  type Figure,
  type Kind,
} from "../types/views/estimate.ts";
import { type IndustryRow, type IndustryRowsView, TOP_COMPANIES } from "../types/views/industry_rows.ts";
import type { World } from "../types/world.ts";
import { worldIndustryEstimatedAt } from "../world/index.ts";
import {
  estimatorBanded,
  estimatorCurrent,
  figureExactOf,
  figureOver,
  figureShown,
  figureSum,
  viewInputEstimator,
} from "./estimate.ts";
import type { ViewInput } from "./index.ts";
import { revenueFigure } from "./units.ts";

/** Rust `IndustryRowsView::get`. */
export function industryRowsViewGet(v: IndustryRowsView, id: IndustryId): IndustryRow | undefined {
  return v.rows[id];
}

/**
 * Every industry's companies with last month's revenue, biggest first, ties to the lower id (one
 * entry per unit, in unit order before the sort).
 */
export function companiesByRevenue(w: World): [CompanyId, number][][] {
  const out: [CompanyId, number][][] = w.industries.map(() => []);
  for (const u of w.units) out[u.industry]!.push([u.company, u.revenue_m]);
  for (const list of out) list.sort((a, b) => totalCmp(b[1], a[1]) || a[0] - b[0]);
  return out;
}

/**
 * One industry's companies with last month's revenue as shown (one estimate per figure, D429; a
 * published company's too in an estimated industry, D436), biggest shown first, ties to the lower
 * id: the order of the Industries table's top 5 and the detail view's list.
 */
export function rankedAsShown(
  est: Estimator,
  w: World,
  list: readonly [CompanyId, number][],
  estimated: boolean,
): [CompanyId, Figure][] {
  const shown = list.map(([c, r]): [CompanyId, Figure] => [
    c,
    revenueFigure(est, estimatorBanded(est, w, c) || estimated, c, r),
  ]);
  shown.sort((a, b) => totalCmp(figureShown(b[1]), figureShown(a[1])) || a[0] - b[0]);
  return shown;
}

/**
 * Whether each industry is in the estimated class now (D432; never in Omniscient), in industry id
 * order: its totals, and its published companies' monthly unit figures (D436), are bands.
 */
export function estimatedIndustries(est: Estimator, w: World): boolean[] {
  return w.industries.map(
    (_, id) => !est.omniscient && worldIndustryEstimatedAt(w, id as IndustryId, w.clock),
  );
}

/**
 * Whether a company's unit figures in `industry` are bands (D420, D436): its own figures are, or
 * the industry is estimated.
 */
export function unitBanded(
  est: Estimator,
  w: World,
  estimated: readonly boolean[],
  company: CompanyId,
  industry: IndustryId,
): boolean {
  return estimatorBanded(est, w, company) || estimated[industry]!;
}

/** An industry-level figure: a band in an estimated industry (D432). */
export function industryFigure(
  est: Estimator,
  estimated: boolean,
  id: IndustryId,
  kind: Kind,
  truth: number,
  floor: number,
): Figure {
  return estimatorCurrent(est, estimated, { kind: "Industry", industry: id }, kind, truth, floor);
}

/** Rust `ViewData::build`. */
export function buildIndustryRows(input: ViewInput): IndustryRowsView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const ranked = companiesByRevenue(w);
  const classes = estimatedIndustries(est, w);
  const rows = w.industries.map((ind, i): IndustryRow => {
    const id = i as IndustryId;
    const list = ranked[id]!;
    const estimated = classes[id]!;
    const shown = rankedAsShown(est, w, list, estimated);
    const fig = (kind: Kind, truth: number, floor: number) =>
      industryFigure(est, estimated, id, kind, truth, floor);
    const fringe = fringeSupply(ind.fringe_assets, ind.params.asset_turnover);
    const supply = fig({ kind: "Supply" }, ind.supply, ESTIMATE_FLOOR_USD);
    let named = 0;
    for (const [, r] of list) named += r;
    return {
      id,
      key: ind.key,
      name: ind.name,
      sector: ind.sector,
      demand: ind.demand,
      trend_demand: ind.trend_demand,
      supply,
      // S is the supply band over the demand (D430).
      supply_ratio:
        estimated && ind.demand > 0.0 ? figureOver(supply, ind.demand) : figureExactOf(ind.supply_ratio),
      market_factor: fig({ kind: "MarketFactor" }, ind.market_factor, ESTIMATE_FLOOR_RATIO),
      phase_label: ind.phase_label,
      lt: ind.lt,
      // This quarter's growth a year, `(1 + q_growth)^4 − 1` (spec 8).
      growth_annual: powi(1.0 + ind.q_growth, 4) - 1.0,
      fringe_share: fig(
        { kind: "FringeShare" },
        ind.supply > 0.0 ? fringe / ind.supply : 0.0,
        ESTIMATE_FLOOR_SHARE,
      ),
      named_revenue_m: estimated ? figureSum(shown.map(([, f]) => f)) : figureExactOf(named),
      fringe_revenue_m: fig({ kind: "FringeRevenue" }, ind.fringe_revenue_m, ESTIMATE_FLOOR_USD),
      top_companies: shown.slice(0, TOP_COMPANIES).map(([c]) => c),
      estimated,
    };
  });
  return { rows };
}
