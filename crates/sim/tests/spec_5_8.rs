//! Spec 5.8 productive compute and PC bonus, 6.4 station split and the 7.1 starting loadout
//! (build-plan M3.4): the bonus steps match the 5.8 table.

use sim::ops::stations::{
    LoadoutInputs, SplitInputs, Stations, loadout_productivity_stations, pc_bonus,
    productive_compute, starting_loadout, station_split,
};

#[test]
fn bonus_steps_match_the_table() {
    // 5.8: under 1: 0; 1 to 9.99: +1; 10 to 99.99: +2; 100 to 999.99: +3; 1,000 to 9,999.99: +4;
    // 10,000+: +5, +1 per further 10×.
    let table: [(f64, u32); 17] = [
        (0.0, 0),
        (0.5, 0),
        (0.999, 0),
        (1.0, 1),
        (9.99, 1),
        (10.0, 2),
        (99.99, 2),
        (100.0, 3),
        (999.99, 3),
        (1_000.0, 4),
        (9_999.99, 4),
        (10_000.0, 5),
        (99_999.0, 5),
        (100_000.0, 6),
        (1.0e6, 7),
        (1.0e9, 10),
        (-3.0, 0),
    ];
    for (pc, bonus) in table {
        assert_eq!(pc_bonus(pc), bonus, "PC {pc}");
    }
    // Every power of ten lands on its step, and just under it on the one before.
    let mut p = 1.0;
    for k in 1..=15 {
        assert_eq!(pc_bonus(p), k, "10^{}", k - 1);
        if k > 1 {
            assert_eq!(pc_bonus(p * (1.0 - 1e-12)), k - 1);
        }
        p *= 10.0;
    }
}

#[test]
fn pc_counts_half_of_each_fifty_fifty_station() {
    let s = Stations {
        productivity: 98,
        enterprise: 1,
        fifty_fifty: 4,
        research: 0,
        idle: 293,
    };
    assert_eq!(productive_compute(&s, 1.0), 100.0);
    assert_eq!(pc_bonus(productive_compute(&s, 1.0)), 3);
    assert_eq!(
        productive_compute(&s, 0.5),
        50.0,
        "the main industry's modifier"
    );
    let ceo = Stations {
        fifty_fifty: 1,
        ..Stations::default()
    };
    assert_eq!(
        pc_bonus(productive_compute(&ceo, 1.0)),
        0,
        "PC 0.5 is under 1"
    );
}

fn split(labor: u64, coverage: f64, inflow_tb: f64, visionary: bool) -> Stations {
    station_split(SplitInputs {
        labor,
        coverage,
        inflow_tb,
        visionary,
    })
}

#[test]
fn station_split_follows_6_4() {
    // Arrowhead at its first plan lock: L 392, Cash cow coverage 25%, inflow 40/12 TB.
    let a = split(392, 0.25, 40.0 / 12.0, false);
    assert_eq!(a.productivity, 100, "largest 10^k at most 156.8");
    assert_eq!(a.enterprise, 1, "ceil(0.25 × 3.33 ÷ 0.9125) = 1");
    assert_eq!((a.research, a.idle, a.total()), (0, 291, 392));
    // P: the largest power of ten at most 40% of L, minimum 1.
    assert_eq!(split(2, 0.5, 0.0, false).productivity, 1);
    assert_eq!(split(24, 0.5, 0.0, false).productivity, 1, "9.6");
    assert_eq!(split(25, 0.5, 0.0, false).productivity, 10, "10.0");
    assert_eq!(split(249, 0.5, 0.0, false).productivity, 10);
    assert_eq!(split(250, 0.5, 0.0, false).productivity, 100);
    // Visionary: 10% of what is left after P and E, rounded down (D207).
    let v = split(1000, 0.5, 9.125, true);
    assert_eq!(
        (v.productivity, v.enterprise, v.research, v.idle),
        (100, 5, 89, 806)
    );
    // Keep 10% idle when L ≥ 10: E is cut first, then R.
    let tight = split(100, 1.0, 1000.0, true);
    assert_eq!(tight.productivity, 10);
    assert_eq!((tight.enterprise, tight.research, tight.idle), (80, 0, 10));
    // Under L 10 no idle floor.
    let small = split(5, 1.0, 1000.0, false);
    assert_eq!(
        (small.productivity, small.enterprise, small.idle),
        (1, 4, 0)
    );
}

#[test]
fn ceo_splits_fifty_fifty_only_at_one_labor_unit_and_full_coverage() {
    let full = split(1, 1.0, 0.1, false);
    assert_eq!(
        (full.productivity, full.fifty_fifty, full.total()),
        (0, 1, 1)
    );
    let half = split(1, 0.5, 0.1, false);
    assert_eq!((half.productivity, half.fifty_fifty), (1, 0));
    let two = split(2, 1.0, 0.1, false);
    assert_eq!(
        (two.productivity, two.fifty_fifty, two.enterprise),
        (1, 0, 1)
    );
}

