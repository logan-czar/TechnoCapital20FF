//! Spec 5.6 productivity decay and R&D effect (build-plan M3.7). Score 50: -6 a year at the
//! norm, +4 net at double the norm, -16 with no R&D (10.0.4).

use sim::ops::productivity::{
    ProductivityInputs, idle_decay, productivity_delta, research_mult, step_productivity,
};
use sim::ops::stations::Stations;

const RD_NORM: f64 = 0.05;

fn inputs(rd_plan: f64, free_rd: f64, score: f64) -> ProductivityInputs {
    ProductivityInputs {
        rd_plan,
        free_rd,
        rd_norm: RD_NORM,
        management_score: score,
        research_units: 0,
        idle_units: 0,
        labor: 100,
    }
}

/// Twelve monthly steps from productivity 100, with no clamp in reach.
fn year(inp: &ProductivityInputs) -> f64 {
    let mut p = 100.0;
    for _ in 0..12 {
        p = step_productivity(p, inp);
    }
    p - 100.0
}

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-9
}

#[test]
fn score_50_worked_numbers() {
    assert!(
        close(year(&inputs(RD_NORM, 0.0, 50.0)), -6.0),
        "at the norm"
    );
    assert!(
        close(year(&inputs(2.0 * RD_NORM, 0.0, 50.0)), 4.0),
        "double the norm"
    );
    assert!(close(year(&inputs(0.0, 0.0, 50.0)), -16.0), "no R&D");
}

#[test]
fn free_rd_works_exactly_like_spending() {
    // rd_total = rd_plan + free_rd_pct (10.0.11.7).
    let paid = productivity_delta(&inputs(0.05, 0.0, 50.0));
    let mixed = productivity_delta(&inputs(0.03, 0.02, 50.0));
    assert!(close(paid, mixed));
}

#[test]
fn management_factor_scales_only_the_rd_effect() {
    // Score 80: factor 1.3; at double the norm the R&D effect is +13 a year, decay -6.
    assert!(close(year(&inputs(0.10, 0.0, 80.0)), 13.0 - 6.0));
    // Score 30: factor 0.8; with no R&D the effect is -8, decay -6.
    assert!(close(year(&inputs(0.0, 0.0, 30.0)), -8.0 - 6.0));
    // At the norm the factor does not matter.
    assert!(close(year(&inputs(RD_NORM, 0.0, 90.0)), -6.0));
}

#[test]
fn research_multiplier_steps() {
    let table = [
        (0, 1.00),
        (1, 1.01),
        (9, 1.01),
        (10, 1.02),
        (99, 1.02),
        (100, 1.03),
        (999, 1.03),
        (1_000, 1.04),
        (10_000, 1.05),
    ];
    for (units, mult) in table {
        assert!(close(research_mult(units), mult), "{units}");
    }
    let mut inp = inputs(0.10, 0.0, 50.0);
    inp.research_units = 10;
    assert!(close(year(&inp), 10.0 * 1.02 - 6.0));
}

#[test]
fn idle_labor_slows_decay() {
    // 0.5 a month; 0.4 with 10%+ idle; 0.3 with 25%+ idle (10.0.11.3).
    assert_eq!(idle_decay(0, 100), 0.5);
    assert_eq!(idle_decay(9, 100), 0.5);
    assert_eq!(idle_decay(10, 100), 0.4);
    assert_eq!(idle_decay(24, 100), 0.4);
    assert_eq!(idle_decay(25, 100), 0.3);
    assert_eq!(idle_decay(293, 392), 0.3, "Arrowhead");
    assert_eq!(idle_decay(0, 1), 0.5, "the CEO alone");
    let mut inp = inputs(RD_NORM, 0.0, 50.0);
    inp.idle_units = 30;
    assert!(close(year(&inp), -3.6));
}

#[test]
fn clamp_holds_productivity_between_30_and_200() {
    let none = inputs(0.0, 0.0, 50.0);
    let mut p = 100.0;
    for _ in 0..12 * 20 {
        p = step_productivity(p, &none);
    }
    assert_eq!(p, 30.0);
    let lots = inputs(1.0, 0.0, 100.0);
    let mut q = 100.0;
    for _ in 0..12 * 5 {
        q = step_productivity(q, &lots);
    }
    assert_eq!(q, 200.0);
}

#[test]
fn inputs_from_stations() {
    let s = Stations {
        productivity: 98,
        enterprise: 1,
        fifty_fifty: 0,
        research: 0,
        idle: 293,
    };
    let inp = ProductivityInputs::with_stations(0.018, 0.01, RD_NORM, 50.0, &s);
    assert_eq!(
        (inp.labor, inp.idle_units, inp.research_units),
        (392, 293, 0)
    );
    // Arrowhead at score 50: rd_total 2.8% gives 10 × (0.56 − 1) ÷ 12 − 0.3 a month.
    assert!(close(
        productivity_delta(&inp),
        10.0 * (0.028 / 0.05 - 1.0) / 12.0 - 0.3
    ));
}
