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
//!   was, while moving M or productivity at the lock moves it.
//! - So one company's plan never reaches another's projection: at every lock from 2020 to 2023
//!   on seed 7, perturbing the even-id companies' growth, R&D, assets and cash leaves every
//!   odd-id company's projection bit for bit as it was, while the even ones move.
//! - With nothing else moving (test jobs hold S, M and productivity at their lock values in the
//!   live run too, and the next quarter's draws the 1 July close makes at this quarter's) the
//!   posted quarter is the projection.
//! - Projecting draws nothing and changes nothing.

mod common;

use std::sync::Mutex;

use common::data;
use sim::Sim;
use sim::market::jobs::{HeldAtLock, project_quarter_net_income};
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::{CompanyId, World};

/// Spec 5.16: e uniform within ±5%.
const CONSENSUS_ERROR: f64 = 0.05;
/// The lock and the release of the quarter the tests project (Q2 2020).
const LOCK: (i32, u8, u8) = (2020, 4, 9);
const RELEASE: (i32, u8, u8) = (2020, 7, 2);
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
}

/// The locks the decoupling test checks: every lock from 2020 to 2023.
const DECOUPLING_SEED: u64 = 7;
const DECOUPLING_LAST_YEAR: i32 = 2023;
/// The even-id companies' perturbed locked plan: growth +0.5, R&D +0.05 of revenue, assets
/// ×1.5, cash ×0.1.
const PERTURB_GROWTH: f64 = 0.5;
const PERTURB_RD: f64 = 0.05;
const PERTURB_ASSETS: f64 = 1.5;
const PERTURB_CASH: f64 = 0.1;

/// Per lock: the odd companies (not frozen) whose projection changed, and the even companies
/// (not frozen) and how many of them moved.
static DECOUPLING: Mutex<Vec<(Date, usize, usize, usize)>> = Mutex::new(Vec::new());

/// After the consensus job at each lock: a copy with the even-id companies' plans, assets and
/// cash perturbed is projected against the world as it is.
fn perturb_even_companies(w: &mut World, ctx: &mut JobCtx<'_>) {
    if ctx.facts.date.year > DECOUPLING_LAST_YEAR {
        return;
    }
    let now = ctx.facts.now;
    let base = project_quarter_net_income(w, now);
    let mut copy = w.clone();
    let even = |id: CompanyId| id.0.is_multiple_of(2);
    for (_, u) in copy.units.iter_mut() {
        if even(u.company) {
            u.growth_plan += PERTURB_GROWTH;
            u.rd_plan += PERTURB_RD;
            u.gross_assets *= PERTURB_ASSETS;
            u.asset_book *= PERTURB_ASSETS;
            for t in &mut u.ramping {
                t.amount *= PERTURB_ASSETS;
            }
        }
    }
    for (id, c) in copy.companies.iter_mut() {
        if even(id) {
            c.cash_usd *= PERTURB_CASH;
        }
    }
    let perturbed = project_quarter_net_income(&copy, now);
    let (mut odd_changed, mut evens, mut even_moved) = (0, 0, 0);
    for (id, c) in w.companies.iter() {
        if c.finance.status().is_frozen() {
            continue;
        }
        let (a, b) = (base[id.0 as usize], perturbed[id.0 as usize]);
        if even(id) {
            evens += 1;
            even_moved += usize::from(a != b);
        } else if a.to_bits() != b.to_bits() {
            odd_changed += 1;
        }
    }
    DECOUPLING
        .lock()
        .unwrap()
        .push((ctx.facts.date, odd_changed, evens, even_moved));
}

/// D168: with S and M held, one company's locked plan never reaches another's projection. At
/// every lock from 2020 to 2023 on seed 7, perturbing the even-id companies' growth, R&D, assets
/// and cash leaves every odd-id company's projection bit for bit as it was, while the even ones
/// move.
#[test]
fn one_companys_plan_does_not_reach_anothers_projection() {
    let mut sim = Sim::new(data(), DECOUPLING_SEED).unwrap();
    sim.register_test_job(
        Slot::LockConsensus,
        "test.perturb_even",
        perturb_even_companies,
    );
    run_to(
        &mut sim,
        DateTime::midnight(Date::ymd(DECOUPLING_LAST_YEAR + 1, 1, 1)),
    );
    let locks = DECOUPLING.lock().unwrap().clone();
    assert_eq!(locks.len(), 16, "four locks a year, 2020 to 2023");
    for (date, odd_changed, evens, even_moved) in locks {
        println!("{date:?}: odd changed {odd_changed}, even moved {even_moved} of {evens}");
        assert_eq!(odd_changed, 0, "{date:?}");
        assert!(
            even_moved * 100 >= evens * 95,
            "{date:?}: {even_moved} of {evens}"
        );
    }
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
