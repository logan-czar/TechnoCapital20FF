// The map assets lane P's `mapgen` writes to `assets/map/` (docs/build/m8-map-assets.md, the
// contract between lane P and lane M; build-plan M8): `map-meta.toml` and the province CSVs.
// Ported from crates/sim-data/src/map.rs. The bitmaps (`province-index.png`,
// `province-borders.png`) are render assets the game loads itself; the sim reads only what its
// views give the UI (spec 9): centroids, label points, areas, the tiny flag, adjacency and the
// colour table row order (the bitmap index).
//
// Province ids are the CSV ids (`US-0001`); the sim maps them to ordinals. A province with no
// shape yet has no row in any file, and a missing `assets/map` folder is no map at all
// (`parseMap` gives null), so the headless runner and the tests run without one.
//
// The core is pure like the world loader: `parseMap(files)` reads text (and PNG header bytes) from
// a `Files` map. Node folder reading is `loadMap` in ./node.ts.

import { parse as parseToml } from "smol-toml";
import { type DataError, dataErrorFile, err, ok, type Result } from "./error.ts";
import {
  type Files,
  f64,
  loadTable,
  rowSpec,
  str,
  type Table,
  tableErr,
  tableFileErr,
  tableIter,
  tableLen,
  tableNew,
  u8,
  u64,
  yesNo,
} from "./load.ts";

/**
 * Most provinces a map may hold: the game per-province colour table is 64 x 64 texels with
 * index 0 for water (D638), so 4,095. The world has 3,963 (D820).
 */
export const MAX_MAP_PROVINCES = 4095;

/** The metadata file. */
export const MAP_META = "map-meta.toml";
/** One row per province in the bitmap, sorted by id; the bitmap index is the 1-based row. */
export const PROVINCE_COLORS = "province-colors.csv";
export const PROVINCE_CENTROIDS = "province-centroids.csv";
export const PROVINCE_ADJACENCY = "province-adjacency.csv";
/** The render assets (read by the game, not by sim-data). */
export const PROVINCE_INDEX_PNG = "province-index.png";
export const PROVINCE_BORDERS_PNG = "province-borders.png";
export const PROVINCE_IDS_PNG = "province-ids.png";

/** The text files `parseMap` reads (the adjacency file is optional). */
export const MAP_FILES = [MAP_META, PROVINCE_COLORS, PROVINCE_CENTROIDS, PROVINCE_ADJACENCY] as const;
/** The PNGs whose size `parseMap` checks when present (only their first 24 bytes are read). */
export const MAP_PNG_FILES = [PROVINCE_INDEX_PNG, PROVINCE_IDS_PNG, PROVINCE_BORDERS_PNG] as const;

/** `map-meta.toml`. */
export interface MapMeta {
  /** Bitmap size in pixels. */
  width: number;
  height: number;
  /** `"miller"`. */
  projection: string;
  lon_min: number;
  lon_max: number;
  /** The Miller y extent kept, in degrees of latitude. */
  lat_max: number;
  lat_min: number;
  pipeline_version: string;
  /**
   * Pinned source versions, flattened to `key = value` text (nested tables join their keys with
   * dots), in key order.
   */
  sources: [string, string][];
  /** The region CSV files included (`provinces-north-america.csv`). */
  coverage: string[];
  /** The click-target threshold: a province under this many pixels is tiny. */
  tiny_px: number | null;
}

/** `province-colors.csv`. */
export interface ColorRow {
  province_id: string;
  r: number;
  g: number;
  b: number;
}

export const COLOR_ROW_SPEC = rowSpec<ColorRow>({ province_id: str, r: u8, g: u8, b: u8 });

/** `province-centroids.csv`. */
export interface CentroidRow {
  province_id: string;
  /** The centroid in degrees. */
  lon: number;
  lat: number;
  /** The centroid in bitmap pixels. */
  x: number;
  y: number;
  /** The label point in bitmap pixels (inside the shape). */
  label_x: number;
  label_y: number;
  area_px: number;
  tiny: boolean;
}

export const CENTROID_ROW_SPEC = rowSpec<CentroidRow>({
  province_id: str,
  lon: f64,
  lat: f64,
  x: f64,
  y: f64,
  label_x: f64,
  label_y: f64,
  area_px: u64,
  tiny: yesNo,
});

/** `province-adjacency.csv`: `a < b` by id. */
export interface AdjacencyRow {
  a: string;
  b: string;
  /** The shared edge length in pixels. */
  border_px: number;
  /** `land`, or `sea` for a strait link. */
  kind: string;
}

export const ADJACENCY_ROW_SPEC = rowSpec<AdjacencyRow>({ a: str, b: str, border_px: f64, kind: str });

