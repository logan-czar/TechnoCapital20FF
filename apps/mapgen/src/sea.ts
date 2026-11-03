// Sea links (docs/build/m8-map-assets.md `province-adjacency.csv` kind `sea`; D678): coastal
// provinces that face each other across a strait but whose shapes do not touch.
//
// The rule: grow every province into the open water around it, by ground distance, until the fronts
// meet (a Voronoi partition of the water near the coasts). Two provinces are sea-linked when their
// water regions meet at a point whose two distances add up to at most `SEA_LINK_KM`, they are not
// already land neighbours, and no coastal province is a land neighbour of both (a link along a coast
// past a third province's shore is no strait). Only neighbours in that water partition link, so a
// province is never linked past another province's water across a wide sea, and a strait's two
// shores link wherever they face each other.

import type { Frame } from "./miller.ts";

/**
 * Widest water gap a sea link crosses, in kilometres of ground distance between the two shores'
 * pixel centres (D678): the Strait of Gibraltar (14 km), the Bosporus, the Oresund (4 km), the Dover
 * Strait (33 km), Bab-el-Mandeb (26 km) and Hormuz (39 km at Musandam) all fit; the Taiwan Strait
 * links through Kinmen and Matsu (2 to 10 km off Fujian), not across its 130 km main channel.
 */
export const SEA_LINK_KM = 60.0;
/** Mean Earth radius in kilometres for the ground distance per pixel. */
const EARTH_RADIUS_KM = 6371.0;
/** No distance yet (Rust's `u32::MAX`). */
const UNSET = 0xffff_ffff;

/** Ground step lengths (metres) out of a pixel of row `y`: east-west, north-south, diagonal. */
export function steps(frame: Frame, y: number): [number, number, number] {
  const lat = frame.unproject(0, y + 0.5)[1];
  const perRad = (EARTH_RADIUS_KM * 1000 * 2 * Math.PI) / frame.width;
  const rad = lat * (Math.PI / 180);
  // Miller: x is longitude, so east-west is R cos(lat) dlon; dy/dlat = 1 / cos(0.8 lat)
  const h = perRad * Math.cos(rad);
  const v = perRad * Math.cos(0.8 * rad);
  return [Math.round(h), Math.round(v), Math.round(Math.sqrt(h * h + v * v))];
}

/** A pair key: `a * 65536 + b` (raster values are u16), so numeric order is (a, b) order. */
export const pairKey = (a: number, b: number) => a * 65536 + b;

/**
 * The 8 neighbours of pixel `i` into `out` (-1 past the top or bottom edge; east-west wraps), in
 * the order west, east, up, down, up-west, up-east, down-west, down-east. Their step kinds are
 * `NEIGHBOUR_KIND`.
 */
function neighbours(i: number, w: number, h: number, out: Int32Array): void {
  const x = i % w;
  const y = (i - x) / w;
  const xl = (x + w - 1) % w;
  const xr = (x + 1) % w;
  const up = y > 0 ? (y - 1) * w : -1;
  const down = y + 1 < h ? (y + 1) * w : -1;
  out[0] = y * w + xl;
  out[1] = y * w + xr;
  out[2] = up < 0 ? -1 : up + x;
  out[3] = down < 0 ? -1 : down + x;
  out[4] = up < 0 ? -1 : up + xl;
  out[5] = up < 0 ? -1 : up + xr;
  out[6] = down < 0 ? -1 : down + xl;
  out[7] = down < 0 ? -1 : down + xr;
}
/** 0 east-west, 1 north-south, 2 diagonal. */
const NEIGHBOUR_KIND = [0, 0, 1, 1, 2, 2, 2, 2] as const;

/** A binary min-heap of (key, pixel), ordered by key alone. */
class Heap {
  private keys = new Float64Array(1 << 16);
  private px = new Int32Array(1 << 16);
  size = 0;

  push(key: number, pixel: number): void {
    if (this.size === this.keys.length) {
      const k = new Float64Array(this.size * 2);
      k.set(this.keys);
      this.keys = k;
      const p = new Int32Array(this.size * 2);
      p.set(this.px);
      this.px = p;
    }
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent]! <= key) break;
      this.keys[i] = this.keys[parent]!;
      this.px[i] = this.px[parent]!;
      i = parent;
    }
    this.keys[i] = key;
    this.px[i] = pixel;
  }

  /** Pops the smallest entry into `top` ([key, pixel]). */
  pop(top: [number, number]): void {
    top[0] = this.keys[0]!;
    top[1] = this.px[0]!;
    const n = --this.size;
    const key = this.keys[n]!;
    const pixel = this.px[n]!;
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && this.keys[c + 1]! < this.keys[c]!) c++;
      if (this.keys[c]! >= key) break;
      this.keys[i] = this.keys[c]!;
      this.px[i] = this.px[c]!;
      i = c;
    }
    this.keys[i] = key;
    this.px[i] = pixel;
  }
}

