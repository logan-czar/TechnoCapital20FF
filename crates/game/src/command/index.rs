//! The name index (D455): every named thing the views know, with its page, so the command bar
//! can search it and links, breadcrumbs and pane titles can name a page. Built from
//! [`SimViews`] only (spec 9), and rebuilt when one of its source views moves.
//!
//! Sources today: companies (name and ticker), industries, financial zones, exchanges (name,
//! code and index name), startup events, the characters seated on boards or named as
//! controllers, the recap of each quarter so far, and the list pages. Countries have no names in
//! the views until lane A1's countries view lands; their pages are titled by id until then.

use std::collections::HashMap;

use bevy::prelude::*;
use sim::SimViews;
use sim::births::random::EventKind;
use sim::finance::distress::CompanyStatus;
use sim::time::Quarter;
use sim::world::{CharacterId, CompanyId};

use super::fuzzy::score_lower;
use crate::bridge::Views;
use crate::pages::{PageKind, PageRef};

/// One named thing.
#[derive(Debug, Clone, PartialEq)]
pub struct IndexEntry {
    pub page: PageRef,
    pub name: String,
    /// Another name that matches: a ticker or an exchange code.
    pub alias: Option<String>,
    /// A third: an index name.
    pub alias2: Option<String>,
    /// A short line shown beside the name in results.
    pub detail: String,
    /// Left out of search (a removed company keeps its name for old links).
    pub hidden: bool,
    lower: String,
    alias_lower: Option<String>,
    alias2_lower: Option<String>,
}

impl IndexEntry {
    pub fn new(page: PageRef, name: impl Into<String>, detail: impl Into<String>) -> IndexEntry {
        let name = name.into();
        IndexEntry {
            lower: name.to_ascii_lowercase(),
            page,
            name,
            alias: None,
            alias2: None,
            detail: detail.into(),
            hidden: false,
            alias_lower: None,
            alias2_lower: None,
        }
    }

    fn alias(mut self, a: &str) -> IndexEntry {
        if !a.is_empty() {
            self.alias_lower = Some(a.to_ascii_lowercase());
            self.alias = Some(a.to_owned());
        }
        self
    }

    fn alias2(mut self, a: &str) -> IndexEntry {
        if !a.is_empty() {
            self.alias2_lower = Some(a.to_ascii_lowercase());
            self.alias2 = Some(a.to_owned());
        }
        self
    }

    /// The best score of a trimmed, lowercased query over the entry's names.
    pub fn score(&self, q: &str) -> Option<i32> {
        [
            Some(self.lower.as_str()),
            self.alias_lower.as_deref(),
            self.alias2_lower.as_deref(),
        ]
        .into_iter()
        .flatten()
        .filter_map(|c| score_lower(q, c))
        .max()
    }
}

/// A search result: the entry and its score.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Hit {
    pub entry: usize,
    pub score: i32,
}

/// The versions of the views the index was built from, and the quarter (for recaps).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
struct Sources {
    versions: [u64; 6],
    quarter: Option<Quarter>,
}

impl Sources {
    fn of(v: &SimViews) -> Sources {
        Sources {
            versions: [
                v.company_rows.version(),
                v.company_detail.version(),
                v.industry_rows.version(),
                v.cycle.version(),
                v.exchanges.version(),
                v.births.version(),
            ],
            quarter: Some(v.clock().date.quarter()),
        }
    }
}

/// Every named thing, by page.
#[derive(Resource, Debug, Clone, Default)]
pub struct NameIndex {
    entries: Vec<IndexEntry>,
    by_page: HashMap<PageRef, usize>,
    by_ticker: HashMap<String, CompanyId>,
    sources: Sources,
}

/// The list pages (and settings) the command bar can open by name.
const LIST_PAGES: [PageRef; 10] = [
    PageRef::World,
    PageRef::Companies,
    PageRef::Industries,
    PageRef::News,
    PageRef::Characters,
    PageRef::Countries,
    PageRef::Exchanges,
    PageRef::Zones,
    PageRef::Events,
    PageRef::Settings,
];

