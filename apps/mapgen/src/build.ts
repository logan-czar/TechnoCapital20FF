// Rasterize the provinces and derive every `assets/map` file (docs/build/m8-map-assets.md,
// build-plan P7). Ported from the Rust mapgen, output for output (D1017).

import { distance } from "./edt.ts";
import { interiorPoint, multiInteriorPoint, type Polygon, unsignedArea } from "./geo.ts";
import { type Frame, remEuclid } from "./miller.ts";
import { fillRings, type Ring } from "./raster.ts";
import { pairKey, seaLinks } from "./sea.ts";

/**
 * Click-target threshold (D607): a province under this many pixels is `tiny` and gets a clickable
 * dot at its label point (m8-plan decision "8192x4096, plus click targets").
 */
export const TINY_PX = 64;
/**
 * Pixel edges a province must share with open water to count as coastal in the cross-check against
 * the CSV `coastal` column (D608).
 */
export const COASTAL_MIN_PX = 4;
/** Border distance field clamp (m8-map-assets.md: each channel 0..255). */
export const BORDER_CAP = 255.0;
/**
 * A land exclave this large or larger (a part that is not the province's largest and touches no
 * pixel outside every province) is listed in the QA file (PR #39 review, D691).
 */
export const EXCLAVE_MIN_PX = 5;

/** One province shape in lon/lat degrees, with its region and country keys. */
export interface ProvinceShape {
  id: string;
  region: string;
  country: string;
  shape: Polygon[];
}

/** Per-province results, in `MapData.ids` order. */
export interface Stats {
  area_px: number;
  /** Pixel centroid (mean of pixel centres, unwrapped across the east-west seam). */
  centroid: [number, number];
  /** Pole of inaccessibility of the largest 4-connected part (a pixel centre). */
  label: [number, number];
  components: number;
  /** Pixel edges shared with open water (needs a land mask; 0 without one). */
  coastal_px: number;
  /** The province had no pixel and was given the one at its interior point. */
  forced: boolean;
  /**
   * Pixels this province's polygons took from a province drawn before it (overlapping shapes; 0
   * when the shapes tile cleanly).
   */
  overwritten_px: number;
  /**
   * Land exclaves of at least `EXCLAVE_MIN_PX` pixels: (pixels, mean x, mean y), the mean unwrapped
   * across the seam, in row order of their first pixel.
   */
  exclaves: [number, number, number][];
}

/** The rasterized map: index bitmap plus everything derived from it. */
export interface MapData {
  frame: Frame;
  /** Province ids sorted by byte order; raster value i + 1 is `ids[i]`. */
  ids: string[];
  regions: string[];
  countries: string[];
  /** Row-major index bitmap (0 = water or no province). */
  raster: Uint16Array;
  colors: [number, number, number][];
  stats: Stats[];
  /** [a, b, border_px] with a < b as raster values, sorted. */
  adjacency: [number, number, number][];
  /** Sea links [a, b] with a < b as raster values, sorted (D678; empty without a land mask). */
  sea: [number, number][];
  /** RGB distance field, 3 bytes a pixel: province, region, country edges. */
  borders: Uint8Array;
}

/** Byte-order string compare (ids and keys are ASCII), never the locale's. */
export const byteOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function ringsPx(frame: Frame, poly: Polygon): Ring[] {
  return poly.map((ring) => {
    const out = new Float64Array(ring.length * 2);
    ring.forEach(([lon, lat], k) => {
      const [x, y] = frame.project(lon, lat);
      out[2 * k] = x;
      out[2 * k + 1] = y;
    });
    return out;
  });
}

/** Rasterize `land` into a mask (1 = land). */
export function landMask(frame: Frame, land: readonly Polygon[][]): Uint8Array {
  const w = frame.width;
  const mask = new Uint8Array(w * frame.height);
  for (const mp of land) {
    for (const poly of mp) {
      fillRings(w, frame.height, ringsPx(frame, poly), (x, y) => {
        mask[y * w + x] = 1;
      });
    }
  }
  return mask;
}

const MASK64 = (1n << 64n) - 1n;

function fnv1a(s: string): bigint {
  let h = 0xcbf2_9ce4_8422_2325n;
  for (const b of Buffer.from(s, "utf8")) {
    h ^= BigInt(b);
    h = (h * 0x0100_0000_01b3n) & MASK64;
  }
  return h;
}

