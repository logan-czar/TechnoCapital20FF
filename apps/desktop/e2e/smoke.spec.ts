// The smoke suite (`pnpm e2e:smoke`, tag @smoke): the built app on the mock sim, driven as a
// player would with a real pointer and keyboard. Each test launches its own app. The whole suite is
// meant to stay under a minute (apps/desktop/README.md "End-to-end tests").
//
// The mock plays its election-year world (apps/web/src/sim/mock/README.md): it starts by itself,
// paused at 00:00 on Tue 20 Oct 2020 (hour START), and its first scripted pause is at 14:00 on
// 23 Oct (a resignation).

import type { Page } from "@playwright/test";
import { dragPointer } from "../scripts/drive.ts";
import { boxOf, DESK, DESKTOP_KEY, desktop, expect, openDebug, sim, test } from "./fixtures.ts";

const smoke = { tag: "@smoke" };

/** The Debug workspace's window as it first opens on a 1600x854 desktop (wm.ts cascadeRect). */
const OPENED = { x: 24, y: 0, width: 1560, height: 854 };
/** Where a test grabs a title bar, from its top left: on the title, clear of the buttons. */
const GRIP = { x: 120, y: 14 };
/** Where a resize handle is held: its middle. */
const HANDLE_MIDDLE = null;
/**
 * A point of a bottom corner handle outside the window's frame (the handle is 15 px square and
 * sticks out 5 px, os.css).
 */
const HANDLE_OUTSIDE = { x: 12, y: 12 };
/** A point of a handle inside the window's frame. */
const HANDLE_INSIDE = { x: 4, y: 4 };
/** The mock's first hour: 00:00 on 20 Oct 2020, in hours since 2020-01-01. */
const START = 7032;
/** The mock's first scripted pause: 14:00 on 23 Oct 2020. */
const FIRST_ALERT_HOUR = START + 86;
/** A speed with a game hour every 0.2 s (SECONDS_PER_HOUR[3]): quick, and well short of the alert. */
const WATCHED_SPEED = 4;

test("boots to the desktop, paused", smoke, async ({ game }) => {
  const page = await game.launch();
  await desktop(page);
  await expect(page.getByTestId("app-debug")).toBeVisible();
  await expect(page.getByTestId("tb-launcher")).toBeVisible();
  await expect(page.getByTestId("tb-clock")).toContainText("00:00");
  await expect(page.getByTestId("tb-clock")).toContainText("Tue 20 Oct 2020");
  await expect(page.getByTestId("tb-pause")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("phone")).toBeHidden();
  expect(await page.evaluate(() => ({ w: innerWidth, h: innerHeight, scale: devicePixelRatio }))).toEqual({
    w: 1600,
    h: 900,
    scale: 1,
  });
  expect(await sim(page, "({ mock: tcHost.flags.mock, hooks: tcHost.flags.testHooks })")).toEqual({
    mock: true,
    hooks: true,
  });
});

test("opens the Debug workspace from its icon and from the launcher", smoke, async ({ game }) => {
  const page = await game.launch();
  await desktop(page);

  // One click only selects an icon; a double click opens it.
  await page.getByTestId("app-debug").click();
  await expect(page.getByTestId("win-debug")).toHaveCount(0);
  await openDebug(page);
  await expect(page.getByTestId("win-debug-address")).toHaveText("orr://debug");
  await expect(page.getByTestId("tb-win-debug")).toBeVisible();
  await page.getByTestId("win-debug-close").click();
  await expect(page.getByTestId("win-debug")).toHaveCount(0);
  await expect(page.getByTestId("tb-win-debug")).toHaveCount(0);

  await page.getByTestId("tb-launcher").click();
  await expect(page.getByTestId("launch-debug")).toBeVisible();
  await page.getByTestId("launch-debug").click();
  await expect(page.getByTestId("launch-debug")).toHaveCount(0);
  await expect(page.getByTestId("debug-workspace")).toBeVisible();

  // The launcher closes on Escape and on a press outside it.
  await page.getByTestId("tb-launcher").click();
  await expect(page.getByTestId("launch-debug")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("launch-debug")).toHaveCount(0);
});

