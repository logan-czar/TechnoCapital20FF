//! M2.1: the global cycle (phases, g_t, lengths), the zone effect with lags and own shocks, and Z
//! (spec 5.1). Done when phase lengths and g_t stay in their ranges over 500 seeds.

mod common;

use common::data;
use common::economy::world_at_load;
use sim::Stream;
use sim::economy::cycle::{START_PHASE, advance_cycle, phase_spec, set_zone_effects, start_cycle};
use sim::rng::{NoNoise, RngStreams, ScriptedDraws};
use sim::world::{CyclePhase, World};

/// 100 years of quarters per seed.
const QUARTERS: usize = 400;

/// The spec 5.1 phase table, written out here so the test does not read the code under test:
/// phase, g_t a year (low, high), length in quarters (shortest, longest), next phase.
type Row = (CyclePhase, (f64, f64), (u32, u32), CyclePhase);
const SPEC_5_1: [Row; 4] = [
    (
        CyclePhase::Expansion,
        (0.0, 0.02),
        (12, 28),
        CyclePhase::Overheating,
    ),
    (
        CyclePhase::Overheating,
        (0.02, 0.04),
        (2, 6),
        CyclePhase::Contraction,
    ),
    (
        CyclePhase::Contraction,
        (-0.06, -0.03),
        (2, 8),
        CyclePhase::Recovery,
    ),
    (
        CyclePhase::Recovery,
        (-0.02, 0.01),
        (4, 10),
        CyclePhase::Expansion,
    ),
];

/// The spec 5.1 row of a phase.
fn spec_row(phase: CyclePhase) -> Row {
    *SPEC_5_1.iter().find(|r| r.0 == phase).unwrap()
}

#[test]
fn phase_table_is_the_spec_table() {
    for (phase, g, len, next) in SPEC_5_1 {
        let spec = phase_spec(phase);
        assert_eq!(
            (spec.g_range, spec.length, spec.next),
            (g, len, next),
            "{phase:?}"
        );
    }
    assert_eq!(
        START_PHASE,
        CyclePhase::Expansion,
        "the game starts in Expansion (7.3)"
    );
}

#[test]
fn phase_lengths_and_g_stay_in_range_over_500_seeds() {
    let (mut phases, mut quarters, mut g_quarters) = (0usize, 0usize, 0.0);
    // The shortest and longest length seen per phase: a uniform whole-quarter draw reaches both
    // ends of its range (D101).
    let mut seen: Vec<(u32, u32)> = vec![(u32::MAX, 0); SPEC_5_1.len()];
    for seed in 0..500 {
        let mut rng = RngStreams::new(seed);
        let mut c = start_cycle(2, 1.07, &mut rng);
        assert_eq!(
            c.phase,
            CyclePhase::Expansion,
            "the game starts in Expansion (7.3)"
        );
        let mut entered = (c.phase, c.g_t, c.quarters_left);
        let mut check = |(phase, g, len): (CyclePhase, f64, u32)| {
            let (_, (lo, hi), (shortest, longest), _) = spec_row(phase);
            assert!((lo..hi).contains(&g), "seed {seed}: {phase:?} g {g}");
            assert!(
                (shortest..=longest).contains(&len),
                "seed {seed}: {phase:?} length {len}"
            );
            let i = SPEC_5_1.iter().position(|r| r.0 == phase).unwrap();
            seen[i] = (seen[i].0.min(len), seen[i].1.max(len));
        };
        check(entered);
        let mut used = 1;
        for _ in 1..QUARTERS {
            let was = c.phase;
            advance_cycle(&mut c, &mut rng);
            g_quarters += c.g_t;
            if c.phase != was {
                assert_eq!(
                    used, entered.2,
                    "seed {seed}: the phase ran its drawn length"
                );
                assert_eq!(c.phase, spec_row(was).3, "phases go in the spec 5.1 order");
                entered = (c.phase, c.g_t, c.quarters_left);
                check(entered);
                phases += 1;
                used = 1;
            } else {
                used += 1;
                assert_eq!(c.g_t, entered.1, "g_t holds for the whole phase");
            }
            assert_eq!(c.g_history[0], c.g_t);
            quarters += 1;
        }
    }
    for ((phase, _, len, _), got) in SPEC_5_1.iter().zip(&seen) {
        assert_eq!(*got, *len, "{phase:?}: lengths seen cover the whole range");
    }
    // Spec 5.1: an average cycle (four phases) runs about 9 years and g_t averages about +0.2% a
    // year over it.
    let quarters_per_cycle = 4.0 * quarters as f64 / phases as f64;
    assert!(
        (32.0..40.0).contains(&quarters_per_cycle),
        "{quarters_per_cycle}"
    );
    let mean_g = g_quarters / quarters as f64;
    assert!((0.0005..0.003).contains(&mean_g), "{mean_g}");
}

