import { defineProject } from "vitest/config";

// Node by default; a React Testing Library file opts into happy-dom with a
// `// @vitest-environment happy-dom` line at its top.
export default defineProject({
  test: { name: "web", environment: "node", include: ["test/**/*.test.{ts,tsx}"] },
});
