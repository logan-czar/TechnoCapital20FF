//! The floating window layer (M8; D635): the map fills the main area and the workspace floats
//! over it as windows, each holding an M9 pane tree with its panes, histories and breadcrumbs.
//! A window moves by its title bar, resizes from its bottom-right grip, comes to the top and
//! takes focus on a press, minimizes to the dock at the bottom of the area, and closes (the last
//! one stays). H hides or shows every window; Ctrl+N opens a new one, Ctrl+M minimizes the
//! focused one and Ctrl+Shift+W closes it.
//!
//! A press on a window goes to the window (bevy_ui picks the top node); the layer node itself
//! lets the pointer through, so a press anywhere else reaches the map below.

use bevy::picking::hover::Hovered;
use bevy::prelude::*;

use super::model::{TITLE_BAR_H, WINDOW_BORDER, WindowId, Workspace};
use super::{WorkspaceUi, spawn_node};
use crate::command::index::NameIndex;
use crate::pages::PageRef;
use crate::ui::rail::{Router, Screen};
use crate::ui::theme::{self, Tooltip, color, font};

/// A window command, from its frame, a key or the command bar.
#[derive(Message, Debug, Clone, PartialEq)]
pub enum WindowAction {
    /// Bring to the top and focus.
    Raise(WindowId),
    /// Move by a logical pixel delta.
    Move(WindowId, Vec2),
    /// Resize from the bottom-right corner by a delta.
    Resize(WindowId, Vec2),
    Minimize(Option<WindowId>),
    Close(Option<WindowId>),
    /// A new window showing the page (the World page when none).
    New(Option<PageRef>),
    ToggleHidden,
}

/// A window's frame: its title text and the body the pane tree goes in.
#[derive(Component, Debug, Clone, Copy)]
pub struct WindowFrame {
    pub window: WindowId,
    pub title: Entity,
    pub bar: Entity,
    pub body: Entity,
}

/// The dock of minimized windows, at the bottom left of the main area.
#[derive(Component, Debug, Clone, Copy)]
pub struct WindowDock;

/// What the dock was last drawn with.
#[derive(Resource, Debug, Default, Clone, PartialEq)]
pub struct DockDrawn(Vec<(WindowId, String)>, bool);

/// Spawns one frame per window with its pane tree, replacing the old ones.
pub(super) fn spawn_windows(commands: &mut Commands, layer: Entity, ws: &Workspace) {
    commands.entity(layer).despawn_children();
    for w in ws.windows() {
        let (frame, body) = spawn_window(commands, w.id);
        let tree = spawn_node(commands, &w.root);
        commands.entity(body).add_child(tree);
        commands.entity(layer).add_child(frame);
    }
}

fn window_button(commands: &mut Commands, label: &str, tip: &str, action: WindowAction) -> Entity {
    commands
        .spawn((
            Node {
                padding: UiRect::horizontal(px(5.0)),
                ..default()
            },
            Hovered::default(),
            Tooltip(tip.to_owned()),
            children![theme::text_line(label, font::SMALL, color::TEXT)],
        ))
        .observe(
            move |mut ev: On<PointerClick>, mut w: MessageWriter<WindowAction>| {
                ev.propagate(false);
                if ev.button == PointerButton::Primary {
                    w.write(action.clone());
                }
            },
        )
        .id()
}

