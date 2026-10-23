//! Scanline polygon fill with pixel-centre sampling (D606: our own fill instead of
//! geo-rasterize, which pins geo 0.18).
//!
//! A pixel belongs to a polygon when its centre is inside (even-odd over all rings, so holes
//! work). Edges are half-open in y and spans half-open in x, so two polygons that share an edge
//! never both take, and never both miss, a pixel on it.

/// Calls `put(x, y)` for every pixel whose centre lies inside the rings (pixel coordinates).
pub fn fill_rings(
    width: u32,
    height: u32,
    rings: &[Vec<(f64, f64)>],
    mut put: impl FnMut(u32, u32),
) {
    let mut ymin = f64::INFINITY;
    let mut ymax = f64::NEG_INFINITY;
    for r in rings {
        for &(_, y) in r {
            ymin = ymin.min(y);
            ymax = ymax.max(y);
        }
    }
    if !ymin.is_finite() {
        return;
    }
    let row0 = ((ymin - 0.5).ceil().max(0.0)) as i64;
    let row1 = ((ymax - 0.5).floor().min(f64::from(height) - 1.0)) as i64;
    let mut xs: Vec<f64> = Vec::new();
    for row in row0..=row1 {
        let yc = row as f64 + 0.5;
        xs.clear();
        for r in rings {
            let n = r.len();
            if n < 3 {
                continue;
            }
            for i in 0..n {
                let (x0, y0) = r[i];
                let (x1, y1) = r[(i + 1) % n];
                if (y0 <= yc) != (y1 <= yc) {
                    // from the endpoint with the lower y, so a shared edge walked either way
                    // gives bit-identical crossings
                    let ((ax, ay), (bx, by)) = if y0 <= y1 {
                        ((x0, y0), (x1, y1))
                    } else {
                        ((x1, y1), (x0, y0))
                    };
                    xs.push(ax + (yc - ay) * (bx - ax) / (by - ay));
                }
            }
        }
        xs.sort_by(f64::total_cmp);
        for pair in xs.chunks_exact(2) {
            let c0 = (pair[0] - 0.5).ceil().max(0.0) as i64;
            let c1 = ((pair[1] - 0.5).ceil() as i64 - 1).min(i64::from(width) - 1);
            for c in c0..=c1 {
                put(c as u32, row as u32);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn count(rings: &[Vec<(f64, f64)>]) -> Vec<(u32, u32)> {
        let mut v = Vec::new();
        fill_rings(16, 16, rings, |x, y| v.push((x, y)));
        v
    }

    #[test]
    fn square_takes_the_pixels_whose_centres_it_covers() {
        let sq = vec![(2.0, 2.0), (6.0, 2.0), (6.0, 5.0), (2.0, 5.0)];
        let px = count(&[sq]);
        assert_eq!(px.len(), 12);
        assert!(px.contains(&(2, 2)) && px.contains(&(5, 4)) && !px.contains(&(6, 2)));
    }

    #[test]
    fn neighbours_share_no_pixel_and_leave_no_gap() {
        let a = vec![(1.0, 1.0), (4.3, 1.0), (4.3, 6.0), (1.0, 6.0)];
        let b = vec![(4.3, 1.0), (9.0, 1.0), (9.0, 6.0), (4.3, 6.0)];
        let pa = count(&[a]);
        let pb = count(&[b]);
        assert!(pa.iter().all(|p| !pb.contains(p)));
        assert_eq!(pa.len() + pb.len(), 8 * 5);
    }

    #[test]
    fn hole_is_left_empty() {
        let outer = vec![(0.0, 0.0), (8.0, 0.0), (8.0, 8.0), (0.0, 8.0)];
        let hole = vec![(2.0, 2.0), (2.0, 6.0), (6.0, 6.0), (6.0, 2.0)];
        assert_eq!(count(&[outer, hole]).len(), 64 - 16);
    }
}
