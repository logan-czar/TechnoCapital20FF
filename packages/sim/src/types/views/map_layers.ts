// v_map_layers (crates/sim/src/views/map_layers.rs): `get_map_layer(mode, param)` (spec 9.2, 8
// Map row): a value per province ordinal plus a legend, which the map writes into its
// per-province colour table (M8). Rebuilt monthly, at the plan lock and on load like the company
// views it shows (spec 9.4 "v_map_layers (industry assets, HQs)"; D159), and when Omniscient is
// toggled (D423).
//
// The modes (spec 8 Map row; D700): Political (country, contested provinces hatched),
// Development (Commerce, Industry, Population or Total), Industry (the Industry track, or a
// picked industry's business assets by province), Company HQs (pins sized by revenue and coloured
// by sector, filtered by industry, country and listing) and Financial zones (each province shaded
// by its zone's current effect, a pin on each hub city). The view keeps what is its own
// (countries, the shown unit assets, the HQ list); the zone mode also reads v_cycle and
// v_exchanges, so `SimViews::get_map_layer` serves every mode and `map_layer_versions` names the
// views a mode reads.
//
// Bands (D420): a unit's assets and a company's revenue TTM are the figures v_units and
// v_company_row show: a band's estimate (`Figure::shown`) for a company that does not publish,
// never its truth, so neither a province's heat nor a pin's size can give a private figure away
// (D701).
//
// Not ported: DevTrack::name and ::max, HqFilter::admits, MapMode::name, MapLayersView::zone_of,
// ::get_map_layer, ::layer, ::track_layer, the legend helpers (D702 scale) and the `ViewData`
// build (logic). MapLayersView's Rust-private fields (country_names, tracks, industry_names) are
// kept: they are the data `layer` reads.

import type { CompanyId, CountryId, IndustryId, ProvinceId, ZoneId } from "../ids.ts";
import type { Figure } from "./estimate.ts";

/** A development track (spec 3.3), or their sum. Default `Total`. */
export type DevTrack = "Commerce" | "Industry" | "Population" | "Total";

/** Every track, in Rust `DevTrack::ALL` order (the name of each is its value). */
export const DEV_TRACK_VALUES = ["Commerce", "Industry", "Population", "Total"] as const;

/** A development track's top value (spec 3.3: 1 to 30); the total's is 3 × this. */
export const TRACK_MAX = 30.0;

/** The Company HQs filters (spec 8: by industry, country, listed); null lets every one in. */
export interface HqFilter {
  industry: IndustryId | null;
  country: CountryId | null;
  /** `true` listed companies only, `false` private ones only. */
  listed: boolean | null;
}

/** A map mode with its parameter (spec 8 Map row, 9.2 `get_map_layer(mode, param)`). Default Political. */
export type MapMode =
  /** Provinces coloured by country (the default). */
  | { kind: "Political" }
  /** A development track as a heat map. */
  | { kind: "Development"; track: DevTrack }
  /** null: the Industry track; an id: that industry's business assets by province. */
  | { kind: "Industry"; industry: IndustryId | null }
  /** HQ pins sized by revenue and coloured by sector, over muted countries. */
  | { kind: "CompanyHqs"; filter: HqFilter }
  /** Each province shaded by its zone's current effect, with a pin on each hub city. */
  | { kind: "FinancialZones" };

/** A layer's values by province ordinal (spec 9: `Vec<f32>` or `Vec<u32>`). */
export type LayerValues =
  /** A category per province (Political and Company HQs: the country ordinal), u32. */
  | { kind: "Categories"; values: number[] }
  /** A number per province (the heat maps and the zone effect), f32 (round with Math.fround). */
  | { kind: "Scalars"; values: number[] };

/** How the map colours a layer's values. */
export type LayerStyle =
  /** A colour per category (country). */
  | "Political"
  /** The countries' colours, dimmed under pins (Company HQs). */
  | "Muted"
  /** A sequential ramp from the scale's low to its high end. */
  | "Sequential"
  /** A ramp through zero: below in one hue, above in another (the zone effect). */
  | "Diverging";

/** What a scalar layer's numbers are. */
export type ScaleUnit =
  /** Development points. */
  | "Points"
  /** USD. */
  | "Money"
  /** A yearly rate (the zone effect). */
  | "Rate";

/**
 * A scalar layer's scale: the values run from `low` to `high` (a diverging one is symmetric
 * about zero).
 */
export interface LayerScale {
  low: number;
  high: number;
  unit: ScaleUnit;
  label: string;
}

/** One legend row: a category (or a scalar's stop) and its label. */
export interface LegendEntry {
  value: number;
  label: string;
}

/** What a pin stands for. */
export type PinTarget =
  /** A company's HQ. */
  | { kind: "Company"; company: CompanyId }
  /** A zone exchange's hub city. */
  | { kind: "Exchange"; zone: ZoneId };

/** A pin at a province's label point. */
export interface MapPin {
  province: ProvinceId;
  target: PinTarget;
  /**
   * What sizes it: an HQ's revenue TTM as shown (an estimate for a company that does not
   * publish, D701); 0 for a hub.
   */
  size: number;
  /** Its colour category: an HQ's sector (index into the legend), a hub's zone ordinal. */
  category: number;
  /** A hub's exchange code (empty for an HQ). */
  code: string;
  /** A hub's headline index level (v_exchanges), if it has one. */
  level: number | null;
}

/** What `get_map_layer` returns. */
export interface MapLayer {
  mode: MapMode;
  values: LayerValues;
  style: LayerStyle;
  /** A scalar layer's scale. */
  scale: LayerScale | null;
  /** By province ordinal: drawn hatched (contested, decision C). */
  hatched: boolean[];
  /** The categories shown (Political: countries; Company HQs: sectors). */
  legend: LegendEntry[];
  pins: MapPin[];
  /**
   * Extra legend lines: a label and its value (the zone mode's global phase, g_t and
   * quarters left).
   */
  notes: [string, string][];
}

/** The Political layer. */
export interface PoliticalLayer {
  /** By province ordinal. */
  country: CountryId[];
  /** By province ordinal: the province has a `contested` tag. */
  contested: boolean[];
}

/** One company HQ, as the Company HQs mode pins it. */
export interface HqRow {
  company: CompanyId;
  province: ProvinceId;
  industry: IndustryId;
  country: CountryId;
  /** Index into `MapLayersView.sectors`. */
  sector: number;
  listed: boolean;
  /** Revenue TTM as v_company_row shows it (D701). */
  revenue: Figure;
}

/** One business unit's assets as v_units shows them (D701). */
export interface UnitAssets {
  industry: IndustryId;
  province: ProvinceId;
  gross_assets: Figure;
}

export interface MapLayersView {
  political: PoliticalLayer;
  /** Country names by ordinal, for the Political legend. Private in Rust. */
  country_names: string[];
  /**
   * By province ordinal: its development tracks (spec 3.3), [commerce, industry, population].
   * Private in Rust.
   */
  tracks: [number, number, number][];
  /** By province ordinal: its country's financial zone (spec 3.2.1). */
  zone: ZoneId[];
  /** Every unit of a company still in the game, in unit id order. */
  unit_assets: UnitAssets[];
  /** Every company still in the game, in id order. */
  hqs: HqRow[];
  /** The sector names, sorted. */
  sectors: string[];
  /** Industry names by ordinal, for the Industry legend. Private in Rust. */
  industry_names: string[];
}