test("a window is focused, minimised, restored, maximised and closed", smoke, async ({ game }) => {
  const page = await game.launch();
  await desktop(page);
  await openDebug(page);
  const win = page.getByTestId("win-debug");
  const task = page.getByTestId("tb-win-debug");
  await expect(win).toHaveAttribute("data-focused", "true");
  await expect(task).toHaveAttribute("data-focused", "true");
  expect(await boxOf(page, "win-debug")).toEqual(OPENED);

  await page.getByTestId("win-debug-min").click();
  await expect(win).toHaveCount(0);
  await expect(task).toHaveAttribute("data-state", "minimised");
  await expect(task).toHaveAttribute("data-focused", "false");

  // The taskbar button brings it back, and minimises it again when it is the focused one.
  await task.click();
  await expect(win).toBeVisible();
  await expect(win).toHaveAttribute("data-focused", "true");
  expect(await boxOf(page, "win-debug")).toEqual(OPENED);
  await task.click();
  await expect(win).toHaveCount(0);
  await task.click();
  await expect(win).toBeVisible();

  await page.getByTestId("win-debug-max").click();
  await expect(win).toHaveAttribute("data-state", "maximised");
  expect(await boxOf(page, "win-debug")).toEqual({ x: 0, y: 0, ...DESK });
  // Maximised, it has no resize handles.
  await expect(page.getByTestId("win-debug-edge-se")).toHaveCount(0);
  await page.getByTestId("win-debug-max").click();
  await expect(win).toHaveAttribute("data-state", "normal");
  expect(await boxOf(page, "win-debug")).toEqual(OPENED);

  await page.getByTestId("win-debug-close").click();
  await expect(win).toHaveCount(0);
  await expect(task).toHaveCount(0);
});

/** Presses a resize handle `at` a point of it, moves by `by` and releases. */
async function dragHandle(
  page: Page,
  edge: string,
  at: { x: number; y: number } | null,
  by: { x: number; y: number },
): Promise<void> {
  const b = await boxOf(page, `win-debug-edge-${edge}`);
  const from =
    at === null ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : { x: b.x + at.x, y: b.y + at.y };
  await dragPointer(page, from, { x: from.x + by.x, y: from.y + by.y });
}

test("a real pointer resizes, drags and snaps a window", smoke, async ({ game }) => {
  const page = await game.launch();
  await desktop(page);
  await openDebug(page);
  const win = page.getByTestId("win-debug");
  /** Drags the title bar from its grip to a point of the page. */
  const dragTitle = async (to: { x: number; y: number }) => {
    const b = await boxOf(page, "win-debug");
    await dragPointer(page, { x: b.x + GRIP.x, y: b.y + GRIP.y }, to);
  };

  // Resize from the top left corner: the bottom right stays, the corner follows the pointer.
  await dragHandle(page, "nw", HANDLE_MIDDLE, { x: 600, y: 300 });
  expect(await boxOf(page, "win-debug")).toEqual({ x: 624, y: 300, width: 960, height: 554 });

  // Drag by the title bar.
  await dragTitle({ x: 224 + GRIP.x, y: 100 + GRIP.y });
  expect(await boxOf(page, "win-debug")).toEqual({ x: 224, y: 100, width: 960, height: 554 });
  await expect(win).toHaveAttribute("data-state", "normal");

  // Resize from the left edge (the right edge stays; the pointer going down changes nothing), and
  // from the bottom right corner, held by the part of it outside the frame.
  await dragHandle(page, "w", HANDLE_MIDDLE, { x: 100, y: 40 });
  expect(await boxOf(page, "win-debug")).toEqual({ x: 324, y: 100, width: 860, height: 554 });
  await dragHandle(page, "se", HANDLE_OUTSIDE, { x: -60, y: 46 });
  expect(await boxOf(page, "win-debug")).toEqual({ x: 324, y: 100, width: 800, height: 600 });
  // A window gets no smaller than 320x200 (wm.ts MIN_W, MIN_H).
  await dragHandle(page, "se", HANDLE_OUTSIDE, { x: -2000, y: -2000 });
  expect(await boxOf(page, "win-debug")).toEqual({ x: 324, y: 100, width: 320, height: 200 });
  await dragHandle(page, "se", HANDLE_OUTSIDE, { x: 540, y: 354 });
  expect(await boxOf(page, "win-debug")).toEqual({ x: 324, y: 100, width: 860, height: 554 });

  // A drag cannot take the window off the desktop, though the pointer goes on past the taskbar.
  await dragTitle({ x: 324 + GRIP.x, y: 100 + GRIP.y + 5000 });
  expect(await boxOf(page, "win-debug")).toEqual({
    x: 324,
    y: DESK.height - 554,
    width: 860,
    height: 554,
  });

  // Released at the left edge it takes the left half; at the right edge, the right half.
  await dragTitle({ x: 3, y: 300 });
  expect(await boxOf(page, "win-debug")).toEqual({ x: 0, y: 0, width: DESK.width / 2, height: DESK.height });
  await dragTitle({ x: DESK.width - 3, y: 300 });
  expect(await boxOf(page, "win-debug")).toEqual({
    x: DESK.width / 2,
    y: 0,
    width: DESK.width / 2,
    height: DESK.height,
  });

  // Released at the top edge it is maximised; a double click on the title bar puts it back.
  await dragTitle({ x: 700, y: 2 });
  await expect(win).toHaveAttribute("data-state", "maximised");
  expect(await boxOf(page, "win-debug")).toEqual({ x: 0, y: 0, ...DESK });
  await page.getByTestId("win-debug").locator(".os-titlebar").dblclick({ position: GRIP });
  await expect(win).toHaveAttribute("data-state", "normal");
});

