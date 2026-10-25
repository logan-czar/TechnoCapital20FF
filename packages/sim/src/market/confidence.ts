// Zone exchange investor confidence (spec 5.1.2; batch 157, 2a; 3-markets 3.3.5; C27): once a
// day at 00:00 (4.2 step 6), `confidence_z = clamp(0.9 × confidence_z + 3 × r_z + news_z,
// −100, +100)`, with r_z the headline index's return that day in % and news_z the points of
// that day's Pdoomberg Wire headlines (5.18) on companies listed on the exchange. Ported from
// crates/sim/src/market/confidence.rs.

import { clamp } from "../types/num.ts";
import { CONFIDENCE_SCALE } from "./fair_value.ts";

/** Spec 5.1.2: 0.9 keeps 90% a day, the 10% daily decay toward 0 of 3.3.5. */
export const CONFIDENCE_RETAIN = 0.9;
/** Spec 5.1.2: 3 points per 1% of headline index return. */
export const POINTS_PER_INDEX_PERCENT = 3.0;
/** Spec 5.1.2 headline points (T). */
export const BIG_BEAT_POINTS = 4.0;
export const BEAT_POINTS = 2.0;
export const MISS_POINTS = -2.0;
export const BIG_MISS_POINTS = -4.0;
export const BANKRUPTCY_POINTS = -5.0;
export const RATING_CHANGE_POINTS = 3.0;
/** Spec 5.1.2, 5.18: a rating change counts at 2 or more notches. */
export const RATING_CHANGE_MIN_NOTCHES = 2;
/**
 * Below this magnitude confidence reads exactly 0 (D251), so a zone with no news decays to 0
 * (build-plan M5.7) rather than approaching it forever; it shows as 0.00.
 */
export const CONFIDENCE_ZERO_BELOW = 0.005;

/**
 * A Pdoomberg Wire headline that moves its exchange's confidence (spec 5.1.2, 5.18). A rating
 * change carries `notches` (above 0 an upgrade, below 0 a downgrade); it counts only at 2 or
 * more notches either way.
 */
export type ConfidenceHeadline =
  | { kind: "BigBeat" }
  | { kind: "Beat" }
  | { kind: "Miss" }
  | { kind: "BigMiss" }
  | { kind: "Bankruptcy" }
  | { kind: "RatingChange"; notches: number };

/**
 * Points (spec 5.1.2): Big beat +4, Beat +2, Miss −2, Big miss −4, bankruptcy −5, a rating
 * change of 2+ notches +3 up or −3 down; any other rating change 0. Rust
 * `ConfidenceHeadline::points`.
 */
export function confidenceHeadlinePoints(h: ConfidenceHeadline): number {
  switch (h.kind) {
    case "BigBeat":
      return BIG_BEAT_POINTS;
    case "Beat":
      return BEAT_POINTS;
    case "Miss":
      return MISS_POINTS;
    case "BigMiss":
      return BIG_MISS_POINTS;
    case "Bankruptcy":
      return BANKRUPTCY_POINTS;
    case "RatingChange":
      return Math.abs(h.notches) >= RATING_CHANGE_MIN_NOTCHES
        ? RATING_CHANGE_POINTS * Math.sign(h.notches)
        : 0.0;
  }
}

/** news_z (spec 5.1.2): the sum of the day's headline points. */
export function newsPoints(headlines: readonly ConfidenceHeadline[]): number {
  let sum = 0.0;
  for (const h of headlines) sum += confidenceHeadlinePoints(h);
  return sum;
}

/**
 * One day's confidence update (spec 5.1.2): `clamp(0.9 × c + 3 × r + news, −100, +100)`, with
 * `indexReturnPct` the headline index's return in % (0 for an exchange with no listed company);
 * a result under 0.005 in magnitude is 0 (D251).
 */
export function updateConfidence(confidence: number, indexReturnPct: number, news: number): number {
  const c = clamp(
    CONFIDENCE_RETAIN * confidence + POINTS_PER_INDEX_PERCENT * indexReturnPct + news,
    -CONFIDENCE_SCALE,
    CONFIDENCE_SCALE,
  );
  return Math.abs(c) < CONFIDENCE_ZERO_BELOW ? 0.0 : c;
}
