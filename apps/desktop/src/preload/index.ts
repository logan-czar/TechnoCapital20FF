// The preload script (pivot 15.1): the only bridge between the page and the shell. The page is
// sandboxed with contextIsolation on and no Node, so this exposes one small object, `tcHost`
// (packages/sim-host/src/bridge.ts), and forwards the sim's MessagePort from main to the page as a
// window message, since a port cannot cross the context bridge any other way.

import {
  TC_SIM_FAILED,
  TC_SIM_PORT,
  type TcFlags,
  type TcHost,
  type TcWindowMessage,
} from "@tc20ff/sim-host/bridge";
import { contextBridge, ipcRenderer } from "electron";

const FLAGS_ARG = "--tc-flags=";

/** The flags main passed in `additionalArguments`; all off when it passed none. */
function readFlags(): TcFlags {
  const none: TcFlags = {
    mock: false,
    paused: false,
    world: null,
    save: null,
    smoke: false,
    testHooks: false,
    dev: false,
  };
  const arg = process.argv.find((a) => a.startsWith(FLAGS_ARG));
  if (arg === undefined) return none;
  try {
    return { ...none, ...(JSON.parse(atob(arg.slice(FLAGS_ARG.length))) as Partial<TcFlags>) };
  } catch {
    return none;
  }
}

// Main answers `connectSim` with the port; the page listens for it on its own window.
ipcRenderer.on("tc:sim-port", (e) => {
  window.postMessage({ tc: TC_SIM_PORT } satisfies TcWindowMessage, "*", e.ports);
});
ipcRenderer.on("tc:sim-failed", (_e, message: string) => {
  window.postMessage({ tc: TC_SIM_FAILED, message } satisfies TcWindowMessage, "*");
});

const host: TcHost = {
  flags: readFlags(),
  versions: {
    electron: process.versions.electron ?? "",
    chrome: process.versions.chrome ?? "",
    node: process.versions.node,
  },
  connectSim: () => ipcRenderer.send("tc:connect-sim"),
  quit: () => ipcRenderer.send("tc:quit"),
  toggleFullscreen: () => ipcRenderer.send("tc:toggle-fullscreen"),
};

contextBridge.exposeInMainWorld("tcHost", host);
