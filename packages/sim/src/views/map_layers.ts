// v_map_layers: `get_map_layer(mode, param)` (spec 9.2, 8 Map row): a value per province ordinal
// plus a legend, which the map writes into the shader's per-province colour table (M8). Rebuilt
// monthly, at the plan lock and on load like the company views it shows (spec 9.4 "v_map_layers
// (industry assets, HQs)"; D159), and when Omniscient is toggled (D423). Ported from
// crates/sim/src/views/map_layers.rs; the types are in types/views/map_layers.ts.
//
// The modes (spec 8 Map row; D700): Political (country, contested provinces hatched),
// Development (Commerce, Industry, Population or Total), Industry (the Industry track, or a
// picked industry's business assets by province), Company HQs (pins sized by revenue and coloured
// by sector, filtered by industry, country and listing) and Financial zones (each province shaded
// by its zone's current effect, a pin on each hub city). The view keeps what is its own
// (countries, the shown unit assets, the HQ list); the zone mode also reads v_cycle and
// v_exchanges, so `simViewsGetMapLayer` serves every mode and `simViewsMapLayerVersions` names
// the views a mode reads.
//
// Bands (D420). A unit's assets and a company's revenue TTM are the figures v_units and
// v_company_row show: a band's estimate (`Figure::shown`) for a company that does not publish,
// never its truth, so neither a province's heat nor a pin's size can give a private figure away
// (D701).

import { companyFinanceInGame, companyFinanceStatus } from "../finance/state.ts";
import type { CompanyId, CountryId, IndustryId, ProvinceId, ZoneId } from "../types/ids.ts";
import { cmpStr, maxF, minF } from "../types/num.ts";
import type { CycleView } from "../types/views/cycle.ts";
import type { ExchangesView } from "../types/views/exchanges.ts";
import {
  type DevTrack,
  type HqFilter,
  type HqRow,
  type LayerScale,
  type LayerStyle,
  type LayerValues,
  type LegendEntry,
  type MapLayer,
  type MapLayersView,
  type MapMode,
  type MapPin,
  TRACK_MAX,
  type UnitAssets,
} from "../types/views/map_layers.ts";
import { cyclePhaseName } from "../world/economy.ts";
import { revenueTtm } from "./company_rows.ts";
import { estimatorCompanyNow, figureShown, viewInputEstimator } from "./estimate.ts";
import type { ViewInput } from "./index.ts";
import { estimatedIndustries, unitBanded } from "./industry_rows.ts";

/** Rust `DevTrack::name`: equals the variant. */
export function devTrackName(t: DevTrack): string {
  return t;
}

/** Rust `DevTrack::max`: the track's top value: 30 a track, 90 for the total (spec 3.3). */
export function devTrackMax(t: DevTrack): number {
  return t === "Total" ? 3.0 * TRACK_MAX : TRACK_MAX;
}

/** Rust `HqFilter::admits`. */
export function hqFilterAdmits(f: HqFilter, h: HqRow): boolean {
  return (
    (f.industry === null || f.industry === h.industry) &&
    (f.country === null || f.country === h.country) &&
    (f.listed === null || f.listed === h.listed)
  );
}

/** Rust `MapMode::name`: the mode's name, without its parameter. */
export function mapModeName(m: MapMode): string {
  switch (m.kind) {
    case "Political":
      return "Political";
    case "Development":
      return "Development";
    case "Industry":
      return "Industry";
    case "CompanyHqs":
      return "Company HQs";
    case "FinancialZones":
      return "Financial zones";
  }
}

/** Rust `MapLayersView::zone_of`: a province's zone. */
export function mapLayersViewZoneOf(v: MapLayersView, p: ProvinceId): ZoneId | null {
  return v.zone[p] ?? null;
}

/**
 * Rust `format!("{:+.3}")`: a sign always, three decimals. An exact tie (x = j / 16 with j odd,
 * where x * 1000 is a half-integer) rounds to even in Rust, to the larger in JS toFixed.
 */
