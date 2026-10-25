// The real sim as a Web Worker: fetches the starting CSVs and the map CSVs (served by the Vite
// plugin, exactly the files WORLD_FILES and MAP_FILES name), parses them with sim-data's pure core,
// then speaks the protocol through a RealHost (host.ts): NewGame, Load, Save and Control, and the
// clock's pacing on a FRAME_MS timer. Any uncaught error is posted as Fatal.

import type { FromSim, ToSim } from "@tc20ff/sim";
import { FRAME_MS } from "@tc20ff/sim";
import { type Files, MAP_FILES, parseMap, parseWorld, WORLD_FILES, type WorldData } from "@tc20ff/sim-data";
import { RealHost } from "./host.ts";

interface Scope {
  postMessage(m: FromSim): void;
  onmessage: ((e: MessageEvent<ToSim>) => void) | null;
}
const scope = self as unknown as Scope;

/** A text file the plugin serves, or null when it is not there (the SPA fallback is HTML). */
async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url);
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
  if (!world.ok) throw new Error(`starting data: ${JSON.stringify(world.error)}`);
  const map = parseMap(mapFiles);
  if (!map.ok) throw new Error(`map data: ${JSON.stringify(map.error)}`);
  return { ...world.value, map: map.value };
}

function fatal(e: unknown): void {
  scope.postMessage({ kind: "Fatal", message: e instanceof Error ? (e.stack ?? e.message) : String(e) });
}

async function main(): Promise<void> {
  const queued: ToSim[] = [];
  let host: RealHost | null = null;
  const run = (h: RealHost, msg: ToSim): void => {
    try {
      for (const out of h.handle(msg)) scope.postMessage(out);
    } catch (e) {
      fatal(e);
    }
  };
  scope.onmessage = (e) => (host ? run(host, e.data) : queued.push(e.data));
  const ready = new RealHost(await loadData());
  host = ready;
  scope.postMessage({ kind: "Ready" });
  for (const m of queued) run(ready, m);

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    try {
      for (const out of ready.tick(dt)) scope.postMessage(out);
    } catch (e) {
      fatal(e);
    }
  }, FRAME_MS);
}

main().catch(fatal);
