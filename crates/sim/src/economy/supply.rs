//! Fringe pools, supply, S and M (spec 5.2, 5.3, 7.2; 4.3 steps 3 and 6).
//!
//! - Fringe at load: `fringe_assets = max(0, world_size − Σ named revenue) ÷ turnover`,
//!   productivity 100, no decay; monthly `fringe_assets ×= (1 + q_growth)^(1/3)`, so the fringe
//!   grows with its industry's demand and keeps its share.
//! - `supply = fringe_assets × turnover + Σ units (assets_eff × turnover × p_pre ÷ 100)`, with
//!   `p_pre = productivity + PC bonus + location_bonus` (C12).
//! - `S = supply ÷ demand`; `M = clamp((1 ÷ S)^0.5, 0.7, 1.3)`.

use super::demand::{closing_rates, month_factor};
use super::{MONTHS_PER_YEAR, PRODUCTIVITY_SCALE};
use crate::time::JobCtx;
use crate::world::{BusinessUnit, Company, IndustryQuarter, Ordinal, World};

/// M's clamp (spec 5.2, T).
pub const M_MIN: f64 = 0.7;
pub const M_MAX: f64 = 1.3;
/// M = (1 ÷ S)^0.5 (spec 5.2, T).
pub const M_EXPONENT: f64 = 0.5;
/// The industry screen keeps 20 closed quarters (spec 8, 4.5).
pub const HISTORY_QUARTERS: usize = 20;

/// Fringe pool assets at load (spec 5.3, 7.2).
pub fn fringe_assets_at_load(world_size: f64, named_revenue: f64, turnover: f64) -> f64 {
    (world_size - named_revenue).max(0.0) / turnover
}

/// The fringe's month: `fringe_assets × (1 + q_growth)^(1/3)` (spec 5.3).
pub fn fringe_after_month(fringe_assets: f64, q_growth: f64) -> f64 {
    fringe_assets * month_factor(q_growth)
}

/// The fringe's supply a year at productivity 100 (spec 5.2).
pub fn fringe_supply(fringe_assets: f64, turnover: f64) -> f64 {
    fringe_assets * turnover
}

/// `p_pre = productivity + PC bonus + location_bonus` (spec 5.2, C12).
pub fn p_pre(unit: &BusinessUnit, company: &Company) -> f64 {
    unit.productivity + company.pc_bonus + unit.location_bonus
}

/// One unit's supply a year: `assets_eff × turnover × p_pre ÷ 100` (spec 5.2).
pub fn unit_supply(assets_eff: f64, turnover: f64, p_pre: f64) -> f64 {
    assets_eff * turnover * p_pre / PRODUCTIVITY_SCALE
}

/// `S = supply ÷ demand` (spec 5.2). Demand is above 0 for every industry with a world size; an
/// industry with none reads as fully oversupplied.
pub fn supply_ratio(supply: f64, demand: f64) -> f64 {
    if demand > 0.0 {
        supply / demand
    } else {
        f64::MAX
    }
}

/// `M = clamp((1 ÷ S)^0.5, 0.7, 1.3)` (spec 5.2).
pub fn market_factor(s: f64) -> f64 {
    if s <= 0.0 {
        return M_MAX;
    }
    (1.0 / s).powf(M_EXPONENT).clamp(M_MIN, M_MAX)
}

/// Sets every industry's supply, S and M from its fringe and units (units summed in id order).
pub fn set_supply(world: &mut World) {
    let mut named = vec![0.0; world.industries.len()];
    for (_, unit) in world.units.iter() {
        let turnover = world.industries[unit.industry].params.asset_turnover;
        let company = &world.companies[unit.company];
        // A Bankrupt company's capacity leaves supply (spec 5.12 step 2); a removed one's is in
        // the fringe (C30).
        if company.finance.status().is_frozen() {
            continue;
        }
        named[unit.industry.index()] +=
            unit_supply(unit.assets_eff(), turnover, p_pre(unit, company));
    }
    for (id, ind) in world.industries.iter_mut() {
        ind.supply =
            fringe_supply(ind.fringe_assets, ind.params.asset_turnover) + named[id.index()];
        ind.supply_ratio = supply_ratio(ind.supply, ind.demand);
        ind.market_factor = market_factor(ind.supply_ratio);
    }
}

/// 4.3 step 3: fringe pools grow or shrink with the closed month's growth (D100).
pub fn fringe_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let quarter_start = ctx.facts.is_quarter_start();
    for (_, ind) in world.industries.iter_mut() {
        let (q, _) = closing_rates(ind, quarter_start);
        ind.fringe_assets = fringe_after_month(ind.fringe_assets, q);
    }
}

/// 4.3 step 6: supply, S and M per industry; on a quarter's first day the closed quarter joins
/// the industry's 20-quarter history.
pub fn supply_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    set_supply(world);
    if ctx.facts.is_quarter_start() {
        let closed = ctx.facts.date.quarter().prev();
        for (_, ind) in world.industries.iter_mut() {
            ind.history.push(IndustryQuarter {
                quarter: closed,
                demand: ind.demand,
                supply: ind.supply,
                q_growth: ind.prev_q_growth,
                lt: ind.prev_lt,
            });
            if ind.history.len() > HISTORY_QUARTERS {
                ind.history.remove(0);
            }
        }
    }
}

/// Fringe revenue a month: `fringe_assets × turnover × M ÷ 12` (spec 5.3).
pub fn fringe_revenue_month(fringe_assets: f64, turnover: f64, m: f64) -> f64 {
    fringe_assets * turnover * m / MONTHS_PER_YEAR
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn market_factor_examples() {
        // Spec 5.2: S 1.21 gives M 0.91; S 0.81 gives M 1.11.
        assert!((market_factor(1.21) - 1.0 / 1.1).abs() < 1e-12);
        assert!((market_factor(0.81) - 1.0 / 0.9).abs() < 1e-12);
        assert_eq!(market_factor(1.0), 1.0);
        assert_eq!(market_factor(4.0), M_MIN);
        assert_eq!(market_factor(0.25), M_MAX);
    }

    #[test]
    fn fringe_keeps_its_share() {
        let (mut fringe, mut demand) = (60.0, 100.0);
        for q in [0.02, -0.03, 0.05] {
            fringe = fringe_after_month(fringe, q);
            demand *= month_factor(q);
        }
        assert!((fringe / demand - 0.6).abs() < 1e-15);
        assert_eq!(fringe_assets_at_load(100.0, 120.0, 1.0), 0.0);
    }
}
