//! Offline map tool (build-plan 2.1, P7): turns `provinces.geojson` into the province bitmaps,
//! colour table, centroids and label points, adjacency, border distance field and map-meta.toml
//! of docs/build/m8-map-assets.md, plus a QA table for the P8 report. Never shipped with the game.

pub mod build;
pub mod edt;
pub mod io;
pub mod miller;
pub mod raster;
pub mod sea;
pub mod synthetic;
