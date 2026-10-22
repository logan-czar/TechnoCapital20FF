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
use sim::views::births::EventRow;
use sim::world::{CompanyId, IndustryId, StartupEventId};

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
        /// Its page: the `n`th headline of its day (D451).
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

    fn industries(&self) -> Vec<IndustryId> {
        match self {
            FeedItem::Headline { h, event, .. } => {
                let mut v: Vec<IndustryId> = h.industry.into_iter().collect();
                if let Some(e) = event {
                    v.extend(e.industries.iter().copied());
                }
                v
            }
            FeedItem::Event(e) => e.industries.clone(),
        }
    }

    fn companies(&self) -> Vec<CompanyId> {
        match self {
            FeedItem::Headline { h, event, .. } => {
                let mut v: Vec<CompanyId> = h.company.into_iter().collect();
                if let Some(e) = event {
                    v.extend(e.startups.iter().copied());
                }
                v
            }
            FeedItem::Event(e) => e.startups.clone(),
        }
    }

    fn kind(&self) -> (&'static str, Pick) {
        match self {
            FeedItem::Headline { h, .. } => kind_of(&h.kind),
            FeedItem::Event(_) => ("Startup event", 2),
        }
    }
}

/// The feed, newest first: every headline (with the event it reports) and every startup event
/// that posted no headline, at its date.
pub fn feed(v: &SimViews) -> Vec<FeedItem<'_>> {
    let events = &v.births.get().events;
    let mut out: Vec<FeedItem<'_>> = Vec::new();
    let mut day = None;
    let mut n = 0u32;
    let mut reported: BTreeSet<StartupEventId> = BTreeSet::new();
    for h in v.news.get().feed.iter() {
        if day == Some(h.date) {
            n += 1;
        } else {
            day = Some(h.date);
            n = 0;
        }
        let event = event_of(h, events);
        if let Some(e) = event {
            reported.insert(e.id);
        }
        out.push(FeedItem::Headline {
            h,
            page: PageRef::Headline { date: h.date, n },
            event,
        });
    }
    for e in events {
        if !reported.contains(&e.id) {
            out.push(FeedItem::Event(e));
        }
    }
    // Oldest first, events after the headlines of their day; then newest first.
    out.sort_by_key(|i| i.date());
    out.reverse();
    out
}

/// Whether a feed item passes the filter: industry, company and kind (D511 picks).
fn passes(item: &FeedItem<'_>, f: &Filter) -> bool {
    if let Some(i) = f.id("industry")
        && !item.industries().contains(&IndustryId(i))
    {
        return false;
    }
    if let Some(c) = f.id("company")
        && !item.companies().contains(&CompanyId(c))
    {
        return false;
    }
    let k = f.get("kind");
    k == 0 || item.kind().1 == k
}

/// The feed table (spec 8 News feed: date and industry tag; every subject a link).
pub fn news_model(v: &SimViews, index: &NameIndex, f: &Filter) -> TableModel {
    let link = |p: PageRef| Cell::Link(p.clone(), index.title(&p));
    let rows = feed(v)
        .into_iter()
        .filter(|i| passes(i, f))
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
    // The companies the feed names, by name.
    let mut cos: BTreeSet<CompanyId> = BTreeSet::new();
    for item in feed(v) {
        cos.extend(item.companies());
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
    if n == 0 && events == 0 {
        note(
            &mut commands,
            b.head,
            "No headlines yet: the wire posts from the first release, plan lock and phase change.",
        );
    }
}

/// The newest headlines that pass `keep`, at most `limit`: date, text and page.
pub fn headline_links(
    v: &SimViews,
    keep: impl Fn(&Headline) -> bool,
    limit: usize,
) -> Vec<(Date, String, PageRef)> {
    feed(v)
        .into_iter()
        .filter_map(|i| match i {
            FeedItem::Headline { h, page, .. } if keep(h) => Some((h.date, h.text.clone(), page)),
            _ => None,
        })
        .take(limit)
        .collect()
}

/// The headline a page names, with the event it reports.
pub fn find_headline(v: &SimViews, date: Date, n: u32) -> Option<(&Headline, Option<&EventRow>)> {
    let h = v
        .news
        .get()
        .feed
        .iter()
        .filter(|h| h.date == date)
        .nth(n as usize)?;
    Some((h, event_of(h, &v.births.get().events)))
}

fn headline_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
) {
    let PageRef::Headline { date, n } = b.page else {
        return;
    };
    let v: &SimViews = &views;
    let found = find_headline(v, date, n);
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
            "This headline is not in the feed (it may have dropped off).",
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
                !(o.date == h.date && o.text == h.text)
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
