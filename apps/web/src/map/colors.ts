// Province fill colors. One map mode for now: Political, a muted hue per country (the palette of
// the Rust game, crates/game/src/map/colors.rs `country_color`, D638).

import type { MapModel } from "./model.ts";

/** Golden-ratio steps round the hue wheel from the country ordinal, so neighbours in code order differ. */
const GOLDEN = 0.618034;
const LIGHTNESS = [0.27, 0.32, 0.37] as const;
const SATURATION = 0.32;

export type Rgb = readonly [number, number, number];

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
