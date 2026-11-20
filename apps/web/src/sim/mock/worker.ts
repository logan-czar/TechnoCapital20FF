// The mock sim as a Web Worker: loads the default world's tables (served by the Vite plugin or the
// Electron shell) through sim-data's pure parseWorld (D1053 decision 3, D1055), then speaks the
// protocol. Swapping in the real worker is one import (sim/spawn.ts).

import type { FromSim, ToSim } from "@tc20ff/sim";
import { FRAME_MS } from "@tc20ff/sim";
import { DEFAULT_WORLD_ID } from "@tc20ff/sim-data";
import { loadWorldTables } from "../worldFiles.ts";
import { SimHost } from "./host.ts";
import { MOCK_PIVOT } from "./mockSim.ts";
import { buildMockWorld } from "./mockWorld.ts";

interface Scope {
  postMessage(m: FromSim): void;
  onmessage: ((e: MessageEvent<ToSim>) => void) | null;
}
const scope = self as unknown as Scope;

async function main(): Promise<void> {
  const queued: ToSim[] = [];
  let host: SimHost | null = null;
  const run = (h: SimHost, msg: ToSim): void => {
    for (const out of h.handle(msg)) scope.postMessage(out);
  };
  scope.onmessage = (e) => (host ? run(host, e.data) : queued.push(e.data));
  const data = await loadWorldTables(DEFAULT_WORLD_ID);
  // The worker runs the pivot world (./pivot.ts); the dev server's is a debug sim, so Omniscient works (D1014).
  const ready = new SimHost(buildMockWorld(data), { ...MOCK_PIVOT, debug: import.meta.env.DEV });
  host = ready;
  scope.postMessage({ kind: "Ready" });
  for (const m of queued) run(ready, m);

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    for (const out of ready.tick(dt)) scope.postMessage(out);
  }, FRAME_MS);
}

main().catch((e: unknown) => {
  scope.postMessage({ kind: "Fatal", message: e instanceof Error ? e.message : String(e) });
});
