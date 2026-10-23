//! The map (build-plan M8; spec 8 Map row): lane P's province bitmap drawn behind the floating
//! page windows (D635), with pan, zoom, wrap and picking. Everything per province the map shows
//! comes from the sim's views (v_map_static, v_map_layers, v_province_card; spec 9); the
//! bitmaps are render assets it reads itself from the map folder (docs/build/m8-map-assets.md).
//!
//! - [`MapPlugin`] (in the shell, headless-safe): the map node under the window layer, the CPU
//!   copy of the index for picking, the camera, keys and pointer input, hover and selection, and
//!   opening a province's page.
//! - [`render::MapRenderPlugin`] (the app only): the textures and the WGSL material.
//!
//! Input (D636, D637): drag pans (any button), W A S D pan, the wheel and Q / E zoom about the
//! cursor (World, Country and Province levels by the longitude the view spans), the map wraps
//! east to west; hovering outlines the province under the cursor; a click selects it and opens
//! its page in the focused pane (Shift+click: a new pane). A tiny province's label point is a
//! click target that wins within [`picking::TINY_TARGET_PX`].

pub mod camera;
pub mod card;
pub mod colors;
pub mod labels;
pub mod modes;
pub mod picking;
pub mod pins;
pub mod png_io;
pub mod render;
pub mod synthetic;

use std::path::PathBuf;

use bevy::input::mouse::MouseScrollUnit;
use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use sim::world::ProvinceId;

use crate::bridge::Views;
use crate::pages::PageRef;
use crate::ui::rail::{Router, Screen};
use crate::ui::theme::color;
use crate::ui::{KeyboardCapture, ShellLayout, SpawnLayout, UiSystems, modifier_held};
use crate::workspace::{OpenPage, OpenTarget, WorkspaceInput};
use camera::Camera;
use picking::{MapBitmap, TinyTargets};

/// The map folder the render assets come from (`main.rs` sets it; none in tests).
#[derive(Resource, Debug, Clone, Default)]
pub struct MapSource(pub Option<PathBuf>);

/// The map node, under the window layer in the main area.
#[derive(Component, Debug, Clone, Copy)]
pub struct MapView;

/// A tiny province's dot at its label point (M8.4).
#[derive(Component, Debug, Clone, Copy)]
pub struct TinyDot(pub ProvinceId);

/// The map's state: the camera (once there is a bitmap), the view's size, what is hovered and
/// selected.
#[derive(Resource, Debug, Clone, Default)]
pub struct MapState {
    pub camera: Option<Camera>,
    /// The map node's logical size.
    pub view: Vec2,
    pub hover: Option<ProvinceId>,
    pub selected: Option<ProvinceId>,
    /// The pointer's travel since the last press, so a drag never counts as a click.
    dragged: f32,
}

/// Pointer input on the map in view coordinates (logical pixels from the node's top left),
/// written by the map node's observers; tests write them directly.
#[derive(Message, Debug, Clone, Copy, PartialEq)]
pub enum MapInput {
    Hover(Option<Vec2>),
    Press,
    Drag(Vec2),
    Click { at: Vec2, new_pane: bool },
    Zoom { at: Vec2, steps: f32 },
}

/// A press that travels farther than this is a drag, not a click.
pub const CLICK_SLOP_PX: f32 = 4.0;
/// The view's size before the map node is laid out (headless tests).
pub const DEFAULT_VIEW: Vec2 = Vec2::new(1280.0, 800.0);
/// Wheel pixels per notch, for pixel-unit wheels (touchpads).
pub const WHEEL_PX_PER_STEP: f32 = 120.0;
/// A tiny province's dot, in logical pixels.
pub const TINY_DOT_PX: f32 = 6.0;

/// Load and spawn order at startup.
#[derive(SystemSet, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MapLoad;

/// The map's pointer and key input each frame (the modes read the mode bar after it).
#[derive(SystemSet, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MapInputSet;

pub struct MapPlugin;

