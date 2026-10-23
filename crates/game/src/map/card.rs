//! The map's hover card (build-plan M8.7; spec 8 Map row; D704): hovering a province shows its
//! province card next to the pointer (development, resource, terrain, Metro, key city, the HQs
//! and units there, from v_province_card and v_units), and in the Financial zones mode its
//! zone's card instead (number, members, intensity, lag, contagion, listed company count, base
//! and effective credit spread, investor confidence). The card follows the pointer and lets it
//! through (the map keeps its hover and clicks); a link's name card (a pin's) hides it.

use bevy::prelude::*;
use bevy::window::PrimaryWindow;
use sim::views::map_layers::MapMode;
use sim::world::ProvinceId;

use super::MapState;
use super::modes::CurrentLayer;
use crate::bridge::Views;
use crate::command::index::NameIndex;
use crate::links::HoverCard;
use crate::links::cards::{self, Card};
use crate::pages::PageRef;
use crate::ui::theme::{self, color, font};
use crate::ui::{ShellLayout, SpawnLayout, UiSystems};

/// The card panel.
#[derive(Component, Debug)]
pub struct MapCardPanel;

/// What the card shows: the province, whether as its zone, and the card's data.
#[derive(Resource, Debug, Default)]
pub struct MapCard {
    pub shown: Option<(ProvinceId, bool)>,
    pub card: Option<Card>,
    /// The versions of the views (and the name index's generation) the card read when it was
    /// built.
    built_at: [u64; 8],
    panel: Option<Entity>,
}

/// The card's width, logical pixels.
pub const MAP_CARD_W: f32 = 300.0;
/// Its height before it is first laid out.
pub const MAP_CARD_GUESS_H: f32 = 360.0;
/// Its offset from the pointer.
pub const MAP_CARD_OFFSET: f32 = 18.0;

/// The card of province `p` in `mode`: its zone's in the Financial zones mode, else its
/// province card.
pub fn map_card(p: ProvinceId, mode: MapMode, v: &sim::SimViews, index: &NameIndex) -> Card {
    if mode == MapMode::FinancialZones
        && let Some(z) = v.map_layers.get().zone_of(p)
    {
        return cards::zone_hover_card(z, Some(p), v, index);
    }
    cards::card(&PageRef::Province(p), v, index)
}

pub struct MapCardPlugin;

impl Plugin for MapCardPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<MapCard>()
            .add_systems(Startup, spawn_panel.after(SpawnLayout))
            .add_systems(Update, show_map_card.in_set(UiSystems::Show));
    }
}

fn spawn_panel(mut commands: Commands, layout: Res<ShellLayout>, mut state: ResMut<MapCard>) {
    let panel = commands
        .spawn((
            MapCardPanel,
            Node {
                position_type: PositionType::Absolute,
                display: Display::None,
                width: px(MAP_CARD_W),
                flex_direction: FlexDirection::Column,
                padding: UiRect::all(px(8.0)),
                row_gap: px(2.0),
                border: UiRect::all(px(1.0)),
                ..default()
            },
            // Opaque, so nothing on the map shows through it (review of PR #37).
            BackgroundColor(color::PANEL_RAISED),
            BorderColor::all(color::BORDER),
            GlobalZIndex(105),
            Pickable::IGNORE,
        ))
        .id();
    commands.entity(layout.root).add_child(panel);
    state.panel = Some(panel);
}

