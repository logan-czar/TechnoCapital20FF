// Static map assets the views read (M8; spec 3.3, 8 Map row, 9.2, 9.4). Ported from
// crates/sim/src/map.rs (MapInfo, ProvinceShape, BorderKind, Neighbor, MapGeo). Types only.
//
// None of this is world state: it is built from the loaded data next to the World, never saved
// and never hashed, so a save, the state hash and the economy are the same with or without a map.
//
// Not ported: MapGeo::province_at; ProvinceStatic and MapData (the views' build input, which
// crosses no boundary; MapData holds `Option<Arc<MapGeo>>`) and their builders from the data.

import type { ProvinceId } from "../ids.ts";

/** The map file's header (map-meta.toml). */
export interface MapInfo {
  /** Bitmap size in pixels (u32). */
  width: number;
  height: number;
  projection: string;
  lon_min: number;
  lon_max: number;
  lat_min: number;
  lat_max: number;
  pipeline_version: string;
  sources: [string, string][];
  coverage: string[];
  /** The click-target threshold in pixels (`tiny_px`), if the file names one (u64). */
  tiny_px: number | null;
}

/** A province's place in the bitmap (province-centroids.csv). */
export interface ProvinceShape {
  /** Its bitmap index: the 1-based row in province-colors.csv (u16). */
  index: number;
  /** The centroid in degrees. */
  lon: number;
  lat: number;
  /** The centroid and the label point in bitmap pixels, (x, y). */
  centroid: [number, number];
  label: [number, number];
  /** Whole number (u64). */
  area_px: number;
  /** Under the click-target threshold: it gets a click target at its label point (M8.4). */
  tiny: boolean;
}

/** How two provinces touch (province-adjacency.csv `kind`). */
export type BorderKind =
  | "Land"
  /** A strait link between coastal provinces whose shapes do not touch. */
  | "Sea";

/** One neighbour of a province. */
export interface Neighbor {
  province: ProvinceId;
  /** The shared edge in pixels. */
  border_px: number;
  kind: BorderKind;
}

/** The loaded map assets, by province ordinal. */
export interface MapGeo {
  info: MapInfo;
  /** Bitmap index `i` (1-based) is province `index[i - 1]`; 0 is water. */
  index: ProvinceId[];
  /** By province ordinal; null for a province with no shape yet. */
  shapes: (ProvinceShape | null)[];
  /** By province ordinal, each list in neighbour ordinal order. */
  neighbors: Neighbor[][];
}
