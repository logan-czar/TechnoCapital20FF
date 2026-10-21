//! The tiling workspace (M9 A2; D450, D453): the main area splits into panes, each showing one
//! page ([`crate::pages`]) with its own back and forward history and a breadcrumb. Panes split
//! right or down, close, take focus on a click, and resize by dragging the divider between
//! them; layouts save by name and the last one comes back at the next start.
//!
//! The model is [`model::Workspace`] (pure, tested on its own); this module draws it with
//! bevy_ui and turns clicks and keys into model calls. Pdoomberg is not a pane: it stays a
//! full-screen terminal over the workspace ([`crate::ui::rail`]).
//!
//! Keyboard (also on the Settings page):
//!
//! | Keys | Action |
//! |---|---|
//! | Ctrl+K or ` | Command bar |
//! | Alt+Left, Backspace / Alt+Right | Back / forward in the focused pane |
//! | Ctrl+D / Ctrl+Shift+D | Split the focused pane right / down |
//! | Ctrl+W | Close the focused pane |
//! | Ctrl+Arrow | Focus the pane in that direction |
//! | Ctrl+Tab / Ctrl+Shift+Tab | Focus the next / previous pane |
//! | Ctrl+Shift+Arrow | Move the focused pane's divider |
//! | Ctrl+= / Ctrl+- / Ctrl+0 | Font larger / smaller / reset |
//! | Ctrl+J | Density compact or normal |
//! | Ctrl+, | Settings page |
//! | O, U, R, N (Shift: new pane) | Companies, Industries, Recap, News pages |

pub mod model;

use bevy::input::mouse::MouseScrollUnit;
use bevy::picking::hover::Hovered;
use bevy::prelude::*;

pub use model::{Axis, Dir, PaneId, SavedLayout, SavedNode, SplitId, Workspace};

use crate::bridge::Views;
use crate::command::index::NameIndex;
use crate::config::{Density, SectionsConfig, UiConfig};
use crate::pages::{
    PageBuild, PageKind, PageRef, PageRegistry, Refresh, spawn_sections, view_meta,
};
use crate::table::{Table, TableFocus};
use crate::ui::rail::{Router, Screen};
use crate::ui::screens::DemoTableEntities;
use crate::ui::theme::{self, Tooltip, color, font};
use crate::ui::{KeyboardCapture, ShellLayout, SpawnLayout, UiSystems, modifier_held};

/// Every shortcut, for the Settings page (D453; spec 20-ui 20.2.6 keys kept).
pub const SHORTCUTS: &[(&str, &str)] = &[
    (
        "Ctrl+K or `",
        "Command bar: names, tickers, TICKER F3, layout save NAME",
    ),
    (
        "Enter / Shift+Enter",
        "Command bar: open in the focused pane / a new pane",
    ),
    (
        "Click / Shift+click, middle",
        "A link: open in the focused pane / a new pane",
    ),
    ("Alt+Left, Backspace", "Back in the focused pane"),
    ("Alt+Right", "Forward in the focused pane"),
    (
        "Ctrl+D / Ctrl+Shift+D",
        "Split the focused pane right / down",
    ),
    ("Ctrl+W", "Close the focused pane"),
    ("Ctrl+Arrow", "Focus the pane in that direction"),
    (
        "Ctrl+Tab / Ctrl+Shift+Tab",
        "Focus the next / previous pane",
    ),
    ("Ctrl+Shift+Arrow", "Move the focused pane's divider"),
    ("Ctrl+= / Ctrl+- / Ctrl+0", "Font larger / smaller / reset"),
    ("Ctrl+J", "Density compact or normal"),
    ("Ctrl+,", "This page"),
    (
        "O, U, R, N (Shift: new pane)",
        "Companies, Industries, Recap, News",
    ),
    ("B, Esc", "Pdoomberg full screen, and back"),
    (
        "Space, 1 to 5, + / -, Ctrl+Space",
        "Pause, speed, Skip menu",
    ),
    ("Tab", "Fold the outliner"),
    (
        "Arrows, PgUp/PgDn, Home/End",
        "Scroll the focused pane's table",
    ),
];

