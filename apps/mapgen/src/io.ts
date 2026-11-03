// Reading provinces.geojson and the province CSVs, writing the assets/map files
// (docs/build/m8-map-assets.md). Ported from the Rust mapgen (D1017).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { byteOrder, COASTAL_MIN_PX, type MapData, type ProvinceShape, TINY_PX } from "./build.ts";
import { fixed } from "./fmt.ts";
import type { Coords, Polygon } from "./geo.ts";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** A GeoJSON ring as closed `[x, y]` pairs (a ring is closed when read, as `geo` does). */
function ring(raw: Json, origin: string): Coords {
  if (!Array.isArray(raw)) throw new Error(`${origin}: a ring is not an array`);
  const pts = raw.map((p): [number, number] => {
    if (!Array.isArray(p) || typeof p[0] !== "number" || typeof p[1] !== "number") {
      throw new Error(`${origin}: a position is not [x, y]`);
    }
    return [p[0], p[1]];
  });
  const first = pts[0];
  const last = pts.at(-1);
  if (first !== undefined && last !== undefined && (first[0] !== last[0] || first[1] !== last[1])) {
    pts.push([first[0], first[1]]);
  }
  return pts;
}

const polygon = (raw: Json, origin: string): Polygon => {
  if (!Array.isArray(raw)) throw new Error(`${origin}: a polygon is not an array`);
  return raw.map((r) => ring(r, origin));
};

/** A geometry's polygons: Polygon, MultiPolygon, or the polygons of a GeometryCollection; null for any other. */
function toMulti(g: Json, origin: string): Polygon[] | null {
  if (g === null || typeof g !== "object" || Array.isArray(g)) return null;
  const coords = g.coordinates ?? null;
  switch (g.type) {
    case "Polygon":
      return [polygon(coords, origin)];
    case "MultiPolygon":
      if (!Array.isArray(coords)) throw new Error(`${origin}: MultiPolygon coordinates`);
      return coords.map((p) => polygon(p, origin));
    case "GeometryCollection": {
      const geoms = g.geometries;
      const polys = (Array.isArray(geoms) ? geoms : []).flatMap((x) => toMulti(x, origin) ?? []);
      return polys.length > 0 ? polys : null;
    }
    default:
      return null;
  }
}

function features(text: string, origin: string): { [k: string]: Json }[] {
  let fc: Json;
  try {
    fc = JSON.parse(text) as Json;
  } catch (e) {
    throw new Error(`${origin}: ${(e as Error).message}`);
  }
  if (fc === null || typeof fc !== "object" || Array.isArray(fc) || fc.type !== "FeatureCollection") {
    throw new Error(`${origin}: not a FeatureCollection`);
  }
  const list = fc.features;
  if (!Array.isArray(list)) throw new Error(`${origin}: no features`);
  return list.map((f) => {
    if (f === null || typeof f !== "object" || Array.isArray(f)) throw new Error(`${origin}: a bad feature`);
    return f;
  });
}

function prop(f: { [k: string]: Json }, key: string): string | null {
  const props = f.properties;
  if (props === null || props === undefined || typeof props !== "object" || Array.isArray(props)) return null;
  const v = props[key];
  return typeof v === "string" ? v : null;
}

/** Provinces from GeoJSON text with `province_id`, `region` and `country` properties (`origin` names it in errors). */
export function parseProvinces(text: string, origin: string): ProvinceShape[] {
  const out: ProvinceShape[] = [];
  features(text, origin).forEach((f, n) => {
    const id = prop(f, "province_id");
    if (id === null) throw new Error(`${origin}: feature ${n} has no province_id`);
    const shape = toMulti(f.geometry ?? null, `${origin}: ${id}`);
    if (shape !== null)
      out.push({ id, region: prop(f, "region") ?? "", country: prop(f, "country") ?? "", shape });
  });
  return out;
}

export function readProvinces(path: string): ProvinceShape[] {
  return parseProvinces(readFileSync(path, "utf8"), path);
}

/** Every polygon of a GeoJSON (the land layer), one entry a feature. */
export function readPolygons(path: string): Polygon[][] {
  return features(readFileSync(path, "utf8"), path).flatMap((f) => {
    const m = toMulti(f.geometry ?? null, path);
    return m === null ? [] : [m];
  });
}

