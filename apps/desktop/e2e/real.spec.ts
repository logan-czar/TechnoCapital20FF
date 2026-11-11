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

    // The 1995 world has a new-game picker: set the seed, pick the scenario.
    await expect(page.getByRole("heading", { name: "New game: 1995" })).toBeVisible();
    // By its place in the list: one label ("Stable growth") is inside another ("Unstable growth").
    const index = await sim<number>(
      page,
      `sim.store.status.choices.scenarios.findIndex((s) => s.id === ${JSON.stringify(SCENARIO)})`,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    await page.getByLabel("Seed").fill(SEED);
    await page.locator(".new-game-choices button").nth(index).click();
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
