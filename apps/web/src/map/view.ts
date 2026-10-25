// Map frame and camera limits. The frame matches the Rust bitmap (crates/mapgen/src/miller.rs):
// Miller units with x = longitude in radians (so 2 pi wide), a 2:1 frame topped at LAT_MAX_DEG.
// Pure maths, tested in node.

export const LAT_MAX_DEG = 84;
export const FRAME_WIDTH = 2 * Math.PI;
export const FRAME_HEIGHT = Math.PI;

/** Miller y for a latitude in degrees (crates/mapgen/src/miller.rs `miller_y`). */
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

/** The pixels of the Rust 8192 x 4096 bitmap frame (province-centroids.csv columns) as Miller units. */
export const BITMAP_WIDTH = 8192;
export function pxToMiller(x: number, y: number): [number, number] {
  const perPx = FRAME_WIDTH / BITMAP_WIDTH;
  return [x * perPx - Math.PI, FRAME_TOP - y * perPx];
}