fn spawn_window(commands: &mut Commands, id: WindowId) -> (Entity, Entity) {
    let title = commands
        .spawn(theme::text_line("", font::SMALL, color::TEXT_MUTED))
        .id();
    let spacer = commands
        .spawn(Node {
            flex_grow: 1.0,
            ..default()
        })
        .id();
    let min = window_button(
        commands,
        "_",
        "Minimize the window to the dock (Ctrl+M)",
        WindowAction::Minimize(Some(id)),
    );
    let close = window_button(
        commands,
        "X",
        "Close the window and its panes (Ctrl+Shift+W)",
        WindowAction::Close(Some(id)),
    );
    let bar = commands
        .spawn((
            Node {
                height: px(TITLE_BAR_H),
                min_height: px(TITLE_BAR_H),
                flex_direction: FlexDirection::Row,
                align_items: AlignItems::Center,
                padding: UiRect::horizontal(px(6.0)),
                column_gap: px(4.0),
                overflow: Overflow::clip(),
                ..default()
            },
            BackgroundColor(color::PANEL_RAISED),
            Hovered::default(),
            Tooltip("Drag to move the window; H hides every window".into()),
        ))
        .add_children(&[title, spacer, min, close])
        .observe(
            move |mut ev: On<PointerDrag>, mut w: MessageWriter<WindowAction>| {
                ev.propagate(false);
                if ev.button == PointerButton::Primary {
                    w.write(WindowAction::Move(id, ev.delta));
                }
            },
        )
        .id();
    let body = commands
        .spawn(Node {
            flex_grow: 1.0,
            min_height: px(0.0),
            min_width: px(0.0),
            flex_direction: FlexDirection::Row,
            ..default()
        })
        .id();
    let grip = commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                right: px(0.0),
                bottom: px(0.0),
                width: px(GRIP),
                height: px(GRIP),
                ..default()
            },
            BackgroundColor(color::BORDER),
            Hovered::default(),
            Tooltip("Drag to resize the window".into()),
            ZIndex(5),
        ))
        .observe(
            move |mut ev: On<PointerDrag>, mut w: MessageWriter<WindowAction>| {
                ev.propagate(false);
                if ev.button == PointerButton::Primary {
                    w.write(WindowAction::Resize(id, ev.delta));
                }
            },
        )
        .id();
    let frame = commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                flex_direction: FlexDirection::Column,
                border: UiRect::all(px(WINDOW_BORDER)),
                overflow: Overflow::clip(),
                ..default()
            },
            BackgroundColor(color::PANEL),
            BorderColor::all(color::BORDER),
            ZIndex(0),
        ))
        .add_children(&[bar, body, grip])
        .observe(
            move |ev: On<PointerPress>, mut w: MessageWriter<WindowAction>| {
                if ev.button != PointerButton::Secondary {
                    w.write(WindowAction::Raise(id));
                }
            },
        )
        .id();
    commands.entity(frame).insert(WindowFrame {
        window: id,
        title,
        bar,
        body,
    });
    (frame, body)
}

/// The resize grip's size in logical pixels.
pub const GRIP: f32 = 10.0;

/// Applies the window commands to the model.
pub(super) fn apply_window_actions(
    mut msgs: MessageReader<WindowAction>,
    mut ws: ResMut<Workspace>,
) {
    for a in msgs.read() {
        let active = ws.active_window();
        match a {
            WindowAction::Raise(id) => {
                ws.raise(*id);
            }
            WindowAction::Move(id, d) => {
                ws.move_window(*id, d.x, d.y);
            }
            WindowAction::Resize(id, d) => {
                ws.resize_window(*id, d.x, d.y);
            }
            WindowAction::Minimize(id) => {
                ws.minimize(id.unwrap_or(active));
            }
            WindowAction::Close(id) => {
                ws.close_window(id.unwrap_or(active));
            }
            WindowAction::New(page) => {
                ws.new_window(page.clone().unwrap_or(PageRef::World));
            }
            WindowAction::ToggleHidden => ws.toggle_hidden(),
        }
    }
}

