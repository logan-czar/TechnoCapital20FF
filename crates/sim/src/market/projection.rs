//! Projections and consensus (spec 5.16; 21.5.1): the consensus set at the plan lock from the
//! no-rolls projection, and the shown range around a projection, which narrows as the quarter
//! passes, ×2 for a company whose plan is secret, never under ±3%.

use crate::rng::{DrawSource, Stream};
use crate::time::DateTime;

/// Spec 5.16: `consensus = projection × (1 + e)`, e uniform ±5% (T).
pub const CONSENSUS_ERROR: f64 = 0.05;
/// Spec 5.16 (21.5.1): the range starts at ±30% ...
pub const RANGE_BASE: f64 = 0.30;
/// ... narrows by `1 − 0.6 × share of the quarter elapsed` ...
pub const RANGE_ELAPSED_SHRINK: f64 = 0.6;
/// ... and by `1 − viewer's Finance ÷ 50`; the MVP viewer (the observer) has Finance 24.
pub const RANGE_FINANCE_DIVISOR: f64 = 50.0;
pub const OBSERVER_FINANCE: f64 = 24.0;
/// ... ×0.7 with Pdoomberg (the observer always has it in the MVP) ...
pub const RANGE_PDOOMBERG_MULT: f64 = 0.7;
/// ... ×2 for a company whose plan is secret (all of them, for the observer) ...
pub const RANGE_SECRET_MULT: f64 = 2.0;
/// ... and never under ±3%.
pub const RANGE_MIN: f64 = 0.03;

/// The consensus for the quarter (spec 5.16): `projection × (1 + e)`, e = −5% + 10% × u from one
/// prices-stream uniform (D252). With NoNoise (u = 0.5) the consensus is the projection.
pub fn consensus(projection: f64, draws: &mut dyn DrawSource) -> f64 {
    let e = CONSENSUS_ERROR * (2.0 * draws.uniform(Stream::Prices) - 1.0);
    projection * (1.0 + e)
}

/// Share of the calendar quarter elapsed at `t`, 0 to 1 (spec 21.5.1; D252): hours since 00:00
/// on the quarter's first day ÷ the quarter's hours. The projection is of the calendar quarter
/// the plan lock falls in (accounting quarters are calendar quarters, 4.4).
pub fn elapsed_share(t: DateTime) -> f64 {
    let q = t.date().quarter();
    let start = DateTime::midnight(q.first_day()).hours();
    let end = DateTime::midnight(q.next().first_day()).hours();
    (f64::from(t.hours() - start) / f64::from(end - start)).clamp(0.0, 1.0)
}

/// Who views the range (spec 21.5.1): the MVP has only the observer.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RangeViewer {
    /// The viewer's Finance skill.
    pub finance: f64,
    pub has_pdoomberg: bool,
    /// True when the viewer cannot see the company's plan (2× wider).
    pub plan_secret: bool,
}

impl RangeViewer {
    /// The MVP observer (spec 5.16): Finance 24, Pdoomberg, every plan secret.
    pub const OBSERVER: RangeViewer = RangeViewer {
        finance: OBSERVER_FINANCE,
        has_pdoomberg: true,
        plan_secret: true,
    };
}

/// The range half-width as a share of the projection (spec 5.16, 21.5.1):
/// `max(3%, 30% × (1 − 0.6 × elapsed) × (1 − Finance ÷ 50) × 0.7 (Pdoomberg) × 2 (secret))`.
pub fn range_width(elapsed_share: f64, viewer: RangeViewer) -> f64 {
    let mut w = RANGE_BASE
        * (1.0 - RANGE_ELAPSED_SHRINK * elapsed_share.clamp(0.0, 1.0))
        * (1.0 - viewer.finance / RANGE_FINANCE_DIVISOR).max(0.0);
    if viewer.has_pdoomberg {
        w *= RANGE_PDOOMBERG_MULT;
    }
    if viewer.plan_secret {
        w *= RANGE_SECRET_MULT;
    }
    w.max(RANGE_MIN)
}

/// The shown range (low, high) around `projection` (spec 5.16): `projection ∓ |projection| × w`,
/// so the low end stays below the high end for a projected loss. For a secret plan (every
/// company, for the observer) the centre is the consensus, not the engine's projection
/// (21.5.1 "the range uses analysts' consensus").
pub fn range(projection: f64, width: f64) -> (f64, f64) {
    let half = projection.abs() * width;
    (projection - half, projection + half)
}
