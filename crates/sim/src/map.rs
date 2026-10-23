//! Static map data the views read (M8; spec 3.3, 8 Map row, 9.2, 9.4): every province's tags
//! and development from the province files, and, when the game loaded lane P's assets
//! (docs/build/m8-map-assets.md), each province's centroid, label point, area, tiny flag and
//! neighbours, and the bitmap index to ordinal table.
//!
//! None of this is world state: it is built from the loaded data next to the world, never saved
//! and never hashed, so a save, the state hash and the economy are the same with or without a
//! map (the soak CSVs stay byte-identical). A load keeps the game's map data; a NewGame
//! rebuilds it from the same data.

use std::sync::Arc;

use sim_data::WorldData;

use crate::world::{LoadError, Ordinal, ProvinceId, World};

/// One province's static fields from its CSV row (spec 3.3) that the World does not keep.
#[derive(Debug, Clone, PartialEq)]
pub struct ProvinceStatic {
    /// Its superregion's province file slug (`north-america`).
    pub superregion: &'static str,
    pub region: String,
    pub area: String,
    /// The Metro's name, if the province is in one.
    pub metro: Option<String>,
    /// provinces-*.csv `city_rank` (`City`, `Town`, ...).
    pub city_rank: String,
    /// Development tracks, 1 to 30 each (spec 3.3).
    pub commerce: u32,
    pub industry: u32,
    pub population: u32,
    pub resource: String,
    pub terrain: String,
    pub coastal: bool,
    /// The `contested` tag (`CHN claims`), drawn hatched (decision C, M8.2).
    pub contested: Option<String>,
}

/// The map file's header (map-meta.toml).
#[derive(Debug, Clone, PartialEq)]
pub struct MapInfo {
    pub width: u32,
    pub height: u32,
    pub projection: String,
    pub lon_min: f64,
    pub lon_max: f64,
    pub lat_min: f64,
    pub lat_max: f64,
    pub pipeline_version: String,
    pub sources: Vec<(String, String)>,
    pub coverage: Vec<String>,
    /// The click-target threshold in pixels (`tiny_px`), if the file names one.
    pub tiny_px: Option<u64>,
}

/// A province's place in the bitmap (province-centroids.csv).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ProvinceShape {
    /// Its bitmap index: the 1-based row in province-colors.csv.
    pub index: u16,
    /// The centroid in degrees.
    pub lon: f64,
    pub lat: f64,
    /// The centroid and the label point in bitmap pixels.
    pub centroid: (f64, f64),
    pub label: (f64, f64),
    pub area_px: u64,
    /// Under the click-target threshold: it gets a click target at its label point (M8.4).
    pub tiny: bool,
}

/// How two provinces touch (province-adjacency.csv `kind`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BorderKind {
    Land,
    /// A strait link between coastal provinces whose shapes do not touch.
    Sea,
}

/// One neighbour of a province.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Neighbor {
    pub province: ProvinceId,
    /// The shared edge in pixels.
    pub border_px: f64,
    pub kind: BorderKind,
}

/// The loaded map assets, by province ordinal.
#[derive(Debug, Clone, PartialEq)]
pub struct MapGeo {
    pub info: MapInfo,
    /// Bitmap index `i` (1-based) is province `index[i - 1]`; 0 is water.
    pub index: Vec<ProvinceId>,
    /// By province ordinal; `None` for a province with no shape yet.
    pub shapes: Vec<Option<ProvinceShape>>,
    /// By province ordinal, each list in neighbour ordinal order.
    pub neighbors: Vec<Vec<Neighbor>>,
}

impl MapGeo {
    /// The province bitmap index `i` stands for (0 and unknown indices are none).
    pub fn province_at(&self, i: u16) -> Option<ProvinceId> {
        usize::from(i)
            .checked_sub(1)
            .and_then(|k| self.index.get(k).copied())
    }
}

/// Everything static the map views read.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct MapData {
    /// By province ordinal.
    pub provinces: Vec<ProvinceStatic>,
    /// `None` when the game has no map assets (the headless runner, most tests, before lane P).
    pub geo: Option<Arc<MapGeo>>,
}

