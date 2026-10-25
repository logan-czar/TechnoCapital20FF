import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { MAP_FILES, WORLD_FILES } from "@tc20ff/sim-data";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// The game reads repo folders at runtime (D954): assets/map (the topology for the map, plus the
// map CSVs the sim reads) and docs/design/data (the starting-world CSVs). They live outside this
// app, so this plugin serves them in dev under /data/map/* and /data/design/*, and copies the same
// files into the build. It exposes exactly the files the code names, nothing else: sim-data's
// WORLD_FILES (the world worker's CSVs, which the map pane reads too) and MAP_FILES, plus the
// topology. The build also writes .gz and .br copies of the 5.8 MB topology (about 1.6 MB
// gzipped) for a static host to serve with Content-Encoding; the dev server and `vite preview`
// send it plain.
const TOPOLOGY = "provinces.topo.json";

/** URL path (no leading slash) to source file, for every file the game may fetch. */
function servedFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const f of WORLD_FILES) files.set(`data/design/${f}`, resolve(root, "docs/design/data", f));
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
