//! M8 Phase A (lane MA): the synthetic map in the contract's format loads through sim-data and
//! the sim's views (D634), and the map's picking finds every province from the views alone.

mod common;

use game::map::synthetic::{SynthOptions, SynthProvince, generate, write};
use game::test_support::Scratch;
use sim::Sim;
use sim::world::Ordinal;

/// The NA provinces on the big island, Taiwan on the second, Fiji's first on the speck.
pub fn synth_provinces(data: &sim_data::WorldData) -> Vec<SynthProvince> {
    data.all_provinces()
        .filter_map(|(t, _, p)| {
            let island = if t.file == "provinces-north-america.csv" {
                0
            } else if p.id.starts_with("TW-") {
                1
            } else if p.id == "FJ-0001" {
                2
            } else {
                return None;
            };
            Some(SynthProvince {
                id: p.id.clone(),
                country: p.country.clone(),
                region: p.region.clone(),
                island,
            })
        })
        .collect()
}

/// The game's colour table holds every province the loader allows (review of PR #35).
#[test]
fn the_colour_table_holds_every_loadable_province() {
    assert_eq!(
        game::map::colors::TABLE_LEN - 1,
        sim_data::map::MAX_MAP_PROVINCES
    );
}

#[test]
fn the_synthetic_map_loads_through_the_views() {
    let mut data = common::data();
    let provinces = synth_provinces(&data);
    let dir = Scratch::new("m8-synthetic");
    let mut opts = SynthOptions::new(1024, 512);
    opts.coverage = vec!["provinces-north-america.csv".into()];
    let map = generate(&provinces, &opts);
    write(dir.path(), &map).unwrap();
    for f in [
        "map-meta.toml",
        "province-ids.png",
        "province-index.png",
        "province-colors.csv",
        "province-centroids.csv",
        "province-adjacency.csv",
        "province-borders.png",
    ] {
        assert!(dir.join(f).is_file(), "{f}");
    }
    data.map = sim_data::load_map(dir.path()).unwrap();
    let m = data.map.as_ref().unwrap();
    assert_eq!(m.colors.len(), provinces.len());
    assert_eq!(
        m.centroids.len(),
        provinces.len(),
        "every province has pixels"
    );
    assert!(m.adjacency.len() > provinces.len(), "{}", m.adjacency.len());
    assert!(
        sim_data::check(&data).is_empty(),
        "{:?}",
        sim_data::check(&data)
    );
    // The PNGs read back as the bitmap that was drawn.
    let index = game::map::png_io::read_gray16(&dir.join("province-index.png")).unwrap();
    assert_eq!((index.width, index.height), (1024, 512));
    assert_eq!(index.data, map.index);
    let ids = game::map::png_io::read_rgb8(&dir.join("province-ids.png")).unwrap();
    for (p, &v) in map.index.iter().enumerate().step_by(97) {
        let want = if v == 0 {
            [0, 0, 0]
        } else {
            game::map::synthetic::id_color(v)
        };
        assert_eq!(ids.data[p], want);
    }
    // Through the sim: every drawn province has a shape whose label point lies on it.
    let sim = Sim::new(data, 1).unwrap();
    let v = sim.views().map_static.get();
    let geo = v.geo.as_ref().unwrap();
    let mut tiny = 0;
    for (i, s) in geo.shapes.iter().enumerate() {
        let Some(s) = s else { continue };
        let (x, y) = (s.label.0 as usize, s.label.1 as usize);
        let at = map.index[y * 1024 + x];
        assert_eq!(
            at,
            s.index,
            "label of {} lies on it",
            sim::world::ProvinceId::from_index(i).0
        );
        tiny += usize::from(s.tiny);
    }
    assert!(tiny >= 1, "the speck is tiny");
}

mod picking {
    use super::*;
    use bevy::prelude::*;
    use bevy::time::TimeUpdateStrategy;
    use common::{FRAME, frames};
    use game::bridge::SimBridgePlugin;
    use game::map::picking::{MapBitmap, TINY_TARGET_PX};
    use game::map::{MapInput, MapState, install_bitmap};
    use game::pages::PageRef;
    use game::ui::ShellPlugin;
    use game::workspace::Workspace;
    use std::sync::Arc;

    /// The shell on a synthetic map, its bitmap installed as the map plugin loads it.
    fn map_app(dir: &Scratch) -> App {
        map_app_opts(dir, 1024, SynthOptions::new(1024, 512).tiny_px)
    }

