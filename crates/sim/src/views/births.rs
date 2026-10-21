//! v_births: `list_startup_events(since)`, `list_births(since)` and `list_listings(since)` (spec
//! 9.2; 8 Startups and listings), each event with its name (the Company header's "Founded
//! [date] ([event])"), and the Industries table's births column: births per industry over the
//! last 4 quarters (spec 8). Rebuilt quarterly: events, births and listings happen only at the
//! plan lock (spec 9.4 Quarterly, 4.4 row 3).

use super::{Cadence, ViewData, ViewInput};
use crate::births::random::EventKind;
use crate::time::{Date, Quarter};
use crate::world::{CompanyId, IndustryId, Ordinal, Origin, ProvinceId, StartupEventId, ZoneId};

/// Spec 8 Industries table: the births column counts the last 4 quarters.
pub const BIRTHS_COLUMN_QUARTERS: usize = 4;

/// A startup event that fired (spec 9.2 `list_startup_events`).
#[derive(Debug, Clone, PartialEq)]
pub struct EventRow {
    pub id: StartupEventId,
    /// Fixed (its startup-events.csv id) or random (its type).
    pub kind: EventKind,
    /// A fixed event's startup-events.csv `name`, a random event's type name (5.19.1).
    pub name: String,
    pub date: Date,
    pub industries: Vec<IndustryId>,
    pub startups: Vec<CompanyId>,
}

/// A company born in play (spec 9.2 `list_births`).
#[derive(Debug, Clone, PartialEq)]
pub struct BirthRow {
    pub id: CompanyId,
    pub name: String,
    pub industry: IndustryId,
    pub hq: ProvinceId,
    pub date: Date,
    /// Revenue it was sized for, USD a year (5.19.3).
    pub size_usd: f64,
    pub event: StartupEventId,
}

/// A listing in play (spec 9.2 `list_listings`).
#[derive(Debug, Clone, PartialEq)]
pub struct ListingRow {
    pub id: CompanyId,
    pub ticker: String,
    pub exchange: ZoneId,
    pub date: Date,
    pub ipo_price: f64,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct BirthsView {
    pub events: Vec<EventRow>,
    pub births: Vec<BirthRow>,
    pub listings: Vec<ListingRow>,
    /// Full characters made in play so far (3.7.2; the spec 10 world population check).
    pub full_characters_made: usize,
    /// Full characters in the world: the 296 and those made in play.
    pub full_characters: usize,
    /// The quarters the births column counts, oldest first: this quarter and the 3 before.
    pub births_column_quarters: Vec<Quarter>,
    /// Companies born per industry in those quarters, in industry id order (spec 8).
    pub births_by_industry: Vec<usize>,
}

impl BirthsView {
    pub fn list_startup_events(&self, since: Date) -> impl Iterator<Item = &EventRow> {
        self.events.iter().filter(move |e| e.date >= since)
    }

    pub fn list_births(&self, since: Date) -> impl Iterator<Item = &BirthRow> {
        self.births.iter().filter(move |b| b.date >= since)
    }

    pub fn list_listings(&self, since: Date) -> impl Iterator<Item = &ListingRow> {
        self.listings.iter().filter(move |l| l.date >= since)
    }

    /// The event with id `id` (for "Founded [date] ([event])").
    pub fn event(&self, id: StartupEventId) -> Option<&EventRow> {
        self.events.iter().find(|e| e.id == id)
    }

    /// The births column of industry `id` (spec 8).
    pub fn births_last_four_quarters(&self, id: IndustryId) -> usize {
        self.births_by_industry.get(id.index()).copied().unwrap_or(0)
    }
}

impl ViewData for BirthsView {
    const CADENCE: Cadence = Cadence::Quarterly;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let events = w
            .births
            .events
            .iter()
            .map(|e| EventRow {
                id: e.id,
                kind: e.kind.clone(),
                name: match &e.kind {
                    EventKind::Random(t) => t.name().to_owned(),
                    EventKind::Fixed(key) => w
                        .births
                        .fixed
                        .iter()
                        .find(|f| &f.id == key)
                        .map_or_else(|| key.clone(), |f| f.name.clone()),
                },
                date: e.date,
                industries: e.industries.clone(),
                startups: e.companies.clone(),
            })
            .collect();
        let now_q = w.clock.date().quarter();
        let births_column_quarters: Vec<Quarter> = (0..BIRTHS_COLUMN_QUARTERS)
            .rev()
            .map(|back| (0..back).fold(now_q, |q, _| q.prev()))
            .collect();
        let births: Vec<BirthRow> = w
            .companies
            .iter()
            .filter_map(|(id, c)| match c.origin {
                Origin::Born { date, event } => Some(BirthRow {
                    id,
                    name: c.name.clone(),
                    industry: c.industry,
                    hq: c.hq_province,
                    date,
                    size_usd: c.revenue_usd,
                    event,
                }),
                Origin::Start => None,
            })
            .collect();
        let mut births_by_industry = vec![0; w.industries.len()];
        for b in &births {
            if births_column_quarters.contains(&b.date.quarter()) {
                births_by_industry[b.industry.index()] += 1;
            }
        }
        let listings = w
            .companies
            .iter()
            .filter_map(|(id, c)| {
                let s = &w.market.stocks[id];
                Some(ListingRow {
                    id,
                    ticker: c.ticker.clone(),
                    exchange: s.exchange?,
                    date: s.listed_on?,
                    ipo_price: s.ipo_price,
                })
            })
            .collect();
        BirthsView {
            events,
            births,
            listings,
            full_characters_made: w
                .characters
                .rows()
                .iter()
                .filter(|c| c.tier == crate::people::full::GENERATED_TIER)
                .count(),
            full_characters: w.characters.len(),
            births_column_quarters,
            births_by_industry,
        }
    }
}
