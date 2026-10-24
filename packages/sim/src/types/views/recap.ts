// v_recap (crates/sim/src/views/recap.rs): `get_recap(quarter, scope)` (spec 9.2; 8 Quarterly
// recap: the world page and the watchlist companies' pages; m9-plan section 1: past recaps by
// quarter). Rebuilt quarterly (spec 9.4) and after a control (the watchlist).
//
// Each recap is built at the start of its pre-quarter-end week (`recap::jobs`) and the World
// keeps the last 20 (D433). The view copies their pages with each money figure as a `Figure`: a
// company that does not publish shows its consensus and projection as its one estimate of each
// for the quarter (the consensus is v_projection's), the anticipated range as `range()` of the
// consensus band, and the expected surprise and reaction worked out from the two estimates (D420,
// D430), so the true recap never reaches a screen. Confidence and the outlook are shown as they
// are.
//
// Not ported: RecapQuarter::company, RecapView::latest, ::quarter, ::company, expected_row,
// page, recap_quarter and the `ViewData` build (logic).

import type { Quarter } from "../calendar.ts";
import type { CompanyId, IndustryId } from "../ids.ts";
import type { CyclePhase, PhaseLabel } from "../world.ts";
import type { Figure } from "./estimate.ts";
import type { Outlook } from "./shared.ts";

/** A company's expected result (spec 8 "by projection"; D280) as the observer sees it. */
export interface ExpectedRow {
  company: CompanyId;
  projection: Figure;
  consensus: Figure;
  /**
   * The surprise s the projection would make (5.15), a ratio; from the estimates when the
   * figures are bands.
   */
  expected_surprise: number;
}

/** The world page (spec 8, 21.6.2). */
export interface WorldRecapPage {
  quarter: Quarter;
  phase: CyclePhase;
  g_t: number;
  industries_by_label: [PhaseLabel, IndustryId[]][];
  expected_beats: ExpectedRow[];
  expected_misses: ExpectedRow[];
}

/** A company page (spec 8, 21.6.2). */
export interface RecapPage {
  company: CompanyId;
  quarter: Quarter;
  /** The anticipated earnings range (5.16), low then high. */
  range: [Figure, Figure];
  expected: ExpectedRow;
  /** The expected price move at the release (5.15), a fraction. */
  expected_reaction: number;
  confidence_factor: number;
  exchange_confidence: number | null;
  outlook: Outlook;
  /** The figures are estimate bands (D420). */
  estimated: boolean;
}

/** One quarter's recap. */
export interface RecapQuarter {
  world: WorldRecapPage;
  /** Every company page, in company id order. */
  companies: RecapPage[];
}

export interface RecapView {
  /** The recaps kept, oldest first (D433); empty before the first pre-quarter-end week. */
  recaps: RecapQuarter[];
  /** The watchlist companies with a page in the latest recap, in id order. */
  watchlist: CompanyId[];
}