impl Plugin for MapPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<MapSource>()
            .init_resource::<MapState>()
            .init_resource::<TinyTargets>()
            .add_message::<MapInput>()
            .add_systems(
                Startup,
                (spawn_map_view, load_bitmap)
                    .chain()
                    .after(SpawnLayout)
                    .in_set(MapLoad),
            )
            .add_systems(
                Update,
                (
                    measure_view,
                    sync_tiny_targets,
                    map_keys,
                    apply_map_input,
                    ease_camera,
                )
                    .chain()
                    .in_set(UiSystems::Input)
                    .in_set(MapInputSet)
                    .before(WorkspaceInput),
            )
            .add_systems(Update, place_tiny_dots.in_set(UiSystems::Show))
            .add_plugins((
                modes::MapModesPlugin,
                pins::MapPinsPlugin,
                labels::MapLabelsPlugin,
                card::MapCardPlugin,
            ));
    }
}

/// Reads the CPU copy of the index (M8.1, M8.4). A missing folder is no map; a broken file is
/// logged and the map stays empty.
fn load_bitmap(mut commands: Commands, source: Res<MapSource>, mut state: ResMut<MapState>) {
    let Some(dir) = &source.0 else {
        return;
    };
    let path = dir.join(sim_data_names::PROVINCE_INDEX_PNG);
    if !path.is_file() {
        return;
    }
    match png_io::read_gray16(&path) {
        Ok(r) => {
            let bitmap = MapBitmap {
                width: r.width,
                height: r.height,
                data: std::sync::Arc::new(r.data),
            };
            let view = if state.view.x > 0.0 {
                state.view
            } else {
                DEFAULT_VIEW
            };
            state.camera = Some(Camera::fit(bitmap.size(), view));
            commands.insert_resource(bitmap);
        }
        Err(e) => error!("map: {e}"),
    }
}

/// The contract's file names (docs/build/m8-map-assets.md); the game does not read sim-data.
pub mod sim_data_names {
    pub const PROVINCE_INDEX_PNG: &str = "province-index.png";
    pub const PROVINCE_BORDERS_PNG: &str = "province-borders.png";
}

/// Installs a bitmap (a test's, or one loaded later) and fits the camera to it.
pub fn install_bitmap(world: &mut World, bitmap: MapBitmap) {
    let size = bitmap.size();
    world.insert_resource(bitmap);
    let mut state = world.resource_mut::<MapState>();
    let view = if state.view.x > 0.0 {
        state.view
    } else {
        DEFAULT_VIEW
    };
    state.camera = Some(Camera::fit(size, view));
}

fn spawn_map_view(mut commands: Commands, layout: Res<ShellLayout>, mut state: ResMut<MapState>) {
    state.view = DEFAULT_VIEW;
    let view = commands
        .spawn((
            MapView,
            Node {
                position_type: PositionType::Absolute,
                left: px(0.0),
                top: px(0.0),
                width: percent(100.0),
                height: percent(100.0),
                overflow: Overflow::clip(),
                ..default()
            },
            BackgroundColor(color::BG),
            Hovered::default(),
        ))
        .observe(on_move)
        .observe(on_out)
        .observe(on_press)
        .observe(on_drag)
        .observe(on_click)
        .observe(on_scroll)
        .id();
    // First child: under the window layer and the toasts.
    commands.entity(layout.main).insert_children(0, &[view]);
}

/// A pointer position (logical, window space) in the map node's logical space.
fn local(
    nodes: &Query<(&ComputedNode, &UiGlobalTransform), With<MapView>>,
    e: Entity,
    pos: Vec2,
) -> Option<Vec2> {
    let (n, t) = nodes.get(e).ok()?;
    let inv = n.inverse_scale_factor;
    let norm = n.normalize_point(*t, pos / inv)?;
    Some((norm + Vec2::splat(0.5)) * n.size * inv)
}

fn on_move(
    ev: On<PointerMove>,
    nodes: Query<(&ComputedNode, &UiGlobalTransform), With<MapView>>,
    mut w: MessageWriter<MapInput>,
) {
    w.write(MapInput::Hover(local(
        &nodes,
        ev.event_target(),
        ev.pointer.location().position,
    )));
}

fn on_out(_: On<PointerOut>, mut w: MessageWriter<MapInput>) {
    w.write(MapInput::Hover(None));
}

fn on_press(_: On<PointerPress>, mut w: MessageWriter<MapInput>) {
    w.write(MapInput::Press);
}

fn on_drag(ev: On<PointerDrag>, mut w: MessageWriter<MapInput>) {
    w.write(MapInput::Drag(ev.delta));
}

