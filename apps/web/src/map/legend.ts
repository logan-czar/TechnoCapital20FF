// The map legend's content (crates/game/src/map/modes.rs `legend_doc`; spec 8 Map row; D702):
// from the layer alone, which the views served (D701), so the leak test reads exactly what the
// panel shows (D705). Pure, tested in node.

import {
  type LayerScale,
  type LayerStyle,
  type MapLayer,
  type MapMode,
  mapModeName,
  type ScaleUnit,
} from "@tc20ff/sim";
import { signed } from "../links/cards.ts";
import { fixed, int, money } from "../widgets/cells.ts";
import { HATCH_SWATCH, METRO_SWATCH, type Rgb, scalarColor, sectorColor, unitOf } from "./colors.ts";

/** Legend swatches in a scale. */
export const SCALE_STOPS = 5;

/** The legend's lines: a title, then rows of a swatch (if any) and a text. */
export interface LegendDoc {
  title: string;
  rows: [Rgb | null, string][];
}

/** A scale's value as the legend writes it. */
export function scaleValue(unit: ScaleUnit, v: number): string {
  switch (unit) {
    case "Points":
      return fixed(v, 0);
    case "Money":
      return money(v);
    case "Rate":
      return signed(v, 3);
  }
}

function scaleRows(style: LayerStyle, s: LayerScale, mode: MapMode): [Rgb | null, string][] {
  const out: [Rgb | null, string][] = [];
  for (let i = SCALE_STOPS - 1; i >= 0; i--) {
    const v = s.low + (s.high - s.low) * (i / (SCALE_STOPS - 1));
    out.push([scalarColor(style, mode, unitOf(s, Math.fround(v))), scaleValue(s.unit, v)]);
  }
  return out;
}

/** The legend of a layer (Rust `legend_doc`). */
export function legendDoc(layer: MapLayer, metros: boolean): LegendDoc {
  const rows: [Rgb | null, string][] = [];
  let title = mapModeName(layer.mode);
  switch (layer.style) {
    case "Political":
      title = `${title}: provinces by country`;
      rows.push([null, `${int(layer.legend.length)} countries, a colour each`]);
      break;
    case "Muted":
      title = `${title}: pins sized by revenue TTM`;
      for (const e of layer.legend) rows.push([sectorColor(e.value), e.label]);
      rows.push([null, `${int(layer.pins.length)} HQs shown`]);
      rows.push([null, "Private: sized by the estimate"]);
      break;
    case "Sequential":
    case "Diverging":
      if (layer.scale !== null) {
        title = layer.scale.label;
        rows.push(...scaleRows(layer.style, layer.scale, layer.mode));
      }
      for (const [k, v] of layer.notes) rows.push([null, `${k}: ${v}`]);
      if (layer.mode.kind === "FinancialZones")
        rows.push([null, `${layer.pins.length} hubs: exchange and index level`]);
      break;
  }
  // Every mode hatches the contested provinces and can show the Metro outlines (D702).
  rows.push([HATCH_SWATCH, "Contested (hatched)"]);
  if (metros) rows.push([METRO_SWATCH, "Metro outline"]);
  return { title, rows };
}
