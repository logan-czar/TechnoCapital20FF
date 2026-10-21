//! The dividend rule (spec 5.17; 10.5.5, 3.3.2; 6.5), ready for the plan lock (M6.3 calls it):
//! `dividend = payout ratio × NI` of the last quarter, if NI is above 0 and own cash after it
//! stays above the minimum cash; the payout ratio is the sector table's typical ratio × the
//! archetype's payout mult (6.1).

use super::credit::own_cash;
use super::distress::CompanyStatus;

/// The sector table's typical payout ratio (3-markets 3.3.2), one shared default for all 42
/// industries (D1: every industry is in the Default valuation group). 40% is the median of the
/// 3.3.2 typical payout column (D234).
pub const SECTOR_PAYOUT: f64 = 0.40;

/// Payout ratio (spec 5.17): `SECTOR_PAYOUT × archetype payout mult` (6.1: State champion 1.0,
/// Startup 0, Aggressive grower 0.5, Cash cow 1.3, Incumbent 1.0).
pub fn payout_ratio(archetype_payout_mult: f64) -> f64 {
    SECTOR_PAYOUT * archetype_payout_mult.max(0.0)
}

/// What the dividend reads at the plan lock (spec 5.17).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DividendInputs {
    /// Net income of the quarter just released.
    pub net_income: f64,
    pub cash: f64,
    pub line_drawn: f64,
    /// Spec 6 min_cash.
    pub min_cash: f64,
    /// [`payout_ratio`].
    pub payout_ratio: f64,
    pub status: CompanyStatus,
}

/// The dividend paid at the plan lock (spec 5.17): `payout ratio × NI` when NI is above 0, the
/// company is Active (5.12 step 1: no dividends while Distressed) and own cash after it stays
/// strictly above min_cash; otherwise nothing. The rule pays all of it or none of it, never a
/// part (D234).
pub fn dividend(i: &DividendInputs) -> f64 {
    if !i.status.may_pay_dividends() || i.net_income <= 0.0 {
        return 0.0;
    }
    let d = i.payout_ratio.max(0.0) * i.net_income;
    if d > 0.0 && own_cash(i.cash, i.line_drawn) - d > i.min_cash {
        d
    } else {
        0.0
    }
}