fn on_click(
    ev: On<PointerClick>,
    nodes: Query<(&ComputedNode, &UiGlobalTransform), With<MapView>>,
    keys: Res<ButtonInput<KeyCode>>,
    mut w: MessageWriter<MapInput>,
) {
    if ev.button == PointerButton::Secondary {
        return;
    }
    if let Some(at) = local(&nodes, ev.event_target(), ev.pointer.location().position) {
        let shift = keys.any_pressed([KeyCode::ShiftLeft, KeyCode::ShiftRight]);
        w.write(MapInput::Click {
            at,
            new_pane: shift || ev.button == PointerButton::Middle,
        });
    }
}

fn on_scroll(
    ev: On<PointerScroll>,
    nodes: Query<(&ComputedNode, &UiGlobalTransform), With<MapView>>,
    mut w: MessageWriter<MapInput>,
) {
    let steps = match ev.unit {
        MouseScrollUnit::Line => ev.y,
        MouseScrollUnit::Pixel => ev.y / WHEEL_PX_PER_STEP,
    };
    if let Some(at) = local(&nodes, ev.event_target(), ev.pointer.location().position) {
        w.write(MapInput::Zoom { at, steps });
    }
}

/// The view follows the laid-out map node; a camera showing the whole world keeps showing it.
fn measure_view(
    mut state: ResMut<MapState>,
    bitmap: Option<Res<MapBitmap>>,
    nodes: Query<&ComputedNode, With<MapView>>,
) {
    let Ok(n) = nodes.single() else { return };
    let s = n.size * n.inverse_scale_factor;
    if !(s.x > 0.0 && s.y > 0.0) || (s - state.view).length() <= 0.5 {
        return;
    }
    let old = state.view;
    state.view = s;
    if let (Some(b), Some(cam)) = (bitmap, &mut state.camera)
        && (cam.target - camera::max_scale(b.size(), old)).abs() <= cam.target * 1e-3
    {
        let fit = camera::max_scale(b.size(), s);
        cam.target = fit;
        cam.scale = fit;
        cam.pan(b.size(), s, Vec2::ZERO);
    }
}

fn sync_tiny_targets(views: Res<Views>, mut tiny: ResMut<TinyTargets>) {
    let v = views.map_static.version();
    if tiny.version != Some(v) {
        *tiny = TinyTargets::from_view(views.map_static.get(), v);
    }
}

/// W A S D pan and Q / E zoom (D636), when no text field has the keyboard, Pdoomberg is not up
/// and no Ctrl or Alt is held.
fn map_keys(
    keys: Res<ButtonInput<KeyCode>>,
    capture: Res<KeyboardCapture>,
    router: Res<Router>,
    time: Res<Time>,
    bitmap: Option<Res<MapBitmap>>,
    mut state: ResMut<MapState>,
) {
    if capture.0 || router.current == Screen::Pdoomberg || modifier_held(&keys) {
        return;
    }
    let Some(bitmap) = bitmap else { return };
    let mut d = Vec2::ZERO;
    for (k, v) in [
        (KeyCode::KeyA, Vec2::X),
        (KeyCode::KeyD, -Vec2::X),
        (KeyCode::KeyW, Vec2::Y),
        (KeyCode::KeyS, -Vec2::Y),
    ] {
        if keys.pressed(k) {
            d += v;
        }
    }
    let zoom =
        f32::from(keys.just_pressed(KeyCode::KeyE)) - f32::from(keys.just_pressed(KeyCode::KeyQ));
    if d == Vec2::ZERO && zoom == 0.0 {
        return;
    }
    let (map, view) = (bitmap.size(), state.view);
    let Some(cam) = &mut state.camera else { return };
    if d != Vec2::ZERO {
        cam.pan(map, view, d * camera::KEY_PAN_PX_PER_S * time.delta_secs());
    }
    if zoom != 0.0 {
        cam.zoom(map, view, zoom, view / 2.0);
    }
}

