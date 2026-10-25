// Each startup (spec 5.19.3, A, T): the size cap, the carve from the fringe, stations by the 7.1
// rules, the newborn fixed cost rate, the run rate its rating is implied from, the seed round,
// shares by the 7.1 rule for private companies, the cap table and the archetype. Ported from
// crates/sim/src/births/startup.rs.
//
// RunRate is in types/state/births.ts.

import { archetypeAtLoad, archetypeParams } from "../ai/archetype.ts";
import { monthExpenses, monthExpensesTotal } from "../economy/revenue.ts";
import { fixedCostRateAtLoad, sharedCostsAtLoadHook } from "../economy/start.ts";
import { startingRating } from "../finance/rating.ts";
import { engineValueAtLoad } from "../market/engine_value.ts";
import { computeBill } from "../ops/compute.ts";
import { laborUnits } from "../ops/labor.ts";
import {
  LOADOUT_ENTERPRISE_DIVISOR_TB,
  LOADOUT_ENTERPRISE_SHARE,
  loadoutProductivityStations,
  pcBonus,
  productiveCompute,
  START_PRODUCTIVITY,
  stationsDefault,
} from "../ops/stations.ts";
import { clamp, maxF, minF, roundTiesEven, toU64Sat } from "../types/num.ts";
import type { Archetype } from "../types/state/ai.ts";
import type { RunRate } from "../types/state/births.ts";
import type { Rating } from "../types/state/finance.ts";
import type { Stations } from "../types/state/ops.ts";
import type { IndustryParams } from "../types/world.ts";
import { USD_PER_MILLION } from "../types/world.ts";

export type { RunRate };

/** Spec 5.19.3: a startup under $1M of target revenue is skipped. */
export const MIN_STARTUP_REVENUE_USD = 1.0e6;
/** Spec 5.19.3: target revenue is capped at 2% of the fringe's revenue. */
export const FRINGE_REVENUE_CAP_SHARE = 0.02;
/** Spec 5.19.3 seed round: cash = 0.5 × gross_assets from the seed investors. */
export const SEED_CASH_SHARE = 0.5;
/** Spec 5.19.3 cap table: the founders hold 60% ... */
export const FOUNDERS_SHARE = 0.6;
/** ... the lead founder half of it, the others the rest in equal parts. */
export const LEAD_SHARE_OF_FOUNDERS = 0.5;
/**
 * Spec 7.1 Shares row (batch 161; gen.py `PRICE_*`): `open_price = clamp(round($25 × (engine
 * value ÷ $1B)^0.35 × jitter), $5, $200)`.
 */
export const PRICE_BASE_USD = 25.0;
export const PRICE_REF_USD = 1.0e9;
export const PRICE_EXP = 0.35;
export const PRICE_MIN_USD = 5.0;
export const PRICE_MAX_USD = 200.0;
/**
 * Spec 7.1: jitter up to ±10%, seeded by the company id: gen.py's `1 + 0.10 × (2 × (crc32("price:"
 * + id) mod 10001) ÷ 10000 − 1)`.
 */
export const PRICE_JITTER = 0.1;
export const PRICE_JITTER_KEY_PREFIX = "price:";
export const PRICE_JITTER_BUCKETS = 10_001;
export const PRICE_JITTER_SCALE = 10_000.0;
/** Months a year. */
export const MONTHS_PER_YEAR = 12.0;

/**
 * The fringe's revenue for the 5.19.3 cap: `fringe_assets × turnover`, a year at productivity 100
 * and M 1.0, the same scale as the target revenue (D268).
 */
export function fringeRevenue(fringe_assets: number, turnover: number): number {
  return maxF(fringe_assets, 0.0) * turnover;
}

/**
 * The startup's revenue (spec 5.19.3): the target capped at 2% of the fringe's revenue; null
 * (skipped) under $1M.
 */
export function sizedRevenue(target_revenue: number, fringe_revenue: number): number | null {
  const r = minF(target_revenue, FRINGE_REVENUE_CAP_SHARE * maxF(fringe_revenue, 0.0));
  return r >= MIN_STARTUP_REVENUE_USD ? r : null;
}

/**
 * The carve (spec 5.19.3): `gross_assets = revenue × capital_per_dollar`, taken out of the
 * industry's fringe_assets, so supply is conserved before PC bonuses (the fringe and a unit at
 * productivity 100 supply the same per dollar, 5.2). Never more than the fringe holds.
 */
export interface Carve {
  gross_assets: number;
  fringe_assets_after: number;
}

export function carve(revenue: number, capital_per_dollar: number, fringe_assets: number): Carve {
  const gross = maxF(minF(revenue * capital_per_dollar, maxF(fringe_assets, 0.0)), 0.0);
  return { gross_assets: gross, fringe_assets_after: fringe_assets - gross };
}

