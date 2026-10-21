//! The alert row, toasts, the event log and the alert settings (build-plan M7.6; spec 8 time
//! controls row; 20-ui 20.2.1, 20.4.1; D6).
//!
//! An `Alert` notice arrives with its level (D6): **Pause** and **Notify** put an icon in the
//! alert row (with a count and one tooltip line per instance) and a toast; **Log** only writes the
//! event log; **Off** posts nothing. Icons sort by urgency, Pause first. Clicking an icon opens
//! its target and clears it; right-clicking dismisses it. Earnings day also clears the next day
//! (20.4.1 "Opened, or next day"). The settings menu sets each alert to Pause, Notify, Log or
//! Off; Earnings day and Quarterly recap default to Pause (spec 8).

use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use sim::Control;
use sim::Notice;
use sim::time::DateTime;
use sim::world::{AlertKind, AlertLevel, AlertPayload, PauseReason};

use super::rail::{Navigate, Screen};
use super::theme::{self, ButtonLook, Tooltip, color, font, size};
use super::top_bar::{AlertRowRoot, skip_name};
use super::{DemoTables, Menu, OpenMenu, ShellLayout, SpawnLayout, UiSystems};
use crate::bridge::{RunnerControls, SimControl, SimNotice};

/// Toasts fade after this many seconds (20-ui 20.2.1 (T)).
pub const TOAST_SECONDS: f32 = 6.0;
/// Most toasts shown at once; older ones go first.
pub const MAX_TOASTS: usize = 5;
/// Event log lines kept.
pub const LOG_LINES: usize = 200;

/// The four levels every alert can be set to; all five alerts are settable in the MVP (spec 8;
/// D306).
pub const LEVELS: [AlertLevel; 4] = [
    AlertLevel::Pause,
    AlertLevel::Notify,
    AlertLevel::Log,
    AlertLevel::Off,
];

pub fn kind_name(kind: AlertKind) -> &'static str {
    match kind {
        AlertKind::EarningsDay => "Earnings day",
        AlertKind::QuarterlyRecap => "Quarterly recap",
        AlertKind::PlanLock => "Plan lock",
        AlertKind::BankruptcyInWatchlist => "Bankruptcy in watchlist",
        AlertKind::WorldEvent => "World event",
    }
}

/// The icon tag (the font has no icons; 20-ui 20.4.1 icons as letters, D302).
fn kind_tag(kind: AlertKind) -> &'static str {
    match kind {
        AlertKind::EarningsDay => "$",
        AlertKind::QuarterlyRecap => "RCP",
        AlertKind::PlanLock => "LCK",
        AlertKind::BankruptcyInWatchlist => "BK!",
        AlertKind::WorldEvent => "W",
    }
}

pub fn level_name(level: AlertLevel) -> &'static str {
    match level {
        AlertLevel::Pause => "Pause",
        AlertLevel::Notify => "Notify",
        AlertLevel::Log => "Log",
        AlertLevel::Off => "Off",
    }
}

fn level_color(level: AlertLevel) -> Color {
    match level {
        AlertLevel::Pause => color::MAGENTA,
        AlertLevel::Notify => color::AMBER,
        AlertLevel::Log | AlertLevel::Off => color::TEXT_MUTED,
    }
}

/// The screen an alert opens (D304).
pub fn target(kind: AlertKind) -> Screen {
    match kind {
        AlertKind::EarningsDay => Screen::Pdoomberg,
        AlertKind::QuarterlyRecap | AlertKind::PlanLock => Screen::Recap,
        AlertKind::BankruptcyInWatchlist => Screen::Company,
        AlertKind::WorldEvent => Screen::News,
    }
}

/// One instance of an alert.
#[derive(Debug, Clone, PartialEq)]
pub struct AlertInstance {
    pub at: DateTime,
    pub payload: AlertPayload,
}

/// One icon of the alert row: a kind, the level it fired at and its instances.
#[derive(Debug, Clone, PartialEq)]
pub struct AlertEntry {
    pub kind: AlertKind,
    pub level: AlertLevel,
    pub instances: Vec<AlertInstance>,
}

