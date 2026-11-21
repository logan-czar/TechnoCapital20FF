// The real sim as a Web Worker: fetches the starting CSVs and the map CSVs (served by the Vite
// plugin, exactly the files WORLD_FILES and MAP_FILES name), parses them with sim-data's pure core,
// then speaks the protocol through a RealHost driven by a WorkerLoop (both packages/sim-host, which
// the Electron sim process runs too: apps/desktop/src/sim/entry.ts loads the same files from disk).

import type { ToSim } from "@tc20ff/sim";
import { DEFAULT_WORLD_ID, dataErrorToString, MAP_FILES, parseMap, type WorldData } from "@tc20ff/sim-data";
import { RealHost, WorkerLoop } from "@tc20ff/sim-host";
import { knownWorld } from "../world.ts";
import { loadFiles, loadWorldTables } from "../worldFiles.ts";

async function loadData(): Promise<WorldData> {
  const selected = knownWorld((self as unknown as { name?: string }).name) ?? DEFAULT_WORLD_ID;
  const [world, mapFiles] = await Promise.all([
    loadWorldTables(selected),
    // The map files are optional: no map-meta.toml means no map (parseMap gives null).
    loadFiles(MAP_FILES, "/data/map/", true),
  ]);
  const map = parseMap(mapFiles);
  if (!map.ok) throw new Error(`map data: ${dataErrorToString(map.error)}`);
  return { ...world, map: map.value };
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
