import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/headless", "apps/web"],
    // Half the cores: the sim's multi-year tests are CPU-bound, and a worker per core (with other
    // gates or the dev server running) starves Vitest's RPC and fails the run with a timeout.
    maxWorkers: "50%",
  },
});