impl MapData {
    /// Built from the loaded data and the world's province table (its ordinals). A map file
    /// naming a province the world does not have is a load error.
    pub fn build(data: &WorldData, world: &World) -> Result<MapData, LoadError> {
        let keys: Vec<&str> = world
            .provinces
            .rows()
            .iter()
            .map(|p| p.key.as_str())
            .collect();
        let ordinal = |table: &'static str, key: &str, field: &'static str, value: &str| {
            keys.binary_search(&value)
                .map(ProvinceId::from_index)
                .map_err(|_| LoadError::MissingRef {
                    table,
                    key: key.to_owned(),
                    field,
                    value: value.to_owned(),
                    target: "province",
                })
        };
        let mut provinces: Vec<Option<ProvinceStatic>> = vec![None; keys.len()];
        for (region, table) in data.provinces.iter().enumerate() {
            for p in &table.rows {
                let id = ordinal("provinces", &p.id, "id", &p.id)?;
                let some = |s: &str| (!s.is_empty()).then(|| s.to_owned());
                provinces[id.index()] = Some(ProvinceStatic {
                    superregion: sim_data::SUPERREGIONS[region].0,
                    region: p.region.clone(),
                    area: p.area.clone(),
                    metro: some(&p.metro),
                    city_rank: p.city_rank.clone(),
                    commerce: p.commerce,
                    industry: p.industry,
                    population: p.population,
                    resource: p.resource.clone(),
                    terrain: p.terrain.clone(),
                    coastal: p.coastal,
                    contested: some(&p.contested),
                });
            }
        }
        let provinces = provinces
            .into_iter()
            .enumerate()
            .map(|(i, p)| {
                p.ok_or_else(|| LoadError::BadValue {
                    table: "provinces",
                    key: keys[i].to_owned(),
                    message: "no province file row".into(),
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        let geo = match &data.map {
            None => None,
            Some(m) => Some(Arc::new(build_geo(m, keys.len(), &ordinal)?)),
        };
        Ok(MapData { provinces, geo })
    }
}

/// Looks up a province ordinal by key for a load error's table, key and field.
type OrdinalOf<'a> =
    dyn Fn(&'static str, &str, &'static str, &str) -> Result<ProvinceId, LoadError> + 'a;

fn build_geo(
    m: &sim_data::MapAssets,
    n: usize,
    ordinal: &OrdinalOf<'_>,
) -> Result<MapGeo, LoadError> {
    const COLORS: &str = "province-colors";
    const CENTROIDS: &str = "province-centroids";
    const ADJACENCY: &str = "province-adjacency";
    let meta = &m.meta;
    let index = m
        .colors
        .rows
        .iter()
        .map(|c| ordinal(COLORS, &c.province_id, "province_id", &c.province_id))
        .collect::<Result<Vec<_>, _>>()?;
    let mut shapes = vec![None; n];
    for c in &m.centroids.rows {
        let id = ordinal(CENTROIDS, &c.province_id, "province_id", &c.province_id)?;
        // load_map checked every centroid names a colour row.
        let Some(bitmap) = m.index_of(&c.province_id) else {
            continue;
        };
        shapes[id.index()] = Some(ProvinceShape {
            index: bitmap,
            lon: c.lon,
            lat: c.lat,
            centroid: (c.x, c.y),
            label: (c.label_x, c.label_y),
            area_px: c.area_px,
            tiny: c.tiny,
        });
    }
    let mut neighbors: Vec<Vec<Neighbor>> = vec![Vec::new(); n];
    for a in &m.adjacency.rows {
        let key = format!("{}-{}", a.a, a.b);
        let (pa, pb) = (
            ordinal(ADJACENCY, &key, "a", &a.a)?,
            ordinal(ADJACENCY, &key, "b", &a.b)?,
        );
        let kind = match a.kind.as_str() {
            "land" => BorderKind::Land,
            "sea" => BorderKind::Sea,
            other => {
                return Err(LoadError::BadValue {
                    table: ADJACENCY,
                    key,
                    message: format!("kind `{other}` is not land or sea"),
                });
            }
        };
        for (from, to) in [(pa, pb), (pb, pa)] {
            neighbors[from.index()].push(Neighbor {
                province: to,
                border_px: a.border_px,
                kind,
            });
        }
    }
    for list in &mut neighbors {
        list.sort_by_key(|nb| nb.province);
        list.dedup_by_key(|nb| nb.province);
    }
    Ok(MapGeo {
        info: MapInfo {
            width: meta.width,
            height: meta.height,
            projection: meta.projection.clone(),
            lon_min: meta.lon_min,
            lon_max: meta.lon_max,
            lat_min: meta.lat_min,
            lat_max: meta.lat_max,
            pipeline_version: meta.pipeline_version.clone(),
            sources: meta.sources.clone(),
            coverage: meta.coverage.clone(),
            tiny_px: meta.tiny_px,
        },
        index,
        shapes,
        neighbors,
    })
}
