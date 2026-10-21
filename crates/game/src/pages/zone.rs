//! The Zone page (M9 B1; m9-plan section 1, spec 3.2.1, 5.1.2, 8 Financial zones): a financial
//! zone's number, base and effective credit spread, investor confidence, its exchange and
//! headline index (a link, the level, and a chart), GDP share and current effect, and its
//! member countries as a table.
//!
//! No view keeps an index's history (v_zones and v_exchanges give today's level), so the UI
//! records each daily close it sees into [`IndexHistory`] while the game runs (D484; a request
//! for the sim). The record reads only v_zones (spec 9).

use bevy::prelude::*;
use sim::SimViews;
use sim::time::Date;
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
];

/// Rebuilds on the monthly views only; the daily confidence, spread and index follow by
/// themselves ([`Live`]).
pub const VIEWS: &[ViewKey] = &[ViewKey::Countries, ViewKey::Rates, ViewKey::Exchanges];

/// The most daily closes the record keeps per exchange: 10 years (the long chart view).
pub const INDEX_HISTORY_DAYS: usize = 3660;

/// Each exchange's headline index closes the UI has seen (D484): one point per day, recorded
/// from v_zones when it is rebuilt at 00:00, since the game started or was loaded.
#[derive(Resource, Debug, Default)]
pub struct IndexHistory {
    /// By zone index: (date, close), oldest first.
    pub closes: Vec<Vec<(Date, f64)>>,
    version: u64,
    seen_zones: u64,
}

impl IndexHistory {
    /// Bumped on every new point.
    pub fn version(&self) -> u64 {
        self.version
    }

    pub fn of(&self, z: ZoneId) -> &[(Date, f64)] {
        self.closes.get(z.0 as usize).map_or(&[], Vec::as_slice)
    }

    /// Takes v_zones' closes if it was rebuilt since the last look; a date before the last
    /// recorded (a new game or a load) starts the record again.
    pub fn record(&mut self, v: &SimViews) -> bool {
        let ver = v.zones.version();
        if ver == self.seen_zones {
            return false;
        }
        self.seen_zones = ver;
        let today = v.clock().date;
        let zones = &v.zones.get().zones;
        if self.closes.len() != zones.len() {
            self.closes = vec![Vec::new(); zones.len()];
        }
        let mut moved = false;
        for (z, h) in zones.iter().zip(self.closes.iter_mut()) {
            if h.last().is_some_and(|&(d, _)| d > today) {
                h.clear();
            }
            let Some(close) = z.index_close else {
                continue;
            };
            match h.last_mut() {
                Some(last) if last.0 == today => {
                    if last.1 != close {
                        last.1 = close;
                        moved = true;
                    }
                }
                _ => {
                    h.push((today, close));
                    moved = true;
                }
            }
            if h.len() > INDEX_HISTORY_DAYS {
                h.remove(0);
            }
        }
        if moved {
            self.version += 1;
        }
        moved
    }
}

/// Records the index closes (runs every frame; cheap when v_zones has not moved).
pub fn record_index_history(views: Res<Views>, mut h: ResMut<IndexHistory>) {
    // Reading through `ResMut` does not mark it changed; only a new point does.
    if views.is_changed() && views.zones.version() != h.seen_zones {
        h.record(&views);
    }
}

pub fn register(app: &mut App) {
    app.init_resource::<IndexHistory>().register_page(
        PageKind::Zone,
        PageSpec::new(VIEWS)
            .sections(SECTIONS)
            .refresh(Refresh::OnViewChange),
        zone_page,
    );
}

fn zone_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    history: Res<IndexHistory>,
    cfg: Res<UiConfig>,
) {
    let PageRef::Zone(z) = b.page else {
        return;
    };
    let doc = zone_doc(z, &views, &index, &history);
    spawn_doc(&mut commands, &b, &doc, &views, &cfg, None);
}

/// An exchange's index chart: the recorded daily closes as a line, with today's level as a
/// reference line (so a new game's single point still draws).
pub fn index_chart(z: ZoneId, v: &SimViews, h: &IndexHistory, index: &NameIndex) -> ChartModel {
    let name = v.zones.get().get(z).map_or_else(
        || index.title(&PageRef::Exchange(z)),
        |r| r.index_name.clone(),
    );
    let pts = h.of(z);
    let level = v.quotes.get().index(z).and_then(|i| i.level);
    ChartModel {
        title: format!("{name}: {} daily closes recorded this session", pts.len()),
        labels: pts.iter().map(|(d, _)| format::date(*d)).collect(),
        series: vec![Series::Line {
            name: name.clone(),
            values: pts.iter().map(|p| p.1).collect(),
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
pub fn zone_doc(z: ZoneId, v: &SimViews, index: &NameIndex, h: &IndexHistory) -> PageDoc {
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
                        Span::muted("investor confidence, -100 to +100"),
                    ],
                ),
                Field::cell("GDP share", Cell::Percent(r.gdp_share)),
                Field::new(
                    "Effect",
                    vec![
                        Span::Cell(Cell::Gain(r.effect, crate::table::GainUnit::Percent)),
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
                    Field::new(
                        "Last close",
                        vec![match r.index_close {
                            Some(c) => Span::Cell(Cell::Number(c)),
                            None => Span::muted("no listing"),
                        }],
                    ),
                ]),
                Block::Chart(index_chart(z, v, h, index), Some(LiveChart::Index(z))),
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
    ];
    doc
}
