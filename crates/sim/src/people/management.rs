//! Management score and confidence factor (spec 5.7; 10.5.1, 10.5.2).

use super::board::{SKILL_MAX, SKILL_MIN, Seat, Skills};
use super::traits::Trait;

/// Spec 5.7: an empty seat counts skill 3.
pub const EMPTY_SEAT_SKILL: f64 = 3.0;
/// Spec 5.7: the skill that scores 100 (`skill ÷ 20 × 100`).
pub const FULL_SCORE_SKILL: f64 = 20.0;
/// Spec 5.7: `× 100` turns the weighted skill share into a score.
pub const SCORE_SCALE: f64 = 100.0;
/// Spec 5.7: the score cap.
pub const MAX_SCORE: f64 = 100.0;
/// Spec 5.7 weights: CEO 30%, COO 20%, CFO 20%, CIO 10%, Chair 10%, other seats 10% (the CMO).
pub const CEO_WEIGHT: f64 = 0.30;
pub const COO_WEIGHT: f64 = 0.20;
pub const CFO_WEIGHT: f64 = 0.20;
pub const CIO_WEIGHT: f64 = 0.10;
pub const CHAIR_WEIGHT: f64 = 0.10;
pub const OTHER_WEIGHT: f64 = 0.10;
/// Spec 5.7: confidence factor `0.8 + score ÷ 250`.
pub const CONFIDENCE_BASE: f64 = 0.8;
pub const CONFIDENCE_SCORE_DIVISOR: f64 = 250.0;
/// Spec 5.6: management factor `0.5 + score ÷ 100`.
pub const MGMT_FACTOR_BASE: f64 = 0.5;
pub const MGMT_FACTOR_SCORE_DIVISOR: f64 = 100.0;

/// The weight of a seat in the management score (spec 5.7). The CMO is the MVP's one "other
/// seat".
pub fn seat_weight(seat: Seat) -> f64 {
    match seat {
        Seat::Ceo => CEO_WEIGHT,
        Seat::Coo => COO_WEIGHT,
        Seat::Cfo => CFO_WEIGHT,
        Seat::Cio => CIO_WEIGHT,
        Seat::Chair => CHAIR_WEIGHT,
        Seat::Cmo => OTHER_WEIGHT,
    }
}

/// A seated board member as the score reads it: drawn skills and traits, simple or full.
#[derive(Debug, Clone, Copy)]
pub struct Member<'a> {
    pub skills: &'a Skills,
    pub traits: &'a [Trait],
}

/// The board the score reads (spec 3.7, 5.7): one entry per seat in [`Seat`] order (CEO, CFO,
/// CIO, CMO, COO, Chair). A labor seat that is closed (fewer labor units) or unfilled is None and
/// counts skill 3, like the Chair, which is empty in the MVP (spec 3.7; D205).
#[derive(Debug, Clone, Copy, Default)]
pub struct Board<'a> {
    pub seats: [Option<Member<'a>>; 6],
}

impl<'a> Board<'a> {
    pub fn set(&mut self, seat: Seat, member: Member<'a>) {
        self.seats[seat as usize] = Some(member);
    }

    pub fn get(&self, seat: Seat) -> Option<Member<'a>> {
        self.seats[seat as usize]
    }
}

/// The skill a member adds in `seat` (spec 5.7, 3.7.1): the seat's skill as drawn plus the
/// traits' management shifts (Diligent +2, Lazy -2, Ambitious +1, Greedy -1 as CFO), clamped to
/// 0 to 30. The traits' other skill effects are not added here (D206).
pub fn member_skill(member: Member<'_>, seat: Seat) -> f64 {
    let shift: i32 = member.traits.iter().map(|t| t.management_shift(seat)).sum();
    (member.skills.seat_skill(seat) + f64::from(shift))
        .clamp(f64::from(SKILL_MIN), f64::from(SKILL_MAX))
}

/// The management score, 0 to 100 (spec 5.7): `min(100, Σ weight × skill ÷ 20 × 100)`.
pub fn management_score(board: &Board<'_>) -> f64 {
    const ORDER: [Seat; 6] = [
        Seat::Ceo,
        Seat::Cfo,
        Seat::Cio,
        Seat::Cmo,
        Seat::Coo,
        Seat::Chair,
    ];
    let weighted: f64 = ORDER
        .iter()
        .map(|&seat| {
            let skill = board
                .get(seat)
                .map_or(EMPTY_SEAT_SKILL, |m| member_skill(m, seat));
            seat_weight(seat) * skill
        })
        .sum();
    (weighted / FULL_SCORE_SKILL * SCORE_SCALE).min(MAX_SCORE)
}

/// Investor confidence factor (spec 5.7; 10.0.8, 10.5.2): `0.8 + score ÷ 250`.
pub fn confidence_factor(score: f64) -> f64 {
    CONFIDENCE_BASE + score / CONFIDENCE_SCORE_DIVISOR
}

/// Management factor on the R&D effect (spec 5.6; 10.5.2): `0.5 + score ÷ 100`.
pub fn mgmt_factor(score: f64) -> f64 {
    MGMT_FACTOR_BASE + score / MGMT_FACTOR_SCORE_DIVISOR
}