function fmtSigned3(x: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  let s: string;
  const k = a * 16;
  if (Number.isInteger(k) && k % 2 === 1) {
    const lo = Math.floor(a * 1000);
    const even = lo % 2 === 0 ? lo : lo + 1;
    s = (even / 1000).toFixed(3);
  } else {
    s = a.toFixed(3);
  }
  return (neg ? "-" : "+") + s;
}

/** Rust `MapLayersView::get_map_layer`: the modes this view serves alone (Financial zones shows no effect). */
export function mapLayersViewGetMapLayer(v: MapLayersView, mode: MapMode): MapLayer {
  return mapLayersViewLayer(v, mode, null);
}

function base(v: MapLayersView, mode: MapMode, values: LayerValues, style: LayerStyle): MapLayer {
  return {
    mode,
    values,
    style,
    scale: null,
    hatched: [...v.political.contested],
    legend: [],
    pins: [],
    notes: [],
  };
}

/** Every country that has a province, in ordinal order, named. */
function countryLegend(v: MapLayersView): LegendEntry[] {
  const present = [...new Set<CountryId>(v.political.country)].sort((a, b) => a - b);
  return present.map((c) => ({ value: c, label: v.country_names[c] ?? "" }));
}

function countries(v: MapLayersView): LayerValues {
  return { kind: "Categories", values: [...v.political.country] };
}

/** Rust `MapLayersView::layer`: every mode, the Financial zones one with `zones` (v_cycle, v_exchanges). */
export function mapLayersViewLayer(
  v: MapLayersView,
  mode: MapMode,
  zones: readonly [CycleView, ExchangesView] | null,
): MapLayer {
  switch (mode.kind) {
    case "Political": {
      const l = base(v, mode, countries(v), "Political");
      l.legend = countryLegend(v);
      return l;
    }
    case "Development":
      return trackLayer(v, mode, mode.track);
    case "Industry": {
      if (mode.industry === null) return trackLayer(v, mode, "Industry");
      const i: IndustryId = mode.industry;
      // Spec 8: the industry's business assets by province, as shown (D701).
      const vals: number[] = new Array<number>(v.political.country.length).fill(0.0);
      for (const u of v.unit_assets) {
        if (u.industry !== i) continue;
        if (u.province < vals.length) {
          vals[u.province] = (vals[u.province] as number) + maxF(figureShown(u.gross_assets), 0.0);
        }
      }
      let high = 0.0;
      for (const x of vals) high = maxF(high, x);
      const l = base(v, mode, { kind: "Scalars", values: vals.map((x) => Math.fround(x)) }, "Sequential");
      const name = v.industry_names[i] ?? "";
      l.scale = { low: 0.0, high, unit: "Money", label: `${name}: business assets by province` };
      return l;
    }
    case "CompanyHqs": {
      const f = mode.filter;
      const l = base(v, mode, countries(v), "Muted");
      l.legend = v.sectors.map((s, i) => ({ value: i, label: s }));
      l.pins = v.hqs
        .filter((h) => hqFilterAdmits(f, h))
        .map(
          (h): MapPin => ({
            province: h.province,
            target: { kind: "Company", company: h.company },
            size: figureShown(h.revenue),
            category: h.sector,
            code: "",
            level: null,
          }),
        );
      return l;
    }
    case "FinancialZones": {
      const effects: number[] = [];
      if (zones !== null) {
        for (const z of zones[0].zones) {
          const i = z.id;
          while (effects.length <= i) effects.push(0.0);
          effects[i] = z.effect;
        }
      }
      const vals = v.zone.map((z) => Math.fround(effects[z] ?? 0.0));
      let reach = 0.0;
      for (const e of effects) reach = maxF(reach, Math.abs(e));
      const l = base(v, mode, { kind: "Scalars", values: vals }, "Diverging");
      l.scale = {
        low: -reach,
        high: reach,
        unit: "Rate",
        label: "Zone effect: intensity x g(t - lag), a year (5.1)",
      };
      if (zones !== null) {
        const [c, x] = zones;
        l.notes = [
          ["Global phase", cyclePhaseName(c.phase)],
          ["g_t", fmtSigned3(c.g_t)],
          ["Quarters left", String(c.quarters_left)],
        ];
        l.pins = x.exchanges.map(
          (e): MapPin => ({
            province: e.hub_province,
            target: { kind: "Exchange", zone: e.zone },
            size: 0.0,
            category: e.zone,
            code: e.code,
            level: e.level,
          }),
        );
      }
      return l;
    }
  }
}

