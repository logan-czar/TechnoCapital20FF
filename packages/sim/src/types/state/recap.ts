// The quarterly recap on the World (spec 4.4 row 5, 8 Quarterly recap, 21.6.2; build-plan M6.5,
// M9.5). Ported from crates/sim/src/recap.rs (ExpectedResult, WorldRecap, RatingWatch, Outlook,
// CompanyRecap, RECAP_TOP, LABEL_ORDER) and recap/jobs.rs (Recap, RECAPS_KEPT). Types only.
//
// Not ported (logic): ExpectedResult::new, world_recap, rating_watch, company_recap, recap_job
// and register.

import type { Quarter } from "../calendar.ts";
import type { CompanyId, IndustryId } from "../ids.ts";
import type { CyclePhase, PhaseLabel } from "../world.ts";
import type { Rating } from "./finance.ts";

// ---------------------------------------------------------------- recap.rs

/** Spec 8: the world page lists the biggest expected beats and misses; five of each (D280). */
export const RECAP_TOP = 5;

/** The four labels in the order the world page lists them (5.1). */
export const LABEL_ORDER = ["Boom", "Normal", "Glut", "Bust"] as const satisfies readonly PhaseLabel[];

/**
 * A company's expected result (spec 8 "by projection"; D280): the engine's projection against
 * the consensus set at the lock, and the surprise s it would make (5.15).
 */
export interface ExpectedResult {
  company: CompanyId;
  projection: number;
  consensus: number;
  expected_surprise: number;
}

/** The recap's world page (spec 8, 21.6.2). */
export interface WorldRecap {
  /** The quarter about to end. */
  quarter: Quarter;
  phase: CyclePhase;
  g_t: number;
  /** Industries by phase label, in LABEL_ORDER, each list in id order. */
  industries_by_label: [PhaseLabel, IndustryId[]][];
  /** The largest expected beats, largest first (expected s above 0). */
  expected_beats: ExpectedResult[];
  /** The largest expected misses, worst first (expected s below 0). */
  expected_misses: ExpectedResult[];
}

/**
 * Which way the next rating review points (spec 8 outlook "rating watch"): toward the implied
 * rating when it differs from the current one.
 */
export type RatingWatch = "Upgrade" | "Downgrade";

/**
 * The company outlook (spec 8): its industry's phase label, its loss quarters, its rating and
 * the rating watch.
 */
export interface Outlook {
  label: PhaseLabel;
  /** Whole number (u32). */
  loss_quarters: number;
  rating: Rating;
  rating_watch: RatingWatch | null;
}

/** A watchlist company's recap page (spec 8, 21.6.2). */
export interface CompanyRecap {
  company: CompanyId;
  quarter: Quarter;
  /** The anticipated earnings range (5.16 at this point of the quarter), low then high. */
  range: [number, number];
  expected: ExpectedResult;
  /**
   * The expected price move at the release (5.15): `1.5 × clamp(0.5 × s, ±25%)` of the expected
   * surprise, as a fraction.
   */
  expected_reaction: number;
  /**
   * The company's confidence factor (5.7) and its exchange's confidence (5.1.2; null for a
   * private company).
   */
  confidence_factor: number;
  exchange_confidence: number | null;
  outlook: Outlook;
}

// ---------------------------------------------------------------- recap/jobs.rs

/**
 * The recap the pre-quarter-end week shows (spec 8 Quarterly recap): the world page and one
 * company page for every company not frozen (the view keeps the watchlist's, spec 8).
 */
export interface Recap {
  world: WorldRecap;
  companies: CompanyRecap[];
}

/**
 * Recaps kept on the World, oldest dropped first (D433): 20 quarters, as the statements archive
 * keeps (spec 4.5 step 2).
 */
export const RECAPS_KEPT = 20;
