import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { ERA_FILES, GEO_FILES, MANIFEST_FILE, MAP_FILES, WORLD_FILES, WORLD_IDS } from "@tc20ff/sim-data";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// The game reads repo folders at runtime (D954): assets/map (the topology for the map, plus the
// map CSVs the sim reads), docs/design/data (the 2020 world's CSVs) and assets/worlds (the others).
// They live outside this app, so this plugin serves them in dev under /data/map/*, /data/design/*
// and /data/worlds/*, and copies the same files into the build. It exposes exactly the files the code names, nothing else: sim-data's
// WORLD_FILES (the world worker's CSVs, which the map pane reads too) and MAP_FILES, plus the
// topology. The build also writes .gz and .br copies of the 5.8 MB topology (about 1.6 MB
// gzipped) for a static host to serve with Content-Encoding; the dev server and `vite preview`
// send it plain.
const TOPOLOGY = "provinces.topo.json";

/** URL path (no leading slash) to source file, for every file the game may fetch. */
function servedFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const f of WORLD_FILES) files.set(`data/design/${f}`, resolve(root, "docs/design/data", f));
  // The other starting worlds (1995-rework 3.2), each with its manifest.
  for (const id of WORLD_IDS) {
    for (const f of [...WORLD_FILES, ...ERA_FILES, MANIFEST_FILE]) {
      files.set(`data/worlds/${id}/${f}`, resolve(root, "assets/worlds", id, f));
    }
    // The county files (pivot 5.1): served when the world has them, and no error when it does not.
    for (const f of GEO_FILES) {
      const path = resolve(root, "assets/worlds", id, f);
      if (existsSync(path)) files.set(`data/worlds/${id}/${f}`, path);
    }
  }
  for (const f of [...MAP_FILES, TOPOLOGY]) files.set(`data/map/${f}`, resolve(root, "assets/map", f));
  return files;
}

function gameData(): Plugin {
  const files = servedFiles();
  const type = (f: string) => (f.endsWith(".json") ? "application/json" : "text/csv");
  return {
    name: "tc20ff-game-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        const file = files.get(path.slice(1));
        if (file === undefined || !existsSync(file)) return next();
        res.setHeader("Content-Type", type(file));
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const [fileName, path] of files) {
        if (!existsSync(path)) {
          // Only the map files the sim reads may be missing (sim-data parseMap treats them as
          // optional); a missing world CSV or the topology is a broken build.
          if ((MAP_FILES as readonly string[]).includes(fileName.slice("data/map/".length))) continue;
          this.error(`${fileName}: source file not found at ${path}`);
        }
        const source = readFileSync(path);
        this.emitFile({ type: "asset", fileName, source });
        if (fileName.endsWith(".json")) {
          this.emitFile({
            type: "asset",
            fileName: `${fileName}.gz`,
            source: gzipSync(source, { level: 9 }),
          });
          this.emitFile({ type: "asset", fileName: `${fileName}.br`, source: brotliCompressSync(source) });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), gameData()],
  worker: { format: "es" },
  server: { port: 5173, strictPort: true },
});
