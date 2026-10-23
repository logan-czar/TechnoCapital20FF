//! Map labels (build-plan M8.6; m8-plan 2 "straight, by zoom level"; D706): country names at
//! World zoom, region and key city names at Country zoom, province names at Province zoom,
//! straight text centred on label points, with overlap culling. Anchors come from v_map_static
//! (label points, areas, regions, key cities) and v_places (names); nothing per province is
//! the game's own.
//!
//! A country's or region's anchor is the label point of its province nearest the area-weighted
//! median of its provinces' centroids (robust to far islands such as Alaska or Hawaii, and
//! always on land in it). Labels are placed greedily by priority (larger areas first, key
//! cities before regions), each kept only if its box, padded, overlaps no label already placed
//! and lies wholly inside the view, so no two labels overlap at any zoom. They follow the
//! camera and wrap east to west with the map.

use bevy::prelude::*;
use sim::views::MapStaticView;
use sim::views::places::PlacesView;
use sim::world::{CountryId, Ordinal, ProvinceId};

use super::camera::{Camera, ZoomLevel};
use super::picking::MapBitmap;
use super::{MapState, MapView};
use crate::bridge::Views;
use crate::config::UiConfig;
use crate::ui::UiSystems;
use crate::ui::theme::{self, color};

/// What a label names (its style).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LabelKind {
    Country,
    KeyCity,
    Region,
    Province,
}

impl LabelKind {
    /// Font size, logical pixels.
    pub fn size(self) -> f32 {
        match self {
            LabelKind::Country => 14.0,
            LabelKind::KeyCity => 12.0,
            LabelKind::Region => 11.0,
            LabelKind::Province => 11.0,
        }
    }

    pub fn color(self) -> Color {
        match self {
            LabelKind::Country => color::TEXT,
            LabelKind::KeyCity => color::AMBER,
            LabelKind::Region => color::TEXT_MUTED,
            LabelKind::Province => color::TEXT_MUTED,
        }
    }

    /// The smallest area (logical square pixels at the current zoom) its place must show to be
    /// labelled, so a speck of a country or region gets no name over the sea (D706).
    pub fn min_area(self) -> f64 {
        match self {
            LabelKind::Country => 300.0,
            LabelKind::Region => 200.0,
            LabelKind::KeyCity | LabelKind::Province => 0.0,
        }
    }

    /// The zoom level it shows at.
    pub fn level(self) -> ZoomLevel {
        match self {
            LabelKind::Country => ZoomLevel::World,
            LabelKind::KeyCity | LabelKind::Region => ZoomLevel::Country,
            LabelKind::Province => ZoomLevel::Province,
        }
    }
}

/// A label's text, where it goes (bitmap pixels) and its priority (higher first).
#[derive(Debug, Clone, PartialEq)]
pub struct Anchor {
    pub kind: LabelKind,
    pub text: String,
    pub at: Vec2,
    pub weight: f64,
    /// The area it names, bitmap pixels.
    pub area: f64,
}

/// The default font's advance per character, as a share of its size (Fira Mono, D302).
pub const CHAR_W: f32 = 0.6;
/// A line's height, as a share of its size.
pub const LINE_H: f32 = 1.2;
/// Padding round a label's box in the overlap test, logical pixels.
pub const LABEL_PAD: f32 = 3.0;
/// The labels' place among the map node's children (under the pins and the bar).
pub const LABEL_Z: i32 = 1;

/// A label's box at `at` (its centre), logical pixels: (min, max), at the config's font scale
/// (D458: every theme text follows it, the labels too).
pub fn label_box(kind: LabelKind, text: &str, at: Vec2, font_scale: f32) -> (Vec2, Vec2) {
    let s = font_px(kind, font_scale);
    let half = Vec2::new(text.chars().count() as f32 * s * CHAR_W, s * LINE_H) / 2.0;
    (at - half, at + half)
}

/// A label's font size in logical pixels at a font scale, as the theme rounds it.
pub fn font_px(kind: LabelKind, font_scale: f32) -> f32 {
    (kind.size() * font_scale).round()
}

/// A rectangle in the map view's logical pixels: (min, max).
pub type ViewRect = (Vec2, Vec2);

fn overlaps(a: (Vec2, Vec2), b: (Vec2, Vec2)) -> bool {
    a.0.x < b.1.x && b.0.x < a.1.x && a.0.y < b.1.y && b.0.y < a.1.y
}

fn pad((lo, hi): (Vec2, Vec2)) -> (Vec2, Vec2) {
    (lo - Vec2::splat(LABEL_PAD), hi + Vec2::splat(LABEL_PAD))
}

