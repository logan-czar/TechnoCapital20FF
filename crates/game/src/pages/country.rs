//! The Country page (M9 B1; spec 3.2, 9.2 `get_country`): name, iso3, superregion, financial
//! zone (a link), sovereign rating and spread, corporate tax rate, GDP, and the companies
//! headquartered there as a table. A company that does not publish shows bands (D461).

use bevy::prelude::*;
use sim::SimViews;
use sim::world::CountryId;

use super::doc::{Block, Field, PageDoc, SectionDoc, Span, TableDoc, bps, spawn_doc};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, SectionSpec, ViewKey};
use crate::bridge::Views;
use crate::command::index::NameIndex;
use crate::config::UiConfig;
use crate::table::{Cell, Column, TableModel, Unit};

pub const SECTIONS: &[SectionSpec] = &[("economy", "Economy"), ("companies", "HQ'd companies")];

pub const VIEWS: &[ViewKey] = &[ViewKey::Countries, ViewKey::Rates, ViewKey::CompanyRows];

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Country,
        PageSpec::new(VIEWS)
            .sections(SECTIONS)
            .refresh(Refresh::OnViewChange),
        country_page,
    );
}

fn country_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    cfg: Res<UiConfig>,
) {
    let PageRef::Country(c) = b.page else {
        return;
    };
    let doc = country_doc(c, &views, &index);
    spawn_doc(&mut commands, &b, &doc, &views, &cfg, None);
}

/// The HQ'd companies of a country (v_countries' list, rows from v_company_row).
pub fn hq_model(c: CountryId, v: &SimViews, index: &NameIndex) -> TableModel {
    let rows_by_id = &v.company_rows.get().rows;
    let link = |p: PageRef| Cell::Link(p.clone(), index.title(&p));
    let rows = v
        .countries
        .get()
        .get(c)
        .map(|r| r.hq_companies.as_slice())
        .unwrap_or_default()
        .iter()
        .filter_map(|&co| {
            rows_by_id
                .binary_search_by_key(&co, |r| r.id)
                .ok()
                .map(|i| &rows_by_id[i])
        })
        .map(|r| {
            vec![
                link(PageRef::Company(r.id)),
                Cell::Text(if r.ticker.is_empty() || !r.public {
                    "-".into()
                } else {
                    r.ticker.clone()
                }),
                link(PageRef::Industry(r.industry)),
                r.exchange
                    .map_or(Cell::Text("private".into()), |z| link(PageRef::Exchange(z))),
                Cell::figure(r.revenue_ttm, Unit::Money),
                Cell::figure(r.value, Unit::Money),
                Cell::Rating(r.rating),
                Cell::Text(super::company::status_text(r.status).into()),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Company", 220.0),
            Column::text("Ticker", 60.0),
            Column::text("Industry", 170.0),
            Column::text("Exchange", 170.0),
            Column::number("Revenue TTM", 130.0).with_hint("A band while not published"),
            Column::number("Value", 130.0).with_hint("A band while not published"),
            Column::text("Rating", 60.0),
            Column::text("Status", 80.0),
        ],
        rows,
    )
}

/// The whole Country page as data.
pub fn country_doc(c: CountryId, v: &SimViews, index: &NameIndex) -> PageDoc {
    let page = PageRef::Country(c);
    let mut doc = PageDoc {
        page: page.clone(),
        title: index.title(&page),
        kind: PageKind::Country.name().to_owned(),
        chips: Vec::new(),
        head: Vec::new(),
        sections: Vec::new(),
    };
    let Some(r) = v.countries.get().get(c) else {
        doc.head.push(Block::Line(vec![Span::muted(
            "No such country in the views.",
        )]));
        return doc;
    };
    let zone = PageRef::Zone(r.zone);
    doc.head.push(Block::Fields(vec![
        Field::text("ISO3", r.iso3.clone()),
        Field::text("Superregion", r.superregion.clone()),
        Field::link("Zone", index.title(&zone), zone),
        Field::link(
            "Exchange",
            index.title(&PageRef::Exchange(r.zone)),
            PageRef::Exchange(r.zone),
        ),
    ]));
    let base = v.rates.get().base_rate;
    doc.sections = vec![
        SectionDoc {
            id: "economy",
            blocks: vec![Block::Fields(vec![
                Field::cell("Sovereign rating", Cell::Rating(r.sovereign_rating)),
                Field::new(
                    "Sovereign spread",
                    vec![
                        Span::text(bps(r.sovereign_spread)),
                        Span::muted(format!("over the base rate {}", bps(base))),
                    ],
                ),
                Field::cell("Tax rate", Cell::Percent(r.corp_tax_rate)),
                Field::cell("GDP", Cell::Money(r.gdp_usd)),
                Field::cell("HQ'd companies", Cell::Int(r.hq_companies.len() as i64)),
            ])],
        },
        SectionDoc {
            id: "companies",
            blocks: vec![Block::Table(TableDoc {
                id: "country.companies".into(),
                model: hq_model(c, v, index),
                live: None,
            })],
        },
    ];
    doc
}
