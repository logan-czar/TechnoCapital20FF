//! Build-plan M5.5's consensus (spec 5.16, 21.5.1; D141, D168, D252): at the plan lock the engine
//! projects each company's quarter with no new rolls (a clone runs the quarter's three month
//! closes with NoNoise draws, each industry's supply, S and M and each unit's productivity held
//! at their lock values, design fix 109), and `consensus = projection × (1 + e)`, e uniform
//! within ±5% from the prices stream.
//!
//! - At the 9 April 2020 lock every consensus is within ±5% of the projection made from the world
//!   just before the lock's consensus job, the e spread over the companies is uniform-like (mean
//!   near 0, both ends used), and the surprises at the 2 July release follow from the consensus
//!   (5.15).
//! - The projection holds S, M and productivity at the lock (D168): moving demand or the R&D norm
//!   (so S and the productivity drift would move at every later close) leaves it exactly as it
//!   was, while moving M or productivity at the lock moves it; and a test job that moves S at
//!   the closes after the lock changes the posted quarter but not the projection.
//! - With nothing else moving (test jobs hold S, M and productivity at their lock values in the
//!   live run too, and the next quarter's draws the 1 July close makes at this quarter's) the
//!   posted quarter is the projection.
//! - Projecting draws nothing and changes nothing.

mod common;

use std::sync::Mutex;

use common::data;
use sim::Sim;
use sim::economy::supply::{market_factor, supply_ratio};
use sim::market::jobs::{HeldAtLock, project_quarter_net_income};
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::{CompanyId, World};

/// Spec 5.16: e uniform within ±5%.
const CONSENSUS_ERROR: f64 = 0.05;
/// The lock and the release of the quarter the tests project (Q2 2020).
const LOCK: (i32, u8, u8) = (2020, 4, 9);
const RELEASE: (i32, u8, u8) = (2020, 7, 2);
/// The test job's move of every industry's supply at the closes after the lock.
const SUPPLY_MOVE: f64 = 1.10;
/// With nothing else moving, the posted quarter is the projection within this share of
/// |projection| (the same closes on the same inputs, up to rounding; seed 11 runs 1.5e-14).
const HELD_TOLERANCE: f64 = 1e-9;

fn lock() -> DateTime {
    DateTime::midnight(Date::ymd(LOCK.0, LOCK.1, LOCK.2))
}

fn release() -> DateTime {
    DateTime::at(Date::ymd(RELEASE.0, RELEASE.1, RELEASE.2), 1)
}

/// A close of the projected quarter after its lock: 1 May, 1 June or 1 July 2020.
fn after_lock(date: Date) -> bool {
    date > lock().date() && date < release().date()
}

fn run_to(sim: &mut Sim, t: DateTime) {
    while sim.now() < t {
        sim.step();
    }
}

/// The companies not frozen with a quarter, and their posted last quarter's net income.
fn posted(w: &World) -> Vec<(CompanyId, f64)> {
    w.companies
        .iter()
        .filter(|(_, c)| !c.finance.status().is_frozen())
        .filter_map(|(id, c)| {
            c.finance
                .quarters()
                .last()
                .map(|q| (id, q.lines.net_income()))
        })
        .collect()
}

static PROJECTION: Mutex<Vec<f64>> = Mutex::new(Vec::new());

/// Runs in the lock's Lite AI slot after the batch (it is registered after the built-in jobs),
/// so just before the consensus job (lock step 5): the projection of the same world.
fn project(w: &mut World, ctx: &mut JobCtx<'_>) {
    if ctx.facts.date == lock().date() {
        *PROJECTION.lock().unwrap() = project_quarter_net_income(w, ctx.facts.now);
    }
}

#[test]
fn consensus_is_the_projection_within_five_percent() {
    let mut sim = Sim::new(data(), 11).unwrap();
    sim.register_test_job(Slot::LockAiPlans, "test.project", project);
    run_to(&mut sim, lock());
    let projection = PROJECTION.lock().unwrap().clone();
    let w = sim.world();
    let mut es = Vec::new();
    for (id, c) in w.companies.iter() {
        if c.finance.status().is_frozen() {
            continue;
        }
        let p = projection[id.0 as usize];
        let s = &w.market.stocks[id];
        // Nothing between the batch and the consensus job moves the projection.
        assert_eq!(s.projection_ni, p, "{}", c.key);
        if p.abs() < 1.0 {
            continue;
        }
        let e = s.consensus_ni / p - 1.0;
        assert!(e.abs() <= CONSENSUS_ERROR + 1e-12, "{}: e {e}", c.key);
        es.push(e);
    }
    let mean = es.iter().sum::<f64>() / es.len() as f64;
    let (lo, hi) = es
        .iter()
        .fold((0.0f64, 0.0f64), |(a, b), &e| (a.min(e), b.max(e)));
    println!(
        "{} consensus errors: mean {mean:+.4}, range {lo:+.4} to {hi:+.4}",
        es.len()
    );
    assert!(mean.abs() < 0.01);
    assert!(lo < -0.04 && hi > 0.04);

    // The 2 July surprises follow from the consensus (5.15).
    run_to(&mut sim, release());
    let w = sim.world();
    let mut tags = [0usize; 4];
    for (id, ni) in posted(w) {
        let s = &w.market.stocks[id];
        let cons = if s.consensus_ni == 0.0 {
            1.0
        } else {
            s.consensus_ni
        };
        let sp = (ni - cons) / cons.abs();
        assert!((s.last_surprise - sp).abs() < 1e-9 * sp.abs().max(1.0));
        if let Some(t) = s.tags.surprise {
            tags[t as usize] += 1;
        }
    }
    println!("Q2 2020 tags (big beat, beat, miss, big miss) {tags:?}");
}

