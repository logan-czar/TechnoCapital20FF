//! The R&D plan (spec 6.3): the target from rd_norm, the archetype R&D mult, the productivity
//! adjustment and the trait mults, cut in a loss, less free R&D, clamped to 0 to 3 × rd_norm.

use super::inputs::has;
use crate::people::traits::Trait;

/// Spec 6.3: +0.25 below productivity 95.
pub const LOW_PRODUCTIVITY_BELOW: f64 = 95.0;
pub const LOW_PRODUCTIVITY_ADJ: f64 = 0.25;
/// Spec 6.3: −0.2 above productivity 110.
pub const HIGH_PRODUCTIVITY_ABOVE: f64 = 110.0;
pub const HIGH_PRODUCTIVITY_ADJ: f64 = -0.2;
/// Spec 6.3 trait mults (T).
pub const RD_MULT_GREEDY: f64 = 0.8;
pub const RD_MULT_VISIONARY: f64 = 1.25;
pub const RD_MULT_CONSERVATIVE: f64 = 0.9;
pub const RD_MULT_DILIGENT: f64 = 1.1;
/// Spec 6.3: loss_q ≥ 2 cuts the target ×0.8 ...
pub const LOSS_CUT_QUARTERS: u32 = 2;
pub const LOSS_CUT: f64 = 0.8;
/// ... never below 0.5 × rd_norm.
pub const LOSS_CUT_FLOOR_NORMS: f64 = 0.5;
/// Spec 6.3: rd_plan is clamped to 0 to 3 × rd_norm.
pub const RD_PLAN_MAX_NORMS: f64 = 3.0;
/// free_rd_pct is a whole percent (5.9); rd_plan is a fraction of revenue (D211).
pub const PERCENT: f64 = 100.0;

/// The productivity adjustment (spec 6.3): +0.25 below 95, −0.2 above 110, else 0.
pub fn productivity_adj(productivity: f64) -> f64 {
    if productivity < LOW_PRODUCTIVITY_BELOW {
        LOW_PRODUCTIVITY_ADJ
    } else if productivity > HIGH_PRODUCTIVITY_ABOVE {
        HIGH_PRODUCTIVITY_ADJ
    } else {
        0.0
    }
}

/// The trait mult (spec 6.3): Greedy 0.8, Visionary 1.25, Conservative 0.9, Diligent 1.1; a
/// controller with several takes their product (D264); 1.0 with none.
pub fn trait_mult(traits: &[Trait]) -> f64 {
    [
        (Trait::Greedy, RD_MULT_GREEDY),
        (Trait::Visionary, RD_MULT_VISIONARY),
        (Trait::Conservative, RD_MULT_CONSERVATIVE),
        (Trait::Diligent, RD_MULT_DILIGENT),
    ]
    .iter()
    .filter(|(t, _)| has(traits, *t))
    .map(|(_, m)| m)
    .product()
}

/// What the R&D plan reads (spec 6.3).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RdInputs<'a> {
    /// industries.csv `rd_norm`.
    pub rd_norm: f64,
    /// The archetype's R&D mult (6.1).
    pub archetype_rd_mult: f64,
    pub productivity: f64,
    /// The traits the AI reads (none for a born company, 5.19.5).
    pub traits: &'a [Trait],
    pub loss_q: u32,
    /// This month's free R&D, whole percent (5.9 `free_rd_pct`).
    pub free_rd_pct: u32,
}

/// The R&D target before free R&D (spec 6.3): `rd_norm × (archetype R&D mult + productivity
/// adj) × trait mult`; with loss_q ≥ 2 ×0.8, but the cut never takes it below 0.5 × rd_norm (a
/// target already under that floor is not lifted, D264).
pub fn rd_target(i: &RdInputs<'_>) -> f64 {
    let target =
        i.rd_norm * (i.archetype_rd_mult + productivity_adj(i.productivity)) * trait_mult(i.traits);
    if i.loss_q >= LOSS_CUT_QUARTERS {
        (target * LOSS_CUT).max(target.min(LOSS_CUT_FLOOR_NORMS * i.rd_norm))
    } else {
        target
    }
}

/// The locked R&D plan, a fraction of revenue (spec 6.3): `max(0, target − free_rd_pct)`, so
/// held data saves cash, clamped to 0 to 3 × rd_norm. Arrowhead (Cash cow, Greedy, 1% free):
/// 0.05 × 0.7 × 0.8 − 0.01 = 1.8% (7.1).
pub fn rd_plan(i: &RdInputs<'_>) -> f64 {
    let free = f64::from(i.free_rd_pct) / PERCENT;
    (rd_target(i) - free).clamp(0.0, RD_PLAN_MAX_NORMS * i.rd_norm)
}
