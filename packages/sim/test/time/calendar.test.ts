// Ported from the tests in crates/sim/src/time/calendar.rs.

import { describe, expect, it } from "vitest";
import {
  dateTimeAddHours,
  dateTimeAt,
  dateTimeDate,
  dateTimeHour,
  dateTimeHours,
  dateTimeMidnight,
  dateTimeNext,
  dateTimeWeekday,
  daysInMonth,
  daysInYear,
  formatDateTime,
  formatQuarter,
  isLeapYear,
  monthFirstDay,
  monthLastDay,
  monthNext,
  quarterFirstDay,
  quarterNext,
  quarterPrev,
  simDateAddDays,
  simDateDaysSinceEpoch,
  simDateFromDaysSinceEpoch,
  simDateIsMonthEnd,
  simDateMonthOf,
  simDateNew,
  simDateQuarter,
  simDateWeekday,
  simDateYmd,
  weekdayIndex,
} from "../../src/time/calendar.ts";
import { DATETIME_START, type SimDate, type Weekday } from "../../src/types/calendar.ts";

describe("calendar", () => {
  it("epoch is Wednesday 1 January 2020", () => {
    const t = DATETIME_START;
    expect(dateTimeDate(t)).toEqual(simDateYmd(2020, 1, 1));
    expect(dateTimeHour(t)).toBe(0);
    expect(dateTimeWeekday(t)).toBe("Wed");
    expect(formatDateTime(t)).toBe("2020-01-01 00:00");
  });

  it("leap days 2024, 2028, 2048", () => {
    // Each leap day exists, has the right weekday and hour index, and the next day is 1 March.
    const cases: [number, Weekday][] = [
      [2024, "Thu"],
      [2028, "Tue"],
      [2048, "Sat"],
    ];
    for (const [year, weekday] of cases) {
      const leap = simDateNew(year, 2, 29);
      expect(leap).not.toBeNull();
      if (leap === null) return;
      expect(isLeapYear(year)).toBe(true);
      expect(daysInMonth(year, 2)).toBe(29);
      expect(daysInYear(year)).toBe(366);
      expect(simDateWeekday(leap)).toBe(weekday);
      expect(simDateIsMonthEnd(leap)).toBe(true);
      expect(simDateAddDays(leap, 1)).toEqual(simDateYmd(year, 3, 1));
      expect(simDateAddDays(simDateYmd(year, 3, 1), -1)).toEqual(leap);
      const t = dateTimeAt(leap, 13);
      expect(dateTimeDate(t)).toEqual(leap);
      expect(dateTimeHour(t)).toBe(13);
      expect(simDateNew(year + 1, 2, 29)).toBeNull();
    }
    // 2024-02-29 00:00: 1,461 days for 2020 to 2023, plus 31 + 28 days.
    expect(dateTimeHours(dateTimeMidnight(simDateYmd(2024, 2, 29)))).toBe(1520 * 24);
  });

  it("adds only whole, non-negative hours (Rust u32)", () => {
    expect(dateTimeAddHours(5, 3)).toBe(8);
    expect(() => dateTimeAddHours(5, -1)).toThrow();
    expect(() => dateTimeAddHours(5, 0.5)).toThrow();
    expect(() => dateTimeAddHours(0xffff_ffff, 1)).toThrow();
  });

  it("century rule", () => {
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(simDateNew(2100, 2, 29)).toBeNull();
    expect(daysInYear(2100)).toBe(365);
  });

  it("month ends", () => {
    const ends = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    ends.forEach((n, i) => {
      const m = { year: 2020, month: i + 1 };
      expect(monthLastDay(m).day).toBe(n);
      expect(simDateIsMonthEnd(monthLastDay(m))).toBe(true);
      expect(simDateAddDays(monthLastDay(m), 1)).toEqual(monthFirstDay(monthNext(m)));
    });
    expect(daysInMonth(2021, 2)).toBe(28);
    expect(monthNext({ year: 2020, month: 12 })).toEqual({ year: 2021, month: 1 });
  });

  it("every day round trips through 2080", () => {
    let date: SimDate = simDateYmd(2020, 1, 1);
    let weekday = weekdayIndex("Wed");
    // Plain checks, not expect(), so 22,326 days stay fast; the first mismatch fails the test.
    for (let days = 0; days < 61 * 366; days++) {
      const t = dateTimeAt(date, 23);
      const next = simDateAddDays(date, 1);
      const back = simDateFromDaysSinceEpoch(days);
      const ok =
        simDateDaysSinceEpoch(date) === days &&
        back.year === date.year &&
        back.month === date.month &&
        back.day === date.day &&
        weekdayIndex(simDateWeekday(date)) === weekday &&
        dateTimeHour(t) === 23 &&
        simDateDaysSinceEpoch(dateTimeDate(t)) === days &&
        simDateDaysSinceEpoch(dateTimeDate(dateTimeNext(t))) === simDateDaysSinceEpoch(next);
      if (!ok) expect.fail(`day ${days} (${JSON.stringify(date)}) does not round trip`);
      // Step to the next date by hand.
      date = simDateIsMonthEnd(date)
        ? monthFirstDay(monthNext(simDateMonthOf(date)))
        : simDateYmd(date.year, date.month, date.day + 1);
      weekday = (weekday + 1) % 7;
    }
  });

  it("quarters", () => {
    expect(simDateQuarter(simDateYmd(2020, 3, 31))).toEqual({ year: 2020, q: 1 });
    expect(simDateQuarter(simDateYmd(2020, 4, 1))).toEqual({ year: 2020, q: 2 });
    expect(simDateQuarter(simDateYmd(2020, 12, 31))).toEqual({ year: 2020, q: 4 });
    const q = { year: 2020, q: 1 };
    expect(quarterPrev(q)).toEqual({ year: 2019, q: 4 });
    expect(quarterNext(quarterPrev(q))).toEqual(q);
    expect(quarterFirstDay({ year: 2020, q: 3 })).toEqual(simDateYmd(2020, 7, 1));
    expect(formatQuarter(q)).toBe("Q1 2020");
  });
});
