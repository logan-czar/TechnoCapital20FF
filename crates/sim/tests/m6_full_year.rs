//! Build-plan M6.10, the spec M6 done line: "A full year runs four releases, four locks, four
//! recaps; the fixed events F1 to F9 fire on their dates; a birth takes exactly its assets from
//! the fringe (supply unchanged before PC bonuses) and a listing keeps assets = liabilities +
//! equity; the same seed gives the same IPO votes, member by member."
//!
//! - The year 2020 on the live engine: the releases of Q4 2019 to Q3 2020, the four plan locks
//!   and the four pre-quarter-end weeks, each with its notice or alert and its recap.
//! - Every birth of the year conserves its industry's supply before PC bonuses (probes around
//!   each lock) and every listing month balances (the engine's M4.9 count, D128).
//! - Two runs of the same seed hold the same votes, ballot by ballot, and the same hash.
//! - F1 to F9 fire at their plan locks (5.19.2) on a run to 2042, with the pop set to 1 January
//!   2040 so the bust ends on 1 January 2042 and F9 falls on the 9 January 2042 lock (D275);
//!   the boom posts the chatbot headline and F4 names the tipped lab.

mod common;

use std::sync::Mutex;

use common::data;
use sim::Sim;
use sim::births::random::EventKind;
use sim::news::HeadlineKind;
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::{AlertKind, IndustryId, Notice, World};

/// Spec 5.2 supply before PC bonuses (see m6_births.rs).
fn supply_before_bonus(w: &World, i: IndustryId) -> f64 {
    let ind = &w.industries[i];
    let t = ind.params.asset_turnover;
    let units: f64 = w
        .units
        .iter()
        .filter(|(_, u)| u.industry == i && !w.companies[u.company].finance.status().is_frozen())
        .map(|(_, u)| u.assets_eff() * t * (u.productivity + u.location_bonus) / 100.0)
        .sum();
    ind.fringe_assets * t + units
}

static SUPPLY: Mutex<Vec<(Vec<f64>, usize)>> = Mutex::new(Vec::new());
static SUPPLY_AFTER: Mutex<Vec<(Vec<f64>, usize)>> = Mutex::new(Vec::new());

fn supplies(w: &World) -> (Vec<f64>, usize) {
    (
        w.industries
            .ids()
            .map(|i| supply_before_bonus(w, i))
            .collect(),
        w.companies.len(),
    )
}

fn before_lock(w: &mut World, ctx: &mut JobCtx<'_>) {
    if ctx.facts.is_lock_tick() {
        SUPPLY.lock().unwrap().push(supplies(w));
    }
}

fn after_births(w: &mut World, _: &mut JobCtx<'_>) {
    SUPPLY_AFTER.lock().unwrap().push(supplies(w));
}

#[test]
fn a_full_year_runs_four_releases_four_locks_four_recaps() {
    let mut sim = Sim::new(data(), 51).unwrap();
    sim.register_test_job(Slot::Alerts, "test.before_lock", before_lock);
    sim.register_test_job(Slot::LockIpoVotes, "test.after_births", after_births);
    let end = DateTime::midnight(Date::ymd(2021, 1, 1));
    let (mut releases, mut locks, mut recap_alerts, mut recaps) = (vec![], vec![], 0, vec![]);
    let mut listings = 0;
    while sim.now() < end {
        for n in sim.step() {
            match n {
                Notice::EarningsReleased(q) => releases.push(q),
                Notice::PlanLocked(q) => locks.push(q),
                Notice::Alert {
                    kind: AlertKind::QuarterlyRecap,
                    ..
                } => recap_alerts += 1,
                Notice::CompanyListed(_) => listings += 1,
                _ => {}
            }
        }
        let t = sim.now();
        if t.hour() == 0 && sim::time::quarter::is_recap_day(t.date()) {
            recaps.push(sim.world().recaps.last().unwrap().world.quarter);
        }
    }
    let q = |year, q| sim::time::Quarter { year, q };
    assert_eq!(releases, [q(2019, 4), q(2020, 1), q(2020, 2), q(2020, 3)]);
    assert_eq!(locks, [q(2020, 1), q(2020, 2), q(2020, 3), q(2020, 4)]);
    assert_eq!(
        recap_alerts, 4,
        "Quarterly recap fires each pre-quarter-end week"
    );
    assert_eq!(recaps, [q(2020, 1), q(2020, 2), q(2020, 3), q(2020, 4)]);

    // Births conserve supply before PC bonuses at every lock; at least F1 was born.
    let before = SUPPLY.lock().unwrap().clone();
    let after = SUPPLY_AFTER.lock().unwrap().clone();
    assert_eq!(before.len(), 4);
    let mut births = 0;
    for ((b, n0), (a, n1)) in before.iter().zip(&after) {
        births += n1 - n0;
        for (x, y) in b.iter().zip(a) {
            assert!((x - y).abs() <= 1e-9 * x.max(1.0), "supply {x} vs {y}");
        }
    }
    assert!(births >= 2, "{births} births in 2020");

    // A listing keeps A = L + E: every company-month of the year balances (D128).
    let w = sim.world();
    assert!(listings > 0, "a listing in 2020");
    assert_eq!(
        w.books_check.failures, 0,
        "{:?}",
        w.books_check.first_failure
    );
    assert!(w.books_check.checked > 651 * 12);
}

