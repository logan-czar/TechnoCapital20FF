//! `--screenshot PATH` (a dev flag for PRs and Logan's checks): sets the map's camera from
//! `--map-look LON,LAT` and `--map-zoom STEPS`, optionally clicks the province at the view's
//! centre (`--map-click`), hides the windows (`--map-hide-windows`), lets the frames settle,
//! saves a screenshot of the window and exits.

use std::path::PathBuf;

use bevy::prelude::*;
use bevy::render::view::screenshot::{Screenshot, save_to_disk};

use crate::bridge::Views;
use crate::map::picking::MapBitmap;
use crate::map::synthetic::miller_y;
use crate::map::{MapInput, MapState};
use crate::workspace::Workspace;

/// Frames before the camera is set (the layout and the map are up), and before the shot.
pub const SETUP_FRAMES: u32 = 30;
pub const SHOT_FRAMES: u32 = 120;
/// Frames after the shot before the app exits (the capture is written asynchronously).
pub const EXIT_FRAMES: u32 = 60;

#[derive(Resource, Debug, Clone)]
pub struct ShotPlugin {
    pub path: PathBuf,
    /// Longitude and latitude to centre on.
    pub look: Option<(f64, f64)>,
    /// Wheel notches in from the whole-world view.
    pub zoom: f32,
    /// Click the province at the centre (opens its page).
    pub click: bool,
    /// Hide every window (the H key) before the shot.
    pub hide_windows: bool,
}

impl Plugin for ShotPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(self.clone())
            .add_systems(Last, run_shot);
    }
}

#[allow(clippy::too_many_arguments)]
fn run_shot(
    mut commands: Commands,
    shot: Res<ShotPlugin>,
    mut frame: Local<u32>,
    mut state: ResMut<MapState>,
    bitmap: Option<Res<MapBitmap>>,
    views: Res<Views>,
    mut ws: ResMut<Workspace>,
    mut input: MessageWriter<MapInput>,
    mut exit: MessageWriter<AppExit>,
) {
    *frame += 1;
    let f = *frame;
    if f == SETUP_FRAMES
        && let (Some(bitmap), Some(geo)) = (&bitmap, &views.map_static.get().geo)
    {
        let map = bitmap.size();
        let view = state.view;
        let left = ws.window(ws.active_window()).map_or(view.x, |w| w.rect.x);
        if let Some(cam) = &mut state.camera {
            if shot.zoom != 0.0 {
                cam.zoom(map, view, shot.zoom, view / 2.0);
                cam.scale = cam.target;
            }
            if let Some((lon, lat)) = shot.look {
                let i = &geo.info;
                let (top, bottom) = (miller_y(i.lat_max), miller_y(i.lat_min));
                let x = (lon - i.lon_min) / (i.lon_max - i.lon_min) * f64::from(i.width);
                let y = (top - miller_y(lat)) / (top - bottom) * f64::from(i.height);
                // The point shows in the middle of the map's part left of the window.
                let off = view.x / 2.0 - left.clamp(1.0, view.x) / 2.0;
                cam.center = Vec2::new(x as f32 + off * cam.scale, y as f32);
            }
            cam.pan(map, view, Vec2::ZERO);
        }
    }
    if f == SETUP_FRAMES + 60 && shot.click {
        let left = ws
            .window(ws.active_window())
            .map_or(state.view.x, |w| w.rect.x);
        let at = Vec2::new(left.clamp(1.0, state.view.x) / 2.0, state.view.y / 2.0);
        input.write(MapInput::Press);
        input.write(MapInput::Click {
            at,
            new_pane: false,
        });
        input.write(MapInput::Hover(Some(at)));
    }
    if f == SHOT_FRAMES - 10 && shot.hide_windows && !ws.hidden() {
        ws.toggle_hidden();
    }
    if f == SHOT_FRAMES {
        let path = shot.path.clone();
        info!("screenshot to {}", path.display());
        commands
            .spawn(Screenshot::primary_window())
            .observe(save_to_disk(path));
    }
    if f == SHOT_FRAMES + EXIT_FRAMES {
        exit.write(AppExit::Success);
    }
}
