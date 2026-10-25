// Data: creation, conversion, decay, 12-month retention and free R&D (spec 5.9; 10.0.11.4 to
// 10.0.11.7), and the steady-state held data used at load (7.1). Ported from
// crates/sim/src/ops/data.rs. The `DataBook` type is in types/state/ops.ts.

import { maxF, minF } from "../types/num.ts";
import type { DataBook, Stations } from "../types/state/ops.ts";
import { RETENTION_MONTHS as RETENTION_MONTHS_TYPE } from "../types/state/ops.ts";
import { USD_PER_MILLION } from "../types/world.ts";
import { decadeSteps } from "./stations.ts";

export type { DataBook } from "../types/state/ops.ts";

/**
 * Spec 5.9 step 3: TB a month one enterprise station converts (general enterprise software at
 * quality 50: 1 GB a tick × Q 1.25 × 730 ticks).
 */
export const CONVERT_TB_PER_STATION = 0.9125;
/** Spec 5.8, 5.9: a 50/50 station counts half for productive compute and half for conversion. */
export const FIFTY_FIFTY_SHARE = 0.5;
/** Spec 5.9 step 5: unstructured data is kept this many months. */
export const RETENTION_MONTHS = RETENTION_MONTHS_TYPE;
/** Spec 5.9 step 1: held TB at which free R&D starts (1%). */
export const FREE_RD_FIRST_STEP_TB = 1.0;
/** Spec 5.9: one more percent per 10× of held TB. */
export const FREE_RD_STEP_FACTOR = 10.0;
/** Spec 5.9 step 4: held TB from which the decay rate grows with log10(held). */
export const DECAY_LOG_FROM_TB = 1.0;
/** Spec 5.9: `$1M` of revenue, for the `revenue_month ($M)` term. */
export const USD_PER_MUSD = USD_PER_MILLION;
/** Months in a year (7.1 one month of inflow is a twelfth of a year's). */
export const MONTHS_PER_YEAR = 12.0;
/** Percent in 1.0 (free R&D is a whole percent, 5.9). */
export const PERCENT = 100.0;

/**
 * Free R&D percent for `held` TB (spec 5.9): `1 + floor(log10(held))` for held ≥ 1 TB, else 0.
 * Steps: under 1 TB 0%; 1 TB 1%; 10 TB 2%; 100 TB 3%; 1 PB 4%; 10 PB 5%; +1% per further 10×.
 * Whole number (u32).
 */
export function freeRdStep(heldTb: number): number {
  return decadeSteps(heldTb, FREE_RD_FIRST_STEP_TB, FREE_RD_STEP_FACTOR);
}

/**
 * Held TB at which the free R&D step after `pct` starts (spec 5.9 steps): 1 TB for 0%, else
 * 10^pct TB, so 1% (1 to 9.99 TB) steps up at 10 TB. For the Tech tab's data quests card
 * (spec 8).
 */
export function nextFreeRdTb(pct: number): number {
  return pct === 0 ? FREE_RD_FIRST_STEP_TB : FREE_RD_FIRST_STEP_TB * FREE_RD_STEP_FACTOR ** pct;
}

/**
 * The monthly decay rate at `held` TB (spec 5.9 step 4): `base × (1 + log10(held))` for
 * held ≥ 1, else base.
 */
export function decayRate(heldTb: number, base: number): number {
  return heldTb >= DECAY_LOG_FROM_TB ? base * (1.0 + Math.log10(heldTb)) : base;
}

/**
 * TB a month the stations convert (spec 5.9 step 3):
 * `(enterprise + 0.5 × 50/50 stations) × 0.9125`.
 */
export function conversionCapacity(stations: Stations): number {
  return (stations.enterprise + FIFTY_FIFTY_SHARE * stations.fifty_fifty) * CONVERT_TB_PER_STATION;
}

/** Bisection steps for `steadyStateHeld`. */
export const STEADY_STATE_ITERATIONS = 200;

/**
 * Held TB where converting `c` TB a month equals decay (spec 5.9, used at load in 7.1): solves
 * `C = rate(held) × held`. `rate × held` rises with held and is continuous at 1 TB, so below
 * `base` the answer is `C ÷ base` (under 1 TB) and above it a geometric bisection from 1 TB. 0
 * for C ≤ 0. Unlike validate.py `steady_held`, which bisects from a 1 TB floor and so returns
 * 1 TB (1% free R&D) for any C below `base`, this follows 5.9 below 1 TB too (design fix 208).
 * This is the held level after conversion and before decay; the end-of-month level it settles
 * at is that less C (D210).
 */
