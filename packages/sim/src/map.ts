// Static map data the views read (M8; spec 3.3, 8 Map row, 9.2, 9.4): every province's tags and
// development from the province files, and, when the game loaded lane P's assets
// (docs/build/m8-map-assets.md), each province's centroid, label point, area, tiny flag and
// neighbours, and the bitmap index to ordinal table. Ported from crates/sim/src/map.rs (the
// types MapInfo, ProvinceShape, BorderKind, Neighbor and MapGeo are in types/state/map.ts).
//
// None of this is world state: it is built from the loaded data next to the world, never saved
// and never hashed, so a save, the state hash and the economy are the same with or without a map
// (the soak CSVs stay byte-identical). A load keeps the game's map data; a NewGame rebuilds it
// from the same data.
//
// Differences from Rust: `MapData.geo` is shared by reference, not an `Arc`; `MapGeo::province_at`
// is `mapGeoProvinceAt`.

import type { MapAssets, WorldData } from "@tc20ff/sim-data";
import { mapAssetsIndexOf, SUPERREGIONS } from "@tc20ff/sim-data";
import { ordinal, type ProvinceId } from "./types/ids.ts";
import { cmpStr } from "./types/num.ts";
import type { BorderKind, MapGeo, Neighbor, ProvinceShape } from "./types/state/map.ts";
import type { LoadError, Result, World } from "./types/world.ts";

export type { BorderKind, MapGeo, MapInfo, Neighbor, ProvinceShape } from "./types/state/map.ts";

/** One province's static fields from its CSV row (spec 3.3) that the World does not keep. */
export interface ProvinceStatic {
  /** Its superregion's province file slug (`north-america`). */
  superregion: string;
  region: string;
  area: string;
  /** The Metro's name, if the province is in one. */
  metro: string | null;
  /** provinces-*.csv `city_rank` (`City`, `Town`, ...). */
  city_rank: string;
  /** Development tracks, 1 to 30 each (spec 3.3). Whole numbers (u32). */
  commerce: number;
  industry: number;
  population: number;
  resource: string;
  terrain: string;
  coastal: boolean;
  /** The `contested` tag (`CHN claims`), drawn hatched (decision C, M8.2). */
  contested: string | null;
}

/** Everything static the map views read. */
export interface MapData {
  /** By province ordinal. */
  provinces: ProvinceStatic[];
  /** null when the game has no map assets (the headless runner, most tests, before lane P). */
  geo: MapGeo | null;
}

/** Rust `MapData::default()`: no provinces, no geometry. */
export function mapDataDefault(): MapData {
  return { provinces: [], geo: null };
}

/** Rust `MapGeo::province_at`: the province bitmap index `i` stands for (0 and unknown are none). */
export function mapGeoProvinceAt(geo: MapGeo, i: number): ProvinceId | null {
  if (i < 1) return null;
  return geo.index[i - 1] ?? null;
}

type OrdinalOf = (table: string, key: string, field: string, value: string) => Result<ProvinceId, LoadError>;

/**
 * Rust `MapData::build`: built from the loaded data and the world's province table (its
 * ordinals). A map file naming a province the world does not have is a load error.
 */
