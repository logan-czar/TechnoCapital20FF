import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/headless", "apps/web"],
    // Four workers: each holds a whole simulated world with every view and years of history (up
    // to about 2 GB), so one gate peaks near 8 GB. More workers, or two gates at once, ran the PC
    // out of memory.
    maxWorkers: 4,
  },
});
