// Credit ratings (spec 5.12; detailed 3-markets-and-fx 3.6.2 to 3.6.4): the notch scale, the
// implied rating from net debt ÷ EBITDA with its adjustments and the sovereign ceiling, the
// starting rating at load (7.1) and the one or two notch move per review. Ported from
// crates/sim/src/finance/rating.rs.
//
// Notches run from AAA (best) to CC (the worst rating 5.12 prices). AA to B carry plus and minus
// notches (3.6.2); CCC and CC have none. The rating factor (credit line limit) and the corporate
// spread are given per band; `ratingBand` maps a notch to its band (D220).
//
// The types (Rating, Band, ImpliedRating, RATING_VALUES) are in types/state/finance.ts. Rust's
// derived `Ord` on Rating is the index in RATING_VALUES (better is smaller).

import type { Band, ImpliedRating, Rating } from "../types/state/finance.ts";
import { RATING_VALUES } from "../types/state/finance.ts";
import { lineRate } from "./credit.ts";

export type { Band, ImpliedRating, Rating };
export { RATING_VALUES };

/** Where a notch sits in its band (spec 3.6.2). */
export type Modifier = "Plus" | "Flat" | "Minus";

/** Rust `Rating::ALL`: every notch, best first (spec 3.6.2 scale, AAA to CC). */
export const RATING_ALL: readonly Rating[] = RATING_VALUES;
/** The best notch. */
export const RATING_BEST: Rating = "Aaa";
/**
 * The worst notch the MVP uses: the implied table bottoms at CC and 5.12 prices no lower band
 * (D220).
 */
export const RATING_WORST: Rating = "Cc";

/** Position on the scale, 0 for AAA, one per notch worse (Rust `Rating::notch`). */
export function ratingNotch(r: Rating): number {
  return RATING_VALUES.indexOf(r);
}

/** The rating at scale position `i`, clamped to AAA to CC (Rust `Rating::from_notch`). */
export function ratingFromNotch(i: number): Rating {
  const last = RATING_VALUES.length - 1;
  return RATING_VALUES[Math.min(Math.max(i, 0), last)] as Rating;
}

/**
 * This rating moved `notches` better (positive) or worse (negative), clamped to the scale
 * (Rust `Rating::shifted`).
 */
export function ratingShifted(r: Rating, notches: number): Rating {
  return ratingFromNotch(ratingNotch(r) - notches);
}

/**
 * The band whose rating factor and spread this notch reads (D220): AA+, AA and AA- read AA, BB+
 * and BB- read BB, and so on (Rust `Rating::band`).
 */
export function ratingBand(r: Rating): Band {
  switch (r) {
    case "Aaa":
      return "Aaa";
    case "AaPlus":
    case "Aa":
    case "AaMinus":
      return "Aa";
    case "APlus":
    case "A":
    case "AMinus":
      return "A";
    case "BbbPlus":
    case "Bbb":
    case "BbbMinus":
      return "Bbb";
    case "BbPlus":
    case "Bb":
    case "BbMinus":
      return "Bb";
    case "BPlus":
    case "B":
    case "BMinus":
      return "B";
    case "Ccc":
      return "Ccc";
    case "Cc":
      return "Cc";
  }
}

/** Plus, flat or minus within the band (spec 3.6.2; Rust `Rating::modifier`). */
export function ratingModifier(r: Rating): Modifier {
  switch (r) {
    case "AaPlus":
    case "APlus":
    case "BbbPlus":
    case "BbPlus":
    case "BPlus":
      return "Plus";
    case "AaMinus":
    case "AMinus":
    case "BbbMinus":
    case "BbMinus":
    case "BMinus":
      return "Minus";
    default:
      return "Flat";
  }
}

/** The agency label, as country-economy.csv writes it ("BB+"; Rust `Rating::label`). */
export function ratingLabel(r: Rating): string {
  switch (r) {
    case "Aaa":
      return "AAA";
    case "AaPlus":
      return "AA+";
    case "Aa":
      return "AA";
    case "AaMinus":
      return "AA-";
    case "APlus":
      return "A+";
    case "A":
      return "A";
    case "AMinus":
      return "A-";
    case "BbbPlus":
      return "BBB+";
    case "Bbb":
      return "BBB";
    case "BbbMinus":
      return "BBB-";
    case "BbPlus":
      return "BB+";
    case "Bb":
      return "BB";
    case "BbMinus":
      return "BB-";
    case "BPlus":
      return "B+";
    case "B":
      return "B";
    case "BMinus":
      return "B-";
    case "Ccc":
      return "CCC";
    case "Cc":
      return "CC";
  }
}

