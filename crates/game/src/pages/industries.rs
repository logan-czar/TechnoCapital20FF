//! The Industries table and an industry's page (M9.3, M9.7; spec 8 Industries and Startups and
//! listings rows; 20-ui 20.7.6).
//!
//! - **Industries**: a header strip with the global phase and g_t (batch 150), then the table of
//!   42: demand, supply, S, M, phase label, long-term growth, this quarter's growth as a yearly
//!   rate, the fringe share, the births column (the last 4 quarters, D428) and the top 5
//!   companies, each a link.
//! - **An industry**: its figures, the 20-quarter chart of demand vs supply, the quarterly
//!   growth bars against the long-term rate, the company list with the fringe row, the startups
//!   born in it and its latest headlines.
//!
//! Every figure goes through [`Cell::figure`] or [`format::figure_in`] (D461): an industry with
//! one or two companies that do not publish shows its supply, S, M and fringe as bands (D432),
//! and its history's supply too (D437).

use std::sync::Arc;

use bevy::prelude::*;
use sim::SimViews;
use sim::views::estimate::Figure;
use sim::world::IndustryId;

use super::live::{Filter, Live, LiveModel, spawn_live_table, spawn_live_text};
use super::market::{fact, figure_color, note, table_box};
use super::placeholder::{chip_row, link_group, page_header};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, ViewKey};
use crate::bridge::{RunnerControls, Views};
use crate::chart::{ChartModel, Series, ValueFormat, spawn_chart};
use crate::command::index::{NameIndex, event_name};
use crate::table::format::{self, Unit};
use crate::table::{Cell, Column, GainUnit, TableModel};
use crate::ui::theme::{color, font};

/// The detail chart's quarters (spec 8: a 20-quarter chart; D112).
pub const CHART_QUARTERS: usize = 20;
/// Headlines an industry page lists.
pub const INDUSTRY_HEADLINES: usize = 12;
/// The top companies the table shows (spec 8: top 5).
pub const TOP_SHOWN: usize = sim::views::industry_rows::TOP_COMPANIES;

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Industries,
        PageSpec::new(&[ViewKey::IndustryRows, ViewKey::Cycle, ViewKey::Births]),
        industries_page,
    );
    app.register_page(
        PageKind::Industry,
        PageSpec::new(&[
            ViewKey::IndustryRows,
            ViewKey::IndustryDetail,
            ViewKey::Births,
        ])
        .sections(&[
            ("figures", "Figures"),
            ("chart", "Demand vs supply"),
            ("growth", "Growth against the long-term rate"),
            ("companies", "Companies"),
            ("births", "Startups"),
            ("news", "Headlines"),
        ])
        .refresh(Refresh::OnViewChange),
        industry_page,
    );
}

/// The header strip (spec 8 Industries, batch 150): the global phase, g_t and quarters left,
/// the AI stage, and the quarters the births column counts.
pub fn strip_text(v: &SimViews) -> String {
    let c = v.cycle.get();
    let b = v.births.get();
    let span = match (
        b.births_column_quarters.first(),
        b.births_column_quarters.last(),
    ) {
        (Some(a), Some(z)) => format!("{a} to {z}"),
        _ => "-".into(),
    };
    format!(
        "Global phase {} | g_t {} a year | {} quarter{} left | AI stage {} | births column {span}",
        c.phase.name(),
        format::gain(c.g_t, GainUnit::Percent),
        c.quarters_left,
        if c.quarters_left == 1 { "" } else { "s" },
        c.ai_stage.name(),
    )
}

