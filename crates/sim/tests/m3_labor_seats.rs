//! M3.1 and M3.2 against the live engine: labor units recounted at 4.3 step 4, seats opening and
//! closing with them, the station drop order (spec 5.10, 3.7), and simple characters seated at
//! load and at step 11 (3.7.1, 7.1).
//!
//! Spec M3.2 done: "about 2,700 seats filled at load". The data gives 3,207 (design fix 200):
//! the count here is derived from company-start.csv and industries.csv independently.

mod common;

use common::data;
use common::ops::{company, company_row, industry_row, run_to, spec_labor};
use sim::Sim;
use sim::ops::stations::Stations;
use sim::people::board::{Seat, SkillKind};
use sim::people::simple::CompanySize;
use sim::people::traits::Trait;
use sim::time::{Date, JobCtx, Slot};
use sim::world::{SeatHolder, World};

/// Spec 3.7.1 table: seat skill and other-skill ranges and ages by size.
fn spec_ranges(size: CompanySize) -> ((u8, u8), (u8, u8), (u8, u8)) {
    match size {
        CompanySize::Small => ((4, 10), (2, 8), (25, 55)),
        CompanySize::Mid => ((7, 13), (3, 9), (30, 62)),
        CompanySize::Large => ((10, 16), (4, 10), (38, 68)),
    }
}

/// Spec 3.7 table: the skills each seat uses.
fn spec_seat_skills(seat: Seat) -> &'static [SkillKind] {
    use SkillKind::*;
    match seat {
        Seat::Ceo => &[Finance, Operations, Persuasion],
        Seat::Cfo => &[Finance],
        Seat::Cio => &[Intrigue],
        Seat::Cmo => &[Persuasion],
        Seat::Coo => &[Operations],
        Seat::Chair => &[Persuasion],
    }
}

/// Spec 3.7.1: small under $100M, mid to $10B, large from $10B.
fn spec_size(revenue_usd: f64) -> CompanySize {
    if revenue_usd >= 10.0e9 {
        CompanySize::Large
    } else if revenue_usd >= 100.0e6 {
        CompanySize::Mid
    } else {
        CompanySize::Small
    }
}

#[test]
fn seats_filled_at_load_follow_the_data() {
    let d = data();
    let sim = Sim::new(d.clone(), 11).unwrap();
    let w = sim.world();
    // The count from the data alone: min(5, L) seats per company, L from company-start.csv.
    let mut want_seats = 0;
    for start in &d.company_start.rows {
        let row = company_row(&d, &start.id);
        let lv = industry_row(&d, &row.industry).labor_value_usd;
        want_seats += spec_labor(start.gross_assets_usd, lv).min(5);
    }
    let mut seated = 0;
    let mut under_five = 0;
    for (_, c) in w.companies.iter() {
        let start = d.company_start.rows.iter().find(|s| s.id == c.key).unwrap();
        let lv = w.industries[c.industry].params.labor_value_usd;
        let l = spec_labor(start.gross_assets_usd, lv);
        assert_eq!(c.labor_units, l, "{}", c.key);
        let s = &c.stations;
        assert_eq!(
            s.productivity + s.enterprise + s.fifty_fifty + s.research + s.idle,
            l,
            "{}: one station per labor unit",
            c.key
        );
        under_five += u32::from(l < 5);
        let size = spec_size(c.revenue_usd);
        let (seat_range, other_range, age_range) = spec_ranges(size);
        for (i, seat) in Seat::LABOR.iter().enumerate() {
            let holder = c.board[i].as_ref();
            assert_eq!(holder.is_some(), (i as u64) < l, "{} {seat:?}", c.key);
            let Some(SeatHolder::Simple(s)) = holder else {
                assert!(holder.is_none(), "no full character sits at load");
                continue;
            };
            seated += 1;
            let ch = &s.character;
            assert_eq!((ch.seat, ch.size), (*seat, size));
            assert!((age_range.0..=age_range.1).contains(&ch.age));
            for k in SkillKind::ALL {
                let r = if spec_seat_skills(*seat).contains(&k) {
                    seat_range
                } else {
                    other_range
                };
                assert!(
                    (r.0..=r.1).contains(&ch.skills.get(k)),
                    "{} {seat:?}",
                    c.key
                );
            }
            assert!((1..=2).contains(&ch.traits.len()));
            if let [a, b] = ch.traits[..] {
                assert_ne!(a.opposite(), b, "no opposite pair");
            }
        }
    }
    println!(
        "seats filled at load: {seated} (data-derived {want_seats}; spec 3.7.1 says about 2,700, \
         design fix 200); {under_five} companies have fewer than five labor units"
    );
    assert_eq!(seated, want_seats);
    assert_eq!(seated, 3207, "design fix 200");
    assert_eq!(under_five, 16, "design fix 200");
    assert_eq!(w.simple_characters_made, 3207);
}

