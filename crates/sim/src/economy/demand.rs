//! Monthly demand, trend demand, the rate term and the phase labels (spec 5.1; 4.3 step 2).
//!
//! Each month `demand_core ×= (1 + q_growth)^(1/3)` and `trend_demand ×= (1 + LT)^(1/12)`;
//! effective demand `= demand_core × (1 − s × (base_rate − neutral_rate))`. The monthly job closes
//! the month just ended, so the growth used is that month's quarter's (D100): on a quarter's first
//! day, after step 1 has drawn the new quarter, it is last quarter's `prev_q_growth` and `prev_lt`.

use super::ai_boom::forced_label;
use super::growth::{growth_gap, phase_label};
use super::{MONTHS_PER_QUARTER, MONTHS_PER_YEAR};
use crate::time::{Date, JobCtx};
use crate::world::{Industry, World};

/// One month's factor of a quarter's growth: `(1 + q_growth)^(1/3)` (spec 5.1).
pub fn month_factor(q_growth: f64) -> f64 {
    (1.0 + q_growth).powf(1.0 / MONTHS_PER_QUARTER)
}

/// One month's factor of a yearly rate: `(1 + LT)^(1/12)` (spec 5.1).
pub fn trend_month_factor(lt: f64) -> f64 {
    (1.0 + lt).powf(1.0 / MONTHS_PER_YEAR)
}

/// `demand = demand_core × (1 − s × (base_rate − neutral_rate))` (spec 5.1).
pub fn effective_demand(
    demand_core: f64,
    rate_sensitivity: f64,
    base_rate: f64,
    neutral_rate: f64,
) -> f64 {
    demand_core * (1.0 - rate_sensitivity * (base_rate - neutral_rate))
}

/// The quarterly growth and long-term rate of the month the job closes (D100): this quarter's,
/// or on a quarter's first day the quarter before's.
pub fn closing_rates(ind: &Industry, quarter_start: bool) -> (f64, f64) {
    if quarter_start {
        (ind.prev_q_growth, ind.prev_lt)
    } else {
        (ind.q_growth, ind.lt)
    }
}

/// Sets every industry's effective demand from its core (the rate term).
pub fn set_effective_demand(world: &mut World) {
    let (base, neutral) = (world.base_rate, world.neutral_rate);
    for (_, ind) in world.industries.iter_mut() {
        ind.demand = effective_demand(ind.demand_core, ind.params.rate_sensitivity, base, neutral);
    }
}

/// Sets every industry's phase label from this quarter's growth and last month's S (spec 5.1).
pub fn set_phase_labels(world: &mut World, date: Date) {
    for (_, ind) in world.industries.iter_mut() {
        let forced = forced_label(ind.params.boom_uplift, &world.ai, date);
        ind.phase_label = phase_label(
            growth_gap(ind.q_growth, ind.lt),
            ind.supply_ratio,
            ind.phase_label,
            forced,
        );
    }
}

/// 4.3 step 2: demand moves by a third of the quarter's growth, trend demand by a twelfth of the
/// year's rate; the rate term; phase labels from q_growth and last month's S.
pub fn demand_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let quarter_start = ctx.facts.is_quarter_start();
    for (_, ind) in world.industries.iter_mut() {
        let (q, lt) = closing_rates(ind, quarter_start);
        ind.demand_core *= month_factor(q);
        ind.trend_demand *= trend_month_factor(lt);
    }
    set_effective_demand(world);
    set_phase_labels(world, ctx.facts.date);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn three_months_make_the_quarter() {
        let f = month_factor(0.03);
        assert!((f * f * f - 1.03).abs() < 1e-15);
        let t = trend_month_factor(0.05);
        assert!((t.powi(12) - 1.05).abs() < 1e-14);
    }

    #[test]
    fn rate_term_is_zero_at_neutral() {
        assert_eq!(effective_demand(100.0, 1.0, 0.03, 0.03), 100.0);
        assert!((effective_demand(100.0, 2.0, 0.05, 0.03) - 96.0).abs() < 1e-12);
    }
}
