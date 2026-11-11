// The election calendar (pivot 6.1; D1040): general days, the Senate class and the governors up,
// primaries in the spring and summer, January handovers.

import { describe, expect, it } from "vitest";
import {
  certifyDate,
  electionDay,
  governorCycles,
  governorUp,
  handoverDate,
  hasGeneral,
  isPresidentYear,
  presidentPrimary,
  senateClassUp,
  statePrimary,
  termEnds,
} from "../../src/elections/calendar.ts";
import { simDateWeekday, simDateYmd } from "../../src/time/calendar.ts";
import { data1995 } from "../common/index.ts";

/** The real federal general days, 1996 to 2024. */
const GENERALS: readonly [number, number][] = [
  [1996, 5],
  [1998, 3],
  [2000, 7],
  [2002, 5],
  [2004, 2],
  [2006, 7],
  [2008, 4],
  [2010, 2],
  [2012, 6],
  [2014, 4],
  [2016, 8],
  [2018, 6],
  [2020, 3],
  [2022, 8],
  [2024, 5],
];

/** The Senate class up in each of those years (class 2 in 1996, 3 in 1998, 1 in 2000, ...). */
const CLASSES: readonly number[] = [2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1];

const names = (): string[] => data1995().politics_states.rows.map((r) => r.state);

describe("the calendar (pivot 6.1)", () => {
  it("puts each federal general on the first Tuesday after the first Monday of November", () => {
    for (const [year, day] of GENERALS) {
      const d = electionDay(year);
      expect(d).toEqual(simDateYmd(year, 11, day));
      expect(simDateWeekday(d)).toBe("Tue");
    }
  });

  it("rotates the Senate classes, and the presidency every four years", () => {
    GENERALS.forEach(([year], i) => {
      expect(senateClassUp(year)).toBe(CLASSES[i]);
      expect(isPresidentYear(year)).toBe(year % 4 === 0);
    });
  });

  it("elects 34 governors at midterms, 11 with the president, 2 and 3 in the odd years", () => {
    const cycles = governorCycles(names());
    expect(cycles.filter((c) => c === null)).toHaveLength(1);
    const up = (year: number): string[] => names().filter((_, i) => governorUp(cycles[i] ?? null, year));
    for (let year = 1996; year <= 2024; year++) {
      const n = up(year).length;
      const expected = year % 4 === 2 ? 34 : year % 4 === 0 ? 11 : year % 4 === 1 ? 2 : 3;
      expect(n, `${year}`).toBe(expected);
      expect(hasGeneral(year, cycles)).toBe(true);
    }
    expect(up(2017).sort()).toEqual(["New Jersey", "Virginia"]);
    expect(up(2019).sort()).toEqual(["Kentucky", "Louisiana", "Mississippi"]);
    expect(up(2020)).toContain("North Carolina");
    expect(up(2018)).toContain("California");
    expect(up(2018)).not.toContain("District of Columbia");
  });

  it("holds primaries in the spring and summer, on Tuesdays", () => {
    for (let state = 0; state < 51; state++) {
      for (const year of [1996, 1997, 2018]) {
        const d = statePrimary(state, year);
        expect(simDateWeekday(d)).toBe("Tue");
        expect(d.month).toBeGreaterThanOrEqual(3);
        expect(d.month).toBeLessThanOrEqual(8);
      }
    }
    expect(presidentPrimary(2000)).toEqual(simDateYmd(2000, 3, 7));
  });

  it("certifies in late November and seats the winners in January", () => {
    expect(certifyDate(electionDay(2000))).toEqual(simDateYmd(2000, 12, 5));
    expect(handoverDate("House", 2000)).toEqual(simDateYmd(2001, 1, 3));
    expect(handoverDate("President", 2000)).toEqual(simDateYmd(2001, 1, 20));
    expect(handoverDate("Governor", 2019)).toEqual(simDateYmd(2020, 1, 3));
    expect(termEnds("Senate", 2000)).toEqual(simDateYmd(2007, 1, 3));
    expect(termEnds("House", 2000)).toEqual(simDateYmd(2003, 1, 3));
    expect(termEnds("President", 2000)).toEqual(simDateYmd(2005, 1, 20));
  });
});
