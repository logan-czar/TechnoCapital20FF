// Stations, productive compute and the PC bonus (spec 5.8), the Lite AI station split (6.4) and
// the starting loadout (7.1; C16). Ported from crates/sim/src/ops/stations.rs. The `Stations`
// type is in types/state/ops.ts.

import { divInt, maxF, roundTiesEven, toU64Sat } from "../types/num.ts";
import type { Stations } from "../types/state/ops.ts";
import { USD_PER_MILLION } from "../types/world.ts";
import { CONVERT_TB_PER_STATION, FIFTY_FIFTY_SHARE } from "./data.ts";
import { laborUnits } from "./labor.ts";

export type { Stations } from "../types/state/ops.ts";

/** Rust `Stations::default()`: all zero. */
export function stationsDefault(): Stations {
  return { productivity: 0, enterprise: 0, fifty_fifty: 0, research: 0, idle: 0 };
}

/** Rust `Stations::total`. */
export function stationsTotal(s: Stations): number {
  return s.productivity + s.enterprise + s.fifty_fifty + s.research + s.idle;
}

/** Enterprise licences (spec 3.8): one per enterprise or 50/50 station. */
export function stationsLicences(s: Stations): number {
  return s.enterprise + s.fifty_fifty;
}

/**
 * Productive compute (spec 5.8): `(productivity stations + 0.5 × 50/50 stations) × pc_modifier`,
 * with the main industry's modifier since stations are pooled.
 */
export function productiveCompute(stations: Stations, pcModifier: number): number {
  return (stations.productivity + FIFTY_FIFTY_SHARE * stations.fifty_fifty) * pcModifier;
}

/** Spec 5.8: PC at which the bonus starts (+1). */
export const PC_BONUS_FIRST_STEP = 1.0;
/** Spec 5.8: one more point per 10× of PC. */
export const PC_BONUS_STEP_FACTOR = 10.0;

/**
 * The stepped PC bonus (spec 5.8): `floor(1 + log10(PC))` for PC ≥ 1, else 0, in points of
 * productivity. Counted by comparing with exact powers of ten, so PC 10, 100, ... land on their
 * step whatever `log10` rounds to. Whole number (u32).
 */
export function pcBonus(pc: number): number {
  return decadeSteps(pc, PC_BONUS_FIRST_STEP, PC_BONUS_STEP_FACTOR);
}

/** `floor(1 + log10(x / first))` for x ≥ first, else 0, by exact comparisons (5.8, 5.9 steps). */
export function decadeSteps(x: number, first: number, factor: number): number {
  if (Number.isNaN(x) || x < first) return 0;
  let steps = 1;
  let next = first * factor;
  while (x >= next && Number.isFinite(next)) {
    steps += 1;
    next *= factor;
  }
  return steps;
}

/** Spec 6.4 step 1: productivity stations are the largest power of ten at most this share of L. */
export const SPLIT_PRODUCTIVITY_SHARE = 0.4;
/** Spec 6.4 step 3: a Visionary controller puts this percent of what is left into research. */
export const SPLIT_VISIONARY_RESEARCH_PERCENT = 10;
/** Integer percent divisor for the 6.4 shares. */
const PERCENT = 100;
/** Spec 6.4 step 4: keep at least this share of L idle (decay 0.4)... */
export const SPLIT_MIN_IDLE_PERCENT = 10;
/** ...once L is at least this. */
export const SPLIT_MIN_IDLE_FROM_LABOR = 10;
/** Spec 6.4 step 5: the CEO splits 50/50 only at full data coverage. */
export const SPLIT_FIFTY_FIFTY_COVERAGE = 1.0;

/** What the 6.4 split reads. */
export interface SplitInputs {
  /** Labor units L (whole number, u64). */
  labor: number;
  /** Data coverage from the archetype table (6.1): 0.25, 0.5 or 1.0. */
  coverage: number;
  /** Monthly unstructured inflow, TB (5.9 step 2: revenue $M × data_tb_per_musd ÷ 12). */
  inflow_tb: number;
  /** The named controller is Visionary (6.4 step 3). */
  visionary: boolean;
}

/**
 * The Lite AI station split (spec 6.4).
 *
 * 1. P: the largest 10^k at most 40% of L, minimum 1.
 * 2. E: `ceil(coverage × inflow ÷ 0.9125)`, capped at the labor left.
 * 3. R: Visionary controllers put 10% of what is left (rounded down, D207) into research.
 * 4. Idle: the rest; if it would fall under 10% of L (rounded up, so the 0.4 idle decay of 5.6
 *    holds; D207) and L ≥ 10, cut E first, then R.
 * 5. 50/50: at L = 1 and coverage 100%, the CEO's one station is 50/50 instead of
 *    productivity (D207).
 */
