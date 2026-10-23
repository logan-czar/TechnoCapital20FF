//! Rasterize the provinces and derive every `assets/map` file (docs/build/m8-map-assets.md,
//! build-plan P7).

use std::collections::{BTreeMap, BTreeSet};

use geo::{Area, InteriorPoint};
use geo::{MultiPolygon, Polygon};

use crate::edt;
use crate::miller::Frame;
use crate::raster;

/// Click-target threshold (D607): a province under this many pixels is `tiny` and gets a
/// clickable dot at its label point (m8-plan decision "8192x4096, plus click targets").
pub const TINY_PX: u32 = 64;
/// Pixel edges a province must share with open water to count as coastal in the cross-check
/// against the CSV `coastal` column (D608).
pub const COASTAL_MIN_PX: u32 = 4;
/// Border distance field clamp (m8-map-assets.md: each channel 0..255).
pub const BORDER_CAP: f64 = 255.0;

/// One province shape in lon/lat degrees, with its region and country keys.
#[derive(Clone, Debug)]
pub struct ProvinceShape {
    pub id: String,
    pub region: String,
    pub country: String,
    pub shape: MultiPolygon<f64>,
}

/// Per-province results, in `Map::ids` order.
#[derive(Clone, Debug, PartialEq)]
pub struct Stats {
    pub area_px: u32,
    /// Pixel centroid (mean of pixel centres, unwrapped across the east-west seam).
    pub centroid: (f64, f64),
    /// Pole of inaccessibility of the largest 4-connected part (a pixel centre).
    pub label: (f64, f64),
    pub components: u32,
    /// Pixel edges shared with open water (needs a land mask; 0 without one).
    pub coastal_px: u32,
    /// The province had no pixel and was given the one at its interior point.
    pub forced: bool,
    /// Pixels this province's polygons took from a province drawn before it (overlapping
    /// shapes; 0 when the shapes tile cleanly).
    pub overwritten_px: u32,
}

/// The rasterized map: index bitmap plus everything derived from it.
pub struct Map {
    pub frame: Frame,
    /// Province ids sorted by byte order; raster value i + 1 is `ids[i]`.
    pub ids: Vec<String>,
    pub regions: Vec<String>,
    pub countries: Vec<String>,
    /// Row-major index bitmap (0 = water or no province).
    pub raster: Vec<u16>,
    pub colors: Vec<[u8; 3]>,
    pub stats: Vec<Stats>,
    /// (a, b, border_px) with a < b as raster values, sorted.
    pub adjacency: Vec<(u16, u16, u32)>,
    /// RGB distance field: province, region, country edges.
    pub borders: Vec<[u8; 3]>,
}

fn rings_px(frame: &Frame, poly: &Polygon<f64>) -> Vec<Vec<(f64, f64)>> {
    std::iter::once(poly.exterior())
        .chain(poly.interiors())
        .map(|ring| ring.coords().map(|c| frame.project(c.x, c.y)).collect())
        .collect()
}

/// Rasterize `land` into a mask (true = land).
pub fn land_mask(frame: &Frame, land: &[MultiPolygon<f64>]) -> Vec<bool> {
    let (w, h) = (frame.width, frame.height);
    let mut mask = vec![false; (w * h) as usize];
    for mp in land {
        for poly in mp {
            raster::fill_rings(w, h, &rings_px(frame, poly), |x, y| {
                mask[(y * w + x) as usize] = true
            });
        }
    }
    mask
}

fn fnv1a(s: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in s.bytes() {
        h ^= u64::from(b);
        h = h.wrapping_mul(0x0100_0000_01b3);
    }
    h
}

fn splitmix(x: u64) -> u64 {
    let mut z = x.wrapping_add(0x9e37_79b9_7f4a_7c15);
    z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    z ^ (z >> 31)
}

