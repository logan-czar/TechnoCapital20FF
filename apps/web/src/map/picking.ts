// Picking (crates/game/src/map/picking.rs; D637, D640): the province under a screen point, with
// tiny provinces' click targets taking priority near their label points. The map hands in the
// province deck's GPU pick found under the pointer; tests hand in `provinceAt`, a point-in-polygon
// over the model, so every province's clickability is checked in node (D740).

import type { MapModel, ProvincePart, XY } from "./model.ts";
import {
  FRAME_BOTTOM,
  FRAME_TOP,
  FRAME_WIDTH,
  pxPerBitmapPx,
  toScreen,
  type Viewport,
  wrapX,
} from "./view.ts";

/** A tiny province's click target radius around its label point, logical pixels (D637). */
export const TINY_TARGET_PX = 9.0;
/** A click this close to a tiny province's label point (its dot) always picks it (D640). */
export const TINY_DOT_HIT_PX = 4.0;
/**
 * A tiny province's wider target wins over the province under the cursor only when that province
 * shows smaller than this many square logical pixels at the current zoom, or over water (D640).
 */
export const TINY_STEAL_BELOW_SQ_PX = 64.0;
/** A tiny province's dot, logical pixels (mod.rs TINY_DOT_PX). */
export const TINY_DOT_PX = 6.0;

/** The tiny provinces with their label points, in ordinal order (v_map_static `tiny_targets`). */
export function tinyTargets(model: Pick<MapModel, "shapes">): [number, XY][] {
  const out: [number, XY][] = [];
  model.shapes.forEach((s, i) => {
    if (s?.tiny) out.push([i, s.label]);
  });
  return out;
}

/**
 * The province under screen point `p` (Rust `pick`), given `under`, the province drawn there (null
 * over the sea):
 *
 * 1. within TINY_DOT_HIT_PX of a tiny province's label point (its dot): that province;
 * 2. else `under`, unless it is water or shows smaller than TINY_STEAL_BELOW_SQ_PX on screen (and
 *    is not itself tiny) and a tiny target is within TINY_TARGET_PX;
 * 3. else that nearest tiny target (ties to the lower ordinal), or none.
 */
export function pick(
  vp: Viewport,
  p: readonly [number, number],
  under: number | null,
  model: Pick<MapModel, "shapes">,
  tiny: readonly [number, XY][],
): number | null {
  let best: [number, number] | null = null;
  for (const [id, label] of tiny) {
    const s = toScreen(vp, label);
    const d = Math.hypot(s[0] - p[0], s[1] - p[1]);
    if (d <= TINY_TARGET_PX && (best === null || d < best[0] || (d === best[0] && id < best[1])))
      best = [d, id];
  }
  if (best !== null && best[0] <= TINY_DOT_HIT_PX) return best[1];
  if (under === null) return best === null ? null : best[1];
  const shape = model.shapes[under];
  const scale = pxPerBitmapPx(vp.view.zoom);
  const small = shape == null || shape.areaPx * scale * scale < TINY_STEAL_BELOW_SQ_PX;
  if (best !== null && small && !shape?.tiny) return best[1];
  return under;
}

/** A ring's point-in-polygon test (even-odd), x already unwrapped near the ring. */
function inRing(ring: readonly XY[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as XY;
    const [xj, yj] = ring[j] as XY;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Grid cells across the frame for `provinceAt`'s index. */
const GRID_W = 256;
const GRID_H = 128;

/**
 * The province whose polygon holds Miller point (x, y), or null over the sea: a CPU stand-in for
 * deck's GPU pick (tests, D740). The index buckets parts by bounding box.
 */
export function provinceIndex(
  model: Pick<MapModel, "parts">,
): (p: readonly [number, number]) => number | null {
  const cellW = FRAME_WIDTH / GRID_W;
  const cellH = (FRAME_TOP - FRAME_BOTTOM) / GRID_H;
  const grid: ProvincePart[][] = Array.from({ length: GRID_W * GRID_H }, () => []);
  const col = (x: number) => Math.min(GRID_W - 1, Math.max(0, Math.floor((x + Math.PI) / cellW)));
  const row = (y: number) => Math.min(GRID_H - 1, Math.max(0, Math.floor((FRAME_TOP - y) / cellH)));
  for (const part of model.parts) {
    const outer = part.polygon[0] ?? [];
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y] of outer) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    for (let c = col(x0); c <= col(x1); c++)
      for (let r = row(y1); r <= row(y0); r++) (grid[r * GRID_W + c] as ProvincePart[]).push(part);
  }
  return ([mx, my]) => {
    const x = wrapX(mx);
    if (my > FRAME_TOP || my < FRAME_BOTTOM) return null;
    let hit: number | null = null;
    for (const part of grid[row(my) * GRID_W + col(x)] as ProvincePart[]) {
      const [outer, ...holes] = part.polygon;
      if (!outer || !inRing(outer, x, my)) continue;
      if (holes.some((h) => inRing(h, x, my))) continue;
      // Ties to the lower ordinal (parts are in ordinal order).
      if (hit === null || part.ordinal < hit) hit = part.ordinal;
    }
    return hit;
  };
}
