import { defineProject } from "vitest/config";

// The parts of the shell that need no Electron: the flags and what the app:// scheme serves. The
// app itself is checked by `pnpm --filter @tc20ff/desktop smoke` and by lane U4's e2e runs.
const skipSlow = process.env.CHECK_FAST_SKIP_SLOW === "1" ? ["**/*.slow.test.*"] : [];

export default defineProject({
  test: {
    name: "desktop",
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**", ...skipSlow],
  },
});
