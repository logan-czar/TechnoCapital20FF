//! Reading provinces.geojson and the province CSVs, writing the assets/map files.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use geo::{Geometry, MultiPolygon};
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::{ImageBuffer, Luma, Rgb};

use crate::build::{COASTAL_MIN_PX, Map, ProvinceShape, TINY_PX};

pub type Result<T> = std::result::Result<T, String>;

fn to_multi(g: Geometry<f64>) -> Option<MultiPolygon<f64>> {
    match g {
        Geometry::Polygon(p) => Some(MultiPolygon(vec![p])),
        Geometry::MultiPolygon(m) => Some(m),
        Geometry::GeometryCollection(c) => {
            let polys: Vec<_> = c
                .into_iter()
                .filter_map(to_multi)
                .flat_map(|m| m.0)
                .collect();
            (!polys.is_empty()).then_some(MultiPolygon(polys))
        }
        _ => None,
    }
}

fn read_features(path: &Path) -> Result<Vec<geojson::Feature>> {
    let text = fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let fc: geojson::FeatureCollection = text
        .parse()
        .map_err(|e| format!("{}: {e}", path.display()))?;
    Ok(fc.features)
}

fn prop(f: &geojson::Feature, key: &str) -> Option<String> {
    f.property(key).and_then(|v| v.as_str()).map(str::to_string)
}

/// Provinces from a GeoJSON with `province_id`, `region` and `country` properties.
pub fn read_provinces(path: &Path) -> Result<Vec<ProvinceShape>> {
    let text = fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    parse_provinces(&text, &path.display().to_string())
}

/// Provinces from GeoJSON text (`origin` names it in errors).
pub fn parse_provinces(text: &str, origin: &str) -> Result<Vec<ProvinceShape>> {
    let fc: geojson::FeatureCollection = text.parse().map_err(|e| format!("{origin}: {e}"))?;
    let mut out = Vec::new();
    for (n, f) in fc.features.into_iter().enumerate() {
        let id = prop(&f, "province_id")
            .ok_or_else(|| format!("{origin}: feature {n} has no province_id"))?;
        let region = prop(&f, "region").unwrap_or_default();
        let country = prop(&f, "country").unwrap_or_default();
        let Some(geom) = f.geometry else { continue };
        let g: Geometry<f64> = geom
            .try_into()
            .map_err(|e| format!("{origin}: {id}: {e}"))?;
        if let Some(shape) = to_multi(g) {
            out.push(ProvinceShape {
                id,
                region,
                country,
                shape,
            });
        }
    }
    Ok(out)
}

/// Every polygon of a GeoJSON (the land layer).
pub fn read_polygons(path: &Path) -> Result<Vec<MultiPolygon<f64>>> {
    let mut out = Vec::new();
    for f in read_features(path)? {
        let Some(geom) = f.geometry else { continue };
        let g: Geometry<f64> = geom
            .try_into()
            .map_err(|e| format!("{}: {e}", path.display()))?;
        out.extend(to_multi(g));
    }
    Ok(out)
}

/// One row of a province CSV, as far as mapgen needs it.
#[derive(Clone, Debug)]
pub struct CsvProvince {
    pub id: String,
    pub name: String,
    pub country: String,
    pub region: String,
    pub coastal: bool,
}