/// Places, stacks and titles the window frames, and draws the dock.
#[allow(clippy::too_many_arguments)]
pub(super) fn sync_windows(
    mut commands: Commands,
    ws: Res<Workspace>,
    ui: Res<WorkspaceUi>,
    index: Res<NameIndex>,
    mut frames: Query<(&WindowFrame, &mut Node, &mut ZIndex, &mut BorderColor)>,
    mut texts: Query<&mut Text>,
    mut bars: Query<&mut BackgroundColor>,
    mut dock_drawn: ResMut<DockDrawn>,
    mut layer: Query<&mut Visibility>,
    added: Query<(), Added<WindowFrame>>,
    router: Res<Router>,
) {
    if !(ws.is_changed() || index.is_changed() || router.is_changed() || !added.is_empty()) {
        return;
    }
    let order: Vec<WindowId> = ws.windows().iter().map(|w| w.id).collect();
    let active = ws.active_window();
    for (f, mut node, mut z, mut border) in &mut frames {
        let Some(w) = ws.window(f.window) else {
            continue;
        };
        let r = w.rect;
        let display = if w.minimized {
            Display::None
        } else {
            Display::Flex
        };
        let want = (px(r.x), px(r.y), px(r.w), px(r.h));
        if (node.left, node.top, node.width, node.height) != want || node.display != display {
            node.left = want.0;
            node.top = want.1;
            node.width = want.2;
            node.height = want.3;
            node.display = display;
        }
        let zi = ZIndex(order.iter().position(|id| *id == f.window).unwrap_or(0) as i32);
        if *z != zi {
            *z = zi;
        }
        let focused = f.window == active;
        let edge = if focused { color::FOCUS } else { color::BORDER };
        if border.top != edge {
            *border = BorderColor::all(edge);
        }
        let title = window_title(&ws, f.window, &index);
        if let Ok(mut t) = texts.get_mut(f.title)
            && t.0 != title
        {
            t.0 = title;
        }
        let bar = if focused {
            color::HOVER
        } else {
            color::PANEL_RAISED
        };
        if let Ok(mut b) = bars.get_mut(f.bar)
            && b.0 != bar
        {
            b.0 = bar;
        }
    }
    if let Ok(mut v) = layer.get_mut(ui.root) {
        let want = if ws.hidden() {
            Visibility::Hidden
        } else {
            Visibility::Inherited
        };
        if *v != want {
            *v = want;
        }
    }
    // The dock sits over the map, never over full-screen Pdoomberg (it has a global z-index
    // above Pdoomberg's): hidden while Pdoomberg is up, so it cannot be clicked there either.
    if let Ok(mut v) = layer.get_mut(ui.dock) {
        let want = if router.current == Screen::Pdoomberg {
            Visibility::Hidden
        } else {
            Visibility::Inherited
        };
        if *v != want {
            *v = want;
        }
    }
    // The dock: each minimized window, and a note while every window is hidden.
    let want = DockDrawn(
        ws.windows()
            .iter()
            .filter(|w| w.minimized)
            .map(|w| (w.id, window_title(&ws, w.id, &index)))
            .collect(),
        ws.hidden(),
    );
    if *dock_drawn != want {
        commands.entity(ui.dock).despawn_children();
        if want.1 {
            let e = dock_chip(
                &mut commands,
                "Windows hidden: H shows them".into(),
                WindowAction::ToggleHidden,
            );
            commands.entity(ui.dock).add_child(e);
        }
        for (id, title) in &want.0 {
            let e = dock_chip(
                &mut commands,
                format!("[{title}]"),
                WindowAction::Raise(*id),
            );
            commands.entity(ui.dock).add_child(e);
        }
        *dock_drawn = want;
    }
}

fn dock_chip(commands: &mut Commands, label: String, action: WindowAction) -> Entity {
    commands
        .spawn((
            Node {
                padding: UiRect::axes(px(6.0), px(2.0)),
                border: UiRect::all(px(1.0)),
                ..default()
            },
            BackgroundColor(color::PANEL_RAISED),
            BorderColor::all(color::BORDER),
            Hovered::default(),
            Tooltip("Restore the window".into()),
            children![theme::text_line(label, font::SMALL, color::TEXT)],
        ))
        .observe(
            move |mut ev: On<PointerClick>, mut w: MessageWriter<WindowAction>| {
                ev.propagate(false);
                if ev.button == PointerButton::Primary {
                    w.write(action.clone());
                }
            },
        )
        .id()
}

/// A window's title: its focused pane's page, and how many panes it holds.
pub fn window_title(ws: &Workspace, id: WindowId, index: &NameIndex) -> String {
    let Some(w) = ws.window(id) else {
        return String::new();
    };
    let page = ws
        .page(w.focused)
        .map(|p| index.title(p))
        .unwrap_or_default();
    match w.pane_ids().len() {
        1 => page,
        n => format!("{page} (+{} panes)", n - 1),
    }
}