/// A colour per province from a hash of its id (stable when other provinces are added),
/// never black, never shared.
pub fn colors_for(ids: &[String]) -> Vec<[u8; 3]> {
    let mut used = BTreeSet::new();
    ids.iter()
        .map(|id| {
            let mut h = fnv1a(id);
            loop {
                h = splitmix(h);
                // keep each channel in 16..=239 so no province is near-black or near-white
                let c = [
                    16 + (h & 0xff) as u8 % 224,
                    16 + ((h >> 8) & 0xff) as u8 % 224,
                    16 + ((h >> 16) & 0xff) as u8 % 224,
                ];
                if used.insert(c) {
                    return c;
                }
            }
        })
        .collect()
}

/// The shift that unwraps occupied columns across the seam: x' = (x - shift) mod width has
/// no wrap (the cut is placed at the end of the longest empty run of columns).
fn unwrap_shift(occupied: &[bool]) -> usize {
    let w = occupied.len();
    let Some(first) = occupied.iter().position(|&o| o) else {
        return 0;
    };
    let (mut best_len, mut best_end) = (0usize, first);
    let mut run = 0usize;
    // walk one full turn starting just after an occupied column
    for k in 1..=w {
        let x = (first + k) % w;
        if occupied[x] {
            if run > best_len {
                best_len = run;
                best_end = x;
            }
            run = 0;
        } else {
            run += 1;
        }
    }
    if best_len == 0 { first } else { best_end }
}

/// Rasterize provinces (sorted by id internally) and derive colours, stats, adjacency and
/// the border field. `land` is the land mask for the coastal count (None: no coastal count).
pub fn build(frame: Frame, mut provinces: Vec<ProvinceShape>, land: Option<&[bool]>) -> Map {
    provinces.sort_by(|a, b| a.id.cmp(&b.id));
    assert!(
        provinces.len() < usize::from(u16::MAX),
        "more provinces than a 16-bit index holds"
    );
    let (w, h) = (frame.width as usize, frame.height as usize);
    let mut raster = vec![0u16; w * h];
    let mut overwritten = vec![0u32; provinces.len()];
    for (i, p) in provinces.iter().enumerate() {
        let v = (i + 1) as u16;
        for poly in &p.shape {
            raster::fill_rings(
                frame.width,
                frame.height,
                &rings_px(&frame, poly),
                |x, y| {
                    let cell = &mut raster[y as usize * w + x as usize];
                    if *cell != 0 && *cell != v {
                        overwritten[i] += 1;
                    }
                    *cell = v;
                },
            );
        }
    }
    let n = provinces.len();
    let mut count = vec![0u32; n + 1];
    for &v in &raster {
        count[usize::from(v)] += 1;
    }
    // D607: a province too small to cover a pixel centre takes the pixel at its interior point
    let mut forced = vec![false; n];
    for (i, p) in provinces.iter().enumerate() {
        if count[i + 1] > 0 {
            continue;
        }
        let largest = p
            .shape
            .iter()
            .max_by(|a, b| a.unsigned_area().total_cmp(&b.unsigned_area()));
        let pt = largest
            .and_then(|poly| poly.interior_point())
            .or_else(|| p.shape.interior_point());
        let Some(pt) = pt else { continue };
        let (fx, fy) = frame.project(pt.x(), pt.y());
        let (cx, cy) = (fx.floor() as i64, fy.floor() as i64);
        let mut done = false;
        for (dx, dy) in [
            (0, 0),
            (1, 0),
            (-1, 0),
            (0, 1),
            (0, -1),
            (1, 1),
            (-1, -1),
            (1, -1),
            (-1, 1),
        ] {
            let x = (cx + dx).rem_euclid(w as i64) as usize;
            let y = (cy + dy).clamp(0, h as i64 - 1) as usize;
            let owner = usize::from(raster[y * w + x]);
            if owner == 0 || count[owner] > 1 {
                count[owner] -= 1;
                raster[y * w + x] = (i + 1) as u16;
                count[i + 1] = 1;
                forced[i] = true;
                done = true;
                break;
            }
        }
        assert!(done, "no pixel free for tiny province {}", p.id);
    }

    let ids: Vec<String> = provinces.iter().map(|p| p.id.clone()).collect();
    let regions: Vec<String> = provinces
        .iter()
        .map(|p| p.region.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let countries: Vec<String> = provinces
        .iter()
        .map(|p| p.country.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let region_key: Vec<u32> = std::iter::once(0)
        .chain(
            provinces
                .iter()
                .map(|p| regions.binary_search(&p.region).unwrap() as u32 + 1),
        )
        .collect();
    let country_key: Vec<u32> = std::iter::once(0)
        .chain(
            provinces
                .iter()
                .map(|p| countries.binary_search(&p.country).unwrap() as u32 + 1),
        )
        .collect();

    let mut stats = province_stats(&frame, &raster, n, &forced, land);
    for (st, o) in stats.iter_mut().zip(&overwritten) {
        st.overwritten_px = *o;
    }
    let adjacency = adjacency(w, h, &raster);
    let mut borders = vec![[0u8; 3]; w * h];
    for (ch, key) in [None, Some(&region_key), Some(&country_key)]
        .into_iter()
        .enumerate()
    {
        let k = |i: usize| -> u32 {
            let v = usize::from(raster[i]);
            match key {
                None => v as u32,
                Some(t) => t[v],
            }
        };
        let mut edge = vec![false; w * h];
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                let me = k(i);
                let right = y * w + (x + 1) % w;
                let left = y * w + (x + w - 1) % w;
                let mut e = k(right) != me || k(left) != me;
                if y > 0 && k(i - w) != me {
                    e = true;
                }
                if y + 1 < h && k(i + w) != me {
                    e = true;
                }
                edge[i] = e;
            }
        }
        let d = edt::distance(&edge, w, h, true, BORDER_CAP);
        for (b, dv) in borders.iter_mut().zip(d) {
            b[ch] = dv.round().min(BORDER_CAP) as u8;
        }
    }
    Map {
        frame,
        colors: colors_for(&ids),
        ids,
        regions,
        countries,
        raster,
        stats,
        adjacency,
        borders,
    }
}