pub fn read_csv(path: &Path) -> Result<Vec<CsvProvince>> {
    let mut rdr = csv::Reader::from_path(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let headers = rdr
        .headers()
        .map_err(|e| format!("{}: {e}", path.display()))?
        .clone();
    let col = |name: &str| {
        headers
            .iter()
            .position(|h| h == name)
            .ok_or_else(|| format!("{}: no `{name}` column", path.display()))
    };
    let (ci, cn, cc, cr, ck) = (
        col("id")?,
        col("name")?,
        col("country")?,
        col("region")?,
        col("coastal")?,
    );
    let mut out = Vec::new();
    for rec in rdr.records() {
        let rec = rec.map_err(|e| format!("{}: {e}", path.display()))?;
        out.push(CsvProvince {
            id: rec[ci].to_string(),
            name: rec[cn].to_string(),
            country: rec[cc].to_string(),
            region: rec[cr].to_string(),
            coastal: &rec[ck] == "Y",
        });
    }
    Ok(out)
}

fn write_png_rgb(path: &Path, w: u32, h: u32, data: Vec<u8>) -> Result<()> {
    let img: ImageBuffer<Rgb<u8>, Vec<u8>> =
        ImageBuffer::from_raw(w, h, data).ok_or("bad RGB buffer")?;
    let file = fs::File::create(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let enc = PngEncoder::new_with_quality(
        std::io::BufWriter::new(file),
        CompressionType::Best,
        FilterType::Adaptive,
    );
    img.write_with_encoder(enc)
        .map_err(|e| format!("{}: {e}", path.display()))
}

fn write_png_l16(path: &Path, w: u32, h: u32, data: Vec<u16>) -> Result<()> {
    let img: ImageBuffer<Luma<u16>, Vec<u16>> =
        ImageBuffer::from_raw(w, h, data).ok_or("bad L16 buffer")?;
    let file = fs::File::create(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let enc = PngEncoder::new_with_quality(
        std::io::BufWriter::new(file),
        CompressionType::Best,
        FilterType::Adaptive,
    );
    img.write_with_encoder(enc)
        .map_err(|e| format!("{}: {e}", path.display()))
}

fn write_text(path: &Path, text: &str) -> Result<()> {
    let mut f = fs::File::create(path).map_err(|e| format!("{}: {e}", path.display()))?;
    f.write_all(text.as_bytes())
        .map_err(|e| format!("{}: {e}", path.display()))
}

/// What goes in map-meta.toml besides the frame.
pub struct Meta {
    pub pipeline_version: String,
    /// (name, pinned version) pairs.
    pub sources: Vec<(String, String)>,
    /// Region CSV file names covered.
    pub coverage: Vec<String>,
}

fn toml_str(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}

/// Write every file of docs/build/m8-map-assets.md that mapgen owns into `out`.
pub fn write_assets(map: &Map, meta: &Meta, out: &Path) -> Result<Vec<PathBuf>> {
    fs::create_dir_all(out).map_err(|e| format!("{}: {e}", out.display()))?;
    let (w, h) = (map.frame.width, map.frame.height);
    let mut written = Vec::new();

    let mut rgb = Vec::with_capacity((w * h * 3) as usize);
    for &v in &map.raster {
        let c = if v == 0 {
            [0, 0, 0]
        } else {
            map.colors[usize::from(v) - 1]
        };
        rgb.extend_from_slice(&c);
    }
    let p = out.join("province-ids.png");
    write_png_rgb(&p, w, h, rgb)?;
    written.push(p);

    let p = out.join("province-index.png");
    write_png_l16(&p, w, h, map.raster.clone())?;
    written.push(p);

    let p = out.join("province-borders.png");
    write_png_rgb(&p, w, h, map.borders.iter().flatten().copied().collect())?;
    written.push(p);

    let mut s = String::from("province_id,r,g,b\n");
    for (id, c) in map.ids.iter().zip(&map.colors) {
        s += &format!("{id},{},{},{}\n", c[0], c[1], c[2]);
    }
    let p = out.join("province-colors.csv");
    write_text(&p, &s)?;
    written.push(p);

    let mut s = String::from("province_id,lon,lat,x,y,label_x,label_y,area_px,tiny\n");
    for (id, st) in map.ids.iter().zip(&map.stats) {
        let (lon, lat) = map.frame.unproject(st.centroid.0, st.centroid.1);
        let tiny = if st.area_px < TINY_PX { "Y" } else { "N" };
        s += &format!(
            "{id},{lon:.4},{lat:.4},{:.1},{:.1},{:.1},{:.1},{},{tiny}\n",
            st.centroid.0, st.centroid.1, st.label.0, st.label.1, st.area_px
        );
    }
    let p = out.join("province-centroids.csv");
    write_text(&p, &s)?;
    written.push(p);

    let mut s = String::from("a,b,border_px,kind\n");
    let id = |v: u16| map.ids[usize::from(v) - 1].as_str();
    // land rows carry the shared edge; sea rows (D678) share none, so border_px is 0
    let mut rows: Vec<(&str, &str, u32, &str)> = map
        .adjacency
        .iter()
        .map(|&(a, b, c)| (id(a), id(b), c, "land"))
        .chain(map.sea.iter().map(|&(a, b)| (id(a), id(b), 0, "sea")))
        .collect();
    rows.sort();
    for (a, b, c, kind) in rows {
        s += &format!("{a},{b},{c},{kind}\n");
    }
    let p = out.join("province-adjacency.csv");
    write_text(&p, &s)?;
    written.push(p);

    let mut s = String::new();
    s += "# Written by mapgen (build-plan P7); the format is docs/build/m8-map-assets.md.\n";
    s += &format!("width = {w}\nheight = {h}\nprojection = \"miller\"\n");
    s += "lon_min = -180.0\nlon_max = 180.0\n";
    s += &format!(
        "lat_max = {:.6}\nlat_min = {:.6}\n",
        map.frame.lat_max, map.frame.lat_min
    );
    s += &format!("tiny_px = {TINY_PX}\n");
    s += &format!("pipeline_version = {}\n", toml_str(&meta.pipeline_version));
    s += &format!(
        "coverage = [{}]\n",
        meta.coverage
            .iter()
            .map(|c| toml_str(c))
            .collect::<Vec<_>>()
            .join(", ")
    );
    s += "\n[sources]\n";
    for (k, v) in &meta.sources {
        s += &format!("{k} = {}\n", toml_str(v));
    }
    let p = out.join("map-meta.toml");
    write_text(&p, &s)?;
    written.push(p);
    Ok(written)
}

/// A CSV field, quoted when it holds a comma, quote or newline (quotes doubled).
fn csv_field(v: &str) -> String {
    if v.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_string()
    }
}

/// Per-province QA rows for the P8 report: every CSV province, with or without a shape.
pub fn write_qa(map: &Map, csv: &[CsvProvince], path: &Path) -> Result<()> {
    let mut s = String::from(
        "province_id,name,country,in_bitmap,area_px,tiny,forced,components,coastal_px,coastal_bitmap,coastal_csv,coastal_match,overwritten_px\n",
    );
    for p in csv {
        let row = map.ids.binary_search(&p.id).ok().map(|i| &map.stats[i]);
        let yn = |b: bool| if b { "Y" } else { "N" };
        let name = csv_field(&p.name);
        match row {
            Some(st) => {
                let coastal = st.coastal_px >= COASTAL_MIN_PX;
                s += &format!(
                    "{},{name},{},Y,{},{},{},{},{},{},{},{},{}\n",
                    p.id,
                    p.country,
                    st.area_px,
                    yn(st.area_px < TINY_PX),
                    yn(st.forced),
                    st.components,
                    st.coastal_px,
                    yn(coastal),
                    yn(p.coastal),
                    yn(coastal == p.coastal),
                    st.overwritten_px
                );
            }
            None => {
                s += &format!(
                    "{},{name},{},N,0,,,,,,{},,\n",
                    p.id,
                    p.country,
                    yn(p.coastal)
                )
            }
        }
    }
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    }
    write_text(path, &s)
}
