// Port of crates/sim/tests/m8_map_modes.rs: M8.5 map modes (spec 8 Map row, 9.2
// `get_map_layer(mode, param)`, 9.4; D700, D701): every mode's values come from the views, a
// private company's figures as the bands' estimates (never their truth), and each mode names the
// views it reads so the map redraws only when one of them moves.
//
// Expects:
//   ../../src/lib.ts                simNew, simApply, simStep, simViews
//   ../../src/views/index.ts        simViewsGetMapLayer(views, mode) -> MapLayer
//                                      [SimViews::get_map_layer], simViewsMapLayerVersions(views,
//                                      mode) -> number[] [SimViews::map_layer_versions: the
//                                      versions of the views the mode reads, [v_map_layers, ...]]
//   ../../src/views/map_layers.ts   devTrackName(track), devTrackMax(track) [DevTrack::name,
//                                      ::max], mapLayersViewZoneOf(view, province) -> ZoneId | null
//   (types: types/views/map_layers.ts; lookups are local helpers in ../common/views.ts)
//
// Changed from the Rust: scalar layers hold f32 values in Rust ("as f32"); the TS layer values are
// numbers that the builder rounds with Math.fround, so the comparisons are against
// Math.fround(want). Seed 1 is the new generator (D951); every figure checked comes from the load
// state or the bands built from it, not from a draw.
import { describe, expect, it } from "vitest";
import { simApply, simNew, simStep, simViews } from "../../src/lib.ts";
import type { IndustryId } from "../../src/types/ids.ts";
import type { SimViews } from "../../src/types/views/index.ts";
import {
  DEV_TRACK_VALUES,
  type HqFilter,
  type LayerValues,
  type MapMode,
} from "../../src/types/views/map_layers.ts";
import { simViewsGetMapLayer, simViewsMapLayerVersions } from "../../src/views/index.ts";
import { devTrackMax, devTrackName, mapLayersViewZoneOf } from "../../src/views/map_layers.ts";
import { data, unwrap } from "../common/index.ts";
import { byId, figIsBand, figShown, maxOf } from "../common/views.ts";

function scalars(v: LayerValues): readonly number[] {
  if (v.kind !== "Scalars") throw new Error("a scalar layer");
  return v.values;
}

const noFilter: HqFilter = { industry: null, country: null, listed: null };