/**
 * Labor units and stations by the 7.1 rules (spec 5.19.3 "Stations by the 7.1 rules"): `L =
 * floor(gross ÷ labor_value)`, productivity `max(1, round(0.25 × L))`, enterprise `ceil(0.5 × R($M)
 * × data_tb_per_musd ÷ 10.95)` capped at the labor left (D208), idle the rest. The plan lock's 6.4
 * split replaces them the same day. Labor and station counts are whole numbers (u64).
 */
export function birthStations(gross_assets: number, revenue: number, p: IndustryParams): [number, Stations] {
  const labor = laborUnits(gross_assets, p.labor_value_usd);
  const prod = Math.min(loadoutProductivityStations(labor), labor);
  const want = toU64Sat(
    maxF(
      Math.ceil(
        (((LOADOUT_ENTERPRISE_SHARE * revenue) / USD_PER_MILLION) * p.data_tb_per_musd) /
          LOADOUT_ENTERPRISE_DIVISOR_TB,
      ),
      0.0,
    ),
  );
  const ent = Math.min(want, labor - prod);
  return [labor, { ...stationsDefault(), productivity: prod, enterprise: ent, idle: labor - prod - ent }];
}

/**
 * The newborn's fixed cost rate (D269): the 7.1 rule at birth, `f × turnover − d_eff − shared costs
 * ÷ gross`, with the shared costs a year of the 3.8 bill on its birth stations at 0 TB stored, so
 * it breaks even at productivity 100 and M 1.0 like the 651.
 */
export function birthFixedCostRate(gross_assets: number, stations: Stations, p: IndustryParams): number {
  const bill = computeBill(stations, 0.0);
  return fixedCostRateAtLoad(gross_assets, sharedCostsAtLoadHook(bill), p);
}

/** Spec 5.19.3: the founders control a startup (control_basis founder), never a state. */
export const FOUNDER_CONTROL_BASIS = "founder";

/**
 * The archetype of a startup (spec 5.19.3, 5.19.5): 6.1 without the trait rows (`archetypeAtLoad`
 * with no traits), so a Tech startup under $50M is a Startup, else Incumbent. `sector` is
 * industries.csv `sector`.
 */
export function startupArchetype(revenue: number, sector: string): Archetype {
  return archetypeAtLoad(FOUNDER_CONTROL_BASIS, revenue, sector, []);
}

/**
 * The newborn's run rate (D271): a year at productivity 100 plus its PC bonus, M 1.0 (the 7.1 run
 * rate), with R&D at `rd_plan` and the 3.8 bill at 0 TB as shared costs.
 */
export function birthRunRate(
  gross_assets: number,
  stations: Stations,
  fixed_cost_rate: number,
  rd_plan: number,
  p: IndustryParams,
): RunRate {
  const bonus = pcBonus(productiveCompute(stations, p.pc_modifier));
  const revenue = (gross_assets * p.asset_turnover * (START_PRODUCTIVITY + bonus)) / START_PRODUCTIVITY;
  const shared = computeBill(stations, 0.0).monthly_usd;
  const m = monthExpenses(
    revenue / MONTHS_PER_YEAR,
    gross_assets,
    gross_assets,
    fixed_cost_rate,
    rd_plan,
    p,
    shared,
  );
  const ebit = revenue - MONTHS_PER_YEAR * monthExpensesTotal(m);
  return {
    pc_bonus: bonus,
    revenue,
    ebit,
    ebitda: ebit + MONTHS_PER_YEAR * m.depreciation,
  };
}

/** The CRC-32 (IEEE, as zlib and flate2's `Crc`) table. */
const CRC_TABLE: readonly number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

