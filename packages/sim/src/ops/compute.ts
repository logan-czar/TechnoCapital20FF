// Compute and software costs at the corporation level (spec 3.8; 10.0.11.1, 15.2). Ported from
// crates/sim/src/ops/compute.rs. The `ComputeBill` type is in types/state/ops.ts.
//
// The bundled desktop, base compute and productivity seat (one per labor unit) sit inside fixed
// costs; this module prices the rest. The monthly total is the corporation's shared costs,
// split across its units by revenue share (5.5).

import { maxF, toU64Sat } from "../types/num.ts";
import type { ComputeBill, Stations } from "../types/state/ops.ts";

export type { ComputeBill } from "../types/state/ops.ts";

/** Spec 3.8: extra base compute is at least this many units. */
export const MIN_EXTRA_BASE_COMPUTE = 9;
/**
 * Spec 3.8: extra base compute is `ceil(0.2 × stations)`, i.e. one per this many stations
 * (integer ceiling, so 0.2 × 15 is 3, not 4 from float rounding; D209).
 */
export const STATIONS_PER_EXTRA_BASE_COMPUTE = 5;
/** Spec 3.8: data compute is at least this many units. */
export const MIN_DATA_COMPUTE = 10;
/** Spec 3.8: data compute is `ceil(1.2 × TB stored ÷ 100)`. */
export const DATA_COMPUTE_PER_100_TB = 1.2;
/** Spec 3.8: TB in the data compute divisor. */
export const DATA_COMPUTE_TB_DIVISOR = 100.0;
/** Spec 3.8: $50 a month per extra base compute (maintenance 1 × $50, 15.2). */
export const EXTRA_BASE_COMPUTE_USD_MONTH = 50.0;
/** Spec 3.8: $10 a month per data compute (maintenance 0.2 × $50). */
export const DATA_COMPUTE_USD_MONTH = 10.0;
/** Spec 3.8: $30 a month per enterprise licence (10.0.11.1). */
export const ENTERPRISE_LICENCE_USD_MONTH = 30.0;

/** Rust `ComputeBill::default()`. */
export function computeBillDefault(): ComputeBill {
  return { extra_base_compute: 0, data_compute: 0, licences: 0, monthly_usd: 0.0 };
}

/**
 * Extra base compute (spec 3.8): `max(9, ceil(0.2 × stations))`; stations are all of them, one
 * per labor unit (D209).
 */
export function extraBaseCompute(stationCount: number): number {
  return Math.max(Math.ceil(stationCount / STATIONS_PER_EXTRA_BASE_COMPUTE), MIN_EXTRA_BASE_COMPUTE);
}

/**
 * Data compute (spec 3.8): `max(10, ceil(1.2 × TB stored ÷ 100))`, auto-scaled monthly. TB
 * stored is held plus unstructured data over all industries (D209).
 */
export function dataCompute(tbStored: number): number {
  const need = Math.ceil((DATA_COMPUTE_PER_100_TB * maxF(tbStored, 0.0)) / DATA_COMPUTE_TB_DIVISOR);
  return Math.max(toU64Sat(need), MIN_DATA_COMPUTE);
}

/** The month's compute and licence bill (spec 3.8). */
export function computeBill(stations: Stations, tbStored: number): ComputeBill {
  const total =
    stations.productivity + stations.enterprise + stations.fifty_fifty + stations.research + stations.idle;
  const extra = extraBaseCompute(total);
  const data = dataCompute(tbStored);
  const licences = stations.enterprise + stations.fifty_fifty;
  return {
    extra_base_compute: extra,
    data_compute: data,
    licences,
    monthly_usd:
      extra * EXTRA_BASE_COMPUTE_USD_MONTH +
      data * DATA_COMPUTE_USD_MONTH +
      licences * ENTERPRISE_LICENCE_USD_MONTH,
  };
}