/// The alerts waiting in the row, sorted by urgency (Pause first, then by kind).
#[derive(Resource, Debug, Default, Clone, PartialEq)]
pub struct AlertBoard {
    pub entries: Vec<AlertEntry>,
}

impl AlertBoard {
    fn add(&mut self, kind: AlertKind, level: AlertLevel, inst: AlertInstance) {
        match self.entries.iter_mut().find(|e| e.kind == kind) {
            Some(e) => {
                e.level = e.level.min(level);
                e.instances.push(inst);
            }
            None => self.entries.push(AlertEntry {
                kind,
                level,
                instances: vec![inst],
            }),
        }
        self.entries.sort_by_key(|e| (e.level, e.kind));
    }

    pub fn clear(&mut self, kind: AlertKind) {
        self.entries.retain(|e| e.kind != kind);
    }

    pub fn get(&self, kind: AlertKind) -> Option<&AlertEntry> {
        self.entries.iter().find(|e| e.kind == kind)
    }
}

/// Every alert, pause and calendar notice as a line of text, newest last (the event log, 20.2.2
/// row 14; Log-level alerts go only here).
#[derive(Resource, Debug, Default, Clone)]
pub struct EventLog(pub Vec<String>);

impl EventLog {
    fn push(&mut self, at: DateTime, line: String) {
        self.0.push(format!("{} {line}", short_time(at)));
        if self.0.len() > LOG_LINES {
            let extra = self.0.len() - LOG_LINES;
            self.0.drain(..extra);
        }
    }
}

fn short_time(t: DateTime) -> String {
    let d = t.date();
    format!("{:04}-{:02}-{:02} {:02}h", d.year, d.month, d.day, t.hour())
}

/// A toast and when it was born.
#[derive(Component)]
struct Toast {
    born: f32,
}

/// An icon of the alert row, for one alert kind.
#[derive(Component)]
pub struct AlertIcon(pub AlertKind);

#[derive(Component)]
struct AlertSettingsRoot;

#[derive(Component)]
struct LevelButton(AlertKind, AlertLevel);

pub struct AlertsPlugin;

impl Plugin for AlertsPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<AlertBoard>()
            .init_resource::<EventLog>()
            .add_systems(Startup, spawn_settings.after(SpawnLayout))
            .add_systems(Update, read_notices.in_set(UiSystems::Input))
            .add_systems(
                Update,
                (
                    draw_alert_row.run_if(resource_changed::<AlertBoard>),
                    fade_toasts,
                    show_settings.run_if(
                        resource_changed::<OpenMenu>.or_eager(resource_changed::<RunnerControls>),
                    ),
                )
                    .in_set(UiSystems::Show),
            );
    }
}

/// The time of the latest tick, for notices that carry none.
#[derive(Default)]
struct LastTick(DateTime);

