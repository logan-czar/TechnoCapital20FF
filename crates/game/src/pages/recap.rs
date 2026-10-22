//! The Quarterly recap (M9.5; spec 8 Quarterly recap; 20-ui 20.7.9; 21.6.2).
//!
//! A recap is built at the start of its quarter's pre-quarter-end week (spec 4.4 row 5, D164)
//! and the World keeps the last 20 (D433), each reachable as `recap/<quarter>`.
//!
//! - **World page**: the global phase and g_t, the industries by phase label, and the biggest
//!   expected beats and misses by projection (D280).
//! - **Company pages** (the watchlist companies): the anticipated earnings range, the expected
//!   reaction, the confidence and the outlook (phase label, loss quarters, rating and rating
//!   watch). No guidance choice (spec 8).
//!
//! Figures go through [`Cell::figure`] (D461): a company that does not publish shows its
//! projection, consensus and range as bands, and its expected surprise and reaction are worked
//! out from those estimates in the view (D420, D430), so the recap never shows a hidden value.
//!
//! The recap opens in a pane when its alert pauses the game (D513): the pane already showing a
//! recap, else a new pane. Clicking the alert opens it in the focused pane (D304).

use std::sync::Arc;

use bevy::prelude::*;
use sim::Notice;
use sim::SimViews;
use sim::recap::RatingWatch;
use sim::time::Quarter;
use sim::time::quarter::recap_tick;
use sim::views::recap::{ExpectedRow, RecapPage, RecapQuarter};
use sim::world::{AlertKind, AlertLevel, AlertPayload, CompanyId};

use super::live::{Filter, Live, LiveCtx, LiveModel, spawn_live_table, spawn_live_text};
use super::market::{fact, note, table_box};
use super::placeholder::{chip_row, link_group, page_header};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, ViewKey};
use crate::bridge::{RunnerControls, SimNotice, Views};
use crate::command::index::NameIndex;
use crate::table::format::{self, Unit};
use crate::table::{Cell, Column, GainUnit, TableModel, spawn_table_with_id};
use crate::ui::UiSystems;
use crate::ui::theme::{color, font};
use crate::workspace::{OpenPage, OpenTarget, Workspace, WorkspaceInput};

/// The quarters a recap page links to, at most (the World keeps 20, D433).
pub const RECAP_QUARTERS: usize = sim::recap::jobs::RECAPS_KEPT;

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Recap,
        PageSpec::new(&[ViewKey::Recap, ViewKey::IndustryRows])
            .sections(&[
                ("world", "World"),
                ("beats", "Biggest expected beats and misses"),
                ("companies", "Watchlist companies"),
            ])
            .refresh(Refresh::OnViewChange),
        recap_page,
    );
    app.add_systems(
        Update,
        open_on_alert
            .in_set(UiSystems::Input)
            .before(WorkspaceInput),
    );
}

/// The recap a page shows.
pub fn recap_of(v: &SimViews, q: Quarter) -> Option<&RecapQuarter> {
    v.recap.get().quarter(q)
}

/// The expected beats and misses (spec 8 "by projection"; D280): company, projection,
/// consensus, the surprise the projection would make, and which list.
pub fn expected_model(r: &RecapQuarter, index: &NameIndex) -> TableModel {
    let row = |e: &ExpectedRow, which: &str| {
        let p = PageRef::Company(e.company);
        vec![
            Cell::Text(which.into()),
            Cell::Link(p.clone(), index.title(&p)),
            Cell::figure(e.projection, Unit::Money),
            Cell::figure(e.consensus, Unit::Money),
            Cell::Gain(e.expected_surprise, GainUnit::Percent),
            Cell::Text(if e.projection.is_band() || e.consensus.is_band() {
                "estimates".into()
            } else {
                "-".into()
            }),
        ]
    };
    let w = &r.world;
    let rows = w
        .expected_beats
        .iter()
        .map(|e| row(e, "Beat"))
        .chain(w.expected_misses.iter().map(|e| row(e, "Miss")))
        .collect();
    TableModel::new(
        vec![
            Column::text("List", 50.0),
            Column::text("Company", 230.0),
            Column::number("Projection", 130.0).with_hint("The no-rolls projection (D164)"),
            Column::number("Consensus", 130.0),
            Column::number("Expected s", 90.0)
                .with_hint("(projection - consensus) / |consensus| (5.15; D280)"),
            Column::text("Figures", 80.0).with_hint("Bands for a company that does not publish"),
        ],
        rows,
    )
}

