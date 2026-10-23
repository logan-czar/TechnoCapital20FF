"""TechnoCapital20FF province map pipeline (build-plan 3.3, track P1 to P8).

Python prepares the geodata (fetch, license filter, crosswalk, shapes, simplify, export);
the Rust `mapgen` crate rasterizes provinces.geojson into assets/map (docs/build/m8-map-assets.md).
"""

PIPELINE_VERSION = "pb-1"
