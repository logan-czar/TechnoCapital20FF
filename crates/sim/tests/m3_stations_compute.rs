//! M3.4 and M3.5 against the live engine: the 7.1 stations and the PC bonus (spec 5.8; 4.3 step
//! 5) and the 3.8 compute and licence costs feeding the shared costs at load and monthly (5.5,
//! D108). Expected values are worked from the spec, written out here.
//!
//! Spec M3.4 done: bonus steps match the 5.8 table. Spec M3.5 done: costs match 3.8 for
//! Arrowhead (79 extra base compute, 10 data compute, 1 licence: $4,080 a month).

mod common;

use common::data;
use common::ops::{company, run_to, spec_compute_usd, spec_labor, spec_pc_bonus};
use sim::Sim;
use sim::time::{Date, DateTime};
use sim::world::World;

/// The 7.1 two-pass bonus written from the spec, for a non-barebones company: pass 1 at
/// `R × capital_per_dollar`, pass 2 at the gross pass 1's bonus implies, each by the station rule
/// `max(1, round(0.25 × L))` productivity stations (halves to even, as gen.py's Python round).
fn spec_load_bonus(r: f64, cap: f64, lv: f64, pcm: f64) -> u32 {
    let rule = |gross: f64| {
        let l = spec_labor(gross, lv) as f64;
        spec_pc_bonus((0.25 * l).round_ties_even().max(1.0) * pcm)
    };
    let first = rule(r * cap);
    rule(r * cap * 100.0 / (100.0 + f64::from(first)))
}

fn stored_tb(w: &World, key: &str) -> f64 {
    let c = &w.companies[company(w, key)];
    c.data
        .iter()
        .map(|d| d.book.held + d.book.unstructured.iter().sum::<f64>())
        .sum()
}

#[test]
fn stations_and_bonus_at_load_and_after_the_first_recount() {
    let d = data();
    let mut sim = Sim::new(d, 3).unwrap();
    let w = sim.world().clone();
    for (_, c) in w.companies.iter() {
        let p = &w.industries[c.industry].params;
        let gross = w.units[c.units[0]].gross_assets;
        let l = spec_labor(gross, p.labor_value_usd);
        let s = &c.stations;
        if c.revenue_usd < 0.1e6 {
            // Barebones (7.1, 10.0.11.1): one labor unit, the CEO on productivity, bonus +1.
            assert_eq!((l, s.productivity, s.total()), (1, 1, 1), "{}", c.key);
            assert_eq!(c.pc_bonus, 1.0);
            continue;
        }
        // 7.1: productivity max(1, round(0.25 × L)); enterprise ceil(share × R($M) ×
        // data_tb_per_musd ÷ 10.95), share 0.5 (Arrowhead 0.1), within the labor left (D208).
        let pstations = ((0.25 * l as f64).round_ties_even() as u64).max(1).min(l);
        let share = if c.key == "CO-0001" { 0.1 } else { 0.5 };
        let e = ((share * c.revenue_usd / 1e6 * p.data_tb_per_musd / 10.95).ceil() as u64)
            .min(l - pstations);
        assert_eq!(
            (
                s.productivity,
                s.enterprise,
                s.fifty_fifty,
                s.research,
                s.idle
            ),
            (pstations, e, 0, 0, l - pstations - e),
            "{}",
            c.key
        );
        assert_eq!(c.pc, pstations as f64 * p.pc_modifier);
        let want = spec_load_bonus(
            c.revenue_usd,
            p.capital_per_dollar,
            p.labor_value_usd,
            p.pc_modifier,
        );
        assert_eq!(c.pc_bonus, f64::from(want), "{}", c.key);
    }

    // 1 Feb, 4.3 step 5: the live bonus is the 5.8 table on the stations' PC.
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w2 = sim.world();
    for (_, c) in w2.companies.iter() {
        let pcm = w2.industries[c.industry].params.pc_modifier;
        let s = &c.stations;
        let pc = (s.productivity as f64 + 0.5 * s.fifty_fifty as f64) * pcm;
        assert_eq!(c.pc, pc);
        assert_eq!(c.pc_bonus, f64::from(spec_pc_bonus(pc)), "{}", c.key);
    }
    // Design fix 201: the load's two-pass bonus differs from the 5.8 table on its own stations
    // only for the three ~$42B companies, +5 (the second pass) against +6, so the first recount
    // would move only them on the loadout. (Since M6 the 9 January lock's 6.4 split moves most
    // companies' productivity stations before that recount, D207.)
    let moved: Vec<_> = w
        .companies
        .iter()
        .filter(|(_, c)| c.pc_bonus != f64::from(spec_pc_bonus(c.pc)))
        .map(|(_, c)| (c.key.as_str(), c.pc_bonus, f64::from(spec_pc_bonus(c.pc))))
        .collect();
    assert_eq!(
        moved,
        [
            ("CO-0154", 5.0, 6.0),
            ("CO-0540", 5.0, 6.0),
            ("CO-0651", 5.0, 6.0)
        ]
    );
    // Arrowhead: the lock's split put 100 stations on productivity (6.4), so PC 100 and +3.
    let a = &w2.companies[company(w2, "CO-0001")];
    assert_eq!((a.labor_units, a.pc, a.pc_bonus), (392, 100.0, 3.0));
}