#[test]
fn z_is_the_gdp_weighted_intensity() {
    // Spec 5.1: Z is 1.07 at the 2020 data with the 26 zones.
    let w = World::from_data(&data()).unwrap();
    assert!((w.cycle.z_avg - 1.07).abs() < 0.005, "{}", w.cycle.z_avg);
    let shares: f64 = w.zones.iter().map(|(_, z)| z.gdp_share).sum();
    assert!((shares - 1.0).abs() < 1e-12);
    let by_zone: f64 = w.zones.iter().map(|(_, z)| z.gdp_share * z.intensity).sum();
    assert!(
        (by_zone - w.cycle.z_avg).abs() < 1e-12,
        "Σ gdp_share × intensity is Z too"
    );
}

#[test]
fn zone_effects_lag_and_own_shocks() {
    let d = data();
    let mut w = world_at_load(&d, &mut NoNoise);
    // Before the start every lag reads the starting g_t (spec 5.1).
    let g0 = w.cycle.g_t;
    assert!(w.cycle.g_history.iter().all(|&g| g == g0));
    // A history of three different quarters: now 0.03, a quarter ago −0.045, two ago 0.01.
    w.cycle.g_history = vec![0.03, -0.045, 0.01];
    w.cycle.g_t = 0.03;
    let shock_zones: Vec<String> = w
        .zones
        .iter()
        .filter(|(_, z)| z.own_shock_sd > 0.0)
        .map(|(_, z)| z.key.clone())
        .collect();
    assert_eq!(
        shock_zones,
        ["CUB", "PRK", "RU"],
        "zones with their own dynamics"
    );
    let mut s = ScriptedDraws::new();
    s.push(Stream::Cycle, [1.0, -5.0, 0.5]);
    set_zone_effects(&mut w, &mut s);
    assert_eq!(
        s.remaining(Stream::Cycle),
        0,
        "one draw per own-shock zone only"
    );
    let zone = |key: &str| {
        w.zones
            .iter()
            .find(|(_, z)| z.key == key)
            .unwrap()
            .1
            .clone()
    };
    let close = |a: f64, b: f64| assert!((a - b).abs() < 1e-15, "{a} vs {b}");
    close(zone("NA").effect, 1.0 * 0.03); // lag 0
    close(zone("EU").effect, 1.2 * -0.045); // lag 1
    close(zone("AFS").effect, 1.3 * 0.01); // lag 2
    // Cuba: intensity 0.3, lag 2, own shock 0.03 × z; North Korea's z is clamped to −3.
    close(zone("CUB").effect, 0.3 * 0.01 + 0.03 * 1.0);
    close(zone("PRK").effect, 0.3 * 0.01 + 0.03 * -3.0);
    close(zone("RU").effect, 1.1 * -0.045 + 0.02 * 0.5);

    // Own shocks have the zone's sd (D102: own_shock_sd is the sd of each quarter's draw).
    let mut rng = RngStreams::new(3);
    let n = 20_000;
    let mut sum_sq = 0.0;
    for _ in 0..n {
        let x = sim::economy::cycle::draw_own_shock(0.03, &mut rng);
        sum_sq += x * x;
    }
    let sd = (sum_sq / n as f64).sqrt();
    assert!((sd - 0.03).abs() < 0.001, "{sd}");
}

#[test]
fn the_cycle_advances_only_at_quarter_starts() {
    // Through the full game: g_t and the phase change only on 1 Jan, Apr, Jul and Oct.
    let mut sim = sim::Sim::new(data(), 11).unwrap();
    let mut last = (sim.world().cycle.phase, sim.world().cycle.quarters_left);
    let end = sim::time::DateTime::midnight(sim::time::Date::ymd(2024, 1, 2));
    while sim.now() < end {
        sim.step();
        let c = &sim.world().cycle;
        let now = (c.phase, c.quarters_left);
        if now != last {
            let d = sim.now().date();
            assert!(sim.now().hour() == 0 && d.day == 1 && matches!(d.month, 1 | 4 | 7 | 10));
            last = now;
        }
    }
}
