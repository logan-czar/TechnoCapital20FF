// Map labels (crates/game/src/map/labels.rs; m8-plan 2 "straight, by zoom level"; D706): country
// names at World zoom, region and key city names at Country zoom, province names at Province
// zoom, straight text centred on label points, with overlap culling. Anchors come from the map
// model's label points and areas, v_map_static (regions, key cities) and v_places (names).
//
// A country's or region's anchor is the label point of its province nearest the area-weighted
// median of its provinces' centroids (robust to far islands such as Alaska or Hawaii, and always
// on land in it). Labels are placed greedily by priority (larger areas first, key cities before
// regions), each kept only if its padded box overlaps no label already placed nor a blocked
// rectangle (the mode bar, the legend) and lies wholly inside the view. Pure, tested in node.

import type { MapStaticView, PlacesView } from "@tc20ff/sim";
import { totalCmp } from "@tc20ff/sim";
import type { MapModel, XY } from "./model.ts";
import {
  FRAME_WIDTH,
  pxPerBitmapPx,
  spanDeg,
  toScreen,
  type Viewport,
  type ZoomLevel,
  zoomLevel,
} from "./view.ts";

/** What a label names (its style), in priority order. */
export type LabelKind = "Country" | "KeyCity" | "Region" | "Province";
const KIND_ORDER: Record<LabelKind, number> = { Country: 0, KeyCity: 1, Region: 2, Province: 3 };

/** Font size, logical pixels (D706). */
export const LABEL_SIZE: Record<LabelKind, number> = { Country: 14, KeyCity: 12, Region: 11, Province: 11 };
/**
 * The smallest area (logical square pixels at the current zoom) a place must show to be labelled,
 * so a speck of a country or region gets no name over the sea (D706).
 */
export const LABEL_MIN_AREA: Record<LabelKind, number> = {
  Country: 300,
  KeyCity: 0,
  Region: 200,
  Province: 0,
};
/** The monospace font's advance per character, as a share of its size (D302). */
export const CHAR_W = 0.6;
/** A line's height, as a share of its size. */
export const LINE_H = 1.2;
/** Padding round a label's box in the overlap test, logical pixels. */
export const LABEL_PAD = 3.0;

/** A label's text, where it goes (Miller), its priority (higher first) and the area it names (bitmap px). */
export interface Anchor {
  kind: LabelKind;
  text: string;
  at: XY;
  weight: number;
  area: number;
}

/** Every anchor, by zoom level, each list in priority order. */
export type LabelAnchors = Record<ZoomLevel, Anchor[]>;

/** A rectangle in screen pixels: [minX, minY, maxX, maxY]. */
export type Rect = [number, number, number, number];

/** A placed label: what it says and its centre on screen. */
export interface Placed {
  kind: LabelKind;
  text: string;
  at: [number, number];
}

/** A label's font size in pixels at a font scale, as the theme rounds it. */
export function fontPx(kind: LabelKind, fontScale: number): number {
  return Math.floor(LABEL_SIZE[kind] * fontScale + 0.5);
}

/** A label's box centred at `at`, at the font scale. */
export function labelBox(
  kind: LabelKind,
  text: string,
  at: readonly [number, number],
  fontScale: number,
): Rect {
  const s = fontPx(kind, fontScale);
  const hw = ([...text].length * s * CHAR_W) / 2;
  const hh = (s * LINE_H) / 2;
  return [at[0] - hw, at[1] - hh, at[0] + hw, at[1] + hh];
}

function overlaps(a: Rect, b: Rect): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

function pad(r: Rect): Rect {
  return [r[0] - LABEL_PAD, r[1] - LABEL_PAD, r[2] + LABEL_PAD, r[3] + LABEL_PAD];
}

/** The weighted median of (value, weight) pairs. */
export function weightedMedian(xs: [number, number][]): number {
  const s = [...xs].sort((a, b) => totalCmp(a[0], b[0]));
  const total = s.reduce((t, x) => t + x[1], 0);
  let acc = 0;
  for (const [v, w] of s) {
    acc += w;
    if (acc >= total / 2) return v;
  }
  return s[s.length - 1]?.[0] ?? 0;
}

/**
 * The anchor of a group of provinces: the label point of its province nearest the area-weighted
 * median of their centroids; and the group's area. Null with no shape.
 */
