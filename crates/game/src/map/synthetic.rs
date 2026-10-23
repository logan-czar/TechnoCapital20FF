//! A synthetic `assets/map` folder in exactly the contract's format
//! (docs/build/m8-map-assets.md), so the map runs and is tested before lane P's real data lands
//! (D634): `map-meta.toml`, `province-ids.png`, `province-index.png`, `province-colors.csv`,
//! `province-centroids.csv`, `province-adjacency.csv` and `province-borders.png`.
//!
//! The caller passes real province ids (with their country and region) grouped into islands;
//! each island is an ellipse of land on a Miller map, cut into one cell per province by a
//! multi-source flood from seeds laid out in a serpentine over the island, so a country's and a
//! region's provinces (consecutive in id order) form one patch. Islands may cross the
//! antimeridian (the map wraps east to west). Distances in the border field are a two-pass
//! chamfer transform from the edge pixels, clamped to 0..255. Everything is deterministic.
//!
//! The game reads only views and its render assets, so this module sees no sim-data: `main.rs`
//! (`--synthetic-map`) and the tests pick the provinces.

use std::collections::VecDeque;
use std::fmt::Write as _;
use std::path::Path;

use super::png_io::{Raster, write_gray16, write_rgb8};

/// One province to draw.
#[derive(Debug, Clone, PartialEq)]
pub struct SynthProvince {
    /// Its CSV id (`US-0001`).
    pub id: String,
    pub country: String,
    pub region: String,
    /// The island it is drawn on (an index into [`SynthOptions::islands`]).
    pub island: usize,
}

/// An ellipse of land, in degrees.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Island {
    pub lon: f64,
    pub lat: f64,
    /// Half-width and half-height in degrees.
    pub rx: f64,
    pub ry: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SynthOptions {
    pub width: u32,
    pub height: u32,
    /// The Miller latitude extent kept.
    pub lat_max: f64,
    pub lat_min: f64,
    /// A province under this many pixels is tiny.
    pub tiny_px: u64,
    pub islands: Vec<Island>,
    /// The province files the caller drew from (map-meta.toml `coverage`).
    pub coverage: Vec<String>,
}

/// The defaults the dev flag uses: a continent where North America is, a Taiwan-sized island
/// and a speck in the Pacific straddling the antimeridian (D634).
pub const DEFAULT_ISLANDS: [Island; 3] = [
    Island {
        lon: -100.0,
        lat: 45.0,
        rx: 40.0,
        ry: 22.0,
    },
    Island {
        lon: 121.0,
        lat: 23.7,
        rx: 9.0,
        ry: 7.0,
    },
    Island {
        lon: 179.6,
        lat: -17.0,
        rx: 1.4,
        ry: 1.1,
    },
];

/// A synthetic world for tests that need every province on the map (the leak test, D705): one
/// island per province file, roughly where its superregion is, none overlapping.
pub const WORLD_ISLANDS: [(&str, Island); 8] = [
    (
        "provinces-north-america.csv",
        Island {
            lon: -100.0,
            lat: 45.0,
            rx: 40.0,
            ry: 22.0,
        },
    ),
    (
        "provinces-latin-america.csv",
        Island {
            lon: -62.0,
            lat: -12.0,
            rx: 20.0,
            ry: 26.0,
        },
    ),
    (
        "provinces-europe.csv",
        Island {
            lon: 15.0,
            lat: 51.0,
            rx: 22.0,
            ry: 11.0,
        },
    ),
    (
        "provinces-mena.csv",
        Island {
            lon: 35.0,
            lat: 27.0,
            rx: 22.0,
            ry: 8.0,
        },
    ),
    (
        "provinces-sub-saharan-africa.csv",
        Island {
            lon: 22.0,
            lat: -5.0,
            rx: 18.0,
            ry: 17.0,
        },
    ),
    (
        "provinces-russia-central-asia.csv",
        Island {
            lon: 90.0,
            lat: 60.0,
            rx: 50.0,
            ry: 9.0,
        },
    ),
    (
        "provinces-south-asia.csv",
        Island {
            lon: 78.0,
            lat: 21.0,
            rx: 11.0,
            ry: 10.0,
        },
    ),
    (
        "provinces-east-asia-oceania.csv",
        Island {
            lon: 125.0,
            lat: 12.0,
            rx: 24.0,
            ry: 24.0,
        },
    ),
];

