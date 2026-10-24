// The map model (D954): the province topology joined to the province CSV rows. Pure, no DOM, so
// node tests cover it. Provinces are numbered by ordinal, the ascending order of their CSV ids
// (D4: `cmpStr`, the byte order of the Rust build), which is also the index into every per-province
// array (colors, rows, parts).

import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, GeometryObject, Topology } from "topojson-specification";

// CONTRACT: the UI may not import @tc20ff/sim/internal, and the sim index does not export num.ts, so
// cmpStr (types/num.ts) is repeated here. The sim index should re-export it (UTF-16 order, equal to
// Rust byte order for ASCII ids, D4).
const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The CSV columns the map shows. */
export interface ProvinceRow {
  id: string;
  name: string;
  country: string;
}

/** The properties mapshaper kept on every shape (tools/map-pipeline/pipeline/topojson_step.py). */
export interface ShapeProps {
  province_id: string;
}

export type ProvinceTopology = Topology<{ provinces: GeometryCollection<ShapeProps> }>;

/** One polygon of a province: rings of [x, y] in Miller units (x = longitude in radians). */
export interface ProvincePart {
  ordinal: number;
  polygon: Position[][];
}

export interface MapModel {
  /** Province rows by ordinal. */
  rows: ProvinceRow[];
  /** Country codes in ascending order; the index in this list is the country ordinal. */
  countries: string[];
  /** Country ordinal of each province, by province ordinal. */
  countryOf: Uint16Array;
  /** Every polygon of every province (a multi-polygon province has several), in ordinal order. */
  parts: ProvincePart[];
  /** `parts` grouped by province ordinal. */
  partsOf: ProvincePart[][];
  /** Every province boundary, coasts included, as polylines. */
  borders: Position[][];
  /** Only the boundaries between provinces of different countries. */
  countryBorders: Position[][];
}

/** Province ordinals: ids in ascending byte order (D4). Throws on a duplicate id. */
export function provinceOrdinals(ids: readonly string[]): Map<string, number> {
  const sorted = [...ids].sort(cmpStr);
  const ordinals = new Map<string, number>();
  sorted.forEach((id, i) => {
    if (ordinals.has(id)) throw new Error(`duplicate province id ${id}`);
    ordinals.set(id, i);
  });
  return ordinals;
}

/**
 * Joins the topology to the CSV rows. Every row needs exactly one shape and every shape a row;
 * anything else throws, since a province without a shape would silently vanish from the map.
 */
export function buildMapModel(topology: ProvinceTopology, csvRows: readonly ProvinceRow[]): MapModel {
  const ordinals = provinceOrdinals(csvRows.map((r) => r.id));
  const rows: ProvinceRow[] = new Array(ordinals.size);
  for (const r of csvRows) rows[ordinals.get(r.id) as number] = r;

  const countries = [...new Set(rows.map((r) => r.country))].sort(cmpStr);
  const countryIndex = new Map(countries.map((c, i) => [c, i]));
  const countryOf = new Uint16Array(rows.length);
  rows.forEach((r, i) => {
    countryOf[i] = countryIndex.get(r.country) as number;
  });

  const collection = topology.objects.provinces;
  const seen = new Set<number>();
  const geomOrdinal = new Map<GeometryObject, number>();
  for (const g of collection.geometries) {
    const id = (g.properties as ShapeProps | undefined)?.province_id;
    const ordinal = id === undefined ? undefined : ordinals.get(id);
    if (ordinal === undefined) throw new Error(`shape ${String(id)} has no CSV row`);
    if (seen.has(ordinal)) throw new Error(`province ${String(id)} has two shapes`);
    seen.add(ordinal);
    geomOrdinal.set(g, ordinal);
  }
  if (seen.size !== rows.length) {
    const missing = rows.filter((_, i) => !seen.has(i)).map((r) => r.id);
    throw new Error(`${missing.length} provinces have no shape: ${missing.slice(0, 5).join(", ")}`);
  }

  const partsOf: ProvincePart[][] = rows.map(() => []);
  const fc = feature(topology, collection) as unknown as FeatureCollection<Polygon | MultiPolygon>;
  for (const f of fc.features) {
    const ordinal = ordinals.get((f.properties as ShapeProps).province_id) as number;
    const g = f.geometry;
    if (g.type === "Polygon") partsOf[ordinal]?.push({ ordinal, polygon: g.coordinates });
    else if (g.type === "MultiPolygon") {
      for (const polygon of g.coordinates) partsOf[ordinal]?.push({ ordinal, polygon });
    }
  }
  const parts = partsOf.flat();

  const lines = (filter?: (a: GeometryObject, b: GeometryObject) => boolean) =>
    mesh(topology, collection, filter).coordinates;
  const countryAt = (g: GeometryObject) => countryOf[geomOrdinal.get(g) as number];
  return {
    rows,
    countries,
    countryOf,
    parts,
    partsOf,
    borders: lines(),
    countryBorders: lines((a, b) => a !== b && countryAt(a) !== countryAt(b)),
  };
}
