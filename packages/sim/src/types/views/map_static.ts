// v_map_static (crates/sim/src/views/map_static.rs): development, political, Metros, key cities
// (spec 9.2), and the map geometry the game draws and picks with (M8.1 to M8.4): the bitmap index
// to province table, each province's centroid, label point, area and tiny flag, its neighbours,
// and the map's header. Rebuilt once at load (spec 9.4).
//
// The geometry comes from lane P's `assets/map` (docs/build/m8-map-assets.md) through sim-data;
// without it `geo` is null and the map shows nothing. The bitmaps themselves are render assets
// the game loads directly; everything per province comes from here.
//
// Not ported: MapStaticView::province_at_index, ::shape, ::neighbors, ::tiny_targets (M8.4) and
// the `ViewData` build (logic). MapGeo and its parts (crates/sim/src/map.rs) are in ./shared.ts.

import type { CountryId, ProvinceId } from "../ids.ts";
import type { MapGeo } from "./shared.ts";

/** A named group of provinces (a Metro or a key city). */
export interface PlaceGroup {
  name: string;
  /** In ordinal order. */
  provinces: ProvinceId[];
}

/** One province's static map row (spec 3.3, 9.2). */
export interface MapProvince {
  id: ProvinceId;
  country: CountryId;
  /** Development tracks (spec 3.3), for the Development modes (M8.5). */
  commerce: number;
  industry: number;
  population: number;
  /** The province is contested (decision C): drawn hatched. */
  contested: boolean;
  /** Index into `MapStaticView.metros`. */
  metro: number | null;
  /** Index into `MapStaticView.key_cities`. */
  key_city: number | null;
  /** Index into `MapStaticView.regions` (M8.6 labels). */
  region: number;
}

export interface MapStaticView {
  /** By province ordinal. */
  provinces: MapProvince[];
  /** Metros by name order. */
  metros: PlaceGroup[];
  /** Key cities in key-cities.csv order. */
  key_cities: PlaceGroup[];
  /**
   * Regions (spec 3.3 `region`), each a country's: in the order their first province comes
   * in ordinal order, so a region is one name in one country (D706).
   */
  regions: PlaceGroup[];
  /** The loaded map geometry (shared behind an Arc in Rust; it is large and never changes). */
  geo: MapGeo | null;
}
