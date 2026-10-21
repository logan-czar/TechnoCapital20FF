//! Simple (partial) characters: generated filler executives for board seats (spec 3.7.1).

use serde::{Deserialize, Serialize};

use super::board::{Seat, SeatSkill, SkillKind, Skills};
use super::names::NameBook;
use super::traits::Trait;
use crate::rng::{DrawSource, Stream};

/// Revenue at which a company is Mid (spec 3.7.1: "Mid: $100M to $10B"), USD a year.
pub const MID_REVENUE_USD: f64 = 100.0e6;
/// Revenue at which a company is Large (spec 3.7.1: "Large: $10B and up"), USD a year.
pub const LARGE_REVENUE_USD: f64 = 10.0e9;
/// Chance of two role traits rather than one (spec 3.7.1: one 60%, two 40%).
pub const TWO_TRAIT_CHANCE: f64 = 0.4;

/// Company size for character generation (spec 3.7.1), from trailing annual revenue (starting
/// revenue at load).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum CompanySize {
    Small,
    Mid,
    Large,
}

/// An inclusive integer range for a uniform draw.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Range {
    pub lo: u8,
    pub hi: u8,
}

impl Range {
    pub const fn new(lo: u8, hi: u8) -> Range {
        Range { lo, hi }
    }

    pub fn contains(self, v: u8) -> bool {
        (self.lo..=self.hi).contains(&v)
    }

    /// A uniform integer draw from the gen stream (spec 3.7.1 "uniform integer draws").
    pub fn draw(self, draws: &mut dyn DrawSource) -> u8 {
        draws.int_inclusive(Stream::Gen, i64::from(self.lo), i64::from(self.hi)) as u8
    }
}

/// The generation ranges of one size (spec 3.7.1 table, T).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SizeRanges {
    pub seat_skill: Range,
    pub other_skills: Range,
    pub age: Range,
}

/// Spec 3.7.1 table: Small (under $100M).
pub const SMALL_RANGES: SizeRanges = SizeRanges {
    seat_skill: Range::new(4, 10),
    other_skills: Range::new(2, 8),
    age: Range::new(25, 55),
};
/// Spec 3.7.1 table: Mid ($100M to $10B).
pub const MID_RANGES: SizeRanges = SizeRanges {
    seat_skill: Range::new(7, 13),
    other_skills: Range::new(3, 9),
    age: Range::new(30, 62),
};
/// Spec 3.7.1 table: Large ($10B and up).
pub const LARGE_RANGES: SizeRanges = SizeRanges {
    seat_skill: Range::new(10, 16),
    other_skills: Range::new(4, 10),
    age: Range::new(38, 68),
};

impl CompanySize {
    /// The size of a company with `revenue_usd` of trailing annual revenue (spec 3.7.1). $100M
    /// exactly is Mid and $10B exactly is Large (D202).
    pub fn from_revenue(revenue_usd: f64) -> CompanySize {
        if revenue_usd >= LARGE_REVENUE_USD {
            CompanySize::Large
        } else if revenue_usd >= MID_REVENUE_USD {
            CompanySize::Mid
        } else {
            CompanySize::Small
        }
    }

    pub fn ranges(self) -> SizeRanges {
        match self {
            CompanySize::Small => SMALL_RANGES,
            CompanySize::Mid => MID_RANGES,
            CompanySize::Large => LARGE_RANGES,
        }
    }
}

