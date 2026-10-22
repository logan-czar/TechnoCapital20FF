//! The map assets lane P's `mapgen` writes to `assets/map/` (docs/build/m8-map-assets.md, the
//! contract between lane P and lane M; build-plan M8): `map-meta.toml` and the province CSVs.
//! The bitmaps (`province-index.png`, `province-borders.png`) are render assets the game loads
//! itself; the sim reads only what its views give the UI (spec 9): centroids, label points, areas,
//! the tiny flag, adjacency and the colour table's row order (the bitmap's index).
//!
//! Province ids are the CSV ids (`US-0001`); the sim maps them to ordinals. A province with no
//! shape yet has no row in any file, and a missing `assets/map` folder is no map at all
//! ([`load_map`] gives `None`), so the headless runner and the tests run without one.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Deserializer, de};

use crate::{DataError, Table, load_table};

/// The metadata file.
pub const MAP_META: &str = "map-meta.toml";
/// One row per province in the bitmap, sorted by id; the bitmap index is the 1-based row.
pub const PROVINCE_COLORS: &str = "province-colors.csv";
pub const PROVINCE_CENTROIDS: &str = "province-centroids.csv";
pub const PROVINCE_ADJACENCY: &str = "province-adjacency.csv";
/// The render assets (read by the game, not by sim-data).
pub const PROVINCE_INDEX_PNG: &str = "province-index.png";
pub const PROVINCE_BORDERS_PNG: &str = "province-borders.png";
pub const PROVINCE_IDS_PNG: &str = "province-ids.png";

/// `map-meta.toml`.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct MapMeta {
    /// Bitmap size in pixels.
    pub width: u32,
    pub height: u32,
    /// `"miller"`.
    pub projection: String,
    pub lon_min: f64,
    pub lon_max: f64,
    /// The Miller y extent kept, in degrees of latitude.
    pub lat_max: f64,
    pub lat_min: f64,
    pub pipeline_version: String,
    /// Pinned source versions, flattened to `key = value` text (nested tables join their keys
    /// with dots), in key order.
    #[serde(default, deserialize_with = "flat_sources")]
    pub sources: Vec<(String, String)>,
    /// The region CSV files included (`provinces-north-america.csv`).
    #[serde(default)]
    pub coverage: Vec<String>,
    /// The click-target threshold: a province under this many pixels is tiny.
    #[serde(default)]
    pub tiny_px: Option<u64>,
}

/// `province-colors.csv`.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ColorRow {
    pub province_id: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

/// `province-centroids.csv`.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct CentroidRow {
    pub province_id: String,
    /// The centroid in degrees.
    pub lon: f64,
    pub lat: f64,
    /// The centroid in bitmap pixels.
    pub x: f64,
    pub y: f64,
    /// The label point in bitmap pixels (inside the shape).
    pub label_x: f64,
    pub label_y: f64,
    pub area_px: u64,
    #[serde(deserialize_with = "yes_no")]
    pub tiny: bool,
}

/// `province-adjacency.csv`: `a < b` by id.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct AdjacencyRow {
    pub a: String,
    pub b: String,
    /// The shared edge length in pixels.
    pub border_px: f64,
    /// `land`, or `sea` for a strait link.
    pub kind: String,
}

/// Everything sim-data reads from `assets/map`.
#[derive(Debug, Clone)]
pub struct MapAssets {
    /// The folder it was read from.
    pub dir: PathBuf,
    pub meta: MapMeta,
    /// In file order (sorted by id): row `i` is bitmap index `i + 1`.
    pub colors: Table<ColorRow>,
    pub centroids: Table<CentroidRow>,
    pub adjacency: Table<AdjacencyRow>,
}

/// The repository's map folder (`assets/map`), found from this crate's location.
pub fn default_map_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../assets/map")
}