/// The table of 42 (spec 8 Industries; M9.7 births column).
pub fn industries_model(v: &SimViews, index: &NameIndex) -> TableModel {
    let births = v.births.get();
    let link = |p: PageRef| Cell::Link(p.clone(), index.title(&p));
    let rows = v
        .industry_rows
        .get()
        .rows
        .iter()
        .map(|r| {
            let mut row = vec![
                link(PageRef::Industry(r.id)),
                Cell::Text(r.sector.clone()),
                Cell::Money(r.demand),
                Cell::figure(r.supply, Unit::Money),
                Cell::figure(r.supply_ratio, Unit::Ratio),
                Cell::figure(r.market_factor, Unit::Ratio),
                Cell::Text(r.phase_label.name().into()),
                Cell::Percent(r.lt),
                Cell::Gain(r.growth_annual, GainUnit::Percent),
                Cell::figure(r.fringe_share, Unit::Percent),
                Cell::Int(births.births_last_four_quarters(r.id) as i64),
            ];
            for i in 0..TOP_SHOWN {
                row.push(
                    r.top_companies
                        .get(i)
                        .map_or(Cell::Text("-".into()), |&c| link(PageRef::Company(c))),
                );
            }
            row
        })
        .collect();
    let mut cols = vec![
        Column::text("Industry", 200.0),
        Column::text("Sector", 120.0),
        Column::number("Demand", 80.0).with_hint("Effective demand, USD a year (spec 5.1)"),
        Column::number("Supply", 110.0)
            .with_hint("USD a year (spec 5.2); a band in an estimated industry (D432)"),
        Column::number("S", 90.0).with_hint("Supply over demand"),
        Column::number("M", 90.0).with_hint("The market factor (spec 5.4)"),
        Column::text("Phase", 60.0).with_hint("The phase label (spec 5.1)"),
        Column::number("Long-term", 76.0).with_hint("The long-term growth rate, a year"),
        Column::number("Growth", 70.0)
            .with_hint("This quarter's growth as a yearly rate, (1 + q)^4 - 1 (spec 8)"),
        Column::number("Fringe", 100.0).with_hint("The fringe's share of supply (spec 5.3)"),
        Column::number("Births", 56.0).with_hint("Companies born here in the last 4 quarters"),
    ];
    for i in 0..TOP_SHOWN {
        cols.push(
            Column::text(&format!("Top {}", i + 1), 150.0)
                .with_hint("By last month's revenue as shown (bands by their estimate, D420)"),
        );
    }
    TableModel::new(cols, rows)
}

fn industries_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    controls: Res<RunnerControls>,
) {
    let n = views.industry_rows.get().rows.len();
    let estimated = views
        .industry_rows
        .get()
        .rows
        .iter()
        .filter(|r| r.estimated)
        .count();
    page_header(
        &mut commands,
        b.head,
        PageKind::Industries.name(),
        &format!("{n} industries"),
        &if estimated > 0 {
            format!("{estimated} estimated: supply, S, M and fringe as bands (D432)")
        } else {
            String::new()
        },
    );
    spawn_live_text(
        &mut commands,
        b.head,
        font::BODY,
        color::CYAN,
        Live::new(&[ViewKey::Cycle, ViewKey::Births], |c| {
            LiveModel::Text(strip_text(c.views))
        }),
        &views,
        &index,
        &controls,
    );
    spawn_live_table(
        &mut commands,
        b.tail,
        "industries",
        Live::new(&[ViewKey::IndustryRows, ViewKey::Births], |c| {
            LiveModel::Table(industries_model(c.views, c.index))
        }),
        Filter::default(),
        &views,
        &index,
        &controls,
    );
}

/// The 20-quarter chart of demand vs supply (spec 8; D112); supply is a band strip in the
/// quarters the industry was estimated (D437, D466).
pub fn demand_supply_chart(v: &SimViews, id: IndustryId) -> Option<ChartModel> {
    let d = v.industry_detail.get().get(id)?;
    let start = d.history.len().saturating_sub(CHART_QUARTERS);
    let q = &d.history[start..];
    if q.is_empty() {
        return None;
    }
    let supply: Vec<Figure> = q.iter().map(|h| h.supply).collect();
    let mut series = vec![Series::Line {
        name: "demand".into(),
        values: q.iter().map(|h| h.demand).collect(),
        color: color::CYAN,
    }];
    series.extend(Series::figures("supply", &supply, color::AMBER));
    Some(ChartModel {
        title: format!("Demand vs supply, last {} quarters", q.len()),
        labels: q.iter().map(|h| h.quarter.to_string()).collect(),
        series,
        format: ValueFormat::Money,
        reference: None,
    })
}