/// Turns notices into alert icons, toasts and log lines.
#[allow(clippy::too_many_arguments)]
fn read_notices(
    mut notices: MessageReader<SimNotice>,
    mut board: ResMut<AlertBoard>,
    mut log: ResMut<EventLog>,
    mut last: Local<LastTick>,
    names: Res<DemoTables>,
    layout: Option<Res<ShellLayout>>,
    time: Res<Time>,
    mut toasts: Query<(Entity, &Toast)>,
    mut commands: Commands,
) {
    for SimNotice(n) in notices.read() {
        match n {
            Notice::TickDone(t) => last.0 = *t,
            Notice::Alert {
                kind,
                level,
                payload,
            } => {
                // The alert fires inside its tick, before that tick's TickDone.
                let at = last.0.next();
                let what = format!("{}{}", kind_name(*kind), payload_text(*payload, &names));
                log.push(at, format!("[{}] {what}", level_name(*level)));
                if matches!(level, AlertLevel::Pause | AlertLevel::Notify) {
                    board.add(
                        *kind,
                        *level,
                        AlertInstance {
                            at,
                            payload: *payload,
                        },
                    );
                    if let Some(layout) = &layout {
                        spawn_toast(
                            &mut commands,
                            layout.toasts,
                            &what,
                            *level,
                            time.elapsed_secs(),
                            &mut toasts,
                        );
                    }
                }
            }
            Notice::Paused(reason) => {
                let why = match reason {
                    PauseReason::Player => "by the player".to_owned(),
                    PauseReason::Alert(k) => format!("for {}", kind_name(*k)),
                    PauseReason::SkipDone(k) => format!("at the skip target ({})", skip_name(*k)),
                    PauseReason::Loaded => "after loading".to_owned(),
                };
                log.push(last.0.next(), format!("Paused {why}"));
            }
            Notice::DayDone(d) => {
                // Earnings day clears the day after it fired (20.4.1).
                if board
                    .get(AlertKind::EarningsDay)
                    .is_some_and(|e| e.instances.iter().all(|i| i.at.date() <= *d))
                {
                    board.clear(AlertKind::EarningsDay);
                }
            }
            Notice::MonthDone(m) => log.push(last.0.next(), format!("Month closed: {m}")),
            Notice::EarningsReleased(q) => {
                log.push(last.0.next(), format!("Earnings released for {q}"));
            }
            Notice::PlanLocked(q) => log.push(last.0.next(), format!("Plans locked for {q}")),
            Notice::StartupEvent(id) => log.push(last.0.next(), format!("Startup event #{}", id.0)),
            Notice::CompanyBorn(id) => {
                log.push(
                    last.0.next(),
                    format!("Founded: {}", names.company_name(*id)),
                );
            }
            Notice::IpoVote { company, passed } => log.push(
                last.0.next(),
                format!(
                    "IPO vote at {}: {}",
                    names.company_name(*company),
                    if *passed { "passed" } else { "failed" }
                ),
            ),
            Notice::CompanyListed(id) => {
                log.push(
                    last.0.next(),
                    format!("Listed: {}", names.company_name(*id)),
                );
            }
        }
    }
}

fn payload_text(p: AlertPayload, names: &DemoTables) -> String {
    match p {
        AlertPayload::None => String::new(),
        AlertPayload::Quarter(q) => format!(": {q}"),
        AlertPayload::Company(id) => format!(": {}", names.company_name(id)),
    }
}

fn spawn_toast(
    commands: &mut Commands,
    parent: Entity,
    what: &str,
    level: AlertLevel,
    now: f32,
    existing: &mut Query<(Entity, &Toast)>,
) {
    let mut old: Vec<_> = existing.iter().map(|(e, t)| (t.born, e)).collect();
    old.sort_by(|a, b| a.0.total_cmp(&b.0));
    let excess = (old.len() + 1).saturating_sub(MAX_TOASTS);
    for (_, e) in old.into_iter().take(excess) {
        commands.entity(e).despawn();
    }
    let c = level_color(level);
    let toast = commands
        .spawn((
            Toast { born: now },
            Node {
                flex_direction: FlexDirection::Column,
                padding: UiRect::all(px(size::PAD)),
                row_gap: px(2.0),
                border: UiRect::left(px(3.0)),
                ..default()
            },
            BackgroundColor(color::PANEL),
            BorderColor::all(c),
            Pickable::IGNORE,
            children![
                theme::text(level_name(level).to_uppercase(), font::SMALL, c),
                theme::body(what.to_owned()),
            ],
        ))
        .id();
    commands.entity(parent).add_child(toast);
}

fn fade_toasts(
    time: Res<Time>,
    mut commands: Commands,
    toasts: Query<(Entity, &Toast, &mut BackgroundColor)>,
) {
    let now = time.elapsed_secs();
    for (e, t, mut bg) in toasts {
        let age = now - t.born;
        if age >= TOAST_SECONDS {
            commands.entity(e).despawn();
        } else if age > TOAST_SECONDS - 1.0 {
            bg.0 = color::PANEL.with_alpha(TOAST_SECONDS - age);
        }
    }
}

