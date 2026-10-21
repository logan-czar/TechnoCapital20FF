//! The screens the router opens (build-plan M7.8; spec 8). M7 builds the shell only, so each
//! screen is a stub panel ("coming in M9") that reads its views from [`Views`] and shows their
//! refresh state; the map's place holds the province table demo, and Pdoomberg's F2 holds a
//! company table demo from the starting data, whose rows add to or drop from the watchlist.

use std::sync::Arc;

use bevy::prelude::*;
use sim::Control;
use sim::views::Cadence;
use sim::world::CompanyId;

use super::rail::{Router, Screen, ScreenRoot};
use super::theme::{self, color, font, size};
use super::{DemoTables, ShellLayout, SpawnLayout, UiSystems};
use crate::bridge::{RunnerControls, SimControl, Views};
use crate::table::{TableFocus, TableModel, TableRowClicked, spawn_table};

/// The views each stub reads (spec 9.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ViewKey {
    Clock,
    Quotes,
    PriceBars,
    News,
    Projection,
    CompanyRows,
    CompanyDetail,
    Units,
    Tech,
    IndustryRows,
    IndustryDetail,
    MapLayers,
    ProvinceCards,
    Statements,
    Filings,
    Ratings,
    Recap,
    MapStatic,
}

/// A view's name, version and cadence.
pub fn view_meta(v: &sim::SimViews, key: ViewKey) -> (&'static str, u64, Cadence) {
    macro_rules! m {
        ($name:literal, $f:ident) => {
            ($name, v.$f.version(), v.$f.cadence())
        };
    }
    match key {
        ViewKey::Clock => m!("v_clock", clock),
        ViewKey::Quotes => m!("v_quotes", quotes),
        ViewKey::PriceBars => m!("v_price_bars", price_bars),
        ViewKey::News => m!("v_news", news),
        ViewKey::Projection => m!("v_projection", projection),
        ViewKey::CompanyRows => m!("v_company_row", company_rows),
        ViewKey::CompanyDetail => m!("v_company_detail", company_detail),
        ViewKey::Units => m!("v_units", units),
        ViewKey::Tech => m!("v_tech", tech),
        ViewKey::IndustryRows => m!("v_industry_row", industry_rows),
        ViewKey::IndustryDetail => m!("v_industry_detail", industry_detail),
        ViewKey::MapLayers => m!("v_map_layers", map_layers),
        ViewKey::ProvinceCards => m!("v_province_card", province_cards),
        ViewKey::Statements => m!("v_statements", statements),
        ViewKey::Filings => m!("v_filings", filings),
        ViewKey::Ratings => m!("v_ratings", ratings),
        ViewKey::Recap => m!("v_recap", recap),
        ViewKey::MapStatic => m!("v_map_static", map_static),
    }
}

fn cadence_name(c: Cadence) -> &'static str {
    match c {
        Cadence::EveryTick => "every tick",
        Cadence::Daily => "daily",
        Cadence::Monthly => "monthly and on load",
        Cadence::Quarterly => "quarterly",
        Cadence::OnceAtLoad => "once at load",
    }
}

/// A line showing one view's refresh state; rewritten when the views change.
#[derive(Component, Debug, Clone, Copy)]
pub struct ViewLine(pub ViewKey);

/// The demo tables' entities.
#[derive(Resource, Debug, Clone, Copy)]
pub struct DemoTableEntities {
    pub provinces: Entity,
    pub companies: Entity,
}

pub struct ScreensPlugin;

impl Plugin for ScreensPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn_screens.after(SpawnLayout))
            .add_systems(
                Update,
                (
                    focus_table.run_if(resource_changed::<Router>),
                    toggle_watch,
                    show_view_lines.run_if(resource_changed::<Views>),
                )
                    .in_set(UiSystems::Show),
            );
    }
}

