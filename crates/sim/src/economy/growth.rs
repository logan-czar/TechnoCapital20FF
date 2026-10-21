//! The quarterly industry growth draw and the phase labels (spec 5.1, Logan batch 150; 4.3 steps
//! 1e and 2).
//!
//! `q_growth = lt_q + φ × (prev_q_growth − lt_q) + cycle_term + volatility × z`, floored at −25%
//! a quarter, with `lt_q = (1 + LT)^(1/4) − 1` and
//! `cycle_term = (1 − φ) × cycle_beta × k × Z × g_t ÷ 4`. The expression order follows
//! validate.py's `growth_run`, so the M2.10 replay matches it to the last bits.

use super::QUARTERS_PER_YEAR;
use crate::rng::{DrawSource, Stream};
use crate::time::JobCtx;
use crate::world::{Industry, PhaseLabel, World};

/// φ: half of last quarter's gap from the long-term rate carries over (spec 5.1, T).
pub const PHI: f64 = 0.5;
/// q_growth never falls below −25% a quarter (spec 5.1, A).
pub const Q_GROWTH_FLOOR: f64 = -0.25;
/// z, the growth shock, is a standard normal clamped to ±3 (spec 5.1).
pub const Z_CLAMP: f64 = 3.0;

/// The long-term rate at which an industry feels the cycle one for one (spec 5.1).
pub const K_PIVOT_LT: f64 = 0.04;
/// Upswing (g_t ≥ 0): `k = clamp(1 + 5 × (LT − 0.04), 0.5, 2.5)` (spec 5.1, T).
pub const K_UP_SLOPE: f64 = 5.0;
pub const K_UP_MIN: f64 = 0.5;
pub const K_UP_MAX: f64 = 2.5;
/// Downswing (g_t < 0): `k = clamp(1 − 2.5 × (LT − 0.04), 0.25, 1.5)` (spec 5.1, T).
pub const K_DOWN_SLOPE: f64 = 2.5;
pub const K_DOWN_MIN: f64 = 0.25;
pub const K_DOWN_MAX: f64 = 1.5;

/// A label's gap threshold: Bust at `gap ≤ −5%`, Boom at `gap ≥ +5%` a year (spec 5.1, A, T).
pub const LABEL_GAP: f64 = 0.05;
/// Glut when last month's S is above 1.15 (spec 5.1, T)...
pub const GLUT_ENTER_S: f64 = 1.15;
/// ...and it stays Glut until S falls under 1.10.
pub const GLUT_EXIT_S: f64 = 1.10;

/// `lt_q = (1 + LT)^(1/4) − 1`, the quarterly long-term rate (spec 5.1, batch 151).
pub fn lt_q(lt: f64) -> f64 {
    (1.0 + lt).powf(1.0 / QUARTERS_PER_YEAR) - 1.0
}

/// The asymmetric cycle sensitivity k (spec 5.1): high long-term growth amplifies upswings and
/// damps downswings.
pub fn cycle_k(lt: f64, g: f64) -> f64 {
    if g >= 0.0 {
        (1.0 + K_UP_SLOPE * (lt - K_PIVOT_LT)).clamp(K_UP_MIN, K_UP_MAX)
    } else {
        (1.0 - K_DOWN_SLOPE * (lt - K_PIVOT_LT)).clamp(K_DOWN_MIN, K_DOWN_MAX)
    }
}

/// `cycle_term = (1 − φ) × cycle_beta × k × Z × g_t ÷ 4` (spec 5.1).
pub fn cycle_term(cycle_beta: f64, lt: f64, z_avg: f64, g: f64) -> f64 {
    (1.0 - PHI) * cycle_beta * cycle_k(lt, g) * z_avg * g / QUARTERS_PER_YEAR
}

/// One quarter's growth (spec 5.1). `carry` is last quarter's growth, or lt_q after the boom or
/// the pop (spec 5.1.1); `z` is the already clamped shock.
pub fn quarterly_growth(
    lt: f64,
    carry: f64,
    cycle_beta: f64,
    volatility: f64,
    z_avg: f64,
    g: f64,
    z: f64,
) -> f64 {
    let ltq = lt_q(lt);
    let cycle = cycle_term(cycle_beta, lt, z_avg, g);
    (ltq + PHI * (carry - ltq) + cycle + volatility * z).max(Q_GROWTH_FLOOR)
}

