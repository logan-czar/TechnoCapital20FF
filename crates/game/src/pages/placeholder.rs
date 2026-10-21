//! Placeholder entity pages (M9 A2): every entity page kind shows a header with its name and
//! links to the pages it relates to, the views it will read, and what Phase B fills in. Phase
//! B replaces a kind by registering its own builder ([`super::PageAppExt::register_page`]).

use std::sync::Arc;

use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use sim::views::characters::Role;
use sim::world::Origin;

use super::{
    OpenPdoomberg, PageAppExt, PageBuild, PageKind, PageRef, PageRegistry, PageSpec, PdbFunction,
    ViewKey, cadence_name, view_meta,
};
use crate::bridge::{RunnerControls, Views};
use crate::chart::{ChartModel, Ohlc, Series, ValueFormat, spawn_chart, ten_year_view};
use crate::command::index::NameIndex;
use crate::links::{link_sized, names};
use crate::ui::theme::{self, Tooltip, color, font};

/// A line showing one view's refresh state; rewritten when the views change.
#[derive(Component, Debug, Clone, Copy)]
pub struct ViewLine(pub ViewKey);

/// The placeholder sections.
pub const SECTIONS: &[super::SectionSpec] = &[
    ("links", "Links"),
    ("views", "Views this page reads"),
    ("plan", "Phase B fills in"),
];

/// Company and industry placeholders add a chart from the views (the M9.1 widget at work).
pub const CHART_SECTIONS: &[super::SectionSpec] = &[
    ("links", "Links"),
    ("chart", "Chart"),
    ("views", "Views this page reads"),
    ("plan", "Phase B fills in"),
];

/// The chart a company or industry placeholder shows, from the views: a company's daily bars
/// over each day's EFV band (D424) for the last year (the 10-year weekly view once it has more
/// than a year), an industry's demand and supply over its last 20 quarters (supply a band in
/// the quarters it was estimated, D437).
pub fn placeholder_chart(page: &PageRef, v: &sim::SimViews) -> Option<ChartModel> {
    match page {
        PageRef::Company(id) => {
            let h = v.price_bars.get().companies.iter().find(|h| h.id == *id)?;
            let daily: Vec<Ohlc> = h.bars.iter().map(Ohlc::from_bar).collect();
            let last = daily.last()?.date;
            let year_ago = last.add_days(-365);
            Some(if daily.first().is_some_and(|b| b.date < year_ago) {
                ChartModel::candles(
                    "10 years, weekly bars over the EFV band",
                    ten_year_view(&daily),
                )
            } else {
                ChartModel::candles("Daily bars over the EFV band", daily)
            })
        }
        PageRef::Industry(id) => {
            let d = v.industry_detail.get().get(*id)?;
            let start = d.history.len().saturating_sub(20);
            let q = &d.history[start..];
            if q.is_empty() {
                return None;
            }
            let supply: Vec<_> = q.iter().map(|h| h.supply).collect();
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
        _ => None,
    }
}

/// Each placeholder kind: views it reads, views lane A1 adds, and what Phase B builds.
fn spec(kind: PageKind) -> (&'static [ViewKey], &'static [&'static str], &'static str) {
    match kind {
        PageKind::Company => (
            &[
                ViewKey::CompanyRows,
                ViewKey::CompanyDetail,
                ViewKey::Quotes,
                ViewKey::PriceBars,
                ViewKey::Units,
                ViewKey::Tech,
                ViewKey::Statements,
                ViewKey::Projection,
                ViewKey::Births,
                ViewKey::CapTable,
                ViewKey::Characters,
                ViewKey::Places,
            ],
            &[],
            "M9.2 and M9.7 (lane B1): header with owner of record and controller, Founded and \
             Listed lines; Overview, Board, Cap table, Units, Financials and Tech tabs.",
        ),
        PageKind::Industry => (
            &[
                ViewKey::IndustryRows,
                ViewKey::IndustryDetail,
                ViewKey::Births,
            ],
            &[],
            "M9.3 (lane B2): 20-quarter demand vs supply chart, growth bars against long-term \
             growth, the fringe row and the company list.",
        ),
        PageKind::Character => (
            &[ViewKey::Characters, ViewKey::Places, ViewKey::CompanyRows],
            &[],
            "Lane B1: age, skills, traits, home province and country, roles (seats, \
             controller, founder, director), holdings; partial characters marked.",
        ),
        PageKind::Country => (
            &[ViewKey::Countries, ViewKey::Rates, ViewKey::CompanyRows],
            &[],
            "Lane B1: iso3, superregion, sovereign rating and spread, tax rate, HQ'd companies.",
        ),
        PageKind::Zone => (
            &[ViewKey::Zones, ViewKey::Rates, ViewKey::Exchanges],
            &[],
            "Lane B1: spread, confidence, index, member countries.",
        ),
        PageKind::Exchange => (
            &[
                ViewKey::Exchanges,
                ViewKey::Quotes,
                ViewKey::Zones,
                ViewKey::Places,
            ],
            &[],
            "Lane B1: listed companies, constituents and the index chart.",
        ),
        PageKind::Event => (
            &[ViewKey::Births, ViewKey::News],
            &[],
            "Lane B2: the event's type, date, industries and the startups it made.",
        ),
        PageKind::Recap => (
            &[
                ViewKey::Recap,
                ViewKey::Projection,
                ViewKey::Clock,
                ViewKey::IndustryRows,
            ],
            &[],
            "M9.5 (lane B2): world page (global phase and g_t, industries by phase label, \
             biggest expected beats and misses) and watchlist company pages.",
        ),
        PageKind::Headline => (
            &[ViewKey::News],
            &[],
            "Lane B2: the headline with every subject linked.",
        ),
        _ => (&[], &[], ""),
    }
}

/// Registers the placeholder for every entity page kind.
pub fn register(app: &mut App) {
    for kind in [
        PageKind::Company,
        PageKind::Industry,
        PageKind::Character,
        PageKind::Country,
        PageKind::Zone,
        PageKind::Exchange,
        PageKind::Event,
        PageKind::Recap,
        PageKind::Headline,
    ] {
        let (views, planned, _) = spec(kind);
        let sections = if matches!(kind, PageKind::Company | PageKind::Industry) {
            CHART_SECTIONS
        } else {
            SECTIONS
        };
        app.register_page(
            kind,
            PageSpec::new(views).planned(planned).sections(sections),
            placeholder_page,
        );
    }
    app.add_systems(Update, show_view_lines.in_set(crate::ui::UiSystems::Show));
}

/// A wrapping row of chips.
pub fn chip_row(commands: &mut Commands, parent: Entity) -> Entity {
    let row = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            flex_wrap: FlexWrap::Wrap,
            column_gap: px(10.0),
            row_gap: px(2.0),
            align_items: AlignItems::Baseline,
            ..default()
        })
        .id();
    commands.entity(parent).add_child(row);
    row
}

