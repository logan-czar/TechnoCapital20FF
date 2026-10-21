//! The earnings jump and result tags (spec 5.15; 21.2, 21.3.1, 21.3.2, 3.3.6): the surprise
//! against consensus, the ×1.5 price jump and buzz at 01:00 on release days (4.1 step 3, 4.4),
//! and the result types tagged for headlines.

use serde::{Deserialize, Serialize};

use super::price::{BUZZ_MAX, MIN_PRICE_USD};

/// Spec 5.15: a consensus of 0 is treated as $1.
pub const ZERO_CONSENSUS_USD: f64 = 1.0;
/// Spec 5.15 (21.3.1): the overreaction factor on the 3.3.6 surprise jump.
pub const OVERREACTION: f64 = 1.5;
/// Spec 5.15 (3.3.6): the jump is `0.5 × s`, clamped to ±25%, before the overreaction.
pub const JUMP_PER_SURPRISE: f64 = 0.5;
pub const JUMP_CLAMP: f64 = 0.25;
/// Spec 5.15: `buzz += clamp(20 × s, −30, +30)`.
pub const BUZZ_PER_SURPRISE: f64 = 20.0;
pub const BUZZ_JUMP_CLAMP: f64 = 30.0;
/// Spec 5.15 (21.3.2): Beat above +5%, Big beat above +20%, Miss below −5%, Big miss below
/// −20% (T).
pub const BEAT_ABOVE: f64 = 0.05;
pub const BIG_BEAT_ABOVE: f64 = 0.20;
pub const MISS_BELOW: f64 = -0.05;
pub const BIG_MISS_BELOW: f64 = -0.20;

/// The surprise s (spec 5.15): `(actual NI − consensus) ÷ |consensus|`, a consensus of 0 read
/// as $1 in both places.
pub fn surprise(actual_net_income: f64, consensus: f64) -> f64 {
    let c = if consensus == 0.0 {
        ZERO_CONSENSUS_USD
    } else {
        consensus
    };
    (actual_net_income - c) / c.abs()
}

/// The price after the 01:00 jump (spec 5.15): `P × (1 + 1.5 × clamp(0.5 × s, −25%, +25%))`,
/// so at most ±37.5%; never below $0.01.
pub fn jumped_price(p: f64, s: f64) -> f64 {
    (p * (1.0 + OVERREACTION * (JUMP_PER_SURPRISE * s).clamp(-JUMP_CLAMP, JUMP_CLAMP)))
        .max(MIN_PRICE_USD)
}

/// Buzz after the jump (spec 5.15, 3.10): `buzz + clamp(20 × s, −30, +30)`, kept in −100 to +100.
pub fn jumped_buzz(buzz: f64, s: f64) -> f64 {
    (buzz + (BUZZ_PER_SURPRISE * s).clamp(-BUZZ_JUMP_CLAMP, BUZZ_JUMP_CLAMP))
        .clamp(-BUZZ_MAX, BUZZ_MAX)
}

/// The surprise tier of a release (spec 5.15, 21.3.2); at most one per report (D249).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum SurpriseTag {
    BigBeat,
    Beat,
    Miss,
    BigMiss,
}

impl SurpriseTag {
    /// Big beat above +20%, else Beat above +5%; Big miss below −20%, else Miss below −5%;
    /// none from −5% to +5% (D249).
    pub fn from_surprise(s: f64) -> Option<SurpriseTag> {
        if s > BIG_BEAT_ABOVE {
            Some(SurpriseTag::BigBeat)
        } else if s > BEAT_ABOVE {
            Some(SurpriseTag::Beat)
        } else if s < BIG_MISS_BELOW {
            Some(SurpriseTag::BigMiss)
        } else if s < MISS_BELOW {
            Some(SurpriseTag::Miss)
        } else {
            None
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            SurpriseTag::BigBeat => "Big beat",
            SurpriseTag::Beat => "Beat",
            SurpriseTag::Miss => "Miss",
            SurpriseTag::BigMiss => "Big miss",
        }
    }
}

/// The result types of one report (spec 5.15, 21.3.2), for headlines only.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ResultTags {
    pub surprise: Option<SurpriseTag>,
    /// Net income under 0 (21.3.2).
    pub loss: bool,
    /// Best revenue in the company's history (21.3.2; D249).
    pub record_quarter: bool,
}

/// True if `revenue` is a Record quarter (spec 21.3.2 "best revenue in the company's history",
/// D249): above 0 and strictly above every earlier quarter kept in the archive (20 quarters,
/// synthetic 2019 quarters included, 4.5 step 2). A company with no earlier quarter has no
/// record; a tie is not a record.
pub fn is_record_quarter(revenue: f64, earlier_quarter_revenues: &[f64]) -> bool {
    revenue > 0.0
        && !earlier_quarter_revenues.is_empty()
        && earlier_quarter_revenues.iter().all(|&r| revenue > r)
}

/// Tags a report (spec 5.15, 21.3.2) from the surprise, the quarter's net income and revenue and
/// the earlier quarters' revenues (oldest first, as the archive keeps them).
pub fn result_tags(
    s: f64,
    net_income: f64,
    revenue: f64,
    earlier_quarter_revenues: &[f64],
) -> ResultTags {
    ResultTags {
        surprise: SurpriseTag::from_surprise(s),
        loss: net_income < 0.0,
        record_quarter: is_record_quarter(revenue, earlier_quarter_revenues),
    }
}
