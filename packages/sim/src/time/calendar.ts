// The calendar (spec 3.1, 4; build-plan M1.1). Time is a count of hours since the game epoch,
// 2020-01-01 00:00 UTC (spec 3.1 `clock`); dates, weekdays, months and quarters are views of it.
// The proleptic Gregorian calendar with the 400-year leap rule; there are no time zones or
// daylight saving. Ported from crates/sim/src/time/calendar.rs; the types and constants live in
// types/calendar.ts.
//
// Integer arithmetic: every value here is a small whole number, exact in an f64. Rust's `/` on
// non-negative i64 is `Math.floor`, and `div_euclid` / `rem_euclid` are floor-based too.

import {
  DAYS_PER_WEEK,
  type DateTime,
  EPOCH_WEEKDAY,
  EPOCH_YEAR,
  HOURS_PER_DAY,
  type Month,
  QUARTER_FIRST_MONTHS,
  type Quarter,
  type SimDate,
  WEEKDAY_VALUES,
  type Weekday,
} from "../types/calendar.ts";

/** Rust `div_euclid` for a positive divisor. */
function divEuclid(a: number, b: number): number {
  return Math.floor(a / b);
}

/** Rust `rem_euclid` for a positive divisor. */
function remEuclid(a: number, b: number): number {
  return a - Math.floor(a / b) * b;
}

/** Rust's `{:0w}` for an integer: zero-padded to `w` characters, the sign counted in the width. */
function pad(n: number, w: number): string {
  if (n < 0) return `-${String(-n).padStart(w - 1, "0")}`;
  return String(n).padStart(w, "0");
}

/** True for leap years: every 4th year, except centuries not divisible by 400. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in `month` (1 to 12) of `year`. */
export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      throw new RangeError(`month ${month} out of range`);
  }
}