/// Rebuilds the alert row's icons.
fn draw_alert_row(
    mut commands: Commands,
    board: Res<AlertBoard>,
    names: Res<DemoTables>,
    row: Query<Entity, With<AlertRowRoot>>,
    icons: Query<Entity, With<AlertIcon>>,
) {
    for e in &icons {
        commands.entity(e).despawn();
    }
    let Ok(row) = row.single() else {
        return;
    };
    for entry in &board.entries {
        let kind = entry.kind;
        let lines: Vec<String> = entry
            .instances
            .iter()
            .map(|i| {
                format!(
                    "{} {}{}",
                    short_time(i.at),
                    kind_name(kind),
                    payload_text(i.payload, &names)
                )
            })
            .collect();
        let tip = format!(
            "{} ({}): click to open, right-click to dismiss\n{}",
            kind_name(kind),
            level_name(entry.level),
            lines.join("\n")
        );
        let label = if entry.instances.len() > 1 {
            format!("{} {}", kind_tag(kind), entry.instances.len())
        } else {
            kind_tag(kind).to_owned()
        };
        let c = level_color(entry.level);
        let icon = commands
            .spawn((
                AlertIcon(kind),
                Node {
                    padding: UiRect::axes(px(7.0), px(2.0)),
                    border: UiRect::all(px(1.0)),
                    border_radius: BorderRadius::all(px(size::RADIUS)),
                    ..default()
                },
                BackgroundColor(c.with_alpha(0.18)),
                BorderColor::all(c),
                Hovered::default(),
                Tooltip(tip),
                children![theme::text(label, font::BODY, c)],
            ))
            .observe(
                move |ev: On<PointerClick>,
                      mut board: ResMut<AlertBoard>,
                      mut nav: MessageWriter<Navigate>,
                      router: Res<super::rail::Router>| {
                    if ev.button != PointerButton::Secondary && router.current != target(kind) {
                        nav.write(Navigate(target(kind)));
                    }
                    board.clear(kind);
                },
            )
            .id();
        commands.entity(row).add_child(icon);
    }
}

/// The alert settings drop-down: one row per alert, four level buttons each (spec 8).
fn spawn_settings(mut commands: Commands, layout: Res<ShellLayout>) {
    let root = commands
        .spawn((
            AlertSettingsRoot,
            theme::panel(Node {
                position_type: PositionType::Absolute,
                top: px(size::TOP_BAR),
                right: px(size::PAD),
                display: Display::None,
                ..default()
            }),
            GlobalZIndex(60),
        ))
        .id();
    commands.entity(layout.root).add_child(root);
    let title = commands.spawn(theme::title("Alert settings")).id();
    let hint = commands
        .spawn(theme::muted(
            "Pause: notify and pause after the tick. Notify: icon and toast. Log: event log only.",
        ))
        .id();
    commands.entity(root).add_children(&[title, hint]);
    for kind in AlertKind::ALL {
        let row = commands
            .spawn(Node {
                flex_direction: FlexDirection::Row,
                align_items: AlignItems::Center,
                column_gap: px(size::GAP),
                ..default()
            })
            .id();
        let name = commands
            .spawn((
                Node {
                    width: px(200.0),
                    ..default()
                },
                children![theme::body(kind_name(kind))],
            ))
            .id();
        commands.entity(row).add_child(name);
        for level in LEVELS {
            let b = commands
                .spawn((
                    theme::button(level_name(level), level_color(level)),
                    LevelButton(kind, level),
                ))
                .observe(
                    move |_: On<PointerClick>, mut w: MessageWriter<SimControl>| {
                        w.write(SimControl(Control::SetAlert { kind, level }));
                    },
                )
                .id();
            commands.entity(row).add_child(b);
        }
        commands.entity(root).add_child(row);
    }
    let close = commands
        .spawn((
            Node {
                margin: UiRect::top(px(4.0)),
                ..default()
            },
            children![theme::muted(
                "Every alert is settable in the MVP (spec 8). Esc closes."
            )],
        ))
        .id();
    commands.entity(root).add_child(close);
}

fn show_settings(
    menu: Res<OpenMenu>,
    controls: Res<RunnerControls>,
    mut root: Query<&mut Node, With<AlertSettingsRoot>>,
    mut buttons: Query<(&LevelButton, &mut ButtonLook)>,
) {
    let open = menu.0 == Some(Menu::AlertSettings);
    for mut n in &mut root {
        let want = if open { Display::Flex } else { Display::None };
        if n.display != want {
            n.display = want;
        }
    }
    for (b, mut look) in &mut buttons {
        let active = controls.alerts.get(b.0) == b.1;
        if look.active != active {
            look.active = active;
        }
    }
}
