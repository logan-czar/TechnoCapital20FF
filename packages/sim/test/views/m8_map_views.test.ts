// The tests of crates/sim/tests/m8_map_views.rs that read only map_static and places. The other
// two are in pending/views/m8_map_views.test.ts: the Political layer test waits on map_layers
// (lane B chunk 3), the province card test on company_detail and units (lane A).
// Port of crates/sim/tests/m8_map_views.rs: M8 Phase A map views (spec 8 Map row, 9.2, 9.4):
// v_map_static, v_map_layers (Political) and v_province_card, from the province files and a
// fixture assets/map folder in the contract's format (docs/build/m8-map-assets.md). The map is
// static data beside the world: the economy, the state hash and the save are the same with and
// without it.
//
// Expects:
//   "@tc20ff/sim-data/node"            writeMapFixture(dir, w, h, tinyPx, rects), loadMap(dir)
//                                      (exist); type Rect via the tuple form [id, [x0, y0, x1, y1]]
//   ../../src/lib.ts                simNew, simStep, simViews, simSaveBytes, simLoadBytes,
//                                      simStateHash
//   ../../src/views/map_static.ts   mapStaticViewProvinceAtIndex(view, i) -> ProvinceId | null,
//                                      mapStaticViewShape(view, p) -> ProvinceShape | null,
//                                      mapStaticViewNeighbors(view, p) -> Neighbor[],
//                                      mapStaticViewTinyTargets(view) -> [ProvinceId, [x, y]][]
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
} from "../../src/lib.ts";
import type { ProvinceId } from "../../src/types/ids.ts";
import {
  mapStaticViewNeighbors,
  mapStaticViewProvinceAtIndex,
  mapStaticViewShape,
  mapStaticViewTinyTargets,
} from "../../src/views/map_static.ts";
import { data, unwrap } from "../common/index.ts";

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
  it("map_static_maps_the_bitmap_to_provinces", () => {
    const sim = unwrap(simNew(dataWithMap("static"), 1), "Sim::new");
    const v = simViews(sim).map_static.data;
    const geo = v.geo;
    if (geo === null) throw new Error("the map geometry");
    expect([geo.info.width, geo.info.height]).toEqual([128, 64]);
    expect(geo.info.tiny_px).toBe(20);
    expect(geo.index.length).toBe(5);
    // Bitmap index i is the i-th colour row (sorted by id): TW-0001 first.
    expect(mapStaticViewProvinceAtIndex(v, 0), "0 is water").toBeNull();
    expect(mapStaticViewProvinceAtIndex(v, 1)).toBe(pid(sim, "TW-0001"));
    expect(mapStaticViewProvinceAtIndex(v, 2)).toBe(pid(sim, "US-0001"));
    expect(mapStaticViewProvinceAtIndex(v, 6)).toBeNull();
    const us2 = pid(sim, "US-0002");
    const s = mapStaticViewShape(v, us2);
    if (s === null) throw new Error("no shape");
    expect(s.index).toBe(3);
    expect(s.centroid).toEqual([15.0, 5.0]);
    expect(s.label).toEqual([15.0, 5.0]);
    expect(s.area_px).toBe(100);
    expect(s.tiny).toBe(false);
    // Provinces outside the fixture have no shape (Phase A covers only NA).
    expect(mapStaticViewShape(v, pid(sim, "GB-0001"))).toBeNull();
    // Neighbours, both ways, in ordinal order.
    const n = mapStaticViewNeighbors(v, us2).map((x) => x.province);
    expect(n).toEqual([pid(sim, "US-0001"), pid(sim, "US-0003"), pid(sim, "US-0004")]);
    expect(mapStaticViewNeighbors(v, us2).every((x) => x.kind === "Land")).toBe(true);
    expect(mapStaticViewNeighbors(v, pid(sim, "US-0001"))[0]?.province).toBe(us2);
    expect(mapStaticViewNeighbors(v, pid(sim, "US-0001"))[0]?.border_px).toBe(10.0);
    // The tiny province's click target is its label point.
    expect(mapStaticViewTinyTargets(v)).toEqual([[pid(sim, "US-0004"), [12.0, 12.0]]]);
    // Every province has a row; contested and development come from the province files.
    expect(v.provinces.length).toBe(3963);
    const tw = v.provinces[pid(sim, "TW-0001")];
    expect(tw?.contested).toBe(true);
    const us1 = v.provinces[pid(sim, "US-0001")];
    expect([us1?.commerce, us1?.industry, us1?.population]).toEqual([9, 12, 16]);
    expect(us1?.contested).toBe(false);
    // Metros and key cities list their provinces.
    v.metros.forEach((m, i) => {
      expect(m.provinces.length > 0, m.name).toBe(true);
      for (const p of m.provinces) expect(v.provinces[p]?.metro).toBe(i);
    });
    expect(v.key_cities.length).toBe(88);
    expect(v.key_cities.filter((k) => k.provinces.length > 0).length > 80).toBe(true);
  });

  it("no_map_assets_is_no_geometry", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const v = simViews(sim).map_static.data;
    expect(v.geo).toBeNull();
    expect(mapStaticViewProvinceAtIndex(v, 1)).toBeNull();
    expect(mapStaticViewTinyTargets(v)).toEqual([]);
    // The cards and layers need no map assets.
    expect(v.provinces.length).toBe(3963);
    expect(simViews(sim).province_cards.data.cards.length).toBe(3963);
  });

  // The map changes no state: two games of the same seed, one with the map, hash and save the
  // same through a month, and a save loads into either.
  it("the_map_moves_nothing", () => {
    const a = unwrap(simNew(dataWithMap("moves"), 7), "Sim::new");
    const b = unwrap(simNew(data(), 7), "Sim::new");
    for (let i = 0; i < 32 * 24; i++) {
      simStep(a);
      simStep(b);
    }
    expect(simStateHash(a)).toBe(simStateHash(b));
    expect(Buffer.compare(simSaveBytes(a), simSaveBytes(b))).toBe(0);
    // A load keeps the game's own map data.
    const bytes = simSaveBytes(b);
    unwrap(simLoadBytes(a, bytes), "load_bytes");
    expect(simViews(a).map_static.data.geo).not.toBeNull();
    expect(simStateHash(a)).toBe(simStateHash(b));
  }, 120_000);
});
