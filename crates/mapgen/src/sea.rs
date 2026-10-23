//! Sea links (docs/build/m8-map-assets.md `province-adjacency.csv` kind `sea`; D678): coastal
//! provinces that face each other across a strait but whose shapes do not touch.
//!
//! The rule: grow every province into the open water around it, by ground distance, until the
//! fronts meet (a Voronoi partition of the water near the coasts). Two provinces are sea-linked
//! when their water regions meet at a point whose two distances add up to at most
//! `SEA_LINK_KM`, and they are not already land neighbours. Only neighbours in that water
//! partition link, so a province is never linked past another province's water across a wide
//! sea, and a strait's two shores link wherever they face each other.

use std::cmp::Reverse;
use std::collections::{BTreeMap, BTreeSet, BinaryHeap};

use crate::miller::Frame;

/// Widest water gap a sea link crosses, in kilometres of ground distance between the two
/// shores' pixel centres (D678): the Strait of Gibraltar (14 km), the Bosporus, the Oresund
/// (4 km), the Dover Strait (33 km), Bab-el-Mandeb (26 km) and Hormuz (39 km at Musandam) all
/// fit; the Taiwan Strait links through Kinmen and Matsu (2 to 10 km off Fujian), not across
/// its 130 km main channel.
pub const SEA_LINK_KM: f64 = 60.0;
/// Mean Earth radius in kilometres for the ground distance per pixel.
const EARTH_RADIUS_KM: f64 = 6371.0;

/// Ground step lengths (metres) out of a pixel of row `y`: east-west, north-south, diagonal.
fn steps(frame: &Frame, y: usize) -> (u32, u32, u32) {
    let (_, lat) = frame.unproject(0.0, y as f64 + 0.5);
    let per_rad = EARTH_RADIUS_KM * 1000.0 * 2.0 * std::f64::consts::PI / f64::from(frame.width);
    // Miller: x is longitude, so east-west is R cos(lat) dlon; dy/dlat = 1 / cos(0.8 lat)
    let h = per_rad * lat.to_radians().cos();
    let v = per_rad * (0.8 * lat.to_radians()).cos();
    (
        h.round() as u32,
        v.round() as u32,
        (h * h + v * v).sqrt().round() as u32,
    )
}

/// Sea links as (a, b) raster values with a < b, sorted. `water[i]` is true for open water
/// (no province and not land in the mask); `land_pairs` are the land adjacencies to skip.
pub fn sea_links(
    frame: &Frame,
    raster: &[u16],
    water: &[bool],
    land_pairs: &BTreeSet<(u16, u16)>,
) -> Vec<(u16, u16)> {
    let (w, h) = (frame.width as usize, frame.height as usize);
    let max = (SEA_LINK_KM * 1000.0) as u32;
    let row_steps: Vec<(u32, u32, u32)> = (0..h).map(|y| steps(frame, y)).collect();
    let mut dist = vec![u32::MAX; w * h];
    let mut label = vec![0u16; w * h];
    // (distance, label, pixel): ties go to the lower label, then the lower pixel, so the
    // result does not depend on push order
    let mut heap = BinaryHeap::new();
    let neighbours = |i: usize| -> [(usize, u8); 8] {
        let (x, y) = (i % w, i / w);
        let xl = (x + w - 1) % w;
        let xr = (x + 1) % w;
        let none = usize::MAX;
        let up = y.checked_sub(1);
        let down = (y + 1 < h).then_some(y + 1);
        // kind: 0 east-west, 1 north-south, 2 diagonal
        [
            (y * w + xl, 0),
            (y * w + xr, 0),
            (up.map_or(none, |u| u * w + x), 1),
            (down.map_or(none, |d| d * w + x), 1),
            (up.map_or(none, |u| u * w + xl), 2),
            (up.map_or(none, |u| u * w + xr), 2),
            (down.map_or(none, |d| d * w + xl), 2),
            (down.map_or(none, |d| d * w + xr), 2),
        ]
    };
    for i in 0..w * h {
        let v = raster[i];
        if v == 0 {
            continue;
        }
        if neighbours(i)
            .iter()
            .any(|&(j, _)| j != usize::MAX && water[j])
        {
            dist[i] = 0;
            label[i] = v;
            heap.push(Reverse((0u32, v, i)));
        }
    }
    while let Some(Reverse((d, v, i))) = heap.pop() {
        if d != dist[i] || label[i] != v {
            continue;
        }
        let (sh, sv, sd) = row_steps[i / w];
        for (j, kind) in neighbours(i) {
            if j == usize::MAX || !water[j] {
                continue;
            }
            let step = [sh, sv, sd][usize::from(kind)];
            let nd = d + step;
            if nd > max {
                continue;
            }
            if (nd, v) < (dist[j], label[j]) {
                dist[j] = nd;
                label[j] = v;
                heap.push(Reverse((nd, v, j)));
            }
        }
    }
    // where two labels meet, the gap is the two distances plus the step between them
    let mut best: BTreeMap<(u16, u16), u32> = BTreeMap::new();
    for i in 0..w * h {
        let a = label[i];
        if a == 0 {
            continue;
        }
        let (sh, sv, sd) = row_steps[i / w];
        for (j, kind) in neighbours(i) {
            if j == usize::MAX || j < i {
                continue;
            }
            let b = label[j];
            if b == 0 || b == a {
                continue;
            }
            let gap = dist[i] + [sh, sv, sd][usize::from(kind)] + dist[j];
            let key = (a.min(b), a.max(b));
            if gap <= max && !land_pairs.contains(&key) {
                let e = best.entry(key).or_insert(gap);
                *e = (*e).min(gap);
            }
        }
    }
    best.into_keys().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Two islands 3 pixels apart across open water link; a third far away does not.
    #[test]
    fn facing_shores_link_and_far_ones_do_not() {
        let frame = Frame::new(8192, 4096, 84.0);
        let (w, h) = (8192usize, 4096usize);
        let mut raster = vec![0u16; w * h];
        let y0 = 2048;
        for y in y0..y0 + 5 {
            for x in 100..105 {
                raster[y * w + x] = 1;
            }
            for x in 108..113 {
                raster[y * w + x] = 2;
            }
            for x in 200..205 {
                raster[y * w + x] = 3;
            }
        }
        let water: Vec<bool> = raster.iter().map(|&v| v == 0).collect();
        let links = sea_links(&frame, &raster, &water, &BTreeSet::new());
        assert_eq!(links, vec![(1, 2)]);
        // land neighbours are not sea links
        let land = BTreeSet::from([(1u16, 2u16)]);
        assert!(sea_links(&frame, &raster, &water, &land).is_empty());
    }

    #[test]
    fn steps_shrink_towards_the_poles() {
        let frame = Frame::new(8192, 4096, 84.0);
        let (h_eq, v_eq, _) = steps(&frame, 2600);
        let (h_hi, v_hi, _) = steps(&frame, 300);
        assert!(h_hi < h_eq && v_hi < v_eq);
        assert!(h_eq > 4000 && h_eq < 4900);
    }
}