    fn map_app_opts(dir: &Scratch, width: u32, tiny_px: u64) -> App {
        let mut data = common::data();
        let mut opts = SynthOptions::new(width, width / 2);
        opts.tiny_px = tiny_px;
        opts.coverage = vec!["provinces-north-america.csv".into()];
        let map = generate(&synth_provinces(&data), &opts);
        write(dir.path(), &map).unwrap();
        data.map = sim_data::load_map(dir.path()).unwrap();
        let mut app = App::new();
        app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
            .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
            .add_plugins(SimBridgePlugin::new(Sim::new(data, 42).unwrap()))
            .add_plugins(ShellPlugin);
        app.update();
        let index = game::map::png_io::read_gray16(&dir.join("province-index.png")).unwrap();
        install_bitmap(
            app.world_mut(),
            MapBitmap {
                width: index.width,
                height: index.height,
                data: Arc::new(index.data),
            },
        );
        frames(&mut app, 2);
        app
    }

    fn focused_page(app: &App) -> PageRef {
        let w = app.world().resource::<Workspace>();
        w.page(w.focused()).cloned().unwrap()
    }

    /// Zooms the camera in on bitmap point `m` (Province zoom), and returns where it shows.
    fn look_at(app: &mut App, m: Vec2) -> Vec2 {
        let size = app.world().resource::<MapBitmap>().size();
        let mut state = app.world_mut().resource_mut::<MapState>();
        let view = state.view;
        let cam = state.camera.as_mut().unwrap();
        cam.zoom(size, view, 8.0, view / 2.0);
        cam.scale = cam.target;
        cam.center = m;
        cam.pan(size, view, Vec2::ZERO);
        cam.to_view(size, view, m)
    }

    fn click_at(app: &mut App, at: Vec2, new_pane: bool) {
        app.world_mut().write_message(MapInput::Press);
        app.world_mut()
            .write_message(MapInput::Click { at, new_pane });
        frames(app, 2);
    }

    /// M8.8 on the synthetic map: every label point picks its own province.
    #[test]
    fn a_click_on_a_province_opens_its_page() {
        let dir = Scratch::new("m8-pick-click");
        let mut app = map_app(&dir);
        let geo = app
            .world()
            .resource::<game::bridge::Views>()
            .map_static
            .get()
            .geo
            .clone()
            .unwrap();
        let mut checked = 0;
        for (i, s) in geo.shapes.iter().enumerate() {
            let Some(s) = s else { continue };
            let id = sim::world::ProvinceId::from_index(i);
            let at = look_at(&mut app, Vec2::new(s.label.0 as f32, s.label.1 as f32));
            click_at(&mut app, at, false);
            assert_eq!(focused_page(&app), PageRef::Province(id), "{i}");
            assert_eq!(app.world().resource::<MapState>().selected, Some(id));
            checked += 1;
        }
        assert_eq!(checked, geo.index.len());
        // Hover follows the pointer; off the map is nothing.
        let s = *geo.shapes.iter().flatten().find(|s| !s.tiny).unwrap();
        let at = look_at(&mut app, Vec2::new(s.label.0 as f32, s.label.1 as f32));
        app.world_mut().write_message(MapInput::Hover(Some(at)));
        frames(&mut app, 1);
        let hover = app.world().resource::<MapState>().hover;
        assert_eq!(
            hover
                .and_then(|p| geo.shapes[p.0 as usize])
                .map(|x| x.index),
            Some(s.index)
        );
        app.world_mut().write_message(MapInput::Hover(None));
        frames(&mut app, 1);
        assert_eq!(app.world().resource::<MapState>().hover, None);
        // A drag is not a click.
        let before = focused_page(&app);
        let other = *geo
            .shapes
            .iter()
            .flatten()
            .find(|x| x.index != s.index && !x.tiny)
            .unwrap();
        let at = look_at(
            &mut app,
            Vec2::new(other.label.0 as f32, other.label.1 as f32),
        );
        app.world_mut().write_message(MapInput::Press);
        app.world_mut()
            .write_message(MapInput::Drag(Vec2::new(30.0, 0.0)));
        app.world_mut()
            .write_message(MapInput::Drag(Vec2::new(-30.0, 0.0)));
        app.world_mut().write_message(MapInput::Click {
            at,
            new_pane: false,
        });
        frames(&mut app, 2);
        assert_eq!(focused_page(&app), before, "the drag opened nothing");
        // Shift+click opens it in a new pane, the focus staying.
        let panes = app.world().resource::<Workspace>().len();
        click_at(&mut app, at, true);
        assert_eq!(app.world().resource::<Workspace>().len(), panes + 1);
        assert_eq!(focused_page(&app), before);
        // A click opens the page even with every window hidden: they come back.
        app.world_mut().resource_mut::<Workspace>().toggle_hidden();
        click_at(&mut app, at, false);
        assert!(!app.world().resource::<Workspace>().hidden());
    }

