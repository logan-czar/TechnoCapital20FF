//! M8.6 labels (build-plan M8.6 (T): labels do not overlap at World zoom; D706): country names
//! at World zoom, regions and key cities at Country zoom, provinces at Province zoom, culled so
//! no two overlap, wrapping with the map. On a synthetic map of every province (D705).

mod common;

use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, frames};
use game::bridge::{SimBridgePlugin, Views};
use game::map::camera::{Camera, ZoomLevel};
use game::map::labels::{
    Anchor, LabelAnchors, LabelKind, MapLabel, PlacedLabels, label_box, place,
};
use game::map::picking::MapBitmap;
use game::test_support::{Scratch, install_map_bitmap, with_world_map};
use game::ui::ShellPlugin;
use sim::Sim;

fn map_app(dir: &Scratch, width: u32) -> App {
    let data = with_world_map(common::data(), dir.path(), width);
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
        .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
        .add_plugins(SimBridgePlugin::new(Sim::new(data, 1).unwrap()))
        .add_plugins(ShellPlugin);
    app.update();
    install_map_bitmap(app.world_mut(), dir.path());
    frames(&mut app, 2);
    app
}

fn assert_apart(placed: &[game::map::labels::Placed], what: &str, scale: f32) {
    for (i, a) in placed.iter().enumerate() {
        let ba = label_box(a.kind, &a.text, a.at, scale);
        for b in &placed[i + 1..] {
            let bb = label_box(b.kind, &b.text, b.at, scale);
            let meet = ba.0.x < bb.1.x && bb.0.x < ba.1.x && ba.0.y < bb.1.y && bb.0.y < ba.1.y;
            assert!(!meet, "{what}: {:?} overlaps {:?}", a.text, b.text);
        }
    }
}

#[test]
fn labels_follow_the_zoom_and_never_overlap() {
    let dir = Scratch::new("m8-labels");
    let app = map_app(&dir, 2048);
    let views = app.world().resource::<Views>();
    let anchors = LabelAnchors::build(views.map_static.get(), views.places.get(), 1);
    let map = app.world().resource::<MapBitmap>().size();
    let view = Vec2::new(1280.0, 720.0);
    let mut cam = Camera::fit(map, view);
    assert_eq!(cam.level(map, view), ZoomLevel::World);
    let world = place(&anchors, &cam, map, view, 1.0, &[]);
    assert!(world.len() >= 25, "{} country names", world.len());
    assert!(world.iter().all(|l| l.kind == LabelKind::Country));
    assert_apart(&world, "World", 1.0);
    // Every country's anchor is on one of its own provinces.
    let statics = views.map_static.get();
    for a in &anchors.world {
        let geo = statics.geo.as_ref().unwrap();
        let p = geo
            .shapes
            .iter()
            .position(|s| {
                s.is_some_and(|s| (s.label.0 as f32, s.label.1 as f32) == (a.at.x, a.at.y))
            })
            .unwrap();
        let country = statics.provinces[p].country;
        assert_eq!(views.places.get().country(country).unwrap().name, a.text);
    }
    // Country zoom: regions and key cities; Province zoom: provinces. Apart at every centre.
    // (A small view, so the closest zoom of this small bitmap reaches Province zoom.)
    let view = Vec2::new(480.0, 320.0);
    for (steps, level) in [(6.0, ZoomLevel::Country), (12.0, ZoomLevel::Province)] {
        cam = Camera::fit(map, view);
        cam.zoom(map, view, steps, view / 2.0);
        cam.scale = cam.target;
        assert_eq!(cam.level(map, view), level);
        let mut seen = 0;
        for i in 0..24 {
            cam.center = Vec2::new(map.x * i as f32 / 24.0, map.y * 0.45);
            cam.pan(map, view, Vec2::ZERO);
            let placed = place(&anchors, &cam, map, view, 1.0, &[]);
            assert_apart(&placed, &format!("{level:?} at {i}"), 1.0);
            for l in &placed {
                assert_eq!(l.kind.level(), level, "{}", l.text);
                let b = label_box(l.kind, &l.text, l.at, 1.0);
                assert!(b.0.x >= 0.0 && b.1.x <= view.x && b.0.y >= 0.0 && b.1.y <= view.y);
            }
            seen += placed.len();
        }
        assert!(seen > 20, "{level:?}: {seen} labels");
    }
    let kinds: Vec<LabelKind> = anchors.country.iter().map(|a| a.kind).collect();
    assert!(kinds.contains(&LabelKind::KeyCity) && kinds.contains(&LabelKind::Region));
}

