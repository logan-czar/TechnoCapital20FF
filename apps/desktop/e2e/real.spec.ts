// The real-sim suite (tag @real; part of `pnpm e2e`, not of the smoke suite): the app on the real
// sim in its utility process, the 1995 world. It launches the real sim, so it runs under the
// machine-wide lock (e2e/run.ts takes it through scripts/heavy).

import { existsSync } from "node:fs";
import { join } from "node:path";
import { desktop, expect, sim, test } from "./fixtures.ts";

const real = { tag: "@real" };

/** The new game: a fixed seed and the scenario the app's own smoke run plays (flags.ts SMOKE_SCENARIO). */
const SEED = "1";
const SCENARIO = "stable";
const SLOT = "e2e-real";
/** Game hours in the day the test steps (the Step control takes up to 168, control.ts MAX_STEP_HOURS). */
const DAY_HOURS = 24;

interface Clock {
  now: number;
  date: { year: number; month: number; day: number };
  hour: number;
  paused: boolean;
}

test(
  "a new 1995 game steps a day, saves to a slot and comes back from --save at the same clock",
  real,
  async ({ game }) => {
    let page = await game.launch([]);
    expect(await sim(page, "({ mock: tcHost.flags.mock, world: tcHost.flags.world })")).toEqual({
      mock: false,
      world: null,
    });

    // The 1995 world has a new-game picker. The developer's start (a scenario and a seed) is in
    // the picker's fold-out, which the test hooks switch on; each scenario has its own test id
    // ("Stable growth" is a substring of "Unstable growth", so a label would match both).
    await expect(page.getByTestId("new-game")).toBeVisible();
    await page.getByTestId("new-game-seed").fill(SEED);
    await page.getByTestId("new-game-dev").locator("summary").click();
    await page.getByTestId(`new-game-scenario-${SCENARIO}`).click();
    await desktop(page);
    const clock = page.getByTestId("tb-clock");
    await expect(clock).toContainText("00:00");
    await expect(clock).toContainText("01 Jan 1995");
    const start = await sim<Clock>(page, "sim.clock");
    expect(start.paused).toBe(true);

    // One hour from the taskbar, then the rest of the day in one Step. An alert may pause the game
    // on the way (pivot 2.4): step on from wherever it stopped.
    await page.getByTestId("tb-step").click();
    await expect.poll(() => sim<number>(page, "sim.clock.now")).toBe(start.now + 1);
    const target = start.now + DAY_HOURS;
    await expect
      .poll(
        async () => {
          const c = await sim<Clock>(page, "sim.clock");
          if (c.paused && c.now < target) {
            await sim(page, `sim.control({ kind: "Step", hours: ${target - c.now} })`);
          }
          return c.paused ? c.now : -1;
        },
        { timeout: 60_000 },
      )
      .toBe(target);
    await expect(clock).toContainText("00:00");
    await expect(clock).toContainText("02 Jan 1995");
    const text = await clock.innerText();

    expect(await sim<{ kind: string }>(page, `sim.saveSlot(${JSON.stringify(SLOT)})`)).toMatchObject({
      kind: "Ok",
    });
    const saved = await sim<Clock>(page, "sim.clock");
    expect(saved.now).toBe(target);
    const file = join(game.userDataDir, "saves", `${SLOT}.tcsave`);
    expect(existsSync(file)).toBe(true);
    expect(existsSync(`${file}.json`)).toBe(true);
    const listed = await sim<{ slot: string }[]>(page, "sim.listSaves()");
    expect(listed.map((s) => s.slot)).toContain(SLOT);
    await game.quit();

    // The save comes up with no picker, paused, at the clock it was saved at.
    page = await game.launch([`--save=${file}`]);
    await desktop(page);
    await expect.poll(() => sim<number | null>(page, "sim.clock && sim.clock.now")).toBe(saved.now);
    const loaded = await sim<Clock>(page, "sim.clock");
    expect({ date: loaded.date, hour: loaded.hour, paused: loaded.paused }).toEqual({
      date: saved.date,
      hour: saved.hour,
      paused: true,
    });
    expect(await page.getByTestId("tb-clock").innerText()).toBe(text);
  },
);

test(
  "generates a new history from the picker, cancelling once, and starts in 2020 on the news app",
  real,
  async ({ game }) => {
    const page = await game.launch([]);
    await expect(page.getByTestId("new-game")).toBeVisible();

    // Cancel: the progress screen comes up, Cancel stops it, the picker is back and says so.
    await page.getByTestId("new-game-generate").click();
    await expect(page.getByTestId("new-game-progress")).toBeVisible();
    await page.getByTestId("new-game-cancel").click();
    await expect(page.getByTestId("new-game-generate")).toBeVisible();
    await expect(page.getByTestId("new-game-error")).toContainText("Cancelled");
    expect(await sim<boolean>(page, "sim.store.status.started")).toBe(false);

    // Generate for real: the screen reports the phase and the date it has reached, then the desktop
    // comes up on 1 January 2020 with the news app open.
    const began = Date.now();
    await page.getByTestId("new-game-generate").click();
    await expect(page.getByTestId("new-game-progress")).toBeVisible();
    await expect(page.getByTestId("new-game-phase")).not.toHaveText("Starting", { timeout: 30_000 });
    await expect(page.getByTestId("new-game-date")).toContainText(/\d{4}/, { timeout: 30_000 });
    // The pre-simulation takes 10 to 20 s in the app: wait for it before the desktop's own checks.
    await expect(page.getByTestId("desktop")).toBeVisible({ timeout: 90_000 });
    await desktop(page);
    const seconds = (Date.now() - began) / 1000;
    console.log(`generated a new history in ${seconds.toFixed(1)} s`);
    await expect(page.getByTestId("tb-clock")).toContainText("2020");
    await expect(page.getByTestId("tb-pause")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("win-news-1")).toBeVisible();
    expect(await sim<boolean>(page, "sim.store.status.progress === null")).toBe(true);
    // It plays: one hour from the taskbar moves the clock.
    const now = await sim<number>(page, "sim.clock.now");
    await page.getByTestId("tb-step").click();
    await expect.poll(() => sim<number>(page, "sim.clock.now")).toBe(now + 1);
  },
);
