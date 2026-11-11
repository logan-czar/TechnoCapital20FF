// `pnpm desktop:build`: the unpackaged app in apps/desktop/dist, which `electron .` runs (from
// apps/desktop). The renderer is apps/web built by its own Vite config (whose plugin also copies
// the world and map data under dist/renderer/data); main, preload and the sim process are esbuild
// bundles. No installer is made yet.

import { rmSync } from "node:fs";
import { join } from "node:path";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { distDir, nodeBundles, webDir } from "./common.ts";

rmSync(distDir, { recursive: true, force: true });
await viteBuild({
  root: webDir,
  configFile: join(webDir, "vite.config.ts"),
  build: { outDir: join(distDir, "renderer"), emptyOutDir: true },
});
for (const options of nodeBundles()) await esbuild(options);
console.log(`\nbuilt ${distDir}\nrun it: corepack pnpm@10.20.0 --filter @tc20ff/desktop start`);
