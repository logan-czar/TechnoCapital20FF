//! Spec 5.10 (labor units, seats, drop order) and 3.7 (seats open with labor units 1 to 5):
//! build-plan M3.1, tested at 1, 4, 5 and 400 labor units.

use sim::ops::labor::{fit_stations, labor_units, open_seats, seat_changes};
use sim::ops::stations::Stations;
use sim::people::board::Seat;

const LV: f64 = 100_000.0; // industries.csv labor_value_usd (every industry in the MVP)

#[test]
fn labor_units_are_assets_over_labor_value_minimum_one() {
    assert_eq!(labor_units(0.0, LV), 1, "minimum 1, the CEO");
    assert_eq!(labor_units(99_999.0, LV), 1);
    assert_eq!(labor_units(100_000.0, LV), 1, "the barebones company");
    assert_eq!(labor_units(400_000.0, LV), 4);
    assert_eq!(labor_units(599_999.0, LV), 5);
    assert_eq!(labor_units(40.0e6, LV), 400);
    assert_eq!(labor_units(39_215_686.0, LV), 392, "Arrowhead (7.1)");
}

#[test]
fn seats_open_with_the_count() {
    assert_eq!(open_seats(1), &[Seat::Ceo]);
    assert_eq!(open_seats(4), &[Seat::Ceo, Seat::Cfo, Seat::Cio, Seat::Cmo]);
    assert_eq!(open_seats(5), &Seat::LABOR);
    assert_eq!(
        open_seats(400),
        &Seat::LABOR,
        "no charter seats beyond 5 (C14)"
    );
}

#[test]
fn seats_open_and_close_on_recount() {
    let up = seat_changes(1, 4);
    assert_eq!(up.opened, vec![Seat::Cfo, Seat::Cio, Seat::Cmo]);
    assert!(up.closed.is_empty());
    let to_five = seat_changes(4, 5);
    assert_eq!(to_five.opened, vec![Seat::Coo]);
    let down = seat_changes(400, 4);
    assert_eq!(down.closed, vec![Seat::Coo]);
    assert!(down.opened.is_empty());
    let to_one = seat_changes(5, 1);
    assert_eq!(
        to_one.closed,
        vec![Seat::Cfo, Seat::Cio, Seat::Cmo, Seat::Coo]
    );
    assert_eq!(
        seat_changes(400, 5),
        Default::default(),
        "both at five seats"
    );
    assert_eq!(seat_changes(4, 4), Default::default());
}

#[test]
fn drop_order_is_idle_research_enterprise_then_productivity() {
    let s = Stations {
        productivity: 100,
        enterprise: 50,
        fifty_fifty: 0,
        research: 30,
        idle: 220,
    };
    assert_eq!(s.total(), 400);
    // 400 to 200: the 220 idle cover 200.
    let a = fit_stations(s, 200);
    assert_eq!(
        (a.idle, a.research, a.enterprise, a.productivity),
        (20, 30, 50, 100)
    );
    // 400 to 120: all idle and research go, then 30 enterprise.
    let b = fit_stations(s, 120);
    assert_eq!((a.total(), b.total()), (200, 120));
    assert_eq!(
        (b.idle, b.research, b.enterprise, b.productivity),
        (0, 0, 20, 100)
    );
    // 400 to 5: only productivity is left.
    let c = fit_stations(s, 5);
    assert_eq!(
        (c.idle, c.research, c.enterprise, c.productivity),
        (0, 0, 0, 5)
    );
    // 400 to 4, then 1.
    assert_eq!(fit_stations(s, 4).productivity, 4);
    assert_eq!(fit_stations(s, 1).total(), 1);
    // A 50/50 station drops after enterprise, before productivity (D201).
    let ceo = Stations {
        productivity: 1,
        fifty_fifty: 1,
        enterprise: 1,
        ..Stations::default()
    };
    let one = fit_stations(ceo, 1);
    assert_eq!(
        (one.productivity, one.fifty_fifty, one.enterprise),
        (1, 0, 0)
    );
}

#[test]
fn new_labor_waits_idle_for_the_next_plan() {
    let s = Stations {
        productivity: 1,
        enterprise: 1,
        idle: 2,
        ..Stations::default()
    };
    let grown = fit_stations(s, 400);
    assert_eq!(grown.total(), 400);
    assert_eq!(
        (grown.productivity, grown.enterprise, grown.idle),
        (1, 1, 398)
    );
}

#[test]
fn startups_near_one_million_open_all_five_seats() {
    // 5.19.3: a startup under $1M is skipped; assets = revenue × capital_per_dollar (1.0), so the
    // smallest startup has $1M of assets, 10 labor units and all five seats (5.19.4, C31; D200).
    let l = labor_units(1.0e6 * 1.0, LV);
    assert_eq!(l, 10);
    assert_eq!(open_seats(l), &Seat::LABOR);
    assert_eq!(seat_changes(0, l).opened, Seat::LABOR.to_vec());
}