fn fill(commands: &mut Commands, panel: Entity, card: &Card) {
    let head = commands
        .spawn((
            Node {
                flex_direction: FlexDirection::Row,
                align_items: AlignItems::Baseline,
                column_gap: px(8.0),
                ..default()
            },
            Pickable::IGNORE,
        ))
        .id();
    let title = commands
        .spawn((
            theme::text_line(card.title.clone(), font::TITLE, color::TEXT),
            Pickable::IGNORE,
        ))
        .id();
    let kind = commands
        .spawn((
            theme::text_line(card.kind, font::SMALL, color::TEXT_MUTED),
            Pickable::IGNORE,
        ))
        .id();
    commands.entity(head).add_children(&[title, kind]);
    commands.entity(panel).add_child(head);
    for line in &card.lines {
        let row = commands
            .spawn((
                Node {
                    flex_direction: FlexDirection::Row,
                    column_gap: px(8.0),
                    ..default()
                },
                Pickable::IGNORE,
            ))
            .id();
        let label = commands
            .spawn((
                Node {
                    width: px(92.0),
                    min_width: px(92.0),
                    ..default()
                },
                Pickable::IGNORE,
                children![(
                    theme::text_line(line.label.clone(), font::SMALL, color::TEXT_MUTED),
                    Pickable::IGNORE
                )],
            ))
            .id();
        let c = line.color.unwrap_or(if line.link.is_some() {
            color::LINK
        } else {
            color::TEXT
        });
        let value = commands
            .spawn((
                theme::text(line.value.clone(), font::SMALL, c),
                Pickable::IGNORE,
            ))
            .id();
        commands.entity(row).add_children(&[label, value]);
        commands.entity(panel).add_child(row);
    }
}

/// Shows the hovered province's card next to the pointer; rebuilt when the province, the
/// mode's card kind or the views change.
#[allow(clippy::too_many_arguments)]
fn show_map_card(
    mut commands: Commands,
    mut state: ResMut<MapCard>,
    map: Res<MapState>,
    layer: Res<CurrentLayer>,
    link_card: Res<HoverCard>,
    views: Res<Views>,
    index: Res<NameIndex>,
    window: Query<&Window, With<PrimaryWindow>>,
    mut nodes: Query<&mut Node>,
    children: Query<&Children>,
    computed: Query<&ComputedNode>,
    mut index_gen: Local<u64>,
) {
    if index.is_changed() {
        *index_gen += 1;
    }
    let Some(panel) = state.panel else { return };
    let mode = layer.layer.mode;
    let want = map
        .hover
        .filter(|_| link_card.shown.is_none())
        .map(|p| (p, mode == MapMode::FinancialZones));
    if want.is_none() {
        if state.shown.is_some() {
            state.shown = None;
            state.card = None;
            if let Ok(mut n) = nodes.get_mut(panel) {
                n.display = Display::None;
            }
        }
        return;
    }
    let (p, _) = want.unwrap();
    let key = [
        views.province_cards.version(),
        views.units.version(),
        views.company_rows.version(),
        views.cycle.version(),
        views.exchanges.version(),
        views.zones.version(),
        views.places.version(),
        *index_gen,
    ];
    if state.shown != want || state.built_at != key {
        if let Ok(c) = children.get(panel) {
            for &e in c {
                commands.entity(e).despawn();
            }
        }
        let card = map_card(p, mode, &views, &index);
        fill(&mut commands, panel, &card);
        state.card = Some(card);
        state.shown = want;
        state.built_at = key;
    }
    // Next to the pointer, inside the window.
    let (cursor, win) = window
        .single()
        .map(|w| (w.cursor_position(), Vec2::new(w.width(), w.height())))
        .unwrap_or((None, Vec2::new(1920.0, 1080.0)));
    let at = cursor.unwrap_or(Vec2::splat(MAP_CARD_OFFSET));
    let x = if at.x + MAP_CARD_OFFSET + MAP_CARD_W > win.x {
        (at.x - MAP_CARD_OFFSET - MAP_CARD_W).max(0.0)
    } else {
        at.x + MAP_CARD_OFFSET
    };
    // Below the pointer, or as low as the card's laid-out height lets it stay inside the window.
    let h = computed
        .get(panel)
        .map(|n| n.size.y * n.inverse_scale_factor)
        .ok()
        .filter(|h| *h > 0.0)
        .unwrap_or(MAP_CARD_GUESS_H);
    let y = (at.y + MAP_CARD_OFFSET).min((win.y - h).max(0.0));
    if let Ok(mut n) = nodes.get_mut(panel) {
        let (l, t) = (px(x), px(y));
        if n.display != Display::Flex || n.left != l || n.top != t {
            n.display = Display::Flex;
            n.left = l;
            n.top = t;
        }
    }
}
