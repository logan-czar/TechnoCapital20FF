// The real sim as a Web Worker: fetches the starting CSVs and the map CSVs (served by the Vite
// plugin, exactly the files WORLD_FILES and MAP_FILES name), parses them with sim-data's pure core,
// then speaks the protocol through a RealHost (host.ts) driven by a WorkerLoop (loop.ts).

import type { ToSim } from "@tc20ff/sim";
import {
  dataErrorToString,
  type Files,
  MAP_FILES,
  parseMap,
  parseWorld,
  WORLD_FILES,
  type WorldData,
} from "@tc20ff/sim-data";
import { RealHost } from "./host.ts";
import { WorkerLoop } from "./loop.ts";

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

async function loadData(): Promise<WorldData> {
  const [worldFiles, mapFiles] = await Promise.all([
    loadFiles(WORLD_FILES, "/data/design/", false),
    // The map files are optional: no map-meta.toml means no map (parseMap gives null).
    loadFiles(MAP_FILES, "/data/map/", true),
  ]);
  const world = parseWorld(worldFiles);
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
  load: async () => new RealHost(await loadData()),
  now: () => performance.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
});
scope.onmessage = (e) => loop.onMessage(e.data);
void loop.start();
