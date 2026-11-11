// The end-to-end tests of the built desktop app (apps/desktop/README.md "End-to-end tests"). They
// drive Electron itself through Playwright's `_electron`; no browser is downloaded or used. One
// worker: every test launches its own app, and two apps at once would fight over the pointer.

import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { scratchDir } from "../scripts/common.ts";

/** How long one test may take: the slowest smoke test is a few seconds, the real-sim one under a minute. */
const TEST_TIMEOUT_MS = 90_000;
/** How long an assertion keeps looking before it fails. */
const EXPECT_TIMEOUT_MS = 10_000;
/** The share of a screenshot's pixels that may differ from its baseline (text edges, mostly). */
const SCREENSHOT_MAX_DIFF_RATIO = 0.002;
/** E2E_SCREENSHOT_STRICT=1: no pixel may differ. For measuring how steady the screenshots are. */
const strict = process.env.E2E_SCREENSHOT_STRICT === "1";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: TEST_TIMEOUT_MS,
  reporter: [["list"]],
  // Traces, diffs and actual screenshots of a failed test: in the scratch folder, never committed.
  outputDir: join(scratchDir, "e2e", "results"),
  globalTeardown: "./teardown.ts",
  // Fonts and antialiasing differ by platform, so each has its own baselines.
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}-{platform}{ext}",
  expect: {
    timeout: EXPECT_TIMEOUT_MS,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      ...(strict ? { maxDiffPixels: 0, threshold: 0 } : { maxDiffPixelRatio: SCREENSHOT_MAX_DIFF_RATIO }),
    },
  },
});
