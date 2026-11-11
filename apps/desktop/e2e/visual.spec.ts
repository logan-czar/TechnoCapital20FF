// Screenshot checks (tag @visual; part of `pnpm e2e`, not of the smoke suite): what the shell
// looks like on a mock game that has not moved (paused at its first hour, so the clock and the wallpaper's
// orrery are always the same), with animations off. The baselines are in __screenshots__, one set
// per platform; `pnpm e2e -- --visual --update-snapshots` writes them again after a change that is
// meant to be seen.
//
// The first run opens the news app by itself; these shots close it first, so the baselines show the
// shell (the wallpaper, the taskbar, the phone) and do not change when an app's own look does. What
// the apps look like is their lanes' business, not these baselines'.

import type { Page } from "@playwright/test";
import { expect, firstRun, sim, test } from "./fixtures.ts";

const visual = { tag: "@visual" };
/** The mock's first scripted pause (a notification): 14:00 on 23 Oct 2020, in hours since 2020-01-01. */
const FIRST_ALERT_HOUR = 7032 + 86;

/** The desktop of a new mock game with the first run's window closed. */
async function emptyDesktop(page: Page): Promise<void> {
  await firstRun(page);
  await page.getByTestId("win-news-1-close").click();
  await expect(page.getByTestId("win-news-1")).toHaveCount(0);
}

/** Runs the mock to its first scripted pause, which names a notification. */
async function toFirstPause(page: Page): Promise<void> {
  await page.getByTestId("tb-speed-6").click();
  await expect.poll(() => sim<number>(page, "sim.clock.now")).toBe(FIRST_ALERT_HOUR);
  await expect(page.getByTestId("tb-pause-note")).toBeVisible();
}

test("the empty desktop", visual, async ({ game }) => {
  const page = await game.launch();
  await emptyDesktop(page);
  expect(await sim<number>(page, "sim.clock.now")).toBe(7032);
  await expect(page).toHaveScreenshot("desktop.png");
});

test("the taskbar and the launcher's menu", visual, async ({ game }) => {
  const page = await game.launch();
  await emptyDesktop(page);
  await expect(page.getByTestId("taskbar")).toHaveScreenshot("taskbar.png");
  await page.getByTestId("tb-launcher").click();
  await expect(page.getByRole("menu", { name: "Apps" })).toHaveScreenshot("launcher-menu.png");
});

test("the phone's home screen on the first day", visual, async ({ game }) => {
  const page = await game.launch();
  await emptyDesktop(page);
  // The badge counts what the mock's history left unread; the screen shows it, and reads it.
  await expect(page.getByTestId("tb-phone")).toHaveAttribute("aria-label", /new$/);
  await page.getByTestId("tb-phone").click();
  await expect(page.getByTestId("phone-notifications")).toBeVisible();
  await expect(page.getByTestId("tb-phone")).toHaveAttribute("aria-label", "Phone");
  await expect(page.getByTestId("phone")).toHaveScreenshot("phone-home.png");
});

test(
  "the pause note on the taskbar, and the phone with the notification that paused the game",
  visual,
  async ({ game }) => {
    const page = await game.launch();
    await emptyDesktop(page);
    await toFirstPause(page);
    await expect(page.getByTestId("taskbar")).toHaveScreenshot("taskbar-paused.png");
    await page.getByTestId("tb-pause-note").click();
    await expect(page.getByTestId("phone")).toContainText("Paused the game");
    await expect(page.getByTestId("phone")).toHaveScreenshot("phone-notifications.png");
  },
);

test("the pause settings", visual, async ({ game }) => {
  const page = await game.launch();
  await emptyDesktop(page);
  await page.getByTestId("tb-pauses").click();
  await expect(page.getByTestId("pause-settings")).toHaveScreenshot("pause-settings.png");
});
