import { defineProject } from "vitest/config";

// Node by default; a React Testing Library file opts into happy-dom with a
// `// @vitest-environment happy-dom` line at its top.
// scripts/check-fast sets CHECK_FAST_SKIP_SLOW=1 to leave out the *.slow.test.* files; the gate runs them.
const skipSlow = process.env.CHECK_FAST_SKIP_SLOW === "1" ? ["**/*.slow.test.*"] : [];

export default defineProject({
  test: {
    name: "web",
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ...skipSlow],
  },
});
