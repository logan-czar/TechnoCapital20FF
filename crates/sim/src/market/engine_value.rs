//! Engine value at load (spec 7.1 Shares row, 5.13; batch 161): the 5.13 fair value of the
//! starting run rate, from which company-start.csv `open_price` and `shares` follow
//! (docs/design/tools/mvp-data/gen.py builds `engine_value_usd` the same way, D239, D240).
//!
//! 7.1 reads it with a flat synthetic history (g 0, so G = clamp(1 − 2.5 × lt, 0.5, 2.5) with
//! g_sector the industry's lt, D1), a Normal cycle, company confidence 1.0, X from the zone
//! `confidence_start` for listed companies (1.0 for private ones), line interest skipped (no
//! interest on cash either), the 5.13 book floor (0.9 for Real estate) and at least $100,000
//! (D244). It is [`fair_value`] on that basis, so the load V equals the first-release V when
//! the inputs have not moved.

use super::fair_value::{FairValueBasis, FairValueInputs, fair_value};
use crate::world::PhaseLabel;

/// Spec 7.1: the engine value is floored at $100,000 (the barebones company's one asset).
pub const MIN_ENGINE_VALUE_USD: f64 = 100_000.0;
/// Spec 7.1: g is 0 on the flat synthetic history.
pub const LOAD_REVENUE_GROWTH: f64 = 0.0;
/// Spec 7.1: a Normal cycle at load.
pub const LOAD_LABEL: PhaseLabel = PhaseLabel::Normal;
/// Spec 7.1: company confidence 1.0 at load.
pub const LOAD_COMPANY_CONFIDENCE: f64 = 1.0;

/// What the engine value reads for one starting company (spec 7.1).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EngineValueInputs {
    /// Starting book equity (company-start.csv `book_equity_usd`, D238).
    pub book_equity: f64,
    /// A year of run-rate EBIT, USD (the 7.1 loadout at productivity 100 and M 1.0 with the
    /// load plan, before line interest).
    pub run_rate_ebit: f64,
    /// The HQ country's corporate tax rate (country-economy.csv `corp_tax_rate`).
    pub tax_rate: f64,
    /// M_sector (industries.csv `earnings_multiple`).
    pub sector_multiple: f64,
    /// g_sector: the industry's lt at load (industries.csv `trend_growth`, D1).
    pub g_sector: f64,
    /// The home spread from the zone's base spread and the sovereign spread, rounded to whole
    /// bps (finance::credit::home_spread, D223, D235), a fraction.
    pub home_spread: f64,
    /// The zone's `confidence_start` for a listed company; `None` for a private one.
    pub listing_confidence: Option<f64>,
    /// [`super::fair_value::book_floor_share`] of the industry (0.9 for Real estate).
    pub book_floor_share: f64,
}

/// Run-rate net income at load (spec 7.1, 5.11): EBIT less tax when above 0, else the loss
/// (no carryforward at load, D228; no line interest, 7.1).
pub fn load_net_income(run_rate_ebit: f64, tax_rate: f64) -> f64 {
    if run_rate_ebit > 0.0 {
        run_rate_ebit * (1.0 - tax_rate)
    } else {
        run_rate_ebit
    }
}

/// Engine value at load (spec 7.1, 5.13): [`fair_value`] with E_norm the run-rate net income at
/// g 0, G at g 0 against the industry's lt, a Normal cycle, confidence 1.0 and X from
/// confidence_start, floored at the 5.13 book floor and then at $100,000. The per-share floor
/// does not apply: shares follow from this value.
pub fn engine_value_at_load(i: &EngineValueInputs) -> f64 {
    let ni = load_net_income(i.run_rate_ebit, i.tax_rate);
    let value = fair_value(&FairValueInputs {
        basis: FairValueBasis::at_release(Some(ni), LOAD_REVENUE_GROWTH, i.g_sector),
        book_equity: i.book_equity,
        sector_multiple: i.sector_multiple,
        home_spread: i.home_spread,
        label: LOAD_LABEL,
        company_confidence: LOAD_COMPANY_CONFIDENCE,
        listing_confidence: i.listing_confidence,
        book_floor_share: i.book_floor_share,
        shares_out: 0,
    });
    value.max(MIN_ENGINE_VALUE_USD)
}
