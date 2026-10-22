//! The map camera (M8.3; D636): a centre in bitmap pixels and a scale in bitmap pixels per
//! logical screen pixel, over a Miller map that wraps east to west. Wheel and keys zoom about
//! the cursor; the zoom eases to its target so it stays smooth at 60 fps. Pure maths, tested
//! without a window.

use bevy::math::Vec2;

/// The named zoom levels (spec 8 Map row: World, Country, Province), by how many degrees of
/// longitude the view spans across.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ZoomLevel {
    World,
    Country,
    Province,
}

/// A view wider than this many degrees of longitude is World zoom (D636).
pub const WORLD_ABOVE_DEG: f32 = 110.0;
/// A view narrower than this is Province zoom; between the two is Country zoom.
pub const PROVINCE_BELOW_DEG: f32 = 28.0;
/// The closest zoom: logical pixels per bitmap pixel (a bitmap pixel 4 screen pixels wide).
pub const MAX_ZOOM_PX: f32 = 4.0;
/// One wheel notch (or key press) zooms by this factor.
pub const WHEEL_STEP: f32 = 1.25;
/// The zoom eases to its target at this rate (per second): most of the way in a fifth of a
/// second.
pub const ZOOM_EASE_PER_S: f32 = 14.0;
/// Keyboard panning, in logical pixels per second.
pub const KEY_PAN_PX_PER_S: f32 = 900.0;

/// The camera.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Camera {
    /// The bitmap pixel at the view's centre; x is kept in `0..map width`.
    pub center: Vec2,
    /// Bitmap pixels per logical pixel now.
    pub scale: f32,
    /// The scale the zoom eases to.
    pub target: f32,
    /// The bitmap point that stays under the cursor while the zoom eases, and that cursor's
    /// position in the view.
    anchor: Option<(Vec2, Vec2)>,
}

impl Camera {
    /// The whole map's width across a view `view` wide, centred.
    pub fn fit(map: Vec2, view: Vec2) -> Camera {
        let scale = max_scale(map, view);
        Camera {
            center: map / 2.0,
            scale,
            target: scale,
            anchor: None,
        }
    }

    /// Degrees of longitude the view spans.
    pub fn span_deg(&self, map: Vec2, view: Vec2) -> f32 {
        view.x * self.scale / map.x * 360.0
    }

    pub fn level(&self, map: Vec2, view: Vec2) -> ZoomLevel {
        let d = self.span_deg(map, view);
        if d > WORLD_ABOVE_DEG {
            ZoomLevel::World
        } else if d < PROVINCE_BELOW_DEG {
            ZoomLevel::Province
        } else {
            ZoomLevel::Country
        }
    }

    /// The bitmap point under view point `p` (x wrapped into the map, y unclamped).
    pub fn to_map(&self, map: Vec2, view: Vec2, p: Vec2) -> Vec2 {
        let m = self.center + (p - view / 2.0) * self.scale;
        Vec2::new(m.x.rem_euclid(map.x), m.y)
    }

    /// Where bitmap point `m` shows in the view: the copy nearest the centre (the map wraps).
    pub fn to_view(&self, map: Vec2, view: Vec2, m: Vec2) -> Vec2 {
        let mut dx = (m.x - self.center.x).rem_euclid(map.x);
        if dx > map.x / 2.0 {
            dx -= map.x;
        }
        view / 2.0 + Vec2::new(dx, m.y - self.center.y) / self.scale
    }

    /// Pans by a view-space delta (a drag moves the map with the pointer).
    pub fn pan(&mut self, map: Vec2, view: Vec2, delta: Vec2) {
        self.center -= delta * self.scale;
        self.clamp(map, view);
        // A zoom still easing keeps the cursor's view point, now over another map point.
        if let Some((_, p)) = self.anchor {
            self.anchor = Some((self.map_point_unwrapped(view, p), p));
        }
    }

    /// Zooms by `steps` wheel notches (positive in) about view point `at`.
    pub fn zoom(&mut self, map: Vec2, view: Vec2, steps: f32, at: Vec2) {
        let target = self.target / WHEEL_STEP.powf(steps);
        self.target = target.clamp(min_scale(), max_scale(map, view));
        self.anchor = Some((self.map_point_unwrapped(view, at), at));
    }

    fn map_point_unwrapped(&self, view: Vec2, p: Vec2) -> Vec2 {
        self.center + (p - view / 2.0) * self.scale
    }

    /// Eases the scale towards the target over `dt` seconds, keeping the anchor under its view
    /// point; true while it moves.
    pub fn update(&mut self, map: Vec2, view: Vec2, dt: f32) -> bool {
        // The view can grow (a window resize): the target stays inside the new range.
        self.target = self.target.clamp(min_scale(), max_scale(map, view));
        if (self.scale - self.target).abs() <= self.target * 1e-4 {
            let moved = self.scale != self.target;
            self.scale = self.target;
            self.anchor = None;
            self.clamp(map, view);
            return moved;
        }
        let k = 1.0 - (-ZOOM_EASE_PER_S * dt.max(0.0)).exp();
        // Ease in log space so zooming in and out feel the same.
        self.scale = (self.scale.ln() + (self.target.ln() - self.scale.ln()) * k).exp();
        if let Some((m, p)) = self.anchor {
            self.center = m - (p - view / 2.0) * self.scale;
        }
        self.clamp(map, view);
        true
    }

