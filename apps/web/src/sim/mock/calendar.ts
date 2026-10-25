// The mock sim's calendar math. The real sim's helpers (packages/sim/src/time/calendar.ts and
// quarter.ts) are not on the public face of "@tc20ff/sim", and the UI may not import
// "@tc20ff/sim/internal", so the mock keeps a small copy of what it needs to build a ClockView.
// CONTRACT: export dateTimeDate, dateTimeHour, dateTimeWeekday, dateTimeAt, phaseAt and
// nextPhaseStart from the public face so the UI and the mock need no copy.

import {
  type DateTime,
  HOURS_PER_DAY,
  PLAN_LOCK_DAY,
  QUARTER_FIRST_MONTHS,
  type QuarterPhase,
  RECAP_DAYS_BEFORE_RELEASE,
  RELEASE_DAY,
  type SimDate,
  WEEKDAY_VALUES,
  type Weekday,
} from "@tc20ff/sim";

/** Days from 1970-01-01 to the game's epoch, 2020-01-01. */
const EPOCH_DAYS_FROM_1970 = 18262;

/** Days since 2020-01-01 of a civil date (Howard Hinnant's days_from_civil). */
export function daysSinceEpoch(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468 - EPOCH_DAYS_FROM_1970;
}

/** The civil date `days` after 2020-01-01. */
export function dateOfDays(days: number): SimDate {
  const z = days + EPOCH_DAYS_FROM_1970 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

export function dateTimeDate(t: DateTime): SimDate {
  return dateOfDays(Math.floor(t / HOURS_PER_DAY));
}

export function dateTimeHour(t: DateTime): number {
  return ((t % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
}

/** 2020-01-01 was a Wednesday (index 2, Monday 0). */
export function dateTimeWeekday(t: DateTime): Weekday {
  const days = Math.floor(t / HOURS_PER_DAY);
  return WEEKDAY_VALUES[(((days + 2) % 7) + 7) % 7] as Weekday;
}

export function hoursOf(year: number, month: number, day: number): DateTime {
  return daysSinceEpoch(year, month, day) * HOURS_PER_DAY;
}

/** The release tick of a quarter-first month: 00:00 on the 2nd (spec 4.4 row 1). */
function releaseTick(year: number, month: number): DateTime {
  return hoursOf(year, month, RELEASE_DAY);
}

/** The latest release at or before `t`, and the one after it. */
function surroundingReleases(t: DateTime): {
  last: SimDate;
  lastTick: DateTime;
  nextTick: DateTime;
  next: SimDate;
} {
  const d = dateTimeDate(t);
  let year = d.year;
  let idx = QUARTER_FIRST_MONTHS.length - 1;
  while (idx >= 0 && (QUARTER_FIRST_MONTHS[idx] as number) > d.month) idx--;
  if (idx < 0) {
    year--;
    idx = QUARTER_FIRST_MONTHS.length - 1;
  }
  let month = QUARTER_FIRST_MONTHS[idx] as number;
  if (releaseTick(year, month) > t) {
    idx--;
    if (idx < 0) {
      year--;
      idx = QUARTER_FIRST_MONTHS.length - 1;
    }
    month = QUARTER_FIRST_MONTHS[idx] as number;
  }
  const nIdx = (idx + 1) % QUARTER_FIRST_MONTHS.length;
  const nYear = nIdx === 0 ? year + 1 : year;
  const nMonth = QUARTER_FIRST_MONTHS[nIdx] as number;
  return {
    last: { year, month, day: RELEASE_DAY },
    lastTick: releaseTick(year, month),
    nextTick: releaseTick(nYear, nMonth),
    next: { year: nYear, month: nMonth, day: RELEASE_DAY },
  };
}

const PHASE_ORDER: readonly QuarterPhase[] = ["Release", "Reaction", "Locked", "PreQuarterEnd"];

export interface PhaseAt {
  phase: QuarterPhase;
  nextPhase: QuarterPhase;
  daysToNextPhase: number;
  nextRelease: DateTime;
}

/** The quarter phase at `t`, the next phase and the days to it (spec 4.4, 21.1). */
export function phaseAt(t: DateTime): PhaseAt {
  const { last, lastTick, nextTick } = surroundingReleases(t);
  const lock = hoursOf(last.year, last.month, PLAN_LOCK_DAY);
  const recap = nextTick - RECAP_DAYS_BEFORE_RELEASE * HOURS_PER_DAY;
  const starts = [lastTick, lastTick + 1, lock, recap, nextTick];
  let i = 0;
  while (i < 3 && t >= (starts[i + 1] as number)) i++;
  const nextStart = starts[i + 1] as number;
  return {
    phase: PHASE_ORDER[i] as QuarterPhase,
    nextPhase: PHASE_ORDER[(i + 1) % 4] as QuarterPhase,
    daysToNextPhase: Math.ceil((nextStart - t) / HOURS_PER_DAY),
    nextRelease: nextTick,
  };
}

/** True on the release tick (spec 4.4 row 1). */
export function isReleaseTick(t: DateTime): boolean {
  const d = dateTimeDate(t);
  return (
    dateTimeHour(t) === 0 &&
    d.day === RELEASE_DAY &&
    (QUARTER_FIRST_MONTHS as readonly number[]).includes(d.month)
  );
}

export function isLockTick(t: DateTime): boolean {
  const d = dateTimeDate(t);
  return (
    dateTimeHour(t) === 0 &&
    d.day === PLAN_LOCK_DAY &&
    (QUARTER_FIRST_MONTHS as readonly number[]).includes(d.month)
  );
}

export function isQuarterStartTick(t: DateTime): boolean {
  const d = dateTimeDate(t);
  return (
    dateTimeHour(t) === 0 && d.day === 1 && (QUARTER_FIRST_MONTHS as readonly number[]).includes(d.month)
  );
}

export function isRecapTick(t: DateTime): boolean {
  const { nextTick } = surroundingReleases(t);
  return t === nextTick - RECAP_DAYS_BEFORE_RELEASE * HOURS_PER_DAY;
}
