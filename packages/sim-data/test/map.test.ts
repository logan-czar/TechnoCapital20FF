// Port of crates/sim-data/tests/map.rs: the assets/map loader (M8; docs/build/m8-map-assets.md):
// a fixture folder in the contract format loads; no folder is no map; a broken file names its
// file, line and field; the world checks flag a province id the world does not have.
//
// Expects (pure, no file system; the folder is a files map of name to text):
//   "@tc20ff/sim-data": parseMap(files: Record<string, string>) ->
//       Result<MapAssets | null, DataError>   (Rust load_map; null means no map: there is no
//       map-meta.toml in the files; province-adjacency.csv is optional)
//     mapAssetsIndexOf(map, id) -> number | null     (MapAssets::index_of)
//     check
//     MapAssets { meta: {width,height,projection,tiny_px: number | null,coverage,sources:
//       [string,string][]}, colors, centroids, adjacency } with Table-shaped members { rows, lines }
//   "@tc20ff/sim-data/node": loadWorld, defaultDataDir (via ./helpers.ts)
//   ./map-fixture.ts (in this folder): mapFixtureFiles, port of sim_data::map::fixture::write.
//
// Changed from the Rust, by D954 (the vector map replaces the ID bitmaps): the PNG tests (png_size,
// the not-a-PNG error, wrong-size province-index and province-borders) and the 4095-province bitmap
// limit (MAX_MAP_PROVINCES) are dropped from this file; the label-point-outside-bitmap check
// stays. If the TS map module keeps a bitmap size or province limit, port those cases back.
import { check, mapAssetsIndexOf, parseMap } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { world } from "./helpers.ts";
import { mapFixtureFiles } from "./map-fixture.ts";

/** Three NA provinces side by side and a tiny one below them. */
function writeFixture(): Record<string, string> {
  return mapFixtureFiles(64, 32, 20, [
    ["US-0001", [0, 0, 10, 10]],
    ["US-0002", [10, 0, 20, 10]],
    ["US-0003", [20, 0, 30, 10]],
    ["US-0004", [10, 10, 14, 14]],
  ]);
}

function mustLoad(files: Record<string, string>) {
  const r = parseMap(files);
  if (!r.ok) throw new Error(`${r.error.file}: ${r.error.message}`);
  return r.value;
}

function loadError(files: Record<string, string>) {
  const r = parseMap(files);
  if (r.ok) throw new Error("expected a load error");
  return r.error;
}

/** Replace the first occurrence of from in the named file. */
function edit(files: Record<string, string>, name: string, from: string, to: string): void {
  const text = files[name] ?? "";
  if (!text.includes(from)) throw new Error(`fixture edit missed: ${from}`);
  files[name] = text.replace(from, to);
}

describe("map assets", () => {
  it("a_contract_folder_loads", () => {
    const m = mustLoad(writeFixture());
    expect(m).not.toBeNull();
    if (m === null) return;
    expect([m.meta.width, m.meta.height]).toEqual([64, 32]);
    expect(m.meta.projection).toBe("miller");
    expect(m.meta.tiny_px).toBe(20);
    expect(m.meta.coverage).toEqual(["provinces-north-america.csv"]);
    expect(m.meta.sources).toEqual([["fixture", "1"]]);
    expect(m.colors.rows.length).toBe(4);
    expect(mapAssetsIndexOf(m, "US-0001")).toBe(1);
    expect(mapAssetsIndexOf(m, "US-0004")).toBe(4);
    expect(mapAssetsIndexOf(m, "US-0099")).toBeNull();
    const tiny = m.centroids.rows.filter((c) => c.tiny);
    expect(tiny.length).toBe(1);
    expect(tiny[0]?.province_id).toBe("US-0004");
    expect([tiny[0]?.label_x, tiny[0]?.label_y]).toEqual([12.0, 12.0]);
    // 1|2, 2|3 and 2 over 4 touch.
    expect(m.adjacency.rows.map((a) => [a.a, a.b])).toEqual([
      ["US-0001", "US-0002"],
      ["US-0002", "US-0003"],
      ["US-0002", "US-0004"],
    ]);
    // The world checks pass with it.
    const w = world();
    w.map = m;
    expect(check(w)).toEqual([]);
  });

  it("no_folder_is_no_map", () => {
    // A folder without map-meta.toml is no map (the Rust missing folder has no TS twin: there
    // is no directory in the pure loader).
    const none = parseMap({});
    expect(none.ok).toBe(true);
    if (none.ok) expect(none.value).toBeNull();
    // The adjacency file is optional (Phase A).
    const files = writeFixture();
    delete files["province-adjacency.csv"];
    const m = mustLoad(files);
    expect(m?.adjacency.rows.length).toBe(0);
  });

  it("broken_files_name_their_place", () => {
    let files = writeFixture();
    edit(files, "province-centroids.csv", ",N\n", ",maybe\n");
    let e = loadError(files);
    expect(e.file).toBe("province-centroids.csv");
    expect(e.line).toBe(2);
    expect(e.field).toBe("tiny");

    // Unsorted colour rows.
    files = writeFixture();
    edit(files, "province-colors.csv", "US-0002,", "US-0009,");
    e = loadError(files);
    expect([e.file, e.line]).toEqual(["province-colors.csv", 4]);

    // A centroid of a province the colour table lacks.
    files = writeFixture();
    edit(files, "province-centroids.csv", "US-0003,", "US-0007,");
    e = loadError(files);
    expect(e.field).toBe("province_id");

    // A meta file that is not TOML names its line.
    files = writeFixture();
    files["map-meta.toml"] = "width = 64\nheight = = 3\n";
    e = loadError(files);
    expect([e.file, e.line]).toEqual(["map-meta.toml", 2]);
  });

  it("the_world_checks_flag_unknown_map_provinces", () => {
    const files = mapFixtureFiles(64, 32, 0, [
      ["US-0001", [0, 0, 4, 4]],
      ["ZZ-0001", [4, 0, 8, 4]],
    ]);
    const w = world();
    w.map = mustLoad(files);
    w.map?.meta.coverage.push("provinces-atlantis.csv");
    const errors = check(w);
    expect(
      errors.some((e) => e.file === "province-colors.csv" && e.line === 3 && e.field === "province_id"),
      JSON.stringify(errors, null, 2),
    ).toBe(true);
    expect(
      errors.some((e) => e.file === "map-meta.toml" && e.message.includes("atlantis")),
      JSON.stringify(errors, null, 2),
    ).toBe(true);
  });

  // The bitmap checks (review of PR 35): label points and centroids inside the bitmap.
  it("the_bitmap_checks", () => {
    const files = writeFixture();
    edit(files, "province-centroids.csv", ",5,5,5,5,", ",5,5,64,5,");
    const e = loadError(files);
    expect([e.file, e.line, e.field]).toEqual(["province-centroids.csv", 2, "label_x"]);
  });
});
