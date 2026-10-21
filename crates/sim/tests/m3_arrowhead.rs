//! M3.8 against the live engine: the spec 7.1 Arrowhead check, and the load profit picture of
//! spec 2.2 and 5.5 (build-plan "Profit picture").
//!
//! Spec M3 done: 392 labor units, PC bonus +2, about 8.6 TB held, EBIT after R&D about $1.6M.
//! Every line comes from the engine's load month (D110), the R&D line too: since M6.2 the units
//! book the 6.3 plan at load (D283: 6.1 archetype mult × 6.3 trait mults at productivity 100 and
//! loss_q 0, less free R&D), so both checks read the engine's booked `u.rd_m`. Terry is Greedy:
//! a Cash cow, R&D target 0.05 × 0.7 × 0.8 = 2.8%, less the engine's 1% free R&D = 1.8%, $0.72M.
//! The expected values stay the spec's: $1.6M and 4.1% for Arrowhead, 619 of 651 profitable at a
//! 6.1% median (D119).

mod common;

use common::data;
use common::ops::{company, run_to};
use sim::Sim;
use sim::time::Date;
use sim::world::{BusinessUnit, World};

/// A unit's yearly EBIT before R&D at its month's run rate: revenue less variable, fixed cash,
/// depreciation and shared costs (spec 5.5).
fn ebit_before_rd(u: &BusinessUnit) -> f64 {
    12.0 * (u.revenue_m - u.variable_m - u.fixed_m - u.dep_m - u.shared_m)
}

#[test]
fn arrowhead_check_on_the_live_engine() {
    let mut sim = Sim::new(data(), 1).unwrap();
    let w = sim.world();
    let a = &w.companies[company(w, "CO-0001")];
    let u = &w.units[a.units[0]];
    let book = &a.data[0].book;
    assert_eq!(a.labor_units, 392);
    assert_eq!(a.pc_bonus, 2.0);
    assert!((book.held - 8.6).abs() < 0.05, "held {}", book.held);
    assert_eq!(book.free_rd_pct, 1);
    assert!((u.gross_assets - 39.2e6).abs() < 0.05e6);

    let revenue = 12.0 * u.revenue_m;
    assert!((revenue - 40.0e6).abs() < 0.01e6, "revenue {revenue}");
    let before = ebit_before_rd(u);
    // 7.1: about $2.35M (5% plus 0.45 × 2 ÷ 102 from the PC bonus).
    assert!((before - 2.35e6).abs() < 0.01e6, "EBIT before R&D {before}");
    // The engine's booked R&D: the 6.3 plan the unit runs from load (D283).
    let paid = 12.0 * u.rd_m;
    let after = 12.0 * u.ebit_m();
    // The plan written from the spec: 6.1 Cash cow 0.7, 6.3 Greedy 0.8, less the 1% free R&D.
    let rd_norm = w.industries[u.industry].params.rd_norm;
    let spec_plan = rd_norm * 0.7 * 0.8 - book.free_rd_fraction();
    assert!(
        (u.rd_plan - spec_plan).abs() < 1e-12,
        "rd_plan {}",
        u.rd_plan
    );
    println!(
        "Arrowhead at load (engine): revenue ${:.2}M, EBIT before R&D ${:.3}M, booked R&D \
         ${:.3}M ({:.1}% of revenue), EBIT after R&D ${:.3}M ({:.1}%)",
        revenue / 1e6,
        before / 1e6,
        paid / 1e6,
        100.0 * u.rd_plan,
        after / 1e6,
        100.0 * after / revenue,
    );
    assert!((paid - 0.72e6).abs() < 0.005e6, "paid R&D {paid}");
    assert!((after - 1.6e6).abs() < 0.05e6, "EBIT after R&D {after}");
    assert!((after / revenue - 0.041).abs() < 0.001);

    // The first monthly close keeps 392 labor units and 1% free R&D. The 9 January lock's 6.4
    // split put 100 stations on productivity (the largest power of ten at most 40% of 392, up
    // from the loadout's 98), so the first recount (5.8) counts PC 100: +3.
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    let a = &w.companies[company(w, "CO-0001")];
    assert_eq!((a.labor_units, a.stations.productivity), (392, 100));
    assert_eq!(a.pc_bonus, 3.0);
    assert_eq!(a.data[0].book.free_rd_pct, 1);
}

