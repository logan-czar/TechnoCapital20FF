//! Links and hover name cards (M9 A2; D454; 20-ui 20.3.3). Anything with a name is a link to
//! its page: click opens it in the focused pane, Shift+click or a middle click in a new pane.
//! Hovering a link for [`HOVER_DELAY_SECS`] shows a compact name card with a few facts and
//! links, read from the views only (spec 9).
//!
//! - [`link`] spawns a link text; [`Link`] on any node makes it one.
//! - [`LinkSlot`] is a link whose page can change (a pooled table cell); `None` is no link, and a
//!   click goes on to the row.

pub mod cards;

use bevy::picking::hover::Hovered;
use bevy::prelude::*;

use crate::bridge::{RunnerControls, Views};
use crate::command::index::NameIndex;
use crate::pages::PageRef;
use crate::ui::theme::{self, color, font, size};
use crate::ui::{ShellLayout, SpawnLayout, UiSystems};
use crate::workspace::{OpenPage, OpenTarget};

/// Seconds a link is hovered before its card shows (20-ui 20.3.3 (T)).
pub const HOVER_DELAY_SECS: f32 = 0.3;
/// Seconds a card stays after the pointer leaves the link, so the pointer can reach the card.
pub const HOVER_GRACE_SECS: f32 = 0.25;
/// The card's width in logical pixels.
pub const CARD_WIDTH: f32 = 320.0;

/// A link to a page.
#[derive(Component, Debug, Clone, PartialEq)]
#[require(Hovered)]
pub struct Link(pub PageRef);

/// A link whose page changes (a pooled table cell); `None` is not a link.
#[derive(Component, Debug, Clone, Default, PartialEq)]
#[require(Hovered)]
pub struct LinkSlot(pub Option<PageRef>);

/// A link text in body size.
pub fn link(text: impl Into<String>, page: PageRef) -> impl Bundle {
    link_sized(text, page, font::BODY)
}

/// A link text in a given size.
pub fn link_sized(text: impl Into<String>, page: PageRef, size: f32) -> impl Bundle {
    (theme::text_line(text, size, color::LINK), Link(page))
}

/// Where a click opens a page: Shift or the middle button opens a new pane (D450).
pub fn click_target(button: PointerButton, shift: bool) -> Option<OpenTarget> {
    match button {
        PointerButton::Primary if shift => Some(OpenTarget::NewPane),
        PointerButton::Primary => Some(OpenTarget::Focused),
        PointerButton::Middle => Some(OpenTarget::NewPane),
        PointerButton::Secondary => None,
    }
}

fn on_link_click(
    mut ev: On<PointerClick>,
    links: Query<&Link>,
    slots: Query<&LinkSlot>,
    keys: Res<ButtonInput<KeyCode>>,
    mut open: MessageWriter<OpenPage>,
) {
    let e = ev.event_target();
    let page = links
        .get(e)
        .map(|l| l.0.clone())
        .ok()
        .or_else(|| slots.get(e).ok().and_then(|s| s.0.clone()));
    let Some(page) = page else {
        return;
    };
    let shift = keys.any_pressed([KeyCode::ShiftLeft, KeyCode::ShiftRight]);
    if let Some(target) = click_target(ev.button, shift) {
        ev.propagate(false);
        open.write(OpenPage { page, target });
    }
}

/// Recolors links on hover, with an underline.
#[allow(clippy::type_complexity)]
fn style_links(
    mut commands: Commands,
    mut q: Query<(Entity, &Hovered, &mut TextColor), (With<Link>, Changed<Hovered>)>,
) {
    for (e, h, mut c) in &mut q {
        // A new link (Hovered just added, not hovered) needs nothing; and the page may be
        // rebuilt before these commands apply, so they are the try_ kind.
        let want = if h.get() {
            color::LINK_HOVER
        } else {
            color::LINK
        };
        if c.0 == want {
            continue;
        }
        c.0 = want;
        if h.get() {
            commands.entity(e).try_insert(Underline);
        } else {
            commands.entity(e).try_remove::<Underline>();
        }
    }
}

/// The hover card's state.
#[derive(Resource, Debug, Default)]
pub struct HoverCard {
    /// The hovered link entity.
    hovered: Option<Entity>,
    /// The page under the pointer and since when.
    pending: Option<(PageRef, f32)>,
    /// When the pointer left the link (for the grace time).
    left_at: Option<f32>,
    /// The page the card shows.
    pub shown: Option<PageRef>,
    panel: Option<Entity>,
}

/// The card panel.
#[derive(Component)]
pub struct HoverCardPanel;

fn spawn_card(mut commands: Commands, layout: Res<ShellLayout>, mut state: ResMut<HoverCard>) {
    let panel = commands
        .spawn((
            HoverCardPanel,
            Node {
                position_type: PositionType::Absolute,
                display: Display::None,
                width: px(CARD_WIDTH),
                flex_direction: FlexDirection::Column,
                padding: UiRect::all(px(8.0)),
                row_gap: px(2.0),
                border: UiRect::all(px(1.0)),
                ..default()
            },
            BackgroundColor(color::PANEL_RAISED),
            BorderColor::all(color::LINK),
            GlobalZIndex(110),
            Hovered::default(),
        ))
        .id();
    commands.entity(layout.root).add_child(panel);
    state.panel = Some(panel);
}

