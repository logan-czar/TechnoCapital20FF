// v_projection: `get_company_projection(id)` (spec 9.2: locked plan, projection range, consensus;
// 8 Financials Quarter view). Rebuilt daily (spec 9.4, 4.2 step 4 "projection ranges refreshed").
// Ported from crates/sim/src/views/projection.rs; the types are in types/views/projection.ts.
//
// The observer never sees a plan, so the range is the 5.16 range at today's share of the quarter
// elapsed, ×2 for a secret plan and centred on the consensus (D252); it narrows as the quarter
// passes and never goes under ±3%. The plan itself shows only in Omniscient. A private company's
// or new listing's consensus and range ends are estimate bands (D420).

import { companyStatusIsFrozen } from "../finance/distress.ts";
import { companyFinanceStatus } from "../finance/state.ts";
import { elapsedShare, RANGE_VIEWER_OBSERVER, range, rangeWidth } from "../market/projection.ts";
import { dateTimeDate, simDateQuarter } from "../time/calendar.ts";
import type { Quarter } from "../types/calendar.ts";
import type { CompanyId } from "../types/ids.ts";
import { ESTIMATE_FLOOR_USD, type Estimator, type Figure } from "../types/views/estimate.ts";
import type { ProjectionRow, ProjectionView } from "../types/views/projection.ts";
import { estimatorBanded, estimatorOfPeriod, figureMap, viewInputEstimator } from "./estimate.ts";
import type { ViewInput } from "./index.ts";

/** `get_company_projection(id)`: the rows are in id order (a binary search). */
export function projectionViewGet(v: ProjectionView, id: CompanyId): ProjectionRow | undefined {
  let lo = 0;
  let hi = v.companies.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const r = v.companies[mid]!;
    if (r.id === id) return r;
    if (r.id < id) lo = mid + 1;
    else hi = mid;
  }
  return undefined;
}

/**
 * A company's consensus for quarter `q` as every view shows it (v_projection, v_recap; D429): one
 * estimate of the figure for the quarter.
 */
export function consensusFigure(
  est: Estimator,
  banded: boolean,
  id: CompanyId,
  q: Quarter,
  truth: number,
): Figure {
  return estimatorOfPeriod(
    est,
    banded,
    { kind: "Company", company: id },
    { kind: "Consensus" },
    { kind: "Quarter", quarter: q },
    truth,
    ESTIMATE_FLOOR_USD,
  );
}

/**
 * The shown range's ends (5.16) of a consensus figure, derived from its band (D430): `range()` is
 * increasing in the consensus at any width under 1, so the true ends stay inside.
 */
export function rangeOf(consensus: Figure, width: number): [Figure, Figure] {
  return [figureMap(consensus, (x) => range(x, width)[0]), figureMap(consensus, (x) => range(x, width)[1])];
}

/** Rust `ViewData::build`. */
export function buildProjection(input: ViewInput): ProjectionView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const elapsed = elapsedShare(w.clock);
  const width = rangeWidth(elapsed, RANGE_VIEWER_OBSERVER);
  const quarter = simDateQuarter(dateTimeDate(w.clock));
  const companies: ProjectionRow[] = [];
  w.companies.forEach((c, i) => {
    if (companyStatusIsFrozen(companyFinanceStatus(c.finance))) return;
    const id = i as CompanyId;
    const banded = estimatorBanded(est, w, id);
    const consensus_ni = consensusFigure(est, banded, id, quarter, w.market.stocks[id]!.consensus_ni);
    companies.push({
      id,
      consensus_ni,
      range: rangeOf(consensus_ni, width),
      width,
      plan: input.controls.omniscient && c.plan !== null ? structuredClone(c.plan) : null,
    });
  });
  return { elapsed_share: elapsed, companies };
}
