//! Spec 3.7.1 simple characters and their names (build-plan M3.2): skill and age ranges hold
//! over many draws, traits come from the seat's list with no opposite pair, the draw is
//! deterministic for a fixed seed, and every starting seat can be filled.
//!
//! The ranges and trait lists below are copied from the spec text, not read from the code, so
//! the test checks the code against the spec.

use sim::ops::labor::{labor_units, open_seats};
use sim::people::board::{Seat, SkillKind};
use sim::people::names::{NameBook, NameBooks};
use sim::people::simple::{CompanySize, generate_simple};
use sim::people::traits::{Trait, no_opposite_pair, with_trait_effects};
use sim::rng::{NoNoise, RngStreams};
use sim::world::World;

fn data() -> sim_data::WorldData {
    sim_data::load_world(&sim_data::default_data_dir()).expect("data loads")
}

/// Spec 3.7.1 generation table: (size, seat skill, other five skills, age), inclusive.
/// An inclusive range.
type R = (u8, u8);
const SPEC_SIZES: [(CompanySize, R, R, R); 3] = [
    (CompanySize::Small, (4, 10), (2, 8), (25, 55)),
    (CompanySize::Mid, (7, 13), (3, 9), (30, 62)),
    (CompanySize::Large, (10, 16), (4, 10), (38, 68)),
];

/// Spec 3.7 "Skill used" column (and 10.5.1 for the Chair): the skills each seat draws in the
/// seat range.
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

/// Spec 3.7.1 role trait table.
fn spec_role_traits(seat: Seat) -> &'static [&'static str] {
    match seat {
        Seat::Ceo => &[
            "Ambitious",
            "Diligent",
            "Brave",
            "Visionary",
            "Cautious",
            "Gregarious",
        ],
        Seat::Coo => &["Diligent", "Ruthless", "Cautious", "Compassionate", "Lazy"],
        Seat::Cfo => &["Greedy", "Cautious", "Diligent", "Honest", "Deceitful"],
        Seat::Cmo => &["Gregarious", "Narcissist", "Brave", "Hedonist"],
        Seat::Cio => &["Paranoid", "Deceitful", "Ruthless", "Cautious"],
        Seat::Chair => &["Paranoid", "Ruthless", "Honest", "Ambitious", "Cautious"],
    }
}

/// 1-corporate-core 1.1.2: the 12 pairs.
const SPEC_PAIRS: [(&str, &str); 12] = [
    ("Ambitious", "Content"),
    ("Greedy", "Generous"),
    ("Paranoid", "Trusting"),
    ("Ruthless", "Compassionate"),
    ("Visionary", "Conservative"),
    ("Honest", "Deceitful"),
    ("Brave", "Cautious"),
    ("Diligent", "Lazy"),
    ("Hedonist", "Ascetic"),
    ("Zealot", "Cynic"),
    ("Narcissist", "Humble"),
    ("Gregarious", "Shy"),
];

/// True if two of `names` form a pair of the spec's table.
fn spec_has_opposites(names: &[&str]) -> bool {
    SPEC_PAIRS
        .iter()
        .any(|(a, b)| names.contains(a) && names.contains(b))
}

const ALL_SEATS: [Seat; 6] = [
    Seat::Ceo,
    Seat::Cfo,
    Seat::Cio,
    Seat::Cmo,
    Seat::Coo,
    Seat::Chair,
];

#[test]
fn size_bands_follow_revenue() {
    assert_eq!(CompanySize::from_revenue(0.0), CompanySize::Small);
    assert_eq!(
        CompanySize::from_revenue(40.0e6),
        CompanySize::Small,
        "Arrowhead"
    );
    assert_eq!(CompanySize::from_revenue(99.9e6), CompanySize::Small);
    assert_eq!(CompanySize::from_revenue(100.0e6), CompanySize::Mid);
    assert_eq!(CompanySize::from_revenue(9.99e9), CompanySize::Mid);
    assert_eq!(CompanySize::from_revenue(10.0e9), CompanySize::Large);
}

#[test]
fn trait_pairs_match_the_spec() {
    for (a, b) in SPEC_PAIRS {
        let (ta, tb) = (Trait::from_name(a).unwrap(), Trait::from_name(b).unwrap());
        assert_eq!(ta.opposite(), tb, "{a}");
        assert_eq!(tb.opposite(), ta, "{b}");
    }
    assert_eq!(Trait::ALL.len(), 24);
    assert_eq!(Trait::from_name("Operational Excellence"), None);
}

