// What every end-to-end test starts from: `game.launch(flags)` starts the built app with its own
// user-data folder under the scratch folder (apps/desktop/.scratch, never committed), a 1600x900
// window at scale 1 and the test hooks (scripts/drive.ts `launchApp`). Whatever a test launched is
// closed when it ends, and the process tree is killed if a close hangs.

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { closeApp, evalInPage, type Launched, launchApp } from "../scripts/drive.ts";

import { userDataRoot } from "./paths.ts";

export { expect };

/** The window's content size in every test, and the desktop inside it (the page less the taskbar). */
export const WINDOW = { width: 1600, height: 900 };
/** The taskbar's height (apps/web/src/os/Desktop.tsx TASKBAR_H). */
export const TASKBAR_H = 46;
export const DESK = { width: WINDOW.width, height: WINDOW.height - TASKBAR_H };
/** The desktop's saved-layout key (apps/web/src/os/persist.ts DESKTOP_KEY). */
export const DESKTOP_KEY = "tc20ff.os.v1";

export interface Game {
  /** This test's user-data folder: saves are in its `saves` folder. */
  userDataDir: string;
  /** Starts the app (`--mock` unless other flags are given) and returns its page. */
  launch(flags?: readonly string[]): Promise<Page>;
  /** Closes the app launched last, so a test can launch it again. */
  quit(): Promise<void>;
}

let serial = 0;

export const test = base.extend<{ game: Game }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's needs from this pattern
  game: async ({}, use, testInfo) => {
    const name = testInfo.title.replace(/\W+/g, "-").slice(0, 40);
    const userDataDir = join(userDataRoot, `${process.pid}-${++serial}-${name}`);
    mkdirSync(userDataDir, { recursive: true });
    const open: Launched[] = [];
    const shut = async (): Promise<void> => {
      const l = open.pop();
      if (l === undefined) return;
      // The sweep by command line costs about a second: only when the polite close did not work.
      const closed = await closeApp(l, "if-killed");
      expect(closed.stray, "processes left behind").toEqual([]);
    };
    await use({
      userDataDir,
      launch: async (flags = ["--mock"]) => {
        const l = await launchApp({ userDataDir, flags, size: WINDOW });
        open.push(l);
        return l.page;
      },
      quit: shut,
    });
    while (open.length > 0) await shut();
    // A failed test keeps its folder (its saves and the desktop's storage) to look at.
    if (testInfo.status === testInfo.expectedStatus) {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  },
});

/** `expr` evaluated in the page with `sim` bound to `window.__tcSim`. */
export function sim<T>(page: Page, expr: string): Promise<T> {
  return evalInPage(page, expr) as Promise<T>;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a test id is drawn, in page pixels (the window manager works in whole pixels). */
export async function boxOf(page: Page, testId: string): Promise<Box> {
  const b = await page.getByTestId(testId).boundingBox();
  if (b === null) throw new Error(`${testId} is not drawn`);
  return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
}

/** Waits for the desktop of a started game. */
export async function desktop(page: Page): Promise<void> {
  await expect(page.getByTestId("desktop")).toBeVisible();
  await expect(page.getByTestId("taskbar")).toBeVisible();
}

/**
 * The window the first run opens by itself (apps/web/src/App.tsx FIRST_APP, the news app; the
 * window manager numbers windows from 1 and a non-singleton app's is `<app>-<number>`).
 */
export const FIRST_WINDOW = "win-news-1";

/** Waits for the desktop of a started game and for the first run's news window to be drawn. */
export async function firstRun(page: Page): Promise<void> {
  await desktop(page);
  await expect(page.getByTestId(FIRST_WINDOW)).toBeVisible();
}

/**
 * Opens an app from the taskbar's launcher and waits for its window `id` to be drawn. The first
 * run's window covers the desktop's icons, so a test with it open goes this way.
 */
export async function openFromLauncher(page: Page, app: string, id: string): Promise<void> {
  await page.getByTestId("tb-launcher").click();
  await page.getByTestId(`launch-${app}`).click();
  await expect(page.getByTestId(`win-${id}`)).toBeVisible();
}

/** Opens an app from its desktop icon (a double click) and waits for its window `id` to be drawn. */
export async function openFromIcon(page: Page, app: string, id: string): Promise<void> {
  await page.getByTestId(`app-${app}`).dblclick();
  await expect(page.getByTestId(`win-${id}`)).toBeVisible();
}