impl NameIndex {
    /// Builds the index from the views.
    pub fn build(v: &SimViews) -> NameIndex {
        let mut entries = Vec::new();
        let industry_name = |id: sim::world::IndustryId| {
            v.industry_rows
                .get()
                .get(id)
                .map_or_else(|| format!("Industry #{}", id.0), |r| r.name.clone())
        };
        for p in LIST_PAGES {
            entries.push(IndexEntry::new(p.clone(), p.kind().name(), "Page"));
        }
        let mut by_ticker = HashMap::new();
        for r in &v.company_rows.get().rows {
            let mut detail = industry_name(r.industry);
            if r.public && !r.ticker.is_empty() {
                detail = format!("{detail}, listed");
            } else {
                detail = format!("{detail}, private");
            }
            let mut e =
                IndexEntry::new(PageRef::Company(r.id), r.name.clone(), detail).alias(&r.ticker);
            if r.status == CompanyStatus::Removed {
                e.hidden = true;
                e.detail.push_str(", removed");
            }
            if !r.ticker.is_empty() {
                by_ticker.insert(r.ticker.to_ascii_uppercase(), r.id);
            }
            entries.push(e);
        }
        for r in &v.industry_rows.get().rows {
            entries.push(IndexEntry::new(
                PageRef::Industry(r.id),
                r.name.clone(),
                format!("Industry, {}", r.sector),
            ));
        }
        for z in &v.cycle.get().zones {
            entries.push(
                IndexEntry::new(
                    PageRef::Zone(z.id),
                    z.name.clone(),
                    format!("Financial zone {}, exchange {}", z.number, z.exchange_code),
                )
                .alias(&z.key),
            );
        }
        for x in &v.exchanges.get().exchanges {
            entries.push(
                IndexEntry::new(
                    PageRef::Exchange(x.zone),
                    x.name.clone(),
                    format!("Exchange {}, {}", x.code, x.hub_city),
                )
                .alias(&x.code)
                .alias2(&x.index_name),
            );
        }
        for e in &v.births.get().events {
            entries.push(IndexEntry::new(
                PageRef::Event(e.id),
                event_name(&e.kind, e.date),
                format!("Startup event, {} startups", e.startups.len()),
            ));
        }
        // Characters: those on a board or named as a controller (lane A1's characters view adds
        // the rest), each once, from the first company (in id order) that names them.
        let mut seen: HashMap<CharacterId, ()> = HashMap::new();
        for c in &v.company_detail.get().companies {
            if c.status == CompanyStatus::Removed {
                continue;
            }
            let mut add = |id: CharacterId, name: &str, role: String| {
                if seen.insert(id, ()).is_none() {
                    entries.push(IndexEntry::new(PageRef::Character(id), name, role));
                }
            };
            if let (Some(id), Some(name)) = (c.controller, &c.controller_name) {
                add(id, name, format!("Controller of {}", c.name));
            }
            for s in &c.board {
                if let Some(p) = &s.holder
                    && let Some(id) = p.character
                {
                    add(id, &p.name, format!("{} of {}", seat_name(s.seat), c.name));
                }
            }
        }
        // A recap for every quarter so far, newest first.
        let mut q = v.clock().date.quarter();
        let first = Quarter { year: 2020, q: 1 };
        while q >= first {
            entries.push(IndexEntry::new(
                PageRef::Recap(q),
                format!("Quarterly recap {q}"),
                "Recap",
            ));
            q = q.prev();
        }
        let by_page = entries
            .iter()
            .enumerate()
            .map(|(i, e)| (e.page.clone(), i))
            .collect();
        NameIndex {
            entries,
            by_page,
            by_ticker,
            sources: Sources::of(v),
        }
    }

    /// Rebuilds when a source view moved.
    pub fn refresh(&mut self, v: &SimViews) -> bool {
        if Sources::of(v) == self.sources && !self.entries.is_empty() {
            return false;
        }
        *self = NameIndex::build(v);
        true
    }

    pub fn entries(&self) -> &[IndexEntry] {
        &self.entries
    }

    pub fn entry(&self, page: &PageRef) -> Option<&IndexEntry> {
        self.by_page.get(page).map(|&i| &self.entries[i])
    }

    /// A page's name: the thing's name, or the kind's name and id when unknown.
    pub fn title(&self, page: &PageRef) -> String {
        if let Some(e) = self.entry(page) {
            return e.name.clone();
        }
        match page {
            PageRef::Country(id) => format!("Country #{}", id.0),
            PageRef::Character(id) => format!("Character #{}", id.0),
            PageRef::Recap(q) => format!("Quarterly recap {q}"),
            PageRef::Headline { date, n } => format!("Headline {date} #{n}"),
            p => {
                let k = p.kind();
                if k.is_list() || matches!(k, PageKind::World | PageKind::Settings) {
                    k.name().to_owned()
                } else {
                    format!("{} {}", k.name(), p.key())
                }
            }
        }
    }

    pub fn company_by_ticker(&self, ticker: &str) -> Option<CompanyId> {
        self.by_ticker.get(&ticker.to_ascii_uppercase()).copied()
    }

    /// The best `limit` matches for `query`: score, then the kind's order, then the page (D2).
    pub fn search(&self, query: &str, limit: usize) -> Vec<Hit> {
        let q = query.trim().to_ascii_lowercase();
        if q.is_empty() {
            return Vec::new();
        }
        let mut hits: Vec<Hit> = self
            .entries
            .iter()
            .enumerate()
            .filter(|(_, e)| !e.hidden)
            .filter_map(|(i, e)| e.score(&q).map(|score| Hit { entry: i, score }))
            .collect();
        hits.sort_by(|a, b| {
            let (ea, eb) = (&self.entries[a.entry], &self.entries[b.entry]);
            b.score
                .cmp(&a.score)
                .then(ea.page.kind().cmp(&eb.page.kind()))
                .then(ea.page.cmp(&eb.page))
        });
        hits.truncate(limit);
        hits
    }
}

/// A board seat's title (spec 3.7).
pub fn seat_name(seat: sim::people::board::Seat) -> &'static str {
    use sim::people::board::Seat;
    match seat {
        Seat::Ceo => "CEO",
        Seat::Cfo => "CFO",
        Seat::Cio => "CIO",
        Seat::Cmo => "CMO",
        Seat::Coo => "COO",
        Seat::Chair => "Chair",
    }
}

/// A startup event's name: the fixed event's id, or the random type, with its date.
pub fn event_name(kind: &EventKind, date: sim::time::Date) -> String {
    match kind {
        EventKind::Fixed(id) => format!("{id} ({date})"),
        EventKind::Random(t) => format!("{} ({date})", t.name()),
    }
}

/// Keeps the index current, before any UI system reads it.
pub fn refresh_index(views: Res<Views>, mut index: ResMut<NameIndex>) {
    if views.is_changed() || index.entries.is_empty() {
        // `refresh` compares versions, so the resource is only marked changed on a rebuild.
        let stale = Sources::of(&views) != index.sources || index.entries.is_empty();
        if stale {
            index.refresh(&views);
        }
    }
}