#[test]
fn skill_age_and_trait_rules_hold_over_many_draws() {
    let data = data();
    let names = NameBook::for_country(&data, "USA").unwrap();
    let mut rng = RngStreams::new(145);
    for (size, seat_range, other_range, age_range) in SPEC_SIZES {
        for seat in ALL_SEATS {
            let seat_skills = spec_seat_skills(seat);
            let mut seen_lo = false;
            let mut seen_hi = false;
            let mut two = 0;
            let n = 3000;
            for _ in 0..n {
                let c = generate_simple(&mut rng, &names, size, seat);
                assert!(
                    (age_range.0..=age_range.1).contains(&c.age),
                    "{size:?} age {}",
                    c.age
                );
                for kind in SkillKind::ALL {
                    let v = c.skills.get(kind);
                    let (lo, hi) = if seat_skills.contains(&kind) {
                        seat_range
                    } else {
                        other_range
                    };
                    assert!((lo..=hi).contains(&v), "{size:?} {seat:?} {kind:?} {v}");
                    if seat_skills.contains(&kind) {
                        seen_lo |= v == lo;
                        seen_hi |= v == hi;
                    }
                }
                let traits: Vec<&str> = c.traits.iter().map(|t| t.name()).collect();
                assert!((1..=2).contains(&traits.len()));
                assert!(!spec_has_opposites(&traits), "{traits:?}");
                assert!(no_opposite_pair(&c.traits));
                assert!(
                    traits.iter().all(|t| spec_role_traits(seat).contains(t)),
                    "{seat:?} {traits:?}"
                );
                two += usize::from(traits.len() == 2);
            }
            assert!(
                seen_lo && seen_hi,
                "{size:?} {seat:?}: whole seat range drawn"
            );
            // Spec 3.7.1: one trait 60%, two 40%.
            let share = two as f64 / f64::from(n);
            assert!((share - 0.4).abs() < 0.04, "two traits {share}");
        }
    }
}

#[test]
fn every_listed_role_trait_is_drawn() {
    let data = data();
    let names = NameBook::for_country(&data, "AUS").unwrap();
    let mut rng = RngStreams::new(11);
    for seat in ALL_SEATS {
        let mut seen: Vec<&str> = Vec::new();
        for _ in 0..2000 {
            let c = generate_simple(&mut rng, &names, CompanySize::Mid, seat);
            for t in &c.traits {
                if !seen.contains(&t.name()) {
                    seen.push(t.name());
                }
            }
        }
        seen.sort_unstable();
        let mut want = spec_role_traits(seat).to_vec();
        want.sort_unstable();
        assert_eq!(seen, want, "{seat:?}");
    }
}

#[test]
fn opposite_pairs_never_appear_even_where_the_list_has_one() {
    // The CEO list holds Brave and Cautious, the COO list Diligent and Lazy and Ruthless and
    // Compassionate, the CFO list Honest and Deceitful.
    let data = data();
    let names = NameBook::for_country(&data, "GBR").unwrap();
    let mut rng = RngStreams::new(9);
    for seat in [Seat::Ceo, Seat::Coo, Seat::Cfo] {
        for _ in 0..5000 {
            let c = generate_simple(&mut rng, &names, CompanySize::Mid, seat);
            let traits: Vec<&str> = c.traits.iter().map(|t| t.name()).collect();
            assert!(!spec_has_opposites(&traits), "{seat:?} {traits:?}");
        }
    }
}

#[test]
fn deterministic_for_a_fixed_seed() {
    let data = data();
    let names = NameBook::for_country(&data, "JPN").unwrap();
    let run = |seed| {
        let mut rng = RngStreams::new(seed);
        (0..200)
            .map(|i| generate_simple(&mut rng, &names, CompanySize::Mid, Seat::LABOR[i % 5]))
            .collect::<Vec<_>>()
    };
    assert_eq!(run(42), run(42));
    assert_ne!(run(42), run(43));
    // No rolls (spec 5.16) also works: every draw is the middle of its range.
    let c = generate_simple(&mut NoNoise, &names, CompanySize::Small, Seat::Cfo);
    assert_eq!(c.age, 40, "25 to 55");
    assert_eq!(c.skills.finance, 7, "4 to 10");
    assert_eq!(c.skills.operations, 5, "2 to 8");
}