/// Every province of `data`, each on its file's [`WORLD_ISLANDS`] island, with the options to
/// draw them at `width` x `width / 2`.
pub fn world_provinces(
    data: &sim_data::WorldData,
    width: u32,
) -> (Vec<SynthProvince>, SynthOptions) {
    let mut opts = SynthOptions::new(width, width / 2);
    opts.islands = WORLD_ISLANDS.iter().map(|(_, i)| *i).collect();
    let mut provinces = Vec::new();
    for (table, _, p) in data.all_provinces() {
        let Some(island) = WORLD_ISLANDS.iter().position(|(f, _)| *f == table.file) else {
            continue;
        };
        if !opts.coverage.contains(&table.file) {
            opts.coverage.push(table.file.clone());
        }
        provinces.push(SynthProvince {
            id: p.id.clone(),
            country: p.country.clone(),
            region: p.region.clone(),
            island,
        });
    }
    (provinces, opts)
}

impl SynthOptions {
    pub fn new(width: u32, height: u32) -> SynthOptions {
        SynthOptions {
            width,
            height,
            lat_max: 83.0,
            lat_min: -60.0,
            tiny_px: u64::from(width / 128).pow(2).max(16),
            islands: DEFAULT_ISLANDS.to_vec(),
            coverage: Vec::new(),
        }
    }
}

/// Miller's y for a latitude in degrees.
pub fn miller_y(lat: f64) -> f64 {
    let phi = lat.to_radians();
    1.25 * (std::f64::consts::FRAC_PI_4 + 0.4 * phi).tan().ln()
}

/// The inverse of [`miller_y`], in degrees.
pub fn miller_lat(y: f64) -> f64 {
    (2.5 * ((0.8 * y).exp().atan() - std::f64::consts::FRAC_PI_4)).to_degrees()
}

/// The generated map, in memory.
#[derive(Debug, Clone)]
pub struct SynthMap {
    pub opts: SynthOptions,
    /// The provinces in id order: bitmap index `i + 1`.
    pub provinces: Vec<SynthProvince>,
    /// Bitmap index per pixel, row-major; 0 is water.
    pub index: Vec<u16>,
}

impl SynthMap {
    fn w(&self) -> usize {
        self.opts.width as usize
    }

    fn h(&self) -> usize {
        self.opts.height as usize
    }

    /// Pixel x for a longitude.
    fn px(&self, lon: f64) -> f64 {
        (lon + 180.0) / 360.0 * f64::from(self.opts.width)
    }

    /// Pixel y for a latitude.
    fn py(&self, lat: f64) -> f64 {
        let (top, bottom) = (miller_y(self.opts.lat_max), miller_y(self.opts.lat_min));
        (top - miller_y(lat)) / (top - bottom) * f64::from(self.opts.height)
    }

    fn lon_of(&self, x: f64) -> f64 {
        x / f64::from(self.opts.width) * 360.0 - 180.0
    }

    fn lat_of(&self, y: f64) -> f64 {
        let (top, bottom) = (miller_y(self.opts.lat_max), miller_y(self.opts.lat_min));
        miller_lat(top - y / f64::from(self.opts.height) * (top - bottom))
    }
}