function splitmix(x: bigint): bigint {
  let z = (x + 0x9e37_79b9_7f4a_7c15n) & MASK64;
  z = ((z ^ (z >> 30n)) * 0xbf58_476d_1ce4_e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d0_49bb_1331_11ebn) & MASK64;
  return z ^ (z >> 31n);
}

/** A colour per province from a hash of its id (stable when others are added), never black, never shared. */
export function colorsFor(ids: readonly string[]): [number, number, number][] {
  const used = new Set<number>();
  return ids.map((id) => {
    let h = fnv1a(id);
    for (;;) {
      h = splitmix(h);
      // keep each channel in 16..=239 so no province is near-black or near-white
      const c: [number, number, number] = [
        16 + (Number(h & 0xffn) % 224),
        16 + (Number((h >> 8n) & 0xffn) % 224),
        16 + (Number((h >> 16n) & 0xffn) % 224),
      ];
      const key = (c[0] << 16) | (c[1] << 8) | c[2];
      if (!used.has(key)) {
        used.add(key);
        return c;
      }
    }
  });
}

/**
 * The shift that unwraps occupied columns across the seam: x' = (x - shift) mod width has no wrap
 * (the cut is placed at the end of the longest empty run of columns).
 */
export function unwrapShift(occupied: Uint8Array): number {
  const w = occupied.length;
  const first = occupied.indexOf(1);
  if (first < 0) return 0;
  let bestLen = 0;
  let bestEnd = first;
  let run = 0;
  // walk one full turn starting just after an occupied column
  for (let k = 1; k <= w; k++) {
    const x = (first + k) % w;
    if (occupied[x]) {
      if (run > bestLen) {
        bestLen = run;
        bestEnd = x;
      }
      run = 0;
    } else {
      run++;
    }
  }
  return bestLen === 0 ? first : bestEnd;
}

/** Neighbours tried, in order, for a province given the pixel at its interior point (D607). */
const FORCED_TRIES = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
] as const;

/**
 * Rasterize provinces (sorted by id internally) and derive colours, stats, adjacency and the border
 * field. `land` is the land mask for the coastal count (null: no coastal count).
 */