/** CRC-32 of a string's UTF-8 bytes (flate2 `Crc`; the company keys are ASCII). */
export function crc32(s: string): number {
  let c = 0xffffffff;
  for (const b of new TextEncoder().encode(s)) {
    c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** The 7.1 price jitter of a company key (gen.py `price_jitter`): CRC-32 of `"price:" + key`. */
export function priceJitter(key: string): number {
  const bucket = crc32(PRICE_JITTER_KEY_PREFIX + key) % PRICE_JITTER_BUCKETS;
  return 1.0 + PRICE_JITTER * ((2.0 * bucket) / PRICE_JITTER_SCALE - 1.0);
}

/**
 * The open price (spec 7.1 Shares row, batch 161): `clamp(round($25 × (value ÷ $1B)^0.35 × jitter),
 * $5, $200)`, halves to even as gen.py's Python `round`.
 */
export function openPrice(engine_value: number, key: string): number {
  // Note: Rust's `powf` is libm's pow; Math.pow may differ in the last bit.
  const p = PRICE_BASE_USD * (maxF(engine_value, 0.0) / PRICE_REF_USD) ** PRICE_EXP * priceJitter(key);
  return clamp(roundTiesEven(p), PRICE_MIN_USD, PRICE_MAX_USD);
}

/** Shares for a value at a price (spec 7.1): `max(1, round(value ÷ open_price))`. Whole number (u64). */
export function sharesFor(value: number, open_price: number): number {
  return Math.max(toU64Sat(roundTiesEven(value / open_price)), 1);
}

/**
 * The startup cap table (spec 5.19.3): founders 60% (the lead half of it, the others the rest in
 * equal parts), unnamed seed investors 40%. A lone founder holds all 60%; each founder's shares
 * round down and the seed investors take the remainder, so the parts sum to shares_out (D270).
 */
export interface CapTable {
  /** Shares per founder, lead first (u64). */
  founders: number[];
  seed_investors: number;
}

/** Rust `CapTable::total`. */
export function capTableTotal(t: CapTable): number {
  let n = 0;
  for (const f of t.founders) n += f;
  return n + t.seed_investors;
}

export function capTable(shares_out: number, founders: number): CapTable {
  const s = shares_out;
  let shares: number[];
  if (founders === 0) {
    shares = [];
  } else if (founders === 1) {
    shares = [toU64Sat(Math.floor(FOUNDERS_SHARE * s))];
  } else {
    const lead = toU64Sat(Math.floor(FOUNDERS_SHARE * LEAD_SHARE_OF_FOUNDERS * s));
    const each = toU64Sat(Math.floor((FOUNDERS_SHARE * (1.0 - LEAD_SHARE_OF_FOUNDERS) * s) / (founders - 1)));
    shares = [lead];
    for (let k = 1; k < founders; k++) shares.push(each);
  }
  let held = 0;
  for (const f of shares) held += f;
  return { founders: shares, seed_investors: shares_out - held };
}

/** What one startup's build reads besides its draft (spec 5.19.3). */
export interface BirthInputs {
  /** The new company's key (next CO- id); it seeds the 7.1 price jitter. */
  key: string;
  /** `sizedRevenue`, USD a year. */
  revenue: number;
  params: IndustryParams;
  /** industries.csv id (the 5.12 sector notches). */
  industry_key: string;
  /** industries.csv `sector` of the industry (the 6.1 Startup row). */
  sector: string;
  /** The industry's fringe_assets before the carve. */
  fringe_assets: number;
  /** The HQ country's corporate tax rate. */
  tax_rate: number;
  /** The HQ country's sovereign rating. */
  sovereign: Rating;
  base_rate: number;
  /** The home spread at birth (effective zone spread, D271). */
  home_spread: number;
  /** The industry's current lt (g_sector, D1). */
  g_sector: number;
  /** `bookFloorShare` of the industry. */
  book_floor_share: number;
}

/** A built startup (spec 5.19.3), before its cast. */
export interface Birth {
  gross_assets: number;
  /** = gross (newly bought), no ramping, productivity 100. */
  asset_book: number;
  /** The seed round, 0.5 × gross; no line drawn. */
  cash: number;
  fringe_assets_after: number;
  /** Whole number (u64). */
  labor: number;
  stations: Stations;
  fixed_cost_rate: number;
  archetype: Archetype;
  /**
   * R&D at the 6.3 target with no traits, productivity 100 and no free R&D (0 TB), for the run
   * rate.
   */
  rd_plan: number;
  run_rate: RunRate;
  rating: Rating;
  engine_value: number;
  open_price: number;
  /** Whole number (u64). */
  shares_out: number;
}

/**
 * Builds a startup (spec 5.19.3): carve, stations, fixed cost rate, archetype, run rate, rating
 * implied from it (5.12, `startingRating` with no line), engine value by the 7.1 rule for a
 * private company (X 1.0, Normal cycle, confidence 1.0), open price and shares.
 */
export function buildStartup(i: BirthInputs): Birth {
  const c = carve(i.revenue, i.params.capital_per_dollar, i.fringe_assets);
  const gross = c.gross_assets;
  const [labor, stations] = birthStations(gross, i.revenue, i.params);
  const fcr = birthFixedCostRate(gross, stations, i.params);
  const arch = startupArchetype(i.revenue, i.sector);
  const rd_plan = i.params.rd_norm * archetypeParams(arch).rd_mult;
  const run = birthRunRate(gross, stations, fcr, rd_plan, i.params);
  const cash = SEED_CASH_SHARE * gross;
  const rating = startingRating({
    cash,
    line_drawn: 0.0,
    ebitda: run.ebitda,
    revenue: run.revenue,
    industry_key: i.industry_key,
    sovereign: i.sovereign,
    base_rate: i.base_rate,
    home_spread: i.home_spread,
  }).implied;
  const value = engineValueAtLoad({
    book_equity: cash + gross,
    run_rate_ebit: run.ebit,
    tax_rate: i.tax_rate,
    sector_multiple: i.params.earnings_multiple,
    g_sector: i.g_sector,
    home_spread: i.home_spread,
    listing_confidence: null,
    book_floor_share: i.book_floor_share,
  });
  const price = openPrice(value, i.key);
  return {
    gross_assets: gross,
    asset_book: gross,
    cash,
    fringe_assets_after: c.fringe_assets_after,
    labor,
    stations,
    fixed_cost_rate: fcr,
    archetype: arch,
    rd_plan,
    run_rate: run,
    rating,
    engine_value: value,
    open_price: price,
    shares_out: sharesFor(value, price),
  };
}
