//! The map (build-plan M8; spec 8 Map row): lane P's province bitmap drawn behind the floating
//! page windows, with pan, zoom, wrap and picking. Everything per province the map shows comes
//! from the sim's views (v_map_static, v_map_layers, v_province_card; spec 9); the bitmaps are
//! render assets it reads itself from the map folder (docs/build/m8-map-assets.md).

pub mod png_io;
pub mod synthetic;
