//! The News feed and a headline's page (M9.6, M9.7; spec 8 News feed and Startups and listings
//! rows; 20-ui 20.5.1).
//!
//! The feed lists the Pdoomberg Wire's headlines (5.18) newest first, each with its date, kind
//! and industry tag, and every subject linked: the headline itself (its page), the industry, the
//! company and, for a startup story, the startup event. It filters by industry, by company and
//! by kind. Every startup event appears: a startup headline links to the event it reports (by
//! the event id it carries, D543), and an event that posted no headline gets a row of its own.

use std::collections::BTreeSet;

use bevy::prelude::*;
use sim::SimViews;
use sim::news::{Headline, HeadlineKind};
use sim::time::Date;
use sim::views::NewsView;
use sim::views::births::EventRow;
use sim::world::{CompanyId, HeadlineId, IndustryId, StartupEventId};

use super::live::{
    Filter, Live, LiveCtx, LiveModel, Pick, PickerLook, spawn_live_table, spawn_picker,
};
use super::market::note;
use super::placeholder::{chip_row, link_group, page_header};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, ViewKey};
use crate::bridge::{RunnerControls, Views};
use crate::command::index::{NameIndex, event_name};
use crate::table::format;
use crate::table::{Cell, Column, TableModel};
use crate::ui::theme::{self, color, font};

/// Related headlines a headline's page lists.
pub const RELATED_HEADLINES: usize = 12;

/// The feed's kinds, for its kind filter (pick values from 1).
pub const KINDS: [(&str, Pick); 7] = [
    ("Results", 1),
    ("Startups", 2),
    ("Listings and IPO votes", 3),
    ("Ratings", 4),
    ("Phase changes", 5),
    ("Bankruptcies and removals", 6),
    ("Raises and other", 7),
];

/// A headline's kind name and its filter group.
pub fn kind_of(k: &HeadlineKind) -> (&'static str, Pick) {
    match k {
        HeadlineKind::Result { .. } => ("Result", 1),
        HeadlineKind::FixedStartupEvent { .. } => ("Startup event", 2),
        HeadlineKind::StartupLaunch => ("Startup", 2),
        HeadlineKind::HotCluster { .. } => ("Hot cluster", 2),
        HeadlineKind::IpoVote { .. } => ("IPO vote", 3),
        HeadlineKind::Listing { .. } => ("Listing", 3),
        HeadlineKind::RatingChange { .. } => ("Rating", 4),
        HeadlineKind::PhaseChange { .. } => ("Phase change", 5),
        HeadlineKind::Bankruptcy => ("Bankruptcy", 6),
        HeadlineKind::Removal => ("Removal", 6),
        HeadlineKind::Raise { .. } => ("Raise", 7),
        HeadlineKind::FailedRaise { .. } => ("Failed raise", 7),
        HeadlineKind::Chatbot => ("Chatbot", 7),
    }
}

/// The startup event a headline reports, by the id it carries (D543; events are in id order).
pub fn event_of<'a>(h: &Headline, events: &'a [EventRow]) -> Option<&'a EventRow> {
    let id = h.event?;
    events
        .binary_search_by_key(&id, |e| e.id)
        .ok()
        .map(|i| &events[i])
}

/// One line of the feed: a headline, or a startup event that posted none.
pub enum FeedItem<'a> {
    Headline {
        h: &'a Headline,
        /// Its page, by its id (D544).
        page: PageRef,
        event: Option<&'a EventRow>,
    },
    Event(&'a EventRow),
}

