//! Build-plan M5.8, the spec M5 done line: "opening price at V, $5 to $200; prices track V
//! within ±30% over 10 years".
//!
//! - Opening at V, $5 to $200: every listed company opens at company-start.csv's open_price, the
//!   7.1 rule on its engine value, with V = engine value ÷ shares within the share rounding
//!   (checked company by company in `m5_load.rs`; here the range and the gap on every seed).
//! - Tracking (D143): at each daily close (00:00, after the daily jobs) every quoted company is
//!   one company-day; it tracks when `|P ÷ V − 1| ≤ 30%`. The done line holds for a seed when at
//!   least 90% of its company-days over 2020 to 2029 track. Seeds 1 to 5 run on their own threads;
//!   the share, the median and 95th percentile gap and the worst year are printed per seed.
//! - The first release (design fix 235): V moves at the first daily refresh (2 January 00:00:
//!   the company confidence factor and the effective spread replace 7.1's 1.0 and base spread)
//!   and at the 01:00 full recalculation (the synthetic TTM net income includes line interest and
//!   interest on cash, which 7.1's engine value skips). The test prints both moves' distribution,
//!   how many companies cross between the profit and loss paths, and the tracking share right
//!   after; the surprise of that release is 0 (D133), so P does not jump.

mod common;

use common::data;
use sim::Sim;
use sim::time::{Date, DateTime};

/// D143: a company-day tracks V within ±30%.
const BAND: f64 = 0.30;
/// D143: the share of company-days that must track over the 10 years, per seed.
const MIN_TRACKING_SHARE: f64 = 0.90;
const YEARS: i32 = 10;
const SEEDS: [u64; 5] = [1, 2, 3, 4, 5];
/// Spec 7.1: open prices run $5 to $200.
const PRICE_MIN: f64 = 5.0;
const PRICE_MAX: f64 = 200.0;

fn quantile(sorted: &[f64], q: f64) -> f64 {
    if sorted.is_empty() {
        return f64::NAN;
    }
    let i = ((sorted.len() - 1) as f64 * q).round() as usize;
    sorted[i]
}

struct SeedResult {
    seed: u64,
    within: u64,
    days: u64,
    median_gap: f64,
    p95_gap: f64,
    worst_year: (i32, f64),
    open_gap: f64,
}

fn run_seed(seed: u64) -> SeedResult {
    let mut sim = Sim::new(data(), seed).unwrap();
    // Opening at V, $5 to $200.
    let mut open_gap: f64 = 0.0;
    for s in sim.world().market.stocks.rows().iter().filter(|s| s.quoted) {
        assert!((PRICE_MIN..=PRICE_MAX).contains(&s.price));
        open_gap = open_gap.max((s.price / s.value - 1.0).abs());
    }
    let end = DateTime::midnight(Date::ymd(2020 + YEARS, 1, 1));
    let (mut within, mut days) = (0u64, 0u64);
    let mut gaps: Vec<f64> = Vec::new();
    let mut year: Vec<(u64, u64)> = vec![(0, 0); YEARS as usize];
    while sim.now() < end {
        sim.step();
        let t = sim.now();
        if t.hour() != 0 {
            continue;
        }
        // The day that just closed.
        let y = (t.date().add_days(-1).year - 2020) as usize;
        for s in sim.world().market.stocks.rows().iter().filter(|s| s.quoted) {
            let gap = if s.value > 0.0 {
                (s.price / s.value - 1.0).abs()
            } else {
                f64::INFINITY
            };
            days += 1;
            year[y].1 += 1;
            if gap <= BAND {
                within += 1;
                year[y].0 += 1;
            }
            gaps.push(gap);
        }
    }
    gaps.sort_by(f64::total_cmp);
    let worst_year = year
        .iter()
        .enumerate()
        .map(|(i, &(w, d))| (2020 + i as i32, w as f64 / d.max(1) as f64))
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .unwrap();
    SeedResult {
        seed,
        within,
        days,
        median_gap: quantile(&gaps, 0.5),
        p95_gap: quantile(&gaps, 0.95),
        worst_year,
        open_gap,
    }
}

