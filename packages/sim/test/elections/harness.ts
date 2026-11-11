// Drives the elections and the POC's daily politics job alone, day by day, on a world (D1040): the
// economy need not run for the vote. The jobs run in their slot order (DailyPolitics, then
// DailyElections; the weekly Coarse campaign on Mondays).

import { electionsDailyJob, electionsWeeklyJob } from "../../src/elections/jobs.ts";
import { simNew, simWorld } from "../../src/lib.ts";
import { politicsJob } from "../../src/politics/jobs.ts";
import { rngStreamsDraws, rngStreamsNew } from "../../src/rng.ts";
import { dateTimeMidnight, simDateAddDays, simDateWeekday } from "../../src/time/calendar.ts";
import { jobCtxDetached, tickFactsNew } from "../../src/time/scheduler.ts";
import type { SimDate } from "../../src/types/calendar.ts";
import { cmpDate } from "../../src/types/calendar.ts";
import type { DrawSource } from "../../src/types/draws.ts";
import type { World } from "../../src/types/world.ts";
import { data1995 } from "../common/index.ts";

/** A new 1995 world (its start has run: the POC's seats, the bridge, the 1995 races). */
export function start1995(seed: number): World {
  const made = simNew(data1995(), seed, { scenario: "stable" });
  if (!made.ok) throw new Error("did not load");
  return simWorld(made.value);
}

/** The draws a run uses: their own streams, seeded apart from the world's. */
export function runDraws(seed: number): DrawSource {
  return rngStreamsDraws(rngStreamsNew(seed + 1000));
}

/** Runs the daily politics and elections jobs on every day from `from` to `to`, inclusive. */
export function runDays(world: World, draws: DrawSource, from: SimDate, to: SimDate): void {
  for (let d = from; cmpDate(d, to) <= 0; d = simDateAddDays(d, 1)) {
    world.clock = dateTimeMidnight(d);
    const ctx = jobCtxDetached(tickFactsNew(world.clock), draws, []);
    politicsJob(world, ctx);
    electionsDailyJob(world, ctx);
    if (simDateWeekday(d) === "Mon") electionsWeeklyJob(world, ctx);
  }
}