fn adjacency(w: usize, h: usize, raster: &[u16]) -> Vec<(u16, u16, u32)> {
    let mut adj: BTreeMap<(u16, u16), u32> = BTreeMap::new();
    let mut bump = |a: u16, b: u16| {
        if a != b && a != 0 && b != 0 {
            *adj.entry((a.min(b), a.max(b))).or_default() += 1;
        }
    };
    for y in 0..h {
        for x in 0..w {
            let a = raster[y * w + x];
            bump(a, raster[y * w + (x + 1) % w]);
            if y + 1 < h {
                bump(a, raster[(y + 1) * w + x]);
            }
        }
    }
    adj.into_iter().map(|((a, b), c)| (a, b, c)).collect()
}

fn province_stats(
    frame: &Frame,
    raster: &[u16],
    n: usize,
    forced: &[bool],
    land: Option<&[bool]>,
) -> Vec<Stats> {
    let (w, h) = (frame.width as usize, frame.height as usize);
    let mut pixels: Vec<Vec<u32>> = vec![Vec::new(); n + 1];
    for (i, &v) in raster.iter().enumerate() {
        if v != 0 {
            pixels[usize::from(v)].push(i as u32);
        }
    }
    let water = |i: usize| raster[i] == 0 && land.is_some_and(|m| !m[i]);
    let mut seen = vec![false; w * h];
    let mut occupied = vec![false; w];
    let mut out = Vec::with_capacity(n);
    for v in 1..=n {
        let px = &pixels[v];
        // centroid, unwrapped across the seam
        occupied.iter_mut().for_each(|o| *o = false);
        for &i in px {
            occupied[i as usize % w] = true;
        }
        let shift = unwrap_shift(&occupied);
        let (mut sx, mut sy) = (0.0, 0.0);
        for &i in px {
            let x = (i as usize % w + w - shift) % w;
            sx += x as f64 + 0.5;
            sy += (i as usize / w) as f64 + 0.5;
        }
        let np = px.len().max(1) as f64;
        let cx = (sx / np + shift as f64).rem_euclid(w as f64);
        let centroid = (cx, sy / np);
        // components (4-connected, wrapping east-west), keep the largest
        let mut components = 0u32;
        let mut best: Vec<u32> = Vec::new();
        let mut stack = Vec::new();
        for &start in px {
            if seen[start as usize] {
                continue;
            }
            components += 1;
            let mut comp = Vec::new();
            seen[start as usize] = true;
            stack.push(start);
            while let Some(i) = stack.pop() {
                comp.push(i);
                let (x, y) = (i as usize % w, i as usize / w);
                let mut nb = [usize::MAX; 4];
                nb[0] = y * w + (x + 1) % w;
                nb[1] = y * w + (x + w - 1) % w;
                if y > 0 {
                    nb[2] = i as usize - w;
                }
                if y + 1 < h {
                    nb[3] = i as usize + w;
                }
                for j in nb {
                    if j != usize::MAX && !seen[j] && usize::from(raster[j]) == v {
                        seen[j] = true;
                        stack.push(j as u32);
                    }
                }
            }
            if comp.len() > best.len() {
                best = comp;
            }
        }
        let label = label_point(&best, w);
        // coastal: pixel edges to open water
        let mut coastal_px = 0u32;
        if land.is_some() {
            for &i in px {
                let i = i as usize;
                let (x, y) = (i % w, i / w);
                let mut nb = vec![y * w + (x + 1) % w, y * w + (x + w - 1) % w];
                if y > 0 {
                    nb.push(i - w);
                }
                if y + 1 < h {
                    nb.push(i + w);
                }
                coastal_px += nb.into_iter().filter(|&j| water(j)).count() as u32;
            }
        }
        out.push(Stats {
            area_px: px.len() as u32,
            centroid,
            label,
            components,
            coastal_px,
            forced: forced[v - 1],
            overwritten_px: 0,
        });
    }
    out
}

