//! Spec 3.7.1 simple characters and their names (build-plan M3.2): skill and age ranges hold
//! over many draws, traits come from the seat's list with no opposite pair, the draw is
//! deterministic for a fixed seed, and every starting seat can be filled.

use sim::ops::labor::{labor_units, open_seats};
use sim::people::board::{Seat, SkillKind};
use sim::people::names::NameBook;
use sim::people::simple::{CompanySize, generate_simple, role_traits, uses_skill};
use sim::people::traits::{Trait, no_opposite_pair, with_trait_effects};
use sim::rng::{NoNoise, RngStreams};

fn data() -> sim_data::WorldData {
    sim_data::load_world(&sim_data::default_data_dir()).expect("data loads")
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
fn skill_and_age_ranges_hold_over_many_draws() {
    let data = data();
    let names = NameBook::for_country(&data, "USA").unwrap();
    let mut rng = RngStreams::new(145);
    for size in [CompanySize::Small, CompanySize::Mid, CompanySize::Large] {
        let r = size.ranges();
        for seat in ALL_SEATS {
            let mut seen_lo = false;
            let mut seen_hi = false;
            let mut two = 0;
            let n = 3000;
            for _ in 0..n {
                let c = generate_simple(&mut rng, &names, size, seat);
                assert!(r.age.contains(c.age), "{size:?} age {}", c.age);
                for kind in SkillKind::ALL {
                    let v = c.skills.get(kind);
                    let range = if uses_skill(seat, kind) {
                        r.seat_skill
                    } else {
                        r.other_skills
                    };
                    assert!(range.contains(v), "{size:?} {seat:?} {kind:?} {v}");
                    if uses_skill(seat, kind) {
                        seen_lo |= v == range.lo;
                        seen_hi |= v == range.hi;
                    }
                }
                assert!((1..=2).contains(&c.traits.len()));
                assert!(no_opposite_pair(&c.traits), "{:?}", c.traits);
                assert!(c.traits.iter().all(|t| role_traits(seat).contains(t)));
                two += usize::from(c.traits.len() == 2);
            }
            assert!(
                seen_lo && seen_hi,
                "{size:?} {seat:?}: whole seat range drawn"
            );
            let share = two as f64 / f64::from(n);
            assert!((share - 0.4).abs() < 0.04, "two traits {share}");
        }
    }
}

#[test]
fn ceo_draws_finance_operations_and_persuasion_in_the_seat_range() {
    let data = data();
    let names = NameBook::for_country(&data, "DEU").unwrap();
    let mut rng = RngStreams::new(1);
    for _ in 0..500 {
        let c = generate_simple(&mut rng, &names, CompanySize::Large, Seat::Ceo);
        for k in [
            SkillKind::Finance,
            SkillKind::Operations,
            SkillKind::Persuasion,
        ] {
            assert!((10..=16).contains(&c.skills.get(k)));
        }
        for k in [SkillKind::Intrigue, SkillKind::Tech, SkillKind::Hustle] {
            assert!((4..=10).contains(&c.skills.get(k)));
        }
    }
}

#[test]
fn opposite_pairs_never_appear_even_where_the_list_has_one() {
    // The CEO list holds Brave and Cautious, the COO list Diligent and Lazy and Ruthless and
    // Compassionate, the CFO list Honest and Deceitful.
    assert_eq!(Trait::Brave.opposite(), Trait::Cautious);
    assert_eq!(Trait::Lazy.opposite(), Trait::Diligent);
    assert_eq!(Trait::Deceitful.opposite(), Trait::Honest);
    let data = data();
    let names = NameBook::for_country(&data, "GBR").unwrap();
    let mut rng = RngStreams::new(9);
    for seat in [Seat::Ceo, Seat::Coo, Seat::Cfo] {
        for _ in 0..5000 {
            let c = generate_simple(&mut rng, &names, CompanySize::Mid, seat);
            assert!(no_opposite_pair(&c.traits), "{seat:?} {:?}", c.traits);
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
    assert_eq!(c.age, 40);
    assert_eq!(c.skills.finance, 7);
    assert_eq!(c.skills.operations, 5);
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
    // Every country has a book.
    for c in &data.countries.rows {
        assert!(
            NameBook::for_country(&data, &c.iso3).is_some(),
            "{}",
            c.iso3
        );
    }
}

#[test]
fn every_starting_seat_can_be_filled() {
    // Spec 7.1: seats 1 to min(5, L), each with a generated simple character. With
    // company-start.csv's gross assets that is 3,207 seats (16 companies have fewer than 5
    // labor units); design fix 200 notes the spec's "about 2,700".
    let data = data();
    let mut rng = RngStreams::new(7);
    let mut seats = 0;
    for (co, start) in data.companies.rows.iter().zip(&data.company_start.rows) {
        assert_eq!(co.id, start.id);
        let ind = data
            .industries
            .rows
            .iter()
            .find(|i| i.name == co.industry)
            .unwrap();
        let labor = labor_units(start.gross_assets_usd, ind.labor_value_usd);
        let names = NameBook::for_country(&data, &co.hq_country).unwrap();
        let size = CompanySize::from_revenue(co.revenue_usd_m * 1.0e6);
        for &seat in open_seats(labor) {
            let c = generate_simple(&mut rng, &names, size, seat);
            assert!(size.ranges().seat_skill.contains(c.skills.get(match seat {
                Seat::Ceo => SkillKind::Finance,
                Seat::Cfo => SkillKind::Finance,
                Seat::Cio => SkillKind::Intrigue,
                Seat::Cmo => SkillKind::Persuasion,
                _ => SkillKind::Operations,
            })));
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
    let eff = with_trait_effects(&base, &[Trait::Greedy, Trait::Honest]);
    assert_eq!(eff.finance, 30, "29 + 2 clamps at 30");
    assert_eq!(eff.intrigue, 0, "1 - 2 clamps at 0");
    let amb = with_trait_effects(&base, &[Trait::Ambitious, Trait::Gregarious]);
    assert_eq!((amb.operations, amb.persuasion, amb.tech), (6, 8, 6));
}
