// Province fill colors (crates/game/src/map/colors.rs, D638, D702), on the flat dark style:
// Political a muted hue per country; Company HQs the same, dimmed under the pins; the Development
// and Industry heat maps a ramp from the dark panel grey to the mode's accent (green for
// development, amber for an industry's assets, money by square root so small holdings show); the
// Financial zones a diverging ramp through the panel grey, magenta below zero and cyan above
// (spec 11.4's loss and gain).

import type { LayerScale, LayerStyle, MapLayer, MapMode } from "@tc20ff/sim";
import type { MapModel } from "./model.ts";

/** Golden-ratio steps round the hue wheel from the country ordinal, so neighbours in code order differ. */
const GOLDEN = 0.618034;
const LIGHTNESS = [0.27, 0.32, 0.37] as const;
const SATURATION = 0.32;

export type Rgb = readonly [number, number, number];

/** The theme's accents (styles.css; Rust ui::theme::color). */
export const CYAN: Rgb = [0x00, 0xe5, 0xff];
export const MAGENTA: Rgb = [0xff, 0x2b, 0xd6];
export const AMBER: Rgb = [0xff, 0xb0, 0x00];
export const GREEN: Rgb = [0x39, 0xff, 0x88];
export const TEXT: Rgb = [0xe6, 0xe8, 0xee];
export const TEXT_MUTED: Rgb = [0x8d, 0x98, 0xae];
export const PANEL_RAISED: Rgb = [0x1e, 0x24, 0x30];

/** The legend's swatch for hatched (contested) provinces. */
export const HATCH_SWATCH: Rgb = [120, 40, 104];
/** The legend's swatch for the Metro outlines (amber, as the map draws them). */
export const METRO_SWATCH: Rgb = [255, 176, 0];
/** How much of the countries' color the Company HQs mode keeps under its pins (D702). */
export const MUTED_SHARE = 0.45;
/** A heat map's low end (the panel grey, a little lifted) and the zone ramp's neutral (D702). */
export const RAMP_LOW: Rgb = [24, 30, 42];
export const RAMP_NEUTRAL: Rgb = [40, 46, 58];
/** How far a heat map's top value goes towards the accent (D702). */
export const RAMP_REACH = 0.85;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.floor(v * 255 + 0.5)) as [number, number, number];
}

/** The color of country ordinal `country`. Deterministic: a pure function of the ordinal. */
export function countryColor(country: number): Rgb {
  const hue = ((country * GOLDEN) % 1) * 360;
  const light = LIGHTNESS[(country * 7) % 3] as number;
  return hslToRgb(hue, SATURATION, light);
}

/** An HQ pin's color by its sector's index (D702): bright, evenly spaced hues, so seven sectors read apart. */
export function sectorColor(sector: number): Rgb {
  return hslToRgb((sector * (360 / 7) + 18) % 360, 0.85, 0.62);
}

/** `a` towards `b` by `t` (clamped to 0..1), rounded. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const u = Math.min(1, Math.max(0, t));
  const m = (x: number, y: number) => Math.floor(x + (y - x) * u + 0.5);
  return [m(a[0], b[0]), m(a[1], b[1]), m(a[2], b[2])];
}

/** Where `v` sits on a scale: 0 to 1 (sequential; money by square root), or -1 to 1 (diverging). */
export function unitOf(s: LayerScale, v: number): number {
  const { low, high } = s;
  if (low < 0 && high > 0) return Math.min(1, Math.max(-1, v / high));
  if (high <= low) return 0;
  const t = Math.min(1, Math.max(0, (v - low) / (high - low)));
  return s.unit === "Money" ? Math.sqrt(t) : t;
}

/** A heat map's accent: amber for an industry's assets, green otherwise (D702). */
function accent(mode: MapMode): Rgb {
  return mode.kind === "Industry" && mode.industry !== null ? AMBER : GREEN;
}

/** A scalar's color at `t` from `unitOf`. */
export function scalarColor(style: LayerStyle, mode: MapMode, t: number): Rgb {
  if (style === "Diverging") return mix(RAMP_NEUTRAL, t < 0 ? MAGENTA : CYAN, Math.abs(t) * RAMP_REACH);
  return mix(RAMP_LOW, accent(mode), t * RAMP_REACH);
}

/** RGB triples by province ordinal (a flat array, 3 bytes a province), colored by country. */
export function politicalColors(model: Pick<MapModel, "countryOf">): Uint8Array {
  const out = new Uint8Array(model.countryOf.length * 3);
  const palette = new Map<number, Rgb>();
  model.countryOf.forEach((c, i) => {
    let rgb = palette.get(c);
    if (!rgb) {
      rgb = countryColor(c);
      palette.set(c, rgb);
    }
    out.set(rgb, i * 3);
  });
  return out;
}

/**
 * The fill of every province for `layer` (Rust `colors::table`), 3 bytes a province ordinal. A
 * province the layer does not cover (a shorter values array) is black.
 */
export function layerColors(layer: MapLayer, provinces: number): Uint8Array {
  const out = new Uint8Array(provinces * 3);
  const v = layer.values;
  const memo = new Map<number, Rgb>();
  for (let o = 0; o < provinces; o++) {
    let rgb: Rgb = [0, 0, 0];
    if (v.kind === "Categories") {
      const c = v.values[o];
      if (c !== undefined) {
        let m = memo.get(c);
        if (!m) {
          m = layer.style === "Muted" ? mix(RAMP_LOW, countryColor(c), MUTED_SHARE) : countryColor(c);
          memo.set(c, m);
        }
        rgb = m;
      }
    } else {
      const x = v.values[o] ?? 0;
      const t = layer.scale === null ? 0 : unitOf(layer.scale, x);
      rgb = scalarColor(layer.style, layer.mode, t);
    }
    out.set(rgb, o * 3);
  }
  return out;
}