/**
 * Sea links as `pairKey(a, b)` raster values with a < b, sorted. `water[i]` is 1 for open water (no
 * province and not land in the mask); `landPairs` are the land adjacencies to skip.
 */
export function seaLinks(
  frame: Frame,
  raster: Uint16Array,
  water: Uint8Array,
  landPairs: ReadonlySet<number>,
): number[] {
  const w = frame.width;
  const h = frame.height;
  const max = Math.trunc(SEA_LINK_KM * 1000);
  const rowSteps: [number, number, number][] = [];
  for (let y = 0; y < h; y++) rowSteps.push(steps(frame, y));
  const dist = new Uint32Array(w * h).fill(UNSET);
  const label = new Uint16Array(w * h);
  const nb = new Int32Array(8);
  // Keyed by (distance, label): the result is the lowest (distance, label) per pixel, so it does
  // not depend on the order of equal keys.
  const heap = new Heap();
  for (let i = 0; i < w * h; i++) {
    const v = raster[i]!;
    if (v === 0) continue;
    neighbours(i, w, h, nb);
    for (let k = 0; k < 8; k++) {
      const j = nb[k]!;
      if (j >= 0 && water[j]) {
        dist[i] = 0;
        label[i] = v;
        heap.push(v, i);
        break;
      }
    }
  }
  const top: [number, number] = [0, 0];
  while (heap.size > 0) {
    heap.pop(top);
    const v = top[0] % 65536;
    const d = (top[0] - v) / 65536;
    const i = top[1];
    if (d !== dist[i] || label[i] !== v) continue;
    const st = rowSteps[Math.trunc(i / w)]!;
    neighbours(i, w, h, nb);
    for (let k = 0; k < 8; k++) {
      const j = nb[k]!;
      if (j < 0 || !water[j]) continue;
      const nd = d + st[NEIGHBOUR_KIND[k]!]!;
      if (nd > max) continue;
      if (nd < dist[j]! || (nd === dist[j]! && v < label[j]!)) {
        dist[j] = nd;
        label[j] = v;
        heap.push(nd * 65536 + v, j);
      }
    }
  }
  // where two labels meet, the gap is the two distances plus the step between them
  const best = new Map<number, number>();
  for (let i = 0; i < w * h; i++) {
    const a = label[i]!;
    if (a === 0) continue;
    const st = rowSteps[Math.trunc(i / w)]!;
    neighbours(i, w, h, nb);
    for (let k = 0; k < 8; k++) {
      const j = nb[k]!;
      if (j < 0 || j < i) continue;
      const b = label[j]!;
      if (b === 0 || b === a) continue;
      const gap = dist[i]! + st[NEIGHBOUR_KIND[k]!]! + dist[j]!;
      const key = pairKey(Math.min(a, b), Math.max(a, b));
      if (gap <= max && !landPairs.has(key)) {
        const e = best.get(key);
        if (e === undefined || gap < e) best.set(key, gap);
      }
    }
  }
  // a link that leapfrogs along a coast past a third province's shore is no strait: drop it when a
  // coastal province is a land neighbour of both ends (the Po delta between Veneto and Emilia-Romagna)
  const coastal = new Set<number>();
  for (let i = 0; i < raster.length; i++) {
    const v = raster[i]!;
    if (v !== 0 && dist[i] === 0) coastal.add(v);
  }
  const landOf = new Map<number, Set<number>>();
  for (const key of landPairs) {
    const b = key % 65536;
    const a = (key - b) / 65536;
    for (const [p, q] of [
      [a, b],
      [b, a],
    ] as const) {
      const s = landOf.get(p) ?? new Set<number>();
      landOf.set(p, s);
      s.add(q);
    }
  }
  const out: number[] = [];
  for (const key of best.keys()) {
    const b = key % 65536;
    const a = (key - b) / 65536;
    const na = landOf.get(a);
    const nbs = landOf.get(b);
    let shared = false;
    if (na !== undefined && nbs !== undefined) {
      for (const c of na) {
        if (nbs.has(c) && coastal.has(c)) {
          shared = true;
          break;
        }
      }
    }
    if (!shared) out.push(key);
  }
  return out.sort((x, y) => x - y);
}
