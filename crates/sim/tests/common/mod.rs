//! Shared test helpers: the data, and test jobs (registered through the `test-hooks` feature)
//! that draw from every RNG stream and write into the world, so the determinism, save and hash
//! tests have real state and real draws to check before the economy jobs exist.

#![allow(dead_code)]

pub mod economy;
pub mod ops;

use sim::time::{JobCtx, Slot};
use sim::world::{AlertKind, AlertPayload, CompanyId, Ordinal, World};
use sim::{Sim, Stream};

pub fn data() -> sim_data::WorldData {
    sim_data::load_world(&sim_data::default_data_dir()).unwrap()
}

/// A new game with the churn job in the hourly alerts slot, which runs on every tick (the share
/// price slot skips 1 January and release ticks).
pub fn churning_sim(data: &sim_data::WorldData, seed: u64) -> Sim {
    let mut sim = Sim::new(data.clone(), seed).unwrap();
    sim.register_test_job(Slot::Alerts, "test.churn", churn);
    sim
}

/// Draws from all five streams (one normal a tick, so the Box-Muller spare is often pending at
/// a save) and folds the draws into one company's revenue and one industry's size.
pub fn churn(world: &mut World, ctx: &mut JobCtx<'_>) {
    let d = &mut *ctx.draws;
    let x = (d.next_u64(Stream::Cycle) % 1000) as f64
        + d.uniform(Stream::Growth)
        + d.normal(Stream::Prices)
        + f64::from(d.poisson(Stream::Ai, 2.0))
        + d.int_inclusive(Stream::Gen, -3, 3) as f64;
    let n = ctx.facts.now.hours() as usize;
    let company = CompanyId::from_index(n % world.companies.len());
    world.companies[company].revenue_usd += x;
    let industry = sim::world::IndustryId::from_index(n % world.industries.len());
    world.industries[industry].world_size_2020_usd -= x;
}

/// Draws from every stream and writes nothing: only the RNG positions move.
pub fn draw_only(_: &mut World, ctx: &mut JobCtx<'_>) {
    for s in Stream::ALL {
        ctx.draws.next_u64(s);
    }
}

/// Raises Bankruptcy in watchlist for companies 3 and 4 every day, as a finance job would for
/// every bankrupt company (spec 4.3 step 13); the watchlist filter decides what fires.
pub fn bankrupt_three_and_four(_: &mut World, ctx: &mut JobCtx<'_>) {
    for id in [CompanyId(3), CompanyId(4)] {
        ctx.raise_alert(AlertKind::BankruptcyInWatchlist, AlertPayload::Company(id));
    }
}
