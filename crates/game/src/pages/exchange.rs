//! The Exchange page (M9 B1; spec 5.14, 9.2 `get_exchange`): a zone exchange's code, name, zone,
//! hub city and province, headline index (level now and a line chart of its daily closes from
//! 2020, D540), listed count and investor confidence, and its constituents table, which
//! follows v_exchanges daily (prices from v_quotes at each refresh).

use bevy::prelude::*;
use sim::SimViews;
use sim::world::ZoneId;

use super::doc::{
    Block, Field, Live, LiveChart, LiveTable, PageDoc, SectionDoc, Span, TableDoc, spawn_doc,
};
use super::zone::{index_chart, members_model};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, SectionSpec, ViewKey};
use crate::bridge::Views;
use crate::command::index::NameIndex;
use crate::config::UiConfig;
use crate::links::names;
use crate::table::{Cell, Column, GainUnit, TableModel};

pub const SECTIONS: &[SectionSpec] = &[
    ("index", "Index"),
    ("constituents", "Constituents"),
    ("members", "Member countries"),
];

/// Rebuilds when listings change (v_company_row at the lock) and monthly; the level, the count
/// and the constituents' prices follow by themselves.
pub const VIEWS: &[ViewKey] = &[ViewKey::CompanyRows, ViewKey::Countries];

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Exchange,
        PageSpec::new(VIEWS)
            .sections(SECTIONS)
            .refresh(Refresh::OnViewChange),
        exchange_page,
    );
}

fn exchange_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    cfg: Res<UiConfig>,
) {
    let PageRef::Exchange(z) = b.page else {
        return;
    };
    let doc = exchange_doc(z, &views, &index);
    spawn_doc(&mut commands, &b, &doc, &views, &cfg, None);
}

/// The constituents table: each quoted company with its last price, day change, market cap,
/// EFV, industry and rating (v_exchanges, v_quotes, v_company_row).
pub fn constituents_model(z: ZoneId, v: &SimViews, index: &NameIndex) -> TableModel {
    let quotes = v.quotes.get();
    let rows_by_id = &v.company_rows.get().rows;
    let rows = v
        .exchanges
        .get()
        .exchanges
        .iter()
        .find(|x| x.zone == z)
        .map(|x| x.constituents.as_slice())
        .unwrap_or_default()
        .iter()
        .map(|&c| {
            let p = PageRef::Company(c);
            let q = quotes.get(c);
            let row = rows_by_id
                .binary_search_by_key(&c, |r| r.id)
                .ok()
                .map(|i| &rows_by_id[i]);
            vec![
                Cell::Link(p.clone(), index.title(&p)),
                Cell::Text(row.map_or_else(String::new, |r| r.ticker.clone())),
                row.map_or(Cell::Unknown, |r| {
                    let ind = PageRef::Industry(r.industry);
                    Cell::Link(ind.clone(), index.title(&ind))
                }),
                q.map_or(Cell::Unknown, |q| Cell::Price(q.last)),
                q.map_or(Cell::Unknown, |q| {
                    Cell::Gain(q.change_pct, GainUnit::Percent)
                }),
                q.map_or(Cell::Unknown, |q| Cell::Money(q.market_cap)),
                q.map_or(Cell::Unknown, |q| Cell::Price(q.efv)),
                row.map_or(Cell::Unknown, |r| Cell::Rating(r.rating)),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Company", 220.0),
            Column::text("Ticker", 60.0),
            Column::text("Industry", 170.0),
            Column::number("Price", 80.0),
            Column::number("Day", 70.0),
            Column::number("Market cap", 100.0).with_hint("Last price x shares: the index weight"),
            Column::number("EFV", 90.0).with_hint("Estimated fair value a share (3.14.2)"),
            Column::text("Rating", 60.0),
        ],
        rows,
    )
}

/// The whole Exchange page as data.
pub fn exchange_doc(z: ZoneId, v: &SimViews, index: &NameIndex) -> PageDoc {
    let page = PageRef::Exchange(z);
    let mut doc = PageDoc {
        page: page.clone(),
        title: index.title(&page),
        kind: PageKind::Exchange.name().to_owned(),
        chips: Vec::new(),
        head: Vec::new(),
        sections: Vec::new(),
    };
    let Some(x) = v.exchanges.get().exchanges.iter().find(|x| x.zone == z) else {
        doc.head.push(Block::Line(vec![Span::muted(
            "No such exchange in the views.",
        )]));
        return doc;
    };
    let zone = PageRef::Zone(z);
    doc.head.push(Block::Fields(vec![
        Field::text("Code", x.code.clone()),
        Field::new(
            "Zone",
            vec![
                Span::link(index.title(&zone), zone),
                Span::muted(format!("zone {}", x.zone_number)),
            ],
        ),
        Field::new(
            "Hub",
            vec![
                Span::text(x.hub_city.clone()),
                match names::place(v, x.hub_province) {
                    Some((n, p)) => Span::link(n, p),
                    None => Span::muted("?"),
                },
            ],
        ),
        Field::live("Listed", Live::ListedCount(z)),
        Field::new(
            "Confidence",
            vec![
                Span::Live(Live::ZoneConfidence(z)),
                Span::muted("investor confidence (5.1.2)"),
            ],
        ),
    ]));
    doc.sections = vec![
        SectionDoc {
            id: "index",
            blocks: vec![
                Block::Fields(vec![
                    Field::text("Index", x.index_name.clone()),
                    Field::new(
                        "Level",
                        vec![
                            Span::Live(Live::IndexLevel(z)),
                            Span::Live(Live::IndexChange(z)),
                        ],
                    ),
                    Field::new(
                        "Method",
                        vec![Span::muted(
                            "market-cap weighted, 1,000 at load, divisor kept on listings (5.14)",
                        )],
                    ),
                ]),
                Block::Chart(
                    index_chart(z, v, index),
                    Some((LiveChart::Index(z), v.exchanges.version())),
                ),
            ],
        },
        SectionDoc {
            id: "constituents",
            blocks: vec![Block::Table(TableDoc {
                id: "exchange.constituents".into(),
                model: constituents_model(z, v, index),
                live: Some(LiveTable::ExchangeConstituents(z)),
            })],
        },
        SectionDoc {
            id: "members",
            blocks: vec![Block::Table(TableDoc {
                id: "exchange.members".into(),
                model: members_model(z, v, index),
                live: None,
            })],
        },
    ];
    doc
}