/// What each stub screen will show and which views it reads.
fn stub(screen: Screen) -> (&'static str, &'static str, &'static [ViewKey]) {
    match screen {
        Screen::Company => (
            "20.7.2",
            "Header, then Overview, Board, Cap table, Units, Financials and Tech tabs.",
            &[
                ViewKey::CompanyDetail,
                ViewKey::Units,
                ViewKey::Tech,
                ViewKey::Statements,
                ViewKey::Projection,
            ],
        ),
        Screen::Industries => (
            "20.7.6",
            "Table of the 42 industries with a detail view and the global phase strip.",
            &[ViewKey::IndustryRows, ViewKey::IndustryDetail],
        ),
        Screen::Recap => (
            "20.7.9, 21.6.2",
            "World page and watchlist company pages; opens the pre-quarter-end week.",
            &[ViewKey::Recap, ViewKey::Projection, ViewKey::Clock],
        ),
        Screen::News => (
            "20.5.1",
            "Pdoomberg Wire headlines with date and industry tag.",
            &[ViewKey::News],
        ),
        Screen::Pdoomberg => (
            "20.5.2, 3.13.1",
            "F2 Quotes, F3 Chart, F5 Filings, F6 Ratings, F7 Bonds, F9 Industries, F10 Screener.",
            &[
                ViewKey::Quotes,
                ViewKey::PriceBars,
                ViewKey::Filings,
                ViewKey::Ratings,
            ],
        ),
        Screen::Map => (
            "20.7.10, 2.24",
            "The province map with its modes and the province card (M8).",
            &[
                ViewKey::MapStatic,
                ViewKey::MapLayers,
                ViewKey::ProvinceCards,
            ],
        ),
    }
}

fn view_lines(commands: &mut Commands, parent: Entity, keys: &[ViewKey], c: Color) {
    for &k in keys {
        let e = commands
            .spawn((ViewLine(k), theme::text("", font::SMALL, c)))
            .id();
        commands.entity(parent).add_child(e);
    }
}

