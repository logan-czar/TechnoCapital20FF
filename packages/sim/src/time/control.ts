// Controls (spec 9.1, 8 time controls row; build-plan M1.5): speed, pause, SkipTo, alert levels,
// and the build's additions logged as design fix 8 (SetAlert, SetOmniscient, the watchlist).
// Ported from crates/sim/src/time/control.rs; the types and constants live in types/control.ts.
//
// Controls change only how the runner runs the sim (speed, pause, skip, alerts) and what the
// player watches, never the economy, so `Sim::apply` applies them at once (D5) and they are saved
// but not part of the state hash (D13).

import type { DateTime } from "../types/calendar.ts";
import { type Controls, MAX_SPEED, SECONDS_PER_HOUR, START_SPEED } from "../types/control.ts";
import type { SkipKind } from "../types/notice.ts";
import { alertLevelsDefault } from "../world/notice.ts";
import { dateTimeDate, dateTimeMidnight, monthFirstDay, monthNext, simDateMonthOf } from "./calendar.ts";
import { nextPhaseStart } from "./quarter.ts";

/**
 * Rust `Controls::default`: a new game, paused at speed 1 with the default alert levels (spec
 * 7.3, 8).
 */
export function controlsDefault(): Controls {
  return {
    speed: START_SPEED,
    paused: true,
    skip: null,
    alerts: alertLevelsDefault(),
    omniscient: false,
    watchlist: new Set(),
  };
}

/** The speed the runner should run at: 0 when paused, max while skipping (spec 9.1). */
export function controlsEffectiveSpeed(c: Controls): number {
  if (c.paused) return 0;
  if (c.skip !== null) return MAX_SPEED;
  return c.speed;
}

/** Real seconds per tick at the effective speed; null when paused or at max speed. */
export function controlsSecondsPerTick(c: Controls): number | null {
  const s = controlsEffectiveSpeed(c);
  if (s === 0) return null;
  return SECONDS_PER_HOUR[s - 1] ?? null;
}

/** The tick a SkipTo started at `now` stops after: the next one strictly after `now` (D8). */
export function skipTarget(now: DateTime, kind: SkipKind): DateTime {
  switch (kind) {
    case "NextRelease":
      return nextPhaseStart(now, "Release");
    case "NextLock":
      return nextPhaseStart(now, "Locked");
    case "NextRecap":
      return nextPhaseStart(now, "PreQuarterEnd");
    // The monthly close of the month in progress: 00:00 on the next 1st (spec 4.3).
    case "MonthEnd":
      return dateTimeMidnight(monthFirstDay(monthNext(simDateMonthOf(dateTimeDate(now)))));
  }
}