    #[test]
    fn a_tiny_province_wins_within_its_target() {
        let dir = Scratch::new("m8-pick-tiny");
        let mut app = map_app(&dir);
        let targets = app
            .world()
            .resource::<game::bridge::Views>()
            .map_static
            .get()
            .tiny_targets();
        assert!(!targets.is_empty());
        // A tiny province with water beside its label point (the Fijian speck's coast).
        let bitmap = app.world().resource::<MapBitmap>().clone();
        let size = bitmap.size();
        let (view, cam) = {
            let s = app.world().resource::<MapState>();
            (s.view, s.camera.unwrap())
        };
        let offset = |a: f32| Vec2::new(a.cos(), a.sin()) * (TINY_TARGET_PX - 2.0);
        let (id, at, water) = targets
            .iter()
            .find_map(|&(id, (lx, ly))| {
                let at = cam.to_view(size, view, Vec2::new(lx as f32, ly as f32));
                (0..16)
                    .map(|k| at + offset(k as f32 * std::f32::consts::TAU / 16.0))
                    .find(|&p| bitmap.at(cam.to_map(size, view, p)) == 0)
                    .map(|w| (id, at, w))
            })
            .expect("a tiny province by the water");
        // Over water within the target: the tiny province.
        click_at(&mut app, water, false);
        assert_eq!(focused_page(&app), PageRef::Province(id));
        // On its dot: always the tiny province.
        app.world_mut().resource_mut::<MapState>().selected = None;
        click_at(&mut app, at + Vec2::new(1.0, 1.0), false);
        assert_eq!(app.world().resource::<MapState>().selected, Some(id));
        // Well beyond the radius: not it.
        app.world_mut().resource_mut::<MapState>().selected = None;
        click_at(&mut app, at + Vec2::new(0.0, TINY_TARGET_PX * 4.0), false);
        assert_ne!(
            app.world().resource::<MapState>().selected,
            Some(id),
            "outside the radius"
        );
    }

    /// Tiny click targets never steal a click on a province big enough to click (D640): at a
    /// far zoom like NA's on screen (8 bitmap pixels a screen pixel) and closer, every normal
    /// province's label point picks that province, unless the province shows smaller than
    /// the steal threshold there or the click is on a tiny province's dot.
    #[test]
    fn tiny_targets_never_steal_normal_provinces() {
        use game::map::camera::Camera;
        use game::map::picking::{TINY_DOT_HIT_PX, TINY_STEAL_BELOW_SQ_PX, TinyTargets, pick};
        let dir = Scratch::new("m8-pick-steal");
        let app = map_app(&dir);
        let views = app.world().resource::<game::bridge::Views>().clone();
        let statics = views.map_static.get();
        let geo = statics.geo.clone().unwrap();
        let bitmap = app.world().resource::<MapBitmap>().clone();
        // Click targets among normal provinces, as PA's NA map has them: every third province's
        // label point is a target (as if it were tiny), and the others are checked.
        let mut tiny = TinyTargets::from_view(statics, 0);
        let mut fake = Vec::new();
        for (i, s) in geo.shapes.iter().enumerate() {
            if let Some(s) = s
                && i % 3 == 0
            {
                let id = sim::world::ProvinceId::from_index(i);
                fake.push((id, Vec2::new(s.label.0 as f32, s.label.1 as f32)));
            }
        }
        tiny.targets.extend(fake.iter().copied());
        let is_target = |i: usize| fake.iter().any(|(id, _)| id.0 as usize == i);
        let size = bitmap.size();
        // One bitmap pixel a screen pixel at the farthest zoom: the synthetic provinces then
        // show about as large as NA's do on an 8192-wide map in a 1000-pixel view.
        let view = Vec2::new(size.x, size.x * 0.6);
        let (mut checked, mut near_tiny, mut in_reach) = (0, 0, 0);
        for notches in [0.0, 3.0, 6.0, 9.0] {
            let mut cam = Camera::fit(size, view);
            cam.zoom(size, view, notches, view / 2.0);
            cam.scale = cam.target;
            for (i, s) in geo.shapes.iter().enumerate() {
                let Some(s) = s else { continue };
                if s.tiny
                    || is_target(i)
                    || (s.area_px as f32) / (cam.scale * cam.scale) < TINY_STEAL_BELOW_SQ_PX
                {
                    continue;
                }
                let label = Vec2::new(s.label.0 as f32, s.label.1 as f32);
                cam.center = label;
                cam.pan(size, view, Vec2::ZERO);
                let at = cam.to_view(size, view, label);
                let on_dot = tiny
                    .targets
                    .iter()
                    .any(|(_, l)| cam.to_view(size, view, *l).distance(at) <= TINY_DOT_HIT_PX);
                if on_dot {
                    near_tiny += 1;
                    continue;
                }
                in_reach += usize::from(tiny.targets.iter().any(|(_, l)| {
                    cam.to_view(size, view, *l).distance(at) <= game::map::picking::TINY_TARGET_PX
                }));
                let id = sim::world::ProvinceId::from_index(i);
                assert_eq!(
                    pick(&bitmap, &cam, view, at, statics, &tiny),
                    Some(id),
                    "province {i} at {notches} notches"
                );
                checked += 1;
            }
        }
        let n_tiny = tiny.targets.len();
        assert!(
            checked > 300,
            "{checked} clicks checked, {near_tiny} on a dot, {n_tiny} tiny"
        );
        assert!(
            in_reach > 10,
            "the old rule would have stolen {in_reach}: the test bites"
        );
    }