/// Projections at the lock of the world as it is and of copies with one input moved: (demand ×2
/// and the R&D norm ×0.5, which move S and the productivity drift at every later close), (every
/// M +10%), (every productivity +10 points).
static MOVED_AT_LOCK: Mutex<Vec<[Vec<f64>; 4]>> = Mutex::new(Vec::new());
/// The consensus job's projection in the run whose test job moves S after the lock.
static S_MOVED: Mutex<Vec<f64>> = Mutex::new(Vec::new());

fn project_moved_copies(w: &mut World, ctx: &mut JobCtx<'_>) {
    if ctx.facts.date != lock().date() {
        return;
    }
    let now = ctx.facts.now;
    let base = project_quarter_net_income(w, now);
    let mut later = w.clone();
    for (_, ind) in later.industries.iter_mut() {
        ind.demand_core *= 2.0;
        ind.demand *= 2.0;
        ind.params.rd_norm *= 0.5;
    }
    let mut m = w.clone();
    for (_, ind) in m.industries.iter_mut() {
        ind.market_factor *= 1.1;
    }
    let mut p = w.clone();
    for (_, u) in p.units.iter_mut() {
        u.productivity += 10.0;
    }
    MOVED_AT_LOCK.lock().unwrap().push([
        base,
        project_quarter_net_income(&later, now),
        project_quarter_net_income(&m, now),
        project_quarter_net_income(&p, now),
    ]);
}

/// At each close after the lock, every industry's supply moves by [`SUPPLY_MOVE`] and S and M
/// follow (spec 5.2): what other companies' growth does to the actual quarter.
fn move_supply(w: &mut World, ctx: &mut JobCtx<'_>) {
    if !after_lock(ctx.facts.date) {
        return;
    }
    for (_, ind) in w.industries.iter_mut() {
        ind.supply *= SUPPLY_MOVE;
        ind.supply_ratio = supply_ratio(ind.supply, ind.demand);
        ind.market_factor = market_factor(ind.supply_ratio);
    }
}

fn keep_s_moved_projection(w: &mut World, ctx: &mut JobCtx<'_>) {
    if ctx.facts.date == lock().date() {
        *S_MOVED.lock().unwrap() = w
            .market
            .stocks
            .rows()
            .iter()
            .map(|s| s.projection_ni)
            .collect();
    }
}

/// D168: the projection uses the lock's S, M and productivity and holds them.
#[test]
fn projection_holds_s_m_and_productivity_at_the_lock() {
    let mut plain = Sim::new(data(), 11).unwrap();
    plain.register_test_job(Slot::LockAiPlans, "test.moved_copies", project_moved_copies);
    run_to(&mut plain, lock());
    let [base, later, m, p] = MOVED_AT_LOCK.lock().unwrap().pop().unwrap();
    let w = plain.world();
    let (mut m_moved, mut p_moved, mut active) = (0, 0, 0);
    for (id, c) in w.companies.iter() {
        if c.finance.status().is_frozen() {
            continue;
        }
        let i = id.0 as usize;
        // Moves after the lock (demand, so S; the productivity drift) are not in it.
        assert_eq!(later[i], base[i], "{}", c.key);
        if c.units.is_empty() || w.companies[id].revenue_usd <= 0.0 {
            continue;
        }
        active += 1;
        m_moved += usize::from(m[i] != base[i]);
        p_moved += usize::from(p[i] != base[i]);
    }
    println!(
        "of {active} companies with revenue, M at the lock moves {m_moved}, productivity {p_moved}"
    );
    // The lock's M and productivity are what it runs on.
    assert!(m_moved * 100 >= active * 95, "{m_moved} of {active}");
    assert!(p_moved * 100 >= active * 95, "{p_moved} of {active}");

    // A test job moving S at the closes after the lock changes the actual, not the projection.
    let mut moved = Sim::new(data(), 11).unwrap();
    moved.register_test_job(Slot::MonthlySupply, "test.move_supply", move_supply);
    moved.register_test_job(Slot::LockConsensus, "test.keep", keep_s_moved_projection);
    run_to(&mut moved, release());
    run_to(&mut plain, release());
    let projected = S_MOVED.lock().unwrap().clone();
    let (pw, mw) = (plain.world(), moved.world());
    for (id, s) in pw.market.stocks.iter() {
        assert_eq!(projected[id.0 as usize], s.projection_ni);
    }
    let plain_ni = posted(pw);
    let moved_ni = posted(mw);
    assert_eq!(plain_ni.len(), moved_ni.len());
    let changed = plain_ni
        .iter()
        .zip(&moved_ni)
        .filter(|((_, a), (_, b))| (a - b).abs() > 1e-6 * a.abs().max(1.0))
        .count();
    println!(
        "S moved after the lock: {changed} of {} quarters change",
        plain_ni.len()
    );
    assert!(changed * 100 >= plain_ni.len() * 95, "{changed}");
}