/// Draws the provinces (sorted by id first; duplicates dropped).
pub fn generate(provinces: &[SynthProvince], opts: &SynthOptions) -> SynthMap {
    let mut provinces = provinces.to_vec();
    provinces.sort_by(|a, b| a.id.cmp(&b.id));
    provinces.dedup_by(|a, b| a.id == b.id);
    assert!(
        provinces.len() < usize::from(u16::MAX),
        "too many provinces"
    );
    let mut map = SynthMap {
        opts: opts.clone(),
        provinces,
        index: vec![0; opts.width as usize * opts.height as usize],
    };
    let (w, h) = (map.w(), map.h());
    // Land: which island each pixel is on (u8::MAX for water).
    let mut land = vec![u8::MAX; w * h];
    for (k, isl) in opts.islands.iter().enumerate() {
        let (cx, cy) = (map.px(isl.lon), map.py(isl.lat));
        let rx = isl.rx / 360.0 * w as f64;
        let ry = (map.py(isl.lat - isl.ry) - map.py(isl.lat + isl.ry)) / 2.0;
        let (y0, y1) = (
            (cy - ry).floor().max(0.0) as usize,
            ((cy + ry).ceil() as usize).min(h),
        );
        let (x0, x1) = ((cx - rx).floor() as i64, (cx + rx).ceil() as i64);
        for y in y0..y1 {
            for xi in x0..x1 {
                let dx = (xi as f64 + 0.5 - cx) / rx;
                let dy = (y as f64 + 0.5 - cy) / ry;
                // A wobbly coast so the borders are not all straight.
                let wobble = 1.0 + 0.08 * ((xi as f64) * 0.11).sin() * ((y as f64) * 0.07).cos();
                if dx * dx + dy * dy <= wobble {
                    let x = xi.rem_euclid(w as i64) as usize;
                    land[y * w + x] = k as u8;
                }
            }
        }
    }
    // Seeds: per island, its provinces in id order along a serpentine over its land.
    let mut queue = VecDeque::new();
    for (k, _) in opts.islands.iter().enumerate() {
        let members: Vec<usize> = (0..map.provinces.len())
            .filter(|&i| map.provinces[i].island == k)
            .collect();
        if members.is_empty() {
            continue;
        }
        let cells: Vec<usize> = (0..w * h).filter(|&p| land[p] == k as u8).collect();
        if cells.is_empty() {
            continue;
        }
        let (mut minx, mut maxx, mut miny, mut maxy) = (w, 0, h, 0);
        // An island across the antimeridian is measured from its centre.
        let cx = map.px(opts.islands[k].lon) as i64;
        let unwrap = |x: usize| -> i64 {
            let d = (x as i64 - cx).rem_euclid(w as i64);
            if d > w as i64 / 2 {
                cx + d - w as i64
            } else {
                cx + d
            }
        };
        for &p in &cells {
            let (x, y) = (unwrap(p % w), p / w);
            minx = minx.min((x - cx + w as i64) as usize);
            maxx = maxx.max((x - cx + w as i64) as usize);
            miny = miny.min(y);
            maxy = maxy.max(y);
        }
        let area = cells.len() as f64;
        let mut step = (area / members.len() as f64).sqrt().max(1.0);
        let mut seeds: Vec<usize>;
        loop {
            seeds = Vec::new();
            let cols = (((maxx - minx) as f64 / step).ceil() as usize).max(1);
            let rows = (((maxy - miny) as f64 / step).ceil() as usize).max(1);
            for r in 0..rows {
                for c0 in 0..cols {
                    let c = if r % 2 == 0 { c0 } else { cols - 1 - c0 };
                    let ux = minx as f64 + (c as f64 + 0.5) * step;
                    let y = (miny as f64 + (r as f64 + 0.5) * step) as usize;
                    let x = (ux as i64 + cx - w as i64).rem_euclid(w as i64) as usize;
                    if y < h && land[y * w + x] == k as u8 {
                        seeds.push(y * w + x);
                    }
                }
            }
            if seeds.len() >= members.len() || step <= 1.0 {
                break;
            }
            step *= 0.9;
        }
        seeds.dedup();
        for (j, &prov) in members.iter().enumerate() {
            let Some(&s) = seeds.get(j * seeds.len() / members.len()) else {
                break;
            };
            if map.index[s] == 0 {
                map.index[s] = prov as u16 + 1;
                queue.push_back(s);
            }
        }
    }
    // The flood: each land pixel joins the seed that reaches it first (4-connected, wrapping
    // east to west), staying on its own island.
    while let Some(p) = queue.pop_front() {
        let v = map.index[p];
        let (x, y) = (p % w, p / w);
        let left = y * w + (x + w - 1) % w;
        let right = y * w + (x + 1) % w;
        let mut next = [Some(left), Some(right), None, None];
        if y > 0 {
            next[2] = Some(p - w);
        }
        if y + 1 < h {
            next[3] = Some(p + w);
        }
        for q in next.into_iter().flatten() {
            if map.index[q] == 0 && land[q] == land[p] {
                map.index[q] = v;
                queue.push_back(q);
            }
        }
    }
    map
}