export function steadyStateHeld(cTb: number, base: number): number {
  if (cTb <= 0.0 || base <= 0.0) return 0.0;
  if (cTb <= base * DECAY_LOG_FROM_TB) return cTb / base;
  // rate ≥ base above 1 TB, so held ≤ C ÷ base.
  let lo = DECAY_LOG_FROM_TB;
  let hi = cTb / base;
  for (let i = 0; i < STEADY_STATE_ITERATIONS; i++) {
    const mid = Math.sqrt(lo * hi);
    if (decayRate(mid, base) * mid > cTb) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return lo;
}

/** Rust `DataBook::default()`. */
export function dataBookDefault(): DataBook {
  return { unstructured: [], held: 0.0, free_rd_pct: 0, grace: false };
}

/** The industry's data settings (industries.csv). */
export interface DataParams {
  /** TB of unstructured data per $1M of revenue (`data_tb_per_musd`). */
  tb_per_musd: number;
  /** Base monthly decay of held data (`data_decay_base`). */
  decay_base: number;
}

/** What one month did (spec 5.9), for screens and checks. */
export interface DataMonth {
  /** Free R&D percent for this month (step 1). Whole number (u32). */
  free_rd_pct: number;
  created_tb: number;
  converted_tb: number;
  decayed_tb: number;
  /** Unstructured TB dropped by retention (step 5). */
  dropped_tb: number;
}

/**
 * The starting data (spec 7.1): one month of unstructured data (`R($M) × data_tb_per_musd ÷ 12`)
 * in the newest bucket, and structured held data at the steady state for converting
 * `min(capacity, share × inflow)` a month (share 0.5, Arrowhead 0.1). Free R&D starts at the
 * step of that held level (D210). Rust `DataBook::at_load`.
 */
export function dataBookAtLoad(
  revenueUsd: number,
  params: DataParams,
  capacityTb: number,
  share: number,
): DataBook {
  const inflow = ((revenueUsd / USD_PER_MUSD) * params.tb_per_musd) / MONTHS_PER_YEAR;
  const c = minF(capacityTb, share * inflow);
  const held = steadyStateHeld(c, params.decay_base);
  return { unstructured: [inflow], held, free_rd_pct: freeRdStep(held), grace: false };
}

/** Unstructured TB not yet converted. Rust `DataBook::unstructured_tb`. */
export function dataBookUnstructuredTb(book: DataBook): number {
  let sum = 0.0;
  for (const b of book.unstructured) sum += b;
  return sum;
}

/** TB stored, for the data compute of 3.8: held plus unstructured. Rust `DataBook::stored_tb`. */
export function dataBookStoredTb(book: DataBook): number {
  return book.held + dataBookUnstructuredTb(book);
}

/** Free R&D as a fraction of revenue (5.6 rd_total). Rust `DataBook::free_rd_fraction`. */
export function dataBookFreeRdFraction(book: DataBook): number {
  return book.free_rd_pct / PERCENT;
}

/**
 * Runs one month (spec 5.9, 4.3 step 8), in the spec's order. Rust `DataBook::month`.
 *
 * 1. Free R&D from held TB at the start of the month; a drop to a lower step waits one month
 *    (the grace) and applies the month after if held is still below (D210).
 * 2. Create: `revenue_month ($M) × data_tb_per_musd` TB into this month's bucket.
 * 3. Convert up to `capacityTb`, oldest buckets first; `held += converted`.
 * 4. Decay: `held −= held × rate(held)`.
 * 5. Retention: unstructured data older than 12 months is dropped, so the bucket made 12 months
 *    ago gets this month's conversion as its last chance (D210).
 */
export function dataBookMonth(
  book: DataBook,
  revenueMonthUsd: number,
  params: DataParams,
  capacityTb: number,
): DataMonth {
  // 1. Free R&D for this month.
  const step = freeRdStep(book.held);
  if (step < book.free_rd_pct && !book.grace) {
    // The first month below: keep the old step for the grace month.
    book.grace = true;
  } else {
    // At or above the step, or a drop whose grace month has passed.
    book.free_rd_pct = step;
    book.grace = false;
  }
  // 2. Create.
  const created = maxF((revenueMonthUsd / USD_PER_MUSD) * params.tb_per_musd, 0.0);
  book.unstructured.push(created);
  // 3. Convert, oldest first.
  let room = maxF(capacityTb, 0.0);
  let converted = 0.0;
  for (let i = 0; i < book.unstructured.length; i++) {
    if (room <= 0.0) break;
    const bucket = book.unstructured[i]!;
    const take = minF(bucket, room);
    book.unstructured[i] = bucket - take;
    room -= take;
    converted += take;
  }
  book.held += converted;
  // 4. Decay.
  const decayed = book.held * decayRate(book.held, params.decay_base);
  book.held -= decayed;
  // 5. Retention.
  let dropped = 0.0;
  if (book.unstructured.length > RETENTION_MONTHS) {
    const old = book.unstructured.length - RETENTION_MONTHS;
    for (const b of book.unstructured.splice(0, old)) dropped += b;
  }
  return {
    free_rd_pct: book.free_rd_pct,
    created_tb: created,
    converted_tb: converted,
    decayed_tb: decayed,
    dropped_tb: dropped,
  };
}
