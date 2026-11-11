// A baked start (pivot 3.2 to 3.5; D1035), made in this process as the headless `bake` makes one:
// the 1995 world pre-simulated to 2020 at Coarse fidelity, hydrated, saved and loaded. The 25-year
// run reaches the same state in large chunks and in small ones; the loaded start has the saved
// hash and plays on. Slow: two 25-year runs. Not a Rust test.

import { describe, expect, it } from "vitest";
import { HYDRATE_BAR_YEARS, presimAdvance, presimSim, presimStart } from "../src/fidelity/index.ts";
import {
  type Sim,
  simHydrate,
  simLoadBytes,
  simNew,
  simSaveBytes,
  simStateHash,
  simStep,
  simViews,
  simWorld,
} from "../src/lib.ts";
import { barHistoryIter } from "../src/market/state.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { cmpDate } from "../src/types/calendar.ts";
import { data1995, macrotask, unwrap } from "./common/index.ts";

const SEED = 1;
const PLAY_START = simDateYmd(2020, 1, 1);
/** A save of a hydrated 2020 must stay well under the 64 MB an untrimmed one is (D1035). */
const MAX_SAVE_BYTES = 40_000_000;

/** The 1995 world pre-simulated to 2020, `chunk` ticks at a time. */
async function presim(chunk: number): Promise<Sim> {
  const p = unwrap(presimStart(data1995(), SEED));
  let step = presimAdvance(p, chunk);
  while (step.kind === "Progress") {
    await macrotask();
    step = presimAdvance(p, chunk);
  }
  expect(step).toMatchObject({ kind: "Done", done: step.total, date: PLAY_START });
  const sim = presimSim(p);
  if (sim === null) throw new Error("not done");
  return sim;
}

describe("a baked start", () => {
  it("is the same in large and small chunks, saves, loads and plays on", async () => {
    // Five years a call, then the hash; the game is dropped before the next run starts.
    const coarseHash = simStateHash(await presim(5 * 8766));
    const sim = await presim(997);
    expect(simStateHash(sim)).toBe(coarseHash);

    // The run ended itself on its last Coarse tick; hydration leaves that as it is.
    const report = simHydrate(sim);
    const world = simWorld(sim);
    expect(report.ended_here).toBe(false);
    expect(report.date).toEqual(PLAY_START);
    expect(world.fidelity).toBe("Full");
    expect(world.era?.ended).toBe(true);
    expect(simViews(sim).history.data.scenario).toBe(world.era?.scenario.label);
    expect(simViews(sim).history.data.years.at(-1)).toBe(2019);
    expect(sim.controls().paused).toBe(true);
    // Only the last years of daily bars are left. A historical world's stocks keep as many as the
    // hydration does (market/jobs.ts `ERA_STOCK_BAR_YEARS_KEPT`, D1038), so its 1 January archive
    // has already dropped the rest and the hydration drops none.
    const firstKept = simDateYmd(2020 - HYDRATE_BAR_YEARS, 1, 1);
    expect(report.bars_dropped).toBe(0);
    expect(report.bars_kept).toBeGreaterThan(0);
    for (const s of world.market.stocks) {
      const first = barHistoryIter(s.bars).next().value;
      if (first !== undefined) expect(cmpDate(first.date, firstKept)).toBeGreaterThanOrEqual(0);
    }

    const hash = simStateHash(sim);
    const bytes = simSaveBytes(sim);
    expect(bytes.length).toBeLessThan(MAX_SAVE_BYTES);
    await macrotask();

    // A game of another seed loads it: the same state, paused, Full.
    const loaded = unwrap(simNew(data1995(), SEED + 1));
    unwrap(simLoadBytes(loaded, bytes));
    expect(simStateHash(loaded)).toBe(hash);
    expect(simWorld(loaded).fidelity).toBe("Full");
    expect(loaded.controls().paused).toBe(true);
    await macrotask();

    // Both play a day, with the views, to the same state.
    for (let i = 0; i < 24; i++) {
      simStep(sim);
      simStep(loaded);
    }
    expect(loaded.now()).toBe(dateTimeMidnight(simDateYmd(2020, 1, 2)));
    expect(simStateHash(loaded)).toBe(simStateHash(sim));
    expect(simWorld(loaded).fidelity).toBe("Full");
  }, 900_000);
});
