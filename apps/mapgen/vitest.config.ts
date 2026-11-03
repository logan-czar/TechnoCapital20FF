import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "mapgen", include: ["test/**/*.test.ts"] },
});