impl FeedItem<'_> {
    pub fn date(&self) -> Date {
        match self {
            FeedItem::Headline { h, .. } => h.date,
            FeedItem::Event(e) => e.date,
        }
    }

    fn has_industry(&self, i: IndustryId) -> bool {
        match self {
            FeedItem::Headline { h, event, .. } => {
                h.industry == Some(i) || event.is_some_and(|e| e.industries.contains(&i))
            }
            FeedItem::Event(e) => e.industries.contains(&i),
        }
    }

    fn has_company(&self, c: CompanyId) -> bool {
        match self {
            FeedItem::Headline { h, event, .. } => {
                h.company == Some(c) || event.is_some_and(|e| e.startups.contains(&c))
            }
            FeedItem::Event(e) => e.startups.contains(&c),
        }
    }

    fn kind(&self) -> (&'static str, Pick) {
        match self {
            FeedItem::Headline { h, .. } => kind_of(&h.kind),
            FeedItem::Event(_) => ("Startup event", 2),
        }
    }
}

/// The feed, newest first (D545): every headline (with the event it reports) and every startup
/// event that posted no headline, at its date; on one date the events come before the
/// headlines, each newest first. It walks the feed backwards a day at a time and stops where
/// its reader stops, so the newest rows cost the same however long the feed is. An event's
/// headline is dated the event's own day (both at the plan lock, D543), so when the walk
/// reaches an event's date it has seen any headline that reports it.
pub struct Feed<'a> {
    heads: std::iter::Peekable<Box<dyn Iterator<Item = &'a Headline> + 'a>>,
    events: &'a [EventRow],
    /// Events not walked yet: `events[..next_event]`.
    next_event: usize,
    /// The events reported by the headlines walked so far.
    reported: BTreeSet<StartupEventId>,
    /// The current day's rows still to hand out, oldest last (popped from the end).
    day: Vec<FeedItem<'a>>,
}

impl<'a> Feed<'a> {
    pub fn new(news: &'a NewsView, events: &'a [EventRow]) -> Feed<'a> {
        let heads: Box<dyn Iterator<Item = &'a Headline> + 'a> = Box::new(news.feed.iter().rev());
        Feed {
            heads: heads.peekable(),
            events,
            next_event: events.len(),
            reported: BTreeSet::new(),
            day: Vec::new(),
        }
    }

    /// Loads the next (older) day's rows; false when nothing is left.
    fn load_day(&mut self) -> bool {
        let h_day = self.heads.peek().map(|h| h.date);
        let e_day = self.next_event.checked_sub(1).map(|i| self.events[i].date);
        let Some(day) = h_day.max(e_day) else {
            return false;
        };
        let mut heads = Vec::new();
        while let Some(h) = self.heads.next_if(|h| h.date == day) {
            if let Some(id) = h.event {
                self.reported.insert(id);
            }
            heads.push(FeedItem::Headline {
                h,
                page: PageRef::Headline(h.id),
                event: event_of(h, self.events),
            });
        }
        let mut rows = Vec::new();
        while self.next_event > 0 && self.events[self.next_event - 1].date == day {
            self.next_event -= 1;
            let e = &self.events[self.next_event];
            if !self.reported.contains(&e.id) {
                rows.push(FeedItem::Event(e));
            }
        }
        rows.extend(heads);
        rows.reverse();
        self.day = rows;
        true
    }
}

impl<'a> Iterator for Feed<'a> {
    type Item = FeedItem<'a>;

    fn next(&mut self) -> Option<FeedItem<'a>> {
        while self.day.is_empty() {
            if !self.load_day() {
                return None;
            }
        }
        self.day.pop()
    }
}

/// The views' feed, newest first (see [`Feed`]).
pub fn feed(v: &SimViews) -> Feed<'_> {
    Feed::new(v.news.get(), &v.births.get().events)
}

/// Whether a feed item passes the filter: industry, company and kind (D511 picks).
fn passes(item: &FeedItem<'_>, f: &Filter) -> bool {
    if let Some(i) = f.id("industry")
        && !item.has_industry(IndustryId(i))
    {
        return false;
    }
    if let Some(c) = f.id("company")
        && !item.has_company(CompanyId(c))
    {
        return false;
    }
    let k = f.get("kind");
    k == 0 || item.kind().1 == k
}

