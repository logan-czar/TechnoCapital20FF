//! M3.6 against the live engine: data created, converted, decayed and retained at 4.3 step 8,
//! and free R&D (spec 5.9, 7.1). Expected values are worked from the spec, written out here.
//!
//! Spec M3.6 done: held data settles where `C = rate × held`. Arrowhead's one enterprise station
//! converts at capacity (0.9125 TB a month, less than its 3.3 TB inflow), so its held data rises
//! from about 8.6 TB toward about 20 TB, 2% free R&D (7.1).

mod common;

use common::data;
use common::ops::{company, run_to};
use sim::Sim;
use sim::time::Date;

/// Spec 5.9 step 4: `rate = base × (1 + log10(held))` for held ≥ 1, else base.
fn spec_rate(held: f64, base: f64) -> f64 {
    if held >= 1.0 {
        base * (1.0 + held.log10())
    } else {
        base
    }
}

/// Spec 5.9 step 1: `1 + floor(log10(held))` percent for held ≥ 1 TB, else 0.
fn spec_free_rd(held: f64) -> u32 {
    if held < 1.0 {
        0
    } else {
        1 + held.log10().floor() as u32
    }
}

#[test]
fn one_data_month_on_every_company() {
    let mut sim = Sim::new(data(), 13).unwrap();
    let before = sim.world().clone();
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    for (id, c) in w.companies.iter() {
        let b = &before.companies[id].data[0].book;
        let book = &c.data[0].book;
        let p = &w.industries[c.industry].params;
        let u = &w.units[c.units[0]];
        // 2. Create: revenue_month ($M) × data_tb_per_musd into this month's bucket.
        let created = u.revenue_m / 1e6 * p.data_tb_per_musd;
        // 3. Convert up to (enterprise + 0.5 × 50/50) × 0.9125 TB, oldest first.
        let s = &c.stations;
        let capacity = (s.enterprise as f64 + 0.5 * s.fifty_fifty as f64) * 0.9125;
        let unstructured: f64 = b.unstructured.iter().sum::<f64>() + created;
        let converted = capacity.min(unstructured);
        // 4. Decay at the rate of held after conversion.
        let held = b.held + converted;
        let want = held - held * spec_rate(held, p.data_decay_base);
        assert!(
            (book.held - want).abs() <= 1e-9 * want.max(1.0),
            "{}",
            c.key
        );
        assert!(
            (book.unstructured.iter().sum::<f64>() - (unstructured - converted)).abs() < 1e-9,
            "{}",
            c.key
        );
        assert_eq!(book.unstructured.len(), 2, "the load month and this one");
        // 1. Free R&D for this month from held at its start.
        assert_eq!(book.free_rd_pct, spec_free_rd(b.held), "{}", c.key);
    }
}

#[test]
fn arrowhead_held_data_settles_where_conversion_equals_decay() {
    let mut sim = Sim::new(data(), 13).unwrap();
    let w = sim.world();
    let a = company(w, "CO-0001");
    let book = &w.companies[a].data[0].book;
    // 7.1: about 8.6 TB at start, 1% free R&D, one month of unstructured (40 × 1 ÷ 12 TB).
    assert!((book.held - 8.6).abs() < 0.05, "{}", book.held);
    assert_eq!(book.free_rd_pct, 1);
    assert_eq!(book.unstructured.len(), 1);
    assert!((book.unstructured[0] - 40.0 / 12.0).abs() < 1e-9);

    let mut held_by_year = Vec::new();
    for year in 2021..=2040 {
        run_to(&mut sim, Date::ymd(year, 1, 1));
        held_by_year.push(sim.world().companies[a].data[0].book.held);
    }
    let w = sim.world();
    let c = &w.companies[a];
    let book = &c.data[0].book;
    let base = w.industries[c.industry].params.data_decay_base;
    // C = 0.9125 TB a month (one station at capacity). The steady state holds for held after
    // conversion and before decay (D210): end-of-month held + C.
    let c_tb = 0.9125;
    let h = book.held + c_tb;
    println!(
        "Arrowhead held TB at each 1 Jan 2021 to 2040: {:?}",
        held_by_year
            .iter()
            .map(|x| format!("{x:.2}"))
            .collect::<Vec<_>>()
    );
    assert!(held_by_year.windows(2).all(|p| p[1] >= p[0]), "rises");
    assert!(
        (spec_rate(h, base) * h - c_tb).abs() < 1e-5,
        "C = rate × held"
    );
    assert!((h - 20.0).abs() < 1.0, "about 20 TB: {h}");
    assert_eq!(book.free_rd_pct, 2);
    // 12-month retention (5.9 step 5): at most 12 buckets, the oldest a year old.
    assert_eq!(book.unstructured.len(), 12);
}