#[test]
fn compute_bill_and_shared_costs_follow_3_8() {
    let mut sim = Sim::new(data(), 3).unwrap();
    for date in [
        None,
        Some(Date::ymd(2020, 2, 1)),
        Some(Date::ymd(2020, 7, 1)),
    ] {
        if let Some(d) = date {
            // The bill is set at step 5 from the TB stored before the month's data step: the
            // state one tick before the month's job.
            run_to(&mut sim, d.add_days(-1));
            while sim.now().next() < DateTime::midnight(d) {
                sim.step();
            }
            let before = sim.world().clone();
            sim.step();
            let w = sim.world();
            for (id, c) in w.companies.iter() {
                // A frozen company (Bankrupt or Removed, M4) runs no monthly step (D123).
                if c.finance.status().is_frozen() {
                    continue;
                }
                let s = &c.stations;
                let stored: f64 = before.companies[id]
                    .data
                    .iter()
                    .map(|d| d.book.held + d.book.unstructured.iter().sum::<f64>())
                    .sum();
                let want = spec_compute_usd(s.total(), stored, s.enterprise + s.fifty_fifty);
                assert_eq!(c.compute.monthly_usd, want, "{} on {d}", c.key);
                // One unit per company: it carries the whole bill (5.5).
                assert_eq!(w.units[c.units[0]].shared_m, want);
            }
            continue;
        }
        // At load: the starting bill on the starting data (7.1 "Compute").
        let w = sim.world();
        for (_, c) in w.companies.iter() {
            let s = &c.stations;
            let want = spec_compute_usd(
                s.total(),
                stored_tb(w, &c.key),
                s.enterprise + s.fifty_fifty,
            );
            assert_eq!(c.compute.monthly_usd, want, "{}", c.key);
            let u = &w.units[c.units[0]];
            assert_eq!(u.shared_m, want);
            // D108: both hooks are filled, so fixed cash, depreciation and shared costs still
            // sum to f × revenue at productivity 100 and M 1.0 (spec 5.5, 7.1).
            let p = &w.industries[u.industry].params;
            let f_share = p.fixed_cost_share * p.asset_turnover * u.gross_assets / 12.0;
            assert!(
                (u.fixed_m + u.dep_m + u.shared_m - f_share).abs() < 1e-6 * f_share,
                "{}",
                c.key
            );
        }
        // Arrowhead (3.8, M3.5 done): ceil(392 ÷ 5) = 79 extra base, data compute 10 (8.6 TB
        // held + 3.3 TB unstructured), 1 licence: 79 × $50 + 10 × $10 + 1 × $30.
        let a = &w.companies[company(w, "CO-0001")];
        assert_eq!(
            (
                a.compute.extra_base_compute,
                a.compute.data_compute,
                a.compute.licences
            ),
            (79, 10, 1)
        );
        assert_eq!(a.compute.monthly_usd, 4_080.0);
        // The barebones company (5.5, design fix 207): 9 × $50 + 10 × $10 = $550 a month.
        let b = &w.companies[company(w, "CO-0003")];
        assert_eq!(b.compute.monthly_usd, 550.0);
    }
}