/** Parses a label ("A+", "CCC"); null for anything off the AAA to CC scale (Rust `Rating::parse`). */
export function ratingParse(label: string): Rating | null {
  for (const r of RATING_VALUES) {
    if (ratingLabel(r) === label) return r;
  }
  return null;
}

/** The next better band, if any (Rust `Band::better`). */
function bandBetter(b: Band): Band | null {
  switch (b) {
    case "Aaa":
      return null;
    case "Aa":
      return "Aaa";
    case "A":
      return "Aa";
    case "Bbb":
      return "A";
    case "Bb":
      return "Bbb";
    case "B":
      return "Bb";
    case "Ccc":
      return "B";
    case "Cc":
      return "Ccc";
  }
}

/** The next worse band, if any (CC is the last the MVP prices; Rust `Band::worse`). */
function bandWorse(b: Band): Band | null {
  switch (b) {
    case "Aaa":
      return "Aa";
    case "Aa":
      return "A";
    case "A":
      return "Bbb";
    case "Bbb":
      return "Bb";
    case "Bb":
      return "B";
    case "B":
      return "Ccc";
    case "Ccc":
      return "Cc";
    case "Cc":
      return null;
  }
}

/** Spec 5.12 rating factors (T). */
export const RATING_FACTOR_AAA = 1.0;
export const RATING_FACTOR_AA = 0.9;
export const RATING_FACTOR_A = 0.8;
export const RATING_FACTOR_BBB = 0.65;
export const RATING_FACTOR_BB = 0.5;
export const RATING_FACTOR_B = 0.3;
export const RATING_FACTOR_CCC_AND_BELOW = 0.0;

/** Spec 5.12 corporate spreads by band (3.6.2 5-year spreads), fractions. */
export const SPREAD_AAA = 0.004;
export const SPREAD_AA = 0.006;
export const SPREAD_A = 0.009;
export const SPREAD_BBB = 0.015;
export const SPREAD_BB = 0.028;
export const SPREAD_B = 0.045;
export const SPREAD_CCC = 0.09;
export const SPREAD_CC = 0.16;
/**
 * Spec 3.6.2: a plus notch is a third of the way toward the better band's spread, a minus a third
 * toward the worse one's (D220).
 */
export const NOTCH_SPREAD_SHARE = 1.0 / 3.0;

/**
 * Credit line rating factor (spec 5.12, T): AAA 1.0, AA 0.9, A 0.8, BBB 0.65, BB 0.5, B 0.3, CCC
 * and below 0 (Rust `Band::rating_factor`).
 */
export function bandRatingFactor(b: Band): number {
  switch (b) {
    case "Aaa":
      return RATING_FACTOR_AAA;
    case "Aa":
      return RATING_FACTOR_AA;
    case "A":
      return RATING_FACTOR_A;
    case "Bbb":
      return RATING_FACTOR_BBB;
    case "Bb":
      return RATING_FACTOR_BB;
    case "B":
      return RATING_FACTOR_B;
    case "Ccc":
    case "Cc":
      return RATING_FACTOR_CCC_AND_BELOW;
  }
}

/**
 * Corporate 5-year spread of the band, a fraction (spec 5.12, 3.6.2): AAA 0.40%, AA 0.60%, A
 * 0.90%, BBB 1.50%, BB 2.80%, B 4.50%, CCC 9.00%, CC 16.00% (Rust `Band::corporate_spread`).
 */
export function bandCorporateSpread(b: Band): number {
  switch (b) {
    case "Aaa":
      return SPREAD_AAA;
    case "Aa":
      return SPREAD_AA;
    case "A":
      return SPREAD_A;
    case "Bbb":
      return SPREAD_BBB;
    case "Bb":
      return SPREAD_BB;
    case "B":
      return SPREAD_B;
    case "Ccc":
      return SPREAD_CCC;
    case "Cc":
      return SPREAD_CC;
  }
}

/** Rating factor of a notch: its band's (spec 5.12; D220). */
export function ratingFactor(rating: Rating): number {
  return bandRatingFactor(ratingBand(rating));
}

/**
 * Corporate spread of a notch (spec 5.12, 3.6.2): the band's spread, a plus notch a third of the
 * way to the better band's and a minus a third to the worse band's (D220). BB+ is 2.80% −
 * (2.80% − 1.50%) ÷ 3 ≈ 2.37%; BB- is 2.80% + (4.50% − 2.80%) ÷ 3 ≈ 3.37%.
 */
export function corporateSpread(rating: Rating): number {
  const band = ratingBand(rating);
  const s = bandCorporateSpread(band);
  switch (ratingModifier(rating)) {
    case "Flat":
      return s;
    case "Plus": {
      const b = bandBetter(band);
      return b !== null ? s - (s - bandCorporateSpread(b)) * NOTCH_SPREAD_SHARE : s;
    }
    case "Minus": {
      const b = bandWorse(band);
      return b !== null ? s + (bandCorporateSpread(b) - s) * NOTCH_SPREAD_SHARE : s;
    }
  }
}

