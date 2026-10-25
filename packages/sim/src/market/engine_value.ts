// Engine value at load (spec 7.1 Shares row, 5.13; batch 161): the 5.13 fair value of the
// starting run rate, from which company-start.csv `open_price` and `shares` follow
// (docs/design/tools/mvp-data/gen.py builds `engine_value_usd` the same way, D239, D240).
// Ported from crates/sim/src/market/engine_value.rs.
//
// 7.1 reads it with a flat synthetic history (g 0, so G = clamp(1 − 2.5 × lt, 0.5, 2.5) with
// g_sector the industry's lt, D1), a Normal cycle, company confidence 1.0, X from the zone
// `confidence_start` for listed companies (1.0 for private ones), line interest skipped (no
// interest on cash either), the 5.13 book floor (0.9 for Real estate) and at least $100,000
// (D244). It is `fairValue` on that basis, so the load V equals the first-release V when the
// inputs have not moved.

import { maxF } from "../types/num.ts";
import type { PhaseLabel } from "../types/world.ts";
import { fairValue, fairValueBasisAtRelease } from "./fair_value.ts";

/** Spec 7.1: the engine value is floored at $100,000 (the barebones company's one asset). */
export const MIN_ENGINE_VALUE_USD = 100_000.0;
/** Spec 7.1: g is 0 on the flat synthetic history. */
export const LOAD_REVENUE_GROWTH = 0.0;
/** Spec 7.1: a Normal cycle at load. */
export const LOAD_LABEL: PhaseLabel = "Normal";
/** Spec 7.1: company confidence 1.0 at load. */
export const LOAD_COMPANY_CONFIDENCE = 1.0;

/** What the engine value reads for one starting company (spec 7.1). */
export interface EngineValueInputs {
  /** Starting book equity (company-start.csv `book_equity_usd`, D238). */
  book_equity: number;
  /**
   * A year of run-rate EBIT, USD (the 7.1 loadout at productivity 100 and M 1.0 with the load
   * plan, before line interest).
   */
  run_rate_ebit: number;
  /** The HQ country's corporate tax rate (country-economy.csv `corp_tax_rate`). */
  tax_rate: number;
  /** M_sector (industries.csv `earnings_multiple`). */
  sector_multiple: number;
  /** g_sector: the industry's lt at load (industries.csv `trend_growth`, D1). */
  g_sector: number;
  /**
   * The home spread from the zone's base spread and the sovereign spread, rounded to whole bps
   * (finance::credit::home_spread, D223, D235), a fraction.
   */
  home_spread: number;
  /** The zone's `confidence_start` for a listed company; null for a private one. */
  listing_confidence: number | null;
  /** `bookFloorShare` of the industry (0.9 for Real estate). */
  book_floor_share: number;
}

/**
 * Run-rate net income at load (spec 7.1, 5.11): EBIT less tax when above 0, else the loss (no
 * carryforward at load, D228; no line interest, 7.1).
 */
export function loadNetIncome(runRateEbit: number, taxRate: number): number {
  return runRateEbit > 0.0 ? runRateEbit * (1.0 - taxRate) : runRateEbit;
}

/**
 * Engine value at load (spec 7.1, 5.13): `fairValue` with E_norm the run-rate net income at g 0,
 * G at g 0 against the industry's lt, a Normal cycle, confidence 1.0 and X from
 * confidence_start, floored at the 5.13 book floor and then at $100,000. The per-share floor
 * does not apply: shares follow from this value.
 */
export function engineValueAtLoad(i: EngineValueInputs): number {
  const ni = loadNetIncome(i.run_rate_ebit, i.tax_rate);
  const value = fairValue({
    basis: fairValueBasisAtRelease(ni, LOAD_REVENUE_GROWTH, i.g_sector),
    book_equity: i.book_equity,
    sector_multiple: i.sector_multiple,
    home_spread: i.home_spread,
    label: LOAD_LABEL,
    company_confidence: LOAD_COMPANY_CONFIDENCE,
    listing_confidence: i.listing_confidence,
    book_floor_share: i.book_floor_share,
    shares_out: 0,
  });
  return maxF(value, MIN_ENGINE_VALUE_USD);
}