/** One row of a province CSV, as far as mapgen needs it. */
export interface CsvProvince {
  id: string;
  name: string;
  country: string;
  region: string;
  coastal: boolean;
}

/** RFC 4180 records (quoted fields, doubled quotes, CRLF or LF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let k = 0; k < text.length; k++) {
    const c = text[k]!;
    if (quoted) {
      if (c === '"') {
        if (text[k + 1] === '"') {
          field += '"';
          k++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[k + 1] === "\n") k++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function readCsv(path: string): CsvProvince[] {
  // blank lines are no records (as the Rust csv reader skips them)
  const [headers, ...records] = parseCsv(readFileSync(path, "utf8")).filter(
    (r) => r.length > 1 || r[0] !== "",
  );
  if (headers === undefined) throw new Error(`${path}: empty`);
  const col = (name: string) => {
    const i = headers.indexOf(name);
    if (i < 0) throw new Error(`${path}: no \`${name}\` column`);
    return i;
  };
  const [ci, cn, cc, cr, ck] = [col("id"), col("name"), col("country"), col("region"), col("coastal")];
  return records.map((rec, k) => {
    if (rec.length !== headers.length) throw new Error(`${path}: record ${k + 1} has ${rec.length} fields`);
    return { id: rec[ci]!, name: rec[cn]!, country: rec[cc]!, region: rec[cr]!, coastal: rec[ck] === "Y" };
  });
}

// ---------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bufs: readonly Uint8Array[]): number {
  let c = 0xffffffff;
  for (const b of bufs) for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32([head.subarray(4), data]), 0);
  return Buffer.concat([head, data, tail]);
}

/** The Paeth predictor (PNG spec 9.4). */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * A PNG of `w` x `h` pixels from raw big-endian samples (`bpp` bytes a pixel): colour type 2 (RGB 8)
 * or 0 (grey 16). Each row takes the filter with the smallest sum of absolute signed bytes (the
 * usual adaptive choice), then zlib at level 9: the same pixels as the Rust mapgen's files, though
 * not the same bytes.
 */
