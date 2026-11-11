// What the build, dev and check scripts share: where things are, and how the three Node-side
// bundles are made. Run with plain `node` (Node 24 strips the types), so this file and its
// neighbours use only syntax that can be erased.
//
// Tooling choice (apps/desktop/README.md): plain Vite for the renderer and esbuild for main,
// preload and the sim process, not electron-vite. The renderer is apps/web, a separate workspace
// package with its own vite.config.ts and data plugin, which electron-vite would want moved under
// its own root; and the workspace packages export TypeScript sources, which must be bundled into
// main and the sim process, where electron-vite's default is to leave dependencies external.

import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { BuildOptions } from "esbuild";

export const desktopDir = resolve(import.meta.dirname, "..");
export const repoDir = resolve(desktopDir, "..", "..");
export const webDir = join(repoDir, "apps", "web");
export const distDir = join(desktopDir, "dist");
/** Git-ignored scratch for the check scripts' outputs, user-data folders and logs. */
export const scratchDir = join(desktopDir, ".scratch");

/** The Electron binary: the `electron` package's export is its path (it downloads it on first use). */
export function electronPath(): string {
  return createRequire(import.meta.url)("electron") as string;
}

/** The Node side: main (ESM), the sandboxed preload (must be CommonJS) and the sim process (ESM). */
export function nodeBundles(): BuildOptions[] {
  const common: BuildOptions = {
    bundle: true,
    platform: "node",
    // Electron 45 runs Node 24 in main and in a utility process.
    target: "node24",
    sourcemap: true,
    external: ["electron"],
    logLevel: "info",
    absWorkingDir: desktopDir,
  };
  return [
    { ...common, entryPoints: ["src/main/index.ts"], format: "esm", outfile: "dist/main/index.js" },
    { ...common, entryPoints: ["src/preload/index.ts"], format: "cjs", outfile: "dist/preload/index.cjs" },
    {
      ...common,
      entryPoints: { entry: "src/sim/entry.ts", "run-node": "src/sim/run-node.ts" },
      format: "esm",
      outdir: "dist/sim",
      outExtension: { ".js": ".mjs" },
    },
  ];
}

export interface Ran {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs a program to its end and returns what it printed. */
export function run(file: string, args: string[], cwd: string = desktopDir): Ran {
  const r = spawnSync(file, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error !== undefined) throw r.error;
  return { code: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

/** Runs the built app with flags and waits for it to exit. Its own output goes to this terminal. */
export function runApp(flags: string[]): Promise<number> {
  return new Promise((done, fail) => {
    const child = spawn(electronPath(), [desktopDir, ...flags], { stdio: "inherit" });
    child.on("error", fail);
    child.on("exit", (code) => done(code ?? 1));
  });
}
