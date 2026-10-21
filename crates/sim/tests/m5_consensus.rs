//! Build-plan M5.5's consensus (spec 5.16, 21.5.1; D141, D252): at the plan lock the engine
//! projects each company's quarter with no new rolls (a clone runs the quarter's three month
//! closes with NoNoise draws), and `consensus = projection × (1 + e)`, e uniform within ±5% from
//! the prices stream. Checked at the 9 April 2020 lock: every consensus is within ±5% of the
//! projection made from the world just before the lock's consensus job, and the e spread over
//! the companies is uniform-like (mean near 0, both ends used). Then the Q2 2020 quarter as the
//! engine posts it is compared with the projection: the median miss is printed, and the
//! surprises at the 2 July release follow from the consensus (5.15).

mod common;

use std::sync::Mutex;

use common::data;
use sim::Sim;
use sim::market::jobs::project_quarter_net_income;
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::World;

/// Spec 5.16: e uniform within ±5%.
const CONSENSUS_ERROR: f64 = 0.05;

static PROJECTION: Mutex<Vec<f64>> = Mutex::new(Vec::new());

/// Runs in the lock's IPO slot, before the consensus job (lock step 5): the projection of the
/// same world.
fn project(w: &mut World, ctx: &mut JobCtx<'_>) {
    if ctx.facts.date == Date::ymd(2020, 4, 9) {
        *PROJECTION.lock().unwrap() = project_quarter_net_income(w, ctx.facts.now);
    }
}

#[test]
fn consensus_is_the_projection_within_five_percent() {
    let mut sim = Sim::new(data(), 11).unwrap();
    sim.register_test_job(Slot::LockIpoVotes, "test.project", project);
    let lock = DateTime::midnight(Date::ymd(2020, 4, 9));
    while sim.now() < lock {
        sim.step();
    }
    let projection = PROJECTION.lock().unwrap().clone();
    let w = sim.world();
    let mut es = Vec::new();
    for (id, c) in w.companies.iter() {
        if c.finance.status().is_frozen() {
            continue;
        }
        let p = projection[id.0 as usize];
        let cons = w.market.stocks[id].consensus_ni;
        if p.abs() < 1.0 {
            continue;
        }
        let e = cons / p - 1.0;
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

    // The Q2 2020 quarter as posted against the projection, and the 2 July surprises.
    let release = DateTime::at(Date::ymd(2020, 7, 2), 1);
    while sim.now() < release {
        sim.step();
    }
    let w = sim.world();
    let mut misses = Vec::new();
    let mut tags = [0usize; 4];
    for (id, c) in w.companies.iter() {
        if c.finance.status().is_frozen() {
            continue;
        }
        let ni = c.finance.quarters().last().unwrap().lines.net_income();
        let p = projection[id.0 as usize];
        if p.abs() >= 1e6 {
            misses.push((ni / p - 1.0).abs());
        }
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
    misses.sort_by(f64::total_cmp);
    println!(
        "Q2 2020 posted vs projected net income (|NI| over $1M, {}): median |miss| {:.2}%, \
         p90 {:.2}%; tags (big beat, beat, miss, big miss) {tags:?}",
        misses.len(),
        100.0 * misses[misses.len() / 2],
        100.0 * misses[misses.len() * 9 / 10]
    );
}
