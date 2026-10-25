// Fair value (spec 5.13; 10.0.8, 3.3.1; conflict C8): normalized earnings, the G, R and X
// factors, the cycle and company confidence factors, the loss-maker path, the book and per-share
// floors, and the private discount. Ported from crates/sim/src/market/fair_value.rs.
//
// The full recalculation at each release builds a FairValueBasis (E_norm and G) from the
// statements; the daily refresh (4.2 step 2) reruns `fairValue` on that basis with the day's
// book equity, cycle label, management confidence, home spread and exchange confidence (D243).
//
// FairValueBasis is in types/state/market.ts.

import { clamp, maxF } from "../types/num.ts";
import type { FairValueBasis } from "../types/state/market.ts";
import type { PhaseLabel } from "../types/world.ts";

export type { FairValueBasis };

/** Spec 5.13 step 1: weight of TTM net income in E_norm. */
export const E_NORM_TTM_WEIGHT = 0.6;
/** Spec 5.13 step 1: weight of forward earnings, `TTM × (1 + g)`, in E_norm. */
export const E_NORM_FORWARD_WEIGHT = 0.4;
/** Spec 5.13 step 1: the 4-quarter revenue growth g is clamped to −30% to +60%. */
export const GROWTH_MIN = -0.3;
export const GROWTH_MAX = 0.6;
/** Spec 5.13 step 2: `G = clamp(1 + 2.5 × (g − g_sector), 0.5, 2.5)`. */
export const G_SLOPE = 2.5;
export const G_MIN = 0.5;
export const G_MAX = 2.5;
/** Spec 5.13 step 2: `R = clamp(9% ÷ (y10 + 5%), 0.4, 1.6)`. */
export const R_NUMERATOR = 0.09;
export const R_YIELD_ADD = 0.05;
export const R_MIN = 0.4;
export const R_MAX = 1.6;
/** Spec 5.13 step 2 (C24): `y10 = 3.5% + home_spread`. */
export const Y10_BASE = 0.035;
/** Spec 5.1.2, 5.13 step 2: `X = 1 + 0.10 × confidence_z ÷ 100` (T). */
export const X_CONFIDENCE_WEIGHT = 0.1;
/** Spec 5.1.2: the confidence scale is −100 to +100. */
export const CONFIDENCE_SCALE = 100.0;
/** Spec 5.13 step 3 (10.0.8): `0.3 × book equity + 0.7 × earnings value`. */
export const BOOK_WEIGHT = 0.3;
export const EARNINGS_WEIGHT = 0.7;
/** Spec 5.13 step 3: cycle factor by the industry's phase label. */
export const CYCLE_FACTOR_BOOM = 1.2;
export const CYCLE_FACTOR_NORMAL = 1.0;
export const CYCLE_FACTOR_GLUT = 0.85;
export const CYCLE_FACTOR_BUST = 0.7;
/** Spec 5.13 step 5 (3.3.1 step 6): floor at 0.6 × book equity, 0.9 for Real estate. */
export const BOOK_FLOOR_SHARE = 0.6;
export const REAL_ESTATE_BOOK_FLOOR_SHARE = 0.9;
/** industries.csv id of the Real estate industry (the 0.9 floor of 5.13 step 5). */
export const REAL_ESTATE_KEY = "real_estate";
/** Spec 5.13 step 5: never below $0.01 per share. */
export const MIN_VALUE_PER_SHARE_USD = 0.01;
/** Spec 5.13 step 6 (10.5.4): private companies show 0.7 × fair value. */
export const PRIVATE_DISCOUNT = 0.7;

/** The quarters of statements kept oldest first, as the archive holds them (4.5 step 2). */
export const QUARTERS_PER_YEAR = 4;

/** g clamped to −30% to +60% (spec 5.13 step 1). */
export function clampGrowth(g: number): number {
  return clamp(g, GROWTH_MIN, GROWTH_MAX);
}

/**
 * The 4-quarter revenue growth g of spec 5.13 step 1, from quarterly revenues oldest first (the
 * archive, synthetic 2019 quarters included), unclamped (D254):
 *
 * - with 8 or more quarters: the last four ÷ the four before − 1 (TTM over the prior TTM);
 * - with 5 to 7: the last `n − 4` quarters ÷ the same quarters a year earlier − 1;
 * - with 4 or fewer there is no year-ago figure and g is 0.
 *
 * A year-ago revenue at or below 0 gives 0 if this year's is also at or below 0, else the top
 * of the clamp (+60%), so a company with no prior revenue never divides by 0.
 */
export function revenueGrowth(quarterRevenues: readonly number[]): number {
  const n = quarterRevenues.length;
  if (n <= QUARTERS_PER_YEAR) return 0.0;
  const k = Math.min(n - QUARTERS_PER_YEAR, QUARTERS_PER_YEAR);
  let now = 0.0;
  for (let i = n - k; i < n; i++) now += quarterRevenues[i] as number;
  let ago = 0.0;
  for (let i = n - k - QUARTERS_PER_YEAR; i < n - QUARTERS_PER_YEAR; i++) ago += quarterRevenues[i] as number;
  if (ago <= 0.0) return now <= 0.0 ? 0.0 : GROWTH_MAX;
  return now / ago - 1.0;
}

/** Normalized earnings (spec 5.13 step 1): `0.6 × TTM + 0.4 × TTM × (1 + g)`, g clamped. */
export function eNorm(ttmNetIncome: number, g: number): number {
  return E_NORM_TTM_WEIGHT * ttmNetIncome + E_NORM_FORWARD_WEIGHT * ttmNetIncome * (1.0 + clampGrowth(g));
}

/**
 * Growth factor (spec 5.13 step 2): `clamp(1 + 2.5 × (g − g_sector), 0.5, 2.5)`, g clamped
 * first; g_sector is the industry's lt (D1).
 */
