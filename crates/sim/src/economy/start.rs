//! The economy's start state (spec 7.1 load slice, 7.2, 7.3).
//!
//! [`World::from_data`](crate::world::World::from_data) builds everything load sets without a
//! draw, calling the 7.1 and 7.2 formulas here (PC bonus at load, gross assets, fixed cost rate,
//! fringe pools). [`start`] then makes the 7.3 draws at 2020-01-01 00:00: the pop date, the cycle's
//! start, the zone shocks and the Q1 2020 growth draw, and sets what follows from them (zone
//! effects and spreads, supply, S, M, labels and the units' starting month of revenue and
//! expenses).
//!
//! **Note for lane F (M3.4):** the PC bonus here is only the 7.1 load rule (productivity stations
//! `max(1, round(0.25 × labor units))`, two passes). M3's monthly compute step (5.8, 4.3 step 5)
//! owns `Company::pc_bonus` from the first month on; [`pc_bonus_steps`] is the 5.8 step table and
//! can be shared.

use super::PRODUCTIVITY_SCALE;
use super::ai_boom::{ai_labs_lt, roll_pop_date, set_industry_lt, stage_at};
use super::assets::decay_usd;
use super::cycle::{set_zone_effects, start_cycle};
use super::demand::{set_effective_demand, set_phase_labels};
use super::growth::{draw_all_growth, lt_q};
use super::revenue::{set_expenses, set_revenue};
use super::supply::set_supply;
use super::zones::set_zone_spreads;
use crate::rng::DrawSource;
use crate::time::DateTime;
use crate::world::{IndustryParams, World};

/// Productivity of every unit at load (spec 7.1, A).
pub const START_PRODUCTIVITY: f64 = 100.0;
/// Productivity stations at load: `max(1, round(0.25 × L))` (spec 7.1, 10.0.11.8).
pub const LOAD_STATION_SHARE: f64 = 0.25;
/// Below $0.1M of revenue a company starts with the barebones loadout (spec 7.1).
pub const BAREBONES_REVENUE_USD: f64 = 100_000.0;
/// The barebones loadout's one asset (spec 7.1, 10.0.11.1).
pub const BAREBONES_GROSS_USD: f64 = 100_000.0;
/// The barebones loadout: 1 labor unit, the CEO on productivity, so one productivity station.
pub const BAREBONES_PRODUCTIVITY_STATIONS: f64 = 1.0;
/// The PC bonus steps up by one at each power of this (spec 5.8).
const PC_STEP: f64 = 10.0;

/// `labor units = floor(gross_assets ÷ labor_value)`, minimum 1 (spec 5.10).
pub fn labor_units(gross_assets: f64, labor_value: f64) -> f64 {
    (gross_assets / labor_value).floor().max(1.0)
}

/// Productivity stations at load, `max(1, round(0.25 × L))`, rounding halves to even as
/// gen.py's Python `round` does, so the bonus matches company-start.csv.
pub fn load_productivity_stations(labor_units: f64) -> f64 {
    (LOAD_STATION_SHARE * labor_units)
        .round_ties_even()
        .max(1.0)
}

/// The 5.8 step table: `floor(1 + log10(PC))` for PC ≥ 1, else 0, counted by powers of ten so
/// the steps at 10, 100, 1,000 are exact.
pub fn pc_bonus_steps(pc: f64) -> f64 {
    if pc < 1.0 {
        return 0.0;
    }
    let (mut bonus, mut step) = (1.0, PC_STEP);
    while pc >= step {
        bonus += 1.0;
        step *= PC_STEP;
    }
    bonus
}

/// The PC bonus of the 7.1 loadout for a unit with `gross_assets` (spec 5.8, 7.1):
/// `PC = productivity stations × pc_modifier`.
pub fn load_pc_bonus(gross_assets: f64, p: &IndustryParams) -> f64 {
    let stations = load_productivity_stations(labor_units(gross_assets, p.labor_value_usd));
    pc_bonus_steps(stations * p.pc_modifier)
}