/// The pole of inaccessibility of a component (its pixel farthest from any outside pixel; ties
/// to the lowest row, then the lowest unwrapped column), as a pixel centre.
fn label_point(comp: &[u32], w: usize) -> (f64, f64) {
    if comp.is_empty() {
        return (0.0, 0.0);
    }
    let mut occupied = vec![false; w];
    for &i in comp {
        occupied[i as usize % w] = true;
    }
    let shift = unwrap_shift(&occupied);
    let ux = |i: u32| (i as usize % w + w - shift) % w;
    let (mut x0, mut x1, mut y0, mut y1) = (usize::MAX, 0, usize::MAX, 0);
    for &i in comp {
        let (x, y) = (ux(i), i as usize / w);
        x0 = x0.min(x);
        x1 = x1.max(x);
        y0 = y0.min(y);
        y1 = y1.max(y);
    }
    // local grid with a one-pixel outside border
    let lw = x1 - x0 + 3;
    let lh = y1 - y0 + 3;
    let mut outside = vec![true; lw * lh];
    for &i in comp {
        let (x, y) = (ux(i) - x0 + 1, i as usize / w - y0 + 1);
        outside[y * lw + x] = false;
    }
    let d = edt::distance(&outside, lw, lh, false, f64::INFINITY);
    let mut best = (0usize, f64::NEG_INFINITY);
    for (j, &dv) in d.iter().enumerate() {
        if !outside[j] && dv > best.1 {
            best = (j, dv);
        }
    }
    let (lx, ly) = (best.0 % lw, best.0 / lw);
    let x = (lx + x0 - 1 + shift) % w;
    let y = ly + y0 - 1;
    (x as f64 + 0.5, y as f64 + 0.5)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unwrap_shift_cuts_at_the_longest_gap() {
        let mut occ = vec![false; 10];
        occ[0] = true;
        occ[9] = true;
        occ[8] = true;
        assert_eq!(unwrap_shift(&occ), 8);
        let mut occ = vec![false; 10];
        occ[3] = true;
        occ[4] = true;
        assert_eq!(unwrap_shift(&occ), 3);
    }

    #[test]
    fn colors_are_unique_and_never_black() {
        let ids: Vec<String> = (0..4000).map(|i| format!("XX-{i:04}")).collect();
        let c = colors_for(&ids);
        let set: BTreeSet<_> = c.iter().collect();
        assert_eq!(set.len(), ids.len());
        assert!(c.iter().all(|c| c.iter().all(|&v| (16..=239).contains(&v))));
    }
}
