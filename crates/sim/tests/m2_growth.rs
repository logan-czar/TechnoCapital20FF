//! M2.3: the quarterly growth draw (lt_q, asymmetric k, φ, floor) and the phase labels (spec
//! 5.1). Done when the noise-off results match the worked table of 5.1.

mod common;

use common::data;
use common::economy::{economy_scheduler, industry, month_starts, run_month, world_at_load};
use sim::economy::growth::{PHI, cycle_k, growth_gap, lt_q, quarterly_growth};
use sim::rng::NoNoise;
use sim::time::Date;
use sim::world::{PhaseLabel, World};

/// Settled yearly growth `LT + k × Z × g_t` (spec 5.1 worked table): the noise-off draw run
/// with g held until it settles, read back a year as LT plus four times the quarterly gap.
fn settled_yearly(lt: f64, z_avg: f64, g: f64) -> f64 {
    let mut q = lt_q(lt);
    for _ in 0..200 {
        q = quarterly_growth(lt, q, 1.0, 0.01, z_avg, g, 0.0);
    }
    lt + growth_gap(q, lt)
}

#[test]
fn noise_off_draws_match_the_worked_table() {
    let z = World::from_data(&data()).unwrap().cycle.z_avg;
    // Spec 5.1 worked table (Z 1.07): rows Expansion +1%, Overheating +3%, Contraction −4.5%,
    // Recovery −0.5%; columns Retail (LT 3%), Software (9%), an LT 30% grower. One decimal.
    let table = [
        (0.01, [4.0, 10.3, 32.4]),
        (0.03, [6.0, 13.0, 37.3]),
        (-0.045, [-1.9, 4.8, 28.3]),
        (-0.005, [2.5, 8.5, 29.8]),
    ];
    let lts = [0.03, 0.09, 0.30];
    for (g, row) in table {
        for (lt, want) in lts.iter().zip(row) {
            let got = 100.0 * settled_yearly(*lt, z, g);
            assert!(
                (got - want).abs() < 0.06,
                "LT {lt} g {g}: {got:.2}% vs {want}%"
            );
        }
    }
    // The k column heads: Retail 0.95 up and 1.025 down, Software 1.25 and 0.875, LT 30% 2.30
    // and 0.35.
    let close = |a: f64, b: f64| assert!((a - b).abs() < 1e-12, "{a} vs {b}");
    close(cycle_k(0.03, 0.01), 0.95);
    close(cycle_k(0.03, -0.01), 1.025);
    close(cycle_k(0.09, 0.01), 1.25);
    close(cycle_k(0.09, -0.01), 0.875);
    close(cycle_k(0.30, 0.01), 2.30);
    close(cycle_k(0.30, -0.01), 0.35);
}

#[test]
fn a_lasting_phase_settles_half_75_and_88_percent() {
    // Spec 5.1: the (1 − φ) factor settles a lasting phase half way in the first quarter, 75% in
    // the second, 88% in the third.
    let (lt, z, g) = (0.05, 1.07, 0.03);
    let target = lt_q(lt) + cycle_k(lt, g) * z * g / 4.0;
    let mut q = lt_q(lt);
    let mut shares = Vec::new();
    for _ in 0..3 {
        q = quarterly_growth(lt, q, 1.0, 0.01, z, g, 0.0);
        shares.push((q - lt_q(lt)) / (target - lt_q(lt)));
    }
    for (got, want) in shares.iter().zip([0.5, 0.75, 0.875]) {
        assert!((got - want).abs() < 1e-12, "{got} vs {want}");
    }
    assert_eq!(PHI, 0.5);
    // lt_q compounds to LT, unlike LT/4: at the boom's 100% a year, 4 quarters make 100%.
    assert!(((1.0 + lt_q(1.0)).powi(4) - 2.0).abs() < 1e-12);
    // The floor: −25% a quarter.
    assert_eq!(
        quarterly_growth(-0.1, -0.6, 1.0, 0.01, 1.07, -0.06, -3.0),
        -0.25
    );
}

#[test]
fn noise_off_world_draw_and_labels() {
    // With no rolls the Q1 2020 draw is lt_q plus half the settled cycle push of g_t = the middle
    // of Expansion (1%), since prev_q_growth starts at lt_q (spec 5.1).
    let d = data();
    let w = world_at_load(&d, &mut NoNoise);
    assert_eq!(w.cycle.g_t, 0.01);
    for (_, ind) in w.industries.iter() {
        let lt = ind.lt;
        let want = lt_q(lt) + 0.5 * cycle_k(lt, 0.01) * w.cycle.z_avg * 0.01 / 4.0;
        assert!((ind.q_growth - want).abs() < 1e-15, "{}", ind.key);
        assert_eq!(ind.prev_q_growth, lt_q(lt), "at load prev_q_growth = lt_q");
        assert_eq!(ind.phase_label, PhaseLabel::Normal);
    }

    // Labels move monthly from q_growth and last month's S (4.3 step 2). Push Retail into a
    // Glut by inflating its fringe: S above 1.15 makes Glut from the next month's labels, and it
    // stays Glut until S falls under 1.10.
    let mut w = w;
    let retail = industry(&w, "retail");
    w.industries[retail].fringe_assets *= 2.0;
    let s = economy_scheduler();
    let mut draws = NoNoise;
    run_month(&s, &mut w, &mut draws, Date::ymd(2020, 2, 1));
    assert!(w.industries[retail].supply_ratio > 1.15);
    assert_eq!(
        w.industries[retail].phase_label,
        PhaseLabel::Normal,
        "S was 1.0 last month"
    );
    run_month(&s, &mut w, &mut draws, Date::ymd(2020, 3, 1));
    assert_eq!(w.industries[retail].phase_label, PhaseLabel::Glut);
    run_month(&s, &mut w, &mut draws, Date::ymd(2020, 4, 1));
    assert_eq!(w.industries[retail].phase_label, PhaseLabel::Glut);
    // A deep gap is Bust whatever S says (first match): plant a quarter growing 8 pp a year
    // under its long-term rate.
    let lt = w.industries[retail].lt;
    w.industries[retail].q_growth = lt_q(lt) - 0.02;
    run_month(&s, &mut w, &mut draws, Date::ymd(2020, 5, 1));
    assert_eq!(w.industries[retail].phase_label, PhaseLabel::Bust);
    // Back at the long-term rate, S is still above 1.15: Glut again.
    w.industries[retail].q_growth = lt_q(lt);
    run_month(&s, &mut w, &mut draws, Date::ymd(2020, 6, 1));
    assert_eq!(w.industries[retail].phase_label, PhaseLabel::Glut);
}