/// The rows the feed table lists by default: the newest that pass the filters (D545). A daily
/// v_news move remakes this many rows, not the whole feed.
pub const FEED_ROWS: usize = 500;

/// The feed's "Show" pick (pick values from 1; 0 is the newest [`FEED_ROWS`]).
pub const SHOW: [(&str, Pick); 3] = [("Newest 2,000", 1), ("Newest 10,000", 2), ("All", 3)];

/// The most rows the "Show" pick of `f` lists; `None` for all.
pub fn shown_rows(f: &Filter) -> Option<usize> {
    match f.get("show") {
        0 => Some(FEED_ROWS),
        1 => Some(2_000),
        2 => Some(10_000),
        _ => None,
    }
}

/// The feed table (spec 8 News feed: date and industry tag; every subject a link): the newest
/// rows that pass the filters, at most the "Show" pick's count (D545).
pub fn news_model(v: &SimViews, index: &NameIndex, f: &Filter) -> TableModel {
    news_table(v.news.get(), &v.births.get().events, index, f)
}

/// [`news_model`] over a news view and the events (a bench can hand it a long feed).
pub fn news_table(
    news: &NewsView,
    events: &[EventRow],
    index: &NameIndex,
    f: &Filter,
) -> TableModel {
    let link = |p: PageRef| Cell::Link(p.clone(), index.title(&p));
    let rows = Feed::new(news, events)
        .filter(|i| passes(i, f))
        .take(shown_rows(f).unwrap_or(usize::MAX))
        .map(|item| {
            let (kind, _) = item.kind();
            match item {
                FeedItem::Headline { h, page, event } => vec![
                    Cell::Date(h.date),
                    Cell::Link(page, h.text.clone()),
                    Cell::Text(kind.into()),
                    h.industry
                        .map_or(Cell::Text("-".into()), |i| link(PageRef::Industry(i))),
                    h.company
                        .map_or(Cell::Text("-".into()), |c| link(PageRef::Company(c))),
                    event.map_or(Cell::Text("-".into()), |e| {
                        Cell::Link(PageRef::Event(e.id), event_name(e))
                    }),
                ],
                FeedItem::Event(e) => vec![
                    Cell::Date(e.date),
                    Cell::Link(
                        PageRef::Event(e.id),
                        format!("{}: {} new startups", e.name, e.startups.len()),
                    ),
                    Cell::Text(kind.into()),
                    e.industries
                        .first()
                        .map_or(Cell::Text("-".into()), |&i| link(PageRef::Industry(i))),
                    e.startups
                        .first()
                        .map_or(Cell::Text("-".into()), |&c| link(PageRef::Company(c))),
                    Cell::Link(PageRef::Event(e.id), event_name(e)),
                ],
            }
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Date", 96.0),
            Column::text("Headline", 440.0).with_hint("Pdoomberg Wire (5.18); opens the headline"),
            Column::text("Kind", 110.0),
            Column::text("Industry", 170.0).with_hint("The industry tag (spec 8)"),
            Column::text("Company", 190.0),
            Column::text("Startup event", 220.0),
        ],
        rows,
    )
}

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::News,
        PageSpec::new(&[ViewKey::News, ViewKey::Births]),
        news_page,
    );
    app.register_page(
        PageKind::Headline,
        PageSpec::new(&[ViewKey::News, ViewKey::Births])
            .sections(&[("subjects", "Subjects"), ("related", "Related headlines")])
            .refresh(Refresh::OnViewChange),
        headline_page,
    );
}

/// The industry options of a picker: "All", then the 42 by name.
pub fn industry_options(v: &SimViews) -> Vec<(String, Pick)> {
    let mut o: Vec<(String, Pick)> = v
        .industry_rows
        .get()
        .rows
        .iter()
        .map(|r| (r.name.clone(), u64::from(r.id.0) + 1))
        .collect();
    o.sort();
    o.insert(0, ("All".into(), 0));
    o
}