/// Pointer input: hover, drag pans, wheel zooms, a click selects and opens the province.
fn apply_map_input(
    mut input: MessageReader<MapInput>,
    mut state: ResMut<MapState>,
    bitmap: Option<Res<MapBitmap>>,
    views: Res<Views>,
    tiny: Res<TinyTargets>,
    mut open: MessageWriter<OpenPage>,
) {
    let Some(bitmap) = bitmap else {
        input.clear();
        return;
    };
    let (map, view) = (bitmap.size(), state.view);
    for m in input.read() {
        let s = &mut *state;
        let Some(cam) = &mut s.camera else { continue };
        let statics = views.map_static.get();
        match *m {
            MapInput::Hover(p) => {
                let h = p.and_then(|p| picking::pick(&bitmap, cam, view, p, statics, &tiny));
                if s.hover != h {
                    s.hover = h;
                }
            }
            MapInput::Press => s.dragged = 0.0,
            MapInput::Drag(d) => {
                s.dragged += d.length();
                cam.pan(map, view, d);
            }
            MapInput::Zoom { at, steps } => cam.zoom(map, view, steps, at),
            MapInput::Click { at, new_pane } => {
                if std::mem::take(&mut s.dragged) > CLICK_SLOP_PX {
                    continue;
                }
                let Some(id) = picking::pick(&bitmap, cam, view, at, statics, &tiny) else {
                    continue;
                };
                s.selected = Some(id);
                open.write(OpenPage {
                    page: PageRef::Province(id),
                    target: if new_pane {
                        OpenTarget::NewPane
                    } else {
                        OpenTarget::Focused
                    },
                });
            }
        }
    }
}

fn ease_camera(time: Res<Time>, bitmap: Option<Res<MapBitmap>>, mut state: ResMut<MapState>) {
    let Some(bitmap) = bitmap else { return };
    let view = state.view;
    // Only a moving zoom touches the resource, so the material re-uploads only then.
    let busy = state
        .camera
        .is_some_and(|c| c.scale != c.target || c.scale > camera::max_scale(bitmap.size(), view));
    if busy && let Some(cam) = &mut state.camera {
        cam.update(bitmap.size(), view, time.delta_secs());
    }
}

/// Dots at the tiny provinces' label points, placed where the camera shows them (hidden off the
/// view). They let the pointer through to the map node, whose picking finds them (D640), so
/// they carry no tooltip; lane MB's hover card names the province.
#[allow(clippy::too_many_arguments)]
fn place_tiny_dots(
    mut commands: Commands,
    state: Res<MapState>,
    tiny: Res<TinyTargets>,
    bitmap: Option<Res<MapBitmap>>,
    view_q: Query<Entity, With<MapView>>,
    mut dots: Query<(Entity, &TinyDot, &mut Node)>,
    added: Query<(), Added<TinyDot>>,
) {
    let (Some(bitmap), Ok(map_view)) = (bitmap, view_q.single()) else {
        return;
    };
    if tiny.is_changed() {
        for (e, _, _) in &dots {
            commands.entity(e).despawn();
        }
        for &(id, _) in &tiny.targets {
            let dot = commands
                .spawn((
                    TinyDot(id),
                    Node {
                        position_type: PositionType::Absolute,
                        width: px(TINY_DOT_PX),
                        height: px(TINY_DOT_PX),
                        border: UiRect::all(px(1.0)),
                        border_radius: BorderRadius::MAX,
                        display: Display::None,
                        ..default()
                    },
                    BackgroundColor(color::PANEL_RAISED),
                    BorderColor::all(color::TEXT_MUTED),
                    Pickable::IGNORE,
                ))
                .id();
            commands.entity(map_view).add_child(dot);
        }
        return;
    }
    // New dots are placed the frame they appear, not at the camera's next move.
    if !state.is_changed() && added.is_empty() {
        return;
    }
    let Some(cam) = state.camera else { return };
    for (_, dot, mut node) in &mut dots {
        let Some(&(_, label)) = tiny.targets.iter().find(|(id, _)| *id == dot.0) else {
            continue;
        };
        let p = cam.to_view(bitmap.size(), state.view, label);
        let inside = p.x >= 0.0 && p.y >= 0.0 && p.x <= state.view.x && p.y <= state.view.y;
        let display = if inside { Display::Flex } else { Display::None };
        let (left, top) = (px(p.x - TINY_DOT_PX / 2.0), px(p.y - TINY_DOT_PX / 2.0));
        if node.display != display || node.left != left || node.top != top {
            node.display = display;
            node.left = left;
            node.top = top;
        }
    }
}
