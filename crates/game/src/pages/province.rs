//! The Province page (build-plan M8.7; spec 3.3, 8 Map row province card, 9.2 `get_province`;
//! m8-plan 2 "a hover card and a page"; D707): a province's country, region, zone, Metro and key
//! city (links), its development tracks and largest track, its resource, terrain, coast and
//! contested tag, the companies headquartered there and the business units based there as
//! tables with links, and its neighbours. A company that does not publish shows bands (D461):
//! the figures are v_company_row's and v_units', never a second path to a truth (D631).

use bevy::prelude::*;
use sim::SimViews;
use sim::map::BorderKind;
use sim::views::province_cards::{LargestTrack, ProvinceCard};
use sim::world::ProvinceId;

use super::doc::{Block, Field, PageDoc, SectionDoc, Span, TableDoc, spawn_doc};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, SectionSpec, ViewKey};
use crate::bridge::Views;
use crate::command::index::NameIndex;
use crate::config::UiConfig;
use crate::table::{Cell, Column, TableModel, Unit};

pub const SECTIONS: &[SectionSpec] = &[
    ("development", "Development"),
    ("land", "Land"),
    ("hqs", "HQ'd companies"),
    ("units", "Business units"),
    ("neighbors", "Neighbours"),
];

/// The monthly views it rebuilds on (spec 9.4); the map's are static.
pub const VIEWS: &[ViewKey] = &[
    ViewKey::ProvinceCards,
    ViewKey::Units,
    ViewKey::CompanyRows,
    ViewKey::MapStatic,
    ViewKey::MapLayers,
    ViewKey::Places,
];

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Province,
        PageSpec::new(VIEWS)
            .sections(SECTIONS)
            .refresh(Refresh::OnViewChange),
        province_page,
    );
}

fn province_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    cfg: Res<UiConfig>,
) {
    let PageRef::Province(p) = b.page else {
        return;
    };
    let doc = province_doc(p, &views, &index);
    spawn_doc(&mut commands, &b, &doc, &views, &cfg, None);
}

fn link(index: &NameIndex, p: PageRef) -> Cell {
    Cell::Link(p.clone(), index.title(&p))
}