export function mapDataBuild(data: WorldData, world: World): Result<MapData, LoadError> {
  const keys = world.provinces.map((p) => p.key);
  const ordinalOf: OrdinalOf = (table, key, field, value) => {
    // `keys` is in ascending byte order (D4): a binary search.
    let lo = 0;
    let hi = keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const c = cmpStr(keys[mid] as string, value);
      if (c === 0) return { ok: true, value: ordinal<ProvinceId>(mid) };
      if (c < 0) lo = mid + 1;
      else hi = mid;
    }
    return { ok: false, error: { kind: "MissingRef", table, key, field, value, target: "province" } };
  };
  const provinces: (ProvinceStatic | null)[] = new Array<ProvinceStatic | null>(keys.length).fill(null);
  for (let region = 0; region < data.provinces.length; region++) {
    const table = data.provinces[region];
    if (table === undefined) continue;
    for (const p of table.rows) {
      const id = ordinalOf("provinces", p.id, "id", p.id);
      if (!id.ok) return id;
      const some = (s: string): string | null => (s !== "" ? s : null);
      provinces[id.value] = {
        superregion: (SUPERREGIONS[region] as readonly [string, string])[0],
        region: p.region,
        area: p.area,
        metro: some(p.metro),
        city_rank: p.city_rank,
        commerce: p.commerce,
        industry: p.industry,
        population: p.population,
        resource: p.resource,
        terrain: p.terrain,
        coastal: p.coastal,
        contested: some(p.contested),
      };
    }
  }
  const out: ProvinceStatic[] = [];
  for (let i = 0; i < provinces.length; i++) {
    const p = provinces[i];
    if (p === null || p === undefined) {
      return {
        ok: false,
        error: {
          kind: "BadValue",
          table: "provinces",
          key: keys[i] as string,
          message: "no province file row",
        },
      };
    }
    out.push(p);
  }
  let geo: MapGeo | null = null;
  if (data.map !== null) {
    const g = buildGeo(data.map, keys.length, ordinalOf);
    if (!g.ok) return g;
    geo = g.value;
  }
  return { ok: true, value: { provinces: out, geo } };
}

function buildGeo(m: MapAssets, n: number, ordinalOf: OrdinalOf): Result<MapGeo, LoadError> {
  const COLORS = "province-colors";
  const CENTROIDS = "province-centroids";
  const ADJACENCY = "province-adjacency";
  const meta = m.meta;
  const index: ProvinceId[] = [];
  for (const c of m.colors.rows) {
    const id = ordinalOf(COLORS, c.province_id, "province_id", c.province_id);
    if (!id.ok) return id;
    index.push(id.value);
  }
  const shapes: (ProvinceShape | null)[] = new Array<ProvinceShape | null>(n).fill(null);
  for (const c of m.centroids.rows) {
    const id = ordinalOf(CENTROIDS, c.province_id, "province_id", c.province_id);
    if (!id.ok) return id;
    // load_map checked every centroid names a colour row.
    const bitmap = mapAssetsIndexOf(m, c.province_id);
    if (bitmap === null) continue;
    shapes[id.value] = {
      index: bitmap,
      lon: c.lon,
      lat: c.lat,
      centroid: [c.x, c.y],
      label: [c.label_x, c.label_y],
      area_px: c.area_px,
      tiny: c.tiny,
    };
  }
  const neighbors: Neighbor[][] = Array.from({ length: n }, () => []);
  for (const a of m.adjacency.rows) {
    const key = `${a.a}-${a.b}`;
    const pa = ordinalOf(ADJACENCY, key, "a", a.a);
    if (!pa.ok) return pa;
    const pb = ordinalOf(ADJACENCY, key, "b", a.b);
    if (!pb.ok) return pb;
    let kind: BorderKind;
    if (a.kind === "land") kind = "Land";
    else if (a.kind === "sea") kind = "Sea";
    else {
      return {
        ok: false,
        error: { kind: "BadValue", table: ADJACENCY, key, message: `kind \`${a.kind}\` is not land or sea` },
      };
    }
    for (const [from, to] of [
      [pa.value, pb.value],
      [pb.value, pa.value],
    ] as const) {
      (neighbors[from] as Neighbor[]).push({ province: to, border_px: a.border_px, kind });
    }
  }
  for (let i = 0; i < neighbors.length; i++) {
    // Rust `sort_by_key` (stable) then `dedup_by_key`: the first of each run of one province.
    const sorted = (neighbors[i] as Neighbor[]).slice().sort((x, y) => x.province - y.province);
    neighbors[i] = sorted.filter((nb, k) => k === 0 || (sorted[k - 1] as Neighbor).province !== nb.province);
  }
  return {
    ok: true,
    value: {
      info: {
        width: meta.width,
        height: meta.height,
        projection: meta.projection,
        lon_min: meta.lon_min,
        lon_max: meta.lon_max,
        lat_min: meta.lat_min,
        lat_max: meta.lat_max,
        pipeline_version: meta.pipeline_version,
        sources: meta.sources,
        coverage: meta.coverage,
        tiny_px: meta.tiny_px,
      },
      index,
      shapes,
      neighbors,
    },
  };
}
