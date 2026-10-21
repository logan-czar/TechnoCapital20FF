//! M3.8 against the live engine: the spec 7.1 Arrowhead check, and the load profit picture of
//! spec 2.2 and 5.5 (build-plan "Profit picture").
//!
//! Spec M3 done: 392 labor units, PC bonus +2, about 8.6 TB held, EBIT after R&D about $1.6M.
//! Every line comes from the engine's load month (D110) except the R&D plan, which is M6's (6.1,
//! 6.3): until the Lite AI exists every unit runs R&D at the norm (D105). The check therefore
//! reads the engine's revenue, variable, fixed cash, depreciation, shared costs and free R&D, and
//! applies the 7.1 plan written from the spec (Terry is Greedy: a Cash cow, R&D target
//! 0.05 × 0.7 × 0.8 = 2.8%, less the engine's 1% free R&D). It also prints the EBIT after R&D the
//! engine books today under the placeholder plan.
//!
//! M6.2 replaces the in-test R&D plan with the engine's booked `u.rd_m` (the 6.3 plan the lock
//! writes), keeping $1.6M and 4.1% for Arrowhead and 619 of 651 at a 6.1% median as the expected
//! values (D119).

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
    // The engine's own line under the placeholder plan (R&D at the norm, D105).
    let placeholder_after = 12.0 * u.ebit_m();
    // 7.1's plan (6.1 Cash cow 0.7, 6.3 Greedy 0.8): paid R&D = target − free R&D.
    let rd_norm = w.industries[u.industry].params.rd_norm;
    let target = rd_norm * 0.7 * 0.8;
    let paid = revenue * (target - book.free_rd_fraction()).max(0.0);
    let after = before - paid;
    println!(
        "Arrowhead at load (engine): revenue ${:.2}M, EBIT before R&D ${:.3}M, paid R&D at the \
         7.1 plan ${:.3}M, EBIT after R&D ${:.3}M ({:.1}%); at the placeholder plan (R&D at the \
         norm) ${:.3}M",
        revenue / 1e6,
        before / 1e6,
        paid / 1e6,
        after / 1e6,
        100.0 * after / revenue,
        placeholder_after / 1e6
    );
    assert!((paid - 0.72e6).abs() < 0.005e6, "paid R&D {paid}");
    assert!((after - 1.6e6).abs() < 0.05e6, "EBIT after R&D {after}");
    assert!((after / revenue - 0.041).abs() < 0.001);

    // The first monthly close keeps the done-line figures: the live recount (4.3 steps 4 and 5)
    // gives the same 392 labor units and +2.
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    let a = &w.companies[company(w, "CO-0001")];
    assert_eq!((a.labor_units, a.pc_bonus), (392, 2.0));
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

/// Margins after R&D at load, from the engine's lines, with `paid(world, unit)` R&D a year.
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

    // Today's engine: R&D at the norm (placeholder plan, D105).
    let engine = margins(w, |u| 12.0 * u.rd_m);
    let engine_pos = engine.iter().filter(|&&m| m > 1e-9).count();
    let engine_median = median(engine.clone());

    // With M6's plans (6.1, 6.3) on the engine's lines and free R&D: spec 2.2 and 5.5 expect
    // 619 of 651 profitable after R&D, median margin 6.1%.
    let planned = margins(w, |u| {
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
        12.0 * u.revenue_m * plan
    });
    let pos = planned.iter().filter(|&&m| m > 1e-9).count();
    let neg = planned.iter().filter(|&&m| m < -1e-9).count();
    let med = median(planned.clone());
    let lo = planned.iter().copied().fold(f64::INFINITY, f64::min);
    let hi = planned.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    println!(
        "Load profit picture (engine lines): with M6's 6.1/6.3 R&D plans {pos} of 651 profitable \
         after R&D, {neg} loss-making, median margin {:.1}%, range {:.1}% to {:.1}% (spec 2.2: 619 \
         of 651, 6.1%); with today's placeholder (R&D at the norm) {engine_pos} of 651, median \
         {:.2}%",
        100.0 * med,
        100.0 * lo,
        100.0 * hi,
        100.0 * engine_median
    );
    assert_eq!(pos, 619);
    assert_eq!(format!("{:.1}", 100.0 * med), "6.1");
    // Under the placeholder every company earns its PC bonus share, f × b ÷ (100 + b) (D105).
    assert_eq!(engine_pos, 651);
}
