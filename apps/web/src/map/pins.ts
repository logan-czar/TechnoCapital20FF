// Map pins (crates/game/src/map/pins.rs; spec 8 Map row; D703): the Company HQs mode's pins,
// sized by revenue TTM as v_map_layers shows it (an estimate for a company that does not publish,
// never its truth, D701) and colored by sector, and the Financial zones mode's pin on each hub
// city with its exchange code and headline index level. A pin sits at its province's label point;
// several HQs in one province spread round it on a sunflower, the largest in the middle. Pure,
// tested in node; the map draws them as deck layers.

import type { MapPin, PinTarget } from "@tc20ff/sim";
import { totalCmp } from "@tc20ff/sim";
import { number } from "../widgets/cells.ts";

/** The smallest and largest HQ pin, logical pixels (D703). */
export const PIN_MIN_PX = 4.0;
export const PIN_MAX_PX = 18.0;
/** The revenue a pin's growth is measured in: diameter = min + step × ln(1 + revenue / this) (D703). */
export const PIN_REVENUE_UNIT_USD = 100.0e6;
export const PIN_LOG_STEP_PX = 2.4;
/** A hub pin's dot. */
export const HUB_PIN_PX = 9.0;
/** The sunflower's spacing between pins of one province, logical pixels. */
export const PIN_SPREAD_PX = 4.0;
const GOLDEN_ANGLE = 2.399963;

/** An HQ pin's diameter from the revenue it shows (D703): logarithmic, so a $100bn company is larger than a $1bn one without hiding the map. */
export function pinPx(revenueShown: number): number {
  const r = Math.max(revenueShown, 0) / PIN_REVENUE_UNIT_USD;
  return Math.min(PIN_MAX_PX, Math.max(PIN_MIN_PX, PIN_MIN_PX + PIN_LOG_STEP_PX * Math.log1p(r)));
}

/** The offset in logical pixels (y down) of the `i`th pin of a province (0 in the middle), on a sunflower. */
export function spread(i: number): [number, number] {
  if (i === 0) return [0, 0];
  const r = PIN_SPREAD_PX * Math.sqrt(i) * 1.6;
  const a = i * GOLDEN_ANGLE;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

/** A pin placed: the layer's pin, its offset from the label point (px, y down) and its diameter (px). */
export interface PlacedPin {
  pin: MapPin;
  offset: [number, number];
  diameter: number;
}

function targetKey(t: PinTarget): [number, number] {
  return t.kind === "Company" ? [0, t.company] : [1, t.zone];
}

/** Every pin of the layer with its offset and diameter (Rust `layout`): by province, largest first, ties to the lower id. */
export function pinLayout(pins: readonly MapPin[]): PlacedPin[] {
  const sorted = [...pins].sort((a, b) => {
    if (a.province !== b.province) return a.province - b.province;
    const s = totalCmp(b.size, a.size);
    if (s !== 0) return s;
    const [ka, ia] = targetKey(a.target);
    const [kb, ib] = targetKey(b.target);
    return ka !== kb ? ka - kb : ia - ib;
  });
  const out: PlacedPin[] = [];
  let i = 0;
  let last: number | null = null;
  for (const p of sorted) {
    if (last !== p.province) {
      i = 0;
      last = p.province;
    }
    const diameter = p.target.kind === "Company" ? pinPx(p.size) : HUB_PIN_PX;
    out.push({ pin: p, offset: spread(i), diameter });
    i += 1;
  }
  return out;
}

/** A hub pin's label: its exchange code and headline index level. */
export function hubLabel(p: MapPin): string {
  return p.level === null ? `${p.code} -` : `${p.code} ${number(p.level)}`;
}