export function stationSplit(inp: SplitInputs): Stations {
  const l = Math.max(inp.labor, 1);
  if (l === 1) {
    const split = inp.coverage >= SPLIT_FIFTY_FIFTY_COVERAGE;
    return { ...stationsDefault(), productivity: split ? 0 : 1, fifty_fifty: split ? 1 : 0 };
  }
  const p = Math.max(largestPowerOfTenAtMost(SPLIT_PRODUCTIVITY_SHARE * l), 1);
  const left = l - p;
  const eWant = Math.ceil((inp.coverage * inp.inflow_tb) / CONVERT_TB_PER_STATION);
  let e = Number.isFinite(eWant) && eWant > 0.0 ? Math.min(toU64Sat(eWant), left) : 0;
  let r = inp.visionary ? divInt((left - e) * SPLIT_VISIONARY_RESEARCH_PERCENT, PERCENT) : 0;
  if (l >= SPLIT_MIN_IDLE_FROM_LABOR) {
    // div_ceil(l * 10, 100)
    const minIdle = Math.ceil((l * SPLIT_MIN_IDLE_PERCENT) / PERCENT);
    let short = Math.max(0, minIdle - (left - e - r));
    const cutE = Math.min(short, e);
    e -= cutE;
    short -= cutE;
    r -= Math.min(short, r);
  }
  return { productivity: p, enterprise: e, fifty_fifty: 0, research: r, idle: l - p - e - r };
}

/** The largest 1, 10, 100, ... at most `x`, or 0 when x < 1 (spec 6.4 step 1). */
function largestPowerOfTenAtMost(x: number): number {
  if (Number.isNaN(x) || x < 1.0) return 0;
  let p = 1;
  // checked_mul on u64 becomes "stays an exactly held count" on a JS number.
  while (p * 10 <= Number.MAX_SAFE_INTEGER) {
    const next = p * 10;
    if (next > x) break;
    p = next;
  }
  return p;
}

/** Spec 7.1: starting productivity stations `max(1, round(0.25 × L))`. */
export const LOADOUT_PRODUCTIVITY_SHARE = 0.25;
/** Spec 7.1, C16: starting enterprise stations `ceil(0.5 × R × data_tb_per_musd ÷ 10.95)`. */
export const LOADOUT_ENTERPRISE_SHARE = 0.5;
/**
 * Spec 7.1: Arrowhead (CO-0001) uses 0.1 in place of 0.5, for its enterprise stations and its
 * structured data share.
 */
export const ARROWHEAD_ENTERPRISE_SHARE = 0.1;
/** Spec 7.1: the company that uses `ARROWHEAD_ENTERPRISE_SHARE`. */
export const ARROWHEAD_KEY = "CO-0001";
/** Spec C16: a station's yearly conversion, TB (12 × 0.9125). */
export const LOADOUT_ENTERPRISE_DIVISOR_TB = 10.95;
/** Spec 7.1: revenue below which a company gets the barebones loadout ($0.1M), USD. */
export const BAREBONES_REVENUE_USD = 0.1e6;
/** Spec 7.1, 10.0.11.1: the barebones company's one asset, USD. */
export const BAREBONES_ASSETS_USD = 100_000.0;
/** Spec 7.1: productivity at load. */
export const START_PRODUCTIVITY = 100.0;
/** Spec 7.1: the PC bonus is found by iterating the station rule twice. */
export const LOADOUT_BONUS_PASSES = 2;

/** What the 7.1 loadout reads about one company and its industry. */
export interface LoadoutInputs {
  /** Starting revenue R, USD a year. */
  revenue_usd: number;
  capital_per_dollar: number;
  labor_value_usd: number;
  pc_modifier: number;
  data_tb_per_musd: number;
  /** Location bonus points (5.4; 0 for every unit in the MVP). */
  location_bonus: number;
  /** 0.5, or `ARROWHEAD_ENTERPRISE_SHARE` for Arrowhead (7.1). */
  enterprise_share: number;
}

/** The starting loadout of one company (spec 7.1). */
export interface Loadout {
  gross_assets_usd: number;
  /** Whole number (u64). */
  labor: number;
  stations: Stations;
  pc: number;
  /** The PC bonus of the final stations (what 5.8 gives from now on). Whole number (u32). */
  pc_bonus: number;
  /**
   * The second-pass bonus the gross assets were set with (7.1); equal to `pc_bonus` unless the
   * two passes have not settled (design fix 201). It holds until the first monthly recount, and
   * the load revenue check (M2.6) reads it. 0 for the barebones loadout, whose $100,000 asset is
   * fixed rather than sized from a bonus (its live `pc_bonus` is +1 from PC 1).
   */
  assets_bonus: number;
  /** The first-pass bonus (from gross assets at bonus 0), for checks; 0 for barebones. */
  first_pass_bonus: number;
  barebones: boolean;
}

