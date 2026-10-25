import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/headless", "apps/web"],
    // A quarter of the cores: each worker holds a whole simulated world with every view, so a
    // worker per core used too much memory (and starved Vitest's RPC) when several gates ran.
    maxWorkers: "25%",
  },
});