/// Every anchor of the map, grouped by zoom level and sorted by priority (higher first, ties to
/// the lower ordinal).
#[derive(Resource, Debug, Clone, Default)]
pub struct LabelAnchors {
    pub version: Option<u64>,
    pub world: Vec<Anchor>,
    pub country: Vec<Anchor>,
    pub province: Vec<Anchor>,
}

/// The weighted median of `xs` (value, weight).
fn weighted_median(mut xs: Vec<(f64, f64)>) -> f64 {
    xs.sort_by(|a, b| a.0.total_cmp(&b.0));
    let total: f64 = xs.iter().map(|x| x.1).sum();
    let mut acc = 0.0;
    for (v, w) in &xs {
        acc += w;
        if acc >= total / 2.0 {
            return *v;
        }
    }
    xs.last().map_or(0.0, |x| x.0)
}

/// The anchor of a group of provinces: the label point of its province nearest the
/// area-weighted median of their centroids; and the group's area. `None` with no shape.
pub fn group_anchor(statics: &MapStaticView, provinces: &[ProvinceId]) -> Option<(Vec2, f64)> {
    let geo = statics.geo.as_ref()?;
    let w = f64::from(geo.info.width);
    let shapes: Vec<_> = provinces
        .iter()
        .filter_map(|&p| statics.shape(p).map(|s| (p, s)))
        .collect();
    let (_, big) = *shapes
        .iter()
        .max_by(|a, b| a.1.area_px.cmp(&b.1.area_px).then(b.0.cmp(&a.0)))?;
    // Unwrap x about the largest shape, so a group across the antimeridian stays together.
    let unwrap = |x: f64| {
        let d = (x - big.centroid.0).rem_euclid(w);
        big.centroid.0 + if d > w / 2.0 { d - w } else { d }
    };
    let area: f64 = shapes.iter().map(|(_, s)| s.area_px as f64).sum();
    let mx = weighted_median(
        shapes
            .iter()
            .map(|(_, s)| (unwrap(s.centroid.0), s.area_px as f64))
            .collect(),
    );
    let my = weighted_median(
        shapes
            .iter()
            .map(|(_, s)| (s.centroid.1, s.area_px as f64))
            .collect(),
    );
    let (_, best) = shapes.iter().min_by(|a, b| {
        let d = |s: &sim::map::ProvinceShape| {
            (unwrap(s.label.0) - mx).powi(2) + (s.label.1 - my).powi(2)
        };
        d(a.1).total_cmp(&d(b.1)).then(a.0.cmp(&b.0))
    })?;
    Some((Vec2::new(best.label.0 as f32, best.label.1 as f32), area))
}

fn sorted(mut v: Vec<(Anchor, u32)>) -> Vec<Anchor> {
    v.sort_by(|a, b| {
        a.0.kind
            .cmp(&b.0.kind)
            .then(b.0.weight.total_cmp(&a.0.weight))
            .then(a.1.cmp(&b.1))
    });
    v.into_iter().map(|(a, _)| a).collect()
}

impl LabelAnchors {
    pub fn build(statics: &MapStaticView, places: &PlacesView, version: u64) -> LabelAnchors {
        let mut out = LabelAnchors {
            version: Some(version),
            ..default()
        };
        if statics.geo.is_none() {
            return out;
        }
        // Countries: their provinces by ordinal.
        let mut by_country: Vec<Vec<ProvinceId>> = vec![Vec::new(); places.countries.len()];
        for p in &statics.provinces {
            if let Some(v) = by_country.get_mut(p.country.index()) {
                v.push(p.id);
            }
        }
        let mut world = Vec::new();
        for (i, ps) in by_country.iter().enumerate() {
            let c = CountryId::from_index(i);
            if let (Some((at, area)), Some(name)) = (group_anchor(statics, ps), places.country(c)) {
                world.push((
                    Anchor {
                        kind: LabelKind::Country,
                        text: name.name.clone(),
                        at,
                        weight: area,
                        area,
                    },
                    i as u32,
                ));
            }
        }
        out.world = sorted(world);
        let mut country = Vec::new();
        for (i, k) in statics.key_cities.iter().enumerate() {
            // A key city sits on its first province's label point; its weight is its rank in
            // the file (earlier first).
            if let Some(s) = k.provinces.first().and_then(|&p| statics.shape(p)) {
                country.push((
                    Anchor {
                        kind: LabelKind::KeyCity,
                        text: k.name.clone(),
                        at: Vec2::new(s.label.0 as f32, s.label.1 as f32),
                        weight: -(i as f64),
                        area: s.area_px as f64,
                    },
                    i as u32,
                ));
            }
        }
        for (i, r) in statics.regions.iter().enumerate() {
            if r.name.is_empty() {
                continue;
            }
            if let Some((at, area)) = group_anchor(statics, &r.provinces) {
                country.push((
                    Anchor {
                        kind: LabelKind::Region,
                        text: r.name.clone(),
                        at,
                        weight: area,
                        area,
                    },
                    i as u32,
                ));
            }
        }
        out.country = sorted(country);
        let mut province = Vec::new();
        for p in &places.provinces {
            if let Some(s) = statics.shape(p.id) {
                province.push((
                    Anchor {
                        kind: LabelKind::Province,
                        text: p.name.clone(),
                        at: Vec2::new(s.label.0 as f32, s.label.1 as f32),
                        weight: s.area_px as f64,
                        area: s.area_px as f64,
                    },
                    p.id.0,
                ));
            }
        }
        out.province = sorted(province);
        out
    }