fn watch_text(w: Option<RatingWatch>) -> &'static str {
    match w {
        Some(RatingWatch::Upgrade) => "upgrade",
        Some(RatingWatch::Downgrade) => "downgrade",
        None => "-",
    }
}

/// The watchlist companies' pages of a recap (spec 8 Company page): one row each.
pub fn company_pages_model(
    r: &RecapQuarter,
    watchlist: &[CompanyId],
    index: &NameIndex,
) -> TableModel {
    let pages: Vec<&RecapPage> = watchlist.iter().filter_map(|&c| r.company(c)).collect();
    let rows = pages
        .iter()
        .map(|p| {
            let link = PageRef::Company(p.company);
            vec![
                Cell::Link(link.clone(), index.title(&link)),
                Cell::figure(p.range.0, Unit::Money),
                Cell::figure(p.range.1, Unit::Money),
                Cell::figure(p.expected.consensus, Unit::Money),
                Cell::Gain(p.expected.expected_surprise, GainUnit::Percent),
                Cell::Gain(p.expected_reaction, GainUnit::Percent),
                Cell::Ratio(p.confidence_factor),
                p.exchange_confidence
                    .map_or(Cell::Text("-".into()), |c| Cell::Int(c.round() as i64)),
                Cell::Text(p.outlook.label.name().into()),
                Cell::Int(i64::from(p.outlook.loss_quarters)),
                Cell::Rating(p.outlook.rating),
                Cell::Text(watch_text(p.outlook.rating_watch).into()),
                Cell::Text(if p.estimated { "estimates" } else { "-" }.into()),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Company", 220.0),
            Column::number("Range low", 120.0)
                .with_hint("The anticipated earnings range (5.16), low end"),
            Column::number("Range high", 120.0)
                .with_hint("The anticipated earnings range, high end"),
            Column::number("Consensus", 120.0),
            Column::number("Expected s", 80.0)
                .with_hint("The surprise the projection makes (5.15)"),
            Column::number("Reaction", 76.0)
                .with_hint("The expected price move at the release (5.15)"),
            Column::number("Conf.", 56.0).with_hint("The company's confidence factor (5.7)"),
            Column::number("Exch. conf.", 70.0)
                .with_hint("Its exchange's investor confidence (5.1.2)"),
            Column::text("Phase", 60.0).with_hint("Outlook: its industry's phase label"),
            Column::number("Losses", 56.0).with_hint("Outlook: loss quarters"),
            Column::text("Rating", 56.0),
            Column::text("Watch", 76.0).with_hint("Outlook: rating watch"),
            Column::text("Figures", 76.0),
        ],
        rows,
    )
}

fn recap_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    controls: Res<RunnerControls>,
) {
    let PageRef::Recap(q) = b.page else {
        return;
    };
    let v: &SimViews = &views;
    let recap = recap_of(v, q);
    page_header(
        &mut commands,
        b.head,
        &index.title(&b.page),
        PageKind::Recap.name(),
        if recap.is_some_and(|r| r.companies.iter().any(|p| p.estimated)) {
            "Companies that do not publish show estimate bands"
        } else {
            ""
        },
    );
    // Selectable by quarter: every recap kept, and this quarter's.
    let mut quarters: Vec<Quarter> = v
        .recap
        .get()
        .recaps
        .iter()
        .map(|r| r.world.quarter)
        .collect();
    let now = v.clock().date.quarter();
    if !quarters.contains(&now) {
        quarters.push(now);
    }
    let links: Vec<(String, PageRef)> = quarters
        .iter()
        .rev()
        .map(|&x| (x.to_string(), PageRef::Recap(x)))
        .collect();
    link_group(&mut commands, b.head, "Quarters", &links);
    let Some(r) = recap else {
        // A quarter before the game has no recap tick on the clock (it starts 1 Jan 2020).
        let first = Quarter { year: 2020, q: 1 };
        let when = (q >= first).then(|| recap_tick(q));
        let s = if let Some(when) = when.filter(|&w| w > v.clock().now) {
            format!(
                "The {q} recap opens in its pre-quarter-end week, on {}.",
                format::date(when.date())
            )
        } else {
            format!("No {q} recap is kept (the last {RECAP_QUARTERS} are).")
        };
        note(&mut commands, b.head, s);
        return;
    };
    let w = &r.world;
    if let Some(body) = b.section("world") {
        let row = chip_row(&mut commands, body);
        fact(
            &mut commands,
            row,
            "Global phase",
            w.phase.name().into(),
            color::CYAN,
        );
        fact(
            &mut commands,
            row,
            "g_t",
            format::gain(w.g_t, GainUnit::Percent),
            if w.g_t >= 0.0 {
                color::GAIN
            } else {
                color::LOSS
            },
        );
        fact(
            &mut commands,
            row,
            "Opened",
            format::date(recap_tick(q).date()),
            color::TEXT,
        );
        for (label, ids) in &w.industries_by_label {
            let links: Vec<(String, PageRef)> = ids
                .iter()
                .map(|&i| (index.title(&PageRef::Industry(i)), PageRef::Industry(i)))
                .collect();
            link_group(
                &mut commands,
                body,
                &format!("{} ({})", label.name(), ids.len()),
                &links,
            );
        }
    }
    if let Some(body) = b.section("beats") {
        let m = expected_model(r, &index);
        if m.is_empty() {
            note(
                &mut commands,
                body,
                "No quoted company expects a beat or a miss.",
            );
        } else {
            let boxed = table_box(&mut commands, body, m.len());
            spawn_table_with_id(&mut commands, boxed, Arc::new(m), "recap.expected");
        }
    }
    if let Some(body) = b.section("companies") {
        // Live on the runner controls, so a watchlist change shows on every quarter's page (v_recap
        // moves on one only for the latest recap's companies).
        let pages_of = move |c: &LiveCtx| {
            let watchlist: Vec<CompanyId> = c.controls.watchlist.iter().copied().collect();
            recap_of(c.views, q).map(|r| company_pages_model(r, &watchlist, c.index))
        };
        spawn_live_text(
            &mut commands,
            body,
            font::SMALL,
            color::TEXT_MUTED,
            Live::new(&[ViewKey::Recap], move |c| {
                LiveModel::Text(if pages_of(c).is_some_and(|m| !m.is_empty()) {
                    String::new()
                } else {
                    "No watchlist company has a page: add companies to the watchlist \
                     (Pdoomberg F2, click a row) to see their pages."
                        .into()
                })
            })
            .on_controls(),
            &views,
            &index,
            &controls,
        );
        let boxed = table_box(&mut commands, body, r.companies.len());
        spawn_live_table(
            &mut commands,
            boxed,
            "recap.companies",
            Live::new(&[ViewKey::Recap], move |c| {
                LiveModel::Table(
                    pages_of(c).unwrap_or_else(|| TableModel::new(Vec::new(), Vec::new())),
                )
            })
            .on_controls(),
            Filter::default(),
            &views,
            &index,
            &controls,
        );
    }
}

/// When the recap alert pauses the game in the pre-quarter-end week, the recap opens in a pane
/// (D513): the pane already on a recap, else a new pane, so the player's pages stay.
fn open_on_alert(
    mut notices: MessageReader<SimNotice>,
    views: Res<Views>,
    ws: Res<Workspace>,
    mut open: MessageWriter<OpenPage>,
) {
    for n in notices.read() {
        let Notice::Alert {
            kind: AlertKind::QuarterlyRecap,
            level: AlertLevel::Pause,
            payload,
        } = &n.0
        else {
            continue;
        };
        let q = match payload {
            AlertPayload::Quarter(q) => *q,
            _ => views.clock().date.quarter(),
        };
        let page = PageRef::Recap(q);
        let on_recap = ws
            .pane_ids()
            .into_iter()
            .find(|&p| ws.page(p).is_some_and(|x| x.kind() == PageKind::Recap));
        let target = match on_recap {
            Some(p) => OpenTarget::Pane(p),
            None => OpenTarget::NewPane,
        };
        open.write(OpenPage { page, target });
    }
}
