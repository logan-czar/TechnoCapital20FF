// The smoke suite (`pnpm e2e:smoke`, tag @smoke): the built app on the mock sim, driven as a
// player would with a real pointer and keyboard. Each test launches its own app. The whole suite is
// meant to stay under a minute (apps/desktop/README.md "End-to-end tests").
//
// The mock plays its election-year world (apps/web/src/sim/mock/README.md): it starts by itself,
// paused at 00:00 on Tue 20 Oct 2020 (hour START), and its first scripted pause is at 14:00 on
// 23 Oct (a resignation the player holds a position on, a v_notifications row).
//
// A new game opens the news app by itself (the first run), so the windows tests use it and Records,
// which are real apps. The debug workspace is debug-only (Omniscient, a dev-server toggle): the
// built app has no way to turn that on, so no test here opens it.

import type { Page } from "@playwright/test";
import { dragPointer } from "../scripts/drive.ts";
import {
  boxOf,
  DESK,
  DESKTOP_KEY,
  desktop,
  expect,
  FIRST_WINDOW,
  firstRun,
  openFromIcon,
  openFromLauncher,
  sim,
  test,
} from "./fixtures.ts";

const smoke = { tag: "@smoke" };

/** The first run's window, and its taskbar button, handles and buttons (the test ids derive from it). */
const NEWS = FIRST_WINDOW;
/** The window opened second (the window manager's counter is shared by every app). */
const RECORDS = "win-records-2";
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

