//! Random startup events (spec 5.19.1, T): how many at each plan lock (Poisson, mean 2), which
//! industry (weighted), which type (the type table), the HQ province and each startup's target
//! revenue and cast size. All draws are gen-stream draws (5.19).
//!
//! Draw order, frozen (D267): the count; then per event: the industry pick, the type, the
//! number of startups (hot cluster only), the HQ province (one per event: a hot cluster puts
//! all its startups in one province); then per startup: the target revenue, the full count,
//! the partial count. A range of one value (a Garage founder's 1 full character) draws nothing.

use serde::{Deserialize, Serialize};

use super::weights::weighted_pick;
use crate::rng::{DrawSource, Stream};
use crate::world::{IndustryId, ProvinceId};

/// Spec 5.19.1: the number of random events at each plan lock is Poisson with mean 2 (about 8
/// a year), flat: the boom shows through the industry weights and the fixed events.
pub const RANDOM_EVENTS_MEAN: f64 = 2.0;
/// USD per $M (the type table and startup-events.csv give revenue in $M).
pub use crate::world::units::USD_PER_MILLION;

/// An inclusive count range (spec 5.19.1 type table, 5.19.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CountRange {
    pub lo: u8,
    pub hi: u8,
}

impl CountRange {
    pub const fn new(lo: u8, hi: u8) -> CountRange {
        CountRange { lo, hi }
    }

    /// A uniform integer in the range (gen stream); a one-value range draws nothing (D267).
    pub fn draw(self, draws: &mut dyn DrawSource) -> u8 {
        if self.lo >= self.hi {
            return self.lo;
        }
        draws.int_inclusive(Stream::Gen, i64::from(self.lo), i64::from(self.hi)) as u8
    }
}

/// The four random event types (spec 5.19.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum EventType {
    GarageFounder,
    SpinOutTeam,
    HotCluster,
    BackedVenture,
}

/// One row of the 5.19.1 type table (T).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TypeRow {
    pub kind: EventType,
    pub chance: f64,
    pub startups: CountRange,
    /// Revenue each, $M a year.
    pub revenue_musd: (f64, f64),
    pub full: CountRange,
    pub partial: CountRange,
}

/// Spec 5.19.1 type table (T), in table order; the chances sum to 1.
pub const TYPE_TABLE: [TypeRow; 4] = [
    TypeRow {
        kind: EventType::GarageFounder,
        chance: 0.50,
        startups: CountRange::new(1, 1),
        revenue_musd: (5.0, 20.0),
        full: CountRange::new(1, 1),
        partial: CountRange::new(1, 3),
    },
    TypeRow {
        kind: EventType::SpinOutTeam,
        chance: 0.30,
        startups: CountRange::new(1, 1),
        revenue_musd: (10.0, 50.0),
        full: CountRange::new(2, 3),
        partial: CountRange::new(2, 4),
    },
    TypeRow {
        kind: EventType::HotCluster,
        chance: 0.15,
        startups: CountRange::new(2, 3),
        revenue_musd: (5.0, 30.0),
        full: CountRange::new(1, 2),
        partial: CountRange::new(1, 3),
    },
    TypeRow {
        kind: EventType::BackedVenture,
        chance: 0.05,
        startups: CountRange::new(1, 1),
        revenue_musd: (30.0, 50.0),
        full: CountRange::new(3, 5),
        partial: CountRange::new(3, 5),
    },
];

impl EventType {
    /// The type's 5.19.1 row.
    pub fn row(self) -> &'static TypeRow {
        TYPE_TABLE
            .iter()
            .find(|r| r.kind == self)
            .expect("every type has a row")
    }

    pub fn name(self) -> &'static str {
        match self {
            EventType::GarageFounder => "Garage founder",
            EventType::SpinOutTeam => "Spin-out team",
            EventType::HotCluster => "Hot cluster",
            EventType::BackedVenture => "Backed venture",
        }
    }
}

/// The type table's cumulative chances, written out so the edges are exact (0.5 + 0.3 + 0.15
/// is 0.9500000000000001 in f64).
pub const TYPE_CUMULATIVE: [f64; 4] = [0.50, 0.80, 0.95, 1.0];

