//! The M3 views, read through the `Sim` API only (spec 9.2 `get_company`, `get_company_board`,
//! `get_company_units`, `get_company_tech`; 9.4 cadences), and the generated view copy the Bevy
//! bridge uses.

mod common;

use common::data;
use common::ops::run_to;
use sim::Sim;
use sim::ops::stations::Stations;
use sim::people::board::Seat;
use sim::time::Date;
use sim::world::{CompanyId, Ordinal};

#[test]
fn company_units_and_tech_views_show_arrowhead() {
    let sim = Sim::new(data(), 2).unwrap();
    let v = sim.views();
    let arrowhead = CompanyId::from_index(0);

    let units = v.units.get();
    assert_eq!(units.units.len(), 651);
    let rows: Vec<_> = units.of_company(arrowhead).collect();
    assert_eq!(rows.len(), 1);
    let u = rows[0];
    assert!((12.0 * u.revenue_m - 40.0e6).abs() < 0.01e6);
    assert_eq!((u.productivity, u.p_pre), (100.0, 102.0));
    assert_eq!(u.shared_m, 4_080.0);
    assert!(
        (u.ebit_m - (u.revenue_m - u.variable_m - u.fixed_m - u.rd_m - u.dep_m - u.shared_m)).abs()
            < 1e-9
    );

    let t = v.tech.get().get(arrowhead).unwrap();
    assert_eq!(t.labor_units, 392);
    assert_eq!(
        t.stations,
        Stations {
            productivity: 98,
            enterprise: 1,
            idle: 293,
            ..Stations::default()
        }
    );
    // PC 98 gives +2; the next step (+3) starts at PC 100 (5.8 table).
    assert_eq!((t.pc, t.pc_bonus, t.next_bonus_pc), (98.0, 2.0, 100.0));
    assert_eq!(t.compute.monthly_usd, 4_080.0);
    let d = &t.data[0];
    assert!((d.held_tb - 8.6).abs() < 0.05);
    // 1% free R&D from 1 TB; the next step (2%) at 10 TB (5.9).
    assert_eq!((d.free_rd_pct, d.next_step_tb, d.buckets), (1, 10.0, 1));
    assert!((d.inflow_tb - 40.0 / 12.0).abs() < 1e-3);
    assert_eq!(d.conversion_tb, 0.9125);
    assert!((t.stored_tb() - (d.held_tb + 40.0 / 12.0)).abs() < 1e-9);

    let c = v.company_detail.get().get(arrowhead).unwrap();
    assert_eq!(
        (c.key.as_str(), c.name.as_str()),
        ("CO-0001", "Arrowhead Drilling")
    );
    assert_eq!(c.controller_name.as_deref(), Some("Terry Tippacanoe"));
    assert_eq!(c.board.len(), 6);
    let mut weighted = 0.0;
    for card in &c.board {
        let weight = match card.seat {
            Seat::Ceo => 0.3,
            Seat::Coo | Seat::Cfo => 0.2,
            Seat::Cio | Seat::Cmo | Seat::Chair => 0.1,
        };
        weighted += weight * card.skill_used;
        if card.seat == Seat::Chair {
            assert!(!card.open && card.holder.is_none() && card.skill_used == 3.0);
        } else {
            let p = card.holder.as_ref().unwrap();
            assert!(card.open && p.partial && p.character.is_none());
        }
    }
    // Spec 5.7: Σ weight × skill ÷ 20 × 100; confidence factor 0.8 + score ÷ 250.
    assert!((c.management_score - weighted / 20.0 * 100.0).abs() < 1e-9);
    assert!((c.confidence_factor - (0.8 + c.management_score / 250.0)).abs() < 1e-12);
}

#[test]
fn m3_views_rebuild_monthly_and_copy_by_version() {
    let mut sim = Sim::new(data(), 2).unwrap();
    let stale = sim.views().clone();
    // Before the 9 January lock, which also rebuilds the company views (births, D159).
    run_to(&mut sim, Date::ymd(2020, 1, 8));
    let v = sim.views();
    assert_eq!(
        v.tech.version(),
        stale.tech.version(),
        "monthly: no rebuild mid-month"
    );
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let v = sim.views();
    for version in [
        v.tech.version(),
        v.units.version(),
        v.company_detail.version(),
    ] {
        assert!(version > stale.tech.version());
    }
    // The productivity step ran: Arrowhead's unit moved off 100.
    let u = v.units.get().units[0].productivity;
    assert_ne!(u, 100.0);
    // The generated copy brings a stale copy up to the sim's views (data and versions; the
    // dirty flags of views it did not need to copy stay the copy's own).
    let mut copy = stale;
    assert!(!copy.same_data(v));
    copy.copy_changed_from(v);
    assert!(copy.same_data(v));
    assert_eq!(copy.refresh(), v.refresh());
    for (a, b) in [
        (copy.tech.version(), v.tech.version()),
        (copy.units.version(), v.units.version()),
        (copy.company_detail.version(), v.company_detail.version()),
        (copy.industry_rows.version(), v.industry_rows.version()),
        (copy.map_static.version(), v.map_static.version()),
    ] {
        assert_eq!(a, b);
    }
}
