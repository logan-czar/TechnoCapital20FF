//! Helpers for headless tests: pointer events sent by hand (there is no window, so picking
//! never fires them): a mouse pointer and an empty hit to build `PointerClick`, `PointerDrag`
//! and the rest with, for `World::trigger`; and [`Scratch`], a temporary directory that is
//! removed when the test ends.

use std::path::{Path, PathBuf};

use bevy::camera::NormalizedRenderTarget;
use bevy::picking::backend::HitData;
use bevy::picking::events::{Pointer, PointerClick, PointerDrag, PointerDragDrop, PointerPress};
use bevy::picking::pointer::{Location, PointerButton, PointerId};
use bevy::prelude::*;

/// The mouse at the origin of no render target.
pub fn pointer() -> Pointer {
    Pointer::new(
        PointerId::Mouse,
        Location {
            target: NormalizedRenderTarget::None {
                width: 1,
                height: 1,
            },
            position: Vec2::ZERO,
        },
    )
}

/// A hit on nothing in particular.
pub fn hit() -> HitData {
    HitData::new(Entity::PLACEHOLDER, 0.0, None, None)
}

pub fn click(entity: Entity, button: PointerButton) -> PointerClick {
    PointerClick {
        entity,
        pointer: pointer(),
        button,
        hit: hit(),
        duration: std::time::Duration::from_millis(80),
        count: 1,
    }
}

pub fn press(entity: Entity, button: PointerButton) -> PointerPress {
    PointerPress {
        entity,
        pointer: pointer(),
        button,
        hit: hit(),
        count: 1,
    }
}

pub fn drag(entity: Entity, delta: Vec2) -> PointerDrag {
    PointerDrag {
        entity,
        pointer: pointer(),
        button: PointerButton::Primary,
        distance: delta,
        delta,
    }
}

pub fn drop_on(entity: Entity, dropped: Entity) -> PointerDragDrop {
    PointerDragDrop {
        entity,
        pointer: pointer(),
        button: PointerButton::Primary,
        dropped,
        hit: hit(),
    }
}

/// A fresh directory under the temp dir, named for the test and the process, removed when the
/// guard drops: when the test ends, pass or fail.
pub struct Scratch(PathBuf);

impl Scratch {
    pub fn new(name: &str) -> Scratch {
        let dir = std::env::temp_dir().join(format!("tc20ff-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Scratch(dir)
    }

    pub fn path(&self) -> &Path {
        &self.0
    }

    /// A path inside the directory.
    pub fn join(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// `data` with a synthetic map of every province (one island per province file, D705) written
/// into `dir` and loaded, `width` x `width / 2` pixels.
pub fn with_world_map(
    mut data: sim_data::WorldData,
    dir: &Path,
    width: u32,
) -> sim_data::WorldData {
    let (provinces, opts) = crate::map::synthetic::world_provinces(&data, width);
    let map = crate::map::synthetic::generate(&provinces, &opts);
    crate::map::synthetic::write(dir, &map).unwrap();
    data.map = sim_data::load_map(dir).unwrap();
    data
}

/// Installs the bitmap the map in `dir` holds, as the map plugin does at startup (a headless
/// app has no map source).
pub fn install_map_bitmap(world: &mut World, dir: &Path) {
    let index = crate::map::png_io::read_gray16(&dir.join("province-index.png")).unwrap();
    crate::map::install_bitmap(
        world,
        crate::map::picking::MapBitmap {
            width: index.width,
            height: index.height,
            data: std::sync::Arc::new(index.data),
        },
    );
}