fn spawn_screens(mut commands: Commands, layout: Res<ShellLayout>, demo: Res<DemoTables>) {
    // The map's place: the province table demo until M8.
    let map = commands
        .spawn((
            ScreenRoot(Screen::Map),
            Node {
                flex_grow: 1.0,
                min_height: px(0.0),
                flex_direction: FlexDirection::Column,
                padding: UiRect::all(px(size::PAD)),
                row_gap: px(size::GAP),
                ..default()
            },
        ))
        .id();
    commands.entity(layout.main).insert_children(0, &[map]);
    let head = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::Baseline,
            column_gap: px(12.0),
            ..default()
        })
        .id();
    let t = commands.spawn(theme::title("World")).id();
    let note = commands
        .spawn(theme::muted(
            "The map lands in M8. Until then: the provinces of the starting data (table demo).",
        ))
        .id();
    commands.entity(head).add_children(&[t, note]);
    commands.entity(map).add_child(head);
    let provinces = spawn_table(&mut commands, map, Arc::clone(&demo.provinces));

    for screen in [
        Screen::Company,
        Screen::Industries,
        Screen::Recap,
        Screen::News,
    ] {
        let (section, what, keys) = stub(screen);
        let panel = commands
            .spawn((
                ScreenRoot(screen),
                theme::panel(Node {
                    position_type: PositionType::Absolute,
                    left: px(0.0),
                    top: px(0.0),
                    bottom: px(0.0),
                    width: percent(size::PANEL_PCT),
                    display: Display::None,
                    ..default()
                }),
                GlobalZIndex(10),
            ))
            .id();
        let title = commands.spawn(theme::title(screen.name())).id();
        let sub = commands
            .spawn(theme::text(
                format!("Coming in M9 (20-ui {section})"),
                font::BODY,
                color::AMBER,
            ))
            .id();
        let body = commands.spawn(theme::body(what)).id();
        let rule = commands.spawn(theme::rule()).id();
        let reads = commands.spawn(theme::muted("Reads from SimViews:")).id();
        commands
            .entity(panel)
            .add_children(&[title, sub, body, rule, reads]);
        view_lines(&mut commands, panel, keys, color::TEXT_MUTED);
        let lock = commands.spawn(theme::read_only_lock()).id();
        let close = commands
            .spawn(theme::muted(format!(
                "{} or Esc closes; the game keeps running behind panels.",
                screen.key_name()
            )))
            .id();
        commands.entity(panel).add_children(&[lock, close]);
        commands.entity(layout.main).add_child(panel);
    }

    // Pdoomberg: the full-screen terminal (20.5.2), the one exception to the look.
    let term = commands
        .spawn((
            ScreenRoot(Screen::Pdoomberg),
            Node {
                position_type: PositionType::Absolute,
                left: px(0.0),
                right: px(0.0),
                top: px(0.0),
                bottom: px(0.0),
                flex_direction: FlexDirection::Column,
                padding: UiRect::all(px(size::PAD)),
                row_gap: px(size::GAP),
                display: Display::None,
                ..default()
            },
            BackgroundColor(color::TERMINAL_BG),
            GlobalZIndex(20),
        ))
        .id();
    commands.entity(layout.main).add_child(term);
    let head = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::Center,
            column_gap: px(14.0),
            ..default()
        })
        .id();
    let name = commands
        .spawn(theme::text("PDOOMBERG", font::HERO, color::TERMINAL_TEXT))
        .id();
    let badge = commands
        .spawn(theme::text(
            "Accurate: published data",
            font::SMALL,
            color::GREEN,
        ))
        .id();
    commands.entity(head).add_children(&[name, badge]);
    commands.entity(term).add_child(head);
    let keys_row = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::Center,
            column_gap: px(12.0),
            ..default()
        })
        .id();
    for (i, k) in [
        "F2 Quotes",
        "F3 Chart",
        "F4 Order",
        "F5 Filings",
        "F6 Ratings",
        "F7 Bonds",
        "F9 Industries",
        "F10 Screener",
    ]
    .into_iter()
    .enumerate()
    {
        let c = if i == 0 {
            color::TERMINAL_TEXT
        } else {
            color::TEXT_MUTED
        };
        let e = commands.spawn(theme::text(k, font::BODY, c)).id();
        commands.entity(keys_row).add_child(e);
        if k == "F4 Order" {
            let lock = commands.spawn(theme::read_only_lock()).id();
            commands.entity(keys_row).add_child(lock);
        }
    }
    commands.entity(term).add_child(keys_row);
    let note = commands
        .spawn(theme::text(
            "F2 Quotes (demo: starting data until v_quotes lands in M5). Click a row to watch \
             or unwatch it. Esc returns to the map. Coming in M9 (20-ui 20.5.2).",
            font::SMALL,
            color::TERMINAL_TEXT,
        ))
        .id();
    commands.entity(term).add_child(note);
    view_lines(
        &mut commands,
        term,
        stub(Screen::Pdoomberg).2,
        color::TEXT_MUTED,
    );
    let companies = spawn_table(&mut commands, term, Arc::clone(&demo.companies));
    commands.insert_resource(DemoTableEntities {
        provinces,
        companies,
    });
    commands.insert_resource(TableFocus(Some(provinces)));
}

fn show_view_lines(views: Res<Views>, mut lines: Query<(&ViewLine, &mut Text)>) {
    for (line, mut text) in &mut lines {
        let (name, version, cadence) = view_meta(&views, line.0);
        let s = format!(
            "  {name}: refresh {version} of {} ({})",
            views.refresh(),
            cadence_name(cadence)
        );
        if text.0 != s {
            text.0 = s;
        }
    }
}

/// The keyboard scrolls the open screen's table, or the map's under a panel.
fn focus_table(
    router: Res<Router>,
    tables: Option<Res<DemoTableEntities>>,
    mut focus: ResMut<TableFocus>,
) {
    let Some(t) = tables else {
        return;
    };
    let want = if router.current == Screen::Pdoomberg {
        t.companies
    } else {
        t.provinces
    };
    if focus.0 != Some(want) {
        focus.0 = Some(want);
    }
}