export function build(frame: Frame, input: readonly ProvinceShape[], land: Uint8Array | null): MapData {
  const provinces = [...input].sort((a, b) => byteOrder(a.id, b.id));
  if (provinces.length >= 0xffff) throw new Error("more provinces than a 16-bit index holds");
  const w = frame.width;
  const h = frame.height;
  const raster = new Uint16Array(w * h);
  const overwritten = new Array<number>(provinces.length).fill(0);
  provinces.forEach((p, i) => {
    const v = i + 1;
    for (const poly of p.shape) {
      fillRings(w, h, ringsPx(frame, poly), (x, y) => {
        const cell = y * w + x;
        const was = raster[cell]!;
        if (was !== 0 && was !== v) overwritten[i]!++;
        raster[cell] = v;
      });
    }
  });
  const n = provinces.length;
  const count = new Uint32Array(n + 1);
  for (let i = 0; i < raster.length; i++) count[raster[i]!]!++;
  // D607: a province too small to cover a pixel centre takes the pixel at its interior point
  const forced = new Array<boolean>(n).fill(false);
  provinces.forEach((p, i) => {
    if (count[i + 1]! > 0) return;
    // the largest polygon (the last on a tie, as Rust's `max_by`)
    let largest: Polygon | undefined;
    let largestArea = Number.NEGATIVE_INFINITY;
    for (const poly of p.shape) {
      const a = unsignedArea(poly);
      if (a >= largestArea) {
        largest = poly;
        largestArea = a;
      }
    }
    const pt = (largest === undefined ? null : interiorPoint(largest)) ?? multiInteriorPoint(p.shape);
    if (pt === null) return;
    const [fx, fy] = frame.project(pt[0], pt[1]);
    const cx = Math.floor(fx);
    const cy = Math.floor(fy);
    for (const [dx, dy] of FORCED_TRIES) {
      const x = (((cx + dx) % w) + w) % w;
      const y = Math.min(Math.max(cy + dy, 0), h - 1);
      const owner = raster[y * w + x]!;
      if (owner === 0 || count[owner]! > 1) {
        count[owner]!--;
        raster[y * w + x] = i + 1;
        count[i + 1] = 1;
        forced[i] = true;
        return;
      }
    }
    throw new Error(`no pixel free for tiny province ${p.id}`);
  });

  const ids = provinces.map((p) => p.id);
  const regions = [...new Set(provinces.map((p) => p.region))].sort(byteOrder);
  const countries = [...new Set(provinces.map((p) => p.country))].sort(byteOrder);
  const regionIndex = new Map(regions.map((r, k) => [r, k + 1]));
  const countryIndex = new Map(countries.map((c, k) => [c, k + 1]));
  const regionKey = Uint32Array.from([0, ...provinces.map((p) => regionIndex.get(p.region)!)]);
  const countryKey = Uint32Array.from([0, ...provinces.map((p) => countryIndex.get(p.country)!)]);

  const stats = provinceStats(frame, raster, n, forced, land);
  stats.forEach((st, k) => {
    st.overwritten_px = overwritten[k]!;
  });
  const adjacency = adjacencyOf(w, h, raster);
  let sea: [number, number][] = [];
  if (land !== null) {
    const water = new Uint8Array(w * h);
    for (let i = 0; i < water.length; i++) water[i] = raster[i] === 0 && !land[i] ? 1 : 0;
    const landPairs = new Set(adjacency.map(([a, b]) => pairKey(a, b)));
    sea = seaLinks(frame, raster, water, landPairs).map((key) => {
      const b = key % 65536;
      return [(key - b) / 65536, b];
    });
  }
  const borders = new Uint8Array(w * h * 3);
  const keyed = new Uint32Array(w * h);
  const edge = new Uint8Array(w * h);
  for (const [ch, key] of [null, regionKey, countryKey].entries()) {
    for (let i = 0; i < raster.length; i++) keyed[i] = key === null ? raster[i]! : key[raster[i]!]!;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const me = keyed[i]!;
        let e = keyed[y * w + ((x + 1) % w)] !== me || keyed[y * w + ((x + w - 1) % w)] !== me;
        if (y > 0 && keyed[i - w] !== me) e = true;
        if (y + 1 < h && keyed[i + w] !== me) e = true;
        edge[i] = e ? 1 : 0;
      }
    }
    const d = distance(edge, w, h, true, BORDER_CAP);
    for (let i = 0; i < d.length; i++) borders[i * 3 + ch] = Math.min(Math.round(d[i]!), BORDER_CAP);
  }
  return {
    frame,
    colors: colorsFor(ids),
    ids,
    regions,
    countries,
    raster,
    stats,
    adjacency,
    sea,
    borders,
  };
}

function adjacencyOf(w: number, h: number, raster: Uint16Array): [number, number, number][] {
  const adj = new Map<number, number>();
  const bump = (a: number, b: number) => {
    if (a !== b && a !== 0 && b !== 0) {
      const key = pairKey(Math.min(a, b), Math.max(a, b));
      adj.set(key, (adj.get(key) ?? 0) + 1);
    }
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = raster[y * w + x]!;
      bump(a, raster[y * w + ((x + 1) % w)]!);
      if (y + 1 < h) bump(a, raster[(y + 1) * w + x]!);
    }
  }
  return [...adj.entries()]
    .sort((p, q) => p[0] - q[0])
    .map(([key, c]) => {
      const b = key % 65536;
      return [(key - b) / 65536, b, c];
    });
}

/** The mean pixel centre of `px`, unwrapped across the seam. */
function meanCentre(px: ArrayLike<number>, w: number, occupied: Uint8Array): [number, number] {
  occupied.fill(0);
  for (let k = 0; k < px.length; k++) occupied[px[k]! % w] = 1;
  const shift = unwrapShift(occupied);
  let sx = 0;
  let sy = 0;
  for (let k = 0; k < px.length; k++) {
    const i = px[k]!;
    const x = i % w;
    sx += ((x + w - shift) % w) + 0.5;
    sy += (i - x) / w + 0.5;
  }
  const np = Math.max(px.length, 1);
  return [remEuclid(sx / np + shift, w), sy / np];
}

