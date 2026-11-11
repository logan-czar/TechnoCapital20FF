// The real sim as a Web Worker: fetches the starting CSVs and the map CSVs (served by the Vite
// plugin, exactly the files WORLD_FILES and MAP_FILES name), parses them with sim-data's pure core,
// then speaks the protocol through a RealHost driven by a WorkerLoop (both packages/sim-host, which
// the Electron sim process runs too: apps/desktop/src/sim/entry.ts loads the same files from disk).

import type { ToSim } from "@tc20ff/sim";
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
import { RealHost, WorkerLoop } from "@tc20ff/sim-host";
import { knownWorld, worldDataBase } from "../world.ts";

/** A text file the plugin serves, or null when it is not there (the SPA fallback is HTML). */
async function fetchText(url: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`${url}: fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return null;
  return res.text();
}

async function loadFiles(files: readonly string[], base: string, optional: boolean): Promise<Files> {
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

/** The manifest of the world this worker was named after; the 2020 world's when it has no name. */
async function loadManifest(world: string | null, base: string): Promise<WorldManifest> {
  if (world === null) return MANIFEST_2020;
  const text = await fetchText(`${base}${MANIFEST_FILE}`);
  if (text === null) throw new Error(`${base}${MANIFEST_FILE}: not found`);
  const manifest = parseManifest(text);
  if (!manifest.ok) throw new Error(`starting data: ${dataErrorToString(manifest.error)}`);
  return manifest.value;
}

async function loadData(): Promise<WorldData> {
  const selected = knownWorld((self as unknown as { name?: string }).name);
  const base = worldDataBase(selected);
  const [manifest, baseFiles, mapFiles] = await Promise.all([
    loadManifest(selected, base),
    loadFiles(selected === null ? WORLD_FILES : [...WORLD_FILES, ...ERA_FILES], base, false),
    // The map files are optional: no map-meta.toml means no map (parseMap gives null).
    loadFiles(MAP_FILES, "/data/map/", true),
  ]);
  // The county files, for a world that has them (pivot 5.1).
  const geoFiles = manifest.features.counties ? await loadFiles(GEO_FILES, base, false) : {};
  const worldFiles = { ...baseFiles, ...geoFiles };
  const world = parseWorld(worldFiles, manifest);
  if (!world.ok) throw new Error(`starting data: ${dataErrorToString(world.error)}`);
  const map = parseMap(mapFiles);
  if (!map.ok) throw new Error(`map data: ${dataErrorToString(map.error)}`);
  return { ...world.value, map: map.value };
}

const scope = self as unknown as {
  postMessage: (m: unknown) => void;
  onmessage: ((e: MessageEvent<ToSim>) => void) | null;
};
const loop = new WorkerLoop({
  post: (m) => scope.postMessage(m),
  // The dev server's sim is a debug sim, so the top bar's Omniscient toggle works there (D1014).
  load: async () => new RealHost(await loadData(), { waitForFrameDone: true, debug: import.meta.env.DEV }),
  now: () => performance.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
});
scope.onmessage = (e) => loop.onMessage(e.data);
void loop.start();
