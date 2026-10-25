// The one place that names the worker. Swapping the mock for the real sim worker (Step 3) is this
// import: point it at the real worker module, which speaks the same protocol.

import { SimClient, workerTransport } from "./client.ts";

export function spawnSim(): SimClient {
  const worker = new Worker(new URL("./mock/worker.ts", import.meta.url), { type: "module" });
  return new SimClient(workerTransport(worker));
}
