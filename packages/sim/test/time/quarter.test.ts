// Ported from the tests in crates/sim/src/time/quarter.rs.

import { describe, expect, it } from "vitest";
import {
  dateTimeDate,
  formatDateTime,
  formatSimDate,
  simDateAddDays,
  simDateYmd,
} from "../../src/time/calendar.ts";
import { isRecapDay, lockTick, priceMoveTick, recapTick, releaseTick } from "../../src/time/quarter.ts";

describe("quarter", () => {
  it("spec dates", () => {
    const q2 = { year: 2020, q: 2 };
    expect(formatDateTime(releaseTick(q2))).toBe("2020-04-02 00:00");
    expect(formatDateTime(priceMoveTick(q2))).toBe("2020-04-02 01:00");
    expect(formatDateTime(lockTick(q2))).toBe("2020-04-09 00:00");
    const recaps = [1, 2, 3, 4].map((q) => formatSimDate(dateTimeDate(recapTick({ year: 2020, q }))));
    expect(recaps).toEqual(["2020-03-26", "2020-06-25", "2020-09-25", "2020-12-26"]);
    for (const r of recaps) {
      const d = simDateYmd(2020, Number(r.slice(5, 7)), Number(r.slice(8)));
      expect(isRecapDay(d)).toBe(true);
      expect(isRecapDay(simDateAddDays(d, 1))).toBe(false);
    }
  });
});