#[test]
fn prices_track_v_within_30_percent_over_ten_years() {
    let results: Vec<SeedResult> = std::thread::scope(|scope| {
        let handles: Vec<_> = SEEDS
            .iter()
            .map(|&seed| scope.spawn(move || run_seed(seed)))
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    println!(
        "seed | company-days | within ±30% | median |P/V−1| | p95 | worst year | open max |P/V−1|"
    );
    for r in &results {
        println!(
            "{} | {} | {:.2}% | {:.2}% | {:.2}% | {} {:.2}% | {:.1e}",
            r.seed,
            r.days,
            100.0 * r.within as f64 / r.days as f64,
            100.0 * r.median_gap,
            100.0 * r.p95_gap,
            r.worst_year.0,
            100.0 * r.worst_year.1,
            r.open_gap
        );
    }
    for r in &results {
        assert!(r.open_gap < 1e-4, "seed {}: opens at V", r.seed);
        let share = r.within as f64 / r.days as f64;
        assert!(
            share >= MIN_TRACKING_SHARE,
            "seed {}: {share} of company-days within ±30%",
            r.seed
        );
    }
}

#[test]
fn the_first_release_moves_v() {
    let mut sim = Sim::new(data(), 1).unwrap();
    let load: Vec<(f64, bool, bool)> = sim
        .world()
        .market
        .stocks
        .rows()
        .iter()
        .map(|s| (s.value, s.quoted, s.basis.e_norm.is_some_and(|e| e > 0.0)))
        .collect();
    let refresh_tick = DateTime::midnight(Date::ymd(2020, 1, 2));
    let move_tick = DateTime::at(Date::ymd(2020, 1, 2), 1);
    let mut after_refresh = Vec::new();
    while sim.now() < move_tick {
        sim.step();
        if sim.now() == refresh_tick {
            after_refresh = sim
                .world()
                .market
                .stocks
                .rows()
                .iter()
                .map(|s| s.value)
                .collect();
        }
    }
    let w = sim.world();
    let mut refresh_moves = Vec::new();
    let mut release_moves = Vec::new();
    let mut total_moves = Vec::new();
    let (mut crossed_to_loss, mut crossed_to_profit, mut outside_band) = (0, 0, 0);
    let mut quoted = 0;
    let mut all_crossed = 0;
    for (i, s) in w.market.stocks.rows().iter().enumerate() {
        let (v0, was_quoted, profit0) = load[i];
        let profit1 = s.basis.e_norm.is_some_and(|e| e > 0.0);
        all_crossed += usize::from(profit0 != profit1);
        if v0 <= 0.0 || !was_quoted {
            continue;
        }
        refresh_moves.push(after_refresh[i] / v0 - 1.0);
        release_moves.push(s.value / after_refresh[i] - 1.0);
        total_moves.push(s.value / v0 - 1.0);
        if profit0 && !profit1 {
            crossed_to_loss += 1;
        }
        if !profit0 && profit1 {
            crossed_to_profit += 1;
        }
        // D133: the consensus for Q4 2019 is its synthetic net income, so s = 0 and no buzz.
        assert_eq!(s.last_surprise, 0.0);
        assert_eq!(s.buzz, 0.0);
        if (s.price / s.value - 1.0).abs() > 0.30 {
            outside_band += 1;
        }
        quoted += 1;
    }
    for v in [&mut refresh_moves, &mut release_moves, &mut total_moves] {
        v.sort_by(f64::total_cmp);
    }
    let show = |name: &str, v: &[f64]| {
        println!(
            "{name}: p10 {:+.1}%, median {:+.1}%, p90 {:+.1}%, min {:+.1}%, max {:+.1}%",
            100.0 * quantile(v, 0.1),
            100.0 * quantile(v, 0.5),
            100.0 * quantile(v, 0.9),
            100.0 * v[0],
            100.0 * v[v.len() - 1]
        )
    };
    println!("{quoted} listed companies, V at load to 2 January 2020 01:00 (seed 1):");
    show("  00:00 daily refresh", &refresh_moves);
    show("  01:00 full recalculation", &release_moves);
    show("  both", &total_moves);
    println!(
        "  {crossed_to_loss} cross from the profit path to the loss path, {crossed_to_profit} the other way; \
         {outside_band} sit outside ±30% of V right after; {all_crossed} of all 651 cross"
    );
    assert_eq!(quoted, 467);
}
