//! The outliner (build-plan M7.8; spec 8 main screen "outliner with a watchlist"; 20-ui 20.2.3):
//! the watchlist, the waiting alerts and the latest event log lines, folded with Tab. In debug
//! builds only, the Omniscient toggle sits at its foot (spec 1 Information; design fix 8); release
//! builds do not build it.

use bevy::prelude::*;
use sim::Control;

use super::alerts::{AlertBoard, EventLog, kind_name, level_name, target};
use super::rail::Navigate;
use super::theme::{self, Tooltip, color, font, size};
use super::{KeyboardCapture, ShellLayout, SpawnLayout, UiSystems, modifier_held};
use crate::bridge::{RunnerControls, SimControl};
use crate::command::index::NameIndex;

/// Event log lines the outliner shows.
pub const OUTLINER_LOG_LINES: usize = 12;

#[derive(Component)]
struct WatchlistList;
#[derive(Component)]
struct AlertList;
#[derive(Component)]
struct LogList;
/// A rebuilt line of one of the lists.
#[derive(Component)]
struct ListLine;

/// The Omniscient toggle; exists only in debug builds.
#[derive(Component)]
pub struct OmniscientToggle;

/// Whether the outliner is folded (Tab, 20-ui 20.2.3).
#[derive(Resource, Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct OutlinerFolded(pub bool);

pub struct OutlinerPlugin;

impl Plugin for OutlinerPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<OutlinerFolded>()
            .init_resource::<crate::pace::UiPace>()
            .add_systems(Startup, spawn_outliner.after(SpawnLayout))
            .add_systems(Update, fold_key.in_set(UiSystems::Input))
            .add_systems(
                Update,
                (
                    draw_watchlist.run_if(
                        resource_changed::<RunnerControls>.or_eager(resource_changed::<NameIndex>),
                    ),
                    draw_alerts.run_if(resource_changed::<AlertBoard>),
                    draw_log,
                    show_fold.run_if(resource_changed::<OutlinerFolded>),
                )
                    .in_set(UiSystems::Show),
            );
        #[cfg(debug_assertions)]
        app.add_systems(
            Update,
            show_omniscient
                .run_if(resource_changed::<RunnerControls>)
                .in_set(UiSystems::Show),
        );
    }
}

fn section(commands: &mut Commands, parent: Entity, title: &str, marker: impl Bundle) {
    let head = commands
        .spawn(theme::text(title, font::BODY, color::CYAN))
        .id();
    let list = commands
        .spawn((
            marker,
            Node {
                flex_direction: FlexDirection::Column,
                row_gap: px(2.0),
                margin: UiRect::bottom(px(size::PAD)),
                ..default()
            },
        ))
        .id();
    let rule = commands.spawn(theme::rule()).id();
    commands.entity(parent).add_children(&[head, rule, list]);
}

fn spawn_outliner(mut commands: Commands, layout: Res<ShellLayout>) {
    let o = layout.outliner;
    section(&mut commands, o, "Watchlist", WatchlistList);
    section(&mut commands, o, "Alerts", AlertList);
    section(&mut commands, o, "Log", LogList);
    #[cfg(debug_assertions)]
    {
        let toggle = commands
            .spawn((
                theme::button("Omniscient: off", color::AMBER),
                OmniscientToggle,
                Tooltip("Debug builds only: show every true value (spec 1)".into()),
            ))
            .observe(
                |_: On<PointerClick>,
                 controls: Res<RunnerControls>,
                 mut w: MessageWriter<SimControl>| {
                    w.write(SimControl(Control::SetOmniscient(!controls.omniscient)));
                },
            )
            .id();
        let foot = commands
            .spawn(Node {
                margin: UiRect::top(Val::Auto),
                flex_direction: FlexDirection::Column,
                ..default()
            })
            .add_child(toggle)
            .id();
        commands.entity(o).add_child(foot);
    }
}

fn fold_key(
    keys: Res<ButtonInput<KeyCode>>,
    capture: Res<KeyboardCapture>,
    mut folded: ResMut<OutlinerFolded>,
) {
    // Ctrl+Tab moves pane focus (D453).
    if capture.0 || modifier_held(&keys) {
        return;
    }
    if keys.just_pressed(KeyCode::Tab) {
        folded.0 = !folded.0;
    }
}

fn show_fold(folded: Res<OutlinerFolded>, layout: Res<ShellLayout>, mut nodes: Query<&mut Node>) {
    if let Ok(mut n) = nodes.get_mut(layout.outliner) {
        n.display = if folded.0 {
            Display::None
        } else {
            Display::Flex
        };
    }
}

fn clear_lines(commands: &mut Commands, list: Entity, children: &Query<&Children>) {
    if let Ok(c) = children.get(list) {
        for &e in c {
            commands.entity(e).despawn();
        }
    }
}

