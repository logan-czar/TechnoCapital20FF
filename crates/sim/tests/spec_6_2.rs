//! Spec 6.2 (growth plan), build-plan M6.2: one test per row of the situation table, the trait
//! nudges, the −20% to +30% clamp and the funding cap. Expected values worked by hand from the
//! spec.

use sim::ai::archetype::Archetype;
use sim::ai::growth::{
    FundingInputs, GrowthInputs, funding_cap, growth_plan, quarter_purchases, situation_growth,
    trait_nudge,
};
use sim::people::traits::Trait;

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-12
}

#[test]
fn row_loss_q_4_or_more_sells_down_15_percent() {
    let inc = Archetype::Incumbent.params();
    assert_eq!(situation_growth(4, 0.5, 0.05, 1.0, &inc), -0.15);
    assert_eq!(situation_growth(9, -0.5, 0.05, 1.0, &inc), -0.15);
}

#[test]
fn row_loss_q_2_to_3_shrinks_5_percent() {
    let inc = Archetype::Incumbent.params();
    assert_eq!(situation_growth(2, 0.5, 0.05, 1.0, &inc), -0.05);
    assert_eq!(situation_growth(3, -0.1, 0.05, 1.0, &inc), -0.05);
}

#[test]
fn row_roa_at_or_above_hurdle_follows_demand_plus_adj() {
    // Incumbent (hurdle 10%, adj 0): g_dem 5% less 10 × (1.002 − 1) = 3% (D263: S − 1 and g
    // are both fractions, so each 1% of oversupply costs 10 pp).
    let inc = Archetype::Incumbent.params();
    assert!(close(situation_growth(0, 0.12, 0.05, 1.002, &inc), 0.03));
    assert!(close(situation_growth(0, 0.12, 0.05, 1.1, &inc), -0.95));
    // At the hurdle exactly the row applies; S below 1 takes nothing off.
    assert!(close(situation_growth(1, 0.10, 0.05, 0.9, &inc), 0.05));
    // Cash cow (hurdle 15%, adj −3 pp): 5% − 3% = 2%.
    let cow = Archetype::CashCow.params();
    assert!(close(situation_growth(0, 0.20, 0.05, 1.0, &cow), 0.02));
    // Aggressive grower (hurdle 8%, adj +5 pp).
    let agg = Archetype::AggressiveGrower.params();
    assert!(close(situation_growth(0, 0.08, 0.05, 1.0, &agg), 0.10));
}

#[test]
fn row_roa_below_hurdle_is_at_most_2_percent() {
    let inc = Archetype::Incumbent.params();
    // min(2%, 5%) = 2%.
    assert!(close(situation_growth(0, 0.05, 0.05, 1.0, &inc), 0.02));
    // min(2%, 5% − 10 × 0.02) = −15%.
    assert!(close(situation_growth(0, 0.0, 0.05, 1.02, &inc), -0.15));
    // ROA 0 exactly is in this row.
    assert!(close(situation_growth(1, 0.0, 0.01, 1.0, &inc), 0.01));
}

#[test]
fn row_roa_below_zero_with_loss_q_under_2_holds() {
    let inc = Archetype::Incumbent.params();
    assert_eq!(situation_growth(0, -0.01, 0.05, 1.0, &inc), 0.0);
    assert_eq!(situation_growth(1, -0.3, 0.20, 0.5, &inc), 0.0);
}

#[test]
fn trait_nudges() {
    assert!(close(trait_nudge(&[Trait::Ambitious], false), 0.03));
    assert!(close(trait_nudge(&[Trait::Content], false), -0.01));
    assert!(close(trait_nudge(&[Trait::Cautious], false), -0.02));
    assert!(close(trait_nudge(&[Trait::Brave], false), 0.01));
    // Visionary only in Tech.
    assert!(close(trait_nudge(&[Trait::Visionary], true), 0.01));
    assert_eq!(trait_nudge(&[Trait::Visionary], false), 0.0);
    // They add up: +3 + 1 + 1 pp.
    assert!(close(
        trait_nudge(&[Trait::Ambitious, Trait::Brave, Trait::Visionary], true),
        0.05
    ));
    assert_eq!(trait_nudge(&[], true), 0.0);
}

fn no_cap() -> FundingInputs {
    FundingInputs {
        gross_assets: 100.0e6,
        d_eff: 0.008,
        liquidity: 1.0e12,
        min_cash: 0.0,
        purchases_stopped: false,
    }
}

#[test]
fn clamp_minus_20_to_plus_30() {
    let agg = Archetype::AggressiveGrower.params();
    let mut i = GrowthInputs {
        loss_q: 0,
        roa: 0.5,
        g_dem: 0.40,
        supply_ratio: 1.0,
        archetype: agg,
        traits: &[Trait::Ambitious],
        tech: false,
        funding: no_cap(),
    };
    assert_eq!(growth_plan(&i), 0.30);
    // −15% sell-down with a Cautious nudge (−2 pp) is −17%; an oversupplied below-hurdle
    // company hits the −20% floor.
    i.loss_q = 4;
    i.traits = &[Trait::Cautious];
    assert!(close(growth_plan(&i), -0.17));
    i.loss_q = 0;
    i.roa = 0.01;
    i.supply_ratio = 1.5;
    assert_eq!(growth_plan(&i), -0.20);
}

#[test]
fn funding_cap_scales_g_down_to_half_the_spare_liquidity() {
    // $100M gross, d_eff 0.8%, g 20%: the quarter buys 100 × 0.208 ÷ 4 = $5.2M. Liquidity $8M
    // and min_cash $2M leave a budget of 0.5 × $6M = $3M, so g = 3 × 4 ÷ 100 − 0.008 = 11.2%.
    let f = FundingInputs {
        liquidity: 8.0e6,
        min_cash: 2.0e6,
        ..no_cap()
    };
    assert!(close(quarter_purchases(100.0e6, 0.008, 0.20), 5.2e6));
    assert!(close(funding_cap(0.20, &f), 0.112));
    // A plan that fits is untouched.
    assert_eq!(funding_cap(0.05, &f), 0.05);
    // No spare liquidity: g falls to −d_eff (no purchases), never below.
    let broke = FundingInputs {
        liquidity: 1.0e6,
        ..f
    };
    assert_eq!(funding_cap(0.20, &broke), -0.008);
    // A sell-down is already below −d_eff and is not touched.
    assert_eq!(funding_cap(-0.15, &broke), -0.15);
    // Distressed (5.12 step 1) or a pending raise (6.6): g at most −d_eff.
    let stopped = FundingInputs {
        purchases_stopped: true,
        ..no_cap()
    };
    assert_eq!(funding_cap(0.10, &stopped), -0.008);
    assert_eq!(funding_cap(-0.15, &stopped), -0.15);
}
