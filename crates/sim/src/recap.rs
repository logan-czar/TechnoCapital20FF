//! The quarterly recap (build-plan M6.5, M9.5): the world page and the watchlist company pages,
//! built at the start of the pre-quarter-end week.
//!
//! Spec sections: 4.4 row 5, 8 (Quarterly recap), 21.6.2.
//!
//! Formula half (lane F, F6): the recap's data types and their constructors. World page: the
//! global phase and g_t, industries by phase label, and the biggest expected beats and misses
//! by projection. Company page: the anticipated earnings range, the expected reaction,
//! confidence and the outlook (phase label, losses, rating watch). No guidance choice (8).

use serde::{Deserialize, Serialize};

use crate::finance::rating::Rating;
use crate::market::earnings::{jumped_price, surprise};
use crate::market::projection::{RangeViewer, range, range_width};
use crate::time::Quarter;
use crate::world::{CompanyId, CyclePhase, IndustryId, PhaseLabel};

/// Spec 8: the world page lists the biggest expected beats and misses; five of each (D280).
pub const RECAP_TOP: usize = 5;
/// The four labels in the order the page lists them (5.1).
pub const LABEL_ORDER: [PhaseLabel; 4] = [
    PhaseLabel::Boom,
    PhaseLabel::Normal,
    PhaseLabel::Glut,
    PhaseLabel::Bust,
];

/// A company's expected result (spec 8 "by projection"; D280): the engine's projection against
/// the consensus set at the lock, and the surprise s it would make (5.15).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ExpectedResult {
    pub company: CompanyId,
    pub projection: f64,
    pub consensus: f64,
    pub expected_surprise: f64,
}

impl ExpectedResult {
    pub fn new(company: CompanyId, projection: f64, consensus: f64) -> ExpectedResult {
        ExpectedResult {
            company,
            projection,
            consensus,
            expected_surprise: surprise(projection, consensus),
        }
    }
}

/// The recap's world page (spec 8, 21.6.2).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorldRecap {
    /// The quarter about to end.
    pub quarter: Quarter,
    pub phase: CyclePhase,
    pub g_t: f64,
    /// Industries by phase label, in [`LABEL_ORDER`], each list in id order.
    pub industries_by_label: Vec<(PhaseLabel, Vec<IndustryId>)>,
    /// The largest expected beats, largest first (expected s above 0).
    pub expected_beats: Vec<ExpectedResult>,
    /// The largest expected misses, worst first (expected s below 0).
    pub expected_misses: Vec<ExpectedResult>,
}

/// Builds the world page (spec 8): `industries` are (industry, label) in id order;
/// `expectations` every listed company's expected result. The five largest expected beats and
/// misses by expected surprise, ties to the lower id (D280).
pub fn world_recap(
    quarter: Quarter,
    phase: CyclePhase,
    g_t: f64,
    industries: &[(IndustryId, PhaseLabel)],
    expectations: &[ExpectedResult],
) -> WorldRecap {
    let industries_by_label = LABEL_ORDER
        .iter()
        .map(|&l| {
            let mut ids: Vec<IndustryId> = industries
                .iter()
                .filter(|(_, x)| *x == l)
                .map(|(id, _)| *id)
                .collect();
            ids.sort_unstable();
            (l, ids)
        })
        .collect();
    let mut beats: Vec<ExpectedResult> = expectations
        .iter()
        .copied()
        .filter(|e| e.expected_surprise > 0.0)
        .collect();
    beats.sort_by(|a, b| {
        b.expected_surprise
            .total_cmp(&a.expected_surprise)
            .then(a.company.cmp(&b.company))
    });
    beats.truncate(RECAP_TOP);
    let mut misses: Vec<ExpectedResult> = expectations
        .iter()
        .copied()
        .filter(|e| e.expected_surprise < 0.0)
        .collect();
    misses.sort_by(|a, b| {
        a.expected_surprise
            .total_cmp(&b.expected_surprise)
            .then(a.company.cmp(&b.company))
    });
    misses.truncate(RECAP_TOP);
    WorldRecap {
        quarter,
        phase,
        g_t,
        industries_by_label,
        expected_beats: beats,
        expected_misses: misses,
    }
}

/// Which way the next rating review points (spec 8 outlook "rating watch"): toward the implied
/// rating when it differs from the current one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RatingWatch {
    Upgrade,
    Downgrade,
}

/// The watch from the current and the implied rating (5.12): none when they match.
pub fn rating_watch(current: Rating, implied: Rating) -> Option<RatingWatch> {
    match implied.cmp(&current) {
        std::cmp::Ordering::Less => Some(RatingWatch::Upgrade),
        std::cmp::Ordering::Greater => Some(RatingWatch::Downgrade),
        std::cmp::Ordering::Equal => None,
    }
}

/// The company outlook (spec 8): its industry's phase label, its loss quarters, its rating and
/// the rating watch.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Outlook {
    pub label: PhaseLabel,
    pub loss_quarters: u32,
    pub rating: Rating,
    pub rating_watch: Option<RatingWatch>,
}

/// A watchlist company's recap page (spec 8, 21.6.2).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompanyRecap {
    pub company: CompanyId,
    pub quarter: Quarter,
    /// The anticipated earnings range (5.16 at this point of the quarter), low then high.
    pub range: (f64, f64),
    pub expected: ExpectedResult,
    /// The expected price move at the release (5.15): `1.5 × clamp(0.5 × s, ±25%)` of the
    /// expected surprise, as a fraction.
    pub expected_reaction: f64,
    /// The company's confidence factor (5.7) and its exchange's confidence (5.1.2; None for a
    /// private company).
    pub confidence_factor: f64,
    pub exchange_confidence: Option<f64>,
    pub outlook: Outlook,
}

/// Builds a company page (spec 8, 21.6.2). The range is the observer's 5.16 range at
/// `elapsed_share`, centred on the consensus (the observer never sees a plan, D252).
pub fn company_recap(
    quarter: Quarter,
    expected: ExpectedResult,
    elapsed_share: f64,
    confidence_factor: f64,
    exchange_confidence: Option<f64>,
    outlook: Outlook,
) -> CompanyRecap {
    let width = range_width(elapsed_share, RangeViewer::OBSERVER);
    CompanyRecap {
        company: expected.company,
        quarter,
        range: range(expected.consensus, width),
        expected,
        expected_reaction: jumped_price(1.0, expected.expected_surprise) - 1.0,
        confidence_factor,
        exchange_confidence,
        outlook,
    }
}
