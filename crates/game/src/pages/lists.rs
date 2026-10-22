//! List pages (M9 A2): Companies, Industries, News, Characters, Countries, Exchanges, Zones and
//! Events, each a placeholder header plus an index table of links built from the views, so the
//! wiki is navigable before Phase B builds the real tables (B2 owns Industries and News).
//! Every figure goes through [`Cell::figure`] (D461): a company that does not publish shows
//! estimate bands, which sort by their midpoint, never by a hidden value. Names come from
//! lane A1's countries, zones, characters and places views, and every place is a link (D462).

use std::collections::HashMap;
use std::sync::Arc;

use bevy::prelude::*;
use sim::SimViews;
use sim::finance::distress::CompanyStatus;
use sim::views::characters::CharacterRef;

use super::placeholder::page_header;
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, ViewKey};
use crate::bridge::Views;
use crate::command::index::{NameIndex, event_name};
use crate::links::names;
use crate::table::{Cell, Column, GainUnit, TableModel, Unit, spawn_table_with_id};

/// Registers every list page.
pub fn register(app: &mut App) {
    let lists: [(PageKind, &[ViewKey]); 7] = [
        (
            PageKind::Companies,
            &[ViewKey::CompanyRows, ViewKey::Quotes],
        ),
        (PageKind::Industries, &[ViewKey::IndustryRows]),
        (
            PageKind::Characters,
            &[ViewKey::Characters, ViewKey::Places],
        ),
        (PageKind::Countries, &[ViewKey::Countries]),
        (PageKind::Exchanges, &[ViewKey::Exchanges, ViewKey::Places]),
        (PageKind::Zones, &[ViewKey::Zones]),
        (PageKind::Events, &[ViewKey::Births]),
    ];
    for (kind, views) in lists {
        app.register_page(kind, PageSpec::new(views), list_page);
    }
}

/// A place's link cell ("Edmonton, Canada", opening the country), or `fallback` as text.
fn place_cell(v: &SimViews, province: sim::world::ProvinceId, fallback: &str) -> Cell {
    match names::place(v, province) {
        Some((name, page)) => Cell::Link(page, name),
        None => Cell::Text(fallback.to_owned()),
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
                        Cell::figure(r.revenue_ttm, Unit::Money),
                        Cell::figure(r.net_income_ttm, Unit::Money),
                        Cell::figure(r.value, Unit::Money),
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
                    Column::number("Revenue TTM", 130.0)
                        .with_hint("Trailing four published quarters; a band while not published"),
                    Column::number("Net income", 130.0)
                        .with_hint("TTM; a band while not published"),
                    Column::number("Value", 130.0)
                        .with_hint("Market cap at EFV when listed; a band while not published"),
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
                        Cell::figure(r.supply_ratio, Unit::Ratio),
                        Cell::figure(r.fringe_share, Unit::Percent),
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
                    Column::number("S", 90.0)
                        .with_hint("Supply over demand; a band in an estimated industry"),
                    Column::number("Fringe", 100.0),
                    Column::text("Largest", 200.0),
                ],
                rows,
            )
        }
        PageRef::Characters => {
            let company_names: HashMap<_, _> = v
                .company_rows
                .get()
                .rows
                .iter()
                .map(|r| (r.id, r.name.as_str()))
                .collect();
            let rows = v
                .characters
                .get()
                .full
                .iter()
                .filter_map(|c| match c.id {
                    CharacterRef::Full(id) => Some((id, c)),
                    CharacterRef::Partial(_) => None,
                })
                .map(|(id, c)| {
                    let role = c.roles.first().map_or(Cell::Text("-".into()), |r| {
                        let co = names::role(r).1;
                        Cell::Link(
                            PageRef::Company(co),
                            names::role_text(r, company_names.get(&co).copied().unwrap_or("?")),
                        )
                    });
                    vec![
                        Cell::Link(PageRef::Character(id), c.name.clone()),
                        Cell::Int(i64::from(c.age)),
                        c.home.as_ref().map_or(Cell::Text("-".into()), |h| {
                            place_cell(v, h.province, &h.province_name)
                        }),
                        Cell::Text(c.tier.clone()),
                        role,
                        Cell::Int(c.roles.len() as i64),
                        Cell::Int(c.holdings.len() as i64),
                    ]
                })
                .collect();
            TableModel::new(
                vec![
                    Column::text("Name", 200.0),
                    Column::number("Age", 50.0),
                    Column::text("Home", 200.0),
                    Column::text("Tier", 80.0),
                    Column::text("First role", 260.0),
                    Column::number("Roles", 60.0),
                    Column::number("Holdings", 70.0),
                ],
                rows,
            )
        }
        PageRef::Countries => {
            let rows = v
                .countries
                .get()
                .countries
                .iter()
                .map(|c| {
                    vec![
                        link(PageRef::Country(c.id)),
                        Cell::Text(c.iso3.clone()),
                        Cell::Text(c.superregion.clone()),
                        link(PageRef::Zone(c.zone)),
                        Cell::Money(c.gdp_usd),
                        Cell::Percent(c.corp_tax_rate),
                        Cell::Rating(c.sovereign_rating),
                        Cell::Percent(c.sovereign_spread),
                        Cell::Int(c.hq_companies.len() as i64),
                    ]
                })
                .collect();
            TableModel::new(
                vec![
                    Column::text("Country", 200.0),
                    Column::text("ISO3", 50.0),
                    Column::text("Region", 140.0),
                    Column::text("Zone", 170.0),
                    Column::number("GDP", 80.0),
                    Column::number("Corp tax", 70.0),
                    Column::text("Sovereign", 70.0),
                    Column::number("Spread", 70.0).with_hint("Sovereign spread"),
                    Column::number("HQ companies", 100.0),
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
                        place_cell(v, x.hub_province, &x.hub_city),
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
                    Column::text("Hub", 200.0),
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
                .zones
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
                        z.index_close
                            .map_or(Cell::Unknown, |l| Cell::Int(l.round() as i64)),
                        Cell::Percent(z.gdp_share),
                        Cell::Int(z.members.len() as i64),
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
                    Column::number("Index", 70.0).with_hint("The headline index at the last close"),
                    Column::number("GDP share", 80.0),
                    Column::number("Countries", 80.0),
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
                        Cell::Link(PageRef::Event(e.id), event_name(e)),
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
    let n = crate::links::cards::list_len(&b.page, &views)
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
