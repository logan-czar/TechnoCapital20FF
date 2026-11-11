// The one place that names the sim's home. Three of them (pivot 15.1):
// - the mock sim in a Web Worker (sim/mock/), when `?mock=1` is in the page URL or the Electron app
//   was started with `--mock`: the UI tests and design work use it;
// - the Electron sim process, when the page runs in the Electron app (`window.tcHost`, put there by
//   apps/desktop's preload script): the real sim in a Node process, reached through a MessagePort;
// - else the real sim in a Web Worker, as the browser dev server has always run it.
// `?world=2020` picks another starting world (world.ts); the real worker learns it from its name,
// and the Electron sim process from the app's `--world` flag.

import { TC_SIM_FAILED, TC_SIM_PORT, type TcHost, type TcWindowMessage } from "@tc20ff/sim-host/bridge";
import { portTransport, SimClient, type SimTransport, workerTransport } from "./client.ts";
import { selectedWorld } from "./world.ts";

/** The Electron shell's object on `window`, or null in a browser. */
export function tcHost(): TcHost | null {
  return (globalThis as { tcHost?: TcHost }).tcHost ?? null;
}

export type SimHome = "mock" | "electron" | "worker";

/** Which sim this page talks to. */
export function simHome(): SimHome {
  const host = tcHost();
  const asked = new URLSearchParams(globalThis.location?.search ?? "").get("mock") === "1";
  if (asked || host?.flags.mock === true) return "mock";
  return host === null ? "worker" : "electron";
}

/** The Electron sim process as a transport: asks the shell for it and waits for its port. */
function electronTransport(host: TcHost): SimTransport {
  let fail: (message: string) => void = () => {};
  const port = new Promise<MessagePort>((resolve) => {
    globalThis.addEventListener("message", (e: MessageEvent<TcWindowMessage | null>) => {
      // The preload script posts to its own window; anything else is not the shell's.
      if ((e.source as unknown) !== globalThis || e.data === null || typeof e.data !== "object") return;
      if (e.data.tc === TC_SIM_PORT && e.ports[0] !== undefined) resolve(e.ports[0]);
      else if (e.data.tc === TC_SIM_FAILED) fail(e.data.message);
    });
  });
  const transport = portTransport(port);
  fail = transport.fail;
  host.connectSim();
  return transport;
}

export function spawnSim(): SimClient {
  const host = tcHost();
  const home = simHome();
  let transport: SimTransport;
  if (home === "mock") {
    transport = workerTransport(new Worker(new URL("./mock/worker.ts", import.meta.url), { type: "module" }));
  } else if (home === "electron" && host !== null) {
    transport = electronTransport(host);
  } else {
    transport = workerTransport(
      new Worker(new URL("./real/worker.ts", import.meta.url), {
        type: "module",
        name: selectedWorld() ?? "",
      }),
    );
  }
  const client = new SimClient(transport);
  // For the smoke run and the end-to-end tests (apps/desktop/README.md): the page's own client.
  if (host?.flags.testHooks === true) (globalThis as { __tcSim?: SimClient }).__tcSim = client;
  return client;
}
