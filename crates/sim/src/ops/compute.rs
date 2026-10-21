//! Compute and software costs at the corporation level (spec 3.8; 10.0.11.1, 15.2).
//!
//! The bundled desktop, base compute and productivity seat (one per labor unit) sit inside fixed
//! costs; this module prices the rest. The monthly total is the corporation's shared costs,
//! split across its units by revenue share (5.5).

use serde::{Deserialize, Serialize};

use super::stations::Stations;

/// Spec 3.8: extra base compute is at least this many units.
pub const MIN_EXTRA_BASE_COMPUTE: u64 = 9;
/// Spec 3.8: extra base compute is `ceil(0.2 × stations)`, i.e. one per this many stations
/// (integer ceiling, so 0.2 × 15 is 3, not 4 from float rounding; D209).
pub const STATIONS_PER_EXTRA_BASE_COMPUTE: u64 = 5;
/// Spec 3.8: data compute is at least this many units.
pub const MIN_DATA_COMPUTE: u64 = 10;
/// Spec 3.8: data compute is `ceil(1.2 × TB stored ÷ 100)`.
pub const DATA_COMPUTE_PER_100_TB: f64 = 1.2;
/// Spec 3.8: TB in the data compute divisor.
pub const DATA_COMPUTE_TB_DIVISOR: f64 = 100.0;
/// Spec 3.8: $50 a month per extra base compute (maintenance 1 × $50, 15.2).
pub const EXTRA_BASE_COMPUTE_USD_MONTH: f64 = 50.0;
/// Spec 3.8: $10 a month per data compute (maintenance 0.2 × $50).
pub const DATA_COMPUTE_USD_MONTH: f64 = 10.0;
/// Spec 3.8: $30 a month per enterprise licence (10.0.11.1).
pub const ENTERPRISE_LICENCE_USD_MONTH: f64 = 30.0;

/// A month's compute and licences (spec 3.8).
#[derive(Debug, Clone, Copy, PartialEq, Default, Serialize, Deserialize)]
pub struct ComputeBill {
    pub extra_base_compute: u64,
    pub data_compute: u64,
    pub licences: u64,
    /// The month's cost, USD.
    pub monthly_usd: f64,
}

/// Extra base compute (spec 3.8): `max(9, ceil(0.2 × stations))`; stations are all of them, one
/// per labor unit (D209).
pub fn extra_base_compute(station_count: u64) -> u64 {
    station_count
        .div_ceil(STATIONS_PER_EXTRA_BASE_COMPUTE)
        .max(MIN_EXTRA_BASE_COMPUTE)
}

/// Data compute (spec 3.8): `max(10, ceil(1.2 × TB stored ÷ 100))`, auto-scaled monthly. TB
/// stored is held plus unstructured data over all industries (D209).
pub fn data_compute(tb_stored: f64) -> u64 {
    let need = (DATA_COMPUTE_PER_100_TB * tb_stored.max(0.0) / DATA_COMPUTE_TB_DIVISOR).ceil();
    (need as u64).max(MIN_DATA_COMPUTE)
}

/// The month's compute and licence bill (spec 3.8).
pub fn compute_bill(stations: &Stations, tb_stored: f64) -> ComputeBill {
    let extra = extra_base_compute(stations.total());
    let data = data_compute(tb_stored);
    let licences = stations.licences();
    ComputeBill {
        extra_base_compute: extra,
        data_compute: data,
        licences,
        monthly_usd: extra as f64 * EXTRA_BASE_COMPUTE_USD_MONTH
            + data as f64 * DATA_COMPUTE_USD_MONTH
            + licences as f64 * ENTERPRISE_LICENCE_USD_MONTH,
    }
}