/// A province's colour in `province-ids.png`: unique per index and never black (an odd
/// multiplier is a bijection on 24 bits).
pub fn id_color(index: u16) -> [u8; 3] {
    let v = (u32::from(index).wrapping_mul(0x9E_37_79)) & 0xFF_FF_FF;
    [(v >> 16) as u8, (v >> 8) as u8, v as u8]
}

/// Distances in pixels (clamped to 255) to the nearest pixel where `differs(p, q)` holds for a
/// 4-neighbour q: a two-pass 3-4 chamfer transform, divided by 3, wrapping east to west.
fn distance_field(w: usize, h: usize, differs: impl Fn(usize, usize) -> bool) -> Vec<u8> {
    const INF: u32 = u32::MAX / 2;
    let mut d = vec![INF; w * h];
    for y in 0..h {
        for x in 0..w {
            let p = y * w + x;
            let mut edge = differs(p, y * w + (x + 1) % w) || differs(p, y * w + (x + w - 1) % w);
            if y > 0 {
                edge |= differs(p, p - w);
            }
            if y + 1 < h {
                edge |= differs(p, p + w);
            }
            if edge {
                d[p] = 0;
            }
        }
    }
    let relax = |d: &mut [u32], p: usize, q: usize, c: u32| {
        let v = d[q] + c;
        if v < d[p] {
            d[p] = v;
        }
    };
    for y in 0..h {
        for x in 0..w {
            let p = y * w + x;
            relax(&mut d, p, y * w + (x + w - 1) % w, 3);
            if y > 0 {
                let up = (y - 1) * w;
                relax(&mut d, p, up + x, 3);
                relax(&mut d, p, up + (x + w - 1) % w, 4);
                relax(&mut d, p, up + (x + 1) % w, 4);
            }
        }
    }
    for y in (0..h).rev() {
        for x in (0..w).rev() {
            let p = y * w + x;
            relax(&mut d, p, y * w + (x + 1) % w, 3);
            if y + 1 < h {
                let down = (y + 1) * w;
                relax(&mut d, p, down + x, 3);
                relax(&mut d, p, down + (x + 1) % w, 4);
                relax(&mut d, p, down + (x + w - 1) % w, 4);
            }
        }
    }
    d.into_iter().map(|v| (v / 3).min(255) as u8).collect()
}