#[test]
fn names_come_from_the_hq_country_culture() {
    let data = data();
    let china = NameBook::for_country(&data, "CHN").unwrap();
    assert_eq!(china.culture, "chinese");
    assert!(china.family_first);
    let mut rng = RngStreams::new(5);
    for _ in 0..100 {
        let name = china.draw(&mut rng);
        let (sur, first) = name.split_once(' ').unwrap();
        assert!(china.surnames.iter().any(|s| s == sur), "{name}");
        assert!(
            china.male.iter().chain(&china.female).any(|f| f == first),
            "{name}"
        );
    }
    let canada = NameBook::for_country(&data, "CAN").unwrap();
    assert!(!canada.family_first);
    let name = canada.draw(&mut rng);
    let (first, sur) = name.split_once(' ').unwrap();
    assert!(canada.male.iter().chain(&canada.female).any(|f| f == first));
    assert!(canada.surnames.iter().any(|s| s == sur));
}

#[test]
fn name_books_are_cached_per_country_in_world_order_and_save() {
    let data = data();
    let world = World::from_data(&data).unwrap();
    let books =
        NameBooks::build(&data, world.countries.rows().iter().map(|c| c.key.as_str())).unwrap();
    assert_eq!(books.len(), world.countries.len());
    assert_eq!(books, NameBooks::from_data(&data).unwrap(), "D4 order");
    assert!(books.distinct() < 40, "{} distinct books", books.distinct());
    for (id, c) in world.countries.iter() {
        assert_eq!(
            books.get(id),
            NameBook::for_country(&data, &c.key).as_ref(),
            "{}",
            c.key
        );
    }
    // Saves load without the CSVs (D13): the cache round-trips through serde.
    let bytes = postcard::to_allocvec(&books).unwrap();
    let back: NameBooks = postcard::from_bytes(&bytes).unwrap();
    assert_eq!(back, books);
}

#[test]
fn every_starting_seat_can_be_filled() {
    // Spec 7.1: seats 1 to min(5, L), each with a generated simple character. With
    // company-start.csv's gross assets that is 3,207 seats (16 companies have fewer than 5
    // labor units); design fix 200 notes the spec's "about 2,700".
    let data = data();
    let world = World::from_data(&data).unwrap();
    let books = NameBooks::from_data(&data).unwrap();
    let mut rng = RngStreams::new(7);
    let mut seats = 0;
    for ((co, start), (_, wco)) in data
        .companies
        .rows
        .iter()
        .zip(&data.company_start.rows)
        .zip(world.companies.iter())
    {
        assert_eq!(
            (co.id.as_str(), start.id.as_str()),
            (wco.key.as_str(), co.id.as_str())
        );
        let ind = data
            .industries
            .rows
            .iter()
            .find(|i| i.name == co.industry)
            .unwrap();
        let labor = labor_units(start.gross_assets_usd, ind.labor_value_usd);
        let names = books.get(wco.hq_country).unwrap();
        let size = CompanySize::from_revenue(co.revenue_usd_m * 1.0e6);
        let (_, seat_range, _, _) = SPEC_SIZES.iter().find(|s| s.0 == size).unwrap();
        for &seat in open_seats(labor) {
            let c = generate_simple(&mut rng, names, size, seat);
            for &k in spec_seat_skills(seat) {
                assert!((seat_range.0..=seat_range.1).contains(&c.skills.get(k)));
            }
            seats += 1;
        }
    }
    assert_eq!(seats, 3207);
}

#[test]
fn trait_skill_effects_add_and_clamp() {
    let base = sim::people::board::Skills {
        finance: 29,
        operations: 5,
        persuasion: 5,
        intrigue: 1,
        tech: 5,
        hustle: 5,
    };
    // 1.1.2: Greedy +2 Finance, Honest -2 Intrigue, Ambitious +1 all, Gregarious +2 Persuasion.
    let eff = with_trait_effects(&base, &[Trait::Greedy, Trait::Honest]);
    assert_eq!(eff.finance, 30, "29 + 2 clamps at 30");
    assert_eq!(eff.intrigue, 0, "1 - 2 clamps at 0");
    let amb = with_trait_effects(&base, &[Trait::Ambitious, Trait::Gregarious]);
    assert_eq!((amb.operations, amb.persuasion, amb.tech), (6, 8, 6));
}
