//! Spec 5.16 projections and consensus (21.5.1): `consensus = projection × (1 + e)`, e uniform
//! ±5%; the shown range `±30% × (1 − 0.6 × elapsed share) × (1 − 24 ÷ 50) × 0.7`, ×2 for a
//! secret plan (all, for the observer), minimum ±3%. The range shrinks as the quarter passes.

use sim::market::projection::{RangeViewer, consensus, elapsed_share, range, range_width};
use sim::rng::{NoNoise, RngStreams, ScriptedDraws, Stream};
use sim::time::{Date, DateTime};

#[track_caller]
fn near(a: f64, b: f64) {
    assert!(
        (a - b).abs() <= 1e-12 * a.abs().max(b.abs()).max(1.0),
        "{a} vs {b}"
    );
}

#[test]
fn observer_range_from_the_spec() {
    let o = RangeViewer::OBSERVER;
    // Start of the quarter: 0.30 × 1 × 0.52 × 0.7 × 2 = 0.2184.
    near(range_width(0.0, o), 0.2184);
    // Half way: 0.30 × 0.7 × 0.52 × 0.7 × 2 = 0.15288.
    near(range_width(0.5, o), 0.15288);
    // At the end: 0.30 × 0.4 × 0.52 × 0.7 × 2 = 0.08736.
    near(range_width(1.0, o), 0.08736);
    // A viewer who can see the plan: half as wide.
    let open = RangeViewer {
        plan_secret: false,
        ..o
    };
    near(range_width(1.0, open), 0.04368);
    // Never under ±3%: Finance 40 without Pdoomberg gives 0.30 × 0.4 × 0.2 = 0.024.
    let sharp = RangeViewer {
        finance: 40.0,
        has_pdoomberg: false,
        plan_secret: false,
    };
    near(range_width(1.0, sharp), 0.03);
    near(
        range_width(
            0.0,
            RangeViewer {
                finance: 60.0,
                ..sharp
            },
        ),
        0.03,
    );
}

#[test]
fn ranges_shrink_with_elapsed_share_to_the_minimum() {
    let o = RangeViewer::OBSERVER;
    let mut last = f64::INFINITY;
    for i in 0..=20 {
        let w = range_width(f64::from(i) / 20.0, o);
        assert!(w < last, "{i}");
        assert!(w >= 0.03);
        last = w;
    }
    // Shares outside 0 to 1 clamp.
    near(range_width(-1.0, o), range_width(0.0, o));
    near(range_width(2.0, o), range_width(1.0, o));
}

#[test]
fn elapsed_share_of_the_calendar_quarter() {
    // D252: hours since 00:00 on the quarter's first day ÷ the quarter's hours (Q2 2021: 91 days).
    let at = |m, d, h| DateTime::at(Date::ymd(2021, m, d), h);
    near(elapsed_share(at(4, 1, 0)), 0.0);
    near(elapsed_share(at(4, 9, 0)), 8.0 / 91.0);
    near(
        elapsed_share(at(6, 30, 23)),
        (90.0 * 24.0 + 23.0) / (91.0 * 24.0),
    );
    near(elapsed_share(at(7, 1, 0)), 0.0);
    // Q1 2020 (leap year): 91 days, the lock on 9 January is 8 days in.
    near(
        elapsed_share(DateTime::at(Date::ymd(2020, 1, 9), 0)),
        8.0 / 91.0,
    );
}

#[test]
fn range_around_a_centre() {
    // centre ∓ |centre| × width.
    let (lo, hi) = range(100.0, 0.2);
    near(lo, 80.0);
    near(hi, 120.0);
    let (lo, hi) = range(-50.0, 0.1);
    near(lo, -55.0);
    near(hi, -45.0);
}

#[test]
fn consensus_is_the_projection_within_five_percent() {
    // NoNoise (u = 0.5) gives e = 0.
    near(consensus(10.0e6, &mut NoNoise), 10.0e6);
    // e = −5% + 10% × u.
    let mut s = ScriptedDraws::new();
    s.push(Stream::Prices, [0.0, 0.75]);
    near(consensus(10.0e6, &mut s), 9.5e6);
    near(consensus(10.0e6, &mut s), 10.25e6);
    // Uniform ±5%: mean 0, sd 0.1 ÷ sqrt(12).
    let mut r = RngStreams::new(5);
    let n = 100_000;
    let es: Vec<f64> = (0..n).map(|_| consensus(1.0, &mut r) - 1.0).collect();
    assert!(es.iter().all(|e| (-0.05..0.05).contains(e)));
    let mean = es.iter().sum::<f64>() / n as f64;
    let sd = (es.iter().map(|e| (e - mean).powi(2)).sum::<f64>() / n as f64).sqrt();
    assert!(mean.abs() < 5e-4, "{mean}");
    assert!((sd / (0.1 / 12f64.sqrt()) - 1.0).abs() < 0.01, "{sd}");
}
