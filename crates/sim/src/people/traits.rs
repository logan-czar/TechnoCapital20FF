//! Personality traits: the 12 opposite pairs, their skill effects and the management score
//! shifts (spec 3.7.1, 3.7.2; 1-corporate-core 1.1.2; 10.5.1).

use serde::{Deserialize, Serialize};

use super::board::{SKILL_MAX, SKILL_MIN, Seat, SkillKind, Skills};

/// One of the 24 traits of the 12 pairs (1-corporate-core 1.1.2). Each pair is listed first
/// trait then opposite, in the 1.1.2 table order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Trait {
    Ambitious,
    Content,
    Greedy,
    Generous,
    Paranoid,
    Trusting,
    Ruthless,
    Compassionate,
    Visionary,
    Conservative,
    Honest,
    Deceitful,
    Brave,
    Cautious,
    Diligent,
    Lazy,
    Hedonist,
    Ascetic,
    Zealot,
    Cynic,
    Narcissist,
    Humble,
    Gregarious,
    Shy,
}

/// Number of opposite pairs (1-corporate-core 1.1.2).
pub const TRAIT_PAIR_COUNT: usize = 12;

impl Trait {
    /// All 24, pair by pair (1.1.2 table order).
    pub const ALL: [Trait; 2 * TRAIT_PAIR_COUNT] = [
        Trait::Ambitious,
        Trait::Content,
        Trait::Greedy,
        Trait::Generous,
        Trait::Paranoid,
        Trait::Trusting,
        Trait::Ruthless,
        Trait::Compassionate,
        Trait::Visionary,
        Trait::Conservative,
        Trait::Honest,
        Trait::Deceitful,
        Trait::Brave,
        Trait::Cautious,
        Trait::Diligent,
        Trait::Lazy,
        Trait::Hedonist,
        Trait::Ascetic,
        Trait::Zealot,
        Trait::Cynic,
        Trait::Narcissist,
        Trait::Humble,
        Trait::Gregarious,
        Trait::Shy,
    ];

    /// The opposite trait of the pair (1.1.2).
    pub fn opposite(self) -> Trait {
        let i = self as usize;
        Trait::ALL[i ^ 1]
    }

    /// The pair number, 0 to 11.
    pub fn pair(self) -> usize {
        self as usize / 2
    }