#[test]
fn the_same_seed_gives_the_same_year() {
    let end = DateTime::midnight(Date::ymd(2021, 1, 10));
    let mut a = Sim::new(data(), 52).unwrap();
    let mut b = Sim::new(data(), 52).unwrap();
    let (mut na, mut nb) = (Vec::new(), Vec::new());
    while a.now() < end {
        na.extend(a.step());
        nb.extend(b.step());
    }
    assert_eq!(na, nb);
    for (id, c) in a.world().companies.iter() {
        assert_eq!(
            c.ipo_last_vote,
            b.world().companies[id].ipo_last_vote,
            "{}: the same ballots",
            c.key
        );
    }
    assert_eq!(a.state_hash(), b.state_hash());
}

/// Sets the pop to 1 January 2040 on the first tick (5.1.1 rolls it at load; the boom and the
/// pop are read from the dates each quarter, so a date set before 2030 runs as if rolled).
fn pop_in_2040(w: &mut World, ctx: &mut JobCtx<'_>) {
    if ctx.facts.now == DateTime::at(Date::ymd(2020, 1, 1), 1) {
        w.ai.pop_date = Date::ymd(2040, 1, 1);
    }
}

#[test]
fn fixed_events_f1_to_f9_fire_on_their_dates() {
    let mut sim = Sim::new(data(), 53).unwrap();
    sim.register_test_job(Slot::Alerts, "test.pop_in_2040", pop_in_2040);
    let end = DateTime::midnight(Date::ymd(2042, 1, 10));
    while sim.now() < end {
        sim.step();
    }
    let w = sim.world();
    // Spec 5.19.2: the plan lock each fires at; F9 the first lock after the bust (the pop + 8
    // quarters).
    let want = [
        ("F1", Date::ymd(2020, 4, 9)),
        ("F2", Date::ymd(2021, 4, 9)),
        ("F3", Date::ymd(2022, 1, 9)),
        ("F4", Date::ymd(2030, 1, 9)),
        ("F5", Date::ymd(2031, 1, 9)),
        ("F6", Date::ymd(2032, 1, 9)),
        ("F7", Date::ymd(2033, 1, 9)),
        ("F8", Date::ymd(2035, 1, 9)),
        ("F9", Date::ymd(2042, 1, 9)),
    ];
    assert!(w.births.fixed_fired.iter().all(|&f| f), "all nine fired");
    for (id, date) in want {
        let fired: Vec<_> = w
            .births
            .events
            .iter()
            .filter(|e| e.kind == EventKind::Fixed(id.into()))
            .collect();
        assert_eq!(fired.len(), 1, "{id} fires once");
        assert_eq!(fired[0].date, date, "{id}");
        println!(
            "{id} {date}: {} startups ({})",
            fired[0].companies.len(),
            fired[0]
                .companies
                .iter()
                .map(|&c| w.companies[c].name.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        );
    }
    // The boom (5.1.1): "[tipped lab] launches its chatbot" on 1 January 2030, and F4's rush.
    let tipped = &w.companies[w.births.tipped_lab.unwrap()].name;
    let feed: Vec<_> = w.news.feed.iter().collect();
    let chatbot = feed
        .iter()
        .find(|h| matches!(h.kind, HeadlineKind::Chatbot))
        .expect("the chatbot headline");
    assert_eq!(chatbot.date, Date::ymd(2030, 1, 1));
    assert_eq!(chatbot.text, format!("{tipped} launches its chatbot"));
    let rush = feed
        .iter()
        .find(|h| matches!(&h.kind, HeadlineKind::FixedStartupEvent { event, .. } if event == "F4"))
        .expect("F4's headline");
    assert!(
        rush.text
            .starts_with(&format!("{tipped}'s chatbot sets off a startup rush: ")),
        "{}",
        rush.text
    );
    assert_eq!(
        w.books_check.failures, 0,
        "{:?}",
        w.books_check.first_failure
    );
}
