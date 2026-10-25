// v_map_static: development, political, Metros, key cities (spec 9.2), and the map geometry the
// game draws and picks with (M8.1 to M8.4): the bitmap index to province table, each province's
// centroid, label point, area and tiny flag, its neighbours, and the map's header. Rebuilt once
// at load (spec 9.4). Ported from crates/sim/src/views/map_static.rs; the types are in
// types/views/map_static.ts.
//
// The geometry comes from lane P's `assets/map` (docs/build/m8-map-assets.md) through sim-data;
// without it `geo` is null and the map shows nothing. The bitmaps themselves are render assets
// the game loads directly; everything per province comes from here.

import { mapGeoProvinceAt } from "../map.ts";
import { type CountryId, ordinal, type ProvinceId } from "../types/ids.ts";
import { cmpStr } from "../types/num.ts";
import type { Neighbor, ProvinceShape } from "../types/state/map.ts";
import type { MapProvince, MapStaticView, PlaceGroup } from "../types/views/map_static.ts";
import type { ViewInput } from "./index.ts";

/** Rust `MapStaticView::province_at_index`: the province at bitmap index `i` (0 is water). */
export function mapStaticViewProvinceAtIndex(v: MapStaticView, i: number): ProvinceId | null {
  return v.geo === null ? null : mapGeoProvinceAt(v.geo, i);
}

/** Rust `MapStaticView::shape`: a province's place in the bitmap, if it has a shape yet. */
export function mapStaticViewShape(v: MapStaticView, id: ProvinceId): ProvinceShape | null {
  return v.geo?.shapes[id] ?? null;
}

/** Rust `MapStaticView::neighbors`: a province's neighbours in ordinal order. */
export function mapStaticViewNeighbors(v: MapStaticView, id: ProvinceId): readonly Neighbor[] {
  return v.geo?.neighbors[id] ?? [];
}

/**
 * Rust `MapStaticView::tiny_targets`: the tiny provinces with their label points, in ordinal
 * order: their click targets (M8.4).
 */
export function mapStaticViewTinyTargets(v: MapStaticView): [ProvinceId, [number, number]][] {
  const out: [ProvinceId, [number, number]][] = [];
  if (v.geo === null) return out;
  v.geo.shapes.forEach((s, i) => {
    if (s !== null && s.tiny) out.push([ordinal<ProvinceId>(i), s.label]);
  });
  return out;
}

/** Rust `impl ViewData for MapStaticView`: `build`. */
export function buildMapStatic(input: ViewInput): MapStaticView {
  const w = input.world;
  const map = input.map;
  const sites = w.births.sites;
  // The Metros by name order: sorted, deduplicated (Rust `sort_unstable` + `dedup`).
  const metroNames: string[] = [];
  for (const p of map.provinces) if (p.metro !== null) metroNames.push(p.metro);
  metroNames.sort(cmpStr);
  const names = metroNames.filter((n, i) => i === 0 || metroNames[i - 1] !== n);
  const metros: PlaceGroup[] = names.map((name) => ({ name, provinces: [] }));
  const keyCities: PlaceGroup[] = sites.key_cities.map((k) => ({ name: k.name, provinces: [] }));
  const regions: PlaceGroup[] = [];
  // Rust BTreeMap<(CountryId, &str), u32>: only looked up, never iterated, so a Map keyed by the
  // pair as text is the same.
  const regionOf = new Map<string, number>();
  const provinces = w.provinces.map((p, i): MapProvince => {
    const id = ordinal<ProvinceId>(i);
    const s = map.provinces[i];
    const regionName = s === undefined ? "" : s.region;
    const regionKey = `${p.country}\u0000${regionName}`;
    let region = regionOf.get(regionKey);
    if (region === undefined) {
      regions.push({ name: regionName, provinces: [] });
      region = regions.length - 1;
      regionOf.set(regionKey, region);
    }
    (regions[region] as PlaceGroup).provinces.push(id);
    let metro: number | null = null;
    if (s !== undefined && s.metro !== null) {
      // binary search in the sorted names
      let lo = 0;
      let hi = names.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const c = cmpStr(names[mid] as string, s.metro);
        if (c === 0) {
          metro = mid;
          break;
        }
        if (c < 0) lo = mid + 1;
        else hi = mid;
      }
    }
    if (metro !== null) (metros[metro] as PlaceGroup).provinces.push(id);
    const keyCity = sites.key_city[i] ?? null;
    if (keyCity !== null) (keyCities[keyCity] as PlaceGroup).provinces.push(id);
    return {
      id,
      country: p.country as CountryId,
      commerce: s === undefined ? 0 : s.commerce,
      industry: s === undefined ? 0 : s.industry,
      population: s === undefined ? 0 : s.population,
      contested: s !== undefined && s.contested !== null,
      metro,
      key_city: keyCity,
      region,
    };
  });
  return { provinces, metros, key_cities: keyCities, regions, geo: map.geo };
}
