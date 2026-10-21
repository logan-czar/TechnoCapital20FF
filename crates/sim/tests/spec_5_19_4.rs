//! Spec 5.19.4 (the cast) and 3.7.2 (full characters), build-plan M6.8: the lead founder is
//! CEO, other founders take open labor seats with their seat's skill as best, partials fill the
//! rest, the leftovers are directors, and no labor seat is left empty.

mod common;

use common::data;
use sim::Sim;
use sim::births::cast::{Cast, CastSeat, seat_cast};
use sim::people::board::{CEO_SKILLS, Seat, SeatSkill};
use sim::people::full::HomeChoice;
use sim::people::names::NameBook;
use sim::people::simple::CompanySize;
use sim::rng::RngStreams;
use sim::world::ProvinceId;

fn usa_book() -> NameBook {
    let sim = Sim::new(data(), 1).unwrap();
    let w = sim.world();
    let usa = w
        .countries
        .iter()
        .find(|(_, c)| c.key == "USA")
        .map(|(id, _)| id)
        .unwrap();
    w.name_books.get(usa).unwrap().clone()
}

fn cast(seed: u64, labor: u64, full: u8, partial: u8, taken: &dyn Fn(&str) -> bool) -> Cast {
    let book = usa_book();
    let others = [(ProvinceId(2), 1.0), (ProvinceId(3), 3.0)];
    let home = HomeChoice {
        hq: ProvinceId(1),
        others: &others,
    };
    seat_cast(
        &mut RngStreams::new(seed),
        &book,
        taken,
        labor,
        full,
        partial,
        home,
    )
}

fn best_matches_seat(c: &Cast) {
    for (i, holder) in c.seats.iter().enumerate() {
        if let Some(CastSeat::Founder(n)) = holder {
            let f = &c.founders[*n];
            match Seat::LABOR[i].skills() {
                SeatSkill::One(k) => assert_eq!(f.best, k),
                SeatSkill::Average(_) => assert!(CEO_SKILLS.contains(&f.best)),
            }
        }
    }
}

#[test]
fn garage_founder_cast() {
    // 1 full, 2 partial on 50 labor units: the founder is CEO, partials take the CFO and CIO
    // seats in seat order, and the CMO and COO are filled by 3.7.1.
    let c = cast(1, 50, 1, 2, &|_| false);
    assert_eq!(c.founders.len(), 1);
    assert_eq!(c.seats[0], Some(CastSeat::Founder(0)));
    assert!(matches!(c.seats[1], Some(CastSeat::Partial(_))));
    assert!(matches!(c.seats[2], Some(CastSeat::Partial(_))));
    assert!(matches!(c.seats[3], Some(CastSeat::Filler(_))));
    assert!(matches!(c.seats[4], Some(CastSeat::Filler(_))));
    assert!(c.directors.is_empty());
    assert!(c.labor_seats_full(50));
    best_matches_seat(&c);
    // Partials and fillers are small-company simple characters for their seat (5.19.4 step 3).
    for (i, s) in c.seats.iter().enumerate().skip(1) {
        let (Some(CastSeat::Partial(p)) | Some(CastSeat::Filler(p))) = s else {
            panic!()
        };
        assert_eq!(p.seat, Seat::LABOR[i]);
        assert_eq!(p.size, CompanySize::Small);
    }
    // 3.7.2: the lead founder is 22 to 55.
    assert!((22..=55).contains(&c.founders[0].age));
}

#[test]
fn backed_venture_fills_every_seat_with_founders_and_directors() {
    // 5 full and 5 partial: the lead is CEO, the other four take the four other seats (each
    // cast for its seat, D204), so every partial sits as a director.
    let c = cast(2, 100, 5, 5, &|_| false);
    assert_eq!(c.founders.len(), 5);
    let mut founders: Vec<usize> = c
        .seats
        .iter()
        .map(|s| match s {
            Some(CastSeat::Founder(n)) => *n,
            other => panic!("{other:?}"),
        })
        .collect();
    founders.sort_unstable();
    assert_eq!(founders, vec![0, 1, 2, 3, 4]);
    assert_eq!(c.seats[0], Some(CastSeat::Founder(0)));
    assert_eq!(c.directors.len(), 5);
    assert!(
        c.directors
            .iter()
            .all(|d| matches!(d, CastSeat::Partial(p) if p.seat == Seat::Chair))
    );
    best_matches_seat(&c);
    // Names are unique within the cast.
    let mut names: Vec<&str> = c.founders.iter().map(|f| f.name.as_str()).collect();
    names.sort_unstable();
    names.dedup();
    assert_eq!(names.len(), 5);
}

#[test]
fn few_labor_units_open_few_seats() {
    // D200: with L = 2 only the CEO and CFO open; a third founder sits as a director with any
    // best skill (5.19.4 step 4).
    let c = cast(3, 2, 3, 1, &|_| false);
    assert_eq!(c.seats[0], Some(CastSeat::Founder(0)));
    assert_eq!(c.seats[1], Some(CastSeat::Founder(1)));
    assert!(c.seats[2..].iter().all(Option::is_none));
    assert_eq!(c.directors.len(), 2);
    assert_eq!(c.directors[0], CastSeat::Founder(2));
    assert!(matches!(c.directors[1], CastSeat::Partial(_)));
    assert!(c.labor_seats_full(2));
}

#[test]
fn names_avoid_taken_and_same_seed_same_cast() {
    let a = cast(9, 50, 3, 3, &|_| false);
    let b = cast(9, 50, 3, 3, &|_| false);
    assert_eq!(a, b);
    // A taken name is never reused for a founder.
    let first = a.founders[0].name.clone();
    let c = cast(9, 50, 3, 3, &|n| n == first);
    assert!(c.founders.iter().all(|f| f.name != first));
    // Home province: the HQ or another province of the HQ country (3.7.2).
    for f in &a.founders {
        assert!([1, 2, 3].contains(&f.home_province.0));
        assert!((100_000.0..=1_000_000.0).contains(&f.cash_usd));
    }
}
