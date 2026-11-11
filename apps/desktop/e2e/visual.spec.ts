// Screenshot checks (tag @visual; part of `pnpm e2e`, not of the smoke suite): what the shell
// looks like on a mock game that has not moved (paused at hour 0, so the clock and the wallpaper's
// orrery are always the same), with animations off. The baselines are in __screenshots__, one set
// per platform; `pnpm e2e -- --visual --update-snapshots` writes them again after a change that is
// meant to be seen.
//
// The map is a WebGL canvas whose pixels depend on the graphics driver: it is masked.

import { desktop, expect, openDebug, sim, test } from "./fixtures.ts";

const visual = { tag: "@visual" };

test("the empty desktop", visual, async ({ game }) => {
  const page = await game.launch();
  await desktop(page);
  expect(await sim<number>(page, "sim.clock.now")).toBe(0);
  await expect(page).toHaveScreenshot("desktop.png");
});

test("the taskbar and the launcher's menu", visual, async ({ game }) => {
  const page = await game.launch();
  await desktop(page);
  await expect(page.getByTestId("taskbar")).toHaveScreenshot("taskbar.png");
  await page.getByTestId("tb-launcher").click();
  await expect(page.getByRole("menu", { name: "Apps" })).toHaveScreenshot("launcher-menu.png");
});

test("the phone with nothing on it", visual, async ({ game }) => {
  const page = await game.launch();
  await desktop(page);
  await page.getByTestId("tb-phone").click();
  await expect(page.getByTestId("phone")).toContainText("Nothing yet");
  await expect(page.getByTestId("phone")).toHaveScreenshot("phone-empty.png");
});

test("the Debug workspace's window", visual, async ({ game }) => {
  const page = await game.launch();
  await desktop(page);
  await openDebug(page);
  const map = page.getByTestId("win-debug").locator("canvas");
  await expect(map.first()).toBeVisible();
  // The whole page: the window's frame and title bar, the workspace's bars, the taskbar with the
  // window's button. The map and the clock are covered.
  await expect(page).toHaveScreenshot("debug-window.png", { mask: [map, page.getByTestId("tb-clock")] });
});
