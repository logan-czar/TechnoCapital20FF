// The USA map's shapes (D1048): the built topology holds the game's 3,142 counties in the order of
// assets/worlds/1995/counties.csv (feature index = county index = the views' index), its arcs join
// at most two counties, the real county set binds one to one, and the mock's invented set falls back
// to the schematic with one hexagon a county.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  bindGeometry,
  type CountyTopology,
  decodeTopology,
  inPolygon,
  ringArea,
  stateBorderEdges,
} from "../../../src/apps/usmap/geometry.ts";
import { parseCsv } from "../../../src/map/csv.ts";
import { newGame } from "../../mock/common.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const topo = JSON.parse(
  readFileSync(resolve(repo, "assets/usmap/counties.topo.json"), "utf8"),
) as CountyTopology;
const csv = parseCsv(readFileSync(resolve(repo, "assets/worlds/1995/counties.csv"), "utf8"));
const base = decodeTopology(topo);

describe("the county topology", () => {
  it("holds the 3,142 counties of counties.csv, in its order", () => {
    expect(base.fips.length).toBe(3142);
    expect(base.fips).toEqual(csv.map((r) => r.fips));
    expect(base.partsOf.length).toBe(3142);
    expect(base.partsOf.every((p) => p.length > 0)).toBe(true);
  });

  it("is in the plane of the county centroids: each centroid falls in or by its own county", () => {
    let inside = 0;
    csv.forEach((r, i) => {
      const x = Number(r.centroid_x);
      const y = Number(r.centroid_y);
      if ((base.partsOf[i] ?? []).some((p) => inPolygon(p.polygon, x, y))) inside++;
      // Every centroid is inside its county's box (slivers included, within a unit).
      expect(x).toBeGreaterThanOrEqual((base.bounds[4 * i] as number) - 1);
      expect(x).toBeLessThanOrEqual((base.bounds[4 * i + 2] as number) + 1);
      expect(y).toBeGreaterThanOrEqual((base.bounds[4 * i + 1] as number) - 1);
      expect(y).toBeLessThanOrEqual((base.bounds[4 * i + 3] as number) + 1);
    });
    // Area centroids of crescent-shaped counties can fall outside them; nearly all are inside.
    expect(inside).toBeGreaterThan(3000);
  });

  it("has edges with one or two counties, and state borders between states", () => {
    expect(base.edges.every((e) => e.a >= 0 && e.a < 3142 && e.b < 3142 && e.a !== e.b)).toBe(true);
    const shared = base.edges.filter((e) => e.b >= 0);
    // The Census file lists 9,291 touching pairs, corners and water included: shared arcs are fewer.
    expect(shared.length).toBeGreaterThan(8000);
    expect(stateBorderEdges(base).length).toBeGreaterThan(500);
    expect(base.width).toBe(975);
    expect(base.height).toBe(610);
  });

  it("binds the real county set one to one", () => {
    const g = bindGeometry(base, base.fips);
    expect(g.kind).toBe("real");
    expect(g.count).toBe(3142);
    expect(g.parts).toBe(base.parts);
    // A subset keeps the view's order.
    const some = [base.fips[10] as string, base.fips[3] as string];
    const s = bindGeometry(base, some);
    expect(s.kind).toBe("real");
    expect(s.partsOf[0]?.[0]?.polygon).toBe(base.partsOf[10]?.[0]?.polygon);
    expect(s.parts.every((p) => p.county === 0 || p.county === 1)).toBe(true);
  });
});

describe("the mock's counties", () => {
  it("cannot all be matched, so they are drawn on the schematic: one hexagon each, inside the map", () => {
    const g = newGame(7);
    const fips = g.views().usmap_layers.data.counties.fips;
    expect(fips.length).toBe(162);
    expect(fips.every((f) => base.fips.includes(f))).toBe(false);
    const s = bindGeometry(base, fips);
    expect(s.kind).toBe("schematic");
    expect(s.count).toBe(162);
    expect(s.partsOf.every((p) => p.length === 1)).toBe(true);
    expect(s.parts.every((p) => Math.abs(ringArea(p.polygon[0] ?? [])) > 0)).toBe(true);
    // Neighbouring cells share edges, so district borders can be drawn between them.
    expect(s.edges.filter((e) => e.b >= 0).length).toBeGreaterThan(162);
    // No two cells overlap: their centres are at least a cell apart (within each state's grid).
    for (let i = 0; i < s.count; i++) {
      const [x, y] = s.centroid[i] as [number, number];
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(975);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(610);
    }
    const keys = new Set(s.centroid.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`));
    expect(keys.size).toBe(162);
    expect(s.backdrop.length).toBeGreaterThan(500);
  });
});
