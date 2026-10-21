//! The Lite AI's inputs (spec 6 table): g_dem, S, ROA, loss_q, liquidity, min_cash and the
//! traits it reads.

use crate::economy::growth::{PHI, lt_q};
use crate::finance::credit::{CreditLine, own_cash};
use crate::people::traits::Trait;

pub use crate::finance::credit::min_cash;

/// Spec 6 g_dem: the AI projects the next 4 quarters.
pub const G_DEM_QUARTERS: i32 = 4;

/// The fade of this quarter's gap over the next four quarters (spec 6 g_dem):
/// `φ + φ² + φ³ + φ⁴`, 0.9375 at φ 0.5 (spec: "0.94 × the gap").
pub fn gap_fade() -> f64 {
    (1..=G_DEM_QUARTERS).map(|k| PHI.powi(k)).sum()
}

/// Projected demand growth for the next 4 quarters, a year (spec 6 g_dem, batch 150):
/// `LT + (φ + φ² + φ³ + φ⁴) × (q_growth − lt_q)`, with LT the industry's current lt (the AI
/// does not foresee the boom or the pop, 5.1.1) and `lt_q = (1 + LT)^(1/4) − 1` (5.1). Retail
/// in a Contraction (LT 3%, q_growth −0.5%) projects 1.8%.
pub fn g_dem(lt: f64, q_growth: f64) -> f64 {
    lt + gap_fade() * (q_growth - lt_q(lt))
}

/// Return on assets (spec 6 ROA): trailing 4-quarter EBIT ÷ gross assets; 0 with no assets.
/// A company born at this lock has no quarter yet: the caller passes its run-rate EBIT, the
/// same run rate its rating is implied from (5.19.3; D262).
pub fn roa(ttm_ebit: f64, gross_assets: f64) -> f64 {
    if gross_assets > 0.0 {
        ttm_ebit / gross_assets
    } else {
        0.0
    }
}

/// loss_q after a closed quarter (spec 6, 3.6 `loss_quarters`): one more when the quarter's
/// EBIT is below 0, else back to 0. Loads at 0 (7.1 Plan row) and is 0 at birth.
pub fn next_loss_quarters(loss_q: u32, quarter_ebit: f64) -> u32 {
    if quarter_ebit < 0.0 { loss_q + 1 } else { 0 }
}

/// Liquidity (spec 6): own cash (cash − line drawn, floored at 0; C10) plus the undrawn line.
pub fn liquidity(cash: f64, line: &CreditLine) -> f64 {
    own_cash(cash, line.drawn) + line.available()
}

/// The traits the Lite AI reads (spec 6 "traits", 5.19.5): the named controller's when the
/// controller is a character, else none; a company born in play reads none, whatever its
/// founders' traits (Logan, batch 165, 3a; C33).
pub fn plan_traits(controller_traits: Option<&[Trait]>, born_in_play: bool) -> &[Trait] {
    match controller_traits {
        Some(t) if !born_in_play => t,
        _ => &[],
    }
}

/// True if `traits` holds `t`.
pub fn has(traits: &[Trait], t: Trait) -> bool {
    traits.contains(&t)
}
