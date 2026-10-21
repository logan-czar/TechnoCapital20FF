//! Full-screen Pdoomberg (build-plan M9.4; spec 8 Pdoomberg; 20-ui 20.5.2; 3-markets 3.13.1):
//! the amber-on-black terminal over the workspace. It is not a workspace page (D451): B opens
//! it, Esc closes it, and the game clock keeps running.
//!
//! - A one-line status bar: the Pdoomberg name, the "Accurate: published data" badge, the date
//!   and hour, the speed and the alert count (20.5.2 (A)).
//! - The command line shows the route (`ARDR F3 <GO>`); the command bar (Ctrl+K, `TICKER Fn`)
//!   sets it ([`PdoombergRoute`]).
//! - The security line of the loaded company: ticker, name, industry, last, change, EFV band,
//!   rating, next earnings.
//! - The function page: F2 Quotes, F3 Chart, F4 Order (the lock only), F5 Filings, F6 Ratings,
//!   F7 Bonds, F9 Industries, F10 Screener ([`pages`]). The function keys work only while the
//!   terminal is open (D453, design fix 442; D517), and the key row at the bottom is clickable.
//! - A row click on F2 watches or unwatches the company (M7.8); a right-click on F2, F5, F6 or
//!   F10 loads it (the security line and F3). A link click opens its page in the workspace and
//!   leaves the terminal (D517).

pub mod pages;

use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use sim::Control;
use sim::world::CompanyId;

use crate::bridge::{RunnerControls, SimControl, Views};
use crate::command::index::NameIndex;
use crate::pages::live::{Live, LiveModel, spawn_live_text};
use crate::pages::{PageRef, PdbFunction, PdoombergRoute, ViewKey, placeholder::ViewLine};
use crate::table::format::{self, Unit};
use crate::table::{Table, TableRowClicked};
use crate::ui::alerts::AlertBoard;
use crate::ui::rail::{Router, Screen, ScreenRoot};
use crate::ui::theme::{Tooltip, color, font, size};
use crate::ui::{KeyboardCapture, ShellLayout, SpawnLayout, UiSystems, modifier_held};
use crate::workspace::{OpenPage, WorkspaceInput};
use pages::{DIM, Env, TEXT, line};

/// The terminal's parts.
#[derive(Resource, Debug, Clone)]
pub struct PdoombergUi {
    pub root: Entity,
    pub status: Entity,
    pub command_line: Entity,
    /// The security line's slot.
    pub security: Entity,
    /// The function page's slot.
    pub area: Entity,
    pub keys: Vec<(PdbFunction, Entity)>,
    /// The route the page was last built for.
    pub built: Option<PdoombergRoute>,
    /// The page's main table (the keyboard scrolls it; row clicks act on it).
    pub main_table: Option<Entity>,
}

/// The function keys and the page each opens (spec 8; F1 Help and F8 Commodities are not in the
/// MVP).
pub const FUNCTION_KEYS: [(KeyCode, PdbFunction); 8] = [
    (KeyCode::F2, PdbFunction::F2),
    (KeyCode::F3, PdbFunction::F3),
    (KeyCode::F4, PdbFunction::F4),
    (KeyCode::F5, PdbFunction::F5),
    (KeyCode::F6, PdbFunction::F6),
    (KeyCode::F7, PdbFunction::F7),
    (KeyCode::F9, PdbFunction::F9),
    (KeyCode::F10, PdbFunction::F10),
];

/// The views the terminal's footer lists (each line shows its version and cadence).
const FOOTER_VIEWS: [ViewKey; 6] = [
    ViewKey::Quotes,
    ViewKey::PriceBars,
    ViewKey::Filings,
    ViewKey::Ratings,
    ViewKey::Rates,
    ViewKey::CompanyRows,
];

/// The amber of the terminal's rules.
const RULE: Color = Color::srgb(0.35, 0.24, 0.0);

pub struct PdoombergPlugin;

