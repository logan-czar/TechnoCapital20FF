//! The economy's start state (spec 7.1 load slice, 7.2, 7.3).
//!
//! [`World::from_data`](crate::world::World::from_data) builds everything load sets without a
//! draw, calling the 7.1 and 7.2 formulas here (PC bonus at load, gross assets, fixed cost rate,
//! fringe pools). [`start`] then makes the 7.3 draws at 2020-01-01 00:00: the pop date, the cycle's
//! start, the zone shocks and the Q1 2020 growth draw, and sets what follows from them (zone
//! effects and spreads, supply, S, M, labels and the units' starting month of revenue and
//! expenses).
//!
//! The 7.1 loadout itself (PC bonus passes, gross assets, labor units, stations) is lane F's
//! [`crate::ops::stations::starting_loadout`], the one implementation: [`start_loadout`] calls it
//! with a company's industry parameters. M3's monthly compute step (5.8, 4.3 step 5) recounts
//! `Company::pc_bonus` from the stations from the first month on (D106, design fix 201).

use super::MONTHS_PER_YEAR;
use super::ai_boom::{ai_labs_lt, roll_pop_date, set_industry_lt, stage_at};
use super::assets::decay_usd;
use super::cycle::{set_zone_effects, start_cycle};
use super::demand::{set_effective_demand, set_phase_labels};
use super::growth::{draw_all_growth, lt_q};
use super::revenue::{set_expenses, set_revenue};
use super::supply::set_supply;
use super::zones::set_zone_spreads;
use crate::ops::compute::ComputeBill;
use crate::ops::stations::{Loadout, LoadoutInputs, starting_loadout};
use crate::rng::DrawSource;
use crate::time::DateTime;
use crate::world::{IndustryParams, World};

pub use crate::ops::stations::{
    ARROWHEAD_ENTERPRISE_SHARE, ARROWHEAD_KEY, BAREBONES_ASSETS_USD, BAREBONES_REVENUE_USD,
    LOADOUT_ENTERPRISE_SHARE, START_PRODUCTIVITY,
};

/// The 7.1 starting loadout of the company with companies.csv id `key` and yearly revenue
/// `revenue` (spec 7.1, C16), from lane F's [`starting_loadout`]: the PC bonus by the station
/// rule iterated twice, gross assets `R × capital_per_dollar × 100 ÷ (100 + PC bonus + location
/// bonus)` (company-start.csv holds them rounded to dollars; load reads the CSV), labor units,
/// productivity and enterprise stations (share 0.5, Arrowhead 0.1) and idle; under $0.1M the
/// barebones loadout. The bonus load sets is [`Loadout::load_bonus`] (D106).
pub fn start_loadout(key: &str, revenue: f64, location_bonus: f64, p: &IndustryParams) -> Loadout {
    starting_loadout(LoadoutInputs {
        revenue_usd: revenue,
        capital_per_dollar: p.capital_per_dollar,
        labor_value_usd: p.labor_value_usd,
        pc_modifier: p.pc_modifier,
        data_tb_per_musd: p.data_tb_per_musd,
        location_bonus,
        enterprise_share: enterprise_share(key),
    })
}

/// The enterprise and structured-data share of 7.1: 0.5, Arrowhead (CO-0001) 0.1.
pub fn enterprise_share(key: &str) -> f64 {
    if key == ARROWHEAD_KEY {
        ARROWHEAD_ENTERPRISE_SHARE
    } else {
        LOADOUT_ENTERPRISE_SHARE
    }
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

/// A company's yearly shared costs at load (spec 3.8, 5.5, 7.1 "Compute"): twelve months of
/// its starting compute and licence bill. Filled together with
/// [`super::revenue::shared_costs_month_hook`] (D108), so fixed cash plus depreciation plus
/// shared costs stay `f × revenue` at productivity 100 and M 1.0. One unit per company in the
/// MVP, so the unit carries the whole bill.
pub fn shared_costs_at_load_hook(bill: &ComputeBill) -> f64 {
    MONTHS_PER_YEAR * bill.monthly_usd
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