/** Everything sim-data reads from `assets/map`. */
export interface MapAssets {
  /** The folder it was read from ("" when parsed from memory). */
  dir: string;
  meta: MapMeta;
  /** In file order (sorted by id): row `i` is bitmap index `i + 1`. */
  colors: Table<ColorRow>;
  centroids: Table<CentroidRow>;
  adjacency: Table<AdjacencyRow>;
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------- map-meta.toml

/** The 1-based line of `key = ` in the TOML text, or 1. */
function keyLine(text: string, key: string): number {
  const lines = text.split("\n");
  const re = new RegExp(`^\\s*${key}\\s*=`);
  const i = lines.findIndex((l) => re.test(l));
  return i < 0 ? 1 : i + 1;
}

/** `value.to_string()` of a toml::Value, for the sources that are not strings. */
function tomlText(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(tomlText).join(", ")}]`;
  return String(v);
}

/** A TOML table (a plain object), as against an array or a date value. */
function isTable(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** `sources` as flat `key = value` text, whatever its nesting, in key order (map.rs `flat_sources`). */
function flatSources(v: unknown): [string, string][] {
  const out = new Map<string, string>();
  const walk = (prefix: string, v: unknown): void => {
    if (isTable(v)) {
      for (const [k, inner] of Object.entries(v)) walk(prefix === "" ? k : `${prefix}.${k}`, inner);
    } else if (typeof v === "string") {
      out.set(prefix, v);
    } else {
      out.set(prefix, tomlText(v));
    }
  };
  walk("", v);
  return [...out.entries()].sort((a, b) => cmpStr(a[0], b[0]));
}

function parseMeta(text: string): Result<MapMeta, DataError> {
  let doc: Record<string, unknown>;
  try {
    doc = parseToml(text) as Record<string, unknown>;
  } catch (e) {
    const line = (e as { line?: unknown }).line;
    const message = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return err({
      file: MAP_META,
      line: typeof line === "number" ? Math.max(line, 1) : null,
      field: null,
      message: message ?? "invalid TOML",
    });
  }
  const bad = (key: string, message: string): Result<never, DataError> =>
    err({ file: MAP_META, line: keyLine(text, key), field: null, message });
  const need = (key: string): unknown => doc[key];
  const uint = (key: string, max: number): Result<number, DataError> => {
    const v = need(key);
    if (v === undefined) return bad(key, `missing field \`${key}\``);
    const n = typeof v === "bigint" ? Number(v) : v;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > max) {
      return bad(key, `invalid value for \`${key}\`: expected an unsigned integer`);
    }
    return ok(n);
  };
  const float = (key: string): Result<number, DataError> => {
    const v = need(key);
    if (v === undefined) return bad(key, `missing field \`${key}\``);
    const n = typeof v === "bigint" ? Number(v) : v;
    if (typeof n !== "number") return bad(key, `invalid type for \`${key}\`: expected a float`);
    return ok(n);
  };
  const string = (key: string): Result<string, DataError> => {
    const v = need(key);
    if (v === undefined) return bad(key, `missing field \`${key}\``);
    if (typeof v !== "string") return bad(key, `invalid type for \`${key}\`: expected a string`);
    return ok(v);
  };
  const width = uint("width", 0xffff_ffff);
  if (!width.ok) return width;
  const height = uint("height", 0xffff_ffff);
  if (!height.ok) return height;
  const projection = string("projection");
  if (!projection.ok) return projection;
  const lonMin = float("lon_min");
  if (!lonMin.ok) return lonMin;
  const lonMax = float("lon_max");
  if (!lonMax.ok) return lonMax;
  const latMax = float("lat_max");
  if (!latMax.ok) return latMax;
  const latMin = float("lat_min");
  if (!latMin.ok) return latMin;
  const pipeline = string("pipeline_version");
  if (!pipeline.ok) return pipeline;
  const coverageRaw = need("coverage");
  let coverage: string[] = [];
  if (coverageRaw !== undefined) {
    if (!Array.isArray(coverageRaw) || coverageRaw.some((c) => typeof c !== "string")) {
      return bad("coverage", "invalid type for `coverage`: expected an array of strings");
    }
    coverage = coverageRaw as string[];
  }
  let tinyPx: number | null = null;
  if (need("tiny_px") !== undefined) {
    const t = uint("tiny_px", Number.MAX_SAFE_INTEGER);
    if (!t.ok) return t;
    tinyPx = t.value;
  }
  return ok({
    width: width.value,
    height: height.value,
    projection: projection.value,
    lon_min: lonMin.value,
    lon_max: lonMax.value,
    lat_max: latMax.value,
    lat_min: latMin.value,
    pipeline_version: pipeline.value,
    sources: need("sources") === undefined ? [] : flatSources(need("sources")),
    coverage,
    tiny_px: tinyPx,
  });
}