impl Plugin for PdoombergPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn_terminal.after(SpawnLayout))
            .add_systems(
                Update,
                (function_keys, leave_on_open_page)
                    .in_set(UiSystems::Input)
                    .before(WorkspaceInput),
            )
            .add_systems(
                Update,
                (
                    draw_page,
                    row_clicks,
                    mark_keys.run_if(resource_changed::<PdoombergRoute>),
                    show_status,
                    show_command_line.run_if(
                        resource_changed::<PdoombergRoute>.or_eager(resource_changed::<NameIndex>),
                    ),
                )
                    .chain()
                    .in_set(UiSystems::Show),
            );
    }
}

fn rule(commands: &mut Commands, parent: Entity) {
    let e = commands
        .spawn((
            Node {
                height: px(1.0),
                width: percent(100.0),
                flex_shrink: 0.0,
                ..default()
            },
            BackgroundColor(RULE),
            Pickable::IGNORE,
        ))
        .id();
    commands.entity(parent).add_child(e);
}

fn row(commands: &mut Commands, parent: Entity, gap: f32) -> Entity {
    let e = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::Baseline,
            column_gap: px(gap),
            flex_shrink: 0.0,
            flex_wrap: FlexWrap::Wrap,
            ..default()
        })
        .id();
    commands.entity(parent).add_child(e);
    e
}

fn spawn_terminal(mut commands: Commands, layout: Res<ShellLayout>) {
    let root = commands
        .spawn((
            ScreenRoot(Screen::Pdoomberg),
            Node {
                position_type: PositionType::Absolute,
                left: px(0.0),
                right: px(0.0),
                top: px(0.0),
                bottom: px(0.0),
                flex_direction: FlexDirection::Column,
                padding: UiRect::all(px(size::GAP)),
                row_gap: px(4.0),
                display: Display::None,
                ..default()
            },
            BackgroundColor(color::TERMINAL_BG),
            GlobalZIndex(20),
        ))
        .id();
    commands.entity(layout.main).add_child(root);
    // The status bar (20.5.2): name, badge, then the clock, speed and alerts.
    let head = row(&mut commands, root, 14.0);
    let name = commands
        .spawn(line("PDOOMBERG PROFESSIONAL", font::TITLE, TEXT))
        .id();
    let badge = commands
        .spawn(line("Accurate: published data", font::SMALL, color::GREEN))
        .id();
    let spacer = commands
        .spawn(Node {
            flex_grow: 1.0,
            ..default()
        })
        .id();
    let status = commands.spawn(line("", font::SMALL, TEXT)).id();
    commands
        .entity(head)
        .add_children(&[name, badge, spacer, status]);
    rule(&mut commands, root);
    let cmd = row(&mut commands, root, 14.0);
    let command_line = commands.spawn(line("> _", font::BODY, TEXT)).id();
    let hint = commands
        .spawn(line(
            "Ctrl+K: TICKER Fn (ARDR F3) | F2-F10 pages | Esc: back to the workspace",
            font::SMALL,
            DIM,
        ))
        .id();
    commands.entity(cmd).add_children(&[command_line, hint]);
    let security = commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            flex_shrink: 0.0,
            ..default()
        })
        .id();
    commands.entity(root).add_child(security);
    rule(&mut commands, root);
    let area = commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            flex_grow: 1.0,
            min_height: px(0.0),
            row_gap: px(4.0),
            overflow: Overflow::clip(),
            ..default()
        })
        .id();
    commands.entity(root).add_child(area);
    rule(&mut commands, root);
    let views_row = row(&mut commands, root, 12.0);
    for k in FOOTER_VIEWS {
        let e = commands
            .spawn((ViewLine(k), line("", font::SMALL, DIM)))
            .id();
        commands.entity(views_row).add_child(e);
    }
    // The function key row (20.5.2), clickable.
    let keys_row = row(&mut commands, root, 12.0);
    let mut keys = Vec::new();
    for (_, f) in FUNCTION_KEYS {
        let e = commands
            .spawn((
                line(
                    format!("{} {}", f.code(), f.name().to_uppercase()),
                    font::BODY,
                    DIM,
                ),
                Hovered::default(),
                Tooltip(format!("{} {} ({})", f.code(), f.name(), f.code())),
            ))
            .observe(
                move |mut ev: On<PointerClick>, mut route: ResMut<PdoombergRoute>| {
                    ev.propagate(false);
                    if ev.button == PointerButton::Primary && route.function != f {
                        route.function = f;
                    }
                },
            )
            .id();
        commands.entity(keys_row).add_child(e);
        keys.push((f, e));
    }
    let esc = commands.spawn(line("ESC MAP", font::BODY, DIM)).id();
    commands.entity(keys_row).add_child(esc);
    commands.insert_resource(PdoombergUi {
        root,
        status,
        command_line,
        security,
        area,
        keys,
        built: None,
        main_table: None,
    });
}