#[test]
fn labels_wrap_with_the_map_and_show_on_screen() {
    let dir = Scratch::new("m8-labels-wrap");
    let mut app = map_app(&dir, 1024);
    frames(&mut app, 2);
    let placed = app.world().resource::<PlacedLabels>().0.clone();
    assert!(!placed.is_empty(), "World zoom shows country names");
    // The label nodes say what was placed.
    let texts: Vec<String> = app
        .world_mut()
        .query_filtered::<(&Text, &Node), With<MapLabel>>()
        .iter(app.world())
        .filter(|(_, n)| n.display != Display::None)
        .map(|(t, _)| t.0.clone())
        .collect();
    for p in &placed {
        assert!(texts.contains(&p.text), "{}", p.text);
    }
    // A label just east of the antimeridian shows to the east of a camera centred just west
    // of it: labels wrap with the map.
    let map = app.world().resource::<MapBitmap>().size();
    let anchors = LabelAnchors {
        version: Some(1),
        world: Vec::new(),
        country: Vec::new(),
        province: vec![Anchor {
            kind: LabelKind::Province,
            text: "East".into(),
            at: Vec2::new(5.0, map.y / 2.0),
            weight: 1.0,
            area: 1e6,
        }],
    };
    let view = Vec2::new(200.0, 150.0);
    let mut cam = Camera::fit(map, view);
    cam.zoom(map, view, 13.0, view / 2.0);
    cam.scale = cam.target;
    cam.center = Vec2::new(map.x - 10.0, map.y / 2.0);
    cam.pan(map, view, Vec2::ZERO);
    let placed = place(&anchors, &cam, map, view, 1.0, &[]);
    assert_eq!(placed.len(), 1);
    let want = view.x / 2.0 + 15.0 / cam.scale;
    assert!(
        (placed[0].at.x - want).abs() < 0.01,
        "{} vs {want}",
        placed[0].at.x
    );
}

/// At a larger font scale the boxes grow with the text, so labels still never overlap, and
/// none sits on the map's own UI (the mode bar, the legend, the toasts; review of PR #37).
#[test]
fn labels_follow_the_font_scale_and_keep_off_the_map_ui() {
    let dir = Scratch::new("m8-labels-scale");
    let mut app = map_app(&dir, 2048);
    // The shell re-places its labels when the font scale changes, without a camera move.
    frames(&mut app, 2);
    let before = app.world().resource::<PlacedLabels>().0.clone();
    app.world_mut()
        .resource_mut::<game::config::UiConfig>()
        .font_scale = 1.5;
    frames(&mut app, 2);
    let after = app.world().resource::<PlacedLabels>().0.clone();
    assert_ne!(before, after, "re-placed at the new font scale");
    assert_apart(&after, "the shell at font scale 1.5", 1.5);
    let views = app.world().resource::<Views>();
    let anchors = LabelAnchors::build(views.map_static.get(), views.places.get(), 1);
    let map = app.world().resource::<MapBitmap>().size();
    let view = Vec2::new(1280.0, 720.0);
    let cam = Camera::fit(map, view);
    let plain = place(&anchors, &cam, map, view, 1.0, &[]);
    for scale in [1.25, 1.5] {
        let placed = place(&anchors, &cam, map, view, scale, &[]);
        assert!(!placed.is_empty());
        assert_apart(&placed, &format!("World at font scale {scale}"), scale);
        assert!(placed.len() <= plain.len(), "larger text fits fewer labels");
        for l in &placed {
            let b = label_box(l.kind, &l.text, l.at, scale);
            let unscaled = label_box(l.kind, &l.text, l.at, 1.0);
            assert!(b.1.x - b.0.x > unscaled.1.x - unscaled.0.x);
            // Still centred on its anchor.
            assert!(((b.0 + b.1) / 2.0 - l.at).length() < 1e-3);
        }
    }
    // A blocked rectangle (the legend) keeps every label off it.
    let legend = (Vec2::new(0.0, 300.0), Vec2::new(700.0, 720.0));
    let placed = place(&anchors, &cam, map, view, 1.5, &[legend]);
    for l in &placed {
        let b = label_box(l.kind, &l.text, l.at, 1.5);
        let meet =
            b.0.x < legend.1.x && legend.0.x < b.1.x && b.0.y < legend.1.y && legend.0.y < b.1.y;
        assert!(!meet, "{} sits on the legend", l.text);
    }
}