/// Pixels the page scrolls per wheel line.
pub const SCROLL_LINE_PX: f32 = 40.0;
/// The divider between panes, in logical pixels.
pub const DIVIDER: f32 = 4.0;
/// Breadcrumbs shown before the current page.
pub const CRUMBS: usize = 3;
/// Characters of a page title kept in a breadcrumb.
pub const CRUMB_CHARS: usize = 22;

/// Where to open a page.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenTarget {
    /// The focused pane (a plain click, Enter).
    Focused,
    /// A new pane split off the focused one (Shift+click, middle click, Shift+Enter); the
    /// focused pane keeps focus. At [`model::MAX_PANES`] it opens in the focused pane.
    NewPane,
    Pane(PaneId),
}

/// Opens a page.
#[derive(Message, Debug, Clone, PartialEq, Eq)]
pub struct OpenPage {
    pub page: PageRef,
    pub target: OpenTarget,
}

impl OpenPage {
    pub fn focused(page: PageRef) -> OpenPage {
        OpenPage {
            page,
            target: OpenTarget::Focused,
        }
    }
}

/// A pane command from a button, a key or the command bar. `None` is the focused pane.
#[derive(Message, Debug, Clone, PartialEq, Eq)]
pub enum PaneAction {
    Focus(PaneId),
    Back(Option<PaneId>),
    Forward(Option<PaneId>),
    /// Back to the `i`th page of the pane's back list (a breadcrumb).
    Crumb(PaneId, usize),
    Split(Option<PaneId>, Axis),
    Close(Option<PaneId>),
    FocusDir(Dir),
    Cycle(i32),
    Nudge(Dir),
    SaveLayout(String),
    LoadLayout(String),
    DeleteLayout(String),
}

/// The workspace's root node and its laid-out size.
#[derive(Resource, Debug, Clone, Copy)]
pub struct WorkspaceUi {
    pub root: Entity,
    built: Option<u64>,
    /// Logical size, for the new-pane axis and keyboard focus moves.
    pub size: Vec2,
}

/// A pane's frame: header and body.
#[derive(Component, Debug, Clone)]
pub struct PaneFrame {
    pub pane: PaneId,
    pub header: Entity,
    pub body: Entity,
    /// What the frame was last drawn with.
    drawn: Drawn,
}

impl PaneFrame {
    /// The page the frame's body was last built for.
    pub fn drawn_page(&self) -> Option<&PageRef> {
        self.drawn.page.as_ref()
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
struct Drawn {
    page: Option<PageRef>,
    back: Vec<PageRef>,
    can_forward: bool,
    focused: bool,
    title: String,
    versions: Vec<u64>,
    sections: Option<SectionsConfig>,
}

/// A pane's scrolling page body.
#[derive(Component, Debug, Clone, Copy)]
pub struct PaneBody(pub PaneId);

/// The first side of a split: its flex basis follows the ratio.
#[derive(Component, Debug, Clone, Copy)]
struct SplitFirst(SplitId);

/// A divider between a split's sides.
#[derive(Component, Debug, Clone, Copy)]
struct Divider {
    split: SplitId,
    axis: Axis,
    container: Entity,
}

/// The workspace's input systems (inside [`UiSystems::Input`]): they apply the [`OpenPage`] and
/// [`PaneAction`] messages written before them in the frame.
#[derive(SystemSet, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct WorkspaceInput;

pub struct WorkspacePlugin;

impl Plugin for WorkspacePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<Workspace>()
            .add_message::<OpenPage>()
            .add_message::<PaneAction>()
            .add_systems(
                Startup,
                (spawn_workspace, restore_last_layout).after(SpawnLayout),
            )
            .add_systems(
                Update,
                (workspace_keys, apply_open_page, apply_pane_actions)
                    .chain()
                    .in_set(WorkspaceInput)
                    .in_set(UiSystems::Input),
            )
            .add_systems(
                Update,
                (
                    measure_workspace,
                    rebuild_structure,
                    sync_ratios,
                    render_panes,
                    focus_tables,
                    save_last_layout,
                )
                    .chain()
                    .in_set(UiSystems::Show),
            );
    }
}