/// F2 to F10 open their pages, only while the terminal is open (D517) and not while the command
/// bar has the keyboard or a Ctrl or Alt chord is held.
fn function_keys(
    keys: Res<ButtonInput<KeyCode>>,
    capture: Res<KeyboardCapture>,
    router: Res<Router>,
    mut route: ResMut<PdoombergRoute>,
) {
    if router.current != Screen::Pdoomberg || capture.0 || modifier_held(&keys) {
        return;
    }
    for (k, f) in FUNCTION_KEYS {
        if keys.just_pressed(k) && route.function != f {
            route.function = f;
        }
    }
}

/// A page opened while the terminal is up (a link in it, or on a hover card over it) shows in
/// the workspace, so the terminal steps aside (D517).
fn leave_on_open_page(mut open: MessageReader<OpenPage>, mut router: ResMut<Router>) {
    if open.read().count() > 0 && router.current == Screen::Pdoomberg {
        router.current = Screen::Map;
    }
}

/// The security line of the loaded company (20.5.2): ticker, name, industry, last and change,
/// EFV band, rating and the next earnings; a private company's value band instead of a price.
pub fn security_text(v: &sim::SimViews, index: &NameIndex, id: CompanyId) -> String {
    let Some(r) = v.company_rows.get().rows.iter().find(|r| r.id == id) else {
        return format!("{}: not in the game", index.title(&PageRef::Company(id)));
    };
    let industry = index.title(&PageRef::Industry(r.industry));
    let t = if r.ticker.is_empty() { "-" } else { &r.ticker };
    let price = match v.quotes.get().get(id) {
        Some(q) => format!(
            "LAST {}  CHG {}  EFV {}",
            format::price(q.last),
            format::gain(q.change_pct, crate::table::GainUnit::Percent),
            format::band_in(Unit::Price, q.efv_low, q.efv_high)
        ),
        None => format!(
            "NOT QUOTED  VALUE {}",
            format::figure_in(r.value, Unit::Money)
        ),
    };
    format!(
        "{t}  {}  {}  {price}  RATING {}  NEXT EARNINGS {}",
        r.name.to_uppercase(),
        industry.to_uppercase(),
        r.rating.label(),
        format::date(v.clock().next_release.date()),
    )
}

/// Rebuilds the function page and the security line when the route changes.
#[allow(clippy::too_many_arguments)]
fn draw_page(
    mut commands: Commands,
    mut ui: ResMut<PdoombergUi>,
    route: Res<PdoombergRoute>,
    views: Res<Views>,
    index: Res<NameIndex>,
    controls: Res<RunnerControls>,
) {
    if ui.built == Some(*route) {
        return;
    }
    let area = ui.area;
    commands.entity(area).despawn_children();
    commands.entity(ui.security).despawn_children();
    if let Some(id) = route.company {
        spawn_live_text(
            &mut commands,
            ui.security,
            font::BODY,
            color::TEXT,
            Live::new(
                &[ViewKey::Quotes, ViewKey::CompanyRows, ViewKey::Clock],
                move |c| LiveModel::Text(security_text(c.views, c.index, id)),
            )
            .throttle(pages::QUOTES_REFRESH_SECS),
            &views,
            &index,
            &controls,
        );
    }
    // The page holds only its content (F4 only the lock): the command line and the lit key
    // name the page.
    let env = Env {
        views: &views,
        index: &index,
        controls: &controls,
    };
    ui.main_table = pages::build(&mut commands, area, &env, *route);
    ui.built = Some(*route);
}

