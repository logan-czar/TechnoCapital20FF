// What the Electron shell and the page agree on (pivot 15.1): the small `tcHost` object the
// preload script puts on `window`, and the window messages that carry the sim's MessagePort to the
// page. Types and names only, so the preload, the main process and apps/web can all import it.

/** The command-line flags the page may need to know (apps/desktop/README.md lists them all). */
export interface TcFlags {
  /** `--mock`: play the mock sim in a Web Worker; no sim process is started. */
  mock: boolean;
  /** `--paused`: the game must stay paused until the player (or a test) resumes it. */
  paused: boolean;
  /** `--world=<id>`: the starting world, or null for the default. */
  world: string | null;
  /** `--save=<path>`: the sim process loaded this save before `Ready`. */
  save: string | null;
  /** `--smoke=<path>`: main drives a short run and exits. */
  smoke: boolean;
  /** `--test-hooks` (and `--smoke`): the page puts its SimClient on `window.__tcSim`. */
  testHooks: boolean;
  /** The page is served by the Vite dev server (`pnpm desktop:dev`). */
  dev: boolean;
}

/** `window.tcHost`: present only in the Electron app. */
export interface TcHost {
  flags: TcFlags;
  versions: { electron: string; chrome: string; node: string };
  /**
   * Asks main for a sim process. Its port arrives as a window message `{ tc: TC_SIM_PORT }` with
   * the MessagePort in `ports[0]`; if the process dies, `{ tc: TC_SIM_FAILED, message }` follows.
   * A page calls it once: each call starts a fresh sim process and stops the last.
   */
  connectSim(): void;
  quit(): void;
  toggleFullscreen(): void;
}

/** The `tc` field of the window message that carries the sim's port. */
export const TC_SIM_PORT = "sim-port";
/** The `tc` field of the window message that says the sim process is gone. */
export const TC_SIM_FAILED = "sim-failed";

/** A window message from the preload script. */
export type TcWindowMessage = { tc: typeof TC_SIM_PORT } | { tc: typeof TC_SIM_FAILED; message: string };