export function groupAnchor(
  model: Pick<MapModel, "shapes">,
  provinces: readonly number[],
): [XY, number] | null {
  const shapes = provinces.flatMap((p) => {
    const s = model.shapes[p];
    return s ? [[p, s] as const] : [];
  });
  let big: (typeof shapes)[number] | undefined;
  for (const e of shapes) if (!big || e[1].areaPx > big[1].areaPx) big = e;
  if (!big) return null;
  const cx = big[1].centroid[0];
  // Unwrap x about the largest shape, so a group across the antimeridian stays together.
  const unwrap = (x: number) => {
    const d = (((x - cx) % FRAME_WIDTH) + FRAME_WIDTH) % FRAME_WIDTH;
    return cx + (d > FRAME_WIDTH / 2 ? d - FRAME_WIDTH : d);
  };
  const area = shapes.reduce((t, [, s]) => t + s.areaPx, 0);
  const mx = weightedMedian(shapes.map(([, s]) => [unwrap(s.centroid[0]), s.areaPx]));
  const my = weightedMedian(shapes.map(([, s]) => [s.centroid[1], s.areaPx]));
  let best: (typeof shapes)[number] | undefined;
  let bestD = Infinity;
  for (const e of shapes) {
    const d = (unwrap(e[1].label[0]) - mx) ** 2 + (e[1].label[1] - my) ** 2;
    if (d < bestD || (d === bestD && best && e[0] < best[0])) {
      best = e;
      bestD = d;
    }
  }
  return best ? [best[1].label, area] : null;
}

function sorted(v: [Anchor, number][]): Anchor[] {
  v.sort(
    (a, b) =>
      KIND_ORDER[a[0].kind] - KIND_ORDER[b[0].kind] || totalCmp(b[0].weight, a[0].weight) || a[1] - b[1],
  );
  return v.map(([a]) => a);
}

/** Every anchor of the map (Rust `LabelAnchors::build`). */
export function buildAnchors(
  model: Pick<MapModel, "shapes">,
  statics: Pick<MapStaticView, "provinces" | "key_cities" | "regions">,
  places: PlacesView,
): LabelAnchors {
  const byCountry: number[][] = places.countries.map(() => []);
  for (const p of statics.provinces) byCountry[p.country]?.push(p.id);
  const world: [Anchor, number][] = [];
  byCountry.forEach((ps, i) => {
    const g = groupAnchor(model, ps);
    const name = places.countries[i]?.name;
    if (g && name !== undefined)
      world.push([{ kind: "Country", text: name, at: g[0], weight: g[1], area: g[1] }, i]);
  });
  const country: [Anchor, number][] = [];
  statics.key_cities.forEach((k, i) => {
    // A key city sits on its first province's label point; its weight is its rank in the file.
    const first = k.provinces[0];
    const s = first === undefined ? null : model.shapes[first];
    if (s) country.push([{ kind: "KeyCity", text: k.name, at: s.label, weight: -i, area: s.areaPx }, i]);
  });
  statics.regions.forEach((r, i) => {
    if (r.name === "") return;
    const g = groupAnchor(model, r.provinces);
    if (g) country.push([{ kind: "Region", text: r.name, at: g[0], weight: g[1], area: g[1] }, i]);
  });
  const province: [Anchor, number][] = [];
  for (const p of places.provinces) {
    const s = model.shapes[p.id];
    if (s)
      province.push([
        { kind: "Province", text: p.name, at: s.label, weight: s.areaPx, area: s.areaPx },
        p.id,
      ]);
  }
  return { World: sorted(world), Country: sorted(country), Province: sorted(province) };
}

/**
 * The labels shown for the viewport (Rust `place`): the zoom level's anchors in priority order,
 * each kept if its padded box is inside the view and overlaps none kept before it nor any
 * `blocked` rectangle (D706).
 */
export function placeLabels(
  anchors: LabelAnchors,
  vp: Viewport,
  fontScale: number,
  blocked: readonly Rect[],
): Placed[] {
  const level = zoomLevel(spanDeg(vp.view.zoom, vp.width));
  const boxes: Rect[] = [...blocked];
  const out: Placed[] = [];
  const pxArea = pxPerBitmapPx(vp.view.zoom) ** 2;
  for (const a of anchors[level]) {
    if (a.area * pxArea < LABEL_MIN_AREA[a.kind]) continue;
    const at = toScreen(vp, a.at);
    const b = labelBox(a.kind, a.text, at, fontScale);
    if (b[0] < 0 || b[1] < 0 || b[2] > vp.width || b[3] > vp.height) continue;
    const pb = pad(b);
    if (boxes.some((o) => overlaps(o, pb))) continue;
    boxes.push(pb);
    out.push({ kind: a.kind, text: a.text, at });
  }
  return out;
}