/// Tracks the hovered link (links get `Hovered` when the pointer enters them or a child).
#[allow(clippy::type_complexity)]
fn track_hover(
    mut state: ResMut<HoverCard>,
    changed: Query<(Entity, &Hovered), (Or<(With<Link>, With<LinkSlot>)>, Changed<Hovered>)>,
) {
    for (e, h) in &changed {
        if h.get() {
            state.hovered = Some(e);
        } else if state.hovered == Some(e) {
            state.hovered = None;
        }
    }
}

/// Shows, moves, fills and hides the card.
#[allow(clippy::too_many_arguments)]
fn show_card(
    mut commands: Commands,
    time: Res<Time>,
    mut state: ResMut<HoverCard>,
    links: Query<&Link>,
    slots: Query<&LinkSlot>,
    hovered: Query<&Hovered>,
    windows: Query<&Window>,
    mut nodes: Query<&mut Node>,
    children: Query<&Children>,
    views: Res<Views>,
    index: Res<NameIndex>,
    controls: Res<RunnerControls>,
) {
    let Some(panel) = state.panel else {
        return;
    };
    let now = time.elapsed_secs();
    let page = state.hovered.and_then(|e| {
        links
            .get(e)
            .map(|l| l.0.clone())
            .ok()
            .or_else(|| slots.get(e).ok().and_then(|s| s.0.clone()))
    });
    let over_card = hovered.get(panel).is_ok_and(Hovered::get);
    match page {
        Some(p) => {
            state.left_at = None;
            if state.pending.as_ref().map(|(q, _)| q) != Some(&p) {
                state.pending = Some((p, now));
            }
        }
        None if over_card && state.shown.is_some() => {
            state.left_at = None;
        }
        None => {
            let left = *state.left_at.get_or_insert(now);
            state.pending = None;
            if now - left >= HOVER_GRACE_SECS && state.shown.is_some() {
                state.shown = None;
                if let Ok(mut n) = nodes.get_mut(panel) {
                    n.display = Display::None;
                }
            }
        }
    }
    let Some((p, since)) = state.pending.clone() else {
        return;
    };
    if now - since < HOVER_DELAY_SECS || state.shown.as_ref() == Some(&p) {
        return;
    }
    // Show the card for p, next to the cursor and inside the window.
    if let Ok(c) = children.get(panel) {
        for &e in c {
            commands.entity(e).despawn();
        }
    }
    let card = cards::card(&p, &views, &index, controls.omniscient);
    spawn_card_content(&mut commands, panel, &card, &p);
    let (cursor, win) = windows
        .iter()
        .next()
        .map(|w| (w.cursor_position(), Vec2::new(w.width(), w.height())))
        .unwrap_or((None, Vec2::new(1920.0, 1080.0)));
    let at = cursor.unwrap_or(Vec2::new(size::PAD, size::PAD));
    let x = if at.x + 16.0 + CARD_WIDTH > win.x {
        (at.x - 16.0 - CARD_WIDTH).max(0.0)
    } else {
        at.x + 16.0
    };
    let y = (at.y + 18.0).min((win.y - 180.0).max(0.0));
    if let Ok(mut n) = nodes.get_mut(panel) {
        n.display = Display::Flex;
        n.left = px(x);
        n.top = px(y);
    }
    state.shown = Some(p);
}

fn spawn_card_content(commands: &mut Commands, panel: Entity, card: &cards::Card, page: &PageRef) {
    let head = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::Baseline,
            column_gap: px(8.0),
            ..default()
        })
        .id();
    let title = commands
        .spawn(link_sized(card.title.clone(), page.clone(), font::TITLE))
        .id();
    let kind = commands
        .spawn(theme::text_line(card.kind, font::SMALL, color::TEXT_MUTED))
        .id();
    commands.entity(head).add_children(&[title, kind]);
    commands.entity(panel).add_child(head);
    for line in &card.lines {
        let row = commands
            .spawn(Node {
                flex_direction: FlexDirection::Row,
                column_gap: px(8.0),
                ..default()
            })
            .id();
        let label = commands
            .spawn((
                Node {
                    width: px(96.0),
                    min_width: px(96.0),
                    ..default()
                },
                children![theme::text_line(
                    line.label.clone(),
                    font::SMALL,
                    color::TEXT_MUTED
                )],
            ))
            .id();
        let value = match &line.link {
            Some(p) => commands
                .spawn(link_sized(line.value.clone(), p.clone(), font::SMALL))
                .id(),
            None => commands
                .spawn(theme::text(
                    line.value.clone(),
                    font::SMALL,
                    line.color.unwrap_or(color::TEXT),
                ))
                .id(),
        };
        commands.entity(row).add_children(&[label, value]);
        commands.entity(panel).add_child(row);
    }
    let hint = commands
        .spawn(theme::text_line(
            "Click: open | Shift+click or middle: new pane",
            font::SMALL,
            color::TEXT_MUTED,
        ))
        .id();
    commands.entity(panel).add_child(hint);
}

/// Links, link styling and hover cards. Needs the shell layout and the workspace.
pub struct LinksPlugin;

impl Plugin for LinksPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<HoverCard>()
            .add_observer(|add: On<Add<Link>>, mut commands: Commands| {
                commands.entity(add.event_target()).observe(on_link_click);
            })
            .add_observer(|add: On<Add<LinkSlot>>, mut commands: Commands| {
                commands.entity(add.event_target()).observe(on_link_click);
            })
            .add_systems(Startup, spawn_card.after(SpawnLayout))
            .add_systems(
                Update,
                (track_hover, show_card, style_links)
                    .chain()
                    .in_set(UiSystems::Show),
            );
    }
}
