// Fidelity (pivot 3.2 to 3.5; D1035): the pre-simulation reaches the same state however it is cut
// into chunks, it can be cancelled, hydration switches a Coarse world to Full and ends its run, and
// the one Coarse-only job, the run's end, does not fire in a Full world. Not a Rust test.

import { gunzipSync, gzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  HYDRATE_BAR_YEARS,
  hydrateFirstBarKept,
  hydrateFull,
  presimAdvance,
  presimCancel,
  presimProgress,
  presimRun,
  presimSim,
  presimStart,
} from "../src/fidelity/index.ts";
import { scheduler } from "../src/jobs.ts";
import {
  type Sim,
  simControls,
  simHydrate,
  simNew,
  simStateHash,
  simStep,
  simViews,
  simWorld,
} from "../src/lib.ts";
import { barHistoryLen, barHistoryPush } from "../src/market/state.ts";
import { SAVE_GZIP_LEVEL, SAVE_MAGIC } from "../src/save.ts";
import { dateTimeDate, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { SLOT_VALUES, schedulerJobs } from "../src/time/scheduler.ts";
import { VIEW_NAMES } from "../src/types/views/index.ts";
import type { World } from "../src/types/world.ts";
import { data1995, unwrap } from "./common/index.ts";

/** Two months of the 1995 world: 59 days. */
const UNTIL = simDateYmd(1995, 3, 1);
const TICKS = 59 * 24;

function presimTo(seed: number, chunks: readonly number[]): Sim {
  const p = unwrap(presimStart(data1995(), seed, { until: UNTIL }));
  let i = 0;
  while (presimAdvance(p, chunks[i++ % chunks.length] as number).kind === "Progress");
  const sim = presimSim(p);
  if (sim === null) throw new Error("not done");
  return sim;
}

describe("the pre-simulation", () => {
  it("reaches one state hash in one go, in small chunks and by simStep", () => {
    const whole = presimTo(3, [1_000_000]);
    expect(whole.now()).toBe(dateTimeMidnight(UNTIL));
    const hash = simStateHash(whole);
    expect(simStateHash(presimTo(3, [1]))).toBe(hash);
    expect(simStateHash(presimTo(3, [7, 100, 1, 24]))).toBe(hash);

    const stepped = unwrap(simNew(data1995(), 3, { scenario: "random" }));
    while (stepped.now() < dateTimeMidnight(UNTIL)) simStep(stepped);
    expect(simStateHash(stepped)).toBe(hash);
    // The run's end rebuilt every view, as a load does; so load the stepped game to compare.
    unwrap(stepped.loadBytes(stepped.saveBytes()));
    const a = simViews(whole) as unknown as Record<string, { data: unknown }>;
    const b = simViews(stepped) as unknown as Record<string, { data: unknown }>;
    for (const n of VIEW_NAMES) expect(a[n]?.data, n).toEqual(b[n]?.data);
  }, 120_000);

  it("reports its ticks and the day reached, and stops at its end", () => {
    const p = unwrap(presimStart(data1995(), 1, { until: UNTIL }));
    expect(presimProgress(p)).toEqual({ done: 0, total: TICKS, date: simDateYmd(1995, 1, 1) });
    expect(presimSim(p)).toBeNull();
    expect(presimAdvance(p, 48)).toEqual({
      kind: "Progress",
      done: 48,
      total: TICKS,
      date: simDateYmd(1995, 1, 3),
    });
    const seen: number[] = [];
    const end = presimRun(p, (q) => void seen.push(q.done), 720);
    expect(end).toEqual({ kind: "Done", done: TICKS, total: TICKS, date: UNTIL });
    expect(seen).toEqual([768]);
    // Done stays done, and runs nothing more.
    expect(presimAdvance(p, 10)).toEqual(end);
    expect(presimSim(p)?.now()).toBe(dateTimeMidnight(UNTIL));
    // The game is paused at its first day, as a new game is.
    expect(simControls(p.sim).paused).toBe(true);
    expect(() => presimAdvance(p, 0)).toThrow(RangeError);
    expect(() => presimAdvance(p, 1.5)).toThrow(RangeError);
  });

  it("is cancelled between chunks", () => {
    const p = unwrap(presimStart(data1995(), 1, { until: UNTIL }));
    const end = presimRun(p, (q) => q.done < 200, 100);
    expect(end).toMatchObject({ kind: "Cancelled", done: 200 });
    expect(presimSim(p)).toBeNull();
    presimCancel(p);
    expect(presimAdvance(p, 100)).toMatchObject({ kind: "Cancelled", done: 200 });
    expect(p.sim.now() - dateTimeMidnight(simDateYmd(1995, 1, 1))).toBe(200);
  });

  it("plays the hidden random scenario unless told one, and only a historical world", () => {
    const hidden = unwrap(presimStart(data1995(), 5));
    expect(simWorld(hidden.sim).era?.scenario_hidden).toBe(true);
    // The world's own reveal date is where it ends: 25 years of hours.
    expect(dateTimeDate(hidden.target)).toEqual(simDateYmd(2020, 1, 1));
    expect(hidden.total).toBe(dateTimeMidnight(simDateYmd(2020, 1, 1)) - hidden.sim.now());
    const named = unwrap(presimStart(data1995(), 5, { scenario: "stagnation" }));
    expect(simWorld(named.sim).era?.scenario.id).toBe("stagnation");
    expect(simWorld(named.sim).era?.scenario_hidden).toBe(false);
    const d = data1995();
    const plain = { ...d, manifest: { ...d.manifest, features: { ...d.manifest.features, era: false } } };
    expect(presimStart(plain, 5).ok).toBe(false);
  });
});

describe("hydration", () => {
  it("switches a Coarse world to Full, ends its run and shows the scenario", () => {
    const sim = presimTo(2, [720]);
    const world = simWorld(sim);
    expect(world.fidelity).toBe("Coarse");
    expect(simViews(sim).history.data.scenario).toBeNull();
    const queued = JSON.stringify(world.news);
    const before = simStateHash(sim);

    const report = simHydrate(sim);
    expect(world.fidelity).toBe("Full");
    expect(report).toMatchObject({ date: UNTIL, ended_here: true, scenario: world.era?.scenario.label });
    expect(world.era?.ended).toBe(true);
    expect(world.era?.reveal_date).toEqual(UNTIL);
    expect(JSON.stringify(world.news)).not.toBe(queued);
    expect(JSON.stringify(world.news)).toContain(`The run ends. This world was ${report.scenario}`);
    expect(simStateHash(sim)).not.toBe(before);
    // The views were rebuilt: the history shows the scenario and the run as ended.
    const h = simViews(sim).history.data;
    expect(h.scenario).toBe(report.scenario);
    expect(h.run?.ended).toBe(true);
    // Still paused, with nothing posted.
    expect(simControls(sim).paused).toBe(true);
    // Twice is an error, as is a world with no run.
    expect(() => simHydrate(sim)).toThrow("already Full");
    expect(() => hydrateFull({ fidelity: "Full" } as unknown as World)).toThrow("not a historical world");

    // And it keeps running: a week of ticks, the views with it.
    for (let i = 0; i < 7 * 24; i++) simStep(sim);
    expect(sim.now()).toBe(dateTimeMidnight(UNTIL) + 7 * 24);
  }, 120_000);

  it("is a pure function of the Coarse state", () => {
    const a = presimTo(4, [720]);
    const b = presimTo(4, [50]);
    simHydrate(a);
    simHydrate(b);
    expect(simStateHash(a)).toBe(simStateHash(b));
  }, 120_000);

  it("leaves a run its own reveal has ended as it is", () => {
    const sim = presimTo(2, [720]);
    const era = simWorld(sim).era;
    if (era === undefined) throw new Error("no era");
    era.ended = true;
    const news = JSON.stringify(simWorld(sim).news);
    const reveal = era.reveal_date;
    expect(simHydrate(sim).ended_here).toBe(false);
    expect(JSON.stringify(simWorld(sim).news)).toBe(news);
    expect(era.reveal_date).toEqual(reveal);
  });

  it("keeps the last years of each stock's daily bars", () => {
    expect(hydrateFirstBarKept(simDateYmd(2020, 1, 1))).toEqual(simDateYmd(2020 - HYDRATE_BAR_YEARS, 1, 1));
    expect(hydrateFirstBarKept(simDateYmd(2020, 2, 29), 1)).toEqual(simDateYmd(2019, 2, 1));
    const sim = presimTo(2, [720]);
    const world = simWorld(sim);
    const stock = world.market.stocks.find((s) => barHistoryLen(s.bars) > 0);
    if (stock === undefined) throw new Error("no stock has bars");
    const kept = barHistoryLen(stock.bars);
    const total = world.market.stocks.reduce((n, s) => n + barHistoryLen(s.bars), 0);
    // Zero years back keeps this month's bars only: March 1995 has none yet.
    const report = hydrateFull(world, 0);
    expect(kept).toBeGreaterThan(0);
    expect(report.bars_dropped).toBe(total);
    expect(report.bars_kept).toBe(0);
    expect(barHistoryLen(stock.bars)).toBe(0);
    // The next close still appends.
    barHistoryPush(stock.bars, { date: UNTIL, open: 1, high: 1, low: 1, close: 1, efv: 1 });
    expect(barHistoryLen(stock.bars)).toBe(1);
  });
});

describe("fidelity tags", () => {
  it("the run's end and the Coarse campaigns are the Coarse-only jobs; the player's are the Full-only ones", () => {
    const s = scheduler();
    const tagged: string[] = [];
    for (const slot of SLOT_VALUES) {
      for (const [name, , fidelity] of schedulerJobs(s, slot)) {
        if (fidelity !== null) tagged.push(`${slot} ${name} ${fidelity}`);
      }
    }
    // Lane E's weekly Coarse campaigns too (pivot 6.6; D1040).
    expect(tagged).toEqual([
      "HourlyPlayer player.hourly Full",
      "DailyPlayer player.daily Full",
      "WeeklyJobs elections.coarse_campaigns Coarse",
      "YearlyArchive era.reveal Coarse",
    ]);
  });

  /** A 1995 game one day before a reveal date of 1 January 1996, in `fidelity`. */
  function beforeReveal(fidelity: "Coarse" | "Full"): Sim {
    const p = unwrap(presimStart(data1995(), 1, { until: simDateYmd(1995, 12, 31) }));
    presimRun(p, undefined, 8760);
    const world = simWorld(p.sim);
    if (world.era === undefined) throw new Error("no era");
    world.era.reveal_date = simDateYmd(1996, 1, 1);
    world.fidelity = fidelity;
    return p.sim;
  }

  it("a Coarse world's run ends at its reveal date; a Full world's does not", () => {
    const coarse = beforeReveal("Coarse");
    const full = beforeReveal("Full");
    // Resumed before every tick, so a pause is always posted.
    const runEnds = (sim: Sim): boolean => {
      unwrap(sim.apply({ kind: "Resume" }));
      return simStep(sim).some((n) => n.kind === "Paused" && n.reason.kind === "RunEnded");
    };
    let coarsePaused = false;
    let fullPaused = false;
    for (let i = 0; i < 48; i++) {
      if (runEnds(coarse)) coarsePaused = true;
      if (runEnds(full)) fullPaused = true;
    }
    expect(coarsePaused).toBe(true);
    expect(simWorld(coarse).era?.ended).toBe(true);
    expect(fullPaused).toBe(false);
    expect(simWorld(full).era?.ended).toBe(false);
    // The year still closed in both: the history has 1995.
    expect(simViews(full).history.data.years).toEqual([1995]);
    expect(simViews(coarse).history.data.years).toEqual([1995]);
  }, 200_000);
});

describe("the save's gzip level", () => {
  it("is not part of the format: a save written at fflate's default level loads to the same state", () => {
    const sim = presimTo(6, [720]);
    simHydrate(sim);
    const bytes = sim.saveBytes();
    const text = gunzipSync(bytes.subarray(SAVE_MAGIC.length));
    // As builds before D1035 wrote it: no level given.
    const body = gzipSync(text, { mtime: 0 });
    expect(SAVE_GZIP_LEVEL).not.toBe(6);
    expect(body.length).not.toBe(bytes.length - SAVE_MAGIC.length);
    const old = new Uint8Array(SAVE_MAGIC.length + body.length);
    old.set(SAVE_MAGIC, 0);
    old.set(body, SAVE_MAGIC.length);
    const a = unwrap(simNew(data1995(), 1));
    const b = unwrap(simNew(data1995(), 1));
    unwrap(a.loadBytes(old));
    unwrap(b.loadBytes(bytes));
    expect(simStateHash(a)).toBe(simStateHash(sim));
    expect(simStateHash(b)).toBe(simStateHash(sim));
  });
});
