//! The economy core (build-plan M2): the global business cycle, financial zones and their credit
//! spreads, the quarterly industry growth draw and phase labels, the AI boom and pop, demand and
//! the rate term, fringe pools, supply, S and M, unit revenue and expenses, asset decay and the
//! growth plan's buys and sells.
//!
//! Spec sections: 5.1, 5.1.1, 5.1.2 (credit spread), 5.2, 5.3, 5.4, 5.5, 5.10, 7.1 (the load
//! slice), 7.2, 7.3; scheduled in 4.3 steps 1 (quarterly draw), 2 (demand), 3 (fringe), 6
//! (supply), 7 (revenue), 9 (expenses) and 11 (assets).
//!
//! Each formula is a plain function of its inputs (no world, no RNG) so the 5.16 projections and
//! the tests can call it directly; the jobs (`*_job`) only read the world, call the formulas in
//! table order and write the results back. Every random number comes through the job's
//! [`DrawSource`](crate::rng::DrawSource): the cycle stream for the phase draws and zone shocks,
//! the growth stream for the quarterly growth shocks and the gen stream for the pop date.

pub mod ai_boom;
pub mod assets;
pub mod cycle;
pub mod demand;
pub mod growth;
pub mod revenue;
pub mod start;
pub mod supply;
pub mod zones;

pub use start::start;

use crate::time::{Scheduler, Slot};

/// Months in a year: yearly figures are booked monthly as ÷ 12 (spec 5).
pub const MONTHS_PER_YEAR: f64 = 12.0;
/// Quarters in a year (spec 5.1 `lt_q`, `÷ 4`).
pub const QUARTERS_PER_YEAR: f64 = 4.0;
/// Months in a quarter: demand moves by a third of the quarter's growth each month (spec 5.1).
pub const MONTHS_PER_QUARTER: f64 = 3.0;
/// Productivity points are out of 100 (spec 5.2, 5.4).
pub const PRODUCTIVITY_SCALE: f64 = 100.0;

/// Registers the economy's jobs in their 4.3 slots. Called from `lib.rs`'s `register_jobs`.
pub fn register(s: &mut Scheduler) {
    // 4.3 step 1, on 1 Jan, Apr, Jul and Oct only, in its order.
    s.register(
        Slot::MonthlyAiEvents,
        "economy.ai_events",
        ai_boom::ai_events_job,
    );
    s.register(
        Slot::MonthlyIndustryLt,
        "economy.industry_lt",
        ai_boom::industry_lt_job,
    );
    s.register(Slot::MonthlyCycle, "economy.cycle", cycle::cycle_job);
    s.register(
        Slot::MonthlyZoneSpreads,
        "economy.zone_spreads",
        zones::zone_spreads_job,
    );
    s.register(
        Slot::MonthlyGrowthDraws,
        "economy.growth_draws",
        growth::growth_draws_job,
    );
    // 4.3 steps 2, 3, 6, 7, 9 and 11.
    s.register(Slot::MonthlyDemand, "economy.demand", demand::demand_job);
    s.register(Slot::MonthlyFringe, "economy.fringe", supply::fringe_job);
    s.register(Slot::MonthlySupply, "economy.supply", supply::supply_job);
    s.register(
        Slot::MonthlyRevenue,
        "economy.revenue",
        revenue::revenue_job,
    );
    s.register(
        Slot::MonthlyExpenses,
        "economy.expenses",
        revenue::expenses_job,
    );
    s.register(Slot::MonthlyAssets, "economy.assets", assets::assets_job);
}
