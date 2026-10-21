//! Spec 5.15 earnings jump (21.2, 21.3.1, 3.3.6), the result tags (21.3.2) and the reaction
//! week (4.2 step 3, 4.4): build-plan M5.5, jump and reversion as 5.15 and 21.3.1 give them; and
//! the 4.2 step 1 buzz decay.

use sim::market::daily::{decay_buzz, is_reversion_day, revert_toward_value};
use sim::market::earnings::{
    ResultTags, SurpriseTag, is_record_quarter, jumped_buzz, jumped_price, result_tags, surprise,
};
use sim::time::Date;

#[track_caller]
fn near(a: f64, b: f64) {
    assert!(
        (a - b).abs() <= 1e-12 * a.abs().max(b.abs()).max(1.0),
        "{a} vs {b}"
    );
}

const M: f64 = 1e6;

#[test]
fn surprise_against_consensus() {
    // s = (actual − consensus) ÷ |consensus|.
    near(surprise(12.0 * M, 10.0 * M), 0.2);
    near(surprise(-5.0 * M, 10.0 * M), -1.5);
    // A smaller loss than expected is a beat.
    near(surprise(-5.0 * M, -10.0 * M), 0.5);
    // Consensus 0 is treated as $1.
    near(surprise(1.0, 0.0), 0.0);
    near(surprise(101.0, 0.0), 100.0);
}

#[test]
fn the_jump_is_one_and_a_half_times_the_clamped_surprise() {
    // P ×= 1 + 1.5 × clamp(0.5 × s, −25%, +25%).
    // s = 0.2: 0.5 × 0.2 = 10%, × 1.5 = +15%: $20 → $23.
    near(jumped_price(20.0, 0.2), 23.0);
    // s = 2.0: clamped at 25%, × 1.5 = +37.5%: $20 → $27.50.
    near(jumped_price(20.0, 2.0), 27.5);
    // s = −1.5: −25% × 1.5 = −37.5%: $20 → $12.50.
    near(jumped_price(20.0, -1.5), 12.5);
    near(jumped_price(20.0, 0.0), 20.0);
    // buzz += clamp(20 × s, −30, +30), kept within ±100.
    near(jumped_buzz(0.0, 0.2), 4.0);
    near(jumped_buzz(0.0, 2.0), 30.0);
    near(jumped_buzz(-10.0, -1.5), -40.0);
    near(jumped_buzz(90.0, 2.0), 100.0);
}

#[test]
fn result_tags_for_headlines() {
    // 21.3.2 (T): Beat above +5%, Big beat above +20%, Miss below −5%, Big miss below −20%;
    // one surprise tier per report (D249).
    assert_eq!(SurpriseTag::from_surprise(0.05), None);
    assert_eq!(SurpriseTag::from_surprise(0.051), Some(SurpriseTag::Beat));
    assert_eq!(SurpriseTag::from_surprise(0.20), Some(SurpriseTag::Beat));
    assert_eq!(SurpriseTag::from_surprise(0.21), Some(SurpriseTag::BigBeat));
    assert_eq!(SurpriseTag::from_surprise(-0.05), None);
    assert_eq!(SurpriseTag::from_surprise(-0.06), Some(SurpriseTag::Miss));
    assert_eq!(SurpriseTag::from_surprise(-0.20), Some(SurpriseTag::Miss));
    assert_eq!(
        SurpriseTag::from_surprise(-0.25),
        Some(SurpriseTag::BigMiss)
    );
    assert_eq!(SurpriseTag::BigBeat.name(), "Big beat");
    // Loss: net income under 0. Record quarter: best revenue in the company's history, strictly
    // above every earlier archived quarter (D249).
    let history = [10.0 * M, 10.0 * M, 10.0 * M, 10.0 * M];
    assert!(is_record_quarter(11.0 * M, &history));
    assert!(!is_record_quarter(10.0 * M, &history), "a tie is no record");
    assert!(!is_record_quarter(11.0 * M, &[]), "no history, no record");
    assert!(!is_record_quarter(0.0, &[-1.0]));
    assert_eq!(
        result_tags(-1.5, -5.0 * M, 9.0 * M, &history),
        ResultTags {
            surprise: Some(SurpriseTag::BigMiss),
            loss: true,
            record_quarter: false,
        }
    );
    assert_eq!(
        result_tags(0.3, 2.0 * M, 12.0 * M, &history),
        ResultTags {
            surprise: Some(SurpriseTag::BigBeat),
            loss: false,
            record_quarter: true,
        }
    );
    assert_eq!(
        result_tags(0.0, 0.0, 10.0 * M, &history),
        ResultTags::default()
    );
}

#[test]
fn reaction_week_reverts_twenty_percent_a_day_toward_v() {
    // 4.2 step 3, 21.3.1: on the 3rd to the 8th of a release month, close 20% of the gap
    // between P and V.
    for m in [1, 4, 7, 10] {
        assert!(!is_reversion_day(Date::ymd(2021, m, 2)));
        for d in 3..=8 {
            assert!(is_reversion_day(Date::ymd(2021, m, d)), "{m}/{d}");
        }
        assert!(!is_reversion_day(Date::ymd(2021, m, 9)));
    }
    assert!(!is_reversion_day(Date::ymd(2021, 5, 4)));
    // A $20 stock (P = V) beats big: 27.50 at 01:00 on the 2nd. V stays $20; six reversion days
    // leave 0.8^6 = 0.262144 of the $7.50 gap: $21.96608.
    let v = 20.0;
    let mut p = jumped_price(20.0, 2.0);
    near(revert_toward_value(p, v), 27.5 - 0.2 * 7.5);
    for d in 3..=8 {
        assert!(is_reversion_day(Date::ymd(2021, 4, d)));
        p = revert_toward_value(p, v);
    }
    near(p, 20.0 + 7.5 * 0.262_144);
}

#[test]
fn buzz_decays_25_percent_a_day() {
    // 4.2 step 1, 3.10: buzz decays 25% a day: 30 → 22.5, and 30 × 0.75^4 = 9.4921875.
    near(decay_buzz(30.0), 22.5);
    let mut b = 30.0;
    for _ in 0..4 {
        b = decay_buzz(b);
    }
    near(b, 9.492_187_5);
    near(decay_buzz(-40.0), -30.0);
    near(decay_buzz(0.0), 0.0);
}