// ---------------------------------------------------------------- loading

function textOfFile(file: string, contents: string | Uint8Array): Result<string, DataError> {
  if (typeof contents === "string") return ok(contents);
  try {
    return ok(new TextDecoder("utf-8", { fatal: true }).decode(contents));
  } catch {
    return err(dataErrorFile(file, "not valid UTF-8"));
  }
}

/**
 * Reads the map assets from `files`, or null when there is no `map-meta.toml` (no map yet). The
 * adjacency file may be missing (Phase A). A file that is there but does not parse is an error
 * naming the file, line and field. Rust `load_map`, minus the file reading.
 */
export function parseMap(files: Files, dir = ""): Result<MapAssets | null, DataError> {
  const metaFile = files[MAP_META];
  if (metaFile === undefined) return ok(null);
  const metaText = textOfFile(MAP_META, metaFile);
  if (!metaText.ok) return metaText;
  const meta = parseMeta(metaText.value);
  if (!meta.ok) return meta;
  const adjacency =
    files[PROVINCE_ADJACENCY] !== undefined
      ? loadTable(files, PROVINCE_ADJACENCY, ADJACENCY_ROW_SPEC)
      : ok(tableNew<AdjacencyRow>(PROVINCE_ADJACENCY));
  if (!adjacency.ok) return adjacency;
  const colors = loadTable(files, PROVINCE_COLORS, COLOR_ROW_SPEC);
  if (!colors.ok) return colors;
  const centroids = loadTable(files, PROVINCE_CENTROIDS, CENTROID_ROW_SPEC);
  if (!centroids.ok) return centroids;
  const map: MapAssets = {
    dir,
    meta: meta.value,
    colors: colors.value,
    centroids: centroids.value,
    adjacency: adjacency.value,
  };
  const shape = mapCheckShape(map, files);
  if (!shape.ok) return shape;
  return ok(map);
}

/**
 * The checks that need only the map files (the province ids are checked against the world by
 * `check`): a sane size, colours sorted by id and unique, at most MAX_MAP_PROVINCES, centroids and
 * adjacency naming bitmap provinces, centroids and label points inside the bitmap, and each PNG
 * that is there the size map-meta.toml says.
 */
function mapCheckShape(map: MapAssets, files: Files): Result<null, DataError> {
  const m = map.meta;
  if (m.width === 0 || m.height === 0) {
    return err(dataErrorFile(MAP_META, "width and height must be above 0"));
  }
  if (!(m.lat_min < m.lat_max && m.lon_min < m.lon_max)) {
    return err(dataErrorFile(MAP_META, "lat_min must be below lat_max and lon_min below lon_max"));
  }
  if (tableLen(map.colors) > MAX_MAP_PROVINCES) {
    return err(
      tableFileErr(
        map.colors,
        `${tableLen(map.colors)} provinces, more than the ${MAX_MAP_PROVINCES} the map colour table holds`,
      ),
    );
  }
  const [w, h] = [m.width, m.height];
  const inside = (x: number, y: number): boolean => x >= 0 && x < w && y >= 0 && y < h;
  for (const [line, c] of tableIter(map.centroids)) {
    if (!inside(c.label_x, c.label_y)) {
      return err(
        tableErr(
          map.centroids,
          line,
          "label_x",
          `label point ${c.label_x}, ${c.label_y} is outside the ${m.width}x${m.height} bitmap`,
        ),
      );
    }
    if (!inside(c.x, c.y)) {
      return err(tableErr(map.centroids, line, "x", `centroid ${c.x}, ${c.y} is outside the bitmap`));
    }
  }
  for (const file of MAP_PNG_FILES) {
    const bytes = files[file];
    if (bytes === undefined) continue;
    const size = typeof bytes === "string" ? null : pngSize(bytes);
    if (size === null) return err(dataErrorFile(file, "not a PNG"));
    if (size[0] !== m.width || size[1] !== m.height) {
      return err(dataErrorFile(file, `${size[0]}x${size[1]}, but map-meta.toml says ${m.width}x${m.height}`));
    }
  }
  const colorRows = map.colors.rows;
  for (let i = 0; i + 1 < colorRows.length; i++) {
    const a = colorRows[i] as ColorRow;
    const b = colorRows[i + 1] as ColorRow;
    if (a.province_id >= b.province_id) {
      return err(
        tableErr(
          map.colors,
          map.colors.lines[i + 1] as number,
          "province_id",
          `not sorted and unique: ${b.province_id} after ${a.province_id}`,
        ),
      );
    }
  }
  for (const [line, c] of tableIter(map.centroids)) {
    if (mapAssetsIndexOf(map, c.province_id) === null) {
      return err(
        tableErr(map.centroids, line, "province_id", `${c.province_id} is not in ${PROVINCE_COLORS}`),
      );
    }
  }
  for (const [line, a] of tableIter(map.adjacency)) {
    for (const [field, id] of [
      ["a", a.a],
      ["b", a.b],
    ] as const) {
      if (mapAssetsIndexOf(map, id) === null) {
        return err(tableErr(map.adjacency, line, field, `${id} is not in ${PROVINCE_COLORS}`));
      }
    }
    if (a.a >= a.b) {
      return err(tableErr(map.adjacency, line, "b", "a must be below b by id"));
    }
  }
  return ok(null);
}