/// The quarterly growth bars, each as a yearly rate `(1 + q_growth)^4 - 1` as the table shows
/// it (spec 8), against the long-term rate line of each quarter.
pub fn growth_chart(v: &SimViews, id: IndustryId) -> Option<ChartModel> {
    let d = v.industry_detail.get().get(id)?;
    let start = d.history.len().saturating_sub(CHART_QUARTERS);
    let q = &d.history[start..];
    if q.is_empty() {
        return None;
    }
    Some(ChartModel {
        title: "Quarterly growth (a year) against the long-term rate".into(),
        labels: q.iter().map(|h| h.quarter.to_string()).collect(),
        series: vec![
            Series::Bars {
                name: "growth".into(),
                values: q.iter().map(|h| (1.0 + h.q_growth).powi(4) - 1.0).collect(),
                color: None,
            },
            Series::Line {
                name: "long-term".into(),
                values: q.iter().map(|h| h.lt).collect(),
                color: color::AMBER,
            },
        ],
        format: ValueFormat::Percent,
        reference: None,
    })
}

/// The company list (spec 8 detail view) with the fringe row last (spec 5.3).
pub fn companies_model(v: &SimViews, index: &NameIndex, id: IndustryId) -> Option<TableModel> {
    let d = v.industry_detail.get().get(id)?;
    let rows_by_id = &v.company_rows.get().rows;
    let mut rows: Vec<Vec<Cell>> = d
        .companies
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let row = rows_by_id
                .binary_search_by_key(&c.company, |r| r.id)
                .ok()
                .map(|k| &rows_by_id[k]);
            let page = PageRef::Company(c.company);
            vec![
                Cell::Int(i as i64 + 1),
                Cell::Link(page.clone(), index.title(&page)),
                Cell::Text(
                    row.filter(|r| r.public && !r.ticker.is_empty())
                        .map_or("-".into(), |r| r.ticker.clone()),
                ),
                Cell::Text(match row {
                    Some(r) if r.public => "listed".into(),
                    Some(_) => "private".into(),
                    None => "-".into(),
                }),
                Cell::figure(c.revenue_m, Unit::Money),
                Cell::figure(c.share, Unit::Percent),
            ]
        })
        .collect();
    rows.push(vec![
        Cell::Unknown,
        Cell::Text("Fringe (unnamed)".into()),
        Cell::Text("-".into()),
        Cell::Text("-".into()),
        Cell::figure(d.fringe_revenue_m, Unit::Money),
        Cell::figure(d.fringe_share, Unit::Percent),
    ]);
    Some(TableModel::new(
        vec![
            Column::number("#", 36.0),
            Column::text("Company", 230.0),
            Column::text("Ticker", 60.0),
            Column::text("Listed", 60.0),
            Column::number("Revenue", 130.0)
                .with_hint("Last month's revenue; a band while not published (D420)"),
            Column::number("Share", 120.0).with_hint("Of the industry's revenue shown"),
        ],
        rows,
    ))
}

/// The industry's latest headlines (D518), newest first, each linking to its page.
pub fn headlines_model(v: &SimViews, id: IndustryId) -> TableModel {
    let rows = super::news::headline_links(v, |h| h.industry == Some(id), INDUSTRY_HEADLINES)
        .into_iter()
        .map(|(date, text, page)| vec![Cell::Date(date), Cell::Link(page, text)])
        .collect();
    TableModel::new(
        vec![Column::text("Date", 96.0), Column::text("Headline", 640.0)],
        rows,
    )
}

/// The note over an industry's headlines: empty once it has one (PR #30 review).
pub fn no_headlines_note(v: &SimViews, id: IndustryId) -> String {
    if super::news::headline_links(v, |h| h.industry == Some(id), 1).is_empty() {
        "No headlines yet: phase changes, results, ratings, startups and listings in this          industry post here."
            .into()
    } else {
        String::new()
    }
}

