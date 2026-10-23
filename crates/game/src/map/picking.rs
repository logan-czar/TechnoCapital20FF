//! Picking (M8.4; D637): the province under a view point, read from a CPU copy of the bitmap
//! index through the camera, with tiny provinces' click targets taking priority within
//! [`TINY_TARGET_PX`] of their label points. The index to province table and the label points
//! come from v_map_static (spec 9).

use std::sync::Arc;

use bevy::math::Vec2;
use bevy::prelude::Resource;
use sim::views::MapStaticView;
use sim::world::ProvinceId;

use super::camera::Camera;

/// A tiny province's click target radius around its label point, in logical pixels (D637).
pub const TINY_TARGET_PX: f32 = 9.0;

/// The CPU copy of `province-index.png`: the bitmap index of every pixel, row-major.
#[derive(Resource, Debug, Clone, PartialEq)]
pub struct MapBitmap {
    pub width: u32,
    pub height: u32,
    pub data: Arc<Vec<u16>>,
}

impl MapBitmap {
    pub fn size(&self) -> Vec2 {
        Vec2::new(self.width as f32, self.height as f32)
    }

    /// The index at bitmap point `m` (x wraps; off the top or bottom is water).
    pub fn at(&self, m: Vec2) -> u16 {
        if !(m.y >= 0.0 && m.y < self.height as f32) || !m.x.is_finite() {
            return 0;
        }
        let x = (m.x.floor() as i64).rem_euclid(i64::from(self.width)) as usize;
        let y = m.y.floor() as usize;
        self.data[y * self.width as usize + x]
    }
}

/// The tiny provinces' label points (from v_map_static), kept while its version holds.
#[derive(Resource, Debug, Clone, Default, PartialEq)]
pub struct TinyTargets {
    pub version: Option<u64>,
    pub targets: Vec<(ProvinceId, Vec2)>,
}

impl TinyTargets {
    pub fn from_view(v: &MapStaticView, version: u64) -> TinyTargets {
        TinyTargets {
            version: Some(version),
            targets: v
                .tiny_targets()
                .into_iter()
                .map(|(id, (x, y))| (id, Vec2::new(x as f32, y as f32)))
                .collect(),
        }
    }
}

/// A click this close to a tiny province's label point (its dot) always picks it (D640).
pub const TINY_DOT_HIT_PX: f32 = 4.0;
/// A tiny province's wider target ([`TINY_TARGET_PX`]) wins over the province under the cursor
/// only when that province shows smaller than this many square logical pixels at the current
/// zoom (or the cursor is over water), so it never steals a click from a province big enough to
/// click on (D640).
pub const TINY_STEAL_BELOW_SQ_PX: f32 = 64.0;

/// The province under view point `p` (D637, D640):
///
/// 1. within [`TINY_DOT_HIT_PX`] of a tiny province's label point (its dot): that province;
/// 2. else the bitmap's province there, unless it is water or shows smaller than
///    [`TINY_STEAL_BELOW_SQ_PX`] on screen and a tiny target is within [`TINY_TARGET_PX`];
/// 3. else that nearest tiny target (ties to the lower id), or water (none).
pub fn pick(
    bitmap: &MapBitmap,
    cam: &Camera,
    view: Vec2,
    p: Vec2,
    statics: &MapStaticView,
    tiny: &TinyTargets,
) -> Option<ProvinceId> {
    let map = bitmap.size();
    let mut best: Option<(f32, ProvinceId)> = None;
    for &(id, label) in &tiny.targets {
        let d = cam.to_view(map, view, label).distance(p);
        if d <= TINY_TARGET_PX && best.is_none_or(|(bd, bid)| (d, id) < (bd, bid)) {
            best = Some((d, id));
        }
    }
    if let Some((d, id)) = best
        && d <= TINY_DOT_HIT_PX
    {
        return Some(id);
    }
    let under = statics.province_at_index(bitmap.at(cam.to_map(map, view, p)));
    let small = |id: ProvinceId| {
        statics
            .shape(id)
            .is_none_or(|s| (s.area_px as f32) / (cam.scale * cam.scale) < TINY_STEAL_BELOW_SQ_PX)
    };
    // A tiny province under the cursor is itself the pick.
    let is_tiny = |id: ProvinceId| statics.shape(id).is_some_and(|s| s.tiny);
    match (under, best) {
        (Some(u), Some((_, t))) if small(u) && !is_tiny(u) => Some(t),
        (Some(u), _) => Some(u),
        (None, Some((_, t))) => Some(t),
        (None, None) => None,
    }
}
