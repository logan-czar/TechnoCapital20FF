//! Helpers for headless tests that send pointer events by hand (there is no window, so picking
//! never fires them): a mouse pointer and an empty hit to build `PointerClick`, `PointerDrag`
//! and the rest with, for `World::trigger`.

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
