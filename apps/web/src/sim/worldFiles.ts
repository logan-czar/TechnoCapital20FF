// A starting world's tables fetched from where the Vite plugin (vite.config.ts) or the Electron
// shell serves them, and parsed with sim-data's pure core: the folder's manifest, its CSVs and era
// files and, when it has them, its county files (1995-rework 3.2; pivot 5.1). The real worker adds
// the map; the mock worker reads only the names and ids (D1053 decision 3, D1055).

import {
  dataErrorToString,
  ERA_FILES,
  type Files,
  GEO_FILES,
  MANIFEST_FILE,
  parseManifest,
  parseWorld,
  WORLD_FILES,
  type WorldData,
} from "@tc20ff/sim-data";
import { worldDataBase } from "./world.ts";

/** A text file the server has, or null when it is not there (the SPA fallback is HTML). */
export async function fetchText(url: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`${url}: fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return null;
  return res.text();
}

/** `files` from `base`; a missing one is an error unless `optional`. */
export async function loadFiles(files: readonly string[], base: string, optional: boolean): Promise<Files> {
  const entries = await Promise.all(
    files.map(async (f): Promise<[string, string | null]> => {
      const text = await fetchText(`${base}${f}`);
      if (text === null && !optional) throw new Error(`${base}${f}: not found`);
      return [f, text];
    }),
  );
  const out: Record<string, string> = {};
  for (const [f, text] of entries) if (text !== null) out[f] = text;
  return out;
}

/** World `id`'s tables, with no map (`map` is null). */
export async function loadWorldTables(id: string): Promise<WorldData> {
  const base = worldDataBase(id);
  const [manifestText, baseFiles] = await Promise.all([
    fetchText(`${base}${MANIFEST_FILE}`),
    loadFiles([...WORLD_FILES, ...ERA_FILES], base, false),
  ]);
  if (manifestText === null) throw new Error(`${base}${MANIFEST_FILE}: not found`);
  const manifest = parseManifest(manifestText);
  if (!manifest.ok) throw new Error(`starting data: ${dataErrorToString(manifest.error)}`);
  // The county files, for a world that has them (pivot 5.1).
  const geoFiles = manifest.value.features.counties ? await loadFiles(GEO_FILES, base, false) : {};
  const world = parseWorld({ ...baseFiles, ...geoFiles }, manifest.value);
  if (!world.ok) throw new Error(`starting data: ${dataErrorToString(world.error)}`);
  return world.value;
}