/// A click on a Pdoomberg quote row watches or unwatches that company (design fix 8).
fn toggle_watch(
    mut clicks: MessageReader<TableRowClicked>,
    tables: Option<Res<DemoTableEntities>>,
    controls: Res<RunnerControls>,
    mut w: MessageWriter<SimControl>,
) {
    let Some(t) = tables else {
        clicks.clear();
        return;
    };
    for c in clicks.read() {
        if c.table != t.companies {
            continue;
        }
        let id = CompanyId(c.row as u32);
        let control = if controls.watchlist.contains(&id) {
            Control::WatchlistRemove(id)
        } else {
            Control::WatchlistAdd(id)
        };
        w.write(SimControl(control));
    }
}

/// The demo tables from the starting data (until the real views land).
pub fn demo_tables(data: &sim_data::WorldData) -> DemoTables {
    use crate::table::{Cell, Column};
    let mut provinces: Vec<_> = data.all_provinces().map(|(_, _, p)| p).collect();
    provinces.sort_by(|a, b| a.id.cmp(&b.id));
    let world_dev: f64 = provinces
        .iter()
        .map(|p| f64::from(p.commerce + p.industry + p.population))
        .sum();
    let rows = provinces
        .iter()
        .map(|p| {
            let dev = p.commerce + p.industry + p.population;
            vec![
                Cell::Text(p.id.clone()),
                Cell::Text(p.name.clone()),
                Cell::Text(p.country.clone()),
                if p.metro.is_empty() {
                    Cell::Unknown
                } else {
                    Cell::Text(p.metro.clone())
                },
                Cell::Int(i64::from(p.commerce)),
                Cell::Int(i64::from(p.industry)),
                Cell::Int(i64::from(p.population)),
                Cell::Int(i64::from(dev)),
                Cell::Percent(f64::from(dev) / world_dev),
            ]
        })
        .collect();
    let provinces = TableModel::new(
        vec![
            Column::text("Id", 90.0),
            Column::text("Name", 240.0),
            Column::text("Country", 70.0),
            Column::text("Metro", 110.0).with_hint("? where the province is in no Metro"),
            Column::number("Commerce", 80.0),
            Column::number("Industry", 80.0),
            Column::number("Pop", 60.0),
            Column::number("Dev", 60.0).with_hint("Commerce + Industry + Population"),
            Column::number("World %", 70.0).with_hint("Share of the world's development"),
        ],
        rows,
    );

    // Ordinal order is ascending CSV id (D4), so a row's index is its CompanyId.
    let mut companies: Vec<_> = data.companies.iter().map(|(_, c)| c).collect();
    companies.sort_by(|a, b| a.id.cmp(&b.id));
    let company_names = companies.iter().map(|c| c.name.clone()).collect();
    let rows = companies
        .iter()
        .map(|c| {
            vec![
                Cell::Text(if c.ticker.is_empty() {
                    "-".into()
                } else {
                    c.ticker.clone()
                }),
                Cell::Text(c.name.clone()),
                Cell::Text(c.industry.clone()),
                Cell::Text(c.hq_country.clone()),
                Cell::Text(if c.public { "yes" } else { "no" }.into()),
                Cell::Money(c.revenue_usd_m * 1e6),
                Cell::Money(c.est_value_usd_m * 1e6),
                c.controller_stake_pct
                    .map_or(Cell::Unknown, |p| Cell::Percent(p / 100.0)),
            ]
        })
        .collect();
    let companies = TableModel::new(
        vec![
            Column::text("Ticker", 70.0),
            Column::text("Name", 240.0),
            Column::text("Industry", 170.0),
            Column::text("HQ", 50.0),
            Column::text("Listed", 60.0),
            Column::number("Revenue", 90.0),
            Column::number("Est. value", 100.0),
            Column::number("Ctrl stake", 90.0).with_hint("? where the stake is not published"),
        ],
        rows,
    );
    DemoTables {
        provinces: Arc::new(provinces),
        companies: Arc::new(companies),
        company_names,
    }
}
