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

/// The province under view point `p`: the nearest tiny target within [`TINY_TARGET_PX`]
/// (ties to the lower id), else the bitmap's province there.
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
    if let Some((_, id)) = best {
        return Some(id);
    }
    statics.province_at_index(bitmap.at(cam.to_map(map, view, p)))
}
