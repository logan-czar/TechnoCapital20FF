// Port of crates/sim/tests/common/economy.rs: helpers for the M2 economy tests: a world at load
// from any draw source, and the monthly economy run month by month through the economy own jobs
// only (so later milestones jobs in the same slots, which draw from other streams, never reach a
// scripted source).
//
// Expects:
//   ../../../src/world/load.ts        worldFromData(data) -> Result<World, LoadError>
//   ../../../src/economy/start.ts     start(world, draws)                  [economy::start]
//   ../../../src/economy/index.ts     register(scheduler)                  [economy::register]
//   ../../../src/time/scheduler.ts    schedulerNew(), schedulerRunSlots(s, slots, world, ctx),
//                                     jobCtxNew(facts, draws, notices, controls), tickFactsNew(clock),
//                                     slotGroup(slot), slotIsDue(slot, facts), SLOT_VALUES (Slot::ALL),
//                                     types Scheduler, Slot, JobCtx
//   ../../../src/time/control.ts      controlsDefault()
//   ../../../src/time/calendar.ts     simDateMonthOf, monthFirstDay, monthNext, dateTimeMidnight,
//                                     cmpDate
import type { WorldData } from "@tc20ff/sim-data";
import { register as economyRegister } from "../../../src/economy/index.ts";
import { start } from "../../../src/economy/start.ts";
import {
  cmpDate,
  dateTimeMidnight,
  monthFirstDay,
  monthNext,
  simDateMonthOf,
} from "../../../src/time/calendar.ts";
import { controlsDefault } from "../../../src/time/control.ts";
import {
  jobCtxNew,
  type Scheduler,
  SLOT_VALUES,
  schedulerNew,
  schedulerRunSlots,
  slotGroup,
  slotIsDue,
  tickFactsNew,
} from "../../../src/time/scheduler.ts";
import type { SimDate } from "../../../src/types/calendar.ts";
import type { DrawSource } from "../../../src/types/draws.ts";
import type { IndustryId } from "../../../src/types/ids.ts";
import type { Notice, World } from "../../../src/types/world.ts";
import { worldFromData } from "../../../src/world/load.ts";
import { unwrap } from "../../common/index.ts";

/** The world after load and the 7.3 start draws from draws. */
export function worldAtLoad(d: WorldData, draws: DrawSource): World {
  const w = unwrap(worldFromData(structuredClone(d)), "World::from_data");
  start(w, draws);
  return w;
}

/** A scheduler with only the economy jobs. */
export function economyScheduler(): Scheduler {
  const s = schedulerNew();
  economyRegister(s);
  return s;
}

/**
 * Runs the monthly job due at 00:00 on date (a 1st): the step 1 slots on quarter starts, then
 * steps 2 to 14. Returns the notices the jobs posted (alerts are raised at their default
 * levels).
 */
export function runMonth(s: Scheduler, w: World, draws: DrawSource, date: SimDate): Notice[] {
  if (date.day !== 1) throw new Error("runMonth needs a 1st");
  w.clock = dateTimeMidnight(date);
  const facts = tickFactsNew(w.clock);
  const due = SLOT_VALUES.filter((slot) => slotGroup(slot) === "Monthly" && slotIsDue(slot, facts));
  const notices: Notice[] = [];
  const controls = controlsDefault();
  const ctx = jobCtxNew(facts, draws, notices, controls);
  schedulerRunSlots(s, due, w, ctx);
  return notices;
}

/** The 1st of every month from first (inclusive) to last (inclusive). */
export function monthStarts(first: SimDate, last: SimDate): SimDate[] {
  const out: SimDate[] = [];
  let m = simDateMonthOf(first);
  while (cmpDate(monthFirstDay(m), last) <= 0) {
    out.push(monthFirstDay(m));
    m = monthNext(m);
  }
  return out;
}

/** The industry with this industries.csv id. */
export function industry(w: World, key: string): IndustryId {
  const i = w.industries.findIndex((x) => x.key === key);
  if (i < 0) throw new Error(`no industry ${key}`);
  return i as IndustryId;
}

/** Relative difference. */
export function rel(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(b), Number.MIN_VALUE);
}
