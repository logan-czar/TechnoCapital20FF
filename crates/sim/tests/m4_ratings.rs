//! Build-plan M4.5 against the live engine: implied rating, adjustments, sovereign ceiling and
//! the one or two notch move at the 01:00 release-day review (spec 5.12, 3.6.3, 3.6.4).
//!
//! Done line: starting ratings match the run rate. The engine computes each company's starting
//! rating at load from its own load month (7.1, D121); the expected rating is finance-start.csv,
//! the independent Python implementation of 5.12 and 7.1 (export_finance_fixtures.py) on
//! validate.py's run rate and company-start.csv.

mod common;
mod finance_common;

use common::data;
use common::ops::{company, run_to};
use finance_common::finance_start;
use sim::Sim;
use sim::finance::rating::Rating;
use sim::time::{Date, DateTime};

#[test]
fn starting_ratings_match_the_run_rate_for_all_651() {
    let d = data();
    let sim = Sim::new(d.clone(), 1).unwrap();
    let w = sim.world();
    let rows = finance_start();
    assert_eq!(rows.len(), 651);
    let mut off = Vec::new();
    let mut leverage_off = 0;
    for row in &rows {
        let c = &w.companies[company(w, row.id())];
        // The engine's own implied rating from its run rate (7.1, 5.12; D121) against the
        // independent Python export, and against company-start.csv's start_rating, which load
        // reads as the starting rating (D241, D132).
        let computed = c.finance.implied.implied;
        let fixture = row.rating("start_rating");
        let start = d
            .company_start
            .rows
            .iter()
            .find(|s| s.id == row.id())
            .unwrap();
        let csv = Rating::parse(&start.start_rating).unwrap();
        if computed != fixture || computed != csv {
            off.push(format!(
                "{} engine {computed} fixture {fixture} company-start {csv} (leverage {} vs {})",
                row.id(),
                c.finance.implied.leverage,
                row.rating("leverage_rating")
            ));
        }
        if c.finance.implied.leverage != row.rating("leverage_rating") {
            leverage_off += 1;
        }
        // The rating is the implied one, no smoothing (7.1).
        assert_eq!(c.finance.rating, csv, "{}", row.id());
    }
    println!(
        "starting ratings: {} of 651 computed by the engine match finance-start.csv and \
         company-start.csv; leverage ratings off: {leverage_off}",
        651 - off.len()
    );
    for o in &off {
        println!("  {o}");
    }
    assert!(off.is_empty(), "{} starting ratings differ", off.len());
}

#[test]
fn ceiling_and_review_moves_on_release_day() {
    let mut sim = Sim::new(data(), 2).unwrap();
    // Every rating sits at or below its sovereign + 1 ceiling (5.12).
    {
        let w = sim.world();
        for (_, c) in w.companies.iter() {
            let sov = w.countries[c.hq_country].sovereign_rating;
            assert!(
                c.finance.rating.notch() >= sov.notch() - 1,
                "{} {} above {sov} + 1",
                c.key,
                c.finance.rating
            );
        }
    }
    // Walk the first two years of release-day reviews. Each review moves a rating toward the
    // implied rating it computed, by 1 notch, or 2 when 3 or more notches away (3.6.4), and
    // never past it.
    let mut moves = [0usize; 3];
    for year in 2020..2022 {
        for month in [1u8, 4, 7, 10] {
            let review = DateTime::at(Date::ymd(year, month, 2), 1);
            while sim.now().next() < review {
                sim.step();
            }
            let before = sim.world().clone();
            sim.step();
            let w = sim.world();
            for (id, c) in w.companies.iter() {
                let b = &before.companies[id];
                if b.finance.status().is_frozen() {
                    assert_eq!(c.finance.rating, b.finance.rating, "{} frozen", c.key);
                    continue;
                }
                let from = b.finance.rating.notch();
                let implied = c.finance.implied.implied.notch();
                let gap = implied - from;
                let step = if gap.abs() >= 3 { 2 } else { gap.abs().min(1) };
                let want = from + gap.signum() * step;
                assert_eq!(
                    c.finance.rating.notch(),
                    want,
                    "{} from {} toward {} on {year}-{month:02}-02",
                    c.key,
                    b.finance.rating,
                    c.finance.implied.implied
                );
                assert_eq!(c.finance.last_review_notches, from - want);
                moves[step as usize] += 1;
                // The implied rating is the leverage rating plus the adjustments, clamped,
                // capped at the sovereign + 1 ceiling (5.12).
                let i = &c.finance.implied;
                let adjusted = Rating::from_notch(
                    i.leverage.notch() - (i.cover_notches + i.size_notches + i.sector_notches),
                );
                assert_eq!(i.adjusted, adjusted, "{}", c.key);
                let sov = w.countries[c.hq_country].sovereign_rating;
                assert_eq!(i.ceiling, Rating::from_notch(sov.notch() - 1));
                assert_eq!(i.implied, i.adjusted.max(i.ceiling), "{}", c.key);
            }
        }
    }
    println!(
        "reviews 2020-2021: {} held, {} one-notch moves, {} two-notch moves",
        moves[0], moves[1], moves[2]
    );
    assert!(moves[1] > 0, "some ratings move");
}

#[test]
fn first_review_reads_the_synthetic_history() {
    // On 2 January 2020 the trailing four quarters are the synthetic 2019 history, the run
    // rate the starting rating was read from (7.1, 4.4); with the starting balances unchanged
    // the leverage rating is the starting one.
    let mut sim = Sim::new(data(), 3).unwrap();
    let at_load: Vec<_> = sim
        .world()
        .companies
        .iter()
        .map(|(_, c)| c.finance.implied)
        .collect();
    run_to(&mut sim, Date::ymd(2020, 1, 3));
    let w = sim.world();
    for ((_, c), load) in w.companies.iter().zip(at_load) {
        assert_eq!(c.finance.implied.leverage, load.leverage, "{}", c.key);
        assert_eq!(
            c.finance.implied.size_notches, load.size_notches,
            "{}",
            c.key
        );
        assert_eq!(c.finance.implied.ceiling, load.ceiling, "{}", c.key);
    }
}
