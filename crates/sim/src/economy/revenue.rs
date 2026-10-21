//! Unit revenue and expenses (spec 5.4, 5.5; 4.3 steps 7 and 9).
//!
//! `effective productivity = p_pre × M`; `revenue (month) = assets_eff × turnover × effective
//! productivity ÷ 100 ÷ 12`. A unit's share of the industry's revenue is its share of supply.
//!
//! Expenses per unit per month (5.5): variable `revenue × v` with `v = 1 − margin_full_use − f`
//! (D fixed at 1.0); fixed cash `gross_assets × fixed_cost_rate ÷ 12`; depreciation
//! `min(asset_book, decay_usd ÷ 12)`; R&D `revenue × rd_plan`; shared costs from the 3.8 compute
//! (M3; 0 until then). Fixed cash plus depreciation plus shared costs equal `f × revenue` at
//! productivity 100 and M 1.0 (the fixed cost rate is set so at load, 7.1), so with R&D at the
//! norm (`margin_full_use = rd_norm`, C18) a company at productivity 100 and M 1.0 breaks even.

use super::assets::decay_usd;
use super::supply::{fringe_revenue_month, p_pre};
use super::{MONTHS_PER_YEAR, PRODUCTIVITY_SCALE};
use crate::time::JobCtx;
use crate::world::{BusinessUnit, IndustryParams, Ordinal, World};

/// A unit's month of revenue (spec 5.4).
pub fn unit_revenue_month(assets_eff: f64, turnover: f64, p_pre: f64, m: f64) -> f64 {
    assets_eff * turnover * (p_pre * m) / PRODUCTIVITY_SCALE / MONTHS_PER_YEAR
}

/// `v = 1 − margin_full_use − f` (spec 5.5).
pub fn variable_cost_share(p: &IndustryParams) -> f64 {
    1.0 - p.margin_full_use - p.fixed_cost_share
}

/// One unit's month of 5.5 expenses.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MonthExpenses {
    pub variable: f64,
    pub fixed: f64,
    pub depreciation: f64,
    pub rd: f64,
    pub shared: f64,
}

impl MonthExpenses {
    pub fn total(&self) -> f64 {
        self.variable + self.fixed + self.depreciation + self.rd + self.shared
    }
}

/// The 5.5 lines for a month of `revenue` from a unit with `gross_assets` at cost and
/// `asset_book`, a `fixed_cost_rate` a year per $1 of gross, `rd_plan` of revenue, the industry's
/// parameters and the month's shared costs.
pub fn month_expenses(
    revenue: f64,
    gross_assets: f64,
    asset_book: f64,
    fixed_cost_rate: f64,
    rd_plan: f64,
    params: &IndustryParams,
    shared: f64,
) -> MonthExpenses {
    MonthExpenses {
        variable: revenue * variable_cost_share(params),
        fixed: gross_assets * fixed_cost_rate / MONTHS_PER_YEAR,
        depreciation: asset_book.min(decay_usd(gross_assets, params) / MONTHS_PER_YEAR),
        rd: revenue * rd_plan,
        shared,
    }
}

/// The month's shared costs of a unit (spec 5.5: corporation compute, data compute and licences
/// of 3.8, split across units by revenue share). **Hook for M3.5**: 0 until the compute costs
/// exist; while it is 0 the fixed cost rate at load carries the whole fixed share (7.1).
pub fn shared_costs_month_hook(_world: &World, _unit: &BusinessUnit) -> f64 {
    0.0
}

/// Sets every unit's month of revenue and every industry's fringe revenue from the current M.
pub fn set_revenue(world: &mut World) {
    for (_, unit) in world.units.iter_mut() {
        let ind = &world.industries[unit.industry];
        let p = p_pre(unit, &world.companies[unit.company]);
        unit.revenue_m = unit_revenue_month(
            unit.assets_eff(),
            ind.params.asset_turnover,
            p,
            ind.market_factor,
        );
    }
    for (_, ind) in world.industries.iter_mut() {
        ind.fringe_revenue_m = fringe_revenue_month(
            ind.fringe_assets,
            ind.params.asset_turnover,
            ind.market_factor,
        );
    }
}

/// Sets every unit's month of expenses from its revenue and assets.
pub fn set_expenses(world: &mut World) {
    let shared: Vec<f64> = world
        .units
        .iter()
        .map(|(_, u)| shared_costs_month_hook(world, u))
        .collect();
    for (id, unit) in world.units.iter_mut() {
        let params = &world.industries[unit.industry].params;
        let e = month_expenses(
            unit.revenue_m,
            unit.gross_assets,
            unit.asset_book,
            unit.fixed_cost_rate,
            unit.rd_plan,
            params,
            shared[id.index()],
        );
        unit.variable_m = e.variable;
        unit.fixed_m = e.fixed;
        unit.dep_m = e.depreciation;
        unit.rd_m = e.rd;
        unit.shared_m = e.shared;
    }
}

/// 4.3 step 7: unit revenue (and the fringe's).
pub fn revenue_job(world: &mut World, _: &mut JobCtx<'_>) {
    set_revenue(world);
}

/// 4.3 step 9 (economy part): variable, fixed, depreciation, R&D and shared costs.
pub fn expenses_job(world: &mut World, _: &mut JobCtx<'_>) {
    set_expenses(world);
}
