// The mock sim as a Web Worker: loads the starting CSVs (served by the Vite plugin) through
// sim-data's pure parseWorld, then speaks the protocol. Swapping in the real worker is one import
// (sim/spawn.ts).

import type { FromSim, ToSim } from "@tc20ff/sim";
import { FRAME_MS } from "@tc20ff/sim";
import { type Files, parseWorld, WORLD_FILES } from "@tc20ff/sim-data";
import { SimHost } from "./host.ts";
import { buildMockWorld } from "./mockWorld.ts";

interface Scope {
  postMessage(m: FromSim): void;
  onmessage: ((e: MessageEvent<ToSim>) => void) | null;
}
const scope = self as unknown as Scope;

async function loadFiles(): Promise<Files> {
  const entries = await Promise.all(
    WORLD_FILES.map(async (f): Promise<[string, string]> => {
      const res = await fetch(`/data/design/${f}`);
      if (!res.ok) throw new Error(`${f}: ${res.status}`);
      return [f, await res.text()];
    }),
  );
  return Object.fromEntries(entries);
}

async function main(): Promise<void> {
  const queued: ToSim[] = [];
  let host: SimHost | null = null;
  const run = (msg: ToSim): void => {
    for (const out of (host as SimHost).handle(msg)) scope.postMessage(out);
  };
  scope.onmessage = (e) => (host ? run(e.data) : queued.push(e.data));
  const parsed = parseWorld(await loadFiles());
  if (!parsed.ok) throw new Error(`starting data: ${JSON.stringify(parsed.error)}`);
  host = new SimHost(buildMockWorld(parsed.value));
  scope.postMessage({ kind: "Ready" });
  for (const m of queued) run(m);

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    for (const out of (host as SimHost).tick(dt)) scope.postMessage(out);
  }, FRAME_MS);
}

main().catch((e: unknown) => {
  scope.postMessage({ kind: "Fatal", message: e instanceof Error ? e.message : String(e) });
});