fn spawn_workspace(mut commands: Commands, layout: Res<ShellLayout>) {
    let root = commands
        .spawn(Node {
            flex_grow: 1.0,
            min_height: px(0.0),
            min_width: px(0.0),
            flex_direction: FlexDirection::Row,
            padding: UiRect::all(px(2.0)),
            ..default()
        })
        .id();
    commands.entity(layout.main).insert_children(0, &[root]);
    commands.insert_resource(WorkspaceUi {
        root,
        built: None,
        size: Vec2::new(1280.0, 800.0),
    });
}

/// The last session's layout comes back (D450).
fn restore_last_layout(cfg: Res<UiConfig>, mut ws: ResMut<Workspace>) {
    if let Some(last) = &cfg.last_layout {
        ws.load(last);
    }
}

fn measure_workspace(mut ui: ResMut<WorkspaceUi>, nodes: Query<&ComputedNode>) {
    if let Ok(n) = nodes.get(ui.root) {
        let s = n.size * n.inverse_scale_factor;
        if s.x > 0.0 && (s - ui.size).length() > 0.5 {
            ui.size = s;
        }
    }
}

fn shift_held(keys: &ButtonInput<KeyCode>) -> bool {
    keys.any_pressed([KeyCode::ShiftLeft, KeyCode::ShiftRight])
}

fn ctrl_held(keys: &ButtonInput<KeyCode>) -> bool {
    keys.any_pressed([KeyCode::ControlLeft, KeyCode::ControlRight])
}

fn alt_held(keys: &ButtonInput<KeyCode>) -> bool {
    keys.any_pressed([KeyCode::AltLeft, KeyCode::AltRight])
}

/// The workspace shortcuts (D453; the table in the module doc).
fn workspace_keys(
    keys: Res<ButtonInput<KeyCode>>,
    capture: Res<KeyboardCapture>,
    router: Res<Router>,
    mut actions: MessageWriter<PaneAction>,
    mut open: MessageWriter<OpenPage>,
    mut cfg: ResMut<UiConfig>,
) {
    if capture.0 || router.current == Screen::Pdoomberg {
        return;
    }
    let (ctrl, shift, alt) = (ctrl_held(&keys), shift_held(&keys), alt_held(&keys));
    let pressed = |k| keys.just_pressed(k);
    let arrows = [
        (KeyCode::ArrowLeft, Dir::Left),
        (KeyCode::ArrowRight, Dir::Right),
        (KeyCode::ArrowUp, Dir::Up),
        (KeyCode::ArrowDown, Dir::Down),
    ];
    if alt && !ctrl {
        if pressed(KeyCode::ArrowLeft) {
            actions.write(PaneAction::Back(None));
        }
        if pressed(KeyCode::ArrowRight) {
            actions.write(PaneAction::Forward(None));
        }
        return;
    }
    if !ctrl {
        if pressed(KeyCode::Backspace) && !modifier_held(&keys) {
            actions.write(PaneAction::Back(None));
        }
        return;
    }
    if pressed(KeyCode::KeyD) {
        let axis = if shift { Axis::Column } else { Axis::Row };
        actions.write(PaneAction::Split(None, axis));
    }
    if pressed(KeyCode::KeyW) {
        actions.write(PaneAction::Close(None));
    }
    if pressed(KeyCode::Tab) {
        actions.write(PaneAction::Cycle(if shift { -1 } else { 1 }));
    }
    for (k, d) in arrows {
        if pressed(k) {
            actions.write(if shift {
                PaneAction::Nudge(d)
            } else {
                PaneAction::FocusDir(d)
            });
        }
    }
    if keys.any_just_pressed([KeyCode::Equal, KeyCode::NumpadAdd]) {
        cfg.step_font(1);
    }
    if keys.any_just_pressed([KeyCode::Minus, KeyCode::NumpadSubtract]) {
        cfg.step_font(-1);
    }
    if keys.any_just_pressed([KeyCode::Digit0, KeyCode::Numpad0]) && cfg.font_scale != 1.0 {
        cfg.font_scale = 1.0;
    }
    if pressed(KeyCode::KeyJ) {
        cfg.density = match cfg.density {
            Density::Compact => Density::Normal,
            Density::Normal => Density::Compact,
        };
    }
    if pressed(KeyCode::Comma) {
        open.write(OpenPage::focused(PageRef::Settings));
    }
}