describe("m8 map modes", () => {
  it("development_shows_each_track_and_the_total", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const v = simViews(sim);
    const cards = v.province_cards.data;
    for (const t of DEV_TRACK_VALUES) {
      const l = simViewsGetMapLayer(v, { kind: "Development", track: t });
      expect(l.style).toBe("Sequential");
      const s = l.scale;
      if (s === null) throw new Error("no scale");
      expect(s.unit).toBe("Points");
      expect(s.low >= 0.0 && s.high <= devTrackMax(t) && s.low < s.high).toBe(true);
      const vals = scalars(l.values);
      cards.cards.forEach((c, i) => {
        const want = { Commerce: c.commerce, Industry: c.industry, Population: c.population, Total: c.total }[
          t
        ];
        const x = vals[i] as number;
        expect(x, `${c.key} ${devTrackName(t)}`).toBe(Math.fround(want));
        expect(x >= s.low && x <= s.high).toBe(true);
      });
    }
    // The Industry mode with no industry picked is the Industry track.
    expect(simViewsGetMapLayer(v, { kind: "Industry", industry: null }).values).toEqual(
      simViewsGetMapLayer(v, { kind: "Development", track: "Industry" }).values,
    );
  });

  it("an_industry_s_assets_are_the_units_shown", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const v = simViews(sim);
    const units = v.units.data.units;
    let bandedSeen = false;
    for (let i = 0; i < v.industry_rows.data.rows.length; i++) {
      const id = i as IndustryId;
      const l = simViewsGetMapLayer(v, { kind: "Industry", industry: id });
      const vals = scalars(l.values);
      const want = new Array<number>(vals.length).fill(0.0);
      for (const u of units.filter((u) => u.industry === id)) {
        want[u.base_province] = (want[u.base_province] as number) + Math.max(figShown(u.gross_assets), 0.0);
        bandedSeen ||= figIsBand(u.gross_assets);
      }
      vals.forEach((got, p) => {
        expect(got, `industry ${i} province ${p}`).toBe(Math.fround(want[p] as number));
      });
      const s = l.scale;
      if (s === null) throw new Error("no scale");
      expect(s.unit).toBe("Money");
      expect(s.high).toBe(maxOf(want, 0.0));
    }
    expect(bandedSeen, "some units show bands").toBe(true);
  });

  it("hq_pins_are_sized_by_the_revenue_shown_and_filter", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const v = simViews(sim);
    const rows = v.company_rows.data.rows;
    const detail = v.company_detail.data;
    const l = simViewsGetMapLayer(v, { kind: "CompanyHqs", filter: noFilter });
    expect(l.style).toBe("Muted");
    expect(l.pins.length, "one pin per company in the game").toBe(rows.length);
    expect(l.legend.length, "the seven sectors").toBe(7);
    l.pins.forEach((pin, i) => {
      const r = rows[i];
      if (r === undefined) throw new Error("pin without a row");
      expect(pin.target).toEqual({ kind: "Company", company: r.id });
      expect(pin.size, r.name).toBe(figShown(r.revenue_ttm));
      expect(pin.province).toBe(byId(detail.companies, r.id)?.hq_province);
      const sector = byId(v.industry_rows.data.rows, r.industry)?.sector;
      expect(l.legend[pin.category]?.label).toBe(sector);
    });
    // Filters: industry, country, listed.
    const r0 = rows[0];
    if (r0 === undefined) throw new Error("no companies");
    const f: HqFilter = { industry: r0.industry, country: r0.hq_country, listed: r0.public };
    const filtered = simViewsGetMapLayer(v, { kind: "CompanyHqs", filter: f });
    const want = rows
      .filter((r) => r.industry === r0.industry && r.hq_country === r0.hq_country && r.public === r0.public)
      .map((r) => ({ kind: "Company", company: r.id }));
    expect(filtered.pins.map((p) => p.target)).toEqual(want);
    const priv = simViewsGetMapLayer(v, { kind: "CompanyHqs", filter: { ...noFilter, listed: false } });
    expect(priv.pins.length).toBe(rows.filter((r) => !r.public).length);
  });

  // Rust: #[cfg(debug_assertions)] (Omniscient is compiled out of release, spec 1). Runs when
  // SetOmniscient is accepted.
  it("no_pin_or_heat_value_is_a_private_truth", () => {
    const plain = unwrap(simNew(data(), 1), "Sim::new");
    const truth = unwrap(simNew(data(), 1), "Sim::new");
    if (!simApply(truth, { kind: "SetOmniscient", on: true }).ok) return;
    const n = simViews(plain);
    const o = simViews(truth);
    const pins = (v: SimViews) => simViewsGetMapLayer(v, { kind: "CompanyHqs", filter: noFilter }).pins;
    const np = pins(n);
    const op = pins(o);
    const rows = n.company_rows.data.rows;
    let checked = 0;
    np.forEach((a, i) => {
      const b = op[i];
      const r = rows[i];
      if (b === undefined || r === undefined) throw new Error("pins and rows differ in length");
      if (r.estimated) {
        expect(a.size, `${r.name}'s pin is sized by its truth`).not.toBe(b.size);
        checked += 1;
      } else {
        expect(a.size).toBe(b.size);
      }
    });
    expect(checked > 100, `${checked} private pins`).toBe(true);
    // A province whose only units of an industry are banded never shows the true sum.
    let differ = 0;
    for (let i = 0; i < n.industry_rows.data.rows.length; i++) {
      const id = i as IndustryId;
      const a = scalars(simViewsGetMapLayer(n, { kind: "Industry", industry: id }).values);
      const b = scalars(simViewsGetMapLayer(o, { kind: "Industry", industry: id }).values);
      a.forEach((x, p) => {
        const y = b[p] as number;
        const banded = n.units.data.units.some(
          (u) => u.industry === id && u.base_province === p && figIsBand(u.gross_assets),
        );
        if (banded && y > 0.0) {
          expect(x, `industry ${i} province ${p} shows its truth`).not.toBe(y);
          differ += 1;
        }
      });
    }
    expect(differ > 50, `${differ}`).toBe(true);
  });

  it("financial_zones_shade_by_the_zone_effect_with_hub_pins", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const v = simViews(sim);
    const l = simViewsGetMapLayer(v, { kind: "FinancialZones" });
    expect(l.style).toBe("Diverging");
    const cycle = v.cycle.data;
    const places = v.places.data;
    const countries = v.countries.data;
    const vals = scalars(l.values);
    places.provinces.forEach((p, i) => {
      const zone = byId(countries.countries, p.country)?.zone;
      const effect = cycle.zones.find((z) => z.id === zone)?.effect as number;
      expect(vals[i], p.key).toBe(Math.fround(effect));
      expect(mapLayersViewZoneOf(v.map_layers.data, p.id)).toBe(zone);
    });
    // Macau is its own zone, apart from China's (batch 153).
    const zoneOf = (key: string) => {
      const p = places.provinces.find((p) => p.key === key);
      if (p === undefined) throw new Error(`no province ${key}`);
      return mapLayersViewZoneOf(v.map_layers.data, p.id);
    };
    expect(zoneOf("MO-0001")).not.toBe(zoneOf("CN-0001"));
    expect(cycle.zones.length).toBe(26);
    // A pin on each hub with its exchange code and index level.
    expect(l.pins.length).toBe(26);
    l.pins.forEach((pin, i) => {
      const x = v.exchanges.data.exchanges[i];
      if (x === undefined) throw new Error("pin without an exchange");
      expect(pin.target).toEqual({ kind: "Exchange", zone: x.zone });
      expect(pin.province).toBe(x.hub_province);
      expect(pin.code).toBe(x.code);
      expect(pin.level).toBe(x.level);
    });
    // The legend: the global phase, g_t and quarters left.
    expect(l.notes.map(([k]) => k)).toEqual(["Global phase", "g_t", "Quarters left"]);
    expect(l.notes[0]?.[1]).toBe(cycle.phase);
    expect(l.notes[2]?.[1]).toBe(String(cycle.quarters_left));
    const s = l.scale;
    if (s === null) throw new Error("no scale");
    expect(s.low).toBe(-s.high);
  });

  it("each_mode_names_the_views_it_reads", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const fz: MapMode = { kind: "FinancialZones" };
    const pol: MapMode = { kind: "Political" };
    const before = simViewsMapLayerVersions(simViews(sim), fz);
    const political = simViewsMapLayerVersions(simViews(sim), pol);
    expect(political.slice(1)).toEqual([0, 0]);
    // A day: v_cycle and v_exchanges move (daily), v_map_layers does not (monthly).
    for (let i = 0; i < 24; i++) simStep(sim);
    const after = simViewsMapLayerVersions(simViews(sim), fz);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(simViewsMapLayerVersions(simViews(sim), pol)).toEqual(political);
  });
});
