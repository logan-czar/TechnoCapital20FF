// v_industry_detail: `get_industry` (spec 9.2), the spec 8 Industries detail view: the 20-quarter
// history of demand, supply and growth against the long-term rate, the company list and the
// fringe row. Rebuilt monthly and on load (spec 9.4), and when Omniscient is toggled (D423). A
// private company's or new listing's revenue is its one revenue estimate and its share that band
// over the industry's total shown (D429, D430); the list is ranked by the revenue shown, so its
// order cannot give the truth away (D420). An industry estimated by D432 shows its total, fringe
// and history supply as bands, as v_industry_row does. Ported from
// crates/sim/src/views/industry_detail.rs; the types are in types/views/industry_detail.ts.

import { dateTimeMidnight, quarterFirstDay, quarterNext } from "../time/calendar.ts";
import type { IndustryId } from "../types/ids.ts";
import { ESTIMATE_FLOOR_USD } from "../types/views/estimate.ts";
import type { IndustryDetail, IndustryDetailView } from "../types/views/industry_detail.ts";
import { worldIndustryEstimatedAt } from "../world/index.ts";
import { estimatorOfPeriod, figureExactOf, figureRatio, figureSum, viewInputEstimator } from "./estimate.ts";
import type { ViewInput } from "./index.ts";
import { companiesByRevenue, estimatedIndustries, industryFigure, rankedAsShown } from "./industry_rows.ts";

/** Rust `IndustryDetailView::get`. */
export function industryDetailViewGet(v: IndustryDetailView, id: IndustryId): IndustryDetail | undefined {
  return v.industries[id];
}

/** Rust `ViewData::build`. */
export function buildIndustryDetail(input: ViewInput): IndustryDetailView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const ranked = companiesByRevenue(w);
  const classes = estimatedIndustries(est, w);
  const industries = w.industries.map((ind, i): IndustryDetail => {
    const id = i as IndustryId;
    const list = ranked[id]!;
    const estimated = classes[id]!;
    const shown = rankedAsShown(est, w, list, estimated);
    const fringe = industryFigure(
      est,
      estimated,
      id,
      { kind: "FringeRevenue" },
      ind.fringe_revenue_m,
      ESTIMATE_FLOOR_USD,
    );
    // The whole the shares are of: exact, or the sum of what is shown (D432).
    let named = 0;
    for (const [, r] of list) named += r;
    const total = estimated
      ? figureSum([...shown.map(([, f]) => f), fringe])
      : figureExactOf(named + ind.fringe_revenue_m);
    return {
      id,
      history: ind.history.map((h) => ({
        quarter: h.quarter,
        demand: h.demand,
        // A quarter's band follows the class it closed in (D437).
        supply: estimatorOfPeriod(
          est,
          !est.omniscient &&
            worldIndustryEstimatedAt(w, id, dateTimeMidnight(quarterFirstDay(quarterNext(h.quarter)))),
          { kind: "Industry", industry: id },
          { kind: "Supply" },
          { kind: "Quarter", quarter: h.quarter },
          h.supply,
          ESTIMATE_FLOOR_USD,
        ),
        q_growth: h.q_growth,
        lt: h.lt,
      })),
      companies: shown.map(([c, revenue_m]) => ({
        company: c,
        name: w.companies[c]!.name,
        revenue_m,
        share: figureRatio(revenue_m, total),
      })),
      fringe_revenue_m: fringe,
      fringe_share: figureRatio(fringe, total),
      estimated,
    };
  });
  return { industries };
}
