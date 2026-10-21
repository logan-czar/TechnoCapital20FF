//! Spec 6.5 (financing) and 5.17 (dividend) through the Lite AI, build-plan M6.3: one test per
//! row of the 6.5 table. Expected values worked by hand from the spec.

use sim::ai::archetype::Archetype;
use sim::ai::financing::{Financing, FinancingInputs, financing};
use sim::finance::credit::CreditLine;
use sim::finance::distress::CompanyStatus;
use sim::people::traits::Trait;

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-6
}

fn base<'a>(cash: f64, drawn: f64, limit: f64, traits: &'a [Trait]) -> FinancingInputs<'a> {
    FinancingInputs {
        cash,
        line: CreditLine {
            drawn,
            limit,
            excess_months_left: 0,
        },
        min_cash: 10.0e6,
        planned_purchases: 0.0,
        traits,
        last_quarter_net_income: 0.0,
        archetype_payout_mult: 1.0,
        status: CompanyStatus::Active,
    }
}

#[test]
fn row_draw_the_gap_after_planned_purchases() {
    // Cash $12M, purchases $5M: $7M left, $3M under min_cash $10M, so draw $3M.
    let i = FinancingInputs {
        planned_purchases: 5.0e6,
        ..base(12.0e6, 0.0, 50.0e6, &[])
    };
    let f = financing(&i);
    assert!(close(f.draw, 3.0e6) && f.repay == 0.0);
    // Up to the limit only: $1M undrawn.
    let i = FinancingInputs {
        planned_purchases: 5.0e6,
        ..base(12.0e6, 49.0e6, 50.0e6, &[])
    };
    assert!(close(financing(&i).draw, 1.0e6));
}

#[test]
fn row_repay_from_own_cash_above_twice_min_cash() {
    // Cash $60M, drawn $20M: own cash $40M above 2 × $10M; repay min(20, 40 − 15) = $20M.
    let f = financing(&base(60.0e6, 20.0e6, 100.0e6, &[]));
    assert!(close(f.repay, 20.0e6));
    // Own cash $25M ≤ $20M? No: 25 > 20, repay min(20, 25 − 15) = $10M.
    let f = financing(&base(45.0e6, 20.0e6, 100.0e6, &[]));
    assert!(close(f.repay, 10.0e6));
    // Own cash $15M is not above 2 × min_cash: nothing.
    let f = financing(&base(35.0e6, 20.0e6, 100.0e6, &[]));
    assert_eq!(f, Financing::default());
}

#[test]
fn row_cautious_or_greedy_repays_first_to_25_percent() {
    // Cash $35M, drawn $20M of $40M (50%): own cash $15M does not reach the base row, but a
    // Greedy controller repays toward 25% of the limit ($10M drawn) from cash above min_cash:
    // min($10M, $25M) = $10M.
    for t in [Trait::Greedy, Trait::Cautious] {
        let traits = [t];
        let f = financing(&base(35.0e6, 20.0e6, 40.0e6, &traits));
        assert!(close(f.repay, 10.0e6), "{t:?} {f:?}");
    }
    // No dividend while more than 25% stays drawn: cash $12M, drawn $20M of $40M, a quarter
    // of $10M profit; spare cash $2M repays $2M, $18M (45%) stays drawn.
    let mut i = base(12.0e6, 20.0e6, 40.0e6, &[Trait::Greedy]);
    i.min_cash = 10.0e6;
    i.last_quarter_net_income = 10.0e6;
    let f = financing(&i);
    assert!(close(f.repay, 2.0e6));
    assert_eq!(f.dividend, 0.0);
}

#[test]
fn row_brave_keeps_up_to_75_percent_drawn() {
    // Own cash $40M would repay $20M; a Brave controller keeps up to 75% of $100M drawn, so
    // $20M drawn stays.
    let f = financing(&base(60.0e6, 20.0e6, 100.0e6, &[Trait::Brave]));
    assert_eq!(f.repay, 0.0);
    // Drawn $80M of $100M: repays only the $5M above 75%.
    let f = financing(&base(130.0e6, 80.0e6, 100.0e6, &[Trait::Brave]));
    assert!(close(f.repay, 5.0e6));
}

#[test]
fn row_dividend_with_the_archetype_payout_mult() {
    // Cash cow: 40% × 1.3 = 52% of last quarter's $10M.
    let mut i = base(100.0e6, 0.0, 0.0, &[]);
    i.last_quarter_net_income = 10.0e6;
    i.archetype_payout_mult = Archetype::CashCow.params().payout_mult;
    assert!(close(financing(&i).dividend, 5.2e6));
    // Startup pays none (payout mult 0).
    i.archetype_payout_mult = Archetype::Startup.params().payout_mult;
    assert_eq!(financing(&i).dividend, 0.0);
    // No dividend from a loss, while Distressed, or if own cash would fall to min_cash.
    i.archetype_payout_mult = 1.0;
    i.last_quarter_net_income = -1.0e6;
    assert_eq!(financing(&i).dividend, 0.0);
    i.last_quarter_net_income = 10.0e6;
    i.status = CompanyStatus::Distressed;
    assert_eq!(financing(&i).dividend, 0.0);
    i.status = CompanyStatus::Active;
    i.cash = 14.0e6; // 14 − 4 = 10, not above min_cash
    assert_eq!(financing(&i).dividend, 0.0);
}

#[test]
fn min_cash_zero() {
    // D226: with no revenue min_cash is 0; any own cash repays and the dividend needs own cash
    // above 0 after it.
    let mut i = base(5.0e6, 2.0e6, 10.0e6, &[]);
    i.min_cash = 0.0;
    assert!(close(financing(&i).repay, 2.0e6));
    let mut i = base(1.0e6, 0.0, 0.0, &[]);
    i.min_cash = 0.0;
    i.last_quarter_net_income = 2.5e6;
    assert_eq!(financing(&i).dividend, 0.0); // 1.0 − 1.0 = 0 is not above 0
    i.cash = 1.1e6;
    assert!(close(financing(&i).dividend, 1.0e6));
}