/// Reads the map assets from `dir`, or `None` when the folder has no `map-meta.toml` (no map
/// yet). The adjacency file may be missing (Phase A). A file that is there but does not parse
/// is an error naming the file, line and field.
pub fn load_map(dir: &Path) -> Result<Option<MapAssets>, DataError> {
    let meta_path = dir.join(MAP_META);
    if !meta_path.is_file() {
        return Ok(None);
    }
    let text = std::fs::read_to_string(&meta_path)
        .map_err(|e| DataError::file(MAP_META, e.to_string()))?;
    let meta: MapMeta = toml::from_str(&text).map_err(|e| {
        let line = e
            .span()
            .map(|s| text[..s.start.min(text.len())].lines().count().max(1) as u64);
        DataError {
            file: MAP_META.to_owned(),
            line,
            field: None,
            message: e.message().to_owned(),
        }
    })?;
    let adjacency = if dir.join(PROVINCE_ADJACENCY).is_file() {
        load_table(dir, PROVINCE_ADJACENCY)?
    } else {
        Table {
            file: PROVINCE_ADJACENCY.to_owned(),
            rows: Vec::new(),
            lines: Vec::new(),
        }
    };
    let map = MapAssets {
        dir: dir.to_path_buf(),
        meta,
        colors: load_table(dir, PROVINCE_COLORS)?,
        centroids: load_table(dir, PROVINCE_CENTROIDS)?,
        adjacency,
    };
    map.check_shape()?;
    Ok(Some(map))
}

impl MapAssets {
    /// The checks that need only the map files (the province ids are checked against the world
    /// by [`crate::check`]): a sane size, colours sorted by id and unique, at most `u16::MAX`
    /// provinces (the index is 16-bit), centroids and adjacency naming bitmap provinces.
    fn check_shape(&self) -> Result<(), DataError> {
        let m = &self.meta;
        if m.width == 0 || m.height == 0 {
            return Err(DataError::file(
                MAP_META,
                "width and height must be above 0",
            ));
        }
        if !(m.lat_min < m.lat_max && m.lon_min < m.lon_max) {
            return Err(DataError::file(
                MAP_META,
                "lat_min must be below lat_max and lon_min below lon_max",
            ));
        }
        if self.colors.len() >= usize::from(u16::MAX) {
            return Err(self
                .colors
                .file_err("more provinces than a 16-bit index holds"));
        }
        for (i, pair) in self.colors.rows.windows(2).enumerate() {
            if pair[0].province_id >= pair[1].province_id {
                return Err(self.colors.err(
                    self.colors.lines[i + 1],
                    "province_id",
                    format!(
                        "not sorted and unique: {} after {}",
                        pair[1].province_id, pair[0].province_id
                    ),
                ));
            }
        }
        for (line, c) in self.centroids.iter() {
            if self.index_of(&c.province_id).is_none() {
                return Err(self.centroids.err(
                    line,
                    "province_id",
                    format!("{} is not in {PROVINCE_COLORS}", c.province_id),
                ));
            }
        }
        for (line, a) in self.adjacency.iter() {
            for (field, id) in [("a", &a.a), ("b", &a.b)] {
                if self.index_of(id).is_none() {
                    return Err(self.adjacency.err(
                        line,
                        field,
                        format!("{id} is not in {PROVINCE_COLORS}"),
                    ));
                }
            }
            if a.a >= a.b {
                return Err(self.adjacency.err(line, "b", "a must be below b by id"));
            }
        }
        Ok(())
    }

    /// The bitmap index (1-based colour row) of a province id.
    pub fn index_of(&self, province_id: &str) -> Option<u16> {
        self.colors
            .rows
            .binary_search_by(|r| r.province_id.as_str().cmp(province_id))
            .ok()
            .map(|i| (i + 1) as u16)
    }

    /// A path inside the map folder.
    pub fn path(&self, file: &str) -> PathBuf {
        self.dir.join(file)
    }
}

fn yes_no<'de, D: Deserializer<'de>>(d: D) -> Result<bool, D::Error> {
    match String::deserialize(d)?.as_str() {
        "Y" => Ok(true),
        "N" => Ok(false),
        other => Err(de::Error::custom(format!(
            "expected Y or N, found `{other}`"
        ))),
    }
}

