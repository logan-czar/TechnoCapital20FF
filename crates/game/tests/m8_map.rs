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