/// The 7.1 "first pass, iterate twice" PC bonus of a company with yearly revenue `revenue`: the
/// station rule at `R × capital_per_dollar`, then again at the gross assets that bonus implies.
/// Under $0.1M of revenue, the barebones loadout's bonus.
pub fn start_pc_bonus(revenue: f64, location_bonus: f64, p: &IndustryParams) -> f64 {
    if revenue < BAREBONES_REVENUE_USD {
        return pc_bonus_steps(BAREBONES_PRODUCTIVITY_STATIONS * p.pc_modifier);
    }
    let first = load_pc_bonus(revenue * p.capital_per_dollar, p);
    load_pc_bonus(gross_at_load(revenue, first, location_bonus, p), p)
}

/// Gross assets at load: `R × capital_per_dollar × 100 ÷ (100 + PC bonus + location bonus)`, so
/// the unit makes exactly R at M 1.0 (spec 7.1); the barebones loadout's $100,000 under $0.1M.
/// company-start.csv holds these, rounded to whole dollars; load reads the CSV.
pub fn gross_at_load(revenue: f64, pc_bonus: f64, location_bonus: f64, p: &IndustryParams) -> f64 {
    if revenue < BAREBONES_REVENUE_USD {
        return BAREBONES_GROSS_USD;
    }
    revenue * p.capital_per_dollar * PRODUCTIVITY_SCALE
        / (PRODUCTIVITY_SCALE + pc_bonus + location_bonus)
}

/// `fixed_cost_rate = f × turnover − d_eff − shared costs ÷ gross` (spec 5.5, 7.1), with d_eff at
/// the load gross assets and `shared_cost_usd` a year.
pub fn fixed_cost_rate_at_load(gross_assets: f64, shared_cost_usd: f64, p: &IndustryParams) -> f64 {
    if gross_assets <= 0.0 {
        return p.fixed_cost_share * p.asset_turnover;
    }
    p.fixed_cost_share * p.asset_turnover
        - decay_usd(gross_assets, p) / gross_assets
        - shared_cost_usd / gross_assets
}

/// A unit's yearly shared costs at load (spec 3.8, 7.1 "Compute"). **Hook for M3.5**: 0 until
/// the compute costs exist, matching [`super::revenue::shared_costs_month_hook`], so fixed cash
/// plus depreciation plus shared costs stay `f × revenue` at productivity 100.
pub fn shared_costs_at_load_hook(_gross_assets: f64, _revenue: f64) -> f64 {
    0.0
}

/// The 7.3 start at 2020-01-01 00:00: the pop date (gen stream), the cycle in Expansion and the
/// zone shocks (cycle stream), every industry's lt and Q1 2020 growth draw (growth stream, with
/// prev_q_growth = lt_q), then the zone spreads, supply, S, M, labels and the units' starting
/// month. Call once on a world fresh from `World::from_data`.
pub fn start(world: &mut World, draws: &mut dyn DrawSource) {
    let today = DateTime::START.date();
    // The AI boom (5.1.1): the pop date rolled at load; Preboom.
    world.ai.pop_date = roll_pop_date(draws);
    let (stage, q_in) = stage_at(today, world.ai.boom_date, world.ai.pop_date);
    world.ai.stage = stage;
    world.ai.ai_labs_lt = ai_labs_lt(&world.ai.schedule, stage, q_in);
    set_industry_lt(world, today);
    for (_, ind) in world.industries.iter_mut() {
        ind.prev_lt = ind.lt;
        // At load prev_q_growth = lt_q (spec 5.1): the draw below shifts this in.
        ind.q_growth = lt_q(ind.lt);
        ind.prev_q_growth = ind.q_growth;
        ind.carry_reset = false;
    }
    // The cycle starts in Expansion with g_t and quarters left drawn (7.3).
    let max_lag = world
        .zones
        .iter()
        .map(|(_, z)| z.lag_quarters)
        .max()
        .unwrap_or(0);
    world.cycle = start_cycle(max_lag, world.cycle.z_avg, draws);
    set_zone_effects(world, draws);
    set_zone_spreads(world);
    // The Q1 2020 growth draw (5.1, 7.3).
    draw_all_growth(world, draws);
    // Demand starts at the 2020 world size; supply, S and M at load (7.2), then labels.
    set_effective_demand(world);
    set_supply(world);
    set_phase_labels(world, today);
    set_revenue(world);
    set_expenses(world);
}
