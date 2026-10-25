// Port of crates/sim/tests/m8_map_views.rs: M8 Phase A map views (spec 8 Map row, 9.2, 9.4):
// v_map_static, v_map_layers (Political) and v_province_card, from the province files and a
// fixture assets/map folder in the contract's format (docs/build/m8-map-assets.md). The map is
// static data beside the world: the economy, the state hash and the save are the same with and
// without it.
//
// Expects:
//   "@tc20ff/sim-data/node"            writeMapFixture(dir, w, h, tinyPx, rects), loadMap(dir)
//                                      (exist); type Rect via the tuple form [id, [x0, y0, x1, y1]]
//   ../../../src/lib.ts                simNew, simStep, simViews, simSaveBytes, simLoadBytes,
//                                      simStateHash
//   ../../../src/views/map_static.ts   mapStaticViewProvinceAtIndex(view, i) -> ProvinceId | null,
//                                      mapStaticViewShape(view, p) -> ProvinceShape | null,
//                                      mapStaticViewNeighbors(view, p) -> Neighbor[],
//                                      mapStaticViewTinyTargets(view) -> [ProvinceId, [x, y]][]
//   ../../../src/views/map_layers.ts   mapLayersViewGetMapLayer(view, mode) -> MapLayer
//                                      [MapLayersView::get_map_layer]
//
// Changed from the Rust: the fixture folder is made with mkdtemp and removed in afterEach (Rust
// Scratch drop). `sim.save_bytes()` equality is Uint8Array equality (Buffer.compare). The seeds
// (1, 7) are the new generator (D951); every assertion is on static data or on "with the map ==
// without it", which holds for any seed.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorldData } from "@tc20ff/sim-data";
import { loadMap, writeMapFixture } from "@tc20ff/sim-data/node";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Sim,
  simLoadBytes,
  simNew,
  simSaveBytes,
  simStateHash,
  simStep,
  simViews,
} from "../../../src/lib.ts";
import type { ProvinceId } from "../../../src/types/ids.ts";
import { mapLayersViewGetMapLayer } from "../../../src/views/map_layers.ts";
import {
  mapStaticViewNeighbors,
  mapStaticViewProvinceAtIndex,
  mapStaticViewShape,
  mapStaticViewTinyTargets,
} from "../../../src/views/map_static.ts";
import { data, unwrap } from "../common/index.ts";
import { byId } from "../common/views.ts";

const scratch: string[] = [];
afterEach(() => {
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * The data with a fixture map: three Alabama and Alaska provinces, a tiny one, and a contested
 * Taiwanese one far off.
 */
function dataWithMap(name: string): WorldData {
  const dir = mkdtempSync(join(tmpdir(), `tc20ff-sim-map-${name}-`));
  scratch.push(dir);
  writeMapFixture(dir, 128, 64, 20, [
    ["US-0001", [0, 0, 10, 10]],
    ["US-0002", [10, 0, 20, 10]],
    ["US-0003", [20, 0, 30, 10]],
    ["US-0004", [10, 10, 14, 14]],
    ["TW-0001", [100, 30, 110, 40]],
  ]);
  const d = data();
  d.map = unwrap(loadMap(dir), "load_map");
  expect(d.map).not.toBeNull();
  return d;
}

function pid(sim: Sim, key: string): ProvinceId {
  const p = simViews(sim).places.data.provinces.find((p) => p.key === key);
  if (p === undefined) throw new Error(`no province ${key}`);
  return p.id;
}

describe("m8 map views", () => {
  // Waits on map_layers (Step 3, lane B chunk 3).
  it("political_layer_is_the_country_and_the_contested_tag", () => {
    const sim = unwrap(simNew(dataWithMap("political"), 1), "Sim::new");
    const views = simViews(sim);
    const layer = mapLayersViewGetMapLayer(views.map_layers.data, { kind: "Political" });
    if (layer.values.kind !== "Categories") throw new Error("political is categorical");
    const places = views.places.data.provinces;
    expect(layer.values.values.length).toBe(places.length);
    places.forEach((p, i) => {
      expect(layer.values.values[i]).toBe(p.country);
    });
    const contested = places.filter((p) => layer.hatched[p.id]).map((p) => p.key);
    expect(contested.length, "every province with a contested tag").toBe(67);
    expect(contested.includes("TW-0001")).toBe(true);
    expect(contested.includes("US-0001")).toBe(false);
    // The legend: each country with a province once, named.
    expect(layer.legend.length).toBe(views.places.data.countries.length);
    const usa = views.countries.data.countries.find((c) => c.iso3 === "USA");
    if (usa === undefined) throw new Error("no USA");
    const row = layer.legend.find((l) => l.value === usa.id);
    expect(row?.label).toBe(usa.name);
  });

  // Waits on company_detail and units (lane A).
  it("province_cards_show_the_spec_8_fields", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const views = simViews(sim);
    const cards = views.province_cards.data;
    const us1 = byId(cards.cards, pid(sim, "US-0001"));
    if (us1 === undefined) throw new Error("no card");
    expect(us1.name).toBe("Birmingham-North Alabama");
    expect([us1.region, us1.area]).toEqual(["Alabama", "Alabama"]);
    expect([us1.commerce, us1.industry, us1.population]).toEqual([9, 12, 16]);
    expect(us1.total).toBe(37);
    expect(us1.largest_track).toBe("Industry");
    expect([us1.resource, us1.terrain]).toEqual(["Coal", "Temperate"]);
    expect(us1.coastal).toBe(false);
    expect(us1.contested).toBeNull();
    expect(us1.city_rank).toBe("City");
    expect(byId(cards.cards, pid(sim, "US-0002"))?.coastal).toBe(true);
    // HQs and units: every live company's HQ and every unit's base, exactly once.
    const details = views.company_detail.data.companies;
    const hqTotal = cards.cards.reduce((acc, c) => acc + c.hqs.length, 0);
    expect(hqTotal).toBe(details.length);
    for (const c of details) expect(byId(cards.cards, c.hq_province)?.hqs.includes(c.id)).toBe(true);
    const units = views.units.data.units;
    const unitTotal = cards.cards.reduce((acc, c) => acc + c.units.length, 0);
    expect(unitTotal).toBe(units.length);
    for (const u of units) expect(byId(cards.cards, u.base_province)?.units.includes(u.id)).toBe(true);
    // A key city and a Metro show by name.
    const statics = views.map_static.data;
    const withCity = cards.cards.find((c) => c.key_city !== null);
    if (withCity === undefined) throw new Error("no key city card");
    const k = statics.provinces[withCity.id]?.key_city;
    expect(withCity.key_city).toBe(statics.key_cities[k as number]?.name);
    const withMetro = cards.cards.find((c) => c.metro !== null);
    if (withMetro === undefined) throw new Error("no metro card");
    const m = statics.provinces[withMetro.id]?.metro;
    expect(withMetro.metro).toBe(statics.metros[m as number]?.name);
    const tw = byId(cards.cards, pid(sim, "TW-0001"));
    expect(tw?.contested).toBe("CHN claims");
  });
});
