// The host's Node side (pivot 15.1, 15.4): the world's files read from disk with the same lists
// the browser worker fetches, slot saves as files in a folder, and the baked starts' index. The
// Electron sim process and the tests use these; the browser never imports this file.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { BakedStart, SaveInfo } from "@tc20ff/sim";
import {
  dataErrorToString,
  ERA_FILES,
  type Files,
  GEO_FILES,
  MANIFEST_2020,
  MANIFEST_FILE,
  MAP_FILES,
  parseManifest,
  parseMap,
  parseWorld,
  WORLD_FILES,
  type WorldData,
  type WorldManifest,
} from "@tc20ff/sim-data";
import { isAutosaveSlot, type SaveMeta, type SaveStore, type StartStore, slotNameOk } from "./saves.ts";

// ---------------------------------------------------------------- the world's files

/** A file's text as `fetch(...).text()` gives it (UTF-8, no BOM), or null when it is not there. */
async function readText(path: string): Promise<string | null> {
  let bytes: Uint8Array;
  try {
    bytes = await readFile(path);
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return null;
    throw new Error(`${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return new TextDecoder().decode(bytes);
}

async function readFiles(dir: string, files: readonly string[], optional: boolean): Promise<Files> {
  const entries = await Promise.all(
    files.map(async (f): Promise<[string, string | null]> => {
      const text = await readText(join(dir, f));
      if (text === null && !optional) throw new Error(`${join(dir, f)}: not found`);
      return [f, text];
    }),
  );
  const out: Record<string, string> = {};
  for (const [f, text] of entries) if (text !== null) out[f] = text;
  return out;
}

/** Where a world's files are on disk. */
export interface WorldDirs {
  /** The world's CSVs (and its manifest.json, for a folder world). */
  world: string;
  /** The map CSVs; null plays with no map, as `headless run` does. */
  map: string | null;
}

/**
 * Loads a world as the browser worker does (apps/web/src/sim/real/worker.ts `loadData`), from
 * disk: the same file lists, the same parsers. `id` null is the 2020 world, which has no manifest
 * file; any other reads the folder's manifest, the era files and, when it has them, the county files.
 */
export async function loadWorldData(id: string | null, dirs: WorldDirs): Promise<WorldData> {
  let manifest: WorldManifest = MANIFEST_2020;
  if (id !== null) {
    const text = await readText(join(dirs.world, MANIFEST_FILE));
    if (text === null) throw new Error(`${join(dirs.world, MANIFEST_FILE)}: not found`);
    const parsed = parseManifest(text);
    if (!parsed.ok) throw new Error(`starting data: ${dataErrorToString(parsed.error)}`);
    manifest = parsed.value;
  }
  const [baseFiles, mapFiles, geoFiles] = await Promise.all([
    readFiles(dirs.world, id === null ? WORLD_FILES : [...WORLD_FILES, ...ERA_FILES], false),
    // The map files are optional: no map-meta.toml means no map (parseMap gives null).
    dirs.map === null ? Promise.resolve({}) : readFiles(dirs.map, MAP_FILES, true),
    // The county files, for a world that has them (pivot 5.1).
    manifest.features.counties ? readFiles(dirs.world, GEO_FILES, false) : Promise.resolve({}),
  ]);
  const world = parseWorld({ ...baseFiles, ...geoFiles }, manifest);
  if (!world.ok) throw new Error(`starting data: ${dataErrorToString(world.error)}`);
  const map = parseMap(mapFiles);
  if (!map.ok) throw new Error(`map data: ${dataErrorToString(map.error)}`);
  return { ...world.value, map: map.value };
}

// ---------------------------------------------------------------- slot saves

/** A save file is `<slot>.tcsave`; what it says about itself is in `<slot>.tcsave.json` beside it. */
export const SAVE_EXT = ".tcsave";
const META_EXT = ".json";
const TMP_EXT = ".tmp";
/** The 8 bytes every save starts with (packages/sim/src/save.ts SAVE_MAGIC), before its gzip. */
const SAVE_MAGIC_BYTES = 8;

/** Writes `path` whole or not at all: a temp file beside it, then a rename over it. */
function writeAtomic(path: string, data: Uint8Array | string): void {
  const tmp = `${path}${TMP_EXT}`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

function isMeta(v: unknown): v is SaveMeta {
  const m = v as Partial<SaveMeta> | null;
  return (
    typeof m === "object" &&
    m !== null &&
    Number.isSafeInteger(m.time) &&
    Number.isSafeInteger(m.seed) &&
    Number.isSafeInteger(m.save_version)
  );
}

/**
 * What a save says about itself, read from the save: for a file copied into the folder with no
 * `.json` beside it. It unpacks the whole save, so the listing writes the answer down. Null when
 * the file is not a save this build can describe.
 */
export function saveMetaOf(bytes: Uint8Array): SaveMeta | null {
  try {
    const json = gunzipSync(bytes.subarray(SAVE_MAGIC_BYTES)).toString("utf8");
    const v = JSON.parse(json) as {
      version?: unknown;
      state?: { world?: { clock?: unknown }; rng?: { seed?: unknown } };
    };
    const meta = { time: v.state?.world?.clock, seed: v.state?.rng?.seed, save_version: v.version };
    return isMeta(meta) ? meta : null;
  } catch {
    return null;
  }
}

/** Slot saves as files in one folder (`<userData>/saves`; pivot 15.4). */
export class DiskSaveStore implements SaveStore {
  constructor(readonly dir: string) {}

  /** The file of a slot. The host has checked the name (`slotNameOk`); this refuses any other too. */
  path(slot: string): string {
    if (!slotNameOk(slot)) throw new Error(`"${slot}" is not a save name`);
    return join(this.dir, `${slot}${SAVE_EXT}`);
  }

  write(slot: string, bytes: Uint8Array, meta: SaveMeta): void {
    const path = this.path(slot);
    mkdirSync(this.dir, { recursive: true });
    writeAtomic(path, bytes);
    writeAtomic(`${path}${META_EXT}`, JSON.stringify(meta));
  }

  read(slot: string): Uint8Array | null {
    try {
      return readFileSync(this.path(slot));
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") return null;
      throw e;
    }
  }

  list(): SaveInfo[] {
    if (!existsSync(this.dir)) return [];
    const found: { info: SaveInfo; mtime: number }[] = [];
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith(SAVE_EXT)) continue;
      const slot = name.slice(0, -SAVE_EXT.length);
      if (!slotNameOk(slot)) continue;
      const path = join(this.dir, name);
      const stat = statSync(path);
      const meta = this.meta(path);
      if (meta === null) continue;
      found.push({
        info: { slot, autosave: isAutosaveSlot(slot), ...meta, bytes: stat.size },
        mtime: stat.mtimeMs,
      });
    }
    // Newest first; two written in the same millisecond go by name, so the order is always the same.
    found.sort((a, b) => b.mtime - a.mtime || (a.info.slot < b.info.slot ? -1 : 1));
    return found.map((f) => f.info);
  }

  /** The save's `.json`, or, when it is missing or unreadable, the same read from the save and written down. */
  private meta(path: string): SaveMeta | null {
    try {
      const v: unknown = JSON.parse(readFileSync(`${path}${META_EXT}`, "utf8"));
      if (isMeta(v)) return { time: v.time, seed: v.seed, save_version: v.save_version };
    } catch {
      // Fall through to the save itself.
    }
    const meta = saveMetaOf(readFileSync(path));
    if (meta !== null) writeAtomic(`${path}${META_EXT}`, JSON.stringify(meta));
    return meta;
  }

  delete(slot: string): boolean {
    const path = this.path(slot);
    if (!existsSync(path)) return false;
    rmSync(path);
    rmSync(`${path}${META_EXT}`, { force: true });
    return true;
  }
}

// ---------------------------------------------------------------- baked starts

/** The index of the baked starts, in their folder (`assets/starts/index.json`; pivot 3.5). */
export const STARTS_INDEX = "index.json";

/** A row of the index: a `BakedStart`, whose details (D1037) an older index may not have. */
type StartRow = Pick<BakedStart, "id" | "label" | "seed" | "save_version" | "hash"> &
  Partial<Pick<BakedStart, "scenario" | "date" | "file" | "bytes">>;

function isStart(v: unknown): v is StartRow {
  const s = v as Partial<BakedStart> | null;
  return (
    typeof s === "object" &&
    s !== null &&
    typeof s.id === "string" &&
    typeof s.label === "string" &&
    Number.isSafeInteger(s.seed) &&
    Number.isSafeInteger(s.save_version) &&
    typeof s.hash === "string"
  );
}

/**
 * The baked starts in a folder. Its `index.json` is an array of `BakedStart` rows (or an object
 * with them under `starts`); a start's save is the row's `file` if it names one, else
 * `<id>.tcsave`, in the same folder. No folder, no index or an index that does not parse is no
 * starts: lane S4's `--bake` writes them, and none exist yet.
 */
export class DiskStartStore implements StartStore {
  constructor(readonly dir: string) {}

  private rows(): StartRow[] {
    let v: unknown;
    try {
      v = JSON.parse(readFileSync(join(this.dir, STARTS_INDEX), "utf8"));
    } catch {
      return [];
    }
    const rows = Array.isArray(v) ? v : (v as { starts?: unknown } | null)?.starts;
    return Array.isArray(rows) ? rows.filter(isStart) : [];
  }

  /** Each start as `Ready` lists it; a row written before D1037 gets its file's default name and blank details. */
  list(): BakedStart[] {
    return this.rows().map((r) => ({
      id: r.id,
      label: r.label,
      seed: r.seed,
      save_version: r.save_version,
      hash: r.hash,
      scenario: typeof r.scenario === "string" ? r.scenario : "hidden",
      date: typeof r.date === "string" ? r.date : "",
      file: typeof r.file === "string" ? r.file : `${r.id}${SAVE_EXT}`,
      bytes: typeof r.bytes === "number" && Number.isSafeInteger(r.bytes) ? r.bytes : 0,
    }));
  }

  read(id: string): Uint8Array | null {
    const row = this.rows().find((r) => r.id === id);
    if (row === undefined) return null;
    const file = typeof row.file === "string" ? row.file : `${row.id}${SAVE_EXT}`;
    // A start's file is a plain name in the starts folder, never a path out of it.
    if (file.includes("/") || file.includes("\\") || file.includes("..")) return null;
    try {
      return readFileSync(join(this.dir, file));
    } catch {
      return null;
    }
  }
}