/// Spec 3.7.1 role trait lists, by seat.
pub const CEO_TRAITS: [Trait; 6] = [
    Trait::Ambitious,
    Trait::Diligent,
    Trait::Brave,
    Trait::Visionary,
    Trait::Cautious,
    Trait::Gregarious,
];
pub const COO_TRAITS: [Trait; 5] = [
    Trait::Diligent,
    Trait::Ruthless,
    Trait::Cautious,
    Trait::Compassionate,
    Trait::Lazy,
];
pub const CFO_TRAITS: [Trait; 5] = [
    Trait::Greedy,
    Trait::Cautious,
    Trait::Diligent,
    Trait::Honest,
    Trait::Deceitful,
];
pub const CMO_TRAITS: [Trait; 4] = [
    Trait::Gregarious,
    Trait::Narcissist,
    Trait::Brave,
    Trait::Hedonist,
];
pub const CIO_TRAITS: [Trait; 4] = [
    Trait::Paranoid,
    Trait::Deceitful,
    Trait::Ruthless,
    Trait::Cautious,
];
/// Chair, General Counsel, Chief Strategy Officer (post-MVP seats; spec 3.7.1).
pub const CHAIR_TRAITS: [Trait; 5] = [
    Trait::Paranoid,
    Trait::Ruthless,
    Trait::Honest,
    Trait::Ambitious,
    Trait::Cautious,
];

/// The seat's role trait list (spec 3.7.1).
pub fn role_traits(seat: Seat) -> &'static [Trait] {
    match seat {
        Seat::Ceo => &CEO_TRAITS,
        Seat::Coo => &COO_TRAITS,
        Seat::Cfo => &CFO_TRAITS,
        Seat::Cmo => &CMO_TRAITS,
        Seat::Cio => &CIO_TRAITS,
        Seat::Chair => &CHAIR_TRAITS,
    }
}

/// A simple character (spec 3.7.1). The id, company and seat are kept by whoever stores it
/// (`seat` is here because the draw depends on it).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SimpleCharacter {
    pub name: String,
    pub age: u8,
    /// The skills as drawn (spec 3.7.1); [`super::traits::with_trait_effects`] adds the traits'
    /// skill effects for rolls.
    pub skills: Skills,
    /// One or two role traits, never an opposite pair.
    pub traits: Vec<Trait>,
    pub seat: Seat,
    pub size: CompanySize,
}

/// Draws one trait uniformly from `list`, skipping `excluded` traits and their opposites.
pub(crate) fn draw_trait(draws: &mut dyn DrawSource, list: &[Trait], excluded: &[Trait]) -> Trait {
    let allowed: Vec<Trait> = list
        .iter()
        .copied()
        .filter(|t| excluded.iter().all(|e| e.pair() != t.pair()))
        .collect();
    assert!(!allowed.is_empty(), "no trait left to draw");
    let i = draws.int_inclusive(Stream::Gen, 0, allowed.len() as i64 - 1);
    allowed[i as usize]
}

/// Generates the simple character for `seat` of a company of `size` (spec 3.7.1, T): uniform
/// integer draws from the gen stream, in a frozen order (D202): the name ([`NameBook::draw`]),
/// the age, the six skills in column order (each seat skill in the seat range, the rest in the
/// other range; the CEO's Finance, Operations and Persuasion all in the seat range), then the
/// trait count (two with [`TWO_TRAIT_CHANCE`]) and the traits from the seat's list with no
/// opposite pair.
pub fn generate_simple(
    draws: &mut dyn DrawSource,
    names: &NameBook,
    size: CompanySize,
    seat: Seat,
) -> SimpleCharacter {
    let ranges = size.ranges();
    let name = names.draw(draws);
    let age = ranges.age.draw(draws);
    let mut skills = Skills::default();
    for kind in SkillKind::ALL {
        let range = if uses_skill(seat, kind) {
            ranges.seat_skill
        } else {
            ranges.other_skills
        };
        skills.set(kind, range.draw(draws));
    }
    let list = role_traits(seat);
    let first = draw_trait(draws, list, &[]);
    let mut traits = vec![first];
    if draws.chance(Stream::Gen, TWO_TRAIT_CHANCE) {
        traits.push(draw_trait(draws, list, &[first]));
    }
    SimpleCharacter {
        name,
        age,
        skills,
        traits,
        seat,
        size,
    }
}

/// True if `seat` uses `kind` (spec 3.7).
pub fn uses_skill(seat: Seat, kind: SkillKind) -> bool {
    match seat.skills() {
        SeatSkill::One(k) => k == kind,
        SeatSkill::Average(ks) => ks.contains(&kind),
    }
}
