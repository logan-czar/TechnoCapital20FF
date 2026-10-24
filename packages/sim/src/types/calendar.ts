// Calendar types (spec 3.1, 4; build-plan M1.1). Ported from crates/sim/src/time/calendar.rs.
//
// Time is a count of hours since the game epoch, 2020-01-01 00:00 UTC (spec 3.1 `clock`); dates,
// weekdays, months and quarters are views of it. The proleptic Gregorian calendar with the
// 400-year leap rule; there are no time zones or daylight saving.
//
// Ported here: the types, the constants, `DateTime::START`, and the orderings (Rust derives `Ord`
// on Date, Month, Quarter and DateTime, so contracts compare them with the cmp* helpers below).
// Left to the time/ module port (packages/sim/src/time/calendar.ts): is_leap_year,
// days_in_month, days_in_year, days_from_civil / civil_from_days, Date::{new, ymd,
// days_since_epoch, from_days_since_epoch, add_days, weekday, month_of, quarter, is_month_end,
// is_quarter_first_month}, Month::{first_day, last_day, next, prev}, Quarter::{first_month,
// first_day, next, prev}, DateTime::{from_hours, hours, at, midnight, date, hour, weekday,
// add_hours, next}, Weekday::short_name and the Display formats ("2020-01-01",
// "2020-01", "Q1 2020", "2020-01-01 00:00").

/** The year the game starts in (spec 3.1: the clock starts 2020-01-01 00:00). */
export const EPOCH_YEAR = 2020;
/** Hours in a day (one tick is one hour, spec 4). */
export const HOURS_PER_DAY = 24;
/** Days in a week (Rust private `DAYS_PER_WEEK`). */
export const DAYS_PER_WEEK = 7;
/** The first month of each calendar quarter: January, April, July and October (spec 4.4). */
export const QUARTER_FIRST_MONTHS: readonly [1, 4, 7, 10] = [1, 4, 7, 10];

/** Day of the week. Monday is index 0 (Rust `Weekday::index`). */
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/** Rust `Weekday::ALL`, in declaration order: the position is `Weekday::index` (Monday 0). */
export const WEEKDAY_VALUES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** 2020-01-01 was a Wednesday (Rust private `EPOCH_WEEKDAY`). */
export const EPOCH_WEEKDAY: Weekday = "Wed";

/**
 * A calendar date (Rust `Date`). Renamed so it never shadows the JS global `Date` (D952).
 * Ordered by (year, month, day) (`cmpDate`).
 */
export interface SimDate {
  /** Whole number (i32). */
  year: number;
  /** 1 to 12. */
  month: number;
  /** 1 to 31. */
  day: number;
}

/** A calendar month. Ordered by (year, month) (`cmpMonth`). */
export interface Month {
  /** Whole number (i32). */
  year: number;
  /** 1 to 12. */
  month: number;
}

/**
 * A calendar quarter, Q1 to Q4 (accounting quarters are calendar quarters, spec 4.4). Ordered by
 * (year, q) (`cmpQuarter`).
 */
export interface Quarter {
  /** Whole number (i32). */
  year: number;
  /** 1 to 4. */
  q: number;
}

/**
 * A point on the clock: whole hours since 2020-01-01 00:00 UTC (spec 3.1). One tick is one hour
 * (spec 4), so this is also the tick number. Whole number (u32); covers about 490,000 years.
 * Rust newtype `DateTime(u32)`; compare with `<` or `cmpDateTime`.
 */
export type DateTime = number;

/** Rust `DateTime::START`: the game start, 2020-01-01 00:00 (spec 3.1, 7.3). */
export const DATETIME_START: DateTime = 0;

function cmpNum(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Rust's derived `Ord` for `Date`: by year, then month, then day. */
export function cmpDate(a: SimDate, b: SimDate): number {
  return cmpNum(a.year, b.year) || cmpNum(a.month, b.month) || cmpNum(a.day, b.day);
}

/** Rust's derived `Ord` for `Month`: by year, then month. */
export function cmpMonth(a: Month, b: Month): number {
  return cmpNum(a.year, b.year) || cmpNum(a.month, b.month);
}

/** Rust's derived `Ord` for `Quarter`: by year, then quarter. */
export function cmpQuarter(a: Quarter, b: Quarter): number {
  return cmpNum(a.year, b.year) || cmpNum(a.q, b.q);
}

/** Rust's derived `Ord` for `DateTime`: by hours since the epoch. */
export function cmpDateTime(a: DateTime, b: DateTime): number {
  return cmpNum(a, b);
}

/** Rust `==` for `Date`. */
export function dateEq(a: SimDate, b: SimDate): boolean {
  return cmpDate(a, b) === 0;
}

/** Rust `==` for `Month`. */
export function monthEq(a: Month, b: Month): boolean {
  return cmpMonth(a, b) === 0;
}

/** Rust `==` for `Quarter`. */
export function quarterEq(a: Quarter, b: Quarter): boolean {
  return cmpQuarter(a, b) === 0;
}
