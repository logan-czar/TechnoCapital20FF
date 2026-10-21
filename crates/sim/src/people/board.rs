//! Board seats and the six skills (spec 3.7; 1-corporate-core 1.1.1).

use serde::{Deserialize, Serialize};

/// Lowest skill value (spec 3.7.1: skills run 0 to 30).
pub const SKILL_MIN: i32 = 0;
/// Highest skill value (spec 3.7.1).
pub const SKILL_MAX: i32 = 30;

/// One of the six skills (spec 3.7.1; 1-corporate-core 1.1.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum SkillKind {
    Finance,
    Operations,
    Persuasion,
    Intrigue,
    Tech,
    Hustle,
}

impl SkillKind {
    /// All six, in the spec's column order (3.7.1). Generators draw in this order.
    pub const ALL: [SkillKind; 6] = [
        SkillKind::Finance,
        SkillKind::Operations,
        SkillKind::Persuasion,
        SkillKind::Intrigue,
        SkillKind::Tech,
        SkillKind::Hustle,
    ];

    pub fn index(self) -> usize {
        self as usize
    }
}

/// A character's six skills, 0 to 30 each (spec 3.7.1, 3.7.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Skills {
    pub finance: u8,
    pub operations: u8,
    pub persuasion: u8,
    pub intrigue: u8,
    pub tech: u8,
    pub hustle: u8,
}

impl Skills {
    pub fn get(&self, kind: SkillKind) -> u8 {
        match kind {
            SkillKind::Finance => self.finance,
            SkillKind::Operations => self.operations,
            SkillKind::Persuasion => self.persuasion,
            SkillKind::Intrigue => self.intrigue,
            SkillKind::Tech => self.tech,
            SkillKind::Hustle => self.hustle,
        }
    }

    pub fn set(&mut self, kind: SkillKind, value: u8) {
        match kind {
            SkillKind::Finance => self.finance = value,
            SkillKind::Operations => self.operations = value,
            SkillKind::Persuasion => self.persuasion = value,
            SkillKind::Intrigue => self.intrigue = value,
            SkillKind::Tech => self.tech = value,
            SkillKind::Hustle => self.hustle = value,
        }
    }

    /// The skill a seat uses (spec 3.7; 10.5.1): the CEO uses the average of Finance,
    /// Operations and Persuasion.
    pub fn seat_skill(&self, seat: Seat) -> f64 {
        match seat.skills() {
            SeatSkill::One(k) => f64::from(self.get(k)),
            SeatSkill::Average(ks) => {
                ks.iter().map(|&k| f64::from(self.get(k))).sum::<f64>() / ks.len() as f64
            }
        }
    }
}

/// What a seat reads from its holder (spec 3.7; 10.5.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeatSkill {
    One(SkillKind),
    Average(&'static [SkillKind]),
}

/// The CEO's three skills (spec 3.7).
pub const CEO_SKILLS: [SkillKind; 3] = [
    SkillKind::Finance,
    SkillKind::Operations,
    SkillKind::Persuasion,
];

/// A board seat (spec 3.7). The five labor seats open with labor units 1 to 5 in this order
/// (CEO, CFO, CIO, CMO, COO; spec 3.7 "A for order"); the Chair is a non-labor seat, empty in
/// the MVP, kept so the management score can name it (5.7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Seat {
    Ceo,
    Cfo,
    Cio,
    Cmo,
    Coo,
    Chair,
}

/// Number of labor seats (spec 3.7: labor units 1 to 5).
pub const LABOR_SEAT_COUNT: usize = 5;

impl Seat {
    /// The labor seats in opening order: labor unit 1 opens the CEO, 5 the COO (spec 3.7).
    pub const LABOR: [Seat; LABOR_SEAT_COUNT] =
        [Seat::Ceo, Seat::Cfo, Seat::Cio, Seat::Cmo, Seat::Coo];

    /// The skill the seat uses (spec 3.7 table; 10.5.1 for the Chair's Persuasion).
    pub fn skills(self) -> SeatSkill {
        match self {
            Seat::Ceo => SeatSkill::Average(&CEO_SKILLS),
            Seat::Cfo => SeatSkill::One(SkillKind::Finance),
            Seat::Cio => SeatSkill::One(SkillKind::Intrigue),
            Seat::Cmo => SeatSkill::One(SkillKind::Persuasion),
            Seat::Coo => SeatSkill::One(SkillKind::Operations),
            Seat::Chair => SeatSkill::One(SkillKind::Persuasion),
        }
    }

    /// The labor unit that opens this seat (1 to 5), or None for the Chair (spec 3.7).
    pub fn labor_unit(self) -> Option<u64> {
        Seat::LABOR
            .iter()
            .position(|&s| s == self)
            .map(|i| i as u64 + 1)
    }

    /// True for the five labor seats.
    pub fn is_labor(self) -> bool {
        self != Seat::Chair
    }
}