test("boots to the desktop, paused, with the news app open", smoke, async ({ game }) => {
  const page = await game.launch();
  await firstRun(page);
  await expect(page.getByTestId("app-news")).toBeVisible();
  await expect(page.getByTestId("app-records")).toBeVisible();
  // The debug workspace is debug-only: not on this desktop.
  await expect(page.getByTestId("app-debug")).toHaveCount(0);
  await expect(page.getByTestId("tb-launcher")).toBeVisible();
  await expect(page.getByTestId("tb-win-news-1")).toBeVisible();
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

test("opens an app from its icon and from the launcher", smoke, async ({ game }) => {
  const page = await game.launch();
  await firstRun(page);
  // The first run's window covers the icons: the player closes it to reach them.
  await page.getByTestId("win-news-1-close").click();
  await expect(page.getByTestId(NEWS)).toHaveCount(0);

  // One click only selects an icon; a double click opens it.
  await page.getByTestId("app-records").click();
  await expect(page.getByTestId(RECORDS)).toHaveCount(0);
  await openFromIcon(page, "records", "records-2");
  await expect(page.getByTestId("win-records-2-address")).toHaveText("orr://records");
  await expect(page.getByTestId("tb-win-records-2")).toBeVisible();
  await page.getByTestId("win-records-2-close").click();
  await expect(page.getByTestId(RECORDS)).toHaveCount(0);
  await expect(page.getByTestId("tb-win-records-2")).toHaveCount(0);

  // The launcher opens an app too; a closed window's number is not used again.
  await page.getByTestId("tb-launcher").click();
  await expect(page.getByTestId("launch-records")).toBeVisible();
  await page.getByTestId("launch-records").click();
  await expect(page.getByTestId("launch-records")).toHaveCount(0);
  await expect(page.getByTestId("win-records-3")).toBeVisible();

  // The launcher closes on Escape and on a press outside it.
  await page.getByTestId("tb-launcher").click();
  await expect(page.getByTestId("launch-records")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("launch-records")).toHaveCount(0);
});

test("a window is focused, minimised, restored, maximised and closed", smoke, async ({ game }) => {
  const page = await game.launch();
  await firstRun(page);
  const win = page.getByTestId(NEWS);
  const task = page.getByTestId("tb-win-news-1");
  await expect(win).toHaveAttribute("data-focused", "true");
  await expect(task).toHaveAttribute("data-focused", "true");
  // Where it opened, whatever the app's default size is (it is fitted to the desktop).
  const opened = await boxOf(page, NEWS);
  expect(opened.x).toBeGreaterThanOrEqual(0);
  expect(opened.x + opened.width).toBeLessThanOrEqual(DESK.width);
  expect(opened.y + opened.height).toBeLessThanOrEqual(DESK.height);

  await page.getByTestId("win-news-1-min").click();
  await expect(win).toHaveCount(0);
  await expect(task).toHaveAttribute("data-state", "minimised");
  await expect(task).toHaveAttribute("data-focused", "false");

  // The taskbar button brings it back, and minimises it again when it is the focused one.
  await task.click();
  await expect(win).toBeVisible();
  await expect(win).toHaveAttribute("data-focused", "true");
  expect(await boxOf(page, NEWS)).toEqual(opened);
  await task.click();
  await expect(win).toHaveCount(0);
  await task.click();
  await expect(win).toBeVisible();

  await page.getByTestId("win-news-1-max").click();
  await expect(win).toHaveAttribute("data-state", "maximised");
  expect(await boxOf(page, NEWS)).toEqual({ x: 0, y: 0, ...DESK });
  // Maximised, it has no resize handles.
  await expect(page.getByTestId("win-news-1-edge-se")).toHaveCount(0);
  await page.getByTestId("win-news-1-max").click();
  await expect(win).toHaveAttribute("data-state", "normal");
  expect(await boxOf(page, NEWS)).toEqual(opened);

  await page.getByTestId("win-news-1-close").click();
  await expect(win).toHaveCount(0);
  await expect(task).toHaveCount(0);
});

test("focus moves between two different apps, by a press and by the taskbar", smoke, async ({ game }) => {
  const page = await game.launch();
  await firstRun(page);
  await openFromLauncher(page, "records", "records-2");
  const news = page.getByTestId(NEWS);
  const records = page.getByTestId(RECORDS);
  const newsTask = page.getByTestId("tb-win-news-1");
  const recordsTask = page.getByTestId("tb-win-records-2");
  /** The window's stacking order, from the page: the one in front has the higher z-index. */
  const z = (id: string) => page.getByTestId(id).evaluate((el) => Number(getComputedStyle(el).zIndex));

  // The one opened last is in front and has the focus; only one window is focused at a time.
  await expect(records).toHaveAttribute("data-focused", "true");
  await expect(news).toHaveAttribute("data-focused", "false");
  await expect(recordsTask).toHaveAttribute("data-focused", "true");
  await expect(newsTask).toHaveAttribute("data-focused", "false");
  expect(await z(RECORDS)).toBeGreaterThan(await z(NEWS));

  // A press on the other window's title bar (the part of it Records leaves uncovered) focuses it.
  await news.locator(".os-titlebar").click({ position: { x: 120, y: 8 } });
  await expect(news).toHaveAttribute("data-focused", "true");
  await expect(records).toHaveAttribute("data-focused", "false");
  await expect(newsTask).toHaveAttribute("data-focused", "true");
  expect(await z(NEWS)).toBeGreaterThan(await z(RECORDS));

  // The taskbar button of an unfocused window focuses it; both stay open.
  await recordsTask.click();
  await expect(records).toHaveAttribute("data-focused", "true");
  await expect(news).toHaveAttribute("data-focused", "false");
  await expect(news).toBeVisible();

  // Minimising the focused one hands the focus to the one behind it.
  await page.getByTestId("win-records-2-min").click();
  await expect(records).toHaveCount(0);
  await expect(news).toHaveAttribute("data-focused", "true");
  await expect(newsTask).toHaveAttribute("data-focused", "true");
  await expect(recordsTask).toHaveAttribute("data-focused", "false");

  // Closing the focused window leaves the other focused.
  await recordsTask.click();
  await expect(records).toHaveAttribute("data-focused", "true");
  await page.getByTestId("win-records-2-close").click();
  await expect(news).toHaveAttribute("data-focused", "true");
});

/** Presses a resize handle `at` a point of it, moves by `by` and releases. */
async function dragHandle(
  page: Page,
  edge: string,
  at: { x: number; y: number } | null,
  by: { x: number; y: number },
): Promise<void> {
  const b = await boxOf(page, `${NEWS}-edge-${edge}`);
  const from =
    at === null ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : { x: b.x + at.x, y: b.y + at.y };
  await dragPointer(page, from, { x: from.x + by.x, y: from.y + by.y });
}

test("a real pointer resizes, drags and snaps a window", smoke, async ({ game }) => {
  const page = await game.launch();
  await firstRun(page);
  const win = page.getByTestId(NEWS);
  const first = await boxOf(page, NEWS);
  /** Drags the title bar from its grip to a point of the page. */
  const dragTitle = async (to: { x: number; y: number }) => {
    const b = await boxOf(page, NEWS);
    await dragPointer(page, { x: b.x + GRIP.x, y: b.y + GRIP.y }, to);
  };

  // Resize from the top left corner: the bottom right stays, the corner follows the pointer.
  await dragHandle(page, "nw", HANDLE_MIDDLE, { x: 300, y: 150 });
  expect(await boxOf(page, NEWS)).toEqual({
    x: first.x + 300,
    y: first.y + 150,
    width: first.width - 300,
    height: first.height - 150,
  });

  // Drag by the title bar.
  const size = { width: first.width - 300, height: first.height - 150 };
  await dragTitle({ x: 224 + GRIP.x, y: 100 + GRIP.y });
  expect(await boxOf(page, NEWS)).toEqual({ x: 224, y: 100, ...size });
  await expect(win).toHaveAttribute("data-state", "normal");

  // Resize from the left edge (the right edge stays; the pointer going down changes nothing), and
  // from the bottom right corner, held by the part of it outside the frame.
  await dragHandle(page, "w", HANDLE_MIDDLE, { x: 100, y: 40 });
  expect(await boxOf(page, NEWS)).toEqual({ x: 324, y: 100, width: size.width - 100, height: size.height });
  await dragHandle(page, "se", HANDLE_OUTSIDE, { x: -60, y: 46 });
  expect(await boxOf(page, NEWS)).toEqual({
    x: 324,
    y: 100,
    width: size.width - 160,
    height: size.height + 46,
  });
  // A window gets no smaller than 320x200 (wm.ts MIN_W, MIN_H).
  await dragHandle(page, "se", HANDLE_OUTSIDE, { x: -2000, y: -2000 });
  expect(await boxOf(page, NEWS)).toEqual({ x: 324, y: 100, width: 320, height: 200 });
  await dragHandle(page, "se", HANDLE_OUTSIDE, { x: 540, y: 354 });
  expect(await boxOf(page, NEWS)).toEqual({ x: 324, y: 100, width: 860, height: 554 });

  // A drag cannot take the window off the desktop, though the pointer goes on past the taskbar.
  await dragTitle({ x: 324 + GRIP.x, y: 100 + GRIP.y + 5000 });
  expect(await boxOf(page, NEWS)).toEqual({
    x: 324,
    y: DESK.height - 554,
    width: 860,
    height: 554,
  });

  // Released at the left edge it takes the left half; at the right edge, the right half.
  await dragTitle({ x: 3, y: 300 });
  expect(await boxOf(page, NEWS)).toEqual({ x: 0, y: 0, width: DESK.width / 2, height: DESK.height });
  await dragTitle({ x: DESK.width - 3, y: 300 });
  expect(await boxOf(page, NEWS)).toEqual({
    x: DESK.width / 2,
    y: 0,
    width: DESK.width / 2,
    height: DESK.height,
  });

  // Released at the top edge it is maximised; a double click on the title bar puts it back.
  await dragTitle({ x: 700, y: 2 });
  await expect(win).toHaveAttribute("data-state", "maximised");
  expect(await boxOf(page, NEWS)).toEqual({ x: 0, y: 0, ...DESK });
  await page.getByTestId(NEWS).locator(".os-titlebar").dblclick({ position: GRIP });
  await expect(win).toHaveAttribute("data-state", "normal");
});

test("a bottom resize handle can be pressed inside the frame", smoke, async ({ game }) => {
  // The handles sit above the app's content (os.css), so a window that touches the taskbar can
  // still be resized from its bottom: the window is moved down to the taskbar first.
  const page = await game.launch();
  await firstRun(page);
  const first = await boxOf(page, NEWS);
  await dragPointer(
    page,
    { x: first.x + GRIP.x, y: first.y + GRIP.y },
    { x: first.x + GRIP.x, y: first.y + GRIP.y + 5000 },
  );
  const down = await boxOf(page, NEWS);
  expect(down.y + down.height).toBe(DESK.height);
  await dragHandle(page, "se", HANDLE_INSIDE, { x: -200, y: -150 });
  expect(await boxOf(page, NEWS)).toEqual({
    x: down.x,
    y: down.y,
    width: down.width - 200,
    height: down.height - 150,
  });
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
  "the phone is raised and lowered, and the mock's first scripted pause is a notification",
  smoke,
  async ({ game }) => {
    const page = await game.launch();
    await desktop(page);
    const phone = page.getByTestId("phone");
    const button = page.getByTestId("tb-phone");
    const notes = "sim.store.getView('notifications').data.items";
    await expect(phone).toBeHidden();
    await expect(page.getByTestId("tb-pause-note")).toHaveCount(0);
    // The mock's player has history before the first day: notifications, none read. The badge
    // counts them; picking the phone up shows them and reads them.
    const history = await sim<number>(page, `${notes}.length`);
    expect(history).toBeGreaterThan(0);
    await expect(button).toHaveAttribute("aria-label", `Phone, ${history} new`);

    await button.click();
    await expect(phone).toBeVisible();
    await expect(phone).toHaveAttribute("data-open", "true");
    await expect(page.getByTestId("phone-notifications").getByRole("listitem")).toHaveCount(history);
    await expect(button).toHaveAttribute("aria-label", "Phone");
    await page.getByTestId("phone-down").click();
    await expect(phone).toBeHidden();

    // At full speed the mock runs to its first scripted pause, which is a notification: the game
    // pauses and the taskbar says which one paused it and counts what is unread.
    await page.getByTestId("tb-speed-6").click();
    await expect.poll(() => sim<number>(page, "sim.clock.now")).toBe(FIRST_ALERT_HOUR);
    await expect(page.getByTestId("tb-pause")).toHaveAttribute("aria-pressed", "true");
    const pausedBy = page.getByTestId("tb-pause-note");
    await expect(pausedBy).toBeVisible();
    const unread = await sim<number>(
      page,
      `${notes}.filter((n) => n.id > sim.store.getView('notifications').data.read_through).length`,
    );
    expect(unread).toBeGreaterThan(0);
    await expect(button).toHaveAttribute("aria-label", `Phone, ${unread} new`);

    // The note jumps to it on the phone, where it is marked as having paused the game; seeing the
    // list reads it, and the count goes.
    // The one the game's own pause names (several may ask to pause at the same hour).
    const pausingId = await sim<number>(
      page,
      "sim.store.notices.findLast((e) => e.notice.kind === 'Paused').notice.reason.id",
    );
    await pausedBy.click();
    await expect(phone).toBeVisible();
    const row = page.getByTestId(`phone-note-${pausingId}`);
    await expect(row).toHaveAttribute("data-current", "true");
    await expect(row).toHaveAttribute("data-paused", "true");
    await expect(row).toContainText("Paused the game");
    await expect(button).toHaveAttribute("aria-label", "Phone");
    expect(await sim<number>(page, "sim.store.getView('notifications').data.read_through")).toBe(
      await sim<number>(page, `${notes}.length - 1`),
    );

    // The pause note goes when the game runs again.
    await page.getByTestId("tb-pause").click();
    await expect(page.getByTestId("tb-pause-note")).toHaveCount(0);
    await button.click();
    await expect(phone).toBeHidden();
  },
);

test(
  "the fixed pauses are switched in the settings, and a fill and a margin call are locked",
  smoke,
  async ({ game }) => {
    const page = await game.launch();
    await desktop(page);
    await page.getByTestId("tb-pauses").click();
    await expect(page.getByTestId("pause-settings")).toBeVisible();
    for (const locked of ["OwnFill", "MarginCall"]) {
      await expect(page.getByTestId(`pause-${locked}`)).toBeChecked();
      await expect(page.getByTestId(`pause-${locked}`)).toBeDisabled();
    }
    await expect(page.getByTestId("pause-ElectionDay")).toBeChecked();
    // The switch shows what the sim says (v_clock), so it settles a moment after the click.
    await page.getByTestId("pause-ElectionDay").click();
    await expect(page.getByTestId("pause-ElectionDay")).not.toBeChecked();
    expect(await sim(page, "sim.clock.fixed_pauses")).toEqual({
      OwnFill: true,
      MarginCall: true,
      ElectionDay: false,
      Holding: true,
    });
    await page.getByTestId("pause-ElectionDay").click();
    await expect.poll(() => sim<boolean>(page, "sim.clock.fixed_pauses.ElectionDay")).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-settings")).toHaveCount(0);
  },
);

test("a relaunch keeps the window layout and the phone", smoke, async ({ game }) => {
  const placed = { x: 200, y: 100 };
  let page = await game.launch();
  await firstRun(page);
  const first = await boxOf(page, NEWS);
  await dragPointer(
    page,
    { x: first.x + GRIP.x, y: first.y + GRIP.y },
    { x: placed.x + GRIP.x, y: placed.y + GRIP.y },
  );
  const moved = await boxOf(page, NEWS);
  expect(moved).toEqual({ ...placed, width: first.width, height: first.height });
  await page.getByTestId("tb-phone").click();
  await expect(page.getByTestId("phone")).toBeVisible();
  // The desktop is written a moment after it changes (persist.ts DESKTOP_WRITE_DELAY_MS).
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), DESKTOP_KEY))
    .toContain('"phone_open":true');
  await game.quit();

  page = await game.launch();
  await desktop(page);
  await expect(page.getByTestId(NEWS)).toBeVisible();
  expect(await boxOf(page, NEWS)).toEqual(moved);
  // The saved layout is the whole desktop: the first run did not open a second news window.
  await expect(page.getByTestId("win-news-2")).toHaveCount(0);
  await expect(page.getByTestId("phone")).toBeVisible();
  // It is a new game all the same: the layout is the viewer's, not the save's.
  expect(await sim<number>(page, "sim.clock.now")).toBe(START);
});
