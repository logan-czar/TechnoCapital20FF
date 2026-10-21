//! Spec 5.9 data: create, convert, decay, 12-month retention and free R&D with a 1-month grace
//! (build-plan M3.6). Held data settles where `C = rate × held`.

use sim::ops::data::{
    CONVERT_TB_PER_STATION, DataBook, DataParams, conversion_capacity, decay_rate, free_rd_step,
    steady_state_held,
};
use sim::ops::stations::Stations;

const DEFAULT: DataParams = DataParams {
    tb_per_musd: 1.0,
    decay_base: 0.02,
};

#[test]
fn free_rd_steps() {
    // Under 1 TB 0%; 1 TB 1%; 10 TB 2%; 100 TB 3%; 1 PB 4%; 10 PB 5%; +1% per further 10×.
    let table = [
        (0.0, 0),
        (0.99, 0),
        (1.0, 1),
        (8.6, 1),
        (9.999, 1),
        (10.0, 2),
        (20.0, 2),
        (100.0, 3),
        (1_000.0, 4),
        (10_000.0, 5),
        (100_000.0, 6),
    ];
    for (held, pct) in table {
        assert_eq!(free_rd_step(held), pct, "{held} TB");
    }
}

#[test]
fn decay_rate_grows_with_log_held() {
    assert_eq!(decay_rate(0.5, 0.02), 0.02);
    assert_eq!(decay_rate(1.0, 0.02), 0.02);
    assert!((decay_rate(10.0, 0.02) - 0.04).abs() < 1e-15);
    assert!(
        (decay_rate(100.0, 0.01) - 0.03).abs() < 1e-15,
        "finance and health base 1%"
    );
}

#[test]
fn conversion_capacity_counts_half_of_fifty_fifty() {
    let s = Stations {
        enterprise: 2,
        fifty_fifty: 1,
        ..Stations::default()
    };
    assert!((conversion_capacity(&s) - 2.5 * CONVERT_TB_PER_STATION).abs() < 1e-15);
}

#[test]
fn create_convert_oldest_first_then_decay() {
    let mut d = DataBook {
        unstructured: vec![0.5, 2.0],
        held: 0.0,
        free_rd_pct: 0,
        grace: false,
    };
    // $3M of revenue makes 3 TB; capacity 1 TB converts the oldest 0.5 then 0.5 of the next.
    let m = d.month(3.0e6, DEFAULT, 1.0);
    assert_eq!(m.created_tb, 3.0);
    assert_eq!(m.converted_tb, 1.0);
    assert_eq!(d.unstructured, vec![0.0, 1.5, 3.0]);
    // Held 1.0 decays at base × (1 + log10 1) = 2%.
    assert!((d.held - 0.98).abs() < 1e-15);
    assert!((m.decayed_tb - 0.02).abs() < 1e-15);
}

#[test]
fn unstructured_data_is_kept_twelve_months() {
    let mut d = DataBook::default();
    for _ in 0..12 {
        let m = d.month(1.0e6, DEFAULT, 0.0);
        assert_eq!(m.dropped_tb, 0.0);
    }
    assert_eq!(d.unstructured.len(), 12);
    // The 13th month drops the bucket made 12 months ago, after it had this month's chance to
    // convert (D210).
    let m = d.month(1.0e6, DEFAULT, 0.0);
    assert_eq!(m.dropped_tb, 1.0);
    assert_eq!(d.unstructured.len(), 12);
    assert_eq!(d.unstructured_tb(), 12.0);
    let mut e = d.clone();
    let m = e.month(1.0e6, DEFAULT, 0.4);
    assert!((m.converted_tb - 0.4).abs() < 1e-15);
    assert!(
        (m.dropped_tb - 0.6).abs() < 1e-15,
        "the oldest converted 0.4 before it went"
    );
}

