//! The Lite AI station split (spec 6.4), with the archetype's data coverage (6.1) and the named
//! controller's Visionary trait. The split itself is `ops::stations::station_split` (F3).

use super::archetype::ArchetypeRow;
use super::inputs::has;
use crate::ops::stations::{SplitInputs, Stations, station_split};
use crate::people::traits::Trait;
use crate::world::units::USD_PER_MILLION;

/// Months a year: the 6.4 inflow is monthly (5.9 step 2).
pub const MONTHS_PER_YEAR: f64 = 12.0;

/// Monthly unstructured inflow, TB (spec 5.9 step 2): `revenue ($M) × data_tb_per_musd`, a
/// month of trailing annual revenue.
pub fn monthly_inflow_tb(annual_revenue_usd: f64, data_tb_per_musd: f64) -> f64 {
    annual_revenue_usd.max(0.0) / USD_PER_MILLION / MONTHS_PER_YEAR * data_tb_per_musd
}

/// The 6.4 split for a company with `labor` units: coverage from the archetype (6.1), research
/// only for a Visionary controller (none for a born company, 5.19.5).
pub fn plan_stations(
    labor: u64,
    archetype: &ArchetypeRow,
    inflow_tb: f64,
    traits: &[Trait],
) -> Stations {
    station_split(SplitInputs {
        labor,
        coverage: archetype.data_coverage,
        inflow_tb,
        visionary: has(traits, Trait::Visionary),
    })
}
