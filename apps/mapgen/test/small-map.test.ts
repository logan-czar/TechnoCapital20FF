// A hand-made GeoJSON rasterized on a 64 x 32 frame gives the expected index, colours, centroids,
// label points, adjacency, border distances and files (build-plan P7; ported from the Rust crate's
// tests/small_map.rs, D1017).

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { build, colorsFor, landMask, type MapData, TINY_PX } from "../src/build.ts";
import { parseProvinces, writeAssets } from "../src/io.ts";
import { Frame } from "../src/miller.ts";

const W = 64;
const H = 32;
const frame = () => new Frame(W, H, 84);

/** lon/lat of a pixel-space point (x may be exactly W, which is lon 180). */
const ll = (x: number, y: number) => [(x / W) * 360 - 180, frame().unproject(0, y)[1]];

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  [ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)],
];

const feature = (id: string, region: string, country: string, polys: unknown[]) => ({
  type: "Feature",
  properties: { province_id: id, region, country },
  geometry: { type: "MultiPolygon", coordinates: polys },
});

const collection = (features: unknown[]) => JSON.stringify({ type: "FeatureCollection", features });

function smallMap(): MapData {
  const provinces = parseProvinces(
    collection([
      feature("AA-0002", "X:R1", "X", [rect(16, 8, 24, 16)]),
      feature("AA-0001", "X:R1", "X", [rect(8, 8, 16, 16)]),
      feature("BB-0001", "Y:R2", "Y", [rect(24, 8, 28, 12)]),
      feature("BB-0002", "Y:R3", "Y", [rect(40, 20, 42, 22)]),
      // straddles the east-west seam
      feature("CC-0001", "Z:R4", "Z", [rect(62, 4, 64, 6), rect(0, 4, 2, 6)]),
      // smaller than a pixel: covers no pixel centre
      feature("DD-0001", "Z:R5", "Z", [rect(50.1, 20.1, 50.4, 20.4)]),
    ]),
    "small map",
  );
  expect(provinces.length).toBe(6);
  const land = landMask(
    frame(),
    provinces.map((p) => p.shape),
  );
  return build(frame(), provinces, land);
}

const m = smallMap();
const at = (x: number, y: number) => m.raster[y * W + x];

describe("a small map", () => {
  it("draws the index bitmap and sorts the ids", () => {
    expect(m.ids).toEqual(["AA-0001", "AA-0002", "BB-0001", "BB-0002", "CC-0001", "DD-0001"]);
    expect([at(10, 10), at(15, 15), at(16, 8), at(25, 9), at(41, 21), at(63, 4), at(0, 5)]).toEqual([
      1, 1, 2, 3, 4, 5, 5,
    ]);
    // the sub-pixel province gets the pixel at its interior point
    expect(at(50, 20)).toBe(6);
    expect([at(30, 30), at(7, 10)]).toEqual([0, 0]);
    expect(m.stats.map((s) => s.area_px)).toEqual([64, 64, 16, 4, 8, 1]);
    expect(m.stats[5]!.forced && !m.stats[0]!.forced).toBe(true);
    // the shapes tile cleanly
    expect(m.stats.every((s) => s.overwritten_px === 0)).toBe(true);
  });

  it("colours from the hashed table", () => {
    expect(m.colors).toEqual(colorsFor(m.ids));
  });

  it("finds centroids and label points", () => {
    expect(m.stats[0]!.centroid).toEqual([12, 12]);
    // pole of inaccessibility of an 8 x 8 square: four pixels tie at 4, the top-left one wins
    expect(m.stats[0]!.label).toEqual([11.5, 11.5]);
    // the seam province's centroid is on the seam, not in the middle of the map
    expect(m.stats[4]!.centroid).toEqual([0, 5]);
    // the two halves join across the seam
    expect(m.stats[4]!.components).toBe(1);
    expect(m.stats[5]!.label).toEqual([50.5, 20.5]);
    expect(m.stats[3]!.area_px < TINY_PX && m.stats[0]!.area_px >= TINY_PX).toBe(true);
  });

  it("counts shared pixel edges", () => {
    expect(m.adjacency).toEqual([
      [1, 2, 8],
      [2, 3, 4],
    ]);
  });

  it("measures border distances by level", () => {
    const b = (x: number, y: number) => [...m.borders.subarray((y * W + x) * 3, (y * W + x) * 3 + 3)];
    // (11, 11): 3 from A's west and north edges at every level
    expect(b(11, 11)).toEqual([3, 3, 3]);
    // (14, 12): next to the A|B edge (a province edge only; A and B share region and country)
    expect(b(14, 12)).toEqual([1, 3, 3]);
    // (22, 9): one pixel from B's north coast at every level
    expect(b(22, 9)).toEqual([1, 1, 1]);
    // (23, 10): next to B|C, a region and country edge too
    expect(b(23, 10)).toEqual([0, 0, 0]);
  });

  it("counts coastal edges on open water only", () => {
    // A: west, north and south sides on water (8 pixel edges each); its east side is B
    expect(m.stats[0]!.coastal_px).toBe(24);
  });

  const dir = mkdtempSync(join(tmpdir(), "mapgen-test-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("writes every contract file", () => {
    writeAssets(
      m,
      { pipeline_version: "test", sources: [["natural_earth", "v0"]], coverage: ["provinces-test.csv"] },
      dir,
    );
    const read = (f: string) => readFileSync(join(dir, f), "utf8");
    const colors = read("province-colors.csv");
    expect(colors.startsWith("province_id,r,g,b\nAA-0001,")).toBe(true);
    expect(colors.trimEnd().split("\n").length).toBe(7);
    const cents = read("province-centroids.csv").trimEnd().split("\n");
    expect(cents[1]!.endsWith(",12.0,12.0,11.5,11.5,64,N")).toBe(true);
    expect(cents.find((l) => l.startsWith("BB-0002"))!.endsWith(",4,Y")).toBe(true);
    expect(read("province-adjacency.csv")).toBe(
      "a,b,border_px,kind\nAA-0001,AA-0002,8,land\nAA-0002,BB-0001,4,land\n",
    );
    const meta = read("map-meta.toml");
    expect(meta).toContain('projection = "miller"');
    expect(meta).toContain('coverage = ["provinces-test.csv"]');
    for (const png of ["province-ids.png", "province-index.png", "province-borders.png"]) {
      const bytes = readFileSync(join(dir, png));
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([W, H]);
    }
  });
});

describe("overlapping shapes", () => {
  it("are counted against the province drawn later", () => {
    // EE-0002 is drawn after EE-0001 and covers 2 x 4 of its pixels
    const om = build(
      frame(),
      parseProvinces(
        collection([
          feature("EE-0001", "E:R", "E", [rect(4, 4, 10, 8)]),
          feature("EE-0002", "E:R", "E", [rect(8, 4, 12, 8)]),
        ]),
        "overlap",
      ),
      null,
    );
    expect(om.stats[0]!.area_px).toBe(16);
    expect(om.stats[1]!.overwritten_px).toBe(8);
    expect(om.stats[0]!.overwritten_px).toBe(0);
  });
});