    pub fn at_level(&self, level: ZoomLevel) -> &[Anchor] {
        match level {
            ZoomLevel::World => &self.world,
            ZoomLevel::Country => &self.country,
            ZoomLevel::Province => &self.province,
        }
    }
}

/// A placed label: what it says and its centre in view coordinates.
#[derive(Debug, Clone, PartialEq)]
pub struct Placed {
    pub kind: LabelKind,
    pub text: String,
    pub at: Vec2,
}

/// The labels shown for the camera: the zoom level's anchors in priority order, each kept if
/// its padded box, at the font scale, is inside the view and overlaps none kept before it nor
/// any `blocked` rectangle (the mode bar, the legend, the toasts; D706).
pub fn place(
    anchors: &LabelAnchors,
    cam: &Camera,
    map: Vec2,
    view: Vec2,
    font_scale: f32,
    blocked: &[ViewRect],
) -> Vec<Placed> {
    let level = cam.level(map, view);
    let mut boxes: Vec<(Vec2, Vec2)> = blocked.to_vec();
    let mut out = Vec::new();
    let px_area = f64::from(cam.scale).powi(2);
    for a in anchors.at_level(level) {
        if a.area / px_area < a.kind.min_area() {
            continue;
        }
        let at = cam.to_view(map, view, a.at);
        let b = label_box(a.kind, &a.text, at, font_scale);
        if b.0.x < 0.0 || b.0.y < 0.0 || b.1.x > view.x || b.1.y > view.y {
            continue;
        }
        let pb = pad(b);
        if boxes.iter().any(|&o| overlaps(o, pb)) {
            continue;
        }
        boxes.push(pb);
        out.push(Placed {
            kind: a.kind,
            text: a.text.clone(),
            at,
        });
    }
    out
}

/// What the placed labels depend on: the camera's centre and scale, the view, the anchors, the
/// font scale and the map UI's rectangles.
type LabelKey = (Vec2, f32, Vec2, Option<u64>, f32, Vec<ViewRect>);

/// The map UI labels keep clear of: the mode bar and the legend.
type MapUi = (With<super::modes::ModeBar>, With<super::modes::Legend>);

type LabelNode = (
    Entity,
    &'static mut Text,
    &'static mut Node,
    &'static mut TextColor,
    &'static mut theme::ThemedText,
    &'static mut TextFont,
);

/// A label node of the pool.
#[derive(Component, Debug, Clone, Copy)]
pub struct MapLabel;

/// The labels on screen now (tests read them).
#[derive(Resource, Debug, Clone, Default)]
pub struct PlacedLabels(pub Vec<Placed>);

pub struct MapLabelsPlugin;

impl Plugin for MapLabelsPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<LabelAnchors>()
            .init_resource::<PlacedLabels>()
            .add_systems(
                Update,
                (sync_anchors, show_labels).chain().in_set(UiSystems::Show),
            );
    }
}

fn sync_anchors(views: Res<Views>, mut anchors: ResMut<LabelAnchors>) {
    let v = views.map_static.version();
    if anchors.version != Some(v) {
        *anchors = LabelAnchors::build(views.map_static.get(), views.places.get(), v);
    }
}

