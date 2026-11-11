// The sim process (pivot 15.1): an Electron utility process, which is Node with no window. Main
// forks it and sends one `start` with the page's MessagePort; from then on the page and this
// process speak the game's protocol (ToSim, FromSim) through that port, exactly as the page and
// the Web Worker did. The host and its loop are packages/sim-host's, the same code the worker runs:
// here they are handed the disk (the world's CSVs read with fs, saves in <userData>/saves) where
// the worker had fetch and nothing.

import { readFile } from "node:fs/promises";
import type { ToSim } from "@tc20ff/sim";
import { RealHost, WorkerLoop } from "@tc20ff/sim-host";
import { DiskSaveStore, DiskStartStore, loadWorldData } from "@tc20ff/sim-host/node";
import type { FromSimProc, SimConfig, SimStatus, ToSimProc } from "../shared.ts";
import { runYears } from "./run.ts";

const parent = process.parentPort;
const toMain = (m: FromSimProc): void => parent.postMessage(m);

let host: RealHost | null = null;

async function buildHost(config: SimConfig): Promise<RealHost> {
  const data = await loadWorldData(config.world, { world: config.worldDir, map: config.mapDir });
  const built = new RealHost(data, {
    waitForFrameDone: true,
    debug: config.debug,
    saves: new DiskSaveStore(config.savesDir),
    starts: new DiskStartStore(config.startsDir),
    onAutosaveError: (message) => console.error(`[sim] autosave failed: ${message}`),
  });
  if (config.save !== null) {
    const problem = built.boot({ kind: "load", bytes: await readFile(config.save) });
    if (problem !== null) throw new Error(`${config.save}: ${problem}`);
  }
  host = built;
  return built;
}

function start(config: SimConfig, port: Electron.MessagePortMain): void {
  const loop = new WorkerLoop({
    post: (m) => port.postMessage(m),
    load: () => buildHost(config),
    now: () => performance.now(),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  });
  port.on("message", (e) => loop.onMessage(e.data as ToSim));
  port.start();
  void loop.start();
}

function status(): SimStatus {
  const sim = host?.sim ?? null;
  if (sim === null) return { started: false, seed: null, now: null, date: null, hash: null };
  return { started: true, seed: sim.seed(), now: sim.now(), date: sim.clock().date, hash: sim.stateHash() };
}

parent.on("message", (e) => {
  const msg = e.data as ToSimProc;
  switch (msg.kind) {
    case "start": {
      const port = e.ports[0];
      if (port === undefined) throw new Error("start came with no port");
      start(msg.config, port);
      break;
    }
    case "status":
      toMain({ kind: "status", id: msg.id, status: status() });
      break;
    case "run":
      runYears(msg.run).then(
        (report) => toMain({ kind: "run", id: msg.id, report }),
        (err: unknown) =>
          toMain({
            kind: "error",
            id: msg.id,
            message: err instanceof Error ? (err.stack ?? err.message) : String(err),
          }),
      );
      break;
  }
});