/// Spec 6.1 archetype R&D mult (first match) times the 6.3 trait mults of the named controller,
/// at productivity 100 (no productivity adj) and loss_q 0.
fn spec_rd_mult(control_basis: &str, revenue_musd: f64, sector: &str, traits: &[String]) -> f64 {
    let has = |t: &str| traits.iter().any(|x| x == t);
    let mut mult = if control_basis == "state" {
        1.0
    } else if revenue_musd < 50.0 && sector == "Tech" {
        1.2
    } else if has("Ambitious") || has("Brave") {
        1.3
    } else if has("Greedy") || has("Cautious") {
        0.7
    } else {
        1.0
    };
    for (t, k) in [
        ("Greedy", 0.8),
        ("Visionary", 1.25),
        ("Conservative", 0.9),
        ("Diligent", 1.1),
    ] {
        if has(t) {
            mult *= k;
        }
    }
    mult
}

fn median(mut v: Vec<f64>) -> f64 {
    v.sort_by(f64::total_cmp);
    let n = v.len();
    if n % 2 == 1 {
        v[n / 2]
    } else {
        0.5 * (v[n / 2 - 1] + v[n / 2])
    }
}

/// Margins after R&D at load, from the engine's lines, with `paid(unit)` R&D a year.
fn margins(w: &World, paid: impl Fn(&BusinessUnit) -> f64) -> Vec<f64> {
    w.units
        .iter()
        .map(|(_, u)| {
            let revenue = 12.0 * u.revenue_m;
            (ebit_before_rd(u) - paid(u)) / revenue
        })
        .collect()
}

#[test]
fn profit_picture_at_load() {
    let d = data();
    let sim = Sim::new(d.clone(), 1).unwrap();
    let w = sim.world();
    assert_eq!(w.units.len(), 651);

    // The booked plan is the spec's (6.1 first match, 6.3 trait mults, less free R&D), written
    // here from companies.csv and characters.csv.
    for (_, u) in w.units.iter() {
        let c = &w.companies[u.company];
        let row = d.companies.rows.iter().find(|r| r.id == c.key).unwrap();
        let ind = &w.industries[u.industry];
        let traits = d
            .characters
            .rows
            .iter()
            .find(|ch| ch.id == row.controller)
            .map_or(&[][..], |ch| &ch.traits[..]);
        let mult = spec_rd_mult(&row.control_basis, row.revenue_usd_m, &ind.sector, traits);
        let free = c.data_in(u.industry).unwrap().free_rd_fraction();
        let rd_norm = ind.params.rd_norm;
        let plan = (rd_norm * mult - free).clamp(0.0, 3.0 * rd_norm);
        assert!((u.rd_plan - plan).abs() < 1e-12, "{}", c.key);
        assert!((u.rd_m - u.revenue_m * plan).abs() < 1e-6 * u.revenue_m.max(1.0));
    }

    // The engine's booked R&D at load: spec 2.2 and 5.5 expect 619 of 651 profitable after R&D,
    // median margin 6.1%.
    let engine = margins(w, |u| 12.0 * u.rd_m);
    let pos = engine.iter().filter(|&&m| m > 1e-9).count();
    let neg = engine.iter().filter(|&&m| m < -1e-9).count();
    let med = median(engine.clone());
    let lo = engine.iter().copied().fold(f64::INFINITY, f64::min);
    let hi = engine.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    println!(
        "Load profit picture (engine lines and booked R&D): {pos} of 651 profitable after R&D, \
         {neg} loss-making, median margin {:.1}%, range {:.1}% to {:.1}% (spec 2.2: 619 of 651, \
         6.1%)",
        100.0 * med,
        100.0 * lo,
        100.0 * hi,
    );
    assert_eq!(pos, 619);
    assert_eq!(format!("{:.1}", 100.0 * med), "6.1");
}
