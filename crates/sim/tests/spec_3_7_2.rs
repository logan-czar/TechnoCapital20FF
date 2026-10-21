//! Spec 3.7.2 full characters made in play (build-plan M3.2): skill, age and cash ranges hold,
//! three traits with no opposite pair, a unique name, and the same draws for a fixed seed.

use sim::people::board::{CEO_SKILLS, Seat, SkillKind};
use sim::people::full::{
    BEST_SKILL, HomeChoice, OTHER_SKILLS, SECOND_SKILL, character_key, generate_full,
    pick_cast_seat,
};
use sim::people::names::NameBook;
use sim::people::traits::no_opposite_pair;
use sim::rng::RngStreams;
use sim::world::ProvinceId;

fn data() -> sim_data::WorldData {
    sim_data::load_world(&sim_data::default_data_dir()).expect("data loads")
}

const HQ: ProvinceId = ProvinceId(10);
const OTHERS: [(ProvinceId, f64); 3] = [
    (ProvinceId(11), 1.0),
    (ProvinceId(12), 3.0),
    (ProvinceId(13), 0.0),
];

#[test]
fn ranges_and_traits_hold_over_many_draws() {
    let data = data();
    let names = NameBook::for_country(&data, "USA").unwrap();
    let taken = |_: &str| false;
    let home = HomeChoice {
        hq: HQ,
        others: &OTHERS,
    };
    let mut rng = RngStreams::new(165);
    let mut at_hq = 0;
    let mut homes = [0u32; 4];
    let n = 4000;
    for i in 0..n {
        let lead = i % 2 == 0;
        let seat = if lead {
            Some(Seat::Ceo)
        } else {
            [Some(Seat::Cfo), Some(Seat::Coo), None][i % 3]
        };
        let c = generate_full(&mut rng, &names, &taken, lead, seat, home);
        let age = if lead { 22..=55 } else { 25..=60 };
        assert!(age.contains(&c.age));
        match seat {
            Some(Seat::Ceo) => assert!(CEO_SKILLS.contains(&c.best)),
            Some(Seat::Cfo) => assert_eq!(c.best, SkillKind::Finance),
            Some(Seat::Coo) => assert_eq!(c.best, SkillKind::Operations),
            _ => {}
        }
        assert_ne!(c.best, c.second);
        for k in SkillKind::ALL {
            let v = c.skills.get(k);
            let range = if k == c.best {
                BEST_SKILL
            } else if k == c.second {
                SECOND_SKILL
            } else {
                OTHER_SKILLS
            };
            assert!(range.contains(v), "{k:?} {v}");
        }
        assert!(no_opposite_pair(&c.traits), "{:?}", c.traits);
        assert!((100_000.0..=1_000_000.0).contains(&c.cash_usd));
        assert_eq!(c.tier(), "generated");
        at_hq += u32::from(c.home_province == HQ);
        homes[(c.home_province.0 - 10) as usize] += 1;
    }
    let share = f64::from(at_hq) / f64::from(n as u32);
    assert!((share - 0.7).abs() < 0.03, "home at HQ {share}");
    assert_eq!(homes[3], 0, "a weight-0 province is never home");
    let ratio = f64::from(homes[2]) / f64::from(homes[1]);
    assert!((ratio - 3.0).abs() < 0.6, "weights 1 and 3: {ratio}");
}

#[test]
fn names_are_unique_against_taken_ones() {
    let data = data();
    let names = NameBook::for_country(&data, "CAN").unwrap();
    let existing: Vec<String> = data
        .characters
        .rows
        .iter()
        .map(|c| c.name.clone())
        .collect();
    let mut made: Vec<String> = Vec::new();
    let mut rng = RngStreams::new(3);
    for _ in 0..300 {
        let taken = |n: &str| existing.iter().chain(&made).any(|m| m == n);
        let c = generate_full(
            &mut rng,
            &names,
            &taken,
            false,
            Some(Seat::Cmo),
            HomeChoice {
                hq: HQ,
                others: &[],
            },
        );
        assert!(!taken(&c.name), "{}", c.name);
        assert_eq!(c.home_province, HQ, "no other province: home is the HQ");
        made.push(c.name);
    }
    // With every plain name taken the generator falls back to a numeral suffix (D203).
    let all_taken = |n: &str| !n.ends_with(" II");
    let c = generate_full(
        &mut rng,
        &names,
        &all_taken,
        true,
        Some(Seat::Ceo),
        HomeChoice {
            hq: HQ,
            others: &[],
        },
    );
    assert!(c.name.ends_with(" II"), "{}", c.name);
}

#[test]
fn deterministic_for_a_fixed_seed() {
    let data = data();
    let names = NameBook::for_country(&data, "IND").unwrap();
    let run = |seed| {
        let mut rng = RngStreams::new(seed);
        let home = HomeChoice {
            hq: HQ,
            others: &OTHERS,
        };
        (0..100)
            .map(|i| generate_full(&mut rng, &names, &|_| false, i == 0, Some(Seat::Cio), home))
            .collect::<Vec<_>>()
    };
    assert_eq!(run(8), run(8));
    assert_ne!(run(8), run(9));
}

#[test]
fn cast_seats_and_keys() {
    let mut rng = RngStreams::new(1);
    let open = Seat::LABOR;
    for _ in 0..200 {
        let s = pick_cast_seat(&mut rng, &open).unwrap();
        assert_ne!(s, Seat::Ceo, "the CEO seat is the lead founder's");
    }
    assert_eq!(pick_cast_seat(&mut rng, &[Seat::Ceo]), None, "a director");
    assert_eq!(pick_cast_seat(&mut rng, &[Seat::Coo]), Some(Seat::Coo));
    assert_eq!(character_key(297), "CH-0297");
}
