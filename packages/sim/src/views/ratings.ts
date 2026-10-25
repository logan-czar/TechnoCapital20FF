// v_ratings: credit ratings (spec 9.2, Pdoomberg F6 Ratings, spec 8): every company's rating, the
// implied rating with its breakdown (5.12, 3.6.3), the last review's move, the credit line (drawn,
// limit, rate, home spread) and the distress state. Rebuilt quarterly (spec 9.4), so it shows the
// 01:00 release-day review once it has run, and when Omniscient is toggled (D423). A private
// company's or new listing's line drawn and limit are estimate bands (D420); its rating is
// published (F6 shows every rating, D157). Ported from crates/sim/src/views/ratings.rs; the types
// and `BANDS` are in types/views/ratings.ts.

import { lineRate } from "../finance/credit.ts";
import { companyStatusIsFrozen } from "../finance/distress.ts";
import { companyHomeSpread } from "../finance/jobs.ts";
import { ratingBand } from "../finance/rating.ts";
import { companyFinanceStatus } from "../finance/state.ts";
import type { CompanyId } from "../types/ids.ts";
import { BANDS, type CompanyRating, type RatingsView } from "../types/views/ratings.ts";
import type { Band } from "../types/views/shared.ts";
import { estimatorBanded, estimatorCompanyNow, viewInputEstimator } from "./estimate.ts";
import type { ViewInput } from "./index.ts";

/** Rust `RatingsView::get`. */
export function ratingsViewGet(v: RatingsView, id: CompanyId): CompanyRating | undefined {
  return v.companies[id];
}

/** Companies by rating band, best first, counting those not frozen (Active and Distressed). */
export function ratingsViewBandCounts(v: RatingsView): [Band, number][] {
  return BANDS.map((b): [Band, number] => [
    b,
    v.companies.filter((c) => !companyStatusIsFrozen(c.status) && ratingBand(c.rating) === b).length,
  ]);
}

/** Rust `ViewData::build`. */
export function buildRatings(input: ViewInput): RatingsView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const companies = w.companies.map((c, i): CompanyRating => {
    const id = i as CompanyId;
    const f = c.finance;
    const home = companyHomeSpread(w, c, false);
    const banded = estimatorBanded(est, w, id);
    return {
      id,
      key: c.key,
      rating: f.rating,
      implied: { ...f.implied },
      last_review_notches: f.last_review_notches,
      // The same estimates as v_company_detail's (D429).
      line_drawn: estimatorCompanyNow(
        est,
        banded,
        id,
        { kind: "Line", line: "BalanceLineDrawn" },
        f.line.drawn,
      ),
      line_limit: estimatorCompanyNow(est, banded, id, { kind: "LineLimit" }, f.line.limit),
      line_rate: lineRate(w.base_rate, home, f.rating),
      home_spread: home,
      excess_months_left: f.line.excess_months_left,
      status: companyFinanceStatus(f),
      distress_months: f.distress.distress_months,
      frozen_quarters: f.distress.frozen_quarters,
      bankrupt_on: f.bankrupt_on,
      removed_on: f.removed_on,
    };
  });
  return { companies, base_rate: w.base_rate };
}