/// The growth shock: a growth-stream standard normal clamped to ±3 (spec 5.1).
pub fn draw_z(draws: &mut dyn DrawSource) -> f64 {
    draws.normal(Stream::Growth).clamp(-Z_CLAMP, Z_CLAMP)
}

/// Draws one industry's growth for the new quarter: this quarter's growth becomes
/// `prev_q_growth`, and the draw carries over from it (or from lt_q after a reset, D103).
pub fn draw_industry_growth(ind: &mut Industry, z_avg: f64, g: f64, draws: &mut dyn DrawSource) {
    ind.prev_q_growth = ind.q_growth;
    let carry = if ind.carry_reset {
        lt_q(ind.lt)
    } else {
        ind.prev_q_growth
    };
    ind.carry_reset = false;
    let z = draw_z(draws);
    let p = &ind.params;
    ind.q_growth = quarterly_growth(ind.lt, carry, p.cycle_beta, p.volatility, z_avg, g, z);
}

/// Every industry's draw, in id order (spec 4.3 step 1e).
pub fn draw_all_growth(world: &mut World, draws: &mut dyn DrawSource) {
    let (z_avg, g) = (world.cycle.z_avg, world.cycle.g_t);
    for (_, ind) in world.industries.iter_mut() {
        draw_industry_growth(ind, z_avg, g, draws);
    }
}

/// 4.3 step 1e: every industry draws its q_growth for the new quarter.
pub fn growth_draws_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    draw_all_growth(world, ctx.draws);
}

/// `gap = 4 × (q_growth − lt_q)`: this quarter's growth less the long-term rate, a year (spec 5.1).
pub fn growth_gap(q_growth: f64, lt: f64) -> f64 {
    QUARTERS_PER_YEAR * (q_growth - lt_q(lt))
}

/// The phase label, first match (spec 5.1): Bust at gap ≤ −5%; Glut when last month's S is
/// above 1.15, or the label was Glut and S has not fallen under 1.10; Boom at gap ≥ +5%; else
/// Normal. `forced` is the AI boom's override for linked industries (spec 5.1.1), which wins
/// over every rule (D104).
pub fn phase_label(
    gap: f64,
    last_s: f64,
    was: PhaseLabel,
    forced: Option<PhaseLabel>,
) -> PhaseLabel {
    if let Some(label) = forced {
        return label;
    }
    if gap <= -LABEL_GAP {
        return PhaseLabel::Bust;
    }
    if last_s > GLUT_ENTER_S || (was == PhaseLabel::Glut && last_s >= GLUT_EXIT_S) {
        return PhaseLabel::Glut;
    }
    if gap >= LABEL_GAP {
        return PhaseLabel::Boom;
    }
    PhaseLabel::Normal
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn k_matches_the_spec_examples() {
        // Spec 5.1: an industry at 4% feels the cycle one for one; Oil at 0% gets 0.8 up and
        // 1.1 down; at LT 100% k is 2.5 up and 0.25 down (5.1.1).
        assert_eq!(cycle_k(0.04, 0.01), 1.0);
        assert!((cycle_k(0.0, 0.01) - 0.8).abs() < 1e-12);
        assert!((cycle_k(0.0, -0.01) - 1.1).abs() < 1e-12);
        assert_eq!(cycle_k(1.0, 0.01), 2.5);
        assert_eq!(cycle_k(1.0, -0.01), 0.25);
    }

    #[test]
    fn labels_first_match() {
        use PhaseLabel::*;
        assert_eq!(phase_label(-0.05, 1.3, Normal, None), Bust);
        assert_eq!(phase_label(0.06, 1.16, Normal, None), Glut);
        assert_eq!(phase_label(0.06, 1.12, Glut, None), Glut);
        assert_eq!(phase_label(0.06, 1.12, Normal, None), Boom);
        assert_eq!(phase_label(0.0, 1.09, Glut, None), Normal);
        assert_eq!(phase_label(0.049, 1.0, Normal, None), Normal);
        assert_eq!(phase_label(-0.2, 1.0, Normal, Some(Boom)), Boom);
    }

    #[test]
    fn floor_holds() {
        assert_eq!(
            quarterly_growth(0.0, -0.5, 1.0, 0.01, 1.0, -0.06, -3.0),
            -0.25
        );
    }
}