#[test]
fn full_characters_load_with_pair_traits_and_controllers() {
    let d = data();
    let sim = Sim::new(d.clone(), 11).unwrap();
    let w = sim.world();
    assert_eq!(w.characters.len(), 296);
    for (_, ch) in w.characters.iter() {
        let row = d.characters.rows.iter().find(|r| r.id == ch.key).unwrap();
        assert_eq!(
            (ch.age, ch.skills.finance, ch.skills.hustle),
            (row.age, row.finance, row.hustle)
        );
        // Only the 24 traits of the 12 pairs (1-corporate-core 1.1.2) survive load.
        let pair_names: Vec<&str> = row
            .traits
            .iter()
            .map(|t| t.trim())
            .filter(|t| Trait::ALL.iter().any(|x| x.name() == *t))
            .collect();
        let got: Vec<&str> = ch.traits.iter().map(|t| t.name()).collect();
        assert_eq!(got, pair_names, "{}", ch.key);
    }
    // CH-0001 John Techno holds only "Operational Excellence", a perk outside the pairs.
    let john = w
        .characters
        .iter()
        .find(|(_, c)| c.key == "CH-0001")
        .unwrap()
        .1;
    assert!(john.traits.is_empty());
    // Named controllers: companies.csv `controller` holding a CH- id.
    let named = d
        .companies
        .rows
        .iter()
        .filter(|c| c.controller.starts_with("CH-"))
        .count();
    let linked = w
        .companies
        .iter()
        .filter(|(_, c)| c.controller.is_some())
        .count();
    assert_eq!((linked, named), (253, 253));
    let a = &w.companies[company(w, "CO-0001")];
    assert_eq!(w.characters[a.controller.unwrap()].name, "Terry Tippacanoe");
}

/// The company the scenario moves: CO-0025 (Drones, $99,010 of assets, one labor unit).
const KEY: &str = "CO-0025";

/// A stand-in for the M6 plan and growth: in 4.3 step 3 (before the step 4 recount) it sets
/// CO-0025's gross assets, so L goes 1 → 6 (Feb) → 2 (Mar) → 1 (Apr), and on 1 March assigns
/// a mixed station split so the drop order shows.
fn move_assets(w: &mut World, ctx: &mut JobCtx<'_>) {
    let id = company(w, KEY);
    let unit = w.companies[id].units[0];
    let date = ctx.facts.date;
    let gross = match (date.month, date.year) {
        (2, 2020) => 600_000.0,
        (3, 2020) => {
            w.companies[id].stations = Stations {
                productivity: 2,
                enterprise: 1,
                fifty_fifty: 1,
                research: 1,
                idle: 1,
            };
            200_000.0
        }
        (4, 2020) => 99_010.0,
        _ => return,
    };
    w.units[unit].gross_assets = gross;
}

fn filled(w: &World, key: &str) -> Vec<bool> {
    w.companies[company(w, key)]
        .board
        .iter()
        .map(Option::is_some)
        .collect()
}

#[test]
fn recount_opens_and_closes_seats_and_drops_stations_in_order() {
    let d = data();
    let mut sim = Sim::new(d, 5).unwrap();
    sim.register_test_job(Slot::MonthlyFringe, "test.move_assets", move_assets);
    let w = sim.world();
    let id = company(w, KEY);
    assert_eq!(w.companies[id].labor_units, 1);
    assert_eq!(filled(w, KEY), [true, false, false, false, false]);
    let ceo_before = w.companies[id].board[0].clone();
    let made_at_load = w.simple_characters_made;

    // 1 Feb: L = 6. Step 4 opens CFO, CIO, CMO and COO, step 11 seats a simple character in
    // each (sized by the month's run rate, small); the new units are idle (D201).
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    let c = &w.companies[id];
    assert_eq!(c.labor_units, 6);
    assert_eq!(filled(w, KEY), [true; 5]);
    assert_eq!(c.board[0], ceo_before, "the CEO keeps their seat");
    assert_eq!(w.simple_characters_made, made_at_load + 4);
    for (i, seat) in Seat::LABOR.iter().enumerate().skip(1) {
        let Some(SeatHolder::Simple(s)) = &c.board[i] else {
            panic!("{seat:?} not filled")
        };
        assert_eq!(
            (s.character.seat, s.character.size),
            (*seat, CompanySize::Small)
        );
        assert!(s.id >= made_at_load);
    }
    assert!(c.seats_to_fill.is_empty());
    assert_eq!(
        c.stations,
        Stations {
            productivity: 1,
            idle: 5,
            ..Stations::default()
        }
    );

    // 1 Mar: assigned P2 E1 50/50 1 R1 idle 1, then L = 2: drop idle, research, enterprise,
    // 50/50, then productivity (5.10; D201 places 50/50); CIO, CMO and COO close.
    run_to(&mut sim, Date::ymd(2020, 3, 1));
    let w = sim.world();
    let c = &w.companies[id];
    assert_eq!(c.labor_units, 2);
    assert_eq!(
        c.stations,
        Stations {
            productivity: 2,
            ..Stations::default()
        }
    );
    assert_eq!(filled(w, KEY), [true, true, false, false, false]);

    // 1 Apr: L = 1, the CFO closes and productivity drops to the CEO's one station.
    run_to(&mut sim, Date::ymd(2020, 4, 1));
    let w = sim.world();
    let c = &w.companies[id];
    assert_eq!(c.labor_units, 1);
    assert_eq!(c.stations.productivity, 1);
    assert_eq!(c.stations.total(), 1);
    assert_eq!(filled(w, KEY), [true, false, false, false, false]);
    // Only the four seats opened in February drew characters.
    assert_eq!(w.simple_characters_made, made_at_load + 4);
}
