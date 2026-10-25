// The quarterly recap (build-plan M6.5, M9.5): the world page and the watchlist company pages,
// built at the start of the pre-quarter-end week. Ported from crates/sim/src/recap.rs (the job is
// ./recap/jobs.ts).
//
// Spec sections: 4.4 row 5, 8 (Quarterly recap), 21.6.2.
//
// Formula half (lane F, F6): the recap's data types and their constructors. World page: the global
// phase and g_t, industries by phase label, and the biggest expected beats and misses by
// projection. Company page: the anticipated earnings range, the expected reaction, confidence and
// the outlook (phase label, losses, rating watch). No guidance choice (8).
//
// The data types and constants are in types/state/recap.ts.

import { ratingNotch } from "./finance/rating.ts";
import { jumpedPrice, surprise } from "./market/earnings.ts";
import { RANGE_VIEWER_OBSERVER, range, rangeWidth } from "./market/projection.ts";
import type { Quarter } from "./types/calendar.ts";
import type { CompanyId, IndustryId } from "./types/ids.ts";
import { totalCmp } from "./types/num.ts";
import type { Rating } from "./types/state/finance.ts";
import {
  type CompanyRecap,
  type ExpectedResult,
  LABEL_ORDER,
  type Outlook,
  type RatingWatch,
  RECAP_TOP,
  type WorldRecap,
} from "./types/state/recap.ts";
import type { CyclePhase, PhaseLabel } from "./types/world.ts";

export type { CompanyRecap, ExpectedResult, Outlook, RatingWatch, WorldRecap };
export { LABEL_ORDER, RECAP_TOP };

/** Rust `ExpectedResult::new`. */
export function expectedResultNew(company: CompanyId, projection: number, consensus: number): ExpectedResult {
  return { company, projection, consensus, expected_surprise: surprise(projection, consensus) };
}

/**
 * Builds the world page (spec 8): `industries` are (industry, label) in id order; `expectations`
 * every listed company's expected result. The five largest expected beats and misses by expected
 * surprise, ties to the lower id (D280).
 */
export function worldRecap(
  quarter: Quarter,
  phase: CyclePhase,
  gT: number,
  industries: readonly (readonly [IndustryId, PhaseLabel])[],
  expectations: readonly ExpectedResult[],
): WorldRecap {
  const industriesByLabel: [PhaseLabel, IndustryId[]][] = LABEL_ORDER.map((l) => {
    const ids = industries.filter(([, x]) => x === l).map(([id]) => id);
    ids.sort((a, b) => a - b);
    return [l, ids];
  });
  const beats = expectations.filter((e) => e.expected_surprise > 0.0);
  beats.sort((a, b) => totalCmp(b.expected_surprise, a.expected_surprise) || a.company - b.company);
  beats.length = Math.min(beats.length, RECAP_TOP);
  const misses = expectations.filter((e) => e.expected_surprise < 0.0);
  misses.sort((a, b) => totalCmp(a.expected_surprise, b.expected_surprise) || a.company - b.company);
  misses.length = Math.min(misses.length, RECAP_TOP);
  return {
    quarter,
    phase,
    g_t: gT,
    industries_by_label: industriesByLabel,
    expected_beats: beats,
    expected_misses: misses,
  };
}

/** The watch from the current and the implied rating (5.12): none when they match. */
export function ratingWatch(current: Rating, implied: Rating): RatingWatch | null {
  // Rating order: Aaa is the smallest, so a smaller implied rating is an upgrade.
  const c = ratingNotch(implied) - ratingNotch(current);
  if (c < 0) return "Upgrade";
  if (c > 0) return "Downgrade";
  return null;
}

/**
 * Builds a company page (spec 8, 21.6.2). The range is the observer's 5.16 range at
 * `elapsedShare`, centred on the consensus (the observer never sees a plan, D252).
 */
export function companyRecap(
  quarter: Quarter,
  expected: ExpectedResult,
  elapsedShare: number,
  confidenceFactor: number,
  exchangeConfidence: number | null,
  outlook: Outlook,
): CompanyRecap {
  const width = rangeWidth(elapsedShare, RANGE_VIEWER_OBSERVER);
  return {
    company: expected.company,
    quarter,
    range: range(expected.consensus, width),
    expected,
    expected_reaction: jumpedPrice(1.0, expected.expected_surprise) - 1.0,
    confidence_factor: confidenceFactor,
    exchange_confidence: exchangeConfidence,
    outlook,
  };
}