/// Opens pages (links, the rail, the command bar).
fn apply_open_page(
    mut msgs: MessageReader<OpenPage>,
    mut ws: ResMut<Workspace>,
    ui: Option<Res<WorkspaceUi>>,
) {
    let size = ui.map_or(Vec2::new(1280.0, 800.0), |u| u.size);
    for m in msgs.read() {
        let focused = ws.focused();
        match m.target {
            OpenTarget::Focused => {
                ws.open(focused, m.page.clone());
            }
            OpenTarget::Pane(p) => {
                ws.open(p, m.page.clone());
            }
            OpenTarget::NewPane => {
                let axis = ws.auto_axis(focused, size.x, size.y);
                if ws
                    .split(focused, axis, Some(m.page.clone()), false)
                    .is_none()
                {
                    ws.open(focused, m.page.clone());
                }
            }
        }
    }
}

fn apply_pane_actions(
    mut msgs: MessageReader<PaneAction>,
    mut ws: ResMut<Workspace>,
    mut cfg: ResMut<UiConfig>,
    ui: Option<Res<WorkspaceUi>>,
) {
    let size = ui.map_or(Vec2::new(1280.0, 800.0), |u| u.size);
    for a in msgs.read() {
        let f = ws.focused();
        let or_f = |p: &Option<PaneId>| p.unwrap_or(f);
        match a {
            PaneAction::Focus(p) => {
                ws.focus(*p);
            }
            PaneAction::Back(p) => {
                ws.back(or_f(p));
            }
            PaneAction::Forward(p) => {
                ws.forward(or_f(p));
            }
            PaneAction::Crumb(p, i) => {
                ws.back_to(*p, *i);
            }
            PaneAction::Split(p, axis) => {
                ws.split(or_f(p), *axis, None, true);
            }
            PaneAction::Close(p) => {
                let p = or_f(p);
                let next = ws.sibling_of(p);
                ws.close_focus(p, next);
            }
            PaneAction::FocusDir(d) => {
                if let Some(n) = ws.neighbor(f, *d, size.x, size.y) {
                    ws.focus(n);
                }
            }
            PaneAction::Cycle(step) => {
                let n = ws.cycle(f, *step);
                ws.focus(n);
            }
            PaneAction::Nudge(d) => {
                ws.nudge(f, *d);
            }
            PaneAction::SaveLayout(name) => {
                let name = name.trim();
                if !name.is_empty() {
                    cfg.layouts.insert(name.to_owned(), ws.to_saved());
                }
            }
            PaneAction::LoadLayout(name) => {
                if let Some(l) = cfg.layouts.get(name.trim()) {
                    let l = l.clone();
                    ws.load(&l);
                }
            }
            PaneAction::DeleteLayout(name) => {
                cfg.layouts.remove(name.trim());
            }
        }
    }
}

/// Rebuilds the pane tree's nodes when its shape changed.
fn rebuild_structure(mut commands: Commands, mut ui: ResMut<WorkspaceUi>, ws: Res<Workspace>) {
    if ui.built == Some(ws.structure_version()) {
        return;
    }
    ui.built = Some(ws.structure_version());
    commands.entity(ui.root).despawn_children();
    let top = spawn_node(&mut commands, ws.root());
    commands.entity(ui.root).add_child(top);
}