/// `sources` as flat `key = value` text, whatever its nesting.
fn flat_sources<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<(String, String)>, D::Error> {
    fn walk(prefix: &str, v: &toml::Value, out: &mut BTreeMap<String, String>) {
        match v {
            toml::Value::Table(t) => {
                for (k, v) in t {
                    let key = if prefix.is_empty() {
                        k.clone()
                    } else {
                        format!("{prefix}.{k}")
                    };
                    walk(&key, v, out);
                }
            }
            toml::Value::String(s) => {
                out.insert(prefix.to_owned(), s.clone());
            }
            other => {
                out.insert(prefix.to_owned(), other.to_string());
            }
        }
    }
    let v = toml::Value::deserialize(d)?;
    let mut out = BTreeMap::new();
    walk("", &v, &mut out);
    Ok(out.into_iter().collect())
}

/// A tiny map folder in the contract's format, for tests (sim-data's and sim's): each province
/// a pixel rectangle, coloured by its row, with its centroid and label point at the centre,
/// `tiny` under `tiny_px`, and a `land` adjacency between rectangles that share an edge.
#[doc(hidden)]
pub mod fixture {
    use std::fmt::Write as _;
    use std::path::Path;

    /// One province: its CSV id and its pixel rectangle `[x0, y0, x1, y1)`.
    pub struct Rect<'a>(pub &'a str, pub [u32; 4]);

    /// Writes map-meta.toml, province-colors.csv, province-centroids.csv and
    /// province-adjacency.csv for `rects` (sorted by id) into `dir`.
    pub fn write(
        dir: &Path,
        width: u32,
        height: u32,
        tiny_px: u64,
        rects: &[Rect<'_>],
    ) -> std::io::Result<()> {
        std::fs::create_dir_all(dir)?;
        let mut rects: Vec<&Rect<'_>> = rects.iter().collect();
        rects.sort_by_key(|r| r.0);
        std::fs::write(
            dir.join(super::MAP_META),
            format!(
                "width = {width}\nheight = {height}\nprojection = \"miller\"\nlon_min = -180.0\n\
                 lon_max = 180.0\nlat_max = 83.0\nlat_min = -60.0\npipeline_version = \"fixture\"\n\
                 tiny_px = {tiny_px}\ncoverage = [\"provinces-north-america.csv\"]\n\n\
                 [sources]\nfixture = \"1\"\n"
            ),
        )?;
        let mut colors = String::from("province_id,r,g,b\n");
        let mut cents = String::from("province_id,lon,lat,x,y,label_x,label_y,area_px,tiny\n");
        for (i, r) in rects.iter().enumerate() {
            let n = i as u32 + 1;
            let _ = writeln!(colors, "{},{},{},{}", r.0, n % 256, (n / 256) % 256, 200);
            let [x0, y0, x1, y1] = r.1;
            let (cx, cy) = (f64::from(x0 + x1) / 2.0, f64::from(y0 + y1) / 2.0);
            let area = u64::from((x1 - x0) * (y1 - y0));
            let lon = cx / f64::from(width) * 360.0 - 180.0;
            let lat = 83.0 - cy / f64::from(height) * 143.0;
            let _ = writeln!(
                cents,
                "{},{lon:.4},{lat:.4},{cx},{cy},{cx},{cy},{area},{}",
                r.0,
                if area < tiny_px { "Y" } else { "N" }
            );
        }
        let mut adj = String::from("a,b,border_px,kind\n");
        for (i, a) in rects.iter().enumerate() {
            for b in &rects[i + 1..] {
                let [ax0, ay0, ax1, ay1] = a.1;
                let [bx0, by0, bx1, by1] = b.1;
                let overlap =
                    |a0: u32, a1: u32, b0: u32, b1: u32| a1.min(b1).saturating_sub(a0.max(b0));
                let shared = if ax1 == bx0 || bx1 == ax0 {
                    overlap(ay0, ay1, by0, by1)
                } else if ay1 == by0 || by1 == ay0 {
                    overlap(ax0, ax1, bx0, bx1)
                } else {
                    0
                };
                if shared > 0 {
                    let _ = writeln!(adj, "{},{},{shared},land", a.0, b.0);
                }
            }
        }
        std::fs::write(dir.join(super::PROVINCE_COLORS), colors)?;
        std::fs::write(dir.join(super::PROVINCE_CENTROIDS), cents)?;
        std::fs::write(dir.join(super::PROVINCE_ADJACENCY), adj)?;
        Ok(())
    }
}
