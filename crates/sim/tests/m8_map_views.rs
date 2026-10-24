//! M8 Phase A map views (spec 8 Map row, 9.2, 9.4): v_map_static, v_map_layers (Political) and
//! v_province_card, from the province files and a fixture assets/map folder in the contract's
//! format (docs/build/m8-map-assets.md). The map is static data beside the world: the economy,
//! the state hash and the save are the same with and without it.

mod common;

use std::path::PathBuf;

use sim::Sim;
use sim::map::BorderKind;
use sim::views::map_layers::{LayerValues, MapMode};
use sim::views::province_cards::LargestTrack;
use sim::world::{Ordinal, ProvinceId};
use sim_data::map::fixture::{self, Rect};

struct Scratch(PathBuf);

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// The data with a fixture map: three Alabama and Alaska provinces, a tiny one, and a contested
/// Taiwanese one far off.
fn data_with_map(name: &str) -> (sim_data::WorldData, Scratch) {
    let dir = std::env::temp_dir().join(format!("tc20ff-sim-map-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    fixture::write(
        &dir,
        128,
        64,
        20,
        &[
            Rect("US-0001", [0, 0, 10, 10]),
            Rect("US-0002", [10, 0, 20, 10]),
            Rect("US-0003", [20, 0, 30, 10]),
            Rect("US-0004", [10, 10, 14, 14]),
            Rect("TW-0001", [100, 30, 110, 40]),
        ],
    )
    .unwrap();
    let mut data = common::data();
    data.map = sim_data::load_map(&dir).unwrap();
    assert!(data.map.is_some());
    (data, Scratch(dir))
}

fn pid(sim: &Sim, key: &str) -> ProvinceId {
    sim.views()
        .places
        .get()
        .provinces
        .iter()
        .find(|p| p.key == key)
        .unwrap()
        .id
}

#[test]
fn map_static_maps_the_bitmap_to_provinces() {
    let (data, _dir) = data_with_map("static");
    let sim = Sim::new(data, 1).unwrap();
    let v = sim.views().map_static.get();
    let geo = v.geo.as_ref().expect("the map geometry");
    assert_eq!((geo.info.width, geo.info.height), (128, 64));
    assert_eq!(geo.info.tiny_px, Some(20));
    assert_eq!(geo.index.len(), 5);
    // Bitmap index i is the i-th colour row (sorted by id): TW-0001 first.
    assert_eq!(v.province_at_index(0), None, "0 is water");
    assert_eq!(v.province_at_index(1), Some(pid(&sim, "TW-0001")));
    assert_eq!(v.province_at_index(2), Some(pid(&sim, "US-0001")));
    assert_eq!(v.province_at_index(6), None);
    let us2 = pid(&sim, "US-0002");
    let s = v.shape(us2).unwrap();
    assert_eq!(s.index, 3);
    assert_eq!(s.centroid, (15.0, 5.0));
    assert_eq!(s.label, (15.0, 5.0));
    assert_eq!(s.area_px, 100);
    assert!(!s.tiny);
    // Provinces outside the fixture have no shape (Phase A covers only NA).
    assert!(v.shape(pid(&sim, "GB-0001")).is_none());
    // Neighbours, both ways, in ordinal order.
    let n: Vec<ProvinceId> = v.neighbors(us2).iter().map(|n| n.province).collect();
    assert_eq!(
        n,
        [
            pid(&sim, "US-0001"),
            pid(&sim, "US-0003"),
            pid(&sim, "US-0004")
        ]
    );
    assert!(v.neighbors(us2).iter().all(|n| n.kind == BorderKind::Land));
    assert_eq!(v.neighbors(pid(&sim, "US-0001"))[0].province, us2);
    assert_eq!(v.neighbors(pid(&sim, "US-0001"))[0].border_px, 10.0);
    // The tiny province's click target is its label point.
    assert_eq!(v.tiny_targets(), [(pid(&sim, "US-0004"), (12.0, 12.0))]);
    // Every province has a row; contested and development come from the province files.
    assert_eq!(v.provinces.len(), 3963);
    let tw = &v.provinces[pid(&sim, "TW-0001").index()];
    assert!(tw.contested);
    let us1 = &v.provinces[pid(&sim, "US-0001").index()];
    assert_eq!((us1.commerce, us1.industry, us1.population), (9, 12, 16));
    assert!(!us1.contested);
    // Metros and key cities list their provinces.
    for (i, m) in v.metros.iter().enumerate() {
        assert!(!m.provinces.is_empty(), "{}", m.name);
        for p in &m.provinces {
            assert_eq!(v.provinces[p.index()].metro, Some(i as u32));
        }
    }
    assert_eq!(v.key_cities.len(), 88);
    assert!(
        v.key_cities
            .iter()
            .filter(|k| !k.provinces.is_empty())
            .count()
            > 80
    );
}

#[test]
fn no_map_assets_is_no_geometry() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let v = sim.views().map_static.get();
    assert!(v.geo.is_none());
    assert!(v.province_at_index(1).is_none());
    assert!(v.tiny_targets().is_empty());
    // The cards and layers need no map assets.
    assert_eq!(v.provinces.len(), 3963);
    assert_eq!(sim.views().province_cards.get().cards.len(), 3963);
}