fn spawn_node(commands: &mut Commands, l: &model::Layout) -> Entity {
    match l {
        model::Layout::Pane(p) => spawn_frame(commands, *p),
        model::Layout::Split(s) => {
            let container = commands
                .spawn(Node {
                    flex_grow: 1.0,
                    flex_basis: px(0.0),
                    min_width: px(0.0),
                    min_height: px(0.0),
                    flex_direction: match s.axis {
                        Axis::Row => FlexDirection::Row,
                        Axis::Column => FlexDirection::Column,
                    },
                    ..default()
                })
                .id();
            let a = spawn_node(commands, &s.first);
            let b = spawn_node(commands, &s.second);
            let first = commands
                .spawn((
                    SplitFirst(s.id),
                    Node {
                        flex_basis: percent(s.ratio * 100.0),
                        flex_grow: 0.0,
                        flex_shrink: 1.0,
                        min_width: px(0.0),
                        min_height: px(0.0),
                        display: Display::Flex,
                        ..default()
                    },
                ))
                .add_child(a)
                .id();
            let second = commands
                .spawn(Node {
                    flex_basis: px(0.0),
                    flex_grow: 1.0,
                    min_width: px(0.0),
                    min_height: px(0.0),
                    display: Display::Flex,
                    ..default()
                })
                .add_child(b)
                .id();
            let (w, h) = match s.axis {
                Axis::Row => (px(DIVIDER), Val::Auto),
                Axis::Column => (Val::Auto, px(DIVIDER)),
            };
            let divider = commands
                .spawn((
                    Divider {
                        split: s.id,
                        axis: s.axis,
                        container,
                    },
                    Node {
                        width: w,
                        min_width: w,
                        height: h,
                        min_height: h,
                        flex_shrink: 0.0,
                        ..default()
                    },
                    BackgroundColor(color::BG),
                    Hovered::default(),
                    Tooltip("Drag to resize (Ctrl+Shift+Arrow from the keyboard)".into()),
                ))
                .observe(drag_divider)
                .id();
            commands
                .entity(container)
                .add_children(&[first, divider, second]);
            container
        }
    }
}

fn drag_divider(
    mut ev: On<PointerDrag>,
    dividers: Query<&Divider>,
    nodes: Query<&ComputedNode>,
    mut ws: ResMut<Workspace>,
) {
    ev.propagate(false);
    let Ok(d) = dividers.get(ev.event_target()) else {
        return;
    };
    let Ok(n) = nodes.get(d.container) else {
        return;
    };
    let size = n.size * n.inverse_scale_factor;
    let (delta, len) = match d.axis {
        Axis::Row => (ev.delta.x, size.x),
        Axis::Column => (ev.delta.y, size.y),
    };
    if len > 1.0
        && let Some(r) = ws.ratio(d.split)
    {
        ws.set_ratio(d.split, r + delta / len);
    }
}

fn spawn_frame(commands: &mut Commands, pane: PaneId) -> Entity {
    let header = commands
        .spawn((
            Node {
                flex_direction: FlexDirection::Row,
                align_items: AlignItems::Center,
                column_gap: px(4.0),
                padding: UiRect::axes(px(4.0), px(1.0)),
                border: UiRect::bottom(px(1.0)),
                min_height: px(18.0),
                overflow: Overflow::clip(),
                ..default()
            },
            BackgroundColor(color::PANEL_RAISED),
            BorderColor::all(color::BORDER),
        ))
        .id();
    let body = commands
        .spawn((
            PaneBody(pane),
            Node {
                flex_grow: 1.0,
                min_height: px(0.0),
                flex_direction: FlexDirection::Column,
                padding: UiRect::all(px(6.0)),
                row_gap: px(6.0),
                overflow: Overflow::scroll_y(),
                ..default()
            },
            ScrollPosition::default(),
        ))
        .observe(scroll_body)
        .id();
    commands
        .spawn((
            PaneFrame {
                pane,
                header,
                body,
                drawn: Drawn::default(),
            },
            Node {
                flex_grow: 1.0,
                min_width: px(0.0),
                min_height: px(0.0),
                flex_direction: FlexDirection::Column,
                border: UiRect::all(px(1.0)),
                ..default()
            },
            BackgroundColor(color::PANEL),
            BorderColor::all(color::BORDER),
        ))
        .add_children(&[header, body])
        .observe(move |ev: On<PointerPress>, mut ws: ResMut<Workspace>| {
            if ws.focused() != pane && ev.button != PointerButton::Secondary {
                ws.focus(pane);
            }
        })
        .id()
}

