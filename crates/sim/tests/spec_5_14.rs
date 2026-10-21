//! Spec 5.14 hourly share price (3.3.3, flow removed), the 4.2 daily bar and the headline
//! indices: build-plan M5.3 (price noise sd matches σh over a long run, NoNoise against the
//! game's streams), M5.4 (bars close at 00:00 each day) and M5.6 (an index does not jump when a
//! company lists or leaves).

use sim::market::daily::{BarBuilder, DailyBar};
use sim::market::price::{
    MIN_PRICE_USD, SECTOR_BETA, SECTOR_VOLATILITY, StockTick, prices_move,
    reaction_volatility_mult, rho, sigma_hourly, step_price, step_prices, target_value,
};
use sim::rng::{NoNoise, RngStreams, ScriptedDraws};
use sim::time::{Date, DateTime};

#[track_caller]
fn near(a: f64, b: f64) {
    assert!(
        (a - b).abs() <= 1e-12 * a.abs().max(b.abs()).max(1.0),
        "{a} vs {b}"
    );
}

fn at(y: i32, m: u8, d: u8, h: u8) -> DateTime {
    DateTime::at(Date::ymd(y, m, d), h)
}

/// An ordinary trading hour: not 1 January, not a release tick, not reaction week.
fn plain_hour() -> DateTime {
    at(2021, 2, 10, 5)
}

fn stock(price: f64, value: f64) -> StockTick {
    StockTick {
        price,
        value,
        buzz: 0.0,
        annual_volatility: SECTOR_VOLATILITY,
        beta: SECTOR_BETA,
    }
}

#[test]
fn sigma_and_rho_follow_the_spec() {
    // σh = annual volatility ÷ 19.1 ÷ sqrt(24); D245: the shared sector default is 26%, beta 1.0.
    near(SECTOR_VOLATILITY, 0.26);
    near(SECTOR_BETA, 1.0);
    near(sigma_hourly(0.26), 0.26 / 19.1 / 24f64.sqrt());
    assert!((sigma_hourly(0.26) - 0.002_778_6).abs() < 1e-7);
    // ρ = min(0.8, 0.5 × beta).
    near(rho(1.0), 0.5);
    near(rho(1.4), 0.7);
    near(rho(2.0), 0.8);
}

#[test]
fn markets_close_on_1_january_and_freeze_on_the_release_tick() {
    // 3.1.0: closed all of 1 January; 4.4, 21.2: the 00:00 release tick is frozen.
    for h in 0..24 {
        assert!(!prices_move(at(2021, 1, 1, h)), "1 Jan {h}:00");
    }
    for m in [1, 4, 7, 10] {
        assert!(!prices_move(at(2021, m, 2, 0)), "release {m}");
        assert!(prices_move(at(2021, m, 2, 1)), "price move {m}");
    }
    assert!(
        prices_move(at(2021, 2, 2, 0)),
        "the 2nd of a non-release month"
    );
    assert!(prices_move(at(2020, 12, 31, 23)));
    assert!(prices_move(plain_hour()));
    // A closed tick draws nothing and leaves prices as they are.
    let mut none = ScriptedDraws::new();
    let p = step_prices(at(2021, 1, 1, 7), &[stock(50.0, 100.0)], &mut none);
    assert_eq!(p, vec![50.0]);
}

#[test]
fn drift_closes_the_gap_toward_v_star() {
    // 5.14 with no noise: P × (1 + 0.0003 × (V ÷ P − 1)): 50 × (1 + 0.0003 × 1) = 50.015.
    let p = step_prices(plain_hour(), &[stock(50.0, 100.0)], &mut NoNoise);
    near(p[0], 50.015);
    // Buzz +50: V* = 100 × 1.05; 50 × (1 + 0.0003 × 1.1) = 50.0165.
    near(target_value(100.0, 50.0), 105.0);
    near(target_value(100.0, -100.0), 90.0);
    let p = step_prices(
        plain_hour(),
        &[StockTick {
            buzz: 50.0,
            ..stock(50.0, 100.0)
        }],
        &mut NoNoise,
    );
    near(p[0], 50.0165);
    // 3.3.3: "A gap between P and V* halves in about 2,300 ticks": the pull is 0.0003 × (V − P)
    // a tick, so the gap halves in ln 2 ÷ −ln(1 − 0.0003) = 2,310 ticks.
    let n = (2f64.ln() / -(1.0 - 0.0003f64).ln()).round() as usize;
    assert_eq!(n, 2310);
    let mut s = stock(50.0, 100.0);
    for _ in 0..n {
        s.price = step_prices(plain_hour(), &[s], &mut NoNoise)[0];
    }
    assert!(((100.0 - s.price) / 50.0 - 0.5).abs() < 1e-3, "{}", s.price);
    // At P = V nothing moves without noise.
    let p = step_prices(plain_hour(), &[stock(100.0, 100.0)], &mut NoNoise);
    assert_eq!(p[0], 100.0);
    // The price never goes below $0.01.
    near(step_price(0.02, 0.01, -0.9), MIN_PRICE_USD);
}

/// The noise of each tick, read back from a price path: `P' ÷ P − 1 − pull`.
fn noise_path(t: DateTime, ticks: usize, seed: Option<u64>) -> Vec<[f64; 2]> {
    let mut rng = seed.map(RngStreams::new);
    let mut s = [stock(100.0, 100.0), stock(100.0, 100.0)];
    let mut out = Vec::with_capacity(ticks);
    for _ in 0..ticks {
        let next = match rng.as_mut() {
            Some(r) => step_prices(t, &s, r),
            None => step_prices(t, &s, &mut NoNoise),
        };
        let mut row = [0.0; 2];
        for i in 0..2 {
            let pull = 0.0003 * (s[i].value / s[i].price - 1.0);
            row[i] = next[i] / s[i].price - 1.0 - pull;
            s[i].price = next[i];
        }
        out.push(row);
    }
    out
}