static HELD: Mutex<Option<HeldAtLock>> = Mutex::new(None);
/// The zones' effective credit spreads at the lock (spec 5.1.2).
static SPREADS: Mutex<Vec<f64>> = Mutex::new(Vec::new());

/// After the consensus job: the lock's S, M, productivity and zone spreads.
fn keep_held(w: &mut World, ctx: &mut JobCtx<'_>) {
    if ctx.facts.date == lock().date() {
        *HELD.lock().unwrap() = Some(HeldAtLock::of(w));
        *SPREADS.lock().unwrap() = w.zones.rows().iter().map(|z| z.credit_spread).collect();
    }
}

/// After 4.3 step 1 on 1 July: the next quarter's draws (new rolls the projection skips, D141)
/// back to this quarter's. The June close reads them: the zone spreads in its interest (4.3 step
/// 12) and q_growth in its phase labels (step 2), so in a forced sale's sale factor (5.10).
fn hold_quarter_draws(w: &mut World, ctx: &mut JobCtx<'_>) {
    if after_lock(ctx.facts.date) {
        let spreads = SPREADS.lock().unwrap();
        for ((_, z), &s) in w.zones.iter_mut().zip(spreads.iter()) {
            z.credit_spread = s;
        }
        for (_, ind) in w.industries.iter_mut() {
            ind.q_growth = ind.prev_q_growth;
            ind.lt = ind.prev_lt;
        }
    }
}

/// After 4.3 step 6 at the closes after the lock: S and M back to the lock's.
fn hold_market(w: &mut World, ctx: &mut JobCtx<'_>) {
    if after_lock(ctx.facts.date)
        && let Some(h) = HELD.lock().unwrap().as_ref()
    {
        h.restore_market(w);
    }
}

/// After 4.3 step 10 at the closes after the lock: productivity back to the lock's.
fn hold_productivity(w: &mut World, ctx: &mut JobCtx<'_>) {
    if after_lock(ctx.facts.date)
        && let Some(h) = HELD.lock().unwrap().as_ref()
    {
        h.restore_productivity(w);
    }
}

/// D168: when S, M and productivity do not move after the lock (nor the next quarter's draws,
/// which the 1 July close makes before closing June), the quarter is its projection.
#[test]
fn projection_is_the_quarter_when_nothing_else_moves() {
    let mut sim = Sim::new(data(), 11).unwrap();
    sim.register_test_job(Slot::LockConsensus, "test.keep_held", keep_held);
    sim.register_test_job(
        Slot::MonthlyGrowthDraws,
        "test.hold_quarter_draws",
        hold_quarter_draws,
    );
    sim.register_test_job(Slot::MonthlySupply, "test.hold_market", hold_market);
    sim.register_test_job(
        Slot::MonthlyProductivity,
        "test.hold_productivity",
        hold_productivity,
    );
    run_to(&mut sim, release());
    let w = sim.world();
    let mut misses: Vec<f64> = posted(w)
        .into_iter()
        .filter_map(|(id, ni)| {
            let p = w.market.stocks[id].projection_ni;
            (p.abs() >= 1e6).then(|| (ni / p - 1.0).abs())
        })
        .collect();
    misses.sort_by(f64::total_cmp);
    let n = misses.len();
    println!(
        "held: {n} quarters, median |miss| {:.2e}, p90 {:.2e}, max {:.2e}",
        misses[n / 2],
        misses[n * 9 / 10],
        misses[n - 1]
    );
    assert!(
        misses[n - 1] < HELD_TOLERANCE,
        "max |miss| {}",
        misses[n - 1]
    );
}

/// Runs a projection inside the lock and throws it away.
fn project_and_drop(w: &mut World, ctx: &mut JobCtx<'_>) {
    let p = project_quarter_net_income(w, ctx.facts.now);
    assert!(!p.is_empty());
}

/// Spec 5.16 "no new rolls" (D141): projecting the quarter on a clone leaves the world, the RNG
/// streams and so the state hash exactly as they were. Two runs of the same seed, one projecting
/// an extra time at every lock, hash the same after a year.
#[test]
fn projecting_draws_nothing_and_changes_nothing() {
    let end = DateTime::midnight(Date::ymd(2021, 1, 10));
    let mut plain = Sim::new(data(), 4).unwrap();
    let mut probed = Sim::new(data(), 4).unwrap();
    probed.register_test_job(
        Slot::LockIpoVotes,
        "test.project_and_drop",
        project_and_drop,
    );
    while plain.now() < end {
        plain.step();
        probed.step();
    }
    assert_eq!(plain.state_hash(), probed.state_hash());
}