fn scroll_body(ev: On<PointerScroll>, mut q: Query<(&mut ScrollPosition, &ComputedNode)>) {
    let Ok((mut pos, node)) = q.get_mut(ev.event_target()) else {
        return;
    };
    let dy = match ev.unit {
        MouseScrollUnit::Line => -ev.y * SCROLL_LINE_PX,
        MouseScrollUnit::Pixel => -ev.y,
    };
    let max = ((node.content_size.y - node.size.y) * node.inverse_scale_factor).max(0.0);
    let y = (pos.0.y + dy).clamp(0.0, max);
    if (y - pos.0.y).abs() > 0.1 {
        pos.0.y = y;
    }
}

fn sync_ratios(ws: Res<Workspace>, mut q: Query<(&SplitFirst, &mut Node)>) {
    if !ws.is_changed() {
        return;
    }
    let splits = ws.splits();
    for (s, mut n) in &mut q {
        if let Some((_, _, r)) = splits.iter().find(|(id, _, _)| *id == s.0) {
            let want = percent(r * 100.0);
            if n.flex_basis != want {
                n.flex_basis = want;
            }
        }
    }
}

fn shorten(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        s.to_owned()
    } else {
        let mut out: String = s.chars().take(n.saturating_sub(2)).collect();
        out.push_str("..");
        out
    }
}

/// Redraws pane headers and page bodies that are out of date: a new page, a history or focus
/// change, a section config change, the page's views moving (for [`Refresh::OnViewChange`]
/// pages). Tables follow density and font changes by themselves, so those rebuild nothing.
#[allow(clippy::too_many_arguments)]
fn render_panes(
    mut commands: Commands,
    ws: Res<Workspace>,
    registry: Res<PageRegistry>,
    cfg: Res<UiConfig>,
    views: Res<Views>,
    index: Res<NameIndex>,
    mut frames: Query<(&mut PaneFrame, &mut BorderColor)>,
    mut frame_count: Local<usize>,
    mut scrolls: Query<&mut ScrollPosition>,
    mut cfg_rev: Local<u64>,
) {
    if cfg.is_changed() {
        *cfg_rev += 1;
    }
    // Views move every tick at speed; only pages that rebuild on them need a look then.
    let view_pages = views.is_changed()
        && frames.iter().any(|(f, _)| {
            ws.page(f.pane)
                .and_then(|p| registry.get(p.kind()))
                .is_some_and(|s| s.refresh == Refresh::OnViewChange)
        });
    let any = ws.is_changed()
        || cfg.is_changed()
        || view_pages
        || index.is_changed()
        || registry.is_changed()
        || frames.iter().count() != *frame_count;
    *frame_count = frames.iter().count();
    if !any {
        return;
    }
    for (mut frame, mut border) in &mut frames {
        let pane = frame.pane;
        let Some(h) = ws.history(pane) else {
            continue;
        };
        let page = h.current().clone();
        let kind = page.kind();
        let spec = registry.get(kind);
        let versions: Vec<u64> = match spec {
            Some(s) if s.refresh == Refresh::OnViewChange => {
                s.views.iter().map(|&k| view_meta(&views, k).1).collect()
            }
            Some(s) if s.refresh == Refresh::OnConfigChange => vec![*cfg_rev],
            _ => Vec::new(),
        };
        let want = Drawn {
            page: Some(page.clone()),
            back: h.back_list().to_vec(),
            can_forward: h.can_forward(),
            focused: ws.focused() == pane,
            title: index.title(&page),
            versions,
            sections: cfg.sections.get(kind.key()).cloned(),
        };
        if frame.drawn == want {
            continue;
        }
        let body_stale = frame.drawn.page != want.page
            || frame.drawn.versions != want.versions
            || frame.drawn.sections != want.sections;
        let new_page = frame.drawn.page != want.page;
        draw_header(&mut commands, frame.header, pane, &want, h, &index);
        *border = BorderColor::all(if want.focused {
            color::FOCUS
        } else {
            color::BORDER
        });
        if body_stale {
            build_page(&mut commands, &registry, &cfg, frame.body, pane, &page);
            if new_page && let Ok(mut s) = scrolls.get_mut(frame.body) {
                s.0 = Vec2::ZERO;
            }
        }
        frame.drawn = want;
    }
}

