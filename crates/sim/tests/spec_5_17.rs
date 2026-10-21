//! Spec 5.17 dividends (10.5.5, 3.3.2): paid at the plan lock from the last quarter,
//! `dividend = payout ratio × NI` if NI is above 0 and own cash after it stays above the
//! minimum cash (6.5); payout ratio = the sector table's typical ratio × the archetype's payout
//! mult (6.1). Build-plan M4.8, called from M6.3.

use sim::finance::credit::min_cash;
use sim::finance::distress::CompanyStatus;
use sim::finance::dividends::{DividendInputs, SECTOR_PAYOUT, dividend, payout_ratio};

#[track_caller]
fn near(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-6, "{a} vs {b}");
}

/// 6.1 payout mults (T).
const STATE_CHAMPION: f64 = 1.0;
const STARTUP: f64 = 0.0;
const AGGRESSIVE_GROWER: f64 = 0.5;
const CASH_COW: f64 = 1.3;
const INCUMBENT: f64 = 1.0;

fn base() -> DividendInputs {
    DividendInputs {
        net_income: 10.0e6,
        cash: 60.0e6,
        line_drawn: 0.0,
        min_cash: min_cash(200.0e6),
        payout_ratio: payout_ratio(INCUMBENT),
        status: CompanyStatus::Active,
    }
}

#[test]
fn payout_ratio_is_the_sector_ratio_times_the_archetype_mult() {
    // D1: one shared sector default; D234: 40%, the median of the 3.3.2 typical payout column.
    assert_eq!(SECTOR_PAYOUT, 0.40);
    near(payout_ratio(STATE_CHAMPION), 0.40);
    near(payout_ratio(INCUMBENT), 0.40);
    near(payout_ratio(CASH_COW), 0.52);
    near(payout_ratio(AGGRESSIVE_GROWER), 0.20);
    assert_eq!(payout_ratio(STARTUP), 0.0);
}

#[test]
fn a_profitable_company_with_cash_pays() {
    // NI $10M at 40%: $4M; own cash $60M − $4M stays above min_cash $10M.
    near(dividend(&base()), 4.0e6);
    near(
        dividend(&DividendInputs {
            payout_ratio: payout_ratio(CASH_COW),
            ..base()
        }),
        5.2e6,
    );
    assert_eq!(
        dividend(&DividendInputs {
            payout_ratio: payout_ratio(STARTUP),
            ..base()
        }),
        0.0,
        "Startups pay nothing"
    );
}

#[test]
fn no_dividend_on_a_loss_or_without_the_cash() {
    assert_eq!(
        dividend(&DividendInputs {
            net_income: 0.0,
            ..base()
        }),
        0.0
    );
    assert_eq!(
        dividend(&DividendInputs {
            net_income: -5.0e6,
            ..base()
        }),
        0.0
    );
    // Own cash is cash − line drawn (C10): $60M cash with $48M drawn is $12M own; after $4M it
    // would be $8M, under min_cash $10M: nothing (all or none, D234).
    assert_eq!(
        dividend(&DividendInputs {
            line_drawn: 48.0e6,
            ..base()
        }),
        0.0
    );
    // $46M drawn: $14M own, $10M after, not strictly above $10M: nothing.
    assert_eq!(
        dividend(&DividendInputs {
            line_drawn: 46.0e6,
            ..base()
        }),
        0.0
    );
    // $45M drawn: $15M own, $11M after: pays.
    near(
        dividend(&DividendInputs {
            line_drawn: 45.0e6,
            ..base()
        }),
        4.0e6,
    );
}

#[test]
fn distressed_and_frozen_companies_pay_nothing() {
    // 5.12 step 1: no dividends while Distressed; Bankrupt and Removed are frozen.
    for status in [
        CompanyStatus::Distressed,
        CompanyStatus::Bankrupt,
        CompanyStatus::Removed,
    ] {
        assert_eq!(
            dividend(&DividendInputs { status, ..base() }),
            0.0,
            "{status:?}"
        );
    }
}

#[test]
fn min_cash_zero() {
    // A company with no trailing revenue has min_cash 0 (D226): it pays while own cash after
    // the dividend stays above 0.
    let i = DividendInputs {
        net_income: 1.0e6,
        cash: 1.0e6,
        min_cash: min_cash(0.0),
        ..base()
    };
    assert_eq!(i.min_cash, 0.0);
    near(dividend(&i), 0.4e6);
    // Own cash exactly the dividend leaves 0, not above 0.
    assert_eq!(dividend(&DividendInputs { cash: 0.4e6, ..i }), 0.0);
}
