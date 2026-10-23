//! The Zone page (M9 B1; m9-plan section 1, spec 3.2.1, 5.1.2, 8 Financial zones): a financial
//! zone's number, base and effective credit spread, investor confidence, its exchange and
//! headline index (a link, the level, and a chart), GDP share and current effect, and its
//! member countries as a table.
//!
//! The index chart draws v_exchanges' daily closes from 2020 (D540), so a load shows the whole
//! history; the UI keeps no record of its own (D484 and D487 are superseded).

use bevy::prelude::*;
use sim::SimViews;
use sim::world::ZoneId;

use super::doc::{
    Block, Field, Live, LiveChart, PageDoc, SectionDoc, Span, TableDoc, bps, spawn_doc,
};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, SectionSpec, ViewKey};
use crate::bridge::Views;
use crate::chart::{ChartModel, Series, ValueFormat};
use crate::command::index::NameIndex;
use crate::config::UiConfig;
use crate::table::format;
use crate::table::{Cell, Column, TableModel};
use crate::ui::theme::color;

pub const SECTIONS: &[SectionSpec] = &[
    ("economy", "Economy"),
    ("index", "Index"),
    ("members", "Member countries"),
    ("provinces", "Member provinces"),
];

/// Rebuilds on the monthly views only; the daily v_zones figures (confidence, spread, GDP
/// share, effect, last close) and the index follow by themselves ([`Live`], D485).
pub const VIEWS: &[ViewKey] = &[ViewKey::Countries, ViewKey::Rates, ViewKey::ProvinceCards];

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Zone,
        PageSpec::new(VIEWS)
            .sections(SECTIONS)
            .refresh(Refresh::OnViewChange)
            .patchable(),
        zone_page,
    );
}

fn zone_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    cfg: Res<UiConfig>,
) {
    let PageRef::Zone(z) = b.page else {
        return;
    };
    let doc = zone_doc(z, &views, &index);
    spawn_doc(&mut commands, &b, &doc, &views, &cfg, None);
}

/// An exchange's index chart: v_exchanges' daily closes from 2020 as a line (D540), with
/// today's level (v_quotes) as a reference line.
pub fn index_chart(z: ZoneId, v: &SimViews, index: &NameIndex) -> ChartModel {
    let name = v.zones.get().get(z).map_or_else(
        || index.title(&PageRef::Exchange(z)),
        |r| r.index_name.clone(),
    );
    let exchanges = v.exchanges.get();
    let closes: Vec<_> = exchanges
        .of_zone(z)
        .map(|e| e.closes.iter().copied().collect())
        .unwrap_or_default();
    let level = v.quotes.get().index(z).and_then(|i| i.level);
    ChartModel {
        title: format!("{name}: daily closes ({})", closes.len()),
        labels: closes.iter().map(|c| format::date(c.date)).collect(),
        series: vec![Series::Line {
            name: name.clone(),
            values: closes.iter().map(|c| c.level).collect(),
            color: color::CYAN,
        }],
        format: ValueFormat::Number,
        reference: level.map(|l| (l, color::AMBER.with_alpha(0.6))),
    }
}

/// The member countries table (also the Exchange page's).
pub fn members_model(z: ZoneId, v: &SimViews, index: &NameIndex) -> TableModel {
    let countries = v.countries.get();
    let rows = v
        .zones
        .get()
        .get(z)
        .map(|r| r.members.as_slice())
        .unwrap_or_default()
        .iter()
        .filter_map(|&c| countries.get(c))
        .map(|c| {
            let p = PageRef::Country(c.id);
            vec![
                Cell::Link(p.clone(), index.title(&p)),
                Cell::Text(c.iso3.clone()),
                Cell::Text(c.superregion.clone()),
                Cell::Rating(c.sovereign_rating),
                Cell::Text(bps(c.sovereign_spread)),
                Cell::Percent(c.corp_tax_rate),
                Cell::Money(c.gdp_usd),
                Cell::Int(c.hq_companies.len() as i64),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Country", 190.0),
            Column::text("ISO3", 50.0),
            Column::text("Superregion", 150.0),
            Column::text("Sovereign", 70.0).with_hint("Sovereign rating (5.1.2)"),
            Column::number("Spread", 80.0).with_hint("Sovereign spread"),
            Column::number("Tax", 60.0).with_hint("Corporate tax rate (5.11)"),
            Column::number("GDP", 90.0),
            Column::number("HQs", 50.0).with_hint("Companies with their HQ here"),
        ],
        rows,
    )
}

/// The whole Zone page as data.
pub fn zone_doc(z: ZoneId, v: &SimViews, index: &NameIndex) -> PageDoc {
    let page = PageRef::Zone(z);
    let mut doc = PageDoc {
        page: page.clone(),
        title: index.title(&page),
        kind: PageKind::Zone.name().to_owned(),
        chips: Vec::new(),
        head: Vec::new(),
        sections: Vec::new(),
    };
    let Some(r) = v.zones.get().get(z) else {
        doc.head
            .push(Block::Line(vec![Span::muted("No such zone in the views.")]));
        return doc;
    };
    let ex = PageRef::Exchange(z);
    doc.head.push(Block::Fields(vec![
        Field::text("Zone", format!("{} ({})", r.number, r.key)),
        Field::new(
            "Exchange",
            vec![
                Span::link(index.title(&ex), ex.clone()),
                Span::muted(r.exchange_code.clone()),
            ],
        ),
        Field::cell("Members", Cell::Int(r.members.len() as i64)),
    ]));
    doc.sections = vec![
        SectionDoc {
            id: "economy",
            blocks: vec![Block::Fields(vec![
                Field::new(
                    "Credit spread",
                    vec![
                        Span::Live(Live::ZoneSpread(z)),
                        Span::muted(format!("effective; base {}", bps(r.credit_spread_base))),
                    ],
                ),
                Field::new(
                    "Confidence",
                    vec![
                        Span::Live(Live::ZoneConfidence(z)),
                        Span::muted("investor confidence (-100 to +100)"),
                    ],
                ),
                Field::live("GDP share", Live::ZoneGdpShare(z)),
                Field::new(
                    "Effect",
                    vec![
                        Span::Live(Live::ZoneEffect(z)),
                        Span::muted("a year: intensity x g(t - lag) plus own shocks (5.1)"),
                    ],
                ),
            ])],
        },
        SectionDoc {
            id: "index",
            blocks: vec![
                Block::Fields(vec![
                    Field::new(
                        "Index",
                        vec![
                            Span::text(r.index_name.clone()),
                            Span::muted("on"),
                            Span::link(index.title(&ex), ex),
                        ],
                    ),
                    Field::new(
                        "Level",
                        vec![
                            Span::Live(Live::IndexLevel(z)),
                            Span::Live(Live::IndexChange(z)),
                        ],
                    ),
                    Field::live("Last close", Live::IndexClose(z)),
                ]),
                Block::Chart(
                    index_chart(z, v, index),
                    Some((LiveChart::Index(z), v.exchanges.version())),
                ),
            ],
        },
        SectionDoc {
            id: "members",
            blocks: vec![Block::Table(TableDoc {
                id: "zone.members".into(),
                model: members_model(z, v, index),
                live: None,
            })],
        },
        // The member countries' provinces as links (M8.7, D707).
        SectionDoc {
            id: "provinces",
            blocks: vec![Block::Table(TableDoc {
                id: "zone.provinces".into(),
                model: super::province::provinces_model(&r.members, v, index),
                live: None,
            })],
        },
    ];
    doc
}
