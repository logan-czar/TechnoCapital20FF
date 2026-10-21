//! Build-plan M5.3 on the live engine (spec 5.14; 3.3.3, 3.1.0): every quoted stock steps each
//! hour toward V*, `P_next = P × (1 + 0.0003 × (V* ÷ P − 1) + noise)`, closed on 1 January and
//! frozen on the release tick. Over a long run the noise each stock takes, the price change less
//! the pull (written out here), has the spec's sd: `σh = 26% ÷ 19.1 ÷ √24` (the shared sector
//! volatility, D245) times `√(0.98 + 0.02 × 3²)` for the 2% of draws three times as wide (D246);
//! two stocks' noises correlate at ρ² = 0.25 (one z_market a tick, ρ = 0.5 × beta 1.0). Reaction
//! weeks are left out (their volatility is ×2 falling to ×1, and they hold the earnings jump).
//!
//! The engine's hourly loop also draws exactly what lane F's `step_prices` draws for the same
//! stocks (D135): the same seed gives the same prices.

mod common;

use common::data;
use sim::market::price::{StockTick, step_prices};
use sim::time::{Date, DateTime};
use sim::{RngStreams, Sim};

/// Spec 5.14 (3.3.3): the pull per tick.
const PULL: f64 = 0.0003;
/// D245: annual volatility 26% for every industry; spec 5.14 σh = annual ÷ 19.1 ÷ √24.
const ANNUAL_VOLATILITY: f64 = 0.26;
/// D246: 2% of draws are 3 times as wide, so the variance is 0.98 + 0.02 × 9 = 1.16 times.
const TAIL_VARIANCE: f64 = 0.98 + 0.02 * 9.0;
/// Spec 5.14: V* = V × (1 + 0.10 × buzz ÷ 100).
const BUZZ_WEIGHT: f64 = 0.10;
/// Spec 5.14: ρ = min(0.8, 0.5 × beta), beta 1.0 (D245); two stocks share ρ² of the variance.
const RHO: f64 = 0.5;

/// The run: the first half of 2020 (reaction weeks and 1 January excluded).
fn run_end() -> DateTime {
    DateTime::midnight(Date::ymd(2020, 7, 1))
}

fn in_reaction_week(t: DateTime) -> bool {
    let d = t.date();
    [1, 4, 7, 10].contains(&d.month) && (2..=8).contains(&d.day)
}

#[test]
fn live_price_noise_sd_matches_sigma_h() {
    let mut sim = Sim::new(data(), 5).unwrap();
    let n = sim.world().companies.len();
    let snapshot = |sim: &Sim| -> Vec<Option<(f64, f64)>> {
        let w = sim.world();
        w.market
            .stocks
            .rows()
            .iter()
            .map(|s| {
                s.quoted.then(|| {
                    let v_star = s.value * (1.0 + BUZZ_WEIGHT * s.buzz / 100.0);
                    (s.price, v_star)
                })
            })
            .collect()
    };
    let mut before = snapshot(&sim);
    let (mut sum, mut sum_sq, mut count) = (0.0, 0.0, 0u64);
    // Two fixed stocks for the correlation: the first two quoted ids.
    let pair: Vec<usize> = (0..n).filter(|&i| before[i].is_some()).take(2).collect();
    let (mut sxy, mut sx2, mut sy2) = (0.0, 0.0, 0.0);
    let mut closed_ticks_unchanged = 0;
    while sim.now() < run_end() {
        sim.step();
        let t = sim.now();
        let after = snapshot(&sim);
        let d = t.date();
        let release_tick = [1, 4, 7, 10].contains(&d.month) && d.day == 2 && t.hour() == 0;
        let holiday = d.month == 1 && d.day == 1;
        if holiday || release_tick {
            // Spec 4.1 step 2, 3.1.0, 4.4: no price moves.
            for i in 0..n {
                if let (Some(a), Some(b)) = (before[i], after[i]) {
                    assert_eq!(a.0, b.0, "{t}: price moved on a closed tick");
                }
            }
            closed_ticks_unchanged += 1;
        } else if !in_reaction_week(t) {
            let mut noises = [0.0; 2];
            for i in 0..n {
                if let (Some((p, v_star)), Some((p_next, _))) = (before[i], after[i]) {
                    let noise = p_next / p - 1.0 - PULL * (v_star / p - 1.0);
                    sum += noise;
                    sum_sq += noise * noise;
                    count += 1;
                    if let Some(k) = pair.iter().position(|&j| j == i) {
                        noises[k] = noise;
                    }
                }
            }
            sxy += noises[0] * noises[1];
            sx2 += noises[0] * noises[0];
            sy2 += noises[1] * noises[1];
        }
        before = after;
    }
    let mean = sum / count as f64;
    let sd = (sum_sq / count as f64 - mean * mean).sqrt();
    let sigma_h = ANNUAL_VOLATILITY / 19.1 / 24f64.sqrt();
    let want = sigma_h * TAIL_VARIANCE.sqrt();
    let corr = sxy / (sx2 * sy2).sqrt();
    println!(
        "{count} stock-ticks: noise sd {sd:.6} vs σh × √1.16 = {want:.6} ({:+.2}%), mean {mean:.2e}; \
         pair correlation {corr:.3} vs ρ² = {:.2}",
        100.0 * (sd / want - 1.0),
        RHO * RHO
    );
    // 1 January 01:00 to 23:00 (its 00:00 is the load) and the 2 January and 2 April release
    // ticks.
    assert_eq!(closed_ticks_unchanged, 23 + 2);
    assert!(count > 1_000_000, "{count}");
    assert!((sd / want - 1.0).abs() < 0.02, "sd {sd} vs {want}");
    assert!(mean.abs() < 0.05 * want, "mean {mean}");
    assert!((corr - RHO * RHO).abs() < 0.06, "correlation {corr}");
}

#[test]
fn the_hourly_job_draws_as_step_prices_does() {
    // One plain hour (2 March 2020, 10:00) from the same world and the same seed: the engine's
    // job against lane F's `step_prices` over the quoted stocks in id order.
    let mut sim = Sim::new(data(), 9).unwrap();
    let target = DateTime::at(Date::ymd(2020, 3, 2), 9);
    while sim.now() < target {
        sim.step();
    }
    let w = sim.world();
    let stocks: Vec<StockTick> = w
        .market
        .stocks
        .rows()
        .iter()
        .filter(|s| s.quoted)
        .map(|s| StockTick {
            price: s.price,
            value: s.value,
            buzz: s.buzz,
            annual_volatility: sim::market::price::SECTOR_VOLATILITY,
            beta: sim::market::price::SECTOR_BETA,
        })
        .collect();
    // Replay the save's RNG position on a copy.
    let bytes = sim.save_bytes();
    let state = sim::save::decode(&bytes).unwrap();
    let mut rng: RngStreams = state.rng;
    let want = step_prices(target.next(), &stocks, &mut rng);
    sim.step();
    let got: Vec<f64> = sim
        .world()
        .market
        .stocks
        .rows()
        .iter()
        .filter(|s| s.quoted)
        .map(|s| s.price)
        .collect();
    assert_eq!(got, want);
}
