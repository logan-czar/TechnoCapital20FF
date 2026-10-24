import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// The map reads two repo folders at runtime (D954): assets/map (provinces.topo.json) and
// docs/design/data (the province CSVs). They live outside this app, so this plugin serves them in
// dev under /data/map/* and /data/design/*, and copies the same files into the build. Only the
// files the map needs are exposed, not whole folders.
function gameData(): Plugin {
  const sources = [
    { url: "data/map", dir: resolve(root, "assets/map"), keep: (f: string) => f === "provinces.topo.json" },
    {
      url: "data/design",
      dir: resolve(root, "docs/design/data"),
      keep: (f: string) => /^provinces-[a-z-]+\.csv$/.test(f),
    },
  ];
  const type = (f: string) => (f.endsWith(".csv") ? "text/csv" : "application/json");
  return {
    name: "tc20ff-game-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        for (const s of sources) {
          const prefix = `/${s.url}/`;
          if (!path.startsWith(prefix)) continue;
          const name = path.slice(prefix.length);
          const file = resolve(s.dir, name);
          if (!s.keep(name) || !existsSync(file)) break;
          res.setHeader("Content-Type", type(name));
          res.end(readFileSync(file));
          return;
        }
        next();
      });
    },
    generateBundle() {
      for (const s of sources) {
        for (const name of readdirSync(s.dir).filter(s.keep)) {
          this.emitFile({
            type: "asset",
            fileName: `${s.url}/${name}`,
            source: readFileSync(resolve(s.dir, name)),
          });
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