fn header_button(
    commands: &mut Commands,
    label: &str,
    enabled: bool,
    tip: &str,
    action: PaneAction,
) -> Entity {
    commands
        .spawn((
            Node {
                padding: UiRect::horizontal(px(4.0)),
                ..default()
            },
            Hovered::default(),
            Tooltip(tip.to_owned()),
            children![theme::text_line(
                label,
                font::SMALL,
                if enabled { color::TEXT } else { color::BORDER }
            )],
        ))
        .observe(
            move |mut ev: On<PointerClick>, mut w: MessageWriter<PaneAction>| {
                ev.propagate(false);
                if enabled && ev.button == PointerButton::Primary {
                    w.write(action.clone());
                }
            },
        )
        .id()
}

fn draw_header(
    commands: &mut Commands,
    header: Entity,
    pane: PaneId,
    want: &Drawn,
    h: &model::History,
    index: &NameIndex,
) {
    commands.entity(header).despawn_children();
    let back = header_button(
        commands,
        "<",
        h.can_back(),
        "Back (Alt+Left, Backspace)",
        PaneAction::Back(Some(pane)),
    );
    let fwd = header_button(
        commands,
        ">",
        h.can_forward(),
        "Forward (Alt+Right)",
        PaneAction::Forward(Some(pane)),
    );
    let page = h.current();
    let tag = commands
        .spawn(theme::text_line(
            format!("[{}]", page.kind().tag()),
            font::SMALL,
            color::TEXT_MUTED,
        ))
        .id();
    commands.entity(header).add_children(&[back, fwd, tag]);
    // The breadcrumb: the last pages behind this one, then this one.
    let backs = h.back_list();
    let start = backs.len().saturating_sub(CRUMBS);
    if start > 0 {
        let more = commands
            .spawn(theme::text_line("..", font::SMALL, color::TEXT_MUTED))
            .id();
        commands.entity(header).add_child(more);
    }
    for (i, p) in backs.iter().enumerate().skip(start) {
        let crumb = commands
            .spawn((
                Node::default(),
                Hovered::default(),
                Tooltip(format!("Back to {}", index.title(p))),
                children![theme::text_line(
                    shorten(&index.title(p), CRUMB_CHARS),
                    font::SMALL,
                    color::LINK
                )],
            ))
            .observe(
                move |mut ev: On<PointerClick>, mut w: MessageWriter<PaneAction>| {
                    ev.propagate(false);
                    if ev.button == PointerButton::Primary {
                        w.write(PaneAction::Crumb(pane, i));
                    }
                },
            )
            .id();
        let sep = commands
            .spawn(theme::text_line(">", font::SMALL, color::TEXT_MUTED))
            .id();
        commands.entity(header).add_children(&[crumb, sep]);
    }
    let title = commands
        .spawn(theme::text_line(
            want.title.clone(),
            font::SMALL,
            if want.focused {
                color::CYAN
            } else {
                color::TEXT
            },
        ))
        .id();
    let spacer = commands
        .spawn(Node {
            flex_grow: 1.0,
            ..default()
        })
        .id();
    let split_r = header_button(
        commands,
        "|",
        true,
        "Split right (Ctrl+D)",
        PaneAction::Split(Some(pane), Axis::Row),
    );
    let split_d = header_button(
        commands,
        "-",
        true,
        "Split down (Ctrl+Shift+D)",
        PaneAction::Split(Some(pane), Axis::Column),
    );
    let close = header_button(
        commands,
        "x",
        true,
        "Close the pane (Ctrl+W)",
        PaneAction::Close(Some(pane)),
    );
    commands
        .entity(header)
        .add_children(&[title, spacer, split_r, split_d, close]);
}