/** The bitmap index (1-based colour row) of a province id, or null. Rust `MapAssets::index_of`. */
export function mapAssetsIndexOf(map: MapAssets, provinceId: string): number | null {
  const rows = map.colors.rows;
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const c = cmpStr((rows[mid] as ColorRow).province_id, provinceId);
    if (c === 0) return mid + 1;
    if (c < 0) lo = mid + 1;
    else hi = mid;
  }
  return null;
}

/** A path inside the map folder. Rust `MapAssets::path`. */
export function mapAssetsPath(map: MapAssets, file: string): string {
  return map.dir === "" ? file : `${map.dir}/${file}`;
}

/** A PNG width and height from its header (the IHDR chunk), without decoding it. */
export function pngSize(head: Uint8Array): [number, number] | null {
  if (head.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (sig.some((b, i) => head[i] !== b)) return null;
  if (
    String.fromCharCode(head[12] as number, head[13] as number, head[14] as number, head[15] as number) !==
    "IHDR"
  ) {
    return null;
  }
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

// ---------------------------------------------------------------- test fixture

/** One province of a fixture: its CSV id and its pixel rectangle `[x0, y0, x1, y1)`. */
export type Rect = readonly [id: string, rect: readonly [number, number, number, number]];

/**
 * A tiny map folder in the contract format, for tests (sim-data and sim): each province a pixel
 * rectangle, coloured by its row, with its centroid and label point at the centre, `tiny` under
 * `tiny_px`, and a `land` adjacency between rectangles that share an edge. Returns the four files
 * map-meta.toml, province-colors.csv, province-centroids.csv and province-adjacency.csv (rects
 * sorted by id). Rust `map::fixture::write`, minus the writing.
 */
export function mapFixtureFiles(
  width: number,
  height: number,
  tinyPx: number,
  rects: readonly Rect[],
): Record<string, string> {
  const sorted = [...rects].sort((a, b) => cmpStr(a[0], b[0]));
  const meta =
    `width = ${width}\nheight = ${height}\nprojection = "miller"\nlon_min = -180.0\n` +
    `lon_max = 180.0\nlat_max = 83.0\nlat_min = -60.0\npipeline_version = "fixture"\n` +
    `tiny_px = ${tinyPx}\ncoverage = ["provinces-north-america.csv"]\n\n` +
    `[sources]\nfixture = "1"\n`;
  let colors = "province_id,r,g,b\n";
  let cents = "province_id,lon,lat,x,y,label_x,label_y,area_px,tiny\n";
  sorted.forEach((r, i) => {
    const n = i + 1;
    colors += `${r[0]},${n % 256},${Math.trunc(n / 256) % 256},${200}\n`;
    const [x0, y0, x1, y1] = r[1];
    const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
    const area = (x1 - x0) * (y1 - y0);
    const lon = (cx / width) * 360 - 180;
    const lat = 83 - (cy / height) * 143;
    cents += `${r[0]},${lon.toFixed(4)},${lat.toFixed(4)},${cx},${cy},${cx},${cy},${area},${area < tinyPx ? "Y" : "N"}\n`;
  });
  let adj = "a,b,border_px,kind\n";
  const overlap = (a0: number, a1: number, b0: number, b1: number): number =>
    Math.max(Math.min(a1, b1) - Math.max(a0, b0), 0);
  sorted.forEach((a, i) => {
    for (const b of sorted.slice(i + 1)) {
      const [ax0, ay0, ax1, ay1] = a[1];
      const [bx0, by0, bx1, by1] = b[1];
      let shared = 0;
      if (ax1 === bx0 || bx1 === ax0) shared = overlap(ay0, ay1, by0, by1);
      else if (ay1 === by0 || by1 === ay0) shared = overlap(ax0, ax1, bx0, bx1);
      if (shared > 0) adj += `${a[0]},${b[0]},${shared},land\n`;
    }
  });
  return {
    [MAP_META]: meta,
    [PROVINCE_COLORS]: colors,
    [PROVINCE_CENTROIDS]: cents,
    [PROVINCE_ADJACENCY]: adj,
  };
}