/// Writes every contract file for `map` into `dir` (created).
pub fn write(dir: &Path, map: &SynthMap) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    let (w, h) = (map.w(), map.h());
    let n = map.provinces.len();
    let o = &map.opts;
    // Pixel stats per province: count, sum of unwrapped x and y (about the first pixel seen).
    let mut count = vec![0u64; n + 1];
    let mut sx = vec![0f64; n + 1];
    let mut sy = vec![0f64; n + 1];
    let mut anchor = vec![None::<f64>; n + 1];
    for (p, &v) in map.index.iter().enumerate() {
        if v == 0 {
            continue;
        }
        let v = usize::from(v);
        let x = (p % w) as f64;
        let a = *anchor[v].get_or_insert(x);
        let ux = a + (x - a + w as f64 / 2.0).rem_euclid(w as f64) - w as f64 / 2.0;
        count[v] += 1;
        sx[v] += ux + 0.5;
        sy[v] += (p / w) as f64 + 0.5;
    }
    // Border distance fields: province, region and country edges (coasts are edges of all).
    let region_of = |v: u16| -> Option<&str> {
        (v > 0).then(|| map.provinces[usize::from(v) - 1].region.as_str())
    };
    let country_of = |v: u16| -> Option<&str> {
        (v > 0).then(|| map.provinces[usize::from(v) - 1].country.as_str())
    };
    let idx = &map.index;
    let dp = distance_field(w, h, |p, q| idx[p] != idx[q]);
    let dr = distance_field(w, h, |p, q| {
        (idx[p] == 0) != (idx[q] == 0)
            || (idx[p] != 0
                && (country_of(idx[p]), region_of(idx[p]))
                    != (country_of(idx[q]), region_of(idx[q])))
    });
    let dc = distance_field(w, h, |p, q| country_of(idx[p]) != country_of(idx[q]));
    // The label point: the pixel deepest inside the province (first in raster order on a tie).
    let mut label: Vec<Option<(usize, u8)>> = vec![None; n + 1];
    for (p, &v) in idx.iter().enumerate() {
        let v = usize::from(v);
        if v > 0 && label[v].is_none_or(|(_, d)| dp[p] > d) {
            label[v] = Some((p, dp[p]));
        }
    }
    // Adjacency: 4-neighbour pairs of different provinces.
    let mut shared: std::collections::BTreeMap<(u16, u16), u64> = std::collections::BTreeMap::new();
    for y in 0..h {
        for x in 0..w {
            let p = y * w + x;
            let a = idx[p];
            let mut look = |q: usize| {
                let b = idx[q];
                if a != 0 && b != 0 && a != b {
                    *shared.entry((a.min(b), a.max(b))).or_default() += 1;
                }
            };
            look(y * w + (x + 1) % w);
            if y + 1 < h {
                look(p + w);
            }
        }
    }

    let sources = "[sources]\nsynthetic = \"game::map::synthetic\"\n";
    let coverage: Vec<String> = o.coverage.iter().map(|c| format!("\"{c}\"")).collect();
    let meta = format!(
        "# A synthetic map (D634): not geography. Made by game::map::synthetic.\n\
         width = {}\nheight = {}\nprojection = \"miller\"\nlon_min = -180.0\nlon_max = 180.0\n\
         lat_max = {:.1}\nlat_min = {:.1}\npipeline_version = \"synthetic-1\"\ntiny_px = {}\n\
         coverage = [{}]\n\n{sources}",
        o.width,
        o.height,
        o.lat_max,
        o.lat_min,
        o.tiny_px,
        coverage.join(", ")
    );
    let mut colors = String::from("province_id,r,g,b\n");
    let mut cents = String::from("province_id,lon,lat,x,y,label_x,label_y,area_px,tiny\n");
    for (i, p) in map.provinces.iter().enumerate() {
        let v = i + 1;
        let [r, g, b] = id_color(v as u16);
        let _ = writeln!(colors, "{},{r},{g},{b}", p.id);
        if count[v] == 0 {
            continue;
        }
        let c = count[v] as f64;
        let (x, y) = ((sx[v] / c).rem_euclid(w as f64), sy[v] / c);
        let (lp, _) = label[v].unwrap_or_default();
        let (lx, ly) = ((lp % w) as f64 + 0.5, (lp / w) as f64 + 0.5);
        let _ = writeln!(
            cents,
            "{},{:.4},{:.4},{x:.2},{y:.2},{lx:.1},{ly:.1},{},{}",
            p.id,
            map.lon_of(x),
            map.lat_of(y),
            count[v],
            if count[v] < o.tiny_px { "Y" } else { "N" }
        );
    }
    let mut adj = String::from("a,b,border_px,kind\n");
    for ((a, b), px) in &shared {
        let _ = writeln!(
            adj,
            "{},{},{px},land",
            map.provinces[usize::from(*a) - 1].id,
            map.provinces[usize::from(*b) - 1].id
        );
    }
    let file = |name: &str, text: &str| {
        std::fs::write(dir.join(name), text).map_err(|e| format!("{name}: {e}"))
    };
    file("map-meta.toml", &meta)?;
    file("province-colors.csv", &colors)?;
    file("province-centroids.csv", &cents)?;
    file("province-adjacency.csv", &adj)?;
    file(
        "CREDITS.md",
        "# Credits\n\nA synthetic test map made by `game::map::synthetic` (D634); no source data.\n",
    )?;
    fn size<T>(o: &SynthOptions, data: Vec<T>) -> Raster<T> {
        Raster {
            width: o.width,
            height: o.height,
            data,
        }
    }
    write_gray16(&dir.join("province-index.png"), &size(o, idx.clone()))?;
    write_rgb8(
        &dir.join("province-ids.png"),
        &size(
            o,
            idx.iter()
                .map(|&v| if v == 0 { [0, 0, 0] } else { id_color(v) })
                .collect(),
        ),
    )?;
    write_rgb8(
        &dir.join("province-borders.png"),
        &size(o, (0..w * h).map(|p| [dp[p], dr[p], dc[p]]).collect()),
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provs() -> Vec<SynthProvince> {
        let mut v = Vec::new();
        for i in 1..=12 {
            v.push(SynthProvince {
                id: format!("US-{i:04}"),
                country: "USA".into(),
                region: format!("R{}", (i - 1) / 4),
                island: 0,
            });
        }
        for i in 1..=4 {
            v.push(SynthProvince {
                id: format!("CA-{i:04}"),
                country: "CAN".into(),
                region: "Q".into(),
                island: 0,
            });
        }
        v.push(SynthProvince {
            id: "TW-0001".into(),
            country: "TWN".into(),
            region: "T".into(),
            island: 1,
        });
        v.push(SynthProvince {
            id: "FJ-0001".into(),
            country: "FJI".into(),
            region: "F".into(),
            island: 2,
        });
        v
    }

    #[test]
    fn miller_round_trips() {
        for lat in [-60.0, -17.0, 0.0, 23.7, 45.0, 83.0] {
            assert!((miller_lat(miller_y(lat)) - lat).abs() < 1e-9);
        }
    }

    #[test]
    fn every_province_gets_pixels_and_colors_are_unique() {
        let map = generate(&provs(), &SynthOptions::new(512, 256));
        let mut seen = vec![0u64; map.provinces.len() + 1];
        for &v in &map.index {
            seen[usize::from(v)] += 1;
        }
        assert!(seen[0] > 0, "water");
        for (i, p) in map.provinces.iter().enumerate() {
            assert!(seen[i + 1] > 0, "{} has pixels", p.id);
        }
        let mut colors: Vec<[u8; 3]> = (1..=u16::MAX).map(id_color).collect();
        assert!(colors.iter().all(|c| *c != [0, 0, 0]));
        colors.sort_unstable();
        colors.dedup();
        assert_eq!(colors.len(), usize::from(u16::MAX));
        // The speck crosses the antimeridian: it has pixels at both edges.
        let fj = map
            .provinces
            .iter()
            .position(|p| p.id == "FJ-0001")
            .unwrap() as u16
            + 1;
        let w = 512;
        let cols: Vec<usize> = map
            .index
            .iter()
            .enumerate()
            .filter(|(_, v)| **v == fj)
            .map(|(p, _)| p % w)
            .collect();
        assert!(
            cols.contains(&0) && cols.contains(&(w - 1)),
            "wraps: {cols:?}"
        );
    }

    #[test]
    fn distance_field_measures_from_edges() {
        // Two halves of a 9 x 1 strip: the edge is between pixels 3 and 4 (and wraps at 8/0).
        let ids = [1, 1, 1, 1, 2, 2, 2, 2, 2];
        let d = distance_field(9, 1, |p, q| ids[p] != ids[q]);
        assert_eq!(d, [0, 1, 1, 0, 0, 1, 2, 1, 0]);
    }
}
