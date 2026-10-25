// Raising money in cash-burning industries (spec 6.6; Logan, batch 146). **Parked for the MVP**
// (batch 148): no industry is flagged `cash_burning` in industries.csv, so `raisePlan` returns
// null for every company with the real data. It runs at the plan lock after 6.2 to 6.4 and before
// 6.5, for Active and Distressed companies, one try per lock. Ported from
// crates/sim/src/ai/raise.rs.
//
// RaiseMethod is in types/state/ai.ts.

import { creditLineAvailable, ownCash } from "../finance/credit.ts";
import { ratingFactor } from "../finance/rating.ts";
import { PRIVATE_DISCOUNT } from "../market/fair_value.ts";
import type { DrawSource } from "../types/draws.ts";
import { clamp, maxF, minF, toU64Sat } from "../types/num.ts";
import type { RaiseMethod } from "../types/state/ai.ts";
import type { CompanyStatus, CreditLine, Rating } from "../types/state/finance.ts";
import type { PhaseLabel } from "../types/world.ts";

export type { RaiseMethod };

/** Spec 6.6: a raise starts when runway falls under 4 quarters (T). */
export const RUNWAY_TRIGGER_QUARTERS = 4.0;
/** Spec 6.6: the target is enough for 8 quarters of runway (T). */
export const TARGET_RUNWAY_QUARTERS = 8.0;
/** Spec 6.6 (3.4.3): issue discount 4% for large caps (market value $10B and up, A) ... */
export const LARGE_CAP_USD = 10.0e9;
export const LARGE_CAP_DISCOUNT = 0.04;
/** ... and 8% for small caps (T); private placements take 8% off the shown value too. */
export const SMALL_CAP_DISCOUNT = 0.08;
/** Spec 6.6 (3.4.3): fees 3% of the gross raise (T). */
export const ISSUE_FEE = 0.03;
/** Spec 6.6: new shares capped at 20% of shares_out per raise (A). */
export const MAX_NEW_SHARE_FRACTION = 0.2;
/** Spec 6.6 (3.4.3): announcement effect `P ×= 1 − (2% + 0.5 × dilution%)`. */
export const ANNOUNCEMENT_BASE = 0.02;
export const ANNOUNCEMENT_DILUTION_WEIGHT = 0.5;
/**
 * Spec 6.6 success roll (T): `50% + 100 × (confidence factor − 1) + news adj + method adj − 10% ×
 * consecutive failed raises`, clamped 5% to 95%.
 */
export const BASE_CHANCE = 0.5;
export const FAILED_RAISE_PENALTY = 0.1;
export const MIN_CHANCE = 0.05;
export const MAX_CHANCE = 0.95;
/** News adj by the industry's phase label (T). */
export const NEWS_ADJ_BOOM = 0.3;
export const NEWS_ADJ_NORMAL = 0.0;
export const NEWS_ADJ_GLUT = -0.15;
export const NEWS_ADJ_BUST = -0.35;
/** Method adj (T): credit line +20 pp, share issue 0. */
export const METHOD_ADJ_LINE = 0.2;
export const METHOD_ADJ_SHARES = 0.0;

/** What the raise rule reads at the lock (spec 6.6). */
export interface RaiseInputs {
  /** industries.csv `cash_burning` of the company's industry; false for all 42 today. */
  cash_burning: boolean;
  status: CompanyStatus;
  /** Last quarter's free cash flow: operating cash less asset purchases (3.9). */
  last_quarter_fcf: number;
  cash: number;
  line: CreditLine;
  rating: Rating;
  listed: boolean;
  /** Share price P (listed). */
  price: number;
  /** Whole number (u64). */
  shares_out: number;
  /** Fair value per share V (5.13); a private company places at `0.7 × V` less 8%. */
  value_per_share: number;
  /** The company's confidence factor (5.7), 0.8 to 1.2. */
  confidence_factor: number;
  label: PhaseLabel;
  /** Consecutive failed raises before this one (u32). */
  failed_raises: number;
}

/** A raise attempt (spec 6.6), before its success roll. */
export interface RaisePlan {
  /** Minus last quarter's free cash flow, USD. */
  burn: number;
  /** `own cash ÷ burn`, quarters. */
  runway_quarters: number;
  /** `8 × burn − own cash`, USD (the net amount wanted, D266). */
  target: number;
  method: RaiseMethod;
  /** New shares (share issue only; u64). */
  new_shares: number;
  /** Price per new share (share issue only). */
  issue_price: number;
  /** Gross raise, USD (the target for a line draw). */
  gross: number;
  /** Fees, USD (0 for a line draw). */
  fees: number;
  /** Cash raised net of fees, USD. */
  net: number;
  /** Share price after the announcement (listed share issues); P otherwise. */
  price_after: number;
  /** Success chance, 5% to 95%. */
  chance: number;
}

