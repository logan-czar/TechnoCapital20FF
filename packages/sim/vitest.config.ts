import { defineProject } from "vitest/config";

// Some ported Rust tests draw thousands of characters or run ten sim years with every view built;
// Rust has no per-test timeout, and under the parallel gate those take up to about a minute.
// scripts/check-fast sets CHECK_FAST_SKIP_SLOW=1 to leave out the *.slow.test.* files; the gate runs them.
const skipSlow = process.env.CHECK_FAST_SKIP_SLOW === "1" ? ["**/*.slow.test.*"] : [];

export default defineProject({
  test: {
    name: "sim",
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules/**", ...skipSlow],
    testTimeout: 180_000,
  },
});