/// A labelled group of links: "Industry: Oil".
pub fn link_group(
    commands: &mut Commands,
    parent: Entity,
    label: &str,
    links: &[(String, PageRef)],
) {
    if links.is_empty() {
        return;
    }
    let row = chip_row(commands, parent);
    let l = commands
        .spawn(theme::text_line(
            format!("{label}:"),
            font::SMALL,
            color::TEXT_MUTED,
        ))
        .id();
    commands.entity(row).add_child(l);
    for (text, page) in links {
        let e = commands
            .spawn(link_sized(text.clone(), page.clone(), font::BODY))
            .id();
        commands.entity(row).add_child(e);
    }
}

/// A page header: the title, the kind, and a note.
pub fn page_header(commands: &mut Commands, head: Entity, title: &str, kind: &str, note: &str) {
    let row = chip_row(commands, head);
    let t = commands.spawn(theme::title(title.to_owned())).id();
    let k = commands
        .spawn(theme::text_line(
            kind.to_owned(),
            font::SMALL,
            color::TEXT_MUTED,
        ))
        .id();
    commands.entity(row).add_children(&[t, k]);
    if !note.is_empty() {
        let n = commands
            .spawn(theme::text_line(note.to_owned(), font::SMALL, color::AMBER))
            .id();
        commands.entity(row).add_child(n);
    }
}

