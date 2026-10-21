//! Engine value at load (spec 7.1 Shares row, 5.13; batch 161): the 5.13 fair value of the
//! starting run rate, as docs/design/tools/mvp-data/gen.py builds company-start.csv
//! `engine_value_usd`, from which `open_price` and `shares` follow.
//!
//! 7.1 reads it with a flat synthetic history (g 0, and G 1: D244), a Normal cycle, company
//! confidence 1.0, X from the zone `confidence_start` for listed companies (1.0 for private
//! ones) and line interest skipped (no interest on cash either), floored at $100,000. The book
//! floor is 0.6 for every industry at load, as the data was built (D244, design fix 231).

use super::fair_value::{
    BOOK_FLOOR_SHARE, BOOK_WEIGHT, EARNINGS_WEIGHT, exchange_factor, rate_factor,
};

/// Spec 7.1: the engine value is floored at $100,000 (the barebones company's one asset).
pub const MIN_ENGINE_VALUE_USD: f64 = 100_000.0;
/// Spec 7.1 (D244): the flat synthetic history is read as growth at the sector rate, G 1.
pub const LOAD_GROWTH_FACTOR: f64 = 1.0;
/// Spec 7.1: a Normal cycle at load.
pub const LOAD_CYCLE_FACTOR: f64 = 1.0;
/// Spec 7.1: company confidence 1.0 at load.
pub const LOAD_COMPANY_CONFIDENCE: f64 = 1.0;

/// What the engine value reads for one starting company (spec 7.1).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EngineValueInputs {
    /// Starting book equity (company-start.csv `book_equity_usd`, D15).
    pub book_equity: f64,
    /// A year of run-rate EBIT, USD (the 7.1 loadout at productivity 100 and M 1.0 with the
    /// load plan, before line interest).
    pub run_rate_ebit: f64,
    /// The HQ country's corporate tax rate (country-economy.csv `corp_tax_rate`).
    pub tax_rate: f64,
    /// M_sector (industries.csv `earnings_multiple`).
    pub sector_multiple: f64,
    /// Home spread from the zone's base spread and the sovereign spread (D235), a fraction.
    pub home_spread: f64,
    /// The zone's `confidence_start` for a listed company; `None` for a private one.
    pub listing_confidence: Option<f64>,
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

/// Engine value at load (spec 7.1, 5.13): with net income NI of the run rate,
/// `(0.3 × book + 0.7 × NI × M_sector × R) × X` when NI is above 0 (E_norm = NI at g 0;
/// G, cycle and confidence 1), else `book × X`; then at least `0.6 × book` and $100,000.
pub fn engine_value_at_load(i: &EngineValueInputs) -> f64 {
    let x = exchange_factor(i.listing_confidence);
    let ni = load_net_income(i.run_rate_ebit, i.tax_rate);
    let value = if ni > 0.0 {
        let multiple = i.sector_multiple * LOAD_GROWTH_FACTOR * rate_factor(i.home_spread);
        (BOOK_WEIGHT * i.book_equity
            + EARNINGS_WEIGHT * ni * multiple * LOAD_CYCLE_FACTOR * LOAD_COMPANY_CONFIDENCE)
            * x
    } else {
        i.book_equity * LOAD_CYCLE_FACTOR * x
    };
    value
        .max(BOOK_FLOOR_SHARE * i.book_equity.max(0.0))
        .max(MIN_ENGINE_VALUE_USD)
}