/// The watchlist: each company a link to its page (M9 A2) with its last price; right-click
/// removes it.
fn draw_watchlist(
    mut commands: Commands,
    controls: Res<RunnerControls>,
    index: Res<NameIndex>,
    views: Res<crate::bridge::Views>,
    list: Query<Entity, With<WatchlistList>>,
    children: Query<&Children>,
) {
    let Ok(list) = list.single() else {
        return;
    };
    clear_lines(&mut commands, list, &children);
    if controls.watchlist.is_empty() {
        let e = commands
            .spawn((
                ListLine,
                theme::muted("Empty. Click a company in Pdoomberg F2 to watch it."),
            ))
            .id();
        commands.entity(list).add_child(e);
    }
    for &id in &controls.watchlist {
        let page = crate::pages::PageRef::Company(id);
        let price = views
            .quotes
            .get()
            .get(id)
            .map_or("-".to_owned(), |q| crate::table::format::price(q.last));
        let name = commands
            .spawn((
                crate::links::link_sized(index.title(&page), page, font::BODY),
                Tooltip("Click: the company page (Shift: new pane); right-click: remove".into()),
            ))
            .observe(
                move |ev: On<PointerClick>, mut w: MessageWriter<SimControl>| {
                    if ev.button == PointerButton::Secondary {
                        w.write(SimControl(Control::WatchlistRemove(id)));
                    }
                },
            )
            .id();
        let price = commands
            .spawn(theme::text_line(price, font::SMALL, color::TEXT_MUTED))
            .id();
        let line = commands
            .spawn((
                ListLine,
                Node {
                    flex_direction: FlexDirection::Row,
                    column_gap: px(8.0),
                    ..default()
                },
            ))
            .add_children(&[name, price])
            .id();
        commands.entity(list).add_child(line);
    }
}

fn draw_alerts(
    mut commands: Commands,
    board: Res<AlertBoard>,
    list: Query<Entity, With<AlertList>>,
    children: Query<&Children>,
) {
    let Ok(list) = list.single() else {
        return;
    };
    clear_lines(&mut commands, list, &children);
    if board.entries.is_empty() {
        let e = commands
            .spawn((ListLine, theme::muted("None waiting.")))
            .id();
        commands.entity(list).add_child(e);
    }
    for entry in &board.entries {
        let kind = entry.kind;
        let line = commands
            .spawn((
                ListLine,
                theme::button(
                    format!(
                        "{} x{} ({})",
                        kind_name(kind),
                        entry.instances.len(),
                        level_name(entry.level)
                    ),
                    color::MAGENTA,
                ),
            ))
            .observe(
                move |_: On<PointerClick>,
                      mut board: ResMut<AlertBoard>,
                      mut nav: MessageWriter<Navigate>,
                      router: Res<super::rail::Router>| {
                    if router.current != target(kind) {
                        nav.write(Navigate(target(kind)));
                    }
                    board.clear(kind);
                },
            )
            .id();
        commands.entity(list).add_child(line);
    }
}

/// Redraws the log's lines when it changes; while the sim fast-forwards (a quarter's notices
/// every few frames), at most every [`crate::pace::LIVE_TEXT_SECS`] (D773).
fn draw_log(
    mut commands: Commands,
    log: Res<EventLog>,
    list: Query<Entity, With<LogList>>,
    children: Query<&Children>,
    mut pace: ResMut<crate::pace::UiPace>,
    mut paced: Local<crate::pace::Paced>,
) {
    if !paced.due(
        log.is_changed(),
        &mut pace,
        crate::pace::LIVE_TEXT_SECS,
        false,
    ) {
        return;
    }
    let Ok(list) = list.single() else {
        return;
    };
    clear_lines(&mut commands, list, &children);
    let start = log.0.len().saturating_sub(OUTLINER_LOG_LINES);
    for line in &log.0[start..] {
        let e = commands
            .spawn((
                ListLine,
                theme::text(line.clone(), font::SMALL, color::TEXT_MUTED),
            ))
            .id();
        commands.entity(list).add_child(e);
    }
}

#[cfg(debug_assertions)]
fn show_omniscient(
    controls: Res<RunnerControls>,
    toggle: Query<(&Children, &mut theme::ButtonLook), With<OmniscientToggle>>,
    mut texts: Query<&mut Text>,
) {
    for (children, mut look) in toggle {
        look.active = controls.omniscient;
        let label = if controls.omniscient {
            "Omniscient: ON"
        } else {
            "Omniscient: off"
        };
        if let Some(mut t) = children.first().and_then(|&e| texts.get_mut(e).ok()) {
            label.clone_into(&mut t.0);
        }
    }
}
