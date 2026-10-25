// The one place that names the worker. The real sim worker is the default; `?mock=1` in the page
// URL selects the mock sim (sim/mock/), which the UI tests and design work use.

import { SimClient, workerTransport } from "./client.ts";

export function spawnSim(): SimClient {
  const mock = new URLSearchParams(globalThis.location?.search ?? "").get("mock") === "1";
  const worker = mock
    ? new Worker(new URL("./mock/worker.ts", import.meta.url), { type: "module" })
    : new Worker(new URL("./real/worker.ts", import.meta.url), { type: "module" });
  return new SimClient(workerTransport(worker));
}
