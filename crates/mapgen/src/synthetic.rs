//! `mapgen synthetic`: a test world with every CSV province as a grid cell, so the game's map
//! code can run before (and independently of) the real geodata (docs/build/m8-plan.md, lane PA).
//!
//! Provinces are laid out in rows of `COLS` cells, sorted by country, region and id, so each
//! country is a run of cells and its regions are contiguous. Every `BAND`th row is left as
//! water so the world has coasts and seas.

use geo::{LineString, MultiPolygon, Polygon};

use crate::build::ProvinceShape;
use crate::io::CsvProvince;
use crate::miller::Frame;

const COLS: usize = 96;
const BAND: usize = 6;

pub fn provinces(frame: &Frame, csv: &[CsvProvince]) -> Vec<ProvinceShape> {
    let mut rows: Vec<&CsvProvince> = csv.iter().collect();
    rows.sort_by(|a, b| (&a.country, &a.region, &a.id).cmp(&(&b.country, &b.region, &b.id)));
    let land_rows = rows.len().div_ceil(COLS);
    let total_rows = land_rows + land_rows / (BAND - 1) + 2;
    let cw = f64::from(frame.width) / COLS as f64;
    let ch = f64::from(frame.height) / total_rows as f64;
    let mut out = Vec::with_capacity(rows.len());
    let mut row = 1usize; // row 0 is sea
    let mut col = 0usize;
    for p in rows {
        if row.is_multiple_of(BAND) {
            row += 1;
        }
        let (x0, y0) = (col as f64 * cw, row as f64 * ch);
        let corners = [
            (x0, y0),
            (x0 + cw, y0),
            (x0 + cw, y0 + ch),
            (x0, y0 + ch),
            (x0, y0),
        ];
        let ring: Vec<(f64, f64)> = corners
            .iter()
            .map(|&(x, y)| frame.unproject(x.min(f64::from(frame.width) - 1e-6), y))
            .collect();
        out.push(ProvinceShape {
            id: p.id.clone(),
            region: format!("{}:{}", p.country, p.region),
            country: p.country.clone(),
            shape: MultiPolygon(vec![Polygon::new(LineString::from(ring), vec![])]),
        });
        col += 1;
        if col == COLS {
            col = 0;
            row += 1;
        }
    }
    out
}
