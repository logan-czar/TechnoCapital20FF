import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "sim-data", include: ["test/**/*.test.ts"], exclude: ["test/pending/**", "node_modules/**"] },
});
