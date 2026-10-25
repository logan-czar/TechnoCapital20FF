// v_places: the names of every province and country, for any page that shows a place (spec 8
// Company header HQ, Board tab home province, Units base province; 9.2 says queries return ids,
// D426). Static, so built once at load (spec 9.4 Once at load). Ported from
// crates/sim/src/views/places.rs; the types are in types/views/places.ts.

import { type CountryId, ordinal, type ProvinceId } from "../types/ids.ts";
import type { PlacesView } from "../types/views/places.ts";
import type { ViewInput } from "./index.ts";

/** Rust `PlacesView::province`. */
export function placesViewProvince(v: PlacesView, id: ProvinceId): PlacesView["provinces"][number] | null {
  return v.provinces[id] ?? null;
}

/** Rust `PlacesView::country`. */
export function placesViewCountry(v: PlacesView, id: CountryId): PlacesView["countries"][number] | null {
  return v.countries[id] ?? null;
}

/** Rust `PlacesView::place_name`: "Province, Country", the way a page names a place. */
export function placesViewPlaceName(v: PlacesView, id: ProvinceId): string | null {
  const p = placesViewProvince(v, id);
  if (p === null) return null;
  const c = placesViewCountry(v, p.country);
  if (c === null) return null;
  return `${p.name}, ${c.name}`;
}

/** Rust `impl ViewData for PlacesView`: `build`. */
export function buildPlaces(input: ViewInput): PlacesView {
  const w = input.world;
  return {
    provinces: w.provinces.map((p, i) => ({
      id: ordinal<ProvinceId>(i),
      key: p.key,
      name: p.name,
      country: p.country,
    })),
    countries: w.countries.map((c, i) => ({ id: ordinal<CountryId>(i), iso3: c.key, name: c.name })),
  };
}