/// Builds a page's body: the head slot, the sections in the player's order, the tail slot, then
/// the kind's builder fills them.
pub fn build_page(
    commands: &mut Commands,
    registry: &PageRegistry,
    cfg: &UiConfig,
    body: Entity,
    pane: PaneId,
    page: &PageRef,
) {
    commands.entity(body).despawn_children();
    let column = || Node {
        flex_direction: FlexDirection::Column,
        row_gap: px(4.0),
        flex_shrink: 0.0,
        ..default()
    };
    let head = commands.spawn(column()).id();
    commands.entity(body).add_child(head);
    let kind = page.kind();
    let spec = registry.get(kind);
    let sections = spec.map_or_else(Vec::new, |s| {
        spawn_sections(commands, body, kind, &s.sections, cfg)
    });
    let tail = commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            row_gap: px(4.0),
            flex_grow: 1.0,
            min_height: px(240.0),
            ..default()
        })
        .id();
    commands.entity(body).add_child(tail);
    let build = PageBuild {
        page: page.clone(),
        pane: pane.0,
        body,
        head,
        sections,
        tail,
    };
    match spec.and_then(|s| s.builder()) {
        Some(id) => commands.run_system_with(id, build),
        None => {
            let t = commands
                .spawn(theme::muted(format!(
                    "No page registered for {}",
                    kind.name()
                )))
                .id();
            commands.entity(head).add_child(t);
        }
    }
}

/// The keyboard scrolls the focused pane's first table, or Pdoomberg's quote table while it is
/// open.
#[allow(clippy::too_many_arguments)]
fn focus_tables(
    ws: Res<Workspace>,
    router: Res<Router>,
    demo: Option<Res<DemoTableEntities>>,
    frames: Query<&PaneFrame>,
    children: Query<&Children>,
    tables: Query<(), With<Table>>,
    added: Query<(), Added<Table>>,
    mut focus: ResMut<TableFocus>,
) {
    if !(ws.is_changed() || router.is_changed() || !added.is_empty()) {
        return;
    }
    let want = if router.current == Screen::Pdoomberg {
        demo.map(|d| d.companies)
    } else {
        frames
            .iter()
            .find(|f| f.pane == ws.focused())
            .and_then(|f| {
                children
                    .iter_descendants(f.body)
                    .find(|&e| tables.contains(e))
            })
    };
    if focus.0 != want {
        focus.0 = want;
    }
}

fn save_last_layout(ws: Res<Workspace>, mut cfg: ResMut<UiConfig>) {
    if !ws.is_changed() {
        return;
    }
    let saved = ws.to_saved();
    if cfg.last_layout.as_ref() != Some(&saved) {
        cfg.last_layout = Some(saved);
    }
}

/// Every page kind the rail's screens open (D451).
pub fn screen_page(screen: Screen, views: &Views) -> Option<PageRef> {
    Some(match screen {
        Screen::Company => PageRef::Companies,
        Screen::Industries => PageRef::Industries,
        Screen::Recap => PageRef::Recap(views.clock().date.quarter()),
        Screen::News => PageRef::News,
        Screen::Map => PageRef::World,
        Screen::Pdoomberg => return None,
    })
}

/// The rail screen a page kind belongs to, for marking the rail.
pub fn page_screen(kind: PageKind) -> Option<Screen> {
    Some(match kind {
        PageKind::Company | PageKind::Companies => Screen::Company,
        PageKind::Industry | PageKind::Industries => Screen::Industries,
        PageKind::Recap => Screen::Recap,
        PageKind::News | PageKind::Headline => Screen::News,
        _ => return None,
    })
}
