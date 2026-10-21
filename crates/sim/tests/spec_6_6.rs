//! Spec 6.6 (raising money in cash-burning industries), build-plan M6.3: the rule is tested
//! with a fake `cash_burning` flag and is silent with the real data (no industry is flagged).

mod common;

use common::data;
use sim::ai::raise::{RaiseInputs, RaiseMethod, raise_plan, roll_raise, success_chance};
use sim::finance::credit::CreditLine;
use sim::finance::distress::CompanyStatus;
use sim::finance::rating::Rating;
use sim::rng::NoNoise;
use sim::world::PhaseLabel;

/// A listed company burning $10M a quarter with $20M of own cash (runway 2 quarters).
fn burner() -> RaiseInputs {
    RaiseInputs {
        cash_burning: true,
        status: CompanyStatus::Active,
        last_quarter_fcf: -10.0e6,
        cash: 20.0e6,
        line: CreditLine {
            drawn: 0.0,
            limit: 100.0e6,
            excess_months_left: 0,
        },
        rating: Rating::Bbb,
        listed: true,
        price: 10.0,
        shares_out: 100_000_000,
        value_per_share: 10.0,
        confidence_factor: 1.0,
        label: PhaseLabel::Normal,
        failed_raises: 0,
    }
}

#[test]
fn silent_with_the_real_data() {
    let d = data();
    assert!(d.industries.rows.iter().all(|i| !i.cash_burning));
    for ind in &d.industries.rows {
        let i = RaiseInputs {
            cash_burning: ind.cash_burning,
            ..burner()
        };
        assert_eq!(raise_plan(&i), None, "{}", ind.id);
    }
}

#[test]
fn line_draw_when_rated_and_covered() {
    // Burn $10M, own cash $20M: runway 2 < 4; target 8 × 10 − 20 = $60M; BBB with $100M
    // undrawn draws it. Chance 50% + 0 (confidence 1.0) + 0 (Normal) + 20 (line) = 70%.
    let p = raise_plan(&burner()).unwrap();
    assert_eq!(p.method, RaiseMethod::CreditLine);
    assert_eq!((p.burn, p.runway_quarters, p.target), (10.0e6, 2.0, 60.0e6));
    assert_eq!((p.gross, p.net, p.fees), (60.0e6, 60.0e6, 0.0));
    assert!((p.chance - 0.70).abs() < 1e-12);
    // NoNoise rolls 0.5: a 70% raise succeeds.
    assert!(roll_raise(&p, &mut NoNoise));
}

#[test]
fn share_issue_when_unrated_or_uncovered() {
    // Rated CCC (factor 0): a share issue. Market value $1B is a small cap: 8% off $10 = $9.20;
    // shares to net $60M after 3% fees: ceil(60M ÷ (9.2 × 0.97)) = 6,723,443, under the 20%
    // cap of 20,000,000.
    let i = RaiseInputs {
        rating: Rating::Ccc,
        ..burner()
    };
    let p = raise_plan(&i).unwrap();
    assert_eq!(p.method, RaiseMethod::ShareIssue);
    assert!((p.issue_price - 9.2).abs() < 1e-12);
    assert_eq!(p.new_shares, 6_723_443);
    assert!((p.gross - 6_723_443.0 * 9.2).abs() < 1e-3);
    assert!((p.net - 0.97 * p.gross).abs() < 1e-3);
    // Announcement: P × (1 − (2% + 0.5 × dilution)), dilution = new ÷ (old + new).
    let dil = 6_723_443.0 / 106_723_443.0;
    assert!((p.price_after - 10.0 * (1.0 - (0.02 + 0.5 * dil))).abs() < 1e-12);
    // Share issue method adj is 0: 50%.
    assert!((p.chance - 0.50).abs() < 1e-12);

    // Large cap ($10B+): 4% off. The 20% cap binds for a small share count.
    let big = RaiseInputs {
        rating: Rating::Ccc,
        price: 100.0,
        shares_out: 100_000_000,
        ..burner()
    };
    assert!((raise_plan(&big).unwrap().issue_price - 96.0).abs() < 1e-12);
    let few = RaiseInputs {
        rating: Rating::Ccc,
        shares_out: 1_000_000,
        ..burner()
    };
    assert_eq!(raise_plan(&few).unwrap().new_shares, 200_000);

    // Private: 0.7 × V less 8%, no price effect.
    let private = RaiseInputs {
        rating: Rating::Ccc,
        listed: false,
        ..burner()
    };
    let p = raise_plan(&private).unwrap();
    assert!((p.issue_price - 0.7 * 10.0 * 0.92).abs() < 1e-12);
    assert_eq!(p.price_after, 10.0);
}

#[test]
fn no_raise_without_burn_or_with_runway() {
    let mut i = burner();
    i.last_quarter_fcf = 1.0;
    assert_eq!(raise_plan(&i), None);
    i.last_quarter_fcf = -5.0e6; // runway 4 quarters: no raise
    assert_eq!(raise_plan(&i), None);
    i.last_quarter_fcf = -10.0e6;
    i.status = CompanyStatus::Bankrupt;
    assert_eq!(raise_plan(&i), None);
    i.status = CompanyStatus::Distressed;
    assert!(raise_plan(&i).is_some());
}

#[test]
fn success_chance_terms_and_clamp() {
    // Confidence factor 1.2 is +20 pp; Boom +30; line +20: 120% clamps to 95%.
    assert_eq!(
        success_chance(1.2, PhaseLabel::Boom, RaiseMethod::CreditLine, 0),
        0.95
    );
    // Glut −15, two failures −20: 50 − 15 − 20 = 15%.
    assert!(
        (success_chance(1.0, PhaseLabel::Glut, RaiseMethod::ShareIssue, 2) - 0.15).abs() < 1e-12
    );
    // Bust −35 with confidence 0.8 (−20): clamps to 5%.
    assert_eq!(
        success_chance(0.8, PhaseLabel::Bust, RaiseMethod::ShareIssue, 0),
        0.05
    );
}