fn loadout_inputs(revenue_m: f64, share: f64) -> LoadoutInputs {
    LoadoutInputs {
        revenue_usd: revenue_m * 1.0e6,
        capital_per_dollar: 1.0,
        labor_value_usd: 100_000.0,
        pc_modifier: 1.0,
        data_tb_per_musd: 1.0,
        location_bonus: 0.0,
        enterprise_share: share,
    }
}

#[test]
fn arrowhead_loadout() {
    // 7.1: first pass +3 (400 labor units, 100 stations), second +2; gross 40 × 100 ÷ 102;
    // 392 labor units, 98 productivity stations, 1 enterprise, about 293 idle.
    let l = starting_loadout(loadout_inputs(40.0, 0.1));
    assert_eq!(l.first_pass_bonus, 3);
    assert_eq!((l.assets_bonus, l.pc_bonus), (2, 2));
    assert!((l.gross_assets_usd - 40.0e6 / 1.02).abs() < 1e-6);
    assert_eq!(l.labor, 392);
    assert_eq!(l.stations.productivity, 98);
    assert_eq!(l.stations.enterprise, 1);
    assert_eq!(l.stations.idle, 293);
    assert_eq!(l.pc, 98.0);
}

#[test]
fn barebones_and_small_loadouts() {
    let b = starting_loadout(loadout_inputs(0.05, 0.5));
    assert!(b.barebones);
    assert_eq!((b.gross_assets_usd, b.labor), (100_000.0, 1));
    assert_eq!(b.stations.productivity, 1);
    assert_eq!(b.stations.total(), 1);
    // The fixed $100,000 asset is not sized from a bonus; its live PC 1 gives +1 (5.8).
    assert_eq!((b.first_pass_bonus, b.assets_bonus, b.pc_bonus), (0, 0, 1));
    // $0.25M: 2 labor units, 1 productivity station; the C16 enterprise station fits.
    let s = starting_loadout(loadout_inputs(0.25, 0.5));
    assert_eq!(
        (s.labor, s.stations.productivity, s.stations.enterprise),
        (2, 1, 1)
    );
    // $0.12M: 1 labor unit, so the enterprise station is capped away (D208).
    let one = starting_loadout(loadout_inputs(0.12, 0.5));
    assert_eq!(
        (
            one.labor,
            one.stations.productivity,
            one.stations.enterprise
        ),
        (1, 1, 0)
    );
}

#[test]
fn productivity_stations_round_halves_to_even_like_gen_py() {
    assert_eq!(loadout_productivity_stations(1), 1);
    assert_eq!(
        loadout_productivity_stations(2),
        1,
        "round(0.5) = 0, minimum 1"
    );
    assert_eq!(loadout_productivity_stations(6), 2, "1.5 to 2");
    assert_eq!(loadout_productivity_stations(10), 2, "2.5 to 2");
    assert_eq!(loadout_productivity_stations(14), 4, "3.5 to 4");
    assert_eq!(loadout_productivity_stations(392), 98);
}

#[test]
fn loadout_gross_assets_match_company_start_csv() {
    // Build-plan 4.2 starting state: gen.py writes round(gross) to company-start.csv.
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
    let mut unsettled = Vec::new();
    for (co, start) in data.companies.rows.iter().zip(&data.company_start.rows) {
        assert_eq!(co.id, start.id);
        let ind = data
            .industries
            .rows
            .iter()
            .find(|i| i.name == co.industry)
            .unwrap();
        let l = starting_loadout(LoadoutInputs {
            revenue_usd: co.revenue_usd_m * 1.0e6,
            capital_per_dollar: ind.capital_per_dollar,
            labor_value_usd: ind.labor_value_usd,
            pc_modifier: ind.pc_modifier,
            data_tb_per_musd: ind.data_tb_per_musd,
            location_bonus: 0.0,
            enterprise_share: if co.id == "CO-0001" { 0.1 } else { 0.5 },
        });
        assert!(
            (l.gross_assets_usd - start.gross_assets_usd).abs() <= 0.5 + 1e-6,
            "{}: {} vs {}",
            co.id,
            l.gross_assets_usd,
            start.gross_assets_usd
        );
        assert_eq!(l.stations.total(), l.labor);
        if !l.barebones && l.pc_bonus != l.assets_bonus {
            unsettled.push((co.id.as_str(), l.assets_bonus, l.pc_bonus));
        }
    }
    // Two passes do not settle for three companies near $42B: pass 1 gives +6 (105,198
    // stations), pass 2 +5 (99,243), but gross set at +5 buys 100,188 stations, which is +6, so
    // at the live bonus they make 106 ÷ 105 of R (+0.95%). More passes alternate +5, +6, ...
    // (design fix 201): the second-pass bonus (`assets_bonus`) holds until the first monthly
    // recount, and M2.6 checks load revenue against it.
    assert_eq!(
        unsettled,
        vec![("CO-0154", 5, 6), ("CO-0540", 5, 6), ("CO-0651", 5, 6)]
    );
}
