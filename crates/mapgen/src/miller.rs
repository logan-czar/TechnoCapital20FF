//! The Miller cylindrical projection and the bitmap frame (build-plan P5, Logan's choice;
//! docs/build/m8-map-assets.md `map-meta.toml`).
//!
//! Miller: x = lon, y = 1.25 ln tan(pi/4 + 0.4 lat) (both in radians). The bitmap covers
//! lon -180 to 180 across its width and wraps east to west. Pixels are square, so the latitude
//! band kept is fixed by its top edge (`LAT_MAX_DEG`, D600) and the 2:1 frame: the y extent is
//! 2 pi x height / width.

use std::f64::consts::PI;

/// Top edge of the map in degrees (D600): north of Cape Columbia (83.1 N) and the northern tip
/// of Greenland (83.7 N). With a 2:1 frame the bottom edge is then about 57.8 S, south of Cape
/// Horn; Antarctica, which holds no province, is left off.
pub const LAT_MAX_DEG: f64 = 84.0;
/// Default bitmap size (build-plan P7 **(T)**; docs/build/m8-map-assets.md).
pub const WIDTH: u32 = 8192;
pub const HEIGHT: u32 = 4096;

/// Miller y for a latitude in degrees.
pub fn miller_y(lat_deg: f64) -> f64 {
    1.25 * (PI / 4.0 + 0.4 * lat_deg.to_radians()).tan().ln()
}

/// Latitude in degrees for a Miller y.
pub fn miller_lat(y: f64) -> f64 {
    (2.5 * (0.8 * y).exp().atan() - 0.625 * PI).to_degrees()
}

/// The bitmap frame: size and the Miller y band it covers.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub width: u32,
    pub height: u32,
    pub lat_max: f64,
    pub lat_min: f64,
    y_top: f64,
    /// Pixels per Miller unit (the same on both axes: square pixels).
    px_per_unit: f64,
}

impl Frame {
    pub fn new(width: u32, height: u32, lat_max: f64) -> Frame {
        let px_per_unit = f64::from(width) / (2.0 * PI);
        let y_top = miller_y(lat_max);
        let y_bottom = y_top - f64::from(height) / px_per_unit;
        Frame {
            width,
            height,
            lat_max,
            lat_min: miller_lat(y_bottom),
            y_top,
            px_per_unit,
        }
    }

    /// The default 8192 x 4096 frame topped at `LAT_MAX_DEG`.
    pub fn standard() -> Frame {
        Frame::new(WIDTH, HEIGHT, LAT_MAX_DEG)
    }

    /// Continuous pixel coordinates (0..width, 0..height; y down) for a lon/lat in degrees.
    pub fn project(&self, lon: f64, lat: f64) -> (f64, f64) {
        let x = (lon + 180.0) / 360.0 * f64::from(self.width);
        let y = (self.y_top - miller_y(lat.clamp(-89.9, 89.9))) * self.px_per_unit;
        (x, y)
    }

    /// Lon/lat in degrees for continuous pixel coordinates (x wraps into -180..180).
    pub fn unproject(&self, x: f64, y: f64) -> (f64, f64) {
        let w = f64::from(self.width);
        let xw = x.rem_euclid(w);
        let lon = xw / w * 360.0 - 180.0;
        let lat = miller_lat(self.y_top - y / self.px_per_unit);
        (lon, lat)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_and_extent() {
        let f = Frame::standard();
        assert!((f.lat_min - -57.783).abs() < 0.001, "lat_min {}", f.lat_min);
        for &(lon, lat) in &[(-74.0, 40.7), (139.7, 35.7), (-179.9, 52.0), (0.0, -55.0)] {
            let (x, y) = f.project(lon, lat);
            let (lon2, lat2) = f.unproject(x, y);
            assert!((lon - lon2).abs() < 1e-9 && (lat - lat2).abs() < 1e-9);
        }
        let (_, top) = f.project(0.0, f.lat_max);
        let (_, bottom) = f.project(0.0, f.lat_min);
        assert!(top.abs() < 1e-6 && (bottom - 4096.0).abs() < 1e-6);
    }
}
