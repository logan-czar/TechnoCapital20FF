//! Spec 5.1.2 zone exchange investor confidence (batch 157, 2a; 3-markets 3.3.5): once a day,
//! `confidence = clamp(0.9 × confidence + 3 × r + news, −100, +100)`. Build-plan M5.7: it
//! decays to 0 with no news.

use sim::market::confidence::{ConfidenceHeadline, news_points, update_confidence};
use sim::market::fair_value::exchange_factor;
use sim::market::index::ExchangeIndex;

#[track_caller]
fn near(a: f64, b: f64) {
    assert!(
        (a - b).abs() <= 1e-12 * a.abs().max(b.abs()).max(1.0),
        "{a} vs {b}"
    );
}

#[test]
fn headline_points() {
    // 5.1.2 (T): Big beat +4, Beat +2, Miss −2, Big miss −4, bankruptcy −5, rating change of
    // 2+ notches ±3.
    use ConfidenceHeadline::*;
    near(BigBeat.points(), 4.0);
    near(Beat.points(), 2.0);
    near(Miss.points(), -2.0);
    near(BigMiss.points(), -4.0);
    near(Bankruptcy.points(), -5.0);
    near(RatingChange { notches: 2 }.points(), 3.0);
    near(RatingChange { notches: -3 }.points(), -3.0);
    near(RatingChange { notches: 1 }.points(), 0.0);
    near(RatingChange { notches: -1 }.points(), 0.0);
    let day = [
        BigBeat,
        Beat,
        Miss,
        BigMiss,
        Bankruptcy,
        RatingChange { notches: 2 },
        RatingChange { notches: -3 },
        RatingChange { notches: 1 },
    ];
    near(news_points(&day), 4.0 + 2.0 - 2.0 - 4.0 - 5.0 + 3.0 - 3.0);
    near(news_points(&[]), 0.0);
}

#[test]
fn daily_update() {
    // 0.9 × 50 + 3 × 2% + 4 (a Big beat) = 45 + 6 + 4 = 55.
    near(update_confidence(50.0, 2.0, 4.0), 55.0);
    // −0.9 × 20 − 3 × 1.5% − 2 = −24.5.
    near(update_confidence(-20.0, -1.5, -2.0), -24.5);
    // Clamped to ±100.
    near(update_confidence(95.0, 10.0, 10.0), 100.0);
    near(update_confidence(-95.0, -10.0, -5.0), -100.0);
    near(update_confidence(0.0, 0.0, 0.0), 0.0);
    // It feeds X = 1 + 0.10 × confidence ÷ 100 (5.13).
    near(
        exchange_factor(Some(update_confidence(95.0, 10.0, 10.0))),
        1.1,
    );
}

#[test]
fn decays_to_zero_with_no_news() {
    // Build-plan M5.7. With r 0 and no news it keeps 90% a day; under 0.005 it reads 0 (D251).
    // From +100 that is the first n with 100 × 0.9^n below 0.005: n = 94.
    let n = ((0.005f64 / 100.0).ln() / 0.9f64.ln()).ceil() as usize;
    assert_eq!(n, 94);
    for start in [100.0, -100.0] {
        let mut c = start;
        for day in 1..=n {
            c = update_confidence(c, 0.0, 0.0);
            if day < n {
                assert!(c != 0.0, "{start}: 0 already on day {day}");
                near(c, start * 0.9f64.powi(day as i32));
            }
        }
        assert_eq!(c, 0.0, "{start}");
        assert_eq!(update_confidence(c, 0.0, 0.0), 0.0);
    }
    // An exchange with no listed company has r 0 and no news (5.1.2), so it decays to 0 too.
    let mut empty = ExchangeIndex::at_load(0.0);
    let mut c = 40.0;
    for _ in 0..200 {
        c = update_confidence(c, empty.close_day(0.0), news_points(&[]));
    }
    assert_eq!(c, 0.0);
}
