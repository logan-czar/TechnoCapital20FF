// Map frame and camera limits. The frame matches mapgen's bitmap (apps/mapgen/src/miller.ts):
// Miller units with x = longitude in radians (so 2 pi wide), a 2:1 frame topped at LAT_MAX_DEG.
// Pure maths, tested in node.

export const LAT_MAX_DEG = 84;
export const FRAME_WIDTH = 2 * Math.PI;
export const FRAME_HEIGHT = Math.PI;

/** Miller y for a latitude in degrees (apps/mapgen/src/miller.ts `millerY`). */
export function millerY(latDeg: number): number {
  return 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * ((latDeg * Math.PI) / 180)));
}

export const FRAME_TOP = millerY(LAT_MAX_DEG);
export const FRAME_BOTTOM = FRAME_TOP - FRAME_HEIGHT;
export const FRAME_CENTER_Y = (FRAME_TOP + FRAME_BOTTOM) / 2;

/** The closest zoom is 4 screen pixels per bitmap pixel of the 8192-wide Rust map (camera.rs MAX_ZOOM_PX). */
const MAX_SCALE = (4 * 8192) / FRAME_WIDTH;
export const MAX_ZOOM = Math.log2(MAX_SCALE);

export interface MapViewState {
  target: [number, number, number];
  zoom: number;
}

/** The farthest zoom: the whole map width across the view (camera.rs `max_scale`). */
export function fitZoom(width: number, _height: number): number {
  return Math.log2(Math.max(width, 1) / FRAME_WIDTH);
}

/** Degrees of longitude the view spans across (camera.rs `span_deg`). */
export function spanDeg(zoom: number, width: number): number {
  return (width / 2 ** zoom / FRAME_WIDTH) * 360;
}

/** A view narrower than this many degrees is Province zoom (camera.rs PROVINCE_BELOW_DEG, D636). */
export const PROVINCE_BELOW_DEG = 28;

/** Province lines fade in from twice PROVINCE_BELOW_DEG towards it (render.rs `line_alphas`, D636). */
export function provinceLineAlpha(span: number): number {
  const far = PROVINCE_BELOW_DEG * 2;
  return Math.min(1, Math.max(0, (far - span) / (far - PROVINCE_BELOW_DEG)));
}

export function initialView(width: number, height: number): MapViewState {
  return clampView({ target: [0, FRAME_CENTER_Y, 0], zoom: -Infinity }, width, height);
}

/** x wrapped into [-pi, pi): the map repeats east to west. */
export function wrapX(x: number): number {
  const w = FRAME_WIDTH;
  return ((((x + w / 2) % w) + w) % w) - w / 2;
}

/**
 * Clamps the zoom to [fit, MAX_ZOOM], wraps x east to west, and keeps y inside the frame (or centred
 * on it when the whole height shows), as camera.rs `clamp` does.
 */
export function clampView(view: MapViewState, width: number, height: number): MapViewState {
  const zoom = Math.min(MAX_ZOOM, Math.max(fitZoom(width, height), view.zoom));
  const halfH = height / 2 / 2 ** zoom;
  const y =
    halfH * 2 >= FRAME_HEIGHT
      ? FRAME_CENTER_Y
      : Math.min(FRAME_TOP - halfH, Math.max(FRAME_BOTTOM + halfH, view.target[1]));
  return { zoom, target: [wrapX(view.target[0]), y, 0] };
}

/** A view wider than this many degrees is World zoom (camera.rs WORLD_ABOVE_DEG, D636). */
export const WORLD_ABOVE_DEG = 110;

/** The named zoom levels (spec 8 Map row: World, Country, Province), by the degrees the view spans. */
export type ZoomLevel = "World" | "Country" | "Province";

/** The zoom level of a view `span` degrees wide (camera.rs `level`). */
export function zoomLevel(span: number): ZoomLevel {
  return span > WORLD_ABOVE_DEG ? "World" : span < PROVINCE_BELOW_DEG ? "Province" : "Country";
}

/** One wheel notch, or a Q / E press, zooms by this factor (camera.rs WHEEL_STEP, D636). */
export const WHEEL_STEP = 1.25;
/** Keyboard panning, logical pixels a second (camera.rs KEY_PAN_PX_PER_S, D636). */
export const KEY_PAN_PX_PER_S = 900;

/** A view and the canvas size it is drawn at: what the screen projections need. */
export interface Viewport {
  view: MapViewState;
  width: number;
  height: number;
}

/** Screen pixels per bitmap pixel of mapgen's frame: the Rust camera's 1 / `scale` (D640, D706 thresholds). */
export function pxPerBitmapPx(zoom: number): number {
  return (2 ** zoom * FRAME_WIDTH) / BITMAP_WIDTH;
}

/** Where Miller point `p` shows on screen (y down): the copy nearest the centre (camera.rs `to_view`). */
export function toScreen(vp: Viewport, p: readonly [number, number]): [number, number] {
  const k = 2 ** vp.view.zoom;
  const dx = wrapX(p[0] - vp.view.target[0]);
  return [vp.width / 2 + dx * k, vp.height / 2 - (p[1] - vp.view.target[1]) * k];
}

/** The Miller point under screen point `s` (x wrapped into the frame; camera.rs `to_map`). */
export function toMap(vp: Viewport, s: readonly [number, number]): [number, number] {
  const k = 2 ** vp.view.zoom;
  return [
    wrapX(vp.view.target[0] + (s[0] - vp.width / 2) / k),
    vp.view.target[1] - (s[1] - vp.height / 2) / k,
  ];
}

/** The view zoomed by `steps` notches (positive in) about its centre, clamped (camera.rs `zoom`, Q / E). */
export function zoomBy(vp: Viewport, steps: number): MapViewState {
  return clampView(
    { target: vp.view.target, zoom: vp.view.zoom + steps * Math.log2(WHEEL_STEP) },
    vp.width,
    vp.height,
  );
}

/** The view panned by a screen delta (px, y down; the map moves with it), clamped (camera.rs `pan`). */
export function panBy(vp: Viewport, dx: number, dy: number): MapViewState {
  const k = 2 ** vp.view.zoom;
  return clampView(
    { target: [vp.view.target[0] - dx / k, vp.view.target[1] + dy / k, 0], zoom: vp.view.zoom },
    vp.width,
    vp.height,
  );
}

/** The pixels of mapgen's 8192 x 4096 bitmap frame (province-centroids.csv columns) as Miller units. */
export const BITMAP_WIDTH = 8192;
export function pxToMiller(x: number, y: number): [number, number] {
  const perPx = FRAME_WIDTH / BITMAP_WIDTH;
  return [x * perPx - Math.PI, FRAME_TOP - y * perPx];
}