fn sd(xs: &[f64]) -> f64 {
    let n = xs.len() as f64;
    let m = xs.iter().sum::<f64>() / n;
    (xs.iter().map(|x| (x - m).powi(2)).sum::<f64>() / n).sqrt()
}

#[test]
fn price_noise_sd_matches_sigma_h_over_a_long_run() {
    // Build-plan M5.3. The 2%-of-draws ×3 tails (D246) lift the variance by 0.98 + 0.02 × 9 =
    // 1.16 for z_market and z_stock alike, so the noise sd is σh × sqrt(1.16) and two stocks
    // correlate at ρ² = 0.25 (they share z_market).
    const TICKS: usize = 200_000;
    let quiet = noise_path(plain_hour(), TICKS, None);
    assert!(
        quiet.iter().all(|r| r[0] == 0.0 && r[1] == 0.0),
        "NoNoise moves nothing"
    );
    let noisy = noise_path(plain_hour(), TICKS, Some(42));
    let a: Vec<f64> = noisy.iter().map(|r| r[0]).collect();
    let b: Vec<f64> = noisy.iter().map(|r| r[1]).collect();
    let want = sigma_hourly(0.26) * 1.16f64.sqrt();
    let got = sd(&a);
    assert!((got / want - 1.0).abs() < 0.015, "sd {got} vs {want}");
    assert!((sd(&b) / want - 1.0).abs() < 0.015);
    let ma = a.iter().sum::<f64>() / TICKS as f64;
    let mb = b.iter().sum::<f64>() / TICKS as f64;
    let cov = a
        .iter()
        .zip(&b)
        .map(|(x, y)| (x - ma) * (y - mb))
        .sum::<f64>()
        / TICKS as f64;
    let corr = cov / (sd(&a) * sd(&b));
    assert!((corr - 0.25).abs() < 0.02, "corr {corr}");
    // About 2% of stock draws are wide: beyond 5 σ of the body only wide draws reach.
    let wide = a
        .iter()
        .filter(|x| x.abs() > 5.0 * sigma_hourly(0.26))
        .count() as f64;
    assert!(wide > 0.0 && wide / (TICKS as f64) < 0.02);
}

#[test]
fn reaction_week_doubles_volatility_and_fades_by_day_7() {
    // 4.4 row 2, 21.3.1: ×2 from the 01:00 price move, linear by day to ×1 on the 8th (D247).
    near(reaction_volatility_mult(at(2021, 4, 2, 0)), 1.0);
    near(reaction_volatility_mult(at(2021, 4, 2, 1)), 2.0);
    near(reaction_volatility_mult(at(2021, 4, 2, 23)), 2.0);
    near(reaction_volatility_mult(at(2021, 4, 3, 0)), 2.0 - 1.0 / 6.0);
    near(reaction_volatility_mult(at(2021, 4, 5, 12)), 1.5);
    near(reaction_volatility_mult(at(2021, 4, 8, 12)), 1.0);
    near(reaction_volatility_mult(at(2021, 4, 9, 0)), 1.0);
    near(reaction_volatility_mult(at(2021, 5, 3, 0)), 1.0);
    near(reaction_volatility_mult(at(2021, 1, 2, 1)), 2.0);
    // Over a run on the release day the noise sd is twice the ordinary one.
    let noisy = noise_path(at(2021, 7, 2, 5), 100_000, Some(7));
    let a: Vec<f64> = noisy.iter().map(|r| r[0]).collect();
    let want = 2.0 * sigma_hourly(0.26) * 1.16f64.sqrt();
    assert!((sd(&a) / want - 1.0).abs() < 0.02, "{} vs {want}", sd(&a));
}

#[test]
fn bars_close_at_00_00_each_day() {
    // 4.2 step 1 (D248): the bar opens at the price the 00:00 daily jobs leave, takes every
    // moving hourly price through 00:00 the next day, then closes.
    let mut b = BarBuilder::start(Date::ymd(2021, 3, 4), 10.0);
    for p in [11.0, 9.0, 10.5] {
        b.tick(p);
    }
    assert_eq!(
        b.close(),
        Some(DailyBar {
            date: Date::ymd(2021, 3, 4),
            open: 10.0,
            high: 11.0,
            low: 9.0,
            close: 10.5,
        })
    );
    // A whole simulated day: 24 ticks from 01:00 to 00:00, the bar closes after the 00:00 tick.
    let mut rng = RngStreams::new(3);
    let day = Date::ymd(2021, 3, 4);
    let mut s = stock(100.0, 100.0);
    let mut bar = BarBuilder::start(day, s.price);
    let (mut hi, mut lo) = (s.price, s.price);
    for h in 1..=24u32 {
        let t = DateTime::midnight(day).add_hours(h);
        s.price = step_prices(t, &[s], &mut rng)[0];
        if prices_move(t) {
            bar.tick(s.price);
        }
        hi = hi.max(s.price);
        lo = lo.min(s.price);
    }
    let closed = bar.close().unwrap();
    assert_eq!(closed.date, day);
    assert_eq!(closed.open, 100.0);
    assert_eq!(closed.close, s.price);
    assert_eq!((closed.high, closed.low), (hi, lo));
    // 1 January trades no tick, so it leaves no bar.
    let jan1 = Date::ymd(2021, 1, 1);
    let mut bar = BarBuilder::start(jan1, 100.0);
    for h in 1..=24u32 {
        let t = DateTime::midnight(jan1).add_hours(h);
        if prices_move(t) {
            bar.tick(100.0);
        }
    }
    assert_eq!(bar.close(), None);
}