#[test]
fn political_layer_is_the_country_and_the_contested_tag() {
    let (data, _dir) = data_with_map("political");
    let sim = Sim::new(data, 1).unwrap();
    let views = sim.views();
    let layer = views.map_layers.get().get_map_layer(MapMode::Political);
    let LayerValues::Categories(values) = &layer.values else {
        panic!("political is categorical");
    };
    let places = &views.places.get().provinces;
    assert_eq!(values.len(), places.len());
    for (p, v) in places.iter().zip(values) {
        assert_eq!(*v, p.country.0);
    }
    let contested: Vec<&str> = places
        .iter()
        .filter(|p| layer.hatched[p.id.index()])
        .map(|p| p.key.as_str())
        .collect();
    assert_eq!(contested.len(), 67, "every province with a contested tag");
    assert!(contested.contains(&"TW-0001"));
    assert!(!contested.contains(&"US-0001"));
    // The legend: each country with a province once, named.
    assert_eq!(layer.legend.len(), views.places.get().countries.len());
    let usa = views.countries.get().by_iso3("USA").unwrap();
    let row = layer.legend.iter().find(|l| l.value == usa.id.0).unwrap();
    assert_eq!(row.label, usa.name);
}

#[test]
fn province_cards_show_the_spec_8_fields() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let views = sim.views();
    let cards = views.province_cards.get();
    let us1 = cards.get(pid(&sim, "US-0001")).unwrap();
    assert_eq!(us1.name, "Birmingham-North Alabama");
    assert_eq!(
        (us1.region.as_str(), us1.area.as_str()),
        ("Alabama", "Alabama")
    );
    assert_eq!((us1.commerce, us1.industry, us1.population), (9, 12, 16));
    assert_eq!(us1.total, 37);
    assert_eq!(us1.largest_track, LargestTrack::Industry);
    assert_eq!(
        (us1.resource.as_str(), us1.terrain.as_str()),
        ("Coal", "Temperate")
    );
    assert!(!us1.coastal);
    assert_eq!(us1.contested, None);
    assert_eq!(us1.city_rank, "City");
    assert!(cards.get(pid(&sim, "US-0002")).unwrap().coastal);
    // HQs and units: every live company's HQ and every unit's base, exactly once.
    let details = &views.company_detail.get().companies;
    let hq_total: usize = cards.cards.iter().map(|c| c.hqs.len()).sum();
    assert_eq!(hq_total, details.len());
    for c in details {
        assert!(cards.get(c.hq_province).unwrap().hqs.contains(&c.id));
    }
    let units = &views.units.get().units;
    let unit_total: usize = cards.cards.iter().map(|c| c.units.len()).sum();
    assert_eq!(unit_total, units.len());
    for u in units {
        assert!(cards.get(u.base_province).unwrap().units.contains(&u.id));
    }
    // A key city and a Metro show by name.
    let statics = views.map_static.get();
    let with_city = cards.cards.iter().find(|c| c.key_city.is_some()).unwrap();
    let k = statics.provinces[with_city.id.index()].key_city.unwrap();
    assert_eq!(
        with_city.key_city.as_deref(),
        Some(statics.key_cities[k as usize].name.as_str())
    );
    let with_metro = cards.cards.iter().find(|c| c.metro.is_some()).unwrap();
    let m = statics.provinces[with_metro.id.index()].metro.unwrap();
    assert_eq!(
        with_metro.metro.as_deref(),
        Some(statics.metros[m as usize].name.as_str())
    );
    let tw = cards.get(pid(&sim, "TW-0001")).unwrap();
    assert_eq!(tw.contested.as_deref(), Some("CHN claims"));
}

/// The map changes no state: two games of the same seed, one with the map, hash and save the
/// same through a month, and a save loads into either.
#[test]
fn the_map_moves_nothing() {
    let (with_map, _dir) = data_with_map("moves");
    let mut a = Sim::new(with_map, 7).unwrap();
    let mut b = Sim::new(common::data(), 7).unwrap();
    for _ in 0..(32 * 24) {
        a.step();
        b.step();
    }
    assert_eq!(a.state_hash(), b.state_hash());
    assert_eq!(a.save_bytes(), b.save_bytes());
    // A load keeps the game's own map data.
    let bytes = b.save_bytes();
    a.load_bytes(&bytes).unwrap();
    assert!(a.views().map_static.get().geo.is_some());
    assert_eq!(a.state_hash(), b.state_hash());
}