fn news_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    controls: Res<RunnerControls>,
) {
    let v: &SimViews = &views;
    let n = v.news.get().feed.len();
    let events = v.births.get().events.len();
    page_header(
        &mut commands,
        b.head,
        PageKind::News.name(),
        &format!("{n} headlines, {events} startup events"),
        "Pdoomberg Wire (5.18)",
    );
    let filters = chip_row(&mut commands, b.head);
    let table = spawn_live_table(
        &mut commands,
        b.tail,
        "news",
        Live::new(&[ViewKey::News, ViewKey::Births], |c: &LiveCtx| {
            LiveModel::Table(news_model(c.views, c.index, c.filter))
        }),
        Filter::default(),
        &views,
        &index,
        &controls,
    );
    spawn_picker(
        &mut commands,
        filters,
        "Industry",
        "industry",
        industry_options(v),
        table,
        0,
        PickerLook::PAGE,
    );
    // The companies the feed names, by name: the headlines' and the events' startups.
    let mut cos: BTreeSet<CompanyId> = v.news.get().feed.iter().filter_map(|h| h.company).collect();
    for e in &v.births.get().events {
        cos.extend(e.startups.iter().copied());
    }
    let mut options: Vec<(String, Pick)> = cos
        .into_iter()
        .map(|c| (index.title(&PageRef::Company(c)), u64::from(c.0) + 1))
        .collect();
    options.sort();
    options.insert(0, ("All".into(), 0));
    spawn_picker(
        &mut commands,
        filters,
        "Company",
        "company",
        options,
        table,
        0,
        PickerLook::PAGE,
    );
    let mut kinds: Vec<(String, Pick)> = KINDS.iter().map(|(l, v)| ((*l).into(), *v)).collect();
    kinds.insert(0, ("All".into(), 0));
    spawn_picker(
        &mut commands,
        filters,
        "Kind",
        "kind",
        kinds,
        table,
        0,
        PickerLook::PAGE,
    );
    let mut show: Vec<(String, Pick)> = SHOW.iter().map(|(l, v)| ((*l).into(), *v)).collect();
    show.insert(0, (format!("Newest {FEED_ROWS}"), 0));
    spawn_picker(
        &mut commands,
        filters,
        "Show",
        "show",
        show,
        table,
        0,
        PickerLook::PAGE,
    );
    if n == 0 && events == 0 {
        note(
            &mut commands,
            b.head,
            "No headlines yet: the wire posts from the first release, plan lock and phase change.",
        );
    } else {
        note(
            &mut commands,
            b.head,
            format!(
                "Lists the newest {FEED_ROWS} rows that pass the filters; Show lists more. A \
                 column sort reorders only the rows shown."
            ),
        );
    }
}

/// The newest headlines that pass `keep`, at most `limit`: date, text and page. It walks the
/// headlines backwards and stops at `limit`, building no feed rows (D545).
pub fn headline_links(
    v: &SimViews,
    keep: impl Fn(&Headline) -> bool,
    limit: usize,
) -> Vec<(Date, String, PageRef)> {
    newest_headlines(v.news.get(), keep, limit)
}

/// [`headline_links`] over a news view.
pub fn newest_headlines(
    news: &NewsView,
    keep: impl Fn(&Headline) -> bool,
    limit: usize,
) -> Vec<(Date, String, PageRef)> {
    news.feed
        .iter()
        .rev()
        .filter(|h| keep(h))
        .take(limit)
        .map(|h| (h.date, h.text.clone(), PageRef::Headline(h.id)))
        .collect()
}

/// The headlines that report startup event `e`, oldest first: they are dated the event's day
/// (D543), so this reads only that day's headlines (D545).
pub fn event_headlines<'a>(
    news: &'a NewsView,
    e: &EventRow,
) -> impl Iterator<Item = &'a Headline> + 'a {
    let (id, date) = (e.id, e.date);
    news.since(date)
        .take_while(move |h| h.date == date)
        .filter(move |h| h.event == Some(id))
}

