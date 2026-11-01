// The one place that names the worker. The real sim worker is the default; `?mock=1` in the page
// URL selects the mock sim (sim/mock/), which the UI tests and design work use. `?world=1995` picks
// a starting world (world.ts); the real worker learns it from its name.

import { SimClient, workerTransport } from "./client.ts";
import { selectedWorld } from "./world.ts";

export function spawnSim(): SimClient {
  const mock = new URLSearchParams(globalThis.location?.search ?? "").get("mock") === "1";
  const worker = mock
    ? new Worker(new URL("./mock/worker.ts", import.meta.url), { type: "module" })
    : new Worker(new URL("./real/worker.ts", import.meta.url), {
        type: "module",
        name: selectedWorld() ?? "",
      });
  return new SimClient(workerTransport(worker));
}
