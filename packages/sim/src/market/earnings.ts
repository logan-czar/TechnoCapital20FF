// The earnings jump and result tags (spec 5.15; 21.2, 21.3.1, 21.3.2, 3.3.6): the surprise
// against consensus, the ×1.5 price jump and buzz at 01:00 on release days (4.1 step 3, 4.4), and
// the result types tagged for headlines. Ported from crates/sim/src/market/earnings.rs.
//
// SurpriseTag and ResultTags are in types/state/market.ts.

import { clamp, maxF } from "../types/num.ts";
import type { ResultTags, SurpriseTag } from "../types/state/market.ts";
import { BUZZ_MAX, MIN_PRICE_USD } from "./price.ts";

export type { ResultTags, SurpriseTag };

/** Spec 5.15: a consensus of 0 is treated as $1. */
export const ZERO_CONSENSUS_USD = 1.0;
/** Spec 5.15 (21.3.1): the overreaction factor on the 3.3.6 surprise jump. */
export const OVERREACTION = 1.5;
/** Spec 5.15 (3.3.6): the jump is `0.5 × s`, clamped to ±25%, before the overreaction. */
export const JUMP_PER_SURPRISE = 0.5;
export const JUMP_CLAMP = 0.25;
/** Spec 5.15: `buzz += clamp(20 × s, −30, +30)`. */
export const BUZZ_PER_SURPRISE = 20.0;
export const BUZZ_JUMP_CLAMP = 30.0;
/** Spec 5.15 (21.3.2): Beat above +5%, Big beat above +20%, Miss below −5%, Big miss below −20% (T). */
export const BEAT_ABOVE = 0.05;
export const BIG_BEAT_ABOVE = 0.2;
export const MISS_BELOW = -0.05;
export const BIG_MISS_BELOW = -0.2;

/**
 * The surprise s (spec 5.15): `(actual NI − consensus) ÷ |consensus|`, a consensus of 0 read as
 * $1 in both places.
 */
export function surprise(actualNetIncome: number, consensus: number): number {
  const c = consensus === 0.0 ? ZERO_CONSENSUS_USD : consensus;
  return (actualNetIncome - c) / Math.abs(c);
}

/**
 * The price after the 01:00 jump (spec 5.15): `P × (1 + 1.5 × clamp(0.5 × s, −25%, +25%))`, so
 * at most ±37.5%; never below $0.01.
 */
export function jumpedPrice(p: number, s: number): number {
  return maxF(
    p * (1.0 + OVERREACTION * clamp(JUMP_PER_SURPRISE * s, -JUMP_CLAMP, JUMP_CLAMP)),
    MIN_PRICE_USD,
  );
}

/** Buzz after the jump (spec 5.15, 3.10): `buzz + clamp(20 × s, −30, +30)`, kept in −100 to +100. */
export function jumpedBuzz(buzz: number, s: number): number {
  return clamp(buzz + clamp(BUZZ_PER_SURPRISE * s, -BUZZ_JUMP_CLAMP, BUZZ_JUMP_CLAMP), -BUZZ_MAX, BUZZ_MAX);
}

/**
 * Big beat above +20%, else Beat above +5%; Big miss below −20%, else Miss below −5%; none from
 * −5% to +5% (D249). Rust `SurpriseTag::from_surprise`.
 */
export function surpriseTagFromSurprise(s: number): SurpriseTag | null {
  if (s > BIG_BEAT_ABOVE) return "BigBeat";
  if (s > BEAT_ABOVE) return "Beat";
  if (s < BIG_MISS_BELOW) return "BigMiss";
  if (s < MISS_BELOW) return "Miss";
  return null;
}

/** Rust `SurpriseTag::name`. */
export function surpriseTagName(t: SurpriseTag): string {
  switch (t) {
    case "BigBeat":
      return "Big beat";
    case "Beat":
      return "Beat";
    case "Miss":
      return "Miss";
    case "BigMiss":
      return "Big miss";
  }
}

/** Rust `ResultTags::default()`. */
export function resultTagsDefault(): ResultTags {
  return { surprise: null, loss: false, record_quarter: false };
}

/**
 * True if `revenue` is a Record quarter (spec 21.3.2 "best revenue in the company's history",
 * D249): above 0 and strictly above every earlier quarter kept in the archive (20 quarters,
 * synthetic 2019 quarters included, 4.5 step 2). A company with no earlier quarter has no
 * record; a tie is not a record.
 */
export function isRecordQuarter(revenue: number, earlierQuarterRevenues: readonly number[]): boolean {
  if (!(revenue > 0.0) || earlierQuarterRevenues.length === 0) return false;
  for (const r of earlierQuarterRevenues) if (!(revenue > r)) return false;
  return true;
}

/**
 * Tags a report (spec 5.15, 21.3.2) from the surprise, the quarter's net income and revenue and
 * the earlier quarters' revenues (oldest first, as the archive keeps them).
 */
export function resultTags(
  s: number,
  netIncome: number,
  revenue: number,
  earlierQuarterRevenues: readonly number[],
): ResultTags {
  return {
    surprise: surpriseTagFromSurprise(s),
    loss: netIncome < 0.0,
    record_quarter: isRecordQuarter(revenue, earlierQuarterRevenues),
  };
}
