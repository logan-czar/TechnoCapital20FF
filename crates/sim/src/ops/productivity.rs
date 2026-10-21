//! Productivity decay and the R&D effect (spec 5.6; 10.0.4, 10.5.2, 10.0.11.3).

use crate::people::management::mgmt_factor;

use super::stations::Stations;

/// Spec 5.6: the R&D effect's points a year per 1× of rd_norm above the norm.
pub const RD_EFFECT_POINTS_PER_YEAR: f64 = 10.0;
/// Months in a year (the `÷ 12` of 5.6).
pub const MONTHS_PER_YEAR: f64 = 12.0;
/// Spec 5.6: decay 0.5 a month.
pub const DECAY_PER_MONTH: f64 = 0.5;
/// Spec 5.6: 0.4 with 10%+ of labor idle.
pub const DECAY_SOME_IDLE: f64 = 0.4;
/// Spec 5.6: 0.3 with 25%+ idle.
pub const DECAY_MUCH_IDLE: f64 = 0.3;
/// Spec 5.6: the idle percent thresholds.
pub const SOME_IDLE_PERCENT: u64 = 10;
pub const MUCH_IDLE_PERCENT: u64 = 25;
/// Spec 5.6: productivity clamp (T).
pub const PRODUCTIVITY_MIN: f64 = 30.0;
pub const PRODUCTIVITY_MAX: f64 = 200.0;
/// Spec 5.6: research multiplier +0.01 per 10× of research labor (×1.01 at 1 to 9).
pub const RESEARCH_MULT_STEP: f64 = 0.01;
/// Integer percent divisor.
const PERCENT: u64 = 100;

/// Research multiplier (spec 5.6; 10.0.11.3): 0 research units ×1.00; 1 to 9 ×1.01; 10 to 99
/// ×1.02; 100 to 999 ×1.03; +0.01 per further 10×. Counted by decimal digits, exactly (D211).
pub fn research_mult(research_units: u64) -> f64 {
    let digits = if research_units == 0 {
        0
    } else {
        research_units.ilog10() + 1
    };
    1.0 + RESEARCH_MULT_STEP * f64::from(digits)
}

/// Monthly productivity decay (spec 5.6; 10.0.11.3): 0.5; 0.4 with 10%+ of labor idle; 0.3 with
/// 25%+ idle. Shares are compared in whole units (`idle × 100 ≥ 25 × L`), so no rounding (D211).
pub fn idle_decay(idle: u64, labor: u64) -> f64 {
    let l = labor.max(1);
    if idle * PERCENT >= MUCH_IDLE_PERCENT * l {
        DECAY_MUCH_IDLE
    } else if idle * PERCENT >= SOME_IDLE_PERCENT * l {
        DECAY_SOME_IDLE
    } else {
        DECAY_PER_MONTH
    }
}

/// What the 5.6 step reads for one unit.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ProductivityInputs {
    /// The locked R&D plan, a fraction of revenue.
    pub rd_plan: f64,
    /// Free R&D from held data, a fraction of revenue (5.9; `free_rd_pct ÷ 100`).
    pub free_rd: f64,
    /// The industry's R&D norm.
    pub rd_norm: f64,
    /// The corporation's management score, 0 to 100 (5.7).
    pub management_score: f64,
    /// Research stations.
    pub research_units: u64,
    /// Idle stations.
    pub idle_units: u64,
    /// Labor units L.
    pub labor: u64,
}

impl ProductivityInputs {
    /// The inputs for `stations` (research and idle from it, L its total).
    pub fn with_stations(
        rd_plan: f64,
        free_rd: f64,
        rd_norm: f64,
        management_score: f64,
        stations: &Stations,
    ) -> ProductivityInputs {
        ProductivityInputs {
            rd_plan,
            free_rd,
            rd_norm,
            management_score,
            research_units: stations.research,
            idle_units: stations.idle,
            labor: stations.total(),
        }
    }
}

/// The month's productivity change (spec 5.6):
/// `Δ = (10 × (rd_total ÷ rd_norm − 1) × mgmt_factor × research_mult) ÷ 12 − decay`, with
/// `rd_total = rd_plan + free_rd_pct` (free R&D works exactly like spending, 10.0.11.7).
pub fn productivity_delta(inp: &ProductivityInputs) -> f64 {
    assert!(inp.rd_norm > 0.0, "rd_norm must be positive");
    let rd_total = inp.rd_plan + inp.free_rd;
    RD_EFFECT_POINTS_PER_YEAR
        * (rd_total / inp.rd_norm - 1.0)
        * mgmt_factor(inp.management_score)
        * research_mult(inp.research_units)
        / MONTHS_PER_YEAR
        - idle_decay(inp.idle_units, inp.labor)
}

/// Productivity after one month (spec 5.6), clamped to 30 to 200.
pub fn step_productivity(productivity: f64, inp: &ProductivityInputs) -> f64 {
    (productivity + productivity_delta(inp)).clamp(PRODUCTIVITY_MIN, PRODUCTIVITY_MAX)
}
