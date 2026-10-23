//! v_map_static: development, political, Metros, key cities (spec 9.2), and the map geometry the
//! game draws and picks with (M8.1 to M8.4): the bitmap index to province table, each
//! province's centroid, label point, area and tiny flag, its neighbours, and the map's header.
//! Rebuilt once at load (spec 9.4).
//!
//! The geometry comes from lane P's `assets/map` (docs/build/m8-map-assets.md) through
//! sim-data; without it `geo` is `None` and the map shows nothing. The bitmaps themselves are
//! render assets the game loads directly; everything per province comes from here.

use std::sync::Arc;

use super::{Cadence, ViewData, ViewInput};
use crate::map::{MapGeo, Neighbor, ProvinceShape};
use crate::world::{CountryId, Ordinal, ProvinceId};

/// A named group of provinces (a Metro or a key city).
#[derive(Debug, Clone, PartialEq)]
pub struct PlaceGroup {
    pub name: String,
    /// In ordinal order.
    pub provinces: Vec<ProvinceId>,
}

/// One province's static map row (spec 3.3, 9.2).
#[derive(Debug, Clone, PartialEq)]
pub struct MapProvince {
    pub id: ProvinceId,
    pub country: CountryId,
    /// Development tracks (spec 3.3), for the Development modes (M8.5).
    pub commerce: u32,
    pub industry: u32,
    pub population: u32,
    /// The province is contested (decision C): drawn hatched.
    pub contested: bool,
    /// Index into [`MapStaticView::metros`].
    pub metro: Option<u32>,
    /// Index into [`MapStaticView::key_cities`].
    pub key_city: Option<u32>,
    /// Index into [`MapStaticView::regions`] (M8.6 labels).
    pub region: u32,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct MapStaticView {
    /// By province ordinal.
    pub provinces: Vec<MapProvince>,
    /// Metros by name order.
    pub metros: Vec<PlaceGroup>,
    /// Key cities in key-cities.csv order.
    pub key_cities: Vec<PlaceGroup>,
    /// Regions (spec 3.3 `region`), each a country's: in the order their first province comes
    /// in ordinal order, so a region is one name in one country (D706).
    pub regions: Vec<PlaceGroup>,
    /// The loaded map geometry, shared (it is large and never changes).
    pub geo: Option<Arc<MapGeo>>,
}

impl MapStaticView {
    /// The province at bitmap index `i` (0 is water).
    pub fn province_at_index(&self, i: u16) -> Option<ProvinceId> {
        self.geo.as_ref()?.province_at(i)
    }

    /// A province's place in the bitmap, if it has a shape yet.
    pub fn shape(&self, id: ProvinceId) -> Option<&ProvinceShape> {
        self.geo.as_ref()?.shapes.get(id.index())?.as_ref()
    }

    /// A province's neighbours in ordinal order.
    pub fn neighbors(&self, id: ProvinceId) -> &[Neighbor] {
        self.geo
            .as_ref()
            .and_then(|g| g.neighbors.get(id.index()))
            .map_or(&[], Vec::as_slice)
    }

    /// The tiny provinces with their label points, in ordinal order: their click targets
    /// (M8.4).
    pub fn tiny_targets(&self) -> Vec<(ProvinceId, (f64, f64))> {
        let Some(g) = &self.geo else {
            return Vec::new();
        };
        g.shapes
            .iter()
            .enumerate()
            .filter_map(|(i, s)| {
                s.filter(|s| s.tiny)
                    .map(|s| (ProvinceId::from_index(i), s.label))
            })
            .collect()
    }
}

impl ViewData for MapStaticView {
    const CADENCE: Cadence = Cadence::OnceAtLoad;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let map = input.map;
        let sites = &w.births.sites;
        let mut metro_names: Vec<&str> = map
            .provinces
            .iter()
            .filter_map(|p| p.metro.as_deref())
            .collect();
        metro_names.sort_unstable();
        metro_names.dedup();
        let mut metros: Vec<PlaceGroup> = metro_names
            .iter()
            .map(|n| PlaceGroup {
                name: (*n).to_owned(),
                provinces: Vec::new(),
            })
            .collect();
        let mut key_cities: Vec<PlaceGroup> = sites
            .key_cities
            .iter()
            .map(|k| PlaceGroup {
                name: k.name.clone(),
                provinces: Vec::new(),
            })
            .collect();
        let mut regions: Vec<PlaceGroup> = Vec::new();
        let mut region_of: std::collections::BTreeMap<(CountryId, &str), u32> =
            std::collections::BTreeMap::new();
        let provinces = w
            .provinces
            .iter()
            .map(|(id, p)| {
                let region_name = map.provinces.get(id.index()).map_or("", |s| s.region.as_str());
                let region = *region_of.entry((p.country, region_name)).or_insert_with(|| {
                    regions.push(PlaceGroup {
                        name: region_name.to_owned(),
                        provinces: Vec::new(),
                    });
                    (regions.len() - 1) as u32
                });
                regions[region as usize].provinces.push(id);
                let s = map.provinces.get(id.index());
                let metro = s
                    .and_then(|s| s.metro.as_deref())
                    .and_then(|m| metro_names.binary_search(&m).ok())
                    .map(|i| i as u32);
                if let Some(m) = metro {
                    metros[m as usize].provinces.push(id);
                }
                let key_city = sites.key_city.get(id.index()).copied().flatten();
                if let Some(k) = key_city {
                    key_cities[k as usize].provinces.push(id);
                }
                MapProvince {
                    id,
                    country: p.country,
                    commerce: s.map_or(0, |s| s.commerce),
                    industry: s.map_or(0, |s| s.industry),
                    population: s.map_or(0, |s| s.population),
                    contested: s.is_some_and(|s| s.contested.is_some()),
                    metro,
                    key_city,
                    region,
                }
            })
            .collect();
        MapStaticView {
            provinces,
            metros,
            key_cities,
            regions,
            geo: map.geo.clone(),
        }
    }
}