export function provinceStats(
  frame: Frame,
  raster: Uint16Array,
  n: number,
  forced: readonly boolean[],
  land: Uint8Array | null,
): Stats[] {
  const w = frame.width;
  const h = frame.height;
  // every province's pixels in raster order: a counting sort by value
  const start = new Uint32Array(n + 2);
  for (let i = 0; i < raster.length; i++) {
    const v = raster[i]!;
    if (v !== 0) start[v + 1]!++;
  }
  for (let v = 1; v <= n + 1; v++) start[v] = start[v]! + start[v - 1]!;
  const all = new Uint32Array(start[n + 1]!);
  const fill = start.slice();
  for (let i = 0; i < raster.length; i++) {
    const v = raster[i]!;
    if (v !== 0) all[fill[v]!++] = i;
  }
  const water = (i: number) => raster[i] === 0 && land !== null && !land[i];
  const seen = new Uint8Array(w * h);
  const occupied = new Uint8Array(w);
  const nb = [0, 0, 0, 0];
  const out: Stats[] = [];
  for (let v = 1; v <= n; v++) {
    const px = all.subarray(start[v]!, start[v + 1]!);
    const centroid = meanCentre(px, w, occupied);
    // components (4-connected, wrapping east-west), keep the largest
    let components = 0;
    let best: number[] = [];
    const parts: [number[], boolean][] = [];
    const stack: number[] = [];
    for (const s of px) {
      if (seen[s]) continue;
      components++;
      const comp: number[] = [];
      let wet = false;
      seen[s] = 1;
      stack.push(s);
      while (stack.length > 0) {
        const i = stack.pop()!;
        comp.push(i);
        const x = i % w;
        const y = (i - x) / w;
        nb[0] = y * w + ((x + 1) % w);
        nb[1] = y * w + ((x + w - 1) % w);
        nb[2] = y > 0 ? i - w : -1;
        nb[3] = y + 1 < h ? i + w : -1;
        for (const j of nb) {
          if (j < 0) continue;
          if (raster[j] === 0) wet = true;
          if (!seen[j] && raster[j] === v) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
      if (comp.length > best.length) best = comp;
      parts.push([comp, wet]);
    }
    const exclaves: [number, number, number][] = [];
    for (const [comp, wet] of parts) {
      if (wet || comp.length < EXCLAVE_MIN_PX || comp[0] === best[0]) continue;
      const [ex, ey] = meanCentre(comp, w, new Uint8Array(w));
      exclaves.push([comp.length, ex, ey]);
    }
    const label = labelPoint(best, w);
    // coastal: pixel edges to open water
    let coastal = 0;
    if (land !== null) {
      for (const i of px) {
        const x = i % w;
        const y = (i - x) / w;
        if (water(y * w + ((x + 1) % w))) coastal++;
        if (water(y * w + ((x + w - 1) % w))) coastal++;
        if (y > 0 && water(i - w)) coastal++;
        if (y + 1 < h && water(i + w)) coastal++;
      }
    }
    out.push({
      area_px: px.length,
      centroid,
      label,
      components,
      coastal_px: coastal,
      forced: forced[v - 1]!,
      overwritten_px: 0,
      exclaves,
    });
  }
  return out;
}

/**
 * The pole of inaccessibility of a component (its pixel farthest from any outside pixel; ties to the
 * lowest row, then the lowest unwrapped column), as a pixel centre.
 */
function labelPoint(comp: readonly number[], w: number): [number, number] {
  if (comp.length === 0) return [0, 0];
  const occupied = new Uint8Array(w);
  for (const i of comp) occupied[i % w] = 1;
  const shift = unwrapShift(occupied);
  const ux = (i: number) => ((i % w) + w - shift) % w;
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = 0;
  let y0 = Number.POSITIVE_INFINITY;
  let y1 = 0;
  for (const i of comp) {
    const x = ux(i);
    const y = Math.trunc(i / w);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  // local grid with a one-pixel outside border
  const lw = x1 - x0 + 3;
  const lh = y1 - y0 + 3;
  const outside = new Uint8Array(lw * lh).fill(1);
  for (const i of comp) outside[(Math.trunc(i / w) - y0 + 1) * lw + (ux(i) - x0 + 1)] = 0;
  const d = distance(outside, lw, lh, false, Number.POSITIVE_INFINITY);
  let bestJ = 0;
  let bestD = Number.NEGATIVE_INFINITY;
  for (let j = 0; j < d.length; j++) {
    if (!outside[j] && d[j]! > bestD) {
      bestJ = j;
      bestD = d[j]!;
    }
  }
  const lx = bestJ % lw;
  const ly = (bestJ - lx) / lw;
  return [((lx + x0 - 1 + shift) % w) + 0.5, ly + y0 - 1 + 0.5];
}