    /// The same check on a real map folder (lane PA's NA map), run by hand:
    /// `TC20FF_TEST_MAP_DIR=assets/map cargo test -p game --test m8_map -- --ignored`.
    /// Every label point at the farthest zoom of a 996-pixel view, and closer, picks its own
    /// province, except on a tiny province's dot or where it shows under the steal threshold.
    #[test]
    #[ignore = "needs TC20FF_TEST_MAP_DIR"]
    fn real_map_label_points_pick_their_provinces() {
        use game::map::camera::Camera;
        use game::map::picking::{TINY_DOT_HIT_PX, TINY_STEAL_BELOW_SQ_PX, TinyTargets, pick};
        let dir = std::path::PathBuf::from(std::env::var("TC20FF_TEST_MAP_DIR").unwrap());
        let mut data = common::data();
        data.map = sim_data::load_map(&dir).unwrap();
        let sim = Sim::new(data, 1).unwrap();
        let statics = sim.views().map_static.get();
        let geo = statics.geo.clone().unwrap();
        let index = game::map::png_io::read_gray16(&dir.join("province-index.png")).unwrap();
        let bitmap = MapBitmap {
            width: index.width,
            height: index.height,
            data: Arc::new(index.data),
        };
        let tiny = TinyTargets::from_view(statics, 0);
        let size = bitmap.size();
        let view = Vec2::new(996.0, 676.0);
        let (mut checked, mut skipped, mut wrong) = (0, 0, Vec::new());
        for notches in [0.0, 2.0, 4.0, 8.0] {
            let mut cam = Camera::fit(size, view);
            cam.zoom(size, view, notches, view / 2.0);
            cam.scale = cam.target;
            for (i, s) in geo.shapes.iter().enumerate() {
                let Some(s) = s else { continue };
                let label = Vec2::new(s.label.0 as f32, s.label.1 as f32);
                cam.center = label;
                cam.pan(size, view, Vec2::ZERO);
                let at = cam.to_view(size, view, label);
                let on_dot = tiny.targets.iter().any(|(id, l)| {
                    id.0 as usize != i
                        && cam.to_view(size, view, *l).distance(at) <= TINY_DOT_HIT_PX
                });
                if s.tiny
                    || on_dot
                    || (s.area_px as f32) / (cam.scale * cam.scale) < TINY_STEAL_BELOW_SQ_PX
                {
                    skipped += 1;
                    continue;
                }
                let got = pick(&bitmap, &cam, view, at, statics, &tiny);
                if got != Some(sim::world::ProvinceId::from_index(i)) {
                    wrong.push((notches, i, got));
                }
                checked += 1;
            }
        }
        println!(
            "real map: {checked} label clicks checked, {skipped} skipped, {} wrong",
            wrong.len()
        );
        assert!(wrong.is_empty(), "{wrong:?}");
    }
}
