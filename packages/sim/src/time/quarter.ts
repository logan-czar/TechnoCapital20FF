// The quarter's fixed dates (spec 4.4, 21.1): release, the 01:00 price move, the plan lock and
// the pre-quarter-end week, each in January, April, July and October. Ported from
// crates/sim/src/time/quarter.rs; the constants and the QuarterPhase, PhaseStart and PhaseInfo
// types live in types/control.ts.

import { cmpDate, type DateTime, type Month, type Quarter, type SimDate } from "../types/calendar.ts";
import {
  type PhaseInfo,
  type PhaseStart,
  PLAN_LOCK_DAY,
  PRICE_MOVE_HOUR,
  type QuarterPhase,
  RECAP_DAYS_BEFORE_RELEASE,
  RELEASE_DAY,
} from "../types/control.ts";
import {
  dateTimeAt,
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  quarterFirstMonth,
  quarterNext,
  quarterPrev,
  simDateAddDays,
  simDateDaysSinceEpoch,
  simDateIsQuarterFirstMonth,
  simDateQuarter,
  simDateYmd,
} from "./calendar.ts";

/**
 * 00:00 on the release day of quarter `q`'s first month (spec 4.4 row 1). The release in quarter
 * `q` publishes the statements of `q.prev()`.
 */
export function releaseTick(q: Quarter): DateTime {
  return dateTimeMidnight(dayOf(quarterFirstMonth(q), RELEASE_DAY));
}

/** 01:00 on the release day: the price move (spec 4.4). */
export function priceMoveTick(q: Quarter): DateTime {
  return dateTimeAt(dayOf(quarterFirstMonth(q), RELEASE_DAY), PRICE_MOVE_HOUR);
}

/** 00:00 on the plan lock day (spec 4.4 row 3). */
export function lockTick(q: Quarter): DateTime {
  return dateTimeMidnight(dayOf(quarterFirstMonth(q), PLAN_LOCK_DAY));
}

/**
 * 00:00 on the first day of the pre-quarter-end week that ends quarter `q` (spec 4.4 row 5): the
 * week before the release in `q.next()`.
 */
export function recapTick(q: Quarter): DateTime {
  const release = dayOf(quarterFirstMonth(quarterNext(q)), RELEASE_DAY);
  return dateTimeMidnight(simDateAddDays(release, -RECAP_DAYS_BEFORE_RELEASE));
}

/** True if `date` starts a pre-quarter-end week (spec 4.4 row 5). */
export function isRecapDay(date: SimDate): boolean {
  const release = simDateAddDays(date, RECAP_DAYS_BEFORE_RELEASE);
  return simDateIsQuarterFirstMonth(release) && release.day === RELEASE_DAY;
}

function dayOf(m: Month, day: number): SimDate {
  return simDateYmd(m.year, m.month, day);
}

/** PhaseStart's order (Rust tuple `Ord`): by date, then hour. */
export function cmpPhaseStart(a: PhaseStart, b: PhaseStart): number {
  return cmpDate(a[0], b[0]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
}

/**
 * The four phase starts that open in calendar quarter `q`, in order (spec 4.4): Release and
 * Reaction on the 2nd of its first month, Locked on the 9th, PreQuarterEnd 7 days before the next
 * release.
 */
export function phaseStarts(q: Quarter): [QuarterPhase, PhaseStart][] {
  const release = dayOf(quarterFirstMonth(q), RELEASE_DAY);
  const recap = simDateAddDays(
    dayOf(quarterFirstMonth(quarterNext(q)), RELEASE_DAY),
    -RECAP_DAYS_BEFORE_RELEASE,
  );
  return [
    ["Release", [release, 0]],
    ["Reaction", [release, PRICE_MOVE_HOUR]],
    ["Locked", [dayOf(quarterFirstMonth(q), PLAN_LOCK_DAY), 0]],
    ["PreQuarterEnd", [recap, 0]],
  ];
}

/**
 * Rust `PhaseInfo::days_to_next_phase`: calendar days from `today` to the day the next phase
 * starts (spec 8 quarter clock; D7). 0 on the release tick, since the reaction week starts at
 * 01:00 the same day.
 */
export function phaseInfoDaysToNextPhase(info: PhaseInfo, today: SimDate): number {
  const days = simDateDaysSinceEpoch(info.next_start[0]) - simDateDaysSinceEpoch(today);
  if (days < 0) throw new RangeError("next phase is not in the past");
  return days;
}

/** The quarter phase at `t` (spec 4.4). */
export function phaseAt(t: DateTime): PhaseInfo {
  const now: PhaseStart = [dateTimeDate(t), dateTimeHour(t)];
  const q = simDateQuarter(dateTimeDate(t));
  // Starts from the quarter before (its pre-quarter-end week runs into this one) to the quarter
  // after (its release ends this quarter's last week), in time order.
  const starts = [quarterPrev(q), q, quarterNext(q)].flatMap(phaseStarts);
  let i = -1;
  for (let k = starts.length - 1; k >= 0; k--) {
    if (cmpPhaseStart(starts[k]![1], now) <= 0) {
      i = k;
      break;
    }
  }
  if (i < 0) throw new Error("a phase started before any time");
  const [phase, started] = starts[i]!;
  const [next_phase, next_start] = starts[i + 1]!;
  return { phase, started, next_phase, next_start };
}

/** The first tick strictly after `t` at which `phase` starts (spec 9.1 SkipTo). */
export function nextPhaseStart(t: DateTime, phase: QuarterPhase): DateTime {
  let q = simDateQuarter(dateTimeDate(t));
  for (;;) {
    for (const [p, [date, hour]] of phaseStarts(q)) {
      if (p === phase && simDateDaysSinceEpoch(date) >= 0) {
        const at = dateTimeAt(date, hour);
        if (at > t) return at;
      }
    }
    q = quarterNext(q);
  }
}
