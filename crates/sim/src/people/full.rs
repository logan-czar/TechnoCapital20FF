//! Full characters made in play by startup events (spec 3.7.2, 5.19.4).

use serde::{Deserialize, Serialize};

use super::board::{Seat, SeatSkill, SkillKind, Skills};
use super::names::NameBook;
use super::simple::{Range, draw_trait};
use super::traits::Trait;
use crate::rng::{DrawSource, Stream};
use crate::world::ProvinceId;

/// Spec 3.7.2: the tier of a character made in play.
pub const GENERATED_TIER: &str = "generated";
/// Spec 3.7.2: lead founder age 22 to 55.
pub const LEAD_AGE: Range = Range::new(22, 55);
/// Spec 3.7.2: other founders 25 to 60.
pub const OTHER_AGE: Range = Range::new(25, 60);
/// Spec 3.7.2: one best skill 10 to 18.
pub const BEST_SKILL: Range = Range::new(10, 18);
/// Spec 3.7.2: one second skill 7 to 13.
pub const SECOND_SKILL: Range = Range::new(7, 13);
/// Spec 3.7.2: the other four 2 to 9.
pub const OTHER_SKILLS: Range = Range::new(2, 9);
/// Spec 3.7.2: 3 traits from the 12 pairs.
pub const FULL_TRAIT_COUNT: usize = 3;
/// Spec 3.7.2: home province is the startup's HQ province with this chance, else another
/// province of the HQ country by province weight.
pub const HOME_AT_HQ_CHANCE: f64 = 0.7;
/// Spec 3.7.2: cash_usd $0.1M to $1M (whole dollars, uniform, D204).
pub const CASH_MIN_USD: i64 = 100_000;
pub const CASH_MAX_USD: i64 = 1_000_000;
/// characters.csv id prefix (spec 3.7.2 "Next CH- id").
pub const CHARACTER_KEY_PREFIX: &str = "CH-";

/// A full character made in play (spec 3.7.2). The id, company and seat are kept by whoever
/// stores it; net worth adds the value of the stake (5.13) and is not stored here.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FullCharacter {
    pub name: String,
    pub age: u8,
    pub skills: Skills,
    pub best: SkillKind,
    pub second: SkillKind,
    pub traits: [Trait; FULL_TRAIT_COUNT],
    pub home_province: ProvinceId,
    pub cash_usd: f64,
}

impl FullCharacter {
    /// Always [`GENERATED_TIER`] (spec 3.7.2).
    pub fn tier(&self) -> &'static str {
        GENERATED_TIER
    }
}

/// What the generator needs about where the character lives (spec 3.7.2 home province).
#[derive(Debug, Clone, Copy)]
pub struct HomeChoice<'a> {
    /// The startup's HQ province.
    pub hq: ProvinceId,
    /// The other provinces of the HQ country with their province weights (2-map 2.3.1), in id
    /// order. Empty means the country has only the HQ province.
    pub others: &'a [(ProvinceId, f64)],
}

/// Generates a full character cast for `seat` (spec 3.7.2, T). The best skill is the seat's
/// skill; for the CEO (always the lead founder in 5.19.4) it is one of Finance, Operations or
/// Persuasion, drawn uniformly; for a director (`seat` None, 5.19.4 step 4) any of the six,
/// drawn uniformly (D204). The second skill is drawn uniformly from the other five.
///
/// Draw order (frozen, D204): name ([`NameBook::draw_unique`]), age, best skill pick (CEO and
/// directors only),
/// second skill pick, the six skills in column order, the three traits, home province, cash.
pub fn generate_full(
    draws: &mut dyn DrawSource,
    names: &NameBook,
    taken: &dyn Fn(&str) -> bool,
    lead: bool,
    seat: Option<Seat>,
    home: HomeChoice<'_>,
) -> FullCharacter {
    let name = names.draw_unique(draws, taken);
    let age = if lead { LEAD_AGE } else { OTHER_AGE }.draw(draws);
    let best = match seat.map(Seat::skills) {
        Some(SeatSkill::One(k)) => k,
        Some(SeatSkill::Average(ks)) => pick_skill(draws, ks),
        None => pick_skill(draws, &SkillKind::ALL),
    };
    let rest: Vec<SkillKind> = SkillKind::ALL.into_iter().filter(|&k| k != best).collect();
    let second = pick_skill(draws, &rest);
    let mut skills = Skills::default();
    for kind in SkillKind::ALL {
        let range = if kind == best {
            BEST_SKILL
        } else if kind == second {
            SECOND_SKILL
        } else {
            OTHER_SKILLS
        };
        skills.set(kind, range.draw(draws));
    }
    let mut traits: Vec<Trait> = Vec::with_capacity(FULL_TRAIT_COUNT);
    for _ in 0..FULL_TRAIT_COUNT {
        let t = draw_trait(draws, &Trait::ALL, &traits);
        traits.push(t);
    }
    let home_province = draw_home(draws, home);
    let cash_usd = draws.int_inclusive(Stream::Gen, CASH_MIN_USD, CASH_MAX_USD) as f64;
    FullCharacter {
        name,
        age,
        skills,
        best,
        second,
        traits: [traits[0], traits[1], traits[2]],
        home_province,
        cash_usd,
    }
}

fn pick_skill(draws: &mut dyn DrawSource, pool: &[SkillKind]) -> SkillKind {
    pool[draws.int_inclusive(Stream::Gen, 0, pool.len() as i64 - 1) as usize]
}

/// The home province (spec 3.7.2): the HQ with [`HOME_AT_HQ_CHANCE`], else another province of
/// the HQ country by weight. With no other province (or all weights 0) it is the HQ (D204).
/// The weight roll is skipped when the HQ wins, so the draw count varies.
fn draw_home(draws: &mut dyn DrawSource, home: HomeChoice<'_>) -> ProvinceId {
    if draws.chance(Stream::Gen, HOME_AT_HQ_CHANCE) {
        return home.hq;
    }
    let total: f64 = home.others.iter().map(|(_, w)| w.max(0.0)).sum();
    if total <= 0.0 {
        return home.hq;
    }
    let target = draws.uniform(Stream::Gen) * total;
    let mut acc = 0.0;
    for &(id, w) in home.others {
        acc += w.max(0.0);
        if target < acc {
            return id;
        }
    }
    home.others.last().map_or(home.hq, |&(id, _)| id)
}

/// The seat a non-lead full character is cast for (spec 5.19.4 step 2, D204): uniform among the
/// open labor seats other than the CEO (the lead founder's), in seat order. None when none is
/// open: the character sits as a director (5.19.4 step 4) and is generated with `seat` None.
pub fn pick_cast_seat(draws: &mut dyn DrawSource, open: &[Seat]) -> Option<Seat> {
    let seats: Vec<Seat> = Seat::LABOR
        .iter()
        .copied()
        .filter(|s| *s != Seat::Ceo && open.contains(s))
        .collect();
    if seats.is_empty() {
        return None;
    }
    let i = draws.int_inclusive(Stream::Gen, 0, seats.len() as i64 - 1);
    Some(seats[i as usize])
}

/// The key of the `n`th character, 1-based (spec 3.7.2 "Next CH- id"; characters.csv uses
/// CH-0001 to CH-0296).
pub fn character_key(n: u32) -> String {
    format!("{CHARACTER_KEY_PREFIX}{n:04}")
}
