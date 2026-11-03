import { defineConfig } from "vitest/config";

// The page bench (bench/pages.test.tsx): run on demand with `bench:pages`, never in the gate (a
// 30-year world takes about two minutes to run). One worker: the timings must not share the CPU.
export default defineConfig({
  test: {
    name: "web-bench",
    environment: "node",
    include: ["bench/**/*.test.{ts,tsx}"],
    maxWorkers: 1,
  },
});
