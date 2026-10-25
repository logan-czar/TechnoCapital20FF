// v_recap: `get_recap(quarter, scope)` (spec 9.2; 8 Quarterly recap: the world page and the
// watchlist companies' pages; m9-plan section 1: past recaps by quarter). Rebuilt quarterly (spec
// 9.4) and after a control (the watchlist). Ported from crates/sim/src/views/recap.rs; the types
// are in types/views/recap.ts.
//
// Each recap is built at the start of its pre-quarter-end week (`recap/jobs`) and the World keeps
// the last 20 (D433). The view copies their pages with each money figure as a `Figure`: a company
// that does not publish shows its consensus and projection as its one estimate of each for the
// quarter (the consensus is v_projection's), the anticipated range as `range()` of the consensus
// band, and the expected surprise and reaction worked out from the two estimates (D420, D430), so
// the true recap never reaches a screen. Confidence and the outlook are shown as they are.

import { jumpedPrice, surprise } from "../market/earnings.ts";
import { elapsedShare, RANGE_VIEWER_OBSERVER, rangeWidth } from "../market/projection.ts";
import { recapTick } from "../time/quarter.ts";
import { type Quarter, quarterEq } from "../types/calendar.ts";
import type { CompanyId } from "../types/ids.ts";
import type { CompanyRecap, ExpectedResult, Recap } from "../types/state/recap.ts";
import { ESTIMATE_FLOOR_USD, type Estimator } from "../types/views/estimate.ts";
import type { ExpectedRow, RecapPage, RecapQuarter, RecapView } from "../types/views/recap.ts";
import type { World } from "../types/world.ts";
import {
  estimatorBanded,
  estimatorOfPeriod,
  figureExactOf,
  figureShown,
  viewInputEstimator,
} from "./estimate.ts";
import type { ViewInput } from "./index.ts";
import { consensusFigure, rangeOf } from "./projection.ts";

/** A company's page (Rust `RecapQuarter::company`; the pages are in id order, a binary search). */
export function recapQuarterCompany(r: RecapQuarter, id: CompanyId): RecapPage | undefined {
  let lo = 0;
  let hi = r.companies.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const p = r.companies[mid]!;
    if (p.company === id) return p;
    if (p.company < id) lo = mid + 1;
    else hi = mid;
  }
  return undefined;
}

/** The latest recap. */
export function recapViewLatest(v: RecapView): RecapQuarter | null {
  return v.recaps.at(-1) ?? null;
}

/** `get_recap(quarter, world)`: the recap of quarter `q`. */
export function recapViewQuarter(v: RecapView, q: Quarter): RecapQuarter | undefined {
  return v.recaps.find((r) => quarterEq(r.world.quarter, q));
}

/** `get_recap(company)`: a company's page in the latest recap. */
export function recapViewCompany(v: RecapView, id: CompanyId): RecapPage | undefined {
  const latest = recapViewLatest(v);
  return latest === null ? undefined : recapQuarterCompany(latest, id);
}

/**
 * The expected result as shown (D430): the consensus and projection estimates, and the surprise
 * worked out from them.
 */
function expectedRow(est: Estimator, w: World, q: Quarter, e: ExpectedResult): ExpectedRow {
  const banded = estimatorBanded(est, w, e.company);
  const consensus = consensusFigure(est, banded, e.company, q, e.consensus);
  const projection = estimatorOfPeriod(
    est,
    banded,
    { kind: "Company", company: e.company },
    { kind: "Projection" },
    { kind: "Quarter", quarter: q },
    e.projection,
    ESTIMATE_FLOOR_USD,
  );
  return {
    company: e.company,
    projection,
    consensus,
    expected_surprise: banded
      ? surprise(figureShown(projection), figureShown(consensus))
      : e.expected_surprise,
  };
}

function page(est: Estimator, w: World, width: number, p: CompanyRecap): RecapPage {
  const banded = estimatorBanded(est, w, p.company);
  const expected = expectedRow(est, w, p.quarter, p.expected);
  return {
    company: p.company,
    quarter: p.quarter,
    range: banded
      ? rangeOf(expected.consensus, width)
      : [figureExactOf(p.range[0]), figureExactOf(p.range[1])],
    expected,
    expected_reaction: banded ? jumpedPrice(1.0, expected.expected_surprise) - 1.0 : p.expected_reaction,
    confidence_factor: p.confidence_factor,
    exchange_confidence: p.exchange_confidence,
    outlook: structuredClone(p.outlook),
    estimated: banded,
  };
}

function recapQuarter(est: Estimator, w: World, recap: Recap): RecapQuarter {
  const r = recap.world;
  // The observer's 5.16 width at the recap tick, as the recap used (D252).
  const width = rangeWidth(elapsedShare(recapTick(r.quarter)), RANGE_VIEWER_OBSERVER);
  const rows = (list: readonly ExpectedResult[]): ExpectedRow[] =>
    list.map((e) => expectedRow(est, w, r.quarter, e));
  return {
    world: {
      quarter: r.quarter,
      phase: r.phase,
      g_t: r.g_t,
      industries_by_label: r.industries_by_label.map(([l, ids]) => [l, ids.slice()]),
      expected_beats: rows(r.expected_beats),
      expected_misses: rows(r.expected_misses),
    },
    companies: recap.companies.map((p) => page(est, w, width, p)),
  };
}

/** Rust `ViewData::build`. */
export function buildRecap(input: ViewInput): RecapView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const recaps = w.recaps.map((r) => recapQuarter(est, w, r));
  const last = recaps.at(-1);
  const watchlist =
    last === undefined
      ? []
      : last.companies.map((p) => p.company).filter((id) => input.controls.watchlist.has(id));
  return { recaps, watchlist };
}