/**
 * The PC bonus a company holds at load (7.1, D106): the second-pass bonus its gross assets were
 * sized with (`assets_bonus`), so every unit makes its companies.csv revenue at M 1.0; the
 * barebones loadout's fixed $100,000 asset is not sized from a bonus, so it holds the live +1 of
 * its one productivity station. The monthly compute step (4.3 step 5) recounts it from the
 * stations from the first month on (design fix 201). Rust `Loadout::load_bonus`.
 */
export function loadoutLoadBonus(l: Loadout): number {
  return l.barebones ? l.pc_bonus : l.assets_bonus;
}

/**
 * The PC at which the bonus after `bonus` starts (spec 5.8): 1 for bonus 0, else 10^bonus, so
 * +2 (PC 10 to 99.99) steps up at PC 100. For the Tech tab's "next step" (spec 8).
 */
export function nextBonusPc(bonus: number): number {
  return bonus === 0 ? PC_BONUS_FIRST_STEP : PC_BONUS_FIRST_STEP * PC_BONUS_STEP_FACTOR ** bonus;
}

/**
 * The 7.1 starting productivity stations for `labor` units: `max(1, round(0.25 × L))`, rounding
 * halves to even as validate.py and gen.py do (Python `round`; D208).
 */
export function loadoutProductivityStations(labor: number): number {
  return Math.max(toU64Sat(roundTiesEven(LOADOUT_PRODUCTIVITY_SHARE * labor)), 1);
}

/** The PC bonus of the 7.1 station rule at `gross` assets (productivity stations only). */
function loadoutBonus(gross: number, inp: LoadoutInputs): number {
  const labor = laborUnits(gross, inp.labor_value_usd);
  const p = loadoutProductivityStations(labor);
  return pcBonus(p * inp.pc_modifier);
}

/**
 * Gross assets that make exactly R at M 1.0 (spec 7.1):
 * `R × capital_per_dollar × 100 ÷ (100 + PC bonus + location bonus)`.
 */
function loadoutGross(inp: LoadoutInputs, bonus: number): number {
  return (
    (inp.revenue_usd * inp.capital_per_dollar * START_PRODUCTIVITY) /
    (START_PRODUCTIVITY + bonus + inp.location_bonus)
  );
}

/**
 * The starting loadout (spec 7.1): the PC bonus from the station rule at productivity 100,
 * iterated twice (first pass at bonus 0, second at the first pass's bonus, D208); gross assets
 * from the second-pass bonus; labor units; productivity stations `max(1, round(0.25 × L))`;
 * enterprise stations `ceil(share × R($M) × data_tb_per_musd ÷ 10.95)` (C16), capped at the
 * labor left (D208); idle the rest. Below $0.1M of revenue: the barebones loadout, one $100,000
 * asset, one labor unit with the CEO on productivity (10.0.11.1).
 */
export function startingLoadout(inp: LoadoutInputs): Loadout {
  if (inp.revenue_usd < BAREBONES_REVENUE_USD) {
    const stations: Stations = { ...stationsDefault(), productivity: 1 };
    const pc = productiveCompute(stations, inp.pc_modifier);
    return {
      gross_assets_usd: BAREBONES_ASSETS_USD,
      labor: 1,
      stations,
      pc,
      pc_bonus: pcBonus(pc),
      // The fixed $100,000 asset is not sized from any bonus, so no pass ran.
      assets_bonus: 0,
      first_pass_bonus: 0,
      barebones: true,
    };
  }
  let bonus = 0;
  let firstPassBonus = 0;
  for (let pass = 0; pass < LOADOUT_BONUS_PASSES; pass++) {
    bonus = loadoutBonus(loadoutGross(inp, bonus), inp);
    if (pass === 0) firstPassBonus = bonus;
  }
  const gross = loadoutGross(inp, bonus);
  const labor = laborUnits(gross, inp.labor_value_usd);
  const p = Math.min(loadoutProductivityStations(labor), labor);
  const rMusd = inp.revenue_usd / USD_PER_MILLION;
  const eWant = toU64Sat(
    maxF(
      Math.ceil((inp.enterprise_share * rMusd * inp.data_tb_per_musd) / LOADOUT_ENTERPRISE_DIVISOR_TB),
      0.0,
    ),
  );
  const e = Math.min(eWant, labor - p);
  const stations: Stations = { ...stationsDefault(), productivity: p, enterprise: e, idle: labor - p - e };
  const pc = productiveCompute(stations, inp.pc_modifier);
  return {
    gross_assets_usd: gross,
    labor,
    stations,
    pc,
    pc_bonus: pcBonus(pc),
    assets_bonus: bonus,
    first_pass_bonus: firstPassBonus,
    barebones: false,
  };
}