/// The headline a page names (by id, D544), with the event it reports.
pub fn find_headline(v: &SimViews, id: HeadlineId) -> Option<(&Headline, Option<&EventRow>)> {
    let h = v.news.get().get(id)?;
    Some((h, event_of(h, &v.births.get().events)))
}

fn headline_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
) {
    let PageRef::Headline(id) = b.page else {
        return;
    };
    let v: &SimViews = &views;
    let found = find_headline(v, id);
    page_header(
        &mut commands,
        b.head,
        &index.title(&b.page),
        PageKind::Headline.name(),
        "",
    );
    let Some((h, event)) = found else {
        note(
            &mut commands,
            b.head,
            "This headline is not in the feed (a page from another game?).",
        );
        link_group(
            &mut commands,
            b.head,
            "Pages",
            &[(index.title(&PageRef::News), PageRef::News)],
        );
        return;
    };
    let text = commands
        .spawn(theme::text(h.text.clone(), font::TITLE, color::TEXT))
        .id();
    commands.entity(b.head).add_child(text);
    let row = chip_row(&mut commands, b.head);
    for s in [
        format::date(h.date),
        h.byline().to_owned(),
        kind_of(&h.kind).0.to_owned(),
    ] {
        let e = commands
            .spawn(theme::text_line(s, font::SMALL, color::TEXT_MUTED))
            .id();
        commands.entity(row).add_child(e);
    }
    if let Some(body) = b.section("subjects") {
        let t = |p: PageRef| (index.title(&p), p);
        if let Some(i) = h.industry {
            link_group(&mut commands, body, "Industry", &[t(PageRef::Industry(i))]);
        }
        if let Some(c) = h.company {
            link_group(&mut commands, body, "Company", &[t(PageRef::Company(c))]);
        }
        let exchange = match &h.kind {
            HeadlineKind::IpoVote { exchange, .. } | HeadlineKind::Listing { exchange, .. } => {
                v.exchanges.get().get(exchange).map(|x| x.zone)
            }
            _ => None,
        };
        if let Some(z) = exchange {
            link_group(&mut commands, body, "Exchange", &[t(PageRef::Exchange(z))]);
        }
        if let Some(e) = event {
            link_group(
                &mut commands,
                body,
                "Startup event",
                &[(event_name(e), PageRef::Event(e.id))],
            );
            link_group(
                &mut commands,
                body,
                "Startups",
                &e.startups
                    .iter()
                    .map(|&c| t(PageRef::Company(c)))
                    .collect::<Vec<_>>(),
            );
            link_group(
                &mut commands,
                body,
                "Industries",
                &e.industries
                    .iter()
                    .map(|&i| t(PageRef::Industry(i)))
                    .collect::<Vec<_>>(),
            );
        }
        link_group(&mut commands, body, "Feed", &[t(PageRef::News)]);
    }
    if let Some(body) = b.section("related") {
        let (company, industry) = (h.company, h.industry);
        let lines = headline_links(
            v,
            |o| {
                o.id != h.id
                    && ((company.is_some() && o.company == company)
                        || (company.is_none() && industry.is_some() && o.industry == industry))
            },
            RELATED_HEADLINES,
        );
        if lines.is_empty() {
            note(
                &mut commands,
                body,
                "No other headline on this subject yet.",
            );
        }
        for (date, text, page) in lines {
            let row = chip_row(&mut commands, body);
            let d = commands
                .spawn(theme::text_line(
                    format::date(date),
                    font::SMALL,
                    color::TEXT_MUTED,
                ))
                .id();
            let l = commands.spawn(crate::links::link(text, page)).id();
            commands.entity(row).add_children(&[d, l]);
        }
    }
}
