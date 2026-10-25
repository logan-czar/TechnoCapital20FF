import { defineProject } from "vitest/config";

// Some ported Rust tests draw thousands of characters or run a sim year; Rust has no per-test
// timeout, so the default 5 s is too tight when the suite runs in parallel.
export default defineProject({
  test: {
    name: "sim",
    include: ["test/**/*.test.ts"],
    exclude: ["test/pending/**", "node_modules/**"],
    testTimeout: 30_000,
  },
});