/// The company a row of a Pdoomberg table is about: the first cell that links to a company.
pub fn row_company(t: &Table, row: usize) -> Option<CompanyId> {
    let m = t.model();
    (0..m.columns.len()).find_map(|c| match m.get(row, c).and_then(|x| x.link()) {
        Some(PageRef::Company(id)) => Some(*id),
        _ => None,
    })
}

/// Row clicks on the page's main table: on F2 a click watches or unwatches the company (M7.8;
/// design fix 8); a right-click on any page loads it.
fn row_clicks(
    mut clicks: MessageReader<TableRowClicked>,
    ui: Res<PdoombergUi>,
    tables: Query<&Table>,
    controls: Res<RunnerControls>,
    mut route: ResMut<PdoombergRoute>,
    mut w: MessageWriter<SimControl>,
) {
    for c in clicks.read() {
        if Some(c.table) != ui.main_table {
            continue;
        }
        let Some(id) = tables.get(c.table).ok().and_then(|t| row_company(t, c.row)) else {
            continue;
        };
        if c.secondary {
            if route.company != Some(id) {
                route.company = Some(id);
            }
        } else if route.function == PdbFunction::F2 {
            w.write(SimControl(if controls.watchlist.contains(&id) {
                Control::WatchlistRemove(id)
            } else {
                Control::WatchlistAdd(id)
            }));
        }
    }
}

fn mark_keys(ui: Res<PdoombergUi>, route: Res<PdoombergRoute>, mut texts: Query<&mut TextColor>) {
    for &(f, e) in &ui.keys {
        let want = if f == route.function {
            color::TEXT
        } else {
            DIM
        };
        if let Ok(mut c) = texts.get_mut(e)
            && c.0 != want
        {
            c.0 = want;
        }
    }
}

/// The status bar: date and hour, speed, and the alert count (20.5.2 (A)).
fn show_status(
    ui: Res<PdoombergUi>,
    views: Res<Views>,
    board: Res<AlertBoard>,
    mut texts: Query<&mut Text>,
) {
    if !(views.is_changed() || board.is_changed()) {
        return;
    }
    let c = views.clock();
    let alerts: usize = board.entries.iter().map(|e| e.instances.len()).sum();
    let speed = if c.paused {
        "PAUSED".to_owned()
    } else {
        format!("SPEED {}", c.speed)
    };
    let s = format!(
        "{} {} {:02}:00  {speed}  ALERTS {alerts}",
        c.weekday.short_name().to_uppercase(),
        format::date(c.date).to_uppercase(),
        c.hour
    );
    if let Ok(mut t) = texts.get_mut(ui.status)
        && t.0 != s
    {
        t.0 = s;
    }
}

/// The command line: the route as a terminal command.
fn show_command_line(
    ui: Res<PdoombergUi>,
    route: Res<PdoombergRoute>,
    index: Res<NameIndex>,
    mut texts: Query<&mut Text>,
) {
    let who = route.company.map_or(String::new(), |c| {
        let p = PageRef::Company(c);
        let t = index
            .entry(&p)
            .and_then(|e| e.alias.clone())
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| index.title(&p));
        format!("{t} ")
    });
    let s = format!(
        "> {who}{} <GO>   {}",
        route.function.code(),
        route.function.name().to_uppercase()
    );
    if let Ok(mut t) = texts.get_mut(ui.command_line)
        && t.0 != s
    {
        t.0 = s;
    }
}
