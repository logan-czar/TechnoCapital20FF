//! Map pins (build-plan M8.5; spec 8 Map row; D703): the Company HQs mode's pins, sized by
//! revenue TTM as v_map_layers shows it (an estimate for a company that does not publish, never
//! its truth, D701) and coloured by sector, and the Financial zones mode's pin on each hub city
//! with its exchange code and headline index level. Every pin is a link (D454): hovering shows
//! its company's or exchange's name card, a click opens the page.
//!
//! A pin sits at its province's label point (v_map_static); several HQs in one province spread
//! round it on a sunflower, the largest in the middle. Pins follow the camera, wrap east to
//! west with the map ([`super::camera::Camera::to_view`]) and hide off the view.

use bevy::prelude::*;
use sim::views::map_layers::{MapPin, PinTarget};
use sim::world::ProvinceId;

use super::modes::CurrentLayer;
use super::picking::MapBitmap;
use super::{MapState, MapView, colors};
use crate::bridge::Views;
use crate::links::Link;
use crate::pages::PageRef;
use crate::table::format;
use crate::ui::UiSystems;
use crate::ui::theme::{self, color, font};

/// A pin on the map: its province, its offset from the label point (logical pixels) and its
/// diameter.
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub struct PinNode {
    pub province: ProvinceId,
    pub target: PinTarget,
    pub offset: Vec2,
    pub diameter: f32,
}

/// The smallest and largest HQ pin, logical pixels (D703).
pub const PIN_MIN_PX: f32 = 4.0;
pub const PIN_MAX_PX: f32 = 18.0;
/// The revenue a pin's growth is measured in: diameter = min + step × ln(1 + revenue / this).
pub const PIN_REVENUE_UNIT_USD: f64 = 100.0e6;
pub const PIN_LOG_STEP_PX: f32 = 2.4;
/// A hub pin's dot.
pub const HUB_PIN_PX: f32 = 9.0;
/// The sunflower's spacing between pins of one province, logical pixels.
pub const PIN_SPREAD_PX: f32 = 4.0;
/// The pins' place among the map node's children (over the labels, under the bar).
pub const PIN_Z: i32 = 3;

/// An HQ pin's diameter from the revenue it shows (D703): logarithmic, so a $100bn company is
/// larger than a $1bn one without hiding the map.
pub fn pin_px(revenue_shown: f64) -> f32 {
    let r = revenue_shown.max(0.0) / PIN_REVENUE_UNIT_USD;
    (PIN_MIN_PX + PIN_LOG_STEP_PX * (r.ln_1p() as f32)).clamp(PIN_MIN_PX, PIN_MAX_PX)
}

/// The offset of the `i`th pin of a province (0 in the middle), on a sunflower.
pub fn spread(i: usize) -> Vec2 {
    const GOLDEN_ANGLE: f32 = 2.399_963;
    if i == 0 {
        return Vec2::ZERO;
    }
    let r = PIN_SPREAD_PX * (i as f32).sqrt() * 1.6;
    let a = i as f32 * GOLDEN_ANGLE;
    Vec2::new(a.cos(), a.sin()) * r
}

/// Every pin of the layer with its offset and diameter, in draw order (small last, so on top).
pub fn layout(pins: &[MapPin]) -> Vec<(MapPin, Vec2, f32)> {
    let mut by_province: Vec<&MapPin> = pins.iter().collect();
    // Largest first within a province, ties to the lower id (D2).
    by_province.sort_by(|a, b| {
        a.province
            .cmp(&b.province)
            .then(b.size.total_cmp(&a.size))
            .then(target_key(a.target).cmp(&target_key(b.target)))
    });
    let mut out = Vec::with_capacity(pins.len());
    let mut i = 0;
    let mut last = None;
    for p in by_province {
        if last != Some(p.province) {
            i = 0;
            last = Some(p.province);
        }
        let d = match p.target {
            PinTarget::Company(_) => pin_px(p.size),
            PinTarget::Exchange(_) => HUB_PIN_PX,
        };
        out.push((p.clone(), spread(i), d));
        i += 1;
    }
    out
}

fn target_key(t: PinTarget) -> (u8, u32) {
    match t {
        PinTarget::Company(c) => (0, c.0),
        PinTarget::Exchange(z) => (1, z.0),
    }
}

/// A hub pin's label: its exchange code and headline index level.
pub fn hub_label(p: &MapPin) -> String {
    match p.level {
        Some(l) => format!("{} {}", p.code, format::number(l)),
        None => format!("{} -", p.code),
    }
}

pub struct MapPinsPlugin;

impl Plugin for MapPinsPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (rebuild_pins, place_pins).chain().in_set(UiSystems::Show),
        );
    }
}

