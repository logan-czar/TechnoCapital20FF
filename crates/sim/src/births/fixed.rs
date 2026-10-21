//! Fixed startup events F1 to F9 (spec 5.19.2, A, T), from startup-events.csv: which are due at
//! a plan lock, and the draft of each (its startups' industries, HQs, sizes and casts).
//!
//! A fixed event fires at the first plan lock on or after its date (F9: the first plan lock
//! after the bust ends, the pop + 8 quarters, 5.1.1), once. It fires even if its industry is
//! labeled Glut or Bust, but never takes more than the fringe allows (the 5.19.3 cap). Its HQ
//! uses the 5.19.1 province weights inside its region.

use serde::{Deserialize, Serialize};
use sim_data::{EventTrigger, StartupEvent};

use super::random::{
    CountRange, EventDraft, EventKind, StartupDraft, USD_PER_MILLION, draw_target_revenue,
};
use super::weights::weighted_pick;
use crate::rng::DrawSource;
use crate::time::Date;
use crate::world::{AiStage, IndustryId, ProvinceId};

/// startup-events.csv region word for "anywhere".
pub const ANY_REGION: &str = "any";

/// When a fixed event fires (spec 5.19.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Trigger {
    /// The first plan lock on or after the date.
    Date(Date),
    /// The first plan lock after the bust ends: the first lock with the AI stage Postcrash
    /// (5.1.1; D275).
    AfterBust,
}

/// Where a group's startups may put their HQ (startup-events.csv `@region`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Region {
    Any,
    /// A superregion slug, as in the province file names (`north-america`).
    Superregion(String),
    /// A country iso3 (`CHN`).
    Country(String),
}

impl Region {
    /// Parses a region word: `any`, a three-letter upper-case iso3, else a superregion slug.
    pub fn parse(word: &str) -> Region {
        if word == ANY_REGION {
            Region::Any
        } else if word.len() == 3 && word.chars().all(|c| c.is_ascii_uppercase()) {
            Region::Country(word.to_string())
        } else {
            Region::Superregion(word.to_string())
        }
    }

    /// True if a province in `superregion_slug` and country `iso3` is inside this region.
    pub fn contains(&self, superregion_slug: &str, iso3: &str) -> bool {
        match self {
            Region::Any => true,
            Region::Superregion(s) => s == superregion_slug,
            Region::Country(c) => c == iso3,
        }
    }
}

/// One group of an event: `count` startups in `industry` (industries.csv name), HQ in any of
/// `regions`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FixedGroup {
    pub count: u32,
    pub industry_name: String,
    pub regions: Vec<Region>,
}

/// A fixed startup event (spec 5.19.2; startup-events.csv).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FixedEvent {
    pub id: String,
    pub name: String,
    pub trigger: Trigger,
    pub groups: Vec<FixedGroup>,
    /// Revenue each, USD a year.
    pub revenue_usd: (f64, f64),
    pub full: CountRange,
    pub partial: CountRange,
}

/// A startup-events.csv row that cannot be read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BadEvent(pub String);

impl FixedEvent {
    /// From a startup-events.csv row.
    pub fn from_row(row: &StartupEvent) -> Result<FixedEvent, BadEvent> {
        let trigger = match row.trigger {
            EventTrigger::Date => Trigger::Date(
                parse_date(&row.date)
                    .ok_or_else(|| BadEvent(format!("{}: bad date `{}`", row.id, row.date)))?,
            ),
            EventTrigger::AfterBust => Trigger::AfterBust,
        };
        Ok(FixedEvent {
            id: row.id.clone(),
            name: row.name.clone(),
            trigger,
            groups: row
                .startups
                .iter()
                .map(|g| FixedGroup {
                    count: g.count,
                    industry_name: g.industry.clone(),
                    regions: g.regions.iter().map(|r| Region::parse(r)).collect(),
                })
                .collect(),
            revenue_usd: (
                row.revenue_min_usd_m * USD_PER_MILLION,
                row.revenue_max_usd_m * USD_PER_MILLION,
            ),
            full: CountRange::new(row.full_min, row.full_max),
            partial: CountRange::new(row.partial_min, row.partial_max),
        })
    }

    /// Startups the event asks for in all (5.19.2: 32 over F1 to F9).
    pub fn startup_count(&self) -> u32 {
        self.groups.iter().map(|g| g.count).sum()
    }

    /// True if the event is due at a plan lock on `lock_date` with the AI in `stage`, given
    /// whether it has fired (spec 5.19.2: the first lock on or after its date; F9 the first lock
    /// after the bust, D275).
    pub fn is_due(&self, lock_date: Date, stage: AiStage, fired: bool) -> bool {
        if fired {
            return false;
        }
        match self.trigger {
            Trigger::Date(d) => lock_date >= d,
            Trigger::AfterBust => stage == AiStage::Postcrash,
        }
    }
}

fn parse_date(s: &str) -> Option<Date> {
    let mut it = s.split('-');
    let y = it.next()?.parse().ok()?;
    let m = it.next()?.parse().ok()?;
    let d = it.next()?.parse().ok()?;
    Date::new(y, m, d)
}

/// The fixed events due at a lock, in file order (F1 to F9; spec 5.19.2 "fixed events due"),
/// given each event's fired flag (3.1 `startup_events`).
pub fn due_events(
    events: &[FixedEvent],
    fired: &[bool],
    lock_date: Date,
    stage: AiStage,
) -> Vec<usize> {
    events
        .iter()
        .enumerate()
        .filter(|(i, e)| e.is_due(lock_date, stage, fired.get(*i).copied().unwrap_or(false)))
        .map(|(i, _)| i)
        .collect()
}

/// The HQ candidates of an industry inside some regions: provinces with their 5.19.1 HQ
/// weights, in id order.
pub type RegionSites = dyn Fn(IndustryId, &[Region]) -> Vec<(ProvinceId, f64)>;

/// The draft of a due fixed event (spec 5.19.2). Groups in file order, startups in turn; each
/// startup draws its own HQ from `hq_candidates(industry, regions)` (the provinces inside the
/// group's regions with their 5.19.1 HQ weights, in id order), then its target revenue, full
/// count and partial count (gen stream; D275). A group whose industry `resolve` does not know,
/// or with no province weight in its regions, makes no startup.
pub fn draw_fixed_event(
    event: &FixedEvent,
    resolve: &dyn Fn(&str) -> Option<IndustryId>,
    hq_candidates: &RegionSites,
    draws: &mut dyn DrawSource,
) -> EventDraft {
    let mut startups = Vec::new();
    for g in &event.groups {
        let Some(industry) = resolve(&g.industry_name) else {
            continue;
        };
        let sites = hq_candidates(industry, &g.regions);
        let weights: Vec<f64> = sites.iter().map(|(_, w)| *w).collect();
        for _ in 0..g.count {
            let Some(i) = weighted_pick(&weights, draws) else {
                break;
            };
            startups.push(StartupDraft {
                industry,
                hq: sites[i].0,
                target_revenue_usd: draw_target_revenue(
                    event.revenue_usd.0,
                    event.revenue_usd.1,
                    draws,
                ),
                full: event.full.draw(draws),
                partial: event.partial.draw(draws),
            });
        }
    }
    EventDraft {
        kind: EventKind::Fixed(event.id.clone()),
        startups,
    }
}