function trackLayer(v: MapLayersView, mode: MapMode, t: DevTrack): MapLayer {
  const vals = v.tracks.map(([c, i, p]) =>
    Math.fround(t === "Commerce" ? c : t === "Industry" ? i : t === "Population" ? p : c + i + p),
  );
  // The scale spans the tracks present (within 0 and the track's top), so the ramp uses its
  // whole range (D702).
  let low = devTrackMax(t);
  let high = 0.0;
  v.tracks.forEach((tr, k) => {
    if (!tr.some((x) => x > 0)) return;
    const x = vals[k] as number;
    low = minF(low, x);
    high = maxF(high, x);
  });
  if (!(high > low)) {
    low = 0.0;
    high = devTrackMax(t);
  }
  const l = base(v, mode, { kind: "Scalars", values: vals }, "Sequential");
  const scale: LayerScale = {
    low,
    high,
    unit: "Points",
    label: `${devTrackName(t)} development (3.3)`,
  };
  l.scale = scale;
  return l;
}

/** Rust `impl ViewData for MapLayersView`: `build`. */
export function buildMapLayers(input: ViewInput): MapLayersView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const contested = w.provinces.map((_, i) => {
    const s = input.map.provinces[i];
    return s !== undefined && s.contested !== null;
  });
  const tracks = w.provinces.map((_, i): [number, number, number] => {
    const s = input.map.provinces[i];
    return s === undefined ? [0, 0, 0] : [s.commerce, s.industry, s.population];
  });
  const removed = (c: CompanyId): boolean =>
    companyFinanceStatus((w.companies[c] as (typeof w.companies)[number]).finance) === "Removed";
  const classes = estimatedIndustries(est, w);
  const unit_assets: UnitAssets[] = [];
  for (const u of w.units) {
    if (removed(u.company)) continue;
    // As v_units shows it (D420, D436).
    const banded = unitBanded(est, w, classes, u.company, u.industry);
    unit_assets.push({
      industry: u.industry,
      province: u.base_province,
      gross_assets: estimatorCompanyNow(est, banded, u.company, { kind: "GrossAssets" }, u.gross_assets),
    });
  }
  const sorted = w.industries.map((i) => i.sector).sort(cmpStr);
  const sectors = sorted.filter((s, i) => i === 0 || sorted[i - 1] !== s);
  const hqs: HqRow[] = [];
  w.companies.forEach((c, i) => {
    if (!companyFinanceInGame(c.finance)) return;
    const id = i as CompanyId;
    const sector = sectors.indexOf((w.industries[c.industry] as (typeof w.industries)[number]).sector);
    hqs.push({
      company: id,
      province: c.hq_province,
      industry: c.industry,
      country: c.hq_country,
      sector: sector < 0 ? 0 : sector,
      listed: c.public,
      revenue: revenueTtm(est, w, id),
    });
  });
  return {
    political: { country: w.provinces.map((p) => p.country), contested },
    country_names: w.countries.map((c) => c.name),
    tracks,
    zone: w.provinces.map((p) => (w.countries[p.country] as (typeof w.countries)[number]).zone),
    unit_assets,
    hqs,
    sectors,
    industry_names: w.industries.map((i) => i.name),
  };
}
