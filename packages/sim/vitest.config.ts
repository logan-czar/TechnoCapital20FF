import { defineProject } from "vitest/config";

// Some ported Rust tests draw thousands of characters or run ten sim years with every view built;
// Rust has no per-test timeout, and under the parallel gate those take up to about a minute.
export default defineProject({
  test: {
    name: "sim",
    include: ["test/**/*.test.ts"],
    exclude: ["test/pending/**", "node_modules/**"],
    testTimeout: 180_000,
  },
});