/// The companies headquartered in the province (v_province_card's list, rows from
/// v_company_row: bands while a company does not publish).
pub fn hq_model(c: &ProvinceCard, v: &SimViews, index: &NameIndex) -> TableModel {
    let rows_by_id = &v.company_rows.get().rows;
    let rows = c
        .hqs
        .iter()
        .filter_map(|&co| {
            rows_by_id
                .binary_search_by_key(&co, |r| r.id)
                .ok()
                .map(|i| &rows_by_id[i])
        })
        .map(|r| {
            vec![
                link(index, PageRef::Company(r.id)),
                link(index, PageRef::Industry(r.industry)),
                r.exchange.map_or(Cell::Text("private".into()), |z| {
                    link(index, PageRef::Exchange(z))
                }),
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
            Column::text("Industry", 170.0),
            Column::text("Exchange", 150.0),
            Column::number("Revenue TTM", 130.0).with_hint("A band while not published"),
            Column::number("Value", 130.0).with_hint("A band while not published"),
            Column::text("Rating", 60.0),
            Column::text("Status", 80.0),
        ],
        rows,
    )
}

/// The business units based in the province (v_province_card's list, rows from v_units: bands
/// while a company does not publish, D420, D436).
pub fn units_model(c: &ProvinceCard, v: &SimViews, index: &NameIndex) -> TableModel {
    let units = v.units.get();
    let rows = c
        .units
        .iter()
        .filter_map(|&u| units.get(u))
        .map(|u| {
            vec![
                link(index, PageRef::Company(u.company)),
                link(index, PageRef::Industry(u.industry)),
                Cell::figure(u.gross_assets, Unit::Money),
                Cell::figure(u.asset_book, Unit::Money),
                Cell::figure(u.revenue_m, Unit::Money),
                Cell::figure(u.productivity, Unit::Number),
                Cell::Percent(u.growth_plan),
                Cell::Percent(u.rd_plan),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Company", 220.0),
            Column::text("Industry", 170.0),
            Column::number("Assets", 120.0).with_hint("Business assets at cost (3.6)"),
            Column::number("Book", 120.0),
            Column::number("Revenue/mo", 120.0).with_hint("Last month's revenue"),
            Column::number("Productivity", 100.0),
            Column::number("Growth", 70.0).with_hint("The locked plan's growth a year"),
            Column::number("R&D", 60.0),
        ],
        rows,
    )
}

/// The province's neighbours (v_map_static, with lane P's map).
pub fn neighbors_model(p: ProvinceId, v: &SimViews, index: &NameIndex) -> TableModel {
    let places = v.places.get();
    let rows = v
        .map_static
        .get()
        .neighbors(p)
        .iter()
        .map(|n| {
            let country = places.province(n.province).map(|x| x.country);
            vec![
                link(index, PageRef::Province(n.province)),
                country.map_or(Cell::Unknown, |c| link(index, PageRef::Country(c))),
                Cell::Text(
                    match n.kind {
                        BorderKind::Land => "land",
                        BorderKind::Sea => "sea",
                    }
                    .into(),
                ),
                Cell::Int(n.border_px as i64),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Province", 220.0),
            Column::text("Country", 170.0),
            Column::text("Border", 60.0),
            Column::number("Shared px", 90.0).with_hint("The shared edge in map pixels"),
        ],
        rows,
    )
}

/// The whole Province page as data.
pub fn province_doc(p: ProvinceId, v: &SimViews, index: &NameIndex) -> PageDoc {
    let page = PageRef::Province(p);
    let mut doc = PageDoc {
        page: page.clone(),
        title: index.title(&page),
        kind: PageKind::Province.name().to_owned(),
        chips: Vec::new(),
        head: Vec::new(),
        sections: Vec::new(),
    };
    let Some(c) = v.province_cards.get().get(p) else {
        doc.head.push(Block::Line(vec![Span::muted(
            "No such province in the views.",
        )]));
        return doc;
    };
    let country = PageRef::Country(c.country);
    let mut head = vec![
        Field::text("Id", c.key.clone()),
        Field::link("Country", index.title(&country), country),
    ];
    if let Some(z) = v.map_layers.get().zone_of(p) {
        let zone = PageRef::Zone(z);
        head.push(Field::link("Zone", index.title(&zone), zone));
    }
    head.push(Field::text(
        "Region",
        if c.area == c.region || c.area.is_empty() {
            c.region.clone()
        } else {
            format!("{} ({})", c.region, c.area)
        },
    ));
    head.push(Field::text(
        "Metro",
        c.metro.clone().unwrap_or_else(|| "none".into()),
    ));
    head.push(Field::text(
        "Key city",
        c.key_city.clone().unwrap_or_else(|| "none".into()),
    ));
    doc.head.push(Block::Fields(head));
    if v.map_static.get().shape(p).is_none() {
        doc.head.push(Block::Line(vec![Span::muted(
            "Not on the map yet: lane P draws this province's region later.",
        )]));
    }
    let largest = match c.largest_track {
        LargestTrack::Commerce => "Commerce",
        LargestTrack::Industry => "Industry",
        LargestTrack::Both => "Commerce and Industry (a tie counts for both, 10.3.1)",
    };
    doc.sections = vec![
        SectionDoc {
            id: "development",
            blocks: vec![Block::Fields(vec![
                Field::cell("Commerce", Cell::Int(i64::from(c.commerce))),
                Field::cell("Industry", Cell::Int(i64::from(c.industry))),
                Field::cell("Population", Cell::Int(i64::from(c.population))),
                Field::new(
                    "Total",
                    vec![
                        Span::text(c.total.to_string()),
                        Span::muted("of 90; each track 1 to 30 (3.3)"),
                    ],
                ),
                Field::text("Largest track", largest),
            ])],
        },
        SectionDoc {
            id: "land",
            blocks: vec![Block::Fields({
                let mut f = vec![
                    Field::text("Resource", c.resource.clone()),
                    Field::text("Terrain", c.terrain.clone()),
                    Field::text("Coastal", if c.coastal { "yes" } else { "no" }),
                    Field::text("City rank", c.city_rank.clone()),
                ];
                if let Some(t) = &c.contested {
                    f.push(Field::text("Contested", t.clone()));
                }
                f
            })],
        },
        SectionDoc {
            id: "hqs",
            blocks: vec![Block::Table(TableDoc {
                id: "province.hqs".into(),
                model: hq_model(c, v, index),
                live: None,
            })],
        },
        SectionDoc {
            id: "units",
            blocks: vec![Block::Table(TableDoc {
                id: "province.units".into(),
                model: units_model(c, v, index),
                live: None,
            })],
        },
        SectionDoc {
            id: "neighbors",
            blocks: vec![Block::Table(TableDoc {
                id: "province.neighbors".into(),
                model: neighbors_model(p, v, index),
                live: None,
            })],
        },
    ];
    doc
}

/// The provinces of a set of countries as a table (the Country and Zone pages' member
/// provinces, D707): link, country, region, the three tracks, Metro, HQ and unit counts.
pub fn provinces_model(
    countries: &[sim::world::CountryId],
    v: &SimViews,
    index: &NameIndex,
) -> TableModel {
    let rows = v
        .province_cards
        .get()
        .cards
        .iter()
        .filter(|c| countries.contains(&c.country))
        .map(|c| {
            vec![
                link(index, PageRef::Province(c.id)),
                link(index, PageRef::Country(c.country)),
                Cell::Text(c.region.clone()),
                Cell::Int(i64::from(c.commerce)),
                Cell::Int(i64::from(c.industry)),
                Cell::Int(i64::from(c.population)),
                Cell::Text(c.metro.clone().unwrap_or_default()),
                Cell::Int(c.hqs.len() as i64),
                Cell::Int(c.units.len() as i64),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Province", 220.0),
            Column::text("Country", 150.0),
            Column::text("Region", 150.0),
            Column::number("C", 40.0).with_hint("Commerce (3.3)"),
            Column::number("I", 40.0).with_hint("Industry (3.3)"),
            Column::number("P", 40.0).with_hint("Population (3.3)"),
            Column::text("Metro", 130.0),
            Column::number("HQs", 50.0),
            Column::number("Units", 50.0),
        ],
        rows,
    )
}