/**
 * Spec 5.12 implied rating from net debt ÷ EBITDA: the upper edge of each leverage band and its
 * starting rating. A ratio below the edge takes that rating (lower edges inclusive: 0.5 is AA,
 * 1.0 is A); the last band is closed (8.0 is CCC, "above 8" is CC) (D221).
 */
export const LEVERAGE_BANDS: readonly (readonly [number, Rating])[] = [
  [0.5, "Aaa"],
  [1.0, "Aa"],
  [2.0, "A"],
  [3.0, "Bbb"],
  [4.0, "BbPlus"],
  [5.0, "BbMinus"],
  [6.5, "B"],
  [8.0, "Ccc"],
];
/** Spec 5.12: above 8 or EBITDA negative. */
export const LEVERAGE_WORST: Rating = "Cc";

/** Spec 5.12 adjustments (T), in notches (positive is better). */
export const COVER_HIGH_ABOVE = 10.0;
export const COVER_HIGH_NOTCHES = 1;
export const COVER_LOW_BELOW = 3.0;
export const COVER_LOW_NOTCHES = -1;
export const COVER_VERY_LOW_BELOW = 1.5;
export const COVER_VERY_LOW_NOTCHES = -2;
export const REVENUE_LARGE_ABOVE_USD = 20.0e9;
export const REVENUE_LARGE_NOTCHES = 1;
export const REVENUE_SMALL_BELOW_USD = 500.0e6;
export const REVENUE_SMALL_NOTCHES = -1;
/** Spec 5.12 "utilities +1": the industries.csv ids it covers. */
export const UTILITY_INDUSTRIES: readonly string[] = ["power_utilities"];
export const UTILITY_NOTCHES = 1;
/** Spec 5.12 "mining and shipping -1": the industries.csv ids it covers. */
export const MINING_SHIPPING_INDUSTRIES: readonly string[] = ["mining", "shipping"];
export const MINING_SHIPPING_NOTCHES = -1;
/** Spec 5.12 ceiling: the home sovereign + 1 notch. */
export const CEILING_NOTCHES_ABOVE_SOVEREIGN = 1;
/** Spec 5.12 (3.6.4): the rating moves 1 notch per review toward implied, 2 if 3 or more away. */
export const REVIEW_STEP = 1;
export const REVIEW_BIG_STEP = 2;
export const REVIEW_BIG_GAP = 3;

/**
 * The leverage rating of spec 5.12, before adjustments: from `net_debt ÷ ebitda` (EBITDA = EBIT
 * + depreciation, trailing 4 quarters). Edge cases (D221): EBITDA at or below 0 is CC whatever
 * the net debt (5.12 "EBITDA negative", with 0 counted as negative, since nothing covers the
 * debt); net debt at or below 0 with positive EBITDA (net cash) is AAA on purpose, as the ratio
 * is below 0.5, and is decided here explicitly rather than by the sign of the division.
 */
export function leverageRating(net_debt: number, ebitda: number): Rating {
  if (ebitda <= 0.0 || !Number.isFinite(ebitda)) return LEVERAGE_WORST;
  if (net_debt <= 0.0) return "Aaa";
  const ratio = net_debt / ebitda;
  const last = LEVERAGE_BANDS.length - 1;
  for (let i = 0; i < LEVERAGE_BANDS.length; i++) {
    const [edge, rating] = LEVERAGE_BANDS[i] as readonly [number, Rating];
    if (ratio < edge || (i === last && ratio <= edge)) return rating;
  }
  return LEVERAGE_WORST;
}

/**
 * Interest cover notches (spec 5.12; cover is EBITDA ÷ interest, 3.6.3): above 10 +1, below 3 -1,
 * below 1.5 -2. With no interest (D222) the cover is unbounded: +1 when EBITDA is above 0, and 0
 * when it is not (nothing to cover, and the CC leverage rating already applies).
 */
export function coverNotches(ebitda: number, interest: number): number {
  if (interest <= 0.0) return ebitda > 0.0 ? COVER_HIGH_NOTCHES : 0;
  const cover = ebitda / interest;
  if (cover > COVER_HIGH_ABOVE) return COVER_HIGH_NOTCHES;
  if (cover < COVER_VERY_LOW_BELOW) return COVER_VERY_LOW_NOTCHES;
  if (cover < COVER_LOW_BELOW) return COVER_LOW_NOTCHES;
  return 0;
}