test("a bottom resize handle can be pressed inside the frame", smoke, async ({ game }) => {
  // The handles sit above the app's content (os.css), so a window that touches the taskbar, as this
  // one does when it opens, can still be resized from its bottom.
  const page = await game.launch();
  await desktop(page);
  await openDebug(page);
  await dragHandle(page, "se", HANDLE_INSIDE, { x: -600, y: -300 });
  expect(await boxOf(page, "win-debug")).toEqual({ x: 24, y: 0, width: 960, height: 554 });
});

test("pause, resume and step move the taskbar clock", smoke, async ({ game }) => {
  const page = await game.launch();
  await desktop(page);
  const clock = page.getByTestId("tb-clock");
  const pause = page.getByTestId("tb-pause");
  const now = () => sim<number>(page, "sim.clock.now");
  await expect(clock).toContainText("00:00");
  expect(await now()).toBe(START);

  // Step runs one game hour and leaves the game paused.
  await page.getByTestId("tb-step").click();
  await expect(clock).toContainText("01:00");
  expect(await now()).toBe(START + 1);
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  // The full stop is the step key.
  await page.getByTestId("desktop").press(".");
  await expect(clock).toContainText("02:00");
  expect(await now()).toBe(START + 2);
  await expect(clock).toContainText("Tue 20 Oct 2020");

  // Picking a speed resumes; the clock runs until Pause.
  await page.getByTestId(`tb-speed-${WATCHED_SPEED}`).click();
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId(`tb-speed-${WATCHED_SPEED}`)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(now).toBeGreaterThanOrEqual(5);
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  const stopped = await now();
  expect(stopped).toBeLessThan(FIRST_ALERT_HOUR);
  await expect(clock).toContainText(`${String(stopped % 24).padStart(2, "0")}:00`);
  await page.waitForTimeout(600);
  expect(await now()).toBe(stopped);

  // The pause button resumes at the speed picked, and pauses again.
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await expect.poll(now).toBeGreaterThan(stopped);
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
});

test(
  "the phone is raised and lowered, and the mock runs to its first scripted pause",
  smoke,
  async ({ game }) => {
    const page = await game.launch();
    await desktop(page);
    const phone = page.getByTestId("phone");
    const button = page.getByTestId("tb-phone");
    await expect(phone).toBeHidden();
    await expect(button).toHaveAttribute("aria-label", "Phone");

    await button.click();
    await expect(phone).toBeVisible();
    await expect(phone).toHaveAttribute("data-open", "true");
    await expect(phone).toContainText("Nothing yet");
    await page.getByTestId("phone-down").click();
    await expect(phone).toBeHidden();

    // At full speed the mock reaches its first alert at once, which pauses it.
    await page.getByTestId("tb-speed-6").click();
    await expect.poll(() => sim<number>(page, "sim.clock.now")).toBe(FIRST_ALERT_HOUR);
    await expect(page.getByTestId("tb-pause")).toHaveAttribute("aria-pressed", "true");
    // The mock's scripted pauses arrive as the player's own, which the phone leaves out until it
    // reads v_notifications (M2): the count and the list are asserted then.
    await button.click();
    await expect(phone).toBeVisible();
    await button.click();
    await expect(phone).toBeHidden();
  },
);

test("a relaunch keeps the window layout and the phone", smoke, async ({ game }) => {
  const placed = { x: 200, y: 100, width: 960, height: 554 };
  let page = await game.launch();
  await desktop(page);
  await openDebug(page);
  await dragHandle(page, "nw", HANDLE_MIDDLE, { x: 600, y: 300 });
  await dragPointer(
    page,
    { x: 624 + GRIP.x, y: 300 + GRIP.y },
    { x: placed.x + GRIP.x, y: placed.y + GRIP.y },
  );
  expect(await boxOf(page, "win-debug")).toEqual(placed);
  await page.getByTestId("tb-phone").click();
  await expect(page.getByTestId("phone")).toBeVisible();
  // The desktop is written a moment after it changes (persist.ts DESKTOP_WRITE_DELAY_MS).
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), DESKTOP_KEY))
    .toContain('"phone_open":true');
  await game.quit();

  page = await game.launch();
  await desktop(page);
  await expect(page.getByTestId("win-debug")).toBeVisible();
  expect(await boxOf(page, "win-debug")).toEqual(placed);
  await expect(page.getByTestId("debug-workspace")).toBeVisible();
  await expect(page.getByTestId("phone")).toBeVisible();
  // It is a new game all the same: the layout is the viewer's, not the save's.
  expect(await sim<number>(page, "sim.clock.now")).toBe(START);
});
