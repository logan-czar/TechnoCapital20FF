//! Spec 3.7.2 full characters made in play (build-plan M3.2): skill, age and cash ranges hold,
//! three traits with no opposite pair, a unique name, and the same draws for a fixed seed.
//!
//! The ranges and pairs below are copied from the spec text, not read from the code.

use sim::people::board::{Seat, SkillKind, Skills};
use sim::people::full::{HomeChoice, character_key, generate_full, pick_cast_seat};
use sim::people::names::NameBook;
use sim::rng::RngStreams;
use sim::world::ProvinceId;

/// Spec 3.7.2: one best skill 10 to 18, one second skill 7 to 13, the other four 2 to 9.
const SPEC_BEST: (u8, u8) = (10, 18);
const SPEC_SECOND: (u8, u8) = (7, 13);
const SPEC_OTHER: (u8, u8) = (2, 9);
/// Spec 3.7.2: lead founder 22 to 55, others 25 to 60; cash $0.1M to $1M.
const SPEC_LEAD_AGE: (u8, u8) = (22, 55);
const SPEC_OTHER_AGE: (u8, u8) = (25, 60);
const SPEC_CASH: (f64, f64) = (100_000.0, 1_000_000.0);

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

fn within(v: u8, (lo, hi): (u8, u8)) -> bool {
    (lo..=hi).contains(&v)
}

/// Checks a full character's skills against the 3.7.2 rule with the best skill one of
/// `best_pool`: some skill of the pool is in the best range, and the other five hold one second
/// skill (7 to 13) and four others (2 to 9).
fn spec_skills_ok(skills: &Skills, best_pool: &[SkillKind]) -> bool {
    best_pool.iter().any(|&best| {
        if !within(skills.get(best), SPEC_BEST) {
            return false;
        }
        let rest: Vec<SkillKind> = SkillKind::ALL.into_iter().filter(|&k| k != best).collect();
        rest.iter().any(|&second| {
            within(skills.get(second), SPEC_SECOND)
                && rest
                    .iter()
                    .filter(|&&k| k != second)
                    .all(|&k| within(skills.get(k), SPEC_OTHER))
        })
    })
}

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
    let (mut fin_lo, mut fin_hi) = (false, false);
    let n = 4000;
    for i in 0..n {
        let lead = i % 2 == 0;
        let seat = if lead {
            Some(Seat::Ceo)
        } else {
            [Some(Seat::Cfo), Some(Seat::Coo), None][i % 3]
        };
        let c = generate_full(&mut rng, &names, &taken, lead, seat, home);
        let age = if lead { SPEC_LEAD_AGE } else { SPEC_OTHER_AGE };
        assert!(within(c.age, age), "age {}", c.age);
        let pool: &[SkillKind] = match seat {
            Some(Seat::Ceo) => &[
                SkillKind::Finance,
                SkillKind::Operations,
                SkillKind::Persuasion,
            ],
            Some(Seat::Cfo) => &[SkillKind::Finance],
            Some(Seat::Coo) => &[SkillKind::Operations],
            _ => &SkillKind::ALL,
        };
        assert!(spec_skills_ok(&c.skills, pool), "{seat:?} {:?}", c.skills);
        if seat == Some(Seat::Cfo) {
            fin_lo |= c.skills.finance == SPEC_BEST.0;
            fin_hi |= c.skills.finance == SPEC_BEST.1;
        }
        let traits: Vec<&str> = c.traits.iter().map(|t| t.name()).collect();
        assert_eq!(traits.len(), 3, "3 traits");
        let in_pairs = |t: &&str| SPEC_PAIRS.iter().any(|(a, b)| a == t || b == t);
        assert!(traits.iter().all(in_pairs), "{traits:?}");
        assert!(
            !SPEC_PAIRS
                .iter()
                .any(|(a, b)| traits.contains(a) && traits.contains(b)),
            "{traits:?}"
        );
        let mut distinct = traits.clone();
        distinct.sort_unstable();
        distinct.dedup();
        assert_eq!(distinct.len(), 3);
        assert!((SPEC_CASH.0..=SPEC_CASH.1).contains(&c.cash_usd));
        assert_eq!(c.tier(), "generated");
        at_hq += u32::from(c.home_province == HQ);
        homes[(c.home_province.0 - 10) as usize] += 1;
    }
    assert!(fin_lo && fin_hi, "the whole best range is drawn");
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