/** Revenue notches (spec 5.12): trailing revenue above $20B +1, below $500M -1. */
export function sizeNotches(revenue: number): number {
  if (revenue > REVENUE_LARGE_ABOVE_USD) return REVENUE_LARGE_NOTCHES;
  if (revenue < REVENUE_SMALL_BELOW_USD) return REVENUE_SMALL_NOTCHES;
  return 0;
}

/**
 * Sector notches (spec 5.12): utilities +1; mining and shipping -1. `industry_key` is the
 * industries.csv id.
 */
export function sectorNotches(industry_key: string): number {
  if (UTILITY_INDUSTRIES.includes(industry_key)) return UTILITY_NOTCHES;
  if (MINING_SHIPPING_INDUSTRIES.includes(industry_key)) return MINING_SHIPPING_NOTCHES;
  return 0;
}

/** The ceiling (spec 5.12): the HQ country's sovereign rating + 1 notch. */
export function sovereignCeiling(sovereign: Rating): Rating {
  return ratingShifted(sovereign, CEILING_NOTCHES_ABOVE_SOVEREIGN);
}

/** What the implied rating reads (spec 5.12). Trailing figures are the last 4 quarters. */
export interface RatingInputs {
  /** Credit line drawn less cash. */
  net_debt: number;
  /** EBIT + depreciation, trailing 4 quarters. */
  ebitda: number;
  /** Interest on the drawn line, trailing 4 quarters (not the undrawn fee, D222). */
  interest: number;
  /** Revenue, trailing 4 quarters. */
  revenue: number;
  /** industries.csv id of the company's industry. */
  industry_key: string;
  /** The HQ country's sovereign rating (country-economy.csv). */
  sovereign: Rating;
}

/**
 * The implied rating (spec 5.12, 3.6.3): the leverage rating, plus the adjustments summed and
 * then clamped to the scale (D221), capped at the sovereign ceiling.
 */
export function impliedRating(i: RatingInputs): ImpliedRating {
  const leverage = leverageRating(i.net_debt, i.ebitda);
  const cover = coverNotches(i.ebitda, i.interest);
  const size = sizeNotches(i.revenue);
  const sector = sectorNotches(i.industry_key);
  const adjusted = ratingShifted(leverage, cover + size + sector);
  const ceiling = sovereignCeiling(i.sovereign);
  return {
    leverage,
    cover_notches: cover,
    size_notches: size,
    sector_notches: sector,
    adjusted,
    ceiling,
    // The worse of the two: Rust `adjusted.max(ceiling)` on the derived Ord.
    implied: ratingNotch(adjusted) >= ratingNotch(ceiling) ? adjusted : ceiling,
  };
}

/** What the starting rating reads (spec 7.1: implied from the starting run rate, no smoothing). */
export interface StartRatingInputs {
  cash: number;
  line_drawn: number;
  /** Run-rate EBIT + depreciation, a year. */
  ebitda: number;
  /** Run-rate revenue, a year. */
  revenue: number;
  industry_key: string;
  sovereign: Rating;
  /** World base rate (3.1). */
  base_rate: number;
  /**
   * The company's home spread (5.12, `homeSpread`), read from the zone's **base** credit spread
   * at load, not the effective spread of the Q1 2020 draw (D235).
   */
  home_spread: number;
}

/**
 * The starting rating (spec 7.1, 5.12). The interest cover needs a year of interest, whose rate
 * needs the rating; at load the interest is the drawn line at the rate of the leverage rating
 * (before adjustments), one pass, no iteration (D222).
 */
export function startingRating(i: StartRatingInputs): ImpliedRating {
  const net_debt = i.line_drawn - i.cash;
  const leverage = leverageRating(net_debt, i.ebitda);
  const interest = i.line_drawn * lineRate(i.base_rate, i.home_spread, leverage);
  return impliedRating({
    net_debt,
    ebitda: i.ebitda,
    interest,
    revenue: i.revenue,
    industry_key: i.industry_key,
    sovereign: i.sovereign,
  });
}

/**
 * One review's move toward the implied rating (spec 5.12, 3.6.4): 1 notch, or 2 when 3 or more
 * notches away; never past the implied rating.
 */
export function reviewMove(current: Rating, implied: Rating): Rating {
  const gap = ratingNotch(implied) - ratingNotch(current);
  if (gap === 0) return current;
  const step = Math.abs(gap) >= REVIEW_BIG_GAP ? REVIEW_BIG_STEP : REVIEW_STEP;
  return ratingFromNotch(ratingNotch(current) + Math.sign(gap) * Math.min(step, Math.abs(gap)));
}

/**
 * Notches between two ratings, positive when `to` is better than `from` (for the 2+ notch
 * headline and confidence rules, 5.1.2, 5.18).
 */
export function notchesBetween(from: Rating, to: Rating): number {
  return ratingNotch(from) - ratingNotch(to);
}