/** News adj (spec 6.6) by phase label. */
export function newsAdj(label: PhaseLabel): number {
  switch (label) {
    case "Boom":
      return NEWS_ADJ_BOOM;
    case "Normal":
      return NEWS_ADJ_NORMAL;
    case "Glut":
      return NEWS_ADJ_GLUT;
    case "Bust":
      return NEWS_ADJ_BUST;
  }
}

/** The success chance (spec 6.6 success roll). */
export function successChance(
  confidence_factor: number,
  label: PhaseLabel,
  method: RaiseMethod,
  failed_raises: number,
): number {
  const method_adj = method === "CreditLine" ? METHOD_ADJ_LINE : METHOD_ADJ_SHARES;
  return clamp(
    BASE_CHANCE +
      (confidence_factor - 1.0) +
      newsAdj(label) +
      method_adj -
      FAILED_RAISE_PENALTY * failed_raises,
    MIN_CHANCE,
    MAX_CHANCE,
  );
}

/**
 * The raise the company would try (spec 6.6), or null: not a cash-burning industry (every
 * industry with today's data), not Active or Distressed, no burn, or a runway of 4 quarters or
 * more. Method: a line draw of the target when rated B or better (rating factor above 0) and the
 * undrawn line covers it; else a share issue: listed at `P × (1 − 4% or 8%)` with the
 * announcement effect, private at `0.7 × V × (1 − 8%)` with none; new shares enough to net the
 * target after 3% fees, capped at 20% of shares_out (D266).
 */
export function raisePlan(i: RaiseInputs): RaisePlan | null {
  if (!i.cash_burning || !(i.status === "Active" || i.status === "Distressed") || i.last_quarter_fcf >= 0.0) {
    return null;
  }
  const burn = -i.last_quarter_fcf;
  const own = ownCash(i.cash, i.line.drawn);
  const runway = own / burn;
  if (runway >= RUNWAY_TRIGGER_QUARTERS) return null;
  const target = TARGET_RUNWAY_QUARTERS * burn - own;
  if (ratingFactor(i.rating) > 0.0 && creditLineAvailable(i.line) >= target) {
    return {
      burn,
      runway_quarters: runway,
      target,
      method: "CreditLine",
      new_shares: 0,
      issue_price: 0.0,
      gross: target,
      fees: 0.0,
      net: target,
      price_after: i.price,
      chance: successChance(i.confidence_factor, i.label, "CreditLine", i.failed_raises),
    };
  }
  let issue_price: number;
  if (i.listed) {
    const market_value = i.price * i.shares_out;
    const discount = market_value >= LARGE_CAP_USD ? LARGE_CAP_DISCOUNT : SMALL_CAP_DISCOUNT;
    issue_price = i.price * (1.0 - discount);
  } else {
    issue_price = PRIVATE_DISCOUNT * i.value_per_share * (1.0 - SMALL_CAP_DISCOUNT);
  }
  const cap = toU64Sat(Math.floor(MAX_NEW_SHARE_FRACTION * i.shares_out));
  const want =
    issue_price > 0.0 ? toU64Sat(maxF(Math.ceil(target / (issue_price * (1.0 - ISSUE_FEE))), 0.0)) : cap;
  const new_shares = minF(want, cap);
  const gross = new_shares * issue_price;
  const fees = ISSUE_FEE * gross;
  let price_after: number;
  if (i.listed && new_shares > 0) {
    const dilution = new_shares / (i.shares_out + new_shares);
    price_after = i.price * (1.0 - (ANNOUNCEMENT_BASE + ANNOUNCEMENT_DILUTION_WEIGHT * dilution));
  } else {
    price_after = i.price;
  }
  return {
    burn,
    runway_quarters: runway,
    target,
    method: "ShareIssue",
    new_shares,
    issue_price,
    gross,
    fees,
    net: gross - fees,
    price_after,
    chance: successChance(i.confidence_factor, i.label, "ShareIssue", i.failed_raises),
  };
}

/**
 * The success roll (spec 6.6): one AI-stream uniform below the chance succeeds (D266). On a
 * failure nothing is raised, the failed count rises and 6.2 holds g at −d_eff until a raise
 * succeeds.
 */
export function rollRaise(plan: RaisePlan, draws: DrawSource): boolean {
  return draws.chance("Ai", plan.chance);
}
