// Node file helpers for sim-data: read the data directory and the map folder from disk and hand
// the text to the pure parsers (`parseWorld`, `parseMap`). The browser and Web Worker builds import
// the package root only and fetch the files themselves. Mirrors `sim_data::load_world`,
// `default_data_dir`, `load_map` and `default_map_dir`.

import { closeSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type DataError, dataErrorFile, err, ok, type Result } from "./error.ts";
import type { Files } from "./load.ts";
import { MAP_FILES, MAP_PNG_FILES, type MapAssets, mapFixtureFiles, parseMap, type Rect } from "./map.ts";
import { parseWorld, WORLD_FILES, type WorldData } from "./world.ts";

/** The repository root, found from this file location (packages/sim-data/src). */
export function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

/** The data directory in this repository (`docs/design/data`). */
export function defaultDataDir(): string {
  return join(repoRoot(), "docs", "design", "data");
}

/** The repository map folder (`assets/map`). */
export function defaultMapDir(): string {
  return join(repoRoot(), "assets", "map");
}

/**
 * The bytes of each of `names` in `dir` (decoded by the parser, so invalid UTF-8 is reported with
 * its line and field). A file that does not exist is left out (the parser reports it, or for the
 * optional map files it is absent); any other read error is returned.
 */
function readFiles(dir: string, names: readonly string[]): Result<Record<string, Uint8Array>, DataError> {
  const files: Record<string, Uint8Array> = {};
  for (const name of names) {
    try {
      files[name] = readFileSync(join(dir, name));
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") continue;
      return err(dataErrorFile(name, e instanceof Error ? e.message : String(e)));
    }
  }
  return ok(files);
}

/** Loads every table from `dir`. Stops at the first file that does not parse (spec 10 M0). */
export function loadWorld(dir: string): Result<WorldData, DataError> {
  const files = readFiles(dir, WORLD_FILES);
  return files.ok ? parseWorld(files.value) : files;
}

/** The first `n` bytes of a file, or null when it cannot be read. */
function readHead(path: string, n: number): Uint8Array | null {
  let fd: number;
  try {
    fd = openSync(path, "r");
  } catch {
    return null;
  }
  try {
    const buf = new Uint8Array(n);
    const got = readSync(fd, buf, 0, n, 0);
    return buf.subarray(0, got);
  } finally {
    closeSync(fd);
  }
}

/**
 * Reads the map assets from `dir`, or null when the folder has no `map-meta.toml` (no map yet).
 * Rust `load_map`.
 */
export function loadMap(dir: string): Result<MapAssets | null, DataError> {
  const read = readFiles(dir, MAP_FILES);
  if (!read.ok) return read;
  const files: Record<string, string | Uint8Array> = { ...read.value };
  for (const png of MAP_PNG_FILES) {
    const head = readHead(join(dir, png), 24);
    if (head !== null) files[png] = head;
  }
  return parseMap(files satisfies Files, dir);
}

/** Writes a `mapFixtureFiles` folder into `dir` (Rust `map::fixture::write`). */
export function writeMapFixture(
  dir: string,
  width: number,
  height: number,
  tinyPx: number,
  rects: readonly Rect[],
): void {
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(mapFixtureFiles(width, height, tinyPx, rects))) {
    writeFileSync(join(dir, name), text);
  }
}
