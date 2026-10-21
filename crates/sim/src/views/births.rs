//! v_births: `list_startup_events(since)`, `list_births(since)` and `list_listings(since)` (spec
//! 9.2; 8 Startups and listings). Rebuilt quarterly: events, births and listings happen only at
//! the plan lock (spec 9.4 Quarterly, 4.4 row 3).

use super::{Cadence, ViewData, ViewInput};
use crate::births::random::EventKind;
use crate::time::Date;
use crate::world::{CompanyId, IndustryId, Origin, ProvinceId, StartupEventId, ZoneId};

/// A startup event that fired (spec 9.2 `list_startup_events`).
#[derive(Debug, Clone, PartialEq)]
pub struct EventRow {
    pub id: StartupEventId,
    /// Fixed (its startup-events.csv id) or random (its type).
    pub kind: EventKind,
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
                date: e.date,
                industries: e.industries.clone(),
                startups: e.companies.clone(),
            })
            .collect();
        let births = w
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
        }
    }
}
