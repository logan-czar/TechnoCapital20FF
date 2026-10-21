//! List pages (M9 A2): Companies, Industries, News, Characters, Countries, Exchanges, Zones and
//! Events, each a placeholder header plus an index table of links built from the views, so the
//! wiki is navigable before Phase B builds the real tables (B2 owns Industries and News).
//! Private companies show no figures (spec 1): the table holds only what is published.

use std::sync::Arc;

use bevy::prelude::*;
use sim::SimViews;
use sim::finance::distress::CompanyStatus;

use super::placeholder::page_header;
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, ViewKey};
use crate::bridge::Views;
use crate::command::index::{NameIndex, event_name};
use crate::table::{Cell, Column, GainUnit, TableModel, spawn_table_with_id};

/// Registers every list page.
pub fn register(app: &mut App) {
    let lists: [(PageKind, &[ViewKey]); 8] = [
        (
            PageKind::Companies,
            &[ViewKey::CompanyRows, ViewKey::Quotes],
        ),
        (PageKind::Industries, &[ViewKey::IndustryRows]),
        (PageKind::News, &[ViewKey::News]),
        (PageKind::Characters, &[ViewKey::CompanyDetail]),
        (PageKind::Countries, &[ViewKey::CompanyRows]),
        (PageKind::Exchanges, &[ViewKey::Exchanges]),
        (PageKind::Zones, &[ViewKey::Cycle]),
        (PageKind::Events, &[ViewKey::Births]),
    ];
    for (kind, views) in lists {
        app.register_page(kind, PageSpec::new(views), list_page);
    }
}

