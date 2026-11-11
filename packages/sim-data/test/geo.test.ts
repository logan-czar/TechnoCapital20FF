// The county files (pivot 5.1; D1029): counties.csv and county-adjacency.csv are loaded only for a
// world whose manifest sets `features.counties`, and no world has them before lane S1's data.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COUNTY_SPEC,
  GEO_FILES,
  loadTable,
  MANIFEST_2020,
  parseManifest,
  parseWorld,
  WORLD_FILES,
  type WorldManifest,
  worldDataCounts,
} from "@tc20ff/sim-data";
import { defaultDataDir, worldDataDir } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { worldOnce } from "./helpers.ts";

const COUNTIES = [
  "fips,state,name,pop_1990,lean_pts,spread,elasticity,turnout,centroid_x,centroid_y",
  "01001,Alabama,Autauga County,34222,-28.5,3.5,0.9,0.52,651.2,412.8",
  "01003,Alabama,Baldwin County,98280,-33.1,5,1.1,0.55,628.4,455",
  "",
].join("\n");
const ADJACENCY = ["fips,neighbour_fips", "01001,01003", "01003,01001", ""].join("\n");

function worldFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const f of WORLD_FILES) files[f] = readFileSync(join(defaultDataDir(), f), "utf8");
  return files;
}

const withCounties: WorldManifest = {
  ...MANIFEST_2020,
  features: { ...MANIFEST_2020.features, counties: true },
};

describe("county files", () => {
  it("counties.csv has the pivot's columns", () => {
    const t = loadTable({ "counties.csv": COUNTIES }, "counties.csv", COUNTY_SPEC);
    expect(t.ok && t.value.rows[0]).toEqual({
      fips: "01001",
      state: "Alabama",
      name: "Autauga County",
      pop_1990: 34222,
      lean_pts: -28.5,
      spread: 3.5,
      elasticity: 0.9,
      turnout: 0.52,
      centroid_x: 651.2,
      centroid_y: 412.8,
    });
    expect(GEO_FILES).toEqual(["counties.csv", "county-adjacency.csv"]);
  });

  it("a world without the feature has empty county tables and reads no county file", () => {
    const w = worldOnce();
    expect(w.manifest.features.counties).toBe(false);
    expect(w.counties.rows).toEqual([]);
    expect(w.county_adjacency.rows).toEqual([]);
    const counts = new Map(worldDataCounts(w));
    expect(counts.get("counties")).toBe(0);
    expect(counts.get("county-adjacency")).toBe(0);
  });

  it("a world with the feature loads both files, and needs them", () => {
    const files = worldFiles();
    const missing = parseWorld(files, withCounties);
    expect(missing).toMatchObject({ ok: false, error: { file: "counties.csv", message: "file not found" } });
    const loaded = parseWorld(
      { ...files, "counties.csv": COUNTIES, "county-adjacency.csv": ADJACENCY },
      withCounties,
    );
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
    expect(loaded.value.counties.rows.map((c) => c.fips)).toEqual(["01001", "01003"]);
    expect(loaded.value.county_adjacency.rows).toEqual([
      { fips: "01001", neighbour_fips: "01003" },
      { fips: "01003", neighbour_fips: "01001" },
    ]);
  });

  it("manifest.json may set features.counties; absent is false", () => {
    const text = readFileSync(join(worldDataDir("1995"), "manifest.json"), "utf8");
    // The 1995 world has had its counties since lane S1 (tools/world-1995/counties).
    const on = parseManifest(text);
    expect(on.ok && on.value.features.counties).toBe(true);
    const json = JSON.parse(text) as { features: Record<string, unknown> };
    delete json.features.counties;
    const plain = parseManifest(JSON.stringify(json));
    expect(plain.ok && plain.value.features.counties).toBe(false);
    json.features.counties = "yes";
    expect(parseManifest(JSON.stringify(json))).toMatchObject({
      ok: false,
      error: { message: "features.counties: not a boolean" },
    });
  });
});