/// Draws an event type (spec 5.19.1): one gen uniform against the cumulative chances in table
/// order.
pub fn draw_type(draws: &mut dyn DrawSource) -> EventType {
    let u = draws.uniform(Stream::Gen);
    TYPE_TABLE
        .iter()
        .zip(TYPE_CUMULATIVE)
        .find(|(_, edge)| u < *edge)
        .map_or(TYPE_TABLE[TYPE_TABLE.len() - 1].kind, |(row, _)| row.kind)
}

/// The number of random events at a plan lock (spec 5.19.1): Poisson with mean 2 (Knuth, gen
/// stream).
pub fn event_count(draws: &mut dyn DrawSource) -> u32 {
    draws.poisson(Stream::Gen, RANDOM_EVENTS_MEAN)
}

/// A target revenue log-uniform in `lo..hi` USD (spec 5.19.3), from one gen uniform.
pub fn draw_target_revenue(lo_usd: f64, hi_usd: f64, draws: &mut dyn DrawSource) -> f64 {
    let u = draws.uniform(Stream::Gen);
    (lo_usd.ln() + u * (hi_usd.ln() - lo_usd.ln())).exp()
}

/// What an event is: random of a type, or fixed (startup-events.csv id).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventKind {
    Random(EventType),
    Fixed(String),
}

/// One startup an event asks for, before the 5.19.3 size cap and build.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StartupDraft {
    pub industry: IndustryId,
    pub hq: ProvinceId,
    /// Log-uniform in the event's range, USD a year, before the 2% fringe cap (5.19.3).
    pub target_revenue_usd: f64,
    pub full: u8,
    pub partial: u8,
}

/// An event before its startups are built (spec 5.19).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EventDraft {
    pub kind: EventKind,
    pub startups: Vec<StartupDraft>,
}

/// One random event (spec 5.19.1). `industry_weights` are the 5.19.1 weights of every industry
/// in id order; `hq_candidates(industry)` gives the provinces with their HQ weights
/// ([`super::weights::hq_weight`]) in id order. None when every industry weighs 0 (all Glut or
/// Bust; D261) or no province has weight: the event does not fire.
pub fn draw_random_event(
    industry_weights: &[(IndustryId, f64)],
    hq_candidates: &dyn Fn(IndustryId) -> Vec<(ProvinceId, f64)>,
    draws: &mut dyn DrawSource,
) -> Option<EventDraft> {
    let weights: Vec<f64> = industry_weights.iter().map(|(_, w)| *w).collect();
    let industry = industry_weights[weighted_pick(&weights, draws)?].0;
    let kind = draw_type(draws);
    let row = kind.row();
    let n = row.startups.draw(draws);
    let sites = hq_candidates(industry);
    let site_weights: Vec<f64> = sites.iter().map(|(_, w)| *w).collect();
    let hq = sites[weighted_pick(&site_weights, draws)?].0;
    let startups = (0..n)
        .map(|_| StartupDraft {
            industry,
            hq,
            target_revenue_usd: draw_target_revenue(
                row.revenue_musd.0 * USD_PER_MILLION,
                row.revenue_musd.1 * USD_PER_MILLION,
                draws,
            ),
            full: row.full.draw(draws),
            partial: row.partial.draw(draws),
        })
        .collect();
    Some(EventDraft {
        kind: EventKind::Random(kind),
        startups,
    })
}

/// The plan lock's random events (spec 5.19.1): the Poisson count, then each event in turn.
/// Events that do not fire (D261) are left out.
pub fn draw_random_events(
    industry_weights: &[(IndustryId, f64)],
    hq_candidates: &dyn Fn(IndustryId) -> Vec<(ProvinceId, f64)>,
    draws: &mut dyn DrawSource,
) -> Vec<EventDraft> {
    let count = event_count(draws);
    (0..count)
        .filter_map(|_| draw_random_event(industry_weights, hq_candidates, draws))
        .collect()
}