/// The related pages of an entity page, by group, read from the views.
pub fn related(
    page: &PageRef,
    v: &sim::SimViews,
    index: &NameIndex,
    watchlist: &[sim::world::CompanyId],
) -> Vec<(&'static str, Vec<(String, PageRef)>)> {
    let t = |p: PageRef| (index.title(&p), p);
    let mut out: Vec<(&'static str, Vec<(String, PageRef)>)> = Vec::new();
    match page {
        PageRef::Company(id) => {
            let detail = v.company_detail.get().get(*id);
            if let Some(r) = v.company_rows.get().rows.iter().find(|r| r.id == *id) {
                out.push(("Industry", vec![t(PageRef::Industry(r.industry))]));
                let hq = detail
                    .and_then(|d| names::place(v, d.hq_province))
                    .unwrap_or_else(|| t(PageRef::Country(r.hq_country)));
                out.push(("HQ", vec![hq]));
                if let Some(z) = r.exchange {
                    out.push(("Exchange", vec![t(PageRef::Exchange(z))]));
                }
                if let (Some(p), Some(n)) =
                    (names::controller_page(r.controller), &r.controller_name)
                {
                    out.push(("Controller", vec![(n.clone(), p)]));
                }
                if let Some(o) = r.owner_of_record {
                    out.push(("Owner of record", vec![t(PageRef::Character(o))]));
                }
            }
            if let Some(d) = detail {
                let board: Vec<_> = d
                    .board
                    .iter()
                    .filter_map(|s| s.holder.as_ref().and_then(|h| h.character))
                    .map(|c| t(PageRef::Character(c)))
                    .collect();
                out.push(("Board", board));
                out.push((
                    "Founders",
                    d.founders
                        .iter()
                        .map(|&c| t(PageRef::Character(c)))
                        .collect(),
                ));
                if let Origin::Born { event, .. } = d.origin {
                    out.push(("Founded by", vec![t(PageRef::Event(event))]));
                }
            }
            out.push(("List", vec![t(PageRef::Companies)]));
        }
        PageRef::Industry(id) => {
            if let Some(r) = v.industry_rows.get().get(*id) {
                out.push((
                    "Top companies",
                    r.top_companies
                        .iter()
                        .take(5)
                        .map(|&c| t(PageRef::Company(c)))
                        .collect(),
                ));
            }
            out.push(("List", vec![t(PageRef::Industries)]));
        }
        PageRef::Character(id) => {
            if let Some(c) = v.characters.get().get(*id) {
                if let Some(h) = &c.home
                    && let Some(home) = names::place(v, h.province)
                {
                    out.push(("Home", vec![home]));
                }
                let mut seats = Vec::new();
                let mut controls = Vec::new();
                let mut other = Vec::new();
                for r in &c.roles {
                    let (_, co) = names::role(r);
                    let link = t(PageRef::Company(co));
                    let list = match r {
                        Role::Seat { .. } | Role::Director { .. } => &mut seats,
                        Role::Controller { .. } => &mut controls,
                        _ => &mut other,
                    };
                    if !list.contains(&link) {
                        list.push(link);
                    }
                }
                out.push(("Controls", controls));
                out.push(("Board seats", seats));
                out.push(("Founder or owner", other));
                out.push((
                    "Holdings",
                    c.holdings
                        .iter()
                        .map(|h| t(PageRef::Company(h.company)))
                        .collect(),
                ));
            }
            out.push(("List", vec![t(PageRef::Characters)]));
        }
        PageRef::Country(id) => {
            if let Some(c) = v.countries.get().get(*id) {
                out.push(("Zone", vec![t(PageRef::Zone(c.zone))]));
                out.push((
                    "HQ companies",
                    c.hq_companies
                        .iter()
                        .take(12)
                        .map(|&co| t(PageRef::Company(co)))
                        .collect(),
                ));
            }
            out.push(("List", vec![t(PageRef::Countries)]));
        }
        PageRef::Zone(id) => {
            out.push(("Exchange", vec![t(PageRef::Exchange(*id))]));
            if let Some(z) = v.zones.get().get(*id) {
                out.push((
                    "Countries",
                    z.members.iter().map(|&c| t(PageRef::Country(c))).collect(),
                ));
            }
            out.push(("List", vec![t(PageRef::Zones)]));
        }
        PageRef::Exchange(zone) => {
            out.push(("Zone", vec![t(PageRef::Zone(*zone))]));
            if let Some(x) = v.exchanges.get().exchanges.iter().find(|x| x.zone == *zone) {
                if let Some(hub) = names::place(v, x.hub_province) {
                    out.push(("Hub", vec![hub]));
                }
                out.push((
                    "Constituents",
                    x.constituents
                        .iter()
                        .take(12)
                        .map(|&c| t(PageRef::Company(c)))
                        .collect(),
                ));
            }
            out.push(("List", vec![t(PageRef::Exchanges)]));
        }
        PageRef::Event(id) => {
            if let Some(e) = v.births.get().events.iter().find(|e| e.id == *id) {
                out.push((
                    "Industries",
                    e.industries
                        .iter()
                        .map(|&i| t(PageRef::Industry(i)))
                        .collect(),
                ));
                out.push((
                    "Startups",
                    e.startups.iter().map(|&c| t(PageRef::Company(c))).collect(),
                ));
            }
            out.push(("List", vec![t(PageRef::Events)]));
        }
        PageRef::Recap(q) => {
            let now = v.clock().date.quarter();
            let mut nav = Vec::new();
            if *q > (sim::time::Quarter { year: 2020, q: 1 }) {
                nav.push(t(PageRef::Recap(q.prev())));
            }
            if q.next() <= now {
                nav.push(t(PageRef::Recap(q.next())));
            }
            out.push(("Quarters", nav));
            out.push(("World", vec![t(PageRef::Industries)]));
            out.push((
                "Watchlist",
                watchlist.iter().map(|&c| t(PageRef::Company(c))).collect(),
            ));
        }
        PageRef::Headline { date, n } => {
            if let Some(h) = v
                .news
                .get()
                .feed
                .iter()
                .filter(|h| h.date == *date)
                .nth(*n as usize)
            {
                if let Some(c) = h.company {
                    out.push(("Company", vec![t(PageRef::Company(c))]));
                }
                if let Some(i) = h.industry {
                    out.push(("Industry", vec![t(PageRef::Industry(i))]));
                }
            }
            out.push(("List", vec![t(PageRef::News)]));
        }
        _ => {}
    }
    out.retain(|(_, l)| !l.is_empty());
    out
}

#[allow(clippy::too_many_arguments)]
fn placeholder_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    registry: Res<PageRegistry>,
    controls: Res<RunnerControls>,
) {
    let kind = b.page.kind();
    page_header(
        &mut commands,
        b.head,
        &index.title(&b.page),
        kind.name(),
        "Placeholder: filled in M9 Phase B",
    );
    if let Some(body) = b.section("links") {
        for (label, links) in related(
            &b.page,
            &views,
            &index,
            &controls.watchlist.iter().copied().collect::<Vec<_>>(),
        ) {
            link_group(&mut commands, body, label, &links);
        }
        if let PageRef::Company(id) = b.page {
            let row = chip_row(&mut commands, body);
            let e = commands
                .spawn((
                    theme::text_line("Open in Pdoomberg (F3 chart)", font::SMALL, color::AMBER),
                    Hovered::default(),
                    Tooltip("Full-screen Pdoomberg on this company (also: TICKER F3)".into()),
                ))
                .observe(
                    move |mut ev: On<PointerClick>, mut w: MessageWriter<OpenPdoomberg>| {
                        ev.propagate(false);
                        w.write(OpenPdoomberg {
                            function: PdbFunction::F3,
                            company: Some(id),
                        });
                    },
                )
                .id();
            commands.entity(row).add_child(e);
        }
    }
    if let Some(body) = b.section("views") {
        let spec = registry.get(kind);
        for &k in spec.map_or(&[][..], |s| s.views.as_slice()) {
            let e = commands
                .spawn((ViewLine(k), theme::text("", font::SMALL, color::TEXT_MUTED)))
                .id();
            commands.entity(body).add_child(e);
        }
        for name in spec.map_or(&[][..], |s| s.planned.as_slice()) {
            let e = commands
                .spawn(theme::text(
                    format!("  {name}: not in the sim yet"),
                    font::SMALL,
                    color::TEXT_MUTED,
                ))
                .id();
            commands.entity(body).add_child(e);
        }
    }
    if let Some(body) = b.section("chart") {
        match placeholder_chart(&b.page, &views) {
            Some(m) => {
                spawn_chart(&mut commands, body, Arc::new(m));
            }
            None => {
                let e = commands
                    .spawn(theme::muted(
                        "No history yet: the chart fills as the game runs.",
                    ))
                    .id();
                commands.entity(body).add_child(e);
            }
        }
    }
    if let Some(body) = b.section("plan") {
        let e = commands.spawn(theme::body(spec(kind).2)).id();
        let lock = commands.spawn(theme::read_only_lock()).id();
        commands.entity(body).add_children(&[e, lock]);
    }
}

/// Writes each view line: its name, version, the refresh count and cadence.
/// The line shows the view's own version, not the global refresh count, so it changes only when
/// that view is rebuilt (a monthly view's line stays put while v_quotes moves every tick); the
/// system runs when the views change or lines appear, and writes a line only when it differs.
pub fn show_view_lines(
    views: Res<Views>,
    mut lines: Query<(Ref<ViewLine>, &mut Text)>,
    mut last: Local<u64>,
) {
    let all = views.refresh() != *last;
    *last = views.refresh();
    for (line, mut text) in &mut lines {
        if !all && !line.is_added() {
            continue;
        }
        let (name, version, cadence) = view_meta(&views, line.0);
        let s = format!("  {name}: version {version} ({})", cadence_name(cadence));
        if text.0 != s {
            text.0 = s;
        }
    }
}
