import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "headless", include: ["test/**/*.test.ts"], passWithNoTests: true },
});
