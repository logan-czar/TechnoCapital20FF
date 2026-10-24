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

/** The zoom at which the whole frame fits the viewport. */
export function fitZoom(width: number, height: number): number {
  return Math.log2(Math.min(width / FRAME_WIDTH, height / FRAME_HEIGHT));
}

export function initialView(width: number, height: number): MapViewState {
  return { target: [0, FRAME_CENTER_Y, 0], zoom: fitZoom(width, height) };
}

/** Clamps the zoom to [fit, MAX_ZOOM] and the target so the view never leaves the frame. */
export function clampView(view: MapViewState, width: number, height: number): MapViewState {
  const zoom = Math.min(MAX_ZOOM, Math.max(fitZoom(width, height), view.zoom));
  const scale = 2 ** zoom;
  const halfW = width / 2 / scale;
  const halfH = height / 2 / scale;
  const axis = (v: number, lo: number, hi: number, half: number) =>
    hi - lo <= 2 * half ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, v));
  return {
    zoom,
    target: [
      axis(view.target[0], -FRAME_WIDTH / 2, FRAME_WIDTH / 2, halfW),
      axis(view.target[1], FRAME_BOTTOM, FRAME_TOP, halfH),
      0,
    ],
  };
}
