//! M2.2: the zone economy's effective credit spread each quarter (spec 5.1.2). Done when the EU
//! pays 112 and 56 bps at mid Contraction and Overheating, and Argentina 931 and 364.
//!
//! The spec and build-plan say Argentina pays 307 in a mid Overheating; the formula with
//! Argentina's data (base 591, intensity 1.6) gives 591 × (1 − 8 × 1.6 × 0.03) = 364. 307 is what
//! an intensity of 2.0 would give, so the prose figure is the error (design fix 100).

mod common;

use common::data;
use common::economy::world_at_load;
use sim::economy::cycle::set_zone_effects;
use sim::economy::zones::{effective_spread, effective_spread_bps, set_zone_spreads};
use sim::rng::NoNoise;
use sim::world::World;

/// The middle g of Contraction (−3% to −6%) and Overheating (+2% to +4%) (spec 5.1).
const MID_CONTRACTION: f64 = -0.045;
const MID_OVERHEATING: f64 = 0.03;

fn base_and_intensity(w: &World, key: &str) -> (f64, f64) {
    let z = w.zones.iter().find(|(_, z)| z.key == key).unwrap().1;
    (z.credit_spread_base * 1e4, z.intensity)
}

#[test]
fn eu_and_argentina_spreads_at_mid_phases() {
    let w = World::from_data(&data()).unwrap();
    let (eu, eu_i) = base_and_intensity(&w, "EU");
    let (ar, ar_i) = base_and_intensity(&w, "AR");
    assert_eq!((eu.round(), eu_i), (78.0, 1.2));
    assert_eq!((ar.round(), ar_i), (591.0, 1.6));
    assert_eq!(effective_spread_bps(eu, eu_i * MID_CONTRACTION), 112.0);
    assert_eq!(effective_spread_bps(eu, eu_i * MID_OVERHEATING), 56.0);
    assert_eq!(effective_spread_bps(ar, ar_i * MID_CONTRACTION), 931.0);
    assert_eq!(effective_spread_bps(ar, ar_i * MID_OVERHEATING), 364.0);
    // A zone with base 0 (Switzerland) stays at 0; the 0.5x to 2x clamp holds.
    assert_eq!(effective_spread_bps(0.0, -0.2), 0.0);
    assert_eq!(effective_spread_bps(591.0, -0.5), 1182.0);
    assert_eq!(effective_spread_bps(591.0, 0.5), 296.0);
    assert!((effective_spread(0.0078, 0.0) - 0.0078).abs() < 1e-15);
}

#[test]
fn the_quarterly_job_reads_the_lagged_cycle() {
    // EU and Argentina lag the cycle by one quarter: a quarter after a mid Contraction began,
    // with the world now in Overheating, they still pay the Contraction spread.
    let mut w = world_at_load(&data(), &mut NoNoise);
    w.cycle.g_t = MID_OVERHEATING;
    w.cycle.g_history = vec![MID_OVERHEATING, MID_CONTRACTION, MID_CONTRACTION];
    set_zone_effects(&mut w, &mut NoNoise);
    set_zone_spreads(&mut w);
    let bps = |key: &str| {
        let z = w.zones.iter().find(|(_, z)| z.key == key).unwrap().1;
        (z.credit_spread * 1e4).round()
    };
    assert_eq!(bps("EU"), 112.0);
    assert_eq!(bps("AR"), 931.0);
    // North America has no lag: base 1 bps × (1 − 8 × 0.03) = 0.76, rounded to 1.
    assert_eq!(bps("NA"), 1.0);
    assert_eq!(bps("CH"), 0.0);
}

#[test]
fn spreads_start_at_load_and_move_each_quarter_only() {
    let mut sim = sim::Sim::new(data(), 4).unwrap();
    let spreads = |s: &sim::Sim| -> Vec<f64> {
        s.world()
            .zones
            .iter()
            .map(|(_, z)| z.credit_spread)
            .collect()
    };
    // At load the spread is set from the starting effect (Expansion pushes it at most 0.5x
    // under the base, never over it in a zone with no own shock).
    for (_, z) in sim.world().zones.iter() {
        assert!(z.credit_spread <= z.credit_spread_base + 1e-12 || z.own_shock_sd > 0.0);
        assert!(z.credit_spread >= 0.5 * z.credit_spread_base - 1e-4);
    }
    let mut last = spreads(&sim);
    let end = sim::time::DateTime::midnight(sim::time::Date::ymd(2022, 1, 2));
    while sim.now() < end {
        sim.step();
        let now = spreads(&sim);
        if now != last {
            let d = sim.now().date();
            assert!(d.day == 1 && matches!(d.month, 1 | 4 | 7 | 10) && sim.now().hour() == 0);
            last = now;
        }
    }
}