    /// Keeps x in the map (it wraps) and the view inside the map's height, or centred on it when
    /// the whole height shows.
    fn clamp(&mut self, map: Vec2, view: Vec2) {
        self.center.x = self.center.x.rem_euclid(map.x);
        let half = view.y * self.scale / 2.0;
        self.center.y = if half * 2.0 >= map.y {
            map.y / 2.0
        } else {
            self.center.y.clamp(half, map.y - half)
        };
    }
}

/// The farthest zoom: the whole map's width across the view.
pub fn max_scale(map: Vec2, view: Vec2) -> f32 {
    (map.x / view.x.max(1.0)).max(min_scale())
}

/// The closest zoom.
pub fn min_scale() -> f32 {
    1.0 / MAX_ZOOM_PX
}

#[cfg(test)]
mod tests {
    use super::*;

    const MAP: Vec2 = Vec2::new(8192.0, 4096.0);
    const VIEW: Vec2 = Vec2::new(1600.0, 900.0);

    fn settle(c: &mut Camera) {
        for _ in 0..600 {
            c.update(MAP, VIEW, 1.0 / 60.0);
        }
    }

    #[test]
    fn fit_shows_the_world() {
        let c = Camera::fit(MAP, VIEW);
        assert_eq!(c.level(MAP, VIEW), ZoomLevel::World);
        assert!((c.span_deg(MAP, VIEW) - 360.0).abs() < 1e-3);
        assert_eq!(c.to_map(MAP, VIEW, VIEW / 2.0), MAP / 2.0);
    }

    #[test]
    fn wheel_zoom_passes_through_the_levels_and_keeps_the_cursor_point() {
        let mut c = Camera::fit(MAP, VIEW);
        let at = Vec2::new(400.0, 300.0);
        let before = c.to_map(MAP, VIEW, at);
        let mut levels = vec![c.level(MAP, VIEW)];
        for _ in 0..30 {
            c.zoom(MAP, VIEW, 1.0, at);
            settle(&mut c);
            let l = c.level(MAP, VIEW);
            if levels.last() != Some(&l) {
                levels.push(l);
            }
        }
        assert_eq!(
            levels,
            [ZoomLevel::World, ZoomLevel::Country, ZoomLevel::Province]
        );
        assert!(
            (c.scale - min_scale()).abs() < 1e-6,
            "stops at the closest zoom"
        );
        let after = c.to_map(MAP, VIEW, at);
        assert!((after - before).length() < 1.0, "{before} -> {after}");
        // And all the way out again.
        for _ in 0..40 {
            c.zoom(MAP, VIEW, -1.0, at);
        }
        settle(&mut c);
        assert!((c.scale - max_scale(MAP, VIEW)).abs() < 1e-4);
    }

    #[test]
    fn the_zoom_eases_smoothly() {
        let mut c = Camera::fit(MAP, VIEW);
        c.zoom(MAP, VIEW, 4.0, VIEW / 2.0);
        let mut last = c.scale;
        let mut frames = 0;
        while c.update(MAP, VIEW, 1.0 / 60.0) {
            assert!(c.scale <= last, "monotone");
            // No frame jumps more than a third of the way in log space.
            assert!((last / c.scale).ln() < (WHEEL_STEP.powi(4)).ln() / 3.0);
            last = c.scale;
            frames += 1;
            assert!(frames < 120, "settles within 2 s");
        }
        assert!(frames > 5, "takes a few frames: {frames}");
    }

    #[test]
    fn the_map_wraps_east_to_west() {
        let mut c = Camera::fit(MAP, VIEW);
        c.zoom(MAP, VIEW, 6.0, VIEW / 2.0);
        settle(&mut c);
        // Pan right past the east edge: x wraps, the view keeps going.
        for _ in 0..200 {
            c.pan(MAP, VIEW, Vec2::new(-100.0, 0.0));
            assert!((0.0..MAP.x).contains(&c.center.x));
        }
        // A point just east of the antimeridian shows to the right of one just west of it.
        c.center = Vec2::new(MAP.x - 10.0, MAP.y / 2.0);
        let west = c.to_view(MAP, VIEW, Vec2::new(MAP.x - 5.0, MAP.y / 2.0));
        let east = c.to_view(MAP, VIEW, Vec2::new(5.0, MAP.y / 2.0));
        assert!(east.x > west.x);
        assert!((c.to_map(MAP, VIEW, east) - Vec2::new(5.0, MAP.y / 2.0)).length() < 1e-2);
    }

    #[test]
    fn the_view_stays_in_the_maps_height() {
        let mut c = Camera::fit(MAP, VIEW);
        c.pan(MAP, VIEW, Vec2::new(0.0, 5000.0));
        assert_eq!(c.center.y, MAP.y / 2.0, "the whole height shows: centred");
        c.zoom(MAP, VIEW, 8.0, VIEW / 2.0);
        settle(&mut c);
        c.pan(MAP, VIEW, Vec2::new(0.0, 1e6));
        let top = c.to_map(MAP, VIEW, Vec2::new(0.0, 0.0)).y;
        assert!(top.abs() < 1e-2, "top edge at the map's top: {top}");
    }
}