/// Places the labels when the camera, the view or the anchors move, reusing a pool of text
/// nodes (a text is rewritten only when it changes).
#[allow(clippy::too_many_arguments)]
fn show_labels(
    mut commands: Commands,
    state: Res<MapState>,
    anchors: Res<LabelAnchors>,
    bitmap: Option<Res<MapBitmap>>,
    view_q: Query<Entity, With<MapView>>,
    mut pool: Query<LabelNode, With<MapLabel>>,
    cfg: Res<UiConfig>,
    mut placed: ResMut<PlacedLabels>,
    mut last: Local<Option<LabelKey>>,
    ui: Query<(&ComputedNode, &UiGlobalTransform), Or<MapUi>>,
    map_node: Query<(&ComputedNode, &UiGlobalTransform), With<MapView>>,
    layout: Res<crate::ui::ShellLayout>,
    toasts: Query<(&ComputedNode, &UiGlobalTransform, &Children)>,
    any_node: Query<(&ComputedNode, &UiGlobalTransform)>,
) {
    let (Some(bitmap), Some(cam), Ok(map_view)) = (bitmap, state.camera, view_q.single()) else {
        return;
    };
    // The map UI and the toasts, in the map view's coordinates.
    let mut blocked = Vec::new();
    if let Ok(origin) = map_node.single().map(|(n, t)| global_rect(n, t).0) {
        let mut add = |n: &ComputedNode, t: &UiGlobalTransform| {
            let (lo, hi) = global_rect(n, t);
            if hi.x > lo.x && hi.y > lo.y {
                blocked.push((lo - origin, hi - origin));
            }
        };
        for (n, t) in &ui {
            add(n, t);
        }
        if let Ok((_, _, kids)) = toasts.get(layout.toasts) {
            for &k in kids {
                if let Ok((n, t)) = any_node.get(k) {
                    add(n, t);
                }
            }
        }
    }
    let scale = cfg.font_scale;
    let key = (
        cam.center,
        cam.scale,
        state.view,
        anchors.version,
        scale,
        blocked.clone(),
    );
    if last.as_ref() == Some(&key) {
        return;
    }
    *last = Some(key);
    let labels = place(&anchors, &cam, bitmap.size(), state.view, scale, &blocked);
    let mut nodes: Vec<_> = pool.iter_mut().collect();
    nodes.sort_by_key(|n| n.0);
    for (i, l) in labels.iter().enumerate() {
        let (lo, _) = label_box(l.kind, &l.text, l.at, scale);
        let want_font = FontSize::Px(font_px(l.kind, scale));
        if let Some((_, text, node, tc, themed, font)) = nodes.get_mut(i) {
            if text.0 != l.text {
                text.0.clone_from(&l.text);
            }
            if tc.0 != l.kind.color() {
                tc.0 = l.kind.color();
            }
            if themed.0 != l.kind.size() {
                themed.0 = l.kind.size();
            }
            if font.font_size != want_font {
                font.font_size = want_font;
            }
            let (left, top) = (px(lo.x), px(lo.y));
            if node.display != Display::Flex || node.left != left || node.top != top {
                node.display = Display::Flex;
                node.left = left;
                node.top = top;
            }
        } else {
            let e = commands
                .spawn((
                    MapLabel,
                    theme::text_line(l.text.clone(), l.kind.size(), l.kind.color()),
                    Node {
                        position_type: PositionType::Absolute,
                        left: px(lo.x),
                        top: px(lo.y),
                        ..default()
                    },
                    ZIndex(LABEL_Z),
                    TextShadow {
                        offset: Vec2::splat(1.0),
                        color: Color::srgba(0.0, 0.0, 0.0, 0.9),
                    },
                    Pickable::IGNORE,
                ))
                .id();
            commands.entity(map_view).add_child(e);
        }
    }
    for (_, _, node, _, _, _) in nodes.iter_mut().skip(labels.len()) {
        if node.display != Display::None {
            node.display = Display::None;
        }
    }
    placed.0 = labels;
}

/// A node's rectangle in logical window pixels.
fn global_rect(n: &ComputedNode, t: &UiGlobalTransform) -> ViewRect {
    let inv = n.inverse_scale_factor;
    let c = t.translation * inv;
    let half = n.size * inv / 2.0;
    (c - half, c + half)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_weighted_median_resists_far_outliers() {
        // A big group at 10 and a small far one at 900.
        let m = weighted_median(vec![(10.0, 50.0), (12.0, 40.0), (900.0, 30.0)]);
        assert_eq!(m, 12.0);
    }

    #[test]
    fn boxes_overlap_only_when_they_meet() {
        let a = label_box(LabelKind::Country, "Canada", Vec2::new(100.0, 100.0), 1.0);
        let b = label_box(LabelKind::Country, "Canada", Vec2::new(100.0, 200.0), 1.0);
        assert!(!overlaps(pad(a), pad(b)));
        let c = label_box(LabelKind::Country, "Canada", Vec2::new(120.0, 105.0), 1.0);
        assert!(overlaps(a, c));
    }
}
