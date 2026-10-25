// Port of the in-file tests of crates/sim/src/market/index.rs (history_tests).
import { describe, expect, it } from "vitest";
import {
  indexHistoryDropBefore,
  indexHistoryIter,
  indexHistoryLast,
  indexHistoryLen,
  indexHistoryNew,
  indexHistoryRecord,
} from "../../src/market/exchange_index.ts";
import { simDateAddDays, simDateYmd } from "../../src/time/calendar.ts";
import { cmpDate } from "../../src/types/calendar.ts";

describe("index history", () => {
  it("one_close_a_day_and_ten_years_kept", () => {
    const h = indexHistoryNew();
    let d = simDateYmd(2020, 1, 1);
    for (let i = 0; i < 400; i++) {
      indexHistoryRecord(h, d, 1000.0 + i);
      d = simDateAddDays(d, 1);
    }
    expect(indexHistoryLen(h)).toBe(400);
    indexHistoryRecord(h, simDateYmd(2020, 1, 5), 1.0);
    expect(indexHistoryLen(h), "a date not after the last is ignored").toBe(400);
    indexHistoryDropBefore(h, simDateYmd(2020, 3, 15));
    const rows = [...indexHistoryIter(h)];
    expect(rows[0]?.date).toEqual(simDateYmd(2020, 3, 15));
    expect(indexHistoryLast(h)?.level).toBe(1399.0);
    for (let i = 1; i < rows.length; i++) {
      expect(cmpDate(rows[i - 1]!.date, rows[i]!.date)).toBeLessThan(0);
    }
  });
});