#[test]
fn free_rd_drop_waits_one_month() {
    let mut d = DataBook {
        unstructured: Vec::new(),
        held: 12.0,
        free_rd_pct: 2,
        grace: false,
    };
    // Held 12 TB with no conversion decays about 4% a month: 11.5, 11.1, ... under 10 by month 5.
    let mut pcts = Vec::new();
    let mut helds = Vec::new();
    for _ in 0..8 {
        helds.push(d.held);
        pcts.push(d.month(0.0, DEFAULT, 0.0).free_rd_pct);
    }
    let first_below = helds.iter().position(|&h| h < 10.0).unwrap();
    for (i, &p) in pcts.iter().enumerate() {
        let want = if i <= first_below { 2 } else { 1 };
        assert_eq!(p, want, "month {i}: held at start {}", helds[i]);
    }
    // A rise applies at once and clears the grace.
    let mut up = DataBook {
        held: 10.5,
        free_rd_pct: 1,
        grace: true,
        ..DataBook::default()
    };
    assert_eq!(up.month(0.0, DEFAULT, 0.0).free_rd_pct, 2);
    assert!(!up.grace);
    // A dip that recovers inside the grace month never drops.
    let mut dip = DataBook {
        held: 9.9,
        free_rd_pct: 2,
        ..DataBook::default()
    };
    assert_eq!(dip.month(0.0, DEFAULT, 1.0).free_rd_pct, 2, "grace month");
    dip.held = 10.2;
    assert_eq!(dip.month(0.0, DEFAULT, 0.0).free_rd_pct, 2);
    assert!(!dip.grace);
}

#[test]
fn steady_state_solves_c_equals_rate_times_held() {
    for (c, base) in [(1.0 / 3.0, 0.02), (0.9125, 0.02), (5.0, 0.01), (0.01, 0.02)] {
        let h = steady_state_held(c, base);
        assert!(
            (decay_rate(h, base) * h - c).abs() < 1e-9,
            "C {c}: held {h}"
        );
    }
    assert_eq!(steady_state_held(0.0, 0.02), 0.0);
    // Arrowhead (7.1): converting 0.1 × 40 ÷ 12 TB a month holds about 8.6 TB (1% free R&D);
    // its station at capacity (0.9125 TB) holds about 20 TB (2%).
    let a = steady_state_held(0.1 * 40.0 / 12.0, 0.02);
    assert!((a - 8.6).abs() < 0.05, "{a}");
    assert_eq!(free_rd_step(a), 1);
    let full = steady_state_held(CONVERT_TB_PER_STATION, 0.02);
    assert!((full - 20.0).abs() < 0.5, "{full}");
    assert_eq!(free_rd_step(full), 2);
}

#[test]
fn held_data_settles_where_c_equals_rate_times_held() {
    // Arrowhead's one station converting at capacity, from its 8.6 TB start: revenue $40M a
    // year is 3.33 TB a month, more than the 0.9125 TB capacity, so C = 0.9125.
    let c = CONVERT_TB_PER_STATION;
    let mut d = DataBook::at_load(40.0e6, DEFAULT, c, 0.1);
    assert!((d.held - 8.6).abs() < 0.05);
    let mut last_peak = 0.0;
    for _ in 0..600 {
        let start = d.held;
        let m = d.month(40.0e6 / 12.0, DEFAULT, c);
        assert!((m.converted_tb - c).abs() < 1e-12);
        last_peak = start + m.converted_tb;
    }
    // The held level after conversion (before decay) solves C = rate × held (D210)...
    assert!(
        (decay_rate(last_peak, 0.02) * last_peak - c).abs() < 1e-9,
        "peak {last_peak}"
    );
    assert!((last_peak - steady_state_held(c, 0.02)).abs() < 1e-6);
    // ...so the month's decay equals the month's conversion and held stops moving.
    let before = d.held;
    let m = d.month(40.0e6 / 12.0, DEFAULT, c);
    assert!((m.decayed_tb - m.converted_tb).abs() < 1e-9);
    assert!((d.held - before).abs() < 1e-9);
    assert_eq!(m.free_rd_pct, 2, "about 20 TB");
    // From far above it comes down to the same level.
    let mut high = DataBook {
        held: 500.0,
        ..DataBook::default()
    };
    for _ in 0..600 {
        high.month(40.0e6 / 12.0, DEFAULT, c);
    }
    assert!((high.held - d.held).abs() < 1e-6);
}

#[test]
fn arrowhead_starting_data() {
    // 7.1: one month of unstructured data in the newest bucket; held at the steady state for
    // min(capacity, 0.1 × inflow); free R&D 1%.
    let d = DataBook::at_load(40.0e6, DEFAULT, CONVERT_TB_PER_STATION, 0.1);
    assert_eq!(d.unstructured.len(), 1);
    assert!((d.unstructured[0] - 40.0 / 12.0).abs() < 1e-12);
    assert!((d.held - 8.6).abs() < 0.05);
    assert_eq!(d.free_rd_pct, 1);
    assert_eq!(d.free_rd_fraction(), 0.01);
}
