//! Zone exchange investor confidence (spec 5.1.2; batch 157, 2a; 3-markets 3.3.5; C27): once a
//! day at 00:00 (4.2 step 6), `confidence_z = clamp(0.9 × confidence_z + 3 × r_z + news_z,
//! −100, +100)`, with r_z the headline index's return that day in % and news_z the points of
//! that day's Pdoomberg Wire headlines (5.18) on companies listed on the exchange.

use serde::{Deserialize, Serialize};

use super::fair_value::CONFIDENCE_SCALE;

/// Spec 5.1.2: 0.9 keeps 90% a day, the 10% daily decay toward 0 of 3.3.5.
pub const CONFIDENCE_RETAIN: f64 = 0.9;
/// Spec 5.1.2: 3 points per 1% of headline index return.
pub const POINTS_PER_INDEX_PERCENT: f64 = 3.0;
/// Spec 5.1.2 headline points (T).
pub const BIG_BEAT_POINTS: f64 = 4.0;
pub const BEAT_POINTS: f64 = 2.0;
pub const MISS_POINTS: f64 = -2.0;
pub const BIG_MISS_POINTS: f64 = -4.0;
pub const BANKRUPTCY_POINTS: f64 = -5.0;
pub const RATING_CHANGE_POINTS: f64 = 3.0;
/// Spec 5.1.2, 5.18: a rating change counts at 2 or more notches.
pub const RATING_CHANGE_MIN_NOTCHES: u32 = 2;
/// Below this magnitude confidence reads exactly 0 (D251), so a zone with no news decays to 0
/// (build-plan M5.7) rather than approaching it forever; it shows as 0.00.
pub const CONFIDENCE_ZERO_BELOW: f64 = 0.005;

/// A Pdoomberg Wire headline that moves its exchange's confidence (spec 5.1.2, 5.18).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConfidenceHeadline {
    BigBeat,
    Beat,
    Miss,
    BigMiss,
    Bankruptcy,
    /// A rating change of `notches` (above 0 an upgrade, below 0 a downgrade); counts only at
    /// 2 or more notches either way.
    RatingChange {
        notches: i32,
    },
}

impl ConfidenceHeadline {
    /// Points (spec 5.1.2): Big beat +4, Beat +2, Miss −2, Big miss −4, bankruptcy −5, a rating
    /// change of 2+ notches +3 up or −3 down; any other rating change 0.
    pub fn points(self) -> f64 {
        match self {
            ConfidenceHeadline::BigBeat => BIG_BEAT_POINTS,
            ConfidenceHeadline::Beat => BEAT_POINTS,
            ConfidenceHeadline::Miss => MISS_POINTS,
            ConfidenceHeadline::BigMiss => BIG_MISS_POINTS,
            ConfidenceHeadline::Bankruptcy => BANKRUPTCY_POINTS,
            ConfidenceHeadline::RatingChange { notches } => {
                if notches.unsigned_abs() >= RATING_CHANGE_MIN_NOTCHES {
                    RATING_CHANGE_POINTS * f64::from(notches.signum())
                } else {
                    0.0
                }
            }
        }
    }
}

/// news_z (spec 5.1.2): the sum of the day's headline points.
pub fn news_points(headlines: &[ConfidenceHeadline]) -> f64 {
    headlines.iter().map(|h| h.points()).sum()
}

/// One day's confidence update (spec 5.1.2): `clamp(0.9 × c + 3 × r + news, −100, +100)`, with
/// `index_return_pct` the headline index's return in % (0 for an exchange with no listed
/// company); a result under 0.005 in magnitude is 0 (D251).
pub fn update_confidence(confidence: f64, index_return_pct: f64, news: f64) -> f64 {
    let c = (CONFIDENCE_RETAIN * confidence + POINTS_PER_INDEX_PERCENT * index_return_pct + news)
        .clamp(-CONFIDENCE_SCALE, CONFIDENCE_SCALE);
    if c.abs() < CONFIDENCE_ZERO_BELOW {
        0.0
    } else {
        c
    }
}
