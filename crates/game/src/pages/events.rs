//! Startup event pages and the event list (M9.7; spec 8 Startups and listings, 9.2
//! `list_startup_events`; 5.19): what fired, when, the industries it touched and the startups it
//! made, each a link, with each startup's founding size (a band while it does not publish,
//! D420) and the headlines that reported it.

use std::sync::Arc;

use bevy::prelude::*;
use sim::SimViews;
use sim::births::random::EventKind;
use sim::world::{Origin, StartupEventId};

use super::market::{fact, note, table_box};
use super::news::event_headlines;
use super::placeholder::{chip_row, link_group, page_header};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, ViewKey};
use crate::bridge::Views;
use crate::command::index::{NameIndex, event_name};
use crate::links::names;
use crate::table::format::{self, Unit};
use crate::table::{Cell, Column, TableModel, spawn_table_with_id};
use crate::ui::theme::{self, color, font};

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Event,
        PageSpec::new(&[ViewKey::Births, ViewKey::CompanyRows, ViewKey::News])
            .sections(&[("startups", "Startups it made"), ("news", "Headlines")])
            .refresh(Refresh::OnViewChange),
        event_page,
    );
    app.register_page(
        PageKind::Events,
        PageSpec::new(&[ViewKey::Births]).refresh(Refresh::OnViewChange),
        events_page,
    );
}

/// "Fixed: Hackathon wave" or "Random: Garage founder" (5.19.1, 5.19.2).
pub fn kind_text(k: &EventKind, name: &str) -> String {
    match k {
        EventKind::Fixed(_) => format!("Fixed ({name})"),
        EventKind::Random(t) => format!("Random ({})", t.name()),
    }
}

/// The startups an event made: name, ticker, industry, HQ, founding date and size, listing.
pub fn startups_model(v: &SimViews, index: &NameIndex, id: StartupEventId) -> Option<TableModel> {
    let births = v.births.get();
    let e = births.event(id)?;
    let rows_all = &v.company_rows.get().rows;
    let rows = e
        .startups
        .iter()
        .map(|&c| {
            let page = PageRef::Company(c);
            let b = births.births.iter().find(|b| b.id == c);
            let row = rows_all
                .binary_search_by_key(&c, |r| r.id)
                .ok()
                .map(|i| &rows_all[i]);
            vec![
                Cell::Link(page.clone(), index.title(&page)),
                b.map_or(Cell::Text("-".into()), |b| {
                    Cell::Link(
                        PageRef::Industry(b.industry),
                        index.title(&PageRef::Industry(b.industry)),
                    )
                }),
                b.and_then(|b| names::place(v, b.hq))
                    .map_or(Cell::Text("-".into()), |(n, p)| Cell::Link(p, n)),
                b.map_or(Cell::Unknown, |b| Cell::Date(b.date)),
                b.map_or(Cell::Unknown, |b| Cell::figure(b.size_usd, Unit::Money)),
                row.map_or(Cell::Text("removed".into()), |r| match r.listing.date() {
                    Some(d) => Cell::Date(d),
                    None if r.public => Cell::Text("listed".into()),
                    None => Cell::Text("private".into()),
                }),
                row.map_or(Cell::Text("-".into()), |r| {
                    Cell::Text(format!("{:?}", r.status))
                }),
            ]
        })
        .collect();
    Some(TableModel::new(
        vec![
            Column::text("Startup", 220.0),
            Column::text("Industry", 170.0),
            Column::text("HQ", 200.0),
            Column::text("Founded", 96.0),
            Column::number("Size", 130.0)
                .with_hint("Revenue it was sized for, a year (5.19.3); a band while not published"),
            Column::text("Listed", 96.0).with_hint("Its listing date, once listed (5.20.1)"),
            Column::text("Status", 80.0),
        ],
        rows,
    ))
}