/** Days in `year`. */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** Days from 1970-01-01 to a civil date (H. Hinnant's `days_from_civil`). */
function daysFromCivil(year: number, month: number, day: number): number {
  const m = month;
  const d = day;
  const y = year - (m <= 2 ? 1 : 0);
  const era = divEuclid(y, 400);
  const yoe = y - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

/** The civil date of a day count from 1970-01-01 (H. Hinnant's `civil_from_days`). */
function civilFromDays(days: number): SimDate {
  const z = days + 719_468;
  const era = divEuclid(z, 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  // Ranges are guaranteed by the algorithm: day 1..=31, month 1..=12.
  return { year, month, day };
}

/** Days from 1970-01-01 to the game epoch. */
const EPOCH_DAYS = daysFromCivil(EPOCH_YEAR, 1, 1);

// ---------------------------------------------------------------- Weekday

/** Rust `Weekday::index`: Monday is 0. */
export function weekdayIndex(w: Weekday): number {
  return WEEKDAY_VALUES.indexOf(w);
}

/** Rust `Weekday::short_name`: three-letter name for the top bar (spec 8). */
export function weekdayShortName(w: Weekday): string {
  // The union values are the short names.
  return w;
}

// ---------------------------------------------------------------- Date

/** Rust `Date::new`: the date, if it exists. */
export function simDateNew(year: number, month: number, day: number): SimDate | null {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
    ? { year, month, day }
    : null;
}

/** Rust `Date::ymd`: the date; throws if it does not exist. For constants and tests. */
export function simDateYmd(year: number, month: number, day: number): SimDate {
  const d = simDateNew(year, month, day);
  if (d === null) throw new RangeError(`${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)} is not a date`);
  return d;
}

/** Days since 2020-01-01 (negative before it). */
export function simDateDaysSinceEpoch(d: SimDate): number {
  return daysFromCivil(d.year, d.month, d.day) - EPOCH_DAYS;
}

/** The date `days` after 2020-01-01. */
export function simDateFromDaysSinceEpoch(days: number): SimDate {
  return civilFromDays(days + EPOCH_DAYS);
}

/** The date `n` days later (or earlier, if negative). */
export function simDateAddDays(d: SimDate, n: number): SimDate {
  return simDateFromDaysSinceEpoch(simDateDaysSinceEpoch(d) + n);
}

export function simDateWeekday(d: SimDate): Weekday {
  const i = remEuclid(simDateDaysSinceEpoch(d) + weekdayIndex(EPOCH_WEEKDAY), DAYS_PER_WEEK);
  return WEEKDAY_VALUES[i]!;
}

/** The month this date is in. */
export function simDateMonthOf(d: SimDate): Month {
  return { year: d.year, month: d.month };
}

/** The calendar quarter this date is in (accounting quarters are calendar quarters, spec 4.4). */
export function simDateQuarter(d: SimDate): Quarter {
  return { year: d.year, q: Math.floor((d.month - 1) / 3) + 1 };
}

/** The last day of this date's month. */
export function simDateIsMonthEnd(d: SimDate): boolean {
  return d.day === daysInMonth(d.year, d.month);
}

/**
 * True in January, April, July and October: the months with a quarterly draw, close, release and
 * plan lock (spec 4.3 step 1, 4.4).
 */
export function simDateIsQuarterFirstMonth(d: SimDate): boolean {
  return (QUARTER_FIRST_MONTHS as readonly number[]).includes(d.month);
}

/** Rust `Display for Date`: "2020-01-01". */
export function formatSimDate(d: SimDate): string {
  return `${pad(d.year, 4)}-${pad(d.month, 2)}-${pad(d.day, 2)}`;
}

// ---------------------------------------------------------------- Month

export function monthFirstDay(m: Month): SimDate {
  return simDateYmd(m.year, m.month, 1);
}

export function monthLastDay(m: Month): SimDate {
  return simDateYmd(m.year, m.month, daysInMonth(m.year, m.month));
}

export function monthNext(m: Month): Month {
  return m.month === 12 ? { year: m.year + 1, month: 1 } : { year: m.year, month: m.month + 1 };
}

export function monthPrev(m: Month): Month {
  return m.month === 1 ? { year: m.year - 1, month: 12 } : { year: m.year, month: m.month - 1 };
}

/** Rust `Display for Month`: "2020-01". */
export function formatMonth(m: Month): string {
  return `${pad(m.year, 4)}-${pad(m.month, 2)}`;
}

// ---------------------------------------------------------------- Quarter

export function quarterFirstMonth(q: Quarter): Month {
  const month = QUARTER_FIRST_MONTHS[q.q - 1];
  if (month === undefined) throw new RangeError(`quarter ${q.q} out of range`);
  return { year: q.year, month };
}

export function quarterFirstDay(q: Quarter): SimDate {
  return monthFirstDay(quarterFirstMonth(q));
}

export function quarterNext(q: Quarter): Quarter {
  return q.q === 4 ? { year: q.year + 1, q: 1 } : { year: q.year, q: q.q + 1 };
}

export function quarterPrev(q: Quarter): Quarter {
  return q.q === 1 ? { year: q.year - 1, q: 4 } : { year: q.year, q: q.q - 1 };
}

/** Rust `Display for Quarter`: "Q1 2020". */
export function formatQuarter(q: Quarter): string {
  return `Q${q.q} ${q.year}`;
}

// ---------------------------------------------------------------- DateTime

/** Largest DateTime (Rust `u32::MAX`). */
const DATETIME_MAX = 0xffff_ffff;

export function dateTimeFromHours(hours: number): DateTime {
  if (!Number.isInteger(hours) || hours < 0 || hours > DATETIME_MAX) {
    throw new RangeError(`${hours} is not a u32 hour count`);
  }
  return hours;
}

/** Hours since 2020-01-01 00:00. */
export function dateTimeHours(t: DateTime): number {
  return t;
}

/** `hour` (0 to 23) on `date`; throws before the epoch. */
export function dateTimeAt(date: SimDate, hour: number): DateTime {
  if (!(hour >= 0 && hour < HOURS_PER_DAY)) throw new RangeError(`hour ${hour} out of range`);
  const days = simDateDaysSinceEpoch(date);
  if (days < 0) throw new RangeError("date before the game epoch");
  return dateTimeFromHours(days * HOURS_PER_DAY + hour);
}

/** 00:00 on `date`. */
export function dateTimeMidnight(date: SimDate): DateTime {
  return dateTimeAt(date, 0);
}

export function dateTimeDate(t: DateTime): SimDate {
  return simDateFromDaysSinceEpoch(Math.floor(t / HOURS_PER_DAY));
}

/** 0 to 23. */
export function dateTimeHour(t: DateTime): number {
  return t % HOURS_PER_DAY;
}

export function dateTimeWeekday(t: DateTime): Weekday {
  return simDateWeekday(dateTimeDate(t));
}

export function dateTimeAddHours(t: DateTime, n: number): DateTime {
  // Rust panics on u32 overflow (debug builds).
  return dateTimeFromHours(t + n);
}

/** The next tick. */
export function dateTimeNext(t: DateTime): DateTime {
  return dateTimeAddHours(t, 1);
}

/** Rust `Display for DateTime`: "2020-01-01 00:00". */
export function formatDateTime(t: DateTime): string {
  return `${formatSimDate(dateTimeDate(t))} ${pad(dateTimeHour(t), 2)}:00`;
}
