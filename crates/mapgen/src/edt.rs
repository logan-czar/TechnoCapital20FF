//! Exact Euclidean distance transform (Felzenszwalb and Huttenlocher), separable, with an
//! optional east-west wrap. Used for the border distance field and for label points.

const FAR: f64 = 1e20;

/// 1-D squared distance transform of `f` into `d`.
fn edt_1d(f: &[f64], d: &mut [f64], v: &mut [usize], z: &mut [f64]) {
    let n = f.len();
    if n == 0 {
        return;
    }
    let mut k = 0usize;
    v[0] = 0;
    z[0] = f64::NEG_INFINITY;
    z[1] = f64::INFINITY;
    for q in 1..n {
        let qf = q as f64;
        let mut s;
        loop {
            let p = v[k] as f64;
            s = ((f[q] + qf * qf) - (f[v[k]] + p * p)) / (2.0 * qf - 2.0 * p);
            // z[0] is -inf, so this never pops the first parabola
            if s <= z[k] {
                k -= 1;
            } else {
                break;
            }
        }
        k += 1;
        v[k] = q;
        z[k] = s;
        z[k + 1] = f64::INFINITY;
    }
    k = 0;
    for (q, dq) in d.iter_mut().enumerate() {
        let qf = q as f64;
        while z[k + 1] < qf {
            k += 1;
        }
        let p = v[k] as f64;
        *dq = (qf - p) * (qf - p) + f[v[k]];
    }
}

/// Distance in pixels from each pixel centre to the nearest `feature` pixel centre, row-major
/// `width` x `height`. With `wrap_x` the left and right edges are neighbours. Distances above
/// `cap` may be reported as anything >= `cap` (the row pass only looks `cap` pixels across the
/// wrap seam).
pub fn distance(feature: &[bool], width: usize, height: usize, wrap_x: bool, cap: f64) -> Vec<f64> {
    assert_eq!(feature.len(), width * height);
    let n = width.max(height);
    let pad = if wrap_x {
        (cap.ceil() as usize + 1).min(width)
    } else {
        0
    };
    let m = n.max(width + 2 * pad);
    let mut f = vec![0.0; m];
    let mut d = vec![0.0; m];
    let mut v = vec![0usize; m];
    let mut z = vec![0.0; m + 1];
    let mut cols = vec![FAR; width * height];
    for x in 0..width {
        for y in 0..height {
            f[y] = if feature[y * width + x] { 0.0 } else { FAR };
        }
        edt_1d(&f[..height], &mut d[..height], &mut v, &mut z);
        for y in 0..height {
            cols[y * width + x] = d[y];
        }
    }
    let mut out = vec![0.0; width * height];
    let len = width + 2 * pad;
    for y in 0..height {
        let row = &cols[y * width..(y + 1) * width];
        for (i, fi) in f[..len].iter_mut().enumerate() {
            let x = (i as isize - pad as isize).rem_euclid(width as isize) as usize;
            *fi = row[x];
        }
        edt_1d(&f[..len], &mut d[..len], &mut v, &mut z);
        for x in 0..width {
            out[y * width + x] = d[x + pad].sqrt();
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn brute(feature: &[bool], w: usize, h: usize, wrap: bool) -> Vec<f64> {
        let mut out = vec![f64::INFINITY; w * h];
        for y in 0..h {
            for x in 0..w {
                for fy in 0..h {
                    for fx in 0..w {
                        if !feature[fy * w + fx] {
                            continue;
                        }
                        let mut dx = (x as f64 - fx as f64).abs();
                        if wrap {
                            dx = dx.min(w as f64 - dx);
                        }
                        let dy = y as f64 - fy as f64;
                        let dd = (dx * dx + dy * dy).sqrt();
                        if dd < out[y * w + x] {
                            out[y * w + x] = dd;
                        }
                    }
                }
            }
        }
        out
    }

    #[test]
    fn matches_brute_force_with_and_without_wrap() {
        let (w, h) = (23, 11);
        let mut feature = vec![false; w * h];
        for &(x, y) in &[(1, 1), (21, 5), (10, 9), (11, 9), (3, 7)] {
            feature[y * w + x] = true;
        }
        for wrap in [false, true] {
            let got = distance(&feature, w, h, wrap, 100.0);
            let want = brute(&feature, w, h, wrap);
            for i in 0..w * h {
                assert!(
                    (got[i] - want[i]).abs() < 1e-9,
                    "wrap {wrap} pixel {i}: {} vs {}",
                    got[i],
                    want[i]
                );
            }
        }
    }
}