fn event_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
) {
    let PageRef::Event(id) = b.page else {
        return;
    };
    let v: &SimViews = &views;
    let Some(e) = v.births.get().event(id) else {
        page_header(
            &mut commands,
            b.head,
            &index.title(&b.page),
            PageKind::Event.name(),
            "",
        );
        note(
            &mut commands,
            b.head,
            "This startup event has not fired (events fire at plan locks, 5.19).",
        );
        link_group(
            &mut commands,
            b.head,
            "Pages",
            &[(index.title(&PageRef::Events), PageRef::Events)],
        );
        return;
    };
    page_header(
        &mut commands,
        b.head,
        &index.title(&b.page),
        PageKind::Event.name(),
        "",
    );
    let row = chip_row(&mut commands, b.head);
    fact(
        &mut commands,
        row,
        "Fired",
        format::date(e.date),
        color::TEXT,
    );
    fact(
        &mut commands,
        row,
        "Kind",
        kind_text(&e.kind, &e.name),
        color::TEXT,
    );
    fact(
        &mut commands,
        row,
        "Startups",
        e.startups.len().to_string(),
        color::CYAN,
    );
    let t = |p: PageRef| (index.title(&p), p);
    link_group(
        &mut commands,
        b.head,
        "Industries",
        &e.industries
            .iter()
            .map(|&i| t(PageRef::Industry(i)))
            .collect::<Vec<_>>(),
    );
    link_group(
        &mut commands,
        b.head,
        "Startups",
        &e.startups
            .iter()
            .map(|&c| t(PageRef::Company(c)))
            .collect::<Vec<_>>(),
    );
    link_group(
        &mut commands,
        b.head,
        "Pages",
        &[t(PageRef::Events), t(PageRef::News)],
    );
    if let Some(body) = b.section("startups")
        && let Some(m) = startups_model(v, &index, id)
    {
        let boxed = table_box(&mut commands, body, m.len());
        spawn_table_with_id(&mut commands, boxed, Arc::new(m), "event.startups");
    }
    if let Some(body) = b.section("news") {
        let mut any = false;
        // By the event's id, among its day's headlines only (D543, D545).
        for h in event_headlines(v.news.get(), e) {
            any = true;
            let row = chip_row(&mut commands, body);
            let d = commands
                .spawn(theme::text_line(
                    format::date(h.date),
                    font::SMALL,
                    color::TEXT_MUTED,
                ))
                .id();
            let l = commands
                .spawn(crate::links::link(h.text.clone(), PageRef::Headline(h.id)))
                .id();
            commands.entity(row).add_children(&[d, l]);
        }
        if !any {
            note(&mut commands, body, "No headline reported this event.");
        }
    }
}

/// Every event that fired, newest first (spec 9.2 `list_startup_events`).
pub fn events_model(v: &SimViews, index: &NameIndex) -> TableModel {
    let link = |p: PageRef| Cell::Link(p.clone(), index.title(&p));
    let rows = v
        .births
        .get()
        .events
        .iter()
        .rev()
        .map(|e| {
            vec![
                Cell::Link(PageRef::Event(e.id), event_name(e)),
                Cell::Date(e.date),
                Cell::Text(kind_text(&e.kind, &e.name)),
                e.industries
                    .first()
                    .map_or(Cell::Text("-".into()), |&i| link(PageRef::Industry(i))),
                Cell::Int(e.industries.len() as i64),
                Cell::Int(e.startups.len() as i64),
                e.startups
                    .first()
                    .map_or(Cell::Text("-".into()), |&c| link(PageRef::Company(c))),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Event", 260.0),
            Column::text("Date", 96.0),
            Column::text("Kind", 200.0),
            Column::text("First industry", 170.0),
            Column::number("Industries", 76.0),
            Column::number("Startups", 70.0),
            Column::text("First startup", 200.0),
        ],
        rows,
    )
}

fn events_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
) {
    let v: &SimViews = &views;
    let b2 = v.births.get();
    let born = b2.births.len();
    page_header(
        &mut commands,
        b.head,
        PageKind::Events.name(),
        &format!("{} events, {born} startups", b2.events.len()),
        "",
    );
    let started = v
        .company_rows
        .get()
        .rows
        .iter()
        .filter(|r| matches!(r.origin, Origin::Born { .. }))
        .count();
    let row = chip_row(&mut commands, b.head);
    fact(
        &mut commands,
        row,
        "Born in play, still in the game",
        started.to_string(),
        color::TEXT,
    );
    fact(
        &mut commands,
        row,
        "Listed in play",
        b2.listings.len().to_string(),
        color::TEXT,
    );
    if b2.events.is_empty() {
        note(
            &mut commands,
            b.head,
            "No startup event yet: events fire at plan locks (5.19).",
        );
    }
    spawn_table_with_id(
        &mut commands,
        b.tail,
        Arc::new(events_model(v, &index)),
        PageKind::Events.key(),
    );
}