export function encodePng(w: number, h: number, raw: Uint8Array, colorType: 0 | 2, bitDepth: 8 | 16): Buffer {
  const bpp = (colorType === 2 ? 3 : 1) * (bitDepth / 8);
  const stride = w * bpp;
  const out = new Uint8Array((stride + 1) * h);
  const cand = Array.from({ length: 5 }, () => new Uint8Array(stride));
  const zero = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const cur = raw.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? raw.subarray((y - 1) * stride, y * stride) : zero;
    let bestF = 0;
    let bestSum = Number.POSITIVE_INFINITY;
    for (let f = 0; f < 5; f++) {
      const c = cand[f]!;
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp]! : 0;
        const b = prev[i]!;
        const d = i >= bpp ? prev[i - bpp]! : 0;
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, d);
        const v = (cur[i]! - pred) & 0xff;
        c[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        bestF = f;
      }
    }
    out[y * (stride + 1)] = bestF;
    out.set(cand[bestF]!, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(out, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

// ---------------------------------------------------------------- assets

/** What goes in map-meta.toml besides the frame. */
export interface Meta {
  pipeline_version: string;
  /** (name, pinned version) pairs. */
  sources: [string, string][];
  /** Region CSV file names covered. */
  coverage: string[];
}

const tomlStr = (s: string) => `"${s.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

/** Write every file of docs/build/m8-map-assets.md that mapgen owns into `out`; returns their paths. */
export function writeAssets(map: MapData, meta: Meta, out: string): string[] {
  mkdirSync(out, { recursive: true });
  const { width: w, height: h } = map.frame;
  const written: string[] = [];
  const put = (name: string, data: string | Uint8Array) => {
    const p = join(out, name);
    writeFileSync(p, data);
    written.push(p);
  };

  const rgb = new Uint8Array(w * h * 3);
  const index = new Uint8Array(w * h * 2);
  map.raster.forEach((v, i) => {
    if (v !== 0) rgb.set(map.colors[v - 1]!, i * 3);
    index[i * 2] = v >> 8;
    index[i * 2 + 1] = v & 0xff;
  });
  put("province-ids.png", encodePng(w, h, rgb, 2, 8));
  put("province-index.png", encodePng(w, h, index, 0, 16));
  put("province-borders.png", encodePng(w, h, map.borders, 2, 8));

  let s = "province_id,r,g,b\n";
  map.ids.forEach((id, k) => {
    const c = map.colors[k]!;
    s += `${id},${c[0]},${c[1]},${c[2]}\n`;
  });
  put("province-colors.csv", s);

  s = "province_id,lon,lat,x,y,label_x,label_y,area_px,tiny\n";
  map.ids.forEach((id, k) => {
    const st = map.stats[k]!;
    const [lon, lat] = map.frame.unproject(st.centroid[0], st.centroid[1]);
    const tiny = st.area_px < TINY_PX ? "Y" : "N";
    s += `${id},${fixed(lon, 4)},${fixed(lat, 4)},${fixed(st.centroid[0], 1)},${fixed(st.centroid[1], 1)},`;
    s += `${fixed(st.label[0], 1)},${fixed(st.label[1], 1)},${st.area_px},${tiny}\n`;
  });
  put("province-centroids.csv", s);

  // land rows carry the shared edge; sea rows (D678) share none, so border_px is 0
  const id = (v: number) => map.ids[v - 1]!;
  const rows: [string, string, number, string][] = [
    ...map.adjacency.map(([a, b, c]): [string, string, number, string] => [id(a), id(b), c, "land"]),
    ...map.sea.map(([a, b]): [string, string, number, string] => [id(a), id(b), 0, "sea"]),
  ];
  rows.sort((p, q) => byteOrder(p[0], q[0]) || byteOrder(p[1], q[1]) || p[2] - q[2] || byteOrder(p[3], q[3]));
  s = "a,b,border_px,kind\n";
  for (const [a, b, c, kind] of rows) s += `${a},${b},${c},${kind}\n`;
  put("province-adjacency.csv", s);

  s = "# Written by mapgen (build-plan P7); the format is docs/build/m8-map-assets.md.\n";
  s += `width = ${w}\nheight = ${h}\nprojection = "miller"\n`;
  s += "lon_min = -180.0\nlon_max = 180.0\n";
  s += `lat_max = ${fixed(map.frame.latMax, 6)}\nlat_min = ${fixed(map.frame.latMin, 6)}\n`;
  s += `tiny_px = ${TINY_PX}\n`;
  s += `pipeline_version = ${tomlStr(meta.pipeline_version)}\n`;
  s += `coverage = [${meta.coverage.map(tomlStr).join(", ")}]\n`;
  s += "\n[sources]\n";
  for (const [k, v] of meta.sources) s += `${k} = ${tomlStr(v)}\n`;
  put("map-meta.toml", s);
  return written;
}

/** A CSV field, quoted when it holds a comma, quote or newline (quotes doubled). */
const csvField = (v: string) => (/[,"\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** Per-province QA rows for the P8 report: every CSV province, with or without a shape. */
export function writeQa(map: MapData, csv: readonly CsvProvince[], path: string): void {
  const index = new Map(map.ids.map((id, k) => [id, k]));
  const yn = (b: boolean) => (b ? "Y" : "N");
  let s =
    "province_id,name,country,in_bitmap,area_px,tiny,forced,components,coastal_px,coastal_bitmap,coastal_csv,coastal_match,overwritten_px,exclaves\n";
  for (const p of csv) {
    const k = index.get(p.id);
    const st = k === undefined ? undefined : map.stats[k];
    const name = csvField(p.name);
    if (st !== undefined) {
      const coastal = st.coastal_px >= COASTAL_MIN_PX;
      const exclaves = st.exclaves.map(([n, x, y]) => `${n}:${fixed(x, 1)}:${fixed(y, 1)}`).join("|");
      s += `${p.id},${name},${p.country},Y,${st.area_px},${yn(st.area_px < TINY_PX)},${yn(st.forced)},`;
      s += `${st.components},${st.coastal_px},${yn(coastal)},${yn(p.coastal)},${yn(coastal === p.coastal)},`;
      s += `${st.overwritten_px},${exclaves}\n`;
    } else {
      s += `${p.id},${name},${p.country},N,0,,,,,,${yn(p.coastal)},,,\n`;
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, s);
}