/// Spawns the layer's pins when the layer (or v_map_static) moves.
fn rebuild_pins(
    mut commands: Commands,
    cur: Res<CurrentLayer>,
    views: Res<Views>,
    view_q: Query<Entity, With<MapView>>,
    pins: Query<Entity, With<PinNode>>,
    mut built: Local<Option<(u64, u64)>>,
) {
    let Ok(map_view) = view_q.single() else {
        return;
    };
    let key = (cur.generation, views.map_static.version());
    if *built == Some(key) {
        return;
    }
    *built = Some(key);
    for e in &pins {
        commands.entity(e).despawn();
    }
    let statics = views.map_static.get();
    for (p, offset, d) in layout(&cur.layer.pins) {
        if statics.shape(p.province).is_none() {
            continue;
        }
        let (page, fill) = match p.target {
            PinTarget::Company(c) => (PageRef::Company(c), colors::sector_color(p.category)),
            PinTarget::Exchange(z) => (PageRef::Exchange(z), [255, 255, 255]),
        };
        let mut e = commands.spawn((
            PinNode {
                province: p.province,
                target: p.target,
                offset,
                diameter: d,
            },
            Node {
                position_type: PositionType::Absolute,
                width: px(d),
                height: px(d),
                border: UiRect::all(px(1.0)),
                border_radius: BorderRadius::MAX,
                display: Display::None,
                overflow: Overflow::visible(),
                ..default()
            },
            BackgroundColor(Color::srgb_u8(fill[0], fill[1], fill[2])),
            BorderColor::all(color::BG),
            ZIndex(PIN_Z),
            Link(page),
        ));
        if let PinTarget::Exchange(_) = p.target {
            e.with_children(|c| {
                c.spawn((
                    Node {
                        position_type: PositionType::Absolute,
                        left: px(d + 3.0),
                        top: px(-4.0),
                        padding: UiRect::axes(px(3.0), px(1.0)),
                        ..default()
                    },
                    BackgroundColor(color::PANEL.with_alpha(0.85)),
                    Pickable::IGNORE,
                    children![(
                        theme::text_line(hub_label(&p), font::SMALL, color::TEXT),
                        Pickable::IGNORE
                    )],
                ));
            });
        }
        let e = e.id();
        commands.entity(map_view).add_child(e);
    }
}

/// Places every pin where the camera shows its label point (hidden off the view).
fn place_pins(
    state: Res<MapState>,
    views: Res<Views>,
    bitmap: Option<Res<MapBitmap>>,
    mut pins: Query<(Ref<PinNode>, &mut Node)>,
) {
    let (Some(bitmap), Some(cam)) = (bitmap, state.camera) else {
        return;
    };
    let any_new = pins.iter().any(|(p, _)| p.is_added());
    if !state.is_changed() && !any_new {
        return;
    }
    let statics = views.map_static.get();
    for (p, mut node) in &mut pins {
        let Some(s) = statics.shape(p.province) else {
            continue;
        };
        let label = Vec2::new(s.label.0 as f32, s.label.1 as f32);
        let at = cam.to_view(bitmap.size(), state.view, label) + p.offset;
        let r = p.diameter / 2.0;
        let inside =
            at.x >= -r && at.y >= -r && at.x <= state.view.x + r && at.y <= state.view.y + r;
        let display = if inside { Display::Flex } else { Display::None };
        let (left, top) = (px(at.x - r), px(at.y - r));
        if node.display != display || node.left != left || node.top != top {
            node.display = display;
            node.left = left;
            node.top = top;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sim::world::CompanyId;

    #[test]
    fn pins_grow_with_revenue_within_bounds() {
        assert_eq!(pin_px(0.0), PIN_MIN_PX);
        assert!(pin_px(1e9) > pin_px(1e8));
        assert!(pin_px(1e11) > pin_px(1e9));
        assert_eq!(pin_px(1e15), PIN_MAX_PX);
        assert_eq!(pin_px(-5.0), PIN_MIN_PX);
    }

    #[test]
    fn a_province_s_pins_spread_largest_first() {
        let pin = |c: u32, size: f64| MapPin {
            province: ProvinceId(7),
            target: PinTarget::Company(CompanyId(c)),
            size,
            category: 0,
            code: String::new(),
            level: None,
        };
        let l = layout(&[pin(1, 1e8), pin(2, 5e9), pin(3, 1e7)]);
        assert_eq!(l[0].0.target, PinTarget::Company(CompanyId(2)));
        assert_eq!(l[0].1, Vec2::ZERO);
        assert!(l[1].1.length() > 0.0);
        assert_ne!(l[1].1, l[2].1);
    }
}
