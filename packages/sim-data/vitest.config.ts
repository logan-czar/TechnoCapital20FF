import { defineProject } from "vitest/config";

// scripts/check-fast sets CHECK_FAST_SKIP_SLOW=1 to leave out the *.slow.test.* files; the gate runs them.
const skipSlow = process.env.CHECK_FAST_SKIP_SLOW === "1" ? ["**/*.slow.test.*"] : [];

export default defineProject({
  test: { name: "sim-data", include: ["test/**/*.test.ts"], exclude: ["node_modules/**", ...skipSlow] },
});
