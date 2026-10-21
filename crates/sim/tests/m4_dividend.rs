//! Build-plan M4.8: the 5.17 dividend rule, ready for M6.3's plan lock. It is not scheduled
//! yet; this test calls it from a job in the plan lock slot, as M6.3 will, and checks it against
//! the rule written from the spec: `payout ratio × NI` of the quarter just released when NI is
//! above 0, the company is Active and own cash after it stays above min_cash (6.5: 5% of trailing
//! revenue), with payout ratio = 40% (the sector default, D234) × the 6.1 archetype payout mult;
//! all or nothing. The cash leaves at the lock and the dividend posts in that month's ledger, so
//! the books still balance (M4.9).

mod common;

use std::sync::Mutex;

use common::data;
use common::ops::{company, run_to};
use sim::Sim;
use sim::ai::archetype::Archetype;
use sim::finance::distress::CompanyStatus;
use sim::finance::jobs::{dividend_due, pay_dividend};
use sim::time::{Date, JobCtx, Slot};
use sim::world::{CompanyId, Ordinal, World};

/// Spec 6.1 payout mults (T).
fn spec_payout_mult(a: Archetype) -> f64 {
    match a {
        Archetype::StateChampion | Archetype::Incumbent => 1.0,
        Archetype::Startup => 0.0,
        Archetype::AggressiveGrower => 0.5,
        Archetype::CashCow => 1.3,
    }
}

/// What the lock job paid, by company index.
static PAID: Mutex<Vec<f64>> = Mutex::new(Vec::new());

fn lock_dividends(w: &mut World, _: &mut JobCtx<'_>) {
    let paid: Vec<f64> = w.companies.ids().map(|id| pay_dividend(w, id)).collect();
    *PAID.lock().unwrap() = paid;
}

#[test]
fn the_dividend_rule_at_the_first_plan_lock() {
    let mut sim = Sim::new(data(), 9).unwrap();
    run_to(&mut sim, Date::ymd(2020, 1, 8));
    let before = sim.world().clone();
    // The rule against the spec for every company, on the state the 9 January lock reads.
    let mut paying = 0;
    for (id, c) in before.companies.iter() {
        let f = &c.finance;
        let last = f.quarters().last().unwrap();
        let ni = last.lines.net_income();
        let ttm: f64 = f
            .quarters()
            .iter()
            .rev()
            .take(4)
            .map(|s| s.lines.revenue)
            .sum();
        let min_cash = 0.05 * ttm;
        let d = 0.40 * spec_payout_mult(c.archetype) * ni;
        let own_after = (c.cash_usd - f.line.drawn).max(0.0) - d;
        let want =
            if f.status() == CompanyStatus::Active && ni > 0.0 && d > 0.0 && own_after > min_cash {
                d
            } else {
                0.0
            };
        assert!((dividend_due(&before, id) - want).abs() < 1e-6, "{}", c.key);
        paying += usize::from(want > 0.0);
    }
    // Arrowhead (7.1): a Cash cow, 0.40 × 1.3 = 52% of Q4 2019 NI, with $80M of cash.
    let a = company(&before, "CO-0001");
    let ni = before.companies[a].finance.quarters()[3].lines.net_income();
    assert!(ni > 0.0);
    assert!((dividend_due(&before, a) - 0.52 * ni).abs() < 1e-6);
    // A Startup (payout mult 0) never pays.
    for (id, c) in before.companies.iter() {
        if c.archetype == Archetype::Startup {
            assert_eq!(dividend_due(&before, id), 0.0, "{}", c.key);
        }
    }
    println!("9 January 2020: {paying} of 651 would pay a dividend");
    assert!(paying > 0);

    // Called from the lock slot (as M6.3 will): cash falls at the lock, January's ledger posts
    // it on 1 February, and the books balance.
    sim.register_test_job(Slot::LockAiPlans, "test.dividends", lock_dividends);
    run_to(&mut sim, Date::ymd(2020, 1, 10));
    let paid = PAID.lock().unwrap().clone();
    let w = sim.world();
    for (i, &d) in paid.iter().enumerate() {
        let id = CompanyId::from_index(i);
        assert!((d - dividend_due(&before, id)).abs() < 1e-6);
        assert!((w.companies[id].cash_usd - (before.companies[id].cash_usd - d)).abs() < 1e-6);
    }
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    for (i, &d) in paid.iter().enumerate() {
        let c = &w.companies[CompanyId::from_index(i)];
        if c.finance.in_game() {
            assert!(
                (c.finance.last_month.unwrap().lines.dividends - d).abs() < 1e-6,
                "{}",
                c.key
            );
        }
    }
    assert_eq!(
        w.books_check.failures, 0,
        "{:?}",
        w.books_check.first_failure
    );
}