#[allow(clippy::too_many_arguments)]
fn industry_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    controls: Res<RunnerControls>,
) {
    let PageRef::Industry(id) = b.page else {
        return;
    };
    let v: &SimViews = &views;
    let Some(r) = v.industry_rows.get().get(id) else {
        page_header(&mut commands, b.head, &index.title(&b.page), "Industry", "");
        note(&mut commands, b.head, "No such industry.");
        return;
    };
    page_header(
        &mut commands,
        b.head,
        &index.title(&b.page),
        &format!("Industry, {}", r.sector),
        if r.estimated {
            "Estimated: one or two companies here do not publish, so the totals are bands (D432)"
        } else {
            ""
        },
    );
    link_group(
        &mut commands,
        b.head,
        "Pages",
        &[(index.title(&PageRef::Industries), PageRef::Industries)],
    );
    if let Some(body) = b.section("figures") {
        let row = chip_row(&mut commands, body);
        let births = v.births.get().births_last_four_quarters(id);
        fact(
            &mut commands,
            row,
            "Phase",
            r.phase_label.name().into(),
            color::CYAN,
        );
        fact(
            &mut commands,
            row,
            "Demand",
            format::money(r.demand),
            color::TEXT,
        );
        fact(
            &mut commands,
            row,
            "Trend demand",
            format::money(r.trend_demand),
            color::TEXT,
        );
        for (label, f, unit) in [
            ("Supply", r.supply, Unit::Money),
            ("S", r.supply_ratio, Unit::Ratio),
            ("M", r.market_factor, Unit::Ratio),
            ("Fringe share", r.fringe_share, Unit::Percent),
            ("Named revenue (month)", r.named_revenue_m, Unit::Money),
            ("Fringe revenue (month)", r.fringe_revenue_m, Unit::Money),
        ] {
            fact(
                &mut commands,
                row,
                label,
                format::figure_in(f, unit),
                figure_color(f, color::TEXT),
            );
        }
        fact(
            &mut commands,
            row,
            "Long-term",
            format::percent(r.lt),
            color::TEXT,
        );
        let g = r.growth_annual;
        fact(
            &mut commands,
            row,
            "Growth (a year)",
            format::gain(g, GainUnit::Percent),
            if g >= 0.0 { color::GAIN } else { color::LOSS },
        );
        fact(
            &mut commands,
            row,
            "Births (4 quarters)",
            births.to_string(),
            color::TEXT,
        );
    }
    for (sec, model) in [
        ("chart", demand_supply_chart(v, id)),
        ("growth", growth_chart(v, id)),
    ] {
        if let Some(body) = b.section(sec) {
            match model {
                Some(m) => {
                    spawn_chart(&mut commands, body, Arc::new(m));
                }
                None => {
                    note(
                        &mut commands,
                        body,
                        "No closed quarter yet: the chart fills from the first quarter's close.",
                    );
                }
            }
        }
    }
    if let Some(body) = b.section("companies")
        && let Some(m) = companies_model(v, &index, id)
    {
        let boxed = table_box(&mut commands, body, m.len());
        crate::table::spawn_table_with_id(&mut commands, boxed, Arc::new(m), "industry.companies");
    }
    if let Some(body) = b.section("births") {
        let births = v.births.get();
        let born: Vec<(String, PageRef)> = births
            .births
            .iter()
            .filter(|x| x.industry == id)
            .rev()
            .map(|x| (index.title(&PageRef::Company(x.id)), PageRef::Company(x.id)))
            .collect();
        let events: Vec<(String, PageRef)> = births
            .events
            .iter()
            .filter(|e| e.industries.contains(&id))
            .rev()
            .map(|e| (event_name(e), PageRef::Event(e.id)))
            .collect();
        if born.is_empty() && events.is_empty() {
            note(&mut commands, body, "No startups born here yet.");
        }
        link_group(&mut commands, body, "Born here", &born);
        link_group(&mut commands, body, "Startup events", &events);
    }
    if let Some(body) = b.section("news") {
        // Live on v_news (daily): the page itself rebuilds only when its monthly and quarterly
        // views move, so a new headline shows without a daily rebuild. The note explains an
        // empty table and goes once the first headline posts.
        spawn_live_text(
            &mut commands,
            body,
            font::SMALL,
            color::TEXT_MUTED,
            Live::new(&[ViewKey::News], move |c| {
                LiveModel::Text(no_headlines_note(c.views, id))
            }),
            &views,
            &index,
            &controls,
        );
        let boxed = table_box(&mut commands, body, INDUSTRY_HEADLINES);
        spawn_live_table(
            &mut commands,
            boxed,
            "industry.news",
            Live::new(&[ViewKey::News, ViewKey::Births], move |c| {
                LiveModel::Table(headlines_model(c.views, id))
            }),
            Filter::default(),
            &views,
            &index,
            &controls,
        );
    }
}