    /// The trait's name as characters.csv writes it.
    pub fn name(self) -> &'static str {
        match self {
            Trait::Ambitious => "Ambitious",
            Trait::Content => "Content",
            Trait::Greedy => "Greedy",
            Trait::Generous => "Generous",
            Trait::Paranoid => "Paranoid",
            Trait::Trusting => "Trusting",
            Trait::Ruthless => "Ruthless",
            Trait::Compassionate => "Compassionate",
            Trait::Visionary => "Visionary",
            Trait::Conservative => "Conservative",
            Trait::Honest => "Honest",
            Trait::Deceitful => "Deceitful",
            Trait::Brave => "Brave",
            Trait::Cautious => "Cautious",
            Trait::Diligent => "Diligent",
            Trait::Lazy => "Lazy",
            Trait::Hedonist => "Hedonist",
            Trait::Ascetic => "Ascetic",
            Trait::Zealot => "Zealot",
            Trait::Cynic => "Cynic",
            Trait::Narcissist => "Narcissist",
            Trait::Humble => "Humble",
            Trait::Gregarious => "Gregarious",
            Trait::Shy => "Shy",
        }
    }

    /// The trait named `name` (characters.csv spelling), if it is one of the 24. characters.csv
    /// also holds unique traits and perks outside the 12 pairs (1-corporate-core 1.1.2, such as
    /// "Operational Excellence"); they give None here, so whoever loads full characters filters
    /// them out (they have no skill effect or management shift in the MVP).
    pub fn from_name(name: &str) -> Option<Trait> {
        Trait::ALL.iter().copied().find(|t| t.name() == name)
    }

    /// The trait's lasting skill effects (1-corporate-core 1.1.2 "Skill effect" column), as
    /// (skill, points). Conditional effects are left out: Paranoid's +3 Intrigue is for defense
    /// only, Zealot's +2 Persuasion only with the same ideology and Narcissist's +2 in public
    /// is cancelled by its -2 in private; Diligent's "+2 management score skill" is the
    /// management shift ([`Trait::management_shift`]), not a skill (decision D206).
    pub fn skill_effects(self) -> &'static [(SkillKind, i32)] {
        use SkillKind::*;
        match self {
            Trait::Ambitious => &[
                (Finance, 1),
                (Operations, 1),
                (Persuasion, 1),
                (Intrigue, 1),
                (Tech, 1),
                (Hustle, 1),
            ],
            Trait::Greedy => &[(Finance, 2)],
            Trait::Ruthless => &[(Intrigue, 2)],
            Trait::Visionary => &[(Tech, 2)],
            Trait::Honest => &[(Intrigue, -2)],
            Trait::Brave => &[(Persuasion, 1)],
            Trait::Diligent => &[(Operations, 1)],
            Trait::Hedonist => &[(Operations, -1), (Persuasion, 1)],
            Trait::Gregarious => &[(Persuasion, 2)],
            _ => &[],
        }
    }

    /// The trait's shift to its holder's contribution to the management score, in skill points,
    /// when the holder sits in `seat` (spec 3.7.1, 10.5.1): Diligent +2, Lazy -2 and Ambitious
    /// +1 in any seat; Greedy -1 in the CFO seat only. 10.5.1's Deceitful -1 and Honest's
    /// investor confidence +1 are not in the spec's 3.7.1 list and are not applied (D206).
    pub fn management_shift(self, seat: Seat) -> i32 {
        match self {
            Trait::Diligent => DILIGENT_MANAGEMENT_SHIFT,
            Trait::Lazy => LAZY_MANAGEMENT_SHIFT,
            Trait::Ambitious => AMBITIOUS_MANAGEMENT_SHIFT,
            Trait::Greedy if seat == Seat::Cfo => GREEDY_CFO_MANAGEMENT_SHIFT,
            _ => 0,
        }
    }
}

/// Spec 3.7.1, 10.5.1: Diligent +2 management score skill.
pub const DILIGENT_MANAGEMENT_SHIFT: i32 = 2;
/// Spec 3.7.1, 10.5.1: Lazy -2.
pub const LAZY_MANAGEMENT_SHIFT: i32 = -2;
/// Spec 3.7.1, 10.5.1: Ambitious +1.
pub const AMBITIOUS_MANAGEMENT_SHIFT: i32 = 1;
/// Spec 3.7.1, 10.5.1: Greedy -1, as CFO only.
pub const GREEDY_CFO_MANAGEMENT_SHIFT: i32 = -1;

/// True if no two of `traits` are opposites (and none repeats).
pub fn no_opposite_pair(traits: &[Trait]) -> bool {
    traits
        .iter()
        .enumerate()
        .all(|(i, a)| traits[i + 1..].iter().all(|b| a.pair() != b.pair()))
}

/// Skills with the traits' lasting skill effects added, clamped to 0 to 30 (spec 3.7.1 "traits
/// apply only their skill effects"; 1.1.2). For rolls and votes; the management score reads
/// the drawn skills plus the management shifts instead (D206).
pub fn with_trait_effects(skills: &Skills, traits: &[Trait]) -> Skills {
    let mut out = *skills;
    for kind in SkillKind::ALL {
        let delta: i32 = traits
            .iter()
            .flat_map(|t| t.skill_effects())
            .filter(|(k, _)| *k == kind)
            .map(|(_, d)| d)
            .sum();
        let v = (i32::from(skills.get(kind)) + delta).clamp(SKILL_MIN, SKILL_MAX);
        out.set(kind, v as u8);
    }
    out
}
