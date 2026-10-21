//! Build-plan M4.8 and M6.3: the 5.17 dividend at the plan lock, paid by the live Lite AI batch.
//! There is one dividend calculation (`ai::financing`, which calls `finance::dividends`); the
//! batch pays it through `finance::jobs::pay_dividend`. Checked at the 9 January 2020 lock
//! against the rule written from the spec, on the balances after the lock's 6.5 draw or
//! repayment: `payout ratio × NI` of the quarter just released when NI is above 0, the company
//! is Active and own cash after it stays above min_cash (6: 5% of trailing revenue), with payout
//! ratio = 40% (the sector default, D234) × the 6.1 payout mult of the lock's archetype; all or
//! nothing; a Cautious or Greedy controller pays none while more than 25% of its limit stays
//! drawn (6.5). The cash leaves at the lock and the dividend posts in January's ledger, so the
//! books still balance (M4.9).

mod common;

use common::data;
use common::ops::{company, run_to};
use sim::Sim;
use sim::ai::archetype::Archetype;
use sim::finance::distress::CompanyStatus;
use sim::people::traits::Trait;
use sim::time::Date;

/// Spec 6.1 payout mults (T).
fn spec_payout_mult(a: Archetype) -> f64 {
    match a {
        Archetype::StateChampion | Archetype::Incumbent => 1.0,
        Archetype::Startup => 0.0,
        Archetype::AggressiveGrower => 0.5,
        Archetype::CashCow => 1.3,
    }
}

#[test]
fn the_dividend_rule_at_the_first_plan_lock() {
    let mut sim = Sim::new(data(), 9).unwrap();
    run_to(&mut sim, Date::ymd(2020, 1, 8));
    let before = sim.world().clone();
    run_to(&mut sim, Date::ymd(2020, 1, 10));
    let after = sim.world().clone();
    let mut paying = 0;
    for (id, c) in before.companies.iter() {
        let f = &c.finance;
        let a = &after.companies[id];
        let plan = a.plan.expect("every company locks a plan");
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
        let cash = c.cash_usd + plan.financing.draw - plan.financing.repay;
        let drawn = f.line.drawn + plan.financing.draw - plan.financing.repay;
        let traits = c
            .controller
            .map_or(&[][..], |ch| &before.characters[ch].traits[..]);
        let repay_first = traits.contains(&Trait::Greedy) || traits.contains(&Trait::Cautious);
        let blocked = repay_first && drawn > 0.25 * f.line.limit;
        let d = 0.40 * spec_payout_mult(a.archetype) * ni;
        let own_after = (cash - drawn).max(0.0) - d;
        let want = if f.status() == CompanyStatus::Active
            && ni > 0.0
            && d > 0.0
            && own_after > min_cash
            && !blocked
        {
            d
        } else {
            0.0
        };
        assert!(
            (plan.financing.dividend - want).abs() < 1e-6,
            "{}: paid {} want {want}",
            c.key,
            plan.financing.dividend
        );
        // Cash moved at the lock by the draw, repayment and dividend (D125).
        let moved = plan.financing.draw - plan.financing.repay - plan.financing.dividend;
        assert!(
            (a.cash_usd - (c.cash_usd + moved)).abs() < 1e-6,
            "{}",
            c.key
        );
        paying += usize::from(want > 0.0);
        if a.archetype == Archetype::Startup {
            assert_eq!(
                plan.financing.dividend, 0.0,
                "{}: a Startup never pays",
                c.key
            );
        }
    }
    println!("9 January 2020: {paying} of 651 pay a dividend");
    assert!(paying > 0);

    // Arrowhead (7.1): a Cash cow with no line and $80M of cash, 0.40 × 1.3 = 52% of Q4 2019 NI.
    let a = company(&before, "CO-0001");
    let ni = before.companies[a].finance.quarters()[3].lines.net_income();
    assert!(ni > 0.0);
    let plan = after.companies[a].plan.unwrap();
    assert_eq!(after.companies[a].archetype, Archetype::CashCow);
    assert!((plan.financing.dividend - 0.52 * ni).abs() < 1e-6);

    // January's ledger posts the dividend on 1 February, and the books balance.
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    for (id, c) in w.companies.iter().take(before.companies.len()) {
        if c.finance.in_game() {
            let d = after.companies[id].plan.unwrap().financing.dividend;
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