/// The index table of a list page, from the views (a snapshot when the page opens).
pub fn list_model(page: &PageRef, v: &SimViews, index: &NameIndex) -> Option<TableModel> {
    let link = |p: PageRef| Cell::Link(p.clone(), index.title(&p));
    Some(match page {
        PageRef::Companies => {
            let quotes = v.quotes.get();
            let rows = v
                .company_rows
                .get()
                .rows
                .iter()
                .filter(|r| r.status != CompanyStatus::Removed)
                .map(|r| {
                    let q = quotes.get(r.id);
                    let listed = r.public && !r.ticker.is_empty();
                    vec![
                        link(PageRef::Company(r.id)),
                        Cell::Text(if listed { r.ticker.clone() } else { "-".into() }),
                        link(PageRef::Industry(r.industry)),
                        link(PageRef::Country(r.hq_country)),
                        r.exchange
                            .map_or(Cell::Text("-".into()), |z| link(PageRef::Exchange(z))),
                        q.map_or(Cell::Unknown, |q| Cell::Price(q.last)),
                        q.map_or(Cell::Unknown, |q| {
                            Cell::Gain(q.change_pct, GainUnit::Percent)
                        }),
                        if listed {
                            Cell::Rating(r.rating)
                        } else {
                            Cell::Unknown
                        },
                        Cell::Text(format!("{:?}", r.status)),
                    ]
                })
                .collect();
            TableModel::new(
                vec![
                    Column::text("Name", 230.0),
                    Column::text("Ticker", 60.0),
                    Column::text("Industry", 170.0),
                    Column::text("HQ", 100.0),
                    Column::text("Exchange", 170.0),
                    Column::number("Price", 80.0).with_hint("Last price, USD a share"),
                    Column::number("Day", 70.0).with_hint("Change since the last close"),
                    Column::text("Rating", 60.0).with_hint("? for private companies"),
                    Column::text("Status", 80.0),
                ],
                rows,
            )
        }
        PageRef::Industries => {
            let rows = v
                .industry_rows
                .get()
                .rows
                .iter()
                .map(|r| {
                    vec![
                        link(PageRef::Industry(r.id)),
                        Cell::Text(r.sector.clone()),
                        Cell::Text(r.phase_label.name().into()),
                        Cell::Gain(r.growth_annual, GainUnit::Percent),
                        Cell::Percent(r.lt),
                        Cell::Ratio(r.supply_ratio.shown()),
                        Cell::Percent(r.fringe_share.shown()),
                        r.top_companies
                            .first()
                            .map_or(Cell::Unknown, |&c| link(PageRef::Company(c))),
                    ]
                })
                .collect();
            TableModel::new(
                vec![
                    Column::text("Industry", 210.0),
                    Column::text("Sector", 130.0),
                    Column::text("Phase", 70.0),
                    Column::number("Growth", 70.0).with_hint("This quarter's growth, a year"),
                    Column::number("Long-term", 80.0),
                    Column::number("S", 60.0).with_hint("Supply over demand"),
                    Column::number("Fringe", 70.0),
                    Column::text("Largest", 200.0),
                ],
                rows,
            )
        }
        PageRef::News => {
            // Newest first; the nth headline of its day names its page.
            let feed: Vec<_> = v.news.get().feed.iter().collect();
            let mut nth = Vec::with_capacity(feed.len());
            let mut day = None;
            let mut n = 0u32;
            for h in &feed {
                if day == Some(h.date) {
                    n += 1;
                } else {
                    day = Some(h.date);
                    n = 0;
                }
                nth.push(n);
            }
            let rows = feed
                .iter()
                .zip(nth)
                .rev()
                .map(|(h, n)| {
                    vec![
                        Cell::Date(h.date),
                        Cell::Link(PageRef::Headline { date: h.date, n }, h.text.clone()),
                        h.industry
                            .map_or(Cell::Text("-".into()), |i| link(PageRef::Industry(i))),
                        h.company
                            .map_or(Cell::Text("-".into()), |c| link(PageRef::Company(c))),
                    ]
                })
                .collect();
            TableModel::new(
                vec![
                    Column::text("Date", 100.0),
                    Column::text("Headline", 460.0),
                    Column::text("Industry", 160.0),
                    Column::text("Company", 200.0),
                ],
                rows,
            )
        }
        PageRef::Characters => {
            let rows = index
                .entries()
                .iter()
                .filter(|e| matches!(e.page, PageRef::Character(_)))
                .map(|e| {
                    vec![
                        Cell::Link(e.page.clone(), e.name.clone()),
                        Cell::Text(e.detail.clone()),
                    ]
                })
                .collect();
            TableModel::new(
                vec![Column::text("Name", 220.0), Column::text("Role", 360.0)],
                rows,
            )
        }
        PageRef::Countries => {
            let mut counts: std::collections::BTreeMap<u32, i64> = Default::default();
            for r in &v.company_rows.get().rows {
                if r.status != CompanyStatus::Removed {
                    *counts.entry(r.hq_country.0).or_default() += 1;
                }
            }
            let rows = counts
                .into_iter()
                .map(|(c, n)| {
                    vec![
                        link(PageRef::Country(sim::world::CountryId(c))),
                        Cell::Int(n),
                    ]
                })
                .collect();
            TableModel::new(
                vec![
                    Column::text("Country", 200.0)
                        .with_hint("Named by id until lane A1's countries view"),
                    Column::number("HQ companies", 110.0),
                ],
                rows,
            )
        }
        PageRef::Exchanges => {
            let rows = v
                .exchanges
                .get()
                .exchanges
                .iter()
                .map(|x| {
                    vec![
                        Cell::Text(x.code.clone()),
                        link(PageRef::Exchange(x.zone)),
                        Cell::Text(x.hub_city.clone()),
                        Cell::Text(x.index_name.clone()),
                        x.level
                            .map_or(Cell::Unknown, |l| Cell::Int(l.round() as i64)),
                        Cell::Int(x.listed_count as i64),
                        link(PageRef::Zone(x.zone)),
                    ]
                })
                .collect();
            TableModel::new(
                vec![
                    Column::text("Code", 60.0),
                    Column::text("Exchange", 220.0),
                    Column::text("Hub", 120.0),
                    Column::text("Index", 160.0),
                    Column::number("Level", 70.0).with_hint("The headline index at the last close"),
                    Column::number("Listed", 60.0),
                    Column::text("Zone", 170.0),
                ],
                rows,
            )
        }
        PageRef::Zones => {
            let rows = v
                .cycle
                .get()
                .zones
                .iter()
                .map(|z| {
                    vec![
                        Cell::Int(i64::from(z.number)),
                        link(PageRef::Zone(z.id)),
                        link(PageRef::Exchange(z.id)),
                        Cell::Gain(z.effect, GainUnit::Percent),
                        Cell::Percent(z.credit_spread),
                        Cell::Int(z.confidence.round() as i64),
                    ]
                })
                .collect();
            TableModel::new(
                vec![
                    Column::number("No.", 40.0),
                    Column::text("Zone", 200.0),
                    Column::text("Exchange", 200.0),
                    Column::number("Effect", 70.0),
                    Column::number("Spread", 70.0),
                    Column::number("Confidence", 90.0),
                ],
                rows,
            )
        }
        PageRef::Events => {
            let rows = v
                .births
                .get()
                .events
                .iter()
                .map(|e| {
                    vec![
                        Cell::Link(PageRef::Event(e.id), event_name(&e.kind, e.date)),
                        Cell::Date(e.date),
                        Cell::Int(e.industries.len() as i64),
                        Cell::Int(e.startups.len() as i64),
                    ]
                })
                .collect();
            TableModel::new(
                vec![
                    Column::text("Event", 260.0),
                    Column::text("Date", 100.0),
                    Column::number("Industries", 80.0),
                    Column::number("Startups", 80.0),
                ],
                rows,
            )
        }
        _ => return None,
    })
}

fn list_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
) {
    let kind = b.page.kind();
    let n = crate::links::cards::list_len(&b.page, &views, &index)
        .map_or(String::new(), |n| format!("{n} entries"));
    page_header(
        &mut commands,
        b.head,
        kind.name(),
        &n,
        "Index until M9 Phase B; prices as of opening the page",
    );
    if let Some(model) = list_model(&b.page, &views, &index) {
        spawn_table_with_id(&mut commands, b.tail, Arc::new(model), kind.key());
    }
}