export function growthFactor(g: number, gSector: number): number {
  return clamp(1.0 + G_SLOPE * (clampGrowth(g) - gSector), G_MIN, G_MAX);
}

/** The 10-year yield (spec 5.13 step 2, C24): `3.5% + home_spread`. */
export function y10(homeSpread: number): number {
  return Y10_BASE + homeSpread;
}

/** Rate factor (spec 5.13 step 2): `clamp(9% ÷ (y10 + 5%), 0.4, 1.6)`. */
export function rateFactor(homeSpread: number): number {
  return clamp(R_NUMERATOR / (y10(homeSpread) + R_YIELD_ADD), R_MIN, R_MAX);
}

/**
 * Exchange confidence factor (spec 5.1.2, 5.13 step 2): `1 + 0.10 × confidence_z ÷ 100` of
 * the listing exchange (0.9 to 1.1); null (a private company, which lists nowhere) is 1.0.
 */
export function exchangeFactor(listingConfidence: number | null): number {
  if (listingConfidence === null) return 1.0;
  return (
    1.0 +
    (X_CONFIDENCE_WEIGHT * clamp(listingConfidence, -CONFIDENCE_SCALE, CONFIDENCE_SCALE)) / CONFIDENCE_SCALE
  );
}

/** Cycle factor (spec 5.13 step 3): Boom 1.2, Normal 1.0, Glut 0.85, Bust 0.7. */
export function cycleFactor(label: PhaseLabel): number {
  switch (label) {
    case "Boom":
      return CYCLE_FACTOR_BOOM;
    case "Normal":
      return CYCLE_FACTOR_NORMAL;
    case "Glut":
      return CYCLE_FACTOR_GLUT;
    case "Bust":
      return CYCLE_FACTOR_BUST;
  }
}

/** Book floor share (spec 5.13 step 5): 0.9 for Real estate, else 0.6. */
export function bookFloorShare(industryKey: string): number {
  return industryKey === REAL_ESTATE_KEY ? REAL_ESTATE_BOOK_FLOOR_SHARE : BOOK_FLOOR_SHARE;
}

/**
 * The basis at a release (spec 5.13 steps 1 and 2): `ttmNetIncome` is the trailing four
 * quarters' net income (finance::statements::trailing_four, annualized `× 4 ÷ n` for a
 * company born in play, null with no quarter, D228), `g` the `revenueGrowth` and
 * `gSector` the industry's lt (D1). Rust `FairValueBasis::at_release`.
 */
export function fairValueBasisAtRelease(
  ttmNetIncome: number | null,
  g: number,
  gSector: number,
): FairValueBasis {
  return {
    e_norm: ttmNetIncome === null ? null : eNorm(ttmNetIncome, g),
    growth_factor: growthFactor(g, gSector),
  };
}

/** What a fair value reads besides its basis (spec 5.13). */
export interface FairValueInputs {
  basis: FairValueBasis;
  /** Book equity (3.5): cash + asset book − line drawn − tax payable (D227), the estate apart (D230). */
  book_equity: number;
  /** M_sector: industries.csv `earnings_multiple`. */
  sector_multiple: number;
  /** The HQ home spread (5.12, D223), a fraction. */
  home_spread: number;
  /** The company's industry phase label (5.1). */
  label: PhaseLabel;
  /** The company's own confidence factor (5.7): `0.8 + score ÷ 250`. */
  company_confidence: number;
  /** The listing exchange's confidence, −100 to +100 (5.1.2); null for a private company. */
  listing_confidence: number | null;
  /** `bookFloorShare` of the company's industry. */
  book_floor_share: number;
  shares_out: number;
}

/**
 * Total fair value (spec 5.13 steps 2 to 5):
 *
 * - profit (E_norm above 0): `(0.3 × book + 0.7 × E_norm × M_sector × G × R × cycle ×
 *   confidence) × X`;
 * - loss (E_norm at or below 0, or no statements, D253): `book × cycle × X`;
 * - then the floors: at least `floor share × book` (a negative book has no book floor, D242)
 *   and at least $0.01 a share.
 */
export function fairValue(i: FairValueInputs): number {
  const x = exchangeFactor(i.listing_confidence);
  const cycle = cycleFactor(i.label);
  const e = i.basis.e_norm;
  let value: number;
  if (e !== null && e > 0.0) {
    const multiple = i.sector_multiple * i.basis.growth_factor * rateFactor(i.home_spread);
    value = (BOOK_WEIGHT * i.book_equity + EARNINGS_WEIGHT * e * multiple * cycle * i.company_confidence) * x;
  } else {
    value = i.book_equity * cycle * x;
  }
  return floored(value, i.book_equity, i.book_floor_share, i.shares_out);
}

/** The 5.13 step 5 floors: `max(value, floor share × max(book, 0), $0.01 × shares_out)` (D242). */
export function floored(
  value: number,
  bookEquity: number,
  bookFloorShareV: number,
  sharesOut: number,
): number {
  return maxF(maxF(value, bookFloorShareV * maxF(bookEquity, 0.0)), MIN_VALUE_PER_SHARE_USD * sharesOut);
}

/** Per-share value V (spec 5.13 step 6): `fair value ÷ shares_out`; 0 with no shares. */
export function perShare(fairValueUsd: number, sharesOut: number): number {
  return sharesOut === 0 ? 0.0 : fairValueUsd / sharesOut;
}

/**
 * The value a company shows (spec 5.13 step 6, 10.5.4): a listed company its fair value, a
 * private one `0.7 × fair value`.
 */
export function shownValue(fairValueUsd: number, listed: boolean): number {
  return listed ? fairValueUsd : PRIVATE_DISCOUNT * fairValueUsd;
}
