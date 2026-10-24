// v_places (crates/sim/src/views/places.rs): the names of every province and country, for any
// page that shows a place (spec 8 Company header HQ, Board tab home province, Units base
// province; 9.2 says queries return ids, D426). Static, so built once at load (spec 9.4 Once at
// load).
//
// Not ported: PlacesView::province, ::country and ::place_name ("Province, Country"), and the
// `ViewData` build (logic).

import type { CountryId, ProvinceId } from "../ids.ts";

/** One province (spec 3.3). */
export interface ProvincePlace {
  id: ProvinceId;
  /** provinces-*.csv `id`. */
  key: string;
  name: string;
  country: CountryId;
}

/** One country's name (spec 3.2). */
export interface CountryPlace {
  id: CountryId;
  iso3: string;
  name: string;
}

export interface PlacesView {
  /** In province id order. */
  provinces: ProvincePlace[];
  /** In country id order. */
  countries: CountryPlace[];
}
