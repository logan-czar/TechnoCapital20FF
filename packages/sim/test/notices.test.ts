// `Sim::step` returns the spec 9.3 notices of each tick, in order (build-plan M1.6; D10). Ported
// from crates/sim/tests/notices.rs, on `testSim` (test_sim.ts).

import { describe, expect, it } from "vitest";
import {
  dateTimeDate,
  dateTimeMidnight,
  monthNext,
  simDateAddDays,
  simDateMonthOf,
  simDateYmd,
} from "../src/time/calendar.ts";
import type { Quarter } from "../src/types/calendar.ts";
import { testSim } from "./test_sim.ts";

describe("notices", () => {
  it("a year of notices", () => {
    const s = testSim(3);
    const end = dateTimeMidnight(simDateYmd(2021, 1, 1));
    let days = 0;
    let months = 0;
    let ticks = 0;
    const released: Quarter[] = [];
    const locked: Quarter[] = [];
    while (s.now() < end) {
      const n = s.step();
      expect(n[n.length - 1]).toEqual({ kind: "TickDone", time: s.now() });
      for (const notice of n) {
        switch (notice.kind) {
          case "DayDone":
            expect(simDateAddDays(notice.date, 1)).toEqual(dateTimeDate(s.now()));
            days += 1;
            break;
          case "MonthDone":
            expect(monthNext(notice.month)).toEqual(simDateMonthOf(dateTimeDate(s.now())));
            months += 1;
            break;
          case "EarningsReleased":
            released.push(notice.quarter);
            break;
          case "PlanLocked":
            locked.push(notice.quarter);
            break;
          case "TickDone":
            ticks += 1;
            break;
          default:
            break;
        }
      }
    }
    expect([ticks, days, months]).toEqual([8784, 366, 12]);
    const q = (year: number, q: number): Quarter => ({ year, q });
    expect(released).toEqual([q(2019, 4), q(2020, 1), q(2020, 2), q(2020, 3)]);
    expect(locked).toEqual([q(2020, 1), q(2020, 2), q(2020, 3), q(2020, 4)]);
    expect(monthNext({ year: 2020, month: 12 })).toEqual(simDateMonthOf(dateTimeDate(s.now())));
  });
});
